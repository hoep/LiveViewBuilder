  // ===== Heizplan-Familie: komponierbare Teil-Widgets über einen Session-Bus =====
  //
  //  Zerlegt den Heizplan in einzeln platzierbare Widgets (Raum-Tabs, Sollkurve, Wochen-
  //  übersicht, Slot-Pillen, Editor), die sich EINE Editiersitzung teilen (w.session, Vorgabe
  //  "heat"). Wiederverwendung der PUREN Render-/Edit-Funktionen aus heatplan.js (gleiches
  //  Bundle) — der Monolith „heatplan" bleibt unberührt. Backend: ?api=heat (wie Monolith).

  var _hf = {};        // sessionId -> geteilter Zustand
  var _hfSubs = {};    // sessionId -> [widgetId,…]
  function hfKey(w){return w.session||'heat';}
  function hfSess(w){var k=hfKey(w);return _hf[k]||(_hf[k]={loaded:false,loading:false,root:0,roomIdx:0,presence:0,day:0,slot:1,prof:null,active:-1,ist:null,sollDev:null,hum:null,dirty:false,err:'',name:'',dragging:false});}
  function hfSub(w){var k=hfKey(w),a=_hfSubs[k]||(_hfSubs[k]=[]);if(a.indexOf(w.id)<0)a.push(w.id);}
  function hfEmit(w){(_hfSubs[hfKey(w)]||[]).forEach(function(id){var el=document.querySelector('.w[data-id="'+id+'"]');if(!el)return;var ww=(typeof widget==='function')?widget(id):null;if(!ww)return;var host=el.querySelector('.winner')||el;var def=WIDGETS[ww.type];if(def&&def.render){host.innerHTML=def.render(ww);if(def._bind)def._bind(ww,el);}});}
  function hfRootP(w){var s=hfSess(w);return s.root?('&root='+encodeURIComponent(s.root)):'';}

  function hfLoadRoom(w,idx,cb){var sess=hfSess(w);
    if(typeof DOKU!=='undefined'&&DOKU){sess.prof=hpDemo();sess.roomIdx=idx||12;sess.name=hpRoomName(sess.roomIdx);sess.active=1;sess.ist=21.4;sess.sollDev=20;sess.hum=48;sess.err='';cb&&cb();return;}
    fetch('?api=heat&op=get&room='+idx+hfRootP(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok){sess.err='Raum nicht lesbar';cb&&cb();return;}
      sess.prof=j.profiles;sess.roomIdx=j.room;sess.name=j.name;sess.type=j.type;sess.active=(j.activePresence==null?-1:j.activePresence);
      sess.ist=(j.ist==null?null:+j.ist);sess.sollDev=(j.sollDev==null?null:+j.sollDev);sess.hum=(j.hum==null?null:+j.hum);sess.err='';cb&&cb();
    }).catch(function(){sess.err='Verbindungsfehler';cb&&cb();});
  }
  function hfEnsure(w,el){var sess=hfSess(w);var def=WIDGETS[w.type];
    if(sess.loaded){if(def._bind)def._bind(w,el);return;}
    if(sess.loading)return; sess.loading=true; if(w.rootId)sess.root=w.rootId;
    hpLoadRooms(w,function(){ var rooms=hpCfgRooms(w); var first=rooms.length?rooms[0].idx:((_hpRooms&&_hpRooms[0])?_hpRooms[0].idx:0);
      if(!sess.roomIdx)sess.roomIdx=first; hfLoadRoom(w,sess.roomIdx,function(){sess.loaded=true;sess.loading=false;hfEmit(w);}); });
  }
  function hfSave(w){var sess=hfSess(w);var week=hpWeek(sess).map(function(d){return {end:d.end.slice(),val:d.val.map(Number)};});
    if(typeof DOKU!=='undefined'&&DOKU){sess.dirty=false;hfEmit(w);toast('Demo: gespeichert (nur Anzeige)');return;}
    fetch('?api=heat&op=save&room='+sess.roomIdx+'&presence='+sess.presence+hfRootP(w)+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(week)})
      .then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){sess.dirty=false;toast(j.wroteDevice?'Gespeichert & ans Thermostat übertragen':'Gespeichert');hfLoadRoom(w,sess.roomIdx,function(){hfEmit(w);});}
        else{toast('Speichern fehlgeschlagen'+(j&&j.err?(': '+j.err+(j.day!=null?(' Tag '+HP_DAYS[j.day]):'')):''));hfEmit(w);}
      }).catch(function(){toast('Speichern: Verbindungsfehler');hfEmit(w);});
  }
  function hfMsg(txt){return '<div class="hplan hp-loading"><div class="hp-spin">'+esc(txt)+'</div></div>';}
  function hfReady(w){var s=hfSess(w);_hpStops=hpColors(w);if(s.err)return {err:s.err};if(!s.loaded)return {loading:true};return {s:s};}
  function hfSessRow(w){return row('Session-ID','<input id="hfSessInp" value="'+esc(w.session||'heat')+'" placeholder="heat">')
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Gleiche Session-ID = geteilte Bedienung mit den anderen Heizplan-Teil-Widgets.</div>';}
  function hfSessWire(w){if($('#hfSessInp'))$('#hfSessInp').onchange=function(){w.session=this.value||undefined;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el){var s=WIDGETS[w.type];var host=el.querySelector('.winner')||el;host.innerHTML=s.render(w);if(s._bind)s._bind(w,el);}hfEmit(w);};}

  // ---------- heatrooms (Controller): Raum-Tabs + Titel ----------
  defWidget('rooms',{
    label:'Räume', paletteIcon:'thermostat', size:[720,120],
    defaults:function(w){w.session='heat';w.rooms=[];},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Heizung lädt …');var s=r.s,day=hpDayObj(s),n=(day.end||[]).length;
      return '<div class="hplan hfbox">'+hpRoomsBar(w,s)
        +'<div class="hp-titlerow"><div class="hp-title">'+esc(s.name||hpRoomName(s.roomIdx))+' <span class="hp-titsub">· '+esc(HP_PRES[s.presence])+'</span></div>'
        +'<div class="hp-sub">'+HP_DAYL[s.day]+' · '+n+' Slot'+(n!=1?'s':'')+' · Ø '+hpFmt(hpWeekAvg([day]))+' °C'+(s.dirty?' · <b class="hp-unsaved">ungespeichert</b>':'')+'</div></div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);
      $$('[data-hproom]',el).forEach(function(b){b.onclick=function(){var idx=+b.getAttribute('data-hproom');if(idx==s.roomIdx)return;
        if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;s.slot=1;hfLoadRoom(w,idx,function(){hfEmit(w);});};});},
    props:function(w){var h=hfSessRow(w);h+=row('Steuerung (Root-ID)','<input id="hfRoot" type="number" value="'+(w.rootId||'')+'" placeholder="53700" style="width:110px">');
      h+='<div class="pgh">Räume &amp; Etage</div>';
      if(!_hpRooms){hpLoadRooms(w,function(){if(typeof renderProps==='function')renderProps();});return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Raumliste lädt …</div>';}
      h+=listEditor(w,'rooms','Raum · Gruppe',[{k:'idx',type:'select',options:(_hpRooms||[]).map(function(r){return [String(r.idx),r.name];})},{k:'group',type:'select',options:[['','–'],['EG','EG'],['OG','OG'],['DG','DG']]}]);
      return h;},
    wire:function(w){hfSessWire(w);if($('#hfRoot'))$('#hfRoot').onchange=function(){w.rootId=parseInt(this.value)||undefined;var s=hfSess(w);s.root=w.rootId||0;s.loaded=false;s.loading=false;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);};}
  });

  // ---------- heatcurve (=Step-Kurve): ziehbare Sollkurve ----------
  function hfCurveInner(w,s){return '<div class="hp-main hfcurve">'+hpCurve(w,s)
    +'<div class="hp-clegend"><span class="hp-cl-l">Sollkurve – Griffe ziehen ändert Grenze &amp; Temperatur</span><span class="hp-cl-r">'+hpNowText(s)+'</span></div></div>';}
  defWidget('curve',{
    label:'Sollkurve', paletteIcon:'wchart', size:[560,320],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Kurve lädt …');return '<div class="hplan hfbox">'+hfCurveInner(w,r.s)+'</div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);var svg=$('[data-hpsvg]',el);if(!svg)return;var lo=+svg.getAttribute('data-lo'),hi=+svg.getAttribute('data-hi');
      function light(){var host=el.querySelector('.winner')||el;host.innerHTML='<div class="hplan hfbox">'+hfCurveInner(w,s)+'</div>';}
      function startDrag(box,onMove){s.dragging=true;function mv(e){onMove(e);raf();}function up(){s.dragging=false;document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);hfEmit(w);}var busy=false;function raf(){if(busy)return;busy=true;requestAnimationFrame(function(){light();busy=false;});}document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);raf();}
      $$('[data-hpplat]',svg).forEach(function(pl){pl.addEventListener('pointerdown',function(ev){ev.preventDefault();var i=+pl.getAttribute('data-hpplat');s.slot=i+1;var day=hpDayObj(s),box=svg.getBoundingClientRect();
        startDrag(box,function(e){var f=(e.clientY-box.top)/box.height,t=hi-f*(hi-lo);t=Math.max(5,Math.min(30,Math.round(t*2)/2));day.val[i]=t;hpMarkDirty(s);});});});
      $$('[data-hpb]',svg).forEach(function(bh){bh.addEventListener('pointerdown',function(ev){ev.preventDefault();var i=+bh.getAttribute('data-hpb');var day=hpDayObj(s),end=day.end,box=svg.getBoundingClientRect();
        startDrag(box,function(e){var f=(e.clientX-box.left)/box.width,m=Math.round(f*1440/10)*10;var loB=(i==0?0:hpH2M(end[i-1]))+10,hiB=hpH2M(end[i+1])-10;m=Math.max(loB,Math.min(hiB,m));end[i]=hpM2H(m);hpMarkDirty(s);});});});},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // ---------- heatweek: Wochenübersicht ----------
  defWidget('week',{
    label:'Woche', paletteIcon:'wbars', size:[420,240],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Woche lädt …');return '<div class="hplan hfbox"><div class="hp-main">'+hpWeekView(w,r.s)+'</div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);$$('[data-hpwday]',el).forEach(function(b){b.onclick=function(){s.day=+b.getAttribute('data-hpwday');s.slot=1;hfEmit(w);};});
      $$('[data-hpday]',el).forEach(function(b){b.onclick=function(){s.day=+b.getAttribute('data-hpday');s.slot=1;hfEmit(w);};});},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // ---------- heatslots: Wochentag-Wahl + Slot-Pillen ----------
  defWidget('slots',{
    label:'Slots', paletteIcon:'wlist', size:[560,150],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Slots lädt …');var s=r.s;
      return '<div class="hplan hfbox"><div class="hp-days">'+HP_DAYS.map(function(d,i){return '<button class="hp-day'+(i==s.day?' on':'')+'" data-hpday="'+i+'">'+d+'</button>';}).join('')+'</div>'
        +'<div class="hp-pills">'+hpPills(s)+'</div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);
      $$('[data-hpday]',el).forEach(function(b){b.onclick=function(){s.day=+b.getAttribute('data-hpday');s.slot=1;hfEmit(w);};});
      $$('[data-hpslot]',el).forEach(function(b){b.onclick=function(){s.slot=+b.getAttribute('data-hpslot');hfEmit(w);};});},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // ---------- heateditor: Präsenz + Slot-Editor + Übertragen + Speichern ----------
  defWidget('editor',{
    label:'Editor', paletteIcon:'wtile', size:[260,470],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Editor lädt …');var s=r.s,day=hpDayObj(s);
      var h='<div class="hplan hfbox"><div class="hp-side">'+hpSlotEditor(s,day)+hpPresenceBox(s);
      // Tag übertragen (nur Kopie auf andere Tage – dekoppelt vom Monolith)
      h+='<div class="hp-box hp-transfer"><div class="hp-boxh">Übertragen</div><div class="hp-tlab">'+HP_DAYL[s.day]+' kopieren auf:</div><div class="hp-tdays">';
      for(var i=0;i<7;i++){if(i==s.day)continue;h+='<label class="hp-tcbx"><input type="checkbox" data-hftday="'+i+'"> '+HP_DAYS[i]+'</label>';}
      h+='</div><button class="hp-tbtn" data-hfcopy="1">Auf gewählte Tage übertragen</button></div>';
      h+='<button class="hp-save'+(s.dirty?' dirty':'')+'" data-hpsave="1"><svg class="hp-ic"><use href="#ic-check"/></svg> Profil speichern</button>';
      h+='</div></div>';return h;},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);function em(){hfEmit(w);}
      $$('[data-hptemp]',el).forEach(function(b){b.onclick=function(){hpTempStep(w,s,+b.getAttribute('data-hptemp'));em();};});
      $$('[data-hpstart]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,s,'start',+b.getAttribute('data-hpstart'));em();};});
      $$('[data-hpend]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,s,'end',+b.getAttribute('data-hpend'));em();};});
      var ab=$('[data-hpadd]',el);if(ab)ab.onclick=function(){hpAddSlot(w,s);em();};
      var db=$('[data-hpdel]',el);if(db)db.onclick=function(){hpDelSlot(w,s);em();};
      $$('[data-hppres]',el).forEach(function(b){b.onclick=function(){var p=+b.getAttribute('data-hppres');if(p==s.presence)return;if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;s.presence=p;s.slot=1;em();};});
      var cp=$('[data-hfcopy]',el);if(cp)cp.onclick=function(){var t=[];$$('[data-hftday]:checked',el).forEach(function(c){t.push(+c.getAttribute('data-hftday'));});if(!t.length){toast('Keine Zieltage gewählt');return;}hpCopyDay(w,s,t);em();};
      var sv=$('[data-hpsave]',el);if(sv)sv.onclick=function(){hfSave(w);};},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });
