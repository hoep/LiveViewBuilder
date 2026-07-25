// webview widget
defWidget('webview',{
  label:'WebView',
  paletteIcon:'wifi',
  size:[320,240],
  defaults:function(w){w.url='';},
  render:function(w){return w.url?'<iframe src="'+esc(w.url)+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>':'<div class="hwvph">WebView — URL in den Eigenschaften setzen</div>';},
  props:function(w){return (w.type==='webview'?row('URL','<input id="pUrl" value="'+esc(w.url||'')+'" placeholder="https://…">'):'');},
  wire:function(w){if($('#pUrl'))$('#pUrl').oninput=function(){w.url=this.value;render();};}
});
