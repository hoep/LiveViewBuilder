  // ===== Widget: RGB-Box (rgbbox) — Live-Farbfläche einer RGB-Integer-Variable, öffnet optional Popup =====
  defWidget('rgbbox',{
    label:'RGB-Box', paletteIcon:'wshape', size:[120,120],
    render:function(w){return '<div style="position:absolute;inset:0;padding:8px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px"><div data-role="sw" style="flex:1;border-radius:9px;border:1px solid var(--line);background:#333;min-height:20px;cursor:pointer"></div>'+(w.label?'<div style="font-size:11px;color:var(--muted);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(w.label)+'</div>':'')+'</div>';},
    props:function(w){return row('Variable','<input id="pRbxVar" value="'+(w.varId||'')+'" placeholder="RGB-Integer-ID"> <button class="btn" id="pRbxPick" style="padding:6px 8px">wählen</button>')
      +row('Popup öffnen','<select id="pRbxPop"><option value="">—</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.popupTo===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>');},
    wire:function(w){
      if($('#pRbxVar'))$('#pRbxVar').onchange=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pRbxPick'))$('#pRbxPick').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pRbxPop'))$('#pRbxPop').onchange=function(){w.popupTo=this.value||undefined;commit();};
    },
    live:function(w,el,id,d,base,txt,on){var sw=$('[data-role=sw]',el);if(sw){var n=parseInt(d.v)||0;sw.style.background='#'+('000000'+(n&0xFFFFFF).toString(16)).slice(-6);}}
  });
