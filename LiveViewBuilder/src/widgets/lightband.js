// ===== Widget lightband: Licht-Zeitsteuerung als Tagesbaender =====
//
//  Bearbeitet wird die Woche als sieben Tagesbaender: ein Abschnitt sagt "ab hier gilt
//  diese Szene". Das liest sich wie der Heizplan - GEHANDELT wird aber ausdruecklich nur
//  an den KANTEN. Aus jedem Abschnittsbeginn macht der Hub eine gewoehnliche Schaltpunkt-
//  Regel; es gibt keinen laufend durchgesetzten Sollzustand. Wer um 22 Uhr von Hand
//  einschaltet, wird nicht zwei Minuten spaeter vom Plan ueberfahren. Genau das ist der
//  Unterschied zur Heizung, wo eine Sollkurve staendig nachgeregelt wird.
//
//  Backend: ?api=light&op=bandget / bandset (Hub-Store lightBands -> abgeleitete Regeln).
(function(){
  var DAYS=[['Mo',1],['Di',2],['Mi',3],['Do',4],['Fr',5],['Sa',6],['So',0]];
  var PAL=['accent','info','warm','ok','warn','crit'];
  var B={data:null,sel:null,dirty:false,loading:false,subs:[],pending:[]};

  // ---------------------------------------------------------------- Daten
  function demo(){
    var d={days:{}};
    DAYS.forEach(function(x){
      d.days[x[1]]=[{sceneId:'morgen',trigger:{kind:'time',time:'06:30'}},
                    {sceneId:'tag',   trigger:{kind:'time',time:'09:00'}},
                    {sceneId:'abend', trigger:{kind:'sun',event:'sunset',offsetMin:-15}},
                    {sceneId:'aus',   trigger:{kind:'time',time:'22:30'}}];
    });
    return {ok:true,bands:d,enabled:true,automationEnabled:true,sun:{sunrise:363,sunset:1210},
      scenes:[{id:'morgen',name:'Guten Morgen'},{id:'tag',name:'Tag'},
              {id:'abend',name:'Abend'},{id:'aus',name:'Alles aus'}]};
  }
  function load(cb){
    if(typeof DOKU!=='undefined'&&DOKU){B.data=demo();cb&&cb();return;}
    if(B.loading){if(cb)B.pending.push(cb);return;}
    B.loading=true;
    fetch('?api=light&op=bandget',{cache:'no-store'}).then(function(r){return r.json();})
      .then(function(j){
        B.data=(j&&j.ok)?j:{bands:{days:{}},scenes:[],sun:{sunrise:360,sunset:1200},enabled:false};
        B.dirty=false; done(cb);
      }).catch(function(){B.data=B.data||{bands:{days:{}},scenes:[],sun:{sunrise:360,sunset:1200},enabled:false};done(cb);});
    function done(f){B.loading=false;var p=B.pending;B.pending=[];f&&f();p.forEach(function(g){try{g();}catch(e){}});}
  }
  function save(cb){
    if(typeof DOKU!=='undefined'&&DOKU){B.dirty=false;emit();cb&&cb();return;}
    fetch('?api=light&op=bandset&key='+encodeURIComponent(TOKEN),{method:'POST',cache:'no-store',
      headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({days:B.data.bands.days,enabled:!!B.data.enabled})})
      .then(function(r){return r.json();})
      .then(function(){B.dirty=false;emit();cb&&cb();})
      .catch(function(){emit();cb&&cb();});
  }
  function emit(){B.subs.forEach(function(f){try{f();}catch(e){}});}

  // ------------------------------------------------------- kleine Helfer
  function segs(d){var a=(B.data&&B.data.bands&&B.data.bands.days)?B.data.bands.days[d]:null;
    if(!a){a=[];if(B.data&&B.data.bands){if(!B.data.bands.days)B.data.bands.days={};B.data.bands.days[d]=a;}}
    return a;}
  function sunMin(ev){var s=(B.data&&B.data.sun)||{};return ev==='sunrise'?(s.sunrise||360):(s.sunset||1200);}
  /** Startminute eines Abschnitts - Sonnenabschnitte mit den heutigen Sonnenzeiten. */
  function minOf(s){
    var t=s.trigger||{};
    if(t.kind==='sun')return Math.max(0,Math.min(1439,sunMin(t.event)+(+t.offsetMin||0)));
    var p=String(t.time||'0:00').split(':');
    return Math.max(0,Math.min(1439,(+p[0]||0)*60+(+p[1]||0)));
  }
  function hhmm(m){m=Math.max(0,Math.min(1439,Math.round(m)));
    return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+(m%60)).slice(-2);}
  function sortDay(d){segs(d).sort(function(a,b){return minOf(a)-minOf(b);});}
  function sceneName(id){var s=((B.data&&B.data.scenes)||[]).filter(function(x){return x.id===id;})[0];
    return s?s.name:(id||'—');}
  /** Feste Farbe je Szene: Reihenfolge in der Szenenliste, damit sie ueber alle Tage gleich ist. */
  function sceneColor(w,id){
    var ov=((w&&w.lbColors)||[]).filter(function(x){return x.scene===id;})[0];
    if(ov&&ov.color)return 'var(--'+ov.color+')';
    var list=(B.data&&B.data.scenes)||[],i=-1;
    list.forEach(function(s,k){if(s.id===id)i=k;});
    return 'var(--'+PAL[(i<0?0:i)%PAL.length]+')';
  }
  function trLabel(s){
    var t=s.trigger||{};
    if(t.kind==='sun'){var o=+t.offsetMin||0;
      return (t.event==='sunrise'?'SA':'SU')+(o?(o>0?' +':' −')+Math.abs(o):'')+' · '+hhmm(minOf(s));}
    return t.time||'00:00';
  }

  // ------------------------------------------------------------- Zeichnen
  function bandRow(w,lbl,d){
    var a=segs(d),h='';
    if(!a.length){
      h='<div class="lb-leer">keine Steuerung</div>';
    }else{
      // Vor dem ersten Abschnitt gilt noch der letzte von gestern - das gehoert sichtbar
      // dazu, sonst wirkt der Tag vor 6 Uhr ungeregelt.
      var first=minOf(a[0]);
      if(first>0){
        var vor=vorTag(d);
        h+='<div class="lb-seg vor" style="left:0;width:'+(first/1440*100)+'%">'
          +'<span class="lb-sn">'+(vor?escL(sceneName(vor.sceneId)):'')+'</span></div>';
      }
      a.forEach(function(s,i){
        var von=minOf(s),bis=(i+1<a.length)?minOf(a[i+1]):1440;
        var br=Math.max(0.6,(bis-von)/1440*100);
        var akt=B.sel&&B.sel.d===d&&B.sel.i===i;
        h+='<div class="lb-seg'+(akt?' sel':'')+((s.trigger||{}).kind==='sun'?' sun':'')+'"'
          +' data-lbseg="'+d+'.'+i+'" style="left:'+(von/1440*100)+'%;width:'+br+'%;'
          +'background:'+sceneColor(w,s.sceneId)+'">'
          +'<span class="lb-kante"></span>'
          +'<span class="lb-sn">'+escL(sceneName(s.sceneId))+'</span>'
          +'<span class="lb-st">'+esc(trLabel(s))+'</span></div>';
      });
    }
    return '<div class="lb-row"><span class="lb-tag">'+lbl+'</span>'
      +'<div class="lb-track" data-lbtrack="'+d+'">'+h+'</div>'
      +'<button class="lb-plus" data-lbadd="'+d+'" title="Abschnitt hinzufügen">+</button></div>';
  }
  /** Letzter Abschnitt des Vortags (fuer die Fortsetzung vor dem ersten Schaltpunkt). */
  function vorTag(d){
    for(var k=1;k<=7;k++){var p=(d-k+7)%7,a=segs(p);if(a.length)return a[a.length-1];}
    return null;
  }
  function sceneSel(cur,attr){
    var o=((B.data&&B.data.scenes)||[]).map(function(s){
      return '<option value="'+esc(s.id)+'"'+(s.id===cur?' selected':'')+'>'+escL(s.name)+'</option>';}).join('');
    if(!o)o='<option value="">— keine Szene angelegt —</option>';
    return '<select class="lb-sel" '+attr+'>'+o+'</select>';
  }
  function editor(w){
    if(!B.sel)return '<div class="lb-hint">Abschnitt anklicken zum Ändern · ziehen verschiebt den Beginn</div>';
    var a=segs(B.sel.d),s=a[B.sel.i];
    if(!s){B.sel=null;return '';}
    var t=s.trigger||{},sun=t.kind==='sun';
    return '<div class="lb-ed">'
      +'<span class="lb-edl">Beginn</span>'
      +'<span class="lb-seg2"><button class="lb-b'+(sun?'':' on')+'" data-lbkind="time">Uhrzeit</button>'
      +'<button class="lb-b'+(sun?' on':'')+'" data-lbkind="sun">Sonne</button></span>'
      +(sun
        ?('<select class="lb-sel" data-lbev>'
          +'<option value="sunrise"'+(t.event==='sunrise'?' selected':'')+'>Sonnenaufgang</option>'
          +'<option value="sunset"'+(t.event!=='sunrise'?' selected':'')+'>Sonnenuntergang</option></select>'
          +'<input class="lb-in" type="number" step="5" min="-240" max="240" data-lboff value="'+(+t.offsetMin||0)+'">'
          +'<span class="lb-edl">min · heute '+hhmm(minOf(s))+'</span>')
        :('<input class="lb-in" type="time" data-lbtime value="'+esc(t.time||'00:00')+'">'))
      +'<span class="lb-edl">Szene</span>'+sceneSel(s.sceneId,'data-lbscene')
      +'<button class="lb-b dan" data-lbdel>Abschnitt löschen</button>'
      +'<span class="lb-sp"></span>'
      +'<span class="lb-edl">Tag übernehmen auf</span>'
      +'<button class="lb-b" data-lbcopy="week">Mo–Fr</button>'
      +'<button class="lb-b" data-lbcopy="all">alle Tage</button>'
      +'</div>';
  }
  function paint(w){
    var d=B.data;
    if(!d)return '<div class="lb"><div class="lb-hint">lädt …</div></div>';
    var n=0;DAYS.forEach(function(x){n+=segs(x[1]).length;});
    var std='';[0,3,6,9,12,15,18,21,24].forEach(function(h){
      std+='<span style="left:'+(h/24*100)+'%">'+h+'</span>';});
    return '<div class="lb">'
      +'<div class="lb-kopf">'
      +'<span class="lb-tt">'+escL(w.lbTitle||'Zeitsteuerung')+'</span>'
      +'<span class="lb-z">'+n+' Abschnitt'+(n===1?'':'e')+'</span>'
      +'<span class="lb-sp"></span>'
      +(B.dirty?'<span class="lb-warn">nicht gespeichert</span>':'')
      +'<button class="lb-b'+(B.dirty?' pri':'')+'" data-lbsave>Speichern</button>'
      +'<span class="lb-edl">Automatik</span>'
      +'<span class="lb-tog'+(d.enabled?' on':'')+'" data-lbon></span>'
      +'</div>'
      +'<div class="lb-skala"><span class="lb-tag"></span><div class="lb-std">'+std+'</div></div>'
      +DAYS.map(function(x){return bandRow(w,x[0],x[1]);}).join('')
      +editor(w)
      +'</div>';
  }

  // ---------------------------------------------------------- Bedienung
  function wire(h,w){
    function neu(){emit();}
    h.querySelectorAll('[data-lbseg]').forEach(function(e){
      var p=e.getAttribute('data-lbseg').split('.'),d=+p[0],i=+p[1];
      var trk=e.parentNode,start=null,basis=0,moved=false;
      e.onpointerdown=function(ev){
        if(ev.button)return;
        start=ev.clientX;moved=false;
        basis=minOf(segs(d)[i]);
        e.setPointerCapture(ev.pointerId);
      };
      e.onpointermove=function(ev){
        if(start===null)return;
        var br=trk.getBoundingClientRect();if(!br.width)return;
        var dm=(ev.clientX-start)/br.width*1440;
        if(!moved&&Math.abs(ev.clientX-start)<3)return;
        moved=true;
        var a=segs(d),s=a[i];
        // Nachbarn begrenzen: ein Abschnitt darf den naechsten nicht ueberholen.
        var lo=(i>0)?minOf(a[i-1])+5:0, hi=(i+1<a.length)?minOf(a[i+1])-5:1435;
        var ziel=Math.max(lo,Math.min(hi,Math.round((basis+dm)/5)*5));
        var t=s.trigger||(s.trigger={});
        if(t.kind==='sun')t.offsetMin=Math.max(-240,Math.min(240,ziel-sunMin(t.event)));
        else t.time=hhmm(ziel);
        B.dirty=true;neu();
      };
      e.onpointerup=function(ev){
        if(start===null)return;start=null;
        try{e.releasePointerCapture(ev.pointerId);}catch(x){}
        if(!moved){B.sel={d:d,i:i};neu();}else{sortDay(d);B.sel=null;neu();}
      };
      e.onpointercancel=function(){start=null;};
    });
    h.querySelectorAll('[data-lbadd]').forEach(function(e){e.onclick=function(){
      var d=+e.getAttribute('data-lbadd'),a=segs(d);
      var sc=((B.data.scenes||[])[0]||{}).id||'';
      // Neuer Abschnitt in die groesste Luecke, damit er nicht auf einem anderen landet.
      var pkt=[0].concat(a.map(minOf)).concat([1440]),best=0,bw=-1;
      for(var k=0;k+1<pkt.length;k++){var wte=pkt[k+1]-pkt[k];if(wte>bw){bw=wte;best=Math.round((pkt[k]+pkt[k+1])/2/5)*5;}}
      a.push({sceneId:sc,trigger:{kind:'time',time:hhmm(best)}});
      sortDay(d);
      var neuI=-1;a.forEach(function(s,k){if(minOf(s)===best&&s.sceneId===sc&&neuI<0)neuI=k;});
      B.sel={d:d,i:Math.max(0,neuI)};B.dirty=true;emit();
    };});
    var sel=B.sel?segs(B.sel.d)[B.sel.i]:null;
    function ed(q){return h.querySelector(q);}
    if(sel){
      h.querySelectorAll('[data-lbkind]').forEach(function(e){e.onclick=function(){
        var k=e.getAttribute('data-lbkind'),m=minOf(sel);
        sel.trigger=(k==='sun')
          ? {kind:'sun',event:m>720?'sunset':'sunrise',offsetMin:0}
          : {kind:'time',time:hhmm(m)};
        B.dirty=true;emit();
      };});
      if(ed('[data-lbtime]'))ed('[data-lbtime]').onchange=function(){
        sel.trigger={kind:'time',time:this.value||'00:00'};B.dirty=true;sortDay(B.sel.d);B.sel=null;emit();};
      if(ed('[data-lbev]'))ed('[data-lbev]').onchange=function(){
        sel.trigger.event=this.value;B.dirty=true;sortDay(B.sel.d);B.sel=null;emit();};
      if(ed('[data-lboff]'))ed('[data-lboff]').onchange=function(){
        sel.trigger.offsetMin=Math.max(-240,Math.min(240,parseInt(this.value)||0));
        B.dirty=true;sortDay(B.sel.d);B.sel=null;emit();};
      if(ed('[data-lbscene]'))ed('[data-lbscene]').onchange=function(){
        sel.sceneId=this.value;B.dirty=true;emit();};
      if(ed('[data-lbdel]'))ed('[data-lbdel]').onclick=function(){
        segs(B.sel.d).splice(B.sel.i,1);B.sel=null;B.dirty=true;emit();};
      h.querySelectorAll('[data-lbcopy]').forEach(function(e){e.onclick=function(){
        var ziel=(e.getAttribute('data-lbcopy')==='week')?[1,2,3,4,5]:[0,1,2,3,4,5,6];
        var quelle=JSON.stringify(segs(B.sel.d));
        ziel.forEach(function(d){if(d!==B.sel.d)B.data.bands.days[d]=JSON.parse(quelle);});
        B.dirty=true;emit();
      };});
    }
    if(h.querySelector('[data-lbsave]'))h.querySelector('[data-lbsave]').onclick=function(){save();};
    if(h.querySelector('[data-lbon]'))h.querySelector('[data-lbon]').onclick=function(){
      B.data.enabled=!B.data.enabled;B.dirty=true;emit();};
  }

  defWidget('lightband',{
    label:'Licht-Zeitsteuerung (Bänder)',
    cat:'HomeSuite · Automatik',
    paletteIcon:'clock',
    size:[900,420],
    defaults:function(w){w.lbTitle=w.lbTitle||'Zeitsteuerung';},
    render:function(w){return '<div data-role="lbhost">'+paint(w)+'</div>';},
    mount:function(w){
      // Alle Vorkommen bemalen: dieselbe Widget-ID kann auf Seite UND Popup liegen.
      function alle(){
        var hs=document.querySelectorAll('.w[data-id="'+w.id+'"] [data-role=lbhost]');
        for(var k=0;k<hs.length;k++){hs[k].innerHTML=paint(w);wire(hs[k],w);}
      }
      B.subs.push(alle);
      if(B.data)alle();else load(alle);
      LVB.panel.startPoll('lightband:'+w.id,60000,function(){if(!B.dirty)load(alle);});
    },
    props:function(w){
      return row('Überschrift','<input id="lbTitle" value="'+esc(w.lbTitle||'Zeitsteuerung')+'">')
        +'<div class="pgh">Farbe je Szene</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
        +'Ohne Eintrag bekommt jede Szene eine feste Farbe aus der Skin-Reihe — gleich auf allen Tagen. '
        +'Die Kennung steht in der Szenenliste (z. B. <code>alles-aus</code>).</div>'
        +listEditor(w,'lbColors','Szenen-Kennung · Farbe',[{k:'scene',ph:'Kennung'},{k:'color',type:'skincolor'}]);
    },
    wire:function(w){
      if($('#lbTitle'))$('#lbTitle').oninput=function(){w.lbTitle=this.value;render();commit();};
    }
  });
})();
