  // ===== Widget: Container — nimmt beliebige Widgets auf, verschiebt/skaliert sie als Einheit =====
  //  Kinder liegen in w.kids mit Koordinaten RELATIV zur Design-Flaeche (baseW x baseH).
  //  Container verschieben -> Kinder wandern mit (sie sind im Container-Host verschachtelt).
  //  Container-Groesse aendern -> Inhalt skaliert proportional (transform:scale, s. expandContainer in 03).
  //  Optik umschaltbar: Panel (Hintergrund/Rahmen/Titel) oder unsichtbar (reiner Gruppierungs-Container).
  //  Kinder editiert man direkt im Container (auswaehlen/ziehen/skalieren); Ablegen per Ziehen hinein,
  //  Loesen ueber den Knopf in den Eigenschaften oder Ziehen aus dem Container heraus.
  defWidget('container',{
    label:'Container', cat:'Layout (alle Seiten)', paletteIcon:'wtile', size:[320,200], noHover:true,
    defaults:function(w){w.kids=[];w.panel=true;w.title='';},
    render:function(w){
      // Die Kopfzeile des Panels ist mehr als eine Ueberschrift: sie traegt links ein
      // Symbol und rechts eine LIVE-Angabe ("Puffer laedt", "4 Phasen"). Damit sieht man
      // am geschlossenen Panel, ob darin gerade etwas los ist - ohne hineinzuschauen.
      // ttlH gibt die Hoehe in px vor, wo ein Entwurf eine bestimmte Kopfzeile verlangt;
      // ohne Angabe bleibt es bei der mitwachsenden Hoehe aus styles.css.
      var panel=(w.panel!==false), hasT=!!(panel&&(w.title||w.ttlIcon||w.ttlRight||w.ttlRightVid));
      var ttl='';
      if(hasT){
        var ic=w.ttlIcon?('<span class="cttl-ic">'+iconSVG(w.ttlIcon)+'</span>'):'';
        var re='';
        if(w.ttlRight||w.ttlRightVid){
          var dot=w.ttlDot?('<i class="cttl-dot"'+(w.ttlDotCol?(' style="background:'+_cssColorOrEmpty(w.ttlDotCol)+'"'):'')+'></i>'):'';
          // Text UND Variable: der Text wird zur Beschriftung des Livewerts
          // ("Warnschwelle 400 kg") statt ihn zu ersetzen.
          var lbl=(w.ttlRight&&w.ttlRightVid)?('<span class="cttl-lbl">'+escL(w.ttlRight)+'</span>'):'';
          re='<span class="cttl-re'+(w.ttlDot?' has-dot':'')+'">'+dot+lbl
            +'<span'+(w.ttlRightVid?(' data-vid="'+w.ttlRightVid+'"'):'')+'>'
            +escL(w.ttlRightVid?'–':(w.ttlRight||''))+'</span></span>';
        }
        ttl='<div class="contttl'+((w.ttlIcon||w.ttlH)?' plain':'')+'"'
           +(w.ttlH?(' style="--cont-ttlh:'+(parseInt(w.ttlH)||0)+'px"'):'')+'>'
           +ic+'<span class="cttl-tx">'+escL(w.title||'')+'</span>'+re+'</div>';
      }
      return '<div class="wcont'+(panel?' panel':'')+(hasT?' has-ttl':'')+'"'
        +(w.ttlH?(' style="--cont-ttlh:'+(parseInt(w.ttlH)||0)+'px"'):'')
        +' data-role="conthost">'+ttl+'<div class="conthost2" data-role="contbody"></div></div>';
    },
    props:function(w){
      return '<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Widgets in den Container ziehen — sie werden relativ gespeichert. Container verschieben → alle Kinder wandern mit; einzeln verschieb-/größenveränderbar. Im Editor 1:1; im Betrieb/Mobil/Webview passt sich der Inhalt proportional in die Container-Größe ein (alle Kinder sichtbar). Ein Kind auswählen: direkt anklicken.</div>'
        +row('Optik','<select id="pContPanel"><option value="1"'+(w.panel!==false?' selected':'')+'>Panel (Hintergrund/Rahmen)</option><option value="0"'+(w.panel===false?' selected':'')+'>Unsichtbar</option></select>')
        +(w.panel!==false?(row('Titel','<input id="pContTitle" value="'+esc(w.title||'')+'" placeholder="optional">')
          +row('Symbol','<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.ttlIcon?iconSVG(w.ttlIcon):'')+'</span> <button class="btn" id="pContIco" style="padding:5px 8px">wählen</button>'+(w.ttlIcon?' <button class="btn" id="pContIcoX" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''))
          +row('Kopfzeile rechts','<input id="pContRight" value="'+esc(w.ttlRight||'')+'" style="width:130px" placeholder="Text"> <input id="pContRightVid" type="number" style="width:84px" value="'+(w.ttlRightVid||'')+'" placeholder="Var-ID">')
          +row('Punkt davor','<input type="checkbox" id="pContDot"'+(w.ttlDot?' checked':'')+'> '+skinSel(w.ttlDotCol||'','id="pContDotCol"'))
          +row('Höhe Kopfzeile (px)','<input id="pContTtlH" type="number" min="0" style="width:80px" value="'+(w.ttlH||'')+'" placeholder="automatisch">')):'')
        +'<div style="font-size:11px;color:var(--muted);margin:4px 2px 2px">'+((w.kids&&w.kids.length)||0)+' Kind-Widget(s).</div>';
    },
    wire:function(w){
      if($('#pContPanel'))$('#pContPanel').onchange=function(){w.panel=(this.value==='1');render();renderProps();commit();};
      if($('#pContTitle'))$('#pContTitle').oninput=function(){w.title=this.value||undefined;render();};
      if($('#pContIco'))$('#pContIco').onclick=function(){_iconPick={wid:w.id,field:'ttlIcon'};showTab('icons');toast('Symbol für die Kopfzeile wählen');};
      if($('#pContIcoX'))$('#pContIcoX').onclick=function(){delete w.ttlIcon;render();renderProps();commit();};
      if($('#pContRight'))$('#pContRight').oninput=function(){w.ttlRight=this.value||undefined;render();};
      if($('#pContRightVid'))$('#pContRightVid').onchange=function(){w.ttlRightVid=parseInt(this.value)||undefined;render();commit();};
      if($('#pContDot'))$('#pContDot').onchange=function(){w.ttlDot=this.checked||undefined;render();commit();};
      if($('#pContDotCol'))$('#pContDotCol').onchange=function(){w.ttlDotCol=this.value||undefined;render();commit();};
      if($('#pContTtlH'))$('#pContTtlH').oninput=function(){w.ttlH=this.value===''?undefined:(parseInt(this.value)||0);render();commit();};
    }
  });
