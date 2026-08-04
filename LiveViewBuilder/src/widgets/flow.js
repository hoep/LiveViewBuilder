  // ===== Widget: Fluss (flow) — generisches Fluss-Schema =====
  //  mode 'hub'      : Quellen -> Zentrum -> Senken  (ehem. 'powerflow', Alias bleibt)
  //  mode 'pipeline' : Stationen in Reihe (Icon-Knoten: Wert oben / Label unten) + animierte Konnektoren
  //  varId = Fluss-Variable  -> Tempo/Farbe/an-aus der Konnektoren (Schwelle/Referenz).
  //  Knoten-/Becken-Werte via data-vid (automatisches Live-Update, kein eigener Code).
  function _flowMode(w){return w.mode||((w.src||w.snk)?'hub':'pipeline');}
  function flowPipeState(w){
    var lv=w.varId&&_lastVals[w.varId], n=lv?parseFloat(String(lv.v).replace(',','.')):NaN;
    var thr=(w.flThr!=null?w.flThr:0), ref=(w.flRef!=null&&w.flRef>0?w.flRef:20);
    var flowing=!isNaN(n)&&Math.abs(n)>thr, mag=isNaN(n)?0:Math.min(1,Math.abs(n)/ref);
    return {flowing:flowing, dur:(1.9-mag*1.4).toFixed(2), rev:(n<0)};
  }
  function applyFlowState(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var pipe=$('[data-role=pipe]',el);if(!pipe)return;
    var st=flowPipeState(w);
    pipe.classList.toggle('noflow',!st.flowing);
    pipe.classList.toggle('rev',st.rev);
    pipe.style.setProperty('--fldur',(st.flowing?st.dur:'1.1')+'s');
  }
  function flowNode(s){
    var val=s.vid?('<span class="flnvtop" data-vid="'+s.vid+'">–</span>')
                 :(s.val?('<span class="flnvtop">'+esc(s.val)+'</span>'):'<span class="flnvtop">&nbsp;</span>');
    var sub=(s.subvid||s.sub)?('<span class="flnsub"'+(s.subvid?' data-vid="'+s.subvid+'"':'')+'>'+esc(s.sub||'')+'</span>'):'';
    var gen=s.color?(_cssColorOrEmpty(s.color)||''):'';           // Icon-Grundfarbe (Skin)
    var act=s.svColor?(_cssColorOrEmpty(s.svColor)||''):'';       // Farbe bei Status AN (data-viddot .on)
    var actOff=s.svColorOff?(_cssColorOrEmpty(s.svColorOff)||''):''; // Farbe bei Status AUS
    var st=(gen?('--ico:'+gen+';'):'')+(act?('--icoon:'+act+';'):'')+(actOff?('--icooff:'+actOff+';'):'');
    var box='<span class="flbox"'+(s.sv?(' data-viddot="'+s.sv+'"'):'')+(st?(' style="'+st+'"'):'')+'>'+iconSVG(s.icon||'gauge')+'</span>';
    return '<span class="flnode">'+val+box+'<span class="flnlab">'+esc(s.label||'')+sub+'</span></span>';
  }
  // Konnektor; mit Status-Var der QUELL-Stufe (s.sv) gated -> data-viddot toggelt .on, CSS haelt den Fluss sonst an
  function flowConn(s){var g=(s&&s.sv)?(' data-viddot="'+s.sv+'"'):'';return '<span class="flconn"><i'+g+'></i></span>';}
  function flowPipeline(w){
    var stages=w.stages||[], parts=[];
    if(w.startArrow)parts.push('<span class="flstart">'+(w.startLabel?'<span class="flslab">'+esc(w.startLabel)+'</span>':'')+'<svg class="flarr" viewBox="0 0 24 24"><path d="M3 12h14M13 6l6 6-6 6"/></svg></span>');
    stages.forEach(function(s,i){if(i>0)parts.push(flowConn(stages[i-1]));parts.push(flowNode(s));});
    if(w.endTank){parts.push(flowConn(stages[stages.length-1]));
      parts.push('<span class="fltank"><span class="fltlab">'+esc(w.tankLabel||'Becken')+'</span><span class="fltval"'+(w.tankVid?' data-vid="'+w.tankVid+'"':'')+'>'+(w.tankVal?esc(w.tankVal):'–')+'</span>'
        +'<span class="flwave"><svg viewBox="0 0 120 20" preserveAspectRatio="none"><path d="M0 11 Q15 3 30 11 T60 11 T90 11 T120 11 T150 11 T180 11 T210 11 T240 11"/><path d="M0 15 Q15 8 30 15 T60 15 T90 15 T120 15 T150 15 T180 15 T210 15 T240 15"/></svg></span></span>');}
    var onC=_cssColorOrEmpty(w.flPos)||'var(--accent)',offC=_cssColorOrEmpty(w.flOff||'muted')||'var(--muted)';
    return '<div class="flpipe'+(w.flDir==='v'?' v':'')+'" data-role="pipe" style="--flcol:'+onC+';--flcoloff:'+offC+'">'+parts.join('')+'</div>';
  }
  // ===== energy-Modus (Power-Flow-Card-Plus-Stil): Home-Knoten + frei konfigurierbare Kreis-Elemente =====
  var _EF_W=400,_EF_H=300,_EF_HX=200,_EF_HY=150,_EF_RH=40,_EF_RN=32;
    // Kanonischer Typ, durchgehend englisch. Frueher hiess der Verbraucher intern
  // 'verbraucher' - als einziger deutscher Wert zwischen pv/grid/battery. Wer im Editor
  // 'consumer' eintrug, bekam still etwas anderes gespeichert, und ohne Namen stand das
  // deutsche Stichwort als Beschriftung im Bild. Alte Schreibweisen bleiben lesbar.
  function _et(t){t=(t||'').toString().toLowerCase();
    // OHNE Typ muss 'consumer' herauskommen. Der Editor zeigt bei leerem Feld "Verbraucher"
    // an (Vorgabe def:'consumer'), speichert dabei aber nichts. Fiel der leere Wert hier auf
    // 'other', entschied das Vorzeichen ueber die Richtung - und ein Verbraucher mit
    // positiver Leistung wurde als Lieferant gezeichnet. Anzeige und Verhalten muessen
    // dasselbe sagen; 'other' bleibt der ausdruecklich gewaehlten Einstellung vorbehalten.
    if(t==='')return 'consumer';
    return {batterie:'battery',akku:'battery',netz:'grid',solar:'pv',pv:'pv',
            load:'consumer',verbrauch:'consumer',verbraucher:'consumer'}[t]||t;}
  // Farbe eines Knotens. Der Skin-Waehler speichert einen SCHLUESSEL ('ok', 'accent'),
  // keine CSS-Farbe. Roh eingesetzt ergab das "stroke:ok" - eine ungueltige Deklaration,
  // die der Browser verwirft: Ring, Leitung und Laufpunkt blieben unsichtbar, das Element
  // verschwand komplett. _cssColorOrEmpty laesst nur echte Farben durch, alles andere
  // faellt sichtbar auf den Akzent zurueck statt lautlos zu verschwinden.
  function _efCol(c){return _cssColorOrEmpty(c)||'var(--accent)';}
  function _efDefIcon(t){return t==='pv'?'solarpanel':t==='grid'?'pylon':t==='battery'?'battery':t==='consumer'?'plug':'gauge';}
  function _efIcon(id){var e=ICONS[id]||ICONS.gauge;return e?e[1]:'';}
  // Geometrie des Energieflusses. Frueher standen die Baender auf festen Pixelwerten:
  // pv oben auf 216 px, grid links auf nur 104 px - ab drei Netz-Knoten beruehrten sie
  // sich, ab fuenf PV-Knoten ebenso. Schlimmer: 'other' lag auf EXAKT demselben Band wie
  // 'battery' und verdeckte es vollstaendig. Und der Rand galt nur fuer den Kreis, nicht
  // fuer die Beschriftung darueber, die deshalb oben abgeschnitten wurde.
  //
  // Jetzt wird der Platzbedarf gerechnet: Jeder Knoten bekommt Durchmesser plus Abstand,
  // die Flaeche waechst mit, wenn eine Seite mehr Knoten hat. Beruehrungen sind damit
  // ausgeschlossen, nicht nur unwahrscheinlich.
  function _energyGeo(w){
    var PAD=(w.efPad!=null&&w.efPad!==''?+w.efPad:18);     // Rand ringsum, einstellbar
    var GAP=(w.efGap!=null&&w.efGap!==''?+w.efGap:16);     // Mindestabstand zwischen Knoten
    var RN=_EF_RN,RH=_EF_RH;
    // Hoehe des Textblocks haengt an der Zeilenzahl - ein Name mit \n braucht mehr Platz.
    function lblH(list){var m=1;(list||[]).forEach(function(o){var n=_efLines(o.e.name).length||1;if(n>m)m=n;});return 9+m*_EF_LH;}
    // Waagrecht genuegt Durchmesser + Abstand, die Beschriftungen stehen nebeneinander.
    // SENKRECHT muss der Textblock mitgerechnet werden: Er sitzt bei y = -r - 9 und ist
    // rund 11 px hoch. Ohne ihn stiess die Beschriftung des unteren Knotens 4 px in die
    // Unterkante des darueberliegenden - genau die gemeldete Kollision.
    // REIHENFOLGE BEACHTEN: top/left/right muessen VOR cellL/cellR/lblT stehen. Standen sie
    // darunter, waren sie durch das Hochziehen von var dort noch undefined - lblH() bekam
    // nichts, meldete stur eine Zeile, und die ganze Mehrzeilen-Rechnung lief ins Leere.
    // Hoehe des Wertblocks UNTER den Kreisen. Netz und Batterie zeigen zwei Zeilen
    // (Bezug/Einspeisung bzw. Laden/Entladen), alle anderen eine.
    function valH(list){var m=1;(list||[]).forEach(function(o){var n=_efValLines(_et(o.e.type));if(n>m)m=n;});return 13+m*_EF_VLH;}
    var els=w.elements||[],by={pv:[],grid:[],battery:[],consumer:[],other:[]};
    els.forEach(function(e,i){(by[_et(e.type)]||by.other).push({e:e,i:i});});
    var top=by.pv, bot=by.battery.concat(by.other), left=by.grid, right=by.consumer;
    // Eine Spalte aus vielen Verbrauchern macht das Bild sehr hoch: Jeder Knoten braucht
    // senkrecht Durchmesser + Abstand + Beschriftung + Wertblock, also rund 125 px. Bei
    // fuenf Verbrauchern waren das 760 px Hoehe - im Widget auf Briefmarkengroesse
    // heruntergerechnet. Ueberzaehlige wandern darum in die untere Reihe, wo sie
    // NEBENeinander stehen und nur Breite kosten.
    var MAXC=(w.efMaxCol!=null&&w.efMaxCol!==''?+w.efMaxCol:3);
    if(MAXC>0&&right.length>MAXC){bot=bot.concat(right.slice(MAXC));right=right.slice(0,MAXC);}
    // Eine Zelle umfasst jetzt BEIDES: Beschriftung darueber und Wertblock darunter. Ohne
    // den unteren Teil stiess der Wert des einen Knotens in die Beschriftung des naechsten -
    // derselbe Fehler wie zuvor bei den Beschriftungen, nur am anderen Ende.
    var cellH=2*RN+GAP;
    var cellL=2*RN+GAP+lblH(left)+valH(left), cellR=2*RN+GAP+lblH(right)+valH(right);
    var lblT=Math.max(lblH(top),lblH(left),lblH(right));   // oberer Rand: groesster Textblock
    var valB=Math.max(valH(bot),valH(left),valH(right));   // unterer Rand: groesster Wertblock
    function need(n,cell){return n>0?2*RN+(n-1)*(cell||cellH):0;}
    // Reihen duerfen nicht in die Spalten laufen und umgekehrt - sonst treffen sich
    // Reihenende und Spaltenanfang in den Ecken. Nur reservieren, wo es die Seite gibt.
    var res=2*RN+GAP;
    // Waagrecht bleibt es beim reinen Durchmesser - Beschriftung und Wert stehen mittig
    // unter- bzw. ueberhalb, sie brauchen keine zusaetzliche BREITE. Senkrecht dagegen
    // beansprucht die obere Reihe zusaetzlich ihren Wertblock nach unten, die untere Reihe
    // ihre Beschriftung nach oben.
    var rL=left.length?res:0, rR=right.length?res:0;
    var rT=top.length?(2*RN+GAP+valH(top)):0, rB=bot.length?(2*RN+GAP+lblH(bot)):0;
    var W=Math.max(_EF_W,2*PAD+rL+rR+need(top.length,cellH),2*PAD+rL+rR+need(bot.length,cellH),
                   2*PAD+4*RN+2*GAP+2*RH);
    // Der Home-Knoten in der Mitte traegt seinen Wert ebenfalls unter sich.
    var homeV=13+_EF_VLH;
    var H=Math.max(_EF_H,2*PAD+lblT+rT+rB+valB+need(left.length,cellL),
                   2*PAD+lblT+rT+rB+valB+need(right.length,cellR),
                   2*PAD+lblT+rT+rB+valB+2*RH+homeV+2*GAP);
    var hx=W/2,hy=H/2,pos=[];
    function lay(list,along,fixed,lo,hi){                  // zwischen lo und hi zentrieren
      var cell=(along==='x')?cellH:(fixed<=(W/2)?cellL:cellR);
      var L=need(list.length,cell),start=lo+((hi-lo)-L)/2+RN;
      list.forEach(function(o,k){
        var v=start+k*cell;
        var p=(along==='x')?{x:v,y:fixed}:{x:fixed,y:v};
        pos[o.i]={x:(o.e.x!=null&&o.e.x!==''?+o.e.x:p.x),      // frei gesetzte Werte gehen vor
                  y:(o.e.y!=null&&o.e.y!==''?+o.e.y:p.y)};
      });
    }
    lay(top,  'x',PAD+lblH(top)+RN,        PAD+rL,      W-PAD-rR);
    lay(bot,  'x',H-PAD-valH(bot)-RN,      PAD+rL,      W-PAD-rR);   // Wertblock bleibt frei
    lay(left, 'y',PAD+RN,                  PAD+lblT+rT, H-PAD-rB-valB);
    lay(right,'y',W-PAD-RN,                PAD+lblT+rT, H-PAD-rB-valB);
    return {pos:pos,W:W,H:H,hx:hx,hy:hy};
  }
  function _efPath(nx,ny,hx,hy){
    hx=(hx==null?_EF_HX:hx);hy=(hy==null?_EF_HY:hy);
    var dx=hx-nx,dy=hy-ny;
    if(Math.abs(dx)>=Math.abs(dy)){var mx=(nx+hx)/2;return 'M'+nx+' '+ny+' C'+mx+' '+ny+' '+mx+' '+hy+' '+hx+' '+hy;}
    var my=(ny+hy)/2;return 'M'+nx+' '+ny+' C'+nx+' '+my+' '+hx+' '+my+' '+hx+' '+hy;
  }
  // Beschriftung eines Knotens. In SVG gibt es kein <br>; mehrere Zeilen brauchen
  // <tspan> mit dy. Die Beschriftung sitzt UEBER dem Kreis, also waechst sie nach oben:
  // die erste Zeile beginnt entsprechend hoeher, damit die letzte immer denselben
  // Abstand zum Kreis hat.
  var _EF_LH=12;                                        // Zeilenhoehe der Beschriftung
  function _efLines(name){
    var a=String(name==null?'':name).split(/\\n|\r\n|\r|\n/);
    while(a.length&&a[a.length-1].trim()==='')a.pop();
    while(a.length&&a[0].trim()==='')a.shift();
    return a;
  }
  function _efLabel(name,r){
    var a=_efLines(name);if(!a.length)return '';
    var y0=-r-9-(a.length-1)*_EF_LH;
    return '<text class="efname" y="'+y0+'">'+a.map(function(t,i){
      return '<tspan x="0"'+(i?' dy="'+_EF_LH+'"':'')+'>'+esc(t)+'</tspan>';}).join('')+'</text>';
  }
  // Werte stehen UNTER dem Kreis, nicht darin. Innen liegt der Text auf einer Sehne, nicht
  // auf dem Durchmesser: Bei r=32 sind auf der ersten Wertzeile nur 55 px frei, auf der
  // zweiten (Netz/Batterie) nur noch 34 px. "→ 1.234 W" braucht 59 px und lief deshalb in
  // die Kreislinie. Aussen ist der Platz unbegrenzt, der Kreis bleibt fest, und nichts muss
  // beim Werteumschlag neu skaliert werden. Das Icon rueckt dadurch in die Kreismitte.
  var _EF_VLH=11;                                       // Zeilenhoehe des Wertblocks
  function _efValLines(type){return (type==='grid'||type==='battery')?2:1;}
  function _efValH(type){return 13+_efValLines(type)*_EF_VLH;}   // Hoehe UNTER dem Kreis
  function _efNode(x,y,r,col,icon,name,type,idx){
    var g='<g class="efnode" transform="translate('+x+','+y+')">';
    g+=_efLabel(name,r);
    g+='<circle class="efring" r="'+r+'" style="stroke:'+col+'"/>';
    // Batterie behaelt den Ladestand INNEN - er ist nie laenger als "100%" und passt dort
    // bequem; das Icon rueckt dafuer etwas nach oben.
    g+='<svg class="eficon" x="-11" y="'+(type==='battery'?-15:-11)+'" width="22" height="22" viewBox="0 0 24 24">'+_efIcon(icon)+'</svg>';
    if(type==='battery')g+='<text class="efsoc" data-role="efsoc-'+idx+'" y="18"></text>';
    g+='<text class="efval" data-role="efval-'+idx+'" y="'+(r+13)+'">–</text>';
    g+='<text class="efval2" data-role="efval2-'+idx+'" y="'+(r+13+_EF_VLH)+'"></text>';
    return g+'</g>';
  }
  function energySVG(w){
    var G=_energyGeo(w),pos=G.pos,els=w.elements||[];
    var s='<svg class="efsvg" viewBox="0 0 '+G.W+' '+G.H+'" preserveAspectRatio="xMidYMid meet">';
    els.forEach(function(e,i){var p=pos[i];if(!p)return;var col=_efCol(e.color),d=_efPath(p.x,p.y,G.hx,G.hy);
      s+='<path class="efwire" d="'+d+'" style="stroke:'+col+'"/>'
        +'<path class="efflow" data-role="efflow-'+i+'" d="'+d+'" style="stroke:'+col+';opacity:0"/>'
        +'<circle class="efdot" data-role="efdot-'+i+'" r="4" style="fill:'+col+';offset-path:path(\''+d+'\');opacity:0"/>';
    });
    s+=_efNode(G.hx,G.hy,_EF_RH,_efCol(w.homeColor),w.homeIcon||'housepower',w.homeName||'Home','home','h');
    els.forEach(function(e,i){var p=pos[i];if(!p)return;s+=_efNode(p.x,p.y,_EF_RN,_efCol(e.color),e.icon||_efDefIcon(_et(e.type)),e.name||'',_et(e.type),i);});
    return s+'</svg>';
  }
  function _efNum(vid){var d=vid&&_lastVals[vid];return d?parseFloat(String(d.v).replace(',','.')):NaN;}
  // Leistungswert in WATT, unabhaengig von der Profil-Einheit der Variable. Misst eine Quelle
  // in kW (z. B. Pool 1,5 kW), wuerde der Rohwert 1,5 sonst wie 1,5 W behandelt - der Fluss
  // liefe im Schneckentempo und die Anzeige zeigte "1,5 W". Nur exaktes "kW" wird auf W
  // hochgerechnet, damit "kWh" o. Ae. nicht faelschlich skaliert.
  function _efWatts(vid){var d=vid&&_lastVals[vid];if(!d)return NaN;var n=parseFloat(String(d.v).replace(',','.'));if(isNaN(n))return n;var u=(d.u!=null?String(d.u):'').trim().toLowerCase();return (u==='kw')?n*1000:n;}
  // Ab 1000 W in kW - "1,2 kW" statt "1.234 W". Das halbiert die Textbreite genau dort, wo
  // sie bisher aus dem Kreis lief. Ab 10 kW entfaellt die Nachkommastelle, sie traegt dann
  // keine Information mehr. minimumFractionDigits und maximumFractionDigits duerfen sich
  // NICHT widersprechen (min > max wirft RangeError), darum zwei getrennte Zweige.
  function _efFmtW(v){
    if(v==null||isNaN(v))return '–';
    var a=Math.abs(v);
    try{
      if(a>=10000)return Math.round(a/1000).toLocaleString('de-DE')+' kW';
      if(a>=1000)return (Math.round(a/100)/10).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})+' kW';
      return Math.round(a).toLocaleString('de-DE')+' W';
    }catch(e){return Math.round(a)+' W';}
  }
  // Richtung eines Elements: PV speist immer ein, Verbraucher zieht immer ab,
  // bei Netz und Batterie entscheidet das Vorzeichen der Leistung.
  // 'other' zaehlt bewusst als Verbraucher und NICHT vorzeichengesteuert: Einspeisung ist
  // durch pv, grid und battery vollstaendig abgedeckt, "Sonstiges" ist in der Praxis immer
  // ein Abnehmer. Vorher entschied dort das Vorzeichen - eine positive Verbrauchsleistung
  // wurde damit als Einspeisung gezeichnet, ohne dass das irgendwo ablesbar war.
  function _efDir(t,p){return (t==='pv')?1:(t==='consumer'||t==='other')?-1:((p<0)?-1:1);}
  // Geschwindigkeit/Richtung des Laufpunkts NICHT mitten in einer Runde aendern - das laesst
  // die CSS-Animation zurueckspringen und der Fluss wirkt bei zappelnden (z. B. berechneten)
  // Leistungswerten staendig unterbrochen. Der neue Wert wird gemerkt und erst am Rundenende
  // uebernommen (animationiteration), wenn der Punkt ohnehin am Start steht - dort ist der
  // Wechsel unsichtbar. So gilt fuer eine ganze Runde genau eine Geschwindigkeit.
  // Die Deckkraft (an/aus) darf sofort wechseln, das ist nur ein Ein-/Ausblenden.
  function _efSetAnim(el,dur,dir,active){
    if(!el)return;
    el.style.opacity=active?'':'0';
    el._efPD=dur+'s'; el._efPDir=dir;
    if(!el._efHook){
      el._efHook=true;
      el.style.animationDuration=el._efPD;      // erste Geschwindigkeit sofort setzen
      el.style.animationDirection=el._efPDir;
      el.addEventListener('animationiteration',function(){
        if(el.style.animationDuration!==el._efPD)el.style.animationDuration=el._efPD;
        if(el.style.animationDirection!==el._efPDir)el.style.animationDirection=el._efPDir;
      });
    }
  }
  function refreshEnergy(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var els=w.elements||[],homeIn=0;
    // Tempo-Referenz: Summe dessen, was gerade INS Haus fliesst - also alle Lieferanten
    // zusammen (PV, Netzbezug, Batterie-Entladung). Damit laeuft der groesste Lieferant am
    // schnellsten und jeder andere anteilig langsamer; ein fester Schwellwert taugt dafuer
    // nicht, weil er bei wenig Last alles auf Standgas und bei viel Last alles auf Anschlag
    // setzt. Faellt die Summe auf 0, greift die feste Referenz als Rueckfall.
    var total=0;
    if(w.efSpeedAuto!==false)els.forEach(function(e){
      var p=_efWatts(e.vid);if(isNaN(p))return;
      if(_efDir(_et(e.type),p)>0)total+=Math.abs(p);
    });
    els.forEach(function(e,i){
      var t=_et(e.type),p=_efWatts(e.vid),mag=isNaN(p)?0:Math.abs(p),dir=_efDir(t,p),active=mag>1;
      var v1=$('[data-role=efval-'+i+']',el),v2=$('[data-role=efval2-'+i+']',el);
      if(t==='grid'||t==='battery'){var into=Math.max(isNaN(p)?0:p,0),out=Math.max(isNaN(p)?0:-p,0),A=(t==='grid')?['→ ','← ']:['↑ ','↓ '];
        if(v1)v1.textContent=A[0]+_efFmtW(into);if(v2)v2.textContent=A[1]+_efFmtW(out);}
      else{if(v1)v1.textContent=_efFmtW(mag);if(v2)v2.textContent='';}
      if(t==='battery'&&e.socVid){var soc=_efNum(e.socVid),se=$('[data-role=efsoc-'+i+']',el);if(se)se.textContent=isNaN(soc)?'':(Math.round(soc)+'%');}
      var flow=$('[data-role=efflow-'+i+']',el),dot=$('[data-role=efdot-'+i+']',el);
      var spd=e.speedVid?_efNum(e.speedVid):mag;if(isNaN(spd))spd=mag;
      var ref=e.speedVid?(+e.speedRef||100)
             :((w.efSpeedAuto!==false&&total>0)?total:(+w.efRef||3000)),frac=Math.min(1,Math.abs(spd)/(ref||1)),rev=(dir<0?'reverse':'normal');
      // Nur EIN Wert ist einstellbar: die Umlaufdauer bei vollem Anteil. Alles andere
      // ergibt sich daraus umgekehrt proportional - halber Anteil, doppelte Dauer. Das ist
      // die ehrliche Lesart von "relativ": Der Punkt bewegt sich so schnell wie sein
      // Anteil am Fluss. Nach unten gedeckelt beim Zwanzigfachen der Volldauer: ohne
      // Deckel braeuchte 1 % Anteil hundert Umlaufdauern und wirkte wie Stillstand.
      var t100=(w.efDur100!=null&&w.efDur100!==''?+w.efDur100:0.6);
      var dur=(frac>0?Math.min(t100/frac,t100*20):t100*20).toFixed(2);
      _efSetAnim(flow,dur,rev,active);
      _efSetAnim(dot,dur,rev,active);
      if(dir>0)homeIn+=mag;
    });
    var hv=$('[data-role=efval-h]',el);if(hv){var hp=w.homeVid?_efWatts(w.homeVid):NaN;hv.textContent=_efFmtW(isNaN(hp)?homeIn:hp);}
  }
  defWidget('flow',{
    label:'Fluss', paletteIcon:'wsankey', size:[560,168],
    defaults:function(w){w.mode='pipeline';w.flPos='#00cdab';w.flRef=20;w.endTank=1;w.tankLabel='Becken';w.startArrow=1;
      w.stages=[{icon:'valve',label:'Ventil',vid:0},{icon:'pump',label:'Pumpe',vid:0},{icon:'filter',label:'Filter',vid:0},{icon:'droplet',label:'pH',vid:0},{icon:'bolt',label:'Redox',vid:0},{icon:'gauge',label:'Durchfluss',vid:0}];},
    render:function(w){var m=_flowMode(w);return m==='hub'?powerflowSVG(w):m==='energy'?energySVG(w):flowPipeline(w);},
    props:function(w){
      var m=_flowMode(w);
      var h=row('Modus','<select id="pFlMode"><option value="pipeline"'+(m==='pipeline'?' selected':'')+'>Pipeline (Reihe)</option><option value="energy"'+(m==='energy'?' selected':'')+'>Energie (Power-Flow)</option><option value="hub"'+(m==='hub'?' selected':'')+'>Hub (Quellen→Zentrum→Senken)</option></select>');
      if(m==='hub')return h+listEditor(w,'src','Quellen: Name · ID',[{k:'label',ph:'Name'},{k:'vid',ph:'ID'}])+listEditor(w,'snk','Senken: Name · ID',[{k:'label',ph:'Name'},{k:'vid',ph:'ID'}]);
      if(m==='energy')return h
        +'<div class="pgh">Home-Knoten</div>'
        +row('Name / Icon','<input id="pEfHN" value="'+esc(w.homeName||'Home')+'" style="width:88px"> <input id="pEfHI" value="'+esc(w.homeIcon||'housepower')+'" placeholder="icon" style="width:88px">')
        +row('Farbe / Wert-ID','<input type="color" id="pEfHC" value="'+(w.homeColor||'#00cdab')+'"> <input id="pEfHV" value="'+(w.homeVid||'')+'" placeholder="leer = Summe" style="width:110px">')
        +row('Dauer bei 100 % (s)','<input id="pEfDur" type="number" step="0.1" min="0.1" value="'+(w.efDur100!=null?w.efDur100:0.6)+'"> <span style="font-size:11px;color:var(--muted)">halber Anteil = doppelte Dauer</span>')
        +row('Tempo automatisch','<input type="checkbox" id="pEfAuto"'+(w.efSpeedAuto!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Referenz = Summe aller Einspeisungen</span>')
        +(w.efSpeedAuto!==false?'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Jeder Knoten laeuft anteilig zur Gesamteinspeisung. Der feste Wert unten greift nur, wenn gerade nichts einspeist.</div>':'')
        +row('Referenz-Leistung (Tempo)','<input id="pEfRef" type="number" value="'+(w.efRef||3000)+'" placeholder="W bei max Tempo">')
        +row('Rand (px)','<input id="pEfPad" type="number" min="0" value="'+(w.efPad!=null?w.efPad:18)+'">')
        +row('Knotenabstand (px)','<input id="pEfGap" type="number" min="0" value="'+(w.efGap!=null?w.efGap:16)+'">')
        +row('Verbraucher je Spalte','<input id="pEfMaxCol" type="number" min="0" value="'+(w.efMaxCol!=null?w.efMaxCol:3)+'"> <span style="font-size:11px;color:var(--muted)">dar&uuml;ber hinaus in die untere Reihe; 0 = alle in die Spalte</span>')
        +'<div class="pgh">Elemente</div><div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Typ bestimmt Position und Standard-Icon. Das Vorzeichen entscheidet nur bei <b>Netz</b> und <b>Batterie</b>: <b>+</b> zum Haus, <b>&minus;</b> vom Haus weg. PV flie&szlig;t immer zum Haus; Verbraucher und Sonstiges immer weg &ndash; unabh&auml;ngig vom Vorzeichen.</div>'
        +listEditor(w,'elements','Typ · Name · Icon · Farbe · Leistung-ID · Speed-ID · Speed-Referenz · SoC-ID',[{k:'type',type:'select',def:'consumer',options:[['pv','PV / Erzeuger'],['grid','Netz'],['battery','Batterie'],['consumer','Verbraucher'],['other','Sonstiges']]},{k:'name',ph:'Name'},{k:'icon',ph:'icon'},{k:'color',type:'skincolor'},{k:'vid',ph:'Leist-ID'},{k:'speedVid',ph:'Speed'},{k:'speedRef',ph:'Speed-Ref'},{k:'socVid',ph:'SoC'}]);
      return h
        +'<div class="pgh">Fluss (Variable = „Variable" oben)</div>'
        +row('Farbe (Fluss)','<span style="font-size:11px;color:var(--muted)">An</span> '+skinSel(w.flPos||'accent','id="pFlCol"')+' <span style="font-size:11px;color:var(--muted);margin-left:8px">Aus</span> '+skinSel(w.flOff||'muted','id="pFlColOff"'))
        +row('Schwelle / Referenz','<input id="pFlThr" type="number" step="0.1" style="width:72px" value="'+(w.flThr!=null?w.flThr:0)+'"> <input id="pFlRef" type="number" step="0.1" style="width:72px" value="'+(w.flRef!=null?w.flRef:20)+'" placeholder="max Tempo">')
        +row('Ausrichtung','<select id="pFlDir"><option value="h"'+(w.flDir!=='v'?' selected':'')+'>Horizontal</option><option value="v"'+(w.flDir==='v'?' selected':'')+'>Vertikal</option></select>')
        +'<div class="pgh">Endpunkte</div>'
        +row('Eingangs-Pfeil','<input type="checkbox" id="pFlStart"'+(w.startArrow?' checked':'')+'> <input id="pFlStartL" value="'+esc(w.startLabel||'')+'" placeholder="Label" style="width:110px">')
        +row('Becken-Knoten','<input type="checkbox" id="pFlTank"'+(w.endTank?' checked':'')+'> <input id="pFlTankL" value="'+esc(w.tankLabel||'')+'" placeholder="Label" style="width:84px"> <input id="pFlTankV" value="'+(w.tankVid||'')+'" placeholder="Wert-ID" style="width:70px">')
        +'<div class="pgh">Stationen</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Je Station: Icon + Icon-Farbe, optional eine <b>Aktiv-Farbe</b> (überschreibt die Icon-Farbe, wenn die Status-Variable an ist), Werte, und eine <b>0/1-Status-Variable</b>, die den Fluss <b>zur nächsten</b> Station stoppt, wenn sie aus ist (z. B. Solarventil zu → keine Strömung Ventil→Pumpe).</div>'
        +listEditor(w,'stages','Stationen',[{k:'icon',type:'icon',h:'Icon'},{k:'color',type:'skincolor',h:'Icon-Farbe'},{k:'label',ph:'Label',h:'Label'},{k:'vid',ph:'ID',h:'Wert-ID'},{k:'sub',ph:'Text',h:'Zusatz'},{k:'subvid',ph:'ID',h:'Zusatz-ID'},{k:'sv',ph:'0/1-ID',h:'Status→Fluss'},{k:'svColor',type:'skincolor',h:'Icon-Farbe (Status an)'},{k:'svColorOff',type:'skincolor',h:'Icon-Farbe (Status aus)'}],{wrap:true});
    },
    wire:function(w){
      if($('#pEfDur'))$('#pEfDur').onchange=function(){var v=parseFloat(this.value);w.efDur100=(isNaN(v)||v<=0)?undefined:v;render();commit();};
      if($('#pEfAuto'))$('#pEfAuto').onchange=function(){w.efSpeedAuto=this.checked?undefined:false;render();renderProps();commit();};
      if($('#pEfPad'))$('#pEfPad').onchange=function(){w.efPad=(this.value===''?undefined:Math.max(0,parseInt(this.value)||0));render();commit();};
      if($('#pEfGap'))$('#pEfGap').onchange=function(){w.efGap=(this.value===''?undefined:Math.max(0,parseInt(this.value)||0));render();commit();};
      if($('#pEfMaxCol'))$('#pEfMaxCol').onchange=function(){w.efMaxCol=(this.value===''?undefined:Math.max(0,parseInt(this.value)||0));render();commit();};
      if($('#pFlMode'))$('#pFlMode').onchange=function(){w.mode=this.value;render();renderProps();commit();};
      function b(id,prop,num){var e=$('#'+id);if(!e)return;e.oninput=e.onchange=function(){var v=num?(this.value===''?undefined:parseFloat(this.value)):(this.value||undefined);w[prop]=v;render();applyFlowState(w);commit();};}
      b('pFlCol','flPos');b('pFlColOff','flOff');b('pFlThr','flThr',1);b('pFlRef','flRef',1);b('pFlStartL','startLabel');b('pFlTankL','tankLabel');
      if($('#pFlTankV'))$('#pFlTankV').oninput=function(){w.tankVid=parseInt(this.value)||undefined;render();commit();};
      if($('#pFlDir'))$('#pFlDir').onchange=function(){w.flDir=this.value==='v'?'v':undefined;render();applyFlowState(w);commit();};
      if($('#pFlStart'))$('#pFlStart').onchange=function(){w.startArrow=this.checked||undefined;render();commit();};
      if($('#pFlTank'))$('#pFlTank').onchange=function(){w.endTank=this.checked||undefined;render();commit();};
      // energy: Home-Knoten-Felder
      if($('#pEfHN'))$('#pEfHN').oninput=function(){w.homeName=this.value||undefined;render();refreshEnergy(w);commit();};
      if($('#pEfHI'))$('#pEfHI').oninput=function(){w.homeIcon=this.value||undefined;render();refreshEnergy(w);commit();};
      if($('#pEfHC'))$('#pEfHC').oninput=function(){w.homeColor=this.value;render();refreshEnergy(w);commit();};
      if($('#pEfHV'))$('#pEfHV').oninput=function(){w.homeVid=parseInt(this.value)||undefined;render();refreshEnergy(w);commit();};
      if($('#pEfRef'))$('#pEfRef').oninput=function(){w.efRef=parseInt(this.value)||undefined;refreshEnergy(w);commit();};
    },
    mount:function(w){var m=_flowMode(w);if(m==='energy')refreshEnergy(w);else if(m!=='hub')applyFlowState(w);},
    live:function(w,el,id,d,base,txt,on){var m=_flowMode(w);if(m==='energy')refreshEnergy(w);else if(w.varId===id)applyFlowState(w);return true;}
  });
  WIDGETS.powerflow=WIDGETS.flow; // Alias: alte 'powerflow'-Instanzen weiter rendern (Migration setzt sie auf 'flow')
