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

  function afLoad(w,cb){var s=afSess(w);
    if(typeof DOKU!=='undefined'&&DOKU){s.rooms=afDemo();s.loaded=true;s.err='';cb&&cb();return;}
    fetch('?api=audio&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok){s.err='Audio nicht lesbar';cb&&cb();return;}
      s.rooms=j.rooms||[];s.err='';if(s.roomIdx>=s.rooms.length)s.roomIdx=0;
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
    s.pollId=setInterval(function(){ if(s.dragging)return; afLoad(w,function(){afEmit(w);afLoadRadio(w);}); },8000);
  }
  // Radio "was laeuft": laufender Titel + Song-Cover fuer den aktuellen Raum (RadioNow, IPSSonos-frei).
  function afLoadRadio(w){var s=afSess(w);var c=afCur(s);if(!c){return;}
    if(typeof DOKU!=='undefined'&&DOKU){ s.radio={roomId:c.id,isRadio:true,isTalk:false,artist:'Ava Max',title:'Sweet but Psycho',cover:'',station:'Hitradio Ö3'}; afEmit(w); return; }
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
  // Die Groesse der Transport-/Regler-Icons gehoert den CSS-Regeln (.aftrans/.afwide/.afibtn svg,
  // alle bereits clamp+cqmin). Die Attribute hier sind nur der Rueckfall fuer Kontexte ohne eigene
  // Regel - darum relativ in em statt in festen Pixeln. sz bleibt als Bezugsgroesse erhalten
  // (18 = Normalmass), damit die Groessenverhaeltnisse der Icons untereinander gleich bleiben.
  function afSvg(p,sz){var em=((sz||18)/18).toFixed(2)+'em';
    return '<svg viewBox="0 0 24 24" width="'+em+'" height="'+em+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';}
  function afMsg(t){return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:clamp(10px,4cqmin,14px)">'+esc(t)+'</div>';}
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
  defWidget('audionow',{
    label:'Audio · Now-Playing', cat:'HomeSuite · Audio', paletteIcon:'image', size:[420,240],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      // Radio: laufender Titel + Song-Cover (RadioNow) statt Sender-Platzhalter.
      var rad=(s.radio&&s.radio.roomId===c.id&&s.radio.isRadio)?s.radio:null;
      var cover=(rad&&rad.cover)?rad.cover:c.coverUrl;
      var isLogo=!!(rad&&rad.coverIsLogo);
      var line1=rad?(rad.isTalk?(rad.station||c.name):rad.title):(c.title||'—');
      var line2=rad?(rad.isTalk?'Nachrichten / Wortprogramm':rad.artist):(c.artist||'');
      var line3=rad?(rad.isTalk?'':(rad.station||'')):(c.album||'');
      var tag=esc(c.name)+(rad?' · '+(rad.station||'Radio'):(c.playing?' · spielt':' · pausiert'));
      var fit=isLogo?'contain':'cover',pad=isLogo?'padding:16px;box-sizing:border-box;':'',bg=isLogo?'var(--surface-2)':'linear-gradient(135deg,var(--accent),var(--accent-2))';
      var cov=cover?('<img src="'+esc(cover)+'" style="width:100%;height:100%;object-fit:'+fit+';'+pad+'" onerror="this.style.display=\'none\'">'):'';
      // Seek nur bei echter Dauer (nicht bei Live-Radio ohne Position).
      var seekable=!rad && !!c.duration;
      var posPct=Math.max(0,Math.min(100,c.positionPct||0));
      var barSeek='<div class="afbar"'+(seekable?' data-afseek':'')+' style="margin:.5em 0 .2em;cursor:'+(seekable?'pointer':'default')+'"><i data-afseekfill style="width:'+posPct+'%;pointer-events:none"></i></div>';
      return '<div class="afw afnow">'
        +'<div class="cov" style="background:'+bg+'">'+cov+'</div>'
        +'<div class="txt">'
        +'<div class="tag">'+tag+'</div>'
        +'<div class="l1">'+esc(line1||'—')+'</div>'
        +'<div class="l2">'+esc(line2||'')+'</div>'
        +'<div class="l3">'+esc(line3||'')+'</div>'
        +barSeek
        +'<div class="tm"><span>'+esc(c.position||'0:00')+'</span><span>'+esc(c.duration||'')+'</span></div>'
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
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var c=afCur(r.s);if(!c)return afMsg('kein Raum');
      // Transport: Zurueck · Start/Pause · Stop · Vor. Der mittlere Knopf zeigt IMMER die
      // Aktion, die als naechstes moeglich ist - spielt gerade nichts, steht dort Start.
      function seg(ic,cmd,on,ttl){return '<button data-afcmd="'+cmd+'" title="'+ttl+'"'+(on?' class="on"':'')+'>'+ic+'</button>';}
      var playing=!!c.playing;
      var bar='<div class="aftrans">'
        +seg(afSvg(AF_IC.prev,18),'5',false,'Zurück')
        +seg(afSvg(playing?AF_IC.pause:AF_IC.play,20),playing?'2':'1',true,playing?'Pause':'Start')
        +seg(afSvg(AF_IC.stop,16),'3',false,'Stop')
        +seg(afSvg(AF_IC.next,18),'4',false,'Vor')+'</div>';
      function wide(ic,lbl,cmd,on){return '<button data-afcmd="'+cmd+'"'+(on?' class="on"':'')+'>'+ic+'<span>'+lbl+'</span></button>';}
      var rep=(c.repeat||0)%3;var repLbl=rep===1?'Titel':(rep===2?'Alle':'Repeat');
      var sr='<div class="afwide">'+wide(afSvg(AF_IC.shuffle,16),'Shuffle','shuffle',!!c.shuffle)
        +wide(afSvg(AF_IC.repeat,16),repLbl,'repeat',rep>0)+'</div>';
      function ibtn(ic,cmd,on){return '<button class="afibtn'+(on?' on':'')+'" data-afcmd="'+cmd+'">'+ic+'</button>';}
      var vol='<div class="afvolrow">'+ibtn(afSvg(c.mute?AF_IC.mute:AF_IC.vol,17),'mute',!!c.mute)
        +'<div class="afbar" data-afvol><i style="width:'+Math.max(0,Math.min(100,c.volume||0))+'%"></i></div>'
        +'<span class="afvolnum">'+(c.volume||0)+'</span>'+ibtn(afSvg(AF_IC.power,16),'power',!!c.power)+'</div>';
      function sbtn(m,lbl){return '<button data-afsleep="'+m+'">'+lbl+'</button>';}
      var arm='<button class="arm'+(c.armed?' on':'')+'" data-afarm="1" title="'+(c.armed?'Scharf – klick für Schatten-Modus':'Schatten-Modus – klick zum Scharfschalten')+'">'+(c.armed?'Scharf':'Schatten')+'</button>';
      var sleep='<div class="afsleep"><span class="lbl">Sleep</span>'+sbtn(15,'15m')+sbtn(30,'30m')+sbtn(60,'60m')+sbtn(0,'Aus')+arm+'</div>';
      return '<div class="afw">'+bar+sr+vol+sleep+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);
      $$('[data-afcmd]',el).forEach(function(b){b.onclick=function(){var cmd=b.getAttribute('data-afcmd');var c=afCur(s);if(!c)return;
        if(cmd==='mute')afSet(w,'Mute',!c.mute);
        else if(cmd==='power')afSet(w,'Power',!c.power);
        else if(cmd==='shuffle')afSet(w,'Shuffle',!c.shuffle);
        else if(cmd==='repeat')afSet(w,'Repeat',((c.repeat||0)+1)%3); // 0=aus,1=Titel,2=alle
        else afSet(w,'Transport',cmd); // 1=Start 2=Pause 3=Stop 4=Vor 5=Zurueck
      };});
      var vb=$('[data-afvol]',el);if(vb)vb.onclick=function(e){var box=vb.getBoundingClientRect();var pct=Math.round((e.clientX-box.left)/box.width*100);afSet(w,'Volume',Math.max(0,Math.min(100,pct)));};
      $$('[data-afsleep]',el).forEach(function(b){b.onclick=function(){var m=+b.getAttribute('data-afsleep');var c=afCur(s);if(!c)return;
        if(typeof DOKU!=='undefined'&&DOKU){toast(m?('Demo: Sleep '+m+' min'):'Demo: Sleep aus');return;}
        if(m>0)afManage(w,c.id,{op:'setSleep',args:{minutes:m}}); else afManage(w,c.id,{op:'cancelSleep'});
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
  defWidget('audioradio',{
    label:'Audio · Radio (Direktstream)', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[420,150],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      if(!s.stations){afLoadStations(w,function(){afEmit(w);});return afMsg('Sender lädt …');}
      var curKey=(s.radio&&s.radio.roomId===c.id)?(s.radio.key||''):'';
      var chips=s.stations.map(function(st){var on=(curKey&&curKey===st.key);
        return '<button class="afchip'+(on?' on':'')+'" data-afstation="'+esc(st.key)+'">'+esc(st.title)+'</button>';}).join('');
      return '<div class="afw afw-scroll">'
        +'<div class="aftag">Radio · Direktstream ('+esc(c.name)+')</div>'
        +'<div class="afchips">'+chips+'</div></div>';},
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
  function _alibBody(w,L){
    if(L.loading)return '<div class="alib-empty">lädt …</div>';
    var items=L.items||[];
    if(!items.length)return '<div class="alib-empty">Nichts gefunden</div>';
    var isABS=(L.provider==='audiobookshelf'),g=_alibGroups(items),html='';
    if(g.folders.length)html+='<div class="alib-folders">'+g.folders.map(function(e){return '<button class="alib-folder" data-afitem="'+e.idx+'"><span>'+esc(e.it.title)+'</span><span class="alib-chev">›</span></button>';}).join('')+'</div>';
    if(g.cards.length){
      if(isABS)html+=_alibBooks(g.cards,L);
      else html+='<div class="alib-grid">'+g.cards.map(_alibTile).join('')+'</div>';
    }
    if(g.plays.length)html+='<div class="alib-rows">'+g.plays.map(function(e){var it=e.it;return '<button class="alib-row" data-afitem="'+e.idx+'">'+_alibCov(it,'sm')+'<div class="alib-rmeta"><div class="alib-tt">'+esc(it.title)+'</div><div class="alib-ts">'+esc(it.artist||'Playlist')+'</div></div><span class="alib-pbtn">▶</span></button>';}).join('')+'</div>';
    if(g.tracks.length)html+='<div class="alib-tracks">'+g.tracks.map(function(e,i){var it=e.it;return '<button class="alib-trk" data-afitem="'+e.idx+'"><span class="alib-n">'+(i+1)+'</span><div class="alib-rmeta"><div class="alib-tt">'+esc(it.title)+'</div><div class="alib-ts">'+esc(it.artist||'')+'</div></div><span class="alib-dur">'+_alibDur(it.durationSec)+'</span></button>';}).join('')+'</div>';
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
      var rail='<aside class="alib-rail"><div class="alib-rh">Anbieter</div><div class="alib-provs">'+provs+'</div>'
        +'<div class="alib-rh">Pfad</div><div class="alib-pths">'+pths+'</div><div class="alib-spacer"></div>'
        +'<div class="alib-anchor"><span class="alib-dot"></span><span>Spielt auf</span><b>'+esc(c.name)+'</b></div></aside>';
      var title=L.stack.length?(L.stack[L.stack.length-1].title||''):('Bibliothek · '+plabel(L.provider));
      var isBooks=(L.provider==='audiobookshelf')&&(L.items||[]).some(function(it){return it.isContainer&&it.cover;});
      var sort=isBooks?('<div class="alib-sort"><button class="alib-sg'+(L.bookSort!=='title'?' on':'')+'" data-afsort="artist">Autor</button><button class="alib-sg'+(L.bookSort==='title'?' on':'')+'" data-afsort="title">Titel</button></div>'):'';
      var head='<div class="alib-head">'+(L.stack.length?'<button class="alib-back" data-afback="1">◀ zurück</button>':'<span></span>')+'<div class="alib-title">'+esc(title)+'</div>'+sort+'</div>';
      var top='<div class="alib-topbar">'+(L.stack.length?'<button class="alib-back" data-afback="1">◀</button>':'')+'<div class="alib-tprovs">'+provs+'</div></div>';
      return '<div class="alib">'+rail+'<section class="alib-main">'+top+head+'<div class="alib-scroll">'+_alibBody(w,L)+'</div></section></div>';},
    mount:afMount,
    _bind:function(w,el){var L=afLib(w);
      $$('[data-afprov]',el).forEach(function(b){b.onclick=function(){L.stack=[];afLibBrowse(w,b.getAttribute('data-afprov'),'','');};});
      $$('[data-afpath]',el).forEach(function(b){b.onclick=function(){var i=+b.getAttribute('data-afpath');
        if(i<0){L.stack=[];afLibBrowse(w,L.provider,'','');}else{var st=L.stack[i];L.stack=L.stack.slice(0,i+1);afLibBrowse(w,L.provider,st.id,st.title);}};});
      $$('[data-afsort]',el).forEach(function(b){b.onclick=function(){L.bookSort=b.getAttribute('data-afsort');afEmit(w);};});
      $$('[data-afback]',el).forEach(function(b){b.onclick=function(){L.stack.pop();var t=L.stack.length?L.stack[L.stack.length-1]:{id:'',title:''};afLibBrowse(w,L.provider,t.id||'',t.title||'');};});
      $$('[data-afitem]',el).forEach(function(d){d.onclick=function(){var it=(L.items||[])[+d.getAttribute('data-afitem')];if(!it)return;
        if(it.isContainer){L.stack.push({id:it.id,title:it.title});afLibBrowse(w,L.provider,it.id,it.title);}else afLibPlay(w,it);};});},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- multiroom: Gruppen-Manager (N-zu-1) ----------
  defWidget('multiroom',{
    label:'Audio · Multiroom', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[420,320],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,cur=afCur(s);if(!cur)return afMsg('kein Raum');
      var master=cur.coordinator||'';
      // Kopfzeile ebenfalls an der Kachel ausrichten; der Trennen-Knopf ist reiner Text und
      // braucht eine Mindesthoehe, damit er auf kleinen Kacheln noch ein Tippziel bleibt.
      var head='<div class="hd" style="gap:clamp(5px,3cqmin,12px)"><span class="aftag">Multiroom · Master: '+esc(cur.name)+'</span>'
        +'<button data-afungroup="1" style="min-height:clamp(22px,9cqmin,32px)">Gruppe trennen</button></div>';
      // Gruppen-Lautstaerke: ein Regler an den Koordinator (Anzeige naeherungsweise = Master-Volume).
      var gvol='<div class="afvolrow"><span class="lbl" style="width:clamp(30px,13cqmin,54px);font-size:clamp(8px,3.2cqmin,12px);color:var(--faint);flex:none">Gruppe</span>'
        +'<div class="afbar" data-afgvol><i data-afgvolfill style="width:'+Math.max(0,Math.min(100,cur.volume||0))+'%;pointer-events:none"></i></div>'
        +'<span class="afvolnum">'+(cur.volume||0)+'</span></div>';
      var rows=s.rooms.map(function(rr){ if(rr.id===cur.id)return '';
        var inGrp=(rr.role==='member'&&rr.coordinator===master&&master!=='');
        return '<div class="r">'
          +'<span class="sw" style="background:'+(rr.playing?'linear-gradient(135deg,var(--accent),var(--accent-2))':'var(--surface-2)')+'"></span>'
          +'<span class="nm" style="font-weight:600">'+esc(hsStripDomain(rr.name))+'</span>'
          +'<span style="font-size:clamp(8px,3cqmin,12px);color:var(--muted);flex:none">'+(inGrp?'synchron':(rr.role==='member'?'andere Gruppe':(rr.playing?'spielt eigenes':'frei')))+'</span>'
          +'<button data-afgrp="'+rr.id+'" data-afin="'+(inGrp?1:0)+'" style="width:clamp(32px,14cqmin,52px);height:clamp(19px,8cqmin,30px);border-radius:999px;border:1px solid '+(inGrp?'var(--accent)':'var(--line)')+';background:'+(inGrp?'var(--accent)':'var(--surface-2)')+';position:relative;cursor:pointer;flex:none;padding:0"><span style="position:absolute;top:12%;'+(inGrp?'right:9%':'left:9%')+';width:min(42%,1.1em);aspect-ratio:1;border-radius:50%;background:'+(inGrp?'#fff':'var(--muted)')+';transition:.15s"></span></button></div>';}).join('');
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
      // Master-UID (RINCON) des aktuellen Raums als coordinator; members = aktuelle Gruppe +/- toggle.
      function currentMembers(){var m=[];s.rooms.forEach(function(rr){if(rr.role==='member'&&rr.coordinator===cur.coordinator)m.push(rr);});return m;}
      $$('[data-afgrp]',el).forEach(function(b){b.onclick=function(){var rid=+b.getAttribute('data-afgrp');var wasIn=b.getAttribute('data-afin')==='1';
        // coordinatorUid des Masters ist cur.coordinator (bei standalone = eigene UID); wir gruppieren AUF cur.
        var coord=cur.coordinator||('SELF_'+cur.id);
        var members=currentMembers().map(function(x){return x.coordinator;}); // UIDs; vereinfachte Sicht
        // Ziel-Mitglied ist die Zone rid -> deren eigene UID kennen wir nicht direkt; wir schalten ueber deren Instanz per manage group/ungroup.
        var target=s.rooms.filter(function(x){return x.id===rid;})[0];if(!target)return;
        if(wasIn){ afManage(w,rid,{op:'ungroup'}); }
        else { afManage(w,rid,{op:'group',args:{coordinatorUid:coord,memberUids:[coord]}}); }
      };});
      var ug=$('[data-afungroup]',el);if(ug)ug.onclick=function(){ // alle Mitglieder trennen
        currentMembers().forEach(function(m){ /* per Instanz ungroup */ });
        s.rooms.forEach(function(rr){ if(rr.role==='member'&&rr.coordinator===cur.coordinator) afManage(w,rr.id,{op:'ungroup'}); });
      };},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });
