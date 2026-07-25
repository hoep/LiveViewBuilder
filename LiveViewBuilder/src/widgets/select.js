  // ===== Widget: Auswahl (Select) =====
  defWidget('select',{
    label:'Auswahl', paletteIcon:'wselect', size:[220,44],
    defaults:function(w){w.options=[{value:0,text:'Aus',color:''},{value:1,text:'An',color:''}];},
    render:function(w){return '<div class="hsel">'+(w.options||[]).map(function(o){return '<button class="hselb" data-selval="'+esc(String(o.value!=null?o.value:''))+'"'+(o.color?' style="--sc:'+esc(o.color)+'"':'')+'>'+esc(o.text||String(o.value))+'</button>';}).join('')+'</div>';},
    props:function(w){return (w.type==='select'?listEditor(w,'options','Optionen: Wert · Text · Farbe',[{k:'value',ph:'Wert'},{k:'text',ph:'Text'},{k:'color',ph:'#hex'}]):'');},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){$$('.hselb',el).forEach(function(b){b.classList.toggle('on',String(b.getAttribute('data-selval'))===String(d.v));});}}
  });
