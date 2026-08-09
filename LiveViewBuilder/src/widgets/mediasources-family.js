  // ===== Widget: Medienquellen-Status (mediasources) =====
  //
  //  Zeigt den Status der HomeSuite-Medienprovider (Spotify/Plex/Jellyfin/Audiobookshelf …)
  //  ueber den Hub (?api=mod&op=hubmanage -> mediaProviders/getSources/spotifyAuthUrl).
  //  BEWUSST ohne Zugangsdaten-Eingabe: Passwoerter/Tokens werden in der Symcon-Konsole
  //  gesetzt (nicht in der Visu). Hier nur: konfiguriert/aktiv ja/nein + Spotify-Login-Link.
  (function(){
    if(!document.getElementById('msrcCss')){var _s=document.createElement('style');_s.id='msrcCss';_s.textContent=
      '.msrc{position:absolute;inset:0;overflow:auto;background:var(--surface);padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px}'
      +'.msrc-msg{color:var(--muted);font-size:12px;padding:10px;text-align:center}'
      +'.msrc-h{font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px}'
      +'.msrc-row{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid var(--line-soft);border-radius:9px;background:var(--tile)}'
      +'.msrc-nm{flex:1;font-size:12.5px;color:var(--text)}'
      +'.msrc-b{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px}'
      +'.msrc-b.on{background:color-mix(in oklab,var(--ok,#39d08a) 18%,var(--tile));color:var(--ok,#39d08a);border:1px solid color-mix(in oklab,var(--ok,#39d08a) 45%,var(--line))}'
      +'.msrc-b.off{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}'
      +'.msrc-btn{font:inherit;font-size:12px;border:1px solid var(--accent);color:var(--accent);background:none;border-radius:8px;padding:7px 12px;cursor:pointer;align-self:flex-start}'
      +'.msrc-hint{font-size:10.5px;color:var(--faint);margin-top:2px}';
      document.head.appendChild(_s);}

    var _msData=null,_msErr='';
    function msHub(op,args){return fetch('?api=mod&op=hubmanage&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:op,args:args||{}})}).then(function(r){return r.json();});}
    function msLoad(cb){
      if(typeof DOKU!=='undefined'&&DOKU){_msData=[{id:'spotify',label:'Spotify',configured:true},{id:'plex',label:'Plex',configured:false},{id:'jellyfin',label:'Jellyfin',configured:true},{id:'audiobookshelf',label:'Audiobookshelf',configured:false}];cb&&cb();return;}
      msHub('mediaProviders').then(function(j){_msData=(j&&j.providers)||[];_msErr='';cb&&cb();}).catch(function(){_msErr='net';cb&&cb();});
    }
    function msEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function msRender(w){
      if(_msErr)return '<div class="msrc"><div class="msrc-msg">Hub nicht erreichbar</div></div>';
      if(!_msData)return '<div class="msrc"><div class="msrc-msg">lädt …</div></div>';
      var rows=_msData.map(function(p){
        return '<div class="msrc-row"><span class="msrc-nm">'+escL(p.label||p.id)+'</span>'
          +'<span class="msrc-b '+(p.configured?'on':'off')+'">'+(p.configured?'konfiguriert':'nicht eingerichtet')+'</span></div>';
      }).join('');
      var hasSpotify=_msData.some(function(p){return p.id==='spotify';});
      var h='<div class="msrc"><div class="msrc-h">Medienquellen</div>'+(rows||'<div class="msrc-msg">keine Provider</div>');
      if(hasSpotify)h+='<button class="msrc-btn" data-msspotify>Spotify verbinden…</button>';
      h+='<div class="msrc-hint">Zugangsdaten werden in der Symcon-Konsole (Hub) gesetzt — nicht in der Visu.</div></div>';
      return h;
    }
    function msPaint(w){var el=msEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=msRender(w);
      var b=host.querySelector('[data-msspotify]');if(b)b.onclick=function(){
        if(typeof DOKU!=='undefined'&&DOKU){toast&&toast('Demo: Spotify-Login');return;}
        msHub('spotifyAuthUrl').then(function(j){var u=j&&(j.url||(j.result&&j.result.url));if(u)window.open(u,'_blank');else toast&&toast('Kein Login-Link (Client-ID/Secret in der Konsole setzen)');});
      };}
    defWidget('mediasources',{
      label:'Medienquellen', paletteIcon:'wlist', size:[320,240],
      render:function(w){return msRender(w);},
      mount:function(w){var el=msEl(w);if(!el)return;msLoad(function(){msPaint(w);});LVB.panel.startPoll('mediasrc:'+w.id,60000,function(){msLoad(function(){msPaint(w);});});},
      props:function(w){return '<div style="font-size:11px;color:var(--muted);padding:4px 2px">Status der Medienprovider (Spotify/Plex/Jellyfin/Audiobookshelf). Zugangsdaten in der Konsole (Hub).</div>';},
      wire:function(w){}
    });
  })();
