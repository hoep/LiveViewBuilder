  // ===== Widget: Statistikwert (sval) — Min/Max/Ø einer geloggten Standardvariable ueber eine Periode =====
  defWidget('sval',{
    label:'Statistik', paletteIcon:'wkpi', size:[200,96],
    defaults:function(w){w.label='Ø Wert';w.cmpStage='day';w.statAvg=true;},
    render:function(w){var al=w.align?(';text-align:'+w.align):'';var cnt=aggParts(w).length;var fs=w.valfs||(cnt>=2?15:26);
      return '<div class="wv"><div class="wvbody" style="min-width:0'+al+'"><div class="l">'+esc(w.label||'')+(STAGECUR[cmpStage(w)]?' · '+STAGECUR[cmpStage(w)]:'')+'</div><div class="v" data-role="val" style="font-size:'+fs+'px;line-height:1.15">–</div></div></div>';},
    props:function(w){return row('Aggregationsstufe',stageSel('pSvStage',cmpStage(w)))
      +row('Werte','<label style="margin-right:10px"><input type="checkbox" id="pSvMin"'+(w.statMin?' checked':'')+'> Min</label>'
                   +'<label style="margin-right:10px"><input type="checkbox" id="pSvAvg"'+((w.statAvg||(!w.statMin&&!w.statMax&&!w.statAvg))?' checked':'')+'> Ø</label>'
                   +'<label><input type="checkbox" id="pSvMax"'+(w.statMax?' checked':'')+'> Max</label>')
      +row('Einheit','<input id="pSvUnit" value="'+esc(w.unit||'')+'">')
      +row('Wert-Größe','<input id="pSvFs" type="number" value="'+(w.valfs||'')+'" placeholder="auto">')
      +row('Ausrichtung','<select id="pSvAlign"><option value=""'+(!w.align?' selected':'')+'>Links</option><option value="center"'+(w.align==='center'?' selected':'')+'>Zentriert</option><option value="right"'+(w.align==='right'?' selected':'')+'>Rechts</option></select>')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Zeitgewichtetes Min/Max/Ø der Periode. Variable muss geloggt sein.</div>';},
    wire:function(w){
      if($('#pSvStage'))$('#pSvStage').onchange=function(){w.cmpStage=this.value;refreshAggVal(w);commit();};
      if($('#pSvMin'))$('#pSvMin').onchange=function(){w.statMin=this.checked||undefined;render();computeAggVal(w);commit();};
      if($('#pSvAvg'))$('#pSvAvg').onchange=function(){w.statAvg=this.checked||undefined;render();computeAggVal(w);commit();};
      if($('#pSvMax'))$('#pSvMax').onchange=function(){w.statMax=this.checked||undefined;render();computeAggVal(w);commit();};
      if($('#pSvUnit'))$('#pSvUnit').oninput=function(){w.unit=this.value||undefined;render();computeAggVal(w);};
      if($('#pSvFs'))$('#pSvFs').oninput=function(){w.valfs=parseInt(this.value)||undefined;render();};
      if($('#pSvAlign'))$('#pSvAlign').onchange=function(){w.align=this.value||undefined;render();};
    },
    mount:function(w){computeAggVal(w);},
    live:function(w,el,id,d,base,txt,on){computeAggVal(w);return true;}
  });
