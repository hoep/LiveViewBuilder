  // ===== Widget: Raum (Room) — Metrik-Kachel mit Icon, Name und bis zu 3 Werten =====
  defWidget('room',{
    label:'Raum', cat:'Anzeige', paletteIcon:'home', size:[200,110],
    render:function(w){return '<div class="hroom"><div class="hrhead"><div class="hricon">'+iconSVG(w.icon||'home')+'</div><div class="hrname">'+escL(w.label||'')+'</div></div><div class="hrmetrics"><span><b data-role="val">–</b>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</span>'+(w.varId2?'<span><b data-role="sub">–</b>'+(w.unit2?'<small> '+esc(w.unit2)+'</small>':'')+'</span>':'')+(w.varId3?'<span><b data-role="sub2">–</b>'+(w.unit3?'<small> '+esc(w.unit3)+'</small>':'')+'</span>':'')+'</div></div>';},
    props:function(w){return row('Einheit','<input id="pRU1" value="'+esc(w.unit||'')+'" placeholder="z. B. °C">')+(w.varId2?row('Einheit 2','<input id="pRU2" value="'+esc(w.unit2||'')+'" placeholder="Einheit">'):'')+(w.varId3?row('Einheit 3','<input id="pRU3" value="'+esc(w.unit3||'')+'" placeholder="Einheit">'):'');},
    wire:function(w){if($('#pRU1'))$('#pRU1').oninput=function(){w.unit=this.value||undefined;render();};if($('#pRU2'))$('#pRU2').oninput=function(){w.unit2=this.value||undefined;render();};if($('#pRU3'))$('#pRU3').oninput=function(){w.unit3=this.value||undefined;render();};},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){var rv=$('[data-role=val]',el);if(rv)rv.textContent=txt;}if(w.varId2===id){var r2=$('[data-role=sub]',el);if(r2)r2.textContent=txt;}if(w.varId3===id){var r3=$('[data-role=sub2]',el);if(r3)r3.textContent=txt;}}
  });
