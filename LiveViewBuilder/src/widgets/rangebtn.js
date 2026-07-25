  // ===== Widget: Stepper (rangebtn) — +/− schreibt Variable; Tipp = 1 Schritt, Halten = kontinuierlich =====
  var _rbT=null;
  function _rbStop(){if(_rbT){clearTimeout(_rbT.d);clearInterval(_rbT.i);_rbT=null;}}
  if(!window._rbWired){window._rbWired=1;
    document.addEventListener('pointerdown',function(e){
      if(mode==='edit')return;
      var b=e.target.closest?e.target.closest('[data-role=inc],[data-role=dec]'):null;if(!b)return;
      var el=b.closest('.w');if(!el)return;var w=widget(el.dataset.id);if(!w||w.type!=='rangebtn'||!w.varId)return;
      var inc=b.getAttribute('data-role')==='inc';
      function step(){var lv=_lastVals[w.varId],cur=lv?parseFloat(String(lv.v).replace(',','.')):0;if(isNaN(cur))cur=0;var st=w.step||1,mn=(w.min!=null?w.min:-1e12),mx=(w.max!=null?w.max:1e12),nv=Math.max(mn,Math.min(mx,cur+(inc?st:-st)));setVar(w.varId,Math.round(nv*1000)/1000);}
      step();_rbStop();
      var d=setTimeout(function(){var i=setInterval(step,200);_rbT={d:null,i:i};},420);_rbT={d:d,i:null};
      try{b.setPointerCapture(e.pointerId);}catch(_){}
      e.preventDefault();e.stopPropagation();
    },true);
    document.addEventListener('pointerup',_rbStop);
    document.addEventListener('pointercancel',_rbStop);
  }
  defWidget('rangebtn',{
    label:'Stepper', paletteIcon:'wslider', size:[160,64],
    defaults:function(w){w.step=1;w.min=0;w.max=100;w.label='Wert';},
    render:function(w){
      function btn(role,ic){return '<button data-role="'+role+'" style="width:34px;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center;touch-action:none"><svg class="i" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><use href="#ic-'+ic+'"/></svg></button>';}
      return '<div style="height:100%;display:flex;align-items:center;gap:8px;padding:6px 10px">'+btn('dec','minus')+'<div style="flex:1;text-align:center;min-width:0"><div data-role="val" style="font-family:var(--fm);font-variant-numeric:tabular-nums;font-size:20px;font-weight:600;line-height:1">–</div>'+(w.label?'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+esc(w.label)+'</div>':'')+'</div>'+btn('inc','plus')+'</div>';},
    props:function(w){return row('Schritt','<input id="pRbStep" type="number" step="0.1" value="'+(w.step||1)+'">')
      +row('Min/Max','<input id="pRbMin" type="number" style="width:60px" value="'+(w.min!=null?w.min:0)+'"> <input id="pRbMax" type="number" style="width:60px" value="'+(w.max!=null?w.max:100)+'">');},
    wire:function(w){
      if($('#pRbStep'))$('#pRbStep').oninput=function(){w.step=parseFloat(this.value)||1;};
      if($('#pRbMin'))$('#pRbMin').oninput=function(){var v=parseFloat(this.value);w.min=isNaN(v)?undefined:v;};
      if($('#pRbMax'))$('#pRbMax').oninput=function(){var v=parseFloat(this.value);w.max=isNaN(v)?undefined:v;};
    },
    live:function(w,el,id,d,base,txt,on){var v=$('[data-role=val]',el);if(v)v.textContent=txt;}
  });
