  // ===== Widget: Ereignis (eventctl) — Wochenplan/Timer aktiv schalten + Status =====
  defWidget('eventctl',{
    label:'Ereignis', paletteIcon:'clock', size:[230,72],
    render:function(w){return '<div style="height:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px">'
      +'<div style="min-width:0"><div data-role="evname" style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escL(w.label||'Ereignis')+'</div><div data-role="evsub" style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">–</div></div>'
      +'<span class="sw" data-role="evsw"><i class="swk"></i></span></div>';},
    props:function(w){return row('Ereignis-ID','<input id="pEvId" value="'+(w.eventId||'')+'" placeholder="Event-ID (Wochenplan/Timer)">');},
    wire:function(w){if($('#pEvId'))$('#pEvId').onchange=function(){w.eventId=parseInt(this.value)||0;render();fetchEvent(w);};},
    click:function(w,el,e){if(!w.eventId)return false;if(!e.target.closest('[data-role=evsw]'))return false;var sw=$('[data-role=evsw]',el),on=!sw.classList.contains('on');sw.classList.toggle('on',on);fetch('?api=setevent&id='+w.eventId+'&active='+(on?1:0)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'}).then(function(){setTimeout(function(){fetchEvent(w);},300);});return true;}
  });
