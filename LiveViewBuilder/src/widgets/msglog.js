  // ===== Widget: Meldungen (msglog) =====
  // Quelle: Symcon-Log (ohne DEBUG) ODER Homematic-CCU-Servicemeldungen (XML-RPC + ReGaHss,
  // nur IP noetig). Ansicht: Liste oder Kompakt (nur Anzahl je Severity). Severity-Filter per
  // Chip (live, je Geraet gespeichert). Quelle im Frontend live umschaltbar, wenn eine CCU-IP
  // hinterlegt ist. Homematic-Meldungen koennen optional per Haken bestaetigt werden (AlReceipt).
  var _SEVCLR={ERROR:'#f2685a',WARNING:'#f2b441',CUSTOM:'#c471ed',NOTIFY:'#4aa3ff',MESSAGE:'#8a97a0',SUCCESS:'#39d08a'};
  var _SEVS=['ERROR','WARNING','CUSTOM','NOTIFY','MESSAGE','SUCCESS'];
  function _sevDef(w,s){if(!w.sev)return (s==='ERROR'||s==='WARNING'||s==='CUSTOM');return !!w.sev[s];}
  function _msgFilter(w){
    if(typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvmsg_'+w.id);if(o){var j=JSON.parse(o);if(j)return j;}}catch(e){}}
    var f={};_SEVS.forEach(function(s){f[s]=_sevDef(w,s)?1:0;});return f;
  }
  // Effektive Quelle: nur wenn eine CCU-IP hinterlegt ist, ist Homematic ueberhaupt moeglich;
  // im Frontend per Umschalter (localStorage) uebersteuerbar, sonst der Builder-Standard w.msgSrc.
  function _msgSrc(w){
    if(!w.hmIP)return 'symcon';
    try{var o=localStorage.getItem('lvmsgsrc_'+w.id);if(o==='symcon'||o==='homematic')return o;}catch(e){}
    return (w.msgSrc==='homematic')?'homematic':'symcon';
  }
  function _chips(w){var f=_msgFilter(w);return _SEVS.map(function(s){return '<span class="hmsgchip'+(f[s]?'':' off')+'" data-sevchip="'+s+'" style="--cc:'+_SEVCLR[s]+'">'+s+'</span>';}).join('');}
  function _srcSwitch(w){ // Live-Umschalter Symcon/Homematic (nur mit CCU-IP)
    if(!w.hmIP)return '';
    var s=_msgSrc(w);
    return '<span class="hmsgsw" data-msgsw="1" title="Quelle umschalten"><span class="'+(s==='symcon'?'on':'')+'">Symcon</span><span class="'+(s==='homematic'?'on':'')+'">HM</span></span>';
  }
  function _renderCount(box,w,msgs,sevOn){ // Kompaktansicht: grosse Zahl je aktiver Severity
    var cnt={};_SEVS.forEach(function(s){cnt[s]=0;});
    msgs.forEach(function(m){if(cnt[m.sev]!=null)cnt[m.sev]++;});
    var shown=sevOn.filter(function(s){return cnt[s]>0;});
    box.classList.add('is-count');
    if(!shown.length){box.innerHTML='<div class="hmsgcount"><div class="hmsgcb" style="--cc:'+_SEVCLR.SUCCESS+'"><span class="n">0</span><span class="l">OK</span></div></div>';return;}
    box.innerHTML='<div class="hmsgcount">'+shown.map(function(s){
      return '<div class="hmsgcb" style="--cc:'+_SEVCLR[s]+'"><span class="n">'+cnt[s]+'</span><span class="l">'+s+'</span></div>';}).join('')+'</div>';
  }
  function fetchMsgs(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el){var oc=document.getElementById('ovcanvas');if(oc)el=$('.w[data-id="'+w.id+'"]',oc);}
    if(!el)return;var box=$('[data-role=msgl]',el);if(!box)return;
    var f=_msgFilter(w),sevOn=_SEVS.filter(function(s){return f[s];});
    var src=_msgSrc(w),isCount=(w.view==='count');
    if(!isCount)box.classList.remove('is-count');
    if(!sevOn.length){box.classList.remove('is-count');box.innerHTML='<div class="hmsge">Keine Kategorie aktiv</div>';box._sig='none';return;}
    var url=(src==='homematic')?('?api=hmmsg&ip='+encodeURIComponent(w.hmIP))
                              :('?api=messages&n='+(w.max||25)+'&sev='+encodeURIComponent(sevOn.join(',')));
    fetch(url,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.error){box.classList.remove('is-count');box.innerHTML='<div class="hmsge" style="color:var(--crit)">CCU nicht erreichbar</div>';box._sig='err';return;}
      var all=((j&&j.messages)||[]).filter(function(m){return f[m.sev];});
      var msgs=(src==='homematic')?all.slice(0,w.max||60):all.slice(0,w.max||25).reverse(); // Symcon: neueste unten; HM: wie geliefert (nach Severity)
      var sig=src+'|'+isCount+'|'+msgs.map(function(m){return (m.t||'')+m.m;}).join('|');
      if(box._sig===sig)return;
      var wasBottom=(box._sig===undefined)||(box.scrollTop+box.clientHeight>=box.scrollHeight-6);
      box._sig=sig;
      if(isCount){_renderCount(box,w,msgs,sevOn);return;}
      box.classList.remove('is-count');
      if(!msgs.length){box.innerHTML='<div class="hmsge">Keine Meldungen</div>';return;}
      var ack=(src==='homematic'&&w.hmAck);
      if(src==='homematic'){ // eigenes, kompaktes Zeilen-Layout (keine Zeit/Quelle, optional Haken)
        box.innerHTML=msgs.map(function(m){var c=_SEVCLR[m.sev]||'#8a97a0';
          return '<div class="hmsgi hm"><span class="hmsgdot" style="background:'+c+'"></span><span class="hmsgsev" style="color:'+c+'">'+esc(m.sev||'')+'</span><span class="hmsgm">'+esc(m.m||'')+'</span>'
            +(ack?'<button class="hmackb" data-hmack="1" data-haddr="'+esc(m.addr||'')+'" data-htype="'+esc(m.type||'')+'" title="Bestätigen"><svg class="i"><use href="#ic-check"/></svg></button>':'')
            +'</div>';}).join('');
      } else {
        box.innerHTML=msgs.map(function(m){var c=_SEVCLR[m.sev]||'#8a97a0',tm=(m.t||'').slice(-8);
          return '<div class="hmsgi"><span class="hmsgdot" style="background:'+c+'"></span><span class="hmsgsev" style="color:'+c+'">'+esc(m.sev||'')+'</span><span class="hmsgtime">'+esc(tm)+'</span><span class="hmsgsrc">'+esc(m.src||'')+'</span><span class="hmsgm">'+esc(m.m||'')+'</span></div>';}).join('');
        if(!w.noAuto&&wasBottom)box.scrollTop=box.scrollHeight;
      }
    }).catch(function(){box.classList.remove('is-count');box.innerHTML='<div class="hmsge" style="color:var(--crit)">Nicht lesbar</div>';box._sig='err';});
  }
  defWidget('msglog',{
    label:'Meldungen', paletteIcon:'wticker', size:[460,230], noHover:true,
    defaults:function(w){w.label='Meldungen';w.max=25;},
    render:function(w){return '<div class="hmsg"><div class="hmsgtop"><span class="hmsgt">'+escL(w.label||'Meldungen')+'</span>'+_srcSwitch(w)+'<span class="hmsgchips">'+_chips(w)+'</span></div><div class="hmsgl'+(w.view==='count'?' is-count':'')+'" data-role="msgl"><div class="hmsge">…</div></div></div>';},
    props:function(w){return '<div class="pgh">Quelle</div>'
      +row('Typ','<select id="pMsgSrc"><option value="symcon"'+(w.msgSrc!=='homematic'?' selected':'')+'>Symcon-Log</option><option value="homematic"'+(w.msgSrc==='homematic'?' selected':'')+'>Homematic-CCU</option></select>')
      +(w.msgSrc==='homematic'?(
         row('CCU-IP','<input id="pMsgHmIP" value="'+esc(w.hmIP||'')+'" placeholder="z. B. 10.10.20.240">')
        +row('Bestätigen erlauben','<input type="checkbox" id="pMsgHmAck"'+(w.hmAck?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Haken je Meldung → CCU-Servicemeldung quittieren</span>')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Liest die Servicemeldungen (BidCos + HmIP) direkt von der CCU. Ist eine IP gesetzt, kann man im Live-Betrieb per Kopf-Umschalter zwischen Symcon und Homematic wechseln.</div>'
      ):'')
      +'<div class="pgh">Ansicht</div>'
      +row('Darstellung','<select id="pMsgView"><option value="list"'+(w.view!=='count'?' selected':'')+'>Liste</option><option value="count"'+(w.view==='count'?' selected':'')+'>Kompakt (nur Anzahl)</option></select>')
      +'<div class="pgh">Severity-Filter (Standard)</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px 12px">'+_SEVS.map(function(s){return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px"><input type="checkbox" data-sev="'+s+'"'+(_sevDef(w,s)?' checked':'')+'> <span style="color:'+_SEVCLR[s]+';font-weight:600">'+s+'</span></label>';}).join('')+'</div>'
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Im Live-Modus per Tipp auf die Pills umschaltbar (je Gerät gespeichert).</div>'
      +row('Neuen folgen','<input type="checkbox" id="pMsgAuto"'+(w.noAuto?'':' checked')+'> <span style="font-size:11px;color:var(--muted)">bei neuen Meldungen ans Ende scrollen (nur Symcon-Liste)</span>')
      +row('Max. Einträge','<input id="pMsgN" type="number" min="1" max="200" value="'+(w.max||25)+'">')
      +row('Aktualisierung (Sek.)','<input id="pMsgIv" type="number" min="1" max="600" value="'+(w.refreshSec||'')+'" placeholder="'+(bcfg().refreshSec||15)+' (global)">');},
    wire:function(w){
      if($('#pMsgSrc'))$('#pMsgSrc').onchange=function(){w.msgSrc=(this.value==='homematic')?'homematic':undefined;render();renderProps();fetchMsgs(w);commit();};
      if($('#pMsgHmIP'))$('#pMsgHmIP').onchange=function(){w.hmIP=this.value.trim()||undefined;render();fetchMsgs(w);commit();};
      if($('#pMsgHmAck'))$('#pMsgHmAck').onchange=function(){w.hmAck=this.checked?1:undefined;fetchMsgs(w);commit();};
      if($('#pMsgView'))$('#pMsgView').onchange=function(){w.view=(this.value==='count')?'count':undefined;render();fetchMsgs(w);commit();};
      $$('#props [data-sev]').forEach(function(cb){cb.onchange=function(){if(!w.sev){w.sev={};_SEVS.forEach(function(s){w.sev[s]=_sevDef(w,s)?1:0;});}w.sev[cb.getAttribute('data-sev')]=cb.checked?1:0;render();fetchMsgs(w);commit();};});
      if($('#pMsgAuto'))$('#pMsgAuto').onchange=function(){w.noAuto=this.checked?undefined:true;commit();};
      if($('#pMsgN'))$('#pMsgN').oninput=function(){w.max=parseInt(this.value)||25;render();fetchMsgs(w);commit();};
      if($('#pMsgIv'))$('#pMsgIv').oninput=function(){w.refreshSec=this.value===''?undefined:Math.max(1,Math.min(600,parseInt(this.value)||15));commit();};
    },
    mount:function(w){fetchMsgs(w);},
    click:function(w,el,e){
      var sw=e.target.closest('[data-msgsw]'); // Quelle live umschalten (in-place, KEIN globales render -> kein Flackern)
      if(sw){var cur=_msgSrc(w),nx=(cur==='homematic')?'symcon':'homematic';try{localStorage.setItem('lvmsgsrc_'+w.id,nx);}catch(_){}
        var sp=sw.querySelectorAll('span');if(sp[0])sp[0].classList.toggle('on',nx==='symcon');if(sp[1])sp[1].classList.toggle('on',nx==='homematic');
        var b0=$('[data-role=msgl]',el);if(b0){b0._sig=undefined;b0.innerHTML='<div class="hmsge">…</div>';b0.classList.remove('is-count');}
        fetchMsgs(w);return true;}
      var ab=e.target.closest('[data-hmack]'); // Homematic-Meldung bestätigen
      if(ab){var addr=ab.getAttribute('data-haddr'),type=ab.getAttribute('data-htype'),box=$('[data-role=msgl]',el);ab.disabled=true;
        fetch('?api=hmack&ip='+encodeURIComponent(w.hmIP||'')+'&addr='+encodeURIComponent(addr)+'&type='+encodeURIComponent(type)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
          .then(function(r){return r.json();}).then(function(j){if(j&&j.ok){toast('Bestätigt: '+type);}else{toast('Bestätigen fehlgeschlagen');ab.disabled=false;}if(box)box._sig=undefined;fetchMsgs(w);})
          .catch(function(){toast('Fehler beim Bestätigen');ab.disabled=false;});
        return true;}
      var chip=e.target.closest('[data-sevchip]'); // Severity live filtern
      if(!chip)return false;
      var s=chip.getAttribute('data-sevchip'),f=_msgFilter(w);f[s]=f[s]?0:1;
      try{localStorage.setItem('lvmsg_'+w.id,JSON.stringify(f));}catch(_){}
      chip.classList.toggle('off',!f[s]);fetchMsgs(w);return true;}
  });
  setInterval(function(){if(typeof state==='undefined'||!state.widgets)return;var now=Date.now(),gdef=((typeof bcfg==='function'&&bcfg().refreshSec)||15);
    function tick(w){if(!w||w.type!=='msglog')return;if(now-(w._lastAuto||0)>=(w.refreshSec||gdef)*1000){w._lastAuto=now;fetchMsgs(w);}}
    allWidgets().forEach(tick);
    if(typeof _tickKids!=='undefined'&&_tickKids)_tickKids.forEach(tick);
    if(typeof _popup!=='undefined'&&_popup&&_popup.widgets)_popup.widgets.forEach(tick);
  },1000);
