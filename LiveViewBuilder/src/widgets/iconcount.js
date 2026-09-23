  // ===== Widget: Symbol mit Zaehler (iconcount) =====
  //
  // Ein Symbol mit Abzeichen: die Zahl oben rechts sagt, WIE VIEL gerade Aufmerksamkeit
  // braucht, die Farbe WIE DRINGEND. Gedacht fuer die Kopfleiste - neben den
  // Anwesenheiten zeigt es die Hinweise der HomeSuite-Lage und oeffnet per Sprungziel
  // die Startseite.
  //
  //   Variable     Zahl im Abzeichen (0 oder leer = kein Abzeichen, Symbol gedaempft)
  //   Variable 2   Stufe 0-3 faerbt Symbol und Abzeichen: 0 ruhig, 1 Hinweis,
  //                2 Warnung, 3 dringend (ohne Variable 2: Akzentfarbe)
  //
  // WARUM NICHT DAS ICON-WIDGET ERWEITERN: ein Widget mit eigener live-Funktion nimmt
  // sich aus der allgemeinen Wertverarbeitung heraus. Das einfache Icon lebt aber genau
  // davon (Symbol und Farbe je Wert ueber Assoziationen). Ein Zaehler dort haette jedes
  // bestehende Zustands-Icon stillgelegt.
  var _ICC_STUFE = ['var(--muted)', 'var(--info,#5aa9ff)', 'var(--warn)', 'var(--crit)'];
  if (!document.getElementById('iccCss')) {
    var _iccS = document.createElement('style'); _iccS.id = 'iccCss';
    _iccS.textContent = '.icc{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--icc,var(--muted))}'
      + '.icc svg{width:62%;height:62%}'
      + '.icc-b{position:absolute;top:2px;right:0;min-width:17px;height:17px;padding:0 4px;border-radius:99px;display:none;'
      + 'align-items:center;justify-content:center;font:700 10.5px/1 Inter,system-ui,sans-serif;background:var(--icc,var(--accent));'
      + 'color:#fff;box-shadow:0 0 0 2px var(--bg)}'
      + '.icc-b.on{display:inline-flex}';
    document.head.appendChild(_iccS);
  }
  function _iccApply(w, el, id, d) {
    var box = el && el.querySelector('.icc'); if (!box || !d) { return; }
    var n = parseFloat(String(d.v).replace(',', '.'));
    if (String(id) === String(w.varId)) {
      var b = box.querySelector('.icc-b');
      var on = !isNaN(n) && n > 0;
      b.textContent = on ? (n > 99 ? '99+' : String(Math.round(n))) : '';
      b.classList.toggle('on', on);
      box.setAttribute('data-n', on ? '1' : '0');
      if (!w.varId2) { box.style.setProperty('--icc', on ? 'var(--accent)' : 'var(--muted)'); }
    }
    if (String(id) === String(w.varId2)) {
      box.style.setProperty('--icc', _ICC_STUFE[Math.max(0, Math.min(3, isNaN(n) ? 0 : Math.round(n)))]);
    }
  }
  defWidget('iconcount', {
    label: 'Symbol mit Zähler', cat: 'Anzeige', paletteIcon: 'bell', size: [44, 40],
    defaults: function (w) { w.icon = 'bell'; w.frame = false; },
    render: function (w) {
      return '<div class="icc" title="' + esc(w.label || '') + '">' + iconSVG(w.icon || 'bell') + '<span class="icc-b"></span></div>';
    },
    live: function (w, el, id, d) { _iccApply(w, el, id, d); return true; }
  });
