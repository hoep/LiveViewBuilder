  // ===== Widget: Meldungen (msglog) — IPS-Log ohne DEBUG, Severity + Farbpunkt =====
  var _SEVCLR={ERROR:'#f2685a',WARNING:'#f2b441',CUSTOM:'#c471ed',NOTIFY:'#4aa3ff',MESSAGE:'#8a97a0',SUCCESS:'#39d08a'};
  function fetchMsgs(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var box=$('[data-role=msgl]',el);if(!box)return;
    fetch('?api=messages&n=120',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var msgs=(j&&j.messages)||[];
      if(w.onlyErr)msgs=msgs.filter(function(m){return m.sev==='ERROR'||m.sev==='CUSTOM';});
      msgs=msgs.slice(0,w.max||25);
      if(!msgs.length){box.innerHTML='<div class="hmsge">Keine Meldungen</div>';return;}
      box.innerHTML=msgs.map(function(m){var c=_SEVCLR[m.sev]||'#8a97a0',tm=(m.t||'').slice(-8);
        return '<div class="hmsgi"><span class="hmsgdot" style="background:'+c+'"></span><span class="hmsgsev" style="color:'+c+'">'+esc(m.sev||'')+'</span><span class="hmsgtime">'+esc(tm)+'</span><span class="hmsgsrc">'+esc(m.src||'')+'</span><span class="hmsgm">'+esc(m.m||'')+'</span></div>';}).join('');
    }).catch(function(){box.innerHTML='<div class="hmsge" style="color:var(--crit)">Log nicht lesbar</div>';});
  }
  defWidget('msglog',{
    label:'Meldungen', paletteIcon:'wticker', size:[440,220],
    defaults:function(w){w.label='Meldungen';w.max=25;},
    render:function(w){return '<div class="hmsg"><div class="hmsgt">'+esc(w.label||'Meldungen')+'</div><div class="hmsgl" data-role="msgl"><div class="hmsge">…</div></div></div>';},
    props:function(w){return row('Nur Fehler','<input type="checkbox" id="pMsgErr"'+(w.onlyErr?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">ERROR + Modul (CUSTOM)</span>')
      +row('Max. Einträge','<input id="pMsgN" type="number" min="1" max="120" value="'+(w.max||25)+'">');},
    wire:function(w){
      if($('#pMsgErr'))$('#pMsgErr').onchange=function(){w.onlyErr=this.checked||undefined;render();fetchMsgs(w);commit();};
      if($('#pMsgN'))$('#pMsgN').oninput=function(){w.max=parseInt(this.value)||25;render();fetchMsgs(w);commit();};
    },
    mount:function(w){fetchMsgs(w);}
  });
  setInterval(function(){if(typeof state==='undefined'||!state.widgets)return;state.widgets.forEach(function(w){if(w.type==='msglog')fetchMsgs(w);});},15000);
