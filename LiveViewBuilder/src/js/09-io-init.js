  function buildIconLib(q){
    var box=$('#iconLib');if(!box)return;box.innerHTML='';q=(q||'').toLowerCase();
    // Ganz oben "kein Icon". Ohne diesen Eintrag laesst sich ein einmal gewaehltes
    // Icon nur tauschen, nie entfernen - die Bibliothek kennt sonst nur Icons.
    if(!q){
      var kh=document.createElement('div');kh.className='iconcat';kh.textContent='Entfernen';box.appendChild(kh);
      var kg=document.createElement('div');kg.className='icongrid';
      var kb=document.createElement('div');kb.className='iconbtn';kb.title='kein Icon (entfernt das gewählte Icon)';
      kb.innerHTML='<svg class="ic24" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>';
      kb.onclick=function(){assignIcon('');};
      kg.appendChild(kb);box.appendChild(kg);
    }
    var cats={};Object.keys(ICONS).forEach(function(id){var e=ICONS[id];if(q&&id.toLowerCase().indexOf(q)<0&&e[0].toLowerCase().indexOf(q)<0&&(e[2]||'').indexOf(q)<0)return;(cats[e[0]]=cats[e[0]]||[]).push(id);});
    Object.keys(cats).forEach(function(cat){
      var h=document.createElement('div');h.className='iconcat';h.textContent=cat;box.appendChild(h);
      var g=document.createElement('div');g.className='icongrid';
      cats[cat].forEach(function(id){var b=document.createElement('div');b.className='iconbtn';b.title=id;b.innerHTML=iconSVG(id);b.onclick=function(){assignIcon(id);};g.appendChild(b);});
      box.appendChild(g);
    });
    // ---- Familie „Adaptiv": dynamische Zustands-Icons, gruppiert nach Variablentyp ----
    var adaptGroups=[
      {k:'pct',  cat:'Adaptiv · Füllstand / Helligkeit  (0–100 %)', pv:70,         tip:'0–100 % (Float/Dimmer) · Boolean = voll/leer'},
      {k:'state',cat:'Adaptiv · Zustand  (auf / zu / an)',          pv:1,          tip:'Boolean an/aus · Integer 0·1·2 · Text auf/zu/kipp'},
      {k:'raw',  cat:'Adaptiv · Roboter-Status',                    pv:'arbeitet', tip:'Status-Text (lädt/arbeitet/sucht/fährt ein/aus) · Integer 1–5'}
    ];
    adaptGroups.forEach(function(gr){
      var ids=Object.keys(AICONS).filter(function(id){return AICONS[id].k===gr.k&&(!q||id.toLowerCase().indexOf(q)>=0||'adaptiv'.indexOf(q)>=0);});
      if(!ids.length)return;
      var ha=document.createElement('div');ha.className='iconcat';ha.textContent=gr.cat;box.appendChild(ha);
      var ga=document.createElement('div');ga.className='icongrid';
      ids.forEach(function(id){var b=document.createElement('div');b.className='iconbtn';b.title=id+' · adaptiv · '+gr.tip;b.innerHTML=iconSVG(id,gr.pv);b.onclick=function(){assignIcon(id);};ga.appendChild(b);});
      box.appendChild(ga);
    });
    if(!box.children.length)box.innerHTML='<div class="hint">Nichts gefunden.</div>';
  }
  $('#iconSearch').addEventListener('input',function(){buildIconLib(this.value);});
  $('#gridBtn').onclick=function(){gridOn=!gridOn;this.classList.toggle('on',gridOn);canvas.classList.toggle('grid',gridOn);};
  $('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
  $('#modeBtn').onclick=function(){mode=(mode==='edit')?'preview':'edit';stage.classList.toggle('edit',mode==='edit');stage.classList.toggle('preview',mode==='preview');this.textContent=(mode==='edit')?'Vorschau':'Bearbeiten';this.classList.toggle('on',mode==='preview');if(mode==='preview')select(null);};

  // ---------- Ansichten (Views) ----------
  // Popup = Seite, die ueber einer anderen geoeffnet wird. Sie bekommt NIE Bar oder Sidebar.
  // Frueher wurde das allein daraus geschlossen, dass irgendein Widget per popupTo/longPopup
  // darauf zeigt. Eine frisch angelegte Popup-Seite hat aber noch keinen Verweis - sie galt
  // deshalb als normale Seite und bekam die Leisten. Jetzt entscheidet ein ausdrueckliches
  // Kennzeichen an der Seite; der alte Rueckschluss bleibt fuer bestehende Ansichten erhalten.
  function _isPopupView(name){
    if(name===store.home)return false;                      // die Startseite ist nie Popup
    var v=store.views[name];
    if(v&&v.page&&v.page.popup)return true;                 // ausdruecklich so angelegt
    for(var vn in store.views){var ws=(store.views[vn].widgets)||[];for(var i=0;i<ws.length;i++){if(ws[i].popupTo===name||ws[i].longPopup===name)return true;}}
    return false;
  }
  // Optionen fuer Ziel-Selektoren. kind: 'page' = nur normale Seiten, 'popup' = nur Popups, sonst alle.
  // Der aktuell gesetzte Wert bleibt immer waehlbar (auch wenn er inzwischen der anderen Art ist).
  function viewOpts(cur,kind,ph){
    var all=Object.keys(store.views).filter(function(n){
      if(kind==='page')return !_isPopupView(n);
      if(kind==='popup')return _isPopupView(n);
      return true;
    }).sort(function(a,b){return a.localeCompare(b,'de',{sensitivity:'base'});});
    if(cur&&all.indexOf(cur)<0)all.unshift(cur);   // bestehende (evtl. abweichende) Auswahl behalten
    return '<option value="">'+(ph||'—')+'</option>'+all.map(function(n){return '<option value="'+esc(n)+'"'+(cur===n?' selected':'')+'>'+esc(n)+'</option>';}).join('');
  }
  function refreshViewSel(){var s=$('#viewSel');
    if(s){s.innerHTML=''; // optionales Dropdown (falls vorhanden) fuellen ...
      var all=Object.keys(store.views),cmp=function(a,b){return a.localeCompare(b,'de',{sensitivity:'base'});};
      var pages=all.filter(function(n){return !_isPopupView(n);}).sort(cmp);   // normale Seiten (S), alphabetisch
      var pops=all.filter(_isPopupView).sort(cmp);                             // Popups (P), alphabetisch
      var add=function(list,badge){list.forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=badge+' · '+n+(n===store.home?'  · Start':'');if(n===store.current)o.selected=true;s.appendChild(o);});};
      add(pages,'S');add(pops,'P');
    }
    if(typeof buildPageTree==='function')buildPageTree(); // ... die Treeview aber IMMER bauen (auch ohne Dropdown)
  }
  function reseq(){seq=1;var all=[];
    // Container-Kinder MITZÄHLEN – sonst vergibt uid() IDs, die ein Kind (z. B. ein Toggle) schon hat,
    // und beim Selektieren greifen zwei Widgets zugleich. Zusätzlich Duplikate heilen (späteres bekommt neue ID).
    function collect(w){if(!w)return;all.push(w);var n=parseInt(String(w.id||'w0').replace('w',''))||0;if(n>=seq)seq=n+1;if(w.kids)w.kids.forEach(collect);}
    (state.widgets||[]).forEach(collect);
    var seen={};all.forEach(function(w){if(!w.id||seen[w.id]){w.id='w'+(seq++);}seen[w.id]=1;});}
  function switchView(name){if(!store.views[name])return;store.current=name;state=store.views[name];if(!state.page)state.page={w:1440,h:900};if(!state.widgets)state.widgets=[];selId=null;sel={};reseq();refreshViewSel();setCanvas();invalidateSC();_scMode='';document.body.classList.remove('reflow');restoring=true;render();restoring=false;renderProps();resetHist();chromeUI();} // render() macht bereits Kamera/HTML-Init + Sofort-Poll (kein doppeltes Rendern mehr)
  function newView(asPopup){
    var n=prompt(asPopup?'Name des neuen Popups:':'Name der neuen Ansicht:',
                 (asPopup?'Popup ':'Ansicht ')+(Object.keys(store.views).length+1));
    if(!n)return;
    if(store.views[n]){toast('Name existiert bereits');return;}
    // Popups sind kleiner als eine Seite und tragen das Kennzeichen von Anfang an - sonst
    // wuerden sie bis zum ersten Verweis mit Bar und Sidebar gezeichnet.
    var pg=asPopup?{w:500,h:400,fit:'letterbox',popup:true}
                  :{w:bcfg().defW,h:bcfg().defH,fit:bcfg().defFit};
    store.views[n]={page:pg,widgets:[]};
    switchView(n);
    toast((asPopup?'Popup angelegt: ':'Ansicht angelegt: ')+n);
  }
  function _maxWid(){var mx=0;Object.keys(store.views).forEach(function(vn){(function walk(list){(list||[]).forEach(function(x){var num=parseInt(String(x.id||'w0').replace('w',''))||0;if(num>mx)mx=num;if(x.kids)walk(x.kids);});})(store.views[vn].widgets);});return mx;}
  function dupView(){ // ganze Ansicht/Popup duplizieren (Seite + alle Widgets, frische IDs)
    var old=store.current;if(!old||!store.views[old])return;
    var isPop=!!(store.views[old].page&&store.views[old].page.popup);
    var def=old+' Kopie',i=2;while(store.views[def]){def=old+' Kopie '+i;i++;}   // eindeutiger Vorschlag
    var n=prompt(isPop?'Name des duplizierten Popups:':'Name der duplizierten Ansicht:',def);
    if(n===null)return;n=n.trim();if(!n)return;
    if(store.views[n]){toast('Name existiert bereits');return;}
    var clone=JSON.parse(JSON.stringify(store.views[old])); // tiefe Kopie inkl. page(+popup) und widgets(+kids)
    var seq=_maxWid()+1;(function walk(list){(list||[]).forEach(function(x){x.id='w'+(seq++);if(x.kids)walk(x.kids);});})(clone.widgets);
    store.views[n]=clone;switchView(n);commit();   // switchView -> refreshViewSel -> buildPageTree (erscheint als Orphan unter „Nicht verlinkt", bis etwas darauf verweist)
    toast((isPop?'Popup':'Ansicht')+' dupliziert: '+n);
  }
  function _renameViewRefs(old,n){ // alle Verweise auf einen Ansichtsnamen mitziehen (Actions, Home, Mobil)
    var cnt=0;Object.keys(store.views).forEach(function(vn){var v=store.views[vn];
      if(v.page&&v.page.mobileView===old){v.page.mobileView=n;cnt++;}
      (v.widgets||[]).forEach(function(w){['popupTo','longPopup','navTo','longNav','regView','thCalView','thCalNav'].forEach(function(k){if(w[k]===old){w[k]=n;cnt++;}});});
    });
    if(store.home===old)store.home=n;if(store.homeMobile===old)store.homeMobile=n;
    return cnt;}
  function renameView(){var old=store.current;if(!old)return;var n=prompt('Ansicht umbenennen:',old);if(!n||n===old)return;if(store.views[n]){toast('Name existiert bereits');return;}store.views[n]=store.views[old];delete store.views[old];store.current=n;var rc=_renameViewRefs(old,n);refreshViewSel();commit();toast('Umbenannt'+(rc?' · '+rc+' Verweis(e) angepasst':''));}
  function deleteView(){var n=store.current;if(!n)return;if(!confirm('Ansicht „'+n+'" wirklich löschen?'))return;delete store.views[n];var keys=Object.keys(store.views);if(!keys.length){store.views['Ansicht 1']={page:{w:1440,h:900},widgets:[]};keys=['Ansicht 1'];}switchView(keys[0]);toast('Gelöscht');}
  if($('#viewSel'))$('#viewSel').onchange=function(){switchView(this.value);}; // Dropdown entfernt - Umschalten via Seiten-Treeview
  $('#newView').onclick=function(){newView(false);};
  if($('#newPopup'))$('#newPopup').onclick=function(){newView(true);};$('#renView').onclick=renameView;$('#delView').onclick=deleteView;
  if($('#dupView'))$('#dupView').onclick=dupView;
  $('#homeBtn').onclick=function(){store.home=store.current;refreshViewSel();toast('Startseite: '+store.current+' (Speichern nicht vergessen)');};
  $('#cvW').addEventListener('change',function(){state.page.w=Math.max(320,parseInt(this.value)||1440);setCanvas();});
  $('#cvH').addEventListener('change',function(){state.page.h=Math.max(240,parseInt(this.value)||900);setCanvas();});
  $('#zoomIn').onclick=function(){setZoom(zoom*1.15);};
  $('#zoomOut').onclick=function(){setZoom(zoom/1.15);};
  $('#zoomLbl').onclick=function(){setZoom(Math.abs(zoom-1)<1e-4?fitZoom():1);};
  stage.addEventListener('wheel',function(e){if(!(e.ctrlKey||e.metaKey)||document.body.classList.contains('run'))return;e.preventDefault();var r=canvas.getBoundingClientRect(),cx=(e.clientX-r.left)/zoom,cy=(e.clientY-r.top)/zoom,z0=zoom;setZoom(zoom*(e.deltaY<0?1.1:1/1.1));var sc=zoom/z0;stage.scrollLeft+=cx*(sc-1)*z0;stage.scrollTop+=cy*(sc-1)*z0;},{passive:false});
  if($('#cvPopup'))$('#cvPopup').addEventListener('change',function(){
    state.page.popup=this.checked||undefined;   // Kennzeichen an der Seite, nicht am Widget
    render();refreshViewSel();commit();
    toast(this.checked?'Popup: Bar und Sidebar werden hier nicht gezeichnet':'Wieder eine normale Seite');
  });
  $('#cvFit').addEventListener('change',function(){state.page.fit=this.value;invalidateSC();commit();renderProps();drawStructure();if(document.body.classList.contains('run'))fitCanvas();toast('Anpassung: '+this.value+(document.body.classList.contains('run')?'':' — im Live-Modus sichtbar'));});
  if($('#cvFrame'))$('#cvFrame').addEventListener('change',function(){state.page.noframe=this.checked?undefined:true;render();commit();toast('Kachel-Rahmen (Ansicht): '+(this.checked?'an':'aus'));});
  $('#structBtn').addEventListener('click',function(){_showStruct=!_showStruct;this.classList.toggle('on',_showStruct);drawStructure();});
  $('#themeBtn').addEventListener('click',function(){store.theme=(store.theme==='light'?'dark':'light');applySkin();buildSkins();commit();});
  (function(){var sr=$('#sideResize'),side=$('.side'),sd=null;if(!sr||!side)return;
    sr.addEventListener('mousedown',function(e){e.preventDefault();sd={x:e.clientX,w:side.offsetWidth};sr.classList.add('drag');document.body.style.cursor='ew-resize';});
    window.addEventListener('mousemove',function(e){if(!sd)return;side.style.width=Math.max(240,Math.min(760,sd.w+(sd.x-e.clientX)))+'px';});
    window.addEventListener('mouseup',function(){if(!sd)return;sd=null;sr.classList.remove('drag');document.body.style.cursor='';bcfg().sideW=side.offsetWidth;commit();});
  })();

  // ---------- Speichern / Laden (alle Ansichten) ----------
  var _saveT=null,_dirty=false,_target='';
  function markDirty(){_dirty=true;var b=$('#saveBtn');if(b)b.classList.add('dirty');}
  function markSaved(){_dirty=false;var b=$('#saveBtn');if(b)b.classList.remove('dirty');}
  /**
   * Laufzeitfelder beim Speichern weglassen. Alles, was mit einem Unterstrich beginnt, ist im
   * ganzen Bestand Arbeitszustand: geholte Tabellenzeilen (_tblRows), Diagramm-Historie (_hist),
   * Auswahl und Blaetterstand (_tblPage, _mxOff), Zeitstempel des letzten Kamerabilds (_lastCam).
   * Es wird beim Aufbau ohnehin neu befuellt - gespeichert blaeht es nur die Ansicht auf.
   *
   * Gemessen am 20.08.2026: 27 % aller Seitendateien bestanden aus solchen Feldern, die
   * Rollos-Log-Seite zu 100 % (25 KB geholte Zeilen), die Batterie-Seite zu 97 %. Eine Tabelle
   * mit ein paar hundert Zeilen schreibt so ihren kompletten Inhalt ins Layout - und liefert
   * ihn beim naechsten Laden als veralteten Stand wieder aus.
   */
  function _ohneLaufzeit(k,v){return (k.charAt(0)==='_')?undefined:v;}
  function saveStore(silent){
    // NIE im Doku-Modus speichern: die Doku baut ihren Store aus der Registry (buildDokuStore)
    // und darf das echte Live-Layout niemals ueberschreiben. Bulletproof-Guard, egal welcher Pfad ruft.
    if(typeof DOKU!=='undefined'&&DOKU){if(!silent&&typeof toast==='function')toast('Doku-Modus: nichts gespeichert');return Promise.resolve();}
    // UND NIE AUS EINER LAUFZEIT-ANSICHT. Eine Anzeige ist kein Editor.
    //
    // Am 24.08.2026 verschwand dreimal eine frisch gesetzte Kachel wieder, obwohl der
    // Builder geschlossen war. Der Grund: `commit()` kennt keinen Betriebsmodus, und
    // `scheduleSave()` schickt anderthalb Sekunden spaeter den GANZEN Store. Jede
    // Laufzeit-Ansicht - Wandtablet, Handy, ein vergessener Tab - traegt ihren Stand
    // von IHREM Ladezeitpunkt mit sich herum und schreibt ihn bei der ersten
    // Gelegenheit ueber alles, was inzwischen geaendert wurde. Je laenger die Ansicht
    // offen ist, desto aelter der Stand, den sie zurueckschreibt.
    if(typeof RUN!=='undefined'&&RUN){return Promise.resolve();}
    return fetch('?api=layout&key='+encodeURIComponent(TOKEN)+(_target?('&file='+encodeURIComponent(_target)):''),{method:'POST',body:JSON.stringify(store,_ohneLaufzeit)})
      .then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){markSaved();if(!silent)toast('Gespeichert: '+(_target||'Standard (live)')+' ('+j.bytes+' B)');}
        else if(!silent)toast('Fehler: '+((j&&j.error)||'?'));
      }).catch(function(){if(!silent)toast('Speichern fehlgeschlagen');});
  }
  function scheduleSave(){if(typeof RUN!=='undefined'&&RUN)return;if(!bcfg().autosave)return;clearTimeout(_saveT);_saveT=setTimeout(function(){saveStore(true);},1500);}
  function buildLayoutList(){var s=$('#layoutSel');if(!s)return;fetch('?api=layout&list=1',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
    var files=(j&&j.files)||[];if(!files.some(function(f){return f.file==='';}))files.unshift({file:'',name:'Standard (live)'});
    s.innerHTML=files.map(function(f){return '<option value="'+esc(f.file)+'"'+(f.file===_target?' selected':'')+'>'+esc(f.name)+'</option>';}).join('');
  }).catch(function(){});}
  function saveAs(){var nm=prompt('Layout speichern unter (Name):','Variante '+new Date().toLocaleDateString());if(!nm)return;var slug=nm.replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');if(!slug){toast('Ungültiger Name');return;}_target=slug;saveStore(false).then(function(){buildLayoutList();});}
  $('#saveBtn').onclick=function(){saveStore(false);};
  $('#saveAsBtn').onclick=saveAs;
  if($('#publishBtn'))$('#publishBtn').onclick=function(){saveStore(false);fetch('?api=publish&key='+encodeURIComponent(TOKEN),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){toast(j&&j.ok?'Veröffentlicht — Anzeigen werden neu geladen':'Gespeichert (kein Push-Ziel gefunden)');}).catch(function(){toast('Veröffentlichen fehlgeschlagen');});};
  $('#layoutSel').addEventListener('change',function(){_target=this.value;load();});
  function doImport(media){
    fetch('?api=import'+(media?('&media='+media):''),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(!j||!j.views||!Object.keys(j.views).length){toast('Import: '+((j&&j.error)||'keine Seiten gefunden'));return;}
      var cnt=0;for(var n in j.views){store.views[n]=j.views[n];cnt++;}
      migrateStore(store); // importierte Seiten koennen alte Typnamen enthalten
      switchView(j.current||Object.keys(j.views)[0]);
      toast('Importiert: '+cnt+' Seite(n) — jetzt „Speichern" nicht vergessen');
    }).catch(function(){toast('Import fehlgeschlagen');});
  }
  function showIpsPicker(list){
    var old=$('#ipspick');if(old)old.remove();
    var ov=document.createElement('div');ov.id='ipspick';
    ov.innerHTML='<div class="ipspick-card"><div class="ipspick-h">IPSView importieren<button class="ipspick-x" title="Schließen">&times;</button></div><div class="ipspick-list"></div><div class="ipspick-f">Die gewählte Ansicht wird als neue Seite(n) übernommen. Gleichnamige werden ersetzt — danach „Speichern".</div></div>';
    document.body.appendChild(ov);
    var lst=ov.querySelector('.ipspick-list');
    list.forEach(function(v){var b=document.createElement('button');b.className='ipspick-item';b.innerHTML='<span class="ipspick-nm">'+esc(v.name||('#'+v.id))+'</span><span class="ipspick-file">'+esc(v.file||'')+' · #'+v.id+'</span>';b.onclick=function(){ov.remove();doImport(v.id);};lst.appendChild(b);});
    function close(){ov.remove();}
    ov.querySelector('.ipspick-x').onclick=close;
    ov.addEventListener('click',function(e){if(e.target===ov)close();});
    document.addEventListener('keydown',function esc_(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc_);}});
  }
  $('#importBtn').onclick=function(){
    fetch('?api=ipsviews',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      var vs=(j&&j.views)||[];
      if(!vs.length){if(confirm('Keine IPSView-Medienobjekte gefunden. Konfigurierte Standard-Quelle importieren?'))doImport(0);return;}
      showIpsPicker(vs);
    }).catch(function(){toast('IPSView-Liste konnte nicht geladen werden');});
  };
  function lvSite(){var p=location.pathname,m=p.match(/\/hook\/(?:builder|run)\/([^\/?#]+)/);if(m)return decodeURIComponent(m[1]);m=p.match(/\/hook\/([^\/?#]+)/);return m?decodeURIComponent(m[1]):'';}
  function lvPage(){var m=location.pathname.match(/\/hook\/(?:builder|run)\/[^\/?#]+\/([^\/?#]+)/);return m?decodeURIComponent(m[1]):'';} // 3. Segment = Seite
  $('#liveBtn').onclick=function(){
    var site=lvSite(),page=store.current||'';
    if(site&&page){window.open(location.origin+'/hook/run/'+encodeURIComponent(site)+'/'+encodeURIComponent(page),'_blank');} // /hook/run/<view>/<seite>
    else{window.open('?run=1'+(page?'&view='+encodeURIComponent(page):''),'_blank');}
  };
  $('#runmenu').onclick=function(){$('#runlist').classList.toggle('open');};
  function load(){
    // Doku-Modus: nichts laden. Der Store entsteht aus der Widget-Registry, damit die
    // Seite ohne gespeicherte Ansicht funktioniert und nie veraltet.
    if(typeof DOKU!=='undefined'&&DOKU){
      // Die Erklaerungen (DOKU_INFO, ~240 KB) liegen NICHT in builder.html - sonst
      // spraengte die Seite das 1-MB-Ausgabelimit der Hook-Schicht und ALLE Seiten
      // stuerben. Sie werden als eigenes Skript nachgeladen, nur hier im Doku-Modus.
      var _dfin=function(){
        if(typeof dokuSeed==='function')dokuSeed();
        if(typeof dokuInstallFetch==='function')dokuInstallFetch();
        if(typeof dokuFitWidth==='function')dokuFitWidth(); // Inhaltsbreite = Fensterbreite (normale Schrift, kein Zoom)
        store=buildDokuStore();
        var _dv=(location.search.match(/[?&]dokuview=([^&]*)/)||[])[1];
        if(_dv){_dv=decodeURIComponent(_dv).toLowerCase();
          for(var vn in store.views){if(vn.toLowerCase().indexOf(_dv)>=0){store.current=vn;store.home=vn;break;}}}
        applySkin();GS=bcfg().gs;
        switchView(store.current);buildSwatches();buildIconLib();buildBlocks();buildSkins();buildSettings();
        buildLayoutList();syncPalette();decoratePalette();chromeUI();
        // Doku standardmaessig als Voll-Reader (Run: volle Fensterbreite, normale Schrift, vertikal scrollend,
        // Seiten ueber das ☰-Menue). Editierbare Builder-Doku nur noch mit ?edit=1.
        if(RUN||!/[?&]edit=1/.test(location.search)){enterRun();}
        else{mode='preview';stage.classList.remove('edit');stage.classList.add('preview');
          toast('Dokumentation: '+Object.keys(WIDGETS).length+' Widgets auf '+Object.keys(store.views).length+' Seiten');}
        // Die Hoehe der Ueberschriften wird GEMESSEN (dokuTextH), damit sie auf schmalen
        // Fenstern mit dem Zeilenumbruch mitwaechst. Sind die eigenen Schriften beim ersten
        // Aufbau noch nicht geladen, misst der Browser mit der Ersatzschrift - die Zeilenzahl
        // kann dann danebenliegen. Darum einmalig neu aufbauen, sobald die Schriften da sind.
        try{
          if(document.fonts&&document.fonts.status!=='loaded'&&document.fonts.ready){
            document.fonts.ready.then(function(){
              var _c=store&&store.current,_h=store&&store.home;
              store=buildDokuStore();
              if(_c&&store.views[_c])store.current=_c;
              if(_h&&store.views[_h])store.home=_h;
              switchView(store.current);
            });
          }
        }catch(_e){}
      };
      if(typeof DOKU_INFO!=='undefined'){_dfin();}
      else{var _ds=document.createElement('script');_ds.src='?api=asset&name=dokudata&v={{DOKUVER}}';
        _ds.onload=_dfin;_ds.onerror=_dfin;document.head.appendChild(_ds);}
      return;
    }
    fetch('?api=layout'+(_target?('&file='+encodeURIComponent(_target)):''),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.views&&Object.keys(j.views).length){store=j;if(!store.current||!store.views[store.current])store.current=Object.keys(store.views)[0];}
      else if(j&&j.widgets){store={views:{'Ansicht 1':j},current:'Ansicht 1'};} // Migration altes Einzel-Format
      else{store={views:{'Ansicht 1':{page:{w:1440,h:900},widgets:[]}},current:'Ansicht 1'};}
      migrateStore(store); // Typ-Migration (js/11-migrate.js): alte Einzel-Typen -> Sammel-Typ + Variante. MUSS vor dem ersten Rendern laufen
      invalidateAllIds(); // Warm-Cache-ID-Menge nach (Neu-)Laden neu berechnen
      if(!store.skin)store.skin='Standard';if(!store.theme)store.theme='dark';
      // Geraete-Vorlieben im Betrieb. Hell/Dunkel ist persoenlich und bleibt gemerkt.
      // Der SKIN dagegen ist eine Entscheidung des Layouts: eine einmal am Geraet
      // getroffene Wahl hat frueher dauerhaft gewonnen, auch wenn im Builder laengst ein
      // anderer Skin eingestellt wurde. Das war unsichtbar und nicht zu beheben, ausser
      // man kannte den Speicherschluessel. Jetzt wird zur Wahl auch der Layout-Stand
      // vermerkt: aendert sich dieser, faellt die Geraete-Wahl weg und das Layout gilt.
      if(RUN){try{
        var _lt=localStorage.getItem('lvtheme'); if(_lt)store.theme=_lt;
        var _ls=localStorage.getItem('lvskin'), _lb=localStorage.getItem('lvskinbase');
        if(_ls&&allSkins()[_ls]&&(!_lb||_lb===store.skin)){ store.skin=_ls; }
        else if(_ls){ localStorage.removeItem('lvskin'); localStorage.removeItem('lvskinbase'); }
      }catch(_){}}
      applySkin();GS=bcfg().gs;if(bcfg().sideW){var _sd=$('.side');if(_sd)_sd.style.width=bcfg().sideW+'px';}
      var _sv=VIEWNAME||lvPage();switchView((_sv&&store.views&&store.views[_sv])?_sv:store.current);buildSwatches();buildIconLib();buildBlocks();buildSkins();buildSettings();buildLayoutList();syncPalette();decoratePalette();chromeUI(); // ?view= auch im Edit-Modus berücksichtigen; syncPalette ergänzt fehlende Registry-Widgets
      if(!RUN&&!DOKU&&typeof loadBuilderSettings==='function')loadBuilderSettings(); // Zoom/Tab/Schwebemodus aus builder-settings.json
      if(RUN){enterRun();}else{toast('Geladen: '+(_target||'Standard')+' · '+Object.keys(store.views).length+' Ansicht(en)');}
    }).catch(function(err){
      // ACHTUNG: Dieser catch umschliesst die GESAMTE Kette oben - migrateStore, switchView,
      // buildBlocks, buildIconLib, buildSettings und jedes Widget-render. Frueher nahm er den
      // Fehler nicht einmal entgegen und ersetzte den Speicher stillschweigend durch eine leere
      // Ansicht. Sichtbares Ergebnis: leere Arbeitsflaeche, KEINE Meldung, kein roter Balken -
      // denn eine abgefangene Zurueckweisung loest 'unhandledrejection' nie aus. Ein Boot-Fehler
      // muss laut sein, sonst sucht man ihn blind. Die leere Ansicht bleibt als Notanker, damit
      // der Builder bedienbar ist, aber NIE mehr ohne Hinweis.
      try{console.error('[LVB] load() fehlgeschlagen:',err);}catch(_){}
      if(!RUN&&window.__diag){
        window.__diag('LADEFEHLER beim Start: '+((err&&(err.stack||err.message))||err||'?')
          +'\nDie Arbeitsflaeche ist deshalb leer - der gespeicherte Stand wurde NICHT geaendert.');
      }
      store={views:{'Ansicht 1':{page:{w:1440,h:900},widgets:[]}},current:'Ansicht 1'};switchView('Ansicht 1');if(RUN)enterRun();
    });
  }

  // ---------- Runtime (Vollbild-Anzeige) ----------
  // ============ SmartFit — adaptiver Autoscaler (fuellt jeden Viewport, minimiert Scroll) ============
  var SMART_DEF={reflowLo:0.55,phoneW:500,minScale:0.5,gap:8,growCap:2.6,kMin:0.72,kMax:1.9};
  // dial:1 wirkt hier nicht mehr direkt — 'dial' ist seit der Regler-Zusammenlegung KEIN eigener
  // w.type mehr, sondern die Variante rmode='dial' des Widgets 'slider'. _sfKey() unten übersetzt
  // dafür auf den Schlüssel 'dial', damit dieser Eintrag weiterhin greift (Dial soll wie zuvor
  // strecken/rund bleiben, nicht wie ein normaler Regler frei skalieren).
  var SF_STRETCH={chart:1,sankey:1,camera:1,campro:1,camarray:1,calendar:1,devlist:1,statuslist:1,ticker:1,tempbar:1,statusgrid:1,meterlist:1,infolist:1,kpi:1,image:1,statusimage:1,select:1,shape:1,dial:1,webview:1,weekplan:1,skinswitch:1,weatherpro:1,suncard:1,media:1,html:1,bar:1,line:1,gauge:1,gaugepro:1,valuecard:1,flow:1};
  var SF_LOCK={chart:1,camera:1,campro:1,camarray:1,media:1,sankey:1,html:1,calendar:1,devlist:1,statuslist:1};
  var SF_NOGROW={chip:1,button:1,icon:1,clock:1,switch:1,sun:1};
  var SF_PRIO={chart:3,camera:3,campro:3,camarray:3,flow:3,sankey:3,gaugepro:3,html:3,chip:1,button:1,icon:1,clock:1,switch:1,sun:1};
  var _scCache=null,_scView=null,_scMode='';
  function invalidateSC(){_scCache=null;}
  function sfCfg(p){var c=(p&&p.smart)||{},o={},k;for(k in SMART_DEF)o[k]=(c[k]!=null?c[k]:SMART_DEF[k]);return o;}
  // Effektiver Tabellen-Schluessel: normalerweise w.type, aber der Regler meldet fuer die
  // Dial-Variante 'dial', damit SF_STRETCH/SF_PRIO wie vor der Zusammenlegung greifen.
  function _sfKey(w){if(w.type==='slider'&&typeof _rMode==='function'&&_rMode(w)==='dial')return 'dial';return w.type;}
  function sfClass(w){if(w.fit==='stretch')return 's';var k=_sfKey(w);if((w.fit==='scale'||w.fit==='fix')&&!SF_LOCK[k])return 'x';return SF_STRETCH[k]?'s':'x';}
  function sfPrio(w){return w.prio||SF_PRIO[_sfKey(w)]||2;}
  function effFit(p){return (p&&p.fit)||'letterbox';}
  function sfSnap(v){return Math.round(v/10)*10;}
  function sfClamp(v,a,b){return v<a?a:(v>b?b:v);}
  function sfTracks(ax,D){
    var pos=ax,sz=ax==='x'?'w':'h',e={},i;e[0]=1;e[D]=1;
    state.widgets.forEach(function(w){e[sfSnap(w[pos])]=1;e[sfSnap(w[pos]+w[sz])]=1;});
    var pts=Object.keys(e).map(Number).sort(function(a,b){return a-b;}),T=[];
    for(i=0;i<pts.length-1;i++)T.push({d0:pts[i],size:pts[i+1]-pts[i],w:0});
    var minT=Math.max(10,0.02*D);
    for(i=T.length-1;i>0;i--)if(T[i].size<minT){T[i-1].size+=T[i].size;T.splice(i,1);}
    return T.length?T:[{d0:0,size:D,w:0}];
  }
  function sfWeigh(T,ax){
    var pos=ax,sz=ax==='x'?'w':'h';
    state.widgets.forEach(function(w){var a=w[pos],b=a+w[sz],cw=(sfClass(w)==='s'?1:0.15)*sfPrio(w);if(SF_NOGROW[w.type])cw=0;
      T.forEach(function(t){if(t.d0>=a-0.5&&t.d0+t.size<=b+0.5)t.w=Math.max(t.w,cw);});});
  }
  function sfBands(){
    var ws=state.widgets.slice().sort(function(a,b){return (a.y-b.y)||(a.x-b.x);}),bands=[],cur=null,bot=0;
    ws.forEach(function(w){var yc=w.y+w.h/2;if(cur&&yc<bot){cur.push(w);if(w.y+w.h*0.6>bot)bot=w.y+w.h*0.6;}else{cur=[w];bands.push(cur);bot=w.y+w.h*0.6;}});
    bands.forEach(function(b){b.sort(function(a,c){return a.x-c.x;});});
    return bands;
  }
  function sfStructure(p){
    if(_scCache&&_scView===store.current)return _scCache;
    var col=sfTracks('x',p.w),row=sfTracks('y',p.h);sfWeigh(col,'x');sfWeigh(row,'y');
    _scView=store.current;return _scCache={col:col,row:row,bands:sfBands()};
  }
  function sfDistribute(T,view,s0,c){
    var base=0,left;T.forEach(function(t){t.px=t.size*s0;base+=t.px;});
    var spare=view-base;left=spare;
    if(spare>0){
      var tot=0;T.forEach(function(t){t.wb=t.w*t.size;t.cap=false;if(t.w>0)tot+=t.wb;});
      if(tot>0){
        T.forEach(function(t){if(t.w>0){var want=spare*t.wb/tot,cap=t.px*(c.growCap-1),add=Math.min(want,cap);t.px+=add;left-=add;t.cap=(add>=cap-0.01);}});
        var tot2=0;T.forEach(function(t){if(t.w>0&&!t.cap)tot2+=t.wb;});
        if(tot2>0&&left>0.5){T.forEach(function(t){if(t.w>0&&!t.cap)t.px+=left*t.wb/tot2;});left=0;}
      }
      var cur=Math.max(0,left)/2;T.forEach(function(t){t.pos=cur;cur+=t.px;});
    }else{var cur2=Math.max(0,spare/2);T.forEach(function(t){t.pos=cur2;cur2+=t.px;});}
  }
  function sfCell(T,a,b){var x0=null,x1=null;T.forEach(function(t){if(t.d0>=a-0.5&&t.d0+t.size<=b+0.5){if(x0==null)x0=t.pos;x1=t.pos+t.px;}});if(x0==null){x0=T[0].pos;x1=T[0].pos+T[0].px;}return [x0,x1];}
  function sfAlignOff(box,content,anchor,axis){var s;if(axis==='x')s=anchor.indexOf('l')>=0?0:(anchor.indexOf('r')>=0?1:0.5);else s=anchor.indexOf('t')>=0?0:(anchor.indexOf('b')>=0?1:0.5);return (box-content)*s;}
  function sfEl(w){return canvas.querySelector('.w[data-id="'+w.id+'"]');}

  function letterboxFit(){
    var vw=window.innerWidth,vh=window.innerHeight,s=Math.min(vw/state.page.w,vh/state.page.h);
    canvas.style.transformOrigin='top left';canvas.style.transform='scale('+s+')';
    canvas.style.position='absolute';canvas.style.left=Math.max(0,(vw-state.page.w*s)/2)+'px';canvas.style.top=Math.max(0,(vh-state.page.h*s)/2)+'px';
    canvas.style.width=state.page.w+'px';canvas.style.height=state.page.h+'px';
  }
  var _fitVP={w:0,h:0}; // zuletzt zugrunde gelegter Viewport; Run/Kiosk auf Mobil: iOS-Adressleisten-Wackeln (nur Höhe) NICHT neu skalieren
  // Sichtbarkeit je Layoutmodus. reflowHide nahm das Widget bisher nur aus dem
  // Fluss - versteckt wurde es nie, es blieb an seiner Desktop-Position liegen und
  // schwebte ueber dem gestapelten Inhalt. Dasselbe gilt fuer uebersprungene
  // Overlays. anchorHide ist das Gegenstueck: nur im Reflow zeigen, also
  // Widgets, die es allein fuer das Handy gibt.
  function sfVis(reflow,platziert){
    state.widgets.forEach(function(w){
      var el=sfEl(w);if(!el)return;
      var weg=reflow ? (w.reflowHide||(platziert&&!platziert[w.id])) : !!w.anchorHide;
      el.style.display=weg?'none':'';
    });
  }
  function fitCanvas(){
    if(!document.body.classList.contains('run'))return;
    var p=state.page,mode=effFit(p),vw=window.innerWidth,vh=window.innerHeight;
    _fitVP={w:vw,h:vh};
    // Doku: KEIN Fit-to-Screen (sonst wird die hohe Katalogseite in Landscape auf die Höhe geschrumpft = winziger Streifen).
    // Stattdessen auf Breite einpassen und vertikal scrollen (CSS zoom skaliert auch die Layout-/Scrollhöhe).
    if(DOKU&&p&&p.w>0){document.body.classList.add('reflow');if(typeof chromeFitReset==='function')chromeFitReset();
      canvas.style.transform='none';canvas.style.transformOrigin='top left';canvas.style.position='relative';canvas.style.left='0';canvas.style.top='0';
      var dsc=Math.min(1,(vw-2)/p.w);if(!(dsc>0))dsc=1;
      var ml=Math.max(0,(vw-p.w*dsc)/2/dsc); // zoom skaliert margin mit -> vor-teilen; zentriert bei breitem Viewport
      canvas.style.margin='0';canvas.style.marginLeft=ml+'px';
      canvas.style.width=p.w+'px';canvas.style.height=p.h+'px';canvas.style.zoom=dsc;return;}
    if(bcfg().mobileOpt!==false&&isMobile()&&mode!=='reflow'&&!(p&&p.fitLock))mode='auto'; // Mobil: automatisch — Hochformat->Reflow (stapeln), Querformat->SmartFit (skaliert). page.fitLock=true haelt eine Seite immer im gewaehlten Fit (z. B. Heizplan: immer Querformat/Letterbox, kein Reflow).
    if(mode==='letterbox'||!p||p.w<=0||p.h<=0||vw<8||vh<8||!state.widgets.length){document.body.classList.remove('reflow');if(typeof chromeFitReset==='function')chromeFitReset();sfVis(false,null);return letterboxFit();}
    var m=(mode==='auto')?sfPick(vw,vh,p):mode;
    canvas.style.transform='none';canvas.style.transformOrigin='top left';canvas.style.left='0';canvas.style.top='0';canvas.style.width=vw+'px';
    // Leisten auf Geraetemasse; ab hier wird INNERHALB des Inhaltsrechtecks gerechnet
    var CR=(typeof chromeFitViewport==='function')?chromeFitViewport(vw,vh):{x:0,y:0,w:vw,h:vh};
    if(m==='reflow'){document.body.classList.add('reflow');canvas.style.position='relative';return reflowFit(CR.w,CR.h,CR);}
    document.body.classList.remove('reflow');canvas.style.position='absolute';canvas.style.height=vh+'px';sfVis(false,null);smartFit(CR.w,CR.h);
    if(typeof chromeFitBottom==='function')chromeFitBottom(vh);
  }
  function sfPick(vw,vh,p){
    // Vollansicht erzwungen (siehe vollAnsicht()): die Seite wird skaliert, aber
    // nie gestapelt - genau das meint "immer die volle Webseite".
    if(typeof vollAnsicht==='function'&&vollAnsicht()){_scMode='anchor';return _scMode;}
    var c=sfCfg(p),ad=p.w/p.h,av=vw/vh,lo=c.reflowLo+(_scMode==='reflow'?0.08:0),r=(av/ad<lo)||vw<c.phoneW;_scMode=r?'reflow':'anchor';return _scMode;}

  // gapFit v2 — robuste Per-Widget-Berechnung (kein fragiles Track-Cell-Matching):
  // EIN Faktor s haelt jedes Seitenverhaeltnis absolut (Box = w*s x h*s). Der Ueberschuss je Achse
  // (view - D*s) wird gleichmaessig NUR in die inneren Zwischenraeume (Luecken zwischen belegten
  // Bereichen) eingefuegt; jedes Widget rueckt um die Summe der links/oben davor eingefuegten Luecken.
  // Gruppen zaehlen als eine Bounding-Box (bleiben zusammen), voll-spannende Widgets zaehlen NICHT als
  // Belegung (Header/Hintergrund toeten die Luecken der anderen Zeilen nicht).
  function _gapAxis(D,view,s,pos,sz){
    var tol=0.055*Math.min(state.page.w,state.page.h),ext=D,iv=[],gb={};
    state.widgets.forEach(function(w){
      var a=w[pos],b=a+w[sz];
      if(a<=tol&&ext-b<=tol)return;                 // volle Achse -> keine Belegung
      if(w.group){var g=gb[w.group]||(gb[w.group]=[1e9,-1e9]);if(a<g[0])g[0]=a;if(b>g[1])g[1]=b;}
      else iv.push([a,b]);
    });
    Object.keys(gb).forEach(function(k){var g=gb[k];if(!(g[0]<=tol&&ext-g[1]<=tol))iv.push(g);});
    iv.sort(function(A,B){return A[0]-B[0];});
    var occ=[];iv.forEach(function(r){var L=occ.length;if(L&&r[0]<=occ[L-1][1]+0.5){if(r[1]>occ[L-1][1])occ[L-1][1]=r[1];}else occ.push([r[0],r[1]]);});
    var gaps=[];for(var i=1;i<occ.length;i++){if(occ[i][0]-occ[i-1][1]>0.5)gaps.push(occ[i-1][1]);} // Startkoordinate jeder inneren Luecke
    var spare=Math.max(0,view-D*s),extra=gaps.length?spare/gaps.length:0,lead=gaps.length?0:spare/2;
    return {gaps:gaps,extra:extra,lead:lead};
  }
  function _gapOff(ax,coord){var n=0;for(var i=0;i<ax.gaps.length;i++){if(ax.gaps[i]<=coord+0.5)n++;}return ax.lead+n*ax.extra;}
  function smartFit(vw,vh){
    var p=state.page,W=p.w,H=p.h,s=Math.min(vw/W,vh/H),tol=0.055*Math.min(W,H),stretched=[];
    var AX=_gapAxis(W,vw,s,'x','w'),AY=_gapAxis(H,vh,s,'y','h');
    state.widgets.forEach(function(w){
      var el=sfEl(w);if(!el)return;var win=el.firstElementChild;if(!win)return;
      var spanX=(w.x<=tol&&W-(w.x+w.w)<=tol),spanY=(w.y<=tol&&H-(w.y+w.h)<=tol);
      var bw=spanX?vw:w.w*s,bh=spanY?vh:w.h*s;
      var bx=spanX?0:(w.x*s+_gapOff(AX,w.x)),by=spanY?0:(w.y*s+_gapOff(AY,w.y));
      bx=Math.max(0,Math.min(bx,vw-bw));by=Math.max(0,Math.min(by,vh-bh));
      // Innenabstand mitskalieren: der Reflow verkleinert die ganze Seite, also muss auch
      // der Abstand kleiner werden - sonst frisst er auf dem Handy die halbe Kachel.
      el.style.transform='none';el.style.left=bx+'px';el.style.top=by+'px';
      el.style.width=bw+'px';el.style.height=bh+'px';
      wPadVars(el,w,s);
      if(sfClass(w)==='s'){win.style.transform='';win.style.width='';win.style.height='';stretched.push(w);}
      else{var _p=wPad(w,1);win.style.width=Math.max(8,w.w-_p.l-_p.r)+'px';win.style.height=Math.max(8,w.h-_p.t-_p.b)+'px';win.style.transformOrigin='top left';win.style.transform='scale('+s+')';}
    });
    sfPropagate(stretched);
  }

  // Reflow = hoehen-optimierter Flow-Umbruch: waehlt die groesste Skala, bei der ALLES auf einen Screen passt
  function sfFlowH(order,vw,M,gap,s){var x=M,y=M,rowH=0;order.forEach(function(w){if(w.reflowHide)return;var ww=w.w*s,wh=w.h*s;if(x>M&&x+ww>vw-M){x=M;y+=rowH+gap;rowH=0;}x+=ww+gap;if(wh>rowH)rowH=wh;});return y+rowH+M;}
  // Overlay = Widget, das im Design großflächig (>=70%) INNERHALB eines deutlich größeren Widgets liegt.
  // Solche gestapelten Overlays werden im Reflow übersprungen (sonst leere Zeile = Lücke).
  function _reflowOverlay(w,all){
    var wa=w.w*w.h;if(wa<=0)return false;var i,b,ba,ix,iy;
    for(i=0;i<all.length;i++){b=all[i];if(b===w)continue;ba=b.w*b.h;if(ba<wa*1.6)continue;
      ix=Math.min(w.x+w.w,b.x+b.w)-Math.max(w.x,b.x);iy=Math.min(w.y+w.h,b.y+b.h)-Math.max(w.y,b.y);
      if(ix>0&&iy>0&&ix*iy>=wa*0.7)return true;}
    return false;
  }
  function reflowFit(vw,vh,CR){
    var p=state.page,S=sfStructure(p),c=sfCfg(p),order=[],stretched=[],ALL=state.widgets;
    S.bands.forEach(function(b){order=order.concat(b);});
    order=order.filter(function(w){return !w.reflowHide&&(!!w.group||!_reflowOverlay(w,ALL));}); // Overlays raus – ausser gruppiert (Kinder bleiben am Master)
    var _plz={};order.forEach(function(w){_plz[w.id]=1;});sfVis(true,_plz); // Nichtplatziertes wirklich verstecken, sonst schwebt es ueber dem Stapel
    // Flow-Packing nach echter Breite. Gruppen zählen als EIN Block (Bounding-Box), bleiben also zusammen.
    var M=8,G=8,AW=vw-2*M,i;
    var seen={},units=[];
    order.forEach(function(w){
      if(w.group){ if(seen[w.group])return; seen[w.group]=1;
        var mem=order.filter(function(x){return x.group===w.group;});
        if(mem.length>1){
          // Slot = HUELLBOX aller Mitglieder, nicht die Master-Groesse. Sonst bekommt die
          // Gruppe zu wenig Platz und Mitglieder links/oberhalb des Masters landen mit
          // negativem Abstand im vorherigen Widget - sie ueberzeichnen sich dann.
          var gx0=mem[0].x,gy0=mem[0].y,gx1=mem[0].x+mem[0].w,gy1=mem[0].y+mem[0].h;
          mem.forEach(function(m){if(m.x<gx0)gx0=m.x;if(m.y<gy0)gy0=m.y;
            if(m.x+m.w>gx1)gx1=m.x+m.w;if(m.y+m.h>gy1)gy1=m.y+m.h;});
          units.push({grp:1,mem:mem,x0:gx0,y0:gy0,gw:(gx1-gx0),gh:(gy1-gy0)});return;}
      }
      units.push({grp:0,w:w,gw:w.w,gh:w.h});
    });
    units.forEach(function(u){var s=1,bw=u.gw;if(bw>AW){s=AW/u.gw;bw=AW;}u.s=s;u.bw=bw;u.bh=u.gh*s;}); // zu breite Einheit -> negativer Zoom
    // Zeilen greedy füllen (maximale Anzahl nebeneinander)
    var lines=[],cur=[],curW=0;
    for(i=0;i<units.length;i++){var u=units[i],need=(cur.length?G:0)+u.bw;
      if(cur.length&&curW+need>AW+0.5){lines.push(cur);cur=[];curW=0;need=u.bw;}
      cur.push(u);curW+=need;}
    if(cur.length)lines.push(cur);
    var placeW=function(w,px,py,s){var el=sfEl(w);if(!el)return;var win=el.firstElementChild;if(!win)return;var isS=(sfClass(w)==='s');
      if(isS){win.style.transform='';win.style.width='';win.style.height='';stretched.push(w);}else{var _p2=wPad(w,1);win.style.width=Math.max(8,w.w-_p2.l-_p2.r)+'px';win.style.height=Math.max(8,w.h-_p2.t-_p2.b)+'px';win.style.transform='scale('+s.toFixed(4)+')';}
      el.style.transform='none';el.style.left=px.toFixed(1)+'px';el.style.top=py.toFixed(1)+'px';
      el.style.width=(w.w*s).toFixed(1)+'px';el.style.height=(w.h*s).toFixed(1)+'px';
      wPadVars(el,w,s);};
    // platzieren: Zeile horizontal zentriert, Einheiten vertikal zentriert
    var y=M;
    lines.forEach(function(line){
      var lineW=0,rowH=0;line.forEach(function(u,k){lineW+=u.bw+(k?G:0);if(u.bh>rowH)rowH=u.bh;});
      var x=M+Math.max(0,(AW-lineW)/2);
      line.forEach(function(u){var uy=y+Math.max(0,(rowH-u.bh)/2);
        if(u.grp){u.mem.forEach(function(m){placeW(m,x+(m.x-u.x0)*u.s,uy+(m.y-u.y0)*u.s,u.s);});} // Gruppe: relative Anordnung erhalten
        else{placeW(u.w,x,uy,u.s);}
        x+=u.bw+G;
      });
      y+=rowH+G;
    });
    // Gestapelter Inhalt darf hoeher werden als das Band zwischen den Leisten: .cwrap
    // mitwachsen lassen und die Buehne um Leistenhoehen ergaenzen, sonst wird unten
    // abgeschnitten (overflow der .cwrap ist in diesem Modus auf sichtbar gesetzt).
    var contentH=Math.max(vh,y-G+M);
    var cw=$('.cwrap',canvas);if(cw)cw.style.height=contentH+'px';
    var offY=(CR&&CR.y)||0,botH=(typeof chromeBottomH==='function')?chromeBottomH():0;
    var total=offY+contentH+botH;
    canvas.style.height=total+'px';
    if(typeof chromeFitBottom==='function')chromeFitBottom(total);
    sfPropagate(stretched);
  }
  function sfPropagate(list){requestAnimationFrame(function(){list.forEach(function(w){var e=_ec[w.id];if(e)e.resize();if(w.type==='html')applyHtmlScale(w);});});}
  // ---- Struktur-Overlay (zeigt erkanntes SmartFit-Raster im Editor) ----
  var _showStruct=false;
  function drawStructure(){
    var ov=$('#sfOverlay',canvas);
    if(!_showStruct||document.body.classList.contains('run')){if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);return;}
    if(!ov){ov=document.createElement('div');ov.id='sfOverlay';canvas.appendChild(ov);}
    if(!state.widgets.length){ov.innerHTML='';return;}
    var S=sfStructure(state.page),W=state.page.w,H=state.page.h,h='';
    S.col.forEach(function(t){if(t.w>0)h+='<div class="sfband" style="left:'+t.d0+'px;width:'+t.size+'px"></div>';h+='<div class="sfseam v" style="left:'+t.d0+'px"></div>';if(t.w>0)h+='<div class="sflabel" style="left:'+(t.d0+3)+'px;top:2px">'+t.w+'</div>';});
    h+='<div class="sfseam v" style="left:'+W+'px"></div>';
    S.row.forEach(function(t){h+='<div class="sfseam h" style="top:'+t.d0+'px"></div>';});
    h+='<div class="sfseam h" style="top:'+H+'px"></div>';
    ov.innerHTML=h;
  }
  function enterRun(){
    var mob=isMobile();
    var _pv=VIEWNAME||lvPage(); // Seite aus ?view= ODER Pfad /hook/run/<view>/<Seite>; ohne Seite -> Start-/Hauptseite
    var _keys=Object.keys(store.views||{});
    var v=(_pv&&store.views[_pv]?_pv:'')||(mob&&store.homeMobile&&store.views[store.homeMobile]?store.homeMobile:'')||(store.home&&store.views[store.home]?store.home:'')||(store.current&&store.views[store.current]?store.current:'')||_keys[0];
    // pro-Seite hinterlegte Mobil-Alternative auf Handys automatisch nehmen
    if(mob&&store.views[v]&&store.views[v].page&&store.views[v].page.mobileView&&store.views[store.views[v].page.mobileView])v=store.views[v].page.mobileView;
    if(v&&store.views[v])switchView(v);
    document.body.classList.add('run');applyZoom();mode='preview';stage.classList.remove('edit');stage.classList.add('preview');
    canvas.classList.remove('grid');selClear();markSel();buildRunNav();document.body.classList.toggle('nohamb',!!bcfg().hideRunNav);fitCanvas();
    document.documentElement.classList.remove('run-boot'); // fertig positioniert -> Canvas einblenden (Flash weg)
    initKiosk();
  }
  // ---------- Kiosk-Modus (nur Run): kein Zoom/Scroll/Kontextmenü, Auto-Vollbild beim ersten Tipp, Bildschirm wach ----
  var _kioskDone=false,_wakeLock=null;
  function _wakeReq(){if('wakeLock' in navigator){navigator.wakeLock.request('screen').then(function(s){_wakeLock=s;}).catch(function(){});}}
  function goFullscreen(){var el=document.documentElement,r=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen;if(r){try{var p=r.call(el);if(p&&p.catch)p.catch(function(){});}catch(e){}}} // Promise-Rejection abfangen (sonst rote PROMISE-FEHLER-Box)
  function initKiosk(){
    if(_kioskDone)return;_kioskDone=true;
    var zoomOK=!!bcfg().allowZoom;   // opt-in: Pinch-/Doppeltipp-Zoom am Gerät erlauben (Default: Kiosk = kein Zoom)
    var vp=document.querySelector('meta[name=viewport]');if(vp)vp.setAttribute('content','width=device-width,initial-scale=1,viewport-fit=cover'+(zoomOK?'':',maximum-scale=1,user-scalable=no'));
    document.body.classList.add('kiosk');
    document.addEventListener('contextmenu',function(e){e.preventDefault();}); // kein Rechtsklick/Long-Press-Menü
    if(!zoomOK){
      ['gesturestart','gesturechange','gestureend'].forEach(function(ev){document.addEventListener(ev,function(e){e.preventDefault();});}); // kein Pinch-Zoom (Safari)
      var _lt=0;document.addEventListener('touchend',function(e){var n=Date.now();if(n-_lt<=350)e.preventDefault();_lt=n;},{passive:false}); // kein Doppeltipp-Zoom
    }
    if(!bcfg().noAutoFS){
      var _fsArmed=false;
      var armFS=function(){ if(document.fullscreenElement||_fsArmed)return; _fsArmed=true; // eine Geste holt Vollbild
        var fs=function(){_fsArmed=false;document.removeEventListener('click',fs);document.removeEventListener('touchend',fs);if(!document.fullscreenElement)goFullscreen();};
        document.addEventListener('click',fs);document.addEventListener('touchend',fs); };
      armFS();
      // nach Rückkehr aus dem Hintergrund (Browser beendet dort Vollbild): erneut scharf schalten,
      // damit die nächste Berührung Vollbild automatisch zurückholt.
      document.addEventListener('visibilitychange',function(){if(!document.hidden)armFS();});
    }
    _wakeReq();document.addEventListener('visibilitychange',function(){if(!document.hidden)_wakeReq();});
    initDoppeltipp();
  }
  /**
   * Doppeltipp auf die freie Flaeche laedt die Seite neu.
   *
   * Im Kiosk gibt es keine Adressleiste und keinen Neu-laden-Knopf. Wenn die
   * Anzeige nach einem Umbau am Layout oder nach Stunden im Hintergrund nicht
   * mehr stimmt, half bisher nur, das Geraet in die Hand zu nehmen.
   *
   * Nur die FREIE Flaeche zaehlt - also ein Tipp, der die Unterlage selbst
   * trifft und kein Widget. Sonst waere jedes schnelle zweimalige Druecken auf
   * einen Schalter ein Neuladen, und genau das tut man bei einem Schalter, der
   * nicht sofort reagiert. Zweite Bedingung: derselbe Fleck. Zwei Tipper an
   * verschiedenen Ecken sind zwei Absichten, keine Geste.
   *
   * Der Doppeltipp ist hier frei: das Kiosk-Stueck weiter oben unterbindet
   * ohnehin den Doppeltipp-Zoom.
   */
  function initDoppeltipp(){
    if(bcfg().noDblReload)return;
    var tZ=0,xZ=0,yZ=0;
    document.addEventListener('pointerup',function(e){
      if(e.button)return;                       // nur die Haupttaste
      var frei=(e.target===canvas||e.target===cwrap||e.target===stage||e.target===document.body);
      var jetzt=Date.now();
      if(!frei){tZ=0;return;}
      if(jetzt-tZ<=400&&Math.abs(e.clientX-xZ)<40&&Math.abs(e.clientY-yZ)<40){
        tZ=0;toast('neu laden …');setTimeout(function(){location.reload();},120);
        return;
      }
      tZ=jetzt;xZ=e.clientX;yZ=e.clientY;
    });
  }
  function buildRunNav(){
    var box=$('#runlist');if(!box)return;box.innerHTML='';
    Object.keys(store.views).forEach(function(n){var b=document.createElement('button');b.innerHTML=(n===store.home?'<svg class="i" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.8;vertical-align:-2px;margin-right:6px"><use href="#ic-home"/></svg>':'')+esc(n);b.onclick=function(){switchView(n);fitCanvas();$('#runlist').classList.remove('open');};box.appendChild(b);});
  }
  var _sfRaf=0;window.addEventListener('resize',function(){if(_sfRaf)return;_sfRaf=requestAnimationFrame(function(){_sfRaf=0;
    // Run/Kiosk auf Mobil: das Ein-/Ausblenden der Browser-Adressleiste ändert NUR die Höhe -> nicht neu skalieren
    // (sonst springt das Layout beim ersten Tipp). Breiten-/Orientierungswechsel skaliert weiter normal.
    var vw=window.innerWidth,vh=window.innerHeight;
    // Im Hintergrund NICHT umbauen. iOS meldet beim Minimieren, beim Wechsel in die
    // geteilte Ansicht und beim App-Umschalter eine geschrumpfte Groesse; wer darauf
    // hoert, kippt in die Mobilfassung und kommt beim Zurueckkehren nicht wieder
    // heraus, weil dann kein weiteres resize folgt. Beim Sichtbarwerden wird
    // ohnehin neu eingepasst (visibilitychange unten).
    if(document.hidden)return;
    if(document.body.classList.contains('run')&&isMobile()&&bcfg().kioskStable!==false&&vw===_fitVP.w&&Math.abs(vh-_fitVP.h)<170)return;
    // Doku: bei geaenderter Zielbreite Katalog neu aufbauen (Textblöcke füllen die neue Breite, kein Zoom)
    if((typeof DOKU!=='undefined'&&DOKU)&&typeof dokuFitWidth==='function'&&typeof buildDokuStore==='function'){
      var _tw=Math.max(320,Math.min(1600,vw-2*DOKU_PAD));
      if(_tw!==DOKU_TXTW){var _cur=store&&store.current;dokuFitWidth();store=buildDokuStore();if(_cur&&store.views[_cur])store.current=_cur;switchView(store.current);}
    }
    fitCanvas();});});
  // Zurueck aus dem Hintergrund: einmal sauber einpassen. Das ist die Gegenseite
  // zur Wache oben - waehrend die Seite verborgen war, wurde jede gemeldete
  // Groesse ignoriert, also gilt jetzt die erste, die wieder stimmt. Zwei Anlaeufe,
  // weil iOS die endgueltige Fenstergroesse erst nach dem Einblenden meldet.
  document.addEventListener('visibilitychange',function(){
    if(document.hidden)return;
    fitCanvas();
    setTimeout(fitCanvas,260);
  });
