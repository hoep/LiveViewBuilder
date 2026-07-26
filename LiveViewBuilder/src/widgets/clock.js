  // ===== Widget: Uhr (clock) — Digital-Uhr mit Datum =====
  defWidget('clock',{
    label:'Uhr', paletteIcon:'clock', size:[170,84],
    defaults:function(w){w.clkShow='both';},
    render:function(w){var s=w.clkShow||'both';return '<div class="hclock">'+((s!=='date')?'<div class="hctime" data-role="time">–</div>':'')+((s!=='time')?'<div class="hcdate" data-role="date"></div>':'')+'</div>';},
    props:function(w){return row('Anzeige','<select id="pClk"><option value="both"'+((w.clkShow||'both')==='both'?' selected':'')+'>Uhrzeit + Datum</option><option value="time"'+(w.clkShow==='time'?' selected':'')+'>nur Uhrzeit</option><option value="date"'+(w.clkShow==='date'?' selected':'')+'>nur Datum</option></select>');},
    wire:function(w){if($('#pClk'))$('#pClk').onchange=function(){w.clkShow=this.value;render();commit();};}
  });
