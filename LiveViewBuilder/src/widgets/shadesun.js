  // ===== Widget: Sonnenstand (shadesun) — Sonnenstand VS. Fassaden-Profil =====
  //
  //  Zeigt den LIVE-Sonnenstand (Azimut/Elevation aus Location #13098) gegen das
  //  Sonnenstands-Profil (geoProfile) EINER Beschattungs-Zone als Balken — damit man
  //  falsche Configs SOFORT sieht: liegt die Sonne je im Azimut-Fenster? kommt sie ueber
  //  die Elevations-/Helligkeitsschwelle? Datenquelle: ?api=mod reconcileProbe (read-only).
  //  Bindung: feste Zone (entityId) ODER Session (folgt der shadex-Familie, gleiche Session).

  (function(){
    // Groessen-Overrides aus der Kachelgroesse (.w hat container-type:size).
    // Warum hier und nicht in styles.css: die .ssun*-Regeln dort stehen noch durchgehend
    // auf festen Pixeln (Label-/Wertspalte 42/40 px, Balkenhoehe 16 px, Schriften 9–21 px)
    // und brechen damit bei halber Kachelgroesse. styles.css gehoert nicht zu diesem
    // Auftrags-Buendel, deshalb hier gezielte Einzel-Overrides je Element (nur Geometrie,
    // kein Verhalten). Sobald styles.css nachzieht, koennen sie ersatzlos raus.
    var SS_BOX  = 'font-size:clamp(10px,3.4cqmin,16px);padding:clamp(7px,4cqmin,16px) clamp(8px,4.5cqmin,18px);gap:clamp(4px,2.4cqmin,10px)';
    var SS_LBLW = 'clamp(30px,12cqmin,58px)';                  // Label-Spalte, war fix 42px
    var SS_VALW = 'clamp(28px,11cqmin,54px)';                  // Wertspalte,   war fix 40px
    var SS_TRK  = 'height:clamp(12px,5cqmin,22px)';            // Balkenhoehe,  war fix 16px
    var SS_HINT = 'margin-left:calc('+SS_LBLW+' + 8px)';       // Hinweis buendig unter dem Balken (Label + row-gap)
    var _ss={};
    function ssSt(w){return _ss[w.id]||(_ss[w.id]={d:null,err:''});}
    function ssEntity(w){
      if((w.bind==='session') && typeof hfSess==='function'){var s=hfSess({session:w.session||'shade'});return (s&&s.roomIdx)||0;}
      return parseInt(w.entityId||0)||0;
    }
    function ssMg(idx){return fetch('?api=mod&op=manage&id='+idx+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:'reconcileProbe'})}).then(function(r){return r.json();});}
    function ssHub(op,args){return fetch('?api=mod&op=hubmanage&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:op,args:args||{}})}).then(function(r){return r.json();});}
    function ssDemo(){return {inputs:{az:212,el:9,bright:2600},geoProfile:{azimuthBgn:109,azimuthEnd:289,elevation:8,brightnessMin:0,closePct:75},rawSun:75};}
    // Schließgrad live setzen (Slider/Presets): Label + Fill + Presets + debounced setclose.
    function ssApplyClose(w,el,v){
      v=Math.max(0,Math.min(100,parseInt(v)||0));
      var lbl=el.querySelector('[data-role=cpv]');if(lbl)lbl.innerHTML=v+' %';
      var sl=el.querySelector('[data-role=cpslider]');if(sl){sl.value=v;sl.style.background='linear-gradient(90deg,var(--accent) 0 '+v+'%,var(--surface-2) '+v+'% 100%)';}
      var ps=el.querySelector('[data-role=cppresets]');if(ps)ps.querySelectorAll('[data-cp]').forEach(function(b){b.classList.toggle('on',parseInt(b.getAttribute('data-cp'))===v);});
      var st=ssSt(w);if(st.d&&st.d.geoProfile)st.d.geoProfile.closePct=v;
      if(typeof DOKU!=='undefined'&&DOKU)return;
      var idx=ssEntity(w);if(!idx)return;
      clearTimeout(w._ccT);w._ccT=setTimeout(function(){
        fetch('?api=shading&op=setclose&id='+idx+'&pct='+v+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'}).catch(function(){});
      },300);
    }

    function inAz(az,a,b){ if(a==null||b==null)return true; return (a<=b)?(az>=a&&az<=b):(az>=a||az<=b); }
    function bar(pct){return Math.max(0,Math.min(100,pct));}

    function ssRender(w){
      var st=ssSt(w), doku=(typeof DOKU!=='undefined'&&DOKU);
      var d=doku?ssDemo():st.d, idx=ssEntity(w);
      if(!idx && !doku) return '<div class="ssun"><div class="ssun-msg">Kein Rollo gebunden</div></div>';
      if(st.err) return '<div class="ssun"><div class="ssun-msg">nicht erreichbar</div></div>';
      if(!d) return '<div class="ssun"><div class="ssun-msg">Sonnenstand …</div></div>';
      if(d.driverActive===false) return '<div class="ssun"><div class="ssun-msg">Zone ohne Treiber</div></div>';
      var inp=d.inputs||{}, gp=d.geoProfile||null;
      var az=(inp.az==null?null:+inp.az), el=(inp.el==null?null:+inp.el), br=(inp.bright==null?null:+inp.bright);
      if(!gp) return '<div class="ssun"><div class="ssun-msg">Kein Sonnenstands-Profil gesetzt<br><span class="ssun-sub">im Editor „Sonne" konfigurieren</span></div></div>';
      var aBgn=gp.azimuthBgn, aEnd=gp.azimuthEnd, elMin=(gp.elevation==null?0:+gp.elevation), brMin=(gp.brightnessMin==null?0:+gp.brightnessMin);
      var isAz=(az!=null)&&inAz(az,aBgn,aEnd), isEl=(el!=null)&&el>=elMin, isBr=(br==null)||br>=brMin;
      var active=isAz&&isEl&&isBr; // Beschattung wuerde greifen
      var elMax=(w.elMax>0?+w.elMax:70); // Anzeige-Bereich Elevation (einstellbar)
      var acc=(w.accent?(_skinColor(w.accent)||w.accent):'');
      var h='<div class="ssun" style="'+SS_BOX+(acc?';--accent:'+esc(acc):'')+'">';
      // Status-Kopf (Schließgrad steht jetzt als eigene Karte unten)
      var stTxt = active ? 'Sonne im Fenster'
        : (!isAz ? 'Sonne außerhalb des Fensters' : (!isEl ? 'Sonne zu tief (unter Schwelle)' : 'zu dunkel'));
      h+='<div class="ssun-head"><span class="ssun-chip '+(active?'ssun-on':'ssun-off')+'">'+(active?'☀ aktiv':'○ inaktiv')+'</span><span class="ssun-verdict">'+esc(stTxt)+'</span></div>';

      // Azimut-Balken 0..360 mit Fassaden-Fenster + Sonnen-Marker + N/O/S/W
      function azpos(a){return bar(a/360*100);}
      var winHtml='';
      if(aBgn!=null&&aEnd!=null){
        if(aBgn<=aEnd){ winHtml='<i class="ssun-win" style="left:'+azpos(aBgn)+'%;width:'+bar((aEnd-aBgn)/360*100)+'%"></i>'; }
        else { winHtml='<i class="ssun-win" style="left:'+azpos(aBgn)+'%;width:'+bar((360-aBgn)/360*100)+'%"></i><i class="ssun-win" style="left:0;width:'+azpos(aEnd)+'%"></i>'; }
      }
      h+='<div class="ssun-row"><label style="width:'+SS_LBLW+'">Azimut</label><div class="ssun-track" style="'+SS_TRK+'">'+winHtml
        +[0,90,180,270].map(function(t){return '<span class="ssun-tick" style="left:'+azpos(t)+'%">'+({0:'N',90:'O',180:'S',270:'W'}[t])+'</span>';}).join('')
        +(az!=null?'<i class="ssun-mark'+(isAz?' hit':'')+'" style="left:'+azpos(az)+'%"></i>':'')+'</div>'
        +'<span class="ssun-val" style="width:'+SS_VALW+'">'+(az!=null?Math.round(az)+'°':'–')+'</span></div>';
      h+='<div class="ssun-hint" style="'+SS_HINT+'">Fenster '+(aBgn!=null?Math.round(aBgn):'?')+'–'+(aEnd!=null?Math.round(aEnd):'?')+'°'+(inAz(az,0,360)&&aBgn===0&&aEnd===360?' · ⚠ 0–360 = immer':'')+'</div>';

      // Elevations-Balken 0..elMax mit Schwelle + Sonnen-Marker
      function elpos(e){return bar(e/elMax*100);}
      h+='<div class="ssun-row"><label style="width:'+SS_LBLW+'">Höhe</label><div class="ssun-track" style="'+SS_TRK+'">'
        +'<i class="ssun-thr" style="left:'+elpos(elMin)+'%"></i>'
        +'<i class="ssun-fill'+(isEl?' hit':'')+'" style="width:'+(el!=null?elpos(el):0)+'%"></i>'
        +(el!=null?'<i class="ssun-mark'+(isEl?' hit':'')+'" style="left:'+elpos(el)+'%"></i>':'')+'</div>'
        +'<span class="ssun-val" style="width:'+SS_VALW+'">'+(el!=null?Math.round(el)+'°':'–')+'</span></div>';
      h+='<div class="ssun-hint" style="'+SS_HINT+'">Schwelle ≥ '+Math.round(elMin)+'°'+(elMin<=0?' · ⚠ 0° = keine Schwelle':'')+'</div>';

      // Helligkeit (optional)
      if(brMin>0){
        var brMax=Math.max(brMin*2, br||0, 50000);
        h+='<div class="ssun-row"><label style="width:'+SS_LBLW+'">Hell.</label><div class="ssun-track" style="'+SS_TRK+'">'
          +'<i class="ssun-thr" style="left:'+bar(brMin/brMax*100)+'%"></i>'
          +'<i class="ssun-fill'+(isBr?' hit':'')+'" style="width:'+(br!=null?bar(br/brMax*100):0)+'%"></i></div>'
          +'<span class="ssun-val" style="width:'+SS_VALW+'">'+(br!=null?Math.round(br):'–')+'</span></div>';
        h+='<div class="ssun-hint" style="'+SS_HINT+'">Schwelle ≥ '+Math.round(brMin)+'</div>';
      }
      // ---- Schließgrad dieses Rollos (pro Rollo, bei DIESEM Sonnenprofil) ----
      var cp=(gp.closePct!=null?Math.max(0,Math.min(100,+gp.closePct)):100);
      var pn=doku?'West':(st.profName||'');
      h+='<div class="ssun-clz" style="margin-top:clamp(7px,4cqmin,16px);padding:clamp(8px,3.6cqmin,14px) clamp(9px,4.2cqmin,16px)">'
        +'<div class="ssun-clz-h"><span class="ssun-clz-l">Schließgrad · dieses Rollo'+(pn?(' bei „'+esc(pn)+'"'):'')+'</span><span class="ssun-clz-val" data-role="cpv" style="font-size:clamp(16px,8cqmin,28px)">'+cp+' %</span></div>'
        +'<input class="ssun-clz-slider" type="range" data-role="cpslider" min="0" max="100" step="5" value="'+cp+'" style="height:clamp(5px,2cqmin,10px);background:linear-gradient(90deg,var(--accent) 0 '+cp+'%,var(--surface-2) '+cp+'% 100%)">'
        +'<div class="ssun-clz-presets" data-role="cppresets">'+[50,75,100].map(function(v){return '<button type="button" data-cp="'+v+'"'+(cp===v?' class="on"':'')+' style="min-height:clamp(26px,8cqmin,38px);font-size:clamp(10px,3.2cqmin,14px)">'+v+' %</button>';}).join('')+'</div>'
        +'<div class="ssun-clz-hint">Wie weit <b>dieses Rollo</b> schließt, wenn die Sonne im Fenster steht. Das Profil legt nur das Sonnenfenster fest.</div>'
        +'</div>';
      h+='</div>';
      return h;
    }
    function ssEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function ssPaint(w){var el=ssEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=ssRender(w);}
    function ssLoad(w){ if(typeof DOKU!=='undefined'&&DOKU){ssPaint(w);return;} var idx=ssEntity(w),st=ssSt(w);
      if(!idx){ssPaint(w);return;}
      ssMg(idx).then(function(j){st.d=j;st.err="";
        ssHub('profileAssigned',{entityId:idx}).then(function(a){st.profName=(a&&a.assigned&&a.assigned.sun)||null;ssPaint(w);}).catch(function(){ssPaint(w);});
      }).catch(function(){st.err='net';ssPaint(w);}); }

    defWidget('shadesun',{
      label:'Besonnung', cat:'HomeSuite · Beschattung', paletteIcon:'sun', size:[360,300],
      defaults:function(w){w.bind='session';w.session='shade';},
      render:function(w){return ssRender(w);},
      input:function(w,el,e){var r=e.target.closest('[data-role=cpslider]');if(!r)return false;ssApplyClose(w,el,r.value);return true;},
      click:function(w,el,e){var b=e.target.closest('[data-cp]');if(!b)return false;ssApplyClose(w,el,b.getAttribute('data-cp'));return true;},
      mount:function(w){var el=ssEl(w);if(!el)return;
        if(w.bind!=='fixed' && typeof hfSub==='function')hfSub(w); // an die shadex-Session koppeln
        ssLoad(w);LVB.panel.startPoll('shadesun:'+w.id,30000,function(){ssLoad(w);});},
      _bind:function(w,el){ssLoad(w);}, // von hfEmit gerufen, wenn die Familie die Zone wechselt
      props:function(w){
        var h='<div class="pgh">Bindung</div>';
        h+=row('Modus','<select id="ssBind"><option value="session"'+(w.bind!=='fixed'?' selected':'')+'>Session (folgt Auswahl)</option><option value="fixed"'+(w.bind==='fixed'?' selected':'')+'>Feste Zone</option></select>');
        if(w.bind!=='fixed'){ h+=row('Session-ID','<input id="ssSess" value="'+esc(w.session||'shade')+'" placeholder="shade">'); }
        else { h+=row('Zone (Instanz-ID)','<input id="ssEnt" type="number" value="'+(w.entityId||'')+'" placeholder="z. B. 25258">'); }
        h+='<div class="pgh">Darstellung</div>';
        h+=row('Akzentfarbe',skinSel(w.accent||'','id="ssAcc"'));
        h+=row('Höhe-Achse max','<input id="ssElMax" type="number" value="'+(w.elMax||70)+'" style="width:70px"> °');
        return h;
      },
      wire:function(w){
        if($('#ssBind'))$('#ssBind').onchange=function(){w.bind=this.value;commit();renderProps();var el=ssEl(w);if(el)ssLoad(w);};
        if($('#ssSess'))$('#ssSess').onchange=function(){w.session=this.value||undefined;commit();var el=ssEl(w);if(el)ssLoad(w);};
        if($('#ssEnt'))$('#ssEnt').onchange=function(){w.entityId=parseInt(this.value)||undefined;commit();var el=ssEl(w);if(el)ssLoad(w);};
        if($('#ssAcc'))$('#ssAcc').onchange=function(){w.accent=this.value||undefined;commit();var el=ssEl(w);if(el)ssPaint(w);};
        if($('#ssElMax'))$('#ssElMax').onchange=function(){w.elMax=parseInt(this.value)||undefined;commit();var el=ssEl(w);if(el)ssPaint(w);};
      }
    });
  })();
