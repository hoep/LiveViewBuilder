  // ===== Widget: Checkbox — bool anzeigen/schalten, optional nur Anzeige =====
  defWidget('checkbox',{
    label:'Checkbox', paletteIcon:'check', size:[160,44],
    render:function(w){return '<div style="height:100%;display:flex;align-items:center;gap:9px;padding:0 12px"><span data-role="cbx" style="width:20px;height:20px;border-radius:5px;border:2px solid var(--line);flex:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box"></span><span style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(w.label||'')+'</span></div>';},
    props:function(w){return row('Nur Anzeige','<input type="checkbox" id="pCbRo"'+(w.readonly?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">nicht schaltbar</span>');},
    wire:function(w){if($('#pCbRo'))$('#pCbRo').onchange=function(){w.readonly=this.checked||undefined;};},
    live:function(w,el,id,d,base,txt,on){var b=$('[data-role=cbx]',el);if(b){b.style.background=on?'var(--accent)':'';b.style.borderColor=on?'var(--accent)':'var(--line)';b.innerHTML=on?'<svg style="width:13px;height:13px;fill:none;stroke:var(--accent-ink,#052e28);stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-check"/></svg>':'';}},
    click:function(w,el,e){if(w.readonly||!w.varId)return false;var lv=_lastVals[w.varId],cur=lv?(lv.v===true||lv.v===1||lv.v==='1'):false;setVar(w.varId,cur?0:1);return true;}
  });
