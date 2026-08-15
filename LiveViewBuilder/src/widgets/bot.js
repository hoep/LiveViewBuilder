  // ===== Widget: Bot (Roboter) — Saug-/Mähroboter =====
  // Frueher Typ 'vacuum' (umbenannt -> Migration vacuum->bot in 11-migrate.js). Alte Layouts bleiben gueltig.
  //  · Einfach (Bestand): varId=Status, varId2=Akku, Start/Stop.
  //  · Mäher (w.mowerId): volle Karte (Markup/CSS 1:1 aus dem freigegebenen Design-Mock), zieht Status/Akku/
  //    Aktivitaet/Kommandos live ueber ?api=mower&op=getall, schaltet ueber ?api=setvar (armed-Gate im Modul).
  (function(){
    // Icons exakt aus dem Mock (Stroke via CSS)
    var IH='<svg viewBox="0 0 24 24"><path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/></svg>';
    var IMOW='<svg viewBox="0 0 24 24"><path d="M7 4v16l13 -8l-13 -8"/></svg>';
    var IPAU='<svg viewBox="0 0 24 24"><path d="M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12"/><path d="M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12"/></svg>';
    var IRES='<svg viewBox="0 0 24 24"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>';
    var ICUT='<svg viewBox="0 0 24 24"><path d="M5 21c.5 -4.5 2.5 -8 7 -10"/><path d="M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3l.014 0"/></svg>';
    var IHEAD='<svg viewBox="0 0 24 24"><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"/><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"/><path d="M9.7 17l4.6 0"/></svg>';
    var IBOLT='<svg viewBox="0 0 24 24"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/></svg>';
    var ICLK='<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/></svg>';
    var IMIN='<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>';
    var IPLU='<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    // Echte Roboter-Mäher-Zustands-Icons
    var IMOWER='<svg viewBox="0 0 24 24"><path d="M3 14c0 -3.6 3.6 -6 9 -6s9 2.4 9 6"/><path d="M3 14h18"/><path d="M14.5 10.5h.01"/><path d="M10 17.5h4"/><path d="M9.5 17.5a2 2 0 1 1 -4 0a2 2 0 0 1 4 0"/><path d="M18.5 17.5a2 2 0 1 1 -4 0a2 2 0 0 1 4 0"/></svg>';
    var ICHG='<svg viewBox="0 0 24 24"><path d="M3 20h18"/><path d="M5 20v-2.5a7 7 0 0 1 14 0v2.5"/><path d="M12.6 7.5l-2.2 3.4h3l-2.2 3.4"/></svg>';
    var IWARNM='<svg viewBox="0 0 24 24"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 4.3l-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7 -3l-8 -14a2 2 0 0 0 -3.4 0"/></svg>';
    // Aktivitätscode -> Zustands-Icon (0 unbek,2 mäht,3 fährt heim,4 lädt,5 verlässt,6 in Ladestation,7 gestoppt)
    function stIcon(a){ if(a===4||a===6)return ICHG; if(a===7)return IWARNM; return IMOWER; }
    var HLLBL=['Immer an','Immer aus','Nur abends','Abends & nachts'];

    var _botM={}, _botPoll={}, _botMowers=null;

    function botCard(w,m){
      var actC=+m.activity||0, mow=(actC===2||actC===5), pill=mow?'mow':'dock', aic=stIcon(actC);
      var bat=Math.max(0,Math.min(100,+m.battery||0)), R=52, C=2*Math.PI*R, off=C*(1-bat/100);
      var info='<span class="ii"><span class="ondot"'+(m.online?'':' style="background:var(--faint)"')+'></span>'+(m.online?'Online':'Offline')+'</span>';
      if(m.inChargingStation)info+='<span class="sep">·</span><span class="ii">'+IBOLT+'Geladen</span>';
      if(m.nextStartText&&+m.nextStart>0)info+='<span class="sep">·</span><span class="ii">'+ICLK+'Nächster Start <b>'+esc(m.nextStartText)+'</b></span>';
      function cb(k,label,ic,pri){var v=(m.vars||{})[k]||0;if(!v)return '';return '<button class="cbtn'+(pri?' pri':'')+'" data-bcmd="'+k+'">'+ic+'<span>'+esc(label)+'</span></button>';}
      var cmds=cb('Start','Mähen',IMOWER,1)+cb('Park','Parken',IH)+cb('Pause','Pause',IPAU)+cb('Resume','Weiter',IRES);
      var cut=(+m.cuttingHeight)||0, dots='';for(var i=1;i<=9;i++)dots+='<i'+(i<=cut?' class="on"':'')+'></i>';
      var cutBlk=(m.vars||{}).CuttingHeight?('<div class="sblk"><div class="slbl">'+ICUT+'Schnitthöhe</div><div class="stepper"><button class="stepbtn" data-bcut="-1">'+IMIN+'</button><div class="stepval">'+(cut||'–')+'<small> / 9</small></div><button class="stepbtn" data-bcut="1">'+IPLU+'</button></div><div class="stepdots">'+dots+'</div></div>'):'';
      var autoBlk='';
      if((m.vars||{}).AutoMode){var am=+m.autoMode||0,AM=['Auto','Pause','Manuell','Logik'],recTxt=m.recText||'',recOk=!!m.recMow;
        autoBlk='<div class="autoblk"><div class="slbl">'+IMOWER+'Automatik'+(recTxt?'<span class="autorec '+(recOk?'ok':'no')+'">'+esc(recTxt)+'</span>':'')+'</div>'
          +'<div class="autoseg">'+AM.map(function(t,i){return '<button data-bam="'+i+'"'+(i===am?' class="on"':'')+'>'+esc(t)+'</button>';}).join('')+'</div></div>';}
      var hlBlk='';
      if((m.vars||{}).Headlight){var hi=+m.headlight||0;
        hlBlk='<div class="sblk"><div class="slbl">'+IHEAD+'Scheinwerfer</div><div class="seg2">'+HLLBL.map(function(t,i){return '<button data-bhl="'+i+'"'+(i===hi?' class="on"':'')+'>'+esc(t)+'</button>';}).join('')+'</div></div>';}
      return '<div class="mtop"><div class="mbadge">'+IMOWER+'</div><div><div class="mname">'+escL(w.label||m.name||'Mäher')+'</div>'+(m.model?'<div class="mmodel">Husqvarna '+esc(m.model)+'</div>':'')+'</div><div class="mline-sp"></div><div class="pill '+pill+'">'+aic+esc(m.activityText||'')+'</div></div>'
        +'<div class="hero"><svg class="bring" viewBox="0 0 120 120"><circle class="brbg" cx="60" cy="60" r="52"/><circle class="brfg" cx="60" cy="60" r="52" transform="rotate(-90 60 60)" style="stroke-dasharray:'+C.toFixed(1)+';stroke-dashoffset:'+off.toFixed(1)+'"/><text x="60" y="61" class="brv">'+Math.round(bat)+'<tspan class="bru">%</tspan></text><text x="60" y="83" class="brl">AKKU</text></svg>'
        +'<div class="herox"><div class="actrow"><span class="actic">'+aic+'</span><span class="actbig">'+esc(m.activityText||'')+'</span></div>'
        +'<div class="stusrow">Status: <b>'+esc(m.stateText||'—')+'</b>'+(m.mode?' · Modus: <b>'+esc(m.mode)+'</b>':'')+'</div>'
        +'<div class="infoline">'+info+'</div></div></div>'
        +'<div class="divider"></div><div class="ctlrow">'+cmds+'</div>'
        +((cutBlk||hlBlk)?'<div class="srow">'+cutBlk+hlBlk+'</div>':'')
        +autoBlk;
    }
    function botPaint(w){
      var el=document.querySelector('.w[data-id="'+w.id+'"] [data-role=botroot]'); if(!el)return;
      var m=_botM[w.id];
      if(!m){el.innerHTML='<div class="load">'+(w.mowerId?'Mäher nicht gefunden':'Mäher wählen')+'</div>';return;}
      el.innerHTML=botCard(w,m); el._botM=m;
    }
    function botFetch(w){ if(!w.mowerId)return;
      fetch('?api=mower&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        var list=(j&&j.mowers)||[],m=null;for(var i=0;i<list.length;i++){if(String(list[i].id)===String(w.mowerId)){m=list[i];break;}}
        _botM[w.id]=m; botPaint(w);
      }).catch(function(){});
    }
    function botLoadMowers(cb){fetch('?api=mower&op=list',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){_botMowers=(j&&j.mowers)||[];cb&&cb();}).catch(function(){_botMowers=[];cb&&cb();});}

    defWidget('bot',{
      label:'Roboter', cat:'HomeSuite', paletteIcon:'mower', size:[210,112],
      render:function(w){
        if(w.mowerId) return '<div class="hbot mowerx"><div data-role="botroot"><div class="load">Mäher lädt…</div></div></div>';
        return '<div class="hvac"><div class="hvrow"><span class="hvicon">'+iconSVG(w.icon||'mower')+'</span><span class="hvst" data-role="val">–</span><span class="hvbat" data-role="sub">–</span></div><div class="hvbtn"><button data-role="vstart">Start</button><button data-role="vstop">Stop</button></div></div>';
      },
      mount:function(w){ if(!w.mowerId)return; botFetch(w);
        if(_botPoll[w.id])clearInterval(_botPoll[w.id]);
        _botPoll[w.id]=setInterval(function(){botFetch(w);},15000);
      },
      live:function(w,el,id,d,base,txt,on){ if(w.mowerId)return;
        if(w.varId===id){var vs=$('[data-role=val]',el);if(vs)vs.textContent=txt;}
        if(w.varId2===id){var vb=$('[data-role=sub]',el);if(vb)vb.textContent=txt;}
      },
      click:function(w,el,e){ if(!w.mowerId)return false;
        var root=el.querySelector('[data-role=botroot]'),m=root&&root._botM; if(!m)return false;
        var bc=e.target.closest('[data-bcmd]');
        if(bc){var k=bc.getAttribute('data-bcmd'),v=(m.vars||{})[k];if(v)setVar(v,k==='Start'?0:1);return true;}
        var cu=e.target.closest('[data-bcut]');
        if(cu){var vc=(m.vars||{}).CuttingHeight;if(vc){var nv=Math.max(1,Math.min(9,(+m.cuttingHeight||0)+parseInt(cu.getAttribute('data-bcut'),10)));setVar(vc,nv);}return true;}
        var hb=e.target.closest('[data-bhl]');
        if(hb){var vh=(m.vars||{}).Headlight;if(vh)setVar(vh,parseInt(hb.getAttribute('data-bhl'),10));return true;}
        var ab=e.target.closest('[data-bam]');
        if(ab){var va=(m.vars||{}).AutoMode;if(va)setVar(va,parseInt(ab.getAttribute('data-bam'),10));return true;}
        return false;
      },
      props:function(w){
        var h=row('Mäher (HomeSuite)','<select id="pBotMower"><option value="">— aus (einfacher Roboter) —</option>'
          +(_botMowers||[]).map(function(o){return '<option value="'+o.id+'"'+(String(w.mowerId)===String(o.id)?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</select>');
        h+=row('Bezeichnung','<input id="pBotName" value="'+esc(w.label||'')+'" placeholder="z. B. Automower Lefty">');
        if(!w.mowerId)h+='<div style="font-size:11px;color:var(--muted);margin:4px 2px">Einfacher Modus: Variable = Status, Variable 2 = Akku, Variable 3 = Start/Stop.</div>';
        return h;
      },
      wire:function(w){
        if(!_botMowers)botLoadMowers(function(){renderProps();});
        if($('#pBotMower'))$('#pBotMower').onchange=function(){w.mowerId=parseInt(this.value)||undefined;render();renderProps();commit();};
        if($('#pBotName'))$('#pBotName').oninput=function(){w.label=this.value;if(w.mowerId)botPaint(w);else render();commit();};
      }
    });
  })();
