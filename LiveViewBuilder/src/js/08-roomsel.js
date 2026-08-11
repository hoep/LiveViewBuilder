  // ===== Gemeinsamer Raum-Selektor (Heizung/Beschattung/Bewässerung/Audio) =====
  // Einheitliche Optik (3 Stile) + je Widget Reihenfolge + einzelne Räume aus-/einblenden
  // + optionaler Haus/Wohnung-Filter. Wird von der Heiz- (hpRoomsBar) und Audio-Familie
  // (afRoomBar) genutzt. Funktionen sind im gemeinsamen Bundle-Scope (hoisted).

  var HS_SEL_STYLES = [['buttons', 'Buttons'], ['pills', 'Pills'], ['underline', 'Underline (Tabs)']];

  function hsSelStyle(w) {
    var s = (w && w.selStyle) || 'buttons';
    return (s === 'pills' || s === 'underline') ? s : 'buttons';
  }
  function hsSelClass(w) { return 'hssel hssel-' + hsSelStyle(w); }

  // Entfernt den Gewerke-Suffix "(Licht)"/"(Audio)"/… aus dem Raum-/Zonennamen für die Anzeige.
  function hsStripDomain(name) {
    return String(name || '').replace(/\s*\((Licht|Heizung|Beschattung|Bew(ä|ae)sserung|Audio|Pool)\)\s*$/i, '').trim();
  }

  // Wendet Ausblenden (w.roomHidden) + Reihenfolge (w.roomOrder) auf eine Raumliste an.
  // rooms: [{idx,...}]. Nicht in order gelistete bleiben in Ursprungsreihenfolge hinten.
  function hsOrderHide(w, rooms) {
    if (!rooms || !rooms.length) return rooms || [];
    var hidden = {}; ((w && w.roomHidden) || []).forEach(function (i) { hidden[String(i)] = 1; });
    var out = rooms.filter(function (r) { return !hidden[String(r.idx)]; });
    var order = (w && w.roomOrder) || [];
    if (order.length) {
      var pos = {}; order.forEach(function (idx, i) { pos[String(idx)] = i; });
      out = out.slice().sort(function (a, b) {
        var pa = (pos[String(a.idx)] != null) ? pos[String(a.idx)] : 9999;
        var pb = (pos[String(b.idx)] != null) ? pos[String(b.idx)] : 9999;
        return pa - pb;
      });
    }
    return out;
  }

  // --- Props: Stil-Dropdown ---
  function hsStyleRow(w) {
    var cur = hsSelStyle(w);
    return row('Stil', '<select id="hsSelStyle">' + HS_SEL_STYLES.map(function (o) {
      return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>');
  }
  function hsStyleWire(w, rerender) {
    var e = $('#hsSelStyle'); if (!e) return;
    e.onchange = function () { w.selStyle = this.value; commit(); if (rerender) rerender(); };
  }

  // --- Props: Reihenfolge + Ein-/Ausblenden ---
  // allRooms: [{idx,name}] (aktuell verfügbare Räume der Domäne). Zeigt sie in der
  // konfigurierten Reihenfolge; ▲▼ ordnen, Häkchen = sichtbar.
  function hsRoomOrderEditor(w, allRooms) {
    if (!allRooms || !allRooms.length) return '<div class="pgh">Räume</div><div style="font-size:12px;color:var(--muted);padding:4px 2px">Räume laden … (Domäne/Quelle prüfen)</div>';
    var ordered = hsOrderList(w, allRooms);
    var hidden = {}; ((w.roomHidden) || []).forEach(function (i) { hidden[String(i)] = 1; });
    var h = '<div class="pgh">Räume · Reihenfolge &amp; Anzeige</div>';
    h += '<div class="hsroed">' + ordered.map(function (r, i) {
      var vis = !hidden[String(r.idx)];
      return '<div class="hsroed-row" data-hsr="' + r.idx + '">'
        + '<button class="btn" data-hsrup="' + r.idx + '" title="hoch" style="padding:2px' + (i === 0 ? ';opacity:.3;pointer-events:none' : '') + '"><svg class="i"><use href="#ic-chevup"/></svg></button>'
        + '<button class="btn" data-hsrdn="' + r.idx + '" title="runter" style="padding:2px' + (i === ordered.length - 1 ? ';opacity:.3;pointer-events:none' : '') + '"><svg class="i"><use href="#ic-chevdn"/></svg></button>'
        + '<label style="flex:1;display:flex;align-items:center;gap:6px;font-size:12px;min-width:0"><input type="checkbox" data-hsrvis="' + r.idx + '"' + (vis ? ' checked' : '') + '><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap' + (vis ? '' : ';opacity:.45') + '">' + esc(hsStripDomain(r.name) || ('#' + r.idx)) + '</span></label>'
        + '</div>';
    }).join('') + '</div>';
    h += '<div style="font-size:11px;color:var(--muted);margin:3px 2px">▲▼ = Reihenfolge · Häkchen aus = Raum im Frontend ausgeblendet.</div>';
    return h;
  }
  // Volle geordnete Liste (inkl. ausgeblendete, für den Editor): erst w.roomOrder, Rest hinten.
  function hsOrderList(w, allRooms) {
    var order = (w.roomOrder) || [], pos = {}; order.forEach(function (idx, i) { pos[String(idx)] = i; });
    return allRooms.slice().sort(function (a, b) {
      var pa = (pos[String(a.idx)] != null) ? pos[String(a.idx)] : 9999;
      var pb = (pos[String(b.idx)] != null) ? pos[String(b.idx)] : 9999;
      return pa - pb;
    });
  }
  function hsRoomOrderWire(w, allRooms, rerender) {
    function saveOrder(list) { w.roomOrder = list.map(function (r) { return r.idx; }); commit(); if (rerender) rerender(); if (typeof renderProps === 'function') renderProps(); }
    $$('[data-hsrup]').forEach(function (b) { b.onclick = function () {
      var idx = +b.getAttribute('data-hsrup'); var l = hsOrderList(w, allRooms);
      var i = l.findIndex(function (r) { return r.idx == idx; }); if (i > 0) { var t = l[i - 1]; l[i - 1] = l[i]; l[i] = t; saveOrder(l); }
    }; });
    $$('[data-hsrdn]').forEach(function (b) { b.onclick = function () {
      var idx = +b.getAttribute('data-hsrdn'); var l = hsOrderList(w, allRooms);
      var i = l.findIndex(function (r) { return r.idx == idx; }); if (i >= 0 && i < l.length - 1) { var t = l[i + 1]; l[i + 1] = l[i]; l[i] = t; saveOrder(l); }
    }; });
    $$('[data-hsrvis]').forEach(function (c) { c.onchange = function () {
      var idx = +c.getAttribute('data-hsrvis'); var hid = (w.roomHidden || []).filter(function (x) { return x != idx; });
      if (!c.checked) hid.push(idx); w.roomHidden = hid.length ? hid : undefined; commit(); if (rerender) rerender(); if (typeof renderProps === 'function') renderProps();
    }; });
  }

  // --- Props: Haus/Wohnung-Auswahl (Filter auf eine Haus-Instanz der Topologie) ---
  // houses: [{iid,name}] aus der Topologie. Leer = alle Häuser.
  function hsHouseRow(w, houses) {
    if (!houses || !houses.length) return ''; // keine Topologie geladen
    var cur = (w.houseId) || 0;
    return row('Haus/Wohnung', '<select id="hsHouse"><option value="0"' + (!cur ? ' selected' : '') + '>Alle</option>'
      + houses.map(function (hh) { return '<option value="' + hh.iid + '"' + (cur == hh.iid ? ' selected' : '') + '>' + esc(hh.name) + '</option>'; }).join('') + '</select>')
      + '<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Bindet dieses Widget an eine Haus/Wohnung-Instanz (Multi-Haus, z. B. Duna Verde). „Alle" = kein Filter.</div>';
  }
  function hsHouseWire(w, rerender) {
    var e = $('#hsHouse'); if (!e) return;
    e.onchange = function () { w.houseId = parseInt(this.value) || undefined; commit(); if (rerender) rerender(); };
  }
