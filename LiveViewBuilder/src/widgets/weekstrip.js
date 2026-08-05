  // ===== Widget: Wochen-Streifen (weekstrip) — Read-only-Übersicht eines Wochenplans =====
  //
  //  Kompakte 7-Zeilen-Ansicht eines Symcon-Wochenplans (Ereignis): je Tag ein Farbband aus
  //  den Aktionen (Name+Farbe), plus „jetzt"-Marke. Nur-Anzeige (Bearbeiten: weekedit).
  //  Nutzt ?api=week und die Helfer aus weekedit (weAct/wePoints/weH2M) im selben Bundle.

  var _wstState = {};
  var _wstTimer = null;
  var WST_DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  function wstSt(w){return _wstState[w.id]||(_wstState[w.id]={loaded:false,data:null,err:''});}
  function wstGroupForDay(d,day){var gs=(d&&d.groups)||[];for(var i=0;i<gs.length;i++){if((gs[i].dayList||[]).indexOf(day)>=0)return gs[i];}return null;}

  function wstRender(w){
    var st=wstSt(w);
    if(!st.loaded)return '<div class="wst wst-msg">lädt …</div>';
    if(st.err)return '<div class="wst wst-msg">'+esc(st.err)+'</div>';
    if((!w.eventId&&!(typeof DOKU!=='undefined'&&DOKU))||!st.data)return '<div class="wst wst-msg">Wochenplan im Panel wählen</div>';
    var d=st.data, acts={actions:d.actions};
    var now=new Date(), today=(now.getDay()+6)%7, nowPct=(now.getHours()*60+now.getMinutes())/1440*100;
    var h='<div class="wst">';
    if(w.showTitle!==false)h+='<div class="wst-head"><span class="wst-title">'+escL(w.label||d.name||'Wochenplan')+'</span>'
      +(d.now!=null?'<span class="wst-now">jetzt: <b style="color:'+weAct(acts,d.now).color+'">'+esc(weAct(acts,d.now).name)+'</b></span>':'')+'</div>';
    h+='<div class="wst-rows">';
    for(var i=0;i<7;i++){var g=wstGroupForDay(d,i),pts=wePoints(g),segs='',start=0;
      for(var k=0;k<pts.length;k++){var s=weH2M(pts[k].h,pts[k].m),e=(k+1<pts.length)?weH2M(pts[k+1].h,pts[k+1].m):1440;
        segs+='<i style="left:'+(s/1440*100)+'%;width:'+((e-s)/1440*100)+'%;background:'+weAct(acts,pts[k].actionId).color+'"></i>';}
      if(i===today)segs+='<i class="wst-nowmk" style="left:'+nowPct+'%"></i>';
      h+='<div class="wst-row'+(i===today?' today':'')+'"><span class="wst-lab">'+WST_DAYS[i]+'</span><div class="wst-bar">'+segs+'</div></div>';
    }
    h+='</div>';
    if(w.showLegend!==false)h+='<div class="wst-legend">'+(d.actions||[]).map(function(a){return '<span class="wst-lchip"><i style="background:'+a.color+'"></i>'+esc(a.name)+'</span>';}).join('')+'</div>';
    h+='</div>';
    return h;
  }

  function wstFetch(w,el){var st=wstSt(w);
    if(typeof DOKU!=='undefined'&&DOKU){st.data=weDemo();st.loaded=true;st.err='';wstRepaint(w,el);return;}
    if(!w.eventId){st.loaded=true;st.data=null;wstRepaint(w,el);return;}
    fetch('?api=week&op=get&id='+w.eventId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok){st.data=j;st.err='';}else st.err='Plan nicht lesbar'; st.loaded=true; wstRepaint(w,el);
    }).catch(function(){st.err='Verbindungsfehler';st.loaded=true;wstRepaint(w,el);});
  }
  function wstStartTimer(){if(_wstTimer||(typeof DOKU!=='undefined'&&DOKU))return;_wstTimer=setInterval(wstTick,60000);}
  function wstTick(){Object.keys(_wstState).forEach(function(id){if(!_wstState[id].loaded)return;var el=document.querySelector('.w[data-id="'+id+'"]');if(!el)return;var w=(typeof widget==='function')?widget(id):null;if(w)wstFetch(w,el);});}

  function wstElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function wstRepaint(w,el){if(!el)el=wstElOf(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=wstRender(w);}

  defWidget('weekstrip',{
    label:'Wochen-Streifen', paletteIcon:'calendar', size:[340,190],
    defaults:function(w){w.label='';},
    render:function(w){return wstRender(w);},
    mount:function(w){var el=wstElOf(w);if(!el)el=wstElOf(w,$('#ovcanvas'));if(!el)return;wstStartTimer();wstFetch(w,el);},
    props:function(w){
      var h='<div class="pgh">Wochenplan</div>';
      if(typeof _wePlans==='undefined'||!_wePlans){ if(typeof weLoadPlans==='function')weLoadPlans(function(){if(typeof renderProps==='function')renderProps();}); return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Pläne laden …</div>'; }
      h+=row('Plan','<select id="wstPlan"><option value="">— wählen —</option>'+(_wePlans||[]).map(function(p){return '<option value="'+p.id+'"'+(w.eventId==p.id?' selected':'')+'>'+esc(p.name)+' · '+esc(p.path||'')+'</option>';}).join('')+'</select>');
      h+=row('Titel zeigen','<input type="checkbox" id="wstTit"'+(w.showTitle!==false?' checked':'')+'>');
      h+=row('Legende zeigen','<input type="checkbox" id="wstLeg"'+(w.showLegend!==false?' checked':'')+'>');
      return h;
    },
    wire:function(w){
      if($('#wstPlan'))$('#wstPlan').onchange=function(){var v=parseInt(this.value)||0;w.eventId=v||undefined;commit();var el=wstElOf(w);if(el){var st=wstSt(w);st.loaded=false;st.data=null;wstRepaint(w,el);wstFetch(w,el);}};
      if($('#wstTit'))$('#wstTit').onchange=function(){w.showTitle=this.checked?undefined:false;render();commit();};
      if($('#wstLeg'))$('#wstLeg').onchange=function(){w.showLegend=this.checked?undefined:false;render();commit();};
    }
  });
