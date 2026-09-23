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
  // ERWEITERUNGEN (23.09.2026, Belegungskalender):
  //   - Trennzeichen: Semikolon, sobald eines vorkommt (dann darf der Tooltip Kommas tragen)
  //   - Zelle "zustand:Tooltip" - Text nach dem ersten Doppelpunkt wird zum Tooltip
  //   - "*" vor dem Zustand hebt die Zelle hervor (z. B. heute)
  //   - rsAlign 'links': kurze Zeilen rechts mit Luecken auffuellen (Tag 1 immer links)
  //   - rsHead: Kopfzeile mit Spaltennummern 1, 5, 10 ...
  //   - rsLgNames: eigene Legende "ok,warn,fehler,leer[,hervorgehoben]" (leerer Eintrag = weglassen)
  //   - rsCellH: Zellenhoehe in px; rsSubW: feste Breite des Nebenlabels (fuer rsHead)
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
  /** Eine Zelle: "*zustand:Tooltip" -> {z, hl, tip}. */
  function _rsZelle(s) {
    s = String(s == null ? '' : s).trim();
    var hl = false;
    if (s.charAt(0) === '*') { hl = true; s = s.slice(1); }
    var k = s.indexOf(':'), tip = '';
    if (k >= 0) { tip = s.slice(k + 1).trim(); s = s.slice(0, k); }
    return {z: s.trim().toLowerCase(), hl: hl, tip: tip};
  }
  /** Die Zellen einer Zeile: Text zerlegen, hinten abschneiden, auffuellen (vorne mit
   *  Leerzellen; bei rsAlign 'links' hinten mit Luecken). */
  function _rsZellen(txt, n, links) {
    var t = String(txt == null ? '' : txt);
    var a = t.split(t.indexOf(';') >= 0 ? ';' : ',').map(_rsZelle);
    a = a.filter(function (c, i) { return !(i === a.length - 1 && c.z === '' && !c.tip && a.length > 1); });
    if (a.length > n) { a = a.slice(a.length - n); }
    while (a.length < n) { if (links) { a.push({z: '', gap: true}); } else { a.unshift({z: ''}); } }
    return a;
  }
  function _rsKopf(w) {
    var lg;
    if (w.rsLgNames) {
      // eigene Beschriftung: ok, warn, fehler, leer, hervorgehoben - leerer Eintrag = weglassen
      var nm = String(w.rsLgNames).split(','), cls = ['ok', 'warn', 'crit', 'none', 'hl'];
      lg = cls.map(function (c, i) {
        var t = (nm[i] || '').trim();
        return t ? '<span class="rs-lg"><i class="rs-p ' + c + '"></i>' + escL(t) + '</span>' : '';
      }).join('');
    } else {
      lg = Object.keys(_RS_ZUST).filter(function (k) { return k !== 'lauf'; }).map(function (k) {
        return '<span class="rs-lg"><i class="rs-p ' + _RS_ZUST[k].c + '"></i>' + escL(_RS_ZUST[k].t) + '</span>';
      }).join('');
    }
    return '<div class="rs-kopf"><span class="rs-tt">' + escL(w.label || 'Verlauf') + '</span>'
      + '<span class="rs-fl"></span>' + (w.rsLegend === false ? '' : lg) + '</div>';
  }
  function _rsTab(w) {
    var rows = w._rsRows || [];
    if (rows.length < 2) {
      return '<div class="rs-leer">' + (w.varId ? 'Noch keine Aufzeichnung' : 'Variable wählen') + '</div>';
    }
    var n = (w.rsCols > 0) ? parseInt(w.rsCols) : 30;
    var breit = (w.rsLbW || 132), rechts = (w.rsValW || 62), links = w.rsAlign === 'links';
    var fix = w.rsHead || w.rsSubW > 0;
    var h = '<div class="rs-tab' + (w.rsSolid ? ' solid' : '') + (fix ? ' fixsub' : '')
          + '" style="--rslb:' + breit + 'px;--rsval:' + rechts + 'px'
          + (fix ? ';--rssub:' + (w.rsSubW > 0 ? w.rsSubW : 64) + 'px' : '')
          + (w.rsCellH > 0 ? ';--rsch:' + parseInt(w.rsCellH) + 'px' : '') + '">';
    if (w.rsHead) {
      var kopf = '';
      for (var k = 1; k <= n; k++) { kopf += '<i class="rs-hn">' + ((k === 1 || k % 5 === 0) ? k : '') + '</i>'; }
      h += '<div class="rs-zl rs-hd"><span></span><span></span><span class="rs-str rs-hs">' + kopf + '</span><span></span></div>';
    }
    rows.slice(1).forEach(function (r) {
      var zellen = _rsZellen(r[2], n, links);
      h += '<div class="rs-zl">'
        + '<span class="rs-nm">' + escL(String(r[0] == null ? '' : r[0])) + '</span>'
        + '<span class="rs-sub">' + escL(String(r[1] == null ? '' : r[1])) + '</span>'
        + '<span class="rs-str">'
        + zellen.map(function (c) {
            if (c.gap) { return '<i class="rs-c gap"></i>'; }
            var d = _RS_ZUST[c.z] || _RS_ZUST[''];
            return '<i class="rs-c ' + d.c + (c.hl ? ' hl' : '') + '" title="' + escL(c.tip || d.t) + '"></i>';
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
        + 'oder Semikolon getrennt (<code>ok</code>, <code>warn</code>, <code>fehler</code>, <code>lauf</code>, '
        + 'leer = nicht überwacht; <code>*</code> vorn hebt hervor, <code>:Text</code> ist der Tooltip) · Spalte 3 Kennzahl rechts.</div>'
        + row('Variable', '<input id="pRsVar" type="number" value="' + (w.varId || '') + '">')
        + '<div class="pgh">Darstellung</div>'
        + row('Zellen je Zeile', '<input id="pRsCols" type="number" min="4" max="120" value="' + (w.rsCols || 30) + '"> <span style="font-size:11px;color:var(--muted)">ältere fallen links heraus</span>')
        + row('Breite Bezeichner', '<input id="pRsLbW" type="number" min="60" max="300" value="' + (w.rsLbW || 132) + '"> px')
        + row('Breite Kennzahl', '<input id="pRsValW" type="number" min="0" max="200" value="' + (w.rsValW || 62) + '"> px')
        + row('Legende im Kopf', '<input type="checkbox" id="pRsLg"' + ((w.rsLegend !== false) ? ' checked' : '') + '>')
        + row('Ausrichtung', '<select id="pRsAl"><option value="">rechtsbündig (neueste rechts)</option><option value="links"' + (w.rsAlign === 'links' ? ' selected' : '') + '>linksbündig (Kalender: Tag 1 links)</option></select>')
        + row('Kopfzeile Spaltennummern', '<input type="checkbox" id="pRsHd"' + (w.rsHead ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">1, 5, 10 … über den Zellen</span>')
        + row('Legende (eigene)', '<input id="pRsLgN" type="text" placeholder="ok,warn,fehler,leer,hervorgehoben" value="' + escL(w.rsLgNames || '') + '"> <span style="font-size:11px;color:var(--muted)">leer = Standard; einzelnen Eintrag leer lassen = weglassen</span>')
        + row('Zellenhöhe', '<input id="pRsCh" type="number" min="0" max="80" value="' + (w.rsCellH || '') + '"> px <span style="font-size:11px;color:var(--muted)">leer = automatisch</span>')
        + row('Breite Nebenlabel', '<input id="pRsSw" type="number" min="0" max="200" value="' + (w.rsSubW || '') + '"> px <span style="font-size:11px;color:var(--muted)">fest, damit die Kopfzeile bündig steht</span>')
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
      if ($('#pRsAl'))   $('#pRsAl').onchange   = function () { w.rsAlign = this.value || undefined; nur(); };
      if ($('#pRsHd'))   $('#pRsHd').onchange   = function () { w.rsHead = this.checked || undefined; nur(); };
      if ($('#pRsLgN'))  $('#pRsLgN').onchange  = function () { w.rsLgNames = this.value.trim() || undefined; nur(); };
      if ($('#pRsCh'))   $('#pRsCh').onchange   = function () { w.rsCellH = parseInt(this.value) || undefined; nur(); };
      if ($('#pRsSw'))   $('#pRsSw').onchange   = function () { w.rsSubW = parseInt(this.value) || undefined; nur(); };
    },
    live: function (w, el, id, d) {
      if (String(id) === String(w.varId)) { _rsLoad(w, function () { _rsPaint(w); }); }
      return true;
    }
  });
