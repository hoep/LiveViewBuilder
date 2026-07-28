  // ===== Widget: Fluss (flow) — generisches Fluss-Schema =====
  //  mode 'hub'      : Quellen -> Zentrum -> Senken  (ehem. 'powerflow', Alias bleibt)
  //  mode 'pipeline' : Stationen in Reihe (Icon-Knoten: Wert oben / Label unten) + animierte Konnektoren
  //  varId = Fluss-Variable  -> Tempo/Farbe/an-aus der Konnektoren (Schwelle/Referenz).
  //  Knoten-/Becken-Werte via data-vid (automatisches Live-Update, kein eigener Code).
  function _flowMode(w){return w.mode||((w.src||w.snk)?'hub':'pipeline');}
  function flowPipeState(w){
    var lv=w.varId&&_lastVals[w.varId], n=lv?parseFloat(String(lv.v).replace(',','.')):NaN;
    var thr=(w.flThr!=null?w.flThr:0), ref=(w.flRef!=null&&w.flRef>0?w.flRef:20);
    var flowing=!isNaN(n)&&Math.abs(n)>thr, mag=isNaN(n)?0:Math.min(1,Math.abs(n)/ref);
    return {flowing:flowing, dur:(1.9-mag*1.4).toFixed(2), rev:(n<0)};
  }
  function applyFlowState(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var pipe=$('[data-role=pipe]',el);if(!pipe)return;
    var st=flowPipeState(w);
    pipe.classList.toggle('noflow',!st.flowing);
    pipe.classList.toggle('rev',st.rev);
    pipe.style.setProperty('--fldur',(st.flowing?st.dur:'1.1')+'s');
  }
  function flowNode(s){
    var val=s.vid?('<span class="flnvtop" data-vid="'+s.vid+'">–</span>')
                 :(s.val?('<span class="flnvtop">'+esc(s.val)+'</span>'):'<span class="flnvtop">&nbsp;</span>');
    var sub=(s.subvid||s.sub)?('<span class="flnsub"'+(s.subvid?' data-vid="'+s.subvid+'"':'')+'>'+esc(s.sub||'')+'</span>'):'';
    return '<span class="flnode">'+val+'<span class="flbox">'+iconSVG(s.icon||'gauge')+'</span><span class="flnlab">'+esc(s.label||'')+sub+'</span></span>';
  }
  function flowConn(){return '<span class="flconn"><i></i></span>';}
  function flowPipeline(w){
    var stages=w.stages||[], parts=[];
    if(w.startArrow)parts.push('<span class="flstart">'+(w.startLabel?'<span class="flslab">'+esc(w.startLabel)+'</span>':'')+'<svg class="flarr" viewBox="0 0 24 24"><path d="M3 12h14M13 6l6 6-6 6"/></svg></span>');
    stages.forEach(function(s,i){if(i>0)parts.push(flowConn());parts.push(flowNode(s));});
    if(w.endTank){parts.push(flowConn());
      parts.push('<span class="fltank"><span class="fltlab">'+esc(w.tankLabel||'Becken')+'</span><span class="fltval"'+(w.tankVid?' data-vid="'+w.tankVid+'"':'')+'>'+(w.tankVal?esc(w.tankVal):'–')+'</span>'
        +'<span class="flwave"><svg viewBox="0 0 120 20" preserveAspectRatio="none"><path d="M0 11 Q15 3 30 11 T60 11 T90 11 T120 11 T150 11 T180 11 T210 11 T240 11"/><path d="M0 15 Q15 8 30 15 T60 15 T90 15 T120 15 T150 15 T180 15 T210 15 T240 15"/></svg></span></span>');}
    return '<div class="flpipe'+(w.flDir==='v'?' v':'')+'" data-role="pipe" style="--flcol:'+esc(w.flPos||'#00cdab')+'">'+parts.join('')+'</div>';
  }
  // ===== energy-Modus (Power-Flow-Card-Plus-Stil): Home-Knoten + frei konfigurierbare Kreis-Elemente =====
  var _EF_W=400,_EF_H=300,_EF_HX=200,_EF_HY=150,_EF_RH=40,_EF_RN=32;
  function _et(t){t=(t||'').toString().toLowerCase();return {batterie:'battery',akku:'battery',netz:'grid',solar:'pv',pv:'pv',load:'verbraucher',verbrauch:'verbraucher',consumer:'verbraucher'}[t]||t;}
  function _efDefIcon(t){return t==='pv'?'solarpanel':t==='grid'?'pylon':t==='battery'?'battery':t==='verbraucher'?'plug':'gauge';}
  function _efIcon(id){var e=ICONS[id]||ICONS.gauge;return e?e[1]:'';}
  function _energyLayout(w){
    var els=w.elements||[],by={pv:[],grid:[],battery:[],verbraucher:[],other:[]},pos=[];
    els.forEach(function(e,i){(by[_et(e.type)]||by.other).push({e:e,i:i});});
    function sp(n,k,a,b){return n<=1?(a+b)/2:a+(b-a)*k/(n-1);}
    function place(list,fn){list.forEach(function(o,k){var p=fn(k,list.length);pos[o.i]={x:(o.e.x!=null&&o.e.x!==''?+o.e.x:p.x),y:(o.e.y!=null&&o.e.y!==''?+o.e.y:p.y)};});}
    place(by.pv,         function(k,n){return {x:sp(n,k,92,308),y:48};});
    place(by.grid,       function(k,n){return {x:48,y:sp(n,k,98,202)};});
    place(by.battery,    function(k,n){return {x:sp(n,k,120,280),y:252};});
    place(by.verbraucher,function(k,n){return {x:352,y:sp(n,k,90,210)};});
    place(by.other,      function(k,n){return {x:sp(n,k,120,280),y:252};});
    return pos;
  }
  function _efPath(nx,ny){
    var dx=_EF_HX-nx,dy=_EF_HY-ny;
    if(Math.abs(dx)>=Math.abs(dy)){var mx=(nx+_EF_HX)/2;return 'M'+nx+' '+ny+' C'+mx+' '+ny+' '+mx+' '+_EF_HY+' '+_EF_HX+' '+_EF_HY;}
    var my=(ny+_EF_HY)/2;return 'M'+nx+' '+ny+' C'+nx+' '+my+' '+_EF_HX+' '+my+' '+_EF_HX+' '+_EF_HY;
  }
  function _efNode(x,y,r,col,icon,name,type,idx){
    var g='<g class="efnode" transform="translate('+x+','+y+')">';
    g+='<text class="efname" y="'+(-r-9)+'">'+esc(name||'')+'</text>';
    if(type==='battery')g+='<text class="efsoc" data-role="efsoc-'+idx+'" y="'+(-r*0.5)+'"></text>';
    g+='<circle class="efring" r="'+r+'" style="stroke:'+col+'"/>';
    g+='<svg class="eficon" x="-11" y="'+((type==='battery'?-2:-r*0.5-1))+'" width="22" height="22" viewBox="0 0 24 24">'+_efIcon(icon)+'</svg>';
    g+='<text class="efval" data-role="efval-'+idx+'" y="'+(r*0.5)+'">–</text>';
    g+='<text class="efval2" data-role="efval2-'+idx+'" y="'+(r*0.5+11)+'"></text>';
    return g+'</g>';
  }
  function energySVG(w){
    var pos=_energyLayout(w),els=w.elements||[];
    var s='<svg class="efsvg" viewBox="0 0 '+_EF_W+' '+_EF_H+'" preserveAspectRatio="xMidYMid meet">';
    els.forEach(function(e,i){var p=pos[i];if(!p)return;var col=e.color||'var(--accent)',d=_efPath(p.x,p.y);
      s+='<path class="efwire" d="'+d+'" style="stroke:'+col+'"/>'
        +'<path class="efflow" data-role="efflow-'+i+'" d="'+d+'" style="stroke:'+col+';opacity:0"/>'
        +'<circle class="efdot" data-role="efdot-'+i+'" r="4" style="fill:'+col+';offset-path:path(\''+d+'\');opacity:0"/>';
    });
    s+=_efNode(_EF_HX,_EF_HY,_EF_RH,(w.homeColor||'var(--accent)'),w.homeIcon||'housepower',w.homeName||'Home','home','h');
    els.forEach(function(e,i){var p=pos[i];if(!p)return;s+=_efNode(p.x,p.y,_EF_RN,(e.color||'var(--accent)'),e.icon||_efDefIcon(_et(e.type)),e.name||e.type||'',_et(e.type),i);});
    return s+'</svg>';
  }
  function _efNum(vid){var d=vid&&_lastVals[vid];return d?parseFloat(String(d.v).replace(',','.')):NaN;}
  function _efFmtW(v){if(v==null||isNaN(v))return '–';try{return Math.round(Math.abs(v)).toLocaleString('de-DE')+' W';}catch(e){return Math.round(Math.abs(v))+' W';}}
  function refreshEnergy(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;var els=w.elements||[],homeIn=0;
    els.forEach(function(e,i){
      var t=_et(e.type),p=_efNum(e.vid),mag=isNaN(p)?0:Math.abs(p),dir=(t==='pv')?1:(t==='verbraucher')?-1:((p<0)?-1:1),active=mag>1;
      var v1=$('[data-role=efval-'+i+']',el),v2=$('[data-role=efval2-'+i+']',el);
      if(t==='grid'||t==='battery'){var into=Math.max(isNaN(p)?0:p,0),out=Math.max(isNaN(p)?0:-p,0),A=(t==='grid')?['→ ','← ']:['↑ ','↓ '];
        if(v1)v1.textContent=A[0]+_efFmtW(into);if(v2)v2.textContent=A[1]+_efFmtW(out);}
      else{if(v1)v1.textContent=_efFmtW(mag);if(v2)v2.textContent='';}
      if(t==='battery'&&e.socVid){var soc=_efNum(e.socVid),se=$('[data-role=efsoc-'+i+']',el);if(se)se.textContent=isNaN(soc)?'':(Math.round(soc)+'%');}
      var flow=$('[data-role=efflow-'+i+']',el),dot=$('[data-role=efdot-'+i+']',el);
      var spd=e.speedVid?_efNum(e.speedVid):mag;if(isNaN(spd))spd=mag;
      var ref=e.speedVid?(+e.speedRef||100):(+w.efRef||3000),frac=Math.min(1,Math.abs(spd)/(ref||1)),dur=(2.4-frac*1.9).toFixed(2),rev=(dir<0?'reverse':'normal');
      if(flow){flow.style.opacity=active?'':'0';flow.style.animationDuration=dur+'s';flow.style.animationDirection=rev;}
      if(dot){dot.style.opacity=active?'':'0';dot.style.animationDuration=dur+'s';dot.style.animationDirection=rev;}
      if(dir>0)homeIn+=mag;
    });
    var hv=$('[data-role=efval-h]',el);if(hv){var hp=w.homeVid?_efNum(w.homeVid):NaN;hv.textContent=_efFmtW(isNaN(hp)?homeIn:hp);}
  }
  defWidget('flow',{
    label:'Fluss', paletteIcon:'wsankey', size:[560,168],
    defaults:function(w){w.mode='pipeline';w.flPos='#00cdab';w.flRef=20;w.endTank=1;w.tankLabel='Becken';w.startArrow=1;
      w.stages=[{icon:'valve',label:'Ventil',vid:0},{icon:'pump',label:'Pumpe',vid:0},{icon:'filter',label:'Filter',vid:0},{icon:'droplet',label:'pH',vid:0},{icon:'bolt',label:'Redox',vid:0},{icon:'gauge',label:'Durchfluss',vid:0}];},
    render:function(w){var m=_flowMode(w);return m==='hub'?powerflowSVG(w):m==='energy'?energySVG(w):flowPipeline(w);},
    props:function(w){
      var m=_flowMode(w);
      var h=row('Modus','<select id="pFlMode"><option value="pipeline"'+(m==='pipeline'?' selected':'')+'>Pipeline (Reihe)</option><option value="energy"'+(m==='energy'?' selected':'')+'>Energie (Power-Flow)</option><option value="hub"'+(m==='hub'?' selected':'')+'>Hub (Quellen→Zentrum→Senken)</option></select>');
      if(m==='hub')return h+listEditor(w,'src','Quellen: Name · ID',[{k:'label',ph:'Name'},{k:'vid',ph:'ID'}])+listEditor(w,'snk','Senken: Name · ID',[{k:'label',ph:'Name'},{k:'vid',ph:'ID'}]);
      if(m==='energy')return h
        +'<div class="pgh">Home-Knoten</div>'
        +row('Name / Icon','<input id="pEfHN" value="'+esc(w.homeName||'Home')+'" style="width:88px"> <input id="pEfHI" value="'+esc(w.homeIcon||'housepower')+'" placeholder="icon" style="width:88px">')
        +row('Farbe / Wert-ID','<input type="color" id="pEfHC" value="'+(w.homeColor||'#00cdab')+'"> <input id="pEfHV" value="'+(w.homeVid||'')+'" placeholder="leer = Summe" style="width:110px">')
        +row('Referenz-Leistung (Tempo)','<input id="pEfRef" type="number" value="'+(w.efRef||3000)+'" placeholder="W bei max Tempo">')
        +'<div class="pgh">Elemente — Typ: pv · grid · batterie · verbraucher (Leistung ±: + = →Home)</div>'
        +listEditor(w,'elements','Typ · Name · Icon · Farbe · Leistung-ID · Speed-ID · SoC-ID',[{k:'type',ph:'typ'},{k:'name',ph:'Name'},{k:'icon',ph:'icon'},{k:'color',ph:'#hex'},{k:'vid',ph:'Leist-ID'},{k:'speedVid',ph:'Speed'},{k:'socVid',ph:'SoC'}]);
      return h
        +'<div class="pgh">Fluss (Variable = „Variable" oben)</div>'
        +row('Farbe','<input type="color" id="pFlCol" value="'+(w.flPos||'#00cdab')+'">')
        +row('Schwelle / Referenz','<input id="pFlThr" type="number" step="0.1" style="width:72px" value="'+(w.flThr!=null?w.flThr:0)+'"> <input id="pFlRef" type="number" step="0.1" style="width:72px" value="'+(w.flRef!=null?w.flRef:20)+'" placeholder="max Tempo">')
        +row('Ausrichtung','<select id="pFlDir"><option value="h"'+(w.flDir!=='v'?' selected':'')+'>Horizontal</option><option value="v"'+(w.flDir==='v'?' selected':'')+'>Vertikal</option></select>')
        +'<div class="pgh">Endpunkte</div>'
        +row('Eingangs-Pfeil','<input type="checkbox" id="pFlStart"'+(w.startArrow?' checked':'')+'> <input id="pFlStartL" value="'+esc(w.startLabel||'')+'" placeholder="Label" style="width:110px">')
        +row('Becken-Knoten','<input type="checkbox" id="pFlTank"'+(w.endTank?' checked':'')+'> <input id="pFlTankL" value="'+esc(w.tankLabel||'')+'" placeholder="Label" style="width:84px"> <input id="pFlTankV" value="'+(w.tankVid||'')+'" placeholder="Wert-ID" style="width:70px">')
        +'<div class="pgh">Stationen</div>'
        +listEditor(w,'stages','Icon · Label · Wert-ID · Zusatz · Zusatz-ID',[{k:'icon',ph:'icon'},{k:'label',ph:'Label'},{k:'vid',ph:'Wert-ID'},{k:'sub',ph:'Zusatz'},{k:'subvid',ph:'Zus-ID'}]);
    },
    wire:function(w){
      if($('#pFlMode'))$('#pFlMode').onchange=function(){w.mode=this.value;render();renderProps();commit();};
      function b(id,prop,num){var e=$('#'+id);if(!e)return;e.oninput=e.onchange=function(){var v=num?(this.value===''?undefined:parseFloat(this.value)):(this.value||undefined);w[prop]=v;render();applyFlowState(w);commit();};}
      b('pFlCol','flPos');b('pFlThr','flThr',1);b('pFlRef','flRef',1);b('pFlStartL','startLabel');b('pFlTankL','tankLabel');
      if($('#pFlTankV'))$('#pFlTankV').oninput=function(){w.tankVid=parseInt(this.value)||undefined;render();commit();};
      if($('#pFlDir'))$('#pFlDir').onchange=function(){w.flDir=this.value==='v'?'v':undefined;render();applyFlowState(w);commit();};
      if($('#pFlStart'))$('#pFlStart').onchange=function(){w.startArrow=this.checked||undefined;render();commit();};
      if($('#pFlTank'))$('#pFlTank').onchange=function(){w.endTank=this.checked||undefined;render();commit();};
      // energy: Home-Knoten-Felder
      if($('#pEfHN'))$('#pEfHN').oninput=function(){w.homeName=this.value||undefined;render();refreshEnergy(w);commit();};
      if($('#pEfHI'))$('#pEfHI').oninput=function(){w.homeIcon=this.value||undefined;render();refreshEnergy(w);commit();};
      if($('#pEfHC'))$('#pEfHC').oninput=function(){w.homeColor=this.value;render();refreshEnergy(w);commit();};
      if($('#pEfHV'))$('#pEfHV').oninput=function(){w.homeVid=parseInt(this.value)||undefined;render();refreshEnergy(w);commit();};
      if($('#pEfRef'))$('#pEfRef').oninput=function(){w.efRef=parseInt(this.value)||undefined;refreshEnergy(w);commit();};
    },
    mount:function(w){var m=_flowMode(w);if(m==='energy')refreshEnergy(w);else if(m!=='hub')applyFlowState(w);},
    live:function(w,el,id,d,base,txt,on){var m=_flowMode(w);if(m==='energy')refreshEnergy(w);else if(w.varId===id)applyFlowState(w);return true;}
  });
  WIDGETS.powerflow=WIDGETS.flow; // Alias: alte 'powerflow'-Instanzen weiter rendern (Migration setzt sie auf 'flow')
