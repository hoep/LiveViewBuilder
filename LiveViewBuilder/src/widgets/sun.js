  // Widget: sun (Sonne) — Auf-/Untergang
  defWidget('sun',{
    label:'Sonne',
    paletteIcon:'sun',
    size:[210,88],
    render:function(w){return '<div class="hsun"><div class="hsunrow"><div class="hscol"><svg class="hsic" viewBox="0 0 24 24">'+ICONS.sunrise[1]+'</svg><div class="hstime" data-role="val">–</div><div class="hslbl">Aufgang</div></div><div class="hscol"><svg class="hsic" viewBox="0 0 24 24">'+ICONS.sunset[1]+'</svg><div class="hstime" data-role="val2">–</div><div class="hslbl">Untergang</div></div></div></div>';},
    live:function(w,el,id,d,base,txt,on){
      if(w.varId===id){var s1=$('[data-role=val]',el);if(s1)s1.textContent=txt;}
      if(w.varId2===id){var s2=$('[data-role=val2]',el);if(s2)s2.textContent=txt;}
    }
  });
