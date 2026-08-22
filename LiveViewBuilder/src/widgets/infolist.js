  // ===== Widget: Info-Liste =====
  //
  // Eine Liste aus Zeilen: Icon, Name (+Zusatz), rechts ein Wert oder eine Pill.
  // Darum herum drei Zutaten, die sich frei kombinieren lassen:
  //
  //   KOPFZEILE  grosses Icon mit Zaehler, Titel, Untertitel, Pfeil
  //   FUSSZEILE  eine gedaempfte Zeile unter der Liste (Hinweis, Regel, Zustand)
  //   je ZEILE   Karte (getoent), Fortschrittsbalken, Wertfarbe, Aktion
  //
  // Die "Vorlage" waehlt nicht eine andere Zeichenart, sondern setzt genau diese
  // Zutaten passend - und auf Wunsch Beispielzeilen dazu. Wer sie danach
  // umbaut, verliert nichts: es gibt keinen Vorlagen-Modus, der etwas erzwingt.
  //
  // Schalten: eine Zeile kann eine Variable schreiben, ein Skript starten oder
  // ein Popup oeffnen. Die Variable geht ueber denselben Weg wie jeder Schalter
  // im Haus - der Hook ruft RequestAction, wenn die Variable eine Aktion hat,
  // sonst SetValue. Ein Rollo, eine Tuer oder eine Waschmaschine wird also
  // wirklich geschaltet und nicht nur der Wert ueberschrieben.
  function _ilFarbe(c,fb){var v=c?(_cssColorOrEmpty(c)||''):'';return v||(fb||'');}
  /** Kopfzeile: Icon + Abzeichen, Titel, Untertitel, Chevron. */
  function _ilKopf(w){
    if(!w.ilHead)return '';
    var c=_ilFarbe(w.ilhColor,'var(--accent)');
    var sc=_ilFarbe(w.ilhSubCol,'');
    // Abzeichen: eigene Farbe (sonst wie das Icon) und eine Untergrenze, ab der
    // es ueberhaupt erscheint. Eine 0 im roten Kreis meldet etwas, wo nichts ist -
    // und "25" fuer 25 Tage bis zur Abholung ist keine Meldung, sondern eine Zahl.
    var bc=_ilFarbe(w.ilhBadgeCol,'');
    var bst=bc?(' style="background:'+bc+'"'):'';
    var bmin=(w.ilhBadgeMin!=null&&w.ilhBadgeMin!=='')?(' data-min="'+parseFloat(w.ilhBadgeMin)+'"'):'';
    var zahl=(w.ilhBadgeVid?'<span class="ilbadge" data-vid="'+w.ilhBadgeVid+'"'+_slotAttrs({dec:0})+bmin+bst+'>–</span>'
             :(w.ilhBadge?'<span class="ilbadge"'+bst+'>'+esc(w.ilhBadge)+'</span>':''));
    var sub=(w.ilhSubVid?'<span data-vid="'+w.ilhSubVid+'"'+_slotAttrs(w.ilhSubUnit?{unit:w.ilhSubUnit}:{})+'>–</span>'
            :(w.ilhSub?esc(w.ilhSub):''));
    return '<div class="ilhead'+(w.ilhTo?' tap':'')+'" data-ilhead="1" style="--c:'+c+'">'
      +'<span class="ilhi">'+iconSVG(w.ilhIcon||'info')+zahl+'</span>'
      +'<span class="ilht"><b>'+esc(w.ilhTitle||'')+'</b>'
        +(sub?('<span'+(sc?(' style="color:'+sc+'"'):'')+'>'+sub+'</span>'):'')+'</span>'
      +(w.ilhTo?'<span class="ilchev">'+iconSVG('arrowright')+'</span>':'')+'</div>';
  }
  /** Fusszeile: gedaempfter Hinweis unter der Liste. */
  function _ilFuss(w){
    if(!w.ilFoot)return '';
    var t=(w.ilfVid?'<span data-vid="'+w.ilfVid+'">–</span>':esc(w.ilfText||''));
    return '<div class="ilfoot'+(w.ilfTo?' tap':'')+'" data-ilfoot="1">'
      +(w.ilfIcon?('<span class="ilfi">'+iconSVG(w.ilfIcon)+'</span>'):'')+'<span>'+t+'</span></div>';
  }
  /** Aktionsknopf einer Zeile. Ohne Icon kein Knopf - ein leerer Kasten waere ein Versprechen ohne Inhalt. */
  function _ilKnopf(r,i,zweiter){
    var ic=zweiter?r.btn2:r.btn;
    if(!ic)return '';
    var b=_ilFarbe(zweiter?r.btn2Col:r.btnCol,'var(--accent)');
    var ti=zweiter?r.btn2Title:r.btnTitle;
    return '<button class="hibtn" data-ilb="'+i+'"'+(zweiter?' data-ilb2="1"':'')+' style="--b:'+b+'"'
      +(ti?(' title="'+esc(ti)+'"'):'')+'>'+iconSVG(ic)+'</button>';
  }
  /** Hat die Zeile etwas zu tun? Legacy-Felder (btnVid/btnTo) zaehlen mit. */
  function _ilHatAkt(r){return !!(r.actVid||r.actScript||r.actTo||r.btnVid||r.btnTo);}
  /**
   * Die Aktion einer Zeile ausfuehren.
   *
   * Reihenfolge: Popup, dann Skript, dann Variable. Eine Zeile, die alles drei
   * traegt, ist ein Bedienfehler - aber sie soll berechenbar bleiben.
   *
   * Wert leer = umschalten. Dafuer wird der zuletzt gemeldete Wert gelesen; ist
   * keiner da (Zahl statt Schalter), wird nichts geraten und true geschickt.
   */
  function _ilTue(r,zwei){
    // Der zweite Knopf hat einen eigenen Satz Ziele. Fehlt einer davon, gilt der
    // erste - so genuegt beim Tor der zweite WERT (auf/zu an derselben Variablen).
    var to=zwei?(r.act2To||r.actTo||r.btnTo):(r.actTo||r.btnTo);
    var sc=zwei?(r.act2Script||r.actScript):r.actScript;
    var vid=zwei?(r.act2Vid||r.actVid||r.btnVid):(r.actVid||r.btnVid);
    if(to){openPopup(to);return;}
    if(sc){fetch('?api=runscript&id='+(parseInt(sc)||0)+'&key='+encodeURIComponent(TOKEN),{cache:'no-store'});toast('Skript gestartet');return;}
    if(!vid)return;
    var _av=zwei?r.act2Val:r.actVal;
    var val=(_av!=null&&_av!=='')?_av:((!zwei&&r.btnVal!=null&&r.btnVal!=='')?r.btnVal:null);
    if(val===null){
      var lv=(typeof _lastVals!=='undefined')?_lastVals[vid]:null;
      var an=lv&&(lv.v===true||lv.v===1||lv.v==='1'||lv.v==='true');
      val=an?false:true;
    }
    setVar(vid,val);
    toast(r.label?(r.label+': geschaltet'):'geschaltet');
  }
  /**
   * Vorlage einsetzen.
   *
   * Sie setzt Kopf, Fuss und Zeilen - aber nur, was die Vorlage ausmacht. Was
   * der Anwender daran spaeter aendert, bleibt geaendert; es gibt keinen
   * Vorlagen-Modus, der beim naechsten Zeichnen wieder zurueckstellt.
   */
  function _ilVorlage(w,key){
    if(key==='karten'){
      w.ilRow='karte';toast('Vorlage: Karten');return;
    }
    if(key==='geraete'){
      w.ilRow=undefined;w.ilHead=true;w.ilFoot=undefined;
      w.ilhIcon='washer';w.ilhColor='info';w.ilhTitle='Geräte';w.ilhSub='2 laufen · 1 fertig';w.ilhSubCol='';w.ilhBadge='';
      w.items=[
        {icon:'washer',color:'info',label:'Waschmaschine',value:'38 min',valCol:'info',prog:64,progCol:'info'},
        {icon:'oven',color:'info',label:'Backofen',value:'22 min',valCol:'info',prog:78,progCol:'info'},
        {icon:'dishwasher',color:'ok',label:'Geschirrspüler',value:'fertig',valCol:'ok'},
        {icon:'dryer',color:'',label:'Trockner',value:'aus'}
      ];
      toast('Vorlage: Geräte');return;
    }
    if(key==='tueren'){
      w.ilRow=undefined;w.ilHead=true;w.ilFoot=true;
      w.ilhIcon='door';w.ilhColor='warn';w.ilhTitle='Zugänge';w.ilhSub='1 von 6 offen';w.ilhSubCol='warn';w.ilhBadge='';
      w.ilfIcon='bell';w.ilfText='Meldung beim Verlassen';
      w.items=[
        {icon:'door',color:'warn',label:'Terrassentür',value:'14 min',valCol:'warn',karte:'1',bg:'warn'},
        {icon:'lock',color:'ok',label:'Haustür',value:'verriegelt',valCol:'ok'},
        {icon:'garage',color:'ok',label:'Garage',value:'zu',valCol:'ok'},
        {icon:'garage',color:'ok',label:'Hoftor',value:'zu',valCol:'ok'}
      ];
      toast('Vorlage: Türen & Tore');return;
    }
    w.ilRow=undefined;toast('Vorlage: schlicht');
  }
  defWidget('infolist',{
    label:'Info-Liste', cat:'Anzeige', paletteIcon:'wlist', size:[260,180],
    defaults:function(w){w.items=[{icon:'washer',label:'Waschmaschine',sub:'Restzeit 0:42',pill:'läuft',state:'on'},{icon:'dryer',label:'Trockner',sub:'bereit',pill:'aus',state:'off'},{icon:'car',label:'BMW',sub:'Reichweite 213 km',value:'64 %'}];},
    render:function(w){
      var alleKarten=(w.ilRow==='karte');
      var kopf=_ilKopf(w),fuss=_ilFuss(w);
      var huelle=(kopf||fuss);
      var zeilen=(w.items||[]).map(function(r,i){
        var karte=(alleKarten||!!r.karte);
        // Pille: fester Text ODER Variable. Sie war bisher nur Text - damit taugte
        // sie fuer "laeuft/aus", aber nicht fuer einen Zustand, der sich aendert.
        // Mit pillVid steht dort der Wert der Variablen, formatiert wie ueberall
        // (Profil, Nachkommastellen, Einheit).
        var ptxt=r.pillVid?('<span data-vid="'+r.pillVid+'"'+_slotAttrs(r)+'>–</span>'):esc(r.pill||'');
        // Wert UND Pille nebeneinander, wenn beides eingestellt ist. Sie sagen
        // Verschiedenes - bei einer Tuer der Kontakt (offen/zu) und das Schloss
        // (verriegelt/entriegelt); eines davon zu verschlucken hiesse, die
        // Haelfte der Auskunft wegzuwerfen.
        var hatWert=!!(r.vid||(r.value!=null&&r.value!==''));
        var wert=hatWert?('<span class="hiv"'+(r.vid?(' data-vid="'+r.vid+'"'+_slotAttrs(r)):'')
                       +(r.valCol?(' style="color:'+_ilFarbe(r.valCol,'')+'"'):'')+'>'+esc(r.value||'')+'</span>'):'';
        var pille=(r.pill||r.pillVid)?('<span class="hpill '+esc(r.state||'ok')+'"><span class="hpd"></span>'+ptxt+'</span>'):'';
        var rt=(wert||pille)?(wert+pille):'<span class="hiv"></span>';
        var _ic=r.color?(_cssColorOrEmpty(r.color)||''):'';
        // In der Kartenform traegt die Zeile die Toenung: eigene Kartenfarbe, sonst
        // die Farbe des Icons. Ohne beides bleibt sie neutral - eine Karte ohne
        // Aussage soll nicht bunt sein.
        var kc=karte?_ilFarbe(r.bg,_ic||''):'';
        // Fortschritt: fester Wert oder Variable. Die Variable schreibt der
        // Live-Kanal ueber data-vidbar direkt in die Breite - derselbe Weg wie
        // bei den Meter-Balken, kein zweiter Mechanismus.
        var pv=(r.prog!=null&&r.prog!=='')?Math.max(0,Math.min(100,parseFloat(r.prog)||0)):null;
        var bar=(r.progVid||pv!=null)
          ?('<span class="hiprog"><span'+(r.progVid?(' data-vidbar="'+r.progVid+'"'):'')
            +' style="width:'+(pv!=null?pv:0)+'%;background:'+_ilFarbe(r.progCol,_ic||'var(--accent)')+'"></span></span>')
          :'';
        var tap=_ilHatAkt(r)&&!r.btn;   // ohne Knopf ist die ganze Zeile der Schalter
        return '<div class="hinfo'+(karte?' hicard':'')+(bar?' mitbar':'')+(tap?' tap':'')+'"'
          +(kc?(' style="--c:'+kc+'"'):'')+(tap?(' data-ilrow="'+i+'"'):'')+'>'
          +'<span class="hirow">'
            +'<span class="hibi"'+(_ic?' style="color:'+_ic+';background:color-mix(in oklab,'+_ic+' 14%,var(--surface-2))"':'')+'>'+iconSVG(r.icon||'sensor')+'</span>'
            // Zusatzzeile: fester Text ODER Variable. Unter dem Namen ist Platz,
            // den die rechte Seite nicht hat - bei einer Tuer steht dort der
            // Kontakt, waehrend die Pille das Schloss zeigt. Nebeneinander
            // passte beides auf einer schmalen Kachel nicht.
            +'<span class="hin">'+esc(r.label||'')
              +(r.subVid?('<small><span data-vid="'+r.subVid+'"'+_slotAttrs(r)+'>–</span></small>')
                        :(r.sub?('<small>'+esc(r.sub)+'</small>'):''))+'</span>'
            +rt+_ilKnopf(r,i,false)+_ilKnopf(r,i,true)
          +'</span>'+bar+'</div>';
      }).join('');
      return (huelle?'<div class="hilhead">':'')+kopf
        +'<div class="hinfos'+(alleKarten?' karten':'')+(w.ilBare?' blank':'')+'">'+zeilen+'</div>'
        +fuss+(huelle?'</div>':'');
    },
    // Kopfzeile, Fusszeile, Knoepfe und schaltende Zeilen fangen den Klick ab,
    // damit er nicht zusaetzlich als Klick auf die ganze Kachel gilt.
    click:function(w,el,e){
      var b=e.target.closest('[data-ilb]'),z=e.target.closest('[data-ilrow]');
      var r=null,zwei=false;
      if(b){r=(w.items||[])[parseInt(b.getAttribute('data-ilb'))||0];zwei=(b.getAttribute('data-ilb2')==='1');}
      else if(z)r=(w.items||[])[parseInt(z.getAttribute('data-ilrow'))||0];
      if(r){_ilTue(r,zwei);return true;}
      if(e.target.closest('[data-ilfoot]')&&w.ilfTo){openPopup(w.ilfTo);return true;}
      if(e.target.closest('[data-ilhead]')&&w.ilhTo){openPopup(w.ilhTo);return true;}
      return false;
    },
    props:function(w){
      var TPL=[['','schlicht'],['karten','Karten (alle Zeilen getönt)'],['geraete','Geräte (mit Balken)'],['tueren','Türen & Tore (mit Fußzeile)']];
      return (w.type==='infolist'
      ?'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Je Zeile: Icon, Name (+Zusatz), rechts entweder ein <b>Wert</b> oder eine <b>Pill</b>. „Status" färbt nur die Pill ein (ohne Pill-Text hat er keine Wirkung).</div>'
        +row('Zeilenrahmen','<input type="checkbox" id="pIlBare"'+(w.ilBare?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">ohne Kasten je Zeile — nur Abstand statt Trennern</span>')
        +row('Vorlage','<select id="pIlTpl">'+TPL.map(function(t){return '<option value="'+t[0]+'"'+((w.ilTpl||'')===t[0]?' selected':'')+'>'+t[1]+'</option>';}).join('')+'</select> '
            +'<button class="btn" id="pIlTplGo" style="padding:4px 8px;font-size:11px">einsetzen</button>')
        +'<div class="hint" style="font-size:11px;margin:0 2px 8px">„Einsetzen" stellt Kopf-, Fuß- und Zeilenangaben passend ein und legt Beispielzeilen an. Danach ist alles frei änderbar — die Vorlage erzwingt nichts.</div>'
        +'<div class="pgh">Kopfzeile</div>'
        +row('Kopfzeile','<input type="checkbox" id="pIlHead"'+(w.ilHead?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Icon mit Zähler, Titel, Untertitel</span>')
        +(w.ilHead?(
           row('Icon · Farbe','<button class="btn" id="pIlhIcon" title="Icon wählen" style="padding:3px 6px">'+(w.ilhIcon?iconSVG(w.ilhIcon):'+')+'</button> '+skinSel(String(w.ilhColor||''),'id="pIlhColor"'))
          +row('Titel','<input id="pIlhTitle" value="'+esc(w.ilhTitle||'')+'" placeholder="Zugänge">')
          +row('Untertitel','<input id="pIlhSub" value="'+esc(w.ilhSub||'')+'" placeholder="fester Text" style="width:104px"> '
              +'<input id="pIlhSubVid" value="'+(w.ilhSubVid||'')+'" placeholder="VarID" style="width:64px"> '+skinSel(String(w.ilhSubCol||''),'id="pIlhSubCol" title="Farbe"'))
          +row('Zähler','<input id="pIlhBadge" value="'+esc(w.ilhBadge||'')+'" placeholder="fest" style="width:56px"> '
              +'<input id="pIlhBadgeVid" value="'+(w.ilhBadgeVid||'')+'" placeholder="VarID" style="width:64px"> '
              +skinSel(String(w.ilhBadgeCol||''),'id="pIlhBadgeCol" title="Farbe des Abzeichens"')+' '
              +'<input id="pIlhBadgeMin" type="number" value="'+(w.ilhBadgeMin!=null?w.ilhBadgeMin:'')+'" placeholder="ab" style="width:52px" title="erst ab dieser Zahl zeigen">')
          +row('','<span style="font-size:11px;color:var(--muted)">leer = kein Abzeichen · Farbe leer = wie das Icon · „ab" blendet kleinere Werte aus (z. B. ab 1 versteckt die 0) — gilt für den Zähler aus einer Variablen</span>')
          +row('Öffnet','<select id="pIlhTo">'+viewOpts(w.ilhTo,'popup','— nichts —')+'</select> <span style="font-size:11px;color:var(--muted)">zeigt dann auch den Pfeil</span>')
         ):'')
        +'<div class="pgh">Fußzeile</div>'
        +row('Fußzeile','<input type="checkbox" id="pIlFoot"'+(w.ilFoot?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">gedämpfte Zeile unter der Liste</span>')
        +(w.ilFoot?(
           row('Icon · Text','<button class="btn" id="pIlfIcon" title="Icon wählen" style="padding:3px 6px">'+(w.ilfIcon?iconSVG(w.ilfIcon):'+')+'</button> '
              +'<input id="pIlfText" value="'+esc(w.ilfText||'')+'" placeholder="Meldung beim Verlassen" style="width:150px">')
          +row('oder Variable','<input id="pIlfVid" value="'+(w.ilfVid||'')+'" placeholder="VarID" style="width:74px"> '
              +'<select id="pIlfTo">'+viewOpts(w.ilfTo,'popup','— öffnet nichts —')+'</select>')
         ):'')
        +listEditor(w,'items','Zeile: Icon · Farbe · Name · Zusatz · Wert · Pill (Text oder VarID) · Status(Pill-Farbe) · VarID',[{k:'icon',type:'icon',h:'Icon',ph:'Icon wählen'},{k:'color',type:'skincolor',h:'Farbe (Icon)'},{k:'label',h:'Name',ph:'Name'},{k:'sub',h:'Zusatz',ph:'Zusatz'},{k:'subVid',h:'Zusatz-ID',ph:'VarID'},{k:'value',h:'Wert',ph:'Wert'},{k:'dec',h:'Dez',ph:'Dez'},{k:'unit',h:'Einh',ph:'Einh'},{k:'pill',h:'Pill',ph:'Pill'},{k:'pillVid',h:'Pill-ID',ph:'VarID'},{k:'state',type:'select',def:'ok',h:'Status (Pill)',ph:'Status',options:[['ok','OK · grün'],['on','An · Akzent'],['off','Aus · grau'],['warn','Warnung · gelb'],['crit','Kritisch · rot'],['warm','Warm · orange']]},{k:'vid',h:'ID',ph:'ID'}])
        +'<div class="pgh">Je Zeile: hervorheben, Balken, Wertfarbe</div>'
        +listEditor(w,'items','Karte · Tönung · Wertfarbe · Balken(fest) · Balken(VarID) · Balkenfarbe',[{k:'karte',type:'select',h:'Karte',options:[['','nein'],['1','ja']]},{k:'bg',type:'skincolor',h:'Tönung'},{k:'valCol',type:'skincolor',h:'Wertfarbe'},{k:'prog',h:'Balken %',ph:'0–100'},{k:'progVid',h:'Balken-ID',ph:'VarID'},{k:'progCol',type:'skincolor',h:'Balkenfarbe'}])
        +'<div class="pgh">Je Zeile: Aktion</div>'
        +'<div class="hint" style="font-size:11px;margin:0 2px 8px">Mit Knopf-Icon führt der <b>Knopf</b> die Aktion aus, ohne Icon die <b>ganze Zeile</b>. Die Variable geht über RequestAction, wenn sie eine Aktion hat — es wird also wirklich geschaltet. Wert leer = umschalten (an/aus).</div>'
        +listEditor(w,'items','Knopf-Icon · Knopf-Farbe · VarID · Wert · Skript-ID · Popup · Hinweis',[{k:'btn',type:'icon',h:'Knopf',ph:'Knopf-Icon'},{k:'btnCol',type:'skincolor',h:'Knopf-Farbe'},{k:'actVid',h:'VarID',ph:'ID'},{k:'actVal',h:'Wert',ph:'leer = um'},{k:'actScript',h:'Skript',ph:'ID'},{k:'actTo',h:'Popup',ph:'Popup'},{k:'btnTitle',h:'Hinweis',ph:'Hinweis'}])
        +'<div class="pgh">Je Zeile: zweiter Knopf (Gegenrichtung)</div>'
        +'<div class="hint" style="font-size:11px;margin:0 2px 8px">Für Dinge mit zwei Richtungen — Tor auf/zu, Licht an/aus. Leere Felder erben vom ersten Knopf; beim Tor genügt also der zweite <b>Wert</b>.</div>'
        +listEditor(w,'items','Knopf-Icon · Farbe · VarID · Wert · Skript · Popup · Hinweis',[{k:'btn2',type:'icon',h:'Knopf 2',ph:'Icon'},{k:'btn2Col',type:'skincolor',h:'Farbe'},{k:'act2Vid',h:'VarID',ph:'wie oben'},{k:'act2Val',h:'Wert',ph:'Wert'},{k:'act2Script',h:'Skript',ph:'ID'},{k:'act2To',h:'Popup',ph:'Popup'},{k:'btn2Title',h:'Hinweis',ph:'Hinweis'}])
      :'');},
    wire:function(w){
      if($('#pIlBare'))$('#pIlBare').onchange=function(){w.ilBare=this.checked||undefined;render();commit();};
      if($('#pIlTpl'))$('#pIlTpl').onchange=function(){w.ilTpl=this.value||undefined;commit();};
      if($('#pIlTplGo'))$('#pIlTplGo').onclick=function(){_ilVorlage(w,(($('#pIlTpl')||{}).value)||'');render();renderProps();commit();};
      if($('#pIlHead'))$('#pIlHead').onchange=function(){w.ilHead=this.checked||undefined;render();renderProps();commit();};
      if($('#pIlFoot'))$('#pIlFoot').onchange=function(){w.ilFoot=this.checked||undefined;render();renderProps();commit();};
      if($('#pIlhIcon'))$('#pIlhIcon').onclick=function(){_iconPick={wid:w.id,field:'ilhIcon'};showTab('icons');toast('Icon der Kopfzeile wählen');};
      if($('#pIlfIcon'))$('#pIlfIcon').onclick=function(){_iconPick={wid:w.id,field:'ilfIcon'};showTab('icons');toast('Icon der Fußzeile wählen');};
      if($('#pIlhBadgeMin'))$('#pIlhBadgeMin').oninput=function(){var v=parseFloat(this.value);w.ilhBadgeMin=isNaN(v)?undefined:v;render();commit();};
      [['pIlhColor','ilhColor'],['pIlhSubCol','ilhSubCol'],['pIlhBadgeCol','ilhBadgeCol']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.onchange=function(){w[p[1]]=this.value||undefined;render();commit();};});
      [['pIlhTitle','ilhTitle'],['pIlhSub','ilhSub'],['pIlhBadge','ilhBadge'],['pIlfText','ilfText']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.oninput=function(){w[p[1]]=this.value||undefined;render();commit();};});
      [['pIlhSubVid','ilhSubVid'],['pIlhBadgeVid','ilhBadgeVid'],['pIlfVid','ilfVid']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.onchange=function(){w[p[1]]=parseInt(this.value)||undefined;render();commit();};});
      [['pIlhTo','ilhTo'],['pIlfTo','ilfTo']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.onchange=function(){w[p[1]]=this.value||undefined;render();commit();};});
    }
  });
