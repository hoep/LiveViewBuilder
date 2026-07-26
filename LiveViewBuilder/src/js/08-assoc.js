  // ===== Assoziationen (Variablenprofil: Wert -> Name/Icon/Farbe) =====
  var _assocData={};   // varId -> {assocs:[{v,name,icon,color}], picon}
  var _assocPick=null; // {wid,key} während Icon-Auswahl für eine Assoziation
  var SYMICON={Battery:'battery',Light:'bulb',Lightbulb:'bulb',Bulb:'bulb',LightbulbActive:'bulb',
    Window:'window',Door:'door',Lock:'lock',Locked:'lock',Unlocked:'unlock',Motion:'motion',Move:'motion',
    Presence:'person',Temperature:'temperature',Drops:'droplet',Rain:'rain',Snow:'snow',Cloud:'cloud',
    Sun:'sun',Moon:'moon',Ventilation:'fan',Fan:'fan',Climate:'thermostat',Radiator:'radiator',Flash:'bolt',
    Plug:'plug',PowerOutlet:'socket',Speaker:'speaker',TV:'tv',Warning:'warning',Alert:'warning',
    Information:'info',Ok:'check',Shutter:'shutter',Jalousie:'blinds',Rollershutter:'shutter',Blinds:'blinds',
    GarageDoor:'garage',Garage:'garage',Camera:'camera',Bell:'bell',Clock:'clock',Calendar:'calendar',
    Car:'car',Key:'key',Power:'power',Gauge:'gauge',Water:'droplet',Sofa:'sofa',Bed:'bed',Garden:'tree',
    EnergyProduction:'solar',Sunset:'sunset',Sunrise:'sunrise',Wind:'wind',Umbrella:'umbrella',Smoke:'smoke',
    Shower:'shower',WashingMachine:'washer',Music:'music',Pause:'pause',Play:'play',Coffee:'coffee',
    Leaf:'leaf',Flame:'flame',HollowDoubleArrowUp:'arrowup',HollowDoubleArrowDown:'arrowdown'};
  function symToIcon(name){if(!name)return '';if(SYMICON[name])return SYMICON[name];var l=name.toLowerCase();return ICONS[l]||AICONS[l]?l:'';}
  function loadAssoc(varId,cb){
    if(!varId){cb&&cb(null);return;}
    if(_assocData[varId]){cb&&cb(_assocData[varId]);return;}
    fetch('?api=assoc&id='+varId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _assocData[varId]=(j&&j.assocs)?{assocs:j.assocs,picon:j.picon||''}:{assocs:[],picon:''};cb&&cb(_assocData[varId]);
    }).catch(function(){_assocData[varId]={assocs:[],picon:''};cb&&cb(_assocData[varId]);});
  }
  function assocResolved(w,a){var key=String(a.v),ov=(w.assocMap&&w.assocMap[key])||{},d=_assocData[w.varId]||{};
    return {icon:ov.icon||symToIcon(a.icon)||symToIcon(d.picon)||'',color:ov.color||a.color||''};}
  function assocFor(w,v){var d=_assocData[w.varId];if(!d||!d.assocs.length)return null;var key=String(v);
    for(var i=0;i<d.assocs.length;i++){if(String(d.assocs[i].v)===key)return d.assocs[i];}
    if(v===true||v===false){var want=v?1:0;for(var j=0;j<d.assocs.length;j++){if(Number(d.assocs[j].v)===want)return d.assocs[j];}}
    var nv=parseFloat(String(v).replace(',','.'));if(!isNaN(nv)){var best=null;d.assocs.forEach(function(a){var av=parseFloat(a.v);if(!isNaN(av)&&av<=nv&&(best===null||av>parseFloat(best.v)))best=a;});return best;}
    return null;}
  function applyAssoc(w,el,v){var a=assocFor(w,v);if(!a)return;var rr=assocResolved(w,a);
    if(rr.icon){var ie=el.querySelector('.iconwrap svg,[data-role=badge] svg,.hchipic svg,.hkbi svg,.hricon svg,.swic svg,.baric svg,.wvic svg');if(ie)ie.outerHTML=iconSVG(rr.icon,v);}
    var ce=el.querySelector('[data-role=val],.hlstate,.hkn');if(ce)ce.style.color=rr.color||'';
    var be=el.querySelector('.iconwrap,[data-role=badge],.hchipic,.hkbi,.hricon');if(be)be.style.color=rr.color||'';}
  function refreshAssocLive(w){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
  function renderAssoc(w){var box=$('#assocBox');if(!box)return;
    loadAssoc(w.varId,function(d){var cur=$('#assocBox');if(cur!==box)return;
      if(!d||!d.assocs.length){box.innerHTML='<div class="prow"><label>Assoziationen</label><span class="hint" style="font-size:11px">Profil hat keine Assoziationen</span></div>';return;}
      var head='<div class="prow"><label>Assoziationen</label><label style="font-size:12px;display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="pAssocOn"'+(w.assocOn?' checked':'')+'> Icons &amp; Farben nutzen</label></div>';
      var rows=d.assocs.map(function(a){var key=String(a.v),rr=assocResolved(w,a),col=rr.color;
        return '<div class="arow"><span class="aic" style="color:'+(col||'var(--accent)')+'">'+(rr.icon?iconSVG(rr.icon):'')+'</span>'+(col?'<span class="asw" style="background:'+esc(col)+'"></span>':'<span class="asw none"></span>')+'<span class="anm">'+esc(a.name||key)+'</span><span class="aval">'+esc(key)+'</span><button class="btn aibtn" data-akey="'+esc(key)+'" style="padding:3px 7px;font-size:11px">Icon</button></div>';}).join('');
      box.innerHTML=head+'<div class="alist'+(w.assocOn?'':' off')+'">'+rows+'</div>';
      if($('#pAssocOn'))$('#pAssocOn').onchange=function(){w.assocOn=this.checked;if(!w.assocMap)w.assocMap={};if(this.checked&&!w.icon){var pic=symToIcon((_assocData[w.varId]||{}).picon);if(pic)w.icon=pic;}render();renderProps();refreshAssocLive(w);};
      $$('.aibtn',box).forEach(function(b){b.onclick=function(){_assocPick={wid:w.id,key:b.getAttribute('data-akey')};showTab('icons');toast('Icon für Status „'+b.getAttribute('data-akey')+'" links wählen');};});
    });}
  function assignIcon(id){
    if(_assocPick){var wa=widget(_assocPick.wid);if(wa){if(!wa.assocMap)wa.assocMap={};if(!wa.assocMap[_assocPick.key])wa.assocMap[_assocPick.key]={};wa.assocMap[_assocPick.key].icon=id;wa.assocOn=true;render();select(wa.id);renderProps();refreshAssocLive(wa);toast('Status-Icon: '+id);}_assocPick=null;return;}
    var ICONABLE=['icon','value','switch','bar','tile','button','light','chip','weather','weatherpro','room','kpi']; // wie die Icon-Zeile in renderProps
    var ids=Object.keys(sel);if(!ids.length&&selId)ids=[selId];
    var targets=ids.map(widget).filter(function(w){return w&&ICONABLE.indexOf(w.type)>=0;});
    if(targets.length){targets.forEach(function(w){w.icon=id;});render();renderProps();toast('Icon: '+id);}
    else{addWidget('icon',{icon:id});toast('Icon-Widget: '+id);}
  }
