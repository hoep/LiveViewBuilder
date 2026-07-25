  // ===== Widget: Status-Bild (statusimage) — Media-Bild je Zustand =====
  defWidget('statusimage',{
    label:'Status-Bild', paletteIcon:'wimage', size:[64,64],
    defaults:function(w){w.states=[{value:0,mediaId:0},{value:1,mediaId:0}];},
    render:function(w){var s0=(w.states&&w.states[0])||{},init=(w.mediaId||s0.mediaId||0);return '<div class="hsimg"><img data-role="simg" alt="'+esc(w.label||'')+'" src="'+(init?('?api=media&id='+init):'')+'">'+(w.label?'<span class="hsimlbl">'+esc(w.label)+'</span>':'')+'</div>';},
    props:function(w){return row('Media (Fallback)','<input id="pMedia2" value="'+(w.mediaId||'')+'" placeholder="Media-ID">')
      +listEditor(w,'states','Zustände: Wert · Media-ID',[{k:'value',ph:'Wert'},{k:'mediaId',ph:'Media-ID'}]);},
    wire:function(w){if($('#pMedia2'))$('#pMedia2').onchange=function(){w.mediaId=parseInt(this.value)||0;render();};},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){var si=$('[data-role=simg]',el);if(si){var mid=w.mediaId||0;(w.states||[]).forEach(function(s){if(String(s.value)===String(d.v))mid=s.mediaId;});si.src=mid?('?api=media&id='+mid):'';}}}
  });
