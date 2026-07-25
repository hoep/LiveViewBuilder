  // ===== Widget: Kamera+ (campro) =====
  defWidget('campro',{
    label:'Kamera+', paletteIcon:'camera', size:[260,170],
    render:function(w){return '<div class="hcampro"><img data-role="cam" src="'+(w.mediaId?('?api=media&id='+w.mediaId):'')+'"><div class="hcpmotion"'+(w.varId?' data-viddot="'+w.varId+'"':'')+'><span style="width:6px;height:6px;border-radius:50%;background:#fff"></span>Bewegung</div><div class="hcpname">'+esc(w.label||'')+'</div></div>';},
    props:function(w){return (w.type==='campro'?row('Media-ID','<input id="pMedia" value="'+(w.mediaId||'')+'" placeholder="Media-ID">'):'');}
  });
