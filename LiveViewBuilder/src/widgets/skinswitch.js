  // ===== Widget: Skin-Wechsler (skinswitch) — Auswahl Skin + Hell/Dunkel-Umschalter =====
  defWidget('skinswitch',{
    label:'Skin-Wechsler', cat:'Leisten (alle Seiten)', paletteIcon:'moon', size:[220,46],
    defaults:function(w){w.label='Ansicht';},
    // Hell/Dunkel als Pille mit Sonne und Mond, der aktive Modus traegt einen Kreis. Die
    // Skin-Auswahl daneben ist ein normales <select> - es bekommt sein Aussehen zentral
    // (js/14-hui.js) und laesst sich mit skwSel:false ausblenden.
    render:function(w){var _sn=Object.keys(allSkins()),_th=(store.theme||'dark');
      return '<div class="hskw">'
        +(w.skwSel===false?'':'<select data-role="skwsel">'+_sn.map(function(n){return '<option'+(n===(store.skin||'Standard')?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
        +'<div class="hskwtt"><button class="hskwb'+(_th==='light'?' on':'')+'" data-skw="light" title="Hell">'+iconSVG('sun')+'</button>'
        +'<button class="hskwb'+(_th==='dark'?' on':'')+'" data-skw="dark" title="Dunkel">'+iconSVG('moon')+'</button></div></div>';},
    props:function(w){if(w.type!=='skinswitch')return '';
      return row('Skin-Auswahl zeigen','<input type="checkbox" id="pSkwSel"'+(w.skwSel===false?'':' checked')+'> <span style="font-size:11px;color:var(--muted)">aus = nur Hell/Dunkel</span>');},
    wire:function(w){if($('#pSkwSel'))$('#pSkwSel').onchange=function(){w.skwSel=this.checked?undefined:false;render();commit();};}
  });
