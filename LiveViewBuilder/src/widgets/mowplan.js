  // ===== Widget: Mähplan-Editor (mowplan) — Husqvarna-Timer je Mäher =====
  //
  //  Bearbeitet die Mäh-ZEITFENSTER EINES Mähers (HSMW, w.mowerId): jedes Fenster =
  //  {start (Min ab Mitternacht), duration (Min), days{monday..sunday}, missionId (Bereich)}.
  //  Fenster dürfen sich ÜBERLAPPEN (mehrere Bereiche gleichzeitig) — deshalb KEIN
  //  Symcon-Wochenplan/weekedit (nicht-überlappende An/Aus-Palette), sondern eigenes Modell.
  //  Daten über ?api=mower (op=timers frei lesen, op=settimers token-geschützt → Modul-Gate,
  //  Schatten wenn nicht scharf). Bereichsfarben = Skin-Tokens (zyklisch). Ist-Zeit-Linie am Ist-Tag.

  var _mpState = {};                 // w.id -> Editor-Zustand
  var _mpMowers = null;              // Mäher-Liste (?api=mower&op=list) für Props + Name
  var MP_DAYS  = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  var MP_DAYL  = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  var MP_DKEY  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  var MP_TOK   = ['accent','info','ok','warm','crit','warn','accent-2']; // 7 Skin-Farben

  function mpM2H(min){min=Math.max(0,Math.min(1440,Math.round(min)));var h=Math.floor(min/60),mi=min%60;return (h<10?'0':'')+h+':'+(mi<10?'0':'')+mi;}
  function mpDur(min){var h=Math.floor(min/60),mi=min%60;return h>0?(h+' h'+(mi?' '+(mi<10?'0':'')+mi:' 00')):(mi+' min');}
  function mpSt(w){return _mpState[w.id]||(_mpState[w.id]={loaded:false,timers:[],areas:[],sel:0,dirty:false,err:'',name:''});}
  function mpTodayIdx(){try{return (new Date().getDay()+6)%7;}catch(e){return 0;}}
  function mpNowMin(){try{var d=new Date();return d.getHours()*60+d.getMinutes();}catch(e){return -1;}}
  function mpDaysArr(t){var a=[];for(var i=0;i<7;i++){if(t.days&&t.days[MP_DKEY[i]])a.push(i);}return a;}
  function mpDaysLabel(t){var a=mpDaysArr(t);return a.length?a.map(function(i){return MP_DAYS[i];}).join('/'):'—';}
  function mpAreaIdx(st,mid){mid=String(mid==null?'':mid);for(var i=0;i<(st.areas||[]).length;i++){if(String(st.areas[i].id)===mid)return i;}return -1;}
  function mpTok(st,mid){var i=mpAreaIdx(st,mid);return 'var(--'+MP_TOK[(i<0?0:i)%MP_TOK.length]+')';}
  function mpAreaName(st,mid){var i=mpAreaIdx(st,mid);return i>=0?st.areas[i].name:(mid!=null&&mid!==''?('#'+mid):'—');}

  // ---------- Demodaten (Doku) ----------
  function mpDemo(){
    return {name:'Automower Lefty (Demo)',
      areas:[{id:'389',name:'Groß'},{id:'22436',name:'Pool oben'},{id:'10244',name:'Pool unten'},{id:'11675',name:'Hausbereich'},{id:'11101',name:'bei Ladestationen'},{id:'5516',name:'Vorgarten'},{id:'25914',name:'Seite'}],
      timers:[
        {start:540,duration:180,days:{monday:1,wednesday:1,friday:1,sunday:1},missionId:'389'},
        {start:720,duration:120,days:{monday:1,wednesday:1,friday:1,sunday:1},missionId:'22436'},
        {start:960,duration:120,days:{monday:1,wednesday:1,friday:1,sunday:1},missionId:'11675'},
        {start:1080,duration:90,days:{monday:1,wednesday:1,friday:1,sunday:1},missionId:'11101'},
        {start:540,duration:630,days:{tuesday:1,thursday:1,saturday:1},missionId:'389'},
        {start:840,duration:120,days:{tuesday:1,thursday:1,saturday:1},missionId:'10244'}
      ]};
  }

  // ============================ RENDER ============================
  function mpRender(w){
    if(!w.mowerId && !(typeof DOKU!=='undefined'&&DOKU))return '<div class="mp mp-msg"><div>Kein Mäher gewählt – im Panel zuordnen.</div></div>';
    var st=mpSt(w);
    if(!st.loaded)return '<div class="mp mp-msg"><div>Mähplan lädt …</div></div>';
    if(st.err)return '<div class="mp mp-msg"><div>'+esc(st.err)+'</div></div>';
    var t=st.timers[st.sel];
    // FLUID: füllt die Box, Elemente/Schriften aus der Containergröße (em+cqmin), keine Verzerrung.
    var h='<div class="mp"><div class="mp-in">';
    // Kopf (mäher-GEBUNDEN, kein Umschalter)
    h+='<div class="mp-hd"><div class="mp-hic"><svg viewBox="0 0 24 24"><path d="M5 21c.5-4.5 2.5-8 7-10"/><path d="M9 18c6.2 0 10.5-3.3 11-12v-2h-4c-9 0-12 4-12 9 0 1 0 3 2 5h3"/></svg></div>'
      +'<div><div class="mp-ht">'+escL(w.label||'Mähplan')+'</div><div class="mp-hs">'+esc(st.name||'')+' · '+st.timers.length+' Zeitfenster'+(st.dirty?' · <b class="mp-uns">ungespeichert</b>':'')+'</div></div></div>';
    // Legende (Bereiche = Skin-Farben)
    h+='<div class="mp-leg">'+(st.areas||[]).map(function(a){return '<span class="mp-lc"><i style="background:var(--'+MP_TOK[mpAreaIdx(st,a.id)%MP_TOK.length]+')"></i>'+esc(a.name)+'</span>';}).join('')+'</div>';
    // Split
    h+='<div class="mp-body"><div class="mp-grid">';
    h+='<div class="mp-axis"><div></div><div class="mp-ticks">';
    for(var tk=0;tk<=24;tk+=3)h+='<span style="left:'+(tk/24*100)+'%">'+tk+'</span>';
    h+='</div></div><div class="mp-week">'+mpWeek(w,st)+'</div></div>';
    h+='<div class="mp-side">'+mpEditor(st,t)+'</div>';
    h+='</div>';
    // Fuß
    h+='<div class="mp-foot">'+(st.dirty?'<span class="mp-dirty">● ungespeicherte Änderungen</span>':'')
      +'<button class="mp-save'+(st.dirty?' on':'')+'" data-mpsave="1"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 6"/></svg> Speichern</button></div>';
    h+='</div></div>';
    return h;
  }

  function mpWeek(w,st){
    var today=mpTodayIdx(), nowM=mpNowMin(), h='';
    for(var di=0;di<7;di++){
      var sess=[];
      for(var i=0;i<st.timers.length;i++){var t=st.timers[i];if(t.days&&t.days[MP_DKEY[di]])sess.push({t:t,idx:i,s:+t.start||0,d:+t.duration||0});}
      sess.sort(function(a,b){return a.s-b.s;});
      var lanes=[];
      sess.forEach(function(x){var placed=false;for(var li=0;li<lanes.length;li++){if(lanes[li]<=x.s){x.lane=li;lanes[li]=x.s+x.d;placed=true;break;}}if(!placed){x.lane=lanes.length;lanes.push(x.s+x.d);}});
      var nl=Math.max(1,lanes.length),seg='';
      for(var g=3;g<24;g+=3)seg+='<div class="mp-h" style="left:'+(g/24*100)+'%"></div>';
      if(di===today&&nowM>=0)seg+='<div class="mp-now" style="left:'+(nowM/1440*100)+'%"></div>';
      sess.forEach(function(x){
        var topP=x.lane/nl*100, hP=100/nl, wp=x.d/1440*100, sel=(x.idx===st.sel);
        seg+='<div class="mp-sess'+(sel?' on':'')+'" data-mpsel="'+x.idx+'" style="left:'+(x.s/1440*100)+'%;width:'+wp+'%;top:calc('+topP+'% + 2px);height:calc('+hP+'% - 4px);background:'+mpTok(st,x.t.missionId)+'">'
          +'<span class="mp-slbl">'+esc(mpAreaName(st,x.t.missionId))+' <small>'+mpM2H(x.s)+'</small></span></div>';
      });
      // Zeile wächst proportional zur Spurenzahl -> Woche füllt die Höhe, Balken füllen ihre Spur.
      h+='<div class="mp-wrow'+(di===today?' today':'')+'" style="flex:'+nl+'"><span class="mp-wlab">'+MP_DAYS[di]+'</span><div class="mp-track">'+seg+'</div></div>';
    }
    return h;
  }

  function mpEditor(st,t){
    if(!t)return '<div class="hp-box"><div class="hp-boxh">Zeitfenster</div><div class="hp-hint">Kein Fenster gewählt. Balken anklicken oder „+ Neues Fenster".</div><div class="hp-slotbtns"><button class="hp-addb" data-mpadd="1">+ Neues Fenster</button></div></div>';
    var start=+t.start||0,dur=+t.duration||0,mid=String(t.missionId==null?'':t.missionId);
    var h='<div class="hp-box"><div class="hp-boxh">Zeitfenster · '+esc(mpDaysLabel(t))+'</div>';
    // Bereich
    h+='<div class="hp-field"><label>Bereich</label><select class="hp-asel" data-mparea>'
      +(st.areas||[]).map(function(a){return '<option value="'+esc(a.id)+'"'+(String(a.id)===mid?' selected':'')+'>'+esc(a.name)+'</option>';}).join('')
      +((mpAreaIdx(st,mid)<0&&mid!=='')?('<option value="'+esc(mid)+'" selected>#'+esc(mid)+'</option>'):'')+'</select></div>';
    // Start
    h+='<div class="hp-field"><label>Start</label><div class="hp-val">'+mpM2H(start)+'</div>'
      +'<div class="hp-steps"><button data-mpstart="-60">−1h</button><button data-mpstart="-10">−10m</button><button data-mpstart="10">+10m</button><button data-mpstart="60">+1h</button></div></div>';
    // Dauer
    h+='<div class="hp-field"><label>Dauer</label><div class="hp-val">'+mpDur(dur)+'</div>'
      +'<div class="hp-steps"><button data-mpdur="-30">−30m</button><button data-mpdur="-10">−10m</button><button data-mpdur="10">+10m</button><button data-mpdur="30">+30m</button></div></div>';
    // Tage
    h+='<div class="hp-field"><label>Tage</label><div class="mp-daytog">'
      +MP_DAYS.map(function(dl,i){var on=!!(t.days&&t.days[MP_DKEY[i]]);return '<button class="hp-etog'+(on?' on':'')+'" data-mpday="'+i+'">'+dl+'</button>';}).join('')+'</div></div>';
    // Slot-Knöpfe
    h+='<div class="hp-slotbtns"><button class="hp-addb" data-mpadd="1">+ Neues Fenster</button><button class="hp-delb" data-mpdel="1"'+(st.timers.length<=0?' disabled':'')+'>− Löschen</button></div>';
    h+='<div class="hp-hint" style="margin-top:8px">Fenster dürfen sich überlappen. Farbe = Bereich. Speichern schreibt erst nach Scharfschalten (sonst Schatten).</div>';
    h+='</div>';
    return h;
  }

  // ============================ EDIT-OPS ============================
  function mpDirty(st){st.dirty=true;}
  function mpCur(st){return st.timers[st.sel];}
  function mpAreaChange(st,id){var t=mpCur(st);if(!t)return;t.missionId=String(id);mpDirty(st);}
  function mpStartStep(st,delta){var t=mpCur(st);if(!t)return;var nv=Math.max(0,Math.min(1439,(+t.start||0)+delta));if(nv+(+t.duration||0)>1440)nv=1440-(+t.duration||0);t.start=Math.max(0,nv);mpDirty(st);}
  function mpDurStep(st,delta){var t=mpCur(st);if(!t)return;var nv=Math.max(10,(+t.duration||0)+delta);if((+t.start||0)+nv>1440)nv=1440-(+t.start||0);t.duration=Math.max(10,nv);mpDirty(st);}
  function mpToggleDay(st,i){var t=mpCur(st);if(!t)return;t.days=t.days||{};t.days[MP_DKEY[i]]=!t.days[MP_DKEY[i]];mpDirty(st);}
  function mpAdd(st){var mid=(st.areas[0]||{}).id;var d={};d[MP_DKEY[mpTodayIdx()]]=1;
    st.timers.push({start:720,duration:120,days:d,missionId:mid!=null?String(mid):''});st.sel=st.timers.length-1;mpDirty(st);}
  function mpDel(st){if(!st.timers.length)return;st.timers.splice(st.sel,1);if(st.sel>=st.timers.length)st.sel=st.timers.length-1;if(st.sel<0)st.sel=0;mpDirty(st);}

  // ============================ NETZ ============================
  function mpLoadMowers(cb){
    if(_mpMowers){cb&&cb();return;}
    if(typeof DOKU!=='undefined'&&DOKU){_mpMowers=[{id:0,name:'Automower Lefty (Demo)'}];cb&&cb();return;}
    fetch('?api=mower&op=list',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){_mpMowers=(j&&j.mowers)||[];cb&&cb();}).catch(function(){_mpMowers=[];cb&&cb();});
  }
  function mpNameOf(w){var l=_mpMowers||[];for(var i=0;i<l.length;i++){if(String(l[i].id)===String(w.mowerId))return l[i].name;}return '';}
  function mpLoad(w,cb){var st=mpSt(w);
    if(typeof DOKU!=='undefined'&&DOKU){var d=mpDemo();st.name=d.name;st.areas=d.areas;st.timers=d.timers;st.sel=st.timers.length-1;st.loaded=true;st.dirty=false;st.err='';cb&&cb();return;}
    if(!w.mowerId){st.loaded=true;st.err='';cb&&cb();return;}
    fetch('?api=mower&op=timers&id='+w.mowerId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok){st.err='Mähplan nicht lesbar';st.loaded=true;cb&&cb();return;}
      st.timers=(j.timers||[]).map(mpNorm);st.areas=j.workAreas||[];st.sel=Math.min(st.sel,Math.max(0,st.timers.length-1));st.name=mpNameOf(w);st.loaded=true;st.dirty=false;st.err='';cb&&cb();
    }).catch(function(){st.err='Verbindungsfehler';st.loaded=true;cb&&cb();});
  }
  function mpNorm(t){var d=t.days||{};var days={};for(var i=0;i<7;i++)days[MP_DKEY[i]]=!!d[MP_DKEY[i]];
    return {start:+t.start||0,duration:+t.duration||0,days:days,missionId:t.missionId!=null?String(t.missionId):null};}
  function mpSave(w,el){var st=mpSt(w);
    var payload=st.timers.map(function(t){return {start:+t.start||0,duration:+t.duration||0,days:t.days,missionId:t.missionId};});
    if(typeof DOKU!=='undefined'&&DOKU){st.dirty=false;mpRepaint(w,el);toast&&toast('Demo: gespeichert (nur Anzeige)');return;}
    var btn=$('[data-mpsave]',el);if(btn){btn.disabled=true;}
    fetch('?api=mower&op=settimers&id='+w.mowerId+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({timers:payload})})
      .then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){st.dirty=false;
          toast&&toast(j.shadow?'Schatten: gespeichert (Mäher nicht scharf)':'Mähplan gespeichert');
          if(j.timers){st.timers=j.timers.map(mpNorm);if(st.sel>=st.timers.length)st.sel=Math.max(0,st.timers.length-1);}
          mpRepaint(w,el);
        } else {toast&&toast('Speichern fehlgeschlagen'+(j&&j.err?(': '+j.err):''));mpRepaint(w,el);}
      }).catch(function(){toast&&toast('Speichern: Verbindungsfehler');mpRepaint(w,el);});
  }

  // ============================ PAINT/BIND ============================
  function mpElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function mpRepaint(w,el){if(!el)el=mpElOf(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=mpRender(w);mpBind(w,el);mpFit(el);}
  // Label nur zeigen, wenn es GANZ passt — sonst nur Farbe (Messung nach Paint).
  function mpFit(el){$$('.mp-sess',el).forEach(function(b){var s=b.querySelector('.mp-slbl');if(!s)return;s.style.display='';
    if(s.scrollWidth>b.clientWidth-8)s.style.display='none';});}
  function mpBind(w,el){var st=mpSt(w);function rp(){mpRepaint(w,el);}
    $$('[data-mpsel]',el).forEach(function(b){b.onclick=function(){st.sel=+b.getAttribute('data-mpsel');rp();};});
    var as=$('[data-mparea]',el);if(as)as.onchange=function(){mpAreaChange(st,as.value);rp();};
    $$('[data-mpstart]',el).forEach(function(b){b.onclick=function(){mpStartStep(st,+b.getAttribute('data-mpstart'));rp();};});
    $$('[data-mpdur]',el).forEach(function(b){b.onclick=function(){mpDurStep(st,+b.getAttribute('data-mpdur'));rp();};});
    $$('[data-mpday]',el).forEach(function(b){b.onclick=function(){mpToggleDay(st,+b.getAttribute('data-mpday'));rp();};});
    $$('[data-mpadd]',el).forEach(function(b){b.onclick=function(){mpAdd(st);rp();};});
    var db=$('[data-mpdel]',el);if(db)db.onclick=function(){mpDel(st);rp();};
    var sv=$('[data-mpsave]',el);if(sv)sv.onclick=function(){mpSave(w,el);};
  }

  // ============================ WIDGET ============================
  defWidget('mowplan',{
    label:'Mähplan', cat:'HomeSuite', paletteIcon:'calendar', size:[720,470],
    defaults:function(w){w.label='Mähplan';},
    render:function(w){return mpRender(w);},
    mount:function(w){var el=mpElOf(w);if(!el)el=mpElOf(w,$('#ovcanvas'));if(!el)return;var st=mpSt(w);
      if(!st.loaded){ mpLoadMowers(function(){ mpLoad(w,function(){mpRepaint(w,el);}); }); }
      else { mpBind(w,el); mpFit(el); }
    },
    props:function(w){return mpProps(w);},
    wire:function(w){mpWire(w);}
  });

  function mpProps(w){
    var h='<div class="pgh">Mähplan</div>';
    if(!_mpMowers){ mpLoadMowers(function(){if(typeof renderProps==='function')renderProps();}); return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Mäher laden …</div>'; }
    h+=row('Mäher (HomeSuite)','<select id="mpMower"><option value="">— wählen —</option>'+(_mpMowers||[]).map(function(o){return '<option value="'+o.id+'"'+(String(w.mowerId)===String(o.id)?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</select>');
    h+=row('Bezeichnung','<input id="mpLabel" value="'+esc(w.label||'')+'" placeholder="z. B. Mähplan Lefty">');
    h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Fest einem Mäher zugeordnet (kein Umschalter). Zeitfenster mit Start+Dauer je Bereich, Überlappung erlaubt. Das Widget ist fluid: Zeilen/Balken füllen die Kachelhöhe, Schriften skalieren mit der Größe. Schreiben nur wenn der Mäher scharf ist (sonst Schatten).</div>';
    return h;
  }
  function mpWire(w){
    if($('#mpMower'))$('#mpMower').onchange=function(){w.mowerId=parseInt(this.value)||undefined;commit();
      var el=mpElOf(w);if(el){var st=mpSt(w);st.loaded=false;mpRepaint(w,el);WIDGETS.mowplan.mount(w);}};
    if($('#mpLabel'))$('#mpLabel').oninput=function(){w.label=this.value;commit();var el=mpElOf(w);if(el)mpRepaint(w,el);};
  }
