  // ===== Widget: Rollo-Kalibrierung (shadecal) — geführter Stepper =====
  //
  //  Misst die echte Fahrzeit eines Somfy-Rollos (kein Positions-Feedback) und übernimmt sie in
  //  die ShadingDevice-Einstellungen (TimeOpening/TimeClosing). Ablauf je Richtung:
  //    1 Richtung (Auf/Zu)  2 Start (rohes Fahren)  3 Stop (bei erreichter Endlage)  4 Übernehmen.
  //  Bindung wie shadesun/suncompass: SESSION (folgt der Rollo-Auswahl der shadex-Familie) ODER feste
  //  Zone (HSSH-Instanz-ID). idx = HSSH-Instanz-ID; Backend: ?api=shading&op=calmove|calstop|calsettime
  //  (Token) + op=caltimes (frei, Ist-Zeiten).

  (function(){
    var _scal = {};   // je Widget-ID: Laufzeitzustand
    function scSt(w){return _scal[w.id]||(_scal[w.id]={dir:'down',phase:'idle',ms:0,t0:0,timer:null,cur:null,idx:0});}
    function scFmt(ms){return (Math.max(0,ms)/1000).toFixed(1).replace('.',',');}
    function scEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    // Rollo (HSSH-Instanz) bestimmen: Session (folgt der Auswahl) oder feste Zone.
    function scEntity(w){
      if((w.bind!=='fixed') && typeof hfSess==='function'){var s=hfSess({session:w.session||'shade'});return (s&&s.roomIdx)||0;}
      return parseInt(w.entityId||0)||0;
    }

    function scLoadTimes(w){var st=scSt(w),idx=scEntity(w);st.idx=idx;
      if(typeof DOKU!=='undefined'&&DOKU){st.cur={o:11,c:12};scRepaint(w);return;}
      if(!idx){st.cur=null;scRepaint(w);return;}
      fetch('?api=shading&op=caltimes&id='+idx,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        st.cur=(j&&j.ok)?{o:j.timeOpening|0,c:j.timeClosing|0}:{o:0,c:0};scRepaint(w);}).catch(function(){st.cur={o:0,c:0};scRepaint(w);});
    }
    function scCall(op,extra){return fetch('?api=shading&op='+op+'&key='+encodeURIComponent(TOKEN)+(extra||''),{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return{ok:false};});}

    // ============================ RENDER ============================
    var SC_STEPS=[['1','Richtung'],['2','Start'],['3','Stop'],['4','Übern.']];
    function scStepIdx(ph){return ph==='idle'?1:(ph==='running'?2:3);}
    function scRender(w){
      var st=scSt(w),dir=st.dir,dirLbl=(dir==='up')?'Auf':'Zu',doku=(typeof DOKU!=='undefined'&&DOKU),idx=scEntity(w);
      if(!idx&&!doku)return '<div class="scal"><div class="scal-msg">Kein Rollo gebunden</div></div>';
      var stepDone=scStepIdx(st.phase),steps='';
      SC_STEPS.forEach(function(s,i){
        var cls=(i<stepDone)?'done':((i===stepDone)?'on':'');
        var inner=(i<stepDone)?'<svg viewBox="0 0 24 24" class="sck"><path d="M20 6L9 17l-5-5"/></svg>':s[0];
        steps+='<span class="scal-st '+cls+'"><span class="scal-n">'+inner+'</span>'+esc(s[1])+'</span>'+(i<3?'<span class="scal-ln'+(i<stepDone?' done':'')+'"></span>':'');
      });
      var h='<div class="scal">';
      h+='<div class="scal-hd"><span class="scal-tit">Kalibrierung · '+esc(dirLbl)+'</span><span class="scal-dev">'+escL(w.label||'')+'</span></div>';
      h+='<div class="scal-steps">'+steps+'</div>';
      if(st.phase==='idle'){
        h+='<div class="scal-body">'
          +'<div class="scal-seg"><button data-scdir="up"'+(dir==='up'?' class="on"':'')+'><svg viewBox="0 0 24 24" class="sci"><path d="M18 15l-6-6-6 6"/></svg>Auf</button>'
          +'<button data-scdir="down"'+(dir==='down'?' class="on"':'')+'><svg viewBox="0 0 24 24" class="sci"><path d="M6 9l6 6 6-6"/></svg>Zu</button></div>'
          +'<button class="scal-act start" data-scstart="1"><svg viewBox="0 0 24 24" class="sci"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>Start</button></div>';
      } else if(st.phase==='running'){
        h+='<div class="scal-body scal-run"><span class="scal-tmr" data-role="tmr">'+scFmt(st.ms)+'<span class="u">s</span></span>'
          +'<button class="scal-act stop" data-scstop="1"><svg viewBox="0 0 24 24" class="sci"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/></svg>Stop</button></div>';
      } else {
        // Zwei ausdrueckliche Abschluesse: beide geben im Modul den Kalibrier-Lock UND
        // die manuelle Sperre wieder frei (Speichern uebernimmt die Zeit, Abbrechen nicht).
        h+='<div class="scal-body scal-run"><span class="scal-tmr done">'+scFmt(st.ms)+'<span class="u">s</span></span>'
          +'<button class="scal-take" data-sctake="1"'+(st.busy?' disabled':'')+'><svg viewBox="0 0 24 24" class="sci"><path d="M20 6L9 17l-5-5"/></svg>Speichern</button>'
          +'<button class="scal-cancel" data-screset="1"'+(st.busy?' disabled':'')+'><svg viewBox="0 0 24 24" class="sci"><path d="M18 6 6 18M6 6l12 12"/></svg>Abbrechen</button></div>';
      }
      if(st.cur){h+='<div class="scal-cur">Gespeichert: <b'+(dir==='up'?' class="hl"':'')+'>Auf '+(st.cur.o||'–')+' s</b> · <b'+(dir==='down'?' class="hl"':'')+'>Zu '+(st.cur.c||'–')+' s</b></div>';}
      h+='</div>';
      return h;
    }
    function scRepaint(w){var el=scEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=scRender(w);scBind(w,el);}
    function scTick(w,el){var st=scSt(w);st.ms=Date.now()-st.t0;var t=$('[data-role=tmr]',el);if(t)t.innerHTML=scFmt(st.ms)+'<span class="u">s</span>';}

    function scBind(w,el){var st=scSt(w);
      $$('[data-scdir]',el).forEach(function(b){b.onclick=function(){st.dir=b.getAttribute('data-scdir');st.phase='idle';scRepaint(w);};});
      var sb=$('[data-scstart]',el);if(sb)sb.onclick=function(){var idx=scEntity(w);
        if(typeof DOKU!=='undefined'&&DOKU){st.phase='running';st.t0=Date.now();st.ms=0;scRepaint(w);st.timer=setInterval(function(){scTick(w,el);},100);return;}
        if(!idx){toast('Kein Rollo gewählt');return;}
        sb.disabled=true;
        scCall('calmove','&id='+idx+'&dir='+st.dir).then(function(j){
          if(!j||!j.ok){toast('Fahren fehlgeschlagen'+(j&&j.err?': '+j.err:''));sb.disabled=false;return;}
          st.phase='running';st.t0=Date.now();st.ms=0;scRepaint(w);st.timer=setInterval(function(){scTick(w,el);},100);});
      };
      var stp=$('[data-scstop]',el);if(stp)stp.onclick=function(){var idx=scEntity(w);
        if(st.timer){clearInterval(st.timer);st.timer=null;}st.ms=Date.now()-st.t0;
        if(typeof DOKU!=='undefined'&&DOKU){st.phase='stopped';scRepaint(w);return;}
        stp.disabled=true;scCall('calstop','&id='+idx).then(function(){st.phase='stopped';scRepaint(w);});
      };
      var tk=$('[data-sctake]',el);if(tk)tk.onclick=function(){var idx=scEntity(w),sec=Math.max(1,Math.round(st.ms/1000));st.busy=true;scRepaint(w);
        if(typeof DOKU!=='undefined'&&DOKU){if(st.dir==='up')st.cur.o=sec;else st.cur.c=sec;st.busy=false;st.phase='idle';toast('Übernommen: '+sec+' s');scRepaint(w);return;}
        scCall('calsettime','&id='+idx+'&dir='+st.dir+'&sec='+sec).then(function(j){
          st.busy=false;
          if(j&&j.ok){st.cur={o:j.timeOpening|0,c:j.timeClosing|0};st.phase='idle';toast('Fahrzeit '+(st.dir==='up'?'Auf':'Zu')+' = '+sec+' s übernommen');}
          else{toast('Übernehmen fehlgeschlagen');}
          scRepaint(w);});
      };
      // Verwerfen: muss auch SERVERSEITIG abbrechen, sonst bleibt der Kalibrier-Lock
      // im Modul stehen und die Automatik ist bis zum Timeout gesperrt.
      var rs=$('[data-screset]',el);if(rs)rs.onclick=function(){var idx=scEntity(w);
        if(st.timer){clearInterval(st.timer);st.timer=null;}
        if(typeof DOKU!=='undefined'&&DOKU){st.phase='idle';st.ms=0;scRepaint(w);return;}
        st.busy=true;scRepaint(w);
        scCall('calabort','&id='+idx).then(function(j){st.busy=false;st.phase='idle';st.ms=0;
          toast((j&&j.ok)?'Kalibrierung abgebrochen · Automatik wieder frei':'Abbrechen fehlgeschlagen');
          scLoadTimes(w);});};
    }

    // ============================ WIDGET ============================
    defWidget('shadecal',{
      label:'Rollo-Kalibrierung', cat:'HomeSuite · Beschattung', paletteIcon:'cover', size:[280,150],
      defaults:function(w){w.label='';w.bind='session';w.session='shade';w.domain='shading';},
      render:function(w){return scRender(w);},
      mount:function(w){var el=scEl(w);if(!el)return;
        if(typeof DOKU!=='undefined'&&DOKU){scLoadTimes(w);return;}
        if(w.bind!=='fixed'){
          w.domain='shading';w.hsMode=true;              // shade-Session korrekt laden (nicht Heizung)
          if(typeof hfSub==='function')hfSub(w);         // an die shade-Session koppeln (folgt der Rollo-Auswahl)
          if(typeof hfEnsure==='function')hfEnsure(w,el);// Session laden + erstes Rollo setzen -> sofort ein Rollo (wie suncompass mit Selektor)
          else scLoadTimes(w);
        } else scLoadTimes(w);},
      _bind:function(w){var st=scSt(w);st.phase='idle';st.ms=0;if(st.timer){clearInterval(st.timer);st.timer=null;}scLoadTimes(w);}, // Familie wechselt/laedt Rollo -> Zeiten neu laden
      props:function(w){return scProps(w);},
      wire:function(w){scWire(w);}
    });

    function scProps(w){
      var h='<div class="pgh">Bindung</div>';
      h+=row('Modus','<select id="scBind"><option value="session"'+(w.bind!=='fixed'?' selected':'')+'>Session (folgt Auswahl)</option><option value="fixed"'+(w.bind==='fixed'?' selected':'')+'>Feste Zone</option></select>');
      if(w.bind!=='fixed'){ h+=row('Session-ID','<input id="scSess" value="'+esc(w.session||'shade')+'" placeholder="shade">'); }
      else { h+=row('Zone (Instanz-ID)','<input id="scEnt" type="number" value="'+(w.entityId||'')+'" placeholder="z. B. 25258">'); }
      h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Wie beim Sonnenstands-Widget: „Session" folgt der Rollo-Auswahl der Beschattungs-Familie. Nur Somfy-Rollos (ohne Positions-Feedback). „Übernehmen" schreibt die Fahrzeit AUF/ZU in die ShadingDevice-Einstellungen.</div>';
      return h;
    }
    function scWire(w){
      if($('#scBind'))$('#scBind').onchange=function(){w.bind=this.value;commit();renderProps();scLoadTimes(w);};
      if($('#scSess'))$('#scSess').onchange=function(){w.session=this.value||undefined;commit();scLoadTimes(w);};
      if($('#scEnt'))$('#scEnt').onchange=function(){w.entityId=parseInt(this.value)||undefined;commit();scLoadTimes(w);};
    }
  })();
