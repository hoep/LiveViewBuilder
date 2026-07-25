  // ===== Widget: RGB-Button (rgbbutton) — Farb-Preset-Taste, schreibt RGB-Integer in Variable =====
  defWidget('rgbbutton',{
    label:'RGB-Button', paletteIcon:'bulb', size:[80,80],
    defaults:function(w){w.color='#ff8800';w.label='';},
    render:function(w){
      var col=w.color||'#ff8800';
      var mine=parseInt(String(col).replace('#',''),16);if(isNaN(mine))mine=0;
      var cur=w.varId&&_lastVals[w.varId];
      var active=!!(cur&&parseInt(String(cur.v).replace(',','.'),10)===mine);
      var chk='<svg data-role="chk" class="i" style="display:'+(active?'block':'none')+';position:absolute;top:5px;right:5px;width:16px;height:16px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 2px rgba(0,0,0,.65))"><use href="#ic-check"/></svg>';
      var lbl=w.label?'<div style="position:absolute;left:4px;right:4px;bottom:5px;text-align:center;font-size:11px;line-height:1.1;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(w.label)+'</div>':'';
      return '<div data-role="swatch" style="position:absolute;inset:6px;border-radius:12px;background:'+esc(col)+';border:1px solid var(--line);box-shadow:'+(active?'0 0 0 3px var(--accent)':'none')+';cursor:pointer">'+chk+lbl+'</div>';
    },
    props:function(w){
      var col=w.color||'#ff8800';var mine=parseInt(String(col).replace('#',''),16);if(isNaN(mine))mine=0;
      return row('Farbe','<input id="pRgbCol" type="color" value="'+esc(col)+'">')
        +row('Label','<input id="pRgbLbl" value="'+esc(w.label||'')+'" placeholder="optional">')
        +row('Variable','<input id="pRgbVar" value="'+(w.varId||'')+'" placeholder="Integer-Var-ID"> <button class="btn" id="pRgbPick" style="padding:6px 8px">wählen</button>')
        +'<div class="pgh">RGB-Wert: '+mine+'</div>';
    },
    wire:function(w){
      if($('#pRgbCol'))$('#pRgbCol').oninput=function(){w.color=this.value;render();renderProps();};
      if($('#pRgbLbl'))$('#pRgbLbl').oninput=function(){w.label=this.value||undefined;render();};
      if($('#pRgbVar'))$('#pRgbVar').onchange=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pRgbPick'))$('#pRgbPick').onclick=function(){showTab('vars');_bindTarget=w.id;};
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId!==id)return;var sw=$('[data-role=swatch]',el);if(!sw)return;
      var mine=parseInt(String(w.color||'#000000').replace('#',''),16);if(isNaN(mine))mine=0;
      var active=(parseInt(String(d.v).replace(',','.'),10)===mine);
      sw.style.boxShadow=active?'0 0 0 3px var(--accent)':'none';
      var ck=$('[data-role=chk]',sw);if(ck)ck.style.display=active?'block':'none';
    },
    click:function(w,el,e){
      if(!w.varId)return false;
      var mine=parseInt(String(w.color||'#000000').replace('#',''),16);if(isNaN(mine))mine=0;
      setVar(w.varId,mine);return true;
    }
  });
