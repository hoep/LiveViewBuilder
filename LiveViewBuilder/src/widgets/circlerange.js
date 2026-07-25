  // ===== Widget: CircleRangeSlider — runder Regler mit ZWEI Griffen (unterer/oberer Wert) =====
  function _crMin(w){return (w&&w.crMin!=null)?w.crMin:0;}
  function _crMax(w){return (w&&w.crMax!=null)?w.crMax:100;}
  function _crCur(w,id){var lv=id&&_lastVals[id],n=lv?parseFloat(String(lv.v).replace(',','.')):NaN;return isNaN(n)?_crMin(w):n;}
  function _crAng(w,val){var mn=_crMin(w),mx=_crMax(w),f=Math.max(0,Math.min(1,(val-mn)/((mx-mn)||1)));return 135+270*f;}
  function _crValAt(w,ang){var rel=ang-135;while(rel<0)rel+=360;while(rel>=360)rel-=360;if(rel>270)rel=(rel>315?0:270);var mn=_crMin(w),mx=_crMax(w),st=(w.crStep>0?w.crStep:1),v=mn+(rel/270)*(mx-mn);v=Math.round(v/st)*st;return Math.max(mn,Math.min(mx,Math.round(v*1000)/1000));}
  function _crPt(ang,r){var a=ang*Math.PI/180;return [(50+r*Math.cos(a)),(50+r*Math.sin(a))];}
  function _crArc(a0,a1,r){var p0=_crPt(a0,r),p1=_crPt(a1,r),large=((a1-a0)>180)?1:0;return 'M'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+' A'+r+' '+r+' 0 '+large+' 1 '+p1[0].toFixed(1)+' '+p1[1].toFixed(1);}
  function _crApply(w,el,loO,hiO){
    var loV=(loO!=null)?loO:_crCur(w,w.varId),hiV=(hiO!=null)?hiO:_crCur(w,w.varId2);
    var la=_crAng(w,loV),ha=_crAng(w,hiV),lp=_crPt(la,40),hp=_crPt(ha,40);
    var seg=el.querySelector('[data-role=crseg]');if(seg)seg.setAttribute('d',_crArc(Math.min(la,ha),Math.max(la,ha),40));
    var lt=el.querySelector('[data-role=lo]');if(lt){lt.setAttribute('cx',lp[0].toFixed(1));lt.setAttribute('cy',lp[1].toFixed(1));}
    var ht=el.querySelector('[data-role=hi]');if(ht){ht.setAttribute('cx',hp[0].toFixed(1));ht.setAttribute('cy',hp[1].toFixed(1));}
    var vt=el.querySelector('[data-role=crval]');if(vt)vt.textContent=(Math.round(loV*10)/10)+' – '+(Math.round(hiV*10)/10);
  }
  var _crDrag=null;
  if(!window._crWired){window._crWired=1;
    document.addEventListener('pointerdown',function(e){
      if(mode==='edit')return;var th=e.target.closest?e.target.closest('[data-cr-thumb]'):null;if(!th)return;
      var el=th.closest('.w');if(!el)return;var w=widget(el.dataset.id);if(!w||w.type!=='circlerange')return;
      _crDrag={w:w,el:el,role:th.getAttribute('data-role'),svg:el.querySelector('svg'),last:0};
      e.preventDefault();e.stopPropagation();
    },true);
    document.addEventListener('pointermove',function(e){
      if(!_crDrag)return;var d=_crDrag,w=d.w,rb=d.svg.getBoundingClientRect();
      var ang=Math.atan2(e.clientY-(rb.top+rb.height/2),e.clientX-(rb.left+rb.width/2))*180/Math.PI;if(ang<0)ang+=360;
      var val=_crValAt(w,ang),now=Date.now();
      if(d.role==='lo'){var hv=_crCur(w,w.varId2);if(val>hv)val=hv;_crApply(w,d.el,val,null);if(w.varId&&now-d.last>=110){d.last=now;setVar(w.varId,val);}}
      else{var lv=_crCur(w,w.varId);if(val<lv)val=lv;_crApply(w,d.el,null,val);if(w.varId2&&now-d.last>=110){d.last=now;setVar(w.varId2,val);}}
      e.preventDefault();
    });
    function _crEnd(){_crDrag=null;}
    document.addEventListener('pointerup',_crEnd);document.addEventListener('pointercancel',_crEnd);
  }
  defWidget('circlerange',{
    label:'CircleRange', paletteIcon:'wdial', size:[150,150],
    defaults:function(w){w.crMin=0;w.crMax=100;w.crStep=1;},
    render:function(w){
      var loV=_crCur(w,w.varId),hiV=_crCur(w,w.varId2),la=_crAng(w,loV),ha=_crAng(w,hiV),lp=_crPt(la,40),hp=_crPt(ha,40);
      return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
        +'<svg viewBox="0 0 100 100" style="width:100%;height:100%">'
        +'<path d="'+_crArc(135,405,40)+'" fill="none" stroke="var(--surface-2)" stroke-width="7" stroke-linecap="round"/>'
        +'<path data-role="crseg" d="'+_crArc(Math.min(la,ha),Math.max(la,ha),40)+'" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round"/>'
        +'<circle data-role="lo" data-cr-thumb="1" cx="'+lp[0].toFixed(1)+'" cy="'+lp[1].toFixed(1)+'" r="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5" style="cursor:grab;touch-action:none"/>'
        +'<circle data-role="hi" data-cr-thumb="1" cx="'+hp[0].toFixed(1)+'" cy="'+hp[1].toFixed(1)+'" r="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5" style="cursor:grab;touch-action:none"/>'
        +'<text data-role="crval" x="50" y="53" text-anchor="middle" fill="var(--text)" font-size="10" font-family="var(--fm)">'+(Math.round(loV*10)/10)+' – '+(Math.round(hiV*10)/10)+'</text>'
        +(w.label?'<text x="50" y="66" text-anchor="middle" fill="var(--muted)" font-size="7">'+esc(w.label)+'</text>':'')
        +'</svg></div>';},
    props:function(w){return row('Unten (Var)','<input id="pCrVar" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pCrPick" style="padding:6px 8px">wählen</button>')
      +row('Oben (Var)','<input id="pCrVar2" value="'+(w.varId2||'')+'" placeholder="ID"> <button class="btn" id="pCrPick2" style="padding:6px 8px">wählen</button>')
      +row('Min/Max','<input id="pCrMin" type="number" style="width:60px" value="'+_crMin(w)+'"> <input id="pCrMax" type="number" style="width:60px" value="'+_crMax(w)+'">')
      +row('Schritt','<input id="pCrStep" type="number" step="0.1" value="'+(w.crStep>0?w.crStep:1)+'">');},
    wire:function(w){
      if($('#pCrVar'))$('#pCrVar').oninput=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pCrPick'))$('#pCrPick').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pCrVar2'))$('#pCrVar2').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pCrPick2'))$('#pCrPick2').onclick=function(){showTab('vars');_bindTarget2=w.id;};
      if($('#pCrMin'))$('#pCrMin').oninput=function(){var v=parseFloat(this.value);w.crMin=isNaN(v)?0:v;render();};
      if($('#pCrMax'))$('#pCrMax').oninput=function(){var v=parseFloat(this.value);w.crMax=isNaN(v)?100:v;render();};
      if($('#pCrStep'))$('#pCrStep').oninput=function(){var v=parseFloat(this.value);w.crStep=(isNaN(v)||v<=0)?1:v;render();};
    },
    live:function(w,el,id,d,base,txt,on){if(_crDrag&&_crDrag.el===el)return;_crApply(w,el);}
  });
