  // ===== Widget: Wert (value) — Präfix/Suffix/Ausrichtung + Schwellwert-Textfarbe =====
  defWidget('value',{
    label:'Wert', paletteIcon:'meter', size:[180,88],
    render:function(w){var ic=w.icon?('<div class="wvic">'+iconSVG(w.icon)+'</div>'):'';var al=w.align?(';text-align:'+w.align):''; // Icon-Farbe zentral über --wicon (w.iconColor)
      var rowMode=!!(w.icon||w.oneline),jc=(w.align==='center'?'center':(w.align==='right'?'flex-end':'flex-start')); // Block-Ausrichtung im Zeilen-Modus (behebt Zwangs-Zentrierung)
      var sty=[];if(w.icx!=null&&w.icx!=='')sty.push('padding-left:'+(parseInt(w.icx)||0)+'px'); // Icon-X relativ zum linken Widget-Rand
      if(rowMode)sty.push('justify-content:'+jc);
      var st=sty.length?(' style="'+sty.join(';')+'"'):'';
      if(w.oneline){var lab=w.label?('<span class="wv1l">'+escL(w.label)+'</span>'):''; // einzeilig/simple: Icon fix links, Text (Label optional + Wert) direkt dahinter
        return '<div class="wv wv1'+(w.icon?' hasic':'')+'"'+st+'>'+ic+'<div class="wv1line">'+lab+'<span class="v" data-role="val">–</span></div></div>';}
      return '<div class="wv'+(w.icon?' hasic':'')+'"'+st+'>'+ic+'<div class="wvbody" style="min-width:0'+al+'"><div class="l">'+escL(w.label||'')+'</div><div class="v" data-role="val">–</div></div></div>';},
    props:function(w){return row('Wert-Größe (px)','<input id="pFs" type="number" value="'+(w.valfs||24)+'">')
      +row('Ausrichtung','<select id="pAlign"><option value=""'+(!w.align?' selected':'')+'>Links</option><option value="center"'+(w.align==='center'?' selected':'')+'>Zentriert</option><option value="right"'+(w.align==='right'?' selected':'')+'>Rechts</option></select>')
      +row('Einzeilig','<input type="checkbox" id="pOneline"'+(w.oneline?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Icon + Wert nebeneinander (Label optional)</span>')
      +(w.icon?row('Icon-X ab links (px)','<input id="pIcx" type="number" value="'+(w.icx!=null?w.icx:'')+'" placeholder="Standard">'):'')
      +'<div class="pgh">Farbe nach Schwelle</div>'
      +row('Aktiv','<input type="checkbox" id="pColThr"'+(w.colThr?' checked':'')+'>')
      +((!w.colThr&&(w.t1!=null||w.t2!=null))?'<div style="font-size:11px;color:var(--warn);margin:-2px 2px 4px">Schwellenwerte sind gesetzt ('+(w.t1!=null?w.t1:'-')+' / '+(w.t2!=null?w.t2:'-')+'), wirken aber nicht: \u201eAktiv\u201c ist aus.</div>':'')
      +(w.colThr?(row('Grün bis','<input id="pVT1" type="number" value="'+(w.t1!=null?w.t1:'')+'" placeholder="Schwelle">')+row('Gelb bis','<input id="pVT2" type="number" value="'+(w.t2!=null?w.t2:'')+'" placeholder="Schwelle">')+row('Invertieren','<input type="checkbox" id="pThrInv"'+(w.thrInvert?' checked':'')+'>')):'')
      +'<div class="pgh">Farbe nach Zustand</div>'
      +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Je Zustand eine Farbe (überschreibt die Schwellenfarbe). Erlaubt: exakte Werte, Operatoren (&gt;0, &lt;=25, !=3), Bereiche (0..25) und * für „alles andere“. Bool: 1/0 bzw. true/false.</div>'
      +listEditor(w,'vassoc','Zustand · Text · Farbe',[{k:'v',ph:'Wert (z. B. 1)'},{k:'text',ph:'Text (optional)'},{k:'color',type:'skincolor'}])
      +row('Ganze Kachel einfärben','<input type="checkbox" id="pVaFill"'+(w.vaFill?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">statt nur des Werts</span>')
      +(w.vaFill?row('Darstellung','<select id="pFillMode">'+[['','Automatisch (crit füllt)'],['soft','Getönt'],['fill','Vollfläche']].map(function(o){return '<option value="'+o[0]+'"'+((w.fillMode||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>'):'');},
    wire:function(w){
      function relive(){if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);}
      if($('#pFs'))$('#pFs').oninput=function(){w.valfs=parseInt(this.value)||24;render();};
      if($('#pAlign'))$('#pAlign').onchange=function(){w.align=this.value||undefined;render();};
      if($('#pOneline'))$('#pOneline').onchange=function(){w.oneline=this.checked||undefined;render();};
      if($('#pIcx'))$('#pIcx').oninput=function(){w.icx=this.value===''?undefined:(parseInt(this.value)||0);render();};
      if($('#pColThr'))$('#pColThr').onchange=function(){w.colThr=this.checked||undefined;renderProps();relive();};
      if($('#pVT1'))$('#pVT1').oninput=function(){w.t1=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pVT2'))$('#pVT2').oninput=function(){w.t2=this.value===''?undefined:parseFloat(this.value);relive();};
      if($('#pThrInv'))$('#pThrInv').onchange=function(){w.thrInvert=this.checked||undefined;relive();};
      if($('#pVaFill'))$('#pVaFill').onchange=function(){w.vaFill=this.checked||undefined;relive();};
      if($('#pFillMode'))$('#pFillMode').onchange=function(){w.fillMode=this.value||undefined;render();commit();};
    },
    live:function(w,el,id,d,base,txt,on){var v=$('[data-role=val]',el);if(!v)return;v.textContent=txt;
      // Mit dem FARBWORT arbeiten, nicht mit der aufgeloesten Farbe: erst daraus kann
      // stateLook() die Darstellung ableiten (crit fuellt, sonst toenen) - dieselbe Regel
      // wie im Zustands-Widget, je Widget ueber "Darstellung" uebersteuerbar.
      var _key='';
      if(w.colThr){var n=parseFloat(String(d.v).replace(',','.'));
        if(!isNaN(n)){var t1=(w.t1!=null?w.t1:0),t2=(w.t2!=null?w.t2:0),c=n<=t1?'ok':(n<=t2?'warm':'crit');
          if(w.thrInvert)c=(n<=t1?'crit':(n<=t2?'warm':'ok'));
          _key=c;}}
      var _match=null;
      if(w.vassoc&&w.vassoc.length){_match=stateHit(w.vassoc,d.v);
        if(_match){if(_match.text!=null&&_match.text!=='')v.textContent=(w.pre||'')+_match.text+(w.suf||'');
          if(_match.color)_key=_match.color;}}   // Zustand schlaegt Schwelle
      var _L=_key?stateLook(_key,w.fillMode):null;
      var _lab=$('.l',el)||$('.wv1l',el);
      if(w.vaFill&&_L&&_L.mode!=='plain'){       // ganze Kachel: gefuellt oder getoent
        el.style.background=_L.bg;el.style.borderColor=_L.bd;
        v.style.color=_L.val;if(_lab)_lab.style.color=_L.lab;
        if(!w.iconColor)el.style.setProperty('--wicon',_L.ic);
      }else{
        if(w.vaFill){el.style.background=w.bg||'';el.style.borderColor='';}
        v.style.color=(_L?_L.sc:'')||'';
        if(_lab)_lab.style.color='';
        if(!w.iconColor)el.style.setProperty('--wicon',(_L?_L.sc:'')||'');
      }
    }
  });
