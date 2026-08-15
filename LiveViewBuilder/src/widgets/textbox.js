  // ===== Widget: Eingabefeld (textbox) — schreibt Benutzereingabe in String-Variable =====
  defWidget('textbox',{
    label:'Eingabe', cat:'Steuerung', paletteIcon:'wcode', size:[220,52],
    render:function(w){var v=(w.varId&&_lastVals[w.varId])?String(_lastVals[w.varId].v):'';
      var st='position:absolute;inset:0;width:100%;height:100%;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);box-sizing:border-box;font-family:var(--fu,inherit)';
      // Schrift/Polster folgen der Kachelgroesse (die Kachel ist ein Groessen-Container).
      // Mehrzeilig bewusst mit kleinem cqmin-Faktor: sonst waechst die Schrift mit der Hoehe ins Absurde.
      if(w.multi)return '<textarea data-role="tbin" placeholder="'+esc(w.label||'')+'" style="'+st+';font-size:clamp(11px,7cqmin,17px);padding:clamp(6px,3.5cqmin,12px);resize:none">'+esc(v)+'</textarea>';
      return '<input data-role="tbin" type="'+(w.pw?'password':'text')+'" value="'+esc(v)+'" placeholder="'+esc(w.label||'')+'" style="'+st+';font-size:clamp(11px,26cqmin,20px);padding:0 clamp(8px,4cqmin,16px)">';},
    props:function(w){return row('Mehrzeilig','<input type="checkbox" id="pTbMulti"'+(w.multi?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Textfeld statt Zeile</span>')
      +row('Passwort','<input type="checkbox" id="pTbPw"'+(w.pw?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Eingabe verbergen</span>');},
    wire:function(w){
      if($('#pTbMulti'))$('#pTbMulti').onchange=function(){w.multi=this.checked||undefined;render();};
      if($('#pTbPw'))$('#pTbPw').onchange=function(){w.pw=this.checked||undefined;render();};
    },
    live:function(w,el,id,d,base,txt,on){var inp=$('[data-role=tbin]',el);if(inp&&document.activeElement!==inp)inp.value=String(d.v);},
    input:function(w,el,e){var inp=e.target.closest('[data-role=tbin]');if(!inp)return false;if(w.varId)setVar(w.varId,inp.value);return true;}
  });
