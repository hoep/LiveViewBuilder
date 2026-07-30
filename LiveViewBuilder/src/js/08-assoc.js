  // ===== Assoziationen (Variablenprofil: Wert -> Name/Icon/Farbe) =====
  // Semantische Skin-Farben (passen sich beim Reskinning/Theme automatisch an)
  var _SEVC=[['var(--text)','Standard'],['var(--ok)','OK'],['var(--warn)','Warnung'],['var(--crit)','Fehler'],['var(--accent)','Akzent'],['var(--info)','Info']];
  function _sevOpts(cur){return _SEVC.map(function(o){return '<option value="'+o[0]+'"'+(cur===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');}
  // Stichwort -> Skin-Var. Zuerst generisch gegen SKIN_TOKENS (damit neue Skin-Farben wie
  // accent-2 automatisch funktionieren), danach die deutschen/alten Synonyme, sonst unverändert.
  function _skinColor(c){if(!c)return '';var s=(''+c).trim();if(/^var\(/.test(s))return s;
    if(typeof SKIN_TOKENS!=='undefined'&&SKIN_TOKENS.indexOf(s)>=0)return 'var(--'+s+')';
    var m={text:'--text',standard:'--text',ok:'--ok',gruen:'--ok','grün':'--ok',warn:'--warn',warnung:'--warn',alert:'--warn',crit:'--crit',fehler:'--crit',error:'--crit',accent:'--accent',akzent:'--accent',info:'--info',faint:'--faint',muted:'--muted',warm:'--warm'};
    var k=s.toLowerCase();return m[k]?('var('+m[k]+')'):s;}
  // Nur echte Farbwerte durchlassen - ein unbekanntes Stichwort darf keine CSS-Variable kaputtmachen.
  function _cssColorOrEmpty(c){var v=_skinColor(c);return (/^var\(--[\w-]+\)$/.test(v)||/^#[0-9a-fA-F]{3,8}$/.test(v)||/^(rgb|hsl|color-mix)\(/.test(v))?v:'';}
  // ---- Zustandsvergleich: EINE Implementierung fuer ALLE Widgets --------------------
  // Lag vorher als privater Helfer im Zustands-Widget, waehrend Wert-, Wertkarten-,
  // Timeline- und Status-Bild-Widget je einen eigenen, nur exakten Vergleich hatten.
  // Wer im Zustands-Widget ">0" gelernt hatte, stand beim Wert-Widget vor einer Liste,
  // die nur Gleichheit kennt - und bekam wortlos keine Farbe.
  function _assocEq(a,b){if(String(a)===String(b))return true;var t=function(x){return x===true||x===1||x==='1'||x==='true';},f=function(x){return x===false||x===0||x==='0'||x==='false';};return (t(a)&&t(b))||(f(a)&&f(b));}
  // Erweiterter Vergleich: Operatoren (>0 >=1 <5 <=3 !=0 =2), Bereiche (1..5 / 1:5) und Platzhalter (* / else). Sonst exakter/boolescher Vergleich.
  function _assocMatch(pat,v){
    if(pat==null)return false;var p=String(pat).trim();
    if(p==='')return false;                                     // leere Zeile matcht nichts
    if(p==='*'||/^(else|sonst|default|rest|any)$/i.test(p))return true;  // expliziter Platzhalter
    var num=function(x){return parseFloat(String(x).replace(',','.'));},n=num(v);
    var op=p.match(/^(>=|<=|!=|<>|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(op){if(isNaN(n))return false;var t=num(op[2]);switch(op[1]){case '>':return n>t;case '<':return n<t;case '>=':return n>=t;case '<=':return n<=t;case '!=':case '<>':return n!==t;case '=':return n===t;}}
    var rg=p.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:\.\.|:)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(rg){if(isNaN(n))return false;var a=num(rg[1]),b=num(rg[2]);return n>=Math.min(a,b)&&n<=Math.max(a,b);}
    return _assocEq(pat,v);
  }
  /**
   * EINE Rezeptur fuer das Toenen einer Kachel in der Zustandsfarbe. Zustands- und
   * Wert-Widget hatten getrennte Zahlen (13 gegen 16 Prozent Hintergrund, Wert einmal
   * in voller Farbe, einmal zu 85 Prozent gemischt) - nebeneinander sah das nach zwei
   * Gestaltungen aus. Wer die Zahlen aendert, aendert sie ab jetzt fuer alle.
   */
  function stateTint(col){
    return {
      bg:   'color-mix(in oklab,' + col + ' 13%,var(--surface))',
      bd:   'color-mix(in oklab,' + col + ' 45%,var(--line))',
      chip: 'color-mix(in oklab,' + col + ' 22%,transparent)',
      val:  col,
      lab:  'color-mix(in oklab,' + col + ' 60%,var(--muted))'
    };
  }

  /** Ersten passenden Eintrag einer Zustandsliste finden: exakt zuerst, dann Muster. */
  function stateHit(list,v,key){
    if(!list||!list.length)return null;
    var k=key||'v',i;
    for(i=0;i<list.length;i++){if(list[i]&&_assocEq(list[i][k],v))return list[i];}
    for(i=0;i<list.length;i++){if(list[i]&&_assocMatch(list[i][k],v))return list[i];}
    return null;
  }

  var _assocData={};   // varId -> {assocs:[{v,name,icon,color}], picon}
  var _assocPick=null; // {wid,key} während Icon-Auswahl für eine Assoziation
  var _iconPick=null;  // {wid,field} generische Icon-Auswahl in ein beliebiges Widget-Feld (z. B. Switch On/Off-Icon)
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
      var rows=d.assocs.map(function(a){var key=String(a.v),rr=assocResolved(w,a),ov=(w.assocMap&&w.assocMap[key])||{};
        return '<div class="arow"><span class="aic" style="color:'+(rr.color||'var(--accent)')+'">'+(rr.icon?iconSVG(rr.icon):'')+'</span>'
          +'<span class="anm">'+esc(a.name||key)+'</span><span class="aval">'+esc(key)+'</span>'
          +'<select class="asev" data-akey="'+esc(key)+'" title="Farbe (Skin, passt sich dem Theme an)"><option value="">Profil</option>'+_sevOpts(ov.color)+'</select>'
          +'<button class="btn aibtn" data-akey="'+esc(key)+'" style="padding:3px 7px;font-size:11px">Icon</button></div>';}).join('');
      box.innerHTML=head+'<div class="alist'+(w.assocOn?'':' off')+'">'+rows+'</div>';
      if($('#pAssocOn'))$('#pAssocOn').onchange=function(){w.assocOn=this.checked;if(!w.assocMap)w.assocMap={};if(this.checked&&!w.icon){var pic=symToIcon((_assocData[w.varId]||{}).picon);if(pic)w.icon=pic;}render();renderProps();refreshAssocLive(w);};
      $$('.aibtn',box).forEach(function(b){b.onclick=function(){_assocPick={wid:w.id,key:b.getAttribute('data-akey')};showTab('icons');toast('Icon für Status „'+b.getAttribute('data-akey')+'" links wählen');};});
      $$('.asev',box).forEach(function(sel){sel.onchange=function(){var k=sel.getAttribute('data-akey');if(!w.assocMap)w.assocMap={};if(!w.assocMap[k])w.assocMap[k]={};if(sel.value)w.assocMap[k].color=sel.value;else delete w.assocMap[k].color;w.assocOn=true;render();renderProps();refreshAssocLive(w);commit();};}); // Skin-Farbe (Icon+Text), passt sich dem Theme an
    });}
  function assignIcon(id){
    if(_iconPick){var wp=widget(_iconPick.wid);if(wp){wp[_iconPick.field]=id;render();select(wp.id);renderProps();toast('Icon: '+id);}_iconPick=null;return;}
    if(_assocPick){var wa=widget(_assocPick.wid);if(wa){if(!wa.assocMap)wa.assocMap={};if(!wa.assocMap[_assocPick.key])wa.assocMap[_assocPick.key]={};wa.assocMap[_assocPick.key].icon=id;wa.assocOn=true;render();select(wa.id);renderProps();refreshAssocLive(wa);toast('Status-Icon: '+id);}_assocPick=null;return;}
    var ICONABLE=['icon','value','switch','bar','tile','button','light','chip','weather','weatherpro','room','kpi','assoc']; // wie die Icon-Zeile in renderProps
    var ids=Object.keys(sel);if(!ids.length&&selId)ids=[selId];
    var targets=ids.map(widget).filter(function(w){return w&&ICONABLE.indexOf(w.type)>=0;});
    if(targets.length){targets.forEach(function(w){w.icon=id;});render();renderProps();toast('Icon: '+id);}
    else{addWidget('icon',{icon:id});toast('Icon-Widget: '+id);}
  }
