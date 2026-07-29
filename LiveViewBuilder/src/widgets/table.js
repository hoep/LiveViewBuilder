  // ===== Widget: table — Datentabelle (Privycs console-kit Look) aus Text-Variable (JSON o. serialized), [Zeile][Spalte], Zeile 0 = Kopf =====
  function _tblChev(state){ // 'asc' | 'desc' | 'idle'
    if(state==='asc')return '<span class="tbl-chev on"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></span>';
    if(state==='desc')return '<span class="tbl-chev on"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>';
    return '<span class="tbl-chev idle"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/></svg></span>';
  }
  function _tblIsNum(s){return /\d/.test(s)&&/^[+-]?[\d.,:\/\s%°$€mkKMGhWkwhAV-]*$/.test(String(s));}
  function _tblCmp(a,b){var na=parseFloat(String(a).replace(',','.')),nb=parseFloat(String(b).replace(',','.'));
    if(!isNaN(na)&&!isNaN(nb)&&/^[+-]?[\d.,\s]+$/.test(String(a))&&/^[+-]?[\d.,\s]+$/.test(String(b)))return na-nb;
    return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});}
  function _tblEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||((_popup&&$('#ovcanvas'))?$('.w[data-id="'+w.id+'"]',$('#ovcanvas')):null);}
  function _tblLoad(w){ // aus Live-Wert (JSON schnell) oder per Endpunkt (serialized/robust)
    if(!w.varId){w._tblRows=[];_tblDraw(w);return;}
    var lv=_lastVals[w.varId];
    if(lv&&typeof lv.v==='string'){var s=lv.v.trim();if(s&&(s[0]==='['||s[0]==='{')){try{var j=JSON.parse(s);if(j&&j.length!=null){w._tblRows=_tblNorm(j);_tblDraw(w);return;}}catch(e){}}}
    _tblFetch(w);
  }
  function _tblFetch(w){if(!w.varId)return;fetch('?api=tabledata&id='+w.varId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){w._tblRows=(j&&j.rows)||[];_tblDraw(w);}).catch(function(){});}
  function _tblNorm(a){return a.map(function(row){return (row&&row.length!=null&&typeof row!=='string')?row.map(function(c){return c==null?'':(c===true?'1':(c===false?'0':String(c)));}):[row==null?'':String(row)];});}
  function _tblDraw(w){
    var el=_tblEl(w);if(!el)return;var root=$('[data-role=tblroot]',el);if(!root)return;
    var rows=w._tblRows||[],head=rows.length?rows[0]:[],body=rows.slice(1);
    var cols=head.length||(body[0]?body[0].length:0);
    var view=w._tblView||w.tblView||'table';
    // Sortierung
    if(w._tblSortCol!=null&&w._tblSortCol<cols){var c=w._tblSortCol,dir=(w._tblSortDir==='desc')?-1:1;
      body=body.slice().sort(function(ra,rb){return _tblCmp(ra[c]!=null?ra[c]:'',rb[c]!=null?rb[c]:'')*dir;});}
    var total=body.length,ps=(w.pageSize>0?w.pageSize:0),paged=body,from=1,to=total,page=0,pages=1;
    if(ps>0&&total>ps){pages=Math.ceil(total/ps);page=Math.max(0,Math.min(w._tblPage||0,pages-1));w._tblPage=page;from=page*ps+1;to=Math.min((page+1)*ps,total);paged=body.slice(page*ps,page*ps+ps);}
    // numerische Spalten (mono)
    var numc=[];for(var ci=0;ci<cols;ci++){var alln=body.length>0;for(var ri=0;ri<body.length;ri++){if(!_tblIsNum(body[ri][ci]!=null?body[ri][ci]:'')){alln=false;break;}}numc[ci]=alln;}
    // Kopf: Titel + Zähler + rechts Seg-Toggle + Pager
    var pager=(ps>0&&total>ps)?('<div class="tbl-pager"><button class="tbl-pg" data-tbl-page="prev"'+(page<=0?' disabled':'')+'>&#8249;</button><span class="tbl-pgtxt">'+from+'&ndash;'+to+' von '+total+'</span><button class="tbl-pg" data-tbl-page="next"'+(page>=pages-1?' disabled':'')+'>&#8250;</button></div>'):'';
    var seg=w.hideToggle?'':('<div class="seg"><button class="seg-b'+(view==='table'?' on':'')+'" data-tbl-view="table">Tabelle</button><button class="seg-b'+(view==='cards'?' on':'')+'" data-tbl-view="cards">Karten</button></div>');
    var ph='<div class="ph"><div><h3>'+esc(w.label||'Tabelle')+'</h3><div class="ph-sub">'+total+' '+(total===1?'Eintrag':'Einträge')+'</div></div><div class="ph-right">'+seg+pager+'</div></div>';
    var bodyHtml;
    if(!rows.length||!cols){bodyHtml='<div class="tbl-empty">'+(w.varId?'Keine Daten (Zeile 0 = Spaltenkopf, JSON o. serialisiertes Array)':'Variable wählen')+'</div>';}
    else if(view==='cards'){
      bodyHtml=total?('<div class="tbl-cards">'+paged.map(function(r){return '<div class="tbl-card">'+head.map(function(h,ci){return '<div class="tc-row"><span class="tc-k">'+esc(h)+'</span><span class="tc-v'+(numc[ci]?' tbl-mono':'')+'">'+esc(r[ci]!=null?r[ci]:'')+'</span></div>';}).join('')+'</div>';}).join('')+'</div>'):'<div class="tbl-empty">Keine Zeilen</div>';
    }else{
      var thead='<thead><tr>'+head.map(function(h,ci){var st=(w._tblSortCol===ci)?(w._tblSortDir==='desc'?'desc':'asc'):'idle';return '<th><button class="tbl-sort" data-tbl-sort="'+ci+'">'+esc(h)+_tblChev(st)+'</button></th>';}).join('')+'</tr></thead>';
      var tbody='<tbody>'+(total?paged.map(function(r){return '<tr>'+head.map(function(h,ci){return '<td'+(numc[ci]?' class="tbl-mono"':'')+'>'+esc(r[ci]!=null?r[ci]:'')+'</td>';}).join('')+'</tr>';}).join(''):'<tr><td colspan="'+cols+'"><div class="tbl-empty">Keine Zeilen</div></td></tr>')+'</tbody>';
      bodyHtml='<div class="tbl-scroll"><table class="tbl">'+thead+tbody+'</table></div>';
    }
    root.innerHTML='<div class="panel">'+ph+bodyHtml+'</div>';
  }
  var _tblT={};
  defWidget('table',{
    label:'Tabelle', paletteIcon:'wtable', size:[420,260],
    defaults:function(w){w.label='Tabelle';w.pageSize=10;w.tblView='table';},
    render:function(w){return '<div data-role="tblroot" style="position:absolute;inset:0"></div>';},
    mount:function(w){_tblLoad(w);},
    props:function(w){return row('Zeilen/Seite','<input id="pTblPS" type="number" min="0" value="'+(w.pageSize>0?w.pageSize:0)+'" title="0 = keine Paginierung">')
      +row('Start-Ansicht','<select id="pTblView"><option value="table"'+((w.tblView||'table')==='table'?' selected':'')+'>Tabelle</option><option value="cards"'+(w.tblView==='cards'?' selected':'')+'>Karten</option></select>')
      +row('Umschalter ausblenden','<input type="checkbox" id="pTblNoSw"'+(w.hideToggle?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">feste Start-Ansicht</span>')
      +'<div class="hint" style="font-size:11px;margin-top:6px">Quelle: Text-Variable mit <b>JSON</b> oder <b>serialisiertem Array</b> im Format [Zeile][Spalte]. <b>Zeile 0 = Spaltenkopf</b>.</div>';},
    wire:function(w){
      if($('#pTblPS'))$('#pTblPS').oninput=function(){w.pageSize=parseInt(this.value)||0;w._tblPage=0;_tblDraw(w);commit();};
      if($('#pTblView'))$('#pTblView').onchange=function(){w.tblView=this.value;w._tblView=this.value;_tblDraw(w);commit();};
      if($('#pTblNoSw'))$('#pTblNoSw').onchange=function(){w.hideToggle=this.checked||undefined;_tblDraw(w);commit();};
    },
    click:function(w,el,e){
      var sb=e.target.closest('[data-tbl-sort]');if(sb){var i=parseInt(sb.getAttribute('data-tbl-sort'));if(w._tblSortCol===i){w._tblSortDir=(w._tblSortDir==='asc')?'desc':'asc';}else{w._tblSortCol=i;w._tblSortDir='asc';}w._tblPage=0;_tblDraw(w);return true;}
      var pg=e.target.closest('[data-tbl-page]');if(pg){if(pg.hasAttribute('disabled'))return true;w._tblPage=Math.max(0,(w._tblPage||0)+(pg.getAttribute('data-tbl-page')==='next'?1:-1));_tblDraw(w);return true;}
      var vb=e.target.closest('[data-tbl-view]');if(vb){w._tblView=vb.getAttribute('data-tbl-view');_tblDraw(w);return true;}
      return false;
    },
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){if(_tblT[w.id])clearTimeout(_tblT[w.id]);_tblT[w.id]=setTimeout(function(){_tblLoad(w);},300);}}
  });
