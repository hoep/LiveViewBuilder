  // ===== Widget: Thermostat — Heizung mit Ist/Soll, Balken, Modi und +/− Steller =====
  //  Zwei Bauformen unter EINEM Typ:
  //   'klassisch' (Vorgabe, w.thStil leer): der bisherige Aufbau, byte-gleich wie zuvor.
  //     Gezeichnet wird er weiterhin von updateTherm/buildThermModes (js/03-render-charts.js),
  //     bedient von js/05-interaction.js.
  //   'karte'    (w.thStil='karte'): die Raumkarte mit Thermometer, Zieh-Griff, Heizprofilen
  //     und Kalender-Sprung. Ihre gesamte Logik liegt HIER (render/mount/click/live), weil der
  //     Registry-click-Hook als einziger vor den Navigationszweigen in _wClick laeuft.
  //  Alle Eigenschaften der Karte tragen das Praefix 'th' und kollidieren daher mit keinem
  //  bestehenden Feld; keine alte Eigenschaft aendert Namen oder Bedeutung.

  function _thkOn(w){return w&&w.thStil==='karte';}
  // Grenzen und Schrittweite, die die Karte schreiben DARF. Bewusst nicht aus dem Profil
  // ~Temperature abgeleitet: dort stehen -30..70 in 5er-Schritten, das Modul erlaubt 5..30.
  function _thkSp(w){
    var mn=(w.thSpMin!=null&&w.thSpMin!==''?parseFloat(w.thSpMin):5),mx=(w.thSpMax!=null&&w.thSpMax!==''?parseFloat(w.thSpMax):30);
    if(isNaN(mn)||isNaN(mx)||!(mx>mn)){mn=5;mx=30;}
    var st=parseFloat(w.step);if(isNaN(st)||st<=0)st=0.5;
    return {min:mn,max:mx,step:st};
  }
  // Nachkommastellen aus der Schrittweite: 0,5 -> 1, 0,25 -> 2. Ein hartes toFixed(1) wuerde
  // bei feineren Schritten systematisch driften.
  function _thkDec(st){var s=String(st),i=s.indexOf('.');return i<0?0:Math.min(3,s.length-i-1);}
  // Skala des Thermometers (dieselben Felder wie beim Klassiker: reine Anzeige, keine Grenze).
  function _thkScale(w){var mn=(w.min!=null?parseFloat(w.min):14),mx=(w.max!=null?parseFloat(w.max):28);
    if(isNaN(mn))mn=14;if(isNaN(mx))mx=28;if(!(mx>mn))mx=mn+1;return {min:mn,max:mx};}
  function _thkNum(id){var d=id&&_lastVals[id];if(!d)return NaN;var n=parseFloat(String(d.v).replace(',','.'));return isNaN(n)?NaN:n;}
  function _thkUnit(w){return (w.thUnit!=null&&w.thUnit!=='')?w.thUnit:'°C';}
  // Einheit vom formatierten Wert abtrennen (an der LETZTEN Ziffer), sonst faellt es auf
  // w.thUnit zurueck. So steht die Einheit klein neben der grossen Zahl statt in ihr.
  function _thkSplit(w,d){
    var u=_thkUnit(w);
    if(!d)return {txt:'–',unit:u};
    var raw=(d.f!=null&&d.f!=='')?d.f:d.v;
    if(raw==null||raw==='')return {txt:'–',unit:''};
    var s=String(raw),m=s.match(/^(.*\d)([^0-9]*)$/);
    if(m){var r=m[2].replace(/\s+/g,'');return {txt:m[1],unit:r||u};}
    // Kein Ziffernzeichen im Wert (Text- oder Schaltvariable): dann ist die Einheit eine
    // Behauptung. "Aus °C" waere schlechter als ein blankes "Aus".
    return {txt:s,unit:''};
  }
  // Zustaende der Heizprofile. Die Praesenz-Variable hat KEIN Variablenprofil, deshalb kommen
  // die Beschriftungen aus dem Feld (Werte implizit 0,1,2 - abweichend per "Text=Wert").
  function _thkPres(w){
    var raw=(w.thPresLbl!=null&&w.thPresLbl!=='')?String(w.thPresLbl):'Normal,Erweitert,Abgesenkt',out=[];
    raw.split(',').forEach(function(s,i){
      s=String(s).trim();if(!s)return;
      var v=i,t=s,p=s.lastIndexOf('=');
      if(p>0){var n=parseFloat(s.slice(p+1));if(!isNaN(n)){t=s.slice(0,p).trim();v=n;}}
      out.push({v:v,text:t});
    });
    return out;
  }
  // Heizt/kuehlt es gerade? true/false = Aussage moeglich, null = keine Quelle -> die Pille
  // wird gar nicht gezeigt, statt einen Zustand zu behaupten.
  function _thkAktiv(w){
    var q=w.thStatQ||'calc';
    if(q==='aus')return null;
    if(q==='var'){
      if(!w.thHeatVar)return null;
      var d=_lastVals[w.thHeatVar];if(!d)return null;
      if(d.v===true||d.v===false)return d.v===true;
      var n=parseFloat(String(d.v).replace(',','.'));
      if(isNaN(n)){var s=String(d.v).toLowerCase();return (s==='true'||s==='on'||s==='ein');}
      var thr=parseFloat(w.thHeatThr);if(isNaN(thr))thr=5;
      return n>=thr;
    }
    var ist=_thkNum(w.varId),soll=_thkNum(w.varId2);
    if(isNaN(ist)||isNaN(soll))return null;
    return (w.thMode==='kuehl')?(ist>soll+0.1):(ist<soll-0.1);
  }
  // Ton, Text und Icon der Zustandspille. w.thMode begrenzt, was die Karte behaupten darf:
  // in dieser Anlage kann NICHT gekuehlt werden, deshalb ist 'heiz' die Vorgabe und "Ist ueber
  // Soll" ergibt den neutralen Text "Zu warm" statt eines erfundenen Kuehlbetriebs.
  function _thkTone(w){
    if((w.thStatQ||'calc')==='aus')return null;
    var md=w.thMode||'heiz',akt=_thkAktiv(w);
    var tH=(w.thHeatTxt!=null&&w.thHeatTxt!==''?w.thHeatTxt:'Heizt');
    var tC=(w.thCoolTxt!=null&&w.thCoolTxt!==''?w.thCoolTxt:'Kühlt');
    var tI=(w.thIdleTxt!=null&&w.thIdleTxt!==''?w.thIdleTxt:'Bereit');
    var tW=(w.thWarmTxt!=null&&w.thWarmTxt!==''?w.thWarmTxt:'Zu warm');
    var ist=_thkNum(w.varId),soll=_thkNum(w.varId2);
    if(md==='auto'){
      var m=(typeof thermMode==='function')?thermMode(w):null;
      if(m&&m.isOff)return {tone:'off',lab:'Aus',ic:'power'};
      if(m&&m.isCool){var dc=(!isNaN(ist)&&!isNaN(soll)&&ist>soll+0.1);return dc?{tone:'cool',lab:tC,ic:'snowflake'}:{tone:'idle',lab:tI,ic:'snowflake'};}
      if(akt===null)return null;
      return akt?{tone:'heat',lab:tH,ic:'flame'}:{tone:'idle',lab:tI,ic:'temperature'};
    }
    if(akt===null)return null;
    if(md==='kuehl')return akt?{tone:'cool',lab:tC,ic:'snowflake'}:{tone:'idle',lab:tI,ic:'temperature'};
    if(akt)return {tone:'heat',lab:tH,ic:'flame'};
    if(!isNaN(ist)&&!isNaN(soll)&&ist>soll+0.1)return {tone:'idle',lab:tW,ic:'temperature'};
    return {tone:'idle',lab:tI,ic:'temperature'};
  }
  // Sollwert-Optik (Steller, Abweichung, Griff) - getrennt, weil das Ziehen sie ohne
  // Serverantwort sofort setzt und _thkPaint sie danach mit dem echten Wert bestaetigt.
  function _thkSoll(w,el,soll,txt){
    var sc=_thkScale(w),u=_thkUnit(w);
    var t2=$('[data-role=target2]',el);
    if(t2)t2.textContent=(txt!=null&&txt!=='')?txt:(isNaN(soll)?'–':(_thkFmt(w,soll)+(u?(' '+u):'')));
    var g=$('[data-role=sollgrip]',el);
    if(g&&!isNaN(soll))g.style.bottom=Math.max(0,Math.min(100,(soll-sc.min)/((sc.max-sc.min)||1)*100))+'%';
    var ds=$('[data-role=devsub]',el);
    if(ds){var ist=_thkNum(w.varId),dv=(!isNaN(ist)&&!isNaN(soll))?(ist-soll):NaN;
      // Gradzeichen statt Kelvin: physikalisch waere K fuer eine Differenz richtig, gelesen
      // wird die Zeile aber neben zwei Temperaturen in Grad - und dort liest sich ein K wie
      // eine zweite Einheit.
      ds.textContent=isNaN(dv)?'Soll':('Soll · '+(dv>=0?'+':'−')+Math.abs(dv).toFixed(1).replace('.',',')+' °');}
  }
  function _thkFmt(w,v){var sp=_thkSp(w);return v.toFixed(_thkDec(sp.step)).replace('.',',');}
  // EIN Anwender fuer alle Slots - von mount (aus dem Zwischenspeicher) UND live (Aenderung)
  // gerufen. Ohne den gemeinsamen Weg bliebe die Karte nach dem Seitenaufbau leer.
  function _thkPaint(w,el){
    if(!el)return;
    var root=el.querySelector?el.querySelector('.thk'):null;if(!root)return;
    var sc=_thkScale(w),iv=_lastVals[w.varId],sv=_lastVals[w.varId2];
    var ist=_thkNum(w.varId),soll=_thkNum(w.varId2);
    var sp=_thkSplit(w,iv),vb=$('[data-role=val]',el);
    if(vb)vb.textContent=sp.txt;
    var un=root.querySelector('.thk-unit');if(un)un.textContent=sp.unit;
    var fl=$('[data-role=istfill]',el);
    if(fl&&!isNaN(ist))fl.style.height=Math.max(0,Math.min(100,(ist-sc.min)/((sc.max-sc.min)||1)*100))+'%';
    var ss=sv?_thkSplit(w,sv):null;                               // Sollwert wie geliefert zeigen, Einheit aber nur einmal
    _thkSoll(w,el,soll,ss?(ss.txt+(ss.unit?(' '+ss.unit):'')):null);
    var st=$('[data-role=hstate]',el),to=_thkTone(w);
    if(st){if(to){st.innerHTML='<span class="thk-ic">'+iconSVG(to.ic)+'</span>'+esc(to.lab);st.style.display='';}else st.style.display='none';}
    var pf=$('[data-role=prof]',el);
    if(pf&&w.thPresVar){var pv=_lastVals[w.thPresVar];if(pv)_sldMark(pf,_thkPres(w),pv.v);}
    // Klasse vollstaendig neu setzen: classList.add wuerde das naechste Neuzeichnen nicht ueberleben.
    var arm=(w.thArmVar&&_lastVals[w.thArmVar])?_lastVals[w.thArmVar]:null;
    var schatten=!!(arm&&!(arm.v===true||arm.v===1||arm.v==='1'||arm.v==='true'));
    var voll=!!$('[data-role=prof]',el);                          // mit Profilzeile ist weniger Hoehe fuer die grosse Zahl da
    root.className='thk'+(voll?' thk-full':'')+' tone-'+((to&&to.tone)||'idle')+(schatten?' thk-shadow':'');
  }

  // ---------------------------------------------------------------- Griff ziehen
  // Muster aus slider.js: Optik sofort, Schreiben gedrosselt, Endwert bei pointerup.
  // Die Sperre gilt NUR fuer die Karte, an der gezogen wurde - global wuerde ein Zug am
  // Thermometer 400 ms lang die Knoepfe aller anderen Karten verschlucken.
  var _thkDrag=null,_thkBlock={t:0,id:''};
  function _thkMove(e,still){
    var d=_thkDrag;if(!d)return;
    var r=d.bar.getBoundingClientRect();if(!r.height)return;
    var sc=_thkScale(d.w),sp=_thkSp(d.w);
    var f=1-((e.clientY-r.top)/r.height);
    var v=sc.min+Math.max(0,Math.min(1,f))*(sc.max-sc.min);
    v=Math.round(v/sp.step)*sp.step;
    v=Math.max(sp.min,Math.min(sp.max,v));
    v=parseFloat(v.toFixed(_thkDec(sp.step)));
    d.val=v;_thkSoll(d.w,d.el,v);
    if(!still){var now=Date.now();if(now-d.last>=110){d.last=now;setVar(d.w.varId2,v);}}
    if(e.preventDefault)e.preventDefault();
  }
  if(typeof window!=='undefined'&&!window._thkWired){window._thkWired=1;
    document.addEventListener('pointerdown',function(e){
      if(mode==='edit')return;                                   // im Bearbeiten-Modus nie ziehen
      var t=e.target.closest?e.target.closest('.w .thk [data-role=sollgrip], .w .thk [data-role=sollbar]'):null;if(!t)return;
      var el=t.closest('.w');if(!el)return;
      var w=(typeof _wForEl==='function')?_wForEl(el):widget(el.dataset.id);   // Popup und Seite tragen dieselben IDs
      if(!w||w.type!=='thermostat'||!_thkOn(w)||!w.varId2||w.thDrag===false)return;
      var bar=t.closest('[data-role=sollbar]')||el.querySelector('[data-role=sollbar]');if(!bar)return;
      _thkDrag={w:w,el:el,bar:bar,last:0,val:null};_thkBlock={t:Date.now(),id:w.id};
      try{t.setPointerCapture(e.pointerId);}catch(_){}
      e.preventDefault();e.stopPropagation();                    // sonst greift zusaetzlich der Klickpfad
      _thkMove(e,true);                                          // Aufsetzpunkt zeigen, aber noch nicht schreiben
    },true);
    document.addEventListener('pointermove',function(e){if(_thkDrag)_thkMove(e);});
    var _thkEnd=function(){if(!_thkDrag)return;var d=_thkDrag;_thkDrag=null;_thkBlock={t:Date.now(),id:d.w.id};if(d.val!=null)setVar(d.w.varId2,d.val);}; // Endwert final schreiben
    document.addEventListener('pointerup',_thkEnd);
    document.addEventListener('pointercancel',_thkEnd);
  }

  // ---------------------------------------------------------------- Markup der Karte
  function _thkBody(w){
    var sc=_thkScale(w),u=_thkUnit(w);
    var cap=(w.thCapTxt==null?'ISTWERT':String(w.thCapTxt));
    var cal=(w.thCalOn&&w.thCalView)?'<button class="thk-cal" data-role="thcal" title="Zeitplan öffnen">'+iconSVG('calendar')+'</button>':'';
    var bad=w.thArmVar?'<span class="thk-shadow-badge" title="Heizung nicht scharf – der Sollwert erreicht das Gerät nicht">Schatten</span>':'';
    var pill=((w.thStatQ||'calc')!=='aus')?'<span class="thk-pill" data-role="hstate"></span>':'';
    var grip=(w.varId2)?'<i class="thk-grip" data-role="sollgrip" style="bottom:0%"></i>':'';
    var dev=(w.thDevOn!==false)?'<span class="thk-tsub" data-role="devsub">Soll</span>':'';
    var set=w.varId2?('<button class="thk-rb" data-role="dn" title="kälter"><svg><use href="#ic-minus"/></svg></button>'):'';
    var set2=w.varId2?('<button class="thk-rb" data-role="up" title="wärmer"><svg><use href="#ic-plus"/></svg></button>'):'';
    var prof=(w.thPresOn&&w.thPresVar)?('<div class="thk-prof" data-role="prof">'+_sldBody(_thkPres(w),w.thPresShape||'pill')+'</div>'):'';
    return '<div class="thk'+(prof?' thk-full':'')+' tone-idle">'
      +'<div class="thk-top"><span class="thk-name">'+escL(w.label||'')+'</span>'+bad+cal+'</div>'
      +'<div class="thk-body">'
        +'<div class="thk-l">'
          +'<div class="thk-ist"><b data-role="val">–</b><span class="thk-unit">'+esc(u)+'</span></div>'
          +(cap!==''?('<div class="thk-cap">'+esc(cap)+'</div>'):'')
          +pill
        +'</div>'
        +'<div class="thk-therm"><span class="thk-sc">'+esc(String(sc.max))+'</span>'
          +'<div class="thk-bar" data-role="sollbar"><i class="thk-fill" data-role="istfill"></i>'+grip+'</div>'
          +'<span class="thk-sc">'+esc(String(sc.min))+'</span></div>'
      +'</div>'
      +'<div class="thk-set">'+set+'<div class="thk-mid"><b class="thk-tval" data-role="target2">–</b>'+dev+'</div>'+set2+'</div>'
      +prof
      +'</div>';
  }
  // ---------------------------------------------------------------- Eigenschaften der Karte
  function _thkHint(t){return '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">'+t+'</div>';}
  function _thkProps(w){
    var sp=_thkSp(w),md=w.thMode||'heiz',q=w.thStatQ||'calc';
    var h='<div class="pgh">Kopf &amp; Kalender-Sprung</div>'
      +row('Kalender-Knopf','<label style="font-size:12px"><input type="checkbox" id="pThCalOn"'+(w.thCalOn?' checked':'')+'> oben rechts</label>')
      +row('Region','<input id="pThCalSlot" value="'+esc(w.thCalSlot||'')+'" placeholder="heizbody">')
      +row('Ansicht','<select id="pThCalView">'+viewOpts(w.thCalView||'','page')+'</select>')
      +row('Seite','<select id="pThCalNav">'+viewOpts(w.thCalNav||'','page','— nur Region umschalten')+'</select>')
      +row('Zeitplan-Zone','<input id="pThPlanRoom" type="number" value="'+(w.thPlanRoom||'')+'" placeholder="z. B. 56709">')
      +_thkHint('Instanz-ID der Heizzone, nicht die Variablen-ID. 0 oder leer = keine Vorwahl.')
      +(w.thPlanRoom?row('Sitzung','<input id="pThPlanSess" value="'+esc(w.thPlanSess||'heat')+'" placeholder="heat">'):'')
      +'<div class="pgh">Betriebsart &amp; Status</div>'
      +row('Betriebsart','<select id="pThMode">'
        +'<option value="heiz"'+(md==='heiz'?' selected':'')+'>Nur Heizen (Vorgabe)</option>'
        +'<option value="kuehl"'+(md==='kuehl'?' selected':'')+'>Nur Kühlen</option>'
        +'<option value="auto"'+(md==='auto'?' selected':'')+'>Aus Modus-Variable ableiten</option></select>')
      +(md==='auto'?_thkHint('Braucht ein Variablenprofil mit sprechenden Namen an der Modus-Variablen.'):'')
      +row('Heizt-Anzeige','<select id="pThStatQ">'
        +'<option value="calc"'+(q==='calc'?' selected':'')+'>Berechnet (Ist unter Soll)</option>'
        +'<option value="var"'+(q==='var'?' selected':'')+'>Aus Variable</option>'
        +'<option value="aus"'+(q==='aus'?' selected':'')+'>Aus</option></select>')
      +(q==='var'?(fieldPick(w,'thHeatVar','Ventil-/Statusvariable')
        +row('Schwelle','<input id="pThHeatThr" type="number" step="0.1" value="'+(w.thHeatThr!=null?w.thHeatThr:5)+'">')
        +_thkHint('Ventilstellung 0–100 %: 5. Statuszahl 0/1/2: 2. Boolean true zählt immer als heizt.')):'')
      +(q!=='aus'?(row('Text heizt','<input id="pThHeatTxt" value="'+esc(w.thHeatTxt!=null?w.thHeatTxt:'Heizt')+'">')
        +(md!=='heiz'?row('Text kühlt','<input id="pThCoolTxt" value="'+esc(w.thCoolTxt!=null?w.thCoolTxt:'Kühlt')+'">'):'')
        +row('Text bereit','<input id="pThIdleTxt" value="'+esc(w.thIdleTxt!=null?w.thIdleTxt:'Bereit')+'">')
        +(md==='heiz'?(row('Text zu warm','<input id="pThWarmTxt" value="'+esc(w.thWarmTxt!=null?w.thWarmTxt:'Zu warm')+'">')
          +_thkHint('Kühlen gibt es in dieser Anlage nicht - Ist über Soll wird deshalb neutral benannt.')):'')):'')
      +'<div class="pgh">Sollwert-Grenzen &amp; Steller</div>'
      +row('Soll min','<input id="pThSpMin" type="number" step="0.5" value="'+sp.min+'">')
      +row('Soll max','<input id="pThSpMax" type="number" step="0.5" value="'+sp.max+'">')
      +_thkHint('Nicht aus dem Profil ~Temperature übernehmen - dort steht -30 bis 70 in 5er-Schritten.')
      +row('Sollwert ziehbar','<label style="font-size:12px"><input type="checkbox" id="pThDrag"'+(w.thDrag!==false?' checked':'')+'> Griff am Thermometer</label>')
      +row('Abweichung','<label style="font-size:12px"><input type="checkbox" id="pThDevOn"'+(w.thDevOn!==false?' checked':'')+'> „Soll · −0,6 °" anzeigen</label>')
      +row('Einheit','<input id="pThUnit" value="'+esc(_thkUnit(w))+'" style="width:60px">')
      +row('Kleintext','<input id="pThCapTxt" value="'+esc(w.thCapTxt==null?'ISTWERT':w.thCapTxt)+'" placeholder="leer = keine Zeile">')
      +'<div class="pgh">Heizprofile</div>'
      +row('Heizprofile','<label style="font-size:12px"><input type="checkbox" id="pThPresOn"'+(w.thPresOn?' checked':'')+'> Profilzeile anzeigen</label>')
      +(w.thPresOn?(fieldPick(w,'thPresVar','Profil-Variable (Präsenz)')
        +_thkHint('Diese Variable hat kein Profil - die Beschriftungen kommen aus dem Feld darunter.')
        +row('Beschriftungen','<input id="pThPresLbl" value="'+esc(w.thPresLbl!=null?w.thPresLbl:'Normal,Erweitert,Abgesenkt')+'">')
        +row('Form','<select id="pThPresShape">'+[['pill','Pille'],['round','Abgerundet'],['square','Eckig']].map(function(o){return '<option value="'+o[0]+'"'+((w.thPresShape||'pill')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')):'')
      +'<div class="pgh">Schatten-Hinweis</div>'
      +fieldPick(w,'thArmVar','„Scharf"-Variable (optional)')
      +_thkHint('Ist die Domäne nicht scharf, erreichen Sollwerte das Gerät nicht.');
    return h;
  }
  function _thkWire(w){
    function txt(id,key,def){var e=$(id);if(e)e.oninput=function(){var v=this.value;w[key]=(v===''&&def!==undefined)?undefined:v;render();commit();};}
    function chk(id,key){var e=$(id);if(e)e.onchange=function(){w[key]=this.checked||undefined;render();renderProps();commit();};}
    function num(id,key){var e=$(id);if(e)e.oninput=function(){w[key]=this.value===''?undefined:parseFloat(this.value);render();commit();};}
    function sel(id,key){var e=$(id);if(e)e.onchange=function(){w[key]=this.value||undefined;render();renderProps();commit();};}
    chk('#pThCalOn','thCalOn');txt('#pThCalSlot','thCalSlot',1);sel('#pThCalView','thCalView');sel('#pThCalNav','thCalNav');
    num('#pThPlanRoom','thPlanRoom');txt('#pThPlanSess','thPlanSess',1);
    sel('#pThMode','thMode');sel('#pThStatQ','thStatQ');num('#pThHeatThr','thHeatThr');
    txt('#pThHeatTxt','thHeatTxt',1);txt('#pThCoolTxt','thCoolTxt',1);txt('#pThIdleTxt','thIdleTxt',1);txt('#pThWarmTxt','thWarmTxt',1);
    num('#pThSpMin','thSpMin');num('#pThSpMax','thSpMax');
    var dg=$('#pThDrag');if(dg)dg.onchange=function(){w.thDrag=this.checked?undefined:false;render();commit();};
    var dv=$('#pThDevOn');if(dv)dv.onchange=function(){w.thDevOn=this.checked?undefined:false;render();commit();};
    txt('#pThUnit','thUnit',1);
    var ct=$('#pThCapTxt');if(ct)ct.oninput=function(){w.thCapTxt=this.value;render();commit();};   // leerer Text ist eine Aussage (Zeile weg), kein "nicht gesetzt"
    chk('#pThPresOn','thPresOn');txt('#pThPresLbl','thPresLbl',1);sel('#pThPresShape','thPresShape');
  }

  defWidget('thermostat',{
    label:'Thermostat', cat:'Steuerung', paletteIcon:'thermostat', size:[240,196],
    defaults:function(w){w.min=14;w.max=28;w.step=0.5;w.label='Thermostat';},
    render:function(w){
      if(!_thkOn(w)){
      var tShowState=(w.showState!==false),tShowBar=(w.showBar!==false),tShowModes=(w.showModes!==false),tShowSet=(w.showSet!==false);
      return '<div class="htc tone-idle">'
        +'<div class="htc-top"><span class="htc-name">'+escL(w.label||'')+'</span>'+(tShowState?'<span class="htc-state" data-role="hstate"></span>':'')+'</div>'
        +'<div class="htc-main"><span class="htc-ist" data-role="val">–</span><span class="htc-sep">→</span><span class="htc-soll">Soll <b data-role="target">–</b></span></div>'
        +(tShowBar?'<div class="htc-bar"><i data-role="istfill"></i><i class="htc-sollmk" data-role="sollmk"></i></div>':'')
        +(tShowModes?'<div class="htc-modes" data-role="modes"></div>':'')
        +(tShowSet?'<div class="htc-set"><button data-role="dn"><svg><use href="#ic-minus"/></svg></button><b class="httval" data-role="target2">–</b><button data-role="up"><svg><use href="#ic-plus"/></svg></button></div>':'')
        +'</div>';}
      return _thkBody(w);},
    props:function(w){if(w.type!=='thermostat')return '';
      var h='<div class="pgh">Thermostat — Bauform</div>'
        +row('Bauform','<select id="pThStil"><option value=""'+(!_thkOn(w)?' selected':'')+'>Klassisch (Vorgabe)</option><option value="karte"'+(_thkOn(w)?' selected':'')+'>Raumkarte</option></select>');
      if(_thkOn(w))return h+_thkProps(w);
      return h+'<div class="pgh">Elemente (abschaltbar)</div>'
        +row('Heizstatus','<input type="checkbox" id="pShState"'+(w.showState!==false?' checked':'')+'>')
        +row('Ist/Soll-Balken','<input type="checkbox" id="pShBar"'+(w.showBar!==false?' checked':'')+'>')
        +row('Modus-Buttons','<input type="checkbox" id="pShModes"'+(w.showModes!==false?' checked':'')+'>')
        +row('+/− Steller','<input type="checkbox" id="pShSet"'+(w.showSet!==false?' checked':'')+'>');},
    wire:function(w){
      if($('#pThStil'))$('#pThStil').onchange=function(){w.thStil=this.value||undefined;render();renderProps();commit();};
      if($('#pShState'))$('#pShState').onchange=function(){w.showState=this.checked;render();commit();};
      if($('#pShBar'))$('#pShBar').onchange=function(){w.showBar=this.checked;render();commit();};
      if($('#pShModes'))$('#pShModes').onchange=function(){w.showModes=this.checked;render();commit();};
      if($('#pShSet'))$('#pShSet').onchange=function(){w.showSet=this.checked;render();commit();};
      if(_thkOn(w))_thkWire(w);
    },
    // Karte aus dem Zwischenspeicher fuellen (Seite, Popup und Hover-Flyout tragen dieselbe ID).
    mount:function(w){if(!_thkOn(w))return;
      // Nur Buehne und Overlay durchsuchen: Seite, Popup und Hover-Flyout vergeben dieselben
      // Widget-IDs, eine dokumentweite Suche faende die Karte einer FREMDEN Ansicht.
      [canvas,document.getElementById('ovcanvas')].forEach(function(host){
        if(!host)return;
        var l=host.querySelectorAll('.w[data-id="'+w.id+'"]');
        for(var i=0;i<l.length;i++)_thkPaint(w,l[i]);
      });},
    click:function(w,el,e){
      if(!_thkOn(w))return false;                                  // Klassiker laeuft weiter ueber _wClick
      if(_thkBlock.id===w.id&&Date.now()-_thkBlock.t<400)return true;   // nachlaufender Klick nach dem Ziehen dieser Karte
      var cl=function(s){return e.target.closest?e.target.closest(s):null;};
      // 1) Kalender: regSlot/regView duerfen NICHT am Widget stehen - der Block in
      //    05-interaction.js laeuft vor dem Thermostat-Zweig und wuerde jeden Klick auf die
      //    Karte zum Seitensprung machen, +/- und Profile waeren tot. Darum eigene Felder.
      if(cl('[data-role=thcal]')){
        if(w.thPlanRoom&&typeof hfSess==='function'){
          try{
            var pw={id:w.id,session:(w.thPlanSess||'heat'),hsMode:true,domain:'heating'};
            var s=hfSess(pw);s.hsMode=true;s.domain='heating';s.seeded='owner';s.slot=1;   // 'owner' verhindert, dass die Zielseite auf ihren Startraum zurueckzieht
            if(!s.loaded)s.roomIdx=w.thPlanRoom;                                            // Kaltstart: hfEnsure laedt den Raum selbst
            else hfLoadRoom(pw,w.thPlanRoom,function(){hfEmit(pw);});
          }catch(_e){}
        }
        // Mit Seitenziel still setzen (navGo zeichnet ohnehin), OHNE Seitenziel zeichnen -
        // sonst bliebe die Region umgeschaltet, ohne dass man es sieht.
        var nav=(w.thCalNav&&store.views[w.thCalNav])?w.thCalNav:'';
        if(w.thCalSlot&&w.thCalView)setRegion(w.thCalSlot,w.thCalView,!!nav);
        if(nav)navGo(nav);
        return true;
      }
      // 2) Heizprofil: die Praesenz-Variable ist actionable, ?api=setvar loest RequestAction aus.
      var seg=cl('[data-role=prof] .swmseg');
      if(seg){if(w.thPresVar){var sv=seg.getAttribute('data-swval');setVar(w.thPresVar,sv);_sldMark(el,_thkPres(w),sv);}return true;}
      // 3) Steller: geklemmt auf die Modulgrenzen und mit den Nachkommastellen der Schrittweite.
      if(w.varId2){
        var up=cl('[data-role=up]'),dn=cl('[data-role=dn]');
        if(up||dn){
          var sp=_thkSp(w),t=_thkNum(w.varId2);if(isNaN(t))t=20;
          var v=t+(up?sp.step:-sp.step);
          v=Math.round(v/sp.step)*sp.step;
          v=Math.max(sp.min,Math.min(sp.max,v));
          v=parseFloat(v.toFixed(_thkDec(sp.step)));
          _thkSoll(w,el,v);                                        // Optik sofort, danach schreiben
          setVar(w.varId2,v);
          return true;
        }
      }
      return false;                                                // alles andere: navTo/popupTo/hoverTo bleiben zustaendig
    },
    live:function(w,el,id,d,base,txt,on){
      if(_thkOn(w)){
        if(_thkDrag&&_thkDrag.el===el)return;                      // waehrend des Ziehens nichts ueberschreiben
        // varId3 gehoert dazu: bei thMode='auto' entscheidet die Modusvariable ueber den Ton.
        if(id===w.varId||id===w.varId2||id===w.varId3||id===w.thPresVar||id===w.thHeatVar||id===w.thArmVar)_thkPaint(w,el);
        return;
      }
      if(w.varId===id||w.varId2===id||w.varId3===id)updateTherm(w,rootOfEl(el));
    }
  });
