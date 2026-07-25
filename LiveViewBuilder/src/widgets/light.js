  // ===== Widget: Licht (Light) — Badge mit Ein/Aus, Name, Status und Helligkeits-Slider =====
  defWidget('light',{
    label:'Licht', paletteIcon:'bulb', size:[210,98],
    render:function(w){return '<div class="hlight"><div class="hlrow"><div class="hlbadge" data-role="badge">'+iconSVG(w.icon||'bulb')+'</div><div class="hltext"><div class="hlname">'+esc(w.label||'')+'</div><div class="hlstate" data-role="val">–</div></div></div><input class="hsrange" type="range" data-role="range" min="0" max="100" step="1" value="0"></div>';},
    live:function(w,el,id,d,base,txt,on){
      if(w.varId===id){var lb=$('[data-role=badge]',el);if(lb)lb.classList.toggle('on',on);var lst=$('.hlstate',el);if(lst)lst.textContent=txt;}
      if(w.varId2===id){var lr=$('[data-role=range]',el);if(lr&&document.activeElement!==lr)lr.value=parseFloat(d.v);}
    }
  });
