  // ===== Widget: Speicherleiste (savebar) =====
  //
  //  Sammelt Aenderungen, statt sie sofort zu schreiben.
  //
  //  Der Anlass: manche Geraete kennen keinen Einzelwert. Am ProCon-Poolcontroller
  //  schickt setRules() IMMER die komplette Sektion - wer fuenf Felder einer Regel
  //  nacheinander stellt, loest fuenf vollstaendige Sektionsschreibungen aus, gegen
  //  ein Stundenbudget von 60 und mit Wartezeit bei gehaltener Geraete-Semaphore.
  //
  //  Liegt dieses Widget auf einer Ansicht, wandert JEDE Wertaenderung dieser Ansicht
  //  zunaechst in einen Puffer (setVar -> deferPut). Geaenderte Kacheln bekommen die
  //  Markierung 'w-dirty'. Ein Druck auf Speichern gibt alles in EINEM Auftrag an das
  //  Modul, das nach Sektionen gruppiert und je Sektion genau einmal schreibt.
  //
  //  Eigenschaften:
  //    sbInst  = Instanz, die den Sammelauftrag ausfuehrt (PoolController)
  //    label   = Beschriftung links
  //    sbHint  = Hinweistext, wenn nichts geaendert ist
  // Belegungsanzeige je Widget - Laufzeitzustand, gehoert nicht ins Seiten-JSON.
  var _sbSched={};
  /**
   * Belegung einmal holen und die Zeile IM DOM nachziehen.
   *
   * Frueher rief diese Funktion am Ende render() - und render() ruft mount(),
   * mount() rief wieder hierher: eine Endlosschleife, die die Seite dauernd neu
   * zeichnete (Klicks kamen nicht mehr an) und bei jedem Durchlauf die
   * TIMEC-Sektion vom Controller las. Deshalb: kein render(), und je Widget nur
   * ein Anlauf.
   */
  function _sbFill(w){
    var st=_sbSched[w.id]; if(!st)return;
    var el=document.querySelector('.w[data-id="'+w.id+'"] .sb-hint');
    if(!el)return;
    el.textContent=(st.belegt!=null)
      ? (st.belegt+' von '+(st.plaetze||16)+' Regelplätzen belegt'+(st.warn?(' · '+st.warn):''))
      : 'Belegung nicht lesbar';
  }
  function _sbProbe(w,erzwingen){
    var inst=parseInt(w.sbInst)||0; if(!inst)return;
    var st=_sbSched[w.id];
    if(st&&st.laeuft)return;                    // laeuft schon
    if(!erzwingen&&st&&st.belegt!=null)return;  // schon bekannt
    _sbSched[w.id]=_sbSched[w.id]||{}; _sbSched[w.id].laeuft=1;
    fetch('?api=poolsched&inst='+inst+'&key='+encodeURIComponent(TOKEN)+'&probe=1',{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        _sbSched[w.id]={belegt:j&&j.belegt,plaetze:(j&&j.plaetze)||16,
                        warn:(j&&j.warnungen&&j.warnungen.length)?j.warnungen.join(' · '):''};
        _sbFill(w); })
      .catch(function(){ _sbSched[w.id]={}; });
  }

  defWidget('savebar',{
    label:'Speicherleiste',
    defaults:function(w){w.label='Änderungen';w.sbHint='Änderungen werden gesammelt und erst auf Knopfdruck geschrieben.';},
    render:function(w){
      // Zwei Betriebsarten. 'werte' sammelt Variablenaenderungen (Vorgabe).
      // 'zeitplan' passt zu Wochenplan-Editoren: die schreiben in das
      // Symcon-Ereignis, nicht in Variablen - da gibt es nichts zu puffern,
      // sondern die fertigen Plaene sind an den Controller zu senden.
      if((w.sbMode||'werte')==='zeitplan'){
        var st=_sbSched[w.id]||{};
        var bel=(st.belegt!=null)?(st.belegt+' von '+(st.plaetze||16)+' Regelplätzen belegt')
                                 :'Belegung über „Probe“ abfragen';
        return '<div class="sbar" data-role="savewrap">'
          +'<div class="sb-l"><span class="sb-lbl">'+esc(w.label||'Zeitpläne')+'</span>'
          +'<span class="sb-hint">'+esc(bel)+(st.warn?(' · '+esc(st.warn)):'')+'</span></div>'
          +'<div class="sb-r">'
            +'<button class="sb-b" data-sb="probe">Probe</button>'
            +'<button class="sb-b sb-go" data-sb="send">An Controller senden</button>'
          +'</div></div>';
      }
      var n=(typeof deferCount==='function')?deferCount():0;
      return '<div class="sbar'+(n>0?' has':'')+'" data-role="savewrap">'
        +'<div class="sb-l">'
          +'<span class="sb-lbl">'+esc(w.label||'Änderungen')+'</span>'
          +'<span class="sb-cnt" data-role="savecount">'+n+'</span>'
          +'<span class="sb-hint">'+esc(w.sbHint||'')+'</span>'
        +'</div>'
        +'<div class="sb-r">'
          +'<button class="sb-b" data-sb="drop">Verwerfen</button>'
          +'<button class="sb-b sb-go" data-sb="save">Speichern</button>'
        +'</div></div>';
    },
    // Meldet die Ansicht als "sammelnd" an. Ohne diesen Schritt schreibt setVar sofort.
    // Im Zeitplan-Modus NICHT: dort gibt es keine gepufferten Variablenwerte, und
    // ein Puffer wuerde andere Bedienelemente der Ansicht stillschweigend anhalten.
    mount:function(w){
      // KEIN Lesen beim Anzeigen. Die Belegung zu ermitteln heisst, die ganze
      // TIMEC-Sektion vom Controller zu holen - das darf nicht bei jedem Blick auf
      // die Seite passieren und schon gar nicht bei jedem Reiterwechsel. Gezeigt
      // wird der letzte bekannte Stand; geholt wird nur auf Knopfdruck.
      if((w.sbMode||'werte')==='zeitplan'){ _sbFill(w); return; }
      if(typeof deferRegister==='function')deferRegister();
      if(typeof _defPaint==='function')_defPaint();
    },
    click:function(w,el,e){
      var b=e.target.closest('[data-sb]'); if(!b) return false;
      var was=b.getAttribute('data-sb');
      if(was==='probe'||was==='send'){
        var inst0=parseInt(w.sbInst)||0;
        if(!inst0){toast('Keine Instanz hinterlegt');return true;}
        b.disabled=true;var alt=b.textContent;b.textContent='…';
        fetch('?api=poolsched&inst='+inst0+'&key='+encodeURIComponent(TOKEN)+(was==='send'?'':'&probe=1'),{cache:'no-store'})
          .then(function(r){return r.json();})
          .then(function(j){
            b.disabled=false;b.textContent=alt;
            _sbSched[w.id]={belegt:j&&j.belegt,plaetze:(j&&j.plaetze)||16,
                            warn:(j&&j.warnungen&&j.warnungen.length)?j.warnungen.join(' · '):''};
            _sbFill(w);
            if(was==='send')toast(j&&j.ok?(j.geschrieben?'Zeitpläne gesendet':'Nicht scharf – nichts geschrieben')
                                          :('Fehler: '+((j&&j.fehler)||'unbekannt')));
            else toast('Probe: '+((j&&j.belegt)||0)+' von '+((j&&j.plaetze)||16)+' Regelplätzen');
          })
          .catch(function(){b.disabled=false;b.textContent=alt;toast('Keine Antwort');});
        return true;
      }
      if(was==='drop'){
        if(typeof deferDrop==='function')deferDrop();
        toast('Änderungen verworfen');
        return true;
      }
      var inst=parseInt(w.sbInst)||0;
      if(!inst){toast('Keine Instanz hinterlegt');return true;}
      if(typeof deferCount==='function'&&deferCount()===0){toast('Nichts zu speichern');return true;}
      b.disabled=true;b.textContent='…';
      deferFlush(inst,function(j){
        b.disabled=false;b.textContent='Speichern';
        if(j&&j.ok){
          toast(j.werte+' Werte in '+j.zugriffe+' Gerätezugriff'+(j.zugriffe===1?'':'en')+' geschrieben');
        }else{
          // Nicht stillschweigend verwerfen: der Puffer bleibt stehen, damit
          // der Anwender es erneut versuchen kann.
          toast('Nicht gespeichert: '+((j&&(j.fehler||(j.fehler_liste||[]).join(', ')))||'unbekannt'));
        }
      });
      return true;
    },
    props:function(w){
      return row('Betriebsart','<select id="pSbMode"><option value="werte"'+((w.sbMode||'werte')==='werte'?' selected':'')+'>Werte sammeln</option><option value="zeitplan"'+(w.sbMode==='zeitplan'?' selected':'')+'>Zeitpläne senden</option></select>')
        +row('Instanz','<input id="pSbInst" value="'+esc(String(w.sbInst||''))+'" placeholder="PoolController-Instanz"> <button class="btn" id="pSbPick" style="padding:6px 8px">wählen</button>')
        +row('Hinweis','<input id="pSbHint" value="'+esc(w.sbHint||'')+'">')
        +'<div style="font-size:11px;color:var(--muted);line-height:1.45;padding:2px 4px 6px">Solange diese Leiste auf der Ansicht liegt, werden Änderungen <b>gesammelt</b> und erst auf Knopfdruck geschrieben. Geänderte Kacheln sind markiert.</div>';
    },
    wire:function(w){
      if($('#pSbMode'))$('#pSbMode').onchange=function(){w.sbMode=this.value==='zeitplan'?'zeitplan':undefined;render();renderProps();commit();};
      if($('#pSbInst'))$('#pSbInst').onchange=function(){w.sbInst=parseInt(this.value)||undefined;render();commit();};
      // _bindTarget erwartet eine Widget-ID und setzt varId; hier soll ein
      // beliebiges Feld gefuellt werden - dafuer ist _bindField da.
      if($('#pSbPick'))$('#pSbPick').onclick=function(){showTab('vars');toast('Instanz im Baum anklicken');_bindField={wid:w.id,path:'sbInst'};};
      if($('#pSbHint'))$('#pSbHint').oninput=function(){w.sbHint=this.value||undefined;render();commit();};
    }
  });
