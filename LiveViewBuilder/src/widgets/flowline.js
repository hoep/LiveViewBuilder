  // ===== Widget: Energiefluss-Linie (flowline) — animierte Fluss-Linie, Farbe/Breite/Richtung nach Wert =====
  function flowlineState(w){
    var thr=(w.flThr!=null?w.flThr:0), ref=(w.flRef!=null&&w.flRef>0?w.flRef:1000);
    var lv=w.varId&&_lastVals[w.varId];
    var n=lv?parseFloat(String(lv.v).replace(',','.')):NaN;
    var pos=w.flPos||'#00cdab', neg=w.flNeg||'#ff5d5d', gray=cssv('--muted')||'#8a97a0';
    var color=gray, sign=0;
    if(!isNaN(n)){if(n>thr){color=pos;sign=1;}else if(n<-thr){color=neg;sign=-1;}}
    var mag=isNaN(n)?0:Math.min(1,Math.abs(n)/ref);
    return {color:color,sign:sign,width:2+mag*10};
  }
  defWidget('flowline',{
    label:'Energiefluss', paletteIcon:'wline', size:[200,40],
    defaults:function(w){w.flDir='h';w.flPos='#00cdab';w.flNeg='#ff5d5d';w.flThr=0;w.flRef=1000;},
    render:function(w){
      var st=flowlineState(w), horiz=(w.flDir!=='v');
      var dir=(st.sign<0?'reverse':'normal'), play=(st.sign===0?'paused':'running'), th=st.width.toFixed(1);
      var grad='repeating-linear-gradient('+(horiz?'90deg':'180deg')+','+st.color+' 0 8px,transparent 8px 22px)';
      var bsize=horiz?'22px 100%':'100% 22px', anim=horiz?'flLnX':'flLnY';
      var track=horiz
        ?'<div style="position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:2px;background:var(--line);border-radius:2px;opacity:.7"></div>'
        :'<div style="position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:2px;background:var(--line);border-radius:2px;opacity:.7"></div>';
      var flowStyle=horiz
        ?'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:'+th+'px'
        :'position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:'+th+'px';
      var flow='<div data-role="flow" style="'+flowStyle+';border-radius:6px;background:'+grad+';background-size:'+bsize+';animation:'+anim+' 1.1s linear infinite;animation-direction:'+dir+';animation-play-state:'+play+'"></div>';
      return '<style>@keyframes flLnX{from{background-position:0 0}to{background-position:22px 0}}@keyframes flLnY{from{background-position:0 0}to{background-position:0 22px}}</style><div style="position:absolute;inset:0;overflow:hidden">'+track+flow+'</div>';
    },
    props:function(w){return row('Variable','<input id="pFlVar" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pFlPick" style="padding:6px 8px">wählen</button>')
      +row('Richtung','<select id="pFlDir"><option value="h"'+(w.flDir!=='v'?' selected':'')+'>Horizontal</option><option value="v"'+(w.flDir==='v'?' selected':'')+'>Vertikal</option></select>')
      +'<div class="pgh">Farben</div>'
      +row('Positiv','<input type="color" id="pFlPos" value="'+(w.flPos||'#00cdab')+'">')
      +row('Negativ','<input type="color" id="pFlNeg" value="'+(w.flNeg||'#ff5d5d')+'">')
      +row('Schwelle','<input id="pFlThr" type="number" step="0.1" value="'+(w.flThr!=null?w.flThr:0)+'">')
      +row('Referenz','<input id="pFlRef" type="number" step="1" value="'+(w.flRef!=null?w.flRef:1000)+'" placeholder="Wert für max. Breite">');},
    wire:function(w){
      if($('#pFlVar'))$('#pFlVar').onchange=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pFlPick'))$('#pFlPick').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pFlDir'))$('#pFlDir').onchange=function(){w.flDir=this.value;render();};
      if($('#pFlPos'))$('#pFlPos').oninput=function(){w.flPos=this.value;render();};
      if($('#pFlNeg'))$('#pFlNeg').oninput=function(){w.flNeg=this.value;render();};
      if($('#pFlThr'))$('#pFlThr').oninput=function(){w.flThr=this.value===''?0:parseFloat(this.value);render();};
      if($('#pFlRef'))$('#pFlRef').oninput=function(){var v=parseFloat(this.value);w.flRef=(isNaN(v)||v<=0)?1000:v;render();};
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId!==id)return;
      var fl=$('[data-role=flow]',el);if(!fl)return;
      var horiz=(w.flDir!=='v');
      var thr=(w.flThr!=null?w.flThr:0), ref=(w.flRef!=null&&w.flRef>0?w.flRef:1000);
      var n=parseFloat(String(d.v).replace(',','.'));
      var pos=w.flPos||'#00cdab', neg=w.flNeg||'#ff5d5d', gray=cssv('--muted')||'#8a97a0';
      var color=gray, sign=0;
      if(!isNaN(n)){if(n>thr){color=pos;sign=1;}else if(n<-thr){color=neg;sign=-1;}}
      var mag=isNaN(n)?0:Math.min(1,Math.abs(n)/ref), th=(2+mag*10).toFixed(1);
      fl.style.background='repeating-linear-gradient('+(horiz?'90deg':'180deg')+','+color+' 0 8px,transparent 8px 22px)';
      fl.style.backgroundSize=horiz?'22px 100%':'100% 22px';
      if(horiz)fl.style.height=th+'px';else fl.style.width=th+'px';
      fl.style.animationDirection=sign<0?'reverse':'normal';
      fl.style.animationPlayState=sign===0?'paused':'running';
    }
  });
