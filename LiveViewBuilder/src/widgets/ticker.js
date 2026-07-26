  // ===== Widget: Laufzeile (Ticker) — Alarm-/Meldungslaufband =====
  // Eine Zeile ist: (a) Referenz auf ein benanntes Widget (m.ref) · (b) inline-Widget (m.wtype) · (c) statischer/Variablen-Text.
  // Widget-Zeilen werden als echte Instanzen gerendert (widgetInner) und in _tickKids für Live-Updates registriert.
  var _TICK_TYPES=[['value','Wert'],['kpi','KPI'],['delta','Delta'],['chip','Chip'],['icon','Icon'],['text','Text'],['switch','Schalter'],['tile','Kachel'],['bar','Balken']];
  function _tkBox(w,src,mw,i,sfx){ // rendert eine Widget-Instanz (Klon von src-Config) als Laufband-Kachel
    var cfg={};for(var k in src)cfg[k]=src[k];cfg.id=w.id+'__t'+i+sfx;cfg.type=src.type;delete cfg.x;delete cfg.y;
    var iw=parseInt(mw)||parseInt(src.w)||170;_tickKids.push(cfg);
    var inner;try{inner=widgetInner(cfg);}catch(e){inner='';}
    return '<div class="w t-'+esc(src.type)+'" data-id="'+cfg.id+'" style="position:relative;flex:none;height:calc(100% - 12px);width:'+iw+'px;margin:0 5px"><div class="winner" style="position:absolute;inset:0">'+inner+'</div></div>';
  }
  defWidget('ticker',{
    label:'Laufzeile', paletteIcon:'wticker', size:[560,46],
    defaults:function(w){w.label='Alarm';w.speed=46;w.items=[{sev:'warn',icon:'window',text:'2 Fenster offen',sub:'Bad OG · Küche EG'},{sev:'info',icon:'washer',text:'Waschmaschine läuft',sub:'Restzeit 0:42'},{sev:'ok',icon:'shield',text:'Alarm unscharf',sub:''}];},
    render:function(w){
      var its=w.items||[],crit=its.filter(function(m){return !m.wtype&&m.ref==null&&(m.sev||'')==='crit';}).length;
      var band=function(sfx){return its.map(function(m,i){
        if(m.ref!=null){                                               // --- Referenz auf benanntes Widget ---
          var src=widgetByName(m.ref);
          if(src)return _tkBox(w,src,m.w,i,sfx);
          return '<span class="htm warn"><span class="htdot"></span><b>? '+esc(m.ref||'(kein Widget)')+'</b></span>';
        }
        if(m.wtype&&WIDGETS[m.wtype]){                                 // --- inline-Widget ---
          var cfg={};for(var k in m)cfg[k]=m[k];cfg.type=m.wtype;return _tkBox(w,cfg,m.w,i,sfx);
        }
        var val=m.vid?'<b data-vid="'+esc(String(m.vid))+'">'+esc(m.val||'–')+'</b>':''; // --- statischer/Variablen-Text ---
        return '<span class="htm '+esc(m.sev||'info')+'"><span class="htdot"></span>'
          +(m.icon?'<span class="htic">'+iconSVG(m.icon)+'</span>':'')
          +(m.text?'<b>'+esc(m.text||'')+'</b>':'')
          +(val?(m.text?' ':'')+val:'')
          +(m.sub?' <small>'+esc(m.sub)+'</small>':'')+'</span>';
      }).join('');};
      var itm=band(''),itm2=band('b');
      var lead=w.hideLead?'':'<div class="htlead"><span class="htpulse"></span>'+esc(w.label||'Alarm')+(w.hideCount?'':'<span class="htcnt">'+crit+'</span>')+'</div>';
      return '<div class="htick'+(crit===0?' ok':'')+'">'+lead+'<div class="httrack"><div class="htmove" style="animation-duration:'+(w.speed||46)+'s">'+itm+itm2+'</div></div></div>';
    },
    props:function(w){
      var names=namedWidgets(w.id);
      var rows=(w.items||[]).map(function(m,i){
        var isRef=(m.ref!=null),isW=!!m.wtype;
        var typeSel='<select data-tk="__type.'+i+'"><option value=""'+(!isW&&!isRef?' selected':'')+'>— Text —</option>'
          +'<option value="@ref"'+(isRef?' selected':'')+'>Widget (Referenz)</option>'
          +_TICK_TYPES.map(function(t){return '<option value="'+t[0]+'"'+(m.wtype===t[0]?' selected':'')+'>'+t[1]+'</option>';}).join('')+'</select>';
        var fields;
        if(isRef){
          fields='<select data-tk="ref.'+i+'"><option value="">— Widget wählen —</option>'
            +names.map(function(n){return '<option value="'+esc(n.name)+'"'+(m.ref===n.name?' selected':'')+'>'+esc(n.name)+' ('+esc(n.type)+')</option>';}).join('')+'</select>'
            +'<input data-tk="w.'+i+'" value="'+esc(m.w||'')+'" placeholder="Breite" style="width:56px">';
        } else if(isW){
          fields='<input data-tk="varId.'+i+'" value="'+esc(m.varId!=null?m.varId:'')+'" placeholder="VarID" style="width:64px">'
            +'<input data-tk="label.'+i+'" value="'+esc(m.label||'')+'" placeholder="Label">'
            +'<input data-tk="icon.'+i+'" value="'+esc(m.icon||'')+'" placeholder="Icon" style="width:64px">'
            +'<input data-tk="w.'+i+'" value="'+esc(m.w||'')+'" placeholder="Breite" style="width:56px">';
        } else {
          fields='<input data-tk="text.'+i+'" value="'+esc(m.text||'')+'" placeholder="Text">'
            +'<input data-tk="vid.'+i+'" value="'+esc(m.vid||'')+'" placeholder="VarID" style="width:64px">'
            +'<input data-tk="icon.'+i+'" value="'+esc(m.icon||'')+'" placeholder="Icon" style="width:64px">'
            +'<input data-tk="sev.'+i+'" value="'+esc(m.sev||'')+'" placeholder="sev" style="width:52px">';
        }
        return '<div style="display:flex;gap:4px;margin-bottom:5px;flex-wrap:wrap;align-items:center">'+typeSel+fields+'<button class="btn" data-tkdel="'+i+'" style="padding:2px"><svg class="i"><use href="#ic-minus"/></svg></button></div>';
      }).join('');
      return row('Tempo (s)','<input id="pSpeed" type="number" min="8" value="'+(w.speed||46)+'">')
        +row('Titel anzeigen','<input type="checkbox" id="pTkLead"'+(w.hideLead?'':' checked')+'>')
        +(w.hideLead?'':row('Anzahl-Badge','<input type="checkbox" id="pTkCount"'+(w.hideCount?'':' checked')+'>'))
        +'<div class="prop" style="margin-top:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:5px">Elemente — Typ wählen: Text · <b>Widget (Referenz)</b> = vorhandenes Widget per Name · oder inline-Widget. Widget-Zeilen laufen live mit.</div>'+rows+'<button class="btn" data-tkadd><svg class="i"><use href="#ic-plus"/></svg> Element</button></div>';
    },
    wire:function(w){
      if($('#pSpeed'))$('#pSpeed').oninput=function(){w.speed=parseInt(this.value)||46;render();};
      if($('#pTkLead'))$('#pTkLead').onchange=function(){w.hideLead=this.checked?undefined:true;render();renderProps();commit();};
      if($('#pTkCount'))$('#pTkCount').onchange=function(){w.hideCount=this.checked?undefined:true;render();commit();};
      $$('#props [data-tk]').forEach(function(inp){inp.oninput=inp.onchange=function(){
        var pr=inp.dataset.tk.split('.'),k=pr[0],i=+pr[1];if(!w.items||!w.items[i])return;
        if(k==='__type'){ // Typwechsel: Text / Referenz / inline-Widget
          var t=inp.value;
          if(t==='@ref'){w.items[i].ref='';delete w.items[i].wtype;}
          else if(t){w.items[i].wtype=t;delete w.items[i].ref;if(w.items[i].varId==null)w.items[i].varId=0;}
          else {delete w.items[i].wtype;delete w.items[i].ref;}
          render();renderProps();return;
        }
        var v=inp.value;
        if(k==='varId'||k==='vid'||k==='w')v=(v===''?undefined:(parseInt(v)||0));
        else if(k==='ref')v=v; // Name als String (leer erlaubt)
        else v=(v===''?undefined:v);
        w.items[i][k]=v;
        render();
      };});
      $$('#props [data-tkdel]').forEach(function(b){b.onclick=function(){var it=w.items[+b.dataset.tkdel];w.items.splice(+b.dataset.tkdel,1);
        if(it&&it.ref){var cnt=0;state.widgets.forEach(function(t){if(t.type==='ticker'&&t.items)t.items.forEach(function(m){if(m.ref===it.ref)cnt++;});});if(cnt===0){var tw=state.widgets.filter(function(x){return x.name===it.ref;})[0];if(tw&&tw.hidden)tw.hidden=undefined;}} // Referenz entfernt -> Widget wieder sichtbar
        render();renderProps();commit();};});
      var add=$('#props [data-tkadd]');if(add)add.onclick=function(){w.items=w.items||[];w.items.push({ref:''});render();renderProps();};
    }
  });
