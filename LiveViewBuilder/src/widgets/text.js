  // ===== Widget: Text — statische Textzeile =====
  defWidget('text',{
    label:'Text', cat:'Grundelemente', paletteIcon:'wcode', size:[200,48],
    // Mehrzeilige Texte in einem hohen Kasten gehoeren nach OBEN. Zentriert sieht bei
    // kurzem Text gut aus, laesst bei langem Text aber oben und unten Luecken stehen.
    render:function(w){
      // Der Innenabstand ist normalerweise gut so - er haelt Text von der Kante weg.
      // Bei einer nach Entwurf gesetzten Zeile ist er im Weg: die Kachel ist dann genau
      // so hoch wie die Zeile, und 12 px Rand schneiden sie ab. Darum abwaehlbar.
      var pd=(w.tpad!=null&&w.tpad!=='')?(' style="padding:'+(parseInt(w.tpad)||0)+'px '+((parseInt(w.tpad)||0)+2)+'px"'):'';
      return '<div class="wt'+(w.vtop?' vtop':'')+'"'+pd+'><div class="t">'+escL(w.label||'Text')+'</div></div>';},
    props:function(w){return row('Text oben','<input type="checkbox" id="pTxTop"'+(w.vtop?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">statt senkrecht zentriert</span>')
      +row('Innenabstand (px)','<input id="pTxPad" type="number" min="0" style="width:80px" value="'+(w.tpad!=null?w.tpad:'')+'" placeholder="Standard"> <span style="font-size:11px;color:var(--muted)">0 = randlos, für nach Maß gesetzte Zeilen</span>');},
    wire:function(w){if($('#pTxTop'))$('#pTxTop').onchange=function(){w.vtop=this.checked||undefined;render();commit();};
      if($('#pTxPad'))$('#pTxPad').oninput=function(){w.tpad=this.value===''?undefined:(parseInt(this.value)||0);render();commit();};}
  });
