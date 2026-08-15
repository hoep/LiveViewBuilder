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
  // Optionen mit gesetztem group-Feld in Cluster gruppieren (Reihenfolge = erstes Auftreten)
  function _selGroups(opts){var has=false;for(var i=0;i<opts.length;i++){if(opts[i].group){has=true;break;}}if(!has)return null;
    var g={},order=[];opts.forEach(function(o){var k=o.group||'';if(!(k in g)){g[k]=[];order.push(k);}g[k].push(o);});return {g:g,order:order};}
  function _selOptTag(o){return '<option value="'+esc(String(o.value!=null?o.value:''))+'">'+esc(o.text||String(o.value))+'</option>';}
  function _selBtn(o){var ic=o.icon?'<span class="hseli">'+iconSVG(o.icon)+'</span>':'';       // Knopf mit Icon (Profil oder manuell)
    var hasT=(o.text!=null&&o.text!==''), tx=hasT?('<span class="hselt">'+esc(o.text)+'</span>'):(o.icon?'':esc(String(o.value)));
    return '<button class="hselb'+(o.icon&&!hasT?' icon-only':'')+'" data-selval="'+esc(String(o.value!=null?o.value:''))+'"'
      +(o.color?' style="--sc:'+esc(o.color)+'"':'')+(hasT?(' title="'+esc(o.text)+'"'):'')+'>'+ic+tx+'</button>';}
  function _selBody(w){
    var opts=_selOpts(w);
    if(_selMode(w)==='slider')return _sldBody(_selSld(w),w.swmShape);   // Mehrpositions-Schieber (Toggle-Stil), s. switch.js
    if(_selMode(w)==='list'){
      if(opts===null)return '<select class="hsell" data-role="selist"><option>…</option></select>';
      var gl=_selGroups(opts);
      if(gl)return '<select class="hsell" data-role="selist">'+gl.order.map(function(k){var inner=gl.g[k].map(_selOptTag).join('');return k?('<optgroup label="'+esc(k)+'">'+inner+'</optgroup>'):inner;}).join('')+'</select>';
      return '<select class="hsell" data-role="selist">'+opts.map(_selOptTag).join('')+'</select>';
    }
    if(opts===null)return '<div class="hsel"><button class="hselb">…</button></div>';
    var gb=_selGroups(opts);   // Knopfreihe mit Gruppen-Clustern (jede Gruppe mit kleiner Überschrift)
    if(gb)return '<div class="hsel hsel-grp">'+gb.order.map(function(k){return '<div class="hselgrp">'+(k?'<span class="hselglab">'+esc(k)+'</span>':'')+gb.g[k].map(_selBtn).join('')+'</div>';}).join('')+'</div>';
    return '<div class="hsel">'+opts.map(_selBtn).join('')+'</div>';
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
    label:'Auswahl', cat:'Steuerung', paletteIcon:'wselect', size:[220,44],
    defaults:function(w){w.options=[{value:0,text:'Aus',color:''},{value:1,text:'An',color:''}];},
    render:function(w){
      var host='<div class="hselhost" data-role="selhost" style="flex:1;min-width:0">'+_selBody(w)+'</div>';
      if(!w.label)return host;                                   // ohne Label wie bisher
      // Label-Zeile an der Kachel: gleiches Schrift-Token wie die Knoepfe (--wf-lbl), damit
      // Beschriftung und Auswahl endlich dieselbe Groesse haben; Icon folgt der Kachel.
      var ico=w.icon?'<span style="width:clamp(12px,7cqmin,20px);height:clamp(12px,7cqmin,20px);display:inline-flex;flex:none">'+iconSVG(w.icon)+'</span>':'';
      return '<div style="display:flex;align-items:center;gap:clamp(5px,3cqmin,10px);height:100%">'
        +'<span style="font-size:var(--wf-lbl);font-weight:600;color:var(--text);white-space:nowrap;display:flex;align-items:center;gap:clamp(4px,2.5cqmin,8px)">'+ico+escL(w.label)+'</span>'
        +host+'</div>';
    },
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
          : listEditor(w,'options','Optionen: Wert · Text · Gruppe · Icon · Farbe',[{k:'value',ph:'Wert'},{k:'text',ph:'Text'},{k:'group',ph:'Gruppe (optional)'},{k:'icon',type:'icon',ph:'Icon'},{k:'color',type:'skincolor'}]));
    },
    wire:function(w){
      if($('#pSelMode'))$('#pSelMode').onchange=function(){var v=this.value;w.smode=(v==='list'||v==='slider')?v:undefined;render();renderProps();commit();};
      if($('#pSelShape'))$('#pSelShape').onchange=function(){w.swmShape=this.value||undefined;render();commit();};
      if($('#pSelSrc'))$('#pSelSrc').onchange=function(){w.optSrc=(this.value==='profile'?'profile':undefined);render();renderProps();commit();};
    }
  });
