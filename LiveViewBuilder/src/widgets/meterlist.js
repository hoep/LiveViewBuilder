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
//   Rangliste (mlRang)        Die Zeilen ordnen sich selbst, groesster Anteil oben. Fuer
//                             Kennzahlen, die miteinander konkurrieren - sechs Verbraucher
//                             als EINE Liste statt sechs Kacheln, in der man das Wichtigste
//                             suchen muss. Bei festen Messgroessen bleibt die Reihenfolge.
//   Anteil (pctVid)           Eigene Variable fuer den Anteil. Ohne sie rechnet der Balken
//                             wie bisher aus dem Wert; mit ihr trennt sich beides: die Zahl
//                             misst (W), der Balken vergleicht (%), und der Anteil steht
//                             als eigene Spalte daneben.
//   Tageswert (dayVid)        Zweite Zahlenspalte. Eine Momentanleistung allein sagt nicht,
//                             ob ein Verbraucher heute viel gebraucht hat.
//   Vergleich (cmpVid)        Pfeil gegen gestern. Zwei Lesarten, siehe mlCmpMode.
//
// Die ZAHL bleibt immer der echte Messwert in seiner Einheit - der Balken vergleicht, die
// Zahl misst. Ohne min/max verhaelt sich das Widget wie bisher (Wert 0..100 = Prozent).
//
// ERWEITERT am 02.09.2026 um drei Darstellungen, die aus der Liste erst eine Aussage machen.
// Anlass: die Energie-Kennzahlen. Dort steht in jeder Zeile ein laufender Jahreszaehler, der
// Balken "Anteil am Vorjahr" lag deshalb bei sieben von acht Zeilen zwischen 95 und 100 % -
// alle Balken sahen gleich aus und sagten nichts.
//
//   A  Mittenbalken (mlBar='dev')   Der Balken zeigt nicht mehr den Wert, sondern die
//                                   ABWEICHUNG: Null in der Mitte, Ausschlag nach rechts =
//                                   mehr als in der Vorperiode, nach links = weniger. Damit
//                                   unterscheiden sich die Zeilen endlich voneinander, und
//                                   die Information, auf die es ankommt, steht nicht mehr
//                                   nur als kleine Prozentzahl am rechten Rand.
//   B  Gruppen + Wertung            Zwei getrennte Schalter. mlGroups zieht aus der Spalte
//      (mlGroups, mlWert)           "Gruppe" Zwischenueberschriften ein (Bezug, Erzeugung,
//                                   Wasser, Waerme), mlWert faerbt einen Streifen links:
//                                   ob eine Abweichung GUT ist, haengt an der Zeile - bei
//                                   Erzeugung ist mehr gut, beim Verbrauch schlecht. Ohne
//                                   Wertung musste das Auge jede Zeile einzeln denken.
//   C  Sparkline (mlBar='spark')    Statt des Balkens der Verlauf ueber den Vergleichszeitraum.
//                                   Beantwortet "wohin geht es", was ein einzelner
//                                   Vergleichswert prinzipiell nicht kann. Kostet je Zeile
//                                   eine Archivabfrage, deshalb mit eigenem Zwischenspeicher.
//
// Die drei sind frei kombinierbar; A und B zusammen sind die Fassung, fuer die die
// Energieseite gebaut ist.
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
  /** Balkenlaenge setzen - im Saeulen-Modus ueber die Hoehe, sonst ueber die Breite. */
  function _mlSetzeBalken(w,el,pct){
    if(!el||pct==null)return;
    if(w.mlVert){el.style.width='';el.style.height=pct+'%';}
    else{el.style.height='';el.style.width=pct+'%';}
  }

  function _mlFarbe(w, r, pct) {
    if (w.mlGrad && w.mlGrad.length && pct != null) {
      var g = gradColor(w.mlGrad, pct);
      if (g) return g;
    }
    return r.color ? _cssColorOrEmpty(r.color) : '';
  }

  /**
   * Balkenmodus. Frueher gab es nur die Ja/Nein-Eigenschaft mlBarCmp; die bleibt lesbar,
   * damit bestehende Kacheln unveraendert weiterlaufen.
   *   ''      Wert auf der Skala der Zeile (wie eh und je)
   *   'cmp'   Anteil am Vergleichswert, 100 % = wie in der Vorperiode
   *   'dev'   Abweichung als Mittenbalken
   *   'spark' Verlauf ueber den Vergleichszeitraum, als Linie
   *   'sparkbar' derselbe Verlauf als kleine Balken
   *   'off'   gar kein Balken - der Platz bleibt als Luft zwischen Bezeichner und Wert
   *           stehen. Fuer Listen, in denen der Balken nichts beitraegt: bei laufenden
   *           Zaehlern steht er ohnehin am Anschlag und behauptet eine Aussage, die er
   *           nicht hat.
   */
  function _mlBarModus(w) {
    if (w.mlBar) { return w.mlBar; }
    return w.mlBarCmp ? 'cmp' : '';
  }
  /** Beide Verlaufsformen teilen sich Datenbeschaffung, Zelle und Live-Pfad. */
  function _mlIstVerlauf(m) { return m === 'spark' || m === 'sparkbar'; }
  /**
   * Wertung einer Abweichung: gut, schlecht oder gar nicht gewertet.
   *
   * Die Richtung allein sagt es nicht - 12 Prozent mehr Netzbezug ist schlecht, 12 Prozent
   * mehr PV-Ertrag ist gut. Bisher war "mehr = schlecht" fest verdrahtet (roter Aufwaerts-
   * pfeil), was fuer Verbraucher stimmt und fuer Erzeuger falsch ist.
   *   r.gut leer      weniger ist besser (Verbrauch)  - die alte, fest verdrahtete Annahme
   *   r.gut gesetzt   mehr ist besser (Erzeugung): Haekchen "mehr = gut" in der Zeile
   *   r.gut 'neutral' nicht werten (Zaehlerstaende, Zahlen ohne Richtung)
   *
   * Das Feld war zuerst ein Auswahlfeld mit drei Werten. In einer Zeile mit fuenfzehn
   * Spalten war "weniger = gut" als Vorgabetext aber weder zu finden noch zu lesen -
   * und gemeint ist ohnehin ein Schalter: die Ausnahme ist die Erzeugung, nicht die
   * Regel. Jetzt ein Haekchen. 'neutral' bleibt lesbar, damit bestehende Zeilen und
   * von Hand gesetzte Werte weiter gelten.
   * Rueckgabe 1 = gut, -1 = schlecht, 0 = keine Wertung.
   */
  function _mlWertung(r, d) {
    if (d == null || !isFinite(d)) { return 0; }
    var g = (r && r.gut) || '';
    if (g === 'neutral') { return 0; }
    if (Math.abs(d) < 0.5) { return 0; }          // dieselbe Totzone wie beim Pfeil
    var auf = d > 0;
    // true (Haekchen) und 'up' (die alte Auswahl) meinen dasselbe.
    var mehrIstGut = (g === true || g === 'up' || g === '1' || g === 1);
    return mehrIstGut ? (auf ? 1 : -1) : (auf ? -1 : 1);
  }
  /** Skin-Farbe zur Wertung. Bewusst ueber cssv, damit sie dem Haus-Skin folgt. */
  function _mlWertFarbe(k) {
    return k > 0 ? cssv('--ok') : (k < 0 ? cssv('--crit') : cssv('--muted'));
  }
  /**
   * Inline-Stil des Mittenbalkens. Null sitzt bei 50 %, der Vollausschlag bei mlDevMax
   * Prozent Abweichung - ohne Deckel wuerde eine einzelne Ausreisserzeile (PV im Winter)
   * alle anderen Balken auf Haaresbreite druecken.
   */
  function _mlDevStil(w, r, d) {
    if (d == null || !isFinite(d)) { return 'left:50%;width:0'; }
    var m = parseFloat(String(w.mlDevMax || '').replace(',', '.'));
    if (!isFinite(m) || m <= 0) { m = 25; }
    var q = Math.max(-1, Math.min(1, d / m)) * 50;
    var k = _mlWertung(r, d);
    var c = (w.mlWert || (r && r.gut)) ? _mlWertFarbe(k) : (_mlFarbe(w, r, null) || cssv('--accent'));
    if (!c) { c = cssv('--accent'); }
    return (q >= 0 ? ('left:50%;width:' + q.toFixed(2) + '%')
                   : ('left:' + (50 + q).toFixed(2) + '%;width:' + (-q).toFixed(2) + '%'))
         + ';background:' + c;
  }
  /**
   * Kachelknoten finden - auch im Popup und im Flyout. Dieselbe Falle wie beim
   * Fluss-Widget: wer nur in canvas sucht, findet eine Kachel im Popup nie und die
   * Nachtraege liefen ins Leere.
   */
  function _mlEl(w) {
    var sel = '.w[data-id="' + w.id + '"]', e;
    var ov = document.getElementById('ovcanvas');
    if (ov) { e = $(sel, ov); if (e) { return e; } }
    var hv = document.getElementById('hovcanvas');
    if (hv) { e = $(sel, hv); if (e) { return e; } }
    return $(sel, canvas);
  }


  /**
   * Vergleichszeitraum aus dem Archiv.
   *
   * Bis hierher konnte die Zeile nur eine fertige Vergleichsvariable lesen. Damit
   * war der Zeitraum das, was irgendein Skript gerade hineingeschrieben hatte -
   * meist "gegen gestern", ohne dass es an der Kachel stand. Jetzt laesst sich der
   * Zeitraum WAEHLEN; gerechnet wird er von der bestehenden Schnittstelle
   * ?api=cmp, die auch die KPI-Karte benutzt: sie kennt Zaehler (Verbrauch der
   * Periode) und Standardvariablen (Periodenmittel) und liefert cur/past.
   *
   * Ein Abruf je Zeile ist teuer (Archiv-Punktabfragen), deshalb ein eigener
   * Zwischenspeicher mit 90 Sekunden Standzeit - der Vergleich mit gestern
   * aendert sich nicht im Sekundentakt.
   */
  var _mlCmp = {};
  function _mlCmpHolen(w, i, r, fertig) {
    var stufe = _mlStufe(w);
    if (!stufe || stufe === 'var' || !r.vid) { fertig(null); return; }
    var _unbenutzt;
    // Zaehler brauchen kind=counter: sonst mittelt die Schnittstelle einen
    // steigenden Zaehlerstand, statt den Verbrauch der Periode zu bilden. Genau
    // das unterscheidet "6.985 kWh im Jahr" von einer bedeutungslosen Zahl.
    var art = r.cnt ? 'counter' : 'standard';
    var k = w.id + ':' + i + ':' + stufe + ':' + art, jetzt = Date.now(), c = _mlCmp[k];
    if (c && (jetzt - c.zeit) < 90000) { fertig(c); return; }
    fetch('?api=cmp&id=' + encodeURIComponent(r.vid) + '&stage=' + stufe + '&kind=' + art,
          {cache: 'no-store'})
      .then(function (a) { return a.json(); })
      .then(function (j) {
        _mlCmp[k] = {cur: (j && j.cur != null) ? parseFloat(j.cur) : null,
                     past: (j && j.past != null) ? parseFloat(j.past) : null,
                     // Reicht das Archiv nicht bis zum Anfang der Vorperiode, verkuerzt
                     // die Schnittstelle das Fenster beidseitig und nennt hier seinen
                     // Beginn. Das gehoert an die Zeile: eine stillschweigend verkuerzte
                     // Aussage waere schlimmer als gar keine.
                     ab: (j && j.ab) ? parseInt(j.ab) : null,
                     // Der Wert der laufenden Periode im VERKUERZTEN Fenster. Nur er ist
                     // mit past vergleichbar; cur misst die ganze Periode und gehoert in
                     // die Wertspalte.
                     curAb: (j && j.curAb != null) ? parseFloat(j.curAb) : null,
                     zeit: jetzt};
        fertig(_mlCmp[k]);
      }).catch(function () { fertig(null); });
  }
  /**
   * Abweichung aus cur/past. Dieselbe Vorsicht wie bei der KPI-Karte: ist die
   * Basis verschwindend klein (nachts sind Ertrag heute UND gestern ~0), ergaebe
   * eine Prozentrechnung absurde Werte - dann lieber nichts zeigen.
   */
  /** Der mit past vergleichbare Ist-Wert: im verkuerzten Fenster curAb, sonst cur. */
  function _mlCmpIst(p) {
    if (!p) { return null; }
    return (p.curAb != null) ? p.curAb : p.cur;
  }
  function _mlCmpDelta(p) {
    var c = _mlCmpIst(p);
    if (!p || c == null || p.past == null) { return null; }
    var d = c - p.past, EPS = 1e-3;
    if (Math.abs(p.past) < EPS) { return Math.abs(d) < EPS ? 0 : null; }
    return d / Math.abs(p.past) * 100;
  }
  /** Zahl fuer die Wertspalte formatieren, wie die Zeile es vorgibt. */
  function _mlWertTxt(r, v) {
    if (v == null || !isFinite(v)) { return '–'; }
    var d = (r.dec != null && r.dec !== '') ? parseInt(r.dec) : (Math.abs(v) >= 100 ? 0 : 1);
    var t = _mlZahl(v, d);
    if (r.thousand !== false) {
      t = t.replace(/\B(?=(\d{3})+(?!\d))/g, '.');   // nur der Vorkommateil hat Gruppen
    }
    return t;   // die Einheit steht in der eigenen Spalte .u
  }
  /** Alle Zeilen nachziehen und die Vergleichsspalte schreiben. */
  function _mlCmpAlle(w) {
    var modus = _mlBarModus(w);
    // Der Archivvergleich traegt jetzt mehr als nur die Vergleichsspalte: er speist auch
    // den Mittenbalken und den Wertungsstreifen. Ihn nur bei eingeschalteter Spalte zu
    // holen, liesse beide leer.
    if (!(w.mlShowCmp || modus === 'cmp' || modus === 'dev' || w.mlWert)) { return; }
    if (!_mlStufe(w) || _mlStufe(w) === 'var') { return; }
    var el = _mlEl(w);
    if (!el) { return; }
    (w.items || []).forEach(function (r, i) {
      _mlCmpHolen(w, i, r, function (p) {
        _mlZeileWerten(w, el, i, r, _mlCmpDelta(p), p && p.ab);
        // Die Vergleichswert-Spalte haengt an derselben Antwort - hier ist sie schon da.
        if (w.mlShowDay && !r.dayVid) {
          var ze = $('[data-mlday="' + i + '"]', el);
          if (ze) { ze.innerHTML = _mlTagTxt(r, p ? p.past : null); }
        }
        // Der Anteil rechnet aus den Werten ALLER Zeilen - er kann erst stimmen, wenn
        // wieder eine davon eingetroffen ist.
        _mlAnteilAlle(w, el);
        if (!p) { return; }
        // Bei einem Zaehler ist der interessante Wert der VERBRAUCH der Periode,
        // nicht der Zaehlerstand. Die Schnittstelle liefert ihn als cur.
        if (r.cnt && p.cur != null) {
          var ve = $('[data-mlrow="' + i + '"] .hmv > span', el);
          if (ve) { ve.textContent = _mlWertTxt(r, p.cur); }
        }
        // Der Balken vergleicht mit der Vorperiode: 100 % heisst "wie damals".
        // Damit taugt er auch fuer eine Liste aus kWh, Litern und Kilogramm -
        // eine gemeinsame Skala gaebe es dort sonst nicht.
        if (modus === 'cmp') {
          var ba = $('[data-mlbar="' + i + '"]', el);
          // Ohne Vergleichswert gibt es nichts zu vergleichen - dann bleibt der
          // Balken leer statt den Wert auf einer 0..100-Skala vorzugaukeln.
          var ist = _mlCmpIst(p);
          if (ba && (ist == null || p.past == null || Math.abs(p.past) <= 1e-9)) {
            ba.style.width = '0%';
          } else if (ba) {
            var q = Math.max(0, Math.min(100, ist / Math.abs(p.past) * 100));
            ba.style.width = q + '%';
            var cc = _mlFarbe(w, r, q);
            if (cc) { ba.style.background = cc; }
          }
        }
      });
    });
  }
  /**
   * Verlauf einer Zeile (Sparkline).
   *
   * Fenster und Aufloesung folgen dem eingestellten Vergleichszeitraum - wer "gegen letztes
   * Jahr" vergleicht, will den Verlauf ueber Monate sehen, nicht ueber Stunden. Gerechnet
   * wird nichts selbst: ?api=aggregated reicht AC_GetAggregatedValues durch, und dort steht
   * bei Zaehlern der VERBRAUCH der Periode im Feld avg - genau das, was die Sparkline
   * zeigen soll (ein steigender Zaehlerstand waere eine nichtssagende Gerade).
   * Archivabfragen sind teuer, deshalb 5 Minuten Standzeit: ein Monatsverlauf aendert
   * sich nicht im Sekundentakt.
   *   level 0=Stunde 1=Tag 2=Woche 3=Monat 4=Jahr 5=5-Minuten
   */
  /**
   * Fenster des Verlaufs: die LAUFENDE Periode, kalendergenau, dazu dieselbe Spanne
   * der Vorperiode.
   *
   * Vorher war es ein rollierendes Fenster fester Laenge - im Jahresvergleich also
   * immer die letzten 400 Tage. Das zeigte stets zwoelf Monate, auch im September,
   * und die Kurve begann irgendwo mitten im Vorjahr. Gemeint ist aber "dieses Jahr
   * bis jetzt", so wie es auch die Zahl und der Vergleich daneben meinen. Jetzt
   * laeuft das Fenster vom Periodenanfang bis jetzt, und dahinter liegt blass
   * dieselbe Spanne der Vorperiode - die Reihe vergleicht sich damit selbst.
   *   level 0=Stunde 1=Tag 2=Woche 3=Monat 4=Jahr 5=5-Minuten
   */
  function _mlSpFenster(stufe) {
    var jetzt = new Date(), a, b, lvl;
    function tag0(d) { d.setHours(0, 0, 0, 0); return d; }
    switch (stufe) {
      case 'year':
        a = new Date(jetzt.getFullYear(), 0, 1);
        b = new Date(jetzt.getFullYear() - 1, 0, 1); lvl = 3; break;
      case 'month':
        a = new Date(jetzt.getFullYear(), jetzt.getMonth(), 1);
        b = new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, 1); lvl = 1; break;
      case 'week':
        // Montag als Wochenanfang, wie im Vergleich der Schnittstelle.
        a = tag0(new Date(jetzt)); a.setDate(a.getDate() - ((a.getDay() + 6) % 7));
        b = new Date(a); b.setDate(b.getDate() - 7); lvl = 1; break;
      case 'hour':
        a = new Date(jetzt); a.setMinutes(0, 0, 0);
        b = new Date(a.getTime() - 3600000); lvl = 5; break;
      case 'minute':
        a = new Date(jetzt); a.setSeconds(0, 0);
        b = new Date(a.getTime() - 60000); lvl = 5; break;
      default:                                   // Tag
        a = tag0(new Date(jetzt));
        b = new Date(a); b.setDate(b.getDate() - 1); lvl = 0; break;
    }
    var von = Math.floor(a.getTime() / 1000), bis = Math.floor(jetzt.getTime() / 1000);
    var pvon = Math.floor(b.getTime() / 1000);
    // Die Vorperiode laeuft bis zum Anfang der laufenden - also VOLL, nicht nur ueber die
    // bisher verstrichene Spanne. Frueher war sie auf (bis - von) gekuerzt; im Jaenner waren
    // damit beide Reihen einen Monat lang, und aus zwoelf Spalten wurde eine einzige, die die
    // ganze Zelle ausfuellte. Mit der vollen Vorperiode steht der Rahmen das ganze Jahr.
    // plaetze = Buckets der VOLLSTAENDIGEN laufenden Periode; die noch nicht gelaufenen
    // bleiben leer, statt den Rahmen schrumpfen zu lassen.
    var plaetze;
    switch (stufe) {
      case 'year':  plaetze = 12; break;
      case 'month': plaetze = new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 0).getDate(); break;
      case 'week':  plaetze = 7; break;
      case 'hour':  plaetze = 12; break;   // 5-Minuten-Buckets
      case 'minute': plaetze = 1; break;
      default:      plaetze = 24; break;   // Tag, Stundenbuckets
    }
    // bis: von - 1, nicht von. Die Archivabfrage ist einschliessend: mit to = von kaeme der
    // erste Bucket der LAUFENDEN Periode noch in der Vorperiode mit - das Vorjahr haette 13
    // Monate, die Vorwoche 8 Tage (nachgemessen).
    return {lvl: lvl, von: von, bis: bis, pvon: pvon, pbis: von - 1, plaetze: plaetze};
  }
  /**
   * Eine Vergleichsperiode zurueck - dieselbe Kalenderrechnung wie im Handler
   * (?api=cmp), damit Balken und Prozentspalte nicht auseinanderlaufen.
   */
  function _mlEinePeriodeFrueher(sek, stufe) {
    var d = new Date(sek * 1000);
    switch (stufe) {
      case 'year':  d.setFullYear(d.getFullYear() - 1); break;
      case 'month': d.setMonth(d.getMonth() - 1); break;
      case 'week':  d.setDate(d.getDate() - 7); break;
      case 'hour':  d.setHours(d.getHours() - 1); break;
      case 'minute': d.setMinutes(d.getMinutes() - 1); break;
      default:      d.setDate(d.getDate() - 1); break;
    }
    return Math.floor(d.getTime() / 1000);
  }
  /** Beginn der laufenden Periode einer Aggregationsstufe (Sekunden, lokale Zeit). */
  function _mlPeriodeAb(level) {
    var d = new Date();
    if (level === 5) { d.setSeconds(0, 0); d.setMinutes(Math.floor(d.getMinutes() / 5) * 5); }
    else if (level === 0) { d.setMinutes(0, 0, 0); }
    else if (level === 1) { d.setHours(0, 0, 0, 0); }
    else if (level === 3) { d.setDate(1); d.setHours(0, 0, 0, 0); }
    else { return Infinity; }
    return Math.floor(d.getTime() / 1000);
  }
  var _mlSp = {};
  /**
   * Platz eines Buckets IM KALENDER, gezaehlt ab dem Periodenanfang.
   *
   * Ohne das richtete sich der Vergleich nach der Position im Feld - und der geht
   * schief, sobald der Vorperiode fuehrende Buckets fehlen. Bei den PV-Zaehlern gibt
   * es Januar und Februar 2025 nicht (Archiv ab 20.02.), also stand der erste Wert
   * des Vorjahres unter Januar 2026, obwohl er vom Maerz stammt. Die ganze Reihe war
   * um zwei Monate verschoben. Ueber den Kalender gerechnet steht Januar unter Januar,
   * und fehlende Monate bleiben schlicht leer.
   */
  function _mlBucketNr(t, von, lvl) {
    var a = new Date(von * 1000), b = new Date(t * 1000);
    if (lvl === 3) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); }
    if (lvl === 1) {
      // Ueber Mitternacht rechnen, nicht ueber 86400 Sekunden - sonst zaehlt die
      // Zeitumstellung im Maerz und Oktober einen Tag falsch.
      var a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      var b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((b0 - a0) / 86400000);
    }
    if (lvl === 0) { return Math.round((t - von) / 3600); }
    return Math.round((t - von) / 300);
  }
  /**
   * Eine Reihe holen, auf Kalenderplaetze gelegt. Rueckgabe: dichtes Feld ab Platz 0,
   * fehlende Buckets als NaN.
   */
  function _mlReiheHolen(vid, lvl, von, bis, laufend, fertig) {
    fetch('?api=aggregated&id=' + encodeURIComponent(vid) + '&level=' + lvl
          + '&from=' + von + '&to=' + bis, {cache: 'no-store'})
      .then(function (a) { return a.json(); })
      .then(function (j) {
        var rows = (j && j.rows) || [], nach = {}, max = -1;
        // FRUEHER wurde der laufende Bucket weggelassen (am 2. eines Monats stehen dort
        // 60 kWh statt 900, das sah wie ein Absturz aus). Damit fehlte aber immer der
        // interessanteste Balken - "September bis jetzt" war unsichtbar. Er bleibt jetzt
        // stehen; damit er nicht luegt, wird ihm in _mlSparkHolen ein GLEICH LANGER
        // Ausschnitt der Vorperiode gegenuebergestellt (?api=partial), nicht der volle
        // Vormonat. 'laufend' bleibt in der Signatur, weil die Aufrufer es unterscheiden
        // und der Wert fuer die Ausschnittsrechnung gebraucht wird.
        var grenze = Infinity;
        rows.forEach(function (r) {
          var t = +r.t || 0;
          if (!t || t >= grenze) { return; }
          var k = _mlBucketNr(t, von, lvl);
          if (k < 0) { return; }
          nach[k] = (r.avg == null) ? NaN : parseFloat(r.avg);
          if (k > max) { max = k; }
        });
        var v = [];
        for (var k2 = 0; k2 <= max; k2++) { v.push(k2 in nach ? nach[k2] : NaN); }
        fertig(v);
      }).catch(function () { fertig(null); });
  }
  /**
   * Verlauf einer Zeile: laufende Periode und dieselbe Spanne der Vorperiode.
   * Zwei Archivabfragen je Zeile, deshalb 5 Minuten Standzeit - ein Monatsverlauf
   * aendert sich nicht im Sekundentakt.
   */
  function _mlSparkHolen(w, i, r, fertig) {
    if (!r.vid) { fertig(null); return; }
    var f = _mlSpFenster(_mlStufe(w));
    var k = w.id + ':' + i + ':' + r.vid + ':' + f.lvl + ':' + f.von;
    var jetzt = Date.now(), c = _mlSp[k];
    if (c && (jetzt - c.zeit) < 300000) { fertig(c.werte, c.vor, c.plaetze || f.plaetze); return; }
    var stufe = _mlStufe(w);
    _mlReiheHolen(r.vid, f.lvl, f.von, f.bis, true, function (v) {
      _mlReiheHolen(r.vid, f.lvl, f.pvon, f.pbis, false, function (p) {
        /**
         * Den laufenden Bucket fair vergleichen.
         *
         * Der letzte Balken der laufenden Reihe ist angeschnitten - "September bis jetzt".
         * Aus der Vorperiode stuende ihm sonst der VOLLE September gegenueber, und der
         * Strich behauptete einen Einbruch, den es nicht gibt. Die Aggregation kann das
         * nicht loesen: sie liefert immer ganze Buckets, auch wenn das Fenster mitten
         * hinein endet (nachgemessen: eine Abfrage bis zum 05.09. gibt den September mit
         * seinem vollen Monatswert zurueck). Deshalb wird genau dieser eine Platz der
         * Vorperiode ueber ?api=partial nachgemessen - exakt so lang wie der laufende.
         */
        var lauf = _mlPeriodeAb(f.lvl);          // Beginn des laufenden Buckets
        var idx  = _mlBucketNr(lauf, f.von, f.lvl);
        var vor0 = _mlEinePeriodeFrueher(lauf, stufe);
        var vor1 = vor0 + (Math.floor(Date.now() / 1000) - lauf);
        function ablegen(pp) {
          _mlSp[k] = {werte: v, vor: pp, zeit: jetzt, plaetze: f.plaetze};
          fertig(v, pp, f.plaetze);
        }
        if (!p || idx < 0 || idx >= p.length || vor1 <= vor0) { ablegen(p); return; }
        fetch('?api=partial&id=' + encodeURIComponent(r.vid) + '&from=' + vor0 + '&to=' + vor1
              + '&kind=' + (r.cnt ? 'counter' : 'standard'), {cache: 'no-store'})
          .then(function (a2) { return a2.json(); })
          .then(function (j2) {
            var vv = (j2 && j2.v != null) ? parseFloat(j2.v) : NaN;
            var pp = p.slice();
            pp[idx] = isNaN(vv) ? NaN : vv;      // kein Wert -> Platz bleibt leer, statt zu luegen
            ablegen(pp);
          }).catch(function () { ablegen(p); });
      });
    });
  }
  /**
   * Sparkline als SVG. Bewusst ohne Achsen und ohne Diagrammbibliothek: die Zeile hat
   * 20 Pixel Hoehe, dort traegt nur die Form eine Aussage. preserveAspectRatio="none"
   * laesst die Kurve die ganze Zellenbreite fuellen; vector-effect haelt die Strichstaerke
   * dabei konstant, sonst wuerde sie mitgezerrt.
   */
  /**
   * Verlauf als SVG. Zwei Reihen: die laufende Periode kraeftig, die Vorperiode blass
   * dahinter. Beide teilen sich eine Skala - getrennte Skalen liessen zwei Kurven
   * gleich hoch aussehen, obwohl die eine doppelt so gross ist.
   *
   * Die Reihen sind unterschiedlich lang (September hat 30 Tage, August 31; das
   * laufende Jahr hat neun Monate, das Vorjahr zwoelf). Ausgerichtet wird deshalb am
   * PERIODENANFANG, also links - der 3. September liegt beim 3. August. Die X-Achse
   * spannt ueber die laengere der beiden Reihen.
   */
  function _mlSparkSvg(werte, hex, balken, vorher, abNull, plaetze) {
    werte = werte || []; vorher = vorher || [];
    // Beide Reihen liegen auf Kalenderplaetzen (siehe _mlBucketNr), Platz 0 ist in
    // beiden der Periodenanfang.
    //
    // FRUEHER wurden beide Reihen auf die KUERZERE gestutzt. Das kostete am Anfang jeder
    // Periode das ganze Bild: im Jaenner ist die laufende Reihe einen Monat lang, also
    // wurde auch das Vorjahr auf einen Monat gestutzt - zwoelf Spalten wurden zu einer
    // einzigen, die die ganze Zelle ausfuellte. Jetzt spannt der Rahmen ueber die VOLLE
    // Periode (plaetze), und die noch nicht gelaufenen Plaetze bleiben schlicht leer:
    // ein Balken der Hoehe null auf der Grundlinie. Bewusst NICHT mit einer echten 0
    // gefuellt - ein Monat, den es noch nicht gab, hat keinen Verbrauch von null, und
    // eine gefuellte 0 zoege die Skala nach unten und faerbte den Vergleich falsch.
    // Der Strich der Vorperiode steht auf jedem Platz, also auch dort, wo die laufende
    // Reihe noch nichts hat - genau das macht den Vergleich im Jaenner erst lesbar.
    var rahmen = Math.max(plaetze || 0, werte.length, vorher.length);
    var a = werte.filter(function (v) { return !isNaN(v); });
    var b = vorher.filter(function (v) { return !isNaN(v); });
    // Zeichnen, sobald es ueberhaupt etwas zu zeigen gibt. Frueher verlangte die Huerde
    // ZWEI laufende Punkte - im Jaenner waere damit auch das volle Vorjahr unsichtbar.
    if (!a.length && b.length < 2) { return ''; }
    var alle = a.concat(b);
    var lo = Math.min.apply(null, alle), hi = Math.max.apply(null, alle);
    var W = 100, H = 24;
    var n = rahmen;
    var blass = cssv('--faint') || '#63757b';

    if (balken) {
      // Balken NICHT als SVG: mit preserveAspectRatio="none" streckt der Browser die
      // Zeichenflaeche auf die Zellenform, und aus Saeulen werden Querstriche - eine
      // 150x20-Zelle macht aus einem quadratischen Balken einen flachen Klotz. Als
      // Elemente gebaut stimmt die Form bei jeder Zellengroesse: die Spalten teilen
      // sich die Breite, die Hoehen stehen in Prozent.
      //
      // Balken messen eine MENGE, also stehen sie auf der Null - eine Skala, die erst
      // beim kleinsten Wert beginnt, macht aus 700 gegen 950 kWh optisch nichts gegen
      // alles. Bei Vorzeichenwechsel liegt die Null im Bild und die Balken wachsen nach
      // beiden Seiten. Genau darin unterscheiden sie sich von der Linie, die die FORM
      // zeigt und den Wertebereich deshalb spreizen darf.
      // Basis waehlbar, weil beide Lesarten ihre Berechtigung haben:
      //   ab Null   ehrliche Mengen - aber bei enger Streuung sehen alle Balken gleich
      //             aus. Acht Monate zwischen 700 und 950 kWh sind auf 20 Pixel Hoehe
      //             ein durchgehender Block.
      //   gespreizt zwischen kleinstem und groesstem Wert, wie die Linie. Zeigt die
      //             Form, verlangt aber die Lesart "Balken = Rang", nicht "Balken =
      //             Menge". Vorgabe, weil eine Sparkline die Form zeigen soll; wer
      //             Mengen vergleicht, schaltet die Nullbasis ein.
      var unten, oben;
      if (abNull) { unten = Math.min(0, lo); oben = Math.max(0, hi); }
      else { var luft = (hi - lo) * 0.12 || 1; unten = lo - luft; oben = hi + luft; }
      var sp2 = (oben - unten) || 1;
      // Fusspunkt der Balken in Prozent: die Null, oder ohne Nullbasis der Skalenboden.
      var zp = abNull ? (((0 - unten) / sp2) * 100) : 0;
      var sp3 = [];
      for (var i2 = 0; i2 < n; i2++) {
        var v = werte[i2], p2 = vorher[i2];
        var st = '';
        if (v != null && !isNaN(v)) {
          // Ohne Nullbasis waechst der Balken vom unteren Rand der Skala, nicht von
          // der Null - sonst haenge er in der Luft.
          var basis = abNull ? 0 : unten;
          var hp = Math.abs(v - basis) / sp2 * 100;
          st += '--b:' + ((v >= basis) ? zp : (zp - hp)).toFixed(2) + '%;--h:'
              + Math.max(hp, 1.5).toFixed(2) + '%;';
        }
        // Die Vorperiode als kurzer Strich auf Hoehe ihres Werts - dieselbe Sprache wie
        // im Chart (cmpMark). Ein zweiter, blasser Balken dahinter verschmolz auf 20 px
        // Hoehe zu einem grauen Band; der Strich sagt dasselbe und laesst den Balken frei.
        if (p2 != null && !isNaN(p2)) {
          st += '--v:' + (((p2 - unten) / sp2) * 100).toFixed(2) + '%;';
        }
        sp3.push('<b' + (st ? (' style="' + st + '"') : '') + '></b>');
      }
      if (!sp3.length) { return ''; }
      return '<div class="mlspb"' + (unten < 0 ? ' data-null="' + zp.toFixed(2) + '"' : '')
        + ' style="color:' + hex + (unten < 0 ? (';--z:' + zp.toFixed(2) + '%') : '') + '">'
        + sp3.join('') + '</div>';
    }

    var sp = (hi - lo) || 1;
    function punkte(reihe) {
      var out = [];
      (reihe || []).forEach(function (v, i) {
        if (isNaN(v)) { return; }
        out.push(((n > 1 ? i / (n - 1) : 0) * W).toFixed(2) + ','
               + (H - 2 - ((v - lo) / sp) * (H - 4)).toFixed(2));
      });
      return out;
    }
    var pv = punkte(werte), pb = punkte(vorher);
    // Eine Polylinie braucht zwei Punkte. Reicht die LAUFENDE Reihe dafuer noch nicht
    // (Jaenner: ein Monat), wird trotzdem gezeichnet - dann eben nur die Vorperiode.
    if (pv.length < 2 && pb.length < 2) { return ''; }
    var vorn = '';
    if (pv.length > 1) {
      var flaeche = pv[0].split(',')[0] + ',' + H + ' ' + pv.join(' ')
                  + ' ' + pv[pv.length - 1].split(',')[0] + ',' + H;
      vorn = '<polygon points="' + flaeche + '" fill="' + hex + '" opacity=".14"/>'
           + '<polyline points="' + pv.join(' ') + '" fill="none" stroke="' + hex + '"'
           + ' stroke-width="1.5" vector-effect="non-scaling-stroke"'
           + ' stroke-linecap="round" stroke-linejoin="round"/>';
    }
    var hinten2 = (pb.length > 1)
      ? '<polyline points="' + pb.join(' ') + '" fill="none" stroke="' + blass + '"'
        + ' stroke-width="1.2" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"'
        + ' opacity=".7" stroke-linecap="round" stroke-linejoin="round"/>' : '';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">'
      + hinten2 + vorn + '</svg>';
  }

  /** Alle Sparklines nachziehen. */
  function _mlSparkAlle(w) {
    var balken = (_mlBarModus(w) === 'sparkbar');
    if (!_mlIstVerlauf(_mlBarModus(w))) { return; }
    var el = _mlEl(w);
    if (!el) { return; }
    (w.items || []).forEach(function (r, i) {
      var ze = $('[data-mlsp="' + i + '"]', el);
      if (!ze) { return; }
      _mlSparkHolen(w, i, r, function (v, vor, plaetze) {
        var hex = _mlFarbe(w, r, null) || cssv('--accent');
        var svg = _mlSparkSvg(v, hex, balken, vor, !!w.mlSpNull, plaetze);
        ze.innerHTML = svg || '<span class="fnt">–</span>';
      });
    });
  }
  /**
   * Alles, was an der ABWEICHUNG einer Zeile haengt, an einer Stelle: Pfeil, Mittenbalken
   * und der Wertungsstreifen links. Vorher stand jedes davon in einem eigenen Zweig, und
   * die beiden Wege zum Vergleichswert (Archiv-Zeitraum und Vergleichsvariable je Zeile)
   * haetten jeden Zweig doppelt gebraucht.
   */
  /** "21.02.2025" aus einem Unix-Zeitstempel - fuer den Hinweis am Vergleich. */
  function _mlDatum(t) {
    var x = new Date(t * 1000);
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return z(x.getDate()) + '.' + z(x.getMonth() + 1) + '.' + x.getFullYear();
  }
  function _mlZeileWerten(w, el, i, r, d, ab) {
    var ce = $('[data-mlcmp="' + i + '"]', el);
    if (ce) {
      ce.innerHTML = _mlPfeil(d, r);
      // Ein Sternchen und ein Hinweis beim Ueberfahren, wenn der Vergleich einen
      // kuerzeren Zeitraum meint als die Ueberschrift verspricht.
      ce.classList.toggle('mlteil', !!ab);
      if (ab) { ce.title = 'Vergleich erst ab ' + _mlDatum(ab)
                         + ' — davor liegen keine Archivdaten vor. Beide Zeitraeume sind gleich lang verkuerzt.'; }
      else { ce.removeAttribute('title'); }
    }
    if (_mlBarModus(w) === 'dev') {
      var ba = $('[data-mlbar="' + i + '"]', el);
      if (ba) { ba.setAttribute('style', _mlDevStil(w, r, d)); }
    }
    if (w.mlWert) {
      var ze = $('[data-mlrow="' + i + '"]', el);
      if (ze) {
        var k = _mlWertung(r, d);
        ze.classList.toggle('mlg', k > 0);
        ze.classList.toggle('mlb', k < 0);
      }
    }
  }
  /**
   * ZUSATZZEILE je Zeile (w.mlInfo + Feld 'info' der Zeile).
   *
   * Eine Metrik-Zeile zeigt EINE Groesse - der Fuehler dahinter weiss aber mehr:
   * Bodentemperatur, Batterie, Funkguete. Das gehoert nicht in die Wertspalte (dort waere
   * es eine zweite Behauptung ueber dieselbe Sache), sondern in eine eigene, leise Zeile
   * darunter. Deshalb abschaltbar: auf einer flachen Kachel ist dafuer kein Platz.
   *
   * Schreibweise im Feld: durch Komma getrennt, je Eintrag "Kurztext:ID" oder nur "ID".
   * Der Kurztext ist freiwillig, aber meist noetig - drei Prozentwerte nebeneinander sagen
   * ohne Beschriftung nichts. Die Werte holt der ZENTRALE Live-Pfad ueber data-vid; das
   * Widget rechnet daran nichts, es stellt nur die Zellen hin.
   */
  /**
   * ZUSATZTEXT IN DIE ZWEITE ZEILE (w.mlSub2).
   *
   * Der Zusatz (Feld 'sub') steht sonst hinter dem Bezeichner in derselben Spalte. Die ist
   * schmal - auf der Bodenfeuchte-Kachel wurde daraus "Hecke Garde..." und "Blumeninsel...".
   * Mit dem Schalter bekommt er eine eigene Zeile darunter und steht vollstaendig da; der
   * Bezeichner hat die Spalte dann fuer sich allein.
   */
  function _mlSubZeile(w, r) {
    if (!w.mlSub2 || !r || !r.sub) { return ''; }
    return '<div class="hmsub2">' + esc(r.sub) + '</div>';
  }
  function _mlInfoZeile(w, r) {
    if (!w.mlInfo) { return ''; }
    var iz = mlInfoListe(r);
    if (!iz.length) { return ''; }
    return '<div class="hminfo">' + iz.map(function (x) {
      return '<span class="hmi">' + (x.lbl ? ('<b>' + esc(x.lbl) + '</b> ') : '')
           + '<span data-vid="' + x.vid + '">…</span></span>';
    }).join('') + '</div>';
  }
  function mlInfoListe(r) {
    var s = (r && r.info != null) ? String(r.info) : '';
    if (!s.trim()) { return []; }
    var out = [];
    s.split(',').forEach(function (t) {
      t = t.trim(); if (!t) { return; }
      var m = t.match(/^(?:(.*?)\s*[:=]\s*)?(\d{3,})$/);
      if (!m) { return; }
      out.push({lbl: (m[1] || '').trim(), vid: parseInt(m[2], 10)});
    });
    return out;
  }
  /** Dieselbe Liste, nur die IDs - fuer _collectIds in js/06-live.js. */
  function mlInfoIds(r) { return mlInfoListe(r).map(function (x) { return x.vid; }); }

  var _MLSTAGELBL = {minute: 'Minute davor', hour: 'Stunde davor', day: 'gestern',
                     week: 'letzte Woche', month: 'letzter Monat', year: 'letztes Jahr'};
  /**
   * Vergleichszeitraum im Betrieb umschaltbar.
   *
   * w.mlCmpStage ist die VORGABE aus dem Editor. Ist der Umschalter eingeschaltet
   * (w.mlCmpSw), darf der Betrachter davon abweichen; die Wahl liegt in localStorage und
   * gilt nur fuer ihn und nur im Laufmodus - im Builder zaehlt immer die Vorgabe, sonst
   * saehe man beim Bearbeiten etwas anderes als das, was gespeichert ist.
   * Der Schluessel traegt die ANSICHT mit: baugleiche Seiten vergeben dieselben Widget-IDs
   * (siehe die Kollision bei mowplan), und zwei Listen sollen sich nicht gegenseitig
   * umschalten.
   */
  var _MLSTAGES = ['minute', 'hour', 'day', 'week', 'month', 'year'];
  // In der Leiste stehen nur die Zeitraeume, die man im Alltag wirklich vergleicht.
  // Minute und Stunde bleiben als Vorgabe im Editor waehlbar (und ein so gespeicherter
  // Wert gilt weiter), tauchen aber nicht als Knopf auf.
  var _MLSWSTAGES = ['day', 'week', 'month', 'year'];
  var _MLSTAGEKURZ = {minute: 'Min', hour: 'Std', day: 'Tag', week: 'Woche',
                      month: 'Monat', year: 'Jahr'};
  function _mlSwKey(w) {
    var v = '';
    try { if (typeof store !== 'undefined' && store && store.current) { v = store.current + '_'; } } catch (e) {}
    return 'lvmlcmp_' + v + w.id;
  }
  function _mlSwLies(w) {
    if (typeof RUN === 'undefined' || !RUN) { return null; }
    try {
      var o = localStorage.getItem(_mlSwKey(w));
      if (o && _MLSTAGES.indexOf(o) >= 0) { return o; }
    } catch (e) {}
    return null;
  }
  function _mlSwSchreib(w, stufe) {
    try { localStorage.setItem(_mlSwKey(w), stufe); } catch (e) {}
  }
  /** Der tatsaechlich geltende Vergleichszeitraum. Ueberall statt w.mlCmpStage benutzen. */
  function _mlStufe(w) {
    if (w.mlCmpSw) { var s = _mlSwLies(w); if (s) { return s; } }
    return w.mlCmpStage || '';
  }
  /** Die Umschaltleiste. Nur wenn eingeschaltet UND ein Zeitraum ueberhaupt gilt. */
  function _mlSwHtml(w) {
    if (!w.mlCmpSw || !w.mlCmpStage || w.mlCmpStage === 'var') { return ''; }
    var akt = _mlStufe(w);
    return '<div class="mlsw">' + _MLSWSTAGES.map(function (k) {
      return '<span class="mlswc' + (k === akt ? '' : ' off') + '" data-mlsw="' + k
           + '" title="gegen ' + _MLSTAGELBL[k] + '">' + _MLSTAGEKURZ[k] + '</span>';
    }).join('') + '</div>';
  }
  /** Zahl mit deutschem Komma - die Spalten rechnet das Widget selbst. */
  function _mlZahl(v, dez) {
    return (typeof v === 'number' ? v.toFixed(dez == null ? 1 : dez) : String(v)).replace('.', ',');
  }
  /**
   * Pfeil mit Vorzeichen. Die FARBE kommt aus der Wertung der Zeile, nicht aus der
   * Richtung: bei einem Verbraucher ist mehr schlecht, bei einer Erzeugung gut. Ohne
   * gesetzte Wertung bleibt es bei der bisherigen Annahme "mehr = schlecht", damit
   * bestehende Kacheln unveraendert aussehen.
   */
  function _mlPfeil(d, r) {
    if (d == null || !isFinite(d)) return '<span class="fnt">–</span>';
    var auf = d > 0, fast = Math.abs(d) < 0.5;
    if (fast) return '<span class="fnt">±0 %</span>';
    var k = _mlWertung(r || {}, d);
    var cls = k > 0 ? 'mlgut' : (k < 0 ? 'mlboese' : 'mlflau');
    return '<span class="' + cls + '">' + (auf ? '▲' : '▼') + ' '
         + _mlZahl(Math.abs(d), 0) + ' %</span>';
  }
  /**
   * Der Zahlenwert, den die Zeile ANZEIGT - eine Wahrheit fuer Anteil, Rangfolge und Balken.
   * Bei einem Zaehler mit gewaehltem Vergleichszeitraum ist das nicht der Live-Wert
   * (Zaehlerstand), sondern der Verbrauch der Periode aus dem Archiv; genau den schreibt
   * _mlCmpAlle() auch in die Wertspalte.
   */
  function _mlRohWert(w, i, r) {
    var _st = _mlStufe(w);
    if (_st && _st !== 'var' && r.cnt) {
      var p = _mlCmp[w.id + ':' + i + ':' + _st + ':counter'];
      return (p && p.cur != null) ? p.cur : null;
    }
    var d = r.vid && _lastVals[r.vid];
    if (!d) return null;
    var v = parseFloat(String(d.v).replace(',', '.'));
    return isNaN(v) ? null : v;
  }
  /**
   * Anteil einer Zeile.
   *
   * Bis hierher gab es ihn NUR aus einer eigenen Variablen je Zeile (pctVid). Fuer eine
   * Liste aus Archiv-Zaehlern gibt es die nirgends - die Spalte blieb dauerhaft leer und
   * behauptete, es gaebe nichts zu zeigen. Jetzt rechnet sie selbst, wenn keine Variable
   * gebunden ist:
   *   - Bezug ist die als "=100 %" markierte Zeile (r.ref), typisch eine Gesamt-Zeile.
   *   - Gibt es keine, ist es die Summe der uebrigen Zeilen.
   * Getrennt wird nach EINHEIT und, bei eingeschalteten Gruppen, nach Gruppe: Liter zu
   * Kilowattstunden zu addieren ergaebe eine Zahl ohne Bedeutung.
   */
  function _mlAnteil(w, i, r) {
    if (r && r.pctVid) {
      var d = _lastVals[r.pctVid];
      if (!d) return null;
      var v0 = parseFloat(String(d.v).replace(',', '.'));
      return isNaN(v0) ? null : Math.max(0, Math.min(100, v0));
    }
    if (!w) return null;
    var v = _mlRohWert(w, i, r);
    if (v == null) return null;
    var it = w.items || [];
    var grp = w.mlGroups ? String(r.grp || '') : null;
    var einh = String(r.unit || '');
    var bezug = null, summe = 0;
    it.forEach(function (o, j) {
      if (grp !== null && String(o.grp || '') !== grp) { return; }
      if (String(o.unit || '') !== einh) { return; }
      var ov = _mlRohWert(w, j, o);
      if (ov == null) { return; }
      if (o.ref) { if (bezug == null) { bezug = Math.abs(ov); } return; }
      summe += Math.abs(ov);
    });
    var b = (bezug != null) ? bezug : summe;
    if (!b) { return null; }
    return Math.max(0, Math.min(100, Math.abs(v) / b * 100));
  }
  /**
   * VERGLEICHSWERT einer Zeile: der Wert der VORPERIODE - bei "Monat" der Vormonat, bei
   * "Jahr" das Vorjahr. Also genau die Zahl, gegen die der Pfeil daneben prozentuiert.
   * Die Zeile liest sich damit als Dreiklang: jetzt | damals | Unterschied.
   *
   * Frueher stand hier fest der Tageswert (?api=cmp&stage=day), auch wenn daneben gegen den
   * Monat oder das Jahr verglichen wurde. Die Zeile sagte dann "heute 3 kWh" und gleich
   * daneben "12 % mehr als im Vorjahr" - zwei Zeitraeume in einer Zeile, die man
   * unwillkuerlich aufeinander bezieht.
   *
   * NICHT der Wert der LAUFENDEN Periode: den traegt bei einem Zaehler bereits die
   * Hauptspalte (_mlCmpAlle schreibt dort p.cur), die Zahl stuende sonst zweimal
   * nebeneinander - am 10.09.2026 im Render genau so gesehen.
   *
   * Geholt wird er ueber DENSELBEN Abruf wie die Vergleichsspalte: _mlCmpHolen liefert in
   * past bereits den Wert der Vorperiode. Ein zweiter Abruf waere nicht nur unnoetig,
   * er koennte auch etwas anderes sagen als der Pfeil daneben.
   *
   * Ohne gesetzten Vergleichszeitraum (oder bei 'var') bleibt es beim Tageswert - sonst
   * haetten Listen ohne Vergleich ploetzlich eine leere Spalte.
   * Eine gebundene dayVid hat weiterhin Vorrang; die schreibt der zentrale Live-Pfad.
   */
  var _mlTag = {};
  function _mlTagHolen(w, i, r, fertig) {
    if (r.dayVid || !r.vid) { fertig(null); return; }
    var stufe = _mlStufe(w);
    if (stufe && stufe !== 'var') {
      _mlCmpHolen(w, i, r, function (p) { fertig(p ? p.past : null); });
      return;
    }
    var art = r.cnt ? 'counter' : 'standard';
    var k = w.id + ':' + i + ':day:' + art, jetzt = Date.now(), c = _mlTag[k];
    if (c && (jetzt - c.zeit) < 90000) { fertig(c.cur); return; }
    fetch('?api=cmp&id=' + encodeURIComponent(r.vid) + '&stage=day&kind=' + art,
          {cache: 'no-store'})
      .then(function (a) { return a.json(); })
      .then(function (j) {
        _mlTag[k] = {cur: (j && j.cur != null) ? parseFloat(j.cur) : null, zeit: jetzt};
        fertig(_mlTag[k].cur);
      }).catch(function () { fertig(null); });
  }
  /** Text der Vergleichswert-Zelle. Einheit klein dahinter, damit die Zahl fuehrt. */
  function _mlTagTxt(r, v) {
    if (v == null || !isFinite(v)) { return '<span class="fnt">–</span>'; }
    return _mlWertTxt(r, v) + (r.unit ? ('<span class="u"> ' + esc(r.unit) + '</span>') : '');
  }
  /** Anteilsspalte und - wo sie ihn traegt - den Balken aller Zeilen nachziehen. */
  function _mlAnteilAlle(w, el) {
    if (!w.mlShowPct && _mlBarModus(w) !== '') { return; }
    el = el || _mlEl(w);
    if (!el) { return; }
    var _st2 = _mlStufe(w), arch = (_st2 && _st2 !== 'var');
    (w.items || []).forEach(function (r, i) {
      var a = _mlAnteil(w, i, r);
      var pe = $('[data-mlpct="' + i + '"]', el);
      if (pe) { pe.innerHTML = (a != null) ? (_mlZahl(a, 1) + ' %') : '<span class="fnt">–</span>'; }
      // Bei einem Archiv-Zaehler stand der Balken bisher stur am Anschlag: ein
      // Periodenverbrauch von 7000 kWh auf einer 0..100-Skala ist voller Balken. Der
      // Anteil an der Liste ist dort die einzige Lesart, die etwas aussagt.
      if (_mlBarModus(w) === '' && arch && r.cnt && a != null) {
        var ba = $('[data-mlbar="' + i + '"]', el);
        if (ba) {
          _mlSetzeBalken(w, ba, a);
          var cc = _mlFarbe(w, r, a);
          if (cc) { ba.style.background = cc; }
        }
      }
    });
  }
  /** Tageswert-Spalte nachziehen (nur Zeilen ohne eigene Variable). */
  function _mlTagAlle(w) {
    if (!w.mlShowDay) { return; }
    var el = _mlEl(w);
    if (!el) { return; }
    (w.items || []).forEach(function (r, i) {
      if (r.dayVid) { return; }
      var ze = $('[data-mlday="' + i + '"]', el);
      if (!ze) { return; }
      _mlTagHolen(w, i, r, function (v) { ze.innerHTML = _mlTagTxt(r, v); });
    });
  }
  /**
   * Abweichung gegen den Vergleichswert in Prozent.
   * mlCmpMode 'p100': die Variable IST bereits ein Verhaeltnis, 100 = unveraendert
   *                   (so liefern es die Prozent-VergleichzuGestern-Variablen).
   * sonst           : die Variable ist der absolute Vorwert, verglichen wird mit r.vid.
   */
  function _mlDelta(w, r) {
    if (!r.cmpVid) return null;
    var c = _lastVals[r.cmpVid];
    if (!c) return null;
    var cv = parseFloat(String(c.v).replace(',', '.'));
    if (isNaN(cv)) return null;
    if ((w.mlCmpMode || 'p100') === 'p100') return cv - 100;
    var n = _lastVals[r.vid];
    if (!n) return null;
    var nv = parseFloat(String(n.v).replace(',', '.'));
    if (isNaN(nv) || cv === 0) return null;
    return (nv - cv) / Math.abs(cv) * 100;
  }
  /** Spaltenraster passend zu den eingeschalteten Spalten. */
  function _mlRaster(w) {
    var c = 'minmax(0,7.5em) 1fr auto';
    if (w.mlShowPct)  { c += ' auto'; }
    if (w.mlShowDay)  { c += ' auto'; }
    if (w.mlShowCmp)  { c += ' auto'; }
    return c;
  }
  /** Sortierreihenfolge als Index-Liste, groesster Anteil zuerst. */
  function _mlOrdnung(w, teil) {
    var it = w.items || [];
    var idx = teil || it.map(function (r, i) { return i; });
    if (!w.mlRang) return idx;
    return idx.slice().sort(function (a, b) {
      function s(i) {
        var r = it[i], p = _mlAnteil(w, i, r);
        if (p != null) return p;
        var d = r.vid && _lastVals[r.vid];
        var v = d ? parseFloat(String(d.v).replace(',', '.')) : NaN;
        return isNaN(v) ? -1 : v;
      }
      return s(b) - s(a);
    });
  }
  /**
   * Platzvergabe fuer die Flex-Reihenfolge, Gruppen eingerechnet.
   *
   * Die Zeilen ordnen sich ueber CSS "order" - das ueberlebt einen Live-Wert, ohne die
   * Kachel neu zu zeichnen. Mit Gruppen muessen die Zwischenueberschriften in derselben
   * Reihenfolge mitlaufen, deshalb bekommt jede Gruppe einen eigenen Zahlenblock: die
   * Ueberschrift den Blockanfang, ihre Zeilen die Plaetze dahinter. Sortiert wird dann
   * INNERHALB der Gruppe - eine Rangliste ueber Gruppengrenzen hinweg waere keine
   * Gruppierung mehr.
   */
  function _mlPlaetze(w) {
    var it = w.items || [], mitGrp = !!w.mlGroups;
    var namen = [], wo = {};
    it.forEach(function (r) {
      var g = mitGrp ? String(r.grp || '') : '';
      if (wo[g] == null) { wo[g] = namen.length; namen.push(g); }
    });
    var platz = {}, kopf = {};
    namen.forEach(function (g, gi) {
      var basis = gi * 1000;
      kopf[gi] = basis;
      var teil = [];
      it.forEach(function (r, i) { if ((mitGrp ? String(r.grp || '') : '') === g) { teil.push(i); } });
      _mlOrdnung(w, teil).forEach(function (i, k) { platz[i] = basis + 1 + k; });
    });
    return {platz: platz, namen: namen, kopf: kopf};
  }
defWidget('meterlist',{
  label:'Metrik-Liste',
  cat:'Anzeige',
  paletteIcon:'wbars',
  size:[320,170],
  defaults:function(w){
    w.items=[{label:'CPU-Last',sub:'IPS',val:'14',unit:'%',pct:14},{label:'USV APC',sub:'Last',val:'31',unit:'%',pct:31},{label:'WAN',sub:'Mbit',val:'118/38',unit:'',pct:70},{label:'Batterien',sub:'Geräte',val:'62',unit:'%',pct:62}];
  },
  render:function(w){
    var P=_mlPlaetze(w), platz=P.platz;
    var ordnen=(w.mlRang||w.mlGroups);
    var modus=_mlBarModus(w);
    var extra=(w.mlShowPct||w.mlShowDay||w.mlShowCmp);
    // --mlrows sagt der Stilvorlage, wie viele Zeilen sich die Hoehe teilen. Ohne diese
    // Zahl liesse sich die Zeilenhoehe in CSS nicht ausrechnen, und die Schrift muesste
    // sich auf einen Behaelter je Zeile stuetzen - was auch --wf-lbl umdeuten wuerde.
    // Gruppenkoepfe behalten ihre Eigenhoehe, zaehlen aber mit etwa vier Fuenfteln mit,
    // weil sie den Zeilen Platz wegnehmen.
    var zzahl=(w.items||[]).length
      + (w.mlGroups ? (_mlPlaetze(w).namen.filter(function(g){return !!g;}).length*0.8) : 0);
    var teile=[];
    if(w.mlDense&&extra)teile.push('--mlcols:'+_mlRaster(w));
    // Die Zusatzzeile ist eine ZWEITE Textzeile je Eintrag - die Hoehenrechnung muss sie
    // kennen. Ohne das teilten sich die Eintraege weiterhin die Hoehe als waeren sie
    // einzeilig (flex:1 1 0 in .mlfit), der Inhalt lief ueber und die Eintraege lagen
    // sichtbar uebereinander. Gezaehlt wird nur, wo wirklich eine Zusatzzeile entsteht:
    // ein Eintrag ohne ausgefuelltes Feld bleibt einzeilig.
    var zusatz=(w.items||[]).filter(function(r){
      return (w.mlInfo&&mlInfoListe(r).length)||(w.mlSub2&&r&&r.sub);
    }).length;
    if(w.mlDense&&w.mlFit!==false)teile.push('--mlrows:'+Math.max(1,zzahl+zusatz*0.85).toFixed(2));
    var stil=teile.length?(' style="'+teile.join(';')+'"'):'';
    var zeilen=(w.items||[]).map(function(r,i){
    var live=r.vid&&_lastVals[r.vid];
    var anteil=_mlAnteil(w,i,r);
    var pct=(anteil!=null)?anteil:(live?_mlPct(r,live.v):null);
    if(pct==null)pct=parseFloat(r.pct)||0;
    // Beim Aufbau steht der Archivwert noch nicht bereit - dann Platzhalter, den
    // _mlCmpAlle() gleich darauf ersetzt. Aus dem Zwischenspeicher kommt er sofort.
    var _st3=_mlStufe(w), arch=(_st3&&_st3!=='var'), _ck=w.id+':'+i+':'+_st3+':'+(r.cnt?'counter':'standard');
    var d=arch?_mlCmpDelta(_mlCmp[_ck]):_mlDelta(w,r);
    var dTxt=(arch&&!_mlCmp[_ck])?'<span class="fnt">…</span>':_mlPfeil(d,r);
    var wert=w.mlWert?_mlWertung(r,d):0;
    var spalten='';
    if(w.mlShowPct)spalten+='<div class="hmp" data-mlpct="'+i+'">'+(anteil!=null?(_mlZahl(anteil,1)+' %'):'<span class="fnt">–</span>')+'</div>';
    // Ohne eigene Variable traegt die Zelle den gerechneten Tageswert nach; bis er da ist
    // ein Platzhalter, kein leeres Feld - leer sieht aus wie "gibt es nicht".
    if(w.mlShowDay)spalten+='<div class="hmd"'+(r.dayVid?(' data-vid="'+r.dayVid+'"'):(' data-mlday="'+i+'"'))+'>'
      +(r.dayVid?'–':(r.day?esc(r.day):(r.vid?'<span class="fnt">…</span>':'<span class="fnt">–</span>')))+'</div>';
    if(w.mlShowCmp)spalten+='<div class="hmc" data-mlcmp="'+i+'">'+dTxt+'</div>';
    // Die mittlere Spalte traegt je nach Modus Balken, Mittenbalken oder Verlauf.
    var mitte;
    if(modus==='off'){
      // Leere Zelle statt gar keiner: das Spaltenraster bleibt so wie es ist, der
      // Bezeichner steht links und der Wert rechts - nur ohne Balken dazwischen.
      mitte='<div class="hmtr aus"></div>';
    }else if(_mlIstVerlauf(modus)){
      mitte='<div class="hmtr hmsp" data-mlsp="'+i+'"></div>';
    }else if(modus==='dev'){
      mitte='<div class="hmtr dev"><u></u><i data-mlbar="'+i+'" style="'+_mlDevStil(w,r,d)+'"></i></div>';
    }else{
      // Im Saeulen-Modus waechst der Balken nach OBEN - also ueber die Hoehe. Das
      // laesst sich nicht in CSS umdeuten: 'width' bleibt 'width', auch gedreht.
      mitte='<div class="hmtr"><i'+(r.vid?' data-mlbar="'+i+'"':'')+' style="'+(w.mlVert?'height:':'width:')+pct+'%'
        +((function(c){return c?(';background:'+c):'';})(_mlFarbe(w,r,pct)))+'"></i></div>';
    }
    return '<div class="hmeter'+(wert>0?' mlg':(wert<0?' mlb':''))+'" data-mlrow="'+i+'"'
      +(ordnen?(' style="order:'+platz[i]+'"'):'')+'>'
      +'<div class="hmk">'+esc(r.label||'')+((r.sub&&!w.mlSub2)?'<span>'+esc(r.sub)+'</span>':'')+'</div>'
      +'<div class="hmv"><span'+((r.vid&&!(arch&&r.cnt))?(' data-vid="'+r.vid+'"'+_slotAttrs(r,true)):'')+'>'
      +((arch&&r.cnt)?'…':esc(r.val||'–'))+'</span>'
      +(r.unit?'<span class="u"> '+esc(r.unit)+'</span>':'')+'</div>'
      +mitte+spalten+_mlSubZeile(w,r)+_mlInfoZeile(w,r)+'</div>';}).join('');
    // Zwischenueberschriften laufen in derselben Flex-Reihenfolge mit wie die Zeilen -
    // eine namenlose Gruppe (Zeilen ohne Eintrag) bekommt keine Ueberschrift, sonst
    // staende dort eine leere Zeile.
    var koepfe=w.mlGroups?P.namen.map(function(g,gi){
      return g?('<div class="hmgrp" style="order:'+P.kopf[gi]+'">'+esc(g)+'</div>'):'';}).join(''):'';
    // Einpassen ist die Vorgabe: eine Liste, deren letzte Zeilen unter dem Rand
    // verschwinden, sieht vollstaendig aus und ist es nicht. Wer die alte Form will
    // (Eigenhoehe je Zeile, Rest scrollt), schaltet es ab.
    return '<div class="hmeters'+(w.mlVert?' vert':'')+(w.mlDense?' dense':'')+(extra?' mlx':'')
      +(w.mlWert?' mlw':'')+(w.mlGroups?' mlgrp':'')
      +((w.mlDense&&w.mlFit!==false)?' mlfit':'')+(w.mlCmpSw?' mlswon':'')+'"'+stil+'>'+_mlSwHtml(w)+koepfe+zeilen+'</div>';},
  // Eigener Live-Pfad statt data-vidbar: der zentrale Handler setzt die Breite stur auf den
  // Rohwert (0..100) und kennt weder Skala noch Umkehr dieser Zeile.
  live:function(w,el,id,d){
    var treffer=false;
    // Anteil, Tageswert und Vergleich haengen an eigenen Variablen; aendert sich
    // einer davon, muss die Zeile neu geschrieben und bei einer Rangliste auch neu
    // einsortiert werden.
    var neuOrdnen=false;
    (w.items||[]).forEach(function(r,i){
      if(String(r.pctVid)===String(id)){
        var a=_mlAnteil(w,i,r), pe=$('[data-mlpct="'+i+'"]',el), ba=$('[data-mlbar="'+i+'"]',el);
        if(pe)pe.textContent=(a!=null)?(_mlZahl(a,1)+' %'):'–';
        if(ba&&a!=null){_mlSetzeBalken(w,ba,a);
          var cc=_mlFarbe(w,r,a);if(cc)ba.style.background=cc;}
        neuOrdnen=true; treffer=true;
      }
      if(String(r.cmpVid)===String(id)){
        // Pfeil, Mittenbalken und Wertungsstreifen haengen an derselben Abweichung.
        _mlZeileWerten(w,el,i,r,_mlDelta(w,r));
        treffer=true;
      }
      if(String(r.vid)!==String(id))return;
      neuOrdnen=true;
      treffer=true;
      // Traegt die Zeile einen eigenen Anteil, gehoert der Balken IHM. Sonst
      // ueberschrieb der Wert (797 W auf einer 0..100-Skala = voller Balken) den
      // Anteil sofort wieder - der Balken zeigte dann bei allen Zeilen Anschlag.
      if(r.pctVid)return;
      // Mittenbalken und Sparkline haengen nicht am Momentanwert, sondern am Vergleich
      // bzw. am Archiv - der Wert darf sie nicht ueberschreiben.
      var _bm=_mlBarModus(w);
      if(_bm==='dev'||_bm==='off'||_mlIstVerlauf(_bm))return;
      var b=$('[data-mlbar="'+i+'"]',el);
      var p=_mlPct(r,d.v);
      if(b&&p!=null){
        _mlSetzeBalken(w,b,p);
        var c=_mlFarbe(w,r,p);              // Farbe wandert mit dem Wert, wenn eine Tabelle da ist
        if(c)b.style.background=c;
      }
    });
    if(neuOrdnen){_mlCmpAlle(w);_mlAnteilAlle(w,el);}   // Zwischenspeicher bremst die Archivabfragen
    if(neuOrdnen&&w.mlRang){
      // Nur die Zeilen umsortieren - die Gruppenkoepfe behalten ihren Blockanfang.
      var P=_mlPlaetze(w);
      Object.keys(P.platz).forEach(function(idx){
        var z=$('[data-mlrow="'+idx+'"]',el);
        if(z)z.style.order=P.platz[idx];
      });
    }
    return treffer?false:false;   // Wertetext macht weiterhin der zentrale data-vid-Pfad
  },
  props:function(w){
      return row('Säulen','<input type="checkbox" id="pMlVert"'+(w.mlVert?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">senkrechte Balken nebeneinander statt Zeilen untereinander — für Reihen wie Wochentage oder Monate</span>')
      +row('Kompakte Zeilen','<input type="checkbox" id="pMlDense"'+(w.mlDense?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Bezeichner · Balken · Wert je Zeile statt Kacheln</span>')
    +'<div class="pgh">Rangliste</div>'
    +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">Aus mehreren Einzelkacheln wird EINE Liste, in der sich die Zeilen selbst ordnen — gedacht fuer Kennzahlen, die miteinander konkurrieren (sechs Verbraucher, nicht sechs feste Messgroessen). Die drei Spalten lassen sich einzeln zuschalten.</div>'
    +row('Balken zeigt','<select id="pMlBar">'
        +'<option value=""'+(_mlBarModus(w)===''?' selected':'')+'>Wert auf der Skala der Zeile</option>'
        +'<option value="cmp"'+(_mlBarModus(w)==='cmp'?' selected':'')+'>Anteil am Vergleichswert (100 % = wie damals)</option>'
        +'<option value="dev"'+(_mlBarModus(w)==='dev'?' selected':'')+'>Abweichung als Mittenbalken</option>'
        +'<option value="spark"'+(_mlBarModus(w)==='spark'?' selected':'')+'>Verlauf als Linie (Sparkline)</option>'
        +'<option value="sparkbar"'+(_mlBarModus(w)==='sparkbar'?' selected':'')+'>Verlauf als Balken</option>'
        +'<option value="off"'+(_mlBarModus(w)==='off'?' selected':'')+'>gar keinen Balken</option>'
        +'</select>')
    +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
    +'Bei laufenden Z&auml;hlern steht „Anteil am Vergleichswert" fast immer nahe 100 % — alle '
    +'Balken sehen dann gleich aus. <b>Mittenbalken</b> zeigt stattdessen die Abweichung: Null in '
    +'der Mitte, nach rechts mehr als in der Vorperiode, nach links weniger. <b>Verlauf</b> zeigt, '
    +'wohin es geht (eine Archivabfrage je Zeile, 5 Minuten zwischengespeichert) — als <b>Linie</b>, '
    +'die den Wertebereich spreizt und damit die FORM zeigt, oder als <b>Balken</b>, die auf der Null '
    +'stehen und damit die MENGE zeigen. Beide brauchen '
    +'einen gew&auml;hlten Vergleichszeitraum. <b>Gar keinen Balken</b> l&auml;sst die Spalte leer — '
    +'sinnvoll, wenn der Balken nichts beitr&auml;gt und nur Anschlag zeigt.</div>'
    +((_mlBarModus(w)==='sparkbar')?row('Balken ab Null','<input type="checkbox" id="pMlSpNull"'+(w.mlSpNull?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">ehrliche Mengen — bei enger Streuung sehen dann aber alle Balken gleich hoch aus. Ohne Haken wird zwischen kleinstem und gr&ouml;&szlig;tem Wert gespreizt wie bei der Linie.</span>'):'')
    +((_mlBarModus(w)==='dev')?row('Vollausschlag bei','<input id="pMlDevMax" type="number" min="1" step="1" style="width:70px" value="'+((w.mlDevMax==null||w.mlDevMax==='')?25:esc(String(w.mlDevMax)))+'"> % <span style="font-size:11px;color:var(--muted)">Abweichung, ab der der Balken ganz aussen steht</span>'):'')
    +row('Alle Zeilen einpassen','<input type="checkbox" id="pMlFit"'+(w.mlFit!==false?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Zeilen teilen sich die H&ouml;he, die Schrift folgt der Zeilenh&ouml;he — so ist jeder Eintrag sichtbar. Aus: Zeilen behalten ihre H&ouml;he, der Rest scrollt.</span>')
    +row('Gruppen','<input type="checkbox" id="pMlGroups"'+(w.mlGroups?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Zwischen&uuml;berschriften aus der Spalte „Gruppe" — sortiert wird dann innerhalb der Gruppe</span>')
    +row('Zusatz 2. Zeile','<input type="checkbox" id="pMlSub2"'+(w.mlSub2?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Der Zusatztext je Zeile (Spalte „Zusatz") steht dann in einer eigenen Zeile darunter statt hinter dem Bezeichner — der wird sonst in schmalen Kacheln abgeschnitten.</span>')
    +row('Zusatzzeile','<input type="checkbox" id="pMlInfo"'+(w.mlInfo?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Zweite, leise Zeile je Eintrag aus der Spalte „Zusatzzeile": durch Komma getrennt <code>Kurztext:ID</code> oder nur <code>ID</code> (z.&nbsp;B. <code>Temp:26985, Batt:36808, Funk:27196</code>). Ohne Kurztext steht dort nur der Wert.</span>')
    +row('Wertung zeigen','<input type="checkbox" id="pMlWert"'+(w.mlWert?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">Farbstreifen links; ob eine Abweichung gut ist, sagt das Häkchen „mehr = gut" je Zeile. Pfeil und Mittenbalken folgen der Wertung auch ohne diesen Schalter.</span>')
    +row('Selbst ordnen','<input type="checkbox" id="pMlRang"'+(w.mlRang?' checked':'')+'> <span style="font-size:11px;color:var(--muted)">groesster Anteil oben</span>')
    +row('Spalten','<label><input type="checkbox" id="pMlPct"'+(w.mlShowPct?' checked':'')+'> Anteil</label> '
        +'<label style="margin-left:10px"><input type="checkbox" id="pMlDay"'+(w.mlShowDay?' checked':'')+'> Vergleichswert</label> '
        +'<label style="margin-left:10px"><input type="checkbox" id="pMlCmp"'+(w.mlShowCmp?' checked':'')+'> Vergleich</label>')
    +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
    +'<b>Anteil</b> und <b>Tageswert</b> brauchen keine eigene Variable mehr. Ohne gebundene ID '
    +'rechnet der Anteil gegen die Zeile, die „=100 %" tr&auml;gt (typisch eine Gesamt-Zeile) — gibt '
    +'es keine, gegen die Summe der &uuml;brigen Zeilen; getrennt nach Einheit und Gruppe, damit nicht '
    +'Liter zu Kilowattstunden addiert werden. Der Tageswert kommt aus dem Archiv (Verbrauch von heute '
    +'bzw. Tagesmittel). Eine gebundene ID hat weiterhin Vorrang.</div>'
    +(w.mlShowCmp?row('Vergleichszeitraum','<select id="pMlCmpStage">'
        +'<option value="var"'+(!w.mlCmpStage||w.mlCmpStage==='var'?' selected':'')+'>aus der Variablen je Zeile</option>'
        +['minute','hour','day','week','month','year'].map(function(k){
            return '<option value="'+k+'"'+(w.mlCmpStage===k?' selected':'')+'>gegen '+_MLSTAGELBL[k]+'</option>';}).join('')
        +'</select> <span style="font-size:11px;color:var(--muted)">gerechnet aus dem Archiv</span>'):'')
    +((w.mlShowCmp&&w.mlCmpStage&&w.mlCmpStage!=='var')?row('Umschalter','<label style="font-size:12px"><input type="checkbox" id="pMlCmpSw"'+(w.mlCmpSw?' checked':'')+'> oben rechts einblenden</label>')+'<div style="font-size:11px;color:var(--muted);margin:2px 2px 6px">Blendet eine Leiste (Tag / Woche / Monat / Jahr) in der Kachel ein. Die Wahl gilt nur fuer den Betrachter, wird im Browser gemerkt und ueberschreibt den Zeitraum oben. Im Editor gilt immer die Vorgabe.</div>':'')
    +((w.mlShowCmp&&(!w.mlCmpStage||w.mlCmpStage==='var'))?row('Vergleich liest','<select id="pMlCmpMode"><option value="p100"'+((w.mlCmpMode||'p100')==='p100'?' selected':'')+'>Verh&auml;ltnis, 100 = unver&auml;ndert</option><option value="wert"'+(w.mlCmpMode==='wert'?' selected':'')+'>absoluter Vorwert</option></select>'):'')
    +listEditor(w,'items','Zeile: Bezeichner · Zusatz · Variable · Einheit · Skala · Farbe · Anteil · Tageswert · Vergleich',[
      {k:'label',ph:'Bezeichner'},
      {k:'sub',  ph:'Zusatz'},
      {k:'vid',  ph:'Variablen-ID'},
      {k:'unit', ph:'Einh'},
      {k:'min',  ph:'von'},
      {k:'max',  ph:'bis'},
      {k:'inv',  ph:'umkehren', type:'check'},
      {k:'color',type:'skincolor'},
      {k:'pctVid',ph:'Anteil-ID',h:'Anteil %'},
      {k:'dayVid',ph:'Wert-ID',h:'Vergleichswert (feste Variable)'},
      {k:'cmpVid',ph:'Vergl.-ID',h:'Vergleich'},
      {k:'cnt',type:'check',h:'Zähler',ph:'Zähler'},
      {k:'grp',ph:'Gruppe',h:'Gruppe'},
      {k:'ref',type:'check',h:'=100 %',ph:'Bezugsgröße für den Anteil'},
      {k:'gut',type:'check',h:'mehr = gut',ph:'mehr ist besser (Erzeugung) — ohne Haken gilt: weniger ist besser'},
      {k:'info',ph:'Kurztext:ID, …',h:'Zusatzzeile'}])
    +'<div class="pgh">Vergleichstabelle (Farbe nach Wert)</div>'
    +'<div style="font-size:11px;color:var(--muted);margin:-2px 2px 5px">'
    +'Gilt für ALLE Zeilen und bewertet den auf 0…100 normierten Wert — deshalb passt eine '
    +'Tabelle auch für Zeilen mit verschiedenen Skalen. Je Zeile eine reine Zahl („ab diesem '
    +'Wert") oder ein Muster (<code>&gt;=20&lt;40</code>, <code>*</code>). Leer = feste Farbe je Zeile.</div>'
    +listEditor(w,'mlGrad','Ab Wert · Farbe',[{k:'v',ph:'ab %'},{k:'color',type:'skincolor'}])
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">'
    +'„von/bis" ist die Skala des BALKENS in der Einheit der Variablen (leer = 0…100). '
    +'„umkehren" für Größen, bei denen ein hoher Wert wenig bedeutet — etwa Saugspannung in '
    +'Zentibar, wo hoch = trocken heißt. Die angezeigte Zahl bleibt immer der Messwert.</div>'
    +'<div style="font-size:11px;color:var(--muted);margin:2px 2px 5px">'
    +'„Gruppe" fasst aufeinanderfolgende Zeilen unter einer Überschrift zusammen (leer = keine). '
    +'„mehr = gut" dreht die Wertung dieser Zeile um: bei Erzeugung (PV) ist ein Plus gut, beim '
    +'Verbrauch schlecht. Ohne Haken gilt weiterhin „weniger ist besser". Die Wertung färbt Pfeil, '
    +'Mittenbalken und Wertungsstreifen. „=100 %" macht die Zeile zur Bezugsgröße der Anteilsspalte '
    +'— sonst ist es die Summe der übrigen Zeilen.</div>';}
,
  // Klick auf die Umschaltleiste. Die Zwischenspeicher haengen am Zeitraum und muessen
  // deshalb mit - sonst zeigte die Liste nach dem Umschalten noch die alten Zahlen, bis
  // die 90 s bzw. 5 min Standzeit abgelaufen waeren.
  click:function(w,el,e){
    var c=e.target.closest('[data-mlsw]'); if(!c){return false;}
    var k=c.getAttribute('data-mlsw');
    if(!k||_MLSWSTAGES.indexOf(k)<0){return true;}
    if(k===_mlStufe(w)){return true;}
    _mlSwSchreib(w,k);
    Object.keys(_mlCmp).forEach(function(x){if(x.indexOf(w.id+':')===0){delete _mlCmp[x];}});
    Object.keys(_mlSp).forEach(function(x){if(x.indexOf(w.id+':')===0){delete _mlSp[x];}});
    var host=el.querySelector('.winner')||el;
    host.innerHTML=WIDGETS.meterlist.render(w);
    WIDGETS.meterlist.mount(w);
    return true;
  },
  mount:function(w){ _mlCmpAlle(w); _mlSparkAlle(w); _mlAnteilAlle(w); _mlTagAlle(w); },
  wire:function(w){
      if($('#pMlVert'))$('#pMlVert').onchange=function(){w.mlVert=this.checked||undefined;render();commit();};
    if($('#pMlDense'))$('#pMlDense').onchange=function(){w.mlDense=this.checked||undefined;render();renderProps();commit();};
    function b(id,prop){var e=$('#'+id);if(e)e.onchange=function(){w[prop]=this.checked||undefined;render();renderProps();commit();};}
    b('pMlRang','mlRang');b('pMlPct','mlShowPct');b('pMlDay','mlShowDay');b('pMlCmp','mlShowCmp');
    b('pMlGroups','mlGroups');b('pMlWert','mlWert');b('pMlInfo','mlInfo');b('pMlSub2','mlSub2');
    // Umgekehrte Logik: gespeichert wird nur das ABWEICHEN von der Vorgabe.
    if($('#pMlFit'))$('#pMlFit').onchange=function(){w.mlFit=this.checked?undefined:false;render();commit();};
    if($('#pMlSpNull'))$('#pMlSpNull').onchange=function(){w.mlSpNull=this.checked||undefined;_mlSp={};render();_mlSparkAlle(w);commit();};
    if($('#pMlBar'))$('#pMlBar').onchange=function(){
      w.mlBar=this.value||undefined;
      delete w.mlBarCmp;              // die alte Ja/Nein-Eigenschaft ist damit abgeloest
      render();renderProps();_mlCmpAlle(w);_mlSparkAlle(w);commit();};
    if($('#pMlDevMax'))$('#pMlDevMax').onchange=function(){
      var v=parseFloat(this.value);w.mlDevMax=(isFinite(v)&&v>0)?v:undefined;render();commit();};
    if($('#pMlCmpMode'))$('#pMlCmpMode').onchange=function(){w.mlCmpMode=(this.value==='wert')?'wert':undefined;render();commit();};
    if($('#pMlCmpSw'))$('#pMlCmpSw').onchange=function(){
      w.mlCmpSw=this.checked||undefined;render();renderProps();commit();};
    if($('#pMlCmpStage'))$('#pMlCmpStage').onchange=function(){
      w.mlCmpStage=(this.value==='var')?undefined:this.value;
      _mlCmp={};_mlSp={};              // Zwischenspeicher gehoeren zum alten Zeitraum
      render();renderProps();_mlCmpAlle(w);_mlSparkAlle(w);commit();};
  }
});
