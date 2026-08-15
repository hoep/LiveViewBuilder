  // ===== Widget: Statistikwert (sval) — Min/Max/Ø einer geloggten Standardvariable ueber eine Periode =====
  defWidget('sval',{
    label:'Statistik', cat:'Anzeige', paletteIcon:'wkpi', size:[200,96],
    defaults:function(w){w.label='Ø Wert';w.cmpStage='day';w.statAvg=true;},
    // Benutzer-Groesse (w.valfs) bleibt dieselbe gespeicherte Zahl, wird aber als
    // clamp(min, cqmin, max) umgesetzt: auf kleinen Kacheln lesbar, auf grossen mitwachsend.
    render:function(w){var al=w.align?(';text-align:'+w.align):'';var cnt=aggParts(w).length;
      // Mehrere Werte (Min/Ø/Max) passen auf schmalen Kacheln nicht in EINE Zeile. Frueher
      // wurde die Zeile mit Ellipse gekappt und der letzte Wert fehlte einfach. Jetzt zwei
      // Massnahmen zugleich: Klasse .vstats laesst die Zeile umbrechen (CSS), und die
      // Schrift richtet sich zusaetzlich nach der KACHELBREITE (cqi) statt nur nach der
      // Hoehe — je mehr Werte, desto schmaler das Budget je Wert.
      var mul=(cnt>=3?5:6.5);
      var fsz=w.valfs?('clamp('+Math.max(10,Math.round(w.valfs*0.62))+'px,'+(w.valfs*0.16).toFixed(1)+'cqmin,'+Math.round(w.valfs*1.5)+'px)')
                     :(cnt>=2?('clamp(10px,min(15cqh,'+mul+'cqi),16px)'):'var(--wf-val)');
      var lh=(cnt>=2?'':';line-height:1.15');  // mehrzeilig regelt .vstats die Zeilenhoehe
      return '<div class="wv"><div class="wvbody" style="min-width:0'+al+'"><div class="l">'+escL(w.label||'')+(STAGECUR[cmpStage(w)]?' · '+STAGECUR[cmpStage(w)]:'')+'</div><div class="v'+(cnt>=2?' vstats':'')+'" data-role="val" style="font-size:'+fsz+lh+'">–</div></div></div>';},
    props:function(w){return row('Aggregationsstufe',stageSel('pSvStage',cmpStage(w)))
      +row('Werte','<label style="margin-right:10px"><input type="checkbox" id="pSvMin"'+(w.statMin?' checked':'')+'> Min</label>'
                   +'<label style="margin-right:10px"><input type="checkbox" id="pSvAvg"'+((w.statAvg||(!w.statMin&&!w.statMax&&!w.statAvg))?' checked':'')+'> Ø</label>'
                   +'<label><input type="checkbox" id="pSvMax"'+(w.statMax?' checked':'')+'> Max</label>')
      +row('Einheit','<input id="pSvUnit" value="'+esc(w.unit||'')+'">')
      +row('Wert-Größe','<input id="pSvFs" type="number" value="'+(w.valfs||'')+'" placeholder="auto">')
      +row('Ausrichtung','<select id="pSvAlign"><option value=""'+(!w.align?' selected':'')+'>Links</option><option value="center"'+(w.align==='center'?' selected':'')+'>Zentriert</option><option value="right"'+(w.align==='right'?' selected':'')+'>Rechts</option></select>')
      +'<div class="pgh">Farbe nach Schwelle</div>'
      +row('Aktiv','<input type="checkbox" id="pColThr"'+(w.colThr?' checked':'')+'>')
      +(w.colThr?(row('Grün bis','<input id="pVT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pVT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')+row('Invertieren','<input type="checkbox" id="pThrInv"'+(w.thrInvert?' checked':'')+'>')):'')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Zeitgewichtetes Min/Max/Ø der Periode. Variable muss geloggt sein.</div>';},
    wire:function(w){
      if($('#pSvStage'))$('#pSvStage').onchange=function(){w.cmpStage=this.value;refreshAggVal(w);commit();};
      if($('#pSvMin'))$('#pSvMin').onchange=function(){w.statMin=this.checked||undefined;render();computeAggVal(w);commit();};
      if($('#pSvAvg'))$('#pSvAvg').onchange=function(){w.statAvg=this.checked||undefined;render();computeAggVal(w);commit();};
      if($('#pSvMax'))$('#pSvMax').onchange=function(){w.statMax=this.checked||undefined;render();computeAggVal(w);commit();};
      if($('#pSvUnit'))$('#pSvUnit').oninput=function(){w.unit=this.value||undefined;render();computeAggVal(w);};
      if($('#pSvFs'))$('#pSvFs').oninput=function(){w.valfs=parseInt(this.value)||undefined;render();};
      if($('#pSvAlign'))$('#pSvAlign').onchange=function(){w.align=this.value||undefined;render();};
      if($('#pColThr'))$('#pColThr').onchange=function(){w.colThr=this.checked||undefined;renderProps();computeAggVal(w);};
      if($('#pVT1'))$('#pVT1').oninput=function(){w.t1=this.value===''?undefined:parseFloat(this.value);computeAggVal(w);};
      if($('#pVT2'))$('#pVT2').oninput=function(){w.t2=this.value===''?undefined:parseFloat(this.value);computeAggVal(w);};
      if($('#pThrInv'))$('#pThrInv').onchange=function(){w.thrInvert=this.checked||undefined;computeAggVal(w);};
    },
    mount:function(w){computeAggVal(w);},
    live:function(w,el,id,d,base,txt,on){computeAggVal(w);return true;} // Präfix/Suffix + Schwellenfarbe erledigt computeAggVal (js/) im Callback
  });
