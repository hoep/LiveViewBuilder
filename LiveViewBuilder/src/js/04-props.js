  // Universelle Interaktion (Popup/Skript) für JEDES Widget — Klick/Lang-Druck öffnet eine Ansicht als Popup
  function popupSection(w){function vopts(cur){return '<option value="">—</option>'+Object.keys(store.views).map(function(n){return '<option value="'+esc(n)+'"'+(cur===n?' selected':'')+'>'+esc(n)+'</option>';}).join('');}
    return '<div class="pgh">Interaktion</div>'
    +row('Seite öffnen','<select id="pNavToG">'+vopts(w.navTo)+'</select>')
    +row('Lang-Druck → Seite','<select id="pLongNav">'+vopts(w.longNav)+'</select>')
    +row('Popup öffnen','<select id="pPopupTo">'+vopts(w.popupTo)+'</select>')
    +row('Lang-Druck → Popup','<select id="pLongPop">'+vopts(w.longPopup)+'</select>')
    +row('Popup schließen','<input type="checkbox" id="pClosePop"'+(w.closePopup?' checked':'')+'>')
    +row('Skript ID','<input id="pScriptId" value="'+(w.scriptId||'')+'" placeholder="bei Klick ausführen">')
    +(w.popupTo?listEditor(w,'alias','Alias: Vorlagen-ID → echte Geräte-ID',[{k:'from',ph:'Vorlage'},{k:'to',ph:'echte ID'}]):'');}
  function popupWire(w){
    if($('#pNavToG'))$('#pNavToG').onchange=function(){w.navTo=this.value||undefined;commit();};
    if($('#pLongNav'))$('#pLongNav').onchange=function(){w.longNav=this.value||undefined;commit();};
    if($('#pPopupTo'))$('#pPopupTo').onchange=function(){w.popupTo=this.value||undefined;renderProps();commit();};
    if($('#pLongPop'))$('#pLongPop').onchange=function(){w.longPopup=this.value||undefined;commit();};
    if($('#pClosePop'))$('#pClosePop').onchange=function(){w.closePopup=this.checked||undefined;commit();};
    if($('#pScriptId'))$('#pScriptId').oninput=function(){w.scriptId=parseInt(this.value)||undefined;commit();};
  }
  var _rpBusy=false;
  function renderProps(){
    if(_rpBusy)return;            // Re-Entrancy vermeiden: ein change/blur-Handler darf renderProps nicht mitten im innerHTML-Umbau erneut anstoßen
    _rpBusy=true;
    try{
      var p0=$('#props'),ae=document.activeElement;
      if(ae&&ae.blur&&p0&&p0.contains(ae))ae.blur();  // Blur JETZT auslösen (nicht mitten im innerHTML), sonst "node no longer a child"
      _renderProps();
    }finally{_rpBusy=false;}
  }
  function _renderProps(){
    var w=widget(selId),p=$('#props');
    if(!w){p.innerHTML='<div class="hint">Kein Element ausgewählt.</div>';return;}
    try{
    var typeOpts=Object.keys(TYPES).map(function(t){return '<option value="'+t+'">'+TYPES[t]+'</option>';}).join('');
    var lbl2={thermostat:'Ziel-Var',light:'Helligkeit',cover:'Stop-Var',weather:'Vorhersage (JSON)',weatherpro:'Vorhersage (JSON)',sun:'Untergang',suncard:'Untergang',media:'Zustand',room:'Metrik 2',vacuum:'Batterie',valuecard:'Toggle/Akzent-Var'}[w.type];
    var lbl3={media:'Lautstärke',room:'Metrik 3',vacuum:'Start/Stop',thermostat:'Modus/Profil-Var',valuecard:'Balken-Var'}[w.type];
    var _inBar=(typeof chromeOwnerOf==='function')?chromeOwnerOf(w.id):null;
    p.innerHTML=(Object.keys(sel).length>=2?alignSection():'')
      +(_inBar?('<div class="prop" style="border-color:var(--accent)"><div style="font-size:11px;color:var(--muted);margin-bottom:5px">Liegt in der Leiste <b>'+esc(_inBar.name||'Leiste')+'</b> — erscheint damit auf allen Seiten.</div>'
        +'<button class="btn" id="pChOut" style="padding:5px 9px">Zurück auf die Seite</button></div>'):'')
      +'<div class="prop">'
      +row('Typ','<select id="pType">'+typeOpts+'</select>')
      +row('Label','<input id="pLabel" value="'+esc(w.label||'')+'">')
      +row('Name','<input id="pName" value="'+esc(w.name||'')+'" placeholder="eindeutige Kennung (intern)">')
      +((w.type==='camera'||w.type==='image')?row('Media-ID','<input id="pMedia" value="'+(w.mediaId||'')+'" placeholder="Media-ID">')
          :(w.type==='line'||w.type==='shape')?row('Farbe','<input id="pColor" type="color" value="'+(w.color||'#00cdab')+'">')
          :(['text','calendar','clock','component','eventctl','objinfo','infolist','meterlist','statuslist','statusgrid','devlist','chart','skinswitch','windrose','rangeslider','raincard','circlerange','cie'].indexOf(w.type)<0&&!(w.type==='html'&&w.htmlSrc==='custom')&&!(w.type==='colorpick'&&(w.cmode||'wheel')==='cie')?row('Variable','<input id="pVar" value="'+(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pPick" style="padding:6px 8px">wählen</button>'):''))
      +((w.type==='kpi'||w.type==='delta')?('<div class="pgh">Vergleich (Zeitversatz)</div>'
        +row('Aktiv','<input type="checkbox" id="pCmpOn"'+(w.cmpOn?' checked':'')+'>')
        +(w.cmpOn?(row('Aggregationsstufe',stageSel('pCmpStage',cmpStage(w)))+row('Zählervariable','<input type="checkbox" id="pCmpCnt"'+(w.cmpCounter?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Verbrauch je Periode</span>')+(!w.cmpCounter?row('Periodenmittel','<input type="checkbox" id="pCmpAvg"'+(w.cmpAvg?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Mittel über die Periode statt Punktwert</span>'):'')+row('Anzeige','<select id="pCmpMode"><option value="pct"'+((w.cmpMode||'pct')==='pct'?' selected':'')+'>Prozent</option><option value="abs"'+(w.cmpMode==='abs'?' selected':'')+'>Absolut</option></select>')+row('Veränderung invertieren','<input type="checkbox" id="pCmpInv"'+(w.cmpInvert?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Rückgang = gut (z. B. Verbrauch) — nur Farbe dreht, Pfeil bleibt</span>')):'')
      ):'')
      +(FMT_TYPES.indexOf(w.type)>=0?row('Format','<select id="pFmt">'+fmtOpts(w.fmt)+'</select>'):'')
      +(['value','kpi','valuecard','bar','gauge','gaugepro','tempbar','dial','chip','cval','sval','delta','room','meterlist','marquee','raincard','rangebtn','assoc','chart'].indexOf(w.type)>=0?row('Nachkommastellen','<input id="pDec" type="number" min="0" max="6" value="'+(w.dec!=null?w.dec:'')+'" placeholder="Standard">'):'')
      +(['value','valuecard','bar','assoc','cval','sval','delta','tempbar'].indexOf(w.type)>=0?row('Einzeilig bei geringer Höhe','<input type="checkbox" id="pLineMode"'+(w.lineMode?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">flach gezogen → alles in eine Zeile</span>'):'')
      +((w.type==='chart'||w.type==='spark')?(function(){if(w.type==='chart'&&(['pie','donut','rose','waterfall','daylight'].indexOf(w.ctype||'area')>=0))return ''; /* Anteils-Charts und Wasserfall haben keine Zeitachse */var r=_chRange(w);var U=[['raw','Roh'],['min','Minuten'],['hour','Stunden'],['day','Tage'],['week','Wochen'],['month','Monate'],['year','Jahre']];var sel='<select id="pRUnit">'+U.map(function(u){return '<option value="'+u[0]+'"'+(r.unit===u[0]?' selected':'')+'>'+u[1]+'</option>';}).join('')+'</select>';var s=row('Zeitraum','<input id="pRN" type="number" min="1" style="width:64px" value="'+(r.n||24)+'"> '+sel);if(r.unit==='raw')s+=row('Fenster-Einheit','<select id="pRRawU"><option value="hour"'+((r.rawUnit||'hour')==='hour'?' selected':'')+'>Stunden</option><option value="day"'+(r.rawUnit==='day'?' selected':'')+'>Tage</option></select>');else s+=row('Wert','<select id="pRAggF"><option value="avg"'+((r.aggF||'avg')==='avg'?' selected':'')+'>Mittel</option><option value="sum"'+(r.aggF==='sum'?' selected':'')+'>Summe</option></select> <span style="font-size:11px;color:var(--muted)">Z&#228;hler: &#8222;Mittel&#8220;=Verbrauch/Bucket</span>');if(r.unit==='month'&&w.type==='chart'&&w.ctype!=='spark')s+=row('Zeitmodus','<select id="pRCal"><option value=""'+(!r.cal?' selected':'')+'>Rollierend</option><option value="1"'+(r.cal?' selected':'')+'>Kalenderjahr (J&#228;n&#8211;Dez)</option></select>');return s;})():'')
      +(['bar','gauge','slider','thermostat','gaugepro','timer','tempbar','dial'].indexOf(w.type)>=0?(row('Min','<input id="pMin" type="number" value="'+(w.min!=null?w.min:0)+'">')+row('Max','<input id="pMax" type="number" value="'+(w.max!=null?w.max:100)+'">')):'')
      +((w.type==='slider'||w.type==='thermostat'||w.type==='dial')?row('Schritt','<input id="pStep" type="number" step="0.1" value="'+(w.step||1)+'">'):'')
      +(lbl2?row(lbl2,'<input id="pVar2" value="'+(w.varId2||'')+'" placeholder="ID"> <button class="btn" id="pPick2" style="padding:6px 8px">wählen</button>'):'')
      +(lbl3?row(lbl3,'<input id="pVar3" value="'+(w.varId3||'')+'" placeholder="ID"> <button class="btn" id="pPick3" style="padding:6px 8px">wählen</button>'):'')
      +(w.type!=='line'?row('Farben','<input id="pFg" type="color" value="'+(w.fg||'#e7eef0')+'" title="Textfarbe"> <input id="pBg" type="color" value="'+(w.bg||'#141c1f')+'" title="Hintergrund"> <button class="btn" id="pClr" style="padding:5px 8px" title="Farben zurücksetzen"><svg class="i"><use href="#ic-minus"/></svg></button>'):'')
      +(w.type!=='line'&&w.type!=='shape'?row('Rahmen','<select id="pFrame"><option value=""'+(w.frame==null?' selected':'')+'>Ansicht-Standard</option><option value="1"'+(w.frame===true?' selected':'')+'>An</option><option value="0"'+(w.frame===false?' selected':'')+'>Aus</option></select>'):'')
      +(w.type!=='line'?row('Hintergrund','<select id="pBgT"><option value=""'+(!w.bgT?' selected':'')+'>Deckend</option><option value="1"'+(w.bgT?' selected':'')+'>Transparent</option></select>'):'')
      +(w.type!=='line'&&w.type!=='shape'?('<div class="pgh">Typografie</div>'
        +row('Schrift','<select id="pFf"><option value=""'+(!w.ff?' selected':'')+'>Standard</option>'+[['system-ui,-apple-system,sans-serif','Sans'],['Georgia,\'Times New Roman\',serif','Serif'],['var(--fm)','Mono'],['\'Segoe UI\',Arial,sans-serif','Segoe/Arial'],['\'Courier New\',monospace','Courier'],['Verdana,sans-serif','Verdana']].map(function(o){return '<option value="'+esc(o[0])+'"'+(w.ff===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
        +row('Gewicht','<select id="pFwt"><option value=""'+(!w.fwt?' selected':'')+'>Standard</option>'+['300','400','500','600','700','800'].map(function(x){return '<option value="'+x+'"'+(w.fwt===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select>')
        +row('Stil','<select id="pFsty"><option value=""'+(!w.fsty?' selected':'')+'>Normal</option><option value="italic"'+(w.fsty==='italic'?' selected':'')+'>Kursiv</option></select>')
        +row('Schriftgröße (px)','<input id="pFsz" type="number" min="0" value="'+(w.fsz||'')+'" placeholder="Standard">')
      ):'')
      +(['icon','value','switch','bar','tile','button','light','chip','room','kpi','assoc','valuecard'].indexOf(w.type)>=0?row('Icon (Fallback)','<span style="width:20px;height:20px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.icon?iconSVG(w.icon):'')+'</span> <button class="btn" id="pIcon" style="padding:5px 8px">wählen</button>'+(w.icon?' <button class="btn" id="pIconX" style="padding:5px 8px" title="Icon entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':'')):'')
      +(['icon','value','switch','bar','chip','room','kpi','valuecard'].indexOf(w.type)>=0&&w.icon?row('Icon-Farbe',(function(){var SK=[['','Standard'],['accent','Akzent'],['ok','OK'],['warn','Warnung'],['crit','Kritisch'],['info','Info'],['text','Neutral']];return '<span class="iconsw" data-role="iconsw">'+SK.map(function(c){var cur=(w.iconColor||'')===c[0];var st=c[0]?('background:var(--'+c[0]+')'):'background:transparent;border-style:dashed;border-color:var(--muted)';return '<button type="button" class="iconswb'+(cur?' on':'')+'" data-skin="'+c[0]+'" title="'+esc(c[1])+'" style="'+st+'"></button>';}).join('')+'</span>';})()):'')
      +(['icon','value','switch','bar','tile','button','light','chip','room','kpi','assoc','valuecard'].indexOf(w.type)>=0&&w.varId?'<div id="assocBox" class="assocbox"></div>':'')
      +(function(){try{return (WIDGETS[w.type]&&WIDGETS[w.type].props)?WIDGETS[w.type].props(w):'';}catch(_e){console.error('props('+w.type+')',_e);return '<div class="hint" style="color:var(--crit);font-size:11px">Eigenschaften-Fehler bei „'+esc(w.type)+'" — siehe Konsole</div>';}})()
      +((state.page.fit&&state.page.fit!=='letterbox')?respSection(w):'')
      +((w.type!=='button'&&w.type!=='tile')?popupSection(w):'')
      +(w.type!=='blank'?('<div class="pgh">Sichtbarkeit</div>'
        +row('Zur Laufzeit','<input type="checkbox" id="pRunVis"'+(w.hidden?'':' checked')+'> <span style="font-size:11px;color:var(--muted)">im Betrieb anzeigen</span>')
        +(w.type!=='ticker'?(function(){var inT=w.name&&allWidgets().some(function(t){return t.type==='ticker'&&t.items&&t.items.some(function(m){return m.ref===w.name;});});if(inT)return row('Laufzeile','<button class="btn" id="pFromTicker" style="padding:5px 8px">← aus Laufzeile holen</button>');if(state.widgets.some(function(x){return x.type==='ticker';}))return row('Laufzeile','<button class="btn" id="pToTicker" style="padding:5px 8px">→ in Laufzeile verschieben</button>');return '';})():'')
        +row('Steuer-Var','<input id="pVisVar" value="'+(w.visVar||'')+'" placeholder="ID (leer=immer)"> <button class="btn" id="pVisPick" style="padding:6px 8px">wählen</button>')
        +(w.visVar?(row('Zeigen wenn','<select id="pVisMode"><option value="truthy"'+((w.visMode||'truthy')==='truthy'?' selected':'')+'>wahr / ≠0</option><option value="eq"'+(w.visMode==='eq'?' selected':'')+'>= Wert</option><option value="ne"'+(w.visMode==='ne'?' selected':'')+'>≠ Wert</option><option value="ge"'+(w.visMode==='ge'?' selected':'')+'>≥ Wert</option><option value="le"'+(w.visMode==='le'?' selected':'')+'>≤ Wert</option></select>')+((w.visMode&&w.visMode!=='truthy')?row('Wert','<input id="pVisVal" value="'+esc(w.visVal!=null?w.visVal:'')+'">'):'')):'')):'')
      +(w.type!=='blank'?row('Animation','<select id="pAnim"><option value=""'+(!w.anim?' selected':'')+'>keine</option><option value="fade"'+(w.anim==='fade'?' selected':'')+'>Fade</option><option value="scale"'+(w.anim==='scale'?' selected':'')+'>Scale</option><option value="slide"'+(w.anim==='slide'?' selected':'')+'>SlideUp</option></select>'):'')
      +row('Ebene','<button class="btn" id="pZFront" style="padding:4px 9px">nach vorn</button> <button class="btn" id="pZBack" style="padding:4px 9px">nach hinten</button>')
      +'<div class="xy">'+cell('X','pX',w.x)+cell('Y','pY',w.y)+cell('B','pW',w.w)+cell('H','pH',w.h)+'</div>'
      +'<button class="btn danger" id="pDel">Löschen</button>'
      +'</div>'
    $('#pType').value=w.type;
    $('#pType').onchange=function(){w.type=this.value;render();renderProps();};
    $('#pLabel').oninput=function(){w.label=this.value;render();};
    if($('#pChOut'))$('#pChOut').onclick=function(){chromeMoveOut([w.id]);};
    if($('#pName'))$('#pName').onchange=function(){var nm=this.value.trim();
      // Doppelte Namen abweisen - aber SAGEN, wo der Name schon liegt. Sonst sucht man ihn
      // vergeblich, denn er kann auch in einer Leiste stecken und ist von hier nicht sichtbar.
      var _clash=nm?namedWidgets(w.id).filter(function(o){return o.name===nm;})[0]:null;
      if(_clash){toast('Name „'+nm+'\u201c ist bereits vergeben: '+_clash.type+' in '+(_clash.view||'?'));
        this.select();return;}   // Eingabe stehen lassen und markieren, nicht loeschen
      w.name=nm||undefined;render();}; // render() aktualisiert Laufzeilen-Referenzen und ruft intern schon commit(). KEIN renderProps() hier - das wuerde das Panel mitten im change-Handler neu aufbauen und das Eingabefeld zerstoeren.
    if($('#pVar'))$('#pVar').onchange=function(){w.varId=parseInt(this.value)||0;delete _hist[w.id];render();renderProps();};
    if($('#pPick'))$('#pPick').onclick=function(){showTab('vars');toast('Variable im Baum anklicken — bindet an dieses Element');_bindTarget=w.id;};
    if($('#pMedia'))$('#pMedia').onchange=function(){w.mediaId=parseInt(this.value)||0;render();};
    if($('#pColor'))$('#pColor').oninput=function(){w.color=this.value;render();};
    if($('#pFg'))$('#pFg').oninput=function(){w.fg=this.value;render();};
    if($('#pBg'))$('#pBg').oninput=function(){w.bg=this.value;render();};
    if($('#pClr'))$('#pClr').onclick=function(){delete w.fg;delete w.bg;delete w.bgT;render();renderProps();};
    if($('#pFrame'))$('#pFrame').onchange=function(){w.frame=(this.value===''?undefined:(this.value==='1'));render();commit();};
    if($('#pBgT'))$('#pBgT').onchange=function(){w.bgT=(this.value==='1')||undefined;render();commit();};
    if($('#pFf'))$('#pFf').onchange=function(){w.ff=this.value||undefined;render();commit();};
    if($('#pFwt'))$('#pFwt').onchange=function(){w.fwt=this.value||undefined;render();commit();};
    if($('#pFsty'))$('#pFsty').onchange=function(){w.fsty=this.value||undefined;render();commit();};
    if($('#pFsz'))$('#pFsz').oninput=function(){w.fsz=parseInt(this.value)||undefined;render();commit();};
    if($('#pIcon'))$('#pIcon').onclick=function(){_assocPick=null;showTab('icons');toast('Icon links wählen — wird der Auswahl zugewiesen');};
    if($('#assocBox'))renderAssoc(w);
    if($('#pIconX'))$('#pIconX').onclick=function(){delete w.icon;render();renderProps();};
    $$('#props [data-role=iconsw] [data-skin]').forEach(function(b){b.onclick=function(){w.iconColor=this.getAttribute('data-skin')||undefined;render();renderProps();commit();};}); // zentrale Icon-Farbe (Skin)
    if($('#pFit'))$('#pFit').onchange=function(){w.fit=this.value||undefined;commit();renderProps();};
    if($('#pPrio'))$('#pPrio').onchange=function(){w.prio=parseInt(this.value)||2;commit();};
    if($('#pGrp'))$('#pGrp').oninput=function(){w.grp=this.value||undefined;commit();};
    if($('#pMinW'))$('#pMinW').oninput=function(){var v=parseInt(this.value);w.minW=isNaN(v)?undefined:v;commit();};
    if($('#pMinH'))$('#pMinH').oninput=function(){var v=parseInt(this.value);w.minH=isNaN(v)?undefined:v;commit();};
    if($('#pRHide'))$('#pRHide').onchange=function(){w.reflowHide=this.checked||undefined;commit();};
    $$('#pAnchor .anbtn').forEach(function(bt){bt.onclick=function(){w.anchor=bt.dataset.an;commit();renderProps();};});
    if($('#pFmt'))$('#pFmt').onchange=function(){w.fmt=this.value==='auto'?undefined:this.value;render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);};
    if($('#pDec'))$('#pDec').oninput=function(){w.dec=this.value===''?undefined:Math.max(0,Math.min(6,parseInt(this.value)||0));render();if(w.type==='cval')computeCounterVal(w);else if(w.type==='sval')computeAggVal(w);else if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();};
    if($('#pDir'))$('#pDir').onchange=function(){w.dir=this.value;render();};
    if($('#pCmpOn'))$('#pCmpOn').onchange=function(){w.cmpOn=this.checked;delete _hist[w.id];delete _cmpData[w.id];renderProps();if(w.type==='chart'||w.type==='spark'){if(w.cmpOn)fetchHist(w);else if(_ec[w.id])renderChartData(w);commit();}else{refreshCompare(w);commit();}};
    if($('#pCmpOff'))$('#pCmpOff').onchange=function(){w.cmpOff=this.value;delete _hist[w.id];delete _cmpData[w.id];if(w.type==='chart'||w.type==='spark')fetchHist(w);else refreshCompare(w);commit();};
    if($('#pCmpShade'))$('#pCmpShade').oninput=function(){w.cmpShade=Math.max(0,Math.min(90,parseInt(this.value)||0));if(_ec[w.id])renderChartData(w);commit();};
    if($('#pCmpMode'))$('#pCmpMode').onchange=function(){w.cmpMode=this.value;refreshCompare(w);commit();};
    if($('#pCmpInv'))$('#pCmpInv').onchange=function(){w.cmpInvert=this.checked;computeCompare(w);commit();};
    if($('#pCmpStage'))$('#pCmpStage').onchange=function(){w.cmpStage=this.value;delete _cmpData[w.id];refreshCompare(w);commit();};
    if($('#pCmpCnt'))$('#pCmpCnt').onchange=function(){w.cmpCounter=this.checked||undefined;delete _cmpData[w.id];renderProps();refreshCompare(w);commit();};
    if($('#pCmpAvg'))$('#pCmpAvg').onchange=function(){w.cmpAvg=this.checked||undefined;delete _cmpData[w.id];refreshCompare(w);commit();};
    if($('#pRN'))$('#pRN').oninput=function(){_setRange(w,{n:parseInt(this.value)||1});commit();};
    if($('#pRUnit'))$('#pRUnit').onchange=function(){_setRange(w,{unit:this.value});renderProps();commit();};
    if($('#pRRawU'))$('#pRRawU').onchange=function(){_setRange(w,{rawUnit:this.value});commit();};
    if($('#pRAggF'))$('#pRAggF').onchange=function(){_setRange(w,{aggF:this.value});commit();};
    if($('#pRCal'))$('#pRCal').onchange=function(){_setRange(w,{cal:!!this.value});renderProps();commit();};
    if($('#pLineMode'))$('#pLineMode').onchange=function(){w.lineMode=this.checked||undefined;render();commit();};
    if($('#pMin'))$('#pMin').oninput=function(){var v=parseFloat(this.value);w.min=isNaN(v)?0:v;render();};
    if($('#pMax'))$('#pMax').oninput=function(){var v=parseFloat(this.value);w.max=isNaN(v)?100:v;render();};
    if($('#pStep'))$('#pStep').oninput=function(){w.step=parseFloat(this.value)||1;render();};
    if($('#pT1'))$('#pT1').oninput=function(){w.t1=this.value===''?null:parseFloat(this.value);render();};
    if($('#pT2'))$('#pT2').oninput=function(){w.t2=this.value===''?null:parseFloat(this.value);render();};
    if($('#pVar2'))$('#pVar2').onchange=function(){w.varId2=parseInt(this.value)||0;delete _hist[w.id];render();};
    if($('#pPick2'))$('#pPick2').onclick=function(){showTab('vars');toast('Variable im Baum anklicken');_bindTarget2=w.id;};
    if($('#pVar3'))$('#pVar3').onchange=function(){w.varId3=parseInt(this.value)||0;delete _hist[w.id];render();};
    if($('#pPick3'))$('#pPick3').onclick=function(){showTab('vars');toast('Untergang-Variable im Baum anklicken');_bindTarget3=w.id;};
    ['pX','pY','pW','pH'].forEach(function(k){var el=$('#'+k);el.oninput=function(){var v=parseInt(el.value)||0;if(k==='pX')w.x=v;if(k==='pY')w.y=v;if(k==='pW')w.w=Math.max(40,v);if(k==='pH')w.h=Math.max(28,v);render();};});
    $('#pDel').onclick=function(){var ids=Object.keys(sel).length?Object.keys(sel):[w.id];state.widgets=state.widgets.filter(function(x){return ids.indexOf(x.id)<0;});if(typeof chromeList==='function')chromeList().forEach(function(_b){if(_b.widgets)_b.widgets=_b.widgets.filter(function(x){return ids.indexOf(x.id)<0;});});selClear();render();renderProps();};
    $$('[data-al]',p).forEach(function(bt){bt.onclick=function(){var a=bt.dataset.al;if(a==='disth')distributeSel('h');else if(a==='distv')distributeSel('v');else if(a==='group')groupSel();else if(a==='ungroup')ungroupSel();else alignSel(a);};});
    $$('[data-fc]',p).forEach(function(inp){inp.oninput=inp.onchange=function(){var pr=inp.dataset.fc.split('.'),i=+pr[0],k=pr[1];if(!w.fc||!w.fc[i])return;w.fc[i][k]=(k==='hi'||k==='lo'||k==='pq')?(parseInt(inp.value)||0):inp.value;render();};});
    $$('[data-fcdel]',p).forEach(function(b){b.onclick=function(){w.fc.splice(+b.dataset.fcdel,1);render();renderProps();};});
    if($('#fcAdd'))$('#fcAdd').onclick=function(){if(!w.fc)w.fc=[];w.fc.push({d:'',ic:'cloudsun',hi:0,lo:0,pq:0});render();renderProps();};
    $$('[data-le]',p).forEach(function(inp){inp.oninput=function(){var pr=inp.dataset.le.split('.'),key=pr[0],i=+pr[1],k=pr[2];if(!w[key]||!w[key][i])return;w[key][i][k]=(/vid$/i.test(k))?(parseInt(inp.value)||0):inp.value;render();};});
    $$('[data-ledel]',p).forEach(function(b){b.onclick=function(){var pr=b.dataset.ledel.split('.');w[pr[0]].splice(+pr[1],1);render();renderProps();};});
    $$('[data-leadd]',p).forEach(function(b){b.onclick=function(){var key=b.dataset.leadd;if(!w[key])w[key]=[];w[key].push(key==='links'?{from:'',to:'',vid:0}:(key==='steps'?{title:'',vid:0,type:'auf',color:'#00cdab'}:{label:'',vid:0}));render();renderProps();};});
    $$('[data-fpick]',p).forEach(function(b){b.onclick=function(){showTab('vars');toast('Variable im Baum anklicken');_bindField={wid:w.id,path:b.dataset.fpick};};}); // generischer Feld-Pick (Pfad, z. B. fc.0.hi)
    $$('[data-fid]',p).forEach(function(inp){inp.onchange=function(){setPath(w,inp.dataset.fid,parseInt(inp.value)||0);render();renderProps();};});
    $$('[data-fclr]',p).forEach(function(b){b.onclick=function(){setPath(w,b.dataset.fclr,0);render();renderProps();};});
    if($('#pRunVis'))$('#pRunVis').onchange=function(){w.hidden=this.checked?undefined:true;render();commit();};
    if($('#pToTicker'))$('#pToTicker').onclick=function(){moveToTicker(w);};
    if($('#pFromTicker'))$('#pFromTicker').onclick=function(){removeFromTicker(w);};
    if($('#pVisVar'))$('#pVisVar').onchange=function(){w.visVar=parseInt(this.value)||undefined;render();renderProps();};
    if($('#pVisPick'))$('#pVisPick').onclick=function(){showTab('vars');_bindVis=w.id;};
    if($('#pVisMode'))$('#pVisMode').onchange=function(){w.visMode=this.value;render();renderProps();};
    if($('#pVisVal'))$('#pVisVal').oninput=function(){w.visVal=this.value;render();};
    if($('#pAnim'))$('#pAnim').onchange=function(){w.anim=this.value||undefined;render();commit();};
    // Z-Reihenfolge = Position in der jeweiligen Liste. Leisten-Kinder liegen in ihrer Leiste,
    // Seiten-Widgets in state.widgets - sonst waere die Umsortierung wirkungslos.
    function _zList(x){var ow=(typeof chromeOwnerOf==='function')?chromeOwnerOf(x.id):null;return (ow&&ow.widgets)?ow.widgets:state.widgets;}
    if($('#pZFront'))$('#pZFront').onclick=function(){var L=_zList(w),i=L.indexOf(w);if(i>=0){L.splice(i,1);L.push(w);}render();select(w.id);commit();};
    if($('#pZBack'))$('#pZBack').onclick=function(){var L=_zList(w),i=L.indexOf(w);if(i>=0){L.splice(i,1);L.unshift(w);}render();select(w.id);commit();};
    try{if(WIDGETS[w.type]&&WIDGETS[w.type].wire)WIDGETS[w.type].wire(w);}catch(_e){console.error('wire('+w.type+')',_e);} // ein defekter wire-Hook darf die Auswahl nicht blockieren
    if(w.type!=='button'&&w.type!=='tile')popupWire(w); // universelle Popup/Interaktion-Verdrahtung (Kachel/Button haben eigene Nav/Popup-Konfig)
    }catch(_ep){console.error('renderProps('+(w&&w.type)+')',_ep);p.innerHTML='<div class="hint" style="color:var(--crit);font-size:12px;white-space:pre-wrap">Eigenschaften-Fehler bei „'+esc(w.type)+'":\n'+esc((_ep&&_ep.message)||String(_ep))+'</div>';} // Panel zeigt den Fehler direkt an
  }
  function row(l,html){return '<div class="prow"><label>'+l+'</label>'+html+'</div>';}
  function moveToTicker(w){ // Widget benennen, in erste Laufzeile referenzieren, auf der Seite ausblenden
    // Laufzeile auch in einer Leiste suchen - dort liegt sie beim gemeinsamen Kopfbereich.
    var tk=allWidgets().filter(function(x){return x.type==='ticker';})[0];
    if(!tk){toast('Keine Laufzeile auf dieser Seite');return;}
    if(!w.name){var base=(w.label||w.type||'widget').toString().replace(/\s+/g,'-').toLowerCase(),nm=base,n=2;while(namedWidgets(w.id).some(function(o){return o.name===nm;})){nm=base+'-'+(n++);}w.name=nm;}
    tk.items=tk.items||[];if(!tk.items.some(function(m){return m.ref===w.name;}))tk.items.push({ref:w.name});
    w.hidden=true;render();select(tk.id);toast('„'+w.name+'" in Laufzeile verschoben');commit();
  }
  function removeFromTicker(w){ // alle Referenzen entfernen und Widget wieder auf der Seite anzeigen (nicht löschen)
    allWidgets().forEach(function(t){if(t.type==='ticker'&&t.items)t.items=t.items.filter(function(m){return m.ref!==w.name;});});
    w.hidden=undefined;render();select(w.id);renderProps();toast('„'+(w.name||w.type)+'" zurück auf die Seite');commit();
  }
  function fieldPick(w,path,label){var v=getPath(w,path)||''; // Variable an ein beliebiges Feld (Pfad) binden: Eingabe + wählen + entfernen
    return '<div class="prow"><label>'+label+'</label><input data-fid="'+path+'" value="'+(v||'')+'" placeholder="ID" style="width:60px"> <button class="btn" data-fpick="'+path+'" style="padding:5px 7px">wählen</button>'+(v?' <button class="btn" data-fclr="'+path+'" style="padding:5px 7px" title="entfernen">×</button>':'')+'</div>';}
  function cell(l,id,v){return '<div class="prow"><label style="width:18px">'+l+'</label><input id="'+id+'" type="number" value="'+v+'"></div>';}
  function tgradEditor(w){
    var arr=w.tgrad||[];
    var rows=arr.map(function(s,i){return '<div class="serow"><input data-tg="t.'+i+'" type="number" value="'+(s.t!=null?s.t:0)+'" placeholder="°C" style="width:64px"><input type="color" data-tg="color.'+i+'" value="'+(s.color||'#00cdab')+'"><button class="btn" data-tgdel="'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';}).join('');
    return '<div class="pgh">Temperatur → Farbe (Verlauf)</div>'+rows+'<button class="btn" id="tgAdd" style="margin-top:2px"><svg class="i"><use href="#ic-plus"/></svg>Stufe</button>';
  }
  function fcEditor(w){
    var wi=['sun','cloudsun','cloud','rain','snow','wind','moon'];
    var rows=(w.fc||[]).map(function(r,i){
      var ic=wi.map(function(k){return '<option value="'+k+'"'+((r.ic||'cloudsun')===k?' selected':'')+'>'+k+'</option>';}).join('');
      return '<div class="fcrow" style="display:grid;grid-template-columns:30px 62px 1fr 1fr 1fr 22px;gap:4px;margin-bottom:4px">'
        +'<input data-fc="'+i+'.d" value="'+esc(r.d||'')+'" placeholder="Tag">'
        +'<select data-fc="'+i+'.ic">'+ic+'</select>'
        +'<input data-fc="'+i+'.hi" value="'+(r.hi||'')+'" placeholder="Hi">'
        +'<input data-fc="'+i+'.lo" value="'+(r.lo||'')+'" placeholder="Lo">'
        +'<input data-fc="'+i+'.pq" value="'+(r.pq||'')+'" placeholder="R%">'
        +'<button class="btn" data-fcdel="'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
    }).join('');
    return '<div class="prop" style="margin-top:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:5px">Forecast-Tage (Hi/Lo/Regen% = Variablen-ID)</div>'+rows+'<button class="btn" id="fcAdd"><svg class="i"><use href="#ic-plus"/></svg>Tag</button></div>';
  }
  // Skin-Farben GENERISCH aus SKIN_TOKENS ableiten (ohne Struktur-/Hintergrundfarben) — neue Skin-Farben erscheinen automatisch
  var _SKIN_STRUCT={bg:1,surface:1,'surface-2':1,tile:1,line:1,'line-soft':1};
  var _SKIN_LBL={text:'Neutral',muted:'Gedämpft',faint:'Blass',accent:'Akzent','accent-2':'Akzent 2',ok:'OK',warn:'Warnung',crit:'Kritisch',info:'Info',warm:'Warm',sun:'Sonne',moon:'Mond'};
  function skinColorKeys(){var t=(typeof SKIN_TOKENS!=='undefined'&&SKIN_TOKENS)?SKIN_TOKENS:['accent','ok','warn','crit','info','warm','muted'];return t.filter(function(k){return !_SKIN_STRUCT[k];});}
  function skinSel(cur,attrs){cur=cur||'';var keys=skinColorKeys(),known=(cur===''||keys.indexOf(cur)>=0);
    var op='<option value=""'+(cur===''?' selected':'')+'>Auto</option>'+keys.map(function(k){return '<option value="'+k+'"'+(cur===k?' selected':'')+' style="background:var(--'+k+');color:#08201c">'+(_SKIN_LBL[k]||k)+'</option>';}).join('');
    if(cur&&!known)op='<option value="'+esc(cur)+'" selected style="background:'+esc(cur)+';color:#08201c">Eigene</option>'+op;
    return '<select '+(attrs||'')+' style="'+(cur?(known?('background:var(--'+cur+');color:#08201c'):('background:'+esc(cur)+';color:#08201c')):'')+'">'+op+'</select>';}
  function gaugeColorSel(cur){cur=cur||'accent';var op=skinColorKeys().map(function(k){return '<option value="'+k+'"'+(cur===k?' selected':'')+' style="background:var(--'+k+');color:#08201c">'+(_SKIN_LBL[k]||k)+'</option>';}).join('');op+='<option value="graded"'+(cur==='graded'?' selected':'')+'>Abstufung</option><option value="assoc"'+(cur==='assoc'?' selected':'')+'>Assoziation</option>';return '<select id="pGColor" style="'+((cur&&cur!=='graded'&&cur!=='assoc')?('background:var(--'+cur+');color:#08201c'):'')+'">'+op+'</select>';}
  // Einheitliches Zeitfenster-Control (Anzahl x Einheit) fuer Nicht-Aggregat-Widgets (statetl/statelog)
  var _WINU=[['hour','Stunden'],['day','Tage'],['week','Wochen'],['month','Monate']];
  function winCtl(w){var r=w.range||{n:(w.hours>0?w.hours:24),unit:'hour'};return row('Zeitraum','<input id="pWinN" type="number" min="1" style="width:64px" value="'+(r.n||24)+'"> <select id="pWinU">'+_WINU.map(function(u){return '<option value="'+u[0]+'"'+((r.unit||'hour')===u[0]?' selected':'')+'>'+u[1]+'</option>';}).join('')+'</select>');}
  function winWire(w,cb){function set(patch){var r=w.range||{n:(w.hours>0?w.hours:24),unit:'hour'};w.range={n:r.n,unit:r.unit};for(var k in patch)w.range[k]=patch[k];cb();}if($('#pWinN'))$('#pWinN').oninput=function(){set({n:parseInt(this.value)||1});};if($('#pWinU'))$('#pWinU').onchange=function(){set({unit:this.value});};}
  function listEditor(w,key,title,cols){
    var arr=w[key]||[];var gtc=cols.map(function(){return '1fr';}).join(' ')+' 22px';
    var rows=arr.map(function(r,i){
      return '<div class="fcrow" style="display:grid;grid-template-columns:'+gtc+';gap:4px;margin-bottom:4px">'
        +cols.map(function(c){if(c.type==='color'){var cv=String(r[c.k]!=null?r[c.k]:'');return '<input type="color" data-le="'+key+'.'+i+'.'+c.k+'" value="'+(/^#[0-9a-fA-F]{6}$/.test(cv)?cv:'#00cdab')+'" title="'+esc(c.ph||'Farbe')+'">';}if(c.type==='select'){var sv=String(r[c.k]!=null?r[c.k]:(c.def||''));return '<select data-le="'+key+'.'+i+'.'+c.k+'">'+(c.options||[]).map(function(o){return '<option value="'+o[0]+'"'+(sv===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select>';}if(c.type==='skincolor'){return skinSel(String(r[c.k]!=null?r[c.k]:''),'data-le="'+key+'.'+i+'.'+c.k+'"');}return '<input data-le="'+key+'.'+i+'.'+c.k+'" value="'+esc(String(r[c.k]!=null?r[c.k]:''))+'" placeholder="'+c.ph+'">';}).join('')
        +'<button class="btn" data-ledel="'+key+'.'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
    }).join('');
    return '<div class="prop" style="margin-top:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:5px">'+title+'</div>'+rows+'<button class="btn" data-leadd="'+key+'"><svg class="i"><use href="#ic-plus"/></svg></button></div>';
  }

  // ---------- Hinzufügen ----------
  function addWidget(type,extra,px,py){
    if(chromeIsBarType(type)){chromeAddFromPalette(type);return;} // Leisten sind global, nicht Teil der Seite
    var _wr=WIDGETS[type];
    var sz=(_wr&&_wr.size)||[140,80];   // Default-Größe aus dem Widget-Registry (mit Fallback)
    var w={id:uid(),type:type,x:(px!=null?snap(Math.max(0,px)):snap(40)),y:(py!=null?snap(Math.max(0,py)):snap(40)),w:sz[0],h:sz[1],label:(type==='switch'?'Schalter':(type==='text'?'Text':(type==='powerflow'?'Haus':'Label')))};
    if(_wr&&_wr.defaults)_wr.defaults(w);
    if(type==='shape'){w.shape='rect';w.color='#1b2a30';}
    if(extra)for(var k in extra)w[k]=extra[k];
    state.widgets.push(w);render();select(w.id);
  }
  function _wirePitem(b){b.onclick=function(){addWidget(b.dataset.add);};b.setAttribute('draggable','true');b.addEventListener('dragstart',function(e){e.dataTransfer.setData('text/hlw',b.dataset.add);e.dataTransfer.effectAllowed='copy';});}
  $$('.pitem').forEach(_wirePitem);
  // Registry-Widgets, die (noch) nicht in der kuratierten Palette stehen, automatisch unter „Weitere" ergänzen (ausser noPalette)
  function syncPalette(){
    var pal=document.querySelector('.palette');if(!pal||typeof WIDGETS==='undefined')return;
    var have={};$$('.pitem',pal).forEach(function(el){var t=el.getAttribute('data-add');if(t)have[t]=1;});
    // Alias-Registrierungen (z. B. WIDGETS.powerflow === WIDGETS.flow) dürfen keinen zweiten
    // Palette-Eintrag erzeugen - sonst taucht derselbe Baustein doppelt unter altem Namen auf.
    var seenReg=[];
    Object.keys(have).forEach(function(t){if(WIDGETS[t])seenReg.push(WIDGETS[t]);}); // was die Palette schon zeigt
    var miss=Object.keys(WIDGETS).filter(function(t){
      var reg=WIDGETS[t];
      if(have[t]||!reg||reg.noPalette)return false;
      if(seenReg.indexOf(reg)>=0)return false;   // dieselbe Registrierung nur einmal (Alias)
      seenReg.push(reg);return true;
    }).sort();
    if(!miss.length)return;
    var hdr=document.createElement('div');hdr.className='pgh';hdr.textContent='Weitere';pal.appendChild(hdr);
    miss.forEach(function(t){var el=document.createElement('div');el.className='pitem';el.setAttribute('data-add',t);el.textContent=(WIDGETS[t].label||t);pal.appendChild(el);_wirePitem(el);});
  }
  canvas.addEventListener('dragover',function(e){e.preventDefault();e.dataTransfer.dropEffect='copy';});
  canvas.addEventListener('drop',function(e){e.preventDefault();var r=canvas.getBoundingClientRect();var px=(e.clientX-r.left)/zoom,py=(e.clientY-r.top)/zoom;var blk=e.dataTransfer.getData('text/hlwblock');if(blk){insertBlock(blk,px,py);return;}var t=e.dataTransfer.getData('text/hlw');if(!t)return;
    if(chromeIsBarType(t)){chromeAddFromPalette(t);return;} // Leiste selbst -> neue globale Leiste
    var hit=chromeHitTest(px,py); // in eine Leiste fallen gelassen? -> dort einfuegen (Koordinaten relativ zur Leiste)
    if(hit){chromeAddWidget(hit.def.id,t,px-hit.x-70,py-hit.y-30);return;}
    var co=chromeContent();addWidget(t,null,px-co.x-70,py-co.y-30);});

  // ---------- Drag / Resize / Marquee / Ausricht-Guides ----------
  var drag=null,marq=null;
  function applyGeom(w){var el=$('.w[data-id="'+w.id+'"]',canvas);if(el){el.style.left=w.x+'px';el.style.top=w.y+'px';el.style.width=w.w+'px';el.style.height=w.h+'px';if(_ec[w.id])_ec[w.id].resize();if(w.type==='html'&&(w.htmlFit==='width'||w.htmlFit==='both'))applyHtmlScale(w);}}
  function clearGuides(){$$('.guide',canvas).forEach(function(e){e.remove();});}
  // Hilfslinie zeichnen — wahlweise in eine Leiste (dann relativ zu ihr) statt auf die Seite
  function drawGuide(dir,pos,host,lw,lh){var g=document.createElement('div');g.className='guide '+dir;
    if(dir==='v'){g.style.left=pos+'px';g.style.top='0';g.style.height=(lh||state.page.h)+'px';}
    else{g.style.top=pos+'px';g.style.left='0';g.style.width=(lw||state.page.w)+'px';}
    (host||canvas).appendChild(g);}
  function snapAlign(items,dx,dy,noSnap){
    var TH=6,it=items[0],w=it.w,nx=it.ox+dx,ny=it.oy+dy;
    if(noSnap){clearGuides();return {dx:gridOn?snap(dx):Math.round(dx),dy:gridOn?snap(dy):Math.round(dy)};} // Alt: Snapping aus
    // Widget in einer Leiste? Dann an den Geschwistern IN der Leiste ausrichten, nicht an der Seite
    var owner=(typeof chromeOwnerOf==='function')?chromeOwnerOf(w.id):null;
    var gHost=null,gW=null,gH=null,others;
    if(owner){
      others=(owner.widgets||[]).filter(function(o){return !sel[o.id];});
      gHost=$('.chrome[data-chrome="'+owner.id+'"]',canvas);
      var gg=(typeof _chromeGeoOf==='function')?_chromeGeoOf(owner.id):null;
      if(gg){gW=gg.w;gH=gg.h;}
    }else{
      others=state.widgets.filter(function(o){return !sel[o.id];});
    }
    var ax=null,ay=null,gx=null,gy=null;
    var xs=[[nx,0],[nx+w.w,w.w],[nx+w.w/2,w.w/2]],ys=[[ny,0],[ny+w.h,w.h],[ny+w.h/2,w.h/2]];
    var gap=bcfg().gap||0;
    others.forEach(function(o){
      [o.x,o.x+o.w,o.x+o.w/2].forEach(function(px){xs.forEach(function(q){if(ax===null&&Math.abs(px-q[0])<=TH){ax=px-q[1]-it.ox;gx=px;}});});
      [o.y,o.y+o.h,o.y+o.h/2].forEach(function(py){ys.forEach(function(q){if(ay===null&&Math.abs(py-q[0])<=TH){ay=py-q[1]-it.oy;gy=py;}});});
      if(gap>0){ // Standardabstand: rechts/links/unter/über dem Nachbarn mit festem Gap einrasten
        if(ax===null&&Math.abs((o.x+o.w+gap)-nx)<=TH){ax=(o.x+o.w+gap)-it.ox;gx=o.x+o.w;}
        if(ax===null&&Math.abs((o.x-gap)-(nx+w.w))<=TH){ax=(o.x-gap-w.w)-it.ox;gx=o.x;}
        if(ay===null&&Math.abs((o.y+o.h+gap)-ny)<=TH){ay=(o.y+o.h+gap)-it.oy;gy=o.y+o.h;}
        if(ay===null&&Math.abs((o.y-gap)-(ny+w.h))<=TH){ay=(o.y-gap-w.h)-it.oy;gy=o.y;}
      }
    });
    // Zusätzlich an den Kanten und der Mitte der Leiste einrasten — aber nur, wenn in der
    // jeweiligen Achse genug Luft bleibt. In einer schmalen Bar (z. B. 56 px hoch) liegen
    // Oberkante, Mitte und Unterkante sonst so dicht, dass jede Position einrastet und sich
    // das Widget gar nicht mehr frei setzen lässt.
    if(owner&&gW!=null&&gH!=null){
      if((gW-w.w)>4*TH)[0,gW,gW/2].forEach(function(px){xs.forEach(function(q){if(ax===null&&Math.abs(px-q[0])<=TH){ax=px-q[1]-it.ox;gx=px;}});});
      if((gH-w.h)>4*TH)[0,gH,gH/2].forEach(function(py){ys.forEach(function(q){if(ay===null&&Math.abs(py-q[0])<=TH){ay=py-q[1]-it.oy;gy=py;}});});
    }
    clearGuides();
    var fdx=(ax!==null)?ax:(gridOn?snap(dx):Math.round(dx));
    var fdy=(ay!==null)?ay:(gridOn?snap(dy):Math.round(dy));
    if(gx!==null)drawGuide('v',gx,gHost,gW,gH);if(gy!==null)drawGuide('h',gy,gHost,gW,gH);
    return {dx:fdx,dy:fdy};
  }
  // Resize-Snapping: bewegte Kante an Kanten anderer Widgets einrasten; sonst Breite/Höhe an andere Widgets angleichen.
  function snapResize(drag,dir,nw,nh,noSnap){
    var res={w:nw,h:nh,gx:null,gy:null};
    if(noSnap){res.w=gridOn?snap(nw):Math.round(nw);res.h=gridOn?snap(nh):Math.round(nh);return res;} // Alt: Snapping aus
    var TH=6,others=state.widgets.filter(function(o){return !sel[o.id]&&o!==drag.w;});
    var lo=drag.ox,ro=drag.ox+drag.ow,to=drag.oy,bo=drag.oy+drag.oh; // feste Gegenkante beim Resizen
    // ---- Breite ----
    if(dir.indexOf('e')>=0||dir.indexOf('w')>=0){
      var edge=(dir.indexOf('e')>=0)?(lo+nw):(ro-nw),bestE=null;   // bewegte X-Kante
      others.forEach(function(o){[o.x,o.x+o.w].forEach(function(px){var d=Math.abs(px-edge);if(d<=TH&&(!bestE||d<bestE.d))bestE={d:d,px:px};});});
      if(bestE){res.gx=bestE.px;res.w=(dir.indexOf('e')>=0)?(bestE.px-lo):(ro-bestE.px);}
      else{others.forEach(function(o){if(res.gx===null&&Math.abs(o.w-nw)<=TH)res.w=o.w;});} // Breite angleichen (z. B. Element darüber)
    }
    // ---- Höhe ----
    if(dir.indexOf('s')>=0||dir.indexOf('n')>=0){
      var edgeY=(dir.indexOf('s')>=0)?(to+nh):(bo-nh),bestY=null;  // bewegte Y-Kante
      others.forEach(function(o){[o.y,o.y+o.h].forEach(function(py){var d=Math.abs(py-edgeY);if(d<=TH&&(!bestY||d<bestY.d))bestY={d:d,py:py};});});
      if(bestY){res.gy=bestY.py;res.h=(dir.indexOf('s')>=0)?(bestY.py-to):(bo-bestY.py);}
      else{others.forEach(function(o){if(res.gy===null&&Math.abs(o.h-nh)<=TH)res.h=o.h;});} // Höhe angleichen (z. B. Element links)
    }
    return res;
  }
  function addCopies(src){if(!src.length)return;var gmap={};var copies=src.map(function(w){var c=JSON.parse(JSON.stringify(w));c.id=uid();c.x=(c.x||0)+16;c.y=(c.y||0)+16;delete c.name;delete c.hidden;if(c.group){if(!gmap[c.group])gmap[c.group]='g'+uid();c.group=gmap[c.group];}return c;});copies.forEach(function(c){state.widgets.push(c);});sel={};copies.forEach(function(c){sel[c.id]=true;});selId=copies.slice(-1)[0].id;render();renderProps();commit();}
  // Ausrichten / Verteilen (auf die aktuelle Mehrfachauswahl)
  function selWidgets(){return Object.keys(sel).map(widget).filter(Boolean);}
  function alignSel(kind){
    var ws=selWidgets();if(ws.length<2)return;
    var minX=Math.min.apply(null,ws.map(function(w){return w.x;})),maxR=Math.max.apply(null,ws.map(function(w){return w.x+w.w;}));
    var minY=Math.min.apply(null,ws.map(function(w){return w.y;})),maxB=Math.max.apply(null,ws.map(function(w){return w.y+w.h;}));
    ws.forEach(function(w){
      if(kind==='left')w.x=minX;else if(kind==='right')w.x=maxR-w.w;else if(kind==='cx')w.x=Math.round((minX+maxR)/2-w.w/2);
      else if(kind==='top')w.y=minY;else if(kind==='bottom')w.y=maxB-w.h;else if(kind==='cy')w.y=Math.round((minY+maxB)/2-w.h/2);
    });render();renderProps();
  }
  function distributeSel(axis){
    var ws=selWidgets();if(ws.length<3)return;
    if(axis==='h'){ws.sort(function(a,b){return (a.x+a.w/2)-(b.x+b.w/2);});var c0=ws[0].x+ws[0].w/2,c1=ws[ws.length-1].x+ws[ws.length-1].w/2,st=(c1-c0)/(ws.length-1);
      ws.forEach(function(w,i){if(i>0&&i<ws.length-1)w.x=Math.round(c0+st*i-w.w/2);});}
    else{ws.sort(function(a,b){return (a.y+a.h/2)-(b.y+b.h/2);});var d0=ws[0].y+ws[0].h/2,d1=ws[ws.length-1].y+ws[ws.length-1].h/2,st=(d1-d0)/(ws.length-1);
      ws.forEach(function(w,i){if(i>0&&i<ws.length-1)w.y=Math.round(d0+st*i-w.h/2);});}
    render();renderProps();
  }
  function groupSel(){var ws=selWidgets();if(ws.length<2){toast('Mind. 2 Elemente wählen');return;}
    var gid='g'+uid();ws.forEach(function(w){w.group=gid;delete w.gmaster;});
    var mId=Object.keys(sel)[0],mw=mId?widget(mId):ws[0];if(mw)mw.gmaster=true; // erstes gewähltes = Master
    render();renderProps();commit();toast(ws.length+' gruppiert (Master: '+((mw&&(mw.name||mw.label))||mw&&mw.type||'?')+')');}
  function ungroupSel(){var ws=selWidgets(),n=0;ws.forEach(function(w){if(w.group){delete w.group;delete w.gmaster;n++;}});if(n){render();renderProps();commit();toast('Gruppierung aufgehoben');}}
  function alignSection(){
    var b=function(a,ic,ti){return '<button class="btn" data-al="'+a+'" title="'+ti+'" style="padding:6px;flex:1"><svg class="i"><use href="#ic-'+ic+'"/></svg></button>';};
    return '<div class="prop" style="margin-bottom:10px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">Ausrichten &amp; Verteilen ('+Object.keys(sel).length+')</div>'
      +'<div style="display:flex;gap:4px">'+b('left','al-left','Links')+b('cx','al-cx','Horizontal zentrieren')+b('right','al-right','Rechts')+b('top','al-top','Oben')+b('cy','al-cy','Vertikal zentrieren')+b('bottom','al-bottom','Unten')+'</div>'
      +'<div style="display:flex;gap:4px;margin-top:4px">'+b('disth','dist-h','Horizontal verteilen')+b('distv','dist-v','Vertikal verteilen')+'</div>'
      +'<div style="display:flex;gap:4px;margin-top:4px"><button class="btn" data-al="group" style="padding:6px;flex:1" title="Elemente gruppieren (Strg/Cmd+G)">Gruppieren</button><button class="btn" data-al="ungroup" style="padding:6px;flex:1" title="Gruppierung aufheben (Strg/Cmd+Shift+G)">Lösen</button></div></div>';
  }

  canvas.addEventListener('mousedown',function(e){
    if(mode!=='edit')return;
    var el=e.target.closest('.w');
    if(!el){
      var chEl=e.target.closest('.chrome'); // Leiste angeklickt -> auswählen (nicht verschiebbar: Lage ergibt sich aus der Seite)
      if(chEl){select(chEl.dataset.chrome);e.preventDefault();return;}
    }
    if(!el){ // Marquee-Auswahl auf leerer Fläche
      var r=canvas.getBoundingClientRect();marq={x0:(e.clientX-r.left)/zoom,y0:(e.clientY-r.top)/zoom,shift:e.shiftKey,el:document.createElement('div')};marq.el.className='marquee';canvas.appendChild(marq.el);
      if(!e.shiftKey){selClear();markSel();renderProps();}
      e.preventDefault();return;
    }
    if(el.dataset.refsrc){var _ow=widget(el.dataset.refsrc);if(_ow){select(_ow.id);e.preventDefault();return;}} // Laufzeilen-Kachel: referenziertes Original auswählen (kein Drag)
    var w=widget(el.dataset.id);
    var _rz=e.target.dataset.rz;if(_rz){select(w.id);drag={mode:'rz',dir:_rz,w:w,sx:e.clientX,sy:e.clientY,ox:w.x,oy:w.y,ow:w.w,oh:w.h};e.preventDefault();return;} // Resize von jeder Kante/Ecke
    if(e.shiftKey){select(w.id,true);}
    else if(!sel[w.id]){select(w.id);}
    else{selId=w.id;renderProps();}
    drag={mode:'mv',items:Object.keys(sel).map(widget).filter(Boolean).map(function(x){return {w:x,ox:x.x,oy:x.y};}),sx:e.clientX,sy:e.clientY};
    e.preventDefault();
  });
  window.addEventListener('mousemove',function(e){
    if(marq){var r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/zoom,y=(e.clientY-r.top)/zoom,L=Math.min(x,marq.x0),T=Math.min(y,marq.y0),W=Math.abs(x-marq.x0),H=Math.abs(y-marq.y0);marq.el.style.left=L+'px';marq.el.style.top=T+'px';marq.el.style.width=W+'px';marq.el.style.height=H+'px';marq.rect={L:L,T:T,R:L+W,B:T+H};return;}
    if(!drag)return;var dx=(e.clientX-drag.sx)/zoom,dy=(e.clientY-drag.sy)/zoom;
    if(drag.mode==='rz'){var dir=drag.dir||'se',nx=drag.ox,ny=drag.oy,nw=drag.ow,nh=drag.oh;
      if(dir.indexOf('e')>=0)nw=drag.ow+dx; if(dir.indexOf('w')>=0)nw=drag.ow-dx;
      if(dir.indexOf('s')>=0)nh=drag.oh+dy; if(dir.indexOf('n')>=0)nh=drag.oh-dy;
      var sr=snapResize(drag,dir,Math.max(40,nw),Math.max(28,nh),e.altKey); // Kanten-/Größen-Snapping (Alt = aus)
      nw=Math.max(40,sr.w);nh=Math.max(28,sr.h);clearGuides();
      if(sr.gx!==null)drawGuide('v',sr.gx);if(sr.gy!==null)drawGuide('h',sr.gy);
      if(dir.indexOf('w')>=0)nx=drag.ox+drag.ow-nw; // rechte Kante fix
      if(dir.indexOf('n')>=0)ny=drag.oy+drag.oh-nh; // untere Kante fix
      drag.w.x=Math.max(0,nx);drag.w.y=Math.max(0,ny);drag.w.w=Math.round(nw);drag.w.h=Math.round(nh);applyGeom(drag.w);badge(e,Math.round(nw)+' × '+Math.round(nh)+' px');return;}
    var g=snapAlign(drag.items,dx,dy,e.altKey);
    drag.items.forEach(function(it){var nx2=Math.max(0,it.ox+g.dx),ny2=Math.max(0,it.oy+g.dy);
      var ow=(typeof chromeOwnerOf==='function')?chromeOwnerOf(it.w.id):null; // in einer Leiste: nicht hinausschieben
      if(ow){var gg=_chromeGeoOf(ow.id);if(gg){nx2=Math.min(nx2,Math.max(0,gg.w-it.w.w));ny2=Math.min(ny2,Math.max(0,gg.h-it.w.h));}}
      it.w.x=nx2;it.w.y=ny2;applyGeom(it.w);});
    updateGroupBoxes(); // Gruppenrahmen mitführen
    badge(e,Math.round(drag.items[0].w.x)+' , '+Math.round(drag.items[0].w.y));
  });
  function badge(e,txt){var b=$('#selbadge');b.textContent=txt;b.style.left=(e.clientX+16)+'px';b.style.top=(e.clientY+16)+'px';b.style.display='block';}
  window.addEventListener('mouseup',function(e){
    $('#selbadge').style.display='none';
    // Ein gezogenes Seiten-Widget ueber einer Leiste loslassen -> dorthin verschieben.
    // Ohne das koennte man Widgets nur aus der Palette in eine Leiste bekommen.
    if(drag&&drag.mode==='mv'&&drag.items&&drag.items.length&&typeof chromeHitTest==='function'){
      var _r=canvas.getBoundingClientRect(),_px=(e.clientX-_r.left)/zoom,_py=(e.clientY-_r.top)/zoom;
      var _hit=chromeHitTest(_px,_py);
      var _ids=drag.items.map(function(it){return it.w.id;});
      var _onPage=_ids.filter(function(id){return state.widgets.some(function(x){return x.id===id;});});
      if(_hit&&_onPage.length){
        clearGuides();drag=null;
        var _n=chromeMoveIn(_hit.def.id,_onPage);
        if(_n&&typeof toast==='function')toast(_n+' Widget(s) in „'+(_hit.def.name||'Leiste')+'" verschoben');
        return;
      }
    }
    if(marq){var rc=marq.rect;if(rc){var _co=chromeContent(); // Seiten-Widgets liegen relativ zur (geschrumpften) Inhaltsflaeche
      state.widgets.forEach(function(w){var wx=w.x+_co.x,wy=w.y+_co.y;if(wx<rc.R&&wx+w.w>rc.L&&wy<rc.B&&wy+w.h>rc.T)sel[w.id]=true;});}marq.el.remove();marq=null;selId=Object.keys(sel).slice(-1)[0]||null;markSel();renderProps();return;}
    if(drag){clearGuides();renderProps();drag=null;commit();drawStructure();}
  });
