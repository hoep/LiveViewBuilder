  // ===== Widget: Button — Icon-Badge, Zustands-Styling (Ein/Aus) =====
  defWidget('button',{
    label:'Button', paletteIcon:'power', size:[110,110],
    render:function(w){return '<div class="hbtn"><div class="hbicon" data-role="badge">'+iconSVG(w.icon||'power')+'</div>'+(w.label?'<div class="hblabel">'+esc(w.label)+'</div>':'')+'</div>';},
    props:function(w){return btnStateProps(w);},
    wire:function(w){btnStateWire(w);},
    live:function(w,el,id,d,base,txt,on){var b=$('[data-role=badge]',el);if(b)b.classList.toggle('on',on);var tv=$('[data-role=val]',el);if(tv)tv.textContent=txt;applyBtnState(w,el,on);}
  });
