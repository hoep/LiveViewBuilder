  // ===== Widget: Container — nimmt beliebige Widgets auf, verschiebt/skaliert sie als Einheit =====
  //  Kinder liegen in w.kids mit Koordinaten RELATIV zur Design-Flaeche (baseW x baseH).
  //  Container verschieben -> Kinder wandern mit (sie sind im Container-Host verschachtelt).
  //  Container-Groesse aendern -> Inhalt skaliert proportional (transform:scale, s. expandContainer in 03).
  //  Optik umschaltbar: Panel (Hintergrund/Rahmen/Titel) oder unsichtbar (reiner Gruppierungs-Container).
  //  Kinder editiert man direkt im Container (auswaehlen/ziehen/skalieren); Ablegen per Ziehen hinein,
  //  Loesen ueber den Knopf in den Eigenschaften oder Ziehen aus dem Container heraus.
  defWidget('container',{
    label:'Container', paletteIcon:'wtile', size:[320,200], noHover:true,
    defaults:function(w){w.kids=[];w.panel=true;w.title='';},
    render:function(w){
      var panel=(w.panel!==false), hasT=!!(panel&&w.title);
      var ttl=hasT?('<div class="contttl">'+escL(w.title)+'</div>'):'';
      return '<div class="wcont'+(panel?' panel':'')+(hasT?' has-ttl':'')+'" data-role="conthost">'+ttl+'<div class="conthost2" data-role="contbody"></div></div>';
    },
    props:function(w){
      return '<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Widgets in den Container ziehen — sie werden relativ gespeichert. Container verschieben → alle Kinder wandern mit; einzeln verschieb-/größenveränderbar. Im Editor 1:1; im Betrieb/Mobil/Webview passt sich der Inhalt proportional in die Container-Größe ein (alle Kinder sichtbar). Ein Kind auswählen: direkt anklicken.</div>'
        +row('Optik','<select id="pContPanel"><option value="1"'+(w.panel!==false?' selected':'')+'>Panel (Hintergrund/Rahmen)</option><option value="0"'+(w.panel===false?' selected':'')+'>Unsichtbar</option></select>')
        +(w.panel!==false?row('Titel','<input id="pContTitle" value="'+esc(w.title||'')+'" placeholder="optional">'):'')
        +'<div style="font-size:11px;color:var(--muted);margin:4px 2px 2px">'+((w.kids&&w.kids.length)||0)+' Kind-Widget(s).</div>';
    },
    wire:function(w){
      if($('#pContPanel'))$('#pContPanel').onchange=function(){w.panel=(this.value==='1');render();renderProps();commit();};
      if($('#pContTitle'))$('#pContTitle').oninput=function(){w.title=this.value||undefined;render();};
    }
  });
