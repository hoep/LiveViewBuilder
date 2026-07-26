  // ===== Widget: Zählerwert (cval) — Verbrauch einer Periode aus einer Zählervariable =====
  defWidget('cval',{
    label:'Zählerwert', paletteIcon:'wkpi', size:[190,96],
    defaults:function(w){w.label='Verbrauch';w.cmpStage='day';},
    render:function(w){var al=w.align?(';text-align:'+w.align):'';var fs=w.valfs||26;
      return '<div class="wv"><div class="wvbody" style="min-width:0'+al+'"><div class="l">'+esc(w.label||'')+(STAGECUR[cmpStage(w)]?' · '+STAGECUR[cmpStage(w)]:'')+'</div><div class="v" data-role="val" style="font-size:'+fs+'px">–</div></div></div>';},
    props:function(w){return row('Aggregationsstufe',stageSel('pCvStage',cmpStage(w)))
      +row('Einheit','<input id="pCvUnit" value="'+esc(w.unit||'')+'">')
      +row('Wert-Größe','<input id="pCvFs" type="number" value="'+(w.valfs||26)+'">')
      +row('Ausrichtung','<select id="pCvAlign"><option value=""'+(!w.align?' selected':'')+'>Links</option><option value="center"'+(w.align==='center'?' selected':'')+'>Zentriert</option><option value="right"'+(w.align==='right'?' selected':'')+'>Rechts</option></select>')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Zeigt den Verbrauch (Δ) der gewählten Periode. Variable muss ein geloggter Zähler sein.</div>';},
    wire:function(w){
      if($('#pCvStage'))$('#pCvStage').onchange=function(){w.cmpStage=this.value;refreshCVal(w);commit();};
      if($('#pCvUnit'))$('#pCvUnit').oninput=function(){w.unit=this.value||undefined;render();computeCounterVal(w);};
      if($('#pCvFs'))$('#pCvFs').oninput=function(){w.valfs=parseInt(this.value)||26;render();};
      if($('#pCvAlign'))$('#pCvAlign').onchange=function(){w.align=this.value||undefined;render();};
    },
    mount:function(w){computeCounterVal(w);}, // initialer Wert nach Render
    live:function(w,el,id,d,base,txt,on){computeCounterVal(w);return true;} // Zähler ändert sich -> Periode neu berechnen
  });
