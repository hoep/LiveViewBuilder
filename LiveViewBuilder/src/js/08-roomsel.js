  // ===== Gemeinsamer Raum-Selektor (Heizung/Beschattung/Bewässerung/Audio) =====
  // Einheitliche Optik (3 Stile) + je Widget Reihenfolge + einzelne Räume aus-/einblenden
  // + optionaler Haus/Wohnung-Filter. Wird von der Heiz- (hpRoomsBar) und Audio-Familie
  // (afRoomBar) genutzt. Funktionen sind im gemeinsamen Bundle-Scope (hoisted).

  var HS_SEL_STYLES = [['buttons', 'Buttons'], ['pills', 'Pills'], ['underline', 'Underline (Tabs)']];

  // ================= Ebenen-Konfiguration (Geschosse + Raeume getrennt) =================
  // Beide Ebenen koennen unabhaengig gestaltet werden: eigener Stil, eigene Typografie
  // (Groesse/Staerke/Schriftart/Farbe/Schreibweise), eigene Reihenfolge, eigenes
  // Ein-/Ausblenden und ein eigener Beschriftungstext je Eintrag.
  //   Ebene 'f' = Geschosse -> w.floorStyle/floorOrder/floorHidden/floorLabels/floorFont
  //   Ebene 'r' = Raeume    -> w.selStyle /roomOrder /roomHidden /roomLabels /roomFont
  // (die Raum-Schluessel heissen aus Kompatibilitaetsgruenden weiter selStyle/roomOrder.)
  var HS_LEVELS   = [['both', 'Geschosse + Räume'], ['floors', 'Nur Geschosse'], ['rooms', 'Nur Räume']];
  var HS_F_STYLES = [['tabs', 'Tabs'], ['buttons', 'Buttons'], ['pills', 'Pills'], ['underline', 'Underline']];
  var HS_FONTS    = [['', 'Standard (Skin)'], ['"Inter",system-ui,sans-serif', 'Inter (Sans)'],
                     ['"Lora",Georgia,serif', 'Lora (Serif)'], ['"Fraunces",Georgia,serif', 'Fraunces (Display)'],
                     ['"JetBrains Mono",ui-monospace,monospace', 'JetBrains Mono'],
                     ['system-ui,-apple-system,sans-serif', 'System-Sans'], ['Georgia,"Times New Roman",serif', 'System-Serif']];
  var HS_WEIGHTS  = [['', 'Standard'], ['400', 'Normal'], ['600', 'Halbfett'], ['700', 'Fett'], ['800', 'Extrafett']];
  var HS_CASES    = [['', 'Normal'], ['upper', 'VERSALIEN'], ['lower', 'kleinbuchstaben'], ['cap', 'Erster Buchstabe groß']];

  function hsLvlKeys(lvl) {
    return (lvl === 'f')
      ? { style: 'floorStyle', order: 'floorOrder', hidden: 'floorHidden', labels: 'floorLabels', font: 'floorFont' }
      : { style: 'selStyle',   order: 'roomOrder',  hidden: 'roomHidden',  labels: 'roomLabels',  font: 'roomFont'  };
  }
  /** Welche Ebenen zeigt dieses Widget? 'both' | 'floors' | 'rooms'. */
  function hsLevels(w) {
    var v = w && w.selLevels;
    if (v === 'floors' || v === 'rooms' || v === 'both') return v;
    return (w && w.floorTabs) ? 'both' : 'rooms';   // Altbestand: floorTabs entschied das bisher
  }
  /** Eigener Beschriftungstext eines Eintrags (leer = Originalname). */
  function hsLabel(w, lvl, key, fallback) {
    var m = (w && w[hsLvlKeys(lvl).labels]) || {};
    var t = m[String(key)];
    return (t != null && String(t).trim() !== '') ? String(t) : fallback;
  }
  /** Typografie einer Ebene als Inline-Style (auf den Container; wirkt ueber CSS-Variablen). */
  function hsFontStyle(w, lvl) {
    var f = (w && w[hsLvlKeys(lvl).font]) || {}, s = [];
    if (f.size)   s.push('--hssz:' + parseFloat(f.size) + 'px');
    if (f.weight) s.push('--hswt:' + f.weight);
    if (f.ff)     s.push('--hsff:' + f.ff);
    if (f.color)  s.push('--hsfg:' + f.color);
    if (f.acc)    s.push('--hsacc:' + f.acc);
    if (f.tcase === 'upper')      s.push('--hstt:uppercase;--hsls:.07em');
    else if (f.tcase === 'lower') s.push('--hstt:lowercase');
    else if (f.tcase === 'cap')   s.push('--hstt:capitalize');
    // esc(): Schriftart-Werte enthalten Anfuehrungszeichen ("Lora",Georgia,serif) und
    // wuerden das style="…"-Attribut sonst zerreissen.
    return s.length ? (' style="' + esc(s.join(';')) + '"') : '';
  }
  /** Stil-Klasse einer Ebene (Geschosse kennen zusaetzlich 'tabs'). */
  function hsLvlClass(w, lvl) {
    var k = hsLvlKeys(lvl), v = (w && w[k.style]) || (lvl === 'f' ? 'tabs' : 'buttons');
    if (lvl === 'f' && v === 'tabs') return 'hp-ftabs';
    if (v !== 'pills' && v !== 'underline' && v !== 'buttons') v = (lvl === 'f' ? 'buttons' : 'buttons');
    return 'hssel hssel-' + v;
  }
  /** Button-Klasse passend zur Stil-Klasse der Ebene. */
  function hsLvlBtn(w, lvl) {
    var k = hsLvlKeys(lvl), v = (w && w[k.style]) || (lvl === 'f' ? 'tabs' : 'buttons');
    return (lvl === 'f' && v === 'tabs') ? 'hp-ftab' : 'hsroom';
  }
  /** Reihenfolge + Ausblenden generisch (Schluessel = Raum-Index bzw. Geschoss-Name). */
  function hsOrderHideBy(w, lvl, list, keyOf) {
    if (!list || !list.length) return list || [];
    var k = hsLvlKeys(lvl);
    var hidden = {}; ((w && w[k.hidden]) || []).forEach(function (i) { hidden[String(i)] = 1; });
    var out = list.filter(function (r) { return !hidden[String(keyOf(r))]; });
    var order = (w && w[k.order]) || [];
    if (order.length) {
      var pos = {}; order.forEach(function (x, i) { pos[String(x)] = i; });
      out = out.slice().sort(function (a, b) {
        var pa = (pos[String(keyOf(a))] != null) ? pos[String(keyOf(a))] : 9999;
        var pb = (pos[String(keyOf(b))] != null) ? pos[String(keyOf(b))] : 9999;
        return pa - pb;
      });
    }
    return out;
  }

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

  // ---- Props: ein kompletter Ebenen-Block (Reihenfolge/Anzeige/Text + Stil + Typografie) ----
  // items: [{key,name}] — key = Raum-Index bzw. Geschoss-Name.
  function hsLevelBlock(w, lvl, title, items) {
    var k = hsLvlKeys(lvl), pre = (lvl === 'f' ? 'hsf' : 'hsr');
    var h = '<div class="pgh">' + esc(title) + '</div>';
    if (!items || !items.length) {
      h += '<div style="font-size:12px;color:var(--muted);padding:4px 2px">lädt … (Domäne/Quelle prüfen)</div>';
    } else {
      var ordered = hsOrderHideAll(w, lvl, items), hidden = {};
      ((w[k.hidden]) || []).forEach(function (i) { hidden[String(i)] = 1; });
      h += '<div class="hsroed">' + ordered.map(function (r, i) {
        var vis = !hidden[String(r.key)];
        return '<div class="hsroed-row">'
          + '<button class="btn" data-' + pre + 'up="' + esc(r.key) + '" title="hoch" style="padding:2px' + (i === 0 ? ';opacity:.3;pointer-events:none' : '') + '"><svg class="i"><use href="#ic-chevup"/></svg></button>'
          + '<button class="btn" data-' + pre + 'dn="' + esc(r.key) + '" title="runter" style="padding:2px' + (i === ordered.length - 1 ? ';opacity:.3;pointer-events:none' : '') + '"><svg class="i"><use href="#ic-chevdn"/></svg></button>'
          + '<label style="display:flex;align-items:center;gap:5px;min-width:0;flex:1"><input type="checkbox" data-' + pre + 'vis="' + esc(r.key) + '"' + (vis ? ' checked' : '') + '>'
          + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px' + (vis ? '' : ';opacity:.45') + '">' + esc(r.name) + '</span></label>'
          + '<input class="hsroed-lbl" data-' + pre + 'lab="' + esc(r.key) + '" value="' + esc(hsLabel(w, lvl, r.key, '')) + '" placeholder="Text" title="Eigener Beschriftungstext (leer = Originalname)">'
          + '</div>';
      }).join('') + '</div>';
      h += '<div style="font-size:11px;color:var(--muted);margin:3px 2px">▲▼ ordnet · Häkchen blendet ein/aus · Textfeld = eigene Beschriftung (leer = Originalname).</div>';
    }
    // Stil + Typografie dieser Ebene
    var styles = (lvl === 'f') ? HS_F_STYLES : HS_SEL_STYLES;
    var curSt  = (w[k.style]) || (lvl === 'f' ? 'tabs' : 'buttons');
    var f      = (w[k.font]) || {};
    h += row('Stil', '<select id="' + pre + 'St">' + styles.map(function (o) {
      return '<option value="' + o[0] + '"' + (curSt === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>');
    h += row('Schriftart', '<select id="' + pre + 'Ff">' + HS_FONTS.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + ((f.ff || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>');
    h += row('Größe / Stärke', '<input id="' + pre + 'Sz" type="number" min="8" max="40" value="' + (f.size || '') + '" placeholder="px" style="width:62px">'
      + ' <select id="' + pre + 'Wt" style="width:104px">' + HS_WEIGHTS.map(function (o) {
        return '<option value="' + o[0] + '"' + ((f.weight || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>');
    h += row('Schreibweise', '<select id="' + pre + 'Tc">' + HS_CASES.map(function (o) {
      return '<option value="' + o[0] + '"' + ((f.tcase || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>');
    h += row('Farbe / Aktiv', colorInp(pre + 'Fg', f.color || '') + ' ' + colorInp(pre + 'Ac', f.acc || ''));
    h += '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Farbe = Beschriftung, Aktiv = Hervorhebung des gewählten Eintrags. Leer = Skin-Vorgabe.</div>';
    return h;
  }
  // Volle geordnete Liste inkl. ausgeblendeter (fuer den Editor).
  function hsOrderHideAll(w, lvl, items) {
    var order = (w[hsLvlKeys(lvl).order]) || [], pos = {};
    order.forEach(function (x, i) { pos[String(x)] = i; });
    return items.slice().sort(function (a, b) {
      var pa = (pos[String(a.key)] != null) ? pos[String(a.key)] : 9999;
      var pb = (pos[String(b.key)] != null) ? pos[String(b.key)] : 9999;
      return pa - pb;
    });
  }
  function colorInp(id, val) {
    return '<input id="' + id + '" type="color" value="' + esc(val || '#888888') + '" style="width:38px;padding:1px;height:24px">'
      + '<button class="btn" data-hsclr="' + id + '" title="zurücksetzen" style="padding:2px 6px;font-size:10px">×</button>';
  }
  function hsLevelWire(w, lvl, items, rerender) {
    var k = hsLvlKeys(lvl), pre = (lvl === 'f' ? 'hsf' : 'hsr');
    function upd() { commit(); if (rerender) rerender(); if (typeof renderProps === 'function') renderProps(); }
    function move(key, dir) {
      var l = hsOrderHideAll(w, lvl, items);
      var i = l.findIndex(function (r) { return String(r.key) === String(key); });
      var j = i + dir; if (i < 0 || j < 0 || j >= l.length) return;
      var t = l[i]; l[i] = l[j]; l[j] = t;
      w[k.order] = l.map(function (r) { return r.key; }); upd();
    }
    $$('[data-' + pre + 'up]').forEach(function (b) { b.onclick = function () { move(b.getAttribute('data-' + pre + 'up'), -1); }; });
    $$('[data-' + pre + 'dn]').forEach(function (b) { b.onclick = function () { move(b.getAttribute('data-' + pre + 'dn'), 1); }; });
    $$('[data-' + pre + 'vis]').forEach(function (c) { c.onchange = function () {
      var key = c.getAttribute('data-' + pre + 'vis');
      var hid = (w[k.hidden] || []).filter(function (x) { return String(x) !== String(key); });
      if (!c.checked) hid.push(key);
      w[k.hidden] = hid.length ? hid : undefined; upd();
    }; });
    $$('[data-' + pre + 'lab]').forEach(function (t) { t.onchange = function () {
      var key = t.getAttribute('data-' + pre + 'lab'), m = Object.assign({}, w[k.labels] || {});
      if (this.value.trim() === '') delete m[key]; else m[key] = this.value;
      w[k.labels] = Object.keys(m).length ? m : undefined; commit(); if (rerender) rerender();
    }; });
    function fset(prop, val) { var f = Object.assign({}, w[k.font] || {});
      if (val === '' || val == null) delete f[prop]; else f[prop] = val;
      w[k.font] = Object.keys(f).length ? f : undefined; commit(); if (rerender) rerender(); }
    if ($('#' + pre + 'St')) $('#' + pre + 'St').onchange = function () { w[k.style] = this.value; upd(); };
    if ($('#' + pre + 'Ff')) $('#' + pre + 'Ff').onchange = function () { fset('ff', this.value); };
    if ($('#' + pre + 'Sz')) $('#' + pre + 'Sz').onchange = function () { fset('size', this.value); };
    if ($('#' + pre + 'Wt')) $('#' + pre + 'Wt').onchange = function () { fset('weight', this.value); };
    if ($('#' + pre + 'Tc')) $('#' + pre + 'Tc').onchange = function () { fset('tcase', this.value); };
    if ($('#' + pre + 'Fg')) $('#' + pre + 'Fg').oninput = function () { fset('color', this.value); };
    if ($('#' + pre + 'Ac')) $('#' + pre + 'Ac').oninput = function () { fset('acc', this.value); };
    $$('[data-hsclr]').forEach(function (b) { b.onclick = function () {
      var id = b.getAttribute('data-hsclr');
      if (id === pre + 'Fg') fset('color', ''); else if (id === pre + 'Ac') fset('acc', '');
      if (typeof renderProps === 'function') renderProps();
    }; });
  }
  // --- Props: Ebenen-Auswahl (welche Ebene(n) zeigt das Widget?) ---
  function hsLevelRow(w) {
    var cur = hsLevels(w);
    return row('Ebenen', '<select id="hsLevels">' + HS_LEVELS.map(function (o) {
      return '<option value="' + o[0] + '"' + (cur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>');
  }
  function hsLevelModeWire(w, rerender) {
    var e = $('#hsLevels'); if (!e) return;
    e.onchange = function () { w.selLevels = this.value; w.floorTabs = (this.value === 'both') ? true : undefined;
      commit(); if (rerender) rerender(); if (typeof renderProps === 'function') renderProps(); };
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
