  // ===== Widget: Windrose — Windrichtung (Kompass mit Richtungsangaben) + optional Geschwindigkeit =====
  // varId = Richtung (Grad 0..360 ODER Himmelsrichtung als Text, z.B. "NW"/"NW"), varId2 = Geschwindigkeit (Mitte)
  var _wrC2D={N:0,NNO:22.5,NO:45,ONO:67.5,O:90,OSO:112.5,SO:135,SSO:157.5,S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5,
              NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5}; // deutsch + englisch (E=Ost)
  function _wrDeg(v){
    if(v==null)return null;
    var s=String(v).trim().replace(',','.'),n=parseFloat(s);
    if(!isNaN(n)&&/^-?\d/.test(s))return ((n%360)+360)%360;
    var key=s.toUpperCase().replace(/[^NOSWE]/g,'');if(_wrC2D[key]!=null)return _wrC2D[key];
    return null;
  }
  function _wrCard(deg){return ['N','NO','O','SO','S','SW','W','NW'][Math.round((deg%360)/45)%8];}
  function _wrPt(deg,r){var a=(deg-90)*Math.PI/180;return [(50+r*Math.cos(a)),(50+r*Math.sin(a))];} // 0°=oben(N), 90°=rechts(O)
  function _wrApply(w,el){
    var dv=w.varId&&_lastVals[w.varId],deg=_wrDeg(dv?dv.v:null);
    var nd=el.querySelector('[data-role=needle]'),cd=el.querySelector('[data-role=wcard]'),sp=el.querySelector('[data-role=wspd]');
    if(nd){if(deg==null){nd.style.opacity='0.15';}else{nd.style.opacity='1';nd.setAttribute('transform','rotate('+deg.toFixed(1)+' 50 50)');}}
    if(cd)cd.textContent=(deg==null)?'–':_wrCard(deg);
    if(sp){var s2=w.varId2&&_lastVals[w.varId2];sp.textContent=s2?String(s2.f!=null&&s2.f!==''?s2.f:s2.v):'';}
  }
  defWidget('windrose',{
    label:'Windrose', paletteIcon:'wind', size:[150,150],
    render:function(w){
      var ticks='',labs='',i,LB=['N','NO','O','SO','S','SW','W','NW'];
      for(i=0;i<8;i++){var big=(i%2===0),p0=_wrPt(i*45,46),p1=_wrPt(i*45,big?40:43);
        ticks+='<line x1="'+p0[0].toFixed(1)+'" y1="'+p0[1].toFixed(1)+'" x2="'+p1[0].toFixed(1)+'" y2="'+p1[1].toFixed(1)+'" stroke="var(--line)" stroke-width="'+(big?1.4:0.8)+'"/>';
        var lp=_wrPt(i*45,33);labs+='<text x="'+lp[0].toFixed(1)+'" y="'+(lp[1]+2.6).toFixed(1)+'" text-anchor="middle" font-size="'+(big?7.5:6)+'" fill="'+(big?'var(--muted)':'var(--faint)')+'" font-family="var(--fu)">'+LB[i]+'</text>';}
      return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
        +'<svg viewBox="0 0 100 100" style="width:100%;height:100%">'
        +'<circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" stroke-width="1"/>'
        +'<circle cx="50" cy="50" r="40" fill="none" stroke="var(--line-soft)" stroke-width="0.6"/>'
        +ticks+labs
        +'<g data-role="needle" transform="rotate(0 50 50)"><polygon points="50,12 45.5,33 50,28 54.5,33" fill="var(--accent)"/><polygon points="50,88 45.5,67 50,72 54.5,67" fill="var(--surface-2)"/></g>'
        +'<circle cx="50" cy="50" r="12" fill="var(--surface)" stroke="var(--line)" stroke-width="0.8"/>'
        +'<text data-role="wspd" x="50" y="49" text-anchor="middle" font-size="8" fill="var(--text)" font-family="var(--fm)"></text>'
        +'<text data-role="wcard" x="50" y="58" text-anchor="middle" font-size="7.5" font-weight="600" fill="var(--accent)" font-family="var(--fu)">–</text>'
        +'</svg></div>';
    },
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)_wrApply(w,el);},
    props:function(w){return row('Richtung (Var)','<input id="pWrDir" value="'+(w.varId||'')+'" placeholder="ID (Grad o. NW)"> <button class="btn" id="pWrDirP" style="padding:6px 8px">wählen</button>')
      +row('Geschw. (Var)','<input id="pWrSpd" value="'+(w.varId2||'')+'" placeholder="ID (optional)"> <button class="btn" id="pWrSpdP" style="padding:6px 8px">wählen</button>');},
    wire:function(w){
      if($('#pWrDir'))$('#pWrDir').oninput=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pWrDirP'))$('#pWrDirP').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pWrSpd'))$('#pWrSpd').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pWrSpdP'))$('#pWrSpdP').onclick=function(){showTab('vars');_bindTarget2=w.id;};
    },
    live:function(w,el,id,d,base,txt,on){_wrApply(w,el);}
  });
