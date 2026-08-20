  // ===== Widget: table — Datentabelle (Privycs console-kit Look) aus Text-Variable (JSON o. serialized), [Zeile][Spalte], Zeile 0 = Kopf =====
  function _tblChev(state){ // 'asc' | 'desc' | 'idle'
    // Groesse in em statt fest 12px: die Pfeile folgen damit der Schriftgroesse der Kopfzeile
    // (die wiederum aus styles.css kommt). viewBox und Klassen bleiben unveraendert.
    if(state==='asc')return '<span class="tbl-chev on"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></span>';
    if(state==='desc')return '<span class="tbl-chev on"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>';
    return '<span class="tbl-chev idle"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/></svg></span>';
  }
  function _tblIsNum(s){return /\d/.test(s)&&/^[+-]?[\d.,:\/\s%°$€mkKMGhWkwhAV-]*$/.test(String(s));}
  function _tblCmp(a,b){var na=parseFloat(String(a).replace(',','.')),nb=parseFloat(String(b).replace(',','.'));
    if(!isNaN(na)&&!isNaN(nb)&&/^[+-]?[\d.,\s]+$/.test(String(a))&&/^[+-]?[\d.,\s]+$/.test(String(b)))return na-nb;
    return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});}
  // Kollisions-sichere Elementsuche (Seite vs. Popup/Hover). Widget-IDs sind nur JE SEITE
  // eindeutig - dieselbe automatisch vergebene ID (w141 …) kommt auf mehreren Seiten vor,
  // auch als KIND in einem Container. Wer stur "canvas zuerst" nimmt, erwischt dann die
  // fremde Kachel, findet dort kein [data-role=tblroot] und zeichnet gar nichts: die
  // Tabelle im Popup blieb leer, waehrend dieselbe Seite einzeln aufgerufen lief.
  // Deshalb: ALLE Kandidaten sammeln, aktiven Kontext (Popup/Hover) zuerst, und das
  // Element nehmen, das wirklich einen Tabellen-Rumpf enthaelt.
  function _tblEl(w){
    var cands=[],sel='.w[data-id="'+w.id+'"]';
    var oc=document.getElementById('ovcanvas'),hc=document.getElementById('hovcanvas');
    if(oc)cands=cands.concat([].slice.call(oc.querySelectorAll(sel)));
    if(hc)cands=cands.concat([].slice.call(hc.querySelectorAll(sel)));
    if(typeof canvas!=='undefined'&&canvas)cands=cands.concat([].slice.call(canvas.querySelectorAll(sel)));
    for(var i=0;i<cands.length;i++){if(cands[i].querySelector('[data-role=tblroot]'))return cands[i];}
    return cands[0]||null;
  }
  // Optionaler Status-Stil: Text -> Schweregrad; % aus Text lesen (fuer Ladebalken)
  function _tblSevOf(t){t=String(t==null?'':t).toLowerCase();
    if(/leer|schwach|kritisch|critical|empty|entladen/.test(t))return 'crit';
    if(/bald|mittel|\bwarn|niedrig|\blow\b/.test(t))return 'warn';
    if(/\bok\b|voll|gut|normal|hoch|full|geladen/.test(t))return 'ok';
    return '';}
  function _tblPctOf(t){var m=String(t==null?'':t).match(/(\d+(?:[.,]\d+)?)\s*%/);return m?parseFloat(m[1].replace(',','.')):NaN;}
  function _tblLoad(w){ // aus Live-Wert (JSON schnell) oder per Endpunkt (serialized/robust)
    if(!w.varId){w._tblRows=[];_tblDraw(w);return;}
    var lv=_lastVals[w.varId];
    if(lv&&typeof lv.v==='string'){var s=lv.v.trim();if(s&&(s[0]==='['||s[0]==='{')){try{var j=JSON.parse(s);if(j&&j.length!=null){w._tblRows=_tblNorm(j);_tblRefresh(w);return;}}catch(e){}}}
    _tblFetch(w);
  }
  function _tblFetch(w){if(!w.varId)return;fetch('?api=tabledata&id='+w.varId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){w._tblRows=(j&&j.rows)||[];_tblRefresh(w);}).catch(function(){});}
  function _tblNorm(a){return a.map(function(row){return (row&&row.length!=null&&typeof row!=='string')?row.map(function(c){return c==null?'':(c===true?'1':(c===false?'0':String(c)));}):[row==null?'':String(row)];});}

  // ===== Suche und Filter-Pillen =============================================================
  // Grundsatz: FILTERN -> SORTIEREN -> BLAETTERN. Andersherum blaettert man durch Seiten, die
  // nach dem Filtern leer sind, und die Zahl im Kopf meinte etwas anderes als die Liste zeigt.

  // Zellwert als reiner Suchtext. In Roh-HTML-Spalten muessen die Tags raus, sonst trifft eine
  // Suche nach "png" oder "font" jede Zeile - genau der Fehler, den die alte HTML-Tabelle hatte.
  // Die Beschriftungen aus alt= und title= werden vorher gerettet: eine Sender-Spalte, die nur
  // aus Picons besteht, haette sonst UEBERHAUPT keinen Suchtext mehr. Gesucht wird damit nach
  // dem, was der Betrachter liest, nicht nach dem Dateinamen dahinter.
  function _tblTxt(w,ci,v){
    var s=String(v==null?'':v);
    if(w.colRaw&&w.colRaw[ci]){
      var add='';
      s.replace(/\s(?:alt|title)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,function(m,a,b){add+=' '+(a!=null?a:b);return m;});
      // Mehrfach-Leerzeichen zusammenziehen: sonst scheitert ein Vergleich "ist gleich"
      // an den Luecken, die die entfernten Tags hinterlassen.
      s=(s.replace(/<[^>]*>/g,' ')+add).replace(/\s+/g,' ').trim();
    }
    return s;}
  // Durchsuchte Spalten: ist keine einzige angehakt, gelten ALLE (sonst faende eine frisch
  // eingeschaltete Suche gar nichts und wirkte kaputt).
  function _tblQCols(w,cols){var any=false,i,a=[];
    if(w.colQ)for(i=0;i<cols;i++){if(w.colQ[i]){any=true;break;}}
    for(i=0;i<cols;i++){if(!any||(w.colQ&&w.colQ[i]))a.push(i);}
    return a;}
  // Wirksamer Suchtext: erst ab der Mindestlaenge wird gefiltert. Ein einzelner Buchstabe
  // traefe bei 3000 Zeilen fast alles und kostet trotzdem einen vollen Durchlauf.
  function _tblQVal(w){
    if(w._tblQ==null&&w.tblQKeep&&typeof RUN!=='undefined'&&RUN){try{w._tblQ=localStorage.getItem('lvtblq_'+w.id)||'';}catch(e){w._tblQ='';}}
    var q=String(w._tblQ==null?'':w._tblQ).trim(),mn=(w.tblQMin>0?w.tblQMin:2);
    return q.length>=mn?q:'';}
  // Treffer hervorheben: auf dem ROHTEXT trennen und die Teile einzeln escapen. Wer erst
  // escaped und dann sucht, verschiebt sich an jedem &amp; um vier Zeichen.
  function _tblMark(v,q){
    var s=String(v==null?'':v),ls=s.toLowerCase(),lq=q.toLowerCase(),out='',i=0,p;
    while(lq&&(p=ls.indexOf(lq,i))>=0){out+=esc(s.slice(i,p))+'<mark class="tbl-hi">'+esc(s.slice(p,p+lq.length))+'</mark>';i=p+lq.length;}
    return out+esc(s.slice(i));}
  // "heute": versteht Unix-Zeitstempel (Sekunden oder Millisekunden) und deutsche Datumsangaben
  // (TT.MM. / TT.MM.JJJJ). Ohne das muesste die Quelle eine Spalte "heute ja/nein" mitliefern,
  // die schon am naechsten Tag falsch waere.
  function _tblIsToday(s){
    var now=new Date(),d=null,n=parseFloat(s),m;
    if(/^\d{9,}$/.test(s))d=new Date(n>1e11?n:n*1000);
    else{m=String(s).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);if(m)d=new Date(m[3]?+m[3]:now.getFullYear(),+m[2]-1,+m[1]);}
    if(!d||isNaN(d.getTime()))return false;
    return d.getDate()===now.getDate()&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}
  // Pillenliste: erst die von Hand angelegten, dann die automatischen aus einer Spalte.
  // Jede Pille bekommt einen stabilen Schluessel (k) - darueber laeuft Klick und Speicherung.
  function _tblPillList(w,head,rows){
    var out=[],cols=head.length||(rows[0]?rows[0].length:0),i;
    (w.tblPills||[]).forEach(function(p,idx){
      var ci=parseInt(p.col);if(isNaN(ci)||ci<0||ci>=cols)return;
      // Schluessel aus dem INHALT, nicht aus der Position. Ein Schluessel "m0, m1, m2" wandert
      // beim Loeschen einer Pille auf die naechste: der gemerkte Stand "Mehrfach aktiv" liegt
      // danach auf "Unklar", ohne dass im Speicher etwas falsch waere. Inhaltsgleiche Pillen
      // teilen sich denselben Schluessel - das ist richtig, sie meinen dieselbe Einschraenkung.
      var kk='m:'+ci+':'+String(p.op||'has')+':'+String(p.val==null?'':p.val);
      out.push({k:kk,lab:String(p.label||p.val||head[ci]||('Filter '+(idx+1))),ci:ci,
        op:String(p.op||'has'),val:String(p.val==null?'':p.val),
        // Pillen ohne Gruppe bilden je eine EIGENE Gruppe: zwei unabhaengige Schalter sollen
        // sich nicht gegenseitig aufheben, sondern beide gleichzeitig einschraenken.
        grp:(p.grp?('g:'+p.grp):kk),color:String(p.color||''),def:!!p.def});
    });
    var ac=(w.tblPillAuto==null?'':String(w.tblPillAuto));
    if(ac!==''&&!isNaN(parseInt(ac))){
      var aci=parseInt(ac);
      if(aci>=0&&aci<cols){
        // Verschiedene Werte zaehlen. Gekuerzt wird nach HAEUFIGKEIT (die seltene Serie findet
        // man ueber die Suche), angezeigt in der Reihenfolge des ersten Auftretens - so stehen
        // Tagesreiter in Datumsfolge und nicht alphabetisch nach "Do/Fr/Sa".
        var cnt={},ord=[],v;
        for(i=0;i<rows.length;i++){v=_tblTxt(w,aci,rows[i][aci]).trim();if(!v)continue;if(cnt[v]==null){cnt[v]=0;ord.push(v);}cnt[v]++;}
        var mx=(w.tblPillAutoMax>0?w.tblPillAutoMax:12);
        var keep={};ord.slice().sort(function(a,b){return cnt[b]-cnt[a]||_tblCmp(a,b);}).slice(0,mx).forEach(function(x){keep[x]=1;});
        ord.forEach(function(x){if(keep[x])out.push({k:'a:'+x,lab:x,ci:aci,op:'is',val:x,grp:'auto',color:'',def:false});});
      }
    }
    return out;}
  // Zustand je Pille. Vorrang hat der Klick der laufenden Sitzung, danach der je Geraet
  // gespeicherte Stand - aber NUR im Betrieb (RUN). Im Builder gilt immer die eingestellte
  // Vorgabe, sonst haengt die Kachel dort auf einem alten Klick und man sucht den Fehler
  // in der Konfiguration (dasselbe Muster wie bei der Meldungsliste).
  function _tblPillState(w,pills){
    var st={},saved=w._tblPillSt||null;
    if(!saved&&typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvtbl_'+w.id);if(o)saved=JSON.parse(o);}catch(e){}}
    pills.forEach(function(p){st[p.k]=(saved&&saved[p.k]!=null)?!!saved[p.k]:p.def;});
    return st;}
  function _tblPillSave(w,st){if(typeof RUN==='undefined'||!RUN)return;try{localStorage.setItem('lvtbl_'+w.id,JSON.stringify(st));}catch(e){}}
  function _tblPillHit(w,p,row){
    var s=_tblTxt(w,p.ci,row[p.ci]).trim(),v=p.val,n,r;
    if(p.op==='is')return s.toLowerCase()===v.toLowerCase();
    if(p.op==='not')return s.toLowerCase()!==v.toLowerCase();
    if(p.op==='re'){try{r=new RegExp(v,'i');}catch(e){return false;}return r.test(s);}
    if(p.op==='num'){n=parseFloat(s.replace(',','.'));return !isNaN(n)&&n>=parseFloat(String(v).replace(',','.'));}
    if(p.op==='empty')return s==='';
    if(p.op==='today')return _tblIsToday(s);
    return v===''?true:s.toLowerCase().indexOf(v.toLowerCase())>=0;}
  // Innerhalb einer Gruppe ODER, ueber Gruppen hinweg UND. Ist in einer Gruppe keine Pille
  // aktiv, gilt die Gruppe als AUS statt als "nichts erlaubt" - sonst waere die Liste leer,
  // sobald jemand die letzte Pille abwaehlt, und das sieht wie ein Fehler aus.
  // skipGrp laesst EINE Gruppe aus: so entstehen die Zaehler, die zeigen, was ein Klick
  // auf eine noch nicht gewaehlte Pille dieser Gruppe braechte.
  function _tblPillFilter(w,rows,pills,st,skipGrp){
    var grp={},keys=[],any=false;
    pills.forEach(function(p){if(!st[p.k]||p.grp===skipGrp)return;if(!grp[p.grp]){grp[p.grp]=[];keys.push(p.grp);}grp[p.grp].push(p);any=true;});
    if(!any)return rows;
    return rows.filter(function(r){
      for(var i=0;i<keys.length;i++){var g=grp[keys[i]],ok=false;
        for(var j=0;j<g.length;j++){if(_tblPillHit(w,g[j],r)){ok=true;break;}}
        if(!ok)return false;}
      return true;});}
  function _tblQFilter(w,rows,head,q){
    if(!q)return rows;
    var cols=head.length||(rows[0]?rows[0].length:0),qc=_tblQCols(w,cols),lq=q.toLowerCase();
    return rows.filter(function(r){
      for(var i=0;i<qc.length;i++){if(_tblTxt(w,qc[i],r[qc[i]]).toLowerCase().indexOf(lq)>=0)return true;}
      return false;});}

  // Vollaufbau (Panel + Kopf + Werkzeugleiste + Rumpf) bzw. nur Rumpf. Getrennt, weil Zeile
  // "root.innerHTML=…" das Suchfeld mit ersetzt: Fokus und Cursor waeren bei jedem Tastendruck
  // weg. Tippen und Pillenklick zeichnen deshalb ausschliesslich den Rumpf neu.
  function _tblDraw(w){_tblPaint(w,true);}
  function _tblBody(w){_tblPaint(w,false);}
  // Nach neuen Daten: steht der Cursor im Suchfeld, nur den Rumpf erneuern.
  function _tblRefresh(w){
    var el=_tblEl(w),ae=document.activeElement;
    if(el&&ae&&ae.getAttribute&&ae.getAttribute('data-role')==='tblq'&&el.contains(ae)){_tblBody(w);return;}
    _tblDraw(w);}
  function _tblPaint(w,full){
    var el=_tblEl(w);if(!el)return;var root=$('[data-role=tblroot]',el);if(!root)return;
    var rows=w._tblRows||[],head=rows.length?rows[0]:[],all=rows.slice(1);
    var cols=head.length||(all[0]?all[0].length:0);
    // Versteckte Spalten. Sie bleiben in den DATEN (Suche, Pillen und die Sortier-
    // Stellvertreter arbeiten darauf), werden aber nicht gezeichnet - Hilfsspalten wie
    // _ts oder _Serie gehoeren ins JSON, nicht auf den Schirm.
    var _hid={};(w.colHide||[]).forEach(function(v,ci){if(v)_hid[ci]=1;});
    var sicht=[];for(var _c=0;_c<cols;_c++)if(!_hid[_c])sicht.push(_c);
    var view=w._tblView||w.tblView||'table';
    // ---- Filtern (vor Sortieren, vor Blaettern) ----
    var q=_tblQVal(w);
    var pills=_tblPillList(w,head,all);
    var pst=_tblPillState(w,pills);
    var qRows=_tblQFilter(w,all,head,q);
    var body=_tblPillFilter(w,qRows,pills,pst,null);
    var pillOn=false;pills.forEach(function(p){if(pst[p.k])pillOn=true;});
    var filtered=(!!q||pillOn);
    // Zaehler je Pille gegen die uebrigen Gruppen rechnen (nicht gegen das Endergebnis) -
    // sonst stuende auf jeder nicht gewaehlten Pille derselben Gruppe eine 0.
    var cnt={};
    if(pills.length&&w.tblPillCount!==0){
      var byGrp={},gk=[];
      pills.forEach(function(p){if(!byGrp[p.grp]){byGrp[p.grp]=[];gk.push(p.grp);}byGrp[p.grp].push(p);});
      gk.forEach(function(g){var base=_tblPillFilter(w,qRows,pills,pst,g);
        byGrp[g].forEach(function(p){var n=0;for(var i=0;i<base.length;i++)if(_tblPillHit(w,p,base[i]))n++;cnt[p.k]=n;});});
    }
    // ---- Sortierung ----
    if(w._tblSortCol!=null&&w._tblSortCol<cols){
      // Sortier-Stellvertreter: "4,6 GB" und "20.08." sortieren als Text falsch. colSortBy
      // schickt den Vergleich auf eine versteckte Spalte mit dem Rohwert (Bytes, Zeitstempel).
      var c=(w.colSortBy&&w.colSortBy[w._tblSortCol]!=null&&w.colSortBy[w._tblSortCol]!=='')
              ?(parseInt(w.colSortBy[w._tblSortCol])||0):w._tblSortCol,
          dir=(w._tblSortDir==='desc')?-1:1;
      body=body.slice().sort(function(ra,rb){return _tblCmp(ra[c]!=null?ra[c]:'',rb[c]!=null?rb[c]:'')*dir;});}
    var total=body.length,ps=(w.pageSize>0?w.pageSize:0),paged=body,from=1,to=total,page=0,pages=1;
    if(ps>0&&total>ps){pages=Math.ceil(total/ps);page=Math.max(0,Math.min(w._tblPage||0,pages-1));w._tblPage=page;from=page*ps+1;to=Math.min((page+1)*ps,total);paged=body.slice(page*ps,page*ps+ps);}
    // numerische Spalten (mono) — bewusst aus ALLEN Zeilen, nicht aus der Treffermenge:
    // sonst wechselt eine Spalte bei jedem Tastendruck zwischen Mono und Fliesstext.
    var numc=[];for(var ci=0;ci<cols;ci++){var alln=all.length>0;for(var ri=0;ri<all.length;ri++){if(!_tblIsNum(all[ri][ci]!=null?all[ri][ci]:'')){alln=false;break;}}numc[ci]=alln;}
    // Pro-Spalte: Ausrichtung (w.colAlign[ci]: 'left'|'center'|'right') + optional Roh-HTML (w.colRaw[ci])
    var anyW=!!(w.colW&&w.colW.some(function(x){return x;}));
    // Inhaltslaenge je Spalte (HTML-Tags rausgerechnet). EINE flexible Spalte darf umbrechen: die laengste,
    // die keine feste Breite hat (sonst faellt die Wahl auf die laengste ueberhaupt). Der Rest bleibt einzeilig
    // -> so wenige Umbrueche wie moeglich, Tabelle passt in die Widget-Breite (kein Scrollen).
    // Auch das aus ALLEN Zeilen: sonst springen die Spaltenbreiten beim Filtern.
    var clen=[];for(var wc=0;wc<cols;wc++){var mx=String(head[wc]||'').length;for(var wr=0;wr<all.length;wr++){var s=String(all[wr][wc]!=null?all[wr][wc]:'');if(w.colRaw&&w.colRaw[wc])s=s.replace(/<[^>]*>/g,'');if(s.length>mx)mx=s.length;}clen[wc]=mx;}
    var flex=-1,fb=-1;for(var wc=0;wc<cols;wc++){if(w.colW&&w.colW[wc])continue;if(clen[wc]>fb){fb=clen[wc];flex=wc;}}
    if(flex<0){for(var wc=0;wc<cols;wc++){if(clen[wc]>fb){fb=clen[wc];flex=wc;}}}
    var alSt=function(ci){var a=w.colAlign&&w.colAlign[ci];return (a==='center'||a==='left'||a==='right')?(' style="text-align:'+a+'"'):'';};
    var tdSt=function(ci){var st='';var a=w.colAlign&&w.colAlign[ci];if(a==='center'||a==='left'||a==='right')st+='text-align:'+a+';';st+=(ci===flex)?'white-space:normal;overflow-wrap:anywhere;':'white-space:nowrap;';return ' style="'+st+'"';};
    // Hervorhebung nur in Nicht-HTML-Spalten: in einer Roh-HTML-Zelle landete das <mark>
    // sonst mitten in einem Attribut (z. B. im src eines Picons) und zerlegt das Markup.
    var qhi=(q&&w.tblQHi!==0)?q:'';
    var qcSet={};_tblQCols(w,cols).forEach(function(i){qcSet[i]=1;});
    var cellHtml=function(ci,v){
      if(w.colRaw&&w.colRaw[ci])return String(v==null?'':v);
      return (qhi&&qcSet[ci])?_tblMark(v,qhi):esc(v);};
    // Status-Stil: Status-Spalte (Chip+Streifen) und %-Spalte (Ladebalken) erkennen
    var sevIdx=-1,barIdx=-1;
    if(w.sevStyle){for(var hi=0;hi<cols;hi++){var hs=String(head[hi]||'').toLowerCase();
      if(sevIdx<0&&/status|zustand/.test(hs))sevIdx=hi;
      if(barIdx<0&&/wert|ladung|prozent|ladest|%/.test(hs))barIdx=hi;}}
    // Kopf: Titel + Zähler + rechts Seg-Toggle + Pager. Der Zaehler nennt bei aktivem Filter
    // BEIDE Zahlen - "12 Einträge" waere sonst eine andere Aussage als die Datenlage.
    var totAll=all.length;
    var subHtml=filtered?(total+' von '+totAll+' '+(totAll===1?'Eintrag':'Einträgen')):(total+' '+(total===1?'Eintrag':'Einträge'));
    var pager=(ps>0&&total>ps)?('<div class="tbl-pager"><button class="tbl-pg" data-tbl-page="prev"'+(page<=0?' disabled':'')+'>&#8249;</button><span class="tbl-pgtxt">'+from+'&ndash;'+to+' von '+total+'</span><button class="tbl-pg" data-tbl-page="next"'+(page>=pages-1?' disabled':'')+'>&#8250;</button></div>'):'';
    var seg=w.hideToggle?'':('<div class="seg"><button class="seg-b'+(view==='table'?' on':'')+'" data-tbl-view="table">Tabelle</button><button class="seg-b'+(view==='cards'?' on':'')+'" data-tbl-view="cards">Karten</button></div>');
    var ph='<div class="ph"><div><h3>'+escL(w.label||'Tabelle')+'</h3><div class="ph-sub">'+subHtml+'</div></div><div class="ph-right">'+seg+pager+'</div></div>';
    // ---- Werkzeugleiste: Suchfeld + Pillen ----
    var pillsHtml='';
    if(pills.length){
      if(w.tblPillAll!==0)pillsHtml+='<span class="tbl-pill tbl-pill-all'+(pillOn?' off':'')+'" data-tbl-pill="_all" title="alle Filter aus">Alle</span>';
      pillsHtml+=pills.map(function(p){
        // Skin-Token werden als var(--token) durchgereicht, damit die Pille beim Skinwechsel
        // mitgeht. Ein von Hand eingetragener Farbwert (Altbestand, "Eigene") wuerde als
        // var(--#ff0000) ungueltig und die Pille faerbte gar nicht - der kommt roh rein.
        var cvar=p.color?(/^[a-z][a-z0-9-]*$/i.test(p.color)?('var(--'+p.color+')'):esc(p.color)):'var(--accent)';
        return '<span class="tbl-pill'+(pst[p.k]?'':' off')+'" data-tbl-pill="'+esc(p.k)+'" style="--pc:'+cvar+'">'+esc(p.lab)
          +((w.tblPillCount!==0)?('<b>'+(cnt[p.k]||0)+'</b>'):'')+'</span>';}).join('');
    }
    var toolsHtml='';
    if(w.tblQ||pills.length){
      var qh=w.tblQ?('<div class="tbl-qbox"><input class="tbl-q" data-role="tblq" type="text" autocomplete="off" spellcheck="false" placeholder="'+esc(w.tblQPh||'Suchen …')+'" value="'+esc(w._tblQ==null?'':w._tblQ)+'">'
        +'<button class="tbl-qx" data-tbl-qclear="1" title="Suche und Filter zurücksetzen">&times;</button></div>'):'';
      toolsHtml='<div class="tbl-tools">'+qh+'<div class="tbl-pills" data-role="tblpills">'+pillsHtml+'</div></div>';
    }
    // Leerzustand unterscheidet Datenlage und Filterlage: "Keine Zeilen" waere gelogen,
    // wenn 3000 Zeilen da sind und nur die Suche nichts findet.
    var emptyHtml=filtered
      ?('<div class="tbl-empty">Keine Treffer<button class="tbl-qclr" data-tbl-qclear="1">Filter zurücksetzen</button></div>')
      :'<div class="tbl-empty">Keine Zeilen</div>';
    var bodyHtml;
    if(!rows.length||!cols){bodyHtml='<div class="tbl-empty">'+(w.varId?'Keine Daten (Zeile 0 = Spaltenkopf, JSON o. serialisiertes Array)':'Variable wählen')+'</div>';}
    else if(view==='cards'){
      // Karten arbeiten mit derselben gefilterten und geblaetterten Menge wie die Tabelle.
      bodyHtml=total?('<div class="tbl-cards">'+paged.map(function(r){return '<div class="tbl-card">'+sicht.map(function(ci){var h=head[ci];return '<div class="tc-row"><span class="tc-k">'+esc(h)+'</span><span class="tc-v'+(numc[ci]?' tbl-mono':'')+'"'+alSt(ci)+'>'+cellHtml(ci,r[ci]!=null?r[ci]:'')+'</span></div>';}).join('')+'</div>';}).join('')+'</div>'):emptyHtml;
    }else{
      var thead='<thead><tr>'+sicht.map(function(ci){var h=head[ci];var st=(w._tblSortCol===ci)?(w._tblSortDir==='desc'?'desc':'asc'):'idle';var rc=(w.sevStyle&&(ci===sevIdx||ci===barIdx))?' class="r"':'';return '<th'+rc+tdSt(ci)+'><button class="tbl-sort" data-tbl-sort="'+ci+'">'+esc(h)+_tblChev(st)+'</button></th>';}).join('')+'</tr></thead>';
      var tbody='<tbody>'+(total?paged.map(function(r){
        var sev=(sevIdx>=0)?_tblSevOf(r[sevIdx]):'';
        return '<tr'+(sev?' class="tsev-'+sev+'"':'')+'>'+sicht.map(function(ci){
          var v=r[ci]!=null?r[ci]:'';
          if(w.sevStyle&&ci===sevIdx&&sev)return '<td class="r"><span class="tbl-chip tsc-'+sev+'">'+esc(v)+'</span></td>';
          if(w.sevStyle&&ci===barIdx){var p=_tblPctOf(v);
            var bar=!isNaN(p)?('<span class="tbl-mini"><span style="width:'+Math.max(2,Math.min(100,p))+'%;background:var(--'+(sev||'accent')+')"></span></span>'):'';
            return '<td class="'+(numc[ci]?'tbl-mono ':'')+'tbl-barcell r"><span'+(sev?' style="color:var(--'+sev+')"':'')+'>'+esc(v)+'</span>'+bar+'</td>';}
          return '<td'+(numc[ci]?' class="tbl-mono"':'')+tdSt(ci)+'>'+cellHtml(ci,v)+'</td>';
        }).join('')+'</tr>';}).join(''):'<tr><td colspan="'+cols+'">'+emptyHtml+'</td></tr>')+'</tbody>';
      // Pro-Spalte Breite (w.colW[ci]: Zahl=px oder String wie "20%"/"120px") via colgroup, AUTO-Layout:
      // nicht gesetzte Spalten bleiben inhaltsbasiert konstant; eine Aenderung zieht Platz nur aus der
      // flexiblen (breitesten) Spalte statt aus allen (kein table-layout:fixed).
      // Die flexible Spalte bekommt width:100%. Im AUTO-Layout heisst das nicht "so breit wie
      // die Tabelle", sondern "nimm den gesamten Rest": alle uebrigen Spalten schrumpfen auf
      // ihre Inhaltsbreite, der Ueberschuss landet vollstaendig hier. Ohne das verteilt der
      // Browser den freien Platz anteilig auf ALLE Spalten - dann steht neben "23:53" viel
      // Leerraum, waehrend der lange Sendungstitel unnoetig umbricht.
      var colgroup='<colgroup>'+sicht.map(function(ci){var h=head[ci];
        var cw=w.colW&&w.colW[ci];
        var wv=cw?(/^\d+$/.test(String(cw))?cw+'px':String(cw)):(ci===flex?'100%':'');
        return '<col'+(wv?' style="width:'+wv+'"':'')+'>';}).join('')+'</colgroup>';
      bodyHtml='<div class="tbl-scroll"><table class="tbl">'+colgroup+thead+tbody+'</table></div>';
    }
    // Teilweises Nachzeichnen: Kopfzahl, Pager, Pillen und Rumpf ersetzen — das Suchfeld
    // bleibt unangetastet und behaelt Fokus, Cursor und Text.
    var panel=root.querySelector('.panel');
    if(!full&&panel){
      var old=panel.querySelector(':scope>.tbl-scroll,:scope>.tbl-cards,:scope>.tbl-empty');
      if(old){
        var sub=panel.querySelector('.ph-sub');if(sub)sub.innerHTML=subHtml;
        var pr=panel.querySelector('.ph-right');if(pr)pr.innerHTML=seg+pager;
        var pw=panel.querySelector('[data-role=tblpills]');if(pw)pw.innerHTML=pillsHtml;
        var tmp=document.createElement('div');tmp.innerHTML=bodyHtml;
        if(tmp.firstChild)old.parentNode.replaceChild(tmp.firstChild,old);
        return;
      }
    }
    // Zellabstand nach Spaltenzahl. Der grosszuegige Standard (bis 22 px je Seite) ist bei
    // vier Spalten richtig und bei neun eine Platzverschwendung: 9 x 2 x 22 px sind ueber
    // 390 px, die dem Textinhalt fehlen. Deshalb ab 6 Spalten enger, ab 8 noch enger.
    var padx=(cols>=8)?'clamp(5px,1.6cqmin,10px)':((cols>=6)?'clamp(7px,2.4cqmin,14px)':'');
    // Kompakte Zeilen: der grosszuegige Standard (bis 16 px oben und unten) ergibt rund
    // 50 px Zeilenhoehe - bei einer Kennzahlen-Tabelle mit zwoelf Zeilen passt damit die
    // Haelfte nicht mehr in die Kachel. Dicht gesetzt sind es rund 26 px.
    var pady=w.tblDense?'clamp(3px,1.1cqmin,7px)':'';
    var st=(padx?'--tblpadx:'+padx+';':'')+(pady?'--tblpady:'+pady+';':'');
    root.innerHTML='<div class="panel"'+(st?(' style="'+st+'"'):'')+'>'+ph+toolsHtml+bodyHtml+'</div>';
    _tblWireQ(w,root);
  }
  var _tblT={},_tblQT={};
  // Das Suchfeld wird direkt verdrahtet: der zentrale Verteiler hoert nur auf "change",
  // ein Suchfeld muss aber bei jedem Zeichen filtern. Die Sperre inp._tblQw verhindert
  // doppelte Verdrahtung nach einem Teil-Neuzeichnen.
  function _tblWireQ(w,root){
    var inp=root.querySelector('[data-role=tblq]');if(!inp||inp._tblQw)return;inp._tblQw=1;
    inp.addEventListener('input',function(){
      w._tblQ=inp.value;
      if(w.tblQKeep&&typeof RUN!=='undefined'&&RUN){try{localStorage.setItem('lvtblq_'+w.id,w._tblQ);}catch(e){}}
      // Entprellt: bei 3000 Zeilen kostet jeder Tastendruck einen vollen Durchlauf.
      if(_tblQT[w.id])clearTimeout(_tblQT[w.id]);
      _tblQT[w.id]=setTimeout(function(){w._tblPage=0;_tblBody(w);},160);
    });
    inp.addEventListener('keydown',function(e){
      // Escape leert die Suche. stopPropagation, weil dasselbe Escape sonst das Popup
      // schliesst, in dem die Tabelle steht.
      if((e.key||'')==='Escape'){e.stopPropagation();inp.value='';w._tblQ='';w._tblPage=0;_tblBody(w);}
    });
  }
  defWidget('table',{
    label:'Tabelle', cat:'Anzeige', paletteIcon:'wtable', size:[420,260],
    defaults:function(w){w.label='Tabelle';w.pageSize=10;w.tblView='table';},
    render:function(w){return '<div data-role="tblroot" style="position:absolute;inset:0"></div>';},
    mount:function(w){_tblLoad(w);},
    props:function(w){var s=row('Zeilen/Seite','<input id="pTblPS" type="number" min="0" value="'+(w.pageSize>0?w.pageSize:0)+'" title="0 = keine Paginierung">')
      +row('Start-Ansicht','<select id="pTblView"><option value="table"'+((w.tblView||'table')==='table'?' selected':'')+'>Tabelle</option><option value="cards"'+(w.tblView==='cards'?' selected':'')+'>Karten</option></select>')
      +row('Umschalter ausblenden','<input type="checkbox" id="pTblNoSw"'+(w.hideToggle?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">feste Start-Ansicht</span>')
      +row('Status-Stil','<input type="checkbox" id="pTblSev"'+(w.sevStyle?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Severity-Streifen + Status-Chip + Ladebalken (erkennt „Status"- und „%"-Spalte)</span>')
      +row('Kompakte Zeilen','<input type="checkbox" id="pTblDense"'+(w.tblDense?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">enge Zeilen — mehr Zeilen ohne Scrollen</span>');
      var head=(w._tblRows&&w._tblRows[0])||[];
      // ---- Suche ----
      s+='<div class="pgh">Suche</div>'
        +row('Suchfeld','<input type="checkbox" id="pTblQ"'+(w.tblQ?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Volltextfeld über der Tabelle. Filtert sofort und <b>vor</b> Sortierung und Blättern; der Zähler im Kopf zeigt dann „Treffer von Gesamt".</span>')
        +row('Platzhalter','<input id="pTblQPh" value="'+esc(w.tblQPh||'')+'" placeholder="Suchen …"> <span style="font-size:11px;color:var(--muted)">leer = „Suchen …"</span>')
        +row('Ab Zeichen','<input id="pTblQMin" type="number" min="1" max="9" style="width:64px" value="'+(w.tblQMin>0?w.tblQMin:2)+'"> <span style="font-size:11px;color:var(--muted)">kürzere Eingaben filtern noch nicht — ein einzelner Buchstabe trifft fast jede Zeile und kostet trotzdem einen vollen Durchlauf</span>')
        +row('Treffer hervorheben','<input type="checkbox" id="pTblQHi"'+(w.tblQHi!==0?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">markiert die Fundstelle. In HTML-Spalten bewusst nicht — die Markierung landete sonst mitten in einem Attribut und zerlegt das Markup.</span>')
        +row('Suchtext merken','<input type="checkbox" id="pTblQKeep"'+(w.tblQKeep?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">je Gerät (localStorage), überlebt den Seitenwechsel. Für Wandpanels meist unerwünscht.</span>');
      // ---- Filter-Pillen ----
      s+='<div class="pgh">Filter-Pillen</div>';
      if(head.length){
        var colOpt=head.map(function(h,ci){return [String(ci),(h?String(h):('Spalte '+(ci+1)))];});
        s+=listEditor(w,'tblPills','Pillen — je Zeile eine Pille',[
          {k:'label',h:'Text',ph:'Beschriftung'},
          {k:'col',h:'Spalte',type:'select',options:colOpt,def:'0'},
          {k:'op',h:'Vergleich',type:'select',def:'has',options:[['has','enthält'],['is','ist gleich'],['not','ist nicht'],['re','RegEx'],['num','Zahl ≥'],['today','heute'],['empty','leer']]},
          {k:'val',h:'Wert',ph:'Wert'},
          {k:'grp',h:'Gruppe',ph:'Gruppe'},
          {k:'color',h:'Farbe',type:'skincolor'},
          {k:'def',h:'an',type:'check'}
        ]);
        s+=row('Automatisch aus Spalte','<select id="pTblPillAuto"><option value="">— aus —</option>'
          +head.map(function(h,ci){return '<option value="'+ci+'"'+((w.tblPillAuto!=null&&String(w.tblPillAuto)===String(ci))?' selected':'')+'>'+esc(h||('Spalte '+(ci+1)))+'</option>';}).join('')
          +'</select> <span style="font-size:11px;color:var(--muted)">erzeugt je vorkommendem Wert dieser Spalte eine Pille (eine gemeinsame Gruppe)</span>');
        s+=row('Höchstzahl','<input id="pTblPillAutoMax" type="number" min="1" max="40" style="width:64px" value="'+(w.tblPillAutoMax>0?w.tblPillAutoMax:12)+'"> <span style="font-size:11px;color:var(--muted)">gekürzt wird nach Häufigkeit; bei 39 Werten wäre die Pillenreihe breiter als die Kachel. Der Rest bleibt über die Suche erreichbar.</span>');
      } else s+='<div class="hint" style="font-size:11px;margin-top:4px;color:var(--muted)">Pillen lassen sich anlegen, sobald Daten geladen sind (Variable wählen) — sie beziehen sich auf eine Spalte.</div>';
      s+=row('Auswahl','<select id="pTblPillMode"><option value="multi"'+((w.tblPillMode||'multi')==='multi'?' selected':'')+'>mehrere gleichzeitig</option><option value="one"'+(w.tblPillMode==='one'?' selected':'')+'>genau eine (Reiter-Verhalten)</option></select> <span style="font-size:11px;color:var(--muted)">„genau eine" schaltet beim Klick die übrigen Pillen <b>derselben Gruppe</b> ab</span>')
        +row('Zähler','<input type="checkbox" id="pTblPillCount"'+(w.tblPillCount!==0?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Trefferzahl in der Pille. Gerechnet gegen die anderen Gruppen, nicht gegen das Endergebnis — sonst stünde auf jeder nicht gewählten Pille eine 0.</span>')
        +row('Pille „Alle"','<input type="checkbox" id="pTblPillAll"'+(w.tblPillAll!==0?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">zusätzliche Pille, die alle Filter zurücknimmt</span>')
        +'<div class="hint" style="font-size:11px;margin-top:4px">Pillen <b>derselben Gruppe</b> sind <b>oder</b>-verknüpft (Status: Vorhanden <i>oder</i> Mehrfach), verschiedene Gruppen <b>und</b>-verknüpft (Status <i>und</i> Qualität). Eine Pille ohne Gruppennamen bildet ihre eigene Gruppe. Ist in einer Gruppe keine Pille aktiv, filtert die Gruppe nicht — abwählen führt nie zu einer leeren Liste. Der gewählte Zustand wird im Betrieb je Gerät gemerkt; im Builder gilt immer die Spalte „an".</div>';
      // Pro-Spalte: Ausrichtung + Breite + Roh-HTML + Suchspalte (Kopf aus geladenen Daten)
      if(head.length){
        s+='<div class="pgh">Spalten</div>';
        var alOpt=function(cur){return ['','left','center','right'].map(function(v){var lbl={'':'Standard',left:'Links',center:'Zentriert',right:'Rechts'}[v];return '<option value="'+v+'"'+((w.colAlign&&w.colAlign[cur.ci]||'')===v?' selected':'')+'>'+lbl+'</option>';}).join('');};
        head.forEach(function(h,ci){
          s+=row(esc(h||('Spalte '+(ci+1))),
            '<select data-tcol-al="'+ci+'">'+alOpt({ci:ci})+'</select> '
            +'<input data-tcol-w="'+ci+'" value="'+esc(w.colW&&w.colW[ci]!=null?w.colW[ci]:'')+'" placeholder="Breite" title="Breite: Zahl = px, oder z. B. 20%" style="width:64px"> '
            +'<label style="font-size:11px;color:var(--muted)"><input type="checkbox" data-tcol-html="'+ci+'"'+((w.colRaw&&w.colRaw[ci])?' checked':'')+'> HTML</label> '
            +'<label style="font-size:11px;color:var(--muted)"><input type="checkbox" data-tcol-q="'+ci+'"'+((w.colQ&&w.colQ[ci])?' checked':'')+'> Suche</label> '
            +'<label style="font-size:11px;color:var(--muted)"><input type="checkbox" data-tcol-hide="'+ci+'"'+((w.colHide&&w.colHide[ci])?' checked':'')+'> versteckt</label> '
            +'<input data-tcol-sort="'+ci+'" value="'+esc(w.colSortBy&&w.colSortBy[ci]!=null?w.colSortBy[ci]:'')+'" placeholder="sort" title="Sortieren nach Spalte Nr. (Rohwert)" style="width:46px">');
        });
        s+='<div class="hint" style="font-size:11px;margin-top:4px"><b>Breite</b>: Zahl = Pixel, oder mit Einheit (z. B. <code>20%</code>). Leer = automatisch. <b>HTML</b>: Zellinhalt wird als HTML gerendert statt escaped (z. B. <code>&lt;img&gt;</code>, <code>&lt;span style&gt;</code>). Nur bei vertrauenswuerdiger Quelle. <b>Suche</b>: begrenzt die Volltextsuche auf diese Spalten; ohne Haken wird in allen gesucht. Gezielt setzen — in einer Sender-Spalte mit Bildern fände „png" sonst jede Zeile. <b>versteckt</b>: Spalte wird nicht gezeichnet, bleibt aber in den Daten (Suche, Pillen, Sortierung). <b>sort</b>: Nummer der Spalte, nach der beim Klick auf diesen Kopf sortiert wird — fuer Rohwert-Spalten neben der formatierten Anzeige („4,6 GB" sortiert nach Bytes).</div>';
      } else s+='<div class="hint" style="font-size:11px;margin-top:6px;color:var(--muted)">Spalten-Formatierung erscheint, sobald Daten geladen sind (Variable waehlen).</div>';
      s+='<div class="hint" style="font-size:11px;margin-top:6px">Quelle: Text-Variable mit <b>JSON</b> oder <b>serialisiertem Array</b> im Format [Zeile][Spalte]. <b>Zeile 0 = Spaltenkopf</b>.</div>';
      return s;},
    wire:function(w){
      if($('#pTblPS'))$('#pTblPS').oninput=function(){w.pageSize=parseInt(this.value)||0;w._tblPage=0;_tblDraw(w);commit();};
      if($('#pTblView'))$('#pTblView').onchange=function(){w.tblView=this.value;w._tblView=this.value;_tblDraw(w);commit();};
      if($('#pTblNoSw'))$('#pTblNoSw').onchange=function(){w.hideToggle=this.checked||undefined;_tblDraw(w);commit();};
      if($('#pTblSev'))$('#pTblSev').onchange=function(){w.sevStyle=this.checked||undefined;_tblDraw(w);commit();};
      if($('#pTblDense'))$('#pTblDense').onchange=function(){w.tblDense=this.checked||undefined;_tblDraw(w);commit();};
      // Suche
      if($('#pTblQ'))$('#pTblQ').onchange=function(){w.tblQ=this.checked||undefined;_tblDraw(w);commit();};
      if($('#pTblQPh'))$('#pTblQPh').oninput=function(){w.tblQPh=this.value.trim()||undefined;_tblDraw(w);commit();};
      if($('#pTblQMin'))$('#pTblQMin').oninput=function(){w.tblQMin=parseInt(this.value)||undefined;_tblDraw(w);commit();};
      // Vorgabe „an": gespeichert wird nur das Abweichen (0), damit unveraenderte Kacheln
      // keine ueberfluessigen Felder in den Layout-Stand schreiben.
      if($('#pTblQHi'))$('#pTblQHi').onchange=function(){w.tblQHi=this.checked?undefined:0;_tblDraw(w);commit();};
      if($('#pTblQKeep'))$('#pTblQKeep').onchange=function(){w.tblQKeep=this.checked||undefined;if(!this.checked){try{localStorage.removeItem('lvtblq_'+w.id);}catch(e){}}_tblDraw(w);commit();};
      // Pillen. Nach jeder Aenderung den gemerkten Zustand verwerfen: die Schluessel koennen
      // sich verschoben haben, sonst stuende eine Pille an, die es so nicht mehr gibt.
      if($('#pTblPillAuto'))$('#pTblPillAuto').onchange=function(){w.tblPillAuto=(this.value===''?undefined:this.value);w._tblPillSt=null;w._tblPage=0;_tblDraw(w);commit();};
      if($('#pTblPillAutoMax'))$('#pTblPillAutoMax').oninput=function(){w.tblPillAutoMax=parseInt(this.value)||undefined;w._tblPillSt=null;_tblDraw(w);commit();};
      if($('#pTblPillMode'))$('#pTblPillMode').onchange=function(){w.tblPillMode=(this.value==='one')?'one':undefined;_tblDraw(w);commit();};
      if($('#pTblPillCount'))$('#pTblPillCount').onchange=function(){w.tblPillCount=this.checked?undefined:0;_tblDraw(w);commit();};
      if($('#pTblPillAll'))$('#pTblPillAll').onchange=function(){w.tblPillAll=this.checked?undefined:0;_tblDraw(w);commit();};
      [].forEach.call(document.querySelectorAll('[data-tcol-al]'),function(sel){sel.onchange=function(){var ci=+sel.getAttribute('data-tcol-al');w.colAlign=w.colAlign||[];w.colAlign[ci]=this.value||undefined;_tblDraw(w);commit();};});
      [].forEach.call(document.querySelectorAll('[data-tcol-html]'),function(cb){cb.onchange=function(){var ci=+cb.getAttribute('data-tcol-html');w.colRaw=w.colRaw||[];w.colRaw[ci]=this.checked||undefined;_tblDraw(w);commit();};});
      [].forEach.call(document.querySelectorAll('[data-tcol-q]'),function(cb){cb.onchange=function(){var ci=+cb.getAttribute('data-tcol-q');w.colQ=w.colQ||[];w.colQ[ci]=this.checked||undefined;_tblDraw(w);commit();};});
      [].forEach.call(document.querySelectorAll('[data-tcol-hide]'),function(cb){cb.onchange=function(){var ci=+cb.getAttribute('data-tcol-hide');w.colHide=w.colHide||[];w.colHide[ci]=this.checked||undefined;_tblDraw(w);commit();};});
      [].forEach.call(document.querySelectorAll('[data-tcol-sort]'),function(inp){inp.oninput=function(){var ci=+inp.getAttribute('data-tcol-sort');w.colSortBy=w.colSortBy||[];var v=this.value.trim();w.colSortBy[ci]=(v===''?undefined:v);_tblDraw(w);commit();};});
      [].forEach.call(document.querySelectorAll('[data-tcol-w]'),function(inp){inp.oninput=function(){var ci=+inp.getAttribute('data-tcol-w');w.colW=w.colW||[];var v=this.value.trim();w.colW[ci]=v||undefined;_tblDraw(w);commit();};});
    },
    click:function(w,el,e){
      // Reihenfolge ist hier entscheidend: die bedienbaren Teile der Werkzeugleiste ZUERST,
      // der pauschale Schluck fuer die Leiste ganz zuletzt. Andersherum landet jeder
      // Pillenklick im Schluck - die Pillen liegen ja selbst in .tbl-tools - und die Leiste
      // sieht bedienbar aus, filtert aber nichts.
      var qc=e.target.closest('[data-tbl-qclear]');
      if(qc){w._tblQ='';w._tblPillSt=null;
        if(typeof RUN!=='undefined'&&RUN){try{localStorage.removeItem('lvtbl_'+w.id);localStorage.removeItem('lvtblq_'+w.id);}catch(e2){}}
        w._tblPage=0;_tblDraw(w);return true;}
      var pl=e.target.closest('[data-tbl-pill]');
      if(pl){
        var k=pl.getAttribute('data-tbl-pill');
        var rws=w._tblRows||[],hd=rws.length?rws[0]:[];
        var pills=_tblPillList(w,hd,rws.slice(1)),st=_tblPillState(w,pills),i,cur=null;
        if(k==='_all'){for(i=0;i<pills.length;i++)st[pills[i].k]=false;}
        else{
          for(i=0;i<pills.length;i++)if(pills[i].k===k)cur=pills[i];
          if(!cur)return true;
          var nv=!st[k];
          // „genau eine": die uebrigen Pillen DERSELBEN Gruppe fallen mit dem Klick raus.
          // Ueber Gruppen hinweg passiert nichts - die sind und-verknuepft.
          if(nv&&w.tblPillMode==='one')for(i=0;i<pills.length;i++)if(pills[i].grp===cur.grp)st[pills[i].k]=false;
          st[k]=nv;
        }
        // sofort umfaerben, damit der Tipp quittiert wird, bevor gerechnet wird
        pl.classList.toggle('off',(k==='_all')?false:!st[k]);
        w._tblPillSt=st;_tblPillSave(w,st);w._tblPage=0;_tblBody(w);return true;}
      // Alles Uebrige in der Leiste (Suchfeld, Leerraum) bleibt bei der Leiste: ohne das
      // arbeitet der allgemeine Klickpfad danach popupTo/navTo/scriptId ab - ein Tipp ins
      // Suchfeld haette auf einer Kachel mit Sprungziel die Seite gewechselt.
      if(e.target.closest('.tbl-tools'))return true;
      var sb=e.target.closest('[data-tbl-sort]');if(sb){var i2=parseInt(sb.getAttribute('data-tbl-sort'));if(w._tblSortCol===i2){w._tblSortDir=(w._tblSortDir==='asc')?'desc':'asc';}else{w._tblSortCol=i2;w._tblSortDir='asc';}w._tblPage=0;_tblBody(w);return true;}
      var pg=e.target.closest('[data-tbl-page]');if(pg){if(pg.hasAttribute('disabled'))return true;w._tblPage=Math.max(0,(w._tblPage||0)+(pg.getAttribute('data-tbl-page')==='next'?1:-1));_tblBody(w);return true;}
      var vb=e.target.closest('[data-tbl-view]');if(vb){w._tblView=vb.getAttribute('data-tbl-view');_tblBody(w);return true;}
      return false;
    },
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){if(_tblT[w.id])clearTimeout(_tblT[w.id]);_tblT[w.id]=setTimeout(function(){_tblLoad(w);},300);}}
  });
