  // ===== Widget-Familie Licht-Automatik (autox) — maximal modular =====
  //
  //  Backend: HomeSuite Hub ueber ?api=light&op=autoget/autoset (Regel-Store lightAuto).
  //  Vier kleine Bausteine, frei kombinierbar auf mehreren Seiten:
  //    autolist   : Regel-Liste + Gesamt-Automatik-Schalter (+ Regel anlegen) — waehlt eine Regel
  //    autoedit   : Detail-Editor der gewaehlten Regel (folgt autolist auf derselben Seite)
  //    autocard   : EINE Kategorie als Karte (w.kind = schedule|circadian|wake|motion|presence)
  //    autotimeline: 24-h-Tagesverlauf mit Sonnenauf/-untergang + Regel-Markern
  //  Schatten-sicher: Aenderungen schreiben die Konfig; der Hub-Timer wertet aus.
  (function(){
    var A={cfg:null,scenes:[],lights:[],zones:[],motionSensors:[],awaySensors:[],sel:-1,subs:[]};
    function sensorSel(id,list,attr){
      id=parseInt(id)||0;
      var opts='<option value="0">— Sensor wählen —</option>'+(list||[]).map(function(s){
        return '<option value="'+s.id+'"'+(s.id===id?' selected':'')+'>'+escL(s.instance)+(s.var&&s.var!==s.instance?(' · '+escL(s.var)):'')+'</option>';}).join('');
      if(id&&!(list||[]).some(function(s){return s.id===id;}))opts+='<option value="'+id+'" selected>#'+id+'</option>';
      return '<select class="ax-sel" '+attr+'>'+opts+'</select>';
    }
    var TYPES={
      schedule:{label:'Zeitplan',plural:'Zeitpläne'},
      circadian:{label:'Circadian',plural:'Circadian'},
      wake:{label:'Wecker',plural:'Wecker'},
      motion:{label:'Bewegung',plural:'Bewegung'},
      presence:{label:'Anwesenheit',plural:'Anwesenheit'}
    };
    var DAYS=['So','Mo','Di','Mi','Do','Fr','Sa'];

    function aIcon(kind){
      var p={
        schedule:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        circadian:'<path d="M4 12a8 8 0 0116 0"/><path d="M12 4V2M8 20h8"/>',
        wake:'<path d="M12 3a6 6 0 00-6 6c0 3 2 4 2 7h8c0-3 2-4 2-7a6 6 0 00-6-6z"/><path d="M9 21h6"/>',
        motion:'<path d="M3 12h4l2-7 4 14 2-7h4"/>',
        presence:'<path d="M3 21v-2a4 4 0 014-4h4M14 7a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M16 11l2 2 4-4"/>',
        sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19M3 12H1M23 12h-2"/>'
      };
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(p[kind]||p.schedule)+'</svg>';
    }
    function tog(on,attr){return '<span class="ax-tog'+(on?' on':'')+'"'+(attr||'')+'></span>';}

    // ---- Daten ----
    var _loading=false,_pending=[];
    function aLoad(cb){
      if(typeof DOKU!=='undefined'&&DOKU){A.cfg=aDemo();A.scenes=[{id:'abend',name:'Abend'},{id:'aus',name:'Alles aus'},{id:'morgen',name:'Guten Morgen'}];A.lights=[{id:1,name:'Wohnzimmer',room:'Wohnzimmer'},{id:2,name:'Küche',room:'Küche'}];A.zones=[{id:9,name:'Küche'}];if(A.sel<0&&A.cfg.rules.length)A.sel=0;cb&&cb();return;}
      if(_loading){if(cb)_pending.push(cb);return;} // laufendes Laden dedupen (keine 5 Parallel-Requests)
      _loading=true;
      Promise.all([
        fetch('?api=light&op=autoget',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=scenes',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=audio&op=list',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=sensors&kind=motion',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};}),
        fetch('?api=light&op=sensors&kind=away',{cache:'no-store'}).then(function(r){return r.json();}).catch(function(){return {};})
      ]).then(function(res){
        A.cfg=(res[0]&&res[0].ok)?res[0]:{enabled:false,rules:[],sun:{sunrise:360,sunset:1200}};
        if(!A.cfg.sun)A.cfg.sun={sunrise:360,sunset:1200};
        A.scenes=(res[1]&&res[1].scenes)||[]; A.lights=(res[2]&&res[2].lights)||[]; A.zones=(res[3]&&res[3].rooms)||[];
        A.motionSensors=(res[4]&&res[4].sensors)||[]; A.awaySensors=(res[5]&&res[5].sensors)||[];
        if(A.sel<0 && A.cfg.rules.length)A.sel=0;
        _loading=false; var cbs=_pending; _pending=[];
        cb&&cb(); cbs.forEach(function(f){try{f();}catch(e){}});
      }).catch(function(){_loading=false;var cbs=_pending;_pending=[];cb&&cb();cbs.forEach(function(f){try{f();}catch(e){}});});
    }
    function aDemo(){return {enabled:true,sun:{sunrise:360,sunset:1224},rules:[
      {type:'schedule',name:'Abend',enabled:true,trigger:{kind:'sun',event:'sunset',offsetMin:-15,days:[]},sceneId:'abend'},
      {type:'schedule',name:'Alles aus',enabled:true,trigger:{kind:'time',time:'22:30',days:[]},sceneId:'aus'},
      {type:'circadian',name:'Circadian OG',enabled:true,devices:[1,2],minK:2200,maxK:5500,minLevel:15,maxLevel:100,level:true},
      {type:'wake',name:'Wecken',enabled:true,time:'06:30',days:[1,2,3,4,5],sceneId:'morgen',rampMin:20,audioZone:9,audioSource:'oe3'},
      {type:'motion',name:'Bewegung Gang',enabled:false,sensor:0,lux:0,luxMax:50,devices:[],holdSec:120},
      {type:'presence',name:'Anwesenheit',enabled:false,awayVar:0,from:'18:00',to:'23:30',devices:[],every:20}
    ]};}
    function aSave(cb){
      if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();aEmit();return;}
      fetch('?api=light&op=autoset&key='+encodeURIComponent(TOKEN),{method:'POST',cache:'no-store',
        headers:{'Content-Type':'text/plain'},body:JSON.stringify({enabled:!!A.cfg.enabled,rules:A.cfg.rules})})
        .then(function(r){return r.json();}).then(function(){cb&&cb();aEmit();}).catch(function(){cb&&cb();});
    }
    function aEmit(){A.subs.forEach(function(s){try{s();}catch(e){}});}
    function aSub(fn){A.subs.push(fn);}

    function sceneName(id){var s=A.scenes.find(function(x){return x.id===id;});return s?s.name:(id||'—');}
    function daysTxt(d){if(!d||!d.length)return 'täglich';if(d.length===7)return 'täglich';
      if(JSON.stringify(d.slice().sort())==='[1,2,3,4,5]')return 'Mo–Fr';return d.map(function(x){return DAYS[x];}).join(' ');}
    function rulesOf(kind){return (A.cfg&&A.cfg.rules||[]).map(function(r,i){return {r:r,i:i};}).filter(function(o){return o.r.type===kind;});}

    function aSummary(r){
      if(r.type==='schedule'){var t=r.trigger||{};return (t.kind==='sun'
        ?((t.event==='sunrise'?'Sonnenaufgang':'Sonnenuntergang')+(t.offsetMin?(' '+(t.offsetMin>0?'+':'')+t.offsetMin+'′'):''))
        :(t.time||'—'))+' → '+sceneName(r.sceneId);}
      if(r.type==='circadian')return (r.devices?r.devices.length:0)+' Lampen · '+r.minK+'–'+r.maxK+' K';
      if(r.type==='wake')return (r.time||'—')+' · '+daysTxt(r.days)+' → '+sceneName(r.sceneId)+(r.audioZone?' + ♪':'');
      if(r.type==='motion')return '< '+(r.luxMax||0)+' lux · '+Math.round((r.holdSec||0)/60)+' min';
      if(r.type==='presence')return (r.from||'')+'–'+(r.to||'');
      return '';
    }
    function aDefault(kind){
      var b={type:kind,enabled:true,name:TYPES[kind].label};
      if(kind==='schedule')return Object.assign(b,{trigger:{kind:'time',time:'20:00',event:'sunset',offsetMin:0,days:[]},sceneId:(A.scenes[0]||{}).id||''});
      if(kind==='circadian')return Object.assign(b,{devices:[],minK:2200,maxK:5500,minLevel:15,maxLevel:100,level:true});
      if(kind==='wake')return Object.assign(b,{time:'06:30',days:[1,2,3,4,5],sceneId:(A.scenes[0]||{}).id||'',rampMin:20,audioZone:0,audioSource:''});
      if(kind==='motion')return Object.assign(b,{sensor:0,lux:0,luxMax:50,devices:[],holdSec:120,level:-1});
      if(kind==='presence')return Object.assign(b,{awayVar:0,from:'18:00',to:'23:30',devices:[],every:20});
      return b;
    }
    function aAdd(kind){A.cfg.rules.push(aDefault(kind));A.sel=A.cfg.rules.length-1;aSave();}

    function elOf(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function host(w){var el=elOf(w);return el?(el.querySelector('.winner')||el):null;}

    // =============================== autolist ===============================
    // Gesamt-Automatik: kombiniert Regel-Store (A.cfg.enabled) + Hub-Variable (automationEnabled).
    function masterOn(){if(!A.cfg)return false;var on=!!A.cfg.enabled;if(A.cfg.automationEnabled!=null)on=on&&!!A.cfg.automationEnabled;return on;}
    function listRender(){
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      var rows=(A.cfg.rules||[]).map(function(r,i){
        return '<div class="ax-row'+(i===A.sel?' on':'')+(r.enabled===false?' off':'')+'" data-axsel="'+i+'">'
          +'<span class="ax-ic">'+aIcon(r.type)+'</span>'
          +'<div class="ax-tx"><div class="ax-nm">'+escL(r.name||TYPES[r.type].label)+'</div><div class="ax-sub">'+esc(aSummary(r))+'</div></div>'
          +tog(r.enabled!==false,' data-axen="'+i+'"')+'</div>';
      }).join('');
      var add='<div class="ax-add">'+Object.keys(TYPES).map(function(k){return '<button data-axadd="'+k+'"><span class="ax-ic">'+aIcon(k)+'</span>'+esc(TYPES[k].label)+'</button>';}).join('')+'</div>';
      return '<div class="ax">'
        +'<div class="ax-head"><span class="ax-h-t">Automatik</span>'+tog(masterOn(),' data-axmaster="1"')+'</div>'
        +'<div class="ax-list">'+(rows||'<div class="ax-msg">Noch keine Regeln</div>')+'</div>'
        +'<div class="ax-addwrap"><div class="ax-addlbl">＋ Regel</div>'+add+'</div></div>';
    }
    function listWire(h,w){
      h.querySelectorAll('[data-axsel]').forEach(function(e){e.onclick=function(ev){if(ev.target.closest('.ax-tog'))return;A.sel=+e.getAttribute('data-axsel');aEmit();};});
      h.querySelectorAll('[data-axen]').forEach(function(e){e.onclick=function(ev){ev.stopPropagation();var i=+e.getAttribute('data-axen');A.cfg.rules[i].enabled=!(A.cfg.rules[i].enabled!==false);aSave();};});
      var m=h.querySelector('[data-axmaster]');if(m)m.onclick=function(){var on=!masterOn();A.cfg.enabled=on;if(A.cfg.automationVar){A.cfg.automationEnabled=on;if(typeof setVar==='function')setVar(A.cfg.automationVar,on);}aSave();};
      h.querySelectorAll('[data-axadd]').forEach(function(e){e.onclick=function(){aAdd(e.getAttribute('data-axadd'));};});
    }

    // =============================== autoedit ===============================
    function chips(list,sel,attr){return list.map(function(o){var on=sel.indexOf(o.id)>=0;return '<button class="ax-chip'+(on?' on':'')+'" '+attr+'="'+o.id+'">'+escL(o.name)+'</button>';}).join('');}
    function daychips(sel,attr){return DAYS.map(function(d,i){var on=(sel||[]).indexOf(i)>=0;return '<button class="ax-day'+(on?' on':'')+'" '+attr+'="'+i+'">'+d+'</button>';}).join('');}
    function sceneSel(id,attr){return '<select class="ax-sel" '+attr+'>'+A.scenes.map(function(s){return '<option value="'+esc(s.id)+'"'+(s.id===id?' selected':'')+'>'+escL(s.name)+'</option>';}).join('')+'</select>';}

    function editRender(){
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      var r=A.cfg.rules[A.sel];
      if(!r)return '<div class="ax"><div class="ax-msg" style="padding:clamp(10px,5cqmin,24px)">Regel links wählen oder anlegen.</div></div>';
      var h='<div class="ax ax-ed"><div class="ax-ed-head"><span class="ax-ic">'+aIcon(r.type)+'</span>'
        +'<input class="ax-name" id="axName" value="'+esc(r.name||'')+'"><span class="ax-badge">'+esc(TYPES[r.type].label)+'</span>'
        +tog(r.enabled!==false,' id="axEnEd"')+'</div><div class="ax-ed-body">';
      if(r.type==='schedule'){var t=r.trigger||{};
        h+=fld('Auslöser','<div class="ax-seg"><button data-axtk="time" class="'+(t.kind!=='sun'?'on':'')+'">Uhrzeit</button><button data-axtk="sun" class="'+(t.kind==='sun'?'on':'')+'">Sonne</button></div>');
        if(t.kind==='sun'){
          h+=fld('Sonnen-Ereignis','<div class="ax-r"><select class="ax-sel" id="axEv"><option value="sunset"'+(t.event!=='sunrise'?' selected':'')+'>Sonnenuntergang</option><option value="sunrise"'+(t.event==='sunrise'?' selected':'')+'>Sonnenaufgang</option></select>'
            +'<span class="ax-mono ax-mut">Versatz</span>'+stepper('axOff',(t.offsetMin||0),'min')+'</div>');
        } else {
          h+=fld('Uhrzeit','<input class="ax-time" type="time" id="axTime" value="'+esc(t.time||'20:00')+'">');
        }
        h+=fld('Wochentage','<div class="ax-days">'+daychips(t.days,'data-axday')+'</div><div class="ax-hint">nichts gewählt = täglich</div>');
        h+=fld('Aktion — Szene anwenden',sceneSel(r.sceneId,'id="axScene"'));
      }
      else if(r.type==='circadian'){
        h+=fld('Lampen',devChips(r.devices,'data-axdev'));
        h+=fld('Farbtemperatur','<div class="ax-r">'+stepper('axMinK',r.minK,'K')+'<span class="ax-mut">bis</span>'+stepper('axMaxK',r.maxK,'K')+'</div><div class="ax-ramp"></div>');
        h+=fld('Helligkeit auch nachführen',tog(r.level!==false,' id="axLvl"'));
        h+=fld('Helligkeitsbereich','<div class="ax-r">'+stepper('axMinLvl',(r.minLevel!=null?r.minLevel:0),'%')+'<span class="ax-mut">bis</span>'+stepper('axMaxLvl',(r.maxLevel!=null?r.maxLevel:100),'%')+'</div>');
      }
      else if(r.type==='wake'){
        h+=fld('Weckzeit','<div class="ax-r"><input class="ax-time" type="time" id="axTime" value="'+esc(r.time||'06:30')+'">'+stepper('axRamp',(r.rampMin||0),'min Rampe')+'</div>');
        h+=fld('Wochentage','<div class="ax-days">'+daychips(r.days,'data-axday')+'</div>');
        h+=fld('Licht-Szene',sceneSel(r.sceneId,'id="axScene"'));
        h+=fld('Musik-Zone (optional)','<select class="ax-sel" id="axZone"><option value="0">— keine —</option>'+A.zones.map(function(z){return '<option value="'+z.id+'"'+(z.id==r.audioZone?' selected':'')+'>'+escL(z.name)+'</option>';}).join('')+'</select>'
          +' <input class="ax-in" id="axSrc" placeholder="Sender/Quelle" value="'+esc(r.audioSource||'')+'" style="width:clamp(90px,26cqi,150px)">');
      }
      else if(r.type==='motion'){
        h+=fld('Bewegungsmelder',sensorSel(r.sensor||0,A.motionSensors,'id="axSensor"'));
        h+=fld('Helligkeit (Lux-Variable, optional)','<div class="ax-r"><input class="ax-in ax-mono" id="axLux" type="number" value="'+(r.lux||'')+'" placeholder="Lux-Var" style="width:clamp(80px,24cqi,130px)"> '+stepper('axLuxMax',(r.luxMax||0),'lux max')+'</div>');
        h+=fld('Lampen',devChips(r.devices,'data-axdev'));
        h+=fld('Nachlaufzeit',stepper('axHold',Math.round((r.holdSec||0)/60),'min'));
        h+=fld('Helligkeit',stepper('axLevel',lvlTxt(r.level),''));
      }
      else if(r.type==='presence'){
        h+=fld('Abwesend-Sensor',sensorSel(r.awayVar||0,A.awaySensors,'id="axAway"'));
        h+=fld('Zeitfenster','<div class="ax-r"><input class="ax-time" type="time" id="axFrom" value="'+esc(r.from||'18:00')+'"><span class="ax-mut">bis</span><input class="ax-time" type="time" id="axTo" value="'+esc(r.to||'23:30')+'"></div>');
        h+=fld('Lampen (Auswahl)',devChips(r.devices,'data-axdev'));
        h+=fld('Takt',stepper('axEvery',(r.every||20),'min'));
      }
      h+='</div><div class="ax-foot"><button class="ax-btn prim" id="axSave">Speichern</button><button class="ax-btn" id="axTest">Jetzt testen</button><button class="ax-btn danger" id="axDel">Löschen</button></div></div>';
      return h;
    }
    function fld(l,b){return '<div class="ax-fld"><label>'+esc(l)+'</label>'+b+'</div>';}
    function stepper(id,val,unit){return '<span class="ax-stp"><button data-axdec="'+id+'">−</button><span class="ax-val" id="'+id+'">'+val+' '+esc(unit||'')+'</span><button data-axinc="'+id+'">+</button></span>';}
    function lvlTxt(v){return (v==null||v<0)?'voll':(v+' %');}   // -1 = volle Helligkeit
    function devChips(sel,attr){sel=sel||[];return '<div class="ax-chips">'+A.lights.map(function(l){var on=sel.indexOf(l.id)>=0;return '<button class="ax-chip'+(on?' on':'')+'" '+attr+'="'+l.id+'">'+escL(l.name)+'</button>';}).join('')+'</div>';}

    function editWire(h,w){
      var r=A.cfg.rules[A.sel]; if(!r)return;
      var nm=h.querySelector('#axName'); if(nm)nm.onchange=function(){r.name=this.value;};
      var en=h.querySelector('#axEnEd'); if(en)en.onclick=function(){r.enabled=!(r.enabled!==false);aSave();};
      h.querySelectorAll('[data-axtk]').forEach(function(e){e.onclick=function(){r.trigger=r.trigger||{};r.trigger.kind=e.getAttribute('data-axtk');paintOnly(w);};});
      var ev=h.querySelector('#axEv'); if(ev)ev.onchange=function(){r.trigger.event=this.value;};
      var tm=h.querySelector('#axTime'); if(tm)tm.onchange=function(){if(r.type==='schedule'){r.trigger.time=this.value;}else{r.time=this.value;}};
      var sc=h.querySelector('#axScene'); if(sc)sc.onchange=function(){r.sceneId=this.value;};
      var zn=h.querySelector('#axZone'); if(zn)zn.onchange=function(){r.audioZone=parseInt(this.value)||0;};
      var sr=h.querySelector('#axSrc'); if(sr)sr.onchange=function(){r.audioSource=this.value;};
      var lvl=h.querySelector('#axLvl'); if(lvl)lvl.onclick=function(){r.level=!(r.level!==false);paintOnly(w);};
      ['axSensor:sensor','axLux:lux','axAway:awayVar'].forEach(function(p){var a=p.split(':');var e=h.querySelector('#'+a[0]);if(e)e.onchange=function(){r[a[1]]=parseInt(this.value)||0;};});
      var fr=h.querySelector('#axFrom'); if(fr)fr.onchange=function(){r.from=this.value;};
      var to=h.querySelector('#axTo'); if(to)to.onchange=function(){r.to=this.value;};
      h.querySelectorAll('[data-axday]').forEach(function(e){e.onclick=function(){var d=(r.type==='schedule')?(r.trigger.days=r.trigger.days||[]):(r.days=r.days||[]);var i=+e.getAttribute('data-axday');var p=d.indexOf(i);if(p>=0)d.splice(p,1);else d.push(i);paintOnly(w);};});
      h.querySelectorAll('[data-axdev]').forEach(function(e){e.onclick=function(){r.devices=r.devices||[];var i=+e.getAttribute('data-axdev');var p=r.devices.indexOf(i);if(p>=0)r.devices.splice(p,1);else r.devices.push(i);paintOnly(w);};});
      // Stepper
      var steps={axOff:['trigger.offsetMin',5,'min'],axMinK:['minK',100,'K'],axMaxK:['maxK',100,'K'],axMinLvl:['minLevel',5,'%'],axMaxLvl:['maxLevel',5,'%'],axRamp:['rampMin',5,'min Rampe'],axLuxMax:['luxMax',10,'lux max'],axHold:['holdSecMin',1,'min'],axLevel:['level',5,'%'],axEvery:['every',5,'min']};
      function stepGet(key){if(key==='holdSecMin')return Math.round((r.holdSec||0)/60);if(key==='minLevel')return (r.minLevel!=null?r.minLevel:0);if(key==='maxLevel')return (r.maxLevel!=null?r.maxLevel:100);if(key.indexOf('.')>0){var pp=key.split('.');return (r[pp[0]]||{})[pp[1]]||0;}return r[key]||0;}
      function stepSet(key,v){if(key==='holdSecMin'){r.holdSec=Math.max(5,v)*60;return;}if(key==='minLevel'||key==='maxLevel'){r[key]=Math.max(0,Math.min(100,v));return;}if(key.indexOf('.')>0){var pp=key.split('.');r[pp[0]]=r[pp[0]]||{};r[pp[0]][pp[1]]=v;return;}r[key]=v;}
      function stepTxt(id,s){if(id==='axHold')return Math.round((r.holdSec||0)/60)+' '+s[2];if(id==='axLevel')return lvlTxt(r.level);return stepGet(s[0])+' '+s[2];}
      h.querySelectorAll('[data-axinc]').forEach(function(e){e.onclick=function(){var id=e.getAttribute('data-axinc');var s=steps[id];if(id==='axLevel'){var cur=(r.level==null?-1:r.level);r.level=(cur<0)?-1:(cur>=100?-1:Math.min(100,cur+5));}else{stepSet(s[0],stepGet(s[0])+s[1]);}var el=h.querySelector('#'+id);if(el)el.textContent=stepTxt(id,s);};});
      h.querySelectorAll('[data-axdec]').forEach(function(e){e.onclick=function(){var id=e.getAttribute('data-axdec');var s=steps[id];if(id==='axLevel'){var cur=(r.level==null?-1:r.level);r.level=(cur<0)?100:Math.max(0,cur-5);}else{stepSet(s[0],stepGet(s[0])-s[1]);}var el=h.querySelector('#'+id);if(el)el.textContent=stepTxt(id,s);};});
      var sv=h.querySelector('#axSave'); if(sv)sv.onclick=function(){if(nm)r.name=nm.value;aSave(function(){});};
      var dl=h.querySelector('#axDel'); if(dl)dl.onclick=function(){if(window.confirm('Regel löschen?')){A.cfg.rules.splice(A.sel,1);A.sel=-1;aSave();}};
      var ts=h.querySelector('#axTest'); if(ts)ts.onclick=function(){aSave(function(){fetch('?api=light&op=autotick&key='+encodeURIComponent(TOKEN),{method:'POST',cache:'no-store'});});};
    }
    function paintOnly(w){var hh=host(w);if(hh){hh.innerHTML=editRender();editWire(hh,w);}}

    // =============================== autocard ===============================
    function cardRender(w){
      var kind=w.kind||'schedule'; var meta=TYPES[kind]||TYPES.schedule;
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      var items=rulesOf(kind);
      var anyOn=items.some(function(o){return o.r.enabled!==false;});
      var rows=items.map(function(o){
        return '<div class="ax-citem" data-axopen="'+o.i+'"><span class="ax-cwhen">'+esc(aSummary(o.r))+'</span>'
          +'<span class="ax-cnm">'+escL(o.r.name||'')+'</span>'+tog(o.r.enabled!==false,' data-axen="'+o.i+'"')+'</div>';
      }).join('');
      var ramp=(kind==='circadian')?'<div class="ax-ramp"></div>':'';
      return '<div class="ax ax-card"><div class="ax-card-h '+(kind==='schedule'||kind==='wake'?'sun':'')+'"><span class="ax-ic">'+aIcon(kind)+'</span>'
        +'<span class="ax-card-t">'+esc(meta.plural)+'</span><span class="ax-card-c">'+items.length+'</span>'
        +tog(anyOn,' data-axgroup="'+kind+'"')+'</div><div class="ax-card-b">'+ramp
        +(rows||'<div class="ax-msg" style="padding:clamp(4px,2cqmin,8px) clamp(2px,1cqmin,4px)">keine</div>')
        +'<div class="ax-cadd" data-axadd="'+kind+'">＋ '+esc(meta.label)+' hinzufügen</div></div></div>';
    }
    function cardWire(h,w){
      h.querySelectorAll('[data-axen]').forEach(function(e){e.onclick=function(ev){ev.stopPropagation();var i=+e.getAttribute('data-axen');A.cfg.rules[i].enabled=!(A.cfg.rules[i].enabled!==false);aSave();};});
      h.querySelectorAll('[data-axopen]').forEach(function(e){e.onclick=function(ev){if(ev.target.closest('.ax-tog'))return;A.sel=+e.getAttribute('data-axopen');aEmit();};});
      var g=h.querySelector('[data-axgroup]');if(g)g.onclick=function(){var kind=g.getAttribute('data-axgroup');var items=rulesOf(kind);var anyOn=items.some(function(o){return o.r.enabled!==false;});items.forEach(function(o){o.r.enabled=!anyOn;});aSave();};
      var a=h.querySelector('[data-axadd]');if(a)a.onclick=function(){aAdd(a.getAttribute('data-axadd'));};
    }

    // ============================= autotimeline =============================
    function tlRender(){
      if(!A.cfg)return '<div class="ax"><div class="ax-msg">lädt …</div></div>';
      var sun=A.cfg.sun||{sunrise:360,sunset:1200};
      function pc(min){return Math.max(0,Math.min(100,min/1440*100));}
      var srp=pc(sun.sunrise), ssp=pc(sun.sunset);
      var marks='';
      (A.cfg.rules||[]).forEach(function(r,i){
        var off=(r.enabled===false)?' off':'';
        var min=-1,sunc=false,lbl=r.name||TYPES[r.type].label,tm='';
        if(r.type==='schedule'){var t=r.trigger||{};if(t.kind==='sun'){min=(t.event==='sunrise'?sun.sunrise:sun.sunset)+(t.offsetMin||0);sunc=true;tm=(t.event==='sunrise'?'SA':'SU')+(t.offsetMin?(t.offsetMin>0?'+':'')+t.offsetMin:'');}else{var p=(t.time||'0:0').split(':');min=(+p[0])*60+(+p[1]);tm=t.time;}}
        else if(r.type==='wake'){var q=(r.time||'6:30').split(':');min=(+q[0])*60+(+q[1]);tm=r.time;}
        if(min>=0){marks+='<div class="ax-mk'+(sunc?' sun':'')+off+'" style="left:'+pc(min)+'%" data-axopen="'+i+'"><span class="ax-mk-d">'+aIcon(r.type)+'</span><span class="ax-mk-l">'+escL(lbl)+'</span><span class="ax-mk-t">'+esc(tm)+'</span></div>';}
      });
      // spannen: motion (ganztags), presence (fenster) — auch deaktivierte, gedimmt
      var spans='';
      (A.cfg.rules||[]).forEach(function(r,i){var off=(r.enabled===false)?' off':'';
        // Spannen relativ zur Timeline-Hoehe (65 %/78 % entsprechen den bisherigen 150/230 bzw. 180/230 px),
        // damit sie jeder spaeteren Hoehenaenderung von .ax-tl folgen.
        if(r.type==='motion')spans+='<div class="ax-span motion'+off+'" style="left:1%;width:98%;top:65%" data-axopen="'+i+'">Bewegung: '+escL(r.name||'')+'</div>';
        if(r.type==='presence'){var f=(r.from||'18:00').split(':'),t2=(r.to||'23:30').split(':');var a=pc((+f[0])*60+(+f[1])),b=pc((+t2[0])*60+(+t2[1]));spans+='<div class="ax-span pres'+off+'" style="left:'+a+'%;width:'+Math.max(4,b-a)+'%;top:78%" data-axopen="'+i+'">Anwesenheit</div>';}
      });
      var hours='';[0,6,12,18,24].forEach(function(hh){hours+='<span class="ax-tl-h" style="left:'+(hh/24*100)+'%">'+hh+'</span>';});
      return '<div class="ax ax-tlwrap"><div class="ax-tl-scroll"><div class="ax-tl">'
        +'<div class="ax-tl-band night"></div><div class="ax-tl-band day" style="left:'+srp+'%;width:'+(ssp-srp)+'%"></div>'
        +'<div class="ax-tl-tick" style="left:'+srp+'%"></div><div class="ax-tl-tick" style="left:'+ssp+'%"></div>'
        +'<div class="ax-sun" style="left:'+srp+'%">☀</div><div class="ax-sun" style="left:'+ssp+'%">☾</div>'
        +marks+spans
        +'<div class="ax-tl-hours">'+hours+'</div></div></div>'
        +'<div class="ax-circ"><div class="ax-circ-l">Circadian über den Tag</div><div class="ax-ramp" style="height:clamp(8px,3cqmin,14px)"></div></div></div>';
    }
    function tlWire(h,w){h.querySelectorAll('[data-axopen]').forEach(function(e){e.onclick=function(){A.sel=+e.getAttribute('data-axopen');aEmit();};});}

    // =============================== Registrierung ===============================
    function mk(name,kind,size,rnd,wire){
      defWidget(name,{
        label:({autolist:'Automatik-Liste',autoedit:'Automatik-Detail',autocard:'Automatik-Karte',autotimeline:'Automatik-Tagesverlauf'})[name],
        cat:({autolist:'HomeSuite · Automatik',autoedit:'HomeSuite · Automatik',autocard:'HomeSuite · Automatik',autotimeline:'HomeSuite · Automatik'})[name],
        paletteIcon:'clock', size:size,
        defaults:function(w){if(name==='autocard')w.kind=w.kind||'schedule';},
        render:function(w){return rnd(w);},
        mount:function(w){var el=elOf(w);if(!el)return;
          function paint(){var hh=host(w);if(hh){hh.innerHTML=rnd(w);wire(hh,w);}}
          aSub(paint);                 // fuer Aenderungen an anderen Widgets (Auswahl/Speichern)
          if(A.cfg){paint();}else{aLoad(paint);}   // jedes Widget zeichnet sich selbst nach dem Laden
          LVB.panel.startPoll('autox:'+w.id,45000,function(){aLoad(paint);});
        },
        props:function(w){
          if(name!=='autocard')return '<div style="font-size:11px;color:var(--muted);padding:4px 2px">Teil der Automatik-Familie. Auf einer Seite mit autolist+autoedit kombinieren.</div>';
          var h='<div class="pgh">Kategorie</div>';
          h+=row('Typ','<select id="axKind">'+Object.keys(TYPES).map(function(k){return '<option value="'+k+'"'+(w.kind===k?' selected':'')+'>'+esc(TYPES[k].plural)+'</option>';}).join('')+'</select>');
          return h;
        },
        wire:function(w){if($('#axKind'))$('#axKind').onchange=function(){w.kind=this.value;commit();var hh=host(w);if(hh){hh.innerHTML=rnd(w);}};}
      });
    }
    mk('autolist',null,[300,520],listRender,listWire);
    mk('autoedit',null,[440,520],editRender,editWire);
    mk('autocard','schedule',[340,240],cardRender,cardWire);
    mk('autotimeline',null,[900,320],tlRender,tlWire);
  })();
