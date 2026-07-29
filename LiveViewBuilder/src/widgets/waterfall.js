  // waterfall — Wasserfall-Diagramm (nicht zeitbasiert, ECharts).
  // Schritte: Titel (x-Achse) · Variable (Symcon-ID) · Typ · Farbe.
  // Typ: start | auf (+) | ab (−) | sub (Zwischensumme, berechnet) | sum (Summe, berechnet).
  defWidget('waterfall',{
    label:'Wasserfall',
    paletteIcon:'wchart',
    size:[360,220],
    defaults:function(w){
      w.label='';
      w.steps=[
        {title:'Start',   vid:0, type:'start', color:'info'},
        {title:'Zunahme', vid:0, type:'auf',   color:'ok'},
        {title:'Abnahme', vid:0, type:'ab',    color:'crit'},
        {title:'Summe',   vid:0, type:'sum',   color:'accent'}
      ];
      w.labels=true;
    },
    render:function(w){return '<div data-role="chart" style="position:absolute;inset:0"></div>';},
    props:function(w){
      return listEditor(w,'steps','Schritte: Titel · Variable · Typ · Farbe',[
          {k:'title',ph:'Titel'},
          {k:'vid',ph:'ID'},
          {k:'type',type:'select',def:'auf',options:[['start','Start'],['auf','Auf (+)'],['ab','Ab (−)'],['sub','Zwischensumme'],['sum','Summe']]},
          {k:'color',type:'skincolor'}
        ])
        +'<div class="pgh">Optionen</div>'
        +row('Y-Einheit','<input id="pWfUnit" value="'+esc(w.yunit||'')+'" style="width:80px" placeholder="z. B. €">')
        +row('Datenlabels','<input type="checkbox" id="pWfLbl"'+(w.labels?' checked':'')+'>')
        +row('Verbindungslinien','<input type="checkbox" id="pWfConn"'+(w.wfConnect!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">gestrichelt, zwischen den Balken</span>')
        +row('Balken-Rundung','<input id="pWfBr" type="number" value="'+(w.barRadius!=null?w.barRadius:3)+'">')
        +row('Fallback Auf',skinSel(w.wfUp||'ok','id="pWfUp"'))+row('Fallback Ab',skinSel(w.wfDown||'crit','id="pWfDn"'))
        +'<div class="pgh">Achsen & Raster</div>'
        +row('Titel anzeigen','<input type="checkbox" id="pWfT"'+(w.showTitle?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Label als Titel</span>')
        +row('Y-Beschriftung','<input type="checkbox" id="pWfYL"'+(w.yLabels!==false?' checked':'')+'>')
        +row('X-Beschriftung','<input type="checkbox" id="pWfXL"'+(w.xLabels!==false?' checked':'')+'>')
        +row('Hilfslinien','<input type="checkbox" id="pWfYg"'+(w.ygrid!==false?' checked':'')+'>')
        +row('Achslinien','<input type="checkbox" id="pWfAx"'+(w.axLine?' checked':'')+'>')
        +row('Tickmarks','<input type="checkbox" id="pWfTk"'+(w.axTicks?' checked':'')+'>');
    },
    wire:function(w){
      if($('#pWfUnit'))$('#pWfUnit').oninput=function(){w.yunit=this.value;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfLbl'))$('#pWfLbl').onchange=function(){w.labels=this.checked;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfConn'))$('#pWfConn').onchange=function(){w.wfConnect=this.checked?undefined:false;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfBr'))$('#pWfBr').oninput=function(){w.barRadius=parseFloat(this.value)||0;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfUp'))$('#pWfUp').oninput=function(){w.wfUp=this.value;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfDn'))$('#pWfDn').oninput=function(){w.wfDown=this.value;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfT'))$('#pWfT').onchange=function(){w.showTitle=this.checked||undefined;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfYL'))$('#pWfYL').onchange=function(){w.yLabels=this.checked;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfXL'))$('#pWfXL').onchange=function(){w.xLabels=this.checked;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfYg'))$('#pWfYg').onchange=function(){w.ygrid=this.checked;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfAx'))$('#pWfAx').onchange=function(){w.axLine=this.checked||undefined;if(_ec[w.id])setWaterfall(w);commit();};
      if($('#pWfTk'))$('#pWfTk').onchange=function(){w.axTicks=this.checked||undefined;if(_ec[w.id])setWaterfall(w);commit();};
    },
    live:function(w,el,id,d,base,txt,on){if((w.steps||[]).some(function(s){return s.vid===id;}))setWaterfall(w);}
  });
