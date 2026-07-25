  // chart — Chart
  defWidget('chart',{
    label:'Chart',
    paletteIcon:'wchart',
    size:[340,190],
    render:function(w){return '<div data-role="chart" style="position:absolute;inset:0"></div>'+(w.pnav?'<div style="position:absolute;left:6px;bottom:4px;display:flex;gap:4px;align-items:center;z-index:2"><button data-role="pprev" style="width:22px;height:20px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);border-radius:5px;cursor:pointer;font-size:12px;line-height:1">‹</button><span data-role="plabel" style="font-size:10px;color:var(--muted);min-width:30px;text-align:center">jetzt</span><button data-role="pnext" style="width:22px;height:20px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);border-radius:5px;cursor:pointer;font-size:12px;line-height:1">›</button></div>':'');},
    click:function(w,el,e){var pp=e.target.closest('[data-role=pprev]'),pn=e.target.closest('[data-role=pnext]');if(!pp&&!pn)return false;w._pOff=Math.max(0,(w._pOff||0)+(pp?1:-1));fetchHist(w);return true;},
    props:function(w){return (w.type==='chart'?row('Chart-Typ','<select id="pCType"><optgroup label="Zeitreihe"><option value="area"'+((w.ctype||'area')==='area'?' selected':'')+'>Fläche</option><option value="areaspline"'+(w.ctype==='areaspline'?' selected':'')+'>Fläche glatt (Spline)</option><option value="line"'+(w.ctype==='line'?' selected':'')+'>Linie</option><option value="spline"'+(w.ctype==='spline'?' selected':'')+'>Linie glatt (Spline)</option><option value="step"'+(w.ctype==='step'?' selected':'')+'>Stufen</option><option value="steparea"'+(w.ctype==='steparea'?' selected':'')+'>Stufenfläche</option><option value="bar"'+(w.ctype==='bar'?' selected':'')+'>Balken</option><option value="barstack"'+(w.ctype==='barstack'?' selected':'')+'>Balken gestapelt</option><option value="scatter"'+(w.ctype==='scatter'?' selected':'')+'>Punkte</option></optgroup><optgroup label="Anteile (ohne Zeit)"><option value="pie"'+(w.ctype==='pie'?' selected':'')+'>Kreis (Pie)</option><option value="donut"'+(w.ctype==='donut'?' selected':'')+'>Donut</option><option value="rose"'+(w.ctype==='rose'?' selected':'')+'>Rose (Nightingale)</option></optgroup></select>'):'')
      +(w.type==='chart'?('<div class="pgh">Diagramm-Optionen</div>'
        +row('Glätten (Spline)','<input type="checkbox" id="pSmooth"'+(w.smooth!==false?' checked':'')+'>')
        +row('Punkte','<input type="checkbox" id="pSym"'+(w.symbols?' checked':'')+'> <input id="pSymS" type="number" style="width:52px" value="'+(w.symSize||5)+'" title="Größe">')
        +row('Linienbreite','<input id="pLw" type="number" step="0.5" value="'+(w.lw||2)+'">')
        +row('Balken-Rundung','<input id="pBr" type="number" value="'+(w.barRadius!=null?w.barRadius:3)+'">')
        +row('Flächen-Verlauf','<input type="checkbox" id="pGrad"'+(w.grad?' checked':'')+'>')
        +row('Legende','<input type="checkbox" id="pLeg"'+(w.legend?' checked':'')+'>')
        +(w.legend?row('Legende-Pos','<select id="pLegPos"><option value="top"'+((w.legPos||'top')==='top'?' selected':'')+'>oben</option><option value="bottom"'+(w.legPos==='bottom'?' selected':'')+'>unten</option><option value="left"'+(w.legPos==='left'?' selected':'')+'>links</option><option value="right"'+(w.legPos==='right'?' selected':'')+'>rechts</option></select>'):'')
        +row('Y-Raster','<input type="checkbox" id="pYg"'+(w.ygrid!==false?' checked':'')+'>')
        +row('Datenlabels','<input type="checkbox" id="pDl"'+(w.labels?' checked':'')+'>')
        +row('Y Min/Max','<input id="pYmin" type="number" style="width:56px" value="'+(w.ymin!=null?w.ymin:'')+'" placeholder="min"> <input id="pYmax" type="number" style="width:56px" value="'+(w.ymax!=null?w.ymax:'')+'" placeholder="max">')
        +row('Stapeln','<input type="checkbox" id="pStack"'+(w.stack?' checked':'')+'>')
        +row('Zoom/Scroll','<input type="checkbox" id="pZoom"'+(w.zoom?' checked':'')+'>')
        +row('Extrema (Max/Min)','<input type="checkbox" id="pExtr"'+(w.extrema?' checked':'')+'>')
        +row('Perioden-Navigation','<input type="checkbox" id="pPnav"'+(w.pnav?' checked':'')+'>')
        +'<div class="pgh">Vergleich (Zeitversatz)</div>'
        +row('Aktiv','<input type="checkbox" id="pCmpOn"'+(w.cmpOn?' checked':'')+'>')
        +(w.cmpOn?(row('Versatz',offSel('pCmpOff',w.cmpOff))+row('Schatten %','<input id="pCmpShade" type="number" min="0" max="90" value="'+(w.cmpShade!=null?w.cmpShade:55)+'">')):'')
      ):'')
      +(w.type==='chart'?seriesEditor(w):'');},
    wire:function(w){
      function reChart(){if(_ec[w.id])renderChartData(w);commit();}
      if($('#pCType'))$('#pCType').onchange=function(){w.ctype=this.value;reChart();};
      if($('#pSmooth'))$('#pSmooth').onchange=function(){w.smooth=this.checked;reChart();};
      if($('#pSym'))$('#pSym').onchange=function(){w.symbols=this.checked;reChart();};
      if($('#pSymS'))$('#pSymS').oninput=function(){w.symSize=parseFloat(this.value)||5;reChart();};
      if($('#pLw'))$('#pLw').oninput=function(){w.lw=parseFloat(this.value)||2;reChart();};
      if($('#pBr'))$('#pBr').oninput=function(){w.barRadius=parseFloat(this.value)||0;reChart();};
      if($('#pGrad'))$('#pGrad').onchange=function(){w.grad=this.checked;reChart();};
      if($('#pLeg'))$('#pLeg').onchange=function(){w.legend=this.checked;renderProps();reChart();};
      if($('#pLegPos'))$('#pLegPos').onchange=function(){w.legPos=this.value;reChart();};
      if($('#pYg'))$('#pYg').onchange=function(){w.ygrid=this.checked;reChart();};
      if($('#pDl'))$('#pDl').onchange=function(){w.labels=this.checked;reChart();};
      if($('#pYmin'))$('#pYmin').oninput=function(){w.ymin=this.value===''?undefined:parseFloat(this.value);reChart();};
      if($('#pYmax'))$('#pYmax').oninput=function(){w.ymax=this.value===''?undefined:parseFloat(this.value);reChart();};
      if($('#pStack'))$('#pStack').onchange=function(){w.stack=this.checked;reChart();};
      if($('#pZoom'))$('#pZoom').onchange=function(){w.zoom=this.checked;reChart();};
      if($('#pExtr'))$('#pExtr').onchange=function(){w.extrema=this.checked||undefined;reChart();};
      if($('#pPnav'))$('#pPnav').onchange=function(){w.pnav=this.checked||undefined;render();commit();};
      $$('#props [data-sopt]').forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.getAttribute('data-sopt').split('.'),k=pr[0],ix=parseInt(pr[1]);w.sopt=w.sopt||[];w.sopt[ix]=w.sopt[ix]||{};w.sopt[ix][k]=(k==='axis'?parseInt(inp.value):inp.value);if(_ec[w.id])renderChartData(w);commit();};});
    },
    live:function(w,el,id,d,base,txt,on){if((w.ctype==='pie'||w.ctype==='donut'||w.ctype==='rose')&&_ec[w.id])setPie(w);}
  });
