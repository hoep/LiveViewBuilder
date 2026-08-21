  // ===== Widget: Regel-Tabelle (ruletable) — Matrix Regel x Feld, Schema v2 =====
  //
  //  Fuer Geraete-Regelmatrizen (ProCon TEMPC / ADCC / DIGC): eine ZEILE je Regel,
  //  eine SPALTE je Feld, jede Zelle an eine eigene Geraetevariable gebunden.
  //
  //  Warum kein neuer Typ: der Bindekanal ist w.items[].vid, und genau den sammeln
  //  _collectIds/widgetDataId (06-live.js). Ein zweiter Typ haette daran nichts gebessert,
  //  aber die drei bestehenden Seiten-JSONs entwertet. Das Altschema (cols ohne key,
  //  rowLabels als String-Array) ist eine echte Teilmenge des neuen und wird von _rtNorm
  //  verlustfrei und idempotent gehoben - ohne zu speichern, ohne Migrationsdatei.
  //
  //  Warum die Zeilen NICHT umsortierbar sind: der Zeilenindex ist die Regelnummer und die
  //  Regelnummer ist laut Geraetehandbuch die Prioritaet. Eine Pfeiltaste an dieser Stelle
  //  wuerde die Wirkung der Anlage aendern, ohne dass es jemand sieht.
  //
  //  Warum es kein prompt() und kein Durchklicken von Optionen mehr gibt: das Durchklicken
  //  erzeugte bei "Ausgang" bis zu 15 echte Geraetewrites hintereinander. Jeder davon ist am
  //  HSPC ein vollstaendiger Read-Modify-Write der INI-Sektion gegen ein Stundenbudget, mit
  //  Zwangspause bei gehaltener Geraete-Semaphore. Jede Aenderung laeuft daher ueber das
  //  Editiersheet und erzeugt GENAU EINEN Schreibvorgang.

  // ---------- Konstanten fuer Panel-Auswahlfelder ----------
  var _RT_TYPES=[['bool','Schalter'],['sel','Auswahl'],['num','Zahl'],['time','Uhrzeit'],['dur','Dauer'],['temp','Temperatur'],['text','nur Anzeige']];
  var _RT_OPS  =[['eq','='],['ne','≠'],['lt','<'],['le','≤'],['gt','>'],['ge','≥'],['in','in Liste'],['eqCol','= Spalte'],['any','immer']];
  var _RT_ACTS =[['disable','sperren'],['dim','abblenden'],['hide','verbergen'],['require','Pflichtfeld']];
  var _RT_LVLS =[['info','Hinweis'],['warn','Warnung'],['crit','Kritisch']];
  var _RT_DENS ={kompakt:'clamp(26px,7cqmin,40px)',normal:'clamp(34px,9cqmin,54px)',weit:'clamp(42px,11cqmin,66px)'};

  // Laufzeitzustand - bewusst NICHT am Widget, damit nichts davon im Seiten-JSON landet.
  var _rtLockT={};      // Widget-ID -> Zeitpunkt, bis zu dem das Schloss offen ist
  var _rtPend ={};      // vid -> {v,t}  gesendet, noch unbestaetigt
  var _rtFail ={};      // vid -> 1      Geraet hat den Wert nicht uebernommen
  var _rtPrf  ={};      // Profilname -> Profildaten (Optionen, Grenzen, Nachkomma)
  var _rtPrfV ={};      // vid -> Profilname (Musterzelle je Spalte, nicht je Zelle)
  var _rtPrfW ={};      // vid -> wartende Rueckrufe
  var _rtNm   ={};      // vid -> {name,act}  Variablenname fuers Panel
  var _rtNmW  ={};      // vid -> laufender Abruf
  var _rtNmT  =null;    // gebuendeltes renderProps() nach dem Nachladen von Namen
  var _rtPrev ={};      // Widget-ID -> Vorschautext des Einlesens
  var _rtRepT ={};      // Widget-ID -> gebuendelter Neuanstrich

  // ---------- Normalisierung (Altschema -> v2) ----------
  // Idempotent, mutiert w in place, ruft NIE commit(). Erste Anweisung in jedem Haken.
  function _rtSlug(s){
    return String(s==null?'':s).toLowerCase()
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
      .replace(/[^a-z0-9]+/g,'_').replace(/_{2,}/g,'_').replace(/^_+|_+$/g,'')||'sp';
  }
  function _rtNorm(w){
    if(w.rtVer!==2){
      var cols=w.cols||(w.cols=[]),seen={};
      cols.forEach(function(c,i){
        if(!c.key){var k=_rtSlug(c.label||('sp'+i));while(seen[k])k+='_';c.key=k;}
        seen[c.key]=1;
        if(c.type==='sel'&&!c.optSrc)c.optSrc=(c.options&&c.options.length)?'manual':'profile';
        if(c.type==='num'&&!c.fmt)c.fmt='num';
      });
      // rowLabels bleibt stehen (Altseiten, die noch nie neu gespeichert wurden, laufen weiter),
      // wird ab v2 aber nicht mehr gelesen. Das Panel raeumt es beim ersten commit() weg.
      if(!w.rows)w.rows=(w.rowLabels||[]).map(function(l){return {label:l};});
      (w.items||[]).forEach(function(it){if(it&&it.k==null&&cols[it.c])it.k=cols[it.c].key;});
      w.rtVer=2;
    }
    _rtSync(w);
    return w;
  }
  // Spaltenindex c wird bei JEDEM Durchlauf aus dem Schluessel k neu berechnet. Damit sind
  // Umsortieren und Loeschen von Spalten ueber die zentrale listEditor-Verdrahtung
  // bindungsneutral, ohne Eingriff in den Kern.
  function _rtSync(w){
    var cols=w.cols||[],idx={};
    cols.forEach(function(c,i){
      if('vis' in c){c.hidden=c.vis?undefined:true;delete c.vis;}   // Panel-Checkbox -> gespeichertes hidden
      if(!c.key)c.key=_rtSlug(c.label||('sp'+i));
      idx[c.key]=i;
    });
    (w.items||[]).forEach(function(it){if(it&&it.r>=0&&it.k!=null&&idx[it.k]!=null)it.c=idx[it.k];});
    // Das Scharf-Signal ist kein bekannter Kern-Slot. Es wird als Item mit negativen Indizes
    // gefuehrt: _rtItem/_rtCell ignorieren es, _collectIds pollt es trotzdem mit.
    var arm=_rtArm(w);
    if(w.rtArmVid){if(arm)arm.vid=w.rtArmVid;else (w.items=w.items||[]).push({r:-1,c:-1,k:'__arm',vid:w.rtArmVid});}
    else if(arm)w.items.splice(w.items.indexOf(arm),1);
  }
  function _rtArm(w){var a=w.items||[];for(var i=0;i<a.length;i++)if(a[i]&&a[i].k==='__arm')return a[i];return null;}
  function _rtFreeKey(w){var n=1,k;do{k='sp'+n++;}while(_rtCol(w,k));return k;}
  function _rtNewCol(w){return {key:_rtFreeKey(w),label:'Neue Spalte',type:'num',optSrc:'profile'};}

  // ---------- Zugriff auf Spalten, Zeilen, Zellen ----------
  function _rtCol(w,key){var a=w.cols||[];for(var i=0;i<a.length;i++)if(a[i]&&a[i].key===key)return a[i];return null;}
  function _rtColIdx(w,key){var a=w.cols||[];for(var i=0;i<a.length;i++)if(a[i]&&a[i].key===key)return i;return -1;}
  function _rtVis(w){var o=[];(w.cols||[]).forEach(function(c,i){if(!c.hidden)o.push(i);});return o;}
  function _rtItem(w,r,key){var a=w.items||[];for(var i=0;i<a.length;i++){var it=a[i];if(it&&it.r===r&&it.k===key)return it;}return null;}
  function _rtItemIdx(w,r,key){   // legt die Zelle an, falls sie fehlt - vid:0 ist ueberall unschaedlich
    var a=w.items||(w.items=[]);
    for(var i=0;i<a.length;i++){var it=a[i];if(it&&it.r===r&&it.k===key)return i;}
    a.push({r:r,c:_rtColIdx(w,key),k:key,vid:0});return a.length-1;
  }
  function _rtByVid(w,vid){var a=w.items||[];for(var i=0;i<a.length;i++)if(a[i]&&a[i].vid===vid)return a[i];return null;}
  function _rtRaw(w,r,key){var it=_rtItem(w,r,key);if(!it||!it.vid)return null;var d=_lastVals[it.vid];return d?d.v:null;}
  function _rtG(w,k,def){return (w[k]===undefined||w[k]===null||w[k]==='')?def:w[k];}

  // ---------- Zahlen, Uhrzeit, Dauer ----------
  // Der Parser entschaerft "1.234,5" (Tausenderpunkt vor genau drei Ziffern faellt weg,
  // Komma wird Dezimalpunkt) - frueher landete so etwas als NaN im Nichts.
  function _rtNum(v){
    if(v===true)return 1;if(v===false)return 0;if(v==null||v==='')return NaN;
    if(typeof v==='number')return v;
    return parseFloat(String(v).replace(/\s/g,'').replace(/\.(?=\d{3}\b)/g,'').replace(',','.'));
  }
  function _rtOn(v){return !(v===false||v===0||v==='0'||v===''||v==null||String(v).toLowerCase()==='false');}
  function _rt2(n){return ('0'+n).slice(-2);}
  function _rtHM(v){var n=Math.round(_rtNum(v));if(isNaN(n))return '--:--';if(n<0)n=0;if(n>1439)n=1439;return _rt2(Math.floor(n/60))+':'+_rt2(n%60);}
  function _rtHMto(s){var m=/^(\d{1,2}):(\d{2})/.exec(String(s||''));if(!m)return null;var h=+m[1],mi=+m[2];if(h>23||mi>59)return null;return h*60+mi;}
  function _rtDurT(v){var n=Math.round(_rtNum(v));if(isNaN(n))return '--:--';if(n<0)n=0;
    var h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;
    return h?(h+':'+_rt2(m)+':'+_rt2(s)):(_rt2(m)+':'+_rt2(s));}
  function _rtFix(n,dec){return n.toFixed(Math.max(0,dec)).replace('.',',');}

  // ---------- Variablenprofil (Optionen, Grenzen, Nachkommastellen) ----------
  // Gecacht wird pro PROFILNAME, abgefragt wird nur die Musterzelle je Spalte. Bei 8x16
  // Zellen sind das acht Abrufe statt 128 - und die Anzeige folgt automatisch, wenn jemand
  // das Profil in Symcon aendert. Genau daran sind die eingefrorenen Optionslisten der
  // Altseiten gescheitert (ADCC "24 = Anstroemung (24)").
  function _rtFetchAssoc(vid,cb){
    if(!vid){if(cb)cb(null);return;}
    var p=_rtPrfV[vid];
    if(p!==undefined){if(cb)cb(_rtPrf[p]||null);return;}
    if(_rtPrfW[vid]){_rtPrfW[vid].push(cb);return;}
    _rtPrfW[vid]=[cb];
    fetch('?api=assoc&id='+vid,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var key=(j&&j.profile)?j.profile:('#'+vid);
      if(!_rtPrf[key])_rtPrf[key]={
        prof:(j&&j.profile)||'', vtype:(j&&j.type!=null)?j.type:null,
        suffix:String((j&&j.suffix)||'').trim(), min:(j&&j.min!=null)?+j.min:null,
        max:(j&&j.max!=null)?+j.max:null, step:(j&&j.step!=null)?+j.step:null,
        digits:(j&&j.digits!=null)?+j.digits:null,
        opts:((j&&j.assocs)||[]).map(function(a){return {value:a.v,text:a.name,color:a.color||'',icon:a.icon||''};})
      };
      _rtPrfV[vid]=key;
      var q=_rtPrfW[vid]||[];delete _rtPrfW[vid];q.forEach(function(f){if(f)f(_rtPrf[key]);});
    }).catch(function(){var q=_rtPrfW[vid]||[];delete _rtPrfW[vid];q.forEach(function(f){if(f)f(null);});});
  }
  function _rtSample(w,col){var a=w.items||[];for(var i=0;i<a.length;i++){var it=a[i];if(it&&it.k===col.key&&it.vid)return it.vid;}return 0;}
  function _rtProf(w,col){var v=_rtSample(w,col);if(!v)return null;var p=_rtPrfV[v];return p?_rtPrf[p]:null;}
  function _rtLoad(w){
    (w.cols||[]).forEach(function(c){
      if(!c||c.type==='text')return;
      var v=_rtSample(w,c);if(!v||_rtPrfV[v]!==undefined||_rtPrfW[v])return;
      _rtFetchAssoc(v,function(){_rtRepaintSoon(w);});
    });
  }
  function _rtOpts(w,col){
    if(col.optSrc==='manual')return col.options||[];
    var p=_rtProf(w,col);return p?p.opts:null;      // null = noch nicht geladen
  }
  function _rtOpt(w,col,v){
    var o=_rtOpts(w,col);if(!o)return null;
    for(var i=0;i<o.length;i++)if(String(o[i].value)===String(v))return o[i];
    return null;
  }
  function _rtBoolTxt(w,col,v){
    var p=_rtProf(w,col),on=_rtOn(v);
    if(p&&p.opts&&p.opts.length){for(var i=0;i<p.opts.length;i++)if(_rtOn(p.opts[i].value)===on)return p.opts[i].text;}
    return on?'An':'Aus';
  }
  // Grenzen: was der Anwender im Panel eingetragen hat, gewinnt; sonst das Profil; sonst
  // typgerechte Vorgabe. Ins Seiten-JSON wandert nur die Abweichung.
  function _rtLim(w,col){
    var p=_rtProf(w,col)||{},t=col.type||'num';
    var mn=(col.min!=null&&col.min!=='')?+col.min:(p.min!=null?p.min:null);
    var mx=(col.max!=null&&col.max!=='')?+col.max:(p.max!=null?p.max:null);
    var st=(col.step!=null&&col.step!=='')?+col.step:(p.step!=null?p.step:null);
    if(mn===0&&mx===0){mn=null;mx=null;}                       // Profil ohne Grenzen
    if(t==='time'){if(mn==null)mn=0;if(mx==null)mx=1439;}
    if(t==='dur'&&mn==null)mn=0;
    if(!st)st=(t==='temp'?0.25:1);
    return {min:mn,max:mx,step:st};
  }
  function _rtDec(w,col,eff){
    if(eff&&eff.dec!=null)return +eff.dec;
    if(col.dec!=null&&col.dec!=='')return +col.dec;
    var p=_rtProf(w,col);
    if(p&&p.digits!=null)return p.digits;
    return col.type==='temp'?2:0;
  }

  // ---------- Bedingungen (alt / depend / rtWarn) ----------
  function _rtOp(op,a,b){
    if(op==='any')return true;
    var na=_rtNum(a),nb=_rtNum(b),eq=(String(a)===String(b))||(!isNaN(na)&&!isNaN(nb)&&na===nb);
    if(op==='eq'||op==='eqCol')return eq;
    if(op==='ne')return !eq;
    if(op==='in'){var l=String(b==null?'':b).split(',');for(var i=0;i<l.length;i++){var s=l[i].replace(/^\s+|\s+$/g,'');if(s!==''&&(s===String(a)||(!isNaN(na)&&_rtNum(s)===na)))return true;}return false;}
    if(isNaN(na)||isNaN(nb))return false;
    if(op==='lt')return na<nb; if(op==='le')return na<=nb;
    if(op==='gt')return na>nb; if(op==='ge')return na>=nb;
    return false;
  }
  function _rtCond(w,r,c){
    if(!c||!c.col)return false;
    var a=_rtRaw(w,r,c.col);
    if(c.op==='eqCol')return _rtOp('eq',a,_rtRaw(w,r,c.val));
    return _rtOp(c.op||'eq',a,c.val);
  }
  // Bedingte Umbeschriftung: erster Treffer gewinnt (TEMPC: sens2=255 -> Absolutwert in Grad C,
  // sonst Differenz in K). unitFrom zieht die Einheit aus dem Optionstext einer Auswahlspalte
  // derselben ZEILE (ADCC: der gewaehlte Sensor bestimmt mBar / m3/h / cm/s).
  function _rtEff(w,col,r){
    var e={label:col.label||'',sub:col.sub||'',unit:col.unit||'',dec:(col.dec!=null&&col.dec!=='')?+col.dec:null};
    var alt=col.alt||[];
    for(var i=0;i<alt.length;i++){
      var a=alt[i];if(!a||!a.when||!_rtCond(w,r,a.when))continue;
      if(a.label!=null&&a.label!=='')e.label=a.label;
      if(a.unit!=null&&a.unit!=='')e.unit=a.unit;
      if(a.dec!=null&&a.dec!=='')e.dec=+a.dec;
      break;
    }
    if(col.unitFrom){
      var src=_rtCol(w,col.unitFrom);
      if(src){var o=_rtOpt(w,src,_rtRaw(w,r,col.unitFrom)),t=o?String(o.text||''):'';
        var m=/\(([^()]+)\)\s*$/.exec(t);
        if(m)e.unit=m[1];else if(t)e.unit=t;}
    }
    return e;
  }
  function _rtDep(w,col,r){
    var l=col.depend||[];
    for(var i=0;i<l.length;i++){var d=l[i];if(d&&d.col&&_rtCond(w,r,d))return d;}
    return null;
  }
  // Doppelbelegung: eine Spalte mit dup:true meldet, wenn derselbe Wert in einer anderen
  // sichtbaren, scharfen Zeile noch einmal vorkommt (ProCon: die hoehere Regelnummer gewinnt,
  // die niedrigere wird stillschweigend wirkungslos).
  function _rtDup(w,r){
    var out=[];
    (w.cols||[]).forEach(function(c){
      if(!c.dup)return;
      var v=_rtRaw(w,r,c.key);if(v==null||!_rtActive(w,r))return;
      var hit=[];
      (w.rows||[]).forEach(function(ro,r2){
        if(r2===r||ro.hidden||!_rtActive(w,r2))return;
        if(_rtOp('eq',v,_rtRaw(w,r2,c.key)))hit.push(r2);
      });
      if(hit.length)out.push({lvl:(hit.some(function(x){return x>r;})?'warn':'info'),
        text:(c.label||c.key)+' ist auch in Regel '+hit.join(', ')+' belegt – die höhere Regelnummer gewinnt.'});
    });
    return out;
  }
  function _rtWarns(w,r){
    var out=_rtDup(w,r);
    (w.rtWarn||[]).forEach(function(x){
      if(!x||!x.when||!x.when.length)return;
      for(var i=0;i<x.when.length;i++)if(!_rtCond(w,r,x.when[i]))return;
      out.push(x);
    });
    return out;
  }

  // ---------- Absicherung ----------
  function _rtUnlocked(w){var t=_rtLockT[w.id];return !!(t&&t>Date.now());}
  function _rtLockTouch(w){if(_rtG(w,'rtGate','sheet')==='lock')_rtLockT[w.id]=Date.now()+(( +_rtG(w,'rtLockSec',120))*1000);}
  // Wird VOR jedem Schreibvorgang und VOR dem Setzen von data-rv beim Zeichnen ausgewertet.
  function _rtCanWrite(w,col,r){
    if(typeof mode!=='undefined'&&mode==='edit')return {ok:false,grund:'Bearbeiten-Modus'};
    if(_rtG(w,'rtWrite','on')==='off')return {ok:false,grund:'Widget ist auf Nur-Anzeige gestellt'};
    if(!col||col.ro||col.type==='text')return {ok:false,grund:'Spalte ist Nur-Anzeige'};
    var dp=_rtDep(w,col,r);
    if(dp&&dp.act==='disable')return {ok:false,grund:dp.hint||'Durch eine andere Spalte gesperrt'};
    if(w.rtArmVid){
      var d=_lastVals[w.rtArmVid];
      if(!d)return {ok:false,grund:'Scharf-Signal noch unbekannt'};
      var on=_rtOn(d.v);if(w.rtArmInv)on=!on;
      if(!on)return {ok:false,grund:'Schreiben ist am Gerät nicht scharf'};
    }
    if(_rtG(w,'rtGate','sheet')==='lock'&&!_rtUnlocked(w))return {ok:false,grund:'Bedienung ist verriegelt'};
    return {ok:true,grund:''};
  }
  // Der Panel-Satz wird BERECHNET. Der alte Satz "Schreiben ist gegated (armed)" war
  // unbelegt: ?api=setvar prueft nur den Token und ruft RequestAction/SetValue.
  function _rtGateText(w){
    var a=[];
    if(_rtG(w,'rtWrite','on')==='off')return 'Nur Anzeige — dieses Widget schreibt nichts.';
    var g=_rtG(w,'rtGate','sheet');
    a.push(g==='lock' ? 'Bedienung ist verriegelt, bis das Schloss geöffnet wird ('+_rtG(w,'rtLockSec',120)+' s).'
         : g==='direkt' ? 'Schalterzellen schalten mit einem Tipp; alle anderen fragen im Sheet nach.'
         : 'Jede Änderung wird im Sheet bestätigt.');
    var ro=(w.cols||[]).filter(function(c){return c.ro;}).length,
        cf=(w.cols||[]).filter(function(c){return c.confirm;}).length;
    if(ro)a.push(ro+' Spalte(n) sind nur Anzeige.');
    if(cf)a.push(cf+' Spalte(n) fragen zusätzlich zurück.');
    a.push(w.rtArmVid
      ? 'Scharf-Signal ist an Variable '+w.rtArmVid+' gebunden; bei „Aus“ wird jeder Schreibversuch abgelehnt.'
      : 'KEIN Scharf-Signal gebunden — das Widget kann nicht feststellen, ob das Gerät den Wert wirklich übernimmt.');
    a.push('Im Bearbeiten-Modus schreibt das Widget grundsätzlich nicht.');
    return a.join(' ');
  }

  // ---------- Schreiben ----------
  // Geht ueber setVar (Doku-Modus leitet dort auf dokuSetVar um und erreicht den Server nie -
  // ein direktes fetch wuerde die Dokuseite die Poolanlage schalten lassen). Die zweite,
  // wertgleiche Anfrage macht die heute stummen Faelle forbidden (403) und no variable (404)
  // sichtbar, die setVar verwirft.
  function _rtWrite(w,el,vid,val,cell){
    setVar(vid,val);
    delete _rtFail[vid];
    _rtPend[vid]={v:String(val),t:Date.now()};
    if(cell){cell.classList.remove('rtc-fail');cell.classList.add('rtc-pend');}
    _rtLockTouch(w);
    if(typeof DOKU!=='undefined'&&DOKU)return;
    // Quittung durch RUECKLESEN, nicht durch ein zweites Schreiben. Ein zweiter
    // setvar-Aufruf waere am ProCon kein Zusatznutzen, sondern ein kompletter
    // zweiter Read-Modify-Write der INI-Sektion gegen das Stundenbudget von 60,
    // mit 2000 ms Wartezeit bei gehaltener Geraete-Semaphore. Die Ruecklesung
    // zeigt Fehlschlaege genauso und kostet nichts.
    setTimeout(function(){
      fetch('?api=val&ids='+vid,{cache:'no-store'})
        .then(function(r){return r.ok?r.json():null;})
        .then(function(j){
          var d=j&&j.values&&j.values[vid];   // Antwortform: {ts, values:{<id>:{v,f,u,c}}}
          if(!d){return;}                       // keine Aussage moeglich - Zelle bleibt in Wartestellung
          if(String(d.v)!==String(val)){        // Geraet hat den Wert nicht uebernommen
            delete _rtPend[vid];_rtFail[vid]=1;
            toast('Nicht uebernommen: '+((cell&&cell.getAttribute('data-lbl'))||('#'+vid)));
            _rtRepaintSoon(w);
          }
        })
        .catch(function(){});
    },1500);
  }

  // ---------- Zeichnen ----------
  function _rtNumish(t){return t==='num'||t==='temp'||t==='time'||t==='dur';}
  function _rtAlign(col){return col.align||(_rtNumish(col.type||'num')?'r':'c');}
  function _rtTA(a){return a==='l'?'left':(a==='r'?'right':'center');}
  function _rtChevron(){
    return '<svg class="rtcv" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function _rtIco(name,col,sz){
    return '<span style="width:'+sz+';height:'+sz+';display:inline-flex;align-items:center;justify-content:center;flex:none'+(col?(';color:var(--'+col+')'):'')+'">'+iconSVG(name)+'</span>';
  }
  // Anzeigetext einer Zelle (auch fuer die Zusammenfassungszeile) - immer ohne Auszeichnung.
  function _rtDisp(w,col,r){
    var it=_rtItem(w,r,col.key);if(!it||!it.vid)return '';
    var d=_lastVals[it.vid];if(!d)return '–';
    var t=col.type||'num';
    if(t==='bool')return _rtBoolTxt(w,col,d.v);
    if(t==='sel'){var o=_rtOpt(w,col,d.v);return o?String(o.text||o.value):((d.f!=null&&d.f!=='')?String(d.f):String(d.v));}
    if(t==='time')return _rtHM(d.v);
    if(t==='dur')return _rtDurT(d.v);
    if(t==='text')return (d.f!=null&&d.f!=='')?String(d.f):String(d.v);
    var dec=_rtDec(w,col,_rtEff(w,col,r));
    if(dec<0)return (d.f!=null&&d.f!=='')?String(d.f):String(d.v);
    var n=_rtNum(d.v);
    return isNaN(n)?String(d.v):_rtFix(n,dec);
  }
  function _rtCellHTML(w,col,ci,r){
    var ta=_rtTA(_rtAlign(col)),base=' data-c="'+ci+'" data-r="'+r+'" data-k="'+esc(col.key)+'" style="text-align:'+ta+'"';
    var it=_rtItem(w,r,col.key);
    if(!it||!it.vid)return '<td class="rtc rtc-empty"'+base+'>·</td>';
    var dep=_rtDep(w,col,r);
    if(dep&&dep.act==='hide')return '<td class="rtc rtc-empty"'+base+(dep.hint?(' title="'+esc(dep.hint)+'"'):'')+'>·</td>';
    var t=col.type||'num',eff=_rtEff(w,col,r),d=_lastVals[it.vid],g=_rtCanWrite(w,col,r);
    var cls='rtc rtc-'+(t==='bool'?'bool':(t==='sel'?'sel':(t==='text'?'txt':'num')));
    if(dep&&dep.act==='disable')cls+=' rtc-dis';
    if(dep&&dep.act==='dim')cls+=' rtc-dim';
    if(dep&&dep.act==='require'&&(!d||d.v==null||d.v===''||_rtNum(d.v)===0))cls+=' rtc-req';
    if(_rtPend[it.vid])cls+=' rtc-pend';
    if(_rtFail[it.vid])cls+=' rtc-fail';
    var tip=[eff.label];
    if(eff.sub)tip.push(eff.sub);
    if(t==='time'&&d)tip.push('Rohwert '+d.v+' min seit Mitternacht');   // die Rohzahl steht nur hier
    if(dep&&dep.hint)tip.push(dep.hint);
    if(!g.ok&&g.grund!=='Bearbeiten-Modus')tip.push(g.grund);
    if(_rtFail[it.vid])tip.push('Das Gerät hat den Wert nicht übernommen.');
    var at=base+(g.ok?(' data-rv="'+it.vid+'" tabindex="0" role="button"'):'')+' title="'+esc(tip.join(' · '))+'"';
    var inner;
    if(t==='bool'){
      inner='<span class="rtsw'+((d&&_rtOn(d.v))?'':' off')+'" data-role="rtsw"><i></i></span>';
    }else if(t==='sel'){
      var o=d?_rtOpt(w,col,d.v):null,txt=d?_rtDisp(w,col,r):'–';
      var st=(o&&o.color)?(' style="color:'+esc(o.color)+'"'):(col.color?(' style="color:var(--'+esc(col.color)+')"'):'');
      inner='<span class="rtseg"'+st+'>'+((o&&o.icon)?_rtIco(o.icon,'','clamp(10px,3cqmin,15px)'):'')
           +'<span class="rtsel">'+esc(txt)+'</span>'+_rtChevron()+'</span>';
    }else if(t==='text'){
      inner='<span class="rtv">'+esc(d?_rtDisp(w,col,r):'–')+'</span>';
    }else{
      var u=(_rtG(w,'rtColHead','textunit')==='text'&&eff.unit)?('<small>'+esc(eff.unit)+'</small>'):'';
      inner='<span class="rtchip"'+(col.color?(' style="border-color:var(--'+esc(col.color)+')"'):'')+'><span class="rtv">'+esc(d?_rtDisp(w,col,r):'–')+'</span>'+u+'</span>';
    }
    return '<td class="'+cls+'"'+at+'>'+inner+'</td>';
  }
  function _rtRlCell(w,r){
    var ro=(w.rows||[])[r]||{},wr=_rtWarns(w,r),lvl='';
    wr.forEach(function(x){var l=x.lvl||'info';if(l==='crit')lvl='crit';else if(l==='warn'&&lvl!=='crit')lvl='warn';else if(!lvl)lvl='info';});
    var tip=[];if(ro.note)tip.push(ro.note);
    wr.forEach(function(x){tip.push(x.text||'');});
    return '<td class="rtrl"'+(tip.length?(' title="'+esc(tip.join(' · '))+'"'):'')+'><span class="rtrl-in">'
      +(_rtG(w,'rtRowNum',true)!==false?'<span class="rtrl-ix">'+r+'</span>':'')
      +'<span class="rtrl-tx">'+esc(ro.label||('Regel '+r))+'</span>'
      +(wr.length?('<span class="rtwarn rtwarn-'+lvl+'">'+_rtIco(lvl==='info'?'info':'warning',lvl==='crit'?'crit':(lvl==='warn'?'warn':'info'),'clamp(12px,3.4cqmin,17px)')+'</span>'):'')
      +'</span></td>';
  }
  function _rtRowInner(w,r,vis){
    var cols=w.cols||[],h=_rtRlCell(w,r);
    vis.forEach(function(ci){h+=_rtCellHTML(w,cols[ci],ci,r);});
    return h;
  }
  function _rtActive(w,r){
    var k=w.rtActKey;if(!k)return true;
    var v=_rtRaw(w,r,k);
    return v==null?true:_rtOn(v);
  }
  // Zusammenfassung: %<schluessel> wird durch den ANZEIGETEXT der Zelle ersetzt. Bei
  // sechzehn Spalten ist das die einzige Auskunft, die man in einer Zeile noch erfassen kann.
  function _rtSum(w,r){
    var pat=w.rtSumPat||'';if(!pat)return '';
    return pat.replace(/%([a-z0-9_]+)/gi,function(m,k){
      var c=_rtCol(w,k);return c?_rtDisp(w,c,r):m;});
  }
  function _rtLockBtn(w){
    if(_rtG(w,'rtGate','sheet')!=='lock'||_rtG(w,'rtWrite','on')==='off')return '';
    var open=_rtUnlocked(w);
    return '<button class="rtlock'+(open?' on':'')+'" data-role="rtlock" title="'
      +esc(open?('Bedienung ist frei – Klick verriegelt sofort'):('Bedienung ist verriegelt – Klick gibt '+_rtG(w,'rtLockSec',120)+' s frei'))
      +'" style="display:inline-flex;align-items:center;justify-content:center;background:none;border:0;padding:0;cursor:pointer;color:var('+(open?'--ok':'--muted')+')">'
      +_rtIco(open?'unlock':'lock','','clamp(13px,3.6cqmin,19px)')+'</button>';
  }
  // Spaltengruppen (ADCC: 0-9 Schaltregel, 10-15 Monitor) als zweite Kopfzeile. Die beiden
  // Bloecke sind laut Handbuch unabhaengig - nur der Monitor loest Alarme aus.
  function _rtGrpRow(w,vis){
    var cols=w.cols||[],runs=[],last=null;
    vis.forEach(function(ci){
      var g=cols[ci].group||'';
      if(last&&last.g===g)last.n++;else{last={g:g,n:1};runs.push(last);}
    });
    if(runs.length<2)return '';
    return '<tr class="rtgrp"><th class="rtrl"></th>'+runs.map(function(x){
      return '<th colspan="'+x.n+'">'+esc(x.g)+'</th>';}).join('')+'</tr>';
  }

  // ---------- Editiersheet ----------
  // Kind des Widget-DOM, nicht des body: .rt hat overflow:hidden und .rtscroll scrollt, ein
  // an die Zelle geheftetes Popover wuerde abgeschnitten. Ein zentriertes Sheet ueber der
  // Kachel braucht keine Ankerrechnung. Es liegt in .w, damit change/click den zentralen
  // Verteiler erreichen - der beginnt mit if(mode==='edit')return; und macht das Sheet im
  // Bearbeiten-Modus automatisch wirkungslos.
  var _rtTimeOk=(function(){try{var i=document.createElement('input');i.setAttribute('type','time');i.value='xy';return i.value==='';}catch(e){return false;}})();
  var _RT_SHEET='position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;padding:clamp(6px,3cqmin,16px);background:color-mix(in oklab,var(--bg) 74%,transparent)';
  var _RT_CARD ='background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.38);padding:clamp(9px,3cqmin,16px);width:min(400px,100%);max-height:100%;overflow:auto;font-size:clamp(11px,2.6cqmin,14px);color:var(--text)';
  var _RT_BTN  ='padding:5px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);cursor:pointer;font-size:inherit';
  function _rtSheetBtn(attr,txt,style){return '<button '+attr+' style="'+_RT_BTN+(style||'')+'">'+esc(txt)+'</button>';}
  function _rtSheetBody(w,col,r,vid){
    var t=col.type||'num',d=_lastVals[vid],lim=_rtLim(w,col),eff=_rtEff(w,col,r);
    var cur=d?d.v:null,h='';
    if(t==='bool'){
      h+='<div style="display:flex;gap:6px">'+_rtSheetBtn('data-rtv="0"','Aus')+_rtSheetBtn('data-rtv="1"','An')+'</div>';
      return h;
    }
    if(t==='sel'){
      var o=_rtOpts(w,col);
      if(o===null)return '<div style="color:var(--muted)">Optionen werden geladen …</div>';
      if(!o.length)return '<div style="color:var(--crit)">Dieses Profil hat keine Zuordnungen – nichts zum Auswählen.</div>';
      if(o.length<=8){
        return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">'+o.map(function(x){
          var on=String(x.value)===String(cur);
          return _rtSheetBtn('data-rtv="'+esc(String(x.value))+'"',String(x.text||x.value),on?';border-color:var(--accent);color:var(--accent)':'');
        }).join('')+'</div>';
      }
      var grp={},order=[],has=false;
      o.forEach(function(x){var k=x.group||'';if(k)has=true;if(!(k in grp)){grp[k]=[];order.push(k);}grp[k].push(x);});
      var opt=function(x){return '<option value="'+esc(String(x.value))+'"'+(String(x.value)===String(cur)?' selected':'')+'>'+esc(String(x.text||x.value))+'</option>';};
      var body=has?order.map(function(k){var inner=grp[k].map(opt).join('');return k?('<optgroup label="'+esc(k)+'">'+inner+'</optgroup>'):inner;}).join(''):o.map(opt).join('');
      return '<select data-role="rtvsel" style="width:100%;padding:5px">'+body+'</select>';
    }
    if(t==='time'){
      var mv=_rtNum(cur),hh=isNaN(mv)?8:Math.floor(mv/60),mm=isNaN(mv)?0:(mv%60);
      if(_rtTimeOk){
        h+='<input type="time" step="60" data-role="rtvtime" value="'+_rt2(hh)+':'+_rt2(mm)+'" style="width:100%;padding:5px;font-size:inherit">';
      }else{
        // Alte WebView ohne Uhrzeitfeld: zwei Klapplisten - nie ein Textfeld.
        var so='',i;
        for(i=0;i<24;i++)so+='<option value="'+i+'"'+(i===hh?' selected':'')+'>'+_rt2(i)+'</option>';
        var mo='';for(i=0;i<60;i++)mo+='<option value="'+i+'"'+(i===mm?' selected':'')+'>'+_rt2(i)+'</option>';
        h+='<div style="display:flex;gap:5px;align-items:center"><select data-role="rtvh" style="flex:1;padding:5px">'+so+'</select><b>:</b><select data-role="rtvm" style="flex:1;padding:5px">'+mo+'</select></div>';
      }
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px">'
        +['06:00','08:00','10:00','12:00','18:00','20:00','22:00'].map(function(x){return _rtSheetBtn('data-rttime="'+x+'"',x);}).join('')+'</div>';
      h+='<div style="display:flex;gap:4px;margin-top:5px">'+_rtSheetBtn('data-rtmin="-15"','− 15 min')+_rtSheetBtn('data-rtmin="15"','+ 15 min')+'</div>';
      return h;
    }
    if(t==='dur'){
      var sv=_rtNum(cur);if(isNaN(sv))sv=0;
      h+='<div style="display:flex;gap:5px;align-items:center">'
        +'<label style="flex:1">h<input type="number" min="0" data-role="rtvdh" value="'+Math.floor(sv/3600)+'" style="width:100%;padding:5px"></label>'
        +'<label style="flex:1">min<input type="number" min="0" max="59" data-role="rtvdm" value="'+Math.floor((sv%3600)/60)+'" style="width:100%;padding:5px"></label>'
        +'<label style="flex:1">s<input type="number" min="0" max="59" data-role="rtvds" value="'+(sv%60)+'" style="width:100%;padding:5px"></label></div>';
      h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:7px">'
        +[['10','10 s'],['60','1 min'],['300','5 min'],['1200','20 min']].map(function(x){return _rtSheetBtn('data-rtdur="'+x[0]+'"',x[1]);}).join('')+'</div>';
      return h;
    }
    var dec=_rtDec(w,col,eff),nv=_rtNum(cur);
    h+='<div style="display:flex;gap:5px;align-items:center">'
      +_rtSheetBtn('data-rtstep="-1"','−')
      +'<input type="number" inputmode="decimal" data-role="rtvnum" value="'+(isNaN(nv)?'':nv.toFixed(Math.max(0,dec)))+'"'
      +(lim.min!=null?(' min="'+lim.min+'"'):'')+(lim.max!=null?(' max="'+lim.max+'"'):'')+' step="'+lim.step+'"'
      +' style="flex:1;padding:5px;text-align:right;font-size:inherit">'
      +'<span style="color:var(--muted)">'+esc(eff.unit||'')+'</span>'
      +_rtSheetBtn('data-rtstep="1"','+')+'</div>';
    if(t==='temp')h+='<div style="display:flex;gap:4px;margin-top:5px">'+_rtSheetBtn('data-rtdelta="-0.25"','− 0,25')+_rtSheetBtn('data-rtdelta="0.25"','+ 0,25')+'</div>';
    if(lim.min!=null||lim.max!=null)
      h+='<div style="font-size:.85em;color:var(--muted);margin-top:6px">Zulässig: '+(lim.min!=null?_rtFix(lim.min,dec):'–')+' bis '+(lim.max!=null?_rtFix(lim.max,dec):'–')+(eff.unit?(' '+eff.unit):'')+'</div>';
    return h;
  }
  function _rtSheetOpen(w,el,r,key,vid){
    var root=$('[data-role=rtroot]',el);if(!root)return;
    _rtSheetClose(el);
    var col=_rtCol(w,key);if(!col)return;
    var eff=_rtEff(w,col,r),ro=(w.rows||[])[r]||{},dep=_rtDep(w,col,r);
    var box=document.createElement('div');
    box.className='rtsheet';box.setAttribute('data-role','rtsheet');
    box.setAttribute('data-r',String(r));box.setAttribute('data-k',key);box.setAttribute('data-vid',String(vid));
    box.setAttribute('style',_RT_SHEET);
    var okTxt=col.confirm?('Ja – '+(eff.label||key)+' schreiben'):'Übernehmen';
    var okStyle=col.confirm?';border-color:var(--crit);background:var(--crit);color:#08201c;font-weight:700':';border-color:var(--accent);color:var(--accent)';
    box.innerHTML='<div style="'+_RT_CARD+'">'
      +'<div style="font-weight:700;margin-bottom:2px">'+esc((ro.label||('Regel '+r))+' · '+(eff.label||key))+'</div>'
      +'<div style="color:var(--muted);font-size:.9em;margin-bottom:8px">Aktuell: '+esc(_rtDisp(w,col,r))+(eff.unit?(' '+esc(eff.unit)):'')+'</div>'
      +_rtSheetBody(w,col,r,vid)
      +((dep&&dep.hint)?('<div style="color:var(--warn);font-size:.9em;margin-top:7px">'+esc(dep.hint)+'</div>'):'')
      +(col.confirm?('<div style="color:var(--crit);font-size:.9em;margin-top:7px">Diese Spalte schaltet unmittelbar am Gerät.</div>'):'')
      +'<div style="display:flex;gap:6px;justify-content:flex-end;margin-top:11px">'
      +_rtSheetBtn('data-rtcancel="1"','Abbrechen')
      +(col.type==='bool'?'':_rtSheetBtn('data-rtok="1"',okTxt,okStyle))
      +'</div></div>';
    root.appendChild(box);
    var f=$('[data-role^=rtv]',box);if(f&&f.focus)try{f.focus();}catch(e){}
  }
  function _rtSheetClose(el){var s=$('[data-role=rtsheet]',el);if(s)s.parentNode.removeChild(s);}
  // Wert aus dem Sheet lesen. Gibt null zurueck, wenn die Eingabe unbrauchbar ist - und sagt
  // dann auch, warum. Frueher verschwand ein NaN stillschweigend.
  function _rtSheetTake(w,sh,col,r){
    var t=col.type||'num',lim=_rtLim(w,col),dec=_rtDec(w,col,_rtEff(w,col,r)),n;
    if(t==='sel'){var s=$('[data-role=rtvsel]',sh);return s?s.value:null;}
    if(t==='time'){
      var ti=$('[data-role=rtvtime]',sh);
      if(ti){n=_rtHMto(ti.value);if(n==null){toast('Keine gültige Uhrzeit');return null;}}
      else{var hh=$('[data-role=rtvh]',sh),mm=$('[data-role=rtvm]',sh);if(!hh||!mm)return null;n=(+hh.value)*60+(+mm.value);}
    }else if(t==='dur'){
      var dh=$('[data-role=rtvdh]',sh),dm=$('[data-role=rtvdm]',sh),ds=$('[data-role=rtvds]',sh);
      if(!dh||!dm||!ds)return null;
      n=(_rtNum(dh.value)||0)*3600+(_rtNum(dm.value)||0)*60+(_rtNum(ds.value)||0);
      if(isNaN(n)){toast('Keine gültige Dauer');return null;}
      n=Math.round(n);
    }else{
      var f=$('[data-role=rtvnum]',sh);if(!f)return null;
      n=_rtNum(f.value);
      if(isNaN(n)){toast('Keine gültige Zahl');return null;}
      n=+n.toFixed(Math.max(0,dec));
    }
    if(lim.min!=null&&n<lim.min){toast('Kleiner als das Minimum ('+_rtFix(lim.min,dec)+')');return null;}
    if(lim.max!=null&&n>lim.max){toast('Größer als das Maximum ('+_rtFix(lim.max,dec)+')');return null;}
    return n;
  }
  function _rtSheetApply(w,el,sh,val){
    var r=parseInt(sh.getAttribute('data-r')),key=sh.getAttribute('data-k'),vid=parseInt(sh.getAttribute('data-vid'));
    var col=_rtCol(w,key);if(!col)return;
    var g=_rtCanWrite(w,col,r);
    if(!g.ok){toast(g.grund);return;}
    var cell=$('.rtc[data-r="'+r+'"][data-k="'+key+'"]',el);
    _rtWrite(w,el,vid,val,cell);
    _rtSheetClose(el);
  }

  // ---------- Neuanstrich ----------
  function _rtRoots(w){return $$('.w[data-id="'+w.id+'"] [data-role=rtroot]');}
  function _rtRepaintSoon(w){
    if(_rtRepT[w.id])return;
    _rtRepT[w.id]=setTimeout(function(){delete _rtRepT[w.id];_rtRoots(w).forEach(function(rt){_rtPaintEl(w,rt);});},60);
  }
  function _rtRowPaint(w,el,r){
    var tr=$('tr[data-r="'+r+'"]',el);if(!tr)return;
    var ae=document.activeElement,keep=(ae&&tr.contains(ae))?ae.getAttribute('data-k'):null;
    tr.innerHTML=_rtRowInner(w,r,_rtVis(w));
    tr.setAttribute('data-active',_rtActive(w,r)?'1':'0');
    if(keep){var back=$('.rtc[data-k="'+keep+'"][data-rv]',tr);if(back&&back.focus)try{back.focus();}catch(e){}}
    var sm=$('tr[data-sum="'+r+'"] [data-role=rtsumtd]',el);
    if(sm)sm.textContent=_rtSum(w,r);
  }
  function _rtPaintEl(w,el){
    (w.rows||[]).forEach(function(ro,r){if(!ro.hidden)_rtRowPaint(w,el,r);});
    var lb=$('[data-role=rtlock]',el);
    if(lb){var box=document.createElement('span');box.innerHTML=_rtLockBtn(w);if(box.firstChild)lb.parentNode.replaceChild(box.firstChild,lb);}
  }

  // ---------- Regeln einlesen (Abschnitt E) ----------
  // Quellen sind ?api=tree&parent=<cat> und ?api=assoc&id=<vid> - beide bestehen bereits und
  // sind rein lesend. Es ist KEIN neuer Endpunkt noetig; jede Aenderung an handler.php
  // verlangte einen Library-Reload, und der Reload ist eine Kernel-Crash-Falle.
  function _rtPat(pat){
    var s=pat||'%P-Regel %r: %f',out='',idx={},n=0;
    s.split(/(%[Prf])/).forEach(function(p){
      if(p==='%P'){out+='(.+?)';idx.P=++n;}
      else if(p==='%r'){out+='(\\d+)';idx.r=++n;}
      else if(p==='%f'){out+='(.+)';idx.f=++n;}
      else out+=p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    });
    return {re:new RegExp('^'+out+'$'),idx:idx};
  }
  function _rtScan(w,cb){
    var cat=(w.rtSrc&&w.rtSrc.cat)|0;
    if(!cat){toast('Keine Kategorie gewählt');return;}
    fetch('?api=tree&parent='+cat,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var P=_rtPat(w.rtSrc&&w.rtSrc.pat),res={cells:[],miss:[],fields:[],rules:{},prefix:'',rmin:0,rmax:-1};
      (j.nodes||[]).forEach(function(n){
        if(n.type!==2)return;
        var m=P.re.exec(n.name||'');
        if(!m){res.miss.push(n.name);return;}
        var r=P.idx.r?parseInt(m[P.idx.r]):0,f=P.idx.f?m[P.idx.f]:'';
        if(!res.prefix&&P.idx.P)res.prefix=m[P.idx.P];
        res.rules[r]=1;
        res.cells.push({r:r,f:f,vid:n.id,node:n});
      });
      var rn=Object.keys(res.rules).map(Number).sort(function(a,b){return a-b;});
      res.rmin=rn.length?rn[0]:0;res.rmax=rn.length?rn[rn.length-1]:-1;
      // Feldreihenfolge = erstes Auftreten bei der KLEINSTEN Regelnummer. Das reproduziert
      // exakt die heutige, richtige Spaltenfolge der drei Seiten.
      var seen={};
      res.cells.forEach(function(c){if(c.r===res.rmin&&!seen[c.f]){seen[c.f]=1;res.fields.push(c.f);}});
      res.cells.forEach(function(c){if(!seen[c.f]){seen[c.f]=1;res.fields.push(c.f);}});
      cb(res);
    }).catch(function(){toast('Kategorie nicht lesbar');});
  }
  // Deterministische Typerkennung auf der Musterzelle. Danach im Panel uebersteuerbar.
  function _rtDetect(a,node){
    var sfx=a?String(a.suffix||'').replace(/^\s+|\s+$/g,''):'';
    var vt=(a&&a.vtype!=null)?a.vtype:(node?node.vtype:null);
    if(vt===0)return {type:'bool'};
    if(a&&a.opts&&a.opts.length)return {type:'sel',optSrc:'profile'};
    if(vt===1&&a&&a.min===0&&(a.max===1439||a.max===1440)&&sfx==='min')return {type:'time'};
    if(vt===1&&sfx==='s'&&a&&a.max>=3600)return {type:'dur'};
    if(sfx==='°C'||sfx==='C'||sfx==='K')return {type:'temp',unit:sfx};
    if(node&&node.action!==true)return {type:'text',ro:true};
    return {type:'num',unit:sfx};
  }
  // Fachliche Vorbelegung fuer die drei bekannten Matrizen. Reine Bequemlichkeit - das
  // Widget bleibt generisch, der Anwender kann alles davon im Panel aendern oder loeschen.
  var _RT_ALIAS={
    TEMPC:{'Anwenden':'ena','Ausgang':'rel','Zeit Ein':'start','Zeit Aus':'end','Schaltzustand':'state',
           'Sensor':'sens1','Vergleich (Sensor/Absolut)':'sens2','Vergleich':'logic','Regelwert':'diff','Hysterese':'hyst'},
    ADCC:{'Anwenden':'ena','Ausgang':'rel','Schaltzustand':'state','Abhängig von':'drel','Zeit Von':'start','Zeit Bis':'end',
          'Sensor':'sens','Vergleich':'logic','Schwellwert':'diff','Hysterese':'hyst','Unterer Grenzwert aktiv':'cLow',
          'Unterer Grenzwert':'lower','Oberer Grenzwert aktiv':'cHigh','Oberer Grenzwert':'upper','Schlecht (sec.)':'bad','Gut (sec.)':'good'},
    DIGC:{'Anwenden':'ena','Eingang':'inp','Ausgang':'rel','Funktion':'func','Schaltdauer (s)':'time','Schaltzustand':'state'}
  };
  _RT_ALIAS.SWITCHC=_RT_ALIAS.DIGC;
  function _rtFam(p){p=String(p||'').toUpperCase();return _RT_ALIAS[p]?p:'';}
  function _rtPreset(w,fam){
    var C=function(k){return _rtCol(w,k);},c;
    if(fam==='TEMPC'){
      if((c=C('diff')))c.alt=[{when:{col:'sens2',op:'eq',val:255},label:'Absolutwert',unit:'°C',dec:2}];
      if(!(w.rtWarn||[]).length)w.rtWarn=[
        {when:[{col:'start',op:'eqCol',val:'end'}],lvl:'warn',text:'Leeres Zeitfenster – die Regel wird nie ausgewertet, auch wenn sie scharf ist.'},
        {when:[{col:'sens1',op:'eqCol',val:'sens2'}],lvl:'crit',text:'Sensor mit sich selbst verglichen – die Bedingung ist konstant.'},
        {when:[{col:'ena',op:'eq',val:1},{col:'state',op:'eq',val:0},{col:'hyst',op:'eq',val:0}],lvl:'warn',text:'Abschaltregel ohne Hysterese: AUS hat Vorrang und kann das Relais dauerhaft sperren.'}
      ];
      if(!w.rtSumPat)w.rtSumPat='%sens1 %logic %sens2 + %diff, %start–%end → %rel %state';
    }else if(fam==='ADCC'){
      var hint='Freigabe kommt vom genannten Relais; das Zeitfenster wird ignoriert.';
      ['start','end'].forEach(function(k){if((c=C(k)))c.depend=[{col:'drel',op:'ne',val:255,act:'disable',hint:hint}];});
      if((c=C('lower')))c.depend=[{col:'cLow',op:'eq',val:0,act:'disable',hint:'Der untere Grenzwert ist abgeschaltet.'}];
      if((c=C('upper')))c.depend=[{col:'cHigh',op:'eq',val:0,act:'disable',hint:'Der obere Grenzwert ist abgeschaltet.'}];
      ['diff','hyst','lower','upper'].forEach(function(k){if((c=C(k)))c.unitFrom='sens';});
      (w.cols||[]).forEach(function(x,i){x.group=(i<10)?'Schaltregel':'Monitor';});
      w.rtGroups=true;
      if(!(w.rtWarn||[]).length)w.rtWarn=[
        {when:[{col:'bad',op:'eq',val:0}],lvl:'warn',text:'Prüfzeit 0 ist unzulässig (Minimum 1 s).'},
        {when:[{col:'good',op:'eq',val:0}],lvl:'warn',text:'Prüfzeit 0 ist unzulässig (Minimum 1 s).'}
      ];
      if(!w.rtSumPat)w.rtSumPat='%sens %logic %diff ± %hyst, %start–%end → %rel %state';
    }else if(fam==='DIGC'||fam==='SWITCHC'){
      if((c=C('time')))c.depend=[
        {col:'func',op:'in',val:'0,1',act:'disable',hint:'Schaltdauer wirkt nur bei Impuls und Impuls mit Reset.'},
        {col:'func',op:'in',val:'2,3',act:'require',hint:'Impuls braucht eine Dauer größer als null.'}];
      if(!(w.rtWarn||[]).length)w.rtWarn=[{when:[{col:'func',op:'in',val:'2,3'},{col:'time',op:'eq',val:0}],lvl:'warn',text:'Impuls mit Dauer 0 ist wirkungslos.'}];
      if(!w.rtSumPat)w.rtSumPat='%inp → %func %time → %rel %state';
    }
    // Scharf-Spalte per WORTGLEICHHEIT, nicht per Teilstring: die alte Heuristik /...|ein/i
    // traf auch "Eingang" und "Zeit Ein" und daempfte dann die falschen Zeilen.
    var act='';
    (w.cols||[]).forEach(function(x){
      if(!act&&x.type==='bool'&&/^(anwenden|aktiv|aktiviert)$/i.test(String(x.label||'').replace(/^\s+|\s+$/g,'')))act=x.key;
    });
    if(!w.rtActKey)w.rtActKey=act||undefined;
    (w.cols||[]).forEach(function(x){
      var lb=String(x.label||'').replace(/^\s+|\s+$/g,'');
      if(x.confirm===undefined&&/^(ausgang|schaltzustand)$/i.test(lb))x.confirm=true;
      if(x.dup===undefined&&/^(ausgang)$/i.test(lb))x.dup=true;   // ProCon: Relais nur einmal belegen
    });
  }
  function _rtPrevText(w,res){
    var n=Object.keys(res.rules).length;
    return 'Gefunden: '+n+' Regeln × '+res.fields.length+' Feldern, '+res.cells.length+' Zellen. '
      +res.miss.length+' Namen nicht zugeordnet'+(res.miss.length?(': '+res.miss.slice(0,6).join(', ')+(res.miss.length>6?' …':'')):'')+'. '
      +'Präfix: '+(res.prefix||'–')+'. Spalten: '+res.fields.join(' · ');
  }
  function _rtImport(w,bindOnly){
    _rtScan(w,function(res){
      if(!res.cells.length){toast('Keine passenden Namen in der Kategorie');return;}
      var fam=_rtFam(res.prefix),alias=_RT_ALIAS[fam]||{};
      var keyOf=function(f){return alias[f]||_rtSlug(f);};
      // (a) bestehende Bindung mit derselben vid behalten - das ueberlebt Umbenennungen in
      // Symcon und rettet jede Handkorrektur ueber ein erneutes Einlesen hinweg.
      var byVid={};(w.items||[]).forEach(function(it){if(it&&it.vid&&it.r>=0)byVid[it.vid]=it;});
      if(bindOnly){
        // (b) sonst ueber Schluessel+Zeile, (c) sonst ueber den Feldnamen
        res.cells.forEach(function(c){
          var k=keyOf(c.f),col=_rtCol(w,k)||_rtCol(w,_rtSlug(c.f));
          if(!col){for(var i=0;i<(w.cols||[]).length;i++)if(String(w.cols[i].label)===c.f){col=w.cols[i];break;}}
          if(!col)return;
          var it=_rtItem(w,c.r,col.key);
          if(it)it.vid=c.vid;else (w.items=w.items||[]).push({r:c.r,c:_rtColIdx(w,col.key),k:col.key,vid:c.vid});
        });
        w.rtSrc=w.rtSrc||{};w.rtSrc.prefix=res.prefix;w.rtSrc.ts=Math.floor(Date.now()/1000);
        _rtSync(w);render();renderProps();commit();
        toast('Neu gebunden: '+res.cells.length+' Zellen');
        return;
      }
      // Musterzelle je Spalte: EIN assoc-Abruf, danach Typ, Optionen und Grenzen
      var keys=[],sample={},old={};
      (w.cols||[]).forEach(function(c){old[c.key]=c;});
      res.fields.forEach(function(f){var k=keyOf(f);if(keys.indexOf(k)<0)keys.push(k);});
      res.cells.forEach(function(c){var k=keyOf(c.f);if(!sample[k]&&c.r===res.rmin)sample[k]={vid:c.vid,node:c.node,f:c.f};});
      res.cells.forEach(function(c){var k=keyOf(c.f);if(!sample[k])sample[k]={vid:c.vid,node:c.node,f:c.f};});
      var pend=keys.length,got={};
      var finish=function(){
        w.cols=keys.map(function(k){
          var s=sample[k],det=_rtDetect(got[k],s&&s.node),o=old[k]||{};
          var c={key:k,label:(o.label!=null&&o.label!=='')?o.label:(s?s.f:k),type:det.type};
          if(det.optSrc)c.optSrc=det.optSrc;else if(det.type==='sel')c.optSrc='profile';
          // Bewusst NICHT uebernommen: min/max/step/dec/options. Die kommen zur Laufzeit aus
          // dem Profil - so kann sich das Seiten-JSON nie wieder vom Profil entfernen.
          ['unit','dec','wid','align','hidden','ro','confirm','group','color','sub','depend','alt','unitFrom'].forEach(function(f){
            if(o[f]!==undefined)c[f]=o[f];});
          if(c.unit===undefined&&det.unit)c.unit=det.unit;
          if(det.ro&&o.ro===undefined)c.ro=true;
          return c;
        });
        var n=res.rmax+1,oldR=w.rows||[];
        w.rows=[];for(var r=0;r<n;r++)w.rows.push(oldR[r]?oldR[r]:{label:'Regel '+r});
        var items=[],taken={};
        res.cells.forEach(function(c){
          var k=keyOf(c.f);if(keys.indexOf(k)<0)return;
          // (a) haengt diese vid schon an einer Zelle, deren Spalte es weiter gibt, bleibt sie
          //     dort - das ueberlebt Umbenennungen in Symcon und rettet Handkorrekturen.
          //     Sonst (b) ueber Schluessel + Zeilennummer aus dem Namen.
          var prev=byVid[c.vid],rr=c.r,kk=k;
          if(prev&&prev.r>=0&&keys.indexOf(prev.k)>=0){rr=prev.r;kk=prev.k;}
          var tag=rr+'/'+kk;if(taken[tag])return;taken[tag]=1;
          items.push({r:rr,c:keys.indexOf(kk),k:kk,vid:c.vid});
        });
        w.items=items;
        if(fam)_rtPreset(w,fam);
        w.rtSrc=w.rtSrc||{};w.rtSrc.prefix=res.prefix;w.rtSrc.ts=Math.floor(Date.now()/1000);
        delete w.rowLabels;                                   // ab v2 nicht mehr gelesen
        _rtSync(w);_rtLoad(w);
        render();renderProps();commit();
        toast('Eingelesen: '+w.rows.length+' Regeln × '+w.cols.length+' Felder');
      };
      if(!pend){finish();return;}
      keys.forEach(function(k){
        _rtFetchAssoc(sample[k]?sample[k].vid:0,function(a){got[k]=a;if(--pend<=0)finish();});
      });
    });
  }
  // Reparaturweg fuer einzelne Luecken: Muster nur auf EINE Spalte anwenden, ohne bestehende
  // Bindungen zu ueberschreiben.
  function _rtFillCol(w,key){
    var col=_rtCol(w,key);if(!col)return;
    _rtScan(w,function(res){
      var n=0;
      res.cells.forEach(function(c){
        if(_rtSlug(c.f)!==_rtSlug(col.label||'')&&_rtSlug(c.f)!==key&&c.f!==col.label)return;
        var it=_rtItem(w,c.r,key);
        if(it&&it.vid)return;
        if(it)it.vid=c.vid;else (w.items=w.items||[]).push({r:c.r,c:_rtColIdx(w,key),k:key,vid:c.vid});
        n++;
      });
      _rtSync(w);render();renderProps();commit();
      toast(n?('Gefüllt: '+n+' Zellen'):'Nichts Passendes gefunden');
    });
  }

  // ---------- Variablennamen fuers Panel ----------
  function _rtName(vid){
    if(!vid)return null;
    if(_rtNm[vid]!==undefined)return _rtNm[vid];
    if(_rtNmW[vid])return null;
    _rtNmW[vid]=1;
    fetch('?api=tree&search='+vid,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var n=null;(j.nodes||[]).forEach(function(x){if(x.id===vid)n=x;});
      _rtNm[vid]=n?{name:n.name,act:n.action===true}:null;
      delete _rtNmW[vid];
      if(_rtNmT)return;
      _rtNmT=setTimeout(function(){_rtNmT=null;if(typeof renderProps==='function')renderProps();},400);
    }).catch(function(){delete _rtNmW[vid];});
    return null;
  }

  // ---------- Panel-Bausteine ----------
  function _rtHint(t){return '<div style="font-size:11px;color:var(--muted);line-height:1.45;margin:-2px 2px 6px">'+t+'</div>';}
  function _rtSel(id,cur,opts,extra){
    return '<select '+(id.charAt(0)==='#'?('id="'+id.slice(1)+'"'):id)+(extra||'')+'>'+opts.map(function(o){
      return '<option value="'+esc(o[0])+'"'+(String(cur||'')===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select>';
  }
  function _rtColOpts(w,cur,leer){
    var o=leer?[['',leer]]:[];
    (w.cols||[]).forEach(function(c,i){o.push([c.key,(i+1)+' · '+(c.label||c.key)]);});
    return o;
  }
  function _rtCurCol(w){
    var n=(w.cols||[]).length;if(!n)return -1;
    var i=parseInt(w._rtCol);if(isNaN(i)||i<0||i>=n)i=0;
    return i;
  }

  // ---------- Registrierung ----------
  defWidget('ruletable',{
    label:'Regel-Tabelle', cat:'Steuerung', paletteIcon:'wselect', size:[1168,470],
    noHover:true,          // sonst erschiene die ganze 1168-px-Tabelle als eine schaltbare Flaeche
    defaults:function(w){w.rtVer=2;w.cols=[];w.rows=[];w.items=[];w.label='Regeln';},

    render:function(w){
      _rtNorm(w);
      var cols=w.cols||[],rows=w.rows||[],vis=_rtVis(w);
      var dens=_RT_DENS[_rtG(w,'rtDens','normal')]||_RT_DENS.normal;
      var head=_rtG(w,'rtHead','full'),ch=_rtG(w,'rtColHead','textunit');
      var cls='rt rt-g-'+_rtG(w,'rtGrid','soft')+(_rtG(w,'rtZebra',true)!==false?' rt-zeb':'')+(_rtG(w,'rtWrite','on')==='off'?' rt-ro':'');
      // Nur --rt-fs setzen: das fruehere inline font-size am table gewann gegen styles.css und
      // machte die dortige Regel tot. position:relative traegt das Editiersheet.
      var h='<div class="'+cls+'" data-role="rtroot" data-actc="'+_rtColIdx(w,w.rtActKey||'')+'"'
        +' style="position:relative;--rt-rowh:'+dens+';--rt-fs:clamp(11px,2.4cqmin,15px)">';
      var lock=_rtLockBtn(w);
      if(head!=='none'||lock){
        h+='<div class="rthead" title="'+esc(_rtGateText(w))+'">'
          +'<span class="rth-eyebrow">'+escL(w.label||'Regeln')+'</span>'
          +'<span style="display:inline-flex;align-items:center;gap:clamp(5px,2.4cqmin,10px)">'
          +((head==='full')?('<span class="rth-meta">'+rows.length+' Regeln · '+vis.length+' Felder</span>'):'')
          +lock+'</span></div>';
      }
      h+='<div class="rtscroll"><table class="rtt">';
      if(ch!=='none'){
        h+='<thead>';
        if(w.rtGroups)h+=_rtGrpRow(w,vis);
        h+='<tr><th class="rtrl">Regel</th>';
        vis.forEach(function(ci){
          var c=cols[ci],al=_rtAlign(c);
          var u=(ch==='textunit'&&c.unit)?('<small>'+esc(c.unit)+'</small>'):'';
          h+='<th'+(al==='r'?' class="rt-num"':'')+' style="text-align:'+_rtTA(al)+'" title="'+esc((c.label||'')+(c.sub?(' – '+c.sub):''))+'">'+esc(c.label||'')+u+'</th>';
        });
        h+='</tr></thead>';
      }
      h+='<tbody>';
      rows.forEach(function(ro,r){
        if(ro.hidden)return;
        h+='<tr data-r="'+r+'" data-active="'+(_rtActive(w,r)?'1':'0')+'">'+_rtRowInner(w,r,vis)+'</tr>';
        if(w.rtSum)h+='<tr class="rtsum" data-sum="'+r+'"><td class="rtrl"></td><td data-role="rtsumtd" colspan="'+vis.length+'">'+esc(_rtSum(w,r))+'</td></tr>';
      });
      h+='</tbody></table></div></div>';
      return h;
    },

    mount:function(w){
      _rtNorm(w);
      _rtLoad(w);
      _rtRoots(w).forEach(function(rt){
        if(rt.getAttribute('data-kb'))return;
        rt.setAttribute('data-kb','1');
        // Eigener Listener aus mount() ist NICHT durch den zentralen Edit-Guard geschuetzt -
        // er muss selbst pruefen (Muster: shadelog.js, camera.js, stepper.js).
        rt.addEventListener('keydown',function(e){
          if(typeof mode!=='undefined'&&mode==='edit')return;
          var el=rt.closest('.w');if(!el)return;
          if(e.key==='Escape'){_rtSheetClose(el);return;}
          var sh=e.target.closest&&e.target.closest('[data-role=rtsheet]');
          if(sh){if(e.key==='Enter'){e.preventDefault();var ok=$('[data-rtok]',sh);if(ok)ok.click();}return;}
          var cell=e.target.closest&&e.target.closest('.rtc[data-rv]');
          if(cell&&(e.key==='Enter'||e.key===' '||e.key==='Spacebar')){e.preventDefault();cell.click();}
        });
      });
    },

    live:function(w,el,id,d,base,txt,on){
      _rtNorm(w);
      var it=_rtByVid(w,id);if(!it)return true;
      // Quittung: bestaetigt sich der Wert, verschwindet der Punkt. Faellt er zurueck - das
      // passiert, sobald das Modul seine Regeln zurueckspiegelt und das Geraet den Wert nicht
      // uebernommen hat -, wird die Zelle rot. Eine Ruecklesung kann den Schattenmodus des
      // Moduls nicht erkennen, weil dort die IPS-Variable optimistisch vorab gesetzt wird.
      var p=_rtPend[id];
      if(p){
        if(String(d.v)===p.v||(!isNaN(_rtNum(d.v))&&_rtNum(d.v)===_rtNum(p.v))){delete _rtPend[id];delete _rtFail[id];}
        else if(Date.now()-p.t>2500){delete _rtPend[id];_rtFail[id]=1;toast('Das Gerät hat den Wert nicht übernommen.');}
      }
      if(it.r<0){_rtPaintEl(w,el);return true;}     // Scharf-Signal: ganze Tabelle neu bewerten
      // Ganze Zeile neu zeichnen: alt, depend, unitFrom, Warnungen und die Zusammenfassung
      // haengen an NACHBARZELLEN derselben Zeile, eine Einzelzelle waere danach inkonsistent.
      _rtRowPaint(w,el,it.r);
      return true;
    },

    click:function(w,el,e){
      _rtNorm(w);
      var sh=e.target.closest('[data-role=rtsheet]');
      if(sh){
        var b=e.target.closest('button');
        if(!b){if(e.target===sh)_rtSheetClose(el);return true;}
        if(b.hasAttribute('data-rtcancel')){_rtSheetClose(el);return true;}
        var key=sh.getAttribute('data-k'),col=_rtCol(w,key)||{},r=parseInt(sh.getAttribute('data-r'));
        if(b.hasAttribute('data-rtv')){_rtSheetApply(w,el,sh,b.getAttribute('data-rtv'));return true;}
        if(b.hasAttribute('data-rttime')){
          var mv=_rtHMto(b.getAttribute('data-rttime'));
          var ti=$('[data-role=rtvtime]',sh);
          if(ti)ti.value=b.getAttribute('data-rttime');
          else{var hh=$('[data-role=rtvh]',sh),mm=$('[data-role=rtvm]',sh);if(hh&&mm){hh.value=Math.floor(mv/60);mm.value=mv%60;}}
          return true;
        }
        if(b.hasAttribute('data-rtmin')){
          var dm=parseInt(b.getAttribute('data-rtmin')),cv=_rtSheetTake(w,sh,col,r);
          if(cv==null)return true;
          var nv=cv+dm;if(nv<0)nv+=1440;if(nv>1439)nv-=1440;
          var t2=$('[data-role=rtvtime]',sh);
          if(t2)t2.value=_rtHM(nv);
          else{var h2=$('[data-role=rtvh]',sh),m2=$('[data-role=rtvm]',sh);if(h2&&m2){h2.value=Math.floor(nv/60);m2.value=nv%60;}}
          return true;
        }
        if(b.hasAttribute('data-rtdur')){
          var s=parseInt(b.getAttribute('data-rtdur'));
          var dh=$('[data-role=rtvdh]',sh),dmn=$('[data-role=rtvdm]',sh),ds=$('[data-role=rtvds]',sh);
          if(dh&&dmn&&ds){dh.value=Math.floor(s/3600);dmn.value=Math.floor((s%3600)/60);ds.value=s%60;}
          return true;
        }
        if(b.hasAttribute('data-rtstep')||b.hasAttribute('data-rtdelta')){
          var f=$('[data-role=rtvnum]',sh);if(!f)return true;
          var lim=_rtLim(w,col),dec=_rtDec(w,col,_rtEff(w,col,r));
          var step=b.hasAttribute('data-rtdelta')?parseFloat(b.getAttribute('data-rtdelta')):(parseFloat(b.getAttribute('data-rtstep'))*lim.step);
          var v=_rtNum(f.value);if(isNaN(v))v=0;
          v=+(v+step).toFixed(Math.max(0,dec));
          if(lim.min!=null&&v<lim.min)v=lim.min;
          if(lim.max!=null&&v>lim.max)v=lim.max;
          f.value=v.toFixed(Math.max(0,dec));
          return true;
        }
        if(b.hasAttribute('data-rtok')){
          var val=_rtSheetTake(w,sh,col,r);
          if(val!==null&&val!==undefined)_rtSheetApply(w,el,sh,val);
          return true;
        }
        return true;
      }
      var lk=e.target.closest('[data-role=rtlock]');
      if(lk){
        if(_rtUnlocked(w))delete _rtLockT[w.id];else _rtLockTouch(w);
        _rtPaintEl(w,el);
        if(_rtUnlocked(w))setTimeout(function(){_rtRepaintSoon(w);},(+_rtG(w,'rtLockSec',120))*1000+200);
        return true;
      }
      var cell=e.target.closest('.rtc[data-rv]');
      if(!cell)return false;
      var cr=parseInt(cell.getAttribute('data-r')),ck=cell.getAttribute('data-k'),vid=parseInt(cell.getAttribute('data-rv'));
      var ccol=_rtCol(w,ck);if(!ccol)return true;
      var g=_rtCanWrite(w,ccol,cr);
      if(!g.ok){toast(g.grund);return true;}
      // Ein Fehltipp in einer 8x16-Matrix kann Pumpe, Absorberventil oder eine Dosierpumpe
      // schalten. Nur bei ausdruecklich gewaehlter Absicherung "direkt" schaltet ein Tipp.
      if(ccol.type==='bool'&&_rtG(w,'rtGate','sheet')==='direkt'&&!ccol.confirm){
        var d=_lastVals[vid],on=d?_rtOn(d.v):false,sw=$('[data-role=rtsw]',cell);
        if(sw)sw.classList.toggle('off',on);       // optimistisch, aber OHNE _lastVals zu faelschen
        _rtWrite(w,el,vid,on?0:1,cell);
        return true;
      }
      _rtSheetOpen(w,el,cr,ck,vid);
      return true;
    },

    // Klapplisten und Zahlenfelder im Sheet schreiben NICHT beim Aendern - erst "Uebernehmen"
    // loest genau einen Schreibvorgang aus. Der Haken verbraucht das Ereignis nur.
    input:function(w,el,e){
      _rtNorm(w);
      return !!(e.target.closest&&e.target.closest('[data-role=rtsheet]'));
    },

    props:function(w){
      if(w.type!=='ruletable')return '';
      _rtNorm(w);
      var cols=w.cols||[],rows=w.rows||[],ci=_rtCurCol(w),col=(ci>=0)?cols[ci]:null;
      var cat=(w.rtSrc&&w.rtSrc.cat)|0,dis=cat?'':' disabled';
      var h='';

      // ---- D.1 Herkunft ----
      h+='<div class="pgh">Herkunft</div>';
      h+=fieldPick(w,'rtSrc.cat','Kategorie');
      h+=row('Namensmuster','<input id="pRtPat" value="'+esc((w.rtSrc&&w.rtSrc.pat)||'%P-Regel %r: %f')+'">');
      h+=_rtHint('<b>%P</b> Pr&auml;fix &middot; <b>%r</b> Regelnummer &middot; <b>%f</b> Feldname');
      h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin:2px 2px 6px">'
        +'<button class="btn" id="pRtImp"'+dis+'>Regeln einlesen</button>'
        +'<button class="btn" id="pRtBind"'+dis+'>Nur neu binden</button>'
        +'<button class="btn" id="pRtScan"'+dis+'>Vorschau</button></div>';
      if(w.rtSrc&&w.rtSrc.ts){
        var dt=new Date(w.rtSrc.ts*1000);
        h+=_rtHint('Zuletzt eingelesen: '+_rt2(dt.getDate())+'.'+_rt2(dt.getMonth()+1)+'.'+dt.getFullYear()+' '+_rt2(dt.getHours())+':'+_rt2(dt.getMinutes())
          +' &middot; '+rows.length+' Regeln &times; '+cols.length+' Felder &middot; '+(w.items||[]).filter(function(x){return x&&x.r>=0&&x.vid;}).length+' Zellen'
          +((w.rtSrc.prefix)?(' &middot; Pr&auml;fix '+esc(w.rtSrc.prefix)):''));
      }
      if(_rtPrev[w.id])h+='<div class="prop" style="margin-top:4px;font-size:11px;line-height:1.5;color:var(--muted)">'+esc(_rtPrev[w.id])+'</div>';

      // ---- D.2 Spalten ----
      cols.forEach(function(c){c.vis=!c.hidden;});   // Spiegel fuer die Checkbox; _rtSync raeumt ihn weg
      h+='<div class="pgh">Spalten</div>';
      h+=listEditor(w,'cols','Spalten: Schlüssel · Bezeichnung · Art · Einheit · Breite · sichtbar · nur Anzeige',[
        {k:'key',   ph:'Schlüssel', h:'Schlüssel'},
        {k:'label', ph:'Bezeichnung', h:'Bezeichnung'},
        {k:'type',  type:'select', def:'num', h:'Art', options:_RT_TYPES},
        {k:'unit',  ph:'Einheit', h:'Einheit'},
        {k:'wid',   ph:'1', h:'Breite'},
        {k:'vis',   type:'check', ph:'sichtbar', h:'sichtbar'},
        {k:'ro',    type:'check', ph:'nur Anzeige', h:'nur Anz.'}
      ],{wrap:false});
      h+=_rtHint('Umsortieren und L&ouml;schen sind bindungsneutral: die Zellen h&auml;ngen am <b>Schl&uuml;ssel</b>, nicht am Spaltenindex.');

      // ---- D.3 Spalte im Detail ----
      if(col){
        var lim=_rtLim(w,col),prof=_rtProf(w,col);
        h+='<div class="pgh">Spalte im Detail</div>';
        h+=row('Spalte bearbeiten',_rtSel('#pRtColSel',String(ci),cols.map(function(c,i){return [String(i),(i+1)+' · '+(c.label||c.key)];})));
        h+=row('Bezeichnung','<input id="pRtcLabel" value="'+esc(col.label||'')+'">');
        h+=row('Zusatzzeile','<input id="pRtcSub" value="'+esc(col.sub||'')+'" placeholder="zweite Kopfzeile / Tooltip">');
        h+=row('Gruppe','<input id="pRtcGrp" value="'+esc(col.group||'')+'" placeholder="z. B. Schaltregel">');
        h+=row('Ausrichtung',_rtSel('#pRtcAlign',col.align||'',[['','automatisch'],['l','links'],['c','mittig'],['r','rechts']]));
        h+=row('Farbe',skinSel(col.color||'','id="pRtcColor"'));
        h+=row('Art',_rtSel('#pRtcType',col.type||'num',_RT_TYPES));
        h+=row('Einheit','<input id="pRtcUnit" value="'+esc(col.unit||'')+'" placeholder="'+esc(prof&&prof.suffix?prof.suffix:'aus Profil')+'">');
        h+=row('Nachkommastellen','<input id="pRtcDec" type="number" min="-1" max="6" value="'+(col.dec!=null&&col.dec!==''?col.dec:'')+'" placeholder="'+((prof&&prof.digits!=null)?prof.digits:'aus Profil')+'">');
        h+=row('Min / Max / Schritt',
           '<input id="pRtcMin" type="number" step="any" style="width:62px" value="'+(col.min!=null&&col.min!==''?col.min:'')+'" placeholder="'+(lim.min!=null?lim.min:'')+'"> '
          +'<input id="pRtcMax" type="number" step="any" style="width:62px" value="'+(col.max!=null&&col.max!==''?col.max:'')+'" placeholder="'+(lim.max!=null?lim.max:'')+'"> '
          +'<input id="pRtcStep" type="number" step="any" style="width:62px" value="'+(col.step!=null&&col.step!==''?col.step:'')+'" placeholder="'+lim.step+'">');
        h+=_rtHint('Leer lassen = Wert aus dem Variablenprofil. Nur eine Abweichung wird gespeichert.');
        h+=row('Einheit aus Spalte',_rtSel('#pRtcUF',col.unitFrom||'',_rtColOpts(w,col.unitFrom,'fest').filter(function(o,i){
          if(i===0)return true;var c2=_rtCol(w,o[0]);return c2&&c2.type==='sel';})));
        h+=_rtHint('Die Einheit dieser Spalte folgt der Auswahl in der genannten Spalte <b>derselben Zeile</b> (Analog: der Sensor bestimmt mBar / m&sup3;/h / cm/s).');

        if(col.type==='sel'){
          h+='<div class="pgh">Optionen</div>';
          h+=row('Optionen aus',_rtSel('#pRtcOptSrc',col.optSrc||'profile',[['profile','Variablenprofil'],['manual','eigener Liste']]));
          if((col.optSrc||'profile')==='profile'){
            h+=_rtHint(prof
              ? ('Optionen, Farben und Icons kommen aus dem Profil <b>'+esc(prof.prof||'(ohne Profil)')+'</b> ('+prof.opts.length+' Eintr&auml;ge) und folgen ihm automatisch.')
              : 'Profil wird beim n&auml;chsten Zeichnen geladen (Musterzelle der Spalte).');
            h+='<button class="btn" id="pRtcReload" style="margin:0 2px 6px">Profil neu laden</button>';
          }else{
            h+='<div class="prop" style="margin-top:6px"><div style="font-size:11px;color:var(--muted);margin-bottom:5px">Eigene Optionen: Wert · Text · Farbe</div>';
            (col.options||[]).forEach(function(o,j){
              h+='<div class="fcrow" style="display:grid;grid-template-columns:1fr 1.4fr 1fr 22px;gap:4px;margin-bottom:4px">'
                +'<input data-rto="'+j+'.value" value="'+esc(String(o.value!=null?o.value:''))+'" placeholder="Wert">'
                +'<input data-rto="'+j+'.text" value="'+esc(o.text||'')+'" placeholder="Text">'
                +skinSel(o.color||'','data-rto="'+j+'.color"')
                +'<button class="btn" data-rtodel="'+j+'" style="padding:2px" title="löschen"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
            });
            h+='<button class="btn" id="pRtoAdd"><svg class="i"><use href="#ic-plus"/></svg></button></div>';
          }
        }

        h+='<div class="pgh">Bedienung</div>';
        h+=row('Nur Anzeige','<input type="checkbox" id="pRtcRo"'+(col.ro?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Zelle ist nicht bedienbar</span>');
        h+=row('Rückfrage','<input type="checkbox" id="pRtcConf"'+(col.confirm?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">gefährliche Spalte: zusätzlich bestätigen</span>');
        h+=row('Doppelbelegung melden','<input type="checkbox" id="pRtcDup"'+(col.dup?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">warnen, wenn zwei scharfe Regeln denselben Wert belegen</span>');

        // Abhaengigkeiten
        h+='<div class="pgh">Abhängigkeiten</div>';
        (col.depend||[]).forEach(function(dp,j){
          h+='<div class="fcrow" style="display:grid;grid-template-columns:1fr .8fr .8fr 1fr 22px;gap:4px;margin-bottom:4px">'
            +_rtSel('data-rtd="'+j+'.col"',dp.col||'',_rtColOpts(w,dp.col,'Spalte …'))
            +_rtSel('data-rtd="'+j+'.op"',dp.op||'eq',_RT_OPS)
            +'<input data-rtd="'+j+'.val" value="'+esc(String(dp.val!=null?dp.val:''))+'" placeholder="Wert">'
            +_rtSel('data-rtd="'+j+'.act"',dp.act||'disable',_RT_ACTS)
            +'<button class="btn" data-rtddel="'+j+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>'
            +'<input data-rtd="'+j+'.hint" value="'+esc(dp.hint||'')+'" placeholder="Hinweistext" style="width:100%;margin-bottom:6px">';
        });
        h+='<button class="btn" id="pRtdAdd"><svg class="i"><use href="#ic-plus"/></svg>Bedingung</button>';

        // Umbeschriftung
        h+='<div class="pgh">Umbeschriftung</div>';
        (col.alt||[]).forEach(function(a,j){
          var wn=a.when||{};
          h+='<div class="fcrow" style="display:grid;grid-template-columns:1fr .8fr .8fr;gap:4px;margin-bottom:3px">'
            +_rtSel('data-rta="'+j+'.col"',wn.col||'',_rtColOpts(w,wn.col,'Spalte …'))
            +_rtSel('data-rta="'+j+'.op"',wn.op||'eq',_RT_OPS)
            +'<input data-rta="'+j+'.val" value="'+esc(String(wn.val!=null?wn.val:''))+'" placeholder="Wert"></div>'
            +'<div class="fcrow" style="display:grid;grid-template-columns:1.4fr .8fr .6fr 22px;gap:4px;margin-bottom:6px">'
            +'<input data-rta="'+j+'.label" value="'+esc(a.label||'')+'" placeholder="Bezeichnung">'
            +'<input data-rta="'+j+'.unit" value="'+esc(a.unit||'')+'" placeholder="Einheit">'
            +'<input data-rta="'+j+'.dec" value="'+(a.dec!=null?a.dec:'')+'" placeholder="Dez.">'
            +'<button class="btn" data-rtadel="'+j+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
        });
        h+='<button class="btn" id="pRtaAdd"><svg class="i"><use href="#ic-plus"/></svg>Regel</button>';

        // ---- D.4 Zellen dieser Spalte ----
        h+='<div class="pgh">Zellen der Spalte „'+esc(col.label||col.key)+'“</div>';
        h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin:0 2px 6px">'
          +'<button class="btn" id="pRtFill"'+dis+'>alle aus Muster füllen</button>'
          +'<button class="btn" id="pRtClr">alle leeren</button></div>';
        rows.forEach(function(ro,r){
          if(ro.hidden)return;
          var idx=_rtItemIdx(w,r,col.key),it=w.items[idx],nm=it.vid?_rtName(it.vid):null;
          h+=fieldPick(w,'items.'+idx+'.vid',esc(ro.label||('Regel '+r)));
          h+='<div style="font-size:11px;color:var(--muted);margin:-5px 2px 6px 6px">'
            +(it.vid?(nm?(esc(nm.name)+' '+(nm.act?'<span style="color:var(--ok)">✓</span>'
                    :'<span style="color:var(--warn)" title="Variable ist nicht beschreibbar">⚿</span>')
                    ):'…'):'<span style="color:var(--warn)">nicht gebunden</span>')+'</div>';
        });
      }else{
        h+=_rtHint('Noch keine Spalte vorhanden – oben eine Kategorie w&auml;hlen und <b>Regeln einlesen</b> dr&uuml;cken.');
      }

      // ---- D.5 Zeilen ----
      h+='<div class="pgh">Regeln (Zeilen)</div>';
      rows.forEach(function(ro,r){
        h+='<div class="fcrow" style="display:grid;grid-template-columns:22px 1.2fr 26px 1fr 22px;gap:4px;margin-bottom:4px;align-items:center">'
          +'<span style="font-size:11px;color:var(--faint);text-align:right">'+r+'</span>'
          +'<input data-rtr="'+r+'.label" value="'+esc(ro.label||'')+'" placeholder="Regel '+r+'">'
          +'<input type="checkbox" data-rtr="'+r+'.vis"'+(ro.hidden?'':' checked')+' title="sichtbar">'
          +'<input data-rtr="'+r+'.note" value="'+esc(ro.note||'')+'" placeholder="Notiz">'
          +'<button class="btn" data-rtrdel="'+r+'" style="padding:2px" title="löschen"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
      });
      h+='<button class="btn" id="pRtRowAdd"><svg class="i"><use href="#ic-plus"/></svg>Regel</button>';
      h+=_rtHint('Die Regelnummer ist zugleich die <b>Priorit&auml;t</b> – die h&ouml;here Nummer gewinnt, wenn zwei Regeln dasselbe Relais belegen. Deshalb keine Umsortierung.');

      // ---- D.6 Darstellung ----
      h+='<div class="pgh">Darstellung</div>';
      h+=row('Kopfzeile',_rtSel('#pRtHead',_rtG(w,'rtHead','full'),[['full','Label + Zähler'],['short','nur Label'],['none','aus']]));
      h+=row('Spaltenkopf',_rtSel('#pRtColHead',_rtG(w,'rtColHead','textunit'),[['textunit','Text + Einheit'],['text','nur Text (Einheit in der Zelle)'],['none','aus']]));
      h+=row('Trennlinien',_rtSel('#pRtGrid',_rtG(w,'rtGrid','soft'),[['none','keine'],['soft','waagerecht'],['full','Gitter']]));
      h+=row('Zeilenhöhe',_rtSel('#pRtDens',_rtG(w,'rtDens','normal'),[['kompakt','kompakt'],['normal','normal'],['weit','weit']]));
      h+=row('Zebrastreifen','<input type="checkbox" id="pRtZebra"'+(_rtG(w,'rtZebra',true)!==false?' checked':'')+'>');
      h+=row('Nummernchip','<input type="checkbox" id="pRtRowNum"'+(_rtG(w,'rtRowNum',true)!==false?' checked':'')+'>');
      h+=row('Spaltengruppen','<input type="checkbox" id="pRtGroups"'+(w.rtGroups?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">zweite Kopfzeile aus dem Feld Gruppe</span>');
      h+=row('Zusammenfassung','<input type="checkbox" id="pRtSum"'+(w.rtSum?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Klartextsatz je Regel</span>');
      if(w.rtSum){
        h+=row('Satzvorlage','<input id="pRtSumPat" value="'+esc(w.rtSumPat||'')+'" placeholder="%sens1 %logic %sens2 + %diff, %start–%end → %rel %state">');
        h+=_rtHint('<b>%schl&uuml;ssel</b> wird durch den Anzeigetext der Zelle ersetzt.'
          +(rows.length?('<br>Vorschau Zeile 0: <b>'+esc(_rtSum(w,0))+'</b>'):''));
      }
      h+=row('Zeile scharf ab',_rtSel('#pRtActKey',w.rtActKey||'',[['','keine']].concat((w.cols||[]).filter(function(c){return c.type==='bool';}).map(function(c){return [c.key,c.label||c.key];}))));
      h+=_rtHint('Die genannte Schalterspalte d&auml;mpft die Zeile, wenn sie aus ist. Ersetzt die alte Ratehilfe, die auch „Eingang“ und „Zeit Ein“ traf.');

      // ---- D.7 Schreiben ----
      h+='<div class="pgh">Schreiben</div>';
      h+=row('Schreiben',_rtSel('#pRtWrite',_rtG(w,'rtWrite','on'),[['on','erlaubt'],['off','nur Anzeige']]));
      h+=row('Absicherung',_rtSel('#pRtGate',_rtG(w,'rtGate','sheet'),[['direkt','direkt'],['sheet','Bestätigen im Sheet'],['lock','Freigabe-Schloss']]));
      if(_rtG(w,'rtGate','sheet')==='lock')
        h+=row('Schloss fällt zurück nach','<input id="pRtLockSec" type="number" min="5" step="5" style="width:80px" value="'+_rtG(w,'rtLockSec',120)+'"> s');
      h+=fieldPick(w,'rtArmVid','Scharf-Signal');
      h+=row('Invertiert','<input type="checkbox" id="pRtArmInv"'+(w.rtArmInv?' checked':'')+'>');
      h+='<div class="prop" style="margin-top:4px;font-size:11px;line-height:1.5;color:'+(w.rtArmVid?'var(--muted)':'var(--warn)')+'">Wirksamer Schutz: '+esc(_rtGateText(w))+'</div>';

      // ---- D.8 Warnungen ----
      h+='<div class="pgh">Warnungen</div>';
      (w.rtWarn||[]).forEach(function(x,i){
        h+='<div class="prop" style="margin-top:6px">';
        (x.when||[]).forEach(function(c,j){
          h+='<div class="fcrow" style="display:grid;grid-template-columns:1fr .8fr .8fr 22px;gap:4px;margin-bottom:3px">'
            +_rtSel('data-rtwc="'+i+'.'+j+'.col"',c.col||'',_rtColOpts(w,c.col,'Spalte …'))
            +_rtSel('data-rtwc="'+i+'.'+j+'.op"',c.op||'eq',_RT_OPS)
            +'<input data-rtwc="'+i+'.'+j+'.val" value="'+esc(String(c.val!=null?c.val:''))+'" placeholder="Wert">'
            +'<button class="btn" data-rtwcdel="'+i+'.'+j+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
        });
        h+='<div class="fcrow" style="display:grid;grid-template-columns:.8fr 2fr 22px;gap:4px;margin-top:3px">'
          +_rtSel('data-rtw="'+i+'.lvl"',x.lvl||'warn',_RT_LVLS)
          +'<input data-rtw="'+i+'.text" value="'+esc(x.text||'')+'" placeholder="Warntext">'
          +'<button class="btn" data-rtwdel="'+i+'" style="padding:2px" title="Warnung löschen"><svg class="i"><use href="#ic-minus"/></svg></button></div>'
          +'<button class="btn" data-rtwcadd="'+i+'" style="margin-top:4px"><svg class="i"><use href="#ic-plus"/></svg>Bedingung</button></div>';
      });
      h+='<button class="btn" id="pRtWarnAdd" style="margin-top:6px"><svg class="i"><use href="#ic-plus"/></svg>Warnung</button>';
      h+=_rtHint('Warnungen sind reine Anzeige – sie blockieren nichts. Alle Bedingungen einer Warnung m&uuml;ssen zutreffen.');
      return h;
    },

    wire:function(w){
      if(w.type!=='ruletable')return;
      _rtNorm(w);
      var cols=w.cols||[],rows=w.rows||[],ci=_rtCurCol(w),col=(ci>=0)?cols[ci]:null;
      var P=$('#props');
      // Textfelder: kein renderProps(), das zerstoerte den Fokus mitten im Tippen.
      function txt(id,fn){var e=$('#'+id);if(e)e.oninput=function(){fn(this.value);render();commit();};}
      function chk(id,fn){var e=$('#'+id);if(e)e.onchange=function(){fn(this.checked);render();renderProps();commit();};}
      function sel(id,fn){var e=$('#'+id);if(e)e.onchange=function(){fn(this.value);render();renderProps();commit();};}
      function undef(v){return (v===''||v==null)?undefined:v;}
      function unum(v){return (v===''||v==null)?undefined:(isNaN(parseFloat(v))?undefined:parseFloat(v));}

      // D.1
      txt('pRtPat',function(v){w.rtSrc=w.rtSrc||{};w.rtSrc.pat=undef(v);});
      if($('#pRtScan'))$('#pRtScan').onclick=function(){_rtScan(w,function(res){_rtPrev[w.id]=_rtPrevText(w,res);renderProps();});};
      if($('#pRtImp'))$('#pRtImp').onclick=function(){_rtImport(w,false);};
      if($('#pRtBind'))$('#pRtBind').onclick=function(){_rtImport(w,true);};

      // D.3 Spalte im Detail
      sel('pRtColSel',function(v){w._rtCol=parseInt(v)||0;});
      if(col){
        txt('pRtcLabel',function(v){col.label=v;});
        txt('pRtcSub',function(v){col.sub=undef(v);});
        txt('pRtcGrp',function(v){col.group=undef(v);});
        sel('pRtcAlign',function(v){col.align=undef(v);});
        sel('pRtcColor',function(v){col.color=undef(v);});
        sel('pRtcType',function(v){col.type=v;if(v==='sel'&&!col.optSrc)col.optSrc='profile';});
        txt('pRtcUnit',function(v){col.unit=undef(v);});
        txt('pRtcDec',function(v){col.dec=unum(v);});
        txt('pRtcMin',function(v){col.min=unum(v);});
        txt('pRtcMax',function(v){col.max=unum(v);});
        txt('pRtcStep',function(v){col.step=unum(v);});
        sel('pRtcUF',function(v){col.unitFrom=undef(v);});
        sel('pRtcOptSrc',function(v){col.optSrc=v;if(v==='manual'&&!col.options)col.options=[];});
        if($('#pRtcReload'))$('#pRtcReload').onclick=function(){
          var vid=_rtSample(w,col);if(!vid){toast('Spalte hat keine gebundene Zelle');return;}
          var p=_rtPrfV[vid];if(p){delete _rtPrf[p];}delete _rtPrfV[vid];
          _rtFetchAssoc(vid,function(){render();renderProps();});
        };
        chk('pRtcRo',function(v){col.ro=v||undefined;});
        chk('pRtcConf',function(v){col.confirm=v||undefined;});
        chk('pRtcDup',function(v){col.dup=v||undefined;});
        // eigene Optionen (verschachtelte Liste, die listEditor nicht kann)
        $$('[data-rto]',P).forEach(function(e){e.oninput=e.onchange=function(){
          var p=e.getAttribute('data-rto').split('.'),o=(col.options||[])[+p[0]];if(!o)return;
          o[p[1]]=(p[1]==='value')?e.value:undef(e.value);render();commit();};});
        $$('[data-rtodel]',P).forEach(function(b){b.onclick=function(){
          (col.options||[]).splice(+b.getAttribute('data-rtodel'),1);render();renderProps();commit();};});
        if($('#pRtoAdd'))$('#pRtoAdd').onclick=function(){col.options=col.options||[];col.options.push({value:'',text:'',color:''});render();renderProps();commit();};
        // Abhaengigkeiten
        $$('[data-rtd]',P).forEach(function(e){e.oninput=e.onchange=function(){
          var p=e.getAttribute('data-rtd').split('.'),d=(col.depend||[])[+p[0]];if(!d)return;
          d[p[1]]=undef(e.value);render();commit();};});
        $$('[data-rtddel]',P).forEach(function(b){b.onclick=function(){
          (col.depend||[]).splice(+b.getAttribute('data-rtddel'),1);render();renderProps();commit();};});
        if($('#pRtdAdd'))$('#pRtdAdd').onclick=function(){col.depend=col.depend||[];col.depend.push({col:'',op:'eq',val:'',act:'disable'});render();renderProps();commit();};
        // Umbeschriftung
        $$('[data-rta]',P).forEach(function(e){e.oninput=e.onchange=function(){
          var p=e.getAttribute('data-rta').split('.'),a=(col.alt||[])[+p[0]];if(!a)return;
          if(p[1]==='col'||p[1]==='op'||p[1]==='val'){a.when=a.when||{};a.when[p[1]]=undef(e.value);}
          else a[p[1]]=(p[1]==='dec')?unum(e.value):undef(e.value);
          render();commit();};});
        $$('[data-rtadel]',P).forEach(function(b){b.onclick=function(){
          (col.alt||[]).splice(+b.getAttribute('data-rtadel'),1);render();renderProps();commit();};});
        if($('#pRtaAdd'))$('#pRtaAdd').onclick=function(){col.alt=col.alt||[];col.alt.push({when:{col:'',op:'eq',val:''},label:'',unit:''});render();renderProps();commit();};
        // D.4
        if($('#pRtFill'))$('#pRtFill').onclick=function(){_rtFillCol(w,col.key);};
        if($('#pRtClr'))$('#pRtClr').onclick=function(){
          (w.items||[]).forEach(function(it){if(it&&it.k===col.key)it.vid=0;});
          render();renderProps();commit();};
      }

      // D.5 Zeilen
      $$('[data-rtr]',P).forEach(function(e){e.oninput=e.onchange=function(){
        var p=e.getAttribute('data-rtr').split('.'),ro=(w.rows||[])[+p[0]];if(!ro)return;
        if(p[1]==='vis')ro.hidden=e.checked?undefined:true;else ro[p[1]]=undef(e.value);
        render();commit();};});
      $$('[data-rtrdel]',P).forEach(function(b){b.onclick=function(){
        var r=+b.getAttribute('data-rtrdel');
        // Die Zeile verschwindet samt ihren Bindungen; die nachfolgenden Regelnummern ruecken
        // auf, denn die Nummer IST die Prioritaet - eine Luecke waere eine stille Umwertung.
        (w.rows||[]).splice(r,1);
        w.items=(w.items||[]).filter(function(it){return !(it&&it.r===r);});
        (w.items||[]).forEach(function(it){if(it&&it.r>r)it.r--;});
        render();renderProps();commit();};});
      if($('#pRtRowAdd'))$('#pRtRowAdd').onclick=function(){
        w.rows=w.rows||[];w.rows.push({label:'Regel '+w.rows.length});render();renderProps();commit();};

      // D.6 Darstellung
      sel('pRtHead',function(v){w.rtHead=(v==='full')?undefined:v;});
      sel('pRtColHead',function(v){w.rtColHead=(v==='textunit')?undefined:v;});
      sel('pRtGrid',function(v){w.rtGrid=(v==='soft')?undefined:v;});
      sel('pRtDens',function(v){w.rtDens=(v==='normal')?undefined:v;});
      chk('pRtZebra',function(v){w.rtZebra=v?undefined:false;});
      chk('pRtRowNum',function(v){w.rtRowNum=v?undefined:false;});
      chk('pRtGroups',function(v){w.rtGroups=v||undefined;});
      chk('pRtSum',function(v){w.rtSum=v||undefined;});
      txt('pRtSumPat',function(v){w.rtSumPat=undef(v);});
      sel('pRtActKey',function(v){w.rtActKey=undef(v);});

      // D.7 Schreiben
      sel('pRtWrite',function(v){w.rtWrite=(v==='on')?undefined:'off';});
      sel('pRtGate',function(v){w.rtGate=(v==='sheet')?undefined:v;});
      txt('pRtLockSec',function(v){w.rtLockSec=unum(v);});
      chk('pRtArmInv',function(v){w.rtArmInv=v||undefined;});

      // D.8 Warnungen
      $$('[data-rtw]',P).forEach(function(e){e.oninput=e.onchange=function(){
        var p=e.getAttribute('data-rtw').split('.'),x=(w.rtWarn||[])[+p[0]];if(!x)return;
        x[p[1]]=undef(e.value);render();commit();};});
      $$('[data-rtwc]',P).forEach(function(e){e.oninput=e.onchange=function(){
        var p=e.getAttribute('data-rtwc').split('.'),x=(w.rtWarn||[])[+p[0]];if(!x||!x.when||!x.when[+p[1]])return;
        x.when[+p[1]][p[2]]=undef(e.value);render();commit();};});
      $$('[data-rtwcdel]',P).forEach(function(b){b.onclick=function(){
        var p=b.getAttribute('data-rtwcdel').split('.'),x=(w.rtWarn||[])[+p[0]];if(!x)return;
        x.when.splice(+p[1],1);render();renderProps();commit();};});
      $$('[data-rtwcadd]',P).forEach(function(b){b.onclick=function(){
        var x=(w.rtWarn||[])[+b.getAttribute('data-rtwcadd')];if(!x)return;
        x.when=x.when||[];x.when.push({col:'',op:'eq',val:''});render();renderProps();commit();};});
      $$('[data-rtwdel]',P).forEach(function(b){b.onclick=function(){
        (w.rtWarn||[]).splice(+b.getAttribute('data-rtwdel'),1);render();renderProps();commit();};});
      if($('#pRtWarnAdd'))$('#pRtWarnAdd').onclick=function(){
        w.rtWarn=w.rtWarn||[];w.rtWarn.push({when:[{col:'',op:'eq',val:''}],lvl:'warn',text:''});render();renderProps();commit();};

      // rowLabels ist ab v2 tot. Es wird beim ersten Panel-Kontakt entfernt, damit die
      // Altseiten nicht dauerhaft zwei Wahrheiten ueber die Zeilenbeschriftung tragen.
      if(w.rowLabels&&(w.rows||[]).length){w.rowLabels=undefined;}
      _rtLoad(w);
    }
  });
