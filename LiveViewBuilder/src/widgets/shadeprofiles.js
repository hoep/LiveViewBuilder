  // ===== Widget: Beschattungs-Profile (shadeprofiles) — GETEILTE benannte Profile =====
  //
  //  Verwaltet die HomeSuite-Beschattungsprofile (Sonne/Wetter/Tagesbeginn/-ende/Temperatur)
  //  ueber den Hub (?api=mod&op=hubmanage -> ProfileEngine): Typ waehlen, Profil anlegen/
  //  bearbeiten/duplizieren/umbenennen/loeschen und einer Zone ZUWEISEN. Ersetzt die IPSShadowing-
  //  Profilverwaltung. Felder werden GENERISCH aus dem Typ-Schema gerendert.
  //  Zone fuer Zuweisung: Session (folgt der shadex-Familie) ODER feste Zone.

  (function(){
    var _sp={};
    function spSt(w){return _sp[w.id]||(_sp[w.id]={types:null,type:'sun',list:null,name:'',fields:null,dirty:false,err:'',assigned:null});}
    function spEntity(w){ if((w.bind!=='fixed')&&typeof hfSess==='function'){var s=hfSess({session:w.session||'shade'});return (s&&s.roomIdx)||0;} return parseInt(w.entityId||0)||0; }
    function spHub(op,args){ return fetch('?api=mod&op=hubmanage&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:op,args:args||{}})}).then(function(r){return r.json();}); }
    function spDemo(){return {types:[
        {id:'sun',title:'Sonnenprofil',schema:{azimuthBgn:{type:'int',label:'Azimut von (°)'},azimuthEnd:{type:'int',label:'Azimut bis (°)'},elevation:{type:'int',label:'Elevations-Schwelle (°)'},closePct:{type:'int',label:'Ziel-Position (%)'}}},
        {id:'weather',title:'Wetterschutz',schema:{windMaxKmh:{type:'int',label:'Wind max (km/h)'},rainClose:{type:'bool',label:'Bei Regen schützen'},safePos:{type:'int',label:'Sichere Position (%)'}}}
      ],list:['Süd-Fassade','Ost-Fassade'],name:'Süd-Fassade',fields:{azimuthBgn:135,azimuthEnd:270,elevation:10,closePct:80}};}

    function spTypeDef(st){return (st.types||[]).filter(function(t){return t.id===st.type;})[0]||null;}

    // Icons je Profiltyp (lucide-artig)
    var SP_IC={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
      weather:'<path d="M17.5 19a4.5 4.5 0 1 0 0-9 6 6 0 0 0-11.6 1.8A3.5 3.5 0 0 0 6.5 19z"/><path d="M8 21l-1 2M12 21l-1 2M16 21l-1 2"/>',
      dayBegin:'<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M12 9l3 3M12 9l-3 3"/>',
      dayEnd:'<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M9 6l3 3 3-3"/>',
      temp:'<path d="M14 14.76V5a2 2 0 1 0-4 0v9.76a4 4 0 1 0 4 0z"/>'};
    function spIcon(id,sz){return '<svg viewBox="0 0 24 24" width="'+(sz||16)+'" height="'+(sz||16)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(SP_IC[id]||SP_IC.sun)+'</svg>';}
    var SP_INP='height:34px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);padding:0 10px;font-family:var(--fm);font-size:13px;width:100%;box-sizing:border-box';

    function spField(k,spec,val){
      var t=spec.type||'int', lbl=esc(spec.label||k);
      var wrap=function(inner){return '<label style="display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--muted)"><span>'+lbl+'</span>'+inner+'</label>';};
      if(t==='bool')return wrap('<label style="display:inline-flex;align-items:center;gap:8px;height:34px;cursor:pointer"><input type="checkbox" data-spf="'+k+'"'+(val?' checked':'')+' style="width:18px;height:18px;accent-color:var(--accent)"><span style="color:var(--text);font-size:13px">'+(val?'an':'aus')+'</span></label>');
      if(t==='enum'){var o=(spec.options||[]).map(function(x){return '<option value="'+esc(x.value)+'"'+(String(val)===String(x.value)?' selected':'')+'>'+esc(x.label)+'</option>';}).join('');return wrap('<select data-spf="'+k+'" style="'+SP_INP+'">'+o+'</select>');}
      if(t==='time')return wrap('<input type="time" data-spf="'+k+'" value="'+esc(val||'')+'" style="'+SP_INP+'">');
      var step=(t==='float')?'0.1':'1';
      return wrap('<input type="number" step="'+step+'" data-spf="'+k+'" value="'+(val!=null?esc(val):'')+'" style="'+SP_INP+'">');
    }

    function spRender(w){
      var st=spSt(w), doku=(typeof DOKU!=='undefined'&&DOKU);
      if(doku && !st.types){var d=spDemo();st.types=d.types;st.list=d.list;st.name=d.name;st.fields=d.fields;}
      var box='position:absolute;inset:0;background:var(--surface);display:flex;flex-direction:column;box-sizing:border-box';
      var msg=function(t){return '<div style="'+box+';align-items:center;justify-content:center;color:var(--muted);font-size:13px">'+esc(t)+'</div>';};
      if(!st.types)return msg('Profile laden …');
      if(st.err)return msg(st.err);
      var td=spTypeDef(st);
      // Typ-Reiter (Unterstrich-Tabs)
      var tabs=st.types.map(function(t){var on=t.id===st.type;
        return '<button data-sptype="'+esc(t.id)+'" style="display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:0;background:none;cursor:pointer;white-space:nowrap;font-size:12.5px;font-weight:600;color:'+(on?'var(--text)':'var(--muted)')+';border-bottom:2px solid '+(on?'var(--accent)':'transparent')+'">'+spIcon(t.id,15)+esc(t.title)+'</button>';}).join('');
      var h='<div style="'+box+'"><div style="display:flex;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:0 8px;flex:none">'+tabs+'</div>'
        +'<div style="flex:1;display:flex;min-height:0">';
      // Linke Spalte: Profil-Karten
      h+='<div style="width:240px;flex:none;border-right:1px solid var(--line);overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px">'
        +'<div style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint)">'+esc(td?td.title:'Profile')+'</div>';
      (st.list||[]).forEach(function(n){var on=n===st.name;
        h+='<button data-spname="'+esc(n)+'" style="display:flex;align-items:center;gap:9px;text-align:left;border:1px solid '+(on?'var(--accent)':'var(--line)')+';border-radius:var(--r-s,9px);background:'+(on?'color-mix(in oklab,var(--accent) 12%,transparent)':'var(--tile)')+';color:var(--text);padding:9px 11px;cursor:pointer;font-size:13px;font-weight:600">'
          +'<span style="color:'+(on?'var(--accent)':'var(--faint)')+'">'+spIcon(st.type,15)+'</span>'+esc(n)+'</button>';});
      if(!(st.list||[]).length)h+='<div style="color:var(--muted);font-size:12px;padding:4px 2px">Noch keine Profile</div>';
      h+='<button data-spnew="1" style="margin-top:2px;border:1px dashed var(--accent);border-radius:var(--r-s,9px);background:none;color:var(--accent);padding:9px;cursor:pointer;font-size:13px;font-weight:600">+ Neues Profil</button></div>';
      // Rechte Spalte: Editor
      h+='<div style="flex:1;min-width:0;overflow:auto;padding:16px">';
      if(st.name && st.fields && td){
        h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><span style="width:34px;height:34px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;background:color-mix(in oklab,var(--accent) 14%,transparent);color:var(--accent)">'+spIcon(st.type,18)+'</span>'
          +'<div style="min-width:0"><div style="font-size:17px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(st.name)+'</div>'
          +'<div style="font-size:11px;color:var(--muted)">'+esc(td.title)+'</div></div></div>';
        h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;max-width:520px">';
        Object.keys(td.schema).forEach(function(k){h+=spField(k,td.schema[k],st.fields[k]);});
        h+='</div>';
        var gbtn='border:1px solid var(--line);border-radius:8px;background:var(--tile);color:var(--text);padding:8px 14px;cursor:pointer;font-size:12.5px';
        h+='<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px">'
          +'<button data-spsave="1" style="border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;padding:8px 16px;cursor:pointer;font-size:12.5px;font-weight:600">Speichern</button>'
          +'<button data-spdup="1" style="'+gbtn+'">Duplizieren</button><button data-sprename="1" style="'+gbtn+'">Umbenennen</button>'
          +'<button data-spdel="1" style="border:1px solid color-mix(in oklab,var(--crit) 45%,var(--line));border-radius:8px;background:none;color:var(--crit);padding:8px 14px;cursor:pointer;font-size:12.5px">Löschen</button></div>';
        // Zuweisung
        var idx=spEntity(w), asg=(st.assigned&&st.assigned[st.type])||null;
        h+='<div style="margin-top:18px;border-top:1px solid var(--line-soft);padding-top:12px">'
          +'<div style="font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint);margin-bottom:8px">Zuweisung</div>';
        if(idx){ h+='<div style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:13px">Zone-Profil: <b style="color:var(--text)">'+esc(asg||'—')+'</b>'
          +'<button data-spassign="1"'+(asg===st.name?' disabled':'')+' style="border:1px solid var(--accent);border-radius:999px;background:'+(asg===st.name?'var(--surface-2)':'color-mix(in oklab,var(--accent) 14%,transparent)')+';color:'+(asg===st.name?'var(--muted)':'var(--accent)')+';padding:6px 13px;cursor:pointer;font-size:12px;font-weight:600">Diese Zone → '+esc(st.name)+'</button>'
          +(asg?'<button data-spunassign="1" style="'+gbtn+'">entfernen</button>':'')+'</div>'; }
        else h+='<div style="color:var(--muted);font-size:12px">Keine Zone gebunden (Session/feste Zone in den Eigenschaften)</div>';
        h+='</div>';
      } else {
        h+='<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--muted);text-align:center">'
          +'<span style="color:var(--faint)">'+spIcon(st.type,40)+'</span><div style="font-size:14px">'+esc(td?td.title:'Profil')+' wählen oder anlegen</div>'
          +'<div style="font-size:12px;color:var(--faint)">Links ein Profil antippen oder „+ Neues Profil"</div></div>';
      }
      h+='</div></div></div>';
      return h;
    }
    function spEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function spPaint(w){var el=spEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=spRender(w);spBind(w,el);}

    function spLoadList(w,keepName){var st=spSt(w);if(typeof DOKU!=='undefined'&&DOKU){spPaint(w);return;}
      spHub('profileList',{type:st.type}).then(function(j){st.list=(j&&j.profiles)||[];if(!keepName){st.name='';st.fields=null;}
        var idx=spEntity(w); if(idx){spHub('profileAssigned',{entityId:idx}).then(function(a){st.assigned=(a&&a.assigned)||null;spPaint(w);});} else spPaint(w);
      }).catch(function(){st.err='Hub nicht erreichbar';spPaint(w);});}
    function spLoadProfile(w,name){var st=spSt(w);st.name=name;
      spHub('profileGet',{type:st.type,name:name}).then(function(j){st.fields=(j&&j.fields)||{};st.dirty=false;spPaint(w);}).catch(function(){st.err='Profil nicht lesbar';spPaint(w);});}

    function spBind(w,el){var st=spSt(w);if(typeof DOKU!=='undefined'&&DOKU)return;
      $$('[data-sptype]',el).forEach(function(b){b.onclick=function(){st.type=b.getAttribute('data-sptype');st.name='';st.fields=null;spLoadList(w);};});
      $$('[data-spname]',el).forEach(function(b){b.onclick=function(){spLoadProfile(w,b.getAttribute('data-spname'));};});
      $$('[data-spf]',el).forEach(function(inp){inp.onchange=function(){if(!st.fields)st.fields={};var k=inp.getAttribute('data-spf');st.fields[k]=(inp.type==='checkbox')?inp.checked:(inp.type==='number'?(inp.value===''?null:+inp.value):inp.value);st.dirty=true;var sv=$('[data-spsave]',el);if(sv)sv.classList.add('dirty');};});
      var nw=$('[data-spnew]',el);if(nw)nw.onclick=function(){var n=prompt('Name des neuen Profils:');if(!n)return;spHub('profileCreate',{type:st.type,name:n,fields:{}}).then(function(j){if(j&&j.ok){st.dirty=false;spLoadList(w,false);setTimeout(function(){spLoadProfile(w,n);},60);}else toast('Anlegen fehlgeschlagen'+(j&&j.error?': '+j.error:''));});};
      var sv=$('[data-spsave]',el);if(sv)sv.onclick=function(){spHub('profileSetFields',{type:st.type,name:st.name,fields:st.fields||{}}).then(function(j){toast(j&&j.ok?'Gespeichert (Zonen aktualisiert)':'Speichern fehlgeschlagen'+(j&&j.error?': '+j.error:''));if(j&&j.ok)st.dirty=false;spPaint(w);});};
      var du=$('[data-spdup]',el);if(du)du.onclick=function(){var n=prompt('Neuer Name (Kopie von '+st.name+'):');if(!n)return;spHub('profileDuplicate',{type:st.type,name:st.name,newName:n}).then(function(){spLoadList(w,false);setTimeout(function(){spLoadProfile(w,n);},60);});};
      var rn=$('[data-sprename]',el);if(rn)rn.onclick=function(){var n=prompt('Neuer Name:',st.name);if(!n||n===st.name)return;spHub('profileRename',{type:st.type,name:st.name,newName:n}).then(function(){spLoadList(w,false);setTimeout(function(){spLoadProfile(w,n);},60);});};
      var dl=$('[data-spdel]',el);if(dl)dl.onclick=function(){if(!confirm('Profil „'+st.name+'" löschen?'))return;spHub('profileDelete',{type:st.type,name:st.name}).then(function(){st.name='';st.fields=null;spLoadList(w,false);});};
      var as=$('[data-spassign]',el);if(as)as.onclick=function(){var idx=spEntity(w);if(!idx)return;spHub('profileAssign',{entityId:idx,type:st.type,name:st.name}).then(function(j){toast(j&&j.ok?'Zugewiesen':'Zuweisen fehlgeschlagen');spLoadList(w,true);});};
      var un=$('[data-spunassign]',el);if(un)un.onclick=function(){var idx=spEntity(w);if(!idx)return;spHub('profileAssign',{entityId:idx,type:st.type,name:''}).then(function(){toast('Zuweisung entfernt');spLoadList(w,true);});};
    }

    defWidget('shadeprofiles',{
      label:'Beschattungs-Profile', paletteIcon:'sun', size:[560,420],
      defaults:function(w){w.bind='session';w.session='shade';},
      render:function(w){return spRender(w);},
      mount:function(w){var el=spEl(w);if(!el)return;var st=spSt(w);
        if(typeof DOKU!=='undefined'&&DOKU){spPaint(w);return;}
        if(!st.types){spHub('profileTypes',{}).then(function(j){st.types=(j&&j.types)||[];if(st.types[0])st.type=st.types[0].id;spLoadList(w);}).catch(function(){st.err='Hub nicht erreichbar';spPaint(w);});}
        else spBind(w,el);},
      props:function(w){var h='<div class="pgh">Bindung</div>';
        h+=row('Zone','<select id="spBind"><option value="session"'+(w.bind!=='fixed'?' selected':'')+'>Session (folgt Auswahl)</option><option value="fixed"'+(w.bind==='fixed'?' selected':'')+'>Feste Zone</option></select>');
        if(w.bind!=='fixed')h+=row('Session-ID','<input id="spSess" value="'+esc(w.session||'shade')+'" placeholder="shade">');
        else h+=row('Zone (Instanz-ID)','<input id="spEnt" type="number" value="'+(w.entityId||'')+'">');
        return h;},
      wire:function(w){
        if($('#spBind'))$('#spBind').onchange=function(){w.bind=this.value;commit();renderProps();};
        if($('#spSess'))$('#spSess').onchange=function(){w.session=this.value||undefined;commit();};
        if($('#spEnt'))$('#spEnt').onchange=function(){w.entityId=parseInt(this.value)||undefined;commit();};
      }
    });
  })();
