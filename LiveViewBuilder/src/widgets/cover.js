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
      var sh=$('.hc2shut',win);if(sh)sh.style.height=(100-open)+'%';
      var pc=$('.hc2pct',win);if(pc)pc.innerHTML=open+'<span>%</span>';
      _covSun(w,win,open);
    }
    // Slider (Fenster-Overlay + optionaler unterer) nachziehen, wenn nicht in Bearbeitung
    $$('[data-role=range]',el).forEach(function(r){if(document.activeElement!==r)r.value=open;});
    var sl2=$('.hc2sl2',el);if(sl2&&document.activeElement!==sl2)sl2.style.background='linear-gradient(90deg,var(--accent) 0 '+open+'%,var(--surface-2) '+open+'% 100%)';
    var pre=$('[data-role=cpre]',el);if(pre)pre.querySelectorAll('[data-cpre]').forEach(function(b){var pv=parseInt(b.getAttribute('data-cpre'),10);
      b.classList.toggle('on',(pv===100&&open>=95)||(pv===50&&open>5&&open<95));
      b.classList.toggle('onc',pv===0&&open<=5);});
  }
  // Sonne setzen/ausblenden: nur bei Tag (Hoehe>Schwelle bzw. Helligkeit) UND Rollo offen genug.
  function _covSun(w,win,open){
    var sun=$('.hc2sun',win);if(!sun)return;
    if(!_covOn(w,'covSun',true)||open<=8){sun.style.display='none';return;}
    var g=_covGeo(w), p=_covSunPos(g.lat,g.lon,Date.now()/1000);
    var elMin=(w.covElMin!=null&&w.covElMin!=='')?+w.covElMin:2;
    var brOk=true; if(w.covBrightVid&&_lastVals[w.covBrightVid]){var bv=parseFloat(_lastVals[w.covBrightVid].v);var bMin=(w.covBrightMin!=null&&w.covBrightMin!=='')?+w.covBrightMin:0;if(!isNaN(bv))brOk=bv>=bMin;}
    if(p.elev<elMin||!brOk){sun.style.display='none';return;}
    // vertikal: Hoehe 0..elMax -> unten..oben; im sichtbaren Glas (unter den Lamellen) clampen
    var elMax=(w.covElMax>0?+w.covElMax:60);
    var vt=100-Math.max(0,Math.min(1,p.elev/elMax))*100;          // 0%=oben(Zenit) .. 100%=unten(Horizont)
    var shutBottom=(100-open), glassTop=shutBottom+8, glassBot=92;  // sichtbarer Glasbereich
    vt=Math.max(glassTop,Math.min(glassBot,vt));
    // horizontal: Azimut vs. Fensterrichtung -> Mitte +- Versatz
    var face=(w.covFace!=null&&w.covFace!=='')?+w.covFace:180, dl=((p.az-face+540)%360)-180;
    var hl=50+Math.max(-1,Math.min(1,dl/90))*30;
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

  defWidget('cover',{
    label:'Rollo', paletteIcon:'blinds', size:[300,128], noHover:true,
    render:function(w){
      var viz=_covOn(w,'covViz',true), slider=_covOn(w,'covSlider',false);
      var icU=w.icUp||'chevup', icS=w.icStop||'stop', icD=w.icDn||'chevdn';
      var win = viz ? ('<div class="hc2win" data-role="win">'
          +'<div class="hc2sky"></div><div class="hc2roll"></div>'
          +(_covOn(w,'covSun',true)?'<div class="hc2sun"></div>':'')
          +'<div class="hc2shut" style="height:100%"></div>'
          +'<div class="hc2tick">50</div>'
          +'<div class="hc2pct">–<span></span></div>'
          +'<input class="hc2winr" type="range" data-role="range" min="0" max="100" step="1" value="0" title="Rollo ziehen">'
          +'</div>') : '';
      var pre='<div class="hc2pre" data-role="cpre">'
          +'<button data-cpre="0">Zu</button><button data-cpre="50">Halb</button><button data-cpre="100">Auf</button></div>';
      var btns='<div class="hc2btns">'
          +'<button data-role="cup" title="Auf"><svg><use href="#ic-'+esc(icU)+'"/></svg><span class="lb">Auf</span></button>'
          +'<button data-role="cstop" title="Stop"><svg><use href="#ic-'+esc(icS)+'"/></svg><span class="lb">Stop</span></button>'
          +'<button data-role="cdn" title="Zu"><svg><use href="#ic-'+esc(icD)+'"/></svg><span class="lb">Zu</span></button></div>';
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
      if(w.covBrightVid&&id===w.covBrightVid){var win=$('[data-role=win]',el);if(win){var pc=$('.hc2pct',win);var op0=pc?parseInt(pc.textContent)||0:0;_covSun(w,win,op0);}return;}
      if(id!==w.varId)return;
      var op=_covOpen(w,d.v);
      _covPaint(w,el,op);
      // Statuszeile aus der Position (offen / geschlossen / X % offen) — sofern kein echter Statustext gesetzt ist
      var cs=$('[data-role=ctext]',el),st2=$('[data-role=cstate]',el);
      if(cs&&!el._covMtxt)cs.textContent=op<=2?'geschlossen':(op>=98?'offen':(op+' % offen'));
      if(st2)st2.classList.toggle('closed',op<=2);
    },
    props:function(w){
      return '<div style="font-size:11px;color:var(--muted);margin:2px 2px 7px">Oben <b>Variable</b> = <b>Position</b> (Rollo, %). Weiter unten: <b>Kommando</b> (Auf/Halb/Stop/Zu) und <b>Modus/Status</b>. Anlagen wie IPSShadowing zählen den Schließgrad → „Anzeige gespiegelt" anhaken.</div>'
        +'<div class="pgh">Darstellung</div>'
        +row('Fenster-Visualisierung','<input type="checkbox" id="pCovViz"'+(_covOn(w,'covViz',true)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Rollo/Glas links (Rollo = Slider)</span>')
        +row('Sonne anzeigen','<input type="checkbox" id="pCovSun"'+(_covOn(w,'covSun',true)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">nur bei Tag &amp; offenem Rollo</span>')
        +row('Slider unter Tasten','<input type="checkbox" id="pCovSlider"'+(_covOn(w,'covSlider',false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">zusätzlicher horizontaler Slider mit Skala</span>')
        +row('Anzeige gespiegelt','<input type="checkbox" id="pCvInv"'+(w.cvInv?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Gerät zählt Schließgrad (0=offen)</span>')
        +'<div class="pgh">Kommando-Werte (optional)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Leer = über die Position fahren (Auf/Zu/Halb schreiben 100/0/50). Mit Befehlsvariable eigene Werte, z. B. IPSShadowing 14 / 13 / 11.</div>'
        +row('Befehl Auf','<input id="pCvUp" value="'+esc(String(w.cvUp==null?'':w.cvUp))+'" placeholder="leer = 100">')
        +row('Befehl Halb','<input id="pCvHalf" value="'+esc(String(w.cvHalf==null?'':w.cvHalf))+'" placeholder="leer = 50">')
        +row('Befehl Stop','<input id="pCvStop" value="'+esc(String(w.cvStop==null?'':w.cvStop))+'" placeholder="leer = 1">')
        +row('Befehl Zu','<input id="pCvDn" value="'+esc(String(w.cvDn==null?'':w.cvDn))+'" placeholder="leer = 0">')
        +'<div class="pgh">Sonnenstand</div>'
        +fieldPick(w,'covBrightVid','Helligkeit (Lux, optional)')
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
      if(!el)return;var win=$('[data-role=win]',el);if(!win)return;var pc=$('.hc2pct',win);_covSun(w,win,pc?(parseInt(pc.textContent)||0):0);}
    allWidgets().forEach(tick);
    if(typeof _contKids!=='undefined'&&_contKids)_contKids.forEach(tick);
    if(typeof _compKids!=='undefined'&&_compKids)_compKids.forEach(tick);
    if(typeof _popup!=='undefined'&&_popup&&_popup.widgets)_popup.widgets.forEach(tick);
  },60000);
