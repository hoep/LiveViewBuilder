  // ===== Widget: cartop (Fahrzeug von oben) =====
  //
  // Ein Wagen in der Draufsicht, auf dem JEDE Angabe dort steht, wo sie am Fahrzeug
  // hingehoert: der Reifendruck am Rad, der Zustand jeder Oeffnung an der Oeffnung.
  //
  // WARUM EIN EIGENES WIDGET. Bisher lag ein Foto (image) auf der Seite und ringsherum
  // ein Kranz aus assoc- und value-Kacheln. Das hatte drei Fehler, die sich mit
  // Anordnung nicht beheben lassen:
  //
  //   Zuordnung   "2,3 bar" in einem Kasten rechts unten gehoert zu welchem Rad? Man
  //               muss es wissen. Am Rad selbst muss man es nicht.
  //   Farbe       Ein Foto kann nicht rot werden. Der schlechte Reifen war nur an der
  //               Zahl zu erkennen, nicht an der Stelle.
  //   Vollstaendigkeit  Was kein eigenes Kaestchen bekam, fehlte einfach - die
  //               Heckscheibe stand jahrelang nirgends.
  //
  // Der Wagen ist gezeichnet (Inline-SVG, kein Bild): er skaliert verlustfrei, nimmt
  // die Skin-Farben an und kann seine Teile einfaerben.
  //
  // BINDUNG. Alles liegt in w.items als {slot, vid}. Der Slot sagt, WO am Fahrzeug der
  // Wert sitzt - die Laufzeit sammelt items[].vid ohnehin ein, damit werden alle
  // Bindungen ohne Zusatzarbeit gepollt.
  //
  //   haube klappe scheibe        Oeffnungen vorn und hinten
  //   vl vr hl hr                 Oeffnung je Ecke (Tuer UND Fenster zusammen)
  //   pVL pVR pHL pHR             Reifendruck
  //   sVL sVR sHL sHR             Reifendruck Soll (fuer die Abweichung)

  var _CT_SLOTS = [
    ['haube',  'Motorhaube'],       ['klappe', 'Heckklappe'],    ['scheibe', 'Heckscheibe'],
    ['vl',     'Ecke vorne links'], ['vr',     'Ecke vorne rechts'],
    ['hl',     'Ecke hinten links'],['hr',     'Ecke hinten rechts'],
    ['pVL',    'Druck vorne links'],['pVR',    'Druck vorne rechts'],
    ['pHL',    'Druck hinten links'],['pHR',   'Druck hinten rechts'],
    ['sVL',    'Soll vorne links'], ['sVR',    'Soll vorne rechts'],
    ['sHL',    'Soll hinten links'],['sHR',    'Soll hinten rechts']
  ];
  // Stellen im SVG-Koordinatensystem (300 x 470).
  var _CT_POS = {
    haube:  [150,  44], scheibe: [150, 398], klappe: [150, 436],
    vl:     [ 96, 186], vr:      [204, 186],
    hl:     [ 96, 280], hr:      [204, 280]
  };
  // Raeder: x, y, und die Ecke, deren Druck sie faerbt.
  var _CT_RAD = [
    ['VL',  34, 120], ['VR', 249, 120], ['HL',  34, 312], ['HR', 249, 312]
  ];

  function _ctVal(vid) {
    var d = vid && _lastVals[vid];
    return d ? d : null;
  }
  function _ctNum(vid) {
    var d = _ctVal(vid);
    if (!d) { return NaN; }
    var n = parseFloat(String(d.v).replace(',', '.'));
    return isNaN(n) ? NaN : n;
  }
  function _ctSlot(w, slot) {
    var t = (w.items || []).filter(function (x) { return x && x.slot === slot; })[0];
    return t ? t.vid : 0;
  }
  /**
   * Zustand einer Oeffnung. Das Hausprofil zaehlt 0 zu, 1 halb offen, 2 offen,
   * 3 Tuer offen; ein blanker Boolean bedeutet true = offen. Beides muss gehen,
   * damit sowohl die abgeleiteten Variablen als auch ein roher Melder passen.
   */
  function _ctOffen(vid) {
    var d = _ctVal(vid);
    if (!d) { return {k: 'unbek', t: '?'}; }
    var v = d.v;
    if (v === true)  { return {k: 'crit', t: 'offen'}; }
    if (v === false) { return {k: 'ok',   t: 'zu'}; }
    var n = parseInt(v);
    if (isNaN(n)) { return {k: 'unbek', t: String(d.f != null && d.f !== '' ? d.f : v)}; }
    if (n === 0) { return {k: 'ok',   t: 'zu'}; }
    if (n === 1) { return {k: 'warn', t: 'halb offen'}; }
    return           {k: 'crit', t: (n === 3 ? 'Tür offen' : 'offen')};
  }
  function _ctFarbe(k) {
    return k === 'ok' ? cssv('--ok') : k === 'warn' ? cssv('--warn')
         : k === 'crit' ? cssv('--crit') : cssv('--muted');
  }
  /** Abweichung vom Soll in bar; NaN, wenn eines von beiden fehlt. */
  function _ctDelta(w, ecke) {
    var p = _ctNum(_ctSlot(w, 'p' + ecke)), s = _ctNum(_ctSlot(w, 's' + ecke));
    return (isNaN(p) || isNaN(s)) ? NaN : (p - s);
  }
  function _ctDruckK(d) {
    if (isNaN(d)) { return 'unbek'; }
    if (d <= -0.25) { return 'crit'; }
    if (d <= -0.05) { return 'warn'; }
    return 'ok';
  }

  function _ctEl(w) {
    var sel = '.w[data-id="' + w.id + '"] [data-role=ctroot]';
    var oc = document.getElementById('ovcanvas');
    return (oc && oc.querySelector(sel)) || (typeof canvas !== 'undefined' && canvas && canvas.querySelector(sel)) || null;
  }

  function _ctSvg(w) {
    var s = '<svg viewBox="0 0 300 470" preserveAspectRatio="xMidYMid meet" '
          + 'style="width:100%;height:100%;display:block" aria-hidden="true">';
    // Karosserie, Scheiben, Dach, Tuerfugen - bewusst schlicht: das Bild ist der
    // Traeger der Zustaende, nicht das Motiv.
    s += '<path d="M150 12c34 0 62 16 70 44l10 44c6 26 8 56 8 96v92c0 42-3 74-9 100l-9 40'
       + 'c-8 26-36 40-70 40s-62-14-70-40l-9-40c-6-26-9-58-9-100v-92c0-40 2-70 8-96l10-44'
       + 'c8-28 36-44 70-44Z" fill="var(--tile)" stroke="var(--line)" stroke-width="1.6"/>'
       + '<path d="M150 58c22 0 40 7 47 18l7 26c-18-8-35-11-54-11s-36 3-54 11l7-26c7-11 25-18 47-18Z" '
       + 'fill="var(--surface-2)" stroke="var(--line)" stroke-width="1.3"/>'
       + '<path d="M150 412c-19 0-36-3-53-10l6 24c7 11 25 17 47 17s40-6 47-17l6-24c-17 7-34 10-53 10Z" '
       + 'fill="var(--surface-2)" stroke="var(--line)" stroke-width="1.3"/>'
       + '<rect x="86" y="132" width="128" height="212" rx="26" fill="var(--bg)" '
       + 'stroke="var(--line)" stroke-width="1.3"/>'
       + '<path d="M86 208h-16M214 208h16M86 286h-16M214 286h16" stroke="var(--line)" '
       + 'stroke-width="1.4" stroke-linecap="round"/>'
       + '<path d="M70 150v120M230 150v120M70 270v96M230 270v96" stroke="var(--line)" stroke-width="1.2"/>';
    // Raeder
    _CT_RAD.forEach(function (r) {
      s += '<rect data-ctrad="' + r[0] + '" x="' + r[1] + '" y="' + r[2] + '" width="17" height="52" '
         + 'rx="6" fill="var(--bg)" stroke="var(--muted)" stroke-width="1.8"/>';
    });
    // Oeffnungsmarken
    Object.keys(_CT_POS).forEach(function (k) {
      var p = _CT_POS[k];
      s += '<g data-ctmark="' + k + '" transform="translate(' + p[0] + ',' + p[1] + ')">'
         + '<circle r="7" fill="var(--bg)" stroke="var(--muted)" stroke-width="1.6"/>'
         + '<path class="ct-ok" d="m-2.8 0 2 2.1 3.6-3.9" fill="none" stroke="var(--muted)" '
         + 'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
         + '<path class="ct-warn" d="M0-3.4v4.1M0 2.6v.3" fill="none" stroke="var(--muted)" '
         + 'stroke-width="1.9" stroke-linecap="round" style="display:none"/>'
         + '<title></title></g>';
    });
    return s + '</svg>';
  }

  function _ctPaint(w) {
    var el = _ctEl(w); if (!el) { return; }
    var svg = el.querySelector('svg'); if (!svg) { return; }

    // Oeffnungen
    Object.keys(_CT_POS).forEach(function (k) {
      var g = svg.querySelector('[data-ctmark="' + k + '"]'); if (!g) { return; }
      var z = _ctOffen(_ctSlot(w, k)), c = _ctFarbe(z.k);
      g.querySelector('circle').setAttribute('stroke', c);
      var ok = g.querySelector('.ct-ok'), wr = g.querySelector('.ct-warn');
      ok.setAttribute('stroke', c); wr.setAttribute('stroke', c);
      ok.style.display = (z.k === 'ok') ? '' : 'none';
      wr.style.display = (z.k === 'ok') ? 'none' : '';
      var nm = (_CT_SLOTS.filter(function (x) { return x[0] === k; })[0] || ['', k])[1];
      g.querySelector('title').textContent = nm + ': ' + z.t;
    });

    // Raeder faerben und die vier Beschriftungen setzen
    _CT_RAD.forEach(function (r) {
      var e = svg.querySelector('[data-ctrad="' + r[0] + '"]'); if (!e) { return; }
      e.setAttribute('stroke', _ctFarbe(_ctDruckK(_ctDelta(w, r[0]))));
    });
    ['VL', 'VR', 'HL', 'HR'].forEach(function (k) {
      var box = el.querySelector('[data-ctp="' + k + '"]'); if (!box) { return; }
      var d = _ctVal(_ctSlot(w, 'p' + k));
      var dl = _ctDelta(w, k), kl = _ctDruckK(dl);
      box.querySelector('.ctp-v').textContent = d ? ((d.f != null && d.f !== '') ? d.f : String(d.v)) : '–';
      box.querySelector('.ctp-v').style.color = _ctFarbe(kl);
      var s = box.querySelector('.ctp-d');
      s.textContent = isNaN(dl) ? '' : ((dl >= 0 ? '+' : '−') + Math.abs(dl).toFixed(1).replace('.', ',') + ' bar');
      s.style.color = _ctFarbe(kl);
    });

    // Fusszeile: was ist offen
    var f = el.querySelector('[data-role=ctfoot]');
    if (f) {
      var offen = [], unbek = 0;
      Object.keys(_CT_POS).forEach(function (k) {
        var z = _ctOffen(_ctSlot(w, k));
        if (z.k === 'crit' || z.k === 'warn') {
          offen.push((_CT_SLOTS.filter(function (x) { return x[0] === k; })[0] || ['', k])[1]
                     .replace(/^Ecke /, '') + ' ' + z.t);
        } else if (z.k === 'unbek') { unbek++; }
      });
      var n = Object.keys(_CT_POS).length;
      f.className = 'ct-foot' + (offen.length ? ' auf' : '');
      f.textContent = offen.length
        ? offen.join(' · ')
        : (unbek === n ? 'keine Rückmeldung' : 'alle ' + (n - unbek) + ' Öffnungen zu');
    }
  }

  defWidget('cartop', {
    label: 'Fahrzeug von oben',
    cat: 'Anzeige',
    paletteIcon: 'wtile',
    size: [460, 520],
    defaults: function (w) {
      w.items = _CT_SLOTS.map(function (s) { return {slot: s[0], vid: 0}; });
      w.ctFoot = true;
    },
    render: function (w) {
      var ecke = function (k, nm, seite) {
        return '<div class="ct-p ' + seite + '" data-ctp="' + k + '">'
             + '<span class="ctp-v">–</span>'
             + '<span class="ctp-n">' + escL(nm) + '</span>'
             + '<span class="ctp-d"></span></div>';
      };
      return '<div class="panel ct"><div data-role="ctroot" class="ct-root">'
        + '<div class="ct-bau">'
        +   ecke('VL', 'vorne links', 'lo') + ecke('VR', 'vorne rechts', 'ro')
        +   ecke('HL', 'hinten links', 'lu') + ecke('HR', 'hinten rechts', 'ru')
        +   '<div class="ct-svg">' + _ctSvg(w) + '</div>'
        + '</div>'
        + (w.ctFoot === false ? '' : '<div class="ct-foot" data-role="ctfoot">–</div>')
        + '</div></div>';
    },
    mount: function (w) { _ctPaint(w); },
    props: function (w) {
      var s = '<div class="pgh">Öffnungen</div>'
        + '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">'
        + 'Erwartet wird das Öffnungs-Profil (0 zu · 1 halb offen · 2 offen · 3 Tür offen); '
        + 'ein einfacher Ja/Nein-Melder geht auch. Jede Ecke fasst Tür UND Fenster zusammen.</div>';
      _CT_SLOTS.forEach(function (sl) {
        if (sl[0].charAt(0) === 'p' || sl[0].charAt(0) === 's') { return; }
        var t = (w.items || []).filter(function (x) { return x && x.slot === sl[0]; })[0] || {};
        s += row(sl[1], '<input data-ctslot="' + sl[0] + '" type="number" value="' + (t.vid || '') + '">');
      });
      s += '<div class="pgh">Reifendruck</div>'
        + '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">'
        + 'Ist und Soll je Rad. Aus der Differenz kommt die Farbe: ab 0,05 bar unter Soll gelb, '
        + 'ab 0,25 bar rot — die Zahl allein sagt nicht, ob sie zu niedrig ist.</div>';
      [['VL', 'vorne links'], ['VR', 'vorne rechts'], ['HL', 'hinten links'], ['HR', 'hinten rechts']]
        .forEach(function (r) {
          var p = (w.items || []).filter(function (x) { return x && x.slot === 'p' + r[0]; })[0] || {};
          var so = (w.items || []).filter(function (x) { return x && x.slot === 's' + r[0]; })[0] || {};
          s += row(r[1], '<input data-ctslot="p' + r[0] + '" type="number" style="width:88px" value="'
                 + (p.vid || '') + '" placeholder="Ist"> '
                 + '<input data-ctslot="s' + r[0] + '" type="number" style="width:88px" value="'
                 + (so.vid || '') + '" placeholder="Soll">');
        });
      return s + '<div class="pgh">Darstellung</div>'
        + row('Fußzeile', '<input type="checkbox" id="pCtFoot"' + (w.ctFoot === false ? '' : ' checked')
              + '> <span style="font-size:11px;color:var(--muted)">nennt, was offen ist — sonst „alle zu"</span>');
    },
    wire: function (w) {
      $$('#props [data-ctslot]').forEach(function (inp) {
        inp.onchange = function () {
          var sl = inp.getAttribute('data-ctslot');
          w.items = (w.items || []).filter(function (x) { return x && x.slot !== sl; });
          w.items.push({slot: sl, vid: parseInt(inp.value) || 0});
          render(); commit();
        };
      });
      if ($('#pCtFoot')) {
        $('#pCtFoot').onchange = function () { w.ctFoot = this.checked; render(); commit(); };
      }
    },
    live: function (w, el, id, d) { _ctPaint(w); return true; }
  });
