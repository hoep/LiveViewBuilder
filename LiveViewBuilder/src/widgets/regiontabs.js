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
    label:'Region-Tabs', paletteIcon:'wselect', size:[900,48],
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
    click:function(w,el,e){
      var b=e.target.closest('[data-rtv]'); if(!b)return false;
      var view=b.getAttribute('data-rtv');
      if(w.slot&&typeof setRegion==='function'){setRegion(w.slot,view);}   // setzt _regions + render() -> Tabs re-highlighten
      return true;
    },
    props:function(w){if(w.type!=='regiontabs')return '';
      return row('Stil','<select id="pRtStyle"><option value="buttons"'+(w.style==='buttons'?' selected':'')+'>Buttons</option><option value="pills"'+((w.style||'pills')==='pills'?' selected':'')+'>Pills</option><option value="underline"'+(w.style==='underline'?' selected':'')+'>Underline</option></select>')
        +row('Region-Name','<input id="pRtSlot" value="'+esc(w.slot||'')+'" placeholder="muss zur Komponente passen">')
        +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">Schaltet den gleichnamigen Komponenten-Bereich um. Tabs (Label · Ansicht) werden generiert bzw. per Liste gepflegt.</div>'
        +listEditor(w,'tabs','Tabs: Label · Ansicht',[{k:'label',ph:'Label'},{k:'view',ph:'Ansicht'}]);
    },
    wire:function(w){
      if($('#pRtStyle'))$('#pRtStyle').onchange=function(){w.style=this.value;render();commit();};
      if($('#pRtSlot'))$('#pRtSlot').oninput=function(){w.slot=this.value||undefined;render();commit();};
    }
  });
