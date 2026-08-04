  // ===== Widget: Auswahl (Select) =====
  //
  //  Darstellung (smode):
  //    'btn'  (Vorgabe) Knopfreihe wie bisher - gut fuer zwei bis vier Optionen.
  //    'list'           kompakte Klappliste - noetig, sobald mehrere Auswahlfelder
  //                     nebeneinander in eine Zeile muessen (Rollo-Einstellungen: sechs
  //                     Spalten mal siebzehn Zeilen; als Knopfreihen waere das unlesbar).
  //
  //  Optionsquelle (optSrc):
  //    'manual' (Vorgabe) die von Hand gepflegte Liste unten.
  //    'profile'          die Zuordnungen des Variablenprofils, geholt ueber ?api=assoc.
  //                       Damit muss niemand 102 Optionslisten abtippen und pflegen - die
  //                       Anzeige folgt automatisch, wenn sich ein Profil in Symcon aendert.
  //
  //  Ohne die beiden neuen Einstellungen verhaelt sich das Widget exakt wie zuvor.
  var _selAssoc = {};                                  // varId -> Optionen (einmal geholt)
  var _selWait  = {};                                  // varId -> wartende [widget, root]
  function _selMode(w){return w.smode==='list'?'list':(w.smode==='slider'?'slider':'btn');}
  function _selFromProfile(w){return w.optSrc==='profile'&&w.varId;}
  function _selOpts(w){
    if(!_selFromProfile(w))return w.options||[];
    return _selAssoc[w.varId]||null;                   // null = noch nicht geladen
  }
  function _selSld(w){var o=_selOpts(w);if(o===null)return null;return o.map(function(x){return {v:x.value,text:x.text,color:x.color,icon:x.icon};});} // -> generischer Schieber
  function _selBody(w){
    var opts=_selOpts(w);
    if(_selMode(w)==='slider')return _sldBody(_selSld(w),w.swmShape);   // Mehrpositions-Schieber (Toggle-Stil), s. switch.js
    if(_selMode(w)==='list'){
      if(opts===null)return '<select class="hsell" data-role="selist"><option>…</option></select>';
      return '<select class="hsell" data-role="selist">'
        +opts.map(function(o){return '<option value="'+esc(String(o.value!=null?o.value:''))+'">'
          +esc(o.text||String(o.value))+'</option>';}).join('')+'</select>';
    }
    if(opts===null)return '<div class="hsel"><button class="hselb">…</button></div>';
    return '<div class="hsel">'+opts.map(function(o){
      var ic=o.icon?'<span class="hseli">'+iconSVG(o.icon)+'</span>':'';                     // Knopfreihe mit Icon (Profil oder manuell)
      var hasT=(o.text!=null&&o.text!=='');
      var tx=hasT?('<span class="hselt">'+esc(o.text)+'</span>'):(o.icon?'':esc(String(o.value)));
      return '<button class="hselb'+(o.icon&&!hasT?' icon-only':'')+'" data-selval="'+esc(String(o.value!=null?o.value:''))+'"'
        +(o.color?' style="--sc:'+esc(o.color)+'"':'')+(hasT?(' title="'+esc(o.text)+'"'):'')+'>'+ic+tx+'</button>';
    }).join('')+'</div>';
  }
  // Nach dem Nachladen der Profil-Optionen nur den Innenraum tauschen - ein volles render()
  // wuerde bei 100 Auswahlfeldern 100 Neuaufbauten der ganzen Seite ausloesen.
  function _selPaint(w,root){
    var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;
    var host=$('[data-role=selhost]',el);if(!host)return;
    host.innerHTML=_selBody(w);
    var d=w.varId&&_lastVals[w.varId];if(d)_selMark(w,el,d.v);
  }
  function _selMark(w,el,v){
    if(_selMode(w)==='slider'){_sldMark(el,_selSld(w),v);return;}
    var s=$('[data-role=selist]',el);
    if(s){if(document.activeElement!==s)s.value=String(v);return;}
    $$('.hselb',el).forEach(function(b){
      b.classList.toggle('on',String(b.getAttribute('data-selval'))===String(v));});
  }
  function _selLoad(w,root){
    if(!_selFromProfile(w))return;
    if(_selAssoc[w.varId]){_selPaint(w,root);return;}
    if(_selWait[w.varId]){_selWait[w.varId].push([w,root]);return;}   // gleiche Variable: nur EIN Abruf
    _selWait[w.varId]=[[w,root]];
    fetch('?api=assoc&id='+w.varId,{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        _selAssoc[w.varId]=(j&&j.assocs||[]).map(function(a){
          return {value:a.v,text:a.name,color:a.color||'',icon:a.icon||''};});
        (_selWait[w.varId]||[]).forEach(function(p){_selPaint(p[0],p[1]);});
        delete _selWait[w.varId];
      })
      .catch(function(){delete _selWait[w.varId];});
  }
  defWidget('select',{
    label:'Auswahl', paletteIcon:'wselect', size:[220,44],
    defaults:function(w){w.options=[{value:0,text:'Aus',color:''},{value:1,text:'An',color:''}];},
    render:function(w){return '<div class="hselhost" data-role="selhost">'+_selBody(w)+'</div>';},
    mount:function(w){_selLoad(w);},
    // Klappliste schreibt beim Wechsel; die Knopfreihe laeuft weiter ueber _wClick.
    input:function(w,el,e){
      var s=e.target.closest('[data-role=selist]');if(!s)return false;
      if(w.varId)setVar(w.varId,s.value);
      return true;
    },
    live:function(w,el,id,d,base,txt,on){if(w.varId===id)_selMark(w,el,d.v);},
    props:function(w){
      return row('Darstellung','<select id="pSelMode"><option value="btn"'+(_selMode(w)==='btn'?' selected':'')+'>Knopfreihe</option><option value="list"'+(_selMode(w)==='list'?' selected':'')+'>Klappliste</option><option value="slider"'+(_selMode(w)==='slider'?' selected':'')+'>Schieber</option></select>')
        +(_selMode(w)==='slider'?row('Rundung','<select id="pSelShape">'+[['','Pille'],['round','Abgerundet'],['square','Eckig']].map(function(o){return '<option value="'+o[0]+'"'+((w.swmShape||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>'):'')
        +row('Optionen aus','<select id="pSelSrc"><option value=""'+(w.optSrc!=='profile'?' selected':'')+'>eigener Liste</option><option value="profile"'+(w.optSrc==='profile'?' selected':'')+'>Variablenprofil</option></select>')
        +(w.optSrc==='profile'
          ? '<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">Die Optionen (inkl. Farbe &amp; Icon) kommen aus den Zuordnungen des Profils und folgen ihm automatisch.</div>'
          : listEditor(w,'options','Optionen: Wert · Text · Icon · Farbe',[{k:'value',ph:'Wert'},{k:'text',ph:'Text'},{k:'icon',type:'icon',ph:'Icon'},{k:'color',type:'skincolor'}]));
    },
    wire:function(w){
      if($('#pSelMode'))$('#pSelMode').onchange=function(){var v=this.value;w.smode=(v==='list'||v==='slider')?v:undefined;render();renderProps();commit();};
      if($('#pSelShape'))$('#pSelShape').onchange=function(){w.swmShape=this.value||undefined;render();commit();};
      if($('#pSelSrc'))$('#pSelSrc').onchange=function(){w.optSrc=(this.value==='profile'?'profile':undefined);render();renderProps();commit();};
    }
  });
