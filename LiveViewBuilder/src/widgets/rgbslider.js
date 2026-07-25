  // ===== Widget: RGB-Slider — drei Kanaele R/G/B (0-255) auf EINE RGB-Integer-Variable =====
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
  function _rgbInput(inp){ // Inline oninput je Slider — baut Integer neu und schreibt
    var el=inp.closest('.w');if(!el)return;el._rgbBusy=Date.now();_rgbPaint(el);
    if(typeof mode!=='undefined'&&mode==='edit')return; // im Editor nicht schreiben
    var w=widget(el.dataset.id);if(!w||!w.varId)return;
    var e=_rgbEls(el),v=((_rgbClamp(+e.r.value)<<16)|(_rgbClamp(+e.g.value)<<8)|_rgbClamp(+e.b.value))>>>0;
    setVar(w.varId,v); // throttle nicht noetig
  }
  defWidget('rgbslider',{
    label:'RGB-Slider', paletteIcon:'wslider', size:[220,120],
    defaults:function(w){w.label='Farbe';},
    render:function(w){
      var chs=[['r','R','#f2685a'],['g','G','#39d08a'],['b','B','#5ab6ff']];
      var rows=chs.map(function(c){
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
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId!==id)return;
      var n=parseInt(String(d.v).replace(',','.'),10);if(isNaN(n))n=0;
      var r=(n>>16)&255,g=(n>>8)&255,b=n&255;
      var busy=el._rgbBusy&&(Date.now()-el._rgbBusy<900);
      var a=document.activeElement,inside=!!(a&&a.getAttribute&&a.getAttribute('data-role')==='ch'&&el.contains(a));
      if(busy||inside)return; // waehrend Bedienung Slider/Swatch nicht ueberschreiben
      var e=_rgbEls(el);if(e.r)e.r.value=r;if(e.g)e.g.value=g;if(e.b)e.b.value=b;
      _rgbPaint(el);
    }
  });
