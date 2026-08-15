  // ===== Widget: Sidebar (vertikale Leiste) =====
  // Siehe chromebar.js - gleiches Prinzip, nur vertikal (links/rechts) und immer
  // zwischen den Bars: die Bar gewinnt, die Sidebar reicht nur bis an sie heran.
  defWidget('chromesidebar',{
    label:'Sidebar', cat:'Leisten (alle Seiten)', paletteIcon:'wtile', size:[120,0],
    render:function(w){return '';},
    props:function(w){return chromeProps(w);},
    wire:function(w){chromeWire(w);}
  });
