  // ===== Widget: KPI =====
  //
  // Die Delta-Zeile kann ihre Aussage SELBST ausrechnen: liegt der Vergleichswert in einer
  // zweiten Variable (w.dVid), bildet die Karte die Differenz zum Hauptwert. Gedacht fuer
  // Jahresvergleiche - "12,3 °C, +1,2 ggue. 2025" - wo der Vergleich nicht aus dem Archiv
  // kommt, sondern von einem Skript berechnet danebenliegt. Der feste Delta-Text bleibt fuer
  // alles andere erhalten.
  function _kpiNum(x){var n=parseFloat(String(x==null?'':x).replace(',','.'));return isNaN(n)?null:n;}
  function _kpiDelta(w){
    var el=$('.w[data-id="'+w.id+'"] [data-role=dlt]',canvas)
        ||$('.w[data-id="'+w.id+'"] [data-role=dlt]',$('#ovcanvas'));
    if(!el)return;
    var a=_lastVals[w.varId],b=_lastVals[w.dVid];
    var av=a?_kpiNum(a.v):null,bv=b?_kpiNum(b.v):null;
    if(av==null||bv==null){el.textContent='–';el.className='hks';return;}
    var d=av-bv, pct=(w.dPct&&bv!==0)?(d/Math.abs(bv)*100):null;
    var z=(pct!=null?pct:d);
    var txt=(z>0?'+':'')+(Math.round(z*10)/10).toString().replace('.',',')
           +(pct!=null?' %':(w.unit?' '+w.unit:''));
    // Einfaerbung: mehr ist gruen, ausser die Groesse ist eine, bei der weniger besser ist.
    // Bei manchen Groessen gibt es kein "besser" - 500 mm weniger Regen gruen zu faerben
    // behauptete, Trockenheit sei erfreulich. Dafuer gibt es "ohne Wertung".
    var gut=(w.dInv?(d<0):(d>0));
    el.className='hks '+(w.dNeu?'':(Math.abs(z)<0.05?'':(gut?'up':'dn')));
    el.textContent=(Math.abs(z)<0.05?'± ':(d>0?'▲ ':'▼ '))+txt+(w.dSuf?(' '+w.dSuf):'');
  }
  defWidget('kpi',{
    label:'KPI', cat:'Anzeige', paletteIcon:'wkpi', size:[240,96],
    defaults:function(w){w.label='Autarkie';w.unit='%';w.icon='home';w.dir='up';w.delta='+6 % ggü. gestern';},
    render:function(w){return '<div class="hkpi"><span class="hkbi">'+iconSVG(w.icon||'home')+'</span><div class="hkm"><div class="hkl">'+escL(w.label||'')+'</div><div class="hkn"><span data-role="val">–</span>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</div>'+(w.cmpOn?'<div class="hks" data-role="cmp">…</div>':(w.dVid?'<div class="hks" data-role="dlt">…</div>':(w.delta?'<div class="hks '+(w.dir==='dn'?'dn':(w.dir==='up'?'up':''))+'">'+(w.dir==='dn'?'▼ ':(w.dir==='up'?'▲ ':''))+esc(w.delta)+'</div>':'')))+'</div></div>';},
    props:function(w){return (w.type==='kpi'?(row('Einheit','<input id="pUnit" value="'+esc(w.unit||'')+'">')
      +'<div class="pgh">Farbe nach Schwelle</div>'
      +row('Aktiv','<input type="checkbox" id="pColThr"'+(w.colThr?' checked':'')+'>')
      +(w.colThr?(row('Grün bis','<input id="pVT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pVT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')+row('Invertieren','<input type="checkbox" id="pThrInv"'+(w.thrInvert?' checked':'')+'>')):'')
      +(w.cmpOn?'':(
        '<div class="pgh">Veränderung gegenüber einem Referenzwert</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
        +'Eine zweite Variable mit dem VERGLEICHSWERT (z. B. derselbe Zeitraum im Vorjahr). '
        +'Ist sie gesetzt, rechnet die Karte die Differenz selbst aus und ersetzt damit den '
        +'festen Delta-Text. „Weniger ist besser" dreht nur die Einfärbung um, nicht das Vorzeichen.</div>'
        +row('Vergleichs-Variable','<input id="pDVid" type="number" value="'+(w.dVid||'')+'">')
        +(w.dVid?(row('Zusatz','<input id="pDSuf" value="'+esc(w.dSuf||'')+'" placeholder="z. B. ggü. 2025">')
                 +row('Als Prozent','<input type="checkbox" id="pDPct"'+(w.dPct?' checked':'')+'>')
                 +row('Weniger ist besser','<input type="checkbox" id="pDInv"'+(w.dInv?' checked':'')+'>')
                 +row('Ohne Wertung','<input type="checkbox" id="pDNeu"'+(w.dNeu?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">keine Färbung — für Größen ohne „besser"</span>')):'')
        +(w.dVid?'':row('Delta-Text','<input id="pDelta" value="'+esc(w.delta||'')+'">')+row('Richtung',dirSel('pDir',w.dir)))
      ))):'');},
    wire:function(w){function relive(){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
      if($('#pUnit'))$('#pUnit').oninput=function(){w.unit=this.value;render();};if($('#pDelta'))$('#pDelta').oninput=function(){w.delta=this.value;render();};
      if($('#pColThr'))$('#pColThr').onchange=function(){w.colThr=this.checked||undefined;renderProps();relive();};
      if($('#pVT1'))$('#pVT1').oninput=function(){w.t1=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pVT2'))$('#pVT2').oninput=function(){w.t2=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pThrInv'))$('#pThrInv').onchange=function(){w.thrInvert=this.checked||undefined;relive();};
      if($('#pDVid'))$('#pDVid').onchange=function(){w.dVid=parseInt(this.value)||undefined;render();renderProps();commit();};
      if($('#pDSuf'))$('#pDSuf').oninput=function(){w.dSuf=this.value;_kpiDelta(w);commit();};
      if($('#pDPct'))$('#pDPct').onchange=function(){w.dPct=this.checked||undefined;_kpiDelta(w);commit();};
      if($('#pDInv'))$('#pDInv').onchange=function(){w.dInv=this.checked||undefined;_kpiDelta(w);commit();};
      if($('#pDNeu'))$('#pDNeu').onchange=function(){w.dNeu=this.checked||undefined;_kpiDelta(w);commit();};},
    mount:function(w){if(w.cmpOn)computeCompare(w);if(w.dVid)_kpiDelta(w);}, // Vergleich sofort nach Render berechnen (nicht auf ersten Poll warten)
    live:function(w,el,id,d,base,txt,on){
      var v=el.querySelector('[data-role=val]'); // txt enthält bereits Präfix/Suffix (aus applyVal in js/06-live.js)
      // Anzeige und Farbe gehoeren der HAUPTVARIABLE. live() laeuft fuer jede gebundene
      // Daten-ID (06-live.js: widgetDataId), also auch fuer die Vergleichsvariable - ohne diese
      // Unterscheidung faerbte die zuletzt eingetroffene ID die Karte. Der Vergleich selbst
      // wird weiterhin bei JEDER ID nachgerechnet, sonst haengt er dem Wert hinterher.
      var _main=(!w.varId||id===w.varId);
      if(w.cmpOn){computeCompare(w);if(!w.cmpCounter&&v&&_main)v.textContent=txt;} // Zähler: Hauptwert kommt aus computeCompare (Perioden-Verbrauch)
      else if(v&&_main)v.textContent=txt;
      if(w.dVid)_kpiDelta(w);
      if(v&&_main){if(w.colThr){var _n=parseFloat(String(d.v).replace(',','.'));if(!isNaN(_n)){var _t1=(w.t1!=null?w.t1:0),_t2=(w.t2!=null?w.t2:0),_c=_n<=_t1?'--ok':(_n<=_t2?'--warm':'--crit');if(w.thrInvert)_c=(_n<=_t1?'--crit':(_n<=_t2?'--warm':'--ok'));v.style.color=cssv(_c);}}else v.style.color='';}
      return true;
    }
  });
