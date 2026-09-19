  // ===== Widget: srprobe — Probelauf des Serienrecorders =====
  //
  //  Eine Sendung eingeben und Schritt fuer Schritt sehen, welche Zeile welcher
  //  Tabelle greift - und am Ende, ob aufgenommen wird und unter welchem Pfad.
  //
  //  Der Unterschied zum Konfigurationsformular: dort sieht man Zeilen, hier ihre
  //  WIRKUNG. Die vier Schritte sind keine Nachbildung, sondern die Prueffunktionen
  //  des Moduls (SR_KanalProbe, SR_TitelProbe, SR_RegelProbe) ueber ?api=srcfg.
  //
  //  Sie rechnen im Modul gegen den GESPEICHERTEN Stand. Die Kachel sagt das,
  //  sobald im Tabellenpuffer etwas offen ist - die Logik hier gegen den Puffer
  //  nachzurechnen hiesse, die Regeln des Moduls ein zweites Mal zu schreiben, und
  //  genau solche Doppelungen laufen auseinander.
  (function () {
    var _spZ = {};
    function _spS(w) { if (!_spZ[w.id]) { _spZ[w.id] = {}; } return _spZ[w.id]; }
    function _spEl(w) { return document.querySelector('.w.t-srprobe[data-id="' + w.id + '"]'); }
    function _spU(w, x) { return '?api=srcfg' + (w.spInst > 0 ? '&inst=' + w.spInst : '') + x; }

    function _spMal(w) {
      var el = _spEl(w); if (!el) { return; }
      var host = el.querySelector('[data-role=sphost]'); if (!host) { return; }
      var z = _spS(w), offen = (typeof tabCount === 'function') ? tabCount() : 0;
      var h = '<div class="sp-kopf"><b>' + esc(w.label || 'Probelauf') + '</b>'
        + '<span class="sp-hint">gegen den gespeicherten Stand</span></div>'
        + '<div class="sp-form">'
        + '<input data-sp="Sender" placeholder="Sender, z. B. ORF 1" value="' + esc(z.Sender || '') + '">'
        + '<input data-sp="Titel" placeholder="Sendungstitel" value="' + esc(z.Titel || '') + '">'
        + '<div class="sp-row"><input data-sp="Staffel" placeholder="Staffel" value="' + esc(z.Staffel || '') + '">'
        + '<input data-sp="Folge" placeholder="Folge" value="' + esc(z.Folge || '') + '"></div>'
        + '<button class="sp-btn" data-sprun>' + (z.laeuft ? 'läuft …' : 'Durchspielen') + '</button></div>';
      if (offen) { h += '<div class="sp-warn">' + offen + ' Tabelle' + (offen === 1 ? '' : 'n') + ' geändert und noch nicht gespeichert — die Proben laufen im Modul und kennen das noch nicht.</div>'; }
      if (!z.spur && !z.laeuft) {
        h += '<div class="sp-erkl">Die Spur zeigt je Schritt, welche Zeile welcher Tabelle greift. '
          + 'Der Titel darf der volle EPG-Titel sein; alles vor dem Gedankenstrich gilt als Serie.</div>';
      }
      if (z.spur) {
        h += '<div class="sp-spur">';
        z.spur.forEach(function (s, i) {
          h += '<div class="sp-schritt"><span class="sp-nr">' + (i + 1) + '</span><div>'
            + '<div class="sp-lab">' + esc(s.titel) + '</div><div>' + s.text + '</div>'
            + (s.quelle ? '<div class="sp-q">' + esc(s.quelle) + '</div>' : '') + '</div></div>';
        });
        h += '</div>';
        if (z.urteil) { h += '<div class="sp-urteil' + (z.urteil.ok ? '' : ' nein') + '"><b>' + esc(z.urteil.kopf) + '</b>'
          + (z.urteil.text ? '<div class="sp-mono">' + esc(z.urteil.text) + '</div>' : '') + '</div>'; }
      }
      host.innerHTML = h;
    }

    function _spLauf(w) {
      var z = _spS(w); if (z.laeuft) { return; }
      z.laeuft = true; z.spur = null; z.urteil = null; _spMal(w);
      var sender = z.Sender || '', titel = z.Titel || '';
      var staffel = parseInt(z.Staffel, 10) || 0, folge = parseInt(z.Folge, 10) || 0;
      var serie = titel.split(' — ')[0].split(' - ')[0].trim() || titel;
      function hol(q) { return fetch(_spU(w, '&op=probe&' + q), {cache: 'no-store'}).then(function (r) { return r.json(); }).catch(function () { return null; }); }
      Promise.all([
        hol('art=kanal&a=' + encodeURIComponent(sender)),
        hol('art=titel&a=' + encodeURIComponent(serie)),
        hol('art=regel&a=' + encodeURIComponent(serie) + '&c=' + staffel + '&d=' + folge),
        fetch(_spU(w, '&op=get'), {cache: 'no-store'}).then(function (r) { return r.json(); }).catch(function () { return null; })
      ]).then(function (a) {
        var k = (a[0] && a[0].ergebnis) || {}, t = (a[1] && a[1].ergebnis) || {}, g = (a[2] && a[2].ergebnis) || {};
        var liste = (a[3] && a[3].tabellen && a[3].tabellen.Serienliste) || [];
        var name = t.favorit || serie, s = [];
        s.push({titel: 'KANAL', quelle: (k.regel === 'tabelle') ? 'Ausnahme aus der Kanaltabelle' : 'Name stimmt überein',
          text: k.kanal ? ('<span class="sp-mono">' + esc(sender) + '</span> → <span class="sp-mono sp-gut">' + esc(k.kanal) + '</span>')
                        : '<span class="sp-schlecht">kein Empfangskanal</span>'});
        s.push({titel: 'TITEL UND ABLAGE', quelle: t.regel ? ('Titeltabelle: ' + t.regel) : '',
          text: 'Favorit <span class="sp-mono">' + esc(name) + '</span><br>Ablage <span class="sp-mono">' + esc(t.ablage || name) + '</span>'});
        var tr = null;
        liste.forEach(function (r) { if (String(r.serie) === name) { tr = r; } });
        s.push({titel: 'AUFNEHMEN?', quelle: tr ? ('Serienliste, Herkunft ' + tr.quelle) : 'Serienliste',
          text: tr ? (tr.aktiv ? '<span class="sp-gut">steht auf der Liste und ist aktiv</span>' : '<span class="sp-schlecht">steht auf der Liste, aber auf aus</span>')
                   : '<span class="sp-schlecht">steht nicht auf der Aufnahmeliste</span>'});
        s.push({titel: 'SCHRANKE', quelle: 'Bedingungen',
          text: (g.erlaubt === false) ? ('<span class="sp-schlecht">' + esc(g.grund || 'verworfen') + '</span>')
                                      : '<span class="sp-gut">keine Schranke verwehrt diese Folge</span>'});
        var darf = !!tr && tr.aktiv && g.erlaubt !== false && !!k.kanal;
        z.spur = s;
        z.urteil = {ok: darf, kopf: darf ? 'Wird aufgenommen' : 'Wird nicht aufgenommen',
          text: darf ? ((k.kanal || '?') + ' → …/' + (t.ablage || name) + '/Season ' + (staffel || 0)) : ''};
        z.laeuft = false; _spMal(w);
      });
    }

    defWidget('srprobe', {
      label: 'Serienrecorder · Probelauf',
      cat: 'Einstellungen',
      paletteIcon: 'tv',
      size: [374, 470],
      noHover: true,
      render: function (w) { return '<style>' + SPCSS + '</style><div class="sp-wrap" data-role="sphost"></div>'; },
      props: function (w) {
        if (w.type !== 'srprobe') { return ''; }
        return '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Leer lassen, solange es genau einen Serienrecorder gibt.</div>'
          + row('Instanz (optional)', '<input id="pSpInst" type="number" value="' + (w.spInst || '') + '" placeholder="automatisch">');
      },
      wire: function (w) { if ($('#pSpInst')) { $('#pSpInst').oninput = function () { w.spInst = parseInt(this.value) || undefined; render(); commit(); }; } },
      mount: function (w) {
        var el = _spEl(w); if (!el) { return; }
        if (!el._sp) {
          el._sp = 1;
          el.addEventListener('input', function (e) {
            var f = e.target.closest('[data-sp]'); if (f) { _spS(w)[f.getAttribute('data-sp')] = f.value; }
          });
        }
        _spMal(w);
      },
      click: function (w, el, e) {
        if (e.target.closest('[data-sprun]')) { _spLauf(w); return true; }
        return false;
      }
    });

    var SPCSS = ''
      + '.sp-wrap{position:absolute;inset:0;display:flex;flex-direction:column;font-size:12px;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden}'
      + '.sp-kopf{display:flex;align-items:center;gap:7px;padding:5px 10px;border-bottom:1px solid var(--line-soft);flex:none}'
      + '.sp-kopf b{font-size:13px}.sp-hint{color:var(--faint);font-size:11px}'
      + '.sp-form{padding:9px;display:flex;flex-direction:column;gap:6px;flex:none}'
      + '.sp-form input{background:var(--surface-2);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:6px 9px;font:inherit;width:100%}'
      + '.sp-row{display:flex;gap:6px}'
      + '.sp-btn{width:100%;padding:8px;background:var(--surface-2);border:1px solid var(--accent-2);color:var(--accent);border-radius:8px;cursor:pointer;font:inherit}'
      + '.sp-warn{margin:0 9px 8px;border:1px solid var(--warn);border-radius:8px;padding:6px 9px;color:var(--warn);font-size:11px}'
      + '.sp-erkl{padding:2px 11px 10px;color:var(--faint);font-size:11px;line-height:1.5}'
      + '.sp-spur{padding:0 9px 9px;overflow:auto;min-height:0}'
      + '.sp-schritt{display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line-soft)}'
      + '.sp-nr{width:17px;height:17px;border-radius:50%;border:1px solid var(--accent-2);color:var(--accent);font-size:10px;display:flex;align-items:center;justify-content:center;flex:none;margin-top:1px}'
      + '.sp-lab{color:var(--faint);font-size:10px;letter-spacing:.06em;text-transform:uppercase}'
      + '.sp-q{color:var(--faint);font-size:11px;margin-top:1px}'
      + '.sp-mono{font-family:var(--fm,ui-monospace,monospace)}'
      + '.sp-gut{color:var(--ok)}.sp-schlecht{color:var(--crit)}'
      + '.sp-urteil{margin:0 9px 9px;border:1px solid var(--accent);border-radius:9px;padding:8px 10px;color:var(--accent);flex:none}'
      + '.sp-urteil.nein{border-color:var(--crit);color:var(--crit)}'
      + '.sp-urteil .sp-mono{color:var(--muted);font-size:11px;margin-top:3px;word-break:break-all}';
  })();
