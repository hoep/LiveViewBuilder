  // ===== Widget: table — Datentabelle (Privycs console-kit Look) aus Text-Variable (JSON o. serialized), [Zeile][Spalte], Zeile 0 = Kopf =====
  function _tblChev(state){ // 'asc' | 'desc' | 'idle'
    // Groesse in em statt fest 12px: die Pfeile folgen damit der Schriftgroesse der Kopfzeile
    // (die wiederum aus styles.css kommt). viewBox und Klassen bleiben unveraendert.
    if(state==='asc')return '<span class="tbl-chev on"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></span>';
    if(state==='desc')return '<span class="tbl-chev on"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>';
    return '<span class="tbl-chev idle"><svg style="width:1em;height:1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/></svg></span>';
  }
  function _tblIsNum(s){return /\d/.test(s)&&/^[+-]?[\d.,:\/\s%°$€mkKMGhWkwhAV-]*$/.test(String(s));}
  function _tblCmp(a,b){var na=parseFloat(String(a).replace(',','.')),nb=parseFloat(String(b).replace(',','.'));
    if(!isNaN(na)&&!isNaN(nb)&&/^[+-]?[\d.,\s]+$/.test(String(a))&&/^[+-]?[\d.,\s]+$/.test(String(b)))return na-nb;
    return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});}
  // Kollisions-sichere Elementsuche (Seite vs. Popup/Hover). Widget-IDs sind nur JE SEITE
  // eindeutig - dieselbe automatisch vergebene ID (w141 …) kommt auf mehreren Seiten vor,
  // auch als KIND in einem Container. Wer stur "canvas zuerst" nimmt, erwischt dann die
  // fremde Kachel, findet dort kein [data-role=tblroot] und zeichnet gar nichts: die
  // Tabelle im Popup blieb leer, waehrend dieselbe Seite einzeln aufgerufen lief.
  // Deshalb: ALLE Kandidaten sammeln, aktiven Kontext (Popup/Hover) zuerst, und das
  // Element nehmen, das wirklich einen Tabellen-Rumpf enthaelt.
  function _tblEl(w){
    var cands=[],sel='.w[data-id="'+w.id+'"]';
    var oc=document.getElementById('ovcanvas'),hc=document.getElementById('hovcanvas');
    if(oc)cands=cands.concat([].slice.call(oc.querySelectorAll(sel)));
    if(hc)cands=cands.concat([].slice.call(hc.querySelectorAll(sel)));
    if(typeof canvas!=='undefined'&&canvas)cands=cands.concat([].slice.call(canvas.querySelectorAll(sel)));
    for(var i=0;i<cands.length;i++){if(cands[i].querySelector('[data-role=tblroot]'))return cands[i];}
    return cands[0]||null;
  }
  // Optionaler Status-Stil: Text -> Schweregrad; % aus Text lesen (fuer Ladebalken)
  function _tblSevOf(t){t=String(t==null?'':t).toLowerCase();
    if(/leer|schwach|kritisch|critical|empty|entladen/.test(t))return 'crit';
    if(/bald|mittel|\bwarn|niedrig|\blow\b/.test(t))return 'warn';
    if(/\bok\b|voll|gut|normal|hoch|full|geladen/.test(t))return 'ok';
    return '';}
  function _tblPctOf(t){var m=String(t==null?'':t).match(/(\d+(?:[.,]\d+)?)\s*%/);return m?parseFloat(m[1].replace(',','.')):NaN;}
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
    // Pro-Spalte: Ausrichtung (w.colAlign[ci]: 'left'|'center'|'right') + optional Roh-HTML (w.colRaw[ci])
    var anyW=!!(w.colW&&w.colW.some(function(x){return x;}));
    // Inhaltslaenge je Spalte (HTML-Tags rausgerechnet). EINE flexible Spalte darf umbrechen: die laengste,
    // die keine feste Breite hat (sonst faellt die Wahl auf die laengste ueberhaupt). Der Rest bleibt einzeilig
    // -> so wenige Umbrueche wie moeglich, Tabelle passt in die Widget-Breite (kein Scrollen).
    var clen=[];for(var wc=0;wc<cols;wc++){var mx=String(head[wc]||'').length;for(var wr=0;wr<body.length;wr++){var s=String(body[wr][wc]!=null?body[wr][wc]:'');if(w.colRaw&&w.colRaw[wc])s=s.replace(/<[^>]*>/g,'');if(s.length>mx)mx=s.length;}clen[wc]=mx;}
    var flex=-1,fb=-1;for(var wc=0;wc<cols;wc++){if(w.colW&&w.colW[wc])continue;if(clen[wc]>fb){fb=clen[wc];flex=wc;}}
    if(flex<0){for(var wc=0;wc<cols;wc++){if(clen[wc]>fb){fb=clen[wc];flex=wc;}}}
    var alSt=function(ci){var a=w.colAlign&&w.colAlign[ci];return (a==='center'||a==='left'||a==='right')?(' style="text-align:'+a+'"'):'';};
    var tdSt=function(ci){var st='';var a=w.colAlign&&w.colAlign[ci];if(a==='center'||a==='left'||a==='right')st+='text-align:'+a+';';st+=(ci===flex)?'white-space:normal;overflow-wrap:anywhere;':'white-space:nowrap;';return ' style="'+st+'"';};
    var cellHtml=function(ci,v){return (w.colRaw&&w.colRaw[ci])?String(v==null?'':v):esc(v);};
    // Status-Stil: Status-Spalte (Chip+Streifen) und %-Spalte (Ladebalken) erkennen
    var sevIdx=-1,barIdx=-1;
    if(w.sevStyle){for(var hi=0;hi<cols;hi++){var hs=String(head[hi]||'').toLowerCase();
      if(sevIdx<0&&/status|zustand/.test(hs))sevIdx=hi;
      if(barIdx<0&&/wert|ladung|prozent|ladest|%/.test(hs))barIdx=hi;}}
    // Kopf: Titel + Zähler + rechts Seg-Toggle + Pager
    var pager=(ps>0&&total>ps)?('<div class="tbl-pager"><button class="tbl-pg" data-tbl-page="prev"'+(page<=0?' disabled':'')+'>&#8249;</button><span class="tbl-pgtxt">'+from+'&ndash;'+to+' von '+total+'</span><button class="tbl-pg" data-tbl-page="next"'+(page>=pages-1?' disabled':'')+'>&#8250;</button></div>'):'';
    var seg=w.hideToggle?'':('<div class="seg"><button class="seg-b'+(view==='table'?' on':'')+'" data-tbl-view="table">Tabelle</button><button class="seg-b'+(view==='cards'?' on':'')+'" data-tbl-view="cards">Karten</button></div>');
    var ph='<div class="ph"><div><h3>'+escL(w.label||'Tabelle')+'</h3><div class="ph-sub">'+total+' '+(total===1?'Eintrag':'Einträge')+'</div></div><div class="ph-right">'+seg+pager+'</div></div>';
    var bodyHtml;
    if(!rows.length||!cols){bodyHtml='<div class="tbl-empty">'+(w.varId?'Keine Daten (Zeile 0 = Spaltenkopf, JSON o. serialisiertes Array)':'Variable wählen')+'</div>';}
    else if(view==='cards'){
      bodyHtml=total?('<div class="tbl-cards">'+paged.map(function(r){return '<div class="tbl-card">'+head.map(function(h,ci){return '<div class="tc-row"><span class="tc-k">'+esc(h)+'</span><span class="tc-v'+(numc[ci]?' tbl-mono':'')+'"'+alSt(ci)+'>'+cellHtml(ci,r[ci]!=null?r[ci]:'')+'</span></div>';}).join('')+'</div>';}).join('')+'</div>'):'<div class="tbl-empty">Keine Zeilen</div>';
    }else{
      var thead='<thead><tr>'+head.map(function(h,ci){var st=(w._tblSortCol===ci)?(w._tblSortDir==='desc'?'desc':'asc'):'idle';var rc=(w.sevStyle&&(ci===sevIdx||ci===barIdx))?' class="r"':'';return '<th'+rc+tdSt(ci)+'><button class="tbl-sort" data-tbl-sort="'+ci+'">'+esc(h)+_tblChev(st)+'</button></th>';}).join('')+'</tr></thead>';
      var tbody='<tbody>'+(total?paged.map(function(r){
        var sev=(sevIdx>=0)?_tblSevOf(r[sevIdx]):'';
        return '<tr'+(sev?' class="tsev-'+sev+'"':'')+'>'+head.map(function(h,ci){
          var v=r[ci]!=null?r[ci]:'';
          if(w.sevStyle&&ci===sevIdx&&sev)return '<td class="r"><span class="tbl-chip tsc-'+sev+'">'+esc(v)+'</span></td>';
          if(w.sevStyle&&ci===barIdx){var p=_tblPctOf(v);
            var bar=!isNaN(p)?('<span class="tbl-mini"><span style="width:'+Math.max(2,Math.min(100,p))+'%;background:var(--'+(sev||'accent')+')"></span></span>'):'';
            return '<td class="'+(numc[ci]?'tbl-mono ':'')+'tbl-barcell r"><span'+(sev?' style="color:var(--'+sev+')"':'')+'>'+esc(v)+'</span>'+bar+'</td>';}
          return '<td'+(numc[ci]?' class="tbl-mono"':'')+tdSt(ci)+'>'+cellHtml(ci,v)+'</td>';
        }).join('')+'</tr>';}).join(''):'<tr><td colspan="'+cols+'"><div class="tbl-empty">Keine Zeilen</div></td></tr>')+'</tbody>';
      // Pro-Spalte Breite (w.colW[ci]: Zahl=px oder String wie "20%"/"120px") via colgroup, AUTO-Layout:
      // nicht gesetzte Spalten bleiben inhaltsbasiert konstant; eine Aenderung zieht Platz nur aus der
      // flexiblen (breitesten) Spalte statt aus allen (kein table-layout:fixed).
      var colgroup=anyW?('<colgroup>'+head.map(function(h,ci){var cw=w.colW&&w.colW[ci];var wv=cw?(/^\d+$/.test(String(cw))?cw+'px':String(cw)):'';return '<col'+(wv?' style="width:'+wv+'"':'')+'>';}).join('')+'</colgroup>'):'';
      bodyHtml='<div class="tbl-scroll"><table class="tbl">'+colgroup+thead+tbody+'</table></div>';
    }
    root.innerHTML='<div class="panel">'+ph+bodyHtml+'</div>';
  }
  var _tblT={};
  defWidget('table',{
    label:'Tabelle', cat:'Anzeige', paletteIcon:'wtable', size:[420,260],
    defaults:function(w){w.label='Tabelle';w.pageSize=10;w.tblView='table';},
    render:function(w){return '<div data-role="tblroot" style="position:absolute;inset:0"></div>';},
    mount:function(w){_tblLoad(w);},
    props:function(w){var s=row('Zeilen/Seite','<input id="pTblPS" type="number" min="0" value="'+(w.pageSize>0?w.pageSize:0)+'" title="0 = keine Paginierung">')
      +row('Start-Ansicht','<select id="pTblView"><option value="table"'+((w.tblView||'table')==='table'?' selected':'')+'>Tabelle</option><option value="cards"'+(w.tblView==='cards'?' selected':'')+'>Karten</option></select>')
      +row('Umschalter ausblenden','<input type="checkbox" id="pTblNoSw"'+(w.hideToggle?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">feste Start-Ansicht</span>')
      +row('Status-Stil','<input type="checkbox" id="pTblSev"'+(w.sevStyle?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Severity-Streifen + Status-Chip + Ladebalken (erkennt „Status"- und „%"-Spalte)</span>');
      // Pro-Spalte: Ausrichtung + Roh-HTML (Kopf aus geladenen Daten)
      var head=(w._tblRows&&w._tblRows[0])||[];
      if(head.length){
        s+='<div class="pgh">Spalten</div>';
        var alOpt=function(cur){return ['','left','center','right'].map(function(v){var lbl={'':'Standard',left:'Links',center:'Zentriert',right:'Rechts'}[v];return '<option value="'+v+'"'+((w.colAlign&&w.colAlign[cur.ci]||'')===v?' selected':'')+'>'+lbl+'</option>';}).join('');};
        head.forEach(function(h,ci){
          s+=row(esc(h||('Spalte '+(ci+1))),
            '<select data-tcol-al="'+ci+'">'+alOpt({ci:ci})+'</select> '
            +'<input data-tcol-w="'+ci+'" value="'+esc(w.colW&&w.colW[ci]!=null?w.colW[ci]:'')+'" placeholder="Breite" title="Breite: Zahl = px, oder z. B. 20%" style="width:64px"> '
            +'<label style="font-size:11px;color:var(--muted)"><input type="checkbox" data-tcol-html="'+ci+'"'+((w.colRaw&&w.colRaw[ci])?' checked':'')+'> HTML</label>');
        });
        s+='<div class="hint" style="font-size:11px;margin-top:4px"><b>Breite</b>: Zahl = Pixel, oder mit Einheit (z. B. <code>20%</code>). Leer = automatisch. <b>HTML</b>: Zellinhalt wird als HTML gerendert statt escaped (z. B. <code>&lt;img&gt;</code>, <code>&lt;span style&gt;</code>). Nur bei vertrauenswuerdiger Quelle.</div>';
      } else s+='<div class="hint" style="font-size:11px;margin-top:6px;color:var(--muted)">Spalten-Formatierung erscheint, sobald Daten geladen sind (Variable waehlen).</div>';
      s+='<div class="hint" style="font-size:11px;margin-top:6px">Quelle: Text-Variable mit <b>JSON</b> oder <b>serialisiertem Array</b> im Format [Zeile][Spalte]. <b>Zeile 0 = Spaltenkopf</b>.</div>';
      return s;},
    wire:function(w){
      if($('#pTblPS'))$('#pTblPS').oninput=function(){w.pageSize=parseInt(this.value)||0;w._tblPage=0;_tblDraw(w);commit();};
      if($('#pTblView'))$('#pTblView').onchange=function(){w.tblView=this.value;w._tblView=this.value;_tblDraw(w);commit();};
      if($('#pTblNoSw'))$('#pTblNoSw').onchange=function(){w.hideToggle=this.checked||undefined;_tblDraw(w);commit();};
      if($('#pTblSev'))$('#pTblSev').onchange=function(){w.sevStyle=this.checked||undefined;_tblDraw(w);commit();};
      [].forEach.call(document.querySelectorAll('[data-tcol-al]'),function(sel){sel.onchange=function(){var ci=+sel.getAttribute('data-tcol-al');w.colAlign=w.colAlign||[];w.colAlign[ci]=this.value||undefined;_tblDraw(w);commit();};});
      [].forEach.call(document.querySelectorAll('[data-tcol-html]'),function(cb){cb.onchange=function(){var ci=+cb.getAttribute('data-tcol-html');w.colRaw=w.colRaw||[];w.colRaw[ci]=this.checked||undefined;_tblDraw(w);commit();};});
      [].forEach.call(document.querySelectorAll('[data-tcol-w]'),function(inp){inp.oninput=function(){var ci=+inp.getAttribute('data-tcol-w');w.colW=w.colW||[];var v=this.value.trim();w.colW[ci]=v||undefined;_tblDraw(w);commit();};});
    },
    click:function(w,el,e){
      var sb=e.target.closest('[data-tbl-sort]');if(sb){var i=parseInt(sb.getAttribute('data-tbl-sort'));if(w._tblSortCol===i){w._tblSortDir=(w._tblSortDir==='asc')?'desc':'asc';}else{w._tblSortCol=i;w._tblSortDir='asc';}w._tblPage=0;_tblDraw(w);return true;}
      var pg=e.target.closest('[data-tbl-page]');if(pg){if(pg.hasAttribute('disabled'))return true;w._tblPage=Math.max(0,(w._tblPage||0)+(pg.getAttribute('data-tbl-page')==='next'?1:-1));_tblDraw(w);return true;}
      var vb=e.target.closest('[data-tbl-view]');if(vb){w._tblView=vb.getAttribute('data-tbl-view');_tblDraw(w);return true;}
      return false;
    },
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){if(_tblT[w.id])clearTimeout(_tblT[w.id]);_tblT[w.id]=setTimeout(function(){_tblLoad(w);},300);}}
  });
