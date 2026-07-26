  // ===== Widget: KPI =====
  defWidget('kpi',{
    label:'KPI', paletteIcon:'wkpi', size:[240,96],
    defaults:function(w){w.label='Autarkie';w.unit='%';w.icon='home';w.dir='up';w.delta='+6 % ggü. gestern';},
    render:function(w){return '<div class="hkpi"><span class="hkbi">'+iconSVG(w.icon||'home')+'</span><div class="hkm"><div class="hkl">'+esc(w.label||'')+'</div><div class="hkn"><span data-role="val">–</span>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</div>'+(w.cmpOn?'<div class="hks" data-role="cmp">…</div>':(w.delta?'<div class="hks '+(w.dir==='dn'?'dn':(w.dir==='up'?'up':''))+'">'+(w.dir==='dn'?'▼ ':(w.dir==='up'?'▲ ':''))+esc(w.delta)+'</div>':''))+'</div></div>';},
    props:function(w){return (w.type==='kpi'?(row('Einheit','<input id="pUnit" value="'+esc(w.unit||'')+'">')+(w.cmpOn?'':row('Delta-Text','<input id="pDelta" value="'+esc(w.delta||'')+'">')+row('Richtung',dirSel('pDir',w.dir)))):'');},
    wire:function(w){if($('#pUnit'))$('#pUnit').oninput=function(){w.unit=this.value;render();};if($('#pDelta'))$('#pDelta').oninput=function(){w.delta=this.value;render();};},
    mount:function(w){if(w.cmpOn)computeCompare(w);}, // Vergleich sofort nach Render berechnen (nicht auf ersten Poll warten)
    live:function(w,el,id,d,base,txt,on){
      if(w.cmpOn){computeCompare(w);if(!w.cmpCounter){var v=el.querySelector('[data-role=val]');if(v)v.textContent=txt;}return true;} // Zähler: Hauptwert kommt aus computeCompare (Perioden-Verbrauch)
      var v=el.querySelector('[data-role=val]');if(v)v.textContent=txt;return true;
    }
  });
