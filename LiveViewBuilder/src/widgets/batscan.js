  // ===== Widget: batscan — kleiner Steuer-Button „Jetzt scannen" + Fortschritt (BatteryManager) =====
  // varId  = Register-String-Variable des BatteryManager (identifiziert die Instanz für den Hook)
  // varId2 = Progress-Integer-Variable (0 = idle, 1..99 = Scan läuft) -> Balken nur währenddessen.
  var _bsScan={},_bsTo={};
  function _bsRoot(w){
    var cands=[],oc=document.getElementById('ovcanvas');
    if(oc)cands=cands.concat([].slice.call(oc.querySelectorAll('.w[data-id="'+w.id+'"]')));
    cands=cands.concat([].slice.call(canvas.querySelectorAll('.w[data-id="'+w.id+'"]')));
    for(var i=0;i<cands.length;i++){var r=cands[i].querySelector('[data-role=bsroot]');if(r)return r;}
    return null;
  }
  function _bsDraw(w){
    var root=_bsRoot(w);if(!root)return;
    var pRaw=(w.varId2&&_lastVals[w.varId2]&&_lastVals[w.varId2].v!=null)?parseFloat(_lastVals[w.varId2].v):NaN;
    var scanning=!!_bsScan[w.id]||(!isNaN(pRaw)&&pRaw>0&&pRaw<100);
    var isRun=(typeof RUN!=='undefined'&&RUN);
    var sig=(w.varId||'')+'|'+(scanning?1:0)+':'+(isNaN(pRaw)?'':Math.round(pRaw));
    if(root._bsSig===sig)return;root._bsSig=sig;
    var btn='<button class="bs-btn'+(scanning?' busy':'')+'" data-bscan="1"'+((scanning||!isRun||!w.varId)?' disabled':'')+'>'
      +'<span class="bs-dot"></span>'+(scanning?'Scan läuft…':escL(w.label||'Jetzt scannen'))+'</button>';
    root.innerHTML=btn;
  }
  var _bsT={};
  defWidget('batscan',{
    label:'Jetzt scannen', cat:'Steuerung', paletteIcon:'reload', size:[210,40], noHover:true,
    defaults:function(w){w.frame=false;},
    render:function(w){return '<div class="bs" data-role="bsroot"></div>';},
    mount:function(w){_bsDraw(w);},
    props:function(w){return fieldPick(w,'varId','Register-Variable (löst Scan aus)')
      +fieldPick(w,'varId2','Fortschritt-Variable (Progress)')
      +row('Beschriftung','<input id="pBsLbl" value="'+esc(w.label||'')+'" placeholder="Jetzt scannen">')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Löst den BatteryManager-Scan aus (Hook ?api=batscan). Der Balken erscheint nur während des Scans.</div>';},
    wire:function(w){if($('#pBsLbl'))$('#pBsLbl').oninput=function(){w.label=this.value||undefined;var r=_bsRoot(w);if(r)r._bsSig=undefined;_bsDraw(w);commit();};},
    click:function(w,el,e){
      if(!e.target.closest('[data-bscan]'))return false;
      if(typeof RUN==='undefined'||!RUN||!w.varId||_bsScan[w.id])return true;
      _bsScan[w.id]=true;
      try{fetch('?api=batscan&vid='+w.varId,{cache:'no-store'});}catch(_){}
      if(_bsTo[w.id])clearTimeout(_bsTo[w.id]);
      _bsTo[w.id]=setTimeout(function(){_bsScan[w.id]=false;var r=_bsRoot(w);if(r)r._bsSig=undefined;_bsDraw(w);},30000);
      var r0=_bsRoot(w);if(r0)r0._bsSig=undefined;_bsDraw(w);return true;
    },
    live:function(w,el,id,d){
      if(id===w.varId){_bsScan[w.id]=false;if(_bsTo[w.id]){clearTimeout(_bsTo[w.id]);_bsTo[w.id]=null;}}
      if(id===w.varId||id===w.varId2){if(_bsT[w.id])clearTimeout(_bsT[w.id]);_bsT[w.id]=setTimeout(function(){_bsDraw(w);},180);}
    }
  });
