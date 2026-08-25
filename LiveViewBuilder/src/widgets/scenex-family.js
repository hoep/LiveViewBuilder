  // ===== Widget-Familie Szenen (scenex): scenebar + sceneeditor =====
  //
  //  Licht-Szenen (Haus-Ebene, HomeSuite Hub/HSH ueber ?api=light&op=scene*).
  //  scenebar   : Szenen als Chips -> Klick wendet an; "+ Aufnehmen" schnappt den Ist-Zustand.
  //  sceneeditor: Szenen anlegen (aufnehmen)/umbenennen/duplizieren/loeschen + Mitglieder
  //               (An/Aus + Helligkeit) authored bearbeiten und speichern.
  //  Schatten-Modus: Anwenden schreibt optimistisch (Vorschau), schaltet erst bei armed real.
  (function(){
    // ---- Tastenmodus (Entwurf 28c): Szenen als 56px-Tasten mit Symbolfeld,
    //      Titel und Unterzeile. Wärmefarbe markiert die aktive Szene, alles
    //      andere bleibt neutral. Farben ausschliesslich aus dem Skin.
    if(!document.getElementById('sbTastenCss')){var _sb=document.createElement('style');_sb.id='sbTastenCss';_sb.textContent=
      '.sbtasten{--licht:var(--warm);'
      +'--licht-bg:color-mix(in oklab,var(--warm) 13%,transparent);'
      +'--licht-bd:color-mix(in oklab,var(--warm) 42%,transparent);'
      +'height:100%;display:flex;align-items:stretch;gap:11px}'
      +'.sbtaste{flex:1;min-width:0;padding:0 14px;border-radius:14px;border:1px solid var(--line);'
      +'background:var(--surface);display:flex;align-items:center;gap:11px;cursor:pointer;text-align:left}'
      +'.sbtaste:hover{border-color:var(--accent)}'
      +'.sbtaste.on{border-color:var(--licht-bd);background:var(--licht-bg)}'
      +'.sbtaste.aus{flex:0 0 150px;background:var(--surface-2)}'
      +'.sbtaste .ic{width:32px;height:32px;border-radius:10px;background:var(--surface-2);flex:0 0 32px;'
      +'display:flex;align-items:center;justify-content:center;color:var(--muted)}'
      +'.sbtaste.on .ic{color:var(--licht)}'
      +'.sbtaste .ic svg{width:17px;height:17px}'
      +'.sbtaste .tx{min-width:0;display:flex;flex-direction:column;gap:2px}'
      +'.sbtaste .tx b{font:600 13px var(--fu);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.sbtaste .tx i{font:400 10.5px var(--fu);font-style:normal;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.sbtaste.busy{opacity:.6;pointer-events:none}'
      // Schmale Zeile (Handy): die Tasten stehen untereinander statt nebeneinander.
      // Gemessen wird die Breite der KACHEL, nicht die des Geraets - die
      // breite Zeile auf der Wandtafel bleibt also unberuehrt. align-content:stretch
      // teilt die Hoehe auf die Zeilen auf, damit auch eine fuenfte Szene noch passt
      // statt unten herauszulaufen.
      +'@container (max-width:520px){.sbtasten{flex-wrap:wrap;align-content:stretch;gap:8px}'
      +'.sbtaste{flex:1 1 100%;min-height:0;padding:0 11px}'
      +'.sbtaste.aus{flex:1 1 100%}}';
      document.head.appendChild(_sb);}
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
    // Aktive Szene: der Server kennt keine, also merkt sie sich der Client ab dem
    // Anwenden - und verwirft sie, sobald irgendeine Leuchte von Hand oder per Melder
    // wechselt. Sonst zeigt die Seite eine Szene an, die laengst nicht mehr gilt.
    var _sbAktiv=null;
    function sbTaste(s){
      var an=(_sbAktiv===s.id);
      var unter=(s.count>0)?(s.count+' Leuchten'):'';
      return '<button class="sbtaste'+(an?' on':'')+'" data-scapply="'+esc(s.id)+'">'
        +'<span class="ic">'+(typeof iconSVG==='function'?iconSVG(s.icon||'bulb',100):'')+'</span>'
        +'<span class="tx"><b>'+escL(s.name)+'</b><i>'+esc(unter)+'</i></span></button>';
    }
    function barTasten(w){
      var t=(_scenes||[]).map(sbTaste).join('');
      if(!t) t='<span class="scb-msg">Noch keine Szenen</span>';
      var aus=(w.sbAllOff===false)?'':'<button class="sbtaste aus" data-scalloff="1">'
        +'<span class="ic">'+(typeof iconSVG==='function'?iconSVG('power',0):'')+'</span>'
        +'<span class="tx"><b>Alles aus</b><i>alle Leuchten</i></span></button>';
      return '<div class="sbtasten">'+t+aus+'</div>';
    }
    function barRender(w){
      if(w.sbMode==='tasten'){
        if(typeof DOKU!=='undefined'&&DOKU) _scenes=_scenes||[{id:'abend',name:'Abend',count:6},{id:'aus',name:'Alles aus',count:39},{id:'tv',name:'TV',count:4}];
        if(!_scenes) return '<div class="sbtasten"><span class="scb-msg">Szenen …</span></div>';
        return barTasten(w);
      }
      if(typeof DOKU!=='undefined'&&DOKU) _scenes=_scenes||[{id:'abend',name:'Abend',count:6},{id:'aus',name:'Alles aus',count:39},{id:'tv',name:'TV',count:4}];
      if(!_scenes) return '<div class="scb"><span class="scb-msg">Szenen …</span></div>';
      var chips=_scenes.map(function(s){return '<button class="scb-chip" data-scapply="'+esc(s.id)+'"><span class="scb-ic">'+(typeof iconSVG==='function'?iconSVG(s.icon||'bulb',100):'')+'</span>'+escL(s.name)+'</button>';}).join('');
      var cap = (w.showCapture===false)?'':'<button class="scb-chip scb-cap" data-sccapture="1">＋ Aufnehmen</button>';
      return '<div class="scb">'+(chips||'<span class="scb-msg">Noch keine Szenen</span>')+cap+'</div>';
    }
    function barWire(w,host){
      host.querySelectorAll('[data-scapply]').forEach(function(b){b.onclick=function(){
        var id=b.getAttribute('data-scapply');b.classList.add('busy');
        // Zweites Tippen auf die AKTIVE Szene schaltet sie aus: Leuchten aus, Variablen
        // auf ihren Aus-Wert. Ohne Gegenrichtung waere "Fernsehen" nur halb bedienbar.
        var aus=(w.sbMode==='tasten' && _sbAktiv===id);
        scPost(aus?'sceneoff':'sceneapply',{id:id}).then(function(){b.classList.remove('busy');
          _sbAktiv=aus?null:id; if(w.sbMode==='tasten')barPaint(w);
          if(typeof pollVals==='function')setTimeout(pollVals,250);});
      };});
      var ab=host.querySelector('[data-scalloff]');
      if(ab)ab.onclick=function(){
        ab.classList.add('busy');
        loadLights(function(){
          (_lights||[]).forEach(function(l){ if(l.on&&l.vars&&l.vars.Power&&typeof setVar==='function'){ setVar(l.vars.Power,0); l.on=false; } });
          _sbAktiv=null; ab.classList.remove('busy');
          if(w.sbMode==='tasten')barPaint(w);
          if(typeof pollVals==='function')setTimeout(pollVals,250);
        });
      };
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
    // Symbolauswahl fuer Szenen, nach Zweck geordnet statt alphabetisch: man sucht
    // "etwas fuer Musik", nicht einen Namen. Alle Symbole stammen aus dem vorhandenen
    // Bestand - es kommt keines dazu, das anderswo nicht schon verwendet wird.
    var SC_ICON_GRUPPEN=[
      ['Licht & Stimmung', ['bulb','lighton','lightoff','ceilinglamp','floorlamp','spot','ledstrip','candle','fireplace']],
      ['Tageszeit',        ['sun','sunrise','sunset','dusk','moon','sleep','bed']],
      ['Medien',           ['tv','projector','film','popcorn','music','hifi','speaker','headphones','radio','gamepad','remote']],
      ['Küche & Essen',    ['kitchen','stove','oven','microwave','kettle','coffee','espresso','fridge']],
      ['Haus & Alltag',    ['home','smarthome','sofa','shower','bath','vacuum','washer','iron']],
      ['Anlässe & Zustand',['guest','people','party','wine','book','gift','star','away','walk','lock','power','scene','routine']],
    ];
    var SC_ICONS=SC_ICON_GRUPPEN.reduce(function(a,g){return a.concat(g[1]);},[]);
    function colHex(c){c=parseInt(c);if(isNaN(c)||c<0)return '#ffffff';return '#'+('000000'+(c&0xffffff).toString(16)).slice(-6);}
    function colInt(h){h=String(h||'').replace('#','');var n=parseInt(h,16);return isNaN(n)?-1:(n&0xffffff);}
    function edCssExtra(){
      if(document.getElementById('scedVarCss'))return;
      var e=document.createElement('style');e.id='scedVarCss';e.textContent=
        '.sced-vars{margin-top:10px;border-top:1px solid var(--line);padding-top:8px}'
        +'.sced-vars h4{margin:0 0 6px;font:600 11px var(--fu);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}'
        +'.sced-v{display:flex;align-items:center;gap:7px;padding:3px 0}'
        +'.sced-v .nm{flex:1;min-width:0;font:500 12px var(--fu);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        +'.sced-v select{font:500 11.5px var(--fu);padding:3px 5px;border-radius:6px;border:1px solid var(--line);background:var(--surface-2);color:var(--text)}'
        +'.sced-v input{width:74px;font:500 11.5px var(--fm);padding:3px 5px;border-radius:6px;border:1px solid var(--line);background:var(--surface-2);color:var(--text)}'
        +'.sced-v .lbl{font:400 10.5px var(--fu);color:var(--muted)}'
        +'.sced-x{width:20px;height:20px;border-radius:6px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);cursor:pointer;font:600 12px var(--fu);line-height:1}'
        +'.sced-x:hover{color:var(--crit);border-color:var(--crit)}'
        +'.sced-add{display:flex;gap:6px;margin-top:7px}'
        +'.sced-add input{flex:1;font:400 12px var(--fu);padding:4px 7px;border-radius:7px;border:1px solid var(--line);background:var(--surface-2);color:var(--text)}'
        +'.sced-add button,.sced-mem-add select{font:500 11.5px var(--fu);padding:4px 9px;border-radius:7px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);cursor:pointer}'
        +'.sced-hits{max-height:150px;overflow:auto;margin-top:5px;border:1px solid var(--line);border-radius:7px}'
        +'.sced-hit{display:block;width:100%;text-align:left;padding:4px 8px;border:0;background:none;color:var(--text);font:400 11.5px var(--fu);cursor:pointer}'
        +'.sced-hit:hover{background:var(--surface-2)}'
        +'.sced-hit small{color:var(--muted)}'
        +'.sced-mem-add{margin-top:7px;display:flex;gap:6px;align-items:center}'
        +'.sced-scroll{max-height:330px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:0 7px}'
        +'.sced-grp{font:600 10px var(--fu);text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:7px 2px 3px;position:sticky;top:0;background:var(--surface)}';
      document.head.appendChild(e);
    }
    function edCss(){
      if(document.getElementById('lvb-scenex-ext-css'))return;
      var s=document.createElement('style');s.id='lvb-scenex-ext-css';
      // Groessen aus der Kachel: Breiten ueber cqi (Kachelbreite), Schrift/Tippziele ueber cqmin.
      // clamp haelt die Icon-Buttons am Handy bedienbar (>=26px) und auf grossen Kacheln in Form.
      s.textContent=
        '.sced-scopesel{font:inherit;font-size:clamp(10px,3cqmin,13px);padding:clamp(3px,1.6cqmin,7px) clamp(5px,2.2cqmin,9px);border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer}'
       +'.sced-trans{width:clamp(56px,14cqi,92px);font:inherit;font-size:clamp(10px,3cqmin,13px);padding:clamp(3px,1.6cqmin,7px) clamp(5px,2.2cqmin,9px);border-radius:8px;border:1px solid var(--line);background:var(--tile);color:var(--text)}'
       +'.sced-translbl{display:inline-flex;align-items:center;gap:6px;font-size:clamp(9px,2.6cqmin,11px);text-transform:uppercase;letter-spacing:.05em;color:var(--faint)}'
       // Ohne min-height:0 waechst ein Flex-Kind mit dem Inhalt, statt zu scrollen -
       // overflow:auto allein genuegt in einer Flexbox nicht.
       +'.sced-detail{min-height:0}'
       +'.sced-icotog{display:flex;align-items:center;gap:9px;padding:5px 9px;border-radius:9px;border:1px solid var(--line);background:var(--surface);color:var(--text);cursor:pointer;font:500 12px var(--fu);align-self:flex-start}'
       +'.sced-icotog:hover{border-color:var(--accent)}'
       +'.sced-icotog svg{width:18px;height:18px;color:var(--accent)}'
       +'.sced-icotog .chev{margin-left:2px;color:var(--muted);font-size:10px}'
       +'.sced-icons{display:flex;flex-direction:column;gap:2px;border:1px solid var(--line);border-radius:9px;padding:4px 8px 8px;max-height:210px;overflow:auto}'
       +'.sced-igrp{font:600 9.5px var(--fu);text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:5px}'
       +'.sced-iconpick{display:flex;flex-wrap:wrap;gap:6px}'
       +'.sced-ib{width:clamp(26px,7.5cqmin,38px);height:clamp(26px,7.5cqmin,38px);padding:clamp(3px,1.4cqmin,6px);display:inline-flex;align-items:center;justify-content:center;border-radius:9px;border:1px solid var(--line-soft);background:var(--tile);color:var(--muted);cursor:pointer}'
       +'.sced-ib.on{border-color:var(--accent);color:var(--accent);background:color-mix(in oklab,var(--accent) 10%,var(--tile))}'
       +'.sced-ib svg{width:clamp(14px,4.5cqmin,22px);height:clamp(14px,4.5cqmin,22px)}'
       +'.sced-mcct{width:clamp(60px,18cqi,120px);accent-color:var(--warm)}'
       +'.sced-mcolor{width:clamp(24px,7cqi,34px);height:clamp(20px,6cqmin,28px);padding:0;border:1px solid var(--line);border-radius:6px;background:none;cursor:pointer}';
      document.head.appendChild(s);
    }
    function edRender(w){
      edCss(); edCssExtra();
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
          +(function(){
              // Eingeklappt ist die Vorgabe: 56 Symbole schoben den ganzen Editor
              // nach unten. Sichtbar bleibt nur das gewaehlte Symbol.
              var offen=!!_sel['_ico_'+w.id];
              var kopf='<button type="button" class="sced-icotog" data-scicotog="1">'
                +(typeof iconSVG==='function'?iconSVG(curIcon,100):'')
                +'<span>Symbol</span><span class="chev">'+(offen?'▲':'▼')+'</span></button>';
              return kopf+(offen?'':'<!--zu-->');
            })()
          +(_sel['_ico_'+w.id]?('<div class="sced-icons">'+SC_ICON_GRUPPEN.map(function(g){
              return '<div class="sced-igrp">'+escL(g[0])+'</div><div class="sced-iconpick">'
                +g[1].map(function(ic){return '<button type="button" class="sced-ib'+(ic===curIcon?' on':'')+'" data-scicon="'+ic+'" title="'+ic+'">'+(typeof iconSVG==='function'?iconSVG(ic,100):'')+'</button>';}).join('')
                +'</div>';
            }).join('')+'</div>'):'')
          +'<div class="sced-actions">'
          +'<button data-scact="apply">Anwenden</button>'
          +'<button data-scact="recap">Ist übernehmen</button>'
          +'<button data-scact="dup">Duplizieren</button>'
          +'<button data-scact="del" class="danger">Löschen</button>'
          +'<button data-scact="save" class="prim">Speichern</button></div>';
        // Die Variablen stehen VOR den Mitgliedern: unter 39 Leuchten waeren sie
        // nicht auffindbar, und sie sind der Teil, den man beim Zusammenstellen
        // einer Szene zuerst braucht.
        var vh='';
          // ---- Schaltbare Variablen -----------------------------------------
          vh+='<div class="sced-vars"><h4>Schaltbare Variablen</h4>';
          var vs=(det.vars||[]);
          if(!vs.length) vh+='<div class="scb-msg" style="padding:2px 0 4px">noch keine — z. B. der Receiver, damit die Szene auch das Gerät einschaltet.</div>';
          vh+=vs.map(function(v){
            var pa=_scAssoc[v.vid]||{}, as=(pa.assocs||[]);
            function feld(art,wert){
              if(as.length){
                // Benannte Werte: der Nutzer waehlt "Fernsehen", nicht die 3.
                return '<select data-scv'+art+'="'+v.vid+'">'+as.map(function(a){
                  return '<option value="'+esc(String(a.v))+'"'+(String(a.v)===String(wert)?' selected':'')+'>'+escL(a.name)+'</option>';
                }).join('')+'</select>';
              }
              if(pa.type===0){
                var b=(String(wert)==='true'||wert===true||String(wert)==='1');
                return '<select data-scv'+art+'="'+v.vid+'"><option value="true"'+(b?' selected':'')+'>ein</option>'
                  +'<option value="false"'+(!b?' selected':'')+'>aus</option></select>';
              }
              return '<input data-scv'+art+'="'+v.vid+'" value="'+esc(String(wert))+'">';
            }
            return '<div class="sced-v"><span class="nm" title="#'+v.vid+(pa.profile?(' · '+pa.profile):'')+'">'+escL(v.name||('#'+v.vid))+'</span>'
              +'<span class="lbl">ein</span>'+feld('on',v.on)
              +'<span class="lbl">aus</span>'+feld('off',v.off)
              +'<button class="sced-x" data-scvdel="'+v.vid+'" title="Variable entfernen">×</button></div>';
          }).join('');
          vh+='<div class="sced-add"><input data-scvq="1" placeholder="Variable suchen (Name oder ID) …">'
            +'<button data-scvsearch="1">Suchen</button></div><div data-scvhits="1"></div></div>';
        // ---- Skripte ------------------------------------------------------
        // Nicht alles ist eine Variable: eine Geraetesequenz, eine Fahrt, eine
        // Benachrichtigung. Das Skript bekommt SCENE und STATE als Parameter,
        // damit EIN Skript beide Richtungen bedienen kann.
        vh+='<div class="sced-vars"><h4>Skripte</h4>';
        var ss=(det.scripts||[]);
        if(!ss.length) vh+='<div class="scb-msg" style="padding:2px 0 4px">noch keine — das Skript erhält $_IPS[\'SCENE\'] und $_IPS[\'STATE\'] (on/off).</div>';
        vh+=ss.map(function(sc){
          var w1=sc.when||'on';
          return '<div class="sced-v"><span class="nm" title="#'+sc.sid+'">'+escL(sc.name||('#'+sc.sid))+'</span>'
            +'<select data-scswhen="'+sc.sid+'">'
              +'<option value="on"'+(w1==='on'?' selected':'')+'>beim Einschalten</option>'
              +'<option value="off"'+(w1==='off'?' selected':'')+'>beim Ausschalten</option>'
              +'<option value="both"'+(w1==='both'?' selected':'')+'>bei beidem</option>'
            +'</select>'
            +'<button class="sced-x" data-scsdel="'+sc.sid+'" title="Skript entfernen">×</button></div>';
        }).join('');
        vh+='<div class="sced-add"><input data-scsq="1" placeholder="Skript suchen (Name oder ID) …">'
          +'<button data-scssearch="1">Suchen</button></div><div data-scshits="1"></div></div>';
        right+=vh;

        if(det&&det.members){
          // Nach Geschoss und Raum gruppiert: eine flache Liste aus 39 Leuchten ist
          // beim Zusammenstellen einer Szene nicht zu ueberblicken.
          var grp={},ordg=[];
          det.members.forEach(function(m){
            var l=lightById(m.device);
            var k=l?((l.floor||'')+' · '+(l.room||'ohne Raum')):'unbekannt';
            if(!grp[k]){grp[k]=[];ordg.push(k);}
            grp[k].push(m);
          });
          ordg.sort();
          right+='<div class="sced-members sced-scroll">'+ordg.map(function(k){
            return '<div class="sced-grp">'+escL(k)+'</div>'+grp[k].map(function(m){
            var l=lightById(m.device); var nm=l?l.name:('#'+m.device); var caps=(l&&l.caps)||{};
            var s='<div class="sced-m"><label class="sced-mtog"><input type="checkbox" data-scmon="'+m.device+'"'+(m.on?' checked':'')+'> '+escL(nm)+'</label>'
              +(caps.dim?'<input type="range" min="0" max="100" step="1" value="'+(m.level>=0?m.level:100)+'" data-scmlvl="'+m.device+'">':'<span class="sced-nodim">—</span>');
            if(caps.cct){var cmin=parseInt(caps.cctMin)||2700,cmax=parseInt(caps.cctMax)||6500,cv=(m.cct>0?m.cct:cmin);
              s+='<input type="range" class="sced-mcct" min="'+cmin+'" max="'+cmax+'" step="50" value="'+cv+'" data-scmcct="'+m.device+'" title="Farbtemperatur '+cv+' K">';}
            if(caps.color){s+='<input type="color" class="sced-mcolor" value="'+colHex(m.color)+'" data-scmcolor="'+m.device+'" title="Farbe">';}
            return s+'<button class="sced-x" data-scmdel="'+m.device+'" title="Leuchte aus der Szene nehmen">×</button></div>';
            }).join('');
          }).join('')+'</div>';
          // Leuchten, die noch nicht Mitglied sind, koennen von Hand dazu - sonst waere
          // eine Szene nur so vollstaendig wie der Zustand im Moment der Aufnahme.
          var drin={}; det.members.forEach(function(m){drin[m.device]=true;});
          var frei=(_lights||[]).filter(function(l){return !drin[l.id];});
          if(frei.length){
            var fg={},fo=[];
            frei.forEach(function(l){var k=(l.floor||'')+' · '+(l.room||'ohne Raum');
              if(!fg[k]){fg[k]=[];fo.push(k);} fg[k].push(l);});
            fo.sort();
            right+='<div class="sced-mem-add"><select data-scmadd="1"><option value="">＋ Leuchte hinzufügen …</option>'
              +fo.map(function(k){return '<optgroup label="'+esc(k)+'">'
                +fg[k].map(function(l){return '<option value="'+l.id+'">'+esc(l.name||'')+'</option>';}).join('')
                +'</optgroup>';}).join('')
              +'</select></div>';
          }
        } else {
          right+='<div class="scb-msg" style="padding:12px">Mitglieder werden geladen …</div>';
        }
      }
      return '<div class="sced"><div class="sced-list">'+list
        +'<button class="sced-item sced-new" data-scnew="1">＋ Neu (aufnehmen)</button>'
        +'<button class="sced-item sced-new" data-scnewempty="1">＋ Neu (leer)</button></div>'
        +'<div class="sced-detail">'+right+'</div></div>';
    }
    // Profile der Szenen-Variablen. Eine Harmony-Aktivitaet ist ein Integer mit
    // Namen dahinter (-1 Power Off, 3 Fernsehen ...). Ohne diese Namen muesste man
    // im Editor Zahlen eintippen und wissen, welche welches Geraet meint.
    var _scAssoc={};
    function edLoadAssocs(det,cb){
      var ids=((det&&det.vars)||[]).map(function(v){return v.vid;})
        .filter(function(id){return id&&!_scAssoc[id];});
      if(!ids.length){cb&&cb();return;}
      fetch('?api=assoc&ids='+ids.join(','),{cache:'no-store'})
        .then(function(r){return r.json();})
        .then(function(j){var m=(j&&j.vars)||{};
          Object.keys(m).forEach(function(k){_scAssoc[parseInt(k)]=m[k];});
          ids.forEach(function(id){if(!_scAssoc[id])_scAssoc[id]={assocs:[]};});
          cb&&cb();})
        .catch(function(){ids.forEach(function(id){_scAssoc[id]={assocs:[]};});cb&&cb();});
    }
    function edLoadDetail(w,cb){
      var selId=_sel[w.id]||(_scenes&&_scenes[0]&&_scenes[0].id)||'';
      if(!selId){_sel['_det_'+w.id]=null;cb&&cb();return;}
      scGet('scene','&id='+encodeURIComponent(selId)).then(function(j){
        var det=(j&&j.scene)||null; _sel['_det_'+w.id]=det;
        edLoadAssocs(det,function(){cb&&cb();});
      }).catch(function(){cb&&cb();});
    }
    function edPaint(w){var el=scEl(w);if(!el)return;var h=el.querySelector('.winner')||el;h.innerHTML=edRender(w);edWire(w,h);}
    function edWire(w,host){
      host.querySelectorAll('[data-scsel]').forEach(function(b){b.onclick=function(){_sel[w.id]=b.getAttribute('data-scsel');edLoadDetail(w,function(){edPaint(w);});};});
      var nw=host.querySelector('[data-scnew]');
      if(nw)nw.onclick=function(){var name=window.prompt('Neue Szene (nimmt aktuellen Zustand auf):','Szene');if(!name)return;
        scPost('scenecapture',{name:name,scope:scScope(w)}).then(function(r){if(r&&r.scene)_sel[w.id]=r.scene.id;loadScenes(function(){edLoadDetail(w,function(){edPaint(w);});});});};
      var nwE=host.querySelector('[data-scnewempty]');
      if(nwE)nwE.onclick=function(){
        var name=window.prompt('Neue leere Szene (Mitglieder danach von Hand wählen):','Szene');
        if(!name)return;
        scPost('scenesave',{id:'',name:name,icon:'bulb',scope:scScope(w),transitionMs:0,members:[],vars:[]})
          .then(function(r){if(r&&r.scene)_sel[w.id]=r.scene.id;loadScenes(function(){edLoadDetail(w,function(){edPaint(w);});});});
      };
      // Mitglied entfernen / hinzufuegen (nur im Cache; Speichern schreibt fest)
      host.querySelectorAll('[data-scmdel]').forEach(function(b){b.onclick=function(){
        var det=_sel['_det_'+w.id]; if(!det)return;
        var id=parseInt(b.getAttribute('data-scmdel'));
        det.members=(det.members||[]).filter(function(m){return m.device!==id;});
        edPaint(w);
      };});
      var madd=host.querySelector('[data-scmadd]');
      if(madd)madd.onchange=function(){
        var det=_sel['_det_'+w.id]; if(!det)return;
        var id=parseInt(this.value)||0; if(!id)return;
        det.members=det.members||[];
        if(!det.members.some(function(m){return m.device===id;}))
          det.members.push({device:id,on:true,level:-1,color:-1,cct:0});
        edPaint(w);
      };
      // Variablen: Werte aendern, entfernen, suchen, hinzufuegen
      host.querySelectorAll('[data-scvon]').forEach(function(i){i.onchange=function(){
        var det=_sel['_det_'+w.id]; if(!det)return;
        var id=parseInt(i.getAttribute('data-scvon'));
        var v=(det.vars||[]).find(function(x){return x.vid===id;}); if(v)v.on=i.value;
      };});
      host.querySelectorAll('[data-scvoff]').forEach(function(i){i.onchange=function(){
        var det=_sel['_det_'+w.id]; if(!det)return;
        var id=parseInt(i.getAttribute('data-scvoff'));
        var v=(det.vars||[]).find(function(x){return x.vid===id;}); if(v)v.off=i.value;
      };});
      host.querySelectorAll('[data-scvdel]').forEach(function(b){b.onclick=function(){
        var det=_sel['_det_'+w.id]; if(!det)return;
        var id=parseInt(b.getAttribute('data-scvdel'));
        det.vars=(det.vars||[]).filter(function(x){return x.vid!==id;});
        edPaint(w);
      };});
      // ---- Skripte ------------------------------------------------------
      host.querySelectorAll('[data-scswhen]').forEach(function(sel){sel.onchange=function(){
        var det=_sel['_det_'+w.id]; if(!det)return;
        var id=parseInt(sel.getAttribute('data-scswhen'));
        var x=(det.scripts||[]).find(function(y){return y.sid===id;}); if(x)x.when=sel.value;
      };});
      host.querySelectorAll('[data-scsdel]').forEach(function(b){b.onclick=function(){
        var det=_sel['_det_'+w.id]; if(!det)return;
        var id=parseInt(b.getAttribute('data-scsdel'));
        det.scripts=(det.scripts||[]).filter(function(y){return y.sid!==id;});
        edPaint(w);
      };});
      var ssb=host.querySelector('[data-scssearch]'), ssq=host.querySelector('[data-scsq]'),
          ssh=host.querySelector('[data-scshits]');
      function skriptSuche(){
        var q=(ssq&&ssq.value||'').trim(); if(!q||!ssh)return;
        ssh.innerHTML='<div class="scb-msg" style="padding:4px 0">suche …</div>';
        fetch('?api=tree&search='+encodeURIComponent(q),{cache:'no-store'})
          .then(function(r){return r.json();})
          .then(function(j){
            var n2=((j&&j.nodes)||[]).filter(function(x){return x.type===3;});   // 3 = Skript
            if(!n2.length){ssh.innerHTML='<div class="scb-msg" style="padding:4px 0">kein Skript gefunden</div>';return;}
            var hg={},ho=[];
            n2.slice(0,40).forEach(function(x){
              var p=String(x.path||''); var i=p.lastIndexOf(' / ');
              var k=(i>0)?p.slice(0,i):(p||'ohne Pfad');
              if(!hg[k]){hg[k]=[];ho.push(k);} hg[k].push(x);
            });
            ssh.innerHTML='<div class="sced-hits">'+ho.map(function(k){
              return '<div class="sced-grp">'+escL(k)+'</div>'+hg[k].map(function(x){
                return '<button class="sced-hit" data-scsadd="'+x.id+'" data-scsnm="'+esc(x.name||'')+'">'
                  +escL(x.name||('#'+x.id))+' <small>· #'+x.id+'</small></button>';
              }).join('');
            }).join('')+'</div>';
            ssh.querySelectorAll('[data-scsadd]').forEach(function(bb){bb.onclick=function(){
              var det=_sel['_det_'+w.id]; if(!det)return;
              var id=parseInt(bb.getAttribute('data-scsadd'));
              det.scripts=det.scripts||[];
              if(!det.scripts.some(function(y){return y.sid===id;}))
                det.scripts.push({sid:id,name:bb.getAttribute('data-scsnm')||('#'+id),when:'on'});
              edPaint(w);
            };});
          })
          .catch(function(){ssh.innerHTML='<div class="scb-msg" style="padding:4px 0">Suche fehlgeschlagen</div>';});
      }
      if(ssb)ssb.onclick=skriptSuche;
      if(ssq)ssq.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();skriptSuche();}};
      var sb=host.querySelector('[data-scvsearch]'), sq=host.querySelector('[data-scvq]'),
          sh=host.querySelector('[data-scvhits]');
      function suchen(){
        var q=(sq&&sq.value||'').trim(); if(!q||!sh)return;
        sh.innerHTML='<div class="scb-msg" style="padding:4px 0">suche …</div>';
        fetch('?api=tree&search='+encodeURIComponent(q),{cache:'no-store'})
          .then(function(r){return r.json();})
          .then(function(j){
            // Nur Variablen MIT Aktion - alles andere liesse sich nicht schalten.
            var n=((j&&j.nodes)||[]).filter(function(x){return x.type===2&&x.action;});
            if(!n.length){sh.innerHTML='<div class="scb-msg" style="padding:4px 0">nichts Schaltbares gefunden</div>';return;}
            // Treffer nach ihrem Elternpfad buendeln - dieselbe Logik wie bei den
            // Mitgliedern: gleiche Herkunft steht beieinander.
            var hg={},ho=[];
            n.slice(0,40).forEach(function(x){
              var p=String(x.path||''); var i=p.lastIndexOf(' / ');
              var k=(i>0)?p.slice(0,i):(p||'ohne Pfad');
              if(!hg[k]){hg[k]=[];ho.push(k);} hg[k].push(x);
            });
            sh.innerHTML='<div class="sced-hits">'+ho.map(function(k){
              return '<div class="sced-grp">'+escL(k)+'</div>'+hg[k].map(function(x){
                return '<button class="sced-hit" data-scvadd="'+x.id+'" data-scvnm="'+esc(x.name||'')+'">'
                  +escL(x.name||('#'+x.id))+' <small>· #'+x.id+'</small></button>';
              }).join('');
            }).join('')+'</div>';
            sh.querySelectorAll('[data-scvadd]').forEach(function(bb){bb.onclick=function(){
              var det=_sel['_det_'+w.id]; if(!det)return;
              var id=parseInt(bb.getAttribute('data-scvadd'));
              det.vars=det.vars||[];
              if(!det.vars.some(function(x){return x.vid===id;}))
                det.vars.push({vid:id,name:bb.getAttribute('data-scvnm')||('#'+id),on:'true',off:'false'});
              // Profil sofort nachladen; hat die Variable benannte Werte, sind
              // "true/false" sinnlose Vorgaben - dann letzten und ersten Wert nehmen.
              edLoadAssocs(det,function(){
                var pa=_scAssoc[id]||{}, as=(pa.assocs||[]);
                var vv=det.vars.find(function(x){return x.vid===id;});
                if(vv&&as.length){ vv.on=String(as[as.length-1].v); vv.off=String(as[0].v); }
                edPaint(w);
              });
            };});
          })
          .catch(function(){sh.innerHTML='<div class="scb-msg" style="padding:4px 0">Suche fehlgeschlagen</div>';});
      }
      if(sb)sb.onclick=suchen;
      if(sq)sq.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();suchen();}};
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
      var itg=host.querySelector('[data-scicotog]');
      if(itg)itg.onclick=function(){_sel['_ico_'+w.id]=!_sel['_ico_'+w.id];edPaint(w);};
      host.querySelectorAll('[data-scicon]').forEach(function(b){b.onclick=function(){var det=_sel['_det_'+w.id];if(!det)return;det.icon=b.getAttribute('data-scicon');
        host.querySelectorAll('[data-scicon]').forEach(function(x){x.classList.toggle('on',x===b);});
        // Nach der Wahl wieder zuklappen - man waehlt einmal, sieht danach aber lieber
        // den Rest des Editors.
        _sel['_ico_'+w.id]=false; edPaint(w);};});
      var ni=host.querySelector('#scName_'+w.id); if(ni)ni.onclick=function(e){e.stopPropagation();};
    }

    // ---------- Registrierung ----------
    defWidget('scenebar',{
      label:'Szenen-Leiste', cat:'HomeSuite · Szenen', paletteIcon:'bulb', size:[420,64],
      defaults:function(w){w.scope='house';},
      render:function(w){return barRender(w);},
      mount:function(w){var el=scEl(w);if(!el)return;loadScenes(function(){barPaint(w);});LVB.panel.startPoll('scenebar:'+w.id,30000,function(){loadScenes(function(){barPaint(w);});});},
      props:function(w){
        var h='<div class="pgh">Darstellung</div>';
        h+=row('Modus','<select id="sbMode"><option value="chips"'+(w.sbMode!=='tasten'?' selected':'')+'>Chips</option><option value="tasten"'+(w.sbMode==='tasten'?' selected':'')+'>Tasten (Leuchtbank)</option></select>');
        if(w.sbMode==='tasten'){
          h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">56 px hohe Tasten mit Symbolfeld, Titel und Unterzeile. Die zuletzt angewendete Szene wird warm markiert.</div>';
          h+=row('Alles-aus-Taste','<input type="checkbox" id="sbAus"'+(w.sbAllOff!==false?' checked':'')+'>');
        }
        h+='<div class="pgh">Aufnahme-Bereich</div>';
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
        if($('#sbMode'))$('#sbMode').onchange=function(){w.sbMode=(this.value==='tasten')?'tasten':undefined;commit();renderProps();barPaint(w);};
        if($('#sbAus'))$('#sbAus').onchange=function(){w.sbAllOff=this.checked?undefined:false;commit();barPaint(w);};
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
