// Widget: chip (Chip)
defWidget('chip',{
  label:'Chip',
  paletteIcon:'star',
  size:[130,36],
  render:function(w){return '<div class="hchip"><span class="hchipic">'+iconSVG(w.icon||'sensor')+'</span><span data-role="val">–</span></div>';},
  live:function(w,el,id,d,base,txt,on){var chv=$('[data-role=val]',el);if(chv)chv.textContent=txt;}
});
