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
  // Sender fuer die werbefreie Direktwiedergabe laden (einmal).
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
  function afSvg(p,sz){return '<svg viewBox="0 0 24 24" width="'+(sz||18)+'" height="'+(sz||18)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';}
  function afMsg(t){return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px">'+esc(t)+'</div>';}
  function afReady(w){var s=afSess(w);if(s.err)return {err:s.err};if(!s.loaded)return {loading:true};return {s:s};}
  function afSessRow(w){return row('Session-ID','<input id="afSessInp" value="'+esc(w.session||'audio')+'" placeholder="audio">')
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Gleiche Session-ID = geteilte Bedienung mit den anderen Audio-Teil-Widgets.</div>';}
  function afSessWire(w){if($('#afSessInp'))$('#afSessInp').onchange=function(){w.session=this.value||undefined;commit();var el=$('.w[data-id="'+w.id+'"]',canvas);if(el){var s=WIDGETS[w.type];var host=el.querySelector('.winner')||el;host.innerHTML=s.render(w);if(s._bind)s._bind(w,el);}afEmit(w);};}
  function afMount(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));if(!el)return;afSub(w);afEnsure(w,el);}

  // ---------- audioroom (Controller): Raum-Tabs ----------
  function afRoomBar(s){return '<div style="display:flex;flex-wrap:wrap;gap:0;border-bottom:1px solid var(--line)">'+
    s.rooms.map(function(r,i){var dot=r.role==='member'?'var(--info)':(r.playing?'var(--accent)':'var(--faint)');
      return '<button data-afroom="'+i+'" style="padding:9px 13px;font-size:12px;font-weight:600;letter-spacing:.2px;white-space:nowrap;cursor:pointer;background:none;border:0;border-bottom:2px solid '+(i===s.roomIdx?'var(--accent)':'transparent')+';color:'+(i===s.roomIdx?'var(--text)':'var(--muted)')+';display:inline-flex;align-items:center;gap:7px">'+
      '<span style="width:7px;height:7px;border-radius:50%;background:'+dot+'"></span>'+esc(r.name)+(r.role==='member'?' <span style="font-family:var(--fm);font-size:8.5px;color:var(--info);border:1px solid color-mix(in oklab,var(--info) 45%,transparent);border-radius:999px;padding:0 5px">GRP</span>':'')+'</button>';}).join('')+'</div>';}
  defWidget('audioroom',{
    label:'Audio · Räume', paletteIcon:'wselect', size:[720,52],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('Audio lädt …');
      return '<div style="position:absolute;inset:0;overflow:auto;background:var(--surface)">'+afRoomBar(r.s)+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);$$('[data-afroom]',el).forEach(function(b){b.onclick=function(){s.roomIdx=+b.getAttribute('data-afroom');s.radio=null;afEmit(w);afLoadRadio(w);};});},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audionow: Cover + Titel + Interpret + Fortschritt ----------
  defWidget('audionow',{
    label:'Audio · Now-Playing', paletteIcon:'image', size:[420,240],
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
      return '<div style="position:absolute;inset:0;display:flex;gap:13px;padding:12px;box-sizing:border-box;background:var(--surface);align-items:center">'
        +'<div style="width:40%;max-width:170px;aspect-ratio:1;align-self:center;border-radius:var(--r-s,9px);overflow:hidden;flex:none;background:'+bg+'">'+cov+'</div>'
        +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:3px">'
        +'<div style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint)">'+tag+'</div>'
        +'<div style="font-size:19px;font-weight:700;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(line1||'—')+'</div>'
        +'<div style="font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(line2||'')+'</div>'
        +'<div style="font-size:11px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(line3||'')+'</div>'
        +'<div style="position:relative;height:6px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);margin:8px 0 3px"><div style="position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--accent);width:'+Math.max(0,Math.min(100,c.positionPct||0))+'%"></div></div>'
        +'<div style="display:flex;justify-content:space-between;font-family:var(--fm);font-size:11px;color:var(--muted)"><span>'+esc(c.position||'0:00')+'</span><span>'+esc(c.duration||'')+'</span></div>'
        +'</div></div>';},
    mount:afMount, _bind:function(){}, props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audioctl: Transport + Volume + Mute/Power ----------
  defWidget('audioctl',{
    label:'Audio · Steuerung', paletteIcon:'wselect', size:[420,150],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var c=afCur(r.s);if(!c)return afMsg('kein Raum');
      function seg(ic,cmd,on){return '<button data-afcmd="'+cmd+'" style="flex:1;display:flex;align-items:center;justify-content:center;height:42px;background:'+(on?'linear-gradient(135deg,var(--accent),var(--accent-2))':'transparent')+';color:'+(on?'#fff':'var(--text)')+';border:0;cursor:pointer">'+ic+'</button>';}
      var playing=!!c.playing;
      var bar='<div style="display:flex;border:1px solid var(--line);border-radius:999px;background:var(--surface-2);overflow:hidden;margin-bottom:10px">'
        +seg(afSvg(AF_IC.prev,18),'5',false)+seg(afSvg(playing?AF_IC.pause:AF_IC.play,20),playing?'2':'1',true)
        +seg(afSvg(AF_IC.stop,16),'3',false)+seg(afSvg(AF_IC.next,18),'4',false)+'</div>';
      // Shuffle/Repeat als breite Buttons (Design A)
      function wide(ic,lbl,cmd,on){return '<button data-afcmd="'+cmd+'" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:40px;border:1px solid '+(on?'var(--accent)':'var(--line)')+';border-radius:var(--r-s,9px);background:'+(on?'color-mix(in oklab,var(--accent) 14%,transparent)':'var(--tile)')+';color:'+(on?'var(--accent)':'var(--text)')+';font-size:13px;cursor:pointer">'+ic+lbl+'</button>';}
      var sr='<div style="display:flex;gap:10px;margin-bottom:10px">'+wide(afSvg(AF_IC.shuffle,16),'Shuffle','shuffle',!!c.shuffle)+wide(afSvg(AF_IC.repeat,16),'Repeat','repeat',!!c.repeat)+'</div>';
      // Volume-Zeile mit Mute-Icon links + Power-Icon rechts (Design A)
      function ibtn(ic,cmd,on){return '<button data-afcmd="'+cmd+'" style="width:40px;height:40px;flex:none;border:1px solid '+(on?'var(--accent)':'var(--line)')+';border-radius:var(--r-s,9px);background:'+(on?'color-mix(in oklab,var(--accent) 14%,transparent)':'var(--tile)')+';color:'+(on?'var(--accent)':'var(--muted)')+';display:flex;align-items:center;justify-content:center;cursor:pointer">'+ic+'</button>';}
      var vol='<div style="display:flex;align-items:center;gap:10px">'+ibtn(afSvg(c.mute?AF_IC.mute:AF_IC.vol,17),'mute',!!c.mute)
        +'<div data-afvol style="position:relative;flex:1;height:8px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);cursor:pointer"><div style="position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--accent);width:'+Math.max(0,Math.min(100,c.volume||0))+'%"></div></div>'
        +'<span style="font-family:var(--fm);width:30px;text-align:right;font-size:12px">'+(c.volume||0)+'</span>'+ibtn(afSvg(AF_IC.power,16),'power',!!c.power)+'</div>';
      return '<div style="position:absolute;inset:0;padding:12px;box-sizing:border-box;background:var(--surface);display:flex;flex-direction:column;justify-content:center">'+bar+sr+vol+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);
      $$('[data-afcmd]',el).forEach(function(b){b.onclick=function(){var cmd=b.getAttribute('data-afcmd');var c=afCur(s);if(!c)return;
        if(cmd==='mute')afSet(w,'Mute',!c.mute);
        else if(cmd==='power')afSet(w,'Power',!c.power);
        else if(cmd==='shuffle')afSet(w,'Shuffle',!c.shuffle);
        else if(cmd==='repeat')afSet(w,'Repeat',c.repeat?0:2);
        else afSet(w,'Transport',cmd); // 1..5
      };});
      var vb=$('[data-afvol]',el);if(vb)vb.onclick=function(e){var box=vb.getBoundingClientRect();var pct=Math.round((e.clientX-box.left)/box.width*100);afSet(w,'Volume',Math.max(0,Math.min(100,pct)));};},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audiosrc: Quelle (Favorit/Radio/Playlist) — kompakte Stepper ----------
  defWidget('audiosrc',{
    label:'Audio · Quelle', paletteIcon:'wlist', size:[420,120],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var c=afCur(r.s);if(!c)return afMsg('kein Raum');
      function rowSrc(lbl,ident,val){return '<div style="display:flex;align-items:center;gap:8px;margin:5px 0"><span style="width:74px;font-size:12px;color:var(--muted)">'+lbl+'</span>'
        +'<button data-afsrc="'+ident+'" data-afd="-1" style="width:30px;height:28px;border:1px solid var(--line);border-radius:7px;background:var(--tile);color:var(--text);cursor:pointer">−</button>'
        +'<span style="font-family:var(--fm);min-width:34px;text-align:center;font-size:13px">#'+(val||0)+'</span>'
        +'<button data-afsrc="'+ident+'" data-afd="1" style="width:30px;height:28px;border:1px solid var(--line);border-radius:7px;background:var(--tile);color:var(--text);cursor:pointer">+</button></div>';}
      return '<div style="position:absolute;inset:0;padding:11px 13px;box-sizing:border-box;background:var(--surface);display:flex;flex-direction:column;justify-content:center">'
        +'<div style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint);margin-bottom:2px">Quelle</div>'
        +rowSrc('Favorit','SourceFavorite',c.fav)+rowSrc('Radio','SourceRadio',c.radio)+rowSrc('Playlist','SourcePlaylist',c.playlist)+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);$$('[data-afsrc]',el).forEach(function(b){b.onclick=function(){var ident=b.getAttribute('data-afsrc'),d=+b.getAttribute('data-afd');var c=afCur(s);if(!c)return;
      var cur=(ident==='SourceFavorite'?c.fav:ident==='SourceRadio'?c.radio:c.playlist)||0;afSet(w,ident,Math.max(0,cur+d));};});},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- audioradio: Sender werbefrei direkt spielen (HQ-Stream statt TuneIn) ----------
  defWidget('audioradio',{
    label:'Audio · Radio (werbefrei)', paletteIcon:'wlist', size:[420,150],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      if(!s.stations){afLoadStations(w,function(){afEmit(w);});return afMsg('Sender lädt …');}
      var curKey=(s.radio&&s.radio.roomId===c.id)?(s.radio.key||''):'';
      var chips=s.stations.map(function(st){var on=(curKey&&curKey===st.key);
        return '<button data-afstation="'+esc(st.key)+'" style="border:1px solid '+(on?'var(--accent)':'var(--line)')+';border-radius:999px;background:'+(on?'color-mix(in oklab,var(--accent) 14%,transparent)':'var(--tile)')+';color:'+(on?'var(--accent)':'var(--text)')+';font-size:12px;padding:6px 12px;cursor:pointer">'+esc(st.title)+'</button>';}).join('');
      return '<div style="position:absolute;inset:0;padding:11px 13px;box-sizing:border-box;background:var(--surface);overflow:auto">'
        +'<div style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint);margin-bottom:8px">Radio · werbefrei direkt ('+esc(c.name)+')</div>'
        +'<div style="display:flex;flex-wrap:wrap;gap:8px">'+chips+'</div></div>';},
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
  defWidget('audiolib',{
    label:'Audio · Bibliothek', paletteIcon:'wlist', size:[700,420],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,c=afCur(s);if(!c)return afMsg('kein Raum');
      var L=afLib(w);
      if(!L.providers){afLibProviders(w,function(){afEmit(w);});return afMsg('Quellen lädt …');}
      if(!L.providers.length)return afMsg('Keine Medienquelle konfiguriert (Hub → Medienquellen)');
      var tabs=L.providers.map(function(p){return '<button data-afprov="'+esc(p.id)+'" style="padding:7px 12px;border:0;border-bottom:2px solid '+(L.provider===p.id?'var(--accent)':'transparent')+';background:none;color:'+(L.provider===p.id?'var(--text)':'var(--muted)')+';font-weight:600;font-size:12px;cursor:pointer">'+esc(p.label)+'</button>';}).join('');
      var crumb=(L.stack.length?('<button data-afback="1" style="border:1px solid var(--line);border-radius:7px;background:var(--tile);color:var(--text);font-size:11px;padding:4px 10px;cursor:pointer;margin:6px 0">◀ zurück</button> <span style="font-size:11px;color:var(--muted)">'+esc(L.title||'')+'</span>'):'');
      var body='';
      if(L.loading)body='<div style="color:var(--muted);font-size:12px;padding:10px">lädt …</div>';
      else if(L.items&&L.items.length){
        body='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+L.items.map(function(it,i){
          var cov=it.cover?('<img src="'+esc(it.cover)+'" style="width:38px;height:38px;border-radius:6px;object-fit:cover;flex:none" onerror="this.style.visibility=\'hidden\'">'):'<span style="width:38px;height:38px;border-radius:6px;flex:none;background:var(--surface-2)"></span>';
          return '<div data-afitem="'+i+'" style="display:flex;gap:9px;align-items:center;border:1px solid var(--line);border-radius:var(--r-s,9px);padding:7px 9px;background:var(--tile);cursor:pointer">'+cov+
            '<div style="min-width:0;flex:1"><div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(it.title||'')+'</div>'+
            '<div style="font-size:10.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(it.artist||it.album||'')+'</div></div>'+
            '<span style="color:var(--faint);font-size:12px">'+(it.isContainer?'▸':'▶')+'</span></div>';}).join('')+'</div>';
      } else if(L.provider) body='<div style="color:var(--muted);font-size:12px;padding:10px">leer</div>';
      else body='<div style="color:var(--muted);font-size:12px;padding:10px">Quelle wählen</div>';
      return '<div style="position:absolute;inset:0;display:flex;flex-direction:column;background:var(--surface)">'
        +'<div style="display:flex;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:0 6px">'+tabs+'</div>'
        +'<div style="padding:0 12px">'+crumb+'</div>'
        +'<div style="flex:1;overflow:auto;padding:6px 12px 12px">'+body+'</div></div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w),L=afLib(w);
      $$('[data-afprov]',el).forEach(function(b){b.onclick=function(){L.stack=[];L.title='';afLibBrowse(w,b.getAttribute('data-afprov'),'','');};});
      var bk=$('[data-afback]',el);if(bk)bk.onclick=function(){L.stack.pop();var top=L.stack.length?L.stack[L.stack.length-1]:{id:'',title:''};L.title=top.title||'';afLibBrowse(w,L.provider,top.id||'',top.title||'');};
      $$('[data-afitem]',el).forEach(function(d){d.onclick=function(){var it=(L.items||[])[+d.getAttribute('data-afitem')];if(!it)return;
        if(it.isContainer){L.stack.push({id:it.id,title:it.title});L.title=it.title;afLibBrowse(w,L.provider,it.id,it.title);}
        else afLibPlay(w,it);};});},
    props:function(w){return afSessRow(w);}, wire:function(w){afSessWire(w);}
  });

  // ---------- multiroom: Gruppen-Manager (N-zu-1) ----------
  defWidget('multiroom',{
    label:'Audio · Multiroom', paletteIcon:'wlist', size:[420,320],
    defaults:function(w){w.session='audio';},
    render:function(w){var r=afReady(w);if(r.err)return afMsg(r.err);if(r.loading)return afMsg('lädt …');var s=r.s,cur=afCur(s);if(!cur)return afMsg('kein Raum');
      var master=cur.coordinator||'';
      var head='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint)">Multiroom · Master: '+esc(cur.name)+'</span>'
        +'<button data-afungroup="1" style="font-size:11px;color:var(--accent);background:none;border:0;cursor:pointer">Gruppe trennen</button></div>';
      var rows=s.rooms.map(function(rr){ if(rr.id===cur.id)return '';
        var inGrp=(rr.role==='member'&&rr.coordinator===master&&master!=='');
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 2px;border-top:1px solid var(--line-soft)">'
          +'<span style="width:22px;height:22px;border-radius:6px;flex:none;background:'+(rr.playing?'linear-gradient(135deg,var(--accent),var(--accent-2))':'var(--surface-2)')+'"></span>'
          +'<span style="flex:1;font-size:13px;font-weight:600">'+esc(rr.name)+'</span>'
          +'<span style="font-size:10.5px;color:var(--muted)">'+(inGrp?'synchron':(rr.role==='member'?'andere Gruppe':(rr.playing?'spielt eigenes':'frei')))+'</span>'
          +'<button data-afgrp="'+rr.id+'" data-afin="'+(inGrp?1:0)+'" style="width:42px;height:24px;border-radius:999px;border:1px solid '+(inGrp?'var(--accent)':'var(--line)')+';background:'+(inGrp?'var(--accent)':'var(--surface-2)')+';position:relative;cursor:pointer"><span style="position:absolute;top:2px;left:'+(inGrp?'20px':'2px')+';width:18px;height:18px;border-radius:50%;background:'+(inGrp?'#fff':'var(--muted)')+';transition:.15s"></span></button></div>';}).join('');
      return '<div style="position:absolute;inset:0;overflow:auto;padding:11px 13px;box-sizing:border-box;background:var(--surface)">'+head+rows+'</div>';},
    mount:afMount,
    _bind:function(w,el){var s=afSess(w);var cur=afCur(s);if(!cur)return;
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
