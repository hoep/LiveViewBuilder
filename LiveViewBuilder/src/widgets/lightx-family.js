  // ===== Widget-Familie Licht (lightx): lightgrid + lightroom =====
  //
  //  Entity-gebundene HomeSuite-Lichtsteuerung (Modul LightDevice/HSLT) ueber ?api=light.
  //  lightgrid : alle Lampen, gruppiert Geschoss -> Raum, je Lampe Toggle + Dimmer (+ Farbe/CT
  //              wenn faehig), Raum-Master (alle an/aus), Leistungssumme.
  //  lightroom : eine Auswahl (fester Raum w.roomId ODER Session 'light'), sonst identisch.
  //
  //  Schatten-Modus: solange die Zone armed=false ist, schreibt der Klick optimistisch die
  //  Statusvariable (Vorschau), schaltet aber NICHT die reale Lampe. Steuerung: setVar() auf
  //  die Power/Brightness-Variablen; Farbe/CT ueber ?api=light&op=manage (Token).
  (function(){
    var _lxData=null, _lxErr='';
    function lxLoad(cb){
      if(typeof DOKU!=='undefined'&&DOKU){_lxData=lxDemo();cb&&cb();return;}
      fetch('?api=light&op=getall',{cache:'no-store'}).then(function(r){return r.json();})
        .then(function(j){_lxData=(j&&j.lights)||[];_lxErr='';cb&&cb();})
        .catch(function(){_lxErr='net';cb&&cb();});
    }
    function lxDemo(){return [
      {id:1,name:'Kueche',room:'Kueche',floor:'Obergeschoss',on:true,level:70,color:-1,cct:0,watt:9,reachable:true,caps:{dim:true},armed:false,vars:{Power:1,Brightness:2,ColorTemp:0}},
      {id:2,name:'Esszimmer Tisch',room:'Esszimmer',floor:'Obergeschoss',on:false,level:0,color:-1,cct:0,watt:0,reachable:true,caps:{dim:true},armed:false,vars:{Power:3,Brightness:4,ColorTemp:0}},
      {id:3,name:'Stehlampe',room:'Wohnzimmer',floor:'Obergeschoss',on:true,level:-1,color:-1,cct:0,watt:8,reachable:true,caps:{dim:false},armed:false,vars:{Power:5,Brightness:0,ColorTemp:0}},
      {id:4,name:'Bad',room:'Bad',floor:'Erdgeschoss',on:false,level:0,color:-1,cct:0,watt:0,reachable:true,caps:{dim:true},armed:false,vars:{Power:6,Brightness:7,ColorTemp:0}}
    ];}

    var FLOOR_ORDER=['Erdgeschoss','Obergeschoss','Dachgeschoss','Garten','Wohnhaus'];
    function floorRank(f){var i=FLOOR_ORDER.indexOf(f);return i<0?99:i;}

    // Lampen fuer ein Widget filtern (alle, fester Raum, oder Session-Raum)
    function lxLampsFor(w){
      var all=_lxData||[];
      if(w._kind==='room'){
        var rid=0, rname='';
        if(w.bind==='session' && typeof hfSess==='function'){var s=hfSess({session:w.session||'light'});rname=(s&&s.room)||'';rid=(s&&s.roomId)||0;}
        else { rid=parseInt(w.roomId||0)||0; }
        return all.filter(function(l){return rid?(l.roomId===rid):(rname?(l.room===rname):true);});
      }
      return all;
    }

    // ---- Steuerung ----
    function lxToggle(l){ if(!l.vars||!l.vars.Power)return; if(typeof setVar==='function')setVar(l.vars.Power, l.on?0:1); l.on=!l.on; }
    function lxDim(l,val){ if(!l.vars||!l.vars.Brightness)return; if(typeof setVar==='function')setVar(l.vars.Brightness, val); l.level=val; if(val>0&&!l.on){l.on=true;if(l.vars.Power)setVar(l.vars.Power,1);} }
    function lxMaster(lamps,on){ lamps.forEach(function(l){ if(l.vars&&l.vars.Power&&(!!l.on!==on)){ if(typeof setVar==='function')setVar(l.vars.Power,on?1:0); l.on=on; } }); }

    // ---- Render ----
    function lxIcon(){return (typeof iconSVG==='function')?iconSVG('bulb',100):'';}
    function lxCard(l){
      var acc='var(--accent)';
      var on=!!l.on, dim=l.caps&&l.caps.dim, lvl=(l.level>=0?l.level:(on?100:0));
      var sub=[]; if(l.floor)sub.push(l.floor); if(l.watt>0)sub.push(Math.round(l.watt)+' W');
      var h='<div class="lxc'+(on?' on':'')+'" data-lxid="'+l.id+'">'
        +'<div class="lxc-h"><span class="lxc-ic">'+lxIcon()+'</span>'
        +'<span class="lxc-nm">'+escL(l.name||'')+'</span>'
        +'<span class="lxc-st">'+(on?(dim&&lvl<100&&lvl>0?lvl+'%':'Ein'):'Aus')+'</span></div>';
      if(dim){
        h+='<div class="lxc-dim"><input type="range" min="0" max="100" step="1" value="'+lvl+'" data-lxdim="'+l.id+'" aria-label="Helligkeit"></div>';
      }
      if(sub.length)h+='<div class="lxc-sub">'+esc(sub.join(' · '))+'</div>';
      h+='</div>';
      return h;
    }
    function lxRoomBlock(room,floor,lamps){
      var anyOn=lamps.some(function(l){return l.on;});
      var watt=lamps.reduce(function(a,l){return a+(l.watt>0?l.watt:0);},0);
      var h='<div class="lxr"><div class="lxr-h">'
        +'<span class="lxr-nm">'+escL(room||floor||'Ohne Raum')+'</span>'
        +'<span class="lxr-meta">'+lamps.length+(watt>0?(' · '+Math.round(watt)+' W'):'')+'</span>'
        +'<button class="lxr-master'+(anyOn?' on':'')+'" data-lxmaster="'+encodeURIComponent((floor||'')+'|'+(room||''))+'">'+(anyOn?'Alle aus':'Alle an')+'</button>'
        +'</div><div class="lxr-grid">'+lamps.map(lxCard).join('')+'</div></div>';
      return h;
    }
    function lxRender(w){
      var lamps=lxLampsFor(w);
      if(_lxErr) return '<div class="lxwrap"><div class="lx-msg">Licht nicht erreichbar</div></div>';
      if(!_lxData) return '<div class="lxwrap"><div class="lx-msg">Licht lädt …</div></div>';
      if(!lamps.length) return '<div class="lxwrap"><div class="lx-msg">Keine Lampen</div></div>';
      // Gruppieren: Geschoss -> Raum (Reihenfolge stabil)
      var groups={}, order=[];
      lamps.forEach(function(l){var key=(l.floor||'')+'||'+(l.room||'');if(!groups[key]){groups[key]={floor:l.floor,room:l.room,items:[]};order.push(key);}groups[key].items.push(l);});
      order.sort(function(a,b){var A=groups[a],B=groups[b];var fr=floorRank(A.floor)-floorRank(B.floor);if(fr)return fr;return (A.room||'').localeCompare(B.room||'');});
      var shadow=lamps.some(function(l){return l.armed===false;});
      var h='<div class="lxwrap">';
      if(shadow) h+='<div class="lx-shadow">Schatten-Modus – Vorschau, schaltet noch nicht real</div>';
      var curFloor=null;
      order.forEach(function(key){var g=groups[key];
        if(w._kind!=='room' && g.floor!==curFloor){curFloor=g.floor;h+='<div class="lx-floor">'+escL(g.floor||'')+'</div>';}
        h+=lxRoomBlock(g.room,g.floor,g.items);});
      h+='</div>';
      return h;
    }

    function lxEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function lxPaint(w){var el=lxEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=lxRender(w);lxWire(w,host);}
    function lxWire(w,host){
      host.querySelectorAll('[data-lxid]').forEach(function(c){
        c.addEventListener('click',function(e){
          if(e.target.closest('.lxc-dim'))return;
          var id=parseInt(c.getAttribute('data-lxid'));var l=(_lxData||[]).find(function(x){return x.id===id;});
          if(l){lxToggle(l);lxPaint(w);}
        });
      });
      host.querySelectorAll('[data-lxdim]').forEach(function(r){
        r.addEventListener('change',function(){var id=parseInt(r.getAttribute('data-lxdim'));var l=(_lxData||[]).find(function(x){return x.id===id;});if(l)lxDim(l,parseInt(r.value)||0);});
      });
      host.querySelectorAll('[data-lxmaster]').forEach(function(b){
        b.addEventListener('click',function(){
          var k=decodeURIComponent(b.getAttribute('data-lxmaster')).split('|');var fl=k[0],rm=k[1];
          var lamps=(_lxData||[]).filter(function(l){return (l.floor||'')===fl && (l.room||'')===rm;});
          var anyOn=lamps.some(function(l){return l.on;});
          lxMaster(lamps,!anyOn);lxPaint(w);
        });
      });
    }

    function lxDef(kind,label,defSize){
      defWidget(kind,{
        label:label, paletteIcon:'bulb', size:defSize,
        defaults:function(w){w._kind=(kind==='lightroom')?'room':'grid';if(kind==='lightroom'){w.bind='session';w.session='light';}},
        render:function(w){w._kind=(kind==='lightroom')?'room':'grid';return lxRender(w);},
        mount:function(w){w._kind=(kind==='lightroom')?'room':'grid';var el=lxEl(w);if(!el)return;
          if(kind==='lightroom'&&w.bind!=='fixed'&&typeof hfSub==='function')hfSub(w);
          lxLoad(function(){lxPaint(w);});
          LVB.panel.startPoll('lightx:'+w.id,10000,function(){lxLoad(function(){lxPaint(w);});});},
        _bind:function(w){lxPaint(w);},
        props:function(w){
          var h='';
          if(kind==='lightroom'){
            h+='<div class="pgh">Bindung</div>';
            h+=row('Modus','<select id="lxBind"><option value="session"'+(w.bind!=='fixed'?' selected':'')+'>Session (folgt Auswahl)</option><option value="fixed"'+(w.bind==='fixed'?' selected':'')+'>Fester Raum</option></select>');
            if(w.bind!=='fixed') h+=row('Session-ID','<input id="lxSess" value="'+esc(w.session||'light')+'" placeholder="light">');
            else h+=row('Raum (Instanz-ID)','<input id="lxRoom" type="number" value="'+(w.roomId||'')+'" placeholder="HSSP-Raum-ID">');
          } else {
            h+='<div style="font-size:11px;color:var(--muted);padding:4px 2px">Zeigt alle HomeSuite-Lampen, gruppiert nach Geschoss und Raum.</div>';
          }
          return h;
        },
        wire:function(w){
          if($('#lxBind'))$('#lxBind').onchange=function(){w.bind=this.value;commit();renderProps();lxPaint(w);};
          if($('#lxSess'))$('#lxSess').onchange=function(){w.session=this.value||undefined;commit();lxPaint(w);};
          if($('#lxRoom'))$('#lxRoom').onchange=function(){w.roomId=parseInt(this.value)||undefined;commit();lxPaint(w);};
        }
      });
    }
    lxDef('lightgrid','Licht-Übersicht',[720,520]);
    lxDef('lightroom','Licht-Raum',[360,320]);
  })();
