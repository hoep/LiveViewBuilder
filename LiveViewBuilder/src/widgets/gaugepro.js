// gaugepro widget
// gaugepro nutzt 1:1 die gauge-Logik (setGauge in 03-render-charts.js): dadurch stehen dieselben
// Optionen (Stil, Farbmodus, Einheit, Wertanzeige-Schrift …) mit denselben Property-Namen zur Verfügung.
// Standard-Farbmodus bleibt 'graded' (Grün/Gelb/Rot-Abstufung) — der ursprüngliche gaugepro-Charakter.
function setGaugePro(w,d){var _gc=w.gcolor;if(_gc==null)w.gcolor='graded';setGauge(w,d);w.gcolor=_gc;}
defWidget('gaugepro',{
  label:'Gauge+',
  cat:'Diagramme',
  paletteIcon:'gauge',
  size:[170,150],
  render:function(w){return '<div data-role="chart"></div>';},
  props:function(w){if(w.type!=='gaugepro')return '';
    var FF=[['system-ui,-apple-system,sans-serif','Sans'],['Georgia,\'Times New Roman\',serif','Serif'],['ui-monospace,Menlo,Consolas,monospace','Mono'],['\'Segoe UI\',Arial,sans-serif','Segoe/Arial'],['Verdana,sans-serif','Verdana']];
    return row('Stil','<select id="pGStyle"><option value="classic"'+((w.gstyle||'classic')==='classic'?' selected':'')+'>Klassisch</option><option value="half"'+(w.gstyle==='half'?' selected':'')+'>Halb-Gauge</option><option value="ring"'+(w.gstyle==='ring'?' selected':'')+'>Donut-Ring</option><option value="halfring"'+(w.gstyle==='halfring'?' selected':'')+'>Halb-Donut</option></select>')+row('Farbe',gaugeColorSel(w.gcolor||'graded'))+((w.gcolor||'graded')==='graded'?(row('Grün bis','<input id="pT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')):'')+row('Teilstriche','<input type="checkbox" id="pGTicks"'+(w.gticks?' checked':'')+'>')+row('Mittelknopf','<input type="checkbox" id="pGKnob"'+(w.gknob?' checked':'')+'>')+row('Winkel °','<input id="pGStart" type="number" style="width:60px" value="'+(w.gstart!=null?w.gstart:'')+'" placeholder="Start"> <input id="pGEnd" type="number" style="width:60px" value="'+(w.gend!=null?w.gend:'')+'" placeholder="Ende">')
    +'<div class="pgh">Wertanzeige</div>'
    +row('Anzeigen','<input type="checkbox" id="pGvShow"'+((w.gvShow!==false)?' checked':'')+'>')
    +row('Schrift','<select id="pGvFf"><option value="">Standard (Mono)</option>'+FF.map(function(o){return '<option value="'+esc(o[0])+'"'+(w.gvff===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
    +row('Gewicht','<select id="pGvFwt"><option value="">Standard</option>'+['300','400','500','600','700','800'].map(function(x){return '<option value="'+x+'"'+(w.gvfwt===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select>')
    +row('Stil','<select id="pGvSty"><option value=""'+(!w.gvsty?' selected':'')+'>Normal</option><option value="italic"'+(w.gvsty==='italic'?' selected':'')+'>Kursiv</option></select>')
    +row('Größe (px)','<input id="pGvSz" type="number" min="0" value="'+(w.gvsz||'')+'" placeholder="auto">')
    +row('Einheit','<input id="pGvUnit" value="'+esc(w.gvUnit||'')+'" placeholder="Profil (z. B. °C)">')
      +'<div class="pgh">Referenzstrich</div>'
      +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Marke auf dem Ring - z. B. der Jahresfortschritt. Der Ring sagt, wie viel verbraucht ist; erst die Marke sagt, wie viel zum jetzigen Zeitpunkt verbraucht sein DUERFTE.</div>'
      +fieldPick(w,'gRefVid','Referenz-Variable')
      +row('Unterzeile','<input id="pGRefText" value="'+esc(w.gRefText||'')+'" placeholder="Strich = {v} %">')
      +row('Nachkommast.','<input id="pGRefDec" type="number" min="0" max="3" style="width:60px" value="'+(w.gRefDec!=null?w.gRefDec:'')+'" placeholder="1">')
      +row('Farbe',skinSel(w.gRefCol,'id="pGRefCol"'));},
  wire:function(w){
    if($('#pGStyle'))$('#pGStyle').onchange=function(){w.gstyle=this.value;render();commit();};
    if($('#pGColor'))$('#pGColor').onchange=function(){w.gcolor=this.value;render();renderProps();commit();};
    if($('#pGTicks'))$('#pGTicks').onchange=function(){w.gticks=this.checked||undefined;render();commit();};
    if($('#pGKnob'))$('#pGKnob').onchange=function(){w.gknob=this.checked||undefined;render();commit();};
    if($('#pGStart'))$('#pGStart').oninput=function(){w.gstart=this.value===''?undefined:parseFloat(this.value);render();commit();};
    if($('#pGEnd'))$('#pGEnd').oninput=function(){w.gend=this.value===''?undefined:parseFloat(this.value);render();commit();};
    if($('#pGvShow'))$('#pGvShow').onchange=function(){w.gvShow=this.checked?undefined:false;render();commit();};
    if($('#pGvFf'))$('#pGvFf').onchange=function(){w.gvff=this.value||undefined;render();commit();};
    if($('#pGvFwt'))$('#pGvFwt').onchange=function(){w.gvfwt=this.value||undefined;render();commit();};
    if($('#pGvSty'))$('#pGvSty').onchange=function(){w.gvsty=this.value||undefined;render();commit();};
    if($('#pGvSz'))$('#pGvSz').oninput=function(){w.gvsz=parseInt(this.value)||undefined;render();commit();};
    if($('#pGvUnit'))$('#pGvUnit').oninput=function(){w.gvUnit=this.value||undefined;render();commit();};
      if($('#pGRefText'))$('#pGRefText').oninput=function(){w.gRefText=this.value||undefined;render();commit();};
      if($('#pGRefDec'))$('#pGRefDec').oninput=function(){w.gRefDec=this.value===''?undefined:parseInt(this.value);render();commit();};
      if($('#pGRefCol'))$('#pGRefCol').onchange=function(){w.gRefCol=this.value||undefined;render();commit();};
  },
  // live() bekommt die Daten DER GEAENDERTEN Variablen - nicht zwingend die der eigenen.
  // Seit der Referenzstrich eine zweite Variable hat, traf hier auch deren Wert ein und
  // wurde als Hauptwert gezeichnet: der Pellets-Ring stand auf 71,2 (dem Jahresfortschritt)
  // statt auf 67,1. Deshalb IMMER den eigenen Wert nachschlagen; d bleibt nur Rueckfall.
  live:function(w,el,id,d,base,txt,on){setGaugePro(w,((w.varId!=null&&w.varId!=='')?_lastVals[w.varId]:null)||d);}
});
