  // ===== Widget: Cover — Rollo/Jalousie mit Auf/Stop/Zu und Positions-Slider =====
  defWidget('cover',{
    label:'Rollo', paletteIcon:'blinds', size:[200,112],
    render:function(w){return '<div class="hcov"><div class="hcrow"><span class="hcname">'+esc(w.label||'')+'</span><span class="hcval" data-role="val">–</span></div><div class="hcbtns"><button data-role="cup" title="Auf"><svg><use href="#ic-chevup"/></svg></button><button data-role="cstop" title="Stop"><svg><use href="#ic-stop"/></svg></button><button data-role="cdn" title="Zu"><svg><use href="#ic-chevdn"/></svg></button></div><input class="hsrange" type="range" data-role="range" min="0" max="100" step="1" value="0"></div>';},
    live:function(w,el,id,d,base,txt,on){var cr=$('[data-role=range]',el);if(cr&&document.activeElement!==cr)cr.value=parseFloat(d.v);var cv=$('[data-role=val]',el);if(cv)cv.textContent=txt;}
  });
