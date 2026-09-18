  // ===== Widget: Kalender (calendar) - Tag / Woche / Monat / Agenda =====
  //
  //  Datenquelle ist ?api=cal (iCal Calendar Reader, ModuleID 5127CDDC-...): der
  //  Handler laedt die ICS je Instanz und liefert {events:[{start,end,title,allDay,cal}]}.
  //
  //  VIER ANSICHTEN, eine Sprache:
  //    tag    - Stundenraster mit Jetzt-Marke; zeigt Ueberschneidungen raeumlich
  //    woche  - sieben Spalten, Ganztags-Zeile oben abgesetzt
  //    monat  - Monatsgitter LINKS, Agenda RECHTS (die Standardansicht: sie zeigt
  //             Ueberblick und konkrete Termine gleichzeitig, ohne Umschalten)
  //    agenda - nur die Liste, nach Tagen gruppiert
  //
  //  Alle Masse kommen aus clamp(min, N cqmin, max) - die Kachel bestimmt die
  //  Schriftgroesse, nicht eine feste Pixelzahl. Sonst wird bei kleinen Kacheln
  //  abgeschnitten statt verkleinert.
  (function(){
    var CAL_MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    var CAL_WT=['So','Mo','Di','Mi','Do','Fr','Sa'];
    var CAL_WTL=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    var CAL_FARBEN=['#2ee6b0','#c792ea','#5aa9ff','#f0a94a','#ff8a80','#a5d6a7','#ffd54f','#80deea'];
    var _calDaten={};     // widgetId -> {events, geladen, laedt}
    var _calStand={};     // widgetId -> {ansicht, anker}

    function calP2(n){ return String(n).padStart(2,'0'); }
    /** Zeitstempel robust: der Handler liefert Sekunden, manche ICS-Quellen Millisekunden. */
    function calZeit(x){ var n=parseInt(x,10)||0; if(n>4e10)n=Math.floor(n/1000); return _hzD(n*1000); }  // Termine in HAUSZEIT
    function calTagKey(d){ return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); }
    function calHM(d){ return calP2(d.getHours())+':'+calP2(d.getMinutes()); }
    function calStand(w){
      if(!_calStand[w.id]) _calStand[w.id]={ansicht:(w.calview||'monat'),anker:_hzJetzt()};
      return _calStand[w.id];
    }
    /** Element NUR, wenn es auch wirklich ein calendar ist - IDs sind seitenuebergreifend. */
    function calEl(w){
      var s='.w.t-calendar[data-id="'+w.id+'"]';
      return $(s,canvas)||$(s,$('#ovcanvas'));
    }
    /** Farbe je Kalender-Instanz: eigene Zuordnung (calColors) vor Reihenfolge. */
    function calFarbe(w,iid,idx){
      var eigen={};
      (w.calColors||[]).forEach(function(z){ if(z.cal)eigen[String(z.cal).trim()]=z.color; });
      var k=String(iid).trim();
      if(eigen[k]) return _skinColor(eigen[k])||eigen[k];
      return CAL_FARBEN[idx%CAL_FARBEN.length];
    }
    function calName(w,iid){
      var eigen={};
      (w.calNames||[]).forEach(function(z){ if(z.cal)eigen[String(z.cal).trim()]=z.name; });
      var k=String(iid).trim();
      if(eigen[k]) return eigen[k];
      // Ohne eigenen Namen: bei URLs der Wirtsname, bei IDs die Nummer.
      return /^https?:/i.test(k) ? (k.split('/')[2]||k) : ('#'+k);
    }
    /** Termine laden und normalisieren. */
    function calLaden(w,fertig){
      var d=_calDaten[w.id]=_calDaten[w.id]||{events:[],geladen:0,laedt:false};
      if(d.laedt) return;
      if(!w.calIds){ d.events=[]; d.geladen=Date.now(); if(fertig)fertig(); return; }
      d.laedt=true;
      var tage=Math.max(7,Math.min(60,parseInt(w.days)||45));
      fetch('?api=cal&ids='+encodeURIComponent(w.calIds)+'&days='+tage,{cache:'no-store'})
        .then(function(r){return r.json();})
        .then(function(j){
          var roh=String(w.calIds||''), tr=(roh.indexOf(';')>=0)?';':',';
          var ids=roh.split(tr).map(function(x){return x.trim();}).filter(Boolean);
          d.events=((j&&j.events)||[]).map(function(e){
            var iid=e.cal, idx=Math.max(0,ids.indexOf(String(iid)));
            return {s:calZeit(e.start), e:calZeit(e.end||e.start), t:String(e.title||''),
                    ad:!!e.allDay, iid:iid, c:calFarbe(w,iid,idx), k:calName(w,iid)};
          }).sort(function(a,b){return a.s-b.s;});
          d.geladen=Date.now(); d.laedt=false; if(fertig)fertig();
        })
        .catch(function(){ d.laedt=false; d.fehler=true; if(fertig)fertig(); });
    }
    function calTermineAm(w,d){
      var ev=(_calDaten[w.id]||{}).events||[], k=calTagKey(d);
      return ev.filter(function(e){
        if(calTagKey(e.s)===k) return true;
        return e.s<=d && e.e>d && (e.e-e.s)>86400000;      // mehrtaegige mitnehmen
      });
    }

    // ---------------- Ansichten ----------------
    function calKopf(w,titel,unter){
      var st=calStand(w);
      var tabs=[['tag','Tag'],['woche','Woche'],['monat','Monat'],['agenda','Agenda']];
      return '<div class="calkopf"><div class="caltit"><b>'+esc(titel)+'</b><span>'+esc(unter)+'</span></div>'
        +'<div class="calpills">'+tabs.map(function(t){
            return '<div class="calpill'+(st.ansicht===t[0]?' on':'')+'" data-calv="'+t[0]+'">'+t[1]+'</div>';
          }).join('')+'</div>'
        +'<div class="calnav"><span data-calnav="-1">‹</span><span data-calnav="0">•</span><span data-calnav="1">›</span></div></div>';
    }
    function calLegende(w){
      var roh=String(w.calIds||''), tr=(roh.indexOf(';')>=0)?';':',';
      var ids=roh.split(tr).map(function(x){return x.trim();}).filter(Boolean);
      if(!ids.length) return '';
      return '<div class="callg">'+ids.map(function(iid,i){
        return '<span><i style="background:'+calFarbe(w,iid,i)+'"></i>'+esc(calName(w,iid))+'</span>';
      }).join('')+'</div>';
    }
    function calEintrag(e,mitDatum){
      var zeit=e.ad?'ganztägig':(calHM(e.s)+'–'+calHM(e.e));
      return '<div class="calrow" style="--c:'+e.c+'">'
        +(mitDatum?'<span class="caldat"><b>'+e.s.getDate()+'</b>'+CAL_WT[e.s.getDay()]+' '+CAL_MON[e.s.getMonth()].slice(0,3)+'</span>':'')
        +'<span class="calzeit">'+zeit+'</span>'
        +'<span class="caltxt">'+esc(e.t)+'</span>'
        +'<span class="calkal">'+esc(e.k)+'</span></div>';
    }
    function vTag(w){
      var st=calStand(w), d=st.anker, V0=6,V1=22, hh=100/(V1-V0);
      var alle=calTermineAm(w,d), gt=alle.filter(function(e){return e.ad;}), tv=alle.filter(function(e){return !e.ad;});
      var std='',lin='';
      for(var h=V0;h<V1;h++){ std+='<div class="calstd">'+calP2(h)+'</div>';
        lin+='<div class="callin" style="top:'+((h-V0)*hh)+'%"></div>'; }
      var evs=tv.map(function(e){
        var a=(e.s.getHours()+e.s.getMinutes()/60-V0)*hh, b=(e.e.getHours()+e.e.getMinutes()/60-V0)*hh;
        if(b<=a)b=a+hh/2;
        return '<div class="calev" style="--c:'+e.c+';top:'+Math.max(0,a)+'%;height:'+Math.min(100-Math.max(0,a),b-a)+'%">'
          +'<b>'+esc(e.t)+'</b><small>'+calHM(e.s)+'–'+calHM(e.e)+' · '+esc(e.k)+'</small></div>';
      }).join('');
      var jetzt=_hzJetzt(), marke='';
      if(calTagKey(jetzt)===calTagKey(d)){
        var jp=(jetzt.getHours()+jetzt.getMinutes()/60-V0)*hh;
        if(jp>=0&&jp<=100) marke='<div class="caljetzt" style="top:'+jp+'%"></div>';
      }
      return calKopf(w,CAL_WTL[d.getDay()]+', '+d.getDate()+'. '+CAL_MON[d.getMonth()],
                     d.getFullYear()+' · '+alle.length+(alle.length===1?' Termin':' Termine'))
        +'<div class="calrumpf">'
        +(gt.length?'<div class="calgt">'+gt.map(function(e){return '<div class="calgtx" style="--c:'+e.c+'">'+esc(e.t)+'</div>';}).join('')+'</div>':'')
        +'<div class="caltag"><div class="calstdsp">'+std+'</div><div class="calsp">'+lin+evs+marke+'</div></div>'
        +'</div>'+calLegende(w);
    }
    function vWoche(w){
      var st=calStand(w), mo=new Date(st.anker);
      mo.setDate(mo.getDate()-((mo.getDay()+6)%7)); mo.setHours(0,0,0,0);
      var V0=6,V1=22, hh=100/(V1-V0), jetzt=_hzJetzt();
      var kopf='<div></div>', gtr='<div class="calgtlab">ganztägig</div>', spalten='<div class="calstdsp">';
      for(var h=V0;h<V1;h++) spalten+='<div class="calstd">'+calP2(h)+'</div>';
      spalten+='</div>';
      var anz=0;
      for(var i=0;i<7;i++){
        var d=new Date(mo); d.setDate(mo.getDate()+i);
        var heute=calTagKey(d)===calTagKey(jetzt);
        kopf+='<div class="calwk'+(heute?' on':'')+'">'+CAL_WT[d.getDay()]+'<b>'+d.getDate()+'</b></div>';
        var alle=calTermineAm(w,d); anz+=alle.length;
        var gt=alle.filter(function(e){return e.ad;}), tv=alle.filter(function(e){return !e.ad;});
        gtr+='<div class="calgt">'+gt.map(function(e){return '<div class="calgtx" style="--c:'+e.c+'">'+esc(e.t)+'</div>';}).join('')+'</div>';
        var lin='';
        for(var h2=V0;h2<V1;h2++) lin+='<div class="callin" style="top:'+((h2-V0)*hh)+'%"></div>';
        spalten+='<div class="calsp">'+lin+tv.map(function(e){
          var a=(e.s.getHours()+e.s.getMinutes()/60-V0)*hh, b=(e.e.getHours()+e.e.getMinutes()/60-V0)*hh;
          if(b<=a)b=a+hh/2;
          return '<div class="calwev" style="--c:'+e.c+';top:'+Math.max(0,a)+'%;height:'+Math.min(100-Math.max(0,a),b-a)+'%">'
            +calHM(e.s)+' '+esc(e.t)+'</div>';
        }).join('')+'</div>';
      }
      var so=new Date(mo); so.setDate(mo.getDate()+6);
      return calKopf(w,mo.getDate()+'. – '+so.getDate()+'. '+CAL_MON[so.getMonth()],
                     'Kalenderwoche '+calKW(mo)+' · '+anz+(anz===1?' Termin':' Termine'))
        +'<div class="calrumpf"><div class="calwoche">'+kopf+gtr+spalten+'</div></div>'+calLegende(w);
    }
    function calKW(d){
      var t=new Date(d.getFullYear(),d.getMonth(),d.getDate());
      t.setDate(t.getDate()+3-((t.getDay()+6)%7));
      var e=new Date(t.getFullYear(),0,4);
      return 1+Math.round(((t-e)/86400000-3+((e.getDay()+6)%7))/7);
    }
    function calGitter(w,anker,kompakt){
      var y=anker.getFullYear(), m=anker.getMonth(), jetzt=_hzJetzt();
      var erster=new Date(y,m,1), off=(erster.getDay()+6)%7, start=new Date(y,m,1-off);
      var h='<div class="calmk">'+['Mo','Di','Mi','Do','Fr','Sa','So'].map(function(x){return '<div>'+x+'</div>';}).join('')+'</div>';
      for(var wch=0;wch<6;wch++){
        h+='<div class="calmr">';
        for(var i=0;i<7;i++){
          var d=new Date(start); d.setDate(start.getDate()+wch*7+i);
          var drin=d.getMonth()===m, heute=calTagKey(d)===calTagKey(jetzt);
          var tv=calTermineAm(w,d);
          h+='<div class="calmt'+(drin?'':' aus')+(heute?' heute':'')+'" data-caltag="'+d.getTime()+'">'
            +'<div class="calmn">'+d.getDate()+'</div>';
          if(kompakt){
            var farben=[]; tv.forEach(function(e){ if(farben.indexOf(e.c)<0)farben.push(e.c); });
            if(farben.length) h+='<div class="calpk">'+farben.slice(0,4).map(function(c){return '<i style="background:'+c+'"></i>';}).join('')+'</div>';
          }else{
            h+=tv.slice(0,3).map(function(e){
              return '<div class="calmev" style="--c:'+e.c+'">'+(e.ad?'':calHM(e.s)+' ')+esc(e.t)+'</div>';}).join('');
            if(tv.length>3) h+='<div class="calmmehr">+'+(tv.length-3)+' weitere</div>';
          }
          h+='</div>';
        }
        h+='</div>';
      }
      return h;
    }
    function vMonat(w){
      var st=calStand(w), ev=(_calDaten[w.id]||{}).events||[];
      var kommend=ev.filter(function(e){return e.e>=_hzJetzt();}).slice(0,12);
      var imMonat=ev.filter(function(e){return e.s.getMonth()===st.anker.getMonth()&&e.s.getFullYear()===st.anker.getFullYear();});
      return calKopf(w,CAL_MON[st.anker.getMonth()]+' '+st.anker.getFullYear(),
                     imMonat.length+(imMonat.length===1?' Termin':' Termine')+' in diesem Monat')
        +'<div class="calrumpf"><div class="caldash">'
        +'<div class="caldl"><div class="calmonat kompakt">'+calGitter(w,st.anker,true)+'</div>'+calLegende(w)+'</div>'
        +'<div class="caldr"><div class="caldh">Kommende Termine</div>'
        +'<div class="calliste">'+(kommend.length?kommend.map(function(e){return calEintrag(e,true);}).join('')
            :'<div class="calleer">Keine Termine im Zeitraum</div>')+'</div></div>'
        +'</div></div>';
    }
    function vAgenda(w){
      var ev=((_calDaten[w.id]||{}).events||[]).filter(function(e){return e.e>=_hzJetzt();});
      var jetzt=_hzJetzt(); jetzt.setHours(0,0,0,0);
      var gruppen={}, reihenfolge=[];
      ev.forEach(function(e){ var k=calTagKey(e.s); if(!gruppen[k]){gruppen[k]=[];reihenfolge.push(k);} gruppen[k].push(e); });
      var h=reihenfolge.map(function(k){
        var d=gruppen[k][0].s, dd=new Date(d); dd.setHours(0,0,0,0);
        var diff=Math.round((dd-jetzt)/86400000);
        var lbl=diff===0?'Heute':(diff===1?'Morgen':CAL_WTL[d.getDay()]);
        return '<div class="calgrp"><div class="calgd'+(diff===0?' heute':'')+'">'
          +'<b>'+d.getDate()+'</b><span>'+lbl+' · '+CAL_MON[d.getMonth()].slice(0,3)+'</span></div>'
          +'<div class="calgl">'+gruppen[k].map(function(e){return calEintrag(e,false);}).join('')+'</div></div>';
      }).join('');
      return calKopf(w,'Kommende Termine',ev.length+(ev.length===1?' Termin':' Termine')+' · '+(w.days||45)+' Tage')
        +'<div class="calrumpf"><div class="calagenda">'+(h||'<div class="calleer">Keine Termine im Zeitraum</div>')+'</div></div>'
        +calLegende(w);
    }

    function calZeichnen(w){
      var el=calEl(w); if(!el) return;
      var host=el.querySelector('.winner')||el;
      var d=_calDaten[w.id];
      if(!w.calIds){ host.innerHTML='<div class="calplan"><div class="calleer">Kalender-Instanz-IDs in den Eigenschaften eintragen (z. B. 33020,55959)</div></div>'; return; }
      if(!d||(!d.geladen&&!d.fehler)){ host.innerHTML='<div class="calplan"><div class="calleer">Termine werden geladen …</div></div>'; return; }
      if(d.fehler){ host.innerHTML='<div class="calplan"><div class="calleer">Kalender nicht erreichbar</div></div>'; return; }
      var st=calStand(w), inhalt;
      if(st.ansicht==='tag') inhalt=vTag(w);
      else if(st.ansicht==='woche') inhalt=vWoche(w);
      else if(st.ansicht==='agenda') inhalt=vAgenda(w);
      else inhalt=vMonat(w);
      host.innerHTML='<div class="calplan">'+inhalt+'</div>';
      calBinden(w,el);
    }
    function calBinden(w,el){
      var st=calStand(w);
      $$('[data-calv]',el).forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation();
        st.ansicht=b.getAttribute('data-calv'); calZeichnen(w); };});
      $$('[data-calnav]',el).forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation();
        var r=parseInt(b.getAttribute('data-calnav'));
        if(r===0){ st.anker=_hzJetzt(); }
        else if(st.ansicht==='tag') st.anker.setDate(st.anker.getDate()+r);
        else if(st.ansicht==='woche') st.anker.setDate(st.anker.getDate()+7*r);
        else st.anker.setMonth(st.anker.getMonth()+r);
        st.anker=new Date(st.anker); calZeichnen(w); };});
      $$('[data-caltag]',el).forEach(function(z){ z.onclick=function(ev){ ev.stopPropagation();
        st.anker=new Date(parseInt(z.getAttribute('data-caltag'))); st.ansicht='tag'; calZeichnen(w); };});
    }

    defWidget('calendar',{
      label:'Kalender', cat:'Wetter & Zeit', paletteIcon:'calendar', size:[760,460],
      defaults:function(w){ w.calview='monat'; w.days=45; },
      render:function(w){ return '<div class="calplan"><div class="calleer">Termine werden geladen …</div></div>'; },
      mount:function(w){
        _calStand[w.id]={ansicht:(w.calview||'monat'),anker:_hzJetzt()};
        calLaden(w,function(){ calZeichnen(w); });
        calZeichnen(w);
        if(window.LVB&&LVB.panel&&LVB.panel.startPoll){
          LVB.panel.startPoll('calendar:'+w.id, 600000, function(){
            var d=_calDaten[w.id]; if(d)d.geladen=0;
            calLaden(w,function(){ calZeichnen(w); });
          });
        }
      },
      props:function(w){
        return row('Quellen','<input id="pCalIds" value="'+esc(w.calIds||'')+'" placeholder="55959;50018;https://…/kalender.ics">')
          +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Drei Arten, gemischt erlaubt: <b>Instanz-ID</b> eines iCal Calendar Reader · <b>Medien-ID</b> eines Symcon-Medienobjekts mit .ics (kein Netzzugriff) · <b>ICS-URL</b> direkt. Getrennt mit <b>Semikolon</b> – Komma geht auch, aber nur wenn keine URL Kommas enthält. Die Reihenfolge bestimmt die Farbe. Die Termine werden 15 Minuten zwischengespeichert.</div>'
          +row('Zeitraum (Tage)','<input id="pCalDays" type="number" min="7" max="60" style="width:70px" value="'+(w.days||45)+'">')
          +row('Startansicht','<select id="pCalView">'
            +['tag','woche','monat','agenda'].map(function(v){
              var n={tag:'Tag',woche:'Woche',monat:'Monat + Agenda',agenda:'Agenda'}[v];
              return '<option value="'+v+'"'+((w.calview||'monat')===v?' selected':'')+'>'+n+'</option>';}).join('')
            +'</select>')
          +'<div class="pgh">Kalender benennen und färben</div>'
          +listEditor(w,'calNames','Instanz-ID · Name',[{k:'cal',ph:'55959'},{k:'name',ph:'Peter'}])
          +listEditor(w,'calColors','Instanz-ID · Farbe',[{k:'cal',ph:'55959'},{k:'color',type:'skincolor'}]);
      },
      wire:function(w){
        function neu(){ var d=_calDaten[w.id]; if(d){d.geladen=0;d.events=[];} calLaden(w,function(){calZeichnen(w);}); commit(); }
        if($('#pCalIds'))$('#pCalIds').onchange=function(){ w.calIds=this.value; neu(); };
        if($('#pCalDays'))$('#pCalDays').onchange=function(){ w.days=parseInt(this.value)||45; neu(); };
        if($('#pCalView'))$('#pCalView').onchange=function(){ w.calview=this.value;
          _calStand[w.id]={ansicht:this.value,anker:_hzJetzt()}; calZeichnen(w); commit(); };
      }
    });
  })();
