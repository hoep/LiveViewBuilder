// Widget: statusgrid (Status-Grid)
defWidget('statusgrid',{
  label:'Status-Grid',
  paletteIcon:'wgrid',
  size:[300,150],
  defaults:function(w){
    w.items=[{icon:'window',label:'Fenster',state:'warn',text:'2 offen'},{icon:'door',label:'Eingang',state:'ok',text:'zu'},{icon:'lock',label:'Heizraum',state:'ok',text:'zu'},{icon:'garage',label:'Garage',state:'off',text:'zu'}];
  },
  render:function(w){return '<div class="hsgrid">'+(w.items||[]).map(function(r){return '<div class="hsrow">'+(r.icon?'<span class="hsic">'+iconSVG(r.icon)+'</span>':'')+'<span class="hsn">'+esc(r.label||'')+'</span><span class="hpill '+esc(r.state||'ok')+'"><span class="hpd"></span>'+esc(r.text||'')+'</span></div>';}).join('')+'</div>';},
  props:function(w){return (w.type==='statusgrid'?listEditor(w,'items','Zeilen: Icon · Name · Status · Text',[{k:'icon',ph:'icon'},{k:'label',ph:'Name'},{k:'state',ph:'ok/warn/off'},{k:'text',ph:'Text'}]):'');}
});
