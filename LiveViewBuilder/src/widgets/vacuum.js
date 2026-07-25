  // ===== Widget: Vacuum — Saug-/Mähroboter mit Status, Batterie und Start/Stop =====
  defWidget('vacuum',{
    label:'Vacuum', paletteIcon:'mower', size:[210,112],
    render:function(w){return '<div class="hvac"><div class="hvrow"><span class="hvicon">'+iconSVG('mower')+'</span><span class="hvst" data-role="val">–</span><span class="hvbat" data-role="sub">–</span></div><div class="hvbtn"><button data-role="vstart">Start</button><button data-role="vstop">Stop</button></div></div>';},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){var vs=$('[data-role=val]',el);if(vs)vs.textContent=txt;}if(w.varId2===id){var vb=$('[data-role=sub]',el);if(vb)vb.textContent=txt;}}
  });
