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
  defWidget('cover',{
    label:'Rollo', paletteIcon:'blinds', size:[200,112],
    render:function(w){
      return '<div class="hcov"><div class="hcrow"><span class="hcname">'+escL(w.label||'')+'</span>'
        +'<span class="hcval" data-role="val">–</span></div>'
        +(w.varId3?'<div class="hcstate" data-role="cstate">–</div>':'')
        +'<div class="hcbtns">'
        +'<button data-role="cup" title="Auf"><svg><use href="#ic-chevup"/></svg></button>'
        +'<button data-role="cstop" title="Stop"><svg><use href="#ic-stop"/></svg></button>'
        +'<button data-role="cdn" title="Zu"><svg><use href="#ic-chevdn"/></svg></button></div>'
        +'<input class="hsrange" type="range" data-role="range" min="0" max="100" step="1" value="0"></div>';
    },
    // Die Tastenlogik lag zuvor fest verdrahtet in _wClick. Sie gehoert zum Widget - nur
    // hier kommt sie an die Befehlswerte heran.
    click:function(w,el,e){
      if(w.navTo||w.popupTo||w.navBack)return false;        // gesetztes Seitenziel geht vor
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
      if(w.varId3&&id===w.varId3){var cs=$('[data-role=cstate]',el);if(cs)cs.textContent=txt;return;}
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
      return row('Anzeige gespiegelt','<input type="checkbox" id="pCvInv"'+(w.cvInv?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">100 &minus; Wert</span>')
        +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Manche Anlagen z&auml;hlen den <b>Schlie&szlig;grad</b>: 0&nbsp;% hei&szlig;t offen, 100&nbsp;% geschlossen (so auch IPSShadowing). Gespiegelt zeigt die Kachel stattdessen den &Ouml;ffnungsgrad &ndash; Schieber rechts = offen. Geschrieben wird weiterhin der echte Wert.</div>'
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">Befehlswerte leer lassen, wenn die Kachel &uuml;ber die Position fahren soll (Auf = 100 %, Zu = 0 %). Anlagen mit Befehlsvariable brauchen eigene Werte &ndash; IPSShadowing etwa 14 / 13 / 11.</div>'
        +row('Befehl Auf','<input id="pCvUp" value="'+esc(String(w.cvUp==null?'':w.cvUp))+'" placeholder="leer = Position 100">')
        +row('Befehl Stop','<input id="pCvStop" value="'+esc(String(w.cvStop==null?'':w.cvStop))+'" placeholder="leer = 1">')
        +row('Befehl Zu','<input id="pCvDn" value="'+esc(String(w.cvDn==null?'':w.cvDn))+'" placeholder="leer = Position 0">');
    },
    wire:function(w){
      if($('#pCvInv'))$('#pCvInv').onchange=function(){w.cvInv=this.checked||undefined;render();commit();};
      [['pCvUp','cvUp'],['pCvStop','cvStop'],['pCvDn','cvDn']].forEach(function(p){
        var el=$('#'+p[0]);if(!el)return;
        el.onchange=function(){var v=this.value.trim();w[p[1]]=(v===''?undefined:v);commit();};
      });
    }
  });
