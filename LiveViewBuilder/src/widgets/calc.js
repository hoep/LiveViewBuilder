  // ===== Widget: Berechnung (calc) — Aggregat über mehrere Variablen (P2-Calculation) =====
  defWidget('calc',{
    label:'Berechnung', cat:'Grundelemente', paletteIcon:'meter', size:[190,88],
    defaults:function(w){w.mode='sum';w.label='Summe';w.items=[{vid:0},{vid:0}];},
    render:function(w){return '<div class="wv"><div class="wvbody" style="min-width:0"><div class="l">'+escL(w.label||'')+'</div><div class="v" data-role="val">–</div></div></div>';},
    props:function(w){return row('Rechnung','<select id="pCalcMode">'+['sum','avg','min','max','diff','count'].map(function(m){return '<option value="'+m+'"'+((w.mode||'sum')===m?' selected':'')+'>'+({sum:'Summe',avg:'Mittel',min:'Min',max:'Max',diff:'Differenz (1 − Rest)',count:'Anzahl > 0'}[m])+'</option>';}).join('')+'</select>')
      +row('Einheit','<input id="pCalcUnit" value="'+esc(w.unit||'')+'">')
      +row('Nachkommastellen','<input id="pCalcDec" type="number" min="0" max="4" value="'+(w.dec!=null?w.dec:1)+'">')
      +listEditor(w,'items','Quellen: Variablen-ID',[{k:'vid',ph:'ID'}]);},
    wire:function(w){
      function re(){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)WIDGETS.calc.live(w,el);}
      if($('#pCalcMode'))$('#pCalcMode').onchange=function(){w.mode=this.value;re();};
      if($('#pCalcUnit'))$('#pCalcUnit').oninput=function(){w.unit=this.value||undefined;re();};
      if($('#pCalcDec'))$('#pCalcDec').oninput=function(){w.dec=parseInt(this.value);if(isNaN(w.dec))w.dec=undefined;re();};
    },
    live:function(w,el){
      var vals=(w.items||[]).map(function(o){var lv=o.vid&&_lastVals[o.vid];return lv?parseFloat(String(lv.v).replace(',','.')):NaN;}).filter(function(x){return !isNaN(x);});
      var m=w.mode||'sum',r;
      if(!vals.length)r=NaN;
      else if(m==='sum')r=vals.reduce(function(a,b){return a+b;},0);
      else if(m==='avg')r=vals.reduce(function(a,b){return a+b;},0)/vals.length;
      else if(m==='min')r=Math.min.apply(null,vals);
      else if(m==='max')r=Math.max.apply(null,vals);
      else if(m==='diff')r=vals[0]-vals.slice(1).reduce(function(a,b){return a+b;},0);
      else if(m==='count')r=vals.filter(function(x){return x>0;}).length;
      var dec=(w.dec!=null?w.dec:1),v=$('[data-role=val]',el);
      if(v){if(isNaN(r))v.textContent=(w.nullText||'–');else{var _r=(w.scale!=null&&w.scale!==''&&+w.scale!==1)?r*(+w.scale):r;v.textContent=_fmtNum(_r,{dec:(m==='count'?0:dec),thousand:w.thousand,numAbbrev:w.numAbbrev})+(w.unit?' '+w.unit:'');}}
    }
  });
