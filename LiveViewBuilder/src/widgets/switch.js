  // ===== Widget: Schalter (Switch) =====
  defWidget('switch',{
    label:'Schalter', paletteIcon:'power', size:[180,52],
    render:function(w){return '<div class="wsw"><span class="l">'+(w.icon?'<span class="swic">'+iconSVG(w.icon)+'</span>':'')+esc(w.label||'Schalter')+'</span><span class="sw" data-role="sw"></span></div>';}
  });
