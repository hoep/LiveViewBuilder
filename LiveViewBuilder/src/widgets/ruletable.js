  // ===== Widget: Regel-Tabelle (ruletable) — kompakte Matrix Regel × Feld =====
  //  Fuer Geraete-Regelmatrizen (ProCon TEMPC/ADCC/SWITCHC): eine ZEILE je Regel,
  //  eine SPALTE je Feld. Jede Zelle ist an eine eigene (schreibbare) Variable gebunden.
  //  Konfiguration (i.d.R. generiert):
  //    w.cols      = [{label, type:'num'|'bool'|'sel', unit, options:[{value,text}]}]
  //    w.rowLabels = ['Regel 0', 'Regel 1', ...]
  //    w.items     = [{vid, r, c}]   // Zellbindung (nur belegte Zellen)
  //  Zellen liegen in w.items[].vid -> _collectIds/widgetDataId sammeln sie automatisch
  //  fuer Poll + Live-Dispatch (kein Core-Eingriff noetig).

  function _rtItemMap(w){ // (r*1000+c) -> item ; und vid -> item
    var byRC={}, byVid={};
    (w.items||[]).forEach(function(it){ if(!it||!it.vid)return; byRC[(it.r|0)*1000+(it.c|0)]=it; byVid[it.vid]=it; });
    return {rc:byRC, vid:byVid};
  }
  function _rtColText(col,val){ // Anzeigetext einer sel-Zelle
    var o=(col.options||[]).filter(function(x){return String(x.value)===String(val);})[0];
    return o?o.text:(val==null?'–':String(val));
  }
  function _rtChevron(){
    return '<svg class="rtcv" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function _rtCell(col,it){
    if(!it)return '<td class="rtc rtc-empty">·</td>';
    var t=col.type;
    if(t==='bool')return '<td class="rtc rtc-bool" data-rv="'+it.vid+'" data-c="'+it.c+'"><span class="rtsw off"><i></i></span></td>';
    if(t==='sel') return '<td class="rtc rtc-sel"  data-rv="'+it.vid+'" data-c="'+it.c+'"><span class="rtseg"><span class="rtsel">–</span>'+_rtChevron()+'</span></td>';
    return '<td class="rtc rtc-num" data-rv="'+it.vid+'" data-c="'+it.c+'"><span class="rtchip"><span class="rtv">–</span></span></td>';
  }
  function _rtValOf(vid){var d=_lastVals[vid];if(!d)return null;return d;}

  defWidget('ruletable',{
    label:'Regel-Tabelle', cat:'Steuerung', paletteIcon:'wselect', size:[900,300],
    defaults:function(w){w.cols=[];w.rowLabels=[];w.items=[];},
    render:function(w){
      var cols=w.cols||[], rows=w.rowLabels||[], map=_rtItemMap(w);
      var actC=-1; cols.forEach(function(c,i){ if(actC<0 && c.type==='bool' && /aktiv|anwenden|enable|ein/i.test(c.label||'')) actC=i; });
      // Grundschrift der Tabelle waechst mit der Kachel; die Zellen (.rtv/.rtsel) erben sie,
      // weil styles.css dort keine eigene Groesse setzt. --rt-fs steht zusaetzlich am Wurzel-div
      // bereit, damit spaetere Regeln daran anknuepfen koennen.
      var rtfs='clamp(11px,2.4cqmin,15px)';
      var h='<div class="rt" data-actc="'+actC+'" style="--rt-fs:'+rtfs+'">';
      h+='<div class="rthead"><span class="rth-eyebrow">'+escL(w.label||'Regeln')+'</span><span class="rth-meta">'+rows.length+' Regeln · '+cols.length+' Felder</span></div>';
      h+='<div class="rtscroll"><table class="rtt" style="font-size:'+rtfs+'"><thead><tr><th class="rtrl">Regel</th>';
      cols.forEach(function(c){
        var cl=(c.type==='num')?' class="rt-num"':'';
        var u =(c.type==='num'&&c.unit)?'<small>'+esc(c.unit)+'</small>':'';
        h+='<th'+cl+' title="'+esc(c.label||'')+'">'+esc(c.label||'')+u+'</th>';
      });
      h+='</tr></thead><tbody>';
      rows.forEach(function(rl,r){
        h+='<tr data-active="1"><td class="rtrl"><span class="rtrl-in"><span class="rtrl-ix">'+r+'</span><span class="rtrl-tx">'+esc(rl)+'</span></span></td>';
        cols.forEach(function(c,ci){h+=_rtCell(c,map.rc[r*1000+ci]);});
        h+='</tr>';
      });
      h+='</tbody></table></div></div>';
      return h;
    },
    live:function(w,el,id,d,base,txt,on){
      var map=_rtItemMap(w), it=map.vid[id]; if(!it)return true;
      var col=(w.cols||[])[it.c]||{}, cell=$('[data-rv="'+id+'"]',el); if(!cell)return true;
      if(col.type==='bool'){var sw=$('.rtsw',cell);if(sw)sw.classList.toggle('off',!on);}
      else if(col.type==='sel'){var s=$('.rtsel',cell);if(s)s.textContent=_rtColText(col,d.v);}
      else{var v=$('.rtv',cell);if(v)v.textContent=(d.f!=null&&d.f!=='')?d.f:String(d.v);}
      var rt=(el.classList&&el.classList.contains('rt'))?el:$('.rt',el);
      if(rt&&parseInt(rt.getAttribute('data-actc'))===it.c){var tr=cell.closest('tr'); if(tr)tr.setAttribute('data-active',on?'1':'0');}
      return true;
    },
    click:function(w,el,e){
      var cell=e.target.closest('.rtc[data-rv]'); if(!cell)return false;
      var vid=parseInt(cell.getAttribute('data-rv')), c=parseInt(cell.getAttribute('data-c'));
      var col=(w.cols||[])[c]||{}, d=_rtValOf(vid);
      if(col.type==='bool'){var on=d?(d.v===true||d.v===1||d.v==='1'):false;setVar(vid,on?0:1);}
      else if(col.type==='sel'){
        var opts=col.options||[]; if(!opts.length)return true;
        var cur=d?String(d.v):null, idx=0;
        for(var i=0;i<opts.length;i++){if(String(opts[i].value)===cur){idx=i;break;}}
        var nx=opts[(idx+1)%opts.length]; setVar(vid,nx.value);
      } else {
        var cv=d?((d.f!=null&&d.f!=='')?d.f:String(d.v)):''; var nv=prompt((col.label||'Wert')+':',String(cv).replace(/[^0-9.,-].*$/,'').trim());
        if(nv!=null&&nv!==''){var num=parseFloat(String(nv).replace(',','.'));if(!isNaN(num))setVar(vid,num);}
      }
      return true;
    },
    props:function(w){if(w.type!=='ruletable')return '';
      return '<div style="font-size:11px;color:var(--muted);line-height:1.5;padding:2px">Generierte Regel-Matrix ('+(w.rowLabels||[]).length+' Regeln × '+(w.cols||[]).length+' Felder). Zellen sind an die Geraete-Regelvariablen gebunden: Zahl per Tipp editieren, Schalter/Auswahl per Klick. Schreiben ist gegated (armed).</div>';
    },
    wire:function(w){}
  });
