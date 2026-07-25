  // ===== Widget: Info-Liste =====
  defWidget('infolist',{
    label:'Info-Liste', paletteIcon:'wlist', size:[260,180],
    defaults:function(w){w.items=[{icon:'washer',label:'Waschmaschine',sub:'Restzeit 0:42',pill:'läuft',state:'on'},{icon:'dryer',label:'Trockner',sub:'bereit',pill:'aus',state:'off'},{icon:'car',label:'BMW',sub:'Reichweite 213 km',value:'64 %'}];},
    render:function(w){return '<div class="hinfos">'+(w.items||[]).map(function(r){var rt=r.pill?'<span class="hpill '+esc(r.state||'ok')+'"><span class="hpd"></span>'+esc(r.pill)+'</span>':'<span class="hiv"'+(r.vid?' data-vid="'+r.vid+'"':'')+'>'+esc(r.value||'')+'</span>';return '<div class="hinfo"><span class="hibi">'+iconSVG(r.icon||'sensor')+'</span><span class="hin">'+esc(r.label||'')+(r.sub?'<small>'+esc(r.sub)+'</small>':'')+'</span>'+rt+'</div>';}).join('')+'</div>';},
    props:function(w){return (w.type==='infolist'?listEditor(w,'items','Zeile: Icon · Name · Zusatz · Wert · Pill · Status · VarID',[{k:'icon',ph:'icon'},{k:'label',ph:'Name'},{k:'sub',ph:'Zusatz'},{k:'value',ph:'Wert'},{k:'pill',ph:'Pill'},{k:'state',ph:'Status'},{k:'vid',ph:'ID'}]):'');}
  });
