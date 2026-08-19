  // ===== Widget: statmatrix (Kennzahlen-Matrix) =====
  //
  // Eine Matrix aus Kennzahlen (Zeilen) und Zeitabschnitten (Spalten) als ECharts-Heatmap:
  // die Zahl bleibt lesbar, die Farbe macht die Reihe vergleichbar.
  //
  // DER DATENADAPTER ist der eigentliche Kern. Zwoelf Kennzahlen mit voellig
  // verschiedenen Wertebereichen (Regen 190…1504 mm, Tropennaechte 0…14, T min −14…−7)
  // vertragen KEINE gemeinsame Farbskala - eine globale visualMap wuerde die halbe Matrix
  // einfarbig lassen. Deshalb wird JE ZEILE normiert (Minimum … Maximum der Zeile) und die
  // Zellfarbe einzeln gesetzt, statt ECharts eine Skala ueber alles legen zu lassen.
  //
  // Quelle sind Tabellen im Zeilenformat (Zeile 0 = Kopf, Spalte 0 = Bezeichner) - dasselbe
  // JSON, das auch das Tabellen-Widget liest. Zwei Quellen sind vorgesehen (z. B. ganze
  // Jahre und dieselben Zeitraeume bis heute), zwischen denen der Kopf umschaltet.

  function _mxSrc(w){ // aktive Quelle: 0 = erste, 1 = zweite
    return (w._mxSrc===1&&w.varId2)?1:0;
  }
  function _mxRows(w){var s=_mxSrc(w);return (s===1?w._mxRows2:w._mxRows1)||[];}
  function _mxLoad(w,cb){
    var ids=[w.varId,w.varId2],got=0,need=0;
    [0,1].forEach(function(k){
      if(!ids[k])return;
      need++;
      fetch('?api=tabledata&id='+ids[k],{cache:'no-store'}).then(function(r){return r.json();})
        .then(function(j){var rows=(j&&j.rows)||[];if(k===0)w._mxRows1=rows;else w._mxRows2=rows;})
        .catch(function(){if(k===0)w._mxRows1=[];else w._mxRows2=[];})
        .then(function(){got++;if(got>=need)cb&&cb();});
    });
    if(!need)cb&&cb();
  }
  function _mxNum(v){
    if(v==null)return NaN;
    var n=parseFloat(String(v).replace(/\s/g,'').replace(',','.'));
    return isNaN(n)?NaN:n;
  }
  /** Skin-Farbe der Skala fuer eine Zeile (Vorgabe aus der Liste mxScale, sonst Akzent). */
  function _mxFarbe(w,label){
    var l=(w.mxScale||[]).filter(function(x){
      return x.row&&String(label).toLowerCase().indexOf(String(x.row).toLowerCase())===0;})[0];
    return _skinToCss((l&&l.color)||w.mxDefColor||'accent')||cssv('--accent');
  }
  /** Farbe mit Deckkraft aus dem normierten Anteil - unten blass, oben Vollton. */
  function _mxZelle(hex,t){
    var a=0.10+0.75*Math.max(0,Math.min(1,t));
    return accA(a,hex);
  }
  /** Sichtbarer Spaltenausschnitt: n Spalten, um _mxOff nach links verschoben. */
  function _mxFenster(w,anzSpalten){
    var n=(w.mxCols>0?parseInt(w.mxCols):0);
    if(!n||n>=anzSpalten)return {von:0,bis:anzSpalten};
    var off=Math.max(0,Math.min(anzSpalten-n,(w._mxOff||0)));
    return {von:anzSpalten-n-off,bis:anzSpalten-off};
  }
  function setStatMatrix(w){
    var ec=_ec[w.id];if(!ec)return;
    var rows=_mxRows(w);
    if(!rows.length||!rows[0]||rows[0].length<2){
      ec.setOption({backgroundColor:'transparent',
        title:{text:(w.varId?'Keine Daten':'Variable wählen'),left:'center',top:'middle',
               textStyle:{color:cssv('--muted'),fontSize:_ecF(w,'title',12),fontWeight:'normal'}},
        xAxis:{show:false},yAxis:{show:false},series:[]},true);
      return;
    }
    var kopf=rows[0],leib=rows.slice(1);
    var F=_mxFenster(w,kopf.length-1);
    var spalten=[],ci;
    for(ci=F.von;ci<F.bis;ci++)spalten.push(String(kopf[ci+1]));
    // Zeilen von unten nach oben: ECharts zaehlt die Kategorie-Achse von unten,
    // die erste Tabellenzeile soll aber oben stehen.
    var zeilen=leib.map(function(r){return String(r[0]);}).reverse();
    var daten=[],max=0;
    leib.forEach(function(r,ri){
      var werte=[],k;
      for(k=F.von;k<F.bis;k++)werte.push(_mxNum(r[k+1]));
      var gueltig=werte.filter(function(v){return !isNaN(v);});
      // Normierung JE ZEILE - das ist der Punkt, an dem ungleiche Groessen vergleichbar werden.
      var lo=Math.min.apply(null,gueltig),hi=Math.max.apply(null,gueltig);
      var spanne=(hi-lo)||1;
      var hex=_mxFarbe(w,r[0]);
      var y=zeilen.length-1-ri;
      werte.forEach(function(v,xi){
        if(isNaN(v))return;
        daten.push({value:[xi,y,v],itemStyle:{color:_mxZelle(hex,(v-lo)/spanne)}});
        if(Math.abs(v)>max)max=Math.abs(v);
      });
    });
    var fs=_ecF(w,'label',10);
    var dez=(w.mxDec!=null&&w.mxDec!=='')?Math.max(0,Math.min(3,parseInt(w.mxDec))):null;
    // Gebrochene Werte behalten eine Nachkommastelle, ganze bleiben ganz - sonst wurde aus
    // einem Jahresmittel von 12,3 Grad die Zahl "12", waehrend 1504 mm unveraendert blieb.
    function zahl(v){
      var s=(dez!=null)?v.toFixed(dez):((v%1!==0)?(Math.round(v*10)/10).toFixed(1):String(v));
      return s.replace('.',',');
    }
    ec.setOption({backgroundColor:'transparent',animation:!!bcfg().chartAnim,
      grid:{left:10,right:8,top:6,bottom:6,containLabel:true},
      tooltip:{trigger:'item',confine:true,formatter:function(p){
        return zeilen[p.value[1]]+' · '+spalten[p.value[0]]+'<br><b>'+zahl(p.value[2])+'</b>';}},
      xAxis:{type:'category',data:spalten,position:'top',splitArea:{show:false},
        axisLine:{show:false},axisTick:{show:false},
        axisLabel:{color:cssv('--muted'),fontSize:_ecF(w,'axis',10),fontFamily:'ui-monospace,Menlo,monospace'}},
      yAxis:{type:'category',data:zeilen,splitArea:{show:false},
        axisLine:{show:false},axisTick:{show:false},
        axisLabel:{color:cssv('--text'),fontSize:_ecF(w,'axis',10),margin:8}},
      series:[{type:'heatmap',data:daten,
        label:{show:(w.mxVals!==false),color:cssv('--text'),fontSize:fs,
               fontFamily:'ui-monospace,Menlo,monospace',
               formatter:function(p){return zahl(p.value[2]);}},
        itemStyle:{borderColor:cssv('--surface'),borderWidth:2,borderRadius:4},
        emphasis:{itemStyle:{borderColor:cssv('--text'),borderWidth:1}}}]},true);
  }
  function _mxKopf(w){
    var rows=_mxRows(w),n=rows.length?rows[0].length-1:0;
    var F=_mxFenster(w,n),kopf=rows.length?rows[0]:[];
    var von=kopf[F.von+1],bis=kopf[F.bis];
    var eng=(w.mxCols>0&&w.mxCols<n);
    var s=_mxSrc(w);
    var seg=w.varId2
      ? '<span class="mx-seg"><button class="mx-b'+(s===0?' on':'')+'" data-mxsrc="0">'
        +escL(w.srcLabel||'Ganze Jahre')+'</button><button class="mx-b'+(s===1?' on':'')+'" data-mxsrc="1">'
        +escL(w.srcLabel2||'Bis heute')+'</button></span>' : '';
    var nav=eng
      ? '<span class="mx-nav"><button class="mx-c" data-mxnav="-1" title="früher">‹</button>'
        +'<span class="mx-rng">'+esc(String(von||''))+'–'+esc(String(bis||''))+'</span>'
        +'<button class="mx-c" data-mxnav="1" title="später"'+(((w._mxOff||0)<=0)?' disabled':'')+'>›</button></span>' : '';
    return '<div class="mx-kopf"><span class="mx-tt">'+escL(w.label||'Kennzahlen')+'</span>'
      +'<span class="mx-sp"></span>'+seg+nav+'</div>';
  }
  function _mxPaint(w){
    var el=$('.w[data-id="'+w.id+'"] [data-role=mxroot]',canvas)
         ||$('.w[data-id="'+w.id+'"] [data-role=mxroot]',$('#ovcanvas'));
    if(!el)return;
    el.innerHTML=_mxKopf(w);
    _mxWire(w,el);
    if(_ec[w.id])setStatMatrix(w);
  }
  function _mxWire(w,el){
    el.querySelectorAll('[data-mxsrc]').forEach(function(b){b.onclick=function(){
      w._mxSrc=parseInt(b.getAttribute('data-mxsrc'));w._mxOff=0;_mxPaint(w);};});
    el.querySelectorAll('[data-mxnav]').forEach(function(b){b.onclick=function(){
      var rows=_mxRows(w),n=rows.length?rows[0].length-1:0,cols=(w.mxCols>0?parseInt(w.mxCols):n);
      var d=parseInt(b.getAttribute('data-mxnav'));
      // "‹" geht in die Vergangenheit, also Fenster nach links = Offset groesser.
      w._mxOff=Math.max(0,Math.min(Math.max(0,n-cols),(w._mxOff||0)+(d<0?1:-1)));
      _mxPaint(w);};});
  }
  defWidget('statmatrix',{
    label:'Kennzahlen-Matrix',
    cat:'Anzeige',
    paletteIcon:'wtable',
    size:[760,430],
    defaults:function(w){w.label='Kennzahlen je Jahr';w.mxCols=5;w.mxVals=true;w.mxDefColor='accent';},
    render:function(w){return '<div class="mx"><div data-role="mxroot"></div>'
      +'<div data-role="chart" class="mx-ch"></div></div>';},
    mount:function(w){_mxLoad(w,function(){_mxPaint(w);});},
    props:function(w){
      return '<div class="pgh">Datenquellen (Tabelle im Zeilenformat)</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
        +'Dasselbe JSON wie beim Tabellen-Widget: Zeile 0 ist der Spaltenkopf, Spalte 0 der '
        +'Bezeichner. Zwei Quellen ergeben den Umschalter im Kopf.</div>'
        +row('Variable A','<input id="pMxVar" type="number" value="'+(w.varId||'')+'">')
        +row('Beschriftung A','<input id="pMxLab" value="'+esc(w.srcLabel||'Ganze Jahre')+'">')
        +row('Variable B','<input id="pMxVar2" type="number" value="'+(w.varId2||'')+'">')
        +row('Beschriftung B','<input id="pMxLab2" value="'+esc(w.srcLabel2||'Bis heute')+'">')
        +'<div class="pgh">Darstellung</div>'
        +row('Sichtbare Spalten','<input id="pMxCols" type="number" min="0" max="40" value="'+(w.mxCols!=null?w.mxCols:5)+'" title="0 = alle"> <span style="font-size:11px;color:var(--muted)">0 = alle; sonst blättern die Pfeile im Kopf</span>')
        +row('Werte in den Zellen','<input type="checkbox" id="pMxVals"'+((w.mxVals!==false)?' checked':'')+'>')
        +row('Nachkommastellen','<input id="pMxDec" type="number" min="0" max="3" value="'+(w.mxDec!=null?w.mxDec:'')+'" placeholder="auto">')
        +row('Farbe (Vorgabe)',skinSel(w.mxDefColor||'accent','id="pMxDef"'))
        +'<div class="pgh">Farbe je Zeile</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
        +'Jede Zeile wird EINZELN normiert (Minimum … Maximum der Zeile) — nur so sind Größen '
        +'mit ganz verschiedenen Bereichen vergleichbar. Hier steht, in welcher Skin-Farbe die '
        +'Skala läuft: Anfang des Bezeichners eintragen (z. B. <code>Frost</code>), blass = '
        +'wenig, Vollton = viel.</div>'
        +listEditor(w,'mxScale','Zeile beginnt mit · Farbe',[{k:'row',ph:'Bezeichner'},{k:'color',type:'skincolor'}]);
    },
    wire:function(w){
      function neu(){_mxLoad(w,function(){_mxPaint(w);});commit();}
      if($('#pMxVar'))$('#pMxVar').onchange=function(){w.varId=parseInt(this.value)||0;neu();};
      if($('#pMxVar2'))$('#pMxVar2').onchange=function(){w.varId2=parseInt(this.value)||0;neu();};
      if($('#pMxLab'))$('#pMxLab').oninput=function(){w.srcLabel=this.value;_mxPaint(w);commit();};
      if($('#pMxLab2'))$('#pMxLab2').oninput=function(){w.srcLabel2=this.value;_mxPaint(w);commit();};
      if($('#pMxCols'))$('#pMxCols').onchange=function(){w.mxCols=parseInt(this.value)||0;w._mxOff=0;_mxPaint(w);commit();};
      if($('#pMxVals'))$('#pMxVals').onchange=function(){w.mxVals=this.checked;_mxPaint(w);commit();};
      if($('#pMxDec'))$('#pMxDec').onchange=function(){w.mxDec=(this.value===''?undefined:parseInt(this.value));_mxPaint(w);commit();};
      if($('#pMxDef'))$('#pMxDef').onchange=function(){w.mxDefColor=this.value;_mxPaint(w);commit();};
    },
    live:function(w,el,id,d){
      if(String(id)===String(w.varId)||String(id)===String(w.varId2)){_mxLoad(w,function(){_mxPaint(w);});}
      return true;
    }
  });
