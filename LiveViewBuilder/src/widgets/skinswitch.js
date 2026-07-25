  // ===== Widget: Skin-Wechsler (skinswitch) — Auswahl Skin + Hell/Dunkel-Umschalter =====
  defWidget('skinswitch',{
    label:'Skin-Wechsler', paletteIcon:'moon', size:[220,46],
    defaults:function(w){w.label='Ansicht';},
    render:function(w){var _sn=Object.keys(allSkins()),_th=(store.theme||'dark');return '<div class="hskw"><select data-role="skwsel">'+_sn.map(function(n){return '<option'+(n===(store.skin||'Standard')?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select><button class="hskwb'+(_th==='light'?' on':'')+'" data-skw="light" title="Hell">'+iconSVG('sun')+'</button><button class="hskwb'+(_th==='dark'?' on':'')+'" data-skw="dark" title="Dunkel">'+iconSVG('moon')+'</button></div>';}
  });
