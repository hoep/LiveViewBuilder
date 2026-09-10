  // ===== Widget: Regenmenge — Messzylinder (Füllung nach mm) + Wert + Intensität =====
  // varId = Menge (mm), varId2 = Rate (mm/h, optional -> Intensität/Animation), rmax = Skalen-Maximum
  var _RCDROP='M0 0c2.3 3.1 2.3 5.5 0 5.5c-2.3 0 -2.3 -2.4 0 -5.5z';   // Tropfen (Teardrop)
  var _RCDROPS='M0 0c1.9 2.6 1.9 4.6 0 4.6c-1.9 0 -1.9 -2 0 -4.6z';    // kleiner Tropfen
  function _rainNum(id){var lv=id&&_lastVals[id];if(!lv)return NaN;return parseFloat(String(lv.v).replace(',','.'));}
  /**
   * Faellt gerade Niederschlag? - unabhaengig davon, ob die Wippe schon gekippt ist.
   *
   * EINE REGENWIPPE MISST KEIN NIESELN. Sie kippt erst, wenn ein festes Volumen
   * zusammengekommen ist; bis dahin steht die Rate auf 0, obwohl es draussen nass wird.
   * Gemessen am 10.09.2026: Regenrate 0,0 mm/h bei gleichzeitig Regensensor = 1,
   * optischem Regendetektor = 1 und Niederschlagsart = Regen - die Karte zeigte nichts.
   *
   * Deshalb eine ZWEITE Quelle: ein Melder, der Naesse erkennt statt Menge zu zaehlen
   * (Regensensor, optischer Detektor oder die Niederschlagsart der Station). Wahr ist
   * alles, was als Ja gemeint ist: true, eine Zahl groesser null (die Niederschlagsart
   * zaehlt 1=Regen, 2=Schnee, 3=Schneeregen), oder ein Text, der nicht nach Nein aussieht.
   */
  function _rainWet(id){
    var lv=id&&_lastVals[id];
    if(!lv)return false;
    var v=lv.v;
    if(typeof v==='boolean')return v;
    var n=parseFloat(String(v).replace(',','.'));
    if(!isNaN(n))return n>0;
    var t=String(v).toLowerCase().trim();
    return !(t===''||t==='false'||t==='aus'||t==='nein'||t==='kein'||t==='trocken');
  }
  function _rainApply(w,el){
    var mm=_rainNum(w.varId),rate=w.varId2?_rainNum(w.varId2):NaN,mx=(w.rmax>0?w.rmax:30);
    var nass=w.varId3?_rainWet(w.varId3):false;
    var misst=(!isNaN(rate)&&rate>0);          // die Wippe zaehlt bereits
    var nieselt=(nass&&!misst);                // nass, aber (noch) keine Menge
    var f=isNaN(mm)?0:Math.max(0,Math.min(1,mm/mx));
    var fill=el.querySelector('[data-role=rfill]');if(fill){var H=70;fill.setAttribute('height',(H*f).toFixed(1));fill.setAttribute('y',(80-H*f).toFixed(1));}
    var _fmt=function(x){return (w.dec!=null?x.toFixed(w.dec):(Math.round(x*10)/10).toString()).replace('.',',');};
    var v=el.querySelector('[data-role=val]');if(v)v.textContent=isNaN(mm)?'–':_fmt(mm);
    // "0,0 mm/h" waehrend es nieselt ist keine Auskunft, sondern eine Verneinung dessen,
    // was draussen passiert. Dann lieber das Wort.
    var sub=el.querySelector('[data-role=sub]');
    if(sub)sub.textContent=nieselt?'Nieseln':(w.varId2?(isNaN(rate)?'':(_fmt(rate)+' mm/h')):(w.label||'Regen heute'));
    // Tropfen nur bei Niederschlag; Fallgeschwindigkeit folgt der Rate (mehr mm/h -> schneller). Abschaltbar (w.rainAnim=false).
    var rain=el.querySelector('[data-role=rain]');
    if(rain){
      var an=(w.rainAnim!==false);
      // ZWEI GANGARTEN, nicht an/aus. Regen faellt schnell und dicht, Nieseln langsam und
      // duenn - dieselbe Animation langsamer abzuspielen sieht aus wie schwacher Regen,
      // nicht wie Niesel. Deshalb traegt der Nieselfall nur die kleinen Tropfen, weniger
      // davon, gedaempft und deutlich langsamer.
      var dur=misst?Math.max(0.35,Math.min(1.5,1.5-rate*0.09)):2.2;
      var want=!an?'':(misst?dur.toFixed(2):(nieselt?('n'+dur.toFixed(2)):''));
      if(rain.getAttribute('data-dur')!==want){rain.setAttribute('data-dur',want);
        if(an&&misst){var d1=dur.toFixed(2),d2=(dur*1.28).toFixed(2),b1=(dur/2).toFixed(2),b2=(dur/4).toFixed(2);
          rain.innerHTML='<path d="'+_RCDROP+'" opacity="0.9"><animateTransform attributeName="transform" type="translate" values="15,2;15,80" dur="'+d1+'s" repeatCount="indefinite"/></path>'
            +'<path d="'+_RCDROP+'" opacity="0.9"><animateTransform attributeName="transform" type="translate" values="25,2;25,80" dur="'+d1+'s" begin="'+b1+'s" repeatCount="indefinite"/></path>'
            +'<path d="'+_RCDROPS+'" opacity="0.7"><animateTransform attributeName="transform" type="translate" values="20,2;20,80" dur="'+d2+'s" begin="'+b2+'s" repeatCount="indefinite"/></path>';
          rain.style.opacity='1';
        }else if(an&&nieselt){var n1=dur.toFixed(2),n2=(dur*1.35).toFixed(2),nb=(dur*0.55).toFixed(2);
          rain.innerHTML='<path d="'+_RCDROPS+'" opacity="0.55"><animateTransform attributeName="transform" type="translate" values="16,2;16,80" dur="'+n1+'s" repeatCount="indefinite"/></path>'
            +'<path d="'+_RCDROPS+'" opacity="0.45"><animateTransform attributeName="transform" type="translate" values="24,2;24,80" dur="'+n2+'s" begin="'+nb+'s" repeatCount="indefinite"/></path>';
          rain.style.opacity='1';
        }else{rain.innerHTML='';rain.style.opacity='0';}
      }
    }
  }
  defWidget('raincard',{
    label:'Regenmenge', cat:'Wetter & Zeit', paletteIcon:'rain', size:[190,120],
    defaults:function(w){w.label='Regen heute';w.rmax=30;},
    render:function(w){
      // Der Messzylinder skaliert schon ueber viewBox/height:100%; hier wird die Textspalte
      // an die Kachel gekoppelt, damit sie klein nicht ueberlaeuft und gross nicht verloren wirkt.
      return '<div class="wraincard" style="position:absolute;inset:0;display:flex;align-items:stretch;gap:clamp(5px,4cqmin,12px);padding:clamp(6px,4cqmin,14px) clamp(7px,5cqmin,16px);box-sizing:border-box">'
        +'<svg viewBox="0 0 40 90" style="height:100%;width:auto;flex:0 0 auto" preserveAspectRatio="xMidYMid meet">'
          +'<defs><clipPath id="rcyl'+w.id+'"><rect x="10" y="10" width="20" height="70" rx="7"/></clipPath></defs>'
          +'<g data-role="rain" style="opacity:0" clip-path="url(#rcyl'+w.id+')" fill="var(--info)"></g>'
          +'<rect data-role="rfill" x="10" y="80" width="20" height="0" rx="0" fill="var(--info)" opacity="0.85" clip-path="url(#rcyl'+w.id+')"/>'
          +'<rect x="10" y="10" width="20" height="70" rx="7" fill="none" stroke="var(--line)" stroke-width="1.2"/>'
          +'<line x1="30" y1="27.5" x2="34" y2="27.5" stroke="var(--faint)" stroke-width="0.8"/><line x1="30" y1="45" x2="34" y2="45" stroke="var(--faint)" stroke-width="0.8"/><line x1="30" y1="62.5" x2="34" y2="62.5" stroke="var(--faint)" stroke-width="0.8"/>'
        +'</svg>'
        +'<div style="display:flex;flex-direction:column;justify-content:center;min-width:0;flex:1">'
          +'<div style="display:flex;align-items:baseline;gap:clamp(3px,1.5cqmin,6px)"><span data-role="val" style="font-size:clamp(15px,17cqmin,44px);font-weight:600;font-family:var(--fm);color:var(--text);line-height:1">–</span><span style="font-size:clamp(9px,6cqmin,16px);color:var(--muted)">mm</span></div>'
          +'<div data-role="sub" style="font-size:clamp(9px,5cqmin,14px);color:var(--muted);margin-top:clamp(2px,1.5cqmin,5px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escL(w.label||'Regen heute')+'</div>'
        +'</div></div>';
    },
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_rainApply(w,el);},
    props:function(w){return row('Menge mm (Var)','<input id="pRnAmt" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pRnAmtP" style="padding:6px 8px">wählen</button>')
      +row('Rate mm/h (Var)','<input id="pRnRate" value="'+(w.varId2||'')+'" placeholder="ID (optional)"> <button class="btn" id="pRnRateP" style="padding:6px 8px">wählen</button>')
      +row('Niederschlag erkannt (Var)','<input id="pRnWet" value="'+(w.varId3||'')+'" placeholder="ID (optional)"> <button class="btn" id="pRnWetP" style="padding:6px 8px">wählen</button>')
      +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Regensensor, optischer Detektor oder Niederschlagsart. Eine Regenwippe misst kein Nieseln — sie kippt erst ab einer gewissen Menge, bis dahin steht die Rate auf 0. Mit dieser Variablen zeigt die Karte auch dann Tropfen, langsamer und dünner, und schreibt „Nieseln“ statt „0,0 mm/h“.</div>'
      +row('Skala max (mm)','<input id="pRnMax" type="number" min="1" value="'+(w.rmax>0?w.rmax:30)+'">')
      +row('Tropfen-Animation','<input type="checkbox" id="pRnAnim"'+(w.rainAnim!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Tempo folgt der Rate; ohne gemessene Rate greift der Nieselgang</span>');},
    wire:function(w){
      function re(){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_rainApply(w,el);}
      if($('#pRnAmt'))$('#pRnAmt').oninput=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pRnAmtP'))$('#pRnAmtP').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pRnRate'))$('#pRnRate').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pRnRateP'))$('#pRnRateP').onclick=function(){showTab('vars');_bindTarget2=w.id;};
      if($('#pRnWet'))$('#pRnWet').oninput=function(){w.varId3=parseInt(this.value)||0;render();};
      if($('#pRnWetP'))$('#pRnWetP').onclick=function(){showTab('vars');_bindTarget3=w.id;};
      if($('#pRnMax'))$('#pRnMax').oninput=function(){w.rmax=parseFloat(this.value)||30;re();};
      if($('#pRnAnim'))$('#pRnAnim').onchange=function(){w.rainAnim=this.checked?undefined:false;re();};
    },
    live:function(w,el,id,d,base,txt,on){_rainApply(w,el);}
  });
