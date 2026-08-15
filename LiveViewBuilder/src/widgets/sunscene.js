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
      fetch('?api=geo&lat=' + g.lat + '&lon=' + g.lon + '&r=' + r, { cache: 'no-store' })
        .then(function (x) { return x.json(); })
        .then(function (j) {
          _ssGeoCache[key] = (j && j.ok && j.b) ? { state: 'ok', data: j } : { state: 'err' };
          var e2 = ssEl(w); if (e2) ssDraw(w, e2);
        }).catch(function () { _ssGeoCache[key] = { state: 'err' }; });
      return null;
    }

    /**
     * Farbtafel des aktiven Skins. Damit folgt die Szene dem Erscheinungsbild - hell,
     * dunkel oder eigene Farben. Der Himmel bleibt physikalisch (nachts ist es nachts),
     * bekommt im hellen Skin aber einen helleren Tag.
     */
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
      try {
        if (typeof CSS !== 'undefined' && CSS.supports) return CSS.supports('color', c);
      } catch (e) { /* alte Browser: unten weiter */ }
      return /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(c);
    }
    /** Farbe mit Deckung als rgba-Zeichenkette. */
    function ssA(c, a) { var r = hex2rgb(c); return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + a + ')'; }

    function ssEl(w) { return $('.w[data-id="' + w.id + '"]', canvas) || $('.w[data-id="' + w.id + '"]', $('#ovcanvas')); }
    function ssSt(w) { return _ssState[w.id] || (_ssState[w.id] = { bearing: null, pitch: null, drag: null, raf: 0, spin: 0 }); }
    function ssNum(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
    function ssVal(vid) { if (!vid) return null; var e = _lastVals[vid]; if (!e) return null; var n = parseFloat(e.v); return isNaN(n) ? null : n; }
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

      var K = Math.min(W, H);                    // Bezugsgroesse fuer ALLE Masse (responsiv)
      var cam = ssCam(w, W, H), sun = ssSun(w);
      var rad = ssVal(w.ssRad);                  // gemessene Globalstrahlung W/m2
      var clr = (rad != null) ? LVSUN.clearness(rad, sun.elev) : null;
      var geo = ssGeo3(w, el);
      var pal0 = ssPal(el);

      var key = [W, H, dpr, cam.bearing.toFixed(2), cam.pitch.toFixed(2), cam.radius.toFixed(2),
                 sun.az.toFixed(2), sun.elev.toFixed(2), clr == null ? 'x' : clr.toFixed(3),
                 geo ? geo.count : -1, Math.floor(ssNow(w) / 60000), ssStyleKey(w),
                 pal0.tile + pal0.accent].join('|');
      var st = ssSt(w);
      if (st.key !== key || !st.buf) {
        st.buf = ssScene(w, el, W, H, dpr, cam, sun, clr, geo, K);
        st.key = key;
      }
      ctx.drawImage(st.buf, 0, 0, W, H);

      var els = ssEnergy(w, pal0);
      if (els) {
        var t = (typeof performance !== 'undefined' ? performance.now() : ssNow(w)) / 1000;
        ssEnergyDraw(ctx, cam, K, W, H, w, els, t,
          function () { var e2 = ssEl(w); if (e2) { ssSt(w).key = null; ssDraw(w, e2); } }, pal0);
        var lebt = _covOn2(w, 'ssEnAnim', true) && els.some(function (e) { return e.watt != null && e.watt > 1; });
        if (lebt) { ssAnim(w, el); }
      }
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
    function ssScene(w, el, W, H, dpr, cam, sun, clr, geo, K) {
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
      ssSky(ctx, W, H, K, day, clr, w, pal);
      if (day < 0.55 && _covOn2(w, 'ssStars', true)) ssStars(ctx, W, H, K, 1 - day / 0.55, w);
      ssGround(ctx, cam, W, H, K, day, w, pal);
      var track = LVSUN.dayTrack(g.lat, g.lon, ssNow(w), 6);
      ssArc(ctx, cam, K, track, sun, day, w, pal);
      var mn = ssMoonDisc(ctx, cam, K, sun, day, w);
      if (geo) ssNeighbours(ctx, cam, K, sun, day, clr, w, geo, pal);
      ssHouse(ctx, cam, K, sun, day, clr, w, geo, pal);
      if (geo) ssAttrib(ctx, W, H, K, pal, ssStripH(w, K) ? ssStripH(w, K) + Math.max(6, K / 40) * 1.6 : 0);
      ssSunDisc(ctx, cam, K, sun, clr, w);
      ssLabels(ctx, W, H, K, sun, ssVal(w.ssRad), clr, track, w, mn, pal);
      ssStrip(ctx, W, H, K, w, track, pal);
      return cv;
    }

    /** Naechstes Animationsbild - rund 30 je Sekunde, ruht bei verdeckter Seite. */
    function ssAnim(w, el) {
      var st = ssSt(w);
      if (st.anim) return;
      st.anim = setTimeout(function () {
        st.anim = 0;
        if (typeof document !== 'undefined' && document.hidden) return;
        var e2 = ssEl(w);
        if (!e2 || !document.body.contains(e2)) return;
        ssDraw(w, e2);
      }, 33);
    }

    // Himmel: Farbe folgt der Sonnenhoehe, Dunst der gemessenen Klarheit
    function ssSky(ctx, W, H, K, day, clr, w, pal) {
      var gr = ctx.createLinearGradient(0, 0, 0, H);
      var haze = (clr == null) ? 0.35 : (1 - clr) * 0.6;              // truebe Luft = flacherer Verlauf
      if (day > 0.5 && pal.light) {
        // Heller Skin: Tageshimmel in Tageslichtfarben, damit die Kachel nicht als
        // dunkler Block in einer hellen Oberflaeche steht.
        gr.addColorStop(0, mix('#7fb3d5', '#9fbdcd', haze));
        gr.addColorStop(0.62, mix('#bcd9e6', '#cfdde4', haze));
        gr.addColorStop(1, mix('#e3eef2', '#e8edef', haze));
      } else if (day > 0.5) {
        gr.addColorStop(0, mix('#0a2233', '#16323f', haze));
        gr.addColorStop(0.62, mix('#123b3f', '#1d4448', haze));
        gr.addColorStop(1, mix('#0d1f24', '#141f22', haze));
      } else {
        var t = day / 0.5;
        gr.addColorStop(0, mix('#060a12', '#241a2e', t));
        gr.addColorStop(0.62, mix('#080e16', '#3a2733', t));
        gr.addColorStop(1, mix('#05080c', '#1a1620', t));
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
    // Tagesbogen + Auf-/Untergangsmarken
    function ssArc(ctx, cam, K, track, sun, day, w, pal) {
      var R = cam.skyR, acc = pal.col(w.ssArcColor, '#ffd166');
      ctx.save(); ctx.beginPath(); var first = true;
      track.forEach(function (s) {
        if (s.elev < -1.5) { first = true; return; }
        var p = ssSky3(cam, s.az, s.elev, R);
        first ? (ctx.moveTo(p.x, p.y), first = false) : ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = ssA(acc, (0.18 + day * 0.3).toFixed(2));
      ctx.lineWidth = Math.max(1, K / 300); ctx.setLineDash([K / 90, K / 90]); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      // Auf-/Untergang
      var rs = LVSUN.riseSet(track), st = track[0] ? 6 : 6;
      [['rise', rs.rise], ['set', rs.set]].forEach(function (o) {
        if (o[1] == null) return;
        var i = Math.max(0, Math.min(track.length - 1, Math.round(o[1] / st)));
        var s = track[i], p = ssSky3(cam, s.az, Math.max(0, s.elev), R);
        ctx.save();
        ctx.fillStyle = 'rgba(255,209,102,.55)';
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, K / 190), 0, 7); ctx.fill();
        ctx.restore();
      });
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
      var rot = ssNum(w.ssNorth, 0) * D, c = Math.cos(rot), sn = Math.sin(rot);
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
    function ssMoonDisc(ctx, cam, K, sun, day, w) {
      if (!_covOn2(w, 'ssMoon', true)) return null;
      var g = ssGeo(w), m = LVSUN.moon(g.lat, g.lon, ssNow(w) / 1000);
      if (m.elev < -1) return null;                            // unter dem Horizont
      var vis = Math.max(0, Math.min(1, (0.62 - day) / 0.45));  // am hellen Tag unsichtbar
      if (vis <= 0.02) return m;
      var q = ssSky3(cam, m.az, m.elev, cam.skyR);
      var R = K / 26;
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
    function ssStripH(w, K) { return _covOn2(w, 'ssStrip', true) ? Math.max(26, K / 5.6) : 0; }

    /**
     * Zeitleiste mit Tageskurve. Die Flaeche zeigt die Sonnenhoehe ueber den Tag, die Nacht
     * liegt gedaempft dahinter; der Griff steht auf dem dargestellten Zeitpunkt. Ziehen
     * verschiebt die Zeit, Doppeltippen kehrt zu "jetzt" zurueck.
     */
    function ssStrip(ctx, W, H, K, w, track, pal) {
      var sh = ssStripH(w, K); if (!sh) return;
      var pad = Math.max(6, K / 40), x0 = pad, x1 = W - pad;
      var y1 = H - pad, y0 = y1 - sh, bw = x1 - x0;
      var fs = Math.max(8, K / 40);
      var maxE = 1; track.forEach(function (p) { if (p.elev > maxE) maxE = p.elev; });

      ctx.save();
      // Untergrund
      var rr = sh * 0.28;
      ctx.beginPath();
      ctx.moveTo(x0 + rr, y0); ctx.arcTo(x1, y0, x1, y1, rr); ctx.arcTo(x1, y1, x0, y1, rr);
      ctx.arcTo(x0, y1, x0, y0, rr); ctx.arcTo(x0, y0, x1, y0, rr); ctx.closePath();
      ctx.fillStyle = ssA(pal.tile, pal.light ? 0.90 : 0.84); ctx.fill();
      ctx.strokeStyle = ssA(pal.line, 0.6); ctx.lineWidth = Math.max(0.6, K / 1000); ctx.stroke();
      ctx.clip();

      // Tageskurve: gefuellte Flaeche der Sonnenhoehe
      var acc = pal.col(w.ssArcColor, '#ffd166');
      ctx.beginPath(); ctx.moveTo(x0, y1);
      track.forEach(function (p) {
        var x = x0 + bw * (p.min / 1440);
        var e = Math.max(0, p.elev) / maxE;
        ctx.lineTo(x, y1 - (sh * 0.62) * e - sh * 0.12);
      });
      ctx.lineTo(x1, y1); ctx.closePath();
      var gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, ssA(acc, 0.42)); gr.addColorStop(1, ssA(acc, 0.06));
      ctx.fillStyle = gr; ctx.fill();

      // Auf- und Untergang
      var rs = LVSUN.riseSet(track);
      ctx.font = fs.toFixed(1) + 'px ' + pal.ff;
      ctx.fillStyle = ssA(pal.muted, 0.95); ctx.textBaseline = 'bottom';
      var curM = (ssNow(w) - ssMidnight(w)) / 60000;
      [[rs.rise, '↑'], [rs.set, '↓']].forEach(function (o) {
        if (o[0] == null) return;
        var x = x0 + bw * (o[0] / 1440);
        if (Math.abs(o[0] - curM) < 90) return;      // liegt unter dem Griff - weglassen
        ctx.beginPath(); ctx.moveTo(x, y0 + sh * 0.18); ctx.lineTo(x, y1);
        ctx.strokeStyle = ssA(pal.muted, 0.35); ctx.lineWidth = Math.max(0.6, K / 1100); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(o[1] + ' ' + ssHM(o[0]), x, y0 + sh * 0.16);
      });

      // Griff auf dem dargestellten Zeitpunkt
      var cur = (ssNow(w) - ssMidnight(w)) / 60000;
      var hx = x0 + bw * Math.max(0, Math.min(1440, cur)) / 1440;
      ctx.beginPath(); ctx.moveTo(hx, y0 + sh * 0.12); ctx.lineTo(hx, y1);
      ctx.strokeStyle = pal.accent; ctx.lineWidth = Math.max(1.2, K / 420); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, y1 - sh * 0.12, Math.max(2.6, K / 150), 0, 7);
      ctx.fillStyle = pal.accent; ctx.fill();
      var lab = ssHM(cur) + ((_ssState[w.id] && _ssState[w.id].now) ? '' : '  jetzt');
      ctx.font = '600 ' + (fs * 1.12).toFixed(1) + 'px ' + pal.ff;
      var lw = ctx.measureText(lab).width;
      ctx.textAlign = (hx + lw / 2 + 6 > x1) ? 'right' : (hx - lw / 2 - 6 < x0 ? 'left' : 'center');
      ctx.fillStyle = pal.accent;
      ctx.fillText(lab, ctx.textAlign === 'center' ? hx : (ctx.textAlign === 'right' ? x1 - 4 : x0 + 4), y0 + sh * 0.16);
      ctx.restore();
    }
    function ssHM(min) {
      var m = Math.max(0, Math.min(1439, Math.round(min)));
      return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    }

    /** Namensnennung - bei Nutzung von OSM-Daten rechtlich vorgeschrieben (ODbL). */
    function ssAttrib(ctx, W, H, K, pal, inset) {
      ctx.save();
      ctx.font = Math.max(8, K / 62) + 'px ' + pal.ff;
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = ssA(pal.muted, 0.7);
      ctx.fillText('Gebäude © OpenStreetMap-Mitwirkende', W - K / 42, H - K / 60 - (inset || 0));
      ctx.restore();
    }

    function ssSunDisc(ctx, cam, K, sun, clr, w) {
      if (sun.elev < -2) return;
      var R = cam.skyR, p = ssSky3(cam, sun.az, sun.elev, R);
      var base = K / 34, halo = base * (2.2 + (clr == null ? 1 : clr * 3.4));
      var gr = ctx.createRadialGradient(p.x, p.y, base * 0.3, p.x, p.y, halo);
      var a0 = (clr == null ? 0.55 : 0.35 + clr * 0.6);
      gr.addColorStop(0, 'rgba(255,240,200,' + Math.min(0.98, a0 + 0.3).toFixed(2) + ')');
      gr.addColorStop(0.34, 'rgba(255,201,64,' + (a0 * 0.5).toFixed(2) + ')');
      gr.addColorStop(1, 'rgba(255,180,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, halo, 0, 7); ctx.fill();
      ctx.fillStyle = sun.elev < 4 ? '#ffb765' : '#fff3cf';
      ctx.beginPath(); ctx.arc(p.x, p.y, base, 0, 7); ctx.fill();
      if (sun.elev > 0.5 && _covOn2(w, 'ssRay', true)) {
        var h = cam.project(0, 0, ssNum(w.ssHouseH, 7.5) + ssNum(w.ssRoofH, 3.5));
        ctx.save(); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(h.x, h.y);
        ctx.strokeStyle = 'rgba(255,209,102,' + (clr == null ? 0.22 : 0.1 + clr * 0.32).toFixed(2) + ')';
        ctx.lineWidth = Math.max(1, K / 420); ctx.setLineDash([K / 150, K / 60]); ctx.stroke(); ctx.restore();
      }
    }
    // Beschriftung: alles in Bezug auf K -> skaliert mit der Kachel
    function ssLabels(ctx, W, H, K, sun, rad, clr, track, w, mn, pal) {
      if (!_covOn2(w, 'ssInfo', true)) return;
      var f = Math.max(9, K / 22), pad = K / 26;
      ctx.save();
      ctx.font = '600 ' + f.toFixed(1) + 'px ' + pal.ff;
      ctx.fillStyle = ssA(pal.text, 0.94); ctx.textBaseline = 'top';
      // Steht die Sonne unter dem Horizont, uebernimmt der Mond die Kopfzeile.
      var nacht = (sun.elev < -1 && mn && mn.elev > -1);
      var t1 = nacht ? ('Mond ' + mn.elev.toFixed(0) + '°')
                     : ((sun.elev >= 0 ? 'Sonne ' + sun.elev.toFixed(0) + '°' : 'unter dem Horizont'));
      ctx.fillText(t1, pad, pad);
      ctx.font = (f * 0.72).toFixed(1) + 'px ' + pal.ff;
      ctx.fillStyle = ssA(pal.muted, 0.95);
      var t2;
      if (nacht) {
        t2 = LVSUN.moonName(mn.phase) + '  ·  ' + Math.round(mn.fraction * 100) + ' % beleuchtet';
      } else {
        t2 = 'Azimut ' + sun.az.toFixed(0) + '°';
        if (rad != null) t2 += '  ·  ' + Math.round(rad) + ' W/m²';
        if (clr != null) t2 += '  ·  ' + Math.round(clr * 100) + ' % klar';
      }
      ctx.fillText(t2, pad, pad + f * 1.15);
      var rs = LVSUN.riseSet(track);
      if (rs.rise != null && rs.set != null) {
        var hm = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0'); };
        var t3 = '↑ ' + hm(rs.rise) + '   ↓ ' + hm(rs.set);
        ctx.textAlign = 'right'; ctx.fillText(t3, W - pad, pad);
      }
      ctx.restore();
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
        if (sh && (e.clientY - r.top) > r.height - sh - Math.max(6, K / 40) * 2) {
          st.drag = { time: true, rect: r };                    // Zug auf der Zeitleiste
          ssSetTime(w, el, e.clientX, r, K);
          try { box.setPointerCapture(e.pointerId); } catch (_) {}
          e.preventDefault();
          return;
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
          if (st.drag.axis === 'v') { st.drag = null; return; }       // senkrecht -> Seite scrollen lassen
        }
        st.bearing = ((st.drag.b - dx * 0.4) % 360 + 360) % 360;
        e.preventDefault(); ssDraw(w, el);
      };
      function up(e) { if (st.drag) { st.drag = null; try { box.releasePointerCapture(e.pointerId); } catch (_) {} } }
      box.onpointerup = up; box.onpointercancel = up;

      // Mausrad zoomt den Umkreis. Nur wenn das Widget schon gedreht/bedient wurde oder
      // die Taste Strg gehalten wird - sonst wuerde Scrollen ueber der Kachel haengen bleiben.
      box.onwheel = function (e) {
        if (typeof editing !== 'undefined' && editing) return;
        if (!e.ctrlKey && st.radius == null && st.bearing == null) return;
        var r = st.radius != null ? st.radius : ssNum(w.ssRadius, 55);
        st.radius = Math.max(20, Math.min(400, r * (e.deltaY > 0 ? 1.12 : 0.89)));
        e.preventDefault(); ssDraw(w, el);
      };
      // Doppeltippen stellt die eingestellte Ansicht wieder her.
      box.ondblclick = function () {
        if (typeof editing !== 'undefined' && editing) return;
        st.bearing = null; st.pitch = null; st.radius = null; st.now = 0;
        st.key = null; ssDraw(w, el);
      };
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
      var fs = Math.max(9, K / 31), ns = fs * 0.60, ico = fs * 1.30, gap = fs * 0.46;
      var pad = fs * 0.6;
      // Platzbedarf der Beschriftung MESSEN - sie steht nach aussen, also muss der Ring
      // genau um diese Breite kleiner werden, sonst laeuft der laengste Wert aus dem Bild.
      var labW = 0;
      ctx.save();
      els.forEach(function (e) {
        ctx.font = '600 ' + fs.toFixed(1) + 'px ' + pal.ff;
        var a = ctx.measureText(e.watt != null ? ssFmtW(e.watt) : '–').width;
        ctx.font = ns.toFixed(1) + 'px ' + pal.ff;
        var b = e.name ? ctx.measureText(e.name.toUpperCase()).width : 0;
        var t = ico + gap + Math.max(a, b);
        if (t > labW) labW = t;
      });
      ctx.restore();
      var labH = ico + gap + fs + ns * 1.7;
      // Untere Grenze: die Zeitleiste bleibt frei, sonst decken Marken sie zu.
      var HB = H - ssStripH(w, K) - (ssStripH(w, K) ? Math.max(6, K / 40) * 1.6 : 0);
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
        if (showChip) ssLabel(ctx, K, p.x, p.y, p.dx, p.dy, e, redraw, pal, false);
      });

      if (showChip) {
        ssLabel(ctx, K, hp.x, hp.y - K / 6.5, 0, -1, { name: w.homeName || 'Haus',
          icon: w.homeIcon || 'housepower',
          col: pal.col(w.homeColor, pal.col(w.ssHouseColor, pal.accent)),
          watt: ssEnergyHome(els), dir: 1 }, redraw, pal, true);
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
    function ssLabel(ctx, K, x, y, dirX, dirY, e, redraw, pal, big) {
      var fs = Math.max(9, K / (big ? 24 : 31));
      var ns = fs * 0.60;
      var ico = fs * (big ? 1.45 : 1.30);
      var gap = fs * 0.46;
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

      ctx.font = '600 ' + fs.toFixed(1) + 'px ' + pal.ff;
      ctx.fillStyle = big ? e.col : ssA(pal.text, act ? 0.96 : 0.72);
      ctx.fillText(val, tx, ty);
      ctx.fillText(val, tx, ty);                              // zweimal = dichterer Schein

      if (e.name) {
        if ('letterSpacing' in ctx) ctx.letterSpacing = (ns * 0.08).toFixed(2) + 'px';
        ctx.font = ns.toFixed(1) + 'px ' + pal.ff;
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

    // ---- Widget ----
    defWidget('sunscene', {
      label: 'Sonnenszene', paletteIcon: 'sun', size: [420, 260], noHover: true,
      defaults: function (w) {
        w.ssPitch = 52; w.ssBearing = 20; w.ssRadius = 55;
        w.ssHouseL = 25; w.ssHouseB = 12; w.ssHouseH = 7.5; w.ssRoofH = 3.5; w.ssNorth = 0;
      },
      render: function () {
        return '<div class="ssc" data-role="ssbox"><canvas></canvas></div>';
      },
      mount: function (w) {
        var el = ssEl(w); if (!el) return;
        ssBind(w, el); ssDraw(w, el);
        // Groessenaenderung -> neu zeichnen (Kachel skaliert, Fenster, Reflow, Zoom)
        var box = $('[data-role=ssbox]', el);
        if (box && typeof ResizeObserver !== 'undefined') {
          if (_ssRO[w.id]) { try { _ssRO[w.id].disconnect(); } catch (_) {} }
          var ro = new ResizeObserver(function () { ssDraw(w, el); });
          ro.observe(box); _ssRO[w.id] = ro;
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
      live: function (w, el) { ssDraw(w, el); },
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
        h += row('Nordausrichtung (°)', '<input id="ssN" type="number" step="0.1" value="' + ssNum(w.ssNorth, 0) + '" style="width:64px">');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Der First verläuft entlang der <b>Länge</b>. Nordausrichtung dreht das Haus (0° = Länge in Ost-West-Richtung).</div>';
        h += '<div class="pgh">Nachbarschaft</div>';
        h += row('Gebäude zeigen', '<input type="checkbox" id="ssBuildings"' + (_covOn2(w, 'ssBuildings', true) ? ' checked' : '') + '>');
        h += row('Eigenes Haus aus OSM', '<input type="checkbox" id="ssOwnFromOsm"' + (_covOn2(w, 'ssOwnFromOsm', true) ? ' checked' : '') + '>');
        h += row('Suchradius (m)', '<input id="ssGeoR" type="number" min="50" max="1000" step="50" value="' + ssNum(w.ssGeoR, 250) + '" style="width:64px">');
        h += row('Höchstens … Gebäude', '<input id="ssMaxB" type="number" min="0" max="400" step="10" value="' + ssNum(w.ssMaxB, 60) + '" style="width:64px">');
        h += row('Satteldächer', '<input type="checkbox" id="ssBldRoof"' + (_covOn2(w, 'ssBldRoof', true) ? ' checked' : '') + '>');
        h += row('Gebäudefarbe', skinSel(w.ssBldColor || '', 'id="ssBldColor"'));
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Grundrisse stammen aus OpenStreetMap und werden einmalig je Standort geholt. Fehlt die Höhenangabe, wird nach Gebäudeart geschätzt (Garage 2,8 m, Wohnhaus 7 m). Die Satteldächer sind eine Annahme für die Ortsüblichkeit — OSM kennt die Dachformen hier nicht. Ist das eigene Haus dort erfasst, wird sein echter Grundriss verwendet — die Maße oben gelten dann nur noch als Rückfall.</div>';
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
        h += row('Fluss bewegen', '<input type="checkbox" id="ssEnAnim"' + (_covOn2(w, 'ssEnAnim', true) ? ' checked' : '') + '>');
        h += '<div class="pgh">Ansicht</div>';
        h += row('Neigung (°)', '<input id="ssP" type="number" min="0" max="70" value="' + ssNum(w.ssPitch, 52) + '" style="width:64px">');
        h += row('Blickrichtung (°)', '<input id="ssB" type="number" min="0" max="359" value="' + ssNum(w.ssBearing, 20) + '" style="width:64px">');
        h += row('Umkreis (m)', '<input id="ssR" type="number" min="20" max="400" value="' + ssNum(w.ssRadius, 55) + '" style="width:64px">');
        h += row('Zeitleiste', '<input type="checkbox" id="ssStrip"' + (_covOn2(w, 'ssStrip', true) ? ' checked' : '') + '>');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Zeigt die Tageskurve der Sonnenhöhe. Ziehen fährt den Tag durch — Schatten, Sonnenstand und Mond folgen. Doppeltippen kehrt zu „jetzt" zurück; die gewählte Zeit wird nicht gespeichert.</div>';
        h += row('Mond', '<input type="checkbox" id="ssMoon"' + (_covOn2(w, 'ssMoon', true) ? ' checked' : '') + '>');
        h += row('Sterne', '<input type="checkbox" id="ssStars"' + (_covOn2(w, 'ssStars', true) ? ' checked' : '') + '>');
        h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Der Mond steht an seinem berechneten Platz am Himmel und zeigt die echte Phase; die beleuchtete Seite weist zur Sonne. Ab Dämmerung blendet er ein, tagsüber aus.</div>';
        h += row('Einfallstrahl', '<input type="checkbox" id="ssRay"' + (_covOn2(w, 'ssRay', true) ? ' checked' : '') + '>');
        h += row('Infozeile', '<input type="checkbox" id="ssInfo"' + (_covOn2(w, 'ssInfo', true) ? ' checked' : '') + '>');
        h += row('Hausfarbe', skinSel(w.ssHouseColor || '', 'id="ssHouseColor"'));
        return h;
      },
      wire: function (w) {
        function up() { var e = ssEl(w); if (e) { ssSt(w).key = null; ssDraw(w, e); } commit(); }
        ssImportWire(w, up);
        [['ssHN', 'homeName'], ['ssHI', 'homeIcon']].forEach(function (o) {
          var e = $('#' + o[0]); if (e) e.onchange = function () { w[o[1]] = this.value || undefined; up(); };
        });
        [['ssGeoR', 'ssGeoR'], ['ssMaxB', 'ssMaxB'], ['ssEnRad', 'ssEnRad'], ['ssEnA0', 'ssEnA0'], ['ssEnRef', 'ssEnRef'], ['ssLat', 'lat'], ['ssLon', 'lon'], ['ssHL', 'ssHouseL'], ['ssHB', 'ssHouseB'], ['ssHH', 'ssHouseH'],
         ['ssHR', 'ssRoofH'], ['ssN', 'ssNorth'], ['ssP', 'ssPitch'], ['ssB', 'ssBearing'], ['ssR', 'ssRadius']].forEach(function (o) {
          var e = $('#' + o[0]); if (e) e.onchange = function () {
            w[o[1]] = this.value === '' ? undefined : parseFloat(this.value);
            if (o[1] === 'ssBearing' || o[1] === 'ssPitch') { var s = ssSt(w); s.bearing = null; s.pitch = null; }
            up();
          };
        });
        [['ssRay', 'ssRay'], ['ssInfo', 'ssInfo'], ['ssPlot', 'ssPlot'],
         ['ssBuildings', 'ssBuildings'], ['ssOwnFromOsm', 'ssOwnFromOsm'], ['ssBldRoof', 'ssBldRoof'],
         ['ssMoon', 'ssMoon'], ['ssStars', 'ssStars'], ['ssStrip', 'ssStrip'], ['ssEnChip', 'ssEnChip'], ['ssEnAnim', 'ssEnAnim']].forEach(function (o) {
          var e = $('#' + o[0]); if (e) e.onchange = function () { w[o[1]] = this.checked; up(); };
        });
        if ($('#ssHouseColor')) $('#ssHouseColor').onchange = function () { w.ssHouseColor = this.value || undefined; up(); };
        if ($('#ssBldColor')) $('#ssBldColor').onchange = function () { w.ssBldColor = this.value || undefined; up(); };
        // fieldPick (data-fid/-fpick/-fclr) wird zentral in 04-props.js verdrahtet - hier nichts zu tun.
      }
    });
  })();
