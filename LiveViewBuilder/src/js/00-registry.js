  // ===== Widget-Registry — jedes Widget lebt in src/widgets/<typ>.js und registriert sich via defWidget =====
  var WIDGETS={};
  var TYPES={};   // Typ -> Anzeigename (für die Typ-Auswahl in den Eigenschaften); wird je defWidget aus def.label befüllt
  function defWidget(type,def){def=def||{};WIDGETS[type]=def;
    if(def.label&&typeof TYPES!=='undefined')TYPES[type]=def.label;
    if(def.paletteIcon&&typeof PAL_ICON!=='undefined')PAL_ICON[type]=def.paletteIcon;
  }
