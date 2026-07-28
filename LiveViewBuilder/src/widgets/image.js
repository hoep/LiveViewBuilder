  // ===== Widget: Bild (Image) — Media-Objekt, feste URL oder URL aus String-Variable =====
  defWidget('image',{
    label:'Bild', paletteIcon:'wimage', size:[100,100],
    defaults:function(w){w.objFit='contain';},
    render:function(w){var m=w.imgSrc||'media',src='';if(m==='url')src=w.url||'';else if(m==='var'){var dv=w.varId&&_lastVals[w.varId];src=dv?String(dv.v):'';}else src=w.mediaId?('?api=media&id='+w.mediaId):'';var of=w.objFit||(({contain:1,cover:1,fill:1})[w.fit]?w.fit:'contain');return '<img data-role="img" alt="'+esc(w.label||'')+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:'+of+'" src="'+esc(src)+'">';},
    props:function(w){var m=w.imgSrc||'media';return row('Quelle','<select id="pImgSrc"><option value="media"'+(m==='media'?' selected':'')+'>Media-Objekt</option><option value="url"'+(m==='url'?' selected':'')+'>Feste URL</option><option value="var"'+(m==='var'?' selected':'')+'>URL aus Variable</option></select>')
      +(m==='url'?row('URL','<input id="pImgUrl" value="'+esc(w.url||'')+'" placeholder="https://…">'):'')
      +(m==='var'?row('Variable','<input id="pImgVar" value="'+(w.varId||'')+'" placeholder="String-Var-ID"> <button class="btn" id="pImgPick" style="padding:6px 8px">wählen</button>'):'')
      +row('Anpassung','<select id="pImgFit">'+[['contain','Einpassen'],['cover','Füllen'],['fill','Strecken']].map(function(o){var cur=w.objFit||w.fit;return '<option value="'+o[0]+'"'+(cur===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>');},
    wire:function(w){
      if($('#pImgSrc'))$('#pImgSrc').onchange=function(){w.imgSrc=this.value;render();renderProps();};
      if($('#pImgUrl'))$('#pImgUrl').oninput=function(){w.url=this.value;render();};
      if($('#pImgVar'))$('#pImgVar').onchange=function(){w.varId=parseInt(this.value)||0;render();};
      if($('#pImgPick'))$('#pImgPick').onclick=function(){showTab('vars');toast('String-Variable im Baum anklicken');_bindTarget=w.id;};
      if($('#pImgFit'))$('#pImgFit').onchange=function(){w.objFit=this.value;if(({contain:1,cover:1,fill:1})[w.fit])delete w.fit;render();};
    },
    live:function(w,el,id,d,base,txt,on){if((w.imgSrc==='var')&&w.varId===id){var im=$('[data-role=img]',el);if(im)im.src=String(d.v);}}
  });
