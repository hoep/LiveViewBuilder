  // ===== Widget: Wertkarte (valuecard) — generische Karte =====
  //  Slots: Icon/Titel (oben-links) · Badge ODER Toggle (oben-rechts) · Großwert+Einheit
  //         · Caption (=Label) · Fortschrittsbalken + Balken-Text · Akzent-Zustand (ganze Kachel)
  //  Variablen:  varId = Wert · varId2 = Toggle (oder Akzent, wenn v2acc) · varId3 = Balken
  //  Deckt KPI-Kacheln, Filterzeit (Balken+Akzent) und Dosier-Karten (Toggle+Balken) mit EINEM Widget ab.
  // Farbe nach Zustand: Status-Variable (varId2) bevorzugt, sonst Hauptwert; true/false wird zu 1/0 normalisiert
  function _vcNorm(x){var s=String(x==null?'':x).toLowerCase().trim();if(s==='true'||s==='on')return '1';if(s==='false'||s==='off')return '0';return s;}
  function _vcState(w,el){
    if(!(w.vassoc&&w.vassoc.length))return;
    var srcs=[w.varId2,w.varId],m=null,i,j;
    for(i=0;i<srcs.length&&!m;i++){if(!srcs[i]||!_lastVals[srcs[i]])continue;m=stateHit(w.vassoc,_lastVals[srcs[i]].v);}   // zentraler Vergleicher statt nur Gleichheit
    var v=$('[data-role=val]',el),c=(m&&m.color)?(_skinColor(m.color)||m.color):'';
    if(w.vaFill){el.classList.remove('vc-acc'); // übernimmt die Kachelfarbe (statt v2acc)
      if(c){el.style.background='color-mix(in oklab,'+c+' 16%,var(--surface))';el.style.borderColor='color-mix(in oklab,'+c+' 45%,var(--line))';if(v)v.style.color='color-mix(in oklab,'+c+' 85%,var(--text))';}
      else{el.style.background=w.bg||'';el.style.borderColor='';if(v)v.style.color='';}
    }else if(v)v.style.color=c;
  }
  defWidget('valuecard',{
    label:'Wertkarte', paletteIcon:'wkpi', size:[240,120],
    defaults:function(w){w.icon='home';w.label='Wert';w.unit='';w.badgeState='ok';},
    render:function(w){
      var icon=w.icon?'<span class="hkbi">'+iconSVG(w.icon)+'</span>':'';
      var title=w.title?'<span class="hvctitle">'+esc(w.title)+'</span>':'';
      var tr='';
      if(w.varId2&&!w.v2acc){
        var onC=w.swOn?_cssColorOrEmpty(w.swOn):'',offC=w.swOff?_cssColorOrEmpty(w.swOff):'';
        var sty=(onC?('--sw-on:'+onC+';'):'')+(offC?('--sw-off:'+offC+';'):'');
        var knob='<i class="swk">'+(w.swOffIcon?'<span class="swi swi-off">'+iconSVG(w.swOffIcon)+'</span>':'')+(w.swOnIcon?'<span class="swi swi-on">'+iconSVG(w.swOnIcon)+'</span>':'')+'</i>';
        tr='<span class="sw" data-role="sw"'+(sty?(' style="'+sty+'"'):'')+'>'+knob+'</span>';
      }else if(w.badge||w.okMin!=null||w.okMax!=null){
        var st=w.badgeState||'ok';
        if(st==='muted')tr='<span class="hvcmuted" data-role="badge">'+esc(w.badge||'')+'</span>';
        else tr='<span class="hpill '+esc(st)+'" data-role="badge"><span class="hpd"></span>'+esc(w.badge||'')+'</span>';
      }
      var val='<div class="hvcval"><span data-role="val">–</span>'+(w.unit?'<small> '+esc(w.unit)+'</small>':'')+'</div>';
      var cap=w.label?'<div class="hvccap">'+esc(w.label)+'</div>':'';
      var bar=w.barOn?('<div class="hvcbar"><div class="btrack"><i data-role="bar"></i></div>'+((w.barCap!=null&&w.barCap!=='')?'<div class="hvcbarcap" data-role="barcap">'+esc(w.barCap)+'</div>':'')+'</div>'):'';
      return '<div class="hvcard" data-role="card"><div class="hvctop"><div class="hvctl">'+icon+title+'</div>'+tr+'</div>'+val+cap+bar+'</div>';
    },
    props:function(w){if(w.type!=='valuecard')return '';
      return row('Titel (oben-links)','<input id="pVcTitle" value="'+esc(w.title||'')+'" placeholder="statt/neben Icon">')
        +row('Einheit','<input id="pVcUnit" value="'+esc(w.unit||'')+'" style="width:100px">')
        +'<div class="pgh">Badge (oben-rechts)</div>'
        +row('Text','<input id="pVcBadge" value="'+esc(w.badge||'')+'" placeholder="OPTIMAL / LÄUFT / Soll 27,0">')
        +row('Zustand','<select id="pVcBst">'
          +'<option value="muted"'+(w.badgeState==='muted'?' selected':'')+'>grau (nur Text)</option>'
          +'<option value="ok"'+((w.badgeState||'ok')==='ok'?' selected':'')+'>OK (grün)</option>'
          +'<option value="warm"'+(w.badgeState==='warm'?' selected':'')+'>Aktiv (orange)</option>'
          +'<option value="warn"'+(w.badgeState==='warn'?' selected':'')+'>Warnung (gelb)</option>'
          +'<option value="crit"'+(w.badgeState==='crit'?' selected':'')+'>Kritisch (rot)</option>'
          +'<option value="on"'+(w.badgeState==='on'?' selected':'')+'>Akzent</option></select>')
        +row('Auto aus Zielbereich','<input id="pVcOkMin" type="number" step="0.1" style="width:74px" value="'+(w.okMin!=null?w.okMin:'')+'" placeholder="min"> <input id="pVcOkMax" type="number" step="0.1" style="width:74px" value="'+(w.okMax!=null?w.okMax:'')+'" placeholder="max">')
        +(w.okMin!=null||w.okMax!=null?row('Badge im/außer Bereich','<input id="pVcOkT" value="'+esc(w.okText||'OPTIMAL')+'" style="width:90px"> <input id="pVcBadT" value="'+esc(w.badText||'PRÜFEN')+'" style="width:90px">'):'')
        +'<div class="pgh">Toggle / Akzent (varId2)</div>'
        +row('varId2 = Akzent','<input type="checkbox" id="pVcV2acc"'+(w.v2acc?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Kachel leuchtet auf (statt Toggle)</span>')
        +((w.varId2&&!w.v2acc)?(
          '<div class="pgh">Schalter-Farben</div>'
          +row('Ein-Farbe',skinSel(w.swOn||'','id="pVcSwOn"'))
          +row('Aus-Farbe',skinSel(w.swOff||'','id="pVcSwOff"'))
          +'<div class="pgh">Knopf-Icons (Ein/Aus)</div>'
          +row('Ein-Icon','<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.swOnIcon?iconSVG(w.swOnIcon):'')+'</span> <button class="btn" id="pVcSwOnIco" style="padding:5px 8px">wählen</button>'+(w.swOnIcon?' <button class="btn" id="pVcSwOnIcoX" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''))
          +row('Aus-Icon','<span style="width:18px;height:18px;display:inline-flex;align-items:center;color:var(--accent)">'+(w.swOffIcon?iconSVG(w.swOffIcon):'')+'</span> <button class="btn" id="pVcSwOffIco" style="padding:5px 8px">wählen</button>'+(w.swOffIcon?' <button class="btn" id="pVcSwOffIcoX" style="padding:5px 8px" title="entfernen"><svg class="i"><use href="#ic-minus"/></svg></button>':''))
        ):'')
        +'<div class="pgh">Farbe nach Zustand</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Quelle: <b>varId2</b> (Toggle/Status), sonst Hauptwert. true/false = 1/0. Farbe: #hex oder accent/ok/warn/crit/info.'+(w.vaFill&&w.v2acc?' <span style="color:var(--warm)">— „varId2 = Akzent" oben deaktivieren, sonst überlagern sich beide!</span>':'')+'</div>'
        +listEditor(w,'vassoc','Zustand · Farbe',[{k:'v',ph:'z. B. 1 / true'},{k:'color',type:'skin'}])
        +row('Ganze Kachel einfärben','<input type="checkbox" id="pVcVaFill"'+(w.vaFill?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">statt nur des Werts</span>')
        +'<div class="pgh">Fortschrittsbalken (unten)</div>'
        +row('Balken zeigen','<input type="checkbox" id="pVcBarOn"'+(w.barOn?' checked':'')+'>')
        +(w.barOn?('<div style="font-size:11px;color:var(--muted);margin:-2px 2px 4px">Balken-Quelle = <b>„Balken-Var"</b> (oben im Variablen-Bereich); ohne diese wird der Hauptwert genommen.'+(w.varId3?'':' <span style="color:var(--warm)">— aktuell keine Balken-Var gesetzt.</span>')+'</div>'
          +row('Balken min/max','<input id="pVcBarMin" type="number" style="width:74px" value="'+(w.barMin!=null?w.barMin:0)+'"> <input id="pVcBarMax" type="number" style="width:74px" value="'+(w.barMax!=null?w.barMax:100)+'"> <span style="font-size:11px;color:var(--muted)">Bereich der Balken-Var</span>')
          +row('Text rechts','<input id="pVcBarCap" value="'+esc(w.barCap||'')+'" placeholder="z. B. 81 % Kanister">')):'');
    },
    wire:function(w){
      function bind(id,prop,num){var e=$('#'+id);if(!e)return;e.oninput=e.onchange=function(){var v=num?(this.value===''?undefined:parseFloat(this.value)):(this.value||undefined);w[prop]=v;render();};}
      bind('pVcTitle','title');bind('pVcUnit','unit');bind('pVcBadge','badge');bind('pVcBarCap','barCap');
      bind('pVcOkT','okText');bind('pVcBadT','badText');
      bind('pVcOkMin','okMin',1);bind('pVcOkMax','okMax',1);bind('pVcBarMin','barMin',1);bind('pVcBarMax','barMax',1);
      if($('#pVcBst'))$('#pVcBst').onchange=function(){w.badgeState=this.value;render();};
      if($('#pVcV2acc'))$('#pVcV2acc').onchange=function(){w.v2acc=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcSwOn'))$('#pVcSwOn').onchange=function(){w.swOn=this.value||undefined;render();renderProps();commit();};
      if($('#pVcSwOff'))$('#pVcSwOff').onchange=function(){w.swOff=this.value||undefined;render();renderProps();commit();};
      if($('#pVcSwOnIco'))$('#pVcSwOnIco').onclick=function(){_iconPick={wid:w.id,field:'swOnIcon'};showTab('icons');toast('Ein-Icon links wählen');};
      if($('#pVcSwOnIcoX'))$('#pVcSwOnIcoX').onclick=function(){delete w.swOnIcon;render();renderProps();commit();};
      if($('#pVcSwOffIco'))$('#pVcSwOffIco').onclick=function(){_iconPick={wid:w.id,field:'swOffIcon'};showTab('icons');toast('Aus-Icon links wählen');};
      if($('#pVcSwOffIcoX'))$('#pVcSwOffIcoX').onclick=function(){delete w.swOffIcon;render();renderProps();commit();};
      if($('#pVcVaFill'))$('#pVcVaFill').onchange=function(){w.vaFill=this.checked||undefined;render();if(w.varId&&_lastVals[w.varId])applyVal(w.varId,_lastVals[w.varId]);commit();};
      if($('#pVcBarOn'))$('#pVcBarOn').onchange=function(){w.barOn=this.checked||undefined;render();renderProps();commit();};
      if($('#pVcOkMin')||$('#pVcOkMax')){/* Badge-Bereich Toggle -> Panel neu, damit Texte-Zeile erscheint */
        ['#pVcOkMin','#pVcOkMax'].forEach(function(s){if($(s))$(s).addEventListener('change',function(){renderProps();});});}
    },
    click:function(w,el,e){
      if(w.varId2&&!w.v2acc){var sw=$('[data-role=sw]',el);if(sw){var on=!sw.classList.contains('on');sw.classList.toggle('on',on);setVar(w.varId2,on?1:0);}return true;}
      return false;
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId===id){
        var v=$('[data-role=val]',el);if(v)v.textContent=txt;
        if(w.okMin!=null||w.okMax!=null){var nv=parseFloat(String(d.v).replace(',','.'));var bd=$('[data-role=badge]',el);if(bd&&!isNaN(nv)){var okv=(w.okMin==null||nv>=w.okMin)&&(w.okMax==null||nv<=w.okMax);bd.className='hpill '+(okv?'ok':'warn');bd.innerHTML='<span class="hpd"></span>'+esc(okv?(w.okText||'OPTIMAL'):(w.badText||'PRÜFEN'));}}
        if(w.barOn&&!w.varId3){var mn=(w.barMin!=null?w.barMin:0),mx=(w.barMax!=null?w.barMax:100),nb=parseFloat(String(d.v).replace(',','.')),bar=$('[data-role=bar]',el);if(bar&&!isNaN(nb))bar.style.width=Math.max(0,Math.min(100,((nb-mn)/((mx-mn)||1))*100))+'%';}
      }
      if(w.varId2===id){
        if(w.v2acc){el.classList.toggle('vc-acc',on);}
        else{var sw=$('[data-role=sw]',el);if(sw)sw.classList.toggle('on',on);}
      }
      if(w.varId3===id&&w.barOn){var mn3=(w.barMin!=null?w.barMin:0),mx3=(w.barMax!=null?w.barMax:100),nb3=parseFloat(String(d.v).replace(',','.')),bar3=$('[data-role=bar]',el);if(bar3&&!isNaN(nb3))bar3.style.width=Math.max(0,Math.min(100,((nb3-mn3)/((mx3-mn3)||1))*100))+'%';}
      _vcState(w,el); // Farbe nach Zustand (liest _lastVals; unabhängig davon, welche ID das Update auslöste)
      return true;
    }
  });
