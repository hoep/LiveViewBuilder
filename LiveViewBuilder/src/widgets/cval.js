  // ===== Widget: Zählerwert (cval) — Verbrauch einer Periode aus einer Zählervariable =====
  defWidget('cval',{
    label:'Zählerwert', paletteIcon:'wkpi', size:[190,96],
    defaults:function(w){w.label='Verbrauch';w.cmpStage='day';},
    render:function(w){var al=w.align?(';text-align:'+w.align):'';var fs=w.valfs||26;
      return '<div class="wv"><div class="wvbody" style="min-width:0'+al+'"><div class="l">'+esc(w.label||'')+(STAGECUR[cmpStage(w)]?' · '+STAGECUR[cmpStage(w)]:'')+'</div><div class="v" data-role="val" style="font-size:'+(w.valfs?w.valfs+'px':'var(--wf-val)')+'">–</div></div></div>';},
    props:function(w){return row('Aggregationsstufe',stageSel('pCvStage',cmpStage(w)))
      +row('Einheit','<input id="pCvUnit" value="'+esc(w.unit||'')+'">')
      +row('Wert-Größe','<input id="pCvFs" type="number" value="'+(w.valfs||26)+'">')
      +row('Ausrichtung','<select id="pCvAlign"><option value=""'+(!w.align?' selected':'')+'>Links</option><option value="center"'+(w.align==='center'?' selected':'')+'>Zentriert</option><option value="right"'+(w.align==='right'?' selected':'')+'>Rechts</option></select>')
      +row('Präfix','<input id="pPre" value="'+esc(w.pre||'')+'" placeholder="z. B. ~">')
      +row('Suffix','<input id="pSuf" value="'+esc(w.suf||'')+'" placeholder="z. B. °C">')
      +'<div class="pgh">Farbe nach Schwelle</div>'
      +row('Aktiv','<input type="checkbox" id="pColThr"'+(w.colThr?' checked':'')+'>')
      +(w.colThr?(row('Grün bis','<input id="pVT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pVT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')+row('Invertieren','<input type="checkbox" id="pThrInv"'+(w.thrInvert?' checked':'')+'>')):'')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Zeigt den Verbrauch (Δ) der gewählten Periode. Variable muss ein geloggter Zähler sein.</div>';},
    wire:function(w){
      if($('#pCvStage'))$('#pCvStage').onchange=function(){w.cmpStage=this.value;refreshCVal(w);commit();};
      if($('#pCvUnit'))$('#pCvUnit').oninput=function(){w.unit=this.value||undefined;render();computeCounterVal(w);};
      if($('#pCvFs'))$('#pCvFs').oninput=function(){w.valfs=parseInt(this.value)||26;render();};
      if($('#pCvAlign'))$('#pCvAlign').onchange=function(){w.align=this.value||undefined;render();};
      if($('#pPre'))$('#pPre').oninput=function(){w.pre=this.value||undefined;computeCounterVal(w);};
      if($('#pSuf'))$('#pSuf').oninput=function(){w.suf=this.value||undefined;computeCounterVal(w);};
      if($('#pColThr'))$('#pColThr').onchange=function(){w.colThr=this.checked||undefined;renderProps();computeCounterVal(w);};
      if($('#pVT1'))$('#pVT1').oninput=function(){w.t1=this.value===''?undefined:parseFloat(this.value);computeCounterVal(w);};
      if($('#pVT2'))$('#pVT2').oninput=function(){w.t2=this.value===''?undefined:parseFloat(this.value);computeCounterVal(w);};
      if($('#pThrInv'))$('#pThrInv').onchange=function(){w.thrInvert=this.checked||undefined;computeCounterVal(w);};
    },
    mount:function(w){computeCounterVal(w);}, // initialer Wert nach Render
    live:function(w,el,id,d,base,txt,on){computeCounterVal(w);return true;} // Präfix/Suffix + Schwellenfarbe erledigt computeCounterVal (js/) im Callback
  });
