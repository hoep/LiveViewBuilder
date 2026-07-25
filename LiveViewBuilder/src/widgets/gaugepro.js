// gaugepro widget
defWidget('gaugepro',{
  label:'Gauge+',
  paletteIcon:'gauge',
  size:[170,150],
  render:function(w){return '<div data-role="chart"></div>';},
  props:function(w){return (w.type==='gaugepro'?(row('Grün bis','<input id="pT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')):'');},
  live:function(w,el,id,d,base,txt,on){setGaugePro(w,d);}
});
