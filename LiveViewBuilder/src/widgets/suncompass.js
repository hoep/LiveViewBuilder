  // ===== Widget: Sonnenkompass (suncompass) — Haus + Sonnenstand + Einstrahlung =====
  //
  //  Raeumliche 2,5D-Darstellung EINER Beschattungs-Zone: Sky-Disc (Polar: Winkel=Azimut N oben,
  //  Radius=Elevation), Tages-Sonnenbogen mit Auf-/Untergang, das gedrehte Haus mit Fassaden-
  //  Richtung, die Einstrahlungs-Segmente (Fenster ±Winkel = cmp-hit, konfiguriertes Sonnenprofil
  //  = cmp-prof) und die LIVE-Sonne mit Glow. Damit sieht man sofort, ob die Sonne ins Fenster
  //  faellt und ob Soll (Profil) zur Ist-Lage passt. Datenquelle: ?api=mod reconcileProbe (read-only).
  //  Bindung: feste Zone (entityId) ODER Session (folgt der shadex-Familie).
  //  Sonnenbahn: NOAA-Position (gegen IPS Location #13098 verifiziert < 1 Grad).

  (function(){
    var _sc={};
    function scSt(w){return _sc[w.id]||(_sc[w.id]={d:null,err:''});}
    function scEntity(w){
      if((w.bind==='session') && typeof hfSess==='function'){var s=hfSess({session:w.session||'shade'});return (s&&s.roomIdx)||0;}
      return parseInt(w.entityId||0)||0;
    }
    function scMg(idx){return fetch('?api=mod&op=manage&id='+idx+'&key='+encodeURIComponent(TOKEN),
      {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify({op:'reconcileProbe'})}).then(function(r){return r.json();});}
    function scGeo(w){return {lat:(w.lat!=null?+w.lat:48.0657), lon:(w.lon!=null?+w.lon:14.1241)};}
    function scDemo(){return {inputs:{az:212,el:34,bright:41000},geoProfile:{azimuthBgn:109,azimuthEnd:289,elevation:8,brightnessMin:0},rawSun:100,driverActive:true};}

    // NOAA-Sonnenposition (gegen IPS Location verifiziert) — fuer den Tagesbogen
    function scSunPos(lat,lon,unixSec){
      var rad=Math.PI/180, deg=180/Math.PI;
      var JD=unixSec/86400+2440587.5, T=(JD-2451545)/36525;
      var L0=((280.46646+T*(36000.76983+T*0.0003032))%360+360)%360;
      var M=357.52911+T*(35999.05029-0.0001537*T), e=0.016708634-T*(0.000042037+0.0000001267*T), Mr=M*rad;
      var C=(1.914602-T*(0.004817+0.000014*T))*Math.sin(Mr)+(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr);
      var tl=L0+C, om=125.04-1934.136*T, al=tl-0.00569-0.00478*Math.sin(om*rad);
      var eps0=23+(26+((21.448-T*(46.815+T*(0.00059-T*0.001813))))/60)/60, eps=eps0+0.00256*Math.cos(om*rad);
      var decl=Math.asin(Math.sin(eps*rad)*Math.sin(al*rad))*deg;
      var y=Math.pow(Math.tan(eps/2*rad),2), L0r=L0*rad;
      var Eq=4*deg*(y*Math.sin(2*L0r)-2*e*Math.sin(Mr)+4*e*y*Math.sin(Mr)*Math.cos(2*L0r)-0.5*y*y*Math.sin(4*L0r)-1.25*e*e*Math.sin(2*Mr));
      var minUTC=(((unixSec%86400)+86400)%86400)/60;
      var tst=(((minUTC+Eq+4*lon)%1440)+1440)%1440, ha=tst/4-180; if(ha<-180)ha+=360;
      var latr=lat*rad, decr=decl*rad, har=ha*rad;
      var zen=Math.acos(Math.min(1,Math.max(-1,Math.sin(latr)*Math.sin(decr)+Math.cos(latr)*Math.cos(decr)*Math.cos(har))))*deg;
      var el=90-zen, elr=el*rad, refr=0;
      if(el>5&&el<=85)refr=(58.1/Math.tan(elr)-0.07/Math.pow(Math.tan(elr),3)+0.000086/Math.pow(Math.tan(elr),5))/3600;
      else if(el>-0.575&&el<=5)refr=(1735+el*(-518.2+el*(103.4+el*(-12.79+el*0.711))))/3600;
      else if(el<=-0.575)refr=(-20.772/Math.tan(elr))/3600;
      el+=refr;
      var azt=Math.acos(Math.min(1,Math.max(-1,((Math.sin(latr)*Math.cos(zen*rad))-Math.sin(decr))/(Math.cos(latr)*Math.sin(zen*rad)))))*deg;
      var az=ha>0?(azt+180)%360:(540-azt)%360;
      return {az:az,elev:el};
    }
    function scDayTrack(geo){
      var now=new Date(), mid=new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0).getTime()/1000, pts=[];
      for(var m=0;m<=1440;m+=5){var p=scSunPos(geo.lat,geo.lon,mid+m*60);pts.push({az:p.az,elev:p.elev});}
      return {pts:pts};
    }
    // Fenster [bgn,end] -> Mitte (Fassaden-Azimut) + Halbbreite
    function scWindow(gp){
      var b=gp.azimuthBgn, e=gp.azimuthEnd;
      if(b==null||e==null)return null;
      var ee=e; if(ee<b)ee+=360;
      return {bgn:b, end:e, fz:((b+ee)/2)%360, half:(ee-b)/2};
    }

    function scCompass(w,d){
      var gp=d.geoProfile||{}, win=scWindow(gp), geo=scGeo(w);
      var acc=(w.sunAcc!=null?+w.sunAcc:(win?win.half:90));
      var fz=win?win.fz:null;
      var elMin=(gp.elevation==null?0:+gp.elevation);
      var az=(d.inputs&&d.inputs.az!=null)?+d.inputs.az:null, el=(d.inputs&&d.inputs.el!=null)?+d.inputs.el:null;
      var track=scDayTrack(geo), eff=(az!=null?{az:az,elev:el}:null);
      var acc2=(w.accent?(_skinColor(w.accent)||w.accent):'');

      var CX=180,CY=180,R=150,HR=48;
      function rOf(e){return R*(90-Math.max(0,e))/90;}
      function ang(a){return (a-90)*Math.PI/180;}
      function P(a,e){var r=rOf(e),an=ang(a);return [CX+r*Math.cos(an),CY+r*Math.sin(an)];}
      function wedge(aS,aE,eIn,eOut){var rIn=Math.max(rOf(eIn),HR),rO=rOf(eOut),p='M',a,x,y;
        for(a=aS;a<=aE+0.001;a+=2){x=CX+rO*Math.cos(ang(a));y=CY+rO*Math.sin(ang(a));p+=x.toFixed(1)+','+y.toFixed(1)+' ';}
        for(a=aE;a>=aS-0.001;a-=2){x=CX+rIn*Math.cos(ang(a));y=CY+rIn*Math.sin(ang(a));p+=x.toFixed(1)+','+y.toFixed(1)+' ';}
        return p+'Z';}
      // Gitter (Elevations-Ringe + Azimut-Speichen)
      var g='';[30,60].forEach(function(e){g+='<circle cx="180" cy="180" r="'+rOf(e).toFixed(1)+'"/>';});
      for(var a=0;a<360;a+=45){var gp2=P(a,0);g+='<line x1="180" y1="180" x2="'+gp2[0].toFixed(1)+'" y2="'+gp2[1].toFixed(1)+'"/>';}
      var lab='';[['N',0],['O',90],['S',180],['W',270]].forEach(function(t){var lp=P(t[1],-8);lab+='<text x="'+lp[0].toFixed(1)+'" y="'+(lp[1]+4).toFixed(1)+'">'+t[0]+'</text>';});
      // Tages-Sonnenbogen + Auf-/Untergang
      var arc='',started=false,rise=null,set=null;
      track.pts.forEach(function(pt){if(pt.elev>0){var p=P(pt.az,pt.elev);arc+=(started?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)+' ';if(!started){rise=pt;started=true;}set=pt;}});
      var rm=rise?P(rise.az,0):null, sm=set?P(set.az,0):null;
      // Einstrahlungs-Segmente: Fenster (hit) + konfiguriertes Sonnenprofil (prof)
      var hitSec=fz!=null?'<path class="cmp-hit" d="'+wedge(fz-acc,fz+acc,0,90)+'"/>':'';
      var profSec='';
      if(win){var pe=win.end;if(pe<win.bgn)pe+=360;profSec='<path class="cmp-prof" d="'+wedge(win.bgn,pe,elMin,90)+'"/>';}
      // Haus: gedreht in Fassaden-Richtung + Fassaden-Linie
      var house='';
      if(fz!=null){
        house='<g transform="rotate('+fz.toFixed(1)+' 180 180)"><rect x="150" y="156" width="60" height="48" rx="7" fill="var(--surface)" stroke="var(--line)"/><line x1="150" y1="156" x2="210" y2="156" stroke="var(--accent)" stroke-width="3.5"/></g>';
        var ap=[CX+62*Math.cos(ang(fz)),CY+62*Math.sin(ang(fz))];
        house+='<line x1="180" y1="180" x2="'+ap[0].toFixed(1)+'" y2="'+ap[1].toFixed(1)+'" stroke="var(--accent)" stroke-width="3" stroke-dasharray="2 3"/>';
      } else {
        house='<rect x="150" y="156" width="60" height="48" rx="7" fill="var(--surface)" stroke="var(--line)"/>';
      }
      // Live-Sonne + Strahl
      var up=eff&&eff.elev>0, rp=eff?P(eff.az,0):[CX,30], spos=eff?P(eff.az,Math.max(eff.elev,0)):[CX,CY];
      var ray=eff?'<line x1="180" y1="180" x2="'+rp[0].toFixed(1)+'" y2="'+rp[1].toFixed(1)+'" stroke="#f5a623" stroke-opacity="'+(up?0.35:0.12)+'" stroke-width="1.5"/>':'';
      var sun=eff?'<g transform="translate('+spos[0].toFixed(1)+' '+spos[1].toFixed(1)+')" opacity="'+(up?1:0.15)+'"><circle r="20" fill="url(#sccglow)"/><circle r="6" fill="#ffcb52" stroke="#f5a623" stroke-width="1.5"/></g>':'';
      return '<svg class="cmp" viewBox="0 0 360 360" preserveAspectRatio="xMidYMid meet"'+(acc2?' style="--accent:'+esc(acc2)+'"':'')+'>'
        +'<defs><radialGradient id="sccsky" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="var(--surface-2)"/><stop offset="100%" stop-color="var(--tile)"/></radialGradient>'
        +'<radialGradient id="sccglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffcb52" stop-opacity="0.9"/><stop offset="60%" stop-color="#f5a623" stop-opacity="0.25"/><stop offset="100%" stop-color="#f5a623" stop-opacity="0"/></radialGradient></defs>'
        +'<circle cx="180" cy="180" r="150" fill="url(#sccsky)" stroke="var(--line)"/>'
        +'<g fill="none" stroke="var(--line-soft)">'+g+'</g>'+hitSec+profSec
        +'<path d="'+arc+'" fill="none" stroke="#f5a623" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>'
        +(rm?'<circle cx="'+rm[0].toFixed(1)+'" cy="'+rm[1].toFixed(1)+'" r="3.5" fill="#f5a623"/>':'')
        +(sm?'<circle cx="'+sm[0].toFixed(1)+'" cy="'+sm[1].toFixed(1)+'" r="3.5" fill="#f5a623"/>':'')
        +'<g font-size="12" font-weight="600" fill="var(--muted)" text-anchor="middle">'+lab+'</g>'
        +house+ray+sun+'</svg>';
    }

    function scBadges(d){
      var gp=d.geoProfile||{}, win=scWindow(gp);
      var az=(d.inputs&&d.inputs.az!=null)?+d.inputs.az:null, el=(d.inputs&&d.inputs.el!=null)?+d.inputs.el:null;
      var elMin=(gp.elevation==null?0:+gp.elevation);
      var inWin=(win&&az!=null)?( (function(){var b=win.bgn,e=win.end,ee=(e<b?e+360:e),a=(az<b?az+360:az);return a>=b&&a<=ee;})() ):false;
      var isEl=(el!=null)&&el>=elMin;
      var hit=inWin&&isEl&&(el>0);
      var pos=(el!=null&&el>0)?(Math.round(az)+'° / '+Math.round(el)+'°'):(el!=null?'unter Horizont':'—');
      var verdict=(el==null)?'—':(el<=0?'Nacht':(hit?'ja':(!inWin?'außerhalb Fenster':'unter Schwelle')));
      // Ist-Schließung = tatsächliche aktuelle Rollo-Position (nicht der Soll/Schließgrad,
      // der ist im Besonnung-Widget einstellbar). -1 = unbekannt.
      var cur=(d.current!=null?+d.current:null);
      return '<div class="span-status">'
        +'<div class="span-badge'+(hit?' on-sun':'')+'">Fenster besonnt<b>'+esc(verdict)+'</b></div>'
        +'<div class="span-badge">Schließung Ist<b>'+((cur!=null&&cur>=0)?Math.round(cur)+' %':'?')+'</b></div>'
        +'<div class="span-badge">Azimut / Höhe<b>'+esc(pos)+'</b></div></div>';
    }

    function scRender(w){
      var st=scSt(w), doku=(typeof DOKU!=='undefined'&&DOKU);
      var d=doku?scDemo():st.d, idx=scEntity(w);
      if(!idx && !doku) return '<div class="span-sun span-sun-none">Keine Zone gebunden</div>';
      if(st.err) return '<div class="span-sun span-sun-none">nicht erreichbar</div>';
      if(!d) return '<div class="span-sun span-sun-none">Sonnenstand …</div>';
      if(d.driverActive===false) return '<div class="span-sun span-sun-none">Zone ohne Treiber</div>';
      if(!d.geoProfile) return '<div class="span-sun span-sun-none">Kein Sonnenstands-Profil gesetzt — im Editor „Sonne" konfigurieren.</div>';
      var win=scWindow(d.geoProfile);
      var head=win?('Fassade '+Math.round(win.fz)+'° · Fenster '+Math.round(win.bgn)+'–'+Math.round(win.end)+'°'):'kein Fenster';
      var h='<div class="span-sun">';
      h+='<div class="span-sun-h"><span><b>Sonnenstandsdiagramm</b></span><span class="span-sun-az">'+esc(head)+'</span></div>';
      h+=scCompass(w,d);
      h+='<div class="span-sun-legend"><span class="lg gold">Sonne / Bahn</span><span class="lg teal">Fenster / Profil</span></div>';
      h+=scBadges(d);
      h+='</div>';
      return h;
    }

    function scEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function scPaint(w){var el=scEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=scRender(w);}
    function scLoad(w){ if(typeof DOKU!=='undefined'&&DOKU){scPaint(w);return;} var idx=scEntity(w),st=scSt(w);
      if(!idx){scPaint(w);return;}
      scMg(idx).then(function(j){st.d=j;st.err='';scPaint(w);}).catch(function(){st.err='net';scPaint(w);}); }

    defWidget('suncompass',{
      label:'Sonnenstandsdiagramm', cat:'HomeSuite · Beschattung', paletteIcon:'sun', size:[360,470],
      defaults:function(w){w.bind='session';w.session='shade';},
      render:function(w){return scRender(w);},
      mount:function(w){var el=scEl(w);if(!el)return;
        if(w.bind!=='fixed' && typeof hfSub==='function')hfSub(w);
        scLoad(w);LVB.panel.startPoll('suncompass:'+w.id,60000,function(){scLoad(w);});},
      _bind:function(w,el){scLoad(w);},
      props:function(w){
        var h='<div class="pgh">Bindung</div>';
        h+=row('Modus','<select id="scBind"><option value="session"'+(w.bind!=='fixed'?' selected':'')+'>Session (folgt Auswahl)</option><option value="fixed"'+(w.bind==='fixed'?' selected':'')+'>Feste Zone</option></select>');
        if(w.bind!=='fixed'){ h+=row('Session-ID','<input id="scSess" value="'+esc(w.session||'shade')+'" placeholder="shade">'); }
        else { h+=row('Zone (Instanz-ID)','<input id="scEnt" type="number" value="'+(w.entityId||'')+'" placeholder="z. B. 25258">'); }
        h+='<div class="pgh">Darstellung</div>';
        h+=row('Akzentfarbe',skinSel(w.accent||'','id="scAcc"'));
        h+=row('Fenster-Halbwinkel','<input id="scAcc2" type="number" value="'+(w.sunAcc!=null?w.sunAcc:'')+'" placeholder="auto" style="width:70px"> °');
        h+='<div class="pgh">Standort (für Sonnenbahn)</div>';
        h+=row('Breite','<input id="scLat" type="number" step="0.0001" value="'+(w.lat!=null?w.lat:48.0657)+'" style="width:110px">');
        h+=row('Länge','<input id="scLon" type="number" step="0.0001" value="'+(w.lon!=null?w.lon:14.1241)+'" style="width:110px">');
        return h;
      },
      wire:function(w){
        if($('#scBind'))$('#scBind').onchange=function(){w.bind=this.value;commit();renderProps();var el=scEl(w);if(el)scLoad(w);};
        if($('#scSess'))$('#scSess').onchange=function(){w.session=this.value||undefined;commit();var el=scEl(w);if(el)scLoad(w);};
        if($('#scEnt'))$('#scEnt').onchange=function(){w.entityId=parseInt(this.value)||undefined;commit();var el=scEl(w);if(el)scLoad(w);};
        if($('#scAcc'))$('#scAcc').onchange=function(){w.accent=this.value||undefined;commit();var el=scEl(w);if(el)scPaint(w);};
        if($('#scAcc2'))$('#scAcc2').onchange=function(){var v=this.value.trim();w.sunAcc=(v===''?undefined:parseFloat(v));commit();var el=scEl(w);if(el)scPaint(w);};
        if($('#scLat'))$('#scLat').onchange=function(){w.lat=parseFloat(this.value);commit();var el=scEl(w);if(el)scPaint(w);};
        if($('#scLon'))$('#scLon').onchange=function(){w.lon=parseFloat(this.value);commit();var el=scEl(w);if(el)scPaint(w);};
      }
    });
  })();
