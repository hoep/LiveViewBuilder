  // ===== Widget: Delta — Trend-Chip mit Pfeil, Text und Kennung =====
  defWidget('delta',{
    label:'Delta', paletteIcon:'wdelta', size:[160,88],
    defaults:function(w){w.tone='ok';w.dir='up';w.text='+6 %';w.label='Autarkie';},
    render:function(w){return '<div class="hdelta t-'+(w.tone||'ok')+'" data-role="delroot"><div class="hdmain"><span data-role="arrow">'+(w.dir==='dn'?'▼':(w.dir==='flat'?'→':'▲'))+'</span> <span data-role="val">'+esc(w.text||'')+'</span></div>'+((w.label||w.cmpOn)?'<div class="hdcap" data-role="cap">'+esc(w.label||'')+'</div>':'')+'</div>';},
    props:function(w){return (w.type==='delta'?(row('Text','<input id="pText" value="'+esc(w.text||'')+'" placeholder="+6 %"'+(w.cmpOn?' disabled':'')+'>')+(w.cmpOn?'':row('Richtung',dirSel('pDir',w.dir))+row('Farbe',selOf('pTone',w.tone,['ok','crit','warn','muted'])))):'');},
    wire:function(w){if($('#pText'))$('#pText').oninput=function(){w.text=this.value;render();};if($('#pTone'))$('#pTone').onchange=function(){w.tone=this.value;render();};}
  });
