  // ===== Widget: weatherpro — Wetter+ =====
  defWidget('weatherpro',{
    label:'Wetter+', paletteIcon:'cloudsun', size:[340,220],
    defaults:function(w){w.label='Wetter';w.icon='cloudsun';w.fc=[{d:'Mo',ic:'cloudsun',hi:0,lo:0,pq:0},{d:'Di',ic:'sun',hi:0,lo:0,pq:0},{d:'Mi',ic:'cloud',hi:0,lo:0,pq:0},{d:'Do',ic:'rain',hi:0,lo:0,pq:0},{d:'Fr',ic:'cloudsun',hi:0,lo:0,pq:0}];w.tgrad=[{t:-5,color:'#4aa3ff'},{t:4,color:'#3bd6c6'},{t:14,color:'#39d08a'},{t:22,color:'#f2b441'},{t:32,color:'#f2685a'}];},
    render:function(w){
      var _d2=(w.fc||[]).map(function(r){return '<div class="hwp2day"><span class="d">'+esc(r.d||'')+'</span><span class="ic">'+iconSVG(r.ic||'cloudsun')+'</span><span class="lo"'+(r.lo?' data-vid="'+r.lo+'"':'')+'>–</span><div class="trk"><i class="fill"></i></div><span class="hi"'+(r.hi?' data-vid="'+r.hi+'"':'')+'>–</span><span class="pq"'+(r.pq?' data-vid="'+r.pq+'"':'')+'></span></div>';}).join('');
      return '<div class="hwp2"><div class="hwp2cur"><span class="hwp2ic">'+iconSVG(w.icon||'cloudsun')+'</span><span class="hwp2ci"><span class="hwp2t" data-role="val">–</span><span class="hwp2sub">'+(w.label?esc(w.label)+' · ':'')+'<span data-role="sub"></span></span></span></div><div class="hwp2days">'+_d2+'</div></div>';
    },
    props:function(w){return (w.type==='weatherpro'?(tgradEditor(w)+row('Skala Min/Max','<input id="pGmin" type="number" style="width:60px" value="'+(w.gmin!=null?w.gmin:'')+'" placeholder="auto"> <input id="pGmax" type="number" style="width:60px" value="'+(w.gmax!=null?w.gmax:'')+'" placeholder="auto">')):'');},
    wire:function(w){
      $$('#props [data-tg]').forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.getAttribute('data-tg').split('.'),k=pr[0],i=+pr[1];if(!w.tgrad||!w.tgrad[i])return;w.tgrad[i][k]=(k==='t')?(parseFloat(inp.value)||0):inp.value;if(_ec[w.id])refreshWeatherPro(w);commit();};});
      $$('#props [data-tgdel]').forEach(function(b){b.onclick=function(){w.tgrad.splice(+b.getAttribute('data-tgdel'),1);renderProps();refreshWeatherPro(w);commit();};});
      if($('#tgAdd'))$('#tgAdd').onclick=function(){if(!w.tgrad)w.tgrad=[];w.tgrad.push({t:20,color:'#f2b441'});renderProps();refreshWeatherPro(w);commit();};
      if($('#pGmin'))$('#pGmin').oninput=function(){w.gmin=this.value===''?undefined:parseFloat(this.value);refreshWeatherPro(w);commit();};
      if($('#pGmax'))$('#pGmax').oninput=function(){w.gmax=this.value===''?undefined:parseFloat(this.value);refreshWeatherPro(w);commit();};
    },
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){var w2t=$('.hwp2t',el);if(w2t)w2t.textContent=txt;}if(w.varId2===id){var w2s=$('[data-role=sub]',el);if(w2s)w2s.textContent=txt;}refreshWeatherPro(w);}
  });
