  // ===== Widget: Doppel-Donut (doubledonut) ==========================================
  //
  // Zwei Halb-Donuts in EINEM Kreis: die obere Haelfte (180 Grad ueber der Mitte) zeigt
  // einen Wert, die untere Haelfte den zweiten - gespiegelt. Jede Haelfte fuellt sich
  // zwischen ihrem Min und Max. In der Mitte optional ein dritter Wert mit Untertitel.
  //
  //   varId  = oberer Wert   (topMin..topMax, Farbe ddTop)   -- "Variable" im Panel
  //   varId2 = unterer Wert  (botMin..botMax, Farbe ddBot)   -- "Unterer Wert"
  //   varId3 = Mittelwert     (nur Anzeige), darunter w.sub  -- "Mittelwert"
  //
  // Der Kreis bleibt IMMER rund: quadratischer viewBox + xMidYMid meet zentriert ihn in
  // jeder Kachelform, statt ihn zu einer Ellipse zu ziehen.

  function _ddPol(cx,cy,r,deg){var a=deg*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];}
  function _ddArc(cx,cy,r,a0,a1,sweep){
    var p0=_ddPol(cx,cy,r,a0),p1=_ddPol(cx,cy,r,a1),large=Math.abs(a1-a0)>180?1:0;
    return 'M'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+' A'+r+' '+r+' 0 '+large+' '+sweep+' '+p1[0].toFixed(1)+' '+p1[1].toFixed(1);
  }
  function _ddNum(id){var d=id&&_lastVals[id];if(!d)return null;var n=parseFloat(String(d.v).replace(',','.'));return isNaN(n)?null:n;}
  function _ddTxt(id){var d=id&&_lastVals[id];return d?((d.f!=null&&d.f!=='')?d.f:String(d.v)):'–';}
  function _ddCol(c,fb){return _cssColorOrEmpty(c)||fb;}

  var _DD_C=120, _DD_R=88;
  function _ddPaint(w,root){
    var el=$('.w[data-id="'+w.id+'"]',(root||canvas));if(!el)return;
    function frac(v,mn,mx){if(v==null||mx===mn)return 0;return Math.max(0,Math.min(1,(v-mn)/(mx-mn)));}
    var tv=_ddNum(w.varId),bv=_ddNum(w.varId2);
    var tmn=(w.topMin!=null&&w.topMin!==''?+w.topMin:0),tmx=(w.topMax!=null&&w.topMax!==''?+w.topMax:100);
    var bmn=(w.botMin!=null&&w.botMin!==''?+w.botMin:0),bmx=(w.botMax!=null&&w.botMax!==''?+w.botMax:100);
    [['ddtf',frac(tv,tmn,tmx)],['ddbf',frac(bv,bmn,bmx)]].forEach(function(x){
      var p=$('[data-role='+x[0]+']',el);if(!p)return;
      var L=p.getTotalLength();p.style.strokeDasharray=L;p.style.strokeDashoffset=(L*(1-x[1])).toFixed(1);
    });
    var t1=$('[data-role=ddtl]',el);if(t1)t1.textContent=(w.varId?_ddTxt(w.varId):'');
    var t2=$('[data-role=ddbl]',el);if(t2)t2.textContent=(w.varId2?_ddTxt(w.varId2):'');
    var c1=$('[data-role=ddcv]',el);if(c1)c1.textContent=(w.varId3?_ddTxt(w.varId3):'');
  }
  defWidget('doubledonut',{
    label:'Doppel-Donut', paletteIcon:'wdonut', size:[220,200],
    defaults:function(w){w.topMin=0;w.topMax=100;w.botMin=0;w.botMax=100;w.ddTop='ok';w.ddBot='info';w.ddW=22;},
    render:function(w){
      var C=_DD_C,R=_DD_R,tc=_ddCol(w.ddTop,'var(--ok)'),bc=_ddCol(w.ddBot,'var(--info)');
      var SW=(w.ddW!=null&&w.ddW!==''?Math.max(4,Math.min(48,+w.ddW)):22);
      var cap=(w.ddCap==='butt')?'butt':'round';
      // Schriften voll konfigurierbar: Groesse je Element, dazu Schriftart und Gewicht fuer
      // alle Beschriftungen. Zahlen sind viewBox-Einheiten (240er-Quadrat), skalieren also
      // mit der Kachel. Y-Positionen der Wertbeschriftungen sind ebenfalls einstellbar,
      // damit sie nicht an den Boegen kleben - Vorgaben sitzen mittig in der jeweiligen Haelfte.
      var fsC=(w.fsCenter!=null&&w.fsCenter!==''?+w.fsCenter:28);
      var fsS=(w.fsSub!=null&&w.fsSub!==''?+w.fsSub:15);
      var fsV=(w.fsVal!=null&&w.fsVal!==''?+w.fsVal:18);
      var tY=(w.lblTopY!=null&&w.lblTopY!==''?+w.lblTopY:70);
      var bY=(w.lblBotY!=null&&w.lblBotY!==''?+w.lblBotY:186);
      var cY=(w.valCY!=null&&w.valCY!==''?+w.valCY:(w.sub?114:124));
      var gsty=(w.ddFont?('font-family:'+esc(w.ddFont)+';'):'')+(w.ddWeight?('font-weight:'+esc(w.ddWeight)+';'):'');
      // Luecke an den Seiten: bei GERADEN Enden null, damit sich beide Haelften bei Max
      // links (9 Uhr) und rechts (3 Uhr) exakt beruehren. Bei RUNDEN Enden ein kleiner
      // Abstand, sonst wuerden sich die runden Kappen ueberlappen.
      var g=(cap==='butt')?0:5;
      var top=_ddArc(C,C,R,180+g,360-g,1), bot=_ddArc(C,C,R,180-g,0+g,0);
      var trk='var(--surface-2)';
      function p(d,role,col,lc){return '<path d="'+d+'"'+(role?' data-role="'+role+'"':'')+' fill="none" stroke="'+col+'" stroke-width="'+SW+'" stroke-linecap="'+(lc||cap)+'"/>';}
      // Der Track bekommt IMMER gerade Enden. Mit runden Kappen entstuenden an den Bogenenden
      // (v. a. oben bei 3 Uhr) dunkle, wertunabhaengige Halbkreise, die wie ein schwarzer
      // Punkt neben dem Donut wirken. Die farbige Fuellung behaelt ihre eingestellte Rundung.
      return '<div class="hdd"><svg viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet"'+(gsty?(' style="'+gsty+'"'):'')+'>'
        +p(top,'',trk,'butt')+p(bot,'',trk,'butt')+p(top,'ddtf',tc)+p(bot,'ddbf',bc)
        +'<text class="ddc" data-role="ddcv" x="120" y="'+cY+'" style="font-size:'+fsC+'px"></text>'
        +(w.sub?'<text class="ddcs" x="120" y="'+(cY+fsS+9)+'" style="font-size:'+fsS+'px">'+escL(w.sub)+'</text>':'')
        +'<text class="ddtl" data-role="ddtl" x="120" y="'+tY+'" style="fill:'+tc+';font-size:'+fsV+'px"></text>'
        +'<text class="ddbl" data-role="ddbl" x="120" y="'+bY+'" style="fill:'+bc+';font-size:'+fsV+'px"></text>'
        +'</svg></div>';
    },
    mount:function(w){_ddPaint(w);},
    live:function(w,el,id,d,base,txt,on){_ddPaint(w,(typeof rootOfEl==='function')?rootOfEl(el):null);},
    props:function(w){
      return row('Min / Max oben','<input id="pDdTmin" type="number" style="width:70px" value="'+(w.topMin!=null?w.topMin:0)+'"> <input id="pDdTmax" type="number" style="width:70px" value="'+(w.topMax!=null?w.topMax:100)+'">')
        +row('Farbe oben',skinSel(w.ddTop||'ok','id="pDdTc"'))
        +row('Min / Max unten','<input id="pDdBmin" type="number" style="width:70px" value="'+(w.botMin!=null?w.botMin:0)+'"> <input id="pDdBmax" type="number" style="width:70px" value="'+(w.botMax!=null?w.botMax:100)+'">')
        +row('Farbe unten',skinSel(w.ddBot||'info','id="pDdBc"'))
        +row('Untertitel (Mitte)','<input id="pDdSub" value="'+esc(w.sub||'')+'" placeholder="z. B. Auslastung">')
        +row('Ringdicke (px)','<input id="pDdW" type="number" min="4" max="48" style="width:70px" value="'+(w.ddW!=null?w.ddW:22)+'">')
        +row('Rundung','<select id="pDdCap"><option value="round"'+(w.ddCap!=='butt'?' selected':'')+'>runde Enden</option><option value="butt"'+(w.ddCap==='butt'?' selected':'')+'>gerade Enden (berühren bei Max)</option></select>')
        +'<div class="pgh">Schrift &amp; Beschriftung</div>'
        +row('Schriftart','<input id="pDdFont" value="'+esc(w.ddFont||'')+'" placeholder="Standard (z. B. Roboto)">')
        +row('Gewicht','<select id="pDdWt"><option value=""'+(!w.ddWeight?' selected':'')+'>Standard</option><option value="400"'+(w.ddWeight=='400'?' selected':'')+'>normal</option><option value="600"'+(w.ddWeight=='600'?' selected':'')+'>halbfett</option><option value="700"'+(w.ddWeight=='700'?' selected':'')+'>fett</option></select>')
        +row('Größe Mitte / Untertitel','<input id="pDdFsC" type="number" min="6" max="60" style="width:60px" value="'+(w.fsCenter!=null?w.fsCenter:28)+'"> <input id="pDdFsS" type="number" min="6" max="40" style="width:60px" value="'+(w.fsSub!=null?w.fsSub:15)+'">')
        +row('Größe Werte','<input id="pDdFsV" type="number" min="6" max="40" style="width:60px" value="'+(w.fsVal!=null?w.fsVal:18)+'">')
        +row('Position oben / unten','<input id="pDdLTY" type="number" min="20" max="220" style="width:60px" value="'+(w.lblTopY!=null?w.lblTopY:70)+'"> <input id="pDdLBY" type="number" min="20" max="230" style="width:60px" value="'+(w.lblBotY!=null?w.lblBotY:186)+'"> <span style="font-size:11px;color:var(--muted)">Y in 0–240</span>')
        +row('Position Mitte (Y)','<input id="pDdCY" type="number" min="20" max="220" style="width:60px" value="'+(w.valCY!=null?w.valCY:'')+'" placeholder="auto">');
    },
    wire:function(w){
      function num(id,k){var e=$('#'+id);if(e)e.oninput=function(){w[k]=this.value===''?undefined:parseFloat(this.value);render();commit();};}
      num('pDdTmin','topMin');num('pDdTmax','topMax');num('pDdBmin','botMin');num('pDdBmax','botMax');num('pDdW','ddW');
      num('pDdFsC','fsCenter');num('pDdFsS','fsSub');num('pDdFsV','fsVal');
      num('pDdLTY','lblTopY');num('pDdLBY','lblBotY');num('pDdCY','valCY');
      if($('#pDdTc'))$('#pDdTc').onchange=function(){w.ddTop=this.value||undefined;render();commit();};
      if($('#pDdBc'))$('#pDdBc').onchange=function(){w.ddBot=this.value||undefined;render();commit();};
      if($('#pDdSub'))$('#pDdSub').onchange=function(){w.sub=this.value||undefined;render();commit();};
      if($('#pDdCap'))$('#pDdCap').onchange=function(){w.ddCap=(this.value==='butt')?'butt':undefined;render();commit();};
      if($('#pDdFont'))$('#pDdFont').onchange=function(){w.ddFont=this.value||undefined;render();commit();};
      if($('#pDdWt'))$('#pDdWt').onchange=function(){w.ddWeight=this.value||undefined;render();commit();};
    }
  });
