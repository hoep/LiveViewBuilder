  // ===== Widget: Kamera — Einzelbild (Media-Objekt) oder Live-Stream =====
  // Quellen (w.camSrc):
  //   'media'  : Media-Objekt aus Symcon, wird zyklisch neu geladen (Kern-Intervall -> refreshCam)
  //   'mjpeg'  : MJPEG-Endlosstream der Kamera, direkt vom Browser geladen - die VM ist NICHT
  //              beteiligt und wird dadurch auch nicht belastet.
  //   'go2rtc' : RTSP/RTSPS ueber das go2rtc-Gateway. Browser koennen RTSP nicht selbst abspielen;
  //              go2rtc setzt es auf ein browsertaugliches Format um.
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
  // Quelle des <img>-Elements je nach Modus
  function _camImgSrc(w){
    var m=w.camSrc||'media';
    if(m==='mjpeg')return w.camUrl||'';
    if(m==='media')return w.mediaId?('?api=media&id='+w.mediaId):'';
    return '';
  }
  defWidget('camera',{
    label:'Kamera', cat:'Medien', paletteIcon:'camera', size:[260,160],
    render:function(w){
      var m=w.camSrc||'media',fit=_camFitCSS(w),nm='<div class="wcamnm">'+escL(w.label||'')+'</div>';
      if(m==='go2rtc'){
        var base=(w.g2Base||'').replace(/\/+$/,''),strm=encodeURIComponent(w.g2Stream||'');
        if(!base||!w.g2Stream)return '<div class="wcam"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:clamp(10px,4cqmin,15px);color:var(--faint);text-align:center;padding:clamp(6px,4cqmin,14px)">go2rtc: Adresse und Stream-Name setzen</div>'+nm+'</div>';
        // go2rtc liefert eine fertige Player-Seite je Stream; als iframe eingebettet bleibt das Widget schlank
        var mo=(w.g2Mode||'webrtc');
        return '<div class="wcam"><iframe data-role="camframe" src="'+esc(base+'/stream.html?src='+strm+'&mode='+mo)+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#000" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>'+nm+'</div>';
      }
      return '<div class="wcam"><img data-role="cam"'+((m==='media'&&w.mediaId)?' data-media="'+esc(String(w.mediaId))+'"':'')+' alt="'+esc(w.label||'')+'" style="object-fit:'+fit+'" src="'+esc(_camImgSrc(w))+'">'+nm+'</div>';
    },
    props:function(w){
      var m=w.camSrc||'media';
      var h=row('Quelle','<select id="pCamSrc">'
          +'<option value="media"'+(m==='media'?' selected':'')+'>Media-Objekt (Einzelbild)</option>'
          +'<option value="mjpeg"'+(m==='mjpeg'?' selected':'')+'>MJPEG-Stream (URL)</option>'
          +'<option value="go2rtc"'+(m==='go2rtc'?' selected':'')+'>RTSP über go2rtc</option></select>');
      if(m==='media')h+=row('Aktualisierung (s)','<input id="pCamRef" type="number" min="1" value="'+(w.refresh||15)+'">');
      if(m==='mjpeg')h+=row('MJPEG-URL','<input id="pCamUrl" value="'+esc(w.camUrl||'')+'" placeholder="http://kamera/…/mjpeg" style="width:100%">')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Der Browser holt den Stream direkt von der Kamera — die VM ist nicht beteiligt. Für mehrere Kacheln den 640er Substream der Kamera verwenden.</div>';
      if(m==='go2rtc')h+=row('go2rtc-Adresse','<input id="pG2Base" value="'+esc(w.g2Base||'')+'" placeholder="http://10.10.20.250:1984" style="width:100%">')
        +row('Stream-Name','<input id="pG2Stream" value="'+esc(w.g2Stream||'')+'" placeholder="wie in go2rtc.yaml">')
        +row('Verfahren','<select id="pG2Mode"><option value="webrtc"'+((w.g2Mode||'webrtc')==='webrtc'?' selected':'')+'>WebRTC (geringste Verzögerung)</option><option value="mse"'+(w.g2Mode==='mse'?' selected':'')+'>MSE (kompatibler)</option><option value="mjpeg"'+(w.g2Mode==='mjpeg'?' selected':'')+'>MJPEG (am genügsamsten im Browser)</option></select>');
      return h+_camFitSel(w);
    },
    wire:function(w){
      _camFitWire(w);
      if($('#pCamSrc'))$('#pCamSrc').onchange=function(){w.camSrc=this.value;render();renderProps();commit();};
      if($('#pCamRef'))$('#pCamRef').oninput=function(){w.refresh=parseInt(this.value)||15;commit();};
      if($('#pCamUrl'))$('#pCamUrl').onchange=function(){w.camUrl=this.value||undefined;render();commit();};
      if($('#pG2Base'))$('#pG2Base').onchange=function(){w.g2Base=this.value||undefined;render();commit();};
      if($('#pG2Stream'))$('#pG2Stream').onchange=function(){w.g2Stream=this.value||undefined;render();commit();};
      if($('#pG2Mode'))$('#pG2Mode').onchange=function(){w.g2Mode=this.value;render();commit();};
    },
    mount:function(w){_camAspect(w);}
  });
