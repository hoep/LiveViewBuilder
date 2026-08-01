  // ===== Doku- und Demoseite (/hook/doku) =============================================
  //
  // Die Seiten sind KEINE Parallelwelt: Sie sind der Builder, vorbefuellt aus der
  // Widget-Registry. Ein neu angelegtes Widget erscheint dadurch von selbst.
  //
  // Aufbau je Widget: links die LIVE laufende Vorschau, rechts daneben Zweck und ALLE
  // Optionen im Klartext. Die Erklaerung steht damit AUF der Seite und nicht hinter einem
  // Modus - denn im Bearbeiten-Modus waehlt ein Klick das Widget aus, statt es zu bedienen.
  // Beides zugleich geht nicht; also gehoert der Text auf die Flaeche.
  //
  // Die Widgets sind gruppiert: acht Themenseiten statt einer endlosen Halde. Umschalten
  // ueber die Ansichtsauswahl oben in der Leiste.

  // Breite bewusst schmaler als die uebrigen Ansichten: Bei 1470 px waere die Textspalte
  // rund 145 Zeichen breit - das liest sich schlecht, und im Builder verschwindet der
  // rechte Rand hinter der Variablen-Spalte. 780 px ergeben rund 105 Zeichen je Zeile.
  var DOKU_PAD  = 20;
  var DOKU_PREV = 400;                    // Spaltenbreite der Vorschau
  var DOKU_TXTW = 780;                    // Spaltenbreite der Erklaerung
  var DOKU_TXTX = DOKU_PAD + DOKU_PREV + 24;
  var DOKU_W    = DOKU_TXTX + DOKU_TXTW + DOKU_PAD;

  // Thematische Gruppen. Jedes Widget genau einmal; was hier fehlt, landet in "Weitere" -
  // dadurch faellt ein neu angelegtes Widget auf, statt lautlos zu verschwinden.
  var DOKU_GROUPS = [
    ['Werte & Zahlen',          ['value','valuecard','cval','sval','kpi','delta','calc','chip','icon','bar','meterlist','infolist']],
    ['Schalten & Bedienen',     ['switch','light','button','tile','checkbox','select','slider','colorpick','textbox','cover','thermostat','alarm','vacuum','timer','eventctl']],
    ['Zustand & Listen',        ['assoc','statusgrid','statuslist','devlist','statusimage','table','objinfo','msglog','statelog','statetl']],
    ['Diagramme',               ['chart','gauge','gaugepro','doubledonut','sankey','flow','flowline','windrose','tempbar']],
    ['Wetter, Sonne & Termine', ['weather','weatherpro','sun','suncard','raincard','calendar','weekplan','clock']],
    ['Medien & Inhalte',        ['camera','campro','media','image','html','webview','marquee','ticker']],
    ['Struktur & Layout',       ['text','shape','line','blank','component','room','chromebar','chromesidebar','skinswitch']],
    ['System & Diagnose',       ['wsmon']]
  ];

  // Widgets, die als Einzelstueck nichts zeigen koennen (sie leben in einer Leiste).
  var DOKU_SKIP = {chromebar:1, chromesidebar:1};

  function dokuInfo(t){ return (typeof DOKU_INFO !== 'undefined' && DOKU_INFO[t]) || {}; }

  // Vorschaugroesse, auf die Spaltenbreite begrenzt.
  function dokuSize(t){
    var i = dokuInfo(t), d = WIDGETS[t] || {};
    var s = i.groesse || d.size || [240,140];
    return [Math.max(150, Math.min(DOKU_PREV, parseInt(s[0]) || 240)),
            Math.max(90,  Math.min(460,       parseInt(s[1]) || 140))];
  }

  // Zeilenzahl eines Textblocks abschaetzen. Deutsche Woerter brechen frueh um, darum
  // grosszuegig rechnen - lieber etwas Luft als abgeschnittener Text.
  function dokuLines(txt, w, px){
    var perLine = Math.max(20, Math.floor((w - 26) / (px * 0.56)));
    var n = 0;
    String(txt || '').split('\n').forEach(function(z){
      n += Math.max(1, Math.ceil(z.length / perLine));
    });
    return n;
  }

  // Erklaerung als HTML: je Eigenschaft eine Zeile, der Name fett. Ein reines Text-Widget
  // kann kein Fett - deshalb ein html-Widget im custom-Modus. escH schuetzt vor Fremd-HTML.
  function escH(x){return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function dokuHtml(t){
    var i = dokuInfo(t), h = '<div style="font:12px/1.5 var(--fu,sans-serif);color:var(--muted);padding:2px 2px 6px">';
    if (i.zweck) h += '<div style="margin:0 0 12px;color:var(--text)">' + escH(i.zweck) + '</div>';
    var fs = i.funktionen || [];
    if (fs.length) {
      h += '<div style="font-size:10.5px;font-weight:700;letter-spacing:.04em;color:var(--faint);text-transform:uppercase;margin:0 0 6px">Optionen und Verhalten</div>';
      fs.forEach(function(f){
        h += '<div style="margin:0 0 7px"><b style="color:var(--accent);font-weight:600">'
           + escH(f.name || '') + '</b> — ' + escH(f.beschreibung || '') + '</div>';
      });
    }
    if (i.hinweis) {
      h += '<div style="margin:10px 0 0;padding:7px 9px;border-left:2px solid var(--warn);'
         + 'background:color-mix(in oklab,var(--warn) 8%,transparent);border-radius:4px;color:var(--text)">'
         + '<b style="color:var(--warn)">Zu beachten:</b> ' + escH(i.hinweis) + '</div>';
    }
    return h + '</div>';
  }
  // Zeilenzahl grob schaetzen (fuer die Blockhoehe).
  function dokuTxtLen(t){
    var i=dokuInfo(t),n=0;
    if(i.zweck)n+=Math.ceil(i.zweck.length/95)+1;
    (i.funktionen||[]).forEach(function(f){n+=Math.ceil(((f.name||'').length+(f.beschreibung||'').length+4)/95)+0.3;});
    if(i.hinweis)n+=Math.ceil(i.hinweis.length/85)+1;
    return n+2;
  }

  // Lenkt jede varId-artige Zahl auf den Demo-Pool um - auch tief in Listen (items,
  // series, elements ...). Alles andere bleibt unveraendert.
  var _DOKU_IDK = {varId:1,varId2:1,varId3:1,vid:1,socVid:1,speedVid:1,tankVid:1,subvid:1,homeVid:1,tankVid:1};
  function _dokuRemapDeep(key, val){
    if (val && typeof val === 'object') {
      if (val.length != null) { for (var i=0;i<val.length;i++) val[i]=_dokuRemapWalk(val[i]); return val; }
      return _dokuRemapWalk(val);
    }
    if (_DOKU_IDK[key] && (typeof dokuRemap === 'function')) return dokuRemap(val);
    return val;
  }
  function _dokuRemapWalk(o){
    if (!o || typeof o !== 'object') return o;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o,k)) {
      if (o[k] && typeof o[k] === 'object') _dokuRemapWalk(o[k]);
      else if (_DOKU_IDK[k] && (typeof dokuRemap === 'function')) o[k] = dokuRemap(o[k]);
    }
    return o;
  }

  function buildDokuStore(){
    var views = {}, first = null, zugeordnet = {};
    DOKU_GROUPS.forEach(function(g){ g[1].forEach(function(t){ zugeordnet[t] = 1; }); });
    var rest = Object.keys(WIDGETS).filter(function(t){ return !zugeordnet[t]; }).sort();
    var groups = DOKU_GROUPS.slice();
    if (rest.length) groups.push(['Weitere', rest]);

    groups.forEach(function(g){
      var titel = g[0], typen = g[1].filter(function(t){ return WIDGETS[t]; });
      if (!typen.length) return;
      var ws = [], n = 0, y = DOKU_PAD;
      function add(o){ n++; o.id = 'dk' + n; ws.push(o); }

      add({type:'text', x:DOKU_PAD, y:y, w:DOKU_W-2*DOKU_PAD, h:40, bgT:true, fsz:21,
           label:'Widget-Dokumentation · ' + titel});
      y += 46;
      add({type:'text', x:DOKU_PAD, y:y, w:DOKU_W-2*DOKU_PAD, h:36, bgT:true, fsz:11, fg:'#7d9099',
           label:'Links die Vorschau – sie läuft mit echten Werten und ist bedienbar. Rechts Zweck und '
                +'sämtliche Optionen. Über die Ansichtsauswahl oben zu den anderen Themen.'});
      y += 46;

      typen.forEach(function(t){
        var info = dokuInfo(t), def = WIDGETS[t] || {};
        var sz = dokuSize(t), bw = sz[0], bh = sz[1];
        var kopf = (info.titel || def.label || t) + '  ·  ' + t;
        var txtH = Math.round(14 + dokuTxtLen(t) * 17);
        var rowH = Math.max(bh, 30 + txtH);

        add({type:'text', x:DOKU_TXTX, y:y, w:DOKU_TXTW, h:26, bgT:true, fsz:15, label:kopf});
        add({type:'html', x:DOKU_TXTX, y:y+30, w:DOKU_TXTW, h:txtH, bgT:true,
             htmlSrc:'custom', htmlMode:'shadow', html:dokuHtml(t)});

        if (DOKU_SKIP[t]) {
          add({type:'text', x:DOKU_PAD, y:y, w:bw, h:Math.min(bh,120), fsz:11, fg:'#7d9099',
               label:'Nur in einer Leiste verwendbar\n(Einstellungen → Leisten & Zonen).'});
        } else {
          var d = {type:t, x:DOKU_PAD, y:y, w:bw, h:bh};
          if (def.defaults) { try { def.defaults(d); } catch(e){} }
          var dem = info.demo || {};
          // Demos NIE mit echten Variablen: jede gebundene ID auf den Demo-Pool umlenken.
          for (var k in dem) if (Object.prototype.hasOwnProperty.call(dem,k)) {
            d[k] = _dokuRemapDeep(k, dem[k]);
          }
          if (d.label == null || d.label === 'Label') d.label = info.titel || def.label || t;
          add(d);
        }
        y += rowH + 26;
      });

      var name = 'Doku · ' + titel;
      views[name] = {page:{w:DOKU_W, h:y + DOKU_PAD, fit:'letterbox'}, widgets:ws};
      if (!first) first = name;
    });

    return {
      views: views, current: first, home: first, skin:'Standard',
      // Startskin ueber die Adresse waehlbar: ?theme=light bzw. ?theme=dark.
      theme:(/[?&]theme=light/.test(location.search) ? 'light' : 'dark'),
      cfg:{gs:4, gap:4, defW:DOKU_W, defH:900, autosave:false, noSafetyPoll:true, refreshSec:15}
    };
  }
