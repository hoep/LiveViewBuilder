  // ===== Widget: Niederschlagsradar (rainradar) =====
  //
  //  Zeigt das Radar-GIF (PHPRainRadar, System A) mit STANDORT-ZENTRIERTEM Cover-Clipping:
  //  der Standort (aus RadarMeta img.lx/ly in Prozent) sitzt immer in der Mitte, das Bild
  //  fuellt die Kachel verzerrungsfrei (uniforme Skalierung) und wird am Rand beschnitten —
  //  kein Stretch. Datenquelle: die RadarMeta-JSON-Variable (Bild + Standort-% + Zeitstempel).
  //
  //  Zentrier-/Fuell-Formel (Design-Masse, transform-stabil):
  //    scale = max(cover, fillX, fillY) * zoom ; Bild absolut positioniert, Standort -> Mitte.

  (function(){
    function rrMeta(w){
      if(typeof DOKU!=='undefined'&&DOKU) return {img:{w:1398,h:798,lx:62.59,ly:39.6,url:'',ts:'04.08.26 15:00'}};
      var d=w.varId&&_lastVals[w.varId]; if(!d)return null;
      try{ return JSON.parse(d.v); }catch(e){ return null; }
    }
    function rrEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function rrRender(w){
      var title=esc(w.title||'Niederschlagsradar');
      return '<div class="rr" style="position:absolute;inset:0;display:flex;flex-direction:column;background:var(--surface);border-radius:inherit;overflow:hidden">'
        +'<div class="rr-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;font-size:11px;letter-spacing:.4px;color:var(--muted);text-transform:uppercase;flex:0 0 auto">'
          +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+title+'</span>'
          +'<span data-role="rrts" style="font-family:monospace;letter-spacing:0;flex:0 0 auto"></span></div>'
        +'<div class="rr-clip" style="position:relative;flex:1 1 auto;overflow:hidden;background:var(--surface-2)">'
          +'<img class="rr-img" style="position:absolute;max-width:none;display:none" alt="">'
          +'<div class="rr-mk" style="position:absolute;left:50%;top:50%;width:16px;height:16px;transform:translate(-50%,-50%);pointer-events:none">'
            +'<span style="position:absolute;left:50%;top:50%;width:11px;height:11px;transform:translate(-50%,-50%);border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1.5px rgba(0,0,0,.45)"></span>'
            +'<span style="position:absolute;left:50%;top:50%;width:4px;height:4px;transform:translate(-50%,-50%);background:#e53935;border-radius:50%"></span></div>'
          +'<div class="rr-empty" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:var(--muted);font-size:12px">Radarkarte …</div>'
        +'</div></div>';
    }
    function rrPaint(w){
      var el=rrEl(w);if(!el)return; var host=el.querySelector('.winner')||el;
      if(!$('.rr-clip',el)) host.innerHTML=rrRender(w);
      var clip=$('.rr-clip',el), img=$('.rr-img',el), tsEl=$('[data-role=rrts]',el),
          mk=$('.rr-mk',el), empty=$('.rr-empty',el);
      if(!clip)return;
      var m=rrMeta(w);
      if(!m||!m.img){ if(img)img.style.display='none'; if(mk)mk.style.display='none'; if(empty)empty.style.display='flex'; if(tsEl)tsEl.textContent=''; return; }
      if(empty)empty.style.display='none';
      if(tsEl)tsEl.textContent=(w.showTs!==false&&m.img.ts)?m.img.ts:'';
      // Design-Masse der Clip-Flaeche (Header ~28px); transform-stabil, kein Layout-Timing-Problem.
      var CW=(clip.clientWidth||(w.w||420)), CH=(clip.clientHeight||((w.h||300)-28)); if(CW<1)CW=1; if(CH<1)CH=1;
      var IW=m.img.w||1, IH=m.img.h||1;
      var lx=Math.min(0.98,Math.max(0.02,(m.img.lx!=null?m.img.lx:50)/100));
      var ly=Math.min(0.98,Math.max(0.02,(m.img.ly!=null?m.img.ly:50)/100));
      var zoom=(w.zoom!=null&&w.zoom!==''?Math.max(1,+w.zoom):1);
      var sCover=Math.max(CW/IW,CH/IH), sFillX=CW/(2*Math.min(lx,1-lx)*IW), sFillY=CH/(2*Math.min(ly,1-ly)*IH);
      var scale=Math.max(sCover,sFillX,sFillY)*zoom, dW=IW*scale, dH=IH*scale;
      if(img){
        if(m.img.url){ if(img.getAttribute('src')!==m.img.url)img.src=m.img.url; img.style.display=''; }
        else img.style.display='none';
        img.style.width=dW+'px'; img.style.height=dH+'px';
        img.style.left=(CW/2-lx*dW)+'px'; img.style.top=(CH/2-ly*dH)+'px';
      }
      if(mk)mk.style.display=(w.showMarker!==false)?'':'none';
    }
    defWidget('rainradar',{
      label:'Niederschlagsradar', paletteIcon:'cloudsun', size:[420,300],
      defaults:function(w){w.title='Niederschlagsradar';w.zoom=1;},
      render:rrRender,
      mount:function(w){rrPaint(w);},
      live:function(w,el,id,d){ if(id===w.varId)rrPaint(w); },
      props:function(w){
        return row('Radar-Meta-Variable','<input id="pRrVar" type="number" style="width:96px" value="'+(w.varId||'')+'"> <button class="btn" id="pRrPick" style="padding:4px 8px;font-size:11px">Var</button> <span style="font-size:11px;color:var(--muted)">RadarMeta (JSON)</span>')
          +row('Titel','<input id="pRrTitle" value="'+esc(w.title||'Niederschlagsradar')+'">')
          +row('Zoom','<input id="pRrZoom" type="number" min="1" max="5" step="0.1" style="width:70px" value="'+(w.zoom!=null?w.zoom:1)+'"> <span style="font-size:11px;color:var(--muted)">1 = Standort zentriert, füllt</span>')
          +row('Standort-Marker','<input type="checkbox" id="pRrMk"'+(w.showMarker!==false?' checked':'')+'>')
          +row('Zeitstempel','<input type="checkbox" id="pRrTs"'+(w.showTs!==false?' checked':'')+'>');
      },
      wire:function(w){
        if($('#pRrVar'))$('#pRrVar').onchange=function(){w.varId=parseInt(this.value)||undefined;render();commit();};
        if($('#pRrPick'))$('#pRrPick').onclick=function(){showTab('vars');toast('RadarMeta-Variable im Baum anklicken');_bindTarget=w.id;};
        if($('#pRrTitle'))$('#pRrTitle').onchange=function(){w.title=this.value||undefined;render();commit();};
        if($('#pRrZoom'))$('#pRrZoom').oninput=function(){w.zoom=this.value===''?1:Math.max(1,parseFloat(this.value));rrPaint(w);commit();};
        if($('#pRrMk'))$('#pRrMk').onchange=function(){w.showMarker=this.checked?undefined:false;rrPaint(w);commit();};
        if($('#pRrTs'))$('#pRrTs').onchange=function(){w.showTs=this.checked?undefined:false;rrPaint(w);commit();};
      }
    });
  })();
