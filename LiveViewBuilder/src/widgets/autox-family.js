  // ===== Widget-Familie Licht-Automatik (autox) — maximal modular =====
  //
  //  Backend: HomeSuite Hub ueber ?api=light&op=autoget/autoset (Regel-Store lightAuto).
  //  Vier kleine Bausteine, frei kombinierbar auf mehreren Seiten:
  //    autolist   : Regel-Liste + Gesamt-Automatik-Schalter (+ Regel anlegen) — waehlt eine Regel
  //    autoedit   : Detail-Editor der gewaehlten Regel (folgt autolist auf derselben Seite)
  //    autocard   : EINE Kategorie als Karte (w.kind = schedule|circadian|wake|motion|presence)
  //    autotimeline: Verlauf ueber einen Tag ODER die ganze Woche (tlSpan), mit
  //                  Sonnenauf/-untergang, Regel-Markern und Band-Schaltpunkten
  //  Schatten-sicher: Aenderungen schreiben die Konfig; der Hub-Timer wertet aus.
  (function(){
    var A={cfg:null,scenes:[],lights:[],zones:[],motionSensors:[],awaySensors:[],sel:-1,subs:[],stations:null,dirty:false,sources:{}};
    // Senderliste fuer die Weck-Auswahl. Einmal je Sitzung; dieselbe Quelle, aus der
    // sich auch die Radioliste der Musikseite speist.
    // Favoriten und Playlists EINER Zone. Je Zone einmal gemerkt - die Liste kommt
    // vom Player und aendert sich selten, ein Abruf je Tastendruck waere Unfug.
    function aSources(zone,cb){
      zone=parseInt(zone)||0;
      if(!zone){cb&&cb();return;}
      if(A.sources[zone]){cb&&cb();return;}
      if(typeof DOKU!=='undefined'&&DOKU){A.sources[zone]={favorites:[{id:'FV:2/1',title:'Morgenradio'}],playlists:[]};cb&&cb();return;}
      fetch('?api=audio&op=sources&id='+zone,{cache:'no-store'}).then(function(r){return r.json();})
        .then(function(j){A.sources[zone]={favorites:(j&&j.favorites)||[],playlists:(j&&j.playlists)||[]};cb&&cb();})
        .catch(function(){A.sources[zone]={favorites:[],playlists:[]};cb&&cb();});
    }
    /**
     * Welche Audiozone ist im Raumschalter der Musikseite gerade gewaehlt?
     *
     * audiox-family.js ist nicht gekapselt, seine Funktionen stehen also auch hier
     * zur Verfuegung. 0, wenn es keine Musikseite gibt - dann wird nicht gefiltert,
     * und das Widget verhaelt sich wie ueberall sonst.
     */
    function zonenName(id){
      var z=(A.zones||[]).filter(function(x){return x.id==id;})[0];
      return z?z.name:('#'+id);
    }
    function aktiveZone(sitzung){
      if(typeof afSess!=='function'||typeof afCur!=='function')return 0;
      try{ var r=afCur(afSess({session:sitzung||'audio'})); return (r&&r.id)?(parseInt(r.id,10)||0):0; }
      catch(e){ return 0; }
    }
    function aStations(cb){
      if(A.stations){cb&&cb();return;}
      if(typeof DOKU!=='undefined'&&DOKU){A.stations=[{key:'oe3',title:'Hitradio Ö3'},{key:'fm4',title:'FM4'}];cb&&cb();return;}
      fetch('?api=audio&op=radiostations',{cache:'no-store'}).then(function(r){return r.json();})
        .then(function(j){A.stations=(j&&j.stations)||[];cb&&cb();})
        .catch(function(){A.stations=[];cb&&cb();});
    }
    function sensorSel(id,list,attr){
      id=parseInt(id)||0;
      var opts='<option value="0">— Sensor wählen —</option>'+(list||[]).map(function(s){
        return '<option value="'+s.id+'"'+(s.id===id?' selected':'')+'>'+escL(s.instance)+(s.var&&s.var!==s.instance?(' · '+escL(s.var)):'')+'</option>';}).join('');
      if(id&&!(list||[]).some(function(s){return s.id===id;}))opts+='<option value="'+id+'" selected>#'+id+'</option>';
      return '<select class="ax-sel" '+attr+'>'+opts+'</select>';
    }
    var TYPES={
      schedule:{label:'Zeitplan',plural:'Zeitpläne'},
      circadian:{label:'Circadian',plural:'Circadian'},
      wake:{label:'Wecker',plural:'Wecker'},
      motion:{label:'Bewegung',plural:'Bewegung'},
      presence:{label:'Anwesenheit',plural:'Anwesenheit'}
    };
    var DAYS=['So','Mo','Di','Mi','Do','Fr','Sa'];

    function aIcon(kind){
      var p={
        schedule:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        circadian:'<path d="M4 12a8 8 0 0116 0"/><path d="M12 4V2M8 20h8"/>',
        // Wecker, nicht Gluehbirne: die Regelart kam aus der Lichtsteuerung und hat
        // deren Lampensymbol geerbt. Seit sie rein Audio ist (kein Szenenschalten),
        // war das Bild schlicht falsch - besonders auf der Musikseite.
        wake:'<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 2"/>'
             +'<path d="M5 4L2.5 6.2M19 4l2.5 2.2"/><path d="M8.5 20.5L7 22M15.5 20.5L17 22"/>',
        motion:'<path d="M3 12h4l2-7 4 14 2-7h4"/>',
        presence:'<path d="M3 21v-2a4 4 0 014-4h4M14 7a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M16 11l2 2 4-4"/>',
        sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19M3 12H1M23 12h-2"/>'
      };
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(p[kind]||p.schedule)+'</svg>';
    }
    function tog(on,attr){return '<span class="ax-tog'+(on?' on':'')+'"'+(attr||'')+'></span>';}

    // ---- Daten ----
    var _loading=false,_pending=[];
    function aLoad(cb){
      if(typeof DOKU!=='undefined'&&DOKU){A.cfg=aDemo();A.scenes=[{id:'abend',name:'Abend'},{id:'aus',name:'Alles aus'},{id:'morgen',name:'Guten Morgen'}];A.lights=[{id:1,name:'Wohnzimmer',room:'Wohnzimmer'},{id:2,name:'Küche',room:'Küche'}];A.zones=[{id:9,name:'Küche'}];if(A.sel<0&&A.cfg.rules.length)A.sel=0;cb&&cb();return;}
      if(_loading){if(cb)_pending.push(cb);return;} // laufendes Laden dedupen (keine 5 Parallel-Requests)
      _loading=true;
      Promise.all([
        fetch('?api=light&op=autoget',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=scenes',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=audio&op=list',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=sensors&kind=motion',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=sensors&kind=away',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        // Senderliste gehoert dazu: die Regelliste zeigt den Sender im Klartext und
        // wird VOR dem Editor gezeichnet - nachtraeglich geladen kaeme sie zu spaet.
        fetch('?api=audio&op=radiostations',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};})
      ]).then(function(res){
        A.cfg=(res[0]&&res[0].ok)?res[0]:{enabled:false,rules:[],sun:{sunrise:360,sunset:1200}};
        if(!A.cfg.sun)A.cfg.sun={sunrise:360,sunset:1200};
        A.scenes=(res[1]&&res[1].scenes)||[]; A.lights=(res[2]&&res[2].lights)||[]; A.zones=(res[3]&&res[3].rooms)||[];
        A.motionSensors=(res[4]&&res[4].sensors)||[]; A.awaySensors=(res[5]&&res[5].sensors)||[];
        A.stations=(res[6]&&res[6].stations)||A.stations||[];
        if(A.sel<0 && A.cfg.rules.length)A.sel=0;
        _loading=false; var cbs=_pending; _pending=[];
        cb&&cb(); cbs.forEach(function(f){try{f();}catch(e){}});
      }).catch(function(){_loading=false;var cbs=_pending;_pending=[];cb&&cb();cbs.forEach(function(f){try{f();}catch(e){}});});
    }
    function aDemo(){return {enabled:true,sun:{sunrise:360,sunset:1224},rules:[
      {type:'schedule',name:'Abend',enabled:true,trigger:{kind:'sun',event:'sunset',offsetMin:-15,days:[]},sceneId:'abend'},
      {type:'schedule',name:'Alles aus',enabled:true,trigger:{kind:'time',time:'22:30',days:[]},sceneId:'aus'},
      {type:'circadian',name:'Circadian OG',enabled:true,devices:[1,2],minK:2200,maxK:5500,minLevel:15,maxLevel:100,level:true},
      {type:'wake',name:'Wecken',enabled:true,time:'06:30',days:[1,2,3,4,5],rampMin:20,volume:25,audioZone:9,audioSource:{kind:'station',id:'oe3'}},
      {type:'motion',name:'Bewegung Gang',enabled:false,sensor:0,lux:0,luxMax:50,devices:[],holdSec:120},
      {type:'presence',name:'Anwesenheit',enabled:false,awayVar:0,from:'18:00',to:'23:30',devices:[],every:20}
    ]};}
    function aSave(cb){
      if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();aEmit();return;}
      fetch('?api=light&op=autoset&key='+encodeURIComponent(TOKEN),{method:'POST',cache:'no-store',
        headers:{'Content-Type':'text/plain'},body:JSON.stringify({enabled:!!A.cfg.enabled,rules:A.cfg.rules})})
        .then(function(r){return r.json();}).then(function(){A.dirty=false;cb&&cb();aEmit();}).catch(function(){cb&&cb();});
    }
    // Notbremse: ein Zeichnen darf ein weiteres ausloesen (eine Liste korrigiert
    // die Auswahl, der Editor daneben zieht nach), aber nicht beliebig tief. Zwei
    // Listen mit verschiedenen Filtern koennten sich sonst um A.sel streiten und
    // die Seite einfrieren - ohne Fehlermeldung, weil nichts wirft.
    var _emitTiefe=0;
    function aEmit(){
      if(_emitTiefe>=4)return;
      _emitTiefe++;
      try{
        // Wer nicht mehr im Dokument steht, fliegt raus. Sonst reden Seiten mit,
        // die laengst verlassen sind.
        A.subs=A.subs.filter(function(s){
          return !s.wid || document.querySelector('.w[data-id="'+s.wid+'"]');
        });
        A.subs.slice().forEach(function(s){try{s.fn();}catch(e){}});
      }
      finally{ _emitTiefe--; }
    }
    // Der 45-Sekunden-Takt holt die Regeln neu und ERSETZT A.cfg. Wer gerade
    // Wochentage anklickt oder die Uhrzeit stellt und nicht sofort speichert,
    // verliert die Eingabe genau dann - sichtbar als "nur ein Tag uebernommen".
    // Solange etwas offen ist, wird deshalb nicht nachgeladen.
    function aTouch(){A.dirty=true;}
    /**
     * Zuhoerer anmelden - MIT Widget, damit sie beim Seitenwechsel abgeraeumt
     * werden koennen. Ohne das blieben die Zuhoerer alter Seiten stehen: auf der
     * Lichtseite lief die Weckerliste weiter mit, beide korrigierten die geteilte
     * Auswahl in ihre Richtung, und ein Klick auf eine Regel wirkte gar nicht.
     */
    function aSub(fn,w){A.subs.push({fn:fn,wid:(w&&w.id)||''});}

    function sceneName(id){var s=A.scenes.find(function(x){return x.id===id;});return s?s.name:(id||'—');}
    function daysTxt(d){if(!d||!d.length)return 'täglich';if(d.length===7)return 'täglich';
      if(JSON.stringify(d.slice().sort())==='[1,2,3,4,5]')return 'Mo–Fr';return d.map(function(x){return DAYS[x];}).join(' ');}
    function rulesOf(kind){return (A.cfg&&A.cfg.rules||[]).map(function(r,i){return {r:r,i:i};}).filter(function(o){return o.r.type===kind;});}

    // Ausloeser als Text - fuer trigger wie fuer endTrigger dieselbe Schreibweise.
    function trigTxt(t){
      t=t||{};
      return (t.kind==='sun')
        ? ((t.event==='sunrise'?'Sonnenaufgang':'Sonnenuntergang')+(t.offsetMin?(' '+(t.offsetMin>0?'+':'')+t.offsetMin+'′'):''))
        : (t.time||'—');
    }
    function aSummary(r){
      if(r.type==='schedule'){
        var aus=(r.sceneAction==='off');
        var txt=trigTxt(r.trigger)+' '+(aus?'aus':'→')+' '+sceneName(r.sceneId);
        if(r.endTrigger)txt+=' · bis '+trigTxt(r.endTrigger);
        return txt;
      }
      if(r.type==='circadian')return (r.devices?r.devices.length:0)+' Lampen · '+r.minK+'–'+r.maxK+' K';
      if(r.type==='wake'){
        var q=wakeQuelle(r), zn=(A.zones||[]).filter(function(z){return z.id==r.audioZone;})[0];
        var art={station:'Radio',playlist:'Playlist',favorite:'Favorit'}[q.kind]||q.kind;
        // Sender mit Klarnamen, sofern die Liste schon da ist - 'oe3' sagt weniger
        // als 'Hitradio Oe3'.
        var qn=q.id;
        if(q.kind==='station'&&A.stations){
          var tr=A.stations.filter(function(x){return x.key===q.id;})[0];
          if(tr)qn=tr.title||q.id;
        } else if(q.kind!=='station'){
          var qu2=A.sources[parseInt(r.audioZone)||0];
          var ls2=qu2?(q.kind==='playlist'?qu2.playlists:qu2.favorites):null;
          if(ls2){var tr2=ls2.filter(function(x){return x.id===q.id;})[0]; if(tr2)qn=tr2.title||q.id;}
        }
        return (r.time||'—')+' · '+daysTxt(r.days)+' → '+(zn?zn.name:'(keine Zone)')
          +(q.id?(' · '+art+' '+qn):'')
          +(r.rampMin?(' · '+r.rampMin+' min Rampe'):'')
          +(+r.offAfterMin>0?(' · '+(+r.offAfterMin)+' min lang'):'');
      }
      if(r.type==='motion')return '< '+(r.luxMax||0)+' lux · '+Math.round((r.holdSec||0)/60)+' min';
      if(r.type==='presence')return (r.from||'')+'–'+(r.to||'');
      return '';
    }
    function aDefault(kind){
      var b={type:kind,enabled:true,name:TYPES[kind].label};
      if(kind==='schedule')return Object.assign(b,{trigger:{kind:'time',time:'20:00',event:'sunset',offsetMin:0,days:[]},sceneId:(A.scenes[0]||{}).id||''});
      if(kind==='circadian')return Object.assign(b,{devices:[],minK:2200,maxK:5500,minLevel:15,maxLevel:100,level:true});
      if(kind==='wake')return Object.assign(b,{time:'06:30',days:[1,2,3,4,5],rampMin:20,volume:25,
        audioZone:aktiveZone(''),audioSource:{kind:'station',id:''}});
      if(kind==='motion')return Object.assign(b,{sensor:0,lux:0,luxMax:50,devices:[],holdSec:120,level:-1});
      if(kind==='presence')return Object.assign(b,{awayVar:0,from:'18:00',to:'23:30',devices:[],every:20});
      return b;
    }
    function aAdd(kind){A.cfg.rules.push(aDefault(kind));A.sel=A.cfg.rules.length-1;aSave();}

    function elOf(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function host(w){var el=elOf(w);return el?(el.querySelector('.winner')||el):null;}

    // =============================== autolist ===============================
    // Gesamt-Automatik: kombiniert Regel-Store (A.cfg.enabled) + Hub-Variable (automationEnabled).
    function masterOn(){if(!A.cfg)return false;var on=!!A.cfg.enabled;if(A.cfg.automationEnabled!=null)on=on&&!!A.cfg.automationEnabled;return on;}
    /**
     * Welche Regelarten zeigt dieses Widget?
     *
     * axOnly beschraenkt auf EINE Art - fuer eine Seite, die nur Wecker zeigt.
     * axOhne blendet EINE Art aus - fuer die Lichtseite, die alles ausser den
     * Weckern zeigen soll. Beide leer = alles, wie es vorher war.
     *
     * Ohne axOhne tauchten die Weckregeln in der Licht-Zeitsteuerung auf, sobald
     * es die ersten gab: sie liegen im selben Regelspeicher, sind dort aber fehl
     * am Platz.
     */
    function axArt(w){
      return {
        nur:  (w && w.axOnly && TYPES[w.axOnly]) ? w.axOnly : '',
        ohne: (w && w.axOhne && TYPES[w.axOhne]) ? w.axOhne : '',
      };
    }
    function axPasst(r, f){
      if (!r) return false;
      if (f.nur  && r.type !== f.nur)  return false;
      if (f.ohne && r.type === f.ohne) return false;
      return true;
    }
    // Beschraenkung auf EINE Regelart (w.axOnly). Leer = alle, wie bisher.
    // Wichtig: der Index in data-axsel bleibt der Index in A.cfg.rules - die
    // Auswahl wird sitzungsweit geteilt, eine Umnummerierung der gefilterten
    // Liste wuerde die falsche Regel oeffnen.
    function listRender(w){
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      var f=axArt(w), nur=f.nur;
      // Dem Raumschalter folgen (wie "Jetzt laeuft" und "Bibliothek"): nur die
      // Regeln des gewaehlten Geraets. Ohne gewaehlte Zone bleibt alles sichtbar.
      var zone=(w&&w.axZone)?aktiveZone(w.axSession):0;
      var alle=(A.cfg.rules||[]).map(function(r,i){return {r:r,i:i};})
        .filter(function(x){return axPasst(x.r,f);});
      var imRaum=zone?alle.filter(function(x){return (parseInt(x.r.audioZone,10)||0)===zone;}):alle;
      // Hat der gewaehlte Raum keine Regel, wird NICHT ausgeblendet, sondern alles
      // gezeigt. Sonst steht man vor einer leeren Liste und die Seite wirkt kaputt:
      // genau das passierte, als alle drei Wecker dem Lesezimmer gehoerten und der
      // Raumschalter woanders stand - es gab nichts zum Anklicken.
      var raumLeer=!!(zone&&!imRaum.length);
      var sichtbar=raumLeer?alle:imRaum;
      var rows=sichtbar.map(function(x){
        var r=x.r,i=x.i;
        return '<div class="ax-row'+(i===A.sel?' on':'')+(r.enabled===false?' off':'')+'" data-axsel="'+i+'">'
          +'<span class="ax-ic">'+aIcon(r.type)+'</span>'
          +'<div class="ax-tx"><div class="ax-nm">'+escL(r.name||TYPES[r.type].label)+'</div><div class="ax-sub">'+esc(aSummary(r))+'</div></div>'
          +tog(r.enabled!==false,' data-axen="'+i+'"')+'</div>';
      }).join('');
      var arten=nur?[nur]:Object.keys(TYPES).filter(function(k){return k!==f.ohne;});
      var add='<div class="ax-add">'+arten.map(function(k){return '<button data-axadd="'+k+'"><span class="ax-ic">'+aIcon(k)+'</span>'+esc(TYPES[k].label)+'</button>';}).join('')+'</div>';
      var leer=nur?('Noch keine '+TYPES[nur].plural):'Noch keine Regeln';
      return '<div class="ax">'
        +'<div class="ax-head"><span class="ax-h-t">'+esc(nur?TYPES[nur].plural:'Automatik')+'</span>'
        +(zone?('<span class="ax-badge">'+escL(raumLeer?('nichts für '+zonenName(zone)+' – alle'):zonenName(zone))+'</span>'):'')
        +tog(masterOn(),' data-axmaster="1"')+'</div>'
        +'<div class="ax-list">'+(rows||'<div class="ax-msg">'+esc(leer)+'</div>')+'</div>'
        +'<div class="ax-addwrap"><div class="ax-addlbl">＋ Regel</div>'+add+'</div></div>';
    }
    function listWire(h,w){
      h.querySelectorAll('[data-axsel]').forEach(function(e){e.onclick=function(ev){if(ev.target.closest('.ax-tog'))return;A.sel=+e.getAttribute('data-axsel');aEmit();};});
      h.querySelectorAll('[data-axen]').forEach(function(e){e.onclick=function(ev){ev.stopPropagation();var i=+e.getAttribute('data-axen');A.cfg.rules[i].enabled=!(A.cfg.rules[i].enabled!==false);aSave();};});
      var m=h.querySelector('[data-axmaster]');if(m)m.onclick=function(){var on=!masterOn();A.cfg.enabled=on;if(A.cfg.automationVar){A.cfg.automationEnabled=on;if(typeof setVar==='function')setVar(A.cfg.automationVar,on);}aSave();};
      h.querySelectorAll('[data-axadd]').forEach(function(e){e.onclick=function(){aAdd(e.getAttribute('data-axadd'));};});
    }

    // =============================== autoedit ===============================
    function chips(list,sel,attr){return list.map(function(o){var on=sel.indexOf(o.id)>=0;return '<button class="ax-chip'+(on?' on':'')+'" '+attr+'="'+o.id+'">'+escL(o.name)+'</button>';}).join('');}
    function daychips(sel,attr){return DAYS.map(function(d,i){var on=(sel||[]).indexOf(i)>=0;return '<button class="ax-day'+(on?' on':'')+'" '+attr+'="'+i+'">'+d+'</button>';}).join('');}
    function sceneSel(id,attr){return '<select class="ax-sel" '+attr+'>'+A.scenes.map(function(s){return '<option value="'+esc(s.id)+'"'+(s.id===id?' selected':'')+'>'+escL(s.name)+'</option>';}).join('')+'</select>';}

    function editRender(){
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      var r=A.cfg.rules[A.sel];
      if(!r)return '<div class="ax"><div class="ax-msg" style="padding:clamp(10px,5cqmin,24px)">Regel links wählen oder anlegen.</div></div>';
      var h='<div class="ax ax-ed"><div class="ax-ed-head"><span class="ax-ic">'+aIcon(r.type)+'</span>'
        +'<input class="ax-name" id="axName" value="'+esc(r.name||'')+'"><span class="ax-badge">'+esc(TYPES[r.type].label)+'</span>'
        +tog(r.enabled!==false,' id="axEnEd"')+'</div><div class="ax-ed-body">';
      if(r.type==='schedule'){var t=r.trigger||{};
        h+=fld('Auslöser','<div class="ax-seg"><button data-axtk="time" class="'+(t.kind!=='sun'?'on':'')+'">Uhrzeit</button><button data-axtk="sun" class="'+(t.kind==='sun'?'on':'')+'">Sonne</button></div>');
        if(t.kind==='sun'){
          h+=fld('Sonnen-Ereignis','<div class="ax-r"><select class="ax-sel" id="axEv"><option value="sunset"'+(t.event!=='sunrise'?' selected':'')+'>Sonnenuntergang</option><option value="sunrise"'+(t.event==='sunrise'?' selected':'')+'>Sonnenaufgang</option></select>'
            +'<span class="ax-mono ax-mut">Versatz</span>'+stepper('axOff',(t.offsetMin||0),'min')+'</div>');
        } else {
          h+=fld('Uhrzeit','<input class="ax-time" type="time" id="axTime" value="'+esc(t.time||'20:00')+'">');
        }
        h+=fld('Wochentage','<div class="ax-days">'+daychips(t.days,'data-axday')+'</div><div class="ax-hint">nichts gewählt = täglich</div>');
        // Aktion und Gegenrichtung in EINER Zeile: der Bereich ist auf manchen Seiten
        // nur gut 350 px hoch, zwei zusaetzliche Zeilen schoben den Endzeitpunkt unter
        // die Kante - vorhanden, aber unerreichbar.
        h+=fld('Aktion','<div class="ax-r">'+sceneSel(r.sceneId,'id="axScene"')
          +'<div class="ax-seg">'
          +'<button data-axdir="on" class="'+(r.sceneAction!=='off'?'on':'')+'">ein</button>'
          +'<button data-axdir="off" class="'+(r.sceneAction==='off'?'on':'')+'">aus</button></div></div>');
        // Endzeitpunkt: schaltet dieselbe Szene wieder in die Gegenrichtung.
        var et = r.endTrigger;
        h+=fld('Endzeitpunkt','<div class="ax-r">'
          +'<div class="ax-seg"><button data-axend="off" class="'+(!et?'on':'')+'">keiner</button>'
          +'<button data-axend="time" class="'+(et&&et.kind!=='sun'?'on':'')+'">Uhrzeit</button>'
          +'<button data-axend="sun" class="'+(et&&et.kind==='sun'?'on':'')+'">Sonne</button></div>'
          +(et
            ? (et.kind==='sun'
                ? '<select class="ax-sel" id="axEndEv">'
                  +'<option value="sunset"'+(et.event!=='sunrise'?' selected':'')+'>Sonnenuntergang</option>'
                  +'<option value="sunrise"'+(et.event==='sunrise'?' selected':'')+'>Sonnenaufgang</option></select>'
                  +stepper('axEndOff',(et.offsetMin||0),'min')
                : '<input class="ax-time" type="time" id="axEndTime" value="'+esc(et.time||'23:00')+'">')
            : '<span class="ax-mut" style="font-size:11px">schaltet dann '+(r.sceneAction==='off'?'ein':'aus')+'</span>')
          +'</div>');
      }
      else if(r.type==='circadian'){
        h+=fld('Lampen',devChips(r.devices,'data-axdev'));
        h+=fld('Farbtemperatur','<div class="ax-r">'+stepper('axMinK',r.minK,'K')+'<span class="ax-mut">bis</span>'+stepper('axMaxK',r.maxK,'K')+'</div><div class="ax-ramp"></div>');
        h+=fld('Helligkeit auch nachführen',tog(r.level!==false,' id="axLvl"'));
        h+=fld('Helligkeitsbereich','<div class="ax-r">'+stepper('axMinLvl',(r.minLevel!=null?r.minLevel:0),'%')+'<span class="ax-mut">bis</span>'+stepper('axMaxLvl',(r.maxLevel!=null?r.maxLevel:100),'%')+'</div>');
      }
      else if(r.type==='wake'){
        // Wecken ist REIN AUDIO - kein Licht. Wer Licht dazu will, legt eine
        // eigene Zeitplan-Regel auf dieselbe Uhrzeit; so bleibt jede Regel bei
        // einem Zweck. Quelle als {kind,id}: Radio, Playlist oder Favorit.
        var q=wakeQuelle(r);
        h+=fld('Weckzeit','<div class="ax-r"><input class="ax-time" type="time" id="axTime" value="'+esc(r.time||'06:30')+'">'+stepper('axRamp',(r.rampMin||0),'min Rampe')+'</div>');
        h+=fld('Wochentage','<div class="ax-days">'+daychips(r.days,'data-axday')+'</div>');
        h+=fld('Musik-Zone','<select class="ax-sel" id="axZone"><option value="0">— keine —</option>'+A.zones.map(function(z){return '<option value="'+z.id+'"'+(z.id==r.audioZone?' selected':'')+'>'+escL(z.name)+'</option>';}).join('')+'</select>');
        // Radio kommt als Auswahlliste (die Sender sind bekannt). Playlist und
        // Favorit bleiben ein Zahlenfeld: dafuer liefert derzeit KEINE Schnittstelle
        // Namen - weder die Variablenprofile der Zone noch die Anbieter-Playlists.
        var srcFeld;
        if(q.kind==='station'){
          var st=A.stations||[];
          srcFeld=st.length
            ? '<select class="ax-sel" id="axSrc"><option value="">— Sender wählen —</option>'
              +st.map(function(x){return '<option value="'+esc(x.key)+'"'+(x.key===q.id?' selected':'')+'>'+escL(x.title||x.key)+'</option>';}).join('')
              +'</select>'
            : '<span class="ax-mut">Senderliste lädt …</span>';
        } else {
          // Favorit/Playlist kommen vom Player selbst. Ohne Zone gibt es nichts zu
          // waehlen, und eine leere Liste ist eine Aussage - kein Grund fuer ein
          // Zahlenfeld, in das man raten muesste.
          var qu=A.sources[parseInt(r.audioZone)||0];
          var ls=qu?(q.kind==='playlist'?qu.playlists:qu.favorites):null;
          if(!r.audioZone){
            srcFeld='<span class="ax-mut">erst eine Musik-Zone wählen</span>';
          } else if(!ls){
            srcFeld='<span class="ax-mut">Liste lädt …</span>';
          } else if(!ls.length){
            srcFeld='<span class="ax-mut">'+(q.kind==='playlist'?'keine Playlists am Player':'keine Favoriten am Player')+'</span>';
          } else {
            srcFeld='<select class="ax-sel" id="axSrc"><option value="">— wählen —</option>'
              +ls.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===q.id?' selected':'')+'>'+escL(x.title||x.id)+'</option>';}).join('')
              +'</select>';
          }
        }
        h+=fld('Quelle','<div class="ax-r"><select class="ax-sel" id="axKind">'
          +[['station','Radio'],['playlist','Playlist'],['favorite','Favorit']].map(function(o){
              return '<option value="'+o[0]+'"'+(q.kind===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')
          +'</select> '+srcFeld+'</div>');
        // Lautstaerke und Auto-Aus teilen sich eine Zeile: im Musik-Rahmen sind nur
        // 767 px hoch, und der Wochenbalken darunter braucht seine sieben Bahnen.
        // 'axOff2', nicht 'axOff' - der Name gehoert schon dem Sonnen-Versatz der
        // Zeitplan-Regeln, und beide Regelarten teilen sich dieselbe Stepper-Tabelle.
        h+=fld('Lautstärke / Aus','<div class="ax-r">'+stepper('axVol',(r.volume!=null?r.volume:25),'%')
          +'<span class="ax-mut">danach aus nach</span>'
          +stepper('axOff2',(r.offAfterMin||0),(r.offAfterMin?'min':'min (0 = nie)'))+'</div>');
      }
      else if(r.type==='motion'){
        h+=fld('Bewegungsmelder',sensorSel(r.sensor||0,A.motionSensors,'id="axSensor"'));
        h+=fld('Helligkeit (Lux-Variable, optional)','<div class="ax-r"><input class="ax-in ax-mono" id="axLux" type="number" value="'+(r.lux||'')+'" placeholder="Lux-Var" style="width:clamp(80px,24cqi,130px)"> '+stepper('axLuxMax',(r.luxMax||0),'lux max')+'</div>');
        h+=fld('Lampen',devChips(r.devices,'data-axdev'));
        h+=fld('Nachlaufzeit',stepper('axHold',Math.round((r.holdSec||0)/60),'min'));
        h+=fld('Helligkeit',stepper('axLevel',lvlTxt(r.level),''));
      }
      else if(r.type==='presence'){
        h+=fld('Abwesend-Sensor',sensorSel(r.awayVar||0,A.awaySensors,'id="axAway"'));
        h+=fld('Zeitfenster','<div class="ax-r"><input class="ax-time" type="time" id="axFrom" value="'+esc(r.from||'18:00')+'"><span class="ax-mut">bis</span><input class="ax-time" type="time" id="axTo" value="'+esc(r.to||'23:30')+'"></div>');
        h+=fld('Lampen (Auswahl)',devChips(r.devices,'data-axdev'));
        h+=fld('Takt',stepper('axEvery',(r.every||20),'min'));
      }
      h+='</div><div class="ax-foot"><button class="ax-btn prim" id="axSave">Speichern</button><button class="ax-btn" id="axTest">Jetzt testen</button><button class="ax-btn danger" id="axDel">Löschen</button></div></div>';
      return h;
    }
    function fld(l,b){return '<div class="ax-fld"><label>'+esc(l)+'</label>'+b+'</div>';}
    // Weck-Quelle lesen: neues Format {kind,id}; eine blosse Zeichenkette ist ein
    // Radiosender aus der Zeit, als der Wecker nur Radio konnte.
    function wakeQuelle(r){
      var q=r&&r.audioSource;
      if(q&&typeof q==='object')return {kind:(q.kind||'station'),id:String(q.id||'')};
      return {kind:'station',id:String(q||'')};
    }
    function stepper(id,val,unit){return '<span class="ax-stp"><button data-axdec="'+id+'">−</button><span class="ax-val" id="'+id+'">'+val+' '+esc(unit||'')+'</span><button data-axinc="'+id+'">+</button></span>';}
    function lvlTxt(v){return (v==null||v<0)?'voll':(v+' %');}   // -1 = volle Helligkeit
    function devChips(sel,attr){sel=sel||[];return '<div class="ax-chips">'+A.lights.map(function(l){var on=sel.indexOf(l.id)>=0;return '<button class="ax-chip'+(on?' on':'')+'" '+attr+'="'+l.id+'">'+escL(l.name)+'</button>';}).join('')+'</div>';}

    function editWire(h,w){
      var r=A.cfg.rules[A.sel]; if(!r)return;
      var nm=h.querySelector('#axName'); if(nm)nm.onchange=function(){r.name=this.value;aTouch();};
      var en=h.querySelector('#axEnEd'); if(en)en.onclick=function(){r.enabled=!(r.enabled!==false);aSave();};
      h.querySelectorAll('[data-axtk]').forEach(function(e){e.onclick=function(){r.trigger=r.trigger||{};r.trigger.kind=e.getAttribute('data-axtk');paintOnly(w);};});
      var ev=h.querySelector('#axEv'); if(ev)ev.onchange=function(){r.trigger.event=this.value;};
      // Richtung der Aktion: dieselbe Szene anwenden oder ausschalten
      h.querySelectorAll('[data-axdir]').forEach(function(e){e.onclick=function(){
        r.sceneAction=e.getAttribute('data-axdir'); paintOnly(w);
      };});
      // Endzeitpunkt an/aus und seine Art. 'off' entfernt ihn ganz.
      h.querySelectorAll('[data-axend]').forEach(function(e){e.onclick=function(){
        var art=e.getAttribute('data-axend');
        if(art==='off'){ delete r.endTrigger; }
        else {
          var alt=r.endTrigger||{};
          r.endTrigger = (art==='sun')
            ? {kind:'sun', event:alt.event||'sunrise', offsetMin:alt.offsetMin||0}
            : {kind:'time', time:alt.time||'23:00'};
        }
        paintOnly(w);
      };});
      var ee=h.querySelector('#axEndEv');   if(ee)ee.onchange=function(){r.endTrigger.event=this.value;};
      var et2=h.querySelector('#axEndTime');if(et2)et2.onchange=function(){r.endTrigger.time=this.value;};
      var tm=h.querySelector('#axTime');
      function zeitUebernehmen(){ if(!tm||!tm.value)return;
        if(r.type==='schedule'){r.trigger=r.trigger||{};r.trigger.time=tm.value;}else{r.time=tm.value;} }
      if(tm){tm.oninput=function(){zeitUebernehmen();aTouch();}; tm.onchange=function(){zeitUebernehmen();aTouch();};}
      var sc=h.querySelector('#axScene'); if(sc)sc.onchange=function(){r.sceneId=this.value;};
      var zn=h.querySelector('#axZone'); if(zn)zn.onchange=function(){
        r.audioZone=parseInt(this.value)||0;aTouch();
        // Andere Zone, andere Favoriten/Playlists - die alte Kennung passt nicht mehr.
        var qa=wakeQuelle(r);
        if(qa.kind!=='station')r.audioSource={kind:qa.kind,id:''};
        aSources(r.audioZone,function(){paintOnly(w);});
      };
      var kd=h.querySelector('#axKind');
      var sr=h.querySelector('#axSrc');
      function quelleSetzen(){var q=wakeQuelle(r);
        r.audioSource={kind:(kd?kd.value:q.kind), id:(sr?sr.value:q.id)};aTouch();}
      if(kd)kd.onchange=function(){
        // Art gewechselt: die id passt nicht mehr (Schluessel vs. Index) - leeren
        // und das Feld neu zeichnen, damit die richtige Eingabeart erscheint.
        r.audioSource={kind:kd.value,id:''};aTouch();
        if(kd.value!=='station'&&r.audioZone){aSources(r.audioZone,function(){paintOnly(w);});return;}
        paintOnly(w);
      };
      if(sr)sr.onchange=quelleSetzen;
      var lvl=h.querySelector('#axLvl'); if(lvl)lvl.onclick=function(){r.level=!(r.level!==false);paintOnly(w);};
      ['axSensor:sensor','axLux:lux','axAway:awayVar'].forEach(function(p){var a=p.split(':');var e=h.querySelector('#'+a[0]);if(e)e.onchange=function(){r[a[1]]=parseInt(this.value)||0;};});
      var fr=h.querySelector('#axFrom'); if(fr)fr.onchange=function(){r.from=this.value;};
      var to=h.querySelector('#axTo'); if(to)to.onchange=function(){r.to=this.value;};
      h.querySelectorAll('[data-axday]').forEach(function(e){e.onclick=function(){var d=(r.type==='schedule')?(r.trigger.days=r.trigger.days||[]):(r.days=r.days||[]);var i=+e.getAttribute('data-axday');var p=d.indexOf(i);if(p>=0)d.splice(p,1);else d.push(i);aTouch();paintOnly(w);};});
      h.querySelectorAll('[data-axdev]').forEach(function(e){e.onclick=function(){r.devices=r.devices||[];var i=+e.getAttribute('data-axdev');var p=r.devices.indexOf(i);if(p>=0)r.devices.splice(p,1);else r.devices.push(i);paintOnly(w);};});
      // Stepper
      var steps={axOff:['trigger.offsetMin',5,'min'],axEndOff:['endTrigger.offsetMin',5,'min'],axMinK:['minK',100,'K'],axMaxK:['maxK',100,'K'],axMinLvl:['minLevel',5,'%'],axMaxLvl:['maxLevel',5,'%'],axRamp:['rampMin',5,'min Rampe'],axVol:['volume',5,'%'],axOff2:['offAfterMin',5,'min'],axLuxMax:['luxMax',10,'lux max'],axHold:['holdSecMin',1,'min'],axLevel:['level',5,'%'],axEvery:['every',5,'min']};
      function stepGet(key){if(key==='holdSecMin')return Math.round((r.holdSec||0)/60);if(key==='minLevel')return (r.minLevel!=null?r.minLevel:0);if(key==='maxLevel')return (r.maxLevel!=null?r.maxLevel:100);if(key.indexOf('.')>0){var pp=key.split('.');return (r[pp[0]]||{})[pp[1]]||0;}return r[key]||0;}
      function stepSet(key,v){if(key==='holdSecMin'){r.holdSec=Math.max(5,v)*60;return;}if(key==='minLevel'||key==='maxLevel'){r[key]=Math.max(0,Math.min(100,v));return;}if(key.indexOf('.')>0){var pp=key.split('.');r[pp[0]]=r[pp[0]]||{};r[pp[0]][pp[1]]=v;return;}r[key]=v;}
      function stepTxt(id,s){if(id==='axHold')return Math.round((r.holdSec||0)/60)+' '+s[2];if(id==='axLevel')return lvlTxt(r.level);return stepGet(s[0])+' '+s[2];}
      h.querySelectorAll('[data-axinc]').forEach(function(e){e.onclick=function(){var id=e.getAttribute('data-axinc');var s=steps[id];if(id==='axLevel'){var cur=(r.level==null?-1:r.level);r.level=(cur<0)?-1:(cur>=100?-1:Math.min(100,cur+5));}else{stepSet(s[0],stepGet(s[0])+s[1]);}aTouch();var el=h.querySelector('#'+id);if(el)el.textContent=stepTxt(id,s);};});
      h.querySelectorAll('[data-axdec]').forEach(function(e){e.onclick=function(){var id=e.getAttribute('data-axdec');var s=steps[id];if(id==='axLevel'){var cur=(r.level==null?-1:r.level);r.level=(cur<0)?100:Math.max(0,cur-5);}else{stepSet(s[0],stepGet(s[0])-s[1]);}aTouch();var el=h.querySelector('#'+id);if(el)el.textContent=stepTxt(id,s);};});
      var sv=h.querySelector('#axSave'); if(sv)sv.onclick=function(){
        // Alle freien Eingabefelder unmittelbar vor dem Speichern noch einmal
        // ablesen - ein Tippen auf "Speichern" nimmt dem Feld den Fokus, und auf
        // change allein ist dabei kein Verlass.
        if(nm)r.name=nm.value;
        zeitUebernehmen();
        if(kd||sr)quelleSetzen();   // nur wenn die Weck-Felder ueberhaupt da sind
        aSave(function(){});};
      var dl=h.querySelector('#axDel'); if(dl)dl.onclick=function(){if(window.confirm('Regel löschen?')){A.cfg.rules.splice(A.sel,1);A.sel=-1;aSave();}};
      var ts=h.querySelector('#axTest'); if(ts)ts.onclick=function(){aSave(function(){fetch('?api=light&op=autotick&key='+encodeURIComponent(TOKEN),{method:'POST',cache:'no-store'});});};
    }
    function paintOnly(w){var hh=host(w);if(hh){hh.innerHTML=editRender();editWire(hh,w);}}
    // Der Editor braucht die Senderliste nur fuer Weckregeln - dann aber, bevor er
    // zeichnet, sonst steht dort "laedt ..." bis zum naechsten Anlass.
    function editVorbereiten(w,fertig){
      var r=A.cfg&&A.cfg.rules[A.sel];
      if(!r||r.type!=='wake'){fertig();return;}
      aStations(function(){
        var q=wakeQuelle(r);
        if(q.kind!=='station'&&r.audioZone){aSources(r.audioZone,fertig);return;}
        fertig();
      });
    }

    // =============================== autocard ===============================
    function cardRender(w){
      var kind=w.kind||'schedule'; var meta=TYPES[kind]||TYPES.schedule;
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      var items=rulesOf(kind);
      var anyOn=items.some(function(o){return o.r.enabled!==false;});
      var rows=items.map(function(o){
        return '<div class="ax-citem" data-axopen="'+o.i+'"><span class="ax-cwhen">'+esc(aSummary(o.r))+'</span>'
          +'<span class="ax-cnm">'+escL(o.r.name||'')+'</span>'+tog(o.r.enabled!==false,' data-axen="'+o.i+'"')+'</div>';
      }).join('');
      var ramp=(kind==='circadian')?'<div class="ax-ramp"></div>':'';
      return '<div class="ax ax-card"><div class="ax-card-h '+(kind==='schedule'||kind==='wake'?'sun':'')+'"><span class="ax-ic">'+aIcon(kind)+'</span>'
        +'<span class="ax-card-t">'+esc(meta.plural)+'</span><span class="ax-card-c">'+items.length+'</span>'
        +tog(anyOn,' data-axgroup="'+kind+'"')+'</div><div class="ax-card-b">'+ramp
        +(rows||'<div class="ax-msg" style="padding:clamp(4px,2cqmin,8px) clamp(2px,1cqmin,4px)">keine</div>')
        +'<div class="ax-cadd" data-axadd="'+kind+'">＋ '+esc(meta.label)+' hinzufügen</div></div></div>';
    }
    function cardWire(h,w){
      h.querySelectorAll('[data-axen]').forEach(function(e){e.onclick=function(ev){ev.stopPropagation();var i=+e.getAttribute('data-axen');A.cfg.rules[i].enabled=!(A.cfg.rules[i].enabled!==false);aSave();};});
      h.querySelectorAll('[data-axopen]').forEach(function(e){e.onclick=function(ev){if(ev.target.closest('.ax-tog'))return;A.sel=+e.getAttribute('data-axopen');aEmit();};});
      var g=h.querySelector('[data-axgroup]');if(g)g.onclick=function(){var kind=g.getAttribute('data-axgroup');var items=rulesOf(kind);var anyOn=items.some(function(o){return o.r.enabled!==false;});items.forEach(function(o){o.r.enabled=!anyOn;});aSave();};
      var a=h.querySelector('[data-axadd]');if(a)a.onclick=function(){aAdd(a.getAttribute('data-axadd'));};
    }

    // ============================= autotimeline =============================
    // Wochentage einer Regel. Sie stehen je nach Regelart woanders: bei einem
    // Zeitplan im Ausloeser, bei Wecker/Bewegung/Anwesenheit an der Regel selbst.
    // Leere Liste heisst TAEGLICH - deshalb null statt [] als "gilt immer".
    function tlTage(r){
      var d = (r.type==='schedule') ? ((r.trigger||{}).days||[]) : (r.days||[]);
      return (d && d.length) ? d : null;
    }
    function tlLaeuft(r,wd){ var d=tlTage(r); return !d || d.indexOf(wd)>=0; }

    function tlRender(w){
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      // Beschraenkung wie bei autolist: auf einer Weckerseite haben Bewegungs- und
      // Beleuchtungsregeln nichts zu suchen.
      var fT=axArt(w), nurT=fT.nur;
      // Tag/Nacht-Hintergrund: bei der Lichtautomatik die Bezugsgroesse (halbe
      // Regeln haengen an Sonnenauf-/-untergang), bei Weckern nur Beiwerk, das
      // die Flaeche fuellt und von der Sache ablenkt. Vorgabe bleibt "zeigen".
      var sonne=!(w&&w.tlSun===false);
      var nurZone=(w&&w.axZone)?aktiveZone(w.axSession):0;
      var sun=A.cfg.sun||{sunrise:360,sunset:1200};
      var woche = !!(w && w.tlSpan==='woche');
      function pc(min){return Math.max(0,Math.min(100,min/1440*100));}
      var srp=pc(sun.sunrise), ssp=pc(sun.sunset);
      // Zeitpunkt einer Regel auf der 24-h-Achse. Gibt min<0 zurueck, wenn die
      // Regel keinen festen Zeitpunkt hat (Bewegung, Anwesenheit) - die zeichnen
      // als Spannen.
      function tlPos(r){
        var min=-1,sunc=false,tm='';
        if(r.type==='schedule'){
          var t=r.trigger||{};
          if(t.kind==='sun'){min=(t.event==='sunrise'?sun.sunrise:sun.sunset)+(t.offsetMin||0);sunc=true;
            tm=(t.event==='sunrise'?'SA':'SU')+(t.offsetMin?(t.offsetMin>0?'+':'')+t.offsetMin:'');}
          else{var p=(t.time||'0:0').split(':');min=(+p[0])*60+(+p[1]);tm=t.time;}
        } else if(r.type==='wake'){var q=(r.time||'6:30').split(':');min=(+q[0])*60+(+q[1]);tm=r.time;}
        return {min:min,sun:sunc,tm:tm};
      }

      // Eine Tagesbahn fuer den Wochentag wd (0=So .. 6=Sa), JS-Zaehlung.
      // anhang wird VOR dem Schliessen der Bahn eingesetzt (Stundenachse im Tagesbild).
      function bahn(wd,anhang){
        // Der Tagesverlauf zeigt BEIDE Wege: die Regeln aus dem Editor UND die aus
        // den Baendern abgeleiteten. Letztere stehen absichtlich nicht im Editor,
        // muessen aber sichtbar sein - sonst versteckt der eine Weg den anderen.
        var pkt=[];
        var spannen=[];                                    // Regeln mit Endzeitpunkt: von-bis
        (A.cfg.rules||[]).forEach(function(r,i){
          if(!axPasst(r,fT))return;                        // Beschraenkung/Ausblendung je Regelart
          if(nurZone&&(parseInt(r.audioZone,10)||0)!==nurZone)return;
          if(!tlLaeuft(r,wd))return;                       // Regel schaltet an dem Tag gar nicht
          var p=tlPos(r); if(p.min<0)return;
          pkt.push({r:r,min:p.min,sun:p.sun,tm:p.tm,idx:i,band:false,
                    lbl:r.name||TYPES[r.type].label,an:r.enabled!==false});
          // Endzeitpunkt: derselbe Name, aber die Gegenrichtung - und dazwischen ein Balken,
          // damit man die Dauer sieht statt zweier zusammenhangloser Punkte.
          // Wecker mit "automatisch aus": die Spieldauer als Strecke, sonst steht da
          // nur ein Punkt und die eigentliche Frage - wie lange laeuft das? - bleibt offen.
          if(r.type==='wake'&&(+r.offAfterMin>0)){
            var bis=(p.min+(+r.offAfterMin))%1440;
            spannen.push({von:p.min,bis:bis,idx:i,an:r.enabled!==false,
                          // 52 % ist die Zeile, in der die Uhrzeit der Marke steht -
                          // dort wuerde der Riegel quer durch die Beschriftung laufen.
                          oben:'72%',
                          lbl:(r.name||'Wecker')+' · '+(+r.offAfterMin)+' min'});
          }
          if(r.type==='schedule'&&r.endTrigger){
            var pe=tlPos({type:'schedule',trigger:r.endTrigger});
            if(pe.min>=0){
              pkt.push({r:r,min:pe.min,sun:pe.sun,tm:pe.tm,idx:i,band:false,
                        lbl:(r.name||'')+' Ende',an:r.enabled!==false});
              spannen.push({von:p.min,bis:pe.min,idx:i,an:r.enabled!==false,lbl:r.name||''});
            }
          }
        });
        (A.cfg.bandRules||[]).forEach(function(r){
          if(!tlLaeuft(r,wd))return;
          var p=tlPos(r); if(p.min<0)return;
          pkt.push({r:r,min:p.min,sun:p.sun,tm:p.tm,idx:-1,band:true,
                    lbl:r.name||'Band',an:r.enabled!==false});
        });
        // Marker stapeln, statt sie uebereinanderzulegen. Massgeblich ist nicht die
        // Uhrzeit, sondern der PLATZ: mit Etikett belegt ein Marker rund zwei Stunden
        // der Achse, in der Wochenansicht (nur Punkte) knapp eine halbe.
        var BREIT = woche ? 40 : 105;
        var NAH   = 6;                       // darunter gilt es als GLEICHZEITIG
        pkt.sort(function(a,b){return a.min-b.min;});
        var letzte=[];
        pkt.forEach(function(p){
          var r=0; while(letzte[r]!==undefined && (p.min-letzte[r])<BREIT) r++;
          letzte[r]=p.min; p.row=woche?Math.min(r,1):r;    // schmale Bahn traegt hoechstens zwei Reihen
        });
        // Echte Gleichzeitigkeit getrennt bestimmen - die faellt sonst im Gestapel
        // unter den Tisch, ist aber das eigentlich Wichtige.
        pkt.forEach(function(p){
          p.stoss = p.an && pkt.some(function(q){
            return q!==p && q.an && Math.abs(q.min-p.min)<=NAH;
          });
        });
        var marks=pkt.map(function(p){
          var cls='ax-mk'+(p.sun?' sun':'')+(p.an?'':' off')+(p.band?' band':'')+(p.stoss?' clash':'');
          var titel=p.lbl+' · '+p.tm+(p.band?' · aus den Bändern, dort bearbeiten':'')
                   +(p.stoss?' · trifft mit einer anderen Regel zusammen':'');
          return '<div class="'+cls+'" style="left:'+pc(p.min)+'%;--mkrow:'+p.row+'"'
            +(p.band?'':' data-axopen="'+p.idx+'"')+' title="'+esc(titel)+'">'
            +'<span class="ax-mk-d">'+aIcon(p.r.type)+'</span>'
            +'<span class="ax-mk-l">'+escL(p.lbl)+'</span>'
            +'<span class="ax-mk-t">'+esc(p.tm)+'</span></div>';
        }).join('');
        // spannen: erst die Von-bis-Regeln, dann motion/presence - auch deaktivierte, gedimmt
        var spans='';
        spannen.forEach(function(sp){
          var off=sp.an?'':' off';
          // Ueber Mitternacht hinaus wird in zwei Stuecke zerlegt, sonst liefe der Balken rueckwaerts.
          var teile = (sp.bis>=sp.von) ? [[sp.von,sp.bis]] : [[sp.von,1440],[0,sp.bis]];
          teile.forEach(function(t){
            var a=pc(t[0]), b=pc(t[1]);
            spans+='<div class="ax-span dauer'+off+'" style="left:'+a+'%;width:'+Math.max(1,b-a)+'%;top:'+(sp.oben||'52%')+'"'
              +' data-axopen="'+sp.idx+'" title="'+esc(sp.lbl)+'">'+(woche?'':escL(sp.lbl))+'</div>';
          });
        });
        (A.cfg.rules||[]).forEach(function(r,i){
          if(!axPasst(r,fT))return;                        // Beschraenkung/Ausblendung je Regelart
          if(nurZone&&(parseInt(r.audioZone,10)||0)!==nurZone)return;
          if(!tlLaeuft(r,wd))return;
          var off=(r.enabled===false)?' off':'';
          // Spannen relativ zur Timeline-Hoehe, damit sie jeder Hoehenaenderung folgen.
          if(r.type==='motion')spans+='<div class="ax-span motion'+off+'" style="left:1%;width:98%;top:65%" data-axopen="'+i+'">'+(woche?'':'Bewegung: ')+escL(r.name||'')+'</div>';
          if(r.type==='presence'){var f=(r.from||'18:00').split(':'),t2=(r.to||'23:30').split(':');
            var a=pc((+f[0])*60+(+f[1])),b=pc((+t2[0])*60+(+t2[1]));
            spans+='<div class="ax-span pres'+off+'" style="left:'+a+'%;width:'+Math.max(4,b-a)+'%;top:78%" data-axopen="'+i+'">'+(woche?'':'Anwesenheit')+'</div>';}
        });
        return '<div class="ax-tl">'
          +(sonne?('<div class="ax-tl-band night"></div><div class="ax-tl-band day" style="left:'+srp+'%;width:'+(ssp-srp)+'%"></div>'):'')
          +'<div class="ax-tl-tick" style="left:'+srp+'%"></div><div class="ax-tl-tick" style="left:'+ssp+'%"></div>'
          +((woche||!sonne)?'':'<div class="ax-sun" style="left:'+srp+'%">☀</div><div class="ax-sun" style="left:'+ssp+'%">☾</div>')
          +marks+spans+(anhang||'')+'</div>';
      }

      var hours='';[0,6,12,18,24].forEach(function(hh){hours+='<span class="ax-tl-h" style="left:'+(hh/24*100)+'%">'+hh+'</span>';});

      if(woche){
        // Montag zuerst - So ist in JS die 0, steht im Wochenbild aber hinten.
        var KUERZEL=['So','Mo','Di','Mi','Do','Fr','Sa'];
        var heute=new Date().getDay(), zeilen='';
        [1,2,3,4,5,6,0].forEach(function(wd){
          zeilen+='<div class="ax-tlw-row'+(wd===heute?' heute':'')+'">'
            +'<span class="ax-tlw-d">'+KUERZEL[wd]+'</span>'+bahn(wd)+'</div>';
        });
        // Sonnenzeiten gelten fuer HEUTE und werden fuer alle sieben Bahnen benutzt;
        // innerhalb einer Woche wandern sie um weniger als zehn Minuten. Der
        // Baender-Editor haelt es genauso.
        return '<div class="ax ax-tlwrap wk"><div class="ax-tl-scroll"><div class="ax-tlweek">'
          +zeilen+'<div class="ax-tlw-row axis"><span class="ax-tlw-d"></span>'
          +'<div class="ax-tl"><div class="ax-tl-hours">'+hours+'</div></div></div>'
          +'</div></div></div>';
      }

      return '<div class="ax ax-tlwrap"><div class="ax-tl-scroll">'
        +bahn(new Date().getDay(),'<div class="ax-tl-hours">'+hours+'</div>')
        +'</div>'
        +((nurT||!(A.cfg.rules||[]).some(function(r){return r.type==='circadian';}))?''
          :'<div class="ax-circ"><div class="ax-circ-l">Circadian über den Tag</div><div class="ax-ramp" style="height:clamp(8px,3cqmin,14px)"></div></div>')
        +'</div>';
    }
    function tlWire(h,w){h.querySelectorAll('[data-axopen]').forEach(function(e){e.onclick=function(){A.sel=+e.getAttribute('data-axopen');aEmit();};});}

    // =============================== Registrierung ===============================
    function mk(name,kind,size,rnd,wire){
      defWidget(name,{
        label:({autolist:'Automatik-Liste',autoedit:'Automatik-Detail',autocard:'Automatik-Karte',autotimeline:'Automatik-Verlauf'})[name],
        cat:({autolist:'HomeSuite · Automatik',autoedit:'HomeSuite · Automatik',autocard:'HomeSuite · Automatik',autotimeline:'HomeSuite · Automatik'})[name],
        paletteIcon:'clock', size:size,
        defaults:function(w){if(name==='autocard')w.kind=w.kind||'schedule';},
        render:function(w){return rnd(w);},
        // Wird ein Widget von aussen neu gezeichnet (afEmit beim Raumwechsel),
        // muessen die Bedienelemente wieder verdrahtet werden - sonst waeren
        // Liste und Schalter danach tot.
        _bind:function(w,el){var hh=host(w);if(hh)wire(hh,w);},
        mount:function(w){var el=elOf(w);if(!el)return;
          function auswahlPruefen(){
            if(name!=='autolist'||!A.cfg)return false;
            var zo=w.axZone?aktiveZone(w.axSession):0;
            var f=axArt(w);
            if(!f.nur&&!f.ohne&&!zo)return false;
            function passt(r){
              if(!axPasst(r,f))return false;
              if(zo&&(parseInt(r.audioZone,10)||0)!==zo)return false;
              return true;
            }
            var rs=A.cfg.rules||[];
            // Gibt es im gewaehlten Raum ueberhaupt eine Regel? Wenn nicht, faellt
            // die Liste auf alle zurueck - die Vorauswahl muss das mitmachen.
            if(zo){
              var da=false;
              for(var q=0;q<rs.length;q++){ if(passt(rs[q])){da=true;break;} }
              if(!da)zo=0;
            }
            if(passt(rs[A.sel]))return false;
            // "true" loest aEmit() aus, das JEDES Widget neu zeichnet - und damit
            // wieder hier landet. Deshalb nur melden, wenn sich A.sel wirklich
            // geaendert hat. Sonst dreht sich das bei einem Raum ohne passende
            // Regel endlos im Kreis (A.sel bleibt -1, gilt aber als Aenderung)
            // und die Seite friert beim ersten Klick ein.
            var vorher=A.sel, neu=-1;
            for(var i=0;i<rs.length;i++){ if(passt(rs[i])){neu=i;break;} }
            A.sel=neu;
            return neu!==vorher;
          }
          function paint(){var geaendert=auswahlPruefen();
            function zeichnen(){var hh=host(w);if(hh){hh.innerHTML=rnd(w);wire(hh,w);}if(geaendert)aEmit();}
            if(name==='autoedit'&&A.cfg){editVorbereiten(w,zeichnen);}else{zeichnen();}}
          aSub(paint,w);               // fuer Aenderungen an anderen Widgets (Auswahl/Speichern)
          // Am Raumschalter der Musikseite anmelden: wechselt dort das Geraet,
          // zeichnet afEmit uns mit - deshalb weiter unten auch ein _bind.
          if(w.axZone&&typeof afSub==='function'){ try{ afSub({id:w.id,session:w.axSession||'audio'}); }catch(e){} }
          if(A.cfg){paint();}else{aLoad(paint);}   // jedes Widget zeichnet sich selbst nach dem Laden
          LVB.panel.startPoll('autox:'+w.id,45000,function(){if(A.dirty)return;aLoad(paint);});
        },
        props:function(w){
          if(name==='autotimeline'){
            // Tag = eine Achse fuer heute; Woche = sieben Bahnen, Mo bis So.
            return '<div class="pgh">Umfang</div>'
              +row('Regelart','<select id="axOnly"><option value="">alle Regeln</option>'
                +Object.keys(TYPES).map(function(k){return '<option value="'+k+'"'+(w.axOnly===k?' selected':'')+'>nur '+esc(TYPES[k].plural)+'</option>';}).join('')
                +'</select>')
              +row('Ausblenden','<select id="axOhne"><option value="">nichts ausblenden</option>'
                +Object.keys(TYPES).map(function(k){return '<option value="'+k+'"'+(w.axOhne===k?' selected':'')+'>ohne '+esc(TYPES[k].plural)+'</option>';}).join('')
                +'</select>')
              +row('Raumschalter','<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px">'
                +'<input type="checkbox" id="axZoneF"'+(w.axZone?' checked':'')+'> nur das gewählte Musik-Gerät</label>')
              +row('Sonnenband','<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px">'
                +'<input type="checkbox" id="axTlSun"'+((w.tlSun===false)?'':' checked')+'> Tag/Nacht hinterlegen</label>')
              +'<div class="pgh">Zeitraum</div>'
              +row('Umfang','<select id="axSpan">'
                +'<option value="tag"'+(w.tlSpan!=='woche'?' selected':'')+'>Tag (heute)</option>'
                +'<option value="woche"'+(w.tlSpan==='woche'?' selected':'')+'>Ganze Woche (Mo–So)</option></select>')
              +'<div style="font-size:11px;color:var(--muted);padding:4px 2px">Zeigt Regeln UND die aus Bändern abgeleiteten Schaltpunkte — jeweils nur an den Wochentagen, an denen sie wirklich schalten.</div>';
          }
          if(name==='autolist'){
            return '<div class="pgh">Umfang</div>'
              +row('Regelart','<select id="axOnly"><option value="">alle Regeln</option>'
                +Object.keys(TYPES).map(function(k){return '<option value="'+k+'"'+(w.axOnly===k?' selected':'')+'>nur '+esc(TYPES[k].plural)+'</option>';}).join('')
                +'</select>')
              +row('Ausblenden','<select id="axOhne"><option value="">nichts ausblenden</option>'
                +Object.keys(TYPES).map(function(k){return '<option value="'+k+'"'+(w.axOhne===k?' selected':'')+'>ohne '+esc(TYPES[k].plural)+'</option>';}).join('')
                +'</select>')
              +row('Raumschalter','<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px">'
                +'<input type="checkbox" id="axZoneF"'+(w.axZone?' checked':'')+'> nur das gewählte Musik-Gerät</label>')
              +'<div style="font-size:11px;color:var(--muted);line-height:1.4;padding:4px 2px">Blendet die Liste auf eine Art ein - z. B. nur Wecker auf der Musikseite. Mit Raumschalter folgt sie zusätzlich der Geräteauswahl oben, wie „Jetzt läuft" und „Bibliothek".</div>';
          }
          if(name!=='autocard')return '<div style="font-size:11px;color:var(--muted);padding:4px 2px">Teil der Automatik-Familie. Auf einer Seite mit autolist+autoedit kombinieren.</div>';
          var h='<div class="pgh">Kategorie</div>';
          h+=row('Typ','<select id="axKind">'+Object.keys(TYPES).map(function(k){return '<option value="'+k+'"'+(w.kind===k?' selected':'')+'>'+esc(TYPES[k].plural)+'</option>';}).join('')+'</select>');
          return h;
        },
        wire:function(w){
          if($('#axKind'))$('#axKind').onchange=function(){w.kind=this.value;commit();var hh=host(w);if(hh){hh.innerHTML=rnd(w);}};
          if($('#axOnly'))$('#axOnly').onchange=function(){w.axOnly=this.value||undefined;commit();var hh=host(w);if(hh){hh.innerHTML=rnd(w);wire(hh,w);}};
          if($('#axOhne'))$('#axOhne').onchange=function(){w.axOhne=this.value||undefined;commit();var hh=host(w);if(hh){hh.innerHTML=rnd(w);wire(hh,w);}};
          if($('#axZoneF'))$('#axZoneF').onchange=function(){w.axZone=this.checked?true:undefined;commit();var hh=host(w);if(hh){hh.innerHTML=rnd(w);wire(hh,w);}};
          if($('#axSpan'))$('#axSpan').onchange=function(){w.tlSpan=this.value;commit();var hh=host(w);if(hh){hh.innerHTML=rnd(w);wire(hh,w);}};
          if($('#axTlSun'))$('#axTlSun').onchange=function(){w.tlSun=this.checked?undefined:false;commit();var hh=host(w);if(hh){hh.innerHTML=rnd(w);wire(hh,w);}};
        }
      });
    }
    mk('autolist',null,[300,520],function(w){return listRender(w);},listWire);
    mk('autoedit',null,[440,520],editRender,editWire);
    mk('autocard','schedule',[340,240],cardRender,cardWire);
    mk('autotimeline',null,[900,320],tlRender,tlWire);
  })();
