  // ===== Widget: Ring-Gauge (Multi-Donut) =====
  // Mehrere konzentrische Ringe (ECharts „ring gauge") aus je einer Variable. Zwei Modi:
  //   gauge = offener Bogen mit runden Enden (Fortschritt), donut = geschlossener Ring (flach).
  // Winkel (Start/Ende) gelten fuer ALLE Ringe gemeinsam; Min/Max je Ring einzeln.
  function _mrVal(id){var lv=id&&_lastVals[id];if(!lv)return null;var n=parseFloat(String(lv.v).replace(',','.'));return isNaN(n)?null:n;}
  var _MRCOL=['--accent','--ok','--warm','--info','--crit','--accent-2','--muted'];
  function setMultiring(w){
    var ec=_ec[w.id];if(!ec)return;
    var rings=(w.rings||[]).filter(function(r){return r&&r.vid;});
    if(!rings.length){ec.setOption({backgroundColor:'transparent',title:{text:'Ringe konfigurieren',left:'center',top:'middle',textStyle:{color:cssv('--faint'),fontSize:_ecF(w,'title',12),fontWeight:'normal'}},series:[]},true);var lg0=$('.w[data-id="'+w.id+'"] [data-role=mrleg]',canvas);if(lg0)lg0.innerHTML='';return;}
    var donut=(w.mrMode==='donut');
    var start=(w.mrStart!=null&&w.mrStart!=='')?parseFloat(w.mrStart):(donut?90:225);
    var end  =(w.mrEnd  !=null&&w.mrEnd  !=='')?parseFloat(w.mrEnd)  :(donut?-270:-45);
    var n=rings.length, outerR=94, innerLimit=(w.mrCenter&&w.mrCenter!=='off')?40:24;
    // ECharts erwartet die Strichbreite in Pixeln, die Radien stehen aber in Prozent.
    // Deshalb das Ringband erst in Pixel umrechnen (S/2 = halbe kuerzere Kachelkante = 100%),
    // sonst waere die Ringdicke auf jeder Kachelgroesse gleich dick und das Verhaeltnis
    // Dicke zu Abstand kippt. mrWidth bleibt „Anteil des Ringbands".
    var band=(outerR-innerLimit)/n;
    var S=Math.min((w.w||240),(w.h||240));
    var bandPx=(band/100)*(S/2);
    var rw=Math.max(3,bandPx*(w.mrWidth>0?(w.mrWidth/100):0.62));
    var track='rgba(127,127,127,0.16)', series=[];
    rings.forEach(function(r,i){
      var rad=outerR - i*band;
      var val=_mrVal(r.vid), min=(r.min!=null&&r.min!=='')?parseFloat(r.min):0, max=(r.max!=null&&r.max!=='')?parseFloat(r.max):100;
      if(max<=min)max=min+1;
      var col=_skinToCss(r.color)||cssv(_MRCOL[i%_MRCOL.length])||'#00cdab';
      series.push({type:'gauge',center:['50%','50%'],radius:rad+'%',startAngle:start,endAngle:end,min:min,max:max,silent:true,z:2+i,
        progress:{show:true,width:rw,roundCap:!donut,itemStyle:{color:col}},
        axisLine:{roundCap:!donut,lineStyle:{width:rw,color:[[1,track]]}},
        pointer:{show:false},anchor:{show:false},axisTick:{show:false},splitLine:{show:false},axisLabel:{show:false},
        title:{show:false},detail:{show:false},
        data:[{value:(val==null?min:val)}]});
    });
    var opt={backgroundColor:'transparent',animation:!!bcfg().chartAnim,series:series};
    // Mitte: optionaler Text (erster Ringwert oder Label)
    if(w.mrCenter&&w.mrCenter!=='off'){
      var r0=rings[0], v0=_mrVal(r0.vid), ctxt;
      if(w.mrCenter==='value')ctxt=(v0==null?'–':(Math.round(v0*10)/10+'').replace('.',','))+(r0.unit?(' '+r0.unit):'');
      else ctxt=(w.mrCenterText||w.label||'');
      opt.graphic=[{type:'text',left:'center',top:'center',z:20,style:{text:ctxt,fill:cssv('--text'),fontSize:_ecF(w,'title',16),fontWeight:600,fontFamily:'inherit',textAlign:'center'}}];
    }
    ec.setOption(opt,true);
    // Legende (HTML-Overlay, optional): Farbpunkt · Label · Wert
    var lg=$('.w[data-id="'+w.id+'"] [data-role=mrleg]',canvas);
    if(lg){
      if(w.mrLegend){lg.style.display='';
        lg.innerHTML=rings.map(function(r,i){var v=_mrVal(r.vid),col=_skinToCss(r.color)||cssv(_MRCOL[i%_MRCOL.length]);
          return '<span class="mrlgi"><i style="background:'+col+'"></i>'+esc(r.label||('Ring '+(i+1)))+' <b>'+(v==null?'–':((Math.round(v*10)/10+'').replace('.',',')))+(r.unit?(' '+esc(r.unit)):'')+'</b></span>';}).join('');
      } else {lg.style.display='none';lg.innerHTML='';}
    }
  }
  defWidget('multiring',{
    label:'Ring-Gauge', cat:'Diagramme', paletteIcon:'wchart', size:[240,240], noHover:true,
    defaults:function(w){w.mrMode='gauge';w.rings=[{vid:0,label:'Ring 1',min:0,max:100,color:'accent'}];},
    render:function(w){return '<div class="mr" style="position:absolute;inset:0"><div data-role="chart" style="position:absolute;inset:0"></div><div data-role="mrleg" class="mrleg"></div></div>';},
    props:function(w){
      if(w.type!=='multiring')return '';
      var donut=(w.mrMode==='donut');
      var h=row('Modus','<select id="pMrMode"><option value="gauge"'+(!donut?' selected':'')+'>Gauge (offener Bogen)</option><option value="donut"'+(donut?' selected':'')+'>Donut (geschlossen)</option></select>');
      h+='<div class="pgh">Winkel (für alle Ringe)</div>'
        +row('Startwinkel','<input id="pMrStart" type="number" value="'+(w.mrStart!=null?w.mrStart:'')+'" placeholder="'+(donut?90:225)+'"> <span style="font-size:11px;color:var(--muted)">Grad, 3 Uhr = 0, gegen den Uhrzeiger +</span>')
        +row('Endwinkel','<input id="pMrEnd" type="number" value="'+(w.mrEnd!=null?w.mrEnd:'')+'" placeholder="'+(donut?-270:-45)+'">')
        +row('Ringbreite %','<input id="pMrWidth" type="number" min="10" max="100" value="'+(w.mrWidth||'')+'" placeholder="auto"> <span style="font-size:11px;color:var(--muted)">Anteil des Ringbands</span>');
      h+='<div class="pgh">Mitte</div>'
        +row('Anzeige','<select id="pMrCenter"><option value="off"'+((w.mrCenter||'off')==='off'?' selected':'')+'>aus</option><option value="value"'+(w.mrCenter==='value'?' selected':'')+'>Wert 1. Ring</option><option value="text"'+(w.mrCenter==='text'?' selected':'')+'>Text</option></select>')
        +((w.mrCenter==='text')?row('Text','<input id="pMrCenterText" value="'+esc(w.mrCenterText||'')+'" placeholder="'+esc(w.label||'')+'">'):'')
        +row('Legende','<input type="checkbox" id="pMrLeg"'+(w.mrLegend?' checked':'')+'>');
      h+='<div class="pgh">Ringe (außen → innen)</div>'
        +listEditor(w,'rings','Ring: Variable · Label · Min · Max · Einheit · Farbe',[{k:'vid',ph:'ID'},{k:'label',ph:'Label'},{k:'min',ph:'Min'},{k:'max',ph:'Max'},{k:'unit',ph:'Einh.'},{k:'color',type:'skincolor'}]);
      return h;
    },
    wire:function(w){
      function re(){if(_ec[w.id])setMultiring(w);commit();}
      if($('#pMrMode'))$('#pMrMode').onchange=function(){w.mrMode=this.value;render();renderProps();commit();};
      if($('#pMrStart'))$('#pMrStart').oninput=function(){w.mrStart=(this.value===''?undefined:parseFloat(this.value));re();};
      if($('#pMrEnd'))$('#pMrEnd').oninput=function(){w.mrEnd=(this.value===''?undefined:parseFloat(this.value));re();};
      if($('#pMrWidth'))$('#pMrWidth').oninput=function(){w.mrWidth=(this.value===''?undefined:Math.max(10,Math.min(100,parseInt(this.value)||0)));re();};
      if($('#pMrCenter'))$('#pMrCenter').onchange=function(){w.mrCenter=this.value;render();renderProps();commit();};
      if($('#pMrCenterText'))$('#pMrCenterText').oninput=function(){w.mrCenterText=this.value||undefined;re();};
      if($('#pMrLeg'))$('#pMrLeg').onchange=function(){w.mrLegend=this.checked||undefined;re();};
    },
    live:function(w,el,id,d,base,txt,on){if(_ec[w.id])setMultiring(w);return true;}
  });
