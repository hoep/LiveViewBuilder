  // ===== Widget: CIE-Picker (cie) — xy-Farbraum, schreibt x -> varId, y -> varId2 (0..1) =====
  function _cieXY2rgb(x,y){if(y<=0)return null;var Y=1,X=x/y*Y,Z=(1-x-y)/y*Y;
    var r=3.2406*X-1.5372*Y-0.4986*Z,g=-0.9689*X+1.8758*Y+0.0415*Z,b=0.0557*X-0.2040*Y+1.0570*Z;
    if(r<-0.02||g<-0.02||b<-0.02)return null;
    function gm(c){c=c<0?0:c;return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;}
    r=gm(r);g=gm(g);b=gm(b);var mx=Math.max(r,g,b);if(mx>1){r/=mx;g/=mx;b/=mx;}
    return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];}
  function drawCie(w){var cv=$('.w[data-id="'+w.id+'"] [data-role=ciecanvas]',canvas);if(!cv||!cv.getContext)return;
    var W=cv.width=110,H=cv.height=110,ctx=cv.getContext('2d'),img=ctx.createImageData(W,H),dd=img.data;
    for(var py=0;py<H;py++)for(var px=0;px<W;px++){var x=px/W*0.75,y=(1-py/H)*0.85,rgb=_cieXY2rgb(x,y),i=(py*W+px)*4;
      if(rgb){dd[i]=rgb[0];dd[i+1]=rgb[1];dd[i+2]=rgb[2];dd[i+3]=255;}else{dd[i]=17;dd[i+1]=23;dd[i+2]=25;dd[i+3]=255;}}
    ctx.putImageData(img,0,0);
    var el=$('.w[data-id="'+w.id+'"]',canvas);if(el)WIDGETS.cie.live(w,el);}
  defWidget('cie',{
    label:'CIE-Picker', paletteIcon:'wshape', size:[150,150],
    mount:function(w){drawCie(w);},
    render:function(w){return '<div style="position:absolute;inset:0;padding:6px;box-sizing:border-box"><div style="position:relative;width:100%;height:100%"><canvas data-role="ciecanvas" style="width:100%;height:100%;border-radius:6px;display:block;cursor:crosshair"></canvas><div data-role="ciemk" style="position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 3px #000;pointer-events:none;left:50%;top:50%"></div></div></div>';},
    props:function(w){return row('x (Var)','<input id="pCieX" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pCieXP" style="padding:6px 8px">wählen</button>')
      +row('y (Var)','<input id="pCieY" value="'+(w.varId2||'')+'" placeholder="ID"> <button class="btn" id="pCieYP" style="padding:6px 8px">wählen</button>');},
    wire:function(w){
      if($('#pCieX'))$('#pCieX').oninput=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pCieXP'))$('#pCieXP').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pCieY'))$('#pCieY').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pCieYP'))$('#pCieYP').onclick=function(){showTab('vars');_bindTarget2=w.id;};
    },
    live:function(w,el,id,d,base,txt,on){var lx=w.varId&&_lastVals[w.varId],ly=w.varId2&&_lastVals[w.varId2],mk=$('[data-role=ciemk]',el);if(!mk)return;var x=lx?parseFloat(String(lx.v).replace(',','.')):NaN,y=ly?parseFloat(String(ly.v).replace(',','.')):NaN;if(!isNaN(x))mk.style.left=Math.max(0,Math.min(100,x/0.75*100))+'%';if(!isNaN(y))mk.style.top=Math.max(0,Math.min(100,(1-y/0.85)*100))+'%';},
    click:function(w,el,e){var cv=$('[data-role=ciecanvas]',el);if(!cv)return false;var rb=cv.getBoundingClientRect();var fx=Math.max(0,Math.min(1,(e.clientX-rb.left)/rb.width)),fy=Math.max(0,Math.min(1,(e.clientY-rb.top)/rb.height));var x=fx*0.75,y=(1-fy)*0.85;if(w.varId)setVar(w.varId,Math.round(x*1000)/1000);if(w.varId2)setVar(w.varId2,Math.round(y*1000)/1000);var mk=$('[data-role=ciemk]',el);if(mk){mk.style.left=(fx*100)+'%';mk.style.top=(fy*100)+'%';}return true;}
  });
