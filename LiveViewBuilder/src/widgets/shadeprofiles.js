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

    function spField(k,spec,val){
      var t=spec.type||'int', id='sp_f_'+k, lbl=esc(spec.label||k);
      if(t==='bool')return row(lbl,'<input type="checkbox" data-spf="'+k+'"'+(val?' checked':'')+'>');
      if(t==='enum'){var o=(spec.options||[]).map(function(x){return '<option value="'+esc(x.value)+'"'+(String(val)===String(x.value)?' selected':'')+'>'+esc(x.label)+'</option>';}).join('');return row(lbl,'<select data-spf="'+k+'">'+o+'</select>');}
      if(t==='time')return row(lbl,'<input type="time" data-spf="'+k+'" value="'+esc(val||'')+'">');
      // int/float/objid -> Zahl
      var step=(t==='float')?'0.1':'1';
      return row(lbl,'<input type="number" step="'+step+'" data-spf="'+k+'" value="'+(val!=null?esc(val):'')+'" style="width:120px">');
    }

    function spRender(w){
      var st=spSt(w), doku=(typeof DOKU!=='undefined'&&DOKU);
      if(doku && !st.types){var d=spDemo();st.types=d.types;st.list=d.list;st.name=d.name;st.fields=d.fields;}
      if(!st.types)return '<div class="spf"><div class="spf-msg">Profile laden …</div></div>';
      if(st.err)return '<div class="spf"><div class="spf-msg">'+esc(st.err)+'</div></div>';
      var td=spTypeDef(st);
      var h='<div class="spf"><div class="spf-tabs">'+st.types.map(function(t){return '<button class="spf-tab'+(t.id===st.type?' on':'')+'" data-sptype="'+esc(t.id)+'">'+esc(t.title)+'</button>';}).join('')+'</div>';
      h+='<div class="spf-body"><div class="spf-list">';
      (st.list||[]).forEach(function(n){h+='<button class="spf-item'+(n===st.name?' on':'')+'" data-spname="'+esc(n)+'">'+esc(n)+'</button>';});
      if(!(st.list||[]).length)h+='<div class="spf-empty">Noch keine Profile</div>';
      h+='<button class="spf-new" data-spnew="1">+ Neues Profil</button></div>';
      // Editor
      h+='<div class="spf-edit">';
      if(st.name && st.fields && td){
        Object.keys(td.schema).forEach(function(k){h+=spField(k,td.schema[k],st.fields[k]);});
        h+='<div class="spf-btns"><button class="spf-save'+(st.dirty?' dirty':'')+'" data-spsave="1">Speichern</button>'
          +'<button data-spdup="1">Duplizieren</button><button data-sprename="1">Umbenennen</button><button class="spf-del" data-spdel="1">Löschen</button></div>';
        // Zuweisung
        var idx=spEntity(w), asg=(st.assigned&&st.assigned[st.type])||null;
        h+='<div class="spf-assign"><div class="pgh">Zuweisung</div>';
        if(idx){ h+='<div class="spf-arow">Zone-Profil ('+esc(td.title)+'): <b>'+esc(asg||'—')+'</b>'
          +' <button data-spassign="1"'+(asg===st.name?' disabled':'')+'>Diese Zone → '+esc(st.name)+'</button>'
          +(asg?' <button data-spunassign="1">entfernen</button>':'')+'</div>'; }
        else h+='<div class="spf-arow spf-msg">Keine Zone gebunden (Session/feste Zone in den Eigenschaften)</div>';
        h+='</div>';
      } else { h+='<div class="spf-msg">Profil links waehlen oder „+ Neues Profil".</div>'; }
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
