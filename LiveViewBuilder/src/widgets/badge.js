  // ===== Widget: Badge — die Vergleichspille, sonst nichts =====
  //
  // Die gefaerbte Abweichungs-Pille ("▲ +9,7 % vs Plan") steckte bisher fest in der
  // Wertkarte. Wer sie OHNE Zahl brauchte - im Kopf einer Karte, in einer Kopfzeile -
  // musste eine ganze Wertkarte danebenstellen und ihren Wert aus dem sichtbaren
  // Bereich schieben. Das hat funktioniert und war trotzdem falsch: die Kachel trug
  // eine Zahl mit sich herum, die niemand sehen sollte.
  //
  // Dieses Widget ist genau die Pille - mit DENSELBEN Eigenschaftsnamen (varId, cmpVid,
  // cmpMode, cmpTol, cmpText) und DERSELBEN Rechnung (_vcCmp aus valuecard.js). Nicht
  // nachgebaut, sondern aufgerufen: eine zweite Umsetzung derselben Regel liefe
  // frueher oder spaeter auseinander, und dann faerbte dieselbe Abweichung an zwei
  // Stellen der Seite verschieden.
  defWidget('badge',{
    label:'Badge (Abweichung)',
    cat:'Anzeige',
    paletteIcon:'star',
    size:[160,30],
    render:function(w){
      // justify: die Pille sitzt im Entwurf rechtsbuendig am Kartenkopf, kommt aber
      // auch linksbuendig in einer Zeile vor.
      var j=(w.bdAlign==='left')?'flex-start':((w.bdAlign==='center')?'center':'flex-end');
      return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:'+j+'">'
        +'<span data-role="cmp" class="hvcmuted">–</span></div>';
    },
    props:function(w){
      if(w.type!=='badge')return '';
      return '<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Zeigt die Abweichung der <b>Variable</b> (Ist) von der Soll-Variable als gefaerbte Pille. Gruen innerhalb der Toleranz, sonst warnfarben.</div>'
        +fieldPick(w,'cmpVid','Soll-Variable')
        +row('Modus','<select id="pBdMode"><option value="pct"'+((w.cmpMode||'pct')==='pct'?' selected':'')+'>Prozent</option><option value="abs"'+(w.cmpMode==='abs'?' selected':'')+'>Absolut</option></select>')
        +row('Toleranz grün','<input id="pBdTol" type="number" step="0.1" style="width:74px" value="'+(w.cmpTol!=null?w.cmpTol:10)+'"> <span style="font-size:11px;color:var(--muted)">'+((w.cmpMode==='abs')?'in Einheit':'%')+'</span>')
        +row('Zusatztext','<input id="pBdText" value="'+esc(w.cmpText||'')+'" placeholder="vs Plan">')
        +row('Bewertung','<select id="pBdGood"><option value=""'+(!w.cmpGood?' selected':'')+'>nur Toleranz</option><option value="low"'+(w.cmpGood==='low'?' selected':'')+'>weniger ist besser</option><option value="high"'+(w.cmpGood==='high'?' selected':'')+'>mehr ist besser</option></select>')
        +row('Ausrichtung','<select id="pBdAlign"><option value=""'+(!w.bdAlign?' selected':'')+'>Rechts</option><option value="center"'+(w.bdAlign==='center'?' selected':'')+'>Mitte</option><option value="left"'+(w.bdAlign==='left'?' selected':'')+'>Links</option></select>');
    },
    wire:function(w){
      if($('#pBdMode'))$('#pBdMode').onchange=function(){w.cmpMode=this.value||undefined;render();renderProps();commit();};
      if($('#pBdTol'))$('#pBdTol').oninput=function(){w.cmpTol=this.value===''?undefined:parseFloat(this.value);render();commit();};
      if($('#pBdText'))$('#pBdText').oninput=function(){w.cmpText=this.value||undefined;render();commit();};
      if($('#pBdGood'))$('#pBdGood').onchange=function(){w.cmpGood=this.value||undefined;render();commit();};
      if($('#pBdAlign'))$('#pBdAlign').onchange=function(){w.bdAlign=this.value||undefined;render();commit();};
    },
    live:function(w,el){_vcCmp(w,el);}
  });
