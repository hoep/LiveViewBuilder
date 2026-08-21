  // ===== Widget: Objekt-Info (objinfo) — Metadaten eines IPS-Objekts =====
  // Uebliche Muster - die Liste ist eine Abkuerzung, kein Zaun: 'eigenes Format'
  // laesst jede Zeichenkette zu.
  var _OIFMT=['H:i','H:i:s','d.m. H:i','d.m.Y H:i','d.m.Y','D H:i','j. F Y'];
  function _oiFmtSel(w){
    var cur=w.oiFmt||'', frei=(cur!==''&&cur!=='rel'&&_OIFMT.indexOf(cur)<0);
    var o='<option value=""'+(cur===''?' selected':'')+'>Datum und Uhrzeit (Vorgabe)</option>'
        +'<option value="rel"'+(cur==='rel'?' selected':'')+'>relativ (vor 5 min)</option>'
        +_OIFMT.map(function(f){return '<option value="'+f+'"'+(cur===f?' selected':'')+'>'+esc(f)+'</option>';}).join('')
        +'<option value="__frei"'+(frei?' selected':'')+'>eigenes Format …</option>';
    return '<select id="pOiFmt">'+o+'</select>';
  }

  defWidget('objinfo',{
    label:'Objekt-Info', cat:'Anzeige', paletteIcon:'info', size:[230,60],
    defaults:function(w){w.field='updated';},
    // Groessen aus der Kachel: padding per clamp/cqmin, Schrift ueber die zentrale
    // Skala (--wf-lbl/--wf-txt) — damit haengt objinfo an derselben Groessenlogik wie value/kpi/tile.
    render:function(w){
      // Ausrichtung mit denselben Werten wie beim Wert-Widget ('' | center | right),
      // damit dieselbe Einstellung in beiden Kacheln dasselbe bedeutet.
      var al=w.align?(';text-align:'+w.align):'';
      // Farben aus dem Skin, nicht als Hex - so folgt die Kachel einem Skinwechsel.
      // Ohne Angabe bleibt es bei der bisherigen Aufteilung: Beschriftung leise,
      // Wert in Textfarbe.
      var lc=_skinColor(w.oiLblCol)||'var(--muted)';
      var vc=_skinColor(w.oiValCol)||'var(--text)';
      return '<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:clamp(5px,3cqmin,12px) clamp(8px,4.5cqmin,16px);min-width:0'+al+'"><div style="font-size:var(--wf-lbl);color:'+lc+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-role="oiname">'+escL(w.label||'Objekt')+'</div><div style="font-size:var(--wf-txt);color:'+vc+';font-family:var(--fm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-role="oival">–</div></div>';},
    props:function(w){return row('Objekt-ID','<input id="pOiId" value="'+(w.objId||'')+'" placeholder="ID"> <button class="btn" id="pOiPick" style="padding:6px 8px">wählen</button>')
      +row('Farbe Beschriftung',skinSel(w.oiLblCol||'','id="pOiLblCol"')+' <span style="font-size:11px;color:var(--muted)">leer = leise (muted)</span>')
      +row('Farbe Wert',skinSel(w.oiValCol||'','id="pOiValCol"')+' <span style="font-size:11px;color:var(--muted)">leer = Textfarbe</span>')
      +row('Ausrichtung','<select id="pOiAlign"><option value=""'+(!w.align?' selected':'')+'>Links</option><option value="center"'+(w.align==='center'?' selected':'')+'>Zentriert</option><option value="right"'+(w.align==='right'?' selected':'')+'>Rechts</option></select>')
      +row('Feld','<select id="pOiField"><option value="updated"'+((w.field||'updated')==='updated'?' selected':'')+'>Letzte Aktualisierung</option><option value="changed"'+(w.field==='changed'?' selected':'')+'>Letzte Änderung</option><option value="next"'+(w.field==='next'?' selected':'')+'>Nächster Lauf</option><option value="last"'+(w.field==='last'?' selected':'')+'>Letzter Lauf</option><option value="name"'+(w.field==='name'?' selected':'')+'>Objektname</option></select>')
      // Zeitfelder waren fest auf toLocaleString('de-DE') verdrahtet - also immer
      // Datum UND Uhrzeit. Bei "zuletzt aktualisiert" ist das Datum meist Ballast.
      +((w.field||'updated')==='name'?'':(
          row('Format',_oiFmtSel(w))
        + ((w.oiFmt&&w.oiFmt!=='rel'&&_OIFMT.indexOf(w.oiFmt)<0)
             ? row('eigenes Format','<input id="pOiFmtFree" value="'+esc(w.oiFmt||'')+'" placeholder="z. B. d.m. H:i">')
             : '')
        + '<div style="font-size:11px;color:var(--muted);line-height:1.45;margin:2px 4px 7px">Zeichen wie in IP-Symcon: <b>d</b> Tag, <b>m</b> Monat, <b>Y</b> Jahr, <b>H</b> Stunde, <b>i</b> Minute, <b>s</b> Sekunde, <b>D</b>/<b>l</b> Wochentag, <b>M</b>/<b>F</b> Monatsname. Ein Backslash schützt ein Zeichen: <b>\\a\\m H:i</b>.</div>'
        ));},
    wire:function(w){
      if($('#pOiId'))$('#pOiId').onchange=function(){w.objId=parseInt(this.value)||0;render();fetchObjInfo(w);};
      if($('#pOiPick'))$('#pOiPick').onclick=function(){showTab('vars');_bindObj=w.id;};
      if($('#pOiLblCol'))$('#pOiLblCol').onchange=function(){w.oiLblCol=this.value||undefined;render();commit();};
      if($('#pOiValCol'))$('#pOiValCol').onchange=function(){w.oiValCol=this.value||undefined;render();commit();};
      if($('#pOiAlign'))$('#pOiAlign').onchange=function(){w.align=this.value||undefined;render();commit();};
      if($('#pOiField'))$('#pOiField').onchange=function(){w.field=this.value;render();renderProps();fetchObjInfo(w);};
      if($('#pOiFmt'))$('#pOiFmt').onchange=function(){
        var v=this.value;
        if(v==='__frei'){
          // '__frei' ist nur die Auswahl, kein Muster - sonst stuende es woertlich
          // in der Kachel. Vorhandenes eigenes Muster behalten, sonst eines vorgeben.
          var alt=w.oiFmt||'';
          w.oiFmt=(alt&&alt!=='rel'&&_OIFMT.indexOf(alt)<0)?alt:'d.m. H:i';
        }else{
          w.oiFmt=(v===''?undefined:v);
        }
        render();renderProps();fetchObjInfo(w);};
      if($('#pOiFmtFree'))$('#pOiFmtFree').onchange=function(){w.oiFmt=this.value||undefined;render();fetchObjInfo(w);};
    }
  });
