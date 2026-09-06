  // ===== Widget: Klimaseite B (klimab) — pixelgenaue Umsetzung des Entwurfs =====
  //
  // Verfahren wie bei klimac: CSS des Entwurfs woertlich, unter .kb-c gekapselt,
  // Buehne 1440x900 als Ganzes skaliert. Siehe den Kopf von klimac.js.
  //
  // Das Besondere an B: es zeigt nicht den Augenblick, sondern die kommenden
  // Stunden. Die Baender kommen aus ko_plan() im Backend - fuer jede Stunde der
  // Vorhersage dieselbe Frage wie fuer jetzt, gleiche Antworten zu Abschnitten
  // zusammengezogen. Eine durchgehende Zeitachse traegt Kurve UND Baender; die
  // Spaltenbreiten (300/900/128) sind darum in beiden Bloecken dieselben.
  var _KB_W = 1470, _KB_H = 900;

  function _kbZ(v, k) {
    if (v == null || v === '' || isNaN(v)) { return '—'; }
    return Number(v).toFixed(k == null ? 1 : k).replace('.', ',');
  }
  function _kbUhr(ts) { var d = new Date(ts * 1000); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  var _KB_SEG = { open: ['s-open', 'offen'], rain: ['s-rain', 'zu wegen Regen'], shut: ['s-shut', 'geschlossen'] };

  function _kbBaender(plan, t0, t1) {
    var sp = Math.max(1, t1 - t0);
    return plan.map(function (g) {
      var seg = (g.seg || []).map(function (s) {
        var a = Math.max(0, (s.von - t0) / sp), b = Math.min(1, (s.bis - t0) / sp);
        if (b <= a) { return ''; }
        var d = _KB_SEG[s.z] || _KB_SEG.shut;
        var breit = b - a;
        return '<div class="seg ' + d[0] + '" style="left:' + (a * 100).toFixed(3) + '%;width:' + (breit * 100).toFixed(3) + '%">'
          + (breit > 0.06 ? '<span class="tm">' + _kbUhr(s.von) + '</span>' + d[1] : '') + '</div>';
      }).join('');
      var jetzt = Math.max(0, Math.min(1, (Date.now() / 1000 - t0) / sp));
      var raeume = (g.raeume || []).join(' · ');
      var pip = g.art === 'kamin' ? 'var(--accent)' : (g.offenStd > 0 ? 'var(--ok)' : 'var(--muted)');
      var titel = g.offenStd > 0
        ? (g.art === 'kamin' ? 'Kaminlüftung — Dach- und Seitenfenster' : 'Querlüften, Türen offen')
        : 'Geschlossen halten';
      return '<div class="grid row">'
        + '<div class="c-lab lab">'
        + '<div class="verb"><span class="pip" style="background:' + pip + '"></span>' + esc(titel) + '</div>'
        + '<div class="meta">' + (g.raeume || []).length + ' Räume · ' + esc(g.name) + '</div>'
        + '<div class="rng">' + _kbZ(g.tMin) + ' – ' + _kbZ(g.tMax) + ' °C<span style="color:var(--faint)">&nbsp;&nbsp;⌀&nbsp;' + _kbZ(g.tMit) + '</span></div>'
        + '<div class="rooms">' + esc(raeume) + '</div>'
        + '</div><div class="c-gap"></div>'
        + '<div class="c-time tl"><div class="kbbar">' + seg
        + '<div class="vline v-now" style="left:' + (jetzt * 100).toFixed(3) + '%"></div></div></div>'
        + '<div class="c-gap"></div>'
        + '<div class="c-res">' + (g.gewinn
            ? '<div class="res-k">−' + _kbZ(g.gewinn[1]) + ' °</div><div class="res-t">' + _kbZ(g.tMax) + ' → ' + _kbZ(g.ziel) + ' °C<br>' + _kbZ(g.offenStd) + ' h offen</div>'
            : '<div class="res-k" style="color:var(--faint)">±0</div><div class="res-t">keine Maßnahme</div>') + '</div>'
        + '</div>';
    }).join('');
  }

  function _kbAchse(t0, t1) {
    var sp = Math.max(1, t1 - t0), out = '', t = t0 - (new Date(t0 * 1000).getMinutes() * 60);
    for (; t <= t1; t += 3600) {
      var f = (t - t0) / sp; if (f < 0 || f > 1) { continue; }
      var h = new Date(t * 1000).getHours();
      out += '<div class="tick" style="left:' + (f * 100).toFixed(3) + '%"></div>'
           + '<div class="lb" style="left:' + (f * 100).toFixed(3) + '%' + (f < 0.01 ? ';transform:none' : '') + '">'
           + ('0' + h).slice(-2) + '</div>';
    }
    return out + '<div class="unit">Uhr</div>';
  }

  /** Kurvenblock: gemessene Nacht gegen Prognose, auf derselben Achse. */
  function _kbKurve(w, t0, t1) {
    var h = w._kbHist || {}, W = 900, H = 172, sp = Math.max(1, t1 - t0);
    var mess = h.aussen || [], raum = h.warm || [];
    var alle = mess.concat(raum).map(function (p) { return p[1]; });
    var pr = (w._kb && w._kb.prognose) || [];
    pr.forEach(function (p) { alle.push(p[1]); });
    if (!alle.length) { return ''; }
    var lo = Math.floor(Math.min.apply(null, alle)) - 1, hi = Math.ceil(Math.max.apply(null, alle)) + 1;
    function X(t) { return Math.max(0, Math.min(W, (t - t0) / sp * W)); }
    function Y(v) { return 158 - (v - lo) / Math.max(1, hi - lo) * 150; }
    var out = '', v;
    for (v = lo + (2 - (lo % 2)); v <= hi; v += 2) {
      out += '<line x1="0" y1="' + Y(v).toFixed(1) + '" x2="' + W + '" y2="' + Y(v).toFixed(1)
           + '" stroke="var(--line-soft)"/><text x="' + (W - 4) + '" y="' + (Y(v) - 2).toFixed(1)
           + '" text-anchor="end" font-size="9.5" fill="var(--faint)">' + v + '</text>';
    }
    function linie(d, farbe, breite, dash) {
      if (!d || d.length < 2) { return ''; }
      return '<polyline points="' + d.filter(function (p) { return p[0] >= t0 && p[0] <= t1; })
        .map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ')
        + '" fill="none" stroke="' + farbe + '" stroke-width="' + breite + '"'
        + (dash ? ' stroke-dasharray="4 4"' : '') + '/>';
    }
    // Gemessenes nur zeichnen, wenn es wirklich ins Fenster faellt - ein
    // Stummel am linken Rand sieht aus wie ein Fehler, nicht wie eine Messung.
    function drin(d) { return (d || []).filter(function (p) { return p[0] >= t0 && p[0] <= t1; }).length > 3; }
    if (drin(mess)) { out += linie(mess, 'var(--faint)', 1.4, true); }
    if (drin(raum)) { out += linie(raum, 'var(--muted)', 1.4, true); }
    out += linie(pr, 'var(--info)', 2, false);
    var jx = X(Date.now() / 1000);
    out += '<line x1="' + jx.toFixed(1) + '" y1="0" x2="' + jx.toFixed(1) + '" y2="158" stroke="var(--accent)" stroke-opacity=".5"/>';
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block">' + out + '</svg>';
  }

  function _kbBuehne(w) {
    var d = w._kb;
    if (!d || !d.plan) { return '<div class="kc-warten">wird geladen …</div>'; }
    var L = d.lage || {}, plan = d.plan || [];
    // Achse: vom fruehesten bis zum spaetesten Abschnitt des Plans
    var t0 = null, t1 = null;
    plan.forEach(function (g) {
      (g.seg || []).forEach(function (s) {
        if (t0 === null || s.von < t0) { t0 = s.von; }
        if (t1 === null || s.bis > t1) { t1 = s.bis; }
      });
    });
    if (t0 === null) { t0 = Math.floor(Date.now() / 1000); t1 = t0 + 43200; }
    var offenMax = 0, best = null;
    plan.forEach(function (g) { if (g.offenStd > offenMax) { offenMax = g.offenStd; best = g; } });
    var warm = null;
    plan.forEach(function (g) { if (warm === null || g.tMax > warm) { warm = g.tMax; } });
    var spanne = (warm != null && L.t != null) ? (warm - L.t) : null;

    // Der Titel folgt dem, was tatsaechlich auf der Achse steht. Morgens um
    // halb sieben "Die kommende Nacht" zu schreiben, waehrend der Plan den Tag
    // zeigt, waere eine Ueberschrift, die ihrem Inhalt widerspricht.
    var hv = new Date(t0 * 1000).getHours(), hb = new Date(t1 * 1000).getHours();
    var titel = (hv >= 17 || hv <= 4) ? 'Die kommende Nacht'
              : (hb <= 12 ? 'Der Vormittag' : 'Der kommende Tag');
    return '<header class="block head">'
      + '<div><h1>' + titel + '</h1>'
      + '<div class="sub">Was aufgehen soll, ' + _kbUhr(t0) + ' bis ' + _kbUhr(t1) + ' — ' + (d.raeume || []).length + ' Räume, zu '
      + plan.length + ' Gruppen verdichtet, auf einer durchgehenden Zeitachse.</div></div>'
      + '<div class="now">'
      + '<div><span class="mono">' + _kbUhr(Date.now() / 1000) + '</span><span class="dotsep">·</span>'
      + 'draußen <span class="big">' + _kbZ(L.t) + ' °C</span></div>'
      + '<div>Tief <b class="mono">' + _kbZ(L.nachtMin) + ' °C</b>'
      + (L.nachtUm ? ' um <b class="mono">' + esc(L.nachtUm) + '</b>' : '')
      + '<span class="dotsep">·</span>'
      + (L.regenIn != null && L.regenIn >= 0 && L.regenIn < 600 ? 'Regen in <b class="mono">' + L.regenIn + ' min</b>' : 'kein Regen')
      + '<span class="dotsep">·</span>Wind ' + _kbZ(L.wind) + ' km/h</div>'
      + '</div></header>'
      + '<section class="block chart grid">'
      + '<div class="c-lab">'
      + '<div class="ch-h">Gemessen gegen Prognose</div>'
      + '<div class="ch-s">Die letzten 24 Stunden gestrichelt,<br>die Vorhersage durchgezogen — dieselbe Achse.</div>'
      + '<div class="leg">'
      + '<div><i style="border-top-color:var(--faint);border-top-style:dashed"></i>gemessen · außen</div>'
      + '<div><i style="border-top-color:var(--muted);border-top-style:dashed"></i>gemessen · wärmster Raum</div>'
      + '<div><i style="border-top-color:var(--info)"></i>Vorhersage · außen</div>'
      + '</div>'
      + '<div class="kpi"><span class="n">' + (spanne != null ? _kbZ(spanne) + ' °' : '—') + '</span>'
      + '<span class="t">liegen jetzt zwischen dem wärmsten<br>Raum und der Außenluft.</span></div>'
      + '</div><div class="c-gap"></div>'
      + '<div class="c-time">' + _kbKurve(w, t0, t1) + '</div>'
      + '<div class="c-gap"></div>'
      + '<div class="c-res">' + (best
          ? '<div class="res-k">−' + _kbZ(best.gewinn ? best.gewinn[1] : 0) + ' °</div>'
            + '<div class="res-t">' + esc(best.name) + '<br>' + _kbZ(best.offenStd) + ' h offen</div>'
          : '') + '</div>'
      + '</section>'
      + '<section class="block bands">'
      + '<div class="grid axis"><div class="c-lab" style="display:flex;align-items:flex-end">'
      + '<span style="font-size:10px;color:var(--faint);letter-spacing:.09em;text-transform:uppercase">Gruppe · Ist-Zustand</span></div>'
      + '<div class="c-gap"></div><div class="c-time">' + _kbAchse(t0, t1) + '</div>'
      + '<div class="c-gap"></div><div class="c-res"></div></div>'
      + _kbBaender(plan, t0, t1)
      + '<div class="grid legend"><div class="c-lab"></div><div class="c-gap"></div>'
      + '<div class="c-time" style="display:flex;align-items:center;gap:15px">'
      + '<b><i class="s-open"></i>offen</b><b><i class="s-rain"></i>zu wegen Regen</b>'
      + '<b><i class="s-shut"></i>geschlossen</b>'
      + '<b style="margin-left:6px"><i style="width:1px;background:var(--accent)"></i>jetzt</b></div>'
      + '<div class="c-gap"></div><div class="c-res"></div></div>'
      + '</section>'
      + '<footer class="block foot">'
      + '<div>Plan aus der Stundenvorhersage · Raumtemperatur als konstant angenommen</div>'
      + '<div class="r">' + (d.raeume || []).length + ' Räume · Bewertung alle 15 Minuten</div>'
      + '</footer>';
  }

  function _kbSkalieren(el) {
    var box = el.querySelector('[data-role=kbb]'), st = el.querySelector('[data-role=kbs]');
    if (!box || !st) { return; }
    var bw = box.clientWidth, bh = box.clientHeight;
    if (!bw || !bh) { return; }
    var k = Math.min(bw / _KB_W, bh / _KB_H);
    st.style.transform = 'translate(' + ((bw - _KB_W * k) / 2).toFixed(1) + 'px,'
      + ((bh - _KB_H * k) / 2).toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
  }
  function _kbMal(w) {
    [document.getElementById('ovcanvas'), (typeof canvas !== 'undefined' ? canvas : null)].forEach(function (root) {
      if (!root) { return; }
      [].slice.call(root.querySelectorAll('.w[data-id="' + w.id + '"]')).forEach(function (el) {
        var st = el.querySelector('[data-role=kbs]');
        if (!st) { return; }
        st.innerHTML = _kbBuehne(w);
        _kbSkalieren(el);
      });
    });
  }
  function _kbHistorie(w, d) {
    var R = (d.raeume || []).filter(function (r) { return r.t != null; });
    if (!R.length) { return; }
    var warm = R[0];
    R.forEach(function (r) { if (r.t > warm.t) { warm = r; } });
    var von = Math.floor(Date.now() / 1000) - 86400, bis = Math.floor(Date.now() / 1000);
    var ziel = { aussen: 14288, warm: warm.tvid }, offen = 0, acc = {};
    Object.keys(ziel).forEach(function (k) {
      if (!ziel[k]) { acc[k] = []; return; }
      offen++;
      fetch('?api=history&id=' + ziel[k] + '&from=' + von + '&to=' + bis, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { acc[k] = ((j && j.data) || []).map(function (p) { return [p[0] / 1000, p[1]]; }); })
        .catch(function () { acc[k] = []; })
        .then(function () { if (--offen <= 0) { w._kbHist = acc; _kbMal(w); } });
    });
  }

  defWidget('klimab', {
    label: 'Klimaseite · Nacht', cat: 'Anzeige', paletteIcon: 'moon', size: [1470, 900], noHover: true,
    defaults: function (w) { w.mmSec = 300; },
    render: function () {
      return '<div class="kb-box" data-role="kbb"><div class="kb-c" data-role="kbs">'
           + '<div class="kc-warten">wird geladen …</div></div></div>';
    },
    live: function (w, el) { if (el) { _kbSkalieren(el); } }
  });

  setInterval(function () {
    if (typeof state === 'undefined' || !state.widgets) { return; }
    var now = Date.now();
    function takt(w) {
      if (!w || w.type !== 'klimab') { return; }
      if (now - (w._kbZeit || 0) < (w.mmSec || 300) * 1000) { return; }
      w._kbZeit = now;
      fetch('?api=mold&plan=1', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.raeume) { return; }
        w._kb = j; _kbMal(w); _kbHistorie(w, j);
      }).catch(function () {});
    }
    allWidgets().forEach(takt);
    if (typeof _tickKids !== 'undefined' && _tickKids) { _tickKids.forEach(takt); }
    if (typeof _popup !== 'undefined' && _popup && _popup.widgets) { _popup.widgets.forEach(takt); }
  }, 3000);
