  // ===== Widget: Kamera — Live-Media-Bild (Kern-refreshCam-Intervall aktualisiert data-role="cam") =====
  defWidget('camera',{
    label:'Kamera', paletteIcon:'camera', size:[260,160],
    render:function(w){return '<img data-role="cam" alt="'+esc(w.label||'')+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:var(--surface-2)" src="'+(w.mediaId?('?api=media&id='+w.mediaId):'')+'"><div class="wcamnm">'+esc(w.label||'')+'</div>';},
    props:function(w){return row('Aktualisierung (s)','<input id="pCamRef" type="number" min="1" value="'+(w.refresh||15)+'">');},
    wire:function(w){if($('#pCamRef'))$('#pCamRef').oninput=function(){w.refresh=parseInt(this.value)||15;};}
  });
