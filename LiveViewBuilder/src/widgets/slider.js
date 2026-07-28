  // ===== Widget: Slider — horizontaler Wert-Regler =====
  defWidget('slider',{
    label:'Slider', paletteIcon:'wslider', size:[220,74],
    render:function(w){return '<div class="hslider"><div class="hsrow"><span class="hsname">'+esc(w.label||'')+'</span><span class="hsval" data-role="val">–</span></div><input class="hsrange" type="range" data-role="range" min="'+(w.min!=null?w.min:0)+'" max="'+(w.max!=null?w.max:100)+'" step="'+(w.step||1)+'" value="0"'+(w.mirror?' style="transform:scaleX(-1)"':'')+'></div>';},
    props:function(w){return row('Spiegeln','<input type="checkbox" id="pSMirror"'+(w.mirror?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Skala umkehren</span>');},
    wire:function(w){if($('#pSMirror'))$('#pSMirror').onchange=function(){w.mirror=this.checked||undefined;render();};},
    live:function(w,el,id,d,base,txt,on){var sv=$('[data-role=val]',el);if(sv)sv.textContent=txt;var r=$('[data-role=range]',el);if(r&&document.activeElement!==r)r.value=parseFloat(d.v);}
  });
