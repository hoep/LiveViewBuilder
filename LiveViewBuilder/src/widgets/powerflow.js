  // powerflow — migriert aus Kern (02-zoom-core.js render, 04-props.js props/defaults, size/paletteIcon/label aus Maps)
  defWidget('powerflow',{
    label:'Power-Flow',
    paletteIcon:'wsankey',
    size:[420,240],
    defaults:function(w){w.src=[{label:'PV',vid:0},{label:'Netz',vid:0}];w.snk=[{label:'EG',vid:0},{label:'DG',vid:0},{label:'Einspeisung',vid:0}];},
    render:function(w){return powerflowSVG(w);},
    props:function(w){return listEditor(w,'src','Quellen: Name · ID',[{k:'label',ph:'Name'},{k:'vid',ph:'ID'}])+listEditor(w,'snk','Senken: Name · ID',[{k:'label',ph:'Name'},{k:'vid',ph:'ID'}]);}
  });
