  // ===== Widget: Alarm (regelgesteuerte Karte) =====
  //  Zeigt EINE Meldung als abgerundete, getoente Karte (Icon-Box + fetter Titel + gedaempfte
  //  Unterzeile) — genau dann, wenn eine Bedingung erfuellt ist; sonst blendet sie sich aus
  //  (nimmt keinen Platz). Die Bedingung vergleicht eine Variable gegen eine Konstante, gegen
  //  eine zweite Variable oder gegen eine Vergleichsliste (stateHit: Operatoren/Bereiche/*).
  //  Skin-Farbe (crit/warn/…) toent Karte + Icon-Box. Titel/Unterzeile duerfen =Formeln sein
  //  (#id + Literale mit dem Punkt); {seit} in der Unterzeile wird zu „seit HH:MM" der Quelle.
  //  Das isActive-Signal (WIDGETS.alarm.isActive) nutzt das alarmpanel, um nur aktive Karten
  //  zu zeigen; severity()/sig() steuern Sortierung und Quittungs-Re-Trigger.
  function _acNum(idOrExpr){                       // Wert einer Bedingungsquelle -> Zahl|null
    if(_fIsFormula(idOrExpr))return _fEvalNum(idOrExpr);
    var d=idOrExpr&&_lastVals[idOrExpr];if(!d)return null;
    var n=parseFloat(String(d.v).replace(',','.'));return isNaN(n)?null:n;
  }
  function _acRaw(src){                             // Rohwert (String/Zahl) fuer stateHit
    if(_fIsFormula(src))return _fEvalNum(src);
    var d=src&&_lastVals[src];return d?d.v:null;
  }
  function alarmIsActive(w){
    if(!w)return false;
    if(w.condMode==='list'){
      if(!(w.vassoc&&w.vassoc.length))return false;
      return !!stateHit(w.vassoc,_acRaw(w.varId));
    }
    var a=_acNum(w.varId);
    var b=(w.condMode==='var')?_acNum(w.varId2):((w.thr!=null&&w.thr!=='')?+w.thr:null);
    if(a==null||b==null)return false;
    switch(w.op){case '<':return a<b;case '<=':return a<=b;case '==':return a===b;
      case '!=':return a!==b;case '>=':return a>=b;default:return a>b;}
  }
  function alarmSeverity(w){var c=String((w&&w.color)||'').toLowerCase();return (/crit|fehler|error|alarm/.test(c))?'crit':'warn';}
  function alarmSig(w){                             // Signatur des aktuellen Zustands
    var d=w&&w.varId&&_lastVals[w.varId];
    if(d)return String(d.v);
    var n=_acNum(w&&w.varId);return n==null?'':String(n);
  }
  function _acColor(w){
    var col=_cssColorOrEmpty(w.color)||'var(--warn)';
    if(w.condMode==='list'&&w.vassoc&&w.vassoc.length){var m=stateHit(w.vassoc,_acRaw(w.varId));if(m&&m.color){var c2=_cssColorOrEmpty(m.color);if(c2)col=c2;}}
    return col;
  }
  function _acHHMM(ms){var d=new Date(ms);function p(n){return (n<10?'0':'')+n;}return p(d.getHours())+':'+p(d.getMinutes());}
  function _acStr(s,w){                             // Titel/Unterzeile: Klartext ODER =Formel, dann {seit}
    if(s==null||s==='')return '';
    var out=s;
    if(_fIsFormula(s)){var r=_fEvalStr(s);out=(r==null)?'':r;}
    if(out.indexOf('{seit}')>=0){var t=(w&&w.varId)?changedAt(w.varId):0;out=out.replace(/\{seit\}/g,t?('seit '+_acHHMM(t)):'');}
    return out;
  }
  function _acPaint(w,el){                          // idempotent: Aktiv/Hide + Toenung + Text
    if(!el)return;
    var active=alarmIsActive(w);
    el.classList.toggle('alarm-off', mode!=='edit' && !active);
    var col=_acColor(w),t=stateTint(col);
    el.style.setProperty('--_atbg',t.bg);el.style.setProperty('--_atbd',t.bd);
    el.style.setProperty('--_atchip',t.chip);el.style.setProperty('--_atic',col);
    el.style.setProperty('--_atttl',t.val);el.style.setProperty('--_atsub',t.lab);
    var tt=$('[data-role=ttl]',el);if(tt)tt.textContent=_acStr(w.title,w);
    var su=$('[data-role=sub]',el);if(su){var sx=_acStr(w.sub,w);su.textContent=sx;su.style.display=sx?'':'none';}
    if(w.notify!=null&&w.notify!=='')el.setAttribute('data-notify',_acStr(w.notify,w)); // reines Feld — KEIN Push
  }
  defWidget('alarm',{
    label:'Alarm', paletteIcon:'bell', size:[300,64], noHover:true,
    defaults:function(w){w.condMode='const';w.op='>';w.thr=0;w.color='warn';w.icon='bell';w.title='Alarm';},
    isActive:alarmIsActive, severity:alarmSeverity, sig:alarmSig,
    render:function(w){
      return '<div class="halarm" data-role="card">'
        +'<span class="halarm-ico" data-role="ico">'+iconSVG(w.icon||'bell')+'</span>'
        +'<div class="halarm-tx"><div class="halarm-ttl" data-role="ttl">'+escL(w.title||'')+'</div>'
        +'<div class="halarm-sub" data-role="sub">'+escL(w.sub||'')+'</div></div></div>';
    },
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_acPaint(w,el);},
    live:function(w,el,id,d,base,txt,on){_acPaint(w,el);return true;},
    props:function(w){if(w.type!=='alarm')return '';
      var OPS=['<','<=','==','!=','>=','>'];
      var s='<div style="font-size:11px;color:var(--muted);margin:0 2px 6px">Quelle der Bedingung = das Feld <b>Variable</b> oben (ID oder =Formel).</div>'
        +row('Bedingung','<select id="pAcMode">'+[['const','Variable vs. Konstante'],['var','Variable vs. Variable'],['list','Vergleichsliste']].map(function(o){return '<option value="'+o[0]+'"'+((w.condMode||'const')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>');
      if((w.condMode||'const')==='const'){
        s+=row('Operator','<select id="pAcOp">'+OPS.map(function(o){return '<option'+((w.op||'>')===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select>')
          +row('Schwelle','<input id="pAcThr" type="number" step="any" value="'+(w.thr!=null?w.thr:'')+'">');
      }else if(w.condMode==='var'){
        s+=row('Operator','<select id="pAcOp">'+OPS.map(function(o){return '<option'+((w.op||'>')===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select>')
          +fieldPick(w,'varId2','Vergleichs-Variable');
      }else{
        s+='<div style="font-size:11px;color:var(--muted);margin:4px 2px">Trifft eine Zeile → Alarm aktiv. Operatoren (&gt;50, !=0), Bereiche (25..60), Platzhalter (*, else). Farbe der Zeile toent die Karte.</div>'
          +listEditor(w,'vassoc','Wert · Farbe',[{k:'v',ph:'z. B. >50'},{k:'color',type:'skincolor'}]);
      }
      s+='<div class="pgh">Darstellung</div>'
        +row('Farbe (Skin)',skinSel(w.color,'id="pAcCol"'))
        +row('Titel','<input id="pAcTtl" value="'+esc(w.title||'')+'" placeholder="=#33962.&quot; Sensor-Alarme&quot;">')
        +row('Unterzeile','<input id="pAcSub" value="'+esc(w.sub||'')+'" placeholder="Rauchmelder Leonie · {seit}">')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Formel möglich (=…, #id + Text mit dem Punkt). <b>{seit}</b> = „seit HH:MM" der Bedingungs-Variable.</div>'
        +row('Benachrichtigung','<input id="pAcNot" value="'+esc(w.notify||'')+'" placeholder="Text (Formel möglich) — kein Push">');
      return s;
    },
    wire:function(w){
      function repaint(){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_acPaint(w,el);}
      if($('#pAcMode'))$('#pAcMode').onchange=function(){w.condMode=this.value;render();renderProps();commit();};
      if($('#pAcOp'))$('#pAcOp').onchange=function(){w.op=this.value;repaint();commit();};
      if($('#pAcThr'))$('#pAcThr').oninput=function(){w.thr=this.value===''?undefined:parseFloat(this.value);repaint();commit();};
      if($('#pAcCol'))$('#pAcCol').onchange=function(){w.color=this.value||undefined;repaint();commit();};
      if($('#pAcTtl'))$('#pAcTtl').oninput=function(){w.title=this.value||undefined;repaint();commit();};
      if($('#pAcSub'))$('#pAcSub').oninput=function(){w.sub=this.value||undefined;repaint();commit();};
      if($('#pAcNot'))$('#pAcNot').oninput=function(){w.notify=this.value||undefined;commit();};
    }
  });
