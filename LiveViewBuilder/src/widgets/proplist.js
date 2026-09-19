  // ===== Widget: proplist — Listen-Eigenschaft eines Moduls bearbeiten =====
  //
  //  Viele Module halten ihre Regeln als JSON-Liste in einer EIGENSCHAFT, nicht in
  //  Variablen: die sechs Tabellen des Serienrecorders, Regelsaetze im
  //  PoolController, Zuordnungen in HomeSuite. Weder ?api=val noch das Archiv
  //  kommen daran, und bis hierher gab es dafuer kein Bauteil - nur das
  //  Konfigurationsformular von Symcon.
  //
  //  Bewusst NICHT auf ein Modul zugeschnitten: gebunden wird an (Instanz,
  //  Eigenschaftsname). Ueberschriften, Spaltenbreiten und Wertebereiche liefert
  //  das MODUL ueber <PREFIX>_TabelleSchema(); dieselbe Quelle prueft dort auch
  //  beim Speichern. Ein Schema hier nachzupflegen hiesse, dieselbe Regel zweimal
  //  zu fuehren - und dann bietet die Oberflaeche irgendwann Spalten an, die die
  //  Pruefung nicht kennt.
  //
  //  Geschrieben wird NICHT sofort: Aenderungen gehen in den geteilten
  //  Tabellenpuffer (tabPut in 06-live.js). Eine Speicherleiste auf derselben
  //  Ansicht zaehlt sie zusammen mit den Wertaenderungen und schreibt in einem Zug.
  //  Ohne Speicherleiste gaebe es kein Speichern - das ist Absicht und wird unten
  //  auch angezeigt, statt still nichts zu tun.
  (function () {
    var _plZ = {};                                   // Zustand je Kachel
    var _plKachel = [];                              // fuer plNachladen()

    function _plS(w) { if (!_plZ[w.id]) { _plZ[w.id] = {suche: '', bearb: null}; } return _plZ[w.id]; }
    function _plEl(w) { return document.querySelector('.w.t-proplist[data-id="' + w.id + '"]'); }

    /** Alle proplist-Kacheln neu vom Server holen - nach dem Speichern.
     *  Jede Widget-Datei liegt in einer eigenen Kapsel; die Speicherleiste sieht
     *  diese Funktion also nur, wenn sie ausdruecklich herausgereicht wird. */
    function plNachladen() { _plKachel.forEach(function (w) { _plLaden(w); }); }
    window.plNachladen = plNachladen;

    function _plLaden(w) {
      var z = _plS(w), inst = parseInt(w.plInst) || 0, prop = String(w.plProp || '');
      if (!inst || !prop) { z.fehler = 'Instanz und Eigenschaft wählen'; _plMal(w); return; }
      fetch('?api=proplist&inst=' + encodeURIComponent(inst) + '&prop=' + encodeURIComponent(prop), {cache: 'no-store'})
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) { z.zeilen = j.zeilen || []; z.spalten = j.spalten; z.schreibbar = !!j.schreibbar; z.fehler = null; }
          else { z.fehler = (j && j.grund) || 'nicht erreichbar'; }
          _plMal(w);
        })
        .catch(function (e) { z.fehler = 'Abruf fehlgeschlagen'; _plMal(w); });
    }

    /** Sicht = gespeicherte Zeilen, ueberlagert vom Puffer. */
    function _plSicht(w) {
      var z = _plS(w), gepuffert = (typeof tabGet === 'function') ? tabGet(parseInt(w.plInst) || 0, String(w.plProp || '')) : null;
      return gepuffert ? gepuffert : (z.zeilen || []);
    }
    function _plSchreib(w, zeilen) {
      if (typeof tabPut === 'function') { tabPut(parseInt(w.plInst) || 0, String(w.plProp || ''), zeilen); }
      _plMal(w);
    }
    function _plSpalten(w) {
      var z = _plS(w), sp = z.spalten;
      if (!sp) { return []; }
      return Object.keys(sp).map(function (k) { return Object.assign({feld: k}, sp[k]); });
    }
    function _plText(c, v, zeile) {
      if (c.anders != null && String(v == null ? '' : v) === String(zeile[c.anders] == null ? '' : zeile[c.anders])) { return '<span class="pl-dim">—</span>'; }
      if (c.art === 'ja') { return '<button class="pl-sw' + (v ? ' on' : '') + '" data-plja="1"><i></i></button>'; }
      if (c.art === 'wahl' && c.namen && c.namen[v] != null) { return esc(c.namen[v]); }
      return esc(String(v == null ? '' : v));
    }

    function _plMal(w) {
      var el = _plEl(w); if (!el) { return; }
      var host = el.querySelector('[data-role=plhost]'); if (!host) { return; }
      var z = _plS(w);
      if (z.fehler) { host.innerHTML = '<div class="pl-leer">' + esc(z.fehler) + '</div>'; return; }
      if (!z.spalten) { host.innerHTML = '<div class="pl-leer">wird geladen …</div>'; return; }
      var cols = _plSpalten(w), alle = _plSicht(w), such = (z.suche || '').toLowerCase();
      var erst = cols.length ? cols[0].feld : '';
      var sicht = alle.map(function (r, i) { return {r: r, i: i}; });
      if (such) { sicht = sicht.filter(function (o) { return String(o.r[erst] || '').toLowerCase().indexOf(such) >= 0; }); }
      var offen = (typeof tabGet === 'function' && tabGet(parseInt(w.plInst) || 0, String(w.plProp || ''))) ? 1 : 0;
      var h = '<div class="pl-kopf"><b>' + esc(w.label || w.plProp || 'Tabelle') + '</b>'
        + '<span class="pl-zahl">' + alle.length + '</span>'
        + (offen ? '<i class="pl-punkt" title="nicht gespeichert"></i>' : '')
        + (w.plHint ? '<span class="pl-hint">' + esc(w.plHint) + '</span>' : '')
        + (z.schreibbar ? '<button class="pl-plus" data-plneu title="Zeile anlegen">+</button>' : '')
        + '</div>';
      if (w.plSuche) {
        h += '<div class="pl-such"><input type="search" data-plsuche placeholder="suchen" value="' + esc(z.suche || '') + '">'
          + '<span class="pl-zaehl">' + sicht.length + ' / ' + alle.length + '</span></div>';
      }
      h += '<div class="pl-tab"><table><thead><tr>'
        + cols.map(function (c) { return '<th style="width:' + esc(c.breite || 'auto') + '">' + esc(c.titel || c.feld) + '</th>'; }).join('')
        + (z.schreibbar ? '<th style="width:30px"></th>' : '') + '</tr></thead><tbody>';
      sicht.forEach(function (o) {
        var bearb = (z.bearb === o.i);
        h += '<tr' + (bearb ? ' class="pl-bearb"' : '') + ' data-plzeile="' + o.i + '">'
          + cols.map(function (c) {
              if (!bearb || c.art === 'ja') { return '<td data-plfeld="' + esc(c.feld) + '">' + _plText(c, o.r[c.feld], o.r) + '</td>'; }
              if (c.art === 'wahl') {
                return '<td><select data-plein="' + esc(c.feld) + '">' + (c.werte || []).map(function (v) {
                  return '<option value="' + esc(v) + '"' + (String(o.r[c.feld]) === String(v) ? ' selected' : '') + '>'
                    + esc((c.namen && c.namen[v]) || v) + '</option>';
                }).join('') + '</select></td>';
              }
              return '<td><input data-plein="' + esc(c.feld) + '"' + (c.art === 'zahl' ? ' type="number"' : '') + ' value="' + esc(String(o.r[c.feld] == null ? '' : o.r[c.feld])) + '"></td>';
            }).join('')
          + (z.schreibbar ? '<td class="pl-akt">' + (bearb ? '<button data-plfertig title="übernehmen">✓</button>' : '<button data-plweg title="Zeile entfernen">&times;</button>') + '</td>' : '')
          + '</tr>';
      });
      if (!sicht.length) { h += '<tr><td colspan="' + (cols.length + 1) + '" class="pl-leer">' + (such ? 'kein Treffer' : 'keine Zeile') + '</td></tr>'; }
      h += '</tbody></table></div>';
      if (offen && !document.querySelector('[data-role=savewrap]')) {
        h += '<div class="pl-warn">Geändert, aber auf dieser Ansicht liegt keine Speicherleiste — ohne sie wird nichts geschrieben.</div>';
      }
      host.innerHTML = h;
    }

    defWidget('proplist', {
      label: 'Eigenschaftstabelle',
      cat: 'Einstellungen',
      paletteIcon: 'wtable',
      size: [440, 240],
      noHover: true,
      render: function (w) { return '<style>' + PLCSS + '</style><div class="pl-wrap" data-role="plhost"></div>'; },
      props: function (w) {
        if (w.type !== 'proplist') { return ''; }
        return '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Bearbeitet eine Listen-Eigenschaft eines Moduls. Überschriften und Spalten liefert das Modul selbst; geschrieben wird über eine Speicherleiste auf derselben Ansicht.</div>'
          + row('Instanz', '<input id="pPlInst" type="number" value="' + (w.plInst || '') + '" placeholder="Instanz-ID">')
          + row('Eigenschaft', '<input id="pPlProp" value="' + esc(w.plProp || '') + '" placeholder="z. B. Serienliste">')
          + row('Hinweis', '<input id="pPlHint" value="' + esc(w.plHint || '') + '" placeholder="kurze Erläuterung">')
          + row('Suchfeld', '<input type="checkbox" id="pPlSuche"' + (w.plSuche ? ' checked' : '') + '> <span style="font-size:11px;color:var(--muted)">für lange Listen</span>');
      },
      wire: function (w) {
        if ($('#pPlInst')) { $('#pPlInst').oninput = function () { w.plInst = parseInt(this.value) || undefined; render(); commit(); }; }
        if ($('#pPlProp')) { $('#pPlProp').oninput = function () { w.plProp = this.value || undefined; render(); commit(); }; }
        if ($('#pPlHint')) { $('#pPlHint').oninput = function () { w.plHint = this.value || undefined; render(); commit(); }; }
        if ($('#pPlSuche')) { $('#pPlSuche').onchange = function () { w.plSuche = this.checked || undefined; render(); commit(); }; }
      },
      mount: function (w) {
        var el = _plEl(w); if (!el) { return; }
        if (_plKachel.indexOf(w) < 0) { _plKachel.push(w); }
        if (!el._pl) {
          el._pl = 1;
          el.addEventListener('input', function (e) {
            var s = e.target.closest('[data-plsuche]');
            if (s) { var z = _plS(w); z.suche = s.value; _plMal(w);
              var n = _plEl(w).querySelector('[data-plsuche]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }
          });
        }
        _plLaden(w);
      },
      click: function (w, el, e) {
        var z = _plS(w), t = e.target, b, zeilen = _plSicht(w).map(function (r) { return Object.assign({}, r); });
        var tr = t.closest('[data-plzeile]'), i = tr ? parseInt(tr.getAttribute('data-plzeile'), 10) : -1;
        if ((b = t.closest('[data-plja]'))) {
          var feld = b.closest('[data-plfeld]').getAttribute('data-plfeld');
          zeilen[i][feld] = !zeilen[i][feld]; _plSchreib(w, zeilen); return true;
        }
        if ((b = t.closest('[data-plweg]'))) { zeilen.splice(i, 1); z.bearb = null; _plSchreib(w, zeilen); return true; }
        if ((b = t.closest('[data-plfertig]'))) {
          _plEl(w).querySelectorAll('tr[data-plzeile="' + i + '"] [data-plein]').forEach(function (inp) {
            var f = inp.getAttribute('data-plein'), sp = _plSpalten(w).filter(function (c) { return c.feld === f; })[0];
            zeilen[i][f] = (sp && sp.art === 'zahl') ? (parseInt(inp.value, 10) || 0) : inp.value;
          });
          z.bearb = null; _plSchreib(w, zeilen); return true;
        }
        if ((b = t.closest('[data-plneu]'))) {
          var leer = {};
          _plSpalten(w).forEach(function (c) { leer[c.feld] = (c.art === 'zahl') ? (c.vorgabe != null ? c.vorgabe : 0) : (c.art === 'ja' ? (c.vorgabe !== false) : (c.vorgabe != null ? c.vorgabe : '')); });
          zeilen.push(leer); z.bearb = zeilen.length - 1; _plSchreib(w, zeilen); return true;
        }
        if (tr && z.schreibbar) { z.bearb = (z.bearb === i) ? null : i; _plMal(w); return true; }
        return false;
      }
    });

    var PLCSS = ''
      + '.pl-wrap{position:absolute;inset:0;display:flex;flex-direction:column;font-size:12px;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden}'
      + '.pl-kopf{display:flex;align-items:center;gap:7px;padding:5px 10px;border-bottom:1px solid var(--line-soft);flex:none}'
      + '.pl-kopf b{font-size:13px}'
      + '.pl-zahl{background:var(--surface-2);border-radius:999px;padding:1px 7px;color:var(--muted);font-size:11px}'
      + '.pl-punkt{width:6px;height:6px;border-radius:50%;background:var(--warn);display:inline-block}'
      + '.pl-hint{color:var(--faint);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.pl-plus{margin-left:auto;background:var(--surface-2);border:1px solid var(--line);color:var(--accent);border-radius:7px;width:24px;height:24px;cursor:pointer;font-size:15px;line-height:1;flex:none}'
      + '.pl-such{display:flex;align-items:center;gap:7px;padding:6px 9px 3px;flex:none}'
      + '.pl-such input{flex:1;background:var(--surface-2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:5px 9px;font:inherit}'
      + '.pl-zaehl{color:var(--faint);font-size:11px;flex:none}'
      + '.pl-tab{overflow:auto;min-height:0;flex:1}'
      + '.pl-tab table{width:100%;border-collapse:collapse;table-layout:fixed}'
      + '.pl-tab th{position:sticky;top:0;background:var(--surface);text-align:left;font-weight:600;color:var(--faint);font-size:10px;letter-spacing:.04em;text-transform:uppercase;padding:5px 9px;border-bottom:1px solid var(--line-soft);white-space:nowrap;overflow:hidden}'
      + '.pl-tab td{padding:4px 9px;border-bottom:1px solid var(--line-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:0}'
      + '.pl-tab tr.pl-bearb{background:var(--surface-2)}'
      + '.pl-tab tr:hover{background:color-mix(in oklab,var(--accent) 6%,transparent)}'
      + '.pl-tab input,.pl-tab select{width:100%;background:var(--tile);border:1px solid var(--accent-2);color:var(--text);border-radius:6px;padding:2px 6px;font:inherit;font-size:12px}'
      + '.pl-akt{text-align:center;padding-right:6px}'
      + '.pl-akt button{background:none;border:0;color:var(--faint);cursor:pointer;font-size:14px}'
      + '.pl-akt button:hover{color:var(--accent)}'
      + '.pl-leer{color:var(--faint);text-align:center;padding:12px}'
      + '.pl-dim{color:var(--faint)}'
      + '.pl-sw{width:32px;height:18px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);position:relative;cursor:pointer;padding:0}'
      + '.pl-sw i{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--faint);transition:.15s}'
      + '.pl-sw.on{background:color-mix(in oklab,var(--accent) 26%,transparent);border-color:var(--accent)}'
      + '.pl-sw.on i{left:16px;background:var(--accent)}'
      + '.pl-warn{flex:none;border-top:1px solid var(--warn);color:var(--warn);font-size:11px;padding:5px 9px}';
  })();
