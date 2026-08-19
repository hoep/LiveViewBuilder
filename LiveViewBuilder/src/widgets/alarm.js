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
  // Restzeit eines Unix-Zeitstempels in Sekunden: POSITIV = liegt in der Zukunft,
  // NEGATIV = ist vorbei. Null, wenn die Quelle nichts Brauchbares liefert.
  // Akzeptiert Sekunden UND Millisekunden - Symcon liefert Sekunden, andere Quellen
  // Millisekunden; eine Sekundenangabe jenseits des Jahres 5138 ist zuverlaessig ms.
  function _acRest(src){
    var raw=_acRaw(src);
    var t=parseFloat(String(raw==null?'':raw).replace(',','.'));
    if(isNaN(t)||t<=0)return null;
    if(t>1e11)t=t/1000;
    return Math.round(t-Date.now()/1000);
  }
  // Restzeit als Klartext: "in 2 Tagen", "in 12 Stunden", "vor 3 Tagen".
  // Die Einheit richtet sich nach der Groesse, nicht nach einer Vorliebe - was jemand sagen
  // wuerde, der auf den Kalender schaut. Unter einer Minute wird nicht gezaehlt.
  function _acFrist(sec){
    if(sec==null)return '';
    var v=Math.abs(sec), vor=sec<0, n, ein, viele;
    if(v<60){return 'jetzt';}
    else if(v<3600)     {n=Math.round(v/60);       ein='Minute'; viele='Minuten';}
    else if(v<86400)    {n=Math.round(v/3600);     ein='Stunde'; viele='Stunden';}
    else if(v<86400*14) {n=Math.round(v/86400);    ein='Tag';    viele='Tagen';}
    else if(v<86400*61) {n=Math.round(v/(86400*7));ein='Woche';  viele='Wochen';}
    else if(v<86400*365){n=Math.round(v/(86400*30.44));ein='Monat';viele='Monaten';}
    else                {n=Math.round(v/(86400*365.25));ein='Jahr';viele='Jahren';}
    return (vor?'vor ':'in ')+n+' '+(n===1?ein:viele);
  }
  function alarmIsActive(w){
    if(!w)return false;
    // ZEITSTEMPEL als Bedingung - zwei Richtungen, dieselbe Rechnung mit anderem Vorzeichen:
    //   Erinnerung: der Termin RUECKT HERAN  (Restzeit faellt unter den Vorlauf)
    //   Wachhund  : der Wert IST STEHENGEBLIEBEN (Restzeit unter dem negativen Hoechstalter)
    if(w.condMode==='due'||w.condMode==='age'){
      var rest=_acRest(w.varId);
      if(rest==null)return !!w.timeNullAlarm;      // nie gesetzt -> nur auf ausdruecklichen Wunsch
      var sec=(w.timeSec!=null&&w.timeSec!=='')?+w.timeSec:(w.condMode==='age'?3600:86400);
      if(w.condMode==='age')return (-rest)>sec;    // Wachhund: aelter als X
      if(rest<0&&w.dueHideOver)return false;       // Erinnerung: ueberfaellig ausblenden (Option)
      return rest<=sec;                            // Erinnerung: faellig in weniger als X
    }
    if(w.condMode==='list'){
      if(!(w.vassoc&&w.vassoc.length))return false;
      // Die Liste darf wahlweise gegen den WERT oder gegen die RESTZEIT in Sekunden pruefen.
      // Damit lassen sich Stufen bauen: <86400 gelb ("morgen"), <7200 rot ("gleich").
      return !!stateHit(w.vassoc, w.listTime?_acRest(w.varId):_acRaw(w.varId));
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
    if(w.condMode==='list'&&w.vassoc&&w.vassoc.length){var m=stateHit(w.vassoc, w.listTime?_acRest(w.varId):_acRaw(w.varId));if(m&&m.color){var c2=_cssColorOrEmpty(m.color);if(c2)col=c2;}}
    return col;
  }
  function _acHHMM(ms){var d=new Date(ms);function p(n){return (n<10?'0':'')+n;}return p(d.getHours())+':'+p(d.getMinutes());}
  function _acStr(s,w){                             // Titel/Unterzeile: Klartext ODER =Formel, dann {seit}
    if(s==null||s==='')return '';
    var out=s;
    if(_fIsFormula(s)){var r=_fEvalStr(s);out=(r==null)?'':r;}
    if(out.indexOf('{seit}')>=0){var t=(w&&w.varId)?changedAt(w.varId):0;out=out.replace(/\{seit\}/g,t?('seit '+_acHHMM(t)):'');}
    if(out.indexOf('{frist}')>=0)out=out.replace(/\{frist\}/g,_acFrist(_acRest(w&&w.varId)));
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
    label:'Alarm', cat:'Anzeige', paletteIcon:'bell', size:[300,64], noHover:true,
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
        +row('Bedingung','<select id="pAcMode">'+[['const','Variable vs. Konstante'],['var','Variable vs. Variable'],['due','Erinnerung — Termin rückt heran'],['age','Wachhund — Wert steht still'],['list','Vergleichsliste']].map(function(o){return '<option value="'+o[0]+'"'+((w.condMode||'const')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>');
      if((w.condMode||'const')==='const'){
        s+=row('Operator','<select id="pAcOp">'+OPS.map(function(o){return '<option'+((w.op||'>')===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select>')
          +row('Schwelle','<input id="pAcThr" type="number" step="any" value="'+(w.thr!=null?w.thr:'')+'">');
      }else if(w.condMode==='var'){
        s+=row('Operator','<select id="pAcOp">'+OPS.map(function(o){return '<option'+((w.op||'>')===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select>')
          +fieldPick(w,'varId2','Vergleichs-Variable');
      }else if(w.condMode==='due'||w.condMode==='age'){
        var alt=(w.condMode==='age');
        // Eingabe als ZAHL + EINHEIT statt in Sekunden. Intern bleibt es eine Sekundenzahl -
        // die Rechnung braucht sie so -, aber niemand soll 86400 im Kopf ausrechnen muessen.
        // Die Einheit wird aus dem gespeicherten Wert zurueckgewonnen: die groesste, die glatt
        // aufgeht, damit "1 Tag" nicht als "1440 Minuten" wieder erscheint.
        var EINH=[[604800,'Wochen'],[86400,'Tage'],[3600,'Stunden'],[60,'Minuten']];
        var sec=(w.timeSec!=null&&w.timeSec!=='')?+w.timeSec:(alt?3600:86400);
        var eF=60,eN='Minuten';
        for(var _i=0;_i<EINH.length;_i++){ if(sec%EINH[_i][0]===0){ eF=EINH[_i][0]; eN=EINH[_i][1]; break; } }
        s+=row(alt?'Höchstalter':'Vorlauf',
               '<input id="pAcTNum" type="number" step="1" min="0" value="'+Math.round(sec/eF)+'" style="width:70px">'
               +' <select id="pAcTUnit" style="margin-left:6px">'
               +EINH.map(function(o){return '<option value="'+o[0]+'"'+(eF===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')
               +'</select>');
        if(!alt)s+=row('Überfällig ausblenden','<input type="checkbox" id="pAcTHide"'+(w.dueHideOver?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">sonst bleibt die Karte nach dem Termin stehen</span>');
        s+=row('Ohne Zeitstempel','<input type="checkbox" id="pAcTNull"'+(w.timeNullAlarm?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">leere Variable als Alarm werten</span>')
          +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Die Variable enthält einen <b>Unix-Zeitstempel</b> (Sekunden oder Millisekunden). '
          +(alt?'Die Karte erscheint, wenn der Zeitpunkt <b>älter</b> als das Höchstalter ist — ein Wert, der sich nicht mehr rührt.'
               :'Die Karte erscheint, sobald der Termin <b>näher</b> als der Vorlauf ist — 1 Tag ergibt „morgen fällig".')
          +' In Titel und Unterzeile schreibt <b>{frist}</b> den Abstand als Text („in 2 Tagen", „vor 3 Stunden").</div>';
      }else{
        s+=row('Liste vergleicht','<select id="pAcLT"><option value=""'+(w.listTime?'':' selected')+'>den Wert</option><option value="1"'+(w.listTime?' selected':'')+'>die Restzeit in Sekunden</option></select>')
          +'<div style="font-size:11px;color:var(--muted);margin:4px 2px">Trifft eine Zeile → Alarm aktiv. Operatoren (&gt;50, !=0), Bereiche (25..60), Platzhalter (*, else). Farbe der Zeile toent die Karte.</div>'
          +listEditor(w,'vassoc','Wert · Farbe',[{k:'v',ph:'z. B. >50'},{k:'color',type:'skincolor'}]);
      }
      s+='<div class="pgh">Darstellung</div>'
        +row('Farbe (Skin)',skinSel(w.color,'id="pAcCol"'))
        +row('Titel','<input id="pAcTtl" value="'+esc(w.title||'')+'" placeholder="=#33962.&quot; Sensor-Alarme&quot;">')
        +row('Unterzeile','<input id="pAcSub" value="'+esc(w.sub||'')+'" placeholder="Rauchmelder Leonie · {seit}">')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Formel möglich (=…, #id + Text mit dem Punkt). <b>{seit}</b> = „seit HH:MM" der Bedingungs-Variable, <b>{frist}</b> = Abstand zum Zeitstempel.</div>'
        +row('Benachrichtigung','<input id="pAcNot" value="'+esc(w.notify||'')+'" placeholder="Text (Formel möglich) — kein Push">');
      return s;
    },
    wire:function(w){
      function repaint(){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_acPaint(w,el);}
      if($('#pAcMode'))$('#pAcMode').onchange=function(){w.condMode=this.value;render();renderProps();commit();};
      if($('#pAcOp'))$('#pAcOp').onchange=function(){w.op=this.value;repaint();commit();};
      if($('#pAcThr'))$('#pAcThr').oninput=function(){w.thr=this.value===''?undefined:parseFloat(this.value);repaint();commit();};
      function _acTSet(){var n=parseInt(($('#pAcTNum')||{}).value,10);var f=parseInt(($('#pAcTUnit')||{}).value,10)||60;
        w.timeSec=(isNaN(n)||n<0)?undefined:(n*f);repaint();commit();}
      if($('#pAcTNum'))$('#pAcTNum').oninput=_acTSet;
      if($('#pAcTUnit'))$('#pAcTUnit').onchange=_acTSet;
      if($('#pAcTHide'))$('#pAcTHide').onchange=function(){w.dueHideOver=this.checked||undefined;repaint();commit();};
      if($('#pAcTNull'))$('#pAcTNull').onchange=function(){w.timeNullAlarm=this.checked||undefined;repaint();commit();};
      if($('#pAcLT'))$('#pAcLT').onchange=function(){w.listTime=this.value?1:undefined;repaint();commit();};
      if($('#pAcCol'))$('#pAcCol').onchange=function(){w.color=this.value||undefined;repaint();commit();};
      if($('#pAcTtl'))$('#pAcTtl').oninput=function(){w.title=this.value||undefined;repaint();commit();};
      if($('#pAcSub'))$('#pAcSub').oninput=function(){w.sub=this.value||undefined;repaint();commit();};
      if($('#pAcNot'))$('#pAcNot').oninput=function(){w.notify=this.value||undefined;commit();};
    }
  });
