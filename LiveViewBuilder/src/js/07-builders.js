  function buildSkins(){
    var box=$('#skinpanel');if(!box)return;var skins=allSkins(),active=store.skin||'Standard',th=(store.theme==='light'?'light':'dark');
    var sk=skins[active]||BUILTIN['Standard'],toks=sk[th]||sk.dark,isBuiltin=!!BUILTIN[active];
    var opt=Object.keys(skins).map(function(n){return '<option'+(n===active?' selected':'')+'>'+esc(n)+'</option>';}).join('');
    // Basis-Farben: IMMER editierbar. Aenderung an einem eingebauten Skin legt automatisch eine Kopie an (Auto-Fork).
    var tg=SKIN_TOKENS.map(function(k){return '<label class="skrow"><span>'+k+'</span><input type="color" data-sktok="'+k+'" value="'+(toks[k]||'#000000')+'"></label>';}).join('');
    // Eigene, benannte Farben (pro Skin): Name + Farbe + Loeschen.
    var extra=(sk.extra||[]);
    var xg=extra.map(function(e){var v=toks[e.key]||'#00cdab';
      return '<label class="skrow" style="gap:6px"><input data-skxname="'+e.key+'" value="'+esc(e.name)+'" title="Name" style="flex:1;min-width:0"><input type="color" data-sktok="'+e.key+'" value="'+v+'"><button class="btn danger" data-skxdel="'+e.key+'" title="Farbe löschen" style="padding:2px 7px">✕</button></label>';
    }).join('');
    box.innerHTML='<div class="skhead">Skin <select id="skSel" class="btn" style="flex:1">'+opt+'</select></div>'
      +'<div class="skthemes"><button class="btn'+(th==='dark'?' on':'')+'" data-sktheme="dark">Dunkel</button><button class="btn'+(th==='light'?' on':'')+'" data-sktheme="light">Hell</button></div>'
      +'<div class="skbtns"><button class="btn" id="skNew">Neu</button><button class="btn" id="skDup">Duplizieren</button><button class="btn danger" id="skDel"'+(isBuiltin?' disabled':'')+'>Löschen</button></div>'
      +(isBuiltin?'<div class="hint" style="margin:6px 2px">Eingebaut: die erste Farbänderung legt automatisch eine editierbare Kopie an.</div>':'')
      +'<div class="pgh" style="margin-top:8px">Farben — du bearbeitest: <b style="color:var(--accent)">'+(th==='dark'?'DUNKEL':'HELL')+'</b></div>'
      +'<label class="skrow2" style="gap:7px;margin:2px 2px 6px"><input type="checkbox" id="skBoth"'+((store.cfg&&store.cfg.skinBoth)?' checked':'')+'><span style="font-size:11.5px;color:var(--muted)">Änderungen für <b>beide</b> Themes übernehmen</span></label>'
      +'<div class="skgrid">'+tg+'</div>'
      +'<div class="pgh" style="margin-top:8px">Eigene Farben</div>'
      +'<div style="display:flex;flex-direction:column;gap:4px">'+(xg||'<div class="hint" style="padding:2px">Noch keine eigene Farbe.</div>')+'</div>'
      +'<div class="skbtns"><button class="btn" id="skAddColor">+ Farbe hinzufügen</button></div>'
      +'<div class="skfonts"><label class="skrow2"><span>UI-Schrift</span><input data-skfont="fu" value="'+esc(sk.fu||'')+'"></label><label class="skrow2"><span>Mono-Schrift</span><input data-skfont="fm" value="'+esc(sk.fm||'')+'"></label></div>';
    $('#skSel').onchange=function(){store.skin=this.value;applySkin();buildSkins();commit();};
    var _sb=$('#skBoth');if(_sb)_sb.onchange=function(){store.cfg=store.cfg||{};store.cfg.skinBoth=this.checked||undefined;commit();};
    $$('#skinpanel [data-sktheme]').forEach(function(b){b.onclick=function(){store.theme=b.getAttribute('data-sktheme');applySkin();buildSkins();commit();};});
    // oninput = Live-Vorschau (+ Auto-Fork bei eingebautem Skin); onchange (Picker zu) = Panel neu aufbauen (zeigt die Kopie/aktualisiert).
    $$('#skinpanel [data-sktok]').forEach(function(i){i.oninput=function(){editSkinToken(i.getAttribute('data-sktok'),i.value);};i.onchange=function(){buildSkins();};});
    $$('#skinpanel [data-skxname]').forEach(function(i){i.onchange=function(){renameSkinColor(i.getAttribute('data-skxname'),i.value);};});
    $$('#skinpanel [data-skxdel]').forEach(function(b){b.onclick=function(){deleteSkinColor(b.getAttribute('data-skxdel'));};});
    $$('#skinpanel [data-skfont]').forEach(function(i){i.oninput=function(){editSkinFont(i.getAttribute('data-skfont'),i.value);};});
    $('#skNew').onclick=function(){newSkin(false);};$('#skDup').onclick=function(){newSkin(true);};
    var _ac=$('#skAddColor');if(_ac)_ac.onclick=function(){var nm=prompt('Name der neuen Farbe:','Meine Farbe');if(nm)addSkinColor(nm);};
    var dl=$('#skDel');if(dl&&!dl.disabled)dl.onclick=deleteSkin;
  }
  // ---------- Einstellungen (Builder-Konfigurator) ----------
  function bcfg(){store.cfg=store.cfg||{};var c=store.cfg;if(c.gs==null)c.gs=8;if(c.gap==null)c.gap=12;if(c.defW==null)c.defW=1440;if(c.defH==null)c.defH=900;if(c.defFit==null)c.defFit='auto';if(c.autosave==null)c.autosave=true;if(c.mobileOpt==null)c.mobileOpt=true;if(c.mobileW==null)c.mobileW=640;if(c.wglow==null)c.wglow=false;if(c.refreshSec==null)c.refreshSec=15;if(c.chartAnim==null)c.chartAnim=false;return c;}
  /**
   * Vollansicht auf DIESEM Geraet erzwingen.
   *
   * Anlass: ein iPad gilt hier immer als mobil - der Zeiger ist grob und die
   * kuerzere Kante liegt bei 768 oder 820 Bildpunkten. Solange das Fenster gross
   * ist, faellt das nicht auf; sobald Safari es verkleinert (Slide Over, geteilte
   * Ansicht, Rueckkehr aus dem Hintergrund), kippt die Seite in die Mobilfassung
   * und bleibt dort.
   *
   * Einmal `?voll=1` aufrufen - das Geraet merkt es sich (localStorage), auch
   * ohne den Parameter in der Adresse. `?voll=0` hebt es wieder auf. Die
   * Einstellung gilt NUR fuer dieses Geraet; Telefone bleiben unberuehrt.
   */
  var _vollCache=null;
  function vollAnsicht(){
    if(_vollCache!==null)return _vollCache;
    var an=false;
    try{
      var m=String(location.search||'').match(/[?&](?:voll|desktop)=([01])/);
      if(m){an=(m[1]==='1');localStorage.setItem('lvvoll',an?'1':'0');}
      else an=(localStorage.getItem('lvvoll')==='1');
    }catch(e){}
    _vollCache=an;
    return an;
  }
  function isMobile(){
    if(vollAnsicht())return false;var w=window.innerWidth||0,h=window.innerHeight||0;if(w<=(bcfg().mobileW||640))return true;try{if(window.matchMedia&&window.matchMedia('(pointer:coarse)').matches&&Math.min(w,h)<=820)return true;}catch(e){}return false;} // coarse-Pointer (Touch) in beiden Ausrichtungen -> mobil
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
      +'<div class="skhint" style="font-size:11px;color:var(--muted);line-height:1.45;margin:2px 2px 8px">'
      +'Einzelnes Gerät immer in der Vollansicht: einmal <b>?voll=1</b> an die Adresse hängen — '
      +'das Gerät merkt es sich, auch ohne den Parameter. <b>?voll=0</b> hebt es wieder auf. '
      +(vollAnsicht()?'<b style="color:var(--accent)">Auf diesem Gerät ist die Vollansicht aktiv.</b>':'')
      +'</div>'
      +'<label class="skrow2"><span>Mobil-Startseite</span><select id="stMobHome"><option value="">(automatisch)</option>'+Object.keys(store.views||{}).map(function(n){return '<option'+(store.homeMobile===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>'
      +'<label class="skrow2"><span>Mobil-Ansicht für „'+esc(store.current||'')+'"</span><select id="stMobView"><option value="">(keine)</option>'+Object.keys(store.views||{}).map(function(n){return '<option'+((state.page&&state.page.mobileView)===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')+'</select></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stFitLock"'+((state.page&&state.page.fitLock)?' checked':'')+'><span>Fit sperren für „'+esc(store.current||'')+'" (immer Querformat, kein Mobil-Reflow)</span></label>'
      +'<div class="pgh">Live-Modus</div>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stHideNav"'+(c.hideRunNav?' checked':'')+'><span>Seitenumschalter (Hamburger) ausblenden</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stGlow"'+(c.wglow?' checked':'')+'><span>Widget-Glow (leichte Akzentfarbe)</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stNoFS"'+(c.noAutoFS?' checked':'')+'><span>Kein Auto-Vollbild beim ersten Klick</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stZoom"'+(c.allowZoom?' checked':'')+'><span>Zoom am Gerät erlauben (Pinch/Doppeltipp; wirkt nach Reload)</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stNoDbl"'+(c.noDblReload?' checked':'')+'><span>Doppeltipp auf die freie Fläche lädt NICHT neu</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stNoPoll"'+(c.noSafetyPoll?' checked':'')+'><span>Sicherheits-Poll abschalten (nur WebSocket)</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stChartAnim"'+(c.chartAnim?' checked':'')+'><span>Chart-Animationen (Standard aus)</span></label>'
      +'<label class="skrow2" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="stGlow"'+(c.wglow?' checked':'')+'><span>Leucht-Effekt um Widgets (Glow)</span></label>'
      +'<div class="hint" style="margin:2px 2px 0">Poll läuft ohnehin nur bei WS-Stille (&gt;5 s). Aus = reiner WebSocket; bei WS-Abbruch wird automatisch wieder gepollt.</div>'
      +'<label class="skrow2"><span>Standard-Aktualisierung Widgets (Sek.)</span><input id="stRefresh" type="number" min="1" max="600" value="'+(c.refreshSec||15)+'"></label>'
      +'<div class="hint" style="margin:2px 2px 0">Vorgabe für periodisch nachladende Widgets (z. B. Meldungen). Pro Widget überschreibbar. Minimum 1 s.</div>'
      +'<div class="pgh">Server (nur Info)</div>'
      +'<div class="hint" style="margin:4px 2px">Schreib-Token und WebSocket-Port werden serverseitig in <code>sites.php</code> / <code>hook.php</code> gesetzt — nicht im Builder.</div>';
    if($('#stAuto'))$('#stAuto').onchange=function(){bcfg().autosave=this.checked;commit();if(this.checked)scheduleSave();};
    $('#stGs').oninput=function(){var v=parseInt(this.value)||8;bcfg().gs=Math.max(1,v);GS=bcfg().gs;setCanvas();commit();};
    if($('#stGap'))$('#stGap').oninput=function(){bcfg().gap=Math.max(0,parseInt(this.value)||0);commit();};
    $('#stW').oninput=function(){bcfg().defW=Math.max(320,parseInt(this.value)||1440);commit();};
    $('#stH').oninput=function(){bcfg().defH=Math.max(240,parseInt(this.value)||900);commit();};
    $('#stFit').onchange=function(){bcfg().defFit=this.value;commit();};
    if($('#stHideNav'))$('#stHideNav').onchange=function(){bcfg().hideRunNav=this.checked||undefined;commit();if(document.body.classList.contains('run'))document.body.classList.toggle('nohamb',this.checked);toast('Seitenumschalter '+(this.checked?'ausgeblendet':'sichtbar'));};
    if($('#stGlow'))$('#stGlow').onchange=function(){bcfg().wglow=this.checked||undefined;document.body.classList.toggle('wglow',this.checked);commit();toast('Widget-Glow '+(this.checked?'an':'aus'));};
    if($('#stNoFS'))$('#stNoFS').onchange=function(){bcfg().noAutoFS=this.checked||undefined;commit();toast('Auto-Vollbild '+(this.checked?'aus':'an')+' (wirkt nach Reload)');};
    if($('#stZoom'))$('#stZoom').onchange=function(){bcfg().allowZoom=this.checked||undefined;commit();toast('Geräte-Zoom '+(this.checked?'erlaubt':'gesperrt')+' (wirkt nach Reload)');};
    if($('#stNoDbl'))$('#stNoDbl').onchange=function(){bcfg().noDblReload=this.checked||undefined;commit();toast('Doppeltipp-Neuladen '+(this.checked?'aus':'an')+' (wirkt nach Reload)');};
    if($('#stNoPoll'))$('#stNoPoll').onchange=function(){bcfg().noSafetyPoll=this.checked||undefined;commit();toast('Sicherheits-Poll '+(this.checked?'aus':'an')+' (wirkt nach Reload)');};
    if($('#stChartAnim'))$('#stChartAnim').onchange=function(){bcfg().chartAnim=this.checked||undefined;commit();render();toast('Chart-Animationen '+(this.checked?'an':'aus'));};
    // Glow ist reine Optik: Klasse direkt umschalten (applySkin setzt sie ebenfalls).
    if($('#stGlow'))$('#stGlow').onchange=function(){bcfg().wglow=this.checked||undefined;document.body.classList.toggle('wglow',this.checked);commit();toast('Widget-Glow '+(this.checked?'an':'aus'));};
    if($('#stRefresh'))$('#stRefresh').oninput=function(){bcfg().refreshSec=Math.max(1,Math.min(600,parseInt(this.value)||15));commit();};
    if($('#stMob'))$('#stMob').onchange=function(){bcfg().mobileOpt=this.checked;commit();};
    if($('#stMobW'))$('#stMobW').oninput=function(){bcfg().mobileW=Math.max(320,parseInt(this.value)||640);commit();};
    if($('#stMobHome'))$('#stMobHome').onchange=function(){store.homeMobile=this.value||undefined;commit();};
    if($('#stMobView'))$('#stMobView').onchange=function(){if(!state.page)return;if(this.value)state.page.mobileView=this.value;else delete state.page.mobileView;commit();};
    if($('#stFitLock'))$('#stFitLock').onchange=function(){if(!state.page)return;if(this.checked)state.page.fitLock=true;else delete state.page.fitLock;commit();if(typeof fitCanvas==='function')fitCanvas();};
    $('#stSkin').onchange=function(){store.skin=this.value;applySkin();buildSkins();commit();};
  }
  // Icon-Bibliothek
