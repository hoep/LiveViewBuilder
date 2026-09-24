  // ===== Eigene Formular-Bausteine (Headless-Prinzip) ================================
  // Builder und Laeufer zeigen keine Systembausteine mehr: Auswahllisten, Zahlenfelder,
  // Farbwaehler, Kontrollkaestchen, Schieber und Zeitfelder sehen in jedem Browser gleich
  // aus und folgen dem Skin.
  //
  // Das echte Element bleibt dabei IMMER erhalten und traegt den Wert. Diese Datei legt nur
  // Aussehen und Bedienung darueber und meldet Aenderungen mit denselben Ereignissen
  // (input, change), die der Browser selbst schicken wuerde. Darum laufen alle bestehenden
  // Handler (onchange=..., addEventListener, _wChange) unveraendert weiter - es gibt 296
  // Auswahllisten und 350 Zahlenfelder im Code, keine davon musste angefasst werden.
  //
  //  · <select>: das Element selbst bleibt der Knopf (appearance:none, eigener Pfeil).
  //    Statt der Systemliste klappt eine eigene Liste auf. Pfeile, Enter, Leertaste, Esc,
  //    Pos1/Ende und Anfangsbuchstaben wie gewohnt.
  //  · Zahlenfeld: Systempfeile aus, eigene Pfeile rechts im Feld (gedrueckt halten = weiterzaehlen).
  //  · Farbwaehler: eigenes Feld mit Flaeche, Farbton, Hex-Eingabe und den Skin-Farben.
  //  · Kontrollkaestchen -> Schalter, Schieber und Zeitfeld: nur CSS (styles.css, Ende).
  //
  // Ausnahme fuer einzelne Elemente: Klasse hui-native oder ein Vorfahr mit data-hui-off.
  var _hui={cur:null,obs:null};
  var _HUI_CK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var _HUI_UP='<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5l3-3 3 3"/></svg>';
  var _HUI_DN='<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5l3 3 3-3"/></svg>';

  function _huiOff(el){return !el||el.classList.contains('hui-native')||!!(el.closest&&el.closest('[data-hui-off]'));}
  function _huiSel(el){return el&&el.tagName==='SELECT'&&!el.multiple&&!(el.size>1)&&!_huiOff(el);}
  function _huiCol(el){return el&&el.tagName==='INPUT'&&el.type==='color'&&!_huiOff(el);}
  function _huiFire(el,t){el.dispatchEvent(new Event(t,{bubbles:true}));}

  // ---------- gemeinsames Aufklappfeld ----------
  function _huiClose(){var c=_hui.cur;if(!c)return;_hui.cur=null;if(c.pop&&c.pop.parentNode)c.pop.parentNode.removeChild(c.pop);
    if(c.onClose)c.onClose();}
  function _huiPlace(pop,anchor,minW){
    var r=anchor.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight,m=8;
    if(minW)pop.style.minWidth=Math.max(140,Math.round(r.width))+'px';
    var unten=vh-r.bottom-m-4,oben=r.top-m-4;
    var h=pop.scrollHeight;
    var nachOben=(h>unten&&oben>unten);
    var platz=Math.max(120,nachOben?oben:unten);
    if(pop.classList.contains('hui-lb'))pop.style.maxHeight=Math.min(340,platz)+'px';
    h=pop.offsetHeight;
    var top=nachOben?(r.top-4-h):(r.bottom+4);
    var left=Math.min(Math.max(m,r.left),vw-pop.offsetWidth-m);
    pop.style.top=Math.max(m,Math.round(top))+'px';pop.style.left=Math.max(m,Math.round(left))+'px';
  }

  // ---------- Auswahlliste ----------
  function _huiOpenSel(sel){
    _huiClose();if(sel.disabled)return;
    var pop=document.createElement('div');pop.className='hui-pop hui-lb';pop.setAttribute('role','listbox');
    var items=[];
    function add(o){if(o.hidden)return;var d=document.createElement('div');
      d.className='hui-opt'+(o.disabled?' dis':'')+(o.selected?' on':'');d.setAttribute('role','option');
      d.innerHTML=_HUI_CK+'<span></span>';d.lastChild.textContent=o.textContent;d._opt=o;items.push(d);pop.appendChild(d);}
    Array.prototype.forEach.call(sel.children,function(ch){
      if(ch.tagName==='OPTGROUP'){var g=document.createElement('div');g.className='hui-grp';g.textContent=ch.label||'';pop.appendChild(g);
        Array.prototype.forEach.call(ch.children,function(o){if(o.tagName==='OPTION')add(o);});}
      else if(ch.tagName==='OPTION')add(ch);
    });
    if(!items.length)return;
    document.body.appendChild(pop);
    sel.classList.add('hui-open');
    var c=_hui.cur={kind:'sel',el:sel,pop:pop,items:items,act:-1,q:'',qt:0,onClose:function(){sel.classList.remove('hui-open');}};
    _huiPlace(pop,sel,true);
    var cur=-1;items.forEach(function(d,i){if(d._opt.selected)cur=i;});
    _huiAct(cur>=0?cur:_huiNext(items,-1,1),true);
    pop.addEventListener('pointerdown',function(e){e.preventDefault();});        // Fokus bleibt am <select>
    pop.addEventListener('click',function(e){var d=e.target.closest('.hui-opt');if(d&&!d.classList.contains('dis'))_huiPick(d);});
    pop.addEventListener('pointermove',function(e){var d=e.target.closest('.hui-opt');if(d&&c.items.indexOf(d)!==c.act)_huiAct(c.items.indexOf(d),false);});
  }
  function _huiNext(items,from,dir){for(var i=from+dir;i>=0&&i<items.length;i+=dir)if(!items[i].classList.contains('dis'))return i;return from;}
  function _huiAct(i,scroll){var c=_hui.cur;if(!c||c.kind!=='sel'||i<0)return;
    if(c.items[c.act])c.items[c.act].classList.remove('act');c.act=i;var d=c.items[i];if(!d)return;d.classList.add('act');
    if(scroll){var p=c.pop,t=d.offsetTop,b=t+d.offsetHeight;if(t<p.scrollTop)p.scrollTop=t-4;else if(b>p.scrollTop+p.clientHeight)p.scrollTop=b-p.clientHeight+4;}}
  function _huiPick(d){var c=_hui.cur;if(!c)return;var sel=c.el,o=d._opt,neu=!o.selected;
    o.selected=true;_huiClose();try{sel.focus({preventScroll:true});}catch(_){}
    if(neu){_huiFire(sel,'input');_huiFire(sel,'change');}}
  function _huiSelKey(e,sel){
    var c=_hui.cur,offen=c&&c.kind==='sel'&&c.el===sel,k=e.key;
    if(!offen){
      if(k==='ArrowDown'||k==='ArrowUp'||k==='Enter'||k===' '){e.preventDefault();_huiOpenSel(sel);}
      return;
    }
    if(k==='Escape'){e.preventDefault();_huiClose();return;}
    if(k==='Tab'){_huiClose();return;}
    if(k==='ArrowDown'){e.preventDefault();_huiAct(_huiNext(c.items,c.act,1),true);return;}
    if(k==='ArrowUp'){e.preventDefault();_huiAct(_huiNext(c.items,c.act,-1),true);return;}
    if(k==='Home'){e.preventDefault();_huiAct(_huiNext(c.items,-1,1),true);return;}
    if(k==='End'){e.preventDefault();_huiAct(_huiNext(c.items,c.items.length,-1),true);return;}
    if(k==='PageDown'||k==='PageUp'){e.preventDefault();var n=c.act;for(var s=0;s<8;s++)n=_huiNext(c.items,n,k==='PageDown'?1:-1);_huiAct(n,true);return;}
    if(k==='Enter'||k===' '){e.preventDefault();if(c.items[c.act])_huiPick(c.items[c.act]);return;}
    if(k.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();   // Anfangsbuchstaben
      var jetzt=Date.now();c.q=(jetzt-c.qt<700?c.q:'')+k.toLowerCase();c.qt=jetzt;
      for(var j=0;j<c.items.length;j++){var ix=(c.act+1+j)%c.items.length;if(c.q.length>1)ix=j;
        var it=c.items[ix];if(!it.classList.contains('dis')&&it.textContent.trim().toLowerCase().indexOf(c.q)===0){_huiAct(ix,true);break;}}
    }
  }

  // ---------- Zahlenfeld ----------
  function _huiNum(inp){
    if(inp.getAttribute('data-hui')||_huiOff(inp)||!inp.parentNode)return;inp.setAttribute('data-hui','1');
    var cs=window.getComputedStyle(inp),wr=document.createElement('span');wr.className='hui-num';
    // Die Breite gehoert jetzt der Huelle: aus dem style-Attribut uebernehmen, ein
    // flex:1 aus der Umgebung (.prow input) ebenfalls - sonst schrumpft das Feld.
    if(inp.style.width){wr.style.width=inp.style.width;inp.style.width='100%';}
    else if(parseFloat(cs.flexGrow)>0){wr.style.flex=cs.flexGrow+' '+cs.flexShrink+' '+cs.flexBasis;wr.style.minWidth='0';inp.style.width='100%';}
    else if(cs.display==='block'){wr.style.display='block';inp.style.width='100%';}
    if(inp.style.flex){wr.style.flex=inp.style.flex;inp.style.flex='';}
    inp.parentNode.insertBefore(wr,inp);wr.appendChild(inp);
    wr.insertAdjacentHTML('beforeend','<span class="hui-step" aria-hidden="true"><button type="button" tabindex="-1" data-hui-d="1">'+_HUI_UP+'</button><button type="button" tabindex="-1" data-hui-d="-1">'+_HUI_DN+'</button></span>');
  }
  function _huiStep(inp,d){
    if(inp.disabled||inp.readOnly)return false;
    var st=parseFloat(inp.step);if(!(st>0))st=1;
    var mn=parseFloat(inp.min),mx=parseFloat(inp.max),v=parseFloat(String(inp.value).replace(',','.'));
    if(isNaN(v))v=!isNaN(mn)?mn:0;else v+=d*st;
    if(!isNaN(mn)&&v<mn)v=mn;if(!isNaN(mx)&&v>mx)v=mx;
    var dec=(String(inp.step).split('.')[1]||'').length;
    var neu=dec?v.toFixed(dec):String(Math.round(v*1e6)/1e6);
    if(neu===inp.value)return false;inp.value=neu;_huiFire(inp,'input');return true;
  }
  var _huiRep=null;
  function _huiRepStop(){if(!_huiRep)return;clearTimeout(_huiRep.t);var inp=_huiRep.inp,chg=_huiRep.chg;_huiRep=null;if(chg&&inp.isConnected)_huiFire(inp,'change');}

  // ---------- Farbwaehler ----------
  function _huiHex2Rgb(h){h=String(h||'').trim().replace('#','');if(h.length===3)h=h.replace(/./g,'$&$&');if(!/^[0-9a-f]{6}$/i.test(h))return null;
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function _huiRgb2Hsv(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,h=0;
    if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
    return [h,mx?d/mx:0,mx];}
  function _huiHsv2Hex(h,s,v){var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;
    if(h<60){r=c;g=x;}else if(h<120){r=x;g=c;}else if(h<180){g=c;b=x;}else if(h<240){g=x;b=c;}else if(h<300){r=x;b=c;}else{r=c;b=x;}
    return '#'+[r,g,b].map(function(q){return ('0'+Math.round((q+m)*255).toString(16)).slice(-2);}).join('');}
  function _huiSkinHexes(){var out=[],seen={},cs=window.getComputedStyle(document.documentElement);
    (typeof SKIN_TOKENS!=='undefined'?SKIN_TOKENS:['accent','ok','warn','crit','info','warm','text','muted']).forEach(function(t){
      if(/^(bg|surface|surface-2|tile|line|line-soft)$/.test(t))return;
      var v=(cs.getPropertyValue('--'+t)||'').trim().toLowerCase();if(/^#[0-9a-f]{6}$/.test(v)&&!seen[v]){seen[v]=1;out.push([v,t]);}});
    return out;}
  function _huiOpenCol(inp){
    _huiClose();if(inp.disabled)return;
    var rgb=_huiHex2Rgb(inp.value)||[0,205,171],hsv=_huiRgb2Hsv(rgb[0],rgb[1],rgb[2]),h=hsv[0],s=hsv[1],v=hsv[2],start=inp.value;
    var pop=document.createElement('div');pop.className='hui-pop hui-cp';
    pop.innerHTML='<div class="hui-sv"><i class="hui-k"></i></div><div class="hui-hue"><i class="hui-k"></i></div>'
      +'<div class="hui-cprow"><span class="hui-cpnow"></span><input class="hui-native" type="text" spellcheck="false" maxlength="7"></div>'
      +'<div class="hui-sws">'+_huiSkinHexes().map(function(x){return '<button type="button" title="'+x[1]+'" data-hui-c="'+x[0]+'" style="background:'+x[0]+'"></button>';}).join('')+'</div>';
    document.body.appendChild(pop);
    var sv=pop.querySelector('.hui-sv'),svk=sv.firstChild,hue=pop.querySelector('.hui-hue'),huek=hue.firstChild,now=pop.querySelector('.hui-cpnow'),hex=pop.querySelector('input');
    function zeigen(schreibHex){var c=_huiHsv2Hex(h,s,v);sv.style.backgroundColor='hsl('+Math.round(h)+',100%,50%)';
      svk.style.left=(s*100)+'%';svk.style.top=((1-v)*100)+'%';huek.style.left=(h/360*100)+'%';now.style.background=c;if(schreibHex!==false)hex.value=c;return c;}
    function setzen(fire){var c=zeigen();if(c!==inp.value){inp.value=c;_huiFire(inp,'input');}if(fire&&inp.value!==start){start=inp.value;_huiFire(inp,'change');}}
    function ziehen(el,fn){el.addEventListener('pointerdown',function(e){e.preventDefault();try{el.setPointerCapture(e.pointerId);}catch(_){}
      var mv=function(ev){var r=el.getBoundingClientRect();fn(Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height)));setzen(false);};
      mv(e);var up=function(){el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);setzen(true);};
      el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);});}
    ziehen(sv,function(x,y){s=x;v=1-y;});
    ziehen(hue,function(x){h=Math.min(359.9,x*360);});
    hex.addEventListener('input',function(){var q=_huiHex2Rgb(hex.value);if(!q)return;var t=_huiRgb2Hsv(q[0],q[1],q[2]);h=t[0];s=t[1];v=t[2];zeigen(false);var c=_huiHsv2Hex(h,s,v);if(c!==inp.value){inp.value=c;_huiFire(inp,'input');}});
    hex.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();setzen(true);_huiClose();}});
    pop.addEventListener('click',function(e){var b=e.target.closest('[data-hui-c]');if(!b)return;var q=_huiHex2Rgb(b.getAttribute('data-hui-c'));var t=_huiRgb2Hsv(q[0],q[1],q[2]);h=t[0];s=t[1];v=t[2];setzen(true);});
    inp.classList.add('hui-open');
    _hui.cur={kind:'col',el:inp,pop:pop,onClose:function(){inp.classList.remove('hui-open');if(inp.value!==start&&inp.isConnected)_huiFire(inp,'change');}};
    zeigen();_huiPlace(pop,inp,false);
  }

  // ---------- zentrale Ereignisse ----------
  function _huiScan(root){if(!root||!root.querySelectorAll)return;
    if(root.tagName==='INPUT'&&root.type==='number')_huiNum(root);
    var l=root.querySelectorAll('input[type=number]:not([data-hui])');for(var i=0;i<l.length;i++)_huiNum(l[i]);}
  function huiInit(){
    if(_hui.obs||!document.body)return;
    document.addEventListener('pointerdown',function(e){
      var t=e.target,c=_hui.cur;
      if(c&&!c.pop.contains(t)&&t!==c.el)_huiClose();
      if(_huiSel(t)){if(e.button>0)return;e.preventDefault();try{t.focus({preventScroll:true});}catch(_){}
        if(c&&c.el===t)_huiClose();else _huiOpenSel(t);return;}
      var sb=t.closest&&t.closest('.hui-step button');
      if(sb){e.preventDefault();var inp=sb.parentNode.parentNode.querySelector('input');if(!inp)return;
        try{inp.focus({preventScroll:true});}catch(_){}
        var d=+sb.getAttribute('data-hui-d');_huiRepStop();
        _huiRep={inp:inp,chg:_huiStep(inp,d),t:0};
        var lauf=function(ms){_huiRep.t=setTimeout(function(){if(!_huiRep||!inp.isConnected){_huiRep=null;return;}if(_huiStep(inp,d))_huiRep.chg=true;lauf(70);},ms);};lauf(420);}
    },true);
    document.addEventListener('pointerup',_huiRepStop,true);
    document.addEventListener('pointercancel',_huiRepStop,true);
    // Systemliste/-dialog unterdruecken (Maus, Touch, Tastatur-Klick)
    document.addEventListener('mousedown',function(e){if(_huiSel(e.target))e.preventDefault();},true);
    document.addEventListener('touchstart',function(e){if(_huiSel(e.target))e.preventDefault();},{capture:true,passive:false});
    document.addEventListener('click',function(e){var t=e.target;
      if(_huiSel(t)){e.preventDefault();return;}
      if(_huiCol(t)){e.preventDefault();var c=_hui.cur;if(c&&c.el===t)_huiClose();else _huiOpenCol(t);}},true);
    document.addEventListener('keydown',function(e){var t=e.target;
      if(_huiSel(t)){_huiSelKey(e,t);return;}
      if(_huiCol(t)&&(e.key==='Enter'||e.key===' ')){e.preventDefault();_huiOpenCol(t);return;}
      if(e.key==='Escape'&&_hui.cur){_huiClose();}},true);
    window.addEventListener('resize',_huiClose);
    document.addEventListener('scroll',function(e){var c=_hui.cur;if(c&&!(c.pop.contains(e.target)))_huiClose();},true);
    window.addEventListener('blur',_huiClose);
    _huiScan(document.body);
    _hui.obs=new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++)if(a[j].nodeType===1)_huiScan(a[j]);}
      var c=_hui.cur;if(c&&!c.el.isConnected)_huiClose();
    });
    _hui.obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',huiInit);else huiInit();
