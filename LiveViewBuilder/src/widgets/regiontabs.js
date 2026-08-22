  // ===== Widget: Region-Tabs (regiontabs) — Tab-Leiste im HomeSuite-Raum-Look =====
  //  Schaltet den Inhalt eines Komponenten-Bereichs (component mit gleichem Region-Namen)
  //  zwischen mehreren Ansichten um. Optik = die einheitliche Selektor-Leiste (hssel:
  //  Buttons/Pills/Underline); der aktive Tab (= aktuell in der Region gezeigte Ansicht)
  //  wird hervorgehoben.
  //    w.slot   = Region-Name (muss zum component.slot passen)
  //    w.style  = 'buttons' | 'pills' | 'underline'
  //    w.default= Ansicht, die anfangs aktiv ist (i. d. R. = component.comp)
  //    w.tabs   = [{label, view}]
  function _rtabCur(w){
    var reg=(typeof _regions!=='undefined'&&_regions)?_regions[w.slot]:null;
    return reg || w.default || ((w.tabs&&w.tabs[0])?w.tabs[0].view:'');
  }
  defWidget('regiontabs',{
    label:'Region-Tabs', cat:'Leisten (alle Seiten)', paletteIcon:'wselect', size:[900,48],
    defaults:function(w){w.tabs=[];w.style='pills';w.slot='inhalt';},
    render:function(w){
      var cur=_rtabCur(w), st=(w.style==='buttons'||w.style==='underline')?w.style:'pills';
      var h='<div class="hssel hssel-'+st+'">';
      (w.tabs||[]).forEach(function(t){
        if(!t||!t.view)return;
        h+='<button class="hsroom'+(t.view===cur?' on':'')+'" data-rtv="'+esc(t.view)+'">'+escL(t.label||t.view)+'</button>';
      });
      return h+'</div>';
    },
    // Beim ersten Zeichnen die Standard-Ansicht auch WIRKLICH einstellen.
    //
    // Ohne diesen Schritt zeigte die Kachel, was in der Komponente steht, und die
    // Leiste hob den Standard-Reiter hervor - zwei Angaben, eine Anzeige, und im
    // Zweifel widersprechen sie sich. Einmal je Ansicht genuegt; danach gilt,
    // was der Anwender angeklickt hat.
    mount:function(w){
      if(typeof mode!=='undefined'&&mode==='edit')return;
      if(!w.slot||!w.default||typeof setRegion!=='function')return;
      if(typeof _regions!=='undefined'&&_regions&&_regions[w.slot])return;   // schon gewaehlt
      if(w._rtStart===store.current)return;                                   // schon erledigt
      w._rtStart=store.current;
      setRegion(w.slot,w.default);
    },
    click:function(w,el,e){
      var b=e.target.closest('[data-rtv]'); if(!b)return false;
      // Beim Zeigergeraet ist der Wechsel schon beim Druecken passiert (siehe
      // unten). Dann hier NICHT noch einmal - das waere ein zweites Zeichnen
      // ohne Wirkung.
      if(w._rtZeit&&(Date.now()-w._rtZeit)<800)return true;
      var view=b.getAttribute('data-rtv');
      if(w.slot&&typeof setRegion==='function'){setRegion(w.slot,view);}
      return true;
    },
    props:function(w){if(w.type!=='regiontabs')return '';
      // Welche Regionen gibt es auf dieser Seite ueberhaupt? Der Name muss zu
      // einer Komponente passen, und bisher musste man ihn wissen.
      var slots=[],hin='';
      (state.widgets||[]).forEach(function(x){
        if(x.type==='component'&&x.slot&&slots.indexOf(x.slot)<0)slots.push(x.slot);
      });
      if(w.slot){
        var treffer=(state.widgets||[]).filter(function(x){return x.type==='component'&&x.slot===w.slot;});
        hin=treffer.length
          ? '<span style="color:var(--ok)">schaltet die Komponente '+treffer.map(function(x){return '„'+esc(x.name||x.id)+'"';}).join(', ')+'</span>'
          : '<span style="color:var(--warn)">keine Komponente mit diesem Region-Namen auf dieser Seite</span>';
      }
      return row('Region',(slots.length
          ? '<select id="pRtSlotSel"><option value="">— gefundene Regionen —</option>'
              +slots.map(function(n){return '<option value="'+esc(n)+'"'+(w.slot===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')
              +'</select> '
          : '')
        +'<input id="pRtSlot" value="'+esc(w.slot||'')+'" placeholder="muss zur Komponente passen" style="width:150px">')
      +'<div style="font-size:11px;line-height:1.4;margin:2px 2px 6px">'+hin+'</div>'
      +row('Standard-Reiter','<select id="pRtDef"><option value="">— erster Reiter —</option>'
          +(w.tabs||[]).filter(function(t){return t&&t.view;}).map(function(t){
              return '<option value="'+esc(t.view)+'"'+(w.default===t.view?' selected':'')+'>'+esc(t.label||t.view)+'</option>';
            }).join('')+'</select>')
      +'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:2px 2px 6px">'
      +'Diese Ansicht steht beim Oeffnen der Seite in der Region. Die Komponente wird mitgezogen.</div>'
      +row('Stil','<select id="pRtStyle"><option value="buttons"'+(w.style==='buttons'?' selected':'')+'>Buttons</option><option value="pills"'+((w.style||'pills')==='pills'?' selected':'')+'>Pills</option><option value="underline"'+(w.style==='underline'?' selected':'')+'>Underline</option></select>')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Schaltet den gleichnamigen Komponenten-Bereich um. Tabs (Label · Ansicht) werden generiert bzw. per Liste gepflegt.</div>'
        +listEditor(w,'tabs','Tabs: Label · Ansicht',[{k:'label',ph:'Label'},{k:'view',ph:'Ansicht'}]);
    },
    wire:function(w){
      if($('#pRtStyle'))$('#pRtStyle').onchange=function(){w.style=this.value;render();commit();};
      if($('#pRtSlot'))$('#pRtSlot').oninput=function(){w.slot=this.value||undefined;render();renderProps();commit();};
      if($('#pRtSlotSel'))$('#pRtSlotSel').onchange=function(){if(!this.value)return;w.slot=this.value;render();renderProps();commit();};
      if($('#pRtDef'))$('#pRtDef').onchange=function(){
        w.default=this.value||undefined;
        // Die Komponente mitziehen: sie entscheidet, was OHNE gesetzte Region zu
        // sehen ist. Zwei Stellen mit derselben Aussage duerfen nicht auseinander
        // laufen - sonst zeigt die Seite A und die Leiste hebt B hervor.
        if(w.slot&&w.default){
          (state.widgets||[]).forEach(function(x){
            if(x.type==='component'&&x.slot===w.slot)x.comp=w.default;
          });
        }
        delete w._rtStart;
        if(typeof _regions!=='undefined'&&_regions&&w.slot)delete _regions[w.slot];
        render();renderProps();commit();
      };
    }
  });

  /**
   * Umschalten schon beim DRUECKEN, nicht erst beim Loslassen.
   *
   * Der Anlass ist eine Klage aus dem Betrieb: die Reiter reagierten manchmal
   * erst beim zweiten Klick. Zwischen Druecken und Loslassen kann einiges
   * dazwischenkommen - die Seite baut noch auf, ein Widget zeichnet sich neu und
   * ersetzt dabei den Knopf unter dem Finger, oder ein vorangegangener
   * Lang-Druck hat den naechsten Klick zum Verschlucken vorgemerkt. Beim
   * Druecken ist nichts davon passiert.
   *
   * Der Klick-Weg bleibt als Rueckfall bestehen (Tastatur, Barrierefreiheit);
   * er erkennt an der Zeitmarke, dass schon geschaltet wurde.
   */
  document.addEventListener('pointerdown', function(e){
    try{
      if(typeof mode!=='undefined'&&mode==='edit')return;
      var b=e.target.closest&&e.target.closest('[data-rtv]');
      if(!b)return;
      var el=b.closest('.w[data-id]');
      if(!el)return;
      var w=(typeof _wForEl==='function')?_wForEl(el):null;
      if(!w||w.type!=='regiontabs'||!w.slot||typeof setRegion!=='function')return;
      w._rtZeit=Date.now();
      setRegion(w.slot,b.getAttribute('data-rtv'));
    }catch(_e){}
  }, true);
