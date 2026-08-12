  function _wActionKind(w,inPopup){ // Hover-Affordance: Navigation (nav) vs. echte Schaltaktion (tog) vs. Lang-Druck (hold) getrennt
    var t=w.type, hold=!!(w.longPopup||w.longNav);
    // NAVIGATION: oeffnet Popup/Seite/Skript/Menue/Region oder geht zurueck. closePopup ist NUR im Popup sinnvoll.
    var nav=!!((inPopup&&w.closePopup)||w.popupTo||w.scriptId||w.openMenu||w.navBack||w.navTo||w.hoverTo||(w.regSlot&&w.regView));
    if(t==='campro')nav=nav||!!w.mediaId; // Vollbild-Kamera -> oeffnet etwas
    // SCHALTAKTION in-place: schreibt eine Variable / loest RequestAction aus (nur wenn keine Navigation greift)
    var tog=false;
    if(t==='switch')tog=(w.swMode==='multi')?false:!!w.varId; // Multi-State: Segmente sind die Klickziele -> KEIN Ganz-Widget-Hover
    else if(t==='light'||t==='dial'||(t==='slider'&&_rMode(w)==='dial'))tog=!!w.varId; // Dial ist jetzt eine Variante von slider (rmode). 'select': Knopf/Segment/Dropdown sind die Klickziele -> KEIN Ganz-Widget-Hover
    else if(t==='tile'||t==='button')tog=!nav&&!!w.varId; // ohne Navigationsziel schaltet die Variable
    else if(t==='cover')tog=!!(w.varId||w.varId2);
    else if(t==='thermostat')tog=!!(w.varId2||w.varId3);
    else if(t==='media')tog=!!w.varId2;
    else if(t==='bot')tog=!!w.varId3;
    else if(t==='skinswitch')tog=true;
    else if(t==='valuecard')tog=(w.vcMode==='select'?!!w.varId:!!(w.varId2&&!w.v2acc&&!w.rngOn)); // Auswahl-Modus oder echter Toggle; im Bereichsmodus ist varId2 das Minimum, keine Aktion
    else if(t==='colorpick'){var _cm=w.cmode||'wheel';tog=(_cm==='wheel'||_cm==='cie'||_cm==='button');} // Farbwähler: box/slider sind reine Anzeige bzw. Slider -> kein Ganz-Widget-Hover
    else{var wc=WIDGETS[t];if(wc&&wc.click&&!wc.noHover)tog=true;} // noHover: interne Teil-Klicks (z. B. msglog-Chips) sollen kein Ganz-Widget-Hover erzeugen
    var cls=[];
    if(nav)cls.push('act-nav');       // Navigation hat optischen Vorrang (anheben)
    else if(tog)cls.push('act-tog');  // sonst: in-place-Schaltaktion (getoenter Innen-Ring)
    if(hold)cls.push('act-hold');
    return cls.join(' ');
  }
  // ===== Freie Positionierung von Wert & Icon (alle kompakten Wert/Icon-Widgets) =====
  // Pro Typ die Selektoren des Wert- und des Icon-Elements (ermittelt per Widget-Audit).
  // val/ico werden per transform:translate(valDX/valDY | icoDX/icoDY) verschoben - nicht-destruktiv,
  // Layout bleibt, das Element rueckt nur optisch. transform erzeugt einen eigenen Stapelkontext,
  // der dank .winner{isolation:isolate} das Widget nicht verlaesst.
  var POS_SEL={
    value:{val:'[data-role=val]',ico:'.wvic'}, valuecard:{val:'.hvcval',ico:'.hkbi'},
    kpi:{val:'[data-role=val]',ico:'.hkbi'}, chip:{val:'[data-role=val]',ico:'.hchipic'},
    tile:{val:'[data-role=val]',ico:'.htbadge'}, room:{val:'[data-role=val]',ico:'.hricon'},
    bar:{val:'[data-role=val]',ico:'.baric'}, switch:{val:'[data-role=sw]',ico:'.swic'},
    light:{val:'.hl2val',ico:'.hl2ic'}, weather:{val:'[data-role=val]',ico:'[data-role=cico]'},
    assoc:{val:'[data-role=aval]',ico:'.hassoc-chip'}, button:{val:null,ico:'.hbicon'},
    icon:{val:null,ico:'.iconwrap'}, checkbox:{val:'[data-role=cbx]',ico:null},
    eventctl:{val:'[data-role=evsw]',ico:null}, calc:{val:'[data-role=val]',ico:null},
    cval:{val:'[data-role=val]',ico:null}, sval:{val:'[data-role=val]',ico:null},
    delta:{val:'[data-role=val]',ico:null}, raincard:{val:'[data-role=val]',ico:null},
    sun:{val:'[data-role=val]',ico:null}, objinfo:{val:'[data-role=oival]',ico:null},
    clock:{val:'.hctime',ico:null},
    timer:{val:'.httime',ico:null}, tempbar:{val:'.htval',ico:null},
    bot:{val:'.hvst',ico:null}, thermostat:{val:'.htc-ist',ico:null},
    slider:{val:'[data-role=val]',ico:null}, cover:{val:'[data-role=val]',ico:null}
  };
  // position:relative + left/top statt transform: wirkt auch auf inline-Elemente (z. B. der Wert-<span>),
  // transform greift bei nicht-ersetzten inline-Boxen nicht.
  function _posOne(root,selc,dx,dy){if(!selc)return;var e=root.querySelector(selc);if(!e)return;
    if(dx||dy){e.style.position='relative';e.style.left=(dx||0)+'px';e.style.top=(dy||0)+'px';e.style.zIndex='2';}
    else{e.style.position='';e.style.left='';e.style.top='';e.style.zIndex='';}}
  function _applyPosOffsets(w,root){var m=POS_SEL[w.type];if(!m)return;
    if(m.val)_posOne(root,m.val,w.valDX||0,w.valDY||0);
    if(m.ico)_posOne(root,m.ico,w.icoDX||0,w.icoDY||0);}
  function render(){
    if(typeof closeHover==='function')closeHover(); // offener Hover-Flyout haengt sonst verwaist ueber dem Neuaufbau (navBack/setRegion etc.)
    disposeCharts();
    _tickKids=[];   // verschachtelte Ticker-Widgets werden während des Render-Laufs neu gesammelt
    $$('.w',canvas).forEach(function(e){e.remove();});
    // Laufzeilen koennen auch IN einer Leiste liegen - dann muessen die von ihnen referenzierten
    // Widgets auf der Seite trotzdem ausgeblendet werden, sonst stehen sie doppelt.
    var _refSet={};allWidgets().forEach(function(t){if(t.type==='ticker'&&t.items)t.items.forEach(function(m){if(m.ref)_refSet[m.ref]=1;});}); // von einer Laufzeile referenzierte Namen -> auf der Seite ausblenden
    var _chrome=chromeRender();          // Leisten zeichnen; liefert den Host für den Seiteninhalt
    state.widgets.forEach(function(w){try{
      _chrome.host.appendChild(_mkWidgetEl(w,_refSet));
      }catch(_e){if(window.console)console.error('render '+(w&&w.type),_e);} // ein defektes Widget darf render (und damit Kamera/HTML-Init) nicht abbrechen
    });
    chromeKids();                        // Widgets innerhalb der Leisten zeichnen
    _renderRest();
  }
  // Universelle Icon-/Grafik-Gestaltung (Groesse, Hintergrund, Form, Rahmen, Schatten, Deckkraft, Glow).
  // Rein additiv: greift NUR, wenn mindestens eine Eigenschaft gesetzt ist -> bestehende Layouts unveraendert.
  // Konsum als Inline-Style direkt auf der Icon-Huelle (kein var()-Fallback-Risiko).
  function _hasIconGfx(w){return w.iconSize!=null||w.iconBg||w.iconShape||w.iconRadius!=null||w.iconBorder!=null||w.iconShadow||w.iconOpacity!=null||w.iconGlow;}
  function _applyIconGfx(w,e){
    if(w.iconSize!=null){e.style.fontSize=(+w.iconSize)+'px';var sv=e.querySelector('svg');if(sv){sv.style.width=(+w.iconSize)+'px';sv.style.height=(+w.iconSize)+'px';}}
    var shape=w.iconShape;
    if(w.iconBg){e.style.background=(_skinColor(w.iconBg)||w.iconBg);if(!shape)shape='rounded';}
    if(w.iconBg||shape){e.style.display='inline-flex';e.style.alignItems='center';e.style.justifyContent='center';if(w.iconBg)e.style.padding='0.35em';}
    if(shape==='circle')e.style.borderRadius='999px';
    else if(shape==='square')e.style.borderRadius='0';
    else if(shape==='rounded')e.style.borderRadius=((w.iconRadius!=null?+w.iconRadius:8))+'px';
    if(w.iconRadius!=null&&shape!=='circle')e.style.borderRadius=(+w.iconRadius)+'px';
    if(w.iconBorder!=null&&+w.iconBorder>0)e.style.border=(+w.iconBorder)+'px solid '+(w.iconBorderColor?(_skinColor(w.iconBorderColor)||w.iconBorderColor):'currentColor');
    if(w.iconShadow==='soft')e.style.boxShadow='0 2px 6px rgba(0,0,0,.25)';
    else if(w.iconShadow==='strong')e.style.boxShadow='0 4px 14px rgba(0,0,0,.4)';
    if(w.iconOpacity!=null)e.style.opacity=String(Math.max(0,Math.min(100,+w.iconOpacity))/100);
    if(w.iconGlow)e.style.filter='drop-shadow(0 0 6px var(--wicon,var(--accent)))';
  }
  // Ein Widget-Element bauen (identisch für Seiteninhalt und Leisten-Inhalt)
  function _mkWidgetEl(w,_refSet){
      _refSet=_refSet||{};
      var d=document.createElement('div');d.className='w t-'+w.type+(sel[w.id]?' sel':'')+(w.anim?' anim-'+w.anim:'')+(w.lineMode?' wline':'');d.dataset.id=w.id;
      d.style.left=w.x+'px';d.style.top=w.y+'px';d.style.width=w.w+'px';d.style.height=w.h+'px';
      var _frameOn=(w.frame!=null)?w.frame:!state.page.noframe;if(!_frameOn)d.classList.add('no-frame'); // Kachel-Rahmen: Widget-Override sonst Ansicht-Standard
      if(w.bgT)d.classList.add('bg-t'); // Hintergrund transparent (Rahmen bleibt davon unberuehrt)
      if(w.lblWrap)d.classList.add('lbl-wrap'); // Beschriftungen duerfen umbrechen
      var _ak=_wActionKind(w);if(_ak)_ak.split(' ').forEach(function(c){d.classList.add(c);}); // Hover-Affordance: nav/tog/hold (CSS greift nur ausserhalb Edit)
      if(w.name&&_refSet[w.name])d.classList.add('ref-hidden'); // in Laufzeile referenziert -> immer aus (bearbeiten über die Laufzeile)
      else if(w.hidden)d.classList.add('run-hidden'); // manuell versteckt -> im Run aus, im Edit gestrichelt sichtbar (CSS)
      var _inner;try{_inner=widgetInner(w);}catch(_e){_inner='<div style="padding:6px;font-size:11px;color:var(--crit)">⚠ '+esc(w.type||'?')+'</div>';} // ein defektes Widget darf das Rendern nicht abbrechen
      // Reset-Knopf im Builder: nur bei positionierbaren Widgets mit gesetztem Offset, sichtbar erst bei Auswahl (CSS)
      var _posBtn=(mode==='edit'&&POS_SEL[w.type]&&(w.valDX||w.valDY||w.icoDX||w.icoDY))?'<button class="posreset" data-posreset="1" title="Position von Wert/Icon zurücksetzen">↺</button>':'';
      d.innerHTML='<div class="winner">'+_inner+'</div>'+_posBtn+'<div class="rz rz-n" data-rz="n"></div><div class="rz rz-s" data-rz="s"></div><div class="rz rz-e" data-rz="e"></div><div class="rz rz-w" data-rz="w"></div><div class="rz rz-ne" data-rz="ne"></div><div class="rz rz-nw" data-rz="nw"></div><div class="rz rz-se" data-rz="se"></div><div class="rz rz-sw" data-rz="sw"></div>';
      if(w.type==='value'&&w.valfs){var v=$('.v',d);if(v)v.style.fontSize=w.valfs+'px';}
      _applyPosOffsets(w,d); // Wert/Icon frei positionieren (valDX/valDY, icoDX/icoDY)
      if(w.bg&&!w.bgT)d.style.background=w.bg;if(w.fg){var _rf=_readableFg(w.fg,(w.bgT?null:w.bg));if(_rf)d.style.color=_rf;}
      if(w.iconColor)d.style.setProperty('--wicon',_skinColor(w.iconColor)||w.iconColor); // zentrale Icon-Farbe
      if(_hasIconGfx(w)){var _ie=d.querySelector('.iconwrap,.wvic,.swic,.htbadge,.htico,.hbicon,.hl2ic,.hchipic,.hricon,.hkbi,.hassoc-chip,.hvicon,[data-role=badge]');if(_ie)_applyIconGfx(w,_ie);} // universelle Icon-/Grafik-Gestaltung (opt-in)
      if(w.textTransform)d.style.textTransform=w.textTransform; // universelle Groß-/Kleinschreibung (opt-in)
      if(w.ff){d.style.setProperty('--w-ff',w.ff);d.classList.add('tw-ff');}if(w.fwt){d.style.setProperty('--w-fwt',w.fwt);d.classList.add('tw-fwt');}if(w.fsty){d.style.setProperty('--w-fsty',w.fsty);d.classList.add('tw-fsty');}if(w.fsz){d.style.setProperty('--w-fsz',w.fsz+'px');d.classList.add('tw-fsz');} // Typografie: auf innere Elemente erzwingen
      return d;
  }
  // Ein Widget in Betrieb nehmen: Diagramm anlegen, Kamera laden, Inhalte holen.
  // Lag frueher fest im Seiten-Rendern und war damit auf den Seiten-Canvas verdrahtet.
  // Popups durchlaufen einen eigenen Pfad und bekamen davon nichts - dort blieben
  // Diagramme (auch Wasserfall), Kameras, HTML, Wochenplan, Sonnenbogen, Kalender,
  // Ereignis- und Objekt-Kacheln sowie Thermostate leer. Jetzt einmal vorhanden und
  // mit dem passenden Wurzelelement aufgerufen.
  // Wurzel eines bereits gezeichneten Widgets bestimmen. Die live-Hooks bekommen das
  // Element mitgeliefert; daraus laesst sich ablesen, ob es im Popup oder auf der Seite
  // haengt. Ohne das wuerde ein Hook aus dem Popup heraus das gleichnamige Element auf
  // der Seite anfassen - Popup-Widgets tragen dieselben IDs wie die Seiten-Widgets.
  function rootOfEl(el){var oc=$('#ovcanvas');return (el&&oc&&oc.contains(el))?oc:canvas;}
  function activateWidget(w,root){
    if(w.type==='gauge'||w.type==='chart'||w.type==='spark'||w.type==='sankey'||w.type==='gaugepro'||w.type==='waterfall'||w.type==='meteogram'||w.type==='multiring')initEChart(w,root);
    if(w.type==='camera'||w.type==='campro')refreshCam(w,root);
    if(w.type==='html'){if(w.htmlSrc==='custom')setHtmlContent(w,w.html||'',root);else fetchHtml(w,root);}
    if(w.type==='weekplan')fetchWeekplan(w,root);
    if(w.type==='suncard')refreshSun(w,root);
    if(w.type==='calendar')fetchCalEvents(w,root);
    if(w.type==='eventctl')fetchEvent(w,root);
    if(w.type==='objinfo')fetchObjInfo(w,root);
    if(w.visVar&&mode!=='edit'&&_lastVals[w.visVar]){var _ve=$('.w[data-id="'+w.id+'"]',(root||canvas));if(_ve)_ve.style.display=evalVis(w,_lastVals[w.visVar])?'':'none';}
    if(w.type==='thermostat'){buildThermModes(w,root);updateTherm(w,root);}
    if((w.assocOn||w.type==='assoc')&&w.varId)loadAssoc(w.varId,function(){if(_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);});
  }
  function _renderRest(){
    // ECharts- und Kamera-Widgets aktivieren (je Widget abgesichert) — Seiteninhalt UND Leisten-Inhalt
    state.widgets.concat(chromeAllKids()).forEach(function(w){
      try{
      activateWidget(w,canvas);   // gemeinsam mit dem Popup-Pfad
      var _mwr=WIDGETS[w.type];if(_mwr&&_mwr.mount)_mwr.mount(w); // Registry-Post-Render-Hook (z.B. Canvas zeichnen)
      }catch(_e){} // ein defektes Widget darf Init/Interaktion der anderen nicht blockieren
    });
    _compKids=[];allWidgets().forEach(function(w){if(w.type==='component')expandComponent(w);}); // M3: Komponenten-Instanzen expandieren
    _contKids=[];state.widgets.forEach(function(w){if(w.type==='container')expandContainer(w);}); // Container-Kinder zeichnen (echte, editierbare Widgets)
    state.widgets.forEach(function(w){if(w.type==='alarmpanel'&&typeof expandAlarmPanel==='function')expandAlarmPanel(w);}); // Alarm-Panel: aktive Alarm-Karten einhaengen
    // In einer Komponente eingebettete Container/Alarm-Panels ebenfalls auffuellen (sonst leer, z.B. Pool-CFG-Seiten im Tab-Hub).
    if(_compKids&&_compKids.length)_compKids.slice().forEach(function(w){try{if(w.type==='container')expandContainer(w);else if(w.type==='alarmpanel'&&typeof expandAlarmPanel==='function')expandAlarmPanel(w);}catch(_e){}});
    // mount-Hooks auch für Klone (Laufband/Komponenten) + Werte aus Cache spiegeln -> Status-Bild/Wetter/cval usw. erscheinen sofort, nicht erst bei Wertänderung
    function _mountKid(w){try{var _mw=WIDGETS[w.type];if(_mw&&_mw.mount)_mw.mount(w);}catch(e){}}
    if(_compKids&&_compKids.length)_compKids.forEach(_mountKid);
    if(_contKids&&_contKids.length)_contKids.forEach(function(w){try{activateWidget(w,canvas);}catch(e){}_mountKid(w);}); // Container-Kinder: Diagramme/Kameras + mount
    if(_tickKids&&_tickKids.length)_tickKids.forEach(_mountKid);
    var eh=$('#emptyhint');if(!eh){eh=document.createElement('div');eh.id='emptyhint';eh.textContent='Element aus der Palette hierher ziehen — oder eine Variable im Baum anklicken';canvas.appendChild(eh);}eh.style.display=state.widgets.length?'none':'flex';
    invalidateVidx();buildVidx();applyCached();_pvSince=0;pollVals();commit();tick();drawStructure(); // Cache sofort anwenden (kein Flackern beim Seitenwechsel), dann frisch pollen
  }

  // ---------- ECharts / Kamera ----------
  var _ec={},_hist={},_lastVals={},_chAnim={};   // _chAnim: Bar-Race-Timer je Widget
  function cssv(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
  function _rgb(h){h=(h||'').trim();if(h.charAt(0)==='#')h=h.slice(1);if(h.length===3)h=h.charAt(0)+h.charAt(0)+h.charAt(1)+h.charAt(1)+h.charAt(2)+h.charAt(2);var n=parseInt(h||'0',16);return [(n>>16)&255,(n>>8)&255,n&255];}
  function accA(a,hex){var c=_rgb(hex||cssv('--accent'));return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
  function gradFill(hex){return {type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:accA(.34,hex)},{offset:1,color:accA(0,hex)}]};}
  // Zeitversatz-Vergleich (Delta/KPI + Charts)
  var OFFS={'1h':3600,'1d':86400,'1w':604800,'1m':2592000,'1y':31536000};
  var OFFLBL={'1h':'letzte Stunde','1d':'gestern','1w':'letzte Woche','1m':'letzter Monat','1y':'letztes Jahr','last':'letztem Wert'};
  // KPI/Delta-Zeitversatz: Aggregationsstufe (Periode) + Vergleich mit der Vorperiode
  var STAGES=[['minute','minütlich'],['hour','stündlich'],['day','täglich'],['week','wöchentlich'],['month','monatlich'],['year','jährlich']];
  var STAGELBL={minute:'Minute davor',hour:'Stunde davor',day:'gestern',week:'letzte Woche',month:'letzter Monat',year:'letztes Jahr'};
  var STAGECUR={minute:'letzte Minute',hour:'diese Stunde',day:'heute',week:'diese Woche',month:'dieser Monat',year:'dieses Jahr'};
  function cmpStage(w){return w.cmpStage||({'1h':'hour','1d':'day','1w':'week','1m':'month','1y':'year','last':'day'}[w.cmpOff])||'day';}
  function stageSel(id,cur){cur=cur||'day';return '<select id="'+id+'">'+STAGES.map(function(s){return '<option value="'+s[0]+'"'+(s[0]===cur?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select>';}
  var _cmpData={}; // widgetId -> {cur,past,type,fetched}
  function darken(hex,amt){hex=String(hex||'#888888').replace('#','');if(hex.length===3)hex=hex.split('').map(function(c){return c+c;}).join('');var r=parseInt(hex.substr(0,2),16),g=parseInt(hex.substr(2,2),16),b=parseInt(hex.substr(4,2),16);function d(x){return Math.max(0,Math.min(255,Math.round(x*(1-amt))));}return '#'+[d(r),d(g),d(b)].map(function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
  function fmtDelta(n,sign){if(n==null||isNaN(n))return '–';var a=Math.abs(n),s=a>=100?Math.round(n):Math.round(n*10)/10;return (sign&&n>0?'+':'')+String(s).replace('.',',');}
  function _lerpHex(a,b,f){var A=_rgb(a),B=_rgb(b);return '#'+[0,1,2].map(function(i){return ('0'+Math.round(A[i]+(B[i]-A[i])*f).toString(16)).slice(-2);}).join('');}
  function tColor(t,stops){if(!stops||!stops.length)return cssv('--accent');var s=stops.slice().sort(function(a,b){return a.t-b.t;});if(t<=s[0].t)return s[0].color;if(t>=s[s.length-1].t)return s[s.length-1].color;for(var i=0;i<s.length-1;i++){if(t>=s[i].t&&t<=s[i+1].t)return _lerpHex(s[i].color,s[i+1].color,(t-s[i].t)/((s[i+1].t-s[i].t)||1));}return s[s.length-1].color;}
  function _hhmm(v){var s=String(v==null?'':v),m=s.match(/(\d{1,2}):(\d{2})/);if(m)return (+m[1])*60+(+m[2]);var n=parseFloat(String(v).replace(',','.'));if(!isNaN(n)&&n>100000){var d=new Date(n*1000);return d.getHours()*60+d.getMinutes();}return null;}
  function _hhmmTxt(v){var m=String(v).match(/(\d{1,2}:\d{2})/);return m?m[1]:String(v);}
  function refreshWeatherPro(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var days=w.fc||[];
    var his=[],los=[];days.forEach(function(r){var hv=_lastVals[r.hi],lv=_lastVals[r.lo];r._h=hv?parseFloat(String(hv.v).replace(',','.')):NaN;r._l=lv?parseFloat(String(lv.v).replace(',','.')):NaN;if(!isNaN(r._h))his.push(r._h);if(!isNaN(r._l))los.push(r._l);});
    var gmin=(w.gmin!=null&&w.gmin!=='')?parseFloat(w.gmin):(los.length?Math.min.apply(null,los)-1:-10);
    var gmax=(w.gmax!=null&&w.gmax!=='')?parseFloat(w.gmax):(his.length?Math.max.apply(null,his)+1:40);if(gmax<=gmin)gmax=gmin+1;
    var rows=$$('.hwp2day',el);
    days.forEach(function(r,i){var row=rows[i];if(!row)return;var fill=$('.fill',row);if(!fill)return;
      if(isNaN(r._h)||isNaN(r._l)){fill.style.width='0';return;}
      var lp=(r._l-gmin)/(gmax-gmin)*100,hp=(r._h-gmin)/(gmax-gmin)*100;
      fill.style.left=Math.max(0,Math.min(100,lp))+'%';fill.style.width=Math.max(3,Math.min(100,hp)-Math.max(0,lp))+'%';
      fill.style.background='linear-gradient(90deg,'+tColor(r._l,w.tgrad)+','+tColor(r._h,w.tgrad)+')';
    });
  }
  function refreshSun(w,root){
    var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;
    var sr=_lastVals[w.varId],ss=_lastVals[w.varId2],a=sr?_hhmm(sr.f||sr.v):null,b=ss?_hhmm(ss.f||ss.v):null,sun=$('[data-role=sun]',el);if(sun==null)return;
    // Beim ersten Setzen nach einem Neuzeichnen die Übergänge aussetzen: sonst startet die Sonne
    // sichtbar am Aufgangspunkt (Markup-Standard) und der Mond blitzt kurz auf.
    var _hsc=$('.hsc',el),_fresh=!!(_hsc&&_hsc.dataset.sunReady!=='1');
    var v1=$('[data-role=val]',el);if(v1&&sr)v1.textContent=_hhmmTxt(sr.f||sr.v);var v2=$('[data-role=val2]',el);if(v2&&ss)v2.textContent=_hhmmTxt(ss.f||ss.v);
    if(a==null||b==null||b<=a)return;   // ohne gültige Zeiten nichts setzen (Klasse bewusst erst danach)
    if(_fresh)_hsc.classList.add('notrans');
    var now=new Date(),nm=now.getHours()*60+now.getMinutes();
    var _ss=function(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};       // Smoothstep
    var TW=45,dayAmt=Math.max(0,Math.min(_ss((nm-(a-TW))/(2*TW)),_ss(((b+TW)-nm)/(2*TW)))); // 1=Tag, 0=Nacht, weiche Dämmerung (±45 min)
    var moon=$('[data-role=moon]',el),fill=$('[data-role=fill]',el),filln=$('[data-role=filln]',el),nw=$('[data-role=now]',el);
    // Gegenskalierung, damit Sonne/Mond trotz preserveAspectRatio="none" rund bleiben (bei jedem Seitenverhältnis)
    var _vbH=w.showNight?128:96,_svg=el.querySelector('.hscsvg'),kR=1;
    if(_svg){var _r=_svg.getBoundingClientRect();if(_r.width>0&&_r.height>0)kR=(_r.width/200)/(_r.height/_vbH);} // SVG hat in Safari kein offsetWidth -> getBoundingClientRect
    if(!(kR>0.05&&kR<20))kR=1;
    if(w.showNight){
      // Durchgehende 24h-Sinuskurve: x = Zeit (0..24h), Horizont mittig. Tag = Bogen über der Linie, Nacht = zwei Halbbögen darunter.
      var W=200,M=8,HY=64,AMP=52,vbH=128;
      var xOf=function(t){return M+(Math.max(0,Math.min(1440,t))/1440)*(W-2*M);};
      var yOf=function(t){t=(((t%1440)+1440)%1440);if(t>=a&&t<=b)return HY-AMP*Math.sin(Math.PI*(t-a)/(b-a));var nl=(a+1440)-b,tn=(t>b)?(t-b):(t+1440-b);return HY+AMP*Math.sin(Math.PI*tn/nl);};
      var samp=function(t0,t1,n){var s='';for(var i=0;i<=n;i++){var t=t0+(t1-t0)*i/n;s+=(i?' L':'')+xOf(t).toFixed(1)+' '+yOf(t).toFixed(1);}return s;};
      var H=HY.toFixed(0);
      var cEl=$('[data-role=curve]',el);if(cEl)cEl.setAttribute('d','M'+samp(a,b,30));                                   // Tagbogen (über der Linie)
      var cnEl=$('[data-role=curven]',el);if(cnEl)cnEl.setAttribute('d','M'+samp(b,1440,18)+' M'+samp(0,a,18));           // Nacht: rechts (Untergang→Mitternacht) + links (Mitternacht→Aufgang)
      var cx=xOf(nm),cy=yOf(nm);
      sun.setAttribute('cx',cx.toFixed(1));sun.setAttribute('cy',cy.toFixed(1));sun.setAttribute('transform','translate(0,'+(cy*(1-kR)).toFixed(2)+') scale(1,'+kR.toFixed(3)+')');sun.style.opacity=dayAmt.toFixed(2); // Sonne + Mond an derselben Position, überblenden per dayAmt
      if(moon){moon.setAttribute('transform','translate('+cx.toFixed(1)+','+cy.toFixed(1)+') scale(1,'+kR.toFixed(3)+')');moon.style.opacity=(1-dayAmt).toFixed(2);}
      if(fill){var df='';if(nm>=a){var te=Math.min(nm,b);df='M'+xOf(a).toFixed(1)+' '+H+' L'+samp(a,te,20)+' L'+xOf(te).toFixed(1)+' '+H+' Z';}fill.setAttribute('d',df);fill.style.opacity=(dayAmt*0.30).toFixed(3);} // Tagfläche bis Sonne
      if(filln){var nf='';                                                                                                // Nachtfläche bis Mond (ggf. rechts + links)
        if(nm>b){nf='M'+xOf(b).toFixed(1)+' '+H+' L'+samp(b,nm,22)+' L'+xOf(nm).toFixed(1)+' '+H+' Z';}
        else if(nm<a){nf='M'+xOf(b).toFixed(1)+' '+H+' L'+samp(b,1440,16)+' L'+xOf(1440).toFixed(1)+' '+H+' Z M'+xOf(0).toFixed(1)+' '+H+' L'+samp(0,nm,16)+' L'+xOf(nm).toFixed(1)+' '+H+' Z';}
        filln.setAttribute('d',nf);filln.style.opacity=((1-dayAmt)*0.55).toFixed(3);}
      if(w.showTime&&nw){nw.textContent=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);nw.style.left=(cx/W*100).toFixed(1)+'%';nw.style.top=(cy/vbH*100).toFixed(1)+'%';}
    }else{
      // Nur-Tag: einfacher Bogen über die volle Breite (Aufgang links, Untergang rechts)
      var f=Math.max(0,Math.min(1,(nm-a)/(b-a))),mt=1-f,x=mt*mt*12+2*mt*f*100+f*f*188,y=mt*mt*82+2*mt*f*(-6)+f*f*82;
      sun.setAttribute('cx',x.toFixed(1));sun.setAttribute('cy',y.toFixed(1));sun.setAttribute('transform','translate(0,'+(y*(1-kR)).toFixed(2)+') scale(1,'+kR.toFixed(3)+')');sun.style.opacity=((nm>=a&&nm<=b)?1:0.25).toFixed(2);
      var _qp=function(x0,x1,y1,x2,t){var qx=x0+(x1-x0)*t,qy=82+(y1-82)*t,m2=1-t,ex=m2*m2*x0+2*m2*t*x1+t*t*x2,ey=m2*m2*82+2*m2*t*y1+t*t*82;return 'M'+x0+' 82 Q'+qx.toFixed(1)+' '+qy.toFixed(1)+' '+ex.toFixed(1)+' '+ey.toFixed(1)+' L'+ex.toFixed(1)+' 82 Z';};
      if(fill){fill.setAttribute('d',_qp(12,100,-6,188,f));fill.style.opacity=((nm>=a&&nm<=b)?0.30:0).toFixed(3);}
      if(w.showTime&&nw){nw.textContent=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);nw.style.left=(x/200*100).toFixed(1)+'%';nw.style.top=(y/96*100).toFixed(1)+'%';}
    }
    var len=$('[data-role=len]',el);if(len){var dl=b-a;len.textContent=Math.floor(dl/60)+' h '+('0'+(dl%60)).slice(-2)+' min';}
    // Positionen sitzen -> Übergänge wieder zulassen (ab jetzt animiert nur noch die echte Bewegung)
    if(_fresh&&_hsc){void _hsc.offsetWidth;_hsc.classList.remove('notrans');_hsc.dataset.sunReady='1';}
  }
  function disposeCharts(){for(var a in _chAnim){try{clearInterval(_chAnim[a]);}catch(e){}}_chAnim={};for(var k in _ec){try{_ec[k].dispose();}catch(e){}}_ec={};}
  // Responsive ECharts-Schrift: Basisgröße x Skalierung nach Kachelgröße (Referenz 300x180, geklemmt 0.8..1.7)
  // ECharts zeichnet auf ein Canvas - die zentrale Typografie (CSS-Variablen --w-fsz) erreicht es
  // NICHT. Deshalb wird w.fsz hier ausgewertet: sie skaliert alle Diagrammschriften gemeinsam
  // (12px = Normalmass), zusaetzlich zur Skalierung nach Kachelgroesse.
  function _ecFS(w,base){var sc=Math.min((w&&w.w?w.w:300)/300,(w&&w.h?w.h:180)/180);sc=Math.max(0.8,Math.min(1.7,sc));
    if(w&&w.fsz>0)sc*=(parseFloat(w.fsz)/12);
    return Math.round(base*sc*10)/10;}
  // Wasserfall: Muster-Schritte lazy saeen. addWidget ruft defaults() VOR dem Setzen von ctype,
  // deshalb kann die Saat nicht in chart.defaults() liegen — sie passiert im pCType-Wechsel und hier defensiv.
  function _wfSeed(w){
    // NUR beim ersten Mal Muster-Schritte setzen. Eine bewusst geleerte Liste (Array der Länge 0)
    // muss leer bleiben - sonst kann der Anwender den letzten Schritt nie löschen.
    if(!w.steps){
      w.steps=[
        {title:'Start',   vid:0, type:'start', color:'info'},
        {title:'Zunahme', vid:0, type:'auf',   color:'ok'},
        {title:'Abnahme', vid:0, type:'ab',    color:'crit'},
        {title:'Summe',   vid:0, type:'sum',   color:'accent'}
      ];
      if(w.labels==null)w.labels=true;            // Wasserfall zeigt Datenlabels standardmaessig
      if(w.showTitle==null)w.showTitle=false;     // frueher ueber label='' geloest — Label bleibt jetzt erhalten
    }
    return w.steps;
  }
  // Wasserfall (nicht zeitbasiert): Schritte start/auf/ab/sub(=Zwischensumme)/sum(=Summe) auf Kategorie-Achse
  function setWaterfall(w){
    var ec=_ec[w.id];if(!ec)return;
    var steps=_wfSeed(w),cats=[],baseD=[],barD=[],levels=[],running=0;
    var upC=_skinToCss(w.wfUp)||cssv('--ok'),dnC=_skinToCss(w.wfDown)||cssv('--crit'),acc=cssv('--accent'),br=parseFloat(w.barRadius!=null?w.barRadius:3);
    steps.forEach(function(s){
      var t=s.type||'auf',lv=s.vid&&_lastVals[s.vid],raw=lv?parseFloat(String(lv.v).replace(',','.')):null;
      var v=(raw==null||isNaN(raw))?0:raw,mag=Math.abs(v),base=0,h=0,col=_skinToCss(s.color);
      if(t==='start'){base=0;h=v;running=v;if(!col)col=cssv('--info');}
      else if(t==='ab'){running-=mag;base=running;h=mag;if(!col)col=dnC;}
      else if(t==='sub'){base=0;h=running;if(!col)col=acc;}        // Zwischensumme (berechnet, Saldo bisher)
      else if(t==='sum'){base=0;h=running;if(!col)col=acc;}        // Summe (berechnet, Endsaldo)
      else {base=running;h=mag;running+=mag;if(!col)col=upC;}      // auf (+)
      cats.push(s.title||'');baseD.push(base);levels.push(running); // Saldo nach diesem Schritt (Level fuer Verbindungslinie)
      barD.push({value:h,itemStyle:{color:col,borderRadius:br}});
    });
    var unit=_wfUnit(w); // eigene Einheit (nicht w.yunit - das gehoert dem Achsensystem/Kalenderjahr-Balken)
    var lbl=w.labels?{show:true,position:'top',fontSize:_ecF(w,'label',9),color:cssv('--muted'),formatter:function(p){return (p.value==null)?'':_chNum(w,p.value);}}:{show:false};
    var series=[{type:'bar',stack:'wf',silent:true,itemStyle:{color:'transparent'},emphasis:{disabled:true},data:baseD},
                {type:'bar',stack:'wf',data:barD,label:lbl}];
    if(w.wfConnect!==false&&cats.length>1){ // gestrichelte Verbindungslinien auf Saldo-Hoehe zwischen den Balken
      // Daten sind die Saldo-Werte, NICHT die Indizes: renderItem braucht nur params.dataIndex,
      // aber ECharts zieht die Werte JEDER Serie in die Achsenskalierung ein. Mit Indizes
      // (0..n-1) waere das Achsenmaximum bei 13 Schritten faelschlich 12 statt ~6.
      series.push({type:'custom',silent:true,z:1,data:levels.map(function(v){return (v==null?0:v);}),
        renderItem:function(params,api){
          var i=params.dataIndex;if(i>=levels.length-1||levels[i]==null)return;
          if(w.barHoriz){var qA=api.coord([levels[i],i]),qB=api.coord([levels[i],i+1]),bh=api.size([0,1])[1],hh=bh*0.4;
            return {type:'line',shape:{x1:qA[0],y1:qA[1]+hh,x2:qB[0],y2:qB[1]-hh},style:{stroke:cssv('--faint'),lineWidth:1,lineDash:[4,3]}};}
          var pA=api.coord([i,levels[i]]),pB=api.coord([i+1,levels[i]]),band=api.size([1,0])[0],half=band*0.4;
          return {type:'line',shape:{x1:pA[0]+half,y1:pA[1],x2:pB[0]-half,y2:pB[1]},style:{stroke:cssv('--faint'),lineWidth:1,lineDash:[4,3]}};
        }});
    }
    var axw=_axShow(w);
    var opt={backgroundColor:'transparent',animation:!!bcfg().chartAnim,grid:{left:8,right:10,top:6+_titleSpace(w),bottom:4,containLabel:true},
      title:_titleOpt(w),
      tooltip:{trigger:'axis',axisPointer:{type:'shadow'},formatter:function(ps){
        // Nur den BALKEN (Serie 1) zeigen — NICHT die Basis (0) oder die Verbindungslinie
        // (=laufender Saldo/Zwischensumme). Einzelwert, negative als Absolutwert.
        var p=null;for(var i=0;i<ps.length;i++){if(ps[i].seriesIndex===1){p=ps[i];break;}}
        if(!p)return '';var v=p.value;if(v&&typeof v==='object'&&v.value!=null)v=v.value;
        v=parseFloat(v);if(isNaN(v))return (p.name||'');
        return (p.name||'')+': '+_chNum(w,Math.abs(v));}},
      xAxis:{type:'category',data:cats,axisTick:{show:axw.ticks},axisLine:{show:axw.line,lineStyle:{color:cssv('--line')}},axisLabel:{show:axw.xLab,color:cssv('--faint'),fontSize:_axFs(w),interval:0},splitLine:{show:axw.xGrid,lineStyle:{color:cssv('--line-soft')}}},
      yAxis:{type:'value',name:unit,nameTextStyle:{color:cssv('--muted'),fontSize:_ecF(w,'axname',9)},nameGap:7,axisLine:{show:axw.line,lineStyle:{color:cssv('--line')}},axisTick:{show:axw.ticks},axisLabel:_axLabY(w,axw),splitLine:{show:axw.yGrid,lineStyle:{color:cssv('--line-soft')}}},
      series:series};
    if(w.barHoriz)_hbCat(opt);   // liegende Balken
    ec.setOption(opt,true);
  }
  function initEChart(w,root){
    if(typeof echarts==='undefined')return;
    var el=$('.w[data-id="'+w.id+'"] [data-role=chart]',(root||canvas));if(!el)return;
    _ec[w.id]=echarts.init(el,null,{renderer:'canvas'});
    if(w.type==='gauge'){setGauge(w,_lastVals[w.varId]);}
    else if(w.type==='gaugepro'){setGaugePro(w,_lastVals[w.varId]);}
    else if(w.type==='sankey'){setSankey(w);}
    else if(w.type==='meteogram'){setMeteogram(w);}
    else if(w.type==='multiring'){setMultiring(w);}
    else if(w.type==='waterfall'||w.ctype==='waterfall'){setWaterfall(w);} // Live-Werte, KEINE Historie
    else if(w.ctype==='pie'||w.ctype==='donut'){renderChartData(w);}
    else{ fetchHist(w); } // immer frisch laden (auch ctype 'spark') (Query ~2ms); _hist-Cache ist wegen seiten-kollidierender IDs nicht verlaesslich
  }
  // Per-Zustand-Styling (Ein/Aus) fuer button/tile — IPSView ToggleButton/Value-Button
  function applyBtnState(w,el,on){
    var badge=el.querySelector('[data-role=badge]');
    if(badge&&(w.onIcon||w.offIcon)){var ic=on?(w.onIcon||w.icon):(w.offIcon||w.icon);if(ic)badge.innerHTML=iconSVG(ic,on?1:0);}
    var name=el.querySelector('.hblabel,.htname');
    if(name){var t=on?w.onText:w.offText;name.textContent=(t!=null&&t!=='')?t:(w.label||'');}
    var bg=(on?w.onBg:w.offBg)||'',fg=(on?w.onFg:w.offFg)||'';
    var box=el.querySelector('.hbtn,.htile');if(box)box.style.background=bg;
    if(badge)badge.style.color=fg;if(name)name.style.color=fg;
  }
  function btnStateProps(w){return row('Seite öffnen','<select id="pNavTo">'+viewOpts(w.navTo,'page','— (Variable schalten)')+'</select>')
    +row('Popup öffnen','<select id="pPopupTo">'+viewOpts(w.popupTo,'popup')+'</select>')
    +row('Lang-Druck → Popup','<select id="pLongPop">'+viewOpts(w.longPopup,'popup')+'</select>')
    +row('Lang-Druck → Seite','<select id="pLongNav">'+viewOpts(w.longNav,'page')+'</select>')
    +row('Hover-Ansicht','<select id="pHoverTo"><option value="">—</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.hoverTo===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
    +(w.hoverTo?'<div style="font-size:11px;color:var(--warn);line-height:1.4;margin:-2px 2px 6px">Flyout beim <b>Überfahren mit der Maus</b> (Desktop). Auf Touch öffnet ein Tipp den Flyout nur, wenn keine andere Klick-Aktion gesetzt ist.</div>':'')
    +row('Region setzen','<input id="pRegSlot" value="'+esc(w.regSlot||'')+'" placeholder="Region" style="width:80px"> <select id="pRegView"><option value="">Ansicht…</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.regView===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
    +row('Zurück','<input type="checkbox" id="pNavBack"'+(w.navBack?' checked':'')+'>')
    +row('Menü öffnen','<input type="checkbox" id="pOpenMenu"'+(w.openMenu?' checked':'')+'>')
    +row('Popup schließen','<input type="checkbox" id="pClosePop"'+(w.closePopup?' checked':'')+'>')
    +row('Skript ID','<input id="pScriptId" value="'+(w.scriptId||'')+'" placeholder="bei Klick ausführen">')
    +(w.popupTo?listEditor(w,'alias','Alias: Vorlagen-ID → echte Geräte-ID',[{k:'from',ph:'Vorlage'},{k:'to',ph:'echte ID'}]):'')
    +'<div class="pgh">Zustand Ein / Aus</div>'
    +row('Text','<input id="pOnText" value="'+esc(w.onText||'')+'" placeholder="Ein"> <input id="pOffText" value="'+esc(w.offText||'')+'" placeholder="Aus">')
    +row('Hintergrund','<input id="pOnBg" type="color" value="'+(w.onBg||'#1b2a30')+'"> <input id="pOffBg" type="color" value="'+(w.offBg||'#1b2a30')+'">')
    +row('Textfarbe','<input id="pOnFg" type="color" value="'+(w.onFg||'#e7eef0')+'"> <input id="pOffFg" type="color" value="'+(w.offFg||'#e7eef0')+'">')
    +row('Icon (ID)','<input id="pOnIcon" value="'+esc(w.onIcon||'')+'" placeholder="ein"> <input id="pOffIcon" value="'+esc(w.offIcon||'')+'" placeholder="aus">')
    +row('','<button class="btn" id="pStClr" style="padding:4px 9px">Zustands-Stil zurücksetzen</button>');}
  function btnStateWire(w){function relive(){render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
    if($('#pNavTo'))$('#pNavTo').onchange=function(){w.navTo=this.value||undefined;commit();};
    if($('#pPopupTo'))$('#pPopupTo').onchange=function(){w.popupTo=this.value||undefined;commit();};
    if($('#pHoverTo'))$('#pHoverTo').onchange=function(){w.hoverTo=this.value||undefined;renderProps();commit();};
    if($('#pLongPop'))$('#pLongPop').onchange=function(){w.longPopup=this.value||undefined;commit();};
    if($('#pLongNav'))$('#pLongNav').onchange=function(){w.longNav=this.value||undefined;commit();};
    if($('#pRegSlot'))$('#pRegSlot').oninput=function(){w.regSlot=this.value||undefined;commit();};
    if($('#pRegView'))$('#pRegView').onchange=function(){w.regView=this.value||undefined;commit();};
    if($('#pNavBack'))$('#pNavBack').onchange=function(){w.navBack=this.checked||undefined;commit();};
    if($('#pOpenMenu'))$('#pOpenMenu').onchange=function(){w.openMenu=this.checked||undefined;commit();};
    if($('#pClosePop'))$('#pClosePop').onchange=function(){w.closePopup=this.checked||undefined;commit();};
    if($('#pScriptId'))$('#pScriptId').oninput=function(){w.scriptId=parseInt(this.value)||undefined;commit();};
    function bind(id,prop){var e=$('#'+id);if(e)e.oninput=e.onchange=function(){w[prop]=this.value||undefined;relive();};}
    bind('pOnText','onText');bind('pOffText','offText');bind('pOnBg','onBg');bind('pOffBg','offBg');bind('pOnFg','onFg');bind('pOffFg','offFg');bind('pOnIcon','onIcon');bind('pOffIcon','offIcon');
    if($('#pStClr'))$('#pStClr').onclick=function(){['onText','offText','onBg','offBg','onFg','offFg','onIcon','offIcon'].forEach(function(k){delete w[k];});renderProps();relive();};}
  function fetchEvent(w,root){if(!w.eventId)return;fetch('?api=event&id='+w.eventId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el||!j||j.error)return;
    var nm=$('[data-role=evname]',el);if(nm&&!w.label)nm.textContent=j.name||'Ereignis';
    var sw=$('[data-role=evsw]',el);if(sw)sw.classList.toggle('on',!!j.active);
    var sub=$('[data-role=evsub]',el);if(sub){var parts=[j.active?'aktiv':'inaktiv'];if(j.next>0)parts.push('nächste: '+new Date(j.next*1000).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}));sub.textContent=parts.join(' · ');}
  }).catch(function(){});}
  function fetchObjInfo(w,root){if(!w.objId)return;fetch('?api=objinfo&id='+w.objId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el||!j||j.error)return;
    var nm=$('[data-role=oiname]',el);if(nm&&!w.label)nm.textContent=j.name||'Objekt';
    var vv=$('[data-role=oival]',el);if(!vv)return;var f=w.field||'updated',out='–';
    if(f==='name')out=j.name||'';
    else if(f==='updated'||f==='changed'){var ts=j[f];out=ts>0?new Date(ts*1000).toLocaleString('de-DE'):'–';}
    else if(f==='next'||f==='last'){var t=j[f];out=t>0?new Date(t*1000).toLocaleString('de-DE'):'–';}
    vv.textContent=out;
  }).catch(function(){});}

  // ---- Annotationen -----------------------------------------------------------------
  // Arten und ihre echarts-Entsprechung:
  //   max/min    markPoint type max|min          (Wert + Zeitpunkt aus den Daten)
  //   last/first markPoint auf den Rand-Datenpunkt
  //   avg        markLine  type average          (waagrecht)
  //   value      markLine  auf einen festen Y-Wert (Schwellwert)
  var ANN_KINDS=[['max','Maximum'],['min','Minimum'],['last','Aktueller Wert'],
                 ['first','Erster Wert'],['avg','Mittelwert'],['value','Schwellwert']];
  // Diagrammarten, bei denen Marken sinnvoll sind. Torte, Zeiger, Sankey und die
  // Tageslichtkurve haben keine Datenreihe im ueblichen Sinn - dort waere es Unsinn.
  var ANN_OK={line:1,area:1,areaspline:1,spline:1,bar:1,barstack:1,step:1,steparea:1,scatter:1,waterfall:1};
  function _annText(w,a,p){
    var v=(p?p.value:null);
    if(Object.prototype.toString.call(v)==='[object Array]')v=v[1];
    if(v==null&&p&&p.data&&p.data.coord)v=p.data.coord[1];
    var u=(a.unit!=null&&a.unit!=='')?a.unit:'';
    var s=_chNum(w,v,false);
    var t=(a.text||'').trim();
    if(!t)return s+(u?(' '+u):'');
    return t.replace(/\{v\}/g,s).replace(/\{u\}/g,u).replace(/\{n\}/g,String((p&&p.seriesName)||''));
  }
  function _annLbl(w,a,col){
    return {fontSize:_ecF(w,'label',9),color:(_skinToCss(w.annFg)||'#ffffff'),
            backgroundColor:col,padding:[2,5],borderRadius:4,
            formatter:function(p){return _annText(w,a,p);}};
  }
  function _annApply(w,series){
    var list=w.anns||[];
    if(!list.length)return;
    list.forEach(function(a){
      if(!a||a.off)return;
      var i=Math.min(Math.max((parseInt(a.ser)||1)-1,0),series.length-1);
      var sr=series[i];if(!sr)return;
      var col=_skinToCss(a.color)||cssv('--accent');
      var st=a.style||'pin',wantMark=(st!=='line'),wantLine=(st==='line'||st==='both');
      var lbl=_annLbl(w,a,col);
      function ml(){return sr.markLine=sr.markLine||{silent:true,symbol:'none',data:[]};}
      function mp(){return sr.markPoint=sr.markPoint||{silent:true,symbol:'pin',symbolSize:34,data:[]};}
      if(a.kind==='avg'){
        ml().data.push({type:'average',lineStyle:{color:col,type:'dashed',width:1},label:lbl});return;
      }
      if(a.kind==='value'){
        var yv=parseFloat(String(a.val==null?'':a.val).replace(',','.'));
        if(isNaN(yv))return;
        ml().data.push({yAxis:yv,lineStyle:{color:col,type:'dashed',width:1},label:lbl});return;
      }
      if(wantMark){
        if(a.kind==='max'||a.kind==='min'){
          mp().data.push({type:a.kind,itemStyle:{color:col},label:lbl});
        }else{
          var d=sr.data||[];if(!d.length)return;
          mp().data.push({coord:(a.kind==='first'?d[0]:d[d.length-1]),itemStyle:{color:col},label:lbl});
        }
      }
      if(wantLine&&(a.kind==='max'||a.kind==='min')){
        ml().data.push({type:a.kind,lineStyle:{color:col,width:1,opacity:.55},label:{show:false}});
      }
    });
  }

  // Kalenderjahr-Modus (Jaen-Dez-Monatsbalken) HAENGT ALLEIN am Zeitraum: cal-Flag UND
  // Einheit Monat. Frueher entschied die Zeichnung nach den Alt-Feldern w.calYear/w.agg,
  // die Datenabfrage aber nach w.range - kopierte man einen Jahreschart und stellte ihn auf
  // "7 Tage", zeigte die Achse weiter Monate und es kam nichts an. Jetzt entscheidet beides
  // ueber dieselbe Funktion.
  function _chCalMode(w){var r=_chRange(w);return !!r.cal && r.unit==='month';}
  function renderChartData(w){if(w.ctype==='daylight')setDaylight(w);else if(w.ctype==='heatmap')setHeatmap(w);else if(w.ctype==='barrace')setBarRace(w);else if(w.ctype==='spark'||w.type==='spark')setSpark(w);else if(w.ctype==='waterfall'||w.type==='waterfall')setWaterfall(w);else if(w.ctype==='pie'||w.ctype==='donut'||w.ctype==='rose')setPie(w);else if(w.type==='chart'&&_chCalMode(w))setCalBar(w);else setLine(w);}
  // ---- Bar Race (ctype 'barrace') — animierter Balken-Wettlauf ueber die Zeit ----------
  // Jede konfigurierte Serie ist ein "Laeufer". Frames = Zeit-Buckets der aggregierten
  // Historie (aus fetchHist). ECharts realtimeSort ordnet die Balken je Frame neu und
  // animiert die Umsortierung. Ein eigener Timer schaltet die Frames weiter (Cleanup in
  // disposeCharts + stopRace). Optional kumuliert (Running Total) fuer den "Wachstums"-Effekt.
  function stopRace(w){if(_chAnim[w.id]){clearInterval(_chAnim[w.id]);delete _chAnim[w.id];}}
  function _raceTimeFmt(times){
    var span=times[times.length-1]-times[0], D=864e5;
    return function(t){var d=new Date(t);
      if(span>300*D)return d.toLocaleDateString('de-DE',{month:'short',year:'2-digit'});
      if(span>2*D)  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
      return d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    };
  }
  function _raceClock(txt){return {elements:[{type:'text',right:12,bottom:8,z:100,silent:true,
    style:{text:txt,fontSize:24,fontWeight:700,fill:cssv('--muted'),opacity:.5}}]};}
  // Live-Modus: Balken = AKTUELLE Live-Werte der Serien (verschiedene Kategorien),
  // Umsortierung in Echtzeit bei jedem Update (kein Zeit-Replay). Datenquelle _lastVals
  // (Serien-IDs werden ohnehin fuer Live gesammelt, s. _collectIds 'series').
  function _raceLiveData(w){
    var cols=[cssv('--accent'),cssv('--info'),cssv('--warm')];
    return _chSeries(w).filter(function(s){return s&&s.vid;}).map(function(s,i){
      var lv=_lastVals[s.vid],v=lv?parseFloat(String(lv.v).replace(',','.')):NaN;
      return {name:s.name||('Serie '+(i+1)),color:(_skinToCss(s.color)||cols[i%cols.length]),val:isNaN(v)?0:v};
    });
  }
  function _raceBars(R){return R.map(function(r){return {value:Math.round(r.val*100)/100,itemStyle:{color:r.color}};});}
  function setBarRaceLive(w){
    var ec=_ec[w.id];if(!ec)return; stopRace(w);
    var axw=_axShow(w);
    var R=_raceLiveData(w);
    if(R.length<1){ec.setOption({backgroundColor:'transparent',title:{text:'Bar Race (Live): Serien wählen',left:'center',top:'middle',textStyle:{color:cssv('--muted'),fontSize:12}},xAxis:{show:false},yAxis:{show:false},series:[]},true);return;}
    var topN=(w.brTop!=null&&w.brTop!==''?Math.max(3,Math.min(30,+w.brTop)):10);
    var upd=(w.brSpeed!=null&&w.brSpeed!==''?Math.max(150,Math.min(4000,+w.brSpeed)):600);
    var rad=(w.barRadius!=null?+w.barRadius:4);
    ec.setOption({backgroundColor:'transparent',title:_titleOpt(w),
      animationDuration:300,animationDurationUpdate:upd,animationEasing:'cubicOut',animationEasingUpdate:'cubicOut',
      grid:{left:8,right:70,top:12+_titleSpace(w),bottom:8,containLabel:true},
      tooltip:{trigger:'axis',axisPointer:{type:'none'},confine:true,valueFormatter:function(v){return _chNum(w,v,true);}},
      xAxis:{type:'value',max:'dataMax',splitNumber:(w.gridDivs>0?+w.gridDivs:undefined),
        axisLine:{show:axw.line,lineStyle:{color:cssv('--line')}},axisTick:{show:axw.ticks},
        axisLabel:{show:axw.xLab,color:cssv('--muted'),fontSize:_axFs(w),formatter:function(v){return _chNum(w,v);}},
        splitLine:{show:axw.xGrid,lineStyle:{color:cssv('--line'),opacity:.35}}},
      yAxis:{type:'category',data:R.map(function(r){return r.name;}),inverse:true,max:Math.min(topN,R.length)-1,animationDuration:300,animationDurationUpdate:upd,
        axisLabel:{show:axw.yLab,color:cssv('--text'),fontSize:_axFs(w)},axisTick:{show:axw.ticks},axisLine:{show:axw.line,lineStyle:{color:cssv('--line')}},splitLine:{show:axw.yGrid,lineStyle:{color:cssv('--line-soft')}}},
      series:[{type:'bar',realtimeSort:true,data:_raceBars(R),itemStyle:{borderRadius:rad},
        label:{show:true,position:'right',valueAnimation:true,fontSize:_ecF(w,'label',11),color:cssv('--text'),formatter:function(p){return _chNum(w,p.value,true);}}}],
      graphic:{elements:[{type:'text',right:12,bottom:8,z:100,silent:true,style:{text:'live',fontSize:13,fontWeight:700,fill:(cssv('--ok')||cssv('--accent')),opacity:.6}}]}
    },true);
  }
  // Live-Update (Merge): nur die Balkenwerte neu setzen -> realtimeSort animiert die Umsortierung.
  function _raceLiveTick(w){var ec=_ec[w.id];if(!ec)return;ec.setOption({series:[{data:_raceBars(_raceLiveData(w))}]});}

  function setBarRace(w){
    var ec=_ec[w.id];if(!ec)return; stopRace(w);
    if(w.brLive){setBarRaceLive(w);return;}     // Live-Werte statt Zeit-Replay
    var axw=_axShow(w);
    var cols=[cssv('--accent'),cssv('--info'),cssv('--warm')];
    var hs=chartSeries(w).filter(function(s){return s&&s.data&&s.data.length;});
    var tset={}; hs.forEach(function(s){s.data.forEach(function(p){tset[p[0]]=1;});});
    var times=Object.keys(tset).map(Number).sort(function(a,b){return a-b;});
    if(hs.length<2||times.length<2){
      ec.setOption({backgroundColor:'transparent',
        title:{text:'Bar Race: ≥2 Serien mit Verlauf nötig',left:'center',top:'middle',textStyle:{color:cssv('--muted'),fontSize:12}},
        xAxis:{show:false},yAxis:{show:false},series:[]},true);
      return;
    }
    // Frames deckeln (bei Rohdaten koennten es tausende sein) -> gleichmaessig auf max 80.
    var MAXF=80;
    if(times.length>MAXF){var st=times.length/MAXF,t2=[];for(var k=0;k<MAXF;k++)t2.push(times[Math.floor(k*st)]);t2.push(times[times.length-1]);times=t2;}
    var cum=(w.brCumul===true);
    var runners=hs.map(function(s,i){
      var di=0,acc=0,last=0,d=s.data;
      var vals=times.map(function(t){ while(di<d.length&&d[di][0]<=t){var v=+d[di][1]||0;if(cum)acc+=v;else last=v;di++;} return cum?acc:last; });
      return {name:s.name||('Serie '+(i+1)),color:(_skinToCss(s.color)||cols[i%cols.length]),vals:vals};
    });
    var topN=(w.brTop!=null&&w.brTop!==''?Math.max(3,Math.min(30,+w.brTop)):10);
    var frameMs=(w.brSpeed!=null&&w.brSpeed!==''?Math.max(150,Math.min(4000,+w.brSpeed)):700);
    var loop=(w.brLoop!==false), rad=(w.barRadius!=null?+w.barRadius:4);
    var names=runners.map(function(r){return r.name;}), fmtT=_raceTimeFmt(times);
    function frame(fi){return runners.map(function(r){return {value:Math.round((r.vals[fi]||0)*100)/100,itemStyle:{color:r.color}};});}
    ec.setOption({
      backgroundColor:'transparent',title:_titleOpt(w),
      animationDuration:0,animationDurationUpdate:frameMs,animationEasing:'linear',animationEasingUpdate:'linear',
      grid:{left:8,right:70,top:12+_titleSpace(w),bottom:8,containLabel:true},
      tooltip:{trigger:'axis',axisPointer:{type:'none'},confine:true,valueFormatter:function(v){return _chNum(w,v,true);}},
      xAxis:{type:'value',max:'dataMax',splitNumber:(w.gridDivs>0?+w.gridDivs:undefined),
        axisLine:{show:axw.line,lineStyle:{color:cssv('--line')}},axisTick:{show:axw.ticks},
        axisLabel:{show:axw.xLab,color:cssv('--muted'),fontSize:_axFs(w),formatter:function(v){return _chNum(w,v);}},
        splitLine:{show:axw.xGrid,lineStyle:{color:cssv('--line'),opacity:.35}}},
      yAxis:{type:'category',data:names,inverse:true,max:Math.min(topN,names.length)-1,animationDuration:300,animationDurationUpdate:frameMs,
        axisLabel:{show:axw.yLab,color:cssv('--text'),fontSize:_axFs(w)},axisTick:{show:axw.ticks},axisLine:{show:axw.line,lineStyle:{color:cssv('--line')}},splitLine:{show:axw.yGrid,lineStyle:{color:cssv('--line-soft')}}},
      series:[{type:'bar',realtimeSort:true,data:frame(0),itemStyle:{borderRadius:rad},
        label:{show:true,position:'right',valueAnimation:true,fontSize:_ecF(w,'label',11),color:cssv('--text'),formatter:function(p){return _chNum(w,p.value,true);}}}],
      graphic:_raceClock(fmtT(times[0]))
    },true);
    var fi=0;
    _chAnim[w.id]=setInterval(function(){
      if(!_ec[w.id]){stopRace(w);return;}
      fi++; if(fi>=times.length){ if(!loop){stopRace(w);return;} fi=0; }
      _ec[w.id].setOption({series:[{data:frame(fi)}],graphic:_raceClock(fmtT(times[fi]))});
    },frameMs);
  }
  function setPie(w){var ec=_ec[w.id];if(!ec)return;var ids=[w.varId,w.varId2,w.varId3].filter(function(x){return x;});
    var data=ids.map(function(id,i){var o=(w.sopt&&w.sopt[i])||{};var lv=_lastVals[id],v=lv?parseFloat(String(lv.v).replace(',','.')):0;if(isNaN(v))v=0;return {name:o.name||(i===0?(w.label||'Serie 1'):'Serie '+(i+1)),value:Math.max(0,v),itemStyle:{color:o.color||autoColorHex(i)}};});
    var donut=(w.ctype==='donut'),rose=(w.ctype==='rose');
    var tSp=_titleSpace(w),lpP=w.legend?(w.legPos||'bottom'):'';
    // Mittelpunkt nach unten schieben, wenn Titel oben Platz braucht bzw. Legende oben/unten sitzt
    var cy=50+(tSp?5:0)+(lpP==='top'?4:0)-(lpP==='bottom'?5:0);
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,tooltip:{trigger:'item',valueFormatter:function(v){return _chNum(w,v);}},
      title:_titleOpt(w),
      legend:_legendOpt(w,w.legend),
      series:[{type:'pie',roseType:(rose?'radius':false),radius:rose?['22%','74%']:(donut?['46%','72%']:'70%'),center:['50%',cy+'%'],data:data,
        label:{color:cssv('--text'),fontSize:_ecF(w,'label',10),formatter:(w.labels?'{b}\n{d}%':'{d}%')},labelLine:{length:6,length2:6,lineStyle:{color:cssv('--line')}},
        itemStyle:{borderColor:cssv('--bg'),borderWidth:2,borderRadius:((donut||rose)?3:0)},minAngle:3}]},true);}
  function chartSeries(w){return (_hist[w.id]&&_hist[w.id].series)?_hist[w.id].series:[];}
  // Sparkline (ctype 'spark') — kompakte Verlaufskurve: keine Achsen, kein Titel, keine Legende.
  // Linienfarbe: w.lineColor (feste Skin-Liste); Zweitquelle ist die Serien-Farbe series[0].color.
  // Fuellung: w.fill!==false (undefined = an). Es wird NUR die erste Serie gezeichnet.
  // Serienstil ist bewusst hart verdrahtet (Breite 1.8, glatt, ohne Punkte) — w.lw/w.smooth gelten hier nicht.
  function setSpark(w){
    var ec=_ec[w.id];if(!ec)return;
    var _cs=(w.series&&w.series[0]&&w.series[0].color)||'';                 // Merge-Fallback: Farbe aus dem Serien-Editor
    var _lc=_skinColor(w.lineColor||_cs||''),_m=_lc&&_lc.match(/^var\((--[\w-]+)\)$/),acc=_m?cssv(_m[1]):(_lc||cssv('--accent'));
    var s0=chartSeries(w)[0]||{data:[]};var data=s0.data;
    var ser={type:'line',showSymbol:false,smooth:true,lineStyle:{color:acc,width:1.8},
      data:data,markPoint:{silent:true,symbol:'circle',symbolSize:5,itemStyle:{color:acc},label:{show:false},data:data.length?[{coord:data[data.length-1]}]:[]}};
    if(w.fill!==false)ser.areaStyle={color:accA(.16,acc)};
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,grid:{left:2,right:2,top:6,bottom:4},
      tooltip:{trigger:'axis',confine:true,valueFormatter:function(v){return _chNum(w,v);}},
      xAxis:{type:'time',show:false},yAxis:{type:'value',scale:true,show:false},
      series:[ser]},true);
  }
  function _glowCol(col,a){col=(''+(col||'')).trim();var m=col.match(/^#([0-9a-fA-F]{6})$/);if(m){var n=parseInt(m[1],16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}m=col.match(/rgba?\(([^)]+)\)/);if(m){var p=m[1].split(',');return 'rgba('+(+p[0])+','+(+p[1])+','+(+p[2])+','+a+')';}return col;} // Farbe mit Alpha (für Glow)
  function setGauge(w,d){
    var ec=_ec[w.id];if(!ec)return;var raw=d?d.v:null,val=d?parseFloat(d.v):0;if(isNaN(val))val=0;
    var _sc=(w.scale!=null&&w.scale!==''&&+w.scale!==1)?(+w.scale):1;val=val*_sc; // universeller Faktor (skaliert Wert + Skala mit)
    var mn=(w.min!=null?w.min:0)*_sc,mx=(w.max!=null?w.max:100)*_sc;
    var style=w.gstyle||'classic',cmode=w.gcolor||'accent';
    if(cmode==='assoc'&&w.varId&&!_assocData[w.varId]){loadAssoc(w.varId,function(){setGauge(w,d);});}
    var t1=(w.t1!=null?w.t1:mn+(mx-mn)*0.6),t2=(w.t2!=null?w.t2:mn+(mx-mn)*0.85);
    var f1=Math.max(0,Math.min(1,(t1-mn)/((mx-mn)||1))),f2=Math.max(f1,Math.min(1,(t2-mn)/((mx-mn)||1)));
    function zoneCol(v){return v<=t1?cssv('--ok'):(v<=t2?cssv('--warm'):cssv('--crit'));}
    var fillCol=(cmode==='graded')?zoneCol(val):(function(){if(cmode==='assoc'&&w.varId&&_assocData[w.varId]){var a=assocFor(w,raw);if(a){var rr=assocResolved(w,a);if(rr.color)return rr.color;}}return cssv('--'+((cmode&&cmode!=='graded'&&cmode!=='assoc')?cmode:'accent'));})();
    var ANG={classic:[225,-45],half:[180,0],ring:[90,-270],halfring:[180,0]}[style]||[225,-45];
    if(w.gstart!=null&&w.gend!=null&&w.gstart!==''&&w.gend!=='')ANG=[parseFloat(w.gstart),parseFloat(w.gend)];
    var isFill=(style==='ring'||style==='halfring'),isHalf=(style==='half'||style==='halfring');
    var center=isHalf?['50%','72%']:(style==='ring'?['50%','52%']:['50%','55%']);
    var radius=isHalf?'96%':(style==='ring'?'82%':'92%');
    var detOff=isHalf?[0,'-14%']:(style==='ring'?[0,'0%']:[0,'38%']);
    var titOff=isHalf?[0,'14%']:(style==='ring'?[0,'40%']:[0,'72%']);
    var width=isFill?13:11;
    var ser={type:'gauge',min:mn,max:mx,startAngle:ANG[0],endAngle:ANG[1],center:center,radius:radius,
      axisTick:{show:!!w.gticks,distance:2,splitNumber:4,length:4,lineStyle:{color:cssv('--faint'),width:1}},splitLine:{show:!!w.gticks,length:8,lineStyle:{color:cssv('--faint'),width:1}},axisLabel:{show:!!w.gticks,color:cssv('--faint'),fontSize:_ecF(w,'axis',8),distance:12},anchor:{show:!!w.gknob,showAbove:true,size:9,itemStyle:{color:cssv('--text')}},
      title:{show:!!w.label,offsetCenter:titOff,color:cssv('--muted'),fontSize:_ecF(w,'label',10)},
      detail:{show:(w.gvShow!==false),valueAnimation:true,fontSize:(w.gvsz||(isFill?20:19)),fontWeight:(w.gvfwt||'normal'),fontStyle:(w.gvsty||'normal'),fontFamily:(w.gvff||'ui-monospace,monospace'),offsetCenter:detOff,color:cssv('--text'),formatter:((w.dec!=null||(w.gvUnit!=null&&w.gvUnit!==''))?function(v){var hasU=(w.gvUnit!=null&&w.gvUnit!=='');var num=(w.dec!=null)?(isNaN(v)?v:_fmtNum(Number(v),{dec:w.dec,thousand:w.thousand,numAbbrev:w.numAbbrev})):(hasU?((d&&d.v!=null)?String(d.v).replace('.',','):v):((d&&d.f)?String(d.f):v));var u=hasU?w.gvUnit:((w.dec!=null&&d&&d.u)?String(d.u):'');return num+u;}:((d&&d.f)?String(d.f):'{value}'))},
      data:[{value:val,name:w.label||''}]};
    if(cmode==='graded'&&!isFill){ // Zonen entlang des Bogens, Zeiger zeigt Wert
      ser.axisLine={lineStyle:{width:width,color:[[f1,cssv('--ok')],[f2,cssv('--warm')],[1,cssv('--crit')]]}};
      ser.progress={show:false};
      ser.pointer={show:true,width:4,length:'60%',itemStyle:{color:cssv('--text')}};
    }else{ // moderner gefüllter Bogen (Donut), kein Zeiger, superleichter Glow
      ser.axisLine={lineStyle:{width:width,color:[[1,cssv('--line')]]}};
      ser.progress={show:true,width:width,roundCap:true,itemStyle:{color:fillCol,shadowBlur:8,shadowColor:_glowCol(fillCol,0.45)}};
      ser.pointer={show:false};
    }
    ec.setOption({animation:!!bcfg().chartAnim,series:[ser]},true);
  }
  function autoColorHex(i){return [cssv('--accent'),cssv('--info'),cssv('--warm')][i%3]||'#00cdab';}
  function _legendOpt(w,on){ // Legende inkl. Position (top/bottom/left/right) — von setLine & setCalBar genutzt
    if(!on)return {show:false};
    var p=w.legPos||'top',o={show:true,textStyle:{color:cssv('--muted'),fontSize:_ecF(w,'legend',9)},itemWidth:11,itemHeight:8,orient:(p==='left'||p==='right')?'vertical':'horizontal'};
    if(p==='top')o.top=0;else if(p==='bottom')o.bottom=0;else if(p==='left'){o.left=0;o.top='middle';}else{o.right=4;o.top='middle';}
    return o;}
  // ---- Anzeige-Optionen zentral (setLine und setCalBar nutzen dieselben Regeln) ----
  function _axShow(w){return {line:!!w.axLine,ticks:!!w.axTicks,xLab:(w.xLabels!==false),yLab:(w.yLabels!==false),
    xGrid:!!w.xgrid,yGrid:(w.ygrid!==false)};}
  // ---- Schriftgrößen je Textart -----------------------------------------------------------
  // Jede Textart kann einzeln fest gesetzt werden; ohne Wert wächst sie mit der Kachel (_ecFS)
  // und folgt der zentralen Typografie (w.fsz). Alle Renderer MÜSSEN _ecF() benutzen, damit
  // die Einstellungen für jeden Diagrammtyp gleich wirken.
  var _EC_FS={title:'fsTitle',legend:'fsLegend',axis:'axFs',axname:'fsAxName',label:'fsLabel'};
  function _ecF(w,kind,base){var k=_EC_FS[kind],v=(w&&k)?w[k]:null;return (v>0)?parseFloat(v):_ecFS(w,base);}
  // Schriftart der zentralen Typografie (w.ff) fuer den ECharts-Canvas aufloesen (var(--x) -> echter Wert)
  function _ecFF(w){var f=(w&&w.ff)||'';if(!f){var d=(cssv('--fu')||'').trim();return d||null;}var m=/^var\((--[\w-]+)\)$/.exec(f);if(m){var r=(cssv(m[1])||'').trim();return r||null;}return f;}
  // ---- Zahlformat fuer Datenlabels und Tooltips ---------------------------------------------
  // Nachkommastellen aus w.dec (leer = automatisch nach Groessenordnung), Einheit aus w.chUnit
  // (Wasserfall faellt auf seine eigene Einheit zurueck). Dezimaltrennzeichen ist das Komma.
  function _chUnit(w){var u=(w&&w.chUnit!=null&&w.chUnit!=='')?w.chUnit:((w&&(w.ctype==='waterfall'||w.type==='waterfall'))?_wfUnit(w):'');return u||'';}
  function _chDec(w,v){
    if(w&&w.dec!=null&&w.dec!=='')return Math.max(0,Math.min(6,parseInt(w.dec)));
    // Automatisch: grosse Zahlen ohne Nachkommastellen, kleine hoechstens eine. Alles
    // andere ueberladen den Tooltip mit Scheingenauigkeit (1789,2166084... W).
    var a=Math.abs(v||0);
    if(a>=100)return 0;
    if(a>=10)return (a===Math.round(a))?0:1;   // 42 -> 42, 42,3 -> 42,3
    if(a>=1) return 1;
    return (a===0)?0:1;                          // 0,2 -> 0,2 ; genau 0 -> 0
  }
  function _chNum(w,v,withUnit){
    if(v==null||isNaN(v))return '–';
    var neg=v<0, a=Math.abs(Number(v)), s=a.toFixed(_chDec(w,v));
    var parts=s.split('.'); parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.'); // Tausenderpunkt
    s=(neg?'-':'')+parts.join(',');
    var u=(withUnit===false)?'':_chUnit(w);
    return u?(s+' '+u):s;
  }
  function _axFs(w){return _ecF(w,'axis',9);}   // Kurzform für die Achsen-Skalenwerte

  // ===== Achsenbeschriftung: DICHTE und FORMAT sind getrennte Fragen ===================
  // Dichte  = wie viele Beschriftungen erscheinen (sonst ueberschreiben sie sich)
  // Format  = wie sie geschrieben werden (Zeitmuster bzw. Zahlenformat)
  // Beide Achsen folgen derselben Struktur, damit man es nur einmal lernen muss.
  // hideOverlap laeuft IMMER mit: Auch ohne jede Einstellung darf sich nie etwas
  // ueberschreiben - echarts laesst dann lieber eine Beschriftung weg.
  var _AXN={
    D:['So','Mo','Di','Mi','Do','Fr','Sa'],
    l:['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'],
    M:['Jän','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
    F:['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  };
  // Zeitmuster in PHP-Schreibweise - dieselbe, die in Symcon-Skripten ohnehin benutzt wird
  // (H:i, d.m., D H:i ...). Ein Backslash schuetzt ein Zeichen vor der Ersetzung.
  function _axTime(pat,ts){
    var d=new Date(ts),p=function(n){return ('0'+n).slice(-2);},out='';
    for(var i=0;i<pat.length;i++){
      var c=pat.charAt(i);
      if(c==='\\'){out+=(pat.charAt(++i)||'');continue;}
      switch(c){
        case 'd':out+=p(d.getDate());break;      case 'j':out+=d.getDate();break;
        case 'm':out+=p(d.getMonth()+1);break;   case 'n':out+=(d.getMonth()+1);break;
        case 'Y':out+=d.getFullYear();break;     case 'y':out+=p(d.getFullYear()%100);break;
        case 'H':out+=p(d.getHours());break;     case 'G':out+=d.getHours();break;
        case 'i':out+=p(d.getMinutes());break;   case 's':out+=p(d.getSeconds());break;
        case 'D':out+=_AXN.D[d.getDay()];break;  case 'l':out+=_AXN.l[d.getDay()];break;
        case 'M':out+=_AXN.M[d.getMonth()];break;case 'F':out+=_AXN.F[d.getMonth()];break;
        default:out+=c;
      }
    }
    return out;
  }
  function _axThou(s){var a=s.split('.');a[0]=a[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');return a.join(',');}
  function _axNumFmt(w){
    var m=w.yFmt||'auto',dec=(w.yDec!=null&&w.yDec!=='')?Math.max(0,Math.min(6,parseInt(w.yDec))):null;
    var suf=w.yUnitLab?(' '+(w.yunit||'')):'';
    return function(v){
      if(v==null||isNaN(v))return '';
      var n=Number(v),a=Math.abs(n),s,pre='';
      if(m==='compact'){
        // Der Vorsatz gehoert an die Einheit, nicht als eigenes Wort: "1,2 kW", nicht
        // "1,2 k W". Unterhalb von tausend bleibt die normale Nachkommalogik - sonst
        // wuerde aus 0,5 eine 1.
        if(a>=1e6)      {s=(n/1e6).toFixed(dec==null?1:dec).replace('.',',');pre='M';}
        else if(a>=1e3) {s=(n/1e3).toFixed(dec==null?1:dec).replace('.',',');pre='k';}
        else            s=n.toFixed(dec==null?_chDec(w,n):dec).replace('.',',');
      }else{
        s=n.toFixed(dec==null?_chDec(w,n):dec);
        s=(m==='thousand')?_axThou(s):s.replace('.',',');
      }
      // Ohne Einheit steht der Vorsatz allein ("1,2 k"), mit Einheit verschmilzt er ("1,2 kW").
      return s+(pre?((suf?(' '+pre+(w.yunit||'')):(' '+pre))):suf);
    };
  }
  function _axHasNumFmt(w){return !!(w.yFmt&&w.yFmt!=='auto')||!!w.yUnitLab||(w.yDec!=null&&w.yDec!=='');}
  // Zeitachse: Dichte ueber splitNumber (echarts waehlt die Stuetzstellen selbst, bekommt
  // aber eine Zielanzahl). Kategorieachse: interval, weil dort jeder Eintrag eine Stelle ist.
  function _axLabX(w,ax,cat){
    var o={show:ax.xLab,color:cssv('--faint'),fontSize:_axFs(w),hideOverlap:true};
    if(w.xFmt)o.formatter=function(v){return _axTime(w.xFmt,v);};
    if(cat&&w.xTickMode==='every'&&w.xTicks>1)o.interval=parseInt(w.xTicks)-1;
    return o;
  }
  function _axSplitX(w){return (w.xTickMode==='count'&&w.xTicks>0)?parseInt(w.xTicks):null;}
  // Jede Y-Achse traegt eine andere Groesse - links Verbrauch in kWh, rechts Leistung in W.
  // Ein gemeinsames Format waere dort zwangslaeufig fuer eine der beiden falsch. Deshalb:
  // Widget-Einstellung als Vorgabe, Achseneinstellung schlaegt sie.
  function _axLabY(w,ax,a){
    var o={show:ax.yLab,color:cssv('--faint'),fontSize:_axFs(w)};
    // Nur Format und Nachkommastellen sind achsenspezifisch. Der Achsenname ist eine
    // UEBERSCHRIFT, keine Einheit - ihn an jeden Skalenwert zu haengen ergaebe
    // "3,0 Verbrauch (kWh)". Einheit bleibt daher Sache der Widget-Einstellung.
    var eff=(a&&(a.fmt||(a.dec!=null&&a.dec!=='')))
      ? {yFmt:(a.fmt||w.yFmt),yDec:((a.dec!=null&&a.dec!=='')?a.dec:w.yDec),
         yUnitLab:w.yUnitLab,yunit:w.yunit,dec:w.dec}
      : w;
    if(_axHasNumFmt(eff))o.formatter=_axNumFmt(eff);
    return o;
  }

  function _titleOn(w){var t=(w.showTitle!=null)?w.showTitle:(!w.legend&&!!w.label);return !!(t&&(w.label||'')!=='');}
  function _titleOpt(w){
    if(!_titleOn(w))return {show:false};
    // "\n" (getippt als Backslash-n) bzw. CR/LF -> echter Zeilenumbruch (ECharts bricht bei \n).
    var _tt=String(w.label||'').replace(/\\n|\r\n|\r|\n/g,'\n');
    var o={text:_tt,top:2,textStyle:{color:cssv('--muted'),fontSize:_ecF(w,'title',11),fontWeight:'normal',lineHeight:_ecF(w,'title',11)+3}};
    var p=w.titlePos||'left';
    if(p==='center')o.left='center';else if(p==='right')o.right=6;else o.left=4;
    return o;}
  function _titleSpace(w){return _titleOn(w)?18:0;} // Platz im Grid reservieren, sonst überlappt der Titel
  // ---- Liegende Balken: Achsen tauschen (Kategorie/Zeit -> y, Wert -> x) ----
  function _hbShowEnds(ax){if(!ax)return;ax.axisLabel=ax.axisLabel||{};ax.axisLabel.showMinLabel=true;ax.axisLabel.showMaxLabel=true;} // erste+letzte Rubrik immer beschriften
  // _hbCat: kategoriebasierte Balken (Wasserfall/Kalender) — Daten sind 1D (Index), nur Achsen tauschen.
  function _hbCat(opt){var x=opt.xAxis,y=opt.yAxis;opt.xAxis=y;opt.yAxis=x;if(opt.yAxis){opt.yAxis.inverse=true;_hbShowEnds(opt.yAxis);}
    (opt.series||[]).forEach(function(s){if(s.label&&s.label.position==='top')s.label.position='right';});}
  // _hbLine: Zeitreihen-Balken — Datenpaare [t,v] -> [v,t], Achsen + Achsindex tauschen; Wertachsen links/rechts -> unten/oben.
  // Beschriftung eines Zeit-Buckets fuer die Kategorie-Achse liegender Balken (Tag/Monat/Jahr/Stunde)
  function _hbCatLabel(ts,w){
    var ms=(typeof ts==='number'&&ts<1e12)?ts*1000:ts,d=new Date(ms);if(isNaN(d.getTime()))return String(ts);
    var u=(w.range&&w.range.unit)||'day';
    var WD=['So','Mo','Di','Mi','Do','Fr','Sa'],ML=['Jän','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    if(u==='month')return ML[d.getMonth()];
    if(u==='year')return String(d.getFullYear());
    if(u==='hour'||u==='min'||u==='raw')return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
    return WD[d.getDay()]+' '+d.getDate()+'.';
  }
  // _hbLine: liegende Balken -> KATEGORIE-Achse aus den Zeit-Buckets. Feste, gleichmaessige Baender
  // (gruppierte Balken je Bucket) statt vieler Zeitpositionen -> passt IMMER in die Widget-Hoehe,
  // Tages-Labels erscheinen nur einmal. Wertachse(n) wandern nach unten/oben.
  function _hbLine(opt,w){
    var vax=opt.yAxis;
    var vArr=Array.isArray(vax)?vax:[vax], nB=0,nT=0;
    vArr.forEach(function(a){if(a&&a.position==='right')nT++;else nB++;});
    var cats=null;
    (opt.series||[]).some(function(s){if(s.data&&s.data.length&&Array.isArray(s.data[0])){cats=s.data.map(function(p){return _hbCatLabel(p[0],w);});return true;}return false;});
    opt.xAxis=vax;
    opt.yAxis={type:'category',data:cats||[],inverse:true,
      axisLine:{show:false,lineStyle:{color:cssv('--line')}},axisTick:{show:false},
      axisLabel:{color:cssv('--muted'),fontSize:_ecF(w,'axis',9),hideOverlap:true},splitLine:{show:false}};
    var iB=0,iT=0;
    vArr.forEach(function(a){if(!a)return;if(a.position==='right'){a.position='top';a.offset=(iT++)*34;}else{a.position='bottom';a.offset=(iB++)*34;}});
    var lp=w.legend?(w.legPos||'top'):'';
    opt.grid={left:6+(lp==='left'?60:0),right:8+(lp==='right'?60:0),
      top:6+_titleSpace(w)+(lp==='top'?20:0)+Math.max(0,nT-1)*34,
      bottom:(w.zoom?34:16)+(lp==='bottom'?18:0)+Math.max(0,nB-1)*34,containLabel:true};
    (opt.series||[]).forEach(function(s){
      if(s.data&&s.data.length&&Array.isArray(s.data[0]))s.data=s.data.map(function(p){return p[1];}); // Kategorie = Index -> nur Wert
      if(s.yAxisIndex!=null){s.xAxisIndex=s.yAxisIndex;delete s.yAxisIndex;}
      if(s.label&&s.label.position==='top')s.label.position='right';});
    if(opt.dataZoom)opt.dataZoom.forEach(function(z){if(z.type==='inside'){z.yAxisIndex=0;delete z.xAxisIndex;}else{z.orient='vertical';z.yAxisIndex=0;z.width=13;z.right=4;delete z.height;delete z.bottom;z.top=6+_titleSpace(w);}});}
  function setLine(w){
    var ec=_ec[w.id];if(!ec)return;var ct=w.ctype||'area',hs=chartSeries(w),defs=_chSeries(w);
    var forceStack=(ct==='barstack'),stacked=(w.stack||forceStack),anyBar=false,yaxes=_chYAxes(w);
    // Gemischt = mindestens ein Balken UND mindestens etwas anderes. Nur dann greift die
    // Stapelung ausschliesslich auf die Balken (siehe _mkSer).
    var _kinds={};hs.forEach(function(s,i){_kinds[_resolveType((defs[i]&&defs[i].type)||ct).kind]=1;});
    var _mixed=(!!_kinds.bar&&(!!_kinds.line||!!_kinds.scatter));
    var lbl=w.labels?{show:true,fontSize:_ecF(w,'label',9),color:cssv('--muted'),position:'top'}:{show:false};
    function _rt(d){return (d&&d.type)?d.type:ct;} // effektiver Typ: Serie-Override oder Chart-Default (Mixed-Chart)
    var series=hs.map(function(s,i){
      var d=defs[i]||{},col=_chColor(d.color,i),nm=d.name||s.name||(i===0?(w.label||'Serie 1'):'Serie '+(i+1)),ax=Math.min(Math.max(parseInt(d.axis)||0,0),yaxes.length-1);
      var rt=_rt(d);if(_resolveType(rt).kind==='bar')anyBar=true;
      return _mkSer(rt,s.data,col,nm,ax,w,stacked,lbl,false,_mixed);
    });
    // Vergleichsserie (Zeitversatz) — abgeschattet
    var cmpS=(_hist[w.id]&&_hist[w.id].cmp)||null;
    if(cmpS){var shade=(w.cmpShade!=null?w.cmpShade:55)/100,olbl=OFFLBL[w.cmpOff||'1d'];
      cmpS.forEach(function(s,i){if(!s)return;var d=defs[i]||{},base=_chColor(d.color,i),col=darken(base,shade),ax=Math.min(Math.max(parseInt(d.axis)||0,0),yaxes.length-1);
        var nm=(d.name||(i===0?(w.label||'Serie 1'):'Serie '+(i+1)))+' · '+olbl,rt=_rt(d);
        series.push(_mkSer(rt,s.data,col,nm,ax,w,stacked,null,true,_mixed));
      });
    }
    var ax0=_axShow(w);
    var nL=0,nR=0;yaxes.forEach(function(a){if(a.side==='R')nR++;else nL++;});var iL=0,iR=0;
    // Tooltip-Zahl: eine Achse -> mit Einheit; mehrere (gemischte Einheiten) -> nur Zahl,
    // sonst haengte an jeder Reihe dieselbe (falsche) Einheit.
    var _multiAx=(nL+nR)>1;
    var _lineFmt=function(v){return _chNum(w,v,!_multiAx);};
    var yA=yaxes.map(function(a,ix){var right=(a.side==='R'),off=right?(iR++*48):(iL++*48);
      return {type:'value',position:(right?'right':'left'),offset:off,name:(a.name||''),nameTextStyle:{color:cssv('--muted'),fontSize:_ecF(w,'axname',9)},nameGap:7,
        scale:(a.min==null||a.min===''),min:(a.min!=null&&a.min!==''?parseFloat(a.min):null),max:(a.max!=null&&a.max!==''?parseFloat(a.max):null),
        axisLine:{show:ax0.line,lineStyle:{color:cssv('--line')}},axisTick:{show:ax0.ticks,lineStyle:{color:cssv('--line')}},axisLabel:_axLabY(w,ax0,a),splitLine:{show:(ax0.yGrid&&ix===0),lineStyle:{color:cssv('--line-soft')}},splitNumber:(w.gridDivs>0?parseInt(w.gridDivs):null)};});
    var lp=w.legend?(w.legPos||'top'):''; // Legende reserviert Platz am jeweiligen Rand (sonst Ueberlappung)
    var opt={backgroundColor:'transparent',animation:!!bcfg().chartAnim,grid:{left:6+Math.max(0,nL-1)*48+(lp==='left'?60:0),right:8+Math.max(0,nR-1)*48+(lp==='right'?60:0),top:6+_titleSpace(w)+(lp==='top'?20:0),bottom:(w.zoom?34:14)+(lp==='bottom'?18:0),containLabel:true},tooltip:{trigger:'axis',valueFormatter:_lineFmt},
      legend:_legendOpt(w,w.legend),
      title:_titleOpt(w),
      xAxis:{type:'time',boundaryGap:anyBar,splitNumber:_axSplitX(w),axisLine:{show:ax0.line,lineStyle:{color:cssv('--line')}},axisTick:{show:ax0.ticks},axisLabel:_axLabX(w,ax0,false),splitLine:{show:ax0.xGrid,lineStyle:{color:cssv('--line-soft')}}},
      yAxis:yA,series:series};
    if(w.zoom)opt.dataZoom=[{type:'inside'},{type:'slider',height:13,bottom:4,borderColor:'transparent',backgroundColor:accA(.06),fillerColor:accA(.18),handleStyle:{color:cssv('--accent')},dataBackground:{lineStyle:{color:cssv('--line')},areaStyle:{color:accA(.08)}},textStyle:{color:cssv('--faint'),fontSize:_ecF(w,'axis',8)}}];
    // ===== ANNOTATIONEN =========================================================
    // Frueher gab es genau EINEN Sonderfall: Min und Max, fest an einer Serie, ein Stil.
    // Jetzt eine Liste gleichberechtigter Marken - dieselbe Bauform wie bei Serien und
    // Achsen, damit nichts Neues zu lernen ist. Jede Marke sagt: WAS wird markiert
    // (Art), an WELCHER Reihe, WIE dargestellt und in welcher Farbe.
    _annApply(w,series);
    if(w.barHoriz&&(ct==='bar'||ct==='barstack'))_hbLine(opt,w);   // liegende Balken
    ec.setOption(opt,true);
  }
  // Kalenderjahr-Modus (Balken, Monatlich): x = Jän–Dez, exaktes Jahr (+ Vorjahr bei Vergleich), via generische ?api=aggregated
  function setCalBar(w){
    var ec=_ec[w.id];if(!ec)return;
    var m=(_hist[w.id]&&_hist[w.id].cal)||{cur:[],prev:[],curY:'',prevY:''};
    var ML=['Jän','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    var acc=_chColor((_chSeries(w)[0]||{}).color,0),prevCol=darken(acc,(w.cmpShade!=null?w.cmpShade:55)/100);
    var unit=(w.yunit||''),br=parseFloat(w.barRadius!=null?w.barRadius:3);
    var lbl=w.labels?{show:true,fontSize:_ecF(w,'label',8),color:cssv('--muted'),position:'top',formatter:function(p){return (p.value==null)?'':_chNum(w,p.value,false);}}:{show:false};
    var showLeg=(w.legend!==false),series=[];
    if(w.cmpOn)series.push({type:'bar',name:String(m.prevY||'Vorjahr'),itemStyle:{color:prevCol,borderRadius:br},data:m.prev,label:lbl});
    series.push({type:'bar',name:String(m.curY||'Jahr'),itemStyle:{color:acc,borderRadius:br},data:m.cur,label:lbl});
    var lp=showLeg?(w.legPos||'top'):'',axc=_axShow(w);
    _annApply(w,series);   // Kalenderjahr-Balken: Marken gelten hier genauso
    var opt={backgroundColor:'transparent',animation:!!bcfg().chartAnim,grid:{left:8+(lp==='left'?60:0),right:10+(lp==='right'?60:0),top:6+_titleSpace(w)+(lp==='top'?20:0),bottom:4+(lp==='bottom'?18:0),containLabel:true},
      tooltip:{trigger:'axis',valueFormatter:function(v){return _chNum(w,v);}},
      legend:_legendOpt(w,showLeg),
      title:_titleOpt(w),
      xAxis:{type:'category',data:ML,axisTick:{show:axc.ticks},axisLine:{show:axc.line,lineStyle:{color:cssv('--line')}},axisLabel:_axLabX(w,axc,true),splitLine:{show:axc.xGrid,lineStyle:{color:cssv('--line-soft')}}},
      yAxis:{type:'value',name:unit,nameTextStyle:{color:cssv('--muted'),fontSize:_ecF(w,'axname',9)},nameGap:7,
        min:(w.ymin!=null&&w.ymin!==''?parseFloat(w.ymin):null),max:(w.ymax!=null&&w.ymax!==''?parseFloat(w.ymax):null),
        axisLine:{show:axc.line,lineStyle:{color:cssv('--line')}},axisTick:{show:axc.ticks},axisLabel:_axLabY(w,axc),
        splitLine:{show:axc.yGrid,lineStyle:{color:cssv('--line-soft')}},splitNumber:(w.gridDivs>0?parseInt(w.gridDivs):null)},
      series:series};
    if(w.barHoriz)_hbCat(opt);   // liegende Balken
    ec.setOption(opt,true);
  }
  function fetchCalYear(w){
    var EMPTY=[null,null,null,null,null,null,null,null,null,null,null,null];
    // Serie hat Vorrang vor der (evtl. veralteten, im Panel ausgeblendeten) Hauptvariable.
    var vid=(_chSeries(w)[0]||{}).vid||w.varId;
    if(!vid){_hist[w.id]={cal:{cur:EMPTY.slice(),prev:EMPTY.slice(),curY:'',prevY:''}};if(_ec[w.id])renderChartData(w);return;}
    var aggF=(w.aggField==='sum')?'sum':'avg';
    var Y=new Date().getFullYear(),need=w.cmpOn?[Y,Y-1]:[Y],res={},done=0;
    need.forEach(function(y){
      var from=Math.floor(new Date(y,0,1,0,0,0).getTime()/1000),to=Math.floor(new Date(y+1,0,1,0,0,0).getTime()/1000)-1;
      fetch('?api=aggregated&id='+encodeURIComponent(vid)+'&level=3&from='+from+'&to='+to,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        var arr=EMPTY.slice();((j&&j.rows)||[]).forEach(function(b){var mo=new Date(b.t*1000).getMonth();if(mo>=0&&mo<12&&b[aggF]!=null)arr[mo]=Math.round(b[aggF]*100)/100;});res[y]=arr;
      }).catch(function(){res[y]=EMPTY.slice();}).then(function(){
        done++;if(done>=need.length){_hist[w.id]={cal:{cur:res[Y]||EMPTY.slice(),prev:res[Y-1]||EMPTY.slice(),curY:Y,prevY:Y-1}};if(_ec[w.id])renderChartData(w);}
      });
    });
  }
  var _histTmr={};
  function chartPushRefresh(w){ // WS-Push auf eine Chart-/Spark-Variable -> Historie entprellt neu laden (nahe Echtzeit)
    if(_histTmr[w.id])return;
    _histTmr[w.id]=setTimeout(function(){delete _histTmr[w.id];fetchHist(w);},900);
  }
  // Zeit-Control: Anzahl x Einheit — Einheit ist zugleich die Aggregationsstufe (raw=unaggregiert). Fenster = Anzahl x Einheit.
  var _CHLVL={raw:null,min:5,hour:0,day:1,week:2,month:3,year:4};                    // Einheit -> Archiv-Level
  var _CHSEC={min:300,hour:3600,day:86400,week:604800,month:2629800,year:31557600};  // Dauer je Einheit (Sek.)
  function _chRange(w){ // liefert {n,unit,cal,aggF,rawUnit} — mit Rueckwaerts-Fallback auf hours/agg/calYear
    if(w.range&&w.range.unit)return w.range;
    if(w.calYear&&String(w.agg)==='3')return {n:12,unit:'month',cal:true,aggF:(w.aggField||'avg')};
    if(w.agg!=null&&w.agg!==''){var u=({0:'hour',1:'day',2:'week',3:'month',4:'year'})[parseInt(w.agg)]||'hour';return {n:Math.max(1,Math.round((w.hours||24)*3600/_CHSEC[u])),unit:u,aggF:(w.aggField||'avg')};}
    return {n:(w.hours||24),unit:'raw',rawUnit:'hour'};
  }
  function _chWindow(w){
    var r=_chRange(w),now=Math.floor(Date.now()/1000),poff=(w._pOff||0);
    var dur=(r.unit==='raw')?_CHSEC[r.rawUnit||'hour']:_CHSEC[r.unit],win=(r.n||24)*dur;
    var to=now-poff*win,from=to-win;
    return {from:from,to:to,win:win,level:_CHLVL[r.unit],aggF:(r.aggF==='sum'?'sum':'avg'),cal:!!r.cal,unit:r.unit,n:(r.n||24)};
  }
  function _setRange(w,patch){var r=_chRange(w);w.range={n:r.n,unit:r.unit,cal:r.cal,aggF:r.aggF,rawUnit:r.rawUnit};for(var k in patch)w.range[k]=patch[k];delete _hist[w.id];fetchHist(w);}
  function _winSec(w){var r=w.range;if(r&&r.unit&&_CHSEC[r.unit])return (r.n||24)*_CHSEC[r.unit];return (w.hours>0?w.hours:24)*3600;} // Fenster (Sek.) fuer statetl/statelog — Anzahl x Einheit, Fallback hours
  // Kalender-ausgerichteter Zeitraum-Anfang (ganze Stunde/Tag/Woche/Monat/Jahr), off = Verschiebung (0=aktuell, -1=vorheriger)
  function _periodStart(unit,off){var d=new Date();d.setMinutes(0,0,0);
    if(unit==='hour'){d.setHours(d.getHours()+off);return d;}
    d.setHours(0,0,0,0);
    if(unit==='day'){d.setDate(d.getDate()+off);return d;}
    if(unit==='week'){var wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd+off*7);return d;} // Woche ab Montag
    if(unit==='month'){d.setDate(1);d.setMonth(d.getMonth()+off);return d;}
    if(unit==='year'){d.setMonth(0,1);d.setFullYear(d.getFullYear()+off);return d;}
    return d;}
  function _periodEnd(unit,s){var d=new Date(s.getTime());
    if(unit==='hour')d.setHours(d.getHours()+1);
    else if(unit==='day')d.setDate(d.getDate()+1);
    else if(unit==='week')d.setDate(d.getDate()+7);
    else if(unit==='month')d.setMonth(d.getMonth()+1);
    else if(unit==='year')d.setFullYear(d.getFullYear()+1);
    else d.setHours(d.getHours()+1);
    return d;}
  // Sichtbares Zeitfenster fuer statetl/statelog: 'period' = kalender-ausgerichtet (voller Zeitraum,
  // Rest der laufenden Einheit bleibt "offen"), sonst rollierend (now-win .. now).
  function _winRange(w){var now=Math.floor(Date.now()/1000),r=w.range||{};
    if(r.mode==='period'){var unit=r.unit||'day',off=(w._pOff||0),s=_periodStart(unit,off),e=_periodEnd(unit,s);
      return {from:Math.floor(s.getTime()/1000),to:Math.floor(e.getTime()/1000),now:now,period:unit,start:s,off:off};}
    return {from:now-_winSec(w),to:now,now:now,period:null,off:0};}
  // Serien: beliebig viele [{vid,name,color,type,axis}] — Fallback aus altem varId/2/3 + sopt (Migration beim ersten Editieren)
  function _chSeries(w){
    if(w.series&&w.series.length)return w.series;
    var out=[],ids=[w.varId,w.varId2,w.varId3];
    ids.forEach(function(vid,i){if(!vid)return;var o=(w.sopt&&w.sopt[i])||{};out.push({vid:vid,name:o.name||'',color:o.color||'',type:'',axis:(o.axis==1?1:0)});});
    return out;
  }
  function _ensureSeries(w){if(!(w.series&&w.series.length))w.series=_chSeries(w).map(function(s){return {vid:s.vid,name:s.name,color:s.color,type:s.type,axis:s.axis};});return w.series;}
  // Typ-Aufloesung (auch je Serie fuer Mixed-Charts)
  function _resolveType(t){var k='line',sm=null,fl=false,sp=false;
    if(t==='bar'||t==='barstack')k='bar';else if(t==='scatter')k='scatter';
    else if(t==='spline'){sm=true;}else if(t==='area'){fl=true;}else if(t==='areaspline'){fl=true;sm=true;}
    else if(t==='step'){sp=true;}else if(t==='steparea'){sp=true;fl=true;}
    return {kind:k,smooth:sm,fill:fl,step:sp};}
  // In einem GEMISCHTEN Diagramm (Balken und Linien nebeneinander) darf die Stapelung nur
  // die Balken treffen. Eine Leistungslinie auf einen Verbrauchsbalken zu stapeln ergibt
  // keinen Sinn - und bei zwei Linien addierte echarts sie stillschweigend aufeinander, was
  // wie ein Messfehler aussieht. Reine Linien- oder Flaechendiagramme stapeln unveraendert.
  function _mkSer(rt,data,col,nm,ax,w,stacked,lbl,dashed,mixed){var R=_resolveType(rt),
    st=(stacked&&!(mixed&&R.kind!=='bar'))?'total':undefined,br=parseFloat(w.barRadius!=null?w.barRadius:3);
    if(R.kind==='bar')return {type:'bar',name:nm,yAxisIndex:ax,stack:(dashed?(stacked?'cmp':undefined):st),itemStyle:{color:col,borderRadius:(stacked?0:br)},data:data,label:(dashed?{show:false}:lbl)};
    if(R.kind==='scatter')return {type:'scatter',name:nm,yAxisIndex:ax,symbolSize:(w.symSize||7),itemStyle:{color:col},data:data,label:(dashed?{show:false}:lbl)};
    var smooth=(R.smooth!=null?R.smooth:(w.smooth!==false&&!R.step));
    var ser={type:'line',name:nm,yAxisIndex:ax,stack:(dashed?undefined:st),showSymbol:(dashed?false:!!w.symbols),symbolSize:(w.symSize||5),smooth:smooth,step:(R.step?'end':false),lineStyle:{color:col,width:parseFloat(w.lw||2),type:(dashed?'dashed':'solid')},itemStyle:{color:col},data:data,label:(dashed?{show:false}:lbl)};
    if(R.fill)ser.areaStyle=dashed?{color:accA(.10,col)}:(w.grad?{color:gradFill(col)}:{color:accA(stacked?.42:.14,col)});
    return ser;}
  function _chColor(c,i){ // Serien-Farbe: Skin-Stichwort -> echte Farbe (ECharts kann kein var()), Hex bleibt, leer -> Auto
    if(!c)return autoColorHex(i);
    if(/^#[0-9a-fA-F]{6}$/.test(c))return c;
    var v=_skinColor(c),m=v&&v.match(/^var\((--[\w-]+)\)$/);return m?cssv(m[1]):(c||autoColorHex(i));}
  function _skinToCss(c){ // Skin-Stichwort -> echte Farbe (leer bleibt leer, Hex bleibt) — fuer ECharts (waterfall/sankey/gauge)
    if(!c)return '';if(/^#[0-9a-fA-F]{6}$/.test(c))return c;
    var v=_skinColor(c),m=v&&v.match(/^var\((--[\w-]+)\)$/);return m?cssv(m[1]):c;}
  // Y-Achsen: [{side:'L'|'R', name, min, max}] — Fallback aus altem yunit/ymin/ymax + genutzten Serie-Achsen
  function _chYAxes(w){
    if(w.yAxes&&w.yAxes.length)return w.yAxes;
    var out=[{side:'L',name:(w.yunit||''),min:(w.ymin!=null?w.ymin:''),max:(w.ymax!=null?w.ymax:'')}];
    if(_chSeries(w).some(function(s){return (s.axis|0)===1;}))out.push({side:'R',name:''});
    return out;
  }
  function _ensureYAxes(w){if(!(w.yAxes&&w.yAxes.length))w.yAxes=_chYAxes(w).map(function(a){return {side:a.side,name:a.name||'',min:(a.min!=null?a.min:''),max:(a.max!=null?a.max:'')};});return w.yAxes;}
  // ---- Tageslänge über ein Jahr (ctype 'daylight') ----------------------------------------
  // Datenquelle: ?api=daylight (nutzt die native PHP-Funktion date_sun_info, wir rechnen nichts nach).
  // Geliefert werden absolute Unix-Zeitstempel; die Umrechnung in Ortszeit macht der Browser,
  // damit die Zeitzone des Symcon-Prozesses (häufig UTC) keine Rolle spielt.
  function _dlHour(ts){var d=new Date(ts*1000);return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600;}
  // Ohne Sommerzeit: feste Normalzeit-Verschiebung (Stand 1. Januar) statt der jeweils gueltigen
  // Ortszeit. Ergibt glatte Kurven ohne die Spruenge Ende Maerz / Ende Oktober.
  function _dlHourStd(ts,offMin){var h=(ts+offMin*60)/3600;h=h/24;h=(h-Math.floor(h))*24;return h;} // Ortszeit = UTC + Versatz
  function _dlStdOff(year){return -new Date(year,0,1,12,0,0).getTimezoneOffset();} // Minuten oestlich von UTC
  function fetchDaylight(w){
    var y=parseInt(w.dlYear)||new Date().getFullYear();
    var q='?api=daylight&year='+y+(w.dlLoc?('&id='+parseInt(w.dlLoc)):'');
    fetch(q,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.days){_hist[w.id]={dl:null,err:(j&&j.hint)||'kein Standort'};if(_ec[w.id])setDaylight(w);return;}
      var rise=[],set=[],len=[];
      var noDst=!!w.dlNoDst,off=_dlStdOff(j.year); // Normalzeit-Versatz nur einmal bestimmen
      function hOf(ts){return noDst?_dlHourStd(ts,off):_dlHour(ts);}
      j.days.forEach(function(d){
        var t=d[0]*1000; // Tagesstempel (Mittag UTC) — nur als x-Position
        if(d[1]==null||d[2]==null){rise.push([t,null]);set.push([t,null]);len.push([t,null]);return;}
        var hr=hOf(d[1]),hs=hOf(d[2]);
        rise.push([t,Math.round(hr*1000)/1000]);
        set.push([t,Math.round(hs*1000)/1000]);
        len.push([t,Math.round((d[2]-d[1])/36*1)/100]); // Tageslänge in Stunden
      });
      _hist[w.id]={dl:{rise:rise,set:set,len:len,year:j.year,lat:j.lat,lon:j.lon}};
      if(_ec[w.id])setDaylight(w);
    }).catch(function(){_hist[w.id]={dl:null,err:'Abruf fehlgeschlagen'};if(_ec[w.id])setDaylight(w);});
  }
  function _dlFmt(h){if(h==null)return '–';var hh=Math.floor(h),mm=Math.round((h-hh)*60);if(mm===60){hh++;mm=0;}return ('0'+hh).slice(-2)+':'+('0'+mm).slice(-2);}
  function setDaylight(w){
    var ec=_ec[w.id];if(!ec)return;
    var D=(_hist[w.id]&&_hist[w.id].dl)||null;
    if(!D){ec.setOption({backgroundColor:'transparent',title:{text:(_hist[w.id]&&_hist[w.id].err)||'Standort fehlt',left:'center',top:'middle',textStyle:{color:cssv('--faint'),fontSize:_ecF(w,'title',11),fontWeight:'normal'}},xAxis:{show:false},yAxis:{show:false},series:[]},true);return;}
    var ax=_axShow(w);
    var cSet=_skinToCss(w.dlSet)||cssv('--warn'),cRise=_skinToCss(w.dlRise)||cssv('--muted');
    var cFill=_skinToCss(w.dlFill)||cSet;
    var op=(w.dlOpacity!=null?w.dlOpacity:22)/100;
    var lp=w.legend?(w.legPos||'top'):'';
    // Band: unsichtbare Basis (Aufgang) + gestapelte Differenz -> Fläche genau zwischen den Kurven
    var diff=D.rise.map(function(p,i){var a=p[1],b=D.set[i][1];return [p[0],(a==null||b==null)?null:Math.round((b-a)*1000)/1000];});
    var series=[
      {name:'_basis',type:'line',stack:'dl',data:D.rise,symbol:'none',lineStyle:{width:0,opacity:0},areaStyle:{opacity:0},silent:true,tooltip:{show:false},z:1},
      {name:'Tageslänge',type:'line',stack:'dl',data:diff,symbol:'none',lineStyle:{width:0,opacity:0},areaStyle:{color:cFill,opacity:op},silent:true,z:1},
      {name:'Untergang',type:'line',data:D.set,symbol:'none',smooth:true,lineStyle:{color:cSet,width:(w.lw||2)},z:3},
      {name:'Aufgang',  type:'line',data:D.rise,symbol:'none',smooth:true,lineStyle:{color:cRise,width:(w.lw||2)},z:3}
    ];
    // Markierung „heute" (durchgezogen) — Datumsschild wie in der Vorlage
    if(w.dlToday!==false){
      var now=new Date(),ty=parseInt(w.dlYear)||now.getFullYear();
      if(now.getFullYear()===ty){
        var tx=Date.UTC(ty,now.getMonth(),now.getDate(),12,0,0);
        series[2].markLine={silent:true,symbol:'none',
          lineStyle:{color:cssv('--text'),width:1.5,type:'solid',opacity:.85},
          label:{show:true,position:'insideEndTop',formatter:('0'+now.getDate()).slice(-2)+'.'+('0'+(now.getMonth()+1)).slice(-2),
                 color:cssv('--text'),backgroundColor:cssv('--surface-2'),borderColor:cssv('--line'),borderWidth:1,
                 padding:[3,6],borderRadius:4,fontSize:_ecF(w,'label',10)},
          data:[{xAxis:tx}]};
      }
    }
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,
      grid:{left:6,right:8,top:6+_titleSpace(w)+(lp==='top'?20:0),bottom:6+(lp==='bottom'?18:0),containLabel:true},
      title:_titleOpt(w),legend:_legendOpt(w,w.legend),
      tooltip:{trigger:'axis',axisPointer:{type:'line'},
        formatter:function(ps){
          if(!ps||!ps.length)return '';
          var d=new Date(ps[0].value[0]),r=null,s=null;
          ps.forEach(function(p){if(p.seriesName==='Aufgang')r=p.value[1];if(p.seriesName==='Untergang')s=p.value[1];});
          var lenH=(r!=null&&s!=null)?(s-r):null;
          return ('0'+d.getUTCDate()).slice(-2)+'.'+('0'+(d.getUTCMonth()+1)).slice(-2)+'.<br>'
            +'Auf '+_dlFmt(r)+' · Unter '+_dlFmt(s)
            +(lenH!=null?('<br>Tageslänge '+_dlFmt(lenH)):'');
        }},
      xAxis:{type:'time',axisLine:{show:ax.line,lineStyle:{color:cssv('--line')}},axisTick:{show:ax.ticks},
        axisLabel:{show:ax.xLab,color:cssv('--faint'),fontSize:_axFs(w),formatter:'{MMM}'},
        splitLine:{show:ax.xGrid,lineStyle:{color:cssv('--line-soft')}}},
      yAxis:{type:'value',min:(w.dlYMin!=null&&w.dlYMin!==''?parseFloat(w.dlYMin):0),max:(w.dlYMax!=null&&w.dlYMax!==''?parseFloat(w.dlYMax):24),interval:6,
        axisLine:{show:ax.line,lineStyle:{color:cssv('--line')}},axisTick:{show:ax.ticks},
        axisLabel:{show:ax.yLab,color:cssv('--faint'),fontSize:_axFs(w),formatter:function(v){return ('0'+v).slice(-2)+':00';}},
        splitLine:{show:ax.yGrid,lineStyle:{color:cssv('--line-soft')}}},
      series:series},true);
  }
  // ---- Heatmap: Wochentag (Zeilen) x Stunde (Spalten), aggregiert aus stuendlicher Historie EINER Variable ----
  function fetchHeatmap(w){
    var vid=(_chSeries(w)[0]||{}).vid||w.varId;
    if(!vid){_hist[w.id]={heat:null};if(_ec[w.id])setHeatmap(w);return;}
    var days=Math.max(1,Math.min(120,w.hmDays||14)),now=Math.floor(Date.now()/1000),from=now-days*86400;
    var res=([5,15,30,60].indexOf(w.hmRes)>=0)?w.hmRes:60;   // Minuten je Spalte
    var level=(res>=60)?0:5;                                 // fein -> 5-Min-Archiv als Basis, sonst Stunde
    var cols=Math.round(1440/res),aggF=(w.aggField==='sum')?'sum':'avg';
    fetch('?api=aggregated&id='+encodeURIComponent(vid)+'&level='+level+'&from='+from+'&to='+now,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var sum=[],cnt=[],d,c;for(d=0;d<7;d++){sum[d]=[];cnt[d]=[];for(c=0;c<cols;c++){sum[d][c]=0;cnt[d][c]=0;}}
      ((j&&j.rows)||[]).forEach(function(b){if(b[aggF]==null)return;var dt=new Date(b.t*1000),wd=(dt.getDay()+6)%7,slot=Math.floor((dt.getHours()*60+dt.getMinutes())/res);if(slot<0)slot=0;if(slot>=cols)slot=cols-1;sum[wd][slot]+=b[aggF];cnt[wd][slot]++;});
      var data=[],mn=Infinity,mx=-Infinity;
      for(d=0;d<7;d++)for(c=0;c<cols;c++){var k=cnt[d][c];if(k>0){var v=(aggF==='sum')?sum[d][c]:(sum[d][c]/k);v=Math.round(v*100)/100;data.push([c,d,v]);if(v<mn)mn=v;if(v>mx)mx=v;}}
      _hist[w.id]={heat:{data:data,min:(mn===Infinity?0:mn),max:(mx===-Infinity?1:mx),cols:cols,res:res}};
      if(_ec[w.id])setHeatmap(w);
    }).catch(function(){_hist[w.id]={heat:null};if(_ec[w.id])setHeatmap(w);});
  }
  function setHeatmap(w){
    var ec=_ec[w.id];if(!ec)return;var H=_hist[w.id]&&_hist[w.id].heat;
    var WD=['Mo','Di','Mi','Do','Fr','Sa','So'],fs=_axFs(w),muted=cssv('--muted');
    if(!H||!H.data.length){ec.setOption({backgroundColor:'transparent',title:{text:(_hist[w.id]&&_hist[w.id].heat===null)?'keine Verlaufsdaten':'lädt …',left:'center',top:'middle',textStyle:{color:cssv('--faint'),fontSize:_ecF(w,'title',12),fontWeight:'normal'}},xAxis:{show:false},yAxis:{show:false},visualMap:{show:false},series:[]},true);return;}
    var res=H.res||60,cols=H.cols||24,xlab=[],c;
    for(c=0;c<cols;c++){var mm=c*res;xlab.push((mm%60===0)?('0'+(mm/60)).slice(-2):'');}   // nur volle Stunden beschriften
    function _hlbl(ci){var mm=ci*res;return ('0'+Math.floor(mm/60)).slice(-2)+':'+('0'+(mm%60)).slice(-2);}
    var SCH={accent:[cssv('--surface-2'),cssv('--accent')],heat:['#153a4a','#2e8b8b','#3bd6c6','#f2b441','#f2685a'],cool:['#4aa3ff','#39d08a','#f2b441','#f2685a']};
    var pal=SCH[w.hmScheme]||SCH.heat, thin=(cols>48);
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,
      tooltip:{position:'top',backgroundColor:cssv('--surface-2'),borderColor:cssv('--line'),textStyle:{color:cssv('--text'),fontSize:_ecF(w,'label',10)},formatter:function(p){return WD[p.value[1]]+' '+_hlbl(p.value[0])+' · '+_chNum(w,p.value[2]);}},
      title:_titleOpt(w),
      grid:{left:6,right:6,top:6+_titleSpace(w),bottom:26,containLabel:true},
      xAxis:{type:'category',data:xlab,splitArea:{show:!thin,areaStyle:{color:['transparent','rgba(127,127,127,0.04)']}},axisLine:{show:false},axisTick:{show:false},axisLabel:{color:muted,fontSize:fs,interval:0,hideOverlap:true}},
      yAxis:{type:'category',data:WD,inverse:true,splitArea:{show:true,areaStyle:{color:['transparent','rgba(127,127,127,0.04)']}},axisLine:{show:false},axisTick:{show:false},axisLabel:{color:muted,fontSize:fs}},
      visualMap:{min:H.min,max:H.max,calculable:true,orient:'horizontal',left:'center',bottom:2,itemWidth:12,itemHeight:90,textStyle:{color:muted,fontSize:fs},inRange:{color:pal}},
      series:[{type:'heatmap',data:H.data,progressive:0,itemStyle:{borderColor:cssv('--surface'),borderWidth:(thin?0:1)},label:{show:!!w.labels&&!thin,fontSize:fs,color:cssv('--text'),formatter:function(p){return _chNum(w,p.value[2]);}},emphasis:{itemStyle:{shadowBlur:6,shadowColor:'rgba(0,0,0,.45)'}}}]},true);
  }
  function fetchHist(w){
    if(w.ctype==='heatmap'){fetchHeatmap(w);return;} // Wochentag x Stunde (eigener Aggregat-Weg)
    if(w.ctype==='daylight')  {fetchDaylight(w);return;} // eigener Datenweg (Jahresberechnung, keine Historie)
    if(w.ctype==='waterfall'||w.type==='waterfall')return; // Wasserfall liest ausschliesslich Live-Werte (_lastVals)
    if(w.ctype==='barrace'&&w.brLive){if(_ec[w.id])setBarRaceLive(w);return;} // Live-Bar-Race: keine Historie, nur _lastVals
    var W=_chWindow(w);
    if(w.type==='chart'&&_chCalMode(w)){fetchCalYear(w);return;}
    var S=_chSeries(w).filter(function(s){return s&&s.vid;});if(!S.length)return;
    var cols=[cssv('--accent'),cssv('--info'),cssv('--warm')],out=[],cmp=[],done=0;
    var off=(w.cmpOn?OFFS[w.cmpOff||'1d']:0),poff=(w._pOff||0),mTo=W.to,mFrom=W.from,lvl=W.level,aggF=W.aggF;
    function hUrl(id,from,to){return lvl!=null?('?api=aggregated&id='+encodeURIComponent(id)+'&level='+lvl+'&from='+from+'&to='+to):('?api=history&id='+encodeURIComponent(id)+'&from='+from+'&to='+to);}
    function hPts(j){if(lvl!=null){return ((j&&j.rows)||[]).map(function(b){return [b.t*1000,b[aggF]];}).filter(function(p){return p[1]!=null;}).sort(function(a,b){return a[0]-b[0];});}return (j&&j.data)||[];}
    var total=S.length*(w.cmpOn&&off?2:1);
    function fin(){done++;if(done>=total){_hist[w.id]={series:out,cmp:(w.cmpOn&&off?cmp:null)};if(_ec[w.id]){renderChartData(w);var pl=$('.w[data-id="'+w.id+'"] [data-role=plabel]',canvas);if(pl)pl.textContent=poff>0?('−'+poff):'jetzt';}}}
    S.forEach(function(s,i){var id=s.vid,scol=s.color||cols[i%cols.length],snm=s.name||(i===0?(w.label||'Serie 1'):'Serie '+(i+1));
      fetch(hUrl(id,mFrom,mTo),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        out[i]={data:hPts(j),color:scol,name:snm};
      }).catch(function(){out[i]={data:[],color:scol,name:snm};}).then(fin);
      if(w.cmpOn&&off){var to=mTo-off,from=mFrom-off;
        fetch(hUrl(id,from,to),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
          cmp[i]={data:hPts(j).map(function(p){return [p[0]+off*1000,p[1]];}),color:scol};
        }).catch(function(){cmp[i]={data:[]};}).then(fin);
      }
    });
  }
  function ensureCmp(w,cb){
    if(!w.varId){cb(null);return;}
    var stage=cmpStage(w),kind=((w.cmpCounter||w.type==='cval')?'counter':'standard');
    var mode=(w.cmpAvg&&kind==='standard')?'avg':'';
    var c=_cmpData[w.id],now=Date.now();
    if(c&&c.stage===stage&&c.kind===kind&&c.mode===mode&&(now-c.fetched)<25000){cb(c);return;}
    fetch('?api=cmp&id='+encodeURIComponent(w.varId)+'&stage='+stage+'&kind='+kind+(mode?'&mode='+mode:''),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _cmpData[w.id]={cur:(j&&j.cur!=null)?parseFloat(j.cur):null,past:(j&&j.past!=null)?parseFloat(j.past):null,type:(j&&j.type)||0,stage:stage,kind:kind,mode:mode,fetched:now};cb(_cmpData[w.id]);
    }).catch(function(){cb(null);});
  }
  // KPI-Hauptwert im Vergleich/Zählermodus: universelle Formatierung (Faktor/Nachkommastellen/
  // Tausender/Kürzung) anwenden, wenn gesetzt — sonst exakt wie bisher (fmtDelta).
  function _cmpFmtMain(w,cur){
    if(w.thousand||w.numAbbrev||(w.scale!=null&&w.scale!==''&&+w.scale!==1)||w.dec!=null){
      var v=(w.scale!=null&&w.scale!==''&&+w.scale!==1)?cur*(+w.scale):cur;
      var dd=(w.dec!=null)?w.dec:(Math.abs(v)>=100?0:1);
      return _fmtNum(v,{dec:dd,thousand:w.thousand,numAbbrev:w.numAbbrev});
    }
    return fmtDelta(cur,false);
  }
  function computeCompare(w){
    ensureCmp(w,function(p){
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
      var cur=p?p.cur:null,past=p?p.past:null,ok=(cur!=null&&past!=null);
      var diff=ok?cur-past:null;
      // "praktisch null": faengt Zaehler-Rauschen ab (nachts ist der Ertrag heute UND gestern
      // ~0, z. B. 0,00008 kWh). Eine Prozentrechnung diff/|past| ergaebe dann absurde Werte
      // wie +117 %. Deshalb: ist die Basis (Vorperiode) verschwindend klein, gibt es nur dann
      // einen Prozentwert (0 %), wenn auch die Aenderung ~0 ist; sonst wird der Absolutwert
      // gezeigt (echter Sprung von ~0 auf etwas). Standardvariablen (Temperatur o. Ae.) haben
      // nie eine Basis < EPS, sind also unberuehrt.
      var EPS=1e-3, smallBase=ok&&Math.abs(past)<EPS;
      var pct=!ok?null:(smallBase?(Math.abs(diff)<EPS?0:null):diff/Math.abs(past)*100);
      var showAbs=(w.cmpMode==='abs')||(pct===null); // Basis ~0 mit echter Aenderung -> Absolutwert statt %
      var _dnum=!ok?null:(showAbs?diff:pct);          // die TATSAECHLICH gezeigte Groesse (Prozent bzw. Absolut)
      var _dr=(_dnum==null)?0:Math.round(_dnum*10)/10;// auf Anzeige-Genauigkeit runden -> Pfeil passt zum gezeigten Wert
      var dir=(_dnum==null)?'flat':(_dr>0?'up':(_dr<0?'dn':'flat')); // Pfeil folgt dem Vorzeichen des gezeigten Werts, nicht dem Absolut-Delta
      var tone=(dir==='flat')?'muted':(((dir==='up')!==!!w.cmpInvert)?'ok':'crit');
      var arrow=dir==='up'?'▲':(dir==='dn'?'▼':'→');
      var counter=(p&&p.type===1);
      var val=!ok?'–':(showAbs?fmtDelta(diff,true)+(w.unit?' '+w.unit:''):fmtDelta(pct,true)+' %');
      var cap='ggü. '+(STAGELBL[cmpStage(w)]||'gestern');
      if(counter&&cur!=null&&w.type==='kpi'){var mv=el.querySelector('[data-role=val]');if(mv)mv.textContent=_cmpFmtMain(w,cur);} // Zähler: Hauptwert = Verbrauch aktuelle Periode (universelle Formatierung)
      if(w.type==='kpi'){var s=el.querySelector('[data-role=cmp]');if(s){s.className='hks '+(tone==='ok'?'up':(tone==='crit'?'dn':''));s.textContent=arrow+' '+val+' '+cap;}}
      else if(w.type==='delta'){var root=el.querySelector('[data-role=delroot]');if(root)root.className='hdelta t-'+tone;var ar=el.querySelector('[data-role=arrow]');if(ar)ar.textContent=arrow;var vv=el.querySelector('[data-role=val]');if(vv)vv.textContent=val;var cc=el.querySelector('[data-role=cap]');if(cc)cc.textContent=(w.label?w.label+' · ':'')+cap;}
    });
  }
  function refreshCompare(w){delete _cmpData[w.id];render();computeCompare(w);}
  function computeCounterVal(w){ // Zählerwert-Widget: Verbrauch der gewählten Periode als reiner Wert
    ensureCmp(w,function(p){
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
      var v=el.querySelector('[data-role=val]');if(!v)return;
      var cur=p?p.cur:null;
      if(cur==null){v.textContent=w.nullText||'–';v.style.color='';return;}
      if(w.scale!=null&&w.scale!==''&&+w.scale!==1)cur=cur*(+w.scale); // universeller Faktor
      var a=Math.abs(cur),dd=(w.dec!=null)?w.dec:(a>=100?0:(a>=10?1:(a>=1?2:3)));
      v.textContent=_fmtNum(cur,{dec:dd,thousand:w.thousand,numAbbrev:w.numAbbrev})+(w.unit?' '+w.unit:''); // dec/Tausender/Kürzung zentral
      _svcDecorate(w,v);
    });
  }
  function refreshCVal(w){delete _cmpData[w.id];render();computeCounterVal(w);}
  var _aggData={}; // widgetId -> {min,max,avg,stage,fetched}
  function ensureAgg(w,cb){
    if(!w.varId){cb(null);return;}
    var stage=cmpStage(w),c=_aggData[w.id],now=Date.now();
    if(c&&c.stage===stage&&(now-c.fetched)<25000){cb(c);return;}
    fetch('?api=agg&id='+encodeURIComponent(w.varId)+'&stage='+stage,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _aggData[w.id]={min:(j&&j.min!=null)?parseFloat(j.min):null,max:(j&&j.max!=null)?parseFloat(j.max):null,avg:(j&&j.avg!=null)?parseFloat(j.avg):null,stage:stage,fetched:now};cb(_aggData[w.id]);
    }).catch(function(){cb(null);});
  }
  function _fmtStat(n,unit,dec,w){if(n==null)return (w&&w.nullText)||'–';if(w&&w.scale!=null&&w.scale!==''&&+w.scale!==1)n=n*(+w.scale);var a=Math.abs(n),dd=(dec!=null)?dec:(a>=100?0:(a>=10?1:2));return _fmtNum(n,{dec:dd,thousand:w&&w.thousand,numAbbrev:w&&w.numAbbrev})+(unit?' '+unit:'');}
  function aggParts(w){var ps=[];if(w.statMin)ps.push('min');if(w.statAvg||(!w.statMin&&!w.statMax&&!w.statAvg))ps.push('avg');if(w.statMax)ps.push('max');return ps;} // Standard: Ø
  // Präfix/Suffix + Schwellenfarbe für sval/cval — direkt nach dem Setzen des Zahltexts (greift für mount, live und Cache)
  function _svcDecorate(w,v){
    if(!v)return;var raw=v.textContent;
    if(w.colThr){var n=parseFloat(String(raw).replace(',','.'));if(!isNaN(n)){var t1=(w.t1!=null?w.t1:0),t2=(w.t2!=null?w.t2:0),c=n<=t1?'--ok':(n<=t2?'--warm':'--crit');if(w.thrInvert)c=(n<=t1?'--crit':(n<=t2?'--warm':'--ok'));v.style.color=cssv(c);}}else v.style.color='';
    if(raw!=='–'&&raw!==''){if(w.pre)v.insertAdjacentText('afterbegin',w.pre);if(w.suf)v.insertAdjacentText('beforeend',w.suf);}
  }
  function computeAggVal(w){
    ensureAgg(w,function(p){
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var v=el.querySelector('[data-role=val]');if(!v)return;
      var LBL={min:'Min',avg:'Ø',max:'Max'},ps=aggParts(w),u=w.unit||'';
      if(ps.length===1){v.textContent=_fmtStat(p?p[ps[0]]:null,u,w.dec,w);}
      else{v.innerHTML=ps.map(function(k){return '<span style="opacity:.55;font-size:.68em;letter-spacing:.02em">'+LBL[k]+'</span> '+esc(_fmtStat(p?p[k]:null,u,w.dec,w));}).join(' <span style="opacity:.3">·</span> ');}
      _svcDecorate(w,v);
    });
  }
  function refreshAggVal(w){delete _aggData[w.id];render();computeAggVal(w);}
  // ===== Thermostat (erweiterte Karte) =====
  function thermMode(w){
    if(!w.varId3)return null;var lv=_lastVals[w.varId3];if(!lv)return {raw:null,name:'',isOff:false,isCool:false,isHeat:true};
    var name='',d=_assocData[w.varId3];if(d){var a=assocFor(w,lv.v);if(a)name=a.name||'';}
    if(!name)name=String(lv.f!=null&&lv.f!==''?lv.f:lv.v);var l=name.toLowerCase();
    return {raw:lv.v,name:name,isOff:/(^|[^a-z])(aus|off)([^a-z]|$)/.test(l),isCool:/(kühl|kuehl|cool)/.test(l),isHeat:/(heiz|heat|warm)/.test(l)};
  }
  function updateTherm(w,root){
    var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;
    var iv=_lastVals[w.varId],sv=_lastVals[w.varId2];
    var ist=iv?parseFloat(String(iv.v).replace(',','.')):NaN,soll=sv?parseFloat(String(sv.v).replace(',','.')):NaN;
    var c=$('[data-role=val]',el);if(c)c.textContent=iv?(iv.f!=null&&iv.f!==''?iv.f:iv.v):'–';
    var t=$('[data-role=target]',el);if(t)t.textContent=sv?(sv.f!=null&&sv.f!==''?sv.f:sv.v):'–';
    var t2=$('[data-role=target2]',el);if(t2)t2.textContent=sv?(sv.f!=null&&sv.f!==''?sv.f:sv.v):'–';
    var mn=(w.min!=null?w.min:14),mx=(w.max!=null?w.max:28),rng=(mx-mn)||1;
    var fill=$('[data-role=istfill]',el);if(fill&&!isNaN(ist))fill.style.width=Math.max(0,Math.min(100,(ist-mn)/rng*100))+'%';
    var mk=$('[data-role=sollmk]',el);if(mk&&!isNaN(soll))mk.style.left=Math.max(0,Math.min(100,(soll-mn)/rng*100))+'%';
    var m=thermMode(w),tone='idle',lab='bereit',ic='flame';
    if(m&&m.isOff){tone='off';lab='Aus';ic='power';}
    else if(m&&m.isCool){var dc=(!isNaN(ist)&&!isNaN(soll)&&ist>soll+0.1);tone=dc?'cool':'idle';lab=dc?'kühlt':'bereit';ic='snowflake';}
    else{var dh=(!isNaN(ist)&&!isNaN(soll)&&ist<soll-0.1);tone=dh?'heat':'idle';lab=dh?'heizt':'bereit';ic='flame';}
    var root=el.querySelector('.htc');if(root)root.className='htc tone-'+tone;
    var st=$('[data-role=hstate]',el);if(st)st.innerHTML='<span class="htc-ic">'+iconSVG(ic)+'</span>'+lab;
    $$('[data-role=modes] .htmbtn',el).forEach(function(b){b.classList.toggle('on',String(b.getAttribute('data-mv'))===String(m&&m.raw));});
  }
  function buildThermModes(w,root){
    var box=$('.w[data-id="'+w.id+'"] [data-role=modes]',(root||canvas));if(!box)return;
    if(!w.varId3){box.innerHTML='';return;}
    loadAssoc(w.varId3,function(d){
      var b2=$('.w[data-id="'+w.id+'"] [data-role=modes]',(root||canvas));if(!b2)return;
      if(!d||!d.assocs.length){b2.innerHTML='';return;}
      b2.innerHTML=d.assocs.map(function(a){return '<button class="htmbtn" data-mv="'+esc(String(a.v))+'">'+esc(a.name||String(a.v))+'</button>';}).join('');
      updateTherm(w);
    });
  }
  // Kamerabild aktualisieren. NUR fuer Einzelbilder (Media-Objekt): ein MJPEG-Stream laeuft
  // dauerhaft in derselben <img>-Verbindung - ein erneutes Setzen von src wuerde ihn abreissen
  // und neu verbinden lassen (sichtbares Ruckeln, unnoetige Last auf der Kamera).
  function _camMode(w){return w.camSrc||'media';}
  function refreshCam(w,root){
    if(_camMode(w)!=='media')return;                       // Stream selbst versorgt sich
    var el=$('.w[data-id="'+w.id+'"] [data-role=cam]',(root||canvas));
    if(el&&w.mediaId)el.src='?api=media&id='+w.mediaId+'&t='+Date.now();
  }
  function setSankey(w){
    var ec=_ec[w.id];if(!ec)return;var nodesSet={},links=[];
    (w.links||[]).forEach(function(l){if(!l.from||!l.to)return;nodesSet[l.from]=1;nodesSet[l.to]=1;var v=(_lastVals[l.vid]!=null)?parseFloat(_lastVals[l.vid].v):0;if(isNaN(v))v=0;links.push({source:l.from,target:l.to,value:Math.max(0.001,Math.abs(v))});});
    var nodes=Object.keys(nodesSet).map(function(n){return {name:n};});
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,title:_titleOpt(w),series:[{type:'sankey',orient:(w.snOrient==='v'?'vertical':'horizontal'),left:4,right:4,top:8+_titleSpace(w),bottom:8,data:nodes,links:links,nodeGap:10,nodeWidth:12,emphasis:{focus:'adjacency'},label:{show:(w.snLabels!==false),color:cssv('--text'),fontSize:_ecF(w,'label',10)},edgeLabel:{show:!!w.snVal,color:cssv('--muted'),fontSize:_ecF(w,'label',9),formatter:function(p){return (Math.round((p.value||0)*10)/10);}},itemStyle:{color:(_skinToCss(w.snNode)||cssv('--accent')),borderColor:'transparent'},lineStyle:{color:'gradient',opacity:(w.snOpacity!=null?w.snOpacity/100:.35),curveness:(w.snCurve!=null?w.snCurve/100:.5)}}]},true);
  }
  function powerflowSVG(w){
    var src=w.src||[],snk=w.snk||[],W=400,rows=Math.max(src.length,snk.length,1),H=Math.max(150,rows*56+16),cy=H/2;
    function ny(i,cnt){if(cnt<=1)return cy-22;var step=(H-24)/cnt;return 12+step*i+step/2-22;}
    var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">';
    src.forEach(function(o,i){var y=ny(i,src.length)+22;s+='<path class="pfline" d="M120 '+y+' C160 '+y+' 150 '+cy+' 180 '+cy+'"/><path class="pfline pfdash" d="M120 '+y+' C160 '+y+' 150 '+cy+' 180 '+cy+'"/>';});
    snk.forEach(function(o,i){var y=ny(i,snk.length)+22;s+='<path class="pfline" d="M240 '+cy+' C270 '+cy+' 250 '+y+' 280 '+y+'"/><path class="pfline pfdash" d="M240 '+cy+' C270 '+cy+' 250 '+y+' 280 '+y+'"/>';});
    s+='<rect class="pfhouse" x="180" y="'+(cy-26)+'" width="60" height="52" rx="10"/><text x="210" y="'+(cy+4)+'" text-anchor="middle" class="pflab">'+escL(w.label||'Haus')+'</text>';
    function node(x,o,i,cnt){var y=ny(i,cnt);return '<rect class="pfnode" x="'+x+'" y="'+y+'" width="110" height="44" rx="9"/><text x="'+(x+11)+'" y="'+(y+18)+'" class="pfnlab">'+esc(o.label||'')+'</text><text x="'+(x+11)+'" y="'+(y+35)+'" class="pfnval"'+(o.vid?' data-vid="'+o.vid+'"':'')+'>–</text>';}
    src.forEach(function(o,i){s+=node(10,o,i,src.length);});
    snk.forEach(function(o,i){s+=node(280,o,i,snk.length);});
    return s+'</svg>';
  }
  function setGaugePro(w,d){
    var ec=_ec[w.id];if(!ec)return;var val=d?parseFloat(d.v):0;if(isNaN(val))val=0;
    var mn=(w.min!=null?w.min:0),mx=(w.max!=null?w.max:100);
    var t1=(w.t1!=null?w.t1:mn+(mx-mn)*0.6),t2=(w.t2!=null?w.t2:mn+(mx-mn)*0.85);
    var f1=Math.max(0,Math.min(1,(t1-mn)/((mx-mn)||1))),f2=Math.max(f1,Math.min(1,(t2-mn)/((mx-mn)||1)));
    ec.setOption({animation:!!bcfg().chartAnim,series:[{type:'gauge',min:mn,max:mx,radius:'92%',
      axisLine:{lineStyle:{width:9,color:[[f1,cssv('--ok')],[f2,cssv('--warm')],[1,cssv('--crit')]]}},
      pointer:{width:4,length:'60%',itemStyle:{color:cssv('--text')}},progress:{show:false},axisTick:{show:false},
      splitLine:{length:9,lineStyle:{color:cssv('--faint'),width:1}},axisLabel:{color:cssv('--faint'),fontSize:_ecF(w,'axis',9),distance:12},anchor:{show:false},
      title:{show:true,offsetCenter:[0,'72%'],color:cssv('--muted'),fontSize:_ecF(w,'label',10)},
      detail:{valueAnimation:true,fontSize:19,offsetCenter:[0,'38%'],color:cssv('--text'),fontFamily:'ui-monospace,monospace',formatter:(d&&d.f)?String(d.f):'{value}'},
      data:[{value:val,name:w.label||''}]}]},true);
  }
  var MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var DOW=['So','Mo','Di','Mi','Do','Fr','Sa'];
  function pad2(n){return String(n).padStart(2,'0');}
  function fetchCalEvents(w,root){
    var el=$('.w[data-id="'+w.id+'"] [data-role=cal]',(root||canvas));if(!el)return;
    if(!w.calIds){el.innerHTML='<div class="calempty">Kalender-Instanz-IDs im Panel eintragen (z. B. 33020,55959)</div>';return;}
    fetch('?api=cal&ids='+encodeURIComponent(w.calIds)+'&days='+(w.days||14),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var evs=(j&&j.events)||[];el.innerHTML=((w.calview||'agenda')==='month')?calMonth(evs):calAgenda(evs);
    }).catch(function(){el.innerHTML='<div class="calempty">Kalender nicht erreichbar</div>';});
  }
  function calAgenda(evs){
    if(!evs.length)return '<div class="calempty">Keine Termine im Zeitraum</div>';
    var today=new Date();today.setHours(0,0,0,0);var out='',last='';
    evs.forEach(function(e){
      var d=new Date(e.start),key=d.toDateString();
      if(key!==last){last=key;var dd=new Date(d);dd.setHours(0,0,0,0);var diff=Math.round((dd-today)/86400000);
        var lbl=diff===0?'Heute':diff===1?'Morgen':DOW[d.getDay()]+', '+d.getDate()+'. '+MON[d.getMonth()].slice(0,3);
        out+='<div class="cagd">'+lbl+'</div>';}
      var t=e.allDay?'ganztägig':pad2(d.getHours())+':'+pad2(d.getMinutes());
      out+='<div class="cagr"><span class="cagt">'+t+'</span><span class="cagn">'+esc(String(e.title||''))+'</span></div>';
    });
    return '<div class="cagenda">'+out+'</div>';
  }
  function calMonth(evs){
    var now=new Date(),y=now.getFullYear(),m=now.getMonth(),dayset={};
    evs.forEach(function(e){var d=new Date(e.start);if(d.getFullYear()===y&&d.getMonth()===m)dayset[d.getDate()]=1;});
    var startDow=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
    var h='<div class="hcalh">'+MON[m]+' '+y+'</div><div class="hcalg">';
    ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(function(d){h+='<div class="d hd">'+d+'</div>';});
    for(var i=0;i<startDow;i++)h+='<div class="d"></div>';
    for(var dd=1;dd<=days;dd++)h+='<div class="d'+(dd===now.getDate()?' today':'')+'">'+dd+(dayset[dd]?'<span class="cadot"></span>':'')+'</div>';
    return h+'</div>';
  }
  function tick(){
    var now=new Date();function p(n){return String(n).padStart(2,'0');}
    function _one(w){
      if(w.type==='suncard'){refreshSun(w);return;}
      if(w.type!=='clock'&&w.type!=='timer')return;
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
      if(w.type==='clock'){var t=$('[data-role=time]',el);if(t)t.textContent=p(now.getHours())+':'+p(now.getMinutes());var dt=$('[data-role=date]',el);if(dt)dt.textContent=['So','Mo','Di','Mi','Do','Fr','Sa'][now.getDay()]+', '+now.getDate()+'.'+(now.getMonth()+1)+'.';}
      else{var d=_lastVals[w.varId];if(!d)return;var v=parseFloat(d.v);if(isNaN(v))return;var rem=v>1e9?Math.max(0,v-Math.floor(now.getTime()/1000)):Math.max(0,v);var mm=Math.floor(rem/60),ss=Math.floor(rem%60),tt=$('[data-role=time]',el);if(tt)tt.textContent=(mm>=60?Math.floor(mm/60)+':'+p(mm%60):p(mm))+':'+p(ss);var tot=w.max||3600,bar=$('[data-role=bar]',el);if(bar)bar.style.width=Math.max(0,Math.min(100,rem/tot*100))+'%';}
    }
    allWidgets().forEach(_one);   // Seiteninhalt UND Leisten (Uhr/Timer/Sonne)
    if(_compKids&&_compKids.length)_compKids.forEach(_one); // Uhr/Timer/Sonne in Komponenten
    if(_contKids&&_contKids.length)_contKids.forEach(_one); // ... und in Containern
    if(_tickKids&&_tickKids.length)_tickKids.forEach(_one); // ... und in der Laufzeile
  }
  setInterval(tick,1000);
  // Relative Pfade (z. B. IPS-HTML mit ./preview/... ) gegen eine Basis auflösen -> absolute URLs, damit Bilder im Widget laden.
  function _htmlAbs(u,base){if(u==null)return u;u=(''+u).trim();if(u===''||/^(https?:|data:|blob:|mailto:|tel:|javascript:|#)/i.test(u)||u.slice(0,2)==='//'||u.charAt(0)==='/')return u;try{return new URL(u,base).href;}catch(e){return u;}}
  function _htmlBase(w,pd){var b=(w&&w.htmlBase||'').trim();if(b){if(!/^https?:/i.test(b))b=location.origin+(b.charAt(0)==='/'?'':'/')+b;return b.replace(/\/?$/,'/');}try{var bt=pd&&pd.querySelector('base[href]');if(bt)return new URL(bt.getAttribute('href'),location.origin+'/').href;}catch(e){}return location.origin+'/';} // Standard = Server-Wurzel (dort liegen /preview, /tile ...)
  function _htmlRewriteUrls(root,base){try{
    root.querySelectorAll('[src],[href],[poster],[data-src]').forEach(function(e){['src','href','poster','data-src'].forEach(function(a){if(e.hasAttribute(a)){var v=e.getAttribute(a),n=_htmlAbs(v,base);if(n!==v)e.setAttribute(a,n);}});});
    root.querySelectorAll('[srcset]').forEach(function(e){e.setAttribute('srcset',e.getAttribute('srcset').split(',').map(function(p){var x=p.trim().split(/\s+/);if(x[0])x[0]=_htmlAbs(x[0],base);return x.join(' ');}).join(', '));});
    var urlRe=/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,rep=function(m,q,u){return 'url('+q+_htmlAbs(u,base)+q+')';};
    root.querySelectorAll('[style]').forEach(function(e){var st=e.getAttribute('style'),n=st.replace(urlRe,rep);if(n!==st)e.setAttribute('style',n);});
    root.querySelectorAll('style').forEach(function(s){var t=s.textContent,n=t.replace(urlRe,rep);if(n!==t)s.textContent=n;});
  }catch(e){}}
  // ---- Skin-Enforcer für HTML: Skin-Schrift + Textfarben, die zum Theme nicht passen, auf Standard-Textfarbe ----
  var _lumEl=null;
  function _lum(c){if(!c)return null;try{if(!_lumEl){_lumEl=document.createElement('span');_lumEl.style.cssText='position:absolute;left:-9999px';document.body.appendChild(_lumEl);}_lumEl.style.color='#7f7f7f';_lumEl.style.color=c;var rc=getComputedStyle(_lumEl).color,m=rc.match(/(\d+)\D+(\d+)\D+(\d+)/);if(!m)return null;return (0.2126*+m[1]+0.7152*+m[2]+0.0722*+m[3])/255;}catch(e){return null;}}
  function _skinVars(){var cs=getComputedStyle(canvas);var text=(cs.getPropertyValue('--text')||'').trim()||cs.color;var bg=(cs.getPropertyValue('--bg')||'').trim()||(cs.getPropertyValue('--surface')||'').trim()||'#111';var font=cs.fontFamily||'system-ui,sans-serif';var bl=_lum(bg);return {text:text,font:font,dark:(bl==null?true:bl<0.5)};}
  // Fixe Textfarbe nur nutzen, wenn sie zum tatsächlichen Hintergrund genug Kontrast hat — sonst Theme-Textfarbe (verhindert dunkel-auf-dunkel bei fixem fg)
  function _readableFg(fg,bg){try{if(!fg)return '';var Lf=_lum(fg);if(Lf==null)return fg;var b=bg||cssv('--surface')||'#141c1f';var Lb=_lum(b);if(Lb==null)return fg;return (Math.abs(Lf-Lb)<0.25)?'':fg;}catch(e){return fg;}}
  function _fixHtmlColors(rootEl,v){try{var els=rootEl.querySelectorAll('*'),n=Math.min(els.length,3000),i;for(i=0;i<n;i++){var el=els[i];var L=_lum(getComputedStyle(el).color);if(L==null)continue;if((v.dark&&L<0.35)||(!v.dark&&L>0.7))el.style.setProperty('color',v.text,'important');}}catch(e){}} // nur nicht zum Theme passende Farben ersetzen
  function setHtmlContent(w,t,root){var host=$('.w[data-id="'+w.id+'"] [data-role=htmlhost]',(root||canvas));if(!host)return;t=(t&&t.length)?t:'';
    var mode=w.htmlMode||'auto';if(mode==='auto')mode=/<script[\s>]/i.test(t)?'iframe':'shadow'; // JS -> iframe, sonst Shadow DOM
    host.innerHTML=''; // frischer Container (erlaubt Moduswechsel; Shadow lässt sich nicht wieder abnehmen)
    if(mode==='iframe'){
      var base=_htmlBase(w,null);
      var f=document.createElement('iframe');
      f.setAttribute('sandbox','allow-same-origin allow-scripts allow-popups');
      f.style.cssText='width:100%;height:100%;border:0;background:transparent';
      f.onload=function(){try{var d=f.contentDocument;if(d&&d.body){d.documentElement.style.background='transparent';d.body.style.background='transparent';d.body.style.margin='0';if(w.htmlSkin!==false){var v=_skinVars();var st=d.createElement('style');st.textContent='body{color:'+v.text+';font-family:'+v.font+'}body *{font-family:inherit!important}';(d.head||d.body).appendChild(st);_fixHtmlColors(d.body,v);}}}catch(e){}applyHtmlScale(w);};
      host.appendChild(f);
      f.srcdoc='<!doctype html><meta charset="utf-8"><base href="'+base+'"><style>html,body{margin:0;background:transparent!important}</style>'+t; // <base> löst relative Pfade auf
      return;
    }
    // Voll-Dokumente (<html>/<head>/<body>) werden in Shadow-DOM-innerHTML verworfen -> per DOMParser Body+Head-Styles extrahieren
    var headHtml='',bodyHtml=t,pd=null;
    try{pd=new DOMParser().parseFromString(t,'text/html');}catch(e){}
    var base=_htmlBase(w,pd);
    if(pd){_htmlRewriteUrls(pd,base);if(pd.head)headHtml=pd.head.innerHTML;if(pd.body&&pd.body.innerHTML.trim()!=='')bodyHtml=pd.body.innerHTML;} // relative -> absolute (Shadow DOM ignoriert <base>, daher Rewrite)
    var c=document.createElement('div');c.setAttribute('data-role','shchild');c.style.cssText='width:100%;height:100%';
    host.appendChild(c);
    var sh=c.attachShadow({mode:'open'}); // Shadow DOM: transparent + style-isoliert (iOS-Weiß-Bug entfällt)
    var _skin=(w.htmlSkin!==false)?_skinVars():null; // Skin erzwingen (Schrift + nicht passende Farben)
    var _skinCss=_skin?('#shwrap{color:'+_skin.text+';font-family:'+_skin.font+'}#shwrap *{font-family:inherit!important}'):'';
    sh.innerHTML='<style>:host{display:block;background:transparent;-webkit-text-size-adjust:100%;text-size-adjust:100%}#shwrap{transform-origin:top left;background:transparent;-webkit-text-size-adjust:100%;text-size-adjust:100%}'+_skinCss+'</style>'+headHtml+'<div id="shwrap">'+bodyHtml+'</div>';
    if(_skin){var _wrp=sh.getElementById('shwrap');if(_wrp)_fixHtmlColors(_wrp,_skin);}
    applyHtmlScale(w);}
  function fetchHtml(w,root){if(!w.varId)return;fetch('?api=html&id='+w.varId,{cache:'no-store'}).then(function(r){return r.text();}).then(function(t){setHtmlContent(w,t,root);}).catch(function(){});}
  function applyHtmlScale(w){
    if(w.type!=='html')return;
    var host=$('.w[data-id="'+w.id+'"] [data-role=htmlhost]',canvas);if(!host)return;
    var f=host.querySelector('iframe');
    if(f){ // iframe-Modus (JS): Skalierung über body.zoom
      var fit=(w.htmlFit==='width'||w.htmlFit==='both');
      try{var d=f.contentDocument;if(!d||!d.body)return;var b=d.body,h=d.documentElement;b.style.transformOrigin='top left';
        if(fit){b.style.zoom='';h.style.overflow='visible';var nw=Math.max(b.scrollWidth,h.scrollWidth,1),nh=Math.max(b.scrollHeight,h.scrollHeight,1);b.style.zoom=(w.htmlFit==='both')?Math.min(f.clientWidth/nw,f.clientHeight/nh):(f.clientWidth/nw);h.style.overflow='hidden';}
        else{h.style.overflow='';b.style.zoom=((w.htmlZoom||100)/100);}
      }catch(e){}
      return;
    }
    var c=host.querySelector('[data-role=shchild]');if(!c||!c.shadowRoot)return;
    var wrap=c.shadowRoot.getElementById('shwrap');if(!wrap)return;
    wrap.style.transform='';
    if(w.htmlFit==='width'||w.htmlFit==='both'){
      var nw2=Math.max(wrap.scrollWidth,1),nh2=Math.max(wrap.scrollHeight,1);
      wrap.style.transform='scale('+((w.htmlFit==='both')?Math.min(host.clientWidth/nw2,host.clientHeight/nh2):(host.clientWidth/nw2))+')';
    }else{
      var z=(w.htmlZoom||100)/100;if(z!==1)wrap.style.transform='scale('+z+')';
    }
  }
  setInterval(function(){allWidgets().forEach(function(w){if((w.type==='chart'||w.type==='spark')&&w.ctype!=='waterfall'&&w.ctype!=='barrace'&&!(_wsOK&&bcfg().noSafetyPoll))fetchHist(w);if(w.type==='html'&&w.htmlSrc!=='custom')fetchHtml(w);if(w.type==='weekplan')fetchWeekplan(w);if(w.type==='calendar')fetchCalEvents(w);if(w.type==='eventctl')fetchEvent(w);if(w.type==='objinfo')fetchObjInfo(w);if(w.type==='statetl')_stlFetch(w);if(w.type==='statelog')_slogFetch(w);if(w.type==='table')_tblLoad(w);});},60000);
  setInterval(function(){var now=Date.now();allWidgets().forEach(function(w){if(w.type==='camera'||w.type==='campro'){var iv=((w.refresh>0)?w.refresh:15)*1000;if(!w._lastCam||now-w._lastCam>=iv){w._lastCam=now;refreshCam(w);}}});},1000);

  // ---------- Auswahl & Eigenschaften ----------
  var sel={},clip=[];
  // ---------- Undo/Redo (History der aktuellen Ansicht) ----------
  var hist=[],hpos=-1,restoring=false;
  function commit(){if(restoring)return;invalidateSC();var s=JSON.stringify(_snap());if(hist[hpos]===s)return;hist=hist.slice(0,hpos+1);hist.push(s);hpos=hist.length-1;if(hist.length>80){hist.shift();hpos--;}updateUndo();invalidateAllIds();markDirty();scheduleSave();}
  function _snap(){return {v:state,c:store.chrome||[]};}   // Verlauf umfasst Seite UND Leisten
  function resetHist(){hist=[JSON.stringify(_snap())];hpos=0;updateUndo();}
  function updateUndo(){var u=$('#undoBtn'),r=$('#redoBtn');if(u)u.disabled=(hpos<=0);if(r)r.disabled=(hpos>=hist.length-1);}
  function applyHist(){restoring=true;var o=JSON.parse(hist[hpos]);var v=(o&&o.v)?o.v:o;   // aeltere Eintraege enthalten nur die Seite
    store.views[store.current]=v;state=v;if(o&&o.c)store.chrome=o.c;
    selClear();render();renderProps();if(typeof chromeUI==='function')chromeUI();restoring=false;updateUndo();}
  function undo(){if(hpos>0){hpos--;applyHist();}}
  function redo(){if(hpos<hist.length-1){hpos++;applyHist();}}
  function selClear(){sel={};selId=null;}
  function _grpMaster(mem){var e=mem.filter(function(m){return m.gmaster;})[0];if(e)return e;var b=mem[0];for(var i=1;i<mem.length;i++)if((mem[i].w*mem[i].h)>(b.w*b.h))b=mem[i];return b;} // Master = gesetzt, sonst flächengrößtes
  function updateGroupBoxes(){ // gestrichelter Rahmen um ausgewählte Gruppe(n) + Master-Marker
    $$('.groupbox,.gmbadge',canvas).forEach(function(e){e.remove();});
    if(mode!=='edit')return;
    var groups={};Object.keys(sel).forEach(function(id){var w=widget(id);if(w&&w.group)groups[w.group]=1;});
    for(var g in groups){var mem=state.widgets.filter(function(x){return x.group===g;});if(mem.length<2)continue;
      var bx=1e9,by=1e9,bR=-1e9,bB=-1e9;mem.forEach(function(m){if(m.x<bx)bx=m.x;if(m.y<by)by=m.y;if(m.x+m.w>bR)bR=m.x+m.w;if(m.y+m.h>bB)bB=m.y+m.h;});
      var pad=5,d=document.createElement('div');d.className='groupbox';d.style.left=(bx-pad)+'px';d.style.top=(by-pad)+'px';d.style.width=(bR-bx+2*pad)+'px';d.style.height=(bB-by+2*pad)+'px';canvas.appendChild(d);
      var mm=_grpMaster(mem);
      if(mm){var b=document.createElement('div');b.className='gmbadge';b.textContent='M';b.title='Master';b.style.left=mm.x+'px';b.style.top=mm.y+'px';canvas.appendChild(b);}
    }
  }
  function markSel(){$$('.w',canvas).forEach(function(e){e.classList.toggle('sel',!!sel[e.dataset.id]);});
    $$('.chrome',canvas).forEach(function(e){e.classList.toggle('sel',!!sel[e.dataset.chrome]);}); // Leisten mitmarkieren
    updateGroupBoxes();}
  function select(id,additive){
    if(id==null){selClear();}
    else if(additive){if(sel[id]){delete sel[id];if(selId===id)selId=Object.keys(sel)[0]||null;}else{sel[id]=true;selId=id;}}
    else{sel={};var _sw=widget(id);if(_sw&&_sw.group){state.widgets.forEach(function(x){if(x.group===_sw.group)sel[x.id]=true;});}else sel[id]=true;selId=id;} // Gruppe: ganze Gruppe wählen
    markSel();try{renderProps();}catch(_e){console.error('renderProps',_e);}if(id!=null&&!additive)showTab('props'); // renderProps darf Auswahl/Drag nie blockieren
  }
  function namedWidgets(excludeId){var out=[];for(var vn in store.views){(store.views[vn].widgets||[]).forEach(function(x){if(x.name&&x.id!==excludeId)out.push({name:x.name,type:x.type,view:vn,id:x.id});});}
    // Leisten-Kinder gehoeren zu keiner Ansicht - ohne sie liessen sich Widgets aus Bar/Sidebar
    // nicht in einer Laufzeile referenzieren.
    try{chromeList().forEach(function(b){(b.widgets||[]).forEach(function(x){if(x.name&&x.id!==excludeId)out.push({name:x.name,type:x.type,view:(b.name||'Leiste'),id:x.id});});});}catch(e){}
    return out;} // alle benannten Widgets (alle Ansichten)
  function widgetByName(name){if(!name)return null;for(var vn in store.views){var f=(store.views[vn].widgets||[]).filter(function(x){return x.name===name;})[0];if(f)return f;}
    try{var k=chromeAllKids().filter(function(x){return x.name===name;})[0];if(k)return k;}catch(e){}
    return null;}
  function widget(id){var w=state.widgets.filter(function(x){return x.id===id;})[0];if(w)return w;
    var ck0=chromeAllKids().filter(function(x){return x.id===id;})[0];if(ck0)return ck0; /* Widget in einer Leiste */
    var cd0=chromeDef(id);if(cd0)return cd0; /* die Leiste selbst (fuer Auswahl + Eigenschaften) */
    if(_compKids&&_compKids.length){var ck=_compKids.filter(function(x){return x.id===id;})[0];if(ck)return ck;}if(_contKids&&_contKids.length){var kk=_contKids.filter(function(x){return x.id===id;})[0];if(kk)return kk;}if(_tickKids&&_tickKids.length){var tk=_tickKids.filter(function(x){return x.id===id;})[0];if(tk)return tk;}if(_popup&&_popup.widgets)return _popup.widgets.filter(function(x){return x.id===id;})[0];return w;}
  // A1: Overlay/Popup — eine Ansicht als schwebendes Fenster über der aktuellen Ansicht
  var _popup=null;
  var _navStack=[]; // B3: Seiten-Verlauf für Zurück-Navigation
  function navGo(name){if(!store.views[name])return;closeHover();if(store.current&&store.current!==name)_navStack.push(store.current);switchView(name);fitCanvas();}
  function navBack(){if(_navStack.length){switchView(_navStack.pop());fitCanvas();}}
  function _aliasMap(w){var m={};(w.alias||[]).forEach(function(a){var f=parseInt(a.from),t=parseInt(a.to);if(f&&t)m[f]=t;});return m;}
  // Ein Widget-Element fuer ein Overlay (Popup ODER Hover) bauen — identische Darstellung wie auf der Seite.
  function _ovWidgetEl(w){
    var dd=document.createElement('div');dd.className='w t-'+w.type+(w.lineMode?' wline':'');dd.dataset.id=w.id;
    var _ak=_wActionKind(w,true);if(_ak)_ak.split(' ').forEach(function(c){dd.classList.add(c);});
    dd.style.left=w.x+'px';dd.style.top=w.y+'px';dd.style.width=w.w+'px';dd.style.height=w.h+'px';
    dd.innerHTML='<div class="winner">'+widgetInner(w)+'</div>';
    if(w.type==='value'&&w.valfs){var vv=$('.v',dd);if(vv)vv.style.fontSize=w.valfs+'px';}
    if(w.bgT)dd.classList.add('bg-t');
    if(w.lblWrap)dd.classList.add('lbl-wrap');
    if(w.bg&&!w.bgT)dd.style.background=w.bg;if(w.fg){var _rf2=_readableFg(w.fg,(w.bgT?null:w.bg));if(_rf2)dd.style.color=_rf2;}
    if(w.iconColor)dd.style.setProperty('--wicon',_skinColor(w.iconColor)||w.iconColor);
    if(_hasIconGfx(w)){var _ie=dd.querySelector('.iconwrap,.wvic,.swic,.htbadge,.htico,.hbicon,.hl2ic,.hchipic,.hricon,.hkbi,.hassoc-chip,.hvicon,[data-role=badge]');if(_ie)_applyIconGfx(w,_ie);}
    if(w.textTransform)dd.style.textTransform=w.textTransform;
    return dd;
  }
  // Alias-Remap der Widget-Kopien einer Overlay-Ansicht (Popup/Hover)
  function _ovClone(v,alias){var map=alias||{};function mp(id){return (id&&map[id]!=null)?map[id]:id;}
    return (v.widgets||[]).map(function(w){var c={};for(var k in w)c[k]=w[k];c.varId=mp(c.varId);c.varId2=mp(c.varId2);c.varId3=mp(c.varId3);if(c.visVar)c.visVar=mp(c.visVar);return c;});}
  // ---- Hover-Overlay: eine Ansicht als Flyout am Widget (Desktop-Hover; Touch nur als Fallback) ----
  var _hover=null;
  function openHover(name,alias,anchorEl){
    if(!name||!store.views[name]||!anchorEl)return;
    if(_hover&&_hover.name===name&&_hover.anchor===anchorEl)return; // bereits offen fuer dieses Widget
    closeHover();
    var v=store.views[name],ws=_ovClone(v,alias);
    var pw=(v.page&&v.page.w)||400,ph=(v.page&&v.page.h)||300;
    var maxW=Math.min(window.innerWidth*0.6,520),maxH=Math.min(window.innerHeight*0.7,480);
    var sc=Math.min(1,maxW/pw,maxH/ph);
    var hl=$('#hoverlay'),hc=$('#hovcanvas');if(!hl||!hc)return;
    var fw=Math.round(pw*sc),fh=Math.round(ph*sc);
    hc.style.width=pw+'px';hc.style.height=ph+'px';hc.style.transform='scale('+sc+')';
    hl.style.width=fw+'px';hl.style.height=fh+'px';
    hc.innerHTML='';ws.forEach(function(w){hc.appendChild(_ovWidgetEl(w));});
    _hover={name:name,widgets:ws,anchor:anchorEl};
    var r=anchorEl.getBoundingClientRect(),gap=8; // Flyout am Anker (unten, sonst oben; horizontal einpassen)
    var top=r.bottom+gap;if(top+fh>window.innerHeight-8)top=Math.max(8,r.top-gap-fh);
    var left=r.left;if(left+fw>window.innerWidth-8)left=window.innerWidth-8-fw;if(left<8)left=8;
    hl.style.left=left+'px';hl.style.top=top+'px';hl.classList.add('open');
    invalidateVidx();
    _hover.widgets.forEach(function(w){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);});
    _hover.widgets.forEach(function(w){activateWidget(w,hc);});
    _hover.widgets.forEach(function(w){var wc=WIDGETS[w.type];if(wc&&wc.mount){try{wc.mount(w);}catch(e){}}});
    _pvSince=0;pollVals();
  }
  function closeHover(){var hl=$('#hoverlay');if(hl)hl.classList.remove('open');var hc=$('#hovcanvas');if(hc)hc.innerHTML='';_hover=null;invalidateVidx();}
  function openPopup(name,alias){
    if(!name||!store.views[name]){toast('Popup-Seite fehlt: '+name);return;}
    closeHover(); // ein Popup schliesst einen offenen Hover-Flyout
    closePopup();
    var v=store.views[name],ws=_ovClone(v,alias);
    _popup={name:name,widgets:ws,page:(v.page||{w:1440,h:900})};
    var oc=$('#ovcanvas'),card=$('#ovcard');if(!oc||!card)return;
    _popupFit(); // Stretch analog zur Seite (hoch UND runter, refit bei Resize)
    oc.innerHTML='';
    _popup.widgets.forEach(function(w){oc.appendChild(_ovWidgetEl(w));});
    $('#overlay').classList.add('open');
    invalidateVidx(); // Popup-Widgets in den Index aufnehmen, bevor Werte gesetzt werden
    _popup.widgets.forEach(function(w){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);});
    // Widgets im Popup genauso in Betrieb nehmen wie auf einer Seite - vorher fehlte das
    // vollstaendig, weshalb Diagramme (auch Wasserfall), Kameras, HTML, Wochenplan,
    // Sonnenbogen, Kalender, Ereignis- und Objekt-Kacheln sowie Thermostate leer blieben.
    _popup.widgets.forEach(function(w){activateWidget(w,oc);});
    _popup.widgets.forEach(function(w){var wc=WIDGETS[w.type];if(wc&&wc.mount){try{wc.mount(w);}catch(e){}}}); // mount-Hooks im Popup (wsmon/msglog/suncard … initialisieren + Timer starten)
    _pvSince=0;pollVals();
  }
  // Popup analog zur Seite einpassen: skaliert HOCH und runter (kein 1er-Deckel) auf
  // max. 94% Breite / 90% Hoehe des Viewports; wird bei jedem Resize neu berechnet.
  function _popupFit(){
    if(!_popup)return; var oc=$('#ovcanvas'),card=$('#ovcard');if(!oc||!card)return;
    var pw=_popup.page.w||1440,ph=_popup.page.h||900;
    // DEN Faktor der Main-Seite verwenden (letterboxFit der aktuellen Seite), NICHT
    // das Popup an die Viewport-Hoehe anpassen. Popup bleibt in Originalabmessungen,
    // nur mit demselben Faktor skaliert wie die darunterliegende Seite.
    var mw=(state&&state.page&&state.page.w)||pw,mh=(state&&state.page&&state.page.h)||ph;
    var sc=Math.min(window.innerWidth/mw,window.innerHeight/mh); if(!(sc>0))sc=1;
    oc.style.width=pw+'px';oc.style.height=ph+'px';oc.style.transformOrigin='top left';oc.style.transform='scale('+sc+')';
    card.style.width=Math.round(pw*sc)+'px';card.style.height=Math.round(ph*sc)+'px';
  }
  window.addEventListener('resize',function(){if(_popup)_popupFit();});
  function closePopup(){var ov=$('#overlay');if(ov)ov.classList.remove('open');var oc=$('#ovcanvas');if(oc)oc.innerHTML='';_popup=null;invalidateVidx();}
  // M3: Custom Controls — eine Ansicht als parametrierbare, wiederverwendbare Komponente (Master), Instanzen remappen IDs (Alias)
  var _compKids=[];
  var _contKids=[]; // Container-Kinder: echte, editierbare Widget-Instanzen (liegen in w.kids)
  var _cbase={};    // Laufzeit: contId -> {w,h} eingefrorene Artboard-Größe im Editor (NICHT persistiert)
  function _contBBox(w){var cw=0,ch=0;(w.kids||[]).forEach(function(k){if(k&&k.type!=='container'){cw=Math.max(cw,(k.x||0)+(k.w||0));ch=Math.max(ch,(k.y||0)+(k.h||0));}});return {w:Math.max(20,cw+6),h:Math.max(20,ch+6)};}
  var _tickKids=[]; // Ticker-Laufband: darin laufende Widget-Instanzen (Live wie _compKids)
  var _regions={}; // B2: Slot-Name -> aktuell angezeigte Ansicht (Laufzeit)
  function setRegion(slot,view){if(!slot)return;_regions[slot]=view;render();}
  function expandComponent(w){
    var host=$('.w[data-id="'+w.id+'"] [data-role=comphost]',canvas);if(!host)return;
    var srcName=(w.slot&&_regions[w.slot])||w.comp;
    if(!srcName||!store.views[srcName]){host.innerHTML='<div style="padding:8px;font-size:11px;color:var(--faint)">'+(w.slot?'Region „'+esc(w.slot)+'"':'Komponente wählen …')+'</div>';return;}
    if(srcName===store.current){host.innerHTML='<div style="padding:8px;font-size:11px;color:var(--warn)">Selbstbezug – andere Ansicht wählen</div>';return;}
    var src=store.views[srcName],sw=(src.page&&src.page.w)||400,sh=(src.page&&src.page.h)||300,sc=Math.min(w.w/sw,w.h/sh);
    var map={};(w.alias||[]).forEach(function(a){var f=parseInt(a.from),t=parseInt(a.to);if(f&&t)map[f]=t;});
    function mp(id){return (id&&map[id]!=null)?map[id]:id;}
    var inner='<div class="compinner" style="position:absolute;left:0;top:0;width:'+sw+'px;height:'+sh+'px;transform-origin:top left;transform:scale('+sc+');pointer-events:'+(mode==='edit'?'none':'auto')+'">';
    (src.widgets||[]).forEach(function(mw){var c={};for(var k in mw)c[k]=mw[k];c.id=w.id+'__'+mw.id;c.varId=mp(c.varId);c.varId2=mp(c.varId2);c.varId3=mp(c.varId3);if(c.visVar)c.visVar=mp(c.visVar);
      inner+='<div class="w t-'+c.type+(c.lineMode?' wline':'')+(c.bgT?' bg-t':'')+(c.lblWrap?' lbl-wrap':'')+'" data-id="'+c.id+'" style="position:absolute;left:'+c.x+'px;top:'+c.y+'px;width:'+c.w+'px;height:'+c.h+'px'+((c.bg&&!c.bgT)?';background:'+c.bg:'')+(c.fg?(function(){var r=_readableFg(c.fg,(c.bgT?null:c.bg));return r?';color:'+r:'';})():'')+'"><div class="winner">'+widgetInner(c)+'</div></div>';
      _compKids.push(c);});
    host.innerHTML=inner+'</div>';}
  // ---- Container: Kinder (w.kids) einbetten; Kinder sind echte, editierbare Widgets ----
  //  Design-Fläche = Hüllbox aller Kinder. EDIT: 1:1 (kein störendes Auto-Resize; nur wenn der Inhalt die Box
  //  sprengt, schrumpft er soweit, dass alle Kinder sichtbar/editierbar bleiben). BETRIEB/Mobil/Webview:
  //  Inhalt wird proportional auf die Box eingepasst (füllt den Platz, ALLE Kinder sichtbar, nichts abgeschnitten).
  function expandContainer(w){
    var body=$('.w[data-id="'+w.id+'"] [data-role=contbody]',canvas);if(!body)return;
    if(w.baseW!==undefined||w.baseH!==undefined){delete w.baseW;delete w.baseH;} // Altlast eines früheren Fixes entfernen (falsches Artboard) -> beim nächsten commit weg
    var pw=body.clientWidth||w.w, ph=body.clientHeight||w.h;
    // Artboard = Hüllbox der Kinder. Editor: pro Sitzung EINGEFROREN (_cbase) -> ein Kind verschieben skaliert
    // NICHTS neu; nur Hinzufügen/Entfernen (contFitBase) friert neu ein. Betrieb/Mobil/Webview: direkt aus der
    // Hüllbox (Kinder sind dort statisch). Nichts wird persistiert -> keine Layout-Korruption. Maßstab wie gewohnt:
    // Editor = 1:1 (nur verkleinern, falls Inhalt größer als Body); Betrieb = proportional einpassen.
    var bb=(mode==='edit')?(_cbase[w.id]||(_cbase[w.id]=_contBBox(w))):_contBBox(w);
    var bw=bb.w, bh=bb.h;
    var fit=Math.min(pw/bw,ph/bh); if(!isFinite(fit)||fit<=0)fit=1;
    var sc=(mode==='edit')?Math.min(1,fit):fit;
    body.innerHTML='';
    var inner=document.createElement('div');inner.className='continner';inner.setAttribute('data-role','continner');inner.dataset.sc=sc;
    inner.style.cssText='position:absolute;left:0;top:0;width:'+bw+'px;height:'+bh+'px;transform-origin:top left;transform:scale('+sc+')';
    body.appendChild(inner);
    (w.kids||[]).forEach(function(k){if(!k||k.type==='container')return; try{var _ke=_mkWidgetEl(k);_ke.classList.add('contkid');inner.appendChild(_ke);_contKids.push(k);}catch(e){}}); // (kein Container-in-Container in v1)
  }
  function containerOfKid(id){for(var i=0;i<state.widgets.length;i++){var c=state.widgets[i];if((c.type==='container'||c.type==='alarmpanel')&&c.kids){for(var j=0;j<c.kids.length;j++)if(c.kids[j]&&c.kids[j].id===id)return {cont:c,kid:c.kids[j],idx:j};}}return null;}
  // Strukturelle Änderung (Kind rein/raus/gelöscht) -> eingefrorenes Artboard verwerfen, beim nächsten Render neu aus der Hüllbox
  function contFitBase(c){if(c)delete _cbase[c.id];}
  function containerScreenScale(contId){var inr=$('.w[data-id="'+contId+'"] [data-role=continner]',canvas);var s=inr?parseFloat(inr.dataset.sc):1;return (isFinite(s)&&s>0)?s:1;}
  function containerInnerRect(contId){var inr=$('.w[data-id="'+contId+'"] [data-role=continner]',canvas);return inr?inr.getBoundingClientRect():null;}
  // Container unter einem Bildschirmpunkt (px,py = Canvas-Koordinaten/zoom), ausser den mitgezogenen IDs
  function containerHitTest(px,py,exclude){exclude=exclude||{};var hit=null;
    state.widgets.forEach(function(c){if((c.type!=='container'&&c.type!=='alarmpanel')||exclude[c.id])return;if(px>=c.x&&px<=c.x+c.w&&py>=c.y&&py<=c.y+c.h)hit=c;});return hit;}
  // Wert-Format pro Widget
  var FMTS={auto:'Original',kw:'kW',kwh:'kWh',w:'W',r0:'0 Dez.',r1:'1 Dez.',pct:'Prozent',time:'Uhrzeit',date:'Datum',rel:'Relativzeit'};
  var FMT_TYPES=['value','bar','chip','tile','room','sun','thermostat','weather','light','cover','slider','valuecard','stepper'];
  function fmtOpts(cur){cur=cur||'auto';return Object.keys(FMTS).map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+FMTS[k]+'</option>';}).join('');}
  function selOf(id,cur,opts){cur=cur||opts[0];return '<select id="'+id+'">'+opts.map(function(s){return '<option value="'+s+'"'+(s===cur?' selected':'')+'>'+s+'</option>';}).join('')+'</select>';}
  function dirSel(id,cur){cur=cur||'up';return '<select id="'+id+'"><option value="up"'+(cur==='up'?' selected':'')+'>▲ auf</option><option value="dn"'+(cur==='dn'?' selected':'')+'>▼ ab</option><option value="flat"'+(cur==='flat'?' selected':'')+'>→ neutral</option></select>';}
  function offSel(id,cur,withLast){cur=cur||'1d';var o=(withLast?'<option value="last"'+(cur==='last'?' selected':'')+'>Letzter Wert</option>':'')+Object.keys(OFFS).map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+OFFLBL[k]+'</option>';}).join('');return '<select id="'+id+'">'+o+'</select>';}
  // opt (optional): {max:n} begrenzt die Zeilen und blendet den „Serie"-Knopf aus, {simple:1} laesst Typ/Achse weg.
  // Wird von ctype 'spark' genutzt (setSpark zeichnet nur chartSeries(w)[0] und ignoriert Typ/Achse).
  function seriesEditor(w,opt){
    opt=opt||{};
    var arr=_ensureSeries(w);
    if(!arr.length&&opt.max){_ensureSeries(w);w.series.push({vid:0,name:'',color:'',type:'',axis:0});arr=w.series;} // Sparkline: eine leere Zeile anbieten
    var TY=[['','Auto'],['line','Linie'],['spline','Linie glatt'],['area','Fläche'],['areaspline','Fläche glatt'],['step','Stufen'],['steparea','Stufenfläche'],['bar','Balken'],['scatter','Punkte']];
    var SK=[['','Auto'],['accent','Akzent'],['info','Info'],['warm','Warm'],['ok','OK'],['warn','Warnung'],['crit','Kritisch'],['muted','Gedämpft']];
    var isPart=['pie','donut','rose'].indexOf(w.ctype||'area')>=0||!!opt.simple;
    if(opt.max)arr=arr.slice(0,opt.max);
    var h='<div class="pgh">'+(opt.simple?'Variable (ID · Name · Farbe)':'Serien (Variable · Name · Farbe · Typ · Achse)')+'</div>';
    arr.forEach(function(s,i){
      h+='<div class="serow" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--line-soft)">'
        +'<input data-sf="'+i+'.vid" value="'+(s.vid||'')+'" placeholder="ID" style="width:52px">'
        +'<button class="btn" data-spick="'+i+'" style="padding:4px 6px;font-size:11px">Var</button>'
        +'<input data-sf="'+i+'.name" value="'+esc(s.name||'')+'" placeholder="Serie '+(i+1)+'" style="flex:1;min-width:70px">'
        +skinSel(String(s.color||''),'data-sf="'+i+'.color" title="Farbe"')
        +(isPart?'':('<select data-sf="'+i+'.type">'+TY.map(function(t){return '<option value="'+t[0]+'"'+((s.type||'')===t[0]?' selected':'')+'>'+t[1]+'</option>';}).join('')+'</select>'))
        +(isPart?'':(function(){var ya=_chYAxes(w),cax=Math.min(Math.max(s.axis|0,0),ya.length-1);return '<select data-sf="'+i+'.axis" title="Achse">'+ya.map(function(a,ai){return '<option value="'+ai+'"'+(cax===ai?' selected':'')+'>'+((a.side||'L')==='R'?'R':'L')+(a.name?(' '+esc(a.name)):(' '+(ai+1)))+'</option>';}).join('')+'</select>';})())
        +'<button class="btn" data-sdel="'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
    });
    if(!(opt.max&&arr.length>=opt.max))h+='<button class="btn" data-sadd="1" style="padding:4px 8px;font-size:11px"><svg class="i"><use href="#ic-plus"/></svg> Serie</button>';
    return h;
  }
  function axesEditor(w){
    var ax=_ensureYAxes(w),h='<div class="pgh">Y-Achsen (Seite · Name · Min/Max · Format)</div>';
    ax.forEach(function(a,i){
      h+='<div class="serow" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:5px">'
        +'<select data-af="'+i+'.side"><option value="L"'+((a.side||'L')==='L'?' selected':'')+'>Links</option><option value="R"'+(a.side==='R'?' selected':'')+'>Rechts</option></select>'
        +'<input data-af="'+i+'.name" value="'+esc(a.name||'')+'" placeholder="Name/Einheit" style="flex:1;min-width:66px">'
        +'<input data-af="'+i+'.min" type="number" value="'+(a.min!=null?a.min:'')+'" placeholder="min" style="width:50px">'
        +'<input data-af="'+i+'.max" type="number" value="'+(a.max!=null?a.max:'')+'" placeholder="max" style="width:50px">'
        +'<select data-af="'+i+'.fmt" title="Zahlenformat dieser Achse"><option value=""'+(!a.fmt?' selected':'')+'>Format …</option><option value="thousand"'+(a.fmt==='thousand'?' selected':'')+'>1.234,5</option><option value="compact"'+(a.fmt==='compact'?' selected':'')+'>1,2k</option></select>'
        +'<input data-af="'+i+'.dec" type="number" min="0" max="6" value="'+(a.dec!=null?a.dec:'')+'" placeholder="Dez" style="width:44px">'
        +(ax.length>1?'<button class="btn" data-adel="'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button>':'')
        +'</div>';
    });
    h+='<button class="btn" data-aadd="1" style="padding:4px 8px;font-size:11px"><svg class="i"><use href="#ic-plus"/></svg> Achse</button>';
    return h;
  }
  // Dial-Geometrie (270°-Bogen, Lücke unten)
  function _dpt(deg){var a=deg*Math.PI/180;return [(50+40*Math.cos(a)).toFixed(2),(50+40*Math.sin(a)).toFixed(2)];}
  function dialTrack(){var s=_dpt(135),e=_dpt(45);return 'M'+s[0]+' '+s[1]+' A40 40 0 1 1 '+e[0]+' '+e[1];}
  function dialProg(fr){fr=Math.max(0,Math.min(1,fr));var s=_dpt(135),e=_dpt(135+270*fr),la=(270*fr>180)?1:0;return 'M'+s[0]+' '+s[1]+' A40 40 0 '+la+' 1 '+e[0]+' '+e[1];}
  function fetchWeekplan(w,root){if(!w.varId)return;var el=$('.w[data-id="'+w.id+'"] [data-role=wpgrid]',(root||canvas));if(!el)return;
    fetch('?api=weekplan&id='+w.varId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.days){el.innerHTML='<div class="hwpempty">kein Wochenplan</div>';return;}
      var dn=['Mo','Di','Mi','Do','Fr','Sa','So'],h='';
      var _nw=new Date(),_nowPct=(_nw.getHours()*60+_nw.getMinutes())/1440*100,_today=(_nw.getDay()+6)%7;
      var _ov={};(w.colors||[]).forEach(function(c){if(c&&c.name)_ov[String(c.name).toLowerCase().trim()]=(c.color==null?'':String(c.color));}); // Widget-Override je Zustand (Rohwert)
      var _OFFN=/^(aus|off|0|false|zu|geschlossen|inaktiv|standby|nein|no)$/i,_OFFC=/^(off|none|aus|zu|-|transparent|blank|)$/i;
      function _wpOff(name,raw){return (raw!=null)?_OFFC.test(String(raw).trim()):_OFFN.test(String(name||'').trim());} // Aus/0/false = aus (leer). Override-Farbe zwingt An (außer sie ist selbst „off/none/leer")
      function _wpCol(g){var nm=(g&&g.name)||'',raw=_ov[nm.toLowerCase().trim()];return (raw!=null&&raw!=='')?(_skinColor(raw)||raw):((g&&g.color)||'#3a4a52');}
      for(var i=0;i<7;i++){var segs=(j.days[i]||[]).map(function(s){var g=(j.groups&&j.groups[s.group]);if(_wpOff((g&&g.name),_ov[String((g&&g.name)||'').toLowerCase().trim()]))return '';return '<i style="left:'+(s.from/1440*100)+'%;width:'+((s.to-s.from)/1440*100)+'%;background:'+_wpCol(g)+'"></i>';}).join('');
        if(i===_today)segs+='<i class="wpnow" style="left:'+_nowPct+'%"></i>';
        h+='<div class="hwpday'+(i===_today?' today':'')+'"><span>'+dn[i]+'</span><div class="hwpcol">'+segs+'</div></div>';}
      el.innerHTML=h;
      var tf=$('.w[data-id="'+w.id+'"] [data-role=wptimes]',(root||canvas));if(tf){function _hm(m){return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+(m%60)).slice(-2);}
        var tl=(j.days[_today]||[]).filter(function(s){var g=(j.groups&&j.groups[s.group]);return !_wpOff((g&&g.name),_ov[String((g&&g.name)||'').toLowerCase().trim()]);}).map(function(s){return _hm(s.from)+'–'+_hm(s.to);}).join(' · ');
        tf.textContent=tl?('Heute ein: '+tl):'Heute: aus';}
    }).catch(function(){el.innerHTML='<div class="hwpempty">Fehler</div>';});}
  function anchorGrid(cur){
    var keys=['tl','tc','tr','ml','mc','mr','bl','bc','br'],g='<div id="pAnchor" style="display:inline-grid;grid-template-columns:repeat(3,18px);gap:3px">';
    keys.forEach(function(k){g+='<button type="button" class="anbtn'+((cur||'mc')===k?' on':'')+'" data-an="'+k+'"></button>';});
    return g+'</div>';
  }
  function respSection(w){
    var locked=SF_LOCK[w.type],pol=w.fit||'',autoLbl=(sfClass(w)==='s'?'Stretch':(SF_NOGROW[w.type]?'Fix':'Skaliert'));
    var opts='<option value=""'+(pol===''?' selected':'')+'>Auto ('+autoLbl+')</option>'+(locked?'':'<option value="fix"'+(pol==='fix'?' selected':'')+'>Fix</option><option value="scale"'+(pol==='scale'?' selected':'')+'>Skaliert</option>')+'<option value="stretch"'+(pol==='stretch'?' selected':'')+'>Stretch</option>';
    var scaleish=(pol==='scale'||pol==='fix'||(pol===''&&sfClass(w)==='x')),pr=sfPrio(w); // zentral, keine zweite Priorität-Logik pflegen
    var h='<div class="pgh">Responsiv (SmartFit)</div>';
    h+=row('Skalierung','<select id="pFit">'+opts+'</select>');
    if(scaleish)h+=row('Anker',anchorGrid(w.anchor||''));
    h+=row('Priorität','<select id="pPrio"><option value="1"'+(pr===1?' selected':'')+'>Fix</option><option value="2"'+(pr===2?' selected':'')+'>Normal</option><option value="3"'+(pr===3?' selected':'')+'>Fokus</option></select>');
    h+=row('Gruppe','<input id="pGrp" value="'+esc(w.grp||'')+'" placeholder="leer = auto">');
    h+=row('Min B/H','<input id="pMinW" type="number" style="width:58px" value="'+(w.minW||'')+'" placeholder="B"> <input id="pMinH" type="number" style="width:58px" value="'+(w.minH||'')+'" placeholder="H">');
    h+=row('Reflow','<label style="font-size:12px;display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="pRHide"'+(w.reflowHide?' checked':'')+'> ausblenden</label>');
    return h;
  }
