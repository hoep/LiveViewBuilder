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
      +'.lxr-arm.armed{background:var(--accent);border-color:var(--accent);color:#fff}'
      // ---- Leuchtbank (Entwurf 28c) ----------------------------------------
      // Wärmefarbe heisst Licht, Akzent heisst Bedienung. Alle Farben aus dem Skin;
      // die vier Licht-Toene sind Ableitungen von --warm, keine eigenen Hexwerte.
      +'.lbwrap{--licht:var(--warm);--licht-core:var(--sun);'
      +'--licht-bg:color-mix(in oklab,var(--warm) 13%,transparent);'
      +'--licht-bd:color-mix(in oklab,var(--warm) 42%,transparent);'
      +'--licht-glow:color-mix(in oklab,var(--warm) 50%,transparent);'
      +'--track:color-mix(in oklab,var(--line) 85%,transparent);'
      +'position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;overflow:hidden}'
      // Einzelne Leuchtenzeile als eigenes Widget: dieselben Licht-Toene, aber der
      // Rahmen des Widgets IST die Zeile - keine Spalten, keine Legende.
      +'.lbone{position:absolute;inset:0;--licht:var(--warm);--licht-core:var(--sun);'
      +'--licht-bg:color-mix(in oklab,var(--warm) 13%,transparent);'
      +'--licht-bd:color-mix(in oklab,var(--warm) 42%,transparent);'
      +'--licht-glow:color-mix(in oklab,var(--warm) 50%,transparent);'
      +'--track:color-mix(in oklab,var(--line) 85%,transparent);display:flex}'
      +'.lbone>.lbbar{flex:1;min-width:0}'
      // Raumkarte als eigenes Widget: identische Optik wie .lbroom, aber der
      // Widget-Rahmen IST die Karte. Die Leuchten liegen als eigene Widgets darauf,
      // deshalb hat die Karte selbst keinen Inhalt ausser der Kopfzeile.
      +'.lbcard{position:absolute;inset:0;--licht:var(--warm);--licht-core:var(--sun);'
      +'--licht-bg:color-mix(in oklab,var(--warm) 13%,transparent);'
      +'--licht-bd:color-mix(in oklab,var(--warm) 42%,transparent);'
      +'--track:color-mix(in oklab,var(--line) 85%,transparent);'
      +'padding:7px;border-radius:14px;border:1px solid var(--line);background:var(--surface);'
      +'box-sizing:border-box;display:flex;flex-direction:column;gap:3px;overflow:hidden}'
      +'.lbcard.on{border-color:var(--licht-bd)}'
      +'.lbcols{flex:1;min-height:0;display:flex;gap:12px;align-items:flex-start;overflow:hidden}'
      +'.lbcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}'
      +'.lbch{display:flex;align-items:center;gap:8px}'
      +'.lbch>b{font:600 11px var(--fu);text-transform:uppercase;letter-spacing:.05em;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      +'.lbch>i{font:500 10.5px var(--fm);font-style:normal;color:var(--muted);white-space:nowrap}'
      +'.lbch>i.on{color:var(--licht)}'
      +'.lbch>s{flex:1;height:1px;background:var(--line);text-decoration:none}'
      +'.lbch>button,.lbrh>button{border:1px solid var(--line);background:var(--surface-2);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}'
      +'.lbch>button{width:26px;height:22px;border-radius:8px;font:600 11px var(--fu)}'
      +'.lbrh>button{width:20px;height:18px;border-radius:6px;font:600 10px var(--fu)}'
      +'.lbch>button:hover,.lbrh>button:hover{color:var(--text);border-color:var(--accent)}'
      +'.lbrooms{display:flex;flex-direction:column;gap:6px}'
      +'.lbroom{padding:7px;border-radius:14px;border:1px solid var(--line);background:var(--surface);display:flex;flex-direction:column;gap:3px}'
      +'.lbroom.on{border-color:var(--licht-bd)}'
      +'.lbrh{height:22px;display:flex;align-items:center;gap:6px;padding:0 3px 3px;border-bottom:1px solid var(--line);box-sizing:border-box}'
      +'.lbrh>span.nm{font:600 12px var(--fu);color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.lbrh>span.dot{width:5px;height:5px;border-radius:50%;background:var(--licht);flex:0 0 5px}'
      +'.lbrh>span.ct{font:500 9.5px var(--fm);color:var(--muted)}'
      +'.lbrh>span.ct.on{color:var(--licht)}'
      +'.lbbar{display:flex;align-items:center;gap:9px;padding:4px 8px;border-radius:11px;border:1px solid transparent;box-sizing:border-box;cursor:pointer}'
      +'.lbbar.on{background:var(--licht-bg);border-color:var(--licht-bd)}'
      +'.lbbar.dim{cursor:ew-resize}'
      +'.lbbar.off-line{opacity:.45;pointer-events:none}'
      +'.lbap{position:relative;width:30px;height:30px;border-radius:50%;flex:0 0 30px;border:1px solid var(--line);background:var(--surface-2);display:flex;align-items:center;justify-content:center}'
      +'.lbbar.on .lbap{border-color:var(--licht-bd)}'
      +'.lbcore{border-radius:50%;background:radial-gradient(circle at 50% 42%,var(--licht-core) 0%,var(--licht) 65%);transition:width .2s ease-out,height .2s ease-out,box-shadow .2s ease-out}'
      +'.lbbar.drag .lbcore{transition:none}'
      +'.lbdot{width:10px;height:10px;border-radius:50%;background:var(--track)}'
      // Melderzeichen. Es muss ZWEI Dinge auf einmal sagen: dass ueberhaupt ein
      // Melder beteiligt ist (dauerhaft, aber leise) und ob er gerade anspricht
      // (deutlich). Mit 12 px und blossem --muted war schon das erste kaum zu
      // sehen. Jetzt traegt es einen eigenen Rand und sitzt auf --surface-2, wird
      // also als Plakette lesbar, ohne laut zu werden - und bei Bewegung springt
      // es auf Warm samt Ring und Schein, ein Unterschied, den man im Vorbeigehen
      // erkennt.
      +'.lbmd{position:absolute;top:-4px;right:-4px;width:15px;height:15px;border-radius:50%;'
      +'background:var(--surface-2);border:1px solid var(--line);box-sizing:border-box;'
      +'display:flex;align-items:center;justify-content:center}'
      +'.lbmd svg{width:11px;height:11px;stroke:var(--muted);stroke-width:2.1}'
      +'.lbmd.on{background:var(--licht-bg);border-color:var(--licht);'
      +'box-shadow:0 0 0 2px color-mix(in oklab,var(--licht) 30%,transparent),0 0 8px var(--licht-glow)}'
      +'.lbmd.on svg{stroke:var(--licht);stroke-width:2.4}'
      +'.lbtxt{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}'
      +'.lbtop{display:flex;align-items:baseline;gap:6px}'
      +'.lbnm{font:600 11.5px/1.2 var(--fu);color:var(--muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.lbbar.on .lbnm{color:var(--text)}'
      +'.lbval{font:500 12px var(--fm);color:var(--muted);flex:0 0 auto}'
      +'.lbbar.on .lbval{font-weight:700;color:var(--licht)}'
      +'.lbtrk{position:relative;height:6px;border-radius:99px;background:var(--track)}'
      +'.lbtrk.lbsw{background:repeating-linear-gradient(90deg,var(--track) 0 3px,transparent 3px 6px)}'
      +'.lbfill{position:absolute;top:0;bottom:0;left:0;border-radius:99px;background:var(--licht);transition:width .2s ease-out}'
      +'.lbbar.drag .lbfill{transition:none}'
      +'.lbgrip{position:absolute;top:-1px;bottom:-1px;width:3px;border-radius:2px;background:var(--licht-core)}'
      +'.lbleg{flex:0 0 18px;height:18px;margin-top:auto;display:flex;align-items:center;gap:18px}'
      +'.lbleg span{display:flex;align-items:center;gap:5px;font:400 10.5px var(--fu);color:var(--muted);white-space:nowrap;flex:0 0 auto}'
      +'.lbkopf{flex:0 0 auto;display:flex;align-items:center;gap:10px}'
      +'.lbkopf>s{flex:1;text-decoration:none}'
      +'.lbpille{display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:99px;background:var(--licht-bg);border:1px solid var(--licht-bd)}'
      +'.lbpille>u{width:7px;height:7px;border-radius:50%;background:var(--licht);text-decoration:none}'
      +'.lbpille>b{font:600 11.5px var(--fu);color:var(--licht)}'
      +'.lb-msg{padding:10px;font:500 12px var(--fu);color:var(--muted)}';
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

    // ---- Leuchtbank (Entwurf 28c) -----------------------------------------
    //  Eine Zeile je Leuchte: Blende, Name, Ziehbahn, Wert. Raeume als Karten,
    //  Karten in hoehenausgeglichenen Spalten. Die Spaltenaufteilung ist eine
    //  LINEARE Partition: die Karten bleiben in Geschossreihenfolge, gesucht ist
    //  die Zerlegung in zusammenhaengende Bloecke mit kleinstem Maximum. Nur so
    //  benennen die Spaltenkoepfe echte Geschosse statt eines Mischmaschs.
    function lbLvl(l){ var v=(l.level!=null&&l.level>=0)?l.level:(l.on?100:0); return l.on?Math.max(0,Math.min(100,Math.round(v))):0; }
    function lbDimBar(l){ return !!(l.caps&&l.caps.dim); }
    // Jede HSLT-Leuchte heisst "<Raum/Geraet> (Licht)". In der Leuchtbank steht der
    // Raum schon im Kartenkopf - der Zusatz ist dort nur Rauschen und kostet Platz,
    // den die schmalen Spalten nicht haben. Nur die Anzeige kuerzt, die Instanz nicht.
    // Welcher Melder gilt fuer diese Leuchte? Regel: der des RAUMS (presenceVid aus
    // der Lichtliste). w.motionVid ist die Ausnahme fuer eine Leuchte mit eigenem
    // Melder; -1 blendet das Zeichen bewusst aus.
    function lbMelderVid(w,l){
      var ov=parseInt(w&&w.motionVid);
      if(ov===-1) return 0;
      if(ov>0) return ov;
      return parseInt(l&&l.presenceVid)||0;
    }
    function lbName(l){ return String(l.name||'').replace(/\s*\(Licht\)\s*$/,'') || (l.name||''); }
    function lbKarten(lamps){
      var g={},ord=[];
      lamps.forEach(function(l){var k=(l.floor||'')+'||'+(l.room||'');
        if(!g[k]){g[k]={floor:l.floor||'',room:l.room||'',items:[]};ord.push(k);} g[k].items.push(l);});
      ord.sort(function(a,b){var A=g[a],B=g[b];var fr=floorRank(A.floor)-floorRank(B.floor);
        return fr?fr:(A.room||'').localeCompare(B.room||'');});
      // Gleichnamige Raeume in verschiedenen Geschossen unterscheidbar machen (Spec §4)
      var zaehl={};
      ord.forEach(function(k){var r=g[k].room||'';zaehl[r]=(zaehl[r]||0)+1;});
      return ord.map(function(k){var x=g[k];
        var titel=x.room||('Ohne Raum · '+x.floor);
        if(x.room&&zaehl[x.room]>1) titel=x.room+' · '+x.floor;
        return {floor:x.floor,titel:titel,items:x.items};});
    }
    function lbHoehe(k,zh){ var n=k.items.length; return 40+n*zh+(n-1)*3; }
    function lbTeile(karten,spalten,zh){
      var N=karten.length, INF=1e9;
      if(spalten<1)spalten=1; if(spalten>N)spalten=Math.max(1,N);
      var blk=function(i,j){var h=30,n=0;for(var t=i;t<j;t++){h+=lbHoehe(karten[t],zh);n++;}return h+Math.max(0,n-1)*6;};
      var dp=[],wo=[],c,j,i;
      for(j=0;j<=N;j++){dp.push([]);wo.push([]);for(c=0;c<=spalten;c++){dp[j].push(INF);wo[j].push(0);}}
      dp[0][0]=0;
      for(c=1;c<=spalten;c++)for(j=1;j<=N;j++)for(i=c-1;i<j;i++){
        if(dp[i][c-1]>=INF)continue;
        var v=Math.max(dp[i][c-1],blk(i,j));
        if(v<dp[j][c]){dp[j][c]=v;wo[j][c]=i;}
      }
      var gr=[];j=N;c=spalten;
      while(c>0){var a=wo[j][c];gr.unshift([a,j]);j=a;c--;}
      return gr.map(function(p){return karten.slice(p[0],p[1]);});
    }
    function lbBar(l,zh){
      var on=!!l.on, dim=lbDimBar(l), lvl=lbLvl(l), reach=(l.reachable!==false);
      // Eine NICHT dimmbare Leuchte kennt nur ganz oder gar nicht. Sie hat zwar
      // meist trotzdem eine Brightness-Variable, und der Live-Weg schreibt deren
      // Wert nach l.level - eine Leuchte mit stehengebliebenen 59 % bekaeme dann
      // eine 59-Prozent-Fuellung und saehe aus wie ein Dimmer, den es nicht gibt.
      // Die Fuellung folgt hier also der Faehigkeit, nicht dem Zahlenwert.
      if(!dim) lvl = on ? 100 : 0;
      var kern=(11+15*lvl/100).toFixed(0), glow=(7+18*lvl/100).toFixed(0), opa=(0.6+0.4*lvl/100).toFixed(2);
      var wert=(dim&&lvl>0&&lvl<100)?(lvl+' %'):(on?'ein':'aus');
      var blende=on
        ? '<span class="lbcore" style="width:'+kern+'px;height:'+kern+'px;opacity:'+opa+';box-shadow:0 0 '+glow+'px var(--licht-glow)"></span>'
        : '<span class="lbdot"></span>';
      // Das Zeichen sagt "an dieser Leuchte haengt ein Melder" - es verschwindet also
      // NICHT, wenn gerade Ruhe ist. Ob der Melder in diesem Moment anspricht, sagt die
      // FORM und die Farbe: in Ruhe nur das Maennchen und gedaempft, bei Bewegung kommen
      // die Funkboegen dazu und es wird warm. Der Zustand muss durchgereicht werden -
      // fest 100 hiess: die Boegen standen immer da, und nur die Farbe unterschied noch,
      // was auf einem Wandpanel kaum auffiel.
      var melder=l.motion?('<span class="lbmd'+(l.motionOn?' on':'')+'" title="'+(l.motionOn?'Bewegung erkannt':'Bewegungsmelder, gerade ruhig')+'">'+((typeof iconSVG==='function')?iconSVG('motion',l.motionOn?100:0):'')+'</span>'):'';
      var fuell='';
      if(on){
        fuell='<span class="lbfill" style="width:'+lvl+'%"></span>';
        if(dim&&lvl<100) fuell+='<span class="lbgrip" style="left:calc('+lvl+'% - 1.5px)"></span>';
      }
      var hst=(zh>0)?('height:'+zh+'px'):'height:100%';
      return '<div class="lbbar'+(on?' on':'')+(dim?' dim':'')+(reach?'':' off-line')+'" data-lb="'+l.id+'" style="'+hst+'">'
        +'<span class="lbap">'+blende+melder+'</span>'
        +'<span class="lbtxt"><span class="lbtop">'
        +'<span class="lbnm">'+escL(lbName(l))+'</span><span class="lbval">'+wert+'</span></span>'
        +'<span class="lbtrk'+(dim?'':' lbsw')+'" data-lbtrk="'+l.id+'">'+fuell+'</span>'
        +'</span></div>';
    }
    function lbRoom(k,zh){
      var an=k.items.filter(function(l){return l.on;}).length;
      var key=encodeURIComponent((k.floor||'')+'|'+(k.items[0]&&k.items[0].room||''));
      return '<div class="lbroom'+(an?' on':'')+'">'
        +'<div class="lbrh"><span class="nm">'+escL(k.titel)+'</span>'
        +(an?'<span class="dot"></span>':'')
        +'<span class="ct'+(an?' on':'')+'">'+an+'/'+k.items.length+'</span>'
        +'<button data-lboff="'+key+'" title="Raum aus">'+((typeof iconSVG==='function')?iconSVG('power',0):'\u23FB')+'</button>'
        +'</div>'+k.items.map(function(l){return lbBar(l,zh);}).join('')+'</div>';
    }
    function lbCol(karten,zh){
      var alle=[],an=0;
      karten.forEach(function(k){k.items.forEach(function(l){alle.push(l);if(l.on)an++;});});
      var flo=[]; karten.forEach(function(k){if(flo.indexOf(k.floor)<0)flo.push(k.floor);});
      var ids=alle.map(function(l){return l.id;}).join(',');
      return '<div class="lbcol"><div class="lbch">'
        +'<b>'+escL(flo.join(' + '))+'</b>'
        +'<i class="'+(an?'on':'')+'">'+an+' / '+alle.length+' an</i><s></s>'
        +'<button data-lbcoloff="'+ids+'" title="Spalte aus">'+((typeof iconSVG==='function')?iconSVG('power',0):'\u23FB')+'</button>'
        +'</div><div class="lbrooms">'+karten.map(function(k){return lbRoom(k,zh);}).join('')+'</div></div>';
    }
    function lbLegende(){
      return '<div class="lbleg">'
        +'<span><span class="lbcore" style="width:11px;height:11px;box-shadow:0 0 6px var(--licht-glow)"></span>Leuchte an</span>'
        +'<span><span style="width:16px;height:10px;border-radius:4px;background:var(--licht-bg);border:1px solid var(--licht-bd)"></span>brennt im Raum</span>'
        +'<span><span class="lbtrk lbsw" style="width:16px;display:inline-block"></span>nicht dimmbar</span>'
        +'<span><span class="lbmd" style="position:static">'+((typeof iconSVG==='function')?iconSVG('motion',0):'')+'</span>Melder beteiligt'
        +'<span class="lbmd on" style="position:static;margin:0 4px 0 9px">'+((typeof iconSVG==='function')?iconSVG('motion',100):'')+'</span>Bewegung</span>'
        +'</div>';
    }
    function lbRender(w,lamps){
      var zh=parseInt(w.lgZeile)||40, sp=parseInt(w.lgCols)||4;
      var karten=lbKarten(lamps);
      var teile=lbTeile(karten,sp,zh);
      var h='<div class="lbwrap">';
      if(w.lgPille){
        var an=lamps.filter(function(l){return l.on;}).length;
        var watt=lamps.reduce(function(a,l){return a+((l.on&&l.watt>0)?l.watt:0);},0);
        // Wattzahl nur zeigen, wenn wirklich gemessen wird - nicht schaetzen (Spec §5).
        var txt=an+' von '+lamps.length+' an'+(watt>0?(' · '+Math.round(watt)+' W'):'');
        h+='<div class="lbkopf"><s></s><span class="lbpille"><u></u><b>'+esc(txt)+'</b></span></div>';
      }
      h+='<div class="lbcols">'
        +teile.map(function(t){return lbCol(t,zh);}).join('')+'</div>';
      if(w.lgLegende!==false) h+=lbLegende();
      h+='</div>';
      return h;
    }

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
      if(w._kind!=='room' && w.lgMode==='bank') return lbRender(w,lamps);
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
    // Bedienung der Leuchtbank: Tippen schaltet, Ziehen auf der Bahn setzt absolut.
    // onChange waehrend der Bewegung hoechstens alle 120 ms (Buslast), beim Loslassen
    // einmal endgueltig. Unter 3 % bedeutet aus. Der zuletzt gestellte Wert wird je
    // Leuchte gemerkt, damit Tippen aus dem Aus-Zustand dorthin zurueckkehrt.
    var _lbLast={};
    function lbWire(w,host){
      host.querySelectorAll('[data-lbtrk]').forEach(function(tr){
        var id=parseInt(tr.getAttribute('data-lbtrk'));
        var l=(_lxData||[]).find(function(x){return x.id===id;});
        if(!l||!lbDimBar(l))return;
        var bar=tr.closest('.lbbar'), zieht=false, letzt=0, roh=0;
        function wert(ev){
          var r=tr.getBoundingClientRect(); if(r.width<=0)return 0;
          var x=(ev.touches?ev.touches[0].clientX:ev.clientX)-r.left;
          return Math.max(0,Math.min(100,Math.round(x/r.width*100)));
        }
        function malen(v){
          var f=tr.querySelector('.lbfill'), g=tr.querySelector('.lbgrip');
          if(!f){f=document.createElement('span');f.className='lbfill';tr.appendChild(f);}
          f.style.width=v+'%';
          if(v<100){ if(!g){g=document.createElement('span');g.className='lbgrip';tr.appendChild(g);} g.style.left='calc('+v+'% - 1.5px)'; }
          else if(g){g.remove();}
          var val=bar&&bar.querySelector('.lbval'); if(val)val.textContent=(v>0&&v<100)?(v+' %'):(v>0?'ein':'aus');
          if(bar)bar.classList.toggle('on',v>0);
        }
        tr.addEventListener('pointerdown',function(ev){
          zieht=true; roh=wert(ev); if(bar)bar.classList.add('drag');
          try{tr.setPointerCapture(ev.pointerId);}catch(e){}
          malen(roh); ev.preventDefault(); ev.stopPropagation();
        });
        tr.addEventListener('pointermove',function(ev){
          if(!zieht)return; roh=wert(ev); malen(roh);
          var t=Date.now(); if(t-letzt>=120){letzt=t;lxDim(l,roh);}
          ev.preventDefault();
        });
        function ende(ev){
          if(!zieht)return; zieht=false; if(bar)bar.classList.remove('drag');
          var v=roh<3?0:roh;
          if(v>0)_lbLast[id]=v;
          if(v===0){ if(l.on)lxToggle(l); } else { lxDim(l,v); }
          lxSchedule(w); if(ev)ev.stopPropagation();
        }
        tr.addEventListener('pointerup',ende);
        tr.addEventListener('pointercancel',ende);
      });
      host.querySelectorAll('[data-lb]').forEach(function(bar){
        bar.addEventListener('click',function(ev){
          if(ev.target.closest('[data-lbtrk]'))return;
          var id=parseInt(bar.getAttribute('data-lb'));
          var l=(_lxData||[]).find(function(x){return x.id===id;});
          if(!l)return;
          if(l.on){ lxToggle(l); }
          else if(lbDimBar(l)){ var z=Math.max(10,_lbLast[id]||100); lxDim(l,z); }
          else { lxToggle(l); }
          lxSchedule(w);
        });
      });
      host.querySelectorAll('[data-lbcoloff]').forEach(function(b){
        b.addEventListener('click',function(ev){
          ev.stopPropagation();
          var ids=(b.getAttribute('data-lbcoloff')||'').split(',').map(function(x){return parseInt(x);});
          var lamps=(_lxData||[]).filter(function(l){return ids.indexOf(l.id)>=0;});
          lxMaster(lamps,false); lbCardSchedule(w);
        });
      });
      host.querySelectorAll('[data-lboff]').forEach(function(b){
        b.addEventListener('click',function(ev){
          ev.stopPropagation();
          var k=decodeURIComponent(b.getAttribute('data-lboff')).split('|');
          var lamps=(_lxData||[]).filter(function(l){return (l.floor||'')===k[0]&&(l.room||'')===k[1];});
          lxMaster(lamps,false); lxSchedule(w);
        });
      });
      host.querySelectorAll('[data-lbcoloff]').forEach(function(b){
        b.addEventListener('click',function(ev){
          ev.stopPropagation();
          var ids=(b.getAttribute('data-lbcoloff')||'').split(',').map(function(x){return parseInt(x);});
          var lamps=(_lxData||[]).filter(function(l){return ids.indexOf(l.id)>=0;});
          lxMaster(lamps,false); lxSchedule(w);
        });
      });
    }
    function lxWire(w,host){
      if(w._kind!=='room' && w.lgMode==='bank'){ lbWire(w,host); return; }
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
          if(l.vars.Brightness===id){var n=parseFloat(String(v).replace(',','.'));if(!isNaN(n)){l.level=Math.round(n);
            // Ein Dimmer behaelt seine letzte Helligkeit, waehrend der Schalter aus ist
            // (Kueche OG: Power=0, Brightness=59). Ueber AN/AUS entscheidet deshalb
            // ausschliesslich die Power-Variable; die Helligkeit nur dann, wenn es
            // gar keinen Schalter gibt.
            // Istzustand heisst: brennt die Leuchte wirklich? Ohne Schalter entscheidet
            // die Helligkeit. MIT Schalter entscheidet er - ausser die Helligkeit faellt
            // auf 0, dann ist es trotz eingeschaltetem Schalter dunkel.
            if(!l.vars.Power) l.on=(l.level>0); else if(l.level===0) l.on=false;}}
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
            h+='<div class="pgh">Darstellung</div>';
            h+=row('Modus','<select id="lgMode"><option value="karten"'+(w.lgMode!=='bank'?' selected':'')+'>Karten (Regler)</option><option value="bank"'+(w.lgMode==='bank'?' selected':'')+'>Leuchtbank (Zeilen)</option></select>');
            if(w.lgMode==='bank'){
              h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Eine Zeile je Leuchte: Blende, Name, Ziehbahn, Wert. Die Spalten werden hoehenausgeglichen gefuellt, die Geschossreihenfolge bleibt erhalten.</div>';
              h+=row('Spalten','<input id="lgCols" type="number" min="1" max="8" style="width:70px" value="'+(parseInt(w.lgCols)||4)+'">');
              h+=row('Zeilenhoehe','<input id="lgZeile" type="number" min="28" max="56" style="width:70px" value="'+(parseInt(w.lgZeile)||40)+'"> <span style="font-size:11px;color:var(--muted)">px</span>');
              h+=row('Legende','<input type="checkbox" id="lgLeg"'+(w.lgLegende!==false?' checked':'')+'>');
              h+=row('Statuspille','<input type="checkbox" id="lgPil"'+(w.lgPille?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">„6 von 27 an · 214 W" oben rechts</span>');
            }
          }
          return h;
        },
        wire:function(w){
          if($('#lxBind'))$('#lxBind').onchange=function(){w.bind=this.value;commit();renderProps();lxPaint(w);};
          if($('#lxSess'))$('#lxSess').onchange=function(){w.session=this.value||undefined;commit();lxPaint(w);};
          if($('#lxRoom'))$('#lxRoom').onchange=function(){w.roomId=parseInt(this.value)||undefined;commit();lxPaint(w);};
          if($('#lgMode'))$('#lgMode').onchange=function(){w.lgMode=(this.value==='bank')?'bank':undefined;commit();renderProps();lxPaint(w);};
          if($('#lgCols'))$('#lgCols').onchange=function(){w.lgCols=parseInt(this.value)||undefined;commit();lxPaint(w);};
          if($('#lgZeile'))$('#lgZeile').onchange=function(){w.lgZeile=parseInt(this.value)||undefined;commit();lxPaint(w);};
          if($('#lgLeg'))$('#lgLeg').onchange=function(){w.lgLegende=this.checked?undefined:false;commit();lxPaint(w);};
          if($('#lgPil'))$('#lgPil').onchange=function(){w.lgPille=this.checked?true:undefined;commit();lxPaint(w);};
        }
      });
    }
    // ---- Widget: eine einzelne Leuchte -------------------------------------
    //  Die Spezifikation nennt die LightBar den kleinsten Baustein - also ist sie
    //  ein Widget und kein Innenleben. So laesst sich eine Lichtseite wie jede
    //  andere Seite bauen: Raumkarten als Container, darin je Leuchte ein Widget.
    function lbFind(w){
      var id=parseInt(w.lampId)||0;
      if(!id) return null;
      return (_lxData||[]).find(function(x){return x.id===id;})||null;
    }
    defWidget('lightbar',{
      label:'Leuchte (Zeile)', cat:'HomeSuite · Licht', paletteIcon:'bulb', size:[280,40], noHover:true,
      render:function(w){
        if(_lxErr) return '<div class="lbone"><span class="lb-msg">Licht nicht erreichbar</span></div>';
        if(!_lxData) return '<div class="lbone"><span class="lb-msg">Licht lädt …</span></div>';
        var l=lbFind(w);
        if(!l) return '<div class="lbone"><span class="lb-msg">'+(w.lampId?'Leuchte nicht gefunden':'Keine Leuchte gewählt')+'</span></div>';
        if(w.lampName){ l=Object.assign({},l,{name:w.lampName}); }
        var mvid=lbMelderVid(w,l);
        if(mvid){
          var mv=(typeof _lastVals!=='undefined')?_lastVals[mvid]:null;
          var akt=!!(mv&&(mv.v===true||mv.v===1||mv.v==='1'||String(mv.v).toLowerCase()==='true'));
          l=Object.assign({},l,{motion:true,motionOn:akt});
        }
        return '<div class="lbone">'+lbBar(l,0)+'</div>';
      },
      mount:function(w){
        var el=lxEl(w); if(!el)return;
        lxLoad(function(){ lbOneItems(w); lbOnePaint(w); });
        LVB.panel.startPoll('lightbar:'+w.id,60000,function(){lxLoad(function(){lbOneItems(w);lbOnePaint(w);});});
      },
      live:function(w,el,id,d){
        var l=lbFind(w); if(!l)return;
        var v=d&&d.v;
        if(id===lbMelderVid(w,l)){ lbOneSchedule(w); return; }
        if(!l.vars)return;
        if(l.vars.Power===id){l.on=(v===true||v===1||v==='1'||String(v).toLowerCase()==='true');}
        else if(l.vars.Brightness===id){var nn=parseFloat(String(v).replace(',','.'));if(!isNaN(nn)){l.level=Math.round(nn);
          if(!l.vars.Power) l.on=(l.level>0); else if(l.level===0) l.on=false;}}
        else if(l.vars.ColorTemp===id){var c=parseInt(v);if(!isNaN(c))l.cct=c;}
        else return;
        lbOneSchedule(w);
      },
      _bind:function(w){lbOneItems(w);lbOnePaint(w);},
      props:function(w){
        var h='';
        var opts='<option value="">– wählen –</option>';
        (_lxData||[]).slice().sort(function(a,b){
          var f=(a.floor||'').localeCompare(b.floor||''); if(f)return f;
          var r=(a.room||'').localeCompare(b.room||''); if(r)return r;
          return (a.name||'').localeCompare(b.name||'');
        }).forEach(function(l){
          var t=(l.floor||'')+' · '+(l.room||'ohne Raum')+' · '+(l.name||'');
          opts+='<option value="'+l.id+'"'+((parseInt(w.lampId)||0)===l.id?' selected':'')+'>'+esc(t)+'</option>';
        });
        h+=row('Leuchte','<select id="lbLamp" style="width:100%">'+opts+'</select>');
        h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Aus der HomeSuite-Lichtsteuerung. Dimmbarkeit, Erreichbarkeit und Leistung kommen vom Gerät — nichts davon wird hier eingestellt.</div>';
        h+=row('Name überschreiben','<input id="lbName" value="'+esc(w.lampName||'')+'" placeholder="leer = Gerätename ohne „(Licht)“">');
        var lRef=lbFind(w);
        var rv=parseInt(lRef&&lRef.presenceVid)||0;
        h+='<div class="pgh">Bewegungsmelder</div>';
        h+='<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Gilt normalerweise der Melder des <b>Raums</b> — er wird am Raum selbst eingestellt (HomeSuite-Baum), nicht hier. '
          +(rv?('Für diesen Raum ist <b>#'+rv+'</b> hinterlegt.'):'Für diesen Raum ist derzeit <b>keiner</b> hinterlegt.')
          +'</div>';
        h+=row('Ausnahme','<input id="lbMot" type="number" style="width:96px" value="'+(w.motionVid||'')+'" placeholder="leer = Raum"> <span style="font-size:11px;color:var(--muted)">eigene Var-ID, oder −1 zum Ausblenden</span>');
        return h;
      },
      wire:function(w){
        if($('#lbLamp'))$('#lbLamp').onchange=function(){w.lampId=parseInt(this.value)||undefined;commit();lbOneItems(w);lbOnePaint(w);};
        if($('#lbName'))$('#lbName').oninput=function(){w.lampName=this.value||undefined;lbOnePaint(w);};
        if($('#lbName'))$('#lbName').onchange=function(){commit();};
        if($('#lbMot'))$('#lbMot').onchange=function(){w.motionVid=parseInt(this.value)||undefined;commit();lbOneItems(w);lbOnePaint(w);};
      }
    });
    function lbOneItems(w){
      var it=[], l=lbFind(w);
      if(l&&l.vars){ if(l.vars.Power)it.push({vid:l.vars.Power}); if(l.vars.Brightness)it.push({vid:l.vars.Brightness}); if(l.vars.ColorTemp)it.push({vid:l.vars.ColorTemp}); }
      var mv=lbMelderVid(w,l); if(mv)it.push({vid:mv});
      w.items=it;
      if(typeof invalidateVidx==='function')invalidateVidx();
    }
    function lbOnePaint(w){
      var el=lxEl(w); if(!el)return;
      var host=el.querySelector('.winner')||el;
      host.innerHTML=WIDGETS['lightbar'].render(w);
      lbWire(w,host);
    }
    var _lbOneRp={};
    function lbOneSchedule(w){ if(_lbOneRp[w.id])return; _lbOneRp[w.id]=setTimeout(function(){_lbOneRp[w.id]=null;lbOnePaint(w);},60); }

    // ---- Widget: Raumkarte --------------------------------------------------
    function lbRoomLamps(w){
      // Spaltenmodus: mehrere Raeume, gespeichert als "Geschoss|Raum"-Liste.
      if(w.cardMode==='spalte'){
        var keys=String(w.colRooms||'').split(';').filter(Boolean);
        if(!keys.length) return [];
        return (_lxData||[]).filter(function(l){
          return keys.indexOf(String(l.floor||'')+'|'+String(l.room||''))>=0;
        });
      }
      var fl=String(w.cardFloor||''), rm=String(w.cardRoom||'');
      if(!fl&&!rm) return [];
      return (_lxData||[]).filter(function(l){
        return (String(l.floor||'')===fl) && (String(l.room||'')===rm);
      });
    }
    defWidget('lightroomcard',{
      label:'Raumkarte (Licht)', cat:'HomeSuite · Licht', paletteIcon:'bulb', size:[280,121], noHover:true,
      render:function(w){
        if(!_lxData) return '<div class="lbcard"><span class="lb-msg">Licht lädt …</span></div>';
        var lamps=lbRoomLamps(w);
        if(w.cardMode==='pille'){
          var anP=(_lxData||[]).filter(function(l){return l.on;}).length;
          var wattP=(_lxData||[]).reduce(function(a,l){return a+((l.on&&l.watt>0)?l.watt:0);},0);
          // Wattzahl nur bei echter Messung - schaetzen waere geraten (Spec §5).
          var txtP=anP+' von '+((_lxData||[]).length)+' an'+(wattP>0?(' · '+Math.round(wattP)+' W'):'');
          return '<div class="lbone" style="align-items:center;justify-content:flex-end">'
            +'<span class="lbpille"><u></u><b>'+esc(txtP)+'</b></span></div>';
        }
        if(w.cardMode==='legende'){
          return '<div class="lbone" style="align-items:center">'+lbLegende()+'</div>';
        }
        if(w.cardMode==='spalte'){
          var anC=lamps.filter(function(l){return l.on;}).length;
          var flo=[]; lamps.forEach(function(l){var f=String(l.floor||'');if(flo.indexOf(f)<0)flo.push(f);});
          flo.sort(function(a,b){return floorRank(a)-floorRank(b);});
          var lbl=w.cardTitle||flo.join(' + ');
          var ids=lamps.map(function(l){return l.id;}).join(',');
          return '<div class="lbone" style="align-items:center"><div class="lbch" style="flex:1;min-width:0">'
            +'<b>'+escL(lbl)+'</b>'
            +'<i class="'+(anC?'on':'')+'">'+anC+' / '+lamps.length+' an</i><s></s>'
            +'<button data-lbcoloff="'+ids+'" title="Spalte aus">'+((typeof iconSVG==='function')?iconSVG('power',0):'')+'</button>'
            +'</div></div>';
        }
        var an=lamps.filter(function(l){return l.on;}).length;
        var titel=w.cardTitle||w.cardRoom||'Raum';
        var key=encodeURIComponent(String(w.cardFloor||'')+'|'+String(w.cardRoom||''));
        // Der Zaehler wird IMMER gerechnet, nie gesetzt - eine feste Zahl im Kopf
        // wird falsch, sobald eine Leuchte dazukommt oder die Karte umzieht.
        return '<div class="lbcard'+(an?' on':'')+'">'
          +'<div class="lbrh"><span class="nm">'+escL(titel)+'</span>'
          +(an?'<span class="dot"></span>':'')
          +(lamps.length?('<span class="ct'+(an?' on':'')+'">'+an+'/'+lamps.length+'</span>'):'')
          +'<button data-lboff="'+key+'" title="Raum aus">'+((typeof iconSVG==='function')?iconSVG('power',0):'')+'</button>'
          +'</div></div>';
      },
      mount:function(w){
        var el=lxEl(w); if(!el)return;
        lxLoad(function(){ lbCardItems(w); lbCardPaint(w); });
        LVB.panel.startPoll('lightcard:'+w.id,60000,function(){lxLoad(function(){lbCardItems(w);lbCardPaint(w);});});
      },
      live:function(w,el,id,d){
        var lamps=(w.cardMode==='pille')?(_lxData||[]):lbRoomLamps(w), tr=null;
        for(var i=0;i<lamps.length;i++){var l=lamps[i];
          if(l.vars&&(l.vars.Power===id||l.vars.Brightness===id)){tr=l;break;}}
        if(!tr)return;
        var v=d&&d.v;
        if(tr.vars.Power===id){tr.on=(v===true||v===1||v==='1'||String(v).toLowerCase()==='true');}
        else {var nn=parseFloat(String(v).replace(',','.'));if(!isNaN(nn)){tr.level=Math.round(nn);
          if(!tr.vars.Power) tr.on=(tr.level>0); else if(tr.level===0) tr.on=false;}}
        lbCardSchedule(w);
      },
      _bind:function(w){lbCardItems(w);lbCardPaint(w);},
      props:function(w){
        var paare={}, ord=[];
        (_lxData||[]).forEach(function(l){
          var k=String(l.floor||'')+'|'+String(l.room||'');
          if(!paare[k]){paare[k]={floor:l.floor||'',room:l.room||'',n:0};ord.push(k);}
          paare[k].n++;
        });
        ord.sort(function(a,b){var A=paare[a],B=paare[b];var f=floorRank(A.floor)-floorRank(B.floor);
          return f?f:(A.room||'').localeCompare(B.room||'');});
        if(w.cardMode==='pille'||w.cardMode==='legende'){
          return row('Modus','<select id="lbcMode"><option value="raum">Raumkarte</option><option value="spalte">Spaltenkopf</option>'
            +'<option value="pille"'+(w.cardMode==='pille'?' selected':'')+'>Statuspille</option>'
            +'<option value="legende"'+(w.cardMode==='legende'?' selected':'')+'>Legende</option></select>')
            +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">'
            +(w.cardMode==='pille'?'Zählt alle Leuchten der Anlage; die Wattzahl erscheint nur, wenn gemessen wird.':'Erklärt Blende, warmes Bett, gestrichelte Bahn und Melderzeichen.')
            +'</div>';
        }
        if(w.cardMode==='spalte'){
          var sel=String(w.colRooms||'').split(';').filter(Boolean);
          var box='<div style="max-height:190px;overflow:auto;border:1px solid var(--line);border-radius:7px;padding:5px">';
          ord.forEach(function(k){var p=paare[k];
            box+='<label style="display:flex;align-items:center;gap:6px;font-size:11.5px;padding:2px 1px">'
              +'<input type="checkbox" class="lbcR" value="'+esc(k)+'"'+(sel.indexOf(k)>=0?' checked':'')+'>'
              +esc(p.floor+' · '+(p.room||'ohne Raum'))+'</label>';});
          box+='</div>';
          return row('Modus','<select id="lbcMode"><option value="raum">Raumkarte</option><option value="spalte" selected>Spaltenkopf</option><option value="pille">Statuspille</option><option value="legende">Legende</option></select>')
            +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Der Kopf nennt die enthaltenen Geschosse, zählt die brennenden Leuchten und schaltet die ganze Spalte aus.</div>'
            +row('Räume der Spalte',box)
            +row('Bezeichnung überschreiben','<input id="lbcTitle" value="'+esc(w.cardTitle||'')+'" placeholder="leer = Geschosse">');
        }
        var cur=String(w.cardFloor||'')+'|'+String(w.cardRoom||'');
        var opts='<option value="">– wählen –</option>';
        ord.forEach(function(k){var p=paare[k];
          opts+='<option value="'+esc(k)+'"'+(k===cur?' selected':'')+'>'+esc(p.floor+' · '+(p.room||'ohne Raum')+' ('+p.n+')')+'</option>';});
        return row('Modus','<select id="lbcMode"><option value="raum" selected>Raumkarte</option><option value="spalte">Spaltenkopf</option><option value="pille"'+(w.cardMode==='pille'?' selected':'')+'>Statuspille</option><option value="legende"'+(w.cardMode==='legende'?' selected':'')+'>Legende</option></select>')
          +row('Raum','<select id="lbcRoom" style="width:100%">'+opts+'</select>')
          +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Zähler und Punkt werden aus den Leuchten dieses Raums gerechnet. Die Aus-Taste schaltet alle davon aus.</div>'
          +row('Titel überschreiben','<input id="lbcTitle" value="'+esc(w.cardTitle||'')+'" placeholder="leer = Raumname">');
      },
      wire:function(w){
        if($('#lbcRoom'))$('#lbcRoom').onchange=function(){
          var p=String(this.value||'').split('|');
          w.cardFloor=p[0]||undefined; w.cardRoom=p[1]||undefined;
          commit(); lbCardItems(w); lbCardPaint(w);
        };
        if($('#lbcMode'))$('#lbcMode').onchange=function(){w.cardMode=(this.value==='raum')?undefined:this.value;commit();renderProps();lbCardItems(w);lbCardPaint(w);};
        var rb=document.querySelectorAll('.lbcR');
        if(rb&&rb.length)rb.forEach(function(c){c.onchange=function(){
          var l=[];document.querySelectorAll('.lbcR').forEach(function(x){if(x.checked)l.push(x.value);});
          w.colRooms=l.join(';')||undefined;commit();lbCardItems(w);lbCardPaint(w);};});
        if($('#lbcTitle'))$('#lbcTitle').oninput=function(){w.cardTitle=this.value||undefined;lbCardPaint(w);};
        if($('#lbcTitle'))$('#lbcTitle').onchange=function(){commit();};
      }
    });
    function lbCardItems(w){
      var it=[];
      if(w.cardMode==='legende'){ w.items=[]; if(typeof invalidateVidx==='function')invalidateVidx(); return; }
      var quelle=(w.cardMode==='pille')?(_lxData||[]):lbRoomLamps(w);
      quelle.forEach(function(l){ if(l.vars){ if(l.vars.Power)it.push({vid:l.vars.Power}); if(l.vars.Brightness)it.push({vid:l.vars.Brightness}); } });
      w.items=it;
      if(typeof invalidateVidx==='function')invalidateVidx();
    }
    function lbCardPaint(w){
      var el=lxEl(w); if(!el)return;
      var host=el.querySelector('.winner')||el;
      host.innerHTML=WIDGETS['lightroomcard'].render(w);
      // Aus-Taste verdrahten (dieselbe Logik wie in der Leuchtbank)
      host.querySelectorAll('[data-lboff]').forEach(function(b){
        b.addEventListener('click',function(ev){
          ev.stopPropagation();
          var k=decodeURIComponent(b.getAttribute('data-lboff')).split('|');
          var lamps=(_lxData||[]).filter(function(l){return (String(l.floor||'')===k[0])&&(String(l.room||'')===k[1]);});
          lxMaster(lamps,false); lbCardSchedule(w);
        });
      });
    }
    var _lbCardRp={};
    function lbCardSchedule(w){ if(_lbCardRp[w.id])return; _lbCardRp[w.id]=setTimeout(function(){_lbCardRp[w.id]=null;lbCardPaint(w);},60); }

    lxDef('lightgrid','Licht-Übersicht',[720,520]);
    lxDef('lightroom','Licht-Raum',[360,320]);
  })();
