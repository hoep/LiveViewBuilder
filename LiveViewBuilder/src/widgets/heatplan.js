  // ===== Heizplan — geteilte Bausteine (Helfer für die heatx-Familie) =====
  //
  //  Früher der Heizplan-MONOLITH (Widget „heatplan"). Der Monolith wurde durch die
  //  komponierbare heatx-Familie (rooms/curve/week/slots/editor) ersetzt und hier
  //  ENTFERNT; übrig bleiben die puren Render-/Rechen-/Edit-Funktionen (hp*), die die
  //  Familie im selben Bundle weiterverwendet. KEIN defWidget mehr in dieser Datei.
  //
  //  Datenquellen: ?api=heat (Legacy #53700) bzw. ?api=mod (HomeSuite HeatingZone).
  //  Im Doku-Modus nur eingebettete Demodaten (nie Netz, nie speichern).

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

  // ===== Wert-Domaenen: macht die Familie „sowohl als auch" (Heizung/Beschattung) =====
  //  _hpVC wird vor jedem Render je Session gesetzt (hpSetVC). Default = heating ->
  //  fuer die Heizung aendert sich NICHTS. shading = Position 0..100 % + Sonnen-Anker.
  function hpPosColor(p){ p=Math.max(0,Math.min(100,p)); return hpMix('#e6eef4','#274b66',p/100); } // 0 offen(hell)..100 zu(dunkel)
  var HP_VC={
    heating:{dom:'heating',min:5,max:30,step:0.5,dec:1,unit:'°C',def:17,label:'Sollwert',anchors:true,
      color:function(v){return hpTempColor(v);}, bucket:function(v){return hpBucket(v);},
      steps:[[-1,'−1'],[-0.1,'−0,1'],[0.1,'+0,1'],[1,'+1']], scaleLo:15,scaleHi:22,scaleLbl:'Solltemperatur 15–22 °C', profTitle:'Präsenz-Profil'},
    shading:{dom:'shading',min:0,max:100,step:5,dec:0,unit:'%',def:0,label:'Position',anchors:true,
      color:function(v){return hpPosColor(v);}, bucket:function(v){return v<=10?'offen':v<=50?'halb':v<=90?'meist zu':'zu';},
      steps:[[-10,'−10'],[-5,'−5'],[5,'+5'],[10,'+10']], scaleLo:0,scaleHi:100,scaleLbl:'0 % offen … 100 % zu', profTitle:'Plan'}
  };
  var _hpVC=HP_VC.heating;
  function hpSetVC(dom){ _hpVC=HP_VC[dom]||HP_VC.heating; return _hpVC; }
  function hpVal(v){ return _hpVC.dec>0 ? (Math.round(v*10)/10).toFixed(1).replace('.',',') : String(Math.round(v)); } // wert nach VC formatieren
  function hpClampV(v){ v=Math.max(_hpVC.min,Math.min(_hpVC.max,v)); return _hpVC.step>=1?Math.round(v/_hpVC.step)*_hpVC.step:Math.round(v/_hpVC.step)*_hpVC.step; }
  // Varianten-Achse: st.variants (aus getSchedule) bzw. Praesenz-Fallback. st.variant = Index.
  function hpVars(st){ return (st&&st.variants&&st.variants.length)?st.variants:HP_PRES; }
  function hpVarIdx(st){ var i=(st&&st.variant!=null)?st.variant:((st&&st.presence)||0); var n=hpVars(st).length; return (i>=0&&i<n)?i:0; }
  function hpVarName(st){ return hpVars(st)[hpVarIdx(st)]; }
  // Sonnen-Anker (Beschattung): key -> Label. Reihenfolge = Auswahlliste.
  var HP_ANCHORS=[['sunrise','Sonnenaufgang'],['sunset','Sonnenuntergang'],
    ['dawnCivil','Bürgerl. Dämmerung Beginn'],['duskCivil','Bürgerl. Dämmerung Ende'],
    ['dawnNautical','Nautische Dämm. Beginn'],['duskNautical','Nautische Dämm. Ende'],
    ['dawnAstro','Astron. Dämm. Beginn'],['duskAstro','Astron. Dämm. Ende']];
  function hpAnchLabel(k){for(var i=0;i<HP_ANCHORS.length;i++)if(HP_ANCHORS[i][0]===k)return HP_ANCHORS[i][1];return k;}


  // ---- konfigurierte Räume (aus w.rooms) bzw. Fallback: alle ----
  function hpCfgRooms(w){
    var cfg=(w.rooms&&w.rooms.length)?w.rooms:null;
    var all=cfg ? cfg.filter(function(r){return r&&r.idx!=null;})
                : (_hpRooms||[]).map(function(r){return {idx:r.idx,group:r.group||''};});
    if(w&&w.floor){ all=all.filter(function(r){return (r.group||'')===w.floor;}); }  // Geschoss-Filter (Seite pro Geschoss)
    return all;
  }
  function hpRoomName(idx){var r=(_hpRooms||[]).filter(function(x){return x.idx==idx;})[0];return r?r.name:('#'+idx);}

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

  // aktuelle Woche der gewählten Variante (Präsenz bzw. generische Variante)
  function hpWeek(st){return (st.prof&&st.prof[hpVarName(st)])||[];}
  function hpDayObj(st){var wk=hpWeek(st);return wk[st.day]||{end:['24:00'],val:[_hpVC.def]};}
  // Anker-Liste eines Tages (parallel zu end[]/val[]): {anchor,offset}|null je Slot. Nur Beschattung.
  function hpAnch(day){return (day&&day.anch)||[];}

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
    if(lo>hi){lo=_hpVC.min;hi=_hpVC.max;}
    var tick=2;
    if(_hpVC.dom==='heating'){ lo=Math.max(5,Math.floor(lo-1)); hi=Math.min(30,Math.ceil(hi+1)); if(hi-lo<6){hi=lo+6;} if(hi>30){hi=30;lo=24;} }
    else { lo=_hpVC.min; hi=_hpVC.max; tick=Math.max(1,Math.round((hi-lo)/5)); } // Position 0..100 voll zeigen, ~5 Ticks
    var uy=(_hpVC.dom==='heating')?'°':''; // y-Achsen-Suffix
    var W=960,H=300;
    var pad=(hi-lo)*0.07; // Headroom oben, damit der Max-Wert (z.B. 100 %) nicht am Rand klebt
    function X(m){return m/1440*W;}
    function Y(t){return H-(t-lo)/((hi+pad)-lo)*H;}
    var g='<div class="hp-curvewrap"><div class="hp-yax">';
    for(var t=hi;t>=lo;t-=tick){ g+='<div style="top:'+(Y(t)/H*100)+'%">'+t+uy+'</div>'; }
    g+='</div><div class="hp-plot"><svg class="hp-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" data-hpsvg="1" data-lo="'+lo+'" data-hi="'+hi+'">';
    // Rasterlinien
    for(var tg=lo;tg<=hi;tg+=tick){ g+='<line class="hp-grid" x1="0" y1="'+Y(tg)+'" x2="'+W+'" y2="'+Y(tg)+'"/>'; }
    for(var hh=0;hh<=24;hh+=3){ g+='<line class="hp-grid hp-gridv" x1="'+X(hh*60)+'" y1="0" x2="'+X(hh*60)+'" y2="'+H+'"/>'; }
    // gefüllte Fläche + Stufen
    var start=0, labels=[];
    end.forEach(function(e,i){var en=hpH2M(e),v=+val[i],y=Y(v),col=_hpVC.color(v),sel=(i+1==st.slot);
      g+='<rect class="hp-band" x="'+X(start)+'" y="'+y+'" width="'+(X(en)-X(start))+'" height="'+(H-y)+'" fill="'+col+'" opacity="'+(sel?0.34:0.20)+'"/>';
      g+='<line class="hp-plat'+(sel?' sel':'')+'" x1="'+X(start)+'" y1="'+y+'" x2="'+X(en)+'" y2="'+y+'" stroke="'+col+'" data-hpplat="'+i+'"/>';
      labels.push({x:(start+en)/2/1440*100, y:y/H*100, t:hpVal(v)+uy, sel:sel, col:col});
      start=en;
    });
    // senkrechte Riser + Grenz-Griffe (Griffe kommen als HTML-Overlay -> immer runde
    // Kreise, unverzerrt durch preserveAspectRatio="none"; die SVG-Linie bleibt nur Fuehrung)
    start=0; var knobs=[];
    end.forEach(function(e,i){var en=hpH2M(e),v=+val[i],y=Y(v);
      if(i>0){var vp=+val[i-1],yp=Y(vp);g+='<line class="hp-riser" x1="'+X(start)+'" y1="'+yp+'" x2="'+X(start)+'" y2="'+y+'"/>';}
      if(i<end.length-1){ g+='<line class="hp-bhline" x1="'+X(en)+'" y1="0" x2="'+X(en)+'" y2="'+H+'"/>';
        knobs.push({x:X(en)/W*100, y:y/H*100, i:i, sel:(i+1==st.slot), anch:!!(hpAnch(day)[i])}); }
      start=en;
    });
    var nm=hpNowMin(); g+='<line class="hp-now" x1="'+X(nm)+'" y1="0" x2="'+X(nm)+'" y2="'+H+'"/>';
    g+='</svg>';
    // Temperatur-Labels als HTML-Overlay (keine SVG-Verzerrung durch preserveAspectRatio none)
    g+='<div class="hp-lbls">'+labels.map(function(l){return '<span class="hp-tval'+(l.sel?' sel':'')+'" style="left:'+l.x+'%;top:'+l.y+'%">'+l.t+'</span>';}).join('')+'</div>';
    // Grenz-Griffe als HTML-Kreise (echte Kreise, Drag-Ziel)
    g+='<div class="hp-knobs">'+knobs.map(function(k){return '<i class="hp-bh'+(k.sel?' sel':'')+(k.anch?' hp-bh-sun':'')+'" data-hpb="'+k.i+'" style="left:'+k.x+'%;top:'+k.y+'%"></i>';}).join('')+'</div>';
    g+='</div></div>';
    // x-Achse
    g+='<div class="hp-xax">'+[0,3,6,9,12,15,18,21,24].map(function(hh){return '<span>'+hh+'</span>';}).join('')+'</div>';
    return g;
  }

  function hpPills(st){
    var day=hpDayObj(st),end=day.end||[],val=day.val||[],anch=hpAnch(day),start=0;
    return end.map(function(e,i){var v=+val[i],col=_hpVC.color(v),sel=(i+1==st.slot),s=hpM2H(start),en=e;start=hpH2M(e);
      return '<button class="hp-pill'+(sel?' on':'')+'" data-hpslot="'+(i+1)+'" style="--pc:'+col+'">'
        +'<b>'+hpVal(v)+esc(_hpVC.unit)+'</b><span>'+(anch[i]?'☀ ':'')+s+'–'+en+'</span></button>';}).join('');
  }

  function hpWeekView(w,st){
    var wk=hpWeek(st);
    var h='<div class="hp-weektitle">Woche · '+esc(hpVarName(st))+' <span class="hp-hint">Tag anklicken zum Bearbeiten</span></div><div class="hp-week">';
    for(var i=0;i<7;i++){ var d=wk[i]||{end:['24:00'],val:[_hpVC.def]},start=0;
      var segs=(d.end||[]).map(function(e,k){var v=+d.val[k],en=hpH2M(e),seg='<i style="left:'+(start/1440*100)+'%;width:'+((en-start)/1440*100)+'%;background:'+_hpVC.color(v)+'"></i>';start=en;return seg;}).join('');
      h+='<div class="hp-wrow'+(i==st.day?' on':'')+'" data-hpwday="'+i+'"><span class="hp-wlab">'+HP_DAYS[i]+'</span>'
        +'<div class="hp-wbar">'+segs+'</div><span class="hp-wavg">Ø '+hpVal(hpDayAvg(d))+esc(_hpVC.unit)+'</span></div>';
    }
    h+='</div>';
    // Farbskala-Legende (heating: kühl..warm | shading: offen..zu)
    var loL=_hpVC.dom==='heating'?'kühl':'offen', hiL=_hpVC.dom==='heating'?'warm':'zu', N=8;
    h+='<div class="hp-scale"><span>'+loL+'</span>';
    for(var k=0;k<=N;k++){ var tv=_hpVC.scaleLo+(_hpVC.scaleHi-_hpVC.scaleLo)*k/N; h+='<i style="background:'+_hpVC.color(tv)+'" title="'+hpVal(tv)+esc(_hpVC.unit)+'"></i>'; }
    h+='<span>'+hiL+'</span><span class="hp-hint">'+esc(_hpVC.scaleLbl)+'</span></div>';
    return h;
  }

  function hpSlotEditor(st,day){
    var i=st.slot-1,end=day.end||[],val=day.val||[],anch=hpAnch(day),n=end.length;
    var v=+val[i], start=(i==0?'00:00':end[i-1]), ende=end[i], a=anch[i]||null;
    var lastEnd=(i==n-1); // letzter Slot: Ende fix 24:00
    var firstStart=(i==0); // erster Slot: Start fix 00:00
    var h='<div class="hp-box hp-slotedit"><div class="hp-boxh">Slot '+st.slot+' · '+start+'–'+ende+' <span class="hp-bkt" style="color:'+_hpVC.color(v)+'">'+esc(_hpVC.bucket(v))+'</span></div>';
    // Wert (VC-parametrisiert: Solltemperatur/Position)
    h+='<div class="hp-field"><label>'+esc(_hpVC.label)+'</label><div class="hp-val">'+hpVal(v)+' '+esc(_hpVC.unit)+'</div>'
      +'<div class="hp-steps">'+_hpVC.steps.map(function(s){return '<button data-hptemp="'+s[0]+'">'+esc(s[1])+'</button>';}).join('')+'</div></div>';
    // Start (= Ende des Vorgänger-Slots)
    h+='<div class="hp-field"><label>Start</label><div class="hp-val">'+start+'</div>'
      +'<div class="hp-steps'+(firstStart?' dis':'')+'"><button data-hpstart="-60"'+(firstStart?' disabled':'')+'>−1h</button><button data-hpstart="-10"'+(firstStart?' disabled':'')+'>−10m</button><button data-hpstart="10"'+(firstStart?' disabled':'')+'>+10m</button><button data-hpstart="60"'+(firstStart?' disabled':'')+'>+1h</button></div></div>';
    // Ende: bei Beschattung Zeit ODER Sonnen-Anker; sonst reine Uhrzeit.
    if(_hpVC.anchors && !lastEnd){
      h+='<div class="hp-field"><label>Ende</label><div class="hp-endtog"><button type="button" class="hp-etog'+(a?'':' on')+'" data-hpetype="time">Uhrzeit</button><button type="button" class="hp-etog'+(a?' on':'')+'" data-hpetype="sun">Sonne</button></div></div>';
      if(a){
        var mins=(st.sun&&st.sun[a.anchor]!=null)?(st.sun[a.anchor]+(a.offset||0)):null;
        h+='<div class="hp-field"><label>Ereignis</label><select class="hp-asel" data-hpanchor>'+HP_ANCHORS.map(function(x){return '<option value="'+x[0]+'"'+(x[0]==a.anchor?' selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></div>';
        h+='<div class="hp-field"><label>Offset</label><div class="hp-val">'+((a.offset||0)>0?'+':'')+(a.offset||0)+' min'+(mins!=null?(' ≈ '+hpM2H(mins)):'')+'</div>'
          +'<div class="hp-steps"><button data-hpoff="-30">−30</button><button data-hpoff="-10">−10</button><button data-hpoff="10">+10</button><button data-hpoff="30">+30</button></div></div>';
      } else {
        h+='<div class="hp-field"><label>Uhrzeit</label><div class="hp-val">'+ende+'</div>'
          +'<div class="hp-steps"><button data-hpend="-60">−1h</button><button data-hpend="-10">−10m</button><button data-hpend="10">+10m</button><button data-hpend="60">+1h</button></div></div>';
      }
    } else {
      h+='<div class="hp-field"><label>Ende</label><div class="hp-val">'+ende+'</div>'
        +'<div class="hp-steps'+(lastEnd?' dis':'')+'"><button data-hpend="-60"'+(lastEnd?' disabled':'')+'>−1h</button><button data-hpend="-10"'+(lastEnd?' disabled':'')+'>−10m</button><button data-hpend="10"'+(lastEnd?' disabled':'')+'>+10m</button><button data-hpend="60"'+(lastEnd?' disabled':'')+'>+1h</button></div></div>';
    }
    // add/del
    h+='<div class="hp-slotbtns"><button class="hp-addb" data-hpadd="1"'+(n>=24?' disabled':'')+'>+ Einfügen</button>'
      +'<button class="hp-delb" data-hpdel="1"'+(n<=1?' disabled':'')+'>− Löschen</button></div>';
    h+='</div>';
    return h;
  }

  function hpPresenceBox(st){
    var vars=hpVars(st), cur=hpVarIdx(st);
    var h='<div class="hp-box hp-presbox"><div class="hp-boxh">'+esc(_hpVC.profTitle)+'</div>';
    h+=vars.map(function(p,i){var avg=(st.prof&&st.prof[p])?hpWeekAvg(st.prof[p]):0,on=(i==cur),act=(i==st.active);
      return '<button class="hp-pres'+(on?' on':'')+'" data-hppres="'+i+'"><span class="hp-pdot'+(on?' on':'')+'"></span>'
        +'<b>'+esc(p)+'</b><span class="hp-pavg">Ø '+hpVal(avg)+esc(_hpVC.unit)+'</span>'+(act?'<span class="hp-pactive">aktiv</span>':'')+'</button>';}).join('');
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
      +'<select class="hp-tsel" data-hpfrompres>'+hpVars(st).map(function(p,i){return '<option value="'+i+'"'+(i==hpVarIdx(st)?' selected':'')+'>'+esc(p)+'</option>';}).join('')+'</select></div>'
      +'<button class="hp-tbtn" data-hptake="1">Übernehmen</button></div>';
    return h;
  }

  // ---------- jetzt / Soll ----------
  function hpNowMin(){var d=new Date();return d.getHours()*60+d.getMinutes();}
  function hpSollAt(day,m){var end=day.end||[],val=day.val||[],start=0;for(var i=0;i<end.length;i++){var en=hpH2M(end[i]);if(m<en||i==end.length-1)return +val[i];start=en;}return +val[val.length-1]||0;}
  function hpNowText(st){var day=hpDayObj(st),nowM=hpNowMin(),soll=hpSollAt(day,nowM);
    var s='jetzt '+hpM2H(nowM)+' · Soll '+hpVal(soll)+' '+esc(_hpVC.unit);
    if(st.ist!=null)s+=' · <b class="hp-ist">Ist '+hpVal(st.ist)+' '+esc(_hpVC.unit)+'</b>';
    if(st.hum!=null)s+=' <span class="hp-hum">· '+Math.round(st.hum)+' % rF</span>';
    return s;}

  // ============================ EDIT-OPS ============================
  function hpMarkDirty(st){st.dirty=true;}

  function hpTempStep(w,st,delta){var day=hpDayObj(st),i=st.slot-1;var v=+day.val[i]+delta;v=Math.max(_hpVC.min,Math.min(_hpVC.max,v));v=_hpVC.dec>0?Math.round(v*10)/10:Math.round(v);day.val[i]=v;hpMarkDirty(st);}

  // ---- Sonnen-Anker der Slot-Grenze (nur Beschattung) ----
  function hpEnsureAnch(day){ if(!day.anch)day.anch=day.end.map(function(){return null;}); return day.anch; }
  function hpResolveAnchEnd(st,i){var day=hpDayObj(st),a=day.anch&&day.anch[i]; if(!a)return; var m=(st.sun&&st.sun[a.anchor]!=null)?(st.sun[a.anchor]+(a.offset||0)):hpH2M(day.end[i]); day.end[i]=hpM2H(Math.max(0,Math.min(1439,m)));}
  function hpSetEndType(st,type){var day=hpDayObj(st),i=st.slot-1,n=day.end.length; if(i>=n-1)return; hpEnsureAnch(day);
    if(type==='sun'){ if(!day.anch[i]){ day.anch[i]={anchor:'sunset',offset:0}; hpResolveAnchEnd(st,i); } } else { day.anch[i]=null; } hpMarkDirty(st); }
  function hpSetAnchor(st,anchor){var day=hpDayObj(st),i=st.slot-1; if(!day.anch||!day.anch[i])return; day.anch[i].anchor=anchor; hpResolveAnchEnd(st,i); hpMarkDirty(st); }
  function hpOffStep(st,delta){var day=hpDayObj(st),i=st.slot-1; if(!day.anch||!day.anch[i])return; day.anch[i].offset=(day.anch[i].offset||0)+delta; hpResolveAnchEnd(st,i); hpMarkDirty(st); }

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
    // neuen Slot vor 24:00 einfügen: bei 1h vor Ende, Default-Wert der Domäne
    var prevEnd=(n>=2?hpH2M(day.end[n-2]):0), newB=Math.min(1430,Math.max(prevEnd+10,1440-60));
    day.end.splice(n-1,0,hpM2H(newB)); day.val.splice(n-1,0,_hpVC.def); if(day.anch)day.anch.splice(n-1,0,null); day.end[day.end.length-1]='24:00';
    st.slot=n; hpMarkDirty(st);
  }
  function hpDelSlot(w,st){var day=hpDayObj(st),n=day.end.length,i=st.slot-1;if(n<=1)return;
    day.end.splice(i,1); day.val.splice(i,1); if(day.anch)day.anch.splice(i,1); day.end[day.end.length-1]='24:00';
    if(st.slot>day.end.length)st.slot=day.end.length; hpMarkDirty(st);
  }
  function hpCopyDay(w,st,targets){var wk=hpWeek(st),src=wk[st.day];if(!src)return;
    targets.forEach(function(t){wk[t]={end:src.end.slice(),val:src.val.slice(),anch:(src.anch||[]).map(function(a){return a?{anchor:a.anchor,offset:a.offset}:null;})};}); hpMarkDirty(st);
  }
  // ganze Woche einer Variante aus einem (evtl. anderen) Raum in das aktuelle Profil übernehmen
  function hpApplyWeek(st,srcProf,srcPres){var src=srcProf&&srcProf[hpVars(st)[srcPres]];if(!src)return false;
    var dst=hpWeek(st); for(var d=0;d<7;d++){var s=src[d]||{end:['24:00'],val:[_hpVC.def],anch:[null]}; dst[d]={end:s.end.slice(),val:s.val.map(Number),anch:(s.anch||[]).slice()};}
    hpMarkDirty(st); return true;
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
  function hpEmptyWeek(){ var wk=[]; for(var d=0;d<7;d++)wk.push({end:['24:00'],val:[_hpVC.def],anch:[null]}); return wk; }
  function hsWeekToProf(week){ // 7×[{end:Min,val,anchor?,offset?}] -> 7×{end:[HH:MM],val:[],anch:[]}
    var out=[]; for(var d=0;d<7;d++){ var day=week[d]||[],end=[],val=[],anch=[];
      day.forEach(function(s){ end.push(hpM2H(s.end)); val.push(Number(s.val)); anch.push(s.anchor?{anchor:s.anchor,offset:(s.offset||0)}:null); });
      if(!end.length){ end=['24:00']; val=[_hpVC.def]; anch=[null]; } out.push({end:end,val:val,anch:anch}); }
    return out;
  }
  function hpLoadRooms(w,cb){
    var root=(w&&w.rootId)||0;
    if(_hpRooms&&_hpRoomsRoot===root){cb&&cb();return;}
    if(typeof DOKU!=='undefined'&&DOKU){_hpRooms=hpDemoRooms();_hpRoomsRoot=root;cb&&cb();return;}
    if(hpHS(w)){ var dom=(w&&w.domain)||'heating'; fetch('?api=mod&op=topology',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var rooms=[], order=[], seen={};
      function grp(g){ if(g&&!seen[g]){seen[g]=1;order.push(g);} }
      (j&&j.tree||[]).forEach(function(haus){ (haus.children||[]).forEach(function(area){
        if(area.kind!=='Bereich')return; var g=area.abbr||area.name||''; grp(g);
        (area.children||[]).forEach(function(rm){ if(rm.kind!=='Raum')return;
          (rm.entities||[]).forEach(function(e){ if((e.domain||'')===dom) rooms.push({idx:e.iid,name:e.name||('#'+e.iid),type:'',group:g}); }); });
      });
        // Raeume direkt unter dem Haus (ohne Bereich)
        (haus.children||[]).forEach(function(rm){ if(rm.kind!=='Raum')return;
          (rm.entities||[]).forEach(function(e){ if((e.domain||'')===dom) rooms.push({idx:e.iid,name:e.name||('#'+e.iid),type:'',group:''}); }); });
      });
      (j&&j.unassigned||[]).forEach(function(e){ if((e.domain||'')===dom) rooms.push({idx:e.iid,name:e.name||('#'+e.iid),type:'',group:''}); });
      _hpRooms=rooms; _hpGroupOrder=order; _hpRoomsRoot=root; cb&&cb();
    }).catch(function(){_hpRooms=[];_hpGroupOrder=null;_hpRoomsRoot=root;cb&&cb();}); return; }
    fetch('?api=heat&op=list'+hpRootParam(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _hpRooms=(j&&j.rooms)||[]; _hpRoomsRoot=root; cb&&cb();
    }).catch(function(){_hpRooms=[];_hpRoomsRoot=root;cb&&cb();});
  }