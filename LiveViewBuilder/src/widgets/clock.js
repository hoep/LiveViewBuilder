  // ===== Widget: Uhr (clock) — Digital-Uhr mit Datum =====
  defWidget('clock',{
    label:'Uhr', paletteIcon:'clock', size:[170,84],
    render:function(w){return '<div class="hclock"><div class="hctime" data-role="time">–</div><div class="hcdate" data-role="date"></div></div>';}
  });
