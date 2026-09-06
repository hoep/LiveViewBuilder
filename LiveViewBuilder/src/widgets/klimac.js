  // ===== Widget: Klimaseite C (klimac) — pixelgenaue Umsetzung des Entwurfs =====
  //
  // Warum ein eigenes Widget und keine Betriebsart des moldmap:
  //
  // Der Entwurf ist FEST VERMASST - 144 Pixelwerte, kein einziges clamp(). Der
  // erste Versuch hat ihn in Standardkacheln uebersetzt und alles ueber
  // clamp(...,cqmin,...) skaliert; damit haengt jede Schriftgroesse und jeder
  // Abstand an der Kachelgroesse statt an der Vorlage, und pixelgenau kann das
  // nie werden. Hier steht das Markup und das CSS des Entwurfs unveraendert.
  //
  // Responsiv trotzdem: die Seite ist eine BUEHNE von 1440x900, die als Ganzes
  // gleichmaessig skaliert wird (transform: scale). Die Verhaeltnisse bleiben
  // exakt wie gezeichnet, nur groesser oder kleiner - kein Umbruch, keine
  // verschobenen Abstaende.
    // Buehne 1470x900 (Zielgeraet). Der Entwurf ist auf 1440 gesetzt; die 30 px
  // Mehrbreite bekommt die LINKE Spalte, damit kein Element seine Masse aendert
  // und nur der ohnehin luftigste Bereich mitwaechst.
  var _KC_W = 1470, _KC_H = 900;

  /** Regenangabe: eine Zahl wie "2743 min" ist keine Aussage, sondern Rohdaten. */
  function _kcRegen(m) {
    if (m == null || m < 0) { return '—'; }
    if (m <= 90)  { return m + ' min'; }
    if (m <= 600) { return Math.round(m / 60) + ' h'; }
    return 'kein Regen';
  }
  function _kcZ(v, k) {
    if (v == null || v === '' || isNaN(v)) { return '—'; }
    return Number(v).toFixed(k == null ? 1 : k).replace('.', ',');
  }
  /** Gruppiert die Empfehlungen zu Verbuenden und ordnet sie nach Nutzen. */
  function _kcGruppen(d) {
    var tun = (d.raeume || []).filter(function (r) { return [1, 2, 3, 5, 7, 8].indexOf(r.lz) >= 0; });
    var g = {}, reihe = [];
    tun.forEach(function (r) {
      var k = r.verbund || ('#' + r.raum);
      if (!g[k]) { g[k] = { key: k, verbund: r.verbund, raeume: [], lz: r.lz, gewinn: r.gewinn, art: r.art, lt: r.lt }; reihe.push(g[k]); }
      g[k].raeume.push(r);
      if (r.t != null && (g[k].tmax == null || r.t > g[k].tmax)) { g[k].tmax = r.t; g[k].warm = r; }
    });
    reihe.sort(function (a, b) { return ((b.gewinn && b.gewinn[1]) || 0) - ((a.gewinn && a.gewinn[1]) || 0); });
    return reihe;
  }
  var _KC_CHIP = { kamin: 'Kaminlüftung', quer: 'querlüften', einseitig: 'Fenster ganz öffnen' };
  var _KC_LZ   = { 3: 'nachts offen lassen', 1: 'querlüften', 2: 'Fenster öffnen',
                   5: 'stoßlüften', 7: 'schließen — Regen', 8: 'schließen — Gewitter' };

  /** Eine Handlungskarte - Aufbau Zeichen fuer Zeichen wie im Entwurf. */
  function _kcKarte(g, i, aussen) {
    var gw = g.gewinn ? g.gewinn[1] : 0, warm = g.warm || g.raeume[0];
    var titel = g.verbund || warm.raum;
    var chip = _KC_CHIP[g.art] || _KC_LZ[g.lz] || '';
    var ziel = (g.tmax != null && gw) ? (g.tmax - gw) : null;
    var anteil = (aussen != null && g.tmax != null && g.tmax > aussen)
      ? Math.max(0, Math.min(1, gw / (g.tmax - aussen))) : 0;
    var gs = (g.verbund ? g.raeume.map(function (r) { return r.raum; }).join(' · ')
                        : (warm.geschoss || ''));
    return '<div class="act a' + (i + 1) + '">'
      + '<div>'
      + '<div class="top"><span class="rk">' + (i + 1) + '</span><span class="chip">' + esc(chip) + '</span></div>'
      + '<div class="rm">' + esc(titel) + '</div>'
      + '<div class="gs"><i>' + esc(warm.geschoss || '') + '</i>' + (gs && g.verbund ? ' · ' + esc(gs) : '') + '</div>'
      + '</div>'
      + '<div class="gauge">'
      + '<div class="tr"><span class="seg" style="width:' + ((1 - anteil) * 100).toFixed(1) + '%"></span>'
      + '<span class="edge" style="left:' + (anteil * 100).toFixed(1) + '%"></span></div>'
      + '<div class="glab"><span><b>' + _kcZ(aussen) + ' °C außen</b></span>'
      + '<span><b>' + _kcZ(g.tmax) + ' °C jetzt</b></span></div>'
      + '</div>'
      + '<div class="num"><div class="k">' + (gw ? '−' + _kcZ(gw) + ' °' : '—') + '</div>'
      + '<div class="t">' + _kcZ(g.tmax) + ' <s>→</s> ' + (ziel != null ? _kcZ(ziel) : '—') + ' °C</div></div>'
      + '<div class="foot">'
      + '<div class="why">' + esc(g.lt || '') + '</div>'
      + '<div class="kcside">'
      + '<div><div class="v">' + _kcZ(warm.wand) + ' °C</div><div class="c">Wandtemp.</div></div>'
      + '<div><div class="v">' + _kcZ(warm.phi, 0) + ' %</div><div class="c">an der Wand</div></div>'
      + '<div><div class="v">' + (warm.stufe != null ? warm.stufe : '—') + '</div><div class="c">Schimmelstufe</div></div>'
      + '</div></div></div>';
  }

  /** Gefaelle je Geschoss als SVG - dieselbe Buehne (452x170) wie im Entwurf. */
  function _kcGefaelle(d) {
    var L = d.lage || {}, R = (d.raeume || []).filter(function (r) { return r.t != null; });
    if (!R.length || L.t == null) { return ''; }
    var G = ['Dachgeschoss', 'Obergeschoss', 'Erdgeschoss'], KL = ['hot', 'mid', 'cool'];
    var alle = R.map(function (r) { return r.t; }).concat([L.t]);
    var lo = Math.min.apply(null, alle) - 0.5, hi = Math.max.apply(null, alle) + 0.5, sp = Math.max(0.5, hi - lo);
    var x0 = 147.3, x1 = 400, bw = x1 - x0;
    function px(t) { return x0 + (t - lo) / sp * bw; }
    var out = '<line class="ax-out" x1="' + px(L.t).toFixed(1) + '" y1="14" x2="' + px(L.t).toFixed(1) + '" y2="150"/>';
    G.forEach(function (gn, gi) {
      var rr = R.filter(function (r) { return r.geschoss === gn; });
      if (!rr.length) { return; }
      var y = 30 + gi * 44, ts = rr.map(function (r) { return r.t; });
      var kalt = Math.min.apply(null, ts), warm = Math.max.apply(null, ts);
      var gws = rr.map(function (r) { return r.gewinn ? r.gewinn[1] : 0; }).filter(function (x) { return x; });
      out += '<rect class="band band-' + KL[gi] + '" x="' + px(kalt).toFixed(1) + '" y="' + y.toFixed(1)
           + '" width="' + Math.max(2, px(warm) - px(kalt)).toFixed(1) + '" height="20" rx="4"/>';
      rr.forEach(function (r) {
        out += '<circle class="kcdot dot-' + KL[gi] + '" cx="' + px(r.t).toFixed(1) + '" cy="' + (y + 10).toFixed(1) + '" r="4"/>';
      });
      out += '<text class="ax-lab" x="0" y="' + (y + 9).toFixed(1) + '">' + esc(gn) + '</text>'
           + '<text class="kcaxsub" x="0" y="' + (y + 23).toFixed(1) + '">' + rr.length + ' Räume'
           + (gws.length ? ' · ' + _kcZ(Math.min.apply(null, gws)) + '–' + _kcZ(Math.max.apply(null, gws)) + ' °' : '') + '</text>'
           + '<text class="kcaxval val-' + KL[gi] + '" x="' + (px(warm) + 7).toFixed(1) + '" y="' + (y + 14).toFixed(1) + '">'
           + _kcZ(warm) + ' °C</text>';
    });
    return out;
  }

  /** Verlauf der letzten 24 h - Buehne 452x170 wie im Entwurf. */
  function _kcVerlauf(w) {
    var h = w._kcHist;
    if (!h || !h.aussen || !h.aussen.length) { return ''; }
    var alle = [];
    ['aussen', 'warm', 'kuehl'].forEach(function (k) { (h[k] || []).forEach(function (p) { alle.push(p[1]); }); });
    if (!alle.length) { return ''; }
    var lo = Math.floor(Math.min.apply(null, alle)) - 1, hi = Math.ceil(Math.max.apply(null, alle)) + 1;
    var t0 = h.aussen[0][0], t1 = h.aussen[h.aussen.length - 1][0], sp = Math.max(1, t1 - t0);
    function X(t) { return 40 + (t - t0) / sp * 400; }
    function Y(v) { return 146 - (v - lo) / Math.max(1, hi - lo) * 132; }
    var out = '', v;
    for (v = lo + (2 - (lo % 2)); v <= hi; v += 2) {
      out += '<line class="grid" x1="40.0" y1="' + Y(v).toFixed(1) + '" x2="440.0" y2="' + Y(v).toFixed(1) + '"/>'
           + '<text class="c-tk" x="32.0" y="' + (Y(v) + 3.5).toFixed(1) + '">' + v + '</text>';
    }
    ['aussen:ln-au', 'warm:ln-bk', 'kuehl:ln-wc'].forEach(function (s) {
      var k = s.split(':')[0], cls = s.split(':')[1], d = h[k] || [];
      if (d.length < 2) { return; }
      out += '<polyline class="ln ' + cls + '" points="'
        + d.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    });
    return out;
  }

  /** Lueftungsfenster 452x52 wie im Entwurf. */
  function _kcFenster(d) {
    var L = d.lage || {}, jetzt = new Date();
    var h0 = 18, h1 = 33;                        // 18:00 heute bis 09:00 morgen
    function X(hh) { return 8 + Math.max(0, Math.min(1, (hh - h0) / (h1 - h0))) * 436; }
    var nh = jetzt.getHours() + jetzt.getMinutes() / 60; if (nh < h0) { nh += 24; }
    var von = null, bis = null;
    if (L.startUm && /^\d{1,2}:\d{2}$/.test(L.startUm)) {
      von = parseInt(L.startUm.split(':')[0], 10) + parseInt(L.startUm.split(':')[1], 10) / 60;
      if (von < h0) { von += 24; }
    }
    bis = 30;                                    // 06:00 des Folgetags
    var out = '<rect class="lf-bg" x="8" y="10" width="436" height="16" rx="8"/>';
    if (von != null && bis > von) {
      out += '<rect class="lf-on" x="' + X(von).toFixed(1) + '" y="10" width="'
           + Math.max(2, X(bis) - X(von)).toFixed(1) + '" height="16" rx="8"/>';
    }
    // Marken, die der Jetzt-Linie zu nahe kommen, werden weggelassen - zwei
    // uebereinander gedruckte Uhrzeiten sind unleserlicher als eine fehlende.
    var xn = X(nh), frei = function (x) { return Math.abs(x - xn) > 34; };
    out += '<rect class="lf-now" x="' + xn.toFixed(1) + '" y="4" width="3" height="28" rx="1.5"/>'
         + (frei(8) ? '<text class="lf-tk" x="8.0" y="44">18</text>' : '')
         + (von != null && frei(X(von)) ? '<text class="lf-tk" x="' + X(von).toFixed(1) + '" y="44">' + esc(L.startUm) + '</text>' : '')
         + '<text class="lf-tk lf-tk-now" x="' + xn.toFixed(1) + '" y="44">jetzt</text>'
         + (frei(X(bis)) ? '<text class="lf-tk" x="' + X(bis).toFixed(1) + '" y="44">06:00</text>' : '')
         + (frei(444) ? '<text class="lf-tk" x="444.0" y="44">09</text>' : '');
    return out;
  }

  function _kcBuehne(w, d) {
    if (!d) { return '<div class="kc-warten">wird geladen …</div>'; }
    var L = d.lage || {}, R = d.raeume || [], reihe = _kcGruppen(d);
    var aussen = L.t;
    var warm = null, wr = '';
    R.forEach(function (r) { if (r.t != null && (warm == null || r.t > warm)) { warm = r.t; wr = r.raum; } });
    var spanne = (warm != null && aussen != null) ? (warm - aussen) : null;
    var tunAnz = R.filter(function (r) { return [1, 2, 3, 5, 7, 8].indexOf(r.lz) >= 0; }).length;
    var ruhig = R.length - tunAnz;
    var WT = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    var jetzt = new Date();
    var titel = reihe.length
      ? (reihe.length === 1 ? 'Ein Bereich <em>jetzt</em> lüften'
                            : reihe.length + ' Bereiche <em>jetzt</em> lüften')
      : (L.startUm ? 'Lüften lohnt ab <em>' + esc(L.startUm) + '</em>' : 'Heute nicht mehr lüften');

    var karten = reihe.slice(0, 5).map(function (g, i) { return _kcKarte(g, i, aussen); });
    var paare = (karten.length > 3 ? 2 : (karten.length > 1 ? 1 : 0));
    // Aufbau wie im Entwurf: 1 gross, dann 2+3 und 4+5 paarweise
    var links = karten[0] || '';
    if (karten[1] || karten[2]) { links += '<div class="pair">' + (karten[1] || '') + (karten[2] || '') + '</div>'; }
    if (karten[3] || karten[4]) { links += '<div class="pair">' + (karten[3] || '') + (karten[4] || '') + '</div>'; }

    var phiMax = 0, stufeMax = 0;
    R.forEach(function (r) { if ((r.phi || 0) > phiMax) { phiMax = r.phi; } if ((r.stufe || 0) > stufeMax) { stufeMax = r.stufe; } });

    return '<header>'
      + '<div><div class="kick">' + WT[jetzt.getDay()] + ' · '
      + ('0' + jetzt.getHours()).slice(-2) + ':' + ('0' + jetzt.getMinutes()).slice(-2) + ' · Klima</div>'
      + '<h1>' + titel + '</h1></div>'
      + '<div class="out">'
      + '<div><b>' + _kcZ(L.t) + ' °C</b><span>außen</span></div>'
      + '<div><b>' + _kcZ(L.rh, 0) + ' %</b><span>rel. Feuchte</span></div>'
      + '<div><b>' + _kcZ(L.tp) + ' °C</b><span>Taupunkt</span></div>'
      + '<div><b>' + _kcZ(L.x) + ' g/kg</b><span>absolut</span></div>'
      + '<div><b>' + _kcZ(L.wind) + ' km/h</b><span>Wind</span></div>'
      + '<div><b>' + _kcRegen(L.regenIn) + '</b><span>bis Regen</span></div>'
      + '</div>'
      + '<div class="hero"><div class="n">' + (spanne != null ? _kcZ(spanne) + ' °' : '—') + '</div>'
      + '<div class="l">Gefälle zum wärmsten Raum.<br>' + esc(wr) + '</div></div>'
      + '</header>'
      + '<main>'
      + '<div class="col left" style="grid-template-rows:auto ' + (paare === 2 ? '1.02fr 1fr 1fr' : (paare === 1 ? '1.02fr 1fr' : '1fr')) + ' auto">'
      + '<div class="qh"><h2>Jetzt zu tun</h2><span class="cnt">' + tunAnz + ' Räume von ' + R.length + '</span>'
      + '<span class="rule"></span><span class="srt">' + (reihe.length ? 'nach Gewinn geordnet' : 'nichts steht an') + '</span></div>'
      + links
      + '<div class="tail">'
      + '<div class="tl"><span class="tg">zu lassen</span><span class="tt">'
      + (ruhig > 0
          ? '<b>' + ruhig + ' Räume</b> — unter der Schwelle von 3 °, dort ist nichts zu holen.'
          : '<b>Alle Räume</b> haben genug Gefälle — es bleibt nichts liegen.')
      + '</span></div>'
      + '<div class="tl wait"><span class="tg">06:00</span><span class="tt"><b>alles schließen</b> — '
      + 'danach steigt außen wieder über innen.</span></div>'
      + '</div></div>'
      + '<div class="col right">'
      + '<div class="blk gef"><div class="bh"><h2>Gefälle jetzt</h2><span class="bh-r">' + R.length + ' Räume, °C</span></div>'
      + '<div class="pad"><svg viewBox="0 0 452 170">' + _kcGefaelle(d) + '</svg></div></div>'
      + '<div class="blk ver"><div class="bh"><h2>Die letzten 24 Stunden</h2><span class="bh-r">außen · wärmster · kühlster Raum</span></div>'
      + '<div class="pad"><svg viewBox="0 0 452 170">' + _kcVerlauf(w) + '</svg>'
      + '<div class="legend"><span class="kv"><i class="ln-au"></i>außen</span>'
      + '<span class="kv"><i class="ln-bk"></i>wärmster Raum</span>'
      + '<span class="kv"><i class="ln-wc"></i>kühlster Raum</span></div></div></div>'
      + '<div class="blk lf"><div class="bh"><h2>Lüftungsfenster</h2><span class="bh-r">heute Nacht</span></div>'
      + '<div class="pad"><svg viewBox="0 0 452 52">' + _kcFenster(d) + '</svg></div>'
      + '<div class="lfrow">'
      + '<div><b class="acc">' + (L.startUm ? esc(L.startUm) : '—') + '</b><span>Lüften lohnt ab</span></div>'
      + '<div><b>' + _kcZ(L.nachtMin) + ' °</b><span>Tiefstwert' + (L.nachtUm ? ' um ' + esc(L.nachtUm) : '') + '</span></div>'
      + '<div><b>' + _kcRegen(L.regenIn) + '</b><span>bis Regen</span></div>'
      + '</div></div>'
      + '</div></main>'
      + '<footer>'
      + '<div class="quiet"><span class="dot9"></span><span><b>' + ruhig + ' Räume unauffällig</b></span>'
      + '<span class="sep">·</span><span>Wandfeuchte überall unter ' + _kcZ(phiMax, 0)
      + ' % (Grenze 80 %), höchste Schimmelstufe ' + stufeMax + '</span></div>'
      + '<div class="note">Messwerte ' + ('0' + jetzt.getHours()).slice(-2) + ':'
      + ('0' + jetzt.getMinutes()).slice(-2) + ' · Bewertung alle 15 Minuten</div>'
      + '</footer>';
  }

  /**
   * Skalierung. Die Buehne ist 1440x900 und wird als GANZES skaliert - dadurch
   * bleiben alle Verhaeltnisse exakt wie gezeichnet. Der Faktor ist der kleinere
   * der beiden Quotienten, damit nichts abgeschnitten wird; die Buehne wird im
   * Rest zentriert.
   */
  function _kcSkalieren(el) {
    var box = el.querySelector('[data-role=kcb]'), st = el.querySelector('[data-role=kcs]');
    if (!box || !st) { return; }
    var bw = box.clientWidth, bh = box.clientHeight;       // clientWidth, NICHT getBoundingClientRect:
    if (!bw || !bh) { return; }                            // letzteres liefert im Reflow die skalierte Groesse
    var k = Math.min(bw / _KC_W, bh / _KC_H);
    st.style.transform = 'translate(' + ((bw - _KC_W * k) / 2).toFixed(1) + 'px,'
      + ((bh - _KC_H * k) / 2).toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
  }

  function _kcMal(w) {
    [document.getElementById('ovcanvas'), document.getElementById('hovcanvas'),
     (typeof canvas !== 'undefined' ? canvas : null)].forEach(function (root) {
      if (!root) { return; }
      [].slice.call(root.querySelectorAll('.w[data-id="' + w.id + '"]')).forEach(function (el) {
        var st = el.querySelector('[data-role=kcs]');
        if (!st) { return; }
        st.innerHTML = _kcBuehne(w, w._kc);
        _kcSkalieren(el);
      });
    });
  }

  /** Verlaufsdaten: aussen plus waermster und kuehlster Raum, 24 h. */
  function _kcHistorie(w, d) {
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
        .then(function () { if (--offen <= 0) { w._kcHist = acc; _kcMal(w); } });
    });
    if (!offen) { w._kcHist = acc; _kcMal(w); }
  }

  defWidget('klimac', {
    label: 'Klimaseite · Handlungen', cat: 'Anzeige', paletteIcon: 'window', size: [1440, 900], noHover: true,
    defaults: function (w) { w.mmSec = 120; },
    render: function () {
      return '<div class="kc-box" data-role="kcb"><div class="kc-c" data-role="kcs">'
           + '<div class="kc-warten">wird geladen …</div></div></div>';
    },
    live: function (w, el) { if (el) { _kcSkalieren(el); } }
  });

  setInterval(function () {
    if (typeof state === 'undefined' || !state.widgets) { return; }
    var now = Date.now();
    function takt(w) {
      if (!w || w.type !== 'klimac') { return; }
      if (now - (w._kcZeit || 0) < (w.mmSec || 120) * 1000) { return; }
      w._kcZeit = now;
      _mmDaten2((w.mmSec || 120) * 1000, function (j) {
        if (!j) { return; }
        w._kc = j;
        _kcMal(w);
        _kcHistorie(w, j);
      });
    }
    allWidgets().forEach(takt);
    if (typeof _tickKids !== 'undefined' && _tickKids) { _tickKids.forEach(takt); }
    if (typeof _popup !== 'undefined' && _popup && _popup.widgets) { _popup.widgets.forEach(takt); }
  }, 2000);
