  // ===== Widget: Text — statische Textzeile =====
  defWidget('text',{
    label:'Text', cat:'Grundelemente', paletteIcon:'wcode', size:[200,48],
    // Mehrzeilige Texte in einem hohen Kasten gehoeren nach OBEN. Zentriert sieht bei
    // kurzem Text gut aus, laesst bei langem Text aber oben und unten Luecken stehen.
    render:function(w){return '<div class="wt'+(w.vtop?' vtop':'')+'"><div class="t">'+escL(w.label||'Text')+'</div></div>';},
    props:function(w){return row('Text oben','<input type="checkbox" id="pTxTop"'+(w.vtop?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">statt senkrecht zentriert</span>');},
    wire:function(w){if($('#pTxTop'))$('#pTxTop').onchange=function(){w.vtop=this.checked||undefined;render();commit();};}
  });
