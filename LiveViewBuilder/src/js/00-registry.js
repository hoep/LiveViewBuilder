  // ===== Sichtbarer Fehler-Overlay (Diagnose) — zeigt jeden JS-Fehler als rote Box auf dem Bildschirm =====

  // ---- Nebel in Worte, EINMAL fuer alle Anzeigen -----------------------------
  //
  // Wetter+ und Sonnenszene sagten dasselbe verschieden: die eine rechnete aus der
  // STUFE, die andere aus der DICHTE mit eigenen Schwellen. Am 26.08.2026 stand
  // deshalb auf der einen Karte "Morgendunst" und auf der anderen "dichter Nebel" -
  // bei denselben Messwerten. Wer zwei Karten nebeneinander haengen hat, darf nicht
  // raten muessen, welche recht hat.
  //
  // Die Stufe ist die Wahrheit (0 kein, 1 diesig, 2 Nebel, 3 dicht); sie kommt aus
  // der Wetterstation, wo Regelsatz, FSI und Kameramessung zusammenlaufen. Hier wird
  // sie nur noch benannt - inklusive der Tageszeit, denn vormittags loest sich
  // Strahlungsnebel auf und abends bildet er sich. Nach der UHR und nicht nach dem
  // Sonnenstand, sonst hiesse es im Winter mittags "Morgendunst".
  function lvNebelText(stufe){
    stufe=parseInt(stufe);
    if(!(stufe>0))return '';
    if(stufe>=3)return 'Dichter Nebel';
    if(stufe>=2)return 'Nebel';
    var h=new Date().getHours();
    return (h<11)?'Morgendunst':((h>=16)?'Abenddunst':'Diesig');
  }
  (function(){
    function box(msg){
      try{
        var d=document.getElementById('__errbox');
        if(!d){d=document.createElement('div');d.id='__errbox';
          d.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#b00020;color:#fff;font:12px/1.4 monospace;padding:22px 14px 10px;white-space:pre-wrap;max-height:40vh;overflow:auto;box-shadow:0 -2px 12px rgba(0,0,0,.5);cursor:pointer';
          d.title='Klicken zum Schließen';
          var x=document.createElement('div');x.textContent='× schließen';x.style.cssText='position:absolute;top:4px;right:12px;font-weight:bold;opacity:.85';d.appendChild(x);
          d.addEventListener('click',function(){d.remove();});
          (document.body||document.documentElement).appendChild(d);}
        var line=document.createElement('div');line.textContent=msg;d.appendChild(line);
      }catch(e){}
    }
    window.__diag=box;
    function _isRun(){try{return ((window.LVCFG&&window.LVCFG.run)==="1")||/[?&]run=1/.test(location.search)||/\/hook\/run(\/|$|\?)/.test(location.pathname)||document.documentElement.classList.contains('run-boot')||(document.body&&document.body.classList.contains('run'));}catch(_){return false;}}
    window.addEventListener('error',function(e){
      // opaque cross-origin "Script error." (ohne Datei/Zeile) tragen keine Info -> ignorieren; im Run/Kiosk gar keine Diagnose-Box
      if((!e.filename||!e.lineno)&&(!e.message||/script error/i.test(e.message)))return;
      if(_isRun())return;
      box('JS-FEHLER: '+(e.message||e.error&&e.error.message||'?')+'\n@ '+(e.filename||'')+' Zeile '+(e.lineno||'?')+':'+(e.colno||'?')+(e.error&&e.error.stack?'\n'+e.error.stack.split('\n').slice(0,4).join('\n'):''));
    });
    window.addEventListener('unhandledrejection',function(e){
      if(_isRun())return;
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
