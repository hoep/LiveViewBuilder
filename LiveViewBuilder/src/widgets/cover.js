  // ===== Widget: Cover — Rollo: Fenster-Slider + Steuerung + Sonne =====
  //
  //  Linkes Fenster = zugleich Anzeige UND vertikaler Positions-Slider (ziehen). Lamellen
  //  fuellen von oben bis zur Position, darunter Glas mit Himmel-Verlauf und (optional) der
  //  Sonne aus der Sonnenstandsberechnung. Rechts: Name + Status + Modus-Icon, Zu/Halb/Auf-
  //  Presets, Auf/Stop/Zu, optional ein zweiter horizontaler Slider mit Skala.
  //
  //  Variablen (im Editor benannt + im Baum zuweisbar):
  //   varId        = Position (Oeffnungs-/Schliessgrad in %) — Fenster/Slider schreiben sie.
  //   varId2       = Kommando (optional): Auf/Halb/Stop/Zu-Befehlswerte (IPSShadowing 14/13/11).
  //   varId3       = Modus/Status (optional): Auto/Sonne/Manuell bzw. Statustext.
  //   covBrightVid = Helligkeit (Lux, optional) — Sonne nur wenn hell.
  //
  //  cvInv: Anlagen wie IPSShadowing zaehlen den SCHLIESSGRAD (0=offen, 100=zu). Die Kachel
  //  zeigt IMMER den Oeffnungsgrad; geschrieben wird der korrekte Rohwert je nach Inversion
  //  (Auf/Zu setzen also nicht hart 100/0, sondern den richtigen Wert des Geraets).

  var COV_MODE_OPTS=[[0,'Auto'],[2,'Sonne'],[1,'Manuell']];
  function _cvCmd(w,k){var v=w['cv'+k];return (v===undefined||v===null||v==='')?null:v;}
  function _covCol(v){return v?((typeof _skinColor==='function'&&_skinColor(v))||v):'';}
  function _covOn(w,k,def){return (w[k]!==undefined)?!!w[k]:def;} // Schalter mit Default

  // NOAA-Sonnenstand (identisch zu suncompass, gegen IPS Location verifiziert)
  function _covSunPos(lat,lon,unixSec){
    var rad=Math.PI/180, deg=180/Math.PI;
    var JD=unixSec/86400+2440587.5, T=(JD-2451545)/36525;
    var L0=((280.46646+T*(36000.76983+T*0.0003032))%360+360)%360;
    var M=357.52911+T*(35999.05029-0.0001537*T), e=0.016708634-T*(0.000042037+0.0000001267*T), Mr=M*rad;
    var C=(1.914602-T*(0.004817+0.000014*T))*Math.sin(Mr)+(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr);
    var tl=L0+C, om=125.04-1934.136*T, al=tl-0.00569-0.00478*Math.sin(om*rad);
    var eps0=23+(26+((21.448-T*(46.815+T*(0.00059-T*0.001813))))/60)/60, eps=eps0+0.00256*Math.cos(om*rad);
    var decl=Math.asin(Math.sin(eps*rad)*Math.sin(al*rad))*deg;
    var y=Math.pow(Math.tan(eps/2*rad),2), L0r=L0*rad;
    var Eq=4*deg*(y*Math.sin(2*L0r)-2*e*Math.sin(Mr)+4*e*y*Math.sin(Mr)*Math.cos(2*L0r)-0.5*y*y*Math.sin(4*L0r)-1.25*e*e*Math.sin(2*Mr));
    var minUTC=(((unixSec%86400)+86400)%86400)/60;
    var tst=(((minUTC+Eq+4*lon)%1440)+1440)%1440, ha=tst/4-180; if(ha<-180)ha+=360;
    var latr=lat*rad, decr=decl*rad, har=ha*rad;
    var zen=Math.acos(Math.min(1,Math.max(-1,Math.sin(latr)*Math.sin(decr)+Math.cos(latr)*Math.cos(decr)*Math.cos(har))))*deg;
    var el=90-zen, elr=el*rad, refr=0;
    if(el>5&&el<=85)refr=(58.1/Math.tan(elr)-0.07/Math.pow(Math.tan(elr),3)+0.000086/Math.pow(Math.tan(elr),5))/3600;
    else if(el>-0.575&&el<=5)refr=(1735+el*(-518.2+el*(103.4+el*(-12.79+el*0.711))))/3600;
    else if(el<=-0.575)refr=(-20.772/Math.tan(elr))/3600;
    el+=refr;
    var azt=Math.acos(Math.min(1,Math.max(-1,((Math.sin(latr)*Math.cos(zen*rad))-Math.sin(decr))/(Math.cos(latr)*Math.sin(zen*rad)))))*deg;
    var az=ha>0?(azt+180)%360:(540-azt)%360;
    return {az:az,elev:el};
  }
  // Standort: Widget-Koordinaten oder Haus-Vorgabe (Location #13098 verifiziert)
  function _covGeo(w){return {lat:(w.covLat!=null&&w.covLat!=='')?+w.covLat:48.0657, lon:(w.covLon!=null&&w.covLon!=='')?+w.covLon:14.1241};}

  // Rohwert <-> Oeffnungsgrad. openPct = was die Kachel zeigt (100 = ganz offen).
  function _covOpen(w,raw){var n=parseFloat(raw);if(isNaN(n))n=0;return w.cvInv?(100-n):n;}
  function _covRawFor(w,open){open=Math.max(0,Math.min(100,open));return w.cvInv?(100-open):open;}

  // Fenster-/Sonnen-Visualisierung in ein Element schreiben (aus openPct)
  function _covPaint(w,el,open){
    open=Math.max(0,Math.min(100,Math.round(open)));
    var win=$('[data-role=win]',el);
    if(win){win.classList.toggle('open',open>8);
      var mk=_covIsMk(w), shown=mk?_covMkOut(open):open;
      var sh=$('.hc2shut',win);if(sh)sh.style.height=(100-open)+'%';
      var fb=$('.hc2mkfab',win);if(fb)fb.style.height=(_covMkOut(open)*0.66)+'%';   // Tuch waechst mit dem Ausfahrgrad
      var pc=$('.hc2pct',win);if(pc)pc.innerHTML=shown+'<span>%</span>';
      _covSun(w,win,open);
      _covWx(w,win,open);
    }
    // Slider (Fenster-Overlay + optionaler unterer) nachziehen, wenn nicht in Bearbeitung
    $$('[data-role=range]',el).forEach(function(r){if(document.activeElement!==r)r.value=open;});
    var sl2=$('.hc2sl2',el);if(sl2&&document.activeElement!==sl2)sl2.style.background='linear-gradient(90deg,var(--accent) 0 '+open+'%,var(--surface-2) '+open+'% 100%)';
    var pre=$('[data-role=cpre]',el);if(pre)pre.querySelectorAll('[data-cpre]').forEach(function(b){var pv=parseInt(b.getAttribute('data-cpre'),10);
      b.classList.toggle('on',(pv===100&&open>=95)||(pv===50&&open>5&&open<95));
      b.classList.toggle('onc',pv===0&&open<=5);});
  }
  // ===== Geraeteart: Rollo (Standard) oder Markise =====
  // Eine Markise wird umgekehrt gedacht: sie faehrt AUS statt ZU. Intern bleibt alles
  // gleich (open% = Oeffnungsgrad); fuer die Anzeige rechnen wir den AUSFAHRGRAD
  // (100-open) und tauschen Grafik + Beschriftungen.
  function _covIsMk(w){ return (w&&w.cvKind==='markise'); }
  function _covMkOut(open){ return Math.max(0,Math.min(100,100-open)); }   // Ausfahrgrad
  function _covLbl(w,k){
    var mk=_covIsMk(w);
    return ({open:mk?'Ein':'Auf', close:mk?'Aus':'Zu', half:'Halb',
             sOpen:mk?'eingefahren':'offen', sClose:mk?'ganz ausgefahren':'geschlossen'})[k];
  }
  function _covStateTxt(w,open){
    if(_covIsMk(w)){var o=_covMkOut(open);return o<=2?'eingefahren':(o>=98?'ganz ausgefahren':(o+' % ausgefahren'));}
    return open<=2?'geschlossen':(open>=98?'offen':(open+' % offen'));
  }
  // Live-Wert einer gebundenen Variable als Zahl (oder null, wenn nicht gebunden/leer).
  function _covNum(vid){ if(!vid)return null; var e=_lastVals[vid]; if(!e)return null;
    var n=parseFloat(e.v); return isNaN(n)?null:n; }
  // Wetter-Instanz in Bindungen aufloesen.
  //
  // Die IDs werden EINMAL hier ermittelt und als gewoehnliche Eigenschaften am Widget abgelegt.
  // Zur Laufzeit aufzuloesen waere falsch: die Live-Abfrage sammelt ihre IDs aus den
  // Widget-Eigenschaften, eine erst spaeter ermittelte ID wuerde nie abgefragt — die Kachel
  // bliebe stumm, obwohl alles "zugewiesen" aussieht.
  function _covWxBind(w){
    var st=$('#pCovWxSt'), keys=['wxFog','wxPrecip','wxRainRate','wxStorm','wxStormDist','wxSnow'];
    if(!w.wxInst){keys.forEach(function(k){delete w[k];});
      if(st)st.textContent='noch nicht zugewiesen';commit();return;}
    if(st)st.textContent='wird gelesen …';
    fetch(API+'&api=wxvars&inst='+w.wxInst).then(function(r){return r.json();}).then(function(d){
      if(!d||!d.vars){if(st)st.textContent='keine Variablen gefunden';return;}
      var m={wxFog:'FogPct',wxPrecip:'PrecipType',wxRainRate:'RainRate',
             wxStorm:'StormLevel',wxStormDist:'StormDist',wxSnow:'SnowCover'}, n=0;
      for(var k in m){ if(d.vars[m[k]]){w[k]=d.vars[m[k]].id;n++;} else delete w[k]; }
      if(st)st.textContent=n?(n+' Werte von "'+(d.name||'')+'"'):'passt nicht — ist das eine Wetter-Instanz?';
      commit();render();
    }).catch(function(){if(st)st.textContent='nicht erreichbar';});
  }

  // Wetterlage im freien Glasausschnitt.
  //
  // Gezeichnet wird nur UNTERHALB der Lamellen: die Schicht beginnt dort, wo das Rollo endet.
  // Ist es zu, bleibt sie leer — man sieht durch ein geschlossenes Rollo nun einmal nichts.
  //
  // Vorrang Gewitter > Schnee > Regen > Nebel. Schnee gegen Regen entscheidet die
  // NIEDERSCHLAGSART des Wettermoduls (aus der Feuchtkugel), nicht die Lufttemperatur —
  // bei drei Grad und trockener Luft faellt Schnee, waehrend das Thermometer ueber null steht.
  function _covWx(w,el,openPct){
    var lay=el&&el.querySelector('[data-role=wx]'); if(!lay)return;
    if(!_covOn(w,'covWx',false)){lay.style.display='none';return;}
    var _n=function(id){var d=id&&_lastVals[id];if(!d)return null;
      var v=parseFloat(String(d.v).replace(',','.'));return isNaN(v)?null:v;};
    var storm=_n(w.wxStorm)||0, art=_n(w.wxPrecip)||0, rate=_n(w.wxRainRate)||0,
        fog=_n(w.wxFog)||0, snow=_n(w.wxSnow);
    // Freier Ausschnitt: von der Rollounterkante bis zum Fensterboden.
    var offen=Math.max(0,Math.min(100,openPct==null?0:openPct));
    if(offen<4){lay.style.display='none';return;}       // praktisch zu: nichts zeigen
    lay.style.display=''; lay.style.top=(100-offen)+'%';

    var modus=null;
    if(storm>=2) modus='storm';
    else if(art>=2||snow===true||snow===1) modus='snow';
    else if(rate>0.01||art===1) modus='rain';
    else if(fog>=35) modus='fog';                        // Nebeldichte in Prozent
    if(!modus){lay.className='hc2wx';lay.innerHTML='';lay.dataset.wx='';return;}

    // Bewegung: 0 ohne, 1 ruhig, 2 normal, 3 lebendig. Die Anzahl der Teilchen haengt an der
    // Staerke, die Geschwindigkeit an der Einstellung — nicht umgekehrt: ein Nieselregen soll
    // duenn aussehen, nicht langsam.
    var stufe=(w.covWxAnim==null?1:+w.covWxAnim);
    var tempo=[0,1.9,1.3,0.85][Math.max(0,Math.min(3,stufe))]||1.3;
    var dicht=modus==='rain'?Math.max(4,Math.min(16,Math.round(4+rate*2.2)))
             :modus==='snow'?9:0;
    var sig=modus+'|'+dicht+'|'+stufe;
    if(lay.dataset.wx===sig)return;                      // nicht bei jedem Tick neu bauen
    lay.dataset.wx=sig;
    lay.className='hc2wx wx-'+modus+(stufe===0?' wx-still':'');
    lay.style.setProperty('--wxspd',tempo.toFixed(2)+'s');

    var h='';
    if(modus==='rain'||modus==='storm'){
      var n=modus==='storm'?Math.max(3,Math.round(dicht*0.6)):dicht;
      for(var i=0;i<n;i++)
        h+='<i style="left:'+(4+Math.random()*92).toFixed(0)+'%;top:'+(Math.random()*90).toFixed(0)
          +'%;animation-delay:'+(Math.random()*1.4).toFixed(2)+'s"></i>';
      if(modus==='storm')
        h+='<svg class="wxbolt" viewBox="0 0 16 30"><path d="M9 1 3 16h5l-2 13 8-17H9l2-11z" fill="#ffd23f"/></svg>';
    } else if(modus==='snow'){
      for(var j=0;j<dicht;j++)
        h+='<i style="left:'+(5+Math.random()*90).toFixed(0)+'%;top:'+(Math.random()*90).toFixed(0)
          +'%;animation-delay:'+(Math.random()*3).toFixed(2)+'s"></i>';
    } else if(modus==='fog'){
      // Deckkraft nach Nebeldichte: bei 35 % kaum zu sehen, bei 100 % milchig.
      lay.style.opacity=Math.max(.18,Math.min(.62,fog/160)).toFixed(2);
      for(var k=0;k<4;k++)
        h+='<b style="top:'+(14+k*24)+'%;animation-delay:'+(k*0.8).toFixed(1)+'s"></b>';
    }
    if(modus!=='fog')lay.style.opacity='';
    lay.innerHTML=h;
  }

  // Sonne am ECHTEN Sonnenstand platzieren — Blick des Betrachters durchs Fenster nach draussen.
  // Die Sonne steht FEST an ihrer Himmelsposition (Hoehe = oben/unten, Azimut = links/rechts);
  // das herabfahrende Rollo VERDECKT sie (Stapelreihenfolge im CSS: Rollo ueber der Sonne).
  // Frueher war die Sonne auf den sichtbaren Glasbereich geklemmt -> sie ist mit dem Rollo
  // mitgewandert statt dahinter zu verschwinden.
  function _covSun(w,win,open){
    var sun=$('.hc2sun',win);if(!sun)return;
    if(!_covOn(w,'covSun',true)){sun.style.display='none';return;}
    var g=_covGeo(w), p=_covSunPos(g.lat,g.lon,Date.now()/1000);
    var elMin=(w.covElMin!=null&&w.covElMin!=='')?+w.covElMin:2;
    var brOk=true; if(w.covBrightVid&&_lastVals[w.covBrightVid]){var bv=parseFloat(_lastVals[w.covBrightVid].v);var bMin=(w.covBrightMin!=null&&w.covBrightMin!=='')?+w.covBrightMin:0;if(!isNaN(bv))brOk=bv>=bMin;}
    // --- Sonnenfenster DIESES Rollos (aus dem HomeSuite-Sonnenprofil, je Instanz) ---
    // azBgn..azEnd beschreibt, aus welcher Richtung dieses Fenster ueberhaupt Sonne
    // bekommt (mit 360°-Umschlag, z. B. Nord = 300..60). Steht die Sonne ausserhalb,
    // kann sie das Fenster physisch nicht treffen -> gar nicht darstellen. Vorher wurde
    // der Azimut hart auf +-1 geklemmt, dadurch klebte die Sonne selbst bei Nord-/Ost-
    // fenstern am Rand, obwohl dort nie Sonne hinkommt.
    var azB=_covNum(w.cvAzB), azE=_covNum(w.cvAzE), elP=_covNum(w.cvElv);
    if(elP!=null)elMin=Math.max(elMin,elP);                       // Schwelle aus dem Profil
    if(p.elev<elMin||!brOk){sun.style.display='none';return;}      // Nacht / zu tief / zu dunkel
    var hl;
    // Ist ein Sonnenfenster GEBUNDEN, aber der Wert noch nicht eingetroffen (Poll liefert
    // unveraenderte Werte nur beim ersten Durchlauf), NICHT auf die Pauschal-Ausrichtung
    // zurueckfallen - sonst zeigt z. B. ein Nordfenster faelschlich Sonne. Lieber nichts
    // zeigen, bis die echten Werte da sind (_covKick zeichnet zyklisch nach).
    if((w.cvAzB||w.cvAzE)&&(azB==null||azE==null)){sun.style.display='none';return;}
    if(azB!=null&&azE!=null){
      var width=((azE-azB)+360)%360; if(width<=0)width=360;
      var rel=((p.az-azB)+360)%360;
      if(rel>width){sun.style.display='none';return;}              // Sonne hinter der Fassade
      hl=10+(rel/width)*80;                                        // Fensterdurchlauf: links -> rechts
    } else if(w.covFace!=null&&w.covFace!==''){
      // Ohne gebundenes Sonnenfenster: Ausrichtung aus den Widget-Einstellungen, +-90° Sichtfeld.
      var face=+w.covFace, dl=((p.az-face+540)%360)-180;
      if(Math.abs(dl)>=90){sun.style.display='none';return;}
      hl=50+(dl/90)*34;
    } else {
      // WEDER Sonnenfenster GEBUNDEN NOCH Ausrichtung gesetzt -> gar nichts zeigen.
      // Hier stand frueher die stille Vorgabe 180 (Sued). Eine unkonfigurierte Kachel
      // behauptete damit eine Himmelsrichtung, die niemand angegeben hatte: Buero und
      // Kueche (Nordfenster) zeigten mittags Sonne, weil 133° im Sued-Sichtfeld liegen.
      // Eine erfundene Richtung ist schlimmer als eine leere Anzeige - wer die Sonne im
      // Fenster sehen will, bindet das Sonnenfenster der Zone oder setzt die Ausrichtung.
      sun.style.display='none';return;
    }
    // vertikal: Sonnenhoehe 0..elMax -> Horizont(unten) .. Zenit(oben). Nur auf den
    // Fensterrahmen begrenzen (Rand-Marge), NICHT auf den freien Glasausschnitt.
    var elMax=(w.covElMax>0?+w.covElMax:60);
    var vt=100-Math.max(0,Math.min(1,p.elev/elMax))*100;
    vt=Math.max(7,Math.min(93,vt));
    sun.style.display='';sun.style.top=vt+'%';sun.style.left=hl+'%';
    sun.style.opacity=String(0.55+Math.min(0.45,p.elev/elMax*0.6));
  }

  function _covStyleVars(w){
    var s=[];function pv(n,v){if(v)s.push(n+':'+v);}
    pv('--cov-name',_covCol(w.covName)); pv('--cov-val',_covCol(w.covVal)); pv('--cov-state',_covCol(w.covState));
    if(w.covAccent){pv('--accent',_covCol(w.covAccent));}
    // Schriftgroessen (px) — leer = Default aus dem em-System
    [['covNameFs','--cov-namefs'],['covStatusFs','--cov-statusfs'],['covValFs','--cov-pctfs'],
     ['covPreFs','--cov-prefs'],['covBtnFs','--cov-btnfs'],['covTickFs','--cov-tickfs'],['covScFs','--cov-scfs']].forEach(function(o){
      if(w[o[0]])s.push(o[1]+':'+(parseFloat(w[o[0]])||12)+'px');});
    return s.length?' style="'+s.join(';')+'"':'';
  }
  function _covModeIcon(w,mode,night){
    if(night)return 'moon';
    if(mode===1)return 'hand';           // Manuell
    if(mode===2)return 'sun';            // Sonne (aktiv -> .act ueber CSS)
    return 'clock';                      // Auto (Zeitplan) = Uhr, NICHT die Sonne
  }

  /**
   * Sperrgrund auf die Fensterflaeche abbilden. Ein blockiertes Rollo sah bisher aus wie ein
   * ruhendes - man wartete auf eine Fahrt, die nie kommt. Jetzt umrandet die Visualisierung:
   *   ROT (--crit)  ein Kontakt verhindert die Fahrt (Tuer/Fenster offen, Sturm, Regen)
   *   GELB (--warn) von Hand uebersteuert - die Automatik haelt sich absichtlich zurueck
   * Leerer Grund = keine Umrandung. Farben ausschliesslich aus dem Skin.
   */
  function _covBlock(w,el,val){
    var win=el&&el.querySelector('.hc2win'); if(!win) return;
    var t=String(val==null?'':val);
    win.classList.remove('blk-crit','blk-warn');
    win.removeAttribute('title');
    if(!t.trim()) return;
    var manuell=/hand|manuell/i.test(t);
    win.classList.add(manuell?'blk-warn':'blk-crit');
    win.title=t;
  }

  defWidget('cover',{
    label:'Rollo', cat:'Steuerung', paletteIcon:'blinds', size:[300,128], noHover:true,
    render:function(w){
      var viz=_covOn(w,'covViz',true), slider=_covOn(w,'covSlider',false);
      var icU=w.icUp||'chevup', icS=w.icStop||'stop', icD=w.icDn||'chevdn';
      var _mk=_covIsMk(w);
      var win = viz ? ('<div class="hc2win" data-role="win">'
          +'<div class="hc2sky"></div>'+(_mk?'':'<div class="hc2roll"></div>')
          +(_covOn(w,'covSun',true)?'<div class="hc2sun"></div>':'')
          +(_covOn(w,'covWx',false)?'<div class="hc2wx" data-role="wx"></div>':'')
          +(_mk?('<div class="hc2mkcase"></div><div class="hc2mkfab" style="height:0"><i></i><b></b><u></u></div>')
               :'<div class="hc2shut" style="height:100%"></div>')
          +'<div class="hc2tick">50</div>'
          +'<div class="hc2pct">–<span></span></div>'
          +'<input class="hc2winr" type="range" data-role="range" min="0" max="100" step="1" value="0" title="Rollo ziehen">'
          +'</div>') : '';
      var pre='<div class="hc2pre" data-role="cpre">'
          +'<button data-cpre="0">'+_covLbl(w,'close')+'</button><button data-cpre="50">'+_covLbl(w,'half')+'</button><button data-cpre="100">'+_covLbl(w,'open')+'</button></div>';
      var btns='<div class="hc2btns">'
          +'<button data-role="cup" title="'+_covLbl(w,'open')+'"><svg><use href="#ic-'+esc(icU)+'"/></svg><span class="lb">'+_covLbl(w,'open')+'</span></button>'
          +'<button data-role="cstop" title="Stop"><svg><use href="#ic-'+esc(icS)+'"/></svg><span class="lb">Stop</span></button>'
          +'<button data-role="cdn" title="'+_covLbl(w,'close')+'"><svg><use href="#ic-'+esc(icD)+'"/></svg><span class="lb">'+_covLbl(w,'close')+'</span></button></div>';
      var sld = slider ? ('<div class="hc2sldwrap"><input class="hc2sl2" type="range" data-role="range" min="0" max="100" step="1" value="0">'
          +'<div class="hc2sc"><span class="t" style="left:0%"></span><span class="t" style="left:25%"></span><span class="t" style="left:50%"></span><span class="t" style="left:75%"></span><span class="t" style="left:100%"></span>'
          +'<span class="l a">0%</span><span class="l" style="left:50%">50%</span><span class="l b">100%</span></div></div>') : '';
      var ctl='<div class="hc2ctl"><div class="hc2top"><span class="hc2name">'+escL(w.label||'')+'</span>'
          +'<span class="hc2mode'+(w.varId3?' hc2mode-btn':'')+'" data-role="mode"'+(w.varId3?' title="Auto ↔ Manuell umschalten"':'')+'><svg><use href="#ic-clock"/></svg></span></div>'
          +'<div class="hc2status" data-role="cstate"><span class="dot"></span><span data-role="ctext">–</span></div>'
          +pre+btns+sld+'</div>';
      return '<div class="hc2"'+_covStyleVars(w)+'><div class="hc2in">'+win+ctl+'</div></div>';
    },
    mount:function(w){ _covKick(w); },
    // Position schreiben, wenn ein Slider (Fenster-Overlay ODER unterer) gezogen wird.
    input:function(w,el,e){
      var r=e.target.closest('[data-role=range]');if(!r)return false;
      var open=parseFloat(r.value);if(isNaN(open))open=0;
      _covPaint(w,el,open);                       // sofort spiegeln (beide Slider + Fenster)
      if(w.varId)setVar(w.varId,_covRawFor(w,open));
      return true;
    },
    click:function(w,el,e){
      if(w.navTo||w.popupTo||w.navBack)return false;
      // Modus-Icon (Sonne/Hand) = Auto<->Manuell umschalten (nur wenn Mode-Variable gebunden)
      var md=e.target.closest('[data-role=mode]');
      if(md&&w.varId3){var cur=(el._covMode!=null?el._covMode:0),nx=(cur===1?0:1); // Manuell->Auto, sonst ->Manuell
        setVar(w.varId3,nx);el._covMode=nx;
        var u=md.querySelector('use');if(u)u.setAttribute('href','#ic-'+_covModeIcon(w,nx));md.classList.toggle('act',nx===2);
        return true;}
      // Presets Zu/Halb/Auf -> Kommando ODER Position (inversionssicher)
      var pb=e.target.closest('[data-cpre]');
      if(pb){var op=parseInt(pb.getAttribute('data-cpre'),10);
        var cmdKey=op>=100?'Up':(op<=0?'Dn':'Half');
        if(w.varId2&&_cvCmd(w,cmdKey)!==null){setVar(w.varId2,_cvCmd(w,cmdKey));}
        else if(w.varId)setVar(w.varId,_covRawFor(w,op));
        return true;}
      var up=e.target.closest('[data-role=cup]'),st=e.target.closest('[data-role=cstop]'),dn=e.target.closest('[data-role=cdn]');
      if(!up&&!st&&!dn)return false;
      if(st){if(w.varId2)setVar(w.varId2,_cvCmd(w,'Stop')!==null?_cvCmd(w,'Stop'):1);return true;}
      var k=up?'Up':'Dn';
      if(w.varId2&&_cvCmd(w,k)!==null){setVar(w.varId2,_cvCmd(w,k));return true;}
      if(w.varId)setVar(w.varId,_covRawFor(w,up?100:0));
      return true;
    },
    live:function(w,el,id,d,base,txt,on){
      // Modus-Variable: NUR Icon + Sonnen-Markierung (nicht den Statustext — der kommt aus der Position)
      if(w.varId3&&id===w.varId3){
        var mv=parseInt(d.v,10);
        el._covMode=mv;                              // aktuellen Modus merken (fuer Klick-Toggle)
        var stEl=$('[data-role=cstate]',el);if(stEl)stEl.classList.toggle('sun',mv===2);
        var mi=$('[data-role=mode]',el);if(mi){mi.classList.toggle('act',mv===2);var u=mi.querySelector('use');if(u)u.setAttribute('href','#ic-'+_covModeIcon(w,mv));}
        // wenn ein echter Statustext (nicht-numerisch) geliefert wird, diesen bevorzugt zeigen
        var mtxt=(txt!=null&&txt!==''&&!/^-?\d+([.,]\d+)?$/.test(String(txt).trim()))?txt:null;
        if(mtxt){var cs2=$('[data-role=ctext]',el);if(cs2){cs2.textContent=mtxt;el._covMtxt=mtxt;}}
        return;}
      // Sperrgrund (BlockReason der Zone) -> Fensterflaeche umranden. NUR die Visualisierung,
      // nicht die ganze Kachel: die Sperre betrifft die FAHRT, und die findet im Fenster statt.
      if(w.cvBlockVid&&id===w.cvBlockVid){ _covBlock(w,el,d&&d.v); return; }
      // Helligkeit ODER Sonnenfenster-Werte (Azimut-Grenzen/Hoehenschwelle) -> nur Sonne neu setzen
      if((w.covBrightVid&&id===w.covBrightVid)||id===w.cvAzB||id===w.cvAzE||id===w.cvElv){
        var win=$('[data-role=win]',el);if(win){var pc=$('.hc2pct',win);var op0=pc?parseInt(pc.textContent)||0:0;_covSun(w,win,op0);_covWx(w,win,op0);}return;}
      // Anzeige folgt der IST-Position (cvActId), Befehle gehen auf das schaltbare
      // Soll-Control (varId). Ohne cvActId bleibt es beim alten Verhalten (varId=Anzeige).
      // Sonst wuerde die Kachel den kommandierten Wert zeigen statt der echten Lage
      // (Somfy rampt zeitbasiert und meldet den Fortschritt ueber ActualPosition).
      if(w.cvActId){ if(id!==w.cvActId)return; }
      else if(id!==w.varId)return;
      var op=_covOpen(w,d.v);
      _covPaint(w,el,op);
      // Statuszeile aus der Position (offen / geschlossen / X % offen) — sofern kein echter Statustext gesetzt ist
      var cs=$('[data-role=ctext]',el),st2=$('[data-role=cstate]',el);
      if(cs&&!el._covMtxt)cs.textContent=_covStateTxt(w,op);
      if(st2)st2.classList.toggle('closed',op<=2);
    },
    props:function(w){
      return '<div style="font-size:11px;color:var(--muted);margin:2px 2px 7px">Oben <b>Variable</b> = <b>Position</b> (Rollo, %). Weiter unten: <b>Kommando</b> (Auf/Halb/Stop/Zu) und <b>Modus/Status</b>. Anlagen wie IPSShadowing zählen den Schließgrad → „Anzeige gespiegelt" anhaken.</div>'
        +'<div class="pgh">Darstellung</div>'
        +row('Fenster-Visualisierung','<input type="checkbox" id="pCovViz"'+(_covOn(w,'covViz',true)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Rollo/Glas links (Rollo = Slider)</span>')
        +row('Sonne anzeigen','<input type="checkbox" id="pCovSun"'+(_covOn(w,'covSun',true)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">nur bei Tag &amp; offenem Rollo</span>')
        +row('Wetter anzeigen','<input type="checkbox" id="pCovWx"'+(_covOn(w,'covWx',false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Regen, Schnee, Nebel, Gewitter — nur im offenen Teil</span>')
        +row('Wetter-Instanz','<input id="pCovWxI" type="number" style="width:96px" value="'+(w.wxInst||'')+'"> <button class="btn" id="pCovWxB" style="padding:4px 8px;font-size:11px">lesen</button> <span id="pCovWxSt" style="font-size:11px;color:var(--muted)">'+(w.wxStorm?'zugewiesen':'noch nicht zugewiesen')+'</span>')
        +row('Bewegung','<select id="pCovWxA">'+[[0,'ohne'],[1,'ruhig'],[2,'normal'],[3,'lebendig']].map(function(o){
             return '<option value="'+o[0]+'"'+(((w.covWxAnim==null?1:+w.covWxAnim)===o[0])?' selected':'')+'>'+o[1]+'</option>';}).join('')
             +'</select> <span style="font-size:11px;color:var(--muted)">viele Kacheln nebeneinander: lieber ruhig</span>')
        +row('Slider unter Tasten','<input type="checkbox" id="pCovSlider"'+(_covOn(w,'covSlider',false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">zusätzlicher horizontaler Slider mit Skala</span>')
        +row('Art','<select id="pCvKind"><option value=""'+(!_covIsMk(w)?' selected':'')+'>Rollo</option><option value="markise"'+(_covIsMk(w)?' selected':'')+'>Markise</option></select>')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Markise: Tuch statt Rollopanzer, Beschriftung „Ein/Aus" und Anzeige des <b>Ausfahrgrads</b>.</div>'
        +row('Anzeige gespiegelt','<input type="checkbox" id="pCvInv"'+(w.cvInv?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Gerät zählt Schließgrad (0=offen)</span>')
        +'<div class="pgh">Kommando-Werte (optional)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Leer = über die Position fahren (Auf/Zu/Halb schreiben 100/0/50). Mit Befehlsvariable eigene Werte, z. B. IPSShadowing 14 / 13 / 11.</div>'
        +row('Befehl Auf','<input id="pCvUp" value="'+esc(String(w.cvUp==null?'':w.cvUp))+'" placeholder="leer = 100">')
        +row('Befehl Halb','<input id="pCvHalf" value="'+esc(String(w.cvHalf==null?'':w.cvHalf))+'" placeholder="leer = 50">')
        +row('Befehl Stop','<input id="pCvStop" value="'+esc(String(w.cvStop==null?'':w.cvStop))+'" placeholder="leer = 1">')
        +row('Befehl Zu','<input id="pCvDn" value="'+esc(String(w.cvDn==null?'':w.cvDn))+'" placeholder="leer = 0">')
        +'<div class="pgh">Sonnenstand</div>'
        +fieldPick(w,'covBrightVid','Helligkeit (Lux, optional)')
        +fieldPick(w,'cvBlockVid','Sperrgrund (BlockReason)')
        +row('Fensterrichtung (Azimut)','<input id="pCovFace" type="number" min="0" max="360" value="'+(w.covFace!=null?w.covFace:'')+'" placeholder="180 = Süd" style="width:90px"> °')
        +row('Breitengrad','<input id="pCovLat" value="'+esc(String(w.covLat==null?'':w.covLat))+'" placeholder="48.0657" style="width:110px">')
        +row('Längengrad','<input id="pCovLon" value="'+esc(String(w.covLon==null?'':w.covLon))+'" placeholder="14.1241" style="width:110px">')
        +'<div class="pgh">Schriftgrößen (px, leer = auto)</div>'
        +row('Name','<input id="pCovNameFs" type="number" min="8" max="40" value="'+(w.covNameFs||'')+'" placeholder="auto" style="width:70px">')
        +row('Status','<input id="pCovStatusFs" type="number" min="7" max="30" value="'+(w.covStatusFs||'')+'" placeholder="auto" style="width:70px">')
        +row('Prozent-Wert','<input id="pCovValFs" type="number" min="10" max="60" value="'+(w.covValFs||'')+'" placeholder="auto" style="width:70px">')
        +row('Presets','<input id="pCovPreFs" type="number" min="8" max="26" value="'+(w.covPreFs||'')+'" placeholder="auto" style="width:70px">')
        +row('Tasten','<input id="pCovBtnFs" type="number" min="8" max="26" value="'+(w.covBtnFs||'')+'" placeholder="auto" style="width:70px">')
        +row('Skala/Tick','<input id="pCovScFs" type="number" min="6" max="20" value="'+(w.covScFs||'')+'" placeholder="auto" style="width:70px">')
        +'<div class="pgh">Stil</div>'
        +row('Akzent',skinSel(w.covAccent||'','id="pCovAcc"'))
        +row('Name-Farbe',skinSel(w.covName||'','id="pCovName"'))
        +row('Wert-Farbe',skinSel(w.covVal||'','id="pCovVal"'))
        +row('Status-Farbe',skinSel(w.covState||'','id="pCovState"'));
    },
    wire:function(w){
      function tog(id,key,def){var e=$('#'+id);if(e)e.onchange=function(){w[key]=(this.checked===def)?undefined:this.checked;render();commit();};}
      tog('pCovViz','covViz',true); tog('pCovSun','covSun',true); tog('pCovSlider','covSlider',false);
      tog('pCovWx','covWx',false);
      if($('#pCovWxA'))$('#pCovWxA').onchange=function(){w.covWxAnim=(this.value==='1')?undefined:parseInt(this.value,10);render();commit();};
      if($('#pCovWxI'))$('#pCovWxI').onchange=function(){w.wxInst=parseInt(this.value,10)||undefined;_covWxBind(w);};
      if($('#pCovWxB'))$('#pCovWxB').onclick=function(){_covWxBind(w);};
          if($('#pCvKind'))$('#pCvKind').onchange=function(){w.cvKind=this.value||undefined;render();commit();};
if($('#pCvInv'))$('#pCvInv').onchange=function(){w.cvInv=this.checked||undefined;render();commit();};
      [['pCvUp','cvUp'],['pCvHalf','cvHalf'],['pCvStop','cvStop'],['pCvDn','cvDn'],['pCovLat','covLat'],['pCovLon','covLon']].forEach(function(p){
        var e=$('#'+p[0]);if(!e)return;e.onchange=function(){var v=this.value.trim();w[p[1]]=(v===''?undefined:v);render();commit();};});
      if($('#pCovFace'))$('#pCovFace').onchange=function(){w.covFace=this.value===''?undefined:parseFloat(this.value);render();commit();};
      [['pCovNameFs','covNameFs'],['pCovStatusFs','covStatusFs'],['pCovValFs','covValFs'],['pCovPreFs','covPreFs'],['pCovBtnFs','covBtnFs'],['pCovScFs','covScFs']].forEach(function(p){
        var e=$('#'+p[0]);if(!e)return;e.oninput=function(){w[p[1]]=this.value===''?undefined:(parseFloat(this.value)||undefined);render();commit();};});
      [['pCovAcc','covAccent'],['pCovName','covName'],['pCovVal','covVal'],['pCovState','covState']].forEach(function(p){
        var e=$('#'+p[0]);if(!e)return;e.onchange=function(){w[p[1]]=this.value||undefined;render();commit();};});
    }
  });
  // Sonne beim Mount initial setzen + regelmaessig nachfuehren (alle 60 s)
  function _covKick(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el){var oc=document.getElementById('ovcanvas');if(oc)el=$('.w[data-id="'+w.id+'"]',oc);}
    if(!el)return;var win=$('[data-role=win]',el);if(!win)return;
    var pc=$('.hc2pct',win);var op=pc?(parseInt(pc.textContent)||0):0;
    if(w.varId&&_lastVals[w.varId])op=_covOpen(w,_lastVals[w.varId].v);
    _covPaint(w,el,op);
  }
  setInterval(function(){if(typeof state==='undefined'||!state.widgets)return;
    function tick(w){if(!w||w.type!=='cover'||!_covOn(w,'covSun',true))return;
      var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el){var oc=document.getElementById('ovcanvas');if(oc)el=$('.w[data-id="'+w.id+'"]',oc);}
      if(!el)return;var win=$('[data-role=win]',el);if(!win)return;var pc=$('.hc2pct',win);var _op=pc?(parseInt(pc.textContent)||0):0;_covSun(w,win,_op);_covWx(w,win,_op);}
    allWidgets().forEach(tick);
    if(typeof _contKids!=='undefined'&&_contKids)_contKids.forEach(tick);
    if(typeof _compKids!=='undefined'&&_compKids)_compKids.forEach(tick);
    if(typeof _popup!=='undefined'&&_popup&&_popup.widgets)_popup.widgets.forEach(tick);
  },60000);
