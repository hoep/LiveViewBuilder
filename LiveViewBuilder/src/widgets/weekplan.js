  // ===== Widget: Wochenplan (weekplan) — Wochenplan-Grid aus Symcon-Variable =====
  defWidget('weekplan',{
    label:'Wochenplan', cat:'Anzeige', paletteIcon:'calendar', size:[340,180],
    defaults:function(w){w.label='Wochenplan';},
    render:function(w){var nc=(_skinColor(w.nowColor||'warn')||'var(--warn)'); // Farbe der „jetzt"-Markierung (Default: Warnung)
      return '<div class="hwp" style="--wp-now:'+nc+'"><div class="hwphd">'+escL(w.label||'Wochenplan')+'</div><div class="hwpgrid" data-role="wpgrid"><div class="hwpempty">lädt …</div></div>'
      // Zeitleiste am Kachel-Token statt fester 10px, Innenabstand aus der Kachelgroesse.
      +(w.showTimes?'<div data-role="wptimes" style="font-size:var(--wf-cap);color:var(--muted);padding:clamp(2px,1.5cqmin,6px) clamp(6px,3cqmin,12px) 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>':'')+'</div>';},
    props:function(w){return row('Schaltzeiten (heute)','<input type="checkbox" id="pWpTimes"'+(w.showTimes?' checked':'')+'>')
      +row('Markierung „jetzt"',(function(){var SK=[['warn','Warnung'],['crit','Alert'],['accent','Akzent'],['ok','OK'],['info','Info'],['text','Neutral']],cur=w.nowColor||'warn';
        return '<span class="iconsw" data-role="wpnowsw">'+SK.map(function(c){return '<button type="button" class="iconswb'+(cur===c[0]?' on':'')+'" data-skin="'+c[0]+'" title="'+esc(c[1])+'" style="background:var(--'+c[0]+')"></button>';}).join('')+'</span>';})())
      +'<div class="pgh">Farben je Zustand (überschreibt Event)</div>'
      +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Zustands-Name aus dem Symcon-Wochenplan · Farbe: #hex oder accent/ok/warn/crit/info</div>'
      +listEditor(w,'colors','Zustand · Farbe',[{k:'name',ph:'Zustand (z. B. Pumpe läuft)'},{k:'color',type:'skincolor'}]);},
    wire:function(w){if($('#pWpTimes'))$('#pWpTimes').onchange=function(){w.showTimes=this.checked||undefined;render();fetchWeekplan(w);};
      $$('#props [data-role=wpnowsw] [data-skin]').forEach(function(b){b.onclick=function(){w.nowColor=this.getAttribute('data-skin')||undefined;render();renderProps();fetchWeekplan(w);commit();};});}
  });
