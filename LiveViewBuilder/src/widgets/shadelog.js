  // ===== Widget: shadelog — Beschattungs-Gesamtlog (alle Raeume) =====
  //  Zeigt die aggregierten Entscheidungen (Automatik) UND manuellen Befehle aller
  //  ShadingDevice-Instanzen chronologisch. Quelle: ?api=shading&op=log (Hub-Aggregat
  //  ueber HSSH getLog-Ringpuffer je Rollo). Nur echte Fahrten; Schatten-Modus markiert.
  var _SHL_WHY = {'Sturm':'crit','Sonne':'warm','Zeitplan':'info','Automatik':'muted','Manuell':'accent','Manuell (Stopp)':'accent','Tür blockiert':'warn'};
  function _shlPos(v){ return (v===null||v===undefined||v<0) ? '·' : (v+'%'); }
  function _shlRoom(r){ return (r||'').replace(/\s*\(Beschattung\)\s*$/,'').trim() || (r||''); }
  function _shlTime(t){
    if(!t) return '';
    var d=new Date(t*1000), n=new Date(), p=function(x){return (x<10?'0':'')+x;};
    var hm=p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
    var sameDay=(d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate());
    return sameDay ? hm : (p(d.getDate())+'.'+p(d.getMonth()+1)+'. '+hm);
  }
  function _shlDemo(){var now=Math.floor(Date.now()/1000);return [
    {t:now-60,   room:'Wohnzimmer Süd', from:100,to:20, why:'Sonne',    armed:1, src:'auto'},
    {t:now-240,  room:'Küche',          from:20, to:100,why:'Zeitplan', armed:1, src:'auto'},
    {t:now-600,  room:'Schlafzimmer',   from:0,  to:100,why:'Manuell',  armed:1, src:'manuell'},
    {t:now-1800, room:'Wohnzimmer Süd', from:-1, to:0,  why:'Sturm',    armed:1, src:'auto'},
    {t:now-3600, room:'Bad',            from:50, to:0,  why:'Zeitplan', armed:0, src:'auto'}
  ];}
  function _shlFetch(w, cb){
    if(typeof DOKU!=='undefined'&&DOKU){ w._log=_shlDemo(); cb&&cb(); return; }
    fetch('?api=shading&op=log&limit='+(w.max||300),{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){ w._log=(j&&j.ok&&j.entries)||[]; w._err=(j&&j.ok)?'':'log'; cb&&cb(); })
      .catch(function(){ w._log=w._log||[]; w._err='net'; cb&&cb(); });
  }
  function _shlPaint(w, el){
    var body=$('[data-role=shl]',el), sel=$('[data-role=shlroom]',el); if(!body)return;
    var log=w._log||[];
    // Raum-Filter-Optionen (einmalig aus Daten), Auswahl erhalten.
    if(sel){
      var rooms=[]; log.forEach(function(e){ if(e.room&&rooms.indexOf(e.room)<0)rooms.push(e.room); }); rooms.sort();
      var cur=w._room||'';
      sel.innerHTML='<option value="">Alle Räume ('+log.length+')</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'"'+(r===cur?' selected':'')+'>'+escL(_shlRoom(r))+'</option>';}).join('');
    }
    var rows=log.filter(function(e){return !w._room || e.room===w._room;});
    if(w._err){ body.innerHTML='<div class="shl-empty" style="color:var(--crit)">Log nicht lesbar</div>'; return; }
    if(!rows.length){ body.innerHTML='<div class="shl-empty">Keine Einträge</div>'; return; }
    // Mindestbreite fuer das Raster (shl-tblmin): darunter wird waagrecht im BESTEHENDEN
    // .shl-body gescrollt (das hat schon overflow:auto) statt die Spalten zu zerquetschen -
    // die Kachel selbst scrollt dadurch nie waagrecht. Bewusst KEIN zusaetzlicher Behaelter
    // drumherum: der wuerde den klebenden Kopf (.shl-h, position:sticky) vom Scrollport loesen.
    body.innerHTML='<div class="shl-tbl shl-tblmin"><div class="shl-r shl-h"><span>Zeit</span><span>Raum</span><span>Modus</span><span>Ist→Ziel</span><span>Grund</span><span>Status</span></div>'
      + rows.map(function(e){
          var why=e.why||'', wc=_SHL_WHY[why]||'muted', manual=(e.src==='manuell');
          return '<div class="shl-r">'
            + '<span class="shl-t">'+esc(_shlTime(e.t))+'</span>'
            + '<span class="shl-room">'+escL(_shlRoom(e.room||''))+'</span>'
            + '<span><i class="shl-chip '+(manual?'m':'a')+'">'+(manual?'Manuell':'Auto')+'</i></span>'
            + '<span class="shl-pos">'+esc(_shlPos(e.from))+' → '+esc(_shlPos(e.to))+'</span>'
            + '<span><i class="shl-why" style="--wc:var(--'+wc+')">'+escL(why)+'</i></span>'
            + '<span><i class="shl-st '+(e.armed?'on':'sh')+'">'+(e.armed?'scharf':'Schatten')+'</i></span>'
            + '</div>';
        }).join('') + '</div>';
  }
  function _shlLoad(w, el){ _shlFetch(w, function(){ _shlPaint(w, el); }); }
  defWidget('shadelog',{
    label:'Beschattung · Log', cat:'HomeSuite · Beschattung', paletteIcon:'wlist', size:[1040,720],
    defaults:function(w){w.max=300;},
    render:function(w){
      return '<div class="shl">'
        + '<div class="shl-head"><div class="shl-ttl">Beschattung · Entscheidungen & Befehle</div>'
        + '<select class="shl-room" data-role="shlroom"><option value="">Alle Räume</option></select>'
        + '<button class="shl-ref" data-role="shlref" title="Aktualisieren">↻</button></div>'
        + '<div class="shl-body" data-role="shl"><div class="shl-empty">lädt …</div></div></div>';
    },
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas); if(el)_shlLoad(w,el);},
    _bind:function(w,el){
      var sel=$('[data-role=shlroom]',el); if(sel)sel.onchange=function(){w._room=this.value||'';_shlPaint(w,el);};
      var rf=$('[data-role=shlref]',el); if(rf)rf.onclick=function(){var b=$('[data-role=shl]',el);if(b)b.innerHTML='<div class="shl-empty">lädt …</div>';_shlLoad(w,el);};
    },
    props:function(w){if(w.type!=='shadelog')return '';
      return row('Max. Einträge','<input id="pShlMax" type="number" min="20" max="1000" step="20" value="'+(w.max||300)+'">')
        +'<div style="font-size:11px;color:var(--muted);margin:4px 2px">Gesamtlog aller Rollos (Automatik-Entscheidungen + manuelle Befehle) über den Hub. Nur echte Fahrten; Schatten-Modus wird markiert.</div>';
    },
    wire:function(w){ if($('#pShlMax'))$('#pShlMax').oninput=function(){w.max=Math.max(20,Math.min(1000,parseInt(this.value)||300));commit();}; }
  });
  // Periodischer Refresh (wie msglog): alle laufenden shadelog-Widgets neu laden.
  setInterval(function(){
    if(typeof state==='undefined'||!state.widgets) return;
    if(typeof mode!=='undefined'&&mode==='edit') return;
    document.querySelectorAll('.w.t-shadelog').forEach(function(el){
      var id=el.getAttribute('data-id'); var w=(typeof widget==='function')?widget(id):null; if(w)_shlLoad(w,el);
    });
  }, 30000);
