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
    if(!document.getElementById('lxfamCss')){var _s=document.createElement('style');_s.id='lxfamCss';_s.textContent=
      // Masse aus der Kachelgroesse (die Kachel ist ein Groessen-Container); Untergrenzen so,
      // dass Farbfeld und Scharf-Taste am Handy noch bedienbar bleiben (Tippziel >= 22px).
      '.lxc-cct{margin-top:clamp(4px,2cqmin,9px);display:flex;align-items:center;gap:clamp(4px,2cqmin,9px)}'
      +'.lxc-cct input[type=range]{flex:1;height:clamp(6px,2.5cqmin,10px);border-radius:6px;background:linear-gradient(90deg,#ff9d3b,#fff,#9dc4ff)}'
      +'.lxc-col{margin-top:clamp(4px,2cqmin,9px);display:flex;align-items:center;gap:clamp(4px,2cqmin,9px)}'
      +'.lxc-col label{font-size:clamp(10px,3.6cqmin,13px);color:var(--muted)}'
      +'.lxc-col input[type=color]{width:clamp(30px,9cqmin,44px);height:clamp(22px,6.5cqmin,30px);padding:0;border:1px solid var(--line,rgba(128,128,128,.35));border-radius:6px;background:none;cursor:pointer}'
      +'.lxr-arm{margin-left:6px;font-size:clamp(10px,3.4cqmin,13px);padding:clamp(4px,1.6cqmin,7px) clamp(8px,3cqmin,13px);min-height:22px;border-radius:12px;border:1px solid var(--line,rgba(128,128,128,.35));background:none;color:var(--muted);cursor:pointer}'
      +'.lxr-arm.armed{background:var(--accent);border-color:var(--accent);color:#fff}';
      document.head.appendChild(_s);}
    var _lxData=null, _lxErr='';
    function lxLoad(cb){
      if(typeof DOKU!=='undefined'&&DOKU){_lxData=lxDemo();cb&&cb();return;}
      fetch('?api=light&op=getall',{cache:'no-store'}).then(function(r){return r.json();})
        .then(function(j){_lxData=(j&&j.lights)||[];_lxErr='';cb&&cb();})
        .catch(function(){_lxErr='net';cb&&cb();});
    }
    function lxDemo(){return [
      {id:1,name:'Kueche',room:'Kueche',floor:'Obergeschoss',on:true,level:70,color:-1,cct:3200,watt:9,reachable:true,caps:{dim:true,cct:true,cctMin:2700,cctMax:6500},armed:false,vars:{Power:1,Brightness:2,ColorTemp:8}},
      {id:2,name:'Esszimmer Tisch',room:'Esszimmer',floor:'Obergeschoss',on:false,level:0,color:0xE0A030,cct:0,watt:0,reachable:true,caps:{dim:true,color:true},armed:true,vars:{Power:3,Brightness:4,ColorTemp:0}},
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

    // Farbe/Farbtemperatur/Scharfschalten ueber die Modul-Management-Op (Token noetig).
    function lxManage(id,body,cb){
      if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();return;}
      fetch('?api=light&op=manage&id='+id+'&key='+encodeURIComponent(TOKEN),
        {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)})
        .then(function(r){return r.json();})
        .then(function(j){ if(j&&j.note&&typeof toast==='function')toast(j.note); cb&&cb(); })
        .catch(function(){ if(typeof toast==='function')toast('Licht: Verbindungsfehler'); });
    }
    function lxSetCct(l,kelvin){ l.cct=kelvin; lxManage(l.id,{op:'setCct',args:{kelvin:kelvin}}); }
    function lxSetColor(l,rgb){ l.color=rgb; lxManage(l.id,{op:'setColor',args:{rgb:rgb}}); }
    function lxSetArmed(l,armed){ l.armed=armed; lxManage(l.id,{op:'setArmed',args:{armed:armed}}); }
    // #rrggbb <-> int 0xRRGGBB
    function lxHex(rgb){ if(rgb==null||rgb<0)return '#ffffff'; var s=(rgb&0xFFFFFF).toString(16); while(s.length<6)s='0'+s; return '#'+s; }
    function lxInt(hex){ return parseInt(String(hex||'').replace('#',''),16)||0; }

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
      var caps=l.caps||{};
      if(caps.cct){
        var kMin=parseInt(caps.cctMin)||2700, kMax=parseInt(caps.cctMax)||6500;
        var kVal=(l.cct>0?l.cct:Math.round((kMin+kMax)/2));
        if(kVal<kMin)kVal=kMin; if(kVal>kMax)kVal=kMax;
        h+='<div class="lxc-cct"><input type="range" min="'+kMin+'" max="'+kMax+'" step="100" value="'+kVal+'" data-lxcct="'+l.id+'" aria-label="Farbtemperatur">'
          +'<span class="lxc-st">'+kVal+' K</span></div>';
      }
      if(caps.color){
        h+='<div class="lxc-col"><label>Farbe</label><input type="color" value="'+lxHex(l.color)+'" data-lxcol="'+l.id+'" aria-label="Farbe"></div>';
      }
      if(sub.length)h+='<div class="lxc-sub">'+esc(sub.join(' · '))+'</div>';
      h+='</div>';
      return h;
    }
    function lxRoomBlock(room,floor,lamps){
      var anyOn=lamps.some(function(l){return l.on;});
      var watt=lamps.reduce(function(a,l){return a+(l.watt>0?l.watt:0);},0);
      var allArmed=lamps.length>0&&lamps.every(function(l){return l.armed===true;});
      var key=encodeURIComponent((floor||'')+'|'+(room||''));
      var h='<div class="lxr"><div class="lxr-h">'
        +'<span class="lxr-nm">'+escL(room||floor||'Ohne Raum')+'</span>'
        +'<span class="lxr-meta">'+lamps.length+(watt>0?(' · '+Math.round(watt)+' W'):'')+'</span>'
        +'<button class="lxr-master'+(anyOn?' on':'')+'" data-lxmaster="'+key+'">'+(anyOn?'Alle aus':'Alle an')+'</button>'
        +'<button class="lxr-arm'+(allArmed?' armed':'')+'" data-lxarm="'+key+'" title="'+(allArmed?'Scharf geschaltet – klick für Schatten-Modus':'Schatten-Modus – klick zum Scharfschalten')+'">'+(allArmed?'Scharf':'Schatten')+'</button>'
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

    // WebSocket-Push: die Power/Brightness-Variablen der angezeigten Lampen im Live-Index
    // anmelden (w.items[].vid) -> der Client verteilt WS-Pushes an unser live(); Server-Abo
    // liefert das LVB-Push-Modul (HSLT-Steuervariablen). Danach Index neu bauen lassen.
    function lxSetItems(w){
      var it=[]; lxLampsFor(w).forEach(function(l){ if(l.vars){ if(l.vars.Power)it.push({vid:l.vars.Power}); if(l.vars.Brightness)it.push({vid:l.vars.Brightness}); if(l.vars.ColorTemp)it.push({vid:l.vars.ColorTemp}); } });
      w.items=it;
      if(typeof invalidateVidx==='function')invalidateVidx();
    }
    // Repaint bündeln (ein Szenen-Apply pusht viele Variablen kurz hintereinander).
    var _lxRp={};
    function lxSchedule(w){ if(_lxRp[w.id])return; _lxRp[w.id]=setTimeout(function(){_lxRp[w.id]=null;lxPaint(w);},60); }
    function lxWire(w,host){
      host.querySelectorAll('[data-lxid]').forEach(function(c){
        c.addEventListener('click',function(e){
          if(e.target.closest('.lxc-dim,.lxc-cct,.lxc-col'))return;
          var id=parseInt(c.getAttribute('data-lxid'));var l=(_lxData||[]).find(function(x){return x.id===id;});
          if(l){lxToggle(l);lxPaint(w);}
        });
      });
      host.querySelectorAll('[data-lxdim]').forEach(function(r){
        r.addEventListener('change',function(){var id=parseInt(r.getAttribute('data-lxdim'));var l=(_lxData||[]).find(function(x){return x.id===id;});if(l)lxDim(l,parseInt(r.value)||0);});
      });
      host.querySelectorAll('[data-lxcct]').forEach(function(r){
        r.addEventListener('input',function(){var lab=r.parentNode&&r.parentNode.querySelector('.lxc-st');if(lab)lab.textContent=(parseInt(r.value)||0)+' K';});
        r.addEventListener('change',function(){var id=parseInt(r.getAttribute('data-lxcct'));var l=(_lxData||[]).find(function(x){return x.id===id;});if(l)lxSetCct(l,parseInt(r.value)||0);});
      });
      host.querySelectorAll('[data-lxcol]').forEach(function(p){
        p.addEventListener('change',function(){var id=parseInt(p.getAttribute('data-lxcol'));var l=(_lxData||[]).find(function(x){return x.id===id;});if(l)lxSetColor(l,lxInt(p.value));});
      });
      host.querySelectorAll('[data-lxarm]').forEach(function(b){
        b.addEventListener('click',function(){
          var k=decodeURIComponent(b.getAttribute('data-lxarm')).split('|');var fl=k[0],rm=k[1];
          var lamps=(_lxData||[]).filter(function(l){return (l.floor||'')===fl && (l.room||'')===rm;});
          var allArmed=lamps.length>0&&lamps.every(function(l){return l.armed===true;});
          var next=!allArmed;
          lamps.forEach(function(l){lxSetArmed(l,next);});
          lxPaint(w);
        });
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
        label:label, cat:'HomeSuite · Licht', paletteIcon:'bulb', size:defSize,
        defaults:function(w){w._kind=(kind==='lightroom')?'room':'grid';if(kind==='lightroom'){w.bind='session';w.session='light';}},
        render:function(w){w._kind=(kind==='lightroom')?'room':'grid';return lxRender(w);},
        mount:function(w){w._kind=(kind==='lightroom')?'room':'grid';var el=lxEl(w);if(!el)return;
          if(kind==='lightroom'&&w.bind!=='fixed'&&typeof hfSub==='function')hfSub(w);
          lxLoad(function(){lxSetItems(w);lxPaint(w);});
          // Voll-Refresh nur noch langsam (neue Lampen / Raumwechsel); Live-Zustand kommt per WebSocket.
          LVB.panel.startPoll('lightx:'+w.id,60000,function(){lxLoad(function(){lxSetItems(w);lxPaint(w);});});},
        // WS-Push je Variable -> Modell aktualisieren, gebündelt neu zeichnen
        live:function(w,el,id,d){
          var l=(_lxData||[]).find(function(x){return x.vars&&(x.vars.Power===id||x.vars.Brightness===id||x.vars.ColorTemp===id);});
          if(!l)return; var v=d&&d.v;
          if(l.vars.Power===id){l.on=(v===true||v===1||v==='1'||String(v).toLowerCase()==='true');}
          if(l.vars.Brightness===id){var n=parseFloat(String(v).replace(',','.'));if(!isNaN(n)){l.level=Math.round(n);if(l.level>0)l.on=true;else l.on=false;}}
          if(l.vars.ColorTemp===id){var c=parseInt(v);if(!isNaN(c))l.cct=c;}
          lxSchedule(w);
        },
        _bind:function(w){lxSetItems(w);lxPaint(w);},
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
