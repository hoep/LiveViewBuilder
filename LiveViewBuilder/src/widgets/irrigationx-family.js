  // ===== Bewaesserungs-Familie (irrigx): irriggrid + irrigcircuit =====
  //
  //  Operative Steuerung der HomeSuite-Bewaesserungskreise (Modul IrrigationCircuit HSIR,
  //  GUID {D264A82B-DE31-45CC-8AF2-8F4C5D076508}) ueber den generischen ?api=mod-Transport.
  //  Bisher gab es fuer Bewaesserung nur den Wochenplan (heatx, domain='irrigation'); diese
  //  Familie liefert die Tages-Bedienung:
  //    irriggrid    : alle Kreise als Karten (nach Bereich/Raum gruppiert).
  //    irrigcircuit : EIN fester Kreis (w.circuitId), sonst identische Karte.
  //
  //  Datenquelle: ?api=mod&op=topology (Kreis-Liste, domain='irrigation'),
  //  ?api=mod&op=manifest&id=<iid> (varIds + Optionen + Bereiche + State beim ersten Laden),
  //  ?api=mod&op=state&id=<iid> (leichtgewichtiger Live-Refresh).
  //  Schreiben: setVar() auf die Control-Variablen (Active/Automatic/Duration/SeasonalAdjust/
  //  Program); runNow/stopNow/setArmed ueber ?api=mod&op=manage (Token). Schatten-Modus:
  //  solange armed=false laeuft der Kreis nur simuliert (Backend schaltet den Aktor nicht).
  (function(){
    if(!document.getElementById('irxfamCss')){var _s=document.createElement('style');_s.id='irxfamCss';_s.textContent=
      '.irxwrap{position:absolute;inset:0;overflow:auto;background:var(--surface);padding:10px;box-sizing:border-box}'
      +'.irx-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px}'
      +'.irx-shadow{font-size:11px;color:var(--muted);border:1px dashed var(--line,rgba(128,128,128,.35));border-radius:8px;padding:5px 9px;margin-bottom:8px}'
      +'.irx-floor{font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint);margin:8px 2px 4px}'
      // Kartenraster: die Mindestbreite waechst mit der Kachel (cqmin gegen die Kachel = .w),
      // damit auf grossen Uebersichten nicht 6 winzige Spalten entstehen.
      +'.irx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(190px,45cqmin,280px),1fr));gap:clamp(7px,3cqmin,14px)}'
      // WICHTIG: die Karte ist selbst ein Groessen-Container (inline-size). Alle Innenmasse
      // rechnen deshalb mit cqi = KARTENbreite. Bei irriggrid ist die Kachel um ein Vielfaches
      // groesser als eine einzelne Karte - ohne diesen Container wuerde alles zu gross geraten.
      +'.irxc{container-type:inline-size;border:1px solid var(--line,rgba(128,128,128,.35));border-radius:var(--r-s,10px);background:var(--tile);padding:clamp(7px,3cqmin,13px) clamp(8px,3.2cqmin,14px);display:flex;flex-direction:column;gap:clamp(6px,3cqmin,12px)}'
      +'.irxc.run{border-color:var(--accent)}'
      +'.irxc-h{display:flex;align-items:center;gap:clamp(5px,2.6cqi,10px)}'
      +'.irxc-ic{width:clamp(16px,7cqi,26px);height:clamp(16px,7cqi,26px);flex:none;color:var(--accent);display:flex;align-items:center;justify-content:center}'
      +'.irxc-ic svg{width:100%;height:100%}'
      +'.irxc-nm{flex:1;min-width:0;font-size:clamp(11px,5cqi,16px);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.irxc-st{font-size:clamp(9px,3.8cqi,12px);font-weight:700;padding:2px clamp(5px,2.6cqi,10px);border-radius:999px;background:var(--surface-2);color:var(--muted);white-space:nowrap}'
      +'.irxc-st.on{background:var(--accent);color:#fff}'
      +'.irxc-st.warn{background:color-mix(in oklab,var(--warn,#e0a030) 22%,transparent);color:var(--warn,#e0a030)}'
      +'.irxc-sub{font-size:clamp(9px,3.8cqi,12px);color:var(--faint)}'
      +'.irxc-arm{font-size:clamp(9px,3.6cqi,12px);padding:2px clamp(5px,2.6cqi,10px);border-radius:12px;border:1px solid var(--line,rgba(128,128,128,.35));background:none;color:var(--muted);cursor:pointer;white-space:nowrap}'
      +'.irxc-arm.armed{background:var(--accent);border-color:var(--accent);color:#fff}'
      +'.irxc-run{display:flex;align-items:center;gap:clamp(4px,2.2cqi,9px)}'
      +'.irxc-stp{display:inline-flex;align-items:center;border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;overflow:hidden}'
      // Untergrenzen der Bedienelemente bleiben am Handy tippbar (>= 28px Kantenlaenge).
      +'.irxc-stp button{width:clamp(28px,11cqi,40px);height:clamp(30px,12cqi,40px);border:0;background:var(--surface-2);color:var(--text);cursor:pointer;font-size:clamp(13px,5cqi,18px)}'
      +'.irxc-stp span{min-width:clamp(44px,17cqi,70px);text-align:center;font-family:var(--fm);font-size:clamp(10px,4cqi,13px)}'
      +'.irxc-go{flex:1;height:clamp(30px,12cqi,44px);border:0;border-radius:8px;background:var(--accent);color:#fff;font-size:clamp(11px,4.4cqi,14px);font-weight:600;cursor:pointer}'
      +'.irxc-stop{height:clamp(30px,12cqi,44px);padding:0 clamp(8px,4cqi,16px);border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;background:var(--tile);color:var(--text);font-size:clamp(11px,4.4cqi,14px);cursor:pointer}'
      +'.irxc-tgls{display:flex;gap:clamp(5px,2.8cqi,10px)}'
      +'.irxc-tgl{flex:1;height:clamp(28px,11cqi,40px);border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;background:var(--tile);color:var(--muted);font-size:clamp(11px,4.4cqi,14px);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}'
      +'.irxc-tgl.on{border-color:var(--accent);background:color-mix(in oklab,var(--accent) 14%,transparent);color:var(--accent);font-weight:600}'
      +'.irxc-row{display:flex;align-items:center;gap:clamp(5px,2.8cqi,10px)}'
      +'.irxc-lbl{width:clamp(58px,22cqi,96px);flex:none;font-size:clamp(10px,4.2cqi,13px);color:var(--muted)}'
      +'.irxc-rng{flex:1;height:clamp(5px,2cqi,8px);border-radius:6px}'
      +'.irxc-val{min-width:clamp(38px,15cqi,60px);text-align:right;font-family:var(--fm);font-size:clamp(10px,4cqi,13px)}'
      +'.irxc-sel{flex:1;height:clamp(28px,11cqi,40px);border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;background:var(--tile);color:var(--text);font-size:clamp(11px,4.4cqi,14px);padding:0 clamp(4px,2cqi,9px)}';
      document.head.appendChild(_s);}

    var _irData=null, _irErr='', _irLoading=false;

    function irDemo(){return [
      {iid:1,name:'Rasen Nord',room:'Garten',group:'Garten',armed:false,
       vars:{Active:0,Automatic:0,Duration:0,SeasonalAdjust:0,Program:0},
       prog:[[0,'Manuell'],[1,'Täglich'],[2,'Jeden 2. Tag'],[5,'Mo/Mi/Fr']],
       dur:{min:1,max:120,step:1}, adj:{min:0,max:200,step:5}, runMin:20,
       st:{Active:1,Automatic:1,Duration:20,SeasonalAdjust:120,Program:5,Running:1,RainBlocked:0,Rain:0.4,Online:1,LastRun:'heute 06:00 · 18 min'}},
      {iid:2,name:'Beete Süd',room:'Garten',group:'Garten',armed:true,
       vars:{Active:0,Automatic:0,Duration:0,SeasonalAdjust:0,Program:0},
       prog:[[0,'Manuell'],[1,'Täglich'],[2,'Jeden 2. Tag'],[5,'Mo/Mi/Fr']],
       dur:{min:1,max:120,step:1}, adj:{min:0,max:200,step:5}, runMin:15,
       st:{Active:0,Automatic:1,Duration:15,SeasonalAdjust:100,Program:2,Running:0,RainBlocked:1,Rain:6.2,Online:1,LastRun:'gestern 05:30 · 15 min'}}
    ];}

    var FLOOR_ORDER=['Erdgeschoss','Obergeschoss','Dachgeschoss','Garten','Wohnhaus'];
    function floorRank(f){var i=FLOOR_ORDER.indexOf(f);return i<0?99:i;}
    function irDoku(){return (typeof DOKU!=='undefined'&&DOKU);}

    // ---- Laden -------------------------------------------------------------
    // 1) Topologie -> Bewaesserungs-Kreise (domain='irrigation').
    // 2) je Kreis Manifest (varIds/Optionen/Ranges/State) + Config (armed).
    function irLoad(cb){
      if(irDoku()){_irData=irDemo();_irErr='';cb&&cb();return;}
      if(_irLoading)return; _irLoading=true;
      fetch('?api=mod&op=topology',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        var list=irCircuitsFromTopo(j);
        if(!list.length){_irData=[];_irErr='';_irLoading=false;cb&&cb();return;}
        var jobs=list.map(function(c){
          return fetch('?api=mod&op=manifest&id='+c.iid,{cache:'no-store'}).then(function(r){return r.json();})
            .then(function(m){irApplyManifest(c,m);}).catch(function(){});
        });
        // armed steckt in der Config (kein State-Feld) -> per manage getConfig (Token) nachziehen.
        list.forEach(function(c){ jobs.push(
          irManagePromise(c.iid,{op:'getConfig'}).then(function(g){ if(g&&g.config)c.armed=!!g.config.armed; }).catch(function(){}) ); });
        Promise.all(jobs).then(function(){_irData=list;_irErr='';_irLoading=false;cb&&cb();})
          .catch(function(){_irData=list;_irErr='';_irLoading=false;cb&&cb();});
      }).catch(function(){_irErr='net';_irLoading=false;cb&&cb();});
    }
    // Kreis-Liste aus der Topologie ziehen (gleiche Baumform wie heatx: Haus->Bereich->Raum->entities).
    function irCircuitsFromTopo(j){
      var out=[];
      function pushEnt(e,room,group){ if((e.domain||'')!=='irrigation')return;
        out.push({iid:e.iid,name:e.name||room||('#'+e.iid),room:room||'',group:group||'',armed:false,
          vars:{},prog:[],dur:{min:1,max:120,step:1},adj:{min:0,max:200,step:5},runMin:0,st:{}}); }
      (j&&j.tree||[]).forEach(function(haus){ (haus.children||[]).forEach(function(area){
        if(area.kind==='Bereich'){ var g=area.abbr||area.name||'';
          (area.children||[]).forEach(function(rm){ if(rm.kind==='Raum')(rm.entities||[]).forEach(function(e){pushEnt(e,rm.name,g);}); });
        } else if(area.kind==='Raum'){ (area.entities||[]).forEach(function(e){pushEnt(e,area.name,'');}); }
      }); });
      (j&&j.unassigned||[]).forEach(function(e){ pushEnt(e,'',''); });
      return out;
    }
    function irApplyManifest(c,m){
      if(!m||!m.controls)return;
      m.controls.forEach(function(ctrl){
        if(!ctrl||!ctrl.ident)return;
        if(ctrl.varId)c.vars[ctrl.ident]=ctrl.varId;
        if(ctrl.ident==='Program'&&ctrl.options)c.prog=ctrl.options.map(function(o){return [o.value,o.label];});
        if(ctrl.ident==='Duration')c.dur={min:num(ctrl.min,1),max:num(ctrl.max,120),step:num(ctrl.step,1)};
        if(ctrl.ident==='SeasonalAdjust')c.adj={min:num(ctrl.min,0),max:num(ctrl.max,200),step:num(ctrl.step,5)};
      });
      if(m.state)c.st=m.state;
      if(!c.runMin)c.runMin=num(c.st.Duration,20);
    }
    function num(v,d){var n=parseFloat(v);return isNaN(n)?d:n;}
    // Leichter State-Refresh (ohne Manifest) — fuers Polling.
    function irRefresh(cb){
      if(irDoku()||!_irData){cb&&cb();return;}
      var jobs=_irData.map(function(c){
        return fetch('?api=mod&op=state&id='+c.iid,{cache:'no-store'}).then(function(r){return r.json();})
          .then(function(s){ if(s&&!s.err)c.st=s; }).catch(function(){});
      });
      Promise.all(jobs).then(function(){cb&&cb();}).catch(function(){cb&&cb();});
    }

    // ---- Steuerung ---------------------------------------------------------
    function irManagePromise(iid,body){
      return fetch('?api=mod&op=manage&id='+iid+'&key='+encodeURIComponent(TOKEN),
        {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)})
        .then(function(r){return r.json();});
    }
    function irManage(iid,body,cb){
      if(irDoku()){cb&&cb();return;}
      irManagePromise(iid,body).then(function(j){ if(j&&j.note&&typeof toast==='function')toast(j.note); cb&&cb(j); })
        .catch(function(){ if(typeof toast==='function')toast('Bewässerung: Verbindungsfehler'); });
    }
    function irSetVar(c,ident,val){ var id=c.vars&&c.vars[ident]; if(!id){if(typeof toast==='function')toast('Keine Bindung: '+ident);return;}
      if(typeof setVar==='function')setVar(id,val); c.st[ident]=val; }
    function irRunNow(c,min){ c.st.Running=1; irManage(c.iid,{op:'runNow',args:{minutes:min}}); }
    function irStopNow(c){ c.st.Running=0; irManage(c.iid,{op:'stopNow'}); }
    function irSetArmed(c,armed){ c.armed=armed; irManage(c.iid,{op:'setArmed',args:{armed:armed}}); }

    // ---- Render ------------------------------------------------------------
    function irIcon(){return (typeof iconSVG==='function')?iconSVG('droplet',100):'';}
    function irStatus(c){var s=c.st||{};
      if(s.Online===0||s.Online===false)return ['Offline','warn'];
      if(s.RainBlocked===1||s.RainBlocked===true||s.RainBlocked==='1')return ['Regen-Sperre','warn'];
      if(s.Running===1||s.Running===true||s.Running==='1')return ['Läuft','on'];
      if(s.Automatic===1||s.Automatic===true||s.Automatic==='1')return ['Automatik',''];
      return ['Bereit',''];
    }
    function irCard(c){
      var s=c.st||{}, run=(s.Running===1||s.Running===true||s.Running==='1');
      var stat=irStatus(c);
      var auto=(s.Automatic===1||s.Automatic===true||s.Automatic==='1');
      var act=(s.Active===1||s.Active===true||s.Active==='1');
      var dur=Math.round(num(s.Duration,c.runMin||20));
      var adj=Math.round(num(s.SeasonalAdjust,100));
      var prog=parseInt(s.Program,10); if(isNaN(prog))prog=0;
      var runMin=Math.round(c.runMin||dur||20);
      var sub=[]; if(c.room)sub.push(c.room); if(s.LastRun)sub.push(String(s.LastRun)); if(s.Rain!=null&&s.Rain!=='')sub.push('Regen '+(Math.round(num(s.Rain,0)*10)/10)+' mm');
      var h='<div class="irxc'+(run?' run':'')+'" data-iric="'+c.iid+'">'
        +'<div class="irxc-h"><span class="irxc-ic">'+irIcon()+'</span>'
        +'<span class="irxc-nm">'+escL(c.name||'')+'</span>'
        +'<span class="irxc-st '+stat[1]+'">'+esc(stat[0])+'</span>'
        +'<button class="irxc-arm'+(c.armed?' armed':'')+'" data-irarm="'+c.iid+'" title="'+(c.armed?'Scharf geschaltet – klick für Schatten-Modus':'Schatten-Modus – klick zum Scharfschalten')+'">'+(c.armed?'Scharf':'Schatten')+'</button></div>';
      // Jetzt bewaessern (Minuten-Stepper) + Stoppen
      h+='<div class="irxc-run"><span class="irxc-stp"><button data-irmin="'+c.iid+'" data-ird="-1">−</button><span>'+runMin+' min</span><button data-irmin="'+c.iid+'" data-ird="1">+</button></span>'
        +'<button class="irxc-go" data-irrun="'+c.iid+'">Jetzt</button>'
        +'<button class="irxc-stop" data-irstop="'+c.iid+'">Stopp</button></div>';
      // Automatik + Active
      h+='<div class="irxc-tgls"><button class="irxc-tgl'+(auto?' on':'')+'" data-irauto="'+c.iid+'">Automatik</button>'
        +'<button class="irxc-tgl'+(act?' on':'')+'" data-iract="'+c.iid+'">'+(act?'Aktiv':'Aus')+'</button></div>';
      // Basisdauer
      h+='<div class="irxc-row"><span class="irxc-lbl">Basisdauer</span><span class="irxc-stp"><button data-irdur="'+c.iid+'" data-ird="-1">−</button><span>'+dur+' min</span><button data-irdur="'+c.iid+'" data-ird="1">+</button></span></div>';
      // Saison-Faktor
      h+='<div class="irxc-row"><span class="irxc-lbl">Saison</span>'
        +'<input class="irxc-rng" type="range" min="'+c.adj.min+'" max="'+c.adj.max+'" step="'+c.adj.step+'" value="'+adj+'" data-iradj="'+c.iid+'" aria-label="Saison-Faktor">'
        +'<span class="irxc-val" data-iradjv="'+c.iid+'">'+adj+' %</span></div>';
      // Programm
      if(c.prog&&c.prog.length){
        h+='<div class="irxc-row"><span class="irxc-lbl">Programm</span><select class="irxc-sel" data-irprog="'+c.iid+'">'
          +c.prog.map(function(o){return '<option value="'+o[0]+'"'+(prog==o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></div>';
      }
      if(sub.length)h+='<div class="irxc-sub">'+esc(sub.join(' · '))+'</div>';
      h+='</div>';
      return h;
    }
    function irCircuitsFor(w){
      var all=_irData||[];
      if(w._kind==='circuit'){ var cid=parseInt(w.circuitId||0)||0; return cid?all.filter(function(c){return c.iid===cid;}):(all.length?[all[0]]:[]); }
      return all;
    }
    function irRender(w){
      var list=irCircuitsFor(w);
      if(_irErr) return '<div class="irxwrap"><div class="irx-msg">Bewässerung nicht erreichbar</div></div>';
      if(!_irData) return '<div class="irxwrap"><div class="irx-msg">Bewässerung lädt …</div></div>';
      if(!list.length) return '<div class="irxwrap"><div class="irx-msg">Keine Bewässerungskreise</div></div>';
      var shadow=list.some(function(c){return c.armed===false;});
      var h='<div class="irxwrap">';
      if(shadow)h+='<div class="irx-shadow">Schatten-Modus aktiv – im Schatten laufende Kreise schalten den Aktor noch nicht real.</div>';
      if(w._kind==='circuit'){ h+='<div class="irx-grid">'+list.map(irCard).join('')+'</div></div>'; return h; }
      // Gruppieren: Bereich/Geschoss -> Raum (stabil)
      var groups={}, order=[];
      list.forEach(function(c){var key=(c.group||'')+'||'+(c.room||'');if(!groups[key]){groups[key]={group:c.group,room:c.room,items:[]};order.push(key);}groups[key].items.push(c);});
      order.sort(function(a,b){var A=groups[a],B=groups[b];var fr=floorRank(A.group)-floorRank(B.group);if(fr)return fr;return (A.room||'').localeCompare(B.room||'');});
      var cur=null;
      order.forEach(function(key){var g=groups[key];
        var head=g.group||g.room||'';
        if(head!==cur){cur=head;h+='<div class="irx-floor">'+escL(head||'Bewässerung')+'</div>';}
        h+='<div class="irx-grid">'+g.items.map(irCard).join('')+'</div>';});
      h+='</div>';
      return h;
    }

    function irEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function irPaint(w){var el=irEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=irRender(w);irWire(w,host);}
    function irById(id){return (_irData||[]).find(function(c){return c.iid===id;});}

    function irWire(w,host){
      host.querySelectorAll('[data-irarm]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irarm'));if(!c)return;irSetArmed(c,!c.armed);irPaint(w);});});
      host.querySelectorAll('[data-irrun]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irrun'));if(!c)return;irRunNow(c,Math.round(c.runMin||0));irPaint(w);});});
      host.querySelectorAll('[data-irstop]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irstop'));if(!c)return;irStopNow(c);irPaint(w);});});
      host.querySelectorAll('[data-irmin]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irmin'));if(!c)return;var d=+b.getAttribute('data-ird');var v=Math.round((c.runMin||0)+d);var mx=(c.dur&&c.dur.max)||120;c.runMin=Math.max(1,Math.min(mx,v));irPaint(w);});});
      host.querySelectorAll('[data-irdur]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irdur'));if(!c)return;var d=+b.getAttribute('data-ird');var cur=Math.round(num(c.st.Duration,c.runMin||20));var st=(c.dur&&c.dur.step)||1;var v=cur+d*st;v=Math.max(c.dur.min,Math.min(c.dur.max,v));irSetVar(c,'Duration',v);irPaint(w);});});
      host.querySelectorAll('[data-irauto]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irauto'));if(!c)return;var on=!(c.st.Automatic===1||c.st.Automatic===true||c.st.Automatic==='1');irSetVar(c,'Automatic',on?1:0);irPaint(w);});});
      host.querySelectorAll('[data-iract]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-iract'));if(!c)return;var on=!(c.st.Active===1||c.st.Active===true||c.st.Active==='1');irSetVar(c,'Active',on?1:0);if(on)c.st.Running=1;else c.st.Running=0;irPaint(w);});});
      host.querySelectorAll('[data-iradj]').forEach(function(r){
        r.addEventListener('input',function(){var lab=host.querySelector('[data-iradjv="'+r.getAttribute('data-iradj')+'"]');if(lab)lab.textContent=(parseInt(r.value)||0)+' %';});
        r.addEventListener('change',function(){var c=irById(+r.getAttribute('data-iradj'));if(!c)return;irSetVar(c,'SeasonalAdjust',parseInt(r.value)||0);});
      });
      host.querySelectorAll('[data-irprog]').forEach(function(sel){sel.addEventListener('change',function(){var c=irById(+sel.getAttribute('data-irprog'));if(!c)return;irSetVar(c,'Program',parseInt(sel.value)||0);});});
    }

    function irDef(kind,label,defSize){
      defWidget(kind,{
        // Kategorie ist fuer beide Familienmitglieder identisch -> fest gesetzt statt Parameter.
        label:label, cat:'HomeSuite · Bewässerung', paletteIcon:'droplet', size:defSize,
        defaults:function(w){w._kind=(kind==='irrigcircuit')?'circuit':'grid';},
        render:function(w){w._kind=(kind==='irrigcircuit')?'circuit':'grid';return irRender(w);},
        mount:function(w){w._kind=(kind==='irrigcircuit')?'circuit':'grid';var el=irEl(w);if(!el)return;
          if(_irData){irPaint(w);}else{irLoad(function(){irPaint(w);});}
          LVB.panel.startPoll('irrigx:'+w.id,30000,function(){ if(_irData)irRefresh(function(){irPaint(w);}); else irLoad(function(){irPaint(w);}); });},
        _bind:function(w){irPaint(w);},
        props:function(w){
          var h='';
          if(kind==='irrigcircuit'){
            h+='<div class="pgh">Kreis</div>';
            h+=row('Kreis (Instanz-ID)','<input id="irCid" type="number" value="'+(w.circuitId||'')+'" placeholder="HSIR-Instanz-ID">');
            h+='<div style="font-size:11px;color:var(--muted);padding:4px 2px">Leer = erster gefundener Bewässerungskreis.</div>';
          } else {
            h+='<div style="font-size:11px;color:var(--muted);padding:4px 2px">Zeigt alle HomeSuite-Bewässerungskreise (IrrigationCircuit), gruppiert nach Bereich und Raum.</div>';
          }
          return h;
        },
        wire:function(w){
          if($('#irCid'))$('#irCid').onchange=function(){w.circuitId=parseInt(this.value)||undefined;commit();irPaint(w);};
        }
      });
    }
    irDef('irriggrid','Bewässerung · Übersicht',[720,460]);
    irDef('irrigcircuit','Bewässerung · Kreis',[300,360]);
  })();
