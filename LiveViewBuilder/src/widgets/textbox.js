  // ===== Widget: Eingabefeld (textbox) — schreibt Benutzereingabe in String-Variable =====
  defWidget('textbox',{
    label:'Eingabe', paletteIcon:'wcode', size:[220,52],
    render:function(w){var v=(w.varId&&_lastVals[w.varId])?String(_lastVals[w.varId].v):'';
      var st='position:absolute;inset:0;width:100%;height:100%;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);box-sizing:border-box;font-family:var(--fu,inherit)';
      if(w.multi)return '<textarea data-role="tbin" placeholder="'+esc(w.label||'')+'" style="'+st+';font-size:13px;padding:8px;resize:none">'+esc(v)+'</textarea>';
      return '<input data-role="tbin" type="'+(w.pw?'password':'text')+'" value="'+esc(v)+'" placeholder="'+esc(w.label||'')+'" style="'+st+';font-size:14px;padding:0 10px">';},
    props:function(w){return row('Variable','<input id="pTbVar" value="'+(w.varId||'')+'" placeholder="String-ID"> <button class="btn" id="pTbPick" style="padding:6px 8px">wählen</button>')
      +row('Mehrzeilig','<input type="checkbox" id="pTbMulti"'+(w.multi?' checked':'')+'>')
      +row('Passwort','<input type="checkbox" id="pTbPw"'+(w.pw?' checked':'')+'>');},
    wire:function(w){
      if($('#pTbVar'))$('#pTbVar').onchange=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pTbPick'))$('#pTbPick').onclick=function(){showTab('vars');_bindTarget=w.id;};
      if($('#pTbMulti'))$('#pTbMulti').onchange=function(){w.multi=this.checked||undefined;render();};
      if($('#pTbPw'))$('#pTbPw').onchange=function(){w.pw=this.checked||undefined;render();};
    },
    live:function(w,el,id,d,base,txt,on){var inp=$('[data-role=tbin]',el);if(inp&&document.activeElement!==inp)inp.value=String(d.v);},
    input:function(w,el,e){var inp=e.target.closest('[data-role=tbin]');if(!inp)return false;if(w.varId)setVar(w.varId,inp.value);return true;}
  });
