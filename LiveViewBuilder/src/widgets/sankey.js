  // ===== Widget: Sankey — Flussdiagramm (ECharts) =====
  defWidget('sankey',{
    label:'Sankey', cat:'Diagramme', paletteIcon:'wsankey', size:[360,220],
    defaults:function(w){w.links=[{from:'PV',to:'Haus',vid:0},{from:'Netz',to:'Haus',vid:0},{from:'Haus',to:'EG',vid:0},{from:'Haus',to:'Einspeisung',vid:0}];},
    render:function(w){return '<div data-role="chart"></div>';},
    props:function(w){return row('Knoten-Farbe',skinSel(w.snNode||'accent','id="pSnNode"'))
      +row('Ausrichtung','<select id="pSnOr"><option value="h"'+((w.snOrient||'h')==='h'?' selected':'')+'>horizontal</option><option value="v"'+(w.snOrient==='v'?' selected':'')+'>vertikal</option></select>')
      +row('Beschriftung','<input type="checkbox" id="pSnLab"'+(w.snLabels!==false?' checked':'')+'>')
      +row('Fluss-Wert','<input type="checkbox" id="pSnVal"'+(w.snVal?' checked':'')+'>')
      +row('Deckkraft %','<input id="pSnOp" type="number" min="0" max="100" value="'+(w.snOpacity!=null?w.snOpacity:35)+'">')
      +row('Kurvigkeit %','<input id="pSnCv" type="number" min="0" max="100" value="'+(w.snCurve!=null?w.snCurve:50)+'">')
      +'<div class="pgh">Titel</div>'
      +row('Titel anzeigen','<input type="checkbox" id="pSnT"'+(w.showTitle?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Label als Titel</span>')
      +(w.showTitle?row('Titel-Position','<select id="pSnTP"><option value="left"'+((w.titlePos||'left')==='left'?' selected':'')+'>links</option><option value="center"'+(w.titlePos==='center'?' selected':'')+'>zentriert</option><option value="right"'+(w.titlePos==='right'?' selected':'')+'>rechts</option></select>'+(((w.label||'')==='')?' <span style="font-size:11px;color:var(--warm)">— Label ist leer, es erscheint nichts</span>':'')):'')
      +listEditor(w,'links','Flüsse: von · nach · Variablen-ID',[{k:'from',ph:'von'},{k:'to',ph:'nach'},{k:'vid',ph:'ID'}]);},
    wire:function(w){function re(){if(_ec[w.id])setSankey(w);commit();}
      if($('#pSnNode'))$('#pSnNode').onchange=function(){w.snNode=this.value||undefined;re();};
      if($('#pSnOr'))$('#pSnOr').onchange=function(){w.snOrient=this.value;re();};
      if($('#pSnLab'))$('#pSnLab').onchange=function(){w.snLabels=this.checked;re();};
      if($('#pSnVal'))$('#pSnVal').onchange=function(){w.snVal=this.checked||undefined;re();};
      if($('#pSnOp'))$('#pSnOp').oninput=function(){w.snOpacity=this.value===''?undefined:parseInt(this.value);re();};
      if($('#pSnCv'))$('#pSnCv').oninput=function(){w.snCurve=this.value===''?undefined:parseInt(this.value);re();};
      if($('#pSnT'))$('#pSnT').onchange=function(){w.showTitle=this.checked||undefined;re();renderProps();};
      if($('#pSnTP'))$('#pSnTP').onchange=function(){w.titlePos=this.value;re();};},
    live:function(w,el,id,d,base,txt,on){if((w.links||[]).some(function(l){return l.vid===id;}))setSankey(w);return;}
  });
