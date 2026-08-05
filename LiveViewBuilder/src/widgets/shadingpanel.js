  // ===== Widget: Beschattungs-Panel (shadingpanel) — Rollos im Heizplan-Stil =====
  //
  //  EIN zusammenhängendes Panel für ALLE IPSShadowing-Rollos: Raum-Tabs (gruppiert EG/OG/
  //  Markise) + grosser Detailbereich (Jalousie-Visual, Slider, Presets, Automatik, Programme,
  //  Status) + Übersicht aller Rollos als Positionsbalken. Nutzt den Sammel-Abruf ?api=getall.

  var _spanState = {};
  var _spanTimer = null;
  var SPAN_PROGLBL = {day:'Tag', night:'Nacht', temp:'Temperatur', present:'Präsenz', bgn:'Tagesbeginn', end:'Tagesende', sun:'Sonne'};
  var SPAN_GORDER = ['EG','OG','Markise'];
  var SPAN_GLABEL = {EG:'ERDGESCHOSS', OG:'OBERGESCHOSS', Markise:'MARKISE'};

  function spanSt(w){return _spanState[w.id]||(_spanState[w.id]={loaded:false,all:null,order:[],sel:0,err:''});}
  function spanDev(st,id){return st.all&&st.all[id];}
  function spanSel(st){return spanDev(st,st.sel);}

  function spanDemoAll(){return [
    {id:1,name:'Büro',group:'EG',position:{vid:1,value:0},automatic:{vid:2,value:true},info:'Tagesprogramm, Tag=06:00–20:56, Innen 24,8°, Außen 31°',programs:{day:{vid:11,value:1,options:[{v:1,name:'Offen'},{v:8,name:'50%'},{v:11,name:'Geschlossen'}]},night:{vid:12,value:11,options:[{v:1,name:'Offen'},{v:11,name:'Geschlossen'}]},sun:{vid:13,value:2,options:[{v:2,name:'Süd'},{v:0,name:'Aus'}]}}},
    {id:2,name:'Werkstatt West',group:'EG',position:{vid:3,value:0},automatic:{vid:4,value:true},info:'',programs:{}},
    {id:3,name:'Schlafzimmer',group:'OG',position:{vid:5,value:100},automatic:{vid:6,value:true},info:'',programs:{}},
    {id:4,name:'Wohnzimmer W.',group:'OG',position:{vid:7,value:53},automatic:{vid:8,value:false},info:'',programs:{}},
    {id:5,name:'Markise',group:'Markise',position:{vid:9,value:0},automatic:{vid:10,value:true},info:'',programs:{}}
  ];}

  // ============================ RENDER ============================
  function spanRender(w){
    var st=spanSt(w);
    if(!st.loaded)return '<div class="spanel spanel-msg">Beschattung lädt …</div>';
    if(st.err)return '<div class="spanel spanel-msg">'+esc(st.err)+'</div>';
    if(!st.order.length)return '<div class="spanel spanel-msg">Keine Rollos gefunden</div>';
    var d=spanSel(st)||spanDev(st,st.order[0].id); if(!d){st.sel=st.order[0].id;d=spanDev(st,st.sel);}
    var pos=(d.position&&d.position.value)|0, auto=!!(d.automatic&&d.automatic.value);
    var h='<div class="spanel">';
    // Kopf
    h+='<div class="span-head"><div class="span-title">'+escL(w.label||'Beschattung')+' <span class="span-sub">· '+esc(d.name)+'</span></div>'
      +'<button class="span-auto'+(auto?' on':'')+'" data-spanauto="1"><span class="span-dot"></span>Automatik '+(auto?'an':'aus')+'</button></div>';
    // Raum-Tabs gruppiert
    h+= spanTabs(st);
    // Körper
    h+='<div class="span-body"><div class="span-main">';
    // grosses Jalousie-Visual + Steuerung
    h+='<div class="span-ctl"><div class="span-blind" title="'+pos+' % geschlossen"><i style="height:'+pos+'%"></i><span class="span-blindpct">'+pos+'%</span></div>'
      +'<div class="span-ctlr"><div class="span-posbig">'+pos+' <small>% geschlossen</small></div>'
      +'<input class="span-slider" type="range" min="0" max="100" step="1" value="'+pos+'" data-spanpos="1">'
      +'<div class="span-preset"><button data-spanpset="0">Auf</button><button data-spanpset="25">25%</button><button data-spanpset="50">Halb</button><button data-spanpset="75">75%</button><button data-spanpset="100">Zu</button></div>'
      +(d.info?'<div class="span-info">'+esc(d.info)+'</div>':'')+'</div></div>';
    // Übersicht aller Rollos (Positionsbalken)
    h+= spanOverview(st);
    h+='</div>';
    // Seite: Programme
    h+='<div class="span-side"><div class="span-boxh">Programme</div>';
    var progs=['day','night','sun','temp','present','bgn','end'];
    var any='';
    progs.forEach(function(k){var p=d.programs&&d.programs[k];if(!p)return;
      any+='<label class="span-prog"><span>'+esc(SPAN_PROGLBL[k]||k)+'</span><select data-spanprog="'+p.vid+'">'+(p.options||[]).map(function(o){return '<option value="'+o.v+'"'+(o.v==p.value?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</select></label>';});
    h+=(any||'<div class="span-hint">Dieses Gerät hat keine Programm-Auswahlen.</div>')+'</div>';
    h+='</div></div>';
    return h;
  }

  function spanTabs(st){
    var byG={}; SPAN_GORDER.forEach(function(g){byG[g]=[];}); byG['']=[];
    st.order.forEach(function(r){(byG[r.group]||byG['']).push(r);});
    var h='<div class="span-rooms">';
    SPAN_GORDER.concat(['']).forEach(function(g){var list=byG[g];if(!list||!list.length)return;
      h+='<div class="span-rgrp">'+(g?'<span class="span-glab">'+esc(g)+'</span>':'')
        +list.map(function(r){return '<button class="span-room'+(r.id==st.sel?' on':'')+'" data-spanroom="'+r.id+'">'+esc(r.name)+'</button>';}).join('')+'</div>';
    });
    return h+'</div>';
  }
  function spanOverview(st){
    // „Ledger"-Liste: Raum · Positions-Regler (Anzeige) · % · Auto/Hand-Umschalter
    var floors=[['OG','Obergeschoss'],['EG','Erdgeschoss'],['Markise','Markise']];
    var h='<div class="span-ovh">Alle Rollos <span class="span-hint">· Zeile wählt · Auto/Hand schaltet</span></div><div class="span-ov"><div class="rlg">';
    floors.forEach(function(f){var g=f[0],list=st.order.filter(function(r){return r.group==g;});if(!list.length)return;
      h+='<div class="rlg-h"><b>'+esc(f[1])+'</b><hr><span>'+list.length+'</span></div>';
      list.forEach(function(r){var d=spanDev(st,r.id),pos=(d&&d.position&&d.position.value)|0,auto=!!(d&&d.automatic&&d.automatic.value),av=(d&&d.automatic&&d.automatic.vid)||0,pv=(d&&d.position&&d.position.vid)||0;
        h+='<div class="rlg-row'+(r.id==st.sel?' is-sel':'')+'" data-spanroom="'+r.id+'" style="--pos:'+pos+'" title="'+esc(r.name)+' · '+pos+' % geschlossen">'
          +'<span class="rlg-name">'+esc(r.name)+'</span>'
          +'<span class="rlg-rail" data-posvid="'+pv+'"><span class="rlg-track"></span><span class="rlg-thumb"></span></span>'
          +'<span class="rlg-pct">'+pos+'<u>%</u></span>'
          +'<span class="rlg-tog'+(auto?'':' man')+'" data-spantog="'+av+'" data-cur="'+(auto?1:0)+'" title="Automatik '+(auto?'an':'aus')+'"><b class="auto">Auto</b><b class="hand">Hand</b></span>'
          +'</div>';});
    });
    return h+'</div></div>';
  }

  // ============================ NETZ (Sammel-Abruf) ============================
  var _spanAll=null,_spanAllTs=0,_spanWait=null;
  function spanLoadAll(force,cb){
    if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();return;}
    if(!force&&_spanAll&&(Date.now()-_spanAllTs<5000)){cb&&cb();return;}
    if(_spanWait){_spanWait.push(cb);return;}
    _spanWait=[cb];
    fetch('?api=shading&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _spanAll=(j&&j.devices)||[]; _spanAllTs=Date.now(); var q=_spanWait;_spanWait=null;q.forEach(function(c){c&&c();});
    }).catch(function(){var q=_spanWait;_spanWait=null;(q||[]).forEach(function(c){c&&c();});});
  }
  function spanApply(st,list){ st.all={}; st.order=[]; (list||[]).forEach(function(d){st.all[d.id]=d;st.order.push({id:d.id,name:d.name,group:d.group||''});});
    // Reihenfolge nach Gruppe EG,OG,Markise, dann Rest
    var rank={EG:0,OG:1,Markise:2}; st.order.sort(function(a,b){return (rank[a.group]==null?9:rank[a.group])-(rank[b.group]==null?9:rank[b.group]);});
    if(!st.sel||!st.all[st.sel])st.sel=st.order.length?st.order[0].id:0;
  }
  function spanFetch(w,el){var st=spanSt(w);
    if(typeof DOKU!=='undefined'&&DOKU){spanApply(st,spanDemoAll());st.loaded=true;st.err='';spanRepaint(w,el);return;}
    spanLoadAll(false,function(){ if(_spanAll){spanApply(st,_spanAll);st.err='';}else st.err='Verbindungsfehler'; st.loaded=true; spanRepaint(w,el); });
  }
  function spanWrite(w,el,vid,val){if(!vid)return;setVar(vid,val);
    setTimeout(function(){spanLoadAll(true,function(){var st=spanSt(w);if(_spanAll)spanApply(st,_spanAll);spanRepaint(w,el);});},500);}
  function spanStartTimer(){if(_spanTimer||(typeof DOKU!=='undefined'&&DOKU))return;_spanTimer=setInterval(spanTick,7000);}
  function spanTick(){var vis=Object.keys(_spanState).filter(function(id){return _spanState[id].loaded&&document.querySelector('.w[data-id="'+id+'"]');});if(!vis.length)return;
    spanLoadAll(true,function(){ vis.forEach(function(id){var st=_spanState[id],w=(typeof widget==='function')?widget(id):null;if(!w)return;var el=document.querySelector('.w[data-id="'+id+'"]');if(!el)return;if(_spanAll)spanApply(st,_spanAll);if(document.activeElement&&el.contains(document.activeElement))return;spanRepaint(w,el);});});}

  // ============================ PAINT/BIND ============================
  function spanElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function spanRepaint(w,el){if(!el)el=spanElOf(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=spanRender(w);spanBind(w,el);}
  function spanBind(w,el){var st=spanSt(w);function rp(){spanRepaint(w,el);}
    $$('[data-spanroom]',el).forEach(function(b){b.onclick=function(){st.sel=+b.getAttribute('data-spanroom');rp();};});
    // Ledger-Liste: Auto/Hand-Umschalter je Zeile
    $$('[data-spantog]',el).forEach(function(t){t.onclick=function(e){e.stopPropagation();var vid=+t.getAttribute('data-spantog');if(!vid)return;var cur=t.getAttribute('data-cur')==='1';spanWrite(w,el,vid,cur?0:1);};});
    // Ledger-Liste: ziehbarer Positions-Regler (schreibt beim Loslassen)
    $$('[data-posvid]',el).forEach(function(rail){var vid=+rail.getAttribute('data-posvid');if(!vid)return;
      rail.onclick=function(e){e.stopPropagation();};                                 // Regler wählt nicht die Zeile
      function px(cx){var b=rail.getBoundingClientRect();return Math.max(0,Math.min(100,Math.round((cx-b.left)/b.width*100)));}
      rail.addEventListener('pointerdown',function(ev){ev.preventDefault();ev.stopPropagation();var row=rail.closest('.rlg-row');
        function draw(p){if(row)row.style.setProperty('--pos',p);var pc=row&&row.querySelector('.rlg-pct');if(pc)pc.firstChild.nodeValue=p;}
        function mv(e){draw(px(e.clientX));}
        function up(e){document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);spanWrite(w,el,vid,px(e.clientX));}
        draw(px(ev.clientX));document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);});});
    var d=spanSel(st);
    var ab=$('[data-spanauto]',el);if(ab&&d&&d.automatic)ab.onclick=function(){spanWrite(w,el,d.automatic.vid,d.automatic.value?0:1);};
    var sl=$('[data-spanpos]',el);if(sl&&d&&d.position){sl.onchange=function(){spanWrite(w,el,d.position.vid,parseInt(sl.value)||0);};
      sl.oninput=function(){var pv=$('.span-posbig',el);if(pv)pv.firstChild.nodeValue=sl.value+' ';var bl=$('.span-blind i',el);if(bl)bl.style.height=sl.value+'%';var bp=$('.span-blindpct',el);if(bp)bp.textContent=sl.value+'%';};}
    $$('[data-spanpset]',el).forEach(function(b){if(d&&d.position)b.onclick=function(){spanWrite(w,el,d.position.vid,+b.getAttribute('data-spanpset'));};});
    $$('[data-spanprog]',el).forEach(function(s){s.onchange=function(){spanWrite(w,el,+s.getAttribute('data-spanprog'),+s.value);};});
  }

  // ============================ WIDGET ============================
  defWidget('shadingpanel',{
    label:'Beschattungs-Panel', paletteIcon:'cover', size:[980,600],
    defaults:function(w){w.label='Beschattung';},
    render:function(w){return spanRender(w);},
    mount:function(w){var el=spanElOf(w);if(!el)el=spanElOf(w,$('#ovcanvas'));if(!el)return;spanStartTimer();spanFetch(w,el);},
    props:function(w){return '<div style="font-size:11px;color:var(--muted);padding:4px 2px">Zeigt alle IPSShadowing-Rollos mit Raum-Tabs (EG/OG/Markise). Keine weitere Einstellung nötig.</div>';}
  });
