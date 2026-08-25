  // ===== Widget: KPI =====
  //
  // Die Delta-Zeile kann ihre Aussage SELBST ausrechnen: liegt der Vergleichswert in einer
  // zweiten Variable (w.dVid), bildet die Karte die Differenz zum Hauptwert. Gedacht fuer
  // Jahresvergleiche - "12,3 °C, +1,2 ggue. 2025" - wo der Vergleich nicht aus dem Archiv
  // kommt, sondern von einem Skript berechnet danebenliegt. Der feste Delta-Text bleibt fuer
  // alles andere erhalten.
  function _kpiNum(x){var n=parseFloat(String(x==null?'':x).replace(',','.'));return isNaN(n)?null:n;}
  /**
   * Zweiter Variablensatz: haengt die Karte an der Kennung einer Kennzahlen-Matrix, zeigt sie
   * denselben Zeitraum wie diese. Sonst stuenden auf der Seite zwei Aussagen nebeneinander,
   * die verschiedene Zeitraeume meinen - Matrix auf "ganze Jahre", Karte auf year to date.
   */
  function _kpiSet(w){
    var b = (w.kSession && typeof mxSrcOf === 'function' && mxSrcOf(w.kSession) === 1);
    return b ? {v:(w.varIdB||w.varId), d:(w.dVidB||w.dVid), suf:(w.dSufB!=null?w.dSufB:w.dSuf), b:1}
             : {v:w.varId, d:w.dVid, suf:w.dSuf, b:0};
  }
  function _kpiDelta(w){
    var el=$('.w[data-id="'+w.id+'"] [data-role=dlt]',canvas)
        ||$('.w[data-id="'+w.id+'"] [data-role=dlt]',$('#ovcanvas'));
    if(!el)return;
    var S=_kpiSet(w);
    var a=_lastVals[S.v],b=_lastVals[S.d];
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
    el.textContent=(Math.abs(z)<0.05?'± ':(d>0?'▲ ':'▼ '))+txt+(S.suf?(' '+S.suf):'');
  }
  /** Wert- und Delta-Anzeige auf den gerade gueltigen Variablensatz stellen. */
  function _kpiApplySet(w){
    var S=_kpiSet(w);
    var el=$('.w[data-id="'+w.id+'"] [data-role=val]',canvas)
        ||$('.w[data-id="'+w.id+'"] [data-role=val]',$('#ovcanvas'));
    if(el){
      var lv=_lastVals[S.v];
      // Dieselbe Formatierung wie der Live-Pfad (Praefix/Suffix, Nachkommastellen, Profil).
      el.textContent=lv?fmtWidgetVal(w,lv):'–';
    }
    if(S.d)_kpiDelta(w);
  }
  /**
   * Unterzeile aus einer Variablen: die BEGRUENDUNG der Antwort.
   *
   * "74 Tage" allein ist eine Zahl; "705 kg im Lager" macht sie nachvollziehbar.
   * Text davor und dahinter bleibt frei, damit die Zeile ein ganzer Satz wird
   * und nicht nur ein zweiter nackter Wert.
   */
  function _kpiSub(w,el){
    if(!w.kSubVid||!el)return;
    var n=el.querySelector('[data-role=sub]');if(!n)return;
    var d=_lastVals[w.kSubVid];
    var t=d?((d.f!=null&&d.f!=='')?d.f:String(d.v)):'–';
    n.textContent=(w.kSubPre||'')+t+(w.kSubSuf||'');
  }
  /**
   * Ton der Karte: FARBE BEKOMMT NUR, WAS GERADE ETWAS TUT.
   *
   * Eine Antwortkarte ("Läuft sie?") soll sich abheben, solange die Antwort
   * "ja" lautet, und danach wieder ruhig werden. Der Ton haengt deshalb an
   * einer Bedingung, nicht am Wert selbst: Zahl, Text, ">=3", "3..5", "*".
   * Ohne eigene Variable gilt die Hauptvariable der Karte.
   */
  function _kpiTon(w,el){
    if(!el)return;
    var k=el.querySelector('.hkpi');if(!k)return;
    var muster=w.kToneOn;
    if(muster==null||muster===''){k.classList.remove('kpi-on');return;}
    var vid=w.kToneVid||w.varId, d=vid&&_lastVals[vid];
    var an=false;
    if(d){
      var txt=(d.f!=null&&d.f!=='')?d.f:String(d.v);
      an=_assocMatch(muster,d.v)||_assocMatch(muster,txt);
    }
    k.classList.toggle('kpi-on',!!an);
    var c=w.kToneCol?_cssColorOrEmpty(w.kToneCol):'';
    if(c)k.style.setProperty('--kton',c); else k.style.removeProperty('--kton');
  }
  defWidget('kpi',{
    label:'KPI', cat:'Anzeige', paletteIcon:'wkpi', size:[240,96],
    defaults:function(w){w.label='Autarkie';w.unit='%';w.icon='home';w.dir='up';w.delta='+6 % ggü. gestern';},
    render:function(w){return '<div class="hkpi'+(w.kRows?' kpi-rows':'')+'"><span class="hkbi">'+iconSVG(w.icon||'home')+'</span><div class="hkm"><div class="hkl">'+escL(w.label||'')+'</div><div class="hkn"><span data-role="val">–</span>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</div>'+(w.kSubVid?'<div class="hks" data-role="sub">…</div>':(w.cmpOn?'<div class="hks" data-role="cmp">…</div>':(w.dVid?'<div class="hks" data-role="dlt">…</div>':(w.delta?'<div class="hks '+(w.dir==='dn'?'dn':(w.dir==='up'?'up':''))+'">'+(w.dir==='dn'?'▼ ':(w.dir==='up'?'▲ ':''))+esc(w.delta)+'</div>':''))))+'</div></div>';},
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
        +'<div class="pgh">Zweiter Zeitraum (Kopplung an eine Kennzahlen-Matrix)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
        +'Trägt die Karte dieselbe Kennung wie eine Kennzahlen-Matrix, schaltet sie mit deren '
        +'Umschalter um und zeigt denselben Zeitraum. Leer = feste Variablen oben.</div>'
        +row('Kopplung (Kennung)','<input id="pKSes" value="'+esc(w.kSession||'')+'" placeholder="z. B. wxstat">')
        +(w.kSession?(row('Variable (2. Ansicht)','<input id="pVarB" type="number" value="'+(w.varIdB||'')+'">')
                     +row('Vergleich (2. Ansicht)','<input id="pDVidB" type="number" value="'+(w.dVidB||'')+'">')
                     +row('Zusatz (2. Ansicht)','<input id="pDSufB" value="'+esc(w.dSufB||'')+'">')):'')
        +(w.dVid?(row('Zusatz','<input id="pDSuf" value="'+esc(w.dSuf||'')+'" placeholder="z. B. ggü. 2025">')
                 +row('Als Prozent','<input type="checkbox" id="pDPct"'+(w.dPct?' checked':'')+'>')
                 +row('Weniger ist besser','<input type="checkbox" id="pDInv"'+(w.dInv?' checked':'')+'>')
                 +row('Ohne Wertung','<input type="checkbox" id="pDNeu"'+(w.dNeu?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">keine Färbung — für Größen ohne „besser"</span>')):'')
        +(w.dVid?'':row('Delta-Text','<input id="pDelta" value="'+esc(w.delta||'')+'">')+row('Richtung',dirSel('pDir',w.dir)))
      ))
      +'<div class="pgh">Ton der Karte</div>'
      +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Die Karte hebt sich hervor, solange die Bedingung zutrifft — Ruhe bleibt neutral. Zahl, Text, <code>&gt;=3</code>, <code>3..5</code> oder <code>*</code>. Leer = nie.</div>'
      +row('Aktiv wenn','<input id="pKTonOn" value="'+esc(w.kToneOn||'')+'" style="width:110px" placeholder="z. B. 1 oder >=3"> <input id="pKTonVid" type="number" style="width:84px" value="'+(w.kToneVid||'')+'" placeholder="Var (leer=Var 1)">')
      +row('Farbe',skinSel(w.kToneCol||'','id="pKTonCol"'))
      +'<div class="pgh">Aufbau</div>'
      +row('Immer dreizeilig','<input type="checkbox" id="pKRows"'+(w.kRows?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Frage, Antwort und Begründung untereinander — auch auf flachen Karten</span>')
      +'<div class="pgh">Unterzeile aus einer Variablen</div>'
      +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Die Begründung der Antwort — ein Livewert mit Text davor und dahinter. Gesetzt, schlägt sie Vergleich und Delta-Text.</div>'
      +row('Variable','<input id="pKSubVid" type="number" style="width:96px" value="'+(w.kSubVid||'')+'" placeholder="Var-ID">')
      +(w.kSubVid?row('Text davor / dahinter','<input id="pKSubPre" value="'+esc(w.kSubPre||'')+'" style="width:110px" placeholder="davor"> <input id="pKSubSuf" value="'+esc(w.kSubSuf||'')+'" style="width:110px" placeholder="dahinter">'):'')
      ):'');},
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
      if($('#pDNeu'))$('#pDNeu').onchange=function(){w.dNeu=this.checked||undefined;_kpiDelta(w);commit();};
      if($('#pKSes'))$('#pKSes').onchange=function(){w.kSession=this.value||undefined;render();renderProps();commit();};
      if($('#pVarB'))$('#pVarB').onchange=function(){w.varIdB=parseInt(this.value)||undefined;render();commit();};
      if($('#pDVidB'))$('#pDVidB').onchange=function(){w.dVidB=parseInt(this.value)||undefined;render();commit();};
      if($('#pDSufB'))$('#pDSufB').oninput=function(){w.dSufB=this.value||undefined;_kpiApplySet(w);commit();};
      if($('#pKTonOn'))$('#pKTonOn').oninput=function(){w.kToneOn=this.value||undefined;var e=$('.w[data-id="'+w.id+'"]',canvas);if(e)_kpiTon(w,e);commit();};
      if($('#pKTonVid'))$('#pKTonVid').onchange=function(){w.kToneVid=parseInt(this.value)||undefined;var e=$('.w[data-id="'+w.id+'"]',canvas);if(e)_kpiTon(w,e);commit();};
      if($('#pKTonCol'))$('#pKTonCol').onchange=function(){w.kToneCol=this.value||undefined;var e=$('.w[data-id="'+w.id+'"]',canvas);if(e)_kpiTon(w,e);commit();};
      if($('#pKRows'))$('#pKRows').onchange=function(){w.kRows=this.checked||undefined;render();commit();};
      if($('#pKSubVid'))$('#pKSubVid').onchange=function(){w.kSubVid=parseInt(this.value)||undefined;render();renderProps();commit();};
      if($('#pKSubPre'))$('#pKSubPre').oninput=function(){w.kSubPre=this.value||undefined;var e=$('.w[data-id="'+w.id+'"]',canvas);if(e)_kpiSub(w,e);commit();};
      if($('#pKSubSuf'))$('#pKSubSuf').oninput=function(){w.kSubSuf=this.value||undefined;var e=$('.w[data-id="'+w.id+'"]',canvas);if(e)_kpiSub(w,e);commit();};},
    mount:function(w){
      if(w.cmpOn)computeCompare(w);
      if(w.dVid)_kpiDelta(w);
      // An der Matrix anmelden: bei jedem Umschalten Wert und Vergleich neu setzen.
      if(w.kSession&&typeof mxOn==='function')mxOn(w.kSession,function(){_kpiApplySet(w);});
      if(w.kSession)_kpiApplySet(w);
      var _e=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));
      if(_e){_kpiTon(w,_e);_kpiSub(w,_e);}
    }, // Vergleich sofort nach Render berechnen (nicht auf ersten Poll warten)
    live:function(w,el,id,d,base,txt,on){
      _kpiTon(w,el);_kpiSub(w,el);
      var v=el.querySelector('[data-role=val]'); // txt enthält bereits Präfix/Suffix (aus applyVal in js/06-live.js)
      // Mit Kopplung entscheidet der gerade gueltige VARIABLENSATZ, was in der Karte
      // steht - nicht die Kennung, die gerade hereinkam. Sonst schrieb der Wert des
      // ersten Satzes ueber den zweiten: die Kennungen kommen aufsteigend an, die des
      // Jahressatzes sind kleiner als die des YTD-Satzes, und der Vergleich blieb auf
      // "–" stehen, bis jemand den Umschalter beruehrte.
      if(w.kSession){
        _kpiApplySet(w);
        if(w.cmpOn)computeCompare(w);
        return true;
      }
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
