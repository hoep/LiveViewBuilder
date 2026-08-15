  // ===== Widget: Beschattungs-Profil (shadeprofile) — IPSShadowing-Profil-Editor =====
  //
  //  Bearbeitet EIN IPSShadowing-Profil (Weather/BgnOfDay/EndOfDay/Sun/Temp): jede bedienbare
  //  Config-Variable wird generisch als passendes Element gezeigt (Schalter/Auswahl/Zahl/Text).
  //  Liest über ?api=shading&op=profile, schreibt über ?api=setvar. Doku-Modus = Demodaten.

  var _spState = {};
  var _spClasses = null;

  function spSt(w){return _spState[w.id]||(_spState[w.id]={loaded:false,data:null,err:''});}

  function spDemo(w){return {ok:true,id:900901,name:'Normal (Demo)',info:'Zeit=06:30',
    vars:[
      {ident:'WorkdayMode',name:'Modus Werktag',vid:900911,ctl:'select',value:1,text:'individuelle Zeit',options:[{v:0,name:'Dämmerung'},{v:1,name:'individuelle Zeit'},{v:2,name:'Sonnenaufgang'}]},
      {ident:'WorkdayTime',name:'Zeit Werktag',vid:900912,ctl:'text',value:'06:30',text:'06:30',options:[]},
      {ident:'WeekendTime',name:'Zeit Wochenende',vid:900913,ctl:'text',value:'08:30',text:'08:30',options:[]},
      {ident:'RainCheck',name:'Regenschutz',vid:900914,ctl:'switch',value:true,text:'An',options:[]},
      {ident:'BrightnessLow',name:'Helligkeit min',vid:900915,ctl:'number',value:0,text:'0 Lux',options:[]}
    ]};}

  // ============================ RENDER ============================
  function spCtl(v){
    if(v.ctl==='switch')return '<button class="sp-sw'+(v.value?' on':'')+'" data-spsw="'+v.vid+'"><span class="sp-dot"></span>'+(v.value?'An':'Aus')+'</button>';
    if(v.ctl==='select')return '<select data-spsel="'+v.vid+'">'+(v.options||[]).map(function(o){return '<option value="'+o.v+'"'+(o.v==v.value?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</select>';
    if(v.ctl==='number')return '<input class="sp-num" type="number" data-spnum="'+v.vid+'" value="'+esc(String(v.value))+'">';
    return '<input class="sp-txt" type="text" data-sptext="'+v.vid+'" value="'+esc(String(v.value))+'" placeholder="'+esc(v.text||'')+'">';
  }
  function spRender(w){
    var st=spSt(w);
    if(!st.loaded)return '<div class="spf spf-msg">lädt …</div>';
    if(st.err)return '<div class="spf spf-msg">'+esc(st.err)+'</div>';
    if((!w.profileId&&!(typeof DOKU!=='undefined'&&DOKU))||!st.data)return '<div class="spf spf-msg">Profil im Panel wählen</div>';
    var d=st.data;
    var h='<div class="spf"><div class="spf-head">'+escL(w.label||d.name)+'</div>';
    h+='<div class="spf-vars">'+(d.vars||[]).map(function(v){return '<label class="sp-field"><span class="sp-lab" title="'+esc(v.ident)+'">'+esc(v.name)+'</span>'+spCtl(v)+'</label>';}).join('')+'</div>';
    if(d.info)h+='<div class="spf-info">'+esc(d.info)+'</div>';
    h+='</div>';
    return h;
  }

  // ============================ NETZ ============================
  function spLoadClasses(cb){
    if(_spClasses){cb&&cb();return;}
    if(typeof DOKU!=='undefined'&&DOKU){_spClasses=[{class:'BgnOfDay',cat:0,profiles:[{id:900901,name:'Normal (Demo)'}]},{class:'Temp',cat:0,profiles:[{id:900902,name:'Schlafzimmer (Demo)'}]}];cb&&cb();return;}
    fetch('?api=shading&op=profiles',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){_spClasses=(j&&j.classes)||[];cb&&cb();}).catch(function(){_spClasses=[];cb&&cb();});
  }
  function spFetch(w,el){var st=spSt(w);
    if(typeof DOKU!=='undefined'&&DOKU){st.data=spDemo(w);st.loaded=true;st.err='';spRepaint(w,el);return;}
    if(!w.profileId){st.loaded=true;st.data=null;spRepaint(w,el);return;}
    fetch('?api=shading&op=profile&profile='+w.profileId,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok){st.data=j;st.err='';}else st.err='Profil nicht lesbar'; st.loaded=true; spRepaint(w,el);
    }).catch(function(){st.err='Verbindungsfehler';st.loaded=true;spRepaint(w,el);});
  }
  function spWrite(w,el,vid,val){if(!vid)return;setVar(vid,val);setTimeout(function(){spFetch(w,el);},500);}

  // ============================ PAINT/BIND ============================
  function spElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function spRepaint(w,el){if(!el)el=spElOf(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=spRender(w);spBind(w,el);}
  function spBind(w,el){
    $$('[data-spsw]',el).forEach(function(b){b.onclick=function(){var on=b.classList.contains('on');spWrite(w,el,+b.getAttribute('data-spsw'),on?0:1);};});
    $$('[data-spsel]',el).forEach(function(s){s.onchange=function(){spWrite(w,el,+s.getAttribute('data-spsel'),+s.value);};});
    $$('[data-spnum]',el).forEach(function(n){n.onchange=function(){spWrite(w,el,+n.getAttribute('data-spnum'),parseFloat(n.value)||0);};});
    $$('[data-sptext]',el).forEach(function(t){t.onchange=function(){spWrite(w,el,+t.getAttribute('data-sptext'),t.value);};});
  }

  // ============================ WIDGET ============================
  defWidget('shadeprofile',{
    // IPSShadowing-Legacy (via ?api=shading) — abgeloest durch shadeprofiles (HomeSuite
    // Hub, benannte Profile). noPalette: bleibt auf Bestandsseiten funktionsfaehig,
    // wird nicht mehr neu angeboten (Entfernung nach Cutover).
    noPalette:true,
    label:'Beschattungs-Profil (IPSShadowing)', cat:'HomeSuite · Beschattung', paletteIcon:'cover', size:[280,300],
    defaults:function(w){w.label='';},
    render:function(w){return spRender(w);},
    mount:function(w){var el=spElOf(w);if(!el)el=spElOf(w,$('#ovcanvas'));if(!el)return;spFetch(w,el);},
    props:function(w){return spProps(w);},
    wire:function(w){spWire(w);}
  });

  function spProps(w){
    var h='<div class="pgh">Profil</div>';
    if(!_spClasses){spLoadClasses(function(){if(typeof renderProps==='function')renderProps();});return h+'<div style="color:var(--muted);font-size:12px;padding:4px 2px">Profile laden …</div>';}
    var opts='<option value="">— wählen —</option>';
    (_spClasses||[]).forEach(function(c){ opts+='<optgroup label="'+esc(c['class'])+'">'+(c.profiles||[]).map(function(p){return '<option value="'+p.id+'"'+(w.profileId==p.id?' selected':'')+'>'+esc(p.name)+'</option>';}).join('')+'</optgroup>'; });
    h+=row('Profil','<select id="spProf">'+opts+'</select>');
    h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">IPSShadowing-Profil (global, gilt für alle Rollos, die es verwenden). Label leer = Profilname.</div>';
    return h;
  }
  function spWire(w){
    if($('#spProf'))$('#spProf').onchange=function(){var v=parseInt(this.value)||0;w.profileId=v||undefined;commit();
      var el=spElOf(w);if(el){var st=spSt(w);st.loaded=false;st.data=null;spRepaint(w,el);spFetch(w,el);}};
  }
