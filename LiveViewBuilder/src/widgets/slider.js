  // ===== Widget-Familie: Regler (slider) =====
  // Varianten über w.rmode (Vorbild: chart.js/w.ctype, colorpick.js/w.cmode):
  //   'slider'  Schieberegler (horizontal)            — ein Wert, <input type=range>
  //   'range'   Bereichsregler (zwei Griffe, linear)  — varId = unten, varId2 = oben
  //   'circle'  Bereichsregler rund (zwei Griffe)     — varId = unten, varId2 = oben
  //   'stepper' Stepper (+/− Tasten)                  — Schritt = Inkrement je Tastendruck
  //   'dial'    Dial (runder Sollwert-Regler)         — Tippen setzt den Wert
  // Gemeinsame Eigenschaften: w.varId, w.label, w.min, w.max, w.step (zentrale Zeilen pVar/pLabel/pMin/pMax/pStep).
  // Alte Eigenschaftsnamen rsMin/rsMax/rsStep (Bereichsregler) und crMin/crMax/crStep (rund) werden gelesen
  // und beim ersten Zeichnen auf min/max/step umgezogen (_rgMig).
  var RG_SIZE={slider:[220,74],range:[240,72],circle:[150,150],stepper:[160,64],dial:[150,150]};
  var RG_LBL ={slider:'Label',range:'Bereich',circle:'Label',stepper:'Wert',dial:'Sollwert'}; // Default-Beschriftung je Variante
  // Variante auflösen — Alt-Typen bleiben gültig (Alias-Registrierung erfolgt später)
  function _rMode(w){return (w&&w.rmode)||{slider:'slider',rangeslider:'range',circlerange:'circle',rangebtn:'stepper',dial:'dial'}[(w&&w.type)||'']||'slider';}

  // ---------------------------------------------------------------- gemeinsame Helfer
  function _rgMig(w){ // einmalige, stille Übernahme der alten Eigenschaftsnamen auf min/max/step
    if(!w)return w;
    if(w.min==null&&w.rsMin!=null)w.min=w.rsMin;
    if(w.max==null&&w.rsMax!=null)w.max=w.rsMax;
    if(w.step==null&&w.rsStep!=null)w.step=w.rsStep;
    if(w.min==null&&w.crMin!=null)w.min=w.crMin;
    if(w.max==null&&w.crMax!=null)w.max=w.crMax;
    if(w.step==null&&w.crStep!=null)w.step=w.crStep;
    return w;
  }
  function _rgMin(w){return (w&&w.min!=null)?w.min:((w&&w.rsMin!=null)?w.rsMin:((w&&w.crMin!=null)?w.crMin:0));}
  function _rgMax(w){return (w&&w.max!=null)?w.max:((w&&w.rsMax!=null)?w.rsMax:((w&&w.crMax!=null)?w.crMax:100));}
  function _rgStep(w){var s=(w&&w.step!=null)?w.step:((w&&w.rsStep!=null)?w.rsStep:((w&&w.crStep!=null)?w.crStep:1));return (s>0)?s:1;}
  function _rgClamp(v,a,b){return v<a?a:(v>b?b:v);}
  function _rgCur(w,id,fb){if(!id)return fb;var lv=_lastVals[id];if(!lv)return fb;var n=parseFloat(String(lv.v).replace(',','.'));return isNaN(n)?fb:n;}

  // ---------------------------------------------------------------- Variante „slider" (Schieberegler)
  function _rgRenderSlider(w){
    return '<div class="hslider"><div class="hsrow"><span class="hsname">'+esc(w.label||'')+'</span><span class="hsval" data-role="val">–</span></div><input class="hsrange" type="range" data-role="range" min="'+(w.min!=null?w.min:0)+'" max="'+(w.max!=null?w.max:100)+'" step="'+(w.step||1)+'" value="0"'+(w.mirror?' style="transform:scaleX(-1)"':'')+'></div>';
  }

  // ---------------------------------------------------------------- Variante „range" (zwei Griffe, linear)
  // eigene Zahl-Darstellung (3 Nachkommastellen), bewusst ohne dec/fmt/pre/suf
  function _rgFmt(v){return String(Math.round(v*1000)/1000);}
  function _rgFrac(w,val){var mn=_rgMin(w),mx=_rgMax(w),sp=(mx-mn)||1;return _rgClamp((val-mn)/sp,0,1);}
  function _rgVal(w,frac){var mn=_rgMin(w),mx=_rgMax(w),st=_rgStep(w);var v=mn+_rgClamp(frac,0,1)*(mx-mn);v=Math.round(v/st)*st;v=_rgClamp(v,mn,mx);return Math.round(v*1000)/1000;}
  function _rgApplyRange(w,el,loO,hiO){
    var mn=_rgMin(w),mx=_rgMax(w);
    var loV=(loO!=null)?loO:_rgCur(w,w.varId,mn);
    var hiV=(hiO!=null)?hiO:_rgCur(w,w.varId2,mx);
    loV=_rgClamp(loV,mn,mx);hiV=_rgClamp(hiV,mn,mx);
    var lf=_rgFrac(w,loV)*100,hf=_rgFrac(w,hiV)*100;
    var tl=$('[data-role=lo]',el);if(tl)tl.style.left=lf+'%';
    var th=$('[data-role=hi]',el);if(th)th.style.left=hf+'%';
    var fl=$('[data-role=fill]',el);if(fl){var a=Math.min(lf,hf),b=Math.max(lf,hf);fl.style.left=a+'%';fl.style.right=(100-b)+'%';}
    var vl=$('[data-role=vlo]',el);if(vl)vl.textContent=_rgFmt(loV);
    var vh=$('[data-role=vhi]',el);if(vh)vh.textContent=_rgFmt(hiV);
  }
  function _rgRenderRange(w){
    var mn=_rgMin(w),mx=_rgMax(w);
    var loV=_rgClamp(_rgCur(w,w.varId,mn),mn,mx),hiV=_rgClamp(_rgCur(w,w.varId2,mx),mn,mx);
    var lf=_rgFrac(w,loV)*100,hf=_rgFrac(w,hiV)*100,a=Math.min(lf,hf),b=Math.max(lf,hf);
    var lbl=w.label?'<span style="color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">'+esc(w.label)+'</span>':'<span></span>';
    var head='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">'+lbl+'<span style="font-family:var(--fm);font-variant-numeric:tabular-nums;font-size:13px;color:var(--text);white-space:nowrap"><b data-role="vlo">'+_rgFmt(loV)+'</b><span style="color:var(--muted)"> – </span><b data-role="vhi">'+_rgFmt(hiV)+'</b></span></div>';
    function thumb(role,left){return '<div data-role="'+role+'" data-rs-thumb="1" style="position:absolute;top:50%;left:'+left+'%;width:22px;height:22px;transform:translate(-50%,-50%);border-radius:50%;background:var(--surface);border:2px solid var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:grab;touch-action:none;z-index:2"></div>';}
    var rail='<div data-role="rail" style="position:absolute;left:11px;right:11px;top:50%;transform:translateY(-50%);height:5px;border-radius:3px;background:var(--surface-2)">'
      +'<div data-role="fill" style="position:absolute;top:0;bottom:0;left:'+a+'%;right:'+(100-b)+'%;background:var(--accent);border-radius:3px"></div>'
      +thumb('lo',lf)+thumb('hi',hf)+'</div>';
    return '<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:8px 12px;box-sizing:border-box">'+head
      +'<div style="position:relative;height:22px">'+rail+'</div></div>';
  }

  // ---------------------------------------------------------------- Variante „circle" (zwei Griffe, rund)
  // 270°-Bogen von 135° bis 405°, Radius 40 im viewBox 0 0 100 100, Mittelpunkt 50/50
  function _rgAng(w,val){var mn=_rgMin(w),mx=_rgMax(w),f=Math.max(0,Math.min(1,(val-mn)/((mx-mn)||1)));return 135+270*f;}
  function _rgValAt(w,ang){var rel=ang-135;while(rel<0)rel+=360;while(rel>=360)rel-=360;if(rel>270)rel=(rel>315?0:270);var mn=_rgMin(w),mx=_rgMax(w),st=_rgStep(w),v=mn+(rel/270)*(mx-mn);v=Math.round(v/st)*st;return Math.max(mn,Math.min(mx,Math.round(v*1000)/1000));}
  function _rgPt(ang,r){var a=ang*Math.PI/180;return [(50+r*Math.cos(a)),(50+r*Math.sin(a))];}
  function _rgArc(a0,a1,r){var p0=_rgPt(a0,r),p1=_rgPt(a1,r),large=((a1-a0)>180)?1:0;return 'M'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+' A'+r+' '+r+' 0 '+large+' 1 '+p1[0].toFixed(1)+' '+p1[1].toFixed(1);}
  function _rgApplyCircle(w,el,loO,hiO){
    var mn=_rgMin(w); // rund: fehlender Wert fällt IMMER auf Minimum (anders als linear, dort oben -> Maximum)
    var loV=(loO!=null)?loO:_rgCur(w,w.varId,mn),hiV=(hiO!=null)?hiO:_rgCur(w,w.varId2,mn);
    var la=_rgAng(w,loV),ha=_rgAng(w,hiV),lp=_rgPt(la,40),hp=_rgPt(ha,40);
    var seg=el.querySelector('[data-role=crseg]');if(seg)seg.setAttribute('d',_rgArc(Math.min(la,ha),Math.max(la,ha),40));
    var lt=el.querySelector('[data-role=lo]');if(lt){lt.setAttribute('cx',lp[0].toFixed(1));lt.setAttribute('cy',lp[1].toFixed(1));}
    var ht=el.querySelector('[data-role=hi]');if(ht){ht.setAttribute('cx',hp[0].toFixed(1));ht.setAttribute('cy',hp[1].toFixed(1));}
    var vt=el.querySelector('[data-role=crval]');if(vt)vt.textContent=(Math.round(loV*10)/10)+' – '+(Math.round(hiV*10)/10);
  }
  function _rgRenderCircle(w){
    var mn=_rgMin(w);
    var loV=_rgCur(w,w.varId,mn),hiV=_rgCur(w,w.varId2,mn),la=_rgAng(w,loV),ha=_rgAng(w,hiV),lp=_rgPt(la,40),hp=_rgPt(ha,40);
    return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
      +'<svg viewBox="0 0 100 100" style="width:100%;height:100%">'
      +'<path d="'+_rgArc(135,405,40)+'" fill="none" stroke="var(--surface-2)" stroke-width="7" stroke-linecap="round"/>'
      +'<path data-role="crseg" d="'+_rgArc(Math.min(la,ha),Math.max(la,ha),40)+'" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round"/>'
      +'<circle data-role="lo" data-cr-thumb="1" cx="'+lp[0].toFixed(1)+'" cy="'+lp[1].toFixed(1)+'" r="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5" style="cursor:grab;touch-action:none"/>'
      +'<circle data-role="hi" data-cr-thumb="1" cx="'+hp[0].toFixed(1)+'" cy="'+hp[1].toFixed(1)+'" r="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5" style="cursor:grab;touch-action:none"/>'
      +'<text data-role="crval" x="50" y="53" text-anchor="middle" fill="var(--text)" font-size="10" font-family="var(--fm)">'+(Math.round(loV*10)/10)+' – '+(Math.round(hiV*10)/10)+'</text>'
      +(w.label?'<text x="50" y="66" text-anchor="middle" fill="var(--muted)" font-size="7">'+esc(w.label)+'</text>':'')
      +'</svg></div>';
  }

  // ---------------------------------------------------------------- Variante „stepper" (+/− Tasten)
  function _rgRenderStepper(w){
    function btn(role,ic){return '<button data-role="'+role+'" style="width:34px;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center;touch-action:none"><svg class="i" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><use href="#ic-'+ic+'"/></svg></button>';}
    return '<div style="height:100%;display:flex;align-items:center;gap:8px;padding:6px 10px">'+btn('dec','minus')+'<div style="flex:1;text-align:center;min-width:0"><div data-role="val" style="font-family:var(--fm);font-variant-numeric:tabular-nums;font-size:20px;font-weight:600;line-height:1">–</div>'+(w.label?'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+esc(w.label)+'</div>':'')+'</div>'+btn('inc','plus')+'</div>';
  }

  // ---------------------------------------------------------------- Variante „dial" (runder Sollwert-Regler)
  // Geometrie (_dpt/dialTrack/dialProg) liegt in js/03-render-charts.js — bewusst NICHT hierher verschoben
  function _rgRenderDial(w){
    var dp0=_dpt(135);
    return '<div class="hdial"><svg viewBox="0 0 100 100"><path class="dtrack" d="'+dialTrack()+'"/><path class="dprog" data-role="dprog" d="'+dialProg(0)+'"/><circle class="dthumb" data-role="dthumb" cx="'+dp0[0]+'" cy="'+dp0[1]+'" r="5.5"/></svg><div class="dctr"><div class="dval" data-role="val">–</div><div class="dlbl">'+esc(w.label||'')+'</div></div></div>';
  }

  // ---------------------------------------------------------------- Pointer-Interaktion (einmalig, dokumentweit)
  var _rgDragR=null,_rgDragC=null,_rgT=null;
  function _rgStop(){if(_rgT){clearTimeout(_rgT.d);clearInterval(_rgT.i);_rgT=null;}} // Stepper-Wiederholung beenden
  if(!window._rgWired){window._rgWired=1;
    document.addEventListener('pointerdown',function(e){
      if(mode==='edit')return;
      var cl=function(s){return e.target.closest?e.target.closest(s):null;};
      // 1) Bereichsregler linear — Griff greifen
      var th=cl('[data-rs-thumb]');
      if(th){
        var el=th.closest('.w');if(!el)return;var w=widget(el.dataset.id);if(!w||_rMode(w)!=='range')return;
        _rgDragR={w:w,el:el,role:th.getAttribute('data-role'),rail:th.parentNode,last:0,pid:null,pval:null};
        try{th.setPointerCapture(e.pointerId);}catch(_){}
        e.preventDefault();e.stopPropagation();return;
      }
      // 2) Bereichsregler rund — Griff greifen (bewusst OHNE setPointerCapture)
      var ct=cl('[data-cr-thumb]');
      if(ct){
        var el2=ct.closest('.w');if(!el2)return;var w2=widget(el2.dataset.id);if(!w2||_rMode(w2)!=='circle')return;
        _rgDragC={w:w2,el:el2,role:ct.getAttribute('data-role'),svg:el2.querySelector('svg'),last:0,pid:null,pval:null};
        e.preventDefault();e.stopPropagation();return;
      }
      // 3) Stepper — Tipp = 1 Schritt, Halten = kontinuierlich
      var b=cl('[data-role=inc],[data-role=dec]');
      if(b){
        var el3=b.closest('.w');if(!el3)return;var w3=widget(el3.dataset.id);if(!w3||_rMode(w3)!=='stepper'||!w3.varId)return;
        var inc=b.getAttribute('data-role')==='inc';
        var step=function(){var lv=_lastVals[w3.varId],cur=lv?parseFloat(String(lv.v).replace(',','.')):0;if(isNaN(cur))cur=0;var st=w3.step||1,mn=(w3.min!=null?w3.min:-1e12),mx=(w3.max!=null?w3.max:1e12),nv=Math.max(mn,Math.min(mx,cur+(inc?st:-st)));setVar(w3.varId,Math.round(nv*1000)/1000);};
        step();_rgStop();
        var dly=setTimeout(function(){var iv=setInterval(step,200);_rgT={d:null,i:iv};},420);_rgT={d:dly,i:null};
        try{b.setPointerCapture(e.pointerId);}catch(_){}
        e.preventDefault();e.stopPropagation();return;
      }
    },true);
    document.addEventListener('pointermove',function(e){
      if(_rgDragR){
        var d=_rgDragR,w=d.w,rect=d.rail.getBoundingClientRect();if(!rect.width)return;
        var val=_rgVal(w,(e.clientX-rect.left)/rect.width),mn=_rgMin(w),mx=_rgMax(w);
        if(d.role==='lo'){var hv=_rgCur(w,w.varId2,mx);if(val>hv)val=hv;d.pid=w.varId;d.pval=val;_rgApplyRange(w,d.el,val,null);}
        else{var lv=_rgCur(w,w.varId,mn);if(val<lv)val=lv;d.pid=w.varId2;d.pval=val;_rgApplyRange(w,d.el,null,val);}
        var now=Date.now();if(d.pid&&now-d.last>=110){d.last=now;setVar(d.pid,d.pval);}
        e.preventDefault();return;
      }
      if(_rgDragC){
        var c=_rgDragC,cw=c.w,rb=c.svg.getBoundingClientRect(),cmn=_rgMin(cw);
        var ang=Math.atan2(e.clientY-(rb.top+rb.height/2),e.clientX-(rb.left+rb.width/2))*180/Math.PI;if(ang<0)ang+=360;
        var cval=_rgValAt(cw,ang),cnow=Date.now();
        if(c.role==='lo'){var chv=_rgCur(cw,cw.varId2,cmn);if(cval>chv)cval=chv;c.pid=cw.varId;c.pval=cval;_rgApplyCircle(cw,c.el,cval,null);}
        else{var clv=_rgCur(cw,cw.varId,cmn);if(cval<clv)cval=clv;c.pid=cw.varId2;c.pval=cval;_rgApplyCircle(cw,c.el,null,cval);}
        if(c.pid&&cnow-c.last>=110){c.last=cnow;setVar(c.pid,c.pval);}
        e.preventDefault();return;
      }
    });
    var _rgEnd=function(){
      if(_rgDragR){var d=_rgDragR;_rgDragR=null;if(d.pid&&d.pval!=null)setVar(d.pid,d.pval);} // letzten Wert final schreiben
      if(_rgDragC){var c=_rgDragC;_rgDragC=null;if(c.pid&&c.pval!=null)setVar(c.pid,c.pval);} // neu auch rund (vorher ging der letzte Teilschritt verloren)
      _rgStop();
    };
    document.addEventListener('pointerup',_rgEnd);
    document.addEventListener('pointercancel',_rgEnd);
  }

  // ---------------------------------------------------------------- Registry
  defWidget('slider',{
    label:'Regler', paletteIcon:'wslider', size:RG_SIZE.slider,
    noHover:true, // Klick-Hook gilt nur der Dial-Variante; die übrigen Varianten sollen keinen Ganz-Widget-Hover bekommen
    defaults:function(w){w.rmode='slider';w.min=0;w.max=100;w.step=1;},
    render:function(w){
      _rgMig(w);
      switch(_rMode(w)){
        case 'range':   return _rgRenderRange(w);
        case 'circle':  return _rgRenderCircle(w);
        case 'stepper': return _rgRenderStepper(w);
        case 'dial':    return _rgRenderDial(w);
        default:        return _rgRenderSlider(w);
      }
    },
    // Dial: Tippen setzt den Wert (früher zentral in js/05-interaction.js)
    click:function(w,el,e){
      if(_rMode(w)!=='dial'||!w.varId)return false;
      if(w.closePopup||w.popupTo||w.scriptId||w.openMenu||w.navBack||w.navTo||(w.regSlot&&w.regView))return false; // Reihenfolge wie bisher: Popup/Seite/Skript zuerst
      var dsv=el.querySelector('svg');if(!dsv)return false;
      var rb=dsv.getBoundingClientRect(),ccx=rb.left+rb.width/2,ccy=rb.top+rb.height/2,ang=Math.atan2(e.clientY-ccy,e.clientX-ccx)*180/Math.PI;if(ang<0)ang+=360;
      var rel=ang-135;if(rel<0)rel+=360;
      if(rel<=270){var dmn=(w.min!=null?w.min:0),dmx=(w.max!=null?w.max:100),st=w.step||1,dval=dmn+(rel/270)*(dmx-dmn);dval=Math.round(dval/st)*st;setVar(w.varId,dval);}
      return true; // Kette abbrechen (auch in der Lücke unten)
    },
    props:function(w){
      _rgMig(w);
      var rm=_rMode(w);
      var GRP=[['Linear',[['slider','Schieberegler (horizontal)'],['range','Bereichsregler (zwei Griffe, horizontal)'],['stepper','Stepper (+/− Tasten)']]],
               ['Rund',  [['dial','Dial (runder Sollwert-Regler)'],['circle','Bereichsregler rund (zwei Griffe)']]]];
      var h=row('Regler-Typ','<select id="pRMode">'+GRP.map(function(g){return '<optgroup label="'+g[0]+'">'+g[1].map(function(o){return '<option value="'+o[0]+'"'+(rm===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</optgroup>';}).join('')+'</select>');
      h+='<div class="pgh">Regler-Optionen</div>';
      if(rm==='range'||rm==='circle'){
        h+=row('Oben (Var)','<input id="pRgVar2" value="'+(w.varId2||'')+'" placeholder="ID"> <button class="btn" id="pRgPick2" style="padding:6px 8px">wählen</button>')
          +'<div class="hint" style="font-size:11px;color:var(--muted);margin:-2px 0 6px">Die Zeile „Variable" oben ist der untere Wert. Die Anzeige nutzt eine eigene Formatierung.</div>';
      }
      if(rm==='slider')h+=row('Spiegeln','<input type="checkbox" id="pSMirror"'+(w.mirror?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Skala umkehren</span>');
      if(rm==='stepper'||rm==='dial')h+=row('Nachkommastellen','<input id="pRgDec" type="number" min="0" max="6" value="'+(w.dec!=null?w.dec:'')+'" placeholder="Standard">');
      if(rm==='stepper')h+='<div class="hint" style="font-size:11px;color:var(--muted);margin:-2px 0 6px">„Schritt" ist das Inkrement je Tastendruck, „Min/Max" sind die Klemmgrenzen.</div>';
      if(rm==='dial')h+='<div class="hint" style="font-size:11px;color:var(--muted);margin:-2px 0 6px">Tippen setzt den Wert (kein Ziehen).</div>';
      return h;
    },
    wire:function(w){
      if($('#pRMode'))$('#pRMode').onchange=function(){
        var alt=_rMode(w),neu=this.value;
        if(alt!==neu){
          var sa=RG_SIZE[alt]||RG_SIZE.slider,sn=RG_SIZE[neu]||RG_SIZE.slider;
          if(w.w===sa[0]&&w.h===sa[1]){w.w=sn[0];w.h=sn[1];}                      // Variantengröße nur übernehmen, solange die alte unverändert war
          if((w.label||'')===(RG_LBL[alt]||'Label'))w.label=RG_LBL[neu]||'Label'; // Nutzer-Beschriftung nie überschreiben
          if(neu!=='range'&&neu!=='circle'&&w.varId2)w.varId2=0;                  // zweite Variable gehört nur zu den Zwei-Griff-Varianten
        }
        w.rmode=neu;render();renderProps();commit(); // renderProps ist zwingend, sonst bleiben die alten Optionen stehen
      };
      if($('#pRgVar2'))$('#pRgVar2').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pRgPick2'))$('#pRgPick2').onclick=function(){showTab('vars');_bindTarget2=w.id;};
      if($('#pSMirror'))$('#pSMirror').onchange=function(){w.mirror=this.checked||undefined;render();commit();};
      if($('#pRgDec'))$('#pRgDec').oninput=function(){w.dec=this.value===''?undefined:Math.max(0,Math.min(6,parseInt(this.value)||0));render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();};
    },
    live:function(w,el,id,d,base,txt,on){
      var rm=_rMode(w);
      if(rm==='range'){
        if(_rgDragR&&_rgDragR.el===el)return;                 // nicht während des Ziehens überschreiben
        if(id!==w.varId&&id!==w.varId2)return;
        _rgApplyRange(w,el);return;
      }
      if(rm==='circle'){
        if(_rgDragC&&_rgDragC.el===el)return;
        _rgApplyCircle(w,el);return;                          // ohne ID-Filter (wie bisher)
      }
      if(rm==='stepper'){var bv=$('[data-role=val]',el);if(bv)bv.textContent=txt;return;}
      if(rm==='dial'){
        if(w.varId!==id)return;
        var dvv=$('[data-role=val]',el);if(dvv)dvv.textContent=txt;
        var dmn=(w.min!=null?w.min:0),dmx=(w.max!=null?w.max:100),dnv=parseFloat(String(d.v).replace(',','.'));
        if(!isNaN(dnv)){var dfr=Math.max(0,Math.min(1,(dnv-dmn)/((dmx-dmn)||1))),pp=$('[data-role=dprog]',el);if(pp)pp.setAttribute('d',dialProg(dfr));var th=$('[data-role=dthumb]',el);if(th){var pt=_dpt(135+270*dfr);th.setAttribute('cx',pt[0]);th.setAttribute('cy',pt[1]);}}
        return;
      }
      var sv=$('[data-role=val]',el);if(sv)sv.textContent=txt;
      var r=$('[data-role=range]',el);if(r&&document.activeElement!==r)r.value=parseFloat(d.v); // nicht überschreiben, solange gezogen wird
    }
  });
