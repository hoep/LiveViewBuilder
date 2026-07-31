  // ===== Widget: Objekt-Info (objinfo) — Metadaten eines IPS-Objekts =====
  defWidget('objinfo',{
    label:'Objekt-Info', paletteIcon:'info', size:[230,60],
    defaults:function(w){w.field='updated';},
    render:function(w){return '<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:8px 12px;min-width:0"><div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-role="oiname">'+escL(w.label||'Objekt')+'</div><div style="font-size:15px;color:var(--text);font-family:var(--fm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-role="oival">–</div></div>';},
    props:function(w){return row('Objekt-ID','<input id="pOiId" value="'+(w.objId||'')+'" placeholder="ID"> <button class="btn" id="pOiPick" style="padding:6px 8px">wählen</button>')
      +row('Feld','<select id="pOiField"><option value="updated"'+((w.field||'updated')==='updated'?' selected':'')+'>Letzte Aktualisierung</option><option value="changed"'+(w.field==='changed'?' selected':'')+'>Letzte Änderung</option><option value="next"'+(w.field==='next'?' selected':'')+'>Nächster Lauf</option><option value="last"'+(w.field==='last'?' selected':'')+'>Letzter Lauf</option><option value="name"'+(w.field==='name'?' selected':'')+'>Objektname</option></select>');},
    wire:function(w){
      if($('#pOiId'))$('#pOiId').onchange=function(){w.objId=parseInt(this.value)||0;render();fetchObjInfo(w);};
      if($('#pOiPick'))$('#pOiPick').onclick=function(){showTab('vars');_bindObj=w.id;};
      if($('#pOiField'))$('#pOiField').onchange=function(){w.field=this.value;render();fetchObjInfo(w);};
    }
  });
