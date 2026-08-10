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
    var h='<div class="wep">';
    // Kopf
    h+='<div class="wep-head"><div class="wep-title">'+esc(st.name)+(st.active?'':' <span class="wep-off">inaktiv</span>')+(st.dirty?' <b class="wep-unsaved">· ungespeichert</b>':'')+'</div>';
    h+='<div class="wep-now">'+(st.now!=null?('jetzt: <b style="color:'+weAct(st,st.now).color+'">'+esc(weAct(st,st.now).name)+'</b>'):'')+'</div></div>';
    // Wochentage
    h+='<div class="wep-days">'+WE_DAYS.map(function(d,i){var gg=weGroupForDay(st,i);return '<button class="wep-day'+(i==st.day?' on':'')+(gg?'':' empty')+'" data-weday="'+i+'">'+d+'</button>';}).join('')+'</div>';
    // Wochenübersicht
    h+='<div class="wep-week">';
    for(var i=0;i<7;i++){var gg=weGroupForDay(st,i),gp=wePoints(gg),start=0,segs='';
      for(var k=0;k<gp.length;k++){var s=weH2M(gp[k].h,gp[k].m),e=(k+1<gp.length)?weH2M(gp[k+1].h,gp[k+1].m):1440;segs+='<i style="left:'+(s/1440*100)+'%;width:'+((e-s)/1440*100)+'%;background:'+weAct(st,gp[k].actionId).color+'"></i>';}
      h+='<div class="wep-wrow'+(i==st.day?' on':'')+'" data-weday="'+i+'"><span class="wep-wlab">'+WE_DAYS[i]+'</span><div class="wep-wbar">'+segs+'</div></div>';
    }
    h+='</div>';
    // Legende Aktionen
    h+='<div class="wep-legend">'+(st.actions||[]).map(function(a){return '<span class="wep-lchip"><i style="background:'+a.color+'"></i>'+esc(a.name)+'</span>';}).join('')+'</div>';
    // Gruppen-Hinweis + Slot-Pillen
    h+='<div class="wep-body"><div class="wep-main">';
    h+='<div class="wep-grpnote">'+WE_DAYL[st.day]+' · Gruppe gilt für <b>'+weDayLabel(g)+'</b> · '+n+' Slot'+(n!=1?'s':'')+'</div>';
    var start2=0;
    h+='<div class="wep-pills">'+pts.map(function(p,i){var s=weM2H(start2),e=(i+1<n)?weM2H(weH2M(pts[i+1].h,pts[i+1].m)):'24:00';start2=weH2M(p.h,p.m+0);var a=weAct(st,p.actionId);
      var lbl=weM2H(weH2M(p.h,p.m))+'–'+e; return '<button class="wep-pill'+(i+1==st.slot?' on':'')+'" data-weslot="'+(i+1)+'" style="--wc:'+a.color+'"><b>'+esc(a.name)+'</b><span>'+lbl+'</span></button>';}).join('')+'</div>';
    h+='</div>';
    // Editor
    h+='<div class="wep-side">'+weSlotEditor(st,g,pts)+'</div>';
    h+='</div>';
    h+='<button class="wep-save'+(st.dirty?' dirty':'')+'" data-wesave="1"><svg class="wep-ic"><use href="#ic-check"/></svg> Speichern</button>';
    h+='</div>';
    return h;
  }

  function weSlotEditor(st,g,pts){
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
    h+='<div class="wep-slotbtns"><button class="wep-addb" data-weadd="1">+ Einfügen</button><button class="wep-delb" data-wedel="1"'+(n<=1?' disabled':'')+'>− Löschen</button></div>';
    h+='<div class="wep-hint">Änderungen gelten für '+weDayLabel(g)+'.</div>';
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
  function weAddSlot(st){var g=weCurGroup(st);if(!g)return;var pts=wePoints(g),n=pts.length;if(n>=48)return;
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
    st.actions.forEach(function(a){var c=w.actColors[a.id];if(c&&/^#[0-9a-f]{6}$/i.test(c))a.color=c;});
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
    var ab=$('[data-weadd]',el);if(ab)ab.onclick=function(){weAddSlot(st);rp();};
    var db=$('[data-wedel]',el);if(db)db.onclick=function(){weDelSlot(st);rp();};
    var sv=$('[data-wesave]',el);if(sv)sv.onclick=function(){weSave(w,el);};
  }

  // ============================ WIDGET ============================
  defWidget('weekedit',{
    label:'Wochenplan-Editor', paletteIcon:'calendar', size:[720,460],
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
    // Anzeige-Farben je Aktion (ueberschreibt die Plan-Farbe nur in der Darstellung)
    var st=_weState[w.id];
    if(st&&st.loaded&&st.actions&&st.actions.length){
      h+='<div class="pgh">Farben (Anzeige)</div>';
      st.actions.forEach(function(a){
        var cur=(w.actColors&&w.actColors[a.id])||a.color||'#888888';
        if(!/^#[0-9a-f]{6}$/i.test(cur))cur='#888888';
        h+=row(esc(a.name),'<input type="color" class="weclr" data-weclr="'+a.id+'" value="'+cur+'"> <button class="wecrst" data-wecrst="'+a.id+'" title="Zurücksetzen">↺</button>');
      });
      h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Überschreibt nur die Anzeige. ↺ setzt auf die Planfarbe zurück.</div>';
    }
    return h;
  }
  function weWire(w){
    if($('#wePlan'))$('#wePlan').onchange=function(){var v=parseInt(this.value)||0;w.eventId=v||undefined;commit();
      var el=weElOf(w);if(el){var st=weSt(w);st.loaded=false;weRepaint(w,el);WIDGETS.weekedit.mount(w);}};
    function reflect(){var el=weElOf(w);if(!el)return;var st=weSt(w);weApplyColors(w,st);weRepaint(w,el);}
    $$('[data-weclr]').forEach(function(inp){inp.oninput=function(){var aid=inp.getAttribute('data-weclr');
      w.actColors=w.actColors||{};w.actColors[aid]=inp.value;commit();reflect();};});
    $$('[data-wecrst]').forEach(function(b){b.onclick=function(){var aid=b.getAttribute('data-wecrst');
      if(w.actColors){delete w.actColors[aid];if(!Object.keys(w.actColors).length)delete w.actColors;}commit();
      var el=weElOf(w);if(el){var st=weSt(w);st.loaded=false;WIDGETS.weekedit.mount(w);} // Planfarbe frisch laden
      if(typeof renderProps==='function')renderProps();};});
  }
