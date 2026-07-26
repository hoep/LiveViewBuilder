  function render(){
    disposeCharts();
    _tickKids=[];   // verschachtelte Ticker-Widgets werden während des Render-Laufs neu gesammelt
    $$('.w',canvas).forEach(function(e){e.remove();});
    var _refSet={};state.widgets.forEach(function(t){if(t.type==='ticker'&&t.items)t.items.forEach(function(m){if(m.ref)_refSet[m.ref]=1;});}); // von einer Laufzeile referenzierte Namen -> auf der Seite ausblenden
    state.widgets.forEach(function(w){
      var d=document.createElement('div');d.className='w t-'+w.type+(sel[w.id]?' sel':'')+(w.anim?' anim-'+w.anim:'');d.dataset.id=w.id;
      d.style.left=w.x+'px';d.style.top=w.y+'px';d.style.width=w.w+'px';d.style.height=w.h+'px';
      var _frameOn=(w.frame!=null)?w.frame:!state.page.noframe;if(!_frameOn)d.classList.add('no-frame'); // Kachel-Rahmen: Widget-Override sonst Ansicht-Standard
      if(w.name&&_refSet[w.name])d.classList.add('ref-hidden'); // in Laufzeile referenziert -> immer aus (bearbeiten über die Laufzeile)
      else if(w.hidden)d.classList.add('run-hidden'); // manuell versteckt -> im Run aus, im Edit gestrichelt sichtbar (CSS)
      var _inner;try{_inner=widgetInner(w);}catch(_e){_inner='<div style="padding:6px;font-size:11px;color:var(--crit)">⚠ '+esc(w.type||'?')+'</div>';} // ein defektes Widget darf das Rendern nicht abbrechen
      d.innerHTML='<div class="winner">'+_inner+'</div><div class="rz rz-n" data-rz="n"></div><div class="rz rz-s" data-rz="s"></div><div class="rz rz-e" data-rz="e"></div><div class="rz rz-w" data-rz="w"></div><div class="rz rz-ne" data-rz="ne"></div><div class="rz rz-nw" data-rz="nw"></div><div class="rz rz-se" data-rz="se"></div><div class="rz rz-sw" data-rz="sw"></div>';
      if(w.type==='value'&&w.valfs){var v=$('.v',d);if(v)v.style.fontSize=w.valfs+'px';}
      if(w.bg)d.style.background=w.bg;if(w.fg)d.style.color=w.fg;
      if(w.ff){d.style.setProperty('--w-ff',w.ff);d.classList.add('tw-ff');}if(w.fwt){d.style.setProperty('--w-fwt',w.fwt);d.classList.add('tw-fwt');}if(w.fsty){d.style.setProperty('--w-fsty',w.fsty);d.classList.add('tw-fsty');}if(w.fsz){d.style.setProperty('--w-fsz',w.fsz+'px');d.classList.add('tw-fsz');} // Typografie: auf innere Elemente erzwingen
      canvas.appendChild(d);
    });
    // ECharts- und Kamera-Widgets aktivieren (je Widget abgesichert)
    state.widgets.forEach(function(w){
      try{
      if(w.type==='gauge'||w.type==='chart'||w.type==='spark'||w.type==='sankey'||w.type==='gaugepro')initEChart(w);
      if(w.type==='camera'||w.type==='campro')refreshCam(w);
      if(w.type==='html'){if(w.htmlSrc==='custom')setHtmlContent(w,w.html||'');else fetchHtml(w);}
      if(w.type==='weekplan')fetchWeekplan(w);
      if(w.type==='weatherpro')refreshWeatherPro(w);if(w.type==='suncard')refreshSun(w);
      if(w.type==='calendar')fetchCalEvents(w);
      if(w.type==='eventctl')fetchEvent(w);
      if(w.type==='objinfo')fetchObjInfo(w);
      if(w.visVar&&mode!=='edit'&&_lastVals[w.visVar]){var _ve=$('.w[data-id="'+w.id+'"]',canvas);if(_ve)_ve.style.display=evalVis(w,_lastVals[w.visVar])?'':'none';}
      if(w.type==='thermostat'){buildThermModes(w);updateTherm(w);}
      var _mwr=WIDGETS[w.type];if(_mwr&&_mwr.mount)_mwr.mount(w); // Registry-Post-Render-Hook (z.B. Canvas zeichnen)
      }catch(_e){} // ein defektes Widget darf Init/Interaktion der anderen nicht blockieren
    });
    _compKids=[];state.widgets.forEach(function(w){if(w.type==='component')expandComponent(w);}); // M3: Komponenten-Instanzen expandieren
    var eh=$('#emptyhint');if(!eh){eh=document.createElement('div');eh.id='emptyhint';eh.textContent='Element aus der Palette hierher ziehen — oder eine Variable im Baum anklicken';canvas.appendChild(eh);}eh.style.display=state.widgets.length?'none':'flex';
    invalidateVidx();_pvSince=0;pollVals();commit();tick();drawStructure();
  }

  // ---------- ECharts / Kamera ----------
  var _ec={},_hist={},_lastVals={};
  function cssv(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}
  function _rgb(h){h=(h||'').trim();if(h.charAt(0)==='#')h=h.slice(1);if(h.length===3)h=h.charAt(0)+h.charAt(0)+h.charAt(1)+h.charAt(1)+h.charAt(2)+h.charAt(2);var n=parseInt(h||'0',16);return [(n>>16)&255,(n>>8)&255,n&255];}
  function accA(a,hex){var c=_rgb(hex||cssv('--accent'));return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
  function gradFill(hex){return {type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:accA(.34,hex)},{offset:1,color:accA(0,hex)}]};}
  // Zeitversatz-Vergleich (Delta/KPI + Charts)
  var OFFS={'1h':3600,'1d':86400,'1w':604800,'1m':2592000,'1y':31536000};
  var OFFLBL={'1h':'letzte Stunde','1d':'gestern','1w':'letzte Woche','1m':'letzter Monat','1y':'letztes Jahr','last':'letztem Wert'};
  // KPI/Delta-Zeitversatz: Aggregationsstufe (Periode) + Vergleich mit der Vorperiode
  var STAGES=[['minute','minütlich'],['hour','stündlich'],['day','täglich'],['week','wöchentlich'],['month','monatlich'],['year','jährlich']];
  var STAGELBL={minute:'Minute davor',hour:'Stunde davor',day:'gestern',week:'letzte Woche',month:'letzter Monat',year:'letztes Jahr'};
  var STAGECUR={minute:'letzte Minute',hour:'diese Stunde',day:'heute',week:'diese Woche',month:'dieser Monat',year:'dieses Jahr'};
  function cmpStage(w){return w.cmpStage||({'1h':'hour','1d':'day','1w':'week','1m':'month','1y':'year','last':'day'}[w.cmpOff])||'day';}
  function stageSel(id,cur){cur=cur||'day';return '<select id="'+id+'">'+STAGES.map(function(s){return '<option value="'+s[0]+'"'+(s[0]===cur?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select>';}
  var _cmpData={}; // widgetId -> {cur,past,type,fetched}
  function darken(hex,amt){hex=String(hex||'#888888').replace('#','');if(hex.length===3)hex=hex.split('').map(function(c){return c+c;}).join('');var r=parseInt(hex.substr(0,2),16),g=parseInt(hex.substr(2,2),16),b=parseInt(hex.substr(4,2),16);function d(x){return Math.max(0,Math.min(255,Math.round(x*(1-amt))));}return '#'+[d(r),d(g),d(b)].map(function(x){return ('0'+x.toString(16)).slice(-2);}).join('');}
  function fmtDelta(n,sign){if(n==null||isNaN(n))return '–';var a=Math.abs(n),s=a>=100?Math.round(n):Math.round(n*10)/10;return (sign&&n>0?'+':'')+String(s).replace('.',',');}
  function _lerpHex(a,b,f){var A=_rgb(a),B=_rgb(b);return '#'+[0,1,2].map(function(i){return ('0'+Math.round(A[i]+(B[i]-A[i])*f).toString(16)).slice(-2);}).join('');}
  function tColor(t,stops){if(!stops||!stops.length)return cssv('--accent');var s=stops.slice().sort(function(a,b){return a.t-b.t;});if(t<=s[0].t)return s[0].color;if(t>=s[s.length-1].t)return s[s.length-1].color;for(var i=0;i<s.length-1;i++){if(t>=s[i].t&&t<=s[i+1].t)return _lerpHex(s[i].color,s[i+1].color,(t-s[i].t)/((s[i+1].t-s[i].t)||1));}return s[s.length-1].color;}
  function _hhmm(v){var s=String(v==null?'':v),m=s.match(/(\d{1,2}):(\d{2})/);if(m)return (+m[1])*60+(+m[2]);var n=parseFloat(String(v).replace(',','.'));if(!isNaN(n)&&n>100000){var d=new Date(n*1000);return d.getHours()*60+d.getMinutes();}return null;}
  function _hhmmTxt(v){var m=String(v).match(/(\d{1,2}:\d{2})/);return m?m[1]:String(v);}
  function refreshWeatherPro(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var days=w.fc||[];
    var his=[],los=[];days.forEach(function(r){var hv=_lastVals[r.hi],lv=_lastVals[r.lo];r._h=hv?parseFloat(String(hv.v).replace(',','.')):NaN;r._l=lv?parseFloat(String(lv.v).replace(',','.')):NaN;if(!isNaN(r._h))his.push(r._h);if(!isNaN(r._l))los.push(r._l);});
    var gmin=(w.gmin!=null&&w.gmin!=='')?parseFloat(w.gmin):(los.length?Math.min.apply(null,los)-1:-10);
    var gmax=(w.gmax!=null&&w.gmax!=='')?parseFloat(w.gmax):(his.length?Math.max.apply(null,his)+1:40);if(gmax<=gmin)gmax=gmin+1;
    var rows=$$('.hwp2day',el);
    days.forEach(function(r,i){var row=rows[i];if(!row)return;var fill=$('.fill',row);if(!fill)return;
      if(isNaN(r._h)||isNaN(r._l)){fill.style.width='0';return;}
      var lp=(r._l-gmin)/(gmax-gmin)*100,hp=(r._h-gmin)/(gmax-gmin)*100;
      fill.style.left=Math.max(0,Math.min(100,lp))+'%';fill.style.width=Math.max(3,Math.min(100,hp)-Math.max(0,lp))+'%';
      fill.style.background='linear-gradient(90deg,'+tColor(r._l,w.tgrad)+','+tColor(r._h,w.tgrad)+')';
    });
  }
  function refreshSun(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var sr=_lastVals[w.varId],ss=_lastVals[w.varId2],a=sr?_hhmm(sr.f||sr.v):null,b=ss?_hhmm(ss.f||ss.v):null,sun=$('[data-role=sun]',el);if(sun==null)return;
    var v1=$('[data-role=val]',el);if(v1&&sr)v1.textContent=_hhmmTxt(sr.f||sr.v);var v2=$('[data-role=val2]',el);if(v2&&ss)v2.textContent=_hhmmTxt(ss.f||ss.v);
    if(a==null||b==null||b<=a)return;
    var now=new Date(),nm=now.getHours()*60+now.getMinutes(),f=Math.max(0,Math.min(1,(nm-a)/(b-a)));
    if(w.showTime){var nw=$('[data-role=now]',el);if(nw)nw.textContent=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);}
    var mt=1-f,x=mt*mt*12+2*mt*f*100+f*f*188,y=mt*mt*82+2*mt*f*(-6)+f*f*82;
    sun.setAttribute('cx',x.toFixed(1));sun.setAttribute('cy',y.toFixed(1));sun.style.opacity=(nm<a||nm>b)?0.25:1;
    var len=$('[data-role=len]',el);if(len){var dl=b-a;len.textContent=Math.floor(dl/60)+' h '+('0'+(dl%60)).slice(-2)+' min';}
  }
  function disposeCharts(){for(var k in _ec){try{_ec[k].dispose();}catch(e){}}_ec={};}
  function initEChart(w){
    if(typeof echarts==='undefined')return;
    var el=$('.w[data-id="'+w.id+'"] [data-role=chart]',canvas);if(!el)return;
    _ec[w.id]=echarts.init(el,null,{renderer:'canvas'});
    if(w.type==='gauge'){setGauge(w,_lastVals[w.varId]);}
    else if(w.type==='gaugepro'){setGaugePro(w,_lastVals[w.varId]);}
    else if(w.type==='sankey'){setSankey(w);}
    else if(w.ctype==='pie'||w.ctype==='donut'){renderChartData(w);}
    else{ if(_hist[w.id])renderChartData(w); else fetchHist(w); }
  }
  // Per-Zustand-Styling (Ein/Aus) fuer button/tile — IPSView ToggleButton/Value-Button
  function applyBtnState(w,el,on){
    var badge=el.querySelector('[data-role=badge]');
    if(badge&&(w.onIcon||w.offIcon)){var ic=on?(w.onIcon||w.icon):(w.offIcon||w.icon);if(ic)badge.innerHTML=iconSVG(ic,on?1:0);}
    var name=el.querySelector('.hblabel,.htname');
    if(name){var t=on?w.onText:w.offText;name.textContent=(t!=null&&t!=='')?t:(w.label||'');}
    var bg=(on?w.onBg:w.offBg)||'',fg=(on?w.onFg:w.offFg)||'';
    var box=el.querySelector('.hbtn,.htile');if(box)box.style.background=bg;
    if(badge)badge.style.color=fg;if(name)name.style.color=fg;
  }
  function btnStateProps(w){return row('Seite öffnen','<select id="pNavTo"><option value="">— (Variable schalten)</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.navTo===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
    +row('Popup öffnen','<select id="pPopupTo"><option value="">—</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.popupTo===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
    +row('Lang-Druck → Popup','<select id="pLongPop"><option value="">—</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.longPopup===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
    +row('Region setzen','<input id="pRegSlot" value="'+esc(w.regSlot||'')+'" placeholder="Region" style="width:80px"> <select id="pRegView"><option value="">Ansicht…</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.regView===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
    +row('Zurück','<input type="checkbox" id="pNavBack"'+(w.navBack?' checked':'')+'>')
    +row('Menü öffnen','<input type="checkbox" id="pOpenMenu"'+(w.openMenu?' checked':'')+'>')
    +row('Popup schließen','<input type="checkbox" id="pClosePop"'+(w.closePopup?' checked':'')+'>')
    +row('Skript ID','<input id="pScriptId" value="'+(w.scriptId||'')+'" placeholder="bei Klick ausführen">')
    +(w.popupTo?listEditor(w,'alias','Alias: Vorlagen-ID → echte Geräte-ID',[{k:'from',ph:'Vorlage'},{k:'to',ph:'echte ID'}]):'')
    +'<div class="pgh">Zustand Ein / Aus</div>'
    +row('Text','<input id="pOnText" value="'+esc(w.onText||'')+'" placeholder="Ein"> <input id="pOffText" value="'+esc(w.offText||'')+'" placeholder="Aus">')
    +row('Hintergrund','<input id="pOnBg" type="color" value="'+(w.onBg||'#1b2a30')+'"> <input id="pOffBg" type="color" value="'+(w.offBg||'#1b2a30')+'">')
    +row('Textfarbe','<input id="pOnFg" type="color" value="'+(w.onFg||'#e7eef0')+'"> <input id="pOffFg" type="color" value="'+(w.offFg||'#e7eef0')+'">')
    +row('Icon (id)','<input id="pOnIcon" value="'+esc(w.onIcon||'')+'" placeholder="ein"> <input id="pOffIcon" value="'+esc(w.offIcon||'')+'" placeholder="aus">')
    +row('','<button class="btn" id="pStClr" style="padding:4px 9px">Zustands-Stil zurücksetzen</button>');}
  function btnStateWire(w){function relive(){render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
    if($('#pNavTo'))$('#pNavTo').onchange=function(){w.navTo=this.value||undefined;commit();};
    if($('#pPopupTo'))$('#pPopupTo').onchange=function(){w.popupTo=this.value||undefined;commit();};
    if($('#pLongPop'))$('#pLongPop').onchange=function(){w.longPopup=this.value||undefined;commit();};
    if($('#pRegSlot'))$('#pRegSlot').oninput=function(){w.regSlot=this.value||undefined;commit();};
    if($('#pRegView'))$('#pRegView').onchange=function(){w.regView=this.value||undefined;commit();};
    if($('#pNavBack'))$('#pNavBack').onchange=function(){w.navBack=this.checked||undefined;commit();};
    if($('#pOpenMenu'))$('#pOpenMenu').onchange=function(){w.openMenu=this.checked||undefined;commit();};
    if($('#pClosePop'))$('#pClosePop').onchange=function(){w.closePopup=this.checked||undefined;commit();};
    if($('#pScriptId'))$('#pScriptId').oninput=function(){w.scriptId=parseInt(this.value)||undefined;commit();};
    function bind(id,prop){var e=$('#'+id);if(e)e.oninput=e.onchange=function(){w[prop]=this.value||undefined;relive();};}
    bind('pOnText','onText');bind('pOffText','offText');bind('pOnBg','onBg');bind('pOffBg','offBg');bind('pOnFg','onFg');bind('pOffFg','offFg');bind('pOnIcon','onIcon');bind('pOffIcon','offIcon');
    if($('#pStClr'))$('#pStClr').onclick=function(){['onText','offText','onBg','offBg','onFg','offFg','onIcon','offIcon'].forEach(function(k){delete w[k];});renderProps();relive();};}
  function fetchEvent(w){if(!w.eventId)return;fetch('?api=event&id='+w.eventId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el||!j||j.error)return;
    var nm=$('[data-role=evname]',el);if(nm&&!w.label)nm.textContent=j.name||'Ereignis';
    var sw=$('[data-role=evsw]',el);if(sw)sw.classList.toggle('on',!!j.active);
    var sub=$('[data-role=evsub]',el);if(sub){var parts=[j.active?'aktiv':'inaktiv'];if(j.next>0)parts.push('nächste: '+new Date(j.next*1000).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}));sub.textContent=parts.join(' · ');}
  }).catch(function(){});}
  function fetchObjInfo(w){if(!w.objId)return;fetch('?api=objinfo&id='+w.objId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el||!j||j.error)return;
    var nm=$('[data-role=oiname]',el);if(nm&&!w.label)nm.textContent=j.name||'Objekt';
    var vv=$('[data-role=oival]',el);if(!vv)return;var f=w.field||'updated',out='–';
    if(f==='name')out=j.name||'';
    else if(f==='updated'||f==='changed'){var ts=j[f];out=ts>0?new Date(ts*1000).toLocaleString('de-DE'):'–';}
    else if(f==='next'||f==='last'){var t=j[f];out=t>0?new Date(t*1000).toLocaleString('de-DE'):'–';}
    vv.textContent=out;
  }).catch(function(){});}
  function renderChartData(w){if(w.type==='spark')setSpark(w);else if(w.ctype==='pie'||w.ctype==='donut'||w.ctype==='rose')setPie(w);else setLine(w);}
  function setPie(w){var ec=_ec[w.id];if(!ec)return;var ids=[w.varId,w.varId2,w.varId3].filter(function(x){return x;});
    var data=ids.map(function(id,i){var o=(w.sopt&&w.sopt[i])||{};var lv=_lastVals[id],v=lv?parseFloat(String(lv.v).replace(',','.')):0;if(isNaN(v))v=0;return {name:o.name||(i===0?(w.label||'Serie 1'):'Serie '+(i+1)),value:Math.max(0,v),itemStyle:{color:o.color||autoColorHex(i)}};});
    var donut=(w.ctype==='donut'),rose=(w.ctype==='rose');
    ec.setOption({backgroundColor:'transparent',tooltip:{trigger:'item',valueFormatter:function(v){return (Math.round(v*100)/100);}},
      legend:w.legend?{show:true,bottom:0,textStyle:{color:cssv('--muted'),fontSize:9},itemWidth:11,itemHeight:8}:{show:false},
      series:[{type:'pie',roseType:(rose?'radius':false),radius:rose?['22%','74%']:(donut?['46%','72%']:'70%'),center:['50%',(w.legend?'45%':'50%')],data:data,
        label:{color:cssv('--text'),fontSize:10,formatter:(w.labels?'{b}\n{d}%':'{d}%')},labelLine:{length:6,length2:6,lineStyle:{color:cssv('--line')}},
        itemStyle:{borderColor:cssv('--bg'),borderWidth:2,borderRadius:((donut||rose)?3:0)},minAngle:3}]},true);}
  function chartSeries(w){return (_hist[w.id]&&_hist[w.id].series)?_hist[w.id].series:[];}
  function setSpark(w){
    var ec=_ec[w.id];if(!ec)return;var acc=cssv('--accent');var s0=chartSeries(w)[0]||{data:[]};var data=s0.data;
    ec.setOption({backgroundColor:'transparent',grid:{left:2,right:2,top:6,bottom:4},
      tooltip:{trigger:'axis',confine:true},
      xAxis:{type:'time',show:false},yAxis:{type:'value',scale:true,show:false},
      series:[{type:'line',showSymbol:false,smooth:true,lineStyle:{color:acc,width:1.8},areaStyle:{color:accA(.16)},
        data:data,markPoint:{silent:true,symbol:'circle',symbolSize:5,itemStyle:{color:acc},label:{show:false},data:data.length?[{coord:data[data.length-1]}]:[]}}]},true);
  }
  function setGauge(w,d){
    var ec=_ec[w.id];if(!ec)return;var raw=d?d.v:null,val=d?parseFloat(d.v):0;if(isNaN(val))val=0;
    var mn=(w.min!=null?w.min:0),mx=(w.max!=null?w.max:100);
    var style=w.gstyle||'classic',cmode=w.gcolor||'accent';
    if(cmode==='assoc'&&w.varId&&!_assocData[w.varId]){loadAssoc(w.varId,function(){setGauge(w,d);});}
    var t1=(w.t1!=null?w.t1:mn+(mx-mn)*0.6),t2=(w.t2!=null?w.t2:mn+(mx-mn)*0.85);
    var f1=Math.max(0,Math.min(1,(t1-mn)/((mx-mn)||1))),f2=Math.max(f1,Math.min(1,(t2-mn)/((mx-mn)||1)));
    function zoneCol(v){return v<=t1?cssv('--ok'):(v<=t2?cssv('--warm'):cssv('--crit'));}
    var fillCol=(cmode==='graded')?zoneCol(val):(function(){if(cmode==='assoc'&&w.varId&&_assocData[w.varId]){var a=assocFor(w,raw);if(a){var rr=assocResolved(w,a);if(rr.color)return rr.color;}}return cssv('--accent');})();
    var ANG={classic:[225,-45],half:[180,0],ring:[90,-270],halfring:[180,0]}[style]||[225,-45];
    if(w.gstart!=null&&w.gend!=null&&w.gstart!==''&&w.gend!=='')ANG=[parseFloat(w.gstart),parseFloat(w.gend)];
    var isFill=(style==='ring'||style==='halfring'),isHalf=(style==='half'||style==='halfring');
    var center=isHalf?['50%','72%']:(style==='ring'?['50%','52%']:['50%','55%']);
    var radius=isHalf?'96%':(style==='ring'?'82%':'92%');
    var detOff=isHalf?[0,'-14%']:(style==='ring'?[0,'0%']:[0,'38%']);
    var titOff=isHalf?[0,'14%']:(style==='ring'?[0,'40%']:[0,'72%']);
    var width=isFill?13:9;
    var ser={type:'gauge',min:mn,max:mx,startAngle:ANG[0],endAngle:ANG[1],center:center,radius:radius,
      axisTick:{show:!!w.gticks,distance:2,splitNumber:4,length:4,lineStyle:{color:cssv('--faint'),width:1}},splitLine:{show:!!w.gticks,length:8,lineStyle:{color:cssv('--faint'),width:1}},axisLabel:{show:!!w.gticks,color:cssv('--faint'),fontSize:8,distance:12},anchor:{show:!!w.gknob,showAbove:true,size:9,itemStyle:{color:cssv('--text')}},
      title:{show:!!w.label,offsetCenter:titOff,color:cssv('--muted'),fontSize:10},
      detail:{valueAnimation:true,fontSize:(isFill?20:19),offsetCenter:detOff,color:cssv('--text'),fontFamily:'ui-monospace,monospace',formatter:(d&&d.f)?String(d.f):'{value}'},
      data:[{value:val,name:w.label||''}]};
    if(cmode==='graded'&&!isFill){ // Zonen entlang des Bogens, Zeiger zeigt Wert
      ser.axisLine={lineStyle:{width:width,color:[[f1,cssv('--ok')],[f2,cssv('--warm')],[1,cssv('--crit')]]}};
      ser.progress={show:false};
      ser.pointer={show:true,width:4,length:'60%',itemStyle:{color:cssv('--text')}};
    }else{ // einfarbige Füllung/Fortschritt, Rest = Spur
      ser.axisLine={lineStyle:{width:width,color:[[1,cssv('--line')]]}};
      ser.progress={show:true,width:width,roundCap:isFill,itemStyle:{color:fillCol}};
      ser.pointer=isFill?{show:false}:{show:true,width:4,length:'62%',itemStyle:{color:fillCol}};
    }
    ec.setOption({series:[ser]},true);
  }
  function autoColorHex(i){return [cssv('--accent'),cssv('--info'),cssv('--warm')][i%3]||'#00cdab';}
  function setLine(w){
    var ec=_ec[w.id];if(!ec)return;var ct=w.ctype||'area',hs=chartSeries(w);
    var forceStack=false;if(ct==='barstack'){ct='bar';forceStack=true;}
    // Neue Zeitreihen-Typen auf Basis-Rendering + Modifikatoren abbilden (Spline=glatt, Steparea=Stufe+Füllung)
    var smoothOv=null,fillOv=false;
    if(ct==='spline'){ct='line';smoothOv=true;}
    else if(ct==='areaspline'){ct='area';smoothOv=true;}
    else if(ct==='steparea'){ct='step';fillOv=true;}
    function _smooth(){return smoothOv!=null?smoothOv:(w.smooth!==false&&ct!=='step');}
    function _fill(){return ct==='area'||fillOv;}
    var stacked=(w.stack||forceStack);
    var lbl=w.labels?{show:true,fontSize:9,color:cssv('--muted'),position:'top'}:{show:false},hasR=false;
    var series=hs.map(function(s,i){
      var o=(w.sopt&&w.sopt[i])||{},col=o.color||autoColorHex(i),nm=o.name||(i===0?(w.label||'Serie 1'):'Serie '+(i+1)),ax=(o.axis==1?1:0);if(ax===1)hasR=true;
      var st=stacked?'total':undefined;
      if(ct==='bar')return {type:'bar',name:nm,yAxisIndex:ax,stack:st,itemStyle:{color:col,borderRadius:(stacked?0:parseFloat(w.barRadius!=null?w.barRadius:3))},data:s.data,label:lbl};
      if(ct==='scatter')return {type:'scatter',name:nm,yAxisIndex:ax,symbolSize:(w.symSize||7),itemStyle:{color:col},data:s.data,label:lbl};
      var ser={type:'line',name:nm,yAxisIndex:ax,stack:st,showSymbol:!!w.symbols,symbolSize:(w.symSize||5),smooth:_smooth(),step:(ct==='step'?'end':false),lineStyle:{color:col,width:parseFloat(w.lw||2)},itemStyle:{color:col},data:s.data,label:lbl};
      if(_fill())ser.areaStyle=w.grad?{color:gradFill(col)}:{color:accA(stacked?.42:.14,col)};
      return ser;
    });
    // Vergleichsserie (Zeitversatz) — abgeschattet
    var cmpS=(_hist[w.id]&&_hist[w.id].cmp)||null;
    if(cmpS){var shade=(w.cmpShade!=null?w.cmpShade:55)/100,olbl=OFFLBL[w.cmpOff||'1d'];
      cmpS.forEach(function(s,i){if(!s)return;var o=(w.sopt&&w.sopt[i])||{},base=o.color||autoColorHex(i),col=darken(base,shade),ax=(o.axis==1?1:0);if(ax===1)hasR=true;
        var nm=(o.name||(i===0?(w.label||'Serie 1'):'Serie '+(i+1)))+' · '+olbl;
        if(ct==='bar'){series.push({type:'bar',name:nm,yAxisIndex:ax,stack:stacked?'cmp':undefined,itemStyle:{color:col,borderRadius:(stacked?0:parseFloat(w.barRadius!=null?w.barRadius:3))},data:s.data,label:{show:false}});return;}
        if(ct==='scatter'){series.push({type:'scatter',name:nm,yAxisIndex:ax,symbolSize:(w.symSize||7),itemStyle:{color:col},data:s.data});return;}
        var cs={type:'line',name:nm,yAxisIndex:ax,showSymbol:false,smooth:_smooth(),step:(ct==='step'?'end':false),lineStyle:{color:col,width:parseFloat(w.lw||2),type:'dashed'},itemStyle:{color:col},data:s.data,label:{show:false}};
        if(_fill())cs.areaStyle={color:accA(.10,col)};series.push(cs);
      });
    }
    function yAx(pos){return {type:'value',position:pos,scale:(w.ymin==null&&w.ymax==null),min:(w.ymin!=null&&w.ymin!==''?parseFloat(w.ymin):null),max:(w.ymax!=null&&w.ymax!==''?parseFloat(w.ymax):null),axisLine:{show:false},axisLabel:{color:cssv('--faint'),fontSize:9},splitLine:{show:(w.ygrid!==false&&pos!=='right'),lineStyle:{color:cssv('--line-soft')}}};}
    var yA=[yAx('left')];if(hasR)yA.push(yAx('right'));
    var opt={backgroundColor:'transparent',grid:{left:6,right:8,top:(w.legend?26:22),bottom:(w.zoom?34:16),containLabel:true},tooltip:{trigger:'axis'},
      legend:w.legend?(function(){var p=w.legPos||'top',o={show:true,textStyle:{color:cssv('--muted'),fontSize:9},itemWidth:11,itemHeight:8,orient:(p==='left'||p==='right')?'vertical':'horizontal'};if(p==='top')o.top=0;else if(p==='bottom')o.bottom=0;else if(p==='left'){o.left=0;o.top='middle';}else{o.right=4;o.top='middle';}return o;})():{show:false},
      title:w.legend?{show:false}:{text:w.label||'',left:2,top:1,textStyle:{color:cssv('--muted'),fontSize:11,fontWeight:'normal'}},
      xAxis:{type:'time',boundaryGap:(ct==='bar'),axisLine:{lineStyle:{color:cssv('--line')}},axisLabel:{color:cssv('--faint'),fontSize:9},splitLine:{show:false}},
      yAxis:yA,series:series};
    if(w.zoom)opt.dataZoom=[{type:'inside'},{type:'slider',height:13,bottom:4,borderColor:'transparent',backgroundColor:accA(.06),fillerColor:accA(.18),handleStyle:{color:cssv('--accent')},dataBackground:{lineStyle:{color:cssv('--line')},areaStyle:{color:accA(.08)}},textStyle:{color:cssv('--faint'),fontSize:8}}];
    if(w.extrema&&series[0]&&(ct==='line'||ct==='area'||ct==='bar'||ct==='step')){series[0].markPoint={symbol:'pin',symbolSize:32,data:[{type:'max',name:'Max'},{type:'min',name:'Min'}],label:{fontSize:8,color:cssv('--text')},itemStyle:{color:accA(.55)}};}
    ec.setOption(opt,true);
  }
  function fetchHist(w){
    var ids=[w.varId,w.varId2,w.varId3].filter(function(x){return x;});if(!ids.length)return;
    var cols=[cssv('--accent'),cssv('--info'),cssv('--warm')],out=[],cmp=[],done=0;
    var h=(w.hours||24),off=(w.cmpOn?OFFS[w.cmpOff||'1d']:0),now=Math.floor(Date.now()/1000),poff=(w._pOff||0);
    var mTo=now-poff*h*3600,mFrom=mTo-h*3600;
    var total=ids.length*(w.cmpOn&&off?2:1);
    function fin(){done++;if(done>=total){_hist[w.id]={series:out,cmp:(w.cmpOn&&off?cmp:null)};if(_ec[w.id]){renderChartData(w);var pl=$('.w[data-id="'+w.id+'"] [data-role=plabel]',canvas);if(pl)pl.textContent=poff>0?('−'+poff):'jetzt';}}}
    ids.forEach(function(id,i){
      fetch('?api=history&id='+id+'&from='+mFrom+'&to='+mTo,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        out[i]={data:(j&&j.data)||[],color:cols[i%cols.length],name:(i===0?(w.label||'Serie 1'):'Serie '+(i+1))};
      }).catch(function(){out[i]={data:[],color:cols[i%cols.length],name:'Serie '+(i+1)};}).then(fin);
      if(w.cmpOn&&off){var to=mTo-off,from=mFrom-off;
        fetch('?api=history&id='+id+'&from='+from+'&to='+to,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
          cmp[i]={data:((j&&j.data)||[]).map(function(p){return [p[0]+off*1000,p[1]];}),color:cols[i%cols.length]};
        }).catch(function(){cmp[i]={data:[]};}).then(fin);
      }
    });
  }
  function ensureCmp(w,cb){
    if(!w.varId){cb(null);return;}
    var stage=cmpStage(w),kind=((w.cmpCounter||w.type==='cval')?'counter':'standard');
    var c=_cmpData[w.id],now=Date.now();
    if(c&&c.stage===stage&&c.kind===kind&&(now-c.fetched)<25000){cb(c);return;}
    fetch('?api=cmp&id='+w.varId+'&stage='+stage+'&kind='+kind,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _cmpData[w.id]={cur:(j&&j.cur!=null)?parseFloat(j.cur):null,past:(j&&j.past!=null)?parseFloat(j.past):null,type:(j&&j.type)||0,stage:stage,kind:kind,fetched:now};cb(_cmpData[w.id]);
    }).catch(function(){cb(null);});
  }
  function computeCompare(w){
    ensureCmp(w,function(p){
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
      var cur=p?p.cur:null,past=p?p.past:null,ok=(cur!=null&&past!=null);
      var diff=ok?cur-past:null,pct=(ok&&past!==0)?diff/Math.abs(past)*100:(ok?0:null);
      var dir=!ok?'flat':(Math.abs(diff)<1e-9?'flat':(diff>0?'up':'dn'));
      var tone=(dir==='flat')?'muted':(((dir==='up')!==!!w.cmpInvert)?'ok':'crit');
      var arrow=dir==='up'?'▲':(dir==='dn'?'▼':'→');
      var counter=(p&&p.type===1);
      var val=!ok?'–':((w.cmpMode==='abs')?fmtDelta(diff,true)+(w.unit?' '+w.unit:''):fmtDelta(pct,true)+' %');
      var cap='ggü. '+(STAGELBL[cmpStage(w)]||'gestern');
      if(counter&&cur!=null&&w.type==='kpi'){var mv=el.querySelector('[data-role=val]');if(mv)mv.textContent=fmtDelta(cur,false);} // Zähler: Hauptwert = Verbrauch aktuelle Periode
      if(w.type==='kpi'){var s=el.querySelector('[data-role=cmp]');if(s){s.className='hks '+(tone==='ok'?'up':(tone==='crit'?'dn':''));s.textContent=arrow+' '+val+' '+cap;}}
      else if(w.type==='delta'){var root=el.querySelector('[data-role=delroot]');if(root)root.className='hdelta t-'+tone;var ar=el.querySelector('[data-role=arrow]');if(ar)ar.textContent=arrow;var vv=el.querySelector('[data-role=val]');if(vv)vv.textContent=val;var cc=el.querySelector('[data-role=cap]');if(cc)cc.textContent=(w.label?w.label+' · ':'')+cap;}
    });
  }
  function refreshCompare(w){delete _cmpData[w.id];render();computeCompare(w);}
  function computeCounterVal(w){ // Zählerwert-Widget: Verbrauch der gewählten Periode als reiner Wert
    ensureCmp(w,function(p){
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
      var v=el.querySelector('[data-role=val]');if(!v)return;
      var cur=p?p.cur:null;
      if(cur==null){v.textContent='–';return;}
      var a=Math.abs(cur),dd=a>=100?0:(a>=10?1:(a>=1?2:3));
      v.textContent=cur.toFixed(dd).replace('.',',')+(w.unit?' '+w.unit:'');
    });
  }
  function refreshCVal(w){delete _cmpData[w.id];render();computeCounterVal(w);}
  var _aggData={}; // widgetId -> {min,max,avg,stage,fetched}
  function ensureAgg(w,cb){
    if(!w.varId){cb(null);return;}
    var stage=cmpStage(w),c=_aggData[w.id],now=Date.now();
    if(c&&c.stage===stage&&(now-c.fetched)<25000){cb(c);return;}
    fetch('?api=agg&id='+w.varId+'&stage='+stage,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _aggData[w.id]={min:(j&&j.min!=null)?parseFloat(j.min):null,max:(j&&j.max!=null)?parseFloat(j.max):null,avg:(j&&j.avg!=null)?parseFloat(j.avg):null,stage:stage,fetched:now};cb(_aggData[w.id]);
    }).catch(function(){cb(null);});
  }
  function _fmtStat(n,unit){if(n==null)return '–';var a=Math.abs(n),dd=a>=100?0:(a>=10?1:2);return n.toFixed(dd).replace('.',',')+(unit?' '+unit:'');}
  function aggParts(w){var ps=[];if(w.statMin)ps.push('min');if(w.statAvg||(!w.statMin&&!w.statMax&&!w.statAvg))ps.push('avg');if(w.statMax)ps.push('max');return ps;} // Standard: Ø
  function computeAggVal(w){
    ensureAgg(w,function(p){
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var v=el.querySelector('[data-role=val]');if(!v)return;
      var LBL={min:'Min',avg:'Ø',max:'Max'},ps=aggParts(w),u=w.unit||'';
      if(ps.length===1){v.textContent=_fmtStat(p?p[ps[0]]:null,u);}
      else{v.innerHTML=ps.map(function(k){return '<span style="opacity:.55;font-size:.68em;letter-spacing:.02em">'+LBL[k]+'</span> '+esc(_fmtStat(p?p[k]:null,u));}).join(' <span style="opacity:.3">·</span> ');}
    });
  }
  function refreshAggVal(w){delete _aggData[w.id];render();computeAggVal(w);}
  // ===== Thermostat (erweiterte Karte) =====
  function thermMode(w){
    if(!w.varId3)return null;var lv=_lastVals[w.varId3];if(!lv)return {raw:null,name:'',isOff:false,isCool:false,isHeat:true};
    var name='',d=_assocData[w.varId3];if(d){var a=assocFor(w,lv.v);if(a)name=a.name||'';}
    if(!name)name=String(lv.f!=null&&lv.f!==''?lv.f:lv.v);var l=name.toLowerCase();
    return {raw:lv.v,name:name,isOff:/(^|[^a-z])(aus|off)([^a-z]|$)/.test(l),isCool:/(kühl|kuehl|cool)/.test(l),isHeat:/(heiz|heat|warm)/.test(l)};
  }
  function updateTherm(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var iv=_lastVals[w.varId],sv=_lastVals[w.varId2];
    var ist=iv?parseFloat(String(iv.v).replace(',','.')):NaN,soll=sv?parseFloat(String(sv.v).replace(',','.')):NaN;
    var c=$('[data-role=val]',el);if(c)c.textContent=iv?(iv.f!=null&&iv.f!==''?iv.f:iv.v):'–';
    var t=$('[data-role=target]',el);if(t)t.textContent=sv?(sv.f!=null&&sv.f!==''?sv.f:sv.v):'–';
    var t2=$('[data-role=target2]',el);if(t2)t2.textContent=sv?(sv.f!=null&&sv.f!==''?sv.f:sv.v):'–';
    var mn=(w.min!=null?w.min:14),mx=(w.max!=null?w.max:28),rng=(mx-mn)||1;
    var fill=$('[data-role=istfill]',el);if(fill&&!isNaN(ist))fill.style.width=Math.max(0,Math.min(100,(ist-mn)/rng*100))+'%';
    var mk=$('[data-role=sollmk]',el);if(mk&&!isNaN(soll))mk.style.left=Math.max(0,Math.min(100,(soll-mn)/rng*100))+'%';
    var m=thermMode(w),tone='idle',lab='bereit',ic='flame';
    if(m&&m.isOff){tone='off';lab='Aus';ic='power';}
    else if(m&&m.isCool){var dc=(!isNaN(ist)&&!isNaN(soll)&&ist>soll+0.1);tone=dc?'cool':'idle';lab=dc?'kühlt':'bereit';ic='snowflake';}
    else{var dh=(!isNaN(ist)&&!isNaN(soll)&&ist<soll-0.1);tone=dh?'heat':'idle';lab=dh?'heizt':'bereit';ic='flame';}
    var root=el.querySelector('.htc');if(root)root.className='htc tone-'+tone;
    var st=$('[data-role=hstate]',el);if(st)st.innerHTML='<span class="htc-ic">'+iconSVG(ic)+'</span>'+lab;
    $$('[data-role=modes] .htmbtn',el).forEach(function(b){b.classList.toggle('on',String(b.getAttribute('data-mv'))===String(m&&m.raw));});
  }
  function buildThermModes(w){
    var box=$('.w[data-id="'+w.id+'"] [data-role=modes]',canvas);if(!box)return;
    if(!w.varId3){box.innerHTML='';return;}
    loadAssoc(w.varId3,function(d){
      var b2=$('.w[data-id="'+w.id+'"] [data-role=modes]',canvas);if(!b2)return;
      if(!d||!d.assocs.length){b2.innerHTML='';return;}
      b2.innerHTML=d.assocs.map(function(a){return '<button class="htmbtn" data-mv="'+esc(String(a.v))+'">'+esc(a.name||String(a.v))+'</button>';}).join('');
      updateTherm(w);
    });
  }
  function refreshCam(w){var el=$('.w[data-id="'+w.id+'"] [data-role=cam]',canvas);if(el&&w.mediaId)el.src='?api=media&id='+w.mediaId+'&t='+Date.now();}
  function setSankey(w){
    var ec=_ec[w.id];if(!ec)return;var nodesSet={},links=[];
    (w.links||[]).forEach(function(l){if(!l.from||!l.to)return;nodesSet[l.from]=1;nodesSet[l.to]=1;var v=(_lastVals[l.vid]!=null)?parseFloat(_lastVals[l.vid].v):0;if(isNaN(v))v=0;links.push({source:l.from,target:l.to,value:Math.max(0.001,Math.abs(v))});});
    var nodes=Object.keys(nodesSet).map(function(n){return {name:n};});
    ec.setOption({backgroundColor:'transparent',series:[{type:'sankey',left:4,right:4,top:8,bottom:8,data:nodes,links:links,nodeGap:10,nodeWidth:12,emphasis:{focus:'adjacency'},label:{color:cssv('--text'),fontSize:10},itemStyle:{color:cssv('--accent'),borderColor:'transparent'},lineStyle:{color:'gradient',opacity:.35,curveness:.5}}]},true);
  }
  function powerflowSVG(w){
    var src=w.src||[],snk=w.snk||[],W=400,rows=Math.max(src.length,snk.length,1),H=Math.max(150,rows*56+16),cy=H/2;
    function ny(i,cnt){if(cnt<=1)return cy-22;var step=(H-24)/cnt;return 12+step*i+step/2-22;}
    var s='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">';
    src.forEach(function(o,i){var y=ny(i,src.length)+22;s+='<path class="pfline" d="M120 '+y+' C160 '+y+' 150 '+cy+' 180 '+cy+'"/><path class="pfline pfdash" d="M120 '+y+' C160 '+y+' 150 '+cy+' 180 '+cy+'"/>';});
    snk.forEach(function(o,i){var y=ny(i,snk.length)+22;s+='<path class="pfline" d="M240 '+cy+' C270 '+cy+' 250 '+y+' 280 '+y+'"/><path class="pfline pfdash" d="M240 '+cy+' C270 '+cy+' 250 '+y+' 280 '+y+'"/>';});
    s+='<rect class="pfhouse" x="180" y="'+(cy-26)+'" width="60" height="52" rx="10"/><text x="210" y="'+(cy+4)+'" text-anchor="middle" class="pflab">'+esc(w.label||'Haus')+'</text>';
    function node(x,o,i,cnt){var y=ny(i,cnt);return '<rect class="pfnode" x="'+x+'" y="'+y+'" width="110" height="44" rx="9"/><text x="'+(x+11)+'" y="'+(y+18)+'" class="pfnlab">'+esc(o.label||'')+'</text><text x="'+(x+11)+'" y="'+(y+35)+'" class="pfnval"'+(o.vid?' data-vid="'+o.vid+'"':'')+'>–</text>';}
    src.forEach(function(o,i){s+=node(10,o,i,src.length);});
    snk.forEach(function(o,i){s+=node(280,o,i,snk.length);});
    return s+'</svg>';
  }
  function setGaugePro(w,d){
    var ec=_ec[w.id];if(!ec)return;var val=d?parseFloat(d.v):0;if(isNaN(val))val=0;
    var mn=(w.min!=null?w.min:0),mx=(w.max!=null?w.max:100);
    var t1=(w.t1!=null?w.t1:mn+(mx-mn)*0.6),t2=(w.t2!=null?w.t2:mn+(mx-mn)*0.85);
    var f1=Math.max(0,Math.min(1,(t1-mn)/((mx-mn)||1))),f2=Math.max(f1,Math.min(1,(t2-mn)/((mx-mn)||1)));
    ec.setOption({series:[{type:'gauge',min:mn,max:mx,radius:'92%',
      axisLine:{lineStyle:{width:9,color:[[f1,cssv('--ok')],[f2,cssv('--warm')],[1,cssv('--crit')]]}},
      pointer:{width:4,length:'60%',itemStyle:{color:cssv('--text')}},progress:{show:false},axisTick:{show:false},
      splitLine:{length:9,lineStyle:{color:cssv('--faint'),width:1}},axisLabel:{color:cssv('--faint'),fontSize:9,distance:12},anchor:{show:false},
      title:{show:true,offsetCenter:[0,'72%'],color:cssv('--muted'),fontSize:10},
      detail:{valueAnimation:true,fontSize:19,offsetCenter:[0,'38%'],color:cssv('--text'),fontFamily:'ui-monospace,monospace',formatter:(d&&d.f)?String(d.f):'{value}'},
      data:[{value:val,name:w.label||''}]}]},true);
  }
  var MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var DOW=['So','Mo','Di','Mi','Do','Fr','Sa'];
  function pad2(n){return String(n).padStart(2,'0');}
  function fetchCalEvents(w){
    var el=$('.w[data-id="'+w.id+'"] [data-role=cal]',canvas);if(!el)return;
    if(!w.calIds){el.innerHTML='<div class="calempty">Kalender-Instanz-IDs im Panel eintragen (z. B. 33020,55959)</div>';return;}
    fetch('?api=cal&ids='+encodeURIComponent(w.calIds)+'&days='+(w.days||14),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var evs=(j&&j.events)||[];el.innerHTML=((w.calview||'agenda')==='month')?calMonth(evs):calAgenda(evs);
    }).catch(function(){el.innerHTML='<div class="calempty">Kalender nicht erreichbar</div>';});
  }
  function calAgenda(evs){
    if(!evs.length)return '<div class="calempty">Keine Termine im Zeitraum</div>';
    var today=new Date();today.setHours(0,0,0,0);var out='',last='';
    evs.forEach(function(e){
      var d=new Date(e.start),key=d.toDateString();
      if(key!==last){last=key;var dd=new Date(d);dd.setHours(0,0,0,0);var diff=Math.round((dd-today)/86400000);
        var lbl=diff===0?'Heute':diff===1?'Morgen':DOW[d.getDay()]+', '+d.getDate()+'. '+MON[d.getMonth()].slice(0,3);
        out+='<div class="cagd">'+lbl+'</div>';}
      var t=e.allDay?'ganztägig':pad2(d.getHours())+':'+pad2(d.getMinutes());
      out+='<div class="cagr"><span class="cagt">'+t+'</span><span class="cagn">'+esc(String(e.title||''))+'</span></div>';
    });
    return '<div class="cagenda">'+out+'</div>';
  }
  function calMonth(evs){
    var now=new Date(),y=now.getFullYear(),m=now.getMonth(),dayset={};
    evs.forEach(function(e){var d=new Date(e.start);if(d.getFullYear()===y&&d.getMonth()===m)dayset[d.getDate()]=1;});
    var startDow=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
    var h='<div class="hcalh">'+MON[m]+' '+y+'</div><div class="hcalg">';
    ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(function(d){h+='<div class="d hd">'+d+'</div>';});
    for(var i=0;i<startDow;i++)h+='<div class="d"></div>';
    for(var dd=1;dd<=days;dd++)h+='<div class="d'+(dd===now.getDate()?' today':'')+'">'+dd+(dayset[dd]?'<span class="cadot"></span>':'')+'</div>';
    return h+'</div>';
  }
  function tick(){
    var now=new Date();function p(n){return String(n).padStart(2,'0');}
    function _one(w){
      if(w.type==='suncard'){refreshSun(w);return;}
      if(w.type!=='clock'&&w.type!=='timer')return;
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
      if(w.type==='clock'){var t=$('[data-role=time]',el);if(t)t.textContent=p(now.getHours())+':'+p(now.getMinutes());var dt=$('[data-role=date]',el);if(dt)dt.textContent=['So','Mo','Di','Mi','Do','Fr','Sa'][now.getDay()]+', '+now.getDate()+'.'+(now.getMonth()+1)+'.';}
      else{var d=_lastVals[w.varId];if(!d)return;var v=parseFloat(d.v);if(isNaN(v))return;var rem=v>1e9?Math.max(0,v-Math.floor(now.getTime()/1000)):Math.max(0,v);var mm=Math.floor(rem/60),ss=Math.floor(rem%60),tt=$('[data-role=time]',el);if(tt)tt.textContent=(mm>=60?Math.floor(mm/60)+':'+p(mm%60):p(mm))+':'+p(ss);var tot=w.max||3600,bar=$('[data-role=bar]',el);if(bar)bar.style.width=Math.max(0,Math.min(100,rem/tot*100))+'%';}
    }
    state.widgets.forEach(_one);
    if(_compKids&&_compKids.length)_compKids.forEach(_one); // Uhr/Timer/Sonne in Komponenten
    if(_tickKids&&_tickKids.length)_tickKids.forEach(_one); // ... und in der Laufzeile
  }
  setInterval(tick,1000);
  // Relative Pfade (z. B. IPS-HTML mit ./preview/... ) gegen eine Basis auflösen -> absolute URLs, damit Bilder im Widget laden.
  function _htmlAbs(u,base){if(u==null)return u;u=(''+u).trim();if(u===''||/^(https?:|data:|blob:|mailto:|tel:|javascript:|#)/i.test(u)||u.slice(0,2)==='//'||u.charAt(0)==='/')return u;try{return new URL(u,base).href;}catch(e){return u;}}
  function _htmlBase(w,pd){var b=(w&&w.htmlBase||'').trim();if(b){if(!/^https?:/i.test(b))b=location.origin+(b.charAt(0)==='/'?'':'/')+b;return b.replace(/\/?$/,'/');}try{var bt=pd&&pd.querySelector('base[href]');if(bt)return new URL(bt.getAttribute('href'),location.origin+'/').href;}catch(e){}return location.origin+'/';} // Standard = Server-Wurzel (dort liegen /preview, /tile ...)
  function _htmlRewriteUrls(root,base){try{
    root.querySelectorAll('[src],[href],[poster],[data-src]').forEach(function(e){['src','href','poster','data-src'].forEach(function(a){if(e.hasAttribute(a)){var v=e.getAttribute(a),n=_htmlAbs(v,base);if(n!==v)e.setAttribute(a,n);}});});
    root.querySelectorAll('[srcset]').forEach(function(e){e.setAttribute('srcset',e.getAttribute('srcset').split(',').map(function(p){var x=p.trim().split(/\s+/);if(x[0])x[0]=_htmlAbs(x[0],base);return x.join(' ');}).join(', '));});
    var urlRe=/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,rep=function(m,q,u){return 'url('+q+_htmlAbs(u,base)+q+')';};
    root.querySelectorAll('[style]').forEach(function(e){var st=e.getAttribute('style'),n=st.replace(urlRe,rep);if(n!==st)e.setAttribute('style',n);});
    root.querySelectorAll('style').forEach(function(s){var t=s.textContent,n=t.replace(urlRe,rep);if(n!==t)s.textContent=n;});
  }catch(e){}}
  function setHtmlContent(w,t){var host=$('.w[data-id="'+w.id+'"] [data-role=htmlhost]',canvas);if(!host)return;t=(t&&t.length)?t:'';
    var mode=w.htmlMode||'auto';if(mode==='auto')mode=/<script[\s>]/i.test(t)?'iframe':'shadow'; // JS -> iframe, sonst Shadow DOM
    host.innerHTML=''; // frischer Container (erlaubt Moduswechsel; Shadow lässt sich nicht wieder abnehmen)
    if(mode==='iframe'){
      var base=_htmlBase(w,null);
      var f=document.createElement('iframe');
      f.setAttribute('sandbox','allow-same-origin allow-scripts allow-popups');
      f.style.cssText='width:100%;height:100%;border:0;background:transparent';
      f.onload=function(){try{var d=f.contentDocument;if(d&&d.body){d.documentElement.style.background='transparent';d.body.style.background='transparent';d.body.style.margin='0';}}catch(e){}applyHtmlScale(w);};
      host.appendChild(f);
      f.srcdoc='<!doctype html><meta charset="utf-8"><base href="'+base+'"><style>html,body{margin:0;background:transparent!important}</style>'+t; // <base> löst relative Pfade auf
      return;
    }
    // Voll-Dokumente (<html>/<head>/<body>) werden in Shadow-DOM-innerHTML verworfen -> per DOMParser Body+Head-Styles extrahieren
    var headHtml='',bodyHtml=t,pd=null;
    try{pd=new DOMParser().parseFromString(t,'text/html');}catch(e){}
    var base=_htmlBase(w,pd);
    if(pd){_htmlRewriteUrls(pd,base);if(pd.head)headHtml=pd.head.innerHTML;if(pd.body&&pd.body.innerHTML.trim()!=='')bodyHtml=pd.body.innerHTML;} // relative -> absolute (Shadow DOM ignoriert <base>, daher Rewrite)
    var c=document.createElement('div');c.setAttribute('data-role','shchild');c.style.cssText='width:100%;height:100%';
    host.appendChild(c);
    var sh=c.attachShadow({mode:'open'}); // Shadow DOM: transparent + style-isoliert (iOS-Weiß-Bug entfällt)
    sh.innerHTML='<style>:host{display:block;background:transparent}#shwrap{transform-origin:top left;background:transparent}</style>'+headHtml+'<div id="shwrap">'+bodyHtml+'</div>';
    applyHtmlScale(w);}
  function fetchHtml(w){if(!w.varId)return;fetch('?api=html&id='+w.varId,{cache:'no-store'}).then(function(r){return r.text();}).then(function(t){setHtmlContent(w,t);}).catch(function(){});}
  function applyHtmlScale(w){
    if(w.type!=='html')return;
    var host=$('.w[data-id="'+w.id+'"] [data-role=htmlhost]',canvas);if(!host)return;
    var f=host.querySelector('iframe');
    if(f){ // iframe-Modus (JS): Skalierung über body.zoom
      var fit=(w.htmlFit==='width'||w.htmlFit==='both');
      try{var d=f.contentDocument;if(!d||!d.body)return;var b=d.body,h=d.documentElement;b.style.transformOrigin='top left';
        if(fit){b.style.zoom='';h.style.overflow='visible';var nw=Math.max(b.scrollWidth,h.scrollWidth,1),nh=Math.max(b.scrollHeight,h.scrollHeight,1);b.style.zoom=(w.htmlFit==='both')?Math.min(f.clientWidth/nw,f.clientHeight/nh):(f.clientWidth/nw);h.style.overflow='hidden';}
        else{h.style.overflow='';b.style.zoom=((w.htmlZoom||100)/100);}
      }catch(e){}
      return;
    }
    var c=host.querySelector('[data-role=shchild]');if(!c||!c.shadowRoot)return;
    var wrap=c.shadowRoot.getElementById('shwrap');if(!wrap)return;
    wrap.style.transform='';
    if(w.htmlFit==='width'||w.htmlFit==='both'){
      var nw2=Math.max(wrap.scrollWidth,1),nh2=Math.max(wrap.scrollHeight,1);
      wrap.style.transform='scale('+((w.htmlFit==='both')?Math.min(host.clientWidth/nw2,host.clientHeight/nh2):(host.clientWidth/nw2))+')';
    }else{
      var z=(w.htmlZoom||100)/100;if(z!==1)wrap.style.transform='scale('+z+')';
    }
  }
  setInterval(function(){state.widgets.forEach(function(w){if(w.type==='chart'||w.type==='spark')fetchHist(w);if(w.type==='html'&&w.htmlSrc!=='custom')fetchHtml(w);if(w.type==='weekplan')fetchWeekplan(w);if(w.type==='calendar')fetchCalEvents(w);if(w.type==='eventctl')fetchEvent(w);if(w.type==='objinfo')fetchObjInfo(w);if(w.type==='statetl')_stlFetch(w);if(w.type==='table')_tblLoad(w);});},60000);
  setInterval(function(){var now=Date.now();state.widgets.forEach(function(w){if(w.type==='camera'||w.type==='campro'){var iv=((w.refresh>0)?w.refresh:15)*1000;if(!w._lastCam||now-w._lastCam>=iv){w._lastCam=now;refreshCam(w);}}});},1000);

  // ---------- Auswahl & Eigenschaften ----------
  var sel={},clip=[];
  // ---------- Undo/Redo (History der aktuellen Ansicht) ----------
  var hist=[],hpos=-1,restoring=false;
  function commit(){if(restoring)return;invalidateSC();var s=JSON.stringify(state);if(hist[hpos]===s)return;hist=hist.slice(0,hpos+1);hist.push(s);hpos=hist.length-1;if(hist.length>80){hist.shift();hpos--;}updateUndo();markDirty();scheduleSave();}
  function resetHist(){hist=[JSON.stringify(state)];hpos=0;updateUndo();}
  function updateUndo(){var u=$('#undoBtn'),r=$('#redoBtn');if(u)u.disabled=(hpos<=0);if(r)r.disabled=(hpos>=hist.length-1);}
  function applyHist(){restoring=true;var v=JSON.parse(hist[hpos]);store.views[store.current]=v;state=v;selClear();render();renderProps();restoring=false;updateUndo();}
  function undo(){if(hpos>0){hpos--;applyHist();}}
  function redo(){if(hpos<hist.length-1){hpos++;applyHist();}}
  function selClear(){sel={};selId=null;}
  function markSel(){$$('.w',canvas).forEach(function(e){e.classList.toggle('sel',!!sel[e.dataset.id]);});}
  function select(id,additive){
    if(id==null){selClear();}
    else if(additive){if(sel[id]){delete sel[id];if(selId===id)selId=Object.keys(sel)[0]||null;}else{sel[id]=true;selId=id;}}
    else{sel={};sel[id]=true;selId=id;}
    markSel();try{renderProps();}catch(_e){console.error('renderProps',_e);}if(id!=null&&!additive)showTab('props'); // renderProps darf Auswahl/Drag nie blockieren
  }
  function namedWidgets(excludeId){var out=[];for(var vn in store.views){(store.views[vn].widgets||[]).forEach(function(x){if(x.name&&x.id!==excludeId)out.push({name:x.name,type:x.type,view:vn,id:x.id});});}return out;} // alle benannten Widgets (alle Ansichten)
  function widgetByName(name){if(!name)return null;for(var vn in store.views){var f=(store.views[vn].widgets||[]).filter(function(x){return x.name===name;})[0];if(f)return f;}return null;}
  function widget(id){var w=state.widgets.filter(function(x){return x.id===id;})[0];if(w)return w;if(_compKids&&_compKids.length){var ck=_compKids.filter(function(x){return x.id===id;})[0];if(ck)return ck;}if(_tickKids&&_tickKids.length){var tk=_tickKids.filter(function(x){return x.id===id;})[0];if(tk)return tk;}if(_popup&&_popup.widgets)return _popup.widgets.filter(function(x){return x.id===id;})[0];return w;}
  // A1: Overlay/Popup — eine Ansicht als schwebendes Fenster über der aktuellen Ansicht
  var _popup=null;
  var _navStack=[]; // B3: Seiten-Verlauf für Zurück-Navigation
  function navGo(name){if(!store.views[name])return;if(store.current&&store.current!==name)_navStack.push(store.current);switchView(name);fitCanvas();}
  function navBack(){if(_navStack.length){switchView(_navStack.pop());fitCanvas();}}
  function _aliasMap(w){var m={};(w.alias||[]).forEach(function(a){var f=parseInt(a.from),t=parseInt(a.to);if(f&&t)m[f]=t;});return m;}
  function openPopup(name,alias){
    if(!name||!store.views[name]){toast('Popup-Seite fehlt: '+name);return;}
    closePopup();
    var v=store.views[name],map=alias||{};
    function mp(id){return (id&&map[id]!=null)?map[id]:id;}
    var ws=(v.widgets||[]).map(function(w){var c={};for(var k in w)c[k]=w[k];c.varId=mp(c.varId);c.varId2=mp(c.varId2);c.varId3=mp(c.varId3);if(c.visVar)c.visVar=mp(c.visVar);return c;});
    _popup={name:name,widgets:ws,page:(v.page||{w:1440,h:900})};
    var oc=$('#ovcanvas'),card=$('#ovcard');if(!oc||!card)return;
    var pw=_popup.page.w,ph=_popup.page.h,sc=Math.min(1,(window.innerWidth*0.9)/pw,(window.innerHeight*0.84)/ph);
    oc.style.width=pw+'px';oc.style.height=ph+'px';oc.style.transform='scale('+sc+')';
    card.style.width=Math.round(pw*sc)+'px';card.style.height=Math.round(ph*sc)+'px';
    oc.innerHTML='';
    _popup.widgets.forEach(function(w){
      var dd=document.createElement('div');dd.className='w t-'+w.type;dd.dataset.id=w.id;
      dd.style.left=w.x+'px';dd.style.top=w.y+'px';dd.style.width=w.w+'px';dd.style.height=w.h+'px';
      dd.innerHTML='<div class="winner">'+widgetInner(w)+'</div>';
      if(w.type==='value'&&w.valfs){var vv=$('.v',dd);if(vv)vv.style.fontSize=w.valfs+'px';}
      if(w.bg)dd.style.background=w.bg;if(w.fg)dd.style.color=w.fg;
      oc.appendChild(dd);
    });
    $('#overlay').classList.add('open');
    invalidateVidx(); // Popup-Widgets in den Index aufnehmen, bevor Werte gesetzt werden
    _popup.widgets.forEach(function(w){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);});
    _pvSince=0;pollVals();
  }
  function closePopup(){var ov=$('#overlay');if(ov)ov.classList.remove('open');var oc=$('#ovcanvas');if(oc)oc.innerHTML='';_popup=null;invalidateVidx();}
  // M3: Custom Controls — eine Ansicht als parametrierbare, wiederverwendbare Komponente (Master), Instanzen remappen IDs (Alias)
  var _compKids=[];
  var _tickKids=[]; // Ticker-Laufband: darin laufende Widget-Instanzen (Live wie _compKids)
  var _regions={}; // B2: Slot-Name -> aktuell angezeigte Ansicht (Laufzeit)
  function setRegion(slot,view){if(!slot)return;_regions[slot]=view;render();}
  function expandComponent(w){
    var host=$('.w[data-id="'+w.id+'"] [data-role=comphost]',canvas);if(!host)return;
    var srcName=(w.slot&&_regions[w.slot])||w.comp;
    if(!srcName||!store.views[srcName]){host.innerHTML='<div style="padding:8px;font-size:11px;color:var(--faint)">'+(w.slot?'Region „'+esc(w.slot)+'"':'Komponente wählen …')+'</div>';return;}
    if(srcName===store.current){host.innerHTML='<div style="padding:8px;font-size:11px;color:var(--warn)">Selbstbezug – andere Ansicht wählen</div>';return;}
    var src=store.views[srcName],sw=(src.page&&src.page.w)||400,sh=(src.page&&src.page.h)||300,sc=Math.min(w.w/sw,w.h/sh);
    var map={};(w.alias||[]).forEach(function(a){var f=parseInt(a.from),t=parseInt(a.to);if(f&&t)map[f]=t;});
    function mp(id){return (id&&map[id]!=null)?map[id]:id;}
    var inner='<div class="compinner" style="position:absolute;left:0;top:0;width:'+sw+'px;height:'+sh+'px;transform-origin:top left;transform:scale('+sc+');pointer-events:'+(mode==='edit'?'none':'auto')+'">';
    (src.widgets||[]).forEach(function(mw){var c={};for(var k in mw)c[k]=mw[k];c.id=w.id+'__'+mw.id;c.varId=mp(c.varId);c.varId2=mp(c.varId2);c.varId3=mp(c.varId3);if(c.visVar)c.visVar=mp(c.visVar);
      inner+='<div class="w t-'+c.type+'" data-id="'+c.id+'" style="position:absolute;left:'+c.x+'px;top:'+c.y+'px;width:'+c.w+'px;height:'+c.h+'px'+(c.bg?';background:'+c.bg:'')+(c.fg?';color:'+c.fg:'')+'"><div class="winner">'+widgetInner(c)+'</div></div>';
      _compKids.push(c);});
    host.innerHTML=inner+'</div>';}
  // Wert-Format pro Widget
  var FMTS={auto:'Original',kw:'kW',kwh:'kWh',w:'W',r0:'0 Dez.',r1:'1 Dez.',pct:'Prozent',time:'Uhrzeit',date:'Datum',rel:'Relativzeit'};
  var FMT_TYPES=['value','bar','chip','tile','room','sun','thermostat','weather','light','cover','slider'];
  function fmtOpts(cur){cur=cur||'auto';return Object.keys(FMTS).map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+FMTS[k]+'</option>';}).join('');}
  function selOf(id,cur,opts){cur=cur||opts[0];return '<select id="'+id+'">'+opts.map(function(s){return '<option value="'+s+'"'+(s===cur?' selected':'')+'>'+s+'</option>';}).join('')+'</select>';}
  function dirSel(id,cur){cur=cur||'up';return '<select id="'+id+'"><option value="up"'+(cur==='up'?' selected':'')+'>▲ auf</option><option value="dn"'+(cur==='dn'?' selected':'')+'>▼ ab</option><option value="flat"'+(cur==='flat'?' selected':'')+'>→ neutral</option></select>';}
  function offSel(id,cur,withLast){cur=cur||'1d';var o=(withLast?'<option value="last"'+(cur==='last'?' selected':'')+'>Letzter Wert</option>':'')+Object.keys(OFFS).map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+OFFLBL[k]+'</option>';}).join('');return '<select id="'+id+'">'+o+'</select>';}
  function seriesEditor(w){
    var vids=[w.varId,w.varId2,w.varId3],h='<div class="pgh">Serien (Name · Farbe · Achse)</div>',any=false;
    vids.forEach(function(vid,i){if(!vid)return;any=true;var o=(w.sopt&&w.sopt[i])||{};
      h+='<div class="serow"><input data-sopt="name.'+i+'" value="'+esc(o.name||'')+'" placeholder="Serie '+(i+1)+'"><input type="color" data-sopt="color.'+i+'" value="'+(o.color||autoColorHex(i)||'#00cdab')+'"><select data-sopt="axis.'+i+'"><option value="0"'+((o.axis|0)===0?' selected':'')+'>L</option><option value="1"'+((o.axis|0)===1?' selected':'')+'>R</option></select></div>';});
    if(!any)h+='<div class="hint" style="margin:2px">Variablen unter „Variable" bzw. „Serie 2/3" binden.</div>';
    return h;
  }
  // Dial-Geometrie (270°-Bogen, Lücke unten)
  function _dpt(deg){var a=deg*Math.PI/180;return [(50+40*Math.cos(a)).toFixed(2),(50+40*Math.sin(a)).toFixed(2)];}
  function dialTrack(){var s=_dpt(135),e=_dpt(45);return 'M'+s[0]+' '+s[1]+' A40 40 0 1 1 '+e[0]+' '+e[1];}
  function dialProg(fr){fr=Math.max(0,Math.min(1,fr));var s=_dpt(135),e=_dpt(135+270*fr),la=(270*fr>180)?1:0;return 'M'+s[0]+' '+s[1]+' A40 40 0 '+la+' 1 '+e[0]+' '+e[1];}
  function fetchWeekplan(w){if(!w.varId)return;var el=$('.w[data-id="'+w.id+'"] [data-role=wpgrid]',canvas);if(!el)return;
    fetch('?api=weekplan&id='+w.varId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.days){el.innerHTML='<div class="hwpempty">kein Wochenplan</div>';return;}
      var dn=['Mo','Di','Mi','Do','Fr','Sa','So'],h='';
      var _nw=new Date(),_nowPct=(_nw.getHours()*60+_nw.getMinutes())/1440*100,_today=(_nw.getDay()+6)%7;
      for(var i=0;i<7;i++){var segs=(j.days[i]||[]).map(function(s){var col=(j.groups&&j.groups[s.group]&&j.groups[s.group].color)||'#3a4a52';return '<i style="left:'+(s.from/1440*100)+'%;width:'+((s.to-s.from)/1440*100)+'%;background:'+col+'"></i>';}).join('');
        if(i===_today)segs+='<i class="wpnow" style="left:'+_nowPct+'%"></i>';
        h+='<div class="hwpday'+(i===_today?' today':'')+'"><span>'+dn[i]+'</span><div class="hwpcol">'+segs+'</div></div>';}
      el.innerHTML=h;
      var tf=$('.w[data-id="'+w.id+'"] [data-role=wptimes]',canvas);if(tf){var tl=(j.days[_today]||[]).map(function(s){var hh=Math.floor(s.from/60),mm=s.from%60;return ('0'+hh).slice(-2)+':'+('0'+mm).slice(-2);}).join(' · ');tf.textContent=tl?('Heute: '+tl):'';}
    }).catch(function(){el.innerHTML='<div class="hwpempty">Fehler</div>';});}
  function anchorGrid(cur){
    var keys=['tl','tc','tr','ml','mc','mr','bl','bc','br'],g='<div id="pAnchor" style="display:inline-grid;grid-template-columns:repeat(3,18px);gap:3px">';
    keys.forEach(function(k){g+='<button type="button" class="anbtn'+((cur||'mc')===k?' on':'')+'" data-an="'+k+'"></button>';});
    return g+'</div>';
  }
  function respSection(w){
    var locked=SF_LOCK[w.type],pol=w.fit||'',autoLbl=(sfClass(w)==='s'?'Stretch':(SF_NOGROW[w.type]?'Fix':'Skaliert'));
    var opts='<option value=""'+(pol===''?' selected':'')+'>Auto ('+autoLbl+')</option>'+(locked?'':'<option value="fix"'+(pol==='fix'?' selected':'')+'>Fix</option><option value="scale"'+(pol==='scale'?' selected':'')+'>Skaliert</option>')+'<option value="stretch"'+(pol==='stretch'?' selected':'')+'>Stretch</option>';
    var scaleish=(pol==='scale'||pol==='fix'||(pol===''&&sfClass(w)==='x')),pr=w.prio||SF_PRIO[w.type]||2;
    var h='<div class="pgh">Responsiv (SmartFit)</div>';
    h+=row('Skalierung','<select id="pFit">'+opts+'</select>');
    if(scaleish)h+=row('Anker',anchorGrid(w.anchor||''));
    h+=row('Priorität','<select id="pPrio"><option value="1"'+(pr===1?' selected':'')+'>Fix</option><option value="2"'+(pr===2?' selected':'')+'>Normal</option><option value="3"'+(pr===3?' selected':'')+'>Fokus</option></select>');
    h+=row('Gruppe','<input id="pGrp" value="'+esc(w.grp||'')+'" placeholder="leer = auto">');
    h+=row('Min B/H','<input id="pMinW" type="number" style="width:58px" value="'+(w.minW||'')+'" placeholder="B"> <input id="pMinH" type="number" style="width:58px" value="'+(w.minH||'')+'" placeholder="H">');
    h+=row('Reflow','<label style="font-size:12px;display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="pRHide"'+(w.reflowHide?' checked':'')+'> ausblenden</label>');
    return h;
  }
