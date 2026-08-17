  // ===== Widget: Regen-Intensität 48 h (rainintensity) =====
  //
  //  Regen-Leiste ueber ein Zeitfenster (Default 48 h): je Slot die staerkste erwartete
  //  Intensitaet in mm/h, eingefaerbt in der FARBSKALA DES RADARS. Zusammenhaengende
  //  Regenslots gelten als Phase. Kopf: Titel + Kurz-Zusammenfassung „<Intensitaet> gegen
  //  HH:00 · N Phasen". Zeitachse mit 6h-Ticks. Datenquelle: RadarMeta-JSON (forecast:[{t,v}])
  //  — dieselbe Variable wie das rainradar-Widget.
  //
  //  Frueher zeigte die Leiste nur 0 oder 1, also Regen ja/nein. Die Intensitaet wurde zwar
  //  berechnet, aber nur fuer die Ueberschrift benutzt und danach weggeworfen: zehn Millimeter
  //  Starkregen sahen aus wie Niesel. Die Farbskala ist aus dem Radarmodul uebernommen
  //  (WeatherRadar::getRainColor), damit Leiste und Karte dasselbe Blau fuer dasselbe Wetter
  //  zeigen — zwei Skalen fuer dieselbe Groesse waeren schlimmer als gar keine Farbe.

  (function(){
    function riDemo(){var out=[],base=Math.floor(Date.now()/3600000)*3600;
      var pat=[0,0,0,0,1,1,0,0,1,1,0,1,1,1,1,1,1,0,0,0,0,0,0,0]; // 24 x 2h Beispiel
      for(var i=0;i<48;i++)out.push({t:base+i*3600,v:pat[Math.floor(i/2)]?1.25:0}); return out;}
    function riForecast(w){
      if(typeof DOKU!=='undefined'&&DOKU)return riDemo();
      var d=w.varId&&_lastVals[w.varId]; if(!d)return null;
      try{var m=JSON.parse(d.v);return (m&&m.forecast)||[];}catch(e){return null;}
    }
    // Stufen des Radars (WeatherRadar::getRainColor / rainDefinitions). Text UND Farbe kommen
    // aus derselben Tabelle, sonst widersprechen sich Ueberschrift und Leiste.
    var RI_SKALA=[
      {bis:0.5, farbe:'rgb(166,204,253)', wort:'Sehr leichter Regen'},
      {bis:1,   farbe:'rgb(140,153,253)', wort:'Leichter Regen'},
      {bis:3,   farbe:'rgb(115,102,254)', wort:'Mäßiger Regen'},
      {bis:5,   farbe:'rgb(88,51,254)',   wort:'Regen'},
      {bis:10,  farbe:'rgb(53,0,183)',    wort:'Intensiver Regen'},
      {bis:15,  farbe:'rgb(112,31,128)',  wort:'Starker Regen'},
      {bis:1e9, farbe:'rgb(140,17,170)',  wort:'Sehr starker Regen'}];
    function riStufe(v){for(var i=0;i<RI_SKALA.length;i++)if(v<=RI_SKALA[i].bis)return RI_SKALA[i];
      return RI_SKALA[RI_SKALA.length-1];}
    function riWord(v){return riStufe(v).wort;}
    // Dunkle Radarblaus brauchen weisse Schrift, das helle Hellblau eine dunkle — sonst ist
    // die Zahl auf der eigenen Zelle nicht mehr zu lesen.
    function riInk(farbe){var m=farbe.match(/(\d+),(\d+),(\d+)/); if(!m)return '#fff';
      var l=(0.299*(+m[1])+0.587*(+m[2])+0.114*(+m[3]));
      return l>150?'#17242a':'#fff';}
    function riNum(v){ // knapp halten: die Zellen sind schmal
      return v>=10?String(Math.round(v)):(Math.round(v*10)/10).toString().replace('.',',');}
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
      var title=escL(w.title||'Regen 48 h'), b=riBuild(w);
      var accent=w.riColor?('var(--'+esc(w.riColor)+')'):'var(--info)';
      var sum='';
      if(!b){ sum=''; }
      else if(b.phases===0){ sum='Kein Regen in den nächsten '+b.hours+' h'; }
      else { sum=esc(riWord(b.maxAll))+' gegen <b style="color:var(--text)">'+riHHMM(b.onset)+'</b> · '+b.phases+' Phase'+(b.phases>1?'n':''); }
      // Alle Masse aus der Kachel ableiten (.w ist Groessen-Container): die Leiste sitzt mal in
      // einer flachen 560x96-Kachel, mal doppelt so gross. Untergrenzen halten die Ziffern lesbar.
      var h='<div class="rint" style="position:absolute;inset:0;display:flex;flex-direction:column;background:var(--surface);border-radius:inherit;padding:clamp(6px,3.5cqmin,14px) clamp(8px,4.5cqmin,18px);box-sizing:border-box">'
        +'<div class="rint-head" style="display:flex;justify-content:space-between;align-items:baseline;gap:clamp(6px,3cqmin,14px);font-size:clamp(9px,3.5cqmin,13px);letter-spacing:.4px;color:var(--muted);text-transform:uppercase">'
          +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+title+'</span>'
          // Zusammenfassung darf schrumpfen und notfalls kuerzen, sonst schiebt sie den Titel weg
          +'<span style="text-transform:none;letter-spacing:0;color:var(--muted);flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+sum+'</span></div>';
      if(!b){ h+='<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:clamp(10px,4cqmin,14px)">Keine Vorhersagedaten</div></div>'; return h; }
      // Zellen
      h+='<div class="rint-cells" style="display:flex;gap:clamp(2px,1.2cqmin,5px);margin-top:clamp(5px,3cqmin,12px);flex:1;align-items:stretch">';
      b.slots.forEach(function(s){
        var on=s.on, st=on?riStufe(s.max):null;
        h+='<div title="'+(on?riNum(s.max)+' mm/h · '+esc(st.wort):'kein Regen')+'"'
          +' style="flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;border-radius:clamp(4px,2.5cqmin,9px);font-size:clamp(8px,4cqmin,15px);font-variant-numeric:tabular-nums;'
          +(on?('background:'+st.farbe+';color:'+riInk(st.farbe)+';font-weight:600')
              :'background:var(--surface-2);color:var(--faint)')+'">'
          +(on?riNum(s.max):'0')+'</div>';
      });
      h+='</div>';
      // Zeitachse (6h-Ticks)
      var perTick=Math.max(1,Math.round(6/b.sh)); // Slots je 6h
      h+='<div class="rint-axis" style="display:flex;margin-top:clamp(3px,2cqmin,8px);font-size:clamp(8px,3cqmin,12px);color:var(--muted);font-variant-numeric:tabular-nums">';
      b.slots.forEach(function(s,i){
        var lbl=(i%perTick===0)?riHHMM(s.t):'';
        h+='<div style="flex:1 1 0;min-width:0;text-align:'+(i===0?'left':'center')+'">'+lbl+'</div>';
      });
      h+='</div></div>';
      return h;
    }
    function riPaint(w){var el=riEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=riRender(w);}

    defWidget('rainintensity',{
      label:'Regen-Intensität 48 h', cat:'Wetter & Zeit', paletteIcon:'raindrop', size:[560,96],
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
