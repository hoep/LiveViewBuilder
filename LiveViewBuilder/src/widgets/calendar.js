// calendar — Kalender
defWidget('calendar',{
  label:'Kalender',
  paletteIcon:'calendar',
  size:[210,180],
  render:function(w){
    return '<div class="hcal" data-role="cal"></div>';
  },
  props:function(w){
    return row('Kalender-IDs','<input id="pCalIds" value="'+esc(w.calIds||'')+'" placeholder="33020,55959">')+row('Tage','<input id="pCalDays" type="number" value="'+(w.days||14)+'">')+row('Ansicht','<select id="pCalView"><option value="agenda"'+((w.calview||'agenda')==='agenda'?' selected':'')+'>Agenda</option><option value="month"'+(w.calview==='month'?' selected':'')+'>Monat</option></select>');
  },
  wire:function(w){
    if($('#pCalIds'))$('#pCalIds').oninput=function(){w.calIds=this.value;render();};
    if($('#pCalDays'))$('#pCalDays').oninput=function(){w.days=parseInt(this.value)||14;render();};
    if($('#pCalView'))$('#pCalView').onchange=function(){w.calview=this.value;render();};
  }
});
