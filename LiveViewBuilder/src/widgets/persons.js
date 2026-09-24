  // ===== Widget: Personen (persons) — Anwesenheit als ueberlappende Fotoreihe =====
  // Je Person (w.items): Name, Anwesenheitsvariable (vid), Foto als Media-ID (media) und
  // optional ein Popup (popupTo). Wer da ist, steht in Farbe; wer weg ist, in Graustufen
  // und etwas blasser - erkennbar bleibt jede Person trotzdem. Ohne Foto stehen die Initialen.
  // Die Variablen laufen ueber w.items[].vid, das _collectIds ohnehin abonniert; live()
  // schaltet dann nur die Klasse um, ohne neu zu zeichnen.
  function _ppDa(v){if(v==null)return false;if(typeof v==='boolean')return v;var s=(''+v).trim().toLowerCase();
    return !(s===''||s==='0'||s==='false'||s==='aus'||s==='off'||s==='nein'||s==='abwesend');}
  function _ppIni(n){return String(n||'?').trim().split(/\s+/).map(function(x){return x.charAt(0);}).join('').slice(0,2).toUpperCase();}
  function _ppWert(p){var id=parseInt(p&&p.vid)||0;var lv=id&&_lastVals[id];return lv?lv.v:null;}
  function _ppTitel(p,da){return (p.name||'')+(parseInt(p.vid)?(da?' · da':' · weg'):'');}
  defWidget('persons',{
    label:'Personen', cat:'Anzeige', paletteIcon:'people', size:[210,44],
    defaults:function(w){w.items=[{name:'Person 1'},{name:'Person 2'},{name:'Person 3'}];},
    render:function(w){
      var ov=(w.ppOv!=null&&w.ppOv!=='')?Math.max(0,Math.min(60,+w.ppOv)):22;
      return '<div class="hpp'+(w.ppLift===false?'':' lift')+'" style="--pp-ov:'+ov+'"><div class="hpp-row">'+(w.items||[]).map(function(p,i){
        var da=parseInt(p.vid)?_ppDa(_ppWert(p)):true,m=parseInt(p.media)||0;
        return '<div class="hpp-p'+(da?'':' off')+(p.popupTo?' act':'')+'" data-pp="'+i+'" title="'+esc(_ppTitel(p,da))+'">'
          +(m?'<img src="?api=media&id='+m+'" alt="'+esc(p.name||'')+'" draggable="false">':'<span class="hpp-ini">'+esc(_ppIni(p.name))+'</span>')+'</div>';
      }).join('')+'</div></div>';
    },
    props:function(w){if(w.type!=='persons')return '';
      var pops=[['','— kein Popup —']].concat(Object.keys(store.views).filter(function(n){return _isPopupView(n);}).map(function(n){return [n,n];}));
      return listEditor(w,'items','Personen: Name · Anwesenheit (Variable) · Foto (Media-ID) · Popup',
          [{k:'name',ph:'Name'},{k:'vid',ph:'Variable'},{k:'media',ph:'Media-ID'},{k:'popupTo',ph:'Popup',type:'select',options:pops}],{wrap:true})
        +'<div class="hint" style="font-size:11px;color:var(--muted);margin:4px 2px 8px">Da = Foto in Farbe, weg = Graustufe. Ohne Variable gilt die Person als da, ohne Foto stehen die Initialen.</div>'
        +row('Überlappung (%)','<input id="pPpOv" type="number" min="0" max="60" step="1" style="width:80px" value="'+(w.ppOv!=null?w.ppOv:'')+'" placeholder="22">')
        +row('Anheben beim Zeigen','<input type="checkbox" id="pPpLift"'+(w.ppLift===false?'':' checked')+'>');
    },
    wire:function(w){
      if($('#pPpOv'))$('#pPpOv').oninput=function(){w.ppOv=this.value===''?undefined:(parseInt(this.value)||0);render();commit();};
      if($('#pPpLift'))$('#pPpLift').onchange=function(){w.ppLift=this.checked?undefined:false;render();commit();};
    },
    live:function(w,el,id,d){(w.items||[]).forEach(function(p,i){if((parseInt(p.vid)||0)!==id)return;
      var n=el.querySelector('[data-pp="'+i+'"]');if(!n)return;var da=_ppDa(d.v);n.classList.toggle('off',!da);n.title=_ppTitel(p,da);});return true;},
    click:function(w,el,e){var n=e.target.closest('[data-pp]');if(!n)return false;
      var p=(w.items||[])[+n.getAttribute('data-pp')];
      if(p&&p.popupTo&&store.views[p.popupTo]){openPopup(p.popupTo,_aliasMap(w));return true;}
      return false;}   // sonst greift die Widget-Aktion (Popup/Seite des ganzen Widgets)
  });
