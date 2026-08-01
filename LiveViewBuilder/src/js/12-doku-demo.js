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
