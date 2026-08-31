  // ===== Widgets: Flugverkehr — flightscene / flightsky / flightlist =====
  //
  //  Drei Kacheln auf EINER Datenquelle. Der Hook (?api=flights) fragt OpenSky
  //  serverseitig ab und haelt das Ergebnis 30 Sekunden vor; die Kacheln lesen nur
  //  daraus. Das ist keine Bequemlichkeit, sondern Pflicht: das Kontingent sind 4000
  //  Punkte je Tag, also eine Abfrage alle 21,6 Sekunden. Wuerde jede offene Kachel
  //  selbst fragen, waere es bei drei Tablets vor Mittag leer.
  //
  //  flightscene  gekippte Buehne mit Ringen, Bodenspuren, Lotlinien, Silhouetten
  //  flightsky    Himmelskuppel - Zenit mittig, Horizont aussen ("wohin schauen")
  //  flightlist   Liste mit Route, Bauart, Hoehe, Richtung und naechster Annaeherung
  //
  //  ZWISCHENBEWEGUNG: Zwischen zwei Abfragen liegen 30 Sekunden, in denen ein Jet
  //  siebeneinhalb Kilometer zurueklegt. Ohne Koppelnavigation wuerde er springen.
  //  Deshalb rechnet jede Kachel aus Kurs, Tempo und Steigrate weiter und zeichnet
  //  mit 5 Bildern je Sekunde - genug fuer die langsame Bewegung, wenig genug, um
  //  ein Tablet nicht zu beschaeftigen.

  /* ===================== Gemeinsame Auswahl =====================
   *
   * Eine Maschine oder ein Satellit laesst sich in JEDER Kachel anwaehlen - in
   * der Liste, auf der Buehne, in beiden Kuppeln - und ist danach ueberall
   * hervorgehoben. Das ist der eigentliche Zweck: man liest einen Eintrag in der
   * Liste und sieht sofort, WO am Himmel er steht, oder umgekehrt.
   *
   * Der Schluessel ist bei Flugzeugen die ICAO24-Adresse (bleibt ueber die
   * ganze Fahrt gleich, anders als das Rufzeichen bei Positionsfluegen), bei
   * Satelliten der Name.
   *
   * Alle Kacheln liegen im selben Buendel, deshalb genuegt eine Variable und
   * eine Liste der Zeichenfunktionen. Ein zweiter Klick auf dasselbe Objekt
   * hebt die Auswahl wieder auf.
   */
  var _flSel   = null;   // {art:'flug'|'sat', id:'...'}
  var _flMaler = {};     // KachelID -> Zeichenfunktion
  var _flPunkte = {};    // KachelID -> [{x,y,r,art,id}] fuer die Trefferpruefung

  function flMalerAn(w, zeichne) { _flMaler[w.id] = zeichne; }

  function flGewaehlt(art, id) {
    return !!_flSel && _flSel.art === art && _flSel.id === String(id);
  }
  function flAuswahl(art, id) {
    var neu = (art && id) ? { art: art, id: String(id) } : null;
    if (neu && flGewaehlt(neu.art, neu.id)) { neu = null; }   // nochmal = abwaehlen
    _flSel = neu;
    Object.keys(_flMaler).forEach(function (k) {
      // BEIDE Wurzeln pruefen. Im Laufbetrieb haengen die Kacheln unter #ovcanvas,
      // nicht unter canvas - wer nur dort sucht, traegt beim ersten Klick saemtliche
      // Zeichenfunktionen aus, und die Auswahl bleibt wirkungslos.
      var el = $('.w[data-id="' + k + '"]', canvas) || $('.w[data-id="' + k + '"]', $('#ovcanvas'));
      if (!el || !document.body.contains(el)) { delete _flMaler[k]; return; }
      try { _flMaler[k](); } catch (e) {}
    });
  }

  /** Waehrend des Zeichnens die Trefferflaechen merken. */
  function flPunktAn(w, x, y, r, art, id) {
    (_flPunkte[w.id] = _flPunkte[w.id] || []).push({ x: x, y: y, r: r, art: art, id: String(id) });
  }
  function flPunkteLeeren(w) { _flPunkte[w.id] = []; }

  /**
   * Klick auf eine Leinwand: das naechstgelegene Objekt waehlen.
   *
   * Grosszuegiger Fangradius, mindestens 14 px - ein Flugzeugsymbol ist auf der
   * Kuppel keine 8 px gross, und mit dem Finger trifft man das nicht.
   */
  function flKlickAn(w) {
    var box = flBox(w); if (!box || box.__flKlick) { return; }
    box.__flKlick = true;
    box.style.cursor = 'pointer';
    box.addEventListener('click', function (ev) {
      var r = box.getBoundingClientRect();
      var mx = ev.clientX - r.left, my = ev.clientY - r.top;
      var beste = null, bd = 1e9;
      (_flPunkte[w.id] || []).forEach(function (p) {
        var d = Math.hypot(p.x - mx, p.y - my);
        var fang = Math.max(14, p.r + 8);
        if (d < fang && d < bd) { bd = d; beste = p; }
      });
      flAuswahl(beste && beste.art, beste && beste.id);
    });
  }

  /** Ring um das gewaehlte Objekt. */
  function flMarke(g, x, y, r) {
    g.save();
    g.beginPath(); g.arc(x, y, r, 0, 7);
    g.strokeStyle = cssv('--accent') || '#00cdab';
    g.lineWidth = 2; g.setLineDash([3, 3]);
    g.shadowColor = cssv('--accent') || '#00cdab'; g.shadowBlur = 8;
    g.stroke();
    g.restore();
  }

  var _flCache = {};          // radius -> {stand, flug, geholt}
  var _flWarte = {};          // radius -> [callbacks]
  var _flRO = {};             // widgetId -> ResizeObserver
  var _flTick = {};           // widgetId -> Intervall

  function flRadius(w) { var r = parseFloat(w.flRadius); return (r > 0) ? Math.max(5, Math.min(200, r)) : 30; }

  /** Daten holen; mehrere Kacheln mit gleichem Umkreis teilen sich eine Anfrage. */
  function flLade(r, cb) {
    var c = _flCache[r];
    if (c && (Date.now() - c.geholt) < 25000) { cb && cb(c); return; }
    if (_flWarte[r]) { if (cb) _flWarte[r].push(cb); return; }
    _flWarte[r] = cb ? [cb] : [];
    fetch('?api=flights&r=' + r, { cache: 'no-store' })
      .then(function (x) { return x.json(); })
      .then(function (j) {
        j.geholt = Date.now();
        j.flug = j.flug || [];
        _flCache[r] = j;
        (_flWarte[r] || []).forEach(function (f) { try { f(j); } catch (e) {} });
        delete _flWarte[r];
      })
      .catch(function () { (_flWarte[r] || []).forEach(function (f) { try { f(_flCache[r] || null); } catch (e) {} }); delete _flWarte[r]; });
  }

  /* ICAO-Musterkennung in einen lesbaren Namen uebersetzen.
   *
   * adsbdb liefert die amtliche Kennung: "A20N", "B738", "B77W". Das ist korrekt,
   * aber niemand liest daraus einen A320neo, eine 737-800 oder eine 777-300ER.
   * Die Tabelle deckt den europaeischen Verkehr ab; alles andere faellt auf die
   * Kennung zurueck, damit nie etwas Falsches behauptet wird.
   */
  var _FL_MUSTER = {
    // Airbus
    A19N:'A319neo', A20N:'A320neo', A21N:'A321neo',
    A318:'A318', A319:'A319', A320:'A320', A321:'A321',
    A332:'A330-200', A333:'A330-300', A338:'A330-800neo', A339:'A330-900neo',
    A342:'A340-200', A343:'A340-300', A345:'A340-500', A346:'A340-600',
    A359:'A350-900', A35K:'A350-1000', A388:'A380-800',
    A124:'Antonov An-124', A225:'Antonov An-225',
    // Boeing
    B37M:'737 MAX 7', B38M:'737 MAX 8', B39M:'737 MAX 9', B3XM:'737 MAX 10',
    B733:'737-300', B734:'737-400', B735:'737-500',
    B736:'737-600', B737:'737-700', B738:'737-800', B739:'737-900',
    B741:'747-100', B742:'747-200', B743:'747-300', B744:'747-400', B748:'747-8',
    B752:'757-200', B753:'757-300',
    B762:'767-200', B763:'767-300', B764:'767-400',
    B772:'777-200', B77L:'777-200LR', B773:'777-300', B77W:'777-300ER', B778:'777-8', B779:'777-9',
    B788:'787-8', B789:'787-9', B78X:'787-10',
    // Embraer
    E135:'ERJ 135', E145:'ERJ 145', E170:'E170', E175:'E175', E190:'E190', E195:'E195',
    E290:'E190-E2', E295:'E195-E2', E545:'Legacy 450', E550:'Legacy 500', E55P:'Phenom 300',
    // Bombardier / Airbus Canada
    BCS1:'A220-100', BCS3:'A220-300',
    CRJ2:'CRJ200', CRJ7:'CRJ700', CRJ9:'CRJ900', CRJX:'CRJ1000',
    DH8A:'Dash 8-100', DH8C:'Dash 8-300', DH8D:'Dash 8 Q400',
    GLEX:'Global Express', GL5T:'Global 5000', GLF4:'Gulfstream IV', GLF5:'Gulfstream V', GLF6:'Gulfstream G650',
    CL30:'Challenger 300', CL35:'Challenger 350', CL60:'Challenger 600',
    // ATR und Turboprop
    AT43:'ATR 42-300', AT45:'ATR 42-500', AT72:'ATR 72', AT75:'ATR 72-500', AT76:'ATR 72-600',
    SB20:'Saab 2000', SF34:'Saab 340', PC12:'Pilatus PC-12', PC24:'Pilatus PC-24',
    TBM7:'TBM 700', TBM8:'TBM 850', TBM9:'TBM 900',
    // Kleinflugzeuge und Geschaeftsreise
    C172:'Cessna 172', C182:'Cessna 182', C206:'Cessna 206', C208:'Cessna Caravan',
    C25A:'Citation CJ2', C25B:'Citation CJ3', C25C:'Citation CJ4', C510:'Citation Mustang',
    C525:'CitationJet', C550:'Citation II', C560:'Citation V', C56X:'Citation Excel', C68A:'Citation Latitude',
    P28A:'Piper Cherokee', P28R:'Piper Arrow', PA31:'Piper Navajo', PA34:'Piper Seneca', PA46:'Piper Malibu',
    DA40:'Diamond DA40', DA42:'Diamond DA42', DA62:'Diamond DA62', DV20:'Diamond Katana',
    SR20:'Cirrus SR20', SR22:'Cirrus SR22', BE20:'King Air 200', BE9L:'King Air 90', B350:'King Air 350',
    LJ35:'Learjet 35', LJ45:'Learjet 45', LJ60:'Learjet 60', LJ75:'Learjet 75',
    F2TH:'Falcon 2000', FA7X:'Falcon 7X', FA8X:'Falcon 8X', F900:'Falcon 900',
    H25B:'Hawker 800', HDJT:'HondaJet',
    // Hubschrauber
    EC20:'Airbus H120', EC25:'Airbus H225', EC30:'Airbus H130', EC35:'Airbus H135',
    EC45:'Airbus H145', EC55:'Airbus H155', AS50:'Ecureuil', AS55:'Twin Squirrel',
    B06:'Bell 206', B407:'Bell 407', B412:'Bell 412', B429:'Bell 429',
    R22:'Robinson R22', R44:'Robinson R44', R66:'Robinson R66',
    // Fracht und Sonstiges
    MD11:'MD-11', B461:'BAe 146-100', B462:'BAe 146-200', B463:'BAe 146-300',
    SW4:'Metroliner', L410:'Let L-410', AN26:'Antonov An-26', AN12:'Antonov An-12',
    C130:'C-130 Hercules', A400:'Airbus A400M', C17:'C-17 Globemaster'
  };
  function flMusterName(typ) {
    if (!typ) { return ''; }
    var t = String(typ).toUpperCase();
    return _FL_MUSTER[t] || t;
  }
  /* Herstellernamen kuerzen. adsbdb liefert die Firmierung, nicht die Marke:
     "Airbus Canada Limited Partnership", "The Boeing Company". In eine 86 px
     breite Spalte passt das nicht, und gemeint ist ohnehin die Marke. */
  function flHersteller(h) {
    if (!h) { return ''; }
    var t = String(h)
      .replace(/^The\s+/i, '')
      .replace(/\s*\b(Limited|Ltd|Partnership|Company|Corporation|Corp|Incorporated|Inc|GmbH|PLC|Industrie[sn]?|Aircraft|Aviation|Aerospace|Group|Werke)\b.*$/i, '')
      .replace(/[\s,]*\bS\.?\s?A\.?(S\.?)?$/i, '')      // Embraer S.A., Dassault S.A.S
      .replace(/[\s,]*\bN\.?\s?V\.?$/i, '')
      .trim();
    if (t.length <= 16) { return t; }
    // Kuerzen, aber nicht sinnentstellend: bei einem sehr kurzen ersten Wort
    // gehoert das zweite dazu, sonst wird aus "De Havilland Canada" ein "De".
    var teile = t.split(/\s+/);
    return (teile[0].length <= 3 && teile[1]) ? (teile[0] + ' ' + teile[1]) : teile[0];
  }

  /**
   * Kleines Schild mit der Route unter dem Rufzeichen.
   *
   * Start und Ziel liegen ohnehin in derselben Antwort wie die Position (der
   * Server schlaegt sie bei adsbdb nach). Sie fehlen bei Privat- und
   * Militaermaschinen - dann bleibt das Schild weg, statt eine leere Huelse zu
   * zeichnen. Bewusst nur die drei Buchstaben je Flughafen: die Ortsnamen
   * ("Palma De Mallorca - Warsaw") sind breiter als der Abstand zwischen zwei
   * Maschinen auf der Kuppel.
   *
   * Die abgedunkelte Traegerflaeche ist noetig, damit die Schrift ueber
   * Nachbarhaeusern, Hoehenringen und Energiebahnen lesbar bleibt.
   *
   * Wird von der Flugkuppel UND der Sonnenszene benutzt - beide liegen im
   * selben Buendel, deshalb genuegt eine Fassung.
   */
  function flRoutenschild(g, f, x, y, groesse, nacht) {
    if (!f || !f.von || !f.nach) { return; }
    var txt = String(f.von) + ' \u2192 ' + String(f.nach);
    var rs  = Math.max(7, groesse * 0.78);
    g.font = '600 ' + rs + 'px ' + (cssv('--fm') || 'ui-monospace,monospace');
    var br  = g.measureText(txt).width;
    var pad = Math.max(2, rs * 0.35), h = rs + pad * 2, r0 = Math.min(4, h / 2);
    g.beginPath();
    g.moveTo(x - pad + r0, y - rs);
    g.arcTo(x + br + pad, y - rs, x + br + pad, y - rs + h, r0);
    g.arcTo(x + br + pad, y + pad, x - pad, y + pad, r0);
    g.arcTo(x - pad, y + pad, x - pad, y - rs, r0);
    g.arcTo(x - pad, y - rs, x + br + pad, y - rs, r0);
    g.closePath();
    g.fillStyle = nacht ? 'rgba(8,16,22,.62)' : 'rgba(6,20,24,.52)';
    g.fill();
    g.fillStyle = nacht ? 'rgba(170,195,205,.85)' : 'rgba(210,232,236,.92)';
    g.fillText(txt, x, y);
  }

  /* Hersteller und Muster zu einer Zeile fuegen - ohne Doppelung.
   *
   * Viele Musternamen tragen die Marke schon in sich: "Airbus H135",
   * "Cessna 172", "Robinson R44". Wer davor stumpf den Hersteller setzt,
   * schreibt "Airbus Airbus H135" - genau so ist es am 30.08.2026 bei einem
   * Rettungshubschrauber (EC35, Halter Airbus Helicopters) aufgefallen.
   * Steckt die Marke bereits im Namen, bleibt sie weg.
   */
  function flTypText(f) {
    var mus = flMusterName(f.typ);
    var her = flHersteller(f.hersteller);
    if (!her) { return mus; }
    var m = mus.toLowerCase();
    if (m.indexOf(her.toLowerCase()) >= 0) { return mus; }
    // Auch das erste Wort pruefen: die Firmierung heisst "Cirrus Design", der
    // Modellname "Cirrus SR22" - ohne diesen Blick stuende dort zweimal Cirrus.
    var erst = her.split(/\s+/)[0].toLowerCase();
    if (erst.length >= 4 && m.indexOf(erst) >= 0) { return mus; }
    return her + ' ' + mus;
  }

  /* Bauart aus Tempo und Hoehe geschaetzt. OpenSky liefert die Kategorie praktisch
     nie - bei einer Stichprobe am 29.08.2026 stand sie bei 17 von 18 Maschinen auf
     "unbekannt", und der Metadaten-Endpunkt ist seit 2026 abgeschaltet (HTTP 410). */
  function flBauart(f) {
    if (f.tempo < 140 && f.alt < 2500) return 'heli';
    if (f.tempo > 520 || f.alt > 7000) return 'jet';
    return 'prop';
  }
  function flFarbe(alt) { return alt < 1000 ? cssv('--warm') : (alt < 6000 ? cssv('--accent') : cssv('--info')); }

  /** Stellung t Sekunden nach dem Messzeitpunkt - Koppelnavigation. */
  function flStellung(f, t) {
    var v = (f.tempo || 0) / 3.6 / 1000, k = (f.kurs || 0) * Math.PI / 180;
    return { dn: f.dn + v * Math.cos(k) * t, de: f.de + v * Math.sin(k) * t,
             alt: Math.max(0, f.alt + (f.steig || 0) * t) };
  }
  function flAlter(d) { return d ? Math.max(0, (Date.now() / 1000) - (d.stand || 0)) : 0; }

  /** Silhouette, Nase nach oben. Wird in Kursrichtung gedreht gezeichnet. */
  function flFlieger(g, art, s) {
    g.beginPath();
    if (art === 'jet') {
      g.moveTo(0, -11 * s); g.lineTo(1.7 * s, -4 * s); g.lineTo(10 * s, 3.5 * s); g.lineTo(10 * s, 5.6 * s);
      g.lineTo(1.7 * s, 2.4 * s); g.lineTo(1.5 * s, 8 * s); g.lineTo(4.2 * s, 10.4 * s);
      g.lineTo(4.2 * s, 11.6 * s); g.lineTo(0, 10.4 * s); g.lineTo(-4.2 * s, 11.6 * s);
      g.lineTo(-4.2 * s, 10.4 * s); g.lineTo(-1.5 * s, 8 * s); g.lineTo(-1.7 * s, 2.4 * s);
      g.lineTo(-10 * s, 5.6 * s); g.lineTo(-10 * s, 3.5 * s); g.lineTo(-1.7 * s, -4 * s);
    } else if (art === 'prop') {
      g.moveTo(0, -9 * s); g.lineTo(1.4 * s, -3 * s); g.lineTo(9 * s, -1.2 * s); g.lineTo(9 * s, 0.8 * s);
      g.lineTo(1.4 * s, 2.2 * s); g.lineTo(1.3 * s, 7.4 * s); g.lineTo(3.6 * s, 9.2 * s);
      g.lineTo(3.6 * s, 10.3 * s); g.lineTo(0, 9.2 * s); g.lineTo(-3.6 * s, 10.3 * s);
      g.lineTo(-3.6 * s, 9.2 * s); g.lineTo(-1.3 * s, 7.4 * s); g.lineTo(-1.4 * s, 2.2 * s);
      g.lineTo(-9 * s, 0.8 * s); g.lineTo(-9 * s, -1.2 * s); g.lineTo(-1.4 * s, -3 * s);
    } else {
      g.moveTo(0, -7 * s); g.lineTo(2.4 * s, -3.4 * s); g.lineTo(2.4 * s, 5 * s); g.lineTo(1 * s, 6.4 * s);
      g.lineTo(1 * s, 10 * s); g.lineTo(2.6 * s, 10 * s); g.lineTo(2.6 * s, 11.2 * s);
      g.lineTo(-2.6 * s, 11.2 * s); g.lineTo(-2.6 * s, 10 * s); g.lineTo(-1 * s, 10 * s);
      g.lineTo(-1 * s, 6.4 * s); g.lineTo(-2.4 * s, 5 * s); g.lineTo(-2.4 * s, -3.4 * s);
    }
    g.closePath();
  }

  /** Nacht? Aus dem Sonnenstand, nicht aus dem Skin - ein dunkles Design ist kein Abend. */
  function flNacht(w) {
    try {
      var g = (typeof houseGeo === 'function') ? houseGeo() : null;
      var la = (g && g.lat) || 48.0657, lo = (g && g.lon) || 14.1241;
      return LVSUN.pos(la, lo, Date.now() / 1000).elev < -1;
    } catch (e) { return false; }
  }

  /** Positionslichter: rot links, gruen rechts, weisser Blitz. Nur nachts. */
  function flLichter(g, f, x, y, sk) {
    var t = Date.now() / 1000, blitz = (t % 1.6) < 0.09;
    g.save(); g.translate(x, y); g.rotate((f.kurs || 0) * Math.PI / 180);
    [[-10 * sk, 4 * sk, '#ff4d4d'], [10 * sk, 4 * sk, '#3ddc63']].forEach(function (p) {
      g.beginPath(); g.arc(p[0], p[1], 1.9 * sk, 0, 7);
      g.fillStyle = p[2]; g.shadowColor = p[2]; g.shadowBlur = 7 * sk; g.fill();
    });
    if (blitz) {
      g.beginPath(); g.arc(0, 10 * sk, 2.6 * sk, 0, 7);
      g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 12 * sk; g.fill();
    }
    g.shadowBlur = 0; g.restore();
  }

  /**
   * Taktgeber MIT Selbstabschaltung.
   *
   * Der LiveViewBuilder kennt keinen Abbau-Haken: Wechselt der Nutzer die Ansicht,
   * verschwindet das Element aus dem Dokument, das Widget-Objekt bleibt bestehen. Ein
   * setInterval ohne eigene Pruefung laeuft deshalb FUER IMMER weiter - auch auf Seiten,
   * die niemand mehr ansieht.
   *
   * Genau das war der Abruftakt dieser Familie: `w._flPoll` wurde an drei Stellen gesetzt
   * und nirgends beendet. Jeder Besuch der Flugseite hinterliess drei Takte, die alle
   * 30 Sekunden ?api=flights abfragen - kumulativ, ueber alle Geraete. Am 30.08.2026 ist
   * daran erst ein iPhone erstickt (Seite laedt vollstaendig, ist aber nicht bedienbar)
   * und dann die Hook-Schicht des Servers: eine Antwort von 20 Byte brauchte 23 Sekunden,
   * weil kein Thread mehr frei war.
   *
   * Deshalb prueft jeder Takt selbst, ob es sein Element noch gibt, und haengt sich sonst aus.
   */
  /* Zeitmessung, nur mit &diag=1: schreibt die Dauer einzelner Schritte in dasselbe
     Protokoll wie der Zustandsmelder. Damit laesst sich sagen, WELCHER Teil den
     Hauptthread besetzt, statt es zu vermuten. */
  var _flDiag = /[?&]diag=1/.test(location.search);
  function flMess(name, fn) {
    if (!_flDiag) { return fn(); }
    var t0 = (performance && performance.now) ? performance.now() : Date.now();
    var r = fn();
    var ms = Math.round(((performance && performance.now) ? performance.now() : Date.now()) - t0);
    if (ms >= 3) {
      try {
        new Image().src = '?api=jserr&key=' + encodeURIComponent((window.LVCFG || {}).t || '')
          + '&m=ZEIT&s=flug&l=0&v=&t=' + encodeURIComponent(name + ' = ' + ms + ' ms');
      } catch (e) {}
    }
    return r;
  }

  var _flSatPos = {};   // KachelID -> zuletzt gerechnete Satellitenpositionen
  var _flDauer = {};
  function flTaktSicher(w, name, ms, fn) {
    var reg = _flDauer[w.id] || (_flDauer[w.id] = {});
    if (reg[name]) { clearInterval(reg[name]); }
    reg[name] = setInterval(function () {
      var el = $('.w[data-id="' + w.id + '"]', canvas) || $('.w[data-id="' + w.id + '"]', $('#ovcanvas'));
      if (!el) { clearInterval(reg[name]); delete reg[name]; return; }
      fn();
    }, ms);
  }

  /** Gemeinsamer Zeichentakt einer Kachel - 5 Bilder je Sekunde. */
  function flTakt(w, zeichne) {
    if (_flTick[w.id]) { clearInterval(_flTick[w.id]); }
    _flTick[w.id] = setInterval(function () {
      var el = $('.w[data-id="' + w.id + '"]', canvas) || $('.w[data-id="' + w.id + '"]', $('#ovcanvas'));
      if (!el) { clearInterval(_flTick[w.id]); delete _flTick[w.id]; return; }
      zeichne();
    }, 200);
  }
  function flBox(w, rolle) {
    var el = $('.w[data-id="' + w.id + '"] [data-role=' + (rolle || 'flbox') + ']', canvas)
          || $('.w[data-id="' + w.id + '"] [data-role=' + (rolle || 'flbox') + ']', $('#ovcanvas'));
    return el;
  }
  function flCanvas(box) {
    var c = box.firstElementChild, dpr = Math.min(2.5, window.devicePixelRatio || 1);
    /* clientWidth/-Height, NICHT getBoundingClientRect().
     *
     * Im mobilen Umbruch wird die Kachel per CSS-Transformation verkleinert.
     * getBoundingClientRect() liefert dann das Mass NACH der Skalierung - die
     * Leinwand bekam eine zu kleine Breite zugewiesen, schrumpfte dadurch
     * weiter und sass als kleines Bild in der linken oberen Ecke ihrer Kachel.
     * clientWidth ist das Layoutmass und von der Transformation unberuehrt. */
    var r = box.getBoundingClientRect();
    var W = Math.max(60, Math.round(box.clientWidth || r.width));
    var H = Math.max(50, Math.round(box.clientHeight || r.height));
    if (c.width !== W * dpr || c.height !== H * dpr) {
      c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
    }
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, W: W, H: H };
  }
  function flBeobachte(w, zeichne) {
    var box = flBox(w);
    if (box && typeof ResizeObserver !== 'undefined') {
      if (_flRO[w.id]) { try { _flRO[w.id].disconnect(); } catch (e) {} }
      var ro = new ResizeObserver(function () { zeichne(); });
      ro.observe(box); _flRO[w.id] = ro;
    }
  }

  // ------------------------------------------------------------------ Buehne
  defWidget('flightscene', {
    label: 'Flugszene', cat: 'Wetter & Zeit', paletteIcon: 'plane', size: [520, 320], noHover: true,
    defaults: function (w) { w.flRadius = 30; w.flTrail = 5; w.flLabels = true; w.flTilt = 38; },
    render: function () { return '<div data-role="flbox" style="width:100%;height:100%"><canvas></canvas></div>'; },
    mount: function (w) {
      var zeichne = function () {
        var box = flBox(w); if (!box) return;
        var k = flCanvas(box), g = k.g, W = k.W, H = k.H;
        flPunkteLeeren(w);   // Trefferflaechen bei jedem Bild neu sammeln
        var R = flRadius(w), d = _flCache[R], nacht = flNacht(w);
        var tilt = Math.max(0.15, Math.min(0.7, (parseFloat(w.flTilt) || 38) / 100));
        /* Massstab aus BEIDEN Maessen, nicht nur aus der Breite.
         *
         * Vorher galt s = W*0.40/R und cy = H*0.755. Bei einer breiten, flachen
         * Kachel (919x433 nach dem Umbau am 30.08.2026) ergab das eine halbe
         * Ellipsenhoehe von 140 px, wo unter der Mitte nur 106 px Platz waren -
         * der Ring lief unten aus der Kachel. Jetzt begrenzen Breite UND Hoehe,
         * und die Mitte wird aus der tatsaechlichen Ellipsenhoehe gesetzt statt
         * aus einem festen Bruchteil. Oben bleibt, was uebrig ist: Kopfraum fuer
         * die Maschinen und ihre Lotlinien. */
        var sBreit = (W * 0.435) / R;
        var sHoch  = (H * 0.30) / (R * tilt);
        var s  = Math.max(0.5, Math.min(sBreit, sHoch));
        var cx = W / 2, cy = H - R * s * tilt * 1.12 - 14;
        var grd = g.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, nacht ? '#060c14' : '#09171f');
        grd.addColorStop(0.62, cssv('--tile') || '#0c1416');
        grd.addColorStop(1, cssv('--tile') || '#0a1113');
        g.fillStyle = grd; g.fillRect(0, 0, W, H);
        g.beginPath(); g.ellipse(cx, cy, R * s, R * s * tilt, 0, 0, 7);
        g.fillStyle = 'rgba(18,32,36,.5)'; g.fill();
        var ringe = [Math.round(R / 3), Math.round(R * 2 / 3), R];
        ringe.forEach(function (r) {
          g.beginPath(); g.ellipse(cx, cy, r * s, r * s * tilt, 0, 0, 7);
          g.strokeStyle = (r === R) ? (cssv('--line') || '#2a3d41') : (cssv('--line-soft') || '#1c292c');
          g.lineWidth = (r === R) ? 1.3 : 1; g.stroke();
          g.font = '9.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = cssv('--faint') || '#3c4c50';
          g.fillText(r + ' km', cx + r * s - 30, cy + r * s * tilt - 4);
        });
        [['N', 0], ['O', 90], ['S', 180], ['W', 270]].forEach(function (p) {
          var a = p[1] * Math.PI / 180;
          g.font = '600 10.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = cssv('--muted') || '#61767a';
          g.textAlign = 'center';
          g.fillText(p[0], cx + Math.sin(a) * R * s * 1.06, cy - Math.cos(a) * R * s * tilt * 1.06 + 4);
          g.textAlign = 'left';
        });
        // Haus
        var b = Math.max(10, W * 0.024), hh = b * 0.78, dh = b * 0.5;
        g.beginPath(); g.ellipse(cx, cy, b + 7, (b + 7) * tilt, 0, 0, 7);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fill();
        g.fillStyle = '#1a282c'; g.strokeStyle = '#31474d'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(cx - b, cy); g.lineTo(cx - b, cy - hh); g.lineTo(cx, cy - hh - dh);
        g.lineTo(cx + b, cy - hh); g.lineTo(cx + b, cy); g.closePath(); g.fill(); g.stroke();

        if (!d) {
          g.font = '11px ' + (cssv('--fm') || 'monospace'); g.fillStyle = cssv('--faint') || '#4d5f63';
          g.textAlign = 'center'; g.fillText('lade Flugdaten …', cx, H * 0.3); g.textAlign = 'left';
          return;
        }
        var vs = flAlter(d), spur = Math.max(0, Math.min(20, parseFloat(w.flTrail) || 5)) * 60;
        var proj = function (de, dn, alt) { return [cx + de * s, cy - dn * s * tilt - (alt / 1000) * s]; };
        var drin = function (de, dn) { return Math.hypot(de, dn) <= R; };
        var schilder = [];
        d.flug.slice().sort(function (a, b) { return a.alt - b.alt; }).forEach(function (f) {
          var p = flStellung(f, vs); if (!drin(p.de, p.dn)) return;
          var col = flFarbe(p.alt);
          var gp = proj(p.de, p.dn, 0), ap = proj(p.de, p.dn, p.alt);
          // Auswahl: Trefferflaeche an der MASCHINE (ap), nicht am Bodenpunkt -
          // getippt wird auf das Flugzeug, nicht auf seinen Lotfusspunkt.
          flPunktAn(w, ap[0], ap[1], 11, 'flug', f.icao || f.ruf);
          if (flGewaehlt('flug', f.icao || f.ruf)) { flMarke(g, ap[0], ap[1], 14); }
          if (spur > 0) {
            g.beginPath(); var auf = false;
            for (var dt = 0; dt >= -spur; dt -= 15) {
              var q = flStellung(f, vs + dt);
              if (!drin(q.de, q.dn)) { auf = false; continue; }
              var t = proj(q.de, q.dn, q.alt);
              if (auf) { g.lineTo(t[0], t[1]); } else { g.moveTo(t[0], t[1]); auf = true; }
            }
            g.strokeStyle = col; g.globalAlpha = 0.24; g.lineWidth = 1.6; g.lineCap = 'round';
            g.stroke(); g.globalAlpha = 1;
          }
          g.beginPath(); g.moveTo(ap[0], ap[1]); g.lineTo(gp[0], gp[1]);
          g.strokeStyle = col; g.globalAlpha = 0.18; g.lineWidth = 1;
          g.setLineDash([2, 3]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
          g.beginPath(); g.ellipse(gp[0], gp[1], 3.6, 1.7, 0, 0, 7);
          g.fillStyle = col; g.globalAlpha = 0.26; g.fill(); g.globalAlpha = 1;
          var el = Math.atan2(p.alt / 1000, Math.hypot(p.de, p.dn)) * 180 / Math.PI;
          if (el >= 45) {
            g.beginPath(); g.arc(ap[0], ap[1], 17, 0, 7);
            g.strokeStyle = cssv('--accent'); g.globalAlpha = 0.35; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
          }
          var art = flBauart(f), sk = (art === 'jet') ? 0.95 : (art === 'prop' ? 0.8 : 0.75);
          if (nacht) {
            g.save(); g.translate(ap[0], ap[1]); g.rotate((f.kurs || 0) * Math.PI / 180);
            flFlieger(g, art, sk * 0.9); g.fillStyle = 'rgba(150,180,190,.30)'; g.fill(); g.restore();
            flLichter(g, f, ap[0], ap[1], sk);
          } else {
            g.save(); g.translate(ap[0], ap[1]); g.rotate((f.kurs || 0) * Math.PI / 180);
            flFlieger(g, art, sk);
            g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 9; g.fill(); g.shadowBlur = 0;
            g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 0.7; g.stroke(); g.restore();
          }
          if (w.flLabels !== false) schilder.push({ x: ap[0] + 13, y: ap[1], col: col, f: f, el: el, alt: p.alt });
        });
        // Beschriftungen entzerren, sonst kleben sie im Zentrum uebereinander
        schilder.sort(function (a, b) { return a.y - b.y; });
        for (var i = 1; i < schilder.length; i++) {
          if (schilder[i].y - schilder[i - 1].y < 24) schilder[i].y = schilder[i - 1].y + 24;
        }
        schilder.forEach(function (t) {
          var gew = flGewaehlt('flug', t.f.icao || t.f.ruf);
          g.font = '600 10.5px ' + (cssv('--fm') || 'monospace');
          g.fillStyle = gew ? (cssv('--accent') || '#00cdab') : t.col;
          g.fillText(t.f.ruf || '—', t.x, t.y - 3);
          g.font = '9.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = cssv('--muted') || '#8ba0a4';
          g.fillText((t.alt / 1000).toFixed(1) + ' km · ' + Math.round(t.el) + '°'
                     + (t.f.von ? (' · ' + t.f.von + '→' + t.f.nach) : ''), t.x, t.y + 8);
        });
        g.font = '10px ' + (cssv('--fm') || 'monospace'); g.fillStyle = cssv('--faint') || '#4d5f63';
        g.fillText(d.flug.length + ' in der Luft · ' + R + ' km', 10, 15);
      };
      flLade(flRadius(w), function () { zeichne(); });
      flBeobachte(w, zeichne); flTakt(w, zeichne); zeichne();
      flMalerAn(w, zeichne); flKlickAn(w);   // Auswahl: neu zeichnen lassen und Klicks annehmen
      flTaktSicher(w, 'poll', 30000, function () { flLade(flRadius(w), null); });
    },
    props: function (w) {
      return row('Umkreis (km)', '<input id="pFlR" type="number" min="5" max="200" value="' + (w.flRadius || 30) + '">')
        + row('Neigung', '<input id="pFlT" type="number" min="15" max="70" value="' + (w.flTilt || 38) + '"> <span style="font-size:11px;color:var(--muted)">wie stark die Bühne gekippt ist</span>')
        + row('Spur (Minuten)', '<input id="pFlS" type="number" min="0" max="20" value="' + (w.flTrail != null ? w.flTrail : 5) + '">')
        + row('Beschriftung', '<input type="checkbox" id="pFlL"' + (w.flLabels !== false ? ' checked' : '') + '>');
    },
    wire: function (w) {
      if ($('#pFlR')) $('#pFlR').onchange = function () { w.flRadius = parseInt(this.value) || 30; render(); commit(); };
      if ($('#pFlT')) $('#pFlT').oninput = function () { w.flTilt = parseInt(this.value) || 38; render(); commit(); };
      if ($('#pFlS')) $('#pFlS').oninput = function () { w.flTrail = parseFloat(this.value); render(); commit(); };
      if ($('#pFlL')) $('#pFlL').onchange = function () { w.flLabels = this.checked; render(); commit(); };
    }
  });

  // ------------------------------------------------------------------ Kuppel
  defWidget('flightsky', {
    label: 'Flug · Blickrichtung', cat: 'Wetter & Zeit', paletteIcon: 'plane', size: [280, 260], noHover: true,
    defaults: function (w) { w.flRadius = 30; w.flLabels = true; },
    render: function () { return '<div data-role="flbox" style="width:100%;height:100%"><canvas></canvas></div>'; },
    mount: function (w) {
      var zeichne = function () {
        var box = flBox(w); if (!box) return;
        var k = flCanvas(box), g = k.g, W = k.W, H = k.H;
        flPunkteLeeren(w);   // Trefferflaechen bei jedem Bild neu sammeln
        var R = flRadius(w), d = _flCache[R], nacht = flNacht(w);
        // Der Rand fuer die Himmelsrichtungen richtet sich nach der ENGEREN Seite.
        // Aus der Breite gerechnet schrumpfte die Kuppel in einer breiten, flachen
        // Kachel unnoetig: 518x353 ergab 36 px Rand, obwohl die Hoehe das Mass gibt.
        var kurz = Math.min(W, H), rnd = Math.max(14, kurz * 0.085);
        var cx = W / 2, cy = H / 2, rad = Math.max(30, kurz / 2 - rnd);
        g.fillStyle = cssv('--tile') || '#0c1416'; g.fillRect(0, 0, W, H);
        g.beginPath(); g.arc(cx, cy, rad, 0, 7);
        g.fillStyle = nacht ? 'rgba(8,14,22,.8)' : 'rgba(16,28,32,.7)'; g.fill();
        [30, 60].forEach(function (e) {
          g.beginPath(); g.arc(cx, cy, rad * (90 - e) / 90, 0, 7);
          g.strokeStyle = cssv('--line') || '#243437'; g.lineWidth = 1;
          g.setLineDash([3, 4]); g.stroke(); g.setLineDash([]);
        });
        g.beginPath(); g.arc(cx, cy, rad, 0, 7);
        g.strokeStyle = cssv('--line') || '#2c4045'; g.lineWidth = 1.3; g.stroke();
        [['N', 0], ['O', 90], ['S', 180], ['W', 270]].forEach(function (p) {
          var a = p[1] * Math.PI / 180;
          g.font = '600 10.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = cssv('--muted') || '#61767a';
          g.textAlign = 'center';
          g.fillText(p[0], cx + Math.sin(a) * (rad + 12), cy - Math.cos(a) * (rad + 12) + 4);
          g.textAlign = 'left';
        });
        g.beginPath(); g.arc(cx, cy, 2.5, 0, 7); g.fillStyle = '#31474d'; g.fill();
        if (!d) return;
        var vs = flAlter(d);
        d.flug.forEach(function (f) {
          var p = flStellung(f, vs), dist = Math.hypot(p.de, p.dn);
          if (dist > R) return;
          var el = Math.atan2(p.alt / 1000, dist) * 180 / Math.PI;
          var az = (Math.atan2(p.de, p.dn) * 180 / Math.PI + 360) % 360;
          var a = az * Math.PI / 180, rr = rad * (90 - el) / 90;
          var x = cx + Math.sin(a) * rr, y = cy - Math.cos(a) * rr, col = flFarbe(p.alt);
          if (el >= 45) {
            g.beginPath(); g.arc(x, y, 14, 0, 7);
            g.strokeStyle = cssv('--accent'); g.globalAlpha = 0.4; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
          }
          var sk = Math.max(0.4, Math.min(0.75, rad / 150));
          flPunktAn(w, x, y, 10, 'flug', f.icao || f.ruf);
          if (flGewaehlt('flug', f.icao || f.ruf)) { flMarke(g, x, y, 13); }
          if (nacht) {
            g.save(); g.translate(x, y); g.rotate((f.kurs || 0) * Math.PI / 180);
            flFlieger(g, flBauart(f), sk * 0.9); g.fillStyle = 'rgba(150,180,190,.30)'; g.fill(); g.restore();
            flLichter(g, f, x, y, sk * 1.1);
          } else {
            g.save(); g.translate(x, y); g.rotate((f.kurs || 0) * Math.PI / 180);
            flFlieger(g, flBauart(f), sk);
            g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.fill(); g.shadowBlur = 0; g.restore();
          }
          if (w.flLabels !== false) {
            g.font = '600 9.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = col;
            g.fillText(f.ruf || '—', x + 10, y + 3);
            if (w.flRoute !== false) { flRoutenschild(g, f, x + 10, y + 12, 9.5, nacht); }
          }
        });
        // Sichtbare Satelliten kommen in dieselbe Kuppel - dieselbe Frage,
        // dieselbe Antwort: wohin muss ich schauen.
        // Satelliten NUR MALEN, nicht rechnen.
        //
        // Hier stand `satJetzt(...)` mitten in der Zeichenfunktion - also in einem Weg,
        // der fuenfmal je Sekunde durchlaufen wird, und jeder Durchlauf hat Bahnen
        // fortgeschrieben. Gemessen am 30.08.2026: dieselbe Seite braucht mit dieser
        // Ebene 25,7 Sekunden reine Rechenzeit, ohne sie 0,4 - Faktor 62. Auf einem
        // Telefon steht der Hauptthread so lange, dass die ganze Anwendung tot wirkt,
        // auch noch nach dem Verlassen der Seite.
        //
        // Gerechnet wird jetzt in einem eigenen, langsamen Takt (siehe mount), gemalt
        // wird nur das zuletzt Gerechnete. Satelliten bewegen sich sichtbar, aber
        // nicht in 200 Millisekunden.
        if (w.flSats) {
          (function (L) {
            L.forEach(function (s) {
              if (!s.sichtbar) { return; }
              var a2 = s.az * Math.PI / 180, r2 = rad * (90 - s.el) / 90;
              var sx = cx + Math.sin(a2) * r2, sy = cy - Math.cos(a2) * r2;
              flPunktAn(w, sx, sy, 8, 'sat', s.name);
              if (flGewaehlt('sat', s.name)) { flMarke(g, sx, sy, 11); }
              g.beginPath(); g.arc(sx, sy, 4, 0, 7);
              g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
              g.font = '600 9.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = '#fff';
              g.fillText(s.name, sx + 9, sy + 3);
            });
          })(_flSatPos[w.id] || []);
        }
      };
      flLade(flRadius(w), function () { zeichne(); });
      flBeobachte(w, zeichne); flTakt(w, zeichne); zeichne();
      flMalerAn(w, zeichne); flKlickAn(w);   // Auswahl: neu zeichnen lassen und Klicks annehmen
      flTaktSicher(w, 'poll', 30000, function () { flLade(flRadius(w), null); });
      // Satellitenpositionen in EIGENEM, langsamem Takt rechnen - nie beim Zeichnen.
      if (w.flSats && typeof satJetzt === 'function') {
        var holeSats = function () {
          // Nur nachts sichtbar - das steckt schon in s.sichtbar (Sonne unter -6 Grad,
          // ueber 10 Grad Hoehe, von der Sonne angestrahlt) und wird beim Malen geprueft.
          satJetzt(w.flSatGroup || 'visual', { lat: 48.0657, lon: 14.1241 }, function (L) {
            _flSatPos[w.id] = L || [];
            zeichne();          // sonst liegt das Ergebnis bis zum naechsten Bild brach
          });
        };
        holeSats();
        flTaktSicher(w, 'sats', 15000, holeSats);
      }
    },
    props: function (w) {
      return row('Umkreis (km)', '<input id="pFsR" type="number" min="5" max="200" value="' + (w.flRadius || 30) + '">')
        + row('Rufzeichen zeigen', '<input type="checkbox" id="pFsL"' + (w.flLabels !== false ? ' checked' : '') + '>')
        + row('Satelliten', '<input type="checkbox" id="pFsS"' + (w.flSats ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">sichtbare Überflüge mit einzeichnen</span>')
        + row('Gruppe', '<select id="pFsG"><option value="visual"' + ((w.flSatGroup || 'visual') === 'visual' ? ' selected' : '') + '>helle Satelliten</option>'
            + '<option value="stations"' + (w.flSatGroup === 'stations' ? ' selected' : '') + '>nur Raumstationen</option></select>');
    },
    wire: function (w) {
      if ($('#pFsR')) $('#pFsR').onchange = function () { w.flRadius = parseInt(this.value) || 30; render(); commit(); };
      if ($('#pFsL')) $('#pFsL').onchange = function () { w.flLabels = this.checked; render(); commit(); };
      if ($('#pFsS')) $('#pFsS').onchange = function () { w.flSats = this.checked || undefined; render(); commit(); };
      if ($('#pFsG')) $('#pFsG').onchange = function () { w.flSatGroup = this.value === 'stations' ? 'stations' : undefined; render(); commit(); };
    }
  });

  // ------------------------------------------------------------------ Liste
  defWidget('flightlist', {
    label: 'Flug · Liste', cat: 'Wetter & Zeit', paletteIcon: 'plane', size: [380, 300],
    defaults: function (w) { w.flRadius = 30; w.flRows = 6; w.flRoute = true; },
    render: function () { return '<div data-role="flbox" class="fll" style="width:100%;height:100%;overflow:hidden"></div>'; },
    mount: function (w) {
      var HIMMEL = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      var zeichne = function () {
        var box = flBox(w); if (!box) return;
        var R = flRadius(w), d = _flCache[R];
        if (!d) { box.innerHTML = '<div class="hint" style="padding:10px;color:var(--faint);font-size:11px">lade Flugdaten …</div>'; return; }
        var vs = flAlter(d), n = Math.max(1, Math.min(20, parseInt(w.flRows) || 6));
        var h = '';
        d.flug.slice(0, n).forEach(function (f) {
          var p = flStellung(f, vs), dist = Math.hypot(p.de, p.dn);
          var el = Math.atan2(p.alt / 1000, dist) * 180 / Math.PI;
          var az = (Math.atan2(p.de, p.dn) * 180 / Math.PI + 360) % 360;
          var col = flFarbe(p.alt), art = flBauart(f);
          var steig = (f.steig > 0.5) ? '↑' : (f.steig < -0.5 ? '↓' : '→');
          var route = (w.flRoute !== false && f.von)
            ? ('<div class="flr">' + f.von + '<span class="flp">→</span>' + f.nach + '</div>'
               + '<div class="flo">' + (f.vonort || '') + ' – ' + (f.nachort || '') + '</div>')
            : '<div class="flr" style="color:var(--faint)">keine Route hinterlegt</div>';
          var kennung = f.icao || f.ruf || '';
          h += '<div class="flz' + (el >= 45 ? ' zen' : '')
             + (flGewaehlt('flug', kennung) ? ' flsel' : '') + '"'
             + ' data-art="flug" data-id="' + esc(kennung) + '">'
            /* Fluglinie und Muster kommen vom Server (adsbdb): die Linie faellt bei der
               Routenabfrage ohnehin mit ab, das Muster ueber die ICAO24-Adresse. Beides
               kann fehlen - Privatmaschinen, Militaer, unbekannte Kennungen. Dann bleibt
               es bei der aus Tempo und Hoehe GESCHAETZTEN Bauart, die vorher die einzige
               Angabe war. */
            + '<div><div class="flruf" style="color:' + col + '">' + esc(f.ruf || '—') + '</div>'
            + (f.linie ? '<div class="fllin" title="' + esc(f.linie) + '">' + esc(f.linie) + '</div>' : '')
            + (f.typ
                ? '<div class="flmus" title="' + esc(f.typ + (f.muster ? ' · ' + f.muster : '')
                    + (f.hersteller ? ' · ' + f.hersteller : '') + (f.kennung ? ' · ' + f.kennung : '')) + '">'
                  + esc(flTypText(f)) + '</div>'
                : '<div class="flk">' + ({ jet: 'Jet', prop: 'Propeller', heli: 'Hubschr.' }[art]) + '</div>')
            + '</div>'
            + '<div>' + route + '<div class="flm"><b>' + (p.alt / 1000).toFixed(1) + '</b> km · <b>'
            + f.tempo + '</b> km/h ' + steig
            + ' <span class="flpill">' + HIMMEL[Math.round(az / 22.5) % 16] + ' ' + Math.round(el) + '°</span>'
            + (el >= 45 ? '<span class="flzen">fast senkrecht</span>' : '') + '</div></div>'
            + '<div class="flre"><span class="flg">' + dist.toFixed(1) + '</span>km jetzt<br>'
            + '<span style="color:var(--warm)">' + f.cpa_km.toFixed(1) + '</span> km in '
            + Math.round(f.cpa_min) + ' min</div></div>';
        });
        if (!d.flug.length) h = '<div class="hint" style="padding:10px;color:var(--faint);font-size:11px">nichts im Umkreis</div>';
        // Ausgewaehlte Zeile in den sichtbaren Bereich holen: wird der Flug in der
        // Kuppel angetippt, steht seine Zeile womoeglich ausserhalb - ohne das
        // Nachziehen bliebe die Verbindung zwischen beiden Kacheln unsichtbar.

        box.innerHTML = h;
        var sel = $('.flz.flsel', box);
        if (sel && sel.scrollIntoView) { try { sel.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
      };
      flLade(flRadius(w), function () { zeichne(); });
      flBeobachte(w, zeichne);
      flTaktSicher(w, 'liste', 2000, zeichne);   // Liste braucht keine 5 Bilder je Sekunde
      zeichne();
      flMalerAn(w, zeichne);
      // Ein Zuhoerer am Kasten, nicht je Zeile: die Zeilen werden bei jedem Bild
      // neu gebaut, einzelne Zuhoerer waeren nach zwei Sekunden verwaist.
      var kasten = flBox(w);
      if (kasten && !kasten.__flKlick) {
        kasten.__flKlick = true;
        kasten.addEventListener('click', function (ev) {
          var z = ev.target && ev.target.closest ? ev.target.closest('.flz[data-id]') : null;
          if (!z) { return; }
          flAuswahl(z.getAttribute('data-art'), z.getAttribute('data-id'));
        });
      }
      flTaktSicher(w, 'poll', 30000, function () { flLade(flRadius(w), null); });
    },
    props: function (w) {
      return row('Umkreis (km)', '<input id="pFlLR" type="number" min="5" max="200" value="' + (w.flRadius || 30) + '">')
        + row('Zeilen', '<input id="pFlLZ" type="number" min="1" max="20" value="' + (w.flRows || 6) + '">')
        + row('Route zeigen', '<input type="checkbox" id="pFlLRt"' + (w.flRoute !== false ? ' checked' : '') + '>');
    },
    wire: function (w) {
      if ($('#pFlLR')) $('#pFlLR').onchange = function () { w.flRadius = parseInt(this.value) || 30; render(); commit(); };
      if ($('#pFlLZ')) $('#pFlLZ').oninput = function () { w.flRows = parseInt(this.value) || 6; render(); commit(); };
      if ($('#pFlLRt')) $('#pFlLRt').onchange = function () { w.flRoute = this.checked; render(); commit(); };
    }
  });
