  // ===== Widget: Farbkreis (colorwheel) — HSV-Picker, liest/schreibt EINE RGB-Integer-Variable =====
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
  function cwArm(w,el){
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
  defWidget('colorwheel',{
    label:'Farbkreis', paletteIcon:'wdial', size:[176,224],
    defaults:function(w){w.label='Farbe';},
    render:function(w){
      var lbl=w.label?'<div style="font-size:11px;color:var(--muted);flex:none">'+esc(w.label)+'</div>':'';
      var wheel='<div data-role="cwWheel" style="position:relative;flex:none;width:118px;height:118px;border-radius:50%;background:radial-gradient(circle at center,#fff,rgba(255,255,255,0) 72%),conic-gradient(from 0deg,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%));box-shadow:inset 0 0 0 1px var(--line);cursor:crosshair;touch-action:none">'
        +'<div data-role="cwHandle" style="position:absolute;left:50%;top:50%;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);background:#000;pointer-events:none"></div></div>';
      var slider='<div style="display:flex;align-items:center;gap:8px;width:100%;flex:none">'
        +'<div data-role="cwPrev" style="flex:none;width:26px;height:26px;border-radius:7px;border:1px solid var(--line);background:#000"></div>'
        +'<div data-role="cwBar" style="position:relative;flex:1;height:16px;border-radius:8px;background:linear-gradient(90deg,#000,#fff);box-shadow:inset 0 0 0 1px var(--line);cursor:pointer;touch-action:none">'
        +'<div data-role="cwBarH" style="position:absolute;top:50%;left:0%;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);background:#000;pointer-events:none"></div></div></div>';
      return '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;box-sizing:border-box">'+lbl+wheel+slider+'</div>';
    },
    props:function(w){return '';}, // Variable + Label über den zentralen Editor
    wire:function(w){},
    live:function(w,el,id,d,base,txt,on){
      if(w.varId!==id)return;cwArm(w,el);if(el.__cwDrag)return;
      var iv=parseInt(String(d.v).replace(/[^0-9-]/g,''),10);if(isNaN(iv))iv=0;iv=iv&0xFFFFFF;
      var hsv=cwRgb2hsv((iv>>16)&255,(iv>>8)&255,iv&255),prev=el.__cwHsv;
      if(hsv[1]===0&&prev)hsv[0]=prev[0];if(hsv[2]===0&&prev)hsv[0]=prev[0];
      el.__cwHsv=hsv;cwPaint(el,hsv[0],hsv[1],hsv[2]);
    },
    click:function(w,el,e){
      cwArm(w,el);
      if(el.__cwSkip){el.__cwSkip=0;return true;}
      var wh=e.target.closest('[data-role=cwWheel]');if(wh){var p=cwWheelHsv(w,el,wh,e);cwSet(w,el,p[0],p[1],p[2],true);return true;}
      var bar=e.target.closest('[data-role=cwBar]');if(bar){var q=cwBarHsv(w,el,bar,e);cwSet(w,el,q[0],q[1],q[2],true);return true;}
      return true;
    }
  });
