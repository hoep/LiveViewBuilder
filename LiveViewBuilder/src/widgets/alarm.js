  // ===== Widget: Alarm =====
  defWidget('alarm',{
    label:'Alarm', paletteIcon:'shield', size:[200,112],
    render:function(w){return '<div class="halarm"><div class="hastate" data-role="val">–</div><div class="habtns"><button data-role="aon">Scharf</button><button data-role="aoff">Unscharf</button></div></div>';},
    live:function(w,el,id,d,base,txt,on){var as=$('[data-role=val]',el);if(as){as.textContent=txt;as.style.color=on?'var(--crit)':'var(--ok)';}return;}
  });
