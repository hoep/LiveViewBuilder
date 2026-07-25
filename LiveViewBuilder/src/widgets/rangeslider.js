  // ===== Widget: RangeSlider — horizontaler Regler mit ZWEI Griffen (unterer/oberer Wert) =====
  // varId = unterer Wert (lo), varId2 = oberer Wert (hi). Eigene Skala: rsMin/rsMax/rsStep.
  function _rsMin(w){return (w&&w.rsMin!=null)?w.rsMin:0;}
  function _rsMax(w){return (w&&w.rsMax!=null)?w.rsMax:100;}
  function _rsStep(w){var s=(w&&w.rsStep!=null)?w.rsStep:1;return (s>0)?s:1;}
  function _rsClamp(v,a,b){return v<a?a:(v>b?b:v);}
  function _rsFmt(v){return String(Math.round(v*1000)/1000);}
  function _rsFrac(w,val){var mn=_rsMin(w),mx=_rsMax(w),sp=(mx-mn)||1;return _rsClamp((val-mn)/sp,0,1);}
  function _rsVal(w,frac){var mn=_rsMin(w),mx=_rsMax(w),st=_rsStep(w);var v=mn+_rsClamp(frac,0,1)*(mx-mn);v=Math.round(v/st)*st;v=_rsClamp(v,mn,mx);return Math.round(v*1000)/1000;}
  function _rsCur(w,id,fb){if(!id)return fb;var lv=_lastVals[id];if(!lv)return fb;var n=parseFloat(String(lv.v).replace(',','.'));return isNaN(n)?fb:n;}
  function _rsApply(w,el,loO,hiO){
    var mn=_rsMin(w),mx=_rsMax(w);
    var loV=(loO!=null)?loO:_rsCur(w,w.varId,mn);
    var hiV=(hiO!=null)?hiO:_rsCur(w,w.varId2,mx);
    loV=_rsClamp(loV,mn,mx);hiV=_rsClamp(hiV,mn,mx);
    var lf=_rsFrac(w,loV)*100,hf=_rsFrac(w,hiV)*100;
    var tl=$('[data-role=lo]',el);if(tl)tl.style.left=lf+'%';
    var th=$('[data-role=hi]',el);if(th)th.style.left=hf+'%';
    var fl=$('[data-role=fill]',el);if(fl){var a=Math.min(lf,hf),b=Math.max(lf,hf);fl.style.left=a+'%';fl.style.right=(100-b)+'%';}
    var vl=$('[data-role=vlo]',el);if(vl)vl.textContent=_rsFmt(loV);
    var vh=$('[data-role=vhi]',el);if(vh)vh.textContent=_rsFmt(hiV);
  }

  // Pointer-Interaktion (einmalig, dokumentweit; nur in Run/Preview)
  var _rsDrag=null;
  if(!window._rsWired){window._rsWired=1;
    document.addEventListener('pointerdown',function(e){
      if(mode==='edit')return;
      var th=e.target.closest?e.target.closest('[data-rs-thumb]'):null;if(!th)return;
      var el=th.closest('.w');if(!el)return;var w=widget(el.dataset.id);if(!w||w.type!=='rangeslider')return;
      _rsDrag={w:w,el:el,role:th.getAttribute('data-role'),rail:th.parentNode,last:0,pid:null,pval:null};
      try{th.setPointerCapture(e.pointerId);}catch(_){}
      e.preventDefault();e.stopPropagation();
    },true);
    document.addEventListener('pointermove',function(e){
      if(!_rsDrag)return;var d=_rsDrag,w=d.w;
      var rect=d.rail.getBoundingClientRect();if(!rect.width)return;
      var val=_rsVal(w,(e.clientX-rect.left)/rect.width),mn=_rsMin(w),mx=_rsMax(w);
      if(d.role==='lo'){var hv=_rsCur(w,w.varId2,mx);if(val>hv)val=hv;d.pid=w.varId;d.pval=val;_rsApply(w,d.el,val,null);}
      else{var lv=_rsCur(w,w.varId,mn);if(val<lv)val=lv;d.pid=w.varId2;d.pval=val;_rsApply(w,d.el,null,val);}
      var now=Date.now();if(d.pid&&now-d.last>=110){d.last=now;setVar(d.pid,d.pval);}
      e.preventDefault();
    });
    function _rsEnd(){if(!_rsDrag)return;var d=_rsDrag;_rsDrag=null;if(d.pid&&d.pval!=null)setVar(d.pid,d.pval);}
    document.addEventListener('pointerup',_rsEnd);
    document.addEventListener('pointercancel',_rsEnd);
  }

  defWidget('rangeslider',{
    label:'RangeSlider', paletteIcon:'wslider', size:[240,72],
    defaults:function(w){w.rsMin=0;w.rsMax=100;w.rsStep=1;w.label='Bereich';},
    render:function(w){
      var mn=_rsMin(w),mx=_rsMax(w);
      var loV=_rsClamp(_rsCur(w,w.varId,mn),mn,mx),hiV=_rsClamp(_rsCur(w,w.varId2,mx),mn,mx);
      var lf=_rsFrac(w,loV)*100,hf=_rsFrac(w,hiV)*100,a=Math.min(lf,hf),b=Math.max(lf,hf);
      var lbl=w.label?'<span style="color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">'+esc(w.label)+'</span>':'<span></span>';
      var head='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">'+lbl+'<span style="font-family:var(--fm);font-variant-numeric:tabular-nums;font-size:13px;color:var(--text);white-space:nowrap"><b data-role="vlo">'+_rsFmt(loV)+'</b><span style="color:var(--muted)"> – </span><b data-role="vhi">'+_rsFmt(hiV)+'</b></span></div>';
      function thumb(role,left){return '<div data-role="'+role+'" data-rs-thumb="1" style="position:absolute;top:50%;left:'+left+'%;width:22px;height:22px;transform:translate(-50%,-50%);border-radius:50%;background:var(--surface);border:2px solid var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:grab;touch-action:none;z-index:2"></div>';}
      var rail='<div data-role="rail" style="position:absolute;left:11px;right:11px;top:50%;transform:translateY(-50%);height:5px;border-radius:3px;background:var(--surface-2)">'
        +'<div data-role="fill" style="position:absolute;top:0;bottom:0;left:'+a+'%;right:'+(100-b)+'%;background:var(--accent);border-radius:3px"></div>'
        +thumb('lo',lf)+thumb('hi',hf)+'</div>';
      return '<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8px 12px;box-sizing:border-box">'+head
        +'<div style="position:relative;height:22px">'+rail+'</div></div>';
    },
    props:function(w){
      return row('Unten (Var)','<input id="pRsVar" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pRsPick" style="padding:6px 8px">wählen</button>')
        +row('Oben (Var)','<input id="pRsVar2" value="'+(w.varId2||'')+'" placeholder="ID"> <button class="btn" id="pRsPick2" style="padding:6px 8px">wählen</button>')
        +row('Beschriftung','<input id="pRsLbl" value="'+esc(w.label||'')+'" placeholder="z. B. Bereich">')
        +row('Min/Max','<input id="pRsMin" type="number" style="width:60px" value="'+_rsMin(w)+'"> <input id="pRsMax" type="number" style="width:60px" value="'+_rsMax(w)+'">')
        +row('Schritt','<input id="pRsStep" type="number" step="0.1" value="'+_rsStep(w)+'">');
    },
    wire:function(w){
      if($('#pRsVar'))$('#pRsVar').oninput=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pRsPick'))$('#pRsPick').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pRsVar2'))$('#pRsVar2').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pRsPick2'))$('#pRsPick2').onclick=function(){showTab('vars');_bindTarget2=w.id;};
      if($('#pRsLbl'))$('#pRsLbl').oninput=function(){w.label=this.value||'';render();};
      if($('#pRsMin'))$('#pRsMin').oninput=function(){var v=parseFloat(this.value);w.rsMin=isNaN(v)?0:v;render();};
      if($('#pRsMax'))$('#pRsMax').oninput=function(){var v=parseFloat(this.value);w.rsMax=isNaN(v)?100:v;render();};
      if($('#pRsStep'))$('#pRsStep').oninput=function(){var v=parseFloat(this.value);w.rsStep=(isNaN(v)||v<=0)?1:v;render();};
    },
    live:function(w,el,id,d,base,txt,on){
      if(_rsDrag&&_rsDrag.el===el)return; // nicht während des Ziehens überschreiben
      if(id!==w.varId&&id!==w.varId2)return;
      _rsApply(w,el);
    }
  });
