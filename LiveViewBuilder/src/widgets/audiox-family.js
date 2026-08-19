  // ===== Audio/Media-Familie (AudioZone HSAU): komponierbare Teil-Widgets über Session-Bus =====
  //
  //  Zerlegt die Media-Steuerung in einzeln platzierbare Widgets (Raum-Tabs, Now-Playing,
  //  Transport/Volume, Quellen, Multiroom), die sich EINE Sitzung teilen (w.session, Vorgabe
  //  "audio"). Additiv — kein Eingriff in generische Widgets. Backend: ?api=audio (getall/
  //  groups/manage) auf die AudioZone-Instanzen; Steuern via ?api=setvar auf die Control-Vars.
  //  KEIN Monolith: jedes Sub-Widget ist klein und eigenständig platzierbar.

  var _af = {};        // sessionId -> geteilter Zustand
  var _afSubs = {};    // sessionId -> [widgetId,…]
  function afKey(w){return w.session||'audio';}
  function afSess(w){var k=afKey(w);return _af[k]||(_af[k]={loaded:false,loading:false,err:'',rooms:[],roomIdx:0,pollId:0,radio:null,stations:null});}
  function afSub(w){var k=afKey(w),a=_afSubs[k]||(_afSubs[k]=[]);if(a.indexOf(w.id)<0)a.push(w.id);}
  function afEmit(w){(_afSubs[afKey(w)]||[]).forEach(function(id){var el=document.querySelector('.w[data-id="'+id+'"]');if(!el)return;var ww=(typeof widget==='function')?widget(id):null;if(!ww)return;var host=el.querySelector('.winner')||el;var def=WIDGETS[ww.type];if(def&&def.render){host.innerHTML=def.render(ww);if(def._bind)def._bind(ww,el);}});}
  function afCur(s){return (s.rooms&&s.rooms.length)?s.rooms[Math.max(0,Math.min(s.roomIdx,s.rooms.length-1))]:null;}

  function afDemo(){return [
    {id:1,name:'Wohnzimmer',title:'Redondo Beach',artist:'Patti Smith Group',album:'Easter',coverUrl:'',playing:true,volume:64,mute:false,power:true,repeat:0,shuffle:true,positionPct:38,position:'1:42',duration:'4:29',online:true,role:'coordinator',coordinator:'A',vars:{}},
    {id:2,name:'Küche',title:'ORF Hitradio Ö3',artist:'Radio',album:'',coverUrl:'',playing:true,volume:19,mute:false,power:true,repeat:0,shuffle:false,positionPct:0,position:'',duration:'',online:true,role:'member',coordinator:'A',vars:{}},
    {id:3,name:'Bad',title:'',artist:'',album:'',coverUrl:'',playing:false,volume:20,mute:false,power:false,repeat:0,shuffle:false,positionPct:0,position:'',duration:'',online:true,role:'standalone',coordinator:'',vars:{}}
  ];}

  // Sofortiges Echo -------------------------------------------------------------
  //
  //  Ein Player braucht bis zu ein paar Sekunden, bis er den neuen Zustand meldet. Ohne
  //  Echo passiert auf der Kachel bis dahin nichts und man drueckt ein zweites Mal. Wir
  //  schreiben den erwarteten Wert deshalb sofort lokal und merken ihn vor: beim naechsten
  //  Laden bleibt er stehen, bis der Player ihn bestaetigt oder die Frist ablaeuft - sonst
  //  wuerde der 8-Sekunden-Takt die Taste sichtbar zurueckspringen lassen.
  var AF_ECHO_MS=9000;
  function afEcho(s,raum,feld,wert){ if(!raum)return; raum[feld]=wert;
    (s.echo||(s.echo={}))[raum.id+'|'+feld]={v:wert,t:Date.now()}; }
  function afEchoHalten(s,raeume){ var e=s.echo; if(!e)return raeume; var jetzt=Date.now();
    raeume.forEach(function(r){ Object.keys(e).forEach(function(k){
      var teil=k.split('|'); if(+teil[0]!==r.id)return; var eintrag=e[k];
      if(r[teil[1]]===eintrag.v||(jetzt-eintrag.t)>AF_ECHO_MS){delete e[k];return;}
      r[teil[1]]=eintrag.v; }); });
    return raeume; }
  // Steuer-Ident -> angezeigtes Feld. Was hier fehlt (Vor/Zurueck), hat keinen vorhersagbaren
  // Zustand - dafuer wird nichts vorgegaukelt.
  function afEchoAusIdent(s,c,ident,val){
    if(ident==='Mute')return afEcho(s,c,'mute',val);
    if(ident==='Power')return afEcho(s,c,'power',val);
    if(ident==='Shuffle')return afEcho(s,c,'shuffle',val);
    if(ident==='Repeat')return afEcho(s,c,'repeat',val);
    if(ident==='Volume')return afEcho(s,c,'volume',val);
    if(ident==='Position')return afEcho(s,c,'positionPct',val);
    if(ident==='Transport'){var t=String(val);
      if(t==='1')return afEcho(s,c,'playing',true);
      if(t==='2'||t==='3')return afEcho(s,c,'playing',false);}
  }

  function afLoad(w,cb){var s=afSess(w);
    if(typeof DOKU!=='undefined'&&DOKU){s.rooms=afDemo();s.loaded=true;s.err='';cb&&cb();return;}
    fetch('?api=audio&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok){s.err='Audio nicht lesbar';cb&&cb();return;}
      s.rooms=afEchoHalten(s,j.rooms||[]);s.err='';if(s.roomIdx>=s.rooms.length)s.roomIdx=0;
      // Optionaler Deep-Link ?room=<Name> (einmalig beim ersten Laden).
      if(!s._initRoom){s._initRoom=true;try{var rp=(new URLSearchParams(location.search)).get('room');
        if(rp){for(var i=0;i<s.rooms.length;i++){if((s.rooms[i].name||'').toLowerCase()===rp.toLowerCase()){s.roomIdx=i;break;}}}}catch(e){}}
      cb&&cb();
    }).catch(function(){s.err='Verbindungsfehler';cb&&cb();});
  }
  function afEnsure(w,el){var s=afSess(w);var def=WIDGETS[w.type];
    if(s.loaded){if(def._bind)def._bind(w,el);afStartPoll(w);return;}
    if(s.loading)return;s.loading=true;
    afLoad(w,function(){s.loaded=true;s.loading=false;afEmit(w);afLoadRadio(w);afStartPoll(w);});
  }
  function afStartPoll(w){var s=afSess(w);if(s.pollId||(typeof DOKU!=='undefined'&&DOKU))return;
    s.pollId=setInterval(function(){
      if(s.dragging)return;
      // Offenes Eingabefeld (neue Playlist) nicht wegzeichnen - dasselbe Zugestaendnis
      // wie beim Ziehen eines Reglers.
      try{ if(afLib(w).plPanel)return; }catch(_){}
      afLoad(w,function(){afEmit(w);afLoadRadio(w);afQueueTick(w);}); },8000);
  }
  // Radio "was laeuft": laufender Titel + Song-Cover fuer den aktuellen Raum (RadioNow, IPSSonos-frei).
  function afLoadRadio(w){var s=afSess(w);var c=afCur(s);if(!c){return;}
    if(typeof DOKU!=='undefined'&&DOKU){ s.radio={roomId:c.id,isRadio:true,isTalk:false,key:'oe3',artist:'Ava Max',title:'Sweet but Psycho',cover:'',station:'Hitradio Ö3'}; afEmit(w); return; }
    fetch('?api=audio&op=radionow&id='+c.id,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok){ j.roomId=c.id; s.radio=j; afEmit(w); }
    }).catch(function(){});
  }
  // Sender fuer die Direktwiedergabe laden (einmal).
  function afLoadStations(w,cb){var s=afSess(w);if(s.stations){cb&&cb();return;}
    if(typeof DOKU!=='undefined'&&DOKU){ s.stations=[{key:'oe3',title:'Hitradio Ö3'},{key:'fm4',title:'FM4'},{key:'kronehit',title:'Kronehit'},{key:'oe1',title:'Österreich 1'},{key:'ooe',title:'Radio Oberösterreich'}]; cb&&cb(); return; }
    fetch('?api=audio&op=radiostations',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){ s.stations=(j&&j.stations)||[]; cb&&cb(); }).catch(function(){s.stations=[];cb&&cb();});
  }

  // Steuern: RequestAction ueber ?api=setvar auf die Control-Var der aktuellen Zone.
  function afSet(w,ident,val,cb){var s=afSess(w),c=afCur(s);if(!c)return;
    if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();return;}
    var id=(c.vars&&c.vars[ident])||0;if(!id){toast('Keine Bindung: '+ident);return;}
    afEchoAusIdent(s,c,ident,val); afEmit(w);   // Kachel zeigt den Druck sofort
    var v=(val===true?'1':(val===false?'0':String(val)));
    fetch('?api=setvar&id='+id+'&value='+encodeURIComponent(v)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
      .then(function(r){return r.json();}).then(function(){ afLoad(w,function(){afEmit(w);}); cb&&cb(); })
      .catch(function(){toast('Steuern: Verbindungsfehler');});
  }
  // Multiroom: Gruppen-Op via ?api=audio&op=manage (token)
  function afManage(w,iid,body,cb){
    if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();return;}
    fetch('?api=audio&op=manage&id='+iid+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)})
      .then(function(r){return r.json();}).then(function(j){ if(j&&j.note)toast(j.note); afLoad(w,function(){afEmit(w);}); cb&&cb(); })
      .catch(function(){toast('Gruppe: Verbindungsfehler');});
  }

  // gemeinsame Kleinbausteine ------------------------------------------------
  var AF_IC={ // lucide-artige Pfade
    prev:'<path d="M19 20 9 12l10-8v16z"/><path d="M5 19V5"/>',
    play:'<path d="M6 4l14 8-14 8V4z"/>',
    pause:'<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',
    next:'<path d="M5 4l10 8-10 8V4z"/><path d="M19 5v14"/>',
    vol:'<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    mute:'<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>',
    power:'<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    shuffle:'<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
    repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'
  };
  // Die Groesse der Transport-/Regler-Icons gehoert den CSS-Regeln (.aftb/.afibtn svg,
  // alle bereits clamp+cqmin). Die Attribute hier sind nur der Rueckfall fuer Kontexte ohne eigene
  // Regel - darum relativ in em statt in festen Pixeln. sz bleibt als Bezugsgroesse erhalten
  // (18 = Normalmass), damit die Groessenverhaeltnisse der Icons untereinander gleich bleiben.
  function afSvg(p,sz){var em=((sz||18)/18).toFixed(2)+'em';
    return '<svg viewBox="0 0 24 24" width="'+em+'" height="'+em+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';}
  function afMsg(t){return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:clamp(10px,4cqmin,14px)">'+esc(t)+'</div>';}
  /**
   * GENERISCHES COVER, wenn weder Sender- noch Titelbild vorliegt (nichts gewaehlt, Quelle
   * ohne Bild, Bild nicht ladbar). Vorher blieb dort eine leere Farbflaeche stehen, die wie
   * ein Ladefehler aussah. Reines Inline-SVG - keine externe Datei, skaliert mit der Kachel.
   * Zeigt eine ruhige, um die Mitte gespiegelte Wellenform mit einem Ring dahinter.
   *
   * Zwei Punkte gegenueber der ersten Fassung berichtigt:
   *  - Die Zeichenfarbe kam bei laufender Wiedergabe hart aus '#fff'. Im hellen Skin lag
   *    damit Weiss auf einer nahezu weissen Flaeche - praktisch unsichtbar. Jetzt Akzent
   *    (spielt) bzw. --faint (still), also in beiden Skins tragfaehig.
   *  - Die Verlaufs-ID war fest ('afph'). Mehrere Now-Playing-Kacheln auf einer Seite
   *    teilten sich denselben <defs>-Eintrag; die ID ist jetzt je Aufruf eindeutig.
   */
  var _afPhN = 0;
  function afCoverPlaceholder(muted){
    var id='afph'+(++_afPhN);
    var col=muted?'var(--faint)':'var(--accent)';
    // Halbe Auslenkung je Saeule, symmetrisch um die Mittellinie (y=60). Die Wellenform
    // bleibt bewusst KLEIN und mittig im Ring - eine formatfuellende Zeichnung wirkte auf
    // grossen Kacheln wie ein Muster und zog den Blick vom Titel weg.
    var h=[7,13,19,25,29,25,19,13,7],bars='';
    for(var i=0;i<h.length;i++){var x=36+i*6;
      bars+='<path d="M'+x+' '+(60-h[i])+'V'+(60+h[i])+'"/>';}
    return '<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style="display:block">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="1">'
      +'<stop offset="0" stop-color="var(--surface-2)"/><stop offset="1" stop-color="var(--tile)"/></linearGradient></defs>'
      +'<rect width="120" height="120" fill="url(#'+id+')"/>'
      +'<circle cx="60" cy="60" r="40" fill="none" stroke="'+col+'" stroke-opacity=".18" stroke-width="1.6"/>'
      +'<g fill="none" stroke="'+col+'" stroke-opacity=".38" stroke-width="3.2" stroke-linecap="round">'+bars+'</g>'
      +'</svg>';
  }
  // Echte Zeitangabe? Der Zuspieler meldet fuer eine leere/ruhende Zone "0:00" statt
  // eines leeren Feldes. Ein solcher Nullwert ist KEINE Spielzeit - sonst zeichnet die
  // Kachel unter "Nichts ausgewaehlt" einen Fortschrittsbalken von 0:00 bis 0:00.
  function afZeit(s){return !!s && !/^0+(:0+)*$/.test(String(s).trim());}
  function afReady(w){var s=afSess(w);if(s.err)return {err:s.err};if(!s.loaded)return {loading:true};return {s:s};}
  function afSessRow(w){return row('Session-ID','<input id="afSessInp" value="'+esc(w.session||'audio')+'" placeholder="audio">')
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Gleiche Session-ID = geteilte Bedienung mit den anderen Audio-Teil-Widgets.</div>';}
  function afSessWire(w){if($('#afSessInp'))$('#afSessInp').onchange=function(){w.session=this.value||undefined;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el){var s=WIDGETS[w.type];var host=el.querySelector('.winner')||el;host.innerHTML=s.render(w);if(s._bind)s._bind(w,el);}afEmit(w);};}
  function afMount(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;afSub(w);afEnsure(w,el);}

  // ---------- audioroom (Controller): Raum-Tabs (einheitlicher Selektor) ----------
  // Raumleiste. Nutzt denselben Baukasten wie die uebrigen Gewerke (Ebene 'r'): eigener
  // Beschriftungstext je Raum, vollstaendige Typografie, Stil, Reihenfolge und Ausblenden.
  function afRoomBar(w,s){
    var items=hsOrderHideBy(w,'r',(s.rooms||[]).map(function(r,i){return {idx:i,key:i,r:r};}),function(x){return x.key;});
    var btn=hsLvlBtn(w,'r');
    return '<div class="'+hsLvlClass(w,'r')+'"'+hsFontStyle(w,'r')+'>'+items.map(function(it){var r=it.r,i=it.idx;
      var dot=r.role==='member'?'var(--info)':(r.playing?'var(--accent)':'var(--faint)');
      return '<button class="'+btn+(i===s.roomIdx?' on':'')+'" data-afroom="'+i+'">'+
        '<span style="width:.55em;height:.55em;border-radius:50%;background:'+dot+';flex:none"></span>'+
        esc(hsLabel(w,'r',i,hsStripDomain(r.name)))+
        (r.role==='member'?' <span style="font-family:var(--fm);font-size:.72em;color:var(--info);border:1px solid color-mix(in oklab,var(--info) 45%,transparent);border-radius:999px;padding:0 .42em">GRP</span>':'')+'</button>';}).join('')+'</div>';}
  defWidget('audioroom',{
    label:'Audio · Räume', cat:'HomeSuite · Audio', paletteIcon:'wselect', size:[720,52],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('Audio lädt …');
      return '<div class="afw afrooms">'+afRoomBar(w,r.s)+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);$$('[data-afroom]',el).forEach(function(b){b.onclick=function(){s.roomIdx=+b.getAttribute('data-afroom');s.radio=null;afEmit(w);afLoadRadio(w);};});},
    props:function(w){var s=afSess(w);
      var items=((s&&s.rooms)||[]).map(function(r,i){return {key:i,name:hsStripDomain(r.name)};});
      return afSessRow(w)+hsLevelBlock(w,'r','Räume',items);},
    wire:function(w){afSessWire(w);var s=afSess(w);
      var items=((s&&s.rooms)||[]).map(function(r,i){return {key:i,name:hsStripDomain(r.name)};});
      hsLevelWire(w,'r',items,function(){afEmit(w);});}
  });

  // ---------- audionow: Cover + Titel + Interpret + Fortschritt ----------
  //
  //  ZWEI ZUSTAENDE, EIN AUFBAU:
  //    Warteschlange/Titel - Titel gross, Interpret darunter, Album klein; darunter die
  //                          ECHTE Spielzeit als Fortschrittsbalken (ziehbar, wenn die
  //                          Quelle springen kann) mit verstrichener Zeit und Dauer.
  //    Radio               - laufender Song gross, Interpret darunter; statt eines
  //                          erfundenen Fortschritts eine LIVE-Kennzeichnung mit Sender.
  //  Rechts neben dem Titel bleibt nichts leer: die Kopfzeile traegt links den Raum und
  //  rechts das Zustandsabzeichen, der Fuss laeuft ueber die volle Breite der Textspalte.
  //  Leere Zeilen werden GAR NICHT ausgegeben - eine leere Zeile kostet auf flachen
  //  Kacheln genau die Hoehe, die dem Titel fehlt.
  defWidget('audionow',{
    label:'Audio · Now-Playing', cat:'HomeSuite · Audio', paletteIcon:'image', size:[420,240],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      // Radio: laufender Titel + Song-Cover (RadioNow) statt Sender-Platzhalter.
      var rad=(s.radio&&s.radio.roomId===c.id&&s.radio.isRadio)?s.radio:null;
      var isTalk=!!(rad&&rad.isTalk);
      var station=rad?(rad.station||''):'';
      var cover=(rad&&rad.cover)?rad.cover:c.coverUrl;
      var isLogo=!!(rad&&rad.coverIsLogo);
      var line1,line2,line3;
      if(rad){ line1=isTalk?(station||hsStripDomain(c.name)):(rad.title||station||'');
               line2=isTalk?'Nachrichten / Wortprogramm':(rad.artist||'');
               line3=''; }                                  // Sender steht im Fuss bei LIVE
      else   { line1=c.title||''; line2=c.artist||''; line3=c.album||''; }
      var leer=!line1;                                       // nichts gewaehlt / Zone still
      // Zustandsabzeichen rechts in der Kopfzeile. Reine ANZEIGE - deshalb ein runder
      // Punkt statt einer Taste (runde Schaltflaechen gibt es in dieser Oberflaeche nicht).
      var bTxt='Pause',bCls='';
      if(rad){bTxt='Live';bCls=' live';}
      else if(c.playing){bTxt='Spielt';bCls=' play';}
      else if(c.power===false){bTxt='Aus';bCls=' off';}
      var fit=isLogo?'contain':'cover',pad=isLogo?'padding:8%;box-sizing:border-box;':'',bg=isLogo?'var(--surface-2)':'linear-gradient(135deg,var(--accent),var(--accent-2))';
      // Ohne Bild NICHT einfach eine leere Flaeche stehen lassen (sah aus wie ein Ladefehler),
      // sondern ein generisches Cover zeichnen. Bleibt auch liegen, wenn ein Bild NACHTRAEGLICH
      // scheitert: das <img> legt sich darueber und blendet sich bei onerror wieder aus.
      var ph='<div style="position:absolute;inset:0">'+afCoverPlaceholder(!c.playing)+'</div>';
      var cov=ph+(cover?('<img src="'+esc(cover)+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:'+fit+';'+pad+'" onerror="this.style.display=\'none\'">'):'');
      if(!cover)bg='var(--surface-2)';
      // Fuss: Live-Kennzeichnung ODER echte Spielzeit - nie ein erfundener Fortschritt.
      var seekable=!rad && afZeit(c.duration);                // Seek nur bei echter Dauer
      var posPct=Math.max(0,Math.min(100,c.positionPct||0));
      var ft='';
      if(rad){
        // Links der Sender (das Abzeichen oben sagt bereits LIVE - der Fuss wiederholt es
        // nicht, sondern nennt die Quelle), rechts die Art der Quelle. Faellt eines mit
        // der grossen Zeile zusammen, wird es ersetzt statt doppelt gezeigt.
        var q1=station||'Live-Stream'; if(q1===line1)q1='Live-Stream';
        var q2=isTalk?'Wortprogramm':'Direktstream'; if(q2===q1)q2='';
        ft='<div class="lv'+(c.playing?' on':'')+'">'
          +'<span class="eq"><i></i><i></i><i></i><i></i></span><span class="stn">'+esc(q1)+'</span>'
          +(q2?('<span class="src">'+esc(q2)+'</span>'):'')+'</div>';
      } else if(afZeit(c.duration)){
        ft='<div class="afbar"'+(seekable?' data-afseek':'')+' style="cursor:'+(seekable?'pointer':'default')+'">'
          +'<i data-afseekfill style="width:'+posPct+'%;pointer-events:none"></i></div>'
          +'<div class="tm"><span>'+esc(c.position||'0:00')+'</span><span>'+esc(c.duration)+'</span></div>';
      } else if(afZeit(c.position)){
        // Spielt, aber der Zuspieler meldet keine Dauer (Stream ohne Laengenangabe).
        ft='<div class="tm"><span>'+esc(c.position)+'</span><span>ohne Spielzeit</span></div>';
      }
      return '<div class="afw afnow">'
        +'<div class="cov" style="background:'+bg+'">'+cov+'</div>'
        +'<div class="txt">'
        +'<div class="hd"><span class="tag">'+esc(hsStripDomain(c.name))+'</span>'
        +'<span class="bdg'+bCls+'"><i></i>'+esc(bTxt)+'</span></div>'
        +'<div class="l1'+(leer?' dim':'')+'">'+esc(leer?'Nichts ausgewählt':line1)+'</div>'
        +(line2?'<div class="l2">'+esc(line2)+'</div>':'')
        +(line3?'<div class="l3">'+esc(line3)+'</div>':'')
        +(ft?('<div class="ft">'+ft+'</div>'):'')
        +'</div></div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);var sb=$('[data-afseek]',el);if(!sb)return;var fill=$('[data-afseekfill]',sb);
      function pctAt(x){var box=sb.getBoundingClientRect();return Math.max(0,Math.min(100,Math.round((x-box.left)/box.width*100)));}
      function commit(p){var c=afCur(s);if(!c)return;
        if(typeof DOKU!=='undefined'&&DOKU){if(fill)fill.style.width=p+'%';return;}
        // Bevorzugt die Position-Control-Var (RequestAction->seek); sonst manage-Fallback.
        var posVar=(c.vars&&c.vars.Position)||0;
        if(posVar)afSet(w,'Position',p); else afManage(w,c.id,{op:'seek',args:{percent:p}});}
      var drag=false;
      sb.onpointerdown=function(e){drag=true;s.dragging=true;try{sb.setPointerCapture(e.pointerId);}catch(_){}var p=pctAt(e.clientX);if(fill)fill.style.width=p+'%';e.preventDefault();};
      sb.onpointermove=function(e){if(!drag)return;var p=pctAt(e.clientX);if(fill)fill.style.width=p+'%';};
      sb.onpointerup=function(e){if(!drag)return;drag=false;s.dragging=false;var p=pctAt(e.clientX);if(fill)fill.style.width=p+'%';commit(p);};
      sb.onpointercancel=function(){drag=false;s.dragging=false;};
    },
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audioctl: Transport + Volume + Mute/Power ----------
  defWidget('audioctl',{
    label:'Audio · Steuerung', cat:'HomeSuite · Audio', paletteIcon:'wselect', size:[420,150],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      // EIN Bedienblock: Transport, Lautstaerke und Sleep stehen untereinander, getrennt nur
      // durch feine Linien. Alle Tasten sind eckig; rund bleiben allein der Reglergriff und
      // die reinen Zustandspunkte. Start/Pause traegt als einzige Taste die gefuellte
      // Aktivflaeche (--accent-2, weisse Schrift) und zeigt IMMER die naechstmoegliche Aktion.
      function tb(cls,ic,cmd,ttl){return '<button class="aftb'+(cls?' '+cls:'')+'" data-afcmd="'+cmd+'" title="'+ttl+'" aria-label="'+ttl+'">'+ic+'</button>';}
      var playing=!!c.playing;
      // Shuffle und Repeat stehen gleichwertig links und rechts der Transporttasten - gleiche
      // Groesse, gleiche Form, nur zurueckgenommen, weil sie Betriebsarten und keine Aktionen sind.
      var rep=(c.repeat||0)%3;
      var repTtl=rep===1?'Wiederholen: Titel':(rep===2?'Wiederholen: alle':'Wiederholen: aus');
      var trans='<div class="aftrans">'
        +tb('gh'+(c.shuffle?' on':''),afSvg(AF_IC.shuffle,15),'shuffle',c.shuffle?'Zufall: ein':'Zufall: aus')
        +tb('',afSvg(AF_IC.prev,18),'5','Zurück')
        +tb('pri',afSvg(playing?AF_IC.pause:AF_IC.play,24),playing?'2':'1',playing?'Pause':'Start')
        +tb('',afSvg(AF_IC.stop,16),'3','Stop')
        +tb('',afSvg(AF_IC.next,18),'4','Vor')
        +tb('gh'+(rep>0?' on':''),afSvg(AF_IC.repeat,15)+(rep===1?'<b class="afrep1">1</b>':''),'repeat',repTtl)
        +'</div>';
      function ibtn(ic,cmd,on,ttl){return '<button class="afibtn'+(on?' on':'')+'" data-afcmd="'+cmd+'" title="'+ttl+'" aria-label="'+ttl+'">'+ic+'</button>';}
      var v=Math.max(0,Math.min(100,c.volume||0));
      var vol='<div class="afvolrow">'+ibtn(afSvg(c.mute?AF_IC.mute:AF_IC.vol,17),'mute',!!c.mute,c.mute?'Stumm aufheben':'Stumm schalten')
        +'<div class="afbar afbar-k" data-afvol><i data-afvolfill style="width:'+v+'%;pointer-events:none"></i>'
        +'<b data-afvolknob style="left:'+v+'%"></b></div>'
        +'<span class="afvolnum" data-afvolnum>'+v+'</span>'
        +ibtn(afSvg(AF_IC.power,16),'power',!!c.power,c.power?'Ausschalten':'Einschalten')+'</div>';
      // Der Zuspieler meldet keinen Sleep-Stand zurueck. Markiert wird daher NUR die in dieser
      // Sitzung gesetzte Wahl - ohne Wahl bleibt die Zeile absichtlich ohne Aktivflaeche.
      var sel=(s.sleepSel&&s.sleepSel[c.id]!=null)?s.sleepSel[c.id]:null;
      function sbtn(m,lbl){return '<button class="afchip'+(sel===m?' on':'')+'" data-afsleep="'+m+'">'+lbl+'</button>';}
      var arm='<button class="afchip afarm'+(c.armed?' on':'')+'" data-afarm="1" title="'+(c.armed?'Scharf – klick für Schatten-Modus':'Schatten-Modus – klick zum Scharfschalten')+'">'+(c.armed?'Scharf':'Schatten')+'</button>';
      var sleep='<div class="afsleep"><span class="lbl">Sleep-Timer</span>'
        +'<div class="afsleepopts">'+sbtn(15,'15m')+sbtn(30,'30m')+sbtn(60,'60m')+sbtn(0,'Aus')+arm+'</div></div>';
      return '<div class="afw afctl">'+trans+'<div class="afdiv"></div>'+vol+'<div class="afdiv"></div>'+sleep+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);
      $$('[data-afcmd]',el).forEach(function(b){b.onclick=function(){var cmd=b.getAttribute('data-afcmd');var c=afCur(s);if(!c)return;
        if(cmd==='mute')afSet(w,'Mute',!c.mute);
        else if(cmd==='power')afSet(w,'Power',!c.power);
        else if(cmd==='shuffle')afSet(w,'Shuffle',!c.shuffle);
        else if(cmd==='repeat')afSet(w,'Repeat',((c.repeat||0)+1)%3); // 0=aus,1=Titel,2=alle
        else afSet(w,'Transport',cmd); // 1=Start 2=Pause 3=Stop 4=Vor 5=Zurueck
      };});
      // Lautstaerke: ziehen statt nur tippen. Waehrend des Ziehens laufen Fuellung, Griff und
      // Zahl mit; gesendet wird erst beim Loslassen (s.dragging haelt solange die Abfrage an).
      var vb=$('[data-afvol]',el);
      if(vb){var vf=$('[data-afvolfill]',vb),vk=$('[data-afvolknob]',vb),vn=$('[data-afvolnum]',el);
        function vpct(x){var box=vb.getBoundingClientRect();if(!box.width)return 0;
          return Math.max(0,Math.min(100,Math.round((x-box.left)/box.width*100)));}
        function vshow(p){if(vf)vf.style.width=p+'%';if(vk)vk.style.left=p+'%';if(vn)vn.textContent=p;}
        var vd=false;
        vb.onpointerdown=function(e){vd=true;s.dragging=true;try{vb.setPointerCapture(e.pointerId);}catch(_){}vshow(vpct(e.clientX));e.preventDefault();};
        vb.onpointermove=function(e){if(!vd)return;vshow(vpct(e.clientX));};
        vb.onpointerup=function(e){if(!vd)return;vd=false;s.dragging=false;var p=vpct(e.clientX);vshow(p);afSet(w,'Volume',p);};
        vb.onpointercancel=function(){vd=false;s.dragging=false;};
      }
      $$('[data-afsleep]',el).forEach(function(b){b.onclick=function(){var m=+b.getAttribute('data-afsleep');var c=afCur(s);if(!c)return;
        // Die getroffene Wahl je Raum merken, damit die Zeile den zuletzt gesetzten Wert zeigt.
        (s.sleepSel||(s.sleepSel={}))[c.id]=m;
        if(typeof DOKU!=='undefined'&&DOKU){toast(m?('Demo: Sleep '+m+' min'):'Demo: Sleep aus');afEmit(w);return;}
        if(m>0)afManage(w,c.id,{op:'setSleep',args:{minutes:m}}); else afManage(w,c.id,{op:'cancelSleep'});
        afEmit(w);
      };});
      var ab=$('[data-afarm]',el);if(ab)ab.onclick=function(){var c=afCur(s);if(!c)return;
        if(typeof DOKU!=='undefined'&&DOKU){toast('Demo: '+(c.armed?'Schatten-Modus':'Scharf'));return;}
        afManage(w,c.id,{op:'setArmed',args:{armed:!c.armed}},function(){c.armed=!c.armed;});
      };},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audiosrc: Quelle (Favorit/Radio/Playlist) — kompakte Stepper ----------
  defWidget('audiosrc',{
    label:'Audio · Quelle', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[420,120],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var c=afCur(r.s);if(!c)return afMsg('kein Raum');
      function rowSrc(lbl,ident,val){return '<div class="afsrow"><span class="lbl">'+lbl+'</span>'
        +'<button data-afsrc="'+ident+'" data-afd="-1">−</button>'
        +'<span class="num">#'+(val||0)+'</span>'
        +'<button data-afsrc="'+ident+'" data-afd="1">+</button></div>';}
      return '<div class="afw">'
        +'<div class="afnow"><div class="tag" style="flex:1">Quelle</div></div>'
        +rowSrc('Favorit','SourceFavorite',c.fav)+rowSrc('Radio','SourceRadio',c.radio)+rowSrc('Playlist','SourcePlaylist',c.playlist)+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);$$('[data-afsrc]',el).forEach(function(b){b.onclick=function(){var ident=b.getAttribute('data-afsrc'),d=+b.getAttribute('data-afd');var c=afCur(s);if(!c)return;
      var cur=(ident==='SourceFavorite'?c.fav:ident==='SourceRadio'?c.radio:c.playlist)||0;afSet(w,ident,Math.max(0,cur+d));};});},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audioradio: Sender  direkt spielen (HQ-Stream statt TuneIn) ----------
  //
  //  Senderliste als volle, gut treffbare Zeilen: Kennzeichen, Sendername und - beim
  //  laufenden Sender - der gerade gespielte Titel. Kopfzeile fest, Liste scrollt INNERHALB
  //  der Kachel; alle Groessen haengen an der Kachel (siehe .afrad in styles.css).

  // Laufender Sender. radionow liefert normalerweise den Sender-Key; meldet der Zuspieler
  // nur den Sendernamen, wird ueber den Titel zugeordnet - sonst bliebe die Liste ohne
  // Markierung, obwohl hoerbar etwas laeuft.
  function afRadioKey(s,c,stations){
    var rad=(s&&s.radio&&c&&s.radio.roomId===c.id)?s.radio:null;if(!rad)return '';
    if(rad.key)return rad.key;
    var norm=function(t){return String(t||'').toLowerCase().replace(/[^0-9a-zäöüß]/g,'');};
    var nm=norm(rad.station);if(!nm)return '';
    for(var i=0;i<(stations||[]).length;i++){if(norm(stations[i].title)===nm)return stations[i].key;}
    return '';
  }
  // Pegel-Symbol des laufenden Senders. Reine Anzeige; die Balkenhoehe animiert das CSS
  // (nur wenn wirklich gespielt wird), damit sich Laufen und Pause unterscheiden lassen.
  var AF_EQ='<svg class="afr-eqs" viewBox="0 0 24 24" aria-hidden="true">'
    +'<rect class="b1" x="3" y="9" width="4" height="12" rx="1"/>'
    +'<rect class="b2" x="10" y="4" width="4" height="17" rx="1"/>'
    +'<rect class="b3" x="17" y="12" width="4" height="9" rx="1"/></svg>';
  var AF_PLAY='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
  defWidget('audioradio',{
    label:'Audio · Radio (Direktstream)', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[420,300],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      if(!s.stations){afLoadStations(w,function(){afEmit(w);});return afMsg('Sender lädt …');}
      var sts=s.stations||[];
      var curKey=afRadioKey(s,c,sts);
      var rad=(s.radio&&s.radio.roomId===c.id)?s.radio:null;
      var playing=!!c.playing;
      // Zweite Zeile des laufenden Senders: der Titel, bei Wortprogramm die ehrliche Ansage.
      var curSub='';
      if(rad){curSub=rad.isTalk?(String(rad.title||'')||'Wortprogramm / Nachrichten')
        :[rad.artist,rad.title].filter(Boolean).join(' · ');}
      // Volle Zeilen statt duenner Pillen: am Wandtablet muss ein Sender im Vorbeigehen
      // treffbar sein. Der laufende traegt Pegel-Symbol, Marke und die gefuellte Aktivflaeche.
      var list=sts.map(function(st){var on=(curKey&&curKey===st.key);
        return '<button class="afr-row'+(on?' on':'')+'" data-afstation="'+esc(st.key)+'"'+(on?' aria-current="true"':'')+'>'
          +(on?('<span class="afr-badge on'+(playing?' live':'')+'">'+AF_EQ+'</span>')
              :('<span class="afr-badge">'+esc(_alibInit(st.title))+'</span>'))
          +'<span class="afr-m"><span class="afr-nm">'+esc(st.title)+'</span>'
          +((on&&curSub)?('<span class="afr-sub">'+esc(curSub)+'</span>'):'')+'</span>'
          +(on?('<span class="afr-tag">'+(playing?'Läuft':'Pause')+'</span>')
              :('<span class="afr-go">'+AF_PLAY+'</span>'))
          +'</button>';}).join('');
      var body=sts.length?('<div class="afrlist">'+list+'</div>')
        :('<div class="afr-none">Keine Sender hinterlegt.<span>Die Senderliste kommt aus dem AudioZone-Modul.</span></div>');
      return '<div class="afw afrad">'
        +'<div class="afr-hd"><span class="aftag">Radio · '+esc(hsStripDomain(c.name))+'</span>'
        +'<span class="afr-meta">'+sts.length+' Sender</span></div>'
        +body+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);$$('[data-afstation]',el).forEach(function(b){b.onclick=function(){var key=b.getAttribute('data-afstation');var c=afCur(s);if(!c)return;
      if(typeof DOKU!=='undefined'&&DOKU){toast('Demo: '+key);return;}
      fetch('?api=audio&op=playdirect&id='+c.id+'&station='+encodeURIComponent(key)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
        .then(function(r){return r.json();}).then(function(j){ if(j&&j.note)toast(j.note); s.radio=null; setTimeout(function(){afLoadRadio(w);},1500); afLoadRadio(w); })
        .catch(function(){toast('Radio: Verbindungsfehler');});
    };});},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audiolib: Bibliotheks-Browser (Provider -> Container -> Titel) ----------
  function afLib(w){var s=afSess(w);return s.lib||(s.lib={provider:'',providers:null,stack:[],items:null,loading:false,title:''});}
  function afLibProviders(w,cb){var L=afLib(w);
    if(typeof DOKU!=='undefined'&&DOKU){L.providers=[{id:'audiobookshelf',label:'Audiobookshelf'},{id:'spotify',label:'Spotify'}];cb&&cb();return;}
    fetch('?api=audio&op=medialib&sub=providers',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){L.providers=(j&&j.providers)||[];cb&&cb();}).catch(function(){L.providers=[];cb&&cb();});}
  function afLibBrowse(w,provider,container,title){var L=afLib(w);L.loading=true;L.provider=provider;afEmit(w);
    if(typeof DOKU!=='undefined'&&DOKU){L.items=[{title:'Demo-Album',isContainer:true,cover:''},{title:'Track 1',isContainer:false}];L.loading=false;afEmit(w);return;}
    fetch('?api=audio&op=medialib&sub=browse&provider='+encodeURIComponent(provider)+'&container='+encodeURIComponent(container||''),{cache:'no-store'})
      .then(function(r){return r.json();}).then(function(j){L.items=(j&&j.items)||[];L.loading=false;afEmit(w);}).catch(function(){L.items=[];L.loading=false;afEmit(w);});}
  function afLibPlay(w,ref){var s=afSess(w),c=afCur(s);if(!c)return;
    if(typeof DOKU!=='undefined'&&DOKU){toast('Demo: '+(ref.title||''));return;}
    fetch('?api=audio&op=playcontent&id='+c.id+'&provider='+encodeURIComponent(ref.provider||afLib(w).provider)+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(ref)})
      .then(function(r){return r.json();}).then(function(j){ if(j&&j.note)toast(j.note); else toast('▶ '+(ref.title||'')); s.radio=null; setTimeout(function(){afLoadRadio(w);},1500);})
      .catch(function(){toast('Abspielen: Verbindungsfehler');});}
  // --- Darstellung: Spalten-Browser (linke Anbieter-/Pfad-Leiste, rechts typ-spezifische Panes) ---
  function _alibInit(s){s=(s||'').trim();return s?s.charAt(0).toUpperCase():'#';}
  function _alibDur(sec){sec=Math.max(0,Math.round(+sec||0));var m=Math.floor(sec/60),x=sec%60;return m+':'+(x<10?'0':'')+x;}
  function _alibCov(it,cls){var ph='<span class="alib-ph">'+esc(_alibInit(it.title))+'</span>';
    var img=it.cover?('<img src="'+esc(it.cover)+'" loading="lazy" onerror="this.remove()">'):'';
    return '<span class="alib-cov '+cls+'">'+ph+img+'</span>';}
  // Items klassifizieren: Ordner (Container o. Cover), Karten (Container m. Cover = Alben/Buecher),
  // Plays (kein Container, keine Dauer = Playlist/Tap-to-Play), Tracks (kein Container, m. Dauer).
  function _alibGroups(items){var g={folders:[],cards:[],plays:[],tracks:[]};
    items.forEach(function(it,idx){var e={it:it,idx:idx};
      if(it.isContainer){(it.cover?g.cards:g.folders).push(e);}
      else if((it.durationSec||0)>0){g.tracks.push(e);}
      else{g.plays.push(e);}});
    return g;}
  // Hoerbuecher wie Alben: quadratisches Cover-Grid, nur zusaetzlich nach Autor gebaendert.
  function _alibTile(e){var it=e.it;return '<button class="alib-tile" data-afitem="'+e.idx+'">'+_alibCov(it,'sq')+'<div class="alib-tt">'+esc(it.title)+'</div><div class="alib-ts">'+esc(it.artist||'')+'</div></button>';}
  function _alibBooks(cards,L){var arr=cards.slice();
    if(L.bookSort==='title'){arr.sort(function(a,b){return (a.it.title||'').toLowerCase()<(b.it.title||'').toLowerCase()?-1:1;});
      return '<div class="alib-grid">'+arr.map(_alibTile).join('')+'</div>';}
    var out='',cur=null,buf=[];
    function flush(){if(buf.length){out+='<div class="alib-grid">'+buf.join('')+'</div>';buf=[];}}
    arr.forEach(function(e){var au=e.it.artist||'—';
      if(au!==cur){flush();cur=au;out+='<div class="alib-band">'+esc(au)+'</div>';}
      buf.push(_alibTile(e));});
    flush();return out;}
  // --- Wiederverwendbare Audio-Bausteine ------------------------------------
  //
  //  Diese drei Helfer gehoeren KEINEM Widget: die Bibliothek, die Sammlungskachel und
  //  spaeter die Warteschlange benutzen dieselbe Leiste, dieselbe Zusatztaste und
  //  denselben Weg zum Server. Wer die Beschriftung aendert, aendert sie ueberall.
  var ACTA_MAX=200;                         // Deckel je Aufruf; darueber wird gekuerzt UND gesagt
  function actaBar(mode2,label1,label2){    // Aktionsleiste: erste Taste gefuellt (Hauptweg)
    return '<div class="acta"><button class="acta-b on" data-acta="replace">'+esc(label1||'Alles abspielen')+'</button>'
      +(mode2===false?'':'<button class="acta-b" data-acta="append">'+esc(label2||'Anhängen')+'</button>')+'</div>';
  }
  function actaAdd(idx){                    // Zusatztaste am Zeilenende
    return '<button class="acta-add" data-actaadd="'+idx+'" title="An die Warteschlange anhängen">+</button>';
  }
  /**
   * Eine ganze Sammlung an die aktuelle Zone schicken.
   * ref = Container-Datensatz, mode 'replace'|'append'. Der Server loest die Titelliste
   * auf (Hub) und reiht sie ein (Zone) - das Widget haelt keine Titelliste vor.
   */
  function actaSend(w,ref,mode,titel,cb){
    var s=afSess(w),c=afCur(s);
    if(!c){toast('Kein Raum gewählt');return;}
    if(typeof DOKU!=='undefined'&&DOKU){toast('Demo: '+(mode==='append'?'angehängt':'abgespielt'));cb&&cb();return;}
    toast(mode==='append'?'Wird angehängt …':'Wird geladen …');
    fetch('?api=audio&op=playcontainer&id='+c.id+'&provider='+encodeURIComponent(ref.provider||'')
        +'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},
       body:JSON.stringify({ref:ref,mode:mode,title:titel||ref.title||'',max:ACTA_MAX})})
      .then(function(r){return r.json();}).then(function(j){
        if(!j||!j.ok){toast('Nicht möglich: '+((j&&(j.note||j.err||j.error))||'unbekannt'));cb&&cb();return;}
        var t=(j.note?j.note:((j.count||0)+' Titel '+(mode==='append'?'angehängt':'gestartet')));
        if(j.truncated)t+=' · nur die ersten '+ACTA_MAX;
        if(j.skipped)t+=' · '+j.skipped+' Ordner übersprungen';
        toast(t); afLoad(w,function(){afEmit(w);}); cb&&cb();
      }).catch(function(){toast('Verbindungsfehler');cb&&cb();});
  }

  // --- Playlists anlegen: Auswahl in der Bibliothek --------------------------
  //
  //  Die Liste entsteht IM ANBIETER (Plex/Audiobookshelf), nicht bei uns - sie kommt
  //  danach ueber den normalen Browse-Weg zurueck. Deshalb gibt es hier keinen Speicher,
  //  nur eine Auswahl und zwei Aufrufe.
  function _plKey(it){return String(it&&it.id||'');}
  function _plSelCount(L){var n=0,k;for(k in (L.sel||{}))n++;return n;}
  function _plSelRefs(L){var o=[],k;for(k in (L.sel||{}))o.push(L.sel[k]);return o;}
  function _plCanWrite(w,cb){                       // je Sitzung einmal fragen
    var L=afLib(w);
    if(L.canWrite){cb(L.canWrite);return;}
    if(typeof DOKU!=='undefined'&&DOKU){L.canWrite={plex:true};cb(L.canWrite);return;}
    fetch('?api=audio&op=playlist&sub=canwrite&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
      .then(function(r){return r.json();}).then(function(j){
        var m={};((j&&j.quellen)||[]).forEach(function(q){m[q.provider]=!!q.schreibbar;});
        L.canWrite=m;cb(m);}).catch(function(){cb(L.canWrite={});});
  }
  /**
   * Playlists ALLER schreibfaehigen Anbieter sammeln.
   *
   * Die Seitenleiste zeigte zuerst nur die des gerade gewaehlten Anbieters - stand man auf
   * Audiobookshelf, war das Segment leer, obwohl unter Plex eine Liste lag. "Meine
   * Playlists" ist aber eine Sache, nicht eine je Anbieter.
   */
  function _plLoadAll(w,cb){
    var L=afLib(w);
    _plCanWrite(w,function(m){
      var ids=Object.keys(m||{}).filter(function(k){return m[k];});
      if(!ids.length){L.plAll=[];cb&&cb();return;}
      var offen=ids.length, alle=[];
      ids.forEach(function(pid){
        fetch('?api=audio&op=playlist&sub=list&provider='+encodeURIComponent(pid)
             +'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
          .then(function(r){return r.json();}).then(function(j){
            ((j&&j.playlists)||[]).forEach(function(p){p._prov=pid;alle.push(p);});
          }).catch(function(){}).then(function(){
            if(--offen===0){L.plAll=alle;cb&&cb();}
          });
      });
    });
  }
  function _plLoadLists(w,cb){
    var L=afLib(w);
    fetch('?api=audio&op=playlist&sub=list&provider='+encodeURIComponent(L.provider||'')
         +'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
      .then(function(r){return r.json();}).then(function(j){L.plList=(j&&j.playlists)||[];cb();})
      .catch(function(){L.plList=[];cb();});
  }
  function _plSend(w,sub,body,fertig){
    fetch('?api=audio&op=playlist&sub='+sub+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)})
      .then(function(r){return r.json();}).then(function(j){
        if(!j||!j.ok){toast('Nicht möglich: '+((j&&(j.note||j.error||j.err))||'unbekannt'));return;}
        toast(sub==='create'?('Playlist angelegt: '+((j.playlist||{}).title||''))
             :sub==='delete'?'Playlist gelöscht'
             :((j.uebernommen||0)+' Titel angehängt'));
        fertig&&fertig(j.playlist||null);
      }).catch(function(){toast('Verbindungsfehler');});
  }

  function _alibBody(w,L){
    if(L.loading)return '<div class="alib-empty">lädt …</div>';
    var items=L.items||[];
    if(!items.length)return '<div class="alib-empty">Nichts gefunden</div>';
    var isABS=(L.provider==='audiobookshelf'),g=_alibGroups(items),html='';
    if(g.folders.length)html+='<div class="alib-folders">'+g.folders.map(function(e){var sub=e.it.artist||'';
      var eigen=(L.plOwn&&L.plOwn[e.it.id]);
      return '<button class="alib-folder" data-afitem="'+e.idx+'"><span>'+esc(e.it.title)+'</span>'
        +(eigen?'<span class="pl-own">eigene</span>':'')
        +(sub?'<span class="acta-cnt">'+esc(sub)+'</span>':'<span class="acta-cnt"></span>')
        +'<span class="alib-chev">›</span></button>';}).join('')+'</div>';
    if(g.cards.length){
      if(isABS)html+=_alibBooks(g.cards,L);
      else html+='<div class="alib-grid">'+g.cards.map(_alibTile).join('')+'</div>';
    }
    if(g.plays.length)html+='<div class="alib-rows">'+g.plays.map(function(e){var it=e.it;return '<button class="alib-row" data-afitem="'+e.idx+'">'+_alibCov(it,'sm')+'<div class="alib-rmeta"><div class="alib-tt">'+esc(it.title)+'</div><div class="alib-ts">'+esc(it.artist||'Playlist')+'</div></div><span class="alib-pbtn">▶</span></button>';}).join('')+'</div>';
    if(g.tracks.length)html+='<div class="alib-tracks">'+g.tracks.map(function(e,i){var it=e.it;
      // Aussen div, innen die Flaechentaste: eine Taste IN einer Taste waere ungueltiges HTML.
      var _sel=!!L.selMode, _mk=_sel&&L.sel&&L.sel[_plKey(it)];
      return '<div class="alib-trk hasadd'+(_mk?' mark':'')+'">'
        +(_sel?('<span class="selbox'+(_mk?' on':'')+'" data-afsel="'+e.idx+'">'+(_mk?'✓':'')+'</span>'):'')
        +'<button class="trkmain" data-af'+(_sel?'sel':'item')+'="'+e.idx+'"><span class="alib-n">'+(i+1)+'</span><div class="alib-rmeta"><div class="alib-tt">'+esc(it.title)+'</div><div class="alib-ts">'+esc(it.artist||'')+'</div></div><span class="alib-dur">'+_alibDur(it.durationSec)+'</span></button>'
        +(_sel?'':actaAdd(e.idx))+'</div>';}).join('')+'</div>';
    return html;}
  defWidget('audiolib',{
    label:'Audio · Bibliothek', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[900,560],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      var L=afLib(w);
      if(!L.providers){afLibProviders(w,function(){afEmit(w);});return afMsg('Quellen lädt …');}
      if(!L.providers.length)return afMsg('Keine Medienquelle konfiguriert (Hub → Medienquellen)');
      if(!L.provider){if(!L._auto){L._auto=1;setTimeout(function(){afLibBrowse(w,L.providers[0].id,'','');},0);}return afMsg('lädt …');}
      // Genau ein Ordner in der Wurzel (z. B. Audiobookshelf „Hörbücher") -> ueberspringen und direkt hinein.
      if(!L.loading&&L.items&&!L.stack.length&&L.items.length===1&&L.items[0].isContainer&&!L.items[0].cover&&L._adProv!==L.provider){
        var f0=L.items[0];L._adProv=L.provider;L.stack.push({id:f0.id,title:f0.title});
        setTimeout(function(){afLibBrowse(w,L.provider,f0.id,f0.title);},0);return afMsg('lädt …');}
      function plabel(id){for(var i=0;i<L.providers.length;i++)if(L.providers[i].id===id)return L.providers[i].label;return id;}
      var provs=L.providers.map(function(p){return '<button class="alib-prov'+(L.provider===p.id?' on':'')+'" data-afprov="'+esc(p.id)+'"><span class="alib-pic">'+esc(_alibInit(p.label))+'</span>'+esc(p.label)+'</button>';}).join('');
      var pths='<button class="alib-pth'+(!L.stack.length?' on':'')+'" data-afpath="-1">'+esc(plabel(L.provider))+'</button>'
        +L.stack.map(function(st,i){return '<button class="alib-pth'+(i===L.stack.length-1?' on':'')+'" data-afpath="'+i+'">'+esc(st.title||'…')+'</button>';}).join('');
      // Eigene Playlists gehoeren in die Seitenleiste, nicht drei Ebenen tief zwischen die
      // zehn automatischen Listen von Plex. Gezeigt werden nur die beschreibbaren - also
      // genau die, die man selbst angelegt hat.
      var plseg='';
      if((L.plAll||[]).length){
        plseg='<div class="alib-rh">Playlists</div><div class="alib-pths">'
          +L.plAll.map(function(p,i){
              var an=(L.stack.length&&L.stack[L.stack.length-1].id===p.id&&L.provider===p._prov);
              // Anbieter-Kuerzel nur, wenn es MEHRERE Quellen mit Listen gibt - sonst Ballast.
              var mehr=L.plAll.some(function(q){return q._prov!==p._prov;});
              return '<button class="alib-pth pl-item'+(an?' on':'')+'" data-afplgo="'+i+'">'
                +'<span class="pl-ic">♫</span>'+escL(p.title)
                +(mehr?('<span class="pl-prov">'+esc(_alibInit(plabel(p._prov)))+'</span>'):'')
                +(p.artist?('<span class="pl-cnt">'+esc(p.artist)+'</span>'):'')+'</button>';}).join('')
          +'</div>';
      }
      var rail='<aside class="alib-rail"><div class="alib-rh">Anbieter</div><div class="alib-provs">'+provs+'</div>'
        +'<div class="alib-rh">Pfad</div><div class="alib-pths">'+pths+'</div>'+plseg+'<div class="alib-spacer"></div>'
        +'<div class="alib-anchor"><span class="alib-dot"></span><span>Spielt auf</span><b>'+esc(c.name)+'</b></div></aside>';
      var title=L.stack.length?(L.stack[L.stack.length-1].title||''):('Bibliothek · '+plabel(L.provider));
      var isBooks=(L.provider==='audiobookshelf')&&(L.items||[]).some(function(it){return it.isContainer&&it.cover;});
      var sort=isBooks?('<div class="alib-sort"><button class="alib-sg'+(L.bookSort!=='title'?' on':'')+'" data-afsort="artist">Autor</button><button class="alib-sg'+(L.bookSort==='title'?' on':'')+'" data-afsort="title">Titel</button></div>'):'';
      // Die Sammlungstasten erscheinen NUR, wenn man in einem Container steht und die
      // geladene Liste mindestens einen echten Titel enthaelt. Eine Serienliste enthaelt
      // nur Container - dort waere "Alles abspielen" eine Falle, kein Dienst.
      var spielbar=L.stack.length&&(L.items||[]).some(function(it){return !it.isContainer;});
      var darfSchreiben=!!(L.canWrite&&L.canWrite[L.provider]);
      var akt='';
      if(L.selMode){
        var _n=_plSelCount(L);
        akt='<div class="acta"><span class="selcnt">'+_n+' gewählt</span>'
           +'<button class="acta-b'+(_n?' on':'')+'" data-afplopen="1"'+(_n?'':' disabled')+'>In Playlist …</button>'
           +'<button class="acta-b" data-afselend="1">Abbrechen</button></div>';
      }else if(spielbar){
        // Loeschen gibt es NUR in einer eigenen Liste - Plex' regelbasierte Listen (All
        // Music, Zuletzt gespielt) gehoeren dem Server, die duerfen wir nicht wegraeumen.
        var offen=L.stack.length?L.stack[L.stack.length-1]:null;
        var eigeneListe=!!(offen&&L.plOwn&&L.plOwn[offen.id]);
        var extra='';
        if(L.plDel&&eigeneListe){
          extra='<div class="acta"><span class="selcnt">Playlist löschen?</span>'
              +'<button class="acta-b warn" data-afpldel="1">Ja, löschen</button>'
              +'<button class="acta-b" data-afpldelno="1">Abbrechen</button></div>';
        }else{
          extra=(darfSchreiben?'<div class="acta"><button class="acta-b" data-afselstart="1">Auswählen</button>'
                 +(eigeneListe?'<button class="acta-b" data-afpldelask="1">Löschen</button>':'')
                 +'</div>':'');
        }
        akt=(L.plDel&&eigeneListe?'':actaBar())+extra;
      }
      var head='<div class="alib-head">'+(L.stack.length?'<button class="alib-back" data-afback="1">◀ zurück</button>':'<span></span>')+'<div class="alib-title">'+esc(title)+'</div>'+sort+akt+'</div>';
      var top='<div class="alib-topbar">'+(L.stack.length?'<button class="alib-back" data-afback="1">◀</button>':'')+'<div class="alib-tprovs">'+provs+'</div></div>';
      // Ziel-Feld: neue Liste anlegen oder an eine bestehende anhaengen. Regelbasierte
      // Listen (Plex "Zuletzt gespielt" & Co.) liefert der Server gar nicht erst - an die
      // laesst sich nichts anhaengen, sie waeren nur ein Ziel, das scheitert.
      var pan='';
      if(L.plPanel){
        var lst=(L.plList||[]);
        pan='<div class="pl-panel"><div class="pl-hd">'+_plSelCount(L)+' Titel übernehmen nach …</div>'
           +'<div class="pl-new"><input data-afplname placeholder="Name der neuen Playlist" value="'+esc(L.plName||'')+'">'
           +'<button class="acta-b on" data-afplcreate="1">Neu anlegen</button></div>'
           +(lst.length
              ?('<div class="pl-sep">oder an eine bestehende anhängen</div>'
                +lst.map(function(p,i){return '<button class="pl-row" data-afpladd="'+i+'"><span class="pl-ic">♫</span>'
                    +esc(p.title)+(p.artist?('<span class="pl-cnt">'+esc(p.artist)+'</span>'):'')+'</button>';}).join(''))
              :'<div class="pl-sep">Es gibt hier noch keine Liste, an die sich anhängen lässt.</div>')
           +'<div class="pl-note">Wird bei '+esc(plabel(L.provider))+' gespeichert und erscheint auch dort.</div></div>';
      }
      return '<div class="alib">'+rail+'<section class="alib-main">'+top+head+'<div class="alib-scroll">'+_alibBody(w,L)+'</div></section>'+pan+'</div>';},
    mount:afMount,
    _bind:function(w,el){var L=afLib(w);
      // Eigene Listen aller Quellen: fuer die Seitenleiste UND fuer die Marke "eigene".
      if(!L.plAll){
        L.plAll=[];
        _plLoadAll(w,function(){
          var m={};(L.plAll||[]).forEach(function(p){m[p.id]=1;});
          L.plOwn=m;
          var d=WIDGETS[w.type];var host=el.querySelector('.winner')||el;
          host.innerHTML=d.render(w);if(d._bind)d._bind(w,el);});
      }
      if(!L.canWrite)_plCanWrite(w,function(){var d=WIDGETS[w.type];var host=el.querySelector('.winner')||el;
        host.innerHTML=d.render(w);if(d._bind)d._bind(w,el);});
      $$('[data-afprov]',el).forEach(function(b){b.onclick=function(){L.stack=[];L.selMode=false;L.sel={};L.plPanel=false;afLibBrowse(w,b.getAttribute('data-afprov'),'','');};});
      $$('[data-afpath]',el).forEach(function(b){b.onclick=function(){var i=+b.getAttribute('data-afpath');
        if(i<0){L.stack=[];afLibBrowse(w,L.provider,'','');}else{var st=L.stack[i];L.stack=L.stack.slice(0,i+1);afLibBrowse(w,L.provider,st.id,st.title);}};});
      $$('[data-afsort]',el).forEach(function(b){b.onclick=function(){L.bookSort=b.getAttribute('data-afsort');afEmit(w);};});
      $$('[data-afback]',el).forEach(function(b){b.onclick=function(){L.stack.pop();var t=L.stack.length?L.stack[L.stack.length-1]:{id:'',title:''};afLibBrowse(w,L.provider,t.id||'',t.title||'');};});
      $$('[data-afitem]',el).forEach(function(d){d.onclick=function(){var it=(L.items||[])[+d.getAttribute('data-afitem')];if(!it)return;
        if(it.isContainer){L.stack.push({id:it.id,title:it.title,ref:it});afLibBrowse(w,L.provider,it.id,it.title);}else afLibPlay(w,it);};});
      // Ganze Sammlung: der offene Container ist der oberste Eintrag im Pfad. Er muss den
      // Sprung hinein ueberlebt haben - darum legt afLibBrowse den Datensatz mit ab.
      $$('[data-acta]',el).forEach(function(b){b.onclick=function(){
        var st=L.stack[L.stack.length-1]; if(!st){return;}
        var ref=st.ref||{provider:L.provider,id:st.id,title:st.title,isContainer:true,uri:'',kind:'container'};
        actaSend(w,ref,b.getAttribute('data-acta'),st.title);};});
      $$('[data-actaadd]',el).forEach(function(b){b.onclick=function(ev){ev.stopPropagation();
        var it=(L.items||[])[+b.getAttribute('data-actaadd')]; if(!it)return;
        actaSend(w,it,'append',it.title);};});
      // --- Auswahlmodus ---------------------------------------------------
      function neu(){var d=WIDGETS[w.type];var host=el.querySelector('.winner')||el;
        host.innerHTML=d.render(w);if(d._bind)d._bind(w,el);}
      $$('[data-afplgo]',el).forEach(function(b){b.onclick=function(){
        var p=(L.plAll||[])[+b.getAttribute('data-afplgo')]; if(!p)return;
        L.selMode=false;L.sel={};L.plPanel=false;L.plDel=false;
        L.provider=p._prov||L.provider;               // Liste kann bei einem anderen Anbieter liegen
        L.stack=[{id:p.id,title:p.title,ref:p}];      // Playlists sind ein eigener Einstieg
        afLibBrowse(w,L.provider,p.id,p.title);};});
      var da=$('[data-afpldelask]',el);
      if(da)da.onclick=function(){L.plDel=true;neu();};
      var dn=$('[data-afpldelno]',el);
      if(dn)dn.onclick=function(){L.plDel=false;neu();};
      var dj=$('[data-afpldel]',el);
      if(dj)dj.onclick=function(){
        var offen=L.stack.length?L.stack[L.stack.length-1]:null; if(!offen)return;
        L.plDel=false;
        _plSend(w,'delete',{provider:L.provider,id:offen.id},function(){
          // Nach dem Loeschen nicht in der leeren Liste stehen bleiben.
          L.plAll=null;L.plOwn=null;L.stack=[];
          afLibBrowse(w,L.provider,'','');});
      };
      var sb=$('[data-afselstart]',el);
      if(sb)sb.onclick=function(){L.selMode=true;L.sel={};L.plPanel=false;neu();};
      var se=$('[data-afselend]',el);
      if(se)se.onclick=function(){L.selMode=false;L.sel={};L.plPanel=false;neu();};
      $$('[data-afsel]',el).forEach(function(b){b.onclick=function(ev){ev.stopPropagation();
        var it=(L.items||[])[+b.getAttribute('data-afsel')]; if(!it||it.isContainer)return;
        var k=_plKey(it); L.sel=L.sel||{};
        if(L.sel[k])delete L.sel[k]; else L.sel[k]=it;
        neu();};});
      var po=$('[data-afplopen]',el);
      if(po)po.onclick=function(){
        if(!_plSelCount(L))return;
        L.plPanel=true; neu();
        _plLoadLists(w,function(){neu();});      // Listen nachladen, Feld ist sofort da
      };
      // Der Getippte gehoert in den Zustand, nicht nur ins Feld: das Widget zeichnet sich
      // im Datentakt neu, und dabei entstuende das Feld sonst leer - der Name waere weg,
      // sobald man kurz nichts tut.
      var pn=$('[data-afplname]',el);
      if(pn){pn.oninput=function(){L.plName=this.value;};
             if(L.plPanel&&document.activeElement!==pn){try{pn.focus();
               pn.setSelectionRange(pn.value.length,pn.value.length);}catch(_){}}}
      var pc=$('[data-afplcreate]',el);
      if(pc)pc.onclick=function(){
        var inp=$('[data-afplname]',el);
        var nm=String((inp?inp.value:L.plName)||'').trim();
        if(!nm){toast('Bitte einen Namen eingeben');return;}
        _plSend(w,'create',{provider:L.provider,name:nm,refs:_plSelRefs(L)},function(pl){
          L.selMode=false;L.sel={};L.plPanel=false;L.plList=null;L.plAll=null;L.plName='';
          // GLEICH HINEINSPRINGEN. Vorher landete man wieder im Album und sah nichts von
          // der neuen Liste - sie lag zwar in der Bibliothek, aber drei Ebenen entfernt
          // zwischen den zehn automatischen Listen von Plex.
          if(pl&&pl.id){L.stack.push({id:pl.id,title:pl.title||nm,ref:pl});
                        afLibBrowse(w,L.provider,pl.id,pl.title||nm);}
          else neu();});
      };
      $$('[data-afpladd]',el).forEach(function(b){b.onclick=function(){
        var p=(L.plList||[])[+b.getAttribute('data-afpladd')]; if(!p)return;
        _plSend(w,'add',{provider:L.provider,id:p.id,refs:_plSelRefs(L)},function(){
          L.selMode=false;L.sel={};L.plPanel=false;L.plList=null;L.plAll=null;L.plName='';
          L.stack.push({id:p.id,title:p.title,ref:p});
          afLibBrowse(w,L.provider,p.id,p.title);});
      };});},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audiocollection: Sammlungskachel (fest gebunden) ----------
  //
  //  Zeigt auf GENAU eine Sammlung - ein Album, eine Playlist, eine Hoerbuchserie - und
  //  spielt sie auf dem Raum der Sitzung. Gespeichert wird nur der Zeiger (Anbieter +
  //  Kennung + Anzeigename + Cover), nie eine aufgeloeste Adresse: in den Adressen von
  //  Plex und Audiobookshelf stecken Zugangstokens, die ablaufen. Dadurch veraltet die
  //  Kachel nie und laesst sich beliebig oft auf beliebigen Seiten ablegen.
  defWidget('audiocollection',{
    label:'Audio · Sammlung', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[320,132],
    defaults:function(w){w.session='audio';w.colProvider='';w.colId='';w.colTitle='';w.colSub='';w.colCover='';w.colMode='replace';},
    render:function(w){
      if(!w.colId&&!(typeof DOKU!=='undefined'&&DOKU))
        return afMsg('Keine Sammlung gewählt (Eigenschaften)');
      var t=w.colTitle||'Sammlung', sub=w.colSub||'', cov=w.colCover||'';
      var bild=cov?('<img class="acol-cov" src="'+esc(cov)+'" alt="">')
                  :('<div class="acol-cov acol-ph">'+esc((t||'?').slice(0,1).toUpperCase())+'</div>');
      var marke=w.colProvider?('<div class="acol-badge">'+esc(w.colProvider)+'</div>'):'';
      return '<div class="acol">'+bild+'<div class="acol-body">'+marke
        +'<div class="acol-t">'+esc(t)+'</div>'
        +(sub?'<div class="acol-s">'+esc(sub)+'</div>':'')
        +actaBar(true,'Abspielen','Anhängen')+'</div></div>';},
    mount:afMount,
    _bind:function(w,el){
      $$('[data-acta]',el).forEach(function(b){b.onclick=function(){
        if(!w.colId){toast('Keine Sammlung gewählt');return;}
        actaSend(w,{provider:w.colProvider,id:w.colId,title:w.colTitle,isContainer:true,uri:'',kind:'container'},
          b.getAttribute('data-acta'),w.colTitle);};});},
    props:function(w){
      function f(k,l,ph){return row(l,'<input id="ac_'+k+'" value="'+esc(w[k]||'')+'" placeholder="'+esc(ph||'')+'">');}
      return afSessRow(w)
        +f('colProvider','Anbieter','plex, audiobookshelf, spotify')
        +f('colId','Kennung','Container-Kennung aus der Bibliothek')
        +f('colTitle','Titel','')
        +f('colSub','Unterzeile','z. B. Album · 10 Titel')
        +f('colCover','Cover-Adresse','leer = Platzhalter mit Anfangsbuchstabe')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Anbieter und Kennung stehen in der '
        +'Bibliothek: Sammlung öffnen, die Angaben stehen im Pfad. Gespeichert wird nur der Zeiger, nie eine '
        +'aufgelöste Adresse — deshalb veraltet die Kachel nicht.</div>';},
    wire:function(w){afSessWire(w);
      ['colProvider','colId','colTitle','colSub','colCover'].forEach(function(k){
        var el=$('#ac_'+k); if(!el)return;
        el.onchange=function(){w[k]=this.value||'';commit();
          var box=$('.w[data-id="'+w.id+'"]',canvas);
          if(box){var d=WIDGETS[w.type];var host=box.querySelector('.winner')||box;host.innerHTML=d.render(w);if(d._bind)d._bind(w,box);}};});}
  });

  // ---------- multiroom: Gruppen-Manager (N-zu-1) ----------
  defWidget('multiroom',{
    label:'Audio · Multiroom', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[420,320],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,cur=afCur(s);if(!cur)return afMsg('kein Raum');
      var master=cur.coordinator||'';
      // Zuerst sortieren: verbundene Mitglieder und uebrige Raeume. Erst danach steht fest,
      // ob es ueberhaupt eine Gruppe gibt - davon haengen Kopfzeile und Beschriftungen ab.
      var members=[],free=[];
      s.rooms.forEach(function(rr){
        if(rr.id===cur.id)return;                       // der Master steht separat ganz oben
        var inGrp=(rr.role==='member'&&rr.coordinator===master&&master!=='');
        (inGrp?members:free).push(rr);
      });
      var hasGrp=members.length>0;
      // Kopfzeile: eine Zeile, die NIE umbricht. Der Raumname kuerzt mit Ellipse, der Knopf
      // behaelt seine Breite. Auf schmalen Kacheln traegt er die Kurzform (Container-Query).
      // Ohne Mitglieder gibt es nichts zu trennen - dann entfaellt der Knopf ganz.
      var head='<div class="hd"><span class="aftag">Multiroom · '+esc(hsStripDomain(cur.name))+'</span>'
        +(hasGrp?('<button class="ung" data-afungroup="1" title="Alle Mitglieder aus der Gruppe nehmen">'
          +'<span class="tx">Gruppe trennen</span><span class="ic">Trennen</span></button>'):'')+'</div>';
      // Lautstaerke des Verbunds: ein Regler an den Koordinator (Anzeige = Master-Volume).
      // Ohne Mitglieder regelt er nur diesen einen Raum - das sagt die Beschriftung auch.
      var gvol='<div class="afvolrow gv"><span class="lbl">'+(hasGrp?'Gruppe':'Raum')+'</span>'
        +'<div class="afbar" data-afgvol><i data-afgvolfill style="width:'+Math.max(0,Math.min(100,cur.volume||0))+'%;pointer-events:none"></i></div>'
        +'<span class="afvolnum">'+(cur.volume||0)+'</span></div>';
      // Zeile eines Raums als festes Spaltenraster (Name | Pegel bzw. Status | Zahl | Taste),
      // damit verbundene und getrennte Zeilen dieselben Kanten haben. Verbundene tragen ihren
      // eigenen Pegel, getrennte sind zurueckgenommen. Beitreten/Verlassen ist eine ECKIGE
      // Taste (Haken/Plus, auf breiten Kacheln zusaetzlich beschriftet), kein Kippschalter.
      function mrRow(rr,inGrp,isMaster){
        var lvl=(inGrp||isMaster);
        var st=isMaster?'':(inGrp?'synchron':(rr.role==='member'?'andere Gruppe':(rr.playing?'spielt eigenes':'frei')));
        var v=Math.max(0,Math.min(100,rr.volume||0));
        return '<div class="r'+(lvl?'':' off')+(isMaster?' me':'')+'">'
          +'<span class="nm">'+esc(hsStripDomain(rr.name))+'</span>'
          +(lvl
              ? '<div class="afbar" data-afrvol="'+rr.id+'"><i style="width:'+v+'%;pointer-events:none"></i></div>'
                +'<span class="afvolnum">'+v+'</span>'
              : '<span class="stt">'+esc(st)+'</span><span class="afvolnum"></span>')
          // Der Master kann die eigene Gruppe nicht verlassen -> Abzeichen statt Schein-Schalter.
          +(isMaster ? '<span class="master">Master</span>'
                     : '<button class="grp'+(inGrp?' on':'')+'" data-afgrp="'+rr.id+'" data-afin="'+(inGrp?1:0)+'" title="'+(inGrp?'Aus der Gruppe nehmen':'Zur Gruppe hinzufügen')+'">'
                       +'<span class="ic">'+(inGrp?'✓':'+')+'</span><span class="tx">'+(inGrp?'Verbunden':'Beitreten')+'</span></button>')
          +'</div>';
      }
      // VERBUNDEN zuerst (Master an der Spitze), danach die uebrigen Raeume.
      var rows='<div class="sec">'+(hasGrp?('Verbunden · '+(members.length+1)+' Räume'):'Dieser Raum')+'</div>'
        +mrRow(cur,true,true)+members.map(function(rr){return mrRow(rr,true,false);}).join('')
        +(free.length?('<div class="sec">Weitere Räume</div>'
          +free.map(function(rr){return mrRow(rr,false,false);}).join('')):'');
      return '<div class="afw afmr">'+head+gvol+'<div class="rows">'+rows+'</div></div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);var cur=afCur(s);if(!cur)return;
      // Gruppen-Lautstaerke -> ?api=audio&op=manage {setGroupVolume} an den Koordinator (=aktuelle Zone).
      var gv=$('[data-afgvol]',el);if(gv){var gf=$('[data-afgvolfill]',gv);
        function gpct(x){var box=gv.getBoundingClientRect();return Math.max(0,Math.min(100,Math.round((x-box.left)/box.width*100)));}
        var gd=false;
        gv.onpointerdown=function(e){gd=true;s.dragging=true;try{gv.setPointerCapture(e.pointerId);}catch(_){}var p=gpct(e.clientX);if(gf)gf.style.width=p+'%';e.preventDefault();};
        gv.onpointermove=function(e){if(!gd)return;var p=gpct(e.clientX);if(gf)gf.style.width=p+'%';};
        gv.onpointerup=function(e){if(!gd)return;gd=false;s.dragging=false;var p=gpct(e.clientX);if(gf)gf.style.width=p+'%';
          if(typeof DOKU!=='undefined'&&DOKU){toast('Demo: Gruppen-Vol '+p);return;}
          afManage(w,cur.id,{op:'setGroupVolume',args:{volume:p}});};
        gv.onpointercancel=function(){gd=false;s.dragging=false;};
      }
      // Lautstaerke EINES verbundenen Raums (eigener Pegel trotz Gruppe).
      $$('[data-afrvol]',el).forEach(function(bar){
        var rid=+bar.getAttribute('data-afrvol');var fill=bar.querySelector('i');
        function pct(x){var b=bar.getBoundingClientRect();return Math.max(0,Math.min(100,Math.round((x-b.left)/b.width*100)));}
        var dg=false;
        bar.onpointerdown=function(e){dg=true;s.dragging=true;try{bar.setPointerCapture(e.pointerId);}catch(_){}var p=pct(e.clientX);if(fill)fill.style.width=p+'%';e.preventDefault();};
        bar.onpointermove=function(e){if(!dg)return;var p=pct(e.clientX);if(fill)fill.style.width=p+'%';};
        bar.onpointerup=function(e){if(!dg)return;dg=false;s.dragging=false;var p=pct(e.clientX);if(fill)fill.style.width=p+'%';
          if(typeof DOKU!=='undefined'&&DOKU){toast('Demo: Raum-Vol '+p);return;}
          var rr=s.rooms.filter(function(x){return x.id===rid;})[0];
          var vid=(rr&&rr.vars&&rr.vars.Volume)||0;
          if(vid){fetch('?api=setvar&id='+vid+'&value='+p+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
            .then(function(){afLoad(w,function(){afEmit(w);});});}
          else afManage(w,rid,{op:'setVolume',args:{volume:p}});};
        bar.onpointercancel=function(){dg=false;s.dragging=false;};
      });
      // Master-UID (RINCON) des aktuellen Raums als coordinator; members = aktuelle Gruppe +/- toggle.
      $$('[data-afgrp]',el).forEach(function(b){b.onclick=function(){var rid=+b.getAttribute('data-afgrp');var wasIn=b.getAttribute('data-afin')==='1';
        var target=s.rooms.filter(function(x){return x.id===rid;})[0];if(!target)return;
        // Beitritt und Austritt laufen beide ueber die Instanz des MITGLIEDS: ihm wird gesagt,
        // welchem Koordinator es folgt (coordinatorUid) und dass es selbst dazugehoert
        // (memberUids). Frueher stand in memberUids die UID des MASTERS - das Mitglied fand
        // sich in seiner eigenen Liste also nicht wieder, und der Treiber las das als
        // "verlassen". Deshalb liess sich nie jemand hinzufuegen. Beide UIDs kommen aus
        // ?api=audio (Feld uid je Raum); fehlt eine, wird gar nicht erst geschaltet.
        var coord=cur.uid||cur.coordinator||'';
        var self=target.uid||'';
        if(wasIn){
          afEcho(s,target,'role','standalone'); afEcho(s,target,'coordinator',self||target.coordinator);
          afEmit(w); afManage(w,rid,{op:'ungroup',args:{}});
        } else if(!coord||!self){ toast('Gruppe: Player-Kennung fehlt'); }
        else {
          afEcho(s,target,'role','member'); afEcho(s,target,'coordinator',coord);
          afEmit(w); afManage(w,rid,{op:'group',args:{coordinatorUid:coord,memberUids:[self]}});
        }
      };});
      var ug=$('[data-afungroup]',el);if(ug)ug.onclick=function(){ // alle Mitglieder trennen
        s.rooms.forEach(function(rr){ if(rr.role==='member'&&rr.coordinator===cur.coordinator){
          afEcho(s,rr,'role','standalone'); afEcho(s,rr,'coordinator',rr.uid||rr.coordinator);
          afManage(w,rr.id,{op:'ungroup',args:{}}); } });
        afEmit(w);
      };},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audioqueue: Warteschlange der aktuellen Zone ----------
  //
  //  Liest ?api=audio&op=queue fuer den Raum, den die Sitzung gerade zeigt, und stellt die
  //  laufende Spur ueber die kommenden. Ein Klick auf eine Zeile springt sie an (op=queueplay).
  //  Nicht jeder Zuspieler fuehrt eine Warteschlange (Radio, Direktstream) - dann meldet das
  //  Backend supported=false und die Kachel sagt das ruhig, statt eine leere Liste zu zeigen.

  // Dauer "4:29" bzw. "1:02:11" -> Sekunden. Unlesbares zaehlt als 0 (die Summe bleibt ehrlich klein).
  function aqSec(t){var p=String(t||'').split(':');if(p.length<2)return 0;var n=0;
    for(var i=0;i<p.length;i++){n=n*60+(parseInt(p[i],10)||0);}return n;}
  // Sekunden -> Gesamtdauer in Worten ("58 min", "1 h 12 min"). Kurz genug fuer die Kopfzeile.
  function aqTotal(sec){sec=Math.max(0,Math.round(sec||0));var m=Math.round(sec/60);
    if(m<60)return m+' min';var h=Math.floor(m/60);return h+' h '+(m%60)+' min';}
  // Mini-Cover: Bild wenn vorhanden, sonst der Anfangsbuchstabe als ruhiger Platzhalter.
  function aqCov(it,cls){
    return '<span class="aq-cov '+cls+'"><span class="aq-ph">'+esc(_alibInit(it&&it.title))+'</span>'
      +((it&&it.cover)?('<img src="'+esc(it.cover)+'" loading="lazy" onerror="this.remove()">'):'')+'</span>';}

  function aqDemo(){return {ok:true,supported:true,current:1,total:6,items:[
    {idx:0,title:'Gloria',artist:'Patti Smith Group',album:'Horses',cover:'',duration:'5:57'},
    {idx:1,title:'Redondo Beach',artist:'Patti Smith Group',album:'Easter',cover:'',duration:'4:29'},
    {idx:2,title:'Because the Night',artist:'Patti Smith Group',album:'Easter',cover:'',duration:'3:23'},
    {idx:3,title:'Dancing Barefoot',artist:'Patti Smith Group',album:'Wave',cover:'',duration:'4:16'},
    {idx:4,title:'Frederick',artist:'Patti Smith Group',album:'Wave',cover:'',duration:'3:03'},
    {idx:5,title:'People Have the Power',artist:'Patti Smith',album:'Dream of Life',cover:'',duration:'5:10'}
  ]};}

  // Warteschlange laden. Der Stand haengt an der SITZUNG (nicht am Widget), damit mehrere
  // Kacheln derselben Session sich eine Abfrage teilen. limit kommt aus dem Widget.
  function afLoadQueue(w,lim){var s=afSess(w),c=afCur(s);if(!c)return;
    if(s.qLoading)return;s.qLoading=true;s.qPend=false;
    if(typeof DOKU!=='undefined'&&DOKU){var d=aqDemo();d.roomId=c.id;s.queue=d;s.qLoading=false;afEmit(w);return;}
    fetch('?api=audio&op=queue&id='+c.id+'&limit='+Math.max(1,Math.min(200,lim||60)),{cache:'no-store'})
      .then(function(r){return r.json();}).then(function(j){
        j=j||{};j.roomId=c.id;s.queue=j;s.qLoading=false;afEmit(w);
      }).catch(function(){s.queue={ok:false,roomId:c.id,err:'Verbindungsfehler'};s.qLoading=false;afEmit(w);});}
  // Auffrischen im Sitzungs-Takt - aber nur, wenn ueberhaupt eine Warteschlangen-Kachel laeuft.
  function afQueueTick(w){var s=afSess(w);if(!s.queue)return;afLoadQueue(w,s.qLim||60);}

  defWidget('audioqueue',{
    label:'Audio · Warteschlange', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[420,360],
    defaults:function(w){w.session='audio';w.qLimit=60;},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');
      var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      s.qLim=Math.max(1,Math.min(200,parseInt(w.qLimit,10)||60));
      // Raumwechsel: der alte Stand gehoert einem anderen Raum und wird verworfen.
      if(!s.queue||s.queue.roomId!==c.id){
        if(!s.qLoading&&!s.qPend){s.qPend=true;setTimeout(function(){afLoadQueue(w,s.qLim);},0);}
        return afMsg('Warteschlange lädt …'); }
      var q=s.queue,head='<span class="aftag">Warteschlange · '+esc(hsStripDomain(c.name))+'</span>';
      function shell(inner,meta){return '<div class="afw aq"><div class="aq-hd">'+head
        +'<span class="aq-meta">'+(meta||'')+'</span></div>'+inner+'</div>';}
      if(q.ok===false&&q.supported!==false)return shell('<div class="aq-none">Warteschlange nicht lesbar.'
        +'<span>'+esc(q.err||q.error||'Der Zuspieler hat nicht geantwortet.')+'</span></div>','');
      if(q.supported===false)return shell('<div class="aq-none">Diese Quelle führt keine Warteschlange.'
        +'<span>Radio und Direktstreams laufen ohne Titelliste.</span></div>','');
      var items=q.items||[];
      if(!items.length)return shell('<div class="aq-none">Die Warteschlange ist leer.'
        +'<span>Über Bibliothek oder Quelle lässt sich etwas hinzufügen.</span></div>','0 Titel');
      var sum=0;items.forEach(function(it){sum+=aqSec(it.duration);});
      var total=q.total||items.length;
      // Gesamtdauer bezieht sich auf die GELADENEN Titel - bei gekuerzter Liste ehrlich kennzeichnen.
      var meta=esc(total+' Titel · '+aqTotal(sum)+(items.length<total?' (erste '+items.length+')':''));
      var cur=Math.max(0,Math.min(items.length-1,q.current||0));
      var ci=items[cur];
      var curBlk='<div class="aq-cur">'+aqCov(ci,'lg')
        +'<div class="aq-m"><div class="aq-lbl">'+(c.playing?'Läuft gerade':'Angehalten')+'</div>'
        +'<div class="aq-t">'+esc(ci.title||'—')+'</div>'
        +'<div class="aq-a">'+esc([ci.artist,ci.album].filter(Boolean).join(' · '))+'</div></div>'
        +'<span class="aq-d">'+esc(ci.duration||'')+'</span></div>';
      var next=items.slice(cur+1);
      var list=next.length
        ? '<div class="aq-list">'+next.map(function(it){
            return '<button class="aq-row" data-aqidx="'+(it.idx!=null?it.idx:'')+'">'
              +'<span class="aq-n">'+((it.idx!=null?it.idx:0)+1)+'</span>'+aqCov(it,'sm')
              +'<div class="aq-m"><div class="aq-t">'+esc(it.title||'—')+'</div>'
              +'<div class="aq-a">'+esc(it.artist||'')+'</div></div>'
              +'<span class="aq-d">'+esc(it.duration||'')+'</span></button>';}).join('')+'</div>'
        : '<div class="aq-none">Danach ist die Warteschlange zu Ende.<span></span></div>';
      return shell(curBlk+'<div class="aq-sec">Als Nächstes</div>'+list,meta);},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);
      $$('[data-aqidx]',el).forEach(function(b){b.onclick=function(){
        var idx=parseInt(b.getAttribute('data-aqidx'),10);if(isNaN(idx))return;
        var c=afCur(s);if(!c)return;
        if(typeof DOKU!=='undefined'&&DOKU){toast('Demo: Spur '+(idx+1));return;}
        fetch('?api=audio&op=queueplay&id='+c.id+'&index='+idx+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
          .then(function(r){return r.json();}).then(function(j){
            if(j&&j.note)toast(j.note);
            // Kurz warten: der Player braucht einen Moment, bis Position und Spur stimmen.
            setTimeout(function(){afLoad(w,function(){afEmit(w);});afLoadQueue(w,s.qLim||60);},1200);
          }).catch(function(){toast('Warteschlange: Verbindungsfehler');});
      };});},
    props:function(w){return afSessRow(w)
      +row('Titel laden','<input id="aqLimInp" type="number" min="1" max="200" value="'+(parseInt(w.qLimit,10)||60)+'">')
      +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Wie viele Einträge der Warteschlange geholt werden (1 bis 200).</div>';},
    wire:function(w){afSessWire(w);
      if($('#aqLimInp'))$('#aqLimInp').onchange=function(){
        w.qLimit=Math.max(1,Math.min(200,parseInt(this.value,10)||60));commit();
        var s=afSess(w);s.qLim=w.qLimit;s.queue=null;afEmit(w);};}
  });
