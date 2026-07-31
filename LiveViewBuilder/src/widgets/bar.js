  // ===== Widget: Balken (Bar) — horizontaler Fortschrittsbalken =====
  defWidget('bar',{
    label:'Balken', paletteIcon:'wbars', size:[220,66],
    render:function(w){return '<div class="wbar"><div class="bl"><span class="l'+(w.icon?' hasic':'')+'">'+(w.icon?'<span class="baric">'+iconSVG(w.icon)+'</span>':'')+escL(w.label||'')+'</span><span class="bv" data-role="val">–</span></div><div class="btrack"><i data-role="bar"></i></div></div>';},
    live:function(w,el,id,d,base,txt,on){var mn=(w.min!=null?w.min:0),mx=(w.max!=null?w.max:100);var nv=parseFloat(String(d.v).replace(',','.'));var bar=$('[data-role=bar]',el);if(bar&&!isNaN(nv))bar.style.width=Math.max(0,Math.min(100,((nv-mn)/((mx-mn)||1))*100))+'%';var bv=$('[data-role=val]',el);if(bv)bv.textContent=txt;}
  });
