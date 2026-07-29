  // chart — Chart
  defWidget('chart',{
    label:'Chart',
    paletteIcon:'wchart',
    size:[340,190],
    noHover:true, // interner Perioden-Klick (‹ ›) soll KEINEN Ganz-Widget-Hover erzeugen; Hover nur bei Seite/Popup-Verknuepfung

    render:function(w){return '<div data-role="chart" style="position:absolute;inset:0"></div>'+(w.pnav?'<div style="position:absolute;left:6px;bottom:4px;display:flex;gap:4px;align-items:center;z-index:2"><button data-role="pprev" style="width:22px;height:20px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);border-radius:5px;cursor:pointer;font-size:12px;line-height:1">‹</button><span data-role="plabel" style="font-size:10px;color:var(--muted);min-width:30px;text-align:center">jetzt</span><button data-role="pnext" style="width:22px;height:20px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);border-radius:5px;cursor:pointer;font-size:12px;line-height:1">›</button></div>':'');},
    click:function(w,el,e){var pp=e.target.closest('[data-role=pprev]'),pn=e.target.closest('[data-role=pnext]');if(!pp&&!pn)return false;w._pOff=Math.max(0,(w._pOff||0)+(pp?1:-1));fetchHist(w);return true;},
    props:function(w){
      if(w.type!=='chart')return '';
      var ct=w.ctype||'area',isPart=['pie','donut','rose'].indexOf(ct)>=0,isBar=(ct==='bar'||ct==='barstack'),isScat=(ct==='scatter'),isLine=!isPart&&!isBar&&!isScat;
      var h=row('Chart-Typ','<select id="pCType"><optgroup label="Zeitreihe"><option value="area"'+(ct==='area'?' selected':'')+'>Fläche</option><option value="areaspline"'+(ct==='areaspline'?' selected':'')+'>Fläche glatt (Spline)</option><option value="line"'+(ct==='line'?' selected':'')+'>Linie</option><option value="spline"'+(ct==='spline'?' selected':'')+'>Linie glatt (Spline)</option><option value="step"'+(ct==='step'?' selected':'')+'>Stufen</option><option value="steparea"'+(ct==='steparea'?' selected':'')+'>Stufenfläche</option><option value="bar"'+(ct==='bar'?' selected':'')+'>Balken</option><option value="barstack"'+(ct==='barstack'?' selected':'')+'>Balken gestapelt</option><option value="scatter"'+(ct==='scatter'?' selected':'')+'>Punkte</option></optgroup><optgroup label="Anteile (ohne Zeit)"><option value="pie"'+(ct==='pie'?' selected':'')+'>Kreis (Pie)</option><option value="donut"'+(ct==='donut'?' selected':'')+'>Donut</option><option value="rose"'+(ct==='rose'?' selected':'')+'>Rose (Nightingale)</option></optgroup></select>');
      h+='<div class="pgh">Diagramm-Optionen</div>';
      if(isLine)h+=row('Glätten (Spline)','<input type="checkbox" id="pSmooth"'+(w.smooth!==false?' checked':'')+'>')+row('Punkte','<input type="checkbox" id="pSym"'+(w.symbols?' checked':'')+'> <input id="pSymS" type="number" style="width:52px" value="'+(w.symSize||5)+'" title="Größe">')+row('Linienbreite','<input id="pLw" type="number" step="0.5" value="'+(w.lw||2)+'">')+row('Flächen-Verlauf','<input type="checkbox" id="pGrad"'+(w.grad?' checked':'')+'>');
      if(isScat)h+=row('Punkte-Größe','<input id="pSymS" type="number" style="width:52px" value="'+(w.symSize||7)+'">');
      if(isBar)h+=row('Balken-Rundung','<input id="pBr" type="number" value="'+(w.barRadius!=null?w.barRadius:3)+'">');
      h+=row('Legende','<input type="checkbox" id="pLeg"'+(w.legend?' checked':'')+'>')+(w.legend?row('Legende-Pos','<select id="pLegPos"><option value="top"'+((w.legPos||'top')==='top'?' selected':'')+'>oben</option><option value="bottom"'+(w.legPos==='bottom'?' selected':'')+'>unten</option><option value="left"'+(w.legPos==='left'?' selected':'')+'>links</option><option value="right"'+(w.legPos==='right'?' selected':'')+'>rechts</option></select>'):'')+row('Datenlabels','<input type="checkbox" id="pDl"'+(w.labels?' checked':'')+'>');
      // Titel gilt fuer ALLE Chart-Typen (auch Torte/Donut/Rose) - deshalb ausserhalb des Achsen-Blocks
      var _tOn=(w.showTitle!=null?w.showTitle:(!w.legend&&!!w.label));
      h+='<div class="pgh">Titel</div>'+row('Titel anzeigen','<input type="checkbox" id="pShowT"'+(_tOn?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Label als Titel</span>')
        +(_tOn?row('Titel-Position','<select id="pTitlePos"><option value="left"'+((w.titlePos||'left')==='left'?' selected':'')+'>links</option><option value="center"'+(w.titlePos==='center'?' selected':'')+'>zentriert</option><option value="right"'+(w.titlePos==='right'?' selected':'')+'>rechts</option></select>'+(((w.label||'')==='')?' <span style="font-size:11px;color:var(--warm)">— Label ist leer, es erscheint nichts</span>':'')):'');
      if(!isPart){
        h+='<div class="pgh">Achsen & Raster</div>'+row('Y-Beschriftung','<input type="checkbox" id="pYLab"'+(w.yLabels!==false?' checked':'')+'>')+row('X-Beschriftung','<input type="checkbox" id="pXLab"'+(w.xLabels!==false?' checked':'')+'>')+row('Y-Hilfslinien','<input type="checkbox" id="pYg"'+(w.ygrid!==false?' checked':'')+'>')+row('X-Hilfslinien','<input type="checkbox" id="pXg"'+(w.xgrid?' checked':'')+'>')+row('Achslinien','<input type="checkbox" id="pAxLine"'+(w.axLine?' checked':'')+'>')+row('Tickmarks','<input type="checkbox" id="pAxTicks"'+(w.axTicks?' checked':'')+'>')+row('Raster-Teilung','<input id="pGridDivs" type="number" min="0" style="width:56px" value="'+(w.gridDivs||'')+'" placeholder="auto"> <span style="font-size:11px;color:var(--muted)">Y-Achse: Anzahl</span>');
        if(isBar||isLine)h+=row('Stapeln','<input type="checkbox" id="pStack"'+(w.stack?' checked':'')+'>');
        h+=row('Zoom/Scroll','<input type="checkbox" id="pZoom"'+(w.zoom?' checked':'')+'>')+row('Extrema (Max/Min)','<input type="checkbox" id="pExtr"'+(w.extrema?' checked':'')+'>')+row('Perioden-Navigation','<input type="checkbox" id="pPnav"'+(w.pnav?' checked':'')+'>');
        h+='<div class="pgh">Vergleich (Zeitversatz)</div>'+row('Aktiv','<input type="checkbox" id="pCmpOn"'+(w.cmpOn?' checked':'')+'>')+(w.cmpOn?(row('Versatz',offSel('pCmpOff',w.cmpOff))+row('Schatten %','<input id="pCmpShade" type="number" min="0" max="90" value="'+(w.cmpShade!=null?w.cmpShade:55)+'">')):'');
      }
      h+=seriesEditor(w);
      if(!isPart)h+=axesEditor(w);
      return h;
    },
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
      if($('#pShowT'))$('#pShowT').onchange=function(){w.showTitle=this.checked;reChart();renderProps();};
      if($('#pTitlePos'))$('#pTitlePos').onchange=function(){w.titlePos=this.value;reChart();};
      if($('#pYLab'))$('#pYLab').onchange=function(){w.yLabels=this.checked;reChart();};
      if($('#pXLab'))$('#pXLab').onchange=function(){w.xLabels=this.checked;reChart();};
      if($('#pXg'))$('#pXg').onchange=function(){w.xgrid=this.checked||undefined;reChart();};
      if($('#pAxLine'))$('#pAxLine').onchange=function(){w.axLine=this.checked||undefined;reChart();};
      if($('#pAxTicks'))$('#pAxTicks').onchange=function(){w.axTicks=this.checked||undefined;reChart();};
      if($('#pGridDivs'))$('#pGridDivs').oninput=function(){w.gridDivs=this.value===''?undefined:parseInt(this.value);reChart();};
      if($('#pStack'))$('#pStack').onchange=function(){w.stack=this.checked;reChart();};
      if($('#pZoom'))$('#pZoom').onchange=function(){w.zoom=this.checked;reChart();};
      if($('#pExtr'))$('#pExtr').onchange=function(){w.extrema=this.checked||undefined;reChart();};
      if($('#pPnav'))$('#pPnav').onchange=function(){w.pnav=this.checked||undefined;render();commit();};
      $$('#props [data-sf]').forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.getAttribute('data-sf').split('.'),i=parseInt(pr[0]),k=pr[1];_ensureSeries(w);w.series[i]=w.series[i]||{};w.series[i][k]=(k==='vid'?(parseInt(inp.value)||0):(k==='axis'?parseInt(inp.value):inp.value));delete _hist[w.id];fetchHist(w);commit();if(inp.tagName==='SELECT')renderProps();};});
      $$('#props [data-spick]').forEach(function(b){b.onclick=function(){showTab('vars');toast('Variable im Baum anklicken');_bindSeries={wid:w.id,idx:parseInt(b.getAttribute('data-spick'))};};});
      $$('#props [data-sdel]').forEach(function(b){b.onclick=function(){_ensureSeries(w);w.series.splice(parseInt(b.getAttribute('data-sdel')),1);delete _hist[w.id];renderProps();fetchHist(w);commit();};});
      if($('#props [data-sadd]'))$('#props [data-sadd]').onclick=function(){_ensureSeries(w);w.series.push({vid:0,name:'',color:'',type:'',axis:0});renderProps();commit();};
      $$('#props [data-af]').forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.getAttribute('data-af').split('.'),i=parseInt(pr[0]),k=pr[1];_ensureYAxes(w);w.yAxes[i]=w.yAxes[i]||{};w.yAxes[i][k]=((k==='min'||k==='max')?(inp.value===''?'':parseFloat(inp.value)):inp.value);if(_ec[w.id])renderChartData(w);commit();if(inp.tagName==='SELECT')renderProps();};});
      $$('#props [data-adel]').forEach(function(b){b.onclick=function(){_ensureYAxes(w);w.yAxes.splice(parseInt(b.getAttribute('data-adel')),1);renderProps();if(_ec[w.id])renderChartData(w);commit();};});
      if($('#props [data-aadd]'))$('#props [data-aadd]').onclick=function(){_ensureYAxes(w);w.yAxes.push({side:'R',name:'',min:'',max:''});renderProps();if(_ec[w.id])renderChartData(w);commit();};
    },
    live:function(w,el,id,d,base,txt,on){if(w.ctype==='pie'||w.ctype==='donut'||w.ctype==='rose'){if(_ec[w.id])setPie(w);}else if(_ec[w.id])chartPushRefresh(w);}
  });
