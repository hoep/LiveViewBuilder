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
      ke.style.position='relative';ke.style.left='';ke.style.top='';ke.style.width='';ke.style.height=''; // Absolut -> Grid-Item (relative: eigener Kontext fuer .winner inset:0)
      host.appendChild(ke);_contKids.push(k);                    // _contKids: mount + live + poll wie Container-Kinder
    }catch(e){}});
    _alpRefresh(w);
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
    var noteMode=(w.emptyMode==='note');
    if(empty)empty.style.display=(isEmpty&&noteMode)?'':'none';
    if(wel)wel.classList.toggle('alarm-off', isEmpty&&!noteMode); // hide-wenn-leer: ganzes Panel weg
    // Chevron rechts einblenden, wenn die Karten-Reihe horizontal ueberlaeuft (mehr Meldungen).
    var wrap=$('.w[data-id="'+w.id+'"] .alp-rowwrap',canvas), row=$('.w[data-id="'+w.id+'"] [data-role=alpbody]',canvas);
    if(wrap&&row)wrap.classList.toggle('has-more', (row.scrollWidth-row.clientWidth)>4);
  }
  defWidget('alarmpanel',{
    label:'Alarm-Panel', paletteIcon:'bell', size:[900,132], noHover:true,
    defaults:function(w){w.kids=w.kids||[];w.eyebrow='BRAUCHT AUFMERKSAMKEIT';w.eyeColor='crit';w.ackAll=true;w.ackText='Alle quittieren';w.sortSev=true;w.emptyMode='hide';w.emptyText='Keine Alarme';w.gap=12;},
    render:function(w){
      var eye=_cssColorOrEmpty(w.eyeColor)||'var(--crit)';
      var head='<div class="alp-head"><div class="alp-eye" style="--_alpeye:'+eye+'">'+escL(w.eyebrow||'')+'</div>'
        +((w.ackAll!==false)?'<button class="alp-ackall" data-role="ackall">'+escL(w.ackText||'Alle quittieren')+'</button>':'')+'</div>';
      return '<div class="alarmpanel" data-role="alphost">'+head
        +'<div class="alp-rowwrap"><div class="alp-row" data-role="alpbody"></div>'
        +'<div class="alp-more" data-role="alpmore"><svg viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l5 5-5 5"/></svg></div></div>'
        +'<div class="alp-empty" data-role="alpempty" style="display:none">'+escL(w.emptyText||'Keine Alarme')+'</div></div>';
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
        +row('Wenn leer','<select id="pAlpEmpty"><option value="hide"'+((w.emptyMode||'hide')!=='note'?' selected':'')+'>Panel verstecken</option><option value="note"'+(w.emptyMode==='note'?' selected':'')+'>„Keine Alarme"-Zeile</option></select>')
        +((w.emptyMode==='note')?row('Leer-Text','<input id="pAlpEmptyT" value="'+esc(w.emptyText||'')+'">'):'')
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
    }
  });
