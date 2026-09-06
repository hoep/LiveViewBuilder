  // ===== Widget: Klimaseite A (klimaa) — pixelgenaue Umsetzung des Entwurfs =====
  //
  // Verfahren wie klimac/klimab: CSS des Entwurfs woertlich unter .ka-c, Buehne
  // als Ganzes skaliert. Das Besondere an A: der Schnitt IST die Seite. Die
  // Raeume stehen an ihrem Platz im Haus, zwei Verlaeufe laufen senkrecht durch
  // das Bild - die Fuellung wird nach oben waermer, der Feuchtebalken nach unten
  // laenger. Damit ist die Empfehlung sichtbar begruendet statt behauptet.
  var _KA_W = 1470, _KA_H = 900;

  function _kaZ(v, k) {
    if (v == null || v === '' || isNaN(v)) { return '—'; }
    return Number(v).toFixed(k == null ? 1 : k).replace('.', ',');
  }
  var _KA_ST = { 1: ['↑', 'querlüften', 'ok'], 2: ['↑', 'öffnen', 'ok'], 3: ['↑', 'offen lassen', 'ok'],
                 4: ['×', 'zu lassen', 'warn'], 5: ['⇅', 'stoßlüften', 'info'],
                 7: ['×', 'schließen', 'crit'], 8: ['×', 'Gewitter', 'crit'],
                 0: ['·', 'nichts zu tun', 'faint'], 12: ['·', '—', 'faint'] };

  function _kaSchnitt(d) {
    var L = d.lage || {}, R = (d.raeume || []).filter(function (r) { return r.t != null; });
    if (!R.length || L.t == null) { return ''; }
    var tmin = Math.min.apply(null, R.map(function (r) { return r.t; }));
    var tmax = Math.max.apply(null, R.map(function (r) { return r.t; }));
    var sp = Math.max(0.5, tmax - tmin);
    var G = ['Dachgeschoss', 'Obergeschoss', 'Erdgeschoss'], KZ = ['DG', 'OG', 'EG'];
    var pad = [140, 40, 0];                     // Dachgeschoss unter der Schraege eingerueckt
    var fx = '', fl = '';
    G.forEach(function (gn, gi) {
      var rr = R.filter(function (r) { return r.geschoss === gn; });
      if (!rr.length) { return; }
      rr.sort(function (a, b) { return b.t - a.t; });
      var mit = rr.reduce(function (a, r) { return a + r.t; }, 0) / rr.length;
      var phm = rr.reduce(function (a, r) { return a + (r.phi || 0); }, 0) / rr.length;
      var dT = mit - L.t;
      var col = dT >= 6 ? 'ok' : (dT >= 3 ? 'accent' : 'info');
      var top = 81 + gi * 162;
      var pfeil = dT >= 3 ? '→' : '⇅';
      ['l', 'r'].forEach(function (seite) {
        fx += '<div class="fx fx-' + seite + '" style="top:' + top + 'px;color:var(--' + col + ')">'
            + '<em>' + pfeil + '</em><b>' + (dT >= 0 ? '−' : '+') + _kaZ(Math.abs(dT)) + ' °</b></div>';
      });
      var zellen = rr.map(function (r) {
        var a = (r.t - tmin) / sp;
        var st = _KA_ST[r.lz] || _KA_ST[12];
        var ph = r.phi != null ? Math.max(0, Math.min(100, (r.phi - 40) / 50 * 100)) : 0;
        var pcol = (r.phi || 0) >= 80 ? 'crit' : ((r.phi || 0) >= 72 ? 'warn' : 'info');
        return '<div class="rm" style="background:color-mix(in oklab,var(--crit) '
          + (8 + a * 36).toFixed(0) + '%,var(--tile))">'
          + '<i class="sb" style="background:var(--' + st[2] + ')"></i>'
          + '<div class="nm">' + esc(r.raum) + '</div>'
          + '<div class="tv"><b>' + _kaZ(r.t) + '</b><s> °C</s></div>'
          + '<div class="dl">' + (r.t - L.t >= 0 ? '−' : '+') + _kaZ(Math.abs(r.t - L.t)) + ' °</div>'
          + '<div class="st" style="color:var(--' + st[2] + ')"><em>' + st[0] + '</em>' + esc(st[1]) + '</div>'
          + '<div class="ph"><i style="width:' + ph.toFixed(1) + '%;background:var(--' + pcol + ')"></i></div>'
          + '<div class="pl"><span>φ ' + _kaZ(r.phi, 0) + ' %</span><span>' + _kaZ(r.wand) + ' °C</span></div>'
          + '</div>';
      }).join('');
      fl += '<div class="fl fl-' + KZ[gi] + '">'
          + '<div class="fg"><div class="fn">' + esc(gn) + '</div>'
          + '<div class="fm"><s>Ø</s> <b>' + _kaZ(mit) + '</b> °C</div>'
          + '<div class="fp">φ Ø ' + _kaZ(phm, 0) + ' %</div></div>'
          + '<div class="fr" style="padding-left:' + pad[gi] + 'px;padding-right:' + pad[gi] + 'px">'
          + zellen + '</div></div>';
    });
    return '<div class="air">' + fx
      + '<div class="hb">'
      + '<svg class="roof" viewBox="0 0 860 162" width="860" height="162" preserveAspectRatio="none">'
      + '<polygon points="14,162 154,2 706,2 846,162" class="rf"/>'
      + '<polyline points="0,162 14,161 154,1 706,1 846,161 860,162" class="rl"/></svg>'
      + fl + '</div></div>';
  }

  function _kaGruppen(d) {
    var R = d.raeume || [];
    var ZT = { 3: ['↑', 'Offen lassen bis zum Morgen', 'ok'], 1: ['↑', 'Querlüften', 'ok'],
               2: ['↑', 'Fenster öffnen', 'accent'], 5: ['⇅', 'Stoßlüften, rund 10 Minuten', 'info'],
               4: ['×', 'Geschlossen halten', 'warn'], 7: ['×', 'Schließen — Regen', 'crit'],
               8: ['×', 'Schließen — Gewitter', 'crit'], 0: ['·', 'Nichts zu tun', 'faint'],
               12: ['·', 'Keine Aussage', 'faint'] };
    var g = {};
    R.forEach(function (r) { (g[r.lz] = g[r.lz] || []).push(r); });
    return [8, 7, 5, 3, 1, 2, 4, 0, 12].filter(function (z) { return g[z] && g[z].length; }).map(function (z) {
      var rr = g[z], t = ZT[z] || ZT[12];
      var dl = rr.map(function (r) { return r.t - (d.lage ? d.lage.t : 0); });
      var gw = rr.map(function (r) { return r.gewinn ? r.gewinn[1] : 0; }).filter(function (x) { return x; });
      var phs = rr.map(function (r) { return r.phi || 0; });
      return '<div class="gr" style="--c:var(--' + t[2] + ')">'
        + '<div class="gh"><span class="gn">' + rr.length + '</span><span class="gg">' + t[0] + '</span>'
        + '<span class="gt">' + esc(t[1]) + '</span></div>'
        + (gw.length ? '<div class="gk">−' + _kaZ(Math.min.apply(null, gw)) + ' bis −' + _kaZ(Math.max.apply(null, gw)) + ' °</div>' : '')
        + '<div class="gw">Außenluft liegt ' + _kaZ(Math.min.apply(null, dl)) + ' bis '
        + _kaZ(Math.max.apply(null, dl)) + ' ° darunter, φ an der Wand zwischen '
        + _kaZ(Math.min.apply(null, phs), 0) + ' und ' + _kaZ(Math.max.apply(null, phs), 0) + ' %.</div>'
        + '<div class="gl-r">' + rr.map(function (r) { return esc(r.raum); }).join(' · ') + '</div>'
        + '</div>';
    }).join('');
  }

  /** Verlauf unten: 24 h zurueck. Buehne 1005x130 wie im Entwurf. */
  function _kaVerlauf(w) {
    var h = w._kaHist || {}, W = 1005, H = 130;
    var s = ['aussen', 'warm', 'kuehl'].map(function (k) { return h[k] || []; });
    var alle = []; s.forEach(function (d) { d.forEach(function (p) { alle.push(p[1]); }); });
    if (alle.length < 4) { return ''; }
    var lo = Math.floor(Math.min.apply(null, alle)) - 1, hi = Math.ceil(Math.max.apply(null, alle)) + 1;
    var t0 = s[0][0][0], t1 = s[0][s[0].length - 1][0], sp = Math.max(1, t1 - t0);
    function X(t) { return 34 + (t - t0) / sp * (W - 152); }
    function Y(v) { return 10 + (hi - v) / Math.max(1, hi - lo) * 98; }
    var out = '', v;
    // Nachtflaechen
    var d0 = new Date(t0 * 1000);
    for (var tg = -1; tg <= 1; tg++) {
      var na = new Date(d0); na.setHours(20, 0, 0, 0); na.setDate(na.getDate() + tg);
      var ne = new Date(na); ne.setHours(ne.getHours() + 10);
      var a = na.getTime() / 1000, b = ne.getTime() / 1000;
      if (b < t0 || a > t1) { continue; }
      out += '<rect x="' + X(Math.max(a, t0)).toFixed(1) + '" y="10" width="'
           + Math.max(1, X(Math.min(b, t1)) - X(Math.max(a, t0))).toFixed(1) + '" height="98" class="nf"/>';
    }
    for (v = lo + (2 - (lo % 2)); v <= hi; v += 2) {
      out += '<line x1="34" y1="' + Y(v).toFixed(1) + '" x2="' + (W - 118).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gl"/>'
           + '<text x="28" y="' + (Y(v) + 3.4).toFixed(1) + '" class="kaax" text-anchor="end">' + v + ' °C</text>';
    }
    [['info', 0], ['crit', 1], ['faint', 2]].forEach(function (p) {
      var d = s[p[1]];
      if (d.length < 2) { return; }
      out += '<polyline points="' + d.map(function (q) { return X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1); }).join(' ')
           + '" fill="none" stroke="var(--' + p[0] + ')" stroke-width="1.6"/>';
    });
    return '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' + out + '</svg>';
  }

  function _kaBuehne(w) {
    var d = w._ka;
    if (!d) { return '<div class="kc-warten">wird geladen …</div>'; }
    var L = d.lage || {}, R = d.raeume || [];
    var warm = null, kalt = null;
    R.forEach(function (r) {
      if (r.t == null) { return; }
      if (warm === null || r.t > warm) { warm = r.t; }
      if (kalt === null || r.t < kalt) { kalt = r.t; }
    });
    var spanne = (warm != null && L.t != null) ? (warm - L.t) : null;
    var unter = (kalt != null && L.t != null && L.t < kalt);
    var jetzt = new Date();
    return '<header class="blk">'
      + '<div><div class="h1">Kann ich <span>lüften</span>?</div>'
      + '<div class="sub">Haus im Schnitt · ' + R.length + ' Räume · '
      + ('0' + jetzt.getHours()).slice(-2) + ':' + ('0' + jetzt.getMinutes()).slice(-2) + '</div></div>'
      + '<div class="kasep"></div>'
      + '<div class="sub" style="max-width:520px;line-height:1.35">'
      + (unter ? 'Die Außenluft ist unter jeden Raum gefallen.' : 'Die Außenluft liegt noch über einzelnen Räumen.')
      + '<br>Oben liegen <b style="color:var(--crit);font-family:var(--fm)">' + _kaZ(spanne) + ' °</b> bereit.</div>'
      + '<div class="out">'
      + '<div class="o"><div class="ok2">Taupunkt</div><div class="ov">' + _kaZ(L.tp) + ' °C</div></div>'
      + '<div class="o"><div class="ok2">Wind</div><div class="ov">' + _kaZ(L.wind) + ' km/h</div></div>'
      + '<div class="o"><div class="ok2">rel. Feuchte</div><div class="ov">' + _kaZ(L.rh, 0) + ' %</div></div>'
      + '<div class="kasep"></div>'
      + '<div class="o"><div class="ok2">Außenluft</div><div class="ov" style="color:var(--info)">' + _kaZ(L.t) + ' °C</div></div>'
      + '</div></header>'
      + '<div class="mid">'
      + '<section class="blk house"><div class="hh"><div class="bt">Das Haus im Schnitt</div>'
      + '<div class="lead" style="margin-left:auto">Füllung = Raumtemperatur · Balken = φ an der kältesten Wand, Grenze 80 %</div></div>'
      + _kaSchnitt(d) + '</section>'
      + '<aside class="blk act"><div class="bt">Was jetzt zu tun ist</div>'
      + '<div class="grs">' + _kaGruppen(d) + '</div></aside>'
      + '</div>'
      + '<div class="low"><section class="blk chart">'
      + '<div class="chh"><div class="bt">24 Stunden zurück</div>'
      + '<div class="leg"><span><i style="background:var(--info)"></i>Außen</span>'
      + '<span><i style="background:var(--crit)"></i>wärmster Raum</span>'
      + '<span><i style="background:var(--faint)"></i>kühlster Raum</span>'
      + '<span><i style="background:color-mix(in oklab,var(--sky-night) 55%,transparent);height:9px;border-radius:2px"></i>Nacht</span>'
      + '</div></div>' + _kaVerlauf(w) + '</section></div>'
      + '<footer><b>Messwerte</b> der letzten Abfrage · Bewertung alle 15 Minuten · '
      + R.length + ' Räume</footer>';
  }

  function _kaSkalieren(el) {
    var box = el.querySelector('[data-role=kab]'), st = el.querySelector('[data-role=kas]');
    if (!box || !st) { return; }
    var bw = box.clientWidth, bh = box.clientHeight;
    if (!bw || !bh) { return; }
    var k = Math.min(bw / _KA_W, bh / _KA_H);
    st.style.transform = 'translate(' + ((bw - _KA_W * k) / 2).toFixed(1) + 'px,'
      + ((bh - _KA_H * k) / 2).toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
  }
  function _kaMal(w) {
    [document.getElementById('ovcanvas'), (typeof canvas !== 'undefined' ? canvas : null)].forEach(function (root) {
      if (!root) { return; }
      [].slice.call(root.querySelectorAll('.w[data-id="' + w.id + '"]')).forEach(function (el) {
        var st = el.querySelector('[data-role=kas]');
        if (!st) { return; }
        st.innerHTML = _kaBuehne(w);
        _kaSkalieren(el);
      });
    });
  }
  function _kaHistorie(w, d) {
    var R = (d.raeume || []).filter(function (r) { return r.t != null; });
    if (!R.length) { return; }
    var warm = R[0], kuehl = R[0];
    R.forEach(function (r) { if (r.t > warm.t) { warm = r; } if (r.t < kuehl.t) { kuehl = r; } });
    var von = Math.floor(Date.now() / 1000) - 86400, bis = Math.floor(Date.now() / 1000);
    var ziel = { aussen: 14288, warm: warm.tvid, kuehl: kuehl.tvid }, offen = 0, acc = {};
    Object.keys(ziel).forEach(function (k) {
      if (!ziel[k]) { acc[k] = []; return; }
      offen++;
      fetch('?api=history&id=' + ziel[k] + '&from=' + von + '&to=' + bis, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { acc[k] = ((j && j.data) || []).map(function (p) { return [p[0] / 1000, p[1]]; }); })
        .catch(function () { acc[k] = []; })
        .then(function () { if (--offen <= 0) { w._kaHist = acc; _kaMal(w); } });
    });
  }

  defWidget('klimaa', {
    label: 'Klimaseite · Haus', cat: 'Anzeige', paletteIcon: 'home', size: [1470, 900], noHover: true,
    defaults: function (w) { w.mmSec = 120; },
    render: function () {
      return '<div class="ka-box" data-role="kab"><div class="ka-c" data-role="kas">'
           + '<div class="kc-warten">wird geladen …</div></div></div>';
    },
    live: function (w, el) { if (el) { _kaSkalieren(el); } }
  });

  setInterval(function () {
    if (typeof state === 'undefined' || !state.widgets) { return; }
    var now = Date.now();
    function takt(w) {
      if (!w || w.type !== 'klimaa') { return; }
      if (now - (w._kaZeit || 0) < (w.mmSec || 120) * 1000) { return; }
      w._kaZeit = now;
      _mmDaten2((w.mmSec || 120) * 1000, function (j) {
        if (!j) { return; }
        w._ka = j; _kaMal(w); _kaHistorie(w, j);
      });
    }
    allWidgets().forEach(takt);
    if (typeof _tickKids !== 'undefined' && _tickKids) { _tickKids.forEach(takt); }
    if (typeof _popup !== 'undefined' && _popup && _popup.widgets) { _popup.widgets.forEach(takt); }
  }, 2500);
