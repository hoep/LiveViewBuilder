  // ===== Widget: Komponente (component) — instanziiert eine Ansicht als parametrierbare Vorlage =====
  // Master = eine (eigene) Ansicht; Instanzen remappen Variablen-IDs per Alias-Tabelle. Änderungen am Master
  // wirken automatisch auf alle Instanzen (keine Kopie). Expansion + Live in src/js/03 (expandComponent).
  defWidget('component',{
    label:'Komponente', cat:'Layout (alle Seiten)', paletteIcon:'wtile', size:[240,160],
    render:function(w){return '<div class="compclip" data-role="comphost" style="position:absolute;inset:0;overflow:hidden;border-radius:6px'+(mode==='edit'?';outline:1px dashed var(--line);outline-offset:-1px':'')+'"></div>';},
    props:function(w){return row('Komponente','<select id="pCompSrc"><option value="">— Ansicht wählen —</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(w.comp===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select>')
      +row('Region-Name','<input id="pCompSlot" value="'+esc(w.slot||'')+'" placeholder="z. B. inhalt (leer = fix)">')
      +(function(){
        // Sichtbar machen, wer diesen Bereich umschaltet - der Name allein sagt
        // einem nichts, wenn man die Seite nicht selbst gebaut hat.
        if(!w.slot)return '<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Ohne Region-Namen zeigt die Kachel immer dieselbe Ansicht.</div>';
        var t=(state.widgets||[]).filter(function(x){return x.type==='regiontabs'&&x.slot===w.slot;});
        var jetzt=(typeof _regions!=='undefined'&&_regions&&_regions[w.slot])||w.comp||'—';
        return '<div style="font-size:11px;line-height:1.45;margin:2px 2px 6px">'
          +(t.length
             ? '<span style="color:var(--ok)">umgeschaltet von den Region-Tabs '+t.map(function(x){return '„'+esc(x.name||x.id)+'"';}).join(', ')+'</span>'
             : '<span style="color:var(--warn)">keine Region-Tabs mit diesem Namen auf dieser Seite</span>')
          +'<br><span style="color:var(--muted)">zeigt gerade: '+esc(jetzt)+'</span></div>';
      })()
      +listEditor(w,'alias','Parameter: Vorlagen-ID → echte ID',[{k:'from',ph:'Vorlage'},{k:'to',ph:'echte ID'}]);},
    wire:function(w){if($('#pCompSrc'))$('#pCompSrc').onchange=function(){w.comp=this.value||undefined;render();commit();};
      if($('#pCompSlot'))$('#pCompSlot').oninput=function(){w.slot=this.value||undefined;render();commit();};}
  });
