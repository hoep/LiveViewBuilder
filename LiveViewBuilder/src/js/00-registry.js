  // ===== Sichtbarer Fehler-Overlay (Diagnose) — zeigt jeden JS-Fehler als rote Box auf dem Bildschirm =====
  (function(){
    function box(msg){
      try{
        var d=document.getElementById('__errbox');
        if(!d){d=document.createElement('div');d.id='__errbox';
          d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#b00020;color:#fff;font:12px/1.4 monospace;padding:10px 14px;white-space:pre-wrap;max-height:50vh;overflow:auto;box-shadow:0 2px 12px rgba(0,0,0,.5)';
          (document.body||document.documentElement).appendChild(d);}
        d.textContent=(d.textContent?d.textContent+'\n\n':'')+msg;
      }catch(e){}
    }
    window.__diag=box;
    window.addEventListener('error',function(e){
      box('JS-FEHLER: '+(e.message||e.error&&e.error.message||'?')+'\n@ '+(e.filename||'')+' Zeile '+(e.lineno||'?')+':'+(e.colno||'?')+(e.error&&e.error.stack?'\n'+e.error.stack.split('\n').slice(0,4).join('\n'):''));
    });
    window.addEventListener('unhandledrejection',function(e){
      box('PROMISE-FEHLER: '+((e.reason&&(e.reason.stack||e.reason.message))||e.reason||'?'));
    });
  })();

  // ===== Widget-Registry — jedes Widget lebt in src/widgets/<typ>.js und registriert sich via defWidget =====
  var WIDGETS={};
  var TYPES={};   // Typ -> Anzeigename (für die Typ-Auswahl in den Eigenschaften); wird je defWidget aus def.label befüllt
  function defWidget(type,def){def=def||{};WIDGETS[type]=def;
    if(def.label&&typeof TYPES!=='undefined')TYPES[type]=def.label;
    if(def.paletteIcon&&typeof PAL_ICON!=='undefined')PAL_ICON[type]=def.paletteIcon;
  }
