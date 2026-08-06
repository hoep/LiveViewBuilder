  // ===== Widget: Beschattungs-Panel (shadingpanel) — Rollos im Heizplan-Stil =====
  //
  //  EIN zusammenhängendes Panel für ALLE IPSShadowing-Rollos: Raum-Tabs (gruppiert EG/OG/
  //  Markise) + grosser Detailbereich (Jalousie-Visual, Slider, Presets, Automatik, Programme,
  //  Status) + Übersicht aller Rollos als Positionsbalken. Nutzt den Sammel-Abruf ?api=getall.

  var _spanState = {};
  var _spanTimer = null;
  var SPAN_PROGLBL = {day:'Tag', night:'Nacht', temp:'Temperatur', present:'Präsenz', bgn:'Tagesbeginn', end:'Tagesende', sun:'Sonne'};
  var SPAN_GORDER = ['EG','OG','Markise'];
  var SPAN_GLABEL = {EG:'ERDGESCHOSS', OG:'OBERGESCHOSS', Markise:'MARKISE'};

  // ===== Sonnenstands-Geometrie =====
  var SPAN_CARD={N:0,NO:45,O:90,SO:135,S:180,SW:225,W:270,NW:315};
  var SPAN_CARDLIST=['','N','NO','O','SO','S','SW','W','NW'];
  // Vorbelegung Fenster-Ausrichtung je Geräte-ID (aus User-Angaben; im Editor überschreibbar)
  var SPAN_ORIENT0={28117:'N',24100:'W',17932:'S',57271:'S',49885:'S',39715:'W',30490:'W',22196:'S',11288:'S',50655:'S',39848:'S',22145:'N',58077:'O',31918:'O',20571:'N',31153:'S',56448:'S'};
  var SPAN_SUNSVG='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>';
  function spanNorthDev(w){return (w&&w.northDev!=null)?(+w.northDev||0):19;}
  function spanAcc(w){return (w&&w.sunAcc!=null)?(+w.sunAcc||90):90;}
  function spanOri(w,id){var o=w&&w.orient&&w.orient[id];if(o===undefined||o===null)o=SPAN_ORIENT0[id];return o||'';}
  function spanFacadeAz(w,id){var c=spanOri(w,id);if(!c||SPAN_CARD[c]==null)return null;return ((SPAN_CARD[c]+spanNorthDev(w))%360+360)%360;}
  function spanAngDiff(a,b){return ((a-b+540)%360)-180;} // signed [-180,180]
  function spanInWin(az,bgn,end){var e=end;if(e<bgn)e+=360;var a=az;if(a<bgn)a+=360;return a>=bgn&&a<=e;}
  // Sonnenzustand fürs Fenster: {state:none|nodata|night|up|hit, hit, inc, d, phase, fz}
  function spanSunFor(w,id,sun){
    var fz=spanFacadeAz(w,id); if(fz==null)return {state:'none'};
    if(!sun||sun.elev==null)return {state:'nodata',fz:fz};
    if(sun.elev<=0)return {state:'night',fz:fz,az:sun.az,elev:sun.elev};
    var d=spanAngDiff(sun.az,fz), acc=spanAcc(w), hit=Math.abs(d)<=acc;
    var inc=hit?Math.max(0,Math.cos(d*Math.PI/180)):0;              // horizontaler Einfall 0..1
    var phase=Math.abs(d)<8?'steht':(d<0?'kommt':'geht');
    return {state:hit?'hit':'up',hit:hit,inc:inc,d:d,fz:fz,phase:phase,elev:sun.elev,az:sun.az};
  }
  // NOAA-Sonnenposition (gegen IPS Location verifiziert <1°) für den Tagesverlauf
  function spanSunPos(lat,lon,unixSec){
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
  // Tagesverlauf heute (5-Min-Schritte): Sonnenauf-/untergang + Fenster-Trefferfenster
  function spanDayTrack(w,id,geo){
    if(!geo||geo.lat==null)return null;
    var fz=spanFacadeAz(w,id);
    var now=new Date(), mid=new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0).getTime()/1000;
    var acc=spanAcc(w), pts=[];
    for(var m=0;m<=1440;m+=5){var p=spanSunPos(geo.lat,geo.lon,mid+m*60);
      pts.push({m:m,az:p.az,elev:p.elev,hit:(fz!=null&&p.elev>0&&Math.abs(spanAngDiff(p.az,fz))<=acc)});}
    return {mid:mid,fz:fz,pts:pts,nowM:(now.getTime()/1000-mid)/60};
  }
  function spanHHMM(m){var h=(m/60)|0,mm=Math.round(m%60);if(mm==60){h++;mm=0;}return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm;}
  function spanNowMin(){var d=new Date();return d.getHours()*60+d.getMinutes();}
  // effektive Sonne: simulierte Uhrzeit (st.simMin) oder live (st.sun)
  function spanEffSun(st){
    if(st.simMin==null||!st.geo||st.geo.lat==null)return st.sun;
    var n=new Date(), mid=new Date(n.getFullYear(),n.getMonth(),n.getDate(),0,0,0,0).getTime()/1000;
    var p=spanSunPos(st.geo.lat,st.geo.lon,mid+st.simMin*60);
    return {az:p.az,elev:p.elev,ts:0,sim:true,min:st.simMin};
  }
  // Sonnen-Glyph für eine Ledger-Zeile
  function spanSunCell(ss){
    var c='',svg=0,t='',inc=null;
    if(ss.state==='hit'){c=' on';svg=1;inc=ss.inc;t='Sonne trifft · Einfall '+Math.round(Math.abs(ss.d))+'° · '+ss.phase;}
    else if(ss.state==='up'){c=' dim';svg=1;t='Sonne oben, trifft nicht ('+ss.phase+', '+Math.round(Math.abs(ss.d))+'° seitlich)';}
    else if(ss.state==='night'){c=' off';t='Sonne unter Horizont';}
    return '<span class="rlg-sun'+c+'"'+(inc!=null?' style="--inc:'+inc.toFixed(2)+'"':'')+(t?' title="'+esc(t)+'"':'')+'>'+(svg?SPAN_SUNSVG:'')+'</span>';
  }

  function spanSt(w){return _spanState[w.id]||(_spanState[w.id]={loaded:false,all:null,order:[],sel:0,err:'',sun:null,geo:null,simMin:null,simTimer:null});}
  function spanDev(st,id){return st.all&&st.all[id];}
  function spanSel(st){return spanDev(st,st.sel);}

  function spanDemoAll(){return [
    {id:1,name:'Büro',group:'EG',position:{vid:1,value:0},automatic:{vid:2,value:true},info:'Tagesprogramm, Tag=06:00–20:56, Innen 24,8°, Außen 31°',programs:{day:{vid:11,value:1,options:[{v:1,name:'Offen'},{v:8,name:'50%'},{v:11,name:'Geschlossen'}]},night:{vid:12,value:11,options:[{v:1,name:'Offen'},{v:11,name:'Geschlossen'}]},sun:{vid:13,value:2,options:[{v:2,name:'Süd'},{v:0,name:'Aus'}]}}},
    {id:2,name:'Werkstatt West',group:'EG',position:{vid:3,value:0},automatic:{vid:4,value:true},info:'',programs:{}},
    {id:3,name:'Schlafzimmer',group:'OG',position:{vid:5,value:100},automatic:{vid:6,value:true},info:'',programs:{}},
    {id:4,name:'Wohnzimmer W.',group:'OG',position:{vid:7,value:53},automatic:{vid:8,value:false},info:'',programs:{}},
    {id:5,name:'Markise',group:'Markise',position:{vid:9,value:0},automatic:{vid:10,value:true},info:'',programs:{}}
  ];}

  // ============================ RENDER ============================
  function spanRender(w){
    var st=spanSt(w);
    if(!st.loaded)return '<div class="spanel spanel-msg">Beschattung lädt …</div>';
    if(st.err)return '<div class="spanel spanel-msg">'+esc(st.err)+'</div>';
    if(!st.order.length)return '<div class="spanel spanel-msg">Keine Rollos gefunden</div>';
    var d=spanSel(st)||spanDev(st,st.order[0].id); if(!d){st.sel=st.order[0].id;d=spanDev(st,st.sel);}
    var pos=(d.position&&d.position.value)|0, auto=!!(d.automatic&&d.automatic.value);
    var h='<div class="spanel">';
    // Kopf
    h+='<div class="span-head"><div class="span-title">'+escL(w.label||'Beschattung')+' <span class="span-sub">· '+esc(d.name)+'</span></div>'
      +'<button class="span-auto'+(auto?' on':'')+'" data-spanauto="1"><span class="span-dot"></span>Automatik '+(auto?'an':'aus')+'</button></div>';
    // Raum-Tabs gruppiert
    h+= spanTabs(st);
    // Körper
    h+='<div class="span-body"><div class="span-main">';
    // grosser Detail-Regler + Presets (Knopf-Beschriftungen aus w.presets)
    var pvals=[0,25,50,75,100], pdef=['Auf','25%','Halb','75%','Zu'], plbl=String(w.presets||pdef.join(',')).split(',');
    var presetH=pvals.map(function(v,i){return '<button data-spanpset="'+v+'">'+esc((plbl[i]||'').trim()||pdef[i])+'</button>';}).join('');
    h+='<div class="span-ctl"><div class="span-ctlr"><div class="span-posbig">'+pos+' <small>% geschlossen</small></div>'
      +'<input class="span-slider" type="range" min="0" max="100" step="1" value="'+pos+'" data-spanpos="1">'
      +'<div class="span-preset">'+presetH+'</div>'
      +(d.info?'<div class="span-info">'+esc(d.info)+'</div>':'')+'</div></div>';
    // Sonnenstands-Panel fürs gewählte Fenster
    h+= '<div class="span-sunwrap">'+spanSunPanel(w,st,d)+'</div>';
    // Sonnensimulation (Uhrzeit-Regler + Play)
    h+= spanSimStrip(w,st);
    // Übersicht aller Rollos (Ledger)
    h+= '<div class="span-ovwrap">'+spanOverview(w,st)+'</div>';
    h+='</div>';
    // Seite: Programme
    h+='<div class="span-side"><div class="span-boxh">Programme</div>';
    var progs=['day','night','sun','temp','present','bgn','end'];
    var any='';
    progs.forEach(function(k){var p=d.programs&&d.programs[k];if(!p)return;
      any+='<label class="span-prog"><span>'+esc(SPAN_PROGLBL[k]||k)+'</span><select data-spanprog="'+p.vid+'">'+(p.options||[]).map(function(o){return '<option value="'+o.v+'"'+(o.v==p.value?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'</select></label>';});
    h+=(any||'<div class="span-hint">Dieses Gerät hat keine Programm-Auswahlen.</div>')+'</div>';
    h+='</div></div>';
    return h;
  }

  function spanTabs(st){
    var byG={}; SPAN_GORDER.forEach(function(g){byG[g]=[];}); byG['']=[];
    st.order.forEach(function(r){(byG[r.group]||byG['']).push(r);});
    var h='<div class="span-rooms">';
    SPAN_GORDER.concat(['']).forEach(function(g){var list=byG[g];if(!list||!list.length)return;
      h+='<div class="span-rgrp">'+(g?'<span class="span-glab">'+esc(g)+'</span>':'')
        +list.map(function(r){return '<button class="span-room'+(r.id==st.sel?' on':'')+'" data-spanroom="'+r.id+'">'+esc(r.name)+'</button>';}).join('')+'</div>';
    });
    return h+'</div>';
  }
  function spanOverview(w,st){
    // „Ledger"-Liste: Raum · Positions-Regler · % · Sonne · Temperatur · Auto/Hand-Umschalter
    var eff=spanEffSun(st);
    var floors=[['OG','Obergeschoss'],['EG','Erdgeschoss'],['Markise','Markise']];
    var h='<div class="span-ovh">'+escL(w.ovTitle||'Alle Rollos')+' <span class="span-hint">· Zeile wählt · Auto/Hand schaltet</span></div><div class="span-ov"><div class="rlg">';
    floors.forEach(function(f){var g=f[0],list=st.order.filter(function(r){return r.group==g;});if(!list.length)return;
      h+='<div class="rlg-h"><b>'+esc(f[1])+'</b><hr><span>'+list.length+'</span></div>';
      list.forEach(function(r){var d=spanDev(st,r.id),pos=(d&&d.position&&d.position.value)|0,auto=!!(d&&d.automatic&&d.automatic.value),av=(d&&d.automatic&&d.automatic.vid)||0,pv=(d&&d.position&&d.position.vid)||0;
        var t=d&&d.temp, tv=t?(Math.round(t.value*10)/10):null;
        var tH=t?'<span class="rlg-temp'+(t.src=='auto'?' est':'')+'" title="'+(t.src=='auto'?'aus Beschattungs-Status':'Raumfühler')+'">'+tv+'°</span>':'<span class="rlg-temp"></span>';
        var sH=spanSunCell(spanSunFor(w,r.id,eff));
        h+='<div class="rlg-row'+(r.id==st.sel?' is-sel':'')+'" data-spanroom="'+r.id+'" style="--pos:'+pos+'" title="'+esc(r.name)+' · '+pos+' % geschlossen'+(t?' · '+tv+'°C':'')+'">'
          +'<span class="rlg-name">'+esc(r.name)+'</span>'
          +'<span class="rlg-rail" data-posvid="'+pv+'"><span class="rlg-track"></span><span class="rlg-thumb"></span></span>'
          +'<span class="rlg-pct">'+pos+'<u>%</u></span>'
          +sH
          +tH
          +'<span class="rlg-tog'+(auto?'':' man')+'" data-spantog="'+av+'" data-cur="'+(auto?1:0)+'" title="Automatik '+(auto?'an':'aus')+'"><b class="auto">Auto</b><b class="hand">Hand</b></span>'
          +'</div>';});
    });
    return h+'</div></div>';
  }

  // Sonnenstands-Panel fürs gewählte Fenster: Status + Tagesverlauf
  function spanSunPanel(w,st,d){
    var eff=spanEffSun(st);
    var ss=spanSunFor(w,d.id,eff);
    if(ss.state==='none')
      return '<div class="span-sun span-sun-none">☀ Keine Ausrichtung gesetzt — im Editor Himmelsrichtung des Fensters wählen.</div>';
    var track=spanDayTrack(w,d.id,st.geo);
    var markM=(st.simMin!=null)?st.simMin:(track?track.nowM:0);
    var head;
    if(ss.state==='hit')head='<b>☀ Sonne trifft</b> · Einfall '+Math.round(Math.abs(ss.d))+'° · '+ss.phase;
    else if(ss.state==='night')head='Sonne unter dem Horizont';
    else head='Sonne trifft nicht · '+Math.round(Math.abs(ss.d))+'° seitlich ('+ss.phase+')';
    var fz=Math.round(ss.fz);
    var sunTxt=(eff&&eff.elev>0)?(Math.round(eff.az)+'° / '+Math.round(eff.elev)+'° hoch'):'unter Horizont';
    // Panel 1 — Tagesverlauf · Profilvergleich (zeitlich)
    var p1='<div class="span-sun">'
      +'<div class="span-sun-h"><span><b>Tagesverlauf · Profilvergleich</b></span>'
      +'<span class="span-sun-legend"><span class="lg gold">Sonne trifft</span><span class="lg teal">Profil aktiv</span></span></div>'
      +spanSunBar(track,markM)+spanProfBar(track,d.sunprof,markM)
      +spanTimeAxis(track)
      +'</div>';
    // Panel 2 — Sonnenstand (räumlich, Kompass)
    var p2='<div class="span-sun'+(ss.state==='hit'?' is-hit':'')+'">'
      +'<div class="span-sun-h"><span><b>Sonnenstand</b> · '+head+'</span>'
      +'<span class="span-sun-az">Fassade '+fz+'° · Sonne '+sunTxt+'</span></div>'
      +spanCompass(w,st,d,eff,track)
      +spanSunBadges(ss,d.sunprof,eff)
      +'</div>';
    return p1+p2;
  }
  // Sonnenkompass (Polar): Winkel=Azimut (N oben), Radius=Elevation (Rand=Horizont, Mitte=Zenit)
  function spanCompass(w,st,d,eff,track){
    if(!st.geo||st.geo.lat==null||!track)return '<div class="span-sun-when">Kein Standort.</div>';
    var CX=180,CY=180,R=150,HR=48, fz=spanFacadeAz(w,d.id), acc=spanAcc(w), nd=spanNorthDev(w), sp=d.sunprof;
    function rOf(el){return R*(90-Math.max(0,el))/90;}
    function ang(az){return (az-90)*Math.PI/180;}
    function P(az,el){var r=rOf(el),a=ang(az);return [CX+r*Math.cos(a),CY+r*Math.sin(a)];}
    function wedge(aS,aE,eIn,eOut){var rIn=Math.max(rOf(eIn),HR),rO=rOf(eOut),p='M',a,x,y;
      for(a=aS;a<=aE+0.001;a+=2){x=CX+rO*Math.cos(ang(a));y=CY+rO*Math.sin(ang(a));p+=x.toFixed(1)+','+y.toFixed(1)+' ';}
      for(a=aE;a>=aS-0.001;a-=2){x=CX+rIn*Math.cos(ang(a));y=CY+rIn*Math.sin(ang(a));p+=x.toFixed(1)+','+y.toFixed(1)+' ';}
      return p+'Z';}
    var g='';[30,60].forEach(function(el){g+='<circle cx="180" cy="180" r="'+rOf(el).toFixed(1)+'"/>';});
    for(var az=0;az<360;az+=45){var gp=P(az,0);g+='<line x1="180" y1="180" x2="'+gp[0].toFixed(1)+'" y2="'+gp[1].toFixed(1)+'"/>';}
    var lab='';[['N',0],['O',90],['S',180],['W',270]].forEach(function(e){var lp=P(e[1],-8);lab+='<text x="'+lp[0].toFixed(1)+'" y="'+(lp[1]+4).toFixed(1)+'">'+e[0]+'</text>';});
    var arc='',started=false,rise=null,set=null;
    track.pts.forEach(function(pt){if(pt.elev>0){var p=P(pt.az,pt.elev);arc+=(started?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)+' ';if(!started){rise=pt;started=true;}set=pt;}});
    var rm=rise?P(rise.az,0):null, sm=set?P(set.az,0):null;
    var hitSec=fz!=null?'<path class="cmp-hit" d="'+wedge(fz-acc,fz+acc,0,90)+'"/>':'';
    var profSec='';
    if(sp&&sp.bgn!=null&&sp.end!=null){var pe=sp.end;if(pe<sp.bgn)pe+=360;profSec='<path class="cmp-prof" d="'+wedge(sp.bgn,pe,sp.elev||0,90)+'"/>';}
    var house='<g transform="rotate('+nd+' 180 180)"><rect x="144" y="151" width="72" height="58" rx="7" fill="var(--surface)" stroke="var(--line)"/></g>';
    if(fz!=null){var ap=[CX+58*Math.cos(ang(fz)),CY+58*Math.sin(ang(fz))];house+='<line x1="180" y1="180" x2="'+ap[0].toFixed(1)+'" y2="'+ap[1].toFixed(1)+'" stroke="var(--accent)" stroke-width="3"/>';}
    var up=eff&&eff.elev>0, rp=eff?P(eff.az,0):[CX,30], spos=eff?P(eff.az,Math.max(eff.elev,0)):[CX,CY];
    var ray='<line x1="180" y1="180" x2="'+rp[0].toFixed(1)+'" y2="'+rp[1].toFixed(1)+'" stroke="#f5a623" stroke-opacity="'+(up?0.35:0.12)+'" stroke-width="1.5"/>';
    var sun='<g transform="translate('+spos[0].toFixed(1)+' '+spos[1].toFixed(1)+')" opacity="'+(up?1:0.15)+'"><circle r="20" fill="url(#cmpglow)"/><circle r="6" fill="#ffcb52" stroke="#f5a623" stroke-width="1.5"/></g>';
    return '<svg class="cmp" viewBox="0 0 360 360">'
      +'<defs><radialGradient id="cmpsky" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="var(--surface-2)"/><stop offset="100%" stop-color="var(--tile)"/></radialGradient>'
      +'<radialGradient id="cmpglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffcb52" stop-opacity="0.9"/><stop offset="60%" stop-color="#f5a623" stop-opacity="0.25"/><stop offset="100%" stop-color="#f5a623" stop-opacity="0"/></radialGradient></defs>'
      +'<circle cx="180" cy="180" r="150" fill="url(#cmpsky)" stroke="var(--line)"/>'
      +'<g fill="none" stroke="var(--line-soft)">'+g+'</g>'+hitSec+profSec
      +'<path d="'+arc+'" fill="none" stroke="#f5a623" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>'
      +(rm?'<circle cx="'+rm[0].toFixed(1)+'" cy="'+rm[1].toFixed(1)+'" r="3.5" fill="#f5a623"/>':'')
      +(sm?'<circle cx="'+sm[0].toFixed(1)+'" cy="'+sm[1].toFixed(1)+'" r="3.5" fill="#f5a623"/>':'')
      +'<g font-size="12" font-weight="600" fill="var(--muted)" text-anchor="middle">'+lab+'</g>'
      +house+ray+sun+'</svg>';
  }
  function spanSunBadges(ss,sp,eff){
    var hit=(ss.state==='hit');
    var prof=!!(eff&&sp&&sp.bgn!=null&&eff.elev>=(sp.elev||0)&&spanInWin(eff.az,sp.bgn,sp.end));
    var pos=(eff&&eff.elev>0)?(Math.round(eff.az)+'° / '+Math.round(eff.elev)+'°'):(eff?'unter Horizont':'—');
    return '<div class="span-status">'
      +'<div class="span-badge'+(hit?' on-sun':'')+'">Fenster besonnt<b>'+(ss.state==='night'?'—':(hit?'ja':'nein'))+'</b></div>'
      +'<div class="span-badge'+(prof?' on-prof':'')+'">Profil-Automatik<b>'+(prof?'aktiv':'aus')+'</b></div>'
      +'<div class="span-badge">Azimut / Höhe<b>'+pos+'</b></div></div>';
  }
  function spanSunTimes(track,sp){
    if(!track)return '';
    function segs(test){var a=[],cur=null;track.pts.forEach(function(p){if(test(p)){if(!cur)cur={a:p.m,b:p.m};else cur.b=p.m;}else if(cur){a.push(cur);cur=null;}});if(cur)a.push(cur);return a;}
    function fmt(s){return s.length?s.map(function(x){return spanHHMM(x.a)+'–'+spanHHMM(x.b);}).join(' · '):'—';}
    var hs=segs(function(p){return p.hit;});
    var ps=(sp&&sp.bgn!=null)?segs(function(p){return p.elev>=(sp.elev||0)&&spanInWin(p.az,sp.bgn,sp.end);}):[];
    return '<div class="span-sun-when"><span class="sw gold"></span>Sonne am Fenster: '+fmt(hs)+'</div>'
      +'<div class="span-sun-when"><span class="sw teal"></span>Profil „'+esc((sp&&sp.name)||'?')+'“: '+fmt(ps)+'</div>';
  }
  // Sonnensimulation: Uhrzeit-Regler + Play; treibt alle Badges/Detail/Balken
  function spanSimStrip(w,st){
    var live=(st.simMin==null), m=live?spanNowMin():st.simMin, eff=spanEffSun(st);
    var s=(eff&&eff.elev>0)?(Math.round(eff.az)+'° / '+Math.round(eff.elev)+'° hoch'):(eff?'unter Horizont':'—');
    return '<div class="span-sim">'
      +'<button class="span-sim-play'+(st.simTimer?' on':'')+'" data-simplay title="Tag abspielen / anhalten">'+(st.simTimer?'❙❙':'▶')+'</button>'
      +'<input class="span-sim-range" type="range" min="0" max="1439" step="5" value="'+m+'" data-simrange>'
      +'<span class="span-sim-lbl" data-simlbl>'+spanHHMM(m)+' · Sonne '+s+'</span>'
      +'<button class="span-sim-now'+(live?' on':'')+'" data-simnow title="zurück auf Echtzeit">Jetzt</button>'
      +'</div>';
  }
  // In-place-Update bei Scrub/Play (ohne Ledger-Bindings zu verlieren)
  function spanSimUpdate(w,el){var st=spanSt(w), eff=spanEffSun(st);
    var sw=$('.span-sunwrap',el), d=spanSel(st); if(sw&&d)sw.innerHTML=spanSunPanel(w,st,d);
    $$('.rlg-row[data-spanroom]',el).forEach(function(row){var id=+row.getAttribute('data-spanroom');
      var c=row.querySelector('.rlg-sun'); if(c)c.outerHTML=spanSunCell(spanSunFor(w,id,eff));});
    var live=(st.simMin==null), m=live?spanNowMin():st.simMin;
    var s=(eff&&eff.elev>0)?(Math.round(eff.az)+'° / '+Math.round(eff.elev)+'° hoch'):(eff?'unter Horizont':'—');
    var lbl=$('[data-simlbl]',el); if(lbl)lbl.textContent=spanHHMM(m)+' · Sonne '+s;
    var nb=$('[data-simnow]',el); if(nb)nb.classList.toggle('on',live);
    spanDrawAxis(el);
  }
  // Profilbalken: wann das zugewiesene Shadowing-Sun-Profil nach Azimut/Elevation auslöst
  function spanProfBar(track,sp,markM){
    if(!track||!sp||sp.bgn==null||sp.end==null)
      return '<div class="span-sun-when">Kein Sun-Profil zugewiesen.</div>';
    var pts=track.pts, el=sp.elev||0, segs=[],cur=null;
    pts.forEach(function(p){var act=(p.elev>=el&&p.az>=sp.bgn&&p.az<=sp.end);
      if(act){if(!cur)cur={a:p.m,b:p.m};else cur.b=p.m;}else if(cur){segs.push(cur);cur=null;}});
    if(cur)segs.push(cur);
    function pc(m){return m/1440*100;}
    var h='<div class="span-sunbar prof" title="Profil „'+esc(sp.name||'')+'“: wann die Shadowing-Automatik nach Azimut/Elevation auslöst">';
    segs.forEach(function(s){h+='<span class="sb-prof" style="left:'+pc(s.a).toFixed(2)+'%;width:'+Math.max(0.5,pc(s.b)-pc(s.a)).toFixed(2)+'%"></span>';});
    h+='<span class="sb-now" style="left:'+pc(Math.max(0,Math.min(1440,markM==null?track.nowM:markM))).toFixed(2)+'%"></span>';
    ['0','6','12','18','24'].forEach(function(t){h+='<span class="sb-tick" style="left:'+(t/24*100)+'%"></span>';});
    h+='</div>';
    h+='<div class="span-sun-when">Profil „'+esc(sp.name||'?')+'“ ('+sp.bgn+'–'+sp.end+'°, Elev '+el+'°): '
      +(segs.length?segs.map(function(s){return spanHHMM(s.a)+'–'+spanHHMM(s.b);}).join(' · '):'löst heute nicht aus')+'</div>';
    return h;
  }
  // Stundenachse (JS füllt breitenabhängig 1/2/3/4/6 h) + Auf-/Höchststand-/Untergangszeiten
  function spanTimeAxis(track){
    var h='<div class="span-axis"></div>';
    if(track&&track.pts){var up=track.pts.filter(function(p){return p.elev>0;});
      if(up.length){var rise=up[0].m,set=up[up.length-1].m,noon=track.pts.reduce(function(a,p){return p.elev>a.elev?p:a;},{elev:-99,m:0}).m;
        h+='<div class="span-events"><span>↑ Aufgang '+spanHHMM(rise)+'</span><span>☀ Höchststand '+spanHHMM(noon)+'</span><span>↓ Untergang '+spanHHMM(set)+'</span></div>';}}
    return h;
  }
  // misst die Achsenbreite und setzt Stundenlabels im passenden Schritt (jede Stunde wenn breit genug)
  function spanDrawAxis(el){
    var ax=el&&el.querySelector('.span-axis'); if(!ax)return;
    var w=ax.clientWidth||0; if(!w)return;
    var step = w>=1000?1 : w>=640?2 : w>=460?3 : w>=340?4 : 6;
    var s='';
    for(var t=0;t<=24;t+=step){ s+='<span style="left:'+(t/24*100).toFixed(3)+'%">'+(t<10?'0'+t:t)+'</span>'; }
    ax.innerHTML=s;
  }
  function spanSunBar(track,markM){
    if(!track||track.fz==null)return '';
    var pts=track.pts, up=pts.filter(function(p){return p.elev>0;});
    if(!up.length)return '<div class="span-sun-when">Sonne heute nicht über dem Horizont</div>';
    var rise=up[0].m, set=up[up.length-1].m;
    var segs=[],cur=null;
    pts.forEach(function(p){ if(p.hit){ if(!cur)cur={a:p.m,b:p.m}; else cur.b=p.m; } else if(cur){segs.push(cur);cur=null;} });
    if(cur)segs.push(cur);
    function pc(m){return (m/1440*100);}
    var h='<div class="span-sunbar" title="Tagesverlauf – helle Zone: Tag, gold: Sonne am Fenster, Linie: Zeit">';
    h+='<span class="sb-day" style="left:'+pc(rise).toFixed(2)+'%;width:'+(pc(set)-pc(rise)).toFixed(2)+'%"></span>';
    segs.forEach(function(s){h+='<span class="sb-hit" style="left:'+pc(s.a).toFixed(2)+'%;width:'+Math.max(0.5,pc(s.b)-pc(s.a)).toFixed(2)+'%"></span>';});
    var nm=Math.max(0,Math.min(1440,markM==null?track.nowM:markM));
    h+='<span class="sb-now" style="left:'+pc(nm).toFixed(2)+'%"></span>';
    ['0','6','12','18','24'].forEach(function(t){h+='<span class="sb-tick" style="left:'+(t/24*100)+'%"></span>';});
    h+='</div>';
    if(segs.length){h+='<div class="span-sun-when">Sonne am Fenster: '+segs.map(function(s){return spanHHMM(s.a)+'–'+spanHHMM(s.b);}).join(' · ')+'</div>';}
    else h+='<div class="span-sun-when">Heute keine direkte Sonne an diesem Fenster</div>';
    return h;
  }

  // ============================ NETZ (Sammel-Abruf) ============================
  var _spanAll=null,_spanAllTs=0,_spanWait=null,_spanSun=null,_spanGeo=null;
  function spanLoadAll(force,cb){
    if(typeof DOKU!=='undefined'&&DOKU){cb&&cb();return;}
    if(!force&&_spanAll&&(Date.now()-_spanAllTs<5000)){cb&&cb();return;}
    if(_spanWait){_spanWait.push(cb);return;}
    _spanWait=[cb];
    fetch('?api=shading&op=getall',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      _spanAll=(j&&j.devices)||[]; _spanSun=(j&&j.sun)||null; _spanGeo=(j&&j.geo)||null; _spanAllTs=Date.now(); var q=_spanWait;_spanWait=null;q.forEach(function(c){c&&c();});
    }).catch(function(){var q=_spanWait;_spanWait=null;(q||[]).forEach(function(c){c&&c();});});
  }
  function spanApply(st,list){ st.all={}; st.order=[]; (list||[]).forEach(function(d){st.all[d.id]=d;st.order.push({id:d.id,name:d.name,group:d.group||''});});
    // Reihenfolge nach Gruppe EG,OG,Markise, dann Rest
    var rank={EG:0,OG:1,Markise:2}; st.order.sort(function(a,b){return (rank[a.group]==null?9:rank[a.group])-(rank[b.group]==null?9:rank[b.group]);});
    if(!st.sel||!st.all[st.sel])st.sel=st.order.length?st.order[0].id:0;
    if(_spanSun)st.sun=_spanSun; if(_spanGeo)st.geo=_spanGeo;
  }
  function spanFetch(w,el){var st=spanSt(w);
    if(typeof DOKU!=='undefined'&&DOKU){spanApply(st,spanDemoAll());st.sun={az:214,elev:38,ts:0};st.geo={lat:48.0657,lon:14.1241};st.loaded=true;st.err='';spanRepaint(w,el);return;}
    spanLoadAll(false,function(){ if(_spanAll){spanApply(st,_spanAll);st.err='';}else st.err='Verbindungsfehler'; st.loaded=true; spanRepaint(w,el); });
  }
  function spanWrite(w,el,vid,val){if(!vid)return;setVar(vid,val);
    setTimeout(function(){spanLoadAll(true,function(){var st=spanSt(w);if(_spanAll)spanApply(st,_spanAll);spanRepaint(w,el);});},500);}
  function spanStartTimer(){if(_spanTimer||(typeof DOKU!=='undefined'&&DOKU))return;_spanTimer=setInterval(spanTick,7000);}
  function spanTick(){var vis=Object.keys(_spanState).filter(function(id){return _spanState[id].loaded&&document.querySelector('.w[data-id="'+id+'"]');});if(!vis.length)return;
    spanLoadAll(true,function(){ vis.forEach(function(id){var st=_spanState[id],w=(typeof widget==='function')?widget(id):null;if(!w)return;var el=document.querySelector('.w[data-id="'+id+'"]');if(!el)return;if(st.simMin!=null||st.simTimer)return;if(_spanAll)spanApply(st,_spanAll);if(document.activeElement&&el.contains(document.activeElement))return;spanRepaint(w,el);});});}

  // ============================ PAINT/BIND ============================
  function spanElOf(w,root){return $('.w[data-id="'+w.id+'"]',root||canvas);}
  function spanRepaint(w,el){if(!el)el=spanElOf(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=spanRender(w);spanBind(w,el);}
  function spanBind(w,el){var st=spanSt(w);function rp(){spanRepaint(w,el);}
    spanDrawAxis(el);
    $$('[data-spanroom]',el).forEach(function(b){b.onclick=function(){st.sel=+b.getAttribute('data-spanroom');rp();};});
    // Ledger-Liste: Auto/Hand-Umschalter je Zeile
    $$('[data-spantog]',el).forEach(function(t){t.onclick=function(e){e.stopPropagation();var vid=+t.getAttribute('data-spantog');if(!vid)return;var cur=t.getAttribute('data-cur')==='1';spanWrite(w,el,vid,cur?0:1);};});
    // Ledger-Liste: ziehbarer Positions-Regler (schreibt beim Loslassen)
    $$('[data-posvid]',el).forEach(function(rail){var vid=+rail.getAttribute('data-posvid');if(!vid)return;
      rail.onclick=function(e){e.stopPropagation();};                                 // Regler wählt nicht die Zeile
      function px(cx){var b=rail.getBoundingClientRect();return Math.max(0,Math.min(100,Math.round((cx-b.left)/b.width*100)));}
      rail.addEventListener('pointerdown',function(ev){ev.preventDefault();ev.stopPropagation();var row=rail.closest('.rlg-row');
        function draw(p){if(row)row.style.setProperty('--pos',p);var pc=row&&row.querySelector('.rlg-pct');if(pc)pc.firstChild.nodeValue=p;}
        function mv(e){draw(px(e.clientX));}
        function up(e){document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);spanWrite(w,el,vid,px(e.clientX));}
        draw(px(ev.clientX));document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);});});
    var d=spanSel(st);
    var ab=$('[data-spanauto]',el);if(ab&&d&&d.automatic)ab.onclick=function(){spanWrite(w,el,d.automatic.vid,d.automatic.value?0:1);};
    var sl=$('[data-spanpos]',el);if(sl&&d&&d.position){sl.onchange=function(){spanWrite(w,el,d.position.vid,parseInt(sl.value)||0);};
      sl.oninput=function(){var pv=$('.span-posbig',el);if(pv)pv.firstChild.nodeValue=sl.value+' ';};}
    $$('[data-spanpset]',el).forEach(function(b){if(d&&d.position)b.onclick=function(){spanWrite(w,el,d.position.vid,+b.getAttribute('data-spanpset'));};});
    $$('[data-spanprog]',el).forEach(function(s){s.onchange=function(){spanWrite(w,el,+s.getAttribute('data-spanprog'),+s.value);};});
    // --- Sonnensimulation: Uhrzeit-Regler + Play + Jetzt ---
    if(st.simTimer){clearInterval(st.simTimer);st.simTimer=null;}
    var rng=$('[data-simrange]',el);
    if(rng)rng.oninput=function(){st.simMin=+rng.value;spanSimUpdate(w,el);};
    var nowb=$('[data-simnow]',el);
    if(nowb)nowb.onclick=function(){if(st.simTimer){clearInterval(st.simTimer);st.simTimer=null;}st.simMin=null;spanRepaint(w,el);};
    var playb=$('[data-simplay]',el);
    if(playb)playb.onclick=function(){
      if(st.simTimer){clearInterval(st.simTimer);st.simTimer=null;playb.textContent='▶';playb.classList.remove('on');return;}
      if(st.simMin==null)st.simMin=rng?(+rng.value):spanNowMin();
      playb.textContent='❙❙';playb.classList.add('on');
      st.simTimer=setInterval(function(){st.simMin+=10;if(st.simMin>1439)st.simMin=0;if(rng)rng.value=st.simMin;spanSimUpdate(w,el);},140);
    };
  }

  // ============================ WIDGET ============================
  defWidget('shadingpanel',{
    // MONOLITH (alt): ersetzt durch die domaenen-generische heatx-Familie (domain:'shading').
    // Bleibt registriert, damit die noch nicht migrierte Rollos-Seite rendert; aus der Palette
    // genommen, damit keine neuen mehr platziert werden.
    noPalette:true,
    label:'Beschattungs-Panel (alt/Monolith)', paletteIcon:'cover', size:[980,600],
    defaults:function(w){w.label='Beschattung';},
    render:function(w){return spanRender(w);},
    mount:function(w){var el=spanElOf(w);if(!el)el=spanElOf(w,$('#ovcanvas'));if(!el)return;spanStartTimer();spanFetch(w,el);},
    props:function(w){
      var list=(_spanAll&&_spanAll.length)?_spanAll:[];
      var oriRows='';
      if(!list.length)oriRows='<div class="span-hint" style="padding:2px">Rollo-Liste lädt … Editor kurz schließen und neu öffnen.</div>';
      else list.forEach(function(d){var cur=spanOri(w,d.id), fz=spanFacadeAz(w,d.id);
        oriRows+='<div class="prow"><label style="font-size:11px">'+esc(d.name)+(fz!=null?' <span style="color:var(--faint)">'+Math.round(fz)+'°</span>':'')+'</label><select data-spori="'+d.id+'">'
          +SPAN_CARDLIST.map(function(c){return '<option value="'+c+'"'+(c===cur?' selected':'')+'>'+(c||'—')+'</option>';}).join('')+'</select></div>';});
      return '<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Sonnenstand aus Location #13098 (verifiziert). Titel oben = Label-Feld; Raumnamen/Temp-Variablen im Backend #42974.</div>'
        +row('Nordabweichung °','<input id="pSpND" type="number" step="1" value="'+(w.northDev!=null?w.northDev:19)+'" title="dreht alle Fassaden gemeinsam">')
        +row('Sonne Akzeptanz ±°','<input id="pSpAcc" type="number" step="5" value="'+(w.sunAcc!=null?w.sunAcc:90)+'" title="wie weit seitlich die Sonne noch als Treffer zählt">')
        +'<div class="prow" style="border-top:1px solid var(--line-soft);margin-top:4px;padding-top:6px"><label style="font-weight:600">Ausrichtung je Fenster</label></div>'
        +oriRows
        +'<div class="prow" style="border-top:1px solid var(--line-soft);margin-top:4px;padding-top:6px"><label style="font-weight:600">Beschriftungen</label></div>'
        +row('Übersicht-Titel','<input id="pSpOv" type="text" value="'+esc(w.ovTitle||'')+'" placeholder="Alle Rollos">')
        +row('Preset-Knöpfe','<input id="pSpPs" type="text" value="'+esc(w.presets||'')+'" placeholder="Auf,25%,Halb,75%,Zu">');
    },
    wire:function(w){
      if($('#pSpND'))$('#pSpND').oninput=function(){w.northDev=this.value===''?undefined:(parseFloat(this.value)||0);render();commit();};
      if($('#pSpAcc'))$('#pSpAcc').oninput=function(){w.sunAcc=this.value===''?undefined:(parseFloat(this.value)||90);render();commit();};
      $$('[data-spori]').forEach(function(s){s.onchange=function(){if(!w.orient)w.orient={};w.orient[+s.getAttribute('data-spori')]=s.value;render();commit();};});
      if($('#pSpOv'))$('#pSpOv').oninput=function(){w.ovTitle=this.value;render();commit();};
      if($('#pSpPs'))$('#pSpPs').oninput=function(){w.presets=this.value;render();commit();};
    }
  });
