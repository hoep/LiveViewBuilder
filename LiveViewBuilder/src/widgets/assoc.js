  // ===== Widget: Zustand (assoc) — zeigt den aktuellen Zustand als Icon und/oder Text =====
  // Nutzt manuelle Zuordnungen (amap: Wert·Icon·Text·Farbe) und/oder die Profil-Assoziationen der Variable.
  function _assocEq(a,b){if(String(a)===String(b))return true;var t=function(x){return x===true||x===1||x==='1'||x==='true';},f=function(x){return x===false||x===0||x==='0'||x==='false';};return (t(a)&&t(b))||(f(a)&&f(b));}
  // Erweiterter Vergleich: Operatoren (>0 >=1 <5 <=3 !=0 =2), Bereiche (1..5 / 1:5) und Platzhalter (* / else). Sonst exakter/boolescher Vergleich.
  function _assocMatch(pat,v){
    if(pat==null)return false;var p=String(pat).trim();
    if(p==='')return false;                                     // leere Zeile matcht nichts
    if(p==='*'||/^(else|sonst|default|rest|any)$/i.test(p))return true;  // expliziter Platzhalter
    var num=function(x){return parseFloat(String(x).replace(',','.'));},n=num(v);
    var op=p.match(/^(>=|<=|!=|<>|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(op){if(isNaN(n))return false;var t=num(op[2]);switch(op[1]){case '>':return n>t;case '<':return n<t;case '>=':return n>=t;case '<=':return n<=t;case '!=':case '<>':return n!==t;case '=':return n===t;}}
    var rg=p.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:\.\.|:)\s*(-?\d+(?:[.,]\d+)?)$/);
    if(rg){if(isNaN(n))return false;var a=num(rg[1]),b=num(rg[2]);return n>=Math.min(a,b)&&n<=Math.max(a,b);}
    return _assocEq(pat,v);
  }
  function _assocWid(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(!el)return;
    var d=w.varId&&_lastVals[w.varId],v=d?d.v:null;
    var m=(w.amap||[]).filter(function(e){return _assocEq(e.v,v);})[0]      // exakter Treffer zuerst
        ||(w.amap||[]).filter(function(e){return _assocMatch(e.v,v);})[0];   // dann Operator/Bereich/Platzhalter
    var a=(!m)?assocFor(w,v):null,rr=a?assocResolved(w,a):null;
    var icon=(m&&m.icon)||(rr&&rr.icon)||w.icon||'';
    // NUR Skin-Farben (passt sich dem Theme an): manuelle/semantische Auswahl sonst Standard-Textfarbe
    var ovc=(m&&m.color)||(a&&w.assocMap&&w.assocMap[String(a.v)]?w.assocMap[String(a.v)].color:'');
    var color=_skinColor(ovc)||'var(--text)';
    var text=(m&&m.text!=null&&m.text!=='')?m.text:((d&&d.f!=null&&d.f!=='')?d.f:((a&&a.name!=null)?a.name:(d?String(d.v):'–')));
    var ic=el.querySelector('[data-role=aico]');if(ic){ic.innerHTML=icon?iconSVG(icon,v):'';ic.style.color=color;}
    var tx=el.querySelector('[data-role=atx]');if(tx){tx.textContent=(text==null||text==='')?'–':text;tx.style.color=color;}
  }
  defWidget('assoc',{
    label:'Zustand', paletteIcon:'toggleon', size:[130,120],
    defaults:function(w){w.assocShow='both';},
    render:function(w){var s=w.assocShow||'both';return '<div class="hassoc'+(s==='both'?'':' one')+'"><span class="hassocic" data-role="aico"'+(s==='text'?' style="display:none"':'')+'>'+(w.icon?iconSVG(w.icon):'')+'</span><span class="hassoctx" data-role="atx"'+(s==='icon'?' style="display:none"':'')+'>'+esc(w.label||'–')+'</span></div>';},
    props:function(w){return row('Anzeige','<select id="pAsShow"><option value="both"'+((w.assocShow||'both')==='both'?' selected':'')+'>Icon + Text</option><option value="icon"'+(w.assocShow==='icon'?' selected':'')+'>Nur Icon</option><option value="text"'+(w.assocShow==='text'?' selected':'')+'>Nur Text</option></select>')
      +listEditor(w,'amap','Manuell: Wert · Icon · Text · Farbe',[{k:'v',ph:'0, >0, 1..5, *'},{k:'icon',ph:'z.B. winopen'},{k:'text',ph:'Text'},{k:'color',ph:'ok/warn/crit/text'}])
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Wert: exakt (<b>0</b>, <b>1</b>), Vergleich (<b>&gt;0</b>, <b>&gt;=1</b>, <b>&lt;5</b>, <b>!=0</b>), Bereich (<b>1..5</b>) oder Platzhalter (<b>*</b> = Rest). Exakte Treffer haben Vorrang. Ganz ohne Zeilen = Profil-Assoziationen der Variable. Icons z. B. winopen/winclosed/wintilt, blindopen/blindclosed, lighton/lightoff.</div>';},
    wire:function(w){if($('#pAsShow'))$('#pAsShow').onchange=function(){w.assocShow=this.value;render();refreshAssocLive(w);commit();};},
    mount:function(w){if(w.varId)loadAssoc(w.varId,function(){_assocWid(w);});else _assocWid(w);},
    live:function(w,el,id,d,base,txt,on){if(w.varId===id)_assocWid(w);return true;}
  });
