  // ===== Widget: Regen-Intensität 48 h (rainintensity) =====
  //
  //  Binarisierte Regen-Leiste ueber ein Zeitfenster (Default 48 h): je Slot 0/1 (Regen ja/nein
  //  nach Schwelle in mm/h), zusammenhaengende 1er als Phase. Kopf: Titel + Kurz-Zusammenfassung
  //  „<Intensitaet> gegen HH:00 · N Phasen". Zeitachse mit 6h-Ticks. Datenquelle: RadarMeta-JSON
  //  (forecast:[{t,v}]) — dieselbe Variable wie das rainradar-Widget.

  (function(){
    function riDemo(){var out=[],base=Math.floor(Date.now()/3600000)*3600;
      var pat=[0,0,0,0,1,1,0,0,1,1,0,1,1,1,1,1,1,0,0,0,0,0,0,0]; // 24 x 2h Beispiel
      for(var i=0;i<48;i++)out.push({t:base+i*3600,v:pat[Math.floor(i/2)]?1.25:0}); return out;}
    function riForecast(w){
      if(typeof DOKU!=='undefined'&&DOKU)return riDemo();
      var d=w.varId&&_lastVals[w.varId]; if(!d)return null;
      try{var m=JSON.parse(d.v);return (m&&m.forecast)||[];}catch(e){return null;}
    }
    function riWord(v){ // mm/h -> Intensitaetstext
      if(v<0.5)return 'Sehr leichter Regen'; if(v<1)return 'Leichter Regen'; if(v<3)return 'Mäßiger Regen';
      if(v<5)return 'Regen'; if(v<10)return 'Intensiver Regen'; if(v<15)return 'Starker Regen';
      if(v<20)return 'Sehr starker Regen'; return 'Extremer Regen'; }
    function riEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}

    function riBuild(w){
      var fc=riForecast(w); if(!fc||!fc.length)return null;
      fc=fc.slice().sort(function(a,b){return a.t-b.t;});
      var hours=(w.riHours!=null&&w.riHours!==''?Math.max(6,Math.min(96,+w.riHours)):48);
      var sh=(w.riSlot!=null&&w.riSlot!==''?Math.max(1,Math.min(6,+w.riSlot)):2);
      var thr=(w.riThr!=null&&w.riThr!==''?Math.max(0,+w.riThr):0.1);
      fc=fc.slice(0,hours);
      var slots=[]; for(var i=0;i<fc.length;i+=sh){ var mx=0,t=fc[i].t;
        for(var j=i;j<Math.min(i+sh,fc.length);j++)mx=Math.max(mx,+fc[j].v||0);
        slots.push({t:t,max:mx,on:mx>=thr?1:0}); }
      // Phasen (Laeufe von 1)
      var phases=0,onset=null,maxAll=0,inRun=false;
      slots.forEach(function(s){ maxAll=Math.max(maxAll,s.max);
        if(s.on&&!inRun){phases++;inRun=true;if(onset==null)onset=s.t;} else if(!s.on)inRun=false; });
      return {slots:slots,phases:phases,onset:onset,maxAll:maxAll,sh:sh,hours:hours};
    }
    function riHHMM(t){var d=new Date(t*1000);return (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes();}

    function riRender(w){
      var title=esc(w.title||'Regen 48 h'), b=riBuild(w);
      var accent=w.riColor?('var(--'+esc(w.riColor)+')'):'var(--info)';
      var sum='';
      if(!b){ sum=''; }
      else if(b.phases===0){ sum='Kein Regen in den nächsten '+b.hours+' h'; }
      else { sum=esc(riWord(b.maxAll))+' gegen <b style="color:var(--text)">'+riHHMM(b.onset)+'</b> · '+b.phases+' Phase'+(b.phases>1?'n':''); }
      var h='<div class="rint" style="position:absolute;inset:0;display:flex;flex-direction:column;background:var(--surface);border-radius:inherit;padding:8px 12px;box-sizing:border-box">'
        +'<div class="rint-head" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:11px;letter-spacing:.4px;color:var(--muted);text-transform:uppercase">'
          +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+title+'</span>'
          +'<span style="text-transform:none;letter-spacing:0;color:var(--muted);flex:0 0 auto">'+sum+'</span></div>';
      if(!b){ h+='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px">Keine Vorhersagedaten</div></div>'; return h; }
      // Zellen
      h+='<div class="rint-cells" style="display:flex;gap:3px;margin-top:8px;flex:1;align-items:stretch">';
      b.slots.forEach(function(s){
        var on=s.on;
        h+='<div style="flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:11px;font-variant-numeric:tabular-nums;'
          +(on?('background:'+accent+';color:#fff;font-weight:600'):'background:var(--surface-2);color:var(--faint)')+'">'+(on?1:0)+'</div>';
      });
      h+='</div>';
      // Zeitachse (6h-Ticks)
      var perTick=Math.max(1,Math.round(6/b.sh)); // Slots je 6h
      h+='<div class="rint-axis" style="display:flex;margin-top:5px;font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums">';
      b.slots.forEach(function(s,i){
        var lbl=(i%perTick===0)?riHHMM(s.t):'';
        h+='<div style="flex:1 1 0;min-width:0;text-align:'+(i===0?'left':'center')+'">'+lbl+'</div>';
      });
      h+='</div></div>';
      return h;
    }
    function riPaint(w){var el=riEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=riRender(w);}

    defWidget('rainintensity',{
      label:'Regen-Intensität 48 h', paletteIcon:'raindrop', size:[560,96],
      defaults:function(w){w.title='Regen 48 h';w.riHours=48;w.riSlot=2;w.riThr=0.1;w.riColor='info';},
      render:riRender,
      mount:function(w){/* render liefert bereits alles */},
      live:function(w,el,id,d){ if(id===w.varId)riPaint(w); },
      props:function(w){
        return row('Radar-Meta-Variable','<input id="pRiVar" type="number" style="width:96px" value="'+(w.varId||'')+'"> <button class="btn" id="pRiPick" style="padding:4px 8px;font-size:11px">Var</button> <span style="font-size:11px;color:var(--muted)">RadarMeta (JSON)</span>')
          +row('Titel','<input id="pRiTitle" value="'+esc(w.title||'Regen 48 h')+'">')
          +row('Fenster (h) / Slot (h)','<input id="pRiHours" type="number" min="6" max="96" style="width:60px" value="'+(w.riHours!=null?w.riHours:48)+'"> <input id="pRiSlot" type="number" min="1" max="6" style="width:52px" value="'+(w.riSlot!=null?w.riSlot:2)+'">')
          +row('Regen-Schwelle (mm/h)','<input id="pRiThr" type="number" min="0" step="0.1" style="width:70px" value="'+(w.riThr!=null?w.riThr:0.1)+'">')
          +row('Farbe (Regen)',skinSel(w.riColor||'info','id="pRiColor"'));
      },
      wire:function(w){
        function re(){riPaint(w);commit();}
        if($('#pRiVar'))$('#pRiVar').onchange=function(){w.varId=parseInt(this.value)||undefined;render();commit();};
        if($('#pRiPick'))$('#pRiPick').onclick=function(){showTab('vars');toast('RadarMeta-Variable im Baum anklicken');_bindTarget=w.id;};
        if($('#pRiTitle'))$('#pRiTitle').onchange=function(){w.title=this.value||undefined;re();};
        if($('#pRiHours'))$('#pRiHours').oninput=function(){w.riHours=this.value===''?undefined:parseInt(this.value);re();};
        if($('#pRiSlot'))$('#pRiSlot').oninput=function(){w.riSlot=this.value===''?undefined:parseInt(this.value);re();};
        if($('#pRiThr'))$('#pRiThr').oninput=function(){w.riThr=this.value===''?undefined:parseFloat(this.value);re();};
        if($('#pRiColor'))$('#pRiColor').onchange=function(){w.riColor=this.value||undefined;re();};
      }
    });
  })();
