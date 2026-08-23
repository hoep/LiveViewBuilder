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

  /**
   * Legende neben dem Suchfeld.
   *
   * Die Schraffuren sind absichtlich leicht - das Raster soll lesbar bleiben.
   * Genau deshalb erklaeren sie sich nicht von selbst: wer sie zum ersten Mal
   * sieht, haelt sie fuer einen Verlauf. Die Legende zeigt dieselben Muster in
   * klein, aus denselben Werten gebaut; wer eine Farbe umstellt, sieht es hier
   * sofort mit.
   *
   * Was abgeschaltet ist, erscheint auch nicht - eine Legende fuer eine
   * Markierung, die es nicht gibt, waere schlimmer als keine.
   */
  function _epgLegende(w){
    if(w.epgLeg===false)return '';
    var fs=Math.max(9,Math.round(parseFloat(w.epgFsH||w.epgFsN||12)*0.8));
    var h=Math.max(10,Math.round(fs*1.15)),br=Math.max(2,Math.round(fs*0.25));
    var cBlk=_epgCol(w.epgCB,'var(--surface-2)');
    function probe(stil){
      return '<span style="display:inline-block;width:'+Math.round(h*1.6)+'px;height:'+h+'px;'
        +'border-radius:'+br+'px;background:'+cBlk+';border:1px solid var(--line);vertical-align:-2px;'+stil+'"></span>';
    }
    var rw=Math.max(1,parseFloat(w.epgRandW||2));
    function rand(farbe){return 'box-shadow:inset 0 0 0 '+rw+'px color-mix(in oklab,'+farbe+' 70%,transparent);';}
    var teile=[];
    if(w.epgArt!==false){
      teile.push([probe(rand(_epgCol(w.epgCF,'var(--info)'))),'Wunschserie']);
      teile.push([probe(rand(_epgCol(w.epgCS,'var(--line)'))),'andere Serie']);
    }
    if(w.epgHave!==false){
      teile.push([probe(rand(_epgCol(w.epgCH,'var(--warn)'))),'schon aufgenommen']);
      teile.push([probe(rand(_epgCol(w.epgCFl,'var(--ok)'))),'Film vorhanden']);
    }
    teile.push([probe('box-shadow:inset 0 0 0 '+rw+'px '+_epgCol(w.epgCM,'var(--crit)')+';'),'programmiert']);
    teile.push([probe('border-left:3px solid '+_epgCol(w.epgCR,'var(--accent)')+';'),'läuft gerade']);
    return '<span class="epgleg" style="display:inline-flex;align-items:center;gap:'+Math.round(fs*0.6)+'px;'
      +'font-size:'+fs+'px;color:var(--muted);white-space:nowrap;margin-left:'+Math.round(fs*0.8)+'px">'
      +teile.map(function(t){return '<span style="display:inline-flex;align-items:center;gap:4px">'+t[0]+esc(t[1])+'</span>';}).join('')
      +'</span>';
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
    var cFav=_epgCol(w.epgCF,'var(--info)');    // Serie der Wunschliste
    var cSer=_epgCol(w.epgCS,'var(--line)');    // Serie, aber nicht auf der Liste
    var cHav=_epgCol(w.epgCH,'var(--warn)');    // liegt schon auf der Platte
    var cFlm=_epgCol(w.epgCFl,'var(--ok)');     // liegt als Film in der flachen Ablage
    var jetzt=Math.floor(Date.now()/1000);
    var q=(w._epgQ||'').toLowerCase();

    // Suche: sie blendet Sender ohne Treffer aus, statt nur zu faerben. Wer
    // "tatort" tippt, will die drei Zeilen sehen, nicht 63 durchsuchen.
    var kan=d.kanaele.filter(function(k){
      if(!q)return true;
      if(String(k.name).toLowerCase().indexOf(q)>=0)return true;
      // Auch ueber die Namen des Serienrecorders suchen: wer "CSI Miami" tippt,
      // meint die Serie, nicht die Schreibweise des Senders.
      return (k.p||[]).some(function(p){return String(p[2]+' '+(p[3]||'')+' '+(p[11]||'')+' '+(p[12]||'')).toLowerCase().indexOf(q)>=0;});
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
        // Kennzeichnung ueber den RAND, nicht ueber Schraffuren. Zwei leichte
        // Streifenmuster waren nebeneinander kaum zu unterscheiden - ein Rand ist
        // eine Linie, und Linien vergleicht das Auge muehelos.
        //
        // Nur EINE Aussage je Block, in dieser Reihenfolge:
        //   schon aufgenommen  (die Sendung liegt bereits da - das erspart Arbeit)
        //                      eigene Farbe, wenn der Fund aus einer Filmablage kommt
        //   Wunschserie        (wird aufgenommen)
        //   andere Serie       (koennte man aufnehmen)
        // Was programmiert ist, bekommt seinen eigenen Rand weiter unten und
        // ueberschreibt diesen - eine gesetzte Aufnahme ist die staerkste Aussage.
        // 1/2 = Serienfolge auf der Platte, 3 = Film aus einer flachen Ablage.
        // Die Aussage ist eine andere: bei der Serie stimmen Serie UND Folge
        // ueberein, beim Film nur der Titel. Deshalb eine eigene Farbe.
        var vor=(w.epgHave!==false)?(p[9]|0):0;
        var rw=Math.max(1,parseFloat(w.epgRandW||2));
        var rc='';
        if(vor===3)rc=cFlm;
        else if(vor>0)rc=cHav;
        else if(w.epgArt!==false&&art===1)rc=cFav;
        else if(w.epgArt!==false&&art===2)rc=cSer;
        var schraff=rc?('box-shadow:inset 0 0 0 '+rw+'px color-mix(in oklab,'+rc+' 70%,transparent);'):'';
        var kante=laeuft?('border-left:3px solid '+cRun+';'):'';
        // Was aufgenommen wird, bekommt den Rand in der Aufnahmefarbe - und zwar
        // STATT der Kennzeichnung oben: zwei Raender an einem Block waeren zwei
        // Aussagen an derselben Linie. Der Punkt allein ginge in einer vollen
        // Zeile unter.
        if(rec===1){schraff='';kante+='box-shadow:inset 0 0 0 '+Math.max(1,rw)+'px '+cRec+';';}
        var rest=Math.round((p[1]-jetzt)/60);
        // Serie und Episode: die Namen des Serienrecorders schlagen die des XMLTV.
        // Das XMLTV kennt nur einen Titel und presst beides hinein - "Tatort:
        // Trotzdem", "Der Wien-Krimi: Blind ermittelt". Der Serienrecorder hat den
        // Titel laengst zerlegt und auf die Ablage abgebildet: die Serie heisst
        // "Tatort" mit der Folge "Voss - 10 - Trotzdem", "CSI: Miami" liegt unter
        // "CSI Miami". Genau diese Namen tragen die Aufnahmen auf der Platte, und
        // nur mit ihnen findet man im Raster wieder, was man dort sucht.
        var titel=(w.epgSrTitel!==false&&p[11])?p[11]:p[2];
        var unter=(w.epgSrTitel!==false&&p[12])?p[12]:(p[3]||'');
        var z=laeuft&&w.epgRest!==false
          ? ('noch '+(rest>=60?(Math.floor(rest/60)+' h '+(rest%60)+' min'):(rest+' min')))
          : (_epgUhr(p[0])+' – '+_epgUhr(p[1]));
        if(w.epgSub!==false&&unter)z=unter+' · '+z;
        if(w.epgCat&&p[4])z=p[4]+' · '+z;
        // Ein Block von 20 Bildpunkten fasst keinen Text - dort steht sonst ein
        // angeschnittener Buchstabe, der wie ein Fehler aussieht. Der Titel bleibt
        // als Hinweistext am Zeiger erreichbar.
        // Nummer: die des Serienrecorders schlaegt die des XMLTV. Fuer die
        // Krimireihen ist das der ganze Unterschied - das XMLTV traegt dort nur
        // eine laufende Nummer ("E1245"), der Katalog die Staffel, unter der die
        // Folge auch im Aufnahmebestand liegt ("S2024E21").
        var nr=(p[10]||p[5]||'');
        var eng=(bw<30),halb=(bw<110);
        bl+='<div class="epgp'+(tref?' tref':'')+'" data-epgp="'+esc(k.id)+'|'+p[0]+'" title="'+esc(titel+(unter?' · '+unter:'')+' · '+_epgUhr(p[0])+'–'+_epgUhr(p[1]))+'"'
          +' style="left:'+x+'px;width:'+bw+'px;background:'+hg+';'+schraff+kante+'border-radius:'+rad+'px'+(eng?';padding:5px 3px':'')+'">'
          +(eng?(rec?('<div class="epgrec" style="background:'+(rec===1?cRec:cZeit)+'"></div>'):'')
               :('<div class="t" style="font-size:'+fsT+'px;color:'+cTit+'">'
                  +(rec?('<span class="epgrec" style="background:'+(rec===1?cRec:cZeit)+'" title="'+(rec===1?'wird aufgenommen':'Timer abgeschaltet')+'"></span>'):'')
                  +esc(titel)+(nr?' <span style="opacity:.6">'+esc(nr)+'</span>':'')+'</div>'))
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
    w._epgSelP={kid:kan.id,ref:kan.ref,sender:kan.name,picon:kan.picon,start:roh[0],ende:roh[1],
                titel:roh[11]||roh[2],kurz:roh[12]||roh[3]||'',epgTitel:roh[2],cat:roh[4]||'',
                folge:roh[10]||roh[5]||'',desc:'',art:roh[7]||0,rec:roh[8]||0,vor:roh[9]||0};
    w._epgMehr=false;
    _epgOverlay(w);
    fetch('?api=epg&von='+start+'&dauer=1800&detail=1&kanaele='+encodeURIComponent(kid),{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        var k=(j&&j.kanaele&&j.kanaele[0])||null;if(!k)return;
        (k.p||[]).forEach(function(p){if(p[0]===start&&p[6]){w._epgSelP.desc=p[6];w._epgSelP.descTvdb=(p[13]===1);}});
        _epgOverlay(w);
      }).catch(function(){});
  }
  function _epgZu(w){
    w._epgSelP=null;w._epgMsg='';w._epgWeg=false;
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
    var mehr=_epgMehrHtml(w,s);
    var dat=new Date(s.start*1000),wt=['So','Mo','Di','Mi','Do','Fr','Sa'][dat.getDay()];
    el.innerHTML='<div class="epgovc">'
      +'<div class="epgovh">'+(s.picon?'<img src="'+esc(s.picon)+'" alt="">':'')
        +'<b>'+esc(s.sender)+'</b><span>'+wt+' '+dat.getDate()+'.'+(dat.getMonth()+1)+'. · '
        +_epgUhr(s.start)+' – '+_epgUhr(s.ende)+' · '+Math.round((s.ende-s.start)/60)+' min</span>'
        +'<span class="sp"></span><button class="epgb epgb-'+(w.epgBtnStil||'pill')+'" data-epgov="close" style="'+_epgKnopfStil(w)+'">schließen</button></div>'
      +'<div class="epgovt">'+esc(s.titel)+'</div>'
      +(zeile?'<div class="epgovs">'+esc(zeile)+'</div>':'')
      // Liegt es schon da, ist das die erste Frage beim Aufmachen - und die
      // Antwort haengt daran, WORAUF sie beruht: bei der Serie auf Serie und
      // Folge, beim Film allein auf dem Titel.
      +(s.vor?('<div class="epgovs" style="color:'+(s.vor===3?_epgCol(w.epgCFl,'var(--ok)'):_epgCol(w.epgCH,'var(--warn)'))+'">'
          +(s.vor===3?'liegt als Film in der Aufnahmeablage'
                     :(s.vor===2?'liegt mehrfach auf der Platte':'liegt schon auf der Platte'))+'</div>'):'')
      // Woher der Text stammt, gehoert dazu: das EPG beschreibt DIESE Ausstrahlung,
      // der Episodenkatalog die Folge. Meist dasselbe - aber nicht immer, und wer
      // eine Abweichung sucht, soll wissen, wen er fragt.
      +(s.desc?('<div class="epgovd">'+esc(s.desc)
          +(s.descTvdb?'<span class="epgovq"> · aus dem Episodenkatalog</span>':'')+'</div>'):'')
      +mehr
      +'<div class="epgovb">'+_epgRecKnopf(w,s)
        +_epgSerienKnopf(w,s)
        +'<button class="epgb epgb-'+(w.epgBtnStil||'pill')+'" data-epgov="mehr" style="'+_epgKnopfStil(w)+'" title="alle Angaben aus dem Programmbestand">'
        +(w._epgMehr?'Weniger ▴':'Mehr ▾')+'</button>'
        +'<span class="epgovm" data-role="epgovm">'+esc(w._epgMsg||'')+'</span></div></div>';
  }
  /**
   * Die ausgeklappten Angaben - alles, was XMLTV zu dieser Sendung hergibt.
   *
   * Aufgebaut wird erst, wenn jemand aufklappt; geholt wird EINMAL je Sendung
   * (danach steht es im Objekt). Leere Felder erscheinen gar nicht - eine
   * Tabelle voller Striche sagt weniger als drei gefuellte Zeilen.
   */
  function _epgMehrHtml(w,s){
    if(!w._epgMehr)return '';
    var d=s.mehr;
    if(!d)return '<div class="epgovm2">wird geladen …</div>';
    var reihen=[];
    function txt(k,v){if(v)reihen.push([k,esc(String(v))]);}
    function leute(k,l,mitRolle){
      if(!l||!l.length)return;
      reihen.push([k,l.map(function(e){
        var n=esc(e[0]);
        return (mitRolle&&e[1])?(n+' <span style="opacity:.6">als '+esc(e[1])+'</span>'):n;
      }).join(', ')]);
    }
    if(d.kategorien&&d.kategorien.length)txt('Genre',d.kategorien.join(', '));
    txt('Jahr',d.jahr); txt('Land',d.land); txt('Sprache',d.sprache);
    txt('Gattung',d.gattung); txt('Status',d.status);
    if(d.bewertung)txt('Bewertung',d.bewertung+(d.bewertungQuelle?(' / 10 · '+d.bewertungQuelle):' / 10'));
    txt('Altersfreigabe',d.freigabe);
    if(d.wiederholung)txt('Hinweis','Wiederholung');
    leute('Schauspieler',d.schauspieler,true);
    leute('Regie',d.regie); leute('Drehbuch',d.drehbuch); leute('Musik',d.musik);
    leute('Moderation',d.moderation); leute('Gäste',d.gaeste); leute('Produktion',d.produktion);
    if(d.kennungen&&d.kennungen.length)txt('Kennung',d.kennungen.map(function(e){return e[0]+': '+e[1];}).join(' · '));
    if(!reihen.length)return '<div class="epgovm2">keine weiteren Angaben im Programmbestand</div>';
    return '<div class="epgovtab">'+reihen.map(function(r){
      return '<div class="epgovk">'+r[0]+'</div><div class="epgovv">'+r[1]+'</div>';
    }).join('')+'</div>';
  }
  function _epgMehrHolen(w){
    var s=w._epgSelP;if(!s||s.mehr)return;
    fetch('?api=epgdetail&kanal='+encodeURIComponent(s.kid||'')+'&start='+s.start,{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){ if(j&&j.ok){ s.mehr=j.mehr||{}; _epgOverlay(w); } })
      .catch(function(){ s.mehr={}; _epgOverlay(w); });
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
  /**
   * Der Aufnahme-Knopf. Er hat drei Zustaende, weil die Sendung drei hat.
   *
   * Ist nichts programmiert, laedt er dazu ein. Ist etwas programmiert, ist
   * "Aufnehmen" die falsche Zusage - dann gehoert dorthin der Rueckweg. Und
   * weil Loeschen am Receiver nicht rueckgaengig zu machen ist, fragt er
   * einmal nach: der erste Klick stellt die Frage, erst der zweite loescht.
   */
  function _epgRecKnopf(w,s){
    var st=(w.epgBtnStil||'pill');
    if(!s.rec){
      return '<button class="epgb on epgb-'+st+'" data-epgov="rec" style="'+_epgKnopfStil(w)+'">Aufnehmen</button>';
    }
    if(w._epgWeg){
      return '<button class="epgb warn epgb-'+st+'" data-epgov="wegja" style="'+_epgKnopfStil(w)
        +'" title="löscht den Timer am Receiver">wirklich löschen?</button>'
        +'<button class="epgb epgb-'+st+'" data-epgov="wegnein" style="'+_epgKnopfStil(w)+'">behalten</button>';
    }
    return '<button class="epgb epgb-'+st+'" data-epgov="weg" style="'+_epgKnopfStil(w)
      +'" title="'+esc(s.rec===2?'Timer steht, ist aber abgeschaltet':'wird aufgenommen')+'">'
      +(s.rec===2?'Timer löschen':'Aufnahme löschen')+'</button>';
  }
  /**
   * Die Pille fuer die ganze Serie.
   *
   * Sie erscheint nur, wenn das Programm die Sendung ueberhaupt als Serie
   * fuehrt - bei einer Nachrichtensendung waere "Serie aufnehmen" eine
   * sinnlose Zusage. Beschriftung und Zustand kommen aus derselben Angabe, die
   * auch das Raster schraffiert: 1 heisst, die Serie steht auf der
   * Aufnahmeliste.
   */
  function _epgSerienKnopf(w,s){
    if(w.epgSerie===false)return '';
    if(s.art!==1&&s.art!==2)return '';
    var drin=(s.art===1);
    return '<button class="epgb'+(drin?' on':'')+' epgb-'+(w.epgBtnStil||'pill')+'" data-epgov="serie" style="'
      +_epgKnopfStil(w)+'" title="'+esc(drin?'nimmt die Serie aus der Aufnahmeliste':'nimmt jede Folge dieser Serie auf')+'">'
      +esc(drin?'Serie nicht mehr':'Serie aufnehmen')+'</button>';
  }
  /**
   * Auftrag abgeben und auf die Antwort warten.
   *
   * Bewusst kurz und begrenzt: nach zehn Sekunden ist entweder etwas passiert
   * oder etwas kaputt. Beide Auftragsarten - Sendung und Serie - gehen
   * denselben Weg, damit es nur eine Stelle gibt, die auf Antworten wartet.
   */
  function _epgAuftrag(w,auftrag,fertig){
    setVar(w.epgSel,JSON.stringify(auftrag));
    w._epgMsg='Auftrag läuft …';_epgOverlay(w);
    if(!w.epgMsgVar)return;
    var n=0,iv=setInterval(function(){
      n++;
      fetch('?api=val&ids='+w.epgMsgVar,{cache:'no-store'}).then(function(r){return r.json();})
        .then(function(j){
          var v=j&&j.values&&j.values[w.epgMsgVar];
          if(v&&String(v.v)!==''&&String(v.v)!==w._epgMsg){
            w._epgMsg=String(v.v);_epgOverlay(w);clearInterval(iv);
            if(fertig)fertig(w._epgMsg);
          }
        }).catch(function(){});
      if(n>14){clearInterval(iv);}
    },700);
  }
  /**
   * Die ganze Serie in die Aufnahmeliste des Serienrecorders - oder wieder
   * heraus. Danach wird das Fenster neu geholt: die Schraffur steckt im
   * Zwischenlager, das das Skript gerade neu gebaut hat.
   */
  function _epgSerie(w){
    var s=w._epgSelP;if(!s)return;
    if(!w.epgSel){w._epgMsg='keine Auftragsvariable eingestellt';_epgOverlay(w);return;}
    var drin=(s.art===1);
    // Fuer die Aufnahmeliste zaehlt der Titel des EPG, nicht der Ablagename:
    // der Serienrecorder ordnet ihn selbst zu, und seine Liste fuehrt "CSI: Miami",
    // waehrend die Ablage "CSI Miami" heisst. Mit dem Ablagenamen fuende das
    // Entfernen seinen Eintrag nicht wieder.
    _epgAuftrag(w,{was:'serie',serie:(s.epgTitel||s.titel),aktion:drin?'aus':'an'},function(){
      s.art=drin?2:1;
      _epgOverlay(w);
      _EPGD[w.id]=null;_epgFetch(w);
    });
  }
  /**
   * Die programmierte Aufnahme wieder loeschen.
   *
   * Der Browser kennt den Timer nicht - er kennt nur die Sendung. Welcher Timer
   * gemeint ist, entscheidet das Skript: ein Timer traegt Vor- und Nachlauf und
   * hat andere Zeiten als die Sendung.
   */
  function _epgWeg(w){
    var s=w._epgSelP;if(!s)return;
    if(!w.epgSel){w._epgMsg='keine Auftragsvariable eingestellt';_epgOverlay(w);return;}
    w._epgWeg=false;
    _epgAuftrag(w,{was:'timerweg',ref:s.ref,start:s.start,ende:s.ende,titel:s.titel},function(m){
      if(String(m).indexOf('gelöscht')===0)s.rec=0;
      _epgOverlay(w);
      _EPGD[w.id]=null;_epgFetch(w);
    });
  }
  function _epgAufnehmen(w){
    var s=w._epgSelP;if(!s)return;
    if(!w.epgSel){w._epgMsg='keine Auftragsvariable eingestellt';_epgOverlay(w);return;}
    if(!s.ref){w._epgMsg='dieser Sender ist keinem Sender der Box zugeordnet';_epgOverlay(w);return;}
    _epgAuftrag(w,{ref:s.ref,sender:s.sender,start:s.start,ende:s.ende,
                   titel:s.titel,kurz:s.kurz},function(m){
      if(String(m).indexOf('programmiert')===0){s.rec=1;_epgOverlay(w);}
      // Die Aufnahmemarke steckt in den Fensterdaten, nicht im Sendungsblock:
      // sie kommt aus der Timerliste, die das Skript gerade neu abgelegt hat.
      // Ohne dieses Nachholen traegt der Block seine Marke erst beim naechsten
      // Blaettern - man programmiert, schliesst das Fenster und sieht nichts.
      _EPGD[w.id]=null;_epgFetch(w);
    });
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
        +_epgLegende(w)
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
        if(k==='serie'){_epgSerie(w);return true;}
        if(k==='weg'){w._epgWeg=true;_epgOverlay(w);return true;}
        if(k==='wegnein'){w._epgWeg=false;_epgOverlay(w);return true;}
        if(k==='wegja'){_epgWeg(w);return true;}
        if(k==='mehr'){
          w._epgMehr=!w._epgMehr;
          _epgOverlay(w);
          if(w._epgMehr)_epgMehrHolen(w);
          return true;
        }
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
        +row('Namen des Recorders','<input type="checkbox" id="pEpgSrT"'+(w.epgSrTitel!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Serie und Folge so, wie die Aufnahme auf der Platte heisst</span>')
        +row('Genre','<input type="checkbox" id="pEpgCat"'+(w.epgCat?' checked':'')+'>')
        +row('Restzeit','<input type="checkbox" id="pEpgRest"'+(w.epgRest!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">bei laufender Sendung statt der Zeitspanne</span>')
        +row('Ecken','<input id="pEpgR" type="number" min="0" max="20" value="'+(w.epgR!=null?w.epgR:8)+'"> px')
        +'<div class="pgh">Aufnahme (Klick auf eine Sendung)</div>'
        +row('Auftragsvariable','<input id="pEpgSel" value="'+(w.epgSel||'')+'" placeholder="ID der String-Variablen"> <span style="font-size:11px;color:var(--muted)">hier legt die Kachel den Auftrag ab</span>')
        +row('Rückmeldung','<input id="pEpgMsg" value="'+(w.epgMsgVar||'')+'" placeholder="ID der String-Variablen"> <span style="font-size:11px;color:var(--muted)">was das Skript geantwortet hat</span>')
        +row('Serien-Pille','<input type="checkbox" id="pEpgSerie"'+(w.epgSerie!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">ganze Serie in die Aufnahmeliste, nur bei Serien</span>')
        +'<div class="pgh">Farben (alle aus dem Skin)</div>'
        +row('Block',skinSel(w.epgCB||'','id="pEpgCB"')+' <span style="font-size:11px;color:var(--muted)">leer = Flächenfarbe</span>')
        +row('läuft gerade',skinSel(w.epgCR||'','id="pEpgCR"')+' <span style="font-size:11px;color:var(--muted)">leer = Akzent</span>')
        +row('Titel',skinSel(w.epgCT||'','id="pEpgCT"'))
        +row('Zeit/Untertitel',skinSel(w.epgCZ||'','id="pEpgCZ"'))
        +row('Jetzt-Linie',skinSel(w.epgCN||'','id="pEpgCN"')+' <span style="font-size:11px;color:var(--muted)">leer = Warnfarbe</span>')
        +row('Aufnahme-Marke',skinSel(w.epgCM||'','id="pEpgCM"')+' <span style="font-size:11px;color:var(--muted)">programmierte Sendung, leer = kritisch</span>')
        +'<div class="pgh">Serien kennzeichnen</div>'
        +'<div class="hint" style="font-size:11px;margin:0 2px 8px">Ein Block trägt <b>einen</b> Rand. Reihenfolge: programmiert → schon aufgenommen → Wunschserie → andere Serie.</div>'
        +row('Serien markieren','<input type="checkbox" id="pEpgArt"'+(w.epgArt!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Serie erkannt an Episodennummer oder Kategorie</span>')
        +row('Randstärke','<input id="pEpgRandW" type="number" min="1" max="6" step="0.5" value="'+(w.epgRandW||2)+'" style="width:56px"> px')
        +row('Wunschserie',skinSel(w.epgCF||'','id="pEpgCF"')+' <span style="font-size:11px;color:var(--muted)">wird aufgenommen · leer = Infofarbe</span>')
        +row('Andere Serie',skinSel(w.epgCS||'','id="pEpgCS"')+' <span style="font-size:11px;color:var(--muted)">alle übrigen Serien · leer = Linienfarbe (neutral)</span>')
        +row('Schon aufgenommen','<input type="checkbox" id="pEpgHave"'+(w.epgHave!==false?' checked':'')+'> '
            +skinSel(w.epgCH||'','id="pEpgCH"')
            +' <span style="font-size:11px;color:var(--muted)">liegt auf der Platte · Quelle: Serienrecorder · leer = Warnfarbe</span>')
        +row('Film vorhanden',skinSel(w.epgCFl||'','id="pEpgCFl"')
            +' <span style="font-size:11px;color:var(--muted)">aus den flachen Filmablagen, nur über den Titel gefunden · leer = OK-Farbe</span>')
        +row('Legende','<input type="checkbox" id="pEpgLeg"'+(w.epgLeg!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">neben dem Suchfeld, zeigt nur was eingeschaltet ist</span>')
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
      chk('#pEpgSub','epgSub',1);chk('#pEpgSrT','epgSrTitel',1);chk('#pEpgRest','epgRest',1);chk('#pEpgCat','epgCat');
      if($('#pEpgQPh'))$('#pEpgQPh').oninput=function(){w.epgQPh=this.value||undefined;render();commit();};
      ['CB','CR','CT','CZ','CN','CM','CF','CS','CH','CFl'].forEach(function(k){sel('#pEpg'+k,'epg'+k);});
      chk('#pEpgArt','epgArt',1);
      num('#pEpgRandW','epgRandW',2);
      chk('#pEpgHave','epgHave',1);
      chk('#pEpgLeg','epgLeg',1);
      if($('#pEpgSel'))$('#pEpgSel').onchange=function(){w.epgSel=parseInt(this.value)||undefined;commit();};
      if($('#pEpgMsg'))$('#pEpgMsg').onchange=function(){w.epgMsgVar=parseInt(this.value)||undefined;commit();};
      if($('#pEpgSerie'))$('#pEpgSerie').onchange=function(){w.epgSerie=this.checked;commit();};
    }
  });
