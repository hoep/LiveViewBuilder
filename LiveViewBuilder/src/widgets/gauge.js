  // ===== Widget: Gauge — ECharts-Rundinstrument =====
  defWidget('gauge',{
    label:'Gauge', paletteIcon:'gauge', size:[170,150],
    render:function(w){return '<div data-role="chart"></div>';},
    props:function(w){return (w.type==='gauge'?(row('Stil','<select id="pGStyle"><option value="classic"'+((w.gstyle||'classic')==='classic'?' selected':'')+'>Klassisch</option><option value="half"'+(w.gstyle==='half'?' selected':'')+'>Halb-Gauge</option><option value="ring"'+(w.gstyle==='ring'?' selected':'')+'>Donut-Ring</option><option value="halfring"'+(w.gstyle==='halfring'?' selected':'')+'>Halb-Donut</option></select>')+row('Farbe','<select id="pGColor"><option value="accent"'+((w.gcolor||'accent')==='accent'?' selected':'')+'>Akzent</option><option value="graded"'+(w.gcolor==='graded'?' selected':'')+'>Abstufung</option><option value="assoc"'+(w.gcolor==='assoc'?' selected':'')+'>Assoziation</option></select>')+(w.gcolor==='graded'?(row('Grün bis','<input id="pT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')):'')+row('Teilstriche','<input type="checkbox" id="pGTicks"'+(w.gticks?' checked':'')+'>')+row('Mittelknopf','<input type="checkbox" id="pGKnob"'+(w.gknob?' checked':'')+'>')+row('Winkel °','<input id="pGStart" type="number" style="width:60px" value="'+(w.gstart!=null?w.gstart:'')+'" placeholder="Start"> <input id="pGEnd" type="number" style="width:60px" value="'+(w.gend!=null?w.gend:'')+'" placeholder="Ende">')):'');},
    wire:function(w){
      if($('#pGStyle'))$('#pGStyle').onchange=function(){w.gstyle=this.value;render();commit();};
      if($('#pGColor'))$('#pGColor').onchange=function(){w.gcolor=this.value;render();renderProps();commit();};
      if($('#pGTicks'))$('#pGTicks').onchange=function(){w.gticks=this.checked||undefined;render();commit();};
      if($('#pGKnob'))$('#pGKnob').onchange=function(){w.gknob=this.checked||undefined;render();commit();};
      if($('#pGStart'))$('#pGStart').oninput=function(){w.gstart=this.value===''?undefined:parseFloat(this.value);render();commit();};
      if($('#pGEnd'))$('#pGEnd').oninput=function(){w.gend=this.value===''?undefined:parseFloat(this.value);render();commit();};
    },
    live:function(w,el,id,d,base,txt,on){setGauge(w,d);}
  });
