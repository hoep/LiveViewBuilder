  // ===== Widget: Alarm =====
  defWidget('alarm',{
    label:'Alarm', paletteIcon:'shield', size:[200,112],
    render:function(w){var onT=(w.onText!=null&&w.onText!=='')?w.onText:'Scharf',offT=(w.offText!=null&&w.offText!=='')?w.offText:'Unscharf';return '<div class="halarm"><div class="hastate" data-role="val">–</div><div class="habtns"><button data-role="aon">'+esc(onT)+'</button><button data-role="aoff">'+esc(offT)+'</button></div></div>';},
    props:function(w){return row('Text','<input id="pAlOn" value="'+esc(w.onText||'')+'" placeholder="Scharf"> <input id="pAlOff" value="'+esc(w.offText||'')+'" placeholder="Unscharf">');},
    wire:function(w){function relive(){render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}if($('#pAlOn'))$('#pAlOn').oninput=function(){w.onText=this.value||undefined;relive();};if($('#pAlOff'))$('#pAlOff').oninput=function(){w.offText=this.value||undefined;relive();};},
    live:function(w,el,id,d,base,txt,on){var as=$('[data-role=val]',el);if(as){as.textContent=txt;as.style.color=on?'var(--crit)':'var(--ok)';}return;}
  });
