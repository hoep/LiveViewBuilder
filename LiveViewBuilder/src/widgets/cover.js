  // ===== Widget: Cover — Rollo/Jalousie mit Auf/Stop/Zu und Positions-Slider =====
  //
  //  varId  = Position in Prozent. Sie speist Anzeige und Schieber; der Schieber schreibt
  //           sie generisch ueber _wChange (js/05-interaction.js) zurueck.
  //  varId2 = Befehlsvariable (optional). Anlagen wie IPSShadowing fahren NICHT ueber die
  //           Position, sondern ueber ein Kommando mit eigenen Werten - dort bedeutet
  //           14 "Hoch", 13 "Stop" und 11 "Runter". Wer solche Werte eintraegt, bekommt
  //           echtes Fahren statt eines Sprungs auf 100 % bzw. 0 %.
  //  varId3 = optionale Statuszeile, z. B. "Automatik" oder "Manuell".
  //
  //  Bleiben die Befehlswerte leer, verhaelt sich die Kachel exakt wie zuvor: Auf/Zu
  //  schreiben 100 bzw. 0 auf die Position, Stop schreibt 1 auf varId2.
  function _cvVal(w,k){var v=w['cv'+k];return (v===undefined||v===null||v==='')?null:v;}
  // Modus-Umschalter (ShadingDevice-Mode): Wert 0=Auto, 1=Manuell, 2=Sonne.
  // Anzeige-Reihenfolge Auto | Sonne | Manuell.
  var COV_MODE_OPTS=[[0,'Auto'],[2,'Sonne'],[1,'Manuell']];
  // Skin-Key -> Hex, freie Farbe durchreichen, sonst leer (Fallback greift per CSS-var).
  function _covCol(v){return v?((typeof _skinColor==='function'&&_skinColor(v))||v):'';}
  function _covStyle(w){
    var s=[];
    function pv(n,v){if(v)s.push(n+':'+v);}
    pv('--cov-name',_covCol(w.covName)); pv('--cov-val',_covCol(w.covVal));
    pv('--cov-state',_covCol(w.covState)); pv('--cov-modebg',_covCol(w.covModeBg));
    pv('--cov-btnbg',_covCol(w.covBtnBg)); pv('--cov-btnic',_covCol(w.covBtnIc));
    if(w.covAccent)pv('--accent',_covCol(w.covAccent));
    if(w.covNameFs)s.push('--cov-namefs:'+(parseInt(w.covNameFs)||14)+'px');
    if(w.covValFs)s.push('--cov-valfs:'+(parseInt(w.covValFs)||14)+'px');
    return s.length?' style="'+s.join(';')+'"':'';
  }
  function _covIcoBtn(field,ic){return '<button class="btn" data-covico="'+field+'" title="Icon wählen" style="padding:3px;margin-right:4px"><span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--accent)"><svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round"><use href="#ic-'+esc(ic)+'"/></svg></span></button>';}
  defWidget('cover',{
    label:'Rollo', paletteIcon:'blinds', size:[200,112],
    render:function(w){
      var icU=w.icUp||'chevup', icS=w.icStop||'stop', icD=w.icDn||'chevdn';
      return '<div class="hcov"'+_covStyle(w)+'><div class="hcrow"><span class="hcname">'+escL(w.label||'')+'</span>'
        +'<span class="hcval" data-role="val">–</span></div>'
        +(w.varId3?(w.cvMode
            ?'<div class="hcmode" data-role="cmode">'+COV_MODE_OPTS.map(function(o){return '<button type="button" data-cmode="'+o[0]+'">'+esc(o[1])+'</button>';}).join('')+'</div>'
            :'<div class="hcstate" data-role="cstate">–</div>')
          :'')
        +'<div class="hcbtns">'
        +'<button data-role="cup" title="Auf"><svg><use href="#ic-'+esc(icU)+'"/></svg></button>'
        +'<button data-role="cstop" title="Stop"><svg><use href="#ic-'+esc(icS)+'"/></svg></button>'
        +'<button data-role="cdn" title="Zu"><svg><use href="#ic-'+esc(icD)+'"/></svg></button></div>'
        +'<input class="hsrange" type="range" data-role="range" min="0" max="100" step="1" value="0"></div>';
    },
    // Die Tastenlogik lag zuvor fest verdrahtet in _wClick. Sie gehoert zum Widget - nur
    // hier kommt sie an die Befehlswerte heran.
    click:function(w,el,e){
      if(w.navTo||w.popupTo||w.navBack)return false;        // gesetztes Seitenziel geht vor
      if(w.cvMode&&w.varId3){                               // Modus-Umschalter (schreibt varId3)
        var mb=e.target.closest('[data-cmode]');
        if(mb){setVar(w.varId3,parseInt(mb.getAttribute('data-cmode'),10));return true;}
      }
      var up=e.target.closest('[data-role=cup]'),st=e.target.closest('[data-role=cstop]'),
          dn=e.target.closest('[data-role=cdn]');
      if(!up&&!st&&!dn)return false;                        // Klick daneben: nicht abfangen
      if(st){if(w.varId2)setVar(w.varId2,_cvVal(w,'Stop')!==null?_cvVal(w,'Stop'):1);return true;}
      var k=up?'Up':'Dn';
      if(w.varId2&&_cvVal(w,k)!==null){setVar(w.varId2,_cvVal(w,k));return true;}
      if(w.varId)setVar(w.varId,up?100:0);
      return true;
    },
    live:function(w,el,id,d,base,txt,on){
      if(w.varId3&&id===w.varId3){
        if(w.cvMode){var mm=$('[data-role=cmode]',el);if(mm){var mv=parseInt(d.v,10);
          mm.querySelectorAll('[data-cmode]').forEach(function(b){b.classList.toggle('on',parseInt(b.getAttribute('data-cmode'),10)===mv);});}return;}
        var cs=$('[data-role=cstate]',el);if(cs)cs.textContent=txt;return;}
      // NUR die Positionsvariable darf Anzeige und Schieber setzen. live() laeuft fuer JEDE
      // Variable des Widgets - ohne diese Sperre schrieb die Befehlsvariable ihren eigenen
      // Text ("Geschlossen", "Offen") in das Wertfeld und ihren Rohwert (0, 6, 8) in den
      // Schieber. Der Balken stand dann auf dem Befehl statt auf der Position.
      if(id!==w.varId)return;
      var n=parseFloat(d.v);if(isNaN(n))n=0;
      var shown=w.cvInv?(100-n):n;
      var cr=$('[data-role=range]',el);if(cr&&document.activeElement!==cr)cr.value=shown;
      // Gespiegelt passt der fertige Text der API nicht mehr - er nennt den Rohwert. Die
      // Einheit kommt weiterhin vom Profil, damit "%" nicht fest verdrahtet ist.
      var cv=$('[data-role=val]',el);if(cv)cv.textContent=w.cvInv?(Math.round(shown)+(d.u||'')):txt;
    },
    // Gespiegelt muss auch der Schieber zurueckgerechnet werden. Der generische Weg in
    // _wChange schriebe sonst den Anzeigewert als Position - also genau spiegelverkehrt.
    input:function(w,el,e){
      var r=e.target.closest('[data-role=range]');if(!r)return false;
      if(!w.cvInv)return false;                          // ungespiegelt: generischer Weg genuegt
      if(w.varId)setVar(w.varId,100-(parseFloat(r.value)||0));
      return true;
    },
    props:function(w){
      return row('varId3 = Modus-Umschalter','<input type="checkbox" id="pCvMode"'+(w.cvMode?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Auto / Sonne / Manuell</span>')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Zeigt <b>varId3</b> statt als Statuszeile als 3-Segment-Schalter (schreibt 0&nbsp;Auto, 2&nbsp;Sonne, 1&nbsp;Manuell &ndash; passend zur ShadingDevice-Modusvariable).</div>'
        +row('Anzeige gespiegelt','<input type="checkbox" id="pCvInv"'+(w.cvInv?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">100 &minus; Wert</span>')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Manche Anlagen z&auml;hlen den <b>Schlie&szlig;grad</b>: 0&nbsp;% hei&szlig;t offen, 100&nbsp;% geschlossen (so auch IPSShadowing). Gespiegelt zeigt die Kachel stattdessen den &Ouml;ffnungsgrad &ndash; Schieber rechts = offen. Geschrieben wird weiterhin der echte Wert.</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">Befehlswerte leer lassen, wenn die Kachel &uuml;ber die Position fahren soll (Auf = 100 %, Zu = 0 %). Anlagen mit Befehlsvariable brauchen eigene Werte &ndash; IPSShadowing etwa 14 / 13 / 11.</div>'
        +row('Befehl Auf','<input id="pCvUp" value="'+esc(String(w.cvUp==null?'':w.cvUp))+'" placeholder="leer = Position 100">')
        +row('Befehl Stop','<input id="pCvStop" value="'+esc(String(w.cvStop==null?'':w.cvStop))+'" placeholder="leer = 1">')
        +row('Befehl Zu','<input id="pCvDn" value="'+esc(String(w.cvDn==null?'':w.cvDn))+'" placeholder="leer = Position 0">')
        // ---- Stil ----
        +'<div class="pgh">Stil</div>'
        +row('Icons Auf/Stop/Zu',
            _covIcoBtn('icUp',w.icUp||'chevup')+_covIcoBtn('icStop',w.icStop||'stop')+_covIcoBtn('icDn',w.icDn||'chevdn'))
        +row('Akzent (Wert/Slider)',skinSel(w.covAccent||'','id="pCovAcc"'))
        +row('Name-Farbe',skinSel(w.covName||'','id="pCovName"'))
        +row('Wert-Farbe',skinSel(w.covVal||'','id="pCovVal"'))
        +row('Statuszeile',skinSel(w.covState||'','id="pCovState"'))
        +row('Modus aktiv',skinSel(w.covModeBg||'','id="pCovModeBg"'))
        +row('Tasten-Fläche',skinSel(w.covBtnBg||'','id="pCovBtnBg"'))
        +row('Tasten-Icon',skinSel(w.covBtnIc||'','id="pCovBtnIc"'))
        +row('Schrift Name','<input id="pCovNameFs" type="number" min="8" max="40" value="'+(w.covNameFs||'')+'" placeholder="auto" style="width:70px"> px')
        +row('Schrift Wert','<input id="pCovValFs" type="number" min="8" max="40" value="'+(w.covValFs||'')+'" placeholder="auto" style="width:70px"> px');
    },
    wire:function(w){
      if($('#pCvMode'))$('#pCvMode').onchange=function(){w.cvMode=this.checked||undefined;render();commit();};
      if($('#pCvInv'))$('#pCvInv').onchange=function(){w.cvInv=this.checked||undefined;render();commit();};
      [['pCvUp','cvUp'],['pCvStop','cvStop'],['pCvDn','cvDn']].forEach(function(p){
        var el=$('#'+p[0]);if(!el)return;
        el.onchange=function(){var v=this.value.trim();w[p[1]]=(v===''?undefined:v);commit();};
      });
      // Stil: Icon-Picker (nutzt die generische _iconPick-Infrastruktur -> Feld direkt)
      $$('[data-covico]').forEach(function(b){b.onclick=function(){_iconPick={wid:w.id,field:b.dataset.covico};if(typeof showTab==='function')showTab('icons');toast('Icon wählen');};});
      [['pCovAcc','covAccent'],['pCovName','covName'],['pCovVal','covVal'],['pCovState','covState'],['pCovModeBg','covModeBg'],['pCovBtnBg','covBtnBg'],['pCovBtnIc','covBtnIc']].forEach(function(p){
        var el=$('#'+p[0]);if(!el)return;el.onchange=function(){w[p[1]]=this.value||undefined;render();commit();};
      });
      [['pCovNameFs','covNameFs'],['pCovValFs','covValFs']].forEach(function(p){
        var el=$('#'+p[0]);if(!el)return;el.onchange=function(){w[p[1]]=parseInt(this.value)||undefined;render();commit();};
      });
    }
  });
