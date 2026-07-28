  // ===== Widget: Sankey — Flussdiagramm (ECharts) =====
  defWidget('sankey',{
    label:'Sankey', paletteIcon:'wsankey', size:[360,220],
    defaults:function(w){w.links=[{from:'PV',to:'Haus',vid:0},{from:'Netz',to:'Haus',vid:0},{from:'Haus',to:'EG',vid:0},{from:'Haus',to:'Einspeisung',vid:0}];},
    render:function(w){return '<div data-role="chart"></div>';},
    props:function(w){return listEditor(w,'links','Flüsse: von · nach · Variablen-ID',[{k:'from',ph:'von'},{k:'to',ph:'nach'},{k:'vid',ph:'ID'}]);},
    live:function(w,el,id,d,base,txt,on){if((w.links||[]).some(function(l){return l.vid===id;}))setSankey(w);return;}
  });
