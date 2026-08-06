  // ===== Widget: Heizplan (heatplan) — interaktiver Wochen-Temperaturplan =====
  //
  //  Voll interaktiver Editor der HomeMatic-Heizungssteuerung (#53700):
  //   - Räume (frei wählbar, geclustert EG/OG/DG) als Tab-Reihe
  //   - Präsenz-Profile Normal / Erweitert / Abgesenkt
  //   - Tages-Sollkurve mit ziehbaren Griffen (Grenze waagrecht, Temperatur senkrecht)
  //   - Wochenübersicht (7 Streifen, nach Solltemperatur eingefärbt) zum Anspringen
  //   - Slot-Editor mit Steppern, Slot einfügen/löschen, Tag übertragen, Speichern
  //
  //  Daten kommen über ?api=heat (Proxy auf IPS-Skript HM_Heizung_LVB). Im Doku-Modus
  //  wird ausschliesslich mit eingebetteten Demodaten gearbeitet (nie Netz, nie speichern).

  var _hpState = {};                         // w.id -> Editor-Zustand
  var _hpRooms = null;                       // Raumliste (via ?api=heat&op=list)
  var _hpRoomsRoot = null;                   // Root-ID, für die _hpRooms geladen wurde
  var _hpGroupOrder = null;                  // Gruppen-Reihenfolge (Geschosse aus der Topologie, hsMode)
  function hpRootParam(w){return (w&&w.rootId)?('&root='+encodeURIComponent(w.rootId)):'';}
  var HP_PRES = ['Normal','Erweitert','Abgesenkt'];
  var HP_DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  var HP_DAYL = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  var HP_GROUPS = ['EG','OG','DG'];

  function hpH2M(s){var p=String(s).split(':');return (+p[0])*60+(+p[1]||0);}
  function hpM2H(m){m=Math.max(0,Math.min(1440,Math.round(m)));var h=Math.floor(m/60),mi=m%60;return (h<10?'0':'')+h+':'+(mi<10?'0':'')+mi;}

  // Temperatur -> Farbe (kühl grün .. warm orange, blau darunter, rot darüber) — deckt sich
  // mit der bestehenden Heizungs-Anzeige und enthält die Skin-Akzentfarbe (#00cdab).
  // Farbskala über 5 Stützstellen; im Panel je Farbe anpassbar (w.tcolors).
  var HP_TSTOPS=[14,16,19,21,23];
  var HP_TDEF=['#1f8efa','#00cdab','#ffc107','#ff9632','#ee423d'];
  var _hpStops=HP_TSTOPS.map(function(t,i){return {t:t,c:HP_TDEF[i]};});
  function hpMix(a,b,t){t=Math.max(0,Math.min(1,t));function h(x){return [parseInt(x.substr(1,2),16),parseInt(x.substr(3,2),16),parseInt(x.substr(5,2),16)];}
    var A=h(a),B=h(b),r=Math.round(A[0]+(B[0]-A[0])*t),g=Math.round(A[1]+(B[1]-A[1])*t),bl=Math.round(A[2]+(B[2]-A[2])*t);
    return '#'+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);}
  function hpColors(w){var c=(w&&w.tcolors&&w.tcolors.length===5)?w.tcolors:HP_TDEF;return HP_TSTOPS.map(function(t,i){return {t:t,c:(/^#[0-9a-fA-F]{6}$/.test(c[i])?c[i]:HP_TDEF[i])};});}
  function hpTempColor(t){var s=_hpStops;if(t<=s[0].t)return s[0].c;
    for(var i=1;i<s.length;i++){if(t<=s[i].t)return hpMix(s[i-1].c,s[i].c,(t-s[i-1].t)/(s[i].t-s[i-1].t));}
    return s[s.length-1].c;}
  function hpBucket(t){return t<=15?'kalt':t<=17?'Absenkung':t<=19?'normal':t<=21?'Komfort':'heiß';}

  function hpSt(w){return _hpState[w.id]||(_hpState[w.id]={loaded:false,roomIdx:0,presence:0,day:0,slot:1,prof:null,active:-1,type:'',name:'',dirty:false,err:''});}

  // ---- konfigurierte Räume (aus w.rooms) bzw. Fallback: alle ----
  function hpCfgRooms(w){
    var cfg=(w.rooms&&w.rooms.length)?w.rooms:null;
    var all=cfg ? cfg.filter(function(r){return r&&r.idx!=null;})
                : (_hpRooms||[]).map(function(r){return {idx:r.idx,group:r.group||''};});
    if(w&&w.floor){ all=all.filter(function(r){return (r.group||'')===w.floor;}); }  // Geschoss-Filter (Seite pro Geschoss)
    return all;
  }
  function hpRoomName(idx){var r=(_hpRooms||[]).filter(function(x){return x.idx==idx;})[0];return r?r.name:('#'+idx);}
  function hpRoomType(idx){var r=(_hpRooms||[]).filter(function(x){return x.idx==idx;})[0];return r?r.type:'';}

  // ---------- Demodaten (nur Doku) ----------
  function hpDemo(){
    function day(slots){var end=[],val=[];slots.forEach(function(s){end.push(s[1]);val.push(s[0]);});return {end:end,val:val};}
    var normalWk=['MO','DI','MI','DO','FR'].map(function(){return day([[17,'06:00'],[21,'08:00'],[19,'16:30'],[21,'22:00'],[17,'24:00']]);});
    var normalWe=[day([[18,'07:30'],[21,'23:00'],[18,'24:00']]),day([[18,'07:30'],[21,'23:00'],[18,'24:00']])];
    var normal=normalWk.concat(normalWe);
    var komf=[]; for(var i=0;i<7;i++)komf.push(day([[20,'06:00'],[22,'22:30'],[20,'24:00']]));
    var abg=[];  for(var j=0;j<7;j++)abg.push(day([[16,'06:00'],[18,'21:00'],[16,'24:00']]));
    return {Normal:normal,Erweitert:komf,Abgesenkt:abg};
  }
  function hpDemoRooms(){return [
    {idx:12,name:'Büro',type:'HM-TC-IT-WM-W-EU',group:'EG'},{idx:3,name:'Gang',type:'HM-TC-IT-WM-W-EU',group:'EG'},
    {idx:14,name:'Eingang',type:'HM-CC-RT-DN',group:'EG'},{idx:16,name:'Verpackung',type:'HM-TC-IT-WM-W-EU',group:'EG'},
    {idx:1,name:'Bad',type:'HM-TC-IT-WM-W-EU',group:'OG'},{idx:5,name:'Schlafzimmer',type:'HM-TC-IT-WM-W-EU',group:'OG'},
    {idx:20,name:'Bad DG',type:'HM-TC-IT-WM-W-EU',group:'DG'},{idx:24,name:'Zimmer Julia',type:'HM-TC-IT-WM-W-EU',group:'DG'}
  ];}

  // ---------- Kennzahlen ----------
  function hpWeekAvg(days){var sum=0,dur=0;(days||[]).forEach(function(d){var st=0;(d.end||[]).forEach(function(e,i){var en=hpH2M(e),len=en-st;sum+=(+d.val[i]||0)*len;dur+=len;st=en;});});return dur?sum/dur:0;}
  function hpDayAvg(d){var sum=0,st=0;(d.end||[]).forEach(function(e,i){var en=hpH2M(e),len=en-st;sum+=(+d.val[i]||0)*len;st=en;});return sum/1440;}
  function hpFmt(n){return (Math.round(n*10)/10).toFixed(1).replace('.',',');}

  // aktuelle Woche des gewählten Präsenz-Profils
  function hpWeek(st){return (st.prof&&st.prof[HP_PRES[st.presence]])||[];}
  function hpDayObj(st){var wk=hpWeek(st);return wk[st.day]||{end:['24:00'],val:[17]};}

  // ============================ RENDER ============================
  function hpRender(w){
    var st=hpSt(w);
    _hpStops=hpColors(w);                                   // Temperatur-Farbskala (evtl. angepasst)
    var acc=w.accent?_skinColor(w.accent):'';               // Akzent-Override (setzt --accent lokal)
    var accStyle=acc?(' style="--accent:'+acc+'"'):'';
    if(!st.loaded){
      return '<div class="hplan hp-loading"'+accStyle+'><div class="hp-spin">Heizplan lädt …</div></div>';
    }
    if(st.err){ return '<div class="hplan hp-loading"'+accStyle+'><div class="hp-spin">'+esc(st.err)+'</div></div>'; }
    var day=hpDayObj(st), n=(day.end||[]).length;
    if(st.slot>n)st.slot=n; if(st.slot<1)st.slot=1;
    var h='<div class="hplan"'+accStyle+'>';

    // ---- Kopf: Räume + Titel ----
    h+='<div class="hp-head">';
    h+= hpRoomsBar(w,st);
    h+='<div class="hp-titlerow"><div class="hp-title">'+esc(st.name||hpRoomName(st.roomIdx))+' <span class="hp-titsub">· '+esc(HP_PRES[st.presence])+'</span></div>';
    h+='<div class="hp-sub">'+HP_DAYL[st.day]+' · '+n+' Slot'+(n!=1?'s':'')+' · Ø '+hpFmt(hpDayAvg(day))+' °C'
       +(st.dirty?' · <b class="hp-unsaved">ungespeichert</b>':'')+'</div></div>';
    h+='</div>';

    // ---- Körper ----
    h+='<div class="hp-body"><div class="hp-main">';

    // Wochentag-Wahl
    h+='<div class="hp-days">'+HP_DAYS.map(function(d,i){return '<button class="hp-day'+(i==st.day?' on':'')+'" data-hpday="'+i+'">'+d+'</button>';}).join('')+'</div>';

    // Kurve
    h+= hpCurve(w,st);

    // Slot-Pillen
    h+='<div class="hp-pills">'+hpPills(st)+'</div>';

    // Legende Kurve
    h+='<div class="hp-clegend"><span class="hp-cl-l">Sollkurve – Griffe ziehen ändert Grenze &amp; Temperatur</span>'
      +'<span class="hp-cl-r">'+hpNowText(st)+'</span></div>';

    // Wochenübersicht
    h+= hpWeekView(w,st);

    h+='</div>';   // /hp-main

    // ---- Seitenspalte ----
    h+='<div class="hp-side">';
    h+= hpSlotEditor(st,day);
    h+= hpPresenceBox(st);
    h+= hpTransferBox(w,st);
    h+='<button class="hp-save'+(st.dirty?' dirty':'')+'" data-hpsave="1"><svg class="hp-ic"><use href="#ic-check"/></svg> Profil speichern</button>';
    h+='</div>';   // /hp-side

    h+='</div></div>';  // /hp-body /hplan
    return h;
  }

  function hpRoomsBar(w,st){
    var rooms=hpCfgRooms(w);
    // Gruppen-Reihenfolge: Topologie-Geschosse (hsMode) bzw. EG/OG/DG; unbekannte hinten, '' zuletzt.
    var byG={}, order=[];
    function bucket(g){ if(!(g in byG)){byG[g]=[];order.push(g);} return byG[g]; }
    ((_hpGroupOrder&&_hpGroupOrder.length)?_hpGroupOrder:HP_GROUPS).forEach(bucket);
    rooms.forEach(function(r){ bucket(r.group||'').push(r); });
    bucket(''); // Sammelbucket fuer ungruppierte immer zuletzt
    order.sort(function(a,b){ return (a===''?1:0)-(b===''?1:0); }); // '' ans Ende
    var h='<div class="hp-rooms">';
    order.forEach(function(g){ var list=byG[g]; if(!list||!list.length)return;
      h+='<div class="hp-rgrp">'+(g?'<span class="hp-glab">'+esc(g)+'</span>':'')
        +list.map(function(r){var on=(r.idx==st.roomIdx);
          return '<button class="hp-room'+(on?' on':'')+'" data-hproom="'+r.idx+'">'+esc(hpRoomName(r.idx))+'</button>';}).join('')
        +'</div>';
    });
    h+='</div>';
    return h;
  }

  // ---- SVG-Sollkurve ----
  function hpCurve(w,st){
    var day=hpDayObj(st), end=day.end||[], val=day.val||[];
    var lo=99,hi=-99; val.forEach(function(v){lo=Math.min(lo,+v);hi=Math.max(hi,+v);});
    if(lo>hi){lo=16;hi=22;}
    lo=Math.max(5,Math.floor(lo-1)); hi=Math.min(30,Math.ceil(hi+1)); if(hi-lo<6){hi=lo+6;} if(hi>30){hi=30;lo=24;}
    var W=960,H=300;
    function X(m){return m/1440*W;}
    function Y(t){return H-(t-lo)/(hi-lo)*H;}
    var g='<div class="hp-curvewrap"><div class="hp-yax">';
    for(var t=hi;t>=lo;t-=2){ g+='<div style="top:'+(Y(t)/H*100)+'%">'+t+'°</div>'; }
    g+='</div><div class="hp-plot"><svg class="hp-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" data-hpsvg="1" data-lo="'+lo+'" data-hi="'+hi+'">';
    // Rasterlinien
    for(var tg=lo;tg<=hi;tg+=2){ g+='<line class="hp-grid" x1="0" y1="'+Y(tg)+'" x2="'+W+'" y2="'+Y(tg)+'"/>'; }
    for(var hh=0;hh<=24;hh+=3){ g+='<line class="hp-grid hp-gridv" x1="'+X(hh*60)+'" y1="0" x2="'+X(hh*60)+'" y2="'+H+'"/>'; }
    // gefüllte Fläche + Stufen
    var start=0, labels=[];
    end.forEach(function(e,i){var en=hpH2M(e),v=+val[i],y=Y(v),col=hpTempColor(v),sel=(i+1==st.slot);
      g+='<rect class="hp-band" x="'+X(start)+'" y="'+y+'" width="'+(X(en)-X(start))+'" height="'+(H-y)+'" fill="'+col+'" opacity="'+(sel?0.34:0.20)+'"/>';
      g+='<line class="hp-plat'+(sel?' sel':'')+'" x1="'+X(start)+'" y1="'+y+'" x2="'+X(en)+'" y2="'+y+'" stroke="'+col+'" data-hpplat="'+i+'"/>';
      labels.push({x:(start+en)/2/1440*100, y:y/H*100, t:hpFmt(v)+'°', sel:sel, col:col});
      start=en;
    });
    // senkrechte Riser + Grenz-Griffe (Griffe kommen als HTML-Overlay -> immer runde
    // Kreise, unverzerrt durch preserveAspectRatio="none"; die SVG-Linie bleibt nur Fuehrung)
    start=0; var knobs=[];
    end.forEach(function(e,i){var en=hpH2M(e),v=+val[i],y=Y(v);
      if(i>0){var vp=+val[i-1],yp=Y(vp);g+='<line class="hp-riser" x1="'+X(start)+'" y1="'+yp+'" x2="'+X(start)+'" y2="'+y+'"/>';}
      if(i<end.length-1){ g+='<line class="hp-bhline" x1="'+X(en)+'" y1="0" x2="'+X(en)+'" y2="'+H+'"/>';
        knobs.push({x:X(en)/W*100, y:y/H*100, i:i, sel:(i+1==st.slot)}); }
      start=en;
    });
    var nm=hpNowMin(); g+='<line class="hp-now" x1="'+X(nm)+'" y1="0" x2="'+X(nm)+'" y2="'+H+'"/>';
    g+='</svg>';
    // Temperatur-Labels als HTML-Overlay (keine SVG-Verzerrung durch preserveAspectRatio none)
    g+='<div class="hp-lbls">'+labels.map(function(l){return '<span class="hp-tval'+(l.sel?' sel':'')+'" style="left:'+l.x+'%;top:'+l.y+'%">'+l.t+'</span>';}).join('')+'</div>';
    // Grenz-Griffe als HTML-Kreise (echte Kreise, Drag-Ziel)
    g+='<div class="hp-knobs">'+knobs.map(function(k){return '<i class="hp-bh'+(k.sel?' sel':'')+'" data-hpb="'+k.i+'" style="left:'+k.x+'%;top:'+k.y+'%"></i>';}).join('')+'</div>';
    g+='</div></div>';
    // x-Achse
    g+='<div class="hp-xax">'+[0,3,6,9,12,15,18,21,24].map(function(hh){return '<span>'+hh+'</span>';}).join('')+'</div>';
    return g;
  }

  function hpPills(st){
    var day=hpDayObj(st),end=day.end||[],val=day.val||[],start=0;
    return end.map(function(e,i){var v=+val[i],col=hpTempColor(v),sel=(i+1==st.slot),s=hpM2H(start),en=e;start=hpH2M(e);
      return '<button class="hp-pill'+(sel?' on':'')+'" data-hpslot="'+(i+1)+'" style="--pc:'+col+'">'
        +'<b>'+hpFmt(v)+'°C</b><span>'+s+'–'+en+'</span></button>';}).join('');
  }

  function hpWeekView(w,st){
    var wk=hpWeek(st);
    var h='<div class="hp-weektitle">Woche · '+esc(HP_PRES[st.presence])+' <span class="hp-hint">Tag anklicken zum Bearbeiten</span></div><div class="hp-week">';
    for(var i=0;i<7;i++){ var d=wk[i]||{end:['24:00'],val:[17]},start=0;
      var segs=(d.end||[]).map(function(e,k){var v=+d.val[k],en=hpH2M(e),seg='<i style="left:'+(start/1440*100)+'%;width:'+((en-start)/1440*100)+'%;background:'+hpTempColor(v)+'"></i>';start=en;return seg;}).join('');
      h+='<div class="hp-wrow'+(i==st.day?' on':'')+'" data-hpwday="'+i+'"><span class="hp-wlab">'+HP_DAYS[i]+'</span>'
        +'<div class="hp-wbar">'+segs+'</div><span class="hp-wavg">Ø '+hpFmt(hpDayAvg(d))+'°</span></div>';
    }
    h+='</div>';
    // Farbskala-Legende
    h+='<div class="hp-scale"><span>kühl</span>';
    for(var t=15;t<=22;t++){ h+='<i style="background:'+hpTempColor(t)+'" title="'+t+'°C"></i>'; }
    h+='<span>warm</span><span class="hp-hint">Solltemperatur 15–22 °C</span></div>';
    return h;
  }

  function hpSlotEditor(st,day){
    var i=st.slot-1,end=day.end||[],val=day.val||[],n=end.length;
    var v=+val[i], start=(i==0?'00:00':end[i-1]), ende=end[i];
    var lastEnd=(i==n-1); // letzter Slot: Ende fix 24:00
    var firstStart=(i==0); // erster Slot: Start fix 00:00
    var h='<div class="hp-box hp-slotedit"><div class="hp-boxh">Slot '+st.slot+' · '+start+'–'+ende+' <span class="hp-bkt" style="color:'+hpTempColor(v)+'">'+hpBucket(v)+'</span></div>';
    // Sollwert
    h+='<div class="hp-field"><label>Sollwert</label><div class="hp-val">'+hpFmt(v)+' °C</div>'
      +'<div class="hp-steps"><button data-hptemp="-1">−1</button><button data-hptemp="-0.1">−0,1</button><button data-hptemp="0.1">+0,1</button><button data-hptemp="1">+1</button></div></div>';
    // Start
    h+='<div class="hp-field"><label>Start</label><div class="hp-val">'+start+'</div>'
      +'<div class="hp-steps'+(firstStart?' dis':'')+'"><button data-hpstart="-60"'+(firstStart?' disabled':'')+'>−1h</button><button data-hpstart="-10"'+(firstStart?' disabled':'')+'>−10m</button><button data-hpstart="10"'+(firstStart?' disabled':'')+'>+10m</button><button data-hpstart="60"'+(firstStart?' disabled':'')+'>+1h</button></div></div>';
    // Ende
    h+='<div class="hp-field"><label>Ende</label><div class="hp-val">'+ende+'</div>'
      +'<div class="hp-steps'+(lastEnd?' dis':'')+'"><button data-hpend="-60"'+(lastEnd?' disabled':'')+'>−1h</button><button data-hpend="-10"'+(lastEnd?' disabled':'')+'>−10m</button><button data-hpend="10"'+(lastEnd?' disabled':'')+'>+10m</button><button data-hpend="60"'+(lastEnd?' disabled':'')+'>+1h</button></div></div>';
    // add/del
    h+='<div class="hp-slotbtns"><button class="hp-addb" data-hpadd="1"'+(n>=24?' disabled':'')+'>+ Einfügen</button>'
      +'<button class="hp-delb" data-hpdel="1"'+(n<=1?' disabled':'')+'>− Löschen</button></div>';
    h+='</div>';
    return h;
  }

  function hpPresenceBox(st){
    var h='<div class="hp-box hp-presbox"><div class="hp-boxh">Präsenz-Profil</div>';
    h+=HP_PRES.map(function(p,i){var avg=st.prof?hpWeekAvg(st.prof[p]):0,on=(i==st.presence),act=(i==st.active);
      return '<button class="hp-pres'+(on?' on':'')+'" data-hppres="'+i+'"><span class="hp-pdot'+(on?' on':'')+'"></span>'
        +'<b>'+esc(p)+'</b><span class="hp-pavg">Ø '+hpFmt(avg)+'°</span>'+(act?'<span class="hp-pactive">aktiv</span>':'')+'</button>';}).join('');
    h+='</div>';
    return h;
  }

  function hpTransferBox(w,st){
    var h='<div class="hp-box hp-transfer"><div class="hp-boxh">Übertragen</div>';
    h+='<div class="hp-tlab">'+HP_DAYL[st.day]+' kopieren auf:</div><div class="hp-tdays">';
    for(var i=0;i<7;i++){ if(i==st.day)continue; h+='<label class="hp-tcbx"><input type="checkbox" data-hptday="'+i+'"> '+HP_DAYS[i]+'</label>'; }
    h+='</div><button class="hp-tbtn" data-hpcopy="1">Auf gewählte Tage übertragen</button>';
    // Ganze Woche aus anderem Raum/Profil übernehmen
    var rooms=hpCfgRooms(w);
    h+='<div class="hp-tlab" style="margin-top:9px">Woche übernehmen von:</div><div class="hp-tfrom">'
      +'<select class="hp-tsel" data-hpfromroom>'+rooms.map(function(r){return '<option value="'+r.idx+'"'+(r.idx==st.roomIdx?' selected':'')+'>'+esc(hpRoomName(r.idx))+'</option>';}).join('')+'</select>'
      +'<select class="hp-tsel" data-hpfrompres>'+HP_PRES.map(function(p,i){return '<option value="'+i+'"'+(i==st.presence?' selected':'')+'>'+esc(p)+'</option>';}).join('')+'</select></div>'
      +'<button class="hp-tbtn" data-hptake="1">Übernehmen</button></div>';
    return h;
  }

  // ---------- jetzt / Soll ----------
  function hpNowMin(){var d=new Date();return d.getHours()*60+d.getMinutes();}
  function hpNowDay(){return (new Date().getDay()+6)%7;}
  function hpSollAt(day,m){var end=day.end||[],val=day.val||[],start=0;for(var i=0;i<end.length;i++){var en=hpH2M(end[i]);if(m<en||i==end.length-1)return +val[i];start=en;}return +val[val.length-1]||0;}
  function hpNowText(st){var day=hpDayObj(st),nowM=hpNowMin(),soll=hpSollAt(day,nowM);
    var s='jetzt '+hpM2H(nowM)+' · Soll '+hpFmt(soll)+' °C';
    if(st.ist!=null)s+=' · <b class="hp-ist">Ist '+hpFmt(st.ist)+' °C</b>';
    if(st.hum!=null)s+=' <span class="hp-hum">· '+Math.round(st.hum)+' % rF</span>';
    return s;}

  // ============================ EDIT-OPS ============================
  function hpMarkDirty(st){st.dirty=true;}

  function hpTempStep(w,st,delta){var day=hpDayObj(st),i=st.slot-1;var v=+day.val[i]+delta;v=Math.max(5,Math.min(30,Math.round(v*10)/10));day.val[i]=v;hpMarkDirty(st);}

  function hpTimeStep(w,st,which,delta){
    var day=hpDayObj(st),end=day.end,i=st.slot-1,n=end.length;
    if(which==='end'){ if(i==n-1)return; // letzter fix
      var lo=(i==0?0:hpH2M(end[i-1]))+10, hi=hpH2M(end[i+1])-10, nv=hpH2M(end[i])+delta;
      nv=Math.max(lo,Math.min(hi,nv)); end[i]=hpM2H(nv);
    } else { // start = Ende des Vorgänger-Slots
      if(i==0)return; var j=i-1, lo=(j==0?0:hpH2M(end[j-1]))+10, hi=hpH2M(end[j+1])-10, nv=hpH2M(end[j])+delta;
      nv=Math.max(lo,Math.min(hi,nv)); end[j]=hpM2H(nv);
    }
    hpMarkDirty(st);
  }

  function hpAddSlot(w,st){var day=hpDayObj(st),n=day.end.length;if(n>=24)return;
    // neuen Slot vor 24:00 einfügen: bei 1h vor Ende, Temp 17
    var prevEnd=(n>=2?hpH2M(day.end[n-2]):0), newB=Math.min(1430,Math.max(prevEnd+10,1440-60));
    day.end.splice(n-1,0,hpM2H(newB)); day.val.splice(n-1,0,17); day.end[day.end.length-1]='24:00';
    st.slot=n; hpMarkDirty(st);
  }
  function hpDelSlot(w,st){var day=hpDayObj(st),n=day.end.length,i=st.slot-1;if(n<=1)return;
    day.end.splice(i,1); day.val.splice(i,1); day.end[day.end.length-1]='24:00';
    if(st.slot>day.end.length)st.slot=day.end.length; hpMarkDirty(st);
  }
  function hpCopyDay(w,st,targets){var wk=hpWeek(st),src=wk[st.day];if(!src)return;
    targets.forEach(function(t){wk[t]={end:src.end.slice(),val:src.val.slice()};}); hpMarkDirty(st);
  }
  // ganze Woche eines Präsenz-Profils aus einem (evtl. anderen) Raum in das aktuelle Profil übernehmen
  function hpApplyWeek(st,srcProf,srcPres){var src=srcProf&&srcProf[HP_PRES[srcPres]];if(!src)return false;
    var dst=hpWeek(st); for(var d=0;d<7;d++){var s=src[d]||{end:['24:00'],val:[17]}; dst[d]={end:s.end.slice(),val:s.val.map(Number)};}
    hpMarkDirty(st); return true;
  }
  function hpTakeOver(w,el,idx,pres,cb){
    if(typeof DOKU!=='undefined'&&DOKU){ hpApplyWeek(hpSt(w),hpDemo(),pres); cb&&cb(); return; }
    if(hpHS(w)){ hpHSManage(idx,{op:'getSchedule',args:{variant:HP_PRES[pres]}}).then(function(j){
      if(j&&j.week){ var prof={}; prof[HP_PRES[pres]]=hsWeekToProf(j.week); if(!hpApplyWeek(hpSt(w),prof,pres))toast('Quelle leer'); }
      else toast('Quelle nicht lesbar'); cb&&cb();
    }).catch(function(){toast('Übernehmen: Verbindungsfehler');cb&&cb();}); return; }
    fetch('?api=heat&op=get&room='+idx+hpRootParam(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok){ if(!hpApplyWeek(hpSt(w),j.profiles,pres))toast('Quelle leer'); } else toast('Quelle nicht lesbar');
      cb&&cb();
    }).catch(function(){toast('Übernehmen: Verbindungsfehler');cb&&cb();});
  }

  // ============================ NETZ ============================

  // ---- HomeSuite-Datenquelle (?api=mod) — Format/Design identisch zur Legacy ----
  // Bindet HeatingZone-Entitaeten (Domaene 'heating') statt der Root-Variablen der
  // Altsteuerung. Interne Datenstruktur bleibt {Normal/Erweitert/Abgesenkt:[7×{end,val}]}.
  function hpHS(w){ return !!(w&&w.hsMode); }
  function hpHSManage(idx,body){
    return fetch('?api=mod&op=manage&id='+idx+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)})
      .then(function(r){return r.json();});
  }
  function hpEmptyWeek(){ var wk=[]; for(var d=0;d<7;d++)wk.push({end:['24:00'],val:[17]}); return wk; }
  function hsWeekToProf(week){ // 7×[{end:Min,val}] -> 7×{end:[HH:MM],val:[t]}
    var out=[]; for(var d=0;d<7;d++){ var day=week[d]||[],end=[],val=[];
      day.forEach(function(s){ end.push(hpM2H(s.end)); val.push(Number(s.val)); });
      if(!end.length){ end=['24:00']; val=[17]; } out.push({end:end,val:val}); }
    return out;
  }
  function hpHSGet(w,idx,cb){
    var st=hpSt(w); st.root=0; st.hsMode=true;
    var jobs=HP_PRES.map(function(v){ return hpHSManage(idx,{op:'getSchedule',args:{variant:v}})
      .then(function(j){return (j&&j.week)?j.week:null;}).catch(function(){return null;}); });
    jobs.push(fetch('?api=mod&op=state&id='+idx,{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}));
    Promise.all(jobs).then(function(res){
      var prof={}; HP_PRES.forEach(function(v,i){ prof[v]=res[i]?hsWeekToProf(res[i]):hpEmptyWeek(); });
      var s=res[HP_PRES.length]||{};
      st.prof=prof; st.roomIdx=idx; st.name=hpRoomName(idx); st.type='';
      st.ist=(s.ActualTemp==null?null:+s.ActualTemp);
      st.sollDev=(s.Setpoint==null?null:+s.Setpoint);
      st.hum=(s.Humidity==null?null:+s.Humidity);
      st.active=(s.Presence==null?-1:+s.Presence);
      st.loaded=true; st.dirty=false; st.err=''; cb&&cb();
    }).catch(function(){st.err='Verbindungsfehler';st.loaded=true;cb&&cb();});
  }
  function hpHSSave(w,el){
    var st=hpSt(w); if(!st.loaded)return;
    var idx=st.roomIdx, variant=HP_PRES[st.presence], week=hpWeek(st), calls=[];
    for(var d=0;d<7;d++){ var day=week[d]||{end:['24:00'],val:[17]};
      var slots=day.end.map(function(e,i){return {end:hpH2M(e),val:Number(day.val[i])};});
      calls.push(hpHSManage(idx,{op:'updateProfile',args:{variant:variant,day:d,slots:slots}})); }
    var btn=$('[data-hpsave]',el); if(btn){btn.disabled=true;btn.textContent='speichert …';}
    Promise.all(calls).then(function(rs){
      var ok=rs.every(function(j){return j&&j.ok;});
      st.dirty=!ok; toast(ok?'Gespeichert':'Speichern fehlgeschlagen'); hpRepaint(w,el);
    }).catch(function(){toast('Speichern: Verbindungsfehler');hpRepaint(w,el);});
  }

  function hpLoadRooms(w,cb){
    var root=(w&&w.rootId)||0;
    if(_hpRooms&&_hpRoomsRoot===root){cb&&cb();return;}
    if(typeof DOKU!=='undefined'&&DOKU){_hpRooms=hpDemoRooms();_hpRoomsRoot=root;cb&&cb();return;}
    if(hpHS(w)){ fetch('?api=mod&op=topology',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var rooms=[], order=[], seen={};
      function grp(g){ if(g&&!seen[g]){seen[g]=1;order.push(g);} }
      (j&&j.tree||[]).forEach(function(haus){ (haus.children||[]).forEach(function(area){
        if(area.kind!=='Bereich')return; var g=area.abbr||area.name||''; grp(g);
        (area.children||[]).forEach(function(rm){ if(rm.kind!=='Raum')return;
          (rm.entities||[]).forEach(function(e){ if((e.domain||'')==='heating') rooms.push({idx:e.iid,name:e.name||('#'+e.iid),type:'',group:g}); }); });
      });
        // Raeume direkt unter dem Haus (ohne Bereich)
        (haus.children||[]).forEach(function(rm){ if(rm.kind!=='Raum')return;
          (rm.entities||[]).forEach(function(e){ if((e.domain||'')==='heating') rooms.push({idx:e.iid,name:e.name||('#'+e.iid),type:'',group:''}); }); });
      });
      (j&&j.unassigned||[]).forEach(function(e){ if((e.domain||'')==='heating') rooms.push({idx:e.iid,name:e.name||('#'+e.iid),type:'',group:''}); });
      _hpRooms=rooms; _hpGroupOrder=order; _hpRoomsRoot=root; cb&&cb();
    }).catch(function(){_hpRooms=[];_hpGroupOrder=null;_hpRoomsRoot=root;cb&&cb();}); return; }
    fetch('?api=heat&op=list'+hpRootParam(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _hpRooms=(j&&j.rooms)||[]; _hpRoomsRoot=root; cb&&cb();
    }).catch(function(){_hpRooms=[];_hpRoomsRoot=root;cb&&cb();});
  }
  function hpLoadRoom(w,el,idx,cb){
    var st=hpSt(w);
    st.root=(w.rootId||0);
    st.hsMode=hpHS(w);
    if(typeof DOKU!=='undefined'&&DOKU){ st.prof=hpDemo(); st.roomIdx=idx||12; st.name=hpRoomName(st.roomIdx); st.type=hpRoomType(st.roomIdx); st.active=1; st.ist=21.4; st.sollDev=20; st.hum=48; st.loaded=true; st.dirty=false; cb&&cb(); return; }
    if(hpHS(w)){ hpHSGet(w,idx,cb); return; }
    fetch('?api=heat&op=get&room='+idx+hpRootParam(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok){st.err='Raum nicht lesbar';st.loaded=true;cb&&cb();return;}
      st.prof=j.profiles; st.roomIdx=j.room; st.name=j.name; st.type=j.type; st.active=(j.activePresence==null?-1:j.activePresence);
      st.ist=(j.ist==null?null:+j.ist); st.sollDev=(j.sollDev==null?null:+j.sollDev); st.hum=(j.hum==null?null:+j.hum);
      st.loaded=true; st.dirty=false; st.err=''; cb&&cb();
    }).catch(function(){st.err='Verbindungsfehler';st.loaded=true;cb&&cb();});
  }

  // schlanke Ist/Soll-Aktualisierung aller sichtbaren Heizplan-Widgets (überschreibt keinen Plan)
  var _hpLiveTimer=null;
  function hpStartLiveTimer(){ if(_hpLiveTimer||(typeof DOKU!=='undefined'&&DOKU))return; _hpLiveTimer=setInterval(hpLiveTick,60000); }
  function hpLiveTick(){
    Object.keys(_hpState).forEach(function(id){ var st=_hpState[id]; if(!st.loaded||st.dragging||!st.roomIdx)return;
      var el=document.querySelector('.w[data-id="'+id+'"]'); if(!el)return;
      var url=st.hsMode ? ('?api=mod&op=state&id='+st.roomIdx)
                        : ('?api=heat&op=live&room='+st.roomIdx+(st.root?('&root='+encodeURIComponent(st.root)):''));
      fetch(url,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        if(!j)return;
        if(st.hsMode){ st.ist=(j.ActualTemp==null?null:+j.ActualTemp); st.sollDev=(j.Setpoint==null?null:+j.Setpoint); st.hum=(j.Humidity==null?null:+j.Humidity); }
        else { if(!j.ok)return; st.ist=(j.ist==null?null:+j.ist); st.sollDev=(j.sollDev==null?null:+j.sollDev); st.hum=(j.hum==null?null:+j.hum); }
        var cl=el.querySelector('.hp-cl-r'); if(cl)cl.innerHTML=hpNowText(st);
      }).catch(function(){});
    });
  }

  function hpSave(w,el){
    var st=hpSt(w); if(!st.loaded)return;
    var week=hpWeek(st).map(function(d){return {end:d.end.slice(),val:d.val.map(Number)};});
    if(typeof DOKU!=='undefined'&&DOKU){ st.dirty=false; hpRepaint(w,el); toast('Demo: gespeichert (nur Anzeige)'); return; }
    if(hpHS(w)){ hpHSSave(w,el); return; }
    var btn=$('[data-hpsave]',el); if(btn){btn.disabled=true;btn.textContent='speichert …';}
    fetch('?api=heat&op=save&room='+st.roomIdx+'&presence='+st.presence+hpRootParam(w)+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(week)})
      .then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){ st.dirty=false; toast(j.wroteDevice?'Gespeichert & ans Thermostat übertragen':'Gespeichert'); hpRepaint(w,el); }
        else { toast('Speichern fehlgeschlagen'+(j&&j.err?(': '+j.err+(j.day!=null?(' Tag '+HP_DAYS[j.day]):'')):'')); hpRepaint(w,el); }
      }).catch(function(){toast('Speichern: Verbindungsfehler');hpRepaint(w,el);});
  }

  // ============================ PAINT/BIND ============================
  function hpElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function hpRepaint(w,el){ if(!el)el=hpElOf(w); if(!el)return; var host=el.querySelector('.winner')||el; host.innerHTML=hpRender(w); hpBind(w,el); }

  function hpBind(w,el){
    var st=hpSt(w);
    function rp(){hpRepaint(w,el);}
    function guardSwitch(fn){ if(st.dirty){ if(!confirm('Ungespeicherte Änderungen verwerfen?'))return; } fn(); }

    // Räume
    $$('[data-hproom]',el).forEach(function(b){b.onclick=function(){var idx=+b.getAttribute('data-hproom');if(idx==st.roomIdx)return;
      guardSwitch(function(){ st.slot=1; hpLoadRoom(w,el,idx,rp); });};});
    // Präsenz
    $$('[data-hppres]',el).forEach(function(b){b.onclick=function(){var p=+b.getAttribute('data-hppres');if(p==st.presence)return;
      guardSwitch(function(){ st.presence=p; st.slot=1; rp(); });};});
    // Wochentage
    $$('[data-hpday]',el).forEach(function(b){b.onclick=function(){st.day=+b.getAttribute('data-hpday');st.slot=1;rp();};});
    $$('[data-hpwday]',el).forEach(function(b){b.onclick=function(){st.day=+b.getAttribute('data-hpwday');st.slot=1;rp();};});
    // Slot-Pillen
    $$('[data-hpslot]',el).forEach(function(b){b.onclick=function(){st.slot=+b.getAttribute('data-hpslot');rp();};});
    // Stepper
    $$('[data-hptemp]',el).forEach(function(b){b.onclick=function(){hpTempStep(w,st,+b.getAttribute('data-hptemp'));rp();};});
    $$('[data-hpstart]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,st,'start',+b.getAttribute('data-hpstart'));rp();};});
    $$('[data-hpend]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,st,'end',+b.getAttribute('data-hpend'));rp();};});
    // add/del
    var ab=$('[data-hpadd]',el); if(ab)ab.onclick=function(){hpAddSlot(w,st);rp();};
    var db=$('[data-hpdel]',el); if(db)db.onclick=function(){hpDelSlot(w,st);rp();};
    // Übertragen
    var cp=$('[data-hpcopy]',el); if(cp)cp.onclick=function(){var t=[];$$('[data-hptday]:checked',el).forEach(function(c){t.push(+c.getAttribute('data-hptday'));});if(!t.length){toast('Keine Zieltage gewählt');return;}hpCopyDay(w,st,t);rp();};
    var tk=$('[data-hptake]',el); if(tk)tk.onclick=function(){var rs=$('[data-hpfromroom]',el),ps=$('[data-hpfrompres]',el);if(!rs||!ps)return;var idx=+rs.value,pres=+ps.value;
      if(idx==st.roomIdx&&pres==st.presence){toast('Quelle = Ziel');return;}
      if(!confirm('Ganze Woche aus '+hpRoomName(idx)+' · '+HP_PRES[pres]+' übernehmen? Überschreibt den aktuellen Plan.'))return;
      hpTakeOver(w,el,idx,pres,rp);};
    // Speichern
    var sv=$('[data-hpsave]',el); if(sv)sv.onclick=function(){hpSave(w,el);};

    // ---- Drag: Plateau (Y) + Grenze (X) ----
    // Wichtig: Bildschirm-Geometrie des Plots EINMAL beim pointerdown einfangen. Während des
    // Ziehens rebaut hpPaintCurveOnly zwar die SVG-Node, aber der Plot bleibt an derselben
    // Bildschirmposition — mit der gemerkten Box rechnen wir unabhängig von der (dann veralteten)
    // Element-Referenz korrekt weiter. (Kein rp() im pointerdown — das würde die Node zerstören.)
    var svg=$('[data-hpsvg]',el);
    if(svg){ var lo=+svg.getAttribute('data-lo'),hi=+svg.getAttribute('data-hi');
      function startDrag(box,onMove){ st.dragging=true;
        function mv(e){onMove(e);raf();}
        function up(){st.dragging=false;document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);rp();}
        var busy=false; function raf(){if(busy)return;busy=true;requestAnimationFrame(function(){hpPaintCurveOnly(w,el);busy=false;});}
        document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up); raf();
      }
      $$('[data-hpplat]',svg).forEach(function(pl){pl.addEventListener('pointerdown',function(ev){ev.preventDefault();
        var i=+pl.getAttribute('data-hpplat'); st.slot=i+1; var day=hpDayObj(st); var box=svg.getBoundingClientRect();
        startDrag(box,function(e){var f=(e.clientY-box.top)/box.height, t=hi-f*(hi-lo);
          t=Math.max(5,Math.min(30,Math.round(t*2)/2)); day.val[i]=t; hpMarkDirty(st);});
      });});
      $$('[data-hpb]',el).forEach(function(bh){bh.addEventListener('pointerdown',function(ev){ev.preventDefault();
        var i=+bh.getAttribute('data-hpb'); var day=hpDayObj(st),end=day.end; var box=svg.getBoundingClientRect();
        startDrag(box,function(e){var f=(e.clientX-box.left)/box.width, m=Math.round(f*1440/10)*10;
          var loB=(i==0?0:hpH2M(end[i-1]))+10, hiB=hpH2M(end[i+1])-10; m=Math.max(loB,Math.min(hiB,m)); end[i]=hpM2H(m); hpMarkDirty(st);});
      });});
    }
  }

  // Nur Kurve + Pillen + Woche + Editorwerte neu zeichnen (ohne Rebind) — für flüssiges Ziehen.
  function hpPaintCurveOnly(w,el){var st=hpSt(w);
    var cw=el.querySelector('.hp-main'); if(!cw)return;
    var oldCurve=cw.querySelector('.hp-curvewrap'); if(oldCurve){var tmp=document.createElement('div');tmp.innerHTML=hpCurve(w,st);var nc=tmp.querySelector('.hp-curvewrap');if(nc)oldCurve.replaceWith(nc);}
    // aber Drag läuft über document-Listener -> Rebind der neuen Plateaus/Griffe nötig, sonst nur optisch
    // (wir binden die SVG-Handles neu, Buttons bleiben)
    var pills=cw.querySelector('.hp-pills'); if(pills)pills.innerHTML=hpPills(st);
  }

  // ============================ WIDGET ============================
  defWidget('heatplan',{
    label:'Heizplan', paletteIcon:'thermostat', size:[980,620],
    defaults:function(w){w.label='Heizplan';w.rooms=[];},
    render:function(w){return hpRender(w);},
    mount:function(w){var el=hpElOf(w); if(!el)el=hpElOf(w,$('#ovcanvas')); if(!el)return;
      var st=hpSt(w); hpStartLiveTimer();
      if(!st.loaded){ hpLoadRooms(w,function(){ var rooms=hpCfgRooms(w); var first=rooms.length?rooms[0].idx:((_hpRooms&&_hpRooms[0])?_hpRooms[0].idx:0);
        if(!st.roomIdx)st.roomIdx=first; hpLoadRoom(w,el,st.roomIdx,function(){hpRepaint(w,el);}); }); }
      else { hpBind(w,el); }
    },
    props:function(w){ return hpProps(w); },
    wire:function(w){ hpPropsWire(w); }
  });

  // ---------- Props: Datenquelle · Räume (Root-Liste) · Farben ----------
  var HP_FIRMA=['Bad Firma','Buero','Gang Firma','Hauseingang','Kueche Firma','Verpackung','WC Firma','Werkstatt'];
  function hpProps(w){
    var h='<div class="pgh">Datenquelle</div>';
    h+=row('Quelle','<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="hpHsMode"'+(w.hsMode?' checked':'')+'> HomeSuite-Module</label>');
    if(!w.hsMode){
      h+=row('Steuerung (Root-ID)','<input id="hpRoot" type="number" value="'+(w.rootId||'')+'" placeholder="53700" style="width:110px">');
      h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Wurzel-Objekt der Heizungssteuerung. Leer = Standard (#53700).</div>';
    } else {
      h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Räume = HeatingZone-Entitäten der HomeSuite (Domäne Heizung).</div>';
    }
    h+='<div class="pgh">Räume (Root-Variablen) &amp; Etage</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Zeile = darzustellender Raum + Etage EG/OG/DG (EG = Firma). Reihenfolge = Anzeige.</div>';
    if(!_hpRooms||_hpRoomsRoot!==(w.rootId||0)){ hpLoadRooms(w,function(){ if(typeof renderProps==='function')renderProps(); });
      return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Raumliste lädt …</div>'; }
    var rooms=(w.rooms||[]);
    h+='<div class="hp-cfglist">';
    rooms.forEach(function(r,i){
      h+='<div class="hp-cfgrow2">'
        +'<select class="hp-rsel" data-hprsel="'+i+'">'+(_hpRooms||[]).map(function(o){return '<option value="'+o.idx+'"'+(o.idx==r.idx?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</select>'
        +'<span class="hp-cfggrp">'+HP_GROUPS.map(function(g){return '<button type="button" class="hp-cfgg'+((r.group||'')==g?' on':'')+'" data-hprgrp="'+i+'" data-g="'+g+'">'+g+'</button>';}).join('')+'</span>'
        +'<button type="button" class="hp-rdel" data-hprdel="'+i+'" title="entfernen">×</button></div>';
    });
    if(!rooms.length)h+='<div style="color:var(--faint);font-size:12px;padding:4px 2px">Noch keine Räume – „+ Raum" oder eine Vorlage wählen.</div>';
    h+='</div>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">'
      +'<button type="button" class="hp-cfgquick" data-hpradd="1">+ Raum</button>'
      +'<button type="button" class="hp-cfgquick" data-hpquick="firma">Firma → EG</button>'
      +'<button type="button" class="hp-cfgquick" data-hpquick="all">Alle Räume</button></div>';
    // Farben
    h+='<div class="pgh">Farben</div>';
    h+=row('Akzentfarbe',skinSel(w.accent||'','id="hpAcc"'));
    var cols=hpColors(w);
    h+='<div style="font-size:11px;color:var(--muted);margin:5px 2px 3px">Temperatur-Skala (kühl → warm)</div>';
    h+='<div class="hp-tcols">'+cols.map(function(s,i){return '<label class="hp-tcol"><input type="color" data-hptc="'+i+'" value="'+s.c+'"><span>'+s.t+'°</span></label>';}).join('')+'</div>';
    h+='<div style="margin-top:6px"><button type="button" class="hp-cfgquick" data-hptcreset="1">Farben zurücksetzen</button></div>';
    return h;
  }
  function hpPropsWire(w){
    function reload(){var el=hpElOf(w); if(el){var st=hpSt(w);st.loaded=false;st.roomIdx=0;hpRepaint(w,el);WIDGETS.heatplan.mount(w);}}
    function repaintOnly(){var el=hpElOf(w); if(el)hpRepaint(w,el);}
    if($('#hpHsMode'))$('#hpHsMode').onchange=function(){w.hsMode=this.checked||undefined;w.rooms=[];_hpRooms=null;_hpRoomsRoot=null;renderProps();commit();reload();};
    if($('#hpRoot'))$('#hpRoot').onchange=function(){var v=parseInt(this.value)||0;w.rootId=v||undefined;_hpRooms=null;_hpRoomsRoot=null;renderProps();commit();reload();};
    $$('#props [data-hprsel]').forEach(function(s){s.onchange=function(){var i=+s.getAttribute('data-hprsel');if(!w.rooms||!w.rooms[i])return;w.rooms[i].idx=+s.value;renderProps();commit();reload();};});
    $$('#props [data-hprgrp]').forEach(function(b){b.onclick=function(){var i=+b.getAttribute('data-hprgrp');if(!w.rooms||!w.rooms[i])return;w.rooms[i].group=b.getAttribute('data-g');renderProps();commit();repaintOnly();};});
    $$('#props [data-hprdel]').forEach(function(b){b.onclick=function(){var i=+b.getAttribute('data-hprdel');if(!w.rooms)return;w.rooms.splice(i,1);renderProps();commit();reload();};});
    var add=$('#props [data-hpradd]');if(add)add.onclick=function(){if(!w.rooms)w.rooms=[];var used={};w.rooms.forEach(function(r){used[r.idx]=1;});var cand=(_hpRooms||[]).filter(function(o){return !used[o.idx];})[0]||(_hpRooms||[])[0];if(cand)w.rooms.push({idx:cand.idx,group:'EG'});renderProps();commit();reload();};
    var qf=$('#props [data-hpquick="firma"]');if(qf)qf.onclick=function(){w.rooms=(_hpRooms||[]).filter(function(o){return HP_FIRMA.indexOf(o.name)>=0;}).map(function(o){return {idx:o.idx,group:'EG'};});renderProps();commit();reload();};
    var qa=$('#props [data-hpquick="all"]');if(qa)qa.onclick=function(){var prev={};(w.rooms||[]).forEach(function(r){prev[r.idx]=r.group||'';});w.rooms=(_hpRooms||[]).map(function(o){return {idx:o.idx,group:prev[o.idx]||''};});renderProps();commit();reload();};
    if($('#hpAcc'))$('#hpAcc').onchange=function(){w.accent=this.value||undefined;commit();repaintOnly();};
    $$('#props [data-hptc]').forEach(function(c){c.oninput=function(){var i=+c.getAttribute('data-hptc');if(!w.tcolors)w.tcolors=HP_TDEF.slice();w.tcolors[i]=c.value;commit();repaintOnly();};});
    var tr=$('#props [data-hptcreset]');if(tr)tr.onclick=function(){w.tcolors=undefined;renderProps();commit();repaintOnly();};
  }
