  // ===== Widget: Kamera — Live-Media-Bild (Kern-refreshCam-Intervall aktualisiert data-role="cam") =====
  // Gemeinsame Kamera-Helfer (auch von campro genutzt):
  function _camFitCSS(w){return (w.camFit==='cover')?'cover':'contain';}       // 'aspect' zeigt ebenfalls das ganze Bild -> contain
  function _camFitSel(w){return row('Bild','<select id="pCamFit"><option value="contain"'+((w.camFit||'contain')==='contain'?' selected':'')+'>Ganzes Bild</option><option value="cover"'+(w.camFit==='cover'?' selected':'')+'>Füllen (beschnitten)</option><option value="aspect"'+(w.camFit==='aspect'?' selected':'')+'>An Bild anpassen (Höhe folgt b/h)</option></select>');}
  function _camFitWire(w){var s=$('#pCamFit');if(s)s.onchange=function(){w.camFit=this.value;render();};}
  function _camAspect(w){ // Modus "An Bild anpassen": Widget-Höhe folgt automatisch dem Seitenverhältnis des Kamerabilds
    if((w.camFit||'')!=='aspect')return;
    if(typeof mode!=='undefined'&&mode!=='edit')return; // nur im Editor die Design-Höhe setzen; im Run macht SmartFit die Größe
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var img=$('img[data-role=cam]',el);if(!img)return;
    var fn=function(){if(!img.naturalWidth||!img.naturalHeight)return;var nh=Math.round(w.w*img.naturalHeight/img.naturalWidth);if(nh>0&&Math.abs(nh-(w.h||0))>1){w.h=nh;applyGeom(w);commit();}};
    img.onload=fn;if(img.complete)fn();
  }
  defWidget('camera',{
    label:'Kamera', paletteIcon:'camera', size:[260,160],
    render:function(w){return '<div class="wcam"><img data-role="cam"'+(w.mediaId?' data-media="'+esc(String(w.mediaId))+'"':'')+' alt="'+esc(w.label||'')+'" style="object-fit:'+_camFitCSS(w)+'" src="'+(w.mediaId?('?api=media&id='+w.mediaId):'')+'"><div class="wcamnm">'+esc(w.label||'')+'</div></div>';},
    props:function(w){return _camFitSel(w)+row('Aktualisierung (s)','<input id="pCamRef" type="number" min="1" value="'+(w.refresh||15)+'">');},
    wire:function(w){_camFitWire(w);if($('#pCamRef'))$('#pCamRef').oninput=function(){w.refresh=parseInt(this.value)||15;};},
    mount:function(w){_camAspect(w);}
  });
