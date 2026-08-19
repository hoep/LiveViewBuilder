  // ===== Widget: Wertkarte (valuecard) — generische Karte, unabhaengige Merkmale =====
  //  Slots: Icon/Titel (oben-links) · Toggle ODER Badge (oben-rechts) · Grosswert+Einheit
  //         · Caption (=Label) · Bereichs-Leiste (Min/Max) · Fortschrittsbalken · Auswahl-Knoepfe
  //  Die Merkmale sind UNABHAENGIG kombinierbar (Dosier-Karte = Toggle + Balken, Filterzeit = Akzent + Balken + Badge):
  //    varId  = Hauptwert · varId2 = Toggle (oder Akzent bei v2acc, oder Minimum bei rngOn) · varId3 = Balken/Maximum
  //    rngOn  = Bereichsmodus (Var2=Min, Var3=Max) · barOn = Fortschrittsbalken · okMin/okMax = Zielbereich-Badge
  //    vcMode='select' = Auswahl-Modus: Profil-Zuordnungen von Var1 als schaltbare Knoepfe (ersetzt Toggle/Badge/Balken)
  //  „Darstellung" in den Eigenschaften ist nur ein Schnell-Preset, das diese Flags setzt.
  // ---- Norm-Skalen fuer Wasserwerte: Wert -> Farbton (kontinuierlich interpoliert) ----
  //  pH: spektral aus Phenol-Rot abgeleitet (gelb-orange niedrig -> rot-orange ~7,4 ideal -> rosa/violett hoch).
  //  Redox/Chlor: kein kolorimetrischer Standard -> Amber->Orange-Skala entlang der mV-Bereiche (Desinfektion 650-750 mV).
  //  Toene 1:1 aus der ProCon.IP-Elektroden-Anzeige (ColorTable() im topleft.htm) uebernommen:
  //  pH-Balken  ColorTable(high=0xEB994E orange, low=0xFAFEA3 blassgelb), Schwellen 7,8/7,6/7,38/7,18/7,0/6,8
  //  Cl/Redox   ColorTable(high=0xF09FDF pink,   low=0xF7E9F4 blassrosa), mV-Schwellen aus dem Geraet (RDX=815,800,790,755,740,720)
  var VC_SCALES={
    ph:{name:'pH (Pool-Elektrode)', unit:'pH',
      desc:'Wie der ProCon-pH-Balken: blassgelb (niedrig) → orange (hoch). Bereich 6,8–7,8.',
      stops:[{v:6.8,c:'#fafea3'},{v:7.0,c:'#f7e992'},{v:7.18,c:'#f4d581'},{v:7.38,c:'#f1c170'},{v:7.6,c:'#eead5f'},{v:7.8,c:'#eb994e'}]},
    redox:{name:'Redox / Chlor (Pool-Elektrode)', unit:'mV',
      desc:'Wie der ProCon-Redox/Cl-Balken: blassrosa (niedrig) → kräftiges Pink (hoch). mV-Schwellen aus der DPD-Kalibrierung 720–815 mV.',
      stops:[{v:720,c:'#f7e9f4'},{v:740,c:'#f5daef'},{v:755,c:'#f4cbeb'},{v:790,c:'#f2bce7'},{v:800,c:'#f1ade3'},{v:815,c:'#f09fdf'}]},
    // Hitzestress nach FEUCHTKUGELTEMPERATUR. Die Grenzen sind keine Geschmacksfrage,
    // sondern Orientierungswerte aus der Hitzestress-Forschung: ab etwa 35 °C Feuchtkugel
    // kann sich der Koerper nicht mehr durch Schwitzen kuehlen, weil die Luft keinen
    // Schweiss mehr aufnimmt. Die Stufen sind hart (kein Verlauf INNERHALB einer Zone),
    // deshalb steht an jeder Grenze zweimal dieselbe Marke - sonst waere zwischen "Vorsicht"
    // und "Gefahr" eine Mischfarbe, die es als Aussage nicht gibt.
    feuchtkugel:{name:'Feuchtkugel · Hitzestress', unit:'°C',
      desc:'Fünf Gefahrenzonen: unter 25 unkritisch, 25–28 Vorsicht, 28–32 Gefahr, 32–35 extreme Gefahr, ab 35 tödlich.',
      stops:[{v:18,c:'#22c55e'},{v:25,c:'#22c55e'},{v:25.01,c:'#eab308'},{v:28,c:'#eab308'},
             {v:28.01,c:'#f97316'},{v:32,c:'#f97316'},{v:32.01,c:'#ef4444'},{v:35,c:'#ef4444'},
             {v:35.01,c:'#991b1b'},{v:40,c:'#991b1b'}],
      ticks:[25,28,32,35],
      zonen:[{bis:25,name:'Unkritisch',info:'Schweiß kühlt wirksam'},
             {bis:28,name:'Vorsicht',info:'Kühlreserve eingeschränkt'},
             {bis:32,name:'Gefahr',info:'nur leichte Tätigkeit'},
             {bis:35,name:'Extreme Gefahr',info:'Ruhe, Schatten, Kühlung'},
             {bis:null,name:'Tödlich',info:'Kühlung durch Schwitzen unmöglich'}]}
  };
  /** Zone zu einem Wert (oder null, wenn die Skala keine Zonen kennt). */
  function _vcZone(key,val){var sc=(typeof key==='string')?VC_SCALES[key]:key;if(!sc||!sc.zonen||isNaN(val))return null;
    for(var i=0;i<sc.zonen.length;i++){var z=sc.zonen[i];if(z.bis==null||val<z.bis)return z;}
    return sc.zonen[sc.zonen.length-1];}
  /** Skalenmarken als Prozentpositionen (fuer die Striche unter dem Balken). */
  function _vcTicks(key){var sc=(typeof key==='string')?VC_SCALES[key]:key;if(!sc||!sc.ticks)return [];
    var a=sc.stops[0].v,b=sc.stops[sc.stops.length-1].v;
    return sc.ticks.map(function(t){return {v:t,p:Math.max(0,Math.min(100,(t-a)/((b-a)||1)*100))};});}
  /**
   * Die GUELTIGE Skala eines Widgets - eingebaut oder selbst gebaut.
   *
   * Alles unten rechnet ab jetzt mit dem Ergebnis dieser Funktion statt mit einem
   * Katalogschluessel. Dadurch ist eine eigene Skala kein Sonderfall, sondern gleichwertig:
   * Farbe des Grosswerts, Verlauf, Zeiger, Marken und Zonenzeile entstehen fuer beide auf
   * demselben Weg.
   *
   * Eigene Skala (w.vcScale === 'eigen'): w.vcZonen ist eine Liste von Zeilen
   *   {ab, farbe, name, info} - "ab diesem Wert gilt". Die erste Zeile hat kein 'ab',
   * sie gilt vom Anfang der Skala an. Anfang und Ende kommen aus w.vcVon / w.vcBis.
   */
  function _vcDef(w){
    if(!w||!w.vcScale)return null;
    if(w.vcScale!=='eigen')return VC_SCALES[w.vcScale]||null;
    var z=(w.vcZonen||[]).map(function(r){
      return {ab:(r.ab===''||r.ab==null)?null:parseFloat(String(r.ab).replace(',','.')),
              c:String(r.farbe||'#22c55e'),name:String(r.name||''),info:String(r.info||'')};
    }).filter(function(r){return r.c;});
    if(!z.length)return null;
    // Erste Zeile gilt immer ab Skalenanfang, egal was dort steht.
    var von=parseFloat(String(w.vcVon!=null?w.vcVon:'').replace(',','.'));
    var bis=parseFloat(String(w.vcBis!=null?w.vcBis:'').replace(',','.'));
    if(isNaN(von))von=(z[1]&&z[1].ab!=null)?z[1].ab-10:0;
    if(isNaN(bis))bis=(z[z.length-1].ab!=null)?z[z.length-1].ab+10:100;
    if(bis<=von)bis=von+1;
    z[0].ab=von;
    var stops=[],ticks=[],zonen=[];
    for(var i=0;i<z.length;i++){
      var a0=(z[i].ab==null?von:z[i].ab), a1=(i+1<z.length&&z[i+1].ab!=null)?z[i+1].ab:bis;
      if(w.vcWeich){
        stops.push({v:a0,c:z[i].c});                 // weich: nur Stuetzstellen, dazwischen Verlauf
      }else{
        stops.push({v:a0,c:z[i].c});                 // hart: Farbe bis zur Grenze halten,
        stops.push({v:Math.max(a0,a1-0.0001),c:z[i].c}); // dann springt die naechste Zeile
      }
      if(i>0&&z[i].ab!=null)ticks.push(z[i].ab);
      zonen.push({bis:(i+1<z.length&&z[i+1].ab!=null)?z[i+1].ab:null,name:z[i].name,info:z[i].info});
    }
    if(stops[stops.length-1].v<bis)stops.push({v:bis,c:z[z.length-1].c});
    return {name:'Eigene Skala',unit:'',desc:'',stops:stops,ticks:ticks,zonen:zonen};
  }
  function _vcScaleColor(key,val){var sc=(typeof key==='string')?VC_SCALES[key]:key;if(!sc||isNaN(val))return '';var st=sc.stops,n=st.length;
    if(val<=st[0].v)return st[0].c;if(val>=st[n-1].v)return st[n-1].c;
    for(var i=0;i<n-1;i++){if(val>=st[i].v&&val<=st[i+1].v)return _lerpHex(st[i].c,st[i+1].c,(val-st[i].v)/((st[i+1].v-st[i].v)||1));}
    return st[n-1].c;}
  function _vcScaleGrad(key){var sc=(typeof key==='string')?VC_SCALES[key]:key;if(!sc)return '';var st=sc.stops,a=st[0].v,b=st[st.length-1].v;
    return 'linear-gradient(90deg,'+st.map(function(o){return o.c+' '+((o.v-a)/((b-a)||1)*100).toFixed(1)+'%';}).join(',')+')';}
  function _vcScalePct(key,val){var sc=(typeof key==='string')?VC_SCALES[key]:key;if(!sc||isNaN(val))return null;var a=sc.stops[0].v,b=sc.stops[sc.stops.length-1].v;return Math.max(0,Math.min(100,(val-a)/((b-a)||1)*100));}
  function _vcNorm(x){var s=String(x==null?'':x).toLowerCase().trim();if(s==='true'||s==='on')return '1';if(s==='false'||s==='off')return '0';return s;}
  function _vcSel(w){return w.vcMode==='select';}
  function _vcMode(w){ // abgeleiteter Modus (nur fuer die „Darstellung"-Vorauswahl in den Eigenschaften)
    if(w.vcMode)return w.vcMode;
    if(w.rngOn)return 'range';
    if(w.barOn)return 'bar';
    if(w.okMin!=null||w.okMax!=null)return 'target';
    if(w.varId2&&!w.v2acc)return 'toggle';
    return 'value';
  }
  function _vcState(w,el){ // Farbe nach Zustand: Var2 (Status) bevorzugt, sonst Hauptwert; true/false -> 1/0
    if(!(w.vassoc&&w.vassoc.length))return;
    var srcs=[w.varId2,w.varId],m=null,i;
    for(i=0;i<srcs.length&&!m;i++){if(!srcs[i]||!_lastVals[srcs[i]])continue;m=stateHit(w.vassoc,_lastVals[srcs[i]].v);}
    var v=$('[data-role=val]',el),c=(m&&m.color)?(_skinColor(m.color)||m.color):'';
    if(w.vaFill){el.classList.remove('vc-acc');
      if(c){var _t=stateTint(c);el.style.background=_t.bg;el.style.borderColor=_t.bd;if(v)v.style.color=_t.val;}
      else{el.style.background=w.bg||'';el.style.borderColor='';if(v)v.style.color='';}
    }else if(v)v.style.color=c;
  }
  // ---- Auswahl-Modus: Profil-Zuordnungen (?api=assoc) als Knoepfe, schaltet Var1 ----
  var _vcAssoc={}, _vcWait={};
  function _vcOpts(w){return w.varId?(_vcAssoc[w.varId]||null):[];}
  function _vcSelBody(w){
    var opts=_vcOpts(w);
    if(opts===null)return '<div class="hsel hvcsel"><button class="hselb">…</button></div>';
    if(!opts.length)return '<div class="hvcselempty">keine Auswahlwerte im Profil</div>';
    return '<div class="hsel hvcsel">'+opts.map(function(o){
      return '<button class="hselb" data-selval="'+esc(String(o.value!=null?o.value:''))+'"'+(o.color?' style="--sc:'+esc(o.color)+'"':'')+'>'+esc(o.text||String(o.value))+'</button>';
    }).join('')+'</div>';
  }
  function _vcSelMark(w,el,v){$$('.hvcsel .hselb',el).forEach(function(b){b.classList.toggle('on',String(b.getAttribute('data-selval'))===String(v));});}
  function _vcSelPaint(w,root){var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;var host=$('[data-role=vcselhost]',el);if(!host)return;host.innerHTML=_vcSelBody(w);var d=w.varId&&_lastVals[w.varId];if(d)_vcSelMark(w,el,d.v);}
  function _vcSelLoad(w,root){
    if(!w.varId)return;
    if(_vcAssoc[w.varId]){_vcSelPaint(w,root);return;}
    if(_vcWait[w.varId]){_vcWait[w.varId].push([w,root]);return;}
    _vcWait[w.varId]=[[w,root]];
    fetch('?api=assoc&id='+w.varId,{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){_vcAssoc[w.varId]=(j&&j.assocs||[]).map(function(a){return {value:a.v,text:a.name,color:a.color||''};});(_vcWait[w.varId]||[]).forEach(function(p){_vcSelPaint(p[0],p[1]);});delete _vcWait[w.varId];})
      .catch(function(){delete _vcWait[w.varId];});
  }
  // ---- Live-Vergleich gegen eine Soll-/Vergleichs-Variable (cmpVid): Pille mit Abweichung ----
  function _vcCmp(w,el){
    if(!w.cmpVid)return;
    var pill=$('[data-role=cmp]',el);if(!pill)return;
    var a=_lastVals[w.varId],b=_lastVals[w.cmpVid];
    var na=a?parseFloat(String(a.v).replace(',','.')):NaN,nb=b?parseFloat(String(b.v).replace(',','.')):NaN;
    if(isNaN(na)||isNaN(nb)){pill.className='hvcmuted';pill.innerHTML='–';return;}
    var diff=na-nb,mode=w.cmpMode||'pct';
    var metric=(mode==='abs')?diff:(nb!==0?diff/nb*100:0);
    var tol=(w.cmpTol!=null)?w.cmpTol:10;
    var arrow=diff>0?'▲ ':(diff<0?'▼ ':'→ ');
    var num=Math.round(((mode==='abs')?diff:metric)*10)/10;
    var txt=(num>0?'+':'')+num+(mode==='abs'?'':' %')+(w.cmpText?(' '+w.cmpText):'');
    pill.className='hpill '+(Math.abs(metric)<=tol?'ok':'warn');
    pill.innerHTML='<span class="hpd"></span>'+esc(arrow+txt);
  }
  defWidget('valuecard',{
    label:'Wertkarte', cat:'Anzeige', paletteIcon:'wkpi', size:[240,120],
    defaults:function(w){w.icon='home';w.label='Wert';w.unit='';w.badgeState='ok';},
    render:function(w){
      var isSel=_vcSel(w);
      var icon=w.icon?'<span class="hkbi">'+iconSVG(w.icon)+'</span>':'';
      var title=w.title?'<span class="hvctitle">'+escL(w.title)+'</span>':'';
      var tr='';
      // oben-rechts: Toggle (Var2, kein Akzent, kein Bereich) hat Vorrang; sonst Badge
      if(!isSel&&w.varId2&&!w.v2acc&&!w.rngOn){
        var onC=w.swOn?_cssColorOrEmpty(w.swOn):'',offC=w.swOff?_cssColorOrEmpty(w.swOff):'';
        var sty=(onC?('--sw-on:'+onC+';'):'')+(offC?('--sw-off:'+offC+';'):'');
        var knob='<i class="swk">'+(w.swOffIcon?'<span class="swi swi-off">'+iconSVG(w.swOffIcon)+'</span>':'')+(w.swOnIcon?'<span class="swi swi-on">'+iconSVG(w.swOnIcon)+'</span>':'')+'</i>';
        tr='<span class="sw" data-role="sw"'+(sty?(' style="'+sty+'"'):'')+'>'+knob+'</span>';
      }else if(!isSel&&w.cmpVid){
        tr='<span class="hpill ok" data-role="cmp"><span class="hpd"></span>…</span>';
      }else if(!isSel&&(w.badge||w.okMin!=null||w.okMax!=null)){
        var st=w.badgeState||'ok';
        if(st==='muted')tr='<span class="hvcmuted" data-role="badge">'+esc(w.badge||'')+'</span>';
        else tr='<span class="hpill '+esc(st)+'" data-role="badge"><span class="hpd"></span>'+esc(w.badge||'')+'</span>';
      }
      // Wunsch-Schriftgroesse ist eine OBERGRENZE, keine feste Zahl: min(..,22cqh) sorgt dafuer,
      // dass ein am Desktop gewaehlter Wert die geschrumpfte Kachel am Handy nicht sprengt.
      // Leeres valfs bleibt unveraendert bei var(--wf-val) aus styles.css.
      var val='<div class="hvcval"'+(w.valfs?' style="font-size:min('+(parseInt(w.valfs)||0)+'px,22cqh)"':'')+'><span data-role="val">–</span>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</div>';
      var cap=w.label?'<div class="hvccap">'+escL(w.label)+'</div>':'';
      var bar=(!isSel&&w.barOn)?('<div class="hvcbar"><div class="btrack"><i data-role="bar"></i></div>'+((w.barCap!=null&&w.barCap!=='')?'<div class="hvcbarcap" data-role="barcap">'+esc(w.barCap)+'</div>':'')+'</div>'):'';
      var rng=(!isSel&&w.rngOn)?('<div class="hvcrng"><span class="rmin" data-role="rmin">–</span><span class="rtrack"><i class="rdot" data-role="rdot"></i></span><span class="rmax" data-role="rmax">–</span></div>'):'';
      var sel=isSel?('<div class="hvcselhost" data-role="vcselhost">'+_vcSelBody(w)+'</div>'):'';
      var scl='';
      var _def=_vcDef(w);
      if(!isSel&&_def){
        var _tk=(w.scaleTicks===false)?[]:_vcTicks(_def);
        var _tkH=_tk.map(function(t){return '<u style="left:'+t.p.toFixed(2)+'%"></u>';}).join('');
        var _tkL=_tk.length?('<div class="hvcticks">'+_tk.map(function(t){
              return '<span style="left:'+t.p.toFixed(2)+'%">'+esc(String(t.v))+'</span>';}).join('')+'</div>'):'';
        var _zn=(_def.zonen&&_def.zonen.length&&w.scaleZone!==false)
              ?'<div class="hvczone" data-role="zone"><b></b><span></span></div>':'';
        scl='<div class="hvcscale" data-role="scale" style="background:'+_vcScaleGrad(_def)+'">'
            +_tkH+'<i class="sdot" data-role="sdot"></i></div>'+_tkL+_zn;
      }
      return '<div class="hvcard" data-role="card"><div class="hvctop"><div class="hvctl">'+icon+title+'</div>'+tr+'</div>'+val+cap+scl+rng+bar+sel+'</div>';
    },
    mount:function(w){if(_vcSel(w))_vcSelLoad(w);if(w.cmpVid){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_vcCmp(w,el);}},
    props:function(w){if(w.type!=='valuecard')return '';
      var vm=_vcMode(w);
      var MODES=[['value','Einfacher Wert'],['target','Zielbereich (Badge)'],['range','Bereich Min–Max'],['bar','Balken'],['toggle','Schalter'],['select','Auswahl (schaltbar)']];
      var s=row('Darstellung (Preset)','<select id="pVcMode">'+MODES.map(function(o){return '<option value="'+o[0]+'"'+(vm===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 7px">Setzt die passenden Optionen unten. Merkmale sind frei kombinierbar (z. B. Schalter + Balken).</div>'
        +row('Titel (oben-links)','<input id="pVcTitle" value="'+esc(w.title||'')+'" placeholder="statt/neben Icon">')
        +row('Einheit','<input id="pVcUnit" value="'+esc(w.unit||'')+'" style="width:100px">')
        +row('Wert-Größe (px)','<input id="pVcValFs" type="number" min="0" style="width:80px" value="'+(w.valfs||'')+'" placeholder="auto"> <span style="font-size:11px;color:var(--muted)">nur die große Zahl (leer = automatisch)</span>');
      if(_vcSel(w)){
        return s+'<div style="font-size:11px;color:var(--muted);margin:6px 2px 4px">Auswahl-Modus: Knöpfe kommen aus den Profil-Zuordnungen von <b>Var 1</b> (RequestAction bei schaltbarer Variable). Ersetzt Toggle/Badge/Balken.</div>'
          +'<div class="pgh">Farbe nach Zustand</div>'
          +listEditor(w,'vassoc','Zustand · Farbe',[{k:'v',ph:'z. B. 1'},{k:'color',type:'skincolor'}])
          +row('Ganze Kachel einfärben','<input type="checkbox" id="pVcVaFill"'+(w.vaFill?' checked':'')+'>');
      }
      // Bereichsmodus
      s+='<div class="pgh">Bereich Min/Max</div>'
        +row('Bereich zeigen','<input type="checkbox" id="pVcRng"'+(w.rngOn?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Var 2 = Min, Var 3 = Max</span>')
        +(w.rngOn?(row('Nachkommastellen (Min/Max)','<input id="pVcRngDec" type="number" min="0" max="6" style="width:60px" value="'+(w.rngDec!=null?w.rngDec:'')+'" placeholder="auto"> <span style="font-size:11px;color:var(--muted)">leer = wie Variable</span>')
          +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">Farbstufen der Leiste (Wert in der Einheit der Variable, z. B. 30 für 30 °C). Leer = Temperaturskala.</div>'
          +listEditor(w,'rngGrad','Farbstufen: Wert · Farbe',[{k:'v',ph:'Wert'},{k:'color',type:'skincolor'}])):'');
      // Norm-Skala (Farbe nach Wert) — z. B. pH / Redox der Poolwerte
      s+='<div class="pgh">Wert-Skala (Farbe nach Wert)</div>'
        +row('Skala','<select id="pVcScale"><option value="">— keine</option>'+Object.keys(VC_SCALES).map(function(k){return '<option value="'+k+'"'+(w.vcScale===k?' selected':'')+'>'+esc(VC_SCALES[k].name)+'</option>';}).join('')
            +'<option value="eigen"'+(w.vcScale==='eigen'?' selected':'')+'>Eigene Skala …</option></select>')
        +(w.vcScale==='eigen'?(
            '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Eine Zeile je Zone. '
           +'„ab" ist der Wert, ab dem die Zone gilt — die erste Zeile gilt ab dem Skalenanfang. '
           +'Name und Hinweis erscheinen unter der Leiste, die Striche sitzen auf den „ab"-Werten.</div>'
           +row('Skala von','<input id="pVcVon" type="number" step="any" value="'+(w.vcVon!=null?esc(String(w.vcVon)):'')+'" placeholder="Anfang">')
           +row('Skala bis','<input id="pVcBis" type="number" step="any" value="'+(w.vcBis!=null?esc(String(w.vcBis)):'')+'" placeholder="Ende">')
           +row('Weicher Übergang','<input type="checkbox" id="pVcWeich"'+(w.vcWeich?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Farben ineinander blenden statt an der Grenze springen</span>')
           +listEditor(w,'vcZonen','Zonen',[
                {k:'ab',   ph:'ab',      h:'ab'},
                {k:'farbe',ph:'Farbe',   h:'Farbe', type:'color'},
                {k:'name', ph:'Name',    h:'Name'},
                {k:'info', ph:'Hinweis', h:'Hinweis'}])
           +'<div class="prop"><button class="btn" id="pVcCopy">Eingebaute Skala übernehmen …</button>'
           +'<select id="pVcCopySrc" style="margin-left:6px">'+Object.keys(VC_SCALES).map(function(k){
                return '<option value="'+k+'">'+esc(VC_SCALES[k].name)+'</option>';}).join('')+'</select></div>'
        ):'')
        +(w.vcScale?('<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">'+esc((VC_SCALES[w.vcScale]||{}).desc||'')+' Färbt den Großwert und zeigt eine Skalen-Leiste mit Marker.</div>'
          +row('Ganze Kachel einfärben','<input type="checkbox" id="pVcScaleFill"'+(w.scaleFill?' checked':'')+'>')):'');
      // Badge / Zielbereich (nur ohne Bereichsmodus sinnvoll)
      if(!w.rngOn){
        s+='<div class="pgh">Badge (oben-rechts)</div>'
          +row('Text','<input id="pVcBadge" value="'+esc(w.badge||'')+'" placeholder="OPTIMAL / Filtert / Soll 27,0">')
          +row('Zustand','<select id="pVcBst">'
            +['muted|grau (nur Text)','ok|OK (grün)','warm|Aktiv (orange)','warn|Warnung (gelb)','crit|Kritisch (rot)','on|Akzent'].map(function(o){var p=o.split('|');return '<option value="'+p[0]+'"'+((w.badgeState||'ok')===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join('')+'</select>')
          +row('Auto aus Zielbereich','<input id="pVcOkMin" type="number" step="0.1" style="width:74px" value="'+(w.okMin!=null?w.okMin:'')+'" placeholder="min"> <input id="pVcOkMax" type="number" step="0.1" style="width:74px" value="'+(w.okMax!=null?w.okMax:'')+'" placeholder="max">')
          +((w.okMin!=null||w.okMax!=null)?row('Badge im/außer Bereich','<input id="pVcOkT" value="'+esc(w.okText||'OPTIMAL')+'" style="width:90px"> <input id="pVcBadT" value="'+esc(w.badText||'PRÜFEN')+'" style="width:90px">'):'');
      }
      // Vergleich / Soll (live Abweichung als Pille oben-rechts)
      s+='<div class="pgh">Vergleich / Soll (Abweichung)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Hauptwert = Ist (Var 1). Zeigt die Abweichung zur Soll-Variable als gefärbte Pille. Belegt den Platz oben-rechts (statt Badge).</div>'
        +fieldPick(w,'cmpVid','Soll-Variable')
        +(w.cmpVid?(row('Modus','<select id="pVcCmpMode"><option value="pct"'+((w.cmpMode||'pct')==='pct'?' selected':'')+'>Prozent</option><option value="abs"'+(w.cmpMode==='abs'?' selected':'')+'>Absolut</option></select>')
          +row('Toleranz grün','<input id="pVcCmpTol" type="number" step="0.1" style="width:74px" value="'+(w.cmpTol!=null?w.cmpTol:10)+'"> <span style="font-size:11px;color:var(--muted)">'+(w.cmpMode==='abs'?'in Einheit':'%')+'</span>')
          +row('Zusatztext','<input id="pVcCmpText" value="'+esc(w.cmpText||'')+'" placeholder="ggü. Plan">')):'');
      // Toggle / Akzent (Var2)
      s+='<div class="pgh">Schalter / Akzent (Var 2)</div>'
        +row('Var 2 = Akzent','<input type="checkbox" id="pVcV2acc"'+(w.v2acc?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Kachel leuchtet auf (statt Schalter)</span>');
      if(w.varId2&&!w.v2acc&&!w.rngOn){
        s+=row('Ein-Farbe',skinSel(w.swOn||'','id="pVcSwOn"'))
          +row('Aus-Farbe',skinSel(w.swOff||'','id="pVcSwOff"'))
          +row('Ein-Icon','<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.swOnIcon?iconSVG(w.swOnIcon):'')+'</span> <button class="btn" id="pVcSwOnIco" style="padding:5px 8px">wählen</button>'+(w.swOnIcon?' <button class="btn" id="pVcSwOnIcoX" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''))
          +row('Aus-Icon','<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.swOffIcon?iconSVG(w.swOffIcon):'')+'</span> <button class="btn" id="pVcSwOffIco" style="padding:5px 8px">wählen</button>'+(w.swOffIcon?' <button class="btn" id="pVcSwOffIcoX" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''));
      }
      // Fortschrittsbalken
      s+='<div class="pgh">Fortschrittsbalken</div>'
        +row('Balken zeigen','<input type="checkbox" id="pVcBarOn"'+(w.barOn?' checked':'')+'>')
        +(w.barOn?('<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Quelle = Balken-Var (Var 3), sonst Hauptwert.'+(w.varId3?'':' <span style="color:var(--warm)">— keine Balken-Var gesetzt.</span>')+'</div>'
          +row('Balken min/max','<input id="pVcBarMin" type="number" style="width:74px" value="'+(w.barMin!=null?w.barMin:0)+'"> <input id="pVcBarMax" type="number" style="width:74px" value="'+(w.barMax!=null?w.barMax:100)+'">')
          +row('Text rechts','<input id="pVcBarCap" value="'+esc(w.barCap||'')+'" placeholder="z. B. 81 % Kanister">')):'');
      // Farbe nach Zustand + Kachel füllen
      s+='<div class="pgh">Farbe nach Zustand</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Quelle: Var 2 (Status), sonst Hauptwert. true/false = 1/0.'+(w.vaFill&&w.v2acc?' <span style="color:var(--warm)">— „Var 2 = Akzent" deaktivieren, sonst überlagern!</span>':'')+'</div>'
        +listEditor(w,'vassoc','Zustand · Farbe',[{k:'v',ph:'z. B. 1 / true'},{k:'color',type:'skincolor'}])
        +row('Ganze Kachel einfärben','<input type="checkbox" id="pVcVaFill"'+(w.vaFill?' checked':'')+'>');
      return s;
    },
    wire:function(w){
      if($('#pVcMode'))$('#pVcMode').onchange=function(){var m=this.value; // Preset: passende Flags setzen (Merkmale bleiben frei kombinierbar)
        w.vcMode=(m==='select')?'select':undefined;
        if(m==='range'){w.rngOn=true;w.barOn=undefined;}
        else if(m==='bar'){w.barOn=true;w.rngOn=undefined;}
        else if(m==='value'){w.rngOn=undefined;w.barOn=undefined;w.okMin=undefined;w.okMax=undefined;}
        else if(m==='target'){w.rngOn=undefined;}
        else if(m==='toggle'){w.rngOn=undefined;}
        render();renderProps();commit();};
      function bind(id,prop,num){var e=$('#'+id);if(!e)return;e.oninput=e.onchange=function(){var v=num?(this.value===''?undefined:parseFloat(this.value)):(this.value||undefined);w[prop]=v;render();};}
      bind('pVcTitle','title');bind('pVcUnit','unit');bind('pVcValFs','valfs',1);bind('pVcBadge','badge');bind('pVcBarCap','barCap');bind('pVcOkT','okText');bind('pVcBadT','badText');
      bind('pVcOkMin','okMin',1);bind('pVcOkMax','okMax',1);bind('pVcBarMin','barMin',1);bind('pVcBarMax','barMax',1);
      bind('pVcCmpText','cmpText');bind('pVcCmpTol','cmpTol',1);
      if($('#pVcCmpMode'))$('#pVcCmpMode').onchange=function(){w.cmpMode=this.value;render();renderProps();commit();};
      if($('#pVcBst'))$('#pVcBst').onchange=function(){w.badgeState=this.value;render();};
      if($('#pVcRng'))$('#pVcRng').onchange=function(){w.rngOn=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcBarOn'))$('#pVcBarOn').onchange=function(){w.barOn=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcV2acc'))$('#pVcV2acc').onchange=function(){w.v2acc=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcSwOn'))$('#pVcSwOn').onchange=function(){w.swOn=this.value||undefined;render();renderProps();commit();};
      if($('#pVcSwOff'))$('#pVcSwOff').onchange=function(){w.swOff=this.value||undefined;render();renderProps();commit();};
      if($('#pVcSwOnIco'))$('#pVcSwOnIco').onclick=function(){_iconPick={wid:w.id,field:'swOnIcon'};showTab('icons');toast('Ein-Icon wählen');};
      if($('#pVcSwOnIcoX'))$('#pVcSwOnIcoX').onclick=function(){delete w.swOnIcon;render();renderProps();commit();};
      if($('#pVcSwOffIco'))$('#pVcSwOffIco').onclick=function(){_iconPick={wid:w.id,field:'swOffIcon'};showTab('icons');toast('Aus-Icon wählen');};
      if($('#pVcSwOffIcoX'))$('#pVcSwOffIcoX').onclick=function(){delete w.swOffIcon;render();renderProps();commit();};
      if($('#pVcVaFill'))$('#pVcVaFill').onchange=function(){w.vaFill=this.checked||undefined;render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();};
      if($('#pVcScale'))$('#pVcScale').onchange=function(){w.vcScale=this.value||undefined;if(!w.vcScale)w.scaleFill=undefined;render();renderProps();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();};
      // Eigene Skala: Felder, Liste und das Uebernehmen einer eingebauten Vorlage.
      function _vcFrisch(){render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();}
      if($('#pVcVon'))$('#pVcVon').onchange=function(){w.vcVon=this.value===''?undefined:parseFloat(this.value);_vcFrisch();};
      if($('#pVcBis'))$('#pVcBis').onchange=function(){w.vcBis=this.value===''?undefined:parseFloat(this.value);_vcFrisch();};
      if($('#pVcWeich'))$('#pVcWeich').onchange=function(){w.vcWeich=this.checked?true:undefined;_vcFrisch();};
      if($('#pVcCopy'))$('#pVcCopy').onclick=function(){
        var q=VC_SCALES[($('#pVcCopySrc')||{}).value||''];
        if(!q){toast('Keine Vorlage gewählt');return;}
        // Aus dem Katalogeintrag Zeilen machen: bevorzugt aus den Zonen (die tragen Namen),
        // sonst aus den Farbstuetzstellen. So faengt niemand bei null an.
        if(q.zonen&&q.zonen.length){
          var vor=q.stops[0].v,zn=[];
          q.zonen.forEach(function(z,i){
            zn.push({ab:(i===0?'':String(vor)),farbe:_vcScaleColor(q,(vor+ (z.bis!=null?z.bis:q.stops[q.stops.length-1].v))/2),
                     name:z.name||'',info:z.info||''});
            if(z.bis!=null)vor=z.bis;
          });
          // 'ab' je Zeile ist die UNTERE Grenze der Zone
          var unten=q.stops[0].v;
          q.zonen.forEach(function(z,i){ zn[i].ab=(i===0?'':String(unten)); if(z.bis!=null)unten=z.bis; });
          w.vcZonen=zn;
        }else{
          w.vcZonen=q.stops.map(function(st,i){return {ab:(i===0?'':String(st.v)),farbe:st.c,name:'',info:''};});
        }
        w.vcVon=q.stops[0].v; w.vcBis=q.stops[q.stops.length-1].v;
        w.vcWeich=(q.zonen&&q.zonen.length)?undefined:true;
        renderProps();_vcFrisch();
      };
      if($('#pVcScaleFill'))$('#pVcScaleFill').onchange=function(){w.scaleFill=this.checked||undefined;render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();};
      if($('#pVcRngDec'))$('#pVcRngDec').oninput=function(){w.rngDec=(this.value===''?undefined:Math.max(0,Math.min(6,parseInt(this.value)||0)));render();[w.varId,w.varId2,w.varId3].forEach(function(id){if(id&&_lastVals[id])applyVal(id,_lastVals[id]);});commit();};
      if($('#pVcOkMin')||$('#pVcOkMax')){['#pVcOkMin','#pVcOkMax'].forEach(function(sq){if($(sq))$(sq).addEventListener('change',function(){renderProps();});});}
    },
    click:function(w,el,e){
      if(_vcSel(w)){var b=e.target.closest('.hvcsel .hselb');if(b){var sv=b.getAttribute('data-selval');setVar(w.varId,sv);_vcSelMark(w,el,sv);}return true;}
      if(w.varId2&&!w.v2acc&&!w.rngOn){var sw=$('[data-role=sw]',el);if(sw){var on=!sw.classList.contains('on');sw.classList.toggle('on',on);setVar(w.varId2,on?1:0);}return true;}
      return false;
    },
    live:function(w,el,id,d,base,txt,on){
      if(_vcSel(w)){if(w.varId===id){var vs=$('[data-role=val]',el);if(vs)vs.textContent=txt;_vcSelMark(w,el,d.v);}_vcState(w,el);return true;}
      if(w.rngOn&&(id===w.varId||id===w.varId2||id===w.varId3)){
        var _n=function(vid){var lv=vid&&_lastVals[vid];if(!lv)return null;var q=parseFloat(String(lv.v).replace(',','.'));return isNaN(q)?null:q;};
        var _t=function(vid){var lv=vid&&_lastVals[vid];if(!lv)return '–';
          if(w.rngDec!=null&&w.rngDec!==''){var q=parseFloat(String(lv.v).replace(',','.'));if(!isNaN(q))return q.toFixed(Math.max(0,Math.min(6,w.rngDec|0))).replace('.',',');}
          return (lv.f!=null&&lv.f!=='')?lv.f:String(lv.v);};
        var cu=_n(w.varId),mi=_n(w.varId2),ma=_n(w.varId3);
        var eMin=$('[data-role=rmin]',el),eMax=$('[data-role=rmax]',el),dot=$('[data-role=rdot]',el);
        if(eMin)eMin.textContent=_t(w.varId2);if(eMax)eMax.textContent=_t(w.varId3);
        if(dot){var p=(cu!=null&&mi!=null&&ma!=null&&ma>mi)?((cu-mi)/(ma-mi)*100):null;dot.style.display=(p==null)?'none':'';if(p!=null)dot.style.left=Math.max(0,Math.min(100,p))+'%';}
        var trk=$('.rtrack',el);
        if(trk){var gs=(w.rngGrad||[]).map(function(g){var c=_cssColorOrEmpty(g.color);if(!c)return null;var gv=parseFloat(String(g.v==null?g.p:g.v).replace(',','.'));return {c:c,v:isNaN(gv)?null:gv};}).filter(Boolean);
          if(gs.length&&mi!=null&&ma!=null&&ma>mi){gs.forEach(function(o,i){o.p=(o.v==null)?Math.round(i/Math.max(1,gs.length-1)*100):Math.max(0,Math.min(100,(o.v-mi)/(ma-mi)*100));});gs.sort(function(x,y){return x.p-y.p;});
            trk.style.background=(gs.length===1)?('linear-gradient(90deg,color-mix(in oklab,'+gs[0].c+' 14%,transparent) 0%,color-mix(in oklab,'+gs[0].c+' 55%,transparent) 55%,'+gs[0].c+' 100%)'):('linear-gradient(90deg,'+gs.map(function(o){return o.c+' '+o.p.toFixed(1)+'%';}).join(',')+')');
          }else if(!gs.length){trk.style.background='';}}
      }
      if(w.varId===id){
        // Wert OHNE Einheit anzeigen — die Einheit steht separat im <small> (aus dem Profil
        // vorausgefüllt). Falls die Profil-Einheit doch noch am Wert klebt (z. B. Server
        // liefert kein d.u), hier hart abschneiden, damit sie nicht doppelt erscheint.
        var v=$('[data-role=val]',el);
        if(v){var vt=txt,uu=(w.unit||'').trim();if(uu){var st=String(vt).trim();if(st.length>=uu.length&&st.slice(-uu.length)===uu)vt=st.slice(0,-uu.length).replace(/\s+$/,'');}v.textContent=vt;}
        var _dfl=_vcDef(w);
        if(_dfl){var _sv=parseFloat(String(d.v).replace(',','.')),_scol=_vcScaleColor(_dfl,_sv);
          if(v&&_scol)v.style.color=_scol;
          if(w.scaleFill&&_scol){var _st2=stateTint(_scol);el.style.background=_st2.bg;el.style.borderColor=_st2.bd;}
          var _sd=$('[data-role=sdot]',el),_sp=_vcScalePct(_dfl,_sv);if(_sd&&_sp!=null)_sd.style.left=_sp+'%';
          var _zEl=$('[data-role=zone]',el),_z=_vcZone(_dfl,_sv);
          if(_zEl&&_z){_zEl.querySelector('b').textContent=_z.name;
                       _zEl.querySelector('span').textContent=_z.info||'';
                       if(_scol)_zEl.querySelector('b').style.color=_scol;}}
        if(w.okMin!=null||w.okMax!=null){var nv=parseFloat(String(d.v).replace(',','.'));var bd=$('[data-role=badge]',el);if(bd&&!isNaN(nv)){var okv=(w.okMin==null||nv>=w.okMin)&&(w.okMax==null||nv<=w.okMax);bd.className='hpill '+(okv?'ok':'warn');bd.innerHTML='<span class="hpd"></span>'+esc(okv?(w.okText||'OPTIMAL'):(w.badText||'PRÜFEN'));}}
        if(w.barOn&&!w.varId3){var mn=(w.barMin!=null?w.barMin:0),mx=(w.barMax!=null?w.barMax:100),nb=parseFloat(String(d.v).replace(',','.')),bar=$('[data-role=bar]',el);if(bar&&!isNaN(nb))bar.style.width=Math.max(0,Math.min(100,((nb-mn)/((mx-mn)||1))*100))+'%';}
      }
      if(w.varId2===id){if(w.v2acc){el.classList.toggle('vc-acc',on);}else if(!w.rngOn){var sw=$('[data-role=sw]',el);if(sw)sw.classList.toggle('on',on);}}
      if(w.varId3===id&&w.barOn){var mn3=(w.barMin!=null?w.barMin:0),mx3=(w.barMax!=null?w.barMax:100),nb3=parseFloat(String(d.v).replace(',','.')),bar3=$('[data-role=bar]',el);if(bar3&&!isNaN(nb3))bar3.style.width=Math.max(0,Math.min(100,((nb3-mn3)/((mx3-mn3)||1))*100))+'%';}
      if(w.cmpVid&&(id===w.varId||id===w.cmpVid))_vcCmp(w,el);
      _vcState(w,el);
      return true;
    }
  });
