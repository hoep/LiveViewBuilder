  function buildIconLib(q){
    var box=$('#iconLib');if(!box)return;box.innerHTML='';q=(q||'').toLowerCase();
    var cats={};Object.keys(ICONS).forEach(function(id){var e=ICONS[id];if(q&&id.toLowerCase().indexOf(q)<0&&e[0].toLowerCase().indexOf(q)<0)return;(cats[e[0]]=cats[e[0]]||[]).push(id);});
    Object.keys(cats).forEach(function(cat){
      var h=document.createElement('div');h.className='iconcat';h.textContent=cat;box.appendChild(h);
      var g=document.createElement('div');g.className='icongrid';
      cats[cat].forEach(function(id){var b=document.createElement('div');b.className='iconbtn';b.title=id;b.innerHTML=iconSVG(id);b.onclick=function(){assignIcon(id);};g.appendChild(b);});
      box.appendChild(g);
    });
    if(!box.children.length)box.innerHTML='<div class="hint">Nichts gefunden.</div>';
  }
  $('#iconSearch').addEventListener('input',function(){buildIconLib(this.value);});
  $('#gridBtn').onclick=function(){gridOn=!gridOn;this.classList.toggle('on',gridOn);canvas.classList.toggle('grid',gridOn);};
  $('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
  $('#modeBtn').onclick=function(){mode=(mode==='edit')?'preview':'edit';stage.classList.toggle('edit',mode==='edit');stage.classList.toggle('preview',mode==='preview');this.textContent=(mode==='edit')?'Vorschau':'Bearbeiten';this.classList.toggle('on',mode==='preview');if(mode==='preview')select(null);};

  // ---------- Ansichten (Views) ----------
  function refreshViewSel(){var s=$('#viewSel');if(!s)return;s.innerHTML='';Object.keys(store.views).forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=n+(n===store.home?'  · Start':'');if(n===store.current)o.selected=true;s.appendChild(o);});}
  function reseq(){seq=1;state.widgets.forEach(function(w){var n=parseInt(String(w.id||'w0').replace('w',''))||0;if(n>=seq)seq=n+1;});}
  function switchView(name){if(!store.views[name])return;store.current=name;state=store.views[name];if(!state.page)state.page={w:1440,h:900};if(!state.widgets)state.widgets=[];selId=null;sel={};reseq();refreshViewSel();setCanvas();invalidateSC();_scMode='';document.body.classList.remove('reflow');restoring=true;render();restoring=false;renderProps();resetHist();}
  function newView(){var n=prompt('Name der neuen Ansicht:','Ansicht '+(Object.keys(store.views).length+1));if(!n)return;if(store.views[n]){toast('Name existiert bereits');return;}store.views[n]={page:{w:bcfg().defW,h:bcfg().defH,fit:bcfg().defFit},widgets:[]};switchView(n);toast('Ansicht angelegt: '+n);}
  function renameView(){var old=store.current;if(!old)return;var n=prompt('Ansicht umbenennen:',old);if(!n||n===old)return;if(store.views[n]){toast('Name existiert bereits');return;}store.views[n]=store.views[old];delete store.views[old];store.current=n;refreshViewSel();toast('Umbenannt');}
  function deleteView(){var n=store.current;if(!n)return;if(!confirm('Ansicht „'+n+'" wirklich löschen?'))return;delete store.views[n];var keys=Object.keys(store.views);if(!keys.length){store.views['Ansicht 1']={page:{w:1440,h:900},widgets:[]};keys=['Ansicht 1'];}switchView(keys[0]);toast('Gelöscht');}
  $('#viewSel').onchange=function(){switchView(this.value);};
  $('#newView').onclick=newView;$('#renView').onclick=renameView;$('#delView').onclick=deleteView;
  $('#homeBtn').onclick=function(){store.home=store.current;refreshViewSel();toast('Startseite: '+store.current+' (Speichern nicht vergessen)');};
  $('#cvW').addEventListener('change',function(){state.page.w=Math.max(320,parseInt(this.value)||1440);setCanvas();});
  $('#cvH').addEventListener('change',function(){state.page.h=Math.max(240,parseInt(this.value)||900);setCanvas();});
  $('#zoomIn').onclick=function(){setZoom(zoom*1.15);};
  $('#zoomOut').onclick=function(){setZoom(zoom/1.15);};
  $('#zoomLbl').onclick=function(){setZoom(Math.abs(zoom-1)<1e-4?fitZoom():1);};
  stage.addEventListener('wheel',function(e){if(!(e.ctrlKey||e.metaKey)||document.body.classList.contains('run'))return;e.preventDefault();var r=canvas.getBoundingClientRect(),cx=(e.clientX-r.left)/zoom,cy=(e.clientY-r.top)/zoom,z0=zoom;setZoom(zoom*(e.deltaY<0?1.1:1/1.1));var sc=zoom/z0;stage.scrollLeft+=cx*(sc-1)*z0;stage.scrollTop+=cy*(sc-1)*z0;},{passive:false});
  $('#cvFit').addEventListener('change',function(){state.page.fit=this.value;invalidateSC();commit();renderProps();drawStructure();if(document.body.classList.contains('run'))fitCanvas();toast('Anpassung: '+this.value+(document.body.classList.contains('run')?'':' — im Live-Modus sichtbar'));});
  $('#structBtn').addEventListener('click',function(){_showStruct=!_showStruct;this.classList.toggle('on',_showStruct);drawStructure();});
  $('#themeBtn').addEventListener('click',function(){store.theme=(store.theme==='light'?'dark':'light');applySkin();buildSkins();commit();});
  (function(){var sr=$('#sideResize'),side=$('.side'),sd=null;if(!sr||!side)return;
    sr.addEventListener('mousedown',function(e){e.preventDefault();sd={x:e.clientX,w:side.offsetWidth};sr.classList.add('drag');document.body.style.cursor='ew-resize';});
    window.addEventListener('mousemove',function(e){if(!sd)return;side.style.width=Math.max(240,Math.min(760,sd.w+(sd.x-e.clientX)))+'px';});
    window.addEventListener('mouseup',function(){if(!sd)return;sd=null;sr.classList.remove('drag');document.body.style.cursor='';bcfg().sideW=side.offsetWidth;commit();});
  })();

  // ---------- Speichern / Laden (alle Ansichten) ----------
  var _saveT=null,_dirty=false,_target='';
  function markDirty(){_dirty=true;var b=$('#saveBtn');if(b)b.classList.add('dirty');}
  function markSaved(){_dirty=false;var b=$('#saveBtn');if(b)b.classList.remove('dirty');}
  function saveStore(silent){
    return fetch('?api=layout&key='+encodeURIComponent(TOKEN)+(_target?('&file='+encodeURIComponent(_target)):''),{method:'POST',body:JSON.stringify(store)})
      .then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){markSaved();if(!silent)toast('Gespeichert: '+(_target||'Standard (live)')+' ('+j.bytes+' B)');}
        else if(!silent)toast('Fehler: '+((j&&j.error)||'?'));
      }).catch(function(){if(!silent)toast('Speichern fehlgeschlagen');});
  }
  function scheduleSave(){if(!bcfg().autosave)return;clearTimeout(_saveT);_saveT=setTimeout(function(){saveStore(true);},1500);}
  function buildLayoutList(){var s=$('#layoutSel');if(!s)return;fetch('?api=layout&list=1',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    var files=(j&&j.files)||[];if(!files.some(function(f){return f.file==='';}))files.unshift({file:'',name:'Standard (live)'});
    s.innerHTML=files.map(function(f){return '<option value="'+esc(f.file)+'"'+(f.file===_target?' selected':'')+'>'+esc(f.name)+'</option>';}).join('');
  }).catch(function(){});}
  function saveAs(){var nm=prompt('Layout speichern unter (Name):','Variante '+new Date().toLocaleDateString());if(!nm)return;var slug=nm.replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');if(!slug){toast('Ungültiger Name');return;}_target=slug;saveStore(false).then(function(){buildLayoutList();});}
  $('#saveBtn').onclick=function(){saveStore(false);};
  $('#saveAsBtn').onclick=saveAs;
  $('#layoutSel').addEventListener('change',function(){_target=this.value;load();});
  function doImport(media){
    fetch('?api=import'+(media?('&media='+media):''),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.views||!Object.keys(j.views).length){toast('Import: '+((j&&j.error)||'keine Seiten gefunden'));return;}
      var cnt=0;for(var n in j.views){store.views[n]=j.views[n];cnt++;}
      switchView(j.current||Object.keys(j.views)[0]);
      toast('Importiert: '+cnt+' Seite(n) — jetzt „Speichern" nicht vergessen');
    }).catch(function(){toast('Import fehlgeschlagen');});
  }
  function showIpsPicker(list){
    var old=$('#ipspick');if(old)old.remove();
    var ov=document.createElement('div');ov.id='ipspick';
    ov.innerHTML='<div class="ipspick-card"><div class="ipspick-h">IPSView importieren<button class="ipspick-x" title="Schließen">&times;</button></div><div class="ipspick-list"></div><div class="ipspick-f">Die gewählte Ansicht wird als neue Seite(n) übernommen. Gleichnamige werden ersetzt — danach „Speichern".</div></div>';
    document.body.appendChild(ov);
    var lst=ov.querySelector('.ipspick-list');
    list.forEach(function(v){var b=document.createElement('button');b.className='ipspick-item';b.innerHTML='<span class="ipspick-nm">'+esc(v.name||('#'+v.id))+'</span><span class="ipspick-file">'+esc(v.file||'')+' · #'+v.id+'</span>';b.onclick=function(){ov.remove();doImport(v.id);};lst.appendChild(b);});
    function close(){ov.remove();}
    ov.querySelector('.ipspick-x').onclick=close;
    ov.addEventListener('click',function(e){if(e.target===ov)close();});
    document.addEventListener('keydown',function esc_(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc_);}});
  }
  $('#importBtn').onclick=function(){
    fetch('?api=ipsviews',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var vs=(j&&j.views)||[];
      if(!vs.length){if(confirm('Keine IPSView-Medienobjekte gefunden. Konfigurierte Standard-Quelle importieren?'))doImport(0);return;}
      showIpsPicker(vs);
    }).catch(function(){toast('IPSView-Liste konnte nicht geladen werden');});
  };
  function lvSite(){var p=location.pathname,m=p.match(/\/hook\/(?:builder|run)\/([^\/?#]+)/);if(m)return decodeURIComponent(m[1]);m=p.match(/\/hook\/([^\/?#]+)/);return m?decodeURIComponent(m[1]):'';}
  $('#liveBtn').onclick=function(){
    var site=lvSite(),view=encodeURIComponent(store.current||'');
    if(site){window.open(location.origin+'/hook/run/'+encodeURIComponent(site)+'?view='+view,'_blank');} // sauberes Schema
    else{window.open('?run=1&view='+view,'_blank');} // Fallback (unbekannter Pfad)
  };
  $('#runmenu').onclick=function(){$('#runlist').classList.toggle('open');};
  function load(){
    fetch('?api=layout'+(_target?('&file='+encodeURIComponent(_target)):''),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.views&&Object.keys(j.views).length){store=j;if(!store.current||!store.views[store.current])store.current=Object.keys(store.views)[0];}
      else if(j&&j.widgets){store={views:{'Ansicht 1':j},current:'Ansicht 1'};} // Migration altes Einzel-Format
      else{store={views:{'Ansicht 1':{page:{w:1440,h:900},widgets:[]}},current:'Ansicht 1'};}
      if(!store.skin)store.skin='Standard';if(!store.theme)store.theme='dark';
      if(RUN){try{var _lt=localStorage.getItem('lvtheme');if(_lt)store.theme=_lt;var _ls=localStorage.getItem('lvskin');if(_ls&&allSkins()[_ls])store.skin=_ls;}catch(_){}}
      applySkin();GS=bcfg().gs;if(bcfg().sideW){var _sd=$('.side');if(_sd)_sd.style.width=bcfg().sideW+'px';}
      switchView((VIEWNAME&&store.views&&store.views[VIEWNAME])?VIEWNAME:store.current);buildSwatches();buildIconLib();buildBlocks();buildSkins();buildSettings();buildLayoutList();decoratePalette(); // ?view= auch im Edit-Modus berücksichtigen
      if(RUN){enterRun();}else{toast('Geladen: '+(_target||'Standard')+' · '+Object.keys(store.views).length+' Ansicht(en)');}
    }).catch(function(){store={views:{'Ansicht 1':{page:{w:1440,h:900},widgets:[]}},current:'Ansicht 1'};switchView('Ansicht 1');if(RUN)enterRun();});
  }

  // ---------- Runtime (Vollbild-Anzeige) ----------
  // ============ SmartFit — adaptiver Autoscaler (fuellt jeden Viewport, minimiert Scroll) ============
  var SMART_DEF={reflowLo:0.55,phoneW:500,minScale:0.5,gap:8,growCap:2.6,kMin:0.72,kMax:1.9};
  var SF_STRETCH={chart:1,spark:1,sankey:1,camera:1,campro:1,calendar:1,devlist:1,statuslist:1,ticker:1,tempbar:1,statusgrid:1,meterlist:1,infolist:1,kpi:1,image:1,statusimage:1,select:1,shape:1,dial:1,webview:1,weekplan:1,skinswitch:1,weatherpro:1,suncard:1,media:1,html:1,bar:1,line:1,gauge:1,gaugepro:1};
  var SF_LOCK={chart:1,spark:1,camera:1,campro:1,media:1,sankey:1,html:1,calendar:1,devlist:1,statuslist:1};
  var SF_NOGROW={chip:1,button:1,icon:1,clock:1,switch:1,sun:1};
  var SF_PRIO={chart:3,camera:3,campro:3,powerflow:3,sankey:3,gaugepro:3,html:3,chip:1,button:1,icon:1,clock:1,switch:1,sun:1};
  var _scCache=null,_scView=null,_scMode='';
  function invalidateSC(){_scCache=null;}
  function sfCfg(p){var c=(p&&p.smart)||{},o={},k;for(k in SMART_DEF)o[k]=(c[k]!=null?c[k]:SMART_DEF[k]);return o;}
  function sfClass(w){if(w.fit==='stretch')return 's';if((w.fit==='scale'||w.fit==='fix')&&!SF_LOCK[w.type])return 'x';return SF_STRETCH[w.type]?'s':'x';}
  function sfPrio(w){return w.prio||SF_PRIO[w.type]||2;}
  function effFit(p){return (p&&p.fit)||'letterbox';}
  function sfSnap(v){return Math.round(v/10)*10;}
  function sfClamp(v,a,b){return v<a?a:(v>b?b:v);}
  function sfTracks(ax,D){
    var pos=ax,sz=ax==='x'?'w':'h',e={},i;e[0]=1;e[D]=1;
    state.widgets.forEach(function(w){e[sfSnap(w[pos])]=1;e[sfSnap(w[pos]+w[sz])]=1;});
    var pts=Object.keys(e).map(Number).sort(function(a,b){return a-b;}),T=[];
    for(i=0;i<pts.length-1;i++)T.push({d0:pts[i],size:pts[i+1]-pts[i],w:0});
    var minT=Math.max(10,0.02*D);
    for(i=T.length-1;i>0;i--)if(T[i].size<minT){T[i-1].size+=T[i].size;T.splice(i,1);}
    return T.length?T:[{d0:0,size:D,w:0}];
  }
  function sfWeigh(T,ax){
    var pos=ax,sz=ax==='x'?'w':'h';
    state.widgets.forEach(function(w){var a=w[pos],b=a+w[sz],cw=(sfClass(w)==='s'?1:0.15)*sfPrio(w);if(SF_NOGROW[w.type])cw=0;
      T.forEach(function(t){if(t.d0>=a-0.5&&t.d0+t.size<=b+0.5)t.w=Math.max(t.w,cw);});});
  }
  function sfBands(){
    var ws=state.widgets.slice().sort(function(a,b){return (a.y-b.y)||(a.x-b.x);}),bands=[],cur=null,bot=0;
    ws.forEach(function(w){var yc=w.y+w.h/2;if(cur&&yc<bot){cur.push(w);if(w.y+w.h*0.6>bot)bot=w.y+w.h*0.6;}else{cur=[w];bands.push(cur);bot=w.y+w.h*0.6;}});
    bands.forEach(function(b){b.sort(function(a,c){return a.x-c.x;});});
    return bands;
  }
  function sfStructure(p){
    if(_scCache&&_scView===store.current)return _scCache;
    var col=sfTracks('x',p.w),row=sfTracks('y',p.h);sfWeigh(col,'x');sfWeigh(row,'y');
    _scView=store.current;return _scCache={col:col,row:row,bands:sfBands()};
  }
  function sfDistribute(T,view,s0,c){
    var base=0,left;T.forEach(function(t){t.px=t.size*s0;base+=t.px;});
    var spare=view-base;left=spare;
    if(spare>0){
      var tot=0;T.forEach(function(t){t.wb=t.w*t.size;t.cap=false;if(t.w>0)tot+=t.wb;});
      if(tot>0){
        T.forEach(function(t){if(t.w>0){var want=spare*t.wb/tot,cap=t.px*(c.growCap-1),add=Math.min(want,cap);t.px+=add;left-=add;t.cap=(add>=cap-0.01);}});
        var tot2=0;T.forEach(function(t){if(t.w>0&&!t.cap)tot2+=t.wb;});
        if(tot2>0&&left>0.5){T.forEach(function(t){if(t.w>0&&!t.cap)t.px+=left*t.wb/tot2;});left=0;}
      }
      var cur=Math.max(0,left)/2;T.forEach(function(t){t.pos=cur;cur+=t.px;});
    }else{var cur2=Math.max(0,spare/2);T.forEach(function(t){t.pos=cur2;cur2+=t.px;});}
  }
  function sfCell(T,a,b){var x0=null,x1=null;T.forEach(function(t){if(t.d0>=a-0.5&&t.d0+t.size<=b+0.5){if(x0==null)x0=t.pos;x1=t.pos+t.px;}});if(x0==null){x0=T[0].pos;x1=T[0].pos+T[0].px;}return [x0,x1];}
  function sfAlignOff(box,content,anchor,axis){var s;if(axis==='x')s=anchor.indexOf('l')>=0?0:(anchor.indexOf('r')>=0?1:0.5);else s=anchor.indexOf('t')>=0?0:(anchor.indexOf('b')>=0?1:0.5);return (box-content)*s;}
  function sfEl(w){return canvas.querySelector('.w[data-id="'+w.id+'"]');}

  function letterboxFit(){
    var vw=window.innerWidth,vh=window.innerHeight,s=Math.min(vw/state.page.w,vh/state.page.h);
    canvas.style.transformOrigin='top left';canvas.style.transform='scale('+s+')';
    canvas.style.position='absolute';canvas.style.left=Math.max(0,(vw-state.page.w*s)/2)+'px';canvas.style.top=Math.max(0,(vh-state.page.h*s)/2)+'px';
    canvas.style.width=state.page.w+'px';canvas.style.height=state.page.h+'px';
  }
  function fitCanvas(){
    if(!document.body.classList.contains('run'))return;
    var p=state.page,mode=effFit(p),vw=window.innerWidth,vh=window.innerHeight;
    if(bcfg().mobileOpt!==false&&isMobile()&&mode!=='reflow')mode='auto'; // Mobil: nie Letterbox -> SmartFit/Reflow
    if(mode==='letterbox'||!p||p.w<=0||p.h<=0||vw<8||vh<8||!state.widgets.length){document.body.classList.remove('reflow');return letterboxFit();}
    var m=(mode==='auto')?sfPick(vw,vh,p):mode;
    canvas.style.transform='none';canvas.style.transformOrigin='top left';canvas.style.left='0';canvas.style.top='0';canvas.style.width=vw+'px';
    if(m==='reflow'){document.body.classList.add('reflow');canvas.style.position='relative';return reflowFit(vw,vh);}
    document.body.classList.remove('reflow');canvas.style.position='absolute';canvas.style.height=vh+'px';smartFit(vw,vh);
  }
  function sfPick(vw,vh,p){var c=sfCfg(p),ad=p.w/p.h,av=vw/vh,lo=c.reflowLo+(_scMode==='reflow'?0.08:0),r=(av/ad<lo)||vw<c.phoneW;_scMode=r?'reflow':'anchor';return _scMode;}

  function smartFit(vw,vh){
    var p=state.page,S=sfStructure(p),c=sfCfg(p),s0=Math.min(vw/p.w,vh/p.h),W=p.w,H=p.h,tol=0.055*Math.min(W,H),stretched=[];
    sfDistribute(S.col,vw,s0,c);sfDistribute(S.row,vh,s0,c);
    state.widgets.forEach(function(w){
      var el=sfEl(w);if(!el)return;var win=el.firstElementChild;if(!win)return;
      var cx=sfCell(S.col,sfSnap(w.x),sfSnap(w.x+w.w)),cy=sfCell(S.row,sfSnap(w.y),sfSnap(w.y+w.h)),cell={x:cx[0],y:cy[0],w:cx[1]-cx[0],h:cy[1]-cy[0]};
      var spanX=(w.x<=tol&&W-(w.x+w.w)<=tol),spanY=(w.y<=tol&&H-(w.y+w.h)<=tol);
      if(sfClass(w)==='s'){
        var g=c.gap,bw=Math.max(w.minW||30,cell.w-2*g),bh=Math.max(w.minH||24,cell.h-2*g),bx=cell.x+g,by=cell.y+g;
        if(w.type==='gauge'||w.type==='gaugepro'){var side=Math.min(bw,bh*1.4);if(side<bh){by+=(bh-side)/2;bh=side;}if(side<bw){bx+=(bw-side)/2;bw=side;}}
        bx=Math.max(0,Math.min(bx,vw-bw));by=Math.max(0,Math.min(by,vh-bh)); // Sicherung: nie aus dem sichtbaren Bereich schieben
        win.style.transform='';win.style.width='';win.style.height='';el.style.transform='none';
        el.style.left=bx+'px';el.style.top=by+'px';el.style.width=bw+'px';el.style.height=bh+'px';stretched.push(w);
      }else{
        var kB=SF_NOGROW[w.type]?s0:sfClamp(Math.min(cell.w/w.w,cell.h/w.h),s0*c.kMin,s0*c.kMax);
        var cw=w.w*kB,ch=w.h*kB,anc=w.anchor||'',bw2=spanX?cell.w:cw,bh2=spanY?cell.h:ch;
        var bx2=cell.x+(spanX?0:sfAlignOff(cell.w,bw2,anc,'x')),by2=cell.y+(spanY?0:sfAlignOff(cell.h,bh2,anc,'y'));
        bx2=Math.max(0,Math.min(bx2,vw-bw2));by2=Math.max(0,Math.min(by2,vh-bh2)); // Sicherung: im sichtbaren Bereich halten
        el.style.transform='none';el.style.left=bx2+'px';el.style.top=by2+'px';el.style.width=bw2+'px';el.style.height=bh2+'px';
        win.style.width=w.w+'px';win.style.height=w.h+'px';
        win.style.transform='translate('+sfAlignOff(bw2,cw,anc,'x')+'px,'+sfAlignOff(bh2,ch,anc,'y')+'px) scale('+kB+')';
      }
    });
    sfPropagate(stretched);
  }

  // Reflow = hoehen-optimierter Flow-Umbruch: waehlt die groesste Skala, bei der ALLES auf einen Screen passt
  function sfFlowH(order,vw,M,gap,s){var x=M,y=M,rowH=0;order.forEach(function(w){if(w.reflowHide)return;var ww=w.w*s,wh=w.h*s;if(x>M&&x+ww>vw-M){x=M;y+=rowH+gap;rowH=0;}x+=ww+gap;if(wh>rowH)rowH=wh;});return y+rowH+M;}
  function reflowFit(vw,vh){
    var p=state.page,S=sfStructure(p),c=sfCfg(p),order=[],stretched=[];
    S.bands.forEach(function(b){order=order.concat(b);});
    // Schmaler Bildschirm (Handy): EINSPALTER — jede Kachel füllt die Breite, vertikal scrollen.
    if(vw<560){
      var M=10,colW=vw-2*M,y=M;
      order.forEach(function(w){if(w.reflowHide)return;var el=sfEl(w);if(!el)return;var win=el.firstElementChild;if(!win)return;
        var s=Math.min(1.6,colW/w.w);                 // breite verkleinern, kleine moderat vergrößern
        var bw=w.w*s,bh=w.h*s,x=M+Math.max(0,(colW-bw)/2);
        if(sfClass(w)==='s'){win.style.transform='';win.style.width='';win.style.height='';stretched.push(w);}
        else{win.style.width=w.w+'px';win.style.height=w.h+'px';win.style.transform='scale('+s+')';}
        el.style.transform='none';el.style.left=x+'px';el.style.top=y+'px';el.style.width=bw+'px';el.style.height=bh+'px';
        y+=bh+M;
      });
      canvas.style.height=Math.max(vh,y+M)+'px';sfPropagate(stretched);return;
    }
    // Sonst: höhen-optimierter Flow-Umbruch (moderates Portrait).
    var MM=14,maxW=1;order.forEach(function(w){if(w.w>maxW)maxW=w.w;});
    var sHi=Math.min(1.4,(vw-2*MM)/maxW);if(sHi<c.minScale)sHi=c.minScale;
    var sR=c.minScale,step=(sHi-c.minScale)/16||1,s;
    for(s=sHi;s>=c.minScale-1e-6;s-=step){if(sfFlowH(order,vw,MM,c.gap,s)<=vh){sR=s;break;}}
    var x=MM,yy=MM,rowH=0;
    order.forEach(function(w){if(w.reflowHide)return;var el=sfEl(w);if(!el)return;var win=el.firstElementChild;if(!win)return;
      var ww=w.w*sR,wh=w.h*sR;if(x>MM&&x+ww>vw-MM){x=MM;yy+=rowH+c.gap;rowH=0;}
      if(sfClass(w)==='s'){win.style.transform='';win.style.width='';win.style.height='';stretched.push(w);}
      else{win.style.width=w.w+'px';win.style.height=w.h+'px';win.style.transform='scale('+sR+')';}
      el.style.transform='none';el.style.left=x+'px';el.style.top=yy+'px';el.style.width=ww+'px';el.style.height=wh+'px';
      x+=ww+c.gap;if(wh>rowH)rowH=wh;
    });
    canvas.style.height=Math.max(vh,yy+rowH+MM)+'px';sfPropagate(stretched);
  }
  function sfPropagate(list){requestAnimationFrame(function(){list.forEach(function(w){var e=_ec[w.id];if(e)e.resize();if(w.type==='html')applyHtmlScale(w);});});}
  // ---- Struktur-Overlay (zeigt erkanntes SmartFit-Raster im Editor) ----
  var _showStruct=false;
  function drawStructure(){
    var ov=$('#sfOverlay',canvas);
    if(!_showStruct||document.body.classList.contains('run')){if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);return;}
    if(!ov){ov=document.createElement('div');ov.id='sfOverlay';canvas.appendChild(ov);}
    if(!state.widgets.length){ov.innerHTML='';return;}
    var S=sfStructure(state.page),W=state.page.w,H=state.page.h,h='';
    S.col.forEach(function(t){if(t.w>0)h+='<div class="sfband" style="left:'+t.d0+'px;width:'+t.size+'px"></div>';h+='<div class="sfseam v" style="left:'+t.d0+'px"></div>';if(t.w>0)h+='<div class="sflabel" style="left:'+(t.d0+3)+'px;top:2px">'+t.w+'</div>';});
    h+='<div class="sfseam v" style="left:'+W+'px"></div>';
    S.row.forEach(function(t){h+='<div class="sfseam h" style="top:'+t.d0+'px"></div>';});
    h+='<div class="sfseam h" style="top:'+H+'px"></div>';
    ov.innerHTML=h;
  }
  function enterRun(){
    var mob=isMobile();
    var v=VIEWNAME||(mob&&store.homeMobile&&store.views[store.homeMobile]?store.homeMobile:'')||store.home||store.current;
    // pro-Seite hinterlegte Mobil-Alternative auf Handys automatisch nehmen
    if(mob&&store.views[v]&&store.views[v].page&&store.views[v].page.mobileView&&store.views[store.views[v].page.mobileView])v=store.views[v].page.mobileView;
    if(v&&store.views[v])switchView(v);
    document.body.classList.add('run');applyZoom();mode='preview';stage.classList.remove('edit');stage.classList.add('preview');
    canvas.classList.remove('grid');selClear();markSel();buildRunNav();fitCanvas();
  }
  function buildRunNav(){
    var box=$('#runlist');if(!box)return;box.innerHTML='';
    Object.keys(store.views).forEach(function(n){var b=document.createElement('button');b.innerHTML=(n===store.home?'<svg class="i" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;vertical-align:-2px;margin-right:6px"><use href="#ic-home"/></svg>':'')+esc(n);b.onclick=function(){switchView(n);fitCanvas();$('#runlist').classList.remove('open');};box.appendChild(b);});
  }
  var _sfRaf=0;window.addEventListener('resize',function(){if(_sfRaf)return;_sfRaf=requestAnimationFrame(function(){_sfRaf=0;fitCanvas();});});
