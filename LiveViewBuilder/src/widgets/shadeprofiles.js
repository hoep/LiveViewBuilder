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
    // sz wird 1:1 als width/height-Attribut gesetzt — an den Aufrufstellen '100%', damit die
    // tatsaechliche Groesse ueber den umgebenden, per clamp/cqmin bemessenen <span> kommt.
    function spIcon(id,sz){return '<svg viewBox="0 0 24 24" width="'+(sz||16)+'" height="'+(sz||16)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(SP_IC[id]||SP_IC.sun)+'</svg>';}
    // Icon-Huelle: feste Kantenlaenge aus der Kachel, damit das 100%-SVG eine Bezugsgroesse hat.
    function spIcoBox(id,size){return '<span style="display:inline-flex;flex:none;align-items:center;justify-content:center;width:'+size+';height:'+size+'">'+spIcon(id,'100%')+'</span>';}
    var SP_INP='height:clamp(30px,9cqmin,40px);border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--text);padding:0 clamp(7px,2.6cqmin,12px);font-family:var(--fm);font-size:clamp(11px,3.4cqmin,14px);width:100%;box-sizing:border-box';
    var SP_BTN='padding:clamp(6px,2.4cqmin,11px) clamp(8px,3.4cqmin,15px);min-height:clamp(26px,8cqmin,38px);font-size:clamp(10px,3.2cqmin,13px)'; // Tippziel bleibt >=26px

    function spField(k,spec,val){
      var t=spec.type||'int', lbl=esc(spec.label||k);
      var wrap=function(inner){return '<label style="display:flex;flex-direction:column;gap:clamp(3px,1.6cqmin,6px);font-size:clamp(9px,2.8cqmin,12px);color:var(--muted)"><span>'+lbl+'</span>'+inner+'</label>';};
      if(t==='bool')return wrap('<label style="display:inline-flex;align-items:center;gap:clamp(5px,2.4cqmin,10px);height:clamp(30px,9cqmin,40px);cursor:pointer"><input type="checkbox" data-spf="'+k+'"'+(val?' checked':'')+' style="width:clamp(16px,5cqmin,22px);height:clamp(16px,5cqmin,22px);accent-color:var(--accent)"><span style="color:var(--text);font-size:clamp(11px,3.4cqmin,14px)">'+(val?'an':'aus')+'</span></label>');
      if(t==='enum'){var o=(spec.options||[]).map(function(x){return '<option value="'+esc(x.value)+'"'+(String(val)===String(x.value)?' selected':'')+'>'+esc(x.label)+'</option>';}).join('');return wrap('<select data-spf="'+k+'" style="'+SP_INP+'">'+o+'</select>');}
      if(t==='time')return wrap('<input type="time" data-spf="'+k+'" value="'+esc(val||'')+'" style="'+SP_INP+'">');
      var step=(t==='float')?'0.1':'1';
      return wrap('<input type="number" step="'+step+'" data-spf="'+k+'" value="'+(val!=null?esc(val):'')+'" style="'+SP_INP+'">');
    }

    function spRender(w){
      var st=spSt(w), doku=(typeof DOKU!=='undefined'&&DOKU);
      if(doku && !st.types){var d=spDemo();st.types=d.types;st.list=d.list;st.name=d.name;st.fields=d.fields;}
      var box='position:absolute;inset:0;background:var(--surface);display:flex;flex-direction:column;box-sizing:border-box';
      var msg=function(t){return '<div style="'+box+';align-items:center;justify-content:center;color:var(--muted);font-size:clamp(11px,3.4cqmin,14px)">'+esc(t)+'</div>';};
      if(!st.types)return msg('Profile laden …');
      if(st.err)return msg(st.err);
      var td=spTypeDef(st);
      var asg=(st.assigned&&st.assigned[st.type])||null; // dieser Zone zugewiesenes Profil des aktuellen Typs
      // Typ-Reiter (Unterstrich-Tabs)
      var ICO_ROW='clamp(12px,4cqmin,18px)'; // Icon-Kantenlaenge in Zeilen/Tabs
      var tabs=st.types.map(function(t){var on=t.id===st.type;
        return '<button data-sptype="'+esc(t.id)+'" style="display:inline-flex;align-items:center;gap:clamp(4px,2cqmin,8px);'+SP_BTN+';border:0;background:none;cursor:pointer;white-space:nowrap;font-weight:600;color:'+(on?'var(--text)':'var(--muted)')+';border-bottom:2px solid '+(on?'var(--accent)':'transparent')+'">'+spIcoBox(t.id,ICO_ROW)+esc(t.title)+'</button>';}).join('');
      var h='<div style="'+box+'"><div style="display:flex;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:0 clamp(4px,2.4cqmin,10px);flex:none">'+tabs+'</div>'
        +'<div style="flex:1;display:flex;min-height:0">';
      // Linke Spalte: Profil-Karten — Breite folgt der Kachelbreite (cqi), bleibt aber lesbar
      h+='<div style="width:clamp(140px,30cqi,240px);flex:none;border-right:1px solid var(--line);overflow:auto;padding:clamp(7px,3.2cqmin,14px);display:flex;flex-direction:column;gap:clamp(5px,2.4cqmin,10px)">'
        +'<div style="font-size:clamp(8px,2.2cqmin,10px);letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint)">'+esc(td?td.title:'Profile')+'</div>';
      (st.list||[]).forEach(function(n){var on=n===st.name, mine=(n===asg);
        h+='<button data-spname="'+esc(n)+'" style="display:flex;align-items:center;gap:clamp(5px,2.4cqmin,10px);text-align:left;border:1px solid '+(on?'var(--accent)':(mine?'color-mix(in oklab,var(--accent) 45%,var(--line))':'var(--line)'))+';border-radius:var(--r-s,9px);background:'+(on?'color-mix(in oklab,var(--accent) 12%,transparent)':'var(--tile)')+';color:var(--text);'+SP_BTN+';cursor:pointer;font-weight:600">'
          +'<span style="display:inline-flex;flex:none;color:'+(on||mine?'var(--accent)':'var(--faint)')+'">'+spIcoBox(st.type,ICO_ROW)+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+esc(n)+'</span>'
          +(mine?'<span style="flex:none;font-size:clamp(8px,2.2cqmin,10px);font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#fff;background:var(--accent-2);border-radius:999px;padding:clamp(1px,.8cqmin,3px) clamp(5px,2cqmin,9px)">Rollo</span>':'')+'</button>';});
      if(!(st.list||[]).length)h+='<div style="color:var(--muted);font-size:clamp(9px,3cqmin,12px);padding:clamp(3px,1.4cqmin,6px) 2px">Noch keine Profile</div>';
      h+='<button data-spnew="1" style="margin-top:2px;border:1px dashed var(--accent);border-radius:var(--r-s,9px);background:none;color:var(--accent);'+SP_BTN+';cursor:pointer;font-weight:600">+ Neues Profil</button></div>';
      // Rechte Spalte: Editor (scrollt selbst, die Kachel bleibt waagrecht ruhig)
      h+='<div style="flex:1;min-width:0;overflow:auto;padding:clamp(9px,4cqmin,18px)">';
      if(st.name && st.fields && td){
        h+='<div style="display:flex;align-items:center;gap:clamp(6px,3cqmin,12px);margin-bottom:clamp(8px,3.6cqmin,16px)"><span style="width:clamp(24px,9cqmin,38px);height:clamp(24px,9cqmin,38px);border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;background:color-mix(in oklab,var(--accent) 14%,transparent);color:var(--accent)">'+spIcoBox(st.type,'clamp(13px,4.8cqmin,20px)')+'</span>'
          +'<div style="min-width:0"><div style="font-size:clamp(13px,5cqmin,20px);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(st.name)+'</div>'
          +'<div style="font-size:clamp(9px,2.8cqmin,12px);color:var(--muted)">'+esc(td.title)+'</div></div></div>';
        // Feldraster bricht selbst um (auto-fit) statt starrer Zweispaltigkeit
        h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(clamp(120px,26cqi,190px),1fr));gap:clamp(8px,3cqmin,14px) clamp(10px,4cqmin,18px);max-width:min(520px,100%)">';
        Object.keys(td.schema).forEach(function(k){h+=spField(k,td.schema[k],st.fields[k]);});
        h+='</div>';
        var gbtn='border:1px solid var(--line);border-radius:8px;background:var(--tile);color:var(--text);'+SP_BTN+';cursor:pointer';
        h+='<div style="display:flex;flex-wrap:wrap;gap:clamp(5px,2.4cqmin,10px);margin-top:clamp(9px,4cqmin,18px)">'
          +'<button data-spsave="1" style="border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;padding:clamp(6px,2.4cqmin,11px) clamp(10px,4cqmin,18px);min-height:clamp(26px,8cqmin,38px);cursor:pointer;font-size:clamp(10px,3.2cqmin,13px);font-weight:600">Speichern</button>'
          +'<button data-spdup="1" style="'+gbtn+'">Duplizieren</button><button data-sprename="1" style="'+gbtn+'">Umbenennen</button>'
          +'<button data-spdel="1" style="border:1px solid color-mix(in oklab,var(--crit) 45%,var(--line));border-radius:8px;background:none;color:var(--crit);'+SP_BTN+';cursor:pointer">Löschen</button></div>';
        // Zuweisung
        var idx=spEntity(w);
        h+='<div style="margin-top:clamp(10px,4.5cqmin,20px);border-top:1px solid var(--line-soft);padding-top:clamp(7px,3cqmin,14px)">'
          +'<div style="font-size:clamp(8px,2.2cqmin,10px);letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint);margin-bottom:clamp(5px,2.4cqmin,10px)">Zuweisung</div>';
        if(idx){ h+='<div style="display:flex;align-items:center;flex-wrap:wrap;gap:clamp(6px,3cqmin,12px);font-size:clamp(10px,3.2cqmin,13px)">Rollo-Profil: <b style="color:var(--text)">'+esc(asg||'—')+'</b>'
          +'<button data-spassign="1"'+(asg===st.name?' disabled':'')+' style="border:1px solid var(--accent);border-radius:999px;background:'+(asg===st.name?'var(--surface-2)':'color-mix(in oklab,var(--accent) 14%,transparent)')+';color:'+(asg===st.name?'var(--muted)':'var(--accent)')+';padding:clamp(4px,2cqmin,8px) clamp(8px,3.4cqmin,15px);min-height:clamp(24px,7.5cqmin,34px);cursor:pointer;font-size:clamp(10px,3cqmin,12px);font-weight:600">Dieses Rollo → '+esc(st.name)+'</button>'
          +(asg?'<button data-spunassign="1" style="'+gbtn+'">entfernen</button>':'')+'</div>';
        }
        else h+='<div style="color:var(--muted);font-size:clamp(9px,3cqmin,12px)">Kein Rollo gebunden (Session/festes Rollo in den Eigenschaften)</div>';
        h+='</div>';
      } else {
        h+='<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(6px,3cqmin,12px);color:var(--muted);text-align:center">'
          +'<span style="color:var(--faint)">'+spIcoBox(st.type,'clamp(28px,14cqmin,56px)')+'</span><div style="font-size:clamp(11px,3.8cqmin,15px)">'+esc(td?td.title:'Profil')+' wählen oder anlegen</div>'
          +'<div style="font-size:clamp(9px,3cqmin,12px);color:var(--faint)">Links ein Profil antippen oder „+ Neues Profil"</div></div>';
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
      label:'Beschattungs-Profile', cat:'HomeSuite · Beschattung', paletteIcon:'sun', size:[560,420],
      defaults:function(w){w.bind='session';w.session='shade';},
      render:function(w){return spRender(w);},
      // hfEmit() zeichnet bei einem Auswahlwechsel ueber render + _bind neu. Ohne _bind kaeme
      // zwar frisches HTML, aber die Zuweisung des NEUEN Rollos wuerde nie geholt - die Liste
      // haette weiter die des alten angezeigt. Deshalb hier die Zuweisung nachladen.
      _bind:function(w,el){var st=spSt(w);var idx=spEntity(w);
        if(idx){spHub('profileAssigned',{entityId:idx}).then(function(a){st.assigned=(a&&a.assigned)||null;spPaint(w);});}
        spBind(w,el);},
      mount:function(w){var el=spEl(w);if(!el)return;var st=spSt(w);
        // An die Session KOPPELN. Ohne hfSub() steht das Widget nicht in der Abonnentenliste,
        // die der Raum-Selektor beim Wechsel per hfEmit() neu zeichnet - es blieb auf dem
        // Rollo stehen, das beim Laden der Seite gerade ausgewaehlt war, und folgte der
        // Auswahl nie. suncompass, shadesun und shadecal machen es genauso.
        if(w.bind!=='fixed' && typeof hfSub==='function')hfSub(w);
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
