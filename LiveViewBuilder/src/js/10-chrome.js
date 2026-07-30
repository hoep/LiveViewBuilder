  // ===== Leisten: bar (horizontal) und sidebar (vertikal) =====
  // Global je Instanz (store.chrome), NICHT pro Seite. Sie erscheinen auf allen Seiten
  // ausser Popups - im Builder wie zur Laufzeit - und reservieren Platz: die nutzbare
  // Seitenflaeche schrumpft entsprechend.
  //
  // Regeln:
  //   bar      = immer horizontal, volle Breite, Seite oben oder unten
  //   sidebar  = immer vertikal, Seite links oder rechts
  //   bar schlaegt sidebar: die Bar laeuft durch, die Sidebar reicht nur bis an sie heran
  //   mehrere derselben Seite liegen nebeneinander (Reihenfolge = Liste)
  //
  // Leisten sind Container: ihre Kind-Widgets liegen in b.widgets mit Koordinaten
  // relativ zur Leiste.

  function chromeList(){if(!store.chrome||!store.chrome.length&&!Array.isArray(store.chrome))store.chrome=[];if(!Array.isArray(store.chrome))store.chrome=[];return store.chrome;}
  function chromeSize(b){return Math.max(8,parseInt(b.size)||56);}
  function chromeOn(){return !_isPopupView(store.current);} // in Popups nie

  /** Geometrie aller Leisten + verbleibende Inhaltsflaeche. */
  function chromeLayout(){
    var pw=(state.page&&state.page.w)||1440,ph=(state.page&&state.page.h)||900;
    var res={bars:[],content:{x:0,y:0,w:pw,h:ph}};
    if(!chromeOn())return res;
    var list=chromeList();
    function pick(k,s){return list.filter(function(b){return b.kind===k&&(b.side||'')===s;});}
    var y=0;
    pick('bar','top').forEach(function(b){var h=chromeSize(b);res.bars.push({def:b,x:0,y:y,w:pw,h:h});y+=h;});
    var topH=y,yb=ph;
    pick('bar','bottom').forEach(function(b){var h=chromeSize(b);yb-=h;res.bars.push({def:b,x:0,y:yb,w:pw,h:h});});
    var botH=ph-yb;
    var bandY=topH,bandH=Math.max(0,ph-topH-botH);   // Sidebars nur zwischen den Bars
    var x=0;
    pick('sidebar','left').forEach(function(b){var wd=chromeSize(b);res.bars.push({def:b,x:x,y:bandY,w:wd,h:bandH});x+=wd;});
    var leftW=x,xr=pw;
    pick('sidebar','right').forEach(function(b){var wd=chromeSize(b);xr-=wd;res.bars.push({def:b,x:xr,y:bandY,w:wd,h:bandH});});
    var rightW=pw-xr;
    res.content={x:leftW,y:bandY,w:Math.max(0,pw-leftW-rightW),h:bandH};
    return res;
  }

  var _chromeGeo=null; // zuletzt gezeichnete Geometrie (fuer Drop/Marquee-Umrechnung)
  function chromeContent(){return (_chromeGeo&&_chromeGeo.content)||{x:0,y:0,w:(state.page&&state.page.w)||1440,h:(state.page&&state.page.h)||900};}

  /** Leisten-Container zeichnen; liefert den Host, in den der Seiteninhalt gehoert. */
  function chromeRender(){
    $$('.chrome,.cwrap',canvas).forEach(function(e){e.remove();});
    var geo=chromeLayout();_chromeGeo=geo;
    geo.bars.forEach(function(g){
      var b=g.def,d=document.createElement('div');
      d.className='chrome ch-'+b.kind+' ch-'+(b.side||'');
      d.dataset.chrome=b.id;
      d.style.left=g.x+'px';d.style.top=g.y+'px';d.style.width=g.w+'px';d.style.height=g.h+'px';
      if(b.bg)d.style.background=b.bg;
      canvas.appendChild(d);
    });
    var host=canvas;
    if(chromeOn()&&geo.bars.length){
      var cw=document.createElement('div');cw.className='cwrap';
      cw.style.left=geo.content.x+'px';cw.style.top=geo.content.y+'px';
      cw.style.width=geo.content.w+'px';cw.style.height=geo.content.h+'px';
      canvas.appendChild(cw);host=cw;
    }
    return {host:host,content:geo.content};
  }

  /** Kind-Widgets in die Leisten zeichnen (nutzt denselben Element-Bau wie der Seiteninhalt). */
  function chromeKids(){
    if(!_chromeGeo)return;
    _chromeGeo.bars.forEach(function(g){
      var host=$('.chrome[data-chrome="'+g.def.id+'"]',canvas);if(!host)return;
      (g.def.widgets||[]).forEach(function(w){
        try{host.appendChild(_mkWidgetEl(w,{}));}catch(e){}
      });
    });
  }

  /** Alle Leisten-Kinder (fuer Init-Hooks, Live-Updates, Suche). */
  function chromeAllKids(){
    var out=[];chromeList().forEach(function(b){(b.widgets||[]).forEach(function(w){out.push(w);});});return out;
  }
  /**
   * ALLE Widgets der aktuellen Darstellung: Seiteninhalt PLUS Leisten-Inhalt.
   * Jeder zyklische Aktualisierer (Uhr, Timer, Kamera, Chart-Nachladen, HTML) MUSS diese Liste
   * benutzen und nicht state.widgets - Leisten-Kinder liegen in store.chrome und wuerden sonst
   * nie aktualisiert (die Uhr blieb deshalb dauerhaft auf "-").
   * NICHT verwenden fuer: SmartFit-Layout und reseq() - dort geht es ausschliesslich um die Seite.
   */
  function allWidgets(){
    var s=(typeof state!=='undefined'&&state&&state.widgets)?state.widgets:[];
    return s.concat(chromeAllKids());
  }
  /** Leiste, zu der ein Widget gehoert (oder null). */
  function chromeOwnerOf(id){
    var list=chromeList();
    for(var i=0;i<list.length;i++){var ws=list[i].widgets||[];
      for(var j=0;j<ws.length;j++)if(ws[j].id===id)return list[i];}
    return null;
  }

  // ---- Bearbeiten ----

  function chromeAdd(kind,side){
    var b={id:'ch'+Math.random().toString(36).slice(2,8),kind:kind,side:side,
      type:(kind==='bar'?'chromebar':'chromesidebar'),   // damit das Eigenschaften-Panel greift
      size:(kind==='bar'?56:120),name:(kind==='bar'?'Leiste':'Seitenleiste'),widgets:[]};
    chromeList().push(b);render();chromeUI();select(b.id);commit();return b;
  }
  /** Aus der Palette gezogen: 'chromebar' / 'chromesidebar' erzeugen eine globale Leiste. */
  function chromeIsBarType(t){return t==='chromebar'||t==='chromesidebar';}
  function chromeAddFromPalette(type){return chromeAdd(type==='chromebar'?'bar':'sidebar',type==='chromebar'?'top':'left');}
  /** Leiste per ID finden (auch fuer widget()/select()). */
  function chromeDef(id){return chromeList().filter(function(b){return b.id===id;})[0]||null;}

  /** Eigenschaften-Panel einer Leiste (wird von chromebar.js / chromesidebar.js genutzt). */
  function chromeProps(w){
    var b=chromeDef(w.id);if(!b)return '';
    var S=(b.kind==='bar')?[['top','oben'],['bottom','unten']]:[['left','links'],['right','rechts']];
    var g=_chromeGeo?_chromeGeo.bars.filter(function(x){return x.def.id===b.id;})[0]:null;
    return row('Name','<input id="pChName" value="'+esc(b.name||'')+'">')
      +row('Seite','<select id="pChSide">'+S.map(function(o){return '<option value="'+o[0]+'"'+((b.side||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
      +row((b.kind==='bar'?'Höhe (px)':'Breite (px)'),'<input id="pChSize" type="number" min="8" value="'+chromeSize(b)+'">')
      +row('Hintergrund','<input id="pChBg" type="color" value="'+(/^#[0-9a-fA-F]{6}$/.test(b.bg||'')?b.bg:'#141c1f')+'"> <button class="btn" id="pChBgX" style="padding:4px 8px">Standard</button>')
      +(function(){var n=chromeSelOnPage().length;
        return row('Auswahl','<button class="btn" id="pChMoveIn"'+(n?'':' disabled')+' style="padding:5px 9px">'
          +(n?('Ausgewählte '+n+' Widget'+(n>1?'s':'')+' hierher verschieben'):'Auf der Seite Widgets auswählen')
          +'</button>');})()
      +'<div style="font-size:11px;color:var(--muted);margin:6px 2px">'
        +(g?('Fläche '+Math.round(g.w)+'×'+Math.round(g.h)+' px · '):'')
        +((b.widgets||[]).length)+' Widget(s) darin · erscheint auf allen Seiten (nicht in Popups)</div>'
      +'<button class="btn" id="pChDel" style="margin-top:4px">Leiste entfernen</button>';
  }
  function chromeWire(w){
    var b=chromeDef(w.id);if(!b)return;
    function up(){render();chromeUI();commit();}
    if($('#pChName'))$('#pChName').oninput=function(){b.name=this.value;chromeUI();commit();};
    if($('#pChSide'))$('#pChSide').onchange=function(){b.side=this.value;up();renderProps();};
    if($('#pChSize'))$('#pChSize').oninput=function(){b.size=parseInt(this.value)||56;up();};
    if($('#pChBg'))$('#pChBg').oninput=function(){b.bg=this.value;up();};
    if($('#pChBgX'))$('#pChBgX').onclick=function(){delete b.bg;up();renderProps();};
    if($('#pChMoveIn'))$('#pChMoveIn').onclick=function(){var ids=chromeSelOnPage();if(!ids.length)return;
      var n=chromeMoveIn(b.id,ids);if(typeof toast==='function')toast(n+' Widget(s) in „'+(b.name||'Leiste')+'" verschoben');};
    if($('#pChDel'))$('#pChDel').onclick=function(){chromeDel(b.id);};
  }
  function chromeDel(id){
    var l=chromeList(),i=l.map(function(b){return b.id;}).indexOf(id);
    if(i<0)return;l.splice(i,1);render();chromeUI();renderProps();commit();
  }
  function chromeMove(id,dir){
    var l=chromeList(),i=l.map(function(b){return b.id;}).indexOf(id),j=i+dir;
    if(i<0||j<0||j>=l.length)return;var t=l[i];l[i]=l[j];l[j]=t;render();chromeUI();commit();
  }
  function chromeById(id){return chromeList().filter(function(b){return b.id===id;})[0]||null;}

  /** Widget in eine Leiste einfuegen (Koordinaten relativ zur Leiste). */
  function chromeAddWidget(barId,type,px,py){
    var b=chromeById(barId);if(!b)return;
    var reg=WIDGETS[type],sz=(reg&&reg.size)||[140,80];
    var g=(_chromeGeo?_chromeGeo.bars.filter(function(x){return x.def.id===barId;})[0]:null);
    var maxX=g?Math.max(0,g.w-sz[0]):0,maxY=g?Math.max(0,g.h-sz[1]):0;
    var w={id:chromeUid(),type:type,x:Math.max(0,Math.min(snap(px||0),maxX)),y:Math.max(0,Math.min(snap(py||0),maxY)),
      w:sz[0],h:sz[1],label:(type==='switch'?'Schalter':(type==='text'?'Text':'Label'))};
    if(reg&&reg.defaults)reg.defaults(w);
    if(!b.widgets)b.widgets=[];
    b.widgets.push(w);render();select(w.id);commit();
  }

  /** Aktuelle Geometrie einer Leiste (fuer Snapping/Begrenzung). */
  function _chromeGeoOf(id){
    if(!_chromeGeo)return null;
    return _chromeGeo.bars.filter(function(g){return g.def.id===id;})[0]||null;
  }

  // ---- IDs -----------------------------------------------------------------------------------
  // Leisten-Kinder leben GLOBAL (ueber allen Seiten), Seiten-IDs ('w1','w2', …) sind dagegen nur
  // je Ansicht eindeutig - dieselbe 'w7' darf auf mehreren Seiten liegen. Beides im selben
  // Namensraum fuehrt zu Chaos: sel[] trifft beide, widget() liefert das falsche Objekt,
  // chromeOwnerOf haelt ein Seiten-Widget fuer ein Leisten-Kind. Leisten-Kinder bekommen daher
  // einen EIGENEN Namensraum 'c1','c2', … - eine Kollision ist damit ausgeschlossen.
  function chromeUid(){
    var mx=0;
    chromeAllKids().forEach(function(w){var n=parseInt(String(w.id||'').replace(/^c/,''))||0;if(n>mx)mx=n;});
    return 'c'+(mx+1);
  }
  /** Einmalige Bereinigung: Alt-IDs und Doppelte in den Leisten auf den c-Namensraum umstellen. */
  function chromeFixIds(){
    var seen={},fixed=0;
    chromeList().forEach(function(b){
      (b.widgets||[]).forEach(function(w){
        var bad=(!/^c[0-9]+$/.test(String(w.id||''))) || seen[w.id];
        if(bad){w.id=chromeUid();fixed++;}
        seen[w.id]=1;
        // Gruppen sind ein Seiten-Konzept: eine Gruppe ueber Seite und Leiste hinweg ergibt
        // keinen Sinn und wuerde die Auswahl beider verketten.
        if(w.group){delete w.group;delete w.gmaster;fixed++;}
      });
    });
    return fixed;
  }

  /** Ausgewählte Seiten-Widgets in eine Leiste verschieben (Koordinaten werden umgerechnet). */
  function chromeMoveIn(barId,ids){
    var b=chromeById(barId);if(!b)return 0;
    var g=_chromeGeoOf(barId),co=chromeContent();
    if(!b.widgets)b.widgets=[];
    var moved=0;
    (ids||[]).forEach(function(id){
      var i=state.widgets.map(function(x){return x.id;}).indexOf(id);
      if(i<0)return;                                  // liegt nicht auf der Seite (evtl. schon in einer Leiste)
      var w=state.widgets.splice(i,1)[0];
      w.id=chromeUid();                              // eigener Namensraum, sonst Kollision mit Seiten-IDs
      if(w.group){delete w.group;delete w.gmaster;}  // Gruppen gelten nur innerhalb einer Seite
      if(g){ // Seiten- in Leisten-Koordinaten: Inhaltsversatz drauf, Leistenposition ab, dann begrenzen
        w.x=Math.max(0,Math.min(Math.round(w.x+co.x-g.x),Math.max(0,g.w-w.w)));
        w.y=Math.max(0,Math.min(Math.round(w.y+co.y-g.y),Math.max(0,g.h-w.h)));
      }else{w.x=0;w.y=0;}
      b.widgets.push(w);moved++;
    });
    if(moved){selClear();render();chromeUI();renderProps();commit();}
    return moved;
  }
  /** Widgets aus ihrer Leiste zurück auf die Seite holen. */
  function chromeMoveOut(ids){
    var co=chromeContent(),moved=0;
    (ids||[]).forEach(function(id){
      var b=chromeOwnerOf(id);if(!b)return;
      var g=_chromeGeoOf(b.id);
      var i=b.widgets.map(function(x){return x.id;}).indexOf(id);
      var w=b.widgets.splice(i,1)[0];
      w.id=uid();                                    // zurueck in den Seiten-Namensraum
      if(g){w.x=Math.max(0,Math.round(w.x+g.x-co.x));w.y=Math.max(0,Math.round(w.y+g.y-co.y));}
      state.widgets.push(w);moved++;
    });
    if(moved){selClear();render();chromeUI();renderProps();commit();}
    return moved;
  }
  /** IDs der aktuellen Auswahl, die auf der SEITE liegen (nicht in einer Leiste). */
  function chromeSelOnPage(){
    return Object.keys(sel).filter(function(id){
      return state.widgets.some(function(x){return x.id===id;});
    });
  }

  /** Liegt der Punkt (Seiten-Koordinaten) in einer Leiste? */
  function chromeHitTest(px,py){
    if(!_chromeGeo)return null;
    var hit=null;
    _chromeGeo.bars.forEach(function(g){
      if(px>=g.x&&px<g.x+g.w&&py>=g.y&&py<g.y+g.h)hit=g;
    });
    return hit;
  }

  /** Verwaltung im Einstellungen-Tab. */
  function chromeUI(){
    var box=$('#chromeBox');if(!box)return;
    var l=chromeList();
    var SIDES={bar:[['top','oben'],['bottom','unten']],sidebar:[['left','links'],['right','rechts']]};
    var h='<div style="font-size:11px;color:var(--muted);margin:0 0 6px">Leisten erscheinen auf allen Seiten (nicht in Popups) und reservieren Platz. Bar schlägt Sidebar.</div>'
      +'<div style="display:flex;gap:6px;margin-bottom:8px">'
      +'<button class="btn" id="chAddBar">+ Bar (horizontal)</button>'
      +'<button class="btn" id="chAddSide">+ Sidebar (vertikal)</button></div>';
    if(!l.length)h+='<div style="font-size:11px;color:var(--faint)">Noch keine Leiste angelegt.</div>';
    l.forEach(function(b,i){
      h+='<div class="chrow" data-chid="'+b.id+'">'
        +'<div style="display:flex;gap:5px;align-items:center;margin-bottom:4px">'
        +'<b style="font-size:11px">'+(b.kind==='bar'?'Bar':'Sidebar')+'</b>'
        +'<input data-chf="name" value="'+esc(b.name||'')+'" style="flex:1;min-width:0">'
        +'<button class="btn" data-chup="'+b.id+'" title="nach vorne" style="padding:2px 6px">▲</button>'
        +'<button class="btn" data-chdn="'+b.id+'" title="nach hinten" style="padding:2px 6px">▼</button>'
        +'<button class="btn" data-chdel="'+b.id+'" title="entfernen" style="padding:2px 6px">✕</button></div>'
        +'<div style="display:flex;gap:5px;align-items:center">'
        +'<select data-chf="side">'+SIDES[b.kind].map(function(o){return '<option value="'+o[0]+'"'+((b.side||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>'
        +'<input data-chf="size" type="number" min="8" value="'+chromeSize(b)+'" style="width:64px" title="'+(b.kind==='bar'?'Höhe':'Breite')+' in px">'
        +'<span style="font-size:11px;color:var(--muted)">'+(b.kind==='bar'?'Höhe':'Breite')+'</span>'

        +'</div><div style="font-size:11px;color:var(--faint);margin-top:3px">'+((b.widgets||[]).length)+' Widget(s) darin</div></div>';
    });
    box.innerHTML=h;
    if($('#chAddBar'))$('#chAddBar').onclick=function(){chromeAdd('bar','top');};
    if($('#chAddSide'))$('#chAddSide').onclick=function(){chromeAdd('sidebar','left');};
    $$('[data-chdel]',box).forEach(function(x){x.onclick=function(){chromeDel(x.dataset.chdel);};});
    $$('[data-chup]',box).forEach(function(x){x.onclick=function(){chromeMove(x.dataset.chup,-1);};});
    $$('[data-chdn]',box).forEach(function(x){x.onclick=function(){chromeMove(x.dataset.chdn,1);};});

    $$('[data-chf]',box).forEach(function(inp){
      inp.oninput=inp.onchange=function(){
        var id=inp.closest('.chrow').dataset.chid,b=chromeById(id);if(!b)return;
        var k=inp.dataset.chf;
        b[k]=(k==='size')?(parseInt(inp.value)||56):inp.value;
        render();commit();if(k!=='name')chromeUI();
      };
    });
  }
