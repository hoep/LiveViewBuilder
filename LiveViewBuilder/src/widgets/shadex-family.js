  // ===== Widget-Familie: Beschattungs-Zone (shadedoors / shadesens / shadearm) =====
  //
  //  Drei kleine Kacheln fuer die Zonen-Einstellungen, die es bisher NUR in der Symcon-
  //  Konsole gab. Bewusst getrennt und klein, damit man sie frei neben Kalibrierung
  //  (shadecal), Besonnung (shadesun) und Profilen (shadeprofiles) legen kann.
  //
  //  BEWUSST NICHT hier drin, weil es das schon gibt — nicht doppelt anbieten:
  //    Sonnen-Schliessgrad  -> shadesun ("Besonnung", Slider + Presets)
  //    Profilwahl/-abwahl   -> shadeprofiles ("Beschattungs-Profile", Zuweisen/entfernen)
  //
  //  Bindung wie shadecal/shadesun: SESSION (folgt der Rollo-Auswahl der shadex-Familie)
  //  ODER feste Zone. Backend: ?api=shading&op=zonecfg (frei lesen, aufgeloest inkl. Name +
  //  Live-Wert), Schreiben ueber ?api=mod&op=manage (Token) bzw. ?api=shading&op=setenv.

  (function(){
    var _sx = {};
    function sxSt(w){return _sx[w.id]||(_sx[w.id]={d:null,err:'',busy:false,adding:false,cts:null});}
    function sxEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function sxDoku(){return (typeof DOKU!=='undefined'&&DOKU);}
    function sxEntity(w){
      if((w.bind!=='fixed') && typeof hfSess==='function'){var s=hfSess({session:w.session||'shade'});return (s&&s.roomIdx)||0;}
      return parseInt(w.entityId||0)||0;
    }
    // Groessen aus der Kachelgroesse (.w hat container-type:size) — keine festen Pixel.
    var SX_BOX = 'display:flex;flex-direction:column;height:100%;overflow:auto;'
               + 'gap:clamp(5px,2.4cqmin,11px);padding:clamp(8px,4cqmin,16px) clamp(9px,4.4cqmin,17px);'
               + 'font-size:clamp(10px,3.2cqmin,13px)';
    var SX_HD   = 'flex:0 0 auto;font-size:clamp(8px,2.2cqmin,10px);letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint)';
    var SX_ZONE = 'flex:0 0 auto;font-size:clamp(11px,3.8cqmin,15px);font-weight:600;margin-top:-2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    var SX_ROW  = 'flex:0 0 auto;display:flex;align-items:center;gap:clamp(5px,2.4cqmin,9px);background:var(--surface-2);'
                + 'border:1px solid var(--line-soft);border-radius:var(--r-s);padding:clamp(5px,2.6cqmin,9px) clamp(6px,3cqmin,11px)';
    var SX_NOTE = 'flex:0 0 auto;font-size:clamp(8px,2.4cqmin,11px);line-height:1.45;color:var(--faint)';
    var SX_X    = 'width:clamp(17px,6cqmin,23px);height:clamp(17px,6cqmin,23px);flex:0 0 auto;border:1px solid var(--line);'
                + 'border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;line-height:1;padding:0';
    function sxDot(on,warn){
      return '<span style="width:clamp(6px,2.4cqmin,10px);height:clamp(6px,2.4cqmin,10px);border-radius:50%;flex:0 0 auto;background:'
        +(on?'var(--crit)':'var(--ok)')+(on?';box-shadow:0 0 8px color-mix(in oklab,var(--crit) 55%,transparent)':'')+'"></span>';
    }
    function sxMsg(t){return '<div style="'+SX_BOX+'"><div style="margin:auto;color:var(--muted);font-size:clamp(10px,3.2cqmin,13px)">'+esc(t)+'</div></div>';}

    // ---------- Daten ----------
    function sxDemo(){return {ok:true,name:'Lesezimmer · Beschattung Balkon',armed:true,hubMode:2,
      doors:[{id:43149,name:'Balkontüre · Fenster',open:false},{id:21233,name:'Terassentüre · Türe',open:true}],
      temp:{'in':{id:15177,name:'Wohnzimmer · Ist-Temperatur',val:26.9},out:{id:59796,name:'Aussen · Temperatur gedaempft',val:29.5},aboveC:23,outAboveC:27,requireSun:true},
      env:{brightId:{own:true,info:{id:25920,name:'Tempest · Solar Radiation',val:214}},
           windId:{own:false,info:{id:58381,name:'Wind · Durchschnitt',val:1.6}},
           rainId:{own:false,info:{id:19991,name:'Regendetektor · Regen',val:0,bool:true}},
           sunAzId:{own:false,info:{id:15291,name:'Location · Azimuth',val:255.3}},
           sunElId:{own:false,info:{id:45609,name:'Location · Altitude',val:30.8}}}};}
    function sxLoad(w){
      var st=sxSt(w);
      if(sxDoku()){st.d=sxDemo();sxRepaint(w);return;}
      var idx=sxEntity(w);
      if(!idx){st.d=null;st.err='';sxRepaint(w);return;}
      fetch('?api=shading&op=zonecfg&id='+idx,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        if(j&&j.ok){st.d=j;st.err='';}else{st.d=null;st.err=(j&&j.err)||'Fehler';}
        sxRepaint(w);
      }).catch(function(){st.d=null;st.err='Verbindungsfehler';sxRepaint(w);});
    }
    function sxManage(idx,body){return fetch('?api=mod&op=manage&id='+idx+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)})
      .then(function(r){return r.json();}).catch(function(){return{ok:false};});}
    function sxHub(op,args){return fetch('?api=mod&op=hubmanage&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:op,args:args||{}})})
      .then(function(r){return r.json();}).catch(function(){return{ok:false};});}

    // ================= 1) Aussperr-Schutz (shadedoors) =================
    function sdRender(w){
      var st=sxSt(w),d=st.d;
      if(!d)return sxMsg(st.err||'Kein Rollo gewählt');
      var h='<div style="'+SX_BOX+'"><div style="'+SX_HD+'">Aussperr-Schutz</div><div style="'+SX_ZONE+'">'+esc(d.name||'')+'</div>';
      if(!d.doors||!d.doors.length){
        h+='<div style="'+SX_ROW+';color:var(--muted);justify-content:center">kein Kontakt zugeordnet</div>';
      } else {
        d.doors.forEach(function(c){
          h+='<div style="'+SX_ROW+'">'+sxDot(!!c.open)
            +'<span style="flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name||('#'+c.id))+'</span>'
            +'<span style="font-size:clamp(8px,2.4cqmin,11px);color:'+(c.open?'var(--crit)':'var(--muted)')+';font-weight:'+(c.open?'700':'400')+'">'+(c.open?'OFFEN':'zu')+'</span>'
            +'<button data-sddel="'+c.id+'" style="'+SX_X+'" title="Kontakt entfernen">×</button></div>';
        });
      }
      if(st.adding){
        var opts='<option value="0">— Kontakt wählen —</option>';
        (st.cts||[]).forEach(function(c){
          opts+='<option value="'+c.id+'">'+esc(c.instance+' · '+c.var)+'</option>';
        });
        h+='<select data-sdpick="1" style="flex:0 0 auto;width:100%;background:var(--surface-2);color:var(--text);border:1px solid var(--accent);'
          +'border-radius:var(--r-s);padding:clamp(5px,2.6cqmin,9px);font-size:clamp(9px,2.8cqmin,12px);font-family:inherit">'+opts+'</select>';
      } else {
        h+='<button data-sdadd="1" style="flex:0 0 auto;border:1px dashed var(--line);border-radius:var(--r-s);background:transparent;color:var(--accent);'
          +'padding:clamp(6px,3cqmin,10px);font-size:clamp(9px,2.8cqmin,12px);font-weight:600;cursor:pointer;font-family:inherit">+ Kontakt hinzufügen</button>';
      }
      h+='<div style="'+SX_NOTE+'">Offener Kontakt sperrt das Zufahren. Auffahren und Sturm-Rückzug bleiben erlaubt.</div></div>';
      return h;
    }
    function sdSave(w,ids){
      var st=sxSt(w),idx=sxEntity(w);
      if(sxDoku())return;
      if(!idx){toast('Kein Rollo gewählt');return;}
      st.busy=true;
      sxManage(idx,{op:'configureAutomation',args:{doorIds:ids}}).then(function(j){
        st.busy=false;
        toast((j&&j.ok)?'Aussperr-Schutz gespeichert':'Speichern fehlgeschlagen');
        sxLoad(w);
      });
    }
    function sdBind(w,el){
      var st=sxSt(w),d=st.d;
      $$('[data-sddel]',el).forEach(function(b){b.onclick=function(){
        var rm=parseInt(b.getAttribute('data-sddel'))||0;
        var ids=(d&&d.doors||[]).map(function(c){return c.id;}).filter(function(i){return i!==rm;});
        if(sxDoku()){d.doors=d.doors.filter(function(c){return c.id!==rm;});sxRepaint(w);return;}
        sdSave(w,ids);
      };});
      var ab=$('[data-sdadd]',el);if(ab)ab.onclick=function(){
        st.adding=true;
        if(st.cts){sxRepaint(w);return;}
        if(sxDoku()){st.cts=[{id:11408,instance:'Fenster',var:'Fenster'}];sxRepaint(w);return;}
        sxHub('detectContacts',{}).then(function(j){st.cts=(j&&j.contacts)||[];sxRepaint(w);});
      };
      var pk=$('[data-sdpick]',el);if(pk)pk.onchange=function(){
        var add=parseInt(this.value)||0;st.adding=false;
        if(!add){sxRepaint(w);return;}
        var ids=(d&&d.doors||[]).map(function(c){return c.id;});
        if(ids.indexOf(add)<0)ids.push(add);
        if(sxDoku()){sxRepaint(w);return;}
        sdSave(w,ids);
      };
    }

    // ================= 2) Umgebungs-Sensoren (shadesens) =================
    var SX_SENS=[['brightId','Helligkeit'],['windId','Wind'],['rainId','Regen'],['sunAzId','Sonnen-Azimut'],['sunElId','Sonnen-Höhe']];
    function ssnNum(i){
      if(!i)return '';
      if(i.bool)return (i.val?'JA':'nein');
      var v=parseFloat(i.val);
      if(isNaN(v))return esc(String(i.val));
      return String(Math.round(v*10)/10).replace('.',',');
    }
    function ssnRender(w){
      var st=sxSt(w),d=st.d;
      if(!d)return sxMsg(st.err||'Kein Rollo gewählt');
      var h='<div style="'+SX_BOX+'"><div style="'+SX_HD+'">Umgebungs-Sensoren</div><div style="'+SX_ZONE+'">'+esc(d.name||'')+'</div>';
      SX_SENS.forEach(function(s){
        var e=(d.env||{})[s[0]]||{},i=e.info,own=!!e.own;
        h+='<div style="flex:0 0 auto;display:flex;align-items:center;gap:clamp(4px,2.2cqmin,8px)">'
          +'<span style="width:clamp(52px,22cqmin,100px);flex:0 0 auto;color:var(--muted);font-size:clamp(8px,2.6cqmin,11px)">'+esc(s[1])+'</span>'
          +'<span style="flex:1 1 auto;background:var(--surface-2);border:1px solid var(--line-soft);border-radius:var(--r-s);'
          +'padding:clamp(4px,2.2cqmin,8px) clamp(5px,2.6cqmin,10px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
          +'color:'+(own?'var(--text)':'var(--faint)')+'">'
          +(i?esc(i.name):'<i>nicht gebunden</i>')
          +(i?' <b style="font-variant-numeric:tabular-nums;color:var(--text)">'+ssnNum(i)+'</b>':'')+'</span>'
          +(own?'<button data-ssnrst="'+s[0]+'" style="'+SX_X+'" title="auf Haus-Vorgabe zurücksetzen">↺</button>':'')
          +'</div>';
      });
      // --- Temperatur-Fuehler des Gates. INNEN gehoert dem Rollo (jeder Raum hat einen
      //     eigenen, i. d. R. der Raumthermostat), AUSSEN ist EINER fuers ganze Haus und
      //     kommt darum aus der Hub-Vorgabe. Deshalb hier nur innen aenderbar.
      var tp=d.temp||{};
      var trow=function(lbl,i,own,editKey){
        return '<div style="flex:0 0 auto;display:flex;align-items:center;gap:clamp(4px,2.2cqmin,8px)">'
          +'<span style="width:clamp(52px,22cqmin,100px);flex:0 0 auto;color:var(--muted);font-size:clamp(8px,2.6cqmin,11px)">'+esc(lbl)+'</span>'
          +'<span style="flex:1 1 auto;background:var(--surface-2);border:1px solid var(--line-soft);border-radius:var(--r-s);'
          +'padding:clamp(4px,2.2cqmin,8px) clamp(5px,2.6cqmin,10px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
          +'color:'+(own?'var(--text)':'var(--faint)')+'">'
          +(i?esc(i.name):'<i>nicht gebunden</i>')
          +(i?' <b style="font-variant-numeric:tabular-nums;color:var(--text)">'+ssnNum(i)+' °C</b>':'')+'</span>'
          +(editKey?'<button data-ssntp="'+editKey+'" style="'+SX_X+'" title="Fühler wählen">✎</button>':'')
          +'</div>';
      };
      h+='<div style="flex:0 0 auto;height:1px;background:var(--line-soft);margin:clamp(2px,1cqmin,5px) 0"></div>';
      h+=trow('Temp. innen',tp['in'],true,'in');
      if(st.tpick==='in'){
        var to='<option value="0">— Fühler wählen —</option>';
        (st.tvars||[]).forEach(function(v){
          to+='<option value="'+v.id+'"'+((tp['in']&&tp['in'].id===v.id)?' selected':'')+'>'+esc(v.instance+' · '+v.var)+'</option>';
        });
        h+='<select data-ssntpick="1" style="flex:0 0 auto;width:100%;background:var(--surface-2);color:var(--text);border:1px solid var(--accent);'
          +'border-radius:var(--r-s);padding:clamp(5px,2.6cqmin,9px);font-size:clamp(9px,2.8cqmin,12px);font-family:inherit">'+to+'</select>';
      }
      h+=trow('Temp. außen',tp.out,false,null);
      h+='<div style="'+SX_NOTE+'">Weiß = eigene Wahl für dieses Rollo, grau = haus-weite Vorgabe aus dem Hub. '
        +'Der Innenfühler gehört zum Raum (meist der Raumthermostat), der Außenfühler ist einer fürs ganze Haus. '
        +'Die SCHWELLEN dazu stehen im Temperatur-Profil'
        +((tp.aboveC!=null||tp.outAboveC!=null)?(' — aktuell ab '+(tp.aboveC!=null?tp.aboveC+' °C innen':'—')+' und '+(tp.outAboveC!=null?tp.outAboveC+' °C außen':'— außen')):'')
        +'.</div></div>';
      return h;
    }
    function ssnBind(w,el){
      $$('[data-ssnrst]',el).forEach(function(b){b.onclick=function(){
        var sk=b.getAttribute('data-ssnrst'),idx=sxEntity(w);
        if(sxDoku()){toast('Demo: nicht geschrieben');return;}
        if(!idx)return;
        b.disabled=true;
        fetch('?api=shading&op=setenv&id='+idx+'&sk='+encodeURIComponent(sk)+'&vid=0&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
          .then(function(r){return r.json();}).then(function(j){
            toast((j&&j.ok)?'Auf Haus-Vorgabe zurückgesetzt':'Zurücksetzen fehlgeschlagen');sxLoad(w);});
      };});
      // Innen-Fuehler waehlen: Liste der Temperatur-Variablen erst auf Klick holen (452 Stueck).
      var st=sxSt(w);
      var tb=$('[data-ssntp]',el);if(tb)tb.onclick=function(){
        st.tpick='in';
        if(st.tvars){sxRepaint(w);return;}
        if(sxDoku()){st.tvars=[{id:15177,instance:'Wohnzimmer',var:'Ist-Temperatur'}];sxRepaint(w);return;}
        fetch('?api=shading&op=tempvars',{cache:'no-store'}).then(function(r){return r.json();})
          .then(function(j){st.tvars=(j&&j.vars)||[];sxRepaint(w);})
          .catch(function(){st.tvars=[];sxRepaint(w);});
      };
      var tp=$('[data-ssntpick]',el);if(tp)tp.onchange=function(){
        var vid=parseInt(this.value)||0,idx=sxEntity(w);
        st.tpick=null;
        if(!vid){sxRepaint(w);return;}
        if(sxDoku()){sxRepaint(w);return;}
        if(!idx)return;
        // Nur den Fuehler schicken - die Zone mischt ihn in den vorhandenen tempGate,
        // die Schwellen aus dem Profil bleiben dabei unangetastet.
        sxManage(idx,{op:'configureAutomation',args:{tempGate:{sensorId:vid}}}).then(function(j){
          toast((j&&j.ok)?'Innenfühler gesetzt':'Speichern fehlgeschlagen');sxLoad(w);});
      };
    }

    // ================= 3) Betrieb: scharf/Schatten (shadearm) =================
    function samRender(w){
      var st=sxSt(w),d=st.d;
      if(!d)return sxMsg(st.err||'Kein Rollo gewählt');
      var on=!!d.armed, hm=d.hubMode;
      var seg='<div style="flex:0 0 auto;display:flex;border:1px solid var(--line);border-radius:999px;overflow:hidden">'
        +'<button data-samset="1" style="flex:1 1 0;border:0;background:'+(on?'var(--accent-2)':'transparent')+';color:'+(on?'#fff':'var(--muted)')
        +';padding:clamp(6px,3cqmin,10px) clamp(4px,2cqmin,8px);font-size:clamp(9px,2.8cqmin,12px);font-weight:600;cursor:pointer;font-family:inherit">Scharf</button>'
        +'<button data-samset="0" style="flex:1 1 0;border:0;background:'+(!on?'var(--accent-2)':'transparent')+';color:'+(!on?'#fff':'var(--muted)')
        +';padding:clamp(6px,3cqmin,10px) clamp(4px,2cqmin,8px);font-size:clamp(9px,2.8cqmin,12px);font-weight:600;cursor:pointer;font-family:inherit">Schatten</button></div>';
      // Der Hub hat Vorrang: Aus (0) bzw. Scharf (2) ueberstimmen die Zone, Auto (1) nicht.
      var hub=(hm===0)?['var(--crit)','Hub steht auf AUS — die Zone fährt nicht, egal was hier steht']
             :(hm===2)?['var(--ok)','Hub steht auf Scharf — überstimmt die Zone']
             :['var(--muted)','Hub steht auf Auto — diese Einstellung entscheidet'];
      var h='<div style="'+SX_BOX+'"><div style="'+SX_HD+'">Betrieb</div><div style="'+SX_ZONE+'">'+esc(d.name||'')+'</div>'+seg
        +'<div style="flex:0 0 auto;display:flex;align-items:center;gap:clamp(4px,2.2cqmin,8px);font-size:clamp(8px,2.6cqmin,11px);color:'+hub[0]+'">'
        +'<span style="width:clamp(6px,2.4cqmin,10px);height:clamp(6px,2.4cqmin,10px);border-radius:50%;background:currentColor;flex:0 0 auto"></span>'
        +esc(hub[1])+'</div>'
        +'<div style="'+SX_NOTE+'">Schatten-Modus: die Automatik rechnet und protokolliert weiter, sendet aber keine Fahrbefehle.</div></div>';
      return h;
    }
    function samBind(w,el){
      $$('[data-samset]',el).forEach(function(b){b.onclick=function(){
        var val=b.getAttribute('data-samset')==='1',idx=sxEntity(w),st=sxSt(w);
        if(sxDoku()){st.d.armed=val;sxRepaint(w);return;}
        if(!idx)return;
        if(st.d&&st.d.armed===val)return;
        sxManage(idx,{op:'setArmed',args:{armed:val}}).then(function(j){
          toast((j&&j.ok!==false)?(val?'Zone scharf':'Zone im Schatten-Modus'):'Umschalten fehlgeschlagen');
          sxLoad(w);});
      };});
    }

    // ---------- gemeinsames Repaint/Registrierung ----------
    var SX_KIND={};   // widget-name -> {render,bind}
    function sxRepaint(w){
      var el=sxEl(w);if(!el)return;
      var k=SX_KIND[w.type];if(!k)return;
      var host=el.querySelector('.winner')||el;
      host.innerHTML=k.render(w);
      k.bind(w,el);
    }
    function sxProps(w,hint){
      var h='<div class="pgh">Bindung</div>';
      h+=row('Modus','<select id="sxBind"><option value="session"'+(w.bind!=='fixed'?' selected':'')+'>Session (folgt Auswahl)</option><option value="fixed"'+(w.bind==='fixed'?' selected':'')+'>Feste Zone</option></select>');
      if(w.bind!=='fixed'){ h+=row('Session-ID','<input id="sxSess" value="'+esc(w.session||'shade')+'" placeholder="shade">'); }
      else { h+=row('Zone (Instanz-ID)','<input id="sxEnt" type="number" value="'+(w.entityId||'')+'" placeholder="z. B. 16537">'); }
      h+='<div style="font-size:11px;color:var(--muted);margin:2px 2px 4px">'+hint+'</div>';
      return h;
    }
    function sxWire(w){
      if($('#sxBind'))$('#sxBind').onchange=function(){w.bind=this.value;commit();renderProps();sxLoad(w);};
      if($('#sxSess'))$('#sxSess').onchange=function(){w.session=this.value||undefined;commit();sxLoad(w);};
      if($('#sxEnt'))$('#sxEnt').onchange=function(){w.entityId=parseInt(this.value)||undefined;commit();sxLoad(w);};
    }
    function sxDef(name,label,icon,size,hint,render,bind){
      SX_KIND[name]={render:render,bind:bind};
      defWidget(name,{
        label:label, cat:'HomeSuite · Beschattung', paletteIcon:icon, size:size,
        defaults:function(w){w.bind='session';w.session='shade';w.domain='shading';},
        render:function(w){return render(w);},
        mount:function(w){var el=sxEl(w);if(!el)return;
          if(sxDoku()){sxLoad(w);return;}
          if(w.bind!=='fixed'){
            w.domain='shading';w.hsMode=true;               // shade-Session laden, nicht Heizung
            if(typeof hfSub==='function')hfSub(w);          // an die Rollo-Auswahl koppeln
            if(typeof hfEnsure==='function')hfEnsure(w,el); // erstes Rollo setzen -> sofort Inhalt
            else sxLoad(w);
          } else sxLoad(w);},
        _bind:function(w){var st=sxSt(w);st.adding=false;sxLoad(w);}, // Familie wechselt Rollo
        props:function(w){return sxProps(w,hint);},
        wire:function(w){sxWire(w);}
      });
    }

    sxDef('shadedoors','Aussperr-Schutz','door',[280,230],
      'Tür-/Fensterkontakte dieser Zone mit Live-Zustand (rot = offen). Ein offener Kontakt blockiert nur das ZUFAHREN; Auffahren und Sturm-Rückzug bleiben erlaubt. Die Auswahl kommt aus der markenübergreifenden Kontakt-Erkennung des Hubs.',
      sdRender,sdBind);
    sxDef('shadesens','Umgebungs-Sensoren','sun',[300,300],
      'Zeigt, welche Sensoren die Automatik dieser Zone benutzt und ob es die Haus-Vorgabe (grau) oder eine eigene Wahl (weiß) ist — mit aktuellem Messwert. ↺ setzt auf die Haus-Vorgabe zurück.',
      ssnRender,ssnBind);
    sxDef('shadearm','Betrieb (scharf/Schatten)','shield',[250,190],
      'Schaltet diese Zone zwischen „fährt real" und „rechnet nur". Der Hub-Hauptschalter hat Vorrang: steht er auf Aus oder Scharf, überstimmt er die Zone.',
      samRender,samBind);
  })();
