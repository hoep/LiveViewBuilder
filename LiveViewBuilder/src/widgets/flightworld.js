  // ===== Widget: Notfälle weltweit (flightworld) =====
  //
  // Zeigt Luftfahrzeuge, die weltweit einen Notfall-Transpondercode senden (7700 Notfall,
  // 7600 Funkausfall, 7500 Entführung). Quelle ist eine JSON-Variable, die ein Symcon-Skript
  // jede Minute von adsb.lol fuellt (Notfälle abrufen) - das Widget fragt selbst nichts ab.
  //
  // DREI DARSTELLUNGEN aus derselben Variable (fwMode):
  //   karte   - Weltkarte (ECharts geo, Grenzen aus Natural Earth, lokal als ?api=asset&name=welt),
  //             pulsierende Punkte in der Codefarbe, geplante Route gestrichelt, Standort als Nadel
  //   liste   - Karten je Maschine (Rufzeichen, Typ, Route, Hoehe, Tempo, Art) plus "heute beendet"
  //   zaehler - Pillen je Code und Stand der Daten, fuer den Seitenkopf
  //
  // WARUM EIN EIGENES WIDGET: Es gab keine Weltkarte. Das Diagramm-Widget kennt keine
  // Geo-Koordinaten, die Flugszene ist lokal (Umkreis in km). Farben ausschliesslich aus dem
  // Skin: 7700 Kritisch, 7600 Warnung, 7500 Info.
  (function () {
    var FW_WELT = null, FW_LAEDT = [];
    function fwWelt(cb) {
      if (FW_WELT) { cb(); return; }
      FW_LAEDT.push(cb);
      if (FW_LAEDT.length > 1) { return; }
      var s = document.createElement('script');
      s.src = '?api=asset&name=welt';
      s.onload = function () { FW_WELT = window.LVB_WELT || null; var l = FW_LAEDT; FW_LAEDT = []; l.forEach(function (f) { f(); }); };
      s.onerror = function () { FW_LAEDT = []; };
      document.head.appendChild(s);
    }
    if (!document.getElementById('fwCss')) {
      var st = document.createElement('style'); st.id = 'fwCss';
      st.textContent = '.fw{position:absolute;inset:0;overflow:hidden}'
        + '.fw-map{position:absolute;inset:0}'
        + '.fw-leer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:clamp(11px,2.2cqmin,15px)}'
        + '.fw-list{position:absolute;inset:0;overflow:auto;padding:clamp(8px,2cqmin,14px);box-sizing:border-box}'
        + '.fw-h{font-size:clamp(10px,1.8cqmin,12px);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:2px 4px 8px}'
        + '.fw-it{margin:0 0 clamp(6px,1.4cqmin,10px);padding:clamp(8px,1.8cqmin,13px) clamp(10px,2cqmin,14px);border-radius:12px;background:var(--surface-2);border-left:4px solid var(--c)}'
        + '.fw-r1{display:flex;align-items:baseline;gap:8px;min-width:0}'
        + '.fw-r1 b{font:600 clamp(13px,2.6cqmin,17px) var(--fm,monospace)}'
        + '.fw-r1 span{color:var(--muted);font-size:clamp(10px,1.8cqmin,12px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fw-r1 .fw-cd{margin-left:auto;font:700 clamp(11px,2cqmin,13px) var(--fm,monospace);color:var(--c)}'
        + '.fw-rt{font-size:clamp(11px,2.1cqmin,13.5px);margin-top:5px}'
        + '.fw-mt{font:clamp(10px,1.8cqmin,12px) var(--fm,monospace);color:var(--muted);margin-top:4px}'
        + '.fw-um{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:1px 6px;border-radius:5px;background:var(--warn);color:#2a2410;margin-left:6px;vertical-align:1px}'
        + '.fw-he{border-top:1px solid var(--line);margin-top:10px;padding-top:10px}'
        + '.fw-hz{display:flex;justify-content:space-between;gap:10px;font-size:clamp(10px,1.8cqmin,12px);color:var(--muted);padding:3px 4px}'
        + '.fw-hz span:last-child{white-space:nowrap}'
        + '.fw-zl{position:absolute;inset:0;display:flex;align-items:center;gap:clamp(6px,1.4cqi,12px);padding:0 4px;flex-wrap:wrap}'
        + '.fw-zi{display:inline-flex;align-items:center;gap:.5em;color:var(--muted);opacity:.55;white-space:nowrap}'
        + '.fw-zi.an{color:var(--c);opacity:1}'
        + '.fw-zs{position:relative;display:inline-flex;align-items:center;justify-content:center;height:min(88cqh,34px);aspect-ratio:1;border-radius:50%;'
        + 'background:color-mix(in oklab,var(--text) 6%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--text) 15%,transparent)}'
        + '.fw-zi.an .fw-zs{background:color-mix(in oklab,var(--c) 18%,transparent);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--c) 45%,transparent)}'
        + '.fw-zs svg{width:56%;height:56%}'
        + '.fw-zb{position:absolute;top:-3px;right:-6px;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:99px;background:var(--c);color:#fff;'
        + 'font:700 10px/16px Inter,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px var(--bg)}'
        + '.fw-zt{display:flex;flex-direction:column;line-height:1.1;font:600 clamp(10px,36cqh,13px) var(--fm,monospace)}'
        + '.fw-zt small{font:500 clamp(8px,28cqh,10.5px) Inter,system-ui,sans-serif;opacity:.8}'
        + '.fw-st{margin-left:auto;color:var(--muted);font-size:clamp(9px,34cqh,12px);white-space:nowrap}';
      document.head.appendChild(st);
    }
    var FW_CODE = {'7700': {c: 'crit', t: 'Notfall', tp: 'Notfälle'}, '7600': {c: 'warn', t: 'Funkausfall', tp: 'Funkausfälle'},
                   '7500': {c: 'info', t: 'Entführung', tp: 'Entführungen'}};
    function fwDaten(w) {
      var d = w.varId && _lastVals[w.varId];
      if (!d) { return null; }
      try { return typeof d.v === 'string' ? JSON.parse(d.v) : d.v; } catch (e) { return null; }
    }
    function fwBox(w) { var e = $('.w[data-id="' + w.id + '"] .fw'); return e || $('#ovcanvas .w[data-id="' + w.id + '"] .fw'); }
    function fwRoute(r) {
      if (!r || !r.von || !r.nach) { return ''; }
      var n = function (p) { return (p.ort || p.iata || p.icao || '?') + (p.iata ? ' (' + p.iata + ')' : ''); };
      return n(r.von) + ' → ' + n(r.nach);
    }
    function fwAlt(m) {
      if (m.boden) { return 'am Boden'; }
      if (m.fl == null) { return 'Höhe ?'; }
      var t = m.fl < 60 ? (m.fl * 100) + ' ft' : 'FL ' + m.fl;
      if (m.vs != null && Math.abs(m.vs) > 300) { t += m.vs < 0 ? ' ↓' : ' ↑'; }
      return t;
    }
    /** Zwei Hex-Farben mischen (Anteil b). Canvas versteht kein color-mix(). */
    function fwMisch(a, b, t) {
      var p = function (h) { h = String(h || '').trim().replace('#', ''); if (h.length === 3) { h = h.replace(/./g, '$&$&'); }
        return /^[0-9a-f]{6}$/i.test(h) ? [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }) : null; };
      var x = p(a), y = p(b); if (!x || !y) { return a || '#1a2428'; }
      return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join('');
    }
    function fwUhr(t) { var d = new Date(t * 1000); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    function fwAlter(t) { var s = Math.max(0, Math.round(Date.now() / 1000 - t)); return s < 90 ? s + ' s' : Math.round(s / 60) + ' min'; }

    function fwListe(w, box, d) {
      var a = (d && d.aktiv) || [], h = (d && d.heute) || [];
      var html = '<div class="fw-list"><div class="fw-h">Jetzt in der Luft</div>';
      if (!a.length) { html += '<div class="fw-hz"><span>Zurzeit sendet weltweit keine Maschine einen Notfallcode.</span></div>'; }
      a.forEach(function (m) {
        var c = FW_CODE[m.code] || FW_CODE['7700'];
        html += '<div class="fw-it" style="--c:var(--' + c.c + ')"><div class="fw-r1"><b>' + esc(m.ruf || m.hex) + '</b><span>'
          + esc([m.typ, m.reg].filter(Boolean).join(' · ')) + '</span><span class="fw-cd">' + esc(m.code) + '</span></div>'
          + '<div class="fw-rt">' + (esc(fwRoute(m.route)) || '<span style="color:var(--muted)">Route unbekannt</span>')
          + (m.umleitung ? '<span class="fw-um">Umleitung?</span>' : '') + '</div>'
          + '<div class="fw-mt">' + esc(fwAlt(m)) + (m.kt != null ? ' · ' + m.kt + ' kt' : '') + ' · seit ' + esc(fwAlter(m.seit))
          + ' · ' + esc(m.art || c.t) + (m.umleitung && m.zielKm ? ' · Ziel noch ' + m.zielKm + ' km' : '') + '</div></div>';
      });
      if (h.length) {
        html += '<div class="fw-he"><div class="fw-h">Heute beendet</div>';
        h.slice(0, 12).forEach(function (x) {
          html += '<div class="fw-hz"><span>' + esc((x.ruf || x.hex) + ' · ' + x.code + (x.route ? ' · ' + fwRoute(x.route) : '')) + '</span><span>'
            + fwUhr(x.von) + '–' + fwUhr(x.bis) + ', ' + esc(x.ende) + (x.umleitung ? ' · Umleitung?' : '') + '</span></div>';
        });
        html += '</div>';
      }
      box.innerHTML = html + '</div>';
    }
    // Zaehler als Symbole mit Abzeichen (wie die Glocke der Lage): bei 0 gedaempft ohne Zahl,
    // sonst in der Codefarbe mit Zahl. Warndreieck 7700, Funk durchgestrichen 7600, Schloss 7500.
    var FW_IC = {
      '7700': '<path d="M12 3.5 2.5 20h19L12 3.5z"/><path d="M12 10v4.5M12 17.2v.3"/>',
      '7600': '<path d="M5 12a7 7 0 0 1 2-4.9M19 12a7 7 0 0 0-2-4.9M8.3 12a3.7 3.7 0 0 1 1.1-2.6M15.7 12a3.7 3.7 0 0 0-1.1-2.6"/><circle cx="12" cy="12" r="1.2"/><path d="M12 13.5V21M4 4l16 16"/>',
      '7500': '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>'
    };
    function fwZaehler(w, box, d) {
      var z = (d && d.zaehler) || {};
      box.innerHTML = '<div class="fw-zl">' + ['7700', '7600', '7500'].map(function (k) {
        var n = +z[k] || 0, c = FW_CODE[k];
        return '<span class="fw-zi' + (n ? ' an' : '') + '" style="--c:var(--' + c.c + ')" title="' + k + ' ' + c.t + ': ' + n + '">'
          + '<span class="fw-zs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + FW_IC[k] + '</svg>'
          + (n ? '<b class="fw-zb">' + (n > 99 ? '99+' : n) + '</b>' : '') + '</span>'
          + '<span class="fw-zt">' + k + '<small>' + c.t + '</small></span></span>';
      }).join('') + '<span class="fw-st">' + (d ? esc((d.quelle || '') + ' · vor ' + fwAlter(d.stand) + (d.teilweise ? ' · unvollständig' : '')) : 'keine Daten') + '</span></div>';
    }
    function fwKarte(w, box, d) {
      if (typeof echarts === 'undefined') { setTimeout(function () { fwKarte(w, box, d); }, 400); return; }
      fwWelt(function () {
        if (!FW_WELT) { box.innerHTML = '<div class="fw-leer">Weltkarte nicht geladen</div>'; return; }
        if (!echarts.getMap('lvbwelt')) { echarts.registerMap('lvbwelt', FW_WELT); }
        var el = box.querySelector('.fw-map');
        if (!el) { box.innerHTML = '<div class="fw-map"></div>'; el = box.firstChild; }
        var ec = echarts.getInstanceByDom(el) || echarts.init(el, null, {renderer: 'canvas'});
        if (!box._fwRo && typeof ResizeObserver !== 'undefined') { box._fwRo = new ResizeObserver(function () { ec.resize(); }); box._fwRo.observe(box); }
        var a = (d && d.aktiv) || [], linien = [], pkt = [];
        a.forEach(function (m) {
          var c = cssv('--' + (FW_CODE[m.code] || FW_CODE['7700']).c);
          var r = m.route;
          if (r && r.von && r.nach && r.von.lat && r.nach.lat) {
            linien.push({coords: [[r.von.lon, r.von.lat], [m.lon, m.lat]], lineStyle: {color: cssv('--muted'), type: 'solid', opacity: .5}});
            linien.push({coords: [[m.lon, m.lat], [r.nach.lon, r.nach.lat]], lineStyle: {color: m.umleitung ? cssv('--warn') : cssv('--muted'), type: 'dashed', opacity: .7}});
          }
          pkt.push({name: m.ruf || m.hex, value: [m.lon, m.lat], itemStyle: {color: c},
            label: {show: true, position: 'right', formatter: (m.ruf || m.hex) + '  ' + m.code + (m.umleitung ? '  ?' : ''), color: cssv('--text'),
                    fontFamily: cssv('--fm') || 'monospace', fontSize: 12, backgroundColor: 'rgba(0,0,0,.45)', padding: [3, 6], borderRadius: 5}});
        });
        var heim = (typeof _lvGeoLat === 'function' && _lvGeoLat()) ? [{name: 'Standort', value: [_lvGeoLon(), _lvGeoLat()]}] : [];
        var land = cssv('--surface-2'), linie = cssv('--line');
        ec.setOption({backgroundColor: 'transparent', animation: false,
          tooltip: {trigger: 'item', formatter: function (p) {
            if (p.seriesType !== 'effectScatter') { return ''; }
            var m = a.filter(function (x) { return (x.ruf || x.hex) === p.name; })[0]; if (!m) { return ''; }
            return '<b>' + esc(p.name) + '</b> · ' + esc(m.code) + '<br>' + esc(fwRoute(m.route) || 'Route unbekannt') + '<br>' + esc(fwAlt(m)) + (m.kt != null ? ' · ' + m.kt + ' kt' : '');
          }},
          geo: {map: 'lvbwelt', roam: true, zoom: (w.fwZoom > 0 ? +w.fwZoom : 1.25), center: [10, 28], scaleLimit: {min: 1, max: 20},
                itemStyle: {areaColor: fwMisch(land, cssv('--muted'), .3), borderColor: linie, borderWidth: .6},
                emphasis: {disabled: true}, select: {disabled: true}, label: {show: false}},
          series: [
            {type: 'lines', coordinateSystem: 'geo', zlevel: 1, lineStyle: {width: 1.5, curveness: .18}, data: linien, silent: true},
            {type: 'effectScatter', coordinateSystem: 'geo', zlevel: 2, symbolSize: 11, rippleEffect: {scale: 4, brushType: 'stroke'}, data: pkt},
            {type: 'scatter', coordinateSystem: 'geo', zlevel: 2, symbol: 'pin', symbolSize: 18, itemStyle: {color: cssv('--accent')}, data: heim, silent: true}
          ]}, true);
        if (!a.length && !box.querySelector('.fw-leer')) {
          var l = document.createElement('div'); l.className = 'fw-leer'; l.style.pointerEvents = 'none'; l.style.alignItems = 'flex-end'; l.style.paddingBottom = '14px';
          l.textContent = 'Zurzeit sendet weltweit keine Maschine einen Notfallcode'; box.appendChild(l);
        } else if (a.length) { var x = box.querySelector('.fw-leer'); if (x) { x.remove(); } }
      });
    }
    function fwZeichne(w) {
      var box = fwBox(w); if (!box) { return; }
      var d = fwDaten(w), m = w.fwMode || 'karte';
      if (m === 'liste') { fwListe(w, box, d); } else if (m === 'zaehler') { fwZaehler(w, box, d); } else { fwKarte(w, box, d); }
    }

    defWidget('flightworld', {
      label: 'Notfälle weltweit', cat: 'Wetter & Zeit', paletteIcon: 'plane', size: [900, 560],
      defaults: function (w) { w.fwMode = 'karte'; },
      render: function () { return '<div class="fw"></div>'; },
      mount: function (w) { fwZeichne(w); },
      live: function (w, el, id) { if (id === w.varId) { fwZeichne(w); } return true; },
      props: function (w) {
        if (w.type !== 'flightworld') { return ''; }
        return row('Darstellung', '<select id="pFwMode">' + [['karte', 'Weltkarte'], ['liste', 'Liste'], ['zaehler', 'Zähler (Kopfzeile)']].map(function (o) {
            return '<option value="' + o[0] + '"' + ((w.fwMode || 'karte') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>')
          + ((w.fwMode || 'karte') === 'karte' ? row('Zoom', '<input id="pFwZoom" type="number" min="1" max="20" step="0.05" style="width:80px" value="' + (w.fwZoom || '') + '" placeholder="1,25">') : '')
          + '<div class="hint" style="font-size:11px;color:var(--muted)">Variable: „Notfälle (JSON)“ unter Flugverkehr → Notfälle weltweit. Sie wird jede Minute vom Skript „Notfälle abrufen“ gefüllt (Quelle adsb.lol, Routen adsbdb).</div>';
      },
      wire: function (w) {
        if ($('#pFwMode')) { $('#pFwMode').onchange = function () { w.fwMode = this.value; render(); renderProps(); commit(); }; }
        if ($('#pFwZoom')) { $('#pFwZoom').onchange = function () { w.fwZoom = parseFloat(this.value) || undefined; render(); commit(); }; }
      }
    });
  })();
