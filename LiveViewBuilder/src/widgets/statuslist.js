// statuslist widget
defWidget('statuslist',{
  label:'Status-Liste',
  paletteIcon:'wlist',
  size:[220,160],
  defaults:function(w){w.rows=[{label:'Dienst 1',vid:0},{label:'Dienst 2',vid:0}];},
  render:function(w){return '<div class="hlist">'+(w.rows||[]).map(function(r){return '<div class="hlrowi"><span class="stdot"'+(r.vid?' data-viddot="'+r.vid+'"':'')+'></span><span class="hlnm">'+esc(r.label||'')+'</span></div>';}).join('')+'</div>';},
  props:function(w){return (w.type==='statuslist'?listEditor(w,'rows','Zeilen: Name · Status-ID',[{k:'label',ph:'Name'},{k:'vid',ph:'ID'}]):'');}
});
