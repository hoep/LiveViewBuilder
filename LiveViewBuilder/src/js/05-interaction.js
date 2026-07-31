  function _hasTextSel(){var ae=document.activeElement;if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')&&ae.selectionStart!=null&&ae.selectionStart!==ae.selectionEnd)return true;var s=window.getSelection&&window.getSelection();return !!(s&&String(s).length);} // aktive Textauswahl?
  function _inTextField(){var ae=document.activeElement,tn=((ae&&ae.tagName)||'').toLowerCase();return tn==='input'||tn==='textarea';}
  function _clone(id){return JSON.parse(JSON.stringify(widget(id)));}
  document.addEventListener('keydown',function(e){
    var ctrl=e.ctrlKey||e.metaKey,ek=(e.key||''),k=ek.toLowerCase(),ids=Object.keys(sel); // ek: e.key kann fehlen (Dead Keys, IME, synthetische Events) -> nie direkt ansprechen
    // Widget-Copy/Cut/Paste ZUERST (funktioniert auch bei Fokus auf Select/Body/nach Seitenwechsel); Textfeld/Textauswahl bleibt normales Text-Copy
    if(ctrl&&k==='c'&&!_hasTextSel()){if(ids.length){clip=ids.map(_clone);toast(clip.length+' kopiert');e.preventDefault();}return;}
    if(ctrl&&k==='x'&&!_hasTextSel()){if(ids.length){clip=ids.map(_clone);state.widgets=state.widgets.filter(function(w){return !sel[w.id];});if(typeof chromeList==='function')chromeList().forEach(function(_b){if(_b.widgets)_b.widgets=_b.widgets.filter(function(w){return !sel[w.id];});});selClear();render();renderProps();commit();e.preventDefault();}return;}
    if(ctrl&&k==='v'&&!_inTextField()){if(clip&&clip.length){addCopies(clip);e.preventDefault();}return;}
    if((ek==='Delete'||ek==='Backspace')&&!_inTextField()){if(ids.length){state.widgets=state.widgets.filter(function(w){return !sel[w.id];});if(typeof chromeList==='function')chromeList().forEach(function(_b){if(_b.widgets)_b.widgets=_b.widgets.filter(function(w){return !sel[w.id];});});selClear();render();renderProps();commit();e.preventDefault();}return;} // löschen auch bei Fokus auf Select/Body (nach Seitenwechsel)
    if(ek.indexOf('Arrow')===0&&ids.length&&!_inTextField()){var dd0=e.shiftKey?GS:1,dx0=ek==='ArrowLeft'?-dd0:ek==='ArrowRight'?dd0:0,dy0=ek==='ArrowUp'?-dd0:ek==='ArrowDown'?dd0:0;ids.forEach(function(id){var w=widget(id);w.x=Math.max(0,w.x+dx0);w.y=Math.max(0,w.y+dy0);applyGeom(w);});e.preventDefault();commit();return;} // verschieben auch bei Select/Body-Fokus
    var tn=((e.target&&e.target.tagName)||'').toLowerCase();if(tn==='input'||tn==='select'||tn==='textarea')return;
    if(ctrl&&k==='g'){e.preventDefault();if(e.shiftKey)ungroupSel();else groupSel();return;}
    if(ctrl&&k==='d'){e.preventDefault();addCopies(ids.map(widget));}
    else if(ctrl&&k==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
    else if(ctrl&&k==='y'){e.preventDefault();redo();}
    else if(ctrl&&(ek==='+'||ek==='=')){e.preventDefault();setZoom(zoom*1.15);}
    else if(ctrl&&(ek==='-'||ek==='_')){e.preventDefault();setZoom(zoom/1.15);}
    else if(ctrl&&ek==='0'){e.preventDefault();setZoom(1);}
    else if(ctrl&&ek==='9'){e.preventDefault();setZoom(fitZoom());}
  });

  // Vorschau/Runtime: interaktive Widgets schreiben
  var _lpTimer=null,_lpFired=false;
  function _wClick(e){
    if(mode==='edit')return;if(_lpFired){_lpFired=false;return;} // O1: nach Long-Press Klick unterdrücken
    var el=e.target.closest('.w');if(!el)return;var w=widget(el.dataset.id);if(!w)return;
    var _wc=WIDGETS[w.type];if(_wc&&_wc.click&&_wc.click(w,el,e)===true)return; // Registry-Widget-Klick
    if(w.closePopup){closePopup();return;} // A1: Popup schließen
    if(w.popupTo){openPopup(w.popupTo,_aliasMap(w));return;} // A1/M1: Popup öffnen (mit Alias-Remapping)
    if(w.scriptId){fetch('?api=runscript&id='+w.scriptId+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'});toast('Skript gestartet');return;} // O3
    if(w.openMenu){var _rl=document.getElementById('runlist');if(_rl)_rl.classList.toggle('open');return;} // B4
    if(w.regSlot&&w.regView){setRegion(w.regSlot,w.regView);return;} // B2: Region-Inhalt tauschen
    if(w.navBack){navBack();return;} // Seite zurück (jedes Widget)
    if(w.navTo&&store.views[w.navTo]){navGo(w.navTo);return;} // A1: Seite öffnen (jetzt jedes Widget)
    if(w.type==='switch'&&w.varId){var sw=$('.sw',el),on=!sw.classList.contains('on');sw.classList.toggle('on',on);setVar(w.varId,on?1:0);return;}
    if(w.type==='tile'||w.type==='button'){if(w.navBack){navBack();return;}if(w.navTo&&store.views[w.navTo]){navGo(w.navTo);return;}if(w.varId){var d=_lastVals[w.varId];var cur=d?(d.v===true||d.v===1||d.v==='1'):false;setVar(w.varId,cur?0:1);}return;}
    if(w.type==='thermostat'){var mb=e.target.closest('.htmbtn');if(mb&&w.varId3){setVar(w.varId3,mb.getAttribute('data-mv'));return;}
      if(w.varId2){var up=e.target.closest('[data-role=up]'),dn=e.target.closest('[data-role=dn]');if(up||dn){var tv=_lastVals[w.varId2];var t=tv?parseFloat(tv.v):20;if(isNaN(t))t=20;var st=w.step||0.5;setVar(w.varId2,(t+(up?st:-st)).toFixed(1));}}return;}
    if(w.type==='cover'){var cu=e.target.closest('[data-role=cup]'),cs=e.target.closest('[data-role=cstop]'),cd=e.target.closest('[data-role=cdn]');if(cu&&w.varId)setVar(w.varId,100);else if(cd&&w.varId)setVar(w.varId,0);else if(cs&&w.varId2)setVar(w.varId2,1);return;}
    if(w.type==='media'&&w.varId2){if(e.target.closest('[data-role=mplay]')){var md=_lastVals[w.varId2];var mc=md?(md.v===true||md.v===1||md.v==='1'):false;setVar(w.varId2,mc?0:1);}return;}
    if(w.type==='alarm'&&w.varId){if(e.target.closest('[data-role=aon]'))setVar(w.varId,1);else if(e.target.closest('[data-role=aoff]'))setVar(w.varId,0);return;}
    if(w.type==='vacuum'&&w.varId3){if(e.target.closest('[data-role=vstart]'))setVar(w.varId3,1);else if(e.target.closest('[data-role=vstop]'))setVar(w.varId3,0);return;}
    if(w.type==='select'&&w.varId){var sb=e.target.closest('.hselb');if(sb){setVar(w.varId,sb.getAttribute('data-selval'));$$('.hselb',el).forEach(function(b){b.classList.toggle('on',b===sb);});}return;}
    if(w.type==='dial'&&w.varId){var dsv=el.querySelector('svg');if(dsv){var rb=dsv.getBoundingClientRect(),ccx=rb.left+rb.width/2,ccy=rb.top+rb.height/2,ang=Math.atan2(e.clientY-ccy,e.clientX-ccx)*180/Math.PI;if(ang<0)ang+=360;var rel=ang-135;if(rel<0)rel+=360;if(rel<=270){var dmn=(w.min!=null?w.min:0),dmx=(w.max!=null?w.max:100),st=w.step||1,dval=dmn+(rel/270)*(dmx-dmn);dval=Math.round(dval/st)*st;setVar(w.varId,dval);}}return;}
    if(w.type==='skinswitch'){var kb=e.target.closest('[data-skw]');if(kb){store.theme=kb.getAttribute('data-skw');applySkin();try{localStorage.setItem('lvtheme',store.theme);}catch(_){}}return;}
    if(w.type==='campro'&&w.mediaId){window.open('?api=media&id='+w.mediaId,'_blank');return;}
  }
  canvas.addEventListener('click',_wClick);
  (function(){var _ovc=document.getElementById('ovcanvas');if(_ovc)_ovc.addEventListener('click',_wClick);
    var _ob=document.getElementById('ovbackdrop');if(_ob)_ob.addEventListener('click',function(){closePopup();});
    var _ox=document.getElementById('ovclose');if(_ox)_ox.addEventListener('click',function(){closePopup();});
    document.addEventListener('keydown',function(e){if((e.key||'')==='Escape'&&_popup)closePopup();});
  })();
  // O1: Long-Press an button/tile -> Popup
  document.addEventListener('pointerdown',function(e){
    if(mode==='edit')return;var el=e.target.closest('.w');if(!el)return;var w=widget(el.dataset.id);
    if(!w||(!w.longPopup&&!w.longNav))return; // Lang-Druck (Popup ODER Seite) für JEDES Widget
    _lpFired=false;if(_lpTimer)clearTimeout(_lpTimer);
    _lpTimer=setTimeout(function(){_lpFired=true;if(w.longNav&&store.views[w.longNav])navGo(w.longNav);else if(w.longPopup)openPopup(w.longPopup,_aliasMap(w));},550);
  },true);
  document.addEventListener('pointerup',function(){if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}});
  document.addEventListener('pointercancel',function(){if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}_lpFired=false;});
  function _wChange(e){
    if(mode==='edit')return;
    var ss=e.target.closest('[data-role=skwsel]');if(ss){store.skin=ss.value;applySkin();try{localStorage.setItem('lvskin',store.skin);}catch(_){}return;}
    var _iw=e.target.closest('.w');if(_iw){var _iww=widget(_iw.dataset.id);if(_iww){var _iwr=WIDGETS[_iww.type];if(_iwr&&_iwr.input&&_iwr.input(_iww,_iw,e)===true)return;}}
    var r=e.target.closest('[data-role=range]');if(!r)return;var el=r.closest('.w');if(!el)return;var w=widget(el.dataset.id);if(!w)return;
    if(w.type==='light'){if(w.varId2)setVar(w.varId2,r.value);}
    else if(w.type==='media'){if(w.varId3)setVar(w.varId3,r.value);}
    else if(w.varId){setVar(w.varId,r.value);}
  }
  canvas.addEventListener('change',_wChange);
  (function(){var _o=document.getElementById('ovcanvas');if(_o)_o.addEventListener('change',_wChange);})();

  // ---------- Live-Werte ----------
  function _fnum(d){return parseFloat(String(d.v).replace(',','.'));}
  function _funit(d){var m=String(d.f==null?'':d.f).match(/^[\s-]*[-\d.,]+\s*(.*)$/);return m&&m[1]?m[1]:'';}
  function _ftime(d){var s=String(d.f==null?'':d.f);var m=s.match(/(\d{1,2}:\d{2})/);if(m)return m[1];var n=_fnum(d);if(!isNaN(n)&&n>100000){var dt=new Date(n*1000);return ('0'+dt.getHours()).slice(-2)+':'+('0'+dt.getMinutes()).slice(-2);}return s;}
  function _fdate(d){var s=String(d.f==null?'':d.f);var m=s.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})/);return m?m[1]:s;}
  function _frel(d){var n=_fnum(d);if(isNaN(n)||n<100000)return String(d.f==null?'':d.f);var diff=Date.now()/1000-n,a=Math.abs(diff),s;if(a<45)return 'gerade eben';else if(a<3600)s=Math.round(a/60)+' min';else if(a<86400)s=Math.round(a/3600)+' h';else if(a<2592000)s=Math.round(a/86400)+' Tg';else s=Math.round(a/2592000)+' Mon';return (diff>=0?'vor ':'in ')+s;}
  function fmtVal(w,d,base){
    var f=w.fmt;if(!f||f==='auto')return base;
    if(f==='time')return _ftime(d);
    if(f==='date')return _fdate(d);
    if(f==='rel') return _frel(d);
    var n=_fnum(d);if(isNaN(n))return base;
    if(f==='kw') return (n/1000).toFixed(2).replace('.',',')+' kW';
    if(f==='kwh')return (n/1000).toFixed(2).replace('.',',')+' kWh';
    if(f==='w')  return Math.round(n)+' W';
    if(f==='pct')return Math.round(n)+' %';
    if(f==='r0') return Math.round(n)+(_funit(d)?' '+_funit(d):'');
    if(f==='r1') return n.toFixed(1).replace('.',',')+(_funit(d)?' '+_funit(d):'');
    return base;
  }
  var _pvSince=0,_pvT=null;
