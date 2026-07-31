  // ===== Widget: Text — statische Textzeile =====
  defWidget('text',{
    label:'Text', paletteIcon:'wcode', size:[200,48],
    render:function(w){return '<div class="wt"><div class="t">'+escL(w.label||'Text')+'</div></div>';}
  });
