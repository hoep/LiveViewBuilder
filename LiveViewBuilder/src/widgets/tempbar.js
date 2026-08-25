  // ===== Widget: Säule (tempbar) — senkrechte Säule mit Soll-Marke, Warnschwelle und Pill =====
  //
  // Ursprünglich die Temperatur-Säule eines Raums. Dieselbe Zeichnung beantwortet
  // aber auch "wie voll ist das Pelletlager": Fuellstand statt Temperatur, eine
  // WARNSCHWELLE statt der Soll-Marke - und der FREIRAUM oben, weil er die Frage
  // "passt eine Lieferung noch hinein" beantwortet, die man beim Nachbestellen hat.
  //
  // Beschriftet wird nur die Warnschwelle an der Skala; der Fuellstand steht als
  // feste Zeile darueber. Zwei Beschriftungen an der Saeule wuerden sich
  // ueberschreiben, sobald der Fuellstand nahe der Schwelle liegt.
  //
  // Wert-/Füllstand-Anwendung geteilt von mount (Start aus Cache) UND live (Wertänderung),
  // sonst bleibt die Säule leer, bis sich der Wert einmal ändert.
  function _tbZahl(w,feld,vidFeld){
    if(w[vidFeld]){var d=_lastVals[w[vidFeld]];return d?parseFloat(String(d.v).replace(',','.')):NaN;}
    return (w[feld]!=null&&w[feld]!=='')?parseFloat(String(w[feld]).replace(',','.')):NaN;
  }
  function _tbPct(w,v){
    var tmn=(w.min!=null?w.min:16),tmx=(w.max!=null?w.max:24);
    return Math.max(0,Math.min(100,(v-tmn)/((tmx-tmn)||1)*100));
  }
  function _tbTsd(n){ // 5295 -> "5.295"
    var s=String(Math.round(n)),o='',k=0;
    for(var i=s.length-1;i>=0;i--){o=s[i]+o;if(++k%3===0&&i>0&&s[i-1]!=='-')o='.'+o;}
    return o;
  }
  /** Marken (Soll, Warnschwelle) und Freiraum-Zeile - unabhaengig vom Hauptwert. */
  function _tbMarken(w,el){
    if(!el)return;
    var so=el.querySelector('[data-role=soll]'), wa=el.querySelector('[data-role=warn]'),
        wl=el.querySelector('[data-role=warnlab]');
    var sv=_tbZahl(w,'soll','sollVid');
    if(so){if(isNaN(sv)){so.style.display='none';}else{so.style.display='';so.style.bottom=_tbPct(w,sv).toFixed(2)+'%';}}
    var wv=_tbZahl(w,'tbWarn','tbWarnVid');
    if(wa){if(isNaN(wv)){wa.style.display='none';}else{wa.style.display='';wa.style.bottom=_tbPct(w,wv).toFixed(2)+'%';}}
    if(wl){if(isNaN(wv)){wl.style.display='none';}else{wl.style.display='';wl.style.bottom=_tbPct(w,wv).toFixed(2)+'%';
      wl.textContent=_tbTsd(wv)+(w.tbUnit?(' '+w.tbUnit):'');}}
  }
  function _tbApply(w,el,d,txt){
    if(!d||!el)return;
    var tv=el.querySelector('[data-role=val]');if(tv)tv.textContent=(txt!=null?txt:((d.f!=null&&d.f!=='')?d.f:d.v));
    var nv=parseFloat(String(d.v).replace(',','.')),ff=el.querySelector('[data-role=fill]');
    if(ff&&!isNaN(nv))ff.style.height=_tbPct(w,nv).toFixed(2)+'%';
    var fr=el.querySelector('[data-role=frei]');
    if(fr){var tmx=(w.max!=null?w.max:24);
      if(isNaN(nv)){fr.style.display='none';}
      else{fr.style.display='';fr.innerHTML='frei<br>'+_tbTsd(Math.max(0,tmx-nv))+(w.tbUnit?(' '+w.tbUnit):'');}}
    _tbMarken(w,el);
  }
  defWidget('tempbar',{
    label:'Säule', cat:'Anzeige', paletteIcon:'temperature', size:[110,190],
    defaults:function(w){w.label='EG';w.min=16;w.max=24;w.soll=22;w.pill='Komfort';w.pillState='ok';},
    render:function(w){
      var tmn=(w.min!=null?w.min:16),tmx=(w.max!=null?w.max:24);
      var skala=(w.tbScale===false)?'':'<div class="htscale"><span>'+_tbTsd(tmx)+'</span><span>'+_tbTsd(tmn)+'</span></div>';
      return '<div class="htemp'+(w.warm?' warm':'')+'"'
        +((w.tbBarW)?(' style="--htbar-w:'+(parseInt(w.tbBarW)||0)+'px"'):'')+'>'
        +((w.tbVal===false)?'':'<div class="htval" data-role="val">–</div>')
        +'<div class="htbarwrap">'+skala
        +'<div class="htbar">'
        +(w.tbFree?'<span class="htfrei" data-role="frei"></span>':'')
        +'<i class="htfill" data-role="fill"></i>'
        +'<i class="htsoll" data-role="soll" style="display:none"></i>'
        +'<i class="htwarn" data-role="warn" style="display:none"></i>'
        +'</div>'
        +((((w.tbWarn!=null&&w.tbWarn!=='')||w.tbWarnVid)&&w.tbWarnLab!==false)?'<div class="htmk"><span class="htwarnlab" data-role="warnlab"></span></div>':'')
        +'</div>'
        +'<div class="htzn">'+escL(w.label||'')+'</div>'
        +(w.pill?'<span class="hpill '+(w.pillState||'ok')+'"><span class="hpd"></span>'+esc(w.pill)+'</span>':'')
        +'</div>';
    },
    props:function(w){if(w.type!=='tempbar')return '';
      return row('Soll / Marke','<input id="pSoll" type="number" step="0.5" style="width:84px" value="'+(w.soll!=null?w.soll:'')+'" placeholder="leer = keine"> <input id="pSollVid" type="number" style="width:84px" value="'+(w.sollVid||'')+'" placeholder="Var-ID">')
        +'<div class="pgh">Warnschwelle</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Gestrichelte Linie in der Säule, beschriftet an der Skala. Fester Wert oder Variable — nur diese Marke wird beschriftet, der Istwert steht oben.</div>'
        +row('Wert / Variable','<input id="pTbWarn" type="number" step="any" style="width:84px" value="'+(w.tbWarn!=null?w.tbWarn:'')+'" placeholder="z. B. 400"> <input id="pTbWarnVid" type="number" style="width:84px" value="'+(w.tbWarnVid||'')+'" placeholder="Var-ID">')
        +row('Einheit an Marken','<input id="pTbUnit" value="'+esc(w.tbUnit||'')+'" style="width:70px" placeholder="kg">')
        +row('Freiraum zeigen','<input type="checkbox" id="pTbFree"'+(w.tbFree?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Max − Istwert im leeren Teil</span>')
        +row('Skala zeigen','<input type="checkbox" id="pTbScale"'+((w.tbScale===false)?'':' checked')+'>')
        +row('Wert oben zeigen','<input type="checkbox" id="pTbVal"'+((w.tbVal===false)?'':' checked')+'>')
        +row('Warnschwelle beschriften','<input type="checkbox" id="pTbWLab"'+((w.tbWarnLab===false)?'':' checked')+'> <span style="font-size:11px;color:var(--muted)">aus, wenn der Wert schon daneben steht</span>')
        +row('Breite der Säule (px)','<input id="pTbBarW" type="number" min="0" style="width:80px" value="'+(w.tbBarW||'')+'" placeholder="automatisch">')
        +'<div class="pgh">Beschriftung</div>'
        +row('Badge','<input id="pPill" value="'+esc(w.pill||'')+'">')
        +row('Status','<select id="pPillState">'+[['ok','OK'],['warn','Warnung'],['crit','Kritisch'],['on','An'],['off','Aus'],['muted','Neutral']].map(function(o){return '<option value="'+o[0]+'"'+((w.pillState||'ok')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
        +row('Warm','<label style="font-size:12px"><input type="checkbox" id="pWarm"'+(w.warm?' checked':'')+'> warme Farbe</label>');
    },
    wire:function(w){
      if($('#pSoll'))$('#pSoll').oninput=function(){w.soll=this.value===''?undefined:parseFloat(this.value);render();};
      if($('#pSollVid'))$('#pSollVid').onchange=function(){w.sollVid=parseInt(this.value)||undefined;render();commit();};
      if($('#pTbWarn'))$('#pTbWarn').oninput=function(){w.tbWarn=this.value===''?undefined:parseFloat(this.value);render();};
      if($('#pTbWarnVid'))$('#pTbWarnVid').onchange=function(){w.tbWarnVid=parseInt(this.value)||undefined;render();commit();};
      if($('#pTbUnit'))$('#pTbUnit').oninput=function(){w.tbUnit=this.value||undefined;render();};
      if($('#pTbFree'))$('#pTbFree').onchange=function(){w.tbFree=this.checked||undefined;render();commit();};
      if($('#pTbScale'))$('#pTbScale').onchange=function(){w.tbScale=this.checked?undefined:false;render();commit();};
      if($('#pTbVal'))$('#pTbVal').onchange=function(){w.tbVal=this.checked?undefined:false;render();commit();};
      if($('#pTbWLab'))$('#pTbWLab').onchange=function(){w.tbWarnLab=this.checked?undefined:false;render();commit();};
      if($('#pTbBarW'))$('#pTbBarW').oninput=function(){w.tbBarW=this.value===''?undefined:(parseInt(this.value)||0);render();commit();};
      if($('#pPill'))$('#pPill').oninput=function(){w.pill=this.value;render();};
      if($('#pPillState'))$('#pPillState').onchange=function(){w.pillState=this.value;render();};
      if($('#pWarm'))$('#pWarm').onchange=function(){w.warm=this.checked||undefined;render();};
    },
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));
      if(!el)return;
      if(w.varId&&_lastVals[w.varId])_tbApply(w,el,_lastVals[w.varId]); else _tbMarken(w,el);},
    live:function(w,el,id,d,base,txt,on){
      if(w.varId===id){_tbApply(w,el,d,txt);return;}
      if(String(w.sollVid)===String(id)||String(w.tbWarnVid)===String(id))_tbMarken(w,el);
      return;}
  });
