  // ===== Wetter-Widgets: "weather" (nur Aktuell) + "weatherpro" (Aktuell + Vorhersage) =====
  // Werte kommen aus Variablen (data-vid). Das Icon wird automatisch aus der Zustands-Variable erzeugt.
  var WWD=['So','Mo','Di','Mi','Do','Fr','Sa'];
  function wDayLabel(offset){if(offset===0)return 'Heute';if(offset===1)return 'Morgen';var dt=new Date();dt.setDate(dt.getDate()+offset);return WWD[dt.getDay()];}
  function wCondIcon(txt){txt=(''+(txt||'')).toLowerCase();
    if(/gewitter|thunder|storm|blitz/.test(txt))return 'storm';
    if(/schnee|snow|graupel|hagel|hail|sleet|flocke/.test(txt))return 'snow';
    if(/regen|rain|schauer|shower|niesel|drizzle|nass/.test(txt))return 'rain';
    if(/nebel|fog|dunst|mist|haze/.test(txt))return 'fog';
    if(/(klar|clear|sonnig|sunny|wolkenlos)/.test(txt)&&!/wolk|cloud|bedeckt/.test(txt))return 'sun';
    if(/heiter|teilweise|partly|aufgelockert|gering|leicht bew/.test(txt))return 'cloudsun';
    if(/bedeckt|bew(ö|oe)lkt|overcast|cloud|wolk|tr(ü|ue)b/.test(txt))return 'cloud';
    return 'cloudsun';
  }
  function wIconOf(condId,fallback){var lv=condId&&_lastVals[condId];var t=lv?(lv.f||lv.v):null;if(t!=null&&t!=='')return wCondIcon(t);return fallback||'cloudsun';}
  function wFcSvg(id){return '<svg class="hwfic" viewBox="0 0 24 24">'+(((ICONS[id]||[])[1])||'')+'</svg>';}
  function updateWeatherIcons(w,el){var ext=(w.type==='weatherpro');
    var ci=el.querySelector('[data-role=cico]');if(ci)ci.innerHTML=iconSVG(wIconOf(w.condVar));
    (w.fc||[]).forEach(function(r,i){var fi=el.querySelector('[data-role=fico][data-i="'+i+'"]');if(!fi)return;var id=wIconOf(r.cond,r.ic);fi.innerHTML=ext?iconSVG(id):wFcSvg(id);});
  }
  // gemeinsame "Aktuell"-Karte
  function wCurHTML(w,compact){var subId=(w.condVar||w.varId2);
    if(compact)return '<div class="hwp2cur"><span class="hwp2ic" data-role="cico">'+iconSVG(wIconOf(w.condVar))+'</span><span class="hwp2ci"><span class="hwp2t"'+(w.varId?' data-vid="'+w.varId+'"':'')+'>–</span><span class="hwp2sub">'+(w.label?esc(w.label)+' · ':'')+'<span data-role="sub"'+(subId?' data-vid="'+subId+'"':'')+'></span></span></span></div>';
    return '<div class="hwbig"><div class="hwbigico" data-role="cico">'+iconSVG(wIconOf(w.condVar))+'</div><div class="hwbigci"><div class="hwbigt"'+(w.varId?' data-vid="'+w.varId+'"':'')+'>–</div><div class="hwbigsub">'+(w.label?esc(w.label)+' · ':'')+'<span data-role="sub"'+(subId?' data-vid="'+subId+'"':'')+'></span></div></div></div>';
  }
  // Vorhersage-Bindungseditor (nur Wetter+): pro Tag Max/Min/Zustand[/Regen]
  function wFcProps(w){var start=(w.fcStart!=null?w.fcStart:1),showPq=(w.showPq!==false),h='';
    h+='<div class="pgh">Vorhersage</div>'
      +row('Erster Tag','<select id="pFcStart"><option value="0"'+(start===0?' selected':'')+'>Heute</option><option value="1"'+(start===1?' selected':'')+'>Morgen</option></select>')
      +row('Regenwahrsch.','<input type="checkbox" id="pShowPq"'+(showPq?' checked':'')+'>');
    (w.fc||[]).forEach(function(r,i){
      h+='<div class="pgh" style="display:flex;justify-content:space-between;align-items:center">'+esc(wDayLabel(start+i))+' <button class="btn" data-fcrm="'+i+'" style="padding:2px 6px" title="Tag entfernen">×</button></div>'
        +fieldPick(w,'fc.'+i+'.hi','Max')+fieldPick(w,'fc.'+i+'.lo','Min')+fieldPick(w,'fc.'+i+'.cond','Zustand')+(showPq?fieldPick(w,'fc.'+i+'.pq','Regen'):'');
    });
    h+='<button class="btn" id="pFcAdd" style="margin-top:4px"><svg class="i"><use href="#ic-plus"/></svg>Tag</button>';
    return h;
  }
  function wCurProps(w){ // gemeinsam: nur die Zustands-Variable (Temperatur = gemeinsames "Variable"-Feld = w.varId)
    return '<div class="pgh">Aktuell</div>'+fieldPick(w,'condVar','Zustand (Var)')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">„Variable" oben = aktuelle Temperatur. Das Icon wird automatisch aus dem Zustand erzeugt.</div>';
  }
  function wFcWire(w){
    if($('#pFcStart'))$('#pFcStart').onchange=function(){w.fcStart=parseInt(this.value);render();renderProps();commit();};
    if($('#pShowPq'))$('#pShowPq').onchange=function(){w.showPq=this.checked;render();renderProps();commit();};
    if($('#pFcAdd'))$('#pFcAdd').onclick=function(){if(!w.fc)w.fc=[];w.fc.push({hi:0,lo:0,cond:0,pq:0});render();renderProps();commit();};
    $$('#props [data-fcrm]').forEach(function(b){b.onclick=function(){w.fc.splice(+b.getAttribute('data-fcrm'),1);render();renderProps();commit();};});
    $$('#props [data-tg]').forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.getAttribute('data-tg').split('.'),k=pr[0],i=+pr[1];if(!w.tgrad||!w.tgrad[i])return;w.tgrad[i][k]=(k==='t')?(parseFloat(inp.value)||0):inp.value;refreshWeatherPro(w);commit();};});
    $$('#props [data-tgdel]').forEach(function(b){b.onclick=function(){w.tgrad.splice(+b.getAttribute('data-tgdel'),1);renderProps();refreshWeatherPro(w);commit();};});
    if($('#tgAdd'))$('#tgAdd').onclick=function(){if(!w.tgrad)w.tgrad=[];w.tgrad.push({t:20,color:'#f2b441'});renderProps();refreshWeatherPro(w);commit();};
    if($('#pGmin'))$('#pGmin').oninput=function(){w.gmin=this.value===''?undefined:parseFloat(this.value);refreshWeatherPro(w);commit();};
    if($('#pGmax'))$('#pGmax').oninput=function(){w.gmax=this.value===''?undefined:parseFloat(this.value);refreshWeatherPro(w);commit();};
  }
  function _wDefFc(){return [{hi:0,lo:0,cond:0,pq:0},{hi:0,lo:0,cond:0,pq:0},{hi:0,lo:0,cond:0,pq:0},{hi:0,lo:0,cond:0,pq:0},{hi:0,lo:0,cond:0,pq:0}];}

  // ----- Wetter: nur Aktuell -----
  defWidget('weather',{
    label:'Wetter', paletteIcon:'cloudsun', size:[240,130],
    defaults:function(w){w.label='';},
    render:function(w){return '<div class="hwf hwf-cur">'+wCurHTML(w,false)+'</div>';},
    props:function(w){return wCurProps(w);},
    wire:function(w){},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)updateWeatherIcons(w,el);},
    live:function(w,el,id,d,base,txt,on){updateWeatherIcons(w,el);return true;}
  });

  // ----- Wetter+: Aktuell + Mehrtages-Vorhersage mit Temperaturbalken -----
  defWidget('weatherpro',{
    label:'Wetter+', paletteIcon:'cloudsun', size:[340,220],
    defaults:function(w){w.label='';w.fcStart=1;w.showPq=true;w.fc=_wDefFc();w.tgrad=[{t:-5,color:'#4aa3ff'},{t:4,color:'#3bd6c6'},{t:14,color:'#39d08a'},{t:22,color:'#f2b441'},{t:32,color:'#f2685a'}];},
    render:function(w){var start=(w.fcStart!=null?w.fcStart:1),showPq=(w.showPq!==false);
      var slots=(w.fc||[]).map(function(r,i){var dl=wDayLabel(start+i);
        return '<div class="hwp2day"><span class="d">'+esc(dl)+'</span><span class="ic" data-role="fico" data-i="'+i+'">'+iconSVG(wIconOf(r.cond,r.ic))+'</span><span class="lo"'+(r.lo?' data-vid="'+r.lo+'"':'')+'>–</span><div class="trk"><i class="fill"></i></div><span class="hi"'+(r.hi?' data-vid="'+r.hi+'"':'')+'>–</span><span class="pq"'+(showPq&&r.pq?' data-vid="'+r.pq+'"':'')+'></span></div>';
      }).join('');
      return '<div class="hwp2">'+wCurHTML(w,true)+'<div class="hwp2days">'+slots+'</div></div>';},
    props:function(w){return wCurProps(w)+wFcProps(w)+'<div class="pgh">Temperaturbalken</div>'+tgradEditor(w)+row('Skala Min/Max','<input id="pGmin" type="number" style="width:60px" value="'+(w.gmin!=null?w.gmin:'')+'" placeholder="auto"> <input id="pGmax" type="number" style="width:60px" value="'+(w.gmax!=null?w.gmax:'')+'" placeholder="auto">');},
    wire:function(w){wFcWire(w);},
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)updateWeatherIcons(w,el);refreshWeatherPro(w);},
    live:function(w,el,id,d,base,txt,on){updateWeatherIcons(w,el);refreshWeatherPro(w);return true;}
  });
