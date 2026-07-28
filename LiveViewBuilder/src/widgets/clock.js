  // ===== Widget: Uhr (clock) — Digital-Uhr mit Datum =====
  // Sekunden/12h werden vom zentralen Tick (js/03) nicht abgedeckt -> eigenes Format über data-role="ctime".
  // Standard-Uhr (24h, ohne Sekunden) bleibt auf data-role="time" und damit auf dem zentralen Tick.
  function _clkFmt(w,now){function p(n){return String(n).padStart(2,'0');}var h=now.getHours(),suf='';
    if(w.h12){suf=(h<12?' AM':' PM');h=h%12;if(h===0)h=12;}
    return (w.h12?h:p(h))+':'+p(now.getMinutes())+(w.showSec?':'+p(now.getSeconds()):'')+suf;}
  function _clkUpd(w,now){var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var t=$('[data-role=ctime]',el);if(t)t.textContent=_clkFmt(w,now||new Date());}
  if(!window._clkTimer){window._clkTimer=setInterval(function(){ // aktualisiert nur „erweiterte" Uhren (Sekunden/12h)
    if(typeof state==='undefined'||!state.widgets)return;var now=new Date();
    state.widgets.forEach(function(w){if(w.type==='clock'&&(w.showSec||w.h12))_clkUpd(w,now);});},1000);}
  defWidget('clock',{
    label:'Uhr', paletteIcon:'clock', size:[170,84],
    defaults:function(w){w.clkShow='both';},
    render:function(w){var s=w.clkShow||'both';var tr=(w.showSec||w.h12)?'ctime':'time';return '<div class="hclock">'+((s!=='date')?'<div class="hctime" data-role="'+tr+'">–</div>':'')+((s!=='time')?'<div class="hcdate" data-role="date"></div>':'')+'</div>';},
    props:function(w){return row('Anzeige','<select id="pClk"><option value="both"'+((w.clkShow||'both')==='both'?' selected':'')+'>Uhrzeit + Datum</option><option value="time"'+(w.clkShow==='time'?' selected':'')+'>nur Uhrzeit</option><option value="date"'+(w.clkShow==='date'?' selected':'')+'>nur Datum</option></select>')
      +row('Format','<select id="pClkH12"><option value="24"'+(!w.h12?' selected':'')+'>24 Stunden</option><option value="12"'+(w.h12?' selected':'')+'>12 Stunden</option></select>')
      +row('Sekunden','<input type="checkbox" id="pClkSec"'+(w.showSec?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Sekunden anzeigen</span>');},
    wire:function(w){if($('#pClk'))$('#pClk').onchange=function(){w.clkShow=this.value;render();commit();};
      if($('#pClkH12'))$('#pClkH12').onchange=function(){w.h12=(this.value==='12')||undefined;render();commit();};
      if($('#pClkSec'))$('#pClkSec').onchange=function(){w.showSec=this.checked||undefined;render();commit();};},
    mount:function(w){if(w.showSec||w.h12)_clkUpd(w,new Date());} // Erst-Anzeige ohne auf den nächsten Sekunden-Tick zu warten
  });
