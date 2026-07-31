  // ===== Widget: Schalter (Switch) =====
  // Ein/Aus-Farben (Skin) + optional je ein Icon auf dem Knopf für Ein/Aus.
  defWidget('switch',{
    label:'Schalter', paletteIcon:'power', size:[180,52],
    render:function(w){
      var onC=w.swOn?_cssColorOrEmpty(w.swOn):'',offC=w.swOff?_cssColorOrEmpty(w.swOff):'';
      var sty=(onC?('--sw-on:'+onC+';'):'')+(offC?('--sw-off:'+offC+';'):'');
      var knob='<i class="swk">'+(w.swOffIcon?'<span class="swi swi-off">'+iconSVG(w.swOffIcon)+'</span>':'')+(w.swOnIcon?'<span class="swi swi-on">'+iconSVG(w.swOnIcon)+'</span>':'')+'</i>';
      return '<div class="wsw"><span class="l">'+(w.icon?'<span class="swic">'+iconSVG(w.icon)+'</span>':'')+escL(w.label||'Schalter')+'</span><span class="sw" data-role="sw"'+(sty?(' style="'+sty+'"'):'')+'>'+knob+'</span></div>';
    },
    props:function(w){
      function csel(id,cur){return skinSel(cur,'id="'+id+'"');}
      function ico(id,cur,lbl){return row(lbl,'<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(cur?iconSVG(cur):'')+'</span> <button class="btn" id="'+id+'" style="padding:5px 8px">wählen</button>'+(cur?' <button class="btn" id="'+id+'X" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''));}
      return '<div class="pgh">Schalter-Farben</div>'
        +row('Ein-Farbe',csel('pSwOn',w.swOn||''))
        +row('Aus-Farbe',csel('pSwOff',w.swOff||''))
        +'<div class="pgh">Knopf-Icons (Ein/Aus)</div>'
        +ico('pSwOnIco',w.swOnIcon,'Ein-Icon')
        +ico('pSwOffIco',w.swOffIcon,'Aus-Icon');
    },
    wire:function(w){
      if($('#pSwOn'))$('#pSwOn').onchange=function(){w.swOn=this.value||undefined;render();renderProps();commit();};
      if($('#pSwOff'))$('#pSwOff').onchange=function(){w.swOff=this.value||undefined;render();renderProps();commit();};
      if($('#pSwOnIco'))$('#pSwOnIco').onclick=function(){_iconPick={wid:w.id,field:'swOnIcon'};showTab('icons');toast('Ein-Icon links wählen');};
      if($('#pSwOnIcoX'))$('#pSwOnIcoX').onclick=function(){delete w.swOnIcon;render();renderProps();commit();};
      if($('#pSwOffIco'))$('#pSwOffIco').onclick=function(){_iconPick={wid:w.id,field:'swOffIcon'};showTab('icons');toast('Aus-Icon links wählen');};
      if($('#pSwOffIcoX'))$('#pSwOffIcoX').onclick=function(){delete w.swOffIcon;render();renderProps();commit();};
    }
  });
