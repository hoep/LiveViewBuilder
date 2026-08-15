  // ===== Widget: Raum-Navigation (roomnav) =====
  //
  //  Universelle Navigation aus dem HomeSuite-RoomManager: holt die Topologie
  //  (Haus > Bereich/Ebene > Raum) ueber ?api=mod&op=topology. Im Editor waehlt
  //  man ein Geschoss (Bereich) und selektiert/deselektiert Raeume; daraus
  //  generiert sich die Tab-/Navi-Struktur. Ein Klick auf einen Raum navigiert
  //  (navGo) zur zugeordneten Seite (Default: Seite gleichen Namens).
  //
  //  LESBARKEIT/SKIN (Vorgabe): der aktive Tab ist standardmaessig ein Accent-
  //  INDIKATOR (Unterstrich) mit Text in --text — nie Schrift direkt auf
  //  gesaettigtem Accent (kein Schwarz-auf-Gruen). Optional "gefuellt", dann
  //  Textfarbe kontrastsicher via _contrastText(). Alles ueber Skin-Variablen.

  (function(){
    // ---- Demo-Topologie (nur Doku; nie Netz) ----
    function rnDemo(){
      function room(n){return {kind:'Raum',name:n,abbr:'',entities:[{domain:'heating',name:n}],children:[]};}
      return {ok:true,tree:[{kind:'Haus',name:'Wohnhaus',abbr:'WH',entities:[],children:[
        {kind:'Bereich',name:'Erdgeschoss',abbr:'EG',entities:[],children:[room('Wohnzimmer'),room('Kueche'),room('Bad')]},
        {kind:'Bereich',name:'Obergeschoss',abbr:'OG',entities:[],children:[room('Schlafzimmer'),room('Kinderzimmer')]}
      ]}]};
    }
    var _rn={};                                  // w.id -> {topo,err}
    function rnSt(w){return _rn[w.id]||(_rn[w.id]={topo:null,err:''});}

    // ---- Topologie -> flache Bereichs-/Raumlisten ----
    function rnAreas(topo){                       // alle Bereiche (+ ihre Raeume)
      var out=[];
      (topo&&topo.tree||[]).forEach(function(haus){
        (haus.children||[]).forEach(function(area){
          if(area.kind==='Bereich'){ out.push({iid:area.iid,name:area.name,abbr:area.abbr,haus:haus.name,rooms:(area.children||[]).filter(function(c){return c.kind==='Raum';})}); }
        });
        // Raeume direkt unterm Haus (ohne Bereich) als Pseudo-Bereich
        var direct=(haus.children||[]).filter(function(c){return c.kind==='Raum';});
        if(direct.length) out.push({iid:haus.iid,name:haus.name,abbr:haus.abbr,haus:haus.name,rooms:direct});
      });
      return out;
    }
    function rnRoomsOf(topo,areaId){
      var a=rnAreas(topo);
      if(!areaId||areaId==='*'){ var all=[]; a.forEach(function(x){all=all.concat(x.rooms);}); return all; }
      var f=a.filter(function(x){return String(x.iid)===String(areaId);})[0];
      return f?f.rooms:[];
    }
    // sichtbare Raeume = Auswahl (w.pick) oder alle des Bereichs
    function rnVisible(w,topo){
      var rooms=rnRoomsOf(topo,w.area);
      if(w.pick&&w.pick.length){ var s={}; w.pick.forEach(function(id){s[String(id)]=1;}); rooms=rooms.filter(function(r){return s[String(r.iid)];}); }
      return rooms;
    }
    // Ziel-Seite eines Raums: explizite Zuordnung, sonst gleichnamige View
    function rnView(w,room){
      var m=(w.viewMap||{})[String(room.iid)];
      if(m) return m;
      if(typeof store!=='undefined'&&store.views&&store.views[room.name]) return room.name;
      return '';
    }

    // ---- Rendering (lesbar + skinbar) ----
    function rnRender(w){
      var st=rnSt(w);
      var topo=(typeof DOKU!=='undefined'&&DOKU)?rnDemo():st.topo;
      if(!topo) return LVB.panel.stateBox('loading','Navigation laedt …');
      if(topo.ok===false) return LVB.panel.stateBox('error','Topologie nicht erreichbar');
      var rooms=rnVisible(w,topo);
      var vert=(w.orient==='vert');
      var mode=(w.tabStyle==='fill')?'fill':'ind';
      var cur=(typeof store!=='undefined'&&store.current)||'';
      var h='<div class="rnav '+(vert?'vert':'horz')+' '+mode+'"'+(w.accent?(' style="--accent:'+esc(_skinColor(w.accent)||w.accent)+';--rnav-onaccent:'+esc(rnOnAccent(w))+'"'):(' style="--rnav-onaccent:'+esc(rnOnAccent(w))+'"'))+'>';
      if(!rooms.length){ h+='<div class="rnav-empty">Keine Raeume gewaehlt.</div>'; return h+'</div>'; }
      rooms.forEach(function(r){
        var view=rnView(w,r);
        var on=(view&&view===cur);
        var label=(w.showAbbr&&r.abbr)?r.abbr:r.name;
        h+='<button type="button" class="rnav-tab'+(on?' on':'')+(view?'':' rnav-dead')+'" data-view="'+esc(view)+'" title="'+esc(r.name)+'">'
          +(w.icons!==false?'<span class="rnav-ic">'+iconSVG(w.icon||'home')+'</span>':'')
          +'<span class="rnav-tx">'+escL(label)+'</span></button>';
      });
      return h+'</div>';
    }
    // kontrastsichere Textfarbe fuer den "gefuellten" Aktiv-Tab
    function rnOnAccent(w){
      var acc=(w.accent?(_skinColor(w.accent)||w.accent):null);
      if(!acc||acc.indexOf('var(')===0){ acc=(typeof cssv==='function')?cssv('--accent'):'#00cdab'; }
      return (typeof _contrastText==='function')?_contrastText(acc):'#ffffff';
    }

    function rnEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function rnRepaint(w){var el=rnEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=rnRender(w);rnBind(w,el);}
    function rnBind(w,el){
      if(typeof DOKU!=='undefined'&&DOKU) return;                 // Doku: keine Navigation
      $$('.rnav-tab',el).forEach(function(b){
        b.onclick=function(ev){ ev.stopPropagation(); var v=b.getAttribute('data-view');
          if(!v){ if(typeof toast==='function')toast('Keine Seite zugeordnet'); return; }
          if(typeof navGo==='function'&&store.views[v]) navGo(v); };
      });
    }

    defWidget('roomnav',{
      label:'Raum-Navigation', cat:'Leisten (alle Seiten)', paletteIcon:'home', size:[720,56],
      defaults:function(w){w.orient='horz';w.tabStyle='ind';w.showAbbr=false;w.icons=true;},
      render:function(w){return rnRender(w);},
      props:function(w){return rnProps(w);},
      wire:function(w){rnPropsWire(w);},
      mount:function(w){
        var el=rnEl(w); if(!el)return;
        if(typeof DOKU!=='undefined'&&DOKU){ rnBind(w,el); return; }
        var st=rnSt(w);
        function load(){ LVB.panel.fetch('?api=mod&op=topology',6000,false,function(err,data){ st.topo=err?{ok:false}:data; rnRepaint(w); }); }
        load();
        LVB.panel.startPoll('roomnav:'+w.id,15000,load);          // Struktur aendert sich selten
        rnBind(w,el);
      }
    });

    // ---- Props: Geschoss waehlen, Raeume selektieren, Stil ----
    function rnProps(w){
      var st=rnSt(w);
      var topo=(typeof DOKU!=='undefined'&&DOKU)?rnDemo():st.topo;
      var h='<div class="pgh">Struktur (RoomManager)</div>';
      if(!topo){ LVB.panel.fetch('?api=mod&op=topology',6000,false,function(err,data){ st.topo=err?{ok:false}:data; if(typeof renderProps==='function')renderProps(); });
        return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Topologie laedt … (HomeSuite Hub)</div>'; }
      if(topo.ok===false) return h+'<div style="color:var(--crit);font-size:12px;padding:4px 2px">Kein HomeSuite-Hub erreichbar.</div>';
      var areas=rnAreas(topo);
      h+=row('Geschoss/Bereich','<select id="rnArea"><option value="*"'+(!w.area||w.area==='*'?' selected':'')+'>Alle</option>'
        +areas.map(function(a){return '<option value="'+a.iid+'"'+(String(w.area)===String(a.iid)?' selected':'')+'>'+esc(a.haus+' › '+a.name)+'</option>';}).join('')+'</select>');
      // Raum-Auswahl (select/deselect)
      var rooms=rnRoomsOf(topo,w.area);
      var picked={}; (w.pick||[]).forEach(function(id){picked[String(id)]=1;});
      var allOn=!(w.pick&&w.pick.length);
      h+='<div style="font-size:11px;color:var(--muted);margin:6px 2px 4px">Raeume (an/aus) — die Reihenfolge folgt dem Baum</div>';
      h+='<div class="rn-picklist">';
      rooms.forEach(function(r){ var on=allOn||picked[String(r.iid)];
        h+='<label class="rn-pick"><input type="checkbox" data-rnpick="'+r.iid+'"'+(on?' checked':'')+'> '+esc(r.name)+(r.abbr?(' <span class="rn-ab">'+esc(r.abbr)+'</span>'):'')
          +' <select class="rn-view" data-rnview="'+r.iid+'"><option value="">Seite: (Name)</option>'
          +Object.keys((typeof store!=='undefined'&&store.views)||{}).map(function(n){return '<option'+(rnView(w,r)===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>';
      });
      if(!rooms.length)h+='<div style="color:var(--faint);font-size:12px;padding:2px">Dieser Bereich hat keine Raeume.</div>';
      h+='</div>';
      h+='<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="rn-q" data-rnall="1">Alle</button><button type="button" class="rn-q" data-rnnone="1">Keine</button></div>';
      // Darstellung
      h+='<div class="pgh">Darstellung</div>';
      h+=row('Ausrichtung','<select id="rnOrient"><option value="horz"'+(w.orient!=='vert'?' selected':'')+'>Tabs (horizontal)</option><option value="vert"'+(w.orient==='vert'?' selected':'')+'>Liste (vertikal)</option></select>');
      h+=row('Aktiv-Stil','<select id="rnStyle"><option value="ind"'+(w.tabStyle!=='fill'?' selected':'')+'>Indikator (beste Lesbarkeit)</option><option value="fill"'+(w.tabStyle==='fill'?' selected':'')+'>Gefuellt (kontrastsicher)</option></select>');
      h+=row('Beschriftung','<select id="rnAbbr"><option value="0"'+(!w.showAbbr?' selected':'')+'>Voller Name</option><option value="1"'+(w.showAbbr?' selected':'')+'>Kuerzel</option></select>');
      h+=row('Icons','<select id="rnIcons"><option value="1"'+(w.icons!==false?' selected':'')+'>an</option><option value="0"'+(w.icons===false?' selected':'')+'>aus</option></select>');
      h+=row('Akzentfarbe',skinSel(w.accent||'','id="rnAcc"'));
      return h;
    }
    function rnPropsWire(w){
      function repaint(){var el=rnEl(w);if(el)rnRepaint(w);}
      function setPickFromDom(){ var arr=[]; $$('#props [data-rnpick]').forEach(function(c){ if(c.checked)arr.push(parseInt(c.getAttribute('data-rnpick'))); });
        // "alle an" -> pick leeren (=alle)
        var total=$$('#props [data-rnpick]').length; w.pick=(arr.length===total)?undefined:arr; }
      if($('#rnArea'))$('#rnArea').onchange=function(){w.area=this.value;w.pick=undefined;renderProps();commit();repaint();};
      $$('#props [data-rnpick]').forEach(function(c){c.onchange=function(){setPickFromDom();commit();repaint();};});
      $$('#props [data-rnview]').forEach(function(s){s.onchange=function(){var id=s.getAttribute('data-rnview');w.viewMap=w.viewMap||{};if(this.value)w.viewMap[id]=this.value;else delete w.viewMap[id];commit();repaint();};});
      var qa=$('#props [data-rnall]');if(qa)qa.onclick=function(){w.pick=undefined;renderProps();commit();repaint();};
      var qn=$('#props [data-rnnone]');if(qn)qn.onclick=function(){w.pick=[];renderProps();commit();repaint();};
      if($('#rnOrient'))$('#rnOrient').onchange=function(){w.orient=this.value;commit();repaint();};
      if($('#rnStyle'))$('#rnStyle').onchange=function(){w.tabStyle=this.value;commit();repaint();};
      if($('#rnAbbr'))$('#rnAbbr').onchange=function(){w.showAbbr=this.value==='1'||undefined;commit();repaint();};
      if($('#rnIcons'))$('#rnIcons').onchange=function(){w.icons=this.value==='0'?false:undefined;commit();repaint();};
      if($('#rnAcc'))$('#rnAcc').onchange=function(){w.accent=this.value||undefined;commit();repaint();};
    }
  })();
