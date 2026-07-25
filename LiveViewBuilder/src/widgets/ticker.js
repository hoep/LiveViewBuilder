  // ===== Widget: Laufzeile (Ticker) — Alarm-/Meldungslaufband =====
  // Jede Zeile ist entweder statischer Text ODER ein Live-Wert (Feld "vid" = VarID).
  // Live-Werte laufen dank data-vid automatisch im Band mit (Profil-Formatierung inkl. Einheit).
  defWidget('ticker',{
    label:'Laufzeile', paletteIcon:'wticker', size:[560,46],
    defaults:function(w){w.label='Alarm';w.speed=46;w.items=[{sev:'warn',icon:'window',text:'2 Fenster offen',sub:'Bad OG · Küche EG'},{sev:'info',icon:'washer',text:'Waschmaschine läuft',sub:'Restzeit 0:42'},{sev:'warn',icon:'trash',text:'Restmüll morgen',sub:''},{sev:'ok',icon:'shield',text:'Alarm unscharf',sub:''}];},
    render:function(w){
      var its=w.items||[],crit=its.filter(function(m){return (m.sev||'')==='crit';}).length,
      itm=its.map(function(m){
        var val=m.vid?'<b data-vid="'+esc(String(m.vid))+'">'+esc(m.val||'–')+'</b>':'';
        return '<span class="htm '+esc(m.sev||'info')+'"><span class="htdot"></span>'
          +(m.icon?'<span class="htic">'+iconSVG(m.icon)+'</span>':'')
          +(m.text?'<b>'+esc(m.text||'')+'</b>':'')
          +(val?(m.text?' ':'')+val:'')
          +(m.sub?' <small>'+esc(m.sub)+'</small>':'')+'</span>';
      }).join('');
      return '<div class="htick'+(crit===0?' ok':'')+'"><div class="htlead"><span class="htpulse"></span>'+esc(w.label||'Alarm')+'<span class="htcnt">'+crit+'</span></div><div class="httrack"><div class="htmove" style="animation-duration:'+(w.speed||46)+'s">'+itm+itm+'</div></div></div>';
    },
    props:function(w){return row('Tempo (s)','<input id="pSpeed" type="number" min="8" value="'+(w.speed||46)+'">')+listEditor(w,'items','Zeilen: Schwere (crit/warn/ok/info) · Icon · Text · VarID (leer=statisch) · Zusatz',[{k:'sev',ph:'sev'},{k:'icon',ph:'icon'},{k:'text',ph:'Text'},{k:'vid',ph:'VarID'},{k:'sub',ph:'Zusatz'}]);},
    wire:function(w){if($('#pSpeed'))$('#pSpeed').oninput=function(){w.speed=parseInt(this.value)||46;render();};}
  });
