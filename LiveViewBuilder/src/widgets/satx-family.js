  // ===== Widgets: Satelliten — satpasses / satsky =====
  //
  //  Anders als beim Flugverkehr holt der Server hier KEINE Positionen, sondern
  //  Bahnelemente (?api=tle). Die Position rechnet der Browser selbst mit SGP4
  //  (satellite.js, MIT, als Asset im Modul). Drei Gruende:
  //    - kein Abfragekontingent und keine Sprunge zwischen zwei Abfragen,
  //    - die Bewegung ist stetig, weil jede Zwischenposition berechenbar ist,
  //    - man kann in die ZUKUNFT rechnen - erst das macht die Ueberflugvorhersage
  //      moeglich, und die ist der eigentliche Sinn der Sache.
  //
  //  SICHTBARKEIT ist der Kern. Ein Satellit ist nur zu sehen, wenn er im
  //  Sonnenlicht steht, waehrend der Beobachter im Dunkeln ist - deshalb liegen
  //  ISS-Ueberfluege in der Daemmerung. Ohne diesen Filter stuenden zwanzig
  //  Objekte in der Liste, von denen man keines sieht.

  var _satLib = null, _satWarte = [], _satTLE = {}, _satPass = {}, _satNow = {};

  /** satellite.js bei Bedarf nachladen - nicht jede Seite braucht 23 KB SGP4. */
  function satLib(cb) {
    if (_satLib) { cb(_satLib); return; }
    _satWarte.push(cb);
    if (_satWarte.length > 1) { return; }
    var s = document.createElement('script');
    s.src = '?api=asset&name=satjs';
    s.onload = function () {
      _satLib = window.satellite || null;
      _satWarte.forEach(function (f) { try { f(_satLib); } catch (e) {} });
      _satWarte = [];
    };
    s.onerror = function () { _satWarte.forEach(function (f) { try { f(null); } catch (e) {} }); _satWarte = []; };
    document.head.appendChild(s);
  }

  /** Bahnelemente einer Gruppe holen (Server haelt sie 12 h vor). */
  function satTLE(gruppe, cb) {
    var g = gruppe || 'stations', c = _satTLE[g];
    if (c && (Date.now() - c.geholt) < 3600000) { cb(c.sats); return; }
    satLib(function (lib) {
      if (!lib) { cb([]); return; }
      fetch('?api=tle&group=' + encodeURIComponent(g), { cache: 'no-store' })
        .then(function (r) { return r.text(); })
        .then(function (t) {
          var z = t.split(/\r?\n/), aus = [], gesehen = {};
          for (var i = 0; i + 2 < z.length; i += 3) {
            var n = (z[i] || '').trim(); if (!n) { continue; }
            // ISS (ZARYA) und ISS (NAUKA) sind Module DERSELBEN Station. Celestrak
            // fuehrt sie einzeln - ohne Zusammenfassung stuende jeder Ueberflug doppelt.
            var kurz = n.replace(/\s*\(.*\)\s*/, '').trim();
            if (gesehen[kurz]) { continue; }
            /* Die Sichtbarkeitsrechnung prueft Geometrie und Beleuchtung, aber NICHT
               die Helligkeit - ein Zehn-Zentimeter-Wuerfel waere danach "sichtbar"
               und ist es nie. In "stations" steckt genau solches Beiwerk: von der
               ISS ausgesetzte Kleinsatelliten (DUPLEX, KNACKSAT-2, GXIBA-1),
               Raketenschrott (FREGAT DEB) und angedockte Module (POISK, SZ-21),
               die ohnehin auf ihrer Station saessen. Dort bleibt die Auswahl eng.

               "visual" ist dagegen Celestraks eigene Liste der mit blossem Auge
               sichtbaren Objekte - die Auswahl ist dort bereits getroffen. Der
               Namensfilter hat sie von 86 auf 3 zusammengestrichen und die Gruppe
               damit sinnlos gemacht. */
            var gross = g === 'visual' || /^(ISS|CSS|TIANGONG|TIANHE|HUBBLE|HST)/i.test(kurz);
            try { aus.push({ name: kurz, gross: gross, rec: lib.twoline2satrec(z[i + 1], z[i + 2]) }); gesehen[kurz] = 1; }
            catch (e) {}
          }
          _satTLE[g] = { sats: aus, geholt: Date.now() };
          cb(aus);
        })
        .catch(function () { cb([]); });
    });
  }

  /* Sonnenposition im erdfesten Bezugssystem (km). Naeherung nach Meeus - fuer die
     Schattenpruefung reicht das weit; auf ein Grad genau waere hier Aufwand ohne Wirkung. */
  function satSonneEci(ms) {
    var jd = ms / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
    var L = (280.46646 + 36000.76983 * T) % 360, M = (357.52911 + 35999.05029 * T) * Math.PI / 180;
    var C = (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M);
    var lam = (L + C) * Math.PI / 180, eps = (23.439291 - 0.0130042 * T) * Math.PI / 180;
    var r = 149597870.7;
    return { x: r * Math.cos(lam), y: r * Math.cos(eps) * Math.sin(lam), z: r * Math.sin(eps) * Math.sin(lam) };
  }
  /** Steht der Satellit im Erdschatten? Zylindermodell - fuer sichtbare Ueberfluege genau genug. */
  function satBeschienen(p, s) {
    var ps = p.x * s.x + p.y * s.y + p.z * s.z;
    if (ps > 0) { return true; }
    var sl = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z), proj = ps / sl;
    var q = p.x * p.x + p.y * p.y + p.z * p.z - proj * proj;
    return Math.sqrt(Math.max(0, q)) > 6378.137;
  }
  function satOrt(w) {
    try { var g = (typeof houseGeo === 'function') ? houseGeo() : null;
          return { lat: (g && g.lat) || 48.0657, lon: (g && g.lon) || 14.1241 }; }
    catch (e) { return { lat: 48.0657, lon: 14.1241 }; }
  }
  function satBeob(o) { return { latitude: o.lat * Math.PI / 180, longitude: o.lon * Math.PI / 180, height: 0.4 }; }

  /** Aktuelle Stellungen ueber dem Horizont. */
  function satJetzt(gruppe, o, cb, alle, ms) {
    // ms: Zeitpunkt der Darstellung. Die Sonnenszene hat einen Zeitregler - ohne
    // diesen Durchgriff stand dort die Sonne nachts, die Satelliten aber weiter
    // auf der echten Uhrzeit. Ohne Angabe gilt jetzt.
    var jetzt = ms || Date.now();
    var k = gruppe + '|' + o.lat.toFixed(3) + '|' + (alle ? 'a' : 'g') + '|' + (ms ? Math.round(ms / 60000) : 'n');
    var c = _satNow[k];
    if (c && (Date.now() - c.t) < 900) { cb(c.v); return; }        // knapp unter einem Bild
    satTLE(gruppe, function (sats) {
      var lib = _satLib; if (!lib || !sats.length) { cb([]); return; }
      var d = new Date(jetzt), gm = lib.gstime(d), sonne = satSonneEci(jetzt), beob = satBeob(o);
      var dunkel = LVSUN.pos(o.lat, o.lon, jetzt / 1000).elev < -6;
      var aus = [];
      sats.forEach(function (S) {
        if (!alle && !S.gross) { return; }
        var pv; try { pv = lib.propagate(S.rec, d); } catch (e) { return; }
        if (!pv || !pv.position) { return; }
        var la = lib.ecfToLookAngles(beob, lib.eciToEcf(pv.position, gm));
        var el = la.elevation * 180 / Math.PI;
        if (el < 0) { return; }
        var gd = lib.eciToGeodetic(pv.position, gm);
        aus.push({ name: S.name, az: (la.azimuth * 180 / Math.PI + 360) % 360, el: el,
                   hoehe: Math.round(gd.height), entf: Math.round(la.rangeSat),
                   sichtbar: dunkel && el > 10 && satBeschienen(pv.position, sonne) });
      });
      _satNow[k] = { t: Date.now(), v: aus };
      cb(aus);
    });
  }

  /**
   * Sichtbare Ueberfluege der naechsten 48 Stunden.
   *
   * Hier stand frueher "Rechnung dauert Bruchteile einer Sekunde". Das gilt fuer einen
   * Schreibtischrechner. 48 Stunden in 20-Sekunden-Schritten sind 8640 Durchlaeufe JE
   * SATELLIT, jeder mit Bahnfortschreibung, Sternzeit und Blickwinkel - und das lief in
   * EINEM Stueck, synchron. Auf einem iPhone stand der Hauptthread dabei sekundenlang:
   * Beruehrungen wurden nicht mehr verarbeitet, Zeitgeber kamen nicht dran, die Seite
   * wirkte tot. Nachgewiesen am 30.08.2026 mit einem Zustandsmelder, dessen
   * 5-Sekunden-Takt genau dann verstummte, wenn die Flugseite offen war.
   *
   * Dazu fragen ZWEI Kacheln (Liste und Kuppel) dieselbe Rechnung ab und starteten sie
   * doppelt - einen Einzelflug-Riegel gab es nicht.
   *
   * Jetzt: eine Rechnung je Schluessel, in Scheiben von hoechstens zwoelf Millisekunden.
   * Dazwischen kommt der Browser wieder zum Zug. Das Ergebnis ist dasselbe, es entsteht
   * nur nicht mehr am Stueck.
   */
  var _satLauf = {};                       // laufende Rechnungen: Schluessel -> Rueckrufe
  function satUeberfluege(gruppe, o, minEl, cb, alle) {
    var k = gruppe + '|' + o.lat.toFixed(3) + '|' + minEl + '|' + (alle ? 'a' : 'g');
    var c = _satPass[k];
    if (c && (Date.now() - c.t) < 1800000) { cb(c.v); return; }
    if (_satLauf[k]) { if (cb) _satLauf[k].push(cb); return; }
    _satLauf[k] = cb ? [cb] : [];
    var melde = function (v) {
      var rufe = _satLauf[k] || []; delete _satLauf[k];
      rufe.forEach(function (f) { try { f(v); } catch (e) {} });
    };
    satTLE(gruppe, function (sats) {
      var lib = _satLib; if (!lib || !sats.length) { melde([]); return; }
      var beob = satBeob(o), start = Date.now(), ende = start + 48 * 3600000, aus = [];
      var liste = sats.filter(function (S) { return alle || S.gross; });

      /* Dunkle Fenster EINMAL vorab bestimmen, nicht je Satellit.
       *
       * Sichtbar ist ein Ueberflug nur, wenn die Sonne unter -6 Grad steht - das
       * prueft die Schleife unten ohnehin, aber erst NACH der Bahnrechnung. Die
       * Sonnenbahn haengt jedoch nicht vom Satelliten ab. Also die Nachtfenster
       * einmal ausrechnen und tagsueber gar nicht erst propagieren: bei 86
       * Satelliten sind rund zwei Drittel der 48 Stunden hell, und genau die
       * Rechnungen wurden bisher angestellt und weggeworfen. */
      var dunkel = [], offen = null;
      for (var ts = start; ts <= ende; ts += 300000) {
        if (LVSUN.pos(o.lat, o.lon, ts / 1000).elev < -6) {
          if (offen === null) { offen = ts - 300000; }         // eine Stufe Luft nach vorn
        } else if (offen !== null) { dunkel.push([offen, ts]); offen = null; }
      }
      if (offen !== null) { dunkel.push([offen, ende]); }
      if (!dunkel.length) { melde([]); return; }               // Polartag: nichts zu sehen

      var si = 0, t = start, di = 0, lauf = null;
      (function scheibe() {
        var frist = Date.now() + 12;
        while (si < liste.length) {
          var S = liste[si];
            // ACHTUNG for, nicht while: im Rumpf stehen zwei `continue`. In einer
          // while-Schleife mit Zaehler am Ende springen die daran vorbei - das ergab
          // eine Endlosschleife und der Hauptthread stand fuer immer. Der Zaehler
          // gehoert deshalb in den Schleifenkopf, und die Zeitpruefung an den Anfang
          // des Rumpfes, damit sie ebenfalls von jedem Durchlauf erreicht wird.
          for (; t < ende; t += 20000) {
            if (Date.now() > frist) { setTimeout(scheibe, 0); return; }
            // Ans naechste dunkle Fenster vorspulen. di laeuft mit t monoton mit,
            // die Suche kostet deshalb nichts.
            while (di < dunkel.length && t >= dunkel[di][1]) { di++; }
            if (di >= dunkel.length) { break; }
            if (t < dunkel[di][0]) {
              // Ein Ueberflug kann keine Helligkeitsluecke ueberspannen: was offen
              // ist, endet hier.
              if (lauf) { if (lauf.bis - lauf.von >= 60000) { aus.push(lauf); } lauf = null; }
              t = dunkel[di][0];
            }
          var d = new Date(t), pv;
          try { pv = lib.propagate(S.rec, d); } catch (e) { continue; }
          if (!pv || !pv.position) { continue; }
          var gm = lib.gstime(d);
          var la = lib.ecfToLookAngles(beob, lib.eciToEcf(pv.position, gm));
          var el = la.elevation * 180 / Math.PI;
          var sicht = el > minEl
            && LVSUN.pos(o.lat, o.lon, t / 1000).elev < -6
            && satBeschienen(pv.position, satSonneEci(t));
          if (sicht) {
            var az = (la.azimuth * 180 / Math.PI + 360) % 360;
            if (!lauf) { lauf = { name: S.name, von: t, bis: t, maxEl: el, azVon: az, azMax: az, azBis: az, bahn: [] }; }
            else { lauf.bis = t; lauf.azBis = az; if (el > lauf.maxEl) { lauf.maxEl = el; lauf.azMax = az; } }
            lauf.bahn.push([az, el]);
          } else if (lauf) {
            if (lauf.bis - lauf.von >= 60000) { aus.push(lauf); }
            lauf = null;
          }
          }
          if (lauf && lauf.bis - lauf.von >= 60000) { aus.push(lauf); }
          lauf = null; si++; t = start; di = 0;   // naechster Satellit faengt vorn an
        }
        fertig();
      })();

      function fertig() {
      aus.sort(function (a, b) { return a.von - b.von; });
      /* Ueberlappende Ueberfluege zusammenfassen.
       *
       * An der ISS haengen angedockte Objekte, die Celestrak einzeln fuehrt -
       * POISK, CREW DRAGON, Progress. Sie fliegen naturgemaess dieselbe Bahn und
       * erzeugten drei identische Zeilen fuer denselben Ueberflug. Zwei Bahnen,
       * die sich zeitlich ueberschneiden und im Hoechststand kaum unterscheiden,
       * sind derselbe Vorgang; der bekannteste Name gewinnt. */
      var rang = function (n) { return /^ISS/.test(n) ? 3 : (/(CSS|TIANHE)/i.test(n) ? 2 : (/DEB|R\/B/i.test(n) ? 0 : 1)); };
      var vereint = [];
      aus.forEach(function (p) {
        var t = null;
        for (var i = 0; i < vereint.length; i++) {
          var v = vereint[i];
          var ueber = Math.min(v.bis, p.bis) - Math.max(v.von, p.von);
          if (ueber > 0 && ueber > 0.5 * Math.min(v.bis - v.von, p.bis - p.von)
              && Math.abs(v.maxEl - p.maxEl) < 8) { t = v; break; }
        }
        if (!t) { vereint.push(p); return; }
        if (rang(p.name) > rang(t.name)) {                 // bekannteren Namen uebernehmen
          t.name = p.name; t.bahn = p.bahn; t.azVon = p.azVon; t.azMax = p.azMax; t.azBis = p.azBis;
        }
        t.von = Math.min(t.von, p.von); t.bis = Math.max(t.bis, p.bis);
        t.maxEl = Math.max(t.maxEl, p.maxEl);
      });
      _satPass[k] = { t: Date.now(), v: vereint };
      melde(vereint);
      }
    });
  }

  var _stRO = {}, _stTick = {};
  // Taktgeber MIT Selbstabschaltung - ausfuehrliche Begruendung in flightx-family.js
  // (flTaktSicher). Kurz: der LiveViewBuilder hat keinen Abbau-Haken; ein Takt ohne
  // eigene Pruefung laeuft nach einem Ansichtswechsel ewig weiter und rechnet
  // Ueberfluege fuer eine Seite, die niemand mehr ansieht.
  var _stDauer = {};
  function stTaktSicher(w, name, ms, fn) {
    var reg = _stDauer[w.id] || (_stDauer[w.id] = {});
    if (reg[name]) { clearInterval(reg[name]); }
    reg[name] = setInterval(function () {
      var el = $('.w[data-id="' + w.id + '"]', canvas) || $('.w[data-id="' + w.id + '"]', $('#ovcanvas'));
      if (!el) { clearInterval(reg[name]); delete reg[name]; return; }
      fn();
    }, ms);
  }
  function stBox(w) {
    return $('.w[data-id="' + w.id + '"] [data-role=stbox]', canvas)
        || $('.w[data-id="' + w.id + '"] [data-role=stbox]', $('#ovcanvas'));
  }
  function stHimmel(a) {
    return ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(a / 22.5) % 16];
  }
  function stUhr(ms) { return new Date(ms).toLocaleTimeString('de-DE').slice(0, 5); }
  function stTag(ms) { return new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }); }

  // ------------------------------------------------------------- Ueberflugliste
  defWidget('satpasses', {
    label: 'Satelliten · Überflüge', cat: 'Wetter & Zeit', paletteIcon: 'sat', size: [400, 260],
    defaults: function (w) { w.stGroup = 'stations'; w.stRows = 4; w.stMinEl = 10; },
    render: function () { return '<div data-role="stbox" class="stl" style="width:100%;height:100%;overflow:auto"></div>'; },
    mount: function (w) {
      var zeichne = function () {
        var box = stBox(w); if (!box) return;
        satUeberfluege(w.stGroup || 'stations', satOrt(w), parseFloat(w.stMinEl) || 10, function (p) {
          var b2 = stBox(w); if (!b2) return;
          if (!p.length) {
            b2.innerHTML = '<div style="padding:10px;color:var(--faint);font-size:11px">'
              + 'kein sichtbarer Überflug in den nächsten 48 Stunden</div>';
            return;
          }
          var n = Math.max(1, Math.min(12, parseInt(w.stRows) || 4)), h = '';
          p.slice(0, n).forEach(function (q, i) {
            var dauer = Math.round((q.bis - q.von) / 60000);
            h += '<div class="stz' + (i === 0 ? ' erst' : '') + '">'
              + '<div><div class="stnam">' + esc(q.name) + '</div><div class="stwann">' + stTag(q.von) + '</div></div>'
              + '<div><div class="stzeit">' + stUhr(q.von) + ' – ' + stUhr(q.bis) + '</div>'
              + '<div class="stmeta">auf im <b>' + stHimmel(q.azVon) + '</b>, ab im <b>' + stHimmel(q.azBis) + '</b>'
              + ' <span class="stpill">' + dauer + ' min sichtbar</span></div></div>'
              + '<div class="stre"><span class="stgr">' + Math.round(q.maxEl) + '°</span>Höchststand<br>im '
              + stHimmel(q.azMax) + '</div></div>';
          });
          b2.innerHTML = h;
        }, w.stAll);
      };
      zeichne();
      stTaktSicher(w, 'liste', 60000, zeichne);
    },
    props: function (w) {
      return row('Gruppe', '<select id="pStG"><option value="stations"' + ((w.stGroup || 'stations') === 'stations' ? ' selected' : '') + '>Raumstationen (ISS, Tiangong)</option>'
          + '<option value="visual"' + (w.stGroup === 'visual' ? ' selected' : '') + '>helle Satelliten (157)</option></select>')
        + row('Zeilen', '<input id="pStR" type="number" min="1" max="12" value="' + (w.stRows || 4) + '">')
        + row('Mindesthöhe (°)', '<input id="pStE" type="number" min="5" max="40" value="' + (w.stMinEl || 10) + '"> <span style="font-size:11px;color:var(--muted)">niedriger = mehr, aber schlechter zu sehen</span>')
        + row('Auch Kleinsatelliten', '<input type="checkbox" id="pStA"' + (w.stAll ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">Würfelsatelliten und Schrott — mit bloßem Auge nicht zu sehen</span>');
    },
    wire: function (w) {
      if ($('#pStG')) $('#pStG').onchange = function () { w.stGroup = this.value; _satPass = {}; render(); commit(); };
      if ($('#pStR')) $('#pStR').oninput = function () { w.stRows = parseInt(this.value) || 4; render(); commit(); };
      if ($('#pStE')) $('#pStE').onchange = function () { w.stMinEl = parseFloat(this.value) || 10; _satPass = {}; render(); commit(); };
      if ($('#pStA')) $('#pStA').onchange = function () { w.stAll = this.checked || undefined; _satPass = {}; render(); commit(); };
    }
  });

  // ------------------------------------------------------------- Bahn am Himmel
  defWidget('satsky', {
    label: 'Satelliten · Bahn', cat: 'Wetter & Zeit', paletteIcon: 'sat', size: [320, 300], noHover: true,
    defaults: function (w) { w.stGroup = 'stations'; w.stMinEl = 10; },
    render: function () { return '<div data-role="stbox" style="width:100%;height:100%"><canvas></canvas></div>'; },
    mount: function (w) {
      var zeichne = function () {
        var box = stBox(w); if (!box) return;
        var c = box.firstElementChild, dpr = Math.min(2.5, window.devicePixelRatio || 1);
        var r = box.getBoundingClientRect();
        var W = Math.max(80, Math.round(r.width)), H = Math.max(80, Math.round(r.height));
        if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }
        var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Der Rand fuer die Himmelsrichtungen richtet sich nach der ENGEREN Seite.
        // Aus der Breite gerechnet schrumpfte die Kuppel in einer breiten, flachen
        // Kachel unnoetig: 518x353 ergab 36 px Rand, obwohl die Hoehe das Mass gibt.
        var kurz = Math.min(W, H), rnd = Math.max(14, kurz * 0.085);
        var cx = W / 2, cy = H / 2, rad = Math.max(30, kurz / 2 - rnd);
        g.fillStyle = cssv('--tile') || '#0c1416'; g.fillRect(0, 0, W, H);
        g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.fillStyle = 'rgba(10,18,26,.8)'; g.fill();
        // Sternfeld - fest gesaet, damit es beim Neuzeichnen nicht flimmert
        for (var i = 0; i < 70; i++) {
          var a = (i * 2.39996), rr = Math.sqrt(((i * 7919) % 1000) / 1000) * rad;
          g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.2 + ((i * 13) % 7) / 10, 0, 7);
          g.fillStyle = 'rgba(200,220,235,' + (0.14 + ((i * 17) % 30) / 100) + ')'; g.fill();
        }
        [30, 60].forEach(function (e) {
          g.beginPath(); g.arc(cx, cy, rad * (90 - e) / 90, 0, 7);
          g.strokeStyle = cssv('--line') || '#203034'; g.lineWidth = 1;
          g.setLineDash([3, 4]); g.stroke(); g.setLineDash([]);
        });
        g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.strokeStyle = cssv('--line') || '#2c4045'; g.lineWidth = 1.3; g.stroke();
        [['N', 0], ['O', 90], ['S', 180], ['W', 270]].forEach(function (p) {
          var k = p[1] * Math.PI / 180;
          g.font = '600 10.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = cssv('--muted') || '#61767a';
          g.textAlign = 'center'; g.fillText(p[0], cx + Math.sin(k) * (rad + 13), cy - Math.cos(k) * (rad + 13) + 4);
          g.textAlign = 'left';
        });
        var pkt = function (az, el) {
          var k = az * Math.PI / 180, rr = rad * (90 - el) / 90;
          return [cx + Math.sin(k) * rr, cy - Math.cos(k) * rr];
        };
        satUeberfluege(w.stGroup || 'stations', satOrt(w), parseFloat(w.stMinEl) || 10, function (P) {
          P.slice(0, 4).forEach(function (p, i) {
            var erst = (i === 0), col = erst ? (cssv('--accent') || '#00cdab') : (cssv('--info') || '#4aa8ff');
            g.beginPath();
            p.bahn.forEach(function (b, j) { var q = pkt(b[0], b[1]); if (j) { g.lineTo(q[0], q[1]); } else { g.moveTo(q[0], q[1]); } });
            g.strokeStyle = col; g.globalAlpha = erst ? 0.95 : 0.3; g.lineWidth = erst ? 2.4 : 1.4;
            g.lineCap = 'round'; if (erst) { g.shadowColor = col; g.shadowBlur = 9; }
            g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1;
            var a0 = pkt(p.bahn[0][0], p.bahn[0][1]);
            g.beginPath(); g.arc(a0[0], a0[1], 2.6, 0, 7); g.fillStyle = col;
            g.globalAlpha = erst ? 1 : 0.5; g.fill(); g.globalAlpha = 1;
            if (erst) {
              var m = pkt(p.azMax, p.maxEl), z = pkt(p.bahn[p.bahn.length - 1][0], p.bahn[p.bahn.length - 1][1]);
              g.beginPath(); g.arc(m[0], m[1], 4.5, 0, 7); g.fillStyle = '#fff';
              g.shadowColor = '#fff'; g.shadowBlur = 11; g.fill(); g.shadowBlur = 0;
              g.font = '600 10px ' + (cssv('--fm') || 'monospace'); g.fillStyle = col;
              /* Bei einem kurzen Ueberflug liegen Aufgang, Hoechststand und
                 Untergang dicht beieinander - dann klebt die Gradzahl auf der
                 Uhrzeit. Der Hoechststand wird deshalb nur beschriftet, wenn er
                 weit genug von den Enden entfernt ist. */
              g.fillText(stUhr(p.von), a0[0] + 7, a0[1] + 13);
              g.fillText(stUhr(p.bis), z[0] + 7, z[1] + 13);
              var frei = Math.min(Math.hypot(m[0] - a0[0], m[1] - a0[1]),
                                  Math.hypot(m[0] - z[0], m[1] - z[1]));
              if (frei > 26) { g.fillText(Math.round(p.maxEl) + '°', m[0] + 9, m[1] - 9); }
            }
          });
        }, w.stAll);
        // Aktuelle Stellungen mit einzeichnen
        satJetzt(w.stGroup || 'stations', satOrt(w), function (L) {
          L.forEach(function (s) {
            var q = pkt(s.az, s.el), col = s.sichtbar ? '#ffffff' : (cssv('--faint') || '#4d5f63');
            g.beginPath(); g.arc(q[0], q[1], s.sichtbar ? 4 : 2.4, 0, 7);
            g.fillStyle = col; if (s.sichtbar) { g.shadowColor = '#fff'; g.shadowBlur = 10; }
            g.fill(); g.shadowBlur = 0;
            if (s.sichtbar) {
              g.font = '600 9.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = '#fff';
              g.fillText(s.name, q[0] + 8, q[1] + 3);
            }
          });
        }, w.stAll);
      };
      zeichne();
      var box = stBox(w);
      if (box && typeof ResizeObserver !== 'undefined') {
        if (_stRO[w.id]) { try { _stRO[w.id].disconnect(); } catch (e) {} }
        var ro = new ResizeObserver(zeichne); ro.observe(box); _stRO[w.id] = ro;
      }
      stTaktSicher(w, 'kuppel', 2000, zeichne);
    },
    props: function (w) {
      return row('Gruppe', '<select id="pSkG"><option value="stations"' + ((w.stGroup || 'stations') === 'stations' ? ' selected' : '') + '>Raumstationen</option>'
          + '<option value="visual"' + (w.stGroup === 'visual' ? ' selected' : '') + '>helle Satelliten</option></select>')
        + row('Mindesthöhe (°)', '<input id="pSkE" type="number" min="5" max="40" value="' + (w.stMinEl || 10) + '">');
    },
    wire: function (w) {
      if ($('#pSkG')) $('#pSkG').onchange = function () { w.stGroup = this.value; _satPass = {}; render(); commit(); };
      if ($('#pSkE')) $('#pSkE').onchange = function () { w.stMinEl = parseFloat(this.value) || 10; _satPass = {}; render(); commit(); };
    }
  });
