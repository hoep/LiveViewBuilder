  // chart — Sammel-Widget fuer alle Diagramme. Die Variante steckt in w.ctype:
  //   Zeitreihe : area | areaspline | line | spline | step | steparea | bar | barstack | scatter
  //   Kompakt   : spark      (frueher eigenes Widget 'spark')
  //   Ohne Zeit : pie | donut | rose | waterfall   (waterfall frueher eigenes Widget 'waterfall')
  // Vorbelegte Größe je Chart-Typ (Standard = 'area'); beim Umschalten nur übernehmen, solange
  // die Größe noch der vorherigen Standardgröße entspricht (analog colorpick.js/slider.js).
  var CT_SIZE={spark:[150,50],waterfall:[360,220],daylight:[420,190],pie:[260,220],donut:[260,220],rose:[260,220],heatmap:[380,240],barrace:[380,280]};
  function _ctSize(ct){return CT_SIZE[ct]||[340,190];}
  // Eigene Einheit fuer den Wasserfall (w.wfUnit) - NICHT w.yunit, das gehoert dem Achsensystem
  // (Kalenderjahr-Balken + Mehrfachachsen). Fallback liest einmalig alte Widgets, die vor dieser
  // Trennung mit yunit angelegt wurden; geschrieben wird ab jetzt ausschliesslich wfUnit.
  function _wfUnit(w){return (w.wfUnit!=null)?w.wfUnit:(w.yunit||'');}
  // Sichtbarkeit der Optionen zentral in _chartVis() — bitte dort pflegen und NICHT in verschachtelten if-Ketten.
  function _chartVis(ct){
    // ACHTUNG: 'dl' ist unten die Datenlabel-Sichtbarkeit — der Tageslaengen-Typ heisst deshalb 'dayl'.
    var part=['pie','donut','rose'].indexOf(ct)>=0, wf=(ct==='waterfall'), sp=(ct==='spark'), dayl=(ct==='daylight'), hm=(ct==='heatmap');
    var bar=(ct==='bar'||ct==='barstack'), scat=(ct==='scatter'), race=(ct==='barrace');
    var line=!part&&!bar&&!scat&&!wf&&!sp&&!dayl&&!hm&&!race;
    return {
      part:part, wf:wf, spark:sp, bar:bar, scat:scat, line:line, dayl:dayl, hm:hm, race:race,
      lineOpt:line,                    // Glaetten / Punkte / Linienbreite / Flaechen-Verlauf
      symOpt:scat,                     // Punkte-Groesse
      br:(bar||wf||race),              // Balken-Rundung (w.barRadius)
      leg:(!wf&&!sp&&!hm&&!race),      // Legende + Position (Bar-Race sortiert selbst, keine Legende)
      dl:(!wf&&!sp&&!dayl&&!hm&&!race), // Datenlabels generisch (Bar-Race hat eigene Wertlabels)
      title:(!sp),                     // Titelblock (auch Bar-Race: Titel oben, Zeit-Uhr/Live-Badge unten)
      ax:(!part&&!sp&&!hm&&!race),     // Achsen & Raster (Bar-Race: feste Kategorie/Wert-Achsen)
      axPlus:(!part&&!sp&&!wf&&!dayl&&!hm&&!race), // Raster-Teilung, Stapeln, Zoom, Extrema, Perioden-Navigation
      cmp:(!part&&!sp&&!wf&&!dayl&&!hm&&!race),    // Vergleich (Zeitversatz)
      ser:(!wf&&!dayl),                // Serien-Editor (Wasserfall + Tageslaenge haben eigene Datenquelle); Heatmap nutzt 1 Serie
      yax:(!part&&!sp&&!wf&&!dayl&&!hm&&!race)     // Y-Achsen-Editor (Tageslaenge/Heatmap/Bar-Race haben feste Achsen)
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
      var h=row('Chart-Typ','<select id="pCType"><optgroup label="Zeitreihe"><option value="area"'+(ct==='area'?' selected':'')+'>Fläche</option><option value="areaspline"'+(ct==='areaspline'?' selected':'')+'>Fläche glatt (Spline)</option><option value="line"'+(ct==='line'?' selected':'')+'>Linie</option><option value="spline"'+(ct==='spline'?' selected':'')+'>Linie glatt (Spline)</option><option value="step"'+(ct==='step'?' selected':'')+'>Stufen</option><option value="steparea"'+(ct==='steparea'?' selected':'')+'>Stufenfläche</option><option value="bar"'+(ct==='bar'?' selected':'')+'>Balken</option><option value="barstack"'+(ct==='barstack'?' selected':'')+'>Balken gestapelt</option><option value="scatter"'+(ct==='scatter'?' selected':'')+'>Punkte</option></optgroup><optgroup label="Animiert"><option value="barrace"'+(ct==='barrace'?' selected':'')+'>Bar Race (Balken-Wettlauf)</option></optgroup><optgroup label="Kompakt"><option value="spark"'+(ct==='spark'?' selected':'')+'>Sparkline (kompakt)</option></optgroup><optgroup label="Anteile (ohne Zeit)"><option value="pie"'+(ct==='pie'?' selected':'')+'>Kreis (Pie)</option><option value="donut"'+(ct==='donut'?' selected':'')+'>Donut</option><option value="rose"'+(ct==='rose'?' selected':'')+'>Rose (Nightingale)</option></optgroup><optgroup label="Ohne Zeit"><option value="waterfall"'+(ct==='waterfall'?' selected':'')+'>Wasserfall</option></optgroup><optgroup label="Matrix"><option value="heatmap"'+(ct==='heatmap'?' selected':'')+'>Heatmap (Wochentag × Stunde)</option></optgroup><optgroup label="Astronomie"><option value="daylight"'+(ct==='daylight'?' selected':'')+'>Tageslänge (ganzes Jahr)</option></optgroup></select>');
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
      if(V.br&&!V.race)h+=row('Balken horizontal','<input type="checkbox" id="pBarHoriz"'+(w.barHoriz?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">liegende Balken statt Säulen</span>');
      if(V.wf)h+=row('Fallback Auf',skinSel(w.wfUp||'ok','id="pWfUp"'))+row('Fallback Ab',skinSel(w.wfDown||'crit','id="pWfDn"'));
      if(V.leg)h+=row('Legende','<input type="checkbox" id="pLeg"'+(w.legend?' checked':'')+'>')+(w.legend?row('Legende-Pos','<select id="pLegPos"><option value="top"'+((w.legPos||'top')==='top'?' selected':'')+'>oben</option><option value="bottom"'+(w.legPos==='bottom'?' selected':'')+'>unten</option><option value="left"'+(w.legPos==='left'?' selected':'')+'>links</option><option value="right"'+(w.legPos==='right'?' selected':'')+'>rechts</option></select>'):'');
      if(V.dl)h+=row('Datenlabels','<input type="checkbox" id="pDl"'+(w.labels?' checked':'')+'>');
      // Titel gilt fuer fast ALLE Chart-Typen (auch Torte/Donut/Rose/Wasserfall) - deshalb ausserhalb des Achsen-Blocks
      if(V.title){
        var _tOn=(w.showTitle!=null?w.showTitle:(!w.legend&&!!w.label));
        h+='<div class="pgh">Titel</div>'+row('Titel anzeigen','<input type="checkbox" id="pShowT"'+(_tOn?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Label als Titel</span>')
          +(_tOn?row('Titel-Position','<select id="pTitlePos"><option value="left"'+((w.titlePos||'left')==='left'?' selected':'')+'>links</option><option value="center"'+(w.titlePos==='center'?' selected':'')+'>zentriert</option><option value="right"'+(w.titlePos==='right'?' selected':'')+'>rechts</option></select>'+(((w.label||'')==='')?' <span style="font-size:11px;color:var(--warm)">— Label ist leer, es erscheint nichts</span>':'')):'');
      }
      // ---- Schriftgrößen je Textart (leer = wächst mit der Kachel und folgt der zentralen Typografie) ----
      var _fsRow=function(id,lbl,val){return row(lbl,'<input id="'+id+'" type="number" min="5" max="40" step="0.5" style="width:64px" value="'+(val||'')+'" placeholder="auto">');};
      // Einheit fuer Datenlabels und Tooltips (Nachkommastellen kommen aus der zentralen Zeile)
      h+=row('Einheit (Werte)','<input id="pChUnit" value="'+esc(w.chUnit||'')+'" style="width:90px" placeholder="z. B. kWh"> <span style="font-size:11px;color:var(--muted)">an Datenlabels und Tooltip</span>');
      h+='<div class="pgh">Schriftgrößen (px)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Leer = automatisch: wächst mit der Kachelgröße und folgt der Schriftgröße aus „Typografie".</div>'
        +(V.title?_fsRow('pFsTitle','Titel',w.fsTitle):'')
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
          +row('Y: Zahlenformat','<select id="pYFmt"><option value=""'+(!w.yFmt||w.yFmt==='auto'?' selected':'')+'>automatisch</option><option value="thousand"'+(w.yFmt==='thousand'?' selected':'')+'>1.234,5</option><option value="compact"'+(w.yFmt==='compact'?' selected':'')+'>1,2k / 3,4M</option></select> <input id="pYDec" type="number" min="0" max="6" style="width:46px" value="'+(w.yDec!=null?w.yDec:'')+'" placeholder="Dez">')
          +row('Y: Einheit anzeigen','<input type="checkbox" id="pYUL"'+(w.yUnitLab?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">an den Skalenwerten</span>');
        if(V.axPlus&&(V.bar||V.line))h+=row('Stapeln','<input type="checkbox" id="pStack"'+(w.stack?' checked':'')+'>');
        if(V.axPlus)h+=row('Zoom/Scroll','<input type="checkbox" id="pZoom"'+(w.zoom?' checked':'')+'>')+row('Marken-Textfarbe',skinSel(w.annFg||'','id="pAnnFg"')+' <span style="font-size:11px;color:var(--muted)">leer = wei&szlig;</span>')+listEditor(w,'anns','Marken: Art · Reihe · Text · Stil · Farbe · Einheit · Schwelle',[{k:'kind',type:'select',def:'max',options:[['max','Maximum'],['min','Minimum'],['last','Aktuell'],['first','Erster'],['avg','Mittel'],['value','Schwelle']]},{k:'ser',ph:'Reihe'},{k:'text',ph:'Text {v}'},{k:'style',type:'select',def:'pin',options:[['pin','Marke'],['line','Linie'],['both','beides']]},{k:'color',type:'skincolor'},{k:'unit',ph:'Einh.'},{k:'val',ph:'Wert'}])+row('Perioden-Navigation','<input type="checkbox" id="pPnav"'+(w.pnav?' checked':'')+'>');
      }
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
      if($('#pGrad'))$('#pGrad').onchange=function(){w.grad=this.checked;reChart();};
      if($('#pLeg'))$('#pLeg').onchange=function(){w.legend=this.checked;renderProps();reChart();};
      if($('#pLegPos'))$('#pLegPos').onchange=function(){w.legPos=this.value;reChart();};
      if($('#pYg'))$('#pYg').onchange=function(){w.ygrid=this.checked;reChart();};
      if($('#pDl'))$('#pDl').onchange=function(){w.labels=this.checked;reChart();};
      if($('#pShowT'))$('#pShowT').onchange=function(){w.showTitle=this.checked;reChart();renderProps();};
      if($('#pTitlePos'))$('#pTitlePos').onchange=function(){w.titlePos=this.value;reChart();};
      if($('#pYLab'))$('#pYLab').onchange=function(){w.yLabels=this.checked;reChart();};
      if($('#pXLab'))$('#pXLab').onchange=function(){w.xLabels=this.checked;reChart();};
      if($('#pXg'))$('#pXg').onchange=function(){w.xgrid=this.checked||undefined;reChart();};
      if($('#pAxLine'))$('#pAxLine').onchange=function(){w.axLine=this.checked||undefined;reChart();};
      if($('#pAxTicks'))$('#pAxTicks').onchange=function(){w.axTicks=this.checked||undefined;reChart();};
      if($('#pChUnit'))$('#pChUnit').oninput=function(){w.chUnit=this.value||undefined;reChart();};
      [['pFsTitle','fsTitle'],['pFsLegend','fsLegend'],['pAxFs','axFs'],['pFsAxName','fsAxName'],['pFsLabel','fsLabel']].forEach(function(o){
        var e=$('#'+o[0]);if(e)e.oninput=function(){w[o[1]]=(this.value===''?undefined:parseFloat(this.value));reChart();};
      });
      if($('#pGridDivs'))$('#pGridDivs').oninput=function(){w.gridDivs=this.value===''?undefined:parseInt(this.value);reChart();};
      if($('#pXTM'))$('#pXTM').onchange=function(){w.xTickMode=this.value||undefined;reChart();};
      if($('#pXTN'))$('#pXTN').oninput=function(){w.xTicks=this.value===''?undefined:Math.max(1,parseInt(this.value)||1);reChart();};
      if($('#pXFmt'))$('#pXFmt').onchange=function(){w.xFmt=this.value.trim()||undefined;reChart();};
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
      if(ct==='pie'||ct==='donut'||ct==='rose'){if(_ec[w.id])setPie(w);}
      else if(ct==='waterfall'){if((w.steps||[]).some(function(s){return s.vid===id;}))setWaterfall(w);}
      else if(_ec[w.id])chartPushRefresh(w);}
  });
