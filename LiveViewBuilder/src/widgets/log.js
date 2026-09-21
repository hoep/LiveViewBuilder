  // ===== Widget: log — Entscheidungs-Log =====
  //  Hiess bis v0.32.14 'shadelog' und konnte nur die Beschattung. Der alte Typ lebt als
  //  Alias in 11-migrate.js weiter, damit bestehende Seiten nicht brechen.
  //  Zeigt die aggregierten Entscheidungen (Automatik) UND manuellen Befehle aller
  //  ShadingDevice-Instanzen chronologisch. Quelle: ?api=shading&op=log (Hub-Aggregat
  //  ueber HSSH getLog-Ringpuffer je Rollo). Nur echte Fahrten; Schatten-Modus markiert.
  var _SHL_WHY = {'Sturm':'crit','Sonne':'warm','Zeitplan':'info','Automatik':'muted','Manuell':'accent','Manuell (Stopp)':'accent','Tür blockiert':'warn'};
  function _shlPos(v){ return (v===null||v===undefined||v<0) ? '·' : (v+'%'); }
  // Nachgestellte Klammergruppen weg: aus "Automower Righty (HSMW) (Maeher)" wird
  // "Automower Righty". Die Domaene steht ohnehin in ihrer eigenen Spalte, und die
  // Modulkuerzel sagen dem Leser nichts.
  function _shlRoom(r){
    var t=(r||'').replace(/(\s*\([^()]*\))+\s*$/,'').trim();
    return t || (r||'');
  }
  function _shlTime(t){
    if(!t) return '';
    var d=_hzD(t*1000), n=_hzJetzt(), p=function(x){return (x<10?'0':'')+x;};
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
  function _shlAlle(w){ return (w.shlSrc||'shading')==='all'; }
  // Demo fuer die Doku-Ansicht der Gesamtquelle - dieselben Felder, die ?api=decisions liefert.
  function _shlDemoAll(){var now=Math.floor(Date.now()/1000);return [
    {t:now-120,  room:'Buchshecke',   was:'Kein Lauf',        why:'Zeitplan - gesperrt: Regen 5.8 mm (>= 2)', armed:1},
    {t:now-900,  room:'Esszimmer',    was:'Sollwert 12 C',    why:'Fenster offen (Geräteabsenkung)',          armed:1},
    {t:now-1800, room:'Wohnzimmer',   was:'Leuchte ein',      why:'Regel "Bewegung Gang"',                    armed:1},
    {t:now-5400, room:'Blumeninseln', was:'10 min bewässern', why:'Zeitplan',                                 armed:1},
    {t:now-9000, room:'Schlafzimmer', was:'kühlen auf 22 C',  why:'Zeitplan',                                 armed:0}
  ];}
  function _shlFetch(w, cb){
    var alle=_shlAlle(w);
    if(typeof DOKU!=='undefined'&&DOKU){ w._log=alle?_shlDemoAll():_shlDemo(); cb&&cb(); return; }
    if(alle){
      // Gesamtquelle: die Ringpuffer ALLER HomeSuite-Instanzen ueber den Hub.
      // Felder auf das Beschattungs-Schema abbilden, damit Filter und Zeichnen
      // eine einzige Fassung bleiben.
      fetch('?api=decisions&limit='+(w.max||300),{cache:'no-store'})
        .then(function(r){return r.json();})
        .then(function(j){
          var rows=(j&&j.ok&&j.rows)||[];
          w._log=rows.map(function(e){
            return {t:e.t, room:(e.raum||e.geraet||''), was:e.was||'', why:e.warum||'',
                    dom:e.domaene||'', armed:e.real?1:0, n:+e.n||1, seit:+e.seit||0,
                    ok:(e.ok===null||e.ok===undefined)?null:(e.ok?1:0), werte:e.werte||null};
          });
          w._err=(j&&j.ok)?'':'log'; cb&&cb();
        })
        .catch(function(){ w._log=w._log||[]; w._err='net'; cb&&cb(); });
      return;
    }
    fetch('?api=shading&op=log&limit='+(w.max||300),{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){ w._log=(j&&j.ok&&j.entries)||[]; w._err=(j&&j.ok)?'':'log'; cb&&cb(); })
      .catch(function(){ w._log=w._log||[]; w._err='net'; cb&&cb(); });
  }
  // Sortierung: Spaltenkopf klicken. Schluessel je Spalte, damit nach dem ANGEZEIGTEN
  // Inhalt sortiert wird und nicht nach dem Rohsatz - "Zeitplan - gesperrt: ..." soll bei
  // Z stehen, nicht bei dem, was zufaellig im Objekt zuerst kommt.
  var _SHL_KEYS_ALL = ['t','room','was','why','armed'];
  var _SHL_KEYS_SHD = ['t','room','src','to','why','armed'];
  function _shlSortKeys(w){ return _shlAlle(w) ? _SHL_KEYS_ALL : _SHL_KEYS_SHD; }
  function _shlCmp(a,b,k){
    var x=a[k], y=b[k];
    if(k==='t'||k==='armed'||k==='to'){ x=+x||0; y=+y||0; return x-y; }
    x=String(x==null?'':x).toLowerCase(); y=String(y==null?'':y).toLowerCase();
    return x<y?-1:(x>y?1:0);
  }
  function _shlSort(w, rows){
    var k=w._sortK; if(!k) return rows;                       // Vorgabe: Reihenfolge der Quelle (neueste zuerst)
    var dir=(w._sortD===1)?1:-1;
    return rows.slice().sort(function(a,b){ return _shlCmp(a,b,k)*dir; });
  }
  function _shlSuche(w, rows){
    var q=(w._q||'').trim().toLowerCase(); if(!q) return rows;
    return rows.filter(function(e){
      return ((e.room||'')+' '+(e.was||'')+' '+(e.why||'')).toLowerCase().indexOf(q)>=0;
    });
  }
  // Kopfzelle mit Sortierpfeil. Nicht sortierbare Spalten (Ist->Ziel im Beschattungs-Modus
  // gibt es als Zahl, aber "Modus" ist ein Chip) bekommen trotzdem einen Schluessel - die
  // Sortierung nach dem Rohwert ist dort brauchbarer als gar keine.
  // Chevron-Optik WOERTLICH vom table-Widget uebernommen (.tbl-sort/.tbl-chev): im
  // Ruhezustand unsichtbar, beim Ueberfahren angedeutet, in Akzentfarbe wenn aktiv. Mein
  // erster Versuch haengte ▲/▼ an den Text - das wurde von der Ellipsis abgeschnitten und
  // war im Ruhezustand ueberhaupt nicht zu sehen, man musste also raten, ob die Spalte
  // sortierbar ist.
  function _shlChev(st){
    if(st==='asc') return '<span class="tbl-chev on"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></span>';
    if(st==='desc')return '<span class="tbl-chev on"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>';
    return '<span class="tbl-chev idle"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/></svg></span>';
  }
  // Drei Zustaende, nicht zwei: "ausgefuehrt" und "geklappt" sind zweierlei. Ein an das
  // Geraet geschickter Befehl kann abgelehnt werden - stand vorher als "ausgefuehrt" neben
  // dem Grund "Befehl vom Geraet abgelehnt", ein Widerspruch in derselben Zeile.
  function _shlStatus(e){
    if(!e.armed) return '<i class="shl-st sh">Schatten</i>';
    if(e.ok===0)  return '<i class="shl-st no">fehlgeschlagen</i>';
    return '<i class="shl-st on">ausgeführt</i>';
  }
  function _shlKopf(w, titel, k){
    var st=(w._sortK===k)?((w._sortD===1)?'asc':'desc'):'idle';
    return '<span><button class="tbl-sort" data-shlsort="'+esc(k)+'">'+escL(titel)+_shlChev(st)+'</button></span>';
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
    // Domaenen-Auswahl aus den Daten fuellen (wie der Raumfilter), Auswahl erhalten.
    var dsel=$('[data-role=shldom]',el);
    if(dsel){
      var doms=[]; log.forEach(function(e){ if(e.dom&&doms.indexOf(e.dom)<0)doms.push(e.dom); }); doms.sort();
      var dcur=w._dom||'';
      dsel.innerHTML='<option value="">Alle Domänen ('+log.length+')</option>'
        + doms.map(function(x){ var n=log.filter(function(e){return e.dom===x;}).length;
            return '<option value="'+esc(x)+'"'+(x===dcur?' selected':'')+'>'+escL(x)+' ('+n+')</option>'; }).join('');
    }
    var rows=_shlSort(w, _shlSuche(w, log.filter(function(e){
      return (!w._room || e.room===w._room) && (!w._dom || e.dom===w._dom);
    })));
    if(w._err){ body.innerHTML='<div class="shl-empty" style="color:var(--crit)">Log nicht lesbar</div>'; return; }
    if(!rows.length){ body.innerHTML='<div class="shl-empty">Keine Einträge</div>'; return; }
    // Mindestbreite fuer das Raster (shl-tblmin): darunter wird waagrecht im BESTEHENDEN
    // .shl-body gescrollt (das hat schon overflow:auto) statt die Spalten zu zerquetschen -
    // die Kachel selbst scrollt dadurch nie waagrecht. Bewusst KEIN zusaetzlicher Behaelter
    // drumherum: der wuerde den klebenden Kopf (.shl-h, position:sticky) vom Scrollport loesen.
    if(_shlAlle(w)){
      // Vier Spalten statt sechs: Modus und Ist→Ziel sind Beschattungsbegriffe. Was eine
      // Heizzone oder ein Bewaesserungskreis entschieden hat, steht im Klartext in "Was".
      body.innerHTML='<div class="shl-tbl shl-tblmin shl-all"><div class="shl-r shl-h">'
        + _shlKopf(w,'Zeit','t') + _shlKopf(w,'Raum','room') + _shlKopf(w,'Entscheidung','was')
        + _shlKopf(w,'Grund','why') + _shlKopf(w,'Status','armed') + '</div>'
        + rows.map(function(e){
            var why=e.why||'', wc=_SHL_WHY[why.split(' ')[0]]||'muted';
            // Gesperrt ist keine Fahrt, sondern eine Verhinderung - das soll man sehen.
            if(/gesperrt|Fenster offen/i.test(why)) wc='warn';
            return '<div class="shl-r">'
              + '<span class="shl-t">'+esc(_shlTime(e.t))+'</span>'
              + '<span class="shl-room">'+escL(_shlRoom(e.room||''))+'</span>'
              + '<span class="shl-was">'+escL(e.was||'')
                + ((e.n>1) ? '<i class="shl-n" title="'+esc((e.seit? _shlTime(e.seit)+' bis ' : '')+_shlTime(e.t))+'">'+e.n+'×</i>' : '')
                + '</span>'
              + '<span><i class="shl-why" style="--wc:var(--'+wc+')" title="'+esc(why)+'">'+escL(why)+'</i></span>'
              + '<span>'+_shlStatus(e)+'</span>'
              + '</div>';
          }).join('') + '</div>';
      return;
    }
    body.innerHTML='<div class="shl-tbl shl-tblmin"><div class="shl-r shl-h">'
      + _shlKopf(w,'Zeit','t') + _shlKopf(w,'Raum','room') + _shlKopf(w,'Modus','src')
      + _shlKopf(w,'Ist→Ziel','to') + _shlKopf(w,'Grund','why') + _shlKopf(w,'Status','armed') + '</div>'
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
  function _shlWire(w, el){
      var sel=$('[data-role=shlroom]',el); if(sel)sel.onchange=function(){w._room=this.value||'';_shlPaint(w,el);};
      var ds=$('[data-role=shldom]',el);
      if(ds)ds.onchange=function(){ w._dom=this.value||''; _shlPaint(w,el); };
      var q=$('[data-role=shlq]',el);
      if(q){ q.value=w._q||''; q.oninput=function(){ w._q=this.value||''; _shlPaint(w,el); }; }
      // Sortierung liegt auf dem Kopf der Tabelle, die bei jedem Zeichnen neu entsteht -
      // deshalb am Koerper delegieren statt an den Zellen zu haengen.
      var bd=$('[data-role=shl]',el);
      if(bd)bd.onclick=function(ev){
        var h=ev.target.closest('[data-shlsort]'); if(!h)return;
        var k=h.getAttribute('data-shlsort');
        if(w._sortK===k){ w._sortD=(w._sortD===1)?-1:1; } else { w._sortK=k; w._sortD=(k==='t')?-1:1; }
        _shlPaint(w,el);
      };
      var rf=$('[data-role=shlref]',el); if(rf)rf.onclick=function(){var b=$('[data-role=shl]',el);if(b)b.innerHTML='<div class="shl-empty">lädt …</div>';_shlLoad(w,el);};
    }
  function _shlLoad(w, el){ _shlFetch(w, function(){ _shlPaint(w, el); }); }
  defWidget('log',{
    label:'Log · Entscheidungen', cat:'HomeSuite', paletteIcon:'wlist', size:[1040,720],
    defaults:function(w){w.max=300;},
    render:function(w){
      return '<div class="shl">'
        + '<div class="shl-head"><div class="shl-ttl">'
        + (_shlAlle(w) ? 'Entscheidungen · alle Domänen' : 'Beschattung · Entscheidungen &amp; Befehle') + '</div>'
        + (_shlAlle(w) ? '<select class="shl-room" data-role="shldom"><option value="">Alle Domänen</option></select>' : '')
        + '<input class="shl-q" data-role="shlq" type="search" placeholder="suchen …">'
        + '<select class="shl-room" data-role="shlroom"><option value="">Alle Räume</option></select>'
        + '<button class="shl-ref" data-role="shlref" title="Aktualisieren">↻</button></div>'
        + '<div class="shl-body" data-role="shl"><div class="shl-empty">lädt …</div></div></div>';
    },
    // Bedienung MUSS aus mount heraus verdrahtet werden. '_bind' ist kein
    // Lebenszyklus-Hook des Widget-Vertrags, sondern wird nur von der
    // Familien-Mechanik (hfEmit) gerufen - fuer dieses Widget also von niemandem.
    // Deshalb waren Raumfilter und Auffrisch-Knopf seit jeher ohne Wirkung; aufgefallen
    // ist es erst, als Suche, Sortierung und Domaenenfilter dazukamen und ebenfalls
    // nichts taten. Die Kopfelemente ueberleben das Neuzeichnen (nur der Koerper wird
    // ersetzt), einmal beim Einhaengen genuegt.
    mount:function(w){var el=$('.w[data-id="'+w.id+'"]',canvas); if(el){_shlWire(w,el);_shlLoad(w,el);}},
    _bind:function(w,el){_shlWire(w,el);},
    props:function(w){if(w.type!=='log')return '';
      return row('Quelle','<select id="pShlSrc">'
          +'<option value="shading"'+((w.shlSrc||'shading')==='shading'?' selected':'')+'>nur Beschattung</option>'
          +'<option value="all"'+(w.shlSrc==='all'?' selected':'')+'>alle Domänen</option></select>')
        + row('Max. Einträge','<input id="pShlMax" type="number" min="20" max="1000" step="20" value="'+(w.max||300)+'">')
        +'<div style="font-size:11px;color:var(--muted);margin:4px 2px">Mit \u201ealle Dom\u00e4nen\u201c stehen hier die Entscheidungen von Heizung, Bew\u00e4sserung, Klima und Lichtautomatik nebeneinander \u2013 jeweils mit Grund und der Markierung, ob ausgef\u00fchrt oder nur berechnet (Schatten). Sonst: Gesamtlog aller Rollos (Automatik-Entscheidungen + manuelle Befehle) über den Hub. Nur echte Fahrten; Schatten-Modus wird markiert.</div>';
    },
    wire:function(w){ if($('#pShlMax'))$('#pShlMax').oninput=function(){w.max=Math.max(20,Math.min(1000,parseInt(this.value)||300));commit();};
      if($('#pShlSrc'))$('#pShlSrc').onchange=function(){w.shlSrc=(this.value==='all')?'all':undefined;w._log=null;w._room='';commit();}; }
  });
  // Periodischer Refresh (wie msglog): alle laufenden log-Widgets neu laden.
  setInterval(function(){
    if(typeof state==='undefined'||!state.widgets) return;
    if(typeof mode!=='undefined'&&mode==='edit') return;
    document.querySelectorAll('.w.t-log').forEach(function(el){
      var id=el.getAttribute('data-id'); var w=(typeof widget==='function')?widget(id):null; if(w)_shlLoad(w,el);
    });
  }, 30000);
