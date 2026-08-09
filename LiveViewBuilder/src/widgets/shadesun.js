  // ===== Widget: Sonnenstand (shadesun) — Sonnenstand VS. Fassaden-Profil =====
  //
  //  Zeigt den LIVE-Sonnenstand (Azimut/Elevation aus Location #13098) gegen das
  //  Sonnenstands-Profil (geoProfile) EINER Beschattungs-Zone als Balken — damit man
  //  falsche Configs SOFORT sieht: liegt die Sonne je im Azimut-Fenster? kommt sie ueber
  //  die Elevations-/Helligkeitsschwelle? Datenquelle: ?api=mod reconcileProbe (read-only).
  //  Bindung: feste Zone (entityId) ODER Session (folgt der shadex-Familie, gleiche Session).

  (function(){
    var _ss={};
    function ssSt(w){return _ss[w.id]||(_ss[w.id]={d:null,err:''});}
    function ssEntity(w){
      if((w.bind==='session') && typeof hfSess==='function'){var s=hfSess({session:w.session||'shade'});return (s&&s.roomIdx)||0;}
      return parseInt(w.entityId||0)||0;
    }
    function ssMg(idx){return fetch('?api=mod&op=manage&id='+idx+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:'reconcileProbe'})}).then(function(r){return r.json();});}
    function ssDemo(){return {inputs:{az:212,el:9,bright:2600},geoProfile:{azimuthBgn:109,azimuthEnd:289,elevation:8,brightnessMin:0},rawSun:100};}

    function inAz(az,a,b){ if(a==null||b==null)return true; return (a<=b)?(az>=a&&az<=b):(az>=a||az<=b); }
    function bar(pct){return Math.max(0,Math.min(100,pct));}

    // Aussperr-Schutz (Tür-/Fensterkontakt): Status + Kontakt-Variablen setzen (per Zone).
    function ssGuardHtml(w,d){
      var ids=(d&&d.doorIds)||[], open=!!(d&&d.doorOpen);
      var stTxt,cls;
      if(!ids.length){stTxt='kein Kontakt gesetzt';cls='';}
      else if(open){stTxt='Tür/Fenster offen → Zufahren blockiert';cls='warn';}
      else {stTxt='geschützt (Kontakt zu)';cls='ok';}
      return '<div class="ssun-guard"><div class="ssun-guard-h"><span>Aussperr-Schutz</span>'
        +'<span class="ssun-guard-st '+cls+'">'+esc(stTxt)+'</span></div>'
        +'<input class="ssun-guard-in" data-ssguard placeholder="Tür-/Fenster-Kontakt: Variablen-ID(s), Komma" value="'+esc(ids.join(', '))+'"></div>';
    }
    function ssSetDoors(w,val){
      var idx=ssEntity(w); if(!idx)return;
      var ids=String(val).split(',').map(function(s){return parseInt(s.trim(),10);}).filter(function(n){return n>0;});
      fetch('?api=mod&op=manage&id='+idx+'&key='+encodeURIComponent(TOKEN),
        {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:'configureAutomation',args:{doorIds:ids}})})
        .then(function(r){return r.json();}).then(function(){ssLoad(w);}).catch(function(){});
    }
    function ssWire(w,host){var inp=host&&host.querySelector('[data-ssguard]');if(inp)inp.onchange=function(){ssSetDoors(w,this.value);};}

    function ssRender(w){
      var st=ssSt(w), doku=(typeof DOKU!=='undefined'&&DOKU);
      var d=doku?ssDemo():st.d, idx=ssEntity(w);
      if(!idx && !doku) return '<div class="ssun"><div class="ssun-msg">Keine Zone gebunden</div></div>';
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
      var h='<div class="ssun"'+(acc?' style="--accent:'+esc(acc)+'"':'')+'>';
      // Status-Kopf
      var stTxt = active ? ('Sonne im Fenster → schließt '+(d.rawSun!=null?d.rawSun:100)+' %')
        : (!isAz ? 'Sonne außerhalb des Fensters' : (!isEl ? 'Sonne zu tief (unter Schwelle)' : 'zu dunkel'));
      h+='<div class="ssun-head"><span class="ssun-chip '+(active?'ssun-on':'ssun-off')+'">'+(active?'☀ aktiv':'○ inaktiv')+'</span><span class="ssun-verdict">'+esc(stTxt)+'</span></div>';

      // Azimut-Balken 0..360 mit Fassaden-Fenster + Sonnen-Marker + N/O/S/W
      function azpos(a){return bar(a/360*100);}
      var winHtml='';
      if(aBgn!=null&&aEnd!=null){
        if(aBgn<=aEnd){ winHtml='<i class="ssun-win" style="left:'+azpos(aBgn)+'%;width:'+bar((aEnd-aBgn)/360*100)+'%"></i>'; }
        else { winHtml='<i class="ssun-win" style="left:'+azpos(aBgn)+'%;width:'+bar((360-aBgn)/360*100)+'%"></i><i class="ssun-win" style="left:0;width:'+azpos(aEnd)+'%"></i>'; }
      }
      h+='<div class="ssun-row"><label>Azimut</label><div class="ssun-track">'+winHtml
        +[0,90,180,270].map(function(t){return '<span class="ssun-tick" style="left:'+azpos(t)+'%">'+({0:'N',90:'O',180:'S',270:'W'}[t])+'</span>';}).join('')
        +(az!=null?'<i class="ssun-mark'+(isAz?' hit':'')+'" style="left:'+azpos(az)+'%"></i>':'')+'</div>'
        +'<span class="ssun-val">'+(az!=null?Math.round(az)+'°':'–')+'</span></div>';
      h+='<div class="ssun-hint">Fenster '+(aBgn!=null?Math.round(aBgn):'?')+'–'+(aEnd!=null?Math.round(aEnd):'?')+'°'+(inAz(az,0,360)&&aBgn===0&&aEnd===360?' · ⚠ 0–360 = immer':'')+'</div>';

      // Elevations-Balken 0..elMax mit Schwelle + Sonnen-Marker
      function elpos(e){return bar(e/elMax*100);}
      h+='<div class="ssun-row"><label>Höhe</label><div class="ssun-track">'
        +'<i class="ssun-thr" style="left:'+elpos(elMin)+'%"></i>'
        +'<i class="ssun-fill'+(isEl?' hit':'')+'" style="width:'+(el!=null?elpos(el):0)+'%"></i>'
        +(el!=null?'<i class="ssun-mark'+(isEl?' hit':'')+'" style="left:'+elpos(el)+'%"></i>':'')+'</div>'
        +'<span class="ssun-val">'+(el!=null?Math.round(el)+'°':'–')+'</span></div>';
      h+='<div class="ssun-hint">Schwelle ≥ '+Math.round(elMin)+'°'+(elMin<=0?' · ⚠ 0° = keine Schwelle':'')+'</div>';

      // Helligkeit (optional)
      if(brMin>0){
        var brMax=Math.max(brMin*2, br||0, 50000);
        h+='<div class="ssun-row"><label>Hell.</label><div class="ssun-track">'
          +'<i class="ssun-thr" style="left:'+bar(brMin/brMax*100)+'%"></i>'
          +'<i class="ssun-fill'+(isBr?' hit':'')+'" style="width:'+(br!=null?bar(br/brMax*100):0)+'%"></i></div>'
          +'<span class="ssun-val">'+(br!=null?Math.round(br):'–')+'</span></div>';
        h+='<div class="ssun-hint">Schwelle ≥ '+Math.round(brMin)+'</div>';
      }
      if(w.guard!==false && (idx||doku)) h+=ssGuardHtml(w,d);
      h+='</div>';
      return h;
    }
    function ssEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function ssPaint(w){var el=ssEl(w);if(!el)return;
      var ae=document.activeElement; // nicht beim Tippen im Kontakt-Feld überschreiben
      if(ae&&ae.classList&&ae.classList.contains('ssun-guard-in')&&el.contains(ae))return;
      var host=el.querySelector('.winner')||el;host.innerHTML=ssRender(w);ssWire(w,host);}
    function ssLoad(w){ if(typeof DOKU!=='undefined'&&DOKU){ssPaint(w);return;} var idx=ssEntity(w),st=ssSt(w);
      if(!idx){ssPaint(w);return;}
      ssMg(idx).then(function(j){st.d=j;st.err='';ssPaint(w);}).catch(function(){st.err='net';ssPaint(w);}); }

    defWidget('shadesun',{
      label:'Sonnenstand', paletteIcon:'sun', size:[360,232],
      defaults:function(w){w.bind='session';w.session='shade';},
      render:function(w){return ssRender(w);},
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
        h+=row('Aussperr-Schutz','<input type="checkbox" id="ssGuard"'+(w.guard!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Tür-/Fensterkontakt-Zeile</span>');
        return h;
      },
      wire:function(w){
        if($('#ssBind'))$('#ssBind').onchange=function(){w.bind=this.value;commit();renderProps();var el=ssEl(w);if(el)ssLoad(w);};
        if($('#ssSess'))$('#ssSess').onchange=function(){w.session=this.value||undefined;commit();var el=ssEl(w);if(el)ssLoad(w);};
        if($('#ssEnt'))$('#ssEnt').onchange=function(){w.entityId=parseInt(this.value)||undefined;commit();var el=ssEl(w);if(el)ssLoad(w);};
        if($('#ssAcc'))$('#ssAcc').onchange=function(){w.accent=this.value||undefined;commit();var el=ssEl(w);if(el)ssPaint(w);};
        if($('#ssElMax'))$('#ssElMax').onchange=function(){w.elMax=parseInt(this.value)||undefined;commit();var el=ssEl(w);if(el)ssPaint(w);};
        if($('#ssGuard'))$('#ssGuard').onchange=function(){w.guard=this.checked?undefined:false;commit();var el=ssEl(w);if(el)ssPaint(w);};
      }
    });
  })();
