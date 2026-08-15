  // ===== Widget: Thermostat — Heizung mit Ist/Soll, Balken, Modi und +/− Steller =====
  defWidget('thermostat',{
    label:'Thermostat', cat:'Steuerung', paletteIcon:'thermostat', size:[240,196],
    defaults:function(w){w.min=14;w.max=28;w.step=0.5;w.label='Thermostat';},
    render:function(w){var tShowState=(w.showState!==false),tShowBar=(w.showBar!==false),tShowModes=(w.showModes!==false),tShowSet=(w.showSet!==false);
      return '<div class="htc tone-idle">'
        +'<div class="htc-top"><span class="htc-name">'+escL(w.label||'')+'</span>'+(tShowState?'<span class="htc-state" data-role="hstate"></span>':'')+'</div>'
        +'<div class="htc-main"><span class="htc-ist" data-role="val">–</span><span class="htc-sep">→</span><span class="htc-soll">Soll <b data-role="target">–</b></span></div>'
        +(tShowBar?'<div class="htc-bar"><i data-role="istfill"></i><i class="htc-sollmk" data-role="sollmk"></i></div>':'')
        +(tShowModes?'<div class="htc-modes" data-role="modes"></div>':'')
        +(tShowSet?'<div class="htc-set"><button data-role="dn"><svg><use href="#ic-minus"/></svg></button><b class="httval" data-role="target2">–</b><button data-role="up"><svg><use href="#ic-plus"/></svg></button></div>':'')
        +'</div>';},
    props:function(w){return (w.type==='thermostat'?('<div class="pgh">Elemente (abschaltbar)</div>'
        +row('Heizstatus','<input type="checkbox" id="pShState"'+(w.showState!==false?' checked':'')+'>')
        +row('Ist/Soll-Balken','<input type="checkbox" id="pShBar"'+(w.showBar!==false?' checked':'')+'>')
        +row('Modus-Buttons','<input type="checkbox" id="pShModes"'+(w.showModes!==false?' checked':'')+'>')
        +row('+/− Steller','<input type="checkbox" id="pShSet"'+(w.showSet!==false?' checked':'')+'>')):'');},
    wire:function(w){
      if($('#pShState'))$('#pShState').onchange=function(){w.showState=this.checked;render();commit();};
      if($('#pShBar'))$('#pShBar').onchange=function(){w.showBar=this.checked;render();commit();};
      if($('#pShModes'))$('#pShModes').onchange=function(){w.showModes=this.checked;render();commit();};
      if($('#pShSet'))$('#pShSet').onchange=function(){w.showSet=this.checked;render();commit();};
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId===id||w.varId2===id||w.varId3===id)updateTherm(w,rootOfEl(el));
    }
  });
