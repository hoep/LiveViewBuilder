  // ===== Widget: Meteogramm (meteoblue-Stil) =====
  // Reiches Meteogramm aus EINER Wetter-JSON-Variable (OWM One Call / Tempest better_forecast / Open-Meteo).
  // Panels mit gemeinsamer Zeitachse:
  //   Temperatur : Kurve + Farbverlauf-Fläche nach Temperatur, Wetter-Icons oben, Tag/Nacht-Schattierung,
  //                Min/Max-Marken, Kopfraum für Icons.
  //   Niederschlag: Balken (Regen/Schnee eingefärbt) + Regenwahrscheinlichkeit-Linie + Luftfeuchte-Linie.
  //   Wolken     : Graustufen-Streifen nach Bewölkung % (keine Höhenauflösung – die gibt es in den Daten nicht).
  //   Wind       : Richtungspfeile oben + Windgeschwindigkeit + Böen.
  // Panels ohne Daten werden automatisch weggelassen; per Eigenschaften zuschaltbar. Skin-Farben.
  function _mgNum(v){if(v==null||v==='')return null;var n=parseFloat(v);return isNaN(n)?null:n;}
  function _mgDir(deg){var d=['N','NNO','NO','ONO','O','OSO','SO','SSO','S','SSW','SW','WSW','W','WNW','NW','NNW'];return d[Math.round(((deg%360)/22.5))%16];}
  function _mgSnow(r,t){if(!r)return false;var c=((r.cond||'')+' '+(r.icon||'')).toLowerCase();if(/schnee|snow|flurr|sleet|graupel/.test(c))return true;return (t!=null&&t<=0.5&&(r.precip>0));}
  function _mgGrad(stops,gmin,gmax){
    if(typeof echarts==='undefined'||!echarts.graphic||!echarts.graphic.LinearGradient||!stops||!stops.length)return null;
    var rng=(gmax-gmin)||1,g=stops.slice().sort(function(a,b){return a.t-b.t;}).map(function(st){var off=(gmax-st.t)/rng;return {offset:Math.max(0,Math.min(1,off)),color:st.color};});
    g.sort(function(a,b){return a.offset-b.offset;});
    if(g[0].offset>0)g.unshift({offset:0,color:g[0].color});
    if(g[g.length-1].offset<1)g.push({offset:1,color:g[g.length-1].color});
    return new echarts.graphic.LinearGradient(0,0,0,1,g);
  }
  function _mgRows(w){
    var fl=(w.varId2&&_lastVals[w.varId2])||(w.varId&&_lastVals[w.varId]);if(!fl)return null;
    var p=parseWeatherJSON(fl.v,w.wfmt);if(!p)return null;
    var hourly=(w.fcMode==='hours'),arr=hourly?p.hours:p.days;if(!arr||!arr.length)return null;
    var start=0;
    if(hourly){var now=Date.now()/1000;for(var i=0;i<arr.length;i++){if(arr[i]&&arr[i].ts&&arr[i].ts>=now-1800){start=i;break;}}}
    else start=(w.fcStart!=null?w.fcStart:0);
    var n=Math.max(3,Math.min(48,w.mgSteps||(hourly?24:7)));
    return {hourly:hourly,rows:arr.slice(start,start+n),fmt:p.fmt};
  }
  function setMeteogram(w){
    var ec=_ec[w.id];if(!ec)return;
    var host=$('.w[data-id="'+w.id+'"] .mg',canvas)||$('.w[data-id="'+w.id+'"]',canvas);
    var muted=cssv('--muted'),line=cssv('--line'),text=cssv('--text'),faint=cssv('--faint'),surf=cssv('--surface-2')||'#1b2426';
    var accent=cssv('--accent'),info=cssv('--info'),ok=cssv('--ok'),warm=cssv('--warm'),crit=cssv('--crit')||warm;
    var D=_mgRows(w);
    wSetSrcBadge(w,D&&D.fmt);   // kleiner Quellen-Hinweis in der Ecke
    var icoEl=host&&host.querySelector('[data-role=mgicons]');
    if(!D){if(icoEl)icoEl.innerHTML='';ec.setOption({backgroundColor:'transparent',title:{text:'keine Wetterdaten',left:'center',top:'middle',textStyle:{color:faint,fontSize:_ecF(w,'label',12),fontWeight:'normal'}},xAxis:{show:false},yAxis:{show:false},series:[]},true);return;}
    var rows=D.rows,hourly=D.hourly,unit=(w.wunit!=null?w.wunit:'°'),WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
    function col(k){return rows.map(function(x){return x?_mgNum(x[k]):null;});}
    function some(a){return a.some(function(v){return v!=null;});}
    var temp=col('hi'),tlo=col('lo'),feels=col('feels'),pop=col('pop'),precip=col('precip'),
        wind=col('wind'),gust=col('gust'),wdir=col('wdir'),clouds=col('clouds'),hum=col('hum'),press=col('press');
    // Typografie auf den Canvas bringen (Schriftart/Gewicht/Stil aus der zentralen Typografie)
    var _ff=_ecFF(w),_fwt=(w.fwt||null),_fsty=(w.fsty||null);
    function _tst(o){o=o||{};if(_ff)o.fontFamily=_ff;if(_fwt&&o.fontWeight==null)o.fontWeight=_fwt;if(_fsty)o.fontStyle=_fsty;return o;}
    // Zahlformat der Werte (Nachkommastellen einstellbar, Dezimalkomma)
    var vdec=(w.mgDec!=null&&w.mgDec!=='')?Math.max(0,Math.min(3,parseInt(w.mgDec))):0;
    function _mgFmt(v,dec){if(v==null||isNaN(v))return '';return Number(v).toFixed(dec!=null?dec:vdec).replace('.',',');}
    // X-Beschriftung: Zeit-/Tagesformat einstellbar
    function _p2(n){return ('0'+n).slice(-2);}
    var timeFmt=w.mgTimeFmt||'hm',dayFmt=w.mgDayFmt||'dm';
    var labels=rows.map(function(r,i){if(!r||!r.ts)return String(i);
      var dt=new Date(r.ts*1000),h=dt.getHours(),mi=dt.getMinutes(),Dd=dt.getDate(),Mo=dt.getMonth()+1,wd=WD[dt.getDay()];
      if(hourly){switch(timeFmt){
        case 'h':    return _p2(h);                          // 14
        case 'hwd':  return h===0?wd:_p2(h);                 // Mitternacht -> Wochentag, sonst 14
        case 'hmwd': return h===0?wd:(_p2(h)+':'+_p2(mi));   // Mitternacht -> Wochentag, sonst 14:00
        default:     return _p2(h)+':'+_p2(mi);              // 'hm' -> 14:00
      }}
      switch(dayFmt){
        case 'wdd':  return wd+' '+Dd+'.';       // Mo 4.
        case 'wd':   return wd;                  // Mo
        case 'dmp':  return Dd+'.'+Mo+'.';       // 4.8.
        case 'ddmm': return _p2(Dd)+'.'+_p2(Mo); // 04.08
        case 'wddm': return wd+' '+Dd+'.'+Mo+'.';// Mo 4.8.
        default:     return Dd+'.'+Mo;           // 'dm' -> 4.8
      }});
    // Temperatur-Skala mit Kopfraum oben (für Wetter-Icons)
    var his=temp.filter(function(v){return v!=null;}),los=(some(tlo)?tlo:temp).filter(function(v){return v!=null;});
    var tmin=los.length?Math.min.apply(null,los):-5,tmax=his.length?Math.max.apply(null,his):20;
    var gmin=Math.floor(tmin-2),grange=Math.max(6,(tmax+2)-gmin),gmaxPlot=gmin+grange*1.34;
    var tgrad=w.tgrad||[{t:-5,color:'#4aa3ff'},{t:4,color:'#3bd6c6'},{t:14,color:'#39d08a'},{t:22,color:'#f2b441'},{t:32,color:'#f2685a'}];
    // Tag/Nacht-Bänder (stündlich): Nacht = 20..6 Uhr
    var nightAreas=[];
    if(hourly){var st=-1;rows.forEach(function(r,i){var h=r&&r.ts?new Date(r.ts*1000).getHours():12;var night=(h>=20||h<6);if(night&&st<0)st=i;if((!night||i===rows.length-1)&&st>=0){var end=night?i:i-1;nightAreas.push([{xAxis:st},{xAxis:end}]);st=-1;}});}
    // ---- Panels ----
    var panels=[{key:'temp',wt:2.7}];
    if(w.mgPrecip!==false&&(some(pop)||some(precip)||some(hum)))panels.push({key:'precip',wt:1.5});
    if(w.mgCloud!==false&&some(clouds))panels.push({key:'cloud',wt:0.55});
    if(w.mgWind!==false&&some(wind))panels.push({key:'wind',wt:1.5});
    // Kachel-Skala: ECharts kennt keine Container-Einheiten, deshalb leiten wir alle festen
    // Pixelmasse aus der Kachelgroesse ab (gleiche Idee wie _ecFS in js/03). K bleibt gedeckelt,
    // damit Symbole/Abstaende auf riesigen Kacheln nicht ins Groteske wachsen.
    var K=Math.max(0.8,Math.min(1.7,Math.min((w.w||460)/460,(w.h||340)/340)));
    // Achsenraender wachsen mit der Kachelbreite (Platz fuer die Zahlenbeschriftung),
    // die rechte Seite nur dann breit, wenn dort wirklich eine %-Achse haengt.
    var L=Math.round(Math.max(24,Math.min(56,(w.w||460)*0.095)));
    var R=(some(pop)||some(hum))?Math.round(Math.max(22,Math.min(52,(w.w||460)*0.085)))
                               :Math.round(Math.max(10,Math.min(22,(w.w||460)*0.035)));
    var symSz=Math.round(Math.max(6,Math.min(14,9*K))), nGap=Math.round(5*K), axMargin=Math.round(6*K);
    var N=panels.length,topPct=6,botPct=8,gapPct=6.5;
    var wsum=panels.reduce(function(a,p){return a+p.wt;},0),avail=100-topPct-botPct-gapPct*(N-1),y=topPct;
    panels.forEach(function(p){p.top=y;p.h=avail*p.wt/wsum;y+=p.h+gapPct;});
    var fL=_ecF(w,'label',9),gIdx={},yIdx={},grid=[],xAxis=[],yAxis=[],series=[];
    function pushAxes(p,gi,yopt,nameU){
      grid.push({left:L,right:R,top:p.top+'%',height:p.h+'%'});
      xAxis.push({type:'category',gridIndex:gi,data:labels,boundaryGap:false,
        axisLine:{show:true,lineStyle:{color:line}},axisTick:{show:false},splitLine:{show:false},
        axisLabel:_tst({show:(gi===N-1),color:muted,fontSize:fL,hideOverlap:true,margin:axMargin})});
      gIdx[p.key]=gi;yIdx[p.key]=yAxis.length;
      yAxis.push(Object.assign({gridIndex:gi,type:'value',splitNumber:3,name:nameU||'',nameLocation:'end',nameGap:nGap,nameTextStyle:_tst({color:faint,fontSize:fL,align:'left'}),
        axisLine:{show:false},axisTick:{show:false},
        axisLabel:_tst({color:muted,fontSize:fL,hideOverlap:true,formatter:function(v){return _mgFmt(v,0);}}),
        splitLine:{show:true,lineStyle:{color:line,opacity:.4,type:'dashed'}}},yopt||{}));
    }
    panels.forEach(function(p,gi){
      if(p.key==='temp')pushAxes(p,gi,{min:gmin,max:Math.round(gmaxPlot),scale:false},unit);
      else if(p.key==='precip')pushAxes(p,gi,{min:0,scale:true},'mm');
      else if(p.key==='cloud')pushAxes(p,gi,{min:0,max:1,show:false},'');
      else if(p.key==='wind')pushAxes(p,gi,{min:0,scale:true},'km/h');
      if(p.key==='precip'&&(some(pop)||some(hum))){yIdx.pct=yAxis.length;yAxis.push({gridIndex:gi,type:'value',min:0,max:100,position:'right',name:'%',nameTextStyle:_tst({color:faint,fontSize:fL}),axisLine:{show:false},axisTick:{show:false},axisLabel:_tst({color:muted,fontSize:fL,formatter:function(v){return Math.round(v);}}),splitLine:{show:false}});}
    });
    // --- Temperatur ---
    var tgradFill=(_mgGrad(tgrad,gmin,gmaxPlot)||accent);
    var bandMode=(!hourly&&some(tlo));   // täglich mit Min/Max -> Fläche als Min/Max-Band statt Achse..Max
    var _mkLbl=_tst({show:true,fontSize:fL,color:text,formatter:function(o){return _mgFmt(o.value)+unit;}});
    var tempSer={name:'Temp',type:'line',xAxisIndex:gIdx.temp,yAxisIndex:yIdx.temp,data:temp,smooth:true,showSymbol:false,lineStyle:{width:2.4,color:crit},itemStyle:{color:crit},z:4};
    if(!bandMode)tempSer.areaStyle={opacity:.85,color:tgradFill};   // stündlich (hi=lo): Fläche bis zur Achse wie bisher
    // Max-Marke immer auf der Max-Kurve; Min-Marke im Bandmodus an der Min-Linie, sonst hier
    tempSer.markPoint={symbol:'pin',symbolSize:0,label:_mkLbl,data:bandMode?[{type:'max',label:{position:'top'}}]:[{type:'max',label:{position:'top'}},{type:'min',label:{position:'bottom'}}]};
    series.push(tempSer);
    if(some(feels))series.push({name:'Gefühlt',type:'line',xAxisIndex:gIdx.temp,yAxisIndex:yIdx.temp,data:feels,smooth:true,showSymbol:false,lineStyle:{width:1,type:'dashed',color:muted},z:3});
    if(bandMode){
      // Min/Max-Band: unsichtbare Basis-Linie auf Min + gestapelte Fläche (Max-Min) mit dem Temperatur-Farbverlauf
      var tspan=temp.map(function(v,i){return (v==null||tlo[i]==null)?null:(Math.round((v-tlo[i])*10)/10);});
      series.push({name:'_tbase',type:'line',xAxisIndex:gIdx.temp,yAxisIndex:yIdx.temp,data:tlo,stack:'tband',symbol:'none',smooth:true,silent:true,lineStyle:{opacity:0},z:2});
      series.push({name:'_tband',type:'line',xAxisIndex:gIdx.temp,yAxisIndex:yIdx.temp,data:tspan,stack:'tband',symbol:'none',smooth:true,silent:true,lineStyle:{opacity:0},areaStyle:{opacity:.85,color:tgradFill},z:2});
      series.push({name:'Min',type:'line',xAxisIndex:gIdx.temp,yAxisIndex:yIdx.temp,data:tlo,smooth:true,showSymbol:false,lineStyle:{width:1.4,color:info},itemStyle:{color:info},z:3,
        markPoint:{symbol:'pin',symbolSize:0,label:_mkLbl,data:[{type:'min',label:{position:'bottom'}}]}});
    }
    // Tag/Nacht-Schattierung (als markArea auf der Temp-Reihe)
    if(nightAreas.length)tempSer.markArea={silent:true,itemStyle:{color:'rgba(127,127,127,0.10)'},data:nightAreas};
    // --- Niederschlag: Balken (Regen/Schnee) ---
    if(gIdx.precip!=null){
      var pbars=precip.map(function(v,i){if(v==null)return null;return {value:v,itemStyle:{color:_mgSnow(rows[i],temp[i])?('rgba(150,190,230,0.9)'):info,borderRadius:[2,2,0,0]}};});
      if(some(pop))series.push({name:'Regen %',type:'line',xAxisIndex:gIdx.precip,yAxisIndex:yIdx.pct,data:pop,smooth:true,showSymbol:false,lineStyle:{width:1.4,color:accent},areaStyle:{opacity:.12,color:accent},z:1});
      if(some(hum))series.push({name:'Feuchte',type:'line',xAxisIndex:gIdx.precip,yAxisIndex:yIdx.pct,data:hum,smooth:true,showSymbol:false,lineStyle:{width:1.2,color:info,type:'dashed'},z:2});
      series.push({name:'Regen',type:'bar',xAxisIndex:gIdx.precip,yAxisIndex:yIdx.precip,data:pbars,barWidth:'62%',z:3});
    }
    // --- Wolken: Graustufen-Streifen (Balken volle Höhe, Deckkraft = Bewölkung) ---
    if(gIdx.cloud!=null){
      var cbars=clouds.map(function(v){if(v==null)return {value:1,itemStyle:{color:'transparent'}};var a=Math.max(0,Math.min(1,v/100));return {value:1,itemStyle:{color:'rgba(150,160,168,'+(0.08+a*0.72).toFixed(2)+')'}};});
      series.push({name:'Wolken',type:'bar',xAxisIndex:gIdx.cloud,yAxisIndex:yIdx.cloud,data:cbars,barWidth:'100%',barCategoryGap:'0%',z:1,silent:true});
    }
    // --- Wind: Geschwindigkeit + Böen + Richtungspfeile ---
    if(gIdx.wind!=null){
      var wmax=Math.max.apply(null,[1].concat(wind.filter(function(v){return v!=null;})).concat(gust.filter(function(v){return v!=null;})));
      yAxis[yIdx.wind].max=Math.ceil(wmax*1.28);
      if(some(gust))series.push({name:'Böen',type:'line',xAxisIndex:gIdx.wind,yAxisIndex:yIdx.wind,data:gust,smooth:true,showSymbol:false,lineStyle:{width:1.4,color:ok},areaStyle:{opacity:.08,color:ok},z:2});
      series.push({name:'Wind',type:'line',xAxisIndex:gIdx.wind,yAxisIndex:yIdx.wind,data:wind,smooth:true,showSymbol:false,lineStyle:{width:1.8,color:accent},itemStyle:{color:accent},areaStyle:{opacity:.10,color:accent},z:3});
      if(w.mgWdir!==false&&some(wdir)){var arrowY=Math.ceil(wmax*1.28)*0.93;
        series.push({name:'Richtung',type:'scatter',xAxisIndex:gIdx.wind,yAxisIndex:yIdx.wind,z:5,silent:true,
          data:rows.map(function(r,i){return (wdir[i]==null)?null:{value:[i,arrowY],symbol:'arrow',symbolSize:symSz,symbolRotate:((wdir[i]+180)%360),itemStyle:{color:muted}};})});}
    }
    // ---- Wetter-Icons oben im Temperatur-Panel (HTML-Overlay, richtet sich per space-between an den Zeitschritten aus) ----
    if(icoEl){
      var p0=panels[0];
      icoEl.style.left=L+'px';icoEl.style.right=R+'px';icoEl.style.top='calc('+p0.top+'% + 1px)';icoEl.style.height='clamp(14px,7cqh,26px)';
      icoEl.innerHTML=rows.map(function(r){return '<span class="mgico">'+iconSVG((r&&r.icon)||'cloudsun')+'</span>';}).join('');
    }
    // ---- Zusammenbauen ----
    var _cloudCol='rgba(150,160,168,0.85)'; // Wolken-Streifenfarbe fuer den Tooltip-Marker
    // Marker in der Graphenfarbe UND -form: 'line' (durchgezogen), 'dash' (gestrichelt), 'bar' (Balken), 'dot' (Punkt/Scatter)
    function _mk(c,kind){if(!c)return '';var b='display:inline-block;margin-right:5px;vertical-align:middle';
      if(kind==='bar')return '<span style="'+b+';width:8px;height:10px;background:'+c+';border-radius:1px"></span>';
      if(kind==='dot')return '<span style="'+b+';width:8px;height:8px;border-radius:50%;background:'+c+'"></span>';
      if(kind==='dash')return '<span style="'+b+';width:13px;height:0;border-top:2px dashed '+c+'"></span>';
      return '<span style="'+b+';width:13px;height:0;border-top:2px solid '+c+'"></span>';} // line
    function ln(l,v,u,dec,col,kind){if(v==null)return '';return '<br>'+_mk(col,kind)+l+': '+_mgFmt(v,dec)+(u||'');} // Marker in Graphenfarbe + -form
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,
      tooltip:{trigger:'axis',axisPointer:{type:'cross',label:{show:false}},backgroundColor:surf,borderColor:line,borderWidth:1,textStyle:_tst({color:text,fontSize:_ecF(w,'label',10)}),
        formatter:function(ps){if(!ps||!ps.length)return '';var idx=ps[0].dataIndex,r=rows[idx],head=labels[idx];
          if(r&&r.ts){var dt=new Date(r.ts*1000);head=hourly?(WD[dt.getDay()]+' '+_p2(dt.getHours())+':'+_p2(dt.getMinutes())):(WD[dt.getDay()]+' '+dt.getDate()+'.'+(dt.getMonth()+1)+'.');}
          var s='<b>'+head+'</b>'+ln('Temp',temp[idx],unit,null,crit,'line');if(some(feels))s+=ln('Gefühlt',feels[idx],unit,null,muted,'dash');
          if(!hourly&&some(tlo))s+=ln('Min',tlo[idx],unit,null,info,'line'); // im Tagesmodus Min/Max-Band -> auch das Tief zeigen
          if(gIdx.precip!=null){s+=ln('Regen',pop[idx],' %',0,accent,'line');if(precip[idx]>0)s+=ln(_mgSnow(r,temp[idx])?'Schnee':'Menge',precip[idx],' mm',1,(_mgSnow(r,temp[idx])?'rgba(150,190,230,0.9)':info),'bar');if(some(hum))s+=ln('Feuchte',hum[idx],' %',0,info,'dash');}
          if(gIdx.cloud!=null)s+=ln('Wolken',clouds[idx],' %',0,_cloudCol,'bar');
          if(gIdx.wind!=null){s+=ln('Wind',wind[idx],' km/h',null,accent,'line');if(some(gust))s+=ln('Böen',gust[idx],' km/h',null,ok,'line');if(wdir[idx]!=null)s+='<br>'+_mk(muted,'dot')+'Richtung: '+_mgDir(wdir[idx]);}
          return s;}},
      axisPointer:{link:[{xAxisIndex:'all'}]},
      grid:grid,xAxis:xAxis,yAxis:yAxis,series:series},true);
  }
  defWidget('meteogram',{
    label:'Meteogramm', cat:'Wetter & Zeit', paletteIcon:'wchart', size:[460,340], noHover:true,
    defaults:function(w){w.wfmt='auto';w.mgSteps=24;w.fcMode='hours';w.label='';w.mgTimeFmt='hm';w.mgDayFmt='dm';w.mgDec=0;w.tgrad=[{t:-5,color:'#4aa3ff'},{t:4,color:'#3bd6c6'},{t:14,color:'#39d08a'},{t:22,color:'#f2b441'},{t:32,color:'#f2685a'}];},
    render:function(w){return '<div class="mg" style="position:absolute;inset:0;container-type:size"><div data-role="chart" style="position:absolute;inset:0"></div><div data-role="mgicons" style="position:absolute;display:flex;justify-content:space-between;align-items:center;pointer-events:none;z-index:2"></div></div>';},
    props:function(w){
      if(w.type!=='meteogram')return '';
      var hourly=(w.fcMode==='hours');
      var h='<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Meteogramm im meteoblue-Stil aus einer <b>Wetter-JSON-Variable</b> (OpenWeatherMap One Call, Tempest/WeatherFlow oder Open-Meteo). Panels mit gemeinsamer Zeitachse; Panels ohne Daten werden automatisch weggelassen.</div>';
      h+=row('Format','<select id="pWFmt"><option value="auto"'+((w.wfmt||'auto')==='auto'?' selected':'')+'>Automatisch erkennen</option><option value="owm"'+(w.wfmt==='owm'?' selected':'')+'>OpenWeatherMap</option><option value="tempest"'+(w.wfmt==='tempest'?' selected':'')+'>Tempest / WeatherFlow</option><option value="openmeteo"'+(w.wfmt==='openmeteo'?' selected':'')+'>Open-Meteo</option></select>');
      h+=fieldPick(w,'varId2','Vorhersage-Variable (optional)');
      h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Leer = dieselbe Variable wie oben.</div>';
      h+=row('Temp-Einheit','<input id="pWUnit" value="'+esc(w.wunit!=null?w.wunit:'°')+'" style="width:60px" placeholder="°">');
      h+='<div class="pgh">Vorhersage</div>'
        +row('Modus','<select id="pMgMode"><option value=""'+(!hourly?' selected':'')+'>Täglich</option><option value="hours"'+(hourly?' selected':'')+'>Stündlich</option></select>')
        +row(hourly?'Anzahl Stunden':'Anzahl Tage','<input id="pMgSteps" type="number" min="3" max="48" value="'+(w.mgSteps||(hourly?24:7))+'">')
        +(hourly?'':row('Erster Tag','<select id="pMgStart"><option value="0"'+((w.fcStart||0)===0?' selected':'')+'>Heute</option><option value="1"'+(w.fcStart===1?' selected':'')+'>Morgen</option></select>'));
      h+='<div class="pgh">Panels (nur mit Daten sichtbar)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Temperatur (mit Farbverlauf, Wetter-Icons, Tag/Nacht) ist immer dabei.</div>'
        +row('Niederschlag + Feuchte','<input type="checkbox" id="pMgPrecip"'+(w.mgPrecip!==false?' checked':'')+'>')
        +row('Wolken','<input type="checkbox" id="pMgCloud"'+(w.mgCloud!==false?' checked':'')+'>')
        +row('Wind','<input type="checkbox" id="pMgWind"'+(w.mgWind!==false?' checked':'')+'>')
        +row('Windrichtung (Pfeile)','<input type="checkbox" id="pMgWdir"'+(w.mgWdir!==false?' checked':'')+'>');
      h+='<div class="pgh">Beschriftung & Format</div>';
      if(hourly)h+=row('Zeitformat','<select id="pMgTimeFmt">'+[['hm','14:00'],['h','14 (nur Stunde)'],['hmwd','14:00 · Mitternacht = Wochentag'],['hwd','14 · Mitternacht = Wochentag']].map(function(o){return '<option value="'+o[0]+'"'+((w.mgTimeFmt||'hm')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>');
      else h+=row('Tagesformat','<select id="pMgDayFmt">'+[['dm','4.8'],['dmp','4.8.'],['ddmm','04.08'],['wdd','Mo 4.'],['wddm','Mo 4.8.'],['wd','Mo (Wochentag)']].map(function(o){return '<option value="'+o[0]+'"'+((w.mgDayFmt||'dm')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>');
      h+=row('Nachkommastellen','<input id="pMgDec" type="number" min="0" max="3" value="'+(w.mgDec!=null?w.mgDec:0)+'">');
      h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Schriftart, -gewicht, -stil und -größe stellst du oben unter <b>Typografie</b> ein — sie gelten auch für Achsen, Marken und Tooltip.</div>';
      h+=row('Datenquelle anzeigen','<input type="checkbox" id="pMgShowSrc"'+((w.showSrc!==false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">kleiner Hinweis in der Ecke (z.&nbsp;B. Tempest)</span>');
      return h;
    },
    wire:function(w){
      function reMg(){if(_ec[w.id])setMeteogram(w);commit();}
      if($('#pWFmt'))$('#pWFmt').onchange=function(){w.wfmt=this.value;reMg();};
      if($('#pWUnit'))$('#pWUnit').oninput=function(){w.wunit=this.value;reMg();};
      if($('#pMgMode'))$('#pMgMode').onchange=function(){w.fcMode=(this.value==='hours')?'hours':undefined;reMg();renderProps();};
      if($('#pMgSteps'))$('#pMgSteps').oninput=function(){w.mgSteps=Math.max(3,Math.min(48,parseInt(this.value)||24));reMg();};
      if($('#pMgStart'))$('#pMgStart').onchange=function(){w.fcStart=parseInt(this.value)||undefined;reMg();};
      [['pMgPrecip','mgPrecip'],['pMgCloud','mgCloud'],['pMgWind','mgWind'],['pMgWdir','mgWdir']].forEach(function(p){var _e=$('#'+p[0]);if(_e)_e.onchange=function(){w[p[1]]=this.checked?undefined:false;reMg();};});
      if($('#pMgTimeFmt'))$('#pMgTimeFmt').onchange=function(){w.mgTimeFmt=this.value;reMg();};
      if($('#pMgDayFmt'))$('#pMgDayFmt').onchange=function(){w.mgDayFmt=this.value;reMg();};
      if($('#pMgDec'))$('#pMgDec').oninput=function(){w.mgDec=(this.value===''?undefined:Math.max(0,Math.min(3,parseInt(this.value)||0)));reMg();};
      if($('#pMgShowSrc'))$('#pMgShowSrc').onchange=function(){w.showSrc=this.checked?undefined:false;reMg();};
    },
    live:function(w,el,id,d,base,txt,on){if(_ec[w.id])setMeteogram(w);return true;}
  });
