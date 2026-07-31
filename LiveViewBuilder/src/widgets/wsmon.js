  // ===== Widget: Live-Monitor (wsmon) — zeigt eingehende Live-Updates (WebSocket + Poll) =====
  //  Liest den globalen _liveFeed (in applyVal befüllt). Grüner Punkt = WebSocket-Push, grau = Poll.
  // Simple-Modus: nur zwei Punkte (WS/Poll), die bei Aktivität kurz aufblitzen und bei Inaktivität abblenden
  function drawWsmonSimple(w,el){
    var dws=$('[data-role=dws]',el),dpoll=$('[data-role=dpoll]',el);if(!dws)return;
    var lastWs=0,lastPoll=0;
    for(var i=_liveFeed.length-1;i>=0;i--){var e=_liveFeed[i];if(!lastWs&&e.src==='ws')lastWs=e.t;if(!lastPoll&&e.src==='poll')lastPoll=e.t;if(lastWs&&lastPoll)break;}
    el._wsm=el._wsm||{};var now=Date.now();
    function upd(dot,t,key){if(!dot)return;
      if(t&&t!==el._wsm[key]){el._wsm[key]=t;dot.classList.remove('hit');void dot.offsetWidth;dot.classList.add('hit');} // Neu-Blitz
      dot.classList.toggle('idle',!(t&&now-t<12000));} // aktiv, wenn <12 s her
    upd(dws,lastWs,'ws');upd(dpoll,lastPoll,'poll');
  }
  function drawWsmon(w,root){
    var el=$('.w[data-id="'+w.id+'"]',root||canvas);if(!el)return; // root = canvas ODER Popup-#ovcanvas
    if(w.simple){drawWsmonSimple(w,el);return;}
    var box=$('[data-role=wsl]',el);if(!box)return;
    var flt=w.wsSrc||'both',max=w.max||40;
    var arr=_liveFeed.filter(function(e){return flt==='both'||e.src===flt;});
    if(w.onlyId){var only=String(w.onlyId).split(',').map(function(s){return parseInt(s);});arr=arr.filter(function(e){return only.indexOf(e.id)>=0;});}
    arr=arr.slice(-max);
    var sig=arr.length?(arr[arr.length-1].t+'/'+arr.length):'0';
    if(box._sig===sig)return;
    var wasBottom=(box._sig===undefined)||(box.scrollTop+box.clientHeight>=box.scrollHeight-8);
    box._sig=sig;
    var why=(typeof _wsWhy==='string'&&_wsWhy)?'<div class="hwse" style="color:var(--warn)">'+esc(_wsWhy)+'</div>':'';
    if(!arr.length){box.innerHTML=why||'<div class="hwse">warte auf Updates …</div>';return;}
    box.innerHTML=why+arr.map(function(e){
      var d=new Date(e.t),p=function(n){return ('0'+n).slice(-2);},tm=p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
      var v=String(e.v==null?'':e.v);if(v.length>44)v=v.slice(0,44)+'…';
      return '<div class="hwsrow"><span class="hwsd '+(e.src==='ws'?'ws':'poll')+'" title="'+(e.src==='ws'?'WebSocket':'Poll')+'"></span><span class="hwst">'+tm+'</span><span class="hwsid">#'+e.id+'</span><span class="hwsv">'+esc(v)+'</span></div>';
    }).join('');
    if(wasBottom)box.scrollTop=box.scrollHeight;
  }
  defWidget('wsmon',{
    label:'Live-Monitor', paletteIcon:'wlist', size:[300,200],
    defaults:function(w){w.label='Live-Updates';w.max=40;w.wsSrc='both';},
    render:function(w){
      if(w.simple)return '<div class="hws hws-sim" title="'+esc(w.label||'Live')+'"><span class="hwsd hwsdlg ws idle" data-role="dws" title="WebSocket"></span><span class="hwsd hwsdlg poll idle" data-role="dpoll" title="Poll"></span></div>';
      return '<div class="hws">'+(w.label?('<div class="hwshd"><span>'+escL(w.label)+'</span><span class="hwslg"><span class="hwsd ws"></span>WS<span class="hwsd poll" style="margin-left:6px"></span>Poll</span></div>'):'')
      +'<div class="hwsl" data-role="wsl"><div class="hwse">warte auf Updates …</div></div></div>';},
    props:function(w){return row('Darstellung','<select id="pWsMode"><option value=""'+(!w.simple?' selected':'')+'>Standard (Fenster)</option><option value="1"'+(w.simple?' selected':'')+'>Simple (nur 2 Punkte)</option></select>')
      +(w.simple?'':row('Max Zeilen','<input id="pWsMax" type="number" min="5" max="200" value="'+(w.max||40)+'">'))
      +row('Quelle','<select id="pWsSrc"><option value="both"'+((w.wsSrc||'both')==='both'?' selected':'')+'>WS + Poll</option><option value="ws"'+(w.wsSrc==='ws'?' selected':'')+'>nur WebSocket</option><option value="poll"'+(w.wsSrc==='poll'?' selected':'')+'>nur Poll</option></select>')
      +row('Nur IDs (optional)','<input id="pWsIds" value="'+esc(w.onlyId||'')+'" placeholder="z. B. 33962,28622">');},
    wire:function(w){function rz(){var e=$('.w[data-id="'+w.id+'"] [data-role=wsl]',canvas);if(e)delete e._sig;drawWsmon(w);}
      if($('#pWsMode'))$('#pWsMode').onchange=function(){w.simple=this.value?true:undefined;render();renderProps();drawWsmon(w);commit();};
      if($('#pWsMax'))$('#pWsMax').oninput=function(){w.max=parseInt(this.value)||40;rz();};
      if($('#pWsSrc'))$('#pWsSrc').onchange=function(){w.wsSrc=this.value;rz();commit();};
      if($('#pWsIds'))$('#pWsIds').oninput=function(){w.onlyId=this.value.trim()||undefined;rz();};},
    mount:function(w){drawWsmon(w);var oc0=document.getElementById('ovcanvas');if(oc0)drawWsmon(w,oc0); // Popup-Fall: falls das Widget im Overlay liegt
      if(!window._wsmonTimer){window._wsmonTimer=setInterval(function(){try{
        allWidgets().forEach(function(x){if(x.type==='wsmon')drawWsmon(x);});
        if(typeof _tickKids!=='undefined'&&_tickKids)_tickKids.forEach(function(x){if(x.type==='wsmon')drawWsmon(x);});
        var oc=document.getElementById('ovcanvas');
        if(typeof _popup!=='undefined'&&_popup&&_popup.widgets&&oc)_popup.widgets.forEach(function(x){if(x.type==='wsmon')drawWsmon(x,oc);}); // Popup-Widgets live halten
      }catch(e){}},700);}},
    live:function(w,el,id,d,base,txt,on){return true;}
  });
