  // ===== Gemeinsame Sonnen- und Szenen-Mathematik =====
  //
  //  Eine Quelle fuer alle Widgets, die mit dem Sonnenstand arbeiten (suncompass, cover,
  //  sunscene). Die NOAA-Position ist gegen die IPS-Location #13098 verifiziert (< 1 Grad).
  //  Reine Rechenfunktionen ohne DOM-Zugriff — damit einzeln pruefbar.

  var LVSUN = (function () {
    var D = Math.PI / 180, R = 180 / Math.PI;

    /** NOAA-Sonnenstand. unixSec = Sekunden seit Epoch. -> {az, elev} in Grad. */
    function pos(lat, lon, unixSec) {
      var JD = unixSec / 86400 + 2440587.5, T = (JD - 2451545) / 36525;
      var L0 = ((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360 + 360) % 360;
      var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
      var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T), Mr = M * D;
      var C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(Mr)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr);
      var tl = L0 + C, om = 125.04 - 1934.136 * T, al = tl - 0.00569 - 0.00478 * Math.sin(om * D);
      var eps0 = 23 + (26 + ((21.448 - T * (46.815 + T * (0.00059 - T * 0.001813)))) / 60) / 60;
      var eps = eps0 + 0.00256 * Math.cos(om * D);
      var decl = Math.asin(Math.sin(eps * D) * Math.sin(al * D)) * R;
      var y = Math.pow(Math.tan(eps / 2 * D), 2), L0r = L0 * D;
      var Eq = 4 * R * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r)
             - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
      var minUTC = (((unixSec % 86400) + 86400) % 86400) / 60;
      var tst = (((minUTC + Eq + 4 * lon) % 1440) + 1440) % 1440, ha = tst / 4 - 180;
      if (ha < -180) ha += 360;
      var latr = lat * D, decr = decl * D, har = ha * D;
      var zen = Math.acos(Math.min(1, Math.max(-1,
        Math.sin(latr) * Math.sin(decr) + Math.cos(latr) * Math.cos(decr) * Math.cos(har)))) * R;
      var el = 90 - zen, elr = el * D, refr = 0;                       // atmosphaerische Refraktion
      if (el > 5 && el <= 85) refr = (58.1 / Math.tan(elr) - 0.07 / Math.pow(Math.tan(elr), 3) + 0.000086 / Math.pow(Math.tan(elr), 5)) / 3600;
      else if (el > -0.575 && el <= 5) refr = (1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)))) / 3600;
      else if (el <= -0.575) refr = (-20.772 / Math.tan(elr)) / 3600;
      el += refr;
      var azt = Math.acos(Math.min(1, Math.max(-1,
        ((Math.sin(latr) * Math.cos(zen * D)) - Math.sin(decr)) / (Math.cos(latr) * Math.sin(zen * D))))) * R;
      var az = ha > 0 ? (azt + 180) % 360 : (540 - azt) % 360;
      return { az: az, elev: el };
    }

    /** Tagesbogen: Stuetzpunkte alle stepMin Minuten ab Mitternacht Ortszeit. */
    function dayTrack(lat, lon, atMs, stepMin) {
      var d = new Date(atMs || Date.now());
      var mid = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() / 1000;
      var st = stepMin || 5, pts = [];
      for (var m = 0; m <= 1440; m += st) {
        var p = pos(lat, lon, mid + m * 60);
        pts.push({ min: m, az: p.az, elev: p.elev });
      }
      return pts;
    }

    /** Auf-/Untergang (Sonnenoberkante, -0,833 Grad) aus dem Tagesbogen, in Minuten. */
    function riseSet(track) {
      var rise = null, set = null, H = -0.833;
      for (var i = 1; i < track.length; i++) {
        var a = track[i - 1], b = track[i];
        if (a.elev < H && b.elev >= H && rise === null) rise = lerpMin(a, b, H);
        if (a.elev >= H && b.elev < H) set = lerpMin(a, b, H);
      }
      return { rise: rise, set: set };
    }
    function lerpMin(a, b, h) { var t = (h - a.elev) / ((b.elev - a.elev) || 1); return a.min + t * (b.min - a.min); }

    /** Klarhimmel-Globalstrahlung (Haurwitz 1945) in W/m2 — Referenz fuer "wie klar ist es". */
    function clearSky(elevDeg) {
      if (elevDeg <= 0) return 0;
      var z = (90 - elevDeg) * D, cz = Math.cos(z);
      return Math.max(0, 1098 * cz * Math.exp(-0.059 / (cz || 1e-6)));
    }
    /** Klarheit 0..1 aus gemessener Einstrahlung gegen den Klarhimmel-Wert. */
    function clearness(measured, elevDeg) {
      var cs = clearSky(elevDeg);
      if (!(cs > 20) || measured == null) return null;
      return Math.max(0, Math.min(1, measured / cs));
    }


    /**
     * Mond: Ort am Himmel und Phase.
     *  Kurzformeln nach Meeus, "Astronomical Algorithms" (Kapitel Mondposition und
     *  beleuchteter Anteil) - genau auf etwa ein Zehntel Grad, fuer eine Darstellung
     *  mehr als ausreichend.
     *  -> {az, elev, fraction, phase, limb, distKm}
     *     fraction = beleuchteter Anteil 0..1
     *     phase    = 0 Neumond · 0,25 zunehmend halb · 0,5 Vollmond · 0,75 abnehmend halb
     *     limb     = Stellungswinkel der beleuchteten Seite (Bogenmass)
     */
    function moon(lat, lon, unixSec) {
      var d = unixSec / 86400 - 10957.5;                  // Tage seit J2000,0
      var e = 23.4397 * D;
      // --- Mond, geozentrisch-ekliptikal ---
      var L = (218.316 + 13.176396 * d) * D;              // mittlere Laenge
      var M = (134.963 + 13.064993 * d) * D;              // mittlere Anomalie
      var F = (93.272 + 13.229350 * d) * D;               // Argument der Breite
      var lam = L + 6.289 * D * Math.sin(M);
      var bet = 5.128 * D * Math.sin(F);
      var dt = 385001 - 20905 * Math.cos(M);              // Entfernung in km
      var ra = Math.atan2(Math.sin(lam) * Math.cos(e) - Math.tan(bet) * Math.sin(e), Math.cos(lam));
      var dec = Math.asin(Math.sin(bet) * Math.cos(e) + Math.cos(bet) * Math.sin(e) * Math.sin(lam));
      // --- Sonne, geozentrisch-ekliptikal (fuer die Phase) ---
      var Ms = (357.5291 + 0.98560028 * d) * D;
      var Cs = (1.9148 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms) + 0.0003 * Math.sin(3 * Ms)) * D;
      var lams = Ms + Cs + Math.PI + (102.9372 * D);
      var ds = 149598000 - 2500000 * Math.cos(Ms);        // Sonnenentfernung in km
      var ras = Math.atan2(Math.sin(lams) * Math.cos(e), Math.cos(lams));
      var decs = Math.asin(Math.sin(e) * Math.sin(lams));
      // --- Phase ---
      var elong = Math.acos(Math.min(1, Math.max(-1, Math.sin(decs) * Math.sin(dec)
                + Math.cos(decs) * Math.cos(dec) * Math.cos(ras - ra))));
      var inc = Math.atan2(ds * Math.sin(elong), dt - ds * Math.cos(elong));   // Phasenwinkel
      var limb = Math.atan2(Math.cos(decs) * Math.sin(ras - ra),
                 Math.sin(decs) * Math.cos(dec) - Math.cos(decs) * Math.sin(dec) * Math.cos(ras - ra));
      var frac = (1 + Math.cos(inc)) / 2;
      var ph = 0.5 + 0.5 * (limb < 0 ? -1 : 1) * (inc / Math.PI);   // 0 Neumond ... 0,5 Vollmond
      // --- horizontnah: Stundenwinkel -> Azimut/Hoehe ---
      var days = unixSec / 86400 - 10957.5;
      var lst = (280.16 + 360.9856235 * days) * D + lon * D;        // Sternzeit am Ort
      var H = lst - ra;
      var latr = lat * D;
      var alt = Math.asin(Math.sin(latr) * Math.sin(dec) + Math.cos(latr) * Math.cos(dec) * Math.cos(H));
      var az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(latr) - Math.tan(dec) * Math.cos(latr));
      az = ((az * R) + 180) % 360;                                  // von Sued -> von Nord
      if (az < 0) az += 360;
      var pax = Math.asin(6378 / dt) * R;                           // taegliche Parallaxe
      return { az: az, elev: alt * R - pax * Math.cos(alt), fraction: frac,
               phase: (ph % 1 + 1) % 1, limb: limb, distKm: dt };
    }

    /** Name der Mondphase fuer die Beschriftung. */
    function moonName(phase) {
      var p = ((phase % 1) + 1) % 1;
      if (p < 0.02 || p > 0.98) return 'Neumond';
      if (p < 0.23) return 'zunehmende Sichel';
      if (p < 0.27) return 'zunehmender Halbmond';
      if (p < 0.48) return 'zunehmend, fast voll';
      if (p < 0.52) return 'Vollmond';
      if (p < 0.73) return 'abnehmend, fast voll';
      if (p < 0.77) return 'abnehmender Halbmond';
      return 'abnehmende Sichel';
    }

    return { pos: pos, dayTrack: dayTrack, riseSet: riseSet, clearSky: clearSky, clearness: clearness,
             moon: moon, moonName: moonName, D: D, R: R };
  })();
