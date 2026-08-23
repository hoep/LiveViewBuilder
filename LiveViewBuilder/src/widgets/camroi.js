  // ===== Widget: Kamera-Messfeld (camroi) =====
  //
  // Werkzeug, kein Anzeigeschild: hier wird festgelegt, WELCHEN Bildbereich die
  // Wetterstation auswertet, wenn sie an den Kameras die Sicht misst.
  //
  // Warum es das braucht: das Feld steht in der Instanz als vier Prozentzahlen, und
  // vier Prozentzahlen sagen niemandem, was er misst. Am 23.08.2026 standen alle vier
  // Kameras auf dem GANZEN Bild - also zum grossen Teil auf dem Himmel. Dessen
  // Streulicht hebt den Dunkelkanal an, und genau daran erkennt das Modul Nebel: bei
  // klarer Sicht mass das Poolhaus 79, die Schwelle fuer dichten Nebel liegt bei 110.
  //
  // Deshalb steht neben dem Bild nicht nur das Rechteck, sondern was es MISST - jeder
  // Wert auf der Skala, gegen die er gerechnet wird. Man sieht also nicht nur, was man
  // auswaehlt, sondern ob die Auswahl als Nebelfuehler taugt.

  var _crD = {};      // Kameraliste und Messwerte je Widget-Id

  function _crState(w){ return (_crD[w.id] = _crD[w.id] || {cams:null,sel:0,roi:null,mess:null,vor:null,busy:'',msg:''}); }
  function _crEl(w){
    var sel='.w[data-id="'+w.id+'"] [data-role=crroot]';
    var oc=document.getElementById('ovcanvas');
    return (oc&&oc.querySelector(sel))||(typeof canvas!=='undefined'&&canvas&&canvas.querySelector(sel))||null;
  }
  function _crNum(x,n){ var v=parseFloat(x); return isNaN(v)?'–':v.toFixed(n==null?0:n).replace('.',','); }

  /** Kamera, die gerade bearbeitet wird. */
  function _crCam(s){ return (s.cams&&s.cams[s.sel])||null; }

  function _crLade(w){
    var s=_crState(w);
    s.busy='Kameras holen …'; _crPaint(w);
    fetch('?api=wxroi&was=liste',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      s.busy='';
      if(!j||!j.ok){ s.msg=(j&&j.fehler)||'Wetterstation antwortet nicht'; _crPaint(w); return; }
      s.cams=j.kameras||[]; s.schwellen=j.schwellen||{}; s.sonne=j.sonne;
      s.verfuegbar=j.verfuegbar||[];
      if(s.zeigeNeu){ s.cams.forEach(function(c,i){ if(c.id===s.zeigeNeu)s.sel=i; }); s.zeigeNeu=null; }
      if(s.sel>=s.cams.length)s.sel=0;
      var c=_crCam(s);
      s.roi=c?{x:c.x,y:c.y,w:c.w,h:c.h}:null;
      s.vor=null; s.mess=null;
      _crPaint(w); _crMessen(w);
    }).catch(function(){ s.busy=''; s.msg='Wetterstation nicht erreichbar'; _crPaint(w); });
  }

  /** Das gewaehlte Feld messen lassen - ohne es zu speichern. */
  function _crMessen(w){
    var s=_crState(w),c=_crCam(s); if(!c||!s.roi)return;
    var r=s.roi;
    s.busy='messen …'; _crPaint(w);
    fetch('?api=wxroi&was=pruefe&mid='+c.id+'&x='+r.x+'&y='+r.y+'&w='+r.w+'&h='+r.h,{cache:'no-store'})
      .then(function(x){return x.json();}).then(function(j){
        s.busy=''; s.mess=(j&&j.ok)?j.messung:null; if(j&&j.schwellen)s.schwellen=j.schwellen;
        if(j&&!j.ok)s.msg=j.fehler||''; _crPaint(w);
      }).catch(function(){ s.busy=''; _crPaint(w); });
  }

  function _crVorschlag(w){
    var s=_crState(w),c=_crCam(s); if(!c)return;
    s.busy='Felder durchmessen …'; s.vor=null; _crPaint(w);
    fetch('?api=wxroi&was=vorschlag&mid='+c.id,{cache:'no-store'})
      .then(function(x){return x.json();}).then(function(j){
        s.busy='';
        if(!j||!j.ok){ s.msg='Vorschlag fehlgeschlagen'; _crPaint(w); return; }
        s.vor=j; _crPaint(w);
      }).catch(function(){ s.busy=''; s.msg='Vorschlag fehlgeschlagen'; _crPaint(w); });
  }

  function _crSetzen(w){
    var s=_crState(w),c=_crCam(s); if(!c||!s.roi)return;
    var r=s.roi;
    s.busy='übernehmen …'; _crPaint(w);
    fetch('?api=wxroi&was=setze&mid='+c.id+'&x='+r.x+'&y='+r.y+'&w='+r.w+'&h='+r.h
          +'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
      .then(function(x){return x.json();}).then(function(j){
        s.busy=''; s.msg=(j&&j.ok)?(j.hinweis||'übernommen'):((j&&j.fehler)||'nicht übernommen');
        if(j&&j.ok&&s.cams&&s.cams[s.sel]){var cc=s.cams[s.sel];cc.x=r.x;cc.y=r.y;cc.w=r.w;cc.h=r.h;cc.klarwertTag=0;cc.klarwertNacht=0;}
        _crPaint(w);
      }).catch(function(){ s.busy=''; s.msg='nicht übernommen'; _crPaint(w); });
  }

  /** Kamera aufnehmen, stilllegen, herausnehmen - danach die Liste neu holen. */
  function _crKamera(w,was,mid,an){
    var s=_crState(w);
    s.busy='…'; _crPaint(w);
    fetch('?api=wxroi&was='+was+'&mid='+mid+(an!=null?('&an='+(an?1:0)):'')
          +'&key='+encodeURIComponent(TOKEN),{cache:'no-store'})
      .then(function(x){return x.json();}).then(function(j){
        s.busy=''; s.msg=(j&&(j.hinweis||j.fehler))||'';
        s.wahl=false;
        // Nach dem Aufnehmen gleich die neue Kamera zeigen - sonst sucht man sie.
        s.zeigeNeu=(was==='binden')?mid:null;
        _crLade(w);
      }).catch(function(){ s.busy=''; s.msg='ging nicht'; _crPaint(w); });
  }

  /** Auswahlliste der Bildquellen im Baum. */
  function _crWahlHtml(w){
    var s=_crState(w); if(!s.wahl)return '';
    var v=(s.verfuegbar||[]).filter(function(q){return !q.gebunden;});
    if(!v.length)return '<div class="crwahl"><div class="crvh">Kamera aufnehmen</div>'
      +'<div class="crhint">Alle Bildquellen im Baum sind schon gebunden.</div></div>';
    return '<div class="crwahl"><div class="crvh">Kamera aufnehmen</div><div class="crwl">'
      +v.map(function(q){
        return '<button class="crw" data-crbind="'+q.id+'"><b>'+esc(q.ort||q.name)+'</b>'
          +'<span>'+esc(q.groesse||'')+'</span></button>';
      }).join('')+'</div></div>';
  }

  // --- Bewertung eines Wertes auf seiner Skala: 0 = schlecht, 1 = gut -----------
  function _crLage(wert,schlecht,gut){
    var v=(wert-schlecht)/((gut-schlecht)||1);
    return Math.max(0,Math.min(1,v));
  }
  function _crSkala(titel,wert,dez,linksTxt,rechtsTxt,anteil,invers){
    var pos=Math.round((invers?(1-anteil):anteil)*100);
    return '<div class="crm">'
      +'<div class="crmk"><span>'+esc(titel)+'</span><b>'+_crNum(wert,dez)+'</b></div>'
      +'<div class="crsk'+(invers?' inv':'')+'"><span class="crzg" style="left:calc('+pos+'% - 1px)"></span></div>'
      +'<div class="crsl"><span>'+esc(linksTxt)+'</span><span>'+esc(rechtsTxt)+'</span></div></div>';
  }

  function _crPanel(w){
    var s=_crState(w),m=s.mess,t=s.schwellen||{};
    if(!m)return '<div class="crhint">'+(s.busy?esc(s.busy):'noch nichts gemessen')+'</div>';
    var dkK=(t.dkKlar!=null?t.dkKlar:25),dkN=(t.dkNebel!=null?t.dkNebel:110);
    var koK=(t.konKlar!=null?t.konKlar:0.12),koN=(t.konNebel!=null?t.konNebel:0.03);
    var saK=(t.satKlar!=null?t.satKlar:0.22),saN=(t.satNebel!=null?t.satNebel:0.06);
    var mh=(t.minHell!=null?t.minHell:60);
    var lDk=_crLage(m.dunkel,dkN,dkK), lKo=_crLage(m.dichte,koN,koK), lSa=_crLage(m.saettigung,saN,saK);
    var lHe=_crLage(m.helligkeit,mh-20,mh+60);
    // Das Urteil haengt am Dunkelkanal und an der Struktur - beides muss stimmen:
    // ein Feld ohne Kanten kann keinen Kontrastverlust zeigen, und eines mit Himmel
    // meldet Streulicht, wo keines ist.
    var gut=(lDk>=.6&&lKo>=.5&&m.helligkeit>=mh);
    var mittel=(!gut&&lDk>=.35&&lKo>=.3);
    var urteil=gut?'Taugt als Nebelfühler: Dunkelkanal nahe am Klarwert, genug Struktur für einen sichtbaren Kontrastverlust.'
      :(mittel?'Brauchbar, aber nicht gut. Weiter weg vom Himmel und auf feste Struktur in mittlerer Entfernung.'
              :(m.helligkeit<mh?'Zu dunkel für eine Aussage. Bei Tageslicht neu wählen.'
                               :'Ungeeignet: zu viel Himmel oder zu wenig Struktur. Der Dunkelkanal wäre schon bei klarer Sicht hoch.'));
    return _crSkala('Dunkelkanal',m.dunkel,1,dkK+' klar',dkN+' dichter Nebel',lDk,true)
      +_crSkala('Kontrastdichte',m.dichte,3,String(koN).replace('.',',')+' Nebel',String(koK).replace('.',',')+' klar',lKo,false)
      +_crSkala('Sättigung',m.saettigung,3,String(saN).replace('.',',')+' Grau',String(saK).replace('.',',')+' klar',lSa,false)
      +_crSkala('Helligkeit',m.helligkeit,1,mh+' zu dunkel','255',lHe,false)
      +'<div class="crurteil '+(gut?'gut':(mittel?'mittel':'schlecht'))+'">'+esc(urteil)+'</div>';
  }

  function _crVorschlagHtml(w){
    var s=_crState(w); if(!s.vor)return '';
    var h='<div class="crvh">Vorschläge'+(s.vor.tageslicht?'':' <span class="crwarn">· ohne Tageslicht wenig wert</span>')+'</div><div class="crvl">';
    (s.vor.vorschlaege||[]).forEach(function(v,i){
      h+='<button class="crv" data-crvor="'+i+'"><b>'+v.note+'</b>'
        +'<span>'+v.x+' · '+v.y+' · '+v.w+' × '+v.h+'</span>'
        +'<span class="crvm">DK '+_crNum(v.messung.dunkel,0)+' · KD '+_crNum(v.messung.dichte,3)+'</span></button>';
    });
    return h+'</div>';
  }

  function _crPaint(w){
    var el=_crEl(w); if(!el)return;
    var s=_crState(w);
    if(!s.cams){ el.innerHTML='<div class="crhint">'+esc(s.busy||s.msg||'—')+'</div>'; return; }
    var c=_crCam(s),r=s.roi||{x:0,y:0,w:100,h:100};
    var pills=s.cams.map(function(k,i){
      return '<button class="crp'+(i===s.sel?' on':'')+'" data-crcam="'+i+'">'+esc(k.name||('#'+k.id))+'</button>';
    }).join('');
    // Der Rahmen zeigt den Ausschnitt UNGEDIMMT, alles ausserhalb liegt im Schatten -
    // so sieht man beim Ziehen, was gemessen wird, und trotzdem, wo man ist.
    var src=c?('?api=media&id='+c.id+'&t='+(s.bildStand||0)):'';
    var h='<div class="crbar">'+pills
      +'<button class="crp neu" data-crb="wahl" title="Kamera aufnehmen">+</button>'
      +'<span class="crsp"></span>'
      +(c?('<button class="crb" data-crb="aktiv" title="'+(c.aktiv?'zählt mit':'stillgelegt')+'">'
           +(c.aktiv?'aktiv':'stillgelegt')+'</button>'
          +'<button class="crb" data-crb="loesen" title="Kamera herausnehmen">entfernen</button>'):'')
      +'<button class="crb" data-crb="ganz">ganzes Bild</button>'
      +'<button class="crb" data-crb="vorschlag">Vorschlag</button>'
      +'<button class="crb pri" data-crb="setze">übernehmen</button></div>'
      +_crWahlHtml(w)
      +'<div class="crmain"><div class="crpick" data-role="crpick">'
        +'<img src="'+esc(src)+'" alt="" draggable="false">'
        +'<div class="crroi" style="left:'+r.x+'%;top:'+r.y+'%;width:'+r.w+'%;height:'+r.h+'%">'
          +'<img src="'+esc(src)+'" draggable="false" style="left:'+(-r.x/r.w*100)+'%;top:'+(-r.y/r.h*100)+'%;width:'+(100/r.w*100)+'%;height:'+(100/r.h*100)+'%">'
          +'<span class="crc nw" data-crc="nw"></span><span class="crc ne" data-crc="ne"></span>'
          +'<span class="crc sw" data-crc="sw"></span><span class="crc se" data-crc="se"></span>'
          +'<span class="crtag">'+r.x+' · '+r.y+' · '+r.w+' × '+r.h+'</span>'
        +'</div>'
        +'<span class="crinfo">'+esc((c&&c.groesse)||'')+(c&&!c.aktiv?' · nicht aktiv':'')+'</span>'
      +'</div>'
      +'<div class="crside">'+_crPanel(w)+_crVorschlagHtml(w)
        +'<div class="crmsg">'+esc(s.busy||s.msg||'')+'</div>'
        +'<div class="crhint">Übernehmen verwirft den gelernten Klarwert dieser Kamera – er gehört zum alten Feld.</div>'
      +'</div></div>';
    el.innerHTML=h;
    _crWire(w,el);
  }

  function _crWire(w,el){
    var s=_crState(w);
    el.querySelectorAll('[data-crcam]').forEach(function(b){b.onclick=function(){
      s.sel=parseInt(b.getAttribute('data-crcam'))||0;
      var c=_crCam(s); s.roi=c?{x:c.x,y:c.y,w:c.w,h:c.h}:null; s.vor=null; s.mess=null; s.msg='';
      _crPaint(w); _crMessen(w);};});
    el.querySelectorAll('[data-crb]').forEach(function(b){b.onclick=function(){
      var a=b.getAttribute('data-crb');
      if(a==='ganz'){ s.roi={x:0,y:0,w:100,h:100}; _crPaint(w); _crMessen(w); }
      else if(a==='vorschlag'){ _crVorschlag(w); }
      else if(a==='setze'){ _crSetzen(w); }
      else if(a==='wahl'){ s.wahl=!s.wahl; _crPaint(w); }
      else if(a==='aktiv'){ var k=_crCam(s); if(k)_crKamera(w,'aktiv',k.id,!k.aktiv); }
      else if(a==='loesen'){ var k2=_crCam(s); if(k2)_crKamera(w,'loesen',k2.id); }};});
    el.querySelectorAll('[data-crbind]').forEach(function(b){b.onclick=function(){
      _crKamera(w,'binden',parseInt(b.getAttribute('data-crbind')));};});
    el.querySelectorAll('[data-crvor]').forEach(function(b){b.onclick=function(){
      var v=(s.vor&&s.vor.vorschlaege)||[],i=parseInt(b.getAttribute('data-crvor'));
      if(!v[i])return; s.roi={x:v[i].x,y:v[i].y,w:v[i].w,h:v[i].h}; s.mess=v[i].messung; _crPaint(w);};});

    var pick=el.querySelector('[data-role=crpick]'); if(!pick)return;
    var ziehen=null;
    function anteil(ev){
      var b=pick.getBoundingClientRect();
      return {x:Math.max(0,Math.min(100,(ev.clientX-b.left)/b.width*100)),
              y:Math.max(0,Math.min(100,(ev.clientY-b.top)/b.height*100))};
    }
    function setz(a,b2){
      // Immer als linke obere Ecke plus Groesse - egal, in welche Richtung gezogen wurde.
      var x=Math.min(a.x,b2.x),y=Math.min(a.y,b2.y);
      var bw=Math.abs(b2.x-a.x),bh=Math.abs(b2.y-a.y);
      s.roi={x:Math.round(x),y:Math.round(y),w:Math.round(Math.max(5,bw)),h:Math.round(Math.max(5,bh))};
      if(s.roi.x+s.roi.w>100)s.roi.w=100-s.roi.x;
      if(s.roi.y+s.roi.h>100)s.roi.h=100-s.roi.y;
      var el2=el.querySelector('.crroi');
      if(el2){var r=s.roi;el2.style.left=r.x+'%';el2.style.top=r.y+'%';el2.style.width=r.w+'%';el2.style.height=r.h+'%';
        var im=el2.querySelector('img');
        if(im){im.style.left=(-r.x/r.w*100)+'%';im.style.top=(-r.y/r.h*100)+'%';im.style.width=(100/r.w*100)+'%';im.style.height=(100/r.h*100)+'%';}
        var tg=el2.querySelector('.crtag'); if(tg)tg.textContent=r.x+' · '+r.y+' · '+r.w+' × '+r.h;}
    }
    pick.addEventListener('pointerdown',function(ev){
      if(typeof mode!=='undefined'&&mode==='edit')return;   // im Bearbeiten gehoert der Zeiger dem Builder
      ev.preventDefault();
      var start=anteil(ev),ecke=ev.target&&ev.target.getAttribute&&ev.target.getAttribute('data-crc');
      if(ecke&&s.roi){
        // Ecke ziehen: die GEGENUEBERLIEGENDE bleibt stehen.
        var r=s.roi;
        start={x:(ecke==='nw'||ecke==='sw')?(r.x+r.w):r.x, y:(ecke==='nw'||ecke==='ne')?(r.y+r.h):r.y};
      }
      ziehen=start;
      pick.setPointerCapture&&pick.setPointerCapture(ev.pointerId);
    });
    pick.addEventListener('pointermove',function(ev){ if(ziehen)setz(ziehen,anteil(ev)); });
    pick.addEventListener('pointerup',function(ev){ if(!ziehen)return; setz(ziehen,anteil(ev)); ziehen=null; _crMessen(w); });
    pick.addEventListener('pointercancel',function(){ ziehen=null; });
  }

  defWidget('camroi',{
    label:'Kamera-Messfeld', cat:'Wetter', paletteIcon:'camera', size:[900,420],
    render:function(w){return '<div class="panel camroi"><div class="ptitle">'+escL(w.label||'Messfeld je Kamera')+'</div>'
      +'<div data-role="crroot"></div></div>';},
    props:function(w){return '<div class="hint" style="font-size:11px;margin:2px 2px 8px;color:var(--muted)">'
      +'Holt die Kameras aus der Wetterstation. Gemessen wird beim Loslassen, gespeichert erst mit „übernehmen“.</div>';},
    wire:function(w){},
    mount:function(w){ _crD[w.id]=null; _crLade(w); }
  });
