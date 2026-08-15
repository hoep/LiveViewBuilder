  // ===== Widget: Linie (line) — Richtung, Breite, optionale Pfeilspitzen =====
  defWidget('line',{
    label:'Linie', cat:'Grundelemente', paletteIcon:'wline', size:[160,60],
    render:function(w){var dir=w.ldir||'h',c=(w.color||'#00cdab'),lw=(w.lw||3);
      var pts={h:[4,50,96,50],v:[50,4,50,96],d:[4,4,96,96]}[dir]||[4,50,96,50];
      var mid='lm'+w.id,defs='',m1='',m2='';
      if(w.arrowE){defs+='<marker id="'+mid+'e" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="'+c+'"/></marker>';m2=' marker-end="url(#'+mid+'e)"';}
      if(w.arrowS){defs+='<marker id="'+mid+'s" markerWidth="6" markerHeight="6" refX="2" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6 z" fill="'+c+'"/></marker>';m1=' marker-start="url(#'+mid+'s)"';}
      return '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><defs>'+defs+'</defs><line x1="'+pts[0]+'" y1="'+pts[1]+'" x2="'+pts[2]+'" y2="'+pts[3]+'" stroke="'+c+'" stroke-width="'+lw+'" stroke-linecap="round"'+m1+m2+'/></svg>';},
    props:function(w){return row('Richtung','<select id="pLDir"><option value="h"'+((w.ldir||'h')==='h'?' selected':'')+'>horizontal</option><option value="v"'+(w.ldir==='v'?' selected':'')+'>vertikal</option><option value="d"'+(w.ldir==='d'?' selected':'')+'>diagonal</option></select>')
      +row('Breite (px)','<input id="pLW" type="number" step="0.5" value="'+(w.lw||3)+'">')
      +row('Pfeile','<label style="font-size:12px"><input type="checkbox" id="pArrS"'+(w.arrowS?' checked':'')+'> Start</label> &nbsp; <label style="font-size:12px"><input type="checkbox" id="pArrE"'+(w.arrowE?' checked':'')+'> Ende</label>');},
    wire:function(w){
      if($('#pLDir'))$('#pLDir').onchange=function(){w.ldir=this.value;render();};
      if($('#pLW'))$('#pLW').oninput=function(){w.lw=parseFloat(this.value)||3;render();};
      if($('#pArrS'))$('#pArrS').onchange=function(){w.arrowS=this.checked||undefined;render();};
      if($('#pArrE'))$('#pArrE').onchange=function(){w.arrowE=this.checked||undefined;render();};
    }
  });
