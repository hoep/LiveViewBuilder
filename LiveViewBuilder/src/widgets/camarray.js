  // ===== Widget: Kamera-Array — Pill-Umschalter für mehrere Kamera-Quellen =====
  //
  //  Eine Liste von Kameras (w.cams=[{label,type,src}]); oben eine Pill-Leiste, die aktive
  //  Kamera links (Icon + Name + Statuspunkt), die übrigen rechts. Klick schaltet um; es wird
  //  IMMER nur die aktive Quelle geladen (schont VM/Browser). Quelltypen wie beim Kamera-Widget:
  //    media  : Symcon-Media-Objekt (src=Media-ID)         -> zyklisch neu geladen (refreshCam)
  //    mjpeg  : MJPEG-Stream (src=URL)                      -> Browser holt direkt, VM unbeteiligt
  //    go2rtc : RTSP über go2rtc (src=Stream-Name)          -> globale Gateway-Adresse w.g2Base
  //  Fit/Darstellung gilt global (w.camFit). Pill-Farben/Schrift sind einstellbar (Skin-Farben).
  (function(){
    function _paActive(w){var n=(w.cams||[]).length;return Math.min(Math.max(parseInt(w._ci)||0,0),Math.max(0,n-1));}
    function _paStage(w,c,fit){
      if(!c)return '<div class="camarr-empty">Keine Kamera konfiguriert – im Editor Kameras hinzufügen</div>';
      var t=c.type||'media',src=String(c.src||'').trim();
      if(t==='go2rtc'){
        var base=String(w.g2Base||'').replace(/\/+$/,''),strm=encodeURIComponent(src),mo=(w.g2Mode||'webrtc');
        if(!base||!src)return '<div class="camarr-empty">go2rtc: Adresse (global) und Stream-Name setzen</div>';
        return '<iframe data-role="camframe" src="'+esc(base+'/stream.html?src='+strm+'&mode='+mo)+'" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>';
      }
      if(t==='mjpeg')return '<img data-role="cam" alt="'+esc(c.label||'')+'" style="object-fit:'+fit+'" src="'+esc(src)+'">';
      return '<img data-role="cam"'+(src?' data-media="'+esc(src)+'"':'')+' alt="'+esc(c.label||'')+'" style="object-fit:'+fit+'" src="'+(src?('?api=media&id='+esc(src)):'')+'">';
    }
    function _paPill(w,c,i,active){
      // Icon, Punkt und Innenabstand haengen an der Pill-SCHRIFT (em), nicht an festen Pixeln:
      // damit folgt die ganze Pille der responsiven --pa-fs. Das Icon-SVG bekommt die Groesse
      // inline mit, weil styles.css es sonst auf feste 14 px zwingt (.camarr-ic svg).
      var ic=active?('<span class="camarr-ic" style="width:1.15em;height:1.15em">'+iconSVG('camera').replace('<svg ','<svg style="width:100%;height:100%" ')+'</span>'):'';
      return '<button type="button" class="camarr-pill'+(active?' active':'')+'" data-caidx="'+i+'" style="gap:.5em;padding:.5em 1em;min-height:22px;box-sizing:border-box">'
        +ic
        +'<span class="camarr-lbl">'+escL(c.label||('Kamera '+(i+1)))+'</span>'
        +(active?'<i class="camarr-dot" style="width:.58em;height:.58em"></i>':'')+'</button>';
    }
    function _paStyle(w){
      var s=[],add=function(k,v){if(v)s.push(k+':'+v);};
      add('--pa-active',_skinToCss(w.paPillActive));
      add('--pa-bg',_skinToCss(w.paPillBg));
      add('--pa-tx',_skinToCss(w.paPillTx));
      add('--pa-dot',_skinToCss(w.paDot));
      // Ohne eigene Einstellung waechst die Pill-Schrift mit der Kachel (statt fester 12px aus
      // styles.css). Ist eine Groesse eingestellt, bleibt sie die Obergrenze, schrumpft auf
      // kleiner Kachel aber mit - sonst decken drei Pills das halbe Kamerabild ab.
      if(w.paFs)add('--pa-fs','min('+(parseInt(w.paFs)||12)+'px,5cqmin)');
      else add('--pa-fs','clamp(10px,3.4cqmin,16px)');
      if(w.paBold===false)s.push('--pa-fw:500');
      return s.length?(' style="'+s.join(';')+'"'):'';
    }
    // Wurzel-Element (Seite oder Popup)
    function _paRootEl(w){
      var oc=document.getElementById('ovcanvas');
      return (oc&&$('.w[data-id="'+w.id+'"]',oc))||$('.w[data-id="'+w.id+'"]',canvas);
    }
    // Auswahl-Pills am RECHTEN OBEREN ECK verankert (mit Abstand zum Rand) und von dort im Uhrzeigersinn:
    //   obere Reihe RECHTSBUENDIG (letztes Pill in der Ecke) -> rechte Kante runter -> untere Kante rechts->links -> linke Kante hoch.
    function _paLayout(w){
      var root=_paRootEl(w);if(!root)return;
      var ring=root.querySelector('[data-role=paring]');if(!ring)return;
      var W=ring.clientWidth,H=ring.clientHeight;if(W<24||H<24)return;
      // Randabstand und Luecken aus der gemessenen Kachel (K), nicht fest: auf einer kleinen
      // Kachel frisst 9px Rand sonst das Bild, auf einem Wandpanel klebt die Leiste am Rand.
      var K=Math.min(W,H);
      var pad=Math.max(6,Math.min(16,K*0.035)),gap=Math.max(4,Math.min(12,K*0.025));
      var pills=[].slice.call(ring.querySelectorAll('.camarr-pill'));if(!pills.length)return;
      var actEl=root.querySelector('.camarr-l .camarr-pill');
      if(actEl&&actEl.parentNode){actEl.parentNode.style.top=pad+'px';actEl.parentNode.style.left=pad+'px';} // aktive Pille auf denselben Rand wie der Ring
      var actW=actEl?actEl.offsetWidth:0;
      var actGap=actEl?Math.max(10,Math.min(26,K*0.06)):0;   // Abstand aktive Kamera -> erste Auswahl-Pill
      var h0=pills[0].offsetHeight||24;
      var items=pills.map(function(p){return {el:p,w:p.offsetWidth,h:p.offsetHeight};});
      var x0=pad+actW+actGap, right=W-pad;         // linke Grenze (nach aktiver Kamera) / rechter Rand (Ecke)
      // Pass 1: obere Reihe greedy fuellen
      var wsum=0, topN=0;
      for(var i=0;i<items.length;i++){
        var add=(topN?gap:0)+items[i].w;
        if(x0+wsum+add<=right){wsum+=add;topN++;}else break;
      }
      // rechtsbuendig platzieren: letztes oberes Pill endet bei W-pad (Ecke)
      var cx=right-wsum;
      for(var i=0;i<topN;i++){items[i].el.style.left=cx+'px';items[i].el.style.top=pad+'px';cx+=items[i].w+gap;}
      // Pass 2: Rest im Uhrzeigersinn — rechte Kante runter (bündig rechts), unten rechts->links, links hoch
      var edge=1, cRight=(topN?pad+h0+gap:pad), cBot=W-pad, cLeft=H-pad-h0-gap;
      for(var i=topN;i<items.length;i++){
        var it=items[i],pw=it.w,ph=it.h,done=false;
        for(var g=0;g<3&&!done;g++){
          if(edge===1){ if(cRight+ph<=H-pad){it.el.style.left=(W-pad-pw)+'px';it.el.style.top=cRight+'px';cRight+=ph+gap;done=true;}else edge=2; }
          else if(edge===2){ if(cBot-pw>=pad){it.el.style.left=(cBot-pw)+'px';it.el.style.top=(H-pad-ph)+'px';cBot-=pw+gap;done=true;}else edge=3; }
          else { if(cLeft-ph>=pad){it.el.style.top=(cLeft-ph)+'px';it.el.style.left=pad+'px';cLeft-=ph+gap;done=true;}else{it.el.style.left=pad+'px';it.el.style.top=pad+'px';done=true;} }
        }
      }
    }
    var _paRO={};
    function _paObserve(w){
      if(typeof ResizeObserver==='undefined')return;
      var root=_paRootEl(w);if(!root)return;var ring=root.querySelector('[data-role=paring]');if(!ring)return;
      if(_paRO[w.id])_paRO[w.id].disconnect();
      var ro=new ResizeObserver(function(){_paLayout(w);});ro.observe(ring);_paRO[w.id]=ro;
    }
    defWidget('camarray',{
      label:'Kamera-Array', cat:'Medien', paletteIcon:'camera', size:[360,220],
      defaults:function(w){w.cams=[{label:'Kamera 1',type:'media',src:''}];w.camFit='cover';},
      render:function(w){
        var cams=w.cams||[],ci=_paActive(w),fit=_camFitCSS(w);
        var others=cams.map(function(c,i){return i===ci?'':_paPill(w,c,i,false);}).join('');
        var act=cams.length?_paPill(w,cams[ci],ci,true):'';
        return '<div class="wcamarr"'+_paStyle(w)+'>'
          +'<div class="camarr-stage">'+_paStage(w,cams[ci],fit)+'</div>'
          +'<div class="camarr-bar"><div class="camarr-l">'+act+'</div><div class="camarr-r" data-role="paring">'+others+'</div></div>'
          +'</div>';
      },
      props:function(w){
        var h=listEditor(w,'cams','Kameras: Bezeichnung · Typ · Quelle',[
          {k:'label',ph:'Bezeichnung',h:'Pill-Text'},
          {k:'type',type:'select',def:'media',options:[['media','Media'],['mjpeg','MJPEG'],['go2rtc','RTSP']]},
          {k:'src',ph:'Media-ID / URL / Stream',h:'Quelle'}
        ]);
        h+='<div class="pgh">Quellen-Optionen</div>'
          +row('Aktualisierung (s)','<input id="pCamRef" type="number" min="1" value="'+(w.refresh||15)+'"> <span style="font-size:11px;color:var(--muted)">für Media-Objekte</span>')
          +row('go2rtc-Adresse','<input id="pG2Base" value="'+esc(w.g2Base||'')+'" placeholder="http://10.10.20.250:1984" style="width:100%">')
          +row('go2rtc-Verfahren','<select id="pG2Mode"><option value="webrtc"'+((w.g2Mode||'webrtc')==='webrtc'?' selected':'')+'>WebRTC (geringste Verzögerung)</option><option value="mse"'+(w.g2Mode==='mse'?' selected':'')+'>MSE (kompatibler)</option><option value="mjpeg"'+(w.g2Mode==='mjpeg'?' selected':'')+'>MJPEG (genügsam)</option></select>')
          +_camFitSel(w);
        h+='<div class="pgh">Pills</div>'
          +row('Aktiv-Hintergrund',skinSel(w.paPillActive||'','id="pPaActive"')+' <span style="font-size:11px;color:var(--muted)">leer = Akzent</span>')
          +row('Inaktiv-Hintergrund',skinSel(w.paPillBg||'','id="pPaBg"'))
          +row('Textfarbe inaktiv',skinSel(w.paPillTx||'','id="pPaTx"'))
          +row('Statuspunkt',skinSel(w.paDot||'','id="pPaDot"')+' <span style="font-size:11px;color:var(--muted)">leer = grün</span>')
          +row('Schriftgröße','<input id="pPaFs" type="number" min="8" max="24" value="'+(w.paFs||'')+'" placeholder="12">')
          +row('Fett','<input type="checkbox" id="pPaBold"'+(w.paBold!==false?' checked':'')+'>');
        return h;
      },
      wire:function(w){
        _camFitWire(w);
        if($('#pCamRef'))$('#pCamRef').oninput=function(){w.refresh=parseInt(this.value)||15;commit();};
        if($('#pG2Base'))$('#pG2Base').onchange=function(){w.g2Base=this.value||undefined;render();commit();};
        if($('#pG2Mode'))$('#pG2Mode').onchange=function(){w.g2Mode=this.value;render();commit();};
        if($('#pPaActive'))$('#pPaActive').onchange=function(){w.paPillActive=this.value||undefined;render();commit();};
        if($('#pPaBg'))$('#pPaBg').onchange=function(){w.paPillBg=this.value||undefined;render();commit();};
        if($('#pPaTx'))$('#pPaTx').onchange=function(){w.paPillTx=this.value||undefined;render();commit();};
        if($('#pPaDot'))$('#pPaDot').onchange=function(){w.paDot=this.value||undefined;render();commit();};
        if($('#pPaFs'))$('#pPaFs').oninput=function(){w.paFs=this.value===''?undefined:(parseInt(this.value)||undefined);render();commit();};
        if($('#pPaBold'))$('#pPaBold').onchange=function(){w.paBold=this.checked?undefined:false;render();commit();};
      },
      click:function(w,el,e){
        var b=e.target.closest('[data-caidx]');if(!b)return false;
        var i=parseInt(b.getAttribute('data-caidx'),10);if(isNaN(i)||i===_paActive(w))return true;
        w._ci=i;
        var root=(el.closest?el.closest('.w[data-id="'+w.id+'"]'):null)||el,win=root.querySelector('.winner');
        if(win){win.innerHTML=widgetInner(w);}
        _camAspect(w);_paLayout(w);
        return true;
      },
      mount:function(w){_camAspect(w);_paLayout(w);_paObserve(w);setTimeout(function(){_paLayout(w);},60);}
    });
  })();
