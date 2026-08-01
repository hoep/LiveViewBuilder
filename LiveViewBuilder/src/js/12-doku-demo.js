  // ===== Doku-Demodaten: KEINE echten Variablen ======================================
  //
  // Die Doku-Seite darf keine produktiven Variablen anfassen. Stattdessen ein Pool
  // kuenstlicher IDs (900xxx) mit fest gesetzten Werten. buildDokuStore lenkt jede in den
  // generierten Demos hinterlegte echte ID auf ihren Demo-Zwilling um (DOKU_REMAP), und
  // beim Start werden die Demo-Werte in _lastVals gesaet.
  //
  // Klicks sollen trotzdem wirken: Im Doku-Modus schreibt setVar NICHT an den Server,
  // sondern aktualisiert den Demo-Wert lokal und zeichnet neu (siehe dokuSetVar). So
  // schalten Schalter, Regler bewegen sich, das Licht dimmt - alles ohne echte Variable.

  var _DID = {                          // id : [wert, formatiert, einheit]
    900001:[22.4,'22,4 °C',' °C'],      900002:[false,'Aus',''],
    900003:[45,'45 %',' %'],           900004:[72,'72 %',' %'],
    900005:[1850,'1.850 W',' W'],      900006:[12345.6,'12.345,6 kWh',' kWh'],
    900007:['Teilweise bewölkt','Teilweise bewölkt',''], 900008:[false,'Unscharf',''],
    900009:[1785596400,'06:12',''],    900010:[1785640000,'20:41',''],
    900011:["{\"lat\":48.0,\"lon\":14.1,\"timezone\":\"Europe/Vienna\",\"current\":{\"dt\":1785600000,\"sunrise\":1785596400,\"sunset\":1785640000,\"temp\":22.4,\"feels_like\":22.0,\"humidity\":55,\"pressure\":1015,\"dew_point\":12.6,\"uvi\":3.2,\"clouds\":40,\"wind_speed\":3.3,\"wind_deg\":180,\"weather\":[{\"id\":802,\"main\":\"Clouds\",\"description\":\"Teilweise bew\\u00f6lkt\",\"icon\":\"02d\"}]},\"hourly\":[{\"dt\":1785600000,\"temp\":22,\"pop\":0.0,\"wind_speed\":2.0,\"weather\":[{\"description\":\"Klarer Himmel\",\"icon\":\"01d\"}]},{\"dt\":1785603600,\"temp\":23,\"pop\":0.0,\"wind_speed\":2.3,\"weather\":[{\"description\":\"Teilweise bew\\u00f6lkt\",\"icon\":\"02d\"}]},{\"dt\":1785607200,\"temp\":24,\"pop\":0.1,\"wind_speed\":2.6,\"weather\":[{\"description\":\"Teilweise bew\\u00f6lkt\",\"icon\":\"02d\"}]},{\"dt\":1785610800,\"temp\":23,\"pop\":0.3,\"wind_speed\":2.9,\"weather\":[{\"description\":\"Bew\\u00f6lkt\",\"icon\":\"03d\"}]},{\"dt\":1785614400,\"temp\":21,\"pop\":0.6,\"wind_speed\":3.2,\"weather\":[{\"description\":\"Leichter Regen\",\"icon\":\"10d\"}]},{\"dt\":1785618000,\"temp\":19,\"pop\":0.8,\"wind_speed\":3.5,\"weather\":[{\"description\":\"M\\u00e4\\u00dfiger Regen\",\"icon\":\"10n\"}]},{\"dt\":1785621600,\"temp\":18,\"pop\":0.7,\"wind_speed\":3.8,\"weather\":[{\"description\":\"Leichter Regen\",\"icon\":\"10n\"}]},{\"dt\":1785625200,\"temp\":17,\"pop\":0.4,\"wind_speed\":4.1,\"weather\":[{\"description\":\"Bedeckt\",\"icon\":\"04n\"}]},{\"dt\":1785628800,\"temp\":17,\"pop\":0.2,\"wind_speed\":4.4,\"weather\":[{\"description\":\"Wolkig\",\"icon\":\"03n\"}]},{\"dt\":1785632400,\"temp\":18,\"pop\":0.1,\"wind_speed\":4.699999999999999,\"weather\":[{\"description\":\"Teilweise bew\\u00f6lkt\",\"icon\":\"02n\"}]},{\"dt\":1785636000,\"temp\":20,\"pop\":0.0,\"wind_speed\":5.0,\"weather\":[{\"description\":\"Klar\",\"icon\":\"01n\"}]},{\"dt\":1785639600,\"temp\":21,\"pop\":0.0,\"wind_speed\":5.3,\"weather\":[{\"description\":\"Klar\",\"icon\":\"01n\"}]}],\"daily\":[{\"dt\":1785600000,\"temp\":{\"max\":24,\"min\":13},\"pop\":0.1,\"weather\":[{\"description\":\"Klarer Himmel\",\"icon\":\"01d\"}]},{\"dt\":1785686400,\"temp\":{\"max\":28,\"min\":15},\"pop\":0.0,\"weather\":[{\"description\":\"Teilweise bew\\u00f6lkt\",\"icon\":\"01d\"}]},{\"dt\":1785772800,\"temp\":{\"max\":26,\"min\":14},\"pop\":0.2,\"weather\":[{\"description\":\"Teilweise bew\\u00f6lkt\",\"icon\":\"02d\"}]},{\"dt\":1785859200,\"temp\":{\"max\":22,\"min\":12},\"pop\":0.6,\"weather\":[{\"description\":\"Bew\\u00f6lkt\",\"icon\":\"10d\"}]},{\"dt\":1785945600,\"temp\":{\"max\":20,\"min\":11},\"pop\":0.4,\"weather\":[{\"description\":\"Leichter Regen\",\"icon\":\"04d\"}]},{\"dt\":1786032000,\"temp\":{\"max\":23,\"min\":13},\"pop\":0.1,\"weather\":[{\"description\":\"M\\u00e4\\u00dfiger Regen\",\"icon\":\"02d\"}]},{\"dt\":1786118400,\"temp\":{\"max\":25,\"min\":14},\"pop\":0.0,\"weather\":[{\"description\":\"Leichter Regen\",\"icon\":\"01d\"}]}]}",'',''],
    900012:[60,'60 %',' %'],           900013:[8,'Offen',''],
    900014:['Automatik','Automatik',''],900015:[12,'12',''],
    900016:['<div style="font:13px sans-serif;color:#cfe">Beispiel-HTML aus einer Variablen.</div>','',''],
    900017:[55,'55 %',' %'],           900018:[0.2,'0,2 mm',' mm'],
    900019:[12,'12 km/h',' km/h'],     900020:[180,'180 °','°'],
    900021:[26.4,'26,4 °C',' °C'],     900022:[28,'28 %',' %'],
    900023:[63,'63 %',' %'],           900024:[475,'475 W',' W']
  };

  // echte ID (aus den generierten Demos) -> Demo-ID
  var DOKU_REMAP = {
    41522:900004, 30519:900002, 26109:900001, 38704:900005, 13239:900003, 22090:900008,
    33962:900006, 16467:900010, 48275:900006, 33327:900014, 38122:900007, 40329:900009,
    53186:900011, 21613:900012, 44398:900013, 55099:900015, 16520:900016, 11964:900022,
    10825:900023, 10649:900017, 53423:900018, 39529:900021, 58345:900017, 11410:900005,
    22213:900024, 46587:900005, 54251:900005, 29885:900005, 39594:900011, 26237:900016,
    34861:900007, 39204:900020, 37159:900019
  };
  // jede sonstige echte ID faellt auf einen neutralen Demo-Wert, damit NIE etwas Echtes bindet
  function dokuRemap(id){ if(id==null||id==='')return id; var n=+id; if(!n||n<1000)return id;
    return DOKU_REMAP[n]||(n>=900000?n:900001); }

  // Demo-Werte in _lastVals saeen (v/f/u/c wie ein echter Poll-Datensatz).
  function dokuSeed(){
    var now=Math.floor((typeof Date!=='undefined'?Date.now():0)/1000);
    for(var id in _DID){var e=_DID[id];_lastVals[+id]={v:e[0],f:(e[1]||String(e[0])),u:e[2]||'',c:now};}
  }
  // Klick/Regeln im Doku-Modus: Demo-Wert lokal setzen, formatieren, neu zeichnen.
  function dokuSetVar(id,val){
    id=+id; var e=_DID[id]||[val,'',''];
    var num=parseFloat(String(val).replace(',','.'));
    var f;
    if(val===true||val===false||val===0||val===1||val==='0'||val==='1'){
      var on=(val===true||val===1||val==='1');
      f=(e[2]===' %')?(on?'100 %':'0 %'):(on?'Ein':'Aus'); if(e[2]===' %')val=on?100:0;
    } else if(!isNaN(num)){ f=String(num).replace('.',',')+(e[2]||''); val=num; }
    else { f=String(val); }
    _DID[id]=[val,f,e[2]||''];
    applyVal(id,{v:val,f:f,u:e[2]||'',c:Math.floor((typeof Date!=='undefined'?Date.now():0)/1000)});
  }

  // ----- Chart-Daten im Doku-Modus erfinden -----------------------------------------
  // Diagramme holen ihre Reihen ueber ?api=aggregated / history / agg / cmp. Fuer die
  // Demo-IDs gibt es serverseitig nichts. Deshalb wird fetch im Doku-Modus abgefangen und
  // liefert fuer genau diese Endpunkte einen synthetischen, aber plausiblen Verlauf -
  // eine ruhige Welle, in der Groessenordnung des Demo-Werts der jeweiligen ID.
  function _dokuAnchor(id){var e=_DID[+id];var n=e?parseFloat(String(e[0]).replace(',','.')):NaN;
    return isNaN(n)?50:(n||50);}
  function _dokuWave(base,i,n){ // 0..n-1 -> weiche Welle um base
    var a=Math.abs(base)||1;
    return base*0.55 + a*0.45*(0.5+0.5*Math.sin(i/Math.max(3,n/6)+0.6)) + a*0.06*Math.sin(i*1.7);
  }
  function _dokuAgg(url){
    var q=function(k){var m=url.match(new RegExp('[?&]'+k+'=([^&]*)'));return m?decodeURIComponent(m[1]):'';};
    var id=+q('id'), level=+q('level')||3, to=+q('to')||Math.floor(Date.now()/1000);
    var from=+q('from')||(to-366*86400);
    var step={0:3600,1:86400,2:604800,3:2629800,4:31557600,5:300}[level]||86400;
    var base=_dokuAnchor(id), rows=[], n=Math.max(8,Math.min(60,Math.round((to-from)/step)||24));
    for(var i=0;i<n;i++){var t=from+Math.round((to-from)*i/(n-1||1));var v=_dokuWave(base,i,n);
      rows.push({t:t, avg:Math.round(v*100)/100, sum:Math.round(v*100)/100,
                 min:Math.round(v*90)/100, max:Math.round(v*112)/100});}
    return {id:id, level:level, counter:false, rows:rows};
  }
  function _dokuHist(url){
    var q=function(k){var m=url.match(new RegExp('[?&]'+k+'=([^&]*)'));return m?decodeURIComponent(m[1]):'';};
    var id=+q('id'), to=+q('to')||Math.floor(Date.now()/1000), from=+q('from')||(to-86400);
    var base=_dokuAnchor(id), n=120, data=[];
    for(var i=0;i<n;i++){var t=from+Math.round((to-from)*i/(n-1));
      data.push([t*1000, Math.round(_dokuWave(base,i,n)*100)/100]);}
    return {data:data};
  }
  function _dokuSynth(url){
    if(/[?&]api=aggregated\b/.test(url))return _dokuAgg(url);
    if(/[?&]api=history\b/.test(url))return _dokuHist(url);
    if(/[?&]api=agg\b/.test(url)){var b=_dokuAnchor((url.match(/[?&]id=(\d+)/)||[])[1]);
      return {min:Math.round(b*0.7*100)/100,max:Math.round(b*1.15*100)/100,avg:Math.round(b*100)/100};}
    if(/[?&]api=cmp\b/.test(url)){var c=_dokuAnchor((url.match(/[?&]id=(\d+)/)||[])[1]);
      return {type:0,cur:Math.round(c*100)/100,past:Math.round(c*0.9*100)/100};}
    return null;
  }
  function dokuInstallFetch(){
    if(typeof window==='undefined'||!window.fetch||window._dokuFetchOn)return;
    window._dokuFetchOn=true; var orig=window.fetch;
    window.fetch=function(url){
      if(typeof url==='string' && /[?&]api=(aggregated|history|agg|cmp)\b/.test(url)){
        var body=_dokuSynth(url);
        if(body!=null)return Promise.resolve(new Response(JSON.stringify(body),
          {status:200,headers:{'Content-Type':'application/json'}}));
      }
      return orig.apply(this,arguments);
    };
  }
