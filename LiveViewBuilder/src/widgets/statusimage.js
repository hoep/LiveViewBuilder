  // ===== Widget: Status-Bild (statusimage) — Media je Zustand; "off" = Farbbild in Graustufe (spart ein zweites Media) =====
  function _siMatch(sv,dv){ // boolean-tolerant: "1"/1/true bzw. "0"/0/false gelten als gleich
    if(String(sv)===String(dv))return true;
    var t=function(x){return x===true||x===1||x==='1'||x==='true';};
    var f=function(x){return x===false||x===0||x==='0'||x==='false';};
    return (t(sv)&&t(dv))||(f(sv)&&f(dv));
  }
  function _siSrc(mid){return mid?('?api=media&id='+mid):'';}
  function _siColorMid(w){var m=parseInt(w.mediaId)||0;if(m)return m;var r=0;(w.states||[]).forEach(function(s){var x=parseInt(s.mediaId)||0;if(x&&!r)r=x;});return r;} // Farb-/„Ein"-Bild
  function _siState(w,v){ // -> {src, gray}
    var color=_siColorMid(w),match=null;
    (w.states||[]).forEach(function(s){if(_siMatch(s.value,v))match=s;});
    if(match){var raw=(''+(match.mediaId==null?'':match.mediaId)).trim().toLowerCase();
      if(/^(off|grau|gray|grey|bw|sw|s\/w)$/.test(raw))return {src:_siSrc(color),gray:true}; // Graustufe des Farbbilds
      var m=parseInt(match.mediaId)||0;return {src:_siSrc(m||color),gray:false};
    }
    return {src:_siSrc(color),gray:false};
  }
  function _siApply(el,st){var si=$('[data-role=simg]',el);if(si){si.src=st.src;si.style.filter=st.gray?'grayscale(1) opacity(.6)':'';}}
  defWidget('statusimage',{
    label:'Status-Bild', paletteIcon:'wimage', size:[64,64],
    defaults:function(w){w.states=[{value:false,mediaId:'off'},{value:true,mediaId:0}];},
    render:function(w){var lv=w.varId&&_lastVals[w.varId];var st=_siState(w,lv?lv.v:null);
      return '<div class="hsimg"><img data-role="simg" alt="'+esc(w.label||'')+'" style="'+(st.gray?'filter:grayscale(1) opacity(.6)':'')+'" src="'+st.src+'">'+(w.label?'<span class="hsimlbl">'+esc(w.label)+'</span>':'')+'</div>';},
    props:function(w){return row('Farbbild (Media)','<input id="pMedia2" value="'+(w.mediaId||'')+'" placeholder="Media-ID">')
      +listEditor(w,'states','Zustände: Wert · Media-ID',[{k:'value',ph:'true/false/0/1'},{k:'mediaId',ph:'ID oder „off"'}])
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Bei Media-ID „<b>off</b>" wird das Farbbild in Graustufen gezeigt.</div>';},
    wire:function(w){if($('#pMedia2'))$('#pMedia2').onchange=function(){w.mediaId=parseInt(this.value)||0;render();};},
    mount:function(w){if(w.varId&&_lastVals[w.varId]){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_siApply(el,_siState(w,_lastVals[w.varId].v));}},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id)_siApply(el,_siState(w,d.v));return true;}
  });
