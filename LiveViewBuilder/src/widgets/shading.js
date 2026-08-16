  // ===== Widget: Beschattung/Rollo (shading) — IPSShadowing-Gerät als Karte =====
  //
  //  Steuert EIN IPSShadowing-Rollo: Position (Jalousie-Visual + Slider/Presets), Automatik,
  //  Programm-/Profil-Auswahlen (Tag/Nacht/Sonne/…) und Live-Status. Liest über ?api=shading,
  //  schreibt über das bestehende ?api=setvar (RequestAction). Im Doku-Modus nur Demodaten.

  var _shState = {};
  var _shDevices = null;
  var _shTimer = null;
  var SH_PROGLBL = {day:'Tag', night:'Nacht', temp:'Temperatur', present:'Präsenz', bgn:'Tagesbeginn', end:'Tagesende', sun:'Sonne'};
  var SH_DEFPROGS = ['day','night','sun'];
  var SH_ALLPROGS = ['day','night','temp','present','bgn','end','sun'];

  function shSt(w){return _shState[w.id]||(_shState[w.id]={loaded:false,data:null,err:''});}
  function shProgs(w){return Array.isArray(w.progs)?w.progs:SH_DEFPROGS;}  // [] = keine Programme (kompakte Karte)

  function shDemo(w){return {ok:true,id:900701,name:(w&&w.label)||'Büro',group:'EG',
    position:{vid:900711,value:35}, automatic:{vid:900712,value:true},
    info:'Tagesprogramm, Tag=06:00–20:56,  Innen 24,8 °C,  Außen 31 °C',
    programs:{
      day:{ident:'ProgramDay',vid:900713,value:1,text:'Offen',options:[{v:1,name:'Offen'},{v:8,name:'50%'},{v:11,name:'Geschlossen'},{v:17,name:'Manuell'}]},
      night:{ident:'ProgramNight',vid:900714,value:11,text:'Geschlossen',options:[{v:1,name:'Offen'},{v:11,name:'Geschlossen'}]},
      sun:{ident:'ProfileSun',vid:900715,value:2,text:'Süd',options:[{v:2,name:'Süd'},{v:1,name:'West'},{v:0,name:'Aus'}]}
    }};}

  // ============================ RENDER ============================
  // Sperrgruende auf Symbol, Kurztext und Farbe abbilden. Der volle Text steht im Titel.
  var SH_BLOCKS=[
    [/tür|tuer/i,        'door',   'Tür',        'crit'],
    [/sturm|wind/i,      'wind',   'Sturm',      'crit'],
    [/kalibr/i,          'ruler',  'Kalibrierung','warn'],
    [/hand|manuell/i,    'hand',   'Hand',       'warn'],
    [/hub|automatik aus/i,'power',  'Aus',        'muted'],
    [/schatten|scharf/i, 'eye',    'Schatten',   'muted'],
    [/regen/i,           'droplet','Regen',      'warn']
  ];
  function shBlockDef(t){for(var i=0;i<SH_BLOCKS.length;i++)if(SH_BLOCKS[i][0].test(t))return SH_BLOCKS[i];return [null,'lock','blockiert','warn'];}
  function shBlockIcon(t){var d=shBlockDef(t);return (typeof iconSVG==='function')?iconSVG(d[1]):'';}
  function shBlockShort(t){return shBlockDef(t)[2];}
  function shBlockCls(t){return ' sev-'+shBlockDef(t)[3];}

  function shRender(w){
    var st=shSt(w);
    if(!st.loaded)return '<div class="shd shd-msg">lädt …</div>';
    if(st.err)return '<div class="shd shd-msg">'+esc(st.err)+'</div>';
    if((!w.deviceId&&!(typeof DOKU!=='undefined'&&DOKU))||!st.data)return '<div class="shd shd-msg">Rollo im Panel wählen</div>';
    var d=st.data, pos=(d.position&&d.position.value)|0, auto=!!(d.automatic&&d.automatic.value);
    var h='<div class="shd">';
    // Sperr-Anzeiger LINKS neben der Automatik-Umschaltung. Er erscheint nur, wenn das
    // Modul einen Grund nennt (BlockReason) - so heisst Stillstand nicht mehr "es passiert
    // halt nichts", sondern sagt, WAS im Weg steht. Die Symbole sind je Grund verschieden,
    // damit man sie ohne Antippen unterscheiden kann.
    var blk=(d.block&&d.block.value)||'';
    h+='<div class="shd-head"><span class="shd-name">'+escL(w.label||d.name)+'</span>'
      +(blk?('<span class="shd-block'+shBlockCls(blk)+'" title="'+esc(blk)+'">'+shBlockIcon(blk)+'<b>'+esc(shBlockShort(blk))+'</b></span>'):'')
      +'<button class="shd-auto'+(auto?' on':'')+'" data-shauto="1" title="Automatik '+(auto?'an':'aus')+'"><span class="shd-dot"></span>Auto</button></div>';
    // Position: Jalousie-Visual + Wert + Slider + Presets
    h+='<div class="shd-posrow"><div class="shd-blind" title="'+pos+' % geschlossen"><i style="height:'+pos+'%"></i></div>'
      +'<div class="shd-posctl"><div class="shd-posval">'+pos+' %<small> geschlossen</small></div>'
      +'<input class="shd-slider" type="range" min="0" max="100" step="1" value="'+pos+'" data-shpos="1">'
      +'<div class="shd-preset"><button data-shpset="0">Auf</button><button data-shpset="50">Halb</button><button data-shpset="100">Zu</button></div>'
      +'</div></div>';
    // Programme
    var prog='';
    shProgs(w).forEach(function(k){var p=d.programs&&d.programs[k];if(!p)return;
      prog+='<label class="shd-prog"><span>'+esc(SH_PROGLBL[k]||k)+'</span><select data-shprog="'+p.vid+'">'+(p.options||[]).map(function(o){return '<option value="'+o.v+'"'+(o.v==p.value?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</select></label>';
    });
    if(prog)h+='<div class="shd-progs">'+prog+'</div>';
    if(d.info)h+='<div class="shd-info">'+esc(d.info)+'</div>';
    h+='</div>';
    return h;
  }

  // ============================ NETZ ============================
  function shLoadDevices(cb){
    if(_shDevices){cb&&cb();return;}
    if(typeof DOKU!=='undefined'&&DOKU){_shDevices=[{id:900701,name:'Büro',group:'EG'},{id:900702,name:'Markise',group:'Markise'}];cb&&cb();return;}
    fetch('?api=shading&op=list',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){_shDevices=(j&&j.devices)||[];cb&&cb();}).catch(function(){_shDevices=[];cb&&cb();});
  }
  // Sammel-Cache: EIN ?api=getall speist ALLE Rollo-Karten (statt 17 Einzelabrufe)
  var _shAll=null, _shAllTs=0, _shAllWait=null;
  function shLoadAll(force,cb){
    if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();return;}
    if(!force&&_shAll&&(Date.now()-_shAllTs<5000)){cb&&cb();return;}
    if(_shAllWait){_shAllWait.push(cb);return;}                       // parallele Aufrufe bündeln
    _shAllWait=[cb];
    fetch('?api=shading&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var m={}; ((j&&j.devices)||[]).forEach(function(d){m[d.id]=d;}); _shAll=m; _shAllTs=Date.now();
      var q=_shAllWait; _shAllWait=null; q.forEach(function(c){c&&c();});
    }).catch(function(){ var q=_shAllWait; _shAllWait=null; (q||[]).forEach(function(c){c&&c();}); });
  }
  function shFetch(w,el){var st=shSt(w);
    if(typeof DOKU!=='undefined'&&DOKU){st.data=shDemo(w);st.loaded=true;st.err='';shRepaint(w,el);return;}
    if(!w.deviceId){st.loaded=true;st.data=null;shRepaint(w,el);return;}
    shLoadAll(false,function(){ st.data=(_shAll&&_shAll[w.deviceId])||null; st.err=st.data?'':'Rollo nicht lesbar'; st.loaded=true; shRepaint(w,el); });
  }
  function shWrite(w,el,vid,val){ if(!vid)return; setVar(vid,val);
    setTimeout(function(){ shLoadAll(true,function(){ var st=shSt(w); if(_shAll&&_shAll[w.deviceId])st.data=_shAll[w.deviceId]; shRepaint(w,el); }); },500);
  }
  // Live-Aktualisierung: EIN Sammelabruf, dann alle sichtbaren Karten neu zeichnen
  function shStartTimer(){ if(_shTimer||(typeof DOKU!=='undefined'&&DOKU))return; _shTimer=setInterval(shTick,7000); }
  function shTick(){
    var vis=Object.keys(_shState).filter(function(id){return _shState[id].loaded&&document.querySelector('.w[data-id="'+id+'"]');});
    if(!vis.length)return;
    shLoadAll(true,function(){
      vis.forEach(function(id){var st=_shState[id],w=(typeof widget==='function')?widget(id):null;if(!w||!w.deviceId)return;
        var el=document.querySelector('.w[data-id="'+id+'"]');if(!el)return;
        if(_shAll&&_shAll[w.deviceId])st.data=_shAll[w.deviceId];
        if(document.activeElement&&el.contains(document.activeElement))return;   // nicht während Bedienung neu zeichnen
        shRepaint(w,el);});
    });
  }

  // ============================ PAINT/BIND ============================
  function shElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function shRepaint(w,el){if(!el)el=shElOf(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=shRender(w);shBind(w,el);}
  function shBind(w,el){var st=shSt(w),d=st.data;
    var ab=$('[data-shauto]',el);if(ab&&d&&d.automatic)ab.onclick=function(){shWrite(w,el,d.automatic.vid,d.automatic.value?0:1);};
    var sl=$('[data-shpos]',el);if(sl&&d&&d.position){sl.onchange=function(){shWrite(w,el,d.position.vid,parseInt(sl.value)||0);};
      sl.oninput=function(){var pv=$('.shd-posval',el);if(pv)pv.firstChild.nodeValue=sl.value+' ';var bl=$('.shd-blind i',el);if(bl)bl.style.height=sl.value+'%';};}
    $$('[data-shpset]',el).forEach(function(b){if(d&&d.position)b.onclick=function(){shWrite(w,el,d.position.vid,+b.getAttribute('data-shpset'));};});
    $$('[data-shprog]',el).forEach(function(s){s.onchange=function(){shWrite(w,el,+s.getAttribute('data-shprog'),+s.value);};});
  }

  // ============================ WIDGET ============================
  defWidget('shading',{
    // IPSShadowing-Legacy (via ?api=shading) — abgeloest durch die HomeSuite-Familie
    // (rooms/curve/slots, domain=shading). noPalette: bleibt auf Bestandsseiten
    // funktionsfaehig, wird aber nicht mehr neu angeboten (Entfernung nach Cutover).
    noPalette:true,
    label:'Beschattung (IPSShadowing)', cat:'HomeSuite · Beschattung', paletteIcon:'cover', size:[260,230],
    defaults:function(w){w.label='';},
    render:function(w){return shRender(w);},
    mount:function(w){var el=shElOf(w);if(!el)el=shElOf(w,$('#ovcanvas'));if(!el)return;shStartTimer();shFetch(w,el);},
    props:function(w){return shProps(w);},
    wire:function(w){shWire(w);}
  });

  function shProps(w){
    var h='<div class="pgh">Rollo</div>';
    if(!_shDevices){shLoadDevices(function(){if(typeof renderProps==='function')renderProps();});return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Rollos laden …</div>';}
    h+=row('Gerät','<select id="shDev"><option value="">— wählen —</option>'+(_shDevices||[]).map(function(dv){return '<option value="'+dv.id+'"'+(w.deviceId==dv.id?' selected':'')+'>'+esc(dv.name)+(dv.group?(' · '+esc(dv.group)):'')+'</option>';}).join('')+'</select>');
    h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Name leer = Geräte-Name. Position/Programme werden live gelesen und geschrieben.</div>';
    h+='<div class="pgh">Programme anzeigen</div><div class="shd-progpick">';
    var cur=shProgs(w);
    h+=SH_ALLPROGS.map(function(k){return '<label class="shd-pp"><input type="checkbox" data-shpp="'+k+'"'+(cur.indexOf(k)>=0?' checked':'')+'> '+esc(SH_PROGLBL[k])+'</label>';}).join('');
    h+='</div>';
    return h;
  }
  function shWire(w){
    if($('#shDev'))$('#shDev').onchange=function(){var v=parseInt(this.value)||0;w.deviceId=v||undefined;commit();
      var el=shElOf(w);if(el){var st=shSt(w);st.loaded=false;st.data=null;shRepaint(w,el);shFetch(w,el);}};
    $$('#props [data-shpp]').forEach(function(c){c.onchange=function(){
      var arr=[];SH_ALLPROGS.forEach(function(k){var cb=$('#props [data-shpp="'+k+'"]');if(cb&&cb.checked)arr.push(k);});
      w.progs=(arr.length&&arr.join()!==SH_DEFPROGS.join())?arr:undefined; commit(); var el=shElOf(w);if(el)shRepaint(w,el);};});
  }
