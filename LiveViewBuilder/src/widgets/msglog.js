  // ===== Widget: Meldungen (msglog) — IPS-Warnungen/Fehler (Mitschnitt seit Kernel-Start) =====
  function fetchMsgs(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var box=$('[data-role=msgl]',el);if(!box)return;
    fetch('?api=messages',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var msgs=(j&&j.messages)||[];if(w.onlyErr)msgs=msgs.filter(function(m){return m.k==='ERROR';});msgs=msgs.slice(0,w.max||20);
      if(!msgs.length){box.innerHTML='<div class="hmsge">Keine Warnungen/Fehler</div>';return;}
      box.innerHTML=msgs.map(function(m){var d=new Date((m.t||0)*1000),tm=('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
        return '<div class="hmsgi '+(m.k==='ERROR'?'err':'warn')+'"><span class="hmsgk">'+esc(m.k||'')+'</span><span class="hmsgtime">'+tm+'</span><span class="hmsgm">'+esc(m.m||'')+'</span></div>';}).join('');
    }).catch(function(){box.innerHTML='<div class="hmsge" style="color:var(--crit)">Meldungen nicht abrufbar</div>';});
  }
  defWidget('msglog',{
    label:'Meldungen', paletteIcon:'wticker', size:[380,200],
    defaults:function(w){w.label='Meldungen';w.max=20;},
    render:function(w){return '<div class="hmsg"><div class="hmsgt">'+esc(w.label||'Meldungen')+'</div><div class="hmsgl" data-role="msgl"><div class="hmsge">…</div></div></div>';},
    props:function(w){return row('Nur Fehler','<input type="checkbox" id="pMsgErr"'+(w.onlyErr?' checked':'')+'>')
      +row('Max. Einträge','<input id="pMsgN" type="number" min="1" value="'+(w.max||20)+'">');},
    wire:function(w){
      if($('#pMsgErr'))$('#pMsgErr').onchange=function(){w.onlyErr=this.checked||undefined;render();fetchMsgs(w);commit();};
      if($('#pMsgN'))$('#pMsgN').oninput=function(){w.max=parseInt(this.value)||20;render();fetchMsgs(w);commit();};
    },
    mount:function(w){fetchMsgs(w);}
  });
  setInterval(function(){if(typeof state==='undefined'||!state.widgets)return;state.widgets.forEach(function(w){if(w.type==='msglog')fetchMsgs(w);});},15000); // alle 15s aktualisieren
