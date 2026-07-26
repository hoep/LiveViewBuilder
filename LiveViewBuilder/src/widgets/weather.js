  // ===== Wetter-Widgets: "weather" (nur Aktuell) + "weatherpro" (Aktuell + Vorhersage) =====
  // EINE String-Variable (JSON) liefert alle Daten. Erkannt werden: OpenWeatherMap (One-Call),
  // Tempest/WeatherFlow (better_forecast) und Open-Meteo (parallele Arrays). Auto-Erkennung oder manuell.
  var WWD=['So','Mo','Di','Mi','Do','Fr','Sa'];
  function wDayLabel(offset){if(offset===0)return 'Heute';var dt=new Date();dt.setDate(dt.getDate()+offset);return WWD[dt.getDay()];}
  function wCondIcon(txt){txt=(''+(txt||'')).toLowerCase();
    if(/gewitter|thunder|storm|blitz|lightning/.test(txt))return 'storm';
    if(/schnee|snow|graupel|hagel|hail|sleet|flocke|flurr/.test(txt))return 'snow';
    if(/regen|rain|schauer|shower|niesel|drizzle|nass|pour/.test(txt))return 'rain';
    if(/nebel|fog|dunst|mist|haze/.test(txt))return 'fog';
    if(/(klar|clear|sonnig|sunny|wolkenlos)/.test(txt)&&!/wolk|cloud|bedeckt/.test(txt))return 'sun';
    if(/heiter|teilweise|partly|aufgelockert|gering|mostly-clear|leicht bew/.test(txt))return 'cloudsun';
    if(/bedeckt|bew(ö|oe)lkt|overcast|cloud|wolk|tr(ü|ue)b/.test(txt))return 'cloud';
    if(/wind/.test(txt))return 'wind';
    return 'cloudsun';
  }
  // --- Icon-Mapper je API ---
  function owmIcon(wobj){wobj=wobj||{};var id=+wobj.id;if(id){if(id>=200&&id<300)return 'storm';if(id>=300&&id<600)return 'rain';if(id>=600&&id<700)return 'snow';if(id>=700&&id<800)return 'fog';if(id===800)return 'sun';if(id===801||id===802)return 'cloudsun';if(id>802)return 'cloud';}return wCondIcon(wobj.description||wobj.main||'');}
  function tempestIcon(ic){if(!ic)return null;ic=(''+ic).toLowerCase();if(/thunder|lightning/.test(ic))return 'storm';if(/snow|sleet/.test(ic))return 'snow';if(/rain|drizzle|pour/.test(ic))return 'rain';if(/fog/.test(ic))return 'fog';if(/wind/.test(ic))return 'wind';if(/partly|mostly-clear|possibly/.test(ic))return 'cloudsun';if(/cloud/.test(ic))return 'cloud';if(/clear|sunny/.test(ic))return 'sun';return null;}
  function wmoIcon(c){c=+c;if(isNaN(c))return 'cloudsun';if(c===0)return 'sun';if(c<=2)return 'cloudsun';if(c===3)return 'cloud';if(c<=48)return 'fog';if(c<=67)return 'rain';if(c<=77)return 'snow';if(c<=82)return 'rain';if(c<=86)return 'snow';return 'storm';}
  function wmoText(c){c=+c;var M={0:'Klar',1:'Überwiegend klar',2:'Teilweise bewölkt',3:'Bedeckt',45:'Nebel',48:'Reifnebel',51:'Leichter Niesel',53:'Niesel',55:'Starker Niesel',61:'Leichter Regen',63:'Regen',65:'Starker Regen',71:'Leichter Schnee',73:'Schnee',75:'Starker Schnee',80:'Regenschauer',81:'Schauer',82:'Starke Schauer',95:'Gewitter',96:'Gewitter mit Hagel',99:'Gewitter mit Hagel'};return M[c]||'';}
  // --- Parser: liefert {cur:{temp,cond,icon}, days:[{hi,lo,cond,icon,pop}]} ---
  function wDetect(j){
    if(j.current_conditions||(j.forecast&&j.forecast.daily))return 'tempest';
    if(Array.isArray(j.daily)||Array.isArray(j.list)||(j.current&&j.current.weather))return 'owm';
    if((j.daily&&j.daily.time)||(j.current&&j.current.temperature_2m!=null)||j.hourly)return 'openmeteo';
    if(j.temp!=null||j.temperature!=null)return 'flat'; // einfaches selbstgebautes JSON: {temp,humidity,wind,condition,icon}
    return null;
  }
  var _msKmh=function(v){return (v==null)?null:v*3.6;}; // m/s -> km/h
  function parseWeatherJSON(raw,fmt){
    var j;try{j=(typeof raw==='string')?JSON.parse(raw):raw;}catch(e){return null;}
    if(!j||typeof j!=='object')return null;
    var f=(fmt&&fmt!=='auto')?fmt:wDetect(j);if(!f)return null;
    var cur=null,days=[];
    if(f==='owm'){
      if(j.current){var cw=(j.current.weather&&j.current.weather[0])||{};cur={temp:j.current.temp,cond:cw.description||cw.main,icon:owmIcon(cw),humidity:j.current.humidity,wind:_msKmh(j.current.wind_speed)};}
      (j.daily||[]).forEach(function(d){var dw=(d.weather&&d.weather[0])||{};days.push({hi:d.temp&&d.temp.max,lo:d.temp&&d.temp.min,cond:dw.description||dw.main,icon:owmIcon(dw),pop:(d.pop!=null)?Math.round(d.pop*100):null});});
    } else if(f==='tempest'){
      var cc=j.current_conditions;if(cc)cur={temp:cc.air_temperature,cond:cc.conditions,icon:tempestIcon(cc.icon)||wCondIcon(cc.conditions),humidity:cc.relative_humidity,wind:_msKmh(cc.wind_avg)};
      var dl=(j.forecast&&j.forecast.daily)||[];dl.forEach(function(d){days.push({hi:d.air_temp_high,lo:d.air_temp_low,cond:d.conditions,icon:tempestIcon(d.icon)||wCondIcon(d.conditions),pop:(d.precip_probability!=null)?Math.round(d.precip_probability):null});});
    } else if(f==='openmeteo'){
      if(j.current)cur={temp:j.current.temperature_2m,cond:wmoText(j.current.weather_code),icon:wmoIcon(j.current.weather_code),humidity:j.current.relative_humidity_2m,wind:j.current.wind_speed_10m};
      var dd=j.daily;if(dd&&dd.time){for(var i=0;i<dd.time.length;i++){var wc=dd.weather_code&&dd.weather_code[i];days.push({hi:dd.temperature_2m_max&&dd.temperature_2m_max[i],lo:dd.temperature_2m_min&&dd.temperature_2m_min[i],cond:wmoText(wc),icon:wmoIcon(wc),pop:dd.precipitation_probability_max?dd.precipitation_probability_max[i]:null});}}
    } else if(f==='flat'){
      var t=(j.temp!=null?j.temp:j.temperature),cnd=(j.condition||j.conditions||j.description);
      cur={temp:t,cond:cnd,icon:(j.icon?(tempestIcon(j.icon)||wCondIcon(j.icon)):wCondIcon(cnd)),humidity:(j.humidity!=null?j.humidity:j.relative_humidity),wind:(j.wind!=null?j.wind:(j.wind_speed!=null?j.wind_speed:j.windspeed))};
    }
    return {fmt:f,cur:cur,days:days};
  }
  function _wt(n,dec){if(n==null||n==='')return null;var v=parseFloat(n);if(isNaN(v))return null;return (dec?(Math.round(v*10)/10):Math.round(v));}
  function _wtxt(n,dec){var v=_wt(n,dec);return v==null?'–':String(v).replace('.',',');}
  // --- füllt das Widget aus der JSON-Variable ---
  var _dropSVG='<svg class="hwmic" style="fill:currentColor;stroke:none" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
  function applyWeather(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var cl=w.varId&&_lastVals[w.varId],cData=cl?parseWeatherJSON(cl.v,w.wfmt):null;              // Aktuell = Variable
    var fl=(w.varId2&&_lastVals[w.varId2])||cl,fData=fl?parseWeatherJSON(fl.v,w.wfmt):cData;       // Vorhersage = Variable2 (sonst dieselbe)
    var unit=(w.wunit!=null?w.wunit:'°'),cur=cData&&cData.cur;
    // je aktuellem Wert optional eine Variable; sonst Fallback aufs JSON
    var _ln=function(id){var lv=id&&_lastVals[id];if(!lv)return null;var n=parseFloat(String(lv.v).replace(',','.'));return isNaN(n)?null:n;};
    var _lt=function(id){var lv=id&&_lastVals[id];if(!lv)return null;return (lv.f!=null&&lv.f!=='')?lv.f:String(lv.v);};
    var temp=(w.vTemp&&_ln(w.vTemp)!=null)?_ln(w.vTemp):(cur?cur.temp:null);
    var condHasVar=(w.vCond&&_lt(w.vCond)!=null),condTxt=condHasVar?_lt(w.vCond):(cur?cur.cond:null);
    var icon=condHasVar?wCondIcon(condTxt):((cur&&cur.icon)||w.icon||'cloudsun');
    var hum=(w.vHum&&_ln(w.vHum)!=null)?_ln(w.vHum):(cur?cur.humidity:null);
    var wind=(w.vWind&&_ln(w.vWind)!=null)?_ln(w.vWind):(cur?cur.wind:null);
    var ci=el.querySelector('[data-role=cico]');if(ci)ci.innerHTML=iconSVG(icon);
    var ct=el.querySelector('[data-role=val]');if(ct)ct.textContent=(temp!=null)?(_wtxt(temp,1)+unit):'–';
    var cs=el.querySelector('[data-role=sub]');if(cs)cs.textContent=(condTxt)?condTxt:((cData||condHasVar)?'':'keine/ungültige Daten');
    var hu=el.querySelector('[data-role=hum]');if(hu)hu.innerHTML=(hum!=null)?(_dropSVG+_wtxt(hum)+' %'):'';
    var wi=el.querySelector('[data-role=wind]');if(wi)wi.innerHTML=(wind!=null)?('<svg class="hwmic" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24">'+((ICONS.wind||[])[1]||'')+'</svg>'+_wtxt(wind)+' km/h'):'';
    if(w.type!=='weatherpro')return;
    var days=(fData&&fData.days)||[],start=(w.fcStart!=null?w.fcStart:0),showPq=(w.showPq!==false);
    // Skala fuer Temperaturbalken
    var his=[],los=[];days.forEach(function(d){var h=_wt(d.hi,1),l=_wt(d.lo,1);if(h!=null)his.push(h);if(l!=null)los.push(l);});
    var gmin=(w.gmin!=null&&w.gmin!=='')?parseFloat(w.gmin):(los.length?Math.min.apply(null,los)-1:-10);
    var gmax=(w.gmax!=null&&w.gmax!=='')?parseFloat(w.gmax):(his.length?Math.max.apply(null,his)+1:40);if(gmax<=gmin)gmax=gmin+1;
    el.querySelectorAll('.hwp2day').forEach(function(row,i){
      var d=days[i];
      var dEl=row.querySelector('.d');if(dEl)dEl.textContent=wDayLabel(start+i);
      var icEl=row.querySelector('.ic');if(icEl)icEl.innerHTML=iconSVG((d&&d.icon)||'cloudsun');
      var loEl=row.querySelector('.lo');if(loEl)loEl.textContent=d?_wtxt(d.lo):'–';
      var hiEl=row.querySelector('.hi');if(hiEl)hiEl.textContent=d?_wtxt(d.hi):'–';
      var pqEl=row.querySelector('.pq');if(pqEl)pqEl.innerHTML=(showPq&&d&&d.pop!=null&&d.pop>0)?('<svg class="hwpqi" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>'+d.pop+'%'):'';
      var fill=row.querySelector('.fill');if(fill){var h=d?_wt(d.hi,1):null,l=d?_wt(d.lo,1):null;if(h==null||l==null){fill.style.width='0';}else{var lp=(l-gmin)/(gmax-gmin)*100,hp=(h-gmin)/(gmax-gmin)*100;fill.style.left=Math.max(0,Math.min(100,lp))+'%';fill.style.width=Math.max(3,Math.min(100,hp)-Math.max(0,lp))+'%';fill.style.background='linear-gradient(90deg,'+tColor(l,w.tgrad)+','+tColor(h,w.tgrad)+')';}}
    });
  }
  function wJsonProps(w){ // gemeinsame Props: Format, Einheit + Hinweis auf die JSON-Variable
    return '<div class="hint" style="font-size:11px;color:var(--muted)">„Variable" oben = <b>eine String-Variable mit JSON</b> (OpenWeatherMap, Tempest oder Open-Meteo).</div>'
      +row('Format','<select id="pWFmt"><option value="auto"'+((w.wfmt||'auto')==='auto'?' selected':'')+'>Automatisch erkennen</option><option value="owm"'+(w.wfmt==='owm'?' selected':'')+'>OpenWeatherMap</option><option value="tempest"'+(w.wfmt==='tempest'?' selected':'')+'>Tempest / WeatherFlow</option><option value="openmeteo"'+(w.wfmt==='openmeteo'?' selected':'')+'>Open-Meteo</option></select>')
      +row('Temp-Einheit','<input id="pWUnit" value="'+esc(w.wunit!=null?w.wunit:'°')+'" style="width:60px" placeholder="°">')
      +'<div class="pgh">Aktuelle Werte (optional als Variable)</div>'
      +fieldPick(w,'vTemp','Temperatur')+fieldPick(w,'vCond','Zustand')+fieldPick(w,'vHum','Feuchte %')+fieldPick(w,'vWind','Wind km/h')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Leer = Wert aus dem JSON. Zustand-Variable liefert Text → Icon automatisch.</div>';
  }
  function wJsonWire(w){
    if($('#pWFmt'))$('#pWFmt').onchange=function(){w.wfmt=this.value;render();commit();};
    if($('#pWUnit'))$('#pWUnit').oninput=function(){w.wunit=this.value;render();applyWeather(w);};
  }
  function _wMount(w){applyWeather(w);}
  function _wLive(w,el,id,d,base,txt,on){applyWeather(w);return true;}

  // ----- Wetter: nur Aktuell -----
  defWidget('weather',{
    label:'Wetter', paletteIcon:'cloudsun', size:[240,130],
    defaults:function(w){w.label='';w.wfmt='auto';},
    render:function(w){return '<div class="hwf hwf-cur"><div class="hwbig"><div class="hwbigico" data-role="cico">'+iconSVG(w.icon||'cloudsun')+'</div><div class="hwbigci"><div class="hwbigt" data-role="val">–</div><div class="hwbigsub"><span data-role="sub"></span></div><div class="hwmetrow"><span class="hwmet" data-role="wind"></span><span class="hwmet" data-role="hum"></span></div></div></div></div>';},
    props:function(w){return wJsonProps(w);},
    wire:function(w){wJsonWire(w);},
    mount:_wMount, live:_wLive
  });

  // ----- Wetter+: Aktuell + Mehrtages-Vorhersage mit Temperaturbalken -----
  defWidget('weatherpro',{
    label:'Wetter+', paletteIcon:'cloudsun', size:[340,220],
    defaults:function(w){w.label='';w.wfmt='auto';w.days=5;w.fcStart=0;w.showPq=true;w.tgrad=[{t:-5,color:'#4aa3ff'},{t:4,color:'#3bd6c6'},{t:14,color:'#39d08a'},{t:22,color:'#f2b441'},{t:32,color:'#f2685a'}];},
    render:function(w){var n=Math.max(1,Math.min(10,w.days||5));var slots='';for(var i=0;i<n;i++)slots+='<div class="hwp2day" data-i="'+i+'"><span class="d">–</span><span class="ic"></span><span class="lo">–</span><div class="trk"><i class="fill"></i></div><span class="hi">–</span><span class="pq"></span></div>';
      return '<div class="hwp2"><div class="hwp2cur"><span class="hwp2ic" data-role="cico">'+iconSVG(w.icon||'cloudsun')+'</span><span class="hwp2ci"><span class="hwp2t" data-role="val">–</span><span class="hwp2sub">'+(w.label?esc(w.label)+' · ':'')+'<span data-role="sub"></span></span><span class="hwmetrow"><span class="hwmet" data-role="wind"></span><span class="hwmet" data-role="hum"></span></span></span></div><div class="hwp2days">'+slots+'</div></div>';},
    props:function(w){return wJsonProps(w)
      +row('Vorhersage-Tage','<input id="pWDays" type="number" min="1" max="10" value="'+(w.days||5)+'">')
      +row('Erster Tag','<select id="pFcStart"><option value="0"'+((w.fcStart||0)===0?' selected':'')+'>Heute</option><option value="1"'+(w.fcStart===1?' selected':'')+'>Morgen</option></select>')
      +row('Regenwahrsch.','<input type="checkbox" id="pShowPq"'+((w.showPq!==false)?' checked':'')+'>')
      +'<div class="pgh">Temperaturbalken</div>'+tgradEditor(w)+row('Skala Min/Max','<input id="pGmin" type="number" style="width:60px" value="'+(w.gmin!=null?w.gmin:'')+'" placeholder="auto"> <input id="pGmax" type="number" style="width:60px" value="'+(w.gmax!=null?w.gmax:'')+'" placeholder="auto">');},
    wire:function(w){wJsonWire(w);
      if($('#pWDays'))$('#pWDays').oninput=function(){w.days=Math.max(1,Math.min(10,parseInt(this.value)||5));render();applyWeather(w);commit();};
      if($('#pFcStart'))$('#pFcStart').onchange=function(){w.fcStart=parseInt(this.value);render();applyWeather(w);commit();};
      if($('#pShowPq'))$('#pShowPq').onchange=function(){w.showPq=this.checked;render();applyWeather(w);commit();};
      $$('#props [data-tg]').forEach(function(inp){
        inp.oninput=function(){var pr=inp.getAttribute('data-tg').split('.'),k=pr[0],i=+pr[1];if(!w.tgrad||!w.tgrad[i])return;w.tgrad[i][k]=(k==='t')?(parseFloat(inp.value)||0):inp.value;applyWeather(w);commit();};
        inp.onchange=function(){if(inp.getAttribute('data-tg').split('.')[0]==='t'&&w.tgrad){w.tgrad.sort(function(a,b){return (a.t||0)-(b.t||0);});renderProps();applyWeather(w);commit();}}; // nach Temperatur einsortieren
      });
      $$('#props [data-tgdel]').forEach(function(b){b.onclick=function(){w.tgrad.splice(+b.getAttribute('data-tgdel'),1);renderProps();applyWeather(w);commit();};});
      if($('#tgAdd'))$('#tgAdd').onclick=function(){if(!w.tgrad)w.tgrad=[];w.tgrad.push({t:20,color:'#f2b441'});renderProps();applyWeather(w);commit();};
      if($('#pGmin'))$('#pGmin').oninput=function(){w.gmin=this.value===''?undefined:parseFloat(this.value);applyWeather(w);commit();};
      if($('#pGmax'))$('#pGmax').oninput=function(){w.gmax=this.value===''?undefined:parseFloat(this.value);applyWeather(w);commit();};
    },
    mount:_wMount, live:_wLive
  });
