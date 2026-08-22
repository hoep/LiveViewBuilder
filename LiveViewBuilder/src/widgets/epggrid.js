  // ===== Widget: Programmfuehrer (epggrid) — Senderraster mit Zeitachse =====
  //
  // Zeigt, was auf vielen Sendern zur selben Zeit laeuft: links die Sender, oben
  // die Uhrzeit, dazwischen je Sendung ein Block in ihrer echten Laenge.
  //
  // Woher die Daten kommen
  // ----------------------
  // Aus dem Hook `?api=epg` und damit aus dem XMLTV-Bestand des Serienrecorders
  // (63 Sender, gut sechs Tage voraus), NICHT vom Receiver. Das ist der ganze
  // Trick an diesem Widget: vor- und zurueckblaettern kostet nichts, waehrend
  // jede Abfrage an die Box im selben Prozess beantwortet wird, in dem Enigma2
  // auch das Fernsehbild macht. Geladen wird immer nur das SICHTBARE Fenster
  // (Vorgabe drei Stunden); wer weiterblaettert, holt das naechste.
  //
  // Alle Farben sind Skinfarben. Es gibt keinen festen Hexwert im Widget - ein
  // Themenwechsel faerbt das Raster mit.
  /**
   * Darstellung der Bedienelemente - Pille, Knopf oder Unterstrich.
   *
   * Anlass: die Pillen standen in fester Groesse neben einer einstellbaren
   * Schrift, und je groesser die Schrift wurde, desto verlorener wirkten sie.
   * Jetzt richten sich Hoehe und Polster nach der Schriftgroesse, und die Form
   * ist waehlbar - dieselbe Funktion bedient die Kopfzeile UND die
   * Detailansicht, damit beide gleich aussehen.
   */
  function _epgKnopfStil(w,istFeld){
    var fs=parseFloat(w.epgBtnFs||w.epgFsH||w.epgFsN||13);
    var h=parseFloat(w.epgBtnH||Math.round(fs*2.1));
    var px=Math.round(fs*0.72), st=(w.epgBtnStil||'pill');
    var basis='font-size:'+fs+'px;height:'+h+'px;line-height:'+(h-2)+'px;padding:0 '+px+'px;'
             +'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;';
    if(istFeld)return basis+'border-radius:'+Math.round(h/2)+'px;';
    if(st==='button')return basis+'border-radius:'+Math.max(4,Math.round(h*0.22))+'px;';
    if(st==='line')  return basis+'border-radius:0;border:0;border-bottom:2px solid var(--line);background:transparent;padding:0 '+Math.round(px*0.6)+'px;';
    return basis+'border-radius:'+Math.round(h/2)+'px;';   // Pille
  }
  function _epgKnopf(w,schluessel,text,titel,rolle){
    return '<button class="epgb epgb-'+(w.epgBtnStil||'pill')+'" data-epg="'+schluessel+'"'
      +(rolle?' data-role="'+rolle+'"':'')+' title="'+esc(titel||'')+'" style="'+_epgKnopfStil(w)+'">'
      +esc(text)+'</button>';
  }

  var _EPGD={};        // je Widget-ID: zuletzt geladenes Fenster
  var _EPGL={};        // je Widget-ID: laeuft gerade eine Abfrage?

  function _epgVon(w){
    // Startzeitpunkt des Fensters. Zwei Wege fuehren dorthin: die Verschiebung
    // in Stunden, die man sich erblaettert hat, oder ein AUSDRUECKLICHER
    // Zeitpunkt (Hauptabend, ein Tag weiter). Der ausdrueckliche gewinnt -
    // sonst muesste man aus "20:15 am Dienstag" erst eine Stundenzahl rechnen,
    // die sich mit jeder Minute wieder aendert.
    if(w._epgAbs>0)return w._epgAbs;
    var q=Math.floor(Date.now()/900000)*900;
    return q+(w._epgOff||0)*3600;
  }
  /** Fenster auf einen Zeitpunkt setzen (Viertelstunde abgerundet). */
  function _epgAbsSetzen(w,ts){
    w._epgAbs=Math.floor(ts/900)*900;
    w._epgOff=0;
  }
  /** Uhrzeit am TAG DES AKTUELLEN FENSTERS - "20:15" meint den gezeigten Tag. */
  function _epgTagesZeit(w,std,min){
    var d=new Date(_epgVon(w)*1000);
    d.setHours(std,min||0,0,0);
    return Math.floor(d.getTime()/1000);
  }
  function _epgDauer(w){return Math.max(1,Math.min(12,parseFloat(w.epgH||3)))*3600;}
  function _epgCol(v,fb){var c=v?_skinColor(v):'';return c||fb;}

  function _epgFetch(w,root){
    if(_EPGL[w.id])return;
    _EPGL[w.id]=1;
    var von=_epgVon(w),dauer=_epgDauer(w);
    fetch('?api=epg&von='+von+'&dauer='+dauer,{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){_EPGL[w.id]=0;if(j&&j.ok){_EPGD[w.id]=j;_epgPaint(w,root);}else _epgLeer(w,(j&&j.fehler)||'keine Daten',root);})
      .catch(function(){_EPGL[w.id]=0;_epgLeer(w,'Programm nicht abrufbar',root);});
  }
  function _epgLeer(w,txt,root){
    var el=$('.w[data-id="'+w.id+'"] [data-role=epgbody]',(root||canvas));
    if(el)el.innerHTML='<div class="epgleer">'+esc(txt)+'</div>';
  }

  function _epgPaint(w,root){
    var d=_EPGD[w.id];if(!d)return;
    var host=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!host)return;
    var body=$('[data-role=epgbody]',host);if(!body)return;

    var rowH=Math.max(26,parseFloat(w.epgRow||54));
    var swb=Math.max(60,parseFloat(w.epgSw||132));
    var axH=Math.max(16,parseFloat(w.epgAxH||24));
    var span=(d.bis-d.von)||1;
    // Vorgabe: das geladene Fenster fuellt die Kachel genau aus. Alles andere
    // waere eine halbleere Flaeche rechts - und blaettern heisst ja gerade,
    // dass immer ein VOLLES Fenster zu sehen ist. Wer lieber scrollt, gibt eine
    // feste Breite je Stunde an; dann wird das Raster breiter als die Kachel.
    var frei=Math.max(120,(body.clientWidth||host.clientWidth||900)-swb-2);
    var pxH=(w.epgPxH>0)?Math.max(60,parseFloat(w.epgPxH)):(frei/(span/3600));
    var breite=Math.max(frei,Math.round(span/3600*pxH));
    if(!(w.epgPxH>0))breite=frei;
    var fsT=parseFloat(w.epgFsT||13),fsZ=parseFloat(w.epgFsZ||11),fsN=parseFloat(w.epgFsN||12);
    var rad=parseFloat(w.epgR!=null?w.epgR:8);
    var cBlk=_epgCol(w.epgCB,'var(--surface-2)'),cRun=_epgCol(w.epgCR,'var(--accent)');
    var cTit=_epgCol(w.epgCT,'var(--text)'),cZeit=_epgCol(w.epgCZ,'var(--muted)');
    var cNow=_epgCol(w.epgCN,'var(--warn)');
    var cRec=_epgCol(w.epgCM,'var(--crit)');
    var cFav=_epgCol(w.epgCF,'var(--warn)');    // Serie der Wunschliste
    var cSer=_epgCol(w.epgCS,'var(--info)');    // Serie, aber nicht auf der Liste
    var jetzt=Math.floor(Date.now()/1000);
    var q=(w._epgQ||'').toLowerCase();

    // Suche: sie blendet Sender ohne Treffer aus, statt nur zu faerben. Wer
    // "tatort" tippt, will die drei Zeilen sehen, nicht 63 durchsuchen.
    var kan=d.kanaele.filter(function(k){
      if(!q)return true;
      if(String(k.name).toLowerCase().indexOf(q)>=0)return true;
      return (k.p||[]).some(function(p){return String(p[2]+' '+(p[3]||'')).toLowerCase().indexOf(q)>=0;});
    });

    // --- Zeitleiste ---
    var raster=Math.max(15,parseFloat(w.epgGrid||30))*60;
    var ax='',t0=Math.ceil(d.von/raster)*raster;
    for(var t=t0;t<d.bis;t+=raster){
      var lx=Math.round((t-d.von)/span*breite);
      var dt=new Date(t*1000),hh=('0'+dt.getHours()).slice(-2)+':'+('0'+dt.getMinutes()).slice(-2);
      ax+='<div class="epgaxl" style="left:'+lx+'px;font-size:'+fsZ+'px;line-height:'+axH+'px;height:'+axH+'px">'+hh+'</div>';
    }

    // --- Sender und Bloecke ---
    var namen='',reihen='';
    kan.forEach(function(k){
      var pic=(w.epgPic!==false&&k.picon)
        ? '<img src="'+esc(k.picon)+'" alt="" style="height:'+parseFloat(w.epgPicH||24)+'px;max-width:'+(parseFloat(w.epgPicH||24)*2.2)+'px">' : '';
      namen+='<div class="epgn" style="height:'+rowH+'px;font-size:'+fsN+'px">'+pic+'<span>'+esc(k.name)+'</span></div>';
      var bl='';
      (k.p||[]).forEach(function(p){
        var a=Math.max(p[0],d.von),b=Math.min(p[1],d.bis);
        if(b<=a)return;
        var x=Math.round((a-d.von)/span*breite),bw=Math.max(2,Math.round((b-a)/span*breite)-3);
        var laeuft=(p[0]<=jetzt&&p[1]>jetzt);
        // Programmierte Aufnahme: 1 = gesetzt, 2 = gesetzt, aber abgeschaltet.
        var rec=p[8]|0;
        // Art der Sendung: 1 = Serie der Wunschliste, 2 = andere Serie, 0 = Rest.
        var art=p[7]|0;
        var tref=q&&(String(p[2]+' '+(p[3]||'')).toLowerCase().indexOf(q)>=0);
        // Der laufende Block hebt sich durch eine getoente Flaeche und einen
        // Streifen an der linken Kante ab - nicht durch eine andere Schriftfarbe,
        // die im hellen Skin sofort unlesbar waere.
        var hg=laeuft?('color-mix(in oklab,'+cRun+' 22%,'+cBlk+')'):cBlk;
        // Leichte Schraffur nach Art der Sendung. Bewusst LEICHT: das Raster soll
        // lesbar bleiben, die Markierung nur den Blick lenken. Deshalb eine
        // Schraffur statt einer Flaeche - sie faellt auf, ohne den Block
        // einzufaerben, und stoert die Farbe der laufenden Sendung nicht.
        var schraff='';
        if(w.epgArt!==false&&art>0){
          // Die beiden Arten unterscheiden sich nicht nur in der Farbe, sondern
          // auch im MUSTER: was aufgenommen wird, ist dichter schraffiert. Bei
          // dieser Deckkraft - und leicht soll es ja sein - liegen zwei Farbtoene
          // sonst so nah beieinander, dass man sie nebeneinander legen muesste,
          // um sie zu unterscheiden. Der Abstand der Streifen sieht man sofort.
          var ac=(art===1)?cFav:cSer;
          var ad=(art===1)?(w.epgArtA||12):(w.epgSerA||7);
          var aw=(art===1)?(w.epgArtW||7):(w.epgSerW||15);
          schraff='background-image:repeating-linear-gradient(135deg,'
            +'color-mix(in oklab,'+ac+' '+ad+'%,transparent) 0 3px,transparent 3px '+aw+'px);';
        }
        var kante=laeuft?('border-left:3px solid '+cRun+';'):'';
        // Was aufgenommen wird, bekommt zusaetzlich einen Rand in der
        // Aufnahmefarbe - der Punkt allein geht in einer vollen Zeile unter.
        if(rec===1)kante+='box-shadow:inset 0 0 0 1px '+cRec+';';
        var rest=Math.round((p[1]-jetzt)/60);
        var z=laeuft&&w.epgRest!==false
          ? ('noch '+(rest>=60?(Math.floor(rest/60)+' h '+(rest%60)+' min'):(rest+' min')))
          : (_epgUhr(p[0])+' – '+_epgUhr(p[1]));
        if(w.epgSub!==false&&p[3])z=p[3]+' · '+z;
        if(w.epgCat&&p[4])z=p[4]+' · '+z;
        // Ein Block von 20 Bildpunkten fasst keinen Text - dort steht sonst ein
        // angeschnittener Buchstabe, der wie ein Fehler aussieht. Der Titel bleibt
        // als Hinweistext am Zeiger erreichbar.
        var eng=(bw<30),halb=(bw<110);
        bl+='<div class="epgp'+(tref?' tref':'')+'" data-epgp="'+esc(k.id)+'|'+p[0]+'" title="'+esc(p[2]+(p[3]?' · '+p[3]:'')+' · '+_epgUhr(p[0])+'–'+_epgUhr(p[1]))+'"'
          +' style="left:'+x+'px;width:'+bw+'px;background:'+hg+';'+schraff+kante+'border-radius:'+rad+'px'+(eng?';padding:5px 3px':'')+'">'
          +(eng?(rec?('<div class="epgrec" style="background:'+(rec===1?cRec:cZeit)+'"></div>'):'')
               :('<div class="t" style="font-size:'+fsT+'px;color:'+cTit+'">'
                  +(rec?('<span class="epgrec" style="background:'+(rec===1?cRec:cZeit)+'" title="'+(rec===1?'wird aufgenommen':'Timer abgeschaltet')+'"></span>'):'')
                  +esc(p[2])+(p[5]?' <span style="opacity:.6">'+esc(p[5])+'</span>':'')+'</div>'))
          +((eng||halb)?'':('<div class="z" style="font-size:'+fsZ+'px;color:'+cZeit+'">'+esc(z)+'</div>'))+'</div>';
      });
      if(!bl)bl='<div class="epgp" style="left:0;width:'+(breite-3)+'px;background:'+cBlk+';border-radius:'+rad+'px">'
        +'<div class="z" style="font-size:'+fsZ+'px;color:'+cZeit+'">keine Programmdaten</div></div>';
      reihen+='<div class="epgrow" style="height:'+rowH+'px">'+bl+'</div>';
    });

    var nlx=Math.round((jetzt-d.von)/span*breite);
    var nl=(jetzt>=d.von&&jetzt<=d.bis)
      ? '<div class="epgnl" style="left:'+nlx+'px;background:'+cNow+'"></div>' : '';

    body.innerHTML=
      '<div class="epgnames" data-role="epgnames" style="width:'+swb+'px">'
      +'<div style="height:'+(axH+1)+'px;border-bottom:1px solid var(--line)"></div>'+namen+'</div>'
      +'<div class="epgsc" data-role="epgsc"><div class="epgin" style="width:'+breite+'px">'
      +'<div class="epgax" style="height:'+axH+'px">'+ax+'</div>'+reihen+nl+'</div></div>';

    // Senkrecht scrollen beide Spalten gemeinsam: die Sendernamen folgen dem
    // Raster, sonst stuenden nach dem Scrollen die falschen Namen vor den Zeilen.
    var sc=$('[data-role=epgsc]',host),nm=$('[data-role=epgnames]',host);
    if(sc&&nm)sc.onscroll=function(){nm.scrollTop=sc.scrollTop;};
    _epgKopf(w,host);
  }
  function _epgUhr(ts){var d=new Date(ts*1000);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}

  function _epgKopf(w,host){
    var d=_EPGD[w.id];if(!d)return;
    var tg=$('[data-role=epgtag]',host);
    if(tg){
      var v=new Date(d.von*1000),heute=new Date();
      var wt=['So','Mo','Di','Mi','Do','Fr','Sa'][v.getDay()];
      var gleich=v.toDateString()===heute.toDateString();
      var mor=new Date(heute.getTime()+86400000).toDateString()===v.toDateString();
      tg.textContent=(gleich?'Heute':(mor?'Morgen':wt+' '+v.getDate()+'.'+(v.getMonth()+1)+'.'));
    }
    var uh=$('[data-role=epguhr]',host);
    if(uh)uh.textContent=_epgUhr(d.von)+' – '+_epgUhr(d.bis);
    var jz=$('[data-role=epgjetzt]',host);
    if(jz)jz.classList.toggle('on',!(w._epgOff)&&!(w._epgAbs>0));
  }

  /**
   * Detailansicht einer Sendung.
   *
   * Die Beschreibung steht nicht im Raster - sie waere dort weder lesbar noch
   * uebertragenswert. Geholt wird sie erst beim Anklicken, und zwar genau fuer
   * diese eine Sendung (`detail=1`, ein Kanal, eine Minute Fenster).
   */
  function _epgDetail(w,schluessel){
    var teile=String(schluessel||'').split('|');
    if(teile.length<2)return;
    var kid=teile[0],start=parseInt(teile[1])||0;
    var d=_EPGD[w.id]||{},kan=null;
    (d.kanaele||[]).forEach(function(k){if(k.id===kid)kan=k;});
    if(!kan)return;
    var roh=null;
    (kan.p||[]).forEach(function(p){if(p[0]===start)roh=p;});
    if(!roh)return;
    w._epgSelP={ref:kan.ref,sender:kan.name,picon:kan.picon,start:roh[0],ende:roh[1],
                titel:roh[2],kurz:roh[3]||'',cat:roh[4]||'',folge:roh[5]||'',desc:''};
    _epgOverlay(w);
    fetch('?api=epg&von='+start+'&dauer=1800&detail=1&kanaele='+encodeURIComponent(kid),{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        var k=(j&&j.kanaele&&j.kanaele[0])||null;if(!k)return;
        (k.p||[]).forEach(function(p){if(p[0]===start&&p[6])w._epgSelP.desc=p[6];});
        _epgOverlay(w);
      }).catch(function(){});
  }
  function _epgZu(w){
    w._epgSelP=null;w._epgMsg='';
    var el=$('.w[data-id="'+w.id+'"] [data-role=epgov]',canvas);
    if(el)el.parentNode.removeChild(el);
  }
  function _epgOverlay(w){
    var host=$('.w[data-id="'+w.id+'"]',canvas);if(!host)return;
    var s=w._epgSelP;if(!s)return;
    var el=$('[data-role=epgov]',host);
    if(!el){el=document.createElement('div');el.className='epgov';el.setAttribute('data-role','epgov');
      ($('.epgw',host)||host).appendChild(el);}
    var zeile=[s.folge,s.kurz,s.cat].filter(function(x){return !!x;}).join(' · ');
    var dat=new Date(s.start*1000),wt=['So','Mo','Di','Mi','Do','Fr','Sa'][dat.getDay()];
    el.innerHTML='<div class="epgovc">'
      +'<div class="epgovh">'+(s.picon?'<img src="'+esc(s.picon)+'" alt="">':'')
        +'<b>'+esc(s.sender)+'</b><span>'+wt+' '+dat.getDate()+'.'+(dat.getMonth()+1)+'. · '
        +_epgUhr(s.start)+' – '+_epgUhr(s.ende)+' · '+Math.round((s.ende-s.start)/60)+' min</span>'
        +'<span class="sp"></span><button class="epgb epgb-'+(w.epgBtnStil||'pill')+'" data-epgov="close" style="'+_epgKnopfStil(w)+'">schließen</button></div>'
      +'<div class="epgovt">'+esc(s.titel)+'</div>'
      +(zeile?'<div class="epgovs">'+esc(zeile)+'</div>':'')
      +(s.desc?'<div class="epgovd">'+esc(s.desc)+'</div>':'')
      +'<div class="epgovb"><button class="epgb on epgb-'+(w.epgBtnStil||'pill')+'" data-epgov="rec" style="'+_epgKnopfStil(w)+'">Aufnehmen</button>'
        +'<span class="epgovm" data-role="epgovm">'+esc(w._epgMsg||'')+'</span></div></div>';
  }
  /**
   * Aufnahme anstossen.
   *
   * Das Widget schreibt nur den AUFTRAG in eine Variable - programmiert wird in
   * Symcon, wo das Scharf-Gate des Receivermoduls sitzt. Eine Seite im Browser
   * soll den Receiver nicht direkt beschreiben koennen.
   *
   * Wichtig dabei: mitgeschickt werden die XMLTV-Zeiten, aber verbindlich sind
   * die der Box - das Skript holt sie sich ueber ER_SucheSendung selbst.
   */
  function _epgAufnehmen(w){
    var s=w._epgSelP;if(!s)return;
    if(!w.epgSel){w._epgMsg='keine Auftragsvariable eingestellt';_epgOverlay(w);return;}
    if(!s.ref){w._epgMsg='dieser Sender ist keinem Sender der Box zugeordnet';_epgOverlay(w);return;}
    setVar(w.epgSel,JSON.stringify({ref:s.ref,sender:s.sender,start:s.start,ende:s.ende,
                                    titel:s.titel,kurz:s.kurz}));
    w._epgMsg='Auftrag läuft …';_epgOverlay(w);
    if(!w.epgMsgVar)return;
    // Auf die Antwort warten. Bewusst kurz und begrenzt: nach zehn Sekunden ist
    // entweder etwas passiert oder etwas kaputt.
    var n=0,iv=setInterval(function(){
      n++;
      fetch('?api=val&ids='+w.epgMsgVar,{cache:'no-store'}).then(function(r){return r.json();})
        .then(function(j){
          var v=j&&j.values&&j.values[w.epgMsgVar];
          if(v&&String(v.v)!==''&&String(v.v)!==w._epgMsg){
            w._epgMsg=String(v.v);_epgOverlay(w);clearInterval(iv);
          }
        }).catch(function(){});
      if(n>14){clearInterval(iv);}
    },700);
  }

  defWidget('epggrid',{
    label:'Programmführer', cat:'Medien', paletteIcon:'tv', size:[900,520],
    defaults:function(w){w.epgH=3;w.epgPxH=260;w.epgRow=54;w.epgSw=132;},
    render:function(w){
      var fsH=parseFloat(w.epgFsH||w.epgFsN||13);
      var hdH=parseFloat(w.epgHdH||Math.round(fsH*2.4));
      var kopf=(w.epgHead===false)?'':
        '<div class="epghd" style="font-size:'+fsH+'px;min-height:'+hdH+'px;padding-bottom:'+Math.max(2,Math.round(hdH*0.18))+'px">'
        +'<span class="epgtag" data-role="epgtag">Heute</span>'
        +'<span class="epguhr" data-role="epguhr">–</span>'
        +(w.epgQ!==false?'<input class="epgq" data-role="epgq" style="'+_epgKnopfStil(w,true)+'" placeholder="'+esc(w.epgQPh||'Sendung suchen …')+'" value="'+esc(w._epgQ||'')+'">':'')
        +'<span class="sp"></span>'
        // Reihenfolge wie gewuenscht: erst einen Tag weiter, dann die beiden
        // Abendmarken, dann das Blaettern.
        +(w.epgTag!==false?_epgKnopf(w,'tag1','+1 Tag','ein Tag weiter, gleiche Uhrzeit'):'')
        +(w.epgAbend!==false?_epgKnopf(w,'2015','20:15','Hauptabendprogramm des gezeigten Tages'):'')
        +(w.epgAbend!==false?_epgKnopf(w,'2200','22:00','22 Uhr des gezeigten Tages'):'')
        +_epgKnopf(w,'prev','‹','ein Fenster zurück')
        +_epgKnopf(w,'now','jetzt','zurück auf die Gegenwart','epgjetzt')
        +_epgKnopf(w,'next','›','ein Fenster weiter')
        +'</div>';
      return '<div class="epgw">'+kopf+'<div class="epgbody" data-role="epgbody"></div></div>';
    },
    mount:function(w){_epgFetch(w);},
    // Vom Zeitgeber gerufen (60-Sekunden-Runde): die Jetzt-Linie wandert, und
    // sobald das Fenster abgelaufen oder der Bestand aelter als zehn Minuten ist,
    // wird es neu geholt. Das kostet nichts - die Daten liegen lokal.
    tick:function(w){
      var d=_EPGD[w.id];
      if(!d){_epgFetch(w);return;}
      var jetzt=Math.floor(Date.now()/1000);
      if(!w._epgOff&&!(w._epgAbs>0)&&(jetzt>d.bis-60||jetzt-d.jetzt>600)){_epgFetch(w);return;}
      _epgPaint(w);
    },
    // Klicks: blaettern, zurueck auf jetzt, oder eine Sendung anfassen.
    click:function(w,el,e){
      var b=e.target.closest('[data-epg]');
      if(b){
        var k=b.getAttribute('data-epg'),st=parseFloat(w.epgH||3);
        if(k==='now'){ w._epgAbs=0; w._epgOff=0; }
        else if(k==='tag1'){ _epgAbsSetzen(w,_epgVon(w)+86400); }
        else if(k==='2015'){ _epgAbsSetzen(w,_epgTagesZeit(w,20,15)); }
        else if(k==='2200'){ _epgAbsSetzen(w,_epgTagesZeit(w,22,0)); }
        else if(w._epgAbs>0){ _epgAbsSetzen(w,w._epgAbs+(k==='next'?1:-1)*st*3600); }
        else {
          w._epgOff=(w._epgOff||0)+(k==='next'?st:-st);
          if(w._epgOff<-48)w._epgOff=-48; if(w._epgOff>144)w._epgOff=144;
        }
        _epgFetch(w);
        return true;
      }
      var ov=e.target.closest('[data-epgov]');
      if(ov){
        var k=ov.getAttribute('data-epgov');
        if(k==='close'){_epgZu(w);return true;}
        if(k==='rec'){_epgAufnehmen(w);return true;}
        return true;
      }
      var p=e.target.closest('[data-epgp]');
      if(p){
        if(w.epgTapPop){openPopup(w.epgTapPop,_aliasMap(w));return true;}
        _epgDetail(w,p.getAttribute('data-epgp'));
        return true;
      }
      return false;
    },
    input:function(w,el,e){
      var q=e.target.closest('[data-role=epgq]');
      if(!q)return false;
      w._epgQ=q.value;
      _epgPaint(w);
      // Nach dem Neuzeichnen ist das Feld ein anderes Element - Fokus und
      // Schreibmarke muessen zurueck, sonst tippt man ins Leere.
      var neu=$('.w[data-id="'+w.id+'"] [data-role=epgq]',canvas);
      if(neu){neu.focus();neu.setSelectionRange(neu.value.length,neu.value.length);}
      return true;
    },
    props:function(w){
      return row('Fenster (Stunden)','<input id="pEpgH" type="number" min="1" max="12" step="1" value="'+(w.epgH||3)+'"> <span style="font-size:11px;color:var(--muted)">geladen wird immer nur dieses Fenster</span>')
        +row('Breite je Stunde','<input id="pEpgPx" type="number" min="60" max="900" step="10" value="'+(w.epgPxH||260)+'"> px')
        +row('Zeilenhöhe','<input id="pEpgRow" type="number" min="26" max="140" step="2" value="'+(w.epgRow||54)+'"> px')
        +row('Sender-Spalte','<input id="pEpgSw" type="number" min="60" max="400" step="4" value="'+(w.epgSw||132)+'"> px')
        +row('Zeitraster','<select id="pEpgGrid"><option value="15"'+(String(w.epgGrid)==='15'?' selected':'')+'>15 min</option><option value="30"'+(!w.epgGrid||String(w.epgGrid)==='30'?' selected':'')+'>30 min</option><option value="60"'+(String(w.epgGrid)==='60'?' selected':'')+'>60 min</option></select>')
        +'<div class="pgh">Kopfzeile</div>'
        +row('Kopfzeile','<input type="checkbox" id="pEpgHead"'+(w.epgHead!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Tag, Fenster, Sprungmarken, Blättern</span>')
        +row('Höhe / Schrift','<input id="pEpgHdH" type="number" min="18" max="90" value="'+(w.epgHdH||'')+'" placeholder="auto" style="width:66px" title="Höhe der Titelleiste in px"> '
            +'<input id="pEpgFsH" type="number" min="8" max="30" value="'+(w.epgFsH||'')+'" placeholder="13" style="width:66px" title="Schriftgröße der Titelleiste"> px')
        +row('Bedienelemente','<select id="pEpgBtnStil">'
            +['pill','button','line'].map(function(v,i){return '<option value="'+v+'"'+(((w.epgBtnStil||'pill')===v)?' selected':'')+'>'+['Pille','Knopf','Unterstrich'][i]+'</option>';}).join('')
            +'</select> <input id="pEpgBtnFs" type="number" min="8" max="30" value="'+(w.epgBtnFs||'')+'" placeholder="wie Kopf" style="width:74px" title="Schriftgröße"> '
            +'<input id="pEpgBtnH" type="number" min="14" max="64" value="'+(w.epgBtnH||'')+'" placeholder="auto" style="width:66px" title="Höhe in px"> '
            +'<span style="font-size:11px;color:var(--muted)">gilt auch für die Detailansicht</span>')
        +row('Sprungmarken','<input type="checkbox" id="pEpgTag"'+(w.epgTag!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">+1 Tag</span> '
            +'<input type="checkbox" id="pEpgAbend"'+(w.epgAbend!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">20:15 und 22:00</span>')
        +row('Suchfeld','<input type="checkbox" id="pEpgQ"'+(w.epgQ!==false?' checked':'')+'> <input id="pEpgQPh" value="'+esc(w.epgQPh||'')+'" placeholder="Platzhaltertext" style="width:150px">')
        +row('Senderlogo','<input type="checkbox" id="pEpgPic"'+(w.epgPic!==false?' checked':'')+'> <input id="pEpgPicH" type="number" min="10" max="60" value="'+(w.epgPicH||24)+'" style="width:56px" title="Höhe in px">')
        +row('Untertitel','<input type="checkbox" id="pEpgSub"'+(w.epgSub!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Episodentitel im Block</span>')
        +row('Genre','<input type="checkbox" id="pEpgCat"'+(w.epgCat?' checked':'')+'>')
        +row('Restzeit','<input type="checkbox" id="pEpgRest"'+(w.epgRest!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">bei laufender Sendung statt der Zeitspanne</span>')
        +row('Ecken','<input id="pEpgR" type="number" min="0" max="20" value="'+(w.epgR!=null?w.epgR:8)+'"> px')
        +'<div class="pgh">Aufnahme (Klick auf eine Sendung)</div>'
        +row('Auftragsvariable','<input id="pEpgSel" value="'+(w.epgSel||'')+'" placeholder="ID der String-Variablen"> <span style="font-size:11px;color:var(--muted)">hier legt die Kachel den Auftrag ab</span>')
        +row('Rückmeldung','<input id="pEpgMsg" value="'+(w.epgMsgVar||'')+'" placeholder="ID der String-Variablen"> <span style="font-size:11px;color:var(--muted)">was das Skript geantwortet hat</span>')
        +'<div class="pgh">Farben (alle aus dem Skin)</div>'
        +row('Block',skinSel(w.epgCB||'','id="pEpgCB"')+' <span style="font-size:11px;color:var(--muted)">leer = Flächenfarbe</span>')
        +row('läuft gerade',skinSel(w.epgCR||'','id="pEpgCR"')+' <span style="font-size:11px;color:var(--muted)">leer = Akzent</span>')
        +row('Titel',skinSel(w.epgCT||'','id="pEpgCT"'))
        +row('Zeit/Untertitel',skinSel(w.epgCZ||'','id="pEpgCZ"'))
        +row('Jetzt-Linie',skinSel(w.epgCN||'','id="pEpgCN"')+' <span style="font-size:11px;color:var(--muted)">leer = Warnfarbe</span>')
        +row('Aufnahme-Marke',skinSel(w.epgCM||'','id="pEpgCM"')+' <span style="font-size:11px;color:var(--muted)">programmierte Sendung, leer = kritisch</span>')
        +'<div class="pgh">Serien hervorheben</div>'
        +row('Serien schraffieren','<input type="checkbox" id="pEpgArt"'+(w.epgArt!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Serie erkannt an Episodennummer oder Kategorie</span>')
        +row('Programmierte',skinSel(w.epgCF||'','id="pEpgCF"')
            +' <input id="pEpgArtA" type="number" min="2" max="40" value="'+(w.epgArtA||12)+'" style="width:52px" title="Deckkraft in Prozent">'
            +' <input id="pEpgArtW" type="number" min="5" max="40" value="'+(w.epgArtW||7)+'" style="width:52px" title="Streifenabstand in px">'
            +' <span style="font-size:11px;color:var(--muted)">Serien der Wunschliste · leer = Warnfarbe</span>')
        +row('Nicht programmierte',skinSel(w.epgCS||'','id="pEpgCS"')
            +' <input id="pEpgSerA" type="number" min="2" max="40" value="'+(w.epgSerA||7)+'" style="width:52px" title="Deckkraft in Prozent">'
            +' <input id="pEpgSerW" type="number" min="5" max="40" value="'+(w.epgSerW||15)+'" style="width:52px" title="Streifenabstand in px">'
            +' <span style="font-size:11px;color:var(--muted)">alle übrigen Serien · leer = Infofarbe</span>')
        +'<div class="pgh">Schriftgrößen (px)</div>'
        +row('Titel / Zeit / Sender','<input id="pEpgFsT" type="number" min="8" max="24" value="'+(w.epgFsT||13)+'" style="width:56px"> '
           +'<input id="pEpgFsZ" type="number" min="7" max="20" value="'+(w.epgFsZ||11)+'" style="width:56px"> '
           +'<input id="pEpgFsN" type="number" min="8" max="22" value="'+(w.epgFsN||12)+'" style="width:56px">');
    },
    wire:function(w){
      function num(id,k,d){var e=$(id);if(e)e.oninput=function(){w[k]=parseFloat(this.value)||d;render();commit();};}
      function chk(id,k,inv){var e=$(id);if(e)e.onchange=function(){w[k]=inv?(this.checked?undefined:false):(this.checked||undefined);render();commit();};}
      function sel(id,k){var e=$(id);if(e)e.onchange=function(){w[k]=this.value||undefined;render();commit();};}
      num('#pEpgH','epgH',3);num('#pEpgPx','epgPxH',260);num('#pEpgRow','epgRow',54);num('#pEpgSw','epgSw',132);
      num('#pEpgPicH','epgPicH',24);num('#pEpgR','epgR',8);
      num('#pEpgFsT','epgFsT',13);num('#pEpgFsZ','epgFsZ',11);num('#pEpgFsN','epgFsN',12);
      sel('#pEpgGrid','epgGrid');
      chk('#pEpgHead','epgHead',1);chk('#pEpgQ','epgQ',1);chk('#pEpgPic','epgPic',1);
      chk('#pEpgTag','epgTag',1);chk('#pEpgAbend','epgAbend',1);
      sel('#pEpgBtnStil','epgBtnStil');
      ['HdH','FsH','BtnFs','BtnH'].forEach(function(k){
        var e=$('#pEpg'+k);
        if(e)e.oninput=function(){w['epg'+k]=parseFloat(this.value)||undefined;render();commit();};
      });
      chk('#pEpgSub','epgSub',1);chk('#pEpgRest','epgRest',1);chk('#pEpgCat','epgCat');
      if($('#pEpgQPh'))$('#pEpgQPh').oninput=function(){w.epgQPh=this.value||undefined;render();commit();};
      ['CB','CR','CT','CZ','CN','CM','CF','CS'].forEach(function(k){sel('#pEpg'+k,'epg'+k);});
      chk('#pEpgArt','epgArt',1);
      num('#pEpgArtA','epgArtA',12);num('#pEpgArtW','epgArtW',7);
      num('#pEpgSerA','epgSerA',7);num('#pEpgSerW','epgSerW',15);
      if($('#pEpgSel'))$('#pEpgSel').onchange=function(){w.epgSel=parseInt(this.value)||undefined;commit();};
      if($('#pEpgMsg'))$('#pEpgMsg').onchange=function(){w.epgMsgVar=parseInt(this.value)||undefined;commit();};
    }
  });
