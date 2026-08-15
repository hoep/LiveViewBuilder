  // ===== Widget: Licht (Light) — Name, Untertitel, Helligkeit in Prozent und Balken =====
  //
  // Zweite Variable = Helligkeit (0-100). Der senkrechte Balken erscheint NUR, wenn sie
  // gesetzt ist - ohne Helligkeit gibt es nichts zu fuellen und die Kachel bleibt schlicht.
  //
  // Klick auf die Kachel:
  //   mit Statusvariable  -> schaltet diese um (ein/aus), wie bisher
  //   ohne Statusvariable -> setzt die Helligkeit auf 100 %, und wenn sie schon bei 100 %
  //                          steht, zurueck auf 0 %. So laesst sich eine reine Dimmer-Kachel
  //                          bedienen, ohne dass ein zweiter Schaltkanal noetig waere.
  function _lgNum(id){var d=id&&_lastVals[id];if(!d)return null;
    var n=parseFloat(String(d.v).replace(',','.'));return isNaN(n)?null:n;}
  function _lgOn(w){                                   // "ein" aus Status ODER Helligkeit
    if(w.varId){var d=_lastVals[w.varId];if(d)return (d.v===true||d.v===1||d.v==='1'||d.v==='true');}
    var n=_lgNum(w.varId2);return n!=null&&n>0;
  }
  // Fuellwert fuers Icon: adaptive Icons (bulb, ceilinglamp, spot ...) zeichnen damit ihre
  // Helligkeit. Ohne Wert wuerde iconSVG() 100 % annehmen und die Lampe immer voll leuchten.
  function _lgLevel(w){
    if(w.varId2){var n=_lgNum(w.varId2);return n==null?0:Math.max(0,Math.min(100,n));}
    return _lgOn(w)?100:0;                              // ohne Dimmer: nur an/aus
  }
  function _lgSince(w){                                // "seit HH:MM" der massgeblichen Variable
    var id=w.varId||w.varId2,t=(typeof changedAt==='function')?changedAt(id):0;
    if(!t)return '';
    var d=new Date(t),p=function(n){return ('0'+n).slice(-2);};
    return 'seit '+p(d.getHours())+':'+p(d.getMinutes());
  }
  function _lgPaint(w,root){
    var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;
    var n=_lgNum(w.varId2),on=_lgOn(w);
    var box=$('.hl2',el);if(box)box.classList.toggle('on',on);
    // An den Enden sagt eine Zahl nichts: 0 % ist schlicht "Aus", 100 % ist "Ein".
    // Entschieden wird am GERUNDETEN Wert, damit Anzeige und Text nicht auseinanderlaufen
    // (99,6 % wuerde sonst als "100 %" erscheinen, aber nicht als "Ein" gelten).
    var v=$('[data-role=val]',el),u=$('[data-role=unit]',el),txt,unit='';
    if(!w.varId2){txt=on?'Ein':'Aus';}
    else if(n==null){txt='–';}
    else{
      var r=Math.round(n);
      if(r<=0)txt='Aus';
      else if(r>=100)txt='Ein';
      else{txt=r;unit='%';}
    }
    if(v)v.textContent=txt;
    if(u)u.textContent=unit;
    var ic=$('.hl2ic',el);
    if(ic)ic.innerHTML=iconSVG(w.icon||'bulb',_lgLevel(w));   // Icon folgt der Helligkeit
    var pct=Math.max(0,Math.min(100,(n==null?0:n)));
    var f=$('[data-role=lfill]',el);
    if(f)f.style.height=pct+'%';
    // Reglerstellung mitfuehren - sonst stuende er beim Anfassen auf 0 und die Helligkeit
    // spraenge. Waehrend des Ziehens NICHT ueberschreiben, sonst kaempft die Anzeige
    // gegen die Hand des Benutzers.
    var rg=$('[data-role=range]',el);
    if(rg&&document.activeElement!==rg){rg.value=pct;rg.setAttribute('value',pct);}
    var st=$('[data-role=state]',el);
    if(st){
      var parts=[];
      if(w.showState!==false)parts.push(on?'Ein':'Aus');
      if(w.showSince!==false){var s=_lgSince(w);if(s)parts.push(s);}
      st.textContent=parts.join(' · ');
      st.style.display=parts.length?'':'none';
    }
  }
  defWidget('light',{
    label:'Licht', cat:'Steuerung', paletteIcon:'bulb', size:[300,200],
    defaults:function(w){w.label='Licht';w.icon='bulb';},
    render:function(w){
      // Der Balken zeigte die Helligkeit bislang nur an. Der generische Schreibweg fuer
      // 'light' existiert laengst (js/05-interaction.js schreibt [data-role=range] auf die
      // Helligkeitsvariable) - es fehlte schlicht das Bedienelement. Ein senkrechter Regler
      // liegt jetzt unsichtbar ueber dem Balken: ziehen setzt die Helligkeit, die Optik
      // bleibt die gezeichnete Fuellung.
      // Breite in Prozent der Kachel, Rundung in Pixel. Rundung 0 ergibt einen Balken mit
      // rechten Ecken, ein hoher Wert die bisherige Pillenform.
      var _bs=[];
      if(w.barW!=null&&w.barW!=='')_bs.push('--lgbw:'+Math.max(4,Math.min(60,parseFloat(w.barW)))+'%');
      if(w.barR!=null&&w.barR!=='')_bs.push('--lgbr:'+Math.max(0,Math.min(999,parseFloat(w.barR)))+'px');
      var _bst=_bs.length?(' style="'+_bs.join(';')+'"'):'';
      var bar=w.varId2?('<div class="hl2bar"'+_bst+'><i data-role="lfill"></i>'
        +'<input class="hl2rng" type="range" data-role="range" min="0" max="100" step="1" value="0"'
        +' aria-label="Helligkeit"></div>'):'';
      return '<div class="hl2'+(w.varId2?' hasbar':'')+'">'
        +'<div class="hl2main">'
          +'<div class="hl2top"><span class="hl2ic">'+iconSVG(w.icon||'bulb',_lgLevel(w))+'</span>'
          +'<span class="hl2name">'+escL(w.label||'')+'</span></div>'
          +(w.sub?'<div class="hl2sub">'+escL(w.sub)+'</div>':'')
          +'<div class="hl2vrow"><span class="hl2val" data-role="val">–</span>'
          +'<span class="hl2unit" data-role="unit"></span></div>'
          +'<div class="hl2state" data-role="state"></div>'
        +'</div>'+bar+'</div>';
    },
    mount:function(w){_lgPaint(w);},
    live:function(w,el,id,d,base,txt,on){_lgPaint(w,(typeof rootOfEl==='function')?rootOfEl(el):null);},
    click:function(w,el,e){
      // Klick auf den Helligkeitsbalken NICHT als Schalten werten - sonst kippt das Licht
      // bei jedem Regeln zusaetzlich um.
      if(e.target.closest('.hl2bar'))return true;
      // Ein ausdruecklich gesetztes Ziel geht vor. _wClick fragt den Widget-Klick VOR
      // navTo/popupTo ab - ohne dieses Durchreichen wuerde eine Kachel, die als
      // Seiteneinstieg gedacht ist, stattdessen das Licht schalten. Wer beides will,
      // nimmt den langen Druck (longNav).
      if(w.navTo||w.popupTo||w.navBack)return false;
      if(w.varId){                                     // Statuskanal vorhanden -> den schalten
        var dd=_lastVals[w.varId],cur=dd?(dd.v===true||dd.v===1||dd.v==='1'||dd.v==='true'):false;
        setVar(w.varId,cur?0:1);return true;
      }
      if(w.varId2){                                    // reine Dimmer-Kachel: 100 % bzw. zurueck auf 0
        var n=_lgNum(w.varId2);
        setVar(w.varId2,(n!=null&&n>=100)?0:100);return true;
      }
      return false;
    },
    props:function(w){
      return row('Untertitel','<input id="pLgSub" value="'+esc(w.sub||'')+'" placeholder="z. B. Erdgeschoss">')
        +row('Status anzeigen','<input type="checkbox" id="pLgState"'+(w.showState!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Ein / Aus</span>')
        +row('Zeit anzeigen','<input type="checkbox" id="pLgSince"'+(w.showSince!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">seit HH:MM</span>')
        +row('Balkenbreite (%)','<input id="pLgBW" type="number" min="4" max="60" step="1" value="'+(w.barW!=null?w.barW:'')+'" placeholder="20">')
        +row('Balken-Rundung (px)','<input id="pLgBR" type="number" min="0" max="999" step="1" value="'+(w.barR!=null?w.barR:'')+'" placeholder="vollrund"> <span style="font-size:11px;color:var(--muted)">0 = eckig</span>')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">Der Balken erscheint nur, wenn eine Helligkeits-Variable gesetzt ist. Ohne Statusvariable schaltet ein Klick auf die Kachel zwischen 100 % und 0 %.</div>';
    },
    wire:function(w){
      if($('#pLgSub'))$('#pLgSub').onchange=function(){w.sub=this.value||undefined;render();commit();};
      if($('#pLgState'))$('#pLgState').onchange=function(){w.showState=this.checked?undefined:false;render();commit();};
      if($('#pLgSince'))$('#pLgSince').onchange=function(){w.showSince=this.checked?undefined:false;render();commit();};
      if($('#pLgBW'))$('#pLgBW').oninput=function(){w.barW=this.value===''?undefined:parseFloat(this.value);render();commit();};
      if($('#pLgBR'))$('#pLgBR').oninput=function(){w.barR=this.value===''?undefined:parseFloat(this.value);render();commit();};
    }
  });
