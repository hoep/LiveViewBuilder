  // ===== Widget: poolcfg — Konfigurations-Tabelle, echte editierbare Felder an Variablen =====
  //
  //  Rendert eine ganze Config-Seite als EIN Bauteil: kompakte Tabelle (Zeile je
  //  Einstellung, Editor in der Zelle), gruppiert nach Sektion. Felder in w.rows
  //  (=[{vid,label,kind,unit,step,options,section}]) -> _collectIds sammelt vid (Poll).
  //  kind: num | bool | enum | str | ro. Schreibt via setVar (RequestAction).
  (function(){
    function _pcOn(v){return v===true||v===1||v==='1'||(+v>0);}
    function pcEditor(f){
      if(f.kind==='ro')   return '<span class="pcft-ro" data-pcf-vid="'+f.vid+'" data-role="v">–</span>';
      if(f.kind==='bool') return '<button type="button" class="pcft-tog" data-pcf-tog data-pcf-vid="'+f.vid+'"><i></i></button>';
      if(f.kind==='enum') return '<span class="pcft-seg" data-pcf-vid="'+f.vid+'">'+((f.options||[]).map(function(o){return '<button type="button" data-pcf-opt="'+esc(String(o.v))+'">'+esc(o.t)+'</button>';}).join(''))+'</span>';
      if(f.kind==='str')  return '<input class="pcft-txt" type="text" data-pcf-vid="'+f.vid+'" data-role="v">';
      var st=(f.step!=null?f.step:1);
      return '<span class="pcft-num"><button type="button" class="pcft-nb" data-pcf-step="'+(-st)+'">−</button>'
        +'<input class="pcft-in" inputmode="decimal" data-pcf-vid="'+f.vid+'" data-role="v">'
        +'<button type="button" class="pcft-nb" data-pcf-step="'+st+'">+</button>'
        +(f.unit?'<span class="pcft-u">'+esc(f.unit)+'</span>':'')+'</span>';
    }
    function pcRender(w){
      var rows=w.rows||[], order=[], grp={};
      rows.forEach(function(f){var s=f.section||'';if(!(s in grp)){grp[s]=[];order.push(s);}grp[s].push(f);});
      var h='<div class="pcft">';
      h+='<div class="pcft-eye">'+esc(w.eyebrow||'POOL CFG · KONFIGURATION')+'</div>';
      h+='<div class="pcft-h1">'+esc(w.h1||w.label||'')+'</div>';
      order.forEach(function(s){var fs=grp[s], ro=fs.every(function(f){return f.kind==='ro';});
        h+='<div class="pcft-sec"><div class="pcft-sh">'+esc((s||'').toUpperCase())+'</div>';
        if(ro){ h+='<div class="pcft-chips">'+fs.map(function(f){return '<div class="pcft-chip"><b data-pcf-vid="'+f.vid+'" data-role="v">–</b><span>'+escL(f.label)+'</span></div>';}).join('')+'</div>'; }
        else  { h+='<div class="pcft-grid">'+fs.map(function(f){return '<div class="pcft-r"><span class="pcft-l">'+escL(f.label)+'</span><span class="pcft-e">'+pcEditor(f)+'</span></div>';}).join('')+'</div>'; }
        h+='</div>';
      });
      return h+'</div>';
    }
    defWidget('poolcfg',{
      label:'Konfig-Tabelle', paletteIcon:'meter', size:[1450,600], noPalette:true,
      render:function(w){return pcRender(w);},
      live:function(w,el,id,d,base,txt,on){
        el.querySelectorAll('[data-pcf-vid="'+id+'"]').forEach(function(n){
          if(n.classList.contains('pcft-tog')){ n.classList.toggle('on',_pcOn(d.v)); }
          else if(n.classList.contains('pcft-seg')){ n.querySelectorAll('[data-pcf-opt]').forEach(function(b){b.classList.toggle('on',String(b.getAttribute('data-pcf-opt'))===String(d.v));}); }
          else if(n.tagName==='INPUT'){ if(document.activeElement!==n) n.value=(d.v!=null?d.v:''); }
          else { n.textContent=txt; }
        });
      },
      mount:function(w){ var el=document.querySelector('.w[data-id="'+w.id+'"]'); if(!el)return;
        el.querySelectorAll('input[data-pcf-vid]').forEach(function(inp){ if(inp._pcf)return; inp._pcf=1;
          var vid=parseInt(inp.getAttribute('data-pcf-vid')), isNum=inp.classList.contains('pcft-in');
          function cm(){ var v=inp.value; if(isNum){var nv=parseFloat(String(v).replace(',','.'));if(!isFinite(nv))return;setVar(vid,nv);} else setVar(vid,v); }
          inp.addEventListener('change',cm);
          inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){e.preventDefault();inp.blur();} });
        });
      },
      click:function(w,el,e){
        var sb=e.target.closest('[data-pcf-step]');
        if(sb){ var box=sb.closest('.pcft-num'), inp=$('[data-role=v]',box), vid=parseInt(inp.getAttribute('data-pcf-vid'));
          var cur=parseFloat(String(inp.value).replace(',','.')); if(!isFinite(cur))cur=0;
          var nv=parseFloat((cur+parseFloat(sb.getAttribute('data-pcf-step'))).toFixed(6)); setVar(vid,nv); return true; }
        var tg=e.target.closest('[data-pcf-tog]');
        if(tg){ var vid=parseInt(tg.getAttribute('data-pcf-vid')); setVar(vid,!tg.classList.contains('on')); return true; }
        var op=e.target.closest('[data-pcf-opt]');
        if(op){ var seg=op.closest('.pcft-seg'), vid=parseInt(seg.getAttribute('data-pcf-vid')), val=op.getAttribute('data-pcf-opt');
          setVar(vid, /^-?\d+(\.\d+)?$/.test(val)?parseFloat(val):val); return true; }
        return false;
      }
    });
  })();
