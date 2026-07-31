  // ===== Widget: Timer — Countdown mit Fortschrittsbalken =====
  defWidget('timer',{
    label:'Timer', paletteIcon:'clock', size:[200,68],
    render:function(w){return '<div class="htimer"><div class="htrow"><span class="htname">'+escL(w.label||'')+'</span><span class="httime" data-role="time">–</span></div><div class="htbar"><i data-role="bar"></i></div></div>';}
  });
