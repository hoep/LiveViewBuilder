  // ===== Widget: battlist — Batterie-Übersicht aus dem BatteryManager-Register =====
  // Quelle: eine String-Variable (w.varId), in die der BatteryManager ein JSON schreibt:
  //   {ts,ver,counts:{total,ok,warn,empty,unknown,weak},devices:[{name,room,system,
  //    state('ok'|'warn'|'empty'|'unknown'),type('pct'|'bool'|'volt'|'enum'),value,unit,text,varId,low,ts}]}
  // Ansicht: Kopf mit drei Tipp-Filter-Chips (Ok / Bald / Leer) + Zählern, darunter die Liste.
  // Standard: nur schwache (warn+empty), am schlimmsten zuerst. w.showOk hängt die guten (grau)
  // an. Chip-Filter wird je Gerät (RUN) im localStorage gemerkt — analog msglog.
  var _BATT_CLR={empty:'--crit',warn:'--warn',ok:'--ok',unknown:'--muted'};
  var _BATT_RANK={empty:0,warn:1,ok:2,unknown:3};

  function _battParse(w){ // Register aus dem Live-Wert lesen (JSON, schnell) — wie table.js
    if(!w.varId)return null;
    var lv=_lastVals[w.varId];
    if(!lv||typeof lv.v!=='string')return null;
    var s=lv.v.trim();
    if(!s||s[0]!=='{')return null;
    try{var j=JSON.parse(s);if(j&&j.devices&&j.devices.length!=null)return j;}catch(e){}
    return null;
  }
  // Kollisions-sichere Elementsuche (Seite vs. Popup): ALLE Elemente dieser ID sammeln,
  // ovcanvas (aktiver Kontext) zuerst, und das nehmen, das wirklich [data-role=battroot] enthält.
  function _battRoot(w){
    var cands=[],oc=document.getElementById('ovcanvas');
    if(oc)cands=cands.concat([].slice.call(oc.querySelectorAll('.w[data-id="'+w.id+'"]')));
    cands=cands.concat([].slice.call(canvas.querySelectorAll('.w[data-id="'+w.id+'"]')));
    for(var i=0;i<cands.length;i++){var r=cands[i].querySelector('[data-role=battroot]');if(r)return r;}
    return null;
  }
  function _battFilter(w){ // welche Zustände sichtbar sind (RUN: je Gerät gemerkt)
    var def={ok:(w.showOk?1:0),warn:1,empty:1};
    if(typeof RUN!=='undefined'&&RUN){try{var o=localStorage.getItem('lvbatt_'+w.id);if(o){var j=JSON.parse(o);if(j)return {ok:j.ok?1:0,warn:j.warn?1:0,empty:j.empty?1:0};}}catch(e){}}
    return def;
  }
  function _battNum(d){var v=(d&&d.value!=null)?parseFloat(d.value):NaN;return isNaN(v)?Infinity:v;}
  function _battValTxt(d){ // Anzeige rechts: bevorzugt fertiger Text, sonst Wert (+Einheit)
    if(d.text!=null&&d.text!=='')return String(d.text);
    if(d.value==null||d.value==='')return '–';
    var u=(d.unit!=null&&d.unit!=='')?(' '+d.unit):'';
    return String(d.value)+u;
  }
  function _battChip(key,lbl,clr,n,on){
    return '<span class="bchip'+(on?'':' off')+'" data-battchip="'+key+'" style="--bc:var('+clr+')"><span class="bdot"></span>'+lbl+'<span class="bcn">'+(n||0)+'</span></span>';
  }
  function _battDraw(w){
    var root=_battRoot(w);if(!root)return;
    var reg=_battParse(w),f=_battFilter(w);
    var c=(reg&&reg.counts)||{},devs=(reg&&reg.devices)||[];
    var nEmpty=c.empty||0,nWarn=c.warn||0,nOk=c.ok||0;
    // Zustände nach Chip-Filter; 'unknown' hat keinen Chip und wird immer (grau) angehängt.
    var vis=devs.filter(function(d){var st=d&&d.state;if(st==='unknown')return true;return !!f[st];});
    vis.sort(function(a,b){var ra=(_BATT_RANK[a.state]!=null?_BATT_RANK[a.state]:9),rb=(_BATT_RANK[b.state]!=null?_BATT_RANK[b.state]:9);
      if(ra!==rb)return ra-rb;return _battNum(a)-_battNum(b);}); // am schlimmsten zuerst, dann Wert aufsteigend
    var max=(w.max>0?w.max:60),shown=vis.slice(0,max);
    // Kopf-Tönung: leere Batterien -> crit, sonst schwache -> warn
    var tint=nEmpty>0?' tint-crit':(nWarn>0?' tint-warn':'');
    var head='<div class="bhead'+tint+'" data-role="batthead"><span class="btitle">'+escL(w.label||'Batterien')+'</span>'
      +'<span class="bchips">'
      +_battChip('ok','Ok','--ok',nOk,f.ok)
      +_battChip('warn','Bald','--warn',nWarn,f.warn)
      +_battChip('empty','Leer','--crit',nEmpty,f.empty)
      +'</span></div>';
    var body;
    if(!w.varId){body='<div class="bempty">Batterie-Register (JSON) wählen</div>';}
    else if(!reg){body='<div class="bempty">Keine Register-Daten</div>';}
    else if(!shown.length){body='<div class="bempty">Alles gut — keine schwachen Batterien</div>';}
    else{
      body=shown.map(function(d){
        var st=d.state||'unknown',clr=_BATT_CLR[st]||'--muted';
        var sys=(d.system!=null&&d.system!=='')?String(d.system):'';
        var nm='<span class="bnn">'+esc(d.name||'')+'</span>';
        var rm=(d.room!=null&&d.room!=='')?('<small>'+esc(d.room)+'</small>'):'';
        return '<div class="brow st-'+esc(st)+'"'+(d.varId?' data-vid="'+d.varId+'"':'')+'>'
          +(sys?'<span class="bsys">'+esc(sys)+'</span>':'<span class="bsys bsys-x"></span>')
          +'<span class="bnm">'+nm+rm+'</span>'
          +'<span class="bval" style="color:var('+clr+')">'+esc(_battValTxt(d))+'</span>'
        +'</div>';
      }).join('');
    }
    // Signatur zum Überspringen unnötiger Neuzeichnungen (Filter + Kopf + sichtbare Werte)
    var sig=(w.varId||'')+'|'+f.ok+f.warn+f.empty+'|'+nOk+'/'+nWarn+'/'+nEmpty+'|'+shown.map(function(d){return (d.varId||'')+':'+d.state+':'+(d.text!=null&&d.text!==''?d.text:d.value);}).join('~');
    if(root._battSig===sig)return;
    var lst=root.querySelector('[data-role=battbody]'),keep=lst?lst.scrollTop:0;
    root._battSig=sig;
    root.innerHTML=head+'<div class="bbody" data-role="battbody">'+body+'</div>';
    var nl=root.querySelector('[data-role=battbody]');if(nl)nl.scrollTop=keep;
  }
  var _battT={};
  defWidget('battlist',{
    label:'Batterie-Übersicht', paletteIcon:'battery', size:[300,220], noHover:true,
    defaults:function(w){w.label='Batterien';w.max=60;},
    render:function(w){
      var fv='';
      if(w.titleFs>0)fv+='--bt-tfs:'+parseFloat(w.titleFs)+'px;';
      if(w.rowFs>0)fv+='--bt-rfs:'+parseFloat(w.rowFs)+'px;';
      return '<div class="hbatt" data-role="battroot"'+(fv?' style="'+fv+'"':'')+'><div class="bempty">…</div></div>';
    },
    mount:function(w){_battDraw(w);},
    props:function(w){return fieldPick(w,'varId','Batterie-Register (JSON)')
      +'<div style="font-size:11px;color:var(--muted);line-height:1.4;margin:-2px 2px 7px">String-Variable des BatteryManager (JSON mit <b>counts</b> und <b>devices</b>). Standard: nur schwache Batterien, am schlimmsten zuerst.</div>'
      +row('Titel','<input id="pBattLbl" value="'+esc(w.label||'')+'" placeholder="Batterien">')
      +row('Gute anzeigen','<input type="checkbox" id="pBattOk"'+(w.showOk?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">volle Batterien (grau) unten anhängen</span>')
      +row('Max. Einträge','<input id="pBattMax" type="number" min="1" max="500" value="'+(w.max||60)+'">')
      +'<div class="pgh">Schrift (px, leer = automatisch)</div>'
      +row('Titel','<input id="pBattTFs" type="number" min="0" value="'+(w.titleFs||'')+'" placeholder="auto">')
      +row('Zeilen','<input id="pBattRFs" type="number" min="0" value="'+(w.rowFs||'')+'" placeholder="auto">')
      +'<div class="hint" style="font-size:11px;color:var(--muted)">Im Live-Modus per Tipp auf die Chips (Ok / Bald / Leer) filterbar — je Gerät gespeichert.</div>';},
    wire:function(w){
      if($('#pBattLbl'))$('#pBattLbl').oninput=function(){w.label=this.value||undefined;_battDraw(w);commit();};
      if($('#pBattOk'))$('#pBattOk').onchange=function(){w.showOk=this.checked||undefined;try{localStorage.removeItem('lvbatt_'+w.id);}catch(_){}var r=_battRoot(w);if(r)r._battSig=undefined;_battDraw(w);commit();};
      if($('#pBattMax'))$('#pBattMax').oninput=function(){w.max=Math.min(500,Math.max(1,parseInt(this.value)||60));var r=_battRoot(w);if(r)r._battSig=undefined;_battDraw(w);commit();};
      if($('#pBattTFs'))$('#pBattTFs').oninput=function(){w.titleFs=parseInt(this.value)||undefined;render();commit();};
      if($('#pBattRFs'))$('#pBattRFs').oninput=function(){w.rowFs=parseInt(this.value)||undefined;render();commit();};
    },
    click:function(w,el,e){
      var chip=e.target.closest('[data-battchip]');if(!chip)return false;
      var k=chip.getAttribute('data-battchip'),f=_battFilter(w);f[k]=f[k]?0:1;
      try{localStorage.setItem('lvbatt_'+w.id,JSON.stringify(f));}catch(_){}
      var r=_battRoot(w);if(r)r._battSig=undefined;_battDraw(w);return true;
    },
    live:function(w,el,id,d,base,txt,on){if(w.varId===id){if(_battT[w.id])clearTimeout(_battT[w.id]);_battT[w.id]=setTimeout(function(){_battDraw(w);},250);}}
  });
