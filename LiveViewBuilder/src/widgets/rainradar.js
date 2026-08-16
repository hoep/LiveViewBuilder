  // ===== Widget: Niederschlagsradar (rainradar) =====
  //
  //  Zeigt das Radar (PHPRainRadar, System A) mit STANDORT-ZENTRIERTEM Cover-Clipping:
  //  der Standort (aus RadarMeta img.lx/ly in Prozent, im Widget ueberschreibbar) sitzt
  //  immer in der Mitte, das Bild fuellt die Kachel verzerrungsfrei (uniforme Skalierung)
  //  und wird am Rand beschnitten — kein Stretch.
  //
  //  Animation: Standard = animiertes GIF (Original-Tempo). Ist "Animationsdauer" > 0 und
  //  liegen Einzelframes (RadarMeta.frames) vor, schaltet das Widget die Frames per Timer
  //  mit dem eingestellten Tempo durch (clientseitig regelbar).

  (function(){
    var _rrTimer={};
    /**
     * Bemisst und zentriert die Radarkarte auf die KACHEL. Frueher stand diese Rechnung
     * mitten im Datenlauf: die Pixelgroesse wurde einmal aus clip.clientWidth genommen und
     * blieb dann stehen. Beim Verkleinern oder Vergroessern der Kachel - Fenster, Zoom,
     * Regionswechsel - behielt das Bild seine alte Groesse; das Widget war schlicht nicht
     * responsiv. War die Kachel beim ersten Lauf noch nicht vermessen (clientWidth 0), griff
     * ausserdem der Rueckfall auf die Entwurfsbreite und wurde nie korrigiert.
     *
     * Die Bildquelle wird hier NICHT angefasst - nur Groesse und Lage. Sonst wuerde jede
     * Groessenaenderung die Frame-Animation neu starten lassen.
     */
    function rrFit(w, el){
      el = el || rrEl(w); if(!el) return;
      var clip=$('.rr-clip',el), img=$('.rr-img',el); if(!clip||!img) return;
      var m=rrMeta(w); if(!m||!m.img) return;
      var lxP=(w.locX!=null&&w.locX!=='')?+w.locX:(m.img.lx!=null?m.img.lx:50);
      var lyP=(w.locY!=null&&w.locY!=='')?+w.locY:(m.img.ly!=null?m.img.ly:50);
      var lx=Math.min(0.98,Math.max(0.02,lxP/100)), ly=Math.min(0.98,Math.max(0.02,lyP/100));
      var CW=clip.clientWidth, CH=clip.clientHeight;
      if(!(CW>0)||!(CH>0)) return;          // noch nicht vermessen - der Beobachter kommt wieder
      var IW=m.img.w||1, IH=m.img.h||1;
      var zoom=(w.zoom!=null&&w.zoom!==''?Math.max(1,+w.zoom):1);
      var sCover=Math.max(CW/IW,CH/IH), sFillX=CW/(2*Math.min(lx,1-lx)*IW), sFillY=CH/(2*Math.min(ly,1-ly)*IH);
      var scale=Math.max(sCover,sFillX,sFillY)*zoom, dW=IW*scale, dH=IH*scale;
      img.style.width=dW+'px'; img.style.height=dH+'px';
      img.style.left=(CW/2-lx*dW)+'px'; img.style.top=(CH/2-ly*dH)+'px';
    }

    /** Haengt EINEN Groessenbeobachter an die Kachel (mehrfaches Aufrufen ist unschaedlich). */
    function rrObserve(w, el){
      var clip=$('.rr-clip',el); if(!clip||clip._rrRO) return;
      if(typeof ResizeObserver!=='function') return;
      clip._rrRO=new ResizeObserver(function(){ rrFit(w, rrEl(w)); });
      clip._rrRO.observe(clip);
    }

    function rrStop(w){ if(_rrTimer[w.id]){clearInterval(_rrTimer[w.id]);delete _rrTimer[w.id];} }
    function rrMeta(w){
      if(typeof DOKU!=='undefined'&&DOKU) return {img:{w:1398,h:798,lx:62.59,ly:39.6,url:'',ts:'04.08.26 15:00'},frames:[],
        forecast:(function(){var a=[],b=Math.floor(Date.now()/3600000)*3600;for(var i=0;i<48;i++)a.push({t:b+i*3600,v:0});return a;})()};
      var d=w.varId&&_lastVals[w.varId]; if(!d)return null;
      try{ return JSON.parse(d.v); }catch(e){ return null; }
    }
    function rrWord(v){ // mm/h -> Intensitaetstext (wie rainintensity)
      if(v<0.5)return 'Sehr leichter Regen'; if(v<1)return 'Leichter Regen'; if(v<3)return 'Mäßiger Regen';
      if(v<5)return 'Regen'; if(v<10)return 'Intensiver Regen'; if(v<15)return 'Starker Regen';
      if(v<20)return 'Sehr starker Regen'; return 'Extremer Regen'; }
    function rrHHMM(t){var d=new Date(t*1000);return (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes();}
    function rrSummary(w,m){ // Vorhersage-Kurztext aus RadarMeta.forecast
      var fc=(m&&m.forecast)||[]; if(!fc.length)return '';
      fc=fc.slice().sort(function(a,b){return a.t-b.t;});
      var hours=(w.sumHours!=null&&w.sumHours!==''?Math.max(6,Math.min(96,+w.sumHours)):Math.min(48,fc.length));
      fc=fc.slice(0,hours);
      var thr=0.1, maxAll=0, onset=null, phases=0, inRun=false;
      fc.forEach(function(p){ var v=+p.v||0; maxAll=Math.max(maxAll,v); var on=v>=thr;
        if(on&&!inRun){phases++;inRun=true;if(onset==null)onset=p.t;} else if(!on)inRun=false; });
      if(phases===0)return 'Kein Regen in den nächsten '+hours+' h';
      return rrWord(maxAll)+' gegen '+rrHHMM(onset);
    }
    function rrEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function rrRender(w){
      var title=escL(w.title||'Niederschlagsradar');
      return '<div class="rr" style="position:absolute;inset:0;display:flex;flex-direction:column;background:var(--surface);border-radius:inherit;overflow:hidden">'
        // Kopfzeile aus der Kachelgroesse: auf der kleinen Kachel bleibt die Karte gross,
        // auf dem Wandpanel wird die Zeile lesbar. Die drei Spans erben die Groesse.
        +'<div class="rr-head" style="display:flex;justify-content:space-between;align-items:center;gap:clamp(5px,2.2cqmin,12px);padding:clamp(4px,1.6cqmin,9px) clamp(7px,3cqmin,14px);font-size:clamp(9px,2.6cqmin,13px);letter-spacing:.4px;color:var(--muted);text-transform:uppercase;flex:0 0 auto">'
          +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto">'+title+'</span>'
          +'<span data-role="rrsum" style="text-transform:none;letter-spacing:0;color:var(--text);flex:1 1 auto;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>'
          +'<span data-role="rrts" style="font-family:monospace;letter-spacing:0;flex:0 0 auto;opacity:.7"></span></div>'
        +'<div class="rr-clip" style="position:relative;flex:1 1 auto;overflow:hidden;background:var(--surface-2)">'
          +'<img class="rr-img" style="position:absolute;max-width:none;display:none" alt="">'
          // Marker waechst mit der Kachel; Ring und Punkt sind Prozent DES Markers, damit das
          // Verhaeltnis in jeder Groesse gleich bleibt (Rahmenstaerke bleibt bewusst fest).
          +'<div class="rr-mk" style="position:absolute;left:50%;top:50%;width:clamp(12px,4.5cqmin,26px);height:clamp(12px,4.5cqmin,26px);transform:translate(-50%,-50%);pointer-events:none">'
            +'<span style="position:absolute;left:50%;top:50%;width:70%;height:70%;transform:translate(-50%,-50%);border:2px solid #fff;border-radius:50%;box-sizing:border-box;box-shadow:0 0 0 1.5px rgba(0,0,0,.45)"></span>'
            +'<span style="position:absolute;left:50%;top:50%;width:25%;height:25%;transform:translate(-50%,-50%);background:#e53935;border-radius:50%"></span></div>'
          +'<div class="rr-empty" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:var(--muted);font-size:clamp(10px,3cqmin,14px)">Radarkarte …</div>'
        +'</div></div>';
    }
    function rrPaint(w){
      var el=rrEl(w);if(!el){rrStop(w);return;} var host=el.querySelector('.winner')||el;
      if(!$('.rr-clip',el)) host.innerHTML=rrRender(w);
      var clip=$('.rr-clip',el), img=$('.rr-img',el), tsEl=$('[data-role=rrts]',el),
          mk=$('.rr-mk',el), empty=$('.rr-empty',el), sumEl=$('[data-role=rrsum]',el);
      if(!clip){rrStop(w);return;}
      rrStop(w); // bestehenden Frame-Timer stoppen; ggf. unten neu starten
      var m=rrMeta(w);
      if(!m||!m.img){ if(img)img.style.display='none'; if(mk)mk.style.display='none'; if(empty)empty.style.display='flex'; if(tsEl)tsEl.textContent=''; if(sumEl)sumEl.textContent=''; return; }
      if(empty)empty.style.display='none';
      if(tsEl)tsEl.textContent=(w.showTs!==false&&m.img.ts)?m.img.ts:'';
      if(sumEl)sumEl.textContent=(w.showSum!==false)?rrSummary(w,m):'';
      // Standort (%) — Widget-Override vor Meta
      var lxP=(w.locX!=null&&w.locX!=='')?+w.locX:(m.img.lx!=null?m.img.lx:50);
      var lyP=(w.locY!=null&&w.locY!=='')?+w.locY:(m.img.ly!=null?m.img.ly:50);
      var lx=Math.min(0.98,Math.max(0.02,lxP/100)), ly=Math.min(0.98,Math.max(0.02,lyP/100));
      // Bemessung an die KACHEL binden (siehe rrFit) - und bei jeder Groessenaenderung neu.
      rrFit(w, el);
      rrObserve(w, el);
      if(img){
        img.style.display='';
        // Animation: einstellbare Frame-Rate (zeigt die Frame-UHRZEIT) ODER Original-GIF.
        var animMs=(w.animMs!=null&&w.animMs!==''?+w.animMs:0);
        var frames=(m.frames&&m.frames.length>1)?m.frames:null;
        var showTs=(w.showTs!==false);
        function frUrl(f){return (typeof f==='string')?f:(f&&f.url)||'';}
        function frT(f){return (f&&typeof f==='object')?(f.t||''):'';}
        if(animMs>0 && frames){
          var fi=0; img.src=frUrl(frames[0]);
          if(tsEl&&showTs&&frT(frames[0]))tsEl.textContent=frT(frames[0]); // Uhrzeit des angezeigten Frames
          _rrTimer[w.id]=setInterval(function(){
            var e2=rrEl(w), i2=e2&&$('.rr-img',e2), t2=e2&&$('[data-role=rrts]',e2); if(!i2){rrStop(w);return;}
            fi=(fi+1)%frames.length; i2.src=frUrl(frames[fi]);
            if(t2&&showTs&&frT(frames[fi]))t2.textContent=frT(frames[fi]);
          }, Math.max(60,animMs));
        } else if(m.img.url){ img.src=m.img.url; } // animiertes GIF (Original-Tempo, Kopf zeigt Lauf-Zeit)
        else { img.style.display='none'; }
      }
      if(mk)mk.style.display=(w.showMarker!==false)?'':'none';
    }
    defWidget('rainradar',{
      label:'Niederschlagsradar', cat:'Wetter & Zeit', paletteIcon:'cloudsun', size:[420,300],
      defaults:function(w){w.title='Niederschlagsradar';w.zoom=1;w.animMs=500;}, // Frame-Modus: zeigt die Bild-Uhrzeit
      render:rrRender,
      mount:function(w){rrPaint(w);},
      live:function(w,el,id,d){ if(id===w.varId)rrPaint(w); },
      props:function(w){
        return row('Radar-Meta-Variable','<input id="pRrVar" type="number" style="width:96px" value="'+(w.varId||'')+'"> <button class="btn" id="pRrPick" style="padding:4px 8px;font-size:11px">Var</button> <span style="font-size:11px;color:var(--muted)">RadarMeta (JSON)</span>')
          +row('Titel','<input id="pRrTitle" value="'+esc(w.title||'Niederschlagsradar')+'">')
          +'<div class="pgh">Standort (zentriert)</div>'
          +row('Standort X / Y (%)','<input id="pRrLx" type="number" min="0" max="100" step="0.1" style="width:70px" value="'+(w.locX!=null?w.locX:'')+'" placeholder="Meta"> <input id="pRrLy" type="number" min="0" max="100" step="0.1" style="width:70px" value="'+(w.locY!=null?w.locY:'')+'" placeholder="Meta"> <span style="font-size:11px;color:var(--muted)">leer = aus Meta</span>')
          +row('Zoom','<input id="pRrZoom" type="number" min="1" max="5" step="0.1" style="width:70px" value="'+(w.zoom!=null?w.zoom:1)+'"> <span style="font-size:11px;color:var(--muted)">1 = füllt</span>')
          +row('Standort-Marker','<input type="checkbox" id="pRrMk"'+(w.showMarker!==false?' checked':'')+'>')
          +'<div class="pgh">Animation</div>'
          +row('Dauer je Frame (ms)','<input id="pRrAnim" type="number" min="0" max="5000" step="50" style="width:80px" value="'+(w.animMs!=null?w.animMs:500)+'"> <span style="font-size:11px;color:var(--muted)">&gt;0 = Frames (zeigt Bild-Uhrzeit); 0 = GIF-Original</span>')
          +row('Zeitstempel','<input type="checkbox" id="pRrTs"'+(w.showTs!==false?' checked':'')+'>')
          +'<div class="pgh">Vorhersage-Text</div>'
          +row('Vorhersage-Text','<input type="checkbox" id="pRrSum"'+(w.showSum!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">z. B. „Kein Regen in den nächsten 48 h"</span>')
          +row('Fenster (h)','<input id="pRrSumH" type="number" min="6" max="96" style="width:70px" value="'+(w.sumHours!=null?w.sumHours:'')+'" placeholder="48"> <span style="font-size:11px;color:var(--muted)">leer = 48 (bzw. verfügbare)</span>');
      },
      wire:function(w){
        if($('#pRrVar'))$('#pRrVar').onchange=function(){w.varId=parseInt(this.value)||undefined;render();commit();};
        if($('#pRrPick'))$('#pRrPick').onclick=function(){showTab('vars');toast('RadarMeta-Variable im Baum anklicken');_bindTarget=w.id;};
        if($('#pRrTitle'))$('#pRrTitle').onchange=function(){w.title=this.value||undefined;render();commit();};
        if($('#pRrLx'))$('#pRrLx').oninput=function(){w.locX=this.value===''?undefined:Math.max(0,Math.min(100,parseFloat(this.value)));rrPaint(w);commit();};
        if($('#pRrLy'))$('#pRrLy').oninput=function(){w.locY=this.value===''?undefined:Math.max(0,Math.min(100,parseFloat(this.value)));rrPaint(w);commit();};
        if($('#pRrZoom'))$('#pRrZoom').oninput=function(){w.zoom=this.value===''?1:Math.max(1,parseFloat(this.value));rrPaint(w);commit();};
        if($('#pRrMk'))$('#pRrMk').onchange=function(){w.showMarker=this.checked?undefined:false;rrPaint(w);commit();};
        if($('#pRrAnim'))$('#pRrAnim').oninput=function(){w.animMs=this.value===''?0:Math.max(0,parseInt(this.value)||0);rrPaint(w);commit();};
        if($('#pRrTs'))$('#pRrTs').onchange=function(){w.showTs=this.checked?undefined:false;rrPaint(w);commit();};
        if($('#pRrSum'))$('#pRrSum').onchange=function(){w.showSum=this.checked?undefined:false;rrPaint(w);commit();};
        if($('#pRrSumH'))$('#pRrSumH').oninput=function(){w.sumHours=this.value===''?undefined:Math.max(6,Math.min(96,parseInt(this.value)||48));rrPaint(w);commit();};
      }
    });
  })();
