  // ===== Widget: Schalter (Switch) =====
  //  Modus 'toggle' (Vorgabe): Ein/Aus-Knopf wie bisher (Bool-Variable), Ein/Aus-Farben + Knopf-Icons.
  //  Modus 'multi'  : Mehrpositions-Schieber fuer Integer-Variablen. Der Knopf gleitet ueber N Segmente,
  //                   ein Klick setzt den Wert. Zustaende kommen aus den Profil-Zuordnungen (?api=assoc);
  //                   ist kein Profil vorhanden, greift die manuelle Liste w.states ("Profil, sonst manuell").
  function _swMulti(w){return w.swMode==='multi';}
  var _swAssoc={}, _swWait={};                                  // varId -> Profil-Optionen (einmal geholt); undefined = noch nicht geladen
  function _swStates(w){
    if(w.states&&w.states.length)return w.states.map(function(o){return {v:o.v,text:o.text,color:o.color,icon:o.icon};}); // EIGENE Liste ueberschreibt IMMER das Profil
    if(w.varId&&_swAssoc[w.varId]&&_swAssoc[w.varId].length)return _swAssoc[w.varId];         // sonst Profil-Zuordnungen
    if(w.varId&&_swAssoc[w.varId]===undefined)return null;                                     // Profil noch nicht geladen, keine eigene Liste
    return [];
  }
  // ===== Generischer Mehrpositions-Schieber (Toggle-Stil) — genutzt von switch UND select =====
  //  states: [{v|value, text, color, icon}]. Knopf gleitet auf die aktive Position (--i),
  //  aktiver Zustand faerbt Knopf und toent den Track (--swmc). Icons + Text je Segment.
  function _sldVal(o){return o.v!=null?o.v:o.value;}
  function _sldSeg(o,i){
    var ic=o.icon?'<span class="swmsi">'+iconSVG(o.icon)+'</span>':'';
    var hasT=(o.text!=null&&o.text!=='');
    var tx=hasT?('<span class="swmst">'+esc(o.text)+'</span>'):(o.icon?'':esc(String(_sldVal(o))));
    return '<button class="swmseg'+(o.icon&&!hasT?' icon-only':'')+'" data-swi="'+i+'" data-swval="'+esc(String(_sldVal(o)!=null?_sldVal(o):''))+'"'+(hasT?(' title="'+esc(o.text)+'"'):'')+'>'+ic+tx+'</button>';
  }
  function _sldRadius(shape){return shape==='square'?'4px':(shape==='round'?'10px':'999px');}   // Vorgabe: Pille
  function _sldBody(states,shape){
    if(states===null)return '<span class="swm swm-load">…</span>';
    if(!states||!states.length)return '<span class="swmempty">keine Zustände</span>';
    return '<span class="swm" data-role="swm" style="--n:'+states.length+';--swmr:'+_sldRadius(shape)+'"><i class="swmk" data-role="swmk"></i>'+states.map(_sldSeg).join('')+'</span>';
  }
  function _sldMark(el,states,v){
    if(!states||!states.length)return;
    var idx=-1;for(var i=0;i<states.length;i++){if(String(_sldVal(states[i]))===String(v)){idx=i;break;}}
    var knob=$('[data-role=swmk]',el),wrap=$('[data-role=swm]',el);
    // Knopf-Farbe des aktiven Zustands + daraus die lesbare Vordergrundfarbe (hell auf dunkel, dunkel auf hell)
    var c=(idx>=0&&states[idx].color)?_cssColorOrEmpty(states[idx].color):'';
    var L=c?((typeof _lum==='function')?_lum(c):null):null;
    var fg=(c)?((L!=null&&L<0.52)?'#f5f9f8':'#04201b'):''; // '' = Standard aus CSS (dunkel, passt zum Akzent-Knopf)
    // aktive Segment-Schrift UND Icon direkt setzen (robust; CSS-Variablen-Vererbung griff hier nicht)
    $$('.swmseg',el).forEach(function(b,i){var on=(i===idx);b.classList.toggle('on',on);
      var col=on?fg:'';b.style.color=col;
      var t=b.querySelector('.swmst');if(t)t.style.color=col;
      var ic=b.querySelector('.swmsi');if(ic)ic.style.color=col;});
    if(!knob||!wrap)return;
    if(idx<0){knob.classList.add('hidden');wrap.classList.remove('tint');wrap.style.removeProperty('--swmc');return;}
    knob.classList.remove('hidden');wrap.style.setProperty('--i',idx);
    if(c){wrap.style.setProperty('--swmc',c);wrap.classList.add('tint');}
    else{wrap.style.removeProperty('--swmc');wrap.classList.remove('tint');}
  }
  function _swmBody(w){return _sldBody(_swStates(w),w.swmShape);}
  function _swMark(w,el,v){_sldMark(el,_swStates(w),v);}
  function _swPaint(w,root){var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;var host=$('[data-role=swmhost]',el);if(!host)return;host.innerHTML=_swmBody(w);var d=w.varId&&_lastVals[w.varId];if(d)_swMark(w,el,d.v);}
  function _swLoad(w,root){
    if(!w.varId)return;
    if(_swAssoc[w.varId]!==undefined){_swPaint(w,root);return;}
    if(_swWait[w.varId]){_swWait[w.varId].push([w,root]);return;}                              // gleiche Variable: nur EIN Abruf
    _swWait[w.varId]=[[w,root]];
    fetch('?api=assoc&id='+w.varId,{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        _swAssoc[w.varId]=(j&&j.assocs||[]).map(function(a){return {v:a.v,text:a.name,color:a.color||'',icon:a.icon||''};});
        (_swWait[w.varId]||[]).forEach(function(p){_swPaint(p[0],p[1]);});delete _swWait[w.varId];
      })
      .catch(function(){delete _swWait[w.varId];});
  }
  defWidget('switch',{
    label:'Schalter', cat:'Steuerung', paletteIcon:'power', size:[180,52],
    render:function(w){
      if(_swMulti(w)){
        return '<div class="wsw wswm"><span class="l">'+(w.icon?'<span class="swic">'+iconSVG(w.icon)+'</span>':'')+escL(w.label||'')+'</span>'
          +'<span class="swmhost" data-role="swmhost">'+_swmBody(w)+'</span></div>';
      }
      var onC=w.swOn?_cssColorOrEmpty(w.swOn):'',offC=w.swOff?_cssColorOrEmpty(w.swOff):'';
      var sty=(onC?('--sw-on:'+onC+';'):'')+(offC?('--sw-off:'+offC+';'):'');
      var knob='<i class="swk">'+(w.swOffIcon?'<span class="swi swi-off">'+iconSVG(w.swOffIcon)+'</span>':'')+(w.swOnIcon?'<span class="swi swi-on">'+iconSVG(w.swOnIcon)+'</span>':'')+'</i>';
      return '<div class="wsw"><span class="l">'+(w.icon?'<span class="swic">'+iconSVG(w.icon)+'</span>':'')+escL(w.label||'')+'</span><span class="sw" data-role="sw"'+(sty?(' style="'+sty+'"'):'')+'>'+knob+'</span></div>';
    },
    mount:function(w){if(_swMulti(w)&&!(w.states&&w.states.length))_swLoad(w);}, // eigene Liste -> Profil gar nicht erst laden
    props:function(w){
      function csel(id,cur){return skinSel(cur,'id="'+id+'"');}
      function ico(id,cur,lbl){return row(lbl,'<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(cur?iconSVG(cur):'')+'</span> <button class="btn" id="'+id+'" style="padding:5px 8px">wählen</button>'+(cur?' <button class="btn" id="'+id+'X" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''));}
      var s=row('Modus','<select id="pSwMode"><option value="toggle"'+(!_swMulti(w)?' selected':'')+'>Toggle (Ein/Aus, Bool)</option><option value="multi"'+(_swMulti(w)?' selected':'')+'>Multi-State (Schieber, Integer)</option></select>');
      if(_swMulti(w)){
        return s+'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px"><b>Eigene Liste unten überschreibt IMMER das Profil.</b> Ist die Liste leer, kommen die Zustände aus den Profil-Zuordnungen der (Integer-)Variable. Ein Klick auf ein Segment schreibt den Wert (RequestAction bei schaltbarer Variable).</div>'
          +row('Rundung','<select id="pSwShape">'+[['','Pille'],['round','Abgerundet'],['square','Eckig']].map(function(o){return '<option value="'+o[0]+'"'+((w.swmShape||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
          +listEditor(w,'states','Zustand: Wert · Text · Icon · Farbe',[{k:'v',ph:'Wert (z. B. 1)'},{k:'text',ph:'Text'},{k:'icon',type:'icon',ph:'Icon'},{k:'color',type:'skincolor'}]);
      }
      return s
        +'<div class="pgh">Schalter-Farben</div>'
        +row('Ein-Farbe',csel('pSwOn',w.swOn||''))
        +row('Aus-Farbe',csel('pSwOff',w.swOff||''))
        +'<div class="pgh">Knopf-Icons (Ein/Aus)</div>'
        +ico('pSwOnIco',w.swOnIcon,'Ein-Icon')
        +ico('pSwOffIco',w.swOffIcon,'Aus-Icon');
    },
    wire:function(w){
      if($('#pSwMode'))$('#pSwMode').onchange=function(){w.swMode=(this.value==='multi'?'multi':undefined);render();renderProps();commit();};
      if($('#pSwShape'))$('#pSwShape').onchange=function(){w.swmShape=this.value||undefined;render();commit();};
      if($('#pSwOn'))$('#pSwOn').onchange=function(){w.swOn=this.value||undefined;render();renderProps();commit();};
      if($('#pSwOff'))$('#pSwOff').onchange=function(){w.swOff=this.value||undefined;render();renderProps();commit();};
      if($('#pSwOnIco'))$('#pSwOnIco').onclick=function(){_iconPick={wid:w.id,field:'swOnIcon'};showTab('icons');toast('Ein-Icon links wählen');};
      if($('#pSwOnIcoX'))$('#pSwOnIcoX').onclick=function(){delete w.swOnIcon;render();renderProps();commit();};
      if($('#pSwOffIco'))$('#pSwOffIco').onclick=function(){_iconPick={wid:w.id,field:'swOffIcon'};showTab('icons');toast('Aus-Icon links wählen');};
      if($('#pSwOffIcoX'))$('#pSwOffIcoX').onclick=function(){delete w.swOffIcon;render();renderProps();commit();};
    },
    click:function(w,el,e){                                    // Multi: Segment-Klick schreibt den Wert; Toggle laeuft ueber _wClick
      if(!_swMulti(w))return false;
      var seg=e.target.closest('.swmseg');if(seg&&w.varId){var sv=seg.getAttribute('data-swval');setVar(w.varId,sv);_swMark(w,el,sv);}
      return true;
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId!==id)return;
      if(_swMulti(w)){_swMark(w,el,d.v);}
      else{var sw=$('[data-role=sw]',el);if(sw)sw.classList.toggle('on',on);}
    }
  });
