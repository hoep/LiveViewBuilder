  // ===== Widget: Zustand (assoc) — zeigt den aktuellen Zustand als Icon und/oder Text =====
  // Nutzt manuelle Zuordnungen (amap: Wert·Icon·Text·Farbe) und/oder die Profil-Assoziationen der Variable.
  function _assocEq(a,b){if(String(a)===String(b))return true;var t=function(x){return x===true||x===1||x==='1'||x==='true';},f=function(x){return x===false||x===0||x==='0'||x==='false';};return (t(a)&&t(b))||(f(a)&&f(b));}
  // Erweiterter Vergleich: Operatoren (>0 >=1 <5 <=3 !=0 =2), Bereiche (1..5 / 1:5) und Platzhalter (* / else). Sonst exakter/boolescher Vergleich.
  function _assocMatch(pat,v){
    if(pat==null)return false;var p=String(pat).trim();
    if(p==='')return false;                                     // leere Zeile matcht nichts
    if(p==='*'||/^(else|sonst|default|rest|any)$/i.test(p))return true;  // expliziter Platzhalter
    var num=function(x){return parseFloat(String(x).replace(',','.'));},n=num(v);
    var op=p.match(/^(>=|<=|!=|<>|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(op){if(isNaN(n))return false;var t=num(op[2]);switch(op[1]){case '>':return n>t;case '<':return n<t;case '>=':return n>=t;case '<=':return n<=t;case '!=':case '<>':return n!==t;case '=':return n===t;}}
    var rg=p.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:\.\.|:)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(rg){if(isNaN(n))return false;var a=num(rg[1]),b=num(rg[2]);return n>=Math.min(a,b)&&n<=Math.max(a,b);}
    return _assocEq(pat,v);
  }
  // Kontrasttext (weiß/dunkel) für eine (auch als var(--x) angegebene) Farbe via YIQ-Helligkeit
  var _ascProbe;
  function _contrastText(col){try{if(!_ascProbe){_ascProbe=document.createElement('span');_ascProbe.style.cssText='position:absolute;left:-9999px;top:-9999px';document.body.appendChild(_ascProbe);}_ascProbe.style.color='#7f7f7f';_ascProbe.style.color=col;var m=getComputedStyle(_ascProbe).color.match(/(\d+)\D+(\d+)\D+(\d+)/);if(!m)return '#ffffff';var yiq=(+m[1]*299+ +m[2]*587+ +m[3]*114)/1000;return yiq>=150?'#141414':'#ffffff';}catch(e){return '#ffffff';}}
  function _chevSVG(c){return '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:'+c+';stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M9 6l6 6l-6 6"/></svg>';}
  function _assocWid(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var d=w.varId&&_lastVals[w.varId],v=d?d.v:null;
    var m=(w.amap||[]).filter(function(e){return _assocEq(e.v,v);})[0]      // exakter Treffer zuerst
        ||(w.amap||[]).filter(function(e){return _assocMatch(e.v,v);})[0];   // dann Operator/Bereich/Platzhalter
    var a=(!m)?assocFor(w,v):null,rr=a?assocResolved(w,a):null;
    var icon=(m&&m.icon)||(rr&&rr.icon)||w.icon||'';
    var ovc=(m&&m.color)||(a&&w.assocMap&&w.assocMap[String(a.v)]?w.assocMap[String(a.v)].color:'');
    var key=String(ovc||'').toLowerCase(),isAlarm=/crit|fehler|error|alarm/.test(key);
    var sc=_skinColor(ovc),soft=!!sc&&sc!=='var(--text)'&&!isAlarm;   // sanfte Hervorhebung (getönt) vs. Alarm (Vollfläche)
    var value=(d&&d.f!=null&&d.f!=='')?d.f:((m&&m.text!=null&&m.text!=='')?m.text:((a&&a.name!=null)?a.name:(d?String(d.v):'–')));
    var pillTxt=(m&&m.text)||(a&&a.name)||'',nav=!!(w.popupTo||w.navTo);
    var chip=el.querySelector('[data-role=aico]');if(chip)chip.innerHTML=icon?iconSVG(icon,v):'';
    var vEl=el.querySelector('[data-role=aval]');if(vEl)vEl.textContent=(value==null||value==='')?'–':value;
    var pill=el.querySelector('[data-role=apill]');
    var S=function(k,x){el.style.setProperty(k,x);};
    if(isAlarm){                                              // Alarm: Vollfläche in --crit, weiß
      el.style.background=sc||'var(--crit)';el.style.borderColor=sc||'var(--crit)';el.classList.add('assoc-col');
      S('--asc-chip','rgba(255,255,255,.20)');S('--asc-ic','#fff');S('--asc-val','#fff');S('--asc-lab','rgba(255,255,255,.85)');
      if(pill){if(nav){pill.className='hassoc-pill chev';pill.innerHTML=_chevSVG('#fff');}else{pill.className='hassoc-pill';pill.textContent='';}}
    }else if(soft){                                           // aktiv: getönter Hintergrund + farbiger Rahmen + Pille
      el.style.background='color-mix(in oklab,'+sc+' 13%,var(--surface))';el.style.borderColor='color-mix(in oklab,'+sc+' 45%,var(--line))';el.classList.add('assoc-col');
      S('--asc-chip','color-mix(in oklab,'+sc+' 22%,transparent)');S('--asc-ic',sc);S('--asc-val',sc);S('--asc-lab','color-mix(in oklab,'+sc+' 60%,var(--muted))');
      if(pill){if(pillTxt){pill.className='hassoc-pill';pill.textContent=pillTxt;S('--asc-pill',sc);S('--asc-pilltx',_contrastText(sc));}else if(nav){pill.className='hassoc-pill chev';pill.innerHTML=_chevSVG(sc);}else{pill.className='hassoc-pill';pill.textContent='';}}
    }else{                                                    // normal: neutrale Kachel
      el.style.background='';el.style.borderColor='';el.classList.remove('assoc-col');
      S('--asc-chip','var(--surface-2)');S('--asc-ic','var(--muted)');S('--asc-val','var(--text)');S('--asc-lab','var(--muted)');
      if(pill){if(nav){pill.className='hassoc-pill chev';pill.innerHTML=_chevSVG('var(--muted)');}else{pill.className='hassoc-pill';pill.textContent='';}}
    }
  }
  defWidget('assoc',{
    label:'Zustand', paletteIcon:'toggleon', size:[130,120],
    defaults:function(w){w.assocShow='both';},
    render:function(w){var s=w.assocShow||'both';
      var chip=(s!=='text')?'<span class="hassoc-chip" data-role="aico">'+(w.icon?iconSVG(w.icon):'')+'</span>':'';
      var pill='<span class="hassoc-pill" data-role="apill"></span>';
      var val='<div class="hassocv" data-role="aval">–</div>';
      var lbl=(s!=='icon'&&w.label)?'<div class="hassocl" data-role="alabel">'+esc(w.label)+'</div>':'';
      return '<div class="hassoc" data-role="acard"><div class="hassoc-top">'+chip+pill+'</div><div class="hassoc-btm">'+val+lbl+'</div></div>';},
    props:function(w){return row('Anzeige','<select id="pAsShow"><option value="both"'+((w.assocShow||'both')==='both'?' selected':'')+'>Icon + Wert + Label</option><option value="icon"'+(w.assocShow==='icon'?' selected':'')+'>Nur Icon</option><option value="text"'+(w.assocShow==='text'?' selected':'')+'>Wert + Label</option></select>')
      +listEditor(w,'amap','Manuell: Wert · Icon · Text · Farbe',[{k:'v',ph:'0, >0, 1..5, *'},{k:'icon',ph:'z.B. winopen'},{k:'text',ph:'Text'},{k:'color',ph:'ok/warn/crit/text'}])
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Wert: exakt (<b>0</b>, <b>1</b>), Vergleich (<b>&gt;0</b>, <b>&gt;=1</b>, <b>&lt;5</b>, <b>!=0</b>), Bereich (<b>1..5</b>) oder Platzhalter (<b>*</b> = Rest). Exakte Treffer haben Vorrang. Ganz ohne Zeilen = Profil-Assoziationen der Variable. Icons z. B. winopen/winclosed/wintilt, blindopen/blindclosed, lighton/lightoff.</div>';},
    wire:function(w){if($('#pAsShow'))$('#pAsShow').onchange=function(){w.assocShow=this.value;render();refreshAssocLive(w);commit();};},
    mount:function(w){if(w.varId)loadAssoc(w.varId,function(){_assocWid(w);});else _assocWid(w);},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id)_assocWid(w);return true;}
  });
