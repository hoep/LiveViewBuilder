  // ===== Widget: Regenmenge — Messzylinder (Füllung nach mm) + Wert + Intensität =====
  // varId = Menge (mm), varId2 = Rate (mm/h, optional -> Intensität/Animation), rmax = Skalen-Maximum
  function _rainNum(id){var lv=id&&_lastVals[id];if(!lv)return NaN;return parseFloat(String(lv.v).replace(',','.'));}
  function _rainApply(w,el){
    var mm=_rainNum(w.varId),rate=w.varId2?_rainNum(w.varId2):NaN,mx=(w.rmax>0?w.rmax:30);
    var f=isNaN(mm)?0:Math.max(0,Math.min(1,mm/mx));
    var fill=el.querySelector('[data-role=rfill]');if(fill){var H=70;fill.setAttribute('height',(H*f).toFixed(1));fill.setAttribute('y',(80-H*f).toFixed(1));}
    var v=el.querySelector('[data-role=val]');if(v)v.textContent=isNaN(mm)?'–':(Math.round(mm*10)/10).toString().replace('.',',');
    var sub=el.querySelector('[data-role=sub]');if(sub)sub.textContent=w.varId2?(isNaN(rate)?'':((Math.round(rate*10)/10).toString().replace('.',',')+' mm/h')):(w.label||'Regen heute');
    var rain=el.querySelector('[data-role=rain]');if(rain)rain.style.opacity=(!isNaN(rate)&&rate>0)?'1':'0'; // Tropfen nur bei Niederschlag
  }
  defWidget('raincard',{
    label:'Regenmenge', paletteIcon:'rain', size:[190,120],
    defaults:function(w){w.label='Regen heute';w.rmax=30;},
    render:function(w){
      return '<div class="wraincard" style="position:absolute;inset:0;display:flex;align-items:stretch;gap:10px;padding:10px 12px;box-sizing:border-box">'
        +'<svg viewBox="0 0 40 90" style="height:100%;width:auto;flex:0 0 auto" preserveAspectRatio="xMidYMid meet">'
          +'<defs><clipPath id="rcyl'+w.id+'"><rect x="10" y="10" width="20" height="70" rx="7"/></clipPath></defs>'
          +'<g data-role="rain" style="opacity:0" clip-path="url(#rcyl'+w.id+')">'
            +'<line x1="16" y1="8" x2="16" y2="16" stroke="var(--info)" stroke-width="1.4" stroke-linecap="round"><animate attributeName="y1" values="2;74" dur="0.9s" repeatCount="indefinite"/><animate attributeName="y2" values="10;82" dur="0.9s" repeatCount="indefinite"/></line>'
            +'<line x1="24" y1="8" x2="24" y2="16" stroke="var(--info)" stroke-width="1.4" stroke-linecap="round"><animate attributeName="y1" values="2;74" dur="0.9s" begin="0.45s" repeatCount="indefinite"/><animate attributeName="y2" values="10;82" dur="0.9s" begin="0.45s" repeatCount="indefinite"/></line>'
          +'</g>'
          +'<rect data-role="rfill" x="10" y="80" width="20" height="0" rx="0" fill="var(--info)" opacity="0.85" clip-path="url(#rcyl'+w.id+')"/>'
          +'<rect x="10" y="10" width="20" height="70" rx="7" fill="none" stroke="var(--line)" stroke-width="1.2"/>'
          +'<line x1="30" y1="27.5" x2="34" y2="27.5" stroke="var(--faint)" stroke-width="0.8"/><line x1="30" y1="45" x2="34" y2="45" stroke="var(--faint)" stroke-width="0.8"/><line x1="30" y1="62.5" x2="34" y2="62.5" stroke="var(--faint)" stroke-width="0.8"/>'
        +'</svg>'
        +'<div style="display:flex;flex-direction:column;justify-content:center;min-width:0;flex:1">'
          +'<div style="display:flex;align-items:baseline;gap:4px"><span data-role="val" style="font-size:30px;font-weight:600;font-family:var(--fm);color:var(--text);line-height:1">–</span><span style="font-size:13px;color:var(--muted)">mm</span></div>'
          +'<div data-role="sub" style="font-size:12px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(w.label||'Regen heute')+'</div>'
        +'</div></div>';
    },
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_rainApply(w,el);},
    props:function(w){return row('Menge mm (Var)','<input id="pRnAmt" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pRnAmtP" style="padding:6px 8px">wählen</button>')
      +row('Rate mm/h (Var)','<input id="pRnRate" value="'+(w.varId2||'')+'" placeholder="ID (optional)"> <button class="btn" id="pRnRateP" style="padding:6px 8px">wählen</button>')
      +row('Skala max (mm)','<input id="pRnMax" type="number" min="1" value="'+(w.rmax>0?w.rmax:30)+'">');},
    wire:function(w){
      function re(){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_rainApply(w,el);}
      if($('#pRnAmt'))$('#pRnAmt').oninput=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pRnAmtP'))$('#pRnAmtP').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pRnRate'))$('#pRnRate').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pRnRateP'))$('#pRnRateP').onclick=function(){showTab('vars');_bindTarget2=w.id;};
      if($('#pRnMax'))$('#pRnMax').oninput=function(){w.rmax=parseFloat(this.value)||30;re();};
    },
    live:function(w,el,id,d,base,txt,on){_rainApply(w,el);}
  });
