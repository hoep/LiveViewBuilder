  // ===== Widget: Wetter (Weather) — aktuelle Temperatur mit Forecast-Tagen =====
  defWidget('weather',{
    label:'Wetter', paletteIcon:'cloudsun', size:[320,140],
    defaults:function(w){w.fc=[{d:'Mo',ic:'cloudsun',hi:0,lo:0,pq:0},{d:'Di',ic:'cloudsun',hi:0,lo:0,pq:0},{d:'Mi',ic:'sun',hi:0,lo:0,pq:0},{d:'Do',ic:'rain',hi:0,lo:0,pq:0},{d:'Fr',ic:'cloudsun',hi:0,lo:0,pq:0}];},
    render:function(w){
      var _slots=(w.fc||[]).map(function(r){var ci=ICONS[r.ic||'cloudsun'];return '<div class="hwfslot"><div class="hwfd">'+esc(r.d||'')+'</div><svg class="hwfic" viewBox="0 0 24 24">'+(ci?ci[1]:'')+'</svg><div class="hwfhi"'+(r.hi?' data-vid="'+r.hi+'"':'')+'>–</div><div class="hwflo"'+(r.lo?' data-vid="'+r.lo+'"':'')+'>–</div>'+(r.pq?'<div class="hwfpq" data-vid="'+r.pq+'">–</div>':'')+'</div>';}).join('');
      return '<div class="hwf"><div class="hwfcur"><div class="hwicon">'+iconSVG(w.icon||'cloudsun')+'</div><div class="hwci"><div class="hwtemp" data-role="val">–</div><div class="hwfsub">'+(w.label?esc(w.label)+' ':'')+'<span data-role="sub"></span></div></div></div>'+(_slots?'<div class="hwfrow">'+_slots+'</div>':'')+'</div>';
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId===id){var wt=$('.hwtemp',el);if(wt)wt.textContent=txt;}
      if(w.varId2===id){var ws=$('[data-role=sub]',el);if(ws)ws.textContent=txt;}
    }
  });
