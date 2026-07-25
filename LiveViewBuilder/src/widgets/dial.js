// dial widget
defWidget('dial',{
  label:'Dial',
  paletteIcon:'wdial',
  size:[150,150],
  defaults:function(w){
    w.min=0;w.max=100;w.step=1;w.label='Sollwert';
  },
  render:function(w){
    var dp0=_dpt(135);return '<div class="hdial"><svg viewBox="0 0 100 100"><path class="dtrack" d="'+dialTrack()+'"/><path class="dprog" data-role="dprog" d="'+dialProg(0)+'"/><circle class="dthumb" data-role="dthumb" cx="'+dp0[0]+'" cy="'+dp0[1]+'" r="5.5"/></svg><div class="dctr"><div class="dval" data-role="val">–</div><div class="dlbl">'+esc(w.label||'')+'</div></div></div>';
  },
  live:function(w,el,id,d,base,txt,on){
    if(w.varId===id){var dvv=$('[data-role=val]',el);if(dvv)dvv.textContent=txt;var dmn=(w.min!=null?w.min:0),dmx=(w.max!=null?w.max:100),dnv=parseFloat(String(d.v).replace(',','.'));if(!isNaN(dnv)){var dfr=Math.max(0,Math.min(1,(dnv-dmn)/((dmx-dmn)||1))),pp=$('[data-role=dprog]',el);if(pp)pp.setAttribute('d',dialProg(dfr));var th=$('[data-role=dthumb]',el);if(th){var pt=_dpt(135+270*dfr);th.setAttribute('cx',pt[0]);th.setAttribute('cy',pt[1]);}}}
  }
});
