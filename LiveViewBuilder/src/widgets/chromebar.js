  // ===== Widget: Bar (horizontale Leiste) =====
  // Sonderfall: Instanzen liegen NICHT in state.widgets, sondern global in store.chrome,
  // damit sie auf ALLEN Seiten (ausser Popups) erscheinen - im Builder wie zur Laufzeit.
  // Anlegen faengt addWidget ab, gerendert wird in js/10-chrome.js.
  defWidget('chromebar',{
    label:'Bar (Leiste)', cat:'Leisten (alle Seiten)', paletteIcon:'wtile', size:[0,56],
    render:function(w){return '';},        // reiner Container - Inhalt sind die Kind-Widgets
    props:function(w){return chromeProps(w);},
    wire:function(w){chromeWire(w);}
  });
