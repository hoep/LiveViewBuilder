  // ===== Widget: Icon =====
  defWidget('icon',{
    label:'Icon', paletteIcon:'star', size:[80,80],
    render:function(w){return '<div class="iconwrap">'+iconSVG(w.icon||'bulb')+'</div>';}
  });
