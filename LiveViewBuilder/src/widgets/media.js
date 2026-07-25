// Widget: media (Media)
defWidget('media',{
  label:'Media',
  paletteIcon:'music',
  size:[240,112],
  render:function(w){return '<div class="hmedia"><div class="hmtitle" data-role="val">–</div><div class="hmctl"><button data-role="mplay"><svg><use href="#ic-play"/></svg></button><input class="hsrange hmvol" type="range" data-role="range" min="0" max="100" step="1" value="0"></div></div>';},
  live:function(w,el,id,d,base,txt,on){if(w.varId===id){var mt=$('.hmtitle',el);if(mt)mt.textContent=txt;}if(w.varId2===id){var mu=$('[data-role=mplay] use',el);if(mu)mu.setAttribute('href',on?'#ic-pause':'#ic-play');}if(w.varId3===id){var mv=$('[data-role=range]',el);if(mv&&document.activeElement!==mv)mv.value=parseFloat(d.v);}return;}
});
