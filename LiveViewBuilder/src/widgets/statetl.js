  // ===== Widget: Zustands-Timeline (statetl) — gefüllte Zeitbalken, je Zustand eigene Farbe, mehrere Signale =====
  // items: [{vid,label}], states: [{v,color,label}] (Wert->Farbe), hours = Fenster, orient = 'h'|'v'
  function _stlMatch(sv,val){
    if(String(sv)===String(val))return true;
    var a=parseFloat(String(sv).replace(',','.')),b=parseFloat(String(val).replace(',','.'));
    if(!isNaN(a)&&!isNaN(b)&&a===b)return true;
    if((val===true||val==='true')&&(sv==='1'||sv===1))return true;
    if((val===false||val==='false')&&(sv==='0'||sv===0))return true;
    return false;
  }
  function _stlColor(w,val){ // Farbe für einen Segmentwert, '' = transparent (keine Definition)
    var st=w.states||[];
    for(var i=0;i<st.length;i++){if(_stlMatch(st[i].v,val))return st[i].color?_skinColor(st[i].color):'';}
    return '';
  }
  function _stlSegs(data,from,to,liveVal){
    // data aufsteigend [[ms,val]...] (inkl. Punkte VOR dem Fenster); liefert [{fa,fb,val}] in Zeit-Fraktion 0..1.
    var span=(to-from)||1,pts=data||[],segs=[],k,init=liveVal;
    for(k=0;k<pts.length&&pts[k][0]/1000<=from;k++)init=pts[k][1]; // letzter Wert <= Fensterstart
    var curVal=init,curT=from;
    for(;k<pts.length;k++){var t=pts[k][0]/1000;if(t>to)t=to;
      if(t>curT)segs.push({fa:(curT-from)/span,fb:(t-from)/span,val:curVal});
      curVal=pts[k][1];curT=t;if(curT>=to)break;}
    if(curT<to)segs.push({fa:(curT-from)/span,fb:1,val:curVal});
    return segs;
  }
  function _stlFetch(w){
    var items=(w.items||[]).filter(function(o){return o&&o.vid;});if(!items.length){_stlDraw(w);return;}
    var now=Math.floor(Date.now()/1000),win=_winSec(w),from=now-win,to=now,fetchFrom=from-win,done=0,acc={};
    w._stlFrom=from;w._stlTo=to; // sichtbares Fenster; Fetch reicht 1 Fenster weiter zurück (Zustand am linken Rand)
    items.forEach(function(o){
      fetch('?api=history&id='+o.vid+'&from='+fetchFrom+'&to='+to,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        acc[o.vid]=(j&&j.data)||[];
      }).catch(function(){acc[o.vid]=[];}).then(function(){done++;if(done>=items.length){w._stlData=acc;_stlDraw(w);}});
    });
  }
  function _stlDraw(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas)||((_popup&&$('#ovcanvas'))?$('.w[data-id="'+w.id+'"]',$('#ovcanvas')):null);if(!el)return;
    var box=$('[data-role=stl]',el);if(!box)return;
    var items=(w.items||[]).filter(function(o){return o&&o.vid;});
    var from=w._stlFrom||0,to=w._stlTo||1,vert=(w.orient==='v'),data=w._stlData||{};
    if(!items.length){box.innerHTML='<div style="color:var(--faint);font-size:11px;padding:8px">Signale hinzufügen (Zustands-Variablen)</div>';return;}
    var lanes=items.map(function(o){
      var lv=_lastVals[o.vid],liveVal=lv?lv.v:null;
      var segs=_stlSegs(data[o.vid],from,to,liveVal);
      var fills=segs.map(function(s){var col=_stlColor(w,s.val);if(!col)return '';
        if(vert){return '<i style="position:absolute;left:0;right:0;bottom:'+(s.fa*100).toFixed(2)+'%;height:'+((s.fb-s.fa)*100).toFixed(2)+'%;background:'+col+'"></i>';}
        return '<i style="position:absolute;top:0;bottom:0;left:'+(s.fa*100).toFixed(2)+'%;width:'+((s.fb-s.fa)*100).toFixed(2)+'%;background:'+col+'"></i>';
      }).join('');
      var liveCol=_stlColor(w,liveVal);
      var lbl='<span class="stl-lbl" style="color:'+(liveCol||'var(--muted)')+'">'+esc(o.label||('#'+o.vid))+'</span>';
      var trk='<div class="stl-trk">'+fills+'</div>';
      return vert?('<div class="stl-lane v">'+trk+lbl+'</div>'):('<div class="stl-lane">'+lbl+trk+'</div>');
    }).join('');
    function tl(f){var d=new Date((from+(to-from)*f)*1000);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
    var axis='<div class="stl-axis'+(vert?' v':'')+'"><span>'+tl(0)+'</span><span>'+tl(0.5)+'</span><span>'+tl(1)+'</span></div>';
    box.innerHTML='<div class="stl-lanes'+(vert?' v':'')+'">'+lanes+'</div>'+axis;
    if(w.showLog){var lb=$('[data-role=slog]',el);if(lb){ // Verlaufsliste (erstes Signal), Anzahl = logCount
      var first=items[0],dd=((data[first.vid])||[]).slice().reverse(),mx=(w.logCount>0?w.logCount:20),o=[];
      for(var i=0;i<dd.length&&o.length<mx;i++){var ms=dd[i][0],val=dd[i][1],dt=new Date(ms),col=_stlColor(w,val)||'var(--muted)',lab=_slogLabel(w,val);
        var tt=('0'+dt.getHours()).slice(-2)+':'+('0'+dt.getMinutes()).slice(-2)+':'+('0'+dt.getSeconds()).slice(-2);
        o.push('<div class="slog-row"><span class="slog-dot" style="background:'+col+'"></span><span class="slog-lbl">'+esc(lab)+'</span><span class="slog-t">'+tt+'</span></div>');}
      lb.innerHTML=o.length?o.join(''):'<div class="slog-empty">keine Wechsel</div>';
    }}
  }
  var _stlT={};
  defWidget('statetl',{
    label:'Zustands-Timeline', paletteIcon:'wchart', size:[320,150],
    defaults:function(w){w.hours=24;w.orient='h';w.items=[{vid:0,label:'Signal 1'}];w.states=[{v:'1',color:'ok',label:'Ein'},{v:'0',color:'',label:'Aus'}];},
    render:function(w){
      var leg=(w.states||[]).filter(function(s){return s.color;}).map(function(s){return '<span class="stl-leg"><i style="background:'+_skinColor(s.color)+'"></i>'+esc(s.label||String(s.v))+'</span>';}).join('');
      var head='<div class="stl-head">'+(w.label?'<span class="stl-title">'+esc(w.label)+'</span>':'')+'<span class="stl-legs">'+leg+'</span></div>';
      if(w.showLog){ // HA-Ansicht: Balken oben + Verlaufsliste darunter (eine Kachel)
        return '<div class="wstatetl wstatetl-log" style="position:absolute;inset:0;padding:8px 10px;box-sizing:border-box">'+head+'<div class="stl-barbox"><div data-role="stl" style="position:absolute;inset:0"></div></div><div data-role="slog" class="slog-list"></div></div>';
      }
      return '<div class="wstatetl" style="position:absolute;inset:0;padding:8px 10px;box-sizing:border-box">'+head+'<div data-role="stl" style="position:absolute;inset:24px 10px 6px 10px"></div></div>';
    },
    mount:function(w){_stlFetch(w);},
    props:function(w){return winCtl(w)
      +row('Orientierung','<select id="pStlO"><option value="h"'+((w.orient||'h')==='h'?' selected':'')+'>horizontal (Zeit →)</option><option value="v"'+(w.orient==='v'?' selected':'')+'>vertikal (Zeit ↑)</option></select>')
      +row('Verlaufsliste','<input type="checkbox" id="pStlLog"'+(w.showLog?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Aktivitätsliste unter dem Balken</span>')
      +(w.showLog?row('Max. Einträge','<input id="pStlLogN" type="number" min="1" value="'+(w.logCount>0?w.logCount:20)+'">'):'')
      +listEditor(w,'states','Zustände: Wert · Farbe · Name (leer = transparent)',[{k:'v',ph:'Wert'},{k:'color',type:'skincolor'},{k:'label',ph:'Name'}])
      +'<button class="btn" id="pStlFill" style="margin:-2px 0 8px;padding:4px 8px;font-size:11px">Zustände aus Profil füllen</button>'
      +listEditor(w,'items','Signale (Zustands-Variablen)',[{k:'vid',ph:'ID'},{k:'label',ph:'Name'}]);},
    wire:function(w){
      winWire(w,function(){_stlFetch(w);commit();});
      if($('#pStlO'))$('#pStlO').onchange=function(){w.orient=this.value;_stlDraw(w);commit();};
      if($('#pStlLog'))$('#pStlLog').onchange=function(){w.showLog=this.checked||undefined;render();renderProps();_stlFetch(w);commit();};
      if($('#pStlLogN'))$('#pStlLogN').oninput=function(){w.logCount=parseInt(this.value)||20;_stlDraw(w);commit();};
      if($('#pStlFill'))$('#pStlFill').onclick=function(){
        var first=(w.items||[]).filter(function(o){return o&&o.vid;})[0];
        if(!first){toast('Erst ein Signal mit Variable hinzufügen');return;}
        loadAssoc(first.vid,function(dd){
          if(!dd||!dd.assocs||!dd.assocs.length){toast('Profil hat keine Assoziationen');return;}
          w.states=dd.assocs.map(function(a){return {v:String(a.v),color:a.color||'',label:a.name||String(a.v)};});
          renderProps();render();commit();toast(w.states.length+' Zustände aus Profil übernommen');
        });
      };
    },
    live:function(w,el,id,d,base,txt,on){if(_stlT[w.id])clearTimeout(_stlT[w.id]);_stlT[w.id]=setTimeout(function(){_stlFetch(w);},1200);} // Zustandswechsel -> Timeline nachziehen (entprellt)
  });
