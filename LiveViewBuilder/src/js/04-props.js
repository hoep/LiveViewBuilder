  function renderProps(){
    var w=widget(selId),p=$('#props');
    if(!w){p.innerHTML='<div class="hint">Kein Element ausgewählt.</div>';return;}
    try{
    var typeOpts=Object.keys(TYPES).map(function(t){return '<option value="'+t+'">'+TYPES[t]+'</option>';}).join('');
    var lbl2={thermostat:'Ziel-Var',light:'Helligkeit',cover:'Stop-Var',weather:'Zusatz',weatherpro:'Zusatz/Gefühlt',sun:'Untergang',suncard:'Untergang',media:'Zustand',room:'Metrik 2',vacuum:'Batterie',chart:'Serie 2 (Var)'}[w.type];
    var lbl3={media:'Lautstärke',room:'Metrik 3',vacuum:'Start/Stop',chart:'Serie 3 (Var)',thermostat:'Modus/Profil-Var'}[w.type];
    p.innerHTML=(Object.keys(sel).length>=2?alignSection():'')
      +'<div class="prop">'
      +row('Typ','<select id="pType">'+typeOpts+'</select>')
      +row('Label','<input id="pLabel" value="'+esc(w.label||'')+'">')
      +((w.type==='camera'||w.type==='image')?row('Media-ID','<input id="pMedia" value="'+(w.mediaId||'')+'" placeholder="Media-ID">')
          :(w.type==='line'||w.type==='shape')?row('Farbe','<input id="pColor" type="color" value="'+(w.color||'#00cdab')+'">')
          :(w.type!=='text'&&w.type!=='calendar'&&w.type!=='clock'&&!(w.type==='html'&&w.htmlSrc==='custom')?row('Variable','<input id="pVar" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pPick" style="padding:6px 8px">wählen</button>'):''))
      +((w.type==='kpi'||w.type==='delta')?('<div class="pgh">Vergleich (Zeitversatz)</div>'
        +row('Aktiv','<input type="checkbox" id="pCmpOn"'+(w.cmpOn?' checked':'')+'>')
        +(w.cmpOn?(row('Versatz',offSel('pCmpOff',w.cmpOff,true))+row('Anzeige','<select id="pCmpMode"><option value="pct"'+((w.cmpMode||'pct')==='pct'?' selected':'')+'>Prozent</option><option value="abs"'+(w.cmpMode==='abs'?' selected':'')+'>Absolut</option></select>')+row('Anstieg = schlecht','<input type="checkbox" id="pCmpInv"'+(w.cmpInvert?' checked':'')+'>')):'')
      ):'')
      +(FMT_TYPES.indexOf(w.type)>=0?row('Format','<select id="pFmt">'+fmtOpts(w.fmt)+'</select>'):'')
      +((w.type==='chart'||w.type==='spark')?row('Stunden','<input id="pHours" type="number" value="'+(w.hours||24)+'">'):'')
      +(['bar','gauge','slider','thermostat','gaugepro','timer','tempbar','dial'].indexOf(w.type)>=0?(row('Min','<input id="pMin" type="number" value="'+(w.min!=null?w.min:0)+'">')+row('Max','<input id="pMax" type="number" value="'+(w.max!=null?w.max:100)+'">')):'')
      +((w.type==='slider'||w.type==='thermostat'||w.type==='dial')?row('Schritt','<input id="pStep" type="number" step="0.1" value="'+(w.step||1)+'">'):'')
      +(lbl2?row(lbl2,'<input id="pVar2" value="'+(w.varId2||'')+'" placeholder="ID"> <button class="btn" id="pPick2" style="padding:6px 8px">wählen</button>'):'')
      +(lbl3?row(lbl3,'<input id="pVar3" value="'+(w.varId3||'')+'" placeholder="ID"> <button class="btn" id="pPick3" style="padding:6px 8px">wählen</button>'):'')
      +(w.type!=='line'?row('Farben','<input id="pFg" type="color" value="'+(w.fg||'#e7eef0')+'" title="Textfarbe"> <input id="pBg" type="color" value="'+(w.bg||'#141c1f')+'" title="Hintergrund"> <button class="btn" id="pClr" style="padding:5px 8px" title="Farben zurücksetzen"><svg class="i"><use href="#ic-minus"/></svg></button>'):'')
      +(['icon','value','switch','bar','tile','button','light','chip','weather','weatherpro','room','kpi'].indexOf(w.type)>=0?row('Icon','<span style="width:20px;height:20px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.icon?iconSVG(w.icon):'')+'</span> <button class="btn" id="pIcon" style="padding:5px 8px">wählen</button>'+(w.icon?' <button class="btn" id="pIconX" style="padding:5px 8px" title="Icon entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':'')):'')
      +(['icon','value','switch','bar','tile','button','light','chip','room','kpi'].indexOf(w.type)>=0&&w.varId?'<div id="assocBox" class="assocbox"></div>':'')
      +(function(){try{return (WIDGETS[w.type]&&WIDGETS[w.type].props)?WIDGETS[w.type].props(w):'';}catch(_e){console.error('props('+w.type+')',_e);return '<div class="hint" style="color:var(--crit);font-size:11px">Eigenschaften-Fehler bei „'+esc(w.type)+'" — siehe Konsole</div>';}})()
      +((state.page.fit&&state.page.fit!=='letterbox')?respSection(w):'')
      +(w.type!=='blank'?('<div class="pgh">Sichtbarkeit</div>'
        +row('Steuer-Var','<input id="pVisVar" value="'+(w.visVar||'')+'" placeholder="ID (leer=immer)"> <button class="btn" id="pVisPick" style="padding:6px 8px">wählen</button>')
        +(w.visVar?(row('Zeigen wenn','<select id="pVisMode"><option value="truthy"'+((w.visMode||'truthy')==='truthy'?' selected':'')+'>wahr / ≠0</option><option value="eq"'+(w.visMode==='eq'?' selected':'')+'>= Wert</option><option value="ne"'+(w.visMode==='ne'?' selected':'')+'>≠ Wert</option><option value="ge"'+(w.visMode==='ge'?' selected':'')+'>≥ Wert</option><option value="le"'+(w.visMode==='le'?' selected':'')+'>≤ Wert</option></select>')+((w.visMode&&w.visMode!=='truthy')?row('Wert','<input id="pVisVal" value="'+esc(w.visVal!=null?w.visVal:'')+'">'):'')):'')):'')
      +(w.type!=='blank'?row('Animation','<select id="pAnim"><option value=""'+(!w.anim?' selected':'')+'>keine</option><option value="fade"'+(w.anim==='fade'?' selected':'')+'>Fade</option><option value="scale"'+(w.anim==='scale'?' selected':'')+'>Scale</option><option value="slide"'+(w.anim==='slide'?' selected':'')+'>SlideUp</option></select>'):'')
      +row('Ebene','<button class="btn" id="pZFront" style="padding:4px 9px">nach vorn</button> <button class="btn" id="pZBack" style="padding:4px 9px">nach hinten</button>')
      +'<div class="xy">'+cell('X','pX',w.x)+cell('Y','pY',w.y)+cell('B','pW',w.w)+cell('H','pH',w.h)+'</div>'
      +'<button class="btn danger" id="pDel">Löschen</button>'
      +'</div>'
      +((w.type==='weather'||w.type==='weatherpro')?fcEditor(w):'')
    $('#pType').value=w.type;
    $('#pType').onchange=function(){w.type=this.value;render();renderProps();};
    $('#pLabel').oninput=function(){w.label=this.value;render();};
    if($('#pVar'))$('#pVar').onchange=function(){w.varId=parseInt(this.value)||0;delete _hist[w.id];render();renderProps();};
    if($('#pPick'))$('#pPick').onclick=function(){showTab('vars');toast('Variable im Baum anklicken — bindet an dieses Element');_bindTarget=w.id;};
    if($('#pMedia'))$('#pMedia').onchange=function(){w.mediaId=parseInt(this.value)||0;render();};
    if($('#pColor'))$('#pColor').oninput=function(){w.color=this.value;render();};
    if($('#pFg'))$('#pFg').oninput=function(){w.fg=this.value;render();};
    if($('#pBg'))$('#pBg').oninput=function(){w.bg=this.value;render();};
    if($('#pClr'))$('#pClr').onclick=function(){delete w.fg;delete w.bg;render();renderProps();};
    if($('#pIcon'))$('#pIcon').onclick=function(){_assocPick=null;showTab('icons');toast('Icon links wählen — wird der Auswahl zugewiesen');};
    if($('#assocBox'))renderAssoc(w);
    if($('#pIconX'))$('#pIconX').onclick=function(){delete w.icon;render();renderProps();};
    if($('#pFit'))$('#pFit').onchange=function(){w.fit=this.value||undefined;commit();renderProps();};
    if($('#pPrio'))$('#pPrio').onchange=function(){w.prio=parseInt(this.value)||2;commit();};
    if($('#pGrp'))$('#pGrp').oninput=function(){w.grp=this.value||undefined;commit();};
    if($('#pMinW'))$('#pMinW').oninput=function(){var v=parseInt(this.value);w.minW=isNaN(v)?undefined:v;commit();};
    if($('#pMinH'))$('#pMinH').oninput=function(){var v=parseInt(this.value);w.minH=isNaN(v)?undefined:v;commit();};
    if($('#pRHide'))$('#pRHide').onchange=function(){w.reflowHide=this.checked||undefined;commit();};
    $$('#pAnchor .anbtn').forEach(function(bt){bt.onclick=function(){w.anchor=bt.dataset.an;commit();renderProps();};});
    if($('#pFmt'))$('#pFmt').onchange=function(){w.fmt=this.value==='auto'?undefined:this.value;render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);};
    if($('#pDir'))$('#pDir').onchange=function(){w.dir=this.value;render();};
    if($('#pCmpOn'))$('#pCmpOn').onchange=function(){w.cmpOn=this.checked;delete _hist[w.id];delete _cmpData[w.id];renderProps();if(w.type==='chart'||w.type==='spark'){if(w.cmpOn)fetchHist(w);else if(_ec[w.id])renderChartData(w);commit();}else{refreshCompare(w);commit();}};
    if($('#pCmpOff'))$('#pCmpOff').onchange=function(){w.cmpOff=this.value;delete _hist[w.id];delete _cmpData[w.id];if(w.type==='chart'||w.type==='spark')fetchHist(w);else refreshCompare(w);commit();};
    if($('#pCmpShade'))$('#pCmpShade').oninput=function(){w.cmpShade=Math.max(0,Math.min(90,parseInt(this.value)||0));if(_ec[w.id])renderChartData(w);commit();};
    if($('#pCmpMode'))$('#pCmpMode').onchange=function(){w.cmpMode=this.value;refreshCompare(w);commit();};
    if($('#pCmpInv'))$('#pCmpInv').onchange=function(){w.cmpInvert=this.checked;computeCompare(w);commit();};
    if($('#pHours'))$('#pHours').onchange=function(){w.hours=parseInt(this.value)||24;delete _hist[w.id];fetchHist(w);};
    if($('#pMin'))$('#pMin').oninput=function(){var v=parseFloat(this.value);w.min=isNaN(v)?0:v;render();};
    if($('#pMax'))$('#pMax').oninput=function(){var v=parseFloat(this.value);w.max=isNaN(v)?100:v;render();};
    if($('#pStep'))$('#pStep').oninput=function(){w.step=parseFloat(this.value)||1;render();};
    if($('#pT1'))$('#pT1').oninput=function(){w.t1=this.value===''?null:parseFloat(this.value);render();};
    if($('#pT2'))$('#pT2').oninput=function(){w.t2=this.value===''?null:parseFloat(this.value);render();};
    if($('#pVar2'))$('#pVar2').onchange=function(){w.varId2=parseInt(this.value)||0;delete _hist[w.id];render();};
    if($('#pPick2'))$('#pPick2').onclick=function(){showTab('vars');toast('Variable im Baum anklicken');_bindTarget2=w.id;};
    if($('#pVar3'))$('#pVar3').onchange=function(){w.varId3=parseInt(this.value)||0;delete _hist[w.id];render();};
    if($('#pPick3'))$('#pPick3').onclick=function(){showTab('vars');toast('Untergang-Variable im Baum anklicken');_bindTarget3=w.id;};
    ['pX','pY','pW','pH'].forEach(function(k){var el=$('#'+k);el.oninput=function(){var v=parseInt(el.value)||0;if(k==='pX')w.x=v;if(k==='pY')w.y=v;if(k==='pW')w.w=Math.max(40,v);if(k==='pH')w.h=Math.max(28,v);render();};});
    $('#pDel').onclick=function(){var ids=Object.keys(sel).length?Object.keys(sel):[w.id];state.widgets=state.widgets.filter(function(x){return ids.indexOf(x.id)<0;});selClear();render();renderProps();};
    $$('[data-al]',p).forEach(function(bt){bt.onclick=function(){var a=bt.dataset.al;if(a==='disth')distributeSel('h');else if(a==='distv')distributeSel('v');else alignSel(a);};});
    $$('[data-fc]',p).forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.dataset.fc.split('.'),i=+pr[0],k=pr[1];if(!w.fc||!w.fc[i])return;w.fc[i][k]=(k==='hi'||k==='lo'||k==='pq')?(parseInt(inp.value)||0):inp.value;render();};});
    $$('[data-fcdel]',p).forEach(function(b){b.onclick=function(){w.fc.splice(+b.dataset.fcdel,1);render();renderProps();};});
    if($('#fcAdd'))$('#fcAdd').onclick=function(){if(!w.fc)w.fc=[];w.fc.push({d:'',ic:'cloudsun',hi:0,lo:0,pq:0});render();renderProps();};
    $$('[data-le]',p).forEach(function(inp){inp.oninput=function(){var pr=inp.dataset.le.split('.'),key=pr[0],i=+pr[1],k=pr[2];if(!w[key]||!w[key][i])return;w[key][i][k]=(k==='vid')?(parseInt(inp.value)||0):inp.value;render();};});
    $$('[data-ledel]',p).forEach(function(b){b.onclick=function(){var pr=b.dataset.ledel.split('.');w[pr[0]].splice(+pr[1],1);render();renderProps();};});
    $$('[data-leadd]',p).forEach(function(b){b.onclick=function(){var key=b.dataset.leadd;if(!w[key])w[key]=[];w[key].push(key==='links'?{from:'',to:'',vid:0}:{label:'',vid:0});render();renderProps();};});
    if($('#pVisVar'))$('#pVisVar').onchange=function(){w.visVar=parseInt(this.value)||undefined;render();renderProps();};
    if($('#pVisPick'))$('#pVisPick').onclick=function(){showTab('vars');_bindVis=w.id;};
    if($('#pVisMode'))$('#pVisMode').onchange=function(){w.visMode=this.value;render();renderProps();};
    if($('#pVisVal'))$('#pVisVal').oninput=function(){w.visVal=this.value;render();};
    if($('#pAnim'))$('#pAnim').onchange=function(){w.anim=this.value||undefined;render();commit();};
    if($('#pZFront'))$('#pZFront').onclick=function(){var i=state.widgets.indexOf(w);if(i>=0){state.widgets.splice(i,1);state.widgets.push(w);}render();select(w.id);commit();};
    if($('#pZBack'))$('#pZBack').onclick=function(){var i=state.widgets.indexOf(w);if(i>=0){state.widgets.splice(i,1);state.widgets.unshift(w);}render();select(w.id);commit();};
    try{if(WIDGETS[w.type]&&WIDGETS[w.type].wire)WIDGETS[w.type].wire(w);}catch(_e){console.error('wire('+w.type+')',_e);} // ein defekter wire-Hook darf die Auswahl nicht blockieren
    }catch(_ep){console.error('renderProps('+(w&&w.type)+')',_ep);p.innerHTML='<div class="hint" style="color:var(--crit);font-size:12px;white-space:pre-wrap">Eigenschaften-Fehler bei „'+esc(w.type)+'":\n'+esc((_ep&&_ep.message)||String(_ep))+'</div>';} // Panel zeigt den Fehler direkt an
  }
  function row(l,html){return '<div class="prow"><label>'+l+'</label>'+html+'</div>';}
  function cell(l,id,v){return '<div class="prow"><label style="width:18px">'+l+'</label><input id="'+id+'" type="number" value="'+v+'"></div>';}
  function tgradEditor(w){
    var arr=w.tgrad||[];
    var rows=arr.map(function(s,i){return '<div class="serow"><input data-tg="t.'+i+'" type="number" value="'+(s.t!=null?s.t:0)+'" placeholder="°C" style="width:64px"><input type="color" data-tg="color.'+i+'" value="'+(s.color||'#00cdab')+'"><button class="btn" data-tgdel="'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';}).join('');
    return '<div class="pgh">Temperatur → Farbe (Verlauf)</div>'+rows+'<button class="btn" id="tgAdd" style="margin-top:2px"><svg class="i"><use href="#ic-plus"/></svg>Stufe</button>';
  }
  function fcEditor(w){
    var wi=['sun','cloudsun','cloud','rain','snow','wind','moon'];
    var rows=(w.fc||[]).map(function(r,i){
      var ic=wi.map(function(k){return '<option value="'+k+'"'+((r.ic||'cloudsun')===k?' selected':'')+'>'+k+'</option>';}).join('');
      return '<div class="fcrow" style="display:grid;grid-template-columns:30px 62px 1fr 1fr 1fr 22px;gap:4px;margin-bottom:4px">'
        +'<input data-fc="'+i+'.d" value="'+esc(r.d||'')+'" placeholder="Tag">'
        +'<select data-fc="'+i+'.ic">'+ic+'</select>'
        +'<input data-fc="'+i+'.hi" value="'+(r.hi||'')+'" placeholder="Hi">'
        +'<input data-fc="'+i+'.lo" value="'+(r.lo||'')+'" placeholder="Lo">'
        +'<input data-fc="'+i+'.pq" value="'+(r.pq||'')+'" placeholder="R%">'
        +'<button class="btn" data-fcdel="'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
    }).join('');
    return '<div class="prop" style="margin-top:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:5px">Forecast-Tage (Hi/Lo/Regen% = Variablen-ID)</div>'+rows+'<button class="btn" id="fcAdd"><svg class="i"><use href="#ic-plus"/></svg>Tag</button></div>';
  }
  function listEditor(w,key,title,cols){
    var arr=w[key]||[];var gtc=cols.map(function(){return '1fr';}).join(' ')+' 22px';
    var rows=arr.map(function(r,i){
      return '<div class="fcrow" style="display:grid;grid-template-columns:'+gtc+';gap:4px;margin-bottom:4px">'
        +cols.map(function(c){return '<input data-le="'+key+'.'+i+'.'+c.k+'" value="'+esc(String(r[c.k]!=null?r[c.k]:''))+'" placeholder="'+c.ph+'">';}).join('')
        +'<button class="btn" data-ledel="'+key+'.'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
    }).join('');
    return '<div class="prop" style="margin-top:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:5px">'+title+'</div>'+rows+'<button class="btn" data-leadd="'+key+'"><svg class="i"><use href="#ic-plus"/></svg></button></div>';
  }

  // ---------- Hinzufügen ----------
  function addWidget(type,extra,px,py){
    var _wr=WIDGETS[type];
    var sz=(_wr&&_wr.size)||[140,80];   // Default-Größe aus dem Widget-Registry (mit Fallback)
    var w={id:uid(),type:type,x:(px!=null?snap(Math.max(0,px)):snap(40)),y:(py!=null?snap(Math.max(0,py)):snap(40)),w:sz[0],h:sz[1],label:(type==='switch'?'Schalter':(type==='text'?'Text':(type==='powerflow'?'Haus':'Label')))};
    if(_wr&&_wr.defaults)_wr.defaults(w);
    if(type==='shape'){w.shape='rect';w.color='#1b2a30';}
    if(extra)for(var k in extra)w[k]=extra[k];
    state.widgets.push(w);render();select(w.id);
  }
  $$('.pitem').forEach(function(b){
    b.onclick=function(){addWidget(b.dataset.add);};
    b.setAttribute('draggable','true');
    b.addEventListener('dragstart',function(e){e.dataTransfer.setData('text/hlw',b.dataset.add);e.dataTransfer.effectAllowed='copy';});
  });
  canvas.addEventListener('dragover',function(e){e.preventDefault();e.dataTransfer.dropEffect='copy';});
  canvas.addEventListener('drop',function(e){e.preventDefault();var r=canvas.getBoundingClientRect();var px=(e.clientX-r.left)/zoom,py=(e.clientY-r.top)/zoom;var blk=e.dataTransfer.getData('text/hlwblock');if(blk){insertBlock(blk,px,py);return;}var t=e.dataTransfer.getData('text/hlw');if(!t)return;addWidget(t,null,px-70,py-30);});

  // ---------- Drag / Resize / Marquee / Ausricht-Guides ----------
  var drag=null,marq=null;
  function applyGeom(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el){el.style.left=w.x+'px';el.style.top=w.y+'px';el.style.width=w.w+'px';el.style.height=w.h+'px';if(_ec[w.id])_ec[w.id].resize();if(w.type==='html'&&(w.htmlFit==='width'||w.htmlFit==='both'))applyHtmlScale(w);}}
  function clearGuides(){$$('.guide',canvas).forEach(function(e){e.remove();});}
  function drawGuide(dir,pos){var g=document.createElement('div');g.className='guide '+dir;if(dir==='v'){g.style.left=pos+'px';g.style.top='0';g.style.height=state.page.h+'px';}else{g.style.top=pos+'px';g.style.left='0';g.style.width=state.page.w+'px';}canvas.appendChild(g);}
  function snapAlign(items,dx,dy){
    var TH=6,it=items[0],w=it.w,nx=it.ox+dx,ny=it.oy+dy;
    var others=state.widgets.filter(function(o){return !sel[o.id];});
    var ax=null,ay=null,gx=null,gy=null;
    var xs=[[nx,0],[nx+w.w,w.w],[nx+w.w/2,w.w/2]],ys=[[ny,0],[ny+w.h,w.h],[ny+w.h/2,w.h/2]];
    var gap=bcfg().gap||0;
    others.forEach(function(o){
      [o.x,o.x+o.w,o.x+o.w/2].forEach(function(px){xs.forEach(function(q){if(ax===null&&Math.abs(px-q[0])<=TH){ax=px-q[1]-it.ox;gx=px;}});});
      [o.y,o.y+o.h,o.y+o.h/2].forEach(function(py){ys.forEach(function(q){if(ay===null&&Math.abs(py-q[0])<=TH){ay=py-q[1]-it.oy;gy=py;}});});
      if(gap>0){ // Standardabstand: rechts/links/unter/über dem Nachbarn mit festem Gap einrasten
        if(ax===null&&Math.abs((o.x+o.w+gap)-nx)<=TH){ax=(o.x+o.w+gap)-it.ox;gx=o.x+o.w;}
        if(ax===null&&Math.abs((o.x-gap)-(nx+w.w))<=TH){ax=(o.x-gap-w.w)-it.ox;gx=o.x;}
        if(ay===null&&Math.abs((o.y+o.h+gap)-ny)<=TH){ay=(o.y+o.h+gap)-it.oy;gy=o.y+o.h;}
        if(ay===null&&Math.abs((o.y-gap)-(ny+w.h))<=TH){ay=(o.y-gap-w.h)-it.oy;gy=o.y;}
      }
    });
    clearGuides();
    var fdx=(ax!==null)?ax:(gridOn?snap(dx):Math.round(dx));
    var fdy=(ay!==null)?ay:(gridOn?snap(dy):Math.round(dy));
    if(gx!==null)drawGuide('v',gx);if(gy!==null)drawGuide('h',gy);
    return {dx:fdx,dy:fdy};
  }
  function addCopies(src){if(!src.length)return;var copies=src.map(function(w){var c=JSON.parse(JSON.stringify(w));c.id=uid();c.x=(c.x||0)+16;c.y=(c.y||0)+16;return c;});copies.forEach(function(c){state.widgets.push(c);});sel={};copies.forEach(function(c){sel[c.id]=true;});selId=copies.slice(-1)[0].id;render();renderProps();}
  // Ausrichten / Verteilen (auf die aktuelle Mehrfachauswahl)
  function selWidgets(){return Object.keys(sel).map(widget).filter(Boolean);}
  function alignSel(kind){
    var ws=selWidgets();if(ws.length<2)return;
    var minX=Math.min.apply(null,ws.map(function(w){return w.x;})),maxR=Math.max.apply(null,ws.map(function(w){return w.x+w.w;}));
    var minY=Math.min.apply(null,ws.map(function(w){return w.y;})),maxB=Math.max.apply(null,ws.map(function(w){return w.y+w.h;}));
    ws.forEach(function(w){
      if(kind==='left')w.x=minX;else if(kind==='right')w.x=maxR-w.w;else if(kind==='cx')w.x=Math.round((minX+maxR)/2-w.w/2);
      else if(kind==='top')w.y=minY;else if(kind==='bottom')w.y=maxB-w.h;else if(kind==='cy')w.y=Math.round((minY+maxB)/2-w.h/2);
    });render();renderProps();
  }
  function distributeSel(axis){
    var ws=selWidgets();if(ws.length<3)return;
    if(axis==='h'){ws.sort(function(a,b){return (a.x+a.w/2)-(b.x+b.w/2);});var c0=ws[0].x+ws[0].w/2,c1=ws[ws.length-1].x+ws[ws.length-1].w/2,st=(c1-c0)/(ws.length-1);
      ws.forEach(function(w,i){if(i>0&&i<ws.length-1)w.x=Math.round(c0+st*i-w.w/2);});}
    else{ws.sort(function(a,b){return (a.y+a.h/2)-(b.y+b.h/2);});var d0=ws[0].y+ws[0].h/2,d1=ws[ws.length-1].y+ws[ws.length-1].h/2,st=(d1-d0)/(ws.length-1);
      ws.forEach(function(w,i){if(i>0&&i<ws.length-1)w.y=Math.round(d0+st*i-w.h/2);});}
    render();renderProps();
  }
  function alignSection(){
    var b=function(a,ic,ti){return '<button class="btn" data-al="'+a+'" title="'+ti+'" style="padding:6px;flex:1"><svg class="i"><use href="#ic-'+ic+'"/></svg></button>';};
    return '<div class="prop" style="margin-bottom:10px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Ausrichten &amp; Verteilen ('+Object.keys(sel).length+')</div>'
      +'<div style="display:flex;gap:4px">'+b('left','al-left','Links')+b('cx','al-cx','Horizontal zentrieren')+b('right','al-right','Rechts')+b('top','al-top','Oben')+b('cy','al-cy','Vertikal zentrieren')+b('bottom','al-bottom','Unten')+'</div>'
      +'<div style="display:flex;gap:4px;margin-top:4px">'+b('disth','dist-h','Horizontal verteilen')+b('distv','dist-v','Vertikal verteilen')+'</div></div>';
  }

  canvas.addEventListener('mousedown',function(e){
    if(mode!=='edit')return;
    var el=e.target.closest('.w');
    if(!el){ // Marquee-Auswahl auf leerer Fläche
      var r=canvas.getBoundingClientRect();marq={x0:(e.clientX-r.left)/zoom,y0:(e.clientY-r.top)/zoom,shift:e.shiftKey,el:document.createElement('div')};marq.el.className='marquee';canvas.appendChild(marq.el);
      if(!e.shiftKey){selClear();markSel();renderProps();}
      e.preventDefault();return;
    }
    var w=widget(el.dataset.id);
    if(e.target.dataset.role==='rz'){select(w.id);drag={mode:'rz',w:w,sx:e.clientX,sy:e.clientY,ow:w.w,oh:w.h};e.preventDefault();return;}
    if(e.shiftKey){select(w.id,true);}
    else if(!sel[w.id]){select(w.id);}
    else{selId=w.id;renderProps();}
    drag={mode:'mv',items:Object.keys(sel).map(widget).filter(Boolean).map(function(x){return {w:x,ox:x.x,oy:x.y};}),sx:e.clientX,sy:e.clientY};
    e.preventDefault();
  });
  window.addEventListener('mousemove',function(e){
    if(marq){var r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/zoom,y=(e.clientY-r.top)/zoom,L=Math.min(x,marq.x0),T=Math.min(y,marq.y0),W=Math.abs(x-marq.x0),H=Math.abs(y-marq.y0);marq.el.style.left=L+'px';marq.el.style.top=T+'px';marq.el.style.width=W+'px';marq.el.style.height=H+'px';marq.rect={L:L,T:T,R:L+W,B:T+H};return;}
    if(!drag)return;var dx=(e.clientX-drag.sx)/zoom,dy=(e.clientY-drag.sy)/zoom;
    if(drag.mode==='rz'){drag.w.w=snap(Math.max(40,drag.ow+dx));drag.w.h=snap(Math.max(28,drag.oh+dy));applyGeom(drag.w);badge(e,drag.w.w+' × '+drag.w.h+' px');return;}
    var g=snapAlign(drag.items,dx,dy);
    drag.items.forEach(function(it){it.w.x=Math.max(0,it.ox+g.dx);it.w.y=Math.max(0,it.oy+g.dy);applyGeom(it.w);});
    badge(e,Math.round(drag.items[0].w.x)+' , '+Math.round(drag.items[0].w.y));
  });
  function badge(e,txt){var b=$('#selbadge');b.textContent=txt;b.style.left=(e.clientX+16)+'px';b.style.top=(e.clientY+16)+'px';b.style.display='block';}
  window.addEventListener('mouseup',function(){
    $('#selbadge').style.display='none';
    if(marq){var rc=marq.rect;if(rc){state.widgets.forEach(function(w){if(w.x<rc.R&&w.x+w.w>rc.L&&w.y<rc.B&&w.y+w.h>rc.T)sel[w.id]=true;});}marq.el.remove();marq=null;selId=Object.keys(sel).slice(-1)[0]||null;markSel();renderProps();return;}
    if(drag){clearGuides();renderProps();drag=null;commit();drawStructure();}
  });
