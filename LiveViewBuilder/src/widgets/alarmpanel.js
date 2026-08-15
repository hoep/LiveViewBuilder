  // ===== Widget: Alarm-Panel — Container fuer Alarm-Karten =====
  //  Haelt seine Alarm-Karten als w.kids (echte, editierbare alarm-Widgets; lokale x/y werden
  //  ignoriert, das Panel legt sie als flex-wrap-Reihe). Kopf: rote Eyebrow („BRAUCHT
  //  AUFMERKSAMKEIT") + rechts „Alle quittieren". Nur AKTIVE Karten sind sichtbar (jede Karte
  //  blendet sich selbst aus, wenn ihre Bedingung nicht greift); ist keine aktiv, verschwindet
  //  das ganze Panel (oder zeigt eine „Keine Alarme"-Zeile). Quittung ist client-seitig und an
  //  die Signatur des Alarms gebunden: aendert sich der Zustand oder wird der Alarm zwischendurch
  //  inaktiv, taucht die Karte wieder auf (fail-safe, nicht persistent ueber Reload).
  //
  //  Schnittstelle zum alarm-Widget (defensiv abgefragt, Panel rendert auch ohne):
  //    WIDGETS.alarm.isActive(kid) -> bool   (Karte aktiv?)
  //    WIDGETS.alarm.severity(kid) -> 'crit'|'warn' (Sortierung: kritische zuerst)
  //    WIDGETS.alarm.sig(kid)      -> String (Zustands-Signatur fuer Quittungs-Re-Trigger)
  var _ALP_ACK={};   // panelId -> { kidId: sig }   (In-Memory, bewusst nicht persistent)
  function _alpActive(k){var A=WIDGETS.alarm;return !!(A&&A.isActive&&A.isActive(k));}
  function _alpSev(k){var A=WIDGETS.alarm;return (A&&A.severity)?A.severity(k):'warn';}
  function _alpSig(k){var A=WIDGETS.alarm;return (A&&A.sig)?A.sig(k):String((_lastVals[k&&k.varId]||{}).v);}
  function _alpAcked(pid,kid,sig){var m=_ALP_ACK[pid];return !!(m&&m[kid]!=null&&m[kid]===sig);}
  function _alpAckClear(pid,kid){if(_ALP_ACK[pid])delete _ALP_ACK[pid][kid];}
  function _alpAckAll(w){var m=_ALP_ACK[w.id]=(_ALP_ACK[w.id]||{});
    (w.kids||[]).forEach(function(k){if(k&&k.type==='alarm'&&_alpActive(k))m[k.id]=_alpSig(k);});
    if(w.ackVid)setVar(w.ackVid,w.ackVal!=null?w.ackVal:0); // optional: zusaetzlich eine Variable schreiben
  }
  function _alpKids(w){return (w.kids||[]).filter(function(k){return k&&k.type==='alarm';});}
  // aktive, NICHT quittierte Karten (Grundlage fuer „leer?" und Sichtbarkeit)
  function _alpShown(w){return _alpKids(w).filter(function(k){
    if(!_alpActive(k)){_alpAckClear(w.id,k.id);return false;}   // inaktiv -> Quittung verwerfen (Re-Trigger)
    return !(mode!=='edit'&&_alpAcked(w.id,k.id,_alpSig(k)));
  });}
  // Karten einhaengen: ALLE alarm-Kinder als echte, editierbare Widgets (Karte blendet sich
  // selbst aus, wenn inaktiv). Aufruf nach jedem render() aus der Render-Schleife (03).
  function expandAlarmPanel(w){
    var host=$('.w[data-id="'+w.id+'"] [data-role=alpbody]',canvas); if(!host)return;
    host.style.setProperty('--_alpgap',(w.gap!=null?w.gap:12)+'px');
    host.innerHTML='';
    var kids=_alpKids(w);
    if(w.sortSev!==false)kids=kids.slice().sort(function(a,b){return (_alpSev(b)==='crit'?1:0)-(_alpSev(a)==='crit'?1:0);}); // kritische zuerst
    kids.forEach(function(k){try{
      var ke=_mkWidgetEl(k);ke.classList.add('alp-card');ke.dataset.alp=w.id;
      ke.style.position='relative';ke.style.left='';ke.style.top='';ke.style.width='';ke.style.height=''; // Absolut -> Flow (relative: eigener Kontext fuer .winner inset:0)
      ke.style.setProperty('--_alpcw', ((k.w>0?k.w:300))+'px'); // Kartenbreite = eigene Widget-Breite des Alarms
      host.appendChild(ke);_contKids.push(k);                    // _contKids: mount + live + poll wie Container-Kinder
    }catch(e){}});
    _alpRefresh(w);
    _alpMount(w); // Chevron-Blaettern + Mausrad-Scroll verdrahten (idempotent)
    // Nach dem Run-Boot wird mode erst NACH switchView auf 'preview' gesetzt; ein deferred Refresh
    // zieht Leer-/OK-/Verstecken-Zustand auch ohne Live-Tick nach (z. B. leeres Panel, unbelegte Kinder).
    setTimeout(function(){_alpRefresh(w);},0);
  }
  // Quittungs-Klassen + Leer-Zustand nachziehen (aus expandAlarmPanel und aus live()).
  function _alpRefresh(w){
    var wel=$('.w[data-id="'+w.id+'"]',canvas);
    var empty=$('.w[data-id="'+w.id+'"] [data-role=alpempty]',canvas);
    _alpKids(w).forEach(function(k){var ke=$('.w[data-id="'+k.id+'"]',canvas);if(!ke)return;
      if(!_alpActive(k))_alpAckClear(w.id,k.id);
      var acked=(mode!=='edit')&&_alpAcked(w.id,k.id,_alpSig(k));
      ke.classList.toggle('alp-acked',!!acked);
    });
    var isEmpty=(mode!=='edit'&&_alpShown(w).length===0);
    // Panel bleibt IMMER sichtbar (nie verstecken). Leer -> OK-Zustand (gruen), optional
    // „Keine Alarme"-Zeile. Gilt auch nach „Alle quittieren" (Alarme noch aktiv, nur quittiert).
    var ackedEmpty=isEmpty&&_alpKids(w).some(_alpActive);
    var em=(!ackedEmpty&&w.emptyMode==='note')?'note':'ok';
    var okEl=$('.w[data-id="'+w.id+'"] [data-role=alpok]',canvas);
    var eyeEl=$('.w[data-id="'+w.id+'"] .alp-eye',canvas);
    var rwrap=$('.w[data-id="'+w.id+'"] .alp-rowwrap',canvas);
    if(empty)empty.style.display=(isEmpty&&em==='note')?'':'none';
    if(okEl){okEl.style.display=(isEmpty&&em==='ok')?'':'none';var okt=$('.alp-ok-tx',okEl);if(okt)okt.textContent=(w.okText||'Alles in Ordnung');}
    if(rwrap)rwrap.style.display=(isEmpty&&(em==='ok'||em==='note'))?'none':''; // leere Karten-Reihe wegnehmen
    if(wel){wel.classList.toggle('alarm-off', isEmpty&&em==='hide'); wel.classList.toggle('alp-allok', isEmpty&&em==='ok');} // ok: Panel bleibt, gruen
    if(eyeEl){var okState=(isEmpty&&em==='ok');eyeEl.textContent=okState?(w.okEyebrow||'ALLES OK'):(w.eyebrow||'');
      eyeEl.style.setProperty('--_alpeye', okState?'var(--ok)':(_cssColorOrEmpty(w.eyeColor)||'var(--crit)'));}
    _alpScrollSync(w); // Chevrons je nach Scrollposition
  }
  // Chevron links/rechts je nach horizontaler Scrollposition der Karten-Reihe ein-/ausblenden.
  function _alpScrollSync(w){
    var wrap=$('.w[data-id="'+w.id+'"] .alp-rowwrap',canvas); if(!wrap)return;
    var row=$('[data-role=alpbody]',wrap); if(!row)return;
    var more=(row.scrollWidth-row.clientWidth-row.scrollLeft)>4, prev=row.scrollLeft>4;
    wrap.classList.toggle('has-more',more); wrap.classList.toggle('has-prev',prev);
  }
  // Karten-Reihe scrollbar machen: Chevrons klickbar (blaettern) + Mausrad vertikal -> horizontal.
  function _alpMount(w){
    var wrap=$('.w[data-id="'+w.id+'"] .alp-rowwrap',canvas); if(!wrap)return;
    var row=$('[data-role=alpbody]',wrap); if(!row||row._alpWired)return; row._alpWired=1;
    row.addEventListener('wheel',function(e){
      if(mode==='edit')return; if(row.scrollWidth<=row.clientWidth+2)return;
      var d=(Math.abs(e.deltaY)>=Math.abs(e.deltaX))?e.deltaY:e.deltaX; if(!d)return;
      row.scrollLeft+=d; e.preventDefault();
    },{passive:false});
    row.addEventListener('scroll',function(){_alpScrollSync(w);});
    var pg=function(dir){var step=Math.max(160,row.clientWidth*0.8);row.scrollBy({left:dir*step,behavior:'smooth'});};
    var mr=$('[data-role=alpmore]',wrap),ml=$('[data-role=alpmoreL]',wrap);
    if(mr)mr.addEventListener('click',function(){pg(1);});
    if(ml)ml.addEventListener('click',function(){pg(-1);});
    setTimeout(function(){_alpScrollSync(w);},0);
  }
  defWidget('alarmpanel',{
    label:'Alarm-Panel', paletteIcon:'bell', size:[900,132], noHover:true,
    defaults:function(w){w.kids=w.kids||[];w.eyebrow='BRAUCHT AUFMERKSAMKEIT';w.eyeColor='crit';w.ackAll=true;w.ackText='Alle quittieren';w.sortSev=true;w.emptyMode='ok';w.emptyText='Keine Alarme';w.okText='Alles in Ordnung';w.okEyebrow='ALLES OK';w.gap=12;},
    render:function(w){
      var eye=_cssColorOrEmpty(w.eyeColor)||'var(--crit)';
      var head='<div class="alp-head"><div class="alp-eye" style="--_alpeye:'+eye+'">'+escL(w.eyebrow||'')+'</div>'
        +((w.ackAll!==false)?'<button class="alp-ackall" data-role="ackall">'+escL(w.ackText||'Alle quittieren')+'</button>':'')+'</div>';
      return '<div class="alarmpanel" data-role="alphost">'+head
        +'<div class="alp-rowwrap"><div class="alp-row" data-role="alpbody"></div>'
        +'<div class="alp-more alp-more-l" data-role="alpmoreL"><svg viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1L2 6l5 5"/></svg></div>'
        +'<div class="alp-more" data-role="alpmore"><svg viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l5 5-5 5"/></svg></div></div>'
        +'<div class="alp-empty" data-role="alpempty" style="display:none">'+escL(w.emptyText||'Keine Alarme')+'</div>'
        +'<div class="alp-ok" data-role="alpok" style="display:none"><span class="alp-ok-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span><span class="alp-ok-tx">'+escL(w.okText||'Alles in Ordnung')+'</span></div></div>';
    },
    live:function(w,el,id,d,base,txt,on){_alpRefresh(w);return true;}, // feuert bei jeder Kind-Variablen-Aenderung (siehe widgetDataId-Kernhaken)
    click:function(w,el,e){if(e.target.closest('[data-role=ackall]')){if(mode==='edit')return true;_alpAckAll(w);_alpRefresh(w);return true;}return false;},
    props:function(w){if(w.type!=='alarmpanel')return '';
      var s=row('Eyebrow','<input id="pAlpEye" value="'+esc(w.eyebrow||'')+'">')
        +row('Eyebrow-Farbe',skinSel(w.eyeColor,'id="pAlpEyeC"'))
        +row('„Alle quittieren"','<input type="checkbox" id="pAlpAck"'+(w.ackAll!==false?' checked':'')+'>')
        +((w.ackAll!==false)?(row('Text','<input id="pAlpAckT" value="'+esc(w.ackText||'')+'">')
          +fieldPick(w,'ackVid','Quittier-Variable (optional)')
          +(w.ackVid?row('Quittier-Wert','<input id="pAlpAckV" type="number" step="any" value="'+(w.ackVal!=null?w.ackVal:0)+'">'):'')):'')
        +row('Kritische zuerst','<input type="checkbox" id="pAlpSort"'+(w.sortSev!==false?' checked':'')+'>')
        +row('Abstand (px)','<input id="pAlpGap" type="number" min="0" style="width:70px" value="'+(w.gap!=null?w.gap:12)+'">')
        +row('Wenn leer','<select id="pAlpEmpty">'
           +'<option value="ok"'+(w.emptyMode!=='note'?' selected':'')+'>Grüner OK-Zustand</option>'
           +'<option value="note"'+(w.emptyMode==='note'?' selected':'')+'>„Keine Alarme"-Zeile</option></select>'
           +'<div style="font-size:11px;color:var(--muted);margin:2px 2px">Das Panel bleibt immer sichtbar.</div>')
        +((w.emptyMode==='note')?row('Leer-Text','<input id="pAlpEmptyT" value="'+esc(w.emptyText||'')+'">'):'')
        +((w.emptyMode==='ok')?(row('OK-Text','<input id="pAlpOkT" value="'+esc(w.okText||'Alles in Ordnung')+'">')+row('OK-Eyebrow','<input id="pAlpOkE" value="'+esc(w.okEyebrow||'ALLES OK')+'">')):'')
        +'<div style="font-size:11px;color:var(--muted);margin:6px 2px">'+((w.kids&&w.kids.length)||0)+' Alarm-Karte(n). Ein <b>Alarm</b>-Widget in dieses Panel ziehen; inaktive Karten werden im Betrieb ausgeblendet.</div>';
      return s;
    },
    wire:function(w){
      if($('#pAlpEye'))$('#pAlpEye').oninput=function(){w.eyebrow=this.value;render();};
      if($('#pAlpEyeC'))$('#pAlpEyeC').onchange=function(){w.eyeColor=this.value||undefined;render();commit();};
      if($('#pAlpAck'))$('#pAlpAck').onchange=function(){w.ackAll=this.checked;render();renderProps();commit();};
      if($('#pAlpAckT'))$('#pAlpAckT').oninput=function(){w.ackText=this.value||undefined;render();};
      if($('#pAlpAckV'))$('#pAlpAckV').oninput=function(){w.ackVal=this.value===''?undefined:parseFloat(this.value);commit();};
      if($('#pAlpSort'))$('#pAlpSort').onchange=function(){w.sortSev=this.checked;render();commit();};
      if($('#pAlpGap'))$('#pAlpGap').oninput=function(){w.gap=this.value===''?undefined:(parseInt(this.value)||0);render();commit();};
      if($('#pAlpEmpty'))$('#pAlpEmpty').onchange=function(){w.emptyMode=this.value;render();renderProps();commit();};
      if($('#pAlpEmptyT'))$('#pAlpEmptyT').oninput=function(){w.emptyText=this.value||undefined;render();};
      if($('#pAlpOkT'))$('#pAlpOkT').oninput=function(){w.okText=this.value||undefined;render();};
      if($('#pAlpOkE'))$('#pAlpOkE').oninput=function(){w.okEyebrow=this.value||undefined;render();};
    }
  });
