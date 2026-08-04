  // ===== Widget: Info-Liste =====
  defWidget('infolist',{
    label:'Info-Liste', paletteIcon:'wlist', size:[260,180],
    defaults:function(w){w.items=[{icon:'washer',label:'Waschmaschine',sub:'Restzeit 0:42',pill:'läuft',state:'on'},{icon:'dryer',label:'Trockner',sub:'bereit',pill:'aus',state:'off'},{icon:'car',label:'BMW',sub:'Reichweite 213 km',value:'64 %'}];},
    render:function(w){return '<div class="hinfos">'+(w.items||[]).map(function(r){var rt=r.pill?'<span class="hpill '+esc(r.state||'ok')+'"><span class="hpd"></span>'+esc(r.pill)+'</span>':'<span class="hiv"'+(r.vid?' data-vid="'+r.vid+'"'+_slotAttrs(r):'')+'>'+esc(r.value||'')+'</span>';var _ic=r.color?(_cssColorOrEmpty(r.color)||''):'';return '<div class="hinfo"><span class="hibi"'+(_ic?' style="color:'+_ic+';background:color-mix(in oklab,'+_ic+' 14%,var(--surface-2))"':'')+'>'+iconSVG(r.icon||'sensor')+'</span><span class="hin">'+esc(r.label||'')+(r.sub?'<small>'+esc(r.sub)+'</small>':'')+'</span>'+rt+'</div>';}).join('')+'</div>';},
    props:function(w){return (w.type==='infolist'
      ?'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Je Zeile: Icon, Name (+Zusatz), rechts entweder ein <b>Wert</b> oder eine <b>Pill</b>. „Status" färbt nur die Pill ein (ohne Pill-Text hat er keine Wirkung).</div>'
        +listEditor(w,'items','Zeile: Icon · Farbe · Name · Zusatz · Wert · Pill · Status(Pill-Farbe) · VarID',[{k:'icon',type:'icon',h:'Icon',ph:'Icon wählen'},{k:'color',type:'skincolor',h:'Farbe (Icon)'},{k:'label',h:'Name',ph:'Name'},{k:'sub',h:'Zusatz',ph:'Zusatz'},{k:'value',h:'Wert',ph:'Wert'},{k:'dec',h:'Dez',ph:'Dez'},{k:'unit',h:'Einh',ph:'Einh'},{k:'pill',h:'Pill',ph:'Pill'},{k:'state',type:'select',def:'ok',h:'Status (Pill)',ph:'Status',options:[['ok','OK · grün'],['on','An · Akzent'],['off','Aus · grau'],['warn','Warnung · gelb'],['crit','Kritisch · rot'],['warm','Warm · orange']]},{k:'vid',h:'ID',ph:'ID'}])
      :'');}
  });
