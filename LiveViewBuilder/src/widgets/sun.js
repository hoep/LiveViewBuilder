  // Widget: sun (Sonne) — Auf-/Untergang
  defWidget('sun',{
    label:'Sonne',
    cat:'Wetter & Zeit',
    paletteIcon:'sun',
    size:[210,88],
    // Icons und Spaltenabstand folgen der Kachel (die Klasse hsic bleibt fuer Farbe/Strichstaerke
    // stehen, nur die feste Kantenlaenge von 26 px wird ueberschrieben).
    render:function(w){var ics='width:clamp(14px,13cqmin,40px);height:clamp(14px,13cqmin,40px)';
      return '<div class="hsun"><div class="hsunrow" style="gap:clamp(10px,9cqmin,34px)"><div class="hscol"><svg class="hsic" viewBox="0 0 24 24" style="'+ics+'">'+ICONS.sunrise[1]+'</svg><div class="hstime" data-role="val">–</div><div class="hslbl">Aufgang</div></div><div class="hscol"><svg class="hsic" viewBox="0 0 24 24" style="'+ics+'">'+ICONS.sunset[1]+'</svg><div class="hstime" data-role="val2">–</div><div class="hslbl">Untergang</div></div></div></div>';},
    live:function(w,el,id,d,base,txt,on){
      if(w.varId===id){var s1=$('[data-role=val]',el);if(s1)s1.textContent=txt;}
      if(w.varId2===id){var s2=$('[data-role=val2]',el);if(s2)s2.textContent=txt;}
    }
  });
