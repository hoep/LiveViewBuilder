  function buildSkins(){
    var box=$('#skinpanel');if(!box)return;var skins=allSkins(),active=store.skin||'Standard',th=(store.theme==='light'?'light':'dark');
    var sk=skins[active]||BUILTIN['Standard'],toks=sk[th]||sk.dark,ed=!BUILTIN[active];
    var opt=Object.keys(skins).map(function(n){return '<option'+(n===active?' selected':'')+'>'+esc(n)+'</option>';}).join('');
    var tg=SKIN_TOKENS.map(function(k){return '<label class="skrow"><span>'+k+'</span><input type="color" data-sktok="'+k+'" value="'+(toks[k]||'#000000')+'"'+(ed?'':' disabled')+'></label>';}).join('');
    box.innerHTML='<div class="skhead">Skin <select id="skSel" class="btn" style="flex:1">'+opt+'</select></div>'
      +'<div class="skthemes"><button class="btn'+(th==='dark'?' on':'')+'" data-sktheme="dark">Dunkel</button><button class="btn'+(th==='light'?' on':'')+'" data-sktheme="light">Hell</button></div>'
      +'<div class="skbtns"><button class="btn" id="skNew">Neu</button><button class="btn" id="skDup">Duplizieren</button><button class="btn danger" id="skDel"'+(ed?'':' disabled')+'>Löschen</button></div>'
      +(ed?'<div class="hint" style="margin:6px 2px">Eingebaut (schreibgeschützt). „Duplizieren" für eine editierbare Kopie.</div>':'')
      +'<div class="skgrid">'+tg+'</div>'
      +'<div class="skfonts"><label class="skrow2"><span>UI-Schrift</span><input data-skfont="fu" value="'+esc(sk.fu||'')+'"'+(ed?'':' disabled')+'></label><label class="skrow2"><span>Mono-Schrift</span><input data-skfont="fm" value="'+esc(sk.fm||'')+'"'+(ed?'':' disabled')+'></label></div>';
    $('#skSel').onchange=function(){store.skin=this.value;applySkin();buildSkins();commit();};
    $$('#skinpanel [data-sktheme]').forEach(function(b){b.onclick=function(){store.theme=b.getAttribute('data-sktheme');applySkin();buildSkins();commit();};});
    $$('#skinpanel [data-sktok]').forEach(function(i){i.oninput=function(){editSkinToken(i.getAttribute('data-sktok'),i.value);};});
    $$('#skinpanel [data-skfont]').forEach(function(i){i.oninput=function(){editSkinFont(i.getAttribute('data-skfont'),i.value);};});
    $('#skNew').onclick=function(){newSkin(false);};$('#skDup').onclick=function(){newSkin(true);};
    var dl=$('#skDel');if(dl&&!dl.disabled)dl.onclick=deleteSkin;
  }
  // ---------- Einstellungen (Builder-Konfigurator) ----------
  function bcfg(){store.cfg=store.cfg||{};var c=store.cfg;if(c.gs==null)c.gs=8;if(c.gap==null)c.gap=12;if(c.defW==null)c.defW=1440;if(c.defH==null)c.defH=900;if(c.defFit==null)c.defFit='auto';if(c.autosave==null)c.autosave=true;if(c.mobileOpt==null)c.mobileOpt=true;if(c.mobileW==null)c.mobileW=640;return c;}
  function isMobile(){var w=window.innerWidth||0;if(w<=(bcfg().mobileW||640))return true;try{if(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches&&w<900&&window.innerHeight>window.innerWidth)return true;}catch(e){}return false;}
  function buildSettings(){
    var box=$('#setpanel');if(!box)return;var c=bcfg();
    box.innerHTML=''
      +'<div class="pgh">Raster</div>'
      +'<label class="skrow2"><span>Rastergröße (px)</span><input id="stGs" type="number" min="1" value="'+c.gs+'"></label>'
      +'<label class="skrow2"><span>Standardabstand zwischen Widgets (px)</span><input id="stGap" type="number" min="0" value="'+c.gap+'"></label>'
      +'<div class="pgh">Speichern</div>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stAuto"'+(c.autosave?' checked':'')+'><span>Automatisch speichern</span></label>'
      +'<div class="pgh">Neue Ansichten</div>'
      +'<label class="skrow2"><span>Standard-Breite (px)</span><input id="stW" type="number" value="'+c.defW+'"></label>'
      +'<label class="skrow2"><span>Standard-Höhe (px)</span><input id="stH" type="number" value="'+c.defH+'"></label>'
      +'<label class="skrow2"><span>Standard-Anpassung</span><select id="stFit"><option value="letterbox"'+(c.defFit==='letterbox'?' selected':'')+'>Letterbox</option><option value="auto"'+(c.defFit==='auto'?' selected':'')+'>Auto (SmartFit)</option><option value="anchor"'+(c.defFit==='anchor'?' selected':'')+'>Track-Fill</option><option value="reflow"'+(c.defFit==='reflow'?' selected':'')+'>Reflow</option></select></label>'
      +'<div class="pgh">Standard-Skin</div>'
      +'<label class="skrow2"><span>Aktiver Skin</span><select id="stSkin">'+Object.keys(allSkins()).map(function(n){return '<option'+(n===(store.skin||'Standard')?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>'
      +'<div class="pgh">Mobil</div>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stMob"'+(c.mobileOpt!==false?' checked':'')+'><span>Für Mobilgeräte optimieren (Auto-Reflow)</span></label>'
      +'<label class="skrow2"><span>Mobil-Schwelle (px Breite)</span><input id="stMobW" type="number" min="320" value="'+(c.mobileW||640)+'"></label>'
      +'<label class="skrow2"><span>Mobil-Startseite</span><select id="stMobHome"><option value="">(automatisch)</option>'+Object.keys(store.views||{}).map(function(n){return '<option'+(store.homeMobile===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>'
      +'<label class="skrow2"><span>Mobil-Ansicht für „'+esc(store.current||'')+'"</span><select id="stMobView"><option value="">(keine)</option>'+Object.keys(store.views||{}).map(function(n){return '<option'+((state.page&&state.page.mobileView)===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>'
      +'<div class="pgh">Live-Modus</div>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stHideNav"'+(c.hideRunNav?' checked':'')+'><span>Seitenumschalter (Hamburger) ausblenden</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stNoFS"'+(c.noAutoFS?' checked':'')+'><span>Kein Auto-Vollbild beim ersten Klick</span></label>'
      +'<div class="pgh">Server (nur Info)</div>'
      +'<div class="hint" style="margin:4px 2px">Schreib-Token und WebSocket-Port werden serverseitig in <code>sites.php</code> / <code>hook.php</code> gesetzt — nicht im Builder.</div>';
    if($('#stAuto'))$('#stAuto').onchange=function(){bcfg().autosave=this.checked;commit();if(this.checked)scheduleSave();};
    $('#stGs').oninput=function(){var v=parseInt(this.value)||8;bcfg().gs=Math.max(1,v);GS=bcfg().gs;setCanvas();commit();};
    if($('#stGap'))$('#stGap').oninput=function(){bcfg().gap=Math.max(0,parseInt(this.value)||0);commit();};
    $('#stW').oninput=function(){bcfg().defW=Math.max(320,parseInt(this.value)||1440);commit();};
    $('#stH').oninput=function(){bcfg().defH=Math.max(240,parseInt(this.value)||900);commit();};
    $('#stFit').onchange=function(){bcfg().defFit=this.value;commit();};
    if($('#stHideNav'))$('#stHideNav').onchange=function(){bcfg().hideRunNav=this.checked||undefined;commit();if(document.body.classList.contains('run'))document.body.classList.toggle('nohamb',this.checked);toast('Seitenumschalter '+(this.checked?'ausgeblendet':'sichtbar'));};
    if($('#stNoFS'))$('#stNoFS').onchange=function(){bcfg().noAutoFS=this.checked||undefined;commit();toast('Auto-Vollbild '+(this.checked?'aus':'an')+' (wirkt nach Reload)');};
    if($('#stMob'))$('#stMob').onchange=function(){bcfg().mobileOpt=this.checked;commit();};
    if($('#stMobW'))$('#stMobW').oninput=function(){bcfg().mobileW=Math.max(320,parseInt(this.value)||640);commit();};
    if($('#stMobHome'))$('#stMobHome').onchange=function(){store.homeMobile=this.value||undefined;commit();};
    if($('#stMobView'))$('#stMobView').onchange=function(){if(!state.page)return;if(this.value)state.page.mobileView=this.value;else delete state.page.mobileView;commit();};
    $('#stSkin').onchange=function(){store.skin=this.value;applySkin();buildSkins();commit();};
  }
  // Icon-Bibliothek
