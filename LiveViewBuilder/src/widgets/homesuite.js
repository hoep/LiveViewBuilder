  // ===== Widget: HomeSuite Suite-Übersicht (homesuite) =====
  //
  //  Erstes manifest-getriebenes Widget der neuen Modul-Suite. Holt über den
  //  generischen Transport ?api=mod&op=suite (via LVB.panel: Fetch-Cache +
  //  Poll-Manager) das Aggregat-Manifest des Hubs und rendert Hub-Status +
  //  Entitäten GENERISCH — unabhängig von der Domäne (Heizung/Beschattung/
  //  Audio/Bewässerung). Detail-/Control-Rendering folgt, sobald Domänen-Module
  //  existieren; hier ist die Übersicht + der Datenweg das Ziel.

  (function(){
    // Demo-Aggregat in der EXAKTEN Live-Form von HSH_GetSuiteManifest (verifiziert:
    // {ok, hub:{instanceId,hookPath,entityCount}, entities:[...]}).
    function hsDemo(){
      return { ok:true, entities:[
        { instanceID:12001, domain:'heating',    name:'Wohnzimmer' },
        { instanceID:12002, domain:'shading',    name:'Büro'       },
        { instanceID:12003, domain:'audio',      name:'Küche'      },
        { instanceID:12004, domain:'irrigation', name:'Rasen'      }
      ] };
    }
    var _hs = {};                                   // je Widget-ID: {data, err}
    function hsSt(w){ return _hs[w.id] || (_hs[w.id] = { data:null, err:'' }); }

    function hsRender(w){
      var st = hsSt(w);
      var data = (typeof DOKU !== 'undefined' && DOKU) ? hsDemo() : st.data;
      if (!data)          return LVB.panel.stateBox('loading', 'HomeSuite lädt …');
      if (data.ok === false) return LVB.panel.stateBox('error',
        data.err === 'no-hub' ? 'Kein HomeSuite-Hub angelegt (Konsole → Instanz „HomeSuite Hub").'
                              : ('HomeSuite nicht erreichbar (' + esc(String(data.err || '?')) + ').'));
      var ents = data.entities || [];
      // Eigener senkrechter Scrollcontainer (die Kachel selbst soll waagrecht ruhig bleiben)
      // und Grundschrift aus der Kachelgroesse.
      var h = '<div class="hs" style="height:100%;overflow:auto;font-size:clamp(11px,3cqmin,15px)"><div class="hs-head"><b>' + escL(w.label || 'HomeSuite') + '</b>'
            + '<span class="hs-sub">' + ents.length + ' Entität' + (ents.length === 1 ? '' : 'en') + '</span></div>';
      if (!ents.length) {
        h += LVB.panel.stateBox('empty', 'Noch keine Entitäten. Im Verwaltungs-Bereich anlegen (Heizung/Beschattung/Audio/Bewässerung).');
      } else {
        // Kartenraster aus der Kachel: auf schmalen Kacheln eine Spalte, auf breiten mehrere -
        // ohne feste Mindestbreite, die auf dem Handy ueber den Rand laufen wuerde.
        h += '<div class="hs-grid" style="grid-template-columns:repeat(auto-fill,minmax(clamp(112px,34cqmin,190px),1fr));gap:clamp(5px,2.5cqmin,10px)">';
        ents.forEach(function(e){
          var eid = e.instanceID || e.id || '';
          h += '<div class="hs-card" data-domain="' + esc(e.domain || '') + '" data-eid="' + esc(String(eid)) + '">'
             + '<span class="hs-dot"></span>'
             + '<span class="hs-name">' + esc(e.name || ('#' + eid)) + '</span>'
             + '<span class="hs-dom">' + esc(e.domain || '') + '</span>'
             + '<span class="hs-mode">#' + esc(String(eid)) + '</span>'
             + '</div>';
        });
        h += '</div>';
      }
      return h + '</div>';
    }

    function hsEl(w){ return $('.w[data-id="' + w.id + '"]', canvas) || $('.w[data-id="' + w.id + '"]', $('#ovcanvas')); }
    function hsRepaint(w){ var el = hsEl(w); if (!el) return; var host = el.querySelector('.winner') || el; host.innerHTML = hsRender(w); }

    defWidget('homesuite', {
      label:'HomeSuite', cat:'HomeSuite', paletteIcon:'gear', size:[440, 280],
      defaults:function(w){ w.label = 'HomeSuite'; },
      render:function(w){ return hsRender(w); },
      mount:function(w){
        if (typeof DOKU !== 'undefined' && DOKU) return;           // Doku: statische Demo, kein Fetch
        var st = hsSt(w);
        function load(){
          // op=entities ist ein LESE-Endpunkt (kein Token). LVB.panel coalesced + cached.
          LVB.panel.fetch('?api=mod&op=entities', 4000, false, function(err, data){
            st.data = err ? { ok:false, err:'net' } : data;
            hsRepaint(w);
          });
        }
        load();
        LVB.panel.startPoll('homesuite:' + w.id, 8000, load);      // Poll-Manager (Sichtbarkeits-/DOKU-Guard)
      }
    });
  })();
