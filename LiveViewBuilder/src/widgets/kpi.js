  // ===== Widget: KPI =====
  defWidget('kpi',{
    label:'KPI', cat:'Anzeige', paletteIcon:'wkpi', size:[240,96],
    defaults:function(w){w.label='Autarkie';w.unit='%';w.icon='home';w.dir='up';w.delta='+6 % ggü. gestern';},
    render:function(w){return '<div class="hkpi"><span class="hkbi">'+iconSVG(w.icon||'home')+'</span><div class="hkm"><div class="hkl">'+escL(w.label||'')+'</div><div class="hkn"><span data-role="val">–</span>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</div>'+(w.cmpOn?'<div class="hks" data-role="cmp">…</div>':(w.delta?'<div class="hks '+(w.dir==='dn'?'dn':(w.dir==='up'?'up':''))+'">'+(w.dir==='dn'?'▼ ':(w.dir==='up'?'▲ ':''))+esc(w.delta)+'</div>':''))+'</div></div>';},
    props:function(w){return (w.type==='kpi'?(row('Einheit','<input id="pUnit" value="'+esc(w.unit||'')+'">')
      +'<div class="pgh">Farbe nach Schwelle</div>'
      +row('Aktiv','<input type="checkbox" id="pColThr"'+(w.colThr?' checked':'')+'>')
      +(w.colThr?(row('Grün bis','<input id="pVT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pVT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')+row('Invertieren','<input type="checkbox" id="pThrInv"'+(w.thrInvert?' checked':'')+'>')):'')
      +(w.cmpOn?'':row('Delta-Text','<input id="pDelta" value="'+esc(w.delta||'')+'">')+row('Richtung',dirSel('pDir',w.dir)))):'');},
    wire:function(w){function relive(){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
      if($('#pUnit'))$('#pUnit').oninput=function(){w.unit=this.value;render();};if($('#pDelta'))$('#pDelta').oninput=function(){w.delta=this.value;render();};
      if($('#pColThr'))$('#pColThr').onchange=function(){w.colThr=this.checked||undefined;renderProps();relive();};
      if($('#pVT1'))$('#pVT1').oninput=function(){w.t1=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pVT2'))$('#pVT2').oninput=function(){w.t2=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pThrInv'))$('#pThrInv').onchange=function(){w.thrInvert=this.checked||undefined;relive();};},
    mount:function(w){if(w.cmpOn)computeCompare(w);}, // Vergleich sofort nach Render berechnen (nicht auf ersten Poll warten)
    live:function(w,el,id,d,base,txt,on){
      var v=el.querySelector('[data-role=val]'); // txt enthält bereits Präfix/Suffix (aus applyVal in js/06-live.js)
      if(w.cmpOn){computeCompare(w);if(!w.cmpCounter&&v)v.textContent=txt;} // Zähler: Hauptwert kommt aus computeCompare (Perioden-Verbrauch)
      else if(v)v.textContent=txt;
      if(v){if(w.colThr){var _n=parseFloat(String(d.v).replace(',','.'));if(!isNaN(_n)){var _t1=(w.t1!=null?w.t1:0),_t2=(w.t2!=null?w.t2:0),_c=_n<=_t1?'--ok':(_n<=_t2?'--warm':'--crit');if(w.thrInvert)_c=(_n<=_t1?'--crit':(_n<=_t2?'--warm':'--ok'));v.style.color=cssv(_c);}}else v.style.color='';}
      return true;
    }
  });
