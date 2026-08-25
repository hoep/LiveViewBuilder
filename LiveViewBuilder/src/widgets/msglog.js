  // ===== Widget: Meldungen (msglog) =====
  // Quelle: Symcon-Log (ohne DEBUG) ODER Homematic-CCU-Servicemeldungen (XML-RPC + ReGaHss,
  // nur IP noetig). Ansicht: Liste oder Kompakt (nur Anzahl je Severity). Severity-Filter per
  // Chip (live, je Geraet gespeichert). Quelle im Frontend live umschaltbar, wenn eine CCU-IP
  // hinterlegt ist. Homematic-Meldungen koennen optional per Haken bestaetigt werden (AlReceipt).
  var _SEVCLR={ERROR:'#f2685a',WARNING:'#f2b441',CUSTOM:'#c471ed',NOTIFY:'#4aa3ff',MESSAGE:'#8a97a0',SUCCESS:'#39d08a'};
  var _SEVS=['ERROR','WARNING','CUSTOM','NOTIFY','MESSAGE','SUCCESS'];
  // ---- Responsive Groessen als Inline-Style ----------------------------------
  // Jede Kachel (.w) ist ein Groessen-Container (container-type:size), deshalb loesen
  // cqmin-Werte hier direkt gegen die Kachel auf. Die festen Pixelmasse stehen in
  // styles.css, die in dieser Phase nicht angefasst werden darf - darum die Overrides
  // direkt am Markup. clamp() haelt die Schrift auf kleinen Kacheln lesbar und auf
  // grossen Wandpanels ruhig; die Mindesthoehen sichern das Tippziel (>= 22px).
  var _MSG_ROWFS='font-size:clamp(10px,3cqmin,13.5px)';
  var _MSG_COLS='grid-template-columns:auto clamp(44px,14cqmin,74px) clamp(40px,13cqmin,68px) auto 1fr';
  var _MSG_SEV='font-size:clamp(8.5px,2.4cqmin,11px)';
  var _MSG_TIME='font-size:clamp(8.5px,2.4cqmin,11px)';
  var _MSG_SRC='max-width:clamp(70px,22cqmin,150px)';
  var _MSG_CHIP='font-size:clamp(9px,2.8cqmin,12px);padding:clamp(3px,1.2cqmin,6px) clamp(7px,3cqmin,13px);min-height:22px;display:inline-flex;align-items:center;box-sizing:border-box';
  var _MSG_ICOB='width:clamp(22px,8cqmin,30px);height:clamp(22px,8cqmin,30px)';
  function _sevDef(w,s){if(!w.sev)return (s==='ERROR'||s==='WARNING'||s==='CUSTOM');return !!w.sev[s];}
  function _msgFilter(w){
    if(typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvmsg_'+w.id);if(o){var j=JSON.parse(o);if(j)return j;}}catch(e){}}
    var f={};_SEVS.forEach(function(s){f[s]=_sevDef(w,s)?1:0;});return f;
  }
  // Effektive Quelle: nur wenn eine CCU-IP hinterlegt ist, ist Homematic ueberhaupt moeglich;
  // im Frontend per Umschalter (localStorage) uebersteuerbar, sonst der Builder-Standard w.msgSrc.
  function _msgSrc(w){
    if(!w.hmIP)return 'symcon';
    // localStorage-Override NUR im Live-Betrieb (RUN). Im Builder gilt der konfigurierte Standard,
    // sonst haengt das Widget nach einem frueheren Umschalt-Klick dauerhaft auf der falschen Quelle.
    if(typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvmsgsrc_'+w.id);if(o==='symcon'||o==='homematic')return o;}catch(e){}}
    return (w.msgSrc==='homematic')?'homematic':'symcon';
  }
  function _chips(w){var f=_msgFilter(w);return _SEVS.map(function(s){return '<span class="hmsgchip'+(f[s]?'':' off')+'" data-sevchip="'+s+'" style="--cc:'+_SEVCLR[s]+';'+_MSG_CHIP+'">'+s+'</span>';}).join('');}
  // Homematic-Interface-Auswahl: BidCos-RF (klassisch HM) und HmIP-RF getrennt an/abwaehlbar.
  // Builder-Standard w.hmIf ({bidcos,hmip}, beide an), im Frontend per Chip live uebersteuerbar.
  function _hmIf(w){
    var d={bidcos:(w.hmIf?w.hmIf.bidcos!==0:true),hmip:(w.hmIf?w.hmIf.hmip!==0:true)};
    if(typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvmsgif_'+w.id);if(o){var j=JSON.parse(o);if(j&&typeof j==='object'){if('bidcos' in j)d.bidcos=!!j.bidcos;if('hmip' in j)d.hmip=!!j.hmip;}}}catch(e){}}
    if(!d.bidcos&&!d.hmip){d.bidcos=true;d.hmip=true;} // nie beide aus -> waere immer leer
    return d;
  }
  function _ifParam(w){var f=_hmIf(w),a=[];if(f.bidcos)a.push('bidcos');if(f.hmip)a.push('hmip');return a.join(',');}
  // ---- Quellen ausblenden ---------------------------------------------------
  // Manche Module reden viel (Z-Wave meldet jede abgelaufene Wartezeit). Wer die
  // Liste nach echten Stoerungen absucht, will sie stummschalten koennen - ohne
  // sie zu verlieren. Jede Quelle aus msgHide bekommt einen Chip; gedaempft heisst
  // stumm, angetippt kommt sie zurueck. Wie bei den Severity-Chips gilt der
  // Builder-Wert als Vorgabe und der Klick nur im Live-Betrieb (localStorage).
  function _hideTerms(w){
    return String(w.msgHide||'').split(',').map(function(t){return t.trim();}).filter(function(t){return t!=='';});
  }
  function _hideState(w){
    var t=_hideTerms(w),d={};
    t.forEach(function(x){d[x]=1;});                 // Vorgabe: ausgeblendet
    if(typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvmsghide_'+w.id);
      if(o){var j=JSON.parse(o);if(j&&typeof j==='object')t.forEach(function(x){if(x in j)d[x]=j[x]?1:0;});}}catch(e){}}
    return d;
  }
  function _hideParam(w){
    var d=_hideState(w);
    return Object.keys(d).filter(function(k){return d[k];}).join(',');
  }
  function _hideChips(w){
    var t=_hideTerms(w); if(!t.length||_msgSrc(w)!=='symcon')return '';
    var d=_hideState(w);
    return t.map(function(x){
      return '<span class="hmsgchip'+(d[x]?' off':'')+'" data-hidechip="'+esc(x)+'" style="--cc:var(--muted);'+_MSG_CHIP+'" title="'+(d[x]?'Meldungen dieser Quelle einblenden':'Meldungen dieser Quelle ausblenden')+'">'+escL(x)+'</span>';
    }).join('');
  }
  function _msgIfOk(w,m){var f=_hmIf(w);return (m.iface==='HmIP-RF')?f.hmip:(m.iface==='BidCos-RF'?f.bidcos:true);}
  function _ifChips(w){ // nur bei Homematic-Quelle (Liste) — HM/IP live filtern
    if(_msgSrc(w)!=='homematic')return '';
    var f=_hmIf(w);
    return '<span class="hmsgifs"><span class="hmsgifc'+(f.bidcos?'':' off')+'" data-ifchip="bidcos" title="Homematic BidCos-RF" style="'+_MSG_CHIP+'">HM</span>'
      +'<span class="hmsgifc'+(f.hmip?'':' off')+'" data-ifchip="hmip" title="Homematic IP (HmIP-RF)" style="'+_MSG_CHIP+'">IP</span></span>';
  }
  function _srcSwitch(w){ // Live-Umschalter Symcon/Homematic (nur mit CCU-IP)
    if(!w.hmIP)return '';
    var s=_msgSrc(w);
    return '<span class="hmsgsw" data-msgsw="1" title="Quelle umschalten"><span class="'+(s==='symcon'?'on':'')+'">Symcon</span><span class="'+(s==='homematic'?'on':'')+'">HM</span></span>';
  }
  // ---- Bestätigen (nur Symcon): Cutoff-Epoch in einer Server-Variable (w.ackVid). Log ist append-only,
  //      also blenden wir bestätigte (aelter/gleich Cutoff) aus statt zu loeschen ("Verlauf" = weiter im Log). ----
  function _msgTs(t){if(!t)return 0;var s=String(t).trim();
    var m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/); // DD.MM.YYYY HH:MM[:SS] (Symcon-Log, deutsch)
    if(m){var d=new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+(m[6]||0));var tt=d.getTime();return isNaN(tt)?0:Math.floor(tt/1000);}
    var d2=Date.parse(s.replace(' ','T'));return isNaN(d2)?0:Math.floor(d2/1000);}
  function _msgHist(w){try{return localStorage.getItem('lvmsghist_'+w.id)==='1';}catch(e){return false;}}
  // Bestaetigt-Status aus w.ackVid: {cutoff:Epoch, keys:{key:1}}. Abwaertskompatibel: reine Integer-Variable = nur cutoff.
  function _ackData(w){var lv=w.ackVid&&_lastVals[w.ackVid];if(!lv)return {cutoff:0,keys:{}};
    var v=lv.v;if(typeof v==='number')return {cutoff:v,keys:{}};
    var s=String(v==null?'':v).trim();if(s==='')return {cutoff:0,keys:{}};
    if(/^\d+$/.test(s))return {cutoff:parseInt(s,10),keys:{}};
    try{var j=JSON.parse(s);return {cutoff:(j.cutoff|0),keys:(j.keys||{})};}catch(e){return {cutoff:0,keys:{}};}}
  function _ackKey(m){return (m.t||'')+'|'+(m.m||'');}
  function _ackWrite(w,data){if(!w.ackVid)return;var p=JSON.stringify({cutoff:(data.cutoff|0),keys:(data.keys||{})});setVar(w.ackVid,p);_lastVals[w.ackVid]={v:p};}
  function _msgIsAcked(w,src,data,m){return src==='symcon'&&((data.cutoff>0&&_msgTs(m.t)>0&&_msgTs(m.t)<=data.cutoff)||!!data.keys[_ackKey(m)]);}
  function _renderCount(box,w,msgs,sevOn){ // Kompaktansicht: EINE grosse Gesamtzahl der markierten Kategorien
    var cnt={};_SEVS.forEach(function(s){cnt[s]=0;});
    msgs.forEach(function(m){if(cnt[m.sev]!=null)cnt[m.sev]++;});
    var total=0;sevOn.forEach(function(s){total+=cnt[s];});
    var col,bgCss='';
    if(w.cntGreen!=null||w.cntYellow!=null){ // Bereich nach ANZAHL: <=gruen / <=gelb / darueber -> je Schrift+Kachel aus Skin-Farben
      var g=(w.cntGreen!=null?w.cntGreen:0),y=(w.cntYellow!=null?w.cntYellow:g),fgN,bgN;
      if(total<=g){fgN=w.cOkFg||'ok';bgN=w.cOkBg;}
      else if(total<=y){fgN=w.cWarnFg||'warn';bgN=w.cWarnBg;}
      else {fgN=w.cCritFg||'crit';bgN=w.cCritBg;}
      col=_cssColorOrEmpty(fgN)||_SEVCLR.SUCCESS;   // Schriftfarbe (Skin)
      if(bgN){var _bc=_cssColorOrEmpty(bgN)||'';bgCss=(_bc&&w.cntBgSoft)?('color-mix(in oklab,'+_bc+' 22%,var(--surface))'):_bc;} // Kachelfarbe (Skin); gedaempft=Tint, sonst Vollfarbe
    }else{ // ohne Grenzen: Farbe = hoechste vorhandene markierte Severity
      col=_SEVCLR.SUCCESS;
      for(var i=0;i<_SEVS.length;i++){var s=_SEVS[i];if(sevOn.indexOf(s)>=0&&cnt[s]>0){col=_SEVCLR[s];break;}}
    }
    box.classList.add('is-count');
    box.innerHTML='<div class="hmsgcount one"><div class="hmsgcb big" style="--cc:'+col+'"><span class="n">'+total+'</span></div></div>';
    var wEl=box.closest?box.closest('.w'):null;
    if(wEl)wEl.style.background=bgCss?bgCss:((w.bg&&!w.bgT)?w.bg:''); // Kachel nach Bereich, sonst Basis-Hintergrund
  }
  function fetchMsgs(w){
    // IDs können kollidieren: die Popup-Liste trägt u. U. dieselbe ID wie eine Seiten-Kachel.
    // Ein reines canvas-zuerst würde die falsche (Seiten-)Kachel greifen und die Popup-Liste nie
    // füllen. Daher ALLE Elemente mit dieser ID sammeln (Popup/ovcanvas zuerst = aktiver Kontext)
    // und das nehmen, das wirklich eine Meldungsliste [data-role=msgl] enthält.
    var el=null,box=null,cands=[],oc=document.getElementById('ovcanvas');
    if(oc)cands=cands.concat([].slice.call(oc.querySelectorAll('.w[data-id="'+w.id+'"]')));
    cands=cands.concat([].slice.call(canvas.querySelectorAll('.w[data-id="'+w.id+'"]')));
    for(var _i=0;_i<cands.length;_i++){var _b=cands[_i].querySelector('[data-role=msgl]');if(_b){el=cands[_i];box=_b;break;}}
    if(!el||!box)return;
    var isCount=(w.view==='count');
    // Kompakt hat keine Chips -> immer den Builder-Filter (w.sev) nehmen, nicht den localStorage-Chip-Override (sonst zaehlt evtl. CUSTOM mit und schlaegt an die 200-Grenze)
    var f=isCount?(function(){var o={};_SEVS.forEach(function(s){o[s]=_sevDef(w,s)?1:0;});return o;})():_msgFilter(w);
    var sevOn=_SEVS.filter(function(s){return f[s];});
    var src=_msgSrc(w);
    if(!isCount)box.classList.remove('is-count');
    if(!sevOn.length){box.classList.remove('is-count');box.innerHTML='<div class="hmsge">Keine Kategorie aktiv</div>';box._sig='none';return;}
    var url=(src==='homematic')?('?api=hmmsg&ip='+encodeURIComponent(w.hmIP)+'&if='+encodeURIComponent(_ifParam(w)))
                              :('?api=messages&n='+(w.max||25)+'&sev='+encodeURIComponent(sevOn.join(','))
                                 +(_hideParam(w)?('&hide='+encodeURIComponent(isCount?_hideTerms(w).join(','):_hideParam(w))):''));   // Kompakt zaehlt bis „Max. Eintraege" (max 500), stummgeschaltete Quellen zaehlen nie mit
    fetch(url,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.error){box.classList.remove('is-count');box.innerHTML='<div class="hmsge" style="color:var(--crit)">CCU nicht erreichbar</div>';box._sig='err';return;}
      var all=((j&&j.messages)||[]).filter(function(m){return f[m.sev]&&(src!=='homematic'||_msgIfOk(w,m));});
      var data=_ackData(w),hist=_msgHist(w);
      var open=(src==='symcon'&&!hist)?all.filter(function(m){return !_msgIsAcked(w,src,data,m);}):all; // bestaetigte (Cutoff ODER einzeln, nur Symcon) ausblenden
      if(isCount){var sigC=src+'|count|'+_hideParam(w)+'|'+open.length+'|'+data.cutoff+'|'+Object.keys(data.keys).length+'|'+w.cntGreen+'|'+w.cntYellow;if(box._sig===sigC)return;box._sig=sigC;_renderCount(box,w,open,sevOn);return;} // Anzahl der OFFENEN gefilterten Liste der aktiven Quelle
      var base=(src==='symcon'&&hist)?all:open;
      var msgs=(src==='homematic')?base.slice(0,w.max||60):base.slice(0,w.max||25).reverse(); // Symcon: neueste unten; HM: wie geliefert (nach Severity)
      var sig=src+'|'+isCount+'|'+_hideParam(w)+'|'+msgs.map(function(m){return (m.t||'')+m.m;}).join('|');
      if(box._sig===sig)return;
      var wasBottom=(box._sig===undefined)||(box.scrollTop+box.clientHeight>=box.scrollHeight-6);
      box._sig=sig;
      box.classList.remove('is-count');
      if(!msgs.length){box.innerHTML='<div class="hmsge">Keine Meldungen</div>';return;}
      var ack=(src==='homematic'&&w.hmAck);
      if(src==='homematic'){ // eigenes, kompaktes Zeilen-Layout (keine Zeit/Quelle, optional Haken)
        box.innerHTML=msgs.map(function(m){var c=_SEVCLR[m.sev]||'#8a97a0';
          // HM-Zeile behaelt ihr eigenes 4-Spalten-Raster aus styles.css (auto auto 1fr auto);
          // hier nur die Schriftgroessen an die Kachel koppeln.
          return '<div class="hmsgi hm" style="'+_MSG_ROWFS+'"><span class="hmsgdot" style="background:'+c+'"></span><span class="hmsgsev" style="color:'+c+';'+_MSG_SEV+'">'+esc(m.sev||'')+'</span><span class="hmsgm">'+esc(m.m||'')+'</span>'
            +(ack?'<button class="hmackb" data-hmack="1" data-haddr="'+esc(m.addr||'')+'" data-htype="'+esc(m.type||'')+'" title="Bestätigen" style="'+_MSG_ICOB+'"><svg class="i"><use href="#ic-check"/></svg></button>':'')
            +'</div>';}).join('');
      } else {
        box.innerHTML=msgs.map(function(m){var c=_SEVCLR[m.sev]||'#8a97a0',tm=(m.t||'').slice(-8);
          var key=_ackKey(m),ak=_msgIsAcked(w,src,data,m),btn='';
          if(src==='symcon'&&w.ackVid){
            var xb='font-size:clamp(11px,3.2cqmin,15px);min-width:22px;min-height:22px'; // Tippziel darf nie unter 22px fallen
            if(!hist)btn='<button class="hmsgx" data-msgdismiss="1" data-mkey="'+esc(key)+'" title="Ausblenden" style="'+xb+'">✕</button>';
            else if(data.keys[key])btn='<button class="hmsgx" data-msgrestore="1" data-mkey="'+esc(key)+'" title="Zurückholen" style="'+xb+'">↺</button>';
          }
          // Spaltenbreiten aus der Kachel: Severity/Zeit duerfen mitschrumpfen, die Ausblenden-
          // Spalte kommt nur dazu, wenn der Knopf da ist (sonst rutscht die Meldung ins Leere).
          return '<div class="hmsgi'+((hist&&ak)?' acked':'')+(btn?' ackrow':'')+'" style="'+_MSG_ROWFS+';'+_MSG_COLS+(btn?' auto':'')+'"><span class="hmsgdot" style="background:'+c+'"></span><span class="hmsgsev" style="color:'+c+';'+_MSG_SEV+'">'+esc(m.sev||'')+'</span><span class="hmsgtime" style="'+_MSG_TIME+'">'+esc(tm)+'</span><span class="hmsgsrc" style="'+_MSG_SRC+'">'+esc(m.src||'')+'</span><span class="hmsgm">'+esc(m.m||'')+'</span>'+btn+'</div>';}).join('');
        if(!w.noAuto&&wasBottom)box.scrollTop=box.scrollHeight;
      }
    }).catch(function(){box.classList.remove('is-count');box.innerHTML='<div class="hmsge" style="color:var(--crit)">Nicht lesbar</div>';box._sig='err';});
  }
  defWidget('msglog',{
    label:'Meldungen', cat:'Anzeige', paletteIcon:'wticker', size:[460,230], noHover:true,
    defaults:function(w){w.label='Meldungen';w.max=25;},
    render:function(w){var compact=(w.view==='count'); // Kompakt: nur Titel + grosse Zahl, keine Chips/Quell-Umschalter
      var symAck=(_msgSrc(w)==='symcon'&&w.ackVid);
      var ackUI=(!compact&&symAck)
        ?('<span class="hmsgackw"><button class="hmsgackb" data-msgack="1" title="Alle als bestätigt ausblenden" style="'+_MSG_CHIP+'">Bestätigen</button><button class="hmsgackb ghost'+(_msgHist(w)?' on':'')+'" data-msghist="1" title="Verlauf (bestätigte zeigen)" style="'+_MSG_CHIP+'">Verlauf</button></span>')
        :'';
      var ackC=(compact&&symAck)?('<button class="hmsgackx" data-msgack="1" title="Alle bestätigen" style="'+_MSG_ICOB+'"><svg class="i"><use href="#ic-check"/></svg></button>'):''; // Kompakt: kleiner Haken oben rechts
      return '<div class="hmsg'+(compact?' is-count':'')+'"><div class="hmsgtop"><span class="hmsgt">'+escL(w.label||'Meldungen')+'</span>'+(compact?ackC:(_srcSwitch(w)+_ifChips(w)+'<span class="hmsgchips">'+_chips(w)+_hideChips(w)+'</span>'+ackUI))+'</div><div class="hmsgl'+(compact?' is-count':'')+'" data-role="msgl"><div class="hmsge">…</div></div></div>';},
    props:function(w){return '<div class="pgh">Quelle</div>'
      +row('Typ','<select id="pMsgSrc"><option value="symcon"'+(w.msgSrc!=='homematic'?' selected':'')+'>Symcon-Log</option><option value="homematic"'+(w.msgSrc==='homematic'?' selected':'')+'>Homematic-CCU</option></select>')
      +(w.msgSrc==='homematic'?(
         row('CCU-IP','<input id="pMsgHmIP" value="'+esc(w.hmIP||'')+'" placeholder="z. B. 10.10.20.240">')
        +row('Bestätigen erlauben','<input type="checkbox" id="pMsgHmAck"'+(w.hmAck?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Haken je Meldung → CCU-Servicemeldung quittieren</span>')
        +row('Interfaces','<label style="font-size:12px"><input type="checkbox" id="pMsgIfB"'+((w.hmIf?w.hmIf.bidcos!==0:true)?' checked':'')+'> BidCos-RF (HM)</label> &nbsp; <label style="font-size:12px"><input type="checkbox" id="pMsgIfI"'+((w.hmIf?w.hmIf.hmip!==0:true)?' checked':'')+'> HmIP-RF</label>')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Liest die Servicemeldungen direkt von der CCU. BidCos-RF (klassisch HM) und HmIP-RF sind hier als Standard und im Live-Betrieb per Chip (HM / IP) getrennt an- und abwählbar. Ist eine IP gesetzt, wechselt der Kopf-Umschalter zwischen Symcon und Homematic.</div>'
      ):'')
      +'<div class="pgh">Ansicht</div>'
      +row('Darstellung','<select id="pMsgView"><option value="list"'+(w.view!=='count'?' selected':'')+'>Liste</option><option value="count"'+(w.view==='count'?' selected':'')+'>Kompakt (nur Anzahl)</option></select>')
      +(w.view==='count'?(row('Farbgrenzen (Anzahl)','<input id="pMsgCg" type="number" min="0" style="width:70px" value="'+(w.cntGreen!=null?w.cntGreen:'')+'" placeholder="grün ≤"> <input id="pMsgCy" type="number" min="0" style="width:70px" value="'+(w.cntYellow!=null?w.cntYellow:'')+'" placeholder="gelb ≤">')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Bereich nach Anzahl: 0…grün, …gelb, darüber rot. Leer = Farbe nach höchster Severity.</div>'
        +row('Grün-Bereich','Schrift '+skinSel(w.cOkFg||'ok','id="pMsgOkFg"')+' &nbsp;Kachel '+skinSel(w.cOkBg||'','id="pMsgOkBg"'))
        +row('Gelb-Bereich','Schrift '+skinSel(w.cWarnFg||'warn','id="pMsgWarnFg"')+' &nbsp;Kachel '+skinSel(w.cWarnBg||'','id="pMsgWarnBg"'))
        +row('Rot-Bereich','Schrift '+skinSel(w.cCritFg||'crit','id="pMsgCritFg"')+' &nbsp;Kachel '+skinSel(w.cCritBg||'','id="pMsgCritBg"'))
        +row('Kachel-Hintergrund','<label style="font-size:12px"><input type="checkbox" id="pMsgBgSoft"'+(w.cntBgSoft?' checked':'')+'> gedämpft</label> <span style="font-size:11px;color:var(--muted)">an = abgeschwächt · aus = Vollfarbe</span>')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Schrift- und Kachelfarbe je Bereich aus den Skin-Farben. Kachel „Auto" = kein Hintergrund.</div>'):'')
      +'<div class="pgh">Bestätigen (nur Symcon)</div>'
      +fieldPick(w,'ackVid','Bestätigt-bis-Variable')
      +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">String-Variable (JSON {cutoff,keys}). „Bestätigen" blendet alles bis jetzt aus; das ✕ je Zeile blendet einzelne Meldungen aus; „Verlauf" zeigt sie ausgegraut mit ↺ zum Zurückholen. Log bleibt erhalten; der Kompakt-Zähler zählt nur offene. Homematic wird per Haken direkt auf der CCU quittiert.</div>'
      +'<div class="pgh">Severity-Filter (Standard)</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px 12px">'+_SEVS.map(function(s){return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:11px"><input type="checkbox" data-sev="'+s+'"'+(_sevDef(w,s)?' checked':'')+'> <span style="color:'+_SEVCLR[s]+';font-weight:600">'+s+'</span></label>';}).join('')+'</div>'
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Im Live-Modus per Tipp auf die Pills umschaltbar (je Gerät gespeichert).</div>'
      +'<div class="pgh">Quellen ausblenden</div>'
      +row('Stumm','<input id="pMsgHide" style="width:100%" value="'+esc(w.msgHide||'')+'" placeholder="z. B. Z-Wave, FritzBox">')
      +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Kommaliste. Jede Angabe wird als Teil des Quellennamens gesucht (Groß-/Kleinschreibung egal), „Z-Wave" trifft also „Z-Wave Module". Diese Meldungen werden schon beim Lesen des Logs übersprungen — sie verbrauchen damit keinen der „Max. Einträge". Je Angabe erscheint im Kopf ein Chip: gedämpft = stumm, angetippt kommt die Quelle im Live-Betrieb zurück (nur Symcon-Quelle).</div>'
      +row('Neuen folgen','<input type="checkbox" id="pMsgAuto"'+(w.noAuto?'':' checked')+'> <span style="font-size:11px;color:var(--muted)">bei neuen Meldungen ans Ende scrollen (nur Symcon-Liste)</span>')
      +row('Max. Einträge','<input id="pMsgN" type="number" min="1" max="500" value="'+(w.max||25)+'">')
      +row('Aktualisierung (Sek.)','<input id="pMsgIv" type="number" min="1" max="600" value="'+(w.refreshSec||'')+'" placeholder="'+(bcfg().refreshSec||15)+' (global)">');},
    wire:function(w){
      if($('#pMsgHide'))$('#pMsgHide').onchange=function(){w.msgHide=this.value.trim()||undefined;render();fetchMsgs(w);commit();};
      if($('#pMsgSrc'))$('#pMsgSrc').onchange=function(){w.msgSrc=(this.value==='homematic')?'homematic':undefined;render();renderProps();fetchMsgs(w);commit();};
      if($('#pMsgHmIP'))$('#pMsgHmIP').onchange=function(){w.hmIP=this.value.trim()||undefined;render();fetchMsgs(w);commit();};
      if($('#pMsgHmAck'))$('#pMsgHmAck').onchange=function(){w.hmAck=this.checked?1:undefined;fetchMsgs(w);commit();};
      function _setIf(k,v){if(!w.hmIf)w.hmIf={bidcos:1,hmip:1};w.hmIf[k]=v?1:0;if(!w.hmIf.bidcos&&!w.hmIf.hmip)w.hmIf[k]=1;try{localStorage.removeItem('lvmsgif_'+w.id);}catch(_){}render();fetchMsgs(w);commit();}
      if($('#pMsgIfB'))$('#pMsgIfB').onchange=function(){_setIf('bidcos',this.checked);};
      if($('#pMsgIfI'))$('#pMsgIfI').onchange=function(){_setIf('hmip',this.checked);};
      if($('#pMsgView'))$('#pMsgView').onchange=function(){w.view=(this.value==='count')?'count':undefined;render();renderProps();fetchMsgs(w);commit();};
      if($('#pMsgCg'))$('#pMsgCg').oninput=function(){w.cntGreen=this.value===''?undefined:Math.max(0,parseInt(this.value)||0);render();fetchMsgs(w);commit();};
      if($('#pMsgCy'))$('#pMsgCy').oninput=function(){w.cntYellow=this.value===''?undefined:Math.max(0,parseInt(this.value)||0);render();fetchMsgs(w);commit();};
      [['pMsgOkFg','cOkFg'],['pMsgOkBg','cOkBg'],['pMsgWarnFg','cWarnFg'],['pMsgWarnBg','cWarnBg'],['pMsgCritFg','cCritFg'],['pMsgCritBg','cCritBg']].forEach(function(p){var e=$('#'+p[0]);if(e)e.onchange=function(){w[p[1]]=this.value||undefined;render();fetchMsgs(w);commit();};});
      if($('#pMsgBgSoft'))$('#pMsgBgSoft').onchange=function(){w.cntBgSoft=this.checked||undefined;render();fetchMsgs(w);commit();};
      $$('#props [data-sev]').forEach(function(cb){cb.onchange=function(){if(!w.sev){w.sev={};_SEVS.forEach(function(s){w.sev[s]=_sevDef(w,s)?1:0;});}w.sev[cb.getAttribute('data-sev')]=cb.checked?1:0;render();fetchMsgs(w);commit();};});
      if($('#pMsgAuto'))$('#pMsgAuto').onchange=function(){w.noAuto=this.checked?undefined:true;commit();};
      if($('#pMsgN'))$('#pMsgN').oninput=function(){w.max=Math.min(500,Math.max(1,parseInt(this.value)||25));render();fetchMsgs(w);commit();};
      if($('#pMsgIv'))$('#pMsgIv').oninput=function(){w.refreshSec=this.value===''?undefined:Math.max(1,Math.min(600,parseInt(this.value)||15));commit();};
    },
    mount:function(w){fetchMsgs(w);},
    click:function(w,el,e){
      var sw=e.target.closest('[data-msgsw]'); // Quelle live umschalten
      if(sw){var cur=_msgSrc(w),nx=(cur==='homematic')?'symcon':'homematic';try{localStorage.setItem('lvmsgsrc_'+w.id,nx);}catch(_){}
        // Widget IN PLACE neu aufbauen (RUN-sicher, kein globales render()): Kopf (Umschalter-Zustand
        // + HM/IP-Chips erscheinen/verschwinden) und Liste bleiben konsistent. widgetInner ruft render().
        var root=(el.closest?el.closest('.w[data-id="'+w.id+'"]'):null)||el,win=root.querySelector('.winner');
        if(win)win.innerHTML=widgetInner(w);
        fetchMsgs(w);return true;}
      var ic=e.target.closest('[data-ifchip]'); // Homematic-Interface live filtern (HM/IP)
      if(ic){var k=ic.getAttribute('data-ifchip'),ff=_hmIf(w);ff[k]=!ff[k];if(!ff.bidcos&&!ff.hmip)ff[k]=true;
        try{localStorage.setItem('lvmsgif_'+w.id,JSON.stringify({bidcos:ff.bidcos,hmip:ff.hmip}));}catch(_){}
        ic.classList.toggle('off',!ff[k]);var bi=$('[data-role=msgl]',el);if(bi)bi._sig=undefined;fetchMsgs(w);return true;}
      var ab=e.target.closest('[data-hmack]'); // Homematic-Meldung bestätigen
      if(ab){var addr=ab.getAttribute('data-haddr'),type=ab.getAttribute('data-htype'),box=$('[data-role=msgl]',el);ab.disabled=true;
        fetch('?api=hmack&ip='+encodeURIComponent(w.hmIP||'')+'&addr='+encodeURIComponent(addr)+'&type='+encodeURIComponent(type)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
          .then(function(r){return r.json();}).then(function(j){if(j&&j.ok){toast('Bestätigt: '+type);}else{toast('Bestätigen fehlgeschlagen');ab.disabled=false;}if(box)box._sig=undefined;fetchMsgs(w);})
          .catch(function(){toast('Fehler beim Bestätigen');ab.disabled=false;});
        return true;}
      var mk=e.target.closest('[data-msgack]'); // Alle bestätigen (nur Symcon): Cutoff=jetzt, Einzel-Keys zuruecksetzen
      if(mk){if(w.ackVid){_ackWrite(w,{cutoff:Math.floor(Date.now()/1000),keys:{}});toast('Meldungen bestätigt');}var b1=$('[data-role=msgl]',el);if(b1)b1._sig=undefined;fetchMsgs(w);return true;}
      var md=e.target.closest('[data-msgdismiss]'); // einzelne Meldung ausblenden
      if(md){if(w.ackVid){var d1=_ackData(w);d1.keys[md.getAttribute('data-mkey')]=1;_ackWrite(w,d1);}var b3=$('[data-role=msgl]',el);if(b3)b3._sig=undefined;fetchMsgs(w);return true;}
      var mr=e.target.closest('[data-msgrestore]'); // einzelne Meldung zurueckholen (im Verlauf)
      if(mr){if(w.ackVid){var d2=_ackData(w);delete d2.keys[mr.getAttribute('data-mkey')];_ackWrite(w,d2);}var b4=$('[data-role=msgl]',el);if(b4)b4._sig=undefined;fetchMsgs(w);return true;}
      var mh=e.target.closest('[data-msghist]'); // Verlauf ein/aus (bestätigte wieder zeigen)
      if(mh){var on=!_msgHist(w);try{localStorage.setItem('lvmsghist_'+w.id,on?'1':'0');}catch(_){}mh.classList.toggle('on',on);var b2=$('[data-role=msgl]',el);if(b2)b2._sig=undefined;fetchMsgs(w);return true;}
      var hc=e.target.closest('[data-hidechip]'); // Quelle stummschalten / zurueckholen
      if(hc){
        var term=hc.getAttribute('data-hidechip'),hs=_hideState(w);
        hs[term]=hs[term]?0:1;
        try{localStorage.setItem('lvmsghide_'+w.id,JSON.stringify(hs));}catch(_){}
        hc.classList.toggle('off',!!hs[term]);
        hc.setAttribute('title',hs[term]?'Meldungen dieser Quelle einblenden':'Meldungen dieser Quelle ausblenden');
        var b5=$('[data-role=msgl]',el);if(b5)b5._sig=undefined;   // Signatur loeschen, sonst haelt der Vergleich die alte Liste fest
        fetchMsgs(w);return true;
      }
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
