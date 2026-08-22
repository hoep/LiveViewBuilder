  // ===== Widget: Info-Liste =====
  //
  // Zwei Bauformen, die sich frei mischen lassen:
  //
  //   Zeilen "schlicht" - wie seit jeher: Icon, Name (+Zusatz), rechts Wert ODER Pill.
  //   Zeilen "Karte"    - jede Zeile in eigener Toenung, dazu rechts ein Aktionsknopf.
  //
  // Darueber optional eine KOPFZEILE: grosses Icon mit Zaehler-Abzeichen, Titel,
  // Untertitel, Chevron. Sie gilt fuer beide Zeilenformen - eine Ueberschrift ist
  // keine Frage der Zeilenform.
  //
  // Warum Zaehler und Untertitel eine Variable annehmen, Titel aber nicht: der
  // Titel benennt die Liste ("Anrufe"), der Rest zaehlt sie. Was sich aendert,
  // gehoert an eine Variable; was gleich bleibt, waere dort nur Verwaltung.
  function _ilFarbe(c,fb){var v=c?(_cssColorOrEmpty(c)||''):'';return v||(fb||'');}
  /** Kopfzeile: Icon + Abzeichen, Titel, Untertitel, Chevron. */
  function _ilKopf(w){
    if(!w.ilHead)return '';
    var c=_ilFarbe(w.ilhColor,'var(--accent)');
    var zahl=(w.ilhBadgeVid?'<span class="ilbadge" data-vid="'+w.ilhBadgeVid+'"'+_slotAttrs({dec:0})+'>–</span>'
             :(w.ilhBadge?'<span class="ilbadge">'+esc(w.ilhBadge)+'</span>':''));
    var sub=(w.ilhSubVid?'<span data-vid="'+w.ilhSubVid+'"'+_slotAttrs(w.ilhSubUnit?{unit:w.ilhSubUnit}:{})+'>–</span>'
            :(w.ilhSub?esc(w.ilhSub):''));
    return '<div class="ilhead'+(w.ilhTo?' tap':'')+'" data-ilhead="1" style="--c:'+c+'">'
      +'<span class="ilhi">'+iconSVG(w.ilhIcon||'info')+zahl+'</span>'
      +'<span class="ilht"><b>'+esc(w.ilhTitle||'')+'</b>'+(sub?('<span>'+sub+'</span>'):'')+'</span>'
      +(w.ilhTo?'<span class="ilchev">'+iconSVG('arrowright')+'</span>':'')+'</div>';
  }
  /** Aktionsknopf einer Kartenzeile. Ohne Icon kein Knopf - ein leerer Kasten waere ein Versprechen ohne Inhalt. */
  function _ilKnopf(r,i){
    if(!r.btn)return '';
    var b=_ilFarbe(r.btnCol,'var(--accent)');
    return '<button class="hibtn" data-ilb="'+i+'" style="--b:'+b+'"'+(r.btnTitle?(' title="'+esc(r.btnTitle)+'"'):'')+'>'+iconSVG(r.btn)+'</button>';
  }
  defWidget('infolist',{
    label:'Info-Liste', cat:'Anzeige', paletteIcon:'wlist', size:[260,180],
    defaults:function(w){w.items=[{icon:'washer',label:'Waschmaschine',sub:'Restzeit 0:42',pill:'läuft',state:'on'},{icon:'dryer',label:'Trockner',sub:'bereit',pill:'aus',state:'off'},{icon:'car',label:'BMW',sub:'Reichweite 213 km',value:'64 %'}];},
    render:function(w){
      var karte=(w.ilRow==='karte');
      // Mit Kopfzeile braucht es eine Huelle: sonst nimmt die Liste die volle
      // Hoehe (height:100%) und die Ueberschrift schiebt sie unten hinaus.
      var kopf=_ilKopf(w);
      return (kopf?'<div class="hilhead">':'')+kopf+'<div class="hinfos'+(karte?' karten':'')+'">'+(w.items||[]).map(function(r,i){
        var rt=r.pill?'<span class="hpill '+esc(r.state||'ok')+'"><span class="hpd"></span>'+esc(r.pill)+'</span>'
                     :'<span class="hiv"'+(r.vid?' data-vid="'+r.vid+'"'+_slotAttrs(r):'')+'>'+esc(r.value||'')+'</span>';
        var _ic=r.color?(_cssColorOrEmpty(r.color)||''):'';
        // In der Kartenform traegt die Zeile die Toenung: eigene Kartenfarbe, sonst
        // die Farbe des Icons. Ohne beides bleibt sie neutral - eine Karte ohne
        // Aussage soll nicht bunt sein.
        var kc=karte?_ilFarbe(r.bg,_ic||''):'';
        return '<div class="hinfo'+(karte?' hicard':'')+'"'+(kc?' style="--c:'+kc+'"':'')+'>'
          +'<span class="hibi"'+(_ic?' style="color:'+_ic+';background:color-mix(in oklab,'+_ic+' 14%,var(--surface-2))"':'')+'>'+iconSVG(r.icon||'sensor')+'</span>'
          +'<span class="hin">'+esc(r.label||'')+(r.sub?'<small>'+esc(r.sub)+'</small>':'')+'</span>'
          +rt+(karte?_ilKnopf(r,i):'')+'</div>';
      }).join('')+'</div>'+(kopf?'</div>':'');
    },
    // Kopfzeile und Knoepfe fangen den Klick ab, damit sie nicht als Klick auf die
    // ganze Kachel gelten. Alles andere geht weiter wie bisher.
    click:function(w,el,e){
      var b=e.target.closest('[data-ilb]');
      if(b){
        var r=(w.items||[])[parseInt(b.getAttribute('data-ilb'))||0];
        if(!r)return true;
        if(r.btnTo){openPopup(r.btnTo);return true;}
        if(r.btnVid){setVar(r.btnVid,(r.btnVal!=null&&r.btnVal!=='')?r.btnVal:true);toast(r.label||'gesendet');}
        return true;
      }
      if(e.target.closest('[data-ilhead]')&&w.ilhTo){openPopup(w.ilhTo);return true;}
      return false;
    },
    props:function(w){return (w.type==='infolist'
      ?'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Je Zeile: Icon, Name (+Zusatz), rechts entweder ein <b>Wert</b> oder eine <b>Pill</b>. „Status" färbt nur die Pill ein (ohne Pill-Text hat er keine Wirkung).</div>'
        +row('Zeilenform','<select id="pIlRow"><option value=""'+(w.ilRow!=='karte'?' selected':'')+'>schlicht</option><option value="karte"'+(w.ilRow==='karte'?' selected':'')+'>Karte (getönt, mit Knopf)</option></select>')
        +'<div class="pgh">Kopfzeile</div>'
        +row('Kopfzeile','<input type="checkbox" id="pIlHead"'+(w.ilHead?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Icon mit Zähler, Titel, Untertitel</span>')
        +(w.ilHead?(
           row('Icon · Farbe','<button class="btn" id="pIlhIcon" title="Icon wählen" style="padding:3px 6px">'+(w.ilhIcon?iconSVG(w.ilhIcon):'+')+'</button> '+skinSel(String(w.ilhColor||''),'id="pIlhColor"'))
          +row('Titel','<input id="pIlhTitle" value="'+esc(w.ilhTitle||'')+'" placeholder="4 Anrufe offen">')
          +row('Untertitel','<input id="pIlhSub" value="'+esc(w.ilhSub||'')+'" placeholder="fester Text" style="width:120px"> '
              +'<input id="pIlhSubVid" value="'+(w.ilhSubVid||'')+'" placeholder="oder VarID" style="width:74px">')
          +row('Zähler','<input id="pIlhBadge" value="'+esc(w.ilhBadge||'')+'" placeholder="fest" style="width:60px"> '
              +'<input id="pIlhBadgeVid" value="'+(w.ilhBadgeVid||'')+'" placeholder="oder VarID" style="width:74px"> '
              +'<span style="font-size:11px;color:var(--muted)">leer = kein Abzeichen</span>')
          +row('Öffnet','<select id="pIlhTo">'+viewOpts(w.ilhTo,'popup','— nichts —')+'</select> <span style="font-size:11px;color:var(--muted)">zeigt dann auch den Pfeil</span>')
         ):'')
        +listEditor(w,'items','Zeile: Icon · Farbe · Name · Zusatz · Wert · Pill · Status(Pill-Farbe) · VarID',[{k:'icon',type:'icon',h:'Icon',ph:'Icon wählen'},{k:'color',type:'skincolor',h:'Farbe (Icon)'},{k:'label',h:'Name',ph:'Name'},{k:'sub',h:'Zusatz',ph:'Zusatz'},{k:'value',h:'Wert',ph:'Wert'},{k:'dec',h:'Dez',ph:'Dez'},{k:'unit',h:'Einh',ph:'Einh'},{k:'pill',h:'Pill',ph:'Pill'},{k:'state',type:'select',def:'ok',h:'Status (Pill)',ph:'Status',options:[['ok','OK · grün'],['on','An · Akzent'],['off','Aus · grau'],['warn','Warnung · gelb'],['crit','Kritisch · rot'],['warm','Warm · orange']]},{k:'vid',h:'ID',ph:'ID'}])
        +(w.ilRow==='karte'
          ?'<div class="pgh">Karte: Tönung und Knopf je Zeile</div>'
           +'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Tönung leer = Farbe des Icons. Ohne Knopf-Icon erscheint kein Knopf. Der Knopf öffnet ein Popup <i>oder</i> schreibt einen Wert in eine Variable (leer = true).</div>'
           +listEditor(w,'items','Zeile: Tönung · Knopf-Icon · Knopf-Farbe · Popup · VarID · Wert · Hinweis',[{k:'bg',type:'skincolor',h:'Tönung'},{k:'btn',type:'icon',h:'Knopf',ph:'Knopf-Icon'},{k:'btnCol',type:'skincolor',h:'Knopf-Farbe'},{k:'btnTo',h:'Popup',ph:'Popup-Name'},{k:'btnVid',h:'VarID',ph:'ID'},{k:'btnVal',h:'Wert',ph:'true'},{k:'btnTitle',h:'Hinweis',ph:'Hinweis'}])
          :'')
      :'');},
    wire:function(w){
      if($('#pIlRow'))$('#pIlRow').onchange=function(){w.ilRow=this.value||undefined;render();renderProps();commit();};
      if($('#pIlHead'))$('#pIlHead').onchange=function(){w.ilHead=this.checked||undefined;render();renderProps();commit();};
      if($('#pIlhIcon'))$('#pIlhIcon').onclick=function(){_iconPick={wid:w.id,field:'ilhIcon'};showTab('icons');toast('Icon der Kopfzeile wählen');};
      if($('#pIlhColor'))$('#pIlhColor').onchange=function(){w.ilhColor=this.value||undefined;render();commit();};
      [['pIlhTitle','ilhTitle'],['pIlhSub','ilhSub'],['pIlhBadge','ilhBadge']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.oninput=function(){w[p[1]]=this.value||undefined;render();commit();};});
      [['pIlhSubVid','ilhSubVid'],['pIlhBadgeVid','ilhBadgeVid']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.onchange=function(){w[p[1]]=parseInt(this.value)||undefined;render();commit();};});
      if($('#pIlhTo'))$('#pIlhTo').onchange=function(){w.ilhTo=this.value||undefined;render();commit();};
    }
  });
