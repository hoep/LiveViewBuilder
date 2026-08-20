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
  var DOKU_TXTW = 700;                    // Textbreite (= Inhaltsbreite, einspaltig) — wird responsiv gesetzt
  var DOKU_PREV = 320;                    // max. Breite der Vorschau-Kachel
  var DOKU_TXTX = DOKU_PAD;               // alles linksbündig, eine Spalte
  var DOKU_W    = DOKU_PAD + DOKU_TXTW + DOKU_PAD;
  // Responsiv: Inhaltsbreite = Fensterbreite (normale Schrift, KEIN Zoom). Vor jedem Aufbau + bei Resize aufrufen.
  function dokuFitWidth(){
    var vw=(typeof window!=='undefined'&&window.innerWidth)||1000;
    DOKU_TXTW=Math.max(320,Math.min(1600,vw-2*DOKU_PAD));
    DOKU_W=DOKU_PAD+DOKU_TXTW+DOKU_PAD;
  }

  // Thematische Gruppen. Jedes Widget genau einmal; was hier fehlt, landet in "Weitere" -
  // dadurch faellt ein neu angelegtes Widget auf, statt lautlos zu verschwinden.
  var DOKU_GROUPS = [
    ['Werte & Zahlen',          ['value','valuecard','cval','sval','kpi','delta','calc','chip','icon','bar','meterlist','infolist']],
    ['Schalten & Bedienen',     ['switch','light','button','tile','checkbox','select','slider','stepper','colorpick','textbox','cover','shadingpanel','shading','shadeprofile','thermostat','heatplan','weekedit','alarm','alarmpanel','bot','timer','eventctl']],
    ['HomeSuite – Zeitplan (Heizung/Beschattung)', ['rooms','curve','week','slots','slotedit','variantbox','transfer','save']],
    ['HomeSuite – Licht-Automatik', ['lightband','autolist','autoedit','autocard','autotimeline']],
    ['HomeSuite – Navigation & Sonne', ['homesuite','roomnav','zonesync','shadesun','shadeprofiles','shadecal','shadedoors','shadesens','shadearm','shadelog']],
    ['Zustand & Listen',        ['assoc','statusgrid','statuslist','devlist','statusimage','table','statmatrix','objinfo','msglog','battlist','statelog','statetl']],
    ['Diagramme',               ['chart','heatmap','gauge','gaugepro','multiring','doubledonut','sankey','flow','flowline','windrose','tempbar']],
    ['Chart-Typen (Beispiele)', ['chartbar','chartbarstack','chartrace','chartscatter','chartspark','chartpie','chartdonut','chartrose','chartwf']],
    ['Wetter, Sonne & Termine', ['weather','weatherpro','meteogram','sun','suncard','raincard','rainintensity','rainradar','calendar','weekplan','weekstrip','clock']],
    ['HomeSuite – Audio',       ['audioroom','audionow','audioctl','audioqueue','audiosrc','audioradio','audiolib','multiroom','mediasources']],
    ['Medien & Inhalte',        ['camera','campro','camarray','media','image','html','webview','marquee','ticker']],
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
    // Ausnahmen sind Widgets, die MEHRERE Baender uebereinander zeichnen und bei 140 px
    // mittendrin abschneiden — ihre Schriftmarken haengen ohnehin schon am oberen Anschlag:
    //   meteogram  mehrere Panels
    //   heatmap    Matrix + Farbleiste
    //   meterlist  Kachelraster, vier Metriken = zwei Reihen (braucht ~166 px)
    //   chart      Legende + Marken-Fahne + Perioden-Navigation belegen feste Baender
    //   audioqueue Kopfzeile + laufender Titel + Abschnittsmarke belegen schon ~110 px,
    //              bei 140 px bliebe fuer die eigentliche Liste keine einzige Zeile uebrig
    //   audioradio Kopfzeile + Senderzeilen: bei 140 px blieben zwei Zeilen, die Liste waere
    //              in der Doku nicht als scrollende Liste erkennbar
    var DOKU_MAXH = {meteogram:340, heatmap:240, meterlist:190, chart:190, audioqueue:300, audioradio:280};
    var maxH = DOKU_MAXH[t] || 140;
    var maxW = (t === 'meteogram' || t === 'heatmap') ? 460 : DOKU_PREV;
    return [Math.max(150, Math.min(maxW, parseInt(s[0]) || 240)),
            Math.max(90,  Math.min(maxH, parseInt(s[1]) || 130))];
  }

  // Hoehe einer text-Kachel MESSEN statt raten. Grund: Auf schmalen Fenstern (Handy, ~420 px)
  // brechen Ueberschriften auf zwei Zeilen um; eine fest verdrahtete Hoehe (40/36/24) reicht
  // dann nicht, die zweite Zeile lief in den naechsten Block und wurde abgeschnitten.
  // Gemessen wird in einem unsichtbaren Kasten mit denselben Regeln wie .wt/.wt .t
  // (Schriftgroesse w.fsz, Gewicht 600, Innenabstand aus styles.css: waagrecht 7 px,
  // senkrecht 6 px — die clamp()-Untergrenzen, die bei diesen flachen Kacheln immer greifen).
  var _dokuMeas = null;
  function dokuTextH(label, fsz, boxW, minH){
    var padX = 7, padY = 6, h = minH || 0;
    try{
      if(!_dokuMeas){
        _dokuMeas = document.createElement('div');
        _dokuMeas.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;'
          + 'font-family:var(--fu,sans-serif);font-weight:600;white-space:pre-wrap;'
          + 'word-break:normal;overflow-wrap:break-word;line-height:normal';
        document.body.appendChild(_dokuMeas);
      }
      // 2 px schmaler messen: liegt eine Zeile haarscharf an der Grenze, wird lieber
      // umgebrochen gerechnet — eine Zeile Luft zu viel ist harmlos, eine zu wenig nicht.
      _dokuMeas.style.width = Math.max(40, boxW - 2*padX - 2) + 'px';
      _dokuMeas.style.fontSize = fsz + 'px';
      _dokuMeas.textContent = String(label == null ? '' : label);
      h = Math.max(h, Math.ceil(_dokuMeas.getBoundingClientRect().height) + 2*padY);
    }catch(e){}
    return h;
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
    var i=dokuInfo(t),n=0,cpl=Math.max(30,Math.round(DOKU_TXTW/7.4)),cph=Math.max(30,Math.round(DOKU_TXTW/8.2)); // Zeichen/Zeile aus der aktuellen Breite (700px ~ 95 Zeichen)
    if(i.zweck)n+=Math.ceil(i.zweck.length/cpl)+1;
    (i.funktionen||[]).forEach(function(f){n+=Math.ceil(((f.name||'').length+(f.beschreibung||'').length+4)/cpl)+0.3;});
    if(i.hinweis)n+=Math.ceil(i.hinweis.length/cph)+1;
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
      var ws = [], n = 0, y = (DOKU_PAD+30);
      function add(o){ n++; o.id = 'dk' + n; ws.push(o); }

      // Hoehen gemessen (Mindestmass = die bisherigen Werte): breit bleibt alles wie gehabt,
      // schmal waechst der Kasten mit dem Umbruch mit, statt in den naechsten Block zu laufen.
      var kopfL = 'Widget-Dokumentation · ' + titel, kopfH = dokuTextH(kopfL, 21, DOKU_W-2*DOKU_PAD, 40);
      add({type:'text', x:DOKU_PAD, y:y, w:DOKU_W-2*DOKU_PAD, h:kopfH, bgT:true, fsz:21, label:kopfL});
      y += kopfH + 6;
      var introL = 'Je Widget: oben die Vorschau (läuft mit echten Werten, bedienbar), darunter Zweck und '
                 + 'sämtliche Optionen. Über die Ansichtsauswahl oben zu den anderen Themen.\n'
                 + 'Für JEDES Widget gibt es unten in den Eigenschaften unter X/Y/Breite/Höhe einen '
                 + 'Innenabstand (oben, rechts, unten, links, in Pixeln). Er wirkt INNEN: Kachel, Rahmen '
                 + 'und Position bleiben unverändert, nur die Zeichenfläche darin rückt ein. Beim Reflow '
                 + 'skaliert er mit der Seite mit.';
      var introH = dokuTextH(introL, 11, DOKU_W-2*DOKU_PAD, 36);
      add({type:'text', x:DOKU_PAD, y:y, w:DOKU_W-2*DOKU_PAD, h:introH, bgT:true, fsz:11, fg:'#7d9099', label:introL});
      y += introH + 10;

      typen.forEach(function(t){
        var info = dokuInfo(t), def = WIDGETS[t] || {};
        var sz = dokuSize(t), bw = Math.min(sz[0], DOKU_PREV), bh = sz[1];
        var kopf = (info.titel || def.label || t) + (WIDGETS[t] ? ('  ·  ' + t) : ''); // synthetische Einträge (Chart-Typen) ohne Typ-Slug
        var txtH = Math.round(14 + dokuTxtLen(t) * 17);

        // 1) Überschrift (volle Breite) — Hoehe gemessen, sonst verschwindet die zweite Zeile
        //    langer Namen (z. B. „Beschattungs-Panel (alt/Monolith) · shadingpanel") schmal
        //    hinter der Vorschaukarte darunter.
        var kopfH2 = dokuTextH(kopf, 15, DOKU_TXTW, 24);
        add({type:'text', x:DOKU_PAD, y:y, w:DOKU_TXTW, h:kopfH2, bgT:true, fsz:15, label:kopf});
        y += kopfH2 + 4;
        // 2) Vorschau-Kachel darunter — linksbündig (bei breitem Layout wirkt zentriert verloren)
        var px = DOKU_PAD;
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
      var ws = [], n = 0, y = (DOKU_PAD+30), W = DOKU_W - 2 * DOKU_PAD;
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
      var ws=[], n=0, y=(DOKU_PAD+30), W=DOKU_W-2*DOKU_PAD;
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

    // Sonderansicht: HomeSuite – Datenmodell (Objektbaum + Configurator, gebauter Ist-Stand).
    (function(){
      var ws=[], n=0, y=(DOKU_PAD+30), W=DOKU_W-2*DOKU_PAD;
      var MUT='#7d9099', ACC='#39d08a', BLU='#4aa3df';
      function H(t,s){add({type:'text',x:DOKU_PAD,y:y,w:W,h:s?26:40,bgT:true,fsz:s?15:21,label:t}); y+=s?32:48;}
      function P(t,fg,h){add({type:'text',x:DOKU_PAD,y:y,w:W,h:h,bgT:true,fsz:13,fg:(fg||MUT),label:t}); y+=h+10;}
      function add(o){n++;o.id='hs'+n;ws.push(o);}
      H('HomeSuite — Datenmodell im Symcon-Baum & Configurator');
      P('HomeSuite bildet das Zuhause als OBJEKTBAUM ab: die Hierarchie IST die Elternschaft — kein Link, '
       +'keine Zuordnungstabelle. Fünf Modultypen, ein Hub als Wurzel, die Gewerke (Heizung/Beschattung/Bewässerung) als Blätter.',MUT,64);
      H('Fünf Modultypen',1);
      P('HomeSuite Hub      HSH    Wurzel + geteilte Dienste (Profile, Topologie, Suite-Aggregat, globale Automatik)\n'
       +'HomeSuite Bereich  HSSP   Struktur-Knoten — Kind: Haus | Bereich | Raum\n'
       +'HeatingZone        HSHT   Entität „Heizung"\n'
       +'ShadingDevice      HSSH   Entität „Beschattung"\n'
       +'IrrigationCircuit  HSIR   Entität „Bewässerung" (Ventil/Kreis)',BLU,100);
      H('Der Baum (konkret)',1);
      P('HomeSuite Hub  (HSH)\n'
       +'└─ Wohnhaus                 HSSP  Kind=Haus\n'
       +'   ├─ Erdgeschoss  (EG)     HSSP  Kind=Bereich\n'
       +'   │  └─ Büro               HSSP  Kind=Raum\n'
       +'   │     ├─ Heizung         HSHT   ← Entität\n'
       +'   │     └─ Beschattung     HSSH   ← Entität\n'
       +'   └─ Obergeschoss (OG)\n'
       +'      └─ Esszimmer\n'
       +'         ├─ Heizung\n'
       +'         ├─ Beschattung Süd    (mehrere pro Raum → Ausrichtung im Namen)\n'
       +'         └─ Beschattung Nord',ACC,220);
      P('Zuordnung = wo die Instanz hängt (Elternschaft). Verschiebst du „Heizung" unter einen anderen Raum, '
       +'ist sie dort zugeordnet. „Bereich" ist weit gefasst: EG/OG/DG, aber auch Keller, Garten, Außen. '
       +'Die Nav-Tabs im Frontend zeigen den RAUMNAMEN (bei mehreren Beschattungen je Raum mit Ausrichtung).',MUT,74);
      H('Entität — Datenmodell (Basisklasse EntityModule)',1);
      P('Jede Heizung/Beschattung beschreibt sich DEKLARATIV per manifest(). Daraus entstehen die Variablen.',MUT,26);
      P('Control-Typen → Variablen:  T_SETPOINT (Sollwert, schaltbar) · T_REFLECT (Ist/Rückmeldung, Anzeige) · '
       +'T_SELECT (Modus/Präsenz/Plan) · T_LEVEL (Position) · T_COMMAND (Fahrbefehl).\n'
       +'Heizung: Setpoint, ActualTemp, Humidity, Mode, Presence, Online.\n'
       +'Beschattung: Position, Movement, ActualPosition, Mode, Plan, Season, Online.',BLU,74);
      P('Speicher = ATTRIBUTE, nicht Properties (darum ist im Baum keine „Konfig" sichtbar):\n'
       +'• FabricStore (JSON) — die eigentliche Konfiguration: Treiber-Bindung (driver, positionId/targetId, '
       +'sensorId, automaticId), Profilfelder (geoProfile, windStormKmh …), Zeitpläne, armed.\n'
       +'• HoldState — flüchtiger manueller Eingriff (manualHold hält bis zur nächsten Slot-Grenze).\n'
       +'• RtState — flüchtiger Laufzeitstatus (last-commanded etc.).',MUT,110);
      P('driver() = HAL-Bindung ans echte Gerät (Heizung → HomeMatic-CCU, Beschattung → Aktor-Treiber, s. u.). '
       +'Die Bindung steht im FabricStore, nicht als Symcon-Link, und wird treiber-abhängig per '
       +'RegisterReference gegen versehentliches Löschen geschützt.\n'
       +'Zeitplan-Varianten: Heizung = Präsenz (Normal/Erweitert/Abgesenkt); Beschattung = Plan × Saison '
       +'(Anwesend/Abwesend/Urlaub × Sommer/Winter).',MUT,92);
      H('Aktor-Treiber (HAL) — Beschattung',1);
      P('Drei austauschbare Treiber (Wahl im Bindungs-Formular), alle mit derselben IShutter-Schnittstelle:\n'
       +'• generic-shutter — Absolutposition 0..100 auf einer aktionsfähigen Variable (mit Rückmeldung).\n'
       +'• somfy-rts — Bus-Rollos: rohe RTS-Telegramme über den Client-Socket zum Gateway. KEIN Feedback →\n'
       +'   Position wird ZEITBASIERT geschätzt (volle Fahrzeit auf/zu + Referenzfahrt in den Endanschlag).\n'
       +'   Kommandos werden mehrfach gesendet (auf/ab 3×, STOP 4×), sonst gehen Telegramme verloren.\n'
       +'• hm-shutter — Homematic-LEVEL (0..1), absolut mit Rückmeldung (z. B. Markise).',BLU,140);
      P('Positionsschätzung (somfy): das Modul fährt per Timer die berechnete Dauer und stoppt selbst '
       +'(ShadeKinematics). Ohne Referenzfahrt ist die Lage „unbekannt" → dann nur relatives Fahren. '
       +'Scharf vs. Schatten: solange armed=false wird der geplante Fahrbefehl (inkl. Telegramm) nur '
       +'protokolliert, NICHT gesendet.',MUT,92);
      P('Sichtbarkeit & Schutz: je Entität die Variable „Bindung" (BindHealth: OK / FEHLER / Position unbekannt); '
       +'op=validate prüft eine Entität, der Hub-op=validate scannt ALLE auf tote Bindungen. RegisterReference '
       +'lässt Symcon beim Löschen einer gebundenen Variable/Instanz warnen.',MUT,92);
      H('Automatik & Regeln (generisch, alle Domänen)',1);
      P('• GLOBALE Automatik: Hub-Schalter „Automatik global" (AutomationEnabled). Jede Entität '
       +'(Heizung/Beschattung/Bewässerung + künftige) respektiert ihn — aus = keine Automatik; '
       +'Sicherheit (z. B. Sturm bei Beschattung) bleibt aktiv. Als Switch-Widget bindbar.\n'
       +'• Sonnen-Anker: Slot-Grenzen an Sonnenauf-/-untergang ± Offset (generisch in EntityModule/SunTimes).\n'
       +'• Schwellen-Überschreibung (Temperatur): > Grenze +x %, < Grenze −x %, < Sperre keine Aktion '
       +'(Bewässerung-Default: >28 °C +20 %, <20 °C −20 %, <10 °C aus). Wiederverwendbar in allen Domänen.',MUT,110);
      H('Bewässerung (IrrigationCircuit)',1);
      P('Ein Kreis = eine Instanz, gebunden an den ROH-Aktor (nie IPSWatering): generic-valve in drei '
       +'Modi — Dauer-Variable (Sekunden, Gerät timt selbst, z. B. LinkTap StartWateringImmediately), '
       +'Schalt-Variable (bool, Modul timt) oder Skript (Start/Stop). Zeitplan = normaler An/Aus '
       +'(An-Abschnitt = Bewässerungsfenster); Dauer = Basis × Saison × Temperatur × Evaporation. '
       +'Regen-/Feuchte-Gate + Kälte-Sperre. Schatten-Modus bis „scharf" (armed).',MUT,92);
      H('Hub — geteilte Dienste',1);
      P('• Benannte Profile (ProfileEngine auf dem Hub-Store): Keys profiles.<typ>.<name> und '
       +'assign.<entityId>.<typ>. Ein Profil ändern → Push in alle zugewiesenen Zonen (configureAutomation).\n'
       +'• GetSuiteManifest = Aggregat aller Entitäts-Manifeste.\n'
       +'• Topologie (Haus→Bereich→Raum→Entitäten) für Navigation & Widgets; discoverEntities durchläuft den Baum.',MUT,92);
      H('Configurator — zwei Ebenen',1);
      P('1) Symcon-Konsole (bewusst minimal): HomeSuite Bereich → nur Kind (Haus/Bereich/Raum) + Abbr. '
       +'Heizung/Beschattung → natives Bindungs-Formular (Variablen-Auswahl → configureDriver → FabricStore). '
       +'Sonst nur Notfall/Diagnose.',MUT,66);
      P('2) LiveViewBuilder = die eigentliche Verwaltung + Bedienung. Generisch über ?api=mod → Prefix-'
       +'Funktionen: HSH_Manage (Hub), HSHT_Manage (Heizung), HSSH_Manage (Beschattung). Ops u. a. manage, '
       +'topology, suite, hubmanage sowie configureDriver/configureAutomation/updateProfile/getSchedule/setArmed. '
       +'Die Widgets (rooms/curve/slots/slotedit/variantbox/transfer/save, shadeprofiles, zonesync, roomnav, '
       +'shadesun) sind reine Frontends dazu.',MUT,110);
      P('Datenfluss:  Widget → ?api=mod → Prefix_Manage → store()->patch / schedules() → Push in die Zonen.',ACC,26);
      H('Prefixe & weiterführend',1);
      P('Prefixe: HSH (Hub) · HSSP (Bereich) · HSHT (Heizung) · HSSH (Beschattung).\n'
       +'Repo hoep/HomeSuite: docs/SPEC.md (Bau-Spezifikation), GUIDS.md (echte GUIDs), README.md. '
       +'Diese Seite spiegelt den GEBAUTEN Ist-Stand (Raum-/Baum-Modell + Bindungs-Formular), den SPEC.md '
       +'als Bau-Plan noch nicht vollständig enthält.',MUT,74);
      views['Doku · HomeSuite – Datenmodell'] = {page:{w:DOKU_W, h:y + DOKU_PAD, fit:'letterbox'}, widgets:ws};
    })();

    return {
      views: views, current: first, home: first, skin:'Standard',
      // Startskin ueber die Adresse waehlbar: ?theme=light bzw. ?theme=dark.
      theme:(/[?&]theme=light/.test(location.search) ? 'light' : 'dark'),
      cfg:{gs:4, gap:4, defW:DOKU_W, defH:900, autosave:false, noSafetyPoll:true, refreshSec:15}
    };
  }
