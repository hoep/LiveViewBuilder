  // ===== Widget: Medienquellen-Status (mediasources) =====
  //
  //  Zeigt den Status der HomeSuite-Medienprovider (Spotify/Plex/Jellyfin/Audiobookshelf …)
  //  ueber den Hub (?api=mod&op=hubmanage -> mediaProviders/getSources/spotifyAuthUrl).
  //  BEWUSST ohne Zugangsdaten-Eingabe: Passwoerter/Tokens werden in der Symcon-Konsole
  //  gesetzt (nicht in der Visu). Hier nur: konfiguriert/aktiv ja/nein + Spotify-Login-Link.
  (function(){
    if(!document.getElementById('msrcCss')){var _s=document.createElement('style');_s.id='msrcCss';_s.textContent=
      // Alle Groessen aus der Kachel (cqmin) mit clamp-Grenzen: klein noch lesbar, gross nicht albern.
      '.msrc{position:absolute;inset:0;overflow:auto;background:var(--surface);padding:clamp(8px,4cqmin,16px);box-sizing:border-box;display:flex;flex-direction:column;gap:clamp(5px,2.6cqmin,10px)}'
      +'.msrc-msg{color:var(--muted);font-size:clamp(9px,2.8cqmin,12px);padding:clamp(6px,3cqmin,12px);text-align:center}'
      +'.msrc-h{font-size:clamp(11px,3.8cqmin,15px);font-weight:700;color:var(--text);margin-bottom:2px}'
      +'.msrc-row{display:flex;align-items:center;gap:clamp(6px,2.8cqmin,11px);padding:clamp(6px,2.6cqmin,11px) clamp(7px,3.2cqmin,13px);border:1px solid var(--line-soft);border-radius:9px;background:var(--tile)}'
      // min-width:0 + ellipsis: lange Providernamen quetschen sonst das Status-Badge weg
      +'.msrc-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(11px,3.4cqmin,14px);color:var(--text)}'
      +'.msrc-b{flex:none;font-size:clamp(9px,2.8cqmin,12px);font-weight:700;padding:clamp(2px,1cqmin,4px) clamp(6px,2.6cqmin,11px);border-radius:999px}'
      +'.msrc-b.on{background:color-mix(in oklab,var(--ok,#39d08a) 18%,var(--tile));color:var(--ok,#39d08a);border:1px solid color-mix(in oklab,var(--ok,#39d08a) 45%,var(--line))}'
      +'.msrc-b.off{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}'
      +'.msrc-btn{font:inherit;font-size:clamp(11px,3.4cqmin,14px);border:1px solid var(--accent);color:var(--accent);background:none;border-radius:8px;padding:clamp(6px,2.6cqmin,10px) clamp(9px,3.6cqmin,15px);min-height:clamp(26px,9cqmin,38px);cursor:pointer;align-self:flex-start}'
      +'.msrc-hint{font-size:clamp(9px,2.8cqmin,12px);color:var(--faint);margin-top:2px}';
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
      label:'Medienquellen', cat:'HomeSuite · Audio', paletteIcon:'wlist', size:[320,240],
      render:function(w){return msRender(w);},
      mount:function(w){var el=msEl(w);if(!el)return;msLoad(function(){msPaint(w);});LVB.panel.startPoll('mediasrc:'+w.id,60000,function(){msLoad(function(){msPaint(w);});});},
      props:function(w){return '<div style="font-size:11px;color:var(--muted);padding:4px 2px">Status der Medienprovider (Spotify/Plex/Jellyfin/Audiobookshelf). Zugangsdaten in der Konsole (Hub).</div>';},
      wire:function(w){}
    });
  })();
