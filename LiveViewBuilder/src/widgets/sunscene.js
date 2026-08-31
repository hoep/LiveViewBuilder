  // ===== Widget: Sonnenszene (sunscene) — gekippte 2,5D-Buehne mit echtem Sonnenstand =====
  //
  //  Stufe 1: Bodenebene, eigenes Haus, Tagesbogen der Sonne, Sonnenscheibe mit Halo aus der
  //  GEMESSENEN Einstrahlung, Einfallstrahl, Auf-/Untergangsmarken, Tag/Nacht mit Sternen,
  //  drehbare Kamera. Alles rein lokal - keine externen Dienste.
  //
  //  VOLL RESPONSIV: Der Canvas folgt der Kachelgroesse (ResizeObserver + Geraete-Pixel-
  //  verhaeltnis). Der Massstab (Pixel je Meter) und ALLE Schriftgroessen/Strichstaerken
  //  leiten sich aus der kleineren Kachelkante ab - die Szene sieht auf einer 300-px-Kachel
  //  genauso aus wie auf einem 1400-px-Wandpanel.
  //
  //  Datenquellen (Bindungen, alle optional):
  //   ssAz / ssEl   Azimut/Elevation aus der IPS-Location (bevorzugt; sonst wird gerechnet)
  //   ssRad         Globalstrahlung W/m2 (Davis) -> Halo-Groesse, Dunst, Schattenhaerte
  //   lat/lon       Standort (Vorgabe Hauskoordinaten)
  //   ssNorth       Nordausrichtung des Hauses in Grad (Fassaden-Drehung)

  (function () {
    var _ssRO = {};            // widgetId -> ResizeObserver
    var _ssState = {};         // widgetId -> Laufzeitzustand (Kamera, Drag, Animation)
    var D = Math.PI / 180;

    // Browser-Speicher fuer die Gebaeudedaten. Bewusst mit Verfallsdatum und Versionsmarke:
    // aendert sich das Format, wird der alte Stand nicht mehr gelesen. Faellt der Speicher aus
    // (privates Fenster, voll), passiert nichts Schlimmes - dann bleibt es beim Server-Abruf.
    var SS_GEO_V = 1, SS_GEO_TTL = 30 * 86400e3;
    function ssGeoLoad(key) {
      try {
        var raw = localStorage.getItem('lvb.geo.' + key); if (!raw) return null;
        var o = JSON.parse(raw);
        if (!o || o.v !== SS_GEO_V || !o.t || (Date.now() - o.t) > SS_GEO_TTL) return null;
        return (o.d && o.d.b) ? o.d : null;
      } catch (e) { return null; }
    }
    function ssGeoSave(key, data) {
      try { localStorage.setItem('lvb.geo.' + key, JSON.stringify({ v: SS_GEO_V, t: Date.now(), d: data })); }
      catch (e) { /* Speicher voll oder gesperrt - dann eben nicht */ }
    }

    var _ssGeoCache = {};      // "lat,lon,r" -> {state:'load'|'ok'|'err', data:...}
    // Gebaeude vom eigenen Hook holen (der liefert nur aus dem serverseitigen Cache).
    function ssGeo3(w, el) {
      if (!_covOn2(w, 'ssBuildings', true)) return null;
      var g = ssGeo(w), r = Math.round(ssNum(w.ssGeoR, 250));
      var key = g.lat.toFixed(4) + ',' + g.lon.toFixed(4) + ',' + r;
      var c = _ssGeoCache[key];
      if (c) return c.state === 'ok' ? c.data : null;
      _ssGeoCache[key] = { state: 'load' };
      if (w._ssGeoData) { _ssGeoCache[key] = { state: 'ok', data: w._ssGeoData }; return w._ssGeoData; }

      // Gebaeude aus dem BROWSER-Speicher sofort verwenden. Sie aendern sich praktisch nie -
      // der Server haelt sie ohnehin 60 Tage vor. Ohne diesen Schritt zeigt die Szene bei jedem
      // Seitenaufruf erst eine leere Nachbarschaft und zeichnet sich Sekunden spaeter neu; auf
      // einem Tablet ist genau das die gefuehlte Ladezeit. Danach wird trotzdem einmal beim
      // Server nachgefragt und der Speicher aufgefrischt - nur eben im Hintergrund.
      var stored = ssGeoLoad(key);
      if (stored) { _ssGeoCache[key] = { state: 'ok', data: stored }; }

      fetch('?api=geo&lat=' + g.lat + '&lon=' + g.lon + '&r=' + r, { cache: 'no-store' })
        .then(function (x) { return x.json(); })
        .then(function (j) {
          if (j && j.ok && j.b) {
            _ssGeoCache[key] = { state: 'ok', data: j };
            ssGeoSave(key, j);
          } else if (!stored) {
            _ssGeoCache[key] = { state: 'err' };
          }
          var e2 = ssEl(w); if (e2) ssDraw(w, e2);
        }).catch(function () { if (!stored) _ssGeoCache[key] = { state: 'err' }; });
      return stored || null;
    }

    /**
     * Farbtafel des aktiven Skins. Damit folgt die Szene dem Erscheinungsbild - hell,
     * dunkel oder eigene Farben. Der Himmel bleibt physikalisch (nachts ist es nachts),
     * bekommt im hellen Skin aber einen helleren Tag.
     */
    // Textgruppen der Szene. Jede laesst sich einzeln einstellen; ohne eigene Wahl gilt
    // die Schrift des Skins und das hier hinterlegte Gewicht.
    var SS_TEXT = [
      ['Hd', 'Kopfzeile', '600'],
      ['Sb', 'Unterzeile', ''],
      ['Rs', 'Auf-/Untergang', ''],
      ['Cv', 'Marke: Wert', '600'],
      ['Cn', 'Marke: Name', ''],
      ['Tl', 'Zeitleiste', ''],
      ['At', 'Namensnennung', '']
    ];
    var SS_FAMS = [['', 'Standard (Skin)'], ['"Inter",system-ui,sans-serif', 'Inter (Sans)'],
      ['"Lora",Georgia,serif', 'Lora (Serif)'], ['"Fraunces",Georgia,serif', 'Fraunces (Display)'],
      ['"JetBrains Mono",ui-monospace,monospace', 'JetBrains Mono'],
      ['system-ui,-apple-system,sans-serif', 'System-Sans'], ['Georgia,"Times New Roman",serif', 'System-Serif']];
    var SS_WTS = [['', 'Standard'], ['300', 'Leicht'], ['400', 'Normal'], ['500', 'Mittel'],
      ['600', 'Halbfett'], ['700', 'Fett'], ['800', 'Extrafett']];

    /**
     * Schriftangabe fuer eine Textgruppe. px ist die aus der Kachelgroesse errechnete
     * Grundgroesse; die Einstellung skaliert sie in Prozent, damit die Szene responsiv
     * bleibt - eine feste Pixelzahl wuerde auf dem Handy zu gross und am Wandtablet zu
     * klein wirken.
     */
    function ssFont(w, key, px, pal, wtOverride) {
      var i, defWt = '';
      for (i = 0; i < SS_TEXT.length; i++) { if (SS_TEXT[i][0] === key) { defWt = SS_TEXT[i][2]; break; } }
      var fam = w['ssF' + key + 'Fam'] || pal.ff || 'system-ui';
      var wt = w['ssF' + key + 'Wt'] || wtOverride || defWt;
      var sc = Math.max(40, Math.min(250, ssNum(w['ssF' + key + 'Sz'], 100))) / 100;
      var st = w['ssF' + key + 'It'] ? 'italic ' : '';
      return st + (wt ? wt + ' ' : '') + (px * sc).toFixed(1) + 'px ' + fam;
    }
    /** Wirksame Groesse einer Textgruppe - fuer Abstaende und Platzberechnung. */
    function ssFsz(w, key, px) {
      return px * Math.max(40, Math.min(250, ssNum(w['ssF' + key + 'Sz'], 100))) / 100;
    }

    function ssPal(el) {
      var cs = getComputedStyle(el && el.closest ? (el.closest('.stage') || document.documentElement) : document.documentElement);
      function v(n, d) { var x = (cs.getPropertyValue(n) || '').trim(); return x || d; }
      var tile = v('--tile', '#151b23');
      var lum = ssLum(tile);
      return {
        text: v('--text', '#e6e9ef'), muted: v('--muted', '#8b94a2'),
        line: v('--line', '#2b3240'), tile: tile, accent: v('--accent', '#00cdab'),
        ff: v('--fu', 'system-ui'), light: lum > 0.5, lum: lum,
        /**
         * Farbe aus einer Widget-Einstellung. Skin-Namen wie "warn" oder "accent" werden
         * ueber die Farbverwaltung, sonst ueber die gleichnamige CSS-Variable aufgeloest.
         * Bleibt etwas Ungueltiges uebrig, greift der Rueckfall - frueher landete das
         * unaufgeloeste Wort auf der Zeichenflaeche und brach die gesamte Darstellung ab.
         */
        col: function (val, fb) {
          if (!val) return fb;
          var c = (typeof _skinColor === 'function' && _skinColor(val)) || '';
          if (!c) { c = /^(#|rgb|hsl)/i.test(val) ? val : v('--' + val, ''); }
          // _skinColor liefert Skin-Namen als "var(--muted)" zurueck. Fuer CSS ist das
          // richtig, fuer die Zeichenflaeche NICHT: addColorStop wirft darauf einen Fehler.
          // CSS.supports() hilft hier nicht - es haelt var(...) fuer gueltig. Also wird die
          // Variable aufgeloest, bevor die Farbe die Zeichenflaeche erreicht.
          var m = /^var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)$/.exec(String(c).trim());
          if (m) {
            var rv = v(m[1], '').trim();
            if (!rv && m[2]) { rv = m[2].trim(); }        // Rueckfall aus der var()-Angabe
            c = rv;
          }
          return ssColOk(c) ? c : fb;
        }
      };
    }
    /** Wahrgenommene Helligkeit 0..1 einer Farbe. */
    function ssLum(c) {
      var r = hex2rgb(c);
      return (0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]) / 255;
    }
    /** Ist die Zeichenkette eine Farbe, die die Zeichenflaeche versteht? */
    function ssColOk(c) {
      if (!c) return false;
      // var(...) ist fuer CSS gueltig, fuer die Zeichenflaeche aber unbrauchbar.
      if (/^var\(/i.test(String(c).trim())) return false;
      try {
        if (typeof CSS !== 'undefined' && CSS.supports) return CSS.supports('color', c);
      } catch (e) { /* alte Browser: unten weiter */ }
      return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(c);
    }
    /** Farbe mit Deckung als rgba-Zeichenkette. */
    function ssA(c, a) { var r = hex2rgb(c); return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + a + ')'; }

    /**
     * Beim Skinwechsel alle lebenden Sonnenszenen neu zeichnen.
     *  Die Anmeldung laeuft ueber eine globale Liste statt ueber die Widget-Liste des
     *  Builders: dort stehen Widgets in Containern, Panels und Komponenten gar nicht drin.
     *  Ueber _ssState sind dagegen ALLE gemounteten Kacheln erreichbar.
     */
    function ssRedrawAll() {
      Object.keys(_ssState).forEach(function (id) {
        var st = _ssState[id], w = st && st.w;
        if (!w) return;
        var el = ssEl(w);
        if (!el || !document.body.contains(el)) { delete _ssState[id]; return; }
        st.key = null;
        ssDraw(w, el);
      });
    }
    (function () {                                   // nur einmal anmelden
      if (typeof window === 'undefined') return;
      window.LV_SKIN_HOOKS = window.LV_SKIN_HOOKS || [];
      if (window.LV_SKIN_HOOKS.indexOf(ssRedrawAll) < 0) { window.LV_SKIN_HOOKS.push(ssRedrawAll); }
    })();

    function ssEl(w) { return $('.w[data-id="' + w.id + '"]', canvas) || $('.w[data-id="' + w.id + '"]', $('#ovcanvas')); }
    function ssSt(w) { return _ssState[w.id] || (_ssState[w.id] = { bearing: null, pitch: null, drag: null, raf: 0, spin: 0 }); }

    /**
     * Gedrosseltes Neuzeichnen.
     *
     * Die Szene zeichnet auf eine Leinwand, die auf einem Telefon DREIFACH aufgeloest ist:
     * 518x368 werden zu 1554x1104 Bildpunkten, mit Gebaeuden, Sonne, Mond, Sternen und -
     * seit dem 29.08.2026 - Flugzeugen und Satelliten. Der live()-Haken zeichnete bei JEDER
     * Wertaenderung einer der rund achtzehn gebundenen Wetter- und Sonnenvariablen alles neu.
     * Auf dem Schreibtisch faellt das nicht auf; auf einem iPhone lag der Hauptthread damit
     * dauerhaft am Anschlag: Die Seite lud vollstaendig und war trotzdem nicht bedienbar -
     * Kamera umschalten ging nicht, Werte wirkten eingefroren, alles fuehlte sich tot an.
     * Nachgemessen am 30.08.2026: mit abgeschalteten Flug- und Satellitenebenen war dieselbe
     * Seite sofort wieder normal bedienbar.
     *
     * Anstoesse werden deshalb gesammelt und hoechstens alle 700 ms in EIN Bild ueberfuehrt.
     * Die Sonne wandert 0,25 Grad je Minute, Wetterwerte springen nicht - fuer das Auge ist
     * das kein Unterschied, fuer das Geraet ist es der zwischen fluessig und unbedienbar.
     */
    function ssDrawBald(w, el) {
      var st = ssSt(w);
      if (st._malt) { st._nochmal = true; return; }   // waehrend des Zeichnens nur vormerken
      // Nach einem Ansichtswechsel kommt die Kachel mit einem NEUEN Element zurueck. Stuende
      // dann noch ein Bild fuer das alte an, wuerde der Riegel unten jedes Neuzeichnen
      // verschlucken - die Szene bliebe leer, bis jemand hart neu laedt. Also: anderes
      // Element, anstehendes Bild verwerfen und sofort neu planen.
      if (st._warte && el && st._ziel && st._ziel !== el) {
        clearTimeout(st._warte); st._warte = 0; st._zuletzt = 0;
      }
      if (st._warte) { return; }                       // es steht schon ein Bild an
      st._ziel = el || null;
      var wart = Math.max(0, 700 - (Date.now() - (st._zuletzt || 0)));
      st._warte = setTimeout(function () {
        st._warte = 0;
        var e = el && document.body.contains(el) ? el : ssEl(w);
        if (!e) { return; }
        st._malt = true; st._zuletzt = Date.now();
        try { ssDraw(w, e); } catch (err) {}
        st._malt = false;
        if (st._nochmal) { st._nochmal = false; ssDrawBald(w, e); }
      }, wart);
    }
    /**
     * Gedrehte Ansicht je Geraet merken (nur wenn "Drehung merken" an ist).
     * Ohne Merker gilt beim Aufbau IMMER die eingestellte Blickrichtung - das ist der
     * Normalfall: eine Kachel an der Wand soll morgens so stehen wie gestern eingerichtet,
     * nicht so, wie sie zuletzt jemand verdreht hat. Erst das Drehen von Hand legt eine
     * abweichende Ansicht ab, und das Doppeltippen raeumt sie wieder weg.
     */
    /**
     * Vorgaben aus dem HomeSuite Hub (Nordausrichtung, Koordinaten). Sie sind dort ohnehin
     * fuer die Beschattung gepflegt - die Szene soll sie nicht ein zweites Mal gepflegt
     * bekommen. Ein eigener Eintrag im Widget geht weiterhin vor; leer heisst "aus dem Hub".
     * Einmal je Seitenaufbau geholt, das Ergebnis teilen sich alle Kacheln.
     */
    var _ssHub = null, _ssHubReq = 0;
    function ssHub() { return _ssHub || {}; }
    function ssHubLoad(cb) {
      if (_ssHub) { cb && cb(); return; }
      if (_ssHubReq) { return; }
      _ssHubReq = 1;
      fetch('?api=light&op=housegeo', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { _ssHub = (j && j.ok) ? j : {}; })
        .catch(function () { _ssHub = {}; })
        .then(function () { cb && cb(); });
    }
    /** Wert aus dem Widget, sonst aus dem Hub, sonst die eingebaute Vorgabe. */
    function ssGeo(w, feld, hubFeld, vorgabe) {
      var v = w[feld];
      if (v !== undefined && v !== null && v !== '') return parseFloat(v);
      var h = ssHub()[hubFeld];
      return (h !== undefined && h !== null) ? parseFloat(h) : vorgabe;
    }
    function ssKey(w) { return 'lvb.ss.' + w.id; }
    function ssLoadView(w) {
      if (!w.ssKeep) return null;
      try { var r = localStorage.getItem(ssKey(w)); return r ? JSON.parse(r) : null; } catch (_) { return null; }
    }
    function ssSaveView(w) {
      if (!w.ssKeep) return;
      var st = ssSt(w);
      try {
        if (st.bearing == null && st.pitch == null && st.radius == null) localStorage.removeItem(ssKey(w));
        else localStorage.setItem(ssKey(w), JSON.stringify({ b: st.bearing, p: st.pitch, r: st.radius }));
      } catch (_) {}
    }
    /** Einmal je Kachel den Merker in den Laufzeit-Zustand holen. */
    function ssRestore(w) {
      var st = ssSt(w);
      if (st._restored) return; st._restored = 1;
      var v = ssLoadView(w);
      if (!v) return;
      if (v.b != null) st.bearing = v.b;
      if (v.p != null) st.pitch = v.p;
      if (v.r != null) st.radius = v.r;
    }
    function ssNum(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
    // Wert einer gebundenen Variablen. WAHRHEITSWERTE zaehlen mit: ein Regensensor, ein
    // Fensterkontakt, ein Schaltausgang liefern true/false, und parseFloat(true) ist NaN -
    // solche Variablen kamen hier nie an. Sichtbar wurde es am optischen Regensensor: er
    // meldete "es regnet", das Widget blieb trocken, weil der Niesel-Rueckfall auf null lief.
    function ssVal(vid) {
      if (!vid) return null;
      var e = _lastVals[vid]; if (!e) return null;
      if (typeof e.v === 'boolean') return e.v ? 1 : 0;
      var n = parseFloat(e.v); return isNaN(n) ? null : n;
    }
    function ssGeo(w) { return { lat: ssNum(w.lat, 48.0657), lon: ssNum(w.lon, 14.1241) }; }
    // Darstellungszeit: normalerweise jetzt. w.ssNow (ms) erlaubt einen abweichenden Zeitpunkt -
    // gebraucht fuer Pruef-Renderings und spaeter fuer den Zeitleisten-Regler.
    /**
     * Zeitpunkt der Szene. Vorrang hat ein am Schieber gewaehlter Zeitpunkt (nur zur Laufzeit,
     * wird NICHT gespeichert - sonst friere ein Wischer auf dem Tablet die Ansicht fuer alle
     * ein). Danach die Einstellung ssNow (fuer Vorschauen), sonst die echte Uhrzeit.
     */
    function ssNow(w) {
      var st = _ssState[w.id];
      if (st && st.now) return st.now;
      var t = ssNum(w.ssNow, 0);
      return t > 0 ? t : Date.now();
    }
    /** Mitternacht des dargestellten Tages (Ortszeit) in Millisekunden. */
    function ssMidnight(w) {
      var d = new Date(ssNow(w));
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    }

    // ---- Sonnenstand: gebundene IPS-Werte haben Vorrang, sonst NOAA-Rechnung ----
    function ssSun(w) {
      var g = ssGeo(w);
      if (!ssNum(w.ssNow, 0)) {                       // nur die Gegenwart darf gebundene Werte nutzen
        var az = ssVal(w.ssAz), el = ssVal(w.ssEl);
        if (az != null && el != null) return { az: az, elev: el, src: 'ips' };
      }
      var p = LVSUN.pos(g.lat, g.lon, ssNow(w) / 1000);
      return { az: p.az, elev: p.elev, src: 'calc' };
    }

    // ---- Kamera: lokale Meter (Ost/Nord/Hoch) -> Bildschirmpunkt ----
    function ssCam(w, W, H) {
      var st = ssSt(w);
      var bearing = st.bearing != null ? st.bearing : ssNum(w.ssBearing, 20);
      var pitch = st.pitch != null ? st.pitch : Math.max(0, Math.min(70, ssNum(w.ssPitch, 52)));
      var stC = ssSt(w);                                          // gezoomter Umkreis geht vor
      var radius = Math.max(20, stC.radius != null ? stC.radius : ssNum(w.ssRadius, 55));
      var s = Math.min(W, H) / (2.35 * radius);                   // Pixel je Meter -> fuellt die Kachel
      var b = bearing * D, p = pitch * D, cb = Math.cos(b), sb = Math.sin(b), cp = Math.cos(p), sp = Math.sin(p);
      return {
        s: s, bearing: bearing, pitch: pitch, radius: radius,
        cb: cb, sb: sb, cp: cp, sp: sp,          // Kamerawinkel, damit ssSkyFit nachrechnen kann
        // Sonne und Mond haengen NICHT mehr an K = min(W, Hs): eine breite, flache Kachel hat
        // reichlich Platz, von dem die kurze Kante nichts sieht - die Scheibe wurde dort winzig.
        rSun: ssBodyR(W, H, 34), rMoon: ssBodyR(W, H, 26),
        // Der Himmel sitzt auf einer GROESSEREN Kuppel als der Boden und wird leicht ueberhoeht.
        // Sonst heben sich bei starker Neigung Nord-Anteil und Hoehe gegenseitig auf und der
        // Tagesbogen erscheint als flache Linie statt als Bogen.
        skyR: radius * ssNum(w.ssSkyR, 1.55), skyLift: ssNum(w.ssSkyLift, 1.45),
        cx: W / 2, cy: H * 0.66,
        project: function (e, n, u) {
          var e2 = e * cb + n * sb, n2 = -e * sb + n * cb;
          return { x: this.cx + e2 * s, y: this.cy - (n2 * cp + (u || 0) * sp) * s, d: n2 };
        }
      };
    }

    // ---- Zeichnen ----
    /**
     * Zeichnen in zwei Ebenen:
     *  1. Die Szene (Himmel, Boden, Gebaeude, Sonne, Mond) aendert sich nur langsam - sie
     *     wird in eine Zwischenflaeche gemalt und nur neu erzeugt, wenn sich wirklich etwas
     *     aendert (Groesse, Blickwinkel, Sonnenstand, Einstellungen).
     *  2. Die Energieebene laeuft fluessig darueber. So kostet ein Animationsbild nur das
     *     Aufkopieren plus die Perlen statt der ganzen Szene - wichtig fuer ein Wandtablet,
     *     das den ganzen Tag laeuft.
     */
    function ssDraw(w, el) {
      var host = $('[data-role=ssbox]', el); if (!host) return;
      var cv = $('canvas', host); if (!cv) return;
      var W = host.clientWidth, H = host.clientHeight;
      if (!(W > 4 && H > 4)) return;
      var dpr = Math.min(2.5, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      var ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Die Zeitleiste bekommt ein eigenes Band UNTER der Szene - sie liegt nicht mehr
      // im Bild. Alles Raeumliche rechnet daher mit der verbleibenden Hoehe Hs.
      var sh = ssStripH(w, Math.min(W, H));
      var Hs = Math.max(40, H - sh);
      var K = Math.min(W, Hs);                   // Bezugsgroesse fuer ALLE Masse (responsiv)
      var cam = ssCam(w, W, Hs), sun = ssSun(w);
      // Himmel einpassen, BEVOR gezeichnet oder zwischengespeichert wird: der Fit veraendert cam
      // und muss deshalb auch bei einem Treffer im Zwischenspeicher gelten, sonst passen die
      // spaeter darueber gezeichneten Ebenen nicht mehr zum Bild.
      // Astronomie NICHT je Bild rechnen.
      //
      // Hier standen ein Tagesbogen mit 48 Stuetzpunkten und eine Mondposition -
      // in jedem Animationsbild neu, also 20-mal je Sekunde, obwohl sich beides in
      // einer Minute kaum um ein Winkelminuten-Vielfaches bewegt. Im Profil war das
      // nach dem Aufkopieren der zweitgroesste Posten (moon, pos, ssFmtW). Einmal
      // je Minute reicht; der Schluessel enthaelt Standort und Zeitpunkt, damit ein
      // Ortswechsel oder eine gesetzte Uhrzeit sofort greift.
      var fg = ssGeo(w);
      var stA = ssSt(w);
      var aKey = [fg.lat, fg.lon, Math.floor(ssNow(w) / 60000)].join('|');
      if (!stA.astro || stA.astro.k !== aKey) {
        var ftr0 = LVSUN.dayTrack(fg.lat, fg.lon, ssNow(w), 30), fap0 = null;
        for (var fi = 0; fi < ftr0.length; fi++) { if (!fap0 || ftr0[fi].elev > fap0.elev) fap0 = ftr0[fi]; }
        stA.astro = { k: aKey, fap: fap0, fmn: LVSUN.moon(fg.lat, fg.lon, ssNow(w) / 1000) };
      }
      var fap = stA.astro.fap, fmn = stA.astro.fmn;
      ssSkyFit(cam, [fap && { az: fap.az, el: fap.elev }, { az: sun.az, el: sun.elev },
                     fmn && { az: fmn.az, el: fmn.elev }],
               Math.max(12, K * 0.07) + cam.rSun);
      var rad = ssVal(w.ssRad);                  // gemessene Globalstrahlung W/m2
      var clr = (rad != null) ? LVSUN.clearness(rad, sun.elev) : null;
      var geo = ssGeo3(w, el);
      var pal0 = ssPal(el);
      var wx = _covOn2(w, 'ssWeather', true) ? ssWx(w) : null;

      // Der Schluessel entscheidet, wann die Szene neu gemalt wird - und er war zu fein.
      //
      // Die Sonne wandert rund ein Viertelgrad je Minute; auf zwei Nachkommastellen
      // genommen aendert sich der Schluessel damit alle paar SEKUNDEN, und jedes Mal
      // wurde die ganze Szene neu aufgebaut: Himmel, Sterne, Mond, Gebaeude,
      // Tagesbogen, Beschriftung. Auf einem schnellen Rechner faellt das nicht auf,
      // auf einem Tablet frisst es die Ladezeit (gemessen: mit vierfach gedrosselter
      // Rechenleistung ueber 10 Sekunden, davon 5 im Zeichnen).
      //
      // Ein Zehntelgrad ist auf dem Bildschirm weniger als ein Bildpunkt - die Szene
      // sieht unveraendert aus und wird nur noch alle paar Minuten neu gebaut.
      // Dasselbe gilt fuer Klarheit und Wetter: Zehntel genuegen.
      var key = [W, H, dpr, cam.bearing.toFixed(1), cam.pitch.toFixed(1), cam.radius.toFixed(1),
                 sun.az.toFixed(1), sun.elev.toFixed(1), clr == null ? 'x' : clr.toFixed(2),
                 geo ? geo.count : -1, Math.floor(ssNow(w) / 60000), ssStyleKey(w),
                 pal0.tile + pal0.accent,
                 wx ? [wx.cloud.toFixed(1), wx.rain.toFixed(1), wx.snow.toFixed(1), wx.fog.toFixed(1), wx.storm].join(',') : 'x'
                ].join('|');
      var st = ssSt(w);
      if (st.key !== key || !st.buf) {
        st.buf = ssScene(w, el, W, H, Hs, dpr, cam, sun, clr, geo, K, wx);
        st.key = key;
      }
      ctx.drawImage(st.buf, 0, 0, W, H);

      // Der Blitz kommt NACH dem Puffer - er soll blitzen, nicht eingebrannt sein.

      if (wx && wx.storm > 0) ssFlash(ctx, W, Hs, K, wx);

      var tW = (typeof performance !== 'undefined' ? performance.now() : ssNow(w)) / 1000;
      if (wx && wx.nass) {
        var dayW = Math.max(0, Math.min(1, (sun.elev + 6) / 16));
        ssWeatherDraw(ctx, W, Hs, K, wx, tW, pal0, dayW);
      }

      var els = ssEnergy(w, pal0);
      if (els) {
        var t = (typeof performance !== 'undefined' ? performance.now() : ssNow(w)) / 1000;
        ssEnergyDraw(ctx, cam, K, W, Hs, w, els, t,
          function () { var e2 = ssEl(w); if (e2) { ssSt(w).key = null; ssDraw(w, e2); } }, pal0);
        var lebt = _covOn2(w, 'ssEnAnim', true) && els.some(function (e) { return e.watt != null && e.watt > 1; });
        if (lebt) { ssAnim(w, el); }
      }
      // Niederschlag und ziehender Nebel brauchen ebenfalls Bilder - derselbe Schalter
      // haelt sie an, sonst liesse sich die Kachel nicht wirklich ruhigstellen.
      if (wx && _covOn2(w, 'ssEnAnim', true)
          && (wx.rain > 0.01 || wx.snow > 0.01 || wx.fog > 0.05)) { ssAnim(w, el); }
    }

    /** Alle Einstellungen als Zeichenkette - aendert sich eine, wird die Szene neu gemalt. */
    function ssStyleKey(w) {
      var o = [];
      Object.keys(w).forEach(function (k) {
        if (k.charAt(0) === '_' || k === 'elements') return;
        var v = w[k];
        if (v === null || typeof v === 'object') return;
        o.push(k + '=' + v);
      });
      return o.join(',');
    }

    /** Die langsame Ebene in eine eigene Flaeche malen. */
    function ssScene(w, el, W, H, Hs, dpr, cam, sun, clr, geo, K, wx) {
      var st = ssSt(w);
      var cv = st.buf;
      if (!cv) { cv = st.buf = document.createElement('canvas'); }
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      var ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var g = ssGeo(w);
      var day = Math.max(0, Math.min(1, (sun.elev + 6) / 16));   // 0 = Nacht, 1 = Tag

      var pal = ssPal(el);
      var cloud = wx ? wx.cloud : 0;
      // Bedeckter Himmel heisst diffuses Licht: weiche Schatten, matte Sonne. Dafuer wird
      // die Klarheit gedeckelt - sie steuert im ganzen Widget Halo, Dunst und Schattenhaerte.
      // clrE steuert Halo, Dunst und Schattenhaerte. Sie darf NICHT ein zweites Mal durch die
      // Bewoelkung gedeckelt werden, wenn diese aus DERSELBEN Strahlungsmessung zurueckgerechnet
      // wurde - das waere ein Messwert zweimal angewandt: aus kt=0,73 folgen nach Kasten &
      // Czeplak 74 % Bedeckung, die Szene wuerde auf 26 % gedimmt, obwohl gemessene 73 % der
      // Klarhimmelstrahlung ankommen. Schatten und Halo waren dadurch systematisch zu matt.
      // Stammt die Bewoelkung aus einer UNABHAENGIGEN Quelle (gebundene Variable, Vorhersage),
      // bleibt die Deckelung richtig - dann sind es zwei verschiedene Beobachtungen.
      var cloudIndep = !!(wx && wx.cloudSrc && wx.cloudSrc !== 'Strahlung');
      var clrE;
      if (clr == null)                        clrE = (cloud > 0) ? (1 - cloud) : null;
      else if (cloud > 0 && cloudIndep)       clrE = Math.min(clr, 1 - cloud);
      else                                    clrE = clr;
      ssSky(ctx, W, Hs, K, day, clrE, w, pal, cloud);
      var starA = (1 - day / 0.55) * (1 - cloud * 0.9);            // Wolken verdecken die Sterne
      if (day < 0.55 && starA > 0.03 && _covOn2(w, 'ssStars', true)) ssStars(ctx, W, Hs, K, starA, w);
      ssGround(ctx, cam, W, Hs, K, day, w, pal);
      // NACHTS DIE MONDBAHN. Die Sonnenbahn sagt bei untergegangener Sonne nichts - sie
      // laeuft unsichtbar unter dem Horizont durch. Wer nachts hinsieht, will wissen, wo
      // der Mond steht und wohin er zieht.
      var nachtBahn = (sun.elev < -0.833);
      var track = nachtBahn ? ssMoonTrack(g.lat, g.lon, ssNow(w), 6)
                            : LVSUN.dayTrack(g.lat, g.lon, ssNow(w), 6);
      // Auf-/Untergang in der Kopfzeile meint IMMER die SONNE. Nachts traegt `track` die
      // Mondbahn - riseSet() daraus lieferte Mondauf- und -untergang, gezeigt mit denselben
      // Pfeilen wie die Sonnenzeiten. Am 19.08.2026 abends stand so "auf 14:36 / unter 22:36"
      // in der Kopfzeile, waehrend die Sonne um 06:01 auf- und um 20:10 untergegangen war.
      var sonnenBahn = nachtBahn ? LVSUN.dayTrack(g.lat, g.lon, ssNow(w), 6) : track;
      ssArc(ctx, cam, K, track, sun, day, w, pal, nachtBahn);
      var mn = ssMoonDisc(ctx, cam, K, sun, day, w, cloud);
      // Gewitter: dunkle Wolkenbank. Sie gehoert in den gepufferten Teil - nur das
      // Aufblitzen wird spaeter live darueber gezeichnet.
      if (wx && wx.storm > 0) ssStormBank(ctx, cam, W, Hs, K, wx, day, pal);
      if (geo) ssNeighbours(ctx, cam, K, sun, day, clrE, w, geo, pal);
      ssHouse(ctx, cam, K, sun, day, clrE, w, geo, pal);
      if (geo) ssAttrib(ctx, W, Hs, K, pal, 0, w);
      ssSunDisc(ctx, cam, K, sun, clrE, w, cloud);
      ssFlugzeuge(ctx, cam, w, day);       // Flugzeuge auf der Kuppel (zuschaltbar)
      ssSatelliten(ctx, cam, w, day);      // Satelliten auf der Kuppel (zuschaltbar)
      // Fuer die Kopfzeile die GEMESSENE Klarheit (Strahlung gegen Klarhimmelwert), nicht clrE.
      // clrE ist durch die Bewoelkung gedeckelt und steuert Halo, Dunst und Schattenhaerte -
      // als Text neben dem W/m2-Wert war es irrefuehrend: 310 von 423 W/m2 sind 73 % klar,
      // angezeigt wurden aber 26 %, weil daraus 74 % Bedeckung zurueckgerechnet werden
      // (Kasten & Czeplak: kt = 1 - 0,75*N^3,4 - eine dichte Decke laesst immer noch viel durch).
      ssLabels(ctx, W, Hs, K, sun, ssVal(w.ssRad), clr, track, w, mn, pal, wx, cam, sonnenBahn);
      // Das Band zeigt die TAGESKURVE DER SONNE samt Auf-/Untergang - so steht es auch in
      // seiner Beschreibung. Nachts trug `track` die Mondbahn, damit stand im Band der
      // Mondaufgang unter denselben Pfeilen wie sonst die Sonnenzeiten (19.08.2026:
      // "14:05 / 22:36" statt 06:01 / 20:12). Der Mondbogen bleibt oben in der Szene.
      ssStrip(ctx, W, H, Hs, K, w, sonnenBahn, pal);
      return cv;
    }

    /** Naechstes Animationsbild - rund 30 je Sekunde, ruht bei verdeckter Seite. */
    /**
     * Naechstes Animationsbild anfordern.
     *
     * Zwei Bremsen, beide aus einer Messung: beim Laden der Hauptseite gingen rund
     * 2 der ersten 8 Sekunden Rechenzeit in diese Kachel - ein Drittel davon
     * allein in das Aufkopieren der Szene, 30-mal in der Sekunde, waehrend der
     * Rest der Seite noch aufgebaut wurde. Auf einem Tablet wird daraus die
     * gefuehlte Ladezeit.
     *
     *  1. Waehrend der ersten Sekunden nach dem Laden ruht die Animation. Das
     *     STANDBILD ist da - gezeichnet wird es sofort -, nur die Bilderfolge
     *     wartet, bis die Seite steht.
     *  2. Danach laeuft sie mit 20 statt 30 Bildern je Sekunde. Regen, Schnee und
     *     die wandernden Perlen sehen damit unveraendert aus, kosten aber ein
     *     Drittel weniger. Ueber ssFps ist die Rate einstellbar.
     */
    var _ssStart = (typeof performance !== 'undefined' && performance.now) ? 0 : 0;
    function ssRuhe() {
      // Zeit seit dem Laden der Seite, in ms.
      try { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : 9999; }
      catch (e) { return 9999; }
    }
    function ssAnim(w, el) {
      var st = ssSt(w);
      if (st.anim) return;
      var fps = Math.max(4, Math.min(30, parseFloat(w.ssFps) || 20));
      var ms = Math.round(1000 / fps);
      var seitStart = ssRuhe();
      if (seitStart < 2000) { ms = Math.max(ms, 2000 - seitStart); }   // Startruhe
      // Selbstanpassung: dauert ein Bild laenger, als der Takt erlaubt, wird der
      // Takt gedehnt - hoechstens ein Viertel der Zeit geht in diese Kachel. Ein
      // schnelles Geraet merkt davon nichts; ein langsames wird nicht zugedeckt,
      // sondern zeichnet eben seltener. Vorher hielt das Widget stur an 30 Bildern
      // je Sekunde fest, auch wenn ein Bild 80 ms brauchte.
      if (st.last > 0) { ms = Math.max(ms, Math.round(st.last * 4)); }
      st.anim = setTimeout(function () {
        st.anim = 0;
        if (typeof document !== 'undefined' && document.hidden) return;
        var e2 = ssEl(w);
        if (!e2 || !document.body.contains(e2)) return;
        var t0 = ssRuhe();
        ssDraw(w, e2);
        st.last = ssRuhe() - t0;
      }, ms);
    }

    // Himmel: Farbe folgt der Sonnenhoehe, Dunst der gemessenen Klarheit
    function ssSky(ctx, W, H, K, day, clr, w, pal, cloud) {
      var gr = ctx.createLinearGradient(0, 0, 0, H);
      var haze = (clr == null) ? 0.35 : (1 - clr) * 0.6;              // truebe Luft = flacherer Verlauf
      // Bewoelkung nimmt dem Himmel die Farbe. Bei Regen oder Schnee ist er bedeckt -
      // ein blauer Himmel im Regen waere der auffaelligste Fehler ueberhaupt.
      var cc = Math.max(0, Math.min(1, cloud || 0));
      var grau = pal.light ? ['#9aa4ad', '#b4bdc4', '#cbd2d7'] : ['#20272e', '#2b333b', '#1a2026'];
      function mixc(base, i) { return cc > 0 ? mix(base, grau[i], cc * 0.92) : base; }
      if (day > 0.5 && pal.light) {
        // Heller Skin: Tageshimmel in Tageslichtfarben, damit die Kachel nicht als
        // dunkler Block in einer hellen Oberflaeche steht.
        gr.addColorStop(0, mixc(mix('#7fb3d5', '#9fbdcd', haze), 0));
        gr.addColorStop(0.62, mixc(mix('#bcd9e6', '#cfdde4', haze), 1));
        gr.addColorStop(1, mixc(mix('#e3eef2', '#e8edef', haze), 2));
      } else if (day > 0.5) {
        gr.addColorStop(0, mixc(mix('#0a2233', '#16323f', haze), 0));
        gr.addColorStop(0.62, mixc(mix('#123b3f', '#1d4448', haze), 1));
        gr.addColorStop(1, mixc(mix('#0d1f24', '#141f22', haze), 2));
      } else {
        var t = day / 0.5;
        // Nachts nimmt die Wolkendecke das Sternenlicht und hellt den Horizont leicht auf.
        gr.addColorStop(0, mixc(mix('#060a12', '#241a2e', t), 0));
        gr.addColorStop(0.62, mixc(mix('#080e16', '#3a2733', t), 1));
        gr.addColorStop(1, mixc(mix('#05080c', '#1a1620', t), 2));
      }
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    function ssStars(ctx, W, H, K, a, w) {
      var n = Math.round(K / 7), sd = 4711;
      function r() { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; }
      ctx.save(); ctx.globalAlpha = Math.min(1, a) * 0.85;
      for (var i = 0; i < n; i++) {
        var x = r() * W, y = r() * H * 0.62, s = r() * (K / 620) + (K / 900);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + r() * 0.6).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // Bodenebene mit Raster; Rasterweite immer 20 m, Dichte skaliert mit dem Umkreis
    function ssGround(ctx, cam, W, H, K, day, w, pal) {
      var R = cam.radius, step = R > 140 ? 40 : (R > 70 ? 20 : 10);
      var lim = Math.ceil(R / step) * step;
      ctx.save(); ctx.beginPath();
      for (var v = -lim; v <= lim; v += step) {
        var a = cam.project(-lim, v, 0), b = cam.project(lim, v, 0);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        var c = cam.project(v, -lim, 0), d = cam.project(v, lim, 0);
        ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      }
      ctx.strokeStyle = ssA(pal.light ? pal.line : '#8cbec8', (pal.light ? 0.22 : 0.05 + day * 0.07));
      ctx.lineWidth = Math.max(0.6, K / 900); ctx.stroke(); ctx.restore();
      // Horizontkreis
      ctx.save(); ctx.beginPath();
      for (var i = 0; i <= 72; i++) {
        var t = i / 72 * Math.PI * 2, p = cam.project(Math.sin(t) * R, Math.cos(t) * R, 0);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.closePath(); ctx.strokeStyle = ssA(pal.light ? pal.line : '#8cbec8', pal.light ? 0.30 : 0.10);
      ctx.lineWidth = Math.max(0.6, K / 800); ctx.stroke(); ctx.restore();
    }
    /**
     * Bahn des MONDES ueber den Tag - gleiche Form wie LVSUN.dayTrack fuer die Sonne, damit
     * ssArc sie ohne Sonderfall zeichnen kann.
     */
    function ssMoonTrack(lat, lon, atMs, stepMin) {
      var d = new Date(atMs || Date.now());
      var mid = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() / 1000;
      var st = stepMin || 6, pts = [];
      for (var m = 0; m <= 1440; m += st) {
        var q = LVSUN.moon(lat, lon, mid + m * 60);
        pts.push({ min: m, az: q.az, elev: q.elev });
      }
      return pts;
    }

    /**
     * Wolkenbank eines Gewitters, dunkler als die uebrige Bewoelkung. Bei Regen zusaetzlich
     * Regenstriche. Wetterleuchten (Stufe 1) bekommt KEINE Bank - das Gewitter steht ja weit
     * weg; dort bleibt nur das schwache Aufleuchten am Horizont.
     */
    function ssStormBank(ctx, cam, W, Hs, K, wx, day, pal) {
      if (wx.storm < 2) return;
      ctx.save();
      var h = Hs * 0.42, y = Hs * 0.06;
      var g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, ssA(pal.light ? '#5b6b72' : '#1b2230', pal.light ? 0.5 : 0.82));
      g.addColorStop(1, ssA(pal.light ? '#93a2a8' : '#232c3c', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (var x = 0; x <= W; x += W / 8) {
        ctx.quadraticCurveTo(x + W / 16, y + h * (0.55 + 0.22 * Math.sin(x / (W / 3))), x + W / 8, y + h * 0.62);
      }
      ctx.lineTo(W, y); ctx.closePath(); ctx.fill();
      if (wx.rain > 0) {
        ctx.strokeStyle = ssA('#5ab6ff', 0.32); ctx.lineWidth = Math.max(0.7, K / 700);
        for (var i = 0; i < 60; i++) {
          var rx = (i * 97) % W, ry = y + h * 0.5 + ((i * 53) % (Hs * 0.4));
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - K / 130, ry + K / 40); ctx.stroke();
        }
      }
      ctx.restore();
    }

    /**
     * BLITZ - live ueber den gepufferten Hintergrund gezeichnet, nicht hinein: sonst muesste
     * die ganze Szene je Bild neu entstehen. Der Takt kommt aus der UHR, nicht aus einem
     * Zaehler, damit ein Neuzeichnen den Rhythmus nicht verschiebt.
     *
     * Doppelschlag alle paar Sekunden, dazwischen Ruhe; je naeher das Gewitter, desto oefter.
     * Bei Wetterleuchten nur ein Aufhellen ohne sichtbaren Kanal - genau so sieht ein fernes
     * Gewitter aus. Gilt bei Tag wie bei Nacht.
     */
    function ssFlash(ctx, W, Hs, K, wx) {
      if (!wx || !wx.storm) return 0;
      var per = wx.storm >= 3 ? 3200 : (wx.storm >= 2 ? 5200 : 8000);
      var t = Date.now() % per, a = 0;
      if (t < 90) a = 1 - t / 90;
      else if (t > 140 && t < 210) a = (1 - (t - 140) / 70) * 0.65;
      if (a <= 0.01) return 0;
      var seed = Math.floor(Date.now() / per);
      var fx = ((seed * 9301 + 49297) % 233280) / 233280;
      ctx.save();
      ctx.fillStyle = ssA('#ffffff', (a * (wx.storm >= 2 ? 0.20 : 0.10)).toFixed(3));
      ctx.fillRect(0, 0, W, Hs);
      if (wx.storm >= 2) {
        var x0 = W * (0.18 + 0.64 * fx), y0 = Hs * 0.10, y1 = Hs * 0.66, x = x0, y = y0, i = 0;
        ctx.strokeStyle = ssA('#fff4c2', (a * 0.95).toFixed(3));
        ctx.lineWidth = Math.max(1.2, K / 260); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.shadowColor = ssA('#f2b441', (a * 0.8).toFixed(3)); ctx.shadowBlur = K / 22;
        ctx.beginPath(); ctx.moveTo(x0, y0);
        while (y < y1) {
          x += ((((seed + i) * 7919) % 2) ? 1 : -1) * (W * 0.035);
          y += (y1 - y0) / 5; ctx.lineTo(x, y); i++;
        }
        ctx.stroke();
      }
      ctx.restore();
      return a;
    }

    // Tagesbogen + Auf-/Untergangsmarken
    function ssArc(ctx, cam, K, track, sun, day, w, pal, mondBahn) {
      // Die Mondbahn bekommt die Mondfarbe statt des Sonnengelbs - sonst sieht die Nacht
      // aus wie ein vergessener Tagesbogen.
      var R = cam.skyR, acc = mondBahn ? pal.col(w.ssMoonColor, '#9db8e6') : pal.col(w.ssArcColor, '#ffd166');
      ctx.save(); ctx.beginPath(); var first = true;
      track.forEach(function (s) {
        if (s.elev < -1.5) { first = true; return; }
        var p = ssSky3(cam, s.az, s.elev, R);
        first ? (ctx.moveTo(p.x, p.y), first = false) : ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = ssA(acc, (mondBahn ? 0.42 : (0.18 + day * 0.3)).toFixed(2));
      ctx.lineWidth = Math.max(1, K / 300); ctx.setLineDash([K / 90, K / 90]); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      // Auf-/Untergang
      var rs = LVSUN.riseSet(track), st = track[0] ? 6 : 6;
      [['rise', rs.rise], ['set', rs.set]].forEach(function (o) {
        if (o[1] == null) return;
        var i = Math.max(0, Math.min(track.length - 1, Math.round(o[1] / st)));
        var s = track[i], p = ssSky3(cam, s.az, Math.max(0, s.elev), R);
        ctx.save();
        ctx.fillStyle = mondBahn ? 'rgba(157,184,230,.6)' : 'rgba(255,209,102,.55)';
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, K / 190), 0, 7); ctx.fill();
        ctx.restore();
      });
    }
    /**
     * Durchmesser von Sonne und Mond. Bezug ist das geometrische Mittel BEIDER Kanten, nicht
     * die kurze - sonst schrumpfen sie auf einer breiten, flachen Kachel mit, obwohl daneben
     * Platz frei ist. Untergrenze, damit die Scheibe nie zum Punkt wird; Obergrenze, damit sie
     * auf einer kleinen Kachel nicht den halben Himmel einnimmt.
     */
    function ssBodyR(W, H, div) {
      var r = Math.sqrt(Math.max(1, W * H)) / div * 1.15;
      return Math.max(6, Math.min(r, Math.min(W, H) / 7));
    }

    /**
     * Haelt den Himmel in der Kachel. Die Kuppel wird ueberhoeht gezeichnet (skyLift), damit der
     * Tagesbogen als Bogen und nicht als flache Linie erscheint. Auf einer flachen Kachel wandern
     * Sonne, Mond und Bogen dadurch ueber den oberen Rand hinaus - fuer den Betrachter fehlen sie
     * einfach. Statt die Koerper an den Rand zu klemmen (dann staenden sie falsch), wird die
     * Ueberhoehung so weit zurueckgenommen, dass der hoechste zu zeigende Punkt gerade hineinpasst.
     * Die Lage der Koerper zueinander bleibt dabei richtig.
     *
     * pts = [{az, el}, ...] - alles, was sichtbar bleiben muss (Bogenscheitel, Sonne, Mond).
     */
    function ssSkyFit(cam, pts, margin) {
      var need = 1;
      for (var i = 0; i < pts.length; i++) {
        var el = pts[i] && pts[i].el, az = pts[i] && pts[i].az;
        if (el == null || az == null || el < 0) continue;
        var hr = Math.cos(el * D) * cam.skyR, u = Math.sin(el * D) * cam.skyR * cam.skyLift;
        if (!(u > 0)) continue;
        var e = hr * Math.sin(az * D), n = hr * Math.cos(az * D);
        var n2 = -e * cam.sb + n * cam.cb;
        var y = cam.cy - (n2 * cam.cp + u * cam.sp) * cam.s;
        if (y >= margin) continue;
        // y(k) = cy - (n2*cp + u*k*sp)*s ; k so waehlen, dass y genau auf den Rand faellt
        var k = (((cam.cy - margin) / cam.s) - n2 * cam.cp) / (u * cam.sp);
        if (k > 0 && k < need) need = k;
      }
      if (need < 1) cam.skyLift *= need;
    }

    function ssSky3(cam, az, el, R) {
      var hr = Math.cos(el * D) * R, u = Math.sin(el * D) * R * cam.skyLift;
      return cam.project(hr * Math.sin(az * D), hr * Math.cos(az * D), u);
    }
    // Nachbargebaeude aus OpenStreetMap: extrudierte Prismen, Tiefensortierung nach dem
    // Maler-Prinzip (hinten zuerst), Schatten aller Gebaeude in EINEM Pfad (Nonzero
    // verschmilzt Ueberlappungen, statt sie zu dunklen Flecken zu addieren).
    function ssNeighbours(ctx, cam, K, sun, day, clr, w, geo, pal) {
      var R = cam.radius, own = ssOwnIdx(geo), max = Math.round(ssNum(w.ssMaxB, 60));
      var roof = _covOn2(w, 'ssBldRoof', true);
      var list = [];
      for (var i = 0; i < geo.b.length && list.length < max; i++) {
        if (i === own) continue;                                   // eigenes Haus zeichnet ssHouse
        var b = geo.b[i], c = ssCentroid(b.r);
        if (Math.hypot(c[0], c[1]) > R * 1.15) continue;            // ausserhalb des Umkreises
        // OSM-Hoehe meint die Gesamthoehe. Fuer das Satteldach wird sie in Traufe und
        // Firstueberhoehung geteilt, damit das Haus nicht insgesamt hoeher wird.
        var rg = b.r.map(function (p) { return { e: p[0], n: p[1] }; });
        var rise = roof ? ssRise(rg, b.k === 'aux') : 0;
        list.push({ b: b, ring: rg, rise: rise, eave: Math.max(2.2, b.h - rise),
                    d: cam.project(c[0], c[1], 0).d });
      }
      list.sort(function (x, y) { return y.d - x.d; });              // hinten zuerst
      // Schatten
      if (sun.elev > 1) {
        var t = 1 / Math.tan(sun.elev * D), sx = Math.sin(sun.az * D), sy = Math.cos(sun.az * D);
        ctx.save(); ctx.beginPath();
        list.forEach(function (o) {
          var r = o.b.r, h = o.b.h;
          for (var k = 0; k < r.length; k++) {
            var a = r[k], c2 = r[(k + 1) % r.length];
            var p1 = cam.project(a[0], a[1], 0), p2 = cam.project(c2[0], c2[1], 0);
            var p3 = cam.project(c2[0] - t * h * sx, c2[1] - t * h * sy, 0);
            var p4 = cam.project(a[0] - t * h * sx, a[1] - t * h * sy, 0);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
          }
        });
        var hard = 0.2 + (clr == null ? 0.3 : clr * 0.5);
        ctx.fillStyle = 'rgba(2,8,14,' + (0.42 * hard + 0.10).toFixed(3) + ')'; ctx.fill('nonzero'); ctx.restore();
      }
      // Koerper
      var base = pal.col(w.ssBldColor, '#c8c0b2');
      list.forEach(function (o) {
        var r = o.b.r, h = roof ? o.eave : o.b.h, aux = (o.b.k === 'aux');
        for (var k = 0; k < r.length; k++) {
          var a = r[k], c2 = r[(k + 1) % r.length];
          var b1 = cam.project(a[0], a[1], 0), b2 = cam.project(c2[0], c2[1], 0);
          var t1 = cam.project(a[0], a[1], h), t2 = cam.project(c2[0], c2[1], h);
          if ((b2.x - b1.x) * (t1.y - b1.y) - (b2.y - b1.y) * (t1.x - b1.x) > 0) continue;
          var dx = c2[0] - a[0], dy = c2[1] - a[1], Ln = Math.hypot(dx, dy) || 1;
          var lam = Math.max(0, (dy / Ln) * Math.sin(sun.az * D) + (-dx / Ln) * Math.cos(sun.az * D));
          ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y); ctx.closePath();
          ctx.fillStyle = tint(base, (aux ? 0.20 : 0.24) + 0.42 * lam * day);
          ctx.fill();
        }
        if (roof) { ssRoofDraw(ctx, cam, K, ssGable(o.ring, h, o.rise), sun, day, base, 0.26, 0.80); }
        else {
          ctx.beginPath();
          r.forEach(function (pt, k2) { var q = cam.project(pt[0], pt[1], h); k2 ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
          ctx.closePath();
          ctx.fillStyle = tint(base, (aux ? 0.42 : 0.52) * (0.45 + day * 0.55));
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.20)'; ctx.lineWidth = Math.max(0.5, K / 1100); ctx.stroke();
        }
      });
    }
    /**
     * Satteldach ueber einem beliebigen Grundriss.
     *  Der First laeuft entlang der Laengsachse ueber die volle Hauslaenge; jede Traufkante
     *  steigt zu ihm hin an. Bei einem Rechteck ergibt das genau ein Satteldach - die
     *  Stirnseiten werden zu Giebeldreiecken. Rueckgabe: Flaechen (je 3 oder 4 Punkte).
     */
    function ssGable(ring, Ht, Hr) {
      var ax = ssMainAxis(ring);
      var faces = [];
      function onRidge(p) {                                  // Punkt auf die Firstlinie loten
        var t = (p.e - ax.c.e) * ax.d.e + (p.n - ax.c.n) * ax.d.n;
        t = Math.max(ax.t0, Math.min(ax.t1, t));
        return { e: ax.c.e + ax.d.e * t, n: ax.c.n + ax.d.n * t };
      }
      for (var i = 0; i < ring.length; i++) {
        var a = ring[i], b = ring[(i + 1) % ring.length];
        var ra = onRidge(a), rb = onRidge(b);
        var q = [{ p: a, z: Ht }, { p: b, z: Ht }];
        if (Math.hypot(rb.e - ra.e, rb.n - ra.n) > 0.15) { q.push({ p: rb, z: Ht + Hr }); }
        q.push({ p: ra, z: Ht + Hr });
        if (q.length < 3) { continue; }
        var dx = b.e - a.e, dy = b.n - a.n, L = Math.hypot(dx, dy) || 1;
        faces.push({ q: q, nx: dy / L, ny: -dx / L });        // Aussennormale der Traufkante
      }
      return faces;
    }
    /**
     * Laengsachse eines Grundrisses ueber das kleinste umschliessende Rechteck.
     *  Die laengste Verbindung zweier Ecken waere bei einem Rechteck die Diagonale - der
     *  First liefe dann quer ueber das Haus. Deshalb wird je Kantenrichtung die Huellbox
     *  berechnet und die flaechenkleinste genommen; ihre laengere Seite ist die Firstachse.
     */
    function ssMainAxis(ring) {
      var best = null;
      for (var i = 0; i < ring.length; i++) {
        var a = ring[i], b = ring[(i + 1) % ring.length];
        var dx = b.e - a.e, dy = b.n - a.n, L = Math.hypot(dx, dy);
        if (L < 0.3) continue;
        var ux = dx / L, uy = dy / L;                       // Kantenrichtung und Querrichtung
        var u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (var k = 0; k < ring.length; k++) {
          var tu = ring[k].e * ux + ring[k].n * uy;
          var tv = -ring[k].e * uy + ring[k].n * ux;
          if (tu < u0) u0 = tu; if (tu > u1) u1 = tu;
          if (tv < v0) v0 = tv; if (tv > v1) v1 = tv;
        }
        var A = (u1 - u0) * (v1 - v0);
        if (!best || A < best.A) { best = { A: A, ux: ux, uy: uy, u0: u0, u1: u1, v0: v0, v1: v1 }; }
      }
      if (!best) {
        var ce0 = 0, cn0 = 0;
        ring.forEach(function (p) { ce0 += p.e; cn0 += p.n; });
        return { c: { e: ce0 / ring.length, n: cn0 / ring.length }, d: { e: 1, n: 0 }, t0: -1, t1: 1 };
      }
      var mu = (best.u0 + best.u1) / 2, mv = (best.v0 + best.v1) / 2;
      var cx = mu * best.ux - mv * best.uy, cy = mu * best.uy + mv * best.ux;   // Boxmitte
      var lenU = best.u1 - best.u0, lenV = best.v1 - best.v0;
      var alongU = lenU >= lenV;                            // First auf der laengeren Seite
      return {
        c: { e: cx, n: cy },
        d: alongU ? { e: best.ux, n: best.uy } : { e: -best.uy, n: best.ux },
        t0: -(alongU ? lenU : lenV) / 2, t1: (alongU ? lenU : lenV) / 2
      };
    }

    /** Dachflaechen zeichnen, hintere zuerst. */
    function ssRoofDraw(ctx, cam, K, faces, sun, day, col, lo, hi) {
      faces.forEach(function (f) {
        var d = 0;
        f.q.forEach(function (v) { d += cam.project(v.p.e, v.p.n, v.z).d; });
        f.d = d / f.q.length;
        f.lam = Math.max(0, f.nx * Math.sin(sun.az * D) + f.ny * Math.cos(sun.az * D));
      });
      faces.sort(function (a, b) { return b.d - a.d; });
      faces.forEach(function (f) {
        ctx.beginPath();
        f.q.forEach(function (v, k) { var q = cam.project(v.p.e, v.p.n, v.z); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
        ctx.closePath();
        ctx.fillStyle = tint(col, lo + (hi - lo) * f.lam * day);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = Math.max(0.5, K / 1200); ctx.stroke();
      });
    }
    /** Firsthoehe eines Nachbarhauses: aus der Gebaeudebreite, gedeckelt. */
    function ssRise(ring, aux) {
      var span = ssShortSpan(ring);
      return aux ? Math.min(1.2, span * 0.22) : Math.max(1.4, Math.min(4.2, span * 0.30));
    }

    /** Kuerzeste Ausdehnung (Breite) eines Rings - Mass fuer die Dachneigungstiefe. */
    function ssShortSpan(ring) {
      var best = 1e9;
      for (var i = 0; i < ring.length; i++) {
        var a = ring[i], b = ring[(i + 1) % ring.length];
        var dx = b.e - a.e, dy = b.n - a.n, L = Math.hypot(dx, dy);
        if (L < 0.5) continue;
        var mx = 0;                                   // groesster Abstand zu dieser Kante
        ring.forEach(function (p) {
          var d = Math.abs((p.e - a.e) * dy - (p.n - a.n) * dx) / L;
          if (d > mx) mx = d;
        });
        if (mx < best) best = mx;
      }
      return best < 1e8 ? best : 6;
    }
    /**
     * Ring um d nach innen versetzen (Gehrung an den Ecken). Ergibt die Firstflaeche eines
     * Walmdachs. Bei zu spitzen Ecken oder Selbstdurchdringung wird d verkleinert.
     */
    function ssInset(ring, d) {
      var n = ring.length, A = 0;
      for (var i = 0; i < n; i++) { var j = (i + 1) % n; A += ring[i].e * ring[j].n - ring[j].e * ring[i].n; }
      var sgn = A >= 0 ? 1 : -1;                       // Umlaufsinn -> Innenrichtung
      for (var pass = 0; pass < 6; pass++) {
        var out = [], bad = false;
        for (var k = 0; k < n; k++) {
          var p0 = ring[(k - 1 + n) % n], p1 = ring[k], p2 = ring[(k + 1) % n];
          var n1 = ssNorm(p0, p1, sgn), n2 = ssNorm(p1, p2, sgn);
          var dot = n1.e * n2.e + n1.n * n2.n, den = 1 + dot;
          if (den < 0.25) { den = 0.25; }              // spitze Ecke: Gehrung begrenzen
          out.push({ e: p1.e + (n1.e + n2.e) * d / den, n: p1.n + (n1.n + n2.n) * d / den });
        }
        var A2 = 0;
        for (var m = 0; m < n; m++) { var q = (m + 1) % n; A2 += out[m].e * out[q].n - out[q].e * out[m].n; }
        if (A2 * sgn > 0 && Math.abs(A2) > Math.abs(A) * 0.08) { return out; }
        d *= 0.6;                                      // zu weit versetzt - naeher an die Traufe
      }
      return ring.map(function (p) { return { e: p.e, n: p.n }; });
    }
    /** Nach innen zeigende Einheitsnormale der Kante a->b. */
    function ssNorm(a, b, sgn) {
      var dx = b.e - a.e, dy = b.n - a.n, L = Math.hypot(dx, dy) || 1;
      return { e: -sgn * dy / L, n: sgn * dx / L };
    }

    /** Laengste Ausdehnung eines Rings: Mittelpunkt, Richtung, halbe Laenge. */
    function ssLongAxis(ring) {
      var best = { len: -1 };
      for (var i = 0; i < ring.length; i++) {
        for (var j = i + 1; j < ring.length; j++) {
          var dx = ring[j].e - ring[i].e, dy = ring[j].n - ring[i].n, L = Math.hypot(dx, dy);
          if (L > best.len) best = { len: L, a: ring[i], b: ring[j], dx: dx / L, dy: dy / L };
        }
      }
      return { c: { e: (best.a.e + best.b.e) / 2, n: (best.a.n + best.b.n) / 2 },
               d: { e: best.dx, n: best.dy }, half: best.len * 0.40 };
    }
    function ssCentroid(r) { var e = 0, n = 0; r.forEach(function (p) { e += p[0]; n += p[1]; }); return [e / r.length, n / r.length]; }
    /** Index des eigenen Hauses: naechstes Gebaeude, dessen Schwerpunkt < 20 m entfernt liegt. */
    function ssOwnIdx(geo) {
      if (!geo || !geo.b || !geo.b.length) return -1;
      var best = -1, bd = 400;
      geo.b.forEach(function (b, i) {
        var c = ssCentroid(b.r), d2 = c[0] * c[0] + c[1] * c[1];
        if (d2 < bd) { bd = d2; best = i; }
      });
      return best;
    }

    // Eigenes Haus: Baukoerper bis zur Traufe + Satteldach mit First. Der Schatten wird aus
    // der VOLLEN Silhouette (inkl. Dach) gebildet, damit er zur Form passt.
    function ssHouse(ctx, cam, K, sun, day, clr, w, geo, pal) {
      var L = Math.max(4, ssNum(w.ssHouseL, 25)), B = Math.max(4, ssNum(w.ssHouseB, 12));
      var Ht = Math.max(2, ssNum(w.ssHouseH, 7.5));                 // Traufhoehe
      var Hr = Math.max(0, ssNum(w.ssRoofH, 3.5));                // Firstueberhoehung
      var rot = ssGeo(w, 'ssNorth', 'northDeg', 0) * D, c = Math.cos(rot), sn = Math.sin(rot);
      function P(x, y) { return { e: x * c - y * sn, n: x * sn + y * c }; }
      var ring, ridgeA, ridgeB;
      var oi = (geo && _covOn2(w, 'ssOwnFromOsm', true)) ? ssOwnIdx(geo) : -1;
      if (oi >= 0) {
        // ECHTER Grundriss aus OpenStreetMap. First entlang der laengsten Ausdehnung.
        ring = geo.b[oi].r.map(function (p) { return { e: p[0], n: p[1] }; });
        var ax = ssLongAxis(ring);
        ridgeA = { e: ax.c.e - ax.d.e * ax.half, n: ax.c.n - ax.d.n * ax.half };
        ridgeB = { e: ax.c.e + ax.d.e * ax.half, n: ax.c.n + ax.d.n * ax.half };
      } else {
        ring = [P(-L / 2, -B / 2), P(L / 2, -B / 2), P(L / 2, B / 2), P(-L / 2, B / 2)];
        ridgeA = P(-L / 2, 0); ridgeB = P(L / 2, 0);              // First laengs
      }
      var acc = pal.col(w.ssHouseColor, pal.accent);
      var lit = (clr == null ? 0.8 : 0.35 + clr * 0.65);

      // --- Grundstueck (dezente Flaeche unter dem Haus) ---
      if (_covOn2(w, 'ssPlot', true)) {
        var pl = Math.max(L, B) * ssNum(w.ssPlotF, 2.6);
        ctx.save(); ctx.beginPath();
        [P(-pl / 2, -pl * 0.42), P(pl / 2, -pl * 0.42), P(pl / 2, pl * 0.42), P(-pl / 2, pl * 0.42)].forEach(function (q, k) {
          var pp = cam.project(q.e, q.n, 0); k ? ctx.lineTo(pp.x, pp.y) : ctx.moveTo(pp.x, pp.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(70,120,95,' + (0.10 + day * 0.13).toFixed(3) + ')'; ctx.fill();
        ctx.strokeStyle = 'rgba(120,180,150,.16)'; ctx.lineWidth = Math.max(0.6, K / 800); ctx.stroke();
        ctx.restore();
      }

      // --- Schatten der gesamten Silhouette ---
      if (sun.elev > 1) {
        var t = 1 / Math.tan(sun.elev * D), sx = Math.sin(sun.az * D), sy = Math.cos(sun.az * D);
        function sh(pt, h) { return { e: pt.e - t * h * sx, n: pt.n - t * h * sy }; }
        ctx.save(); ctx.beginPath();
        ring.forEach(function (a, k) {                              // Wandflaechen
          var b = ring[(k + 1) % ring.length];
          var q = [cam.project(a.e, a.n, 0), cam.project(b.e, b.n, 0),
                   cam.project(sh(b, Ht).e, sh(b, Ht).n, 0), cam.project(sh(a, Ht).e, sh(a, Ht).n, 0)];
          ctx.moveTo(q[0].x, q[0].y); q.slice(1).forEach(function (o) { ctx.lineTo(o.x, o.y); }); ctx.closePath();
        });
        [[ring[0], ring[1]], [ring[2], ring[3]]].forEach(function (pr, i) {   // Dachflaechen
          var rA = i ? ridgeB : ridgeA, rB = i ? ridgeA : ridgeB;
          var q = [cam.project(sh(pr[0], Ht).e, sh(pr[0], Ht).n, 0), cam.project(sh(pr[1], Ht).e, sh(pr[1], Ht).n, 0),
                   cam.project(sh(rB, Ht + Hr).e, sh(rB, Ht + Hr).n, 0), cam.project(sh(rA, Ht + Hr).e, sh(rA, Ht + Hr).n, 0)];
          ctx.moveTo(q[0].x, q[0].y); q.slice(1).forEach(function (o) { ctx.lineTo(o.x, o.y); }); ctx.closePath();
        });
        var hard = 0.25 + (clr == null ? 0.35 : clr * 0.6);
        ctx.fillStyle = 'rgba(2,8,14,' + (0.52 * hard + 0.14).toFixed(3) + ')'; ctx.fill('nonzero'); ctx.restore();
      }

      // --- Waende (nur zugewandte) ---
      for (var k = 0; k < ring.length; k++) {
        var a = ring[k], b = ring[(k + 1) % ring.length];
        var b1 = cam.project(a.e, a.n, 0), b2 = cam.project(b.e, b.n, 0);
        var t1 = cam.project(a.e, a.n, Ht), t2 = cam.project(b.e, b.n, Ht);
        if ((b2.x - b1.x) * (t1.y - b1.y) - (b2.y - b1.y) * (t1.x - b1.x) > 0) continue;
        var dx = b.e - a.e, dy = b.n - a.n, Ln = Math.hypot(dx, dy) || 1;
        var lam = Math.max(0, (dy / Ln) * Math.sin(sun.az * D) + (-dx / Ln) * Math.cos(sun.az * D));
        ctx.beginPath(); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y); ctx.closePath();
        ctx.fillStyle = tint(acc, 0.30 + 0.5 * lam * day * lit); ctx.fill();
      }
      // --- Dachflaechen, hintere zuerst (nur beim erzeugten Rechteck; OSM-Grundrisse
      //     bekommen eine geschlossene Dachflaeche mit Firstlinie) ---
      if (ring.length !== 4) {
        // Beliebiger Grundriss (z. B. aus OpenStreetMap): Satteldach ueber der Laengsachse.
        ssRoofDraw(ctx, cam, K, ssGable(ring, Ht, Hr), sun, day, acc, 0.34, 0.92);
        return;
      }
      var roofs = [
        { q: [ring[0], ring[1], ridgeB, ridgeA], nrm: -1 },
        { q: [ring[2], ring[3], ridgeA, ridgeB], nrm: 1 }
      ].map(function (o) {
        var m = o.q.reduce(function (acc2, x) { return { e: acc2.e + x.e / 4, n: acc2.n + x.n / 4 }; }, { e: 0, n: 0 });
        o.d = cam.project(m.e, m.n, Ht).d; return o;
      }).sort(function (x, y) { return y.d - x.d; });
      roofs.forEach(function (o, idx) {
        ctx.beginPath();
        o.q.forEach(function (pt, i2) {
          var h = (i2 >= 2) ? Ht + Hr : Ht, pp = cam.project(pt.e, pt.n, h);
          i2 ? ctx.lineTo(pp.x, pp.y) : ctx.moveTo(pp.x, pp.y);
        });
        ctx.closePath();
        // Sonnenseite heller: Dachnormale grob ueber die Traufkante
        var e0 = o.q[0], e1 = o.q[1], dx2 = e1.e - e0.e, dy2 = e1.n - e0.n, Ln2 = Math.hypot(dx2, dy2) || 1;
        var lam2 = Math.max(0, (dy2 / Ln2) * Math.sin(sun.az * D) + (-dx2 / Ln2) * Math.cos(sun.az * D));
        ctx.fillStyle = tint(acc, 0.55 + 0.55 * lam2 * day * lit);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(0.6, K / 900); ctx.stroke();
      });
      // --- Firstlinie ---
      var f1 = cam.project(ridgeA.e, ridgeA.n, Ht + Hr), f2 = cam.project(ridgeB.e, ridgeB.n, Ht + Hr);
      ctx.beginPath(); ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y);
      ctx.strokeStyle = tint(acc, 1.15); ctx.lineWidth = Math.max(1, K / 420); ctx.stroke();
    }
    // Sonnenscheibe + Halo (Groesse aus der gemessenen Einstrahlung) + Einfallstrahl
    /**
     * Mond mit echter Phase. Die beleuchtete Seite zeigt zur Sonne - deshalb wird die
     * Scheibe so gedreht, dass sie zur Bildschirmposition der Sonne weist. Das ist die
     * Blickgeometrie und stimmt damit auch, wenn die Sonne unter dem Horizont steht.
     * Rueckgabe: die Monddaten fuer die Beschriftung (oder null, wenn nicht sichtbar).
     */
    /* Flugzeuge auf der Himmelskuppel - BEWUSST ohne Radaranzeige.
     *
     * Die Bodenebene dieser Szene hat 55 Meter Radius, die Flugszene braucht 30 000.
     * Das ist Faktor 545; in dieselbe Ebene bekommt man Flugzeuge nicht. Auf der
     * Kuppel geht es trotzdem, denn dort steht auch die Sonne nur als RICHTUNG.
     * Gezeigt werden also Azimut und Hoehenwinkel, keine Entfernungen und keine
     * Bodenspuren - alles Zaehlbare gehoert auf die eigene Flugseite.
     *
     * Nachts werden aus den Silhouetten Positionslichter: rot links, gruen rechts,
     * weisser Blitz. Das ist die Ansicht, die man tatsaechlich am Himmel sieht.
     */
    var _ssFlug = { stand: 0, flug: [], geholt: 0, laeuft: false };
    function ssFlugLade(w) {
      var r = ssNum(w.ssFlightR, 30);
      if (_ssFlug.laeuft || (Date.now() - _ssFlug.geholt) < 28000) { return; }
      _ssFlug.laeuft = true;
      fetch('?api=flights&r=' + r, { cache: 'no-store' })
        .then(function (x) { return x.json(); })
        .then(function (j) {
          _ssFlug = { stand: j.stand || 0, flug: j.flug || [], geholt: Date.now(), laeuft: false };
          // Neu zeichnen lassen - derselbe Fall wie bei den Satelliten: der Abruf
          // ist asynchron und regelmaessig SPAETER fertig als das letzte Bild. Die
          // Maschinen lagen dann im Speicher und wurden nie gemalt, weil die Kachel
          // nur bei Wertaenderung oder Bedienung neu zeichnet.
          ssDrawBald(w, ssEl(w));
        })
        .catch(function () { _ssFlug.laeuft = false; _ssFlug.geholt = Date.now(); });
    }
    function ssFlugzeuge(ctx, cam, w, day) {
      if (!_covOn2(w, 'ssFlights', false)) { return; }
      ssFlugLade(w);
      var vs = Math.max(0, (Date.now() / 1000) - (_ssFlug.stand || 0));
      var nacht = day < 0.28;
      _ssFlug.flug.forEach(function (f) {
        // Koppelnavigation: zwischen zwei Abfragen liegen 30 Sekunden, in denen ein
        // Jet siebeneinhalb Kilometer zuruecklegt - ohne Weiterrechnen springt er.
        var v = (f.tempo || 0) / 3.6 / 1000, k = (f.kurs || 0) * Math.PI / 180;
        var dn = f.dn + v * Math.cos(k) * vs, de = f.de + v * Math.sin(k) * vs;
        var alt = Math.max(0, f.alt + (f.steig || 0) * vs);
        var dist = Math.sqrt(dn * dn + de * de);
        if (dist < 0.05) { dist = 0.05; }
        var el = Math.atan2(alt / 1000, dist) * 180 / Math.PI;
        // Unter 6 Grad bleibt die Maschine draussen: so flach projiziert steht sie
        // mitten zwischen den Nachbarhaeusern statt am Himmel, und die Aussage
        // "dort oben fliegt etwas" kippt ins Gegenteil.
        if (el < 6) { return; }
        var az = (Math.atan2(de, dn) * 180 / Math.PI + 360) % 360;
        var q = ssSky3(cam, az, el, cam.skyR);
        if (!q || q.hidden) { return; }
        var sk = Math.max(0.32, Math.min(0.7, cam.skyR / 180));
        var col = alt < 1000 ? '#f2b23c' : (alt < 6000 ? '#00cdab' : '#7fc0ff');
        ctx.save();
        if (nacht) {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(k);
          ssFlugForm(ctx, sk * 0.9); ctx.fillStyle = 'rgba(160,190,200,.28)'; ctx.fill(); ctx.restore();
          var blitz = ((Date.now() / 1000) % 1.6) < 0.09;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(k);
          [[-9 * sk, 3.6 * sk, '#ff4d4d'], [9 * sk, 3.6 * sk, '#3ddc63']].forEach(function (p) {
            ctx.beginPath(); ctx.arc(p[0], p[1], 1.8 * sk, 0, 7);
            ctx.fillStyle = p[2]; ctx.shadowColor = p[2]; ctx.shadowBlur = 7 * sk; ctx.fill();
          });
          if (blitz) {
            ctx.beginPath(); ctx.arc(0, 9 * sk, 2.4 * sk, 0, 7);
            ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 11 * sk; ctx.fill();
          }
          ctx.shadowBlur = 0; ctx.restore();
        } else {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(k);
          ssFlugForm(ctx, sk);
          ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 7; ctx.fill(); ctx.shadowBlur = 0;
          ctx.restore();
        }
        if (w.ssFlightLbl !== false && f.ruf) {
          var fs = Math.max(8, 11 * sk);
          ctx.font = '600 ' + fs + 'px ui-monospace,monospace';
          ctx.fillStyle = nacht ? 'rgba(190,210,220,.75)' : col;
          ctx.fillText(f.ruf, q.x + 11 * sk, q.y + 3);

          /* Kleines Schild mit der Route unter dem Rufzeichen.
           *
           * Start und Ziel liegen ohnehin in derselben Antwort wie die Position
           * (der Server schlaegt sie bei adsbdb nach). Sie fehlen bei Privat- und
           * Militaermaschinen - dann bleibt das Schild einfach weg, statt eine
           * leere Huelse zu zeichnen.
           *
           * Bewusst nur die drei Buchstaben je Flughafen: die Ortsnamen ("Palma
           * De Mallorca - Warsaw") sind auf einer Kuppel mit fuenf Maschinen
           * laenger als der Abstand zwischen ihnen. */
          // Dieselbe Fassung wie auf der Flugkuppel - siehe flRoutenschild().
          if (w.ssFlightRoute !== false) {
            flRoutenschild(ctx, f, q.x + 11 * sk, q.y + 3 + fs * 1.05, fs, nacht);
          }
        }
        ctx.restore();
      });
    }
    /** Schlichte Flugzeugform, Nase nach oben - auf der Kuppel ist wenig Platz. */
    function ssFlugForm(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(0, -10 * s); ctx.lineTo(1.6 * s, -3.5 * s); ctx.lineTo(9.5 * s, 3.2 * s);
      ctx.lineTo(9.5 * s, 5.2 * s); ctx.lineTo(1.6 * s, 2.2 * s); ctx.lineTo(1.4 * s, 7.5 * s);
      ctx.lineTo(3.9 * s, 9.8 * s); ctx.lineTo(3.9 * s, 10.9 * s); ctx.lineTo(0, 9.8 * s);
      ctx.lineTo(-3.9 * s, 10.9 * s); ctx.lineTo(-3.9 * s, 9.8 * s); ctx.lineTo(-1.4 * s, 7.5 * s);
      ctx.lineTo(-1.6 * s, 2.2 * s); ctx.lineTo(-9.5 * s, 5.2 * s); ctx.lineTo(-9.5 * s, 3.2 * s);
      ctx.lineTo(-1.6 * s, -3.5 * s);
      ctx.closePath();
    }

    /* Satelliten auf der Kuppel - nur die SICHTBAREN.
     *
     * Ein Satellit ist nur zu sehen, wenn er im Sonnenlicht steht, waehrend hier
     * Dunkelheit herrscht. Genau das prueft satJetzt(); ohne diesen Filter waeren
     * es zwanzig Punkte, von denen man keinen am Himmel findet. Tagsueber bleibt
     * die Ebene deshalb von allein leer - das ist kein Fehler, das ist Physik.
     */
    var _ssSatPos = {};        // widgetId -> zuletzt gerechnete Satellitenpositionen

    /**
     * Satellitenpositionen im eigenen, langsamen Takt rechnen.
     *
     * Der Aufruf stand frueher mitten in ssSatelliten(), also im Zeichenweg, der
     * bei jeder Wertaenderung durchlaufen wird - dieselbe Falle wie in der
     * Flug-Himmelskuppel. Satelliten wandern sichtbar, aber nicht in
     * Millisekunden; alle 15 s reicht vollauf.
     */
    function ssSatTakt(w) {
      if (!_covOn2(w, 'ssSats', false) || typeof satJetzt !== 'function') { return; }
      var st = ssSt(w);
      if (st.satT) { return; }
      var hole = function () {
        var e = ssEl(w);
        if (!e || !document.body.contains(e)) { clearInterval(st.satT); st.satT = 0; return; }
        satJetzt(w.ssSatGroup || 'stations', ssGeo(w), function (L) {
          _ssSatPos[w.id] = L || [];
          // Neu zeichnen lassen. Die Rechnung ist asynchron (Bibliothek nachladen,
          // Bahnelemente holen) und war damit regelmaessig SPAETER fertig als das
          // letzte Bild - die Positionen lagen dann richtig im Speicher und wurden
          // nie gemalt. Die Kachel zeichnet nur bei Wertaenderung oder Bedienung
          // neu, und beides gibt es hier nicht.
          ssDrawBald(w, ssEl(w));
        }, false, ssNow(w));
      };
      hole();
      st.satT = setInterval(hole, 15000);
    }

    // Malt nur, was ssSatTakt zuletzt gerechnet hat.
    function ssSatelliten(ctx, cam, w, day) {
      if (!_covOn2(w, 'ssSats', false)) { return; }
      (function (L) {
        L.forEach(function (s) {
          if (!s.sichtbar || s.el < 6) { return; }
          var q = ssSky3(cam, s.az, s.el, cam.skyR);
          if (!q) { return; }
          var sk = Math.max(0.6, Math.min(1.6, cam.skyR / 90));
          ctx.save();
          ctx.beginPath(); ctx.arc(q.x, q.y, 2.6 * sk, 0, 7);
          ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#dfe9ea'; ctx.shadowBlur = 12 * sk; ctx.fill();
          ctx.shadowBlur = 0;
          ctx.font = '600 ' + Math.max(8, 10 * sk) + 'px ui-monospace,monospace';
          ctx.fillStyle = 'rgba(223,233,234,.85)';
          ctx.fillText(s.name, q.x + 9 * sk, q.y + 3);
          ctx.restore();
        });
      })(_ssSatPos[w.id] || []);
    }

    function ssMoonDisc(ctx, cam, K, sun, day, w, cloud) {
      if (!_covOn2(w, 'ssMoon', true)) return null;
      // Dieselbe Regel wie fuer die Sonne: hinter einer geschlossenen Decke ist er weg.
      // Wie bei der Sonne: der Mond wird bei dichter Decke matt, verschwindet aber nicht.
      var mcc = Math.max(0, Math.min(1, cloud || 0));
      var g = ssGeo(w), m = LVSUN.moon(g.lat, g.lon, ssNow(w) / 1000);
      if (m.elev < -1) return null;                            // unter dem Horizont
      var vis = Math.max(0, Math.min(1, (0.62 - day) / 0.45)) * Math.max(0.22, 1 - mcc * 0.9);  // Tag und Wolken
      if (vis <= 0.02) return m;
      var q = ssSky3(cam, m.az, m.elev, cam.skyR);
      var R = cam.rMoon;
      // Richtung zur Sonne auf dem Bildschirm - dorthin zeigt die beleuchtete Seite
      var sp = ssSky3(cam, sun.az, sun.elev, cam.skyR);
      var ang = Math.atan2(sp.y - q.y, sp.x - q.x);

      ctx.save();
      ctx.globalAlpha = vis;
      // Schein nur bei nennenswerter Beleuchtung
      if (m.fraction > 0.12) {
        var gl = ctx.createRadialGradient(q.x, q.y, R * 0.7, q.x, q.y, R * (2.2 + m.fraction * 2.2));
        gl.addColorStop(0, 'rgba(226,232,240,' + (0.16 * m.fraction).toFixed(3) + ')');
        gl.addColorStop(1, 'rgba(226,232,240,0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(q.x, q.y, R * (2.2 + m.fraction * 2.2), 0, 7); ctx.fill();
      }
      ctx.translate(q.x, q.y); ctx.rotate(ang);
      // Nachtseite: schwach angedeutet (Erdschein)
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 7);
      ctx.fillStyle = 'rgba(148,163,184,.14)'; ctx.fill();
      // Lichtseite: Halbkreis zur Sonne hin, dazu die Ellipse des Terminators.
      // Deren waagrechte Halbachse ist R * (2k-1); bei k<0,5 kippt sie zur Sichel.
      var c = 2 * m.fraction - 1;
      ctx.beginPath();
      ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
      // Gegenlaeufig schliessen: bei zunehmender Scheibe (c>0) ueber die Rueckseite,
      // bei der Sichel (c<0) zurueck ueber die Lichtseite - sonst bleibt die Scheibe halb.
      ctx.ellipse(0, 0, Math.abs(c) * R, R, 0, Math.PI / 2, -Math.PI / 2, c < 0);
      ctx.closePath();
      var mg = ctx.createLinearGradient(-R, -R, R, R);
      mg.addColorStop(0, '#e8eef7'); mg.addColorStop(1, '#fdfbf3');
      ctx.fillStyle = mg; ctx.fill();
      ctx.restore();
      return m;
    }

    /** Hoehe der Zeitleiste (0 = aus). */
    /**
     * Hoehe des Zeitleisten-Bands. Der Teiler war 5,6 - das Band nahm damit fast ein Fuenftel
     * der Kachel ein und draengte sich vor die Szene, um die es geht. Jetzt flacher (Teiler 8)
     * und einstellbar: ssStripPct ist ein PROZENTWERT der automatischen Hoehe, dieselbe Logik
     * wie bei den Schriftgroessen. Die Innenmasse des Bands haengen an seiner eigenen Hoehe,
     * es skaliert also mit; nur die Beschriftung folgt K und bleibt dadurch lesbar.
     */
    function ssStripH(w, K) {
      if (!_covOn2(w, 'ssStrip', true)) return 0;
      var pct = Math.max(50, Math.min(200, ssNum(w.ssStripPct, 100))) / 100;
      return Math.max(18, (K / 8) * pct);
    }

    /**
     * Zeitleiste mit Tageskurve. Die Flaeche zeigt die Sonnenhoehe ueber den Tag, die Nacht
     * liegt gedaempft dahinter; der Griff steht auf dem dargestellten Zeitpunkt. Ziehen
     * verschiebt die Zeit, Doppeltippen kehrt zu "jetzt" zurueck.
     */
    function ssStrip(ctx, W, H, Hs, K, w, track, pal) {
      var sh = H - Hs; if (sh <= 2) return;
      var pad = Math.max(5, K / 46), x0 = pad, x1 = W - pad;
      var y0 = Hs + pad * 0.5, y1 = H - pad * 0.5, bw = x1 - x0;
      sh = y1 - y0;
      // Schrift und Beschriftungslage haengen an der BANDHOEHE, nicht an K. Vorher galt
      // fs = K/40 bei einer Bandhoehe von K/5,6 - die Bedingung 0,16*sh >= fs ging damit
      // gerade noch auf. Sobald das Band flacher wird, schnitt die Maske die Beschriftung
      // oben ab. Jetzt ist sie an sh gedeckelt und wird von der Oberkante aus gesetzt.
      var fs = Math.max(7.5, Math.min(K / 40, sh * 0.26));
      var tTop = sh * 0.09, tBot = tTop + fs * 1.2;   // Textband innerhalb des Streifens
      var maxE = 1; track.forEach(function (p) { if (p.elev > maxE) maxE = p.elev; });

      ctx.save();
      // Untergrund
      var rr = sh * 0.28;
      ctx.beginPath();
      ctx.moveTo(x0 + rr, y0); ctx.arcTo(x1, y0, x1, y1, rr); ctx.arcTo(x1, y1, x0, y1, rr);
      ctx.arcTo(x0, y1, x0, y0, rr); ctx.arcTo(x0, y0, x1, y0, rr); ctx.closePath();
      // Kein Hintergrund - das Band bleibt durchsichtig, die Kachelfarbe scheint durch.
      // Die feine Umrandung bleibt als Begrenzung; der Pfad dient weiter als Maske, damit
      // Tageskurve und Marken nicht ueber das Band hinauslaufen.
      ctx.strokeStyle = ssA(pal.line, 0.55); ctx.lineWidth = Math.max(0.6, K / 1000); ctx.stroke();
      ctx.clip();

      // Tageskurve: gefuellte Flaeche der Sonnenhoehe
      var acc = pal.col(w.ssArcColor, '#ffd166');
      ctx.beginPath(); ctx.moveTo(x0, y1);
      track.forEach(function (p) {
        var x = x0 + bw * (p.min / 1440);
        var e = Math.max(0, p.elev) / maxE;
        ctx.lineTo(x, y1 - (sh * 0.55) * e - sh * 0.10);
      });
      ctx.lineTo(x1, y1); ctx.closePath();
      var gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, ssA(acc, 0.42)); gr.addColorStop(1, ssA(acc, 0.06));
      ctx.fillStyle = gr; ctx.fill();

      // Auf- und Untergang
      var rs = LVSUN.riseSet(track);
      ctx.font = ssFont(w, 'Tl', fs, pal);
      ctx.fillStyle = ssA(pal.muted, 0.95); ctx.textBaseline = 'top';
      var curM = (ssNow(w) - ssMidnight(w)) / 60000;
      [[rs.rise, '↑'], [rs.set, '↓']].forEach(function (o) {
        if (o[0] == null) return;
        var x = x0 + bw * (o[0] / 1440);
        if (Math.abs(o[0] - curM) < 90) return;      // liegt unter dem Griff - weglassen
        ctx.beginPath(); ctx.moveTo(x, y0 + tBot); ctx.lineTo(x, y1);
        ctx.strokeStyle = ssA(pal.muted, 0.35); ctx.lineWidth = Math.max(0.6, K / 1100); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(o[1] + ' ' + ssHM(o[0]), x, y0 + tTop);
      });

      // Griff auf dem dargestellten Zeitpunkt
      var cur = (ssNow(w) - ssMidnight(w)) / 60000;
      var hx = x0 + bw * Math.max(0, Math.min(1440, cur)) / 1440;
      ctx.beginPath(); ctx.moveTo(hx, y0 + tBot); ctx.lineTo(hx, y1);
      ctx.strokeStyle = pal.accent; ctx.lineWidth = Math.max(1.2, K / 420); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, y1 - sh * 0.12, Math.max(2.6, K / 150), 0, 7);
      ctx.fillStyle = pal.accent; ctx.fill();
      var lab = ssHM(cur) + ((_ssState[w.id] && _ssState[w.id].now) ? '' : '  jetzt');
      ctx.font = ssFont(w, 'Tl', fs * 1.12, pal, '600');
      var lw = ctx.measureText(lab).width;
      ctx.textAlign = (hx + lw / 2 + 6 > x1) ? 'right' : (hx - lw / 2 - 6 < x0 ? 'left' : 'center');
      ctx.fillStyle = pal.accent;
      ctx.fillText(lab, ctx.textAlign === 'center' ? hx : (ctx.textAlign === 'right' ? x1 - 4 : x0 + 4), y0 + tTop);
      ctx.restore();
    }
    function ssHM(min) {
      var m = Math.max(0, Math.min(1439, Math.round(min)));
      return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    }

    /** Namensnennung - bei Nutzung von OSM-Daten rechtlich vorgeschrieben (ODbL). */
    function ssAttrib(ctx, W, H, K, pal, inset, w) {
      ctx.save();
      ctx.font = ssFont(w, 'At', Math.max(8, K / 62), pal);
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = ssA(pal.muted, 0.7);
      ctx.fillText('Gebäude © OpenStreetMap-Mitwirkende', W - K / 42, H - K / 60 - (inset || 0));
      ctx.restore();
    }

    function ssSunDisc(ctx, cam, K, sun, clr, w, cloud) {
      if (sun.elev < -2) return;
      // Bei geschlossener Decke steht keine scharfe Scheibe am Himmel, sondern eine matte helle
      // Stelle. Frueher verschwand sie ab 85 % Bedeckung GANZ - dann fehlte die Sonne im Bild,
      // obwohl der Stand die Hauptaussage des Widgets ist. Jetzt bleibt sie immer sichtbar, nur
      // eben matt: die Helligkeit faellt mit der Bedeckung, hoert aber bei einem Rest auf.
      var cc = Math.max(0, Math.min(1, cloud || 0));
      var dim = Math.max(0.22, 1 - cc * 0.9);
      var R = cam.skyR, p = ssSky3(cam, sun.az, sun.elev, R);
      var base = cam.rSun, halo = base * (2.2 + (clr == null ? 1 : clr * 3.4));
      var gr = ctx.createRadialGradient(p.x, p.y, base * 0.3, p.x, p.y, halo);
      var a0 = (clr == null ? 0.55 : 0.35 + clr * 0.6);
      gr.addColorStop(0, 'rgba(255,240,200,' + Math.min(0.98, a0 + 0.3).toFixed(2) + ')');
      gr.addColorStop(0.34, 'rgba(255,201,64,' + (a0 * 0.5).toFixed(2) + ')');
      gr.addColorStop(1, 'rgba(255,180,0,0)');
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, halo, 0, 7); ctx.fill();
      if (cc > 0.25) { ctx.filter = 'blur(' + (K * 0.012 * cc).toFixed(1) + 'px)'; }
      ctx.fillStyle = sun.elev < 4 ? '#ffb765' : '#fff3cf';
      ctx.beginPath(); ctx.arc(p.x, p.y, base * (1 + cc * 0.5), 0, 7); ctx.fill();
      ctx.restore();
      if (sun.elev > 0.5 && _covOn2(w, 'ssRay', true)) {
        var h = cam.project(0, 0, ssNum(w.ssHouseH, 7.5) + ssNum(w.ssRoofH, 3.5));
        ctx.save(); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(h.x, h.y);
        ctx.strokeStyle = 'rgba(255,209,102,' + (clr == null ? 0.22 : 0.1 + clr * 0.32).toFixed(2) + ')';
        ctx.lineWidth = Math.max(1, K / 420); ctx.setLineDash([K / 150, K / 60]); ctx.stroke(); ctx.restore();
      }
    }
    /**
     * Kleiner Kompass: Ring, Nadel nach Norden, N an der Spitze, dazu drei feine Marken
     * fuer Ost/Sued/West. Dreht sich MIT der Szene - dieselbe Rechnung wie der Umgebungs-
     * ring (Winkel minus Kameradrehung), sonst zeigte er beim Ziehen woanders hin als
     * das Haus. Ohne ihn ist nach ein paar Drehungen nicht mehr klar, wo Norden liegt.
     */
    function ssCompass(ctx, cx, cy, r, bearing, pal) {
      var D = Math.PI / 180, rot = bearing * D;
      var nx = Math.sin(-rot), ny = -Math.cos(-rot);
      var px = -ny, py = nx, br = r * 0.24;                 // Querachse der Nadel
      ctx.save();
      ctx.lineWidth = Math.max(0.7, r / 19);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7);
      ctx.strokeStyle = ssA(pal.line, pal.light ? 0.7 : 0.55); ctx.stroke();
      [90, 180, 270].forEach(function (a) {                 // Ost / Sued / West
        var t = (a - bearing) * D, sx = Math.sin(t), sy = -Math.cos(t);
        ctx.beginPath();
        ctx.moveTo(cx + sx * (r - r * 0.16), cy + sy * (r - r * 0.16));
        ctx.lineTo(cx + sx * r, cy + sy * r);
        ctx.strokeStyle = ssA(pal.muted, 0.6); ctx.stroke();
      });
      ctx.beginPath();                                      // Nadel nach Norden
      ctx.moveTo(cx + nx * r * 0.66, cy + ny * r * 0.66);
      ctx.lineTo(cx + px * br, cy + py * br);
      ctx.lineTo(cx - px * br, cy - py * br);
      ctx.closePath(); ctx.fillStyle = pal.accent; ctx.fill();
      ctx.beginPath();                                      // Gegenspitze, dezent
      ctx.moveTo(cx - nx * r * 0.50, cy - ny * r * 0.50);
      ctx.lineTo(cx + px * br * 0.8, cy + py * br * 0.8);
      ctx.lineTo(cx - px * br * 0.8, cy - py * br * 0.8);
      ctx.closePath(); ctx.fillStyle = ssA(pal.muted, 0.55); ctx.fill();
      // Das N sitzt INNEN an der Spitze - aussen stiess es an die Uhrzeiten darueber.
      ctx.font = '700 ' + Math.max(7, Math.round(r * 0.52)) + 'px ' + (pal.ff || 'system-ui');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = pal.accent;
      ctx.fillText('N', cx + nx * r * 1.02, cy + ny * r * 1.02);
      ctx.restore();
    }

    // Beschriftung: alles in Bezug auf K -> skaliert mit der Kachel
    function ssLabels(ctx, W, H, K, sun, rad, clr, track, w, mn, pal, wx, cam, sonnenBahn) {
      if (!_covOn2(w, 'ssInfo', true)) return;
      var f = Math.max(9, K / 22), pad = K / 26;
      ctx.save();
      ctx.font = ssFont(w, 'Hd', f, pal);
      ctx.fillStyle = ssA(pal.text, 0.94); ctx.textBaseline = 'top';
      // Steht die Sonne unter dem Horizont, uebernimmt der Mond die Kopfzeile.
      var nacht = (sun.elev < -1 && mn && mn.elev > -1);
      var t1 = nacht ? ('Mond ' + mn.elev.toFixed(0) + '°')
                     : ((sun.elev >= 0 ? 'Sonne ' + sun.elev.toFixed(0) + '°' : 'unter dem Horizont'));
      ctx.fillText(t1, pad, pad);
      ctx.font = ssFont(w, 'Sb', f * 0.72, pal);
      ctx.fillStyle = ssA(pal.muted, 0.95);
      var t2;
      if (nacht) {
        t2 = LVSUN.moonName(mn.phase) + '  ·  ' + Math.round(mn.fraction * 100) + ' % beleuchtet';
        // Wetter gehoert auch in die Nachtzeile. Es hoert um acht Uhr abends nicht
        // auf zu regnen, und wer nachts auf die Kachel sieht, will genau das wissen.
        //
        // Ausgelassen wird nur, was ohne Sonne nicht existiert: die Einstrahlung in
        // W/m2 und eine AUS IHR gerechnete Bewoelkung. Kommt der Bedeckungsgrad
        // dagegen aus einer eigenen Variablen oder der Vorhersage, gilt er nachts
        // genauso - dann steht er auch da.
        if (wx && wx.cloudSrc && wx.cloudSrc !== 'Strahlung') {
          var kn = Math.round((1 - wx.cloud) * 100);
          t2 += '  ·  ' + kn + ' % klar / ' + (100 - kn) + ' % bewölkt';
        }
        var nn = ssWxText(wx);
        if (nn) t2 += '  ·  ' + nn;
      } else {
        t2 = 'Azimut ' + sun.az.toFixed(0) + '°';
        if (rad != null) t2 += '  ·  ' + Math.round(rad) + ' W/m²';
        // Klarheit und ihr Gegenstueck. ACHTUNG: 100 - klar ist die TRUEBUNG des Lichts, nicht
        // der modellierte Bedeckungsgrad - der wird nach Kasten & Czeplak gerechnet und faellt
        // hoeher aus (kt 0,89 entspricht 56 % Bedeckung, nicht 11 %). Hier steht bewusst das
        // Gegenstueck zum daneben angezeigten Messwert, damit sich beide Zahlen zu 100 ergaenzen.
        if (clr != null) {
          var kp = Math.round(clr * 100);
          t2 += '  ·  ' + kp + ' % klar / ' + (100 - kp) + ' % bewölkt';
        }
        // Niederschlag im Klartext. Unter 0,5 mm/h steht bewusst KEINE Zahl: dort greift der
        // Rueckfall ueber den Regensensor mit einem gesetzten Ersatzwert (0,25) - eine Zahl
        // waere erfunden. Darueber ist es ein echter Messwert und wird auch als solcher genannt.
        var np = ssWxText(wx);
        if (np) t2 += '  ·  ' + np;
      }
      ctx.fillText(t2, pad, pad + f * 1.15);
      var rs = LVSUN.riseSet(sonnenBahn || track);
      if (rs.rise != null && rs.set != null) {
        ctx.font = ssFont(w, 'Rs', f * 0.72, pal);
        var hm = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0'); };
        var t3 = '↑ ' + hm(rs.rise) + '   ↓ ' + hm(rs.set);
        ctx.textAlign = 'right'; ctx.fillText(t3, W - pad, pad);
        // Kompass direkt darunter, rechtsbuendig zur Zeitzeile.
        if (cam && _covOn2(w, 'ssCompass', true)) {
          var cr = Math.max(9, f * 0.80);
          var ccx = W - pad - cr, ccy = pad + f * 0.72 + f * 0.45 + cr;
          ssCompass(ctx, ccx, ccy, cr, cam.bearing, pal);
          // Trefferflaeche merken: der Kompass IST der Nord-Knopf. Ein eigenes Knopf-Element
          // laege zwangslaeufig auf einer der Anzeigen - hier auf der Sonnen-Zeile.
          ssSt(w).hit = { x: ccx, y: ccy, r: cr * 1.9 };
        }
      }
      ctx.restore();
    }

    /**
     * Wetterlage als Klartext: Niederschlag, sonst Nebel.
     *
     * Gemeinsam fuer Tag und Nacht - beide Zeilen sollen dieselbe Sprache
     * sprechen. Nebel steht nur da, wenn es nicht ohnehin niederschlaegt; beides
     * gleichzeitig zu nennen, sagt nichts mehr, was man nicht schon sieht.
     */
    function ssWxText(wx) {
      var np = ssPrecipText(wx);
      if (np) return np;
      // Die STUFE ist massgeblich, nicht die Dichte. Frueher rechnete diese Karte aus
      // der Nebeldichte mit eigenen Schwellen (>0,5 dicht, >0,22 Nebel) - und sagte damit
      // "dichter Nebel", waehrend Wetter+ aus derselben Lage "Morgendunst" machte. Ist die
      // Stufe gebunden, gilt sie; die Dichte bleibt nur der Rueckfall fuer Aufbauten ohne
      // Wetterstation.
      if (wx && wx.fogState !== null && wx.fogState !== undefined) {
        return lvNebelText(wx.fogState);
      }
      if (wx && wx.fog > 0.05) {
        return wx.fog > 0.5 ? 'Dichter Nebel' : (wx.fog > 0.22 ? 'Nebel' : 'Diesig');
      }
      return '';
    }

    /** Niederschlag als Klartext fuer die Kopfzeile: Art, Staerke und - wenn gemessen - Menge. */
    function ssPrecipText(wx) {
      if (!wx) return '';
      var sn = +(wx.snow || 0), rn = +(wx.rain || 0);
      var num = function (v) { return v.toFixed(1).replace('.', ',') + ' mm/h'; };
      if (sn > 0.01) {
        if (sn < 0.5) return 'leichter Schneefall';
        return (sn < 2.5 ? 'Schneefall ' : sn < 10 ? 'kräftiger Schneefall ' : 'starker Schneefall ') + num(sn);
      }
      if (rn > 0.01) {
        if (rn < 0.5) return 'es nieselt';
        return (rn < 2.5 ? 'leichter Regen ' : rn < 10 ? 'Regen ' : 'starker Regen ') + num(rn);
      }
      return '';
    }

    // Hilfsfunktionen (eigen, damit das Widget unabhaengig bleibt)
    function _covCol2(v) { return v ? ((typeof _skinColor === 'function' && _skinColor(v)) || v) : ''; }
    function _covOn2(w, k, def) { return (w[k] !== undefined) ? !!w[k] : def; }
    function hex2rgb(h) {
      h = String(h || '').trim();
      if (h.charAt(0) === '#') { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
      var m = h.match(/rgba?\(([^)]+)\)/); if (m) { var p = m[1].split(','); return [+p[0], +p[1], +p[2]]; }
      return [0, 205, 171];
    }
    function tint(col, l) { var c = hex2rgb(col); l = Math.max(0, Math.min(1.25, l)); return 'rgb(' + Math.round(c[0] * l) + ',' + Math.round(c[1] * l) + ',' + Math.round(c[2] * l) + ')'; }
    function mix(a, b, t) { var x = hex2rgb(a), y = hex2rgb(b); t = Math.max(0, Math.min(1, t)); return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')'; }

    // ---- Interaktion: seitlich ziehen dreht, senkrecht kippt (Seite scrollt weiter) ----
    function ssBind(w, el) {
      var box = $('[data-role=ssbox]', el); if (!box) return;
      var st = ssSt(w);
      box.onpointerdown = function (e) {
        if (typeof editing !== 'undefined' && editing) return;
        var r = box.getBoundingClientRect(), K = Math.min(r.width, r.height);
        var sh = ssStripH(w, K);
        if (sh && (e.clientY - r.top) > r.height - sh) {
          st.drag = { time: true, rect: r };                    // Zug auf der Zeitleiste
          ssSetTime(w, el, e.clientX, r, K);
          try { box.setPointerCapture(e.pointerId); } catch (_) {}
          e.preventDefault();
          return;
        }
        // Kompass angetippt? -> Ansicht nach Norden drehen (kein Ziehen beginnen).
        var hb = st.hit;
        if (hb && !(typeof editing !== 'undefined' && editing)) {
          var rc = box.getBoundingClientRect();
          var sc = rc.width ? (box.firstElementChild ? box.firstElementChild.width / (window.devicePixelRatio || 1) / rc.width : 1) : 1;
          var mx = (e.clientX - rc.left) * (sc || 1), my = (e.clientY - rc.top) * (sc || 1);
          if (Math.abs(mx - hb.x) <= hb.r && Math.abs(my - hb.y) <= hb.r) { ssResetView(w, el); e.preventDefault(); return; }
        }
        st.drag = { x: e.clientX, y: e.clientY, b: st.bearing != null ? st.bearing : ssNum(w.ssBearing, 20),
                    p: st.pitch != null ? st.pitch : ssNum(w.ssPitch, 52), axis: null };
        try { box.setPointerCapture(e.pointerId); } catch (_) {}
      };
      box.onpointermove = function (e) {
        if (!st.drag) return;
        if (st.drag.time) {
          var r2 = st.drag.rect;
          ssSetTime(w, el, e.clientX, r2, Math.min(r2.width, r2.height));
          e.preventDefault(); return;
        }
        var dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
        if (!st.drag.axis) {
          if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
          st.drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';   // Richtung des ersten Impulses entscheidet
          if (st.drag.axis === 'v') {                                 // senkrecht -> Seite scrollen lassen
            // Erfassung ZWINGEND freigeben. Ohne das blieb sie nach jedem senkrechten
            // Wisch ueber der Kachel haengen, und ab da gingen ALLE Beruehrungen der
            // Seite an dieses eine Element: leerer Schirm, nichts reagiert, die Uhr
            // tickt weiter, Drehen half nicht - nur ein harter Neuladen. Auf einem
            // Telefon trifft die Wischgeste diese grosse Kachel fast zwangslaeufig.
            try { box.releasePointerCapture(e.pointerId); } catch (_) {}
            st.drag = null; return;
          }
        }
        st.bearing = ((st.drag.b - dx * 0.4) % 360 + 360) % 360;
        e.preventDefault(); ssDraw(w, el);
      };
      /* Nach einem echten Zug den folgenden Klick verschlucken.
       *
       * Das Drehen laeuft ueber Zeiger-Ereignisse, ein hinterlegtes Seitenziel
       * (navTo) ueber 'click'. Ohne diesen Riegel wuerde jedes Drehen der Kamera
       * auch die verlinkte Seite oeffnen - man koennte die Szene nicht mehr
       * bedienen, ohne sie zu verlassen. Vier Pixel Toleranz, damit ein
       * zitteriger Klick weiterhin als Klick zaehlt. */
      function up(e) {
        // Zuerst und bedingungslos freigeben: der Zug kann vorher schon verworfen
        // worden sein (senkrechter Wisch), die Erfassung liegt dann trotzdem an.
        try { box.releasePointerCapture(e.pointerId); } catch (_) {}
        if (st.drag) {
          var gezogen = !st.drag.time
            && (Math.abs((e.clientX || 0) - st.drag.x) > 4 || Math.abs((e.clientY || 0) - st.drag.y) > 4);
          st.drag = null;
          try { box.releasePointerCapture(e.pointerId); } catch (_) {}
          ssSaveView(w);
          if (gezogen) {
            var schluck = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
            box.addEventListener('click', schluck, { capture: true, once: true });
            setTimeout(function () { box.removeEventListener('click', schluck, true); }, 350);
          }
        }
      }
      box.onpointerup = up; box.onpointercancel = up;

      // Mausrad zoomt den Umkreis. Nur wenn das Widget schon gedreht/bedient wurde oder
      // die Taste Strg gehalten wird - sonst wuerde Scrollen ueber der Kachel haengen bleiben.
      box.onwheel = function (e) {
        if (typeof editing !== 'undefined' && editing) return;
        if (!e.ctrlKey && st.radius == null && st.bearing == null) return;
        var r = st.radius != null ? st.radius : ssNum(w.ssRadius, 55);
        st.radius = Math.max(20, Math.min(400, r * (e.deltaY > 0 ? 1.12 : 0.89)));
        e.preventDefault(); ssDraw(w, el); ssSaveView(w);
      };
      // Doppeltippen stellt die eingestellte Ansicht wieder her.
      box.ondblclick = function () {
        if (typeof editing !== 'undefined' && editing) return;
        ssResetView(w, el);
      };
    }



    // ===================== Wetter =====================
    //  Regen, Schnee und Nebel liegen ueber der Szene. Gebunden werden EINZELNE Variablen -
    //  so laeuft es mit jeder Wetterquelle (Tempest, Davis, Open-Meteo, eigener Sensor) und
    //  haengt nicht an einem bestimmten JSON-Format.

    /** Zahlenwert samt Einheit der Variablen - die Einheit entscheidet die Umrechnung. */
    function ssUnit(vid) {
      var d = vid && _lastVals[vid]; if (!d) return '';
      return (d.u != null ? String(d.u) : '').trim().toLowerCase();
    }
    /** Wetterlage aus den gebundenen Variablen. Alles einzeln optional. */
    function ssWx(w) {
      var rain = ssVal(w.ssRainV), snow = ssVal(w.ssSnowV);
      // Ein Regensensor spricht frueher an als das Wippen-Messwerk der Station: bei
      // Nieselregen meldet er "es regnet", waehrend die Intensitaet noch 0,0 mm/h zeigt.
      // Dann wird ein leichter Niesel dargestellt statt gar nichts.
      var sens = ssVal(w.ssRainSensV);
      if (sens != null && sens > 0 && !(rain > 0.05) && !(snow > 0.05)) { rain = 0.25; }
      var fogRaw = ssVal(w.ssFogV), wind = ssVal(w.ssWindV);
      var typ = ssVal(w.ssPtypeV);
      // Die Tempest-Typkennung kennt KEINEN Schnee: 0 = keiner, 1 = Regen, 2 = Hagel (am Geraet
      // als Profil "Tempest_perception_type" so hinterlegt). Hier stand frueher "ab 2 ist es
      // Schnee" - bei Hagel wurde also Schnee gezeichnet. Die Kennung sagt jetzt nur noch, DASS
      // es niederschlaegt; ob Regen oder Schnee entscheidet weiter unten die Feuchtkugel.
      if (typ != null && typ > 0 && !(rain > 0.05) && !(snow > 0.05)) { rain = 0.25; }

      // Schnee ableiten, wenn keine eigene Schnee-Variable gebunden ist. Massgeblich ist die
      // FEUCHTKUGELtemperatur, nicht die Lufttemperatur: eine fallende Flocke kuehlt sich durch
      // Verdunstung selbst, in trockener Luft faellt Schnee daher noch bei +3 °C Luft. Fehlt
      // eine gemessene Feuchtkugel, wird sie aus Temperatur und Luftfeuchte gerechnet (Stull
      // 2011). Zwischen 0,5 und 1,5 °C ist es Schneeregen - beides wird anteilig gezeichnet.
      if (snow == null && rain > 0.01) {
        var tw = ssVal(w.ssWetV);
        if (tw == null) tw = ssWetBulb(ssVal(w.ssTempV), ssVal(w.ssHumV));
        if (tw != null) {
          var sf = Math.max(0, Math.min(1, (1.5 - tw) / 1.0));
          if (sf > 0) { snow = rain * sf; rain = rain * (1 - sf); }
        }
      }
      var fog = null;
      if (fogRaw != null) {
        // Sichtweite in Metern (grosse Zahl) oder ein Anteil 0..1 bzw. 0..100.
        // Die EINHEIT entscheidet, nicht die Groesse: eine Nebeldichte von 40 % waere sonst
        // als 40 m Sichtweite gelesen worden. Nur ohne Einheitshinweis gilt die alte Regel
        // "grosse Zahl = Meter".
        var fu = ssUnit(w.ssFogV);
        if (fu.indexOf('%') >= 0) fog = Math.max(0, Math.min(1, fogRaw / 100));
        else if (fu.indexOf('m') >= 0 && fu.indexOf('%') < 0) fog = Math.max(0, Math.min(1, 1 - fogRaw / (fu.indexOf('km') >= 0 ? 2 : 2000)));
        else if (fogRaw > 5) fog = Math.max(0, Math.min(1, 1 - fogRaw / 2000));
        else if (fogRaw > 1) fog = Math.max(0, Math.min(1, fogRaw / 100));
        else fog = Math.max(0, Math.min(1, fogRaw));
      } else {
        fog = ssFogEst(ssVal(w.ssTempV), ssVal(w.ssDewV), ssVal(w.ssHumV));
        // Wind loest Nebel auf: die bodennahe Schicht wird durchmischt und die feuchte Luft
        // von trockenerer ersetzt. Ueber etwa 10 km/h haelt sich Nebel kaum, ab 25 km/h gar
        // nicht. Gilt nur fuer die SCHAETZUNG - ein echter Sichtsensor misst, was ist.
        if (fog != null && wind != null) {
          var wu = ssUnit(w.ssWindV);
          var wkmh = (wu.indexOf('kn') >= 0) ? wind * 1.852
                   : (wu.indexOf('mph') >= 0) ? wind * 1.609
                   : (wu.indexOf('m/s') >= 0 || wu === 'ms') ? wind * 3.6
                   : wind;                                   // km/h ist der Normalfall
          fog *= Math.max(0, Math.min(1, (25 - wkmh) / 15));
        }
      }
      // ZUSTAND SCHLAEGT DICHTE.
      //
      // Eine "Nebeldichte" ist eine Neigung, kein Wetter: bei 90 % Luftfeuchte und 1,6 K
      // Taupunktabstand steht sie berechtigt bei 28 %, draussen ist es trotzdem klar. Wer die
      // Dichte allein bindet, sieht deshalb Nebel, wo keiner ist - das Widget zeichnet ab 2 %.
      // Ist eine Zustandsvariable gebunden (die Nebel-Entscheidung der Wetterstation), hat sie
      // das letzte Wort: meldet sie "kein Nebel", bleibt die Szene klar; meldet sie Nebel,
      // bestimmt die Dichte weiterhin, WIE dicht gezeichnet wird - und wenn keine Dichte
      // gebunden ist, steht die Stufe selbst fuer die Staerke.
      var fogState = ssVal(w.ssFogStateV);
      if (fogState != null) {
        var an = (typeof fogState === 'boolean') ? (fogState ? 1 : 0) : Number(fogState);
        if (!(an > 0)) {
          fog = 0;
        } else if (fogRaw == null) {
          fog = Math.max(0, Math.min(1, an > 1 ? an / 3 : an));   // Stufe 1..3 als Staerke
        } else {
          // DIE STUFE DECKELT AUCH DAS BILD, nicht nur den Text.
          //
          // Die Dichte ist eine Neigung und laeuft der Stufe voraus: am 26.08.2026 stand sie
          // bei 38 %, waehrend die Wetterstation laengst "diesig" (Stufe 1) meldete. Ungedeckelt
          // zeichnete die Szene daraus eine Nebelwand - die Karte sagte "Morgendunst" und zeigte
          // dichten Nebel. Wer beides nebeneinander sieht, glaubt dem Bild.
          //
          // Also gibt die Stufe die Obergrenze vor, und die Dichte darf innerhalb davon
          // abstufen: Stufe 1 bleibt ein Schleier, Stufe 2 eine spuerbare Truebung, erst
          // Stufe 3 darf zumachen.
          var kappe = (an >= 3) ? 1.0 : ((an >= 2) ? 0.45 : 0.16);
          fog = Math.min(fog, kappe);
        }
      }
      // Bewoelkung aus der besten verfuegbaren Quelle. Reihenfolge bewusst so:
      //  1. aus der gemessenen Strahlung - der oertlichste Wert ueberhaupt, direkt vom
      //     eigenen Dach, ohne jede Fremdquelle. Geht nur bei Sonne ueber 5 Grad.
      //  2. eine gebundene Bewoelkungsvariable (meist ein Dienst wie OpenWeatherMap).
      //  3. die Stundenvorhersage aus dem Wetter-JSON - vor allem fuer die Nacht, wo aus
      //     der Strahlung nichts folgt.
      //  4. Niederschlag als Untergrenze: es kann nicht regnen und blau sein.
      var cloud = null, cloudSrc = '';
      var mode = w.ssCloudSrc || 'auto';
      var rad = ssVal(w.ssRad);
      if (mode === 'auto' || mode === 'rad') {
        var g = ssGeo(w), sp = ssSun(w);
        var cr = LVSUN.cloudFromRad(rad, sp.elev);
        if (cr != null) { cloud = cr; cloudSrc = 'Strahlung'; }
      }
      if (cloud == null && (mode === 'auto' || mode === 'var')) {
        var cl = ssVal(w.ssCloudV);
        if (cl != null) { cloud = Math.max(0, Math.min(1, cl > 1 ? cl / 100 : cl)); cloudSrc = 'Variable'; }
      }
      if (cloud == null && (mode === 'auto' || mode === 'fc')) {
        var fc = ssWxForecast(w);
        if (fc && fc.cloud != null) { cloud = fc.cloud; cloudSrc = 'Vorhersage'; }
        // MESSUNG SCHLAEGT VORHERSAGE.
        //
        // Der Rueckfall auf die Vorhersage ist fuer den Fall gedacht, dass gar nichts gemessen
        // wird - dann ist eine Vorhersage besser als ein leerer Himmel. Er darf aber nicht
        // greifen, wenn ein gebundener Sensor ausdruecklich "kein Niederschlag" meldet: dann
        // zeichnete die Szene Nieselregen, waehrend Station, Regendetektor und Niederschlagsart
        // uebereinstimmend trocken sagten - und die Wetterkarte daneben "klar" anzeigte.
        // Genau dieser Widerspruch war am 18.08.2026 zu sehen.
        var gemessen = (ssVal(w.ssRainV) != null) || (ssVal(w.ssRainSensV) != null)
                    || (ssVal(w.ssPtypeV) != null) || (ssVal(w.ssSnowV) != null);
        if (fc && !gemessen) {
          if (!(rain > 0.01) && fc.rain > 0.01) { rain = fc.rain; }
          if (!(snow > 0.01) && fc.snow > 0.01) { snow = fc.snow; }
        }
      }
      var min = (snow > 0.01) ? 0.92 : (rain > 0.05) ? 0.85 : (rain > 0.01) ? 0.6
              : (fog > 0.15) ? 0.55 : 0;
      if (min > 0) { cloud = (cloud == null) ? min : Math.max(cloud, min); }

      var nass = (rain > 0.01) || (snow > 0.01) || (fog > 0.02);
      if (!nass && cloud == null) return null;
      // Wind in m/s. Die EINHEIT entscheidet, nicht die Groesse: eine Davis-Station meldet
      // km/h und liegt meist unter 40 - eine Schwelle haette das als m/s gelesen und den
      // Regen viel zu steil geneigt.
      var ws = 0;
      if (wind != null) {
        var u = ssUnit(w.ssWindV);
        ws = (u.indexOf('km') >= 0) ? wind / 3.6
           : (u.indexOf('kn') >= 0) ? wind * 0.5144
           : (u.indexOf('mph') >= 0) ? wind * 0.447
           : wind;                                    // m/s oder ohne Einheit
      }
      // Gewitter kommt aus der eigenen Ableitung (HomeSuite\Wetter): Stufe 0-3 und die
      // Entfernung des letzten Blitzes. Ohne Bindung bleibt es bei 0 - dann zeichnet die
      // Szene auch kein Gewitter, statt eines zu erfinden.
      var storm = ssVal(w.ssStormV), sdist = ssVal(w.ssStormDistV);
      return { rain: rain || 0, snow: snow || 0, fog: fog || 0, fogState: fogState, wind: ws,
               storm: Math.max(0, Math.min(3, Math.round(storm || 0))), stormDist: sdist,
               cloud: cloud == null ? 0 : cloud, cloudSrc: cloudSrc, nass: nass };
    }

    /**
     * Nebel abschaetzen, wenn kein Sichtweitensensor da ist.
     *  Grundlage ist die Taupunktdifferenz: je naeher die Lufttemperatur am Taupunkt liegt,
     *  desto eher kondensiert die Luft. Faustregel aus der Wetterbeobachtung - unter etwa
     *  0,5 K Abstand ist Nebel wahrscheinlich, ab rund 2,5 K nicht mehr.
     *  Ohne Taupunkt dient die Luftfeuchte als schwaecherer Ersatz.
     *  Das Ergebnis ist bewusst auf 0,85 gedeckelt: es ist eine Abschaetzung, kein Messwert,
     *  und soll die Szene nie voellig zumachen.
     */
    /**
     * Feuchtkugeltemperatur aus Lufttemperatur und relativer Feuchte, Naeherung nach
     * Stull (2011). Gilt fuer etwa -20..+50 °C und 5..99 % Feuchte - fuer die Frage
     * "Regen oder Schnee" mehr als genau genug (Fehler unter 0,3 K).
     */
    function ssWetBulb(t, rh) {
      if (t == null || rh == null) return null;
      rh = Math.max(1, Math.min(100, rh));
      return t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659))
           + Math.atan(t + rh) - Math.atan(rh - 1.676331)
           + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
    }

    function ssFogEst(t, td, rh) {
      if (t != null && td != null) {
        var spread = t - td;
        if (!(spread < 2.5)) return null;
        var f = (2.5 - spread) / 2.0;
        if (rh != null && rh < 90) { f *= Math.max(0, (rh - 75) / 15); }   // trockene Luft daempft
        return Math.max(0, Math.min(0.85, f));
      }
      if (rh != null) {
        if (rh < 95) return null;
        return Math.max(0, Math.min(0.85, (rh - 95) / 5 * 0.6 + 0.25));
      }
      return null;
    }


    /**
     * Wetter-JSON einer beliebigen Quelle fuer die AKTUELLE Stunde auslesen.
     *  Gedacht als Rueckfall fuer Werte, die es als Messwert nicht gibt - allen voran die
     *  Bewoelkung nachts, wenn sich aus der Strahlung nichts ableiten laesst.
     *  Quelle ist OpenWeatherMap One Call (hourly[].clouds in Prozent, .rain['1h'],
     *  .snow['1h'], .visibility in Metern).
     *  Symcon liefert manche Wettervariablen PHP-serialisiert statt als JSON - dafuer gibt
     *  es einen schlanken Entpacker, weil JSON.parse daran scheitert.
     */
    var _ssWxCache = { raw: null, out: null };
    function ssWxForecast(w) {
      var vid = w.ssWxJson; if (!vid) return null;
      var d = _lastVals[vid]; if (!d || d.v == null) return null;
      var raw = String(d.v);
      if (_ssWxCache.raw === raw) return _ssWxCache.out;     // je Abruf nur einmal auswerten
      var o = null;
      try { o = ssWxDecode(raw); } catch (e) { o = null; }
      var res = o ? ssWxPick(o) : null;
      _ssWxCache = { raw: raw, out: res };
      return res;
    }
    /** JSON oder PHP-serialisiert entpacken. */
    function ssWxDecode(raw) {
      var t = raw.replace(/^\s+/, '');
      if (t.charAt(0) === '{' || t.charAt(0) === '[') return JSON.parse(t);
      if (/^a:\d+:\{/.test(t)) return ssPhpUnserialize(t);
      return null;
    }
    /** Sehr schlanker Entpacker fuer PHP-serialisierte Arrays/Skalare. */
    function ssPhpUnserialize(str) {
      var i = 0;
      function val() {
        var t = str.charAt(i);
        if (t === 'N') { i += 2; return null; }
        if (t === 'b') { var b = str.charAt(i + 2) === '1'; i = str.indexOf(';', i) + 1; return b; }
        if (t === 'i' || t === 'd') {
          var e = str.indexOf(';', i); var n = parseFloat(str.slice(i + 2, e)); i = e + 1; return n;
        }
        if (t === 's') {
          var c1 = str.indexOf(':', i + 2), len = parseInt(str.slice(i + 2, c1), 10);
          var st = c1 + 2, sv = str.substr(st, len); i = st + len + 2; return sv;
        }
        if (t === 'a') {
          var c2 = str.indexOf(':', i + 2), cnt = parseInt(str.slice(i + 2, c2), 10);
          i = str.indexOf('{', i) + 1;
          var arr = {}, allNum = true;
          for (var k = 0; k < cnt; k++) {
            var key = val(), v2 = val();
            arr[key] = v2; if (typeof key !== 'number') allNum = false;
          }
          i++;                                              // schliessende Klammer
          if (allNum) { var out = []; Object.keys(arr).forEach(function (k2) { out[+k2] = arr[k2]; }); return out; }
          return arr;
        }
        return null;
      }
      return val();
    }
    /**
     * Aus dem entpackten OpenWeatherMap-One-Call die Stunde ziehen, die dem Jetzt am
     * naechsten liegt.
     *
     * Bewusst NUR OpenWeatherMap. Tempest kaeme als zweite Quelle nicht in Frage: die
     * Station liefert hier gar keine Vorhersage (nur UDP-Rohbeobachtungen) und misst
     * grundsaetzlich keinen Bewoelkungsgrad - ihr Beitrag ist die Solarstrahlung, und die
     * ist ohnehin schon die erste Quelle. Ein Wildwuchs an Formaten waere also Aufwand
     * ohne Gegenwert; ein Anbieter, ein Weg, nachvollziehbares Ergebnis.
     */
    function ssWxPick(o) {
      var list = o && o.hourly;
      if (!list || !list.length || !list[0] || list[0].dt == null) return null;
      var nowSec = Date.now() / 1000, pick = null, dt = 1e9;
      for (var i = 0; i < list.length; i++) {
        var d = Math.abs(list[i].dt - nowSec);
        if (d < dt) { dt = d; pick = list[i]; }
      }
      // Mehr als 1,5 Stunden daneben heisst: der Datensatz ist veraltet oder lueckenhaft.
      if (!pick || dt > 5400) return null;
      return {
        cloud: (pick.clouds == null) ? null : Math.max(0, Math.min(1, pick.clouds / 100)),
        rain: pick.rain ? (pick.rain['1h'] || 0) : 0,
        snow: pick.snow ? (pick.snow['1h'] || 0) : 0,
        vis: (pick.visibility != null) ? pick.visibility : null,
        src: 'OpenWeatherMap'
      };
    }

    /** Streuwert 0..1 aus einer Zahl - fuer immer gleiche Tropfenbahnen ohne Zustand. */
    function ssRnd(i, k) {
      var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    }

    /**
     * Niederschlag und Nebel zeichnen.
     *  Der Nebel liegt als Schleier ueber dem Bild, unten dichter - so wie er sich am Boden
     *  sammelt. Regen und Schnee sind Bahnen aus einem festen Streumuster, ihre Lage ergibt
     *  sich allein aus der Zeit; damit braucht es keinen Teilchenspeicher.
     */
    function ssWeatherDraw(ctx, W, H, K, wx, tSec, pal, day) {
      // --- Nebel ---
      if (wx.fog > 0.02) {
        var f = Math.min(1, wx.fog);
        var col = pal.light ? '250,251,253' : '176,190,207';
        ctx.save();
        // Grundschleier: oben duenn, unten dicht - Nebel sammelt sich am Boden
        var gr = ctx.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, 'rgba(' + col + ',' + (0.10 * f).toFixed(3) + ')');
        gr.addColorStop(0.30, 'rgba(' + col + ',' + (0.34 * f).toFixed(3) + ')');
        gr.addColorStop(0.68, 'rgba(' + col + ',' + (0.66 * f).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(' + col + ',' + (0.76 * f).toFixed(3) + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        // Helles Band am Horizont - dort verschwindet die Sicht zuerst
        var hz = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.72);
        hz.addColorStop(0, 'rgba(' + col + ',0)');
        hz.addColorStop(0.5, 'rgba(' + col + ',' + (0.42 * f).toFixed(3) + ')');
        hz.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = hz; ctx.fillRect(0, H * 0.42, W, H * 0.30);
        // drei ziehende Schwaden
        for (var b = 0; b < 3; b++) {
          var yb = H * (0.48 + b * 0.16) + Math.sin(tSec * 0.05 + b * 2.1) * H * 0.025;
          var xb = ((tSec * (7 + b * 4) + b * 500) % (W * 2.2)) - W * 0.6;
          var g2 = ctx.createRadialGradient(xb, yb, 0, xb, yb, W * 0.48);
          g2.addColorStop(0, 'rgba(' + col + ',' + (0.30 * f).toFixed(3) + ')');
          g2.addColorStop(1, 'rgba(' + col + ',0)');
          ctx.fillStyle = g2; ctx.fillRect(0, yb - H * 0.3, W, H * 0.6);
        }
        ctx.restore();
      }

      // --- Regen ---
      if (wx.rain > 0.01) {
        var n = Math.round(Math.max(24, Math.min(320, wx.rain * 55)));
        var len = K * 0.075, sp = 1.35 + Math.min(1.2, wx.rain / 8);
        var tilt = Math.max(-0.55, Math.min(0.55, wx.wind / 22));
        ctx.save();
        ctx.strokeStyle = pal.light ? 'rgba(90,120,150,.42)' : 'rgba(190,215,240,.42)';
        ctx.lineWidth = Math.max(0.7, K / 700); ctx.lineCap = 'round';
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var ph = ssRnd(i, 1), dep = 0.55 + ssRnd(i, 2) * 0.75;
          var x0 = ssRnd(i, 3) * (W * 1.4) - W * 0.2;
          var y0 = (((tSec * sp * dep + ph) % 1) * (H + len)) - len;
          x0 += tilt * y0;
          ctx.moveTo(x0, y0); ctx.lineTo(x0 + tilt * len, y0 + len * dep);
        }
        ctx.stroke(); ctx.restore();
      }

      // --- Schnee ---
      if (wx.snow > 0.01) {
        var m = Math.round(Math.max(45, Math.min(420, wx.snow * 110)));
        var sps = 0.13 + Math.min(0.16, wx.snow / 24);
        var dr = Math.max(-0.6, Math.min(0.6, wx.wind / 22));
        ctx.save();
        // Flocken sind IMMER weiss - auch auf hellem Himmel. Damit sie dort nicht
        // verschwinden, bekommen sie einen weichen dunklen Saum statt einer grauen Fuellung.
        ctx.fillStyle = '#ffffff';
        if (pal.light) { ctx.shadowColor = 'rgba(60,80,105,.55)'; ctx.shadowBlur = K / 260; }
        for (var j = 0; j < m; j++) {
          var p2 = ssRnd(j, 4), dp = 0.45 + ssRnd(j, 5) * 0.95;
          var yy = (((tSec * sps * dp + p2) % 1) * (H + K * 0.08)) - K * 0.04;
          var xx = ssRnd(j, 6) * (W * 1.35) - W * 0.18
                 + Math.sin(tSec * 0.5 * dp + j) * K * 0.03 + dr * yy;
          var r2 = (K / 230) * dp;
          ctx.globalAlpha = 0.55 + dp * 0.42;
          ctx.beginPath(); ctx.arc(xx, yy, r2, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
    }

    // ===================== Energieketten =====================
    //  Bewusst dieselbe Struktur wie im Widget "flow" (Modus Energie): w.elements mit
    //  {type,name,icon,color,vid}. Dadurch laesst sich eine fertige Konfiguration
    //  unveraendert uebernehmen, und der Live-Abruf sammelt die IDs bereits ein
    //  (06-live.js kennt den Schluessel 'elements').

    var _ssIco = {};           // "id|farbe" -> {ok, img}

    /** Leistung in WATT, unabhaengig von der Profil-Einheit (nur exakt "kW" wird skaliert). */
    function ssWatts(vid) {
      var d = vid && _lastVals[vid]; if (!d) return NaN;
      var n = parseFloat(String(d.v).replace(',', '.')); if (isNaN(n)) return n;
      return ((d.u != null ? String(d.u) : '').trim().toLowerCase() === 'kw') ? n * 1000 : n;
    }
    function ssFmtW(v) {
      if (v == null || isNaN(v)) return '–';
      var a = Math.abs(v);
      try {
        if (a >= 10000) return Math.round(a / 1000).toLocaleString('de-DE') + ' kW';
        if (a >= 1000) return (Math.round(a / 100) / 10).toLocaleString('de-DE',
          { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kW';
        return Math.round(a).toLocaleString('de-DE') + ' W';
      } catch (e) { return Math.round(a) + ' W'; }
    }
    function ssEType(t) {
      t = (t || '').toString().toLowerCase();
      if (t === 'pv' || t === 'solar' || t === 'erzeuger') return 'pv';
      if (t === 'grid' || t === 'netz') return 'grid';
      if (t === 'battery' || t === 'batt' || t === 'akku') return 'battery';
      return 'load';                                   // consumer, load, other, leer
    }
    function ssEIcon(t) {
      return t === 'pv' ? 'solarpanel' : t === 'grid' ? 'pylon' : t === 'battery' ? 'battery' : 'plug';
    }

    /**
     * Icon als Bild fuer die Zeichenflaeche. Die Katalog-Icons sind Innen-SVG ohne eigene
     * Linienfarbe (die kommt sonst aus der CSS-Klasse .ic24), deshalb werden Rahmen und
     * Strichparameter hier gesetzt. Ergebnis wird zwischengespeichert.
     */
    function ssIconImg(id, col, redraw) {
      var key = id + '|' + col, rec = _ssIco[key];
      if (rec) {
        // Laeuft der Ladevorgang noch, muss sich AUCH dieser Aufrufer anmelden - sonst
        // erfaehrt ein zweites Widget nie vom Ladeende und bliebe ohne Icon.
        if (!rec.ok && redraw && rec.cb && rec.cb.indexOf(redraw) < 0) rec.cb.push(redraw);
        return rec.ok ? rec.img : null;
      }
      var cat = (typeof ICONS !== 'undefined') ? ICONS : null;
      var inner = (cat && cat[id]) ? cat[id][1] : (cat && cat.gauge ? cat.gauge[1] : null);
      if (!inner) { _ssIco[key] = { ok: false }; return null; }
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" '
              + 'fill="none" stroke="' + col + '" stroke-width="1.7" stroke-linecap="round" '
              + 'stroke-linejoin="round">' + inner + '</svg>';
      var img = new Image();
      rec = _ssIco[key] = { ok: false, img: img, cb: redraw ? [redraw] : [] };
      img.onload = function () {
        rec.ok = true;
        rec.cb.forEach(function (f) { try { f(); } catch (_) {} });
        rec.cb = [];
      };
      img.onerror = function () { rec.ok = false; rec.cb = []; };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      return null;
    }

    /**
     * Elemente aufbereiten: Leistung, Flussrichtung und Platz auf dem Ring um das Haus.
     *  Richtung wie im Fluss-Widget: PV immer zum Haus, Verbraucher immer weg, bei Netz und
     *  Batterie entscheidet das Vorzeichen (+ zum Haus).
     */
    function ssEnergy(w, pal) {
      var list = (w.elements || []).filter(function (e) { return e && (e.vid || e.name); });
      if (!list.length) return null;
      var ord = { pv: 0, grid: 1, battery: 2, load: 3 };
      var out = list.map(function (e, i) {
        var t = ssEType(e.type), watt = ssWatts(e.vid);
        var dir = (t === 'pv') ? 1 : (t === 'load') ? -1 : (watt < 0 ? -1 : 1);
        return { i: i, t: t, name: e.name || '', icon: e.icon || ssEIcon(t),
                 col: pal.col(e.color, t === 'pv' ? '#f9c74f' : t === 'grid' ? '#8b94a2'
                      : t === 'battery' ? '#4ecdc4' : '#e07a5f'),
                 watt: isNaN(watt) ? null : Math.abs(watt), dir: dir, o: ord[t] };
      });
      out.sort(function (a, b) { return (a.o - b.o) || (a.i - b.i); });
      var n = out.length, a0 = ssNum(w.ssEnA0, 0) * D;
      out.forEach(function (e, k) { e.ang = a0 + k * 2 * Math.PI / n; });
      return out;
    }

    /** Summe am Haus: alles, was zum Haus fliesst, minus was abfliesst. */
    function ssEnergyHome(els) {
      var into = 0;
      els.forEach(function (e) { if (e.watt != null && e.dir > 0) into += e.watt; });
      return into;
    }

    /**
     * Energieebene zeichnen: Leitung auf dem Boden, wandernde Perlen in Flussrichtung,
     * dazu eine lesbare Marke am Ort des Elements. Die Marken stehen im Bildraum aufrecht,
     * damit sie beim Drehen lesbar bleiben.
     */
    /**
     * Energieebene: Marken auf einem Ring im Bildraum, Leitungen zum Haus, wandernde
     * Perlen in Flussrichtung.
     *  Warum im Bildraum und nicht am Boden der Szene: Marken haben eine feste Groesse,
     *  Bodenpunkte laufen bei flacher Kameraneigung dicht zusammen - die Marken lagen dann
     *  uebereinander. Der Ring dreht sich mit der Szene mit, die Zuordnung bleibt also
     *  erhalten, aber die Beschriftung bleibt immer lesbar.
     */
    function ssEnergyDraw(ctx, cam, K, W, H, w, els, tSec, redraw, pal) {
      var ref = Math.max(50, ssNum(w.ssEnRef, 3000));
      var showChip = _covOn2(w, 'ssEnChip', true);
      var hp = cam.project(0, 0, 3);                                  // Anschluss am Haus
      var fs0 = Math.max(9, K / 31);
      var fs = ssFsz(w, 'Cv', fs0), ns = ssFsz(w, 'Cn', fs0 * 0.60);
      var ico = fs0 * 1.30, gap = fs0 * 0.46;
      var pad = fs * 0.6;
      // Platzbedarf der Beschriftung MESSEN - sie steht nach aussen, also muss der Ring
      // genau um diese Breite kleiner werden, sonst laeuft der laengste Wert aus dem Bild.
      var labW = 0;
      ctx.save();
      els.forEach(function (e) {
        ctx.font = ssFont(w, 'Cv', fs0, pal);
        var a = ctx.measureText(e.watt != null ? ssFmtW(e.watt) : '–').width;
        ctx.font = ssFont(w, 'Cn', fs0 * 0.60, pal);
        var b = e.name ? ctx.measureText(e.name.toUpperCase()).width : 0;
        var t = ico + gap + Math.max(a, b);
        if (t > labW) labW = t;
      });
      ctx.restore();
      var labH = ico + gap + fs + ns * 1.7;
      var HB = H;                                  // H ist bereits die Szenenhoehe
      // Der Ring sitzt MITTIG in der freien Flaeche, nicht am Hausanker: haengte er am Haus,
      // wurde er flach gedrueckt, sobald das Haus tief im Bild liegt. Die raeumliche
      // Zuordnung tragen die Leitungen, die zum Haus zeigen.
      // Oben bleibt die Kopfzeile frei (Sonnenstand links, Auf-/Untergang rechts).
      var hdr = _covOn2(w, 'ssInfo', true) ? (Math.max(9, K / 22) * 2.1 + K / 26) : 0;
      var top = labH + pad + hdr, bot = HB - labH - pad;
      var cx = W / 2, cy = (top + bot) / 2;
      if (bot <= top) { cy = HB / 2; }
      // Halbachsen aus dem knapperen der beiden Raender - sonst rutschen Marken aus dem Bild,
      // sobald der Hausanschluss nicht genau in der Mitte liegt.
      var rx = Math.max(fs * 4, W / 2 - labW - pad);
      var ry = Math.max(fs * 3, (bot - top) / 2);
      var rot = cam.bearing * D;                                      // Ring dreht sich mit

      var pts = els.map(function (e) {
        var a = e.ang - rot;
        return { e: e, x: cx + Math.sin(a) * rx, y: cy - Math.cos(a) * ry,
                 dx: Math.sin(a), dy: -Math.cos(a) };        // Richtung nach aussen
      });

      pts.forEach(function (p) {
        var e = p.e, act = e.watt != null && e.watt > 1;
        var dx = hp.x - p.x, dy = hp.y - p.y, L = Math.hypot(dx, dy) || 1;
        var x0 = p.x + dx / L * (ico * 0.62), y0 = p.y + dy / L * (ico * 0.62);   // am Icon ansetzen
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(hp.x, hp.y);
        ctx.strokeStyle = e.col; ctx.globalAlpha = act ? 0.28 : 0.10;
        ctx.lineWidth = Math.max(1, K / 320); ctx.stroke();
        ctx.restore();
        if (act) {
          var frac = Math.max(0.05, Math.min(1, e.watt / ref));
          var speed = 0.10 + frac * 0.40, cnt = 3, r = Math.max(1.5, K / 170);
          for (var b = 0; b < cnt; b++) {
            var u = (tSec * speed + b / cnt) % 1;
            if (e.dir < 0) u = 1 - u;
            var bx = x0 + (hp.x - x0) * u, by = y0 + (hp.y - y0) * u;
            var fade = Math.sin(Math.PI * u);
            ctx.save();
            ctx.globalAlpha = 0.30 + 0.60 * fade;
            var gg = ctx.createRadialGradient(bx, by, 0, bx, by, r * 3);
            gg.addColorStop(0, e.col); gg.addColorStop(1, ssA(e.col, 0));
            ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(bx, by, r * 3, 0, 7); ctx.fill();
            ctx.fillStyle = e.col; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill();
            ctx.restore();
          }
        }
        if (showChip) ssLabel(ctx, K, p.x, p.y, p.dx, p.dy, e, redraw, pal, false, w);
      });

      if (showChip) {
        ssLabel(ctx, K, hp.x, hp.y - K / 6.5, 0, -1, { name: w.homeName || 'Haus',
          icon: w.homeIcon || 'housepower',
          col: pal.col(w.homeColor, pal.col(w.ssHouseColor, pal.accent)),
          watt: ssEnergyHome(els), dir: 1 }, redraw, pal, true, w);
      }
    }

    /**
     * Beschriftung eines Energie-Elements - bewusst OHNE Kasten.
     *  Ein Rahmen um jeden Wert waere zehnmal dieselbe Form und wuerde die Farbe ein drittes
     *  Mal wiederholen (Leitung, Perlen, Zahl). Stattdessen ist das Icon selbst die Marke,
     *  der Text steht buendig nach aussen und traegt die Lesbarkeit ueber einen weichen
     *  Schein statt ueber eine Flaeche. Farbe bleibt dort, wo sie etwas bedeutet.
     *  dirX/dirY zeigen vom Ringmittelpunkt nach aussen und bestimmen die Textrichtung.
     */
    function ssLabel(ctx, K, x, y, dirX, dirY, e, redraw, pal, big, w) {
      var fs0 = Math.max(9, K / (big ? 24 : 31));
      var fs = ssFsz(w, 'Cv', fs0), ns = ssFsz(w, 'Cn', fs0 * 0.60);
      var ico = fs0 * (big ? 1.45 : 1.30);
      var gap = fs0 * 0.46;
      var act = e.watt != null && e.watt > 1;
      var val = (e.watt != null) ? ssFmtW(e.watt) : '–';
      var waag = Math.abs(dirX) >= Math.abs(dirY) * 0.9;      // seitlich oder ueber/unter

      ctx.save();
      ctx.globalAlpha = act || big ? 1 : 0.52;

      // Icon als Marke
      var img = ssIconImg(e.icon, e.col, redraw);
      var ix, iy = y - ico / 2;
      if (waag) { ix = (dirX >= 0) ? x : x - ico; }
      else { ix = x - ico / 2; iy = (dirY >= 0) ? y : y - ico; }
      if (img) ctx.drawImage(img, ix, iy, ico, ico);
      else { ctx.fillStyle = e.col; ctx.beginPath(); ctx.arc(x, y, ico * 0.22, 0, 7); ctx.fill(); }

      // Text: waagrecht neben dem Icon, senkrecht darunter bzw. darueber
      var tx, ty, al;
      if (waag) {
        al = (dirX >= 0) ? 'left' : 'right';
        tx = (dirX >= 0) ? ix + ico + gap : ix - gap;
        ty = y - fs * 0.06;
      } else {
        al = 'center'; tx = x;
        ty = (dirY >= 0) ? iy + ico + gap + fs * 0.72 : iy - gap - ns * 1.1;
      }
      ctx.textAlign = al; ctx.textBaseline = 'alphabetic';
      // Weicher Schein statt Kasten - traegt ueber hellen wie dunklen Untergrund
      ctx.shadowColor = ssA(pal.tile, pal.light ? 0.95 : 0.85);
      ctx.shadowBlur = fs * 0.9;

      ctx.font = ssFont(w, 'Cv', fs0, pal);
      ctx.fillStyle = big ? e.col : ssA(pal.text, act ? 0.96 : 0.72);
      ctx.fillText(val, tx, ty);
      ctx.fillText(val, tx, ty);                              // zweimal = dichterer Schein

      if (e.name) {
        if ('letterSpacing' in ctx) ctx.letterSpacing = (ns * 0.08).toFixed(2) + 'px';
        ctx.font = ssFont(w, 'Cn', fs0 * 0.60, pal);
        ctx.fillStyle = ssA(pal.muted, 0.95);
        ctx.fillText(e.name.toUpperCase(), tx, ty + ns * 1.55);
        ctx.fillText(e.name.toUpperCase(), tx, ty + ns * 1.55);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      }
      ctx.restore();
    }

    /** Auswahl der Fluss-Widgets dieser Seite, aus denen sich die Elemente holen lassen. */
    function ssFlowSources() {
      if (typeof allWidgets !== 'function') return [];
      return allWidgets().filter(function (x) {
        return x && x.type === 'flow' && (x.mode === 'energy') && x.elements && x.elements.length;
      });
    }
    function ssImportRow(w) {
      var src = ssFlowSources();
      if (!src.length) {
        return '<div style="font-size:11px;color:var(--muted);margin:2px 2px 8px">Kein Fluss-Widget im Energie-Modus auf dieser Seite gefunden — die Elemente lassen sich unten von Hand anlegen.</div>';
      }
      var opt = src.map(function (x) {
        return '<option value="' + esc(x.id) + '">' + esc((x.name || x.id) + ' · ' + x.elements.length + ' Elemente') + '</option>';
      }).join('');
      return row('Aus Fluss-Widget', '<select id="ssImpSel" style="max-width:150px">' + opt + '</select> '
        + '<button class="btn" id="ssImp" style="padding:5px 8px">übernehmen</button>');
    }
    function ssImportWire(w, up) {
      var b = $('#ssImp'); if (!b) return;
      b.onclick = function () {
        var id = $('#ssImpSel') ? $('#ssImpSel').value : '';
        var src = ssFlowSources().filter(function (x) { return x.id === id; })[0];
        if (!src) return;
        w.elements = JSON.parse(JSON.stringify(src.elements));
        if (src.homeName) w.homeName = src.homeName;
        if (src.homeIcon) w.homeIcon = src.homeIcon;
        if (src.homeColor) w.homeColor = src.homeColor;
        if (typeof renderProps === 'function') { up(); renderProps(); } else { up(); }
      };
    }

    /** Zeitpunkt aus der Zeigerposition auf der Leiste. */
    function ssSetTime(w, el, clientX, rect, K) {
      var pad = Math.max(6, K / 40);
      var u = (clientX - rect.left - pad) / Math.max(1, rect.width - pad * 2);
      u = Math.max(0, Math.min(1, u));
      var st = ssSt(w);
      st.now = ssMidnight(w) + Math.round(u * 1439) * 60000;
      st.key = null; ssDraw(w, el);
    }

    /**
     * Der Knopf stellt auf EXAKT NORDEN: Blickrichtung 0 heisst, die Nordachse zeigt nach
     * oben und die Kompassnadel steht senkrecht.
     *
     * Nicht zu verwechseln mit der Nordausrichtung des Hauses (ssNorth, hier -12,6 Grad) -
     * die dreht das GEBAEUDE in der Welt und bleibt unangetastet. Bei Blickrichtung 0 steht
     * das Haus deshalb bewusst schraeg im Bild: genau so, wie es in der Landschaft steht.
     */
    function ssIstNord(w) {
      var st = ssSt(w);
      var b = st.bearing != null ? st.bearing : ssNum(w.ssBearing, 20);
      return Math.abs(((b % 360) + 360) % 360) < 0.05;
    }
    function ssResetView(w, el) {
      var st = ssSt(w);
      st.bearing = 0;                       // exakt Norden oben
      st.pitch = null; st.radius = null; st.now = 0; st.key = null;
      ssDraw(w, el); ssSaveView(w);
    }

    // ---- Widget ----
    defWidget('sunscene', {
      label: 'Sonnenszene', cat: 'Wetter & Zeit', paletteIcon: 'sun', size: [420, 260], noHover: true,
      defaults: function (w) {
        w.ssPitch = 52; w.ssBearing = 20; w.ssRadius = 55;
        w.ssHouseL = 25; w.ssHouseB = 12; w.ssHouseH = 7.5; w.ssRoofH = 3.5;   // ssNorth: leer = aus dem Hub
      },
      render: function () {
        return '<div class="ssc" data-role="ssbox"><canvas></canvas></div>';
      },
      mount: function (w) {
        ssSatTakt(w);
        var el = ssEl(w); if (!el) return;
        ssSt(w).w = w;                            // fuer den Skinwechsel erreichbar machen
        ssRestore(w);                             // gemerkte Ansicht (nur bei "Drehung merken")
        ssHubLoad(function () { var e2 = ssEl(w); if (e2) { ssSt(w).key = null; ssDraw(w, e2); } });
        ssBind(w, el); ssDraw(w, el);

        // Groessenaenderung -> neu zeichnen (Kachel skaliert, Fenster, Reflow, Zoom)
        var box = $('[data-role=ssbox]', el);
        if (box && typeof ResizeObserver !== 'undefined') {
          if (_ssRO[w.id]) { try { _ssRO[w.id].disconnect(); } catch (_) {} }
          var ro = new ResizeObserver(function () { ssDraw(w, el); });
          ro.observe(box); _ssRO[w.id] = ro;
        }
        // Bei Gewitter laeuft ein SCHNELLER Takt mit, damit der Blitz zuckt. Er lebt nur,

        // solange die Stufe > 0 ist, und haengt sich danach selbst wieder aus - eine Kachel

        // soll nicht dauerhaft 8 Bilder je Sekunde zeichnen, nur weil einmal ein Blitz kam.

        if (!ssSt(w).flash) {

          ssSt(w).flash = setInterval(function () {

            var e3 = ssEl(w);

            if (!e3 || !document.body.contains(e3)) { clearInterval(ssSt(w).flash); ssSt(w).flash = 0; return; }

            var wx3 = _covOn2(w, 'ssWeather', true) ? ssWx(w) : null;

            if (wx3 && wx3.storm > 0) ssDraw(w, e3);

          }, 120);

        }

        // langsamer Takt: die Sonne bewegt sich um 0,25 Grad je Minute - 20 s genuegen.
        // Selbst-Stopp, sobald das Widget nicht mehr im Dokument haengt (kein unmount-Hook).
        if (!ssSt(w).tick) {
          ssSt(w).tick = setInterval(function () {
            var e2 = ssEl(w);
            if (!e2 || !document.body.contains(e2)) { clearInterval(ssSt(w).tick); ssSt(w).tick = 0; return; }
            ssDraw(w, e2);
          }, 20000);
        }
      },
      live: function (w, el) { ssDrawBald(w, el); },
      // Kein skin()-Haken hier: der laeuft ueber die Widget-Liste, und die kennt keine
      // Widgets in Containern, Panels oder Komponenten. Die Sonnenszene meldet sich
      // stattdessen oben in LV_SKIN_HOOKS an - so wird jede Kachel erreicht, egal wo sie
      // haengt, und es wird nicht doppelt gezeichnet.
      _bind: function (w, el) { ssDraw(w, el); },
      props: function (w) {
        var h = '<div class="pgh">Standort &amp; Sonne</div>';
        h += row('Breite', '<input id="ssLat" type="number" step="0.0001" value="' + (w.lat != null ? w.lat : '') + '" placeholder="48.0657">');
        h += row('Länge', '<input id="ssLon" type="number" step="0.0001" value="' + (w.lon != null ? w.lon : '') + '" placeholder="14.1241">');
        h += fieldPick(w, 'ssAz', 'Azimut (Variable)') + fieldPick(w, 'ssEl', 'Elevation (Variable)');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Gebundene Werte haben Vorrang; ohne Bindung wird der Sonnenstand aus den Koordinaten berechnet.</div>';
        h += fieldPick(w, 'ssRad', 'Globalstrahlung W/m²');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Steuert Halo, Dunst und Schattenhärte. Ohne Bindung neutral.</div>';
        h += '<div class="pgh">Haus</div>';
        h += row('Länge × Breite (m)', '<input id="ssHL" type="number" step="0.5" min="3" value="' + ssNum(w.ssHouseL, 25) + '" style="width:60px"> <input id="ssHB" type="number" step="0.5" min="3" value="' + ssNum(w.ssHouseB, 12) + '" style="width:60px">');
        h += row('Traufe / First (m)', '<input id="ssHH" type="number" step="0.5" value="' + ssNum(w.ssHouseH, 7.5) + '" style="width:60px"> <input id="ssHR" type="number" step="0.2" value="' + ssNum(w.ssRoofH, 3.5) + '" style="width:60px">');
        h += row('Grundstück', '<input type="checkbox" id="ssPlot"' + (_covOn2(w, 'ssPlot', true) ? ' checked' : '') + '>');
        h += row('Nordausrichtung (°)', '<input id="ssN" type="number" step="0.1" value="'
              + ((w.ssNorth === undefined || w.ssNorth === null || w.ssNorth === '') ? '' : w.ssNorth)
              + '" placeholder="' + (ssHub().northDeg != null ? ssHub().northDeg : 'Hub') + '" style="width:64px">'
              + ' <span style="font-size:11px;color:var(--muted)">leer = aus dem HomeSuite Hub'
              + (ssHub().northDeg != null ? (' (' + ssHub().northDeg + '°)') : '') + '</span>');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Der First verläuft entlang der <b>Länge</b>. Nordausrichtung dreht das Haus (0° = Länge in Ost-West-Richtung).</div>';
        h += '<div class="pgh">Nachbarschaft</div>';
        h += row('Gebäude zeigen', '<input type="checkbox" id="ssBuildings"' + (_covOn2(w, 'ssBuildings', true) ? ' checked' : '') + '>');
        h += row('Eigenes Haus aus OSM', '<input type="checkbox" id="ssOwnFromOsm"' + (_covOn2(w, 'ssOwnFromOsm', true) ? ' checked' : '') + '>');
        h += row('Suchradius (m)', '<input id="ssGeoR" type="number" min="50" max="1000" step="50" value="' + ssNum(w.ssGeoR, 250) + '" style="width:64px">');
        h += row('Höchstens … Gebäude', '<input id="ssMaxB" type="number" min="0" max="400" step="10" value="' + ssNum(w.ssMaxB, 60) + '" style="width:64px">');
        h += row('Satteldächer', '<input type="checkbox" id="ssBldRoof"' + (_covOn2(w, 'ssBldRoof', true) ? ' checked' : '') + '>');
        h += row('Gebäudefarbe', skinSel(w.ssBldColor || '', 'id="ssBldColor"'));
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Grundrisse stammen aus OpenStreetMap und werden einmalig je Standort geholt. Fehlt die Höhenangabe, wird nach Gebäudeart geschätzt (Garage 2,8 m, Wohnhaus 7 m). Die Satteldächer sind eine Annahme für die Ortsüblichkeit — OSM kennt die Dachformen hier nicht. Ist das eigene Haus dort erfasst, wird sein echter Grundriss verwendet — die Maße oben gelten dann nur noch als Rückfall.</div>';
        h += '<div class="pgh">Wetter</div>';
        h += row('Wetter zeigen', '<input type="checkbox" id="ssWeather"' + (_covOn2(w, 'ssWeather', true) ? ' checked' : '') + '>');
        h += fieldPick(w, 'ssRainV', 'Regen mm/h');
        h += fieldPick(w, 'ssRainSensV', 'Regensensor (an/aus)');
        h += fieldPick(w, 'ssSnowV', 'Schnee mm/h');
        h += fieldPick(w, 'ssPtypeV', 'Niederschlagsart');
        h += fieldPick(w, 'ssFogV', 'Sicht / Nebel');
        h += fieldPick(w, 'ssFogStateV', 'Nebel (Zustand)');
        // Gewitter aus der eigenen Ableitung (HomeSuite\\Wetter): Stufe 0 kein, 1 Wetterleuchten,
        // 2 Gewitter, 3 in der Naehe. Ohne Bindung zeichnet die Szene kein Gewitter.
        h += fieldPick(w, 'ssStormV', 'Gewitter-Stufe 0-3');
        h += fieldPick(w, 'ssStormDistV', 'Gewitter · Entfernung km');
        h += fieldPick(w, 'ssTempV', 'Temperatur (Nebel & Schnee)');
        h += fieldPick(w, 'ssDewV', 'Taupunkt (für Nebel)');
        h += fieldPick(w, 'ssHumV', 'Luftfeuchte (Nebel & Schnee)');
        h += fieldPick(w, 'ssWetV', 'Feuchtkugel (für Schnee)');
        h += fieldPick(w, 'ssWindV', 'Wind');
        h += row('Bewölkung aus', '<select id="ssCloudSrc">'
          + [['auto','automatisch (beste Quelle)'],['rad','nur Strahlung'],['var','nur Variable'],['fc','nur Vorhersage']]
              .map(function(o){return '<option value="'+o[0]+'"'+(((w.ssCloudSrc||'auto')===o[0])?' selected':'')+'>'+o[1]+'</option>';}).join('')
          + '</select>');
        h += fieldPick(w, 'ssCloudV', 'Bewölkung % (Variable)');
        h += fieldPick(w, 'ssWxJson', 'OWM-Vorhersage (JSON)');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Alles einzeln optional — gebunden wird, was die eigene Wetterstation liefert. <b>Niederschlagsart</b>: sagt nur, <i>dass</i> es niederschlägt — die Tempest-Kennung kennt keinen Schnee (0 = keiner, 1 = Regen, 2 = <b>Hagel</b>). Ob Regen oder Schnee entscheidet die <b>Feuchtkugeltemperatur</b>: unter 0,5 °C Schnee, über 1,5 °C Regen, dazwischen anteilig Schneeregen — maßgeblich ist sie und nicht die Lufttemperatur, weil eine fallende Flocke sich durch Verdunstung selbst kühlt (bei 3 °C Luft und 40 % Feuchte schneit es). Ohne gebundene Feuchtkugel wird sie aus Temperatur und Luftfeuchte gerechnet (Stull 2011). Eine Davis Vantage liefert keine Niederschlagsart und misst Schnee erst geschmolzen — dort ist die Ableitung der einzige Weg. <b>Sicht/Nebel</b>: Werte über 5 gelten als Sichtweite in Metern (unter 2000 m zieht Nebel auf), kleinere als Anteil. Fehlt ein Sichtweitensensor, wird der Nebel aus <b>Temperatur und Taupunkt</b> geschätzt — je kleiner der Abstand, desto dichter (unter 0,5 K dicht, ab 2,5 K keiner); die Luftfeuchte dämpft das Ergebnis und dient ohne Taupunkt als schwächerer Ersatz. Wind löst Nebel auf (über etwa 10 km/h hält er sich kaum, ab 25 km/h gar nicht) — das dämpft nur die <i>Schätzung</i>. Weil es eine Schätzung ist, macht sie die Szene nie ganz zu. Sichtweite misst weder eine Davis noch eine Tempest. <b>Regensensor</b>: meldet er Regen, während die Station noch 0,0 mm/h zeigt, erscheint Nieselregen. <b>Bewölkung</b> kommt automatisch aus der besten Quelle: zuerst aus der <b>gemessenen Strahlung</b> (Klarheitsindex gegen den Klarhimmelwert, Umrechnung nach Kasten &amp; Czeplak) — das ist der örtlichste Wert überhaupt, geht aber nur bei Sonne über 5°; sonst aus der gebundenen Variablen; nachts aus der <b>Stundenvorhersage</b> im Wetter-JSON (OpenWeatherMap One Call, auch PHP-serialisiert). Sie graut den Himmel aus, dämpft die Sonne, macht die Schatten weich und verdeckt nachts die Sterne; bei Regen oder Schnee wird sie auch ohne Bindung angenommen — ein blauer Himmel im Regen wäre der auffälligste Fehler. <b>Wind</b> neigt den Regen und treibt den Schnee; die Einheit der Variablen (km/h, kn, mph, m/s) wird berücksichtigt.</div>';
        h += '<div class="pgh">Energie</div>';
        h += ssImportRow(w);
        h += listEditor(w, 'elements', 'Typ · Name · Icon · Farbe · Leistung-ID',
          [{ k: 'type', type: 'select', def: 'consumer', options: [['pv', 'PV / Erzeuger'], ['grid', 'Netz'],
             ['battery', 'Batterie'], ['consumer', 'Verbraucher'], ['other', 'Sonstiges']] },
           { k: 'name', ph: 'Name' }, { k: 'icon', type: 'icon' }, { k: 'color', type: 'skincolor' },
           { k: 'vid', ph: 'Leist-ID' }]);
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Gleicher Aufbau wie im Fluss-Widget — eine dort fertige Zusammenstellung lässt sich oben unverändert übernehmen. PV fließt immer zum Haus, Verbraucher immer weg; bei Netz und Batterie entscheidet das Vorzeichen.</div>';
        h += row('Haus: Name / Icon', '<input id="ssHN" value="' + esc(w.homeName || 'Haus') + '" style="width:86px"> <input id="ssHI" value="' + esc(w.homeIcon || 'housepower') + '" style="width:86px">');
        h += row('Ringabstand (m)', '<input id="ssEnRad" type="number" min="0" step="5" value="' + (w.ssEnRad != null ? w.ssEnRad : '') + '" placeholder="automatisch" style="width:96px">');
        h += row('Startwinkel (°)', '<input id="ssEnA0" type="number" min="0" max="359" value="' + ssNum(w.ssEnA0, 0) + '" style="width:64px">');
        h += row('Referenz-Leistung (W)', '<input id="ssEnRef" type="number" min="50" step="100" value="' + ssNum(w.ssEnRef, 3000) + '" style="width:96px"> <span style="font-size:11px;color:var(--muted)">volles Tempo</span>');
        h += row('Marken zeigen', '<input type="checkbox" id="ssEnChip"' + (_covOn2(w, 'ssEnChip', true) ? ' checked' : '') + '>');
        h += row('Bewegung', '<input type="checkbox" id="ssEnAnim"' + (_covOn2(w, 'ssEnAnim', true) ? ' checked' : '') + '>');
        h += '<div class="pgh">Schriften</div>';
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Je Textgruppe eigene Schrift, Stärke und Größe. Die Größe ist ein Prozentwert der automatisch berechneten Größe — so bleibt die Szene auf jedem Bildschirm stimmig. Ohne eigene Wahl gilt die Schrift der Ansicht.</div>';
        SS_TEXT.forEach(function (g) {
          var k = g[0];
          var fam = '<select id="ssF' + k + 'Fam" style="max-width:118px">' + SS_FAMS.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + ((w['ssF' + k + 'Fam'] || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select>';
          var wt = '<select id="ssF' + k + 'Wt" style="max-width:78px">' + SS_WTS.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + ((w['ssF' + k + 'Wt'] || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select>';
          var sz = '<input id="ssF' + k + 'Sz" type="number" min="40" max="250" step="5" value="'
                 + ssNum(w['ssF' + k + 'Sz'], 100) + '" style="width:56px" title="Prozent">';
          var it = '<label style="font-size:11px;color:var(--muted)"><input type="checkbox" id="ssF' + k + 'It"'
                 + (w['ssF' + k + 'It'] ? ' checked' : '') + '> kursiv</label>';
          h += row(g[1], fam + ' ' + wt + ' ' + sz + ' % ' + it);
        });
        h += '<div class="pgh">Ansicht</div>';
        h += row('Neigung (°)', '<input id="ssP" type="number" min="0" max="70" value="' + ssNum(w.ssPitch, 52) + '" style="width:64px">');
        h += row('Blickrichtung (°)', '<input id="ssB" type="number" min="0" max="359" value="' + ssNum(w.ssBearing, 20) + '" style="width:64px">'
              + ' <span style="font-size:11px;color:var(--muted)">0 = genau Nord</span>');
        h += row('Drehung merken', '<input type="checkbox" id="ssKeep"' + (w.ssKeep ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">von Hand gedrehte Ansicht je Gerät behalten; ohne Haken gilt beim Öffnen immer die Blickrichtung oben</span>');
        h += row('Umkreis (m)', '<input id="ssR" type="number" min="20" max="400" value="' + ssNum(w.ssRadius, 55) + '" style="width:64px">');
        h += row('Zeitleiste', '<input type="checkbox" id="ssStrip"' + (_covOn2(w, 'ssStrip', true) ? ' checked' : '') + '>');
        h += row('Höhe der Zeitleiste (%)', '<input id="ssStripPct" type="number" min="50" max="200" step="5" value="' + ssNum(w.ssStripPct, 100) + '" style="width:64px"> <span style="font-size:11px;color:var(--muted)">100 % = automatisch, kleiner = flacher</span>');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Zeigt die Tageskurve der Sonnenhöhe. Ziehen fährt den Tag durch — Schatten, Sonnenstand und Mond folgen. Doppeltippen kehrt zu „jetzt" zurück; die gewählte Zeit wird nicht gespeichert.</div>';
        h += row('Mond', '<input type="checkbox" id="ssMoon"' + (_covOn2(w, 'ssMoon', true) ? ' checked' : '') + '>');
        // Flugverkehr - bewusst nur als Richtung auf der Kuppel, ohne Radaranzeige.
        // Die Bodenebene hier hat 55 m Radius, die Flugszene braucht 30 000.
        h += row('Flugzeuge', '<input type="checkbox" id="ssFlights"' + (_covOn2(w, 'ssFlights', false) ? ' checked' : '')
              + '> <span style="font-size:11px;color:var(--muted)">auf der Himmelskuppel, nachts als Positionslichter</span>');
        h += row('Satelliten', '<input type="checkbox" id="ssSats"' + (_covOn2(w, 'ssSats', false) ? ' checked' : '')
              + '> <span style="font-size:11px;color:var(--muted)">nur sichtbare Überflüge, also nur in der Dämmerung</span>');
        if (_covOn2(w, 'ssFlights', false)) {
          h += row('Umkreis (km)', '<input id="ssFlightR" type="number" min="5" max="200" style="width:80px" value="' + ssNum(w.ssFlightR, 30) + '">')
            + row('Rufzeichen', '<input type="checkbox" id="ssFlightLbl"' + (w.ssFlightLbl !== false ? ' checked' : '') + '>');
        }
        h += row('Sterne', '<input type="checkbox" id="ssStars"' + (_covOn2(w, 'ssStars', true) ? ' checked' : '') + '>');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Der Mond steht an seinem berechneten Platz am Himmel und zeigt die echte Phase; die beleuchtete Seite weist zur Sonne. Ab Dämmerung blendet er ein, tagsüber aus.</div>';
        h += row('Einfallstrahl', '<input type="checkbox" id="ssRay"' + (_covOn2(w, 'ssRay', true) ? ' checked' : '') + '>');
        h += row('Infozeile', '<input type="checkbox" id="ssInfo"' + (_covOn2(w, 'ssInfo', true) ? ' checked' : '') + '>');
        h += row('Kompass', '<input type="checkbox" id="ssCompass"' + (_covOn2(w, 'ssCompass', true) ? ' checked' : '') + '>')
           + '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Kleiner Nordpfeil unter der Auf-/Untergangszeit; dreht sich mit der Szene. Braucht die Infozeile.</div>';
        h += row('Hausfarbe', skinSel(w.ssHouseColor || '', 'id="ssHouseColor"'));
        return h;
      },
      wire: function (w) {
        function up() { var e = ssEl(w); if (e) { ssSt(w).key = null; ssDraw(w, e); } commit(); }
        ssImportWire(w, up);
        SS_TEXT.forEach(function (g) {
          var k = g[0];
          ['Fam', 'Wt'].forEach(function (suf) {
            var e = $('#ssF' + k + suf);
            if (e) e.onchange = function () { w['ssF' + k + suf] = this.value || undefined; up(); };
          });
          var sz = $('#ssF' + k + 'Sz');
          if (sz) sz.onchange = function () {
            var v = parseFloat(this.value);
            w['ssF' + k + 'Sz'] = (isNaN(v) || v === 100) ? undefined : v; up();
          };
          var it = $('#ssF' + k + 'It');
          if (it) it.onchange = function () { w['ssF' + k + 'It'] = this.checked || undefined; up(); };
        });
        [['ssHN', 'homeName'], ['ssHI', 'homeIcon']].forEach(function (o) {
          var e = $('#' + o[0]); if (e) e.onchange = function () { w[o[1]] = this.value || undefined; up(); };
        });
        var _cs = $('#ssCloudSrc'); if (_cs) _cs.onchange = function () { w.ssCloudSrc = (this.value === 'auto') ? undefined : this.value; up(); };
        var _kp = $('#ssKeep'); if (_kp) _kp.onchange = function () {
          w.ssKeep = this.checked || undefined;
          if (!w.ssKeep) { try { localStorage.removeItem('lvb.ss.' + w.id); } catch (_) {} }
          up();
        };
        [['ssGeoR', 'ssGeoR'], ['ssMaxB', 'ssMaxB'], ['ssEnRad', 'ssEnRad'], ['ssEnA0', 'ssEnA0'], ['ssEnRef', 'ssEnRef'], ['ssLat', 'lat'], ['ssLon', 'lon'], ['ssHL', 'ssHouseL'], ['ssHB', 'ssHouseB'], ['ssHH', 'ssHouseH'],
         ['ssHR', 'ssRoofH'], ['ssN', 'ssNorth'], ['ssP', 'ssPitch'], ['ssB', 'ssBearing'], ['ssR', 'ssRadius'], ['ssStripPct', 'ssStripPct']].forEach(function (o) {
          var e = $('#' + o[0]); if (e) e.onchange = function () {
            w[o[1]] = this.value === '' ? undefined : parseFloat(this.value);
            if (o[1] === 'ssBearing' || o[1] === 'ssPitch') { var s = ssSt(w); s.bearing = null; s.pitch = null; }
            up();
          };
        });
        [['ssRay', 'ssRay'], ['ssInfo', 'ssInfo'], ['ssCompass', 'ssCompass'], ['ssPlot', 'ssPlot'],
         ['ssBuildings', 'ssBuildings'], ['ssOwnFromOsm', 'ssOwnFromOsm'], ['ssBldRoof', 'ssBldRoof'],
         ['ssMoon', 'ssMoon'], ['ssFlights', 'ssFlights'], ['ssFlightLbl', 'ssFlightLbl'], ['ssSats', 'ssSats'], ['ssStars', 'ssStars'], ['ssStrip', 'ssStrip'], ['ssEnChip', 'ssEnChip'], ['ssEnAnim', 'ssEnAnim'], ['ssWeather', 'ssWeather']].forEach(function (o) {
          var e = $('#' + o[0]); if (e) e.onchange = function () { w[o[1]] = this.checked; up(); };
        });
        if ($('#ssFlightR')) $('#ssFlightR').onchange = function () { w.ssFlightR = parseInt(this.value) || 30; up(); };
        if ($('#ssHouseColor')) $('#ssHouseColor').onchange = function () { w.ssHouseColor = this.value || undefined; up(); };
        if ($('#ssBldColor')) $('#ssBldColor').onchange = function () { w.ssBldColor = this.value || undefined; up(); };
        // fieldPick (data-fid/-fpick/-fclr) wird zentral in 04-props.js verdrahtet - hier nichts zu tun.
      }
    });
  })();
