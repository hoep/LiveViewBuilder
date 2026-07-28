  // ===== Widget: Sonnenbogen (suncard) — Sonnenauf/-untergang mit Tagbogen (+ optional Nacht/Mond) =====
  // Datenquelle: varId = Sonnenaufgang, varId2 = Sonnenuntergang (Zeit-Variablen).
  // Rendering/Compute in refreshSun() (03-render-charts.js) — aufgerufen von render() + live.
  defWidget('suncard',{
    label:'Sonnenbogen', paletteIcon:'sunrise', size:[280,150],
    defaults:function(w){w.label='Sonne';},
    render:function(w){
      var svg=w.showNight
        ? '<svg class="hscsvg" viewBox="0 0 200 128" preserveAspectRatio="none"><path class="hscfill" data-role="fill" d=""/><path class="hscfilln" data-role="filln" d=""/><path class="hscarc" data-role="curve" d=""/><path class="hscarc hscarcn" data-role="curven" d=""/><line class="hschoriz" x1="0" y1="64" x2="200" y2="64"/><g class="hscmoon" data-role="moon" transform="translate(8,64)"><path d="M4 -5.2 A6 6 0 1 0 4 5.2 A4.6 4.6 0 1 1 4 -5.2 Z"/></g><circle class="hscsun" data-role="sun" cx="8" cy="64" r="7"/></svg>'
        : '<svg class="hscsvg" viewBox="0 0 200 96" preserveAspectRatio="none"><path class="hscfill" data-role="fill" d=""/><path class="hscarc" d="M12 82 Q100 -6 188 82"/><line class="hschoriz" x1="0" y1="82" x2="200" y2="82"/><circle class="hscsun" data-role="sun" cx="12" cy="82" r="7"/></svg>';
      return '<div class="hsc"><div class="hscarcwrap">'+svg+(w.showTime?'<div class="hscnow" data-role="now"></div>':'')+'</div><div class="hscrow"><span class="hsct"><svg class="scic" viewBox="0 0 24 24">'+ICONS.sunrise[1]+'</svg><span data-role="val">–</span></span><span class="hsclen" data-role="len"></span><span class="hsct"><svg class="scic" viewBox="0 0 24 24">'+ICONS.sunset[1]+'</svg><span data-role="val2">–</span></span></div></div>';},
    props:function(w){return row('Uhrzeit anzeigen','<input type="checkbox" id="pSunTime"'+(w.showTime?' checked':'')+'>')
      +row('Nacht + Mond','<input type="checkbox" id="pSunNight"'+(w.showNight?' checked':'')+'>');},
    wire:function(w){if($('#pSunTime'))$('#pSunTime').onchange=function(){w.showTime=this.checked||undefined;render();commit();};
      if($('#pSunNight'))$('#pSunNight').onchange=function(){w.showNight=this.checked||undefined;render();refreshSun(w);commit();};},
    live:function(w,el,id,d,base,txt,on){refreshSun(w);return;}
  });
