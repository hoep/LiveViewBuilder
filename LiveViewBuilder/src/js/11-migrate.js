  // ===== Typ-Migration: zusammengelegte Widget-Familien =====
  // Mehrere frueher eigenstaendige Widgets sind zu Sammel-Typen mit einer Varianten-
  // Eigenschaft verschmolzen (Farbwaehler -> colorpick/cmode, Regler -> slider/rmode,
  // Sparkline+Wasserfall -> chart/ctype). Gespeicherte Layouts enthalten aber weiterhin
  // die ALTEN Typnamen; ohne Registry-Eintrag wuerden diese Widgets beim Laden
  // kommentarlos verschwinden. Diese Schicht schreibt sie beim Laden still um.
  //
  // Eigenschaften:
  //   - still: kein Toast, kein Log-Rauschen (nur console.debug, wenn wirklich etwas passiert)
  //   - idempotent: ein bereits migriertes Widget traegt keinen Alt-Typ mehr; die
  //     Varianten-Eigenschaft wird nur gesetzt, wenn sie noch fehlt
  //   - vollstaendig: erfasst store.views (inkl. Popup-Ansichten), store.chrome (Leisten),
  //     store.blocks (Bausteine) und jede weitere verschachtelte widgets-Liste

  var MIG_TYPES={
    // --- Farbwaehler-Familie -> colorpick (Variante in w.cmode) ---
    colorwheel : {type:'colorpick', key:'cmode', val:'wheel'},
    cie        : {type:'colorpick', key:'cmode', val:'cie'},
    rgbslider  : {type:'colorpick', key:'cmode', val:'slider'},
    rgbbutton  : {type:'colorpick', key:'cmode', val:'button'},
    rgbbox     : {type:'colorpick', key:'cmode', val:'box'},
    // --- Regler-Familie -> slider (Variante in w.rmode) ---
    rangeslider: {type:'slider', key:'rmode', val:'range'},
    circlerange: {type:'slider', key:'rmode', val:'circle'},
    rangebtn   : {type:'slider', key:'rmode', val:'stepper'},
    dial       : {type:'slider', key:'rmode', val:'dial'},
    // --- Chart-Verwandte -> chart (Variante in w.ctype) ---
    spark      : {type:'chart', key:'ctype', val:'spark'},
    waterfall  : {type:'chart', key:'ctype', val:'waterfall'},
    // --- Altlast frueherer Versionen ---
    powerflow  : {type:'flow'},
    vacuum     : {type:'bot'}   // umbenannt: Saug-/Maehroboter -> generischer Roboter
  };
  var MIG_MAXD=12; // Sicherheitsnetz gegen zu tiefe/zyklische Strukturen

  function migIsArr(o){return Object.prototype.toString.call(o)==='[object Array]';}

  // ---- Extrema -> Markenliste -------------------------------------------------------
  // Frueher markierte w.extrema fest Min UND Max an einer Reihe, in einem Stil. Marken sind
  // jetzt eine Liste gleichberechtigter Eintraege. Wer die alte Einstellung hatte, bekommt
  // daraus zwei Eintraege - Aussehen und Verhalten bleiben unveraendert.
  // Idempotent: greift nur, solange w.extrema ueberhaupt noch gesetzt ist.
  function migAnns(w){
    if(!w||!w.extrema||w.anns)return 0;
    var ser=Math.max(1,parseInt(w.exSer)||1),u=(w.exUnit!=null?w.exUnit:''),
        st=(w.exLine===false)?'pin':'both';
    w.anns=[{kind:'max',ser:ser,style:st,color:'crit',unit:u},
            {kind:'min',ser:ser,style:st,color:'accent',unit:u}];
    delete w.extrema;delete w.exSer;delete w.exUnit;delete w.exLine;
    return 1;
  }

  /** Ein einzelnes Widget umschreiben. Liefert 1, wenn etwas umgeschrieben wurde. */
  function migWidget(w){
    if(!w||typeof w!=='object')return 0;
    var n=migAnns(w);                        // Eigenschafts-Migration, unabhaengig vom Typ
    var m=MIG_TYPES[w.type];if(!m)return n;
    w.type=m.type;
    if(m.key&&w[m.key]==null)w[m.key]=m.val; // vorhandene Variante nie ueberschreiben
    return 1;
  }

  /** Alle widgets-Listen unterhalb von o finden und migrieren (Ansichten, Leisten, Bausteine, Verschachtelungen). */
  function migSweep(o,depth){
    if(!o||typeof o!=='object'||depth>MIG_MAXD)return 0;
    var n=0,i,k,v;
    if(migIsArr(o)){for(i=0;i<o.length;i++)n+=migSweep(o[i],depth+1);return n;}
    for(k in o){
      if(!Object.prototype.hasOwnProperty.call(o,k))continue;
      v=o[k];if(!v||typeof v!=='object')continue;
      if(k==='widgets'&&migIsArr(v)){for(i=0;i<v.length;i++)n+=migWidget(v[i]);}
      n+=migSweep(v,depth+1);
    }
    return n;
  }

  /** Ganzen Store still migrieren — muss VOR dem ersten Rendern laufen. */
  function migrateStore(st){
    if(!st||typeof st!=='object')return 0;
    var n=0;
    try{n=migSweep(st,0);}catch(e){try{console.debug('LVB-Migration abgebrochen:',e);}catch(_){}return 0;}
    if(n){try{console.debug('LVB: '+n+' Widget(s) auf zusammengelegte Typen migriert');}catch(_){}}
    // Leisten-Kinder in ihren eigenen ID-Namensraum ('c1','c2', …) bringen. Seiten-IDs sind nur
    // je Ansicht eindeutig; lagen beide im gleichen Namensraum, wurden Seiten-Widget und
    // Leisten-Kind gemeinsam ausgewaehlt und liessen sich nicht mehr sauber verschieben.
    try{if(typeof chromeFixIds==='function'){var f=chromeFixIds();
      if(f)try{console.debug('LVB: '+f+' Leisten-Kind(er) auf eigenen ID-Namensraum umgestellt');}catch(_){}}
    }catch(e){}
    return n;
  }
