  // ===== Widget: Meldungen (msglog) — IPS-Log ohne DEBUG, Severity-Filter (im Run per Chip umschaltbar) + Farbpunkt =====
  var _SEVCLR={ERROR:'#f2685a',WARNING:'#f2b441',CUSTOM:'#c471ed',NOTIFY:'#4aa3ff',MESSAGE:'#8a97a0',SUCCESS:'#39d08a'};
  var _SEVS=['ERROR','WARNING','CUSTOM','NOTIFY','MESSAGE','SUCCESS'];
  function _sevDef(w,s){if(!w.sev)return (s==='ERROR'||s==='WARNING'||s==='CUSTOM');return !!w.sev[s];} // Default/Builder-Filter
  function _msgFilter(w){ // effektiv: im Run zuerst Laufzeit-Override (localStorage), sonst Builder-Default
    if(typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvmsg_'+w.id);if(o){var j=JSON.parse(o);if(j)return j;}}catch(e){}}
    var f={};_SEVS.forEach(function(s){f[s]=_sevDef(w,s)?1:0;});return f;
  }
  function _chips(w){var f=_msgFilter(w);return _SEVS.map(function(s){return '<span class="hmsgchip'+(f[s]?'':' off')+'" data-sevchip="'+s+'" style="--cc:'+_SEVCLR[s]+'">'+s+'</span>';}).join('');}
  function fetchMsgs(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el){var oc=document.getElementById('ovcanvas');if(oc)el=$('.w[data-id="'+w.id+'"]',oc);} // auch Popup-#ovcanvas
    if(!el)return;var box=$('[data-role=msgl]',el);if(!box)return;
    var f=_msgFilter(w);
    var sevOn=_SEVS.filter(function(s){return f[s];});
    if(!sevOn.length){box.innerHTML='<div class="hmsge">Keine Kategorie aktiv</div>';box._sig='none';return;}
    // Server durchsucht das Log rückwärts und liefert die letzten max Treffer DIESER Kategorien (zeitunabhängig)
    fetch('?api=messages&n='+(w.max||25)+'&sev='+encodeURIComponent(sevOn.join(',')),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var msgs=((j&&j.messages)||[]).filter(function(m){return f[m.sev];}).slice(0,w.max||25).reverse(); // chronologisch: neueste unten
      var sig=msgs.map(function(m){return m.t+m.m;}).join('|');
      if(box._sig===sig)return; // nichts Neues -> NICHT neu zeichnen (kein Scroll-Ruckeln)
      var wasBottom=(box._sig===undefined)||(box.scrollTop+box.clientHeight>=box.scrollHeight-6);
      box._sig=sig;
      if(!msgs.length){box.innerHTML='<div class="hmsge">Keine Meldungen</div>';return;}
      box.innerHTML=msgs.map(function(m){var c=_SEVCLR[m.sev]||'#8a97a0',tm=(m.t||'').slice(-8);
        return '<div class="hmsgi"><span class="hmsgdot" style="background:'+c+'"></span><span class="hmsgsev" style="color:'+c+'">'+esc(m.sev||'')+'</span><span class="hmsgtime">'+esc(tm)+'</span><span class="hmsgsrc">'+esc(m.src||'')+'</span><span class="hmsgm">'+esc(m.m||'')+'</span></div>';}).join('');
      if(!w.noAuto&&wasBottom)box.scrollTop=box.scrollHeight; // neuen Meldungen folgen, nur wenn man unten ist
    }).catch(function(){box.innerHTML='<div class="hmsge" style="color:var(--crit)">Log nicht lesbar</div>';});
  }
  defWidget('msglog',{
    label:'Meldungen', paletteIcon:'wticker', size:[460,230], noHover:true, // Chips klicken intern -> kein Ganz-Widget-Hover
    defaults:function(w){w.label='Meldungen';w.max=25;},
    render:function(w){return '<div class="hmsg"><div class="hmsgtop"><span class="hmsgt">'+esc(w.label||'Meldungen')+'</span><span class="hmsgchips">'+_chips(w)+'</span></div><div class="hmsgl" data-role="msgl"><div class="hmsge">…</div></div></div>';},
    props:function(w){return '<div class="pgh">Standard-Filter (Builder)</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px 12px">'+_SEVS.map(function(s){return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px"><input type="checkbox" data-sev="'+s+'"'+(_sevDef(w,s)?' checked':'')+'> <span style="color:'+_SEVCLR[s]+';font-weight:600">'+s+'</span></label>';}).join('')+'</div>'
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Im Live-Modus per Tipp auf die Pills umschaltbar (je Gerät gespeichert).</div>'
      +row('Neuen folgen','<input type="checkbox" id="pMsgAuto"'+(w.noAuto?'':' checked')+'> <span style="font-size:11px;color:var(--muted)">bei neuen Meldungen ans Ende scrollen (Tail)</span>')
      +row('Max. Einträge','<input id="pMsgN" type="number" min="1" max="120" value="'+(w.max||25)+'">')
      +row('Aktualisierung (Sek.)','<input id="pMsgIv" type="number" min="1" max="600" value="'+(w.refreshSec||'')+'" placeholder="'+(bcfg().refreshSec||15)+' (global)">');},
    wire:function(w){
      $$('#props [data-sev]').forEach(function(cb){cb.onchange=function(){if(!w.sev){w.sev={};_SEVS.forEach(function(s){w.sev[s]=_sevDef(w,s)?1:0;});}w.sev[cb.getAttribute('data-sev')]=cb.checked?1:0;render();fetchMsgs(w);commit();};});
      if($('#pMsgAuto'))$('#pMsgAuto').onchange=function(){w.noAuto=this.checked?undefined:true;commit();};
      if($('#pMsgN'))$('#pMsgN').oninput=function(){w.max=parseInt(this.value)||25;render();fetchMsgs(w);commit();};
      if($('#pMsgIv'))$('#pMsgIv').oninput=function(){w.refreshSec=this.value===''?undefined:Math.max(1,Math.min(600,parseInt(this.value)||15));commit();};
    },
    mount:function(w){fetchMsgs(w);},
    click:function(w,el,e){var chip=e.target.closest('[data-sevchip]');if(!chip)return false; // Live-Umschaltung der Severity
      var s=chip.getAttribute('data-sevchip'),f=_msgFilter(w);f[s]=f[s]?0:1;
      try{localStorage.setItem('lvmsg_'+w.id,JSON.stringify(f));}catch(_){}
      chip.classList.toggle('off',!f[s]);fetchMsgs(w);return true;}
  });
  // Basis-Tick 1 s; jedes msglog aktualisiert gemäß eigenem refreshSec, sonst globaler Vorgabe (bcfg().refreshSec). Deckt Haupt-, Ticker- und Popup-Widgets ab.
  setInterval(function(){if(typeof state==='undefined'||!state.widgets)return;var now=Date.now(),gdef=((typeof bcfg==='function'&&bcfg().refreshSec)||15);
    function tick(w){if(!w||w.type!=='msglog')return;if(now-(w._lastAuto||0)>=(w.refreshSec||gdef)*1000){w._lastAuto=now;fetchMsgs(w);}}
    state.widgets.forEach(tick);
    if(typeof _tickKids!=='undefined'&&_tickKids)_tickKids.forEach(tick);
    if(typeof _popup!=='undefined'&&_popup&&_popup.widgets)_popup.widgets.forEach(tick);
  },1000);
