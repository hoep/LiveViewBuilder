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
    // Variantenname MUSS aus der geladenen Liste kommen (wie beim Speichern, hfSaveHS).
    // Vorher stand hier die fest verdrahtete Heizungs-Liste HP_PRES ('Normal'/'Erweitert'/
    // 'Abgesenkt'); die Beschattung heisst aber 'Anwesend · Sommer' usw. -> das Modul fand
    // die Variante nicht und "Woche uebernehmen von" tat schlicht nichts.
    if(hfHS(w)){ var vname=hpVars(sess)[pres]; if(vname==null)vname=pres;
      hpHSManage(idx,{op:'getSchedule',args:{variant:vname}}).then(function(j){
      if(j&&j.week){var prof={};prof[vname]=hsWeekToProf(j.week);if(!hpApplyWeek(sess,prof,pres))toast('Quelle leer');else toast('Woche übernommen');}else toast('Quelle nicht lesbar');cb&&cb();
    }).catch(function(){toast('Übernehmen: Verbindungsfehler');cb&&cb();}); return; }
    fetch('?api=heat&op=get&room='+idx+hfRootP(w),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok){if(!hpApplyWeek(sess,j.profiles,pres))toast('Quelle leer');}else toast('Quelle nicht lesbar');cb&&cb();
    }).catch(function(){toast('Übernehmen: Verbindungsfehler');cb&&cb();});
  }

  // Startraum EINER Sitzung: bevorzugt der am Selektor eingestellte Raum, sonst der
  // erste seiner Reihenfolge. hw traegt roomOrder/roomHidden des jeweiligen Widgets.
  function hfStartRoom(w,hw){
    var rooms=hpCfgRooms(hw);
    var pref=parseInt(w&&w.startRoom||0)||0;
    if(pref&&rooms.some(function(r){return r.idx==pref;}))return pref;
    return rooms.length?rooms[0].idx:((_hpRooms&&_hpRooms[0])?_hpRooms[0].idx:0);
  }
  function hfSynth(w,sess){
    return sess.hsMode?{hsMode:true,domain:sess.domain,rooms:w.rooms,roomOrder:w.roomOrder,roomHidden:w.roomHidden,
                        rootId:w.rootId,id:w.id,type:w.type,floor:w.floor}:w;
  }
  /**
   * owner=true kennzeichnet den RAUM-SELEKTOR (Widget „Raeume"). Ohne diese Unterscheidung
   * war der Startraum ein Wettrennen: hfEnsure laeuft bei JEDEM Widget der Sitzung, und wer
   * zuerst fertig lud, legte den Raum fest - meist eine Kachel, die die Reihenfolge des
   * Selektors gar nicht kennt. Ergebnis: der Selektor zeigte seinen ersten Raum, die Kacheln
   * einen anderen. Jetzt darf nur der Selektor den Startraum setzen; kam eine Kachel zuerst,
   * korrigiert er beim Nachziehen auf seinen eigenen Startraum.
   */
  function hfEnsure(w,el,owner){var sess=hfSess(w);var def=WIDGETS[w.type];
    if(w.domain)sess.domain=w.domain;                   // heating (Default) | shading
    if(w.hsMode||w.domain==='shading'||w.domain==='irrigation')sess.hsMode=true; // shading/irrigation nur HomeSuite
    if(sess.loaded){
      // Selektor kommt nach einer Kachel: Startraum nachtraeglich durchsetzen.
      if(owner&&sess.seeded!=='owner'){
        sess.seeded='owner';
        var want=hfStartRoom(w,hfSynth(w,sess));
        if(want&&want!=sess.roomIdx){hfLoadRoom(w,want,function(){hfEmit(w);});return;}
      }
      if(def._bind)def._bind(w,el);return;
    }
    if(sess.loading)return; sess.loading=true; if(w.rootId)sess.root=w.rootId;
    // Im HomeSuite-Modus die Raumliste aus den Entitaeten holen (synthetisches hsMode-w).
    var hw=hfSynth(w,sess);
    hpLoadRooms(hw,function(){
      if(!sess.roomIdx){sess.roomIdx=hfStartRoom(w,hw);sess.seeded=owner?'owner':'follower';}
      hfLoadRoom(w,sess.roomIdx,function(){sess.loaded=true;sess.loading=false;hfEmit(w);}); });
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
  function hfReady(w){var s=hfSess(w);
    // Farbskala session-weit teilen: setzt ein Widget w.tcolors, gilt sie fuer alle
    // Teil-Widgets derselben Session (konsistente Darstellung, egal welches rendert).
    if(w.tcolors&&w.tcolors.length===5)s.tcolors=w.tcolors.slice();
    _hpStops=hpColors((s.tcolors&&s.tcolors.length===5)?{tcolors:s.tcolors}:w);
    hpSetVC(s.domain||w.domain||'heating');if(s.err)return {err:s.err};if(!s.loaded)return {loading:true};return {s:s};}
  function hfSessRow(w){return row('Session-ID','<input id="hfSessInp" value="'+esc(w.session||'heat')+'" placeholder="heat">')
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Gleiche Session-ID = geteilte Bedienung mit den anderen Heizplan-Teil-Widgets.</div>';}
  function hfSessWire(w){if($('#hfSessInp'))$('#hfSessInp').onchange=function(){w.session=this.value||undefined;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el){var s=WIDGETS[w.type];var host=el.querySelector('.winner')||el;host.innerHTML=s.render(w);if(s._bind)s._bind(w,el);}hfEmit(w);};}

  // ---- anpassbare Temperatur-Farbskala (nur Heizung) ----
  function hfColorScaleRows(w){
    if((w.domain||'heating')!=='heating')return ''; // Skala gilt nur fuer Heizungs-Domaene
    var labels=['≤ 14 °C','16 °C','19 °C','21 °C','≥ 23 °C'];
    var cols=(w.tcolors&&w.tcolors.length===5)?w.tcolors:HP_TDEF;
    var h='<div class="pgh">Farbskala (Temperatur)</div>';
    for(var i=0;i<5;i++){var c=/^#[0-9a-fA-F]{6}$/.test(cols[i])?cols[i]:HP_TDEF[i];
      h+=row(labels[i],'<input type="color" class="hptc" data-hptc="'+i+'" value="'+c+'">');}
    h+=row('','<button class="wecrst" data-hptcrst="1" title="Standard-Skala">↺ Standard</button>');
    h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">5 Stützstellen (14/16/19/21/23 °C), Zwischenwerte interpoliert. Gilt für alle Heizplan-Widgets derselben Session.</div>';
    return h;
  }
  function hfColorScaleWire(w){
    $$('[data-hptc]').forEach(function(inp){inp.oninput=function(){var i=+inp.getAttribute('data-hptc');
      var cols=(w.tcolors&&w.tcolors.length===5)?w.tcolors.slice():HP_TDEF.slice();
      cols[i]=inp.value;w.tcolors=cols;commit();var s=hfSess(w);s.tcolors=cols.slice();hfEmit(w);};});
    var rb=$('[data-hptcrst]');if(rb)rb.onclick=function(){w.tcolors=undefined;commit();var s=hfSess(w);s.tcolors=null;hfEmit(w);if(typeof renderProps==='function')renderProps();};
  }
  function hfProps(w){return hfSessRow(w)+hfColorScaleRows(w);}
  function hfWire(w){hfSessWire(w);hfColorScaleWire(w);}

  // ---------- heatrooms (Controller): Raum-Tabs + Titel ----------
  defWidget('rooms',{
    label:'Räume', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'thermostat', size:[720,120],
    defaults:function(w){w.session='heat';w.rooms=[];},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Heizung lädt …');var s=r.s,day=hpDayObj(s),n=(day.end||[]).length;
      return '<div class="hplan hfbox">'+hpRoomsBar(w,s)
        +'<div class="hp-titlerow"><div class="hp-title">'+esc(s.name||hpRoomName(s.roomIdx))+' <span class="hp-titsub">· '+esc(hpVarName(s))+'</span></div>'
        +'<div class="hp-sub">'+HP_DAYL[s.day]+' · '+n+' Slot'+(n!=1?'s':'')+' · Ø '+hpVal(hpWeekAvg([day]))+' '+esc(_hpVC.unit)+(s.dirty?' · <b class="hp-unsaved">ungespeichert</b>':'')+'</div></div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el,true);}, // owner: bestimmt den Startraum
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
      // Ebenen-Auswahl (Geschosse / Raeume / beide) gehoert IMMER in den Editor. Sie stand
      // frueher nur im hsMode-Zweig; bei Domaene "Beschattung"/"Bewaesserung" ist die
      // Quelle-Umschaltung aber deaktiviert, w.hsMode blieb leer - und damit war die Zeile
      // unerreichbar. Bestehende Kacheln zeigten die Geschoss-Reiter trotzdem (floorTabs aus
      // einer aelteren Editor-Fassung), neu angelegte liessen sich nicht mehr so einstellen.
      if(!w.hsMode) h+=hsLevelRow(w);
      if(!_hpRooms){hpLoadRooms(w,function(){if(typeof renderProps==='function')renderProps();});return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">'+(w.hsMode?'Zonen laden …':'Raumliste lädt …')+'</div>';}
      // STARTRAUM: mit welchem Raum die Seite aufgeht. Ohne das entschied die Ladereihenfolge.
      (function(){var rr=hpCfgRooms(hfSynth(w,hfSess(w)));
        var o='<option value="">(erster der Reihenfolge)</option>'+rr.map(function(r){
          return '<option value="'+r.idx+'"'+((''+w.startRoom)===(''+r.idx)?' selected':'')+'>'+esc(hpRoomName(r.idx))+'</option>';}).join('');
        h+=row('Startraum','<select id="hfStart">'+o+'</select>');})();
      if(w.hsMode){ var floors=(_hpGroupOrder&&_hpGroupOrder.length)?_hpGroupOrder:['EG','OG','DG'];
        h+=hsLevelRow(w);                                  // Ebenen: Geschosse / Raeume / beide
        h+=row('Geschoss (Filter)','<select id="hfFloor"'+(hsLevels(w)!=='rooms'?' disabled':'')+'><option value="">Alle Geschosse</option>'+floors.map(function(g){return '<option value="'+esc(g)+'"'+(w.floor===g?' selected':'')+'>'+esc(g)+'</option>';}).join('')+'</select>'); }
      h+=listEditor(w,'rooms',w.hsMode?'Zone · Etage':'Raum · Gruppe',[{k:'idx',type:'select',options:(_hpRooms||[]).map(function(r){return [String(r.idx),r.name];})},{k:'group',type:'select',options:[['','–'],['EG','EG'],['OG','OG'],['DG','DG']]}]);
      if(w.hsMode)h+='<div style="font-size:11px;color:var(--muted);margin:4px 2px">Geschoss-Filter = nur dieses Geschoss. Leer bei Zonen = alle.</div>';
      // Einheitlicher Selektor: Stil + Haus/Wohnung + Reihenfolge/Ausblenden.
      var _allR=(_hpRooms||[]).filter(function(r){return !w.floor||(r.group||'')===w.floor;}).map(function(r){return {idx:r.idx,name:r.name||hpRoomName(r.idx)};});
      h+=hsHouseRow(w,_hpHouses);
      // Zwei unabhaengige Ebenen-Bloecke: je Reihenfolge/Anzeige/Beschriftung + Stil + Typografie.
      var _lv=hsLevels(w);
      if(_lv!=='rooms'){
        var _fl=(_hpGroupOrder&&_hpGroupOrder.length)?_hpGroupOrder:['EG','OG','DG'];
        var _seen={},_fItems=[];
        (_hpRooms||[]).forEach(function(r){var g=r.group||'';if(!_seen[g]){_seen[g]=1;}});
        _fl.forEach(function(g){if(_seen[g]&&!_fItems.some(function(x){return x.key===g;}))_fItems.push({key:g,name:g});});
        Object.keys(_seen).forEach(function(g){if(!_fItems.some(function(x){return x.key===g;}))_fItems.push({key:g,name:g||'Sonstige'});});
        h+=hsLevelBlock(w,'f','Geschosse · Reihenfolge, Anzeige, Text',_fItems);
        w._fItems=_fItems;
      }
      if(_lv!=='floors'){
        h+=hsLevelBlock(w,'r','Räume · Reihenfolge, Anzeige, Text',_allR.map(function(r){return {key:r.idx,name:hsStripDomain(r.name)};}));
      }
      h+=hfColorScaleRows(w);
      return h;},
    wire:function(w){hfSessWire(w);
      if($('#hfStart'))$('#hfStart').onchange=function(){w.startRoom=parseInt(this.value)||undefined;commit();
        var s=hfSess(w);var want=hfStartRoom(w,hfSynth(w,s));if(want&&want!=s.roomIdx){s.seeded='owner';hfLoadRoom(w,want,function(){hfEmit(w);});}};
      if($('#hfDom'))$('#hfDom').onchange=function(){w.domain=this.value;if(w.domain==='shading'||w.domain==='irrigation')w.hsMode=true;w.rooms=[];_hpRooms=null;_hpRoomsRoot=null;var s=hfSess(w);s.domain=w.domain;s.hsMode=!!w.hsMode;s.loaded=false;s.loading=false;s.roomIdx=0;s.variant=0;s.variants=null;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);};
      if($('#hfHs'))$('#hfHs').onchange=function(){w.hsMode=this.checked||undefined;w.rooms=[];_hpRooms=null;_hpRoomsRoot=null;var s=hfSess(w);s.hsMode=!!w.hsMode;s.loaded=false;s.loading=false;s.roomIdx=0;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);};
      if($('#hfFloor'))$('#hfFloor').onchange=function(){w.floor=this.value||undefined;var s=hfSess(w);s.loaded=false;s.loading=false;s.roomIdx=0;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);};
      var _rr=function(){var s=hfSess(w);s.floorSel=null;render();hfEmit(w);};
      hsLevelModeWire(w,_rr);
      if(hsLevels(w)!=='rooms'&&w._fItems)hsLevelWire(w,'f',w._fItems,_rr);
      if(hsLevels(w)!=='floors'){var _ar=(_hpRooms||[]).filter(function(r){return !w.floor||(r.group||'')===w.floor;}).map(function(r){return {key:r.idx,name:hsStripDomain(r.name||hpRoomName(r.idx))};});hsLevelWire(w,'r',_ar,_rr);}
      if($('#hfRoot'))$('#hfRoot').onchange=function(){w.rootId=parseInt(this.value)||undefined;var s=hfSess(w);s.root=w.rootId||0;s.loaded=false;s.loading=false;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);};
      // Haus/Wohnung-Filter (Stil/Reihenfolge/Anzeige liegen jetzt in den Ebenen-Bloecken).
      hsHouseWire(w,function(){w.rooms=[];_hpRooms=null;_hpRoomsRoot=null;var s=hfSess(w);s.loaded=false;s.loading=false;s.roomIdx=0;commit();renderProps();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)hfEnsure(w,el);hfEmit(w);});
      hfColorScaleWire(w);}
  });

  // ---------- heatcurve (=Step-Kurve): ziehbare Sollkurve ----------
  function hfCurveInner(w,s){return '<div class="hp-main hfcurve">'+hpCurve(w,s)
    +'<div class="hp-clegend"><span class="hp-cl-l">Kurve – Griffe ziehen ändert Grenze &amp; Wert</span><span class="hp-cl-r">'+hpNowText(s)+'</span></div></div>';}
  defWidget('curve',{
    label:'Sollkurve', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'wchart', size:[560,320],
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
    props:function(w){return hfProps(w);}, wire:function(w){hfWire(w);}
  });

  // ---------- heatweek: Wochenübersicht ----------
  defWidget('week',{
    label:'Woche', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'wbars', size:[420,240],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Woche lädt …');return '<div class="hplan hfbox"><div class="hp-main">'+hpWeekView(w,r.s)+'</div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);$$('[data-hpwday]',el).forEach(function(b){b.onclick=function(){s.day=+b.getAttribute('data-hpwday');s.slot=1;hfEmit(w);};});
      $$('[data-hpday]',el).forEach(function(b){b.onclick=function(){s.day=+b.getAttribute('data-hpday');s.slot=1;hfEmit(w);};});},
    props:function(w){return hfProps(w);}, wire:function(w){hfWire(w);}
  });

  // ---------- heatslots: Wochentag-Wahl + Slot-Pillen ----------
  defWidget('slots',{
    label:'Slots', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'wlist', size:[560,150],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Slots lädt …');var s=r.s;
      return '<div class="hplan hfbox"><div class="hp-days">'+HP_DAYS.map(function(d,i){return '<button class="hp-day'+(i==s.day?' on':'')+'" data-hpday="'+i+'">'+d+'</button>';}).join('')+'</div>'
        +'<div class="hp-pills">'+hpPills(s)+'</div></div>';},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;hfSub(w);hfEnsure(w,el);},
    _bind:function(w,el){var s=hfSess(w);
      $$('[data-hpday]',el).forEach(function(b){b.onclick=function(){s.day=+b.getAttribute('data-hpday');s.slot=1;hfEmit(w);};});
      $$('[data-hpslot]',el).forEach(function(b){b.onclick=function(){s.slot=+b.getAttribute('data-hpslot');hfEmit(w);};});},
    props:function(w){return hfProps(w);}, wire:function(w){hfWire(w);}
  });

  // ---------- heateditor: Präsenz + Slot-Editor + Übertragen + Speichern ----------
  defWidget('editor',{
    // Kompakt-Zusammensetzung (Slot+Variante+Übertragen+Speichern). Fuer neue Seiten
    // die Einzelwidgets slotedit/variantbox/transfer/save nutzen; editor bleibt noPalette
    // fuer Bestandsseiten.
    noPalette:true,
    label:'Editor (kompakt)', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'wtile', size:[300,780],
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
    props:function(w){return hfProps(w);}, wire:function(w){hfWire(w);}
  });

  // ---------- Editor ZERLEGT in Einzelwidgets (kleine, wiederverwendbare Bausteine) ----------
  function hfElOf2(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
  function hfMount2(w){var el=hfElOf2(w);if(!el)return;hfSub(w);hfEnsure(w,el);}

  // slotedit: nur der Slot-Editor (Wert/Zeit/Sonnen-Anker/einfuegen/loeschen)
  defWidget('slotedit',{
    label:'Slot-Editor', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'wtile', size:[300,360],
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
    props:function(w){return hfProps(w);}, wire:function(w){hfWire(w);}
  });

  // variantbox: die Varianten-/Praesenz-Auswahl (Plan/Praesenz)
  defWidget('variantbox',{
    label:'Varianten', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'wlist', size:[300,180],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err)return hfMsg(r.err);if(r.loading)return hfMsg('Varianten lädt …');return '<div class="hplan hfbox"><div class="hp-side hfside">'+hpPresenceBox(r.s)+'</div></div>';},
    mount:hfMount2,
    _bind:function(w,el){var s=hfSess(w);
      $$('[data-hppres]',el).forEach(function(b){b.onclick=function(){var p=+b.getAttribute('data-hppres');if(p==hpVarIdx(s))return;if(s.dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;s.variant=p;s.presence=p;s.slot=1;hfEmit(w);};});},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });

  // transfer: Tag/Woche kopieren + Woche uebernehmen
  defWidget('transfer',{
    label:'Übertragen', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'wtile', size:[300,230],
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
    label:'Speichern', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'check', size:[300,54],
    defaults:function(w){w.session='heat';},
    render:function(w){var r=hfReady(w);if(r.err||r.loading)return '<div class="hplan hfbox"></div>';var s=r.s;return '<div class="hplan hfbox"><button class="hp-save'+(s.dirty?' dirty':'')+'" data-hpsave="1" style="width:100%"><svg class="hp-ic"><use href="#ic-check"/></svg> Speichern</button></div>';},
    mount:hfMount2,
    _bind:function(w,el){var sv=$('[data-hpsave]',el);if(sv)sv.onclick=function(){hfSave(w);};},
    props:function(w){return hfSessRow(w);}, wire:function(w){hfSessWire(w);}
  });
