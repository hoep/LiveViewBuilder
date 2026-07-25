  // ===== Widget: Komponente (component) — instanziiert eine Ansicht als parametrierbare Vorlage =====
  // Master = eine (eigene) Ansicht; Instanzen remappen Variablen-IDs per Alias-Tabelle. Änderungen am Master
  // wirken automatisch auf alle Instanzen (keine Kopie). Expansion + Live in src/js/03 (expandComponent).
  defWidget('component',{
    label:'Komponente', paletteIcon:'wtile', size:[240,160],
    render:function(w){return '<div class="compclip" data-role="comphost" style="position:absolute;inset:0;overflow:hidden;border-radius:6px'+(mode==='edit'?';outline:1px dashed var(--line);outline-offset:-1px':'')+'"></div>';},
    props:function(w){return row('Komponente','<select id="pCompSrc"><option value="">— Ansicht wählen —</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.comp===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
      +row('Region-Name','<input id="pCompSlot" value="'+esc(w.slot||'')+'" placeholder="z. B. inhalt (leer = fix)">')
      +listEditor(w,'alias','Parameter: Vorlagen-ID → echte ID',[{k:'from',ph:'Vorlage'},{k:'to',ph:'echte ID'}]);},
    wire:function(w){if($('#pCompSrc'))$('#pCompSrc').onchange=function(){w.comp=this.value||undefined;render();commit();};
      if($('#pCompSlot'))$('#pCompSlot').oninput=function(){w.slot=this.value||undefined;render();commit();};}
  });
