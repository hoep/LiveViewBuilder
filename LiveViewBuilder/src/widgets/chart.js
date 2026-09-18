  // chart — Sammel-Widget fuer alle Diagramme. Die Variante steckt in w.ctype:
  //   Zeitreihe : area | areaspline | line | spline | step | steparea | bar | barstack | scatter
  //   Kompakt   : spark      (frueher eigenes Widget 'spark')
  //   Ohne Zeit : pie | donut | rose | waterfall   (waterfall frueher eigenes Widget 'waterfall')
  // Vorbelegte Größe je Chart-Typ (Standard = 'area'); beim Umschalten nur übernehmen, solange
  // die Größe noch der vorherigen Standardgröße entspricht (analog colorpick.js/slider.js).
  var CT_SIZE={spark:[150,50],waterfall:[360,220],daylight:[420,190],pie:[260,220],donut:[260,220],rose:[260,220],heatmap:[380,240],barrace:[380,280],treemap:[520,360]};
  function _ctSize(ct){return CT_SIZE[ct]||[340,190];}
  // ---- Anordnungsblock: Anker 3x3 + Feinversatz + Streifen/Ueberlagerung --------------
  // Dieselben drei Zeilen fuer Titel und Legende. Der Anker ist ein Knopfraster statt einer
  // Auswahlliste: neun Felder in der Anordnung, in der sie auch auf der Kachel liegen - man
  // sieht die Wahl, statt sie zu lesen.
  var _ANC_LBL={ol:'oben links',om:'oben mitte',or:'oben rechts',ml:'Mitte links',mm:'Mitte',mr:'Mitte rechts',ul:'unten links',um:'unten mitte',ur:'unten rechts'};
  function _ancBlock(pfx,cur,dx,dy,fl){
    var g='<div class="ancg" id="pAnc'+pfx+'">';
    ['o','m','u'].forEach(function(v){['l','m','r'].forEach(function(hh){var k=v+hh;
      g+='<button type="button" class="ancb'+(cur===k?' on':'')+'" data-anc="'+k+'" title="'+_ANC_LBL[k]+'"></button>';});});
    g+='</div>';
    return row('Anker',g+' <span style="font-size:11px;color:var(--muted)" id="pAnc'+pfx+'L">'+(_ANC_LBL[cur]||'')+'</span>')
      +row('Versatz','<input id="p'+pfx+'DX" type="number" style="width:52px" value="'+(dx!=null&&dx!==''?dx:'')+'" placeholder="X"> '
        +'<input id="p'+pfx+'DY" type="number" style="width:52px" value="'+(dy!=null&&dy!==''?dy:'')+'" placeholder="Y"> px'
        +' <span style="font-size:11px;color:var(--muted)">X / Y — positiv = nach rechts / nach unten</span>')
      +row('Überlagern','<input type="checkbox" id="p'+pfx+'Float"'+(fl?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">liegt frei über der Zeichenfläche, nimmt keinen Platz weg</span>');
  }
  // Die Knoepfe schreiben direkt in w und faerben sich selbst um - kein renderProps(), sonst
  // springt der Eigenschaftsbereich bei jedem Klick nach oben.
  function _ancBind(pfx,w,kAnc,kDX,kDY,kFl,re){
    var g=$('#pAnc'+pfx);
    if(g)g.onclick=function(e){
      var b=e.target&&e.target.closest?e.target.closest('.ancb'):null;if(!b)return;
      w[kAnc]=b.getAttribute('data-anc');
      Array.prototype.forEach.call(g.querySelectorAll('.ancb'),function(x){x.classList.toggle('on',x===b);});
      var l=$('#pAnc'+pfx+'L');if(l)l.textContent=_ANC_LBL[w[kAnc]]||'';
      re();};
    [[kDX,'p'+pfx+'DX'],[kDY,'p'+pfx+'DY']].forEach(function(o){
      var e=$('#'+o[1]);if(e)e.oninput=function(){w[o[0]]=(this.value===''?undefined:parseFloat(this.value));re();};});
    var f=$('#p'+pfx+'Float');if(f)f.onchange=function(){w[kFl]=this.checked||undefined;re();};
  }
  // Eigene Einheit fuer den Wasserfall (w.wfUnit) - NICHT w.yunit, das gehoert dem Achsensystem
  // (Kalenderjahr-Balken + Mehrfachachsen). Fallback liest einmalig alte Widgets, die vor dieser
  // Trennung mit yunit angelegt wurden; geschrieben wird ab jetzt ausschliesslich wfUnit.
  function _wfUnit(w){return (w.wfUnit!=null)?w.wfUnit:(w.yunit||'');}
  // Sichtbarkeit der Optionen zentral in _chartVis() — bitte dort pflegen und NICHT in verschachtelten if-Ketten.
  // Farbstuetzstellen der Treemap. Prozent der Obergrenze + Farbe, beliebig viele.
  // Prozent statt absoluter Werte, weil die Obergrenze mitwachsen soll - sonst muesste
  // man bei jedem neuen Grossverbraucher alle Stuetzstellen nachziehen.
  var TM_STOPS=[{p:0,c:'#00cdab'},{p:50,c:'#ffc107'},{p:100,c:'#ee423d'}];
  function _tmStops(w){
    var a=(w.tmStops&&w.tmStops.length)?w.tmStops:TM_STOPS;
    return a.slice().sort(function(x,y){return (+x.p)-(+y.p);});
  }
  /* Profil-Daten der Treemap muessen neu geholt werden, wenn sich Profile, Extra-IDs
     oder die Untergrenze aendern - eine blosse Neuzeichnung zeigte sonst den alten Satz. */
  /* Die Treemap zeigt MOMENTANWERTE, kennt aber keinen Live-Kanal: bei der Quelle
   * "Profil" sammelt der Server die Variablen (?api=profvars), das Widget ist auf keine
   * einzelne ID abonniert - sie stand also still, solange die Seite offen blieb. Die alte
   * PHPChart-Treemap hing an einem Ausloeser auf der Peakleistung und zeichnete sich bei
   * JEDER Messung neu.
   * Die WERTE kommen inzwischen ueber den Live-Kanal: ?api=profvars meldet die IDs zurueck,
   * _collectIds pollt sie mit, live() zeichnet entprellt neu. Dieser Takt hier gleicht nur
   * noch den BESTAND ab - neue Geraete, Mindestwert, Hoechstalter - und darf deshalb selten
   * laufen (tmSyncSec, Vorgabe 300 s, Untergrenze 60 s). */
  setInterval(function(){
    if(typeof state==='undefined'||!state.widgets)return;
    var now=Date.now(),gdef=((typeof bcfg==='function'&&bcfg().refreshSec)||15);
    function tick(w){
      if(!w||w.type!=='chart'||w.ctype!=='treemap')return;
      if(!_ec[w.id])return;                                   // nicht gezeichnet -> nichts zu tun
      if(now-(w._tmLetzt||0)<Math.max(60,(w.tmSyncSec||300))*1000)return;
      w._tmLetzt=now;
      try{ delete _tmCache[w.id]; }catch(e){}
      if(typeof renderChartData==='function')renderChartData(w);
    }
    allWidgets().forEach(tick);
    if(typeof _tickKids!=='undefined'&&_tickKids)_tickKids.forEach(tick);
    if(typeof _popup!=='undefined'&&_popup&&_popup.widgets)_popup.widgets.forEach(tick);
  },1000);
  function _tmNeu(w){ try{ delete _tmCache[w.id]; }catch(e){} if(typeof renderChartData==='function'&&_ec[w.id])renderChartData(w); commit(); }
  function _tmStopsBlock(w){
    var a=(w.tmStops&&w.tmStops.length)?w.tmStops:TM_STOPS;
    var h='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Stützstellen</div>';
    a.forEach(function(st,i){
      h+='<div class="prow" style="gap:6px;align-items:center">'
        +'<input type="color" data-tmc="'+i+'" value="'+esc(st.c||'#00cdab')+'" style="width:34px;height:26px;padding:0;border:1px solid var(--line);border-radius:6px;background:transparent">'
        +'<input type="number" data-tmp="'+i+'" min="0" max="100" value="'+(+st.p)+'" style="width:64px"><span style="font-size:11px;color:var(--muted)">%</span>'
        +'<span style="flex:1;font-size:11px;color:var(--faint);font-family:var(--fm)">'+esc(st.c||'')+'</span>'
        +(a.length>2?'<button data-tmdel="'+i+'" class="btn" style="padding:2px 7px">&times;</button>':'')
        +'</div>';
    });
    return h+'<div class="prow"><button data-tmadd="1" class="btn" style="flex:1;padding:4px">+ Stützstelle</button></div>';
  }
  function _chartVis(ct){
    // ACHTUNG: 'dl' ist unten die Datenlabel-Sichtbarkeit — der Tageslaengen-Typ heisst deshalb 'dayl'.
    var part=['pie','donut','rose'].indexOf(ct)>=0, wf=(ct==='waterfall'), sp=(ct==='spark'), dayl=(ct==='daylight'), hm=(ct==='heatmap');
    var bar=(ct==='bar'||ct==='barstack'), scat=(ct==='scatter'), race=(ct==='barrace'), tm=(ct==='treemap');
    var line=!part&&!bar&&!scat&&!wf&&!sp&&!dayl&&!hm&&!race&&!tm;
    return {
      part:part, wf:wf, spark:sp, bar:bar, scat:scat, line:line, dayl:dayl, hm:hm, race:race, tm:tm,
      lineOpt:line,                    // Glaetten / Punkte / Linienbreite / Flaechen-Verlauf
      symOpt:scat,                     // Punkte-Groesse
      br:(bar||wf||race),              // Balken-Rundung (w.barRadius)
      leg:(!wf&&!sp&&!hm&&!race&&!tm),      // Legende + Position (Bar-Race sortiert selbst, keine Legende)
      dl:(!wf&&!sp&&!dayl&&!hm&&!race&&!tm), // Datenlabels generisch (Bar-Race hat eigene Wertlabels)
      title:(!sp),                     // Titelblock (auch Bar-Race: Titel oben, Zeit-Uhr/Live-Badge unten)
      ax:(!part&&!sp&&!hm&&!race&&!tm),     // Achsen & Raster (Bar-Race: feste Kategorie/Wert-Achsen)
      axPlus:(!part&&!sp&&!wf&&!dayl&&!hm&&!race&&!tm), // Raster-Teilung, Stapeln, Zoom, Extrema, Perioden-Navigation
      cmp:(!part&&!sp&&!wf&&!dayl&&!hm&&!race&&!tm),    // Vergleich (Zeitversatz)
      ser:(!wf&&!dayl&&!tm),                // Serien-Editor (Wasserfall + Tageslaenge haben eigene Datenquelle); Heatmap nutzt 1 Serie
      yax:(!part&&!sp&&!wf&&!dayl&&!hm&&!race&&!tm)     // Y-Achsen-Editor (Tageslaenge/Heatmap/Bar-Race haben feste Achsen)
    };
  }
  defWidget('chart',{
    label:'Chart',
    cat:'Diagramme',
    paletteIcon:'wchart',
    size:[340,190],
    noHover:true, // interner Perioden-Klick (‹ ›) soll KEINEN Ganz-Widget-Hover erzeugen; Hover nur bei Seite/Popup-Verknuepfung

    // Perioden-Knoepfe nur bei Zeitreihen — Sparkline hat keinen Platz, Wasserfall keine Zeitachse
    render:function(w){var ct=w.ctype||'area',nav=(w.pnav&&ct!=='spark'&&ct!=='waterfall'&&ct!=='barrace');
      // Perioden-Navigation an der Kachelgroesse ausrichten (.w ist Groessen-Container):
      // Untergrenze haelt die Knoepfe am Handy tippbar, Obergrenze verhindert alberne
      // Riesenknoepfe auf grossen Kacheln. 1px-Rahmen und Radius bleiben bewusst fest.
      var pbs='width:clamp(22px,9cqmin,34px);height:clamp(20px,8cqmin,30px);border:1px solid var(--line);background:var(--surface-2);color:var(--text);border-radius:5px;cursor:pointer;font-size:clamp(12px,5cqmin,17px);line-height:1';
      return '<div data-role="chart" style="position:absolute;inset:0"></div>'+(nav?'<div style="position:absolute;left:clamp(6px,2.5cqmin,12px);bottom:clamp(4px,2cqmin,10px);display:flex;gap:clamp(4px,2cqmin,8px);align-items:center;z-index:2"><button data-role="pprev" style="'+pbs+'">‹</button><span data-role="plabel" style="font-size:clamp(10px,3.6cqmin,13px);color:var(--muted);min-width:clamp(30px,12cqmin,48px);text-align:center">jetzt</span><button data-role="pnext" style="'+pbs+'">›</button></div>':'');},
    click:function(w,el,e){var ct=w.ctype||'area';if(ct==='spark'||ct==='waterfall'||ct==='barrace')return false; // keine Perioden-Navigation (falsche Datenquelle)
      var pp=e.target.closest('[data-role=pprev]'),pn=e.target.closest('[data-role=pnext]');if(!pp&&!pn)return false;w._pOff=Math.max(0,(w._pOff||0)+(pp?1:-1));fetchHist(w);return true;},
    props:function(w){
      if(w.type!=='chart')return '';
      var ct=w.ctype||'area',V=_chartVis(ct);
      var h=row('Chart-Typ','<select id="pCType"><optgroup label="Zeitreihe"><option value="area"'+(ct==='area'?' selected':'')+'>Fläche</option><option value="areaspline"'+(ct==='areaspline'?' selected':'')+'>Fläche glatt (Spline)</option><option value="line"'+(ct==='line'?' selected':'')+'>Linie</option><option value="spline"'+(ct==='spline'?' selected':'')+'>Linie glatt (Spline)</option><option value="step"'+(ct==='step'?' selected':'')+'>Stufen</option><option value="steparea"'+(ct==='steparea'?' selected':'')+'>Stufenfläche</option><option value="bar"'+(ct==='bar'?' selected':'')+'>Balken</option><option value="barstack"'+(ct==='barstack'?' selected':'')+'>Balken gestapelt</option><option value="scatter"'+(ct==='scatter'?' selected':'')+'>Punkte</option></optgroup><optgroup label="Animiert"><option value="barrace"'+(ct==='barrace'?' selected':'')+'>Bar Race (Balken-Wettlauf)</option></optgroup><optgroup label="Kompakt"><option value="spark"'+(ct==='spark'?' selected':'')+'>Sparkline (kompakt)</option></optgroup><optgroup label="Anteile (ohne Zeit)"><option value="pie"'+(ct==='pie'?' selected':'')+'>Kreis (Pie)</option><option value="donut"'+(ct==='donut'?' selected':'')+'>Donut</option><option value="rose"'+(ct==='rose'?' selected':'')+'>Rose (Nightingale)</option></optgroup><optgroup label="Ohne Zeit"><option value="waterfall"'+(ct==='waterfall'?' selected':'')+'>Wasserfall</option></optgroup><optgroup label="Matrix"><option value="heatmap"'+(ct==='heatmap'?' selected':'')+'>Heatmap (Wochentag × Stunde)</option><option value="treemap"'+(ct==='treemap'?' selected':'')+'>Treemap (Fläche = Wert)</option></optgroup><optgroup label="Astronomie"><option value="daylight"'+(ct==='daylight'?' selected':'')+'>Tageslänge (ganzes Jahr)</option></optgroup></select>');
      // ---- Tabellen-Quelle: Balken aus einer Kennzahlen-Tabelle statt aus dem Archiv ----
      // Gedacht fuer Jahresreihen, die ein Skript ohnehin schon rechnet (Statistik-Tabellen).
      // Mit der Kopplung folgt das Diagramm dem Umschalter einer Kennzahlen-Matrix.
      h+=row('Tabelle A (ID)','<input id="pChTblA" type="number" value="'+(w.chTblA||'')+'" style="width:90px" placeholder="aus"> <span style="font-size:11px;color:var(--muted)">gesetzt = Balken kommen aus der Tabelle, nicht aus dem Archiv</span>');
      if(w.chTblA)h+=row('Zeile','<input id="pChTblRow" value="'+esc(w.chTblRow||'')+'" placeholder="z. B. T Avg" style="flex:1"> <span style="font-size:11px;color:var(--muted)">Anfang des Bezeichners genügt</span>')
        +row('Tabelle B (ID)','<input id="pChTblB" type="number" value="'+(w.chTblB||'')+'" style="width:90px" placeholder="ohne"> <span style="font-size:11px;color:var(--muted)">zweite Ansicht, z. B. bis heute</span>')
        +row('Kopplung (Kennung)','<input id="pChSes" value="'+esc(w.chSession||'')+'" placeholder="z. B. wxstat" style="width:120px"> <span style="font-size:11px;color:var(--muted)">schaltet mit der Matrix gleicher Kennung um</span>')
        +row('Titel A','<input id="pChLabA" value="'+esc(w.chLabA||'')+'" placeholder="leer = Beschriftung" style="flex:1">')
        +row('Titel B','<input id="pChLabB" value="'+esc(w.chLabB||'')+'" placeholder="leer = Beschriftung" style="flex:1">');
      // ---- Tageslänge: Datenquelle ist der Standort (date_sun_info serverseitig), keine Variablen ----
      if(V.dayl){
        h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Auf- und Untergang für jeden Tag des Jahres, Fläche dazwischen = Tageslänge. Der Standort wird automatisch aus der Location-Instanz gelesen.</div>'
          +row('Jahr','<input id="pDlYear" type="number" style="width:80px" value="'+(w.dlYear||new Date().getFullYear())+'">')
          +row('Standort-Instanz','<input id="pDlLoc" value="'+(w.dlLoc||'')+'" placeholder="leer = automatisch" style="width:110px">')
          +row('Heute markieren','<input type="checkbox" id="pDlToday"'+(w.dlToday!==false?' checked':'')+'>')
          +row('Ohne Sommerzeit','<input type="checkbox" id="pDlNoDst"'+(w.dlNoDst?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">glatte Kurven ohne die Sprünge im März/Oktober</span>')
          +row('Untergang-Linie',skinSel(w.dlSet||'warn','id="pDlSet"'))
          +row('Aufgang-Linie',skinSel(w.dlRise||'muted','id="pDlRise"'))
          +row('Füllung',skinSel(w.dlFill||'','id="pDlFill"')+' <span style="font-size:11px;color:var(--muted)">leer = wie Untergang</span>')
          +row('Füllung-Deckkraft %','<input id="pDlOp" type="number" min="0" max="100" style="width:64px" value="'+(w.dlOpacity!=null?w.dlOpacity:22)+'">');
      }
      // ---- Wasserfall: Schritte (Datenquelle sind LIVE-Werte, keine Historie) ----
      if(V.wf)h+=listEditor(w,'steps','Schritte: Titel · Variable · Typ · Farbe',[
          {k:'title',ph:'Titel'},
          {k:'vid',ph:'ID'},
          {k:'type',type:'select',def:'auf',options:[['start','Start'],['auf','Auf (+)'],['ab','Ab (−)'],['sub','Zwischensumme'],['sum','Summe']]},
          {k:'color',type:'skincolor'}
        ]);
      // ---- Heatmap: Datenquelle = 1. Serie; feste Achsen Stunde x Wochentag ----
      if(V.hm)h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Aggregiert die stündliche Historie der <b>ersten Serie</b> (unten) zu Wochentag × Stunde. Braucht geloggte Werte.</div>'
        +row('Zeitraum (Tage)','<input id="pHmDays" type="number" min="1" max="120" value="'+(w.hmDays||14)+'">')
        +row('Auflösung','<select id="pHmRes"><option value="60"'+((w.hmRes||60)==60?' selected':'')+'>Stunde (24 Spalten)</option><option value="30"'+(w.hmRes==30?' selected':'')+'>30 min (48)</option><option value="15"'+(w.hmRes==15?' selected':'')+'>15 min (96)</option><option value="5"'+(w.hmRes==5?' selected':'')+'>5 min (288)</option></select> <span style="font-size:11px;color:var(--muted)">fein = 5-Min-Archiv als Basis</span>')
        +row('Aggregation','<select id="pHmAgg"><option value="avg"'+((w.aggField!=='sum')?' selected':'')+'>Mittelwert</option><option value="sum"'+(w.aggField==='sum'?' selected':'')+'>Summe</option></select>')
        +row('Farbschema','<select id="pHmSch"><option value="heat"'+((w.hmScheme||'heat')==='heat'?' selected':'')+'>Heat (blau→rot)</option><option value="cool"'+(w.hmScheme==='cool'?' selected':'')+'>Kühl→Warm</option><option value="accent"'+(w.hmScheme==='accent'?' selected':'')+'>Akzent</option></select>')
        +row('Werte einblenden','<input type="checkbox" id="pHmLbl"'+(w.labels?' checked':'')+'>');
      // ---- Treemap ----
      // Flaeche = Wert, Farbe = derselbe Wert ueber frei gesetzte Stuetzstellen.
      // Vorbild ist die abgeloeste PHPChart-Treemap #<ID> (Momentanleistung aller
      // Verbraucher); die Profil-Quelle sammelt selbst ein, damit ein neuer Zaehler
      // nicht von Hand nachgetragen werden muss.
      if(V.tm){
        var tq=(w.tmSrc==='serien')?'serien':'profil';
        h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Fläche = Wert, Farbe = derselbe Wert. <b>Keine Historie nötig</b> – es zählt der Momentanwert.</div>'
          +row('Quelle','<select id="pTmSrc"><option value="profil"'+(tq==='profil'?' selected':'')+'>Variablenprofil (sammelt selbst ein)</option><option value="serien"'+(tq==='serien'?' selected':'')+'>Serienliste (unten)</option></select>');
        if(tq==='profil'){
          h+=row('Profile','<input id="pTmProf" value="'+esc(w.tmProfiles||'')+'" placeholder="Leistung_H, Leistung_IT, …" style="flex:1">')
            +'<div style="font-size:11px;color:var(--muted);margin:0 2px 6px">Mehrere mit Komma. Es zählt das <b>benutzerdefinierte</b> Profil der Variablen; der Name kommt vom übergeordneten Objekt.</div>'
            +row('Zusätzliche Variablen','<input id="pTmExtra" value="'+esc(w.tmExtra||'')+'" placeholder="IDs, z. B. 14356" style="flex:1">')
            +row('Nach Profil gruppieren','<input type="checkbox" id="pTmGrp"'+(w.tmGroup!==false?' checked':'')+'>')
            +((w.tmGroup!==false)?row('Gruppen beschriften','<input type="checkbox" id="pTmGrpLbl"'+(w.tmGrpLbl!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Kopfzeile je Gruppe (IT, Haushalt …)</span>'):'')
            +row('Gruppennamen','<input id="pTmNames" value="'+esc(w.tmNames||'')+'" placeholder="Leistung_IT=IT, Leistung_MM=Multimedia" style="flex:1">');
        }
        h+=row('Kleinste Fläche ab','<input id="pTmMin" type="number" step="0.1" style="width:80px" value="'+(w.tmMin!=null?w.tmMin:0)+'"> <span style="font-size:11px;color:var(--muted)">darunter wird nicht gezeigt</span>')
          +row('Höchstalter','<input id="pTmAge" type="number" step="1" min="0" style="width:80px" value="'+(w.tmMaxAge!=null?w.tmMaxAge:'')+'" placeholder="0 = aus"> <span style="font-size:11px;color:var(--muted)">Stunden</span>')
          +'<div style="font-size:11px;color:var(--muted);margin:0 2px 6px">Messstellen, die länger nichts gemeldet haben, bleiben draußen. Eine tote Steckdose steht sonst mit ihrem letzten Wert für immer in der Summe.</div>'
          +'<div class="pgh">Farbe</div>'
          +row('Obergrenze','<select id="pTmMaxMode"><option value="auto"'+((w.tmMaxMode||'auto')==='auto'?' selected':'')+'>automatisch (größter Wert)</option><option value="perzentil"'+(w.tmMaxMode==='perzentil'?' selected':'')+'>Perzentil (Ausreißer deckeln)</option><option value="fest"'+(w.tmMaxMode==='fest'?' selected':'')+'>fester Wert</option></select>')
          +((w.tmMaxMode==='fest')?row('Wert','<input id="pTmMax" type="number" step="1" style="width:90px" value="'+(w.tmMax!=null?w.tmMax:250)+'">'):'')
          +((w.tmMaxMode==='perzentil')?(row('Perzentil','<input id="pTmPerz" type="number" min="50" max="100" step="1" style="width:74px" value="'+(w.tmPerz!=null?w.tmPerz:90)+'"> <span style="font-size:11px;color:var(--muted)">%</span>')
             +'<div style="font-size:11px;color:var(--muted);margin:0 2px 6px">Alles darüber läuft in die Endfarbe. Gut, wenn einzelne Großverbraucher sonst alles andere zusammendrücken.</div>'):'')
          +row('Kennlinie','<select id="pTmScale"><option value="linear"'+((w.tmScale||'linear')==='linear'?' selected':'')+'>linear</option><option value="sqrt"'+(w.tmScale==='sqrt'?' selected':'')+'>Wurzel (sanft gespreizt)</option><option value="log"'+(w.tmScale==='log'?' selected':'')+'>logarithmisch (stark)</option></select>')
          +'<div style="font-size:11px;color:var(--muted);margin:0 2px 6px">Hebt das untere Ende an, damit kleine Verbraucher unterscheidbar bleiben, wenn ein Gerät die Skala bestimmt. <b>Logarithmisch</b> wirkt kräftig – mit einer Ampel-Rampe rutscht dabei fast alles ins Warme; <b>Wurzel</b> ist meist die bessere Wahl.</div>'
          +'<div style="font-size:11px;color:var(--muted);margin:0 2px 6px">Die Stützstellen unten sind <b>Prozent der Obergrenze</b>, damit die Skala mitwächst.</div>'
          +_tmStopsBlock(w)
          +row('Übergang','<select id="pTmMode"><option value="verlauf"'+((w.tmMode||'verlauf')==='verlauf'?' selected':'')+'>Verlauf (linear mischen)</option><option value="stufen"'+(w.tmMode==='stufen'?' selected':'')+'>Stufen (feste Klassen)</option></select>')
          +row('Farblegende','<input type="checkbox" id="pTmLeg"'+(w.tmLegend!==false?' checked':'')+'>')
          +row('Werte auf den Flächen','<input type="checkbox" id="pTmLbl"'+(w.tmLabels!==false?' checked':'')+'>');
      }
      // ---- Bar Race ----
      if(V.race){
        h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Balken-Wettlauf: jede <b>Serie</b> unten ist ein Läufer.'
          +(w.brLive?' <b>Live:</b> zeigt die aktuellen Werte verschiedener Kategorien und sortiert bei jedem Update in Echtzeit um.':' <b>Verlauf:</b> Frames aus dem <b>Zeitraum</b> oben (Einheit = Bucket, z. B. 12 × Monate), läuft automatisch.')+'</div>'
          +row('Datenquelle','<select id="pBrLive"><option value=""'+(!w.brLive?' selected':'')+'>Verlauf (Zeit-Animation)</option><option value="1"'+(w.brLive?' selected':'')+'>Live-Werte (Echtzeit)</option></select>')
          +row('Sichtbare Ränge (Top N)','<input id="pBrTop" type="number" min="3" max="30" style="width:64px" value="'+(w.brTop!=null?w.brTop:10)+'">')
          +row(w.brLive?'Übergang (ms)':'Tempo je Frame (ms)','<input id="pBrSpeed" type="number" min="150" max="4000" step="50" style="width:74px" value="'+(w.brSpeed!=null?w.brSpeed:(w.brLive?600:700))+'">');
        if(!w.brLive)h+=row('Kumuliert','<input type="checkbox" id="pBrCumul"'+(w.brCumul===true?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Running Total (Wachstum)</span>')
          +row('Endlos-Schleife','<input type="checkbox" id="pBrLoop"'+(w.brLoop!==false?' checked':'')+'>');
      }
      // ---- Diagramm-Optionen ----
      h+='<div class="pgh">'+(V.wf?'Optionen':(V.hm?'Datenreihe':(V.race?'Balken':'Diagramm-Optionen')))+'</div>';
      if(V.spark)h+=row('Darstellung','<select id="pSpStyle">'
          +'<option value="spline"'+((w.spStyle||'spline')==='spline'?' selected':'')+'>Spline (glatt)</option>'
          +'<option value="line"'+(w.spStyle==='line'?' selected':'')+'>Linie (eckig)</option>'
          +'<option value="bar"'+(w.spStyle==='bar'?' selected':'')+'>Balken</option></select>')
        +row('Linienstärke','<input id="pSpLw" type="number" step="0.2" min="0.5" max="8" style="width:64px" value="'+(w.spLw!=null?w.spLw:1.8)+'"> <span style="font-size:11px;color:var(--muted)">px · bei Balken ohne Wirkung</span>')
        +row('Mittelwert','<input type="checkbox" id="pSpAvg"'+(w.spAvg?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">gestrichelte Linie je Reihe, wie in der Wetterstatistik</span>')
        +row('Füllung','<input type="checkbox" id="pSpFill"'+((w.fill!==false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Fläche unter der Linie · nur bei EINER Reihe</span>')
        +'<div class="hint" style="font-size:11px;margin-top:4px">Farbe je Reihe unter <b>Datenreihen</b> — dort auch weitere Reihen anlegen, die Sparkline zeichnet sie alle.</div>';
      if(V.lineOpt)h+=row('Glätten (Spline)','<input type="checkbox" id="pSmooth"'+(w.smooth!==false?' checked':'')+'>')+row('Punkte','<input type="checkbox" id="pSym"'+(w.symbols?' checked':'')+'> <input id="pSymS" type="number" style="width:52px" value="'+(w.symSize||5)+'" title="Größe">')+row('Linienbreite','<input id="pLw" type="number" step="0.5" value="'+(w.lw||2)+'">')+row('Flächen-Verlauf','<input type="checkbox" id="pGrad"'+(w.grad?' checked':'')+'>');
      if(V.symOpt)h+=row('Punkte-Größe','<input id="pSymS" type="number" style="width:52px" value="'+(w.symSize||7)+'">')
        // Beschriftung der X-Achse: nur sinnvoll, wenn dort eine Messgroesse liegt.
        // Die Serie entscheidet darueber (Feld X-ID), nicht dieses Feld.
        +row('X-Achse','<input id="pXName" value="'+esc(w.xname||'')+'" placeholder="z. B. Außentemperatur" style="flex:1"> '
            +'<input id="pXUnit" value="'+esc(w.xunit||'')+'" placeholder="°C" style="width:52px" title="Einheit">')
        +row('Verdichten','<input id="pXBin" type="number" step="0.5" style="width:64px" value="'+(w.xBin||'')+'" placeholder="aus"> <span style="font-size:11px;color:var(--muted)">Klassenbreite der X-Achse; je Klasse ein Mittelwert</span>')
        +'<div class="hint" style="font-size:11px;margin:-2px 2px 8px">Trägt eine Serie eine <b>X-ID</b>, wird aus dem Punktdiagramm ein XY-Diagramm: beide Zeitreihen werden über den Zeitstempel gepaart (zur nächsten Marke, sonst mit dem zuletzt bekannten X-Wert). Ohne X-ID liegt weiterhin die Zeit auf der X-Achse. <b>Verdichten</b> macht aus der Punktwolke eine Kennlinie: 0,5 fasst je halbes Grad zusammen.</div>';
      if(V.wf)h+=row('Y-Einheit','<input id="pWfUnit" value="'+esc(_wfUnit(w))+'" style="width:80px" placeholder="z. B. €">')
        +row('Datenlabels','<input type="checkbox" id="pDl"'+(w.labels?' checked':'')+'>')
        +row('Verbindungslinien','<input type="checkbox" id="pWfConn"'+(w.wfConnect!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">gestrichelt, zwischen den Balken</span>');
      if(V.br)h+=row('Balken-Rundung','<input id="pBr" type="number" value="'+(w.barRadius!=null?w.barRadius:3)+'">');
      // Balkenbreite gilt nur fuer Reihen mit EIGENER Aggregationsstufe - nur dort rechnet
      // das Widget die Breite selbst; sonst bestimmt sie ECharts aus den Datenabstaenden.
      if(V.br&&!V.race&&(w.series||[]).some(function(x){return x&&x.stage&&x.stage!=='raw';}))
        h+=row('Balkenbreite','<input id="pStBarW" type="number" min="5" max="100" style="width:56px" value="'+(w.stageBarPct!=null&&w.stageBarPct!==''?w.stageBarPct:'')+'" placeholder="60"> % <span style="font-size:11px;color:var(--muted)">Anteil des Blocks (Monat, Woche …) bei Reihen mit eigener Stufe</span>');
      if(V.br&&!V.race)h+=row('Balken horizontal','<input type="checkbox" id="pBarHoriz"'+(w.barHoriz?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">liegende Balken statt Säulen</span>');
      if(V.wf)h+=row('Fallback Auf',skinSel(w.wfUp||'ok','id="pWfUp"'))+row('Fallback Ab',skinSel(w.wfDown||'crit','id="pWfDn"'));
      if(V.leg){
        h+='<div class="pgh">Legende</div>'+row('Legende','<input type="checkbox" id="pLeg"'+(w.legend?' checked':'')+'>');
        if(w.legend)h+=_ancBlock('Leg',_legAnc(w),w.legDX,w.legDY,w.legFloat)
          +row('Ausrichtung','<select id="pLegOr"><option value="auto"'+(!w.legOrient||w.legOrient==='auto'?' selected':'')+'>automatisch</option><option value="h"'+(w.legOrient==='h'?' selected':'')+'>waagrecht</option><option value="v"'+(w.legOrient==='v'?' selected':'')+'>senkrecht</option></select> <span style="font-size:11px;color:var(--muted)">automatisch: an einer Seitenkante senkrecht</span>')
          +row('je Zeile','<input id="pLegCols" type="number" min="1" style="width:56px" value="'+(w.legCols||'')+'" placeholder="auto"> <span style="font-size:11px;color:var(--muted)">senkrecht: je Spalte</span>')
          +row('Abstand','<input id="pLegGap" type="number" style="width:56px" value="'+(w.legGap!=null&&w.legGap!==''?w.legGap:'')+'" placeholder="4"> px')
          +row('Werte','<input type="checkbox" id="pLegVal"'+(w.legVals?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">aktueller Wert hinter dem Serienname</span>');
      }
      if(V.dl)h+=row('Datenlabels','<input type="checkbox" id="pDl"'+(w.labels?' checked':'')+'>');
      // Titel gilt fuer fast ALLE Chart-Typen (auch Torte/Donut/Rose/Wasserfall) - deshalb ausserhalb des Achsen-Blocks
      if(V.title){
        var _tOn=(w.showTitle!=null?w.showTitle:(!w.legend&&!!w.label));
        h+='<div class="pgh">Titel</div>'+row('Titel','<input type="checkbox" id="pShowT"'+(_tOn?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Label als Titel</span>');
        if(_tOn)h+=row('Untertitel','<input id="pSubLab" value="'+esc(w.subLabel||'')+'" placeholder="optional">')
          +_ancBlock('Title',_titleAnc(w),w.titleDX,w.titleDY,w.titleFloat)
          +row('Fett','<input type="checkbox" id="pTitleBold"'+(w.titleBold?' checked':'')+'>')
          +(((w.label||'')===''&&(w.subLabel||'')==='')?'<div style="font-size:11px;color:var(--warm);margin:2px 2px 6px">Label und Untertitel sind leer, es erscheint nichts.</div>':'');
      }
      // ---- Zeichenflaeche: manuelle Raender ------------------------------------------------
      // Der Notausgang. Die Streifen fuer Titel und Legende werden gemessen, das trifft fast
      // immer - aber wer eine Achse mit sehr langen Beschriftungen hat oder zwei Kacheln
      // nebeneinander auf dieselbe Nulllinie bringen will, braucht eine feste Zahl.
      if(V.ax||V.part||V.wf){
        h+='<div class="pgh">Zeichenfläche</div>'
          +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Leer = automatisch. Ein Wert überstimmt die gemessenen Streifen an dieser Kante.</div>'
          +row('Ränder','<input id="pPadL" type="number" style="width:52px" value="'+(w.padL!=null&&w.padL!==''?w.padL:'')+'" placeholder="li"> '
            +'<input id="pPadR" type="number" style="width:52px" value="'+(w.padR!=null&&w.padR!==''?w.padR:'')+'" placeholder="re"> '
            +'<input id="pPadT" type="number" style="width:52px" value="'+(w.padT!=null&&w.padT!==''?w.padT:'')+'" placeholder="ob"> '
            +'<input id="pPadB" type="number" style="width:52px" value="'+(w.padB!=null&&w.padB!==''?w.padB:'')+'" placeholder="un"> px'
            +' <span style="font-size:11px;color:var(--muted)">links · rechts · oben · unten</span>');
      }
      // ---- Schriftgrößen je Textart (leer = wächst mit der Kachel und folgt der zentralen Typografie) ----
      var _fsRow=function(id,lbl,val){return row(lbl,'<input id="'+id+'" type="number" min="5" max="40" step="0.5" style="width:64px" value="'+(val||'')+'" placeholder="auto">');};
      // Einheit fuer Datenlabels und Tooltips (Nachkommastellen kommen aus der zentralen Zeile)
      h+=row('Einheit (Werte)','<input id="pChUnit" value="'+esc(w.chUnit||'')+'" style="width:90px" placeholder="z. B. kWh"> <span style="font-size:11px;color:var(--muted)">an Datenlabels und Tooltip</span>');
      h+='<div class="pgh">Schriftgrößen (px)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Leer = automatisch: wächst mit der Kachelgröße und folgt der Schriftgröße aus „Typografie".</div>'
        +(V.title?_fsRow('pFsTitle','Titel',w.fsTitle):'')
        +(V.title?_fsRow('pFsSub','Untertitel',w.fsSub):'')
        +(V.leg?_fsRow('pFsLegend','Legende',w.fsLegend):'')
        +((V.ax||V.race)?_fsRow('pAxFs','Achsen (Skalenwerte)',w.axFs):'')
        +(V.ax?_fsRow('pFsAxName','Achsentitel / Einheit',w.fsAxName):'')
        +_fsRow('pFsLabel','Datenlabels',w.fsLabel);
      if(V.ax||V.race){
        h+='<div class="pgh">Achsen & Raster</div>'+row('Y-Beschriftung','<input type="checkbox" id="pYLab"'+(w.yLabels!==false?' checked':'')+'>')+row('X-Beschriftung','<input type="checkbox" id="pXLab"'+(w.xLabels!==false?' checked':'')+'>')+row('Y-Hilfslinien','<input type="checkbox" id="pYg"'+(w.ygrid!==false?' checked':'')+'>')+row('X-Hilfslinien','<input type="checkbox" id="pXg"'+(w.xgrid?' checked':'')+'>')+row('Achslinien','<input type="checkbox" id="pAxLine"'+(w.axLine?' checked':'')+'>')+row('Tickmarks','<input type="checkbox" id="pAxTicks"'+(w.axTicks?' checked':'')+'>');
        if(V.axPlus||V.race)h+=row('Raster-Teilung','<input id="pGridDivs" type="number" min="0" style="width:56px" value="'+(w.gridDivs||'')+'" placeholder="auto"> <span style="font-size:11px;color:var(--muted)">'+(V.race?'Werte-Achse: Anzahl':'Y-Achse: Anzahl')+'</span>');
        if(V.axPlus)h+='<div class="pgh">Achsenbeschriftung</div>'
          +row('X: Dichte','<select id="pXTM"><option value=""'+(!w.xTickMode?' selected':'')+'>automatisch</option><option value="count"'+(w.xTickMode==='count'?' selected':'')+'>Anzahl</option><option value="every"'+(w.xTickMode==='every'?' selected':'')+'>jede N-te</option></select> <input id="pXTN" type="number" min="1" style="width:52px" value="'+(w.xTicks||'')+'" placeholder="N">')
          +row('X: Zeitformat','<input id="pXFmt" style="width:96px" value="'+esc(w.xFmt||'')+'" placeholder="automatisch"> <span style="font-size:11px;color:var(--muted)">z.&nbsp;B. H:i oder d.m.</span>')
          +(V.scat?'':row('X: Titel','<input id="pXName" value="'+esc(w.xname||'')+'" placeholder="Achsentitel (optional)">'))
          +((w.xname||'')!==''?('<div class="serow" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:-2px 0 7px 14px">'
            +'<span style="font-size:11px;color:var(--muted);min-width:52px">Titel</span>'
            +'<select id="pXnLoc" title="Lage entlang der Achse">'+_optn([['start','links'],['middle','Mitte'],['end','rechts']],w.xnLoc||'middle')+'</select>'
            +'<select id="pXnSide" title="Ober- oder unterhalb der Achse">'+_optn([['u','unten'],['o','oben']],w.xnSide||'u')+'</select>'
            +'<select id="pXnRot" title="Drehung der Schrift">'+_optn([['0','0°'],['90','90°'],['-90','-90°']],String(w.xnRot!=null&&w.xnRot!==''?w.xnRot:0))+'</select>'
            +'<input id="pXnGap" type="number" value="'+(w.xnGap!=null&&w.xnGap!==''?w.xnGap:'')+'" placeholder="Abst." style="width:56px" title="Abstand zur Achse in Pixeln, leer = automatisch">'
            +'</div>'):'')
          +row('Y: Zahlenformat','<select id="pYFmt"><option value=""'+(!w.yFmt||w.yFmt==='auto'?' selected':'')+'>automatisch</option><option value="thousand"'+(w.yFmt==='thousand'?' selected':'')+'>1.234,5</option><option value="compact"'+(w.yFmt==='compact'?' selected':'')+'>1,2k / 3,4M</option></select> <input id="pYDec" type="number" min="0" max="6" style="width:46px" value="'+(w.yDec!=null?w.yDec:'')+'" placeholder="Dez">')
          +row('Y: Einheit anzeigen','<input type="checkbox" id="pYUL"'+(w.yUnitLab?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">an den Skalenwerten</span>');
        if(V.axPlus&&(V.bar||V.line))h+=row('Stapeln','<input type="checkbox" id="pStack"'+(w.stack?' checked':'')+'>');
        if(V.axPlus)h+=row('Zoom/Scroll','<input type="checkbox" id="pZoom"'+(w.zoom?' checked':'')+'>')+row('Marken-Textfarbe',skinSel(w.annFg||'','id="pAnnFg"')+' <span style="font-size:11px;color:var(--muted)">leer = wei&szlig;</span>')+listEditor(w,'anns','Marken: Art · Reihe · Text · Stil · Farbe · Einheit · Schwelle',[{k:'kind',type:'select',def:'max',options:[['max','Maximum'],['min','Minimum'],['last','Aktuell'],['first','Erster'],['avg','Mittel'],['value','Schwelle']]},{k:'ser',ph:'Reihe'},{k:'text',ph:'Text {v}'},{k:'style',type:'select',def:'pin',options:[['pin','Marke'],['line','Linie'],['both','beides']]},{k:'color',type:'skincolor'},{k:'unit',ph:'Einh.'},{k:'val',ph:'Wert'}])+row('Perioden-Navigation','<input type="checkbox" id="pPnav"'+(w.pnav?' checked':'')+'>');
      }
            if(V.bar)h+='<div class="pgh">Balken</div>'
        +row('Ruhende ab','<input id="pChRuhe" type="number" step="any" style="width:88px" value="'+(w.chRuheAb!=null?w.chRuheAb:'')+'" placeholder="aus"> <span style="font-size:11px;color:var(--muted)">Balken bis zu diesem Wert grau — trennt „gar nicht“ von „kaum“</span>')
        +row('Schnittlinie','<input type="checkbox" id="pChAvg"'+(w.chAvgLine?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">gestrichelte Waagrechte auf dem Mittelwert</span>')
        +(w.chAvgLine?row('Farbe der Linie',skinSel(w.chAvgColor||'','id="pChAvgC"')+' <span style="font-size:11px;color:var(--muted)">leer = Akzent</span>'):'');
if(V.cmp)h+='<div class="pgh">Vergleich (Zeitversatz)</div>'+row('Aktiv','<input type="checkbox" id="pCmpOn"'+(w.cmpOn?' checked':'')+'>')+(w.cmpOn?(row('Versatz',offSel('pCmpOff',w.cmpOff))+(V.bar?row('Vorperiode als Strich','<input type="checkbox" id="pCmpMark"'+(w.cmpMark?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Marke statt Balken</span>'):'')+((V.bar&&w.cmpMark)?row('Strichfarbe',skinSel(w.cmpMarkColor||'','id="pCmpMarkColor"')+' <span style="font-size:11px;color:var(--muted)">leer = grau</span>'):row('Schatten %','<input id="pCmpShade" type="number" min="0" max="90" value="'+(w.cmpShade!=null?w.cmpShade:55)+'">'))):'');
      // Farbsegmentierung: nur fuer Zeitreihen sinnvoll (dort, wo es auch Achsen-Extras gibt).
      if(V.axPlus){
        h+='<div class="pgh">Farbsegmentierung (Kurve nach Wert einfärben)</div>'
          +row('Aktiv','<input type="checkbox" id="pSegOn"'+(w.segOn?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">färbt die ERSTE Reihe nach ihrem Wert statt nach der Serienfarbe</span>');
        if(w.segOn)h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
          +'Je Zeile „ab diesem Wert gilt diese Farbe" — dieselbe Bauform wie die Vergleichstabellen '
          +'von Wertkarte und Metrik-Liste. Leer = Vorgabe für Temperatur (unter 0 Info, ab 0 Akzent, '
          +'ab 10 OK, ab 20 Warnung, ab 28 Kritisch).</div>'
          +listEditor(w,'segSteps','Ab Wert · Farbe',[{k:'v',ph:'ab'},{k:'color',type:'skincolor'}]);
      }
      // Heatmap liest weiterhin nur die erste Serie - dort gaebe es fuer eine zweite
      // keinen Platz. Die Sparkline zeichnet inzwischen alle; sie bleibt aber in der
      // schlanken Fassung (ID, Name, Farbe): Typ und Achse hat sie nicht.
      if(V.ser)h+=seriesEditor(w,V.hm?{max:1,simple:1}:(V.spark?{simple:1}:null));
      if(V.yax)h+=axesEditor(w);
      return h;
    },
    wire:function(w){
      if($('#pChRuhe'))$('#pChRuhe').onchange=function(){w.chRuheAb=(this.value===''?undefined:parseFloat(this.value));render();commit();};
      if($('#pChAvg'))$('#pChAvg').onchange=function(){w.chAvgLine=this.checked||undefined;render();renderProps();commit();};
      if($('#pChAvgC'))$('#pChAvgC').onchange=function(){w.chAvgColor=this.value||undefined;render();commit();};
      function reChart(){if(_ec[w.id])renderChartData(w);commit();}
      if($('#pCType'))$('#pCType').onchange=function(){
        var alt=w.ctype||'area',neu=this.value;
        if(alt!==neu){
          var sa=_ctSize(alt),sn=_ctSize(neu);
          if(w.w===sa[0]&&w.h===sa[1]){w.w=sn[0];w.h=sn[1];applyGeom(w);} // Standardgröße nur übernehmen, solange sie unverändert war
        }
        w.ctype=neu;
        if(w.ctype==='waterfall')_wfSeed(w);   // Muster-Schritte lazy saeen — defaults() laeuft vor dem Setzen von ctype
        render();renderProps();commit();       // render(): Perioden-Knoepfe/Chart-Neuaufbau, renderProps(): andere Optionen
      };
      // --- Tageslänge ---
      if($('#pDlYear'))$('#pDlYear').onchange=function(){w.dlYear=parseInt(this.value)||undefined;fetchDaylight(w);commit();};
      if($('#pDlLoc'))$('#pDlLoc').onchange=function(){w.dlLoc=parseInt(this.value)||undefined;fetchDaylight(w);commit();};
      if($('#pDlToday'))$('#pDlToday').onchange=function(){w.dlToday=this.checked?undefined:false;reChart();};
      if($('#pDlNoDst'))$('#pDlNoDst').onchange=function(){w.dlNoDst=this.checked||undefined;fetchDaylight(w);commit();};
      if($('#pDlSet'))$('#pDlSet').onchange=function(){w.dlSet=this.value||undefined;reChart();};
      if($('#pDlRise'))$('#pDlRise').onchange=function(){w.dlRise=this.value||undefined;reChart();};
      if($('#pDlFill'))$('#pDlFill').onchange=function(){w.dlFill=this.value||undefined;reChart();};
      if($('#pDlOp'))$('#pDlOp').oninput=function(){w.dlOpacity=this.value===''?undefined:parseInt(this.value);reChart();};
      // --- Sparkline ---
      if($('#pSpStyle'))$('#pSpStyle').onchange=function(){w.spStyle=(this.value==='spline')?undefined:this.value;reChart();};
      if($('#pSpLw'))$('#pSpLw').oninput=function(){var v=parseFloat(this.value);w.spLw=(isNaN(v)||v===1.8)?undefined:v;reChart();};
      if($('#pSpAvg'))$('#pSpAvg').onchange=function(){w.spAvg=this.checked||undefined;reChart();};
      if($('#pSpFill'))$('#pSpFill').onchange=function(){w.fill=this.checked?undefined:false;reChart();};
      // --- Wasserfall ---
      if($('#pWfUnit'))$('#pWfUnit').oninput=function(){w.wfUnit=this.value;reChart();};
      if($('#pWfConn'))$('#pWfConn').onchange=function(){w.wfConnect=this.checked?undefined:false;reChart();};
      if($('#pWfUp'))$('#pWfUp').oninput=$('#pWfUp').onchange=function(){w.wfUp=this.value;reChart();};
      if($('#pWfDn'))$('#pWfDn').oninput=$('#pWfDn').onchange=function(){w.wfDown=this.value;reChart();};
      // --- Heatmap ---
      if($('#pHmDays'))$('#pHmDays').oninput=function(){w.hmDays=Math.max(1,Math.min(120,parseInt(this.value)||14));delete _hist[w.id];fetchHist(w);commit();};
      if($('#pHmRes'))$('#pHmRes').onchange=function(){w.hmRes=parseInt(this.value)||60;delete _hist[w.id];fetchHist(w);commit();};
      if($('#pHmAgg'))$('#pHmAgg').onchange=function(){w.aggField=(this.value==='sum')?'sum':undefined;delete _hist[w.id];fetchHist(w);commit();};
      // --- Bar Race ---
      function _chTblNeu(){delete _hist[w.id];fetchHist(w);commit();}
      if($('#pChTblA'))$('#pChTblA').onchange=function(){w.chTblA=parseInt(this.value)||undefined;renderProps();_chTblNeu();};
      if($('#pChTblB'))$('#pChTblB').onchange=function(){w.chTblB=parseInt(this.value)||undefined;_chTblNeu();};
      if($('#pChTblRow'))$('#pChTblRow').onchange=function(){w.chTblRow=this.value||undefined;_chTblNeu();};
      if($('#pChSes'))$('#pChSes').onchange=function(){w.chSession=this.value||undefined;_chTblNeu();};
      if($('#pChLabA'))$('#pChLabA').onchange=function(){w.chLabA=this.value||undefined;_chTblNeu();};
      if($('#pChLabB'))$('#pChLabB').onchange=function(){w.chLabB=this.value||undefined;_chTblNeu();};
      if($('#pBrLive'))$('#pBrLive').onchange=function(){w.brLive=this.value?true:undefined;delete _hist[w.id];fetchHist(w);renderProps();commit();};
      if($('#pBrTop'))$('#pBrTop').oninput=function(){w.brTop=this.value===''?undefined:Math.max(3,Math.min(30,parseInt(this.value)||10));reChart();};
      if($('#pBrSpeed'))$('#pBrSpeed').oninput=function(){w.brSpeed=this.value===''?undefined:Math.max(150,Math.min(4000,parseInt(this.value)||700));reChart();};
      if($('#pBrCumul'))$('#pBrCumul').onchange=function(){w.brCumul=this.checked?true:undefined;reChart();};
      if($('#pBrLoop'))$('#pBrLoop').onchange=function(){w.brLoop=this.checked?undefined:false;reChart();};
      if($('#pHmSch'))$('#pHmSch').onchange=function(){w.hmScheme=this.value;reChart();};
      if($('#pHmLbl'))$('#pHmLbl').onchange=function(){w.labels=this.checked;reChart();};
      // ---- Treemap ----
      if($('#pTmSrc'))$('#pTmSrc').onchange=function(){w.tmSrc=(this.value==='serien')?'serien':undefined;renderProps();reChart();};
      if($('#pTmProf'))$('#pTmProf').oninput=function(){w.tmProfiles=this.value||undefined;_tmNeu(w);};
      if($('#pTmExtra'))$('#pTmExtra').oninput=function(){w.tmExtra=this.value||undefined;_tmNeu(w);};
      if($('#pTmNames'))$('#pTmNames').oninput=function(){w.tmNames=this.value||undefined;reChart();};
      if($('#pTmGrp'))$('#pTmGrp').onchange=function(){w.tmGroup=this.checked?undefined:false;renderProps();reChart();};
      if($('#pTmGrpLbl'))$('#pTmGrpLbl').onchange=function(){w.tmGrpLbl=this.checked?undefined:false;reChart();};
      if($('#pTmScale'))$('#pTmScale').onchange=function(){w.tmScale=(this.value==='linear')?undefined:this.value;reChart();};
      if($('#pTmPerz'))$('#pTmPerz').oninput=function(){w.tmPerz=(this.value===''?undefined:parseFloat(this.value));reChart();};
      if($('#pTmMin'))$('#pTmMin').oninput=function(){w.tmMin=(this.value===''?undefined:parseFloat(this.value));_tmNeu(w);};
      if($('#pTmAge'))$('#pTmAge').oninput=function(){w.tmMaxAge=(this.value===''?undefined:parseFloat(this.value));_tmNeu(w);};
      if($('#pTmMaxMode'))$('#pTmMaxMode').onchange=function(){w.tmMaxMode=(this.value==='auto')?undefined:this.value;renderProps();reChart();};
      if($('#pTmMax'))$('#pTmMax').oninput=function(){w.tmMax=(this.value===''?undefined:parseFloat(this.value));reChart();};
      if($('#pTmMode'))$('#pTmMode').onchange=function(){w.tmMode=(this.value==='stufen')?'stufen':undefined;reChart();};
      if($('#pTmLeg'))$('#pTmLeg').onchange=function(){w.tmLegend=this.checked?undefined:false;reChart();};
      if($('#pTmLbl'))$('#pTmLbl').onchange=function(){w.tmLabels=this.checked?undefined:false;reChart();};
      // Stuetzstellen: beim ersten Anfassen die Vorgabe uebernehmen, sonst
      // veraendert man eine Liste, die gar nicht am Widget haengt.
      function _tmFest(){ if(!w.tmStops||!w.tmStops.length)w.tmStops=_tmStops(w).map(function(x){return {p:+x.p,c:x.c};}); return w.tmStops; }
      $$('#props [data-tmc]').forEach(function(el){el.oninput=function(){
        var a=_tmFest(),i=+el.getAttribute('data-tmc'); if(a[i]){a[i].c=this.value;renderProps();reChart();}};});
      $$('#props [data-tmp]').forEach(function(el){el.onchange=function(){
        var a=_tmFest(),i=+el.getAttribute('data-tmp'); if(a[i]){a[i].p=Math.max(0,Math.min(100,parseFloat(this.value)||0));renderProps();reChart();}};});
      $$('#props [data-tmdel]').forEach(function(el){el.onclick=function(){
        var a=_tmFest(),i=+el.getAttribute('data-tmdel'); if(a.length>2){a.splice(i,1);renderProps();reChart();}};});
      if($('#props [data-tmadd]'))$('#props [data-tmadd]').onclick=function(){
        var a=_tmFest(),letzt=a[a.length-1]||{p:0,c:'#00cdab'};
        a.push({p:Math.min(100,(+letzt.p)+25),c:letzt.c}); renderProps(); reChart();};
      // --- gemeinsam ---
      if($('#pSmooth'))$('#pSmooth').onchange=function(){w.smooth=this.checked;reChart();};
      if($('#pSym'))$('#pSym').onchange=function(){w.symbols=this.checked;reChart();};
      if($('#pSymS'))$('#pSymS').oninput=function(){w.symSize=parseFloat(this.value)||5;reChart();};
      if($('#pXName'))$('#pXName').oninput=function(){w.xname=this.value||undefined;reChart();commit();};
      if($('#pXUnit'))$('#pXUnit').oninput=function(){w.xunit=this.value||undefined;reChart();commit();};
      if($('#pXBin'))$('#pXBin').oninput=function(){w.xBin=parseFloat(this.value)||undefined;delete _hist[w.id];fetchHist(w);commit();};
      if($('#pLw'))$('#pLw').oninput=function(){w.lw=parseFloat(this.value)||2;reChart();};
      if($('#pBr'))$('#pBr').oninput=function(){w.barRadius=parseFloat(this.value)||0;reChart();};
      if($('#pBarHoriz'))$('#pBarHoriz').onchange=function(){w.barHoriz=this.checked||undefined;reChart();};
      if($('#pStBarW'))$('#pStBarW').oninput=function(){w.stageBarPct=(this.value===''?undefined:parseFloat(this.value));reChart();};
      if($('#pGrad'))$('#pGrad').onchange=function(){w.grad=this.checked;reChart();};
      if($('#pLeg'))$('#pLeg').onchange=function(){w.legend=this.checked;renderProps();reChart();};
      _ancBind('Leg',w,'legAnc','legDX','legDY','legFloat',reChart);
      if($('#pLegOr'))$('#pLegOr').onchange=function(){w.legOrient=(this.value==='auto'?undefined:this.value);reChart();};
      if($('#pLegCols'))$('#pLegCols').oninput=function(){w.legCols=this.value===''?undefined:Math.max(1,parseInt(this.value)||1);reChart();};
      if($('#pLegGap'))$('#pLegGap').oninput=function(){w.legGap=this.value===''?undefined:parseFloat(this.value);reChart();};
      if($('#pLegVal'))$('#pLegVal').onchange=function(){w.legVals=this.checked||undefined;reChart();};
      if($('#pYg'))$('#pYg').onchange=function(){w.ygrid=this.checked;reChart();};
      if($('#pDl'))$('#pDl').onchange=function(){w.labels=this.checked;reChart();};
      if($('#pShowT'))$('#pShowT').onchange=function(){w.showTitle=this.checked;reChart();renderProps();};
      _ancBind('Title',w,'titleAnc','titleDX','titleDY','titleFloat',reChart);
      if($('#pSubLab'))$('#pSubLab').oninput=function(){w.subLabel=this.value||undefined;reChart();};
      if($('#pTitleBold'))$('#pTitleBold').onchange=function(){w.titleBold=this.checked||undefined;reChart();};
      [['pPadL','padL'],['pPadR','padR'],['pPadT','padT'],['pPadB','padB']].forEach(function(o){
        var e=$('#'+o[0]);if(e)e.oninput=function(){w[o[1]]=(this.value===''?undefined:parseFloat(this.value));reChart();};});
      if($('#pYLab'))$('#pYLab').onchange=function(){w.yLabels=this.checked;reChart();};
      if($('#pXLab'))$('#pXLab').onchange=function(){w.xLabels=this.checked;reChart();};
      if($('#pXg'))$('#pXg').onchange=function(){w.xgrid=this.checked||undefined;reChart();};
      if($('#pAxLine'))$('#pAxLine').onchange=function(){w.axLine=this.checked||undefined;reChart();};
      if($('#pAxTicks'))$('#pAxTicks').onchange=function(){w.axTicks=this.checked||undefined;reChart();};
      if($('#pChUnit'))$('#pChUnit').oninput=function(){w.chUnit=this.value||undefined;reChart();};
      [['pFsTitle','fsTitle'],['pFsSub','fsSub'],['pFsLegend','fsLegend'],['pAxFs','axFs'],['pFsAxName','fsAxName'],['pFsLabel','fsLabel']].forEach(function(o){
        var e=$('#'+o[0]);if(e)e.oninput=function(){w[o[1]]=(this.value===''?undefined:parseFloat(this.value));reChart();};
      });
      if($('#pGridDivs'))$('#pGridDivs').oninput=function(){w.gridDivs=this.value===''?undefined:parseInt(this.value);reChart();};
      if($('#pXTM'))$('#pXTM').onchange=function(){w.xTickMode=this.value||undefined;reChart();};
      if($('#pXTN'))$('#pXTN').oninput=function(){w.xTicks=this.value===''?undefined:Math.max(1,parseInt(this.value)||1);reChart();};
      if($('#pXFmt'))$('#pXFmt').onchange=function(){w.xFmt=this.value.trim()||undefined;reChart();};
      if($('#pXName')&&!$('#pXUnit'))$('#pXName').oninput=function(){w.xname=this.value||undefined;reChart();renderProps();};  // pXUnit gibt es nur beim Punktdiagramm - dort gehoert das Feld der anderen Bindung
      [['pXnLoc','xnLoc'],['pXnSide','xnSide'],['pXnRot','xnRot']].forEach(function(o){
        var e=$('#'+o[0]);if(e)e.onchange=function(){w[o[1]]=this.value||undefined;reChart();};});
      if($('#pXnGap'))$('#pXnGap').oninput=function(){w.xnGap=(this.value===''?undefined:parseFloat(this.value));reChart();};
      if($('#pYFmt'))$('#pYFmt').onchange=function(){w.yFmt=this.value||undefined;reChart();};
      if($('#pYDec'))$('#pYDec').oninput=function(){w.yDec=this.value===''?undefined:Math.max(0,Math.min(6,parseInt(this.value)||0));reChart();};
      if($('#pYUL'))$('#pYUL').onchange=function(){w.yUnitLab=this.checked||undefined;reChart();};
      if($('#pStack'))$('#pStack').onchange=function(){w.stack=this.checked;reChart();};
      if($('#pZoom'))$('#pZoom').onchange=function(){w.zoom=this.checked;reChart();};
      if($('#pAnnFg'))$('#pAnnFg').onchange=function(){w.annFg=this.value||undefined;reChart();};
      if($('#pPnav'))$('#pPnav').onchange=function(){w.pnav=this.checked||undefined;render();commit();};
      if($('#pSegOn'))$('#pSegOn').onchange=function(){w.segOn=this.checked||undefined;renderProps();render();commit();};
      // Nur Felder, die die DATEN betreffen, holen die Historie neu. Punktform,
      // Farbe oder Groesse aendern bloss die Darstellung - dafuer das Archiv zu
      // befragen, waere bei jedem Tastendruck eine Abfrage zu viel.
      var _SFDATA={vid:1,stage:1,aggF:1,calc:1};
      $$('#props [data-sf]').forEach(function(inp){inp.oninput=inp.onchange=function(ev){var pr=inp.getAttribute('data-sf').split('.'),i=parseInt(pr[0]),k=pr[1];_ensureSeries(w);w.series[i]=w.series[i]||{};w.series[i][k]=(k==='vid'?(parseInt(inp.value)||0):(k==='axis'?parseInt(inp.value):inp.value));
        if(_SFDATA[k]){delete _hist[w.id];fetchHist(w);}else if(_ec[w.id])renderChartData(w);else render();
        commit();
        if(inp.tagName==='SELECT'){renderProps();return;}
        // Bei der Variablen-ID das Panel NUR beim Verlassen des Feldes neu aufbauen
        // (change, nicht input) - sonst springt der Eingabefokus bei jedem Zeichen weg.
        // Danach steht die Herkunftszeile an der neuen ID.
        if(k==='vid'&&ev&&ev.type==='change')renderProps();
      };});
      // Herkunft/Aufzeichnung der Serien-Variablen nachtragen (asynchron, ohne Neuzeichnen)
      if(typeof _chLogCheck==='function')_chLogCheck(w);
      $$('#props [data-spick]').forEach(function(b){b.onclick=function(){showTab('vars');toast('Variable im Baum anklicken');_bindSeries={wid:w.id,idx:parseInt(b.getAttribute('data-spick'))};};});
      $$('#props [data-sdel]').forEach(function(b){b.onclick=function(){_ensureSeries(w);w.series.splice(parseInt(b.getAttribute('data-sdel')),1);delete _hist[w.id];renderProps();fetchHist(w);commit();};});
      if($('#props [data-sadd]'))$('#props [data-sadd]').onclick=function(){_ensureSeries(w);w.series.push({vid:0,name:'',color:'',type:'',axis:0});renderProps();commit();};
      $$('#props [data-af]').forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.getAttribute('data-af').split('.'),i=parseInt(pr[0]),k=pr[1];_ensureYAxes(w);w.yAxes[i]=w.yAxes[i]||{};w.yAxes[i][k]=((k==='min'||k==='max')?(inp.value===''?'':parseFloat(inp.value)):inp.value);if(_ec[w.id])renderChartData(w);commit();if(inp.tagName==='SELECT')renderProps();};});
      $$('#props [data-adel]').forEach(function(b){b.onclick=function(){_ensureYAxes(w);w.yAxes.splice(parseInt(b.getAttribute('data-adel')),1);renderProps();if(_ec[w.id])renderChartData(w);commit();};});
      if($('#props [data-aadd]'))$('#props [data-aadd]').onclick=function(){_ensureYAxes(w);w.yAxes.push({side:'R',name:'',min:'',max:''});renderProps();if(_ec[w.id])renderChartData(w);commit();};
    },
    // Anteile -> setPie, Wasserfall -> setWaterfall (Live-Werte, KEIN Historien-Nachzug), sonst (inkl. spark) entprellte Historie
    live:function(w,el,id,d,base,txt,on){var ct=w.ctype||'area';
      if(ct==='barrace'){ if(w.brLive&&_ec[w.id]&&(_chSeries(w)||[]).some(function(s){return s&&s.vid===id;}))_raceLiveTick(w); return; } // Live-Modus: Balken in Echtzeit umsortieren
      if(ct==='heatmap')return; // historische Aggregation, kein Live-Nachzug
      if(ct==='treemap'){tmPushRefresh(w);return;} // Momentanwerte aus dem Live-Kanal, gebuendelt gezeichnet
      if(ct==='pie'||ct==='donut'||ct==='rose'){if(_ec[w.id])setPie(w);}
      else if(ct==='waterfall'){if((w.steps||[]).some(function(s){return s.vid===id;}))setWaterfall(w);}
      else if(_ec[w.id])chartPushRefresh(w);}
  });
