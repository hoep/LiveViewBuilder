  // C1: nutzt das Widget diese Variablen-ID als Daten-Bindung? (spiegelt pollVals, ohne visVar)
  function widgetDataId(w,id){
    if(w.varId===id||w.varId2===id||w.varId3===id||w.condVar===id||w.vTemp===id||w.vCond===id||w.vHum===id||w.vWind===id||w.vRain===id)return true;
    var A=['items','links','rows','src','snk','fc','elements','stages','steps'],i,j,o;
    for(i=0;i<A.length;i++){var a=w[A[i]];if(a)for(j=0;j<a.length;j++){o=a[j];if(o&&(o.vid===id||o.subvid===id||o.hi===id||o.lo===id||o.pq===id||o.cond===id||o.speedVid===id||o.socVid===id))return true;}}
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
  var _vidx=null;
  function _vidxAdd(id,w,root){if(!id)return;(_vidx[id]=_vidx[id]||[]).push({w:w,root:root});}
  function _collectIds(w,add){ // alle Variablen-IDs eines Widgets an add() geben
    add(w.varId);add(w.varId2);add(w.varId3);add(w.visVar);add(w.condVar);add(w.vTemp);add(w.vCond);add(w.vHum);add(w.vWind);add(w.vRain);
    if(w.fc)w.fc.forEach(function(r){add(r.hi);add(r.lo);add(r.pq);add(r.cond);});
    ['links','src','snk','items','rows','steps','series'].forEach(function(k){if(w[k])w[k].forEach(function(o){if(o)add(o.vid);});});
    if(w.stages)w.stages.forEach(function(o){if(o){add(o.vid);add(o.subvid);}}); // Pipeline-Stationen (Wert + Zusatzwert)
    if(w.elements)w.elements.forEach(function(o){if(o){add(o.vid);add(o.speedVid);add(o.socVid);}});
    if(w.tankVid)add(w.tankVid);
  }
  function _vidxOne(w,root){_collectIds(w,function(id){_vidxAdd(id,w,root);});}
  var _allIds=null;
  function allViewIds(){ // Vereinigung ALLER Variablen-IDs über alle Ansichten -> Poll hält den Cache für jede Seite warm
    if(_allIds)return _allIds;var set={};
    try{Object.keys(store.views||{}).forEach(function(vn){var v=store.views[vn];((v&&v.widgets)||[]).forEach(function(w){_collectIds(w,function(id){if(id)set[id]=1;});});});}catch(e){}
    // Leisten-Widgets (store.chrome) gehoeren zu KEINER Ansicht - ohne sie wuerde der Poll
    // ihre Variablen nie abfragen und die Kacheln blieben dauerhaft auf "-".
    try{if(typeof chromeAllKids==='function')chromeAllKids().forEach(function(w){_collectIds(w,function(id){if(id)set[id]=1;});});}catch(e){}
    _allIds=Object.keys(set);return _allIds;
  }
  function invalidateAllIds(){_allIds=null;}
  function applyCached(){ // beim Seitenwechsel: aktuelle Widgets sofort aus dem Cache füllen (kein „–"-Flackern)
    if(!_vidx)buildVidx();_liveSrc='cache';for(var id in _vidx){var d=_lastVals[id];if(d)applyVal(parseInt(id),d);}
  }
  function buildVidx(){
    _vidx={};
    state.widgets.forEach(function(w){_vidxOne(w,canvas);});
    // Widgets in den Leisten (bar/sidebar) - sie liegen NICHT in state.widgets, wuerden also
    // sonst nie Live-Werte bekommen (weder im Builder noch im Run).
    if(typeof chromeAllKids==='function')chromeAllKids().forEach(function(w){_vidxOne(w,canvas);});
    if(_compKids&&_compKids.length)_compKids.forEach(function(w){_vidxOne(w,canvas);});
    if(_tickKids&&_tickKids.length)_tickKids.forEach(function(w){_vidxOne(w,canvas);});
    if(_popup&&_popup.widgets){var _ov=$('#ovcanvas');if(_ov)_popup.widgets.forEach(function(w){_vidxOne(w,_ov);});}
  }
  function invalidateVidx(){_vidx=null;} // bei render()/Popup-Wechsel aufrufen — nächster poll/apply baut neu
  // Live-Feed (für WS-Monitor-Widget): jeder eingehende Wert wird protokolliert, mit Quelle (poll/ws)
  var _liveFeed=[],_liveSrc='poll';
  function _feedPush(id,d,src){if(src==='cache')return;_liveFeed.push({t:Date.now(),id:id,v:(d.f!=null&&d.f!=='')?d.f:d.v,src:src||'poll'});if(_liveFeed.length>500)_liveFeed.splice(0,_liveFeed.length-500);}
  function applyVal(id,d){
    if(!id||!d)return;_lastVals[id]=d;_feedPush(id,d,_liveSrc);
    var base=(d.f!==''&&d.f!=null)?d.f:d.v,on=(d.v===true||d.v===1||d.v==='1');
    var _bs=String(base),_pu=(d.u!=null)?String(d.u):''; // Profil-Einheit vom Server
    var num=(_pu!==''&&_bs.length>=_pu.length&&_bs.slice(-_pu.length)===_pu)?_bs.slice(0,-_pu.length).replace(/\s+$/,''):_bs; // Wert ohne Profil-Einheit
    $$('[data-vid="'+id+'"]',canvas).forEach(function(e){e.textContent=base;}); // generische Slots (Forecast etc.)
    $$('[data-viddot="'+id+'"]',canvas).forEach(function(e){e.classList.toggle('on',on);}); // Status-Dots / Bewegung
    $$('[data-vidbar="'+id+'"]',canvas).forEach(function(e){var nb=parseFloat(String(d.v).replace(',','.'));if(!isNaN(nb))e.style.width=Math.max(0,Math.min(100,nb))+'%';}); // Meter-Balken
    function _apply1(w,root){try{
      var el=$('.w[data-id="'+w.id+'"]',root);if(!el)return;
      var _dn=null;if(w.dec!=null){var _rr=parseFloat(String(d.v).replace(',','.'));if(!isNaN(_rr))_dn=_rr.toFixed(w.dec).replace('.',',');} // eigene Nachkommastellen aus Rohwert
      var _vb=(_dn!=null)?((w.suf||w.unit)?_dn:(_pu?(_dn+' '+_pu.trim()):_dn)):((w.suf||w.unit)?num:base); // dec -> Zahl (+ Profil-Einheit falls keine Widget-Einheit); sonst wie gehabt
      var _b=w.fmt?fmtVal(w,d,base):_vb;var txt=(w.pre||w.suf)?((w.pre||'')+_b+(w.suf||'')):_b; // Format + Präfix/Suffix
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
    var ids=Object.keys(_vidx); // nur aktuelle Ansicht -> kleine URL; Warm-Cache aller Seiten liefert der WebSocket-Push
    if(!ids.length)return;
    fetch('?api=val&ids='+ids.join(',')+'&since='+_pvSince,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j)return;if(j.ts)_pvSince=j.ts;if(!j.values)return;
      _liveSrc='poll';for(var id in j.values){applyVal(parseInt(id),j.values[id]);}
    }).catch(function(){});
  }
  function startPV(ms){stopPV();_pvT=setInterval(pollVals,ms||1200);}
  function stopPV(){if(_pvT){clearInterval(_pvT);_pvT=null;}}
  document.addEventListener('visibilitychange',function(){if(document.hidden){stopPV();}else{_pvSince=0;pollVals();startPV(_wsOK?5000:1200);}});

  // ===== WebSocket-Push (deckt MAP-Variablen sofort; Poll bleibt für alle Bindungen) =====
  var WS_PORT="__LV_WSPORT__",_ws=null,_wsOK=false,_wsTries=0;
  function refreshMedia(mid){var u='?api=media&id='+mid+'&t='+Date.now();$$('img[data-media="'+mid+'"]',canvas).forEach(function(e){e.src=u;});var ov=$('#ovcanvas');if(ov)$$('img[data-media="'+mid+'"]',ov).forEach(function(e){e.src=u;});} // Kamera bei MM_UPDATE-Push neu laden
  function wsConnect(){
    if(!WS_PORT)return;                       // leer -> reines Polling
    if(_wsTries>=5)return;                    // Server nicht verfügbar/lehnt ab -> aufgeben (kein Reconnect-Sturm/Log-Flut)
    try{_ws=new WebSocket('ws://'+location.hostname+':'+WS_PORT);}catch(e){return;}
    _ws.onopen=function(){try{_ws.send('hello');}catch(e){}};
    _ws.onmessage=function(ev){_wsOK=true;_wsTries=0;if(bcfg().noSafetyPoll)stopPV();else startPV(5000);try{var j=JSON.parse(ev.data);if(j&&j.reload&&RUN){location.reload();return;}if(j&&j.values){_liveSrc='ws';for(var k in j.values){var d=j.values[k];if(d&&d.id)applyVal(d.id,d);}}if(j&&j.media&&j.media.length)j.media.forEach(function(mid){refreshMedia(mid);});}catch(e){}}; // Werte + Kamera-Medien-Push
    _ws.onclose=function(){_wsOK=false;startPV(1200);_wsTries++;if(_wsTries<5)setTimeout(wsConnect,Math.min(60000,8000*_wsTries));}; // Backoff, max. 5 Versuche
    _ws.onerror=function(){try{_ws.close();}catch(e){}};
  }
  startPV();wsConnect();
  function setVar(id,val){fetch('?api=setvar&id='+id+'&value='+encodeURIComponent(val)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'}).then(function(){setTimeout(pollVals,250);});}

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
    else if(w.type==='kpi'||w.type==='calc'||w.type==='cval'||w.type==='sval'){if(!w.unit)w.unit=su.replace(/^\s+/,'');}
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
  function showTab(t){$$('.tab').forEach(function(x){x.classList.toggle('on',x.dataset.tab===t);});$$('.pane').forEach(function(x){x.classList.toggle('on',x.dataset.pane===t);});}
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
    selClear();var newIds=[];
    (b.widgets||[]).forEach(function(cw){var c=JSON.parse(JSON.stringify(cw));c.id=uid();c.x=snap(ox+(cw.x||0));c.y=snap(oy+(cw.y||0));state.widgets.push(c);newIds.push(c.id);});
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
  var SKIN_FU='-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif',SKIN_FM='ui-monospace,"SF Mono",Menlo,Consolas,monospace';
  var BUILTIN={
    'Standard':{fu:SKIN_FU,fm:SKIN_FM,
      dark:{bg:'#0d1315',surface:'#141c1f','surface-2':'#1a2428',tile:'#131b1e',line:'#25333a','line-soft':'#1b262b',text:'#e7eef0',muted:'#8ba0a6',faint:'#63757b',accent:'#00cdab','accent-2':'#0a8f79',ok:'#39d08a',warn:'#f2b441',crit:'#f2685a',info:'#5ab6ff',warm:'#f2a03d'},
      light:{bg:'#eef1f2',surface:'#ffffff','surface-2':'#f2f5f6',tile:'#f8fafb',line:'#dbe2e5','line-soft':'#e9eef0',text:'#17242a',muted:'#5b6b72',faint:'#93a2a8',accent:'#00937c','accent-2':'#00b294',ok:'#1a9c6b',warn:'#c8871a',crit:'#d64535',info:'#2f7fd6',warm:'#d98a1a'}},
    'Indigo':{fu:SKIN_FU,fm:SKIN_FM,
      dark:{bg:'#0e1220',surface:'#161b2e','surface-2':'#1d2440',tile:'#141a2b',line:'#2a3350','line-soft':'#1e2540',text:'#e8ecf8',muted:'#9aa3c0',faint:'#6b7495',accent:'#818cf8','accent-2':'#6366f1',ok:'#39d08a',warn:'#f2b441',crit:'#f2685a',info:'#60a5fa',warm:'#f2a03d'},
      light:{bg:'#eef0f7',surface:'#ffffff','surface-2':'#f3f4fb',tile:'#f8f9fe',line:'#dde0ef','line-soft':'#eaecf7',text:'#1a1f38',muted:'#5b6285',faint:'#9298b8',accent:'#4f46e5','accent-2':'#6366f1',ok:'#1a9c6b',warn:'#c8871a',crit:'#d64535',info:'#2f6fe0',warm:'#d98a1a'}},
    'Bernstein':{fu:SKIN_FU,fm:SKIN_FM,
      dark:{bg:'#141110',surface:'#1e1a17','surface-2':'#262019',tile:'#1a1613',line:'#39301f','line-soft':'#241d16',text:'#f0e9df',muted:'#a89b88',faint:'#77685a',accent:'#f5a524','accent-2':'#d98a1a',ok:'#39d08a',warn:'#f2b441',crit:'#f2685a',info:'#5ab6ff',warm:'#f5a524'},
      light:{bg:'#f5f1ea',surface:'#fffdf9','surface-2':'#f3ede2',tile:'#faf6ef',line:'#e2d7c4','line-soft':'#efe8db',text:'#2a2115',muted:'#6f6250',faint:'#a2917a',accent:'#c8871a','accent-2':'#a56f14',ok:'#1a9c6b',warn:'#c8871a',crit:'#d64535',info:'#2f7fd6',warm:'#c8871a'}}
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
    if(sk.fu)rs.setProperty('--fu',sk.fu);if(sk.fm)rs.setProperty('--fm',sk.fm);
    rs.setProperty('--ring','0 0 0 3px color-mix(in oklab,'+(toks.accent||'#00cdab')+' 38%,transparent)');
    document.documentElement.setAttribute('data-theme',th);rs.colorScheme=th;
    document.body.classList.toggle('wglow',!!(store.cfg&&store.cfg.wglow)); // optionaler Widget-Glow (Akzentfarbe)
    updateSkinSwitches();
    // HTML-Inhalte neu rendern -> Skin-Enforcer zieht Schrift/Farben ans neue Theme nach (Shadow/iframe rechnen Farben beim Rendern)
    try{var _re=function(w){if(w&&w.type==='html'){if(w.htmlSrc==='custom')setHtmlContent(w,w.html||'');else fetchHtml(w);}};if(typeof state!=='undefined'&&state.widgets)allWidgets().forEach(_re);if(typeof _tickKids!=='undefined'&&_tickKids)_tickKids.forEach(_re);}catch(e){}
  }
  function updateSkinSwitches(){$$('.hskwb').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-skw')===(store.theme||'dark'));});$$('[data-role=skwsel]',canvas).forEach(function(s){s.value=store.skin||'Standard';});}
  function editSkinToken(k,val){var a=store.skin;if(BUILTIN[a]||!store.skins||!store.skins[a])return;var th=(store.theme==='light'?'light':'dark');store.skins[a][th]=store.skins[a][th]||{};store.skins[a][th][k]=val;applySkin();commit();}
  function editSkinFont(k,val){var a=store.skin;if(BUILTIN[a]||!store.skins||!store.skins[a])return;store.skins[a][k]=val;applySkin();commit();}
  function newSkin(dup){var base=dup?activeSkin():BUILTIN['Standard'];var nm=prompt('Name des Skins:',dup?((store.skin||'Standard')+' Kopie'):'Mein Skin');if(!nm)return;if(allSkins()[nm]){toast('Name existiert bereits');return;}store.skins=store.skins||{};store.skins[nm]=JSON.parse(JSON.stringify(base));store.skin=nm;applySkin();buildSkins();commit();toast('Skin „'+nm+'" angelegt');}
  function deleteSkin(){var a=store.skin;if(BUILTIN[a])return;if(!confirm('Skin „'+a+'" löschen?'))return;delete store.skins[a];store.skin='Standard';applySkin();buildSkins();commit();}
