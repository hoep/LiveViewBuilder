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
    var r = box.getBoundingClientRect();
    var W = Math.max(60, Math.round(r.width)), H = Math.max(50, Math.round(r.height));
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
        var R = flRadius(w), d = _flCache[R], nacht = flNacht(w);
        var cx = W / 2, cy = H * 0.755, tilt = Math.max(0.15, Math.min(0.7, (parseFloat(w.flTilt) || 38) / 100));
        var s = (W * 0.40) / R;
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
          g.font = '600 10.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = t.col;
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
        var R = flRadius(w), d = _flCache[R], nacht = flNacht(w);
        var cx = W / 2, cy = H / 2, rad = Math.min(W, H) / 2 - Math.max(18, W * 0.07);
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
          }
        });
        // Sichtbare Satelliten kommen in dieselbe Kuppel - dieselbe Frage,
        // dieselbe Antwort: wohin muss ich schauen.
        if (w.flSats && typeof satJetzt === 'function') {
          satJetzt('stations', { lat: 48.0657, lon: 14.1241 }, function (L) {
            L.forEach(function (s) {
              if (!s.sichtbar) { return; }
              var a2 = s.az * Math.PI / 180, r2 = rad * (90 - s.el) / 90;
              var sx = cx + Math.sin(a2) * r2, sy = cy - Math.cos(a2) * r2;
              g.beginPath(); g.arc(sx, sy, 4, 0, 7);
              g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
              g.font = '600 9.5px ' + (cssv('--fm') || 'monospace'); g.fillStyle = '#fff';
              g.fillText(s.name, sx + 9, sy + 3);
            });
          });
        }
      };
      flLade(flRadius(w), function () { zeichne(); });
      flBeobachte(w, zeichne); flTakt(w, zeichne); zeichne();
      flTaktSicher(w, 'poll', 30000, function () { flLade(flRadius(w), null); });
    },
    props: function (w) {
      return row('Umkreis (km)', '<input id="pFsR" type="number" min="5" max="200" value="' + (w.flRadius || 30) + '">')
        + row('Rufzeichen zeigen', '<input type="checkbox" id="pFsL"' + (w.flLabels !== false ? ' checked' : '') + '>')
        + row('Satelliten', '<input type="checkbox" id="pFsS"' + (w.flSats ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">sichtbare Überflüge mit einzeichnen</span>');
    },
    wire: function (w) {
      if ($('#pFsR')) $('#pFsR').onchange = function () { w.flRadius = parseInt(this.value) || 30; render(); commit(); };
      if ($('#pFsL')) $('#pFsL').onchange = function () { w.flLabels = this.checked; render(); commit(); };
      if ($('#pFsS')) $('#pFsS').onchange = function () { w.flSats = this.checked || undefined; render(); commit(); };
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
          h += '<div class="flz' + (el >= 45 ? ' zen' : '') + '">'
            + '<div><div class="flruf" style="color:' + col + '">' + esc(f.ruf || '—') + '</div>'
            + '<div class="flk">' + ({ jet: 'Jet', prop: 'Propeller', heli: 'Hubschr.' }[art]) + '</div></div>'
            + '<div>' + route + '<div class="flm"><b>' + (p.alt / 1000).toFixed(1) + '</b> km · <b>'
            + f.tempo + '</b> km/h ' + steig
            + ' <span class="flpill">' + HIMMEL[Math.round(az / 22.5) % 16] + ' ' + Math.round(el) + '°</span>'
            + (el >= 45 ? '<span class="flzen">fast senkrecht</span>' : '') + '</div></div>'
            + '<div class="flre"><span class="flg">' + dist.toFixed(1) + '</span>km jetzt<br>'
            + '<span style="color:var(--warm)">' + f.cpa_km.toFixed(1) + '</span> km in '
            + Math.round(f.cpa_min) + ' min</div></div>';
        });
        if (!d.flug.length) h = '<div class="hint" style="padding:10px;color:var(--faint);font-size:11px">nichts im Umkreis</div>';
        box.innerHTML = h;
      };
      flLade(flRadius(w), function () { zeichne(); });
      flBeobachte(w, zeichne);
      flTaktSicher(w, 'liste', 2000, zeichne);   // Liste braucht keine 5 Bilder je Sekunde
      zeichne();
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
