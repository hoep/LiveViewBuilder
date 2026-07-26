  // ===== Widget: Sonnenbogen (suncard) — Sonnenauf-/untergang mit Bogen =====
  defWidget('suncard',{
    label:'Sonnenbogen', paletteIcon:'sunrise', size:[280,150],
    defaults:function(w){w.label='Sonne';},
    render:function(w){return '<div class="hsc">'+(w.showTime?'<div class="hscnow" data-role="now"></div>':'')+'<svg class="hscsvg" viewBox="0 0 200 96" preserveAspectRatio="none"><path class="hscarc" d="M12 82 Q100 -6 188 82"/><line class="hschoriz" x1="0" y1="82" x2="200" y2="82"/><circle class="hscsun" data-role="sun" cx="12" cy="82" r="7"/></svg><div class="hscrow"><span class="hsct"><svg class="scic" viewBox="0 0 24 24">'+ICONS.sunrise[1]+'</svg><span data-role="val">–</span></span><span class="hsclen" data-role="len"></span><span class="hsct"><svg class="scic" viewBox="0 0 24 24">'+ICONS.sunset[1]+'</svg><span data-role="val2">–</span></span></div></div>';},
    props:function(w){return row('Uhrzeit anzeigen','<input type="checkbox" id="pSunTime"'+(w.showTime?' checked':'')+'>');},
    wire:function(w){if($('#pSunTime'))$('#pSunTime').onchange=function(){w.showTime=this.checked||undefined;render();commit();};},
    live:function(w,el,id,d,base,txt,on){refreshSun(w);return;}
  });
