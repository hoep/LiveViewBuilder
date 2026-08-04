  // ---------- Init ----------
  canvas.classList.add('grid');
  if(!RUN)loadTree(0,$('#tree'));
  load();
  // Selbst gehostete Schriften laden asynchron. Der ECharts-Canvas zeichnet Text mit der zum
  // Zeitpunkt verfuegbaren Schrift - daher nach font-ready alle Diagramme neu vermessen.
  try{if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){for(var k in _ec){try{_ec[k].resize();}catch(e){}}});}catch(e){}
