  // ===== Widget: Zustand (assoc) — zeigt den aktuellen Zustand als Icon und/oder Text =====
  // Nutzt manuelle Zuordnungen (amap: Wert·Icon·Text·Farbe) und/oder die Profil-Assoziationen der Variable.
  // Kontrasttext (weiß/dunkel) für eine (auch als var(--x) angegebene) Farbe via YIQ-Helligkeit
  var _ascProbe;
  function _contrastText(col){try{if(!_ascProbe){_ascProbe=document.createElement('span');_ascProbe.style.cssText='position:absolute;left:-9999px;top:-9999px';document.body.appendChild(_ascProbe);}_ascProbe.style.color='#7f7f7f';_ascProbe.style.color=col;var m=getComputedStyle(_ascProbe).color.match(/(\d+)\D+(\d+)\D+(\d+)/);if(!m)return '#ffffff';var yiq=(+m[1]*299+ +m[2]*587+ +m[3]*114)/1000;return yiq>=150?'#141414':'#ffffff';}catch(e){return '#ffffff';}}
  function _chevSVG(c){return '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:'+c+';stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M9 6l6 6l-6 6"/></svg>';}
  function _assocWid(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var d=w.varId&&_lastVals[w.varId],v=d?d.v:null;
    var m=stateHit(w.amap,v);   // exakt zuerst, dann Operator/Bereich/Platzhalter (Kern)
    var a=(!m)?assocFor(w,v):null,rr=a?assocResolved(w,a):null;
    var icon=(m&&m.icon)||(rr&&rr.icon)||w.icon||'';
    var ovc=(m&&m.color)||(a&&w.assocMap&&w.assocMap[String(a.v)]?w.assocMap[String(a.v)].color:'');
    var _L=stateLook(ovc,w.fillMode),isAlarm=(_L.mode==='fill');   // Darstellung zentral, je Widget uebersteuerbar
    var sc=_L.sc,soft=(_L.mode==='soft');
    // Zähler (numerisch): Zahl groß, Zustandstext als Pille. Zustand (Text): Text groß (überschreibbar) ODER als Pille (w.stateAs='pill').
    var asPill=(w.stateAs==='pill');
    var dfTxt=(d&&d.f!=null&&d.f!=='')?String(d.f):'';
    var dfNum=dfTxt!==''&&/^[+\-]?[\d.,\s]+$/.test(dfTxt);
    var stTxt=(m&&m.text!=null&&m.text!=='')?m.text:((a&&a.name!=null&&a.name!=='')?a.name:(dfTxt||(d?String(d.v):'–')));
    var value,pillTxt;
    if(dfNum){var _an=parseFloat(dfTxt.replace(/\s/g,'').replace(',','.'));value=(w.dec!=null&&!isNaN(_an))?_an.toFixed(w.dec).replace('.',','):dfTxt;if(w.unit)value+=' '+w.unit;pillTxt=(m&&m.text)||(a&&a.name)||'';}
    else if(asPill){value='';pillTxt=stTxt;}
    else{value=stTxt;pillTxt='';}
    var nav=!!(w.popupTo||w.navTo);
    var chip=el.querySelector('[data-role=aico]');if(chip)chip.innerHTML=icon?iconSVG(icon,v):'';
    var vEl=el.querySelector('[data-role=aval]');if(vEl)vEl.textContent=(value==null||value==='')?(asPill?'':'–'):value;
    var pill=el.querySelector('[data-role=apill]');
    var S=function(k,x){el.style.setProperty(k,x);};
    if(isAlarm){                                              // Alarm: Vollfläche in --crit, weiß, kräftige helle Kante
      el.style.background=_L.bg;el.style.borderColor=_L.bd;el.classList.add('assoc-col');
      S('--asc-chip',_L.chip);S('--asc-ic',_L.ic);S('--asc-val',_L.val);S('--asc-lab',_L.lab);
      S('--asc-barw',_L.barw);S('--asc-bar',_L.bar);
      if(pill){if(pillTxt){pill.className='hassoc-pill';pill.textContent=pillTxt;S('--asc-pill','rgba(255,255,255,.22)');S('--asc-pilltx','#fff');}else if(nav){pill.className='hassoc-pill chev';pill.innerHTML=_chevSVG('#fff');}else{pill.className='hassoc-pill';pill.textContent='';}}
    }else if(soft){                                           // aktiv: getönter Hintergrund + kräftige farbige linke Kante + Pille
      el.style.background=_L.bg;el.style.borderColor=_L.bd;el.classList.add('assoc-col');
      S('--asc-chip',_L.chip);S('--asc-ic',_L.ic);S('--asc-val',_L.val);S('--asc-lab',_L.lab);
      S('--asc-barw',_L.barw);S('--asc-bar',_L.bar);
      if(pill){if(pillTxt){pill.className='hassoc-pill';pill.textContent=pillTxt;S('--asc-pill',sc);S('--asc-pilltx',_contrastText(sc));}else if(nav){pill.className='hassoc-pill chev';pill.innerHTML=_chevSVG(sc);}else{pill.className='hassoc-pill';pill.textContent='';}}
    }else{                                                    // normal / standard: neutrale Kachel (keine Kante)
      var neutral=(sc==='var(--text)');                       // Farbe explizit "standard"
      el.style.borderColor='';el.classList.remove('assoc-col');
      S('--asc-ic','var(--muted)');S('--asc-val','var(--text)');S('--asc-lab','var(--muted)');S('--asc-barw','0');S('--asc-bar','transparent');
      if(neutral){                                            // "standard": leichte transluzente Aufhellung (hebt sich in Dark ab) + neutrale Pille
        el.style.background='color-mix(in oklab,var(--text) 7%,transparent)';S('--asc-chip','color-mix(in oklab,var(--text) 12%,transparent)');
      }else{                                                  // gar keine Farbe: Kachel-Standard
        el.style.background='';S('--asc-chip','var(--surface-2)');
      }
      if(pill){
        if((neutral||asPill)&&pillTxt){pill.className='hassoc-pill';pill.textContent=pillTxt;S('--asc-pill','color-mix(in oklab,var(--muted) 26%,transparent)');S('--asc-pilltx','var(--text)');}
        else if(nav){pill.className='hassoc-pill chev';pill.innerHTML=_chevSVG('var(--muted)');}
        else{pill.className='hassoc-pill';pill.textContent='';}
      }
    }
  }
  defWidget('assoc',{
    label:'Zustand', paletteIcon:'toggleon', size:[130,120],
    defaults:function(w){w.assocShow='both';},
    render:function(w){var s=w.assocShow||'both';
      var chip=(s!=='text')?'<span class="hassoc-chip" data-role="aico">'+(w.icon?iconSVG(w.icon):'')+'</span>':'';
      var pill='<span class="hassoc-pill" data-role="apill"></span>';
      var vc='hassocv',vst='';                                 // eigene Schrift für die Anzahl (Wert)
      if(w.vff){vc+=' tw-vff';vst+='--asc-vff:'+w.vff+';';}
      if(w.vfwt){vc+=' tw-vfwt';vst+='--asc-vfwt:'+w.vfwt+';';}
      if(w.vfsz){vc+=' tw-vfsz';vst+='--asc-vfsz:'+w.vfsz+'px;';}
      var val='<div class="'+vc+'" data-role="aval"'+(vst?' style="'+vst+'"':'')+'>–</div>';
      var lbl=(s!=='icon'&&w.label)?'<div class="hassocl" data-role="alabel">'+esc(w.label)+'</div>':'';
      return '<div class="hassoc" data-role="acard"><div class="hassoc-top">'+chip+pill+'</div><div class="hassoc-btm">'+val+lbl+'</div></div>';},
    props:function(w){var FF=[['system-ui,-apple-system,sans-serif','Sans'],['Georgia,\'Times New Roman\',serif','Serif'],['var(--fm)','Mono'],['\'Segoe UI\',Arial,sans-serif','Segoe/Arial'],['\'Courier New\',monospace','Courier'],['Verdana,sans-serif','Verdana']];
      return row('Darstellung','<select id="pFillMode">'+[['','Automatisch (crit füllt)'],['soft','Getönt'],['fill','Vollfläche']].map(function(o){return '<option value="'+o[0]+'"'+((w.fillMode||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
      +row('Anzeige','<select id="pAsShow"><option value="both"'+((w.assocShow||'both')==='both'?' selected':'')+'>Icon + Wert + Label</option><option value="icon"'+(w.assocShow==='icon'?' selected':'')+'>Nur Icon</option><option value="text"'+(w.assocShow==='text'?' selected':'')+'>Wert + Label</option></select>')
      +row('Zustand als','<select id="pStateAs"><option value="value"'+((w.stateAs||'value')==='value'?' selected':'')+'>Großer Wert</option><option value="pill"'+(w.stateAs==='pill'?' selected':'')+'>Pille</option></select>')
      +row('Einheit','<input id="pAsUnit" value="'+esc(w.unit||'')+'" placeholder="z. B. kWh (bei Zählerwerten)">')
      +listEditor(w,'amap','Manuell: Wert · Icon · Text · Farbe',[{k:'v',ph:'0, >0, 1..5, *'},{k:'icon',ph:'z.B. winopen'},{k:'text',ph:'Text (Pille)'},{k:'color',ph:'ok/warn/crit/text'}])
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Wert: exakt (<b>0</b>, <b>1</b>), Vergleich (<b>&gt;0</b>, <b>&gt;=1</b>, <b>&lt;5</b>, <b>!=0</b>), Bereich (<b>1..5</b>) oder Platzhalter (<b>*</b> = Rest). Exakte Treffer haben Vorrang. Die Spalte <b>Text</b> überschreibt den Zustandstext (Pille) — auch für Profil-Assoziationen (Wert eintragen). Farbe <b>crit</b> = Alarm (rote Vollfläche), sonst getönt mit linker Kante. Icons z. B. winopen/winclosed/wintilt, blindopen/blindclosed, lighton/lightoff.</div>'
      +'<div class="pgh">Schrift Wert</div>'
      +row('Schrift','<select id="pVff"><option value="">Wie Widget</option>'+FF.map(function(o){return '<option value="'+esc(o[0])+'"'+(w.vff===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
      +row('Gewicht','<select id="pVfwt"><option value="">Standard</option>'+['300','400','500','600','700','800'].map(function(x){return '<option value="'+x+'"'+(w.vfwt===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select>')
      +row('Größe (px)','<input id="pVfsz" type="number" min="0" value="'+(w.vfsz||'')+'" placeholder="auto">');},
    wire:function(w){
      if($('#pFillMode'))$('#pFillMode').onchange=function(){w.fillMode=this.value||undefined;render();commit();};if($('#pAsShow'))$('#pAsShow').onchange=function(){w.assocShow=this.value;render();refreshAssocLive(w);commit();};
      if($('#pStateAs'))$('#pStateAs').onchange=function(){w.stateAs=this.value==='value'?undefined:this.value;render();refreshAssocLive(w);commit();};
      if($('#pAsUnit'))$('#pAsUnit').oninput=function(){w.unit=this.value||undefined;render();refreshAssocLive(w);commit();};
      if($('#pVff'))$('#pVff').onchange=function(){w.vff=this.value||undefined;render();refreshAssocLive(w);commit();};
      if($('#pVfwt'))$('#pVfwt').onchange=function(){w.vfwt=this.value||undefined;render();refreshAssocLive(w);commit();};
      if($('#pVfsz'))$('#pVfsz').oninput=function(){w.vfsz=parseInt(this.value)||undefined;render();refreshAssocLive(w);commit();};},
    mount:function(w){if(w.varId)loadAssoc(w.varId,function(){_assocWid(w);});else _assocWid(w);},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id)_assocWid(w);return true;}
  });
