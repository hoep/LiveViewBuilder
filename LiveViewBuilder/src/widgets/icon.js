  // ===== Widget: Icon =====
  defWidget('icon',{
    label:'Icon', cat:'Grundelemente', paletteIcon:'star', size:[80,80],
    render:function(w){return '<div class="iconwrap">'+iconSVG(w.icon||'bulb')+'</div>';}
  });
