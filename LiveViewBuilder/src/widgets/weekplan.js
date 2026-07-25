  // ===== Widget: Wochenplan (weekplan) — Wochenplan-Grid aus Symcon-Variable =====
  defWidget('weekplan',{
    label:'Wochenplan', paletteIcon:'calendar', size:[340,180],
    defaults:function(w){w.label='Wochenplan';},
    render:function(w){return '<div class="hwp"><div class="hwphd">'+esc(w.label||'Wochenplan')+'</div><div class="hwpgrid" data-role="wpgrid"><div class="hwpempty">lädt …</div></div>'+(w.showTimes?'<div data-role="wptimes" style="font-size:10px;color:var(--muted);padding:4px 8px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>':'')+'</div>';},
    props:function(w){return row('Schaltzeiten (heute)','<input type="checkbox" id="pWpTimes"'+(w.showTimes?' checked':'')+'>');},
    wire:function(w){if($('#pWpTimes'))$('#pWpTimes').onchange=function(){w.showTimes=this.checked||undefined;render();fetchWeekplan(w);};}
  });
