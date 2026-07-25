  // ===== Widget: Kamera+ (campro) — nutzt die gemeinsamen Kamera-Helfer aus camera.js =====
  defWidget('campro',{
    label:'Kamera+', paletteIcon:'camera', size:[260,170],
    render:function(w){return '<div class="hcampro"><img data-role="cam"'+(w.mediaId?' data-media="'+esc(String(w.mediaId))+'"':'')+' style="object-fit:'+_camFitCSS(w)+'" src="'+(w.mediaId?('?api=media&id='+w.mediaId):'')+'"><div class="hcpmotion"'+(w.varId?' data-viddot="'+w.varId+'"':'')+'><span style="width:6px;height:6px;border-radius:50%;background:#fff"></span>Bewegung</div><div class="hcpname">'+esc(w.label||'')+'</div></div>';},
    props:function(w){return _camFitSel(w)+row('Media-ID','<input id="pMedia" value="'+(w.mediaId||'')+'" placeholder="Media-ID">');},
    wire:function(w){_camFitWire(w);var m=$('#pMedia');if(m)m.oninput=function(){w.mediaId=this.value.trim()||undefined;render();};},
    mount:function(w){_camAspect(w);}
  });
