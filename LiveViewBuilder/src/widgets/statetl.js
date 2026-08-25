  // ===== Widget: Zustands-Timeline (statetl) — gefüllte Zeitbalken, je Zustand eigene Farbe, mehrere Signale =====
  // items: [{vid,label}], states: [{v,color,label}] (Wert->Farbe)
  // Zeitraum: rollierend (range.mode!='period') ODER kalender-ausgerichtet (range.mode='period', unit=hour/day/week/month/year)
  //   Im Kalender-Modus wird der VOLLE Zeitraum gezeigt; die noch nicht abgelaufene Zeit der laufenden Einheit als "offen" (schraffiert).
  // Optional ausblendbar: Legende (hideLegend), Signal-Bezeichnung (hideLabels), Achse/Uhrzeit (hideAxis).
  var _MN=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  var _WD=['Mo','Di','Mi','Do','Fr','Sa','So'];
  function _stlMatch(sv,val){return _assocMatch(sv,val);}
  function _stlColor(w,val){var st=w.states||[];for(var i=0;i<st.length;i++){if(_stlMatch(st[i].v,val))return st[i].color?_skinColor(st[i].color):'';}return '';}
  // data aufsteigend [[ms,val]...]; span/Fraktionen über [from,fullTo]; Fuellung nur bis dataTo (Rest = "offen").
  function _stlSegs(data,from,fullTo,dataTo,liveVal){
    var span=(fullTo-from)||1,pts=data||[],segs=[],k,init=liveVal;
    for(k=0;k<pts.length&&pts[k][0]/1000<=from;k++)init=pts[k][1];
    var curVal=init,curT=from;
    for(;k<pts.length;k++){var t=pts[k][0]/1000;if(t>dataTo)t=dataTo;
      if(t>curT)segs.push({fa:(curT-from)/span,fb:(t-from)/span,val:curVal});
      curVal=pts[k][1];curT=t;if(curT>=dataTo)break;}
    if(curT<dataTo)segs.push({fa:(curT-from)/span,fb:(dataTo-from)/span,val:curVal});
    return segs;
  }
  function _stlPeriodLabel(unit,off,start){
    if(unit==='hour')return ('0'+start.getHours()).slice(-2)+':00 · '+start.getDate()+'.'+_MN[start.getMonth()]+(off===0?' (jetzt)':'');
    if(unit==='day')return off===0?'Heute':(off===-1?'Gestern':(start.getDate()+'.'+_MN[start.getMonth()]+' '+start.getFullYear()));
    if(unit==='week')return off===0?'Diese Woche':(off===-1?'Letzte Woche':('Woche ab '+start.getDate()+'.'+_MN[start.getMonth()]));
    if(unit==='month')return _MN[start.getMonth()]+' '+start.getFullYear();
    if(unit==='year')return String(start.getFullYear());
    return '';
  }
  function _stlAxisHTML(from,to,period){
    var span=(to-from)||1,out=[];
    function push(f,lab){out.push('<span style="position:absolute;left:'+(Math.max(0,Math.min(1,f))*100).toFixed(2)+'%;transform:translateX(-50%);white-space:nowrap">'+lab+'</span>');}
    if(period==='day'){for(var h=0;h<=24;h+=6)push(h/24,(h<10?'0':'')+h+':00');}
    else if(period==='week'){for(var i=0;i<7;i++)push((i+0.5)/7,_WD[i]);}
    else if(period==='month'){var days=Math.max(1,Math.round(span/86400));[1,8,15,22,days].forEach(function(dd){push((dd-1)/days,String(dd));});}
    else if(period==='year'){for(var m=0;m<12;m++)push((m+0.5)/12,_MN[m]);}
    else if(period==='hour'){var sh=new Date(from*1000).getHours();[0,15,30,45,60].forEach(function(mm){push(mm/60,(sh<10?'0':'')+sh+':'+(mm===60?'00':(mm<10?'0'+mm:mm)));});}
    else{function tl(f){var d=new Date((from+span*f)*1000);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}push(0,tl(0));push(.5,tl(.5));push(1,tl(1));}
    // Achsenhoehe/-schrift aus der Kachel ableiten, sonst frisst die Achse auf flachen Kacheln den Balken.
    // Die Achse gehoert UNTER die Spuren. Sie lag bisher im normalen Fluss, waehrend
    // die Spuren absolut liegen - dadurch stand die Uhrzeit oben IM ersten Balken.
    // Die Spuren sparen unten 16 px aus (.stl-lanes), genau dort sitzt sie jetzt.
    return '<div class="stl-axis" style="position:absolute;left:0;right:0;bottom:0;display:block;height:clamp(10px,9cqh,16px);font-size:clamp(7px,2.8cqmin,11px);color:var(--faint)">'+out.join('')+'</div>';
  }
  var _STL_HATCH='repeating-linear-gradient(45deg,var(--line-soft) 0 5px,transparent 5px 10px)';
  function _stlFetch(w){
    var items=(w.items||[]).filter(function(o){return o&&o.vid;});if(!items.length){_stlDraw(w);return;}
    var rng=_winRange(w),from=rng.from,to=rng.to,now=rng.now,dataTo=Math.min(to,now),fetchFrom=from-(to-from),done=0,acc={};
    w._stlFrom=from;w._stlTo=to;w._stlNow=now;w._stlPeriod=rng.period;w._stlStart=rng.start;w._stlOffCur=rng.off;
    items.forEach(function(o){
      fetch('?api=history&id='+o.vid+'&from='+fetchFrom+'&to='+dataTo,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        acc[o.vid]=(j&&j.data)||[];
      }).catch(function(){acc[o.vid]=[];}).then(function(){done++;if(done>=items.length){w._stlData=acc;_stlDraw(w);}});
    });
  }
  function _stlDraw(w){
    var el=$('.w[data-id="'+w.id+'"]',canvas)||((_popup&&$('#ovcanvas'))?$('.w[data-id="'+w.id+'"]',$('#ovcanvas')):null);if(!el)return;
    var box=$('[data-role=stl]',el);if(!box)return;
    var items=(w.items||[]).filter(function(o){return o&&o.vid;});
    var from=w._stlFrom||0,to=w._stlTo||1,now=w._stlNow||to,period=w._stlPeriod,span=(to-from)||1,data=w._stlData||{},vert=(w.orient==='v');
    if(!items.length){box.innerHTML='<div style="color:var(--faint);font-size:11px;padding:8px">Signale hinzufügen (Zustands-Variablen)</div>';return;}
    var dataTo=Math.min(now,to),futFa=(dataTo-from)/span; // Beginn der "offenen" (noch nicht abgelaufenen) Zeit
    var showLabels=!w.hideLabels;
    var lanes=items.map(function(o){
      var lv=_lastVals[o.vid],liveVal=lv?lv.v:null;
      var segs=_stlSegs(data[o.vid],from,to,dataTo,liveVal);
      var fills=segs.map(function(s){var col=_stlColor(w,s.val);if(!col)return '';
        if(vert)return '<i style="position:absolute;left:0;right:0;bottom:'+(s.fa*100).toFixed(2)+'%;height:'+((s.fb-s.fa)*100).toFixed(2)+'%;background:'+col+'"></i>';
        return '<i style="position:absolute;top:0;bottom:0;left:'+(s.fa*100).toFixed(2)+'%;width:'+((s.fb-s.fa)*100).toFixed(2)+'%;background:'+col+'"></i>';
      }).join('');
      if(period&&futFa<1){ // noch nicht abgelaufene Zeit der laufenden Einheit -> "offen"
        fills+= vert
          ? '<i style="position:absolute;left:0;right:0;bottom:'+(futFa*100).toFixed(2)+'%;top:0;background:'+_STL_HATCH+';opacity:.5"></i>'
          : '<i style="position:absolute;top:0;bottom:0;left:'+(futFa*100).toFixed(2)+'%;right:0;background:'+_STL_HATCH+';opacity:.5"></i>';
      }
      var liveCol=_stlColor(w,liveVal);
      var lbl=showLabels?('<span class="stl-lbl" style="color:'+(liveCol||'var(--muted)')+'">'+esc(o.label||('#'+o.vid))+'</span>'):'';
      var trk='<div class="stl-trk">'+fills+'</div>';
      return vert?('<div class="stl-lane v">'+trk+lbl+'</div>'):('<div class="stl-lane">'+lbl+trk+'</div>');
    }).join('');
    var axis=w.hideAxis?'':_stlAxisHTML(from,to,period);
    box.innerHTML='<div class="stl-lanes'+(vert?' v':'')+'">'+lanes+'</div>'+axis;
    if(w.showLog){var lb=$('[data-role=slog]',el);if(lb){
      var first=items[0],dd=((data[first.vid])||[]).slice().reverse(),mx=(w.logCount>0?w.logCount:20),o2=[];
      for(var i=0;i<dd.length&&o2.length<mx;i++){var ms=dd[i][0],val=dd[i][1],dt=new Date(ms),col=_stlColor(w,val)||'var(--muted)',lab=_slogLabel(w,val);
        var tt=('0'+dt.getHours()).slice(-2)+':'+('0'+dt.getMinutes()).slice(-2)+':'+('0'+dt.getSeconds()).slice(-2);
        o2.push('<div class="slog-row"><span class="slog-dot" style="background:'+col+'"></span><span class="slog-lbl">'+esc(lab)+'</span><span class="slog-t">'+tt+'</span></div>');}
      lb.innerHTML=o2.length?o2.join(''):'<div class="slog-empty">keine Wechsel</div>';
    }}
  }
  function _stlHead(w){
    var per=(w.range&&w.range.mode==='period');
    var leg=w.hideLegend?'':(w.states||[]).filter(function(s){return s.color;}).map(function(s){return '<span class="stl-leg"><i style="background:'+_skinColor(s.color)+'"></i>'+esc(s.label||String(s.v))+'</span>';}).join('')
      +(per?'<span class="stl-leg"><i style="background:'+_STL_HATCH+';opacity:.6"></i>offen</span>':'');
    var title=(w.label&&!w.hideLabels)?'<span class="stl-title">'+escL(w.label)+'</span>':'';
    var nav='';
    if(per&&!w.hideNav){var u=(w.range.unit||'day'),off=(w._pOff||0),start=_periodStart(u,off);
      // Im Betrieb nur durch die Perioden blaettern (Einheit wird im Editor gewaehlt) -> kein gequetschtes Pill-Menue.
      nav='<span class="stl-nav">'
        +'<button class="stl-arw" data-stlnav="-1" title="zurueck">◀</button>'
        +'<span class="stl-per">'+esc(_stlPeriodLabel(u,off,start))+'</span>'
        +'<button class="stl-arw" data-stlnav="1"'+(off>=0?' disabled':'')+' title="vor">▶</button></span>';
    }
    if(!title&&!nav&&!leg)return ''; // alles ausgeblendet -> kein Kopf, Balken fuellen die Kachel
    return '<div class="stl-head">'+title+nav+'<span class="stl-legs">'+leg+'</span></div>';
  }
  var _stlT={};
  defWidget('statetl',{
    label:'Zustands-Timeline', cat:'Diagramme', paletteIcon:'wchart', size:[360,160], noHover:true, // reine Anzeige; nur interne Perioden-Pills sind klickbar -> kein Ganz-Widget-Hover
    defaults:function(w){w.range={mode:'period',unit:'day'};w.orient='h';w.items=[{vid:0,label:'Signal 1'}];w.states=[{v:'1',color:'ok',label:'Ein'},{v:'0',color:'crit',label:'Aus'}];},
    render:function(w){
      // Kopf vorhanden -> mehr Platz oben freilassen. Werte als clamp, damit der Balkenbereich
      // auf flachen Kacheln nicht vom festen 34px-Offset aufgefressen wird.
      var head=_stlHead(w),pad='clamp(5px,3cqmin,10px) clamp(6px,3.4cqmin,12px)';
      var inset=(head?'clamp(22px,14cqh,38px)':'clamp(4px,2cqmin,8px)')+' clamp(6px,3cqmin,12px) clamp(4px,2.4cqmin,8px)';
      if(w.showLog)return '<div class="wstatetl wstatetl-log" style="position:absolute;inset:0;padding:'+pad+';box-sizing:border-box">'+head+'<div class="stl-barbox"><div data-role="stl" style="position:absolute;inset:0"></div></div><div data-role="slog" class="slog-list"></div></div>';
      return '<div class="wstatetl" style="position:absolute;inset:0;padding:'+pad+';box-sizing:border-box">'+head+'<div data-role="stl" style="position:absolute;inset:'+inset+'"></div></div>';
    },
    mount:function(w){_stlFetch(w);},
    click:function(w,el,e){
      var u=e.target.closest('[data-stlu]');if(u){w.range=w.range||{};w.range.mode='period';w.range.unit=u.getAttribute('data-stlu');w._pOff=0;render();_stlFetch(w);if(typeof commit==='function')commit();return true;}
      var n=e.target.closest('[data-stlnav]');if(n){if(n.hasAttribute('disabled'))return true;var no=(w._pOff||0)+parseInt(n.getAttribute('data-stlnav'));if(no>0)no=0;w._pOff=no;render();_stlFetch(w);return true;}
      return false;
    },
    props:function(w){return winCtl(w)
      +row('Orientierung','<select id="pStlO"><option value="h"'+((w.orient||'h')==='h'?' selected':'')+'>horizontal (Zeit →)</option><option value="v"'+(w.orient==='v'?' selected':'')+'>vertikal (Zeit ↑)</option></select>')
      +'<div class="pgh">Anzeige</div>'
      +row('Legende','<input type="checkbox" id="pStlLeg"'+(!w.hideLegend?' checked':'')+'>')
      +row('Signal-Bezeichnung','<input type="checkbox" id="pStlLbl"'+(!w.hideLabels?' checked':'')+'>')
      +row('Uhrzeit / Achse','<input type="checkbox" id="pStlAx"'+(!w.hideAxis?' checked':'')+'>')
      +row('Perioden-Umschalter','<input type="checkbox" id="pStlNav"'+(!w.hideNav?' checked':'')+'>')
      +row('Verlaufsliste','<input type="checkbox" id="pStlLog"'+(w.showLog?' checked':'')+'>')
      +(w.showLog?row('Max. Einträge','<input id="pStlLogN" type="number" min="1" value="'+(w.logCount>0?w.logCount:20)+'">'):'')
      +'<div class="pgh">Zustände &amp; Signale</div>'
      +listEditor(w,'states','Zustände: Wert · Farbe · Name (leer = transparent)',[{k:'v',ph:'Wert'},{k:'color',type:'skincolor'},{k:'label',ph:'Name'}])
      +'<button class="btn" id="pStlFill" style="margin:-2px 0 8px;padding:4px 8px;font-size:11px">Zustände aus Profil füllen</button>'
      +listEditor(w,'items','Signale (Zustands-Variablen)',[{k:'vid',type:'var',ph:'Variable'},{k:'label',ph:'Name'}]);},
    wire:function(w){
      winWire(w,function(){_stlFetch(w);commit();});
      if($('#pStlO'))$('#pStlO').onchange=function(){w.orient=this.value;_stlDraw(w);commit();};
      if($('#pStlLeg'))$('#pStlLeg').onchange=function(){w.hideLegend=this.checked?undefined:true;render();commit();};
      if($('#pStlLbl'))$('#pStlLbl').onchange=function(){w.hideLabels=this.checked?undefined:true;render();_stlFetch(w);commit();};
      if($('#pStlAx'))$('#pStlAx').onchange=function(){w.hideAxis=this.checked?undefined:true;render();_stlFetch(w);commit();};
      if($('#pStlNav'))$('#pStlNav').onchange=function(){w.hideNav=this.checked?undefined:true;render();_stlFetch(w);commit();};
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
    live:function(w,el,id,d,base,txt,on){if(_stlT[w.id])clearTimeout(_stlT[w.id]);_stlT[w.id]=setTimeout(function(){_stlFetch(w);},1200);}
  });
