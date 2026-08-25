  // ===== Widget: Ablaufkette (phaseband) =====
  //
  // Eine feste REIHENFOLGE von Schritten, von denen genau einer gerade gilt:
  // die Brennerphasen (Aus · Zündung · Anheizen · Leistungsbrand · Ausbrand ·
  // Reinigung) oder die Ursachenkette einer Anforderung ("Puffer oben unter der
  // Einschaltschwelle" → "Anforderung an den Kessel" → "Brenner startet").
  //
  // Warum kein Zustands-Widget: die Zustandskachel (assoc) zeigt nur den EINEN
  // aktuellen Zustand. Hier ist die Reihenfolge selbst die Aussage - man sieht,
  // was schon durchlaufen ist und was noch kommt. Und warum keine Info-Liste:
  // die Liste hat keine Vorher/Nachher-Ordnung, sie kennt nur Zeilen.
  //
  // Der aktive Schritt kommt entweder aus EINER Variablen (w.varId), deren Wert
  // je Schritt zugeordnet wird (`v`: Zahl, Text, ">=3", "3..5", "*"), oder aus
  // einer eigenen Variablen je Schritt (`vid`, wahr = dieser Schritt gilt).
  // Schritte VOR dem aktiven gelten als durchlaufen und werden gedaempft.
  //
  // Zwei Lagen, weil dieselbe Aussage zwei Formate braucht: waagrecht als Band
  // ueber die Breite (Phasen), senkrecht als nummerierte Kette (Ursachen).
  function _pbSchritte(w){return (w.phases||[]).filter(function(p){return p&&(p.label!=null&&p.label!=='');});}
  /** Index des gerade geltenden Schritts - oder -1, wenn keiner passt. */
  function _pbAktiv(w){
    var st=_pbSchritte(w);
    for(var i=0;i<st.length;i++){                       // eigene Variable je Schritt hat Vorrang
      if(st[i].vid){var d=_lastVals[st[i].vid];
        if(d&&(d.v===true||d.v===1||d.v==='1'||d.v==='true'))return i;}
    }
    var lv=w.varId&&_lastVals[w.varId];
    if(!lv)return -1;
    var roh=lv.v, txt=(lv.f!=null&&lv.f!=='')?lv.f:String(lv.v);
    for(var k=0;k<st.length;k++){
      var pat=st[k].v;
      if(pat==null||pat==='')continue;
      if(_assocMatch(pat,roh)||_assocMatch(pat,txt))return k;
    }
    return -1;
  }
  /** Klassen setzen: aktiv, durchlaufen, offen. Kein Neuzeichnen - nur Zustand. */
  function _pbMalen(w,el){
    if(!el)return;
    var a=_pbAktiv(w), dim=(w.pbDone!==false);
    $$('[data-pbi]',el).forEach(function(n){
      var i=parseInt(n.getAttribute('data-pbi'),10);
      n.classList.toggle('on', i===a);
      n.classList.toggle('done', dim&&a>=0&&i<a);
    });
  }
  defWidget('phaseband',{
    label:'Ablaufkette', cat:'Anzeige', paletteIcon:'wlist', size:[560,58],
    defaults:function(w){
      w.pbDir='h';
      w.phases=[{label:'Aus',v:'0',hint:'keine Anforderung'},
                {label:'Zündung',v:'1',hint:'Flammraum steigt'},
                {label:'Anheizen',v:'2',hint:'auf Modulationsstufe'},
                {label:'Leistungsbrand',v:'3',hint:'moduliert'},
                {label:'Ausbrand',v:'4',hint:'Nachlauf Saugzug'},
                {label:'Reinigung',v:'5',hint:'Brennteller'}];
    },
    render:function(w){
      var st=_pbSchritte(w), senk=(w.pbDir==='v'), num=(w.pbNum===true)||senk;
      var h='<div class="pbnd'+(senk?' pb-v':' pb-h')+'">';
      st.forEach(function(p,i){
        var kopf=num?('<span class="pbnr">'+(i+1)+'</span>'):'<span class="pbdot"></span>';
        h+='<div class="pbst" data-pbi="'+i+'">'+kopf
          +'<span class="pbtx"><b>'+escL(p.label||'')+'</b>'
          +((p.hint!=null&&p.hint!=='')?'<i'+(p.hintVid?' data-vid="'+p.hintVid+'"':'')+'>'+escL(p.hint)+'</i>'
            :(p.hintVid?'<i data-vid="'+p.hintVid+'">–</i>':''))
          +'</span></div>';
        if(!senk&&i<st.length-1)h+='<span class="pbsep"></span>';
      });
      return h+'</div>';
    },
    mount:function(w){
      var el=$('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));
      _pbMalen(w,el);
    },
    live:function(w,el,id,d,base,txt,on){_pbMalen(w,el);return false;},
    props:function(w){if(w.type!=='phaseband')return '';
      return row('Lage','<select id="pPbDir"><option value="h"'+((w.pbDir||'h')==='h'?' selected':'')+'>waagrecht (Band)</option><option value="v"'+(w.pbDir==='v'?' selected':'')+'>senkrecht (nummerierte Kette)</option></select>')
        +row('Nummern','<input type="checkbox" id="pPbNum"'+((w.pbNum===true||w.pbDir==='v')?' checked':'')+(w.pbDir==='v'?' disabled':'')+'> <span style="font-size:11px;color:var(--muted)">senkrecht immer</span>')
        +row('Durchlaufene dämpfen','<input type="checkbox" id="pPbDone"'+((w.pbDone!==false)?' checked':'')+'>')
        +'<div style="font-size:11px;color:var(--muted);line-height:1.45;margin:4px 2px 6px">'
        +'Der aktive Schritt kommt aus <b>Var 1</b>: je Schritt eine Zuordnung — Zahl, Text, '
        +'<code>&gt;=3</code>, <code>3..5</code> oder <code>*</code>. Alternativ je Schritt eine '
        +'<b>eigene Variable</b> (wahr = dieser Schritt gilt); sie hat Vorrang. '
        +'Die Unterzeile darf ein fester Text sein oder aus einer Variablen kommen.</div>'
        +listEditor(w,'phases','Schritte: Name · Zuordnung · eigene Var · Unterzeile · Var',[
              {k:'label',  ph:'Name',       h:'Name'},
              {k:'v',      ph:'z. B. 3',    h:'Zuordnung'},
              {k:'vid',    ph:'ID',         h:'eigene Var'},
              {k:'hint',   ph:'Unterzeile', h:'Unterzeile'},
              {k:'hintVid',ph:'ID',         h:'Var'}]);
    },
    wire:function(w){
      if($('#pPbDir'))$('#pPbDir').onchange=function(){w.pbDir=this.value;render();renderProps();commit();};
      if($('#pPbNum'))$('#pPbNum').onchange=function(){w.pbNum=this.checked||undefined;render();commit();};
      if($('#pPbDone'))$('#pPbDone').onchange=function(){w.pbDone=this.checked?undefined:false;render();commit();};
    }
  });
