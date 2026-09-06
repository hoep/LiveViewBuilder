  // ===== Widget: Schimmelwaechter (moldmap) =====
  //
  // Zwillingskachel zum Fenster-Raster (iconarray) - gedacht als dessen
  // Lang-Druck-Ziel: erst sieht man, welche Fenster offen stehen, dann welche
  // Raeume feucht sind und wo Oeffnen ueberhaupt etwas bringt.
  //
  // Drei Betriebsarten auf denselben Daten, weil dieselbe Frage drei Groessen
  // hat:
  //   karte  - Waermebild des Hauses. Name, Wandfeuchte, Wandtemperatur je Raum,
  //            nach Geschoss gruppiert. Zeigt Abstufungen, die ein Icon-Raster
  //            wegwirft.
  //   ampel  - was JETZT zu tun ist. Sortiert nach Befund, Balken = wie viel
  //            Feuchte das Oeffnen abfuehren wuerde.
  //   raster - exakt die Sprache des Fensterarrays, mit Fuellstand je Feld.
  //
  // Die Daten kommen aus EINEM Aufruf (?api=mold). Ueber die Live-Werte waeren
  // es 24 Raeume mal fuenf Groessen - 120 Bindungen, die im Editor von Hand zu
  // pflegen waeren. Der Baum weiss selbst, welcher Raum einen Waechter hat.
  var _MM_STUFE=[
    {ic:'droplet',  col:'ok',   txt:'unauffällig'},
    {ic:'warning',  col:'warn', txt:'Achtung'},
    {ic:'leak',     col:'crit', txt:'kritisch'},
    {ic:'statuserr',col:'muted',txt:'ohne Messwert'}
  ];
  var _MM_GESCHOSS=['Erdgeschoss','Obergeschoss','Dachgeschoss'];
  // Zum Ansehen im Editor, solange keine Anlage antwortet.
  var _MM_DEMO={stand:0,aussen:{t:-6.9,rh:92,x:2.1,tp:-7.9},raeume:[
    {raum:'WC OG',geschoss:'Obergeschoss',stufe:1,phi:82,wand:12.2,dosis:16.1,t:18.6,rh:54,gewinn:6.5,rfNach:22,hinweis:'82 % an der Wand (12,2 °C)'},
    {raum:'Esszimmer',geschoss:'Obergeschoss',stufe:0,phi:78,wand:11.8,dosis:0.6,t:18.0,rh:52,gewinn:5.9,rfNach:22},
    {raum:'Schlafzimmer',geschoss:'Obergeschoss',stufe:0,phi:78,wand:13.6,dosis:0,t:20.4,rh:50,gewinn:6.8,rfNach:20},
    {raum:'Lesezimmer',geschoss:'Obergeschoss',stufe:0,phi:72,wand:13.6,dosis:0,t:20.4,rh:47,gewinn:6.2,rfNach:20},
    {raum:'Wohnzimmer',geschoss:'Obergeschoss',stufe:0,phi:68,wand:12.9,dosis:0,t:19.4,rh:45,gewinn:5.4,rfNach:21},
    {raum:'Küche OG',geschoss:'Obergeschoss',stufe:0,phi:68,wand:14.1,dosis:0,t:21.1,rh:43,gewinn:5.9,rfNach:19},
    {raum:'Büro',geschoss:'Erdgeschoss',stufe:0,phi:64,wand:14.0,dosis:0,t:21.0,rh:42,gewinn:5.5,rfNach:19},
    {raum:'Werkstatt',geschoss:'Erdgeschoss',stufe:0,phi:64,wand:10.2,dosis:0,t:15.9,rh:44,gewinn:3.9,rfNach:26},
    {raum:'Verpackung',geschoss:'Erdgeschoss',stufe:0,phi:53,wand:14.3,dosis:0,t:21.4,rh:34,gewinn:4.2,rfNach:19},
    {raum:'Lager',geschoss:'Erdgeschoss',stufe:0,phi:44,wand:12.5,dosis:0,t:19.0,rh:29,gewinn:2.6,rfNach:22},
    {raum:'Zimmer Julia',geschoss:'Dachgeschoss',stufe:0,phi:56,wand:11.5,dosis:0,t:17.6,rh:38,gewinn:3.4,rfNach:24},
    {raum:'Bad Kinder',geschoss:'Dachgeschoss',stufe:0,phi:57,wand:11.0,dosis:0,t:17.0,rh:39,gewinn:3.3,rfNach:25}
  ]};

  function _mmDaten(w){ return w._mm || (typeof mode!=='undefined'&&mode==='edit' ? _MM_DEMO : null); }
  function _mmFarbe(n){ return 'var(--'+n+')'; }
  /** Kurzform langer Raumnamen - in einer 5-Spalten-Karte ist kein Platz fuer "Schlafzimmer Julia". */
  function _mmKurz(n){
    n=String(n||'');
    if(n.length<=11)return n;
    return n.replace(/^Schlafzimmer /,'Schlafz. ').replace(/^Zimmer /,'')
            .replace(/^Schlafzimmer$/,'Schlafz.').replace(/zimmer$/,'z.')
            .replace(/ Firma$/,' Fa.').replace(/^Hauseingang$/,'Eingang')
            .replace(/^Verpackung$/,'Verpack.').replace(/^Werkstatt$/,'Werkst.');
  }
  /** Toenung der Feuchtekarte: ruhig bis kritisch, Grenze ist die 80er-Isoplethe. */
  function _mmTon(phi){
    if(phi==null)return ['muted',0.06];
    if(phi>=88)return ['crit',0.34];
    if(phi>=80)return ['warn',0.30];
    if(phi>=72)return ['warn',0.16];
    if(phi>=62)return ['ok',0.13];
    return ['ok',0.07];
  }
  function _mmZaehl(d){
    var n=[0,0,0,0];
    (d&&d.raeume||[]).forEach(function(r){var s=r.stufe;n[(s>=0&&s<=3)?s:3]++;});
    return n;
  }
  /** Kopfzeile - dieselben Klassen wie Fensterarray und Info-Liste, damit zwei Kacheln nicht wie zwei Programme wirken. */
  function _mmKopf(w,d){
    if(w.mmHead===false||w.mmMode==='kopf'||w.mmMode==='fenster')return '';
    // Rangfolge und Gefaelle tragen eine duenne Abschnittszeile, keine Kachel-
    // Kopfzeile mit Icon-Flaeche: dort sind die Karten die Gestalt, und ein
    // zweiter fetter Titel darueber nimmt ihnen den Auftritt.
    if(w.mmMode==='rang'||w.mmMode==='gefaelle'||w.mmMode==='schnitt'||w.mmMode==='gruppen'){
      var R=(d&&d.raeume)||[],tun=R.filter(function(r){return [1,2,3,5,7,8].indexOf(r.lz)>=0;});
      var rechts = w.mmMode==='rang'
        ? (tun.length?'nach Gewinn geordnet':'nichts steht an')
        : (w.mmMode==='schnitt' ? 'Füllung = Temperatur, Balken = Wandfeuchte'
        : (w.mmMode==='gruppen' ? 'nach Handlung' : R.length+' Räume, °C'));
      var links = esc(w.mmTitle||'') + ((w.mmMode==='rang')&&R.length
        ? ' <b>'+tun.length+' Räume von '+R.length+'</b>' : '');
      return '<div class="mwlabel"><span>'+links+'</span><i>'+esc(rechts)+'</i></div>';
    }
    var n=_mmZaehl(d),auff=n[1]+n[2],gew=(w._mmSel!=null&&d)?(d.raeume||[]).filter(function(r){return r.raum===w._mmSel;})[0]:null;
    var hc=_mmFarbe(auff?(n[2]?'crit':'warn'):'accent');
    var sub;
    if(gew){
      sub='<b class="iasel">'+esc(gew.raum)+'</b>'+(gew.hinweis?(' · '+esc(gew.hinweis)):'');
    } else if(w.mmMode==='ampel'&&d&&d.aussen){
      sub='außen '+_mmZ(d.aussen.t,1)+' °C · '+_mmZ(d.aussen.x,1)+' g/kg';
    } else if(!d){
      sub='keine Verbindung';
    } else {
      var t=[];if(n[2])t.push(n[2]+' kritisch');if(n[1])t.push(n[1]+' Achtung');if(n[3])t.push(n[3]+' ohne Messwert');
      sub=t.length?t.join(' · '):'alle unauffällig';
    }
    var zahl=(w.mmBadge!==false&&auff>0)?('<span class="ilbadge">'+auff+'</span>'):'';
    return '<div class="ilhead'+(w.mmTo?' tap':'')+'" data-mmhead="1" style="--c:'+hc+'">'
      +'<span class="ilhi">'+iconSVG(w.mmIcon||'humidity')+zahl+'</span>'
      +'<span class="ilht"><b>'+esc(w.mmTitle||'Schimmelwächter')+'</b>'
      +(sub?('<span>'+sub+'</span>'):'')+'</span>'
      +(w.mmTo?'<span class="ilchev">'+iconSVG('arrowright')+'</span>':'')+'</div>';
  }
  /** Zahl mit Komma. Eigene Fassung statt _fmtNum: hier gibt es keine
      Widget-Optionen (Tausender, Kuerzel), nur eine feste Nachkommastelle. */
  function _mmZ(v,k){
    if(v==null||v===''||isNaN(v))return '—';
    return Number(v).toFixed(k==null?0:k).replace('.',',');
  }

  /** karte: Waermebild, Zeilen je Geschoss */
  function _mmKarte(w,d){
    var sp=Math.max(2,parseInt(w.mmCols)||5);
    var gg=_MM_GESCHOSS.slice(),rest=[];
    (d.raeume||[]).forEach(function(r){if(gg.indexOf(r.geschoss)<0&&rest.indexOf(r.geschoss)<0)rest.push(r.geschoss);});
    gg=gg.concat(rest);
    var out='';
    gg.forEach(function(g){
      var rr=(d.raeume||[]).filter(function(r){return r.geschoss===g;});
      if(!rr.length)return;
      rr.sort(function(a,b){return (b.phi||0)-(a.phi||0);});
      out+='<div class="mwg"><span class="mwgl">'+esc(g)+'</span><div class="mwr" style="grid-template-columns:repeat('+sp+',1fr)">'
        +rr.map(function(r){
          var t=_mmTon(r.phi);
          return '<div class="mwk'+(w._mmSel===r.raum?' sel':'')+'" data-mmr="'+esc(r.raum)+'" style="--c:'+_mmFarbe(t[0])+';--a:'+t[1]+'"'
            +' title="'+esc(r.raum+(r.hinweis?(' · '+r.hinweis):''))+'">'
            +'<b>'+esc(_mmKurz(r.raum))+'</b>'
            +'<em>'+_mmZ(r.phi)+'<small>%</small></em>'
            +'<i>'+_mmZ(r.wand)+'°</i></div>';
        }).join('')+'</div></div>';
    });
    return '<div class="mww">'+out+'</div>';
  }

  /** ampel: was jetzt zu tun ist */
  function _mmAmpel(w,d){
    var rr=(d.raeume||[]).slice();
    rr.sort(function(a,b){return (b.stufe-a.stufe)||((b.phi||0)-(a.phi||0));});
    var max=parseInt(w.mmMax)||9;
    rr=rr.slice(0,max);
    var gmax=0;
    (d.raeume||[]).forEach(function(r){if(r.gewinn>gmax)gmax=r.gewinn;});
    if(gmax<=0)gmax=1;
    return '<div class="mwaw">'+rr.map(function(r){
      var br=Math.max(0,Math.min(100,100*(r.gewinn||0)/gmax));
      var neg=(r.gewinn!=null&&r.gewinn<=0);
      return '<div class="mwz'+(w._mmSel===r.raum?' sel':'')+'" data-mmr="'+esc(r.raum)+'">'
        +'<span class="mwp" style="background:'+_mmFarbe(_MM_STUFE[r.stufe]?_MM_STUFE[r.stufe].col:'muted')+'"></span>'
        +'<span class="mwn">'+esc(_mmKurz(r.raum))+'</span>'
        +'<span class="mwb'+(neg?' aus':'')+'"><i style="width:'+br.toFixed(0)+'%"></i></span>'
        +'<span class="mwv">'+_mmZ(r.phi)+'<small>%</small></span></div>';
    }).join('')+'</div>';
  }

  /** raster: Sprache des Fensterarrays, Fuellstand = Wandfeuchte */
  function _mmRaster(w,d){
    var sp=Math.max(2,parseInt(w.mmCols)||6),felder=[];
    var gg=_MM_GESCHOSS.slice();
    (d.raeume||[]).forEach(function(r){if(gg.indexOf(r.geschoss)<0)gg.push(r.geschoss);});
    gg.forEach(function(g){
      var rr=(d.raeume||[]).filter(function(r){return r.geschoss===g;});
      if(!rr.length)return;
      rr.sort(function(a,b){return (b.phi||0)-(a.phi||0);});
      rr.forEach(function(r){
        var s=_MM_STUFE[r.stufe]||_MM_STUFE[3];
        // Fuellstand ab 45 %: darunter ist jeder Raum gleich unauffaellig, und
        // ein Balken, der bei 0 beginnt, macht aus 50 und 60 % denselben Stummel.
        var f=Math.max(0,Math.min(1,((r.phi||0)-45)/45));
        felder.push('<div class="mwc'+(r.stufe>=1?' hi':'')+(w._mmSel===r.raum?' sel':'')+'" data-mmr="'+esc(r.raum)+'"'
          +' style="--c:'+_mmFarbe(s.col)+'" title="'+esc(r.raum+' · '+s.txt)+'">'
          +'<i class="mwf" style="height:'+(f*100).toFixed(0)+'%"></i>'+iconSVG(s.ic)+'</div>');
      });
      // Geschosse auf eigene Zeilen bringen - sonst steht das Bad im Dachgeschoss
      // neben der Werkstatt und die Ordnung ist dahin.
      var luecke=(sp-(rr.length%sp))%sp;
      while(luecke-->0)felder.push('<div class="mwc leer"></div>');
    });
    return '<div class="mwgrid" style="grid-template-columns:repeat('+sp+',1fr)">'+felder.join('')+'</div>';
  }


  /**
   * rang: die Handlungen, nach Nutzen geordnet - Entwurf C.
   *
   * Die Seite zeigt nicht 24 Raeume, sondern die zwei bis fuenf Dinge, die jetzt
   * anstehen. Platz IST das Argument: die erste Karte ist doppelt so gross wie
   * die uebrigen, weil sie doppelt so viel bringt. Was nichts zu tun hat,
   * schrumpft auf eine Zeile am Fuss.
   *
   * Verbuende werden zu EINER Karte zusammengefasst. Ein Geschoss, dessen Tueren
   * offen sind, ist ein Luftweg und keine Sammlung von Raeumen - fuenf Karten
   * fuer dasselbe Fenster waeren eine Liste, keine Ansage.
   */
  function _mmRang(w, d) {
    var tun = (d.raeume || []).filter(function (r) { return [1, 2, 3, 5, 7, 8].indexOf(r.lz) >= 0; });
    // nach Verbund buendeln
    var grp = {}, reihe = [];
    tun.forEach(function (r) {
      var k = r.verbund || ('#' + r.raum);
      if (!grp[k]) { grp[k] = { key: k, verbund: r.verbund, raeume: [], lz: r.lz, gewinn: r.gewinn, art: r.art, lt: r.lt }; reihe.push(grp[k]); }
      grp[k].raeume.push(r);
      if (r.t != null && (grp[k].tmax == null || r.t > grp[k].tmax)) { grp[k].tmax = r.t; grp[k].warm = r.raum; }
    });
    reihe.sort(function (a, b) { return ((b.gewinn && b.gewinn[1]) || 0) - ((a.gewinn && a.gewinn[1]) || 0); });
    var aussen = (d.lage && d.lage.t != null) ? d.lage.t : null;
    var ruhig = (d.raeume || []).length - tun.length;

    // Nichts zu tun ist keine leere Seite, sondern eine Wartekarte. Eine leere
    // Flaeche wirkt kaputt; die Wartekarte sagt, worauf man wartet.
    if (!reihe.length) {
      var ab = d.lage && d.lage.startUm, warm = null, wr = '';
      (d.raeume || []).forEach(function (r) { if (r.t != null && (warm == null || r.t > warm)) { warm = r.t; wr = r.raum; } });
      return '<div class="mwrw"><div class="mwkarte warten gross" style="--c:var(--muted)">'
        + '<span class="mwtag">warten</span>'
        + '<b>' + (ab ? ('Lüften lohnt ab ' + esc(ab)) : 'Heute nicht mehr') + '</b>'
        + (ab ? '<em>' + esc(ab) + '</em>' : '')
        + '<i class="mwtxt">' + esc(warm != null
            ? ('Wärmster Raum ist ' + wr + ' mit ' + _mmZ(warm, 1) + '°. Solange außen '
               + (d.lage && d.lage.t != null ? _mmZ(d.lage.t, 1) + '°' : 'zu warm')
               + ' herrschen, holt Öffnen keine Kühlung — es bringt nur Feuchte herein.')
            : 'Keine Raumwerte.') + '</i>'
        + '</div>'
        + '<div class="mwruhig">' + ((d.raeume || []).length) + ' Räume unauffällig</div></div>';
    }
    var karten = reihe.slice(0, parseInt(w.mmMax) || 4).map(function (g, i) {
      var gw = g.gewinn ? g.gewinn[1] : 0;
      var col = g.lz === 7 || g.lz === 8 ? 'crit' : (g.lz === 5 ? 'warn' : (g.lz === 3 ? 'info' : 'ok'));
      var titel = g.verbund || g.raeume[0].raum;
      var erst = g.raeume[0];
      var ziel = (g.tmax != null && gw) ? (g.tmax - gw) : null;
      var namen = g.verbund ? g.raeume.map(function (r) { return r.raum; }).join(' · ') : '';
      var bal = '';
      if (aussen != null && g.tmax != null && g.tmax > aussen) {
        var anteil = Math.max(0, Math.min(1, gw / (g.tmax - aussen)));
        bal = '<div class="mwbal"><i style="width:' + (anteil * 100).toFixed(0) + '%"></i>'
            + '<b>' + _mmZ(aussen, 1) + '° außen</b><em>' + _mmZ(g.tmax, 1) + '° jetzt</em></div>';
      }
      // Kennzahlen nur auf der ersten Karte - dort ist Platz, und dort zaehlt die Begruendung.
      var kz = '';
      if (i === 0) {
        kz = '<div class="mwkz">'
           + '<span><b>' + _mmZ(erst.wand, 1) + '<small>°</small></b><i>Wandtemperatur</i></span>'
           + '<span><b>' + _mmZ(erst.phi, 0) + '<small>%</small></b><i>an der Wand</i></span>'
           + '<span><b>' + (erst.stufe != null ? erst.stufe : '—') + '</b><i>Schimmelstufe</i></span></div>';
      }
      return '<div class="mwkarte' + (i === 0 ? ' gross' : '') + '" data-mmr="' + esc(erst.raum) + '"'
        + ' style="--c:var(--' + col + ')">'
        + '<span class="mwnr">' + (i + 1) + '</span>'
        + '<span class="mwtag">' + esc(_MM_ART[g.art] || KO_TXT(g.lz)) + '</span>'
        + '<b>' + esc(titel) + '</b>'
        + (gw ? '<em>&minus;' + _mmZ(gw, 1) + '<small>°</small>'
              + (ziel != null ? '<u>' + _mmZ(g.tmax, 1) + ' → ' + _mmZ(ziel, 1) + ' °C</u>' : '') + '</em>' : '')
        + bal
        + (namen ? '<i class="mwsub">' + esc(namen) + '</i>' : '')
        + '<i class="mwtxt">' + esc(g.lt || '') + '</i>'
        + kz
        + '</div>';
    }).join('');
    return '<div class="mwrw">' + karten
      + (ruhig > 0 ? '<div class="mwruhig">' + ruhig + ' Räume unauffällig</div>' : '')
      + '</div>';
  }
  var _MM_ART = { kamin: 'Kaminlüftung', quer: 'querlüften', einseitig: 'Fenster öffnen' };
  function KO_TXT(z) { return (KO_ZTXT[z] || ''); }
  var KO_ZTXT = { 1: 'querlüften', 2: 'öffnen', 3: 'nachts offen', 5: 'stoßlüften', 7: 'schließen', 8: 'Gewitter' };


  /** kopf: Ansage links, Aussenwerte klein in der Mitte, eine grosse Zahl rechts. */
  function _mmKopfzeile(w, d) {
    var L = d.lage || {}, R = d.raeume || [];
    var tun = R.filter(function (r) { return [1, 2, 3, 5, 7, 8].indexOf(r.lz) >= 0; });
    var verb = {}; tun.forEach(function (r) { verb[r.verbund || r.raum] = 1; });
    var n = Object.keys(verb).length;
    var warm = null, wr = '';
    R.forEach(function (r) { if (r.t != null && (warm == null || r.t > warm)) { warm = r.t; wr = r.raum; } });
    var spanne = (warm != null && L.t != null) ? (warm - L.t) : null;
    var titel = tun.length
      ? (n === 1 ? 'Ein Bereich <b>jetzt</b> lüften' : n + ' Bereiche <b>jetzt</b> lüften')
      : (L.startUm ? 'Lüften lohnt ab <b>' + esc(L.startUm) + '</b>' : 'Heute nicht mehr lüften');
    var werte = [['außen', _mmZ(L.t, 1) + '°'], ['rel. Feuchte', _mmZ(L.rh, 0) + ' %'],
                 ['Taupunkt', _mmZ(L.tp, 1) + '°'], ['absolut', _mmZ(L.x, 1) + ' g/kg'],
                 ['Wind', _mmZ(L.wind, 1) + ' km/h'],
                 ['bis Regen', (L.regenIn != null && L.regenIn >= 0) ? (L.regenIn + ' min') : '—']];
    return '<div class="mwkopf">'
      + '<div class="mwansage"><b>' + titel + '</b><span>' + esc(w.mmTitle || 'Klima') + '</span></div>'
      + '<div class="mwwerte">' + werte.map(function (v) {
          return '<span><b>' + v[1] + '</b><i>' + v[0] + '</i></span>'; }).join('') + '</div>'
      + (spanne != null ? '<div class="mwgross"><b>' + _mmZ(spanne, 1) + '<small>°</small></b>'
          + '<i>Gefälle zum wärmsten Raum<br>' + esc(wr) + '</i></div>' : '')
      + '</div>';
  }

  /** gefaelle: drei Geschosse auf gemeinsamer Achse, Aussenluft als Nullpunkt. */
  function _mmGefaelle(w, d) {
    var L = d.lage || {}, R = d.raeume || [];
    if (L.t == null) { return '<div class="mwleer">keine Außenwerte</div>'; }
    var g = {}, max = L.t, min = L.t;
    _MM_GESCHOSS.forEach(function (x) { g[x] = []; });
    R.forEach(function (r) {
      if (r.t == null) { return; }
      (g[r.geschoss] = g[r.geschoss] || []).push(r);
      if (r.t > max) { max = r.t; }
      if (r.t < min) { min = r.t; }
    });
    // Die Achse muss ALLE Werte fassen, auch die Aussenluft. Sie am Aussenwert
    // beginnen zu lassen war falsch: tagsueber sind die Raeume KAELTER als
    // draussen, der Balkenanfang wurde negativ und lief links aus der Spur
    // heraus - quer ueber die Beschriftung des Geschosses.
    var lo = Math.floor(min) - 1, hi = Math.ceil(max) + 1, sp = Math.max(1, hi - lo);
    function pz(v) { return Math.max(0, Math.min(100, (v - lo) / sp * 100)); }
    var zeilen = Object.keys(g).filter(function (k) { return g[k].length; }).map(function (k) {
      var rr = g[k], warm = Math.max.apply(null, rr.map(function (r) { return r.t; }));
      var kalt = Math.min.apply(null, rr.map(function (r) { return r.t; }));
      var gw = rr.map(function (r) { return r.gewinn ? r.gewinn[1] : 0; });
      var gmin = Math.min.apply(null, gw), gmax = Math.max.apply(null, gw);
      var x0 = pz(kalt), x1 = pz(warm);
      // Auch "nichts zu holen" muss sichtbar sein. Grau auf dunklem Grund bei
      // 45 % Deckkraft war praktisch unsichtbar - das Erdgeschoss fehlte ganz.
      var col = warm - L.t >= 6 ? 'crit' : (warm - L.t >= 3 ? 'warn' : 'muted');
      return '<div class="mwgz"><span class="mwgn">' + esc(k) + '<i>' + rr.length + ' Räume · '
        + (gmax ? (_mmZ(gmin, 1) + '–' + _mmZ(gmax, 1) + '°') : '—') + '</i></span>'
        + '<span class="mwgb" style="--aus:' + pz(L.t).toFixed(1) + '%">'
        + '<i style="left:' + x0.toFixed(1) + '%;width:' + Math.max(1, x1 - x0).toFixed(1) + '%;'
        + 'background:color-mix(in oklab,var(--' + col + ') 70%,transparent)"></i>'
        + rr.map(function (r) { return '<u style="left:' + pz(r.t).toFixed(1) + '%"></u>'; }).join('')
        + '</span><span class="mwgw">' + _mmZ(warm, 1) + '°</span></div>';
    }).join('');
    return '<div class="mwgw2">' + zeilen
      + '<div class="mwgfuss">Balken: kältester bis wärmster Raum · Punkte: einzelne Räume · '
      + '<span style="color:var(--info)">senkrechte Linie = außen ' + _mmZ(L.t, 1) + '°</span></div></div>';
  }

  /** fenster: wie lange das Lüftungsfenster noch offen ist. */
  function _mmFenster(w, d) {
    var L = d.lage || {};
    var tun = (d.raeume || []).some(function (r) { return [1, 2, 3].indexOf(r.lz) >= 0; });
    var txt = tun ? 'offen sinnvoll' : (L.startUm ? 'beginnt um ' + esc(L.startUm) : 'heute nicht');
    return '<div class="mwfz">'
      + '<div class="mwfr"><b>' + (tun ? 'jetzt' : (L.startUm || '—')) + '</b><i>' + txt + '</i></div>'
      + '<div class="mwfr"><b>' + _mmZ(L.nachtMin != null ? L.nachtMin : null, 1) + '<small>°</small></b><i>Tiefstwert' + (L.nachtUm ? ' um ' + esc(L.nachtUm) : '') + '</i></div>'
      + '<div class="mwfr"><b>' + ((L.regenIn != null && L.regenIn >= 0) ? L.regenIn : '—') + '<small> min</small></b><i>bis Regen</i></div>'
      + '</div>';
  }


  /**
   * schnitt: das Haus als Schnitt - Entwurf A.
   *
   * Die Raeume stehen nicht im Raster, sondern an ihrem Platz: drei Geschosse
   * uebereinander, das Dachgeschoss unter der Schraege eingerueckt. Zwei
   * Verlaeufe laufen senkrecht durch das Bild und begruenden die Empfehlung,
   * statt sie zu behaupten: die Fuellung wird nach oben waermer, der Feuchte-
   * balken am Zellenfuss nach unten laenger. Links und rechts liegt die
   * Aussenluft mit dem Antrieb je Geschoss.
   */
  function _mmSchnitt(w, d) {
    var L = d.lage || {}, R = (d.raeume || []).filter(function (r) { return r.t != null; });
    if (!R.length || L.t == null) { return '<div class="mwleer">keine Messwerte</div>'; }
    var tmin = Math.min.apply(null, R.map(function (r) { return r.t; }));
    var tmax = Math.max.apply(null, R.map(function (r) { return r.t; }));
    var sp = Math.max(0.5, tmax - tmin);
    function farbe(t) {
      var a = (t - tmin) / sp;                       // 0 = kuehlster, 1 = waermster Raum
      var c = a > 0.66 ? 'crit' : (a > 0.33 ? 'warn' : 'info');
      return 'color-mix(in oklab,var(--' + c + ') ' + (8 + a * 22).toFixed(0) + '%,var(--surface-2))';
    }
    var ZK = { 1: 'querlüften', 2: 'öffnen', 3: 'nachts offen', 4: 'zu halten', 5: 'stoßlüften',
               7: 'schließen', 8: 'Gewitter', 0: 'nichts zu tun', 12: '—' };
    var reihen = _MM_GESCHOSS.filter(function (gname) {
      return R.some(function (r) { return r.geschoss === gname; });
    }).map(function (gname) {
      var rr = R.filter(function (r) { return r.geschoss === gname; });
      rr.sort(function (a, b) { return b.t - a.t; });
      var mit = rr.reduce(function (a, r) { return a + r.t; }, 0) / rr.length;
      var dT = mit - L.t;
      // Vorzeichen ist das der Differenz selbst: ein Geschoss UNTER der
      // Aussenluft steht mit Minus da. Die erste Fassung drehte es um und
      // meldete fuer das kuehle Erdgeschoss +3,7 statt -3,7.
      var pfeil = dT >= 3 ? 'ein' : (dT <= 0.05 ? 'aus' : 'null');
      var dTxt = Math.abs(dT) < 0.05 ? '±0,0°' : ((dT > 0 ? '+' : '−') + _mmZ(Math.abs(dT), 1) + '°');
      var zellen = rr.map(function (r) {
        var akt = ZK[r.lz] || '';
        var acol = [1, 2, 3].indexOf(r.lz) >= 0 ? 'ok' : (r.lz === 5 || r.lz === 4 ? 'warn'
                 : (r.lz === 7 || r.lz === 8 ? 'crit' : 'faint'));
        var ph = r.phi != null ? Math.max(0, Math.min(100, (r.phi - 40) / 50 * 100)) : 0;
        var pcol = (r.phi || 0) >= 80 ? 'crit' : ((r.phi || 0) >= 72 ? 'warn' : 'ok');
        return '<div class="mwzelle" data-mmr="' + esc(r.raum) + '" style="background:' + farbe(r.t) + '">'
          + '<b>' + esc(_mmKurz(r.raum)) + '</b>'
          + '<em>' + _mmZ(r.t, 1) + '<small>°</small></em>'
          + '<i class="mwdt">' + (r.t - L.t >= 0 ? '+' : '') + _mmZ(r.t - L.t, 1) + '°</i>'
          + '<i class="mwakt" style="color:var(--' + acol + ')">' + esc(akt) + '</i>'
          + '<span class="mwphi"><i style="width:' + ph.toFixed(0) + '%;background:var(--' + pcol + ')"></i>'
          + '<u>φ ' + _mmZ(r.phi, 0) + '%</u></span>'
          + '</div>';
      }).join('');
      return '<div class="mwgesch' + (gname === 'Dachgeschoss' ? ' dach' : '') + '">'
        + '<span class="mwaussen ' + pfeil + '"><b>' + dTxt + '</b></span>'
        + '<span class="mwgname">' + esc(gname) + '<i>Ø ' + _mmZ(mit, 1) + '°</i></span>'
        + '<div class="mwzeilen">' + zellen + '</div>'
        + '<span class="mwaussen ' + pfeil + ' r"><b>' + dTxt + '</b></span>'
        + '</div>';
    }).join('');
    return '<div class="mwschnitt">' + reihen
      + '<div class="mwslg">Füllung = Raumtemperatur · Balken am Fuß = Feuchte an der Wand, Grenze 80 % · '
      + 'außen ' + _mmZ(L.t, 1) + '°</div></div>';
  }

  /** gruppen: was zu tun ist, nach Handlung gebuendelt - die Spalte neben dem Schnitt. */
  function _mmGruppen(w, d) {
    var R = d.raeume || [];
    var ZT = { 3: ['Offen lassen bis zum Morgen', 'ok'], 1: ['Querlüften', 'ok'], 2: ['Fenster öffnen', 'ok'],
               5: ['Stoßlüften, rund 10 Minuten', 'warn'], 4: ['Geschlossen halten', 'warn'],
               7: ['Schließen — Regen', 'crit'], 8: ['Schließen — Gewitter', 'crit'],
               0: ['Nichts zu tun', 'faint'], 12: ['Keine Aussage', 'faint'] };
    var g = {};
    R.forEach(function (r) { (g[r.lz] = g[r.lz] || []).push(r); });
    var rang = [8, 7, 5, 3, 1, 2, 4, 0, 12];
    var out = rang.filter(function (z) { return g[z] && g[z].length; }).map(function (z) {
      var rr = g[z], t = ZT[z] || ['—', 'faint'];
      var gw = rr.map(function (r) { return r.gewinn ? r.gewinn[1] : 0; }).filter(function (x) { return x; });
      var spanne = gw.length ? ('−' + _mmZ(Math.min.apply(null, gw), 1) + ' bis −' + _mmZ(Math.max.apply(null, gw), 1) + '°') : '';
      return '<div class="mwgr" style="--c:var(--' + t[1] + ')">'
        + '<b><span class="mwgrn">' + rr.length + '</span>' + esc(t[0]) + '</b>'
        + (spanne ? '<i class="mwgrs">' + spanne + '</i>' : '')
        + '<i class="mwgrr">' + rr.map(function (r) { return esc(r.raum); }).join(' · ') + '</i></div>';
    }).join('');
    return '<div class="mwgrw">' + out + '</div>';
  }

  function _mmFuss(w,d){
    if(w.mmLeg===false||w.mmMode==='kopf'||w.mmMode==='fenster'||w.mmMode==='gefaelle'||w.mmMode==='schnitt'||w.mmMode==='gruppen')return '';
    if(w.mmMode==='karte')
      return '<div class="ialeg"><span class="mwskala"><i></i><b>45 %</b><b>80 %</b><b>100 %</b></span></div>';
    if(w.mmMode==='ampel')
      return '<div class="ialeg"><span class="iale" style="--c:var(--muted)">Balken: was Öffnen abführt · Zahl: Wandfeuchte</span></div>';
    if(w.mmMode==='rang')
      return '<div class="ialeg"><span class="iale" style="--c:var(--muted)">Balken: von außen bis zum wärmsten Raum, gefüllt um den erreichbaren Anteil</span></div>';
    var n=_mmZaehl(d);
    return '<div class="ialeg">'+_MM_STUFE.map(function(s,i){
      if(i===3&&!n[3])return '';
      return '<span class="iale" style="--c:'+_mmFarbe(s.col)+'">'+iconSVG(s.ic)+esc(s.txt)+'<b>'+n[i]+'</b></span>';
    }).join('')+'</div>';
  }

  defWidget('moldmap',{
    label:'Schimmelwächter', cat:'Anzeige', paletteIcon:'wgrid', size:[420,380],
    defaults:function(w){ w.mmMode='karte'; w.mmHead=true; w.mmLeg=true; w.mmCols=5; w.mmMax=9; },
    render:function(w){
      var d=_mmDaten(w);
      var koerper;
      if(!d) koerper='<div class="mwleer">wird geladen …</div>';
      else if(!(d.raeume||[]).length) koerper='<div class="mwleer">kein Raum mit Schimmelwächter gefunden</div>';
      else if(w.mmMode==='schnitt') koerper=_mmSchnitt(w,d);
      else if(w.mmMode==='gruppen') koerper=_mmGruppen(w,d);
      else if(w.mmMode==='kopf')    koerper=_mmKopfzeile(w,d);
      else if(w.mmMode==='gefaelle')koerper=_mmGefaelle(w,d);
      else if(w.mmMode==='fenster') koerper=_mmFenster(w,d);
      else if(w.mmMode==='rang')   koerper=_mmRang(w,d);
      else if(w.mmMode==='ampel')  koerper=_mmAmpel(w,d);
      else if(w.mmMode==='raster') koerper=_mmRaster(w,d);
      else                          koerper=_mmKarte(w,d);
      return '<div class="mwrap" data-role="mmb">'+_mmKopf(w,d)+koerper+_mmFuss(w,d)+'</div>';
    },
    click:function(w,el,e){
      var c=e.target.closest('[data-mmr]');
      if(c){
        var r=c.getAttribute('data-mmr');
        // Zweiter Tipp auf denselben Raum raeumt den Hinweis wieder weg - sonst
        // bliebe die Kopfzeile bei einem Raum stehen, der laengst wieder trocken ist.
        w._mmSel=(w._mmSel===r)?null:r;
        _mmMal(w);
        return true;
      }
      if(e.target.closest('[data-mmhead]')&&w.mmTo){openPopup(w.mmTo);return true;}
      return false;
    },
    props:function(w){return (w.type==='moldmap'
      ?'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Holt alle Räume mit Schimmelwächter selbst aus dem Baum — keine Variablen einzutragen. Bewertet wird die Feuchte an der kältesten Oberfläche, nicht die Raumluftfeuchte.</div>'
        +row('Darstellung','<select id="pMmMode">'
            +'<option value="karte"'+(w.mmMode!=='ampel'&&w.mmMode!=='raster'?' selected':'')+'>Feuchtekarte</option>'
            +'<option value="ampel"'+(w.mmMode==='ampel'?' selected':'')+'>Lüftungsampel</option>'
            +'<option value="raster"'+(w.mmMode==='raster'?' selected':'')+'>Raster wie Fenster</option>'
            +'<option value="rang"'+(w.mmMode==='rang'?' selected':'')+'>Rangfolge der Handlungen</option>'
            +'<option value="kopf"'+(w.mmMode==='kopf'?' selected':'')+'>Kopfzeile mit Ansage</option>'
            +'<option value="gefaelle"'+(w.mmMode==='gefaelle'?' selected':'')+'>Gefälle je Geschoss</option>'
            +'<option value="fenster"'+(w.mmMode==='fenster'?' selected':'')+'>Lüftungsfenster</option>'
            +'<option value="schnitt"'+(w.mmMode==='schnitt'?' selected':'')+'>Haus im Schnitt</option>'
            +'<option value="gruppen"'+(w.mmMode==='gruppen'?' selected':'')+'>Handlungsgruppen</option></select>')
        +(w.mmMode==='ampel'||w.mmMode==='rang'
          ?row('Zeilen','<input id="pMmMax" type="number" min="3" max="24" value="'+(w.mmMax||9)+'" style="width:60px"> <span style="font-size:11px;color:var(--muted)">von 24 Räumen</span>')
          :row('Spalten','<input id="pMmCols" type="number" min="2" max="12" value="'+(w.mmCols||(w.mmMode==='raster'?6:5))+'" style="width:60px">'))
        +'<div class="pgh">Kopf- und Fußzeile</div>'
        +row('Kopfzeile','<input type="checkbox" id="pMmHead"'+(w.mmHead!==false?' checked':'')+'>')
        +(w.mmHead!==false?(
           row('Icon · Titel','<button class="btn" id="pMmIcon" style="padding:3px 6px">'+iconSVG(w.mmIcon||'humidity')+'</button> '
              +'<input id="pMmTitle" value="'+esc(w.mmTitle||'')+'" placeholder="Schimmelwächter" style="width:150px">')
          +row('Abzeichen','<input type="checkbox" id="pMmBadge"'+(w.mmBadge!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">zählt Achtung und Kritisch</span>')
          +row('Öffnet','<select id="pMmTo">'+viewOpts(w.mmTo,'popup','— nichts —')+'</select>')
         ):'')
        +row('Legende','<input type="checkbox" id="pMmLeg"'+(w.mmLeg!==false?' checked':'')+'>')
        +row('Takt','<input id="pMmSec" type="number" min="10" max="900" value="'+(w.mmSec||120)+'" style="width:66px"> <span style="font-size:11px;color:var(--muted)">Sekunden zwischen zwei Abfragen</span>')
      :'');},
    wire:function(w){
      function ck(id,k,inv){var e=$(id);if(e)e.onchange=function(){w[k]=inv?(this.checked?undefined:false):(this.checked||undefined);render();renderProps();commit();};}
      if($('#pMmMode'))$('#pMmMode').onchange=function(){w.mmMode=this.value;w._mmSel=null;render();renderProps();commit();};
      if($('#pMmCols'))$('#pMmCols').oninput=function(){var v=parseInt(this.value);w.mmCols=isNaN(v)?undefined:v;render();commit();};
      if($('#pMmMax'))$('#pMmMax').oninput=function(){var v=parseInt(this.value);w.mmMax=isNaN(v)?undefined:v;render();commit();};
      if($('#pMmSec'))$('#pMmSec').oninput=function(){var v=parseInt(this.value);w.mmSec=isNaN(v)?undefined:v;commit();};
      if($('#pMmHead'))$('#pMmHead').onchange=function(){w.mmHead=this.checked?undefined:false;render();renderProps();commit();};
      if($('#pMmLeg'))$('#pMmLeg').onchange=function(){w.mmLeg=this.checked?undefined:false;render();commit();};
      if($('#pMmBadge'))$('#pMmBadge').onchange=function(){w.mmBadge=this.checked?undefined:false;render();commit();};
      if($('#pMmIcon'))$('#pMmIcon').onclick=function(){_iconPick={wid:w.id,field:'mmIcon'};showTab('icons');toast('Icon der Kopfzeile wählen');};
      if($('#pMmTitle'))$('#pMmTitle').oninput=function(){w.mmTitle=this.value||undefined;render();commit();};
      if($('#pMmTo'))$('#pMmTo').onchange=function(){w.mmTo=this.value||undefined;render();commit();};
    }
  });

  // Neu zeichnen. Die Kachel kann gleichzeitig auf der Seite UND im Popup liegen
  // (genau der Fall, fuer den sie gebaut ist: Lang-Druck aufs Fensterarray).
  // Deshalb ALLE Fundstellen bedienen und ueber [data-role] auswaehlen - die
  // Widget-ID allein waere zweideutig.
  function _mmMal(w){
    var ziele=[],oc=document.getElementById('ovcanvas'),hc=document.getElementById('hovcanvas');
    [oc,hc,(typeof canvas!=='undefined'?canvas:null)].forEach(function(root){
      if(!root)return;
      [].slice.call(root.querySelectorAll('.w[data-id="'+w.id+'"]')).forEach(function(el){
        if(el.querySelector('[data-role=mmb]'))ziele.push(el);
      });
    });
    ziele.forEach(function(el){el.innerHTML=WIDGETS.moldmap.render(w);});
  }

  // Ein Zwischenspeicher fuer ALLE Verbraucher. Die Kachel kann mehrfach auf der
  // Seite liegen, und das Fensterarray fragt dieselben Daten fuer sein Abzeichen
  // ab - ohne das liefen mehrere gleichzeitige Abfragen derselben Liste.
  var _MM_ST={daten:null,zeit:0,laeuft:false,warten:[]};
  function _mmDaten2(maxAlterMs,cb){
    var now=Date.now();
    if(_MM_ST.daten&&now-_MM_ST.zeit<maxAlterMs){ if(cb)cb(_MM_ST.daten); return; }
    if(cb)_MM_ST.warten.push(cb);
    if(_MM_ST.laeuft)return;
    _MM_ST.laeuft=true;
    fetch('?api=mold',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _MM_ST.laeuft=false;
      if(j&&j.raeume){_MM_ST.daten=j;_MM_ST.zeit=Date.now();}
      var w=_MM_ST.warten;_MM_ST.warten=[];
      w.forEach(function(f){try{f(_MM_ST.daten);}catch(_){}});
    }).catch(function(){_MM_ST.laeuft=false;_MM_ST.warten=[];});
  }
  // Abzeichen in einer fremden Kachel auffrischen. Nicht ueber deren live():
  // assoc.live() reagiert nur auf die EIGENEN Variablen und taete hier nichts.
  // Wer einen Platzhalter [data-role=amold] anbietet, bekommt nur diesen gefuellt;
  // alle anderen (Fensterarray) zeichnen die Kachel neu - das ist dort billig.
  function _mmChipMal(w){
    var html=_mmAbzeichen(w.moldChip);
    [document.getElementById('ovcanvas'),document.getElementById('hovcanvas'),
     (typeof canvas!=='undefined'?canvas:null)].forEach(function(root){
      if(!root)return;
      [].slice.call(root.querySelectorAll('.w[data-id="'+w.id+'"]')).forEach(function(el){
        var sp=el.querySelector('[data-role=amold]');
        if(sp){sp.innerHTML=html;return;}
        var wc=WIDGETS[w.type];
        if(wc&&wc.render)el.innerHTML=wc.render(w);
      });
    });
  }

  function _mmHolen(w){
    _mmDaten2((w.mmSec||120)*1000,function(j){
      if(!j)return;
      w._mm=j;
      // Die Antwort trifft NACH dem letzten Zeichnen ein. Ohne diesen Aufruf
      // laegen die Daten im Speicher und die Kachel bliebe leer, bis sich
      // zufaellig ein gebundener Wert aendert - was hier nie passiert.
      _mmMal(w);
    });
  }

  // --- Abzeichen fuer fremde Kacheln (Fensterarray) -----------------------
  //
  // Ohne Hinweis sieht man dem Fenster nicht an, dass hinter dem Langdruck etwas
  // liegt. Das Abzeichen zeigt die Zahl der erhoehten Waechter in ihrer Farbe;
  // steht nichts an, bleibt je nach Einstellung ein stiller Tropfen stehen oder
  // gar nichts.
  function _mmAbzeichen(modus){
    if(!modus||modus==='aus')return '';
    var d=_MM_ST.daten;
    if(!d)return '';
    var n=_mmZaehl(d),auff=n[1]+n[2];
    if(!auff&&modus!=='immer')return '';
    var col=n[2]?'crit':(n[1]?'warn':'muted');
    var t;
    if(auff){
      var schlimm=(d.raeume||[]).filter(function(r){return r.stufe>=1;})
        .sort(function(a,b){return (b.stufe-a.stufe)||((b.phi||0)-(a.phi||0));})[0];
      t=auff+' Raum'+(auff>1?'e':'')+' mit Befund'+(schlimm?(': '+schlimm.raum):'');
    } else { t='Schimmelwächter: alle unauffällig'; }
    return '<span class="mwchip" data-mmchip="1" style="--c:var(--'+col+')" title="'+esc(t)+'">'
      +iconSVG('droplet')+(auff?('<b>'+auff+'</b>'):'')+'</span>';
  }

  setInterval(function(){
    if(typeof state==='undefined'||!state.widgets)return;
    var now=Date.now();
    function takt(w){
      if(!w)return;
      // Fremde Kachel mit Abzeichen: Daten auffrischen und neu zeichnen lassen.
      if(w.type!=='moldmap'){
        if(!w.moldChip||w.moldChip==='aus')return;
        if(now-(w._mmZeit||0) < 120000)return;
        w._mmZeit=now;
        _mmDaten2(120000,function(){_mmChipMal(w);});
        return;
      }
      if(now-(w._mmZeit||0) < (w.mmSec||120)*1000)return;
      w._mmZeit=now;_mmHolen(w);
    }
    allWidgets().forEach(takt);
    if(typeof _tickKids!=='undefined'&&_tickKids)_tickKids.forEach(takt);
    if(typeof _popup!=='undefined'&&_popup&&_popup.widgets)_popup.widgets.forEach(takt);
    if(typeof _hover!=='undefined'&&_hover&&_hover.widgets)_hover.widgets.forEach(takt);
  },2000);
