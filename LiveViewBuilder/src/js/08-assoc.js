  // ===== Assoziationen (Variablenprofil: Wert -> Name/Icon/Farbe) =====
  // Semantische Skin-Farben (passen sich beim Reskinning/Theme automatisch an)
  var _SEVC=[['var(--text)','Standard'],['var(--ok)','OK'],['var(--warn)','Warnung'],['var(--crit)','Fehler'],['var(--accent)','Akzent'],['var(--info)','Info']];
  function _sevOpts(cur){return _SEVC.map(function(o){return '<option value="'+o[0]+'"'+(cur===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('');}
  // Stichwort -> Skin-Var. Zuerst generisch gegen SKIN_TOKENS (damit neue Skin-Farben wie
  // accent-2 automatisch funktionieren), danach die deutschen/alten Synonyme, sonst unverändert.
  function _skinColor(c){if(!c)return '';var s=(''+c).trim();if(/^var\(/.test(s))return s;
    if(typeof SKIN_TOKENS!=='undefined'&&SKIN_TOKENS.indexOf(s)>=0)return 'var(--'+s+')';
    if(s==='text-inv')return 'var(--text-inv)';   // abgeleitet in applySkin, nicht in SKIN_TOKENS
    if(/^u-[a-z0-9-]+$/.test(s))return 'var(--'+s+')'; // eigene benannte Skin-Farbe (u-slug); ist der Var nicht gesetzt, ignoriert CSS die Deklaration graceful
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
    // "~text" = ENTHAELT (ohne Gross-/Kleinschreibung). Fuer Klartexte, die eine
    // Anlage selbst formuliert: "Zündung läuft", "Ausbrand aktiv" - da trifft
    // kein exakter Vergleich, und eine Zahl ist es auch nicht.
    if(p.charAt(0)==='~'){var nadel=p.slice(1).trim().toLowerCase();
      return nadel!==''&&String(v==null?'':v).toLowerCase().indexOf(nadel)>=0;}
    var num=function(x){return parseFloat(String(x).replace(',','.'));},n=num(v);
    var op=p.match(/^(>=|<=|!=|<>|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(op){if(isNaN(n))return false;var t=num(op[2]);switch(op[1]){case '>':return n>t;case '<':return n<t;case '>=':return n>=t;case '<=':return n<=t;case '!=':case '<>':return n!==t;case '=':return n===t;}}
    var rg=p.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:\.\.|:)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(rg){if(isNaN(n))return false;var a=num(rg[1]),b=num(rg[2]);return n>=Math.min(a,b)&&n<=Math.max(a,b);}
    // Zusammengesetzter Bereich in Operator-Schreibweise, z. B. ">=3<6" oder ">0<=100".
    // Ohne das lief eine so geschriebene Stufe ins Leere (kein Treffer) statt zu greifen.
    var cp=p.match(/^(>=|>)\s*(-?\d+(?:[.,]\d+)?)\s*(<=|<)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(cp){if(isNaN(n))return false;var lo=num(cp[2]),hi=num(cp[4]);
      return (cp[1]==='>='?n>=lo:n>lo)&&(cp[3]==='<='?n<=hi:n<hi);}
    return _assocEq(pat,v);
  }
  /**
   * Darstellung einer Kachel in der Zustandsfarbe. Bisher entschied das FARBWORT darueber:
   * hiess die Farbe "crit", wurde die ganze Karte gefuellt, jede andere Farbe wurde nur
   * getoent. Das stand nirgends im Editor und galt zudem nur fuer das Zustands-Widget -
   * das Wert-Widget toente immer dezent. Nebeneinander sahen beide Karten deshalb voellig
   * verschieden aus, obwohl beide auf "crit" standen.
   * Die Regel ist jetzt hier, gilt fuer alle und laesst sich je Widget uebersteuern:
   *   mode ''/'auto'  bisheriges Verhalten (crit fuellt)
   *   mode 'soft'     immer nur toenen
   *   mode 'fill'     immer fuellen
   */
  function stateLook(ovc,mode){
    var sc=_skinColor(ovc)||'',key=String(ovc||'').toLowerCase();
    var m=(mode==='fill'||mode==='soft'||mode==='plain')?mode
         :(/crit|fehler|error|alarm/.test(key)?'fill':((sc&&sc!=='var(--text)')?'soft':'plain'));
    if(m==='fill'){var f=sc||'var(--crit)';
      return {mode:'fill',sc:f,bg:f,bd:f,val:'#fff',lab:'rgba(255,255,255,.85)',
              chip:'rgba(255,255,255,.20)',ic:'#fff',bar:'rgba(255,255,255,.9)',barw:'clamp(4px,4cqmin,6px)',
              pill:'rgba(255,255,255,.22)',pilltx:'#fff'};}
    if(m==='soft'&&sc){var t=stateTint(sc);
      return {mode:'soft',sc:sc,bg:t.bg,bd:t.bd,val:t.val,lab:t.lab,
              chip:t.chip,ic:sc,bar:sc,barw:'clamp(4px,4cqmin,6px)',
              pill:sc,pilltx:_contrastText(sc)};}
    return {mode:'plain',sc:sc,bg:'',bd:'',val:'',lab:'',chip:'',ic:'',bar:'transparent',barw:'0',pill:'',pilltx:''};
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

  /**
   * FARBE AUS EINER VERGLEICHSTABELLE. Eine Liste [{v, color}, ...] beschreibt, welche Farbe
   * ab welchem Wert gilt. Zwei Schreibweisen sind erlaubt und mischbar:
   *   - Muster wie ">=3<6", ">8", "0..25", "*"  -> ueber stateHit (denselben Vergleich wie
   *     die Zustandslisten, damit im Editor ueberall dasselbe gilt)
   *   - eine reine Zahl                         -> gilt "ab diesem Wert" (letzte Stufe <= Wert)
   * Liegt der Wert unter der kleinsten Zahl, gilt die unterste Stufe. Leere Liste -> ''.
   *
   * Lag zuerst als private Funktion in der Wertkarte. Sobald ein zweites Widget dieselbe
   * Tabelle braucht (Metrik-Liste), gehoert sie hierher - sonst laufen zwei Kopien mit
   * unterschiedlichen Feinheiten auseinander.
   */
  function gradColor(list, val, key) {
    list = list || []; var k = key || 'v';
    if (!list.length || isNaN(val)) return '';
    var m = stateHit(list, val, k);
    if (m && m.color) return _skinColor(m.color) || m.color;
    var num = [];
    list.forEach(function (g) {
      if (!g || !g.color) return;
      var roh = String(g[k] == null ? '' : g[k]);
      var q = parseFloat(roh.replace(',', '.'));
      if (!isNaN(q) && /^\s*-?[\d.,]+\s*$/.test(roh)) num.push({ v: q, c: g.color });
    });
    if (!num.length) return '';
    num.sort(function (a, b) { return a.v - b.v; });
    var pick = num[0], i;
    for (i = 0; i < num.length; i++) if (val >= num[i].v) pick = num[i];
    return _skinColor(pick.c) || pick.c;
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
  /**
   * Profil einer Variablen holen - gebuendelt.
   *
   * Beim Seitenaufbau ruft jede Kachel das fuer sich. Frueher wurde daraus je
   * Kachel EINE Anfrage, und weil der Zwischenspeicher erst mit der Antwort
   * gefuellt ist, sogar mehrere fuer dieselbe Variable: die Hauptseite fragte 23
   * Profile in 23 Anfragen ab (9 KB Nutzdaten), eine davon viermal. Im Haus faellt
   * das nicht auf - ueber den Proxy und ein Tablet wird daraus die halbe Ladezeit.
   *
   * Jetzt sammelt ein kurzer Aufschub (20 ms) alle Wuensche ein und holt sie in
   * EINER Anfrage; Nachzuegler auf eine bereits laufende Variable haengen sich an
   * deren Rueckruf an, statt neu zu fragen.
   */
  var _assocWarte={}, _assocRuf={}, _assocTimer=0;
  function _assocFlush(){
    _assocTimer=0;
    var ids=Object.keys(_assocWarte);
    if(!ids.length)return;
    _assocWarte={};
    var fertig=function(id,d){
      _assocData[id]=d;
      var cbs=_assocRuf[id]||[];delete _assocRuf[id];
      cbs.forEach(function(f){try{f(d);}catch(e){}});
    };
    fetch('?api=assoc&ids='+ids.join(','),{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        ids.forEach(function(id){
          var v=(j&&j.vars)?j.vars[id]:null;
          fertig(id,(v&&v.assocs)?{assocs:v.assocs,picon:v.picon||''}:{assocs:[],picon:''});
        });
      })
      .catch(function(){ids.forEach(function(id){fertig(id,{assocs:[],picon:''});});});
  }
  function loadAssoc(varId,cb){
    if(!varId){cb&&cb(null);return;}
    if(_assocData[varId]){cb&&cb(_assocData[varId]);return;}
    if(cb){(_assocRuf[varId]=_assocRuf[varId]||[]).push(cb);}
    if(_assocRuf[varId]&&_assocRuf[varId].length>1&&!_assocWarte[varId])return; // laeuft schon
    _assocWarte[varId]=1;
    if(!_assocTimer)_assocTimer=setTimeout(_assocFlush,20);
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
  /**
   * Icon zuweisen - oder entfernen.
   *
   * Ein leeres id bedeutet "kein Icon". Ohne diesen Weg liess sich ein einmal
   * gewaehltes Icon nur noch tauschen, nie wieder loswerden: die Bibliothek
   * kannte ausschliesslich Icons, und ein Feld ohne Icon war nach dem ersten
   * Klick unerreichbar. Beim Entfernen wird die Eigenschaft geloescht statt auf
   * '' gesetzt - eine leere Zeichenkette staende sonst in jedem Seiten-JSON.
   */
  function assignIcon(id){
    var leer=(id===''||id==null);
    if(_iconPick){var wp=widget(_iconPick.wid);if(wp){
      if(_iconPick.path)setPath(wp,_iconPick.path,leer?undefined:id);
      else if(leer)delete wp[_iconPick.field]; else wp[_iconPick.field]=id;
      render();select(wp.id);renderProps();commit();toast(leer?'Icon entfernt':('Icon: '+id));}_iconPick=null;return;}
    if(_assocPick){var wa=widget(_assocPick.wid);if(wa){if(!wa.assocMap)wa.assocMap={};if(!wa.assocMap[_assocPick.key])wa.assocMap[_assocPick.key]={};
      if(leer)delete wa.assocMap[_assocPick.key].icon; else wa.assocMap[_assocPick.key].icon=id;
      wa.assocOn=true;render();select(wa.id);renderProps();refreshAssocLive(wa);commit();toast(leer?'Status-Icon entfernt':('Status-Icon: '+id));}_assocPick=null;return;}
    if(leer){ // ohne offene Auswahl: das Icon der ausgewaehlten Kachel loeschen
      var _ids=Object.keys(sel);if(!_ids.length&&selId)_ids=[selId];
      var _t=_ids.map(widget).filter(Boolean);
      if(_t.length){_t.forEach(function(x){delete x.icon;});render();renderProps();commit();toast('Icon entfernt');}
      return;
    }
    // EINE Quelle statt einer handgepflegten Kopie: UNIV_ICON_TYPES bestimmt, wer eine
    // Icon-Eigenschaft hat; dazu die Typen, die hier historisch schon per Klick ein Icon
    // annahmen. Die frueher hier stehende Zweitliste war der Kommentar "wie die Icon-Zeile
    // in renderProps" - sie war es aber nicht mehr: 'valuecard' und 'bot' fehlten darin.
    // Folge: Wertkarte auswaehlen, Icon anklicken - und statt das Icon der Karte zu setzen,
    // legte der Builder ein NEUES Icon-Widget an.
    var ICONABLE=UNIV_ICON_TYPES.concat(['bar','weather','weatherpro','alarm']);
    var ids=Object.keys(sel);if(!ids.length&&selId)ids=[selId];
    var targets=ids.map(widget).filter(function(w){return w&&ICONABLE.indexOf(w.type)>=0;});
    if(targets.length){targets.forEach(function(w){w.icon=id;});render();renderProps();toast('Icon: '+id);}
    else{addWidget('icon',{icon:id});toast('Icon-Widget: '+id);}
  }
