// webview widget
  // Eigene Standortnadel im Hausskin. Fremde Karten bringen ihre eigene Nadel mit
  // (OpenStreetMap eine gruene), die sich nicht gestalten laesst - deshalb faellt
  // sie in der Adresse weg und hier steht unsere. Sie sitzt in der Mitte, weil der
  // Kartenausschnitt um den Ort herum gerechnet wird.
  var WVPIN='<div class="wvpin" data-role="wvpin"><i class="wvpin-puls"></i>'
    +'<svg viewBox="0 0 24 24" aria-hidden="true"><path class="wvpin-k" d="M12 22c0 0 -7 -7.2 -7 -12a7 7 0 1 1 14 0c0 4.8 -7 12 -7 12z"/>'
    +'<circle class="wvpin-p" cx="12" cy="10" r="2.7"/></svg></div>';
  /**
   * Namensnennung dezent - wie sie die Sonnenszene selbst zeichnet.
   *
   * Der OpenStreetMap-Einbettungsrahmen bringt seinen eigenen Hinweisblock mit
   * ("Report a problem | (c) OpenStreetMap contributors ... Website and API terms"),
   * schwarz auf Weiss und auf einer schmalen Kachel zweizeilig - auf der Auto-Seite
   * belegte er ein Drittel der Karte. Gestalten laesst er sich nicht: der Rahmen kommt
   * von einem fremden Ursprung, kein CSS und kein Skript reicht hinein.
   *
   * Also wird er ueberdeckt und die Nennung selbst gesetzt: unten ein Streifen in
   * Skinfarbe (oben ausblendend, damit die Karte nicht abgeschnitten wirkt) und rechts
   * darin der Text in --faint. Die Nennung BLEIBT damit vorhanden - sie ist bei
   * OSM-Daten vorgeschrieben (ODbL) -, sie draengt sich nur nicht mehr auf.
   *
   * Die Hoehe ist einstellbar, weil der fremde Block je nach Kachelbreite ein- oder
   * zweizeilig umbricht. 44 px decken beide Faelle.
   */
  function wvAttrib(w) {
    if (!w.wvAtt) { return ''; }
    var h = parseFloat(w.wvAttH);
    if (!isFinite(h) || h <= 0) { h = 44; }
    return '<div class="wvatt" data-role="wvatt" style="height:' + h + 'px">'
      + '<span>' + esc(w.wvAttTxt || '© OpenStreetMap-Mitwirkende') + '</span></div>';
  }
defWidget('webview',{
  label:'WebView',
  cat:'Anzeige',
  paletteIcon:'wifi',
  size:[320,240],
  defaults:function(w){w.url='';w.urlVid=0;w.wvPin=false;},
  // Die Adresse darf aus einer Variablen kommen. Beim Auto steht dort die
  // Kartenadresse mit den aktuellen Koordinaten - eine feste URL koennte dem
  // Wagen nicht folgen.
  render:function(w){
    var u=w.url||'';
    return u?('<iframe data-role="wvf" src="'+esc(u)+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>'+(w.wvPin?WVPIN:'')+wvAttrib(w))
            :'<div class="hwvph">WebView — URL in den Eigenschaften setzen</div>';},
  props:function(w){return (w.type==='webview'
      ?row('URL','<input id="pUrl" value="'+esc(w.url||'')+'" placeholder="https://…">')
       +row('Standortnadel','<label><input id="pWvPin" type="checkbox"'+(w.wvPin?' checked':'')+'> eigene Nadel in der Mitte (Skinfarben)</label>')
       +row('URL aus Variable','<input id="pUrlVid" type="number" value="'+(w.urlVid||'')+'" placeholder="VarID"> <span style="font-size:11px;color:var(--muted)">Zeichenkette mit der Adresse — folgt dem Wert</span>')
       +row('Kartenhinweis dezent','<label><input id="pWvAtt" type="checkbox"'+(w.wvAtt?' checked':'')+'> fremden Hinweisblock abdecken, eigene Nennung setzen</label>')
       +(w.wvAtt?row('Höhe / Text','<input id="pWvAttH" type="number" min="10" step="2" style="width:64px" value="'+((w.wvAttH==null||w.wvAttH==='')?44:esc(String(w.wvAttH)))+'"> px &nbsp;<input id="pWvAttTxt" style="width:52%" value="'+esc(w.wvAttTxt||'© OpenStreetMap-Mitwirkende')+'" placeholder="© OpenStreetMap-Mitwirkende">'):'')
       +(w.wvAtt?'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Der eingebettete Kartenrahmen kommt von einem fremden Ursprung — sein Hinweisblock lässt sich nicht gestalten, nur überdecken. Die Nennung selbst bleibt (bei OSM-Daten vorgeschrieben), sie steht nur klein und in Skinfarbe. 44 px decken auch den zweizeiligen Umbruch schmaler Kacheln.</div>':'')
      :'');},
  wire:function(w){
    if($('#pUrl'))$('#pUrl').oninput=function(){w.url=this.value;render();};
    if($('#pWvPin'))$('#pWvPin').onchange=function(){w.wvPin=this.checked;render();commit();};
    if($('#pUrlVid'))$('#pUrlVid').onchange=function(){w.urlVid=parseInt(this.value)||undefined;render();commit();};
    if($('#pWvAtt'))$('#pWvAtt').onchange=function(){w.wvAtt=this.checked||undefined;render();renderProps();commit();};
    if($('#pWvAttH'))$('#pWvAttH').onchange=function(){var v=parseFloat(this.value);w.wvAttH=(isFinite(v)&&v>0)?v:undefined;render();commit();};
    if($('#pWvAttTxt'))$('#pWvAttTxt').onchange=function(){w.wvAttTxt=this.value||undefined;render();commit();};
  },
  live:function(w,el,id,d){
    if(!w.urlVid||id!==w.urlVid)return;
    var u=String(d.f!=null&&d.f!==''?d.f:(d.v||'')),f=el.querySelector('[data-role="wvf"]');
    if(!u)return;
    if(f){if(f.getAttribute('src')!==u)f.setAttribute('src',u);}
    else{el.innerHTML='<iframe data-role="wvf" src="'+esc(u)+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>'+(w.wvPin?WVPIN:'')+wvAttrib(w);}
  }
});
