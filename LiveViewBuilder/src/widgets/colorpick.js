  // ===== Widget: Farbwähler (colorpick) — zusammengelegte Familie =====
  // Varianten über w.cmode:
  //   wheel  = Farbkreis (HSV)        -> varId = RGB-Integer (24 Bit)
  //   cie    = CIE-Picker (xy)        -> varId = CIE-x (0..1), varId2 = CIE-y (0..1)
  //   slider = RGB-Slider (R/G/B)     -> varId = RGB-Integer (24 Bit)
  //   button = RGB-Preset-Taste       -> varId = RGB-Integer (24 Bit), w.color = Preset
  //   box    = Farbfläche (Anzeige)   -> varId = RGB-Integer (24 Bit)
  // Vorbild für die kontextsensitiven Optionen: widgets/chart.js (w.ctype).
  var CP_SIZE={wheel:[176,224],cie:[150,150],slider:[220,120],button:[80,80],box:[120,120]}; // Standardgröße je Variante
  function cpMode(w){return w.cmode||'wheel';}

  // ---------------------------------------------------------------- Variante „wheel" (Farbkreis, HSV)
  // Helfer: HSV <-> RGB. h in 0..360, s/v in 0..1, r/g/b in 0..255.
  function cwHsv2rgb(h,s,v){
    h=((h%360)+360)%360;s=Math.max(0,Math.min(1,s));v=Math.max(0,Math.min(1,v));
    var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;
    if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}
    else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
    return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];
  }
  function cwRgb2hsv(r,g,b){
    r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;
    if(d!==0){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
    return [h,mx===0?0:d/mx,mx];
  }
  function cwArm(w,el){ // Lazy-Binding: Listener duerfen nur EINMAL haengen (__cwB als Flag)
    var wh=$('[data-role=cwWheel]',el);if(wh&&!wh.__cwB){wh.__cwB=1;cwBindWheel(w,el,wh);}
    var bar=$('[data-role=cwBar]',el);if(bar&&!bar.__cwB){bar.__cwB=1;cwBindBar(w,el,bar);}
  }
  function cwCur(w,el){
    if(el.__cwHsv)return el.__cwHsv;
    var lv=w.varId&&_lastVals[w.varId];if(lv){var iv=parseInt(String(lv.v).replace(/[^0-9-]/g,''),10);if(!isNaN(iv)){iv=iv&0xFFFFFF;return cwRgb2hsv((iv>>16)&255,(iv>>8)&255,iv&255);}}
    return [0,0,0];
  }
  function cwPaint(el,h,s,v){
    var rgb=cwHsv2rgb(h,s,v),css='rgb('+rgb[0]+','+rgb[1]+','+rgb[2]+')';
    var hd=$('[data-role=cwHandle]',el);if(hd){hd.style.left=(50+Math.cos((h-90)*Math.PI/180)*s*50)+'%';hd.style.top=(50+Math.sin((h-90)*Math.PI/180)*s*50)+'%';hd.style.background=css;}
    var full=cwHsv2rgb(h,s,1);
    var bar=$('[data-role=cwBar]',el);if(bar)bar.style.background='linear-gradient(90deg,#000,rgb('+full[0]+','+full[1]+','+full[2]+'))';
    var bh=$('[data-role=cwBarH]',el);if(bh){bh.style.left=(v*100)+'%';bh.style.background=css;}
    var pv=$('[data-role=cwPrev]',el);if(pv)pv.style.background=css;
  }
  function cwSend(w,el,force){
    if(!w.varId)return;var c=el.__cwHsv;if(!c)return;var rgb=cwHsv2rgb(c[0],c[1],c[2]);
    var iv=rgb[0]*65536+rgb[1]*256+rgb[2],now=Date.now();
    if(!force&&el.__cwT&&now-el.__cwT<70)return;el.__cwT=now;setVar(w.varId,iv);
  }
  function cwSet(w,el,h,s,v,force){el.__cwHsv=[h,s,v];cwPaint(el,h,s,v);cwSend(w,el,force);}
  function cwWheelHsv(w,el,wh,e){
    var r=wh.getBoundingClientRect(),R=r.width/2,dx=e.clientX-(r.left+R),dy=e.clientY-(r.top+R);
    var s=Math.max(0,Math.min(1,Math.sqrt(dx*dx+dy*dy)/(R||1))),h=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360;
    return [h,s,cwCur(w,el)[2]];
  }
  function cwBarHsv(w,el,bar,e){
    var r=bar.getBoundingClientRect(),v=Math.max(0,Math.min(1,(e.clientX-r.left)/(r.width||1))),c=cwCur(w,el);
    return [c[0],c[1],v];
  }
  function cwBindWheel(w,el,wh){
    wh.addEventListener('pointerdown',function(e){
      e.preventDefault();if(wh.setPointerCapture)try{wh.setPointerCapture(e.pointerId);}catch(_){}
      el.__cwDrag='wheel';var p=cwWheelHsv(w,el,wh,e);cwSet(w,el,p[0],p[1],p[2],false);
      function mv(ev){if(el.__cwDrag==='wheel'){var q=cwWheelHsv(w,el,wh,ev);cwSet(w,el,q[0],q[1],q[2],false);}}
      function up(){el.__cwDrag=null;el.__cwSkip=1;var c=el.__cwHsv;if(c)cwSet(w,el,c[0],c[1],c[2],true);wh.removeEventListener('pointermove',mv);wh.removeEventListener('pointerup',up);wh.removeEventListener('pointercancel',up);}
      wh.addEventListener('pointermove',mv);wh.addEventListener('pointerup',up);wh.addEventListener('pointercancel',up);
    });
  }
  function cwBindBar(w,el,bar){
    bar.addEventListener('pointerdown',function(e){
      e.preventDefault();if(bar.setPointerCapture)try{bar.setPointerCapture(e.pointerId);}catch(_){}
      el.__cwDrag='bar';var p=cwBarHsv(w,el,bar,e);cwSet(w,el,p[0],p[1],p[2],false);
      function mv(ev){if(el.__cwDrag==='bar'){var q=cwBarHsv(w,el,bar,ev);cwSet(w,el,q[0],q[1],q[2],false);}}
      function up(){el.__cwDrag=null;el.__cwSkip=1;var c=el.__cwHsv;if(c)cwSet(w,el,c[0],c[1],c[2],true);bar.removeEventListener('pointermove',mv);bar.removeEventListener('pointerup',up);bar.removeEventListener('pointercancel',up);}
      bar.addEventListener('pointermove',mv);bar.addEventListener('pointerup',up);bar.addEventListener('pointercancel',up);
    });
  }
  function cpRenderWheel(w){
    var lbl=w.label?'<div style="font-size:11px;color:var(--muted);flex:none">'+esc(w.label)+'</div>':'';
    var wheel='<div data-role="cwWheel" style="position:relative;flex:none;width:118px;height:118px;border-radius:50%;background:radial-gradient(circle at center,#fff,rgba(255,255,255,0) 72%),conic-gradient(from 0deg,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%));box-shadow:inset 0 0 0 1px var(--line);cursor:crosshair;touch-action:none">'
      +'<div data-role="cwHandle" style="position:absolute;left:50%;top:50%;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);background:#000;pointer-events:none"></div></div>';
    var slider='<div style="display:flex;align-items:center;gap:8px;width:100%;flex:none">'
      +'<div data-role="cwPrev" style="flex:none;width:26px;height:26px;border-radius:7px;border:1px solid var(--line);background:#000"></div>'
      +'<div data-role="cwBar" style="position:relative;flex:1;height:16px;border-radius:8px;background:linear-gradient(90deg,#000,#fff);box-shadow:inset 0 0 0 1px var(--line);cursor:pointer;touch-action:none">'
      +'<div data-role="cwBarH" style="position:absolute;top:50%;left:0%;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);background:#000;pointer-events:none"></div></div></div>';
    return '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;box-sizing:border-box">'+lbl+wheel+slider+'</div>';
  }
  function cpLiveWheel(w,el,id,d,base,txt,on){
    if(w.varId!==id)return;cwArm(w,el);if(el.__cwDrag)return;
    var iv=parseInt(String(d.v).replace(/[^0-9-]/g,''),10);if(isNaN(iv))iv=0;iv=iv&0xFFFFFF;
    var hsv=cwRgb2hsv((iv>>16)&255,(iv>>8)&255,iv&255),prev=el.__cwHsv;
    if(hsv[1]===0&&prev)hsv[0]=prev[0];if(hsv[2]===0&&prev)hsv[0]=prev[0]; // Hue erhalten (sonst springt der Kreis bei Schwarz/Weiss auf Rot)
    el.__cwHsv=hsv;cwPaint(el,hsv[0],hsv[1],hsv[2]);
  }
  function cpClickWheel(w,el,e){
    cwArm(w,el);
    if(el.__cwSkip){el.__cwSkip=0;return true;}
    var wh=e.target.closest('[data-role=cwWheel]');if(wh){var p=cwWheelHsv(w,el,wh,e);cwSet(w,el,p[0],p[1],p[2],true);return true;}
    var bar=e.target.closest('[data-role=cwBar]');if(bar){var q=cwBarHsv(w,el,bar,e);cwSet(w,el,q[0],q[1],q[2],true);return true;}
    return true; // Farbkreis verschluckt die universelle Popup/Nav/Skript-Aktion (Bestandsverhalten)
  }

  // ---------------------------------------------------------------- Variante „cie" (xy-Farbraum)
  function _cieXY2rgb(x,y){if(y<=0)return null;var Y=1,X=x/y*Y,Z=(1-x-y)/y*Y;
    var r=3.2406*X-1.5372*Y-0.4986*Z,g=-0.9689*X+1.8758*Y+0.0415*Z,b=0.0557*X-0.2040*Y+1.0570*Z;
    if(r<-0.02||g<-0.02||b<-0.02)return null;
    function gm(c){c=c<0?0:c;return c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;}
    r=gm(r);g=gm(g);b=gm(b);var mx=Math.max(r,g,b);if(mx>1){r/=mx;g/=mx;b/=mx;}
    return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];}
  function drawCie(w){
    var root=$('.w[data-id="'+w.id+'"]',canvas)||((_popup&&$('#ovcanvas'))?$('.w[data-id="'+w.id+'"]',$('#ovcanvas')):null); // auch im Popup zeichnen
    var cv=root&&$('[data-role=ciecanvas]',root);if(!cv||!cv.getContext)return;
    var W=cv.width=110,H=cv.height=110,ctx=cv.getContext('2d'),img=ctx.createImageData(W,H),dd=img.data;
    for(var py=0;py<H;py++)for(var px=0;px<W;px++){var x=px/W*0.75,y=(1-py/H)*0.85,rgb=_cieXY2rgb(x,y),i=(py*W+px)*4;
      if(rgb){dd[i]=rgb[0];dd[i+1]=rgb[1];dd[i+2]=rgb[2];dd[i+3]=255;}else{dd[i]=17;dd[i+1]=23;dd[i+2]=25;dd[i+3]=255;}}
    ctx.putImageData(img,0,0);
    if(root)cpLiveCie(w,root);} // Marker nachziehen (direkt lokal, nicht über WIDGETS[...])
  function cpRenderCie(w){return '<div style="position:absolute;inset:0;padding:6px;box-sizing:border-box"><div style="position:relative;width:100%;height:100%"><canvas data-role="ciecanvas" style="width:100%;height:100%;border-radius:6px;display:block;cursor:crosshair"></canvas><div data-role="ciemk" style="position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 3px #000;pointer-events:none;left:50%;top:50%"></div></div></div>';}
  function cpLiveCie(w,el,id,d,base,txt,on){var lx=w.varId&&_lastVals[w.varId],ly=w.varId2&&_lastVals[w.varId2],mk=$('[data-role=ciemk]',el);if(!mk)return;var x=lx?parseFloat(String(lx.v).replace(',','.')):NaN,y=ly?parseFloat(String(ly.v).replace(',','.')):NaN;if(!isNaN(x))mk.style.left=Math.max(0,Math.min(100,x/0.75*100))+'%';if(!isNaN(y))mk.style.top=Math.max(0,Math.min(100,(1-y/0.85)*100))+'%';}
  function cpClickCie(w,el,e){var cv=$('[data-role=ciecanvas]',el);if(!cv)return false;var rb=cv.getBoundingClientRect();var fx=Math.max(0,Math.min(1,(e.clientX-rb.left)/rb.width)),fy=Math.max(0,Math.min(1,(e.clientY-rb.top)/rb.height));var x=fx*0.75,y=(1-fy)*0.85;if(w.varId)setVar(w.varId,Math.round(x*1000)/1000);if(w.varId2)setVar(w.varId2,Math.round(y*1000)/1000);var mk=$('[data-role=ciemk]',el);if(mk){mk.style.left=(fx*100)+'%';mk.style.top=(fy*100)+'%';}return true;}

  // ---------------------------------------------------------------- Variante „slider" (R/G/B)
  // Liest/schreibt w.varId als 24-Bit-Integer (R<<16 | G<<8 | B). Track-Fuellung je Kanal in Kanalfarbe.
  function _rgbEls(el){return {r:$('[data-ch=r]',el),g:$('[data-ch=g]',el),b:$('[data-ch=b]',el)};}
  function _rgbClamp(n){n=n|0;return n<0?0:(n>255?255:n);}
  function _rgbHex(r,g,b){return '#'+[r,g,b].map(function(n){return ('0'+(_rgbClamp(n)).toString(16)).slice(-2);}).join('').toUpperCase();}
  function _rgbFill(inp){if(!inp)return;var col=inp.getAttribute('data-col'),p=Math.max(0,Math.min(100,(+inp.value)/255*100));
    inp.style.background='linear-gradient(90deg,'+col+' 0%,'+col+' '+p+'%,var(--surface-2) '+p+'%,var(--surface-2) 100%)';}
  function _rgbPaint(el){ // Sliderwerte in Fuellung/Zahl/Swatch/Hex spiegeln
    var e=_rgbEls(el);if(!e.r||!e.g||!e.b)return;
    var r=_rgbClamp(+e.r.value),g=_rgbClamp(+e.g.value),b=_rgbClamp(+e.b.value);
    _rgbFill(e.r);_rgbFill(e.g);_rgbFill(e.b);
    var nr=$('[data-num=r]',el),ng=$('[data-num=g]',el),nb=$('[data-num=b]',el);
    if(nr)nr.textContent=r;if(ng)ng.textContent=g;if(nb)nb.textContent=b;
    var sw=$('[data-role=sw]',el);if(sw)sw.style.background='rgb('+r+','+g+','+b+')';
    var hx=$('[data-role=hex]',el);if(hx)hx.textContent=_rgbHex(r,g,b);
  }
  // ACHTUNG: _rgbInput wird aus dem Inline-Attribut oninput="_rgbInput(this)" des gerenderten HTML gerufen.
  // Die Funktion muss global bleiben (kein Modulscope) und darf nur zusammen mit dem Attribut umbenannt werden.
  function _rgbInput(inp){ // Inline oninput je Slider — baut Integer neu und schreibt
    var el=inp.closest('.w');if(!el)return;el._rgbBusy=Date.now();_rgbPaint(el);
    if(typeof mode!=='undefined'&&mode==='edit')return; // im Editor nicht schreiben
    var w=widget(el.dataset.id);if(!w||!w.varId)return;
    var e=_rgbEls(el),v=((_rgbClamp(+e.r.value)<<16)|(_rgbClamp(+e.g.value)<<8)|_rgbClamp(+e.b.value))>>>0;
    setVar(w.varId,v); // throttle nicht noetig
  }
  function cpRenderSlider(w){
    var chs=[['r','R','#f2685a'],['g','G','#39d08a'],['b','B','#5ab6ff']];
    var rows=chs.map(function(c){
      // data-role MUSS 'ch' bleiben — [data-role=range] wuerde in _wChange zusaetzlich den Rohwert 0..255 schreiben
      return '<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="width:12px;text-align:center;font-size:12px;font-weight:700;color:'+c[2]+';flex:none">'+c[1]+'</span>'
        +'<input class="hsrange" type="range" data-role="ch" data-ch="'+c[0]+'" data-col="'+c[2]+'" min="0" max="255" step="1" value="0" oninput="_rgbInput(this)" style="flex:1;min-width:0;background:linear-gradient(90deg,'+c[2]+' 0%,'+c[2]+' 0%,var(--surface-2) 0%,var(--surface-2) 100%)">'
        +'<span data-num="'+c[0]+'" style="width:30px;text-align:right;font-family:var(--fm);font-size:12px;color:var(--muted);flex:none">0</span>'
      +'</div>';
    }).join('');
    return '<div style="height:100%;display:flex;flex-direction:column;justify-content:center;gap:7px;padding:10px 12px;box-sizing:border-box">'
      +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span data-role="sw" style="width:22px;height:22px;border-radius:6px;border:1px solid var(--line);background:#000;flex:none"></span>'
        +(w.label?'<span style="font-size:12px;color:var(--muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(w.label)+'</span>':'<span style="flex:1"></span>')
        +'<span data-role="hex" style="font-family:var(--fm);font-size:11px;color:var(--muted);flex:none">#000000</span>'
      +'</div>'+rows+'</div>';
  }
  function cpLiveSlider(w,el,id,d,base,txt,on){
    if(w.varId!==id)return;
    var n=parseInt(String(d.v).replace(',','.'),10);if(isNaN(n))n=0;
    var r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    var busy=el._rgbBusy&&(Date.now()-el._rgbBusy<900);
    var a=document.activeElement,inside=!!(a&&a.getAttribute&&a.getAttribute('data-role')==='ch'&&el.contains(a));
    if(busy||inside)return; // waehrend Bedienung Slider/Swatch nicht ueberschreiben
    var e=_rgbEls(el);if(e.r)e.r.value=r;if(e.g)e.g.value=g;if(e.b)e.b.value=b;
    _rgbPaint(el);
  }

  // ---------------------------------------------------------------- Variante „button" (Preset-Taste)
  function cpBtnInt(col){var mine=parseInt(String(col||'#000000').replace('#',''),16);if(isNaN(mine))mine=0;return mine;}
  function cpRenderButton(w){
    var col=w.color||'#ff8800';
    var mine=parseInt(String(col).replace('#',''),16);if(isNaN(mine))mine=0;
    var cur=w.varId&&_lastVals[w.varId];
    var active=!!(cur&&parseInt(String(cur.v).replace(',','.'),10)===mine);
    var chk='<svg data-role="chk" class="i" style="display:'+(active?'block':'none')+';position:absolute;top:5px;right:5px;width:16px;height:16px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 2px rgba(0,0,0,.65))"><use href="#ic-check"/></svg>';
    var lbl=w.label?'<div style="position:absolute;left:4px;right:4px;bottom:5px;text-align:center;font-size:11px;line-height:1.1;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(w.label)+'</div>':'';
    return '<div data-role="swatch" style="position:absolute;inset:6px;border-radius:12px;background:'+esc(col)+';border:1px solid var(--line);box-shadow:'+(active?'0 0 0 3px var(--accent)':'none')+';cursor:pointer">'+chk+lbl+'</div>';
  }
  function cpLiveButton(w,el,id,d,base,txt,on){
    if(w.varId!==id)return;var sw=$('[data-role=swatch]',el);if(!sw)return;
    var mine=cpBtnInt(w.color);
    var active=(parseInt(String(d.v).replace(',','.'),10)===mine);
    sw.style.boxShadow=active?'0 0 0 3px var(--accent)':'none';
    var ck=$('[data-role=chk]',sw);if(ck)ck.style.display=active?'block':'none';
  }
  function cpClickButton(w,el,e){
    if(!w.varId)return false; // ohne Variable greift die universelle Popup/Nav-Aktion
    setVar(w.varId,cpBtnInt(w.color));return true;
  }

  // ---------------------------------------------------------------- Variante „box" (reine Anzeige)
  function cpRenderBox(w){return '<div style="position:absolute;inset:0;padding:8px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px"><div data-role="sw" style="flex:1;border-radius:9px;border:1px solid var(--line);background:#333;min-height:20px;cursor:pointer"></div>'+(w.label?'<div style="font-size:11px;color:var(--muted);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(w.label)+'</div>':'')+'</div>';}
  function cpLiveBox(w,el,id,d,base,txt,on){var sw=$('[data-role=sw]',el);if(sw){var n=parseInt(d.v)||0;sw.style.background='#'+('000000'+(n&0xFFFFFF).toString(16)).slice(-6);}}

  // ---------------------------------------------------------------- Registry
  defWidget('colorpick',{
    label:'Farbwähler', paletteIcon:'wdial', size:CP_SIZE.wheel,
    defaults:function(w){w.cmode='wheel';w.label='Farbe';w.color='#ff8800';}, // Standard = Farbkreis; w.color ist die Preset-Farbe der Tasten-Variante
    mount:function(w){if(cpMode(w)==='cie')drawCie(w);},
    render:function(w){
      switch(cpMode(w)){
        case 'cie':    return cpRenderCie(w);
        case 'slider': return cpRenderSlider(w);
        case 'button': return cpRenderButton(w);
        case 'box':    return cpRenderBox(w);
        default:       return cpRenderWheel(w);
      }
    },
    props:function(w){
      if(w.type!=='colorpick')return '';
      var cm=cpMode(w);
      var M=[['wheel','Farbkreis (HSV)'],['cie','CIE-Picker (xy)'],['slider','RGB-Slider (R/G/B)'],['button','RGB-Preset-Taste'],['box','Farbfläche (Anzeige)']];
      var h=row('Darstellung','<select id="pCMode">'+M.map(function(o){return '<option value="'+o[0]+'"'+(cm===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>');
      h+='<div class="pgh">Farbwähler-Optionen</div>';
      if(cm==='button'){
        var col=w.color||'#ff8800';var mine=parseInt(String(col).replace('#',''),16);if(isNaN(mine))mine=0;
        h+=row('Farbe','<input id="pRgbCol" type="color" value="'+esc(col)+'">')
          +'<div class="pgh">RGB-Wert: '+mine+'</div>'; // Label + Variable über den zentralen Editor
      }else if(cm==='cie'){
        // eigene Variablenzeilen: x -> varId, y -> varId2 (die zentrale „Variable"-Zeile ist hierfür ausgeblendet)
        h+=row('x (Var)','<input id="pCieX" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pCieXP" style="padding:6px 8px">wählen</button>')
          +row('y (Var)','<input id="pCieY" value="'+(w.varId2||'')+'" placeholder="ID"> <button class="btn" id="pCieYP" style="padding:6px 8px">wählen</button>');
      }
      // wheel/slider/box: nichts Eigenes — Variable und Label kommen aus dem zentralen Editor
      return h;
    },
    wire:function(w){
      if($('#pCMode'))$('#pCMode').onchange=function(){
        var alt=cpMode(w),neu=this.value;
        if(alt!==neu){
          var sa=CP_SIZE[alt]||CP_SIZE.wheel,sn=CP_SIZE[neu]||CP_SIZE.wheel;
          if(w.w===sa[0]&&w.h===sa[1]){w.w=sn[0];w.h=sn[1];} // Variantengroesse nur uebernehmen, solange die alte unveraendert war
          if(alt==='cie'||neu==='cie'){ // Variablen bedeuten hier voellig Verschiedenes -> Bindung loesen statt falsch schreiben
            if(w.varId||w.varId2){w.varId=0;w.varId2=0;if(typeof toast==='function')toast('Variablenbindung zurückgesetzt — CIE nutzt x/y (0..1), die anderen einen RGB-Integer');}
          }else if(w.varId2){w.varId2=0;} // varId2 gehoert ausschliesslich zur CIE-Variante
          if(neu==='button'&&!w.color)w.color='#ff8800'; // Preset-Farbe nachziehen, sonst schreibt der Klick 0 statt der angezeigten Farbe
          // Die Tasten-Variante zeigt das Label MITTEN in der Farbfläche (Original rgbbutton hatte
          // deshalb bewusst kein Label). Nur den unveränderten Standardtext anfassen, nie eigenen Text.
          if(neu==='button'&&(w.label==='Farbe'||w.label==='Label'))w.label='';
          else if(alt==='button'&&!w.label)w.label='Farbe';
        }
        w.cmode=neu;render();renderProps();commit(); // renderProps ist zwingend, sonst bleiben die alten Optionen stehen
      };
      if($('#pRgbCol'))$('#pRgbCol').oninput=function(){w.color=this.value;render();renderProps();};
      if($('#pCieX'))$('#pCieX').oninput=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pCieXP'))$('#pCieXP').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pCieY'))$('#pCieY').oninput=function(){w.varId2=parseInt(this.value)||0;render();};
      if($('#pCieYP'))$('#pCieYP').onclick=function(){showTab('vars');_bindTarget2=w.id;};
    },
    live:function(w,el,id,d,base,txt,on){
      switch(cpMode(w)){ // Guards bleiben je Variante getrennt (varId!==id, _rgbBusy, __cwDrag)
        case 'cie':    cpLiveCie(w,el,id,d,base,txt,on);break;
        case 'slider': cpLiveSlider(w,el,id,d,base,txt,on);break;
        case 'button': cpLiveButton(w,el,id,d,base,txt,on);break;
        case 'box':    cpLiveBox(w,el,id,d,base,txt,on);break;
        default:       cpLiveWheel(w,el,id,d,base,txt,on);
      }
    },
    click:function(w,el,e){
      switch(cpMode(w)){
        case 'cie':    return cpClickCie(w,el,e);
        case 'button': return cpClickButton(w,el,e);
        case 'slider': return false; // Slider/Box haben keinen eigenen Klick -> Popup/Nav/Skript greift
        case 'box':    return false;
        default:       return cpClickWheel(w,el,e);
      }
    }
  });
