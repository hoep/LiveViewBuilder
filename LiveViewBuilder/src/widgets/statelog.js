  // ===== Widget: Zustands-Verlauf (statelog) — Aktivitaetsliste der Zustandswechsel (Punkt · Name · Uhrzeit) =====
  // Nutzt dieselbe Zustands-Logik wie statetl (_stlMatch/_stlColor). Variable = zentrale "Variable"-Auswahl (w.varId).
  function _slogLabel(w,val){var st=w.states||[];for(var i=0;i<st.length;i++){if(_stlMatch(st[i].v,val))return st[i].label||String(st[i].v);}return String(val);}
  function _slogFetch(w){
    if(!w.varId){_slogDraw(w);return;}
    var now=Math.floor(Date.now()/1000),win=_winSec(w),from=now-win;
    fetch('?api=history&id='+w.varId+'&from='+from+'&to='+now,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      w._slogData=(j&&j.data)||[];_slogDraw(w);
    }).catch(function(){w._slogData=[];_slogDraw(w);});
  }
  function _slogDraw(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas)||((_popup&&$('#ovcanvas'))?$('.w[data-id="'+w.id+'"]',$('#ovcanvas')):null);if(!el)return;
    var box=$('[data-role=slog]',el);if(!box)return;
    if(!w.varId){box.innerHTML='<div class="slog-empty">Variable wählen</div>';return;}
    var rows=(w._slogData||[]).slice().reverse(),max=(w.count>0?w.count:20),out=[];
    for(var i=0;i<rows.length&&out.length<max;i++){
      var ms=rows[i][0],val=rows[i][1],dt=new Date(ms);
      var col=_stlColor(w,val)||'var(--muted)',lab=_slogLabel(w,val);
      var t=('0'+dt.getHours()).slice(-2)+':'+('0'+dt.getMinutes()).slice(-2)+':'+('0'+dt.getSeconds()).slice(-2);
      out.push('<div class="slog-row"><span class="slog-dot" style="background:'+col+'"></span><span class="slog-lbl">'+esc(lab)+'</span><span class="slog-t">'+t+'</span></div>');
    }
    box.innerHTML=out.length?out.join(''):'<div class="slog-empty">keine Wechsel im Zeitraum</div>';
  }
  var _slogT={};
  defWidget('statelog',{
    label:'Zustands-Verlauf', cat:'Anzeige', paletteIcon:'wchart', size:[300,240],
    defaults:function(w){w.hours=24;w.count=20;w.states=[{v:'1',color:'warm',label:'Erkannt'},{v:'0',color:'muted',label:'Frei'}];},
    render:function(w){return '<div class="wslog">'+(w.label?'<div class="slog-head">'+escL(w.label)+'</div>':'')+'<div data-role="slog" class="slog-list"></div></div>';},
    mount:function(w){_slogFetch(w);},
    props:function(w){return winCtl(w)
      +row('Max. Einträge','<input id="pSlogN" type="number" min="1" value="'+(w.count>0?w.count:20)+'">')
      +listEditor(w,'states','Zustände: Wert · Farbe · Name',[{k:'v',ph:'Wert'},{k:'color',type:'skincolor'},{k:'label',ph:'Name'}])
      +'<button class="btn" id="pSlogFill" style="margin:-2px 0 8px;padding:4px 8px;font-size:11px">Zustände aus Profil füllen</button>';},
    wire:function(w){
      winWire(w,function(){_slogFetch(w);commit();});
      if($('#pSlogN'))$('#pSlogN').oninput=function(){w.count=parseInt(this.value)||20;_slogDraw(w);commit();};
      if($('#pSlogFill'))$('#pSlogFill').onclick=function(){
        if(!w.varId){toast('Erst eine Variable wählen');return;}
        loadAssoc(w.varId,function(dd){if(!dd||!dd.assocs||!dd.assocs.length){toast('Profil hat keine Assoziationen');return;}
          w.states=dd.assocs.map(function(a){return {v:String(a.v),color:a.color||'',label:a.name||String(a.v)};});renderProps();_slogDraw(w);commit();toast(w.states.length+' Zustände übernommen');});
      };
    },
    live:function(w,el,id,d,base,txt,on){if(_slogT[w.id])clearTimeout(_slogT[w.id]);_slogT[w.id]=setTimeout(function(){_slogFetch(w);},1200);}
  });
