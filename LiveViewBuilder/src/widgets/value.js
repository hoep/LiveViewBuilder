  // ===== Widget: Wert (value) — Präfix/Suffix/Ausrichtung + Schwellwert-Textfarbe =====
  defWidget('value',{
    label:'Wert', paletteIcon:'meter', size:[180,88],
    render:function(w){var ic=w.icon?('<div class="wvic">'+iconSVG(w.icon)+'</div>'):'';var al=w.align?(';text-align:'+w.align):'';return '<div class="wv'+(w.icon?' hasic':'')+'">'+ic+'<div class="wvbody" style="min-width:0'+al+'"><div class="l">'+esc(w.label||'')+'</div><div class="v" data-role="val">–</div></div></div>';},
    props:function(w){return row('Wert-Größe','<input id="pFs" type="number" value="'+(w.valfs||24)+'">')
      +row('Präfix','<input id="pPre" value="'+esc(w.pre||'')+'" placeholder="z. B. ~">')
      +row('Suffix','<input id="pSuf" value="'+esc(w.suf||'')+'" placeholder="z. B. °C">')
      +row('Ausrichtung','<select id="pAlign"><option value=""'+(!w.align?' selected':'')+'>Links</option><option value="center"'+(w.align==='center'?' selected':'')+'>Zentriert</option><option value="right"'+(w.align==='right'?' selected':'')+'>Rechts</option></select>')
      +'<div class="pgh">Farbe nach Schwelle</div>'
      +row('Aktiv','<input type="checkbox" id="pColThr"'+(w.colThr?' checked':'')+'>')
      +(w.colThr?(row('Grün bis','<input id="pVT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pVT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')+row('Invertieren','<input type="checkbox" id="pThrInv"'+(w.thrInvert?' checked':'')+'>')):'')
      +listEditor(w,'vassoc','Assoziationen (Wert · Text · Farbe)',[{k:'v',ph:'Wert'},{k:'text',ph:'Text'},{k:'color',ph:'#hex'}]);},
    wire:function(w){
      function relive(){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
      if($('#pFs'))$('#pFs').oninput=function(){w.valfs=parseInt(this.value)||24;render();};
      if($('#pPre'))$('#pPre').oninput=function(){w.pre=this.value||undefined;relive();};
      if($('#pSuf'))$('#pSuf').oninput=function(){w.suf=this.value||undefined;relive();};
      if($('#pAlign'))$('#pAlign').onchange=function(){w.align=this.value||undefined;render();};
      if($('#pColThr'))$('#pColThr').onchange=function(){w.colThr=this.checked||undefined;renderProps();relive();};
      if($('#pVT1'))$('#pVT1').oninput=function(){w.t1=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pVT2'))$('#pVT2').oninput=function(){w.t2=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pThrInv'))$('#pThrInv').onchange=function(){w.thrInvert=this.checked||undefined;relive();};
    },
    live:function(w,el,id,d,base,txt,on){var v=$('[data-role=val]',el);if(!v)return;v.textContent=txt;
      if(w.colThr){var n=parseFloat(String(d.v).replace(',','.'));if(!isNaN(n)){var t1=(w.t1!=null?w.t1:0),t2=(w.t2!=null?w.t2:0),c=n<=t1?'--ok':(n<=t2?'--warm':'--crit');if(w.thrInvert)c=(n<=t1?'--crit':(n<=t2?'--warm':'--ok'));v.style.color=cssv(c);}}
      else v.style.color='';
      if(w.vassoc&&w.vassoc.length){var vs=w.vassoc.filter(function(a){return String(a.v)===String(d.v);})[0];if(vs){if(vs.text!=null&&vs.text!=='')v.textContent=(w.pre||'')+vs.text+(w.suf||'');if(vs.color)v.style.color=vs.color;}}}
  });
