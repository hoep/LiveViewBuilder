  // ===== Widget: Form (shape) — Rechteck/Kreis/Linie, mit Kontur & Eckenradius =====
  defWidget('shape',{
    label:'Form', cat:'Grundelemente', paletteIcon:'wshape', size:[80,80],
    render:function(w){var sc=w.color||'#1b2a30',sh=w.shape||'rect';var brd=(w.stroke&&w.strokeW>0)?('border:'+w.strokeW+'px solid '+w.stroke+';'):'';
      if(sh==='line')return '<div style="position:absolute;left:0;right:0;top:50%;height:'+(w.strokeW||3)+'px;transform:translateY(-50%);background:'+(w.stroke||sc)+';border-radius:3px"></div>';
      var rad=(sh==='circle')?'50%':((w.radius!=null?w.radius:8)+'px');
      return '<div style="position:absolute;inset:0;background:'+sc+';border-radius:'+rad+';'+brd+'box-sizing:border-box"></div>';},
    props:function(w){return row('Form',selOf('pShape',w.shape,['rect','circle','line']))
      +(w.shape!=='line'?row('Kontur','<input id="pShStroke" type="color" value="'+(w.stroke||'#25333a')+'"> <input id="pShStrokeW" type="number" style="width:52px" value="'+(w.strokeW||0)+'" title="Breite"> <button class="btn" id="pShStrokeX" style="padding:5px 8px" title="keine Kontur"><svg class="i"><use href="#ic-minus"/></svg></button>'):'')
      +((w.shape!=='circle'&&w.shape!=='line')?row('Eckenradius','<input id="pShRad" type="number" value="'+(w.radius!=null?w.radius:8)+'">'):'');},
    wire:function(w){
      if($('#pShape'))$('#pShape').onchange=function(){w.shape=this.value;render();renderProps();};
      if($('#pShStroke'))$('#pShStroke').oninput=function(){w.stroke=this.value;if(!w.strokeW)w.strokeW=2;render();};
      if($('#pShStrokeW'))$('#pShStrokeW').oninput=function(){w.strokeW=parseInt(this.value)||0;render();};
      if($('#pShStrokeX'))$('#pShStrokeX').onclick=function(){delete w.stroke;delete w.strokeW;render();renderProps();};
      if($('#pShRad'))$('#pShRad').oninput=function(){w.radius=this.value===''?undefined:parseInt(this.value);render();};
    }
  });
