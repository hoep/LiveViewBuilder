  // ===== Seiten-Linkbaum + schwebendes Eigenschaften-Panel ===========================
  //
  // 1) Seitenbaum (Tab "Seiten"): bildet die VERLINKUNGSSTRUKTUR ab, nicht eine flache
  //    Liste. Die Startseite (store.home / "Main") ist immer der Wurzelknoten. Jede Seite
  //    bzw. jedes Popup, das von einem Widget einer Seite aufgerufen wird (navTo/popupTo/
  //    longNav/longPopup/regView), haengt als Kindknoten unter dieser Seite. Weil dasselbe
  //    Ziel von mehreren Widgets/Seiten verlinkt sein kann, erscheint es dann MEHRFACH im
  //    Baum - genau wie im echten Navigationsfluss. Zyklen (eine Seite verweist zurueck)
  //    werden erkannt und mit ↻ markiert, statt endlos aufzuklappen. Nicht erreichbare
  //    Seiten stehen unten unter "Nicht verlinkt".
  //
  // 2) Das komplette rechte Panel (.side) laesst sich per Knopf schweben lassen und dann
  //    frei ueber der Canvas positionieren (Ziehen am Griff-Balken).

  // dieselben 5 Keys wie _renameViewRefs - hier zentral als Nav-Zielmenge
  function _viewLinks(name){
    var v=store.views[name];if(!v||!v.widgets)return [];
    var out=[],seen={};
    v.widgets.forEach(function(w){
      ['navTo','popupTo','longNav','longPopup','regView'].forEach(function(k){
        var t=w[k];if(t&&store.views[t]&&t!==name&&!seen[t]){seen[t]=1;out.push(t);}
      });
    });
    return out;
  }

  function buildPageTree(){
    var box=$('#pageTree');if(!box)return;
    var names=Object.keys(store.views);
    if(!names.length){box.innerHTML='<div class="hint">Keine Seiten.</div>';return;}
    var home=(store.home&&store.views[store.home])?store.home:names[0];
    var reached={};
    function node(name,depth,path){
      reached[name]=1;
      var isPop=_isPopupView(name), cyc=path.indexOf(name)>=0;
      var ic=depth===0?'ic-home':(isPop?'ic-cube':'ic-dot');
      var h='<div class="ptnode'+(name===store.current?' on':'')+(depth===0?' root':'')+'" '
        +'data-view="'+esc(name)+'" style="padding-left:'+(8+depth*15)+'px">'
        +'<svg class="i"><use href="#'+ic+'"/></svg>'
        +'<span class="ptname">'+esc(name)+'</span>'
        +(isPop?'<span class="ptbadge">Popup</span>':'')
        +(name===store.home?'<span class="pthome" title="Startseite">Start</span>':'')
        +(cyc?'<span class="ptcyc" title="verweist zurueck (Zyklus)">↻</span>':'')
        +'</div>';
      if(cyc)return h;
      var np=path.concat([name]);
      _viewLinks(name).forEach(function(k){if(reached[k])return;h+=node(k,depth+1,np);}); // jede View nur 1x (Spanning-Tree; Mehrfach-Links nicht erneut expandieren)
      return h;
    }
    var html=node(home,0,[]);
    var orphans=names.filter(function(n){return !reached[n];});
    if(orphans.length){
      html+='<div class="ptgrp">Nicht verlinkt</div>';
      orphans.forEach(function(n){if(!reached[n])html+=node(n,0,[]);});
    }
    box.innerHTML=html;
    $$('.ptnode',box).forEach(function(el){
      el.onclick=function(){var n=el.getAttribute('data-view');if(n&&store.views[n])switchView(n);};
    });
  }

  // ---- schwebendes Panel --------------------------------------------------------------
  var _sideFloat=false;
  function toggleSideFloat(){
    var s=$('.side');if(!s)return;
    _sideFloat=!_sideFloat;
    s.classList.toggle('float',_sideFloat);
    if(_sideFloat){
      if(!s.style.left){ // erstmalig: oben rechts ueber die Canvas legen
        var w=s.offsetWidth||360;
        s.style.left=Math.max(8,window.innerWidth-w-24)+'px';
        s.style.top='72px';
      }
      toast('Panel schwebt - am Balken oben ziehen zum Verschieben');
    }else{
      s.style.left='';s.style.top='';s.style.width='';
      toast('Panel angedockt');
    }
    _bsSave();
  }
  (function(){
    var s=$('.side'),grip=$('#sideGrip'),btn=$('#sideFloat');
    if(btn)btn.onclick=function(e){e.stopPropagation();toggleSideFloat();};
    if(!grip||!s)return;
    var drag=null;
    grip.addEventListener('pointerdown',function(e){
      if(!_sideFloat)return;                       // nur im Schwebemodus verschiebbar
      if(e.target.closest('#sideFloat'))return;    // Klick auf den Knopf nicht als Ziehen
      drag={x:e.clientX,y:e.clientY,l:parseInt(s.style.left)||s.offsetLeft,t:parseInt(s.style.top)||s.offsetTop};
      try{grip.setPointerCapture(e.pointerId);}catch(_e){}
      e.preventDefault();
    });
    grip.addEventListener('pointermove',function(e){
      if(!drag)return;
      var l=drag.l+(e.clientX-drag.x), t=drag.t+(e.clientY-drag.y);
      l=Math.max(4,Math.min(window.innerWidth-60,l));
      t=Math.max(4,Math.min(window.innerHeight-40,t));
      s.style.left=l+'px';s.style.top=t+'px';
    });
    function end(){if(drag){drag=null;_bsSave();}}
    grip.addEventListener('pointerup',end);
    grip.addEventListener('pointercancel',end);
  })();

  // ---- Builder-Bedienoberflaeche merken (eigene Datei, NICHT im Layout-Store) --------
  // Zoom, aktiver Tab und Schwebemodus+Position werden pro Instanz in builder-settings.json
  // gehalten (Endpoint ?api=bset). Getrennt vom Layout, damit reiner UI-Zustand das Dokument
  // weder aendert noch an die Run-Clients veroeffentlicht wird. Nur im Builder-Modus aktiv.
  var _bsT=0, _bsRestoring=false;
  function _bsCollect(){
    var s=$('.side'), tabEl=$('.tab.on');
    var o={ zoom:(typeof zoom==='number'?zoom:1),
            tab:(tabEl?tabEl.getAttribute('data-tab'):null),
            float:!!_sideFloat };
    if(_sideFloat&&s){ o.floatL=parseInt(s.style.left)||0; o.floatT=parseInt(s.style.top)||0; }
    return o;
  }
  function _bsSave(){
    if(RUN||DOKU||_bsRestoring)return;
    clearTimeout(_bsT);
    _bsT=setTimeout(function(){
      try{
        fetch('?api=bset&save=1&key='+encodeURIComponent(TOKEN),
          {method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
           body:JSON.stringify(_bsCollect())});
      }catch(_e){}
    },500);
  }
  function _bsApply(s){
    if(!s||typeof s!=='object')return;
    _bsRestoring=true;
    try{
      if(typeof s.zoom==='number'&&typeof setZoom==='function')setZoom(s.zoom);
      if(s.tab&&typeof showTab==='function')showTab(s.tab);
      if(s.float&&!_sideFloat){
        toggleSideFloat();
        var sd=$('.side');
        if(sd){ if(typeof s.floatL==='number')sd.style.left=s.floatL+'px';
                if(typeof s.floatT==='number')sd.style.top=s.floatT+'px'; }
      }
    }catch(_e){}
    _bsRestoring=false;
  }
  function loadBuilderSettings(){
    if(RUN||DOKU)return;
    fetch('?api=bset',{cache:'no-store'}).then(function(r){return r.json();})
      .then(function(s){_bsApply(s);}).catch(function(){});
  }
