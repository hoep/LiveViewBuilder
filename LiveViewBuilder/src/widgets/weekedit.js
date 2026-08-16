  // ===== Widget: Wochenplan-Editor (weekedit) — generischer Symcon-Wochenplan =====
  //
  //  Bearbeitet EINEN Symcon-Wochenplan (Ereignis, EventType 2): Pool-Pumpe, Mähroboter,
  //  Zirkulation … Werte sind die im Plan definierten Aktionen (Name + Farbe). Darstellung
  //  als Farbbänder je Wochentag + Slot-Editor (Aktion wählen, Startzeit ±, einfügen/löschen).
  //  Daten über ?api=week (list/get frei, set token-geschützt). Im Doku-Modus nur Demodaten.

  var _weState = {};                         // w.id -> Editor-Zustand
  var _wePlans = null;                       // Plan-Liste (via ?api=week&op=list)
  var WE_DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  var WE_DAYL = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

  function weH2M(h,m){return (h|0)*60+(m|0);}
  function weM2H(min){min=Math.max(0,Math.min(1440,Math.round(min)));var h=Math.floor(min/60),mi=min%60;return (h<10?'0':'')+h+':'+(mi<10?'0':'')+mi;}
  function weFg(hex){ // lesbare Vordergrundfarbe auf farbigem Chip
    var c=/^#([0-9a-f]{6})$/i.exec(String(hex||'')); if(!c)return '#fff';
    var n=parseInt(c[1],16),r=(n>>16)&255,g=(n>>8)&255,b=n&255; return (0.299*r+0.587*g+0.114*b)>150?'#111':'#fff';
  }
  function weSt(w){return _weState[w.id]||(_weState[w.id]={loaded:false,planId:0,name:'',actions:[],groups:[],day:0,slot:1,now:null,active:true,dirty:false,err:''});}

  function weAct(st,aid){var a=(st.actions||[]).filter(function(x){return x.id==aid;})[0];return a||{id:aid,name:'#'+aid,color:'#888'};}
  function weGroupForDay(st,day){var gs=st.groups||[];for(var i=0;i<gs.length;i++){if((gs[i].dayList||[]).indexOf(day)>=0)return gs[i];}return null;}
  function weCurGroup(st){return weGroupForDay(st,st.day);}
  function wePoints(g){return (g&&g.points)?g.points.slice().sort(function(a,b){return weH2M(a.h,a.m)-weH2M(b.h,b.m);}):[];}
  // Anzahl EIN-Fenster einer Gruppe (Aktion != 0 = „Ein"), analog zur Controller-Uebersetzung ruleFromEvent (TIMEC = max. 4).
  function weWindows(g){var pts=wePoints(g),open=false,wins=0;for(var i=0;i<pts.length;i++){var on=(pts[i].actionId!=0);if(on){open=true;}else if(open){wins++;open=false;}}if(open)wins++;return wins;}
  function weDayLabel(g){ if(!g)return '–'; return (g.dayList||[]).map(function(d){return WE_DAYS[d];}).join(' '); }

  // ---------- Demodaten (Doku) ----------
  function weDemo(){
    return {name:'Filterzeiten Pool (Demo)', active:true, now:1,
      actions:[{id:0,name:'Aus',color:'#9AA5AD'},{id:1,name:'An',color:'#00CDAB'}],
      groups:[
        {gid:0,days:31,dayList:[0,1,2,3,4],points:[{h:0,m:0,actionId:0},{h:9,m:0,actionId:1},{h:13,m:0,actionId:0},{h:16,m:0,actionId:1},{h:20,m:0,actionId:0}]},
        {gid:1,days:96,dayList:[5,6],points:[{h:0,m:0,actionId:0},{h:10,m:0,actionId:1},{h:21,m:0,actionId:0}]}
      ]};
  }
  function weDemoPlans(){return [{id:900801,name:'Filterzeiten Pool (Demo)',path:'Poolcontroller',actions:2},{id:900802,name:'Mähplan (Demo)',path:'Husqvarna',actions:3}];}

  // ============================ RENDER ============================
  function weRender(w){
    var st=weSt(w);
    if(!st.loaded)return '<div class="wep wep-msg"><div>Wochenplan lädt …</div></div>';
    if(st.err)return '<div class="wep wep-msg"><div>'+esc(st.err)+'</div></div>';
    if(!st.planId||!(st.groups&&st.groups.length))return '<div class="wep wep-msg"><div>Kein Wochenplan gewählt – im Panel auswählen.</div></div>';
    var g=weCurGroup(st), pts=wePoints(g), n=pts.length;
    if(st.slot>n)st.slot=n; if(st.slot<1)st.slot=1;
    var _mw=(w.maxWin)|0, _wc=weWindows(g), _atMax=(_mw>0&&_wc>=_mw);   // Fenster-Limit (z. B. Pool-Pumpe = 4, Controller-TIMEC)
    var h='<div class="wep">';
    // Kopf
    h+='<div class="wep-head"><div class="wep-title">'+esc(st.name)+(st.active?'':' <span class="wep-off">inaktiv</span>')+(st.dirty?' <b class="wep-unsaved">· ungespeichert</b>':'')+'</div>';
    // Gut sichtbarer Slot-Hinzufügen-Knopf in der Kopfzeile (zusätzlich zum Editor-Kasten).
    h+='<div class="wep-hact" style="margin-left:auto;display:flex;gap:6px;align-items:center">'
      +'<button class="wep-hadd" data-weadd="1"'+(_atMax?' disabled title="Max. '+_mw+' Ein-Fenster/Tag (Controller-Limit)"':' title="Schaltpunkt einfügen"')+' style="background:var(--accent-2,var(--accent));color:#fff;border:0;border-radius:6px;padding:clamp(3px,1.4cqmin,7px) clamp(8px,3.4cqmin,16px);min-height:clamp(24px,7cqmin,34px);font-size:clamp(10px,3.2cqmin,13px);font-weight:600;cursor:'+(_atMax?'not-allowed;opacity:.4':'pointer')+'">+ Slot</button>'
      +'<div class="wep-now">'+(st.now!=null?('jetzt: <b style="color:'+weAct(st,st.now).color+'">'+esc(weAct(st,st.now).name)+'</b>'):'')+'</div></div></div>';
    // Wochentage
    h+='<div class="wep-days">'+WE_DAYS.map(function(d,i){var gg=weGroupForDay(st,i);return '<button class="wep-day'+(i==st.day?' on':'')+(gg?'':' empty')+'" data-weday="'+i+'">'+d+'</button>';}).join('')+'</div>';
    // Wochenübersicht
    h+='<div class="wep-week">';
    // Die Zeile des GEWAEHLTEN Tages ist bedienbar: jedes Feld waehlt seinen Slot an,
    // jede Slot-Grenze traegt einen Ziehpunkt. Bewusst in der vorhandenen Zeile statt in
    // einer zusaetzlichen Leiste - das kostet keinen Platz und man zieht dort, wo man
    // ohnehin hinsieht. Der erste Punkt liegt fest auf 00:00 und hat keinen Griff.
    for(var i=0;i<7;i++){var gg=weGroupForDay(st,i),gp=wePoints(gg),start=0,segs='',edit=(i==st.day);
      for(var k=0;k<gp.length;k++){
        var s=weH2M(gp[k].h,gp[k].m),e=(k+1<gp.length)?weH2M(gp[k+1].h,gp[k+1].m):1440;
        var ak=weAct(st,gp[k].actionId);
        segs+='<i'+(edit?' data-wetlseg="'+(k+1)+'"'+((k+1)==st.slot?' class="on"':''):'')
             +' style="left:'+(s/1440*100)+'%;width:'+((e-s)/1440*100)+'%;background:'+ak.color+'"'
             +(edit?' title="'+esc(ak.name)+' '+weM2H(s)+'–'+weM2H(e)+'"':'')+'></i>';
        if(edit&&k>0){
          segs+='<b class="wep-hnd'+((k+1)==st.slot?' on':'')+'" data-wehnd="'+k+'" style="left:'+(s/1440*100)+'%"><span>'+weM2H(s)+'</span></b>';
        }
      }
      h+='<div class="wep-wrow'+(edit?' on wep-wrow-edit':'')+'" data-weday="'+i+'"><span class="wep-wlab">'+WE_DAYS[i]+'</span><div class="wep-wbar"'+(edit?' data-wetl':'')+'>'+segs+'</div></div>';
    }
    h+='</div>';
    // Legende Aktionen
    h+='<div class="wep-legend">'+(st.actions||[]).map(function(a){return '<span class="wep-lchip"><i style="background:'+a.color+'"></i>'+esc(a.name)+'</span>';}).join('')+'</div>';
    // Gruppen-Hinweis + Slot-Pillen
    h+='<div class="wep-body"><div class="wep-main">';
    h+='<div class="wep-grpnote">'+WE_DAYL[st.day]+' · Gruppe gilt für <b>'+weDayLabel(g)+'</b> · '+n+' Slot'+(n!=1?'s':'')+(_mw>0?(' · <b'+(_wc>=_mw?' style="color:var(--warn)"':'')+'>'+_wc+'/'+_mw+' Ein-Fenster</b>'):'')+'</div>';
    var start2=0;
    h+='<div class="wep-pills">'+pts.map(function(p,i){var s=weM2H(start2),e=(i+1<n)?weM2H(weH2M(pts[i+1].h,pts[i+1].m)):'24:00';start2=weH2M(p.h,p.m+0);var a=weAct(st,p.actionId);
      var lbl=weM2H(weH2M(p.h,p.m))+'–'+e; return '<button class="wep-pill'+(i+1==st.slot?' on':'')+'" data-weslot="'+(i+1)+'" style="--wc:'+a.color+'"><b>'+esc(a.name)+'</b><span>'+lbl+'</span></button>';}).join('')+'</div>';
    h+='</div>';
    // Editor
    h+='<div class="wep-side">'+weSlotEditor(st,g,pts,_atMax,_mw)+'</div>';
    h+='</div>';
    h+='<button class="wep-save'+(st.dirty?' dirty':'')+'" data-wesave="1"><svg class="wep-ic"><use href="#ic-check"/></svg> Speichern</button>';
    h+='</div>';
    return h;
  }

  function weSlotEditor(st,g,pts,atMax,mw){
    var i=st.slot-1,p=pts[i]||{h:0,m:0,actionId:0},first=(i===0),a=weAct(st,p.actionId),n=pts.length;
    var start=weH2M(p.h,p.m);
    var h='<div class="wep-box"><div class="wep-boxh">Slot '+st.slot+'</div>';
    // Aktion
    h+='<div class="wep-field"><label>Aktion</label><select class="wep-asel" data-weact="1">'+(st.actions||[]).map(function(x){return '<option value="'+x.id+'"'+(x.id==p.actionId?' selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select></div>';
    h+='<div class="wep-swatch" style="background:'+a.color+';color:'+weFg(a.color)+'">'+esc(a.name)+'</div>';
    // Start
    h+='<div class="wep-field"><label>Start</label><div class="wep-val">'+(first?'00:00 (fix)':weM2H(start))+'</div></div>';
    h+='<div class="wep-steps'+(first?' dis':'')+'"><button data-westart="-60"'+(first?' disabled':'')+'>−1h</button><button data-westart="-10"'+(first?' disabled':'')+'>−10m</button><button data-westart="10"'+(first?' disabled':'')+'>+10m</button><button data-westart="60"'+(first?' disabled':'')+'>+1h</button></div>';
    // add/del
    h+='<div class="wep-slotbtns"><button class="wep-addb" data-weadd="1"'+(atMax?' disabled title="Max. '+mw+' Ein-Fenster/Tag"':'')+'>+ Einfügen</button><button class="wep-delb" data-wedel="1"'+(n<=1?' disabled':'')+'>− Löschen</button></div>';
    h+='<div class="wep-hint">'+(atMax?'<b style="color:var(--warn)">Fenster-Limit '+mw+' erreicht</b> (Controller-Grenze). ':'')+'Änderungen gelten für '+weDayLabel(g)+'.</div>';
    h+='</div>';
    return h;
  }

  // ============================ EDIT-OPS ============================
  function weDirty(st){st.dirty=true;}
  function weActChange(st,aid){var g=weCurGroup(st),pts=wePoints(g);if(!pts[st.slot-1])return;
    // im echten (unsortierten) Array finden und setzen
    var target=pts[st.slot-1]; target.actionId=aid; weDirty(st);}
  function weStartStep(st,delta){var g=weCurGroup(st),pts=wePoints(g),i=st.slot-1;if(i===0)return; // erster fix 00:00
    var cur=weH2M(pts[i].h,pts[i].m),lo=weH2M(pts[i-1].h,pts[i-1].m)+10,hi=(i+1<pts.length)?weH2M(pts[i+1].h,pts[i+1].m)-10:1430;
    var nv=Math.max(lo,Math.min(hi,cur+delta)); pts[i].h=Math.floor(nv/60);pts[i].m=nv%60; weDirty(st);}
  function weAddSlot(st,maxWin){var g=weCurGroup(st);if(!g)return;var pts=wePoints(g),n=pts.length;if(n>=48)return;
    if(maxWin>0&&weWindows(g)>=maxWin){toast&&toast('Max. '+maxWin+' Ein-Fenster/Tag (Controller-Limit)');return;}
    if(n===0){ // leere Gruppe: 00:00 + Mittagspunkt anlegen, damit ueberhaupt editierbar
      var a0=(st.actions[0]||{id:0}).id,a1=(st.actions[1]||st.actions[0]||{id:0}).id;
      g.points.push({h:0,m:0,actionId:a0}); g.points.push({h:12,m:0,actionId:a1}); st.slot=2; weDirty(st); return; }
    // Neuen Schaltpunkt in die GROESSTE Luecke setzen (zwischen Punkten bzw. bis 24:00) -> immer moeglich, sichtbar.
    var bestGap=-1,bestAt=-1,bestIdx=0;
    for(var i=0;i<n;i++){var s=weH2M(pts[i].h,pts[i].m),e=(i+1<n)?weH2M(pts[i+1].h,pts[i+1].m):1440;
      if(e-s>bestGap){bestGap=e-s;bestAt=s+Math.round((e-s)/2/10)*10;bestIdx=i;}}
    if(bestGap<20){toast&&toast('Keine Lücke frei zum Einfügen');return;}
    if(bestAt<=0)bestAt=10; if(bestAt>1430)bestAt=1430;
    // Aktion: die ANDERE (naechste in der Liste) -> neuer Slot ist sofort sichtbar
    var curA=pts[bestIdx].actionId,acts=st.actions||[],other=curA;
    for(var j=0;j<acts.length;j++){if(acts[j].id!=curA){other=acts[j].id;break;}}
    g.points.push({h:Math.floor(bestAt/60),m:bestAt%60,actionId:other});
    var np=wePoints(g);for(var k=0;k<np.length;k++){if(weH2M(np[k].h,np[k].m)===bestAt){st.slot=k+1;break;}} // neuen Slot aktiv
    weDirty(st);}
  function weDelSlot(st){var g=weCurGroup(st);if(!g)return;var pts=wePoints(g),i=st.slot-1;if(pts.length<=1)return;
    var t=pts[i]; g.points=g.points.filter(function(x){return x!==t;});
    if(weH2M((wePoints(g)[0]||{h:0,m:0}).h,(wePoints(g)[0]||{m:0}).m)!==0){var f=wePoints(g)[0];if(f){f.h=0;f.m=0;}} // ersten wieder auf 00:00
    if(st.slot>g.points.length)st.slot=g.points.length; weDirty(st);}

  // ============================ NETZ ============================
  function weLoadPlans(cb){
    if(_wePlans){cb&&cb();return;}
    if(typeof DOKU!=='undefined'&&DOKU){_wePlans=weDemoPlans();cb&&cb();return;}
    fetch('?api=week&op=list',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){_wePlans=(j&&j.plans)||[];cb&&cb();}).catch(function(){_wePlans=[];cb&&cb();});
  }
  function weApplyColors(w,st){ // Anzeige-Farben aus Widget-Overrides (w.actColors) auf die Aktionen legen
    if(!w.actColors||!st.actions)return;
    st.actions.forEach(function(a){var c=w.actColors[a.id];if(!c)return;
      // Skin-Token (accent/ok/…) -> var(--token); Hex/rgb werden durchgereicht; Ungueltiges ignoriert.
      var col=(typeof _cssColorOrEmpty==='function')?_cssColorOrEmpty(c):(/^#[0-9a-f]{6}$/i.test(c)?c:'');
      if(col)a.color=col;});
  }
  function weLoadPlan(w,el,id,cb){var st=weSt(w);
    if(typeof DOKU!=='undefined'&&DOKU){var d=weDemo();st.planId=id||900801;st.name=d.name;st.actions=d.actions;st.groups=d.groups;st.active=d.active;st.now=d.now;st.loaded=true;st.dirty=false;st.err='';weApplyColors(w,st);cb&&cb();return;}
    if(!id){st.loaded=true;st.planId=0;cb&&cb();return;}
    fetch('?api=week&op=get&id='+id,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.ok){st.err='Plan nicht lesbar';st.loaded=true;cb&&cb();return;}
      st.planId=j.id;st.name=j.name;st.actions=j.actions||[];st.groups=j.groups||[];st.active=j.active;st.now=j.now;st.loaded=true;st.dirty=false;st.err='';weApplyColors(w,st);cb&&cb();
    }).catch(function(){st.err='Verbindungsfehler';st.loaded=true;cb&&cb();});
  }
  function weSave(w,el){var st=weSt(w);var g=weCurGroup(st);if(!g)return;
    var pts=wePoints(g).map(function(p){return {h:p.h,m:p.m,actionId:p.actionId};});
    if(typeof DOKU!=='undefined'&&DOKU){st.dirty=false;weRepaint(w,el);toast('Demo: gespeichert (nur Anzeige)');return;}
    var btn=$('[data-wesave]',el);if(btn){btn.disabled=true;btn.textContent='speichert …';}
    fetch('?api=week&op=set&id='+st.planId+'&group='+g.gid+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(pts)})
      .then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){st.dirty=false;toast('Wochenplan gespeichert ('+weDayLabel(g)+')');weLoadPlan(w,el,st.planId,function(){weRepaint(w,el);});}
        else{toast('Speichern fehlgeschlagen'+(j&&j.err?(': '+j.err):''));weRepaint(w,el);}
      }).catch(function(){toast('Speichern: Verbindungsfehler');weRepaint(w,el);});
  }

  // ============================ PAINT/BIND ============================
  function weElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function weRepaint(w,el){if(!el)el=weElOf(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=weRender(w);weBind(w,el);}
  function weBind(w,el){var st=weSt(w);function rp(){weRepaint(w,el);}
    $$('[data-weday]',el).forEach(function(b){b.onclick=function(){st.day=+b.getAttribute('data-weday');st.slot=1;rp();};});
    $$('[data-weslot]',el).forEach(function(b){b.onclick=function(){st.slot=+b.getAttribute('data-weslot');rp();};});
    var as=$('[data-weact]',el);if(as)as.onchange=function(){weActChange(st,+as.value);rp();};
    $$('[data-westart]',el).forEach(function(b){b.onclick=function(){weStartStep(st,+b.getAttribute('data-westart'));rp();};});
    $$('[data-weadd]',el).forEach(function(ab){ab.onclick=function(){weAddSlot(st,(w.maxWin)|0);rp();};}); // Kopf- UND Editor-Knopf
    $$('[data-wedel]',el).forEach(function(db){db.onclick=function(){weDelSlot(st);rp();};});
    var sv=$('[data-wesave]',el);if(sv)sv.onclick=function(){weSave(w,el);};

    // --- Ziehpunkte auf der Tagesleiste ---
    // Waehrend des Ziehens wird NICHT neu gerendert: das wuerde den Griff unter dem Finger
    // wegreissen. Stattdessen wandern Griff und Felder direkt im DOM mit; erst beim
    // Loslassen wird der Wert uebernommen und die Ansicht neu aufgebaut.
    var tl=$('[data-wetl]',el);
    if(tl){
      $$('[data-wetlseg]',tl).forEach(function(sg){
        sg.onclick=function(){ st.slot=+sg.getAttribute('data-wetlseg'); rp(); };
      });
      $$('[data-wehnd]',tl).forEach(function(hd){
        hd.onpointerdown=function(ev){
          if(typeof editing!=='undefined'&&editing)return;
          var idx=+hd.getAttribute('data-wehnd');
          var pts2=wePoints(weGroupForDay(st,st.day));
          if(!pts2[idx])return;
          var box=tl.getBoundingClientRect();
          // Grenzen: mindestens 5 Minuten Abstand zu beiden Nachbarn.
          var lo=weH2M(pts2[idx-1].h,pts2[idx-1].m)+5;
          var hi=(idx+1<pts2.length)?weH2M(pts2[idx+1].h,pts2[idx+1].m)-5:1435;
          var lbl=$('span',hd), segL=$('[data-wetlseg="'+idx+'"]',tl), segR=$('[data-wetlseg="'+(idx+1)+'"]',tl);
          var segRend=segR?(parseFloat(segR.style.left)+parseFloat(segR.style.width)):100;
          var min=weH2M(pts2[idx].h,pts2[idx].m);
          hd.classList.add('drag');
          try{hd.setPointerCapture(ev.pointerId);}catch(_){}
          function toMin(x){
            var u=(x-box.left)/Math.max(1,box.width);
            var m=Math.round(u*1440/5)*5;                       // 5-Minuten-Raster
            return Math.max(lo,Math.min(hi,m));
          }
          function paint(m){
            var pc=m/1440*100;
            hd.style.left=pc+'%'; if(lbl)lbl.textContent=weM2H(m);
            if(segL)segL.style.width=(pc-parseFloat(segL.style.left))+'%';
            if(segR){segR.style.left=pc+'%';segR.style.width=(segRend-pc)+'%';}
          }
          hd.onpointermove=function(e2){ min=toMin(e2.clientX); paint(min); e2.preventDefault(); };
          function ende(){
            hd.onpointermove=null; hd.onpointerup=null; hd.onpointercancel=null;
            hd.classList.remove('drag');
            pts2[idx].h=Math.floor(min/60); pts2[idx].m=min%60;
            weDirty(st); st.slot=idx+1; rp();
          }
          hd.onpointerup=ende; hd.onpointercancel=ende;
          ev.preventDefault();
        };
      });
    }
  }

  // ============================ WIDGET ============================
  defWidget('weekedit',{
    label:'Wochenplan-Editor', cat:'Steuerung', paletteIcon:'calendar', size:[720,460],
    defaults:function(w){w.label='Wochenplan';},
    render:function(w){return weRender(w);},
    mount:function(w){var el=weElOf(w);if(!el)el=weElOf(w,$('#ovcanvas'));if(!el)return;var st=weSt(w);
      if(!st.loaded){ weLoadPlans(function(){ var id=w.eventId||0; weLoadPlan(w,el,id,function(){weRepaint(w,el);}); }); }
      else weBind(w,el);
    },
    props:function(w){return weProps(w);},
    wire:function(w){weWire(w);}
  });

  function weProps(w){
    var h='<div class="pgh">Wochenplan</div>';
    if(!_wePlans){ weLoadPlans(function(){if(typeof renderProps==='function')renderProps();}); return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Pläne laden …</div>'; }
    h+=row('Plan','<select id="wePlan"><option value="">— wählen —</option>'+(_wePlans||[]).map(function(p){return '<option value="'+p.id+'"'+(w.eventId==p.id?' selected':'')+'>'+esc(p.name)+' · '+esc(p.path||'')+'</option>';}).join('')+'</select>');
    h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Jeder Symcon-Wochenplan (Ereignis) — Pool, Mähroboter, Zirkulation … Werte/Farben kommen aus den Aktionen des Plans.</div>';
    h+=row('Max. Ein-Fenster/Tag','<input id="weMaxWin" type="number" min="0" max="12" style="width:70px" value="'+(w.maxWin||'')+'" placeholder="unbegrenzt"> <span style="font-size:11px;color:var(--muted)">Geräte-Limit, z. B. Pool-Pumpe (ProCon TIMEC) = 4</span>');
    h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Begrenzt die schaltbaren Ein-Perioden pro Tag auf das, was der Controller tatsächlich speichern kann. 0/leer = keine Grenze.</div>';
    // Anzeige-Farben je Aktion aus der SKIN-Palette (überschreibt die Plan-Farbe nur in der Darstellung)
    var st=_weState[w.id];
    if(st&&st.loaded&&st.actions&&st.actions.length){
      h+='<div class="pgh">Farben (Anzeige)</div>';
      st.actions.forEach(function(a){
        var cur=(w.actColors&&w.actColors[a.id])||'';
        h+=row(esc(a.name), skinSel(cur,'class="weclr" data-weclr="'+a.id+'"'));
      });
      h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Skin-Farben (passen sich dem Theme an). „Auto" = Farbe aus dem Plan. Überschreibt nur die Anzeige.</div>';
    }
    return h;
  }
  function weWire(w){
    if($('#weMaxWin'))$('#weMaxWin').oninput=function(){var v=parseInt(this.value)||0;w.maxWin=(v>0?Math.min(12,v):undefined);commit();var el=weElOf(w);if(el)weRepaint(w,el);};
    if($('#wePlan'))$('#wePlan').onchange=function(){var v=parseInt(this.value)||0;w.eventId=v||undefined;commit();
      var el=weElOf(w);if(el){var st=weSt(w);st.loaded=false;weRepaint(w,el);WIDGETS.weekedit.mount(w);}};
    function reflect(){var el=weElOf(w);if(!el)return;var st=weSt(w);weApplyColors(w,st);weRepaint(w,el);}
    $$('[data-weclr]').forEach(function(sel){sel.onchange=function(){var aid=sel.getAttribute('data-weclr');
      w.actColors=w.actColors||{};
      if(sel.value===''){delete w.actColors[aid];if(!Object.keys(w.actColors).length)delete w.actColors;
        var el=weElOf(w);if(el){var st=weSt(w);st.loaded=false;WIDGETS.weekedit.mount(w);} // Planfarbe frisch laden
        if(typeof renderProps==='function')renderProps();return;}
      w.actColors[aid]=sel.value;commit();reflect();
      if(typeof renderProps==='function')renderProps();};});
  }
