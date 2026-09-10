  // ===== Widget: Hierarchie (hierarchy) — ein Baum, vier Darstellungen =====
  //
  // Zeigt eine BELIEBIGE Eltern-Kind-Struktur in vier umschaltbaren Ansichten:
  //   Baum    eingerueckte Liste, eine Zeile je Knoten - vertraegt jede Tiefe
  //   Last    waagrechter Icicle, Blockhoehe = Summe im Teilbaum
  //   Graph   Knotenkarten mit geknickten Kanten
  //   Ring    konzentrische Ringe um die Wurzel
  //
  // EINE Datenform fuer alles. Der UniFi-Adapter im Handler erzeugt genau diese Form,
  // damit fuer das eigene Netz nichts einzurichten ist; jede andere Quelle (Proxmox,
  // Objektbaum, Raeume, Unterverteilungen) fuellt eine String-Variable mit demselben JSON:
  //
  //   [{"id":"a1","parent":"","label":"Hausleitnerweg","sub":"UDMA6A8","typ":"gw",
  //     "werte":{"clients":133,"zufr":null},"zustand":"ok","link":"kabel"}, ...]
  //
  //   id       eindeutig; parent leer oder unbekannt = Wurzel
  //   label    Anzeigename, sub die kleine zweite Zeile
  //   typ      freier Schluessel -> Symbol und Farbe ueber die Typen-Liste
  //   werte    Zahlen je Kennzahl; die Spalten-Liste entscheidet, welche erscheinen
  //   zustand  ok | warn | crit | off | leer
  //   link     kabel | funk  (funk wird gestrichelt gezeichnet)
  var _hyD={};   // Widget-ID -> {knoten, kinder, wurzeln, fehler}
  var _hyT={};   // Entprellung je Widget

  var _HY_MODI=[['tree','Baum'],['load','Last'],['graph','Graph'],['ring','Ring']];
  var _HY_IKON={
    gw:'<path d="M3 7h18v10H3z"/><path d="M7 11h2M11 11h2M15 11h2"/>',
    sw:'<path d="M3 8h18v8H3z"/><path d="M6 12h1M9 12h1M12 12h1M15 12h1M18 12h1"/>',
    ap:'<path d="M12 18v-6"/><path d="M8.5 10a5 5 0 0 1 7 0"/><path d="M6 7.5a9 9 0 0 1 12 0"/><circle cx="12" cy="19" r="1.4"/>',
    srv:'<path d="M4 5h16v5H4zM4 14h16v5H4z"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    box:'<path d="M4 5h16v14H4z"/>',
    dot:'<circle cx="12" cy="12" r="5"/>'
  };
  function _hyIkonPfad(k){return _HY_IKON[k]||_HY_IKON.box;}
  function _hySvg(k,farbe,gr){gr=gr||13;
    return '<svg width="'+gr+'" height="'+gr+'" viewBox="0 0 24 24" fill="none" stroke="'+farbe+'" '
      +'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto">'+_hyIkonPfad(k)+'</svg>';}

  /** Typen-Zuordnung: Symbol und Farbe je typ-Schluessel. Ohne Eintrag ein neutraler Kasten. */
  function _hyTyp(w,typ){
    var l=(w.hyTypes||[]);
    for(var i=0;i<l.length;i++)if(l[i]&&String(l[i].typ||'')===String(typ||''))return l[i];
    return null;
  }
  function _hyTypFarbe(w,typ){var t=_hyTyp(w,typ);return (t&&t.color)?(_skinColor(t.color)||t.color):cssv('--muted');}
  function _hyTypIkon(w,typ){var t=_hyTyp(w,typ);return (t&&t.icon)?t.icon:'box';}

  /** Zustandsfarbe. Leer heisst: keine Aussage, nicht "in Ordnung". */
  function _hyZustand(z){
    if(z==='crit')return cssv('--crit'); if(z==='warn')return cssv('--warn');
    if(z==='off') return cssv('--crit'); if(z==='ok')  return cssv('--ok');
    return '';
  }

  /** Spalten-Definition; ohne eigene Liste wird nichts angezeigt ausser dem Namen. */
  function _hySpalten(w){
    return (w.hyCols||[]).filter(function(c){return c&&c.feld;});
  }
  function _hyZahl(w,c,v){
    if(v==null||v===''||isNaN(parseFloat(v)))return null;
    return parseFloat(v);
  }
  function _hyTxt(c,v){
    if(v==null)return '–';
    var d=(c.dec!=null&&c.dec!=='')?Math.max(0,Math.min(4,parseInt(c.dec))):0;
    var t=v.toFixed(d).replace('.',',');
    if(c.tsd!==false&&Math.abs(v)>=1000)t=t.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    return t+(c.unit?(' '+c.unit):'');
  }
  /** Farbe einer Kennzahl nach Schwellen: unter warn = Warnung, unter crit = Kritisch. */
  function _hyFarbe(w,c,v){
    if(v==null)return cssv('--faint');
    var kr=(c.crit!=null&&c.crit!=='')?parseFloat(c.crit):null;
    var wa=(c.warn!=null&&c.warn!=='')?parseFloat(c.warn):null;
    if(c.invers){ if(kr!=null&&v>=kr)return cssv('--crit'); if(wa!=null&&v>=wa)return cssv('--warn'); }
    else        { if(kr!=null&&v<=kr)return cssv('--crit'); if(wa!=null&&v<=wa)return cssv('--warn'); }
    return cssv('--text');
  }

  // ---------------------------------------------------------------- Daten holen
  function _hyBaum(liste){
    var kn={},kinder={},wurzeln=[];
    (liste||[]).forEach(function(x){
      if(!x||x.id==null)return;
      kn[String(x.id)]={id:String(x.id),parent:(x.parent==null?'':String(x.parent)),
        label:String(x.label==null?x.id:x.label),sub:String(x.sub||''),typ:String(x.typ||''),
        werte:(x.werte&&typeof x.werte==='object')?x.werte:{},zustand:String(x.zustand||''),
        link:String(x.link||'kabel')};
    });
    Object.keys(kn).forEach(function(id){
      var p=kn[id].parent;
      if(p&&kn[p]){(kinder[p]=kinder[p]||[]).push(id);}else{wurzeln.push(id);}
    });
    // Alphabetisch je Ebene, damit die Reihenfolge nicht von der Quelle abhaengt
    Object.keys(kinder).forEach(function(p){kinder[p].sort(function(a,b){
      return kn[a].label.localeCompare(kn[b].label,'de',{sensitivity:'base'});});});
    wurzeln.sort(function(a,b){return kn[a].label.localeCompare(kn[b].label,'de',{sensitivity:'base'});});
    // Tiefe und Teilbaumsumme je Kennzahl. Ein Ring darf sich nicht aufhaengen -> besucht merken.
    var gesehen={};
    function lauf(id,t){
      if(gesehen[id])return {}; gesehen[id]=1;
      var k=kn[id]; k.tiefe=t; k.summe={};
      Object.keys(k.werte).forEach(function(f){var v=parseFloat(k.werte[f]);if(!isNaN(v))k.summe[f]=v;});
      (kinder[id]||[]).forEach(function(c){
        var s=lauf(c,t+1);
        Object.keys(s).forEach(function(f){k.summe[f]=(k.summe[f]||0)+s[f];});
      });
      return k.summe;
    }
    wurzeln.forEach(function(r){lauf(r,0);});
    return {kn:kn,kinder:kinder,wurzeln:wurzeln,
            reihen:(function(){var out=[];function f(id){out.push(kn[id]);(kinder[id]||[]).forEach(f);}wurzeln.forEach(f);return out;})()};
  }

  function _hyEl(w){return $('.w[data-id="'+w.id+'"]',canvas)
    ||((_popup&&$('#ovcanvas'))?$('.w[data-id="'+w.id+'"]',$('#ovcanvas')):null);}
  function _hyModus(w){
    var m=w.hyMode||'tree';
    if(w._hyM&&_HY_MODI.some(function(o){return o[0]===w._hyM;}))m=w._hyM;
    return m;
  }
  function _hyHolen(w){
    var fertig=function(liste,fehler){
      _hyD[w.id]=fehler?{fehler:fehler}:_hyBaum(liste);
      _hyZeichnen(w);
    };
    if((w.hySrc||'unifi')==='unifi'){
      fetch('?api=hierarchy&src=unifi'+(w.varId2?('&keyvar='+encodeURIComponent(w.varId2)):'')
            +(w.hyHost?('&host='+encodeURIComponent(w.hyHost)):''),{cache:'no-store'})
        .then(function(r){return r.json();})
        .then(function(j){ if(j&&j.error){fertig(null,j.error);return;} fertig((j&&j.nodes)||[]); })
        .catch(function(){fertig(null,'Abruf fehlgeschlagen');});
      return;
    }
    if(!w.varId){fertig(null,'Variable wählen');return;}
    var lv=_lastVals[w.varId];
    if(!lv){fertig(null,'kein Wert');return;}
    try{
      var j=JSON.parse(String(lv.v));
      fertig(Array.isArray(j)?j:((j&&j.nodes)||[]));
    }catch(e){fertig(null,'kein gültiges JSON');}
  }

  // ---------------------------------------------------------------- Kopfzeile
  function _hyKopf(w){
    var titel=(w.label||'')!==''
      ? '<div style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap">'+esc(w.label)+'</div>' : '';
    var sw='';
    if(w.hySw!==false){
      var akt=_hyModus(w);
      sw='<div class="hysw">'+_HY_MODI.map(function(o){
        return '<span class="hyswc'+(o[0]===akt?'':' off')+'" data-hysw="'+o[0]+'">'+o[1]+'</span>';}).join('')+'</div>';
    }
    if(!titel&&!sw)return '';
    return '<div class="hyhead">'+titel+'<span style="flex:1"></span>'+sw+'</div>';
  }

  // ---------------------------------------------------------------- A  Baum
  function _hyBaumHtml(w,D,bx,by){
    var sp=_hySpalten(w), zh=Math.max(15,Math.min(26,Math.floor((by-6)/Math.max(1,D.reihen.length))));
    var kopf='<div class="hyrow hyhd">'
      +'<div class="hynm">Knoten</div>'
      +sp.map(function(c){return '<div class="hyc" style="width:'+(c.art==='balken'?96:64)+'px">'+esc(c.label||c.feld)+'</div>';}).join('')
      +'</div>';
    var zeilen=D.reihen.map(function(k){
      var zc=_hyZustand(k.zustand);
      var strich=k.tiefe>0
        ? '<span class="hyln" style="border-top-style:'+(k.link==='funk'?'dashed':'solid')+';border-top-color:'
          +(k.link==='funk'?'var(--muted)':'var(--line)')+'"></span>' : '';
      return '<div class="hyrow" data-hyid="'+esc(k.id)+'" style="height:'+zh+'px">'
        +'<div class="hynm" style="padding-left:'+(k.tiefe*13)+'px">'+strich
        + _hySvg(_hyTypIkon(w,k.typ),_hyTypFarbe(w,k.typ),Math.min(14,zh-4))
        +'<span class="hylbl">'+esc(k.label)+'</span>'
        +(k.sub?'<span class="hysub mono">'+esc(k.sub)+'</span>':'')
        +(zc?'<span class="hydot" style="background:'+zc+'"></span>':'')
        +'</div>'
        + sp.map(function(c){
            var v=_hyZahl(w,c,k.werte[c.feld]), f=_hyFarbe(w,c,v);
            if(c.art==='balken'){
              var mx=D.max&&D.max[c.feld]?D.max[c.feld]:1;
              var q=(v==null||mx<=0)?0:Math.max(0,Math.min(100,v/mx*100));
              return '<div class="hyc" style="width:96px"><span class="hybar"><i style="width:'+q.toFixed(1)+'%;background:'+f+'"></i></span>'
                +'<span class="hyv mono" style="color:'+f+'">'+_hyTxt(c,v)+'</span></div>';
            }
            if(c.art==='ampel'){
              return '<div class="hyc" style="width:64px"><span class="hydot" style="background:'+f+'"></span>'
                +'<span class="hyv mono" style="color:'+f+'">'+_hyTxt(c,v)+'</span></div>';
            }
            return '<div class="hyc" style="width:64px"><span class="hyv mono" style="color:'+f+'">'+_hyTxt(c,v)+'</span></div>';
          }).join('')
        +'</div>';
    }).join('');
    return '<div class="hylist">'+kopf+zeilen+'</div>';
  }

  // ---------------------------------------------------------------- B  Last (Icicle)
  function _hyLastHtml(w,D,bx,by){
    var sp=_hySpalten(w); if(!sp.length)return '<div class="hyleer">Keine Kennzahl gewählt</div>';
    var feld=(w.hyFeld&&sp.some(function(c){return c.feld===w.hyFeld;}))?w.hyFeld:sp[0].feld;
    var tiefe=1; D.reihen.forEach(function(k){tiefe=Math.max(tiefe,k.tiefe+1);});
    var s=bx/tiefe, out=[];
    function block(id,y0,h,t){
      var k=D.kn[id]; if(h<1.2)return;
      var x=t*s, b=Math.max(2,s-3), fc=_hyTypFarbe(w,k.typ), zc=_hyZustand(k.zustand);
      out.push('<rect x="'+x.toFixed(1)+'" y="'+y0.toFixed(1)+'" width="'+b.toFixed(1)+'" height="'+h.toFixed(1)
        +'" rx="3" fill="'+fc+'" fill-opacity="0.18" stroke="'+fc+'" stroke-width="1" stroke-opacity="0.55"'
        +(k.link==='funk'?' stroke-dasharray="3 2"':'')+'/>');
      if(zc)out.push('<rect x="'+x.toFixed(1)+'" y="'+y0.toFixed(1)+'" width="2.5" height="'+h.toFixed(1)+'" rx="1.2" fill="'+zc+'"/>');
      if(h>=13)out.push('<text x="'+(x+7)+'" y="'+(y0+h/2+3.4).toFixed(1)+'" fill="var(--text)" font-size="10" font-weight="600">'
        +esc(k.label.slice(0,Math.max(3,Math.floor(b/6))))+'</text>');
      if(h>=26)out.push('<text x="'+(x+7)+'" y="'+(y0+h/2+15).toFixed(1)+'" fill="var(--muted)" font-size="9" class="mono">'
        +esc(_hyTxt({dec:0},k.summe[feld]==null?null:k.summe[feld]))+'</text>');
      var kk=D.kinder[id]||[]; if(!kk.length)return;
      var gs=0; kk.forEach(function(c){gs+=(D.kn[c].summe[feld]||0);});
      // Ist die Kennzahl im ganzen Teilbaum 0 (ein Zweig ohne Clients, oder eine Kennzahl
      // die es dort nicht gibt), waeren alle Kinder unsichtbar - der Ast bricht scheinbar ab.
      // Dann gleichmaessig teilen: die Struktur bleibt sichtbar, nur ohne Gewichtung.
      var gleich=(gs<=0);
      var yy=y0;
      kk.forEach(function(c){
        var ch=gleich?(h/kk.length):(h*(D.kn[c].summe[feld]||0)/gs);
        block(c,yy,ch-1.5,t+1); yy+=ch;});
    }
    var ges=0; D.wurzeln.forEach(function(r){ges+=(D.kn[r].summe[feld]||0);});
    var yy=0;
    D.wurzeln.forEach(function(r){
      var h=(ges>0)?(by*(D.kn[r].summe[feld]||0)/ges):(by/D.wurzeln.length);
      block(r,yy,h-2,0); yy+=h;});
    return '<svg class="hysvg" viewBox="0 0 '+bx+' '+by+'" preserveAspectRatio="xMidYMid meet">'+out.join('')+'</svg>';
  }

  // ---------------------------------------------------------------- C  Graph
  function _hyGraphHtml(w,D,bx,by){
    var blaetter=[];
    function zaehl(id){var kk=D.kinder[id]||[];if(!kk.length){blaetter.push(id);return;}kk.forEach(zaehl);}
    D.wurzeln.forEach(zaehl);
    var zeile={}; blaetter.forEach(function(id,i){zeile[id]=i;});
    function ypos(id){var kk=D.kinder[id]||[];if(!kk.length)return zeile[id];
      var ys=kk.map(ypos);return (Math.min.apply(null,ys)+Math.max.apply(null,ys))/2;}
    var tiefe=1; D.reihen.forEach(function(k){tiefe=Math.max(tiefe,k.tiefe+1);});
    var sx=bx/tiefe, sy=by/Math.max(1,blaetter.length);
    var kb=Math.max(46,sx-24), kh=Math.max(18,Math.min(34,sy-6));
    var sp=_hySpalten(w), feld=sp.length?((w.hyFeld&&sp.some(function(c){return c.feld===w.hyFeld;}))?w.hyFeld:sp[0].feld):null;
    var kanten=[],knoten=[];
    D.reihen.forEach(function(k){
      var x=k.tiefe*sx, cy=ypos(k.id)*sy+sy/2;
      (D.kinder[k.id]||[]).forEach(function(c){
        var kc=D.kn[c], x2=kc.tiefe*sx, cy2=ypos(c)*sy+sy/2, mx=x+kb+(sx-kb)/2;
        var st=1; if(feld){var v=kc.summe[feld]||0;st=Math.max(1,Math.min(4,0.9+v*0.14));}
        kanten.push('<path d="M'+(x+kb).toFixed(1)+' '+cy.toFixed(1)+' H'+mx.toFixed(1)+' V'+cy2.toFixed(1)
          +' H'+x2.toFixed(1)+'" fill="none" stroke="'+(kc.link==='funk'?'var(--muted)':'var(--line)')
          +'" stroke-width="'+st.toFixed(1)+'" stroke-opacity="0.55"'+(kc.link==='funk'?' stroke-dasharray="4 3"':'')+'/>');
      });
      var fc=_hyTypFarbe(w,k.typ), zc=_hyZustand(k.zustand);
      var g='<g transform="translate('+x.toFixed(1)+','+(cy-kh/2).toFixed(1)+')">'
        +'<rect width="'+kb.toFixed(1)+'" height="'+kh+'" rx="7" fill="var(--surface)" stroke="var(--line)"/>'
        +'<rect width="2.5" height="'+kh+'" rx="1.2" fill="'+fc+'"/>'
        +'<text x="9" y="'+(kh>=28?12.5:kh/2+3.5)+'" fill="var(--text)" font-size="9.5" font-weight="600">'
        + esc(k.label.slice(0,Math.max(3,Math.floor(kb/5.6))))+'</text>';
      if(kh>=28&&k.sub)g+='<text x="9" y="24" fill="var(--faint)" font-size="8.5" class="mono">'+esc(k.sub.slice(0,12))+'</text>';
      if(zc)g+='<circle cx="'+(kb-9).toFixed(1)+'" cy="9" r="3" fill="'+zc+'"/>';
      knoten.push(g+'</g>');
    });
    return '<svg class="hysvg" viewBox="0 0 '+bx+' '+by+'" preserveAspectRatio="xMidYMid meet">'
      +kanten.join('')+knoten.join('')+'</svg>';
  }

  // ---------------------------------------------------------------- D  Ring
  function _hyRingHtml(w,D,bx,by){
    var sp=_hySpalten(w);
    var feld=sp.length?((w.hyFeld&&sp.some(function(c){return c.feld===w.hyFeld;}))?w.hyFeld:sp[0].feld):null;
    var tiefe=1; D.reihen.forEach(function(k){tiefe=Math.max(tiefe,k.tiefe+1);});
    var cx=bx/2, cy=by/2, r0=Math.max(18,Math.min(bx,by)*0.06);
    var rmax=Math.min(bx,by)/2-8, rw=(rmax-r0)/tiefe;
    var out=[];
    function pkt(rr,a){return [cx+rr*Math.cos(a),cy+rr*Math.sin(a)];}
    function bogen(id,a0,a1,t){
      var k=D.kn[id]; if(a1-a0<0.004)return;
      var ri=r0+t*rw, ra=ri+rw-1.6;
      var p0=pkt(ra,a0),p1=pkt(ra,a1),p2=pkt(ri,a1),p3=pkt(ri,a0),gr=(a1-a0)>Math.PI?1:0;
      var fc=_hyTypFarbe(w,k.typ), zc=_hyZustand(k.zustand);
      out.push('<path d="M'+p0[0].toFixed(2)+' '+p0[1].toFixed(2)+' A'+ra.toFixed(2)+' '+ra.toFixed(2)+' 0 '+gr+' 1 '
        +p1[0].toFixed(2)+' '+p1[1].toFixed(2)+' L'+p2[0].toFixed(2)+' '+p2[1].toFixed(2)+' A'+ri.toFixed(2)+' '+ri.toFixed(2)
        +' 0 '+gr+' 0 '+p3[0].toFixed(2)+' '+p3[1].toFixed(2)+' Z" fill="'+fc+'" fill-opacity="'+(t===0?0.30:0.19)
        +'" stroke="'+fc+'" stroke-width="0.8" stroke-opacity="0.6"'+(k.link==='funk'?' stroke-dasharray="3 2"':'')+'/>');
      if(zc){var xa=pkt(ri+1.4,a0),xb=pkt(ri+1.4,a1);
        out.push('<path d="M'+xa[0].toFixed(2)+' '+xa[1].toFixed(2)+' A'+(ri+1.4).toFixed(2)+' '+(ri+1.4).toFixed(2)
          +' 0 '+gr+' 1 '+xb[0].toFixed(2)+' '+xb[1].toFixed(2)+'" fill="none" stroke="'+zc+'" stroke-width="2.2"/>');}
      // Beschriftung nur, wo der Bogen sie traegt. Zwei Ausschluesse:
      //  - die Wurzel (t=0) haette ihr Label mitten im Kern liegen,
      //  - ein Bogen, der fast den ganzen Kreis fuellt, hat seine Mitte dicht am Mittelpunkt;
      //    das Wort stuende dann senkrecht ueber der Nabe. Genau so sah es im ersten Lauf aus:
      //    "USW HR Aggregation" lag als weisser Strich quer durch die Mitte.
      if(t>0&&(a1-a0)<Math.PI*1.6&&(a1-a0)*ri>26&&t<=3){
        var am=(a0+a1)/2, m=pkt((ri+ra)/2,am), gd=am*180/Math.PI, dreh=(gd>90&&gd<270)?gd+180:gd;
        out.push('<text x="'+m[0].toFixed(1)+'" y="'+(m[1]+3).toFixed(1)+'" fill="var(--text)" font-size="8.5" '
          +'font-weight="600" text-anchor="middle" transform="rotate('+dreh.toFixed(1)+' '+m[0].toFixed(1)+' '+m[1].toFixed(1)+')">'
          +esc(k.label.slice(0,14))+'</text>');
      }
      var kk=D.kinder[id]||[]; if(!kk.length)return;
      var gs=0; kk.forEach(function(c){gs+=feld?(D.kn[c].summe[feld]||0):1;});
      var gleich=(!feld||gs<=0);   // ohne Kennzahl oder mit lauter Nullen gleichmaessig teilen
      var aa=a0;
      kk.forEach(function(c){
        var anteil=gleich?(1/kk.length):((D.kn[c].summe[feld]||0)/gs);
        var span=(a1-a0)*anteil; bogen(c,aa,aa+span,t+1); aa+=span;});
    }
    var ges=0; D.wurzeln.forEach(function(r){ges+=feld?(D.kn[r].summe[feld]||0):1;});
    var gleichW=(!feld||ges<=0);
    var aa=-Math.PI/2;
    D.wurzeln.forEach(function(r){var anteil=gleichW?(1/D.wurzeln.length):((D.kn[r].summe[feld]||0)/ges);
      bogen(r,aa,aa+2*Math.PI*anteil,0); aa+=2*Math.PI*anteil;});
    for(var i=0;i<tiefe;i++)out.push('<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+(r0+i*rw).toFixed(1)
      +'" fill="none" stroke="var(--line)" stroke-opacity="0.35"/>');
    out.push('<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+(r0-4).toFixed(1)+'" fill="var(--surface)" stroke="var(--line)"/>');
    return '<svg class="hysvg" viewBox="0 0 '+bx+' '+by+'" preserveAspectRatio="xMidYMid meet">'+out.join('')+'</svg>';
  }

  // ---------------------------------------------------------------- Zeichnen
  function _hyZeichnen(w){
    var el=_hyEl(w); if(!el)return;
    var box=$('[data-role=hy]',el); if(!box)return;
    var D=_hyD[w.id];
    if(!D){box.innerHTML='<div class="hyleer">lädt …</div>';return;}
    if(D.fehler){box.innerHTML='<div class="hyleer">'+esc(D.fehler)+'</div>';return;}
    if(!D.reihen||!D.reihen.length){box.innerHTML='<div class="hyleer">keine Knoten</div>';return;}
    // Groesster Wert je Kennzahl - fuer die Balkenbreite in der Baumansicht
    D.max={};
    _hySpalten(w).forEach(function(c){
      var m=0; D.reihen.forEach(function(k){var v=parseFloat(k.werte[c.feld]);if(!isNaN(v))m=Math.max(m,Math.abs(v));});
      D.max[c.feld]=m;
    });
    var bx=Math.max(120,box.clientWidth||w.w||400), by=Math.max(80,box.clientHeight||w.h||300);
    var m=_hyModus(w);
    box.innerHTML = m==='load' ? _hyLastHtml(w,D,bx,by)
                  : m==='graph'? _hyGraphHtml(w,D,bx,by)
                  : m==='ring' ? _hyRingHtml(w,D,bx,by)
                  :               _hyBaumHtml(w,D,bx,by);
  }

  defWidget('hierarchy',{
    label:'Hierarchie', cat:'Zustand & Listen', paletteIcon:'wchart', size:[520,340],
    noHover:true,   // die Umschaltpillen sind die Klickziele, kein Ganz-Widget-Hover
    render:function(w){
      return '<div class="whierarchy" style="position:absolute;inset:0;display:flex;flex-direction:column;padding:10px 12px;box-sizing:border-box">'
        + _hyKopf(w)
        + '<div data-role="hy" style="flex:1;min-height:0;overflow:hidden;position:relative"></div>'
        + '</div>';
    },
    mount:function(w){ _hyHolen(w); },
    click:function(w,el,e){
      var s=e.target.closest('[data-hysw]'); if(!s)return false;
      var m=s.getAttribute('data-hysw');
      if(!m||m===_hyModus(w))return true;
      // Nur die ANSICHT wechseln - die Daten bleiben, ein neuer Abruf waere sinnlos.
      w._hyM=m;
      var host=el.querySelector('.winner')||el;
      host.innerHTML=WIDGETS.hierarchy.render(w);
      _hyZeichnen(w);
      return true;
    },
    props:function(w){
      var src=w.hySrc||'unifi';
      var h=row('Quelle','<select id="pHySrc">'
          +'<option value="unifi"'+(src==='unifi'?' selected':'')+'>UniFi (eingebaut)</option>'
          +'<option value="var"'+(src==='var'?' selected':'')+'>Variable mit JSON</option></select>');
      if(src==='unifi'){
        h+=row('API-Schlüssel (Var)','<input id="pHyKey" value="'+(w.varId2||'')+'" placeholder="ID der Schlüssel-Variablen"> <button class="btn" id="pHyKeyP" style="padding:6px 8px">wählen</button>')
          +row('Controller','<input id="pHyHost" value="'+esc(w.hyHost||'')+'" placeholder="10.10.10.254">')
          +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">Holt Geräte und Uplinks selbst. Ohne Angaben gelten die Vorgaben aus dem Handler.</div>';
      } else {
        h+=row('Variable (JSON)','<input id="pHyVar" value="'+esc(w.varId||'')+'" placeholder="ID"> <button class="btn" id="pHyVarP" style="padding:6px 8px">wählen</button>')
          +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 6px">String-Variable mit einer Liste: id, parent, label, sub, typ, werte, zustand, link. Ein Skript füllt sie.</div>';
      }
      h+='<div class="pgh">Ansicht</div>'
        +row('Vorgabe','<select id="pHyMode">'+_HY_MODI.map(function(o){
             return '<option value="'+o[0]+'"'+((w.hyMode||'tree')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>')
        +row('Umschalter','<input type="checkbox" id="pHySw"'+(w.hySw!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Pillen in der Kopfzeile</span>')
        +row('Größenkennzahl','<input id="pHyFeld" value="'+esc(w.hyFeld||'')+'" placeholder="erste Spalte"> <span style="font-size:11px;color:var(--muted)">bestimmt Blockhöhe, Kantenstärke und Ringwinkel</span>');
      h+=listEditor(w,'hyCols','Kennzahlen-Spalten',[
          {k:'feld',ph:'Feld',h:'Feld'},{k:'label',ph:'Titel',h:'Titel'},
          {k:'art',type:'select',def:'zahl',h:'Art',options:[['zahl','Zahl'],['balken','Balken'],['ampel','Ampel']]},
          {k:'unit',ph:'Einh.',h:'Einheit'},{k:'dec',ph:'Dez',h:'Dez'},
          {k:'warn',ph:'Warn',h:'Warnung ab'},{k:'crit',ph:'Krit',h:'Kritisch ab'},
          {k:'invers',type:'check',h:'mehr = schlechter'}]);
      h+=listEditor(w,'hyTypes','Typen: Schlüssel · Symbol · Farbe',[
          {k:'typ',ph:'z. B. sw',h:'Typ'},
          {k:'icon',type:'select',def:'box',h:'Symbol',options:[['gw','Gateway'],['sw','Switch'],['ap','Access Point'],['srv','Server'],['box','Kasten'],['dot','Punkt']]},
          {k:'color',type:'skincolor',h:'Farbe'}]);
      return h;
    },
    wire:function(w){
      var neu=function(){delete _hyD[w.id];render();_hyHolen(w);commit();};
      if($('#pHySrc'))$('#pHySrc').onchange=function(){w.hySrc=this.value;renderProps();neu();};
      if($('#pHyKey'))$('#pHyKey').oninput=function(){w.varId2=parseInt(this.value)||undefined;neu();};
      if($('#pHyHost'))$('#pHyHost').oninput=function(){w.hyHost=this.value.trim()||undefined;neu();};
      if($('#pHyVar'))$('#pHyVar').oninput=function(){w.varId=parseInt(this.value)||undefined;neu();};
      // Bindung ueber den Variablenbaum, wie bei allen anderen Widgets: der Klick im Baum
      // schreibt in varId bzw. varId2 und zeichnet neu.
      if($('#pHyKeyP'))$('#pHyKeyP').onclick=function(){showTab('vars');toast('Variable mit dem API-Schlüssel anklicken');_bindTarget2=w.id;};
      if($('#pHyVarP'))$('#pHyVarP').onclick=function(){showTab('vars');toast('Variable mit der JSON-Hierarchie anklicken');_bindTarget=w.id;};
      if($('#pHyMode'))$('#pHyMode').onchange=function(){w.hyMode=this.value;delete w._hyM;render();_hyZeichnen(w);commit();};
      if($('#pHySw'))$('#pHySw').onchange=function(){w.hySw=this.checked?undefined:false;render();_hyZeichnen(w);commit();};
      if($('#pHyFeld'))$('#pHyFeld').oninput=function(){w.hyFeld=this.value.trim()||undefined;_hyZeichnen(w);commit();};
    },
    live:function(w,el,id,d){
      if((w.hySrc||'unifi')!=='var'||id!==w.varId)return;
      if(_hyT[w.id])clearTimeout(_hyT[w.id]);
      _hyT[w.id]=setTimeout(function(){_hyHolen(w);},900);
    }
  });
