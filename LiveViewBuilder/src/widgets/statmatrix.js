  // ===== Widget: statmatrix (Kennzahlen-Matrix) =====
  //
  // Eine Kennzahlen-Tabelle als Farbmatrix: Zeilen sind die Kennzahlen, Spalten die
  // Zeitabschnitte. Die Zahl bleibt lesbar, die Faerbung macht die Reihe vergleichbar,
  // rechts zeigt eine Sparkline den ganzen Verlauf - auch die Jahre ausserhalb des
  // sichtbaren Fensters.
  //
  // DER DATENADAPTER ist der Kern. Zwoelf Kennzahlen mit voellig verschiedenen
  // Wertebereichen (Regen 190…1504 mm, Tropennaechte 0…14, T min −14…−7) vertragen KEINE
  // gemeinsame Farbskala - eine Skala ueber alles liesse die halbe Matrix einfarbig.
  // Deshalb wird JE ZEILE auf ihr eigenes Minimum und Maximum normiert.
  //
  // Bewusst HTML statt einer ECharts-Heatmap: die Matrix braucht Zwischenueberschriften je
  // Gruppe, eine Einheit am Bezeichner, eine Sparkline-Spalte und einen Rahmen um das
  // laufende Jahr. Das alles in eine Heatmap zu zwingen ergaebe mehr Notloesung als Nutzen;
  // die Sparklines sind Inline-SVG, die Zellfarben kommen aus dem Skin.
  //
  // Quelle ist eine Tabelle im Zeilenformat (Zeile 0 = Kopf, Spalte 0 = Bezeichner) -
  // dasselbe JSON, das auch das Tabellen-Widget liest.

  function _mxSrc(w){return (w._mxSrc===1&&w.varId2)?1:0;}
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
  function _mxFmt(w,v){
    if(isNaN(v))return '';
    var d=(w.mxDec!=null&&w.mxDec!=='')?Math.max(0,Math.min(3,parseInt(w.mxDec))):null;
    var s=(d!=null)?v.toFixed(d):((v%1!==0)?(Math.round(v*10)/10).toFixed(1):String(v));
    return s.replace('.',',');
  }
  /** Zeilen-Einstellung ueber den ANFANG des Bezeichners (haelt auch bei leicht anderem Wortlaut). */
  function _mxCfg(w,label){
    return (w.mxScale||[]).filter(function(x){
      return x.row&&String(label).toLowerCase().indexOf(String(x.row).toLowerCase())===0;})[0]||{};
  }
  function _mxFarbe(w,label){
    return _skinToCss(_mxCfg(w,label).color||w.mxDefColor||'accent')||cssv('--accent');
  }
  function _mxFenster(w,anz){
    var n=(w.mxCols>0?parseInt(w.mxCols):0);
    if(!n||n>=anz)return {von:0,bis:anz};
    var off=Math.max(0,Math.min(anz-n,(w._mxOff||0)));
    return {von:anz-n-off,bis:anz-off};
  }
  /** Sparkline ueber ALLE Spalten der Zeile - der Verlauf soll nicht am Fenster enden. */
  function _mxSpark(werte,hex){
    var g=werte.filter(function(v){return !isNaN(v);});
    if(g.length<2)return '';
    var lo=Math.min.apply(null,g),hi=Math.max.apply(null,g),sp=(hi-lo)||1;
    var W=84,H=22,n=werte.length,pts=[];
    werte.forEach(function(v,i){
      if(isNaN(v))return;
      pts.push((i/(n-1)*W).toFixed(1)+','+(H-2-((v-lo)/sp)*(H-4)).toFixed(1));
    });
    if(pts.length<2)return '';
    var last=pts[pts.length-1].split(',');
    // Gestrichelte Linie auf Hoehe des Zeilen-Mittels: erst dadurch sagt die Sparkline,
    // ob ein Jahr ueber oder unter dem Schnitt der Reihe lag.
    var mit=g.reduce(function(a3,b3){return a3+b3;},0)/g.length;
    var my=(H-2-((mit-lo)/sp)*(H-6)).toFixed(1);
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" aria-hidden="true" style="display:block">'
      +'<line x1="0" y1="'+my+'" x2="'+W+'" y2="'+my+'" stroke="'+cssv('--line')+'" stroke-width="1" stroke-dasharray="3 3"/>'
      +'<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+hex+'" stroke-width="1.5" '
      +'stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>'
      +'<circle cx="'+last[0]+'" cy="'+last[1]+'" r="2.6" fill="'+hex+'"/></svg>';
  }
  function _mxTabelle(w){
    var rows=_mxRows(w);
    if(!rows.length||!rows[0]||rows[0].length<2)
      return '<div class="mx-leer">'+(w.varId?'Keine Daten':'Variable wählen')+'</div>';
    var kopf=rows[0],leib=rows.slice(1),anz=kopf.length-1;
    var F=_mxFenster(w,anz),spalten=[],ci;
    for(ci=F.von;ci<F.bis;ci++)spalten.push(String(kopf[ci+1]));
    var jetzt=String(new Date().getFullYear());
    var spark=(w.mxSpark!==false);
    var gtc='var(--mxlb) repeat('+spalten.length+',1fr)'+(spark?' 92px':'');
    var h='<div class="mx-tab" style="grid-template-columns:'+gtc+'">';
    h+='<div class="mx-hz"></div>'
      +spalten.map(function(s){return '<div class="mx-hz'+(s===jetzt?' jetzt':'')+'">'+esc(s)+'</div>';}).join('')
      +(spark?'<div class="mx-hz vl">Verlauf</div>':'');
    // Zeilen nach Gruppen ordnen. Die Quelle bringt sie in ihrer eigenen Reihenfolge - dort
    // steht "Heiztage" hinter den Tropennaechten, und die Ueberschrift "Kaelte" erschiene ein
    // zweites Mal. Massgeblich ist die Reihenfolge der Gruppen in der Zeilen-Liste; innerhalb
    // einer Gruppe bleibt die Reihenfolge der Quelle erhalten.
    var grpOrd={},ord=0;
    (w.mxScale||[]).forEach(function(x){
      if(x.grp&&grpOrd[x.grp]==null)grpOrd[x.grp]=ord++;
    });
    leib=leib.map(function(r,i){
      var gp=_mxCfg(w,String(r[0])).grp||'';
      return {r:r,i:i,g:(grpOrd[gp]!=null?grpOrd[gp]:999)};
    }).sort(function(a2,b2){return (a2.g-b2.g)||(a2.i-b2.i);}).map(function(x){return x.r;});

    var letzteGruppe=null;
    leib.forEach(function(r){
      var label=String(r[0]),cfg=_mxCfg(w,label),hex=_mxFarbe(w,label);
      if(cfg.grp&&cfg.grp!==letzteGruppe){
        h+='<div class="mx-grp">'+escL(cfg.grp)+'</div>';
        letzteGruppe=cfg.grp;
      }
      var alle=[],k;
      for(k=0;k<anz;k++)alle.push(_mxNum(r[k+1]));
      var g=alle.filter(function(v){return !isNaN(v);});
      // Normierung JE ZEILE - hier werden ungleiche Groessen ueberhaupt erst vergleichbar.
      var lo=g.length?Math.min.apply(null,g):0,hi=g.length?Math.max.apply(null,g):1,sp=(hi-lo)||1;
      h+='<div class="mx-lb">'+escL(label)+(cfg.unit?'<i>'+escL(cfg.unit)+'</i>':'')+'</div>';
      for(k=F.von;k<F.bis;k++){
        var v=alle[k],t=isNaN(v)?0:(v-lo)/sp;
        var jz=(String(kopf[k+1])===jetzt)?' jetzt':'';
        // Rampe bis zum Vollton - eine Heatmap lebt davon, dass das Maximum wirklich
        // kraeftig ist. Ab etwa der Haelfte kippt die Schrift auf Weiss, sonst verliert
        // sie auf der dunklen Zelle den Kontrast.
        var hell=(t>0.5);
        h+='<div class="mx-z'+jz+(hell?' hell':'')+'" style="background:'
          +(isNaN(v)?'transparent':accA(0.09+0.91*t,hex))+'">'+_mxFmt(w,v)+'</div>';
      }
      if(spark)h+='<div class="mx-vl">'+_mxSpark(alle,hex)+'</div>';
    });
    return h+'</div>';
  }
  function _mxKopf(w){
    var rows=_mxRows(w),n=rows.length?rows[0].length-1:0;
    var F=_mxFenster(w,n),kopf=rows.length?rows[0]:[];
    var eng=(w.mxCols>0&&w.mxCols<n),s=_mxSrc(w);
    var seg=w.varId2
      ? '<span class="mx-seg"><button class="mx-b'+(s===0?' on':'')+'" data-mxsrc="0">'
        +escL(w.srcLabel||'Ganze Jahre')+'</button><button class="mx-b'+(s===1?' on':'')+'" data-mxsrc="1">'
        +escL(w.srcLabel2||'Bis heute')+'</button></span>' : '';
    var nav=eng
      ? '<span class="mx-nav"><button class="mx-c" data-mxnav="-1" title="früher">‹</button>'
        +'<span class="mx-rng">'+esc(String(kopf[F.von+1]||''))+'–'+esc(String(kopf[F.bis]||''))+'</span>'
        +'<button class="mx-c" data-mxnav="1" title="später"'+(((w._mxOff||0)<=0)?' disabled':'')+'>›</button></span>' : '';
    var lgd='<span class="mx-lgd">Skala je Zeile<i class="mx-ramp"></i></span>';
    return '<div class="mx-kopf"><span class="mx-tt">'+escL(w.label||'Kennzahlen')+'</span>'
      +'<span class="mx-fl"></span>'+lgd+seg+nav+'</div>';
  }
  function _mxEl(w){
    var sel='.w[data-id="'+w.id+'"] [data-role=mxroot]';
    var oc=document.getElementById('ovcanvas');
    return (oc&&oc.querySelector(sel))||(typeof canvas!=='undefined'&&canvas&&canvas.querySelector(sel))||null;
  }
  function _mxPaint(w){
    var el=_mxEl(w);if(!el)return;
    el.innerHTML=_mxKopf(w)+_mxTabelle(w);
    el.querySelectorAll('[data-mxsrc]').forEach(function(b){b.onclick=function(){
      w._mxSrc=parseInt(b.getAttribute('data-mxsrc'));w._mxOff=0;_mxPaint(w);};});
    el.querySelectorAll('[data-mxnav]').forEach(function(b){b.onclick=function(){
      var rows=_mxRows(w),n=rows.length?rows[0].length-1:0,cols=(w.mxCols>0?parseInt(w.mxCols):n);
      var d=parseInt(b.getAttribute('data-mxnav'));
      w._mxOff=Math.max(0,Math.min(Math.max(0,n-cols),(w._mxOff||0)+(d<0?1:-1)));
      _mxPaint(w);};});
  }
  defWidget('statmatrix',{
    label:'Kennzahlen-Matrix',
    cat:'Anzeige',
    paletteIcon:'wtable',
    size:[720,760],
    defaults:function(w){w.label='Kennzahlen je Jahr';w.mxCols=5;w.mxDefColor='accent';w.mxLbW=132;},
    render:function(w){return '<div class="panel mx" style="--mxlb:'+(w.mxLbW||132)+'px">'
      +'<div data-role="mxroot"></div></div>';},
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
        +row('Sichtbare Spalten','<input id="pMxCols" type="number" min="0" max="40" value="'+(w.mxCols!=null?w.mxCols:5)+'"> <span style="font-size:11px;color:var(--muted)">0 = alle; sonst blättern die Pfeile im Kopf</span>')
        +row('Verlaufsspalte','<input type="checkbox" id="pMxSpark"'+((w.mxSpark!==false)?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Sparkline über ALLE Spalten, auch die ausgeblendeten</span>')
        +row('Breite Bezeichner','<input id="pMxLbW" type="number" min="70" max="300" value="'+(w.mxLbW||132)+'"> px')
        +row('Nachkommastellen','<input id="pMxDec" type="number" min="0" max="3" value="'+(w.mxDec!=null?w.mxDec:'')+'" placeholder="auto">')
        +row('Farbe (Vorgabe)',skinSel(w.mxDefColor||'accent','id="pMxDef"'))
        +'<div class="pgh">Zeilen: Gruppe, Einheit, Farbe</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
        +'Getroffen wird über den ANFANG des Bezeichners (<code>Frost</code> trifft '
        +'„Frosttage"). Die Gruppe setzt eine Zwischenüberschrift, sobald sie wechselt. '
        +'Jede Zeile wird EINZELN normiert — blass ist wenig, Vollton viel.</div>'
        +listEditor(w,'mxScale','Zeile beginnt mit · Gruppe · Einheit · Farbe',
          [{k:'row',ph:'Bezeichner'},{k:'grp',ph:'Gruppe'},{k:'unit',ph:'Einh'},{k:'color',type:'skincolor'}]);
    },
    wire:function(w){
      function neu(){_mxLoad(w,function(){_mxPaint(w);});commit();}
      function nur(){_mxPaint(w);commit();}
      if($('#pMxVar'))$('#pMxVar').onchange=function(){w.varId=parseInt(this.value)||0;neu();};
      if($('#pMxVar2'))$('#pMxVar2').onchange=function(){w.varId2=parseInt(this.value)||0;neu();};
      if($('#pMxLab'))$('#pMxLab').oninput=function(){w.srcLabel=this.value;nur();};
      if($('#pMxLab2'))$('#pMxLab2').oninput=function(){w.srcLabel2=this.value;nur();};
      if($('#pMxCols'))$('#pMxCols').onchange=function(){w.mxCols=parseInt(this.value)||0;w._mxOff=0;nur();};
      if($('#pMxSpark'))$('#pMxSpark').onchange=function(){w.mxSpark=this.checked;nur();};
      if($('#pMxLbW'))$('#pMxLbW').onchange=function(){w.mxLbW=parseInt(this.value)||132;render();commit();};
      if($('#pMxDec'))$('#pMxDec').onchange=function(){w.mxDec=(this.value===''?undefined:parseInt(this.value));nur();};
      if($('#pMxDef'))$('#pMxDef').onchange=function(){w.mxDefColor=this.value;nur();};
    },
    live:function(w,el,id,d){
      if(String(id)===String(w.varId)||String(id)===String(w.varId2))_mxLoad(w,function(){_mxPaint(w);});
      return true;
    }
  });
