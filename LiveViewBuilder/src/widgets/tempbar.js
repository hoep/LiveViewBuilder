  // ===== Widget: Temp-Säule (tempbar) — vertikale Temperatur-Säule mit Soll-Marke und Pill =====
  defWidget('tempbar',{
    label:'Temp-Säule', paletteIcon:'temperature', size:[110,190],
    defaults:function(w){w.label='EG';w.min=16;w.max=24;w.soll=22;w.pill='Komfort';w.pillState='ok';},
    render:function(w){var tmn=(w.min!=null?w.min:16),tmx=(w.max!=null?w.max:24),sp=(w.soll!=null?Math.max(0,Math.min(100,(w.soll-tmn)/((tmx-tmn)||1)*100)):null);return '<div class="htemp'+(w.warm?' warm':'')+'"><div class="htval" data-role="val">–</div><div class="htbarwrap"><div class="htscale"><span>'+tmx+'</span><span>'+tmn+'</span></div><div class="htbar"><i class="htfill" data-role="fill"></i>'+(sp!=null?'<i class="htsoll" style="bottom:'+sp+'%"></i>':'')+'</div></div><div class="htzn">'+escL(w.label||'')+'</div>'+(w.pill?'<span class="hpill '+(w.pillState||'ok')+'"><span class="hpd"></span>'+esc(w.pill)+'</span>':'')+'</div>';},
    props:function(w){return (row('Soll','<input id="pSoll" type="number" step="0.5" value="'+(w.soll!=null?w.soll:22)+'">')+row('Badge','<input id="pPill" value="'+esc(w.pill||'')+'">')+row('Status','<select id="pPillState">'+[['ok','OK'],['warn','Warnung'],['crit','Kritisch'],['on','An'],['off','Aus']].map(function(o){return '<option value="'+o[0]+'"'+((w.pillState||'ok')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')+row('Warm','<label style="font-size:12px"><input type="checkbox" id="pWarm"'+(w.warm?' checked':'')+'> warme Farbe</label>'));},
    wire:function(w){
      if($('#pSoll'))$('#pSoll').oninput=function(){w.soll=this.value===''?undefined:parseFloat(this.value);render();};
      if($('#pPill'))$('#pPill').oninput=function(){w.pill=this.value;render();};
      if($('#pPillState'))$('#pPillState').onchange=function(){w.pillState=this.value;render();};
      if($('#pWarm'))$('#pWarm').onchange=function(){w.warm=this.checked||undefined;render();};
    },
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){var tv=$('[data-role=val]',el);if(tv)tv.textContent=txt;var tmn=(w.min!=null?w.min:16),tmx=(w.max!=null?w.max:24),nv=parseFloat(String(d.v).replace(',','.')),ff=$('[data-role=fill]',el);if(ff&&!isNaN(nv))ff.style.height=Math.max(0,Math.min(100,(nv-tmn)/((tmx-tmn)||1)*100))+'%';}return;}
  });
