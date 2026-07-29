  // ===== Widget: Sparkline (spark) — kompakte Verlaufskurve =====
  // Eigene setSpark-Variante (überschreibt die aus 03-render-charts.js): honoriert Linienfarbe (Skin-Keyword)
  // und Füllung an/aus. Alle Render-Pfade laufen über renderChartData -> setSpark, daher greift dies überall.
  function setSpark(w){
    var ec=_ec[w.id];if(!ec)return;
    var _lc=w.lineColor?_skinColor(w.lineColor):'',_m=_lc&&_lc.match(/^var\((--[\w-]+)\)$/),acc=_m?cssv(_m[1]):(_lc||cssv('--accent'));
    var s0=chartSeries(w)[0]||{data:[]};var data=s0.data;
    var ser={type:'line',showSymbol:false,smooth:true,lineStyle:{color:acc,width:1.8},
      data:data,markPoint:{silent:true,symbol:'circle',symbolSize:5,itemStyle:{color:acc},label:{show:false},data:data.length?[{coord:data[data.length-1]}]:[]}};
    if(w.fill!==false)ser.areaStyle={color:accA(.16,acc)};
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,grid:{left:2,right:2,top:6,bottom:4},
      tooltip:{trigger:'axis',confine:true},
      xAxis:{type:'time',show:false},yAxis:{type:'value',scale:true,show:false},
      series:[ser]},true);
  }
  defWidget('spark',{
    label:'Sparkline', paletteIcon:'wchart', size:[150,50],
    render:function(w){return '<div data-role="chart"></div>';},
    props:function(w){if(w.type!=='spark')return '';
      return row('Linienfarbe',selOf('pSpLine',w.lineColor,['accent','ok','warn','crit','info']))
        +row('Füllung','<input type="checkbox" id="pSpFill"'+((w.fill!==false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Fläche unter der Linie</span>');},
    wire:function(w){
      if($('#pSpLine'))$('#pSpLine').onchange=function(){w.lineColor=this.value||undefined;render();commit();};
      if($('#pSpFill'))$('#pSpFill').onchange=function(){w.fill=this.checked?undefined:false;render();commit();};
    },
    live:function(w,el,id,d,base,txt,on){if(_ec[w.id])chartPushRefresh(w);}
  });
