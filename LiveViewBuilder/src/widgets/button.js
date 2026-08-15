  // ===== Widget: Button — Icon-Badge, Zustands-Styling (Ein/Aus) =====
  defWidget('button',{
    label:'Button', paletteIcon:'power', size:[110,110],
    render:function(w){return '<div class="hbtn"><div class="hbicon" data-role="badge">'+iconSVG(w.icon||'power')+'</div>'+(w.label?'<div class="hblabel">'+escL(w.label)+'</div>':'')+'</div>';},
    // Kommando-/Aktions-Button: ist "Bei Klick Wert" gesetzt, schreibt ein Klick diesen festen
    // Wert an die gebundene Variable (momentanes Kommando, z. B. Mäher Start/Park). Sonst
    // greift das generische Verhalten (Seite/Popup/Variable-Toggle).
    click:function(w,el,e){
      if(w.tapVal!=null&&w.tapVal!==''&&w.varId){
        var v=String(w.tapVal);
        setVar(w.varId, /^-?\d+(?:\.\d+)?$/.test(v)?parseFloat(v):w.tapVal);
        return true;
      }
      return false;
    },
    props:function(w){return btnStateProps(w)
      +row('Bei Klick Wert','<input id="pTapVal" value="'+esc(w.tapVal!=null?w.tapVal:'')+'" placeholder="z. B. 1 – schreibt an gebundene Variable"> <span style="font-size:11px;color:var(--muted)">leer = Umschalten</span>');},
    wire:function(w){btnStateWire(w);
      if($('#pTapVal'))$('#pTapVal').oninput=function(){w.tapVal=this.value!==''?this.value:undefined;commit();};},
    live:function(w,el,id,d,base,txt,on){var b=$('[data-role=badge]',el);if(b)b.classList.toggle('on',on);var tv=$('[data-role=val]',el);if(tv)tv.textContent=txt;applyBtnState(w,el,on);}
  });
