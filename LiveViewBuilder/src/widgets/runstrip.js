  // ===== Widget: runstrip (Laufstreifen) =====
  //
  // Je Zeile ein Streifen gleich breiter Zellen, jede Zelle ein ZUSTAND. Gedacht fuer die
  // beiden Fragen, die eine Verlaufsseite stellt und die keine Zahl beantwortet:
  //
  //   "lief der Auftrag durch?"   dreissig Laeufe nebeneinander - eine rote Zelle in der
  //                               Mitte faellt auf, ein Mittelwert von 96 % nicht.
  //   "war der Knoten erreichbar?" dreissig Tageszellen - man sieht SOFORT, ob der Ausfall
  //                               ein einzelner Tag war oder eine Woche.
  //
  // WARUM EIN EIGENES WIDGET. Geprueft wurden vorher alle vorhandenen: statmatrix normiert
  // Zahlen je Zeile auf eine Farbrampe und kann keine Zustaende; statetl zeichnet zeitechte
  // Baender direkt aus dem Archiv und kann keine Tabelle lesen; statusgrid ist eine Liste
  // aus Symbolzeilen ohne Verlauf; meterlist zeichnet Balken, also GROESSEN. Ein Streifen
  // aus kategorialen Zellen aus einer Tabelle war in keinem davon unterzubringen, ohne es
  // umzudeuten.
  //
  // QUELLE ist eine Tabelle im Zeilenformat, dasselbe JSON wie beim Tabellen-Widget:
  //   Zeile 0  Spaltenkopf (wird uebersprungen)
  //   Spalte 0 Bezeichner der Zeile
  //   Spalte 1 Nebenlabel (Takt, Art, Ablage - was die Zeile einordnet)
  //   Spalte 2 die Zustaende, mit Komma getrennt: ok, warn, fehler, lauf, leer
  //   Spalte 3 Kennzahl am rechten Rand
  //
  // Eine LEERE Zelle ist ausdruecklich ein eigener Zustand und nicht "in Ordnung". Am
  // Anfang einer Aufzeichnung ist fast alles unbekannt; das gruen zu faerben waere die
  // gefaehrlichste Sorte Falschaussage, die eine Ueberwachungsseite machen kann.

  var _RS_ZUST = {
    ok:     {c: 'ok',    t: 'in Ordnung'},
    warn:   {c: 'warn',  t: 'mit Warnung'},
    fehler: {c: 'crit',  t: 'fehlgeschlagen'},
    lauf:   {c: 'acc',   t: 'läuft'},
    '':     {c: 'none',  t: 'nicht überwacht'}
  };

  function _rsLoad(w, cb) {
    if (!w.varId) { w._rsRows = []; cb && cb(); return; }
    fetch('?api=tabledata&id=' + w.varId, {cache: 'no-store'}).then(function (r) { return r.json(); })
      .then(function (j) { w._rsRows = (j && j.rows) || []; })
      .catch(function () { w._rsRows = []; })
      .then(function () { cb && cb(); });
  }
  function _rsEl(w) {
    var sel = '.w[data-id="' + w.id + '"] [data-role=rsroot]';
    var oc = document.getElementById('ovcanvas');
    return (oc && oc.querySelector(sel)) || (typeof canvas !== 'undefined' && canvas && canvas.querySelector(sel)) || null;
  }
  /** Die Zellen einer Zeile: Text zerlegen, hinten abschneiden, vorne mit Leerzellen auffuellen. */
  function _rsZellen(txt, n) {
    var a = String(txt == null ? '' : txt).split(',').map(function (s) { return s.trim().toLowerCase(); });
    a = a.filter(function (s, i) { return !(i === a.length - 1 && s === '' && a.length > 1); });
    if (a.length > n) { a = a.slice(a.length - n); }
    while (a.length < n) { a.unshift(''); }
    return a;
  }
  function _rsKopf(w) {
    var lg = Object.keys(_RS_ZUST).filter(function (k) { return k !== 'lauf'; }).map(function (k) {
      return '<span class="rs-lg"><i class="rs-p ' + _RS_ZUST[k].c + '"></i>' + escL(_RS_ZUST[k].t) + '</span>';
    }).join('');
    return '<div class="rs-kopf"><span class="rs-tt">' + escL(w.label || 'Verlauf') + '</span>'
      + '<span class="rs-fl"></span>' + (w.rsLegend === false ? '' : lg) + '</div>';
  }
  function _rsTab(w) {
    var rows = w._rsRows || [];
    if (rows.length < 2) {
      return '<div class="rs-leer">' + (w.varId ? 'Noch keine Aufzeichnung' : 'Variable wählen') + '</div>';
    }
    var n = (w.rsCols > 0) ? parseInt(w.rsCols) : 30;
    var breit = (w.rsLbW || 132), rechts = (w.rsValW || 62);
    var h = '<div class="rs-tab' + (w.rsSolid ? ' solid' : '')
          + '" style="--rslb:' + breit + 'px;--rsval:' + rechts + 'px">';
    rows.slice(1).forEach(function (r) {
      var zellen = _rsZellen(r[2], n);
      h += '<div class="rs-zl">'
        + '<span class="rs-nm">' + escL(String(r[0] == null ? '' : r[0])) + '</span>'
        + '<span class="rs-sub">' + escL(String(r[1] == null ? '' : r[1])) + '</span>'
        + '<span class="rs-str">'
        + zellen.map(function (z) {
            var d = _RS_ZUST[z] || _RS_ZUST[''];
            return '<i class="rs-c ' + d.c + '" title="' + escL(d.t) + '"></i>';
          }).join('')
        + '</span>'
        + '<span class="rs-v">' + escL(String(r[3] == null ? '' : r[3])) + '</span>'
        + '</div>';
    });
    return h + '</div>';
  }
  function _rsPaint(w) {
    var el = _rsEl(w); if (!el) { return; }
    el.innerHTML = _rsKopf(w) + _rsTab(w);
  }

  defWidget('runstrip', {
    label: 'Laufstreifen',
    cat: 'Anzeige',
    paletteIcon: 'wbars',
    size: [720, 260],
    defaults: function (w) { w.label = 'Verlauf'; w.rsCols = 30; w.rsLbW = 132; w.rsValW = 62; },
    render: function (w) { return '<div class="panel rs"><div data-role="rsroot"></div></div>'; },
    mount: function (w) { _rsLoad(w, function () { _rsPaint(w); }); },
    props: function (w) {
      return '<div class="pgh">Quelle (Tabelle im Zeilenformat)</div>'
        + '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
        + 'Spalte 0 Bezeichner · Spalte 1 Nebenlabel · Spalte 2 die Zustände mit Komma '
        + 'getrennt (<code>ok</code>, <code>warn</code>, <code>fehler</code>, <code>lauf</code>, '
        + 'leer = nicht überwacht) · Spalte 3 Kennzahl rechts.</div>'
        + row('Variable', '<input id="pRsVar" type="number" value="' + (w.varId || '') + '">')
        + '<div class="pgh">Darstellung</div>'
        + row('Zellen je Zeile', '<input id="pRsCols" type="number" min="4" max="120" value="' + (w.rsCols || 30) + '"> <span style="font-size:11px;color:var(--muted)">ältere fallen links heraus</span>')
        + row('Breite Bezeichner', '<input id="pRsLbW" type="number" min="60" max="300" value="' + (w.rsLbW || 132) + '"> px')
        + row('Breite Kennzahl', '<input id="pRsValW" type="number" min="0" max="200" value="' + (w.rsValW || 62) + '"> px')
        + row('Legende im Kopf', '<input type="checkbox" id="pRsLg"' + ((w.rsLegend !== false) ? ' checked' : '') + '>')
        + row('Durchgehendes Band', '<input type="checkbox" id="pRsSol"' + (w.rsSolid ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">ohne Fugen — für Verläufe, die eine Strecke sind (Erreichbarkeit, Alter) statt einzelner Ereignisse</span>');
    },
    wire: function (w) {
      function neu() { _rsLoad(w, function () { _rsPaint(w); }); commit(); }
      function nur() { _rsPaint(w); commit(); }
      if ($('#pRsVar'))  $('#pRsVar').onchange  = function () { w.varId = parseInt(this.value) || 0; neu(); };
      if ($('#pRsCols')) $('#pRsCols').onchange = function () { w.rsCols = parseInt(this.value) || 30; nur(); };
      if ($('#pRsLbW'))  $('#pRsLbW').onchange  = function () { w.rsLbW = parseInt(this.value) || 132; nur(); };
      if ($('#pRsValW')) $('#pRsValW').onchange = function () { w.rsValW = parseInt(this.value) || 0; nur(); };
      if ($('#pRsLg'))   $('#pRsLg').onchange   = function () { w.rsLegend = this.checked; nur(); };
      if ($('#pRsSol'))  $('#pRsSol').onchange  = function () { w.rsSolid = this.checked || undefined; nur(); };
    },
    live: function (w, el, id, d) {
      if (String(id) === String(w.varId)) { _rsLoad(w, function () { _rsPaint(w); }); }
      return true;
    }
  });
