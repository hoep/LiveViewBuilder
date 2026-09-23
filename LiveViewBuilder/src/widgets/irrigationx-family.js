  // ===== Bewaesserungs-Familie (irrigx): irriggrid + irrigcircuit =====
  //
  //  Operative Steuerung der HomeSuite-Bewaesserungskreise (Modul IrrigationCircuit HSIR,
  //  GUID {D264A82B-DE31-45CC-8AF2-8F4C5D076508}) ueber den generischen ?api=mod-Transport.
  //  Bisher gab es fuer Bewaesserung nur den Wochenplan (heatx, domain='irrigation'); diese
  //  Familie liefert die Tages-Bedienung:
  //    irriggrid    : alle Kreise als Karten (nach Bereich/Raum gruppiert).
  //    irrigcircuit : EIN fester Kreis (w.circuitId), sonst identische Karte.
  //
  //  Datenquelle: ?api=mod&op=topology (Kreis-Liste, domain='irrigation'),
  //  ?api=mod&op=manifest&id=<iid> (varIds + Optionen + Bereiche + State beim ersten Laden),
  //  ?api=mod&op=state&id=<iid> (leichtgewichtiger Live-Refresh).
  //  Schreiben: setVar() auf die Control-Variablen (Active/Automatic/Duration/SeasonalAdjust/
  //  Program); runNow/stopNow/setArmed ueber ?api=mod&op=manage (Token). Schatten-Modus:
  //  solange armed=false laeuft der Kreis nur simuliert (Backend schaltet den Aktor nicht).
  (function(){
    if(!document.getElementById('irxfamCss')){var _s=document.createElement('style');_s.id='irxfamCss';_s.textContent=
      '.irxwrap{position:absolute;inset:0;overflow:auto;background:var(--surface);padding:10px;box-sizing:border-box}'
      +'.irx-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px}'
      +'.irx-shadow{font-size:11px;color:var(--muted);border:1px dashed var(--line,rgba(128,128,128,.35));border-radius:8px;padding:5px 9px;margin-bottom:8px}'
      +'.irx-floor{font-size:9px;letter-spacing:.7px;text-transform:uppercase;font-weight:700;color:var(--faint);margin:8px 2px 4px}'
      // Kartenraster: die Mindestbreite waechst mit der Kachel (cqmin gegen die Kachel = .w),
      // damit auf grossen Uebersichten nicht 6 winzige Spalten entstehen.
      +'.irx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(clamp(190px,45cqmin,280px),1fr));gap:clamp(7px,3cqmin,14px)}'
      // WICHTIG: die Karte ist selbst ein Groessen-Container (inline-size). Alle Innenmasse
      // rechnen deshalb mit cqi = KARTENbreite. Bei irriggrid ist die Kachel um ein Vielfaches
      // groesser als eine einzelne Karte - ohne diesen Container wuerde alles zu gross geraten.
      +'.irxc{container-type:inline-size;border:1px solid var(--line,rgba(128,128,128,.35));border-radius:var(--r-s,10px);background:var(--tile);padding:clamp(7px,3cqmin,13px) clamp(8px,3.2cqmin,14px);display:flex;flex-direction:column;gap:clamp(6px,3cqmin,12px)}'
      +'.irxc.run{border-color:var(--accent)}'
      // ---- Karte im Entwurfsstil (irxStil='karte'): eine Kachel je Kreis, grosse
      // effektive Dauer, Sperrgrund im Klartext, Batterie und ein Knopf. Die volle
      // Reglerkarte bleibt erreichbar - ein Tipp auf die Kachel klappt sie auf.
      // Im Kartenstil sollen die Kacheln die Breite AUFTEILEN, nicht in ein auto-fill-
      // Raster mit fester Mindestbreite fallen: bei drei Kreisen in einer 1430 breiten
      // Kachel entstanden sonst fuenf Spalten, von denen zwei leer blieben.
      +'.irxwrap.karte .irx-grid{grid-template-columns:repeat(auto-fit,minmax(clamp(230px,30cqi,460px),1fr));grid-auto-rows:1fr;align-content:stretch;height:100%;box-sizing:border-box}'
      +'.irxwrap.karte{container-type:inline-size;padding:0;display:flex;flex-direction:column;gap:clamp(5px,1.6cqmin,9px)}'
      +'.irxwrap.karte .irx-grid{flex:1;min-height:0}'
      // Der Schatten-Modus ist die wichtigste Aussage der Seite: es sieht aus wie eine
      // Steuerung, schaltet aber nichts. Er gehoert deshalb sichtbar ueber die Kacheln -
      // und verschwindet von selbst, sobald scharf geschaltet ist.
      +'.irx-schatten{flex:none;display:flex;align-items:center;gap:9px;padding:6px 12px;border-radius:var(--r-s,9px);'
      + 'border:1px solid var(--warn);background:color-mix(in oklab,var(--warn) 10%,transparent);'
      + 'color:var(--warn);font-size:clamp(10px,2.4cqmin,13px);line-height:1.3}'
      +'.irx-schatten b{font-weight:700}'
      +'.irx-schatten span{color:var(--muted);font-weight:400}'
      +'.irk-sch{flex:none;padding:4px 8px;border-radius:var(--r-s,9px);font-size:clamp(9px,3.2cqi,11px);font-weight:600;'
      + 'color:var(--warn);border:1px solid color-mix(in oklab,var(--warn) 45%,transparent);'
      + 'background:color-mix(in oklab,var(--warn) 10%,transparent);white-space:nowrap}'
      +'.irk{container-type:inline-size;border:1px solid var(--line);border-radius:var(--r,12px);background:var(--surface);'
      + 'padding:clamp(9px,2.9cqmin,15px);display:flex;flex-direction:column;overflow:hidden;cursor:pointer}'
      +'.irk-h{display:flex;align-items:flex-start;gap:clamp(6px,2.6cqi,11px)}'
      +'.irk-nm{font-size:clamp(13px,5.6cqi,18px);font-weight:600;line-height:1.2}'
      +'.irk-pl{font-size:clamp(10px,3.9cqi,12.5px);color:var(--faint);margin-top:3px;font-variant-numeric:tabular-nums}'
      +'.irk-st{flex:none;display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:var(--r-s,9px);'
      + 'font-size:clamp(10px,3.8cqi,12.5px);font-weight:600;white-space:nowrap}'
      +'.irk-st.ok{color:var(--accent);background:color-mix(in oklab,var(--accent) 12%,transparent);border:1px solid color-mix(in oklab,var(--accent) 45%,transparent)}'
      +'.irk-st.blk{color:var(--crit);background:color-mix(in oklab,var(--crit) 12%,transparent);border:1px solid color-mix(in oklab,var(--crit) 45%,transparent)}'
      +'.irk-st.run{color:var(--info);background:color-mix(in oklab,var(--info) 12%,transparent);border:1px solid color-mix(in oklab,var(--info) 45%,transparent)}'
      +'.irk-big{display:flex;align-items:baseline;gap:clamp(5px,2.4cqi,9px);margin-top:clamp(5px,2.2cqmin,10px)}'
      +'.irk-big b{font-size:clamp(22px,13cqi,40px);font-weight:700;line-height:1;font-variant-numeric:tabular-nums;font-family:var(--fm)}'
      +'.irk-big i{font-style:normal;font-size:clamp(11px,4.4cqi,15px);color:var(--muted)}'
      +'.irk-big s{font-size:clamp(10px,3.9cqi,13px);color:var(--faint);font-variant-numeric:tabular-nums;font-family:var(--fm)}'
      +'.irk-why{font-size:clamp(10px,3.9cqi,12.5px);color:var(--muted);margin-top:4px;line-height:1.3}'
      +'.irk-why.warn{color:var(--warn)}'
      +'.irk-sep{height:1px;background:var(--line-soft);margin:clamp(6px,2.4cqmin,10px) 0 clamp(5px,2cqmin,8px)}'
      +'.irk-kv{display:flex;gap:clamp(10px,5cqi,22px)}'
      +'.irk-kv>div{flex:1;min-width:0}'
      +'.irk-k{font-size:clamp(8px,3.1cqi,11px);letter-spacing:.06em;text-transform:uppercase;color:var(--faint);font-weight:600}'
      +'.irk-v{font-size:clamp(10px,4.1cqi,13.5px);margin-top:2px;font-variant-numeric:tabular-nums;font-family:var(--fm)}'
      +'.irk-v.leer{color:var(--faint);font-family:var(--fu)}'
      +'.irk-f{display:flex;align-items:center;gap:clamp(7px,3cqi,13px);margin-top:auto;padding-top:clamp(6px,2.4cqmin,10px)}'
      +'.irk-bat{display:flex;align-items:center;gap:6px;font-size:clamp(10px,3.9cqi,13px);color:var(--muted);font-variant-numeric:tabular-nums}'
      +'.irk-bat.warn{color:var(--warn)}'
      +'.irk-go{margin-left:auto;min-height:clamp(38px,11cqmin,46px);min-width:clamp(96px,42cqi,140px);display:flex;align-items:center;'
      + 'justify-content:center;gap:7px;border:1px solid var(--accent-2);border-radius:var(--r-s,9px);background:var(--surface-2);'
      + 'color:var(--accent);font-size:clamp(11px,4.3cqi,14.5px);font-weight:600;cursor:pointer}'
      +'.irk-go:disabled{opacity:.45;cursor:default}'
      // Verdichtung nach VERFUEGBARER KARTENHOEHE, nicht nach Bildschirmbreite: was
      // zaehlt, ist der Platz IN der Kachel. Weggelassen wird von aussen nach innen -
      // zuerst die Planzeile (steht als "naechster Lauf" ohnehin da), dann das
      // Wertepaar. Name, Zustand, Dauer, Sperrgrund und Knopf bleiben immer.
      +'.irx-knapp .irk-pl{display:none}'
      +'.irx-knapp .irk-big{margin-top:clamp(3px,1.4cqmin,7px)}'
      +'.irx-enger .irk-kv,.irx-enger .irk-sep{display:none}'
      +'.irx-schmal .irk-go i{display:none}'
      +'.irx-schmal .irk-go{min-width:clamp(44px,18cqi,64px)}'
      +'.irx-schmal .irk-sch{display:none}'
      // Unter etwa 120 px Kartenhoehe hilft Weglassen nicht mehr - dann ist die Karte
      // die falsche FORM. Sie wird zur Zeile: Name und Zustand links, Dauer, Batterie
      // und Knopf rechts. Das ist dieselbe Auskunft in einer Anordnung, die passt.
      +'.irx-zeile .irk{flex-direction:row;align-items:center;gap:clamp(8px,3cqi,16px);padding:clamp(7px,2.4cqmin,12px) clamp(9px,2.9cqmin,15px)}'
      +'.irx-zeile .irk-h{flex:1;min-width:0;align-items:center}'
      +'.irx-zeile .irk-big{margin:0;flex:none}'
      +'.irx-zeile .irk-big b{font-size:clamp(17px,9cqi,30px)}'
      +'.irx-zeile .irk-big s{display:none}'
      +'.irx-zeile .irk-why,.irx-zeile .irk-kv,.irx-zeile .irk-sep,.irx-zeile .irk-pl{display:none}'
      +'.irx-zeile .irk-f{margin:0;padding:0;flex:none}'
      // In der Zeilenform steht der Name neben den Marken statt darueber. Ohne
      // Kuerzung laeuft er unter ihnen durch - flex:1 schrumpft die BOX, nicht den TEXT.
      +'.irx-zeile .irk-nm{font-size:clamp(12px,5cqi,16px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      // Der NAME ist die wichtigste Angabe - er darf nicht als erstes weichen.
      // In der Zeilenform faellt deshalb die Schatten-Marke weg (sie steht im Band
      // darueber) und der Name bekommt eine Untergrenze.
      +'.irx-zeile .irk-h>div:first-child{overflow:hidden;flex:1 1 auto;min-width:clamp(64px,26cqi,150px)}'
      +'.irx-zeile .irk-sch{display:none}'
      +'.irx-zeile .irk-bat{flex:none}'
      // Die volle Reglerkarte passt NICHT in die Kachel: sie ist hoeher als die Zeile,
      // und ein Raster mit fester Zeilenhoehe schneidet sie ab. Sie kommt deshalb als
      // Blatt ueber die Kacheln - dieselbe Sprache wie bei den Regeltabellen.
      +'.irx-blatt{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;'
      + 'padding:clamp(6px,3cqmin,16px);background:color-mix(in oklab,var(--bg) 74%,transparent)}'
      +'.irx-blatt-in{background:var(--surface);border:1px solid var(--line);border-radius:var(--r,12px);'
      + 'box-shadow:0 10px 30px rgba(0,0,0,.38);padding:clamp(9px,3cqmin,16px);width:min(460px,100%);'
      + 'max-height:100%;overflow:auto;container-type:inline-size}'
      +'.irx-blatt-k{display:flex;align-items:center;gap:9px;margin-bottom:6px}'
      +'.irx-blatt-k b{flex:1;font-size:clamp(13px,3.4cqmin,17px)}'
      +'.irx-blatt-zu{flex:none;min-height:36px;min-width:36px;display:flex;align-items:center;justify-content:center;'
      + 'border:1px solid var(--line);border-radius:var(--r-s,9px);background:var(--surface-2);color:var(--muted);cursor:pointer}'
      +'.irxc-h{display:flex;align-items:center;gap:clamp(5px,2.6cqi,10px)}'
      +'.irxc-ic{width:clamp(16px,7cqi,26px);height:clamp(16px,7cqi,26px);flex:none;color:var(--accent);display:flex;align-items:center;justify-content:center}'
      +'.irxc-ic svg{width:100%;height:100%}'
      +'.irxc-nm{flex:1;min-width:0;font-size:clamp(11px,5cqi,16px);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.irxc-st{font-size:clamp(9px,3.8cqi,12px);font-weight:700;padding:2px clamp(5px,2.6cqi,10px);border-radius:999px;background:var(--surface-2);color:var(--muted);white-space:nowrap}'
      +'.irxc-st.on{background:var(--accent);color:#fff}'
      +'.irxc-st.warn{background:color-mix(in oklab,var(--warn,#e0a030) 22%,transparent);color:var(--warn,#e0a030)}'
      +'.irxc-sub{font-size:clamp(9px,3.8cqi,12px);color:var(--faint)}'
      +'.irxc-arm{font-size:clamp(9px,3.6cqi,12px);padding:2px clamp(5px,2.6cqi,10px);border-radius:12px;border:1px solid var(--line,rgba(128,128,128,.35));background:none;color:var(--muted);cursor:pointer;white-space:nowrap}'
      +'.irxc-arm.armed{background:var(--accent);border-color:var(--accent);color:#fff}'
      +'.irxc-run{display:flex;align-items:center;gap:clamp(4px,2.2cqi,9px)}'
      +'.irxc-stp{display:inline-flex;align-items:center;border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;overflow:hidden}'
      // Untergrenzen der Bedienelemente bleiben am Handy tippbar (>= 28px Kantenlaenge).
      +'.irxc-stp button{width:clamp(28px,11cqi,40px);height:clamp(30px,12cqi,40px);border:0;background:var(--surface-2);color:var(--text);cursor:pointer;font-size:clamp(13px,5cqi,18px)}'
      +'.irxc-stp span{min-width:clamp(44px,17cqi,70px);text-align:center;font-family:var(--fm);font-size:clamp(10px,4cqi,13px)}'
      +'.irxc-go{flex:1;height:clamp(30px,12cqi,44px);border:0;border-radius:8px;background:var(--accent);color:#fff;font-size:clamp(11px,4.4cqi,14px);font-weight:600;cursor:pointer}'
      +'.irxc-stop{height:clamp(30px,12cqi,44px);padding:0 clamp(8px,4cqi,16px);border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;background:var(--tile);color:var(--text);font-size:clamp(11px,4.4cqi,14px);cursor:pointer}'
      +'.irxc-tgls{display:flex;gap:clamp(5px,2.8cqi,10px)}'
      +'.irxc-tgl{flex:1;height:clamp(28px,11cqi,40px);border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;background:var(--tile);color:var(--muted);font-size:clamp(11px,4.4cqi,14px);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}'
      +'.irxc-tgl.on{border-color:var(--accent);background:color-mix(in oklab,var(--accent) 14%,transparent);color:var(--accent);font-weight:600}'
      +'.irxc-row{display:flex;align-items:center;gap:clamp(5px,2.8cqi,10px)}'
      +'.irxc-lbl{width:clamp(58px,22cqi,96px);flex:none;font-size:clamp(10px,4.2cqi,13px);color:var(--muted)}'
      +'.irxc-rng{flex:1;height:clamp(5px,2cqi,8px);border-radius:6px}'
      +'.irxc-val{min-width:clamp(38px,15cqi,60px);text-align:right;font-family:var(--fm);font-size:clamp(10px,4cqi,13px)}'
      +'.irxc-sel{flex:1;height:clamp(28px,11cqi,40px);border:1px solid var(--line,rgba(128,128,128,.35));border-radius:8px;background:var(--tile);color:var(--text);font-size:clamp(11px,4.4cqi,14px);padding:0 clamp(4px,2cqi,9px)}'
      +'.irk-cog{border:0;background:transparent;color:var(--faint);cursor:pointer;padding:2px;margin-left:2px;display:inline-flex;align-items:center;flex:none;border-radius:6px}'
      +'.irk-cog:hover{color:var(--accent);background:color-mix(in oklab,var(--accent) 12%,transparent)}'
      // ---- Feineinstellung (irxStil='einstellungen') ----------------------------
      // Eigener Groessen-Container auf .irs, damit alle Masse gegen die POPUP-Breite
      // rechnen (cqi) und nicht gegen die Kachel der Uebersicht.
      +'.irs{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--surface);container-type:inline-size;overflow:hidden}'
      +'.irs-h{display:flex;align-items:center;gap:clamp(7px,2cqi,12px);padding:clamp(8px,2.2cqi,13px) clamp(10px,2.6cqi,17px);background:linear-gradient(180deg,var(--surface-2),var(--surface));border-bottom:1px solid var(--line);flex:none}'
      +'.irs-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);flex:none;box-shadow:0 0 0 4px color-mix(in oklab,var(--accent) 18%,transparent)}'
      +'.irs-ht h2{margin:0;font-size:clamp(13px,1.9cqi,17px);font-weight:680;letter-spacing:-.01em}'
      +'.irs-sub{font-size:clamp(9.5px,1.3cqi,12px);color:var(--faint);margin-top:1px}'
      +'.irs-b{flex:1;min-height:0;overflow:auto;padding:clamp(8px,1.8cqi,14px) clamp(10px,2.2cqi,17px) clamp(4px,1cqi,6px);display:grid;grid-template-columns:repeat(auto-fit,minmax(clamp(230px,44cqi,460px),1fr));gap:clamp(7px,1.4cqi,12px) clamp(9px,1.8cqi,16px);align-content:start;align-items:start}'
      +'.irs-c{background:var(--tile);border:1px solid var(--line-soft,var(--line));border-radius:var(--r-s,9px);padding:clamp(7px,1.4cqi,11px) clamp(8px,1.6cqi,13px) clamp(8px,1.5cqi,12px)}'
      +'.irs-c>h3{margin:0 0 clamp(4px,.9cqi,8px);font-size:clamp(8.5px,1.1cqi,10.5px);font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);display:flex;align-items:center;gap:7px}'
      +'.irs-ic{color:var(--accent);display:inline-flex;align-items:center}'
      +'.irs-sp{flex:1}'
      +'.irs-r{display:flex;align-items:center;gap:clamp(6px,1.1cqi,10px);padding:clamp(3px,.6cqi,5px) 0;border-top:1px solid var(--line-soft,var(--line))}'
      +'.irs-c>.irs-r:first-of-type{border-top:0}'
      +'.irs-l{font-size:clamp(10.5px,1.3cqi,13px);flex:1;min-width:0;line-height:1.3}'
      +'.irs-l em{display:block;font-style:normal;font-size:clamp(8.5px,1.05cqi,10.5px);color:var(--faint);margin-top:1px}'
      +'.irs-pf{color:var(--faint);flex:none;font-size:12px}'
      // Schalter: gefuellte Aktivflaeche in accent-2 (nie Akzent mit dunkler Schrift).
      +'.irs-sw{width:34px;height:19px;border-radius:11px;background:var(--line);position:relative;flex:none;border:0;padding:0;cursor:pointer}'
      +'.irs-sw i{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:var(--faint);transition:left .12s,background .12s}'
      +'.irs-sw.on{background:var(--accent-2)}.irs-sw.on i{left:17px;background:#fff}'
      +'.irs-num{display:inline-flex;align-items:center;gap:4px;flex:none}'
      +'.irs-num input{width:clamp(44px,7cqi,74px);padding:4px 6px;border-radius:7px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:clamp(10.5px,1.25cqi,12.5px);font-family:var(--fm);text-align:right}'
      +'.irs-num input:focus{outline:0;border-color:var(--accent);box-shadow:var(--ring)}'
      +'.irs-u{color:var(--faint);font-size:clamp(9px,1.05cqi,11px);font-family:var(--fm);min-width:2.2em}'
      +'.irs-src{display:inline-flex;align-items:center;gap:6px;max-width:clamp(120px,24cqi,240px);padding:4px 8px;border-radius:7px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:clamp(9.5px,1.15cqi,12px);cursor:pointer;flex:none}'
      +'.irs-src-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.irs-src.leer{color:var(--faint)}'
      +'.irs-src:hover{border-color:color-mix(in oklab,var(--accent) 45%,var(--line))}'
      +'.irs-seg{display:flex;border:1px solid var(--line);border-radius:7px;overflow:hidden;flex:none}'
      +'.irs-seg button{padding:4px clamp(6px,1.1cqi,11px);font-size:clamp(9.5px,1.15cqi,12px);color:var(--muted);border:0;border-left:1px solid var(--line);background:transparent;cursor:pointer}'
      +'.irs-seg button:first-child{border-left:0}'
      +'.irs-seg button.on{background:var(--accent-2);color:#fff;font-weight:650}'
      +'.irs-hint{font-size:clamp(8.5px,1.05cqi,10.5px);color:var(--faint);margin-top:clamp(4px,.8cqi,7px);line-height:1.4;padding-top:clamp(4px,.8cqi,7px);border-top:1px dashed var(--line-soft,var(--line))}'
      +'.irs-hint b{color:var(--muted);font-weight:600}'
      +'.irs-warn{display:flex;align-items:center;gap:7px;font-size:clamp(8.5px,1.05cqi,10.5px);color:var(--warn);background:color-mix(in oklab,var(--warn) 10%,transparent);border:1px solid color-mix(in oklab,var(--warn) 30%,transparent);border-radius:7px;padding:5px 8px;margin-top:6px}'
      +'.irs-prev{flex:none;margin:0 clamp(10px,2.2cqi,17px) clamp(6px,1.2cqi,10px);background:linear-gradient(180deg,color-mix(in oklab,var(--accent) 7%,var(--tile)),var(--tile));border:1px solid color-mix(in oklab,var(--accent) 24%,var(--line));border-radius:var(--r-s,9px);padding:clamp(6px,1.1cqi,10px) clamp(8px,1.5cqi,14px);display:flex;align-items:center;gap:clamp(8px,1.6cqi,16px);flex-wrap:wrap}'
      +'.irs-pt{font-size:clamp(8px,1cqi,10px);font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);flex:none}'
      +'.irs-chips{display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:0}'
      +'.irs-chip{font-size:clamp(9px,1.1cqi,11.5px);color:var(--muted);background:var(--surface-2);border:1px solid var(--line);border-radius:20px;padding:2px 9px;font-family:var(--fm);white-space:nowrap}'
      +'.irs-chip b{color:var(--text);font-weight:600}'
      +'.irs-verd{font-size:clamp(10.5px,1.3cqi,13px);font-weight:680;flex:none;display:flex;align-items:center;gap:6px}'
      +'.irs-verd.block{color:var(--warn)}.irs-verd.frei{color:var(--ok)}'
      +'.irs-bul{width:8px;height:8px;border-radius:50%;background:currentColor}'
      +'.irs-f{display:flex;align-items:center;gap:8px;padding:clamp(7px,1.4cqi,12px) clamp(10px,2.2cqi,17px);border-top:1px solid var(--line);background:linear-gradient(0deg,var(--surface-2),var(--surface));flex:none}'
      +'.irs-note{font-size:clamp(8.5px,1.05cqi,11px);color:var(--faint);flex:1;min-width:0}'
      +'.irs-btn{padding:6px clamp(9px,1.7cqi,15px);border-radius:9px;border:1px solid var(--line);background:var(--surface-2);color:var(--text);font-size:clamp(10.5px,1.25cqi,12.5px);cursor:pointer}'
      +'.irs-btn.pri{background:var(--accent-2);color:#fff;border-color:transparent;font-weight:650}'
      +'.irs-btn:disabled{opacity:.42;cursor:default}'
      // ---- Quellen-Waehler ----
      +'.irs-pk-h{position:absolute;inset:0;background:rgba(4,8,9,.62);display:flex;align-items:center;justify-content:center;z-index:9}'
      +'.irs-pk{width:min(84%,440px);max-height:78%;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:var(--r,12px);box-shadow:0 24px 60px -24px #000;overflow:hidden}'
      +'.irs-pk-k{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-bottom:1px solid var(--line);font-size:12px;font-weight:650}'
      +'.irs-pk-x{border:0;background:transparent;color:var(--muted);cursor:pointer;display:inline-flex;padding:2px}'
      +'.irs-pk-s{margin:9px 12px 6px;padding:6px 9px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:12px}'
      +'.irs-pk-s:focus{outline:0;border-color:var(--accent);box-shadow:var(--ring)}'
      +'.irs-pk-l{flex:1;min-height:0;overflow:auto;padding:0 8px 6px}'
      +'.irs-pk-r{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--text);padding:5px 7px;border-radius:7px;cursor:pointer}'
      +'.irs-pk-r:hover{background:var(--surface-2)}'
      +'.irs-pk-r b{display:block;font-size:11.5px;font-weight:600}'
      +'.irs-pk-r span{display:block;font-size:9.5px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      +'.irs-pk-leer{padding:10px 8px;font-size:11px;color:var(--faint)}'
      +'.irs-pk-clr{margin:0 12px 10px;padding:5px 9px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--muted);font-size:11px;cursor:pointer}';
      document.head.appendChild(_s);}

    var _irData=null, _irErr='', _irLoading=false, _irRetry=0;
    // Leere Antwort oder Netzfehler NICHT als Endzustand behalten. Waehrend die HomeSuite-
    // Library neu laedt (rund 30 s), liefert die Topologie keine Kreise; wer genau dann die
    // Seite oeffnete, sah bis zum naechsten Neuladen leere Karten (23.09.2026). Jetzt wird
    // nachgefragt: 15 s, 30 s, 60 s ... hoechstens 5 min Abstand.
    function irNochmal(cb){
      var ms=Math.min(300000,15000*Math.pow(2,Math.min(_irRetry,5))); _irRetry++;
      setTimeout(function(){ _irData=null; irLoad(cb); }, ms);
    }

    function irDemo(){return [
      {iid:1,name:'Rasen Nord',room:'Garten',group:'Garten',armed:false,
       vars:{Active:0,Automatic:0,Duration:0,SeasonalAdjust:0,Program:0},
       prog:[[0,'Manuell'],[1,'Täglich'],[2,'Jeden 2. Tag'],[5,'Mo/Mi/Fr']],
       dur:{min:1,max:120,step:1}, adj:{min:0,max:200,step:5}, runMin:20,
       st:{Active:1,Automatic:1,Duration:20,SeasonalAdjust:120,Program:5,Running:1,RainBlocked:0,Rain:0.4,Online:1,LastRun:'heute 06:00 · 18 min'}},
      {iid:2,name:'Beete Süd',room:'Garten',group:'Garten',armed:true,
       vars:{Active:0,Automatic:0,Duration:0,SeasonalAdjust:0,Program:0},
       prog:[[0,'Manuell'],[1,'Täglich'],[2,'Jeden 2. Tag'],[5,'Mo/Mi/Fr']],
       dur:{min:1,max:120,step:1}, adj:{min:0,max:200,step:5}, runMin:15,
       st:{Active:0,Automatic:1,Duration:15,SeasonalAdjust:100,Program:2,Running:0,RainBlocked:1,Rain:6.2,Online:1,LastRun:'gestern 05:30 · 15 min'}}
    ];}

    var FLOOR_ORDER=['Erdgeschoss','Obergeschoss','Dachgeschoss','Garten','Wohnhaus'];
    function floorRank(f){var i=FLOOR_ORDER.indexOf(f);return i<0?99:i;}
    function irDoku(){return (typeof DOKU!=='undefined'&&DOKU);}

    // ---- Laden -------------------------------------------------------------
    // 1) Topologie -> Bewaesserungs-Kreise (domain='irrigation').
    // 2) je Kreis Manifest (varIds/Optionen/Ranges/State) + Config (armed).
    function irLoad(cb){
      if(irDoku()){_irData=irDemo();_irErr='';cb&&cb();return;}
      if(_irLoading)return; _irLoading=true;
      fetch('?api=mod&op=topology',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        var list=irCircuitsFromTopo(j);
        if(!list.length){_irData=[];_irErr='';_irLoading=false;cb&&cb();irNochmal(cb);return;}
        _irRetry=0;
        var jobs=list.map(function(c){
          return fetch('?api=mod&op=manifest&id='+c.iid,{cache:'no-store'}).then(function(r){return r.json();})
            .then(function(m){irApplyManifest(c,m);}).catch(function(){});
        });
        // armed steckt in der Config (kein State-Feld) -> per manage getConfig (Token) nachziehen.
        list.forEach(function(c){ jobs.push(
          irManagePromise(c.iid,{op:'getConfig'}).then(function(g){ if(g&&g.config)c.armed=!!g.config.armed; }).catch(function(){}) ); });
        // Effektive Dauer, Sperre und Wochenfenster - die Karte im Entwurfsstil lebt davon.
        list.forEach(function(c){ jobs.push(irProbe(c)); jobs.push(irPlan(c)); });
        Promise.all(jobs).then(function(){_irData=list;_irErr='';_irLoading=false;cb&&cb();})
          .catch(function(){_irData=list;_irErr='';_irLoading=false;cb&&cb();});
      }).catch(function(){_irErr='net';_irLoading=false;cb&&cb();irNochmal(cb);});
    }
    // Kreis-Liste aus der Topologie ziehen (gleiche Baumform wie heatx: Haus->Bereich->Raum->entities).
    function irCircuitsFromTopo(j){
      var out=[];
      // Die Kette Haus/Bereich/Raum wird MITGEFUEHRT. Bei zwei Standorten heissen beide
      // Bereiche "Garten" - ohne das Haus waeren die Gruppen nicht unterscheidbar, und
      // eine Ansicht koennte sich nicht auf einen Standort beschraenken.
      function pushEnt(e,room,group,kette,haus){ if((e.domain||'')!=='irrigation')return;
        out.push({iid:e.iid,name:e.name||room||('#'+e.iid),room:room||'',group:group||'',haus:haus||'',
          kette:kette||[],armed:false,
          vars:{},prog:[],dur:{min:1,max:120,step:1},adj:{min:0,max:200,step:5},runMin:0,st:{}}); }
      (j&&j.tree||[]).forEach(function(haus){ var hid=haus.iid||haus.id||0, hn=haus.name||'';
        (haus.children||[]).forEach(function(area){ var aid=area.iid||area.id||0;
        if(area.kind==='Bereich'){ var g=area.abbr||area.name||'';
          (area.children||[]).forEach(function(rm){ var rid=rm.iid||rm.id||0;
            if(rm.kind==='Raum')(rm.entities||[]).forEach(function(e){pushEnt(e,rm.name,g,[hid,aid,rid],hn);}); });
        } else if(area.kind==='Raum'){ (area.entities||[]).forEach(function(e){pushEnt(e,area.name,'',[hid,aid],hn);}); }
      }); });
      (j&&j.unassigned||[]).forEach(function(e){ pushEnt(e,'','',[],''); });
      return out;
    }
    /** Gehoert der Kreis unter den gewaehlten Standort-Knoten? 0 = keine Einschraenkung. */
    function irImStandort(c,root){ root=parseInt(root)||0; if(!root)return true;
      return (c.kette||[]).indexOf(root)>=0; }
    function irApplyManifest(c,m){
      if(!m||!m.controls)return;
      m.controls.forEach(function(ctrl){
        if(!ctrl||!ctrl.ident)return;
        if(ctrl.varId)c.vars[ctrl.ident]=ctrl.varId;
        if(ctrl.ident==='Program'&&ctrl.options)c.prog=ctrl.options.map(function(o){return [o.value,o.label];});
        if(ctrl.ident==='Duration')c.dur={min:num(ctrl.min,1),max:num(ctrl.max,120),step:num(ctrl.step,1)};
        if(ctrl.ident==='SeasonalAdjust')c.adj={min:num(ctrl.min,0),max:num(ctrl.max,200),step:num(ctrl.step,5)};
      });
      if(m.state)c.st=m.state;
      if(!c.runMin)c.runMin=num(c.st.Duration,20);
    }
    function num(v,d){var n=parseFloat(v);return isNaN(n)?d:n;}

    // ---- Zusatzdaten fuer die Karte im Entwurfsstil --------------------------
    // computeProbe rechnet effektive Dauer und Gate (Regen/Temperatur) OHNE Geraete-
    // zugriff - es liest nur Variablen. getSchedule liefert die Wochenfenster, aus
    // denen "taeglich 15:07-15:17" und "naechster Lauf" entstehen.
    function irProbe(c){ return irManagePromise(c.iid,{op:'computeProbe'})
      .then(function(j){ if(j&&j.ok)c.probe=j; }).catch(function(){}); }
    function irPlan(c){ return irManagePromise(c.iid,{op:'getSchedule'})
      .then(function(j){ if(j&&j.ok)c.week=j.week||null; }).catch(function(){}); }
    /** Fenster eines Tages: [{von,bis}] in Minuten. Slots sind kumulierte Enden. */
    function irFenster(slots){
      var out=[],vor=0;
      (slots||[]).forEach(function(sl){
        var end=num(sl.end,0), val=num(sl.val,0);
        if(val>0&&end>vor)out.push({von:vor,bis:end});
        vor=end;
      });
      return out;
    }
    function irHM(m){ m=Math.max(0,Math.round(m)); var h=Math.floor(m/60)%24,i=m%60;
      return (h<10?'0':'')+h+':'+(i<10?'0':'')+i; }
    /** "taeglich 15:07-15:17" wenn alle sieben Tage dasselbe einzelne Fenster tragen. */
    function irPlanText(c){
      if(!c.week)return '';
      var ref=null,gleich=true,leer=true;
      for(var d=0;d<7;d++){
        var f=irFenster(c.week[d]);
        if(f.length)leer=false;
        var k=f.map(function(x){return x.von+'-'+x.bis;}).join(',');
        if(ref===null)ref=k; else if(k!==ref)gleich=false;
      }
      if(leer)return '';
      if(gleich){ var f0=irFenster(c.week[0]);
        if(f0.length===1)return 'täglich '+irHM(f0[0].von)+'–'+irHM(f0[0].bis);
        // Zwei Fenster sind der Normalfall (frueh und abends) - dann die ZEITEN nennen.
        // "taeglich - 2 Fenster" verschweigt genau das, was man wissen will.
        if(f0.length===2)return 'täglich '+irHM(f0[0].von)+' + '+irHM(f0[1].von);
        return 'täglich · '+f0.length+' Fenster';
      }
      return 'Wochenplan hinterlegt';
    }
    /** Naechstes An-Fenster ab jetzt, bis zu sieben Tage voraus. */
    function irNaechster(c){
      if(!c.week)return '';
      var jetzt=_hzJetzt(), heute=(jetzt.getDay()+6)%7, min=jetzt.getHours()*60+jetzt.getMinutes();
      var tage=['Mo','Di','Mi','Do','Fr','Sa','So'];
      for(var i=0;i<8;i++){
        var d=(heute+i)%7, f=irFenster(c.week[d]);
        for(var k=0;k<f.length;k++){
          if(i===0&&f[k].von<=min)continue;
          if(i===0)return 'heute '+irHM(f[k].von);
          if(i===1)return 'morgen '+irHM(f[k].von);
          return tage[d]+' '+irHM(f[k].von);
        }
      }
      return '';
    }
    // ---- Ventilzustand aus der Bewaesserungs-Wache ---------------------------
    // Batterie und Funk haengen am GERAET, nicht an der HomeSuite-Entitaet. Die Wache
    // schreibt sie je Kreis in eine JSON-Variable; ohne sie bleibt die Zeile leer.
    var _irWache={}, _irWacheT=0;
    function irWacheLaden(vid,cb){
      vid=parseInt(vid)||0;
      if(!vid||irDoku()){cb&&cb();return;}
      if(Date.now()-_irWacheT<20000){cb&&cb();return;}
      fetch('?api=val&ids='+vid,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;})
        .then(function(j){ var d=j&&j.values&&j.values[vid];
          if(d&&d.v){ try{_irWache=JSON.parse(d.v)||{};}catch(e){} }
          _irWacheT=Date.now(); cb&&cb(); }).catch(function(){cb&&cb();});
    }
    function irWacheFor(c){ return _irWache[String(c.iid)]||null; }
    // Leichter State-Refresh (ohne Manifest) — fuers Polling.
    function irRefresh(cb){
      if(irDoku()||!_irData){cb&&cb();return;}
      var jobs=_irData.map(function(c){
        return fetch('?api=mod&op=state&id='+c.iid,{cache:'no-store'}).then(function(r){return r.json();})
          .then(function(s){ if(s&&!s.err)c.st=s; }).catch(function(){});
      });
      // Das Gate haengt an Regen und Temperatur und kann sich zwischen zwei Laeufen
      // drehen - der Trockenlauf gehoert deshalb in den Takt. Er kostet keinen
      // Geraetezugriff, er liest nur Variablen. Der Wochenplan aendert sich nicht
      // von selbst und bleibt beim Laden.
      _irData.forEach(function(c){ jobs.push(irProbe(c)); });
      Promise.all(jobs).then(function(){cb&&cb();}).catch(function(){cb&&cb();});
    }

    // ---- Steuerung ---------------------------------------------------------
    function irManagePromise(iid,body){
      return fetch('?api=mod&op=manage&id='+iid+'&key='+encodeURIComponent(TOKEN),
        {method:'POST',cache:'no-store',headers:{'Content-Type':'text/plain'},body:JSON.stringify(body)})
        .then(function(r){return r.json();});
    }
    function irManage(iid,body,cb){
      if(irDoku()){cb&&cb();return;}
      irManagePromise(iid,body).then(function(j){ if(j&&j.note&&typeof toast==='function')toast(j.note); cb&&cb(j); })
        .catch(function(){ if(typeof toast==='function')toast('Bewässerung: Verbindungsfehler'); });
    }
    function irSetVar(c,ident,val){ var id=c.vars&&c.vars[ident]; if(!id){if(typeof toast==='function')toast('Keine Bindung: '+ident);return;}
      if(typeof setVar==='function')setVar(id,val); c.st[ident]=val; }
    function irRunNow(c,min){ c.st.Running=1; irManage(c.iid,{op:'runNow',args:{minutes:min}}); }
    function irStopNow(c){ c.st.Running=0; irManage(c.iid,{op:'stopNow'}); }
    function irSetArmed(c,armed){ c.armed=armed; irManage(c.iid,{op:'setArmed',args:{armed:armed}}); }

    // ---- Render ------------------------------------------------------------
    function irIcon(){return (typeof iconSVG==='function')?iconSVG('droplet',100):'';}
    function irStatus(c){var s=c.st||{};
      if(s.Online===0||s.Online===false)return ['Offline','warn'];
      if(s.RainBlocked===1||s.RainBlocked===true||s.RainBlocked==='1')return ['Regen-Sperre','warn'];
      if(s.Running===1||s.Running===true||s.Running==='1')return ['Läuft','on'];
      if(s.Automatic===1||s.Automatic===true||s.Automatic==='1')return ['Automatik',''];
      return ['Bereit',''];
    }
    function irCard(c){
      var s=c.st||{}, run=(s.Running===1||s.Running===true||s.Running==='1');
      var stat=irStatus(c);
      var auto=(s.Automatic===1||s.Automatic===true||s.Automatic==='1');
      var act=(s.Active===1||s.Active===true||s.Active==='1');
      var dur=Math.round(num(s.Duration,c.runMin||20));
      var adj=Math.round(num(s.SeasonalAdjust,100));
      var prog=parseInt(s.Program,10); if(isNaN(prog))prog=0;
      var runMin=Math.round(c.runMin||dur||20);
      var sub=[]; if(c.room)sub.push(c.room); if(s.LastRun)sub.push(String(s.LastRun)); if(s.Rain!=null&&s.Rain!=='')sub.push('Regen '+(Math.round(num(s.Rain,0)*10)/10)+' mm');
      var h='<div class="irxc'+(run?' run':'')+'" data-iric="'+c.iid+'">'
        +'<div class="irxc-h"><span class="irxc-ic">'+irIcon()+'</span>'
        +'<span class="irxc-nm">'+escL(c.name||'')+'</span>'
        +'<span class="irxc-st '+stat[1]+'">'+esc(stat[0])+'</span>'
        +'<button class="irxc-arm'+(c.armed?' armed':'')+'" data-irarm="'+c.iid+'" title="'+(c.armed?'Scharf geschaltet – klick für Schatten-Modus':'Schatten-Modus – klick zum Scharfschalten')+'">'+(c.armed?'Scharf':'Schatten')+'</button></div>';
      // Jetzt bewaessern (Minuten-Stepper) + Stoppen
      h+='<div class="irxc-run"><span class="irxc-stp"><button data-irmin="'+c.iid+'" data-ird="-1">−</button><span>'+runMin+' min</span><button data-irmin="'+c.iid+'" data-ird="1">+</button></span>'
        +'<button class="irxc-go" data-irrun="'+c.iid+'">Jetzt</button>'
        +'<button class="irxc-stop" data-irstop="'+c.iid+'">Stopp</button></div>';
      // Automatik + Active
      h+='<div class="irxc-tgls"><button class="irxc-tgl'+(auto?' on':'')+'" data-irauto="'+c.iid+'">Automatik</button>'
        +'<button class="irxc-tgl'+(act?' on':'')+'" data-iract="'+c.iid+'">'+(act?'Aktiv':'Aus')+'</button></div>';
      // Basisdauer
      h+='<div class="irxc-row"><span class="irxc-lbl">Basisdauer</span><span class="irxc-stp"><button data-irdur="'+c.iid+'" data-ird="-1">−</button><span>'+dur+' min</span><button data-irdur="'+c.iid+'" data-ird="1">+</button></span></div>';
      // Saison-Faktor
      h+='<div class="irxc-row"><span class="irxc-lbl">Saison</span>'
        +'<input class="irxc-rng" type="range" min="'+c.adj.min+'" max="'+c.adj.max+'" step="'+c.adj.step+'" value="'+adj+'" data-iradj="'+c.iid+'" aria-label="Saison-Faktor">'
        +'<span class="irxc-val" data-iradjv="'+c.iid+'">'+adj+' %</span></div>';
      // Programm
      if(c.prog&&c.prog.length){
        h+='<div class="irxc-row"><span class="irxc-lbl">Programm</span><select class="irxc-sel" data-irprog="'+c.iid+'">'
          +c.prog.map(function(o){return '<option value="'+o[0]+'"'+(prog==o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></div>';
      }
      if(sub.length)h+='<div class="irxc-sub">'+esc(sub.join(' · '))+'</div>';
      h+='</div>';
      return h;
    }
    // ---- Karte im Entwurfsstil ----------------------------------------------
    function irTropfen(){return '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4-7-12-7-12S5 11 5 15a7 7 0 0 0 7 7Z"/></svg>';}
    function irBattIco(p){
      var f=Math.max(0,Math.min(10,Math.round((num(p,0)/100)*10)));
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
        +'<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/>'
        +(f?'<rect x="4" y="9" width="'+(f*1.3)+'" height="6" rx="1" fill="currentColor" stroke="none"/>':'')+'</svg>';
    }
    /** "Bewaesserung Buchshecke (Bewässerung)" -> "Buchshecke". Der Suffix kommt vom
        Modul, der Praefix aus dem Instanznamen; auf einer Bewaesserungsseite ist beides
        nur Wiederholung. */
    function irName(n){
      n=String(n||'');
      n=n.replace(/\s*\((?:Bew[äa]sserung|Irrigation)\)\s*$/i,'');
      n=n.replace(/^\s*Bew[äa]sserung\s+/i,'');
      return n.trim();
    }
    /** Sperrgrund lesbar machen: das Modul liefert "Regen 4.83 mm (>= 2)". */
    function irGrund(t){
      t=String(t||'');
      t=t.replace(/(\d),?(\d*)\.(\d+)/g,function(m,a,b,d){return a+b+','+d;});
      t=t.replace(/\(>=\s*([0-9,]+)\)/,'über der Schranke von $1 mm');
      return t;
    }
    function irKarte(c,w){
      var s=c.st||{}, pr=c.probe||{}, wa=irWacheFor(c);
      var run=(s.Running===1||s.Running===true||s.Running==='1');
      var gesperrt=!!(pr.gate&&pr.gate.blocked);
      var stat = run ? ['Läuft','run'] : (gesperrt ? ['Gesperrt','blk'] : ['Bereit','ok']);
      var basis = (pr.baseMin!=null) ? num(pr.baseMin,0) : num(s.Duration,0);
      var eff   = (pr.effectiveMin!=null) ? num(pr.effectiveMin,basis) : basis;
      var plan  = irPlanText(c), naechst = irNaechster(c);
      var grund = gesperrt ? (pr.gate.reason||'gesperrt') : '';
      var h='<div class="irk" data-irkarte="'+c.iid+'">'
        +'<div class="irk-h"><div style="flex:1;min-width:0">'
          +'<div class="irk-nm">'+escL(irName(c.name))+'</div>'
          +'<div class="irk-pl'+(plan?'':' ')+'" style="'+(plan?'':'color:var(--warn)')+'">'+esc(plan||'kein Zeitplan hinterlegt')+'</div>'
        +'</div>'
        +(c.armed===false?'<span class="irk-sch">Schatten</span>':'')
        +'<span class="irk-st '+stat[1]+'">'+esc(stat[0])+'</span>'
        // Zahnrad nur, wenn eine Einstellungsansicht hinterlegt ist - sonst waere es
        // ein Knopf, der nichts tut.
        +(w&&w.irxPopupCfg?'<button class="irk-cog" data-ircfg="'+c.iid+'" title="Feineinstellung">'
          +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
          +'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.63.78 1.07 1.44 1.09H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
          +'</button>':'')
        +'</div>'
        +'<div class="irk-big"><b>'+(Math.round(eff*10)/10)+'</b><i>min</i>'
        + (Math.abs(eff-basis)>0.05 ? '<s style="text-decoration:line-through">'+(Math.round(basis*10)/10)+' min</s>'
                                     : '<s style="text-decoration:none">Basis '+(Math.round(basis*10)/10)+' min</s>')+'</div>';
      if(grund) h+='<div class="irk-why">'+esc(irGrund(grund))+'</div>';
      else if(wa&&wa.stufe&&wa.stufe!=='ok'&&wa.text) h+='<div class="irk-why warn">'+esc(wa.text)+'</div>';
      else if(pr.tempFactor!=null&&num(pr.tempFactor,1)!==1)
        h+='<div class="irk-why">Temperatur '+Math.round(num(pr.tempFactor,1)*100)+' % · '+(pr.tempNow!=null?(String(pr.tempNow).replace('.',',')+' °C'):'')+'</div>';

      h+='<div class="irk-sep"></div>'
        +'<div class="irk-kv">'
          +'<div><div class="irk-k">Nächster Lauf</div><div class="irk-v'+(naechst?'':' leer')+'">'+esc(naechst||'—')+'</div></div>'
          +'<div><div class="irk-k">Zuletzt</div><div class="irk-v'+((wa&&wa.letzte)?'':' leer')+'">'
            +esc((wa&&wa.letzte)?wa.letzte:'keine Aufzeichnung')+'</div></div>'
        +'</div>'
        +'<div class="irk-f">';
      if(wa&&wa.batt!=null)
        h+='<span class="irk-bat'+(wa.batt<=25?' warn':'')+'">'+irBattIco(wa.batt)+num(wa.batt,0)+' %</span>';
      h+='<button class="irk-go" data-irrun="'+c.iid+'"'+(run?' disabled':'')+'>'+irTropfen()
        +'<i style="font-style:normal">'+(run?'Läuft':'Jetzt gießen')+'</i></button></div>';
      h+='</div>';
      return h;
    }
    var _irOffen={};
    // Welcher Kreis gehoert ins Popup? Ein echtes LVB-Popup ist eine eigene ANSICHT -
    // sie kennt den angetippten Kreis nicht. Der Alias-Mechanismus von openPopup ersetzt
    // nur Variablen-IDs; circuitId ist aber eine INSTANZ. Deshalb dieser Uebergabepunkt:
    // die Uebersicht legt den Kreis ab, das irrigcircuit im Popup liest ihn, solange es
    // selbst keinen festen Kreis eingestellt hat.
    var _irPopCid=0;

    // ---- Aufteilung nach gemessener Flaeche ---------------------------------
    // Eine feste Spaltenzahl ist nur solange richtig, wie die Kachel breit genug ist.
    // Deshalb wird nach dem Zeichnen GEMESSEN: wie viele Karten passen nebeneinander,
    // ohne unter eine brauchbare Mindestbreite zu fallen - und wie hoch wird eine Karte
    // dann. Aus der Kartenhoehe folgt, wie viel Inhalt sie noch traegt.
    var IRK_MIN=190;     // Mindestbreite einer Karte in Pixeln
    function irAufteilen(w){
      var el=irEl(w); if(!el) return;
      var wrap=el.querySelector('.irxwrap.karte'); if(!wrap) return;
      var grid=wrap.querySelector('.irx-grid'); if(!grid) return;
      var n=grid.children.length; if(!n) return;
      var breite=grid.clientWidth, hoehe=grid.clientHeight;
      if(breite<40||hoehe<40) return;
      var lueck=parseFloat(getComputedStyle(grid).columnGap)||10;
      // Obergrenze: Eigenschaft, sonst so viele wie Kreise.
      var deckel=parseInt(w.irxCols)||0;
      var max=(deckel>0)?Math.min(deckel,n):n;
      var passt=Math.floor((breite+lueck)/(IRK_MIN+lueck));
      var spalten=Math.max(1,Math.min(max,passt||1));
      var zeilen=Math.ceil(n/spalten);
      grid.style.gridTemplateColumns='repeat('+spalten+',minmax(0,1fr))';
      var kh=(hoehe-(zeilen-1)*lueck)/zeilen;
      var kb=(breite-(spalten-1)*lueck)/spalten;
      // Stufen: was bei dieser Kartengroesse noch Platz hat.
      wrap.classList.toggle('irx-knapp', kh<190);
      wrap.classList.toggle('irx-enger', kh<145);
      wrap.classList.toggle('irx-zeile', kh<135);
      wrap.classList.toggle('irx-schmal', kb<230);
      // GEGENPROBE statt geratener Schwellen: passt eine Karte danach immer noch nicht,
      // wird eine Stufe weiter verdichtet. Schwellenwerte treffen Randfaelle nie genau -
      // die Frage "laeuft es ueber?" laesst sich dagegen direkt beantworten.
      var zuEng=function(){
        var k=grid.children, i;
        for(i=0;i<k.length;i++){ if(k[i].scrollHeight>k[i].clientHeight+1) return true; }
        return false;
      };
      if(zuEng()&&!wrap.classList.contains('irx-knapp')) wrap.classList.add('irx-knapp');
      if(zuEng()&&!wrap.classList.contains('irx-enger')) wrap.classList.add('irx-enger');
      if(zuEng()&&!wrap.classList.contains('irx-zeile')) wrap.classList.add('irx-zeile');
      // Und erst wenn auch die Zeilenform nicht reicht, darf das Raster scrollen.
      grid.style.overflowY=zuEng()?'auto':'hidden';
    }
    var _irBeob={};
    function irBeobachten(w){
      if(typeof ResizeObserver!=='function')return;
      var el=irEl(w); if(!el) return;
      if(_irBeob[w.id]){try{_irBeob[w.id].disconnect();}catch(e){}}
      var ro=new ResizeObserver(function(){irAufteilen(w);});
      try{ro.observe(el);_irBeob[w.id]=ro;}catch(e){}
    }

    function irCircuitsFor(w){
      var all=_irData||[];
      if(w._kind==='circuit'){
        // Reihenfolge: fest eingestellter Kreis > der aus der Uebersicht angetippte > der erste.
        var cid=parseInt(w.circuitId||0)||0;
        if(!cid&&_irPopCid)cid=_irPopCid;
        return cid?all.filter(function(c){return c.iid===cid;}):(all.length?[all[0]]:[]);
      }
      // Standort-Filter: eine Ansicht je Haus. Ohne ihn stuenden beide Gaerten
      // untereinander, und die Gruppentitel hiessen beide "Garten".
      var aus=all.filter(function(c){return irImStandort(c,w.irxRoot);});
      if(w.irxStil==='karte'){
        // Nach der ERSTEN Startzeit des Plans ordnen. Die Reihenfolge aus der Topologie
        // ist die der Objekt-IDs und damit fuer den Betrachter zufaellig.
        aus=aus.slice().sort(function(a,b){
          var fa=a.week?irFenster(a.week[0]):[], fb=b.week?irFenster(b.week[0]):[];
          var va=fa.length?fa[0].von:99999, vb=fb.length?fb[0].von:99999;
          if(va!==vb)return va-vb;
          return irName(a.name).localeCompare(irName(b.name));
        });
      }
      return aus;
    }

    // =================== Feineinstellung je Kreis (irxStil='einstellungen') ===================
    //
    //  EIN Kreis, seine Automatikregeln. Die Werte liegen NICHT als Variablen vor,
    //  sondern im Modul-Store - gelesen mit getConfig, geschrieben mit
    //  configureAutomation ueber denselben Weg wie alles andere hier (?api=mod).
    //  Bewusst mit Zwischenstand: wer an Schwellen dreht, will das Ergebnis erst
    //  sehen (Vorschauzeile) und dann festschreiben, nicht bei jedem Tastendruck
    //  eine Regel scharf stellen. Dauer, Saisonfaktor und Automatik sind Variablen
    //  und werden beim Speichern mitgeschrieben.
    var _irCfg={}, _irEntw={}, _irNamen={}, _irPick=null, _irSuche=[];

    function irCfgLaden(iid,cb){
      irManagePromise(iid,{op:'getConfig'}).then(function(j){
        _irCfg[iid]=(j&&j.config)?j.config:(j||{}); if(cb)cb();
      }).catch(function(){ _irCfg[iid]={}; if(cb)cb(); });
    }
    // Objektnamen fuer gebundene IDs nachschlagen (?api=tree&search=<id> loest JEDE
    // Objekt-ID auf, auch Kategorien). Ohne das stuende im Feld nur eine nackte Zahl.
    function irNameLaden(id,cb){
      id=parseInt(id)||0; if(!id){if(cb)cb();return;}
      if(_irNamen[id]!==undefined){if(cb)cb();return;}
      _irNamen[id]=null;
      fetch('?api=tree&search='+id,{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
        var n=(j.nodes||[]).filter(function(x){return +x.id===id;})[0];
        _irNamen[id]=n?{name:n.name||('#'+id),pfad:n.path||''}:{name:'#'+id+' (fehlt)',pfad:''};
        if(cb)cb();
      }).catch(function(){ _irNamen[id]={name:'#'+id,pfad:''}; if(cb)cb(); });
    }
    function irNameVon(id){ id=parseInt(id)||0; if(!id)return null; var n=_irNamen[id]; return (n&&n.name)?n:null; }

    function irZahl(v,d){ var n=parseFloat(String(v).replace(',','.')); return isFinite(n)?n:d; }
    function irAn(v){ return v===true||v===1||v==='1'; }

    /** Arbeitskopie aus Modul-Config + Zustandsvariablen. */
    function irEntwurfVon(c){
      var g=_irCfg[c.iid]||{}, t=g.temp||{}, r=g.rain||{}, f=g.rainFc||{}, e=g.evap||{}, s=c.st||{};
      return {
        base:  Math.round(irZahl(s.Duration, c.runMin||15)),
        adj:   Math.round(irZahl(s.SeasonalAdjust,100)),
        sensorId: parseInt(g.sensorId)||0,
        rainOn:  r.enabled!==false, rainMm: irZahl(r.thresholdMm,2),
        fcOn:   !!f.enabled, fcSrc: parseInt(f.srcId)||0,
        fcHor:  (f.horizonDays==null?1:parseInt(f.horizonDays)||0),
        fcMm:   irZahl(f.thresholdMm,3), fcProb: irZahl(f.minProbPct,60),
        tOn:    t.enabled!==false, tVar: parseInt(t.tempVarId)||0,
        tBlock: irZahl(t.blockBelowC,10), tCold: irZahl(t.coldBelowC,20), tColdP: irZahl(t.coldPct,80),
        tHot:   irZahl(t.hotAboveC,28),  tHotP: irZahl(t.hotPct,120),
        eOn:   !!e.enabled, eVar: parseInt(e.et0VarId)||0, eRef: irZahl(e.et0RefMmPerDay,4),
        auto:  irAn(s.Automatic), armed: c.armed===true
      };
    }
    function irEntw(c){ if(!_irEntw[c.iid])_irEntw[c.iid]=irEntwurfVon(c); return _irEntw[c.iid]; }
    function irSchmutzig(c){
      var a=_irEntw[c.iid]; if(!a)return false;
      var b=irEntwurfVon(c);
      return Object.keys(b).some(function(k){return String(a[k])!==String(b[k]);});
    }

    function irSpeichern(w,c,fertig){
      var d=irEntw(c), alt=irEntwurfVon(c);
      var args={
        sensorId:d.sensorId,
        rain:{enabled:d.rainOn, thresholdMm:d.rainMm},
        rainFc:{enabled:d.fcOn, srcId:d.fcSrc, horizonDays:d.fcHor, thresholdMm:d.fcMm, minProbPct:d.fcProb},
        temp:{enabled:d.tOn, tempVarId:d.tVar, blockBelowC:d.tBlock, coldBelowC:d.tCold, coldPct:d.tColdP,
              hotAboveC:d.tHot, hotPct:d.tHotP},
        evap:{enabled:d.eOn, et0VarId:d.eVar, et0RefMmPerDay:d.eRef}
      };
      // Variablen nur anfassen, wenn sie sich wirklich geaendert haben - jedes
      // RequestAction ist ein echter Schreibvorgang mit Protokolleintrag.
      if(d.base!==alt.base) irSetVar(c,'Duration',d.base);
      if(d.adj!==alt.adj)   irSetVar(c,'SeasonalAdjust',d.adj);
      if(d.auto!==alt.auto) irSetVar(c,'Automatic',d.auto?1:0);
      var kette=irManagePromise(c.iid,{op:'configureAutomation',args:args});
      if(d.armed!==alt.armed) kette=kette.then(function(){return irManagePromise(c.iid,{op:'setArmed',args:{armed:d.armed}});});
      kette.then(function(){
        c.armed=d.armed;
        delete _irEntw[c.iid];
        irCfgLaden(c.iid,function(){ irRefresh(function(){ if(fertig)fertig(); irPaint(w); }); });
        if(typeof toast==='function')toast('Gespeichert');
      }).catch(function(){ if(typeof toast==='function')toast('Speichern fehlgeschlagen'); });
    }

    // ---- Bausteine ----
    function irsSchalter(pfad,an){ return '<button type="button" class="irs-sw'+(an?' on':'')+'" data-irset="'+pfad+'" data-irtyp="bool"><i></i></button>'; }
    function irsZahl(pfad,wert,einheit,schritt){
      return '<span class="irs-num"><input inputmode="decimal" data-irset="'+pfad+'" data-irtyp="num"'
        +(schritt?' data-irstep="'+schritt+'"':'')+' value="'+esc(String(wert).replace('.',','))+'">'
        +(einheit?'<span class="irs-u">'+esc(einheit)+'</span>':'')+'</span>';
    }
    function irsQuelle(pfad,id,platzhalter){
      var n=irNameVon(id);
      return '<button type="button" class="irs-src'+(id?'':' leer')+'" data-irpick="'+pfad+'" data-irid="'+(id||0)+'">'
        +'<span class="irs-src-t">'+esc(n?n.name:(id?('#'+id):(platzhalter||'nicht gebunden')))+'</span>'
        +'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg></button>';
    }
    function irsSeg(pfad,wert,opt){
      return '<span class="irs-seg">'+opt.map(function(o){
        return '<button type="button" data-irset="'+pfad+'" data-irtyp="num" data-irval="'+o.v+'"'
          +(String(o.v)===String(wert)?' class="on"':'')+'>'+esc(o.t)+'</button>';}).join('')+'</span>';
    }
    function irsZeile(label,unter,rechts){
      return '<div class="irs-r"><div class="irs-l">'+escL(label)
        +(unter?'<em>'+escL(unter)+'</em>':'')+'</div>'+rechts+'</div>';
    }
    function irsKarte(titel,ikone,kopfrechts,inhalt,fuss){
      return '<div class="irs-c"><h3><span class="irs-ic">'+ikone+'</span>'+escL(titel)
        +'<span class="irs-sp"></span>'+(kopfrechts||'')+'</h3>'+inhalt
        +(fuss?'<div class="irs-hint">'+fuss+'</div>':'')+'</div>';
    }
    var IRS_IC={
      dauer:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 1h6"/></svg>',
      temp: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z"/></svg>',
      regen:'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.5 17a4.5 4.5 0 0 0-1-8.9A6 6 0 0 0 5 9.5 3.75 3.75 0 0 0 5.5 17"/><path d="M8 19.5v2M12 19v3M16 19.5v2"/></svg>',
      vor:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.5 15.5a4.5 4.5 0 0 0-1-8.9A6 6 0 0 0 5 8 3.75 3.75 0 0 0 5.5 15.5"/><path d="M9 18.5l-1 2.5M13 18.5l-1 2.5M17 18.5l-1 2.5"/><path d="M20.5 3.5 22 2M21 7h2"/></svg>',
      verd: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.7S5.5 9.6 5.5 14a6.5 6.5 0 0 0 13 0c0-4.4-6.5-11.3-6.5-11.3z"/></svg>',
      betr: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M7 7l-4 7h8zM17 7l-4 7h8zM6 21h12"/></svg>'
    };

    function irsVorschau(c){
      var p=c.probe||{}, ch=[];
      function chip(l,v){ ch.push('<span class="irs-chip">'+escL(l)+' <b>'+escL(v)+'</b></span>'); }
      if(p.tempNow!=null)  chip('Temperatur', String(Math.round(p.tempNow*10)/10).replace('.',',')+' °C');
      if(p.rainNow!=null)  chip('Regen heute', String(Math.round(p.rainNow*10)/10).replace('.',',')+' mm');
      if(p.rainFc&&p.rainFc.mm!=null){
        var tg=p.rainFc.tagIdx===0?'heute':(p.rainFc.tagIdx===1?'morgen':('in '+p.rainFc.tagIdx+' Tagen'));
        chip('Vorhersage '+tg, String(Math.round(p.rainFc.mm*10)/10).replace('.',',')+' mm'
          +(p.rainFc.prob!=null?' / '+Math.round(p.rainFc.prob)+' %':''));
      }
      if(p.effectiveMin!=null) chip('Dauer', Math.round(irZahl(p.baseMin,0))+' → '+String(p.effectiveMin).replace('.',',')+' min');
      var gesperrt=!!(p.gate&&p.gate.blocked);
      var urteil=gesperrt
        ? '<div class="irs-verd block"><span class="irs-bul"></span>'+escL('Gesperrt — '+(p.gate.reason||''))+'</div>'
        : '<div class="irs-verd frei"><span class="irs-bul"></span>Bereit</div>';
      return '<div class="irs-prev"><span class="irs-pt">Jetzt</span><div class="irs-chips">'+ch.join('')+'</div>'+urteil+'</div>';
    }

    function irsPicker(){
      if(!_irPick) return '';
      var zeilen=_irSuche.length
        ? _irSuche.map(function(n){return '<button type="button" class="irs-pk-r" data-irpickid="'+n.id+'">'
            +'<b>'+escL(n.name||('#'+n.id))+'</b><span>'+escL(n.path||'')+'</span></button>';}).join('')
        : '<div class="irs-pk-leer">Suchbegriff eingeben (Name oder Pfad), oder eine Objekt-ID.</div>';
      return '<div class="irs-pk-h" data-irpickzu="1"><div class="irs-pk" data-irpickbox="1">'
        +'<div class="irs-pk-k">Quelle wählen<button type="button" class="irs-pk-x" data-irpickzu="1">'
        +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>'
        +'<input class="irs-pk-s" data-irpicksuche="1" placeholder="suchen …" autocomplete="off">'
        +'<div class="irs-pk-l">'+zeilen+'</div>'
        +'<button type="button" class="irs-pk-clr" data-irpickid="0">Bindung entfernen</button></div></div>';
    }

    function irEinstRender(c,w){
      if(!_irCfg[c.iid]) return '<div class="irxwrap"><div class="irx-msg">Einstellungen laden …</div></div>';
      var d=irEntw(c), dirty=irSchmutzig(c);
      var h='<div class="irs"><div class="irs-h"><span class="irs-dot"></span><div class="irs-ht">'
        +'<h2>'+escL(irName(c.name))+' — Feineinstellung</h2>'
        +'<div class="irs-sub">'+escL([c.house||'',c.room||''].filter(Boolean).join(' · '))+'</div></div></div>';
      h+='<div class="irs-b">';

      h+=irsKarte('Dauer',IRS_IC.dauer,'',
        irsZeile('Grunddauer','Wert je Schaltfenster im Zeitplan',irsZahl('base',d.base,'min',1))
       +irsZeile('Saisonfaktor','skaliert jeden Lauf, 100 % = unverändert',irsZahl('adj',d.adj,'%',5)),
        '<b>Rechenweg:</b> Grunddauer × Saisonfaktor × Temperaturfaktor × Verdunstungsfaktor.');

      h+=irsKarte('Temperatur',IRS_IC.temp,irsSchalter('tOn',d.tOn),
        irsZeile('Messwert','',irsQuelle('tVar',d.tVar,'nicht gebunden'))
       +irsZeile('Keine Bewässerung unter','',irsZahl('tBlock',d.tBlock,'°C',1))
       +irsZeile('Kühler als','',irsZahl('tCold',d.tCold,'°C',1)+'<span class="irs-pf">→</span>'+irsZahl('tColdP',d.tColdP,'%',5))
       +irsZeile('Wärmer als','',irsZahl('tHot',d.tHot,'°C',1)+'<span class="irs-pf">→</span>'+irsZahl('tHotP',d.tHotP,'%',5)));

      h+=irsKarte('Regen — gemessen',IRS_IC.regen,irsSchalter('rainOn',d.rainOn),
        irsZeile('Messwert','',irsQuelle('sensorId',d.sensorId,'nicht gebunden'))
       +irsZeile('Sperren ab','Niederschlag seit Mitternacht',irsZahl('rainMm',d.rainMm,'mm',0.5)),
        '<b>Je Standort eigen.</b> Ein gemeinsamer Regenmesser für beide Gärten wäre falsch.');

      h+=irsKarte('Regen — Vorhersage',IRS_IC.vor,irsSchalter('fcOn',d.fcOn),
        irsZeile('Quelle','Ordner mit TagN_Regen oder Vorhersage-JSON',irsQuelle('fcSrc',d.fcSrc,'nicht gebunden'))
       +irsZeile('Vorausschau','',irsSeg('fcHor',d.fcHor,[{v:0,t:'heute'},{v:1,t:'+1 Tag'},{v:2,t:'+2 Tage'}]))
       +irsZeile('Sperren ab','',irsZahl('fcMm',d.fcMm,'mm',0.5))
       +irsZeile('nur ab Wahrscheinlichkeit','',irsZahl('fcProb',d.fcProb,'%',5)),
        'Beide Schranken müssen fallen. Meldet die Quelle keine Wahrscheinlichkeit, zählt nur die Menge.');

      h+=irsKarte('Verdunstung (ET₀)',IRS_IC.verd,irsSchalter('eOn',d.eOn),
        irsZeile('Messwert','',irsQuelle('eVar',d.eVar,'nicht gebunden'))
       +irsZeile('Referenz','bei diesem Wert Faktor 100 %',irsZahl('eRef',d.eRef,'mm/d',0.5)),
        'Ausgeschaltet bleibt der Faktor bei 100 %.');

      var warn=d.armed?'':'<div class="irs-warn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3.5 1.8 20.5h20.4zM12 9.5v5M12 17.8v.2"/></svg>'
        +'<span>Schattenbetrieb: dieser Kreis würde schalten, tut es aber nicht.</span></div>';
      h+=irsKarte('Betrieb',IRS_IC.betr,'',
        irsZeile('Automatik','Zeitplan darf schalten',irsSchalter('auto',d.auto))
       +irsZeile('Scharf','aus = Schattenbetrieb, nur Protokoll',irsSchalter('armed',d.armed))+warn);

      h+='</div>';
      // Vorschau bewusst AUSSERHALB des Scrollbereichs: das Urteil ("gesperrt/bereit")
      // ist die Antwort auf jede Aenderung darueber. Innerhalb rutschte es unter die
      // Kante, sobald die Karten hoeher wurden - und dann sieht es keiner mehr.
      h+=irsVorschau(c);
      h+='<div class="irs-f"><span class="irs-note">Gilt nur für diesen Kreis. Zeitplan bearbeitest du im Wochenplan.</span>'
        +'<button type="button" class="irs-btn" data-irabbr="1"'+(dirty?'':' disabled')+'>Abbrechen</button>'
        +'<button type="button" class="irs-btn pri" data-irsave="1"'+(dirty?'':' disabled')+'>Speichern</button></div>';
      h+=irsPicker();
      return h+'</div>';
    }

    /** Ereignisse der Einstellungsansicht. Aendert NUR die Arbeitskopie. */
    function irsWire(w,c,host){
      function neu(){ irPaint(w); }
      host.querySelectorAll('[data-irtyp="bool"]').forEach(function(b){
        b.addEventListener('click',function(){ var d=irEntw(c), k=b.getAttribute('data-irset'); d[k]=!d[k]; neu(); });
      });
      host.querySelectorAll('button[data-irval]').forEach(function(b){
        b.addEventListener('click',function(){ var d=irEntw(c); d[b.getAttribute('data-irset')]=parseFloat(b.getAttribute('data-irval')); neu(); });
      });
      host.querySelectorAll('input[data-irtyp="num"]').forEach(function(inp){
        inp.addEventListener('change',function(){
          var d=irEntw(c), k=inp.getAttribute('data-irset');
          var v=irZahl(inp.value,d[k]); d[k]=v; neu();
        });
        inp.addEventListener('keydown',function(e){
          if(e.key==='Enter'){e.preventDefault();inp.blur();return;}
          var st=parseFloat(inp.getAttribute('data-irstep'))||1;
          if(e.key==='ArrowUp'||e.key==='ArrowDown'){
            e.preventDefault();
            var d=irEntw(c), k=inp.getAttribute('data-irset');
            d[k]=Math.round((irZahl(inp.value,d[k])+(e.key==='ArrowUp'?st:-st))*1000)/1000; neu();
          }
        });
      });
      // ---- Quellen-Waehler ----
      host.querySelectorAll('[data-irpick]').forEach(function(b){
        b.addEventListener('click',function(){ _irPick={iid:c.iid,feld:b.getAttribute('data-irpick')}; _irSuche=[]; neu();
          var s=irEl(w)&&irEl(w).querySelector('[data-irpicksuche]'); if(s)s.focus(); });
      });
      host.querySelectorAll('[data-irpickzu]').forEach(function(x){
        x.addEventListener('click',function(e){
          // Nur der Klick NEBEN den Kasten schliesst - sonst faengt die Huelle jeden Treffer ab.
          if(x.hasAttribute('data-irpickbox'))return;
          if(e.target!==x&&!e.target.closest('.irs-pk-x'))return;
          _irPick=null; _irSuche=[]; neu();
        });
      });
      var su=host.querySelector('[data-irpicksuche]');
      if(su){
        var t=null;
        su.addEventListener('input',function(){
          clearTimeout(t); var q=su.value.trim();
          if(q.length<2){ _irSuche=[]; return; }
          t=setTimeout(function(){
            fetch('?api=tree&search='+encodeURIComponent(q),{cache:'no-store'})
              .then(function(r){return r.json();}).then(function(j){
                _irSuche=(j.nodes||[]).slice(0,60);
                var pos=su.selectionStart; irPaint(w);
                var s2=irEl(w)&&irEl(w).querySelector('[data-irpicksuche]');
                if(s2){ s2.value=q; s2.focus(); try{s2.setSelectionRange(pos,pos);}catch(e){} }
              }).catch(function(){});
          },260);
        });
      }
      host.querySelectorAll('[data-irpickid]').forEach(function(r){
        r.addEventListener('click',function(e){
          e.stopPropagation();
          if(!_irPick)return;
          var id=parseInt(r.getAttribute('data-irpickid'))||0;
          var d=irEntw(c); d[_irPick.feld]=id;
          _irPick=null; _irSuche=[];
          if(id) irNameLaden(id,function(){irPaint(w);}); else irPaint(w);
        });
      });
      // ---- Fuss ----
      var sv=host.querySelector('[data-irsave]');
      if(sv)sv.addEventListener('click',function(){ if(sv.disabled)return; sv.disabled=true; sv.textContent='Speichert …'; irSpeichern(w,c); });
      var ab=host.querySelector('[data-irabbr]');
      if(ab)ab.addEventListener('click',function(){ if(ab.disabled)return; delete _irEntw[c.iid]; neu(); });
    }

    function irRender(w){
      var list=irCircuitsFor(w);
      if(_irErr) return '<div class="irxwrap"><div class="irx-msg">Bewässerung nicht erreichbar</div></div>';
      if(!_irData) return '<div class="irxwrap"><div class="irx-msg">Bewässerung lädt …</div></div>';
      if(!list.length) return '<div class="irxwrap"><div class="irx-msg">Keine Bewässerungskreise</div></div>';
      // Feineinstellung: eine eigene Ansicht auf EINEN Kreis - vor allem anderen,
      // weil sie weder Raster noch Schatten-Hinweis der Uebersicht braucht.
      if(w._kind==='circuit'&&w.irxStil==='einstellungen') return irEinstRender(list[0],w);
      var shadow=list.some(function(c){return c.armed===false;});
      var stil=(w.irxStil==='karte')?'karte':'voll';
      var h='<div class="irxwrap'+(stil==='karte'?' karte':'')+'">';
      // Im Entwurfsstil traegt die SEITE den Schatten-Hinweis (Kopfzeile), nicht jede
      // Kachel - sonst steht er auf beiden Standortseiten doppelt.
      if(shadow&&stil!=='karte')h+='<div class="irx-shadow">Schatten-Modus aktiv – im Schatten laufende Kreise schalten den Aktor noch nicht real.</div>';
      if(shadow&&stil==='karte'){
        var nSch=list.filter(function(c){return c.armed===false;}).length;
        h+='<div class="irx-schatten">'
          +'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
          +'<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>'
          +'<b>Schatten-Modus</b>'
          +'<span>'+(nSch===list.length?'Die Steuerung schaltet nicht':(nSch+' von '+list.length+' Kreisen schalten nicht'))
          +' – gegossen wird von der LinkTap-App. Antippen einer Kachel zeigt den Schalter zum Scharfstellen.</span></div>';
      }
      var zeichne=(stil==='karte')?function(c){return irKarte(c,w);}:irCard;
      if(w._kind==='circuit'){ h+='<div class="irx-grid">'+list.map(zeichne).join('')+'</div></div>'; return h; }
      // Im Entwurfsstil zeigt EINE Ansicht EINEN Standort - die Bereichs-/Raumtitel
      // waeren dort nur Wiederholung der Seitenueberschrift.
      if(stil==='karte'){
        // FESTE Spaltenzahl statt auto-fit: ein umbrechendes Raster erzeugt eine zweite
        // Reihe, die nicht mehr in die Kachel passt - und dann scrollt die Seite, was auf
        // einem Wandtablett niemand will. Lieber schmalere Karten; die Schrift rechnet
        // ohnehin aus der Kartenbreite (cqi).
        // Startwert; die endgueltige Zahl rechnet irAufteilen() aus der Breite.
        var sp=Math.max(1,Math.min(parseInt(w.irxCols)||list.length,list.length));
        h+='<div class="irx-grid" style="grid-template-columns:repeat('+sp+',minmax(0,1fr))">'
          +list.map(zeichne).join('')+'</div>';
        var auf=list.filter(function(c){return _irOffen[c.iid];})[0];
        if(auf){
          h+='<div class="irx-blatt" data-irblatt="1"><div class="irx-blatt-in">'
            +'<div class="irx-blatt-k"><b></b>'
            +'<button class="irx-blatt-zu" data-irzu="'+auf.iid+'" title="Schließen">'
            +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
            +'</button></div>'+irCard(auf)+'</div></div>';
        }
        h+='</div>';
        return h;
      }
      // Gruppieren: Bereich/Geschoss -> Raum (stabil)
      var groups={}, order=[];
      list.forEach(function(c){var key=(c.group||'')+'||'+(c.room||'');if(!groups[key]){groups[key]={group:c.group,room:c.room,items:[]};order.push(key);}groups[key].items.push(c);});
      order.sort(function(a,b){var A=groups[a],B=groups[b];var fr=floorRank(A.group)-floorRank(B.group);if(fr)return fr;return (A.room||'').localeCompare(B.room||'');});
      var cur=null;
      order.forEach(function(key){var g=groups[key];
        var head=g.group||g.room||'';
        if(head!==cur){cur=head;h+='<div class="irx-floor">'+escL(head||'Bewässerung')+'</div>';}
        h+='<div class="irx-grid">'+g.items.map(zeichne).join('')+'</div>';});
      h+='</div>';
      return h;
    }

    function irEl(w){return $('.w[data-id="'+w.id+'"]',canvas)||$('.w[data-id="'+w.id+'"]',$('#ovcanvas'));}
    function irPaint(w){var el=irEl(w);if(!el)return;var host=el.querySelector('.winner')||el;host.innerHTML=irRender(w);irWire(w,host);irAufteilen(w);}
    function irById(id){return (_irData||[]).find(function(c){return c.iid===id;});}

    function irWire(w,host){
      if(w._kind==='circuit'&&w.irxStil==='einstellungen'){
        var lc=irCircuitsFor(w)[0]; if(lc)irsWire(w,lc,host);
        return;
      }
      host.querySelectorAll('[data-irarm]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irarm'));if(!c)return;irSetArmed(c,!c.armed);irPaint(w);});});
      host.querySelectorAll('[data-irrun]').forEach(function(b){b.addEventListener('click',function(e){
        var c=irById(+b.getAttribute('data-irrun'));if(!c)return;
        e.stopPropagation();   // sonst klappt zugleich die Reglerkarte auf
        // Im Entwurfsstil gilt die EFFEKTIVE Dauer - das ist die Zahl, die auf der
        // Kachel steht. Alles andere waere ein anderer Lauf als der angezeigte.
        var min=(w.irxStil==='karte'&&c.probe&&c.probe.effectiveMin!=null)
                ? Math.max(1,Math.round(num(c.probe.effectiveMin,0)))
                : Math.round(c.runMin||0);
        irRunNow(c,min);irPaint(w);});});
      host.querySelectorAll('[data-irkarte]').forEach(function(k){k.addEventListener('click',function(e){
        if(e.target.closest('button,input,select'))return;
        var id=+k.getAttribute('data-irkarte');
        if(w.irxPopup&&typeof openPopup==='function'){ _irPopCid=id; openPopup(w.irxPopup); return; }
        _irOffen[id]=!_irOffen[id];irPaint(w);});});
      host.querySelectorAll('[data-ircfg]').forEach(function(b){b.addEventListener('click',function(e){
        e.stopPropagation();                       // nicht zugleich die Kreis-Ansicht oeffnen
        if(!w.irxPopupCfg||typeof openPopup!=='function')return;
        _irPopCid=+b.getAttribute('data-ircfg');   // derselbe Uebergabepunkt wie beim Kartenklick
        openPopup(w.irxPopupCfg);
      });});
      host.querySelectorAll('[data-irzu]').forEach(function(b){b.addEventListener('click',function(e){
        e.stopPropagation();delete _irOffen[+b.getAttribute('data-irzu')];irPaint(w);});});
      host.querySelectorAll('[data-irblatt]').forEach(function(bl){bl.addEventListener('click',function(e){
        if(e.target!==bl)return;            // nur der Klick NEBEN die Karte schliesst
        _irOffen={};irPaint(w);});});
      host.querySelectorAll('[data-irstop]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irstop'));if(!c)return;irStopNow(c);irPaint(w);});});
      host.querySelectorAll('[data-irmin]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irmin'));if(!c)return;var d=+b.getAttribute('data-ird');var v=Math.round((c.runMin||0)+d);var mx=(c.dur&&c.dur.max)||120;c.runMin=Math.max(1,Math.min(mx,v));irPaint(w);});});
      host.querySelectorAll('[data-irdur]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irdur'));if(!c)return;var d=+b.getAttribute('data-ird');var cur=Math.round(num(c.st.Duration,c.runMin||20));var st=(c.dur&&c.dur.step)||1;var v=cur+d*st;v=Math.max(c.dur.min,Math.min(c.dur.max,v));irSetVar(c,'Duration',v);irPaint(w);});});
      host.querySelectorAll('[data-irauto]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-irauto'));if(!c)return;var on=!(c.st.Automatic===1||c.st.Automatic===true||c.st.Automatic==='1');irSetVar(c,'Automatic',on?1:0);irPaint(w);});});
      host.querySelectorAll('[data-iract]').forEach(function(b){b.addEventListener('click',function(){var c=irById(+b.getAttribute('data-iract'));if(!c)return;var on=!(c.st.Active===1||c.st.Active===true||c.st.Active==='1');irSetVar(c,'Active',on?1:0);if(on)c.st.Running=1;else c.st.Running=0;irPaint(w);});});
      host.querySelectorAll('[data-iradj]').forEach(function(r){
        r.addEventListener('input',function(){var lab=host.querySelector('[data-iradjv="'+r.getAttribute('data-iradj')+'"]');if(lab)lab.textContent=(parseInt(r.value)||0)+' %';});
        r.addEventListener('change',function(){var c=irById(+r.getAttribute('data-iradj'));if(!c)return;irSetVar(c,'SeasonalAdjust',parseInt(r.value)||0);});
      });
      host.querySelectorAll('[data-irprog]').forEach(function(sel){sel.addEventListener('change',function(){var c=irById(+sel.getAttribute('data-irprog'));if(!c)return;irSetVar(c,'Program',parseInt(sel.value)||0);});});
    }

    function irDef(kind,label,defSize){
      defWidget(kind,{
        // Kategorie ist fuer beide Familienmitglieder identisch -> fest gesetzt statt Parameter.
        label:label, cat:'HomeSuite · Bewässerung', paletteIcon:'droplet', size:defSize,
        defaults:function(w){w._kind=(kind==='irrigcircuit')?'circuit':'grid';},
        render:function(w){w._kind=(kind==='irrigcircuit')?'circuit':'grid';return irRender(w);},
        mount:function(w){w._kind=(kind==='irrigcircuit')?'circuit':'grid';var el=irEl(w);if(!el)return;
          irBeobachten(w);
          if(w._kind==='circuit'&&w.irxStil==='einstellungen'){
            // Erst Kreise, dann dessen Modul-Config, dann die Namen der gebundenen
            // Objekte - jede Stufe zeichnet neu, damit nichts auf die langsamste wartet.
            var nachCfg=function(){
              var c=irCircuitsFor(w)[0]; if(!c)return;
              irCfgLaden(c.iid,function(){
                irPaint(w);
                var d=irEntw(c), off=0;
                [d.tVar,d.sensorId,d.fcSrc,d.eVar].forEach(function(id){
                  if(!id)return; off++; irNameLaden(id,function(){ if(--off<=0)irPaint(w); });
                });
              });
            };
            if(_irData)nachCfg(); else irLoad(nachCfg);
          }
          if(_irData){irWacheLaden(w.irxWache,function(){irPaint(w);});}
          else{irLoad(function(){irWacheLaden(w.irxWache,function(){irPaint(w);});});}
          LVB.panel.startPoll('irrigx:'+w.id,30000,function(){
            if(_irData)irRefresh(function(){irWacheLaden(w.irxWache,function(){irPaint(w);});});
            else irLoad(function(){irPaint(w);}); });},
        _bind:function(w){irPaint(w);},
        props:function(w){
          var h='';
          if(kind==='irrigcircuit'){
            h+='<div class="pgh">Kreis</div>';
            h+=row('Kreis (Instanz-ID)','<input id="irCid" type="number" value="'+(w.circuitId||'')+'" placeholder="HSIR-Instanz-ID">');
            h+='<div style="font-size:11px;color:var(--muted);padding:4px 2px">Leer = erster gefundener Bewässerungskreis.</div>';
          } else {
            h+='<div style="font-size:11px;color:var(--muted);padding:4px 2px">Zeigt alle HomeSuite-Bewässerungskreise (IrrigationCircuit), gruppiert nach Bereich und Raum.</div>';
          }
          h+='<div class="pgh">Darstellung</div>';
          h+=row('Stil','<select id="irStil"><option value="voll"'+((w.irxStil||'voll')==='voll'?' selected':'')+'>Regler (alle Bedienelemente)</option>'
            +'<option value="karte"'+(w.irxStil==='karte'?' selected':'')+'>Karte (Entwurf: Dauer, Sperre, Batterie)</option>'
            +((kind==='irrigcircuit')?'<option value="einstellungen"'+(w.irxStil==='einstellungen'?' selected':'')+'>Feineinstellung (Regeln bearbeiten)</option>':'')
            +'</select>');
          h+=row('Spalten (höchstens)','<input id="irCols" type="number" min="0" max="12" value="'+(w.irxCols||'')+'" placeholder="0 = so viele wie passen">');
          h+='<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Wie viele Karten nebeneinander stehen dürfen. Wie viele es WIRKLICH werden, rechnet das Widget aus der Breite – es fällt nie unter '+IRK_MIN+' px je Karte.</div>';
          h+=row('Standort','<input id="irRoot" type="number" value="'+(w.irxRoot||'')+'" placeholder="Haus/Bereich-Instanz-ID">');
          h+='<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Leer = alle. Mit einer Haus-ID zeigt die Ansicht nur diesen Standort.</div>';
          if(kind==='irriggrid'){
            h+=row('Kreis öffnet Popup','<select id="irPopup"><option value="">— eingebautes Blatt —</option>'
              +Object.keys(store.views).filter(function(n){return !!(store.views[n].page&&store.views[n].page.popup);})
                .map(function(n){return '<option value="'+esc(n)+'"'+(w.irxPopup===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')
              +'</select>');
            h+=row('Zahnrad öffnet','<select id="irPopCfg"><option value="">— kein Zahnrad —</option>'
              +Object.keys(store.views).filter(function(n){return !!(store.views[n].page&&store.views[n].page.popup);})
                .map(function(n){return '<option value="'+esc(n)+'"'+(w.irxPopupCfg===n?' selected':'')+'>'+esc(n)+'</option>';}).join('')
              +'</select>');
            h+='<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Eine Popup-Ansicht mit einem Widget „Bewässerung · Kreis" im Stil <b>Feineinstellung</b>. Ohne Auswahl trägt die Kachel kein Zahnrad.</div>';
            h+='<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Ohne Auswahl öffnet sich das eingebaute Blatt INNERHALB der Kachel - es kann nie größer als die Kachel werden und muss deshalb gescrollt werden. Eine Popup-Ansicht (mit einem Widget „Bewässerung · Kreis" darin) legt sich über die ganze Seite. Der angetippte Kreis wird an das Popup übergeben, solange dort kein fester Kreis eingestellt ist.</div>';
          }
          h+=row('Wache (JSON)','<input id="irWache" type="number" value="'+(w.irxWache||'')+'" placeholder="VentileJson der Bewässerungs-Wache">');
          h+='<div style="font-size:11px;color:var(--muted);padding:2px 2px 6px">Liefert Batterie und Funkzustand je Kreis. Ohne sie bleibt die Batteriezeile leer.</div>';
          return h;
        },
        wire:function(w){
          if($('#irCid'))$('#irCid').onchange=function(){w.circuitId=parseInt(this.value)||undefined;commit();irPaint(w);};
          if($('#irStil'))$('#irStil').onchange=function(){w.irxStil=(this.value==='voll')?undefined:this.value;commit();irPaint(w);};
          if($('#irCols'))$('#irCols').onchange=function(){w.irxCols=parseInt(this.value)||undefined;commit();irPaint(w);};
          if($('#irRoot'))$('#irRoot').onchange=function(){w.irxRoot=parseInt(this.value)||undefined;commit();irPaint(w);};
          if($('#irWache'))$('#irWache').onchange=function(){w.irxWache=parseInt(this.value)||undefined;commit();irPaint(w);};
          if($('#irPopup'))$('#irPopup').onchange=function(){w.irxPopup=this.value||undefined;commit();irPaint(w);};
          if($('#irPopCfg'))$('#irPopCfg').onchange=function(){w.irxPopupCfg=this.value||undefined;commit();irPaint(w);};
        }
      });
    }
    irDef('irriggrid','Bewässerung · Übersicht',[720,460]);
    irDef('irrigcircuit','Bewässerung · Kreis',[300,360]);
  })();
