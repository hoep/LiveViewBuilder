  // ===== Widget: Stepper — Wert mit −/+ (grob & fein) an eine Variable =====
  //
  //  Universell: schreibt eine Variable in Schritten (grob und optional fein), mit Min/Max.
  //  Zeigt den formatierten Wert (Nachkommastellen/Einheit/Tausender aus den gemeinsamen
  //  Format-Einstellungen). Verallgemeinert die +/−-Logik von Thermostat/Heizplan.

  function _stpFmtStep(s){return String(s).replace('.',',');}
  defWidget('stepper',{
    label:'Stepper', paletteIcon:'meter', size:[220,72],
    defaults:function(w){w.min=0;w.max=100;w.step=1;w.label='Wert';},
    render:function(w){
      var s=(w.step!=null?w.step:1), sf=(w.stepFine!=null&&w.stepFine>0)?w.stepFine:0, fine=sf>0;
      return '<div class="stpr">'
        +(w.label!==''?'<div class="stpr-lbl">'+escL(w.label||'')+'</div>':'')
        +'<div class="stpr-row">'
          +'<button class="stpr-b" data-stp="'+(-s)+'" title="−'+_stpFmtStep(s)+'">−'+_stpFmtStep(s)+'</button>'
          +(fine?'<button class="stpr-b stpr-fine" data-stp="'+(-sf)+'" title="−'+_stpFmtStep(sf)+'">−'+_stpFmtStep(sf)+'</button>':'')
          +'<b class="stpr-val" data-role="val">–</b>'
          +(fine?'<button class="stpr-b stpr-fine" data-stp="'+sf+'" title="+'+_stpFmtStep(sf)+'">+'+_stpFmtStep(sf)+'</button>':'')
          +'<button class="stpr-b" data-stp="'+s+'" title="+'+_stpFmtStep(s)+'">+'+_stpFmtStep(s)+'</button>'
        +'</div></div>';
    },
    live:function(w,el,id,d,base,txt,on){ if(w.varId===id){var v=$('[data-role=val]',el);if(v)v.textContent=txt;} },
    click:function(w,el,e){
      var b=e.target.closest('[data-stp]'); if(!b)return false;
      var delta=parseFloat(b.getAttribute('data-stp')); if(!isFinite(delta))return false;
      var d=w.varId&&_lastVals[w.varId]; var cur=d?parseFloat(d.v):(w.min!=null?w.min:0); if(!isFinite(cur))cur=(w.min!=null?w.min:0);
      var nv=cur+delta;
      if(w.min!=null&&nv<w.min)nv=w.min; if(w.max!=null&&nv>w.max)nv=w.max;
      var p=(String(Math.abs(delta)).split('.')[1]||'').length; nv=parseFloat(nv.toFixed(Math.min(6,p)));
      if(w.varId)setVar(w.varId,nv);
      return true;
    },
    props:function(w){
      return row('Min','<input id="pStMin" type="number" step="any" value="'+(w.min!=null?w.min:'')+'" placeholder="leer = aus">')
        +row('Max','<input id="pStMax" type="number" step="any" value="'+(w.max!=null?w.max:'')+'" placeholder="leer = aus">')
        +row('Schritt grob','<input id="pStStep" type="number" step="any" value="'+(w.step!=null?w.step:1)+'">')
        +row('Schritt fein','<input id="pStFine" type="number" step="any" value="'+(w.stepFine!=null?w.stepFine:'')+'" placeholder="leer = aus">');
    },
    wire:function(w){
      if($('#pStMin'))$('#pStMin').oninput=function(){w.min=this.value===''?undefined:parseFloat(this.value);commit();};
      if($('#pStMax'))$('#pStMax').oninput=function(){w.max=this.value===''?undefined:parseFloat(this.value);commit();};
      if($('#pStStep'))$('#pStStep').oninput=function(){w.step=parseFloat(this.value)||1;render();commit();};
      if($('#pStFine'))$('#pStFine').oninput=function(){w.stepFine=this.value===''?undefined:(parseFloat(this.value)||undefined);render();commit();};
    }
  });
