  // ===== Widget: Symbol mit Zaehler (iconcount) =====
  //
  // Ein Symbol mit Abzeichen: die Zahl sagt, WIE VIEL gerade Aufmerksamkeit braucht, die
  // Farbe WIE DRINGEND. Gedacht fuer die Kopfleiste - neben den Anwesenheiten zeigt es die
  // Hinweise der HomeSuite-Lage und oeffnet per Sprungziel die Startseite.
  //
  //   Variable     Zahl im Abzeichen (0 oder leer = kein Abzeichen, Symbol ruhig)
  //   Variable 2   Stufe 0-3 faerbt Symbol und Abzeichen: 0 ruhig, 1 Hinweis,
  //                2 Warnung, 3 dringend (ohne Variable 2: Akzentfarbe)
  //
  // Gestaltung frei (seit 24.09.2026): Farbe ruhig / aktiv / Abzeichen / Abzeichen-Text als
  // Skin-Farbe oder eigene Farbe (Auto = nach Stufe), Abzeichen als Pille, Ring, Punkt oder
  // daneben, Puls, bei 0 ruhig oder ausgeblendet. Die Icon-Stile (Kreis, Glas ...) kommen aus
  // der zentralen Icon-Gestaltung und wirken auf .icc-i.
  //
  // WARUM NICHT DAS ICON-WIDGET ERWEITERN: ein Widget mit eigener live-Funktion nimmt
  // sich aus der allgemeinen Wertverarbeitung heraus. Das einfache Icon lebt aber genau
  // davon (Symbol und Farbe je Wert ueber Assoziationen). Ein Zaehler dort haette jedes
  // bestehende Zustands-Icon stillgelegt.
  var _ICC_STUFE = ['var(--muted)', 'var(--info,#5aa9ff)', 'var(--warn)', 'var(--crit)'];
  if (!document.getElementById('iccCss')) {
    var _iccS = document.createElement('style'); _iccS.id = 'iccCss';
    _iccS.textContent = '.icc{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--wicon,var(--muted));transition:opacity .2s}'
      + '.icc-i{position:relative;height:84%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;box-sizing:border-box}'
      + '.icc-i svg{width:74%;height:74%}'
      + '.icc-i.ist:not(.ist-plain) svg{width:56%;height:56%}'
      + '.icc-b{position:absolute;display:none;align-items:center;justify-content:center;font:700 10.5px/1 Inter,system-ui,sans-serif;'
      + 'background:var(--iccb,var(--accent));color:var(--iccf,#fff);box-shadow:0 0 0 2px var(--bg)}'
      + '.icc-b.on{display:inline-flex}'
      + '.icc-b.pill{top:1px;right:calc(50% - 22px);min-width:17px;height:17px;padding:0 4px;border-radius:99px}'
      + '.icc-b.ring{top:1px;right:calc(50% - 22px);min-width:17px;height:17px;padding:0 4px;border-radius:99px;background:var(--bg);'
      + 'color:var(--iccf,var(--iccb,var(--accent)));box-shadow:inset 0 0 0 1.5px var(--iccb,var(--accent)),0 0 0 2px var(--bg)}'
      + '.icc-b.dot{top:6px;right:calc(50% - 14px);width:9px;height:9px;padding:0;border-radius:50%;font-size:0}'
      + '.icc-b.inline{position:static;min-width:20px;height:20px;padding:0 6px;border-radius:99px;box-shadow:none;font-size:12px;'
      + 'background:color-mix(in oklab,var(--iccb,var(--accent)) 22%,transparent);color:var(--iccf,var(--iccb,var(--accent)))}'
      + '.icc-b.puls.on::after{content:"";position:absolute;inset:-3px;border-radius:99px;box-shadow:0 0 0 2px var(--iccb,var(--accent));animation:iccPuls 1.6s ease-out infinite}'
      + '@keyframes iccPuls{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.7)}}'
      + '.icc.aus{opacity:0;pointer-events:none}';
    document.head.appendChild(_iccS);
  }
  function _iccCol(c) { return c ? (_cssColorOrEmpty(c) || '') : ''; }
  function _iccZahl(id) { var d = id && _lastVals[id]; if (!d) { return NaN; } return parseFloat(String(d.v).replace(',', '.')); }
  /** Zustand komplett aus den letzten Werten neu setzen - so passt es auch nach jedem Neuzeichnen. */
  function _iccUpdate(w, el) {
    var box = el && el.querySelector('.icc'); if (!box) { return; }
    var n = _iccZahl(w.varId), on = !isNaN(n) && n > 0;
    var st = _iccZahl(w.varId2), stufe = w.varId2 ? _ICC_STUFE[Math.max(0, Math.min(3, isNaN(st) ? 0 : Math.round(st)))] : (on ? 'var(--accent)' : 'var(--muted)');
    var b = box.querySelector('.icc-b');
    if (b) {
      b.textContent = on ? (n > 99 ? '99+' : String(Math.round(n))) : '';
      b.classList.toggle('on', on);
      var bc = _iccCol(w.iccBadgeCol) || (w.varId2 ? stufe : 'var(--accent)');
      b.style.setProperty('--iccb', bc);
      var fc = _iccCol(w.iccBadgeFg); if (fc) { b.style.setProperty('--iccf', fc); } else { b.style.removeProperty('--iccf'); }
    }
    var ic = on ? (_iccCol(w.iccAct) || stufe) : (_iccCol(w.iccIdle) || (w.varId2 ? stufe : 'var(--muted)'));
    box.style.setProperty('--wicon', ic);
    box.setAttribute('data-n', on ? '1' : '0');
    box.classList.toggle('aus', !on && w.iccZero === 'hide');
  }
  defWidget('iconcount', {
    label: 'Symbol mit Zähler', cat: 'Anzeige', paletteIcon: 'bell', size: [44, 40],
    defaults: function (w) { w.icon = 'bell'; w.frame = false; },
    render: function (w) {
      var art = (['pill', 'ring', 'dot', 'inline'].indexOf(w.iccBadge) >= 0) ? w.iccBadge : 'pill';
      return '<div class="icc" title="' + esc(w.label || '') + '"><span class="icc-i">' + iconSVG(w.icon || 'bell') + '</span>'
        + '<span class="icc-b ' + art + (w.iccPulse ? ' puls' : '') + '"></span></div>';
    },
    props: function (w) {
      if (w.type !== 'iconcount') { return ''; }
      var sel = function (id, cur, opts) { return '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + ((cur || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; };
      return row('Abzeichen', sel('pIccBadge', w.iccBadge, [['', 'Zahl (Pille)'], ['ring', 'Zahl (Ring)'], ['dot', 'Punkt'], ['inline', 'Zahl daneben']]))
        + row('Puls', '<input type="checkbox" id="pIccPulse"' + (w.iccPulse ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">Abzeichen pulsiert, solange etwas ansteht</span>')
        + row('Bei 0', sel('pIccZero', w.iccZero, [['', 'ruhig zeigen'], ['hide', 'ausblenden']]))
        + row('Farbe ruhig', farbWahl('iccIdle', w.iccIdle))
        + row('Farbe aktiv', farbWahl('iccAct', w.iccAct))
        + row('Abzeichen-Farbe', farbWahl('iccBadgeCol', w.iccBadgeCol))
        + row('Abzeichen-Text', farbWahl('iccBadgeFg', w.iccBadgeFg))
        + '<div class="hint" style="font-size:11px;color:var(--muted)">Auto = nach Stufe aus Variable 2 (ruhig, Hinweis, Warnung, dringend), ohne sie Akzent. Form und Hintergrund des Symbols: Icon-Stil unter „Icon &amp; Grafik“.</div>';
    },
    wire: function (w) {
      if ($('#pIccBadge')) { $('#pIccBadge').onchange = function () { w.iccBadge = this.value || undefined; render(); commit(); }; }
      if ($('#pIccPulse')) { $('#pIccPulse').onchange = function () { w.iccPulse = this.checked || undefined; render(); commit(); }; }
      if ($('#pIccZero')) { $('#pIccZero').onchange = function () { w.iccZero = this.value || undefined; render(); commit(); }; }
    },
    mount: function (w, el) { el = el || $('.w[data-id="' + w.id + '"]'); _iccUpdate(w, el); },
    live: function (w, el) { _iccUpdate(w, el); return true; }
  });
