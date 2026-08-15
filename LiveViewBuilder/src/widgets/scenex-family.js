  // ===== Widget-Familie Szenen (scenex): scenebar + sceneeditor =====
  //
  //  Licht-Szenen (Haus-Ebene, HomeSuite Hub/HSH ueber ?api=light&op=scene*).
  //  scenebar   : Szenen als Chips -> Klick wendet an; "+ Aufnehmen" schnappt den Ist-Zustand.
  //  sceneeditor: Szenen anlegen (aufnehmen)/umbenennen/duplizieren/loeschen + Mitglieder
  //               (An/Aus + Helligkeit) authored bearbeiten und speichern.
  //  Schatten-Modus: Anwenden schreibt optimistisch (Vorschau), schaltet erst bei armed real.
  (function(){
    function scGet(op,extra){return fetch('?api=light&op='+op+(extra||''),{cache:'no-store'}).then(function(r){return r.json();});}
    function scPost(op,body){return fetch('?api=light&op='+op+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body||{})}).then(function(r){return r.json();});}

    var _scenes=null, _lights=null;
    function loadScenes(cb){scGet('scenes').then(function(j){_scenes=(j&&j.scenes)||[];cb&&cb();}).catch(function(){_scenes=[];cb&&cb();});}
    function loadLights(cb){scGet('getall').then(function(j){_lights=(j&&j.lights)||[];cb&&cb();}).catch(function(){_lights=[];cb&&cb();});}
    function lightById(id){return (_lights||[]).find(function(l){return l.id===id;});}

    function scScope(w){
      var t=w.scope||'house';
      if(t==='room'&&w.roomId) return {type:'room',ref:String(parseInt(w.roomId)||0)};
      if(t==='floor'&&w.floor) return {type:'floor',ref:String(w.floor)};
      return {type:'house',ref:''};
    }

    // ---------- scenebar ----------
    function barRender(w){
      if(typeof DOKU!=='undefined'&&DOKU) _scenes=_scenes||[{id:'abend',name:'Abend',count:6},{id:'aus',name:'Alles aus',count:39},{id:'tv',name:'TV',count:4}];
      if(!_scenes) return '<div class="scb"><span class="scb-msg">Szenen …</span></div>';
      var chips=_scenes.map(function(s){return '<button class="scb-chip" data-scapply="'+esc(s.id)+'"><span class="scb-ic">'+(typeof iconSVG==='function'?iconSVG(s.icon||'bulb',100):'')+'</span>'+escL(s.name)+'</button>';}).join('');
      var cap = (w.showCapture===false)?'':'<button class="scb-chip scb-cap" data-sccapture="1">＋ Aufnehmen</button>';
      return '<div class="scb">'+(chips||'<span class="scb-msg">Noch keine Szenen</span>')+cap+'</div>';
    }
    function barWire(w,host){
      host.querySelectorAll('[data-scapply]').forEach(function(b){b.onclick=function(){
        var id=b.getAttribute('data-scapply');b.classList.add('busy');
        scPost('sceneapply',{id:id}).then(function(){b.classList.remove('busy');if(typeof pollVals==='function')setTimeout(pollVals,250);});
      };});
      var cb=host.querySelector('[data-sccapture]');
      if(cb)cb.onclick=function(){
        var name=window.prompt('Name der neuen Szene (nimmt den aktuellen Licht-Zustand auf):','Szene');
        if(!name)return;
        scPost('scenecapture',{name:name,scope:scScope(w)}).then(function(){loadScenes(function(){barPaint(w);});});
      };
    }
    function scEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function barPaint(w){var el=scEl(w);if(!el)return;var h=el.querySelector('.winner')||el;h.innerHTML=barRender(w);barWire(w,h);}

    // ---------- sceneeditor ----------
    var _sel={};
    var SC_ICONS=['bulb','sun','moon','tv','bed','home'];
    function colHex(c){c=parseInt(c);if(isNaN(c)||c<0)return '#ffffff';return '#'+('000000'+(c&0xffffff).toString(16)).slice(-6);}
    function colInt(h){h=String(h||'').replace('#','');var n=parseInt(h,16);return isNaN(n)?-1:(n&0xffffff);}
    function edCss(){
      if(document.getElementById('lvb-scenex-ext-css'))return;
      var s=document.createElement('style');s.id='lvb-scenex-ext-css';
      // Groessen aus der Kachel: Breiten ueber cqi (Kachelbreite), Schrift/Tippziele ueber cqmin.
      // clamp haelt die Icon-Buttons am Handy bedienbar (>=26px) und auf grossen Kacheln in Form.
      s.textContent=
        '.sced-scopesel{font:inherit;font-size:clamp(10px,3cqmin,13px);padding:clamp(3px,1.6cqmin,7px) clamp(5px,2.2cqmin,9px);border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer}'
       +'.sced-trans{width:clamp(56px,14cqi,92px);font:inherit;font-size:clamp(10px,3cqmin,13px);padding:clamp(3px,1.6cqmin,7px) clamp(5px,2.2cqmin,9px);border-radius:8px;border:1px solid var(--line);background:var(--tile);color:var(--text)}'
       +'.sced-translbl{display:inline-flex;align-items:center;gap:6px;font-size:clamp(9px,2.6cqmin,11px);text-transform:uppercase;letter-spacing:.05em;color:var(--faint)}'
       +'.sced-iconpick{display:flex;flex-wrap:wrap;gap:6px}'
       +'.sced-ib{width:clamp(26px,7.5cqmin,38px);height:clamp(26px,7.5cqmin,38px);padding:clamp(3px,1.4cqmin,6px);display:inline-flex;align-items:center;justify-content:center;border-radius:9px;border:1px solid var(--line-soft);background:var(--tile);color:var(--muted);cursor:pointer}'
       +'.sced-ib.on{border-color:var(--accent);color:var(--accent);background:color-mix(in oklab,var(--accent) 10%,var(--tile))}'
       +'.sced-ib svg{width:clamp(14px,4.5cqmin,22px);height:clamp(14px,4.5cqmin,22px)}'
       +'.sced-mcct{width:clamp(60px,18cqi,120px);accent-color:var(--warm)}'
       +'.sced-mcolor{width:clamp(24px,7cqi,34px);height:clamp(20px,6cqmin,28px);padding:0;border:1px solid var(--line);border-radius:6px;background:none;cursor:pointer}';
      document.head.appendChild(s);
    }
    function edRender(w){
      edCss();
      if(!_scenes||!_lights) return '<div class="sced"><div class="scb-msg" style="padding:16px">lädt …</div></div>';
      var selId=_sel[w.id]||(_scenes[0]&&_scenes[0].id)||'';
      var list=_scenes.map(function(s){return '<button class="sced-item'+(s.id===selId?' on':'')+'" data-scsel="'+esc(s.id)+'">'+escL(s.name)+'<span class="sced-cnt">'+s.count+'</span></button>';}).join('');
      var right='';
      var sc=_scenes.find(function(s){return s.id===selId;});
      if(!sc){ right='<div class="scb-msg" style="padding:16px">Szene wählen oder neu aufnehmen.</div>'; }
      else {
        // Detail laden liegt in _sel-Cache (via edLoadDetail); hier nur Kopf + Mitglieder wenn vorhanden
        var det=_sel['_det_'+w.id];
        var scopeType=(det&&det.scope&&det.scope.type)||(sc.scope&&sc.scope.type)||'house';
        var trans=(det&&typeof det.transitionMs!=='undefined')?(parseInt(det.transitionMs)||0):0;
        var curIcon=(det&&det.icon)||sc.icon||'bulb';
        right='<div class="sced-head"><input class="sced-name" id="scName_'+w.id+'" value="'+esc(sc.name)+'">'
          +'<select class="sced-scopesel" id="scScopeSel_'+w.id+'">'
            +'<option value="house"'+(scopeType==='house'?' selected':'')+'>Haus</option>'
            +'<option value="floor"'+(scopeType==='floor'?' selected':'')+'>Geschoss</option>'
            +'<option value="room"'+(scopeType==='room'?' selected':'')+'>Raum</option>'
          +'</select>'
          +'<label class="sced-translbl">Blende<input class="sced-trans" id="scTrans_'+w.id+'" type="number" min="0" step="100" value="'+trans+'">ms</label>'
          +'</div>'
          +'<div class="sced-iconpick">'+SC_ICONS.map(function(ic){return '<button type="button" class="sced-ib'+(ic===curIcon?' on':'')+'" data-scicon="'+ic+'" title="'+ic+'">'+(typeof iconSVG==='function'?iconSVG(ic,100):'')+'</button>';}).join('')+'</div>'
          +'<div class="sced-actions">'
          +'<button data-scact="apply">Anwenden</button>'
          +'<button data-scact="recap">Ist übernehmen</button>'
          +'<button data-scact="dup">Duplizieren</button>'
          +'<button data-scact="del" class="danger">Löschen</button>'
          +'<button data-scact="save" class="prim">Speichern</button></div>';
        if(det&&det.members){
          right+='<div class="sced-members">'+det.members.map(function(m){
            var l=lightById(m.device); var nm=l?l.name:('#'+m.device); var caps=(l&&l.caps)||{};
            var s='<div class="sced-m"><label class="sced-mtog"><input type="checkbox" data-scmon="'+m.device+'"'+(m.on?' checked':'')+'> '+escL(nm)+'</label>'
              +(caps.dim?'<input type="range" min="0" max="100" step="1" value="'+(m.level>=0?m.level:100)+'" data-scmlvl="'+m.device+'">':'<span class="sced-nodim">—</span>');
            if(caps.cct){var cmin=parseInt(caps.cctMin)||2700,cmax=parseInt(caps.cctMax)||6500,cv=(m.cct>0?m.cct:cmin);
              s+='<input type="range" class="sced-mcct" min="'+cmin+'" max="'+cmax+'" step="50" value="'+cv+'" data-scmcct="'+m.device+'" title="Farbtemperatur '+cv+' K">';}
            if(caps.color){s+='<input type="color" class="sced-mcolor" value="'+colHex(m.color)+'" data-scmcolor="'+m.device+'" title="Farbe">';}
            return s+'</div>';
          }).join('')+'</div>';
        } else {
          right+='<div class="scb-msg" style="padding:12px">Mitglieder werden geladen …</div>';
        }
      }
      return '<div class="sced"><div class="sced-list">'+list
        +'<button class="sced-item sced-new" data-scnew="1">＋ Neu (aufnehmen)</button></div>'
        +'<div class="sced-detail">'+right+'</div></div>';
    }
    function edLoadDetail(w,cb){
      var selId=_sel[w.id]||(_scenes&&_scenes[0]&&_scenes[0].id)||'';
      if(!selId){_sel['_det_'+w.id]=null;cb&&cb();return;}
      scGet('scene','&id='+encodeURIComponent(selId)).then(function(j){_sel['_det_'+w.id]=(j&&j.scene)||null;cb&&cb();}).catch(function(){cb&&cb();});
    }
    function edPaint(w){var el=scEl(w);if(!el)return;var h=el.querySelector('.winner')||el;h.innerHTML=edRender(w);edWire(w,h);}
    function edWire(w,host){
      host.querySelectorAll('[data-scsel]').forEach(function(b){b.onclick=function(){_sel[w.id]=b.getAttribute('data-scsel');edLoadDetail(w,function(){edPaint(w);});};});
      var nw=host.querySelector('[data-scnew]');
      if(nw)nw.onclick=function(){var name=window.prompt('Neue Szene (nimmt aktuellen Zustand auf):','Szene');if(!name)return;
        scPost('scenecapture',{name:name,scope:scScope(w)}).then(function(r){if(r&&r.scene)_sel[w.id]=r.scene.id;loadScenes(function(){edLoadDetail(w,function(){edPaint(w);});});});};
      host.querySelectorAll('[data-scact]').forEach(function(b){b.onclick=function(){
        var act=b.getAttribute('data-scact'), selId=_sel[w.id]||'';
        var det=_sel['_det_'+w.id];
        if(act==='apply'){scPost('sceneapply',{id:selId}).then(function(){if(typeof pollVals==='function')setTimeout(pollVals,250);});}
        else if(act==='del'){if(window.confirm('Szene löschen?'))scPost('scenedelete',{id:selId}).then(function(){_sel[w.id]='';_sel['_det_'+w.id]=null;loadScenes(function(){edPaint(w);});});}
        else if(act==='dup'){var nn=window.prompt('Name der Kopie:',(det&&det.name||'Szene')+' Kopie');if(!nn)return;
          var copy=Object.assign({},det,{id:'',name:nn});scPost('scenesave',copy).then(function(r){if(r&&r.scene)_sel[w.id]=r.scene.id;loadScenes(function(){edLoadDetail(w,function(){edPaint(w);});});});}
        else if(act==='recap'){scPost('scenecapture',{id:selId,name:(det&&det.name),scope:(det&&det.scope)||scScope(w)}).then(function(){edLoadDetail(w,function(){edPaint(w);});});}
        else if(act==='save'){
          if(!det)return;
          var nmeEl=host.querySelector('#scName_'+w.id); if(nmeEl)det.name=nmeEl.value||det.name;
          var trEl=host.querySelector('#scTrans_'+w.id); if(trEl)det.transitionMs=Math.max(0,parseInt(trEl.value)||0);
          var ssEl=host.querySelector('#scScopeSel_'+w.id);
          if(ssEl){var t=ssEl.value,ref='';
            if(t==='floor')ref=(det.scope&&det.scope.type==='floor'&&det.scope.ref)||w.floor||'';
            else if(t==='room')ref=(det.scope&&det.scope.type==='room'&&det.scope.ref)||String(w.roomId||'');
            det.scope={type:t,ref:String(ref)};}
          scPost('scenesave',det).then(function(){loadScenes(function(){edPaint(w);});});
        }
      };});
      // Mitglieder-Edits in den Detail-Cache schreiben (erst Speichern persistiert)
      host.querySelectorAll('[data-scmon]').forEach(function(c){c.onchange=function(){var det=_sel['_det_'+w.id];if(!det)return;var id=parseInt(c.getAttribute('data-scmon'));var m=det.members.find(function(x){return x.device===id;});if(m)m.on=c.checked;};});
      host.querySelectorAll('[data-scmlvl]').forEach(function(r){r.onchange=function(){var det=_sel['_det_'+w.id];if(!det)return;var id=parseInt(r.getAttribute('data-scmlvl'));var m=det.members.find(function(x){return x.device===id;});if(m){m.level=parseInt(r.value)||0;m.on=m.level>0;}};});
      // CCT (Kelvin) je Mitglied -> member.cct
      host.querySelectorAll('[data-scmcct]').forEach(function(r){
        r.oninput=function(){this.title='Farbtemperatur '+this.value+' K';};
        r.onchange=function(){var det=_sel['_det_'+w.id];if(!det)return;var id=parseInt(r.getAttribute('data-scmcct'));var m=det.members.find(function(x){return x.device===id;});if(m)m.cct=parseInt(r.value)||0;};
      });
      // Farbe je Mitglied -> member.color (RGB-Int)
      host.querySelectorAll('[data-scmcolor]').forEach(function(c){c.onchange=function(){var det=_sel['_det_'+w.id];if(!det)return;var id=parseInt(c.getAttribute('data-scmcolor'));var m=det.members.find(function(x){return x.device===id;});if(m)m.color=colInt(c.value);};});
      // Kopf: Scope nachtraeglich aenderbar -> scene.scope
      var ss=host.querySelector('#scScopeSel_'+w.id);
      if(ss)ss.onchange=function(){var det=_sel['_det_'+w.id];if(!det)return;var t=this.value,ref='';
        if(t==='floor')ref=(det.scope&&det.scope.type==='floor'&&det.scope.ref)||w.floor||'';
        else if(t==='room')ref=(det.scope&&det.scope.type==='room'&&det.scope.ref)||String(w.roomId||'');
        det.scope={type:t,ref:String(ref)};};
      // Kopf: Ueberblendzeit -> scene.transitionMs
      var tr=host.querySelector('#scTrans_'+w.id);
      if(tr){tr.onclick=function(e){e.stopPropagation();};tr.onchange=function(){var det=_sel['_det_'+w.id];if(!det)return;det.transitionMs=Math.max(0,parseInt(this.value)||0);};}
      // Kopf: Szenen-Icon-Picker -> scene.icon
      host.querySelectorAll('[data-scicon]').forEach(function(b){b.onclick=function(){var det=_sel['_det_'+w.id];if(!det)return;det.icon=b.getAttribute('data-scicon');
        host.querySelectorAll('[data-scicon]').forEach(function(x){x.classList.toggle('on',x===b);});};});
      var ni=host.querySelector('#scName_'+w.id); if(ni)ni.onclick=function(e){e.stopPropagation();};
    }

    // ---------- Registrierung ----------
    defWidget('scenebar',{
      label:'Szenen-Leiste', cat:'HomeSuite · Szenen', paletteIcon:'bulb', size:[420,64],
      defaults:function(w){w.scope='house';},
      render:function(w){return barRender(w);},
      mount:function(w){var el=scEl(w);if(!el)return;loadScenes(function(){barPaint(w);});LVB.panel.startPoll('scenebar:'+w.id,30000,function(){loadScenes(function(){barPaint(w);});});},
      props:function(w){
        var h='<div class="pgh">Aufnahme-Bereich</div>';
        h+=row('Scope','<select id="scScope"><option value="house"'+(w.scope!=='floor'&&w.scope!=='room'?' selected':'')+'>Ganzes Haus</option><option value="floor"'+(w.scope==='floor'?' selected':'')+'>Geschoss</option><option value="room"'+(w.scope==='room'?' selected':'')+'>Raum</option></select>');
        if(w.scope==='floor')h+=row('Geschoss','<input id="scFloor" value="'+esc(w.floor||'')+'" placeholder="Obergeschoss">');
        if(w.scope==='room')h+=row('Raum-ID','<input id="scRoom" type="number" value="'+(w.roomId||'')+'">');
        h+=row('Aufnehmen-Button','<input type="checkbox" id="scCap"'+(w.showCapture!==false?' checked':'')+'>');
        return h;
      },
      wire:function(w){
        if($('#scScope'))$('#scScope').onchange=function(){w.scope=this.value;commit();renderProps();barPaint(w);};
        if($('#scFloor'))$('#scFloor').onchange=function(){w.floor=this.value||undefined;commit();};
        if($('#scRoom'))$('#scRoom').onchange=function(){w.roomId=parseInt(this.value)||undefined;commit();};
        if($('#scCap'))$('#scCap').onchange=function(){w.showCapture=this.checked?undefined:false;commit();barPaint(w);};
      }
    });

    defWidget('sceneeditor',{
      label:'Szenen-Editor', cat:'HomeSuite · Szenen', paletteIcon:'bulb', size:[560,460],
      defaults:function(w){w.scope='house';},
      render:function(w){return edRender(w);},
      mount:function(w){var el=scEl(w);if(!el)return;loadLights(function(){loadScenes(function(){edLoadDetail(w,function(){edPaint(w);});});});
        LVB.panel.startPoll('sceneeditor:'+w.id,60000,function(){loadLights(function(){loadScenes(function(){edPaint(w);});});});},
      props:function(w){
        var h='<div class="pgh">Aufnahme-Bereich (neue Szenen)</div>';
        h+=row('Scope','<select id="seScope"><option value="house"'+(w.scope!=='floor'&&w.scope!=='room'?' selected':'')+'>Ganzes Haus</option><option value="floor"'+(w.scope==='floor'?' selected':'')+'>Geschoss</option><option value="room"'+(w.scope==='room'?' selected':'')+'>Raum</option></select>');
        if(w.scope==='floor')h+=row('Geschoss','<input id="seFloor" value="'+esc(w.floor||'')+'">');
        if(w.scope==='room')h+=row('Raum-ID','<input id="seRoom" type="number" value="'+(w.roomId||'')+'">');
        return h;
      },
      wire:function(w){
        if($('#seScope'))$('#seScope').onchange=function(){w.scope=this.value;commit();renderProps();};
        if($('#seFloor'))$('#seFloor').onchange=function(){w.floor=this.value||undefined;commit();};
        if($('#seRoom'))$('#seRoom').onchange=function(){w.roomId=parseInt(this.value)||undefined;commit();};
      }
    });
  })();
