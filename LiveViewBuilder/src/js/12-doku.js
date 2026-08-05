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
  // EINSPALTIG: Vorschau oben, Erklärung darunter — alle Textblöcke gleich breit (DOKU_TXTW).
  // Grund: der Reflow auf Mobil skaliert nebeneinanderliegende, unterschiedlich breite Blöcke
  // verschieden -> die Erklärung „sprang" je Widget in der Größe. Gleiche Breite = gleiche Skalierung.
  var DOKU_PAD  = 20;
  var DOKU_TXTW = 700;                    // Textbreite (= Inhaltsbreite, einspaltig)
  var DOKU_PREV = 320;                    // max. Breite der Vorschau-Kachel
  var DOKU_TXTX = DOKU_PAD;               // alles linksbündig, eine Spalte
  var DOKU_W    = DOKU_PAD + DOKU_TXTW + DOKU_PAD;

  // Thematische Gruppen. Jedes Widget genau einmal; was hier fehlt, landet in "Weitere" -
  // dadurch faellt ein neu angelegtes Widget auf, statt lautlos zu verschwinden.
  var DOKU_GROUPS = [
    ['Werte & Zahlen',          ['value','valuecard','cval','sval','kpi','delta','calc','chip','icon','bar','meterlist','infolist']],
    ['Schalten & Bedienen',     ['switch','light','button','tile','checkbox','select','slider','colorpick','textbox','cover','shading','thermostat','heatplan','weekedit','alarm','bot','timer','eventctl']],
    ['Zustand & Listen',        ['assoc','statusgrid','statuslist','devlist','statusimage','table','objinfo','msglog','statelog','statetl']],
    ['Diagramme',               ['chart','heatmap','gauge','gaugepro','multiring','doubledonut','sankey','flow','flowline','windrose','tempbar']],
    ['Chart-Typen (Beispiele)', ['chartbar','chartbarstack','chartscatter','chartspark','chartpie','chartdonut','chartrose','chartwf']],
    ['Wetter, Sonne & Termine', ['weather','weatherpro','meteogram','sun','suncard','raincard','calendar','weekplan','clock']],
    ['Medien & Inhalte',        ['camera','campro','media','image','html','webview','marquee','ticker']],
    ['Struktur & Layout',       ['text','shape','line','blank','component','container','room','chromebar','chromesidebar','skinswitch']],
    ['System & Diagnose',       ['wsmon']]
  ];

  // Widgets, die als Einzelstueck nichts zeigen koennen (sie leben in einer Leiste).
  var DOKU_SKIP = {chromebar:1, chromesidebar:1};
  // Alias-Registrierungen (derselbe Definitionskörper unter altem Namen) NICHT nochmal dokumentieren.
  var DOKU_ALIAS = {powerflow:1};

  function dokuInfo(t){ return (typeof DOKU_INFO !== 'undefined' && DOKU_INFO[t]) || {}; }

  // Vorschaugroesse, auf die Spaltenbreite begrenzt.
  function dokuSize(t){
    var i = dokuInfo(t), d = WIDGETS[t] || {};
    var s = i.groesse || d.size || [240,140];
    // Vorschau-Hoehe eng begrenzt (90..140): hohe Kacheln (Licht/Thermostat) skalieren ihre Schrift
    // sonst nach der Kachelhoehe und wirken „ploetzlich viel groesser" als die kompakten Kacheln.
    // Meteogramm braucht mehr Platz (mehrere Panels) — ECharts skaliert die Schrift nicht nach Kachelhoehe.
    var maxH = (t === 'meteogram') ? 340 : ((t === 'heatmap') ? 240 : 140);
    var maxW = (t === 'meteogram' || t === 'heatmap') ? 460 : DOKU_PREV;
    return [Math.max(150, Math.min(maxW, parseInt(s[0]) || 240)),
            Math.max(90,  Math.min(maxH, parseInt(s[1]) || 130))];
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
    var i = dokuInfo(t), h = '<div style="font:12px/1.5 var(--fu,sans-serif);color:var(--muted);padding:2px 2px 6px;-webkit-text-size-adjust:100%;text-size-adjust:100%">';
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
  var _DOKU_IDK = {varId:1,varId2:1,varId3:1,cmpVid:1,vid:1,socVid:1,speedVid:1,tankVid:1,subvid:1,homeVid:1,tankVid:1};
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
    var rest = Object.keys(WIDGETS).filter(function(t){ return !zugeordnet[t] && !DOKU_ALIAS[t]; }).sort();
    var groups = DOKU_GROUPS.slice();
    if (rest.length) groups.push(['Weitere', rest]);

    groups.forEach(function(g){
      // WIDGETS[t] = echtes Widget; ODER synthetischer Doku-Eintrag (kein eigener Typ, aber DOKU_INFO+demo, z. B. Heatmap = Chart-ctype)
      var titel = g[0], typen = g[1].filter(function(t){ return WIDGETS[t] || (dokuInfo(t) && dokuInfo(t).demo); });
      if (!typen.length) return;
      var ws = [], n = 0, y = DOKU_PAD;
      function add(o){ n++; o.id = 'dk' + n; ws.push(o); }

      add({type:'text', x:DOKU_PAD, y:y, w:DOKU_W-2*DOKU_PAD, h:40, bgT:true, fsz:21,
           label:'Widget-Dokumentation · ' + titel});
      y += 46;
      add({type:'text', x:DOKU_PAD, y:y, w:DOKU_W-2*DOKU_PAD, h:36, bgT:true, fsz:11, fg:'#7d9099',
           label:'Je Widget: oben die Vorschau (läuft mit echten Werten, bedienbar), darunter Zweck und '
                +'sämtliche Optionen. Über die Ansichtsauswahl oben zu den anderen Themen.'});
      y += 46;

      typen.forEach(function(t){
        var info = dokuInfo(t), def = WIDGETS[t] || {};
        var sz = dokuSize(t), bw = Math.min(sz[0], DOKU_PREV), bh = sz[1];
        var kopf = (info.titel || def.label || t) + (WIDGETS[t] ? ('  ·  ' + t) : ''); // synthetische Einträge (Chart-Typen) ohne Typ-Slug
        var txtH = Math.round(14 + dokuTxtLen(t) * 17);

        // 1) Überschrift (volle Breite)
        add({type:'text', x:DOKU_PAD, y:y, w:DOKU_TXTW, h:24, bgT:true, fsz:15, label:kopf});
        y += 28;
        // 2) Vorschau-Kachel darunter — horizontal in der Textspalte zentriert (nicht linksbündig)
        var px = DOKU_PAD + Math.max(0, Math.round((DOKU_TXTW - bw) / 2));
        if (DOKU_SKIP[t]) {
          var ph = Math.min(bh,120);
          add({type:'text', x:px, y:y, w:bw, h:ph, fsz:11, fg:'#7d9099',
               label:'Nur in einer Leiste verwendbar\n(Einstellungen → Leisten & Zonen).'});
          y += ph + 10;
        } else {
          var d = {type:t, x:px, y:y, w:bw, h:bh};
          if (def.defaults) { try { def.defaults(d); } catch(e){} }
          var dem = info.demo || {};
          // Demos NIE mit echten Variablen: jede gebundene ID auf den Demo-Pool umlenken.
          for (var k in dem) if (Object.prototype.hasOwnProperty.call(dem,k)) {
            d[k] = _dokuRemapDeep(k, dem[k]);
          }
          if (d.label == null || d.label === 'Label') d.label = info.titel || def.label || t;
          add(d);
          y += bh + 10;
        }
        // 3) Erklärung (volle Breite) — gleiche Breite wie alle anderen Erklärungen -> Reflow einheitlich
        add({type:'html', x:DOKU_PAD, y:y, w:DOKU_TXTW, h:txtH, bgT:true,
             htmlSrc:'custom', htmlMode:'shadow', html:dokuHtml(t)});
        y += txtH + 26;
      });

      var name = 'Doku · ' + titel;
      views[name] = {page:{w:DOKU_W, h:y + DOKU_PAD, fit:'letterbox'}, widgets:ws};
      if (!first) first = name;
    });

    // Sonderansicht: Rechenformeln - kein Widget-Katalog, sondern Erklaerung + Live-Demo.
    (function(){
      var ws = [], n = 0, y = DOKU_PAD, W = DOKU_W - 2 * DOKU_PAD;
      function add(o){ n++; o.id = 'rf' + n; ws.push(o); }
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:40, bgT:true, fsz:21, label:'Rechenformeln in Variablenfeldern'}); y += 48;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:80, bgT:true, fsz:13, fg:'#7d9099',
           label:'Jedes Variablenfeld akzeptiert statt einer ID eine Formel, die mit „=" beginnt. So lassen '
                +'sich mehrere Variablen verrechnen: Der Live-Wert kommt aus den aktuellen Werten, das Aggregat '
                +'(Charts, Delta, KPI, Wertkarte) direkt aus den aggregierten Werten der Einzelvariablen — es wird '
                +'also nichts doppelt gerechnet.'}); y += 90;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:24, bgT:true, fsz:15, label:'Beispiele'}); y += 30;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:132, bgT:true, fsz:13, fg:'#39d08a',
           label:'=45552+49633              Summe zweier Zähler (z. B. PV1 + PV2)\n'
                +'=(#20726+#40754)/2        Mittel zweier Leistungen (Klammern erlaubt)\n'
                +'=45552-49633              Differenz zweier Zähler\n'
                +'=53289*0.06               Variable mal Konstante (z. B. Preis)\n'
                +'=(#48744+#41293)*100/#48275   gemischt mit Klammern und Konstante'}); y += 144;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:24, bgT:true, fsz:15, label:'Regeln'}); y += 30;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:132, bgT:true, fsz:13, fg:'#7d9099',
           label:'• Operatoren + − * / und Klammern ( ).\n'
                +'• Eine Zahl ist eine VARIABLE, wenn sie mit # beginnt (#20726) oder fünfstellig ist (≥ 10000). '
                +'Kleinere Zahlen und Dezimalzahlen sind KONSTANTEN.\n'
                +'• + und − sind im Aggregat exakt (Summe/Differenz je Periode). * und / zwischen zwei Variablen '
                +'nutzen die Perioden-Aggregate der Einzelvariablen (Wert-aus-Aggregaten), nicht die Rohwerte.\n'
                +'• Live aktualisiert sich die Formel, sobald sich eine beteiligte Variable ändert.'}); y += 144;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:24, bgT:true, fsz:15, label:'Live-Demo — Summe zweier Variablen'}); y += 30;
      // reine Client-Berechnung aus dem Demo-Variablenpool (900004 + 900022), rechnet live mit.
      add({type:'value', x:DOKU_PAD, y:y, w:240, h:120, varId:'=900004+900022', label:'A + B', suf:' kWh', dec:1});
      add({type:'text', x:DOKU_PAD + 260, y:y+8, w:W - 260, h:100, bgT:true, fsz:12, fg:'#7d9099',
           label:'Diese Kachel ist an die Formel =900004+900022 gebunden. Ihr Wert ist die laufende Summe '
                +'der beiden Demo-Variablen und aktualisiert sich, wenn sich eine davon ändert.'});
      y += 132;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:40, bgT:true, fsz:21, label:'Text verketten (Strings)'}); y += 48;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:66, bgT:true, fsz:13, fg:'#7d9099',
           label:'Enthält eine Formel ein Text-Literal in Anführungszeichen, verkettet sie wie in PHP mit dem '
                +'Punkt „.": Variablenwerte und feste Texte werden aneinandergehängt. Rein für die Live-Anzeige '
                +'(Wert, Text, Chip, Kachel …) — kein Aggregat.'}); y += 76;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:24, bgT:true, fsz:15, label:'Beispiele'}); y += 30;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:96, bgT:true, fsz:13, fg:'#39d08a',
           label:'=#35768."°C ".#27635."%"       Temperatur und Luftfeuchte in einer Zeile\n'
                +'=#20726." / ".#40754." W"      zwei Leistungen mit Trenner\n'
                +'="Zähler: ".#45552." kWh"      fester Vortext plus Variable'}); y += 108;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:24, bgT:true, fsz:15, label:'Regeln'}); y += 30;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:110, bgT:true, fsz:13, fg:'#7d9099',
           label:'• Text steht in "…" oder \'…\', Variablen als #ID, verkettet mit dem Punkt „.".\n'
                +'• Die Profil-Einheit einer Variable wird weggelassen — die Einheit gibst du selbst als Text an.\n'
                +'• Solange eine beteiligte Variable noch keinen Wert hat, bleibt die Anzeige leer.\n'
                +'• Für reine Zahlen ohne Anführungszeichen gilt weiter die Rechenformel oben (+ − * /).'}); y += 122;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:24, bgT:true, fsz:15, label:'Live-Demo — zwei Werte in einer Zeile'}); y += 30;
      add({type:'value', x:DOKU_PAD, y:y, w:300, h:120, varId:'=#900004." · ".#900022." kWh"', label:'A · B'});
      add({type:'text', x:DOKU_PAD + 320, y:y+8, w:W - 320, h:100, bgT:true, fsz:12, fg:'#7d9099',
           label:'Diese Kachel ist an =#900004." · ".#900022." kWh" gebunden und verkettet beide Demo-Werte '
                +'mit Trenner und Einheit — sie aktualisiert sich live.'});
      y += 132;
      views['Doku · Rechenformeln'] = {page:{w:DOKU_W, h:y + DOKU_PAD, fit:'letterbox'}, widgets:ws};
    })();

    // Sonderansicht: Bedienung & Layout - Hover-Sprache und freie Positionierung (widgetuebergreifend).
    (function(){
      var ws=[], n=0, y=DOKU_PAD, W=DOKU_W-2*DOKU_PAD;
      function add(o){n++;o.id='bl'+n;ws.push(o);}
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:40, bgT:true, fsz:21, label:'Hover-Sprache & freie Positionierung'}); y+=48;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:26, bgT:true, fsz:15, label:'Zwei getrennte Hover-Effekte (nur im Betrieb, nicht im Editor)'}); y+=32;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:118, bgT:true, fsz:13, fg:'#7d9099',
           label:'• Navigation (öffnet etwas — Popup, Seite, Zurück, Skript, Menü, Region, Vollbild-Kamera): '
                +'die Kachel hebt sich beim Überfahren an und bekommt einen Akzent-Ring.\n'
                +'• Schaltaktion in-place (schreibt eine Variable / löst eine Aktion aus — Schalter, Licht, '
                +'Rollo, Thermostat, Auswahl, Checkbox, Ereignis, Wertkarte im Schalter-/Auswahl-Modus): '
                +'KEIN Anheben, sondern ein getönter Innen-Ring — klar unterscheidbar von der Navigation.\n'
                +'• Lang-Druck (550 ms auf Seite/Popup) zeigt zusätzlich eine Füllleiste unten. Effekte sind '
                +'kombinierbar (z. B. Schaltaktion + Lang-Druck).\n'
                +'• Reine Anzeige-Widgets (auch gruppierte) bekommen NIEMALS einen Hover-Effekt.'}); y+=128;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:26, bgT:true, fsz:15, label:'Wert & Icon frei positionieren'}); y+=32;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:118, bgT:true, fsz:13, fg:'#7d9099',
           label:'Bei allen kompakten Wert/Icon-Widgets (Wert, Wertkarte, KPI, Chip, Kachel, Raum, Balken, '
                +'Schalter, Licht, Wetter, Zustand u. a.) lassen sich Wert und Icon frei im Widget verschieben:\n'
                +'• Eigenschaften-Block „Position (frei)" mit X/Y-Feldern in Pixel (relativ).\n'
                +'• Oder im Editor Alt+ziehen direkt am Wert bzw. Icon — die X/Y-Felder folgen live.\n'
                +'• Zurücksetzen: der Knopf „↺" oben rechts am ausgewählten Widget (erscheint nur, wenn etwas '
                +'verschoben wurde) ODER „Position zurücksetzen" in den Eigenschaften — beide setzen nur die '
                +'Positionierung der Einzelelemente auf den Standard zurück.'}); y+=128;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:26, bgT:true, fsz:15, label:'Container & eigene Bausteine'}); y+=32;
      add({type:'text', x:DOKU_PAD, y:y, w:W, h:124, bgT:true, fsz:13, fg:'#7d9099',
           label:'• Container-Widget: nimmt beliebige Widgets auf; verschieben bewegt alles mit, Größe ändern '
                +'skaliert den Inhalt. Optik als Panel oder unsichtbar (siehe Widget-Katalog „Container").\n'
                +'• Baustein speichern: Auswahl (oder einen fertigen Container) markieren und den Würfel-Knopf in '
                +'der Werkzeugleiste drücken — der Baustein erscheint in der Palette unter „Bausteine (eigene)".\n'
                +'• Einfügen per Klick/Ziehen, beliebig oft (Kind- und Gruppen-IDs werden je Einfügung neu vergeben). '
                +'Export/Import als JSON überträgt Bausteine zwischen Instanzen.'}); y+=134;
      views['Doku · Bedienung & Layout'] = {page:{w:DOKU_W, h:y + DOKU_PAD, fit:'letterbox'}, widgets:ws};
    })();

    return {
      views: views, current: first, home: first, skin:'Standard',
      // Startskin ueber die Adresse waehlbar: ?theme=light bzw. ?theme=dark.
      theme:(/[?&]theme=light/.test(location.search) ? 'light' : 'dark'),
      cfg:{gs:4, gap:4, defW:DOKU_W, defH:900, autosave:false, noSafetyPoll:true, refreshSec:15}
    };
  }
