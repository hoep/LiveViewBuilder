  // ===== Widget: Raum (Room) — Metrik-Kachel mit Icon, Name und bis zu 3 Werten =====
  defWidget('room',{
    label:'Raum', paletteIcon:'home', size:[200,110],
    render:function(w){return '<div class="hroom"><div class="hrhead"><div class="hricon">'+iconSVG(w.icon||'home')+'</div><div class="hrname">'+esc(w.label||'')+'</div></div><div class="hrmetrics"><span><b data-role="val">–</b></span>'+(w.varId2?'<span><b data-role="sub">–</b></span>':'')+(w.varId3?'<span><b data-role="sub2">–</b></span>':'')+'</div></div>';},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){var rv=$('[data-role=val]',el);if(rv)rv.textContent=txt;}if(w.varId2===id){var r2=$('[data-role=sub]',el);if(r2)r2.textContent=txt;}if(w.varId3===id){var r3=$('[data-role=sub2]',el);if(r3)r3.textContent=txt;}}
  });
