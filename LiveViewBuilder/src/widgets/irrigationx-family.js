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
      // ---- Karte im Entwurfsstil (irxStil='karte'): eine Kachel je Kreis, grosse
      // effektive Dauer, Sperrgrund im Klartext, Batterie und ein Knopf. Die volle
      // Reglerkarte bleibt erreichbar - ein Tipp auf die Kachel klappt sie auf.
      // Im Kartenstil sollen die Kacheln die Breite AUFTEILEN, nicht in ein auto-fill-
      // Raster mit fester Mindestbreite fallen: bei drei Kreisen in einer 1430 breiten
      // Kachel entstanden sonst fuenf Spalten, von denen zwei leer blieben.
      +'.irxwrap.karte .irx-grid{grid-template-columns:repeat(auto-fit,minmax(clamp(230px,30cqi,460px),1fr));grid-auto-rows:1fr;align-content:stretch;height:100%;box-sizing:border-box}'
      +'.irxwrap.karte{container-type:inline-size;padding:0;display:flex;flex-direction:column;gap:clamp(5px,1.6cqmin,9px)}'
      +'.irxwrap.karte .irx-grid{flex:1;min-height:0}'
      // Der Schatten-Modus ist die wichtigste Aussage der Seite: es sieht aus wie eine
      // Steuerung, schaltet aber nichts. Er gehoert deshalb sichtbar ueber die Kacheln -
      // und verschwindet von selbst, sobald scharf geschaltet ist.
      +'.irx-schatten{flex:none;display:flex;align-items:center;gap:9px;padding:6px 12px;border-radius:var(--r-s,9px);'
      + 'border:1px solid var(--warn);background:color-mix(in oklab,var(--warn) 10%,transparent);'
      + 'color:var(--warn);font-size:clamp(10px,2.4cqmin,13px);line-height:1.3}'
      +'.irx-schatten b{font-weight:700}'
      +'.irx-schatten span{color:var(--muted);font-weight:400}'
      +'.irk-sch{flex:none;padding:4px 8px;border-radius:var(--r-s,9px);font-size:clamp(9px,3.2cqi,11px);font-weight:600;'
      + 'color:var(--warn);border:1px solid color-mix(in oklab,var(--warn) 45%,transparent);'
      + 'background:color-mix(in oklab,var(--warn) 10%,transparent);white-space:nowrap}'
      +'.irk{container-type:inline-size;border:1px solid var(--line);border-radius:var(--r,12px);background:var(--surface);'
      + 'padding:clamp(9px,2.9cqmin,15px);display:flex;flex-direction:column;overflow:hidden;cursor:pointer}'
      +'.irk-h{display:flex;align-items:flex-start;gap:clamp(6px,2.6cqi,11px)}'
      +'.irk-nm{font-size:clamp(13px,5.6cqi,18px);font-weight:600;line-height:1.2}'
      +'.irk-pl{font-size:clamp(10px,3.9cqi,12.5px);color:var(--faint);margin-top:3px;font-variant-numeric:tabular-nums}'
      +'.irk-st{flex:none;display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:var(--r-s,9px);'
      + 'font-size:clamp(10px,3.8cqi,12.5px);font-weight:600;white-space:nowrap}'
      +'.irk-st.ok{color:var(--accent);background:color-mix(in oklab,var(--accent) 12%,transparent);border:1px solid color-mix(in oklab,var(--accent) 45%,transparent)}'
      +'.irk-st.blk{color:var(--crit);background:color-mix(in oklab,var(--crit) 12%,transparent);border:1px solid color-mix(in oklab,var(--crit) 45%,transparent)}'
      +'.irk-st.run{color:var(--info);background:color-mix(in oklab,var(--info) 12%,transparent);border:1px solid color-mix(in oklab,var(--info) 45%,transparent)}'
      +'.irk-big{display:flex;align-items:baseline;gap:clamp(5px,2.4cqi,9px);margin-top:clamp(5px,2.2cqmin,10px)}'
      +'.irk-big b{font-size:clamp(22px,13cqi,40px);font-weight:700;line-height:1;font-variant-numeric:tabular-nums;font-family:var(--fm)}'
      +'.irk-big i{font-style:normal;font-size:clamp(11px,4.4cqi,15px);color:var(--muted)}'
      +'.irk-big s{font-size:clamp(10px,3.9cqi,13px);color:var(--faint);font-variant-numeric:tabular-nums;font-family:var(--fm)}'
      +'.irk-why{font-size:clamp(10px,3.9cqi,12.5px);color:var(--muted);margin-top:4px;line-height:1.3}'
      +'.irk-why.warn{color:var(--warn)}'
      +'.irk-sep{height:1px;background:var(--line-soft);margin:clamp(6px,2.4cqmin,10px) 0 clamp(5px,2cqmin,8px)}'
      +'.irk-kv{display:flex;gap:clamp(10px,5cqi,22px)}'
      +'.irk-kv>div{flex:1;min-width:0}'
      +'.irk-k{font-size:clamp(8px,3.1cqi,11px);letter-spacing:.06em;text-transform:uppercase;color:var(--faint);font-weight:600}'
      +'.irk-v{font-size:clamp(10px,4.1cqi,13.5px);margin-top:2px;font-variant-numeric:tabular-nums;font-family:var(--fm)}'
      +'.irk-v.leer{color:var(--faint);font-family:var(--fu)}'
      +'.irk-f{display:flex;align-items:center;gap:clamp(7px,3cqi,13px);margin-top:auto;padding-top:clamp(6px,2.4cqmin,10px)}'
      +'.irk-bat{display:flex;align-items:center;gap:6px;font-size:clamp(10px,3.9cqi,13px);color:var(--muted);font-variant-numeric:tabular-nums}'
      +'.irk-bat.warn{color:var(--warn)}'
      +'.irk-go{margin-left:auto;min-height:clamp(38px,11cqmin,46px);min-width:clamp(96px,42cqi,140px);display:flex;align-items:center;'
      + 'justify-content:center;gap:7px;border:1px solid var(--accent-2);border-radius:var(--r-s,9px);background:var(--surface-2);'
      + 'color:var(--accent);font-size:clamp(11px,4.3cqi,14.5px);font-weight:600;cursor:pointer}'
      +'.irk-go:disabled{opacity:.45;cursor:default}'
      +'.irk-zu{margin-top:clamp(8px,3.2cqmin,13px);border-top:1px solid var(--line-soft);padding-top:clamp(8px,3.2cqmin,13px)}'
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
        // Effektive Dauer, Sperre und Wochenfenster - die Karte im Entwurfsstil lebt davon.
        list.forEach(function(c){ jobs.push(irProbe(c)); jobs.push(irPlan(c)); });
        Promise.all(jobs).then(function(){_irData=list;_irErr='';_irLoading=false;cb&&cb();})
          .catch(function(){_irData=list;_irErr='';_irLoading=false;cb&&cb();});
      }).catch(function(){_irErr='net';_irLoading=false;cb&&cb();});
    }
    // Kreis-Liste aus der Topologie ziehen (gleiche Baumform wie heatx: Haus->Bereich->Raum->entities).
    function irCircuitsFromTopo(j){
      var out=[];
      // Die Kette Haus/Bereich/Raum wird MITGEFUEHRT. Bei zwei Standorten heissen beide
      // Bereiche "Garten" - ohne das Haus waeren die Gruppen nicht unterscheidbar, und
      // eine Ansicht koennte sich nicht auf einen Standort beschraenken.
      function pushEnt(e,room,group,kette,haus){ if((e.domain||'')!=='irrigation')return;
        out.push({iid:e.iid,name:e.name||room||('#'+e.iid),room:room||'',group:group||'',haus:haus||'',
          kette:kette||[],armed:false,
          vars:{},prog:[],dur:{min:1,max:120,step:1},adj:{min:0,max:200,step:5},runMin:0,st:{}}); }
      (j&&j.tree||[]).forEach(function(haus){ var hid=haus.iid||haus.id||0, hn=haus.name||'';
        (haus.children||[]).forEach(function(area){ var aid=area.iid||area.id||0;
        if(area.kind==='Bereich'){ var g=area.abbr||area.name||'';
          (area.children||[]).forEach(function(rm){ var rid=rm.iid||rm.id||0;
            if(rm.kind==='Raum')(rm.entities||[]).forEach(function(e){pushEnt(e,rm.name,g,[hid,aid,rid],hn);}); });
        } else if(area.kind==='Raum'){ (area.entities||[]).forEach(function(e){pushEnt(e,area.name,'',[hid,aid],hn);}); }
      }); });
      (j&&j.unassigned||[]).forEach(function(e){ pushEnt(e,'','',[],''); });
      return out;
    }
    /** Gehoert der Kreis unter den gewaehlten Standort-Knoten? 0 = keine Einschraenkung. */
    function irImStandort(c,root){ root=parseInt(root)||0; if(!root)return true;
      return (c.kette||[]).indexOf(root)>=0; }
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

    // ---- Zusatzdaten fuer die Karte im Entwurfsstil --------------------------
    // computeProbe rechnet effektive Dauer und Gate (Regen/Temperatur) OHNE Geraete-
    // zugriff - es liest nur Variablen. getSchedule liefert die Wochenfenster, aus
    // denen "taeglich 15:07-15:17" und "naechster Lauf" entstehen.
    function irProbe(c){ return irManagePromise(c.iid,{op:'computeProbe'})
      .then(function(j){ if(j&&j.ok)c.probe=j; }).catch(function(){}); }
    function irPlan(c){ return irManagePromise(c.iid,{op:'getSchedule'})
      .then(function(j){ if(j&&j.ok)c.week=j.week||null; }).catch(function(){}); }
    /** Fenster eines Tages: [{von,bis}] in Minuten. Slots sind kumulierte Enden. */
    function irFenster(slots){
      var out=[],vor=0;
      (slots||[]).forEach(function(sl){
        var end=num(sl.end,0), val=num(sl.val,0);
        if(val>0&&end>vor)out.push({von:vor,bis:end});
        vor=end;
      });
      return out;
    }
    function irHM(m){ m=Math.max(0,Math.round(m)); var h=Math.floor(m/60)%24,i=m%60;
      return (h<10?'0':'')+h+':'+(i<10?'0':'')+i; }
    /** "taeglich 15:07-15:17" wenn alle sieben Tage dasselbe einzelne Fenster tragen. */
    function irPlanText(c){
      if(!c.week)return '';
      var ref=null,gleich=true,leer=true;
      for(var d=0;d<7;d++){
        var f=irFenster(c.week[d]);
        if(f.length)leer=false;
        var k=f.map(function(x){return x.von+'-'+x.bis;}).join(',');
        if(ref===null)ref=k; else if(k!==ref)gleich=false;
      }
      if(leer)return '';
      if(gleich){ var f0=irFenster(c.week[0]);
        if(f0.length===1)return 'täglich '+irHM(f0[0].von)+'–'+irHM(f0[0].bis);
        return 'täglich · '+f0.length+' Fenster';
      }
      return 'Wochenplan hinterlegt';
    }
    /** Naechstes An-Fenster ab jetzt, bis zu sieben Tage voraus. */
    function irNaechster(c){
      if(!c.week)return '';
      var jetzt=new Date(), heute=(jetzt.getDay()+6)%7, min=jetzt.getHours()*60+jetzt.getMinutes();
      var tage=['Mo','Di','Mi','Do','Fr','Sa','So'];
      for(var i=0;i<8;i++){
        var d=(heute+i)%7, f=irFenster(c.week[d]);
        for(var k=0;k<f.length;k++){
          if(i===0&&f[k].von<=min)continue;
          if(i===0)return 'heute '+irHM(f[k].von);
          if(i===1)return 'morgen '+irHM(f[k].von);
          return tage[d]+' '+irHM(f[k].von);
        }
      }
      return '';
    }
    // ---- Ventilzustand aus der Bewaesserungs-Wache ---------------------------
    // Batterie und Funk haengen am GERAET, nicht an der HomeSuite-Entitaet. Die Wache
    // schreibt sie je Kreis in eine JSON-Variable; ohne sie bleibt die Zeile leer.
    var _irWache={}, _irWacheT=0;
    function irWacheLaden(vid,cb){
      vid=parseInt(vid)||0;
      if(!vid||irDoku()){cb&&cb();return;}
      if(Date.now()-_irWacheT<20000){cb&&cb();return;}
      fetch('?api=val&ids='+vid,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;})
        .then(function(j){ var d=j&&j.values&&j.values[vid];
          if(d&&d.v){ try{_irWache=JSON.parse(d.v)||{};}catch(e){} }
          _irWacheT=Date.now(); cb&&cb(); }).catch(function(){cb&&cb();});
    }
    function irWacheFor(c){ return _irWache[String(c.iid)]||null; }
    // Leichter State-Refresh (ohne Manifest) — fuers Polling.
    function irRefresh(cb){
      if(irDoku()||!_irData){cb&&cb();return;}
      var jobs=_irData.map(function(c){
        return fetch('?api=mod&op=state&id='+c.iid,{cache:'no-store'}).then(function(r){return r.json();})
          .then(function(s){ if(s&&!s.err)c.st=s; }).catch(function(){});
      });
      // Das Gate haengt an Regen und Temperatur und kann sich zwischen zwei Laeufen
      // drehen - der Trockenlauf gehoert deshalb in den Takt. Er kostet keinen
      // Geraetezugriff, er liest nur Variablen. Der Wochenplan aendert sich nicht
      // von selbst und bleibt beim Laden.
      _irData.forEach(function(c){ jobs.push(irProbe(c)); });
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
    // ---- Karte im Entwurfsstil ----------------------------------------------
    function irTropfen(){return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4-7-12-7-12S5 11 5 15a7 7 0 0 0 7 7Z"/></svg>';}
    function irBattIco(p){
      var f=Math.max(0,Math.min(10,Math.round((num(p,0)/100)*10)));
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
        +'<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/>'
        +(f?'<rect x="4" y="9" width="'+(f*1.3)+'" height="6" rx="1" fill="currentColor" stroke="none"/>':'')+'</svg>';
    }
    /** "Bewaesserung Buchshecke (Bewässerung)" -> "Buchshecke". Der Suffix kommt vom
        Modul, der Praefix aus dem Instanznamen; auf einer Bewaesserungsseite ist beides
        nur Wiederholung. */
    function irName(n){
      n=String(n||'');
      n=n.replace(/\s*\((?:Bew[äa]sserung|Irrigation)\)\s*$/i,'');
      n=n.replace(/^\s*Bew[äa]sserung\s+/i,'');
      return n.trim();
    }
    /** Sperrgrund lesbar machen: das Modul liefert "Regen 4.83 mm (>= 2)". */
    function irGrund(t){
      t=String(t||'');
      t=t.replace(/(\d),?(\d*)\.(\d+)/g,function(m,a,b,d){return a+b+','+d;});
      t=t.replace(/\(>=\s*([0-9,]+)\)/,'über der Schranke von $1 mm');
      return t;
    }
    function irKarte(c,w){
      var s=c.st||{}, pr=c.probe||{}, wa=irWacheFor(c);
      var run=(s.Running===1||s.Running===true||s.Running==='1');
      var gesperrt=!!(pr.gate&&pr.gate.blocked);
      var stat = run ? ['Läuft','run'] : (gesperrt ? ['Gesperrt','blk'] : ['Bereit','ok']);
      var basis = (pr.baseMin!=null) ? num(pr.baseMin,0) : num(s.Duration,0);
      var eff   = (pr.effectiveMin!=null) ? num(pr.effectiveMin,basis) : basis;
      var plan  = irPlanText(c), naechst = irNaechster(c);
      var grund = gesperrt ? (pr.gate.reason||'gesperrt') : '';
      var h='<div class="irk" data-irkarte="'+c.iid+'">'
        +'<div class="irk-h"><div style="flex:1;min-width:0">'
          +'<div class="irk-nm">'+escL(irName(c.name))+'</div>'
          +'<div class="irk-pl'+(plan?'':' ')+'" style="'+(plan?'':'color:var(--warn)')+'">'+esc(plan||'kein Zeitplan hinterlegt')+'</div>'
        +'</div>'
        +(c.armed===false?'<span class="irk-sch">Schatten</span>':'')
        +'<span class="irk-st '+stat[1]+'">'+esc(stat[0])+'</span></div>'
        +'<div class="irk-big"><b>'+(Math.round(eff*10)/10)+'</b><i>min</i>'
        + (Math.abs(eff-basis)>0.05 ? '<s style="text-decoration:line-through">'+(Math.round(basis*10)/10)+' min</s>'
                                     : '<s style="text-decoration:none">Basis '+(Math.round(basis*10)/10)+' min</s>')+'</div>';
      if(grund) h+='<div class="irk-why">'+esc(irGrund(grund))+'</div>';
      else if(wa&&wa.stufe&&wa.stufe!=='ok'&&wa.text) h+='<div class="irk-why warn">'+esc(wa.text)+'</div>';
      else if(pr.tempFactor!=null&&num(pr.tempFactor,1)!==1)
        h+='<div class="irk-why">Temperatur '+Math.round(num(pr.tempFactor,1)*100)+' % · '+(pr.tempNow!=null?(String(pr.tempNow).replace('.',',')+' °C'):'')+'</div>';

      h+='<div class="irk-sep"></div>'
        +'<div class="irk-kv">'
          +'<div><div class="irk-k">Nächster Lauf</div><div class="irk-v'+(naechst?'':' leer')+'">'+esc(naechst||'—')+'</div></div>'
          +'<div><div class="irk-k">Zuletzt</div><div class="irk-v'+((wa&&wa.letzte)?'':' leer')+'">'
            +esc((wa&&wa.letzte)?wa.letzte:'keine Aufzeichnung')+'</div></div>'
        +'</div>'
        +'<div class="irk-f">';
      if(wa&&wa.batt!=null)
        h+='<span class="irk-bat'+(wa.batt<=25?' warn':'')+'">'+irBattIco(wa.batt)+num(wa.batt,0)+' %</span>';
      h+='<button class="irk-go" data-irrun="'+c.iid+'"'+(run?' disabled':'')+'>'+irTropfen()
        +(run?'Läuft':'Jetzt gießen')+'</button></div>';
      // Aufgeklappt: die volle Reglerkarte, damit nichts unerreichbar wird.
      if(_irOffen[c.iid]) h+='<div class="irk-zu">'+irCard(c)+'</div>';
      h+='</div>';
      return h;
    }
    var _irOffen={};

    function irCircuitsFor(w){
      var all=_irData||[];
      if(w._kind==='circuit'){ var cid=parseInt(w.circuitId||0)||0; return cid?all.filter(function(c){return c.iid===cid;}):(all.length?[all[0]]:[]); }
      // Standort-Filter: eine Ansicht je Haus. Ohne ihn stuenden beide Gaerten
      // untereinander, und die Gruppentitel hiessen beide "Garten".
      var aus=all.filter(function(c){return irImStandort(c,w.irxRoot);});
      if(w.irxStil==='karte'){
        // Nach der ERSTEN Startzeit des Plans ordnen. Die Reihenfolge aus der Topologie
        // ist die der Objekt-IDs und damit fuer den Betrachter zufaellig.
        aus=aus.slice().sort(function(a,b){
          var fa=a.week?irFenster(a.week[0]):[], fb=b.week?irFenster(b.week[0]):[];
          var va=fa.length?fa[0].von:99999, vb=fb.length?fb[0].von:99999;
          if(va!==vb)return va-vb;
          return irName(a.name).localeCompare(irName(b.name));
        });
      }
      return aus;
    }
    function irRender(w){
      var list=irCircuitsFor(w);
      if(_irErr) return '<div class="irxwrap"><div class="irx-msg">Bewässerung nicht erreichbar</div></div>';
      if(!_irData) return '<div class="irxwrap"><div class="irx-msg">Bewässerung lädt …</div></div>';
      if(!list.length) return '<div class="irxwrap"><div class="irx-msg">Keine Bewässerungskreise</div></div>';
      var shadow=list.some(function(c){return c.armed===false;});
      var stil=(w.irxStil==='karte')?'karte':'voll';
      var h='<div class="irxwrap'+(stil==='karte'?' karte':'')+'">';
      // Im Entwurfsstil traegt die SEITE den Schatten-Hinweis (Kopfzeile), nicht jede
      // Kachel - sonst steht er auf beiden Standortseiten doppelt.
      if(shadow&&stil!=='karte')h+='<div class="irx-shadow">Schatten-Modus aktiv – im Schatten laufende Kreise schalten den Aktor noch nicht real.</div>';
      if(shadow&&stil==='karte'){
        var nSch=list.filter(function(c){return c.armed===false;}).length;
        h+='<div class="irx-schatten">'
          +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
          +'<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>'
          +'<b>Schatten-Modus</b>'
          +'<span>'+(nSch===list.length?'Die Steuerung schaltet nicht':(nSch+' von '+list.length+' Kreisen schalten nicht'))
          +' – gegossen wird von der LinkTap-App. Antippen einer Kachel zeigt den Schalter zum Scharfstellen.</span></div>';
      }
      var zeichne=(stil==='karte')?function(c){return irKarte(c,w);}:irCard;
      if(w._kind==='circuit'){ h+='<div class="irx-grid">'+list.map(zeichne).join('')+'</div></div>'; return h; }
      // Im Entwurfsstil zeigt EINE Ansicht EINEN Standort - die Bereichs-/Raumtitel
      // waeren dort nur Wiederholung der Seitenueberschrift.
      if(stil==='karte'){
        // FESTE Spaltenzahl statt auto-fit: ein umbrechendes Raster erzeugt eine zweite
        // Reihe, die nicht mehr in die Kachel passt - und dann scrollt die Seite, was auf
        // einem Wandtablett niemand will. Lieber schmalere Karten; die Schrift rechnet
        // ohnehin aus der Kartenbreite (cqi).
        var sp=Math.max(1,Math.min(3,list.length));
        h+='<div class="irx-grid" style="grid-template-columns:repeat('+sp+',minmax(0,1fr))">'
          +list.map(zeichne).join('')+'</div></div>';
        return h;
      }
      // Gruppieren: Bereich/Geschoss -> Raum (stabil)
      var groups={}, order=[];
      list.forEach(function(c){var key=(c.group||'')+'||'+(c.room||'');if(!groups[key]){groups[key]={group:c.group,room:c.room,items:[]};order.push(key);}groups[key].items.push(c);});
      order.sort(function(a,b){var A=groups[a],B=groups[b];var fr=floorRank(A.group)-floorRank(B.group);if(fr)return fr;return (A.room||'').localeCompare(B.room||'');});
      var cur=null;
      order.forEach(function(key){var g=groups[key];
        var head=g.group||g.room||'';
        if(head!==cur){cur=head;h+='<div class="irx-floor">'+escL(head||'Bewässerung')+'</div>';}
        h+='<div class="irx-grid">'+g.items.map(zeichne).join('')+'</div>';});
      h+='</div>';
      return h;
    }

    function irEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function irPaint(w){var el=irEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=irRender(w);irWire(w,host);}
    function irById(id){return (_irData||[]).find(function(c){return c.iid===id;});}

    function irWire(w,host){
      host.querySelectorAll('[data-irarm]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irarm'));if(!c)return;irSetArmed(c,!c.armed);irPaint(w);});});
      host.querySelectorAll('[data-irrun]').forEach(function(b){b.addEventListener('click',function(e){
        var c=irById(+b.getAttribute('data-irrun'));if(!c)return;
        e.stopPropagation();   // sonst klappt zugleich die Reglerkarte auf
        // Im Entwurfsstil gilt die EFFEKTIVE Dauer - das ist die Zahl, die auf der
        // Kachel steht. Alles andere waere ein anderer Lauf als der angezeigte.
        var min=(w.irxStil==='karte'&&c.probe&&c.probe.effectiveMin!=null)
                ? Math.max(1,Math.round(num(c.probe.effectiveMin,0)))
                : Math.round(c.runMin||0);
        irRunNow(c,min);irPaint(w);});});
      host.querySelectorAll('[data-irkarte]').forEach(function(k){k.addEventListener('click',function(e){
        if(e.target.closest('button,input,select'))return;
        var id=+k.getAttribute('data-irkarte');_irOffen[id]=!_irOffen[id];irPaint(w);});});
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
          if(_irData){irWacheLaden(w.irxWache,function(){irPaint(w);});}
          else{irLoad(function(){irWacheLaden(w.irxWache,function(){irPaint(w);});});}
          LVB.panel.startPoll('irrigx:'+w.id,30000,function(){
            if(_irData)irRefresh(function(){irWacheLaden(w.irxWache,function(){irPaint(w);});});
            else irLoad(function(){irPaint(w);}); });},
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
          h+='<div class="pgh">Darstellung</div>';
          h+=row('Stil','<select id="irStil"><option value="voll"'+((w.irxStil||'voll')==='voll'?' selected':'')+'>Regler (alle Bedienelemente)</option>'
            +'<option value="karte"'+(w.irxStil==='karte'?' selected':'')+'>Karte (Entwurf: Dauer, Sperre, Batterie)</option></select>');
          h+=row('Standort','<input id="irRoot" type="number" value="'+(w.irxRoot||'')+'" placeholder="Haus/Bereich-Instanz-ID">');
          h+='<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Leer = alle. Mit einer Haus-ID zeigt die Ansicht nur diesen Standort.</div>';
          h+=row('Wache (JSON)','<input id="irWache" type="number" value="'+(w.irxWache||'')+'" placeholder="VentileJson der Bewässerungs-Wache">');
          h+='<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Liefert Batterie und Funkzustand je Kreis. Ohne sie bleibt die Batteriezeile leer.</div>';
          return h;
        },
        wire:function(w){
          if($('#irCid'))$('#irCid').onchange=function(){w.circuitId=parseInt(this.value)||undefined;commit();irPaint(w);};
          if($('#irStil'))$('#irStil').onchange=function(){w.irxStil=(this.value==='karte')?'karte':undefined;commit();irPaint(w);};
          if($('#irRoot'))$('#irRoot').onchange=function(){w.irxRoot=parseInt(this.value)||undefined;commit();irPaint(w);};
          if($('#irWache'))$('#irWache').onchange=function(){w.irxWache=parseInt(this.value)||undefined;commit();irPaint(w);};
        }
      });
    }
    irDef('irriggrid','Bewässerung · Übersicht',[720,460]);
    irDef('irrigcircuit','Bewässerung · Kreis',[300,360]);
  })();
