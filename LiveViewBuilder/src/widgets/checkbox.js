  // ===== Widget: Checkbox — bool anzeigen/schalten, optional nur Anzeige =====
  defWidget('checkbox',{
    label:'Checkbox', cat:'Steuerung', paletteIcon:'check', size:[160,44],
    // Kaestchen an der Kachelhoehe (cqh) statt fester 20px: in einer schmalen Zeile bleibt es
    // bedienbar, auf einer grossen Kachel wird es nicht albern klein. Rahmenstaerke bleibt fest.
    render:function(w){return '<div style="height:100%;display:flex;align-items:center;gap:clamp(6px,4cqmin,12px);padding:0 clamp(8px,5cqmin,16px)"><span data-role="cbx" style="width:clamp(15px,26cqh,30px);height:clamp(15px,26cqh,30px);border-radius:clamp(4px,6cqh,8px);border:2px solid var(--line);flex:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box"></span><span style="font-size:var(--wf-lbl);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escL(w.label||'')+'</span></div>';},
    props:function(w){return row('Nur Anzeige','<input type="checkbox" id="pCbRo"'+(w.readonly?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">nicht schaltbar</span>');},
    wire:function(w){if($('#pCbRo'))$('#pCbRo').onchange=function(){w.readonly=this.checked||undefined;};},
    // Haken als Prozent des Kaestchens (nicht cqmin), weil er IM Kaestchen sitzt und dessen
    // Groesse folgen soll; 66 % entspricht dem bisherigen Verhaeltnis 13 px auf 20 px.
    live:function(w,el,id,d,base,txt,on){var b=$('[data-role=cbx]',el);if(b){b.style.background=on?'var(--accent)':'';b.style.borderColor=on?'var(--accent)':'var(--line)';b.innerHTML=on?'<svg style="width:66%;height:66%;fill:none;stroke:var(--accent-ink,#052e28);stroke-width:3;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-check"/></svg>':'';}},
    click:function(w,el,e){if(w.readonly||!w.varId)return false;var lv=_lastVals[w.varId],cur=lv?(lv.v===true||lv.v===1||lv.v==='1'):false;setVar(w.varId,cur?0:1);return true;}
  });
