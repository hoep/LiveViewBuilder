  function clampZoom(z){return Math.max(0.2,Math.min(3,z));}
  function fitZoom(){var pad=54,aw=stage.clientWidth-pad,ah=stage.clientHeight-pad;if(aw<40||ah<40||!state.page)return 1;return clampZoom(Math.min(aw/state.page.w,ah/state.page.h));}
  function applyZoom(){
    if(document.body.classList.contains('run')){canvas.style.transform='';if(cwrap){cwrap.style.width='';cwrap.style.height='';}return;}
    canvas.style.transform=(Math.abs(zoom-1)<1e-4)?'none':'scale('+zoom+')';
    if(cwrap){cwrap.style.width=(state.page.w*zoom)+'px';cwrap.style.height=(state.page.h*zoom)+'px';}
  }
  function syncZoomUI(){var l=$('#zoomLbl');if(l)l.textContent=Math.round(zoom*100)+'%';}
  function setZoom(z){zoom=clampZoom(z);applyZoom();syncZoomUI();}

  function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},1600);}
  function snap(n){return gridOn?Math.round(n/GS)*GS:Math.round(n);}
  function uid(){return 'w'+(seq++);}

  function setCanvas(){canvas.style.width=state.page.w+'px';canvas.style.height=state.page.h+'px';canvas.style.setProperty('--gs',GS+'px');var wi=$('#cvW'),hi=$('#cvH');if(wi)wi.value=state.page.w;if(hi)hi.value=state.page.h;var ff=$('#cvFit');if(ff)ff.value=state.page.fit||'letterbox';var pu=$('#cvPopup');if(pu)pu.checked=!!state.page.popup;/* Popup-Kennzeichen der aktuellen Seite anzeigen */var fr=$('#cvFrame');if(fr)fr.checked=!state.page.noframe;applyZoom();}

  function widgetInner(w){
    var _wr=WIDGETS[w.type];if(_wr&&_wr.render){var _h=_wr.render(w);if(_h!=null)return _h;}
    if(w.type==='gauge'||w.type==='chart'||w.type==='spark'||w.type==='sankey')return '<div data-role="chart"></div>';
    // value
    var ic=w.icon?('<div class="wvic">'+iconSVG(w.icon)+'</div>'):'';
    return '<div class="wv'+(w.icon?' hasic':'')+'">'+ic+'<div class="wvbody"><div class="l">'+esc(w.label||'')+'</div><div class="v" data-role="val">–</div></div></div>';
  }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

