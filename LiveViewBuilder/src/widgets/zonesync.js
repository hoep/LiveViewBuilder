  // ===== Widget: Zonen-Sync (zonesync) — Geräteprogramm ⟷ Modul =====
  //
  //  Kleines, DOMÄNEN-AGNOSTISCHES Widget: zeigt den Sync-Status einer Entität
  //  (Modul-Wochenplan ⟷ Live-Geräteprogramm) und bietet „Vom Gerät laden" /
  //  „Ans Gerät schreiben". Nutzt die generischen Basis-Ops jeder HomeSuite-
  //  Entität (syncStatus/loadFromDevice/syncToDevice über ?api=mod&op=manage) —
  //  funktioniert für Heizung, später Beschattung usw. gleichermaßen.
  //
  //  Bindung: feste Zone (w.entityId, für Live-View/Raum-Karten) ODER Session
  //  (folgt der gerade gewählten Zone der heatplan-Familie, gleiche Session-ID).
  //  Bei controller-Zonen (kein Geräteprogramm) -> „Modul steuert laufend".

  (function(){
    var _zs={};
    function zsSt(w){return _zs[w.id]||(_zs[w.id]={status:null,err:'',busy:false});}
    function zsEntity(w){
      if((w.bind==='session') && typeof hfSess==='function'){ var s=hfSess({session:w.session||'heat'}); return (s&&s.roomIdx)||0; }
      return parseInt(w.entityId||0)||0;
    }
    function zsMg(idx,op){ return fetch('?api=mod&op=manage&id='+idx+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:op})}).then(function(r){return r.json();}); }

    function zsRender(w){
      var st=zsSt(w);
      var d=(typeof DOKU!=='undefined'&&DOKU)?{applicable:true,synced:false,mode:'device',variant:'Normal'}:st.status;
      var idx=zsEntity(w);
      if(!idx && !(typeof DOKU!=='undefined'&&DOKU)) return '<div class="zsync"><span class="zsync-chip zsync-na">Keine Zone gebunden</span></div>';
      if(!d) return '<div class="zsync"><span class="zsync-chip zsync-na">Sync …</span></div>';
      if(d.ok===false||st.err) return '<div class="zsync"><span class="zsync-chip zsync-diff">nicht erreichbar</span></div>';
      if(d.applicable===false) return '<div class="zsync"><span class="zsync-chip zsync-na">Modul steuert laufend</span></div>';
      var ok=!!d.synced;
      var acc=(w.accent?(_skinColor(w.accent)||w.accent):'');
      var h='<div class="zsync"'+(acc?' style="--accent:'+esc(acc)+'"':'')+'>'
        +'<span class="zsync-chip '+(ok?'zsync-ok':'zsync-diff')+'">'+(ok?'&#10003; synchron':'&#8891; abweichend')+(d.variant?' &middot; '+escL(d.variant):'')+'</span>'
        +'<button type="button" class="zsync-btn" data-zsload title="Aktuelles Geräteprogramm in den Editor laden">&#8595; Vom Gerät</button>'
        +'<button type="button" class="zsync-btn'+(ok?'':' zsync-hot')+'" data-zswrite title="Modul-Plan ans Gerät schreiben (Backup/Verify)">&#8593; Ans Gerät</button>'
        +(st.busy?'<span class="zsync-busy">…</span>':'')+'</div>';
      return h;
    }
    function zsEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function zsPaint(w){var el=zsEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=zsRender(w);zsBind(w,el);}
    function zsLoad(w){ if(typeof DOKU!=='undefined'&&DOKU){zsPaint(w);return;} var idx=zsEntity(w),st=zsSt(w);
      if(!idx){zsPaint(w);return;}
      zsMg(idx,'syncStatus').then(function(j){st.status=j;st.err='';zsPaint(w);}).catch(function(){st.err='net';zsPaint(w);}); }
    function zsBind(w,el){
      if(typeof DOKU!=='undefined'&&DOKU)return;
      var st=zsSt(w),idx=zsEntity(w);
      var lb=$('[data-zsload]',el); if(lb)lb.onclick=function(ev){ev.stopPropagation();if(!idx)return;st.busy=true;zsPaint(w);
        zsMg(idx,'loadFromDevice').then(function(j){toast(j&&j.ok?'Vom Gerät geladen':'Laden fehlgeschlagen');st.busy=false;zsLoad(w);
          if(typeof hfEmit==='function'&&w.bind==='session')hfEmit({session:w.session||'heat',id:w.id});}).catch(function(){st.busy=false;toast('Laden: Verbindungsfehler');zsPaint(w);});};
      var wb=$('[data-zswrite]',el); if(wb)wb.onclick=function(ev){ev.stopPropagation();if(!idx)return;st.busy=true;zsPaint(w);
        zsMg(idx,'syncToDevice').then(function(j){toast(j&&j.wrote?'Ans Gerät geschrieben':'Schreiben fehlgeschlagen');st.busy=false;zsLoad(w);}).catch(function(){st.busy=false;toast('Schreiben: Verbindungsfehler');zsPaint(w);});};
    }

    defWidget('zonesync',{
      label:'Zonen-Sync', cat:'HomeSuite · Zeitplan (Heizung/Beschattung)', paletteIcon:'thermostat', size:[320,44],
      defaults:function(w){w.bind='session';w.session='heat';},
      render:function(w){return zsRender(w);},
      mount:function(w){var el=zsEl(w);if(!el)return;zsLoad(w);
        LVB.panel.startPoll('zonesync:'+w.id,20000,function(){zsLoad(w);}); zsBind(w,el);},
      props:function(w){
        var h='<div class="pgh">Bindung</div>';
        h+=row('Modus','<select id="zsBind"><option value="session"'+(w.bind!=='fixed'?' selected':'')+'>Session (folgt Auswahl)</option><option value="fixed"'+(w.bind==='fixed'?' selected':'')+'>Feste Zone</option></select>');
        if(w.bind!=='fixed'){ h+=row('Session-ID','<input id="zsSess" value="'+esc(w.session||'heat')+'" placeholder="heat">'); }
        else { h+=row('Zone (Instanz-ID)','<input id="zsEnt" type="number" value="'+(w.entityId||'')+'" placeholder="z. B. 15674" style="width:130px">'); }
        h+='<div class="pgh">Darstellung</div>';
        h+=row('Akzentfarbe',skinSel(w.accent||'','id="zsAcc"'));
        return h;
      },
      wire:function(w){
        if($('#zsBind'))$('#zsBind').onchange=function(){w.bind=this.value;commit();renderProps();var el=zsEl(w);if(el)zsLoad(w);};
        if($('#zsSess'))$('#zsSess').onchange=function(){w.session=this.value||undefined;commit();var el=zsEl(w);if(el)zsLoad(w);};
        if($('#zsEnt'))$('#zsEnt').onchange=function(){w.entityId=parseInt(this.value)||undefined;commit();var el=zsEl(w);if(el)zsLoad(w);};
        if($('#zsAcc'))$('#zsAcc').onchange=function(){w.accent=this.value||undefined;commit();var el=zsEl(w);if(el)zsPaint(w);};
      }
    });
  })();
