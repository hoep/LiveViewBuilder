// Widget: blank (Leer)
defWidget('blank',{
  label:'Leer',
  paletteIcon:'wblank',
  size:[180,110],
  render:function(w){return '<div class="hblank"><span class="hbplus">'+iconSVG('wblank')+'</span><span class="hbtxt">'+esc(w.label&&w.label!=='Label'?w.label:'Leer — Typ &amp; Variable im Panel wählen')+'</span></div>';}
});
