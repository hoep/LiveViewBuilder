  // ===== LVB.panel — geteilte Verhaltensbasis fuer Panel-/Familien-Widgets (HomeSuite M0.5) =====
  //
  //  Die "echte Einmal-Luecke" aus der Spec: Poll-/Refresh-Manager + Fetch-Cache mit Coalescing
  //  + Loading/Error/DOKU-State-Konvention + Session-Pub/Sub. Domaenenneutral — traegt shadex,
  //  Heizung und spaeter Audio (Reflect-Poll). Kein Widget baut diese Mechanik mehr selbst nach.
  //
  //  Nutzung (Beispiel in einem Widget):
  //    var un = LVB.panel.subscribe('room:'+w.id, w.id, function(){ repaint(); });   // mount
  //    LVB.panel.fetch('?api=mod&op=state&id='+iid, 4000, false, function(err,data){ ... });
  //    LVB.panel.startPoll('span:'+w.id, 7000, tick, function(){ return dragging; });
  //    ... un(); LVB.panel.stopPoll('span:'+w.id);                                   // unmount

  var LVB = (typeof LVB !== 'undefined' && LVB) ? LVB : {};

  (function(){
    var _cache = {};   // url -> {ts, data}    (TTL-Cache)
    var _wait  = {};   // url -> [cb...]       (Request-Coalescing: N Widgets, 1 Request)
    var _subs  = {};   // topic -> {id: fn}    (Session-Pub/Sub)
    var _polls = {};   // pollId -> {timer}    (Poll-Manager)

    // --- Fetch mit TTL-Cache + Coalescing. cb(err,data). force umgeht den Cache. ---
    function fetchJSON(url, ttlMs, force, cb){
      var now = Date.now(), c = _cache[url];
      if(!force && c && (now - c.ts) < (ttlMs||0)){ if(cb) cb(null, c.data); return; }
      if(_wait[url]){ if(cb) _wait[url].push(cb); return; }          // schon unterwegs -> anhaengen
      _wait[url] = cb ? [cb] : [];
      fetch(url, {cache:'no-store'}).then(function(r){ return r.json(); }).then(function(j){
        _cache[url] = {ts: Date.now(), data: j};
        var q = _wait[url]; delete _wait[url];
        q.forEach(function(f){ try{ f(null, j); }catch(e){} });
      }).catch(function(e){
        var q = _wait[url] || []; delete _wait[url];
        q.forEach(function(f){ try{ f(e); }catch(_e){} });
      });
    }
    function invalidate(url){ if(url) delete _cache[url]; else _cache = {}; }

    // --- Session-Pub/Sub. subscribe() liefert eine Unsubscribe-Funktion. ---
    function subscribe(topic, id, fn){
      (_subs[topic] || (_subs[topic] = {}))[id] = fn;
      return function(){ if(_subs[topic]) delete _subs[topic][id]; };
    }
    function publish(topic, payload){
      var s = _subs[topic]; if(!s) return;
      Object.keys(s).forEach(function(id){ try{ s[id](payload); }catch(e){} });
    }

    // --- Poll-Manager: periodisch fn(), aber NICHT bei verborgenem Tab, laufender
    //     Interaktion (activeElement im Element) oder aktivem Guard; im DOKU nie. ---
    function startPoll(pollId, ms, fn, guard){
      stopPoll(pollId);
      if(typeof DOKU !== 'undefined' && DOKU) return;                // Doku/Demo: keine Live-Polls
      var t = setInterval(function(){
        if(typeof document !== 'undefined' && document.hidden) return;
        if(guard){ try{ if(guard()) return; }catch(e){} }
        try{ fn(); }catch(e){}
      }, ms|0);
      _polls[pollId] = {timer: t};
    }
    function stopPoll(pollId){ var p = _polls[pollId]; if(p){ clearInterval(p.timer); delete _polls[pollId]; } }
    // Guard-Helfer: true, solange der Nutzer im Element el interagiert (Fokus/Eingabe).
    function busy(el){ return !!(el && document.activeElement && el.contains && el.contains(document.activeElement)); }

    // --- Einheitliche Zustands-Boxen (Loading/Error/leer). ---
    function stateBox(kind, msg){
      var e = (typeof esc === 'function') ? esc : function(s){ return String(s); };
      return '<div class="lvbp-state lvbp-' + kind + '">' + e(msg || '') + '</div>';
    }

    // --- DOKU/RUN-Schreibguard: im Doku nie Schreib-Ops (schuetzt das Live-Layout). ---
    function canWrite(){ return !(typeof DOKU !== 'undefined' && DOKU); }

    LVB.panel = {
      fetch: fetchJSON, invalidate: invalidate,
      subscribe: subscribe, publish: publish,
      startPoll: startPoll, stopPoll: stopPoll, busy: busy,
      stateBox: stateBox, canWrite: canWrite
    };
  })();

  // Namespace beobachtbar exportieren, damit der Minifier die (noch ungenutzte)
  // Verhaltensbasis nicht als toten Code entfernt — und fuer Debug in DevTools.
  if (typeof window !== 'undefined') { window.LVB = LVB; }

