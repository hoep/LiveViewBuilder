  // ===== Wetter-Widgets: "weather" (nur Aktuell) + "weatherpro" (Aktuell + Vorhersage) =====
  // EINE String-Variable (JSON) liefert alle Daten. Erkannt werden: OpenWeatherMap (One-Call),
  // Tempest/WeatherFlow (better_forecast) und Open-Meteo (parallele Arrays). Auto-Erkennung oder manuell.
  var WWD=['So','Mo','Di','Mi','Do','Fr','Sa'];
  function wDayLabel(offset){if(offset===0)return 'Heute';var dt=new Date();dt.setDate(dt.getDate()+offset);return WWD[dt.getDay()];}
  function wDayLabelTs(ts){var dt=new Date(ts*1000),now=new Date();if(dt.getFullYear()===now.getFullYear()&&dt.getMonth()===now.getMonth()&&dt.getDate()===now.getDate())return 'Heute';return WWD[dt.getDay()];}
  // PHP unserialize() -> JS (Tempest/IPS legen Daten oft serialisiert statt als JSON ab). Byte-genau (UTF-8-fest).
  function phpUnser(str){
    if(typeof str!=='string')return null;
    var bytes;try{bytes=new TextEncoder().encode(str);}catch(e){bytes=[];for(var k=0;k<str.length;k++)bytes.push(str.charCodeAt(k)&0xff);}
    var td=null;try{td=new TextDecoder();}catch(e){}
    var i=0;
    function ch(){return String.fromCharCode(bytes[i]);}
    function readUntil(c){var s='';while(i<bytes.length&&ch()!==c){s+=ch();i++;}return s;}
    function decode(a){if(td){try{return td.decode(new Uint8Array(a));}catch(e){}}var s='';for(var k=0;k<a.length;k++)s+=String.fromCharCode(a[k]);try{return decodeURIComponent(escape(s));}catch(e){return s;}}
    function val(){
      var t=ch();
      if(t==='N'){i+=2;return null;}
      if(t==='b'){i+=2;var b=ch()==='1';i+=2;return b;}
      if(t==='i'){i+=2;var n=readUntil(';');i++;return parseInt(n,10);}
      if(t==='d'){i+=2;var d=readUntil(';');i++;return parseFloat(d);}
      if(t==='s'){i+=2;var len=parseInt(readUntil(':'),10);i+=2;var sb=[];for(var k=0;k<len;k++){sb.push(bytes[i]);i++;}i+=2;return decode(sb);}
      if(t==='a'){i+=2;var cnt=parseInt(readUntil(':'),10);i+=2;var arr={},isList=true;for(var k=0;k<cnt;k++){var key=val(),v=val();arr[key]=v;if(key!==k)isList=false;}i++;if(isList){var list=[];for(var m=0;m<cnt;m++)list.push(arr[m]);return list;}return arr;}
      if(t==='O'){i+=2;var clen=parseInt(readUntil(':'),10);i+=2;i+=clen;i+=2;var pc=parseInt(readUntil(':'),10);i+=2;var o={};for(var p=0;p<pc;p++){var kk=val(),vv=val();o[kk]=vv;}i++;return o;}
      return null;
    }
    try{return val();}catch(e){return null;}
  }
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
  // EN->DE Übersetzung der Zustandstexte (Tempest/OWM liefern Englisch). Deutsche Texte bleiben unverändert.
  var WTR={
    'clear':'Klar','clear sky':'Klarer Himmel','sunny':'Sonnig','fair':'Heiter','mostly clear':'Überwiegend klar','mostly sunny':'Überwiegend sonnig',
    'partly cloudy':'Teilweise bewölkt','partly sunny':'Teilweise sonnig','mostly cloudy':'Überwiegend bewölkt','cloudy':'Bewölkt','overcast':'Bedeckt','overcast clouds':'Bedeckt',
    'few clouds':'Leicht bewölkt','scattered clouds':'Vereinzelte Wolken','broken clouds':'Aufgelockerte Bewölkung',
    'foggy':'Neblig','fog':'Nebel','mist':'Dunst','haze':'Dunst','windy':'Windig','breezy':'Windig',
    'rain':'Regen','rain possible':'Regen möglich','rain likely':'Regen wahrscheinlich','light rain':'Leichter Regen','very light rain':'Sehr leichter Regen','moderate rain':'Mäßiger Regen','heavy rain':'Starker Regen',
    'drizzle':'Niesel','light drizzle':'Leichter Niesel','shower rain':'Regenschauer','rain shower':'Regenschauer','showers':'Schauer',
    'snow':'Schnee','snow possible':'Schnee möglich','snow likely':'Schnee wahrscheinlich','light snow':'Leichter Schnee','heavy snow':'Starker Schnee','flurries':'Schneegestöber',
    'sleet':'Graupel','hail':'Hagel','wintry mix':'Schneeregen','wintry mix possible':'Schneeregen möglich','wintry mix likely':'Schneeregen wahrscheinlich',
    'thunderstorm':'Gewitter','thunderstorms':'Gewitter','thunderstorm possible':'Gewitter möglich','thunderstorms possible':'Gewitter möglich','thunderstorm likely':'Gewitter wahrscheinlich','thunderstorms likely':'Gewitter wahrscheinlich','thundershower':'Gewitterschauer','thunderstorms with rain':'Gewitter mit Regen'
  };
  var WTRW=[[/thunderstorms?/gi,'Gewitter'],[/possible/gi,'möglich'],[/likely/gi,'wahrscheinlich'],[/partly/gi,'teils'],[/mostly/gi,'überwiegend'],[/overcast/gi,'bedeckt'],[/cloudy/gi,'bewölkt'],[/clouds/gi,'Wolken'],[/cloud/gi,'Wolke'],[/clear sky/gi,'klarer Himmel'],[/clear/gi,'klar'],[/sunny/gi,'sonnig'],[/showers?/gi,'Schauer'],[/drizzle/gi,'Niesel'],[/freezing rain/gi,'gefrierender Regen'],[/rain/gi,'Regen'],[/snow/gi,'Schnee'],[/sleet/gi,'Graupel'],[/hail/gi,'Hagel'],[/foggy/gi,'neblig'],[/fog/gi,'Nebel'],[/mist|haze/gi,'Dunst'],[/windy|breezy/gi,'windig'],[/light/gi,'leichter'],[/heavy/gi,'starker'],[/moderate/gi,'mäßiger'],[/very/gi,'sehr'],[/scattered/gi,'vereinzelte'],[/broken/gi,'aufgelockerte'],[/few/gi,'wenige']];
  function wTrans(t){if(t==null||t==='')return t;var k=String(t).trim().toLowerCase();if(WTR[k])return WTR[k];var s=String(t),hit=false;WTRW.forEach(function(p){if(p[0].test(s)){s=s.replace(p[0],p[1]);hit=true;}});return hit?s:t;}
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
    var j=null;
    if(typeof raw==='string'){
      var s=raw.replace(/^﻿/,'').replace(/^\s+/,'');
      if(/^[aOsibdN]:/.test(s)||s.charAt(0)==='N'&&s.charAt(1)===';')j=phpUnser(s); // PHP-serialisiert
      if(j==null){try{j=JSON.parse(raw);}catch(e){}}                                 // sonst JSON
    } else j=raw;
    if(!j||typeof j!=='object')return null;
    var f=(fmt&&fmt!=='auto')?fmt:wDetect(j);if(!f)return null;
    var cur=null,days=[],hours=[];
    if(f==='owm'){
      if(j.current){var cw=(j.current.weather&&j.current.weather[0])||{};cur={temp:j.current.temp,cond:cw.description||cw.main,icon:owmIcon(cw),humidity:j.current.humidity,wind:_msKmh(j.current.wind_speed)};}
      (j.daily||[]).forEach(function(d){var dw=(d.weather&&d.weather[0])||{};days.push({hi:d.temp&&d.temp.max,lo:d.temp&&d.temp.min,cond:dw.description||dw.main,icon:owmIcon(dw),pop:(d.pop!=null)?Math.round(d.pop*100):null,ts:d.dt||null,feels:(d.feels_like&&d.feels_like.day),hum:d.humidity,wind:_msKmh(d.wind_speed),gust:_msKmh(d.wind_gust),wdir:d.wind_deg,press:d.pressure,clouds:d.clouds,uv:d.uvi,precip:(d.rain!=null?d.rain:(d.snow!=null?d.snow:0))});});
      // Stundenwerte stecken im selben OneCall-JSON. Sie werden in DIESELBE Struktur wie
      // die Tage gebracht - dadurch greift die gesamte vorhandene Darstellung mit Icon,
      // Temperaturbalken und Regenwahrscheinlichkeit, statt daneben etwas Eigenes zu bauen.
      (j.hourly||[]).forEach(function(x){var xw=(x.weather&&x.weather[0])||{};
        hours.push({hi:x.temp,lo:x.temp,cond:xw.description||xw.main,icon:owmIcon(xw),
                    pop:(x.pop!=null)?Math.round(x.pop*100):null,ts:x.dt||null,
                    feels:x.feels_like,hum:x.humidity,wind:_msKmh(x.wind_speed),gust:_msKmh(x.wind_gust),wdir:x.wind_deg,press:x.pressure,clouds:x.clouds,uv:x.uvi,precip:(x.rain&&x.rain['1h'])||0});});
    } else if(f==='tempest'){
      var uw=((j.units&&j.units.units_wind)||'').toLowerCase();
      var windC=function(v){if(v==null)return null;if(/mph/.test(uw))return v*1.60934;if(/kt|knot/.test(uw))return v*1.852;if(/kph|km/.test(uw))return v;if(/mps|m\/s/.test(uw))return v*3.6;return _msKmh(v);};
      var cc=j.current_conditions;if(cc)cur={temp:cc.air_temperature,cond:cc.conditions,icon:tempestIcon(cc.icon)||wCondIcon(cc.conditions),humidity:cc.relative_humidity,wind:windC(cc.wind_avg)};
      var hrsAll=(j.forecast&&j.forecast.hourly)||[]; // Tempest liefert im Tages-Forecast weder Regenmenge noch Wind -> aus den Stunden je Tag aggregieren
      var dl=(j.forecast&&j.forecast.daily)||[];dl.forEach(function(d){
        var ds=d.day_start_local||null,de=(ds!=null)?ds+86400:null;
        var psum=0,pn=0,wmax=null,gmax=null,wdirAt=null,hsum=0,hn=0,prsum=0,prn=0;
        if(ds!=null)hrsAll.forEach(function(h){if(!h||h.time==null||h.time<ds||h.time>=de)return;
          if(h.precip!=null){psum+=h.precip;pn++;}
          var wv=windC(h.wind_avg);if(wv!=null&&(wmax==null||wv>wmax)){wmax=wv;wdirAt=h.wind_direction;}
          var gv=windC(h.wind_gust);if(gv!=null&&(gmax==null||gv>gmax))gmax=gv;
          if(h.relative_humidity!=null){hsum+=h.relative_humidity;hn++;}
          if(h.sea_level_pressure!=null){prsum+=h.sea_level_pressure;prn++;}
        });
        days.push({hi:d.air_temp_high,lo:d.air_temp_low,cond:d.conditions,icon:tempestIcon(d.icon)||wCondIcon(d.conditions),
          pop:(d.precip_probability!=null)?Math.round(d.precip_probability):null,ts:ds,
          precip:pn?Math.round(psum*10)/10:null,wind:(wmax!=null)?Math.round(wmax):null,gust:(gmax!=null)?Math.round(gmax):null,
          wdir:wdirAt,hum:hn?Math.round(hsum/hn):null,press:prn?Math.round(prsum/prn):null});
      });
      var hl=(j.forecast&&j.forecast.hourly)||[];hl.forEach(function(h){hours.push({hi:h.air_temperature,lo:h.air_temperature,cond:h.conditions,icon:tempestIcon(h.icon)||wCondIcon(h.conditions),pop:(h.precip_probability!=null)?Math.round(h.precip_probability):null,ts:h.time||null,feels:h.feels_like,hum:h.relative_humidity,wind:windC(h.wind_avg),gust:windC(h.wind_gust),wdir:h.wind_direction,press:h.sea_level_pressure,clouds:null,uv:h.uv,precip:h.precip});});
    } else if(f==='openmeteo'){
      if(j.current)cur={temp:j.current.temperature_2m,cond:wmoText(j.current.weather_code),icon:wmoIcon(j.current.weather_code),humidity:j.current.relative_humidity_2m,wind:j.current.wind_speed_10m};
      var dd=j.daily;if(dd&&dd.time){for(var i=0;i<dd.time.length;i++){var wc=dd.weather_code&&dd.weather_code[i];var dts=dd.time[i]?Math.floor(new Date(dd.time[i]).getTime()/1000):null;days.push({hi:dd.temperature_2m_max&&dd.temperature_2m_max[i],lo:dd.temperature_2m_min&&dd.temperature_2m_min[i],cond:wmoText(wc),icon:wmoIcon(wc),pop:dd.precipitation_probability_max?dd.precipitation_probability_max[i]:null,ts:dts,wind:dd.wind_speed_10m_max?dd.wind_speed_10m_max[i]:null,gust:dd.wind_gusts_10m_max?dd.wind_gusts_10m_max[i]:null,wdir:dd.wind_direction_10m_dominant?dd.wind_direction_10m_dominant[i]:null,uv:dd.uv_index_max?dd.uv_index_max[i]:null,precip:dd.precipitation_sum?dd.precipitation_sum[i]:null});}}
      var hd=j.hourly;if(hd&&hd.time){for(var hi=0;hi<hd.time.length;hi++){var whc=hd.weather_code&&hd.weather_code[hi];var hts=hd.time[hi]?Math.floor(new Date(hd.time[hi]).getTime()/1000):null;var ht=hd.temperature_2m&&hd.temperature_2m[hi];hours.push({hi:ht,lo:ht,cond:wmoText(whc),icon:wmoIcon(whc),pop:hd.precipitation_probability?hd.precipitation_probability[hi]:null,ts:hts,feels:hd.apparent_temperature?hd.apparent_temperature[hi]:null,hum:hd.relative_humidity_2m?hd.relative_humidity_2m[hi]:null,wind:hd.wind_speed_10m?hd.wind_speed_10m[hi]:null,gust:hd.wind_gusts_10m?hd.wind_gusts_10m[hi]:null,wdir:hd.wind_direction_10m?hd.wind_direction_10m[hi]:null,press:hd.pressure_msl?hd.pressure_msl[hi]:null,clouds:hd.cloud_cover?hd.cloud_cover[hi]:null,uv:hd.uv_index?hd.uv_index[hi]:null,precip:hd.precipitation?hd.precipitation[hi]:null});}}
    } else if(f==='flat'){
      var t=(j.temp!=null?j.temp:j.temperature),cnd=(j.condition||j.conditions||j.description);
      cur={temp:t,cond:cnd,icon:(j.icon?(tempestIcon(j.icon)||wCondIcon(j.icon)):wCondIcon(cnd)),humidity:(j.humidity!=null?j.humidity:j.relative_humidity),wind:(j.wind!=null?j.wind:(j.wind_speed!=null?j.wind_speed:j.windspeed))};
    }
    return {fmt:f,cur:cur,days:days,hours:hours};
  }
  // Anzeigename der erkannten Datenquelle (für den kleinen Quellen-Badge)
  function wSrcLabel(fmt){return ({owm:'OpenWeatherMap',tempest:'Tempest',openmeteo:'Open-Meteo',flat:'JSON'})[fmt]||(fmt?String(fmt):'');}
  // Kleinen Quellen-Hinweis in der Ecke des Widgets setzen/ausblenden (geteilt von Wetter/Wetter+/Meteogramm)
  function wSetSrcBadge(w,fmt){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var b=el.querySelector(':scope > .wsrc');var show=(w.showSrc!==false)&&fmt;
    if(show){if(!b){b=document.createElement('span');b.className='wsrc';el.appendChild(b);}b.textContent=wSrcLabel(fmt);b.style.display='';}
    else if(b){b.style.display='none';}
  }
  function _wt(n,dec){if(n==null||n==='')return null;var v=parseFloat(n);if(isNaN(v))return null;return (dec?(Math.round(v*10)/10):Math.round(v));}
  function _wtxt(n,dec){var v=_wt(n,dec);return v==null?'–':String(v).replace('.',',');}
  // Mini-Icons für die Stunden-Zusatzwerte (klein, damit das Wetter-Icon prominent bleibt)
  var _dropMI='<svg class="mi" style="fill:currentColor;stroke:none" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
  var _windMI='<svg class="mi" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24">'+((ICONS.wind||[])[1]||'')+'</svg>';
  var _rainMI='<svg class="mi" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24">'+((ICONS.rain||[])[1]||'')+'</svg>';
  // Ein einzelner Zusatzwert (jede Stunden-Spalte kann mehrere übereinander zeigen). 'pr' = Regen% · mm nebeneinander.
  function _hmFill(m,d,unit){if(!d)return '';
    switch(m){
      case 'hum':   return (d.hum!=null)?(_dropMI+_wtxt(d.hum)+' %'):'';
      case 'wind':  return (d.wind!=null)?(_windMI+_wtxt(d.wind)+' km/h'):'';
      case 'gust':  return (d.gust!=null)?(_windMI+_wtxt(d.gust)+' km/h'):'';
      case 'press': return (d.press!=null)?(_wtxt(d.press)+' hPa'):'';
      case 'feels': return (d.feels!=null)?(_wtxt(d.feels)+unit):'';
      case 'clouds':return (d.clouds!=null)?(_wtxt(d.clouds)+' %'):'';
      case 'uv':    return (d.uv!=null)?('UV '+_wtxt(d.uv,1)):'';
      case 'pr':    var s=(d.pop!=null)?(_rainMI+_wtxt(d.pop)+' %'):'';
                    if(d.precip!=null&&d.precip>0)s+='<span class="prmm">'+_wtxt(d.precip,1)+' mm</span>'; return s;
      default: return '';
    }
  }
  // --- füllt das Widget aus der JSON-Variable ---
  var _dropSVG='<svg class="hwmic" style="fill:currentColor;stroke:none" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
  /**
   * Zusatzzeile fuellen. Vorrang nach Auffaelligkeit: Gewitter, dann Regen, dann Nebel -
   * dieselbe Reihenfolge, nach der auch die Wetterlage getextet wird. Es gibt bewusst nur
   * EINE Zeile: stapelt man sie, waechst die Karte je nach Wetter unterschiedlich hoch und
   * verschiebt darunterliegende Kacheln.
   */
  var _WB_IC={
    storm:'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
    rain :'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 13l-2 6M12 13l-2 6M16 13l-2 6"/><path d="M5 10a6 6 0 0 1 11-3 5 5 0 0 1 8 3" opacity=".6"/></svg>',
    fog  :'<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12h18M5 17h14M7 22h10"/></svg>'
  };
  function wBand(w,el,_ln,_lt){
    var box=el.querySelector('[data-role=wband]'); if(!box) return;
    var ic=el.querySelector('[data-role=wbic]'), tx=el.querySelector('[data-role=wbtx]'), sx=el.querySelector('[data-role=wbsx]');
    var kind='', main='', side='';
    var st=_ln(w.vStorm), rr=_ln(w.vRainRate), fg=_ln(w.vFog);
    if(st!=null && st>0){
      kind=(st>=3)?'crit':((st>=2)?'warn':'faint');
      var d=_ln(w.vStormDist), n=_ln(w.vStormRate), age=_ln(w.vStormAge);
      main=(st>=3)?'Gewitter in der Nähe':((st>=2)?'Gewitter':'Wetterleuchten');
      if(d!=null&&d>0) main+=' · <b>'+_wtxt(d)+' km</b>';
      // Alter aus dem Zeitstempel des letzten Blitzes - in Minuten, das liest sich am schnellsten.
      if(age!=null&&age>1e9){var m=Math.max(0,Math.round((Date.now()/1000-age)/60));main+=' vor <b>'+m+' min</b>';}
      if(n!=null&&n>1) side=n+' Blitze in 30 min';
      box.setAttribute('data-k','storm');
    } else if(rr!=null && rr>0){
      kind='info'; box.setAttribute('data-k','rain');
      main='Regenrate <b>'+_wtxt(rr,1)+' mm/h</b>';
      var dd=_ln(w.vRainDay); if(dd!=null&&dd>0) side='heute '+_wtxt(dd,1)+' mm';
    } else if(fg!=null && fg>0){
      kind='info'; box.setAttribute('data-k','fog');
      main=(fg>=3)?'Dichter Nebel':((fg>=2)?'Nebel':'Diesig');
      var fs=_ln(w.vFogFsi); if(fs!=null&&fs>0) main+=' · <b>FSI '+_wtxt(fs)+'</b>';
    }
    if(kind===''){ box.style.display='none'; return; }
    box.style.display='';
    box.style.setProperty('--bc', kind==='crit'?'var(--crit)':(kind==='warn'?'var(--warm)':(kind==='faint'?'var(--muted)':'var(--info)')));
    if(ic) ic.innerHTML=_WB_IC[box.getAttribute('data-k')]||'';
    if(tx) tx.innerHTML=main;
    if(sx) sx.textContent=side;
  }
  function applyWeather(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var cl=w.varId&&_lastVals[w.varId],cData=cl?parseWeatherJSON(cl.v,w.wfmt):null;              // Aktuell = Variable
    var fl=(w.varId2&&_lastVals[w.varId2])||cl,fData=fl?parseWeatherJSON(fl.v,w.wfmt):cData;       // Vorhersage = Variable2 (sonst dieselbe)
    var unit=(w.wunit!=null?w.wunit:'°'),cur=cData&&cData.cur;
    wSetSrcBadge(w,(fData&&fData.fmt)||(cData&&cData.fmt));   // Quellen-Badge (vor den früh­en returns setzen)
    // je aktuellem Wert optional eine Variable; sonst Fallback aufs JSON
    var _ln=function(id){var lv=id&&_lastVals[id];if(!lv)return null;var n=parseFloat(String(lv.v).replace(',','.'));return isNaN(n)?null:n;};
    var _lt=function(id){var lv=id&&_lastVals[id];if(!lv)return null;return (lv.f!=null&&lv.f!=='')?lv.f:String(lv.v);};
    var _lb=function(id){var lv=id&&_lastVals[id];if(!lv)return false;var v=lv.v;if(v===true||v===1)return true;if(v===false||v===0||v==null)return false;var s=String(v).trim().toLowerCase();if(/^(true|1|on|ja|yes|regen|rain)$/.test(s))return true;var n=parseFloat(s.replace(',','.'));return !isNaN(n)&&n>0;};
    var temp=(w.vTemp&&_ln(w.vTemp)!=null)?_ln(w.vTemp):(cur?cur.temp:null);
    var condHasVar=(w.vCond&&_lt(w.vCond)!=null),condTxt=condHasVar?_lt(w.vCond):(cur?cur.cond:null);
    var icon=condHasVar?wCondIcon(condTxt):((cur&&cur.icon)||w.icon||'cloudsun');
    if(w.vRain&&_lb(w.vRain)){icon='rain';if(!condHasVar)condTxt='Regen';}   // Regen-Variable true -> Aktuell auf Regen erzwingen
    var hum=(w.vHum&&_ln(w.vHum)!=null)?_ln(w.vHum):(cur?cur.humidity:null);
    var wind=(w.vWind&&_ln(w.vWind)!=null)?_ln(w.vWind):(cur?cur.wind:null);
    var ci=el.querySelector('[data-role=cico]');if(ci)ci.innerHTML=iconSVG(icon);
    var ct=el.querySelector('[data-role=val]');if(ct)ct.textContent=(temp!=null)?(_wtxt(temp,1)+unit):'–';
    var cs=el.querySelector('[data-role=sub]');if(cs)cs.textContent=(condTxt)?wTrans(condTxt):((cData||condHasVar)?'':'keine/ungültige Daten');
    var hu=el.querySelector('[data-role=hum]');if(hu)hu.innerHTML=(hum!=null)?(_dropSVG+_wtxt(hum)+' %'):'';
    var wi=el.querySelector('[data-role=wind]');if(wi)wi.innerHTML=(wind!=null)?('<svg class="hwmic" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round" viewBox="0 0 24 24">'+((ICONS.wind||[])[1]||'')+'</svg>'+_wtxt(wind)+' km/h'):'';
    wBand(w,el,_ln,_lt);
    if(!wExt(w))return;
    // Stundenmodus nutzt DIESELBEN Slots wie der Tagesmodus. Die Beschriftung wird zur
    // Uhrzeit, hi und lo sind beide die Stundentemperatur - der Balken wird damit zum Punkt
    // auf der Skala statt zu einer Spanne. Alles andere (Icon, Regen, Farbverlauf) bleibt.
    var _hMode=(w.fcMode==='hours');
    var days=(fData&&(_hMode?fData.hours:fData.days))||[],
        start=(w.fcStart!=null?w.fcStart:0),showPq=(w.showPq!==false);
    // Stunden ab „jetzt" (Quelle liefert oft alle 24h ab Mitternacht) -> vergangene Stunden überspringen
    if(_hMode){var _now=Date.now()/1000,_si=0;for(var _k=0;_k<days.length;_k++){if(days[_k]&&days[_k].ts&&days[_k].ts>=_now-1800){_si=_k;break;}}start=_si;
      el.querySelectorAll('.hwp2hr').forEach(function(col,i){var d=days[start+i];
        var hEl=col.querySelector('.h');if(hEl)hEl.textContent=(d&&d.ts)?(('0'+new Date(d.ts*1000).getHours()).slice(-2)+':00'):'';
        var icEl=col.querySelector('.ic');if(icEl)icEl.innerHTML=iconSVG((d&&d.icon)||'cloudsun');
        var tEl=col.querySelector('.t');if(tEl)tEl.textContent=d?(_wtxt(d.hi)+unit):'–';
        col.querySelectorAll('[data-m]').forEach(function(sp){sp.innerHTML=_hmFill(sp.getAttribute('data-m'),d,unit);});});
      return;}
    // Skala fuer Temperaturbalken
    var his=[],los=[];days.forEach(function(d){var h=_wt(d.hi,1),l=_wt(d.lo,1);if(h!=null)his.push(h);if(l!=null)los.push(l);});
    var gmin=(w.gmin!=null&&w.gmin!=='')?parseFloat(w.gmin):(los.length?Math.min.apply(null,los)-1:-10);
    var gmax=(w.gmax!=null&&w.gmax!=='')?parseFloat(w.gmax):(his.length?Math.max.apply(null,his)+1:40);if(gmax<=gmin)gmax=gmin+1;
    el.querySelectorAll('.hwp2day').forEach(function(row,i){
      var d=days[start+i];
      var dEl=row.querySelector('.d');
      if(dEl)dEl.textContent=_hMode
        ? (d&&d.ts ? (('0'+new Date(d.ts*1000).getHours()).slice(-2)+':00') : '')
        : ((d&&d.ts)?wDayLabelTs(d.ts):wDayLabel(start+i));
      var icEl=row.querySelector('.ic');if(icEl)icEl.innerHTML=iconSVG((d&&d.icon)||'cloudsun');
      var loEl=row.querySelector('.lo');if(loEl)loEl.textContent=d?(_wtxt(d.lo)+unit):'–';
      var hiEl=row.querySelector('.hi');if(hiEl)hiEl.textContent=d?(_wtxt(d.hi)+unit):'–';
      var pqEl=row.querySelector('.pq');if(pqEl)pqEl.innerHTML=(showPq&&d&&d.pop!=null&&d.pop>0)?('<svg class="hwpqi" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>'+d.pop+'%'):'';
      var fill=row.querySelector('.fill');if(fill){var h=d?_wt(d.hi,1):null,l=d?_wt(d.lo,1):null;if(h==null||l==null){fill.style.width='0';}else{var lp=(l-gmin)/(gmax-gmin)*100,hp=(h-gmin)/(gmax-gmin)*100;fill.style.left=Math.max(0,Math.min(100,lp))+'%';fill.style.width=Math.max(3,Math.min(100,hp)-Math.max(0,lp))+'%';fill.style.background='linear-gradient(90deg,'+tColor(l,w.tgrad)+','+tColor(h,w.tgrad)+')';}}
      // Aktuelle Temperatur als kleiner Knopf – nur in der Heute-Zeile
      var cn=row.querySelector('.cnow');if(cn){var isToday=d&&((d.ts&&wDayLabelTs(d.ts)==='Heute')||(!d.ts&&(start+i)===0));if(isToday&&temp!=null){var cp=(temp-gmin)/(gmax-gmin)*100;cn.style.left=Math.max(0,Math.min(100,cp))+'%';cn.style.display='block';}else{cn.style.display='none';}}
    });
  }
  function wJsonProps(w){ // gemeinsame Props: Format, Einheit + Hinweis auf die JSON-Variable
    return '<div class="hint" style="font-size:11px;color:var(--muted)">„Variable" oben = <b>eine String-Variable mit JSON</b> (OpenWeatherMap, Tempest oder Open-Meteo).</div>'
      +row('Format','<select id="pWFmt"><option value="auto"'+((w.wfmt||'auto')==='auto'?' selected':'')+'>Automatisch erkennen</option><option value="owm"'+(w.wfmt==='owm'?' selected':'')+'>OpenWeatherMap</option><option value="tempest"'+(w.wfmt==='tempest'?' selected':'')+'>Tempest / WeatherFlow</option><option value="openmeteo"'+(w.wfmt==='openmeteo'?' selected':'')+'>Open-Meteo</option></select>')
      +row('Temp-Einheit','<input id="pWUnit" value="'+esc(w.wunit!=null?w.wunit:'°')+'" style="width:60px" placeholder="°">')
      +'<div class="pgh">Aktuelle Werte (optional als Variable)</div>'
      +fieldPick(w,'vTemp','Temperatur')+fieldPick(w,'vCond','Zustand')+fieldPick(w,'vHum','Feuchte %')+fieldPick(w,'vWind','Wind km/h')+fieldPick(w,'vRain','Regen (bool)')
      +'<div class="pgh">Zusatzzeile (erscheint nur bei Bedarf)</div>'
      +fieldPick(w,'vStorm','Gewitter-Stufe 0-3')+fieldPick(w,'vStormDist','Gewitter km')+fieldPick(w,'vStormAge','letzter Blitz (Zeit)')+fieldPick(w,'vStormRate','Blitze/30 min')
      +fieldPick(w,'vRainRate','Regenrate mm/h')+fieldPick(w,'vRainDay','Regen heute mm')
      +fieldPick(w,'vFog','Nebel-Stufe 0-3')+fieldPick(w,'vFogFsi','Nebel FSI')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Vorrang: <b>Gewitter</b> vor <b>Regen</b> vor <b>Nebel</b> - es wird immer nur EINE Zeile gezeigt. Ohne Bindung bleibt sie weg.</div>'
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Leer = Wert aus dem JSON. Zustand-Variable liefert Text → Icon automatisch. <b>Regen</b>: ist die Variable wahr (true/1/&gt;0), wird die aktuelle Anzeige auf Regen gesetzt.</div>'
      +row('Datenquelle anzeigen','<input type="checkbox" id="pWShowSrc"'+((w.showSrc!==false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">kleiner Hinweis in der Ecke (z.&nbsp;B. Tempest)</span>');
  }
  function wJsonWire(w){
    if($('#pWFmt'))$('#pWFmt').onchange=function(){w.wfmt=this.value;render();applyWeather(w);commit();};
    if($('#pWUnit'))$('#pWUnit').oninput=function(){w.wunit=this.value;render();applyWeather(w);};
    if($('#pWShowSrc'))$('#pWShowSrc').onchange=function(){w.showSrc=this.checked?undefined:false;applyWeather(w);commit();};
  }
  function _wMount(w){applyWeather(w);}
  function _wLive(w,el,id,d,base,txt,on){applyWeather(w);return true;}
  // Erweiterter Stil (Aktuell + Vorhersage): via w.wstyle oder Alt-Typ 'weatherpro'
  function wExt(w){return w.wstyle==='extended'||w.type==='weatherpro';}
  function wEnsureExt(w){if(w.days==null)w.days=5;if(w.fcStart==null)w.fcStart=0;if(w.showPq===undefined)w.showPq=true;if(!w.tgrad)w.tgrad=[{t:-5,color:'#4aa3ff'},{t:4,color:'#3bd6c6'},{t:14,color:'#39d08a'},{t:22,color:'#f2b441'},{t:32,color:'#f2685a'}];}
  // Zusatzzeile ("Band") unter dem Ist-Zustand: Gewitter, Regenrate oder Nebel - je nachdem,
  // was gerade zutrifft. Sie ist NUR da, wenn es etwas zu sagen gibt (sonst display:none),
  // damit die Karte bei ruhigem Wetter nicht mit einer leeren Zeile dasteht.
  var _wBand='<div class="hwband" data-role="wband" style="display:none"><span class="ic" data-role="wbic"></span>'
           + '<span class="tx" data-role="wbtx"></span><span class="sx" data-role="wbsx"></span></div>';
  var _wCurBlock='<div class="hwp2cur"><span class="hwp2ic" data-role="cico"></span><span class="hwp2ci"><span class="hwp2t" data-role="val">–</span><span class="hwp2sub"><span data-role="sub"></span></span><span class="hwmetrow"><span class="hwmet" data-role="wind"></span><span class="hwmet" data-role="hum"></span></span></span></div>';
  function wRenderFn(w){
    if(wExt(w)){wEnsureExt(w);var n=Math.max(1,Math.min(12,w.days||5)),i;
      // Stundenmodus: horizontale Spalten (Uhrzeit / Icon / Temp / Regen% je Stunde), füllt die Breite.
      if(w.fcMode==='hours'){
        var mspec=[];if(w.hHum!==false)mspec.push('hum');if(w.hWind!==false)mspec.push('wind');if(w.hPress!==false)mspec.push('press');if(w.hPrecip!==false)mspec.push('pr');
        var cols='';for(i=0;i<n;i++){var ms='';mspec.forEach(function(m){ms+='<span class="m '+m+'" data-m="'+m+'"></span>';});cols+='<div class="hwp2hr" data-i="'+i+'"><span class="h">–</span><span class="ic"></span><span class="t">–</span>'+ms+'</div>';}
        var strip='<div class="hwp2hrs">'+cols+'</div>';
        if(w.hideCur)return '<div class="hwp2">'+strip+'</div>';
        return '<div class="hwp2">'+_wCurBlock.replace('data-role="cico">','data-role="cico">'+iconSVG(w.icon||'cloudsun'))+_wBand+strip+'</div>';}
      // Tagesmodus: eine Zeile je Tag mit Temperatur-Bereichsbalken (unverändert).
      var slots='';for(i=0;i<n;i++)slots+='<div class="hwp2day" data-i="'+i+'"><span class="d">–</span><span class="ic"></span><span class="lo">–</span><div class="trk"><i class="fill"></i><i class="cnow"></i></div><span class="hi">–</span><span class="pq"></span></div>';
      // Der Aktuell-Block laesst sich abschalten: Stehen zwei Vorhersagekarten nebeneinander,
      // zeigen beide denselben Ist-Zustand - einmal genuegt, und die Zeilen bekommen den Platz.
      if(w.hideCur)return '<div class="hwp2"><div class="hwp2grid">'+slots+'</div></div>';
      return '<div class="hwp2">'+_wCurBlock.replace('data-role="cico">','data-role="cico">'+iconSVG(w.icon||'cloudsun'))+_wBand+'<div class="hwp2days">'+slots+'</div></div>';}
    return '<div class="hwf hwf-cur"><div class="hwbig"><div class="hwbigico" data-role="cico">'+iconSVG(w.icon||'cloudsun')+'</div><div class="hwbigci"><div class="hwbigt" data-role="val">–</div><div class="hwbigsub"><span data-role="sub"></span></div><div class="hwmetrow"><span class="hwmet" data-role="wind"></span><span class="hwmet" data-role="hum"></span></div></div></div>'+_wBand+'</div>';
  }
  function wPropsFn(w){
    var ext=wExt(w);
    var sty=(w.type==='weatherpro')?'':row('Stil','<select id="pWStyle"><option value="standard"'+(!ext?' selected':'')+'>Standard (nur Aktuell)</option><option value="extended"'+(ext?' selected':'')+'>Erweitert (+ Vorhersage)</option></select>');
    // Vorhersage-Selektor ganz oben (Editor-Prop, speicherbar): Täglich <-> Stündlich + Anzahl. „Erster Tag" nur täglich.
    var fcSel=ext?('<div class="pgh">Vorhersage</div>'
      +row('Modus','<select id="pFcMode"><option value=""'+(w.fcMode!=='hours'?' selected':'')+'>Täglich</option><option value="hours"'+(w.fcMode==='hours'?' selected':'')+'>Stündlich</option></select>')
      +row((w.fcMode==='hours'?'Anzahl Stunden':'Vorhersage-Tage'),'<input id="pWDays" type="number" min="1" max="12" value="'+(w.days||5)+'">')
      +(w.fcMode==='hours'?('<div class="pgh">Zusatzwerte je Stunde (einzeln zuschaltbar)</div>'
        +row('Luftfeuchte','<input type="checkbox" id="pHHum"'+(w.hHum!==false?' checked':'')+'>')
        +row('Wind','<input type="checkbox" id="pHWind"'+(w.hWind!==false?' checked':'')+'>')
        +row('Luftdruck','<input type="checkbox" id="pHPress"'+(w.hPress!==false?' checked':'')+'>')
        +row('Niederschlag (% · mm)','<input type="checkbox" id="pHPrecip"'+(w.hPrecip!==false?' checked':'')+'>')):'')
      +(w.fcMode==='hours'?'':row('Erster Tag','<select id="pFcStart"><option value="0"'+((w.fcStart||0)===0?' selected':'')+'>Heute</option><option value="1"'+(w.fcStart===1?' selected':'')+'>Morgen</option></select>'))):'';
    var pr=sty+fcSel+wJsonProps(w);
    if(ext)pr+=row('Aktuell-Block','<input type="checkbox" id="pHideCur"'+(w.hideCur?'':' checked')+'> <span style="font-size:11px;color:var(--muted)">Ist-Zustand oben zeigen</span>')
      +row('Regenwahrsch.','<input type="checkbox" id="pShowPq"'+((w.showPq!==false)?' checked':'')+'>')
      +'<div class="pgh">Temperaturbalken</div>'+tgradEditor(w)+row('Skala Min/Max','<input id="pGmin" type="number" style="width:60px" value="'+(w.gmin!=null?w.gmin:'')+'" placeholder="auto"> <input id="pGmax" type="number" style="width:60px" value="'+(w.gmax!=null?w.gmax:'')+'" placeholder="auto">');
    return pr;
  }
  function wWireFn(w){
    wJsonWire(w);
    if($('#pWStyle'))$('#pWStyle').onchange=function(){w.wstyle=(this.value==='extended')?'extended':undefined;if(w.wstyle==='extended')wEnsureExt(w);render();renderProps();applyWeather(w);commit();};
    if(wExt(w)){
      if($('#pHideCur'))$('#pHideCur').onchange=function(){w.hideCur=this.checked?undefined:true;render();applyWeather(w);commit();};
      if($('#pFcMode'))$('#pFcMode').onchange=function(){w.fcMode=(this.value==='hours')?'hours':undefined;render();renderProps();applyWeather(w);commit();};
      [['pHHum','hHum'],['pHWind','hWind'],['pHPress','hPress'],['pHPrecip','hPrecip']].forEach(function(p){var _e=$('#'+p[0]);if(_e)_e.onchange=function(){w[p[1]]=this.checked?undefined:false;render();applyWeather(w);commit();};});
      if($('#pWDays'))$('#pWDays').oninput=function(){w.days=Math.max(1,Math.min(12,parseInt(this.value)||5));render();applyWeather(w);commit();};
      if($('#pFcStart'))$('#pFcStart').onchange=function(){w.fcStart=parseInt(this.value);render();applyWeather(w);commit();};
      if($('#pShowPq'))$('#pShowPq').onchange=function(){w.showPq=this.checked;render();applyWeather(w);commit();};
      $$('#props [data-tg]').forEach(function(inp){
        inp.oninput=function(){var pr=inp.getAttribute('data-tg').split('.'),k=pr[0],i=+pr[1];if(!w.tgrad||!w.tgrad[i])return;w.tgrad[i][k]=(k==='t')?(parseFloat(inp.value)||0):inp.value;applyWeather(w);commit();};
        inp.onchange=function(){if(inp.getAttribute('data-tg').split('.')[0]==='t'&&w.tgrad){w.tgrad.sort(function(a,b){return (a.t||0)-(b.t||0);});renderProps();applyWeather(w);commit();}};
      });
      $$('#props [data-tgdel]').forEach(function(b){b.onclick=function(){w.tgrad.splice(+b.getAttribute('data-tgdel'),1);renderProps();applyWeather(w);commit();};});
      if($('#tgAdd'))$('#tgAdd').onclick=function(){if(!w.tgrad)w.tgrad=[];w.tgrad.push({t:20,color:'#f2b441'});renderProps();applyWeather(w);commit();};
      if($('#pGmin'))$('#pGmin').oninput=function(){w.gmin=this.value===''?undefined:parseFloat(this.value);applyWeather(w);commit();};
      if($('#pGmax'))$('#pGmax').oninput=function(){w.gmax=this.value===''?undefined:parseFloat(this.value);applyWeather(w);commit();};
    }
  }
  // Ein Wetter-Widget mit Stil-Umschaltung (Standard/Erweitert)
  defWidget('weather',{label:'Wetter', cat:'Wetter & Zeit', paletteIcon:'cloudsun', size:[240,130], defaults:function(w){w.label='';w.wfmt='auto';}, render:wRenderFn, props:wPropsFn, wire:wWireFn, mount:_wMount, live:_wLive});
  // Alt-Typ (bestehende „Wetter+"-Widgets weiterhin gültig; nicht mehr in der Palette)
  defWidget('weatherpro',{label:'Wetter+', cat:'Wetter & Zeit', noPalette:true, paletteIcon:'cloudsun', size:[340,220], defaults:function(w){w.label='';w.wfmt='auto';wEnsureExt(w);}, render:wRenderFn, props:wPropsFn, wire:wWireFn, mount:_wMount, live:_wLive});
