// devlist — Geräte-Liste
defWidget('devlist',{
  label:'Geräte-Liste',
  paletteIcon:'wlist',
  size:[220,160],
  defaults:function(w){
    w.items=[{label:'Gerät 1',icon:'battery',vid:0},{label:'Gerät 2',icon:'battery',vid:0}];
  },
  render:function(w){
    return '<div class="hlist">'+(w.items||[]).map(function(r){return '<div class="hlrowi"><span class="hlicon">'+iconSVG(r.icon||'battery')+'</span><span class="hlnm">'+esc(r.label||'')+'</span><span class="hlv"'+(r.vid?' data-vid="'+r.vid+'"':'')+'>–</span></div>';}).join('')+'</div>';
  },
  props:function(w){
    return (w.type==='devlist'?listEditor(w,'items','Geräte: Name · Icon · ID',[{k:'label',ph:'Name'},{k:'icon',ph:'Icon'},{k:'vid',ph:'ID'}]):'');
  }
});
