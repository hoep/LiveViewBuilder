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
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var box=$('[data-role=msgl]',el);if(!box)return;
    var f=_msgFilter(w);
    fetch('?api=messages&n=120',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var msgs=((j&&j.messages)||[]).filter(function(m){return f[m.sev];}).slice(0,w.max||25);
      if(!msgs.length){box.innerHTML='<div class="hmsge">Keine Meldungen</div>';return;}
      box.innerHTML=msgs.map(function(m){var c=_SEVCLR[m.sev]||'#8a97a0',tm=(m.t||'').slice(-8);
        return '<div class="hmsgi"><span class="hmsgdot" style="background:'+c+'"></span><span class="hmsgsev" style="color:'+c+'">'+esc(m.sev||'')+'</span><span class="hmsgtime">'+esc(tm)+'</span><span class="hmsgsrc">'+esc(m.src||'')+'</span><span class="hmsgm">'+esc(m.m||'')+'</span></div>';}).join('');
    }).catch(function(){box.innerHTML='<div class="hmsge" style="color:var(--crit)">Log nicht lesbar</div>';});
  }
  defWidget('msglog',{
    label:'Meldungen', paletteIcon:'wticker', size:[460,230],
    defaults:function(w){w.label='Meldungen';w.max=25;},
    render:function(w){return '<div class="hmsg"><div class="hmsgtop"><span class="hmsgt">'+esc(w.label||'Meldungen')+'</span><span class="hmsgchips">'+_chips(w)+'</span></div><div class="hmsgl" data-role="msgl"><div class="hmsge">…</div></div></div>';},
    props:function(w){return '<div class="pgh">Standard-Filter (Builder)</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px 12px">'+_SEVS.map(function(s){return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px"><input type="checkbox" data-sev="'+s+'"'+(_sevDef(w,s)?' checked':'')+'> <span style="color:'+_SEVCLR[s]+';font-weight:600">'+s+'</span></label>';}).join('')+'</div>'
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Im Live-Modus per Tipp auf die Pills umschaltbar (je Gerät gespeichert).</div>'
      +row('Auto-Scroll','<input type="checkbox" id="pMsgAuto"'+(w.noAuto?'':' checked')+'>')
      +row('Max. Einträge','<input id="pMsgN" type="number" min="1" max="120" value="'+(w.max||25)+'">');},
    wire:function(w){
      $$('#props [data-sev]').forEach(function(cb){cb.onchange=function(){if(!w.sev){w.sev={};_SEVS.forEach(function(s){w.sev[s]=_sevDef(w,s)?1:0;});}w.sev[cb.getAttribute('data-sev')]=cb.checked?1:0;render();fetchMsgs(w);commit();};});
      if($('#pMsgAuto'))$('#pMsgAuto').onchange=function(){w.noAuto=this.checked?undefined:true;commit();};
      if($('#pMsgN'))$('#pMsgN').oninput=function(){w.max=parseInt(this.value)||25;render();fetchMsgs(w);commit();};
    },
    mount:function(w){fetchMsgs(w);},
    click:function(w,el,e){var chip=e.target.closest('[data-sevchip]');if(!chip)return false; // Live-Umschaltung der Severity
      var s=chip.getAttribute('data-sevchip'),f=_msgFilter(w);f[s]=f[s]?0:1;
      try{localStorage.setItem('lvmsg_'+w.id,JSON.stringify(f));}catch(_){}
      chip.classList.toggle('off',!f[s]);fetchMsgs(w);return true;}
  });
  setInterval(function(){if(typeof state==='undefined'||!state.widgets)return;state.widgets.forEach(function(w){if(w.type==='msglog')fetchMsgs(w);});},15000);
  // Bei Berührung/Klick auf die Liste Auto-Scroll kurz pausieren
  function _msgTouch(e){var b=e.target&&e.target.closest&&e.target.closest('[data-role=msgl]');if(b)b._touch=Date.now();}
  document.addEventListener('touchstart',_msgTouch,{passive:true});document.addEventListener('mousedown',_msgTouch,true);
  // Auto-Scroll durch die Liste (pausiert bei Hover/Berührung), loopt am Ende
  setInterval(function(){if(typeof state==='undefined'||!state.widgets)return;var now=Date.now();
    state.widgets.forEach(function(w){if(w.type!=='msglog'||w.noAuto)return;var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var b=$('[data-role=msgl]',el);if(!b)return;
      if(b.scrollHeight-b.clientHeight<=2)return; if(b._touch&&now-b._touch<5000)return; try{if(b.matches(':hover'))return;}catch(_){}
      if(b.scrollTop+b.clientHeight>=b.scrollHeight-1){b._pause=(b._pause||0)+1;if(b._pause>25){b._pause=0;b.scrollTop=0;}} // am Ende kurz halten, dann hoch
      else{b._pause=0;b.scrollTop+=1;}
    });
  },70);
