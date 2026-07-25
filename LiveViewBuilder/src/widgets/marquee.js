  // ===== Widget: Lauftext (marquee) — Wert als horizontal wandernder Lauftext =====
  defWidget('marquee',{
    label:'Lauftext', paletteIcon:'meter', size:[220,64],
    defaults:function(w){w.mqSpeed=12;},
    render:function(w){
      var an='mq'+w.id, sp=(w.mqSpeed>0?w.mqSpeed:12);
      var pre=esc(w.mqPre||''), suf=esc(w.mqSuf||'');
      return '<style>@keyframes '+an+'{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}</style>'
        +'<div style="position:absolute;inset:0;display:flex;align-items:center;overflow:hidden;background:var(--surface);border-radius:10px;padding:0 2px">'
        +'<div style="white-space:nowrap;will-change:transform;animation:'+an+' '+sp+'s linear infinite;font-family:var(--fm);font-variant-numeric:tabular-nums;font-weight:600;color:var(--text)">'
        +'<span data-role="pre" style="color:var(--muted)">'+pre+'</span>'
        +'<span data-role="val">–</span>'
        +'<span data-role="suf" style="color:var(--muted)">'+suf+'</span>'
        +'</div></div>';
    },
    props:function(w){return row('Tempo (s/Durchlauf)','<input id="pMqSpeed" type="number" min="1" step="1" value="'+(w.mqSpeed>0?w.mqSpeed:12)+'">')
      +row('Präfix','<input id="pMqPre" value="'+esc(w.mqPre||'')+'" placeholder="z. B. ~">')
      +row('Suffix','<input id="pMqSuf" value="'+esc(w.mqSuf||'')+'" placeholder="z. B. °C">');},
    wire:function(w){
      function relive(){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
      if($('#pMqSpeed'))$('#pMqSpeed').oninput=function(){var v=parseFloat(this.value);w.mqSpeed=(isNaN(v)||v<=0)?12:v;render();};
      if($('#pMqPre'))$('#pMqPre').oninput=function(){w.mqPre=this.value||undefined;var p=$('[data-role=pre]',canvas);if(p)p.textContent=this.value||'';relive();};
      if($('#pMqSuf'))$('#pMqSuf').oninput=function(){w.mqSuf=this.value||undefined;var s=$('[data-role=suf]',canvas);if(s)s.textContent=this.value||'';relive();};
    },
    live:function(w,el,id,d,base,txt,on){
      var p=$('[data-role=pre]',el);if(p)p.textContent=w.mqPre||'';
      var s=$('[data-role=suf]',el);if(s)s.textContent=w.mqSuf||'';
      var v=$('[data-role=val]',el);if(v)v.textContent=txt;
    }
  });
