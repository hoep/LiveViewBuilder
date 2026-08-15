  // ===== Widget: Energiefluss-Linie (flowline) — animierte Fluss-Linie, Farbe/Breite/Richtung nach Wert =====
  // Alle Masse (Musterlaenge, Strichdicke, Linienstaerke) haengen an EINER Schriftgroesse am
  // Wrapper und werden in em ausgedrueckt. Vorteil: die @keyframes duerfen bei einer festen
  // em-Laenge bleiben, damit Muster und Animation nie auseinanderlaufen — und trotzdem
  // skaliert alles mit der Kachel (cqmin), ohne transform:scale.
  var FL_FS='clamp(10px,55cqmin,34px)'; // 1em = Laenge einer Musterperiode
  var FL_DASH='0.364em';                // sichtbarer Strich je Periode (entspricht 8 von 22px)
  function flowlineThick(mag){return (0.09+mag*0.45).toFixed(3);} // Flussdicke in em (Grundlinie 0.09em)
  function flowlineState(w){
    var thr=(w.flThr!=null?w.flThr:0), ref=(w.flRef!=null&&w.flRef>0?w.flRef:1000);
    var lv=w.varId&&_lastVals[w.varId];
    var n=lv?parseFloat(String(lv.v).replace(',','.')):NaN;
    var pos=_skinColor(w.flPos)||w.flPos||'#00cdab', neg=_skinColor(w.flNeg)||w.flNeg||'#ff5d5d', gray=cssv('--muted')||'#8a97a0';
    var color=gray, sign=0;
    if(!isNaN(n)){if(n>thr){color=pos;sign=1;}else if(n<-thr){color=neg;sign=-1;}}
    var mag=isNaN(n)?0:Math.min(1,Math.abs(n)/ref);
    return {color:color,sign:sign,mag:mag,width:2+mag*10};
  }
  defWidget('flowline',{
    label:'Energiefluss', cat:'Anzeige', paletteIcon:'wline', size:[200,40],
    defaults:function(w){w.flDir='h';w.flPos='ok';w.flNeg='crit';w.flThr=0;w.flRef=1000;},
    render:function(w){
      var st=flowlineState(w), horiz=(w.flDir!=='v');
      var dir=(st.sign<0?'reverse':'normal'), play=(st.sign===0?'paused':'running'), th=flowlineThick(st.mag);
      var grad='repeating-linear-gradient('+(horiz?'90deg':'180deg')+','+st.color+' 0 '+FL_DASH+',transparent '+FL_DASH+' 1em)';
      var bsize=horiz?'1em 100%':'100% 1em', anim=horiz?'flLnX':'flLnY';
      var track=horiz
        ?'<div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:max(1.5px,0.09em);background:var(--line);border-radius:2px;opacity:.7"></div>'
        :'<div style="position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:max(1.5px,0.09em);background:var(--line);border-radius:2px;opacity:.7"></div>';
      var flowStyle=horiz
        ?'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:max(2px,'+th+'em)'
        :'position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:max(2px,'+th+'em)';
      var flow='<div data-role="flow" style="'+flowStyle+';border-radius:6px;background:'+grad+';background-size:'+bsize+';animation:'+anim+' 1.1s linear infinite;animation-direction:'+dir+';animation-play-state:'+play+'"></div>';
      // font-size am Wrapper: Kinder erben sie, deshalb meinen Muster, Animation und Dicke dasselbe em.
      return '<style>@keyframes flLnX{from{background-position:0 0}to{background-position:1em 0}}@keyframes flLnY{from{background-position:0 0}to{background-position:0 1em}}</style><div style="position:absolute;inset:0;overflow:hidden;font-size:'+FL_FS+'">'+track+flow+'</div>';
    },
    props:function(w){return row('Ausrichtung','<select id="pFlDir"><option value="h"'+(w.flDir!=='v'?' selected':'')+'>Horizontal</option><option value="v"'+(w.flDir==='v'?' selected':'')+'>Vertikal</option></select>')
      +'<div class="pgh">Farben</div>'
      +row('Positiv',selOf('pFlPos',w.flPos||'ok',['accent','ok','info','warn','crit','muted','warm']))
      +row('Negativ',selOf('pFlNeg',w.flNeg||'crit',['accent','ok','info','warn','crit','muted','warm']))
      +row('Schwelle','<input id="pFlThr" type="number" step="0.1" value="'+(w.flThr!=null?w.flThr:0)+'">')
      +row('Referenz','<input id="pFlRef" type="number" step="1" value="'+(w.flRef!=null?w.flRef:1000)+'" placeholder="Wert für max. Breite">');},
    wire:function(w){
      if($('#pFlDir'))$('#pFlDir').onchange=function(){w.flDir=this.value;render();};
      if($('#pFlPos'))$('#pFlPos').onchange=function(){w.flPos=this.value;render();};
      if($('#pFlNeg'))$('#pFlNeg').onchange=function(){w.flNeg=this.value;render();};
      if($('#pFlThr'))$('#pFlThr').oninput=function(){w.flThr=this.value===''?0:parseFloat(this.value);render();};
      if($('#pFlRef'))$('#pFlRef').oninput=function(){var v=parseFloat(this.value);w.flRef=(isNaN(v)||v<=0)?1000:v;render();};
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId!==id)return;
      var fl=$('[data-role=flow]',el);if(!fl)return;
      var horiz=(w.flDir!=='v');
      var thr=(w.flThr!=null?w.flThr:0), ref=(w.flRef!=null&&w.flRef>0?w.flRef:1000);
      var n=parseFloat(String(d.v).replace(',','.'));
      var pos=_skinColor(w.flPos)||w.flPos||'#00cdab', neg=_skinColor(w.flNeg)||w.flNeg||'#ff5d5d', gray=cssv('--muted')||'#8a97a0';
      var color=gray, sign=0;
      if(!isNaN(n)){if(n>thr){color=pos;sign=1;}else if(n<-thr){color=neg;sign=-1;}}
      var mag=isNaN(n)?0:Math.min(1,Math.abs(n)/ref), th=flowlineThick(mag); // identische Formel wie in render()
      fl.style.background='repeating-linear-gradient('+(horiz?'90deg':'180deg')+','+color+' 0 '+FL_DASH+',transparent '+FL_DASH+' 1em)';
      fl.style.backgroundSize=horiz?'1em 100%':'100% 1em';
      if(horiz)fl.style.height='max(2px,'+th+'em)';else fl.style.width='max(2px,'+th+'em)';
      fl.style.animationDirection=sign<0?'reverse':'normal';
      fl.style.animationPlayState=sign===0?'paused':'running';
    }
  });
