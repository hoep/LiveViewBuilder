  // C1: nutzt das Widget diese Variablen-ID als Daten-Bindung? (spiegelt pollVals, ohne visVar)
  function widgetDataId(w,id){
    if(w.varId===id||w.varId2===id||w.varId3===id||w.cvActId===id||w.cvAzB===id||w.cvAzE===id||w.cvElv===id||w.cmpVid===id||w.ackVid===id||w.condVar===id||w.vTemp===id||w.vCond===id||w.vHum===id||w.vWind===id||w.vRain===id||w.ssAz===id||w.ssEl===id||w.ssRad===id||w.ssRainV===id||w.ssSnowV===id||w.ssPtypeV===id||w.ssFogV===id||w.ssWindV===id||w.ssRainSensV===id||w.ssTempV===id||w.ssDewV===id||w.ssHumV===id||w.ssCloudV===id||w.ssWxJson===id)return true;
    var A=['items','links','rows','src','snk','fc','elements','stages','steps','series'],i,j,o;
    for(i=0;i<A.length;i++){var a=w[A[i]];if(a)for(j=0;j<a.length;j++){o=a[j];if(o&&(o.vid===id||o.subvid===id||o.hi===id||o.lo===id||o.pq===id||o.cond===id||o.speedVid===id||o.socVid===id))return true;}}
    // Alarm-Karte: nur im Text (title/sub/notify) referenzierte Formel-IDs treiben live() ebenfalls
    if(w.type==='alarm'){var _at=[w.title,w.sub,w.notify];for(i=0;i<_at.length;i++){var _as=_at[i];if(_fIsFormula(_as)&&_fIds(_as).indexOf(id)>=0)return true;}}
    // Alarm-Panel: eine Kind-Karten-Variable aendert sich -> Panel-live() (Leer-Zustand/Quittung nachziehen)
    if(w.type==='alarmpanel'&&w.kids){for(i=0;i<w.kids.length;i++){if(w.kids[i]&&widgetDataId(w.kids[i],id))return true;}}
    return false;
  }
  // C1: Sichtbarkeits-Bedingung auswerten
  function evalVis(w,d){var m=w.visMode||'truthy',vv=d.v;
    if(m==='truthy')return !(vv===false||vv===0||vv==='0'||vv===''||vv==null||String(vv).toLowerCase()==='false');
    var n=parseFloat(String(vv).replace(',','.')),t=parseFloat(w.visVal);
    if(m==='eq')return String(vv)===String(w.visVal)||(!isNaN(n)&&!isNaN(t)&&n===t);
    if(m==='ne')return !(String(vv)===String(w.visVal)||(!isNaN(n)&&!isNaN(t)&&n===t));
    if(m==='ge')return !isNaN(n)&&!isNaN(t)&&n>=t;
    if(m==='le')return !isNaN(n)&&!isNaN(t)&&n<=t;
    return true;}
  // Speed: Index id -> [{w,root}] statt bei jedem Wert ALLE Widgets zu durchlaufen.
  // Enthält jede von einem Widget referenzierte ID (varId/2/3, visVar, fc.hi/lo/pq, links/src/snk/items/rows.vid) —
  // deckt damit sowohl pollVals-Bindungen als auch die Sub-Element-Slots (data-vid/viddot/vidbar) ab.
  // ---- Rechenformeln in Variablenfeldern: "=Ausdruck" mit + - * / und Klammern.
  // Variable = Token mit '#' oder Ganzzahl >= 10000; sonst Konstante. Spiegelbild von
  // LVB_Formula* in functions.php (PHP) - beide muessen identisch rechnen.
  function _fIsFormula(s){return typeof s==='string'&&s.charAt(0)==='=';}
  function _fVarId(t){
    if(!t)return null;
    if(t.charAt(0)==='#'){var r=t.slice(1);return /^[0-9]+$/.test(r)?parseInt(r,10):null;}
    if(/^[0-9]+$/.test(t)&&parseInt(t,10)>=10000)return parseInt(t,10);
    return null;
  }
  function _fParse(expr){ // -> RPN-Array oder null
    var s=String(expr).replace(/^\s+/,'');if(s.charAt(0)==='=')s=s.slice(1);
    var n=s.length,i=0,out=[],ops=[],prec={'u-':3,'*':2,'/':2,'+':1,'-':1},prev='';
    while(i<n){
      var c=s.charAt(i);
      if(c===' '||c==='\t'){i++;continue;}
      if(c==='#'||(c>='0'&&c<='9')||c==='.'){
        var j=i;if(c==='#')j++;
        while(j<n&&((s.charAt(j)>='0'&&s.charAt(j)<='9')||s.charAt(j)==='.'))j++;
        out.push(s.slice(i,j));i=j;prev='num';continue;
      }
      if(c==='('){ops.push('(');i++;prev='(';continue;}
      if(c===')'){while(ops.length&&ops[ops.length-1]!=='(')out.push(ops.pop());if(!ops.length)return null;ops.pop();i++;prev='num';continue;}
      if(c==='+'||c==='-'||c==='*'||c==='/'){
        var op=c;
        if(op==='-'&&(prev===''||prev==='('||prev==='op'))op='u-';
        if(op!=='u-'){while(ops.length&&ops[ops.length-1]!=='('&&prec[ops[ops.length-1]]>=prec[op])out.push(ops.pop());}
        ops.push(op);i++;prev='op';continue;
      }
      return null;
    }
    while(ops.length){var t=ops.pop();if(t==='(')return null;out.push(t);}
    return out.length?out:null;
  }
  function _fIds(expr){if(_fIsStr(expr))return _fIdsStr(expr);var r=_fParse(expr);if(!r)return [];var seen={},ids=[];r.forEach(function(t){var v=_fVarId(t);if(v!==null&&!seen[v]){seen[v]=1;ids.push(v);}});return ids;}
  // ---- String-Verkettung: "=#35768."°C ".#27635."%"" -> Text aus Variablen + Literalen (PHP-Punkt-Operator).
  // Erkennung: eine Formel, die ein Text-Literal ("..." oder '...') enthaelt. Rein Anzeige (Live), kein Aggregat.
  function _fIsStr(s){return _fIsFormula(s)&&/["']/.test(s);}
  function _fParseStr(expr){ // -> [{str}|{vid}] oder null; '.' verkettet, Leerraum wird ignoriert
    var s=String(expr).replace(/^\s+/,'');if(s.charAt(0)==='=')s=s.slice(1);
    var n=s.length,i=0,out=[];
    while(i<n){var c=s.charAt(i);
      if(c===' '||c==='\t'||c==='.'){i++;continue;} // Leerraum + Verkettungspunkt
      if(c==='"'||c==="'"){var q=c,j=i+1,buf='';while(j<n&&s.charAt(j)!==q){buf+=s.charAt(j);j++;}if(j>=n)return null;out.push({str:buf});i=j+1;continue;}
      if(c==='#'){var j2=i+1;while(j2<n&&s.charAt(j2)>='0'&&s.charAt(j2)<='9')j2++;if(j2===i+1)return null;out.push({vid:parseInt(s.slice(i+1,j2),10)});i=j2;continue;}
      return null; // unerwartetes Zeichen -> keine gueltige String-Formel
    }
    return out.length?out:null;
  }
  function _fVarText(vid){ // Anzeigewert einer Variable OHNE Profil-Einheit (Einheit gibt der Nutzer selbst als Literal an)
    var d=_lastVals[vid];if(!d)return null;
    var base=(d.f!=null&&d.f!=='')?String(d.f):String(d.v),u=(d.u!=null)?String(d.u):'';
    if(u!==''&&base.length>=u.length&&base.slice(-u.length)===u)base=base.slice(0,-u.length).replace(/\s+$/,'');
    return base;
  }
  function _fEvalStr(expr){ // verkettetes Ergebnis oder null, falls eine beteiligte Variable (noch) fehlt
    var toks=_fParseStr(expr);if(!toks)return null;var res='';
    for(var i=0;i<toks.length;i++){var t=toks[i];if(t.str!=null){res+=t.str;continue;}var tx=_fVarText(t.vid);if(tx===null)return null;res+=tx;}
    return res;
  }
  function _fIdsStr(expr){var toks=_fParseStr(expr);if(!toks)return [];var seen={},ids=[];toks.forEach(function(t){if(t.vid!=null&&!seen[t.vid]){seen[t.vid]=1;ids.push(t.vid);}});return ids;}
  function _fEvalNum(expr){ // aktuellen Formelwert aus _lastVals; null falls eine Komponente fehlt
    var rpn=_fParse(expr);if(!rpn)return null;var st=[];
    for(var i=0;i<rpn.length;i++){var t=rpn[i];
      if(t==='u-'){if(!st.length)return null;st.push(-st.pop());continue;}
      if(t==='+'||t==='-'||t==='*'||t==='/'){if(st.length<2)return null;var b=st.pop(),a=st.pop();st.push(t==='+'?a+b:t==='-'?a-b:t==='*'?a*b:(b===0?0:a/b));continue;}
      var vid=_fVarId(t);
      if(vid!==null){var d=_lastVals[vid];if(!d)return null;var num=parseFloat(String(d.v).replace(',','.'));st.push(isNaN(num)?0:num);}
      else st.push(parseFloat(t));
    }
    return st.length===1?st[0]:null;
  }
  function _fFmt(v){var a=Math.abs(v),dd=a>=100?0:(a>=10?1:(a>=1?2:3));return v.toFixed(dd).replace('.',',');}
  // add() so umhuellen, dass ein Formelfeld sowohl den Formel-Token (fuer die Verteilung)
  // als auch seine Komponenten-IDs (fuer den Poll) liefert.
  function _emit(add){return function(id){if(_fIsFormula(id)){add(id);_fIds(id).forEach(function(cid){add(cid);});}else add(id);};}
  // Nach jedem Poll: jeden Formel-Token aus seinen Komponenten neu berechnen und verteilen.
  function _recalcFormulas(){
    if(!_vidx)return;
    for(var key in _vidx){
      if(!_fIsFormula(key))continue;
      var isStr=_fIsStr(key),val,ftxt,sflag;
      if(isStr){val=_fEvalStr(key);if(val===null)continue;ftxt=val;sflag=1;}
      else{val=_fEvalNum(key);if(val===null)continue;ftxt=_fFmt(val);sflag=0;}
      var prev=_lastVals[key];
      if(!prev||String(prev.v)!==String(val))applyVal(key,{v:val,f:ftxt,u:'',s:sflag,c:Math.floor(Date.now()/1000)});
    }
  }
  var _vidx=null;
  function _vidxAdd(id,w,root){if(!id)return;(_vidx[id]=_vidx[id]||[]).push({w:w,root:root});}
  function _collectIds(w,add){ // alle Variablen-IDs eines Widgets an add() geben
    add(w.varId);add(w.varId2);add(w.varId3);add(w.cvActId);add(w.cvAzB);add(w.cvAzE);add(w.cvElv);add(w.cmpVid);add(w.ackVid);add(w.visVar);add(w.condVar);add(w.vTemp);add(w.vCond);add(w.vHum);add(w.vWind);add(w.vRain);add(w.ssAz);add(w.ssEl);add(w.ssRad);add(w.ssRainV);add(w.ssSnowV);add(w.ssPtypeV);add(w.ssFogV);add(w.ssWindV);add(w.ssRainSensV);add(w.ssTempV);add(w.ssDewV);add(w.ssHumV);add(w.ssCloudV);add(w.ssWxJson);
    if(w.fc)w.fc.forEach(function(r){add(r.hi);add(r.lo);add(r.pq);add(r.cond);});
    ['links','src','snk','items','rows','steps','series'].forEach(function(k){if(w[k])w[k].forEach(function(o){if(o)add(o.vid);});});
    if(w.stages)w.stages.forEach(function(o){if(o){add(o.vid);add(o.subvid);add(o.sv);}}); // Pipeline-Stationen (Wert + Zusatzwert + Status-Var fuer bedingten Fluss)
    if(w.elements)w.elements.forEach(function(o){if(o){add(o.vid);add(o.speedVid);add(o.socVid);}});
    if(w.tankVid)add(w.tankVid);
    if((w.type==='container'||w.type==='alarmpanel')&&w.kids)w.kids.forEach(function(k){if(k)_collectIds(k,add);}); // Container/Alarm-Panel: IDs der Kinder mitsammeln (Poll)
    if(w.type==='alarm')[w.title,w.sub,w.notify].forEach(function(s){if(_fIsFormula(s))add(s);}); // Alarm-Karte: Formel-IDs aus dem Text (add=_emit -> Token + Komponenten)
  }
  function _vidxOne(w,root){_collectIds(w,_emit(function(id){_vidxAdd(id,w,root);}));}
  var _allIds=null;
  function allViewIds(){ // Vereinigung ALLER Variablen-IDs über alle Ansichten -> Poll hält den Cache für jede Seite warm
    if(_allIds)return _allIds;var set={};
    try{Object.keys(store.views||{}).forEach(function(vn){var v=store.views[vn];((v&&v.widgets)||[]).forEach(function(w){_collectIds(w,_emit(function(id){if(id)set[id]=1;}));});});}catch(e){}
    // Leisten-Widgets (store.chrome) gehoeren zu KEINER Ansicht - ohne sie wuerde der Poll
    // ihre Variablen nie abfragen und die Kacheln blieben dauerhaft auf "-".
    try{if(typeof chromeAllKids==='function')chromeAllKids().forEach(function(w){_collectIds(w,_emit(function(id){if(id)set[id]=1;}));});}catch(e){}
    _allIds=Object.keys(set);return _allIds;
  }
  function invalidateAllIds(){_allIds=null;}
  function applyCached(){ // beim Seitenwechsel: aktuelle Widgets sofort aus dem Cache füllen (kein „–"-Flackern)
    if(!_vidx)buildVidx();_liveSrc='cache';for(var id in _vidx){var d=_lastVals[id];if(d)applyVal(_fIsFormula(id)?id:parseInt(id),d);}_recalcFormulas();
  }
  function buildVidx(){
    _vidx={};
    state.widgets.forEach(function(w){_vidxOne(w,canvas);});
    // Widgets in den Leisten (bar/sidebar) - sie liegen NICHT in state.widgets, wuerden also
    // sonst nie Live-Werte bekommen (weder im Builder noch im Run).
    if(typeof chromeAllKids==='function')chromeAllKids().forEach(function(w){_vidxOne(w,canvas);});
    if(_compKids&&_compKids.length)_compKids.forEach(function(w){_vidxOne(w,canvas);});
    if(typeof _contKids!=='undefined'&&_contKids&&_contKids.length)_contKids.forEach(function(w){_vidxOne(w,canvas);}); // Container-Kinder live versorgen
    if(_tickKids&&_tickKids.length)_tickKids.forEach(function(w){_vidxOne(w,canvas);});
    if(_popup&&_popup.widgets){var _ov=$('#ovcanvas');if(_ov)_popup.widgets.forEach(function(w){_vidxOne(w,_ov);});}
    if(typeof _hover!=='undefined'&&_hover&&_hover.widgets){var _hv=$('#hovcanvas');if(_hv)_hover.widgets.forEach(function(w){_vidxOne(w,_hv);});}
  }
  function invalidateVidx(){_vidx=null;} // bei render()/Popup-Wechsel aufrufen — nächster poll/apply baut neu
  // Live-Feed (für WS-Monitor-Widget): jeder eingehende Wert wird protokolliert, mit Quelle (poll/ws)
  var _liveFeed=[],_liveSrc='poll';
  function _feedPush(id,d,src){if(src==='cache')return;_liveFeed.push({t:Date.now(),id:id,v:(d.f!=null&&d.f!=='')?d.f:d.v,src:src||'poll'});if(_liveFeed.length>500)_liveFeed.splice(0,_liveFeed.length-500);}
  // Zeitpunkt der letzten Aenderung je Variable. Der Poll liefert ihn als 'c' mit; der
  // WebSocket-Push tut das nicht, deshalb wird dort ersatzweise der Moment festgehalten,
  // in dem sich der Wert tatsaechlich geaendert hat. Ohne beides koennte eine Anzeige wie
  // "seit 18:12" erst ab dem Laden der Seite zaehlen.
  var _chgAt={};
  function changedAt(id){return _chgAt[id]||0;}
  // Universelle Zahl-Formatierung: Nachkommastellen (dec) + Tausendertrennung + Grosszahl-Kuerzung (k/M/Mrd), Dezimalkomma.
  // Ungesetzt (dec=null, thousand/numAbbrev aus) verhaelt es sich byte-identisch zur bisherigen dec-Logik.
  function _fmtNum(x,w){var neg=x<0,a=Math.abs(x);
    if(w.numAbbrev){var u='';if(a>=1e9){a/=1e9;u=' Mrd';}else if(a>=1e6){a/=1e6;u=' M';}else if(a>=1e3){a/=1e3;u=' k';}var dd=(w.dec!=null)?w.dec:(u?1:0);return (neg?'-':'')+a.toFixed(dd).replace('.',',')+u;}
    var s=(w.dec!=null)?a.toFixed(w.dec):String(a);var pp=s.split('.');if(w.thousand)pp[0]=pp[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');return (neg?'-':'')+pp.join(',');}
  // Optionale Pro-Slot-Formatierung fuer generische [data-vid]-Slots (Listen-Zeilen etc.):
  // data-dec / data-scale / data-unit / data-pre / data-suf / data-nulltext. Ohne Attribute = Rohwert wie bisher.
  function _fmtSlot(e,d,base){
    var dec=e.getAttribute('data-dec'),sc=e.getAttribute('data-scale'),un=e.getAttribute('data-unit'),pre=e.getAttribute('data-pre'),suf=e.getAttribute('data-suf'),nt=e.getAttribute('data-nulltext');
    if(dec==null&&sc==null&&un==null&&pre==null&&suf==null&&nt==null)return base; // keine Attribute -> unveraendert
    if(d.v==null||String(d.v).trim()==='')return (nt!=null&&nt!=='')?nt:base;
    var out,n=parseFloat(String(d.v).replace(',','.'));
    if(!isNaN(n)&&(dec!=null||sc!=null)){                       // numerisches Reformat aus dem Rohwert
      if(sc!=null&&sc!==''&&+sc!==1)n=n*(+sc);
      out=_fmtNum(n,{dec:(dec!=null&&dec!=='')?parseInt(dec):null});
      if(!un&&d.u!=null&&String(d.u).trim()!=='')out=out+' '+String(d.u).trim(); // keine eigene Einheit -> Profil-Einheit behalten
    }else if(un){                                               // nur eigene Einheit: Profil-Einheit aus base strippen (sonst doppelt)
      var pu=(d.u!=null)?String(d.u):'',bs=String(base);
      out=(pu!==''&&bs.length>=pu.length&&bs.slice(-pu.length)===pu)?bs.slice(0,-pu.length).replace(/\s+$/,''):bs;
    }else out=base;
    if(un)out=out+' '+un;
    return (pre||'')+out+(suf||'');
  }
  // Baut die Format-Attribute fuer einen [data-vid]-Slot aus einer Listen-Zeile (dec/unit/scale). Leer -> kein Attribut.
  function _slotAttrs(o,noUnit){var s='';if(o.dec!=null&&o.dec!=='')s+=' data-dec="'+(parseInt(o.dec)||0)+'"';if(!noUnit&&o.unit)s+=' data-unit="'+esc(o.unit)+'"';if(o.scale!=null&&o.scale!==''&&+o.scale!==1)s+=' data-scale="'+(+o.scale)+'"';return s;}
  function applyVal(id,d){
    if(!id||!d)return;
    var _prev=_lastVals[id];
    if(d.c)_chgAt[id]=d.c*1000;
    else if(!_prev||String(_prev.v)!==String(d.v))_chgAt[id]=Date.now();
    _lastVals[id]=d;_feedPush(id,d,_liveSrc);
    var base=(d.f!==''&&d.f!=null)?d.f:d.v,on=(d.v===true||d.v===1||d.v==='1');
    var _bs=String(base),_pu=(d.u!=null)?String(d.u):''; // Profil-Einheit vom Server
    var num=(_pu!==''&&_bs.length>=_pu.length&&_bs.slice(-_pu.length)===_pu)?_bs.slice(0,-_pu.length).replace(/\s+$/,''):_bs; // Wert ohne Profil-Einheit
    if(!_fIsFormula(id)){ // Formel-Token sind nie echte data-vid-Attribute; ihr String (mit ", =, +) würde den CSS-Selektor sprengen
      $$('[data-vid="'+id+'"]',canvas).forEach(function(e){e.textContent=_fmtSlot(e,d,base);}); // generische Slots (Forecast, Listen …) — optionale Pro-Slot-Formatierung
      $$('[data-viddot="'+id+'"]',canvas).forEach(function(e){e.classList.toggle('on',on);}); // Status-Dots / Bewegung
      $$('[data-vidbar="'+id+'"]',canvas).forEach(function(e){var nb=parseFloat(String(d.v).replace(',','.'));if(!isNaN(nb))e.style.width=Math.max(0,Math.min(100,nb))+'%';}); // Meter-Balken
    }
    function _apply1(w,root){try{
      var el=$('.w[data-id="'+w.id+'"]',root);if(!el)return;
      var _dn=null;if(!d.s){var _rr=parseFloat(String(d.v).replace(',','.'));if(!isNaN(_rr)){var _scv=(w.scale!=null&&w.scale!==''&&+w.scale!==1)?(_rr*(+w.scale)):_rr;if(w.dec!=null||_scv!==_rr||w.thousand||w.numAbbrev)_dn=_fmtNum(_scv,w);}} // Nachkommastellen/Faktor/Tausender/Kürzung aus Rohwert (nicht bei String-Formel); ungesetzt = wie bisher
      var _vb=(_dn!=null)?((w.suf||w.unit)?_dn:(_pu?(_dn+' '+_pu.trim()):_dn)):((w.suf||w.unit)?num:base); // dec -> Zahl (+ Profil-Einheit falls keine Widget-Einheit); sonst wie gehabt
      var _b=w.fmt?fmtVal(w,d,base):_vb;var txt=(w.pre||w.suf)?((w.pre||'')+_b+(w.suf||'')):_b; // Format + Präfix/Suffix
      if(w.nullText!=null&&w.nullText!==''&&(d.v==null||String(d.v).trim()===''))txt=w.nullText; // einheitlicher Text bei leerem Wert
      if(w.icon&&AICONS[w.icon]&&w.varId===id){var _ai=$('svg[data-ai]',el);if(_ai)_ai.outerHTML=iconSVG(w.icon,d.v);} // adaptives Icon (0–100 % / Zustand)
      if(w.assocOn&&w.varId===id)applyAssoc(w,el,d.v); // Icon/Farbe aus Variablen-Assoziation
      if((w.type==='kpi'||w.type==='delta')&&w.cmpOn&&w.varId===id)computeCompare(w); // Zeitversatz-Vergleich
      if(w.visVar&&w.visVar===id)el.style.display=(mode==='edit'||evalVis(w,d))?'':'none'; // C1: Sichtbarkeit per Variable (nicht im Edit)
      var _wr=WIDGETS[w.type];if(_wr&&_wr.live){if(widgetDataId(w,id))_wr.live(w,el,id,d,base,txt,on);return;} // Registry-Widget (nur eigene Daten-IDs)
      if(w.varId!==id)return;
      var v=$('[data-role=val]',el);if(v)v.textContent=txt;
      var sw=$('[data-role=sw]',el);if(sw)sw.classList.toggle('on',on);
    }catch(_e){if(window.console&&console.error)console.error('live '+(w&&w.type)+'#'+(w&&w.id),_e);}} // ein defektes Widget darf die Live-Schleife nicht abbrechen
    if(!_vidx)buildVidx();
    var _lst=_vidx[id];if(_lst)for(var _i=0;_i<_lst.length;_i++)_apply1(_lst[_i].w,_lst[_i].root); // nur Widgets, die diese ID binden
  }
  function pollVals(){
    if(!_vidx)buildVidx();
    var ids=Object.keys(_vidx).filter(function(k){return /^[0-9]+$/.test(k);}); // nur echte IDs pollen (Formel-Token ausgenommen)
    if(!ids.length){_recalcFormulas();return;}
    fetch('?api=val&ids='+ids.join(',')+'&since='+_pvSince,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j)return;if(j.ts)_pvSince=j.ts;if(!j.values)return;
      _liveSrc='poll';for(var id in j.values){applyVal(parseInt(id),j.values[id]);}
      _recalcFormulas();
    }).catch(function(){});
  }
  function startPV(ms){stopPV();_pvT=setInterval(pollVals,ms||1200);}
  function stopPV(){if(_pvT){clearInterval(_pvT);_pvT=null;}}
  document.addEventListener('visibilitychange',function(){if(document.hidden){stopPV();}else{_pvSince=0;pollVals();startPV(_wsOK?5000:1200);}});

  // ===== WebSocket-Push (deckt MAP-Variablen sofort; Poll bleibt für alle Bindungen) =====
  var WS_PORT="__LV_WSPORT__",WS_URL="__LV_WSURL__",_ws=null,_wsOK=false,_wsTries=0,_wsLast=0,_wsWd=null,_wsWhy='';
  // Adresse des Push-Servers. Es gibt keinen Weg, der ueberall stimmt, also werden mehrere
  // durchprobiert und der erste behalten, der antwortet:
  //   1. ausdruecklich konfigurierte Adresse (Instanz -> WebSocket-Adresse) - gewinnt immer
  //   2. bei HTTPS: gleiche Herkunft ohne Port, Pfad /wss  (der TLS-Endpunkt reicht durch)
  //   3. Host der Seite mit dem konfigurierten Port, Schema passend zur Seite
  // Warum das noetig ist: "ws://<Seiten-Host>:<Port>" geht nur im direkten LAN auf. Hinter
  // einem Proxy zeigt der Hostname auf den Proxy, der Port 8082 nicht veroeffentlicht; und aus
  // einer ueber HTTPS geladenen Seite verweigern Browser jedes unverschluesselte ws:// - der
  // Konstruktor wirft dann sofort, ohne dass ein Paket fliegt. Beides sieht von aussen gleich
  // aus, darum wird durchgetauscht statt geraten.
  function wsCandidates(){
    var out=[],sec=(location.protocol==='https:'),port=(WS_PORT&&WS_PORT.indexOf('__LV_')!==0)?WS_PORT:'';
    if(WS_URL&&WS_URL.indexOf('__LV_')!==0)out.push(WS_URL);
    if(sec){
      out.push('wss://'+location.host+'/wss');
      if(port)out.push('wss://'+location.hostname+':'+port);
    }else{
      if(port)out.push('ws://'+location.hostname+':'+port);
      out.push('ws://'+location.host+'/wss');
    }
    return out;
  }
  var _wsIdx=0,_wsGood='';
  function refreshMedia(mid){var u='?api=media&id='+mid+'&t='+Date.now();$$('img[data-media="'+mid+'"]',canvas).forEach(function(e){e.src=u;});var ov=$('#ovcanvas');if(ov)$$('img[data-media="'+mid+'"]',ov).forEach(function(e){e.src=u;});} // Kamera bei MM_UPDATE-Push neu laden
  function wsConnect(){
    var list=wsCandidates();
    if(!list.length){_wsWhy='WebSocket ungenutzt: keine Adresse ermittelbar. Live-Werte kommen per Poll.';return;}
    var u=_wsGood||list[_wsIdx%list.length];
    // KEIN endgueltiges Aufgeben: vorher wurde nach 5 Fehlversuchen dauerhaft auf Poll
    // zurueckgefallen, bis jemand die Seite neu laedt. Schon ein Neustart des Push-Moduls
    // oder eine Minute Funkloch degradierte den Client damit stillschweigend fuer immer.
    // Stattdessen unbegrenzt weiterversuchen, Abstand aber bei 30 s deckeln - das sind
    // zwei Versuche pro Minute, also weder Reconnect-Sturm noch Log-Flut.
    // Fehler NICHT stillschweigend verschlucken - genau das hat den Mixed-Content-Fall
    // lange unauffindbar gemacht: kein Socket, keine Meldung, nur traeges Polling.
    // Wirft der Konstruktor (typisch: ws:// aus einer HTTPS-Seite), sofort den naechsten
    // Kandidaten nehmen statt still ins Polling zu fallen.
    try{_ws=new WebSocket(u);}catch(e){
      _wsWhy='WebSocket abgelehnt ('+u+'): '+(e&&e.message?e.message:e);
      _wsGood='';_wsIdx++;_wsTries++;setTimeout(wsConnect,Math.min(30000,2000*_wsTries));return;}
    _ws.onopen=function(){_wsLast=Date.now();try{_ws.send('hello');}catch(e){}};
    _ws.onmessage=function(ev){_wsOK=true;_wsTries=0;_wsLast=Date.now();_wsGood=u;_wsWhy='';if(bcfg().noSafetyPoll)stopPV();else startPV(5000);try{var j=JSON.parse(ev.data);if(j&&j.reload&&RUN){location.reload();return;}if(j&&j.values){_liveSrc='ws';for(var k in j.values){var d=j.values[k];if(d&&d.id)applyVal(d.id,d);}}if(j&&j.media&&j.media.length)j.media.forEach(function(mid){refreshMedia(mid);});}catch(e){}}; // Werte + Kamera-Medien-Push
    _ws.onclose=function(){_wsOK=false;startPV(1200);_wsTries++;
      if(!_wsGood){_wsIdx++;_wsWhy='WebSocket ohne Antwort ueber '+u+', versuche naechste Adresse.';} // nie etwas empfangen -> naechster Kandidat
      setTimeout(wsConnect,Math.min(30000,2000*_wsTries));}; // Backoff 2s,4s,6s... gedeckelt auf 30s, ohne Obergrenze der Versuche
    _ws.onerror=function(){try{_ws.close();}catch(e){}};
  }
  // Wachhund gegen halbtote Verbindungen. Bleibt der Socket auf TCP-Ebene offen, waehrend
  // der Server nicht mehr hineinschreibt (beobachtet nach IPS_ApplyChanges auf der
  // Push-Instanz: Client-Liste neu aufgebaut, alte Sockets nicht geschlossen), dann kommt
  // WEDER onclose NOCH onerror. Der Client haelt sich fuer verbunden, der Reconnect greift
  // nie und die Anzeige lebt still von Poll weiter. Also selbst nachsehen: kommt lange
  // nichts, die Verbindung zwangsweise schliessen - das loest onclose und damit den
  // Reconnect aus. Schwelle bewusst gross, damit ein ruhiges Haus keinen Neuaufbau ausloest.
  function wsWatchdog(){
    if(!wsCandidates().length)return;
    if(_ws&&_ws.readyState===1&&_wsLast&&(Date.now()-_wsLast)>120000){
      try{_ws.close();}catch(e){}                 // onclose uebernimmt den Wiederaufbau
    }
  }
  startPV();wsConnect();_wsWd=setInterval(wsWatchdog,30000);
  function setVar(id,val){if(typeof DOKU!=='undefined'&&DOKU&&typeof dokuSetVar==='function'){dokuSetVar(id,val);return;} // Doku: lokal, nie an den Server
  fetch('?api=setvar&id='+id+'&value='+encodeURIComponent(val)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'}).then(function(){setTimeout(pollVals,250);});}

  // ---------- Variablen-Baum ----------
  var _bindTarget=null,_bindTarget2=null,_bindTarget3=null,_bindVis=null,_bindObj=null,_bindField=null,_bindSeries=null;
  function setPath(obj,path,val){var p=path.split('.'),o=obj,i;for(i=0;i<p.length-1;i++){var k=p[i];if(o[k]==null)o[k]=(/^\d+$/.test(p[i+1]))?[]:{};o=o[k];}o[p[p.length-1]]=val;}
  function getPath(obj,path){var p=path.split('.'),o=obj,i;for(i=0;i<p.length;i++){if(o==null)return undefined;o=o[p[i]];}return o;}
  function iconFor(t){var id=t===0?'ic-folder':t===1?'ic-cube':t===2?'ic-tag':t===3?'ic-code':t===5?'ic-image':'ic-dot';return '<svg class="i"><use href="#'+id+'"/></svg>';}
  function nodeEl(n){
    var d=document.createElement('div');d.className='node'+(n.type===2?' var':'');
    var tw=n.children?'<span class="tw"><svg class="i"><use href="#ic-chevron"/></svg></span>':'<span class="tw"></span>';
    d.innerHTML=tw+'<span class="ic">'+iconFor(n.type)+'</span><span class="nm">'+esc(n.name)+(n.path?'<span class="npath">'+esc(n.path)+' · #'+n.id+'</span>':'')+'</span>'+(n.type===2?'<span class="val">'+esc(n.value||'')+'</span>':'');
    if(n.path)d.title=n.path+'  (#'+n.id+')';
    d.dataset.id=n.id;d.dataset.type=n.type;d.dataset.children=n.children?1:0;
    if(n.type===2){d._var=n;}
    d.onclick=function(e){
      e.stopPropagation();
      if(n.type===2){bindVar(n);return;}
      if(!n.children)return;
      var nx=d.nextSibling;
      if(nx&&nx.classList&&nx.classList.contains('kids')){nx.remove();d.querySelector('.tw').classList.remove('open');return;}
      d.querySelector('.tw').classList.add('open');
      var box=document.createElement('div');box.className='kids';d.after(box);
      fetch('?api=tree&parent='+n.id,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        (j.nodes||[]).forEach(function(c){box.appendChild(nodeEl(c));});
      });
    };
    return d;
  }
  function autoUnit(w,n){ // Profil-Einheit ins passende Feld vorausfüllen (nur wenn leer)
    var su=(n&&n.suffix!=null)?String(n.suffix):'';if(!su)return;
    if(w.type==='value'){if(!w.suf)w.suf=su;}
    else if(w.type==='kpi'||w.type==='calc'||w.type==='cval'||w.type==='sval'||w.type==='valuecard'){if(!w.unit)w.unit=su.replace(/^\s+/,'');}
  }
  function bindVar(n){
    if(_bindSeries){var wS=widget(_bindSeries.wid);if(wS){_ensureSeries(wS);var se=wS.series[_bindSeries.idx]=(wS.series[_bindSeries.idx]||{});se.vid=n.id;if(!se.name)se.name=n.name;delete _hist[wS.id];render();select(wS.id);fetchHist(wS);toast('Serie gebunden: '+n.name);}_bindSeries=null;return;}
    if(_bindField){var wfd=widget(_bindField.wid);if(wfd){setPath(wfd,_bindField.path,n.id);render();select(wfd.id);toast('Gebunden: '+n.name);}_bindField=null;return;}
    if(_bindObj){var wob=widget(_bindObj);if(wob){wob.objId=n.id;render();select(wob.id);fetchObjInfo(wob);toast('Objekt: '+n.name);}_bindObj=null;return;}
    if(_bindVis){var wvs=widget(_bindVis);if(wvs){wvs.visVar=n.id;render();select(wvs.id);toast('Sichtbarkeit: '+n.name);}_bindVis=null;return;}
    if(_bindTarget3){var w3=widget(_bindTarget3);if(w3){w3.varId3=n.id;render();select(w3.id);toast('Untergang: '+n.name);}_bindTarget3=null;return;}
    if(_bindTarget2){var w2=widget(_bindTarget2);if(w2){w2.varId2=n.id;render();select(w2.id);toast('Gebunden: '+n.name);}_bindTarget2=null;return;}
    if(_bindTarget){var w=widget(_bindTarget);if(w){w.varId=n.id;if(!w.label||w.label==='Label')w.label=n.name;autoUnit(w,n);render();select(w.id);toast('Gebunden: '+n.name);}_bindTarget=null;return;}
    // sonst neue Wert-Kachel
    var _nv={varId:n.id,label:n.name};if(n.suffix)_nv.suf=String(n.suffix);addWidget('value',_nv);toast('Kachel + Variable: '+n.name);
  }
  function loadTree(parent,box){fetch('?api=tree&parent='+parent,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){box.innerHTML='';(j.nodes||[]).forEach(function(c){box.appendChild(nodeEl(c));});});}
  function doSearch(q){var box=$('#tree');q=(q||'').trim();
    if(!q){loadTree(0,box);return;}
    box.innerHTML='<div class="hint">Suche …</div>';
    fetch('?api=tree&search='+encodeURIComponent(q),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      box.innerHTML='';(j.nodes||[]).forEach(function(c){box.appendChild(nodeEl(c));});if(!(j.nodes||[]).length)box.innerHTML='<div class="hint">Nichts gefunden.</div>';
    }).catch(function(){box.innerHTML='<div class="hint">Fehler bei der Suche.</div>';});}
  var _srchT;
  $('#search').addEventListener('input',function(){var q=this.value;clearTimeout(_srchT);_srchT=setTimeout(function(){var t=q.trim();if(t===''||t.length>=2)doSearch(q);},300);});
  $('#search').addEventListener('keydown',function(e){if(e.key==='Enter'){clearTimeout(_srchT);doSearch(this.value);}});

  // ---------- Tabs / Toolbar ----------
  function showTab(t){$$('.tab').forEach(function(x){x.classList.toggle('on',x.dataset.tab===t);});$$('.pane').forEach(function(x){x.classList.toggle('on',x.dataset.pane===t);});if(typeof _bsSave==='function')_bsSave();}
  $$('.tab').forEach(function(x){x.onclick=function(){showTab(x.dataset.tab);};});
  // Farbverwaltung
  var DEFPAL=['#00cdab','#5ab6ff','#39d08a','#f2b441','#f2685a','#e7eef0','#8ba0a6','#1a2428'];
  function applyColor(hex,bg){var ids=Object.keys(sel);if(!ids.length){toast('Erst Widgets auswählen');return;}ids.forEach(function(id){var w=widget(id);if(bg)w.bg=hex;else w.fg=hex;});render();}
  function buildSwatches(){var box=$('#swatches');if(!box)return;if(!store.palette)store.palette=DEFPAL.slice();box.innerHTML='';store.palette.forEach(function(hex,i){var s=document.createElement('div');s.className='swatch';s.style.background=hex;s.title=hex+' — Klick: Text · Shift+Klick: Hintergrund';s.onclick=function(e){applyColor(hex,e.shiftKey);};var x=document.createElement('span');x.className='x';x.textContent='×';x.onclick=function(e){e.stopPropagation();store.palette.splice(i,1);buildSwatches();};s.appendChild(x);box.appendChild(s);});}
  $('#addColor').onclick=function(){if(!store.palette)store.palette=DEFPAL.slice();store.palette.push($('#newColor').value);buildSwatches();};
  // ---------- Bausteine (Custom-Widgets aus Auswahl) ----------
  function saveBlock(){
    var ids=Object.keys(sel);if(!ids.length&&selId)ids=[selId];
    var ws=state.widgets.filter(function(w){return ids.indexOf(w.id)>=0;});
    if(!ws.length){toast('Erst Elemente auswählen');return;}
    var minX=Math.min.apply(null,ws.map(function(w){return w.x;})),minY=Math.min.apply(null,ws.map(function(w){return w.y;}));
    var maxX=Math.max.apply(null,ws.map(function(w){return w.x+w.w;})),maxY=Math.max.apply(null,ws.map(function(w){return w.y+w.h;}));
    var name=prompt('Name des Bausteins:','Baustein '+(Object.keys(store.blocks||{}).length+1));if(!name)return;
    store.blocks=store.blocks||{};
    store.blocks[name]={w:Math.round(maxX-minX),h:Math.round(maxY-minY),widgets:ws.map(function(w){var c=JSON.parse(JSON.stringify(w));c.x=w.x-minX;c.y=w.y-minY;delete c.id;return c;})};
    buildBlocks();commit();toast('Baustein „'+name+'" gespeichert ('+ws.length+' Elemente) — Speichern nicht vergessen');
  }
  function insertBlock(name,px,py){
    var b=(store.blocks||{})[name];if(!b)return;
    var ox=(px!=null?snap(Math.max(0,px)):snap(40)),oy=(py!=null?snap(Math.max(0,py)):snap(40));
    selClear();var newIds=[],gmap={};
    (b.widgets||[]).forEach(function(cw){var c=JSON.parse(JSON.stringify(cw));c.id=uid();c.x=snap(ox+(cw.x||0));c.y=snap(oy+(cw.y||0));
      if(c.group){if(!gmap[c.group])gmap[c.group]='g'+uid();c.group=gmap[c.group];}                 // Gruppen je Einfügung neu binden
      if(c.kids)c.kids.forEach(function(k){if(k)k.id=uid();});                 // Container/Alarm-Panel: Kind-IDs neu vergeben (sonst Kollision bei Mehrfach-Einfügung)
      state.widgets.push(c);newIds.push(c.id);});
    render();newIds.forEach(function(i){sel[i]=true;});selId=newIds[newIds.length-1]||null;markSel();renderProps();commit();
  }
  function buildBlocks(){
    var box=$('#blocks');if(!box)return;var bl=store.blocks||{},keys=Object.keys(bl);
    var tools='<div style="display:flex;gap:6px;margin-bottom:8px"><button class="btn" id="blkExp" style="padding:4px 8px;font-size:11px">Export</button><button class="btn" id="blkImp" style="padding:4px 8px;font-size:11px">Import</button></div>';
    var body=keys.length?keys.map(function(n){return '<div class="pitem blk" data-blk="'+esc(n)+'" title="Klicken/Ziehen zum Einfügen">'+esc(n)+'<span class="blkx" data-blkdel="'+esc(n)+'" title="Löschen">×</span></div>';}).join(''):'<div style="font-size:11px;color:var(--faint);padding:2px 2px">Noch keine. Elemente wählen → „Baustein".</div>';
    box.innerHTML=tools+body;
    if($('#blkExp'))$('#blkExp').onclick=function(){var a=document.createElement('a');a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(store.blocks||{},null,1));a.download='bausteine.json';document.body.appendChild(a);a.click();a.remove();};
    if($('#blkImp'))$('#blkImp').onclick=function(){var inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';inp.onchange=function(){var f=inp.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var j=JSON.parse(r.result);store.blocks=store.blocks||{};for(var k in j)store.blocks[k]=j[k];migrateStore(store);buildBlocks();commit();toast('Bausteine importiert');}catch(e){toast('Ungültige Datei');}};r.readAsText(f);};inp.click();};
    $$('#blocks .blk').forEach(function(el){
      el.onclick=function(e){if(e.target.getAttribute('data-blkdel')!=null)return;insertBlock(el.getAttribute('data-blk'));};
      el.setAttribute('draggable','true');
      el.addEventListener('dragstart',function(e){e.dataTransfer.setData('text/hlwblock',el.getAttribute('data-blk'));e.dataTransfer.effectAllowed='copy';});
    });
    $$('#blocks [data-blkdel]').forEach(function(x){x.onclick=function(e){e.stopPropagation();var nm=x.getAttribute('data-blkdel');if(confirm('Baustein „'+nm+'" löschen?')){delete store.blocks[nm];buildBlocks();commit();}};});
  }
  if($('#blockBtn'))$('#blockBtn').onclick=saveBlock;
  // ---------- Skins (Design-Konfigurator: Farben/Schriften, Dark+Light) ----------
  var SKIN_TOKENS=['bg','surface','surface-2','tile','line','line-soft','text','muted','faint','accent','accent-2','ok','warn','crit','info','warm'];
  // Selbst gehostete Schriften (OFL/gratis, via ?api=font). Inter = UI-Sans, JetBrains Mono = Mono, Lora = Serif (Claude).
  var SKIN_FU='"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif',SKIN_FM='"JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace';
  var SKIN_SERIF='"Lora",Georgia,"Times New Roman",serif';
  var BUILTIN={
    'Standard':{fu:SKIN_FU,fm:SKIN_FM,
      dark:{bg:'#0d1315',surface:'#141c1f','surface-2':'#1a2428',tile:'#131b1e',line:'#25333a','line-soft':'#1b262b',text:'#e7eef0',muted:'#8ba0a6',faint:'#63757b',accent:'#00cdab','accent-2':'#0a8f79',ok:'#39d08a',warn:'#f2b441',crit:'#f2685a',info:'#5ab6ff',warm:'#f2a03d'},
      light:{bg:'#eef1f2',surface:'#ffffff','surface-2':'#f2f5f6',tile:'#f8fafb',line:'#dbe2e5','line-soft':'#e9eef0',text:'#17242a',muted:'#5b6b72',faint:'#93a2a8',accent:'#00937c','accent-2':'#00b294',ok:'#1a9c6b',warn:'#c8871a',crit:'#d64535',info:'#2f7fd6',warm:'#d98a1a'}},
    'Indigo':{fu:SKIN_FU,fm:SKIN_FM,
      dark:{bg:'#0e1220',surface:'#161b2e','surface-2':'#1d2440',tile:'#141a2b',line:'#2a3350','line-soft':'#1e2540',text:'#e8ecf8',muted:'#9aa3c0',faint:'#6b7495',accent:'#818cf8','accent-2':'#6366f1',ok:'#39d08a',warn:'#f2b441',crit:'#f2685a',info:'#60a5fa',warm:'#f2a03d'},
      light:{bg:'#eef0f7',surface:'#ffffff','surface-2':'#f3f4fb',tile:'#f8f9fe',line:'#dde0ef','line-soft':'#eaecf7',text:'#1a1f38',muted:'#5b6285',faint:'#9298b8',accent:'#4f46e5','accent-2':'#6366f1',ok:'#1a9c6b',warn:'#c8871a',crit:'#d64535',info:'#2f6fe0',warm:'#d98a1a'}},
    'Bernstein':{fu:SKIN_FU,fm:SKIN_FM,
      dark:{bg:'#141110',surface:'#1e1a17','surface-2':'#262019',tile:'#1a1613',line:'#39301f','line-soft':'#241d16',text:'#f0e9df',muted:'#a89b88',faint:'#77685a',accent:'#f5a524','accent-2':'#d98a1a',ok:'#39d08a',warn:'#f2b441',crit:'#f2685a',info:'#5ab6ff',warm:'#f5a524'},
      light:{bg:'#f5f1ea',surface:'#fffdf9','surface-2':'#f3ede2',tile:'#faf6ef',line:'#e2d7c4','line-soft':'#efe8db',text:'#2a2115',muted:'#6f6250',faint:'#a2917a',accent:'#c8871a','accent-2':'#a56f14',ok:'#1a9c6b',warn:'#c8871a',crit:'#d64535',info:'#2f7fd6',warm:'#c8871a'}},
    // „Claude" — Anthropic-Clay/Creme: warmes Off-White (hell) bzw. warmes Anthrazit (dunkel), Akzent = Claude-Terrakotta, Serifen-UI (Lora)
    'Claude':{fu:SKIN_SERIF,fm:SKIN_FM,
      dark:{bg:'#201e1a',surface:'#2a2723','surface-2':'#322e29',tile:'#24211c',line:'#3b362e','line-soft':'#2b2721',text:'#ece7dd',muted:'#a69e90',faint:'#6f685b',accent:'#d9805c','accent-2':'#c4613e',ok:'#5cb682',warn:'#e0a83e',crit:'#e8705c',info:'#6fa8db',warm:'#cc785c'},
      light:{bg:'#f0eee6',surface:'#fbfaf6','surface-2':'#f1eee4',tile:'#f6f4ec',line:'#e1dbcc','line-soft':'#ece7da',text:'#2b2620',muted:'#6a6459',faint:'#9a9284',accent:'#be5d39','accent-2':'#a24c2c',ok:'#4f9d69',warn:'#c88a2a',crit:'#c64c3c',info:'#3f7cb3',warm:'#cc785c'}}
  };
  // Weitere Standard-Skins — nur Akzentfarben variiert (Neutrals = Standard, je Dark+Light)
  var _cl=function(o){var r={},k;for(k in o)r[k]=o[k];return r;};
  var ACCENTS={
    'Smaragd':{d:['#34d399','#059669'],l:['#059669','#10b981']},
    'Ozean':{d:['#38bdf8','#0284c7'],l:['#0284c7','#0ea5e9']},
    'Violett':{d:['#a78bfa','#7c3aed'],l:['#7c3aed','#8b5cf6']},
    'Koralle':{d:['#fb7185','#e11d48'],l:['#e11d48','#f43f5e']},
    'Rose':{d:['#f472b6','#db2777'],l:['#db2777','#ec4899']},
    'Limette':{d:['#a3e635','#65a30d'],l:['#65a30d','#84cc16']},
    'Gold':{d:['#fbbf24','#d97706'],l:['#d97706','#f59e0b']},
    'Stahl':{d:['#94a3b8','#64748b'],l:['#475569','#64748b']}
  };
  (function(){for(var nm in ACCENTS){var a=ACCENTS[nm],d=_cl(BUILTIN['Standard'].dark),l=_cl(BUILTIN['Standard'].light);d.accent=a.d[0];d['accent-2']=a.d[1];l.accent=a.l[0];l['accent-2']=a.l[1];BUILTIN[nm]={fu:SKIN_FU,fm:SKIN_FM,dark:d,light:l};}})();
  function allSkins(){var o={},k;for(k in BUILTIN)o[k]=BUILTIN[k];if(store.skins)for(k in store.skins)o[k]=store.skins[k];return o;}
  function activeSkin(){return allSkins()[store.skin]||BUILTIN['Standard'];}
  function applySkin(){
    var sk=activeSkin(),th=(store.theme==='light'?'light':'dark'),toks=sk[th]||sk.dark,rs=document.documentElement.style;
    SKIN_TOKENS.forEach(function(k){if(toks[k]!=null)rs.setProperty('--'+k,toks[k]);});
    (sk.extra||[]).forEach(function(e){if(e&&e.key&&toks[e.key]!=null)rs.setProperty('--'+e.key,toks[e.key]);}); // eigene benannte Skin-Farben
    if(sk.fu)rs.setProperty('--fu',sk.fu);if(sk.fm)rs.setProperty('--fm',sk.fm);
    rs.setProperty('--ring','0 0 0 3px color-mix(in oklab,'+(toks.accent||'#00cdab')+' 38%,transparent)');
    document.documentElement.setAttribute('data-theme',th);rs.colorScheme=th;
    document.body.classList.toggle('wglow',!!(store.cfg&&store.cfg.wglow)); // optionaler Widget-Glow (Akzentfarbe)
    updateSkinSwitches();
    // HTML-Inhalte neu rendern -> Skin-Enforcer zieht Schrift/Farben ans neue Theme nach (Shadow/iframe rechnen Farben beim Rendern)
    // Widgets nachziehen, die den Skin nicht ueber CSS bekommen:
    //  - html: Inhalt neu rendern (Shadow/iframe rechnen Farben beim Rendern aus)
    //  - Zeichenflaechen: eigener skin()-Haken, sonst blieben sie bis zum naechsten
    //    Datentakt in den alten Farben stehen (Canvas erbt keine CSS-Variablen)
    try{
      var _re=function(w){
        if(!w)return;
        if(w.type==='html'){if(w.htmlSrc==='custom')setHtmlContent(w,w.html||'');else fetchHtml(w);return;}
        var d=WIDGETS[w.type];
        if(d&&typeof d.skin==='function'){
          var el=document.querySelector('.w[data-id="'+w.id+'"]');
          if(el)try{d.skin(w,el);}catch(e2){}
        }
      };
      if(typeof state!=='undefined'&&state.widgets)allWidgets().forEach(_re);
      if(typeof _tickKids!=='undefined'&&_tickKids)_tickKids.forEach(_re);
    }catch(e){}
    // Zusaetzlich die selbst angemeldeten Zeichenflaechen. Der Weg ueber die Widget-Liste
    // allein genuegt NICHT: allWidgets() kennt nur state.widgets und die Leisten-Kinder -
    // ein Widget in einem Container, Panel oder einer Komponente stand nie darin und blieb
    // deshalb in den alten Farben. Wer sich hier anmeldet, wird immer erreicht.
    try{ (window.LV_SKIN_HOOKS||[]).forEach(function(f){ try{ f(); }catch(e3){} }); }catch(e4){}
  }
  function updateSkinSwitches(){$$('.hskwb').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-skw')===(store.theme||'dark'));});$$('[data-role=skwsel]',canvas).forEach(function(s){s.value=store.skin||'Standard';});}
  // Auto-Fork: sobald an einem eingebauten (schreibgeschuetzten) Skin etwas geaendert wird, legen wir
  // automatisch eine editierbare Kopie „<Name> (eigen)" an und aktivieren sie. Gibt den aktiven Skin-Namen zurueck.
  function _ensureEditableSkin(){
    var a=store.skin;
    if(!BUILTIN[a]&&store.skins&&store.skins[a])return a;   // schon eigener Skin
    var base=activeSkin(),nm=a+' (eigen)',i=2;while(allSkins()[nm]){nm=a+' (eigen '+i+')';i++;}
    store.skins=store.skins||{};store.skins[nm]=JSON.parse(JSON.stringify(base));store.skin=nm;
    if(typeof toast==='function')toast('Editierbare Kopie „'+nm+'" angelegt');
    return nm;
  }
  // Farbe setzen. Standardmaessig NUR im gerade aktiven Theme — mit store.cfg.skinBoth
  // in BEIDEN. Ohne diese Option ist die haeufigste Falle: man aendert im Hellmodus,
  // schaut im Run aber Dunkel an und sieht die Aenderung nicht (das Theme merkt sich
  // der Browser zusaetzlich in localStorage 'lvtheme').
  function editSkinToken(k,val){var a=_ensureEditableSkin();
    var both=!!(store.cfg&&store.cfg.skinBoth);
    var ths=both?['dark','light']:[(store.theme==='light'?'light':'dark')];
    ths.forEach(function(th){store.skins[a][th]=store.skins[a][th]||{};store.skins[a][th][k]=val;});
    applySkin();commit();}
  function editSkinFont(k,val){var a=_ensureEditableSkin();store.skins[a][k]=val;applySkin();commit();}
  // ---- Eigene, benannte Skin-Farben (pro Skin; erscheinen ueberall in den Farbwaehlern) ----
  function _colorSlug(name){var s=(''+name).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return 'u-'+(s||'farbe');}
  function skinExtras(){var s=activeSkin();return (s&&s.extra)||[];}
  function addSkinColor(name,hex){
    name=(''+(name||'')).trim();if(!name)return;
    var a=_ensureEditableSkin(),sk=store.skins[a];sk.extra=sk.extra||[];
    var key=_colorSlug(name),base=key,n=2;while(sk.extra.some(function(e){return e.key===key;})){key=base+'-'+n;n++;}
    sk.extra.push({key:key,name:name});
    sk.dark=sk.dark||{};sk.light=sk.light||{};
    var d=hex||'#00cdab';sk.dark[key]=sk.dark[key]||d;sk.light[key]=sk.light[key]||d; // Startwert fuer beide Themes
    applySkin();commit();if(typeof buildSkins==='function')buildSkins();
    if(typeof toast==='function')toast('Farbe „'+name+'" angelegt');
  }
  function renameSkinColor(key,name){name=(''+(name||'')).trim();if(!name)return;var a=_ensureEditableSkin(),sk=store.skins[a];(sk.extra||[]).forEach(function(e){if(e.key===key)e.name=name;});commit();if(typeof buildSkins==='function')buildSkins();}
  function deleteSkinColor(key){var a=_ensureEditableSkin(),sk=store.skins[a];sk.extra=(sk.extra||[]).filter(function(e){return e.key!==key;});if(sk.dark)delete sk.dark[key];if(sk.light)delete sk.light[key];applySkin();commit();if(typeof buildSkins==='function')buildSkins();}
  function newSkin(dup){var base=dup?activeSkin():BUILTIN['Standard'];var nm=prompt('Name des Skins:',dup?((store.skin||'Standard')+' Kopie'):'Mein Skin');if(!nm)return;if(allSkins()[nm]){toast('Name existiert bereits');return;}store.skins=store.skins||{};store.skins[nm]=JSON.parse(JSON.stringify(base));store.skin=nm;applySkin();buildSkins();commit();toast('Skin „'+nm+'" angelegt');}
  function deleteSkin(){var a=store.skin;if(BUILTIN[a])return;if(!confirm('Skin „'+a+'" löschen?'))return;delete store.skins[a];store.skin='Standard';applySkin();buildSkins();commit();}
