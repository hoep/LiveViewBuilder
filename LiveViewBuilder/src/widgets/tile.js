  // ===== Widget: Kachel (Tile) — Icon-Badge mit Name/Status, Zustands-Styling =====
  defWidget('tile',{
    label:'Kachel', paletteIcon:'wtile', size:[190,64],
    render:function(w){
      if(w.iconOnly)return '<div class="htile htile-icon"><div class="htico" data-role="badge">'+iconSVG(w.icon||'bulb')+'</div></div>'; // nur Icon, füllt die Kachel
      return '<div class="htile"><div class="htbadge" data-role="badge">'+iconSVG(w.icon||'bulb')+'</div><div class="httext"><div class="htname">'+esc(w.label||'')+'</div><div class="htstate" data-role="val">–</div></div></div>';},
    props:function(w){return row('Nur Icon','<input type="checkbox" id="pTileIcon"'+(w.iconOnly?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Icon füllt die Kachel (für Popup-Buttons)</span>')+btnStateProps(w);},
    wire:function(w){if($('#pTileIcon'))$('#pTileIcon').onchange=function(){w.iconOnly=this.checked||undefined;render();renderProps();commit();};btnStateWire(w);},
    live:function(w,el,id,d,base,txt,on){var b=$('[data-role=badge]',el);if(b)b.classList.toggle('on',on);var tv=$('[data-role=val]',el);if(tv)tv.textContent=txt;applyBtnState(w,el,on);}
  });
