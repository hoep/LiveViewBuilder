  // ===== Heizplan-Familie: komponierbare Teil-Widgets über einen Session-Bus =====
  //
  //  Zerlegt den Heizplan in einzeln platzierbare Widgets (Raum-Tabs, Sollkurve, Wochen-
  //  übersicht, Slot-Pillen, Editor), die sich EINE Editiersitzung teilen (w.session, Vorgabe
  //  "heat"). Wiederverwendung der PUREN Render-/Edit-Funktionen aus heatplan.js (gleiches
  //  Bundle, siehe heatplan.js). Der frühere Monolith „heatplan" wurde entfernt; heatplan.js
  //  liefert nur noch diese geteilten Helfer. Backend: ?api=heat (Legacy) bzw. ?api=mod (HomeSuite).

  var _hf = {};        // sessionId -> geteilter Zustand
  var _hfSubs = {};    // sessionId -> [widgetId,…]
  function hfKey(w){return w.session||'heat';}
  function hfSess(w){var k=hfKey(w);return _hf[k]||(_hf[k]={loaded:false,loading:false,root:0,roomIdx:0,presence:0,variant:0,variants:null,sun:null,domain:'heating',day:0,slot:1,prof:null,active:-1,ist:null,sollDev:null,hum:null,dirty:false,err:'',name:'',dragging:false});}
  function hfSub(w){var k=hfKey(w),a=_hfSubs[k]||(_hfSubs[k]=[]);if(a.indexOf(w.id)<0)a.push(w.id);}
  function hfEmit(w){(_hfSubs[hfKey(w)]||[]).forEach(function(id){var el=document.querySelector('.w[data-id="'+id+'"]');if(!el)return;var ww=(typeof widget==='function')?widget(id):null;if(!ww)return;var host=el.querySelector('.winner')||el;var def=WIDGETS[ww.type];if(def&&def.render){host.innerHTML=def.render(ww);if(def._bind)def._bind(ww,el);}});}
  function hfRootP(w){var s=hfSess(w);return s.root?('&root='+encodeURIComponent(s.root)):'';}

  function hfLoadRoom(w,idx,cb){var sess=hfSess(w);
    if(typeof DOKU!=='undefined'&&DOKU){sess.prof=hpDemo();sess.roomIdx=idx||12;sess.name=hpRoomName(sess.roomIdx);sess.active=1;sess.ist=21.4;sess.sollDev=20;sess.hum=48;sess.err='';cb&&cb();return;}
    if(hfHS(w)){hfLoadRoomHS(w,idx,cb);return;}
    fetch('?api=heat&op=get&room='+idx+hfRootP(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok){sess.err='Raum nicht lesbar';cb&&cb();return;}
      sess.prof=j.profiles;sess.roomIdx=j.room;sess.name=j.name;sess.type=j.type;sess.active=(j.activePresence==null?-1:j.activePresence);
      sess.ist=(j.ist==null?null:+j.ist);sess.sollDev=(j.sollDev==null?null:+j.sollDev);sess.hum=(j.hum==null?null:+j.hum);sess.err='';cb&&cb();
    }).catch(function(){sess.err='Verbindungsfehler';cb&&cb();});
  }
  // ---- HomeSuite-Quelle (?api=mod): HeatingZone-Entitaeten statt Legacy #53700.
  //      Reuse der hpHS*-Helfer aus heatplan (gleiches Bundle). Session-weit via sess.hsMode.
  function hfHS(w){return !!(w.hsMode||hfSess(w).hsMode);}
  function hfLoadRoomHS(w,idx,cb){var sess=hfSess(w);var dom=sess.domain||w.domain||'heating';hpSetVC(dom);
    // Zuerst Variante 0 -> Variantenliste + Sonnenzeiten der Entität lernen (generisch, kein Hardcode).
    hpHSManage(idx,{op:'getSchedule',args:{variant:0}}).then(function(j0){
      var vs=(j0&&j0.variants&&j0.variants.length)?j0.variants:['Normal','Erweitert','Abgesenkt'];
      sess.variants=vs; sess.sun=(j0&&j0.sunEvents)||null;
      var jobs=vs.map(function(v){return hpHSManage(idx,{op:'getSchedule',args:{variant:v}}).then(function(j){return (j&&j.week)?j.week:null;}).catch(function(){return null;});});
      jobs.push(fetch('?api=mod&op=state&id='+idx,{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}));
      Promise.all(jobs).then(function(res){hpSetVC(dom);var prof={};vs.forEach(function(v,i){prof[v]=res[i]?hsWeekToProf(res[i]):hpEmptyWeek();});var st=res[vs.length]||{};
        sess.prof=prof;sess.roomIdx=idx;sess.name=hpRoomName(idx);sess.type='';
        if(dom==='shading'){ sess.ist=(st.ActualPosition==null?null:+st.ActualPosition); sess.sollDev=(st.Position==null?null:+st.Position); sess.hum=null;
          sess.active=(st.Plan!=null&&st.Season!=null)?((+st.Plan)*2+(+st.Season)):-1; }
        else if(dom==='irrigation'){ sess.ist=(st.Running===true||st.Running===1||st.Running==='1')?1:0; sess.sollDev=(st.Duration==null?null:+st.Duration); sess.hum=null; sess.active=0; }
        else { sess.ist=(st.ActualTemp==null?null:+st.ActualTemp); sess.sollDev=(st.Setpoint==null?null:+st.Setpoint); sess.hum=(st.Humidity==null?null:+st.Humidity); sess.active=(st.Presence==null?-1:+st.Presence); }
        if(sess.variant>=vs.length)sess.variant=0;
        sess.err='';cb&&cb();
      }).catch(function(){sess.err='Verbindungsfehler';cb&&cb();});
    }).catch(function(){sess.err='Verbindungsfehler';cb&&cb();});
  }
  function hfSaveHS(w){var sess=hfSess(w);var idx=sess.roomIdx,variant=hpVarName(sess),week=hpWeek(sess),calls=[];
    for(var d=0;d<7;d++){var day=week[d]||{end:['24:00'],val:[_hpVC.def],anch:[null]};
      var slots=day.end.map(function(e,i){var s={end:hpH2M(e),val:Number(day.val[i])};var a=(day.anch||[])[i];if(a){s.anchor=a.anchor;s.offset=a.offset||0;}return s;});
      calls.push(hpHSManage(idx,{op:'updateProfile',args:{variant:variant,day:d,slots:slots}}));}
    Promise.all(calls).then(function(rs){var ok=rs.every(function(j){return j&&j.ok;});sess.dirty=!ok;toast(ok?'Gespeichert':'Speichern fehlgeschlagen');hfLoadRoomHS(w,idx,function(){hfEmit(w);});}).catch(function(){toast('Speichern: Verbindungsfehler');hfEmit(w);});
  }
  // Ganze Woche eines anderen Raums/Praesenz in die aktuelle Sitzung uebernehmen (Session-basiert).
  function hfTakeOver(w,idx,pres,cb){var sess=hfSess(w);
    if(typeof DOKU!=='undefined'&&DOKU){hpApplyWeek(sess,hpDemo(),pres);cb&&cb();return;}
    if(hfHS(w)){ hpHSManage(idx,{op:'getSchedule',args:{variant:HP_PRES[pres]}}).then(function(j){
      if(j&&j.week){var prof={};prof[HP_PRES[pres]]=hsWeekToProf(j.week);if(!hpApplyWeek(sess,prof,pres))toast('Quelle leer');}else toast('Quelle nicht lesbar');cb&&cb();
    }).catch(function(){toast('Übernehmen: Verbindungsfehler');cb&&cb();}); return; }
    fetch('?api=heat&op=get&room='+idx+hfRootP(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok){if(!hpApplyWeek(sess,j.profiles,pres))toast('Quelle leer');}else toast('Quelle nicht lesbar');cb&&cb();
    }).catch(function(){toast('Übernehmen: Verbindungsfehler');cb&&cb();});
  }

  function hfEnsure(w,el){var sess=hfSess(w);var def=WIDGETS[w.type];
    if(w.domain)sess.domain=w.domain;                   // heating (Default) | shading
    if(w.hsMode||w.domain==='shading'||w.domain==='irrigation')sess.hsMode=true; // shading/irrigation nur HomeSuite
    if(sess.loaded){if(def._bind)def._bind(w,el);return;}
    if(sess.loading)return; sess.loading=true; if(w.rootId)sess.root=w.rootId;
    // Im HomeSuite-Modus die Raumliste aus den Entitaeten holen (synthetisches hsMode-w).
    var hw=sess.hsMode?{hsMode:true,domain:sess.domain,rooms:w.rooms,rootId:w.rootId,id:w.id,type:w.type,floor:w.floor}:w;
    hpLoadRooms(hw,function(){ var rooms=hpCfgRooms(hw); var first=rooms.length?rooms[0].idx:((_hpRooms&&_hpRooms[0])?_hpRooms[0].idx:0);
      if(!sess.roomIdx)sess.roomIdx=first; hfLoadRoom(w,sess.roomIdx,function(){sess.loaded=true;sess.loading=false;hfEmit(w);}); });
  }
  function hfSave(w){var sess=hfSess(w);var week=hpWeek(sess).map(function(d){return {end:d.end.slice(),val:d.val.map(Number)};});
    if(typeof DOKU!=='undefined'&&DOKU){sess.dirty=false;hfEmit(w);toast('Demo: gespeichert (nur Anzeige)');return;}
    if(hfHS(w)){hfSaveHS(w);return;}
    fetch('?api=heat&op=save&room='+sess.roomIdx+'&presence='+sess.presence+hfRootP(w)+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(week)})
      .then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){sess.dirty=false;toast(j.wroteDevice?'Gespeichert & ans Thermostat übertragen':'Gespeichert');hfLoadRoom(w,sess.roomIdx,function(){hfEmit(w);});}
        else{toast('Speichern fehlgeschlagen'+(j&&j.err?(': '+j.err+(j.day!=null?(' Tag '+HP_DAYS[j.day]):'')):''));hfEmit(w);}
      }).catch(function(){toast('Speichern: Verbindungsfehler');hfEmit(w);});
  }
  function hfMsg(txt){return '<div class="hplan hp-loading"><div class="hp-spin">'+esc(txt)+'</div></div>';}
  function hfReady(w){var s=hfSess(w);_hpStops=hpColors(w);hpSetVC(s.domain||w.domain||'heating');if(s.err)return {err:s.err};if(!s.loaded)return {loading:true};return {s:s};}
  function hfSessRow(w){return row('Session-ID','<input id="hfSessInp" value="'+esc(w.session||'heat')+'" placeholder="heat">')
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Gleiche Session-ID = geteilte Bedienung mit den anderen Heizplan-Teil-Widgets.</div>';}
  function hfSessWire(w){if($('#hfSessInp'))$('#hfSessInp').onchange=function(){w.session=this.value||undefined;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el){var s=WIDGETS[w.type];var host=el.querySelector('.winner')||el;host.innerHTML=s.render(w);if(s._bind)s._bind(w,el);}hfEmit(w);};}

  // ---------- heatrooms (Controller): Raum-Tabs + Titel ----------
  defWidget('rooms',{
    label:'Räume', paletteIcon:'thermostat', size:[720,120],
    defaults:function(w){w.session='heat';w.rooms=[];},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Heizung lädt …');var s=r.s,day=hpDayObj(s),n=(day.end||[]).length;
      return '<div class="hplan hfbox">'+hpRoomsBar(w,s)
        +'<div class="hp-titlerow"><div class="hp-title">'+esc(s.name||hpRoomName(s.roomIdx))+' <span class="hp-titsub">· '+esc(hpVarName(s))+'</span></div>'
        +'<div class="hp-sub">'+HP_DAYL[s.day]+' · '+n+' Slot'+(n!=1?'s':'')+' · Ø '+hpVal(hpWeekAvg([day]))+' '+esc(_hpVC.unit)+(s.dirty?' · <b class="hp-unsaved">ungespeichert</b>':'')+'</div></div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);
      $$('[data-hproom]',el).forEach(function(b){b.onclick=function(){var idx=+b.getAttribute('data-hproom');if(idx==s.roomIdx)return;
        if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;s.slot=1;hfLoadRoom(w,idx,function(){hfEmit(w);});};});
      $$('[data-hpfloor]',el).forEach(function(b){b.onclick=function(){var g=b.getAttribute('data-hpfloor');if(g===s.floorSel)return;
        if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;s.floorSel=g;
        var first=(_hpRooms||[]).filter(function(r){return (r.group||'')===g;})[0];
        if(first){s.slot=1;hfLoadRoom(w,first.idx,function(){hfEmit(w);});}else{hfEmit(w);}};});},
    props:function(w){var h=hfSessRow(w);
      h+=row('Domäne','<select id="hfDom"><option value="heating"'+((w.domain||'heating')==='heating'?' selected':'')+'>Heizung</option><option value="shading"'+(w.domain==='shading'?' selected':'')+'>Beschattung</option><option value="irrigation"'+(w.domain==='irrigation'?' selected':'')+'>Bewässerung</option></select>');
      h+=row('Quelle','<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="hfHs"'+(w.hsMode?' checked':'')+((w.domain==='shading'||w.domain==='irrigation')?' disabled':'')+'> HomeSuite-Zonen</label>');
      if(!w.hsMode) h+=row('Steuerung (Root-ID)','<input id="hfRoot" type="number" value="'+(w.rootId||'')+'" placeholder="53700" style="width:110px">');
      h+='<div class="pgh">'+(w.hsMode?'Zonen (HeatingZone)':'Räume &amp; Etage')+'</div>';
      if(!_hpRooms){hpLoadRooms(w,function(){if(typeof renderProps==='function')renderProps();});return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">'+(w.hsMode?'Zonen laden …':'Raumliste lädt …')+'</div>';}
      if(w.hsMode){ var floors=(_hpGroupOrder&&_hpGroupOrder.length)?_hpGroupOrder:['EG','OG','DG'];
        h+=row('Geschoss (Filter)','<select id="hfFloor"'+(w.floorTabs?' disabled':'')+'><option value="">Alle Geschosse</option>'+floors.map(function(g){return '<option value="'+esc(g)+'"'+(w.floor===g?' selected':'')+'>'+esc(g)+'</option>';}).join('')+'</select>');
        h+=row('Geschoss-Tabs','<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px"><input type="checkbox" id="hfFtabs"'+(w.floorTabs?' checked':'')+'> eine Seite, Etagen als Tabs</label>'); }
      h+=listEditor(w,'rooms',w.hsMode?'Zone · Etage':'Raum · Gruppe',[{k:'idx',type:'select',options:(_hpRooms||[]).map(function(r){return [String(r.idx),r.name];})},{k:'group',type:'select',options:[['','–'],['EG','EG'],['OG','OG'],['DG','DG']]}]);
      if(w.hsMode)h+='<div style="font-size:11px;color:var(--muted);margin:4px 2px">Geschoss-Filter = nur dieses Geschoss. Leer bei Zonen = alle. Reihenfolge = Tab-Reihenfolge.</div>';
      return h;},
    wire:function(w){hfSessWire(w);
      if($('#hfDom'))$('#hfDom').onchange=function(){w.domain=this.value;if(w.domain==='shading'||w.domain==='irrigation')w.hsMode=true;w.rooms=[];_hpRooms=null;_hpRoomsRoot=null;var s=hfSess(w);s.domain=w.domain;s.hsMode=!!w.hsMode;s.loaded=false;s.loading=false;s.roomIdx=0;s.variant=0;s.variants=null;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);};
      if($('#hfHs'))$('#hfHs').onchange=function(){w.hsMode=this.checked||undefined;w.rooms=[];_hpRooms=null;_hpRoomsRoot=null;var s=hfSess(w);s.hsMode=!!w.hsMode;s.loaded=false;s.loading=false;s.roomIdx=0;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);};
      if($('#hfFloor'))$('#hfFloor').onchange=function(){w.floor=this.value||undefined;var s=hfSess(w);s.loaded=false;s.loading=false;s.roomIdx=0;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);};
      if($('#hfFtabs'))$('#hfFtabs').onchange=function(){w.floorTabs=this.checked||undefined;if(w.floorTabs)w.floor=undefined;var s=hfSess(w);s.floorSel=null;s.loaded=false;s.loading=false;s.roomIdx=0;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);};
      if($('#hfRoot'))$('#hfRoot').onchange=function(){w.rootId=parseInt(this.value)||undefined;var s=hfSess(w);s.root=w.rootId||0;s.loaded=false;s.loading=false;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);};}
  });

  // ---------- heatcurve (=Step-Kurve): ziehbare Sollkurve ----------
  function hfCurveInner(w,s){return '<div class="hp-main hfcurve">'+hpCurve(w,s)
    +'<div class="hp-clegend"><span class="hp-cl-l">Kurve – Griffe ziehen ändert Grenze &amp; Wert</span><span class="hp-cl-r">'+hpNowText(s)+'</span></div></div>';}
  defWidget('curve',{
    label:'Sollkurve', paletteIcon:'wchart', size:[560,320],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Kurve lädt …');return '<div class="hplan hfbox">'+hfCurveInner(w,r.s)+'</div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);var svg=$('[data-hpsvg]',el);if(!svg)return;var lo=+svg.getAttribute('data-lo'),hi=+svg.getAttribute('data-hi');
      function light(){var host=el.querySelector('.winner')||el;host.innerHTML='<div class="hplan hfbox">'+hfCurveInner(w,s)+'</div>';}
      function startDrag(box,onMove){s.dragging=true;function mv(e){onMove(e);raf();}function up(){s.dragging=false;document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);hfEmit(w);}var busy=false;function raf(){if(busy)return;busy=true;requestAnimationFrame(function(){light();busy=false;});}document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);raf();}
      $$('[data-hpplat]',svg).forEach(function(pl){pl.addEventListener('pointerdown',function(ev){ev.preventDefault();var i=+pl.getAttribute('data-hpplat');s.slot=i+1;var day=hpDayObj(s),box=svg.getBoundingClientRect();
        startDrag(box,function(e){var f=(e.clientY-box.top)/box.height,t=hi-f*(hi-lo);t=Math.max(_hpVC.min,Math.min(_hpVC.max,t));t=Math.round(t/_hpVC.step)*_hpVC.step;day.val[i]=t;hpMarkDirty(s);});});});
      $$('[data-hpb]',el).forEach(function(bh){bh.addEventListener('pointerdown',function(ev){ev.preventDefault();var i=+bh.getAttribute('data-hpb');var day=hpDayObj(s),end=day.end,box=svg.getBoundingClientRect();
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
    // Kompakt-Zusammensetzung (Slot+Variante+Übertragen+Speichern). Fuer neue Seiten
    // die Einzelwidgets slotedit/variantbox/transfer/save nutzen; editor bleibt noPalette
    // fuer Bestandsseiten.
    noPalette:true,
    label:'Editor (kompakt)', paletteIcon:'wtile', size:[300,780],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Editor lädt …');var s=r.s,day=hpDayObj(s);
      // Voller Editor wie der Monolith: Slot · Präsenz-Profil · Übertragen (inkl. „Woche übernehmen von") · Speichern.
      return '<div class="hplan hfbox"><div class="hp-side hfside">'+hpSlotEditor(s,day)+hpPresenceBox(s)+hpTransferBox(w,s)
        +'<button class="hp-save'+(s.dirty?' dirty':'')+'" data-hpsave="1"><svg class="hp-ic"><use href="#ic-check"/></svg> Profil speichern</button>'
        +'</div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);function em(){hfEmit(w);}
      $$('[data-hptemp]',el).forEach(function(b){b.onclick=function(){hpTempStep(w,s,+b.getAttribute('data-hptemp'));em();};});
      $$('[data-hpstart]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,s,'start',+b.getAttribute('data-hpstart'));em();};});
      $$('[data-hpend]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,s,'end',+b.getAttribute('data-hpend'));em();};});
      var ab=$('[data-hpadd]',el);if(ab)ab.onclick=function(){hpAddSlot(w,s);em();};
      var db=$('[data-hpdel]',el);if(db)db.onclick=function(){hpDelSlot(w,s);em();};
      $$('[data-hppres]',el).forEach(function(b){b.onclick=function(){var p=+b.getAttribute('data-hppres');if(p==hpVarIdx(s))return;if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;s.variant=p;s.presence=p;s.slot=1;em();};});
      // Sonnen-Anker der Slot-Grenze (nur Beschattung)
      $$('[data-hpetype]',el).forEach(function(b){b.onclick=function(){hpSetEndType(s,b.getAttribute('data-hpetype'));em();};});
      var asel=$('[data-hpanchor]',el);if(asel)asel.onchange=function(){hpSetAnchor(s,asel.value);em();};
      $$('[data-hpoff]',el).forEach(function(b){b.onclick=function(){hpOffStep(s,+b.getAttribute('data-hpoff'));em();};});
      var cp=$('[data-hpcopy]',el);if(cp)cp.onclick=function(){var t=[];$$('[data-hptday]:checked',el).forEach(function(c){t.push(+c.getAttribute('data-hptday'));});if(!t.length){toast('Keine Zieltage gewählt');return;}hpCopyDay(w,s,t);em();};
      var tk=$('[data-hptake]',el);if(tk)tk.onclick=function(){var rm=$('[data-hpfromroom]',el),pr=$('[data-hpfrompres]',el);if(!rm||!pr)return;if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;hfTakeOver(w,+rm.value,+pr.value,em);};
      var sv=$('[data-hpsave]',el);if(sv)sv.onclick=function(){hfSave(w);};},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // ---------- Editor ZERLEGT in Einzelwidgets (kleine, wiederverwendbare Bausteine) ----------
  function hfElOf2(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
  function hfMount2(w){var el=hfElOf2(w);if(!el)return;hfSub(w);hfEnsure(w,el);}

  // slotedit: nur der Slot-Editor (Wert/Zeit/Sonnen-Anker/einfuegen/loeschen)
  defWidget('slotedit',{
    label:'Slot-Editor', paletteIcon:'wtile', size:[300,360],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Editor lädt …');var s=r.s;return '<div class="hplan hfbox"><div class="hp-side hfside">'+hpSlotEditor(s,hpDayObj(s))+'</div></div>';},
    mount:hfMount2,
    _bind:function(w,el){var s=hfSess(w);function em(){hfEmit(w);}
      $$('[data-hptemp]',el).forEach(function(b){b.onclick=function(){hpTempStep(w,s,+b.getAttribute('data-hptemp'));em();};});
      $$('[data-hpstart]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,s,'start',+b.getAttribute('data-hpstart'));em();};});
      $$('[data-hpend]',el).forEach(function(b){b.onclick=function(){hpTimeStep(w,s,'end',+b.getAttribute('data-hpend'));em();};});
      var ab=$('[data-hpadd]',el);if(ab)ab.onclick=function(){hpAddSlot(w,s);em();};
      var db=$('[data-hpdel]',el);if(db)db.onclick=function(){hpDelSlot(w,s);em();};
      $$('[data-hpetype]',el).forEach(function(b){b.onclick=function(){hpSetEndType(s,b.getAttribute('data-hpetype'));em();};});
      var an=$('[data-hpanchor]',el);if(an)an.onchange=function(){hpSetAnchor(s,an.value);em();};
      $$('[data-hpoff]',el).forEach(function(b){b.onclick=function(){hpOffStep(s,+b.getAttribute('data-hpoff'));em();};});},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // variantbox: die Varianten-/Praesenz-Auswahl (Plan/Praesenz)
  defWidget('variantbox',{
    label:'Varianten', paletteIcon:'wlist', size:[300,180],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Varianten lädt …');return '<div class="hplan hfbox"><div class="hp-side hfside">'+hpPresenceBox(r.s)+'</div></div>';},
    mount:hfMount2,
    _bind:function(w,el){var s=hfSess(w);
      $$('[data-hppres]',el).forEach(function(b){b.onclick=function(){var p=+b.getAttribute('data-hppres');if(p==hpVarIdx(s))return;if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;s.variant=p;s.presence=p;s.slot=1;hfEmit(w);};});},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // transfer: Tag/Woche kopieren + Woche uebernehmen
  defWidget('transfer',{
    label:'Übertragen', paletteIcon:'wtile', size:[300,230],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('lädt …');return '<div class="hplan hfbox"><div class="hp-side hfside">'+hpTransferBox(w,r.s)+'</div></div>';},
    mount:hfMount2,
    _bind:function(w,el){var s=hfSess(w);function em(){hfEmit(w);}
      var cp=$('[data-hpcopy]',el);if(cp)cp.onclick=function(){var t=[];$$('[data-hptday]:checked',el).forEach(function(c){t.push(+c.getAttribute('data-hptday'));});if(!t.length){toast('Keine Zieltage gewählt');return;}hpCopyDay(w,s,t);em();};
      var tk=$('[data-hptake]',el);if(tk)tk.onclick=function(){var rm=$('[data-hpfromroom]',el),pr=$('[data-hpfrompres]',el);if(!rm||!pr)return;if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;hfTakeOver(w,+rm.value,+pr.value,em);};},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // save: Speichern-Knopf
  defWidget('save',{
    label:'Speichern', paletteIcon:'check', size:[300,54],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err||r.loading)return '<div class="hplan hfbox"></div>';var s=r.s;return '<div class="hplan hfbox"><button class="hp-save'+(s.dirty?' dirty':'')+'" data-hpsave="1" style="width:100%"><svg class="hp-ic"><use href="#ic-check"/></svg> Speichern</button></div>';},
    mount:hfMount2,
    _bind:function(w,el){var sv=$('[data-hpsave]',el);if(sv)sv.onclick=function(){hfSave(w);};},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });
