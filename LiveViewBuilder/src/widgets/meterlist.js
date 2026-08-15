// Widget: meterlist (Metrik-Liste)
defWidget('meterlist',{
  label:'Metrik-Liste',
  cat:'Anzeige',
  paletteIcon:'wbars',
  size:[320,170],
  defaults:function(w){
    w.items=[{label:'CPU-Last',sub:'IPS',val:'14',unit:'%',pct:14},{label:'USV APC',sub:'Last',val:'31',unit:'%',pct:31},{label:'WAN',sub:'Mbit',val:'118/38',unit:'',pct:70},{label:'Batterien',sub:'Geräte',val:'62',unit:'%',pct:62}];
  },
  render:function(w){return '<div class="hmeters">'+(w.items||[]).map(function(r){return '<div class="hmeter"><div class="hmk">'+esc(r.label||'')+(r.sub?'<span>'+esc(r.sub)+'</span>':'')+'</div><div class="hmv"><span'+(r.vid?' data-vid="'+r.vid+'"'+_slotAttrs(r,true):'')+'>'+esc(r.val||'–')+'</span>'+(r.unit?'<span class="u"> '+esc(r.unit)+'</span>':'')+'</div><div class="hmtr"><i'+(r.vid?' data-vidbar="'+r.vid+'"':'')+' style="width:'+(parseFloat(r.pct)||0)+'%"></i></div></div>';}).join('')+'</div>';},
  props:function(w){return listEditor(w,'items','Metrik: Name · Zusatz · Wert · Einh · % · VarID',[{k:'label',ph:'Name'},{k:'sub',ph:'Zusatz'},{k:'val',ph:'Wert'},{k:'dec',ph:'Dez'},{k:'unit',ph:'Einh'},{k:'pct',ph:'%'},{k:'vid',ph:'ID'}]);}
});
