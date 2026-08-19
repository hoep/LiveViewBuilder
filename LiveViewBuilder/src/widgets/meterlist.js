// Widget: meterlist (Metrik-Liste)
//
// Je Zeile: frei gewaehlter Bezeichner, Wert aus einer Variablen und ein Balken.
// ERWEITERT am 19.08.2026 um drei Dinge, die eine Liste ungleicher Messgroessen erst
// vergleichbar machen (Anlass: Bodenfeuchte aus Zentibar UND Prozent in einer Kachel):
//
//   Skala je Zeile (min/max)  Der Balken braucht eine gemeinsame 0..100-Achse, die Messwerte
//                             haben sie nicht. Ohne eigene Skala zeichnete ein 43-cb-Wert
//                             einen 43-Prozent-Balken - Zufall, keine Aussage.
//   Umkehren (inv)            Bei Saugspannung heisst HOCH = trocken. Ohne Umkehr zeigte der
//                             trockenste Fuehler den laengsten Balken.
//   Skin-Farbe je Zeile       Damit die Zeile ihre Bedeutung traegt und nicht alle Balken
//                             gleich aussehen.
//
// Die ZAHL bleibt immer der echte Messwert in seiner Einheit - der Balken vergleicht, die
// Zahl misst. Ohne min/max verhaelt sich das Widget wie bisher (Wert 0..100 = Prozent).
  function _mlPct(r, roh) {
    var v = parseFloat(String(roh).replace(',', '.'));
    if (isNaN(v)) return null;
    var lo = (r.min === '' || r.min == null) ? 0 : parseFloat(String(r.min).replace(',', '.'));
    var hi = (r.max === '' || r.max == null) ? 100 : parseFloat(String(r.max).replace(',', '.'));
    if (isNaN(lo)) lo = 0;
    if (isNaN(hi) || hi === lo) hi = lo + 100;
    var p = (v - lo) / (hi - lo) * 100;
    if (r.inv) p = 100 - p;
    return Math.max(0, Math.min(100, p));
  }
  /**
   * Farbe eines Balkens. Vorrang hat die VERGLEICHSTABELLE des Widgets: sie bewertet den
   * NORMIERTEN Wert (0..100), damit dieselbe Tabelle fuer Zeilen mit verschiedenen Skalen
   * gilt - genau dafuer ist die Normierung je Zeile da. Ohne Tabelle bleibt die feste
   * Zeilenfarbe, ohne beides die Vorgabe des Balkens.
   */
  function _mlFarbe(w, r, pct) {
    if (w.mlGrad && w.mlGrad.length && pct != null) {
      var g = gradColor(w.mlGrad, pct);
      if (g) return g;
    }
    return r.color ? _cssColorOrEmpty(r.color) : '';
  }
defWidget('meterlist',{
  label:'Metrik-Liste',
  cat:'Anzeige',
  paletteIcon:'wbars',
  size:[320,170],
  defaults:function(w){
    w.items=[{label:'CPU-Last',sub:'IPS',val:'14',unit:'%',pct:14},{label:'USV APC',sub:'Last',val:'31',unit:'%',pct:31},{label:'WAN',sub:'Mbit',val:'118/38',unit:'',pct:70},{label:'Batterien',sub:'Geräte',val:'62',unit:'%',pct:62}];
  },
  render:function(w){return '<div class="hmeters'+(w.mlDense?' dense':'')+'">'+(w.items||[]).map(function(r,i){
    var live=r.vid&&_lastVals[r.vid];
    var pct=live?_mlPct(r,live.v):null;
    if(pct==null)pct=parseFloat(r.pct)||0;
    return '<div class="hmeter" data-mlrow="'+i+'">'
      +'<div class="hmk">'+esc(r.label||'')+(r.sub?'<span>'+esc(r.sub)+'</span>':'')+'</div>'
      +'<div class="hmv"><span'+(r.vid?' data-vid="'+r.vid+'"'+_slotAttrs(r,true):'')+'>'+esc(r.val||'–')+'</span>'
      +(r.unit?'<span class="u"> '+esc(r.unit)+'</span>':'')+'</div>'
      +'<div class="hmtr"><i'+(r.vid?' data-mlbar="'+i+'"':'')+' style="width:'+pct+'%'
      +((function(c){return c?(';background:'+c):'';})(_mlFarbe(w,r,pct)))+'"></i></div></div>';}).join('')+'</div>';},
  // Eigener Live-Pfad statt data-vidbar: der zentrale Handler setzt die Breite stur auf den
  // Rohwert (0..100) und kennt weder Skala noch Umkehr dieser Zeile.
  live:function(w,el,id,d){
    var treffer=false;
    (w.items||[]).forEach(function(r,i){
      if(String(r.vid)!==String(id))return;
      treffer=true;
      var b=$('[data-mlbar="'+i+'"]',el);
      var p=_mlPct(r,d.v);
      if(b&&p!=null){
        b.style.width=p+'%';
        var c=_mlFarbe(w,r,p);              // Farbe wandert mit dem Wert, wenn eine Tabelle da ist
        if(c)b.style.background=c;
      }
    });
    return treffer?false:false;   // Wertetext macht weiterhin der zentrale data-vid-Pfad
  },
  props:function(w){return row('Kompakte Zeilen','<input type="checkbox" id="pMlDense"'+(w.mlDense?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Bezeichner · Balken · Wert je Zeile statt Kacheln</span>')
    +listEditor(w,'items','Zeile: Bezeichner · Zusatz · Variable · Einheit · Skala · Farbe',[
      {k:'label',ph:'Bezeichner'},
      {k:'sub',  ph:'Zusatz'},
      {k:'vid',  ph:'Variablen-ID'},
      {k:'unit', ph:'Einh'},
      {k:'min',  ph:'von'},
      {k:'max',  ph:'bis'},
      {k:'inv',  ph:'umkehren', type:'check'},
      {k:'color',type:'skincolor'}])
    +'<div class="pgh">Vergleichstabelle (Farbe nach Wert)</div>'
    +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
    +'Gilt für ALLE Zeilen und bewertet den auf 0…100 normierten Wert — deshalb passt eine '
    +'Tabelle auch für Zeilen mit verschiedenen Skalen. Je Zeile eine reine Zahl („ab diesem '
    +'Wert") oder ein Muster (<code>&gt;=20&lt;40</code>, <code>*</code>). Leer = feste Farbe je Zeile.</div>'
    +listEditor(w,'mlGrad','Ab Wert · Farbe',[{k:'v',ph:'ab %'},{k:'color',type:'skincolor'}])
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">'
    +'„von/bis" ist die Skala des BALKENS in der Einheit der Variablen (leer = 0…100). '
    +'„umkehren" für Größen, bei denen ein hoher Wert wenig bedeutet — etwa Saugspannung in '
    +'Zentibar, wo hoch = trocken heißt. Die angezeigte Zahl bleibt immer der Messwert.</div>';}
,
  wire:function(w){ if($('#pMlDense'))$('#pMlDense').onchange=function(){w.mlDense=this.checked||undefined;render();renderProps();commit();}; }
});
