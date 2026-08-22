  // ===== Widget: Icon-Raster (iconarray) =====
  //
  // Viele gleichartige Dinge auf einen Blick: 24 Fenster, 12 Ventile, 8 Lampen.
  // Je Wert ein Feld, je Zustand ein Icon und eine Farbe - und darunter eine
  // Legende, die zaehlt.
  //
  // Warum ein eigener Typ und nicht die Info-Liste: eine Liste stellt EINE Zeile
  // je Ding und wird bei zwanzig Dingen zur Rolle. Das Raster zeigt dieselbe
  // Menge in einem Blick; dafuer verzichtet es auf Namen und Werte je Zeile.
  //
  // Die Zustaende sind frei: Wert -> Icon, Farbe, Bezeichnung. Damit taugt es
  // fuer Boolean (0/1) genauso wie fuer Aufzaehlungen (0/1/2). Ein Zustand ist
  // der NORMALZUSTAND - er faerbt ruhig und zaehlt nicht in Kopfzeile und
  // Abzeichen mit. Sonst meldete ein Raster aus 24 geschlossenen Fenstern "24".
  var _IA_LEER={v:'',icon:'',color:'',label:'',norm:false,hi:false};
  /**
   * Welcher Zustand gilt fuer diesen Wert?
   *
   * Verglichen wird gegen den ROHWERT und gegen den formatierten Text. Der Text
   * ist oft die einzige gemeinsame Sprache: dieselben Fenster haengen hier an
   * zwei Profilen - "FensterTile" zaehlt 0/1/2 (zu/gekippt/offen), "Dachfenster"
   * kennt nur false/true. Eine 1 heisst dort "offen" und hier "gekippt". Ueber
   * "Geschlossen"/"Gekippt"/"Geoeffnet" trifft dagegen beides zu.
   */
  function _iaZustand(w,roh,txt){
    var st=(w.states&&w.states.length)?w.states:[];
    var s=String(roh===true?1:(roh===false?0:(roh==null?'':roh))).trim();
    var f=String(txt==null?'':txt).trim().toLowerCase();
    var fall=null,i,z,zv;
    for(i=0;i<st.length;i++){
      z=st[i];zv=String(z.v==null?'':z.v).trim();
      if(zv===''||zv==='*'){if(!fall)fall=z;continue;}
      // Zahlen vergleichen sich als Zahlen ("1" trifft 1.0), alles andere als Text.
      if(zv===s||(!isNaN(parseFloat(zv))&&!isNaN(parseFloat(s))&&parseFloat(zv)===parseFloat(s)))return z;
      if(f&&zv.toLowerCase()===f)return z;
    }
    return fall||_IA_LEER;
  }
  /** Zaehlt die Felder je Zustand. Eine Auskunft, die das Raster selbst geben kann - kein Skript noetig. */
  function _iaZaehl(w){
    var st=(w.states&&w.states.length)?w.states:[],n=[],i;
    for(i=0;i<st.length;i++)n.push(0);
    (w.items||[]).forEach(function(r){
      var d=(typeof _lastVals!=='undefined')?_lastVals[r.vid]:null;
      var z=_iaZustand(w,d?d.v:(r.probe!=null?r.probe:null),d?d.f:null);
      var ix=st.indexOf(z);if(ix>=0)n[ix]++;
    });
    return n;
  }
  function _iaFarbe(c,fb){var v=c?(_cssColorOrEmpty(c)||''):'';return v||(fb||'');}
  /** Untertitel: was NICHT normal ist, mit Anzahl. Ist alles normal, sagt sie das. */
  function _iaText(w){
    var st=(w.states&&w.states.length)?w.states:[],n=_iaZaehl(w),teile=[],normal='',i;
    for(i=0;i<st.length;i++){
      if(st[i].norm){if(!normal)normal=st[i].label||'';continue;}
      if(n[i]>0)teile.push(n[i]+' '+(st[i].label||''));
    }
    if(teile.length)return teile.join(' · ');
    return normal?('alle '+normal):'';
  }
  function _iaOffen(w){
    var st=(w.states&&w.states.length)?w.states:[],n=_iaZaehl(w),s=0,i;
    for(i=0;i<st.length;i++)if(!st[i].norm)s+=n[i];
    return s;
  }
  defWidget('iconarray',{
    label:'Icon-Raster', cat:'Anzeige', paletteIcon:'wgrid', size:[300,300],
    defaults:function(w){
      w.iaCols=6; w.iaHead=true; w.iaLeg=true;
      w.iahIcon='window'; w.iahColor='warn'; w.iahTitle='Fenster';
      w.states=[
        {v:'0',icon:'window',color:'ok',   label:'zu',      norm:'1'},
        {v:'1',icon:'wintilt',color:'warn',label:'gekippt'},
        {v:'2',icon:'winopen',color:'warn',label:'offen', hi:'1'}
      ];
      // Ohne Variablen: ein paar Felder zur Ansicht, damit die Kachel nicht leer wirkt.
      w.items=[];for(var i=0;i<24;i++)w.items.push({vid:0,label:'Feld '+(i+1),probe:(i===3?2:(i===9||i===15?1:0))});
    },
    render:function(w){
      var st=(w.states&&w.states.length)?w.states:[];
      // 0 heisst ausdruecklich "automatisch" - deshalb NICHT auf 1 anheben.
      var cols=parseInt(w.iaCols);
      if(isNaN(cols)||cols<0)cols=6;
      // Spaltenzahl fest ODER "so viele wie hineinpassen". Fuer den zweiten Fall
      // braucht die Rasterangabe eine echte Mindestbreite in px: eine
      // Container-Einheit an dieser Stelle macht die ganze Angabe ungueltig, und
      // dann faellt das Raster auf EINE Spalte zurueck.
      var mind=Math.max(16,parseInt(w.iaMin||0)||38);
      var gitter=(cols>0)?('repeat('+cols+',1fr)'):('repeat(auto-fit,minmax('+mind+'px,1fr))');
      var felder=(w.items||[]).map(function(r,i){
        var d=(typeof _lastVals!=='undefined')?_lastVals[r.vid]:null;
        var z=_iaZustand(w,d?d.v:(r.probe!=null?r.probe:null),d?d.f:null);
        var c=_iaFarbe(z.color,'var(--muted)');
        var hi=!!z.hi;
        return '<div class="iac'+(hi?' hi':'')+(r.to?' tap':'')+'" style="--c:'+c+'"'
          +(r.to?(' data-iac="'+i+'"'):'')
          +' title="'+esc((r.label||('Feld '+(i+1)))+(z.label?(' · '+z.label):''))+'">'
          +iconSVG(z.icon||r.icon||'grid')
          +(w.iaLabels?('<b>'+esc(r.label||'')+'</b>'):'')+'</div>';
      }).join('');
      // Kopf- und Fusszeile teilen sich die Klassen mit der Info-Liste: dieselbe
      // Gestalt, damit zwei Kacheln nebeneinander nicht wie zwei Programme wirken.
      var kopf='';
      if(w.iaHead){
        var hc=_iaFarbe(w.iahColor,'var(--accent)');
        var sub=(w.iahSub!=null&&w.iahSub!=='')?esc(w.iahSub):esc(_iaText(w));
        var off=_iaOffen(w),min=(w.iahBadgeMin!=null&&w.iahBadgeMin!=='')?parseFloat(w.iahBadgeMin):1;
        var zahl=(w.iahBadge!==false&&off>=min)?('<span class="ilbadge"'+(w.iahBadgeCol?(' style="background:'+_iaFarbe(w.iahBadgeCol,'')+'"'):'')+'>'+off+'</span>'):'';
        kopf='<div class="ilhead'+(w.iahTo?' tap':'')+'" data-iahead="1" style="--c:'+hc+'">'
          +'<span class="ilhi">'+iconSVG(w.iahIcon||'grid')+zahl+'</span>'
          +'<span class="ilht"><b>'+esc(w.iahTitle||'')+'</b>'
            +(sub?('<span'+(w.iahSubCol?(' style="color:'+_iaFarbe(w.iahSubCol,'')+'"'):'')+'>'+sub+'</span>'):'')+'</span>'
          +(w.iahTo?'<span class="ilchev">'+iconSVG('arrowright')+'</span>':'')+'</div>';
      }
      var fuss='';
      if(w.iaLeg&&st.length){
        var n=_iaZaehl(w);
        fuss='<div class="ialeg">'+st.map(function(z,i){
          if(w.iaLegAll===false&&!n[i]&&!z.norm)return '';
          return '<span class="iale" style="--c:'+_iaFarbe(z.color,'var(--muted)')+'">'
            +iconSVG(z.icon||'grid')+esc(z.label||'')+'<b>'+n[i]+'</b></span>';
        }).join('')+'</div>';
      }
      return '<div class="iaw">'+kopf+'<div class="iag" style="grid-template-columns:'+gitter+'">'+felder+'</div>'+fuss+'</div>';
    },
    // Ein Wert aendert sich -> die ganze Kachel neu zeichnen. Das ist hier billig
    // (Icons, kein Diagramm) und die einzige Art, Kopfzeile, Abzeichen und
    // Legende zuverlaessig mitzuziehen: sie haengen an ALLEN Werten, nicht an
    // einem.
    live:function(w,el){ if(el)el.innerHTML=WIDGETS.iconarray.render(w); },
    click:function(w,el,e){
      var c=e.target.closest('[data-iac]');
      if(c){var r=(w.items||[])[parseInt(c.getAttribute('data-iac'))||0];if(r&&r.to){openPopup(r.to);return true;}return true;}
      if(e.target.closest('[data-iahead]')&&w.iahTo){openPopup(w.iahTo);return true;}
      return false;
    },
    props:function(w){return (w.type==='iconarray'
      ?'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:0 2px 7px">Ein Feld je Variable, ein Icon je Zustand. Die Kachel zählt selbst — Untertitel, Abzeichen und Legende brauchen kein Skript.</div>'
        +row('Spalten','<input id="pIaCols" type="number" min="0" max="24" value="'+(w.iaCols!=null?w.iaCols:6)+'" style="width:60px"> '
            +'<input id="pIaMin" type="number" min="16" max="200" value="'+(w.iaMin||38)+'" style="width:60px" title="kleinste Feldbreite in px (nur bei 0)"> '
            +'<span style="font-size:11px;color:var(--muted)">0 = so viele wie hineinpassen, daneben die kleinste Feldbreite</span>')
        +row('Namen','<input type="checkbox" id="pIaLabels"'+(w.iaLabels?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">kurzer Text unter jedem Feld</span>')
        +'<div class="pgh">Kopfzeile</div>'
        +row('Kopfzeile','<input type="checkbox" id="pIaHead"'+(w.iaHead?' checked':'')+'>')
        +(w.iaHead?(
           row('Icon · Farbe','<button class="btn" id="pIahIcon" style="padding:3px 6px">'+(w.iahIcon?iconSVG(w.iahIcon):'+')+'</button> '+skinSel(String(w.iahColor||''),'id="pIahColor"'))
          +row('Titel','<input id="pIahTitle" value="'+esc(w.iahTitle||'')+'" placeholder="Fenster">')
          +row('Untertitel','<input id="pIahSub" value="'+esc(w.iahSub||'')+'" placeholder="leer = zählt selbst" style="width:150px"> '+skinSel(String(w.iahSubCol||''),'id="pIahSubCol" title="Farbe"'))
          +row('Abzeichen','<input type="checkbox" id="pIahBadge"'+(w.iahBadge!==false?' checked':'')+'> '
              +skinSel(String(w.iahBadgeCol||''),'id="pIahBadgeCol" title="Farbe"')+' '
              +'<input id="pIahBadgeMin" type="number" value="'+(w.iahBadgeMin!=null?w.iahBadgeMin:1)+'" style="width:52px" title="erst ab dieser Zahl"> '
              +'<span style="font-size:11px;color:var(--muted)">zählt alles, was nicht Normalzustand ist</span>')
          +row('Öffnet','<select id="pIahTo">'+viewOpts(w.iahTo,'popup','— nichts —')+'</select>')
         ):'')
        +'<div class="pgh">Legende</div>'
        +row('Legende','<input type="checkbox" id="pIaLeg"'+(w.iaLeg?' checked':'')+'> '
            +'<label style="font-size:11px;color:var(--muted)"><input type="checkbox" id="pIaLegAll"'+(w.iaLegAll!==false?' checked':'')+'> auch Zustände mit 0</label>')
        +'<div class="pgh">Zustände (Wert · Icon · Farbe · Bezeichnung)</div>'
        +'<div class="hint" style="font-size:11px;margin:0 2px 8px">Wert leer oder <code>*</code> = gilt für alles Übrige. Verglichen wird gegen den Rohwert <i>und</i> gegen den angezeigten Text — bei gemischten Profilen (0/1/2 neben true/false) trifft nur der Text beides. <b>Normal</b> markiert den Ruhezustand: er zählt nicht in Untertitel und Abzeichen. <b>Hervorheben</b> hinterlegt das Feld in seiner Farbe.</div>'
        +listEditor(w,'states','Wert · Icon · Farbe · Bezeichnung · Normal · Hervorheben',[{k:'v',h:'Wert',ph:'0 oder Text'},{k:'icon',type:'icon',h:'Icon'},{k:'color',type:'skincolor',h:'Farbe'},{k:'label',h:'Bezeichnung',ph:'zu'},{k:'norm',type:'select',h:'Normal',options:[['','—'],['1','ja']]},{k:'hi',type:'select',h:'Hervorheben',options:[['','—'],['1','ja']]}])
        +'<div class="pgh">Felder</div>'
        +listEditor(w,'items','Variable · Name · Popup',[{k:'vid',h:'VarID',ph:'ID'},{k:'label',h:'Name',ph:'Name'},{k:'to',h:'Popup',ph:'Popup'}])
      :'');},
    wire:function(w){
      function chk(id,k,inv){var e=$(id);if(e)e.onchange=function(){w[k]=inv?(this.checked?undefined:false):(this.checked||undefined);render();renderProps();commit();};}
      if($('#pIaMin'))$('#pIaMin').oninput=function(){var v=parseInt(this.value);w.iaMin=isNaN(v)?undefined:v;render();commit();};
      if($('#pIaCols'))$('#pIaCols').oninput=function(){w.iaCols=parseInt(this.value);if(isNaN(w.iaCols))w.iaCols=undefined;render();commit();};
      chk('#pIaLabels','iaLabels');chk('#pIaHead','iaHead');chk('#pIaLeg','iaLeg');
      if($('#pIaLegAll'))$('#pIaLegAll').onchange=function(){w.iaLegAll=this.checked?undefined:false;render();commit();};
      if($('#pIahBadge'))$('#pIahBadge').onchange=function(){w.iahBadge=this.checked?undefined:false;render();commit();};
      if($('#pIahIcon'))$('#pIahIcon').onclick=function(){_iconPick={wid:w.id,field:'iahIcon'};showTab('icons');toast('Icon der Kopfzeile wählen');};
      [['pIahColor','iahColor'],['pIahSubCol','iahSubCol'],['pIahBadgeCol','iahBadgeCol'],['pIahTo','iahTo']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.onchange=function(){w[p[1]]=this.value||undefined;render();commit();};});
      [['pIahTitle','iahTitle'],['pIahSub','iahSub']].forEach(function(p){
        var e=$('#'+p[0]);if(e)e.oninput=function(){w[p[1]]=this.value||undefined;render();commit();};});
      if($('#pIahBadgeMin'))$('#pIahBadgeMin').oninput=function(){var v=parseFloat(this.value);w.iahBadgeMin=isNaN(v)?undefined:v;render();commit();};
    }
  });
