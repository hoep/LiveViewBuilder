  // ===== Widget: Wertkarte (valuecard) — generische Karte, unabhaengige Merkmale =====
  //  Slots: Icon/Titel (oben-links) · Toggle ODER Badge (oben-rechts) · Grosswert+Einheit
  //         · Caption (=Label) · Bereichs-Leiste (Min/Max) · Fortschrittsbalken · Auswahl-Knoepfe
  //  Die Merkmale sind UNABHAENGIG kombinierbar (Dosier-Karte = Toggle + Balken, Filterzeit = Akzent + Balken + Badge):
  //    varId  = Hauptwert · varId2 = Toggle (oder Akzent bei v2acc, oder Minimum bei rngOn) · varId3 = Balken/Maximum
  //    rngOn  = Bereichsmodus (Var2=Min, Var3=Max) · barOn = Fortschrittsbalken · okMin/okMax = Zielbereich-Badge
  //    vcMode='select' = Auswahl-Modus: Profil-Zuordnungen von Var1 als schaltbare Knoepfe (ersetzt Toggle/Badge/Balken)
  //  „Darstellung" in den Eigenschaften ist nur ein Schnell-Preset, das diese Flags setzt.
  function _vcNorm(x){var s=String(x==null?'':x).toLowerCase().trim();if(s==='true'||s==='on')return '1';if(s==='false'||s==='off')return '0';return s;}
  function _vcSel(w){return w.vcMode==='select';}
  function _vcMode(w){ // abgeleiteter Modus (nur fuer die „Darstellung"-Vorauswahl in den Eigenschaften)
    if(w.vcMode)return w.vcMode;
    if(w.rngOn)return 'range';
    if(w.barOn)return 'bar';
    if(w.okMin!=null||w.okMax!=null)return 'target';
    if(w.varId2&&!w.v2acc)return 'toggle';
    return 'value';
  }
  function _vcState(w,el){ // Farbe nach Zustand: Var2 (Status) bevorzugt, sonst Hauptwert; true/false -> 1/0
    if(!(w.vassoc&&w.vassoc.length))return;
    var srcs=[w.varId2,w.varId],m=null,i;
    for(i=0;i<srcs.length&&!m;i++){if(!srcs[i]||!_lastVals[srcs[i]])continue;m=stateHit(w.vassoc,_lastVals[srcs[i]].v);}
    var v=$('[data-role=val]',el),c=(m&&m.color)?(_skinColor(m.color)||m.color):'';
    if(w.vaFill){el.classList.remove('vc-acc');
      if(c){var _t=stateTint(c);el.style.background=_t.bg;el.style.borderColor=_t.bd;if(v)v.style.color=_t.val;}
      else{el.style.background=w.bg||'';el.style.borderColor='';if(v)v.style.color='';}
    }else if(v)v.style.color=c;
  }
  // ---- Auswahl-Modus: Profil-Zuordnungen (?api=assoc) als Knoepfe, schaltet Var1 ----
  var _vcAssoc={}, _vcWait={};
  function _vcOpts(w){return w.varId?(_vcAssoc[w.varId]||null):[];}
  function _vcSelBody(w){
    var opts=_vcOpts(w);
    if(opts===null)return '<div class="hsel hvcsel"><button class="hselb">…</button></div>';
    if(!opts.length)return '<div class="hvcselempty">keine Auswahlwerte im Profil</div>';
    return '<div class="hsel hvcsel">'+opts.map(function(o){
      return '<button class="hselb" data-selval="'+esc(String(o.value!=null?o.value:''))+'"'+(o.color?' style="--sc:'+esc(o.color)+'"':'')+'>'+esc(o.text||String(o.value))+'</button>';
    }).join('')+'</div>';
  }
  function _vcSelMark(w,el,v){$$('.hvcsel .hselb',el).forEach(function(b){b.classList.toggle('on',String(b.getAttribute('data-selval'))===String(v));});}
  function _vcSelPaint(w,root){var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;var host=$('[data-role=vcselhost]',el);if(!host)return;host.innerHTML=_vcSelBody(w);var d=w.varId&&_lastVals[w.varId];if(d)_vcSelMark(w,el,d.v);}
  function _vcSelLoad(w,root){
    if(!w.varId)return;
    if(_vcAssoc[w.varId]){_vcSelPaint(w,root);return;}
    if(_vcWait[w.varId]){_vcWait[w.varId].push([w,root]);return;}
    _vcWait[w.varId]=[[w,root]];
    fetch('?api=assoc&id='+w.varId,{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){_vcAssoc[w.varId]=(j&&j.assocs||[]).map(function(a){return {value:a.v,text:a.name,color:a.color||''};});(_vcWait[w.varId]||[]).forEach(function(p){_vcSelPaint(p[0],p[1]);});delete _vcWait[w.varId];})
      .catch(function(){delete _vcWait[w.varId];});
  }
  // ---- Live-Vergleich gegen eine Soll-/Vergleichs-Variable (cmpVid): Pille mit Abweichung ----
  function _vcCmp(w,el){
    if(!w.cmpVid)return;
    var pill=$('[data-role=cmp]',el);if(!pill)return;
    var a=_lastVals[w.varId],b=_lastVals[w.cmpVid];
    var na=a?parseFloat(String(a.v).replace(',','.')):NaN,nb=b?parseFloat(String(b.v).replace(',','.')):NaN;
    if(isNaN(na)||isNaN(nb)){pill.className='hvcmuted';pill.innerHTML='–';return;}
    var diff=na-nb,mode=w.cmpMode||'pct';
    var metric=(mode==='abs')?diff:(nb!==0?diff/nb*100:0);
    var tol=(w.cmpTol!=null)?w.cmpTol:10;
    var arrow=diff>0?'▲ ':(diff<0?'▼ ':'→ ');
    var num=Math.round(((mode==='abs')?diff:metric)*10)/10;
    var txt=(num>0?'+':'')+num+(mode==='abs'?'':' %')+(w.cmpText?(' '+w.cmpText):'');
    pill.className='hpill '+(Math.abs(metric)<=tol?'ok':'warn');
    pill.innerHTML='<span class="hpd"></span>'+esc(arrow+txt);
  }
  defWidget('valuecard',{
    label:'Wertkarte', paletteIcon:'wkpi', size:[240,120],
    defaults:function(w){w.icon='home';w.label='Wert';w.unit='';w.badgeState='ok';},
    render:function(w){
      var isSel=_vcSel(w);
      var icon=w.icon?'<span class="hkbi">'+iconSVG(w.icon)+'</span>':'';
      var title=w.title?'<span class="hvctitle">'+esc(w.title)+'</span>':'';
      var tr='';
      // oben-rechts: Toggle (Var2, kein Akzent, kein Bereich) hat Vorrang; sonst Badge
      if(!isSel&&w.varId2&&!w.v2acc&&!w.rngOn){
        var onC=w.swOn?_cssColorOrEmpty(w.swOn):'',offC=w.swOff?_cssColorOrEmpty(w.swOff):'';
        var sty=(onC?('--sw-on:'+onC+';'):'')+(offC?('--sw-off:'+offC+';'):'');
        var knob='<i class="swk">'+(w.swOffIcon?'<span class="swi swi-off">'+iconSVG(w.swOffIcon)+'</span>':'')+(w.swOnIcon?'<span class="swi swi-on">'+iconSVG(w.swOnIcon)+'</span>':'')+'</i>';
        tr='<span class="sw" data-role="sw"'+(sty?(' style="'+sty+'"'):'')+'>'+knob+'</span>';
      }else if(!isSel&&w.cmpVid){
        tr='<span class="hpill ok" data-role="cmp"><span class="hpd"></span>…</span>';
      }else if(!isSel&&(w.badge||w.okMin!=null||w.okMax!=null)){
        var st=w.badgeState||'ok';
        if(st==='muted')tr='<span class="hvcmuted" data-role="badge">'+esc(w.badge||'')+'</span>';
        else tr='<span class="hpill '+esc(st)+'" data-role="badge"><span class="hpd"></span>'+esc(w.badge||'')+'</span>';
      }
      var val='<div class="hvcval"><span data-role="val">–</span>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</div>';
      var cap=w.label?'<div class="hvccap">'+escL(w.label)+'</div>':'';
      var bar=(!isSel&&w.barOn)?('<div class="hvcbar"><div class="btrack"><i data-role="bar"></i></div>'+((w.barCap!=null&&w.barCap!=='')?'<div class="hvcbarcap" data-role="barcap">'+esc(w.barCap)+'</div>':'')+'</div>'):'';
      var rng=(!isSel&&w.rngOn)?('<div class="hvcrng"><span class="rmin" data-role="rmin">–</span><span class="rtrack"><i class="rdot" data-role="rdot"></i></span><span class="rmax" data-role="rmax">–</span></div>'):'';
      var sel=isSel?('<div class="hvcselhost" data-role="vcselhost">'+_vcSelBody(w)+'</div>'):'';
      return '<div class="hvcard" data-role="card"><div class="hvctop"><div class="hvctl">'+icon+title+'</div>'+tr+'</div>'+val+cap+rng+bar+sel+'</div>';
    },
    mount:function(w){if(_vcSel(w))_vcSelLoad(w);if(w.cmpVid){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_vcCmp(w,el);}},
    props:function(w){if(w.type!=='valuecard')return '';
      var vm=_vcMode(w);
      var MODES=[['value','Einfacher Wert'],['target','Zielbereich (Badge)'],['range','Bereich Min–Max'],['bar','Balken'],['toggle','Schalter'],['select','Auswahl (schaltbar)']];
      var s=row('Darstellung (Preset)','<select id="pVcMode">'+MODES.map(function(o){return '<option value="'+o[0]+'"'+(vm===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 7px">Setzt die passenden Optionen unten. Merkmale sind frei kombinierbar (z. B. Schalter + Balken).</div>'
        +row('Titel (oben-links)','<input id="pVcTitle" value="'+esc(w.title||'')+'" placeholder="statt/neben Icon">')
        +row('Einheit','<input id="pVcUnit" value="'+esc(w.unit||'')+'" style="width:100px">');
      if(_vcSel(w)){
        return s+'<div style="font-size:11px;color:var(--muted);margin:6px 2px 4px">Auswahl-Modus: Knöpfe kommen aus den Profil-Zuordnungen von <b>Var 1</b> (RequestAction bei schaltbarer Variable). Ersetzt Toggle/Badge/Balken.</div>'
          +'<div class="pgh">Farbe nach Zustand</div>'
          +listEditor(w,'vassoc','Zustand · Farbe',[{k:'v',ph:'z. B. 1'},{k:'color',type:'skincolor'}])
          +row('Ganze Kachel einfärben','<input type="checkbox" id="pVcVaFill"'+(w.vaFill?' checked':'')+'>');
      }
      // Bereichsmodus
      s+='<div class="pgh">Bereich Min/Max</div>'
        +row('Bereich zeigen','<input type="checkbox" id="pVcRng"'+(w.rngOn?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Var 2 = Min, Var 3 = Max</span>')
        +(w.rngOn?('<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">Farbstufen der Leiste (Wert in der Einheit der Variable, z. B. 30 für 30 °C). Leer = Temperaturskala.</div>'
          +listEditor(w,'rngGrad','Farbstufen: Wert · Farbe',[{k:'v',ph:'Wert'},{k:'color',type:'skincolor'}])):'');
      // Badge / Zielbereich (nur ohne Bereichsmodus sinnvoll)
      if(!w.rngOn){
        s+='<div class="pgh">Badge (oben-rechts)</div>'
          +row('Text','<input id="pVcBadge" value="'+esc(w.badge||'')+'" placeholder="OPTIMAL / Filtert / Soll 27,0">')
          +row('Zustand','<select id="pVcBst">'
            +['muted|grau (nur Text)','ok|OK (grün)','warm|Aktiv (orange)','warn|Warnung (gelb)','crit|Kritisch (rot)','on|Akzent'].map(function(o){var p=o.split('|');return '<option value="'+p[0]+'"'+((w.badgeState||'ok')===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join('')+'</select>')
          +row('Auto aus Zielbereich','<input id="pVcOkMin" type="number" step="0.1" style="width:74px" value="'+(w.okMin!=null?w.okMin:'')+'" placeholder="min"> <input id="pVcOkMax" type="number" step="0.1" style="width:74px" value="'+(w.okMax!=null?w.okMax:'')+'" placeholder="max">')
          +((w.okMin!=null||w.okMax!=null)?row('Badge im/außer Bereich','<input id="pVcOkT" value="'+esc(w.okText||'OPTIMAL')+'" style="width:90px"> <input id="pVcBadT" value="'+esc(w.badText||'PRÜFEN')+'" style="width:90px">'):'');
      }
      // Vergleich / Soll (live Abweichung als Pille oben-rechts)
      s+='<div class="pgh">Vergleich / Soll (Abweichung)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Hauptwert = Ist (Var 1). Zeigt die Abweichung zur Soll-Variable als gefärbte Pille. Belegt den Platz oben-rechts (statt Badge).</div>'
        +fieldPick(w,'cmpVid','Soll-Variable')
        +(w.cmpVid?(row('Modus','<select id="pVcCmpMode"><option value="pct"'+((w.cmpMode||'pct')==='pct'?' selected':'')+'>Prozent</option><option value="abs"'+(w.cmpMode==='abs'?' selected':'')+'>Absolut</option></select>')
          +row('Toleranz grün','<input id="pVcCmpTol" type="number" step="0.1" style="width:74px" value="'+(w.cmpTol!=null?w.cmpTol:10)+'"> <span style="font-size:11px;color:var(--muted)">'+(w.cmpMode==='abs'?'in Einheit':'%')+'</span>')
          +row('Zusatztext','<input id="pVcCmpText" value="'+esc(w.cmpText||'')+'" placeholder="ggü. Plan">')):'');
      // Toggle / Akzent (Var2)
      s+='<div class="pgh">Schalter / Akzent (Var 2)</div>'
        +row('Var 2 = Akzent','<input type="checkbox" id="pVcV2acc"'+(w.v2acc?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Kachel leuchtet auf (statt Schalter)</span>');
      if(w.varId2&&!w.v2acc&&!w.rngOn){
        s+=row('Ein-Farbe',skinSel(w.swOn||'','id="pVcSwOn"'))
          +row('Aus-Farbe',skinSel(w.swOff||'','id="pVcSwOff"'))
          +row('Ein-Icon','<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.swOnIcon?iconSVG(w.swOnIcon):'')+'</span> <button class="btn" id="pVcSwOnIco" style="padding:5px 8px">wählen</button>'+(w.swOnIcon?' <button class="btn" id="pVcSwOnIcoX" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''))
          +row('Aus-Icon','<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.swOffIcon?iconSVG(w.swOffIcon):'')+'</span> <button class="btn" id="pVcSwOffIco" style="padding:5px 8px">wählen</button>'+(w.swOffIcon?' <button class="btn" id="pVcSwOffIcoX" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''));
      }
      // Fortschrittsbalken
      s+='<div class="pgh">Fortschrittsbalken</div>'
        +row('Balken zeigen','<input type="checkbox" id="pVcBarOn"'+(w.barOn?' checked':'')+'>')
        +(w.barOn?('<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Quelle = Balken-Var (Var 3), sonst Hauptwert.'+(w.varId3?'':' <span style="color:var(--warm)">— keine Balken-Var gesetzt.</span>')+'</div>'
          +row('Balken min/max','<input id="pVcBarMin" type="number" style="width:74px" value="'+(w.barMin!=null?w.barMin:0)+'"> <input id="pVcBarMax" type="number" style="width:74px" value="'+(w.barMax!=null?w.barMax:100)+'">')
          +row('Text rechts','<input id="pVcBarCap" value="'+esc(w.barCap||'')+'" placeholder="z. B. 81 % Kanister">')):'');
      // Farbe nach Zustand + Kachel füllen
      s+='<div class="pgh">Farbe nach Zustand</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Quelle: Var 2 (Status), sonst Hauptwert. true/false = 1/0.'+(w.vaFill&&w.v2acc?' <span style="color:var(--warm)">— „Var 2 = Akzent" deaktivieren, sonst überlagern!</span>':'')+'</div>'
        +listEditor(w,'vassoc','Zustand · Farbe',[{k:'v',ph:'z. B. 1 / true'},{k:'color',type:'skincolor'}])
        +row('Ganze Kachel einfärben','<input type="checkbox" id="pVcVaFill"'+(w.vaFill?' checked':'')+'>');
      return s;
    },
    wire:function(w){
      if($('#pVcMode'))$('#pVcMode').onchange=function(){var m=this.value; // Preset: passende Flags setzen (Merkmale bleiben frei kombinierbar)
        w.vcMode=(m==='select')?'select':undefined;
        if(m==='range'){w.rngOn=true;w.barOn=undefined;}
        else if(m==='bar'){w.barOn=true;w.rngOn=undefined;}
        else if(m==='value'){w.rngOn=undefined;w.barOn=undefined;w.okMin=undefined;w.okMax=undefined;}
        else if(m==='target'){w.rngOn=undefined;}
        else if(m==='toggle'){w.rngOn=undefined;}
        render();renderProps();commit();};
      function bind(id,prop,num){var e=$('#'+id);if(!e)return;e.oninput=e.onchange=function(){var v=num?(this.value===''?undefined:parseFloat(this.value)):(this.value||undefined);w[prop]=v;render();};}
      bind('pVcTitle','title');bind('pVcUnit','unit');bind('pVcBadge','badge');bind('pVcBarCap','barCap');bind('pVcOkT','okText');bind('pVcBadT','badText');
      bind('pVcOkMin','okMin',1);bind('pVcOkMax','okMax',1);bind('pVcBarMin','barMin',1);bind('pVcBarMax','barMax',1);
      bind('pVcCmpText','cmpText');bind('pVcCmpTol','cmpTol',1);
      if($('#pVcCmpMode'))$('#pVcCmpMode').onchange=function(){w.cmpMode=this.value;render();renderProps();commit();};
      if($('#pVcBst'))$('#pVcBst').onchange=function(){w.badgeState=this.value;render();};
      if($('#pVcRng'))$('#pVcRng').onchange=function(){w.rngOn=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcBarOn'))$('#pVcBarOn').onchange=function(){w.barOn=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcV2acc'))$('#pVcV2acc').onchange=function(){w.v2acc=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcSwOn'))$('#pVcSwOn').onchange=function(){w.swOn=this.value||undefined;render();renderProps();commit();};
      if($('#pVcSwOff'))$('#pVcSwOff').onchange=function(){w.swOff=this.value||undefined;render();renderProps();commit();};
      if($('#pVcSwOnIco'))$('#pVcSwOnIco').onclick=function(){_iconPick={wid:w.id,field:'swOnIcon'};showTab('icons');toast('Ein-Icon wählen');};
      if($('#pVcSwOnIcoX'))$('#pVcSwOnIcoX').onclick=function(){delete w.swOnIcon;render();renderProps();commit();};
      if($('#pVcSwOffIco'))$('#pVcSwOffIco').onclick=function(){_iconPick={wid:w.id,field:'swOffIcon'};showTab('icons');toast('Aus-Icon wählen');};
      if($('#pVcSwOffIcoX'))$('#pVcSwOffIcoX').onclick=function(){delete w.swOffIcon;render();renderProps();commit();};
      if($('#pVcVaFill'))$('#pVcVaFill').onchange=function(){w.vaFill=this.checked||undefined;render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();};
      if($('#pVcOkMin')||$('#pVcOkMax')){['#pVcOkMin','#pVcOkMax'].forEach(function(sq){if($(sq))$(sq).addEventListener('change',function(){renderProps();});});}
    },
    click:function(w,el,e){
      if(_vcSel(w)){var b=e.target.closest('.hvcsel .hselb');if(b){var sv=b.getAttribute('data-selval');setVar(w.varId,sv);_vcSelMark(w,el,sv);}return true;}
      if(w.varId2&&!w.v2acc&&!w.rngOn){var sw=$('[data-role=sw]',el);if(sw){var on=!sw.classList.contains('on');sw.classList.toggle('on',on);setVar(w.varId2,on?1:0);}return true;}
      return false;
    },
    live:function(w,el,id,d,base,txt,on){
      if(_vcSel(w)){if(w.varId===id){var vs=$('[data-role=val]',el);if(vs)vs.textContent=txt;_vcSelMark(w,el,d.v);}_vcState(w,el);return true;}
      if(w.rngOn&&(id===w.varId||id===w.varId2||id===w.varId3)){
        var _n=function(vid){var lv=vid&&_lastVals[vid];if(!lv)return null;var q=parseFloat(String(lv.v).replace(',','.'));return isNaN(q)?null:q;};
        var _t=function(vid){var lv=vid&&_lastVals[vid];return lv?((lv.f!=null&&lv.f!=='')?lv.f:String(lv.v)):'–';};
        var cu=_n(w.varId),mi=_n(w.varId2),ma=_n(w.varId3);
        var eMin=$('[data-role=rmin]',el),eMax=$('[data-role=rmax]',el),dot=$('[data-role=rdot]',el);
        if(eMin)eMin.textContent=_t(w.varId2);if(eMax)eMax.textContent=_t(w.varId3);
        if(dot){var p=(cu!=null&&mi!=null&&ma!=null&&ma>mi)?((cu-mi)/(ma-mi)*100):null;dot.style.display=(p==null)?'none':'';if(p!=null)dot.style.left=Math.max(0,Math.min(100,p))+'%';}
        var trk=$('.rtrack',el);
        if(trk){var gs=(w.rngGrad||[]).map(function(g){var c=_cssColorOrEmpty(g.color);if(!c)return null;var gv=parseFloat(String(g.v==null?g.p:g.v).replace(',','.'));return {c:c,v:isNaN(gv)?null:gv};}).filter(Boolean);
          if(gs.length&&mi!=null&&ma!=null&&ma>mi){gs.forEach(function(o,i){o.p=(o.v==null)?Math.round(i/Math.max(1,gs.length-1)*100):Math.max(0,Math.min(100,(o.v-mi)/(ma-mi)*100));});gs.sort(function(x,y){return x.p-y.p;});
            trk.style.background=(gs.length===1)?('linear-gradient(90deg,color-mix(in oklab,'+gs[0].c+' 14%,transparent) 0%,color-mix(in oklab,'+gs[0].c+' 55%,transparent) 55%,'+gs[0].c+' 100%)'):('linear-gradient(90deg,'+gs.map(function(o){return o.c+' '+o.p.toFixed(1)+'%';}).join(',')+')');
          }else if(!gs.length){trk.style.background='';}}
      }
      if(w.varId===id){
        // Wert OHNE Einheit anzeigen — die Einheit steht separat im <small> (aus dem Profil
        // vorausgefüllt). Falls die Profil-Einheit doch noch am Wert klebt (z. B. Server
        // liefert kein d.u), hier hart abschneiden, damit sie nicht doppelt erscheint.
        var v=$('[data-role=val]',el);
        if(v){var vt=txt,uu=(w.unit||'').trim();if(uu){var st=String(vt).trim();if(st.length>=uu.length&&st.slice(-uu.length)===uu)vt=st.slice(0,-uu.length).replace(/\s+$/,'');}v.textContent=vt;}
        if(w.okMin!=null||w.okMax!=null){var nv=parseFloat(String(d.v).replace(',','.'));var bd=$('[data-role=badge]',el);if(bd&&!isNaN(nv)){var okv=(w.okMin==null||nv>=w.okMin)&&(w.okMax==null||nv<=w.okMax);bd.className='hpill '+(okv?'ok':'warn');bd.innerHTML='<span class="hpd"></span>'+esc(okv?(w.okText||'OPTIMAL'):(w.badText||'PRÜFEN'));}}
        if(w.barOn&&!w.varId3){var mn=(w.barMin!=null?w.barMin:0),mx=(w.barMax!=null?w.barMax:100),nb=parseFloat(String(d.v).replace(',','.')),bar=$('[data-role=bar]',el);if(bar&&!isNaN(nb))bar.style.width=Math.max(0,Math.min(100,((nb-mn)/((mx-mn)||1))*100))+'%';}
      }
      if(w.varId2===id){if(w.v2acc){el.classList.toggle('vc-acc',on);}else if(!w.rngOn){var sw=$('[data-role=sw]',el);if(sw)sw.classList.toggle('on',on);}}
      if(w.varId3===id&&w.barOn){var mn3=(w.barMin!=null?w.barMin:0),mx3=(w.barMax!=null?w.barMax:100),nb3=parseFloat(String(d.v).replace(',','.')),bar3=$('[data-role=bar]',el);if(bar3&&!isNaN(nb3))bar3.style.width=Math.max(0,Math.min(100,((nb3-mn3)/((mx3-mn3)||1))*100))+'%';}
      if(w.cmpVid&&(id===w.varId||id===w.cmpVid))_vcCmp(w,el);
      _vcState(w,el);
      return true;
    }
  });
