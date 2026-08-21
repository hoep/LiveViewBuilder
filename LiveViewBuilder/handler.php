<?php

/**
 * LiveViewBuilder — WebHook-Dispatch.
 * Wird von ProcessHookData() per include aufgerufen; erwartet im Scope:
 *   $this (Modulinstanz) · $TOKEN (Schreib-Token) · $DIR (Modulordner: builder.html, assets)
 *   · $DATADIR (Datenordner: layouts.json) · $WSPORT (optional WebSocket-Port)
 * Layouts liegen als Datei in $DATADIR/layouts.json (transparent, WS-lesbar, backup-bar).
 */

require_once __DIR__ . '/store.inc.php';   // Ablage-Logik geteilt mit module.php

$api = (string) ($_GET['api'] ?? '');


// Modus aus dem Pfad:  /hook/run/<site> -> Laufzeit ; sonst Builder/Editor
$LV_MODE = 'builder';
$uriPath = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
$seg     = explode('/', trim($uriPath, '/'));
if (($seg[1] ?? '') === 'run') {
    $LV_MODE = 'run';
} elseif (($seg[1] ?? '') === 'doku') {
    // Eigenstaendige Doku- und Demoseite: zeigt JEDES Widget live samt seinen Einstellungen.
    // Braucht keine gespeicherte Ansicht - sie wird aus der Widget-Registry erzeugt.
    $LV_MODE = 'doku';
}

// ---- Statische Assets (ECharts, offline gehostet) ----
if ($api === 'asset') {
    $name  = (string) ($_GET['name'] ?? '');
    $files = ['echarts' => $DIR . '/assets/echarts.min.js', 'dokudata' => $DIR . '/src/js/12-doku-data.js'];
    if (!isset($files[$name]) || !is_file($files[$name])) {
        http_response_code(404);
        echo '// not found';
        return;
    }
    // readfile() schiebt die Datei in 8-KB-Haeppchen durch die Hook-Schicht. Bei echarts
    // (1 MB) sind das 128 Einzelausgaben zu je rund 59 ms - zusammen ueber 7 Sekunden, in
    // denen die Hook-Abarbeitung steht. Die parallelen Startanfragen des Builders
    // (api=layout, api=tree) laufen derweil in den Abbruch, was im Browser als
    // "TypeError: Failed to fetch" ankommt: leere Oberflaeche ohne erkennbaren Grund.
    // In EINEM Stueck ausgegeben ist dieselbe Datei in Millisekunden draussen - die
    // 748-KB-Builderseite nimmt denselben Weg und braucht dafuer 6 ms.
    $blob = (string) file_get_contents($files[$name]);
    $etag = '"' . md5($blob) . '"';
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=604800');
    header('ETag: ' . $etag);
    // Bei "Neu laden erzwingen" umgeht der Browser den Zwischenspeicher, schickt aber das
    // ETag mit. Dann genuegt 304 - ohne die 1 MB erneut durch die Hook-Schicht zu pressen.
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) {
        http_response_code(304);
        return;
    }
    header('Content-Length: ' . strlen($blob));
    echo $blob;
    return;
}

// ---- Selbst gehostete Schriften (OFL/gratis, lokal ausgeliefert) ----
// ?api=font&file=<name>.woff2 -> assets/fonts/<name>.woff2 (kein externes CDN).
if ($api === 'font') {
    $file = (string) ($_GET['file'] ?? '');
    if (!preg_match('/^[a-z0-9-]+\.woff2$/', $file)) { http_response_code(400); echo 'bad request'; return; }
    $path = $DIR . '/assets/fonts/' . $file;
    if (!is_file($path)) { http_response_code(404); echo 'not found'; return; }
    $blob = (string) file_get_contents($path);
    $etag = '"' . md5($blob) . '"';
    header('Content-Type: font/woff2');
    header('Cache-Control: public, max-age=31536000, immutable');
    header('ETag: ' . $etag);
    if (trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '')) === $etag) { http_response_code(304); return; }
    header('Content-Length: ' . strlen($blob));
    echo $blob;
    return;
}

// ---- Gebaeude der Umgebung (OpenStreetMap) fuer das Widget "sunscene" ----
// Das Widget fragt selbst an; der Server liefert aus dem Cache und holt nur beim
// allerersten Mal je Standort bei Overpass nach (danach 60 Tage aus der Datei).
// Kartendaten: (c) OpenStreetMap-Mitwirkende (ODbL).
if ($api === 'geo') {
    header('Content-Type: application/json; charset=utf-8');
    require_once $DIR . '/geo.php';
    $lat = (float) ($_GET['lat'] ?? 0);
    $lon = (float) ($_GET['lon'] ?? 0);
    $rad = max(50, min(1000, (int) ($_GET['r'] ?? 250)));
    if ($lat === 0.0 && $lon === 0.0) { echo json_encode(['ok' => false, 'err' => 'coords']); return; }

    $c = geo_read($DATADIR, $lat, $lon, $rad);
    if ($c !== null && empty($c['stale'])) { echo json_encode($c); return; }

    // Noch kein (frischer) Cache. Der Abruf bei Overpass laeuft IM HOOK-THREAD und blockiert
    // damit alle anderen Anfragen der Seite - gemessen 8 s fuer einen ungecachten Radius,
    // waehrend eine daneben laufende, laengst gecachte Anfrage 6,4 s wartete statt 2 ms.
    // Darum: hoechstens EIN Abruf gleichzeitig und hoechstens einer alle 10 Minuten je
    // Standort/Radius. Alle anderen bekommen sofort, was da ist (notfalls leer) und fragen
    // beim naechsten Aufruf wieder - besser eine Szene ohne Nachbarhaeuser als eine Seite,
    // die auf einen fremden Server wartet.
    $lock = rtrim($DATADIR, '/') . '/cache-geo-' . str_replace('.', '_', (string) $lat) . '_'
          . str_replace('.', '_', (string) $lon) . '_' . $rad . '.lock';
    $now  = time();
    $busy = is_file($lock) && ($now - (int) @filemtime($lock)) < 600;
    if ($busy) { echo json_encode($c !== null ? $c : ['ok' => false, 'err' => 'pending']); return; }
    @touch($lock);
    $fresh = geo_build($DATADIR, $lat, $lon, $rad, true, 8);
    if (!empty($fresh['ok'])) { @unlink($lock); }
    if (!empty($fresh['ok'])) { echo json_encode($fresh); return; }
    echo json_encode($c !== null ? $c : ['ok' => false, 'err' => $fresh['err'] ?? 'fetch']);
    return;
}

// ---- Live-Objektbaum (lazy + Suche nach Name/Pfad/ID) ----
if ($api === 'tree') {
    header('Content-Type: application/json; charset=utf-8');
    $search = trim((string) ($_GET['search'] ?? ''));
    if ($search !== '') {
        // ID-Treffer: jede Objekt-ID (nicht nur Variablen) - so springt man auch auf eine
        // Kategorie oder Instanz und kann sie im Ergebnis aufklappen.
        $idHit = null;
        $searchId = (preg_match('/^[0-9]+$/', $search) === 1) ? (int) $search : -1;
        if ($searchId >= 0 && IPS_ObjectExists($searchId)) {
            $idHit         = LVB_TreeNode($searchId);
            $idHit['path'] = LVB_ObjPath($searchId);
        }
        // Volltext: Variablen (Name + voller Pfad) UND Instanzen (Geraete per Name/Pfad
        // findbar, dann aufklappbar). Doppelte IDs werden uebersprungen.
        $cand = array_merge(IPS_GetVariableList(), IPS_GetInstanceList());
        $seen = [];
        $rest = [];
        foreach ($cand as $vid) {
            if ($vid === $searchId || isset($seen[$vid])) {
                continue;
            }
            $seen[$vid] = true;
            // Namensvergleich zuerst (billig); Objektpfad nur bei Bedarf berechnen (teuer: Baum-Walk)
            $nameHit = mb_stripos(IPS_GetName($vid), $search) !== false;
            $path    = $nameHit ? null : LVB_ObjPath($vid);
            if ($nameHit || mb_stripos($path, $search) !== false) {
                $node         = LVB_TreeNode($vid);
                $node['path'] = $path !== null ? $path : LVB_ObjPath($vid);
                $rest[]       = $node;
                if (count($rest) >= 400) {
                    break;
                }
            }
        }
        usort($rest, function ($a, $b) {
            return strnatcasecmp($a['path'], $b['path']);
        });
        if (count($rest) > 200) {
            $rest = array_slice($rest, 0, 200);
        }
        echo json_encode(['search' => $search, 'nodes' => $idHit !== null ? array_merge([$idHit], $rest) : $rest]);
        return;
    }
    $parent = (int) ($_GET['parent'] ?? 0);
    $nodes  = [];
    $kids   = ($parent === 0 || IPS_ObjectExists($parent)) ? IPS_GetChildrenIDs($parent) : [];
    foreach ($kids as $cid) {
        $nodes[] = LVB_TreeNode($cid);
    }
    // Reihenfolge exakt wie die Symcon-Konsole: zuerst nach Objektposition, bei gleicher
    // Position (Standard 0) natuerlich-alphabetisch nach Name.
    usort($nodes, function ($a, $b) {
        if ($a['pos'] !== $b['pos']) {
            return $a['pos'] <=> $b['pos'];
        }
        return strnatcasecmp($a['name'], $b['name']);
    });
    echo json_encode(['parent' => $parent, 'path' => LVB_ObjPath($parent), 'nodes' => $nodes]);
    return;
}

// ---- Builder-Bedienoberflaeche: Sitzungseinstellungen (Zoom, aktiver Tab, Schwebemodus+
//      Position). BEWUSST getrennt vom Layout-Store in einer eigenen Datei je Instanz:
//      UI-Zustand soll das Dokument nicht veraendern und nicht an die Run-Clients
//      veroeffentlicht werden. GET liest, POST/?save (mit key=TOKEN) schreibt.
if ($api === 'bset') {
    header('Content-Type: application/json; charset=utf-8');
    if (!is_dir($DATADIR)) { @mkdir($DATADIR, 0775, true); }
    $bf     = $DATADIR . '/builder-settings.json';
    $isSave = (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') || isset($_GET['save']);
    if ($isSave) {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403); echo json_encode(['error' => 'forbidden']); return;
        }
        $data = file_get_contents('php://input');
        if ($data === '' || $data === false) { $data = (string) ($_POST['data'] ?? ''); }
        $obj = json_decode($data, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($obj)) {
            http_response_code(400); echo json_encode(['error' => 'invalid json']); return;
        }
        @file_put_contents($bf, $data);
        echo json_encode(['ok' => true, 'bytes' => strlen($data)]);
        return;
    }
    $data = @file_get_contents($bf);
    echo ($data !== false && $data !== '') ? $data : '{}';
    return;
}

// ---- Homematic-CCU Servicemeldungen lesen (nur IP; XML-RPC 2001/2010 + ReGaHss-Namen) ----
if ($api === 'hmmsg') {
    header('Content-Type: application/json; charset=utf-8');
    $ip = (string) ($_GET['ip'] ?? '');
    if (!LVB_HmPrivateIp($ip)) { echo json_encode(['error' => 'ip', 'messages' => []]); return; }
    // Typ -> Severity-Chip des bestehenden Widgets (gleiche Farben/Filter)
    $sevMap = ['ERROR' => 'ERROR', 'FAULT_REPORTING' => 'ERROR', 'SABOTAGE' => 'ERROR',
        'UNREACH' => 'WARNING', 'STICKY_UNREACH' => 'WARNING', 'LOWBAT' => 'WARNING', 'LOW_BAT' => 'WARNING',
        'DUTYCYCLE' => 'WARNING', 'DUTY_CYCLE' => 'WARNING', 'CONFIG_PENDING' => 'NOTIFY', 'UPDATE_PENDING' => 'NOTIFY'];
    $names = LVB_HmNameMap($ip, (string) $DATADIR);
    // Optionaler Interface-Filter (?if=bidcos,hmip). Leer/fehlt = beide. So kann das Widget
    // BidCos-RF (klassisch HM) und HmIP-RF getrennt an- und abwaehlen.
    $ifsel = strtolower((string) ($_GET['if'] ?? ''));
    $ports = [];
    if ($ifsel === '' || strpos($ifsel, 'bidcos') !== false) $ports[2001] = 'BidCos-RF';
    if ($ifsel === '' || strpos($ifsel, 'hmip')   !== false) $ports[2010] = 'HmIP-RF';
    if (!$ports) $ports = [2001 => 'BidCos-RF', 2010 => 'HmIP-RF'];
    $seen = []; $out = [];
    foreach ($ports as $port => $iface) {
        $xml = LVB_HmXmlRpc($ip, $port, 'getServiceMessages');
        foreach (LVB_HmParseServiceMessages($xml) as $m) {
            $addr = $m['addr']; $type = $m['type'];
            if ($addr === '' || $type === '') continue;
            $val = $m['val'];
            if ($val === '0' || $val === 'false') continue;   // nur anstehende Meldungen (getServiceMessages liefert ohnehin nur aktive)
            $key = $addr . '|' . $type; if (isset($seen[$key])) continue; $seen[$key] = 1;
            $dev  = explode(':', $addr)[0];
            $name = $names[$dev] ?? $dev;
            $out[] = ['sev' => ($sevMap[$type] ?? 'NOTIFY'), 'type' => $type, 'addr' => $addr,
                'iface' => $iface, 'name' => $name, 'm' => $name . '  ·  ' . $type, 't' => ''];
        }
    }
    echo json_encode(['messages' => $out, 'count' => count($out)]);
    return;
}

// ---- Homematic-Servicemeldung bestaetigen (token):  ?api=hmack&ip=&addr=&type=&key=TOKEN ----
if ($api === 'hmack') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { http_response_code(403); echo json_encode(['error' => 'forbidden']); return; }
    $ip = (string) ($_GET['ip'] ?? '');
    if (!LVB_HmPrivateIp($ip)) { echo json_encode(['error' => 'ip']); return; }
    $addr = preg_replace('/[^A-Za-z0-9:_-]/', '', (string) ($_GET['addr'] ?? ''));
    $type = preg_replace('/[^A-Z_]/', '', (string) ($_GET['type'] ?? ''));
    if ($addr === '' || $type === '') { echo json_encode(['error' => 'param']); return; }
    $r = LVB_HmRega($ip, 'var o=dom.GetObject("AL-' . $addr . '.' . $type . '");if(o){o.AlReceipt();WriteLine("ok");}else{WriteLine("no");}');
    echo json_encode(['ok' => ($r !== null && strpos($r, 'ok') !== false)]);
    return;
}

// ---- IPS-Meldungen aus dem Logfile (ohne DEBUG), neueste zuerst ----
if ($api === 'messages') {
    header('Content-Type: application/json; charset=utf-8');
    $path = '/var/log/symcon/logfile.log';
    if (!@is_readable($path)) {
        $g = @glob('/var/log/symcon/logfile*.log');
        if ($g) { usort($g, function ($a, $b) { return filemtime($b) - filemtime($a); }); $path = $g[0]; }
    }
    $max = (int) ($_GET['n'] ?? 60); if ($max < 1) $max = 60; if ($max > 500) $max = 500;
    // Optionaler Severity-Filter: nur diese Kategorien zählen -> liefert die letzten $max Treffer (zeitunabhängig)
    $sevf = [];
    if (isset($_GET['sev']) && $_GET['sev'] !== '') {
        foreach (explode(',', strtoupper((string) $_GET['sev'])) as $s) { $s = trim($s); if ($s !== '') $sevf[$s] = true; }
    }
    $out = [];
    $fp = @fopen($path, 'rb');
    if ($fp) {
        $st = @fstat($fp); $size = $st ? $st['size'] : 0;
        $chunk = min($size, 3000000); $data = ''; // größeres Fenster, damit auch seltene Kategorien weit zurück gefunden werden
        if ($chunk > 0) { fseek($fp, -$chunk, SEEK_END); $data = fread($fp, $chunk); }
        fclose($fp);
        $lines = explode("\n", $data);
        for ($i = count($lines) - 1; $i >= 0 && count($out) < $max; $i--) {
            $ln = rtrim($lines[$i]); if ($ln === '') continue;
            $p = explode(' | ', $ln, 5);
            if (count($p) < 5) continue;
            $sev = trim($p[2]);
            if ($sev === '' || $sev === 'DEBUG') continue;
            if ($sevf && empty($sevf[$sev])) continue; // nur angeforderte Kategorien
            $out[] = ['t' => trim($p[0]), 'sev' => $sev, 'src' => trim($p[3]), 'm' => mb_substr(trim($p[4]), 0, 300)];
        }
    }
    echo json_encode(['messages' => $out, 'file' => basename($path)]);
    return;
}

// ---- Live-Werte (Delta über since) ----
if ($api === 'epg') {
    // ---- Programmfuehrer: ein Zeitfenster aus dem XMLTV-Zwischenlager --------
    //
    // Gelesen wird NICHT die 23 MB grosse XMLTV-Datei, sondern die Tagesdateien,
    // die das Skript "ER - EPG-Zwischenlager" daraus baut (je Tag rund 175 KB).
    // Der Receiver wird hier nicht angefasst - er kennt dieses Fenster gar nicht.
    header('Content-Type: application/json; charset=utf-8');
    $dir = IPS_GetKernelDir() . 'livebuilder/epg';
    $von = (int) ($_GET['von'] ?? time());
    if ($von <= 0) { $von = time(); }
    $dauer = (int) ($_GET['dauer'] ?? 10800);          // Sekunden, Vorgabe drei Stunden
    // Deckel: mehr als zwoelf Stunden auf einmal ergeben eine Antwort, die
    // niemand anzeigt, aber jeder uebertraegt.
    $dauer = max(1800, min(43200, $dauer));
    $bis = $von + $dauer;

    $kanaele = json_decode((string) @file_get_contents($dir . '/kanaele.json'), true);
    if (!is_array($kanaele) || $kanaele === []) {
        echo json_encode(['ok' => false, 'fehler' => 'kein EPG-Zwischenlager - Skript "ER - EPG-Zwischenlager" noch nicht gelaufen']);
        return;
    }
    $stand = json_decode((string) @file_get_contents($dir . '/stand.json'), true) ?: [];

    // Sendungen liegen im Tag ihres BEGINNS. Eine, die um 23:40 anfaengt, steht
    // also im Vortag - deshalb faengt das Einlesen einen Tag frueher an.
    $mitDetail = (int) ($_GET['detail'] ?? 0) === 1;
    $tage = [];
    for ($t = $von - 86400; $t <= $bis; $t += 86400) {
        $tage[date('Y-m-d', $t)] = true;
    }
    $tage[date('Y-m-d', $bis)] = true;
    $daten = [];
    foreach (array_keys($tage) as $tag) {
        $j = json_decode((string) @file_get_contents($dir . '/tag-' . $tag . '.json'), true);
        if (!is_array($j)) { continue; }
        foreach ($j as $ch => $liste) {
            foreach ($liste as $p) {
                if ((int) $p[0] >= $bis || (int) $p[1] <= $von) { continue; }
                // Die Beschreibung nur auf Nachfrage. Sie ist das laengste Feld;
                // im Raster steht sie nirgends, in der Detailansicht ueberall.
                // Leeren, nicht entfernen: eine Luecke im Zahlenindex macht aus
                // dem JSON-Array ein Objekt, und der Client liest dann nichts mehr.
                if (!$mitDetail && isset($p[6])) { $p[6] = ''; }
                $daten[$ch][] = $p;
            }
        }
    }

    // Programmierte Aufnahmen. Die Datei schreibt das Skript "ER - Timerliste
    // ablegen"; der Hook fragt die Box NICHT selbst - sonst kostete jeder
    // Seitenaufruf eine Abfrage an ein Geraet, das nebenher fernsieht.
    $tj = json_decode((string) @file_get_contents($dir . '/timer.json'), true);
    $timer = [];
    foreach (($tj['timer'] ?? []) as $t) {
        // Vergleichsform der Referenz: die ersten zehn Felder, ohne Anhaengsel.
        $k = strtoupper(implode(':', array_slice(explode(':', (string) $t['ref']), 0, 10)));
        $timer[$k][] = $t;
    }
    $istProgrammiert = function (string $ref, int $a, int $b) use ($timer): int {
        $k = strtoupper(implode(':', array_slice(explode(':', $ref), 0, 10)));
        foreach ($timer[$k] ?? [] as $t) {
            // Ein Timer traegt Vor- und Nachlauf, deckt die Sendung also weiter ab
            // als sie dauert. Als Treffer zaehlt, wer ihre MITTE einschliesst -
            // damit gilt weder der Vorlauf der naechsten noch der Nachlauf der
            // vorigen Sendung als Aufnahme dieser hier.
            $mitte = (int) (($a + $b) / 2);
            if ((int) $t['start'] <= $mitte && (int) $t['ende'] >= $mitte) {
                return empty($t['aus']) ? 1 : 2;   // 1 = programmiert, 2 = abgeschaltet
            }
        }
        return 0;
    };

    $nurIds = array_filter(array_map('trim', explode(',', (string) ($_GET['kanaele'] ?? ''))));
    $out = [];
    foreach ($kanaele as $k) {
        $id = (string) ($k['id'] ?? '');
        if ($nurIds !== [] && !in_array($id, $nurIds, true)) { continue; }
        $p = $daten[$id] ?? [];
        usort($p, static fn(array $a, array $b): int => $a[0] <=> $b[0]);
        if (($k['ref'] ?? '') !== '' && $timer !== []) {
            foreach ($p as $i => $x) {
                $mark = $istProgrammiert((string) $k['ref'], (int) $x[0], (int) $x[1]);
                if (!isset($p[$i][6])) { $p[$i][6] = ''; }   // kein Loch im Index
                $p[$i][7] = $mark;
            }
        }
        $out[] = ['id' => $id, 'name' => (string) ($k['name'] ?? $id), 'picon' => (string) ($k['picon'] ?? ''),
                  'ref' => (string) ($k['ref'] ?? ''), 'p' => $p];
    }
    echo json_encode(['ok' => true, 'von' => $von, 'bis' => $bis, 'jetzt' => time(),
                      'stand' => (int) ($stand['stand'] ?? 0), 'quelle' => 'XMLTV',
                      'timerstand' => (int) ($tj['stand'] ?? 0), 'timer' => count($tj['timer'] ?? []),
                      'kanaele' => $out], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return;
}

if ($api === 'val') {
    header('Content-Type: application/json; charset=utf-8');
    $ids   = array_filter(array_map('intval', explode(',', (string) ($_GET['ids'] ?? ''))));
    $since = (int) ($_GET['since'] ?? 0);
    $sfx = function ($vid) { // Profil-Suffix (Einheit) der Variable
        $vv = @IPS_GetVariable($vid);
        if (!$vv) return '';
        $pr = ($vv['VariableCustomProfile'] !== '') ? $vv['VariableCustomProfile'] : $vv['VariableProfile'];
        if ($pr !== '' && IPS_VariableProfileExists($pr)) {
            return (string) IPS_GetVariableProfile($pr)['Suffix'];
        }
        return '';
    };
    $out   = [];
    foreach ($ids as $id) {
        if (@IPS_VariableExists($id)) {
            $vi = IPS_GetVariable($id);
            if ($since > 0 && $vi['VariableChanged'] < $since) {
                continue;
            }
            // 'c' = Zeitpunkt der letzten AENDERUNG. Wird fuer Anzeigen wie "seit 18:12"
            // gebraucht; ohne ihn koennte der Client nur ab dem eigenen Laden zaehlen.
            $out[$id] = ['v' => GetValue($id), 'f' => @GetValueFormatted($id), 'u' => $sfx($id),
                         'c' => (int) $vi['VariableChanged']];
        }
    }
    echo json_encode(['ts' => time(), 'values' => $out]);
    return;
}

// ---- Astro/Standort: Location Control (Sonne+Dämmerung+lat/lon) + Astronomie (Mond).  ?api=astro&id=<locID>&moon=<astroID> ----
if ($api === 'astro') {
    header('Content-Type: application/json; charset=utf-8');
    $id  = (int) ($_GET['id'] ?? 0);
    $res = ['ts' => time()];
    if ($id > 0 && @IPS_InstanceExists($id)) {
        $cfg = json_decode((string) @IPS_GetConfiguration($id), true);
        if (is_array($cfg) && isset($cfg['Location'])) {
            $loc = json_decode((string) $cfg['Location'], true);
            if (is_array($loc) && isset($loc['latitude'])) { $res['lat'] = $loc['latitude']; $res['lon'] = $loc['longitude'] ?? null; }
        }
        $map = ['sunrise' => 'Sunrise', 'sunset' => 'Sunset', 'sunalt' => 'Altitude', 'sunaz' => 'Azimuth',
                'dawn' => 'CivilTwilightStart', 'dusk' => 'CivilTwilightEnd', 'isday' => 'IsDay'];
        foreach ($map as $k => $ident) {
            $vid = @IPS_GetObjectIDByIdent($ident, $id);
            if ($vid && @IPS_VariableExists($vid)) { $res[$k] = GetValue($vid); }
        }
    }
    $mid = (int) ($_GET['moon'] ?? 0);
    if ($mid > 0 && @IPS_InstanceExists($mid)) {
        $mm = ['moonaz' => 'moonazimut', 'moonalt' => 'moonaltitude', 'moonrise' => 'moonrisetime',
               'moonset' => 'moonsettime', 'moonphase' => 'moonphase', 'moonvis' => 'moonvisibility'];
        foreach ($mm as $k => $ident) {
            $vid = @IPS_GetObjectIDByIdent($ident, $mid);
            if ($vid && @IPS_VariableExists($vid)) { $res[$k] = GetValue($vid); }
        }
    }
    echo json_encode($res);
    return;
}

// ---- Tageslaenge ueber ein ganzes Jahr:  ?api=daylight&id=<LocationInstanz>[&year=][&lat=&lon=] ----
// Rechnet NICHT selbst, sondern nutzt die native PHP-Funktion date_sun_info().
// Rueckgabe sind absolute Unix-Zeitstempel (UTC-neutral) - die Umrechnung in Ortszeit macht der
// Browser, damit die Zeitzone des Symcon-Prozesses (haeufig UTC) keine Rolle spielt.
if ($api === 'daylight') {
    header('Content-Type: application/json; charset=utf-8');
    $id   = (int) ($_GET['id'] ?? 0);
    $year = (int) ($_GET['year'] ?? 0);
    if ($year < 1970 || $year > 2200) { $year = (int) date('Y'); }
    $lat = isset($_GET['lat']) ? (float) $_GET['lat'] : null;
    $lon = isset($_GET['lon']) ? (float) $_GET['lon'] : null;

    // Standort bevorzugt aus der Location-Control-Instanz (gleiche Quelle wie ?api=astro)
    if (($lat === null || $lon === null) && $id > 0 && @IPS_InstanceExists($id)) {
        $cfg = json_decode((string) @IPS_GetConfiguration($id), true);
        if (is_array($cfg) && isset($cfg['Location'])) {
            $loc = json_decode((string) $cfg['Location'], true);
            if (is_array($loc) && isset($loc['latitude'])) {
                $lat = (float) $loc['latitude'];
                $lon = (float) ($loc['longitude'] ?? 0);
            }
        }
    }
    // Ohne Angabe: erste Instanz suchen, die eine Location-Konfiguration mit Breitengrad hat
    // (unabhaengig von der Modul-GUID, damit es auch bei abweichenden Standort-Modulen greift).
    if ($lat === null || $lon === null) {
        foreach (@IPS_GetInstanceList() as $iid) {
            $cfg = json_decode((string) @IPS_GetConfiguration($iid), true);
            if (!is_array($cfg) || !isset($cfg['Location'])) { continue; }
            $loc = json_decode((string) $cfg['Location'], true);
            if (is_array($loc) && isset($loc['latitude']) && $loc['latitude'] != 0) {
                $lat = (float) $loc['latitude'];
                $lon = (float) ($loc['longitude'] ?? 0);
                $id  = $iid;
                break;
            }
        }
    }
    if ($lat === null || $lon === null) {
        http_response_code(400);
        echo json_encode(['error' => 'no location', 'hint' => 'Location-Control-Instanz angeben (id) oder lat/lon setzen']);
        return;
    }

    $days = [];
    $t    = gmmktime(12, 0, 0, 1, 1, $year);          // Mittag UTC, damit der Tag eindeutig ist
    $end  = gmmktime(12, 0, 0, 1, 1, $year + 1);
    while ($t < $end) {
        $i = date_sun_info($t, $lat, $lon);
        // Polarnacht/Mitternachtssonne: sunrise/sunset sind dann bool statt Zeitstempel
        $r = (isset($i['sunrise']) && is_int($i['sunrise'])) ? $i['sunrise'] : null;
        $s = (isset($i['sunset'])  && is_int($i['sunset']))  ? $i['sunset']  : null;
        $days[] = [$t, $r, $s];
        $t += 86400;
    }
    echo json_encode(["year" => $year, "lat" => $lat, "lon" => $lon, "src" => $id, "days" => $days]);
    return;
}

// ---- Assoziationen (Variablenprofil): Wert -> Name/Icon/Farbe  ?api=assoc&id=<id> ----
if ($api === 'assoc') {
    header('Content-Type: application/json; charset=utf-8');
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !@IPS_VariableExists($id)) {
        echo json_encode(['error' => 'no variable']);
        return;
    }
    $v    = IPS_GetVariable($id);
    $prof = $v['VariableCustomProfile'] !== '' ? $v['VariableCustomProfile'] : $v['VariableProfile'];
    $res  = ['id' => $id, 'type' => $v['VariableType'], 'profile' => $prof, 'assocs' => []];
    if ($prof !== '' && IPS_VariableProfileExists($prof)) {
        $p = IPS_GetVariableProfile($prof);
        $res['suffix'] = $p['Suffix'];
        $res['prefix'] = $p['Prefix'];
        $res['min']    = $p['MinValue'];
        $res['max']    = $p['MaxValue'];
        $res['step']   = $p['StepSize'];
        $res['digits'] = $p['Digits'];
        $res['picon']  = $p['Icon'];
        foreach ($p['Associations'] as $a) {
            $res['assocs'][] = [
                'v'     => $a['Value'],
                'name'  => $a['Name'],
                'icon'  => $a['Icon'],
                'color' => ($a['Color'] >= 0) ? sprintf('#%06X', $a['Color']) : null,
            ];
        }
    }
    echo json_encode($res);
    return;
}

// ---- Ereignis-Info:  ?api=event&id=<eventid> ----
if ($api === 'event') {
    header('Content-Type: application/json; charset=utf-8');
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !IPS_EventExists($id)) {
        echo json_encode(['error' => 'no event']);
        return;
    }
    $ev = IPS_GetEvent($id);
    echo json_encode([
        'id'     => $id,
        'name'   => IPS_GetName($id),
        'active' => (bool) ($ev['EventActive'] ?? false),
        'next'   => (int) ($ev['NextRun'] ?? 0),
        'last'   => (int) ($ev['LastRun'] ?? 0),
    ]);
    return;
}

// ---- Ereignis aktiv/inaktiv schalten (token):  ?api=setevent&id=<id>&active=0|1&key=TOKEN ----
if ($api === 'setevent') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden']);
        return;
    }
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !IPS_EventExists($id)) {
        http_response_code(404);
        echo json_encode(['error' => 'no event']);
        return;
    }
    IPS_SetEventActive($id, ((string) ($_GET['active'] ?? '')) === '1');
    echo json_encode(['ok' => true]);
    return;
}

// ---- Skript ausführen (token):  ?api=runscript&id=<id>&key=TOKEN ----
if ($api === 'runscript') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden']);
        return;
    }
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !IPS_ScriptExists($id)) {
        http_response_code(404);
        echo json_encode(['error' => 'no script']);
        return;
    }
    IPS_RunScript($id);
    echo json_encode(['ok' => true]);
    return;
}

// ---- Poolcontroller: Relais-Zeitplaene an den Controller senden (token):
//      ?api=poolsched&inst=<id>&key=TOKEN[&probe=1]
//      Ohne probe wird geschrieben - aber in EINEM Vorgang fuer alle Relais, weil
//      setRules() ohnehin immer die komplette TIMEC-Sektion schickt.
if ($api === 'poolsched') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'fehler' => 'forbidden']);
        return;
    }
    $inst = (int) ($_GET['inst'] ?? 0);
    $guid = ($inst > 0 && @IPS_InstanceExists($inst)) ? (IPS_GetInstance($inst)['ModuleInfo']['ModuleID'] ?? '') : '';
    if ($guid !== '{878CA345-86D1-84FC-B196-5B3224C067CF}' || !function_exists('HSPC_ZeitplanProbe')) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'fehler' => 'kein PoolController']);
        return;
    }
    echo empty($_GET['probe']) ? HSPC_ZeitplaeneSenden($inst) : HSPC_ZeitplanProbe($inst);
    return;
}

// ---- Poolcontroller: gesammelte Konfigurationswerte schreiben (token):
//      POST ?api=poolsave&inst=<id>&key=TOKEN   Rumpf: werte=<JSON {vid:wert,...}>
//      Der Grund fuer den Sammelweg: am ProCon ist keine Einzeleinstellung schreibbar.
//      setRules() schickt immer die KOMPLETTE Sektion; fuenf einzeln gestellte Felder
//      waeren fuenf vollstaendige Sektionsschreibungen gegen ein Stundenbudget von 60.
//      Das Modul gruppiert den Auftrag und schreibt je Sektion genau einmal.
if ($api === 'poolsave') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'fehler' => 'forbidden']);
        return;
    }
    $inst = (int) ($_GET['inst'] ?? 0);
    $roh  = (string) ($_POST['werte'] ?? '');
    if ($roh === '') {
        $body = (string) @file_get_contents('php://input');
        if ($body !== '') {
            $felder = [];
            parse_str($body, $felder);
            $roh = (string) ($felder['werte'] ?? '');
        }
    }
    $guid = ($inst > 0 && @IPS_InstanceExists($inst)) ? (IPS_GetInstance($inst)['ModuleInfo']['ModuleID'] ?? '') : '';
    if ($guid !== '{878CA345-86D1-84FC-B196-5B3224C067CF}' || !function_exists('HSPC_SchreibeSammlung')) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'fehler' => 'kein PoolController']);
        return;
    }
    if (trim($roh) === '') {
        echo json_encode(['ok' => false, 'fehler' => 'nichts zu schreiben']);
        return;
    }
    // ?trocken=1 zeigt nur, was passieren wuerde - ohne jeden Geraetezugriff.
    echo HSPC_SchreibeSammlung($inst, $roh, !empty($_GET['trocken']));
    return;
}

// ---- Serienrecorder: eine doppelte Aufnahme loeschen (token):  ?api=srdel&inst=<id>&pfad=<pfad>&key=TOKEN ----
//      Loeschen ist nicht harmlos, deshalb Token wie bei runscript. Zusaetzlich wird geprueft,
//      dass die Zielinstanz wirklich ein SeriesRecorder ist - der Hook ruft keine beliebige
//      Funktion auf einer beliebigen Instanz. Die eigentliche Sicherung sitzt im Modul: es
//      rechnet die Duplikatliste neu und lehnt ab, was dort nicht als ueberfluessig steht.
if ($api === 'srdel') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden']);
        return;
    }
    $inst = (int) ($_GET['inst'] ?? 0);
    // Mehrere Pfade kommen als JSON-Array in 'pfade'. Ein Sammelauftrag ist hier
    // nicht Bequemlichkeit: je Haekchen eine eigene Anfrage abzufeuern hiesse,
    // dass die Aufrufe im Modul nebenlaeufig dieselbe Liste lesen und
    // zurueckschreiben - der letzte gewinnt, die uebrigen Streichungen gehen
    // verloren.
    // Der Auftrag darf im Rumpf stehen: 40 Aufnahmepfade mit Umlauten und
    // Leerzeichen ergeben prozentkodiert weit mehr, als eine URL sicher traegt.
    $roh = (string) ($_POST['pfade'] ?? $_GET['pfade'] ?? '');
    if ($roh === '') {
        $body = (string) @file_get_contents('php://input');
        if ($body !== '') {
            $felder = [];
            parse_str($body, $felder);
            $roh = (string) ($felder['pfade'] ?? '');
        }
    }
    $pfade = $roh !== '' ? json_decode($roh, true) : [(string) ($_GET['pfad'] ?? '')];
    if (!is_array($pfade)) {
        $pfade = [];
    }
    $pfade = array_values(array_filter(array_map('strval', $pfade), static fn(string $p): bool => $p !== ''));
    $guid = ($inst > 0 && @IPS_InstanceExists($inst)) ? (IPS_GetInstance($inst)['ModuleInfo']['ModuleID'] ?? '') : '';
    if ($guid !== '{F7F9F89F-82ED-4478-970F-C3C749912A0A}' || !function_exists('SR_LoescheDatei')) {
        http_response_code(404);
        echo json_encode(['error' => 'kein SeriesRecorder']);
        return;
    }
    if ($pfade === []) {
        echo json_encode(['ok' => false, 'grund' => 'kein Pfad']);
        return;
    }
    $auftrag = json_encode($pfade, JSON_UNESCAPED_UNICODE);
    // SR_LoescheDateien gibt es erst nach einem Neustart des Dienstes; die alte
    // Funktion nimmt denselben Auftrag entgegen und reicht ihn durch.
    echo function_exists('SR_LoescheDateien')
        ? SR_LoescheDateien($inst, $auftrag)
        : SR_LoescheDatei($inst, $auftrag);
    return;
}

// ---- BatteryManager-Scan auslösen (harmlos, ohne Token):  ?api=batscan&vid=<Register-VarID> ----
//      Ermittelt die Instanz über den Parent der Register-Variable und ruft BM_Update NUR,
//      wenn es wirklich eine BatteryManager-Instanz ist (kein beliebiger Aufruf).
if ($api === 'batscan') {
    header('Content-Type: application/json; charset=utf-8');
    $vid  = (int) ($_GET['vid'] ?? 0);
    $inst = ($vid > 0 && @IPS_ObjectExists($vid)) ? (int) IPS_GetObject($vid)['ParentID'] : 0;
    $guid = ($inst > 0 && @IPS_InstanceExists($inst)) ? (IPS_GetInstance($inst)['ModuleInfo']['ModuleID'] ?? '') : '';
    if ($guid === '{E1F670B8-2C59-493E-BE02-6C53779193CB}' && function_exists('BM_Update')) {
        BM_Update($inst);
        echo json_encode(['ok' => true, 'inst' => $inst]);
    } else {
        echo json_encode(['ok' => false, 'err' => 'keine BatteryManager-Instanz']);
    }
    return;
}

// ---- Heizung (heatplan-Widget): op=list|get frei lesen, op=save token-geschützt ----
//      Dünner Proxy auf das Backend-Skript "HM_Heizung_LVB" (Ident LVB_HeatAPI unter #23491),
//      das die serialisierten HomeMatic-Wochenprofile liest/prüft/schreibt und JSON zurückgibt.
if ($api === 'heat') {
    header('Content-Type: application/json; charset=utf-8');
    $op  = (string) ($_GET['op'] ?? 'list');
    $sid = (int) (@IPS_GetObjectIDByIdent('LVB_HeatAPI', 23491) ?: 0);
    if ($sid <= 0 || !IPS_ScriptExists($sid)) {
        echo json_encode(['ok' => false, 'err' => 'backend']);
        return;
    }
    if ($op === 'save') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'err' => 'forbidden']);
            return;
        }
        $data = (string) ($_POST['data'] ?? '');
        if ($data === '') $data = (string) file_get_contents('php://input');
        echo IPS_RunScriptWaitEx($sid, [
            'op'       => 'save',
            'room'     => (string) ($_GET['room'] ?? ''),
            'presence' => (string) ($_GET['presence'] ?? ''),
            'dryrun'   => (string) ($_GET['dryrun'] ?? ''),
            'root'     => (string) ($_GET['root'] ?? ''),
            'data'     => $data,
        ]);
        return;
    }
    echo IPS_RunScriptWaitEx($sid, ['op' => $op, 'room' => (string) ($_GET['room'] ?? ''), 'root' => (string) ($_GET['root'] ?? '')]);
    return;
}

// ---- Wochenplan-Editor (weekedit-Widget): generischer Symcon-Wochenplan (EventType 2) ----
//      op=list|get frei lesen, op=set token-geschützt. Schreibt Schaltpunkte einer Gruppe:
//      Punkt setzen/hinzufügen via IPS_SetEventScheduleGroupPoint, Überzahl löschen via
//      ungültiger Zeit (Stunde -1) — laut Symcon-Doku.
if ($api === 'week') {
    header('Content-Type: application/json; charset=utf-8');
    $op = (string) ($_GET['op'] ?? 'list');

    if ($op === 'list') {
        $out = [];
        foreach (IPS_GetEventList() as $eid) {
            $e = IPS_GetEvent($eid);
            if ((int) ($e['EventType'] ?? -1) !== 2) continue;
            $out[] = ['id' => $eid, 'name' => IPS_GetName($eid), 'path' => LVB_ObjPath($eid), 'actions' => count($e['ScheduleActions'] ?? [])];
        }
        echo json_encode(['ok' => true, 'plans' => $out]);
        return;
    }

    if ($op === 'get') {
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0 || !IPS_EventExists($id)) { echo json_encode(['ok' => false, 'err' => 'event']); return; }
        $e = IPS_GetEvent($id);
        if ((int) ($e['EventType'] ?? -1) !== 2) { echo json_encode(['ok' => false, 'err' => 'notweekplan']); return; }
        $actions = [];
        foreach ($e['ScheduleActions'] ?? [] as $a) $actions[] = ['id' => (int) $a['ID'], 'name' => $a['Name'], 'color' => sprintf('#%06X', ((int) $a['Color']) & 0xFFFFFF)];
        $groups = [];
        foreach ($e['ScheduleGroups'] ?? [] as $g) {
            $days = (int) $g['Days']; $dayList = [];
            for ($d = 0; $d < 7; $d++) if ($days & (1 << $d)) $dayList[] = $d;      // Bit0 = Montag
            $pts = [];
            foreach ($g['Points'] ?? [] as $p) $pts[] = ['h' => (int) $p['Start']['Hour'], 'm' => (int) $p['Start']['Minute'], 'actionId' => (int) $p['ActionID']];
            usort($pts, fn($x, $y) => ($x['h'] * 60 + $x['m']) - ($y['h'] * 60 + $y['m']));
            $groups[] = ['gid' => (int) $g['ID'], 'days' => $days, 'dayList' => $dayList, 'points' => $pts];
        }
        // aktuelle Aktion "jetzt" aus dem Plan selbst berechnen (Event ist keine Variable)
        $dow = (int) date('N') - 1; $nowMin = (int) date('G') * 60 + (int) date('i'); $nowAct = null;
        foreach ($e['ScheduleGroups'] ?? [] as $g) {
            if (!((int) $g['Days'] & (1 << $dow))) continue; $best = null;
            foreach ($g['Points'] ?? [] as $p) { $pm = $p['Start']['Hour'] * 60 + $p['Start']['Minute']; if ($pm <= $nowMin && ($best === null || $pm > $best)) { $best = $pm; $nowAct = (int) $p['ActionID']; } }
        }
        echo json_encode(['ok' => true, 'id' => $id, 'name' => IPS_GetName($id), 'active' => (bool) $e['EventActive'], 'actions' => $actions, 'groups' => $groups, 'now' => $nowAct]);
        return;
    }

    if ($op === 'set') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $id = (int) ($_GET['id'] ?? 0); $gid = (int) ($_GET['group'] ?? 0); $dry = ((string) ($_GET['dryrun'] ?? '') === '1');
        if ($id <= 0 || !IPS_EventExists($id)) { echo json_encode(['ok' => false, 'err' => 'event']); return; }
        $e = IPS_GetEvent($id);
        if ((int) ($e['EventType'] ?? -1) !== 2) { echo json_encode(['ok' => false, 'err' => 'notweekplan']); return; }
        $body = (string) ($_POST['data'] ?? ''); if ($body === '') $body = (string) file_get_contents('php://input');
        $pts = json_decode($body, true);
        if (!is_array($pts) || !count($pts)) { echo json_encode(['ok' => false, 'err' => 'data']); return; }
        $validActs = array_map(fn($a) => (int) $a['ID'], $e['ScheduleActions'] ?? []);
        $norm = [];
        foreach ($pts as $p) {
            $h = (int) ($p['h'] ?? -1); $m = (int) ($p['m'] ?? -1); $a = (int) ($p['actionId'] ?? -1);
            if ($h < 0 || $h > 23 || $m < 0 || $m > 59) { echo json_encode(['ok' => false, 'err' => 'time']); return; }
            if (!in_array($a, $validActs, true)) { echo json_encode(['ok' => false, 'err' => 'action', 'a' => $a]); return; }
            $norm[] = ['min' => $h * 60 + $m, 'h' => $h, 'm' => $m, 'a' => $a];
        }
        usort($norm, fn($x, $y) => $x['min'] - $y['min']);
        for ($i = 0; $i < count($norm); $i++) {
            if ($i === 0 && $norm[0]['min'] !== 0) { echo json_encode(['ok' => false, 'err' => 'first0']); return; }   // erster Punkt muss 00:00 sein
            if ($i > 0 && $norm[$i]['min'] <= $norm[$i - 1]['min']) { echo json_encode(['ok' => false, 'err' => 'order']); return; }
        }
        $curCount = 0; $groupExists = false;
        foreach ($e['ScheduleGroups'] ?? [] as $g) if ((int) $g['ID'] === $gid) { $curCount = count($g['Points'] ?? []); $groupExists = true; }
        if (!$groupExists) { echo json_encode(['ok' => false, 'err' => 'group']); return; }
        if (!$dry) {
            $n = count($norm);
            for ($i = 0; $i < $n; $i++) IPS_SetEventScheduleGroupPoint($id, $gid, $i, $norm[$i]['h'], $norm[$i]['m'], 0, $norm[$i]['a']);
            for ($i = $n; $i < $curCount; $i++) IPS_SetEventScheduleGroupPoint($id, $gid, $i, -1, 0, 0, 0);   // Überzahl löschen (ungültige Zeit)
        }
        echo json_encode(['ok' => true, 'dry' => $dry, 'group' => $gid, 'points' => count($norm), 'removed' => max(0, $curCount - count($norm))]);
        return;
    }

    echo json_encode(['ok' => false, 'err' => 'op']);
    return;
}

// ---- Rollos/Beschattung (shading-Widget): IPSShadowing-Geräte lesen (frei) ----
//      Proxy auf das Backend-Skript "LVB_ShadingAPI" (Ident unter #23491). Schreiben laeuft
//      ueber ?api=setvar (RequestAction auf die IPSShadowing-Steuervariablen).
if ($api === 'shading') {
    header('Content-Type: application/json; charset=utf-8');
    // Rollo-Kalibrierung adressiert das Rollo ueber seine POSITIONS-Variable (posVid aus op=list),
    // weil op=list die IPSShadowing-ID liefert, nicht die HSSH-Instanz. Hier posVid -> HSSH-Instanz.
    // Rollo adressieren: bevorzugt direkt ueber die HSSH-Instanz-ID (id, wie shadesun/setclose es
    // aus der Session bekommt), sonst ueber die Positions-Variable (pos = posVid aus op=list).
    $hsshList  = array_map('intval', @IPS_GetInstanceListByModuleID('{A9645ED8-CB55-43B8-869B-BFF6ACFC8DC1}') ?: []);
    $hsshByPos = function (int $pos) use ($hsshList): int {
        if ($pos <= 0) { return 0; }
        foreach ($hsshList as $iid) {
            if ((int) @IPS_GetProperty($iid, 'PositionId') === $pos) { return (int) $iid; }
        }
        // Seit der IPSShadowing-Abloesung fahren die Rollos NATIV ueber den Treiber; eine
        // gebundene Fremd-Positionsvariable gibt es nicht mehr, PositionId steht ueberall auf 0.
        // Damit fand die Suche oben nichts, calTarget() lieferte 0 und der Kalibrier-Aufruf
        // endete in {"ok":false,"err":"inst"} - kein Rollo fuhr, an KEINEM Fenster.
        // Adressiert wird jetzt zusaetzlich ueber die Positions-Variable des MODULS (Ident
        // 'Position'). Sie liegt nicht zwingend direkt unter der Instanz (Variablengruppen),
        // deshalb wird der Teilbaum durchsucht.
        foreach ($hsshList as $iid) {
            $stack = [(int) $iid];
            while ($stack) {
                $n = array_pop($stack);
                foreach (IPS_GetChildrenIDs($n) as $c) {
                    if (IPS_VariableExists($c)) {
                        if ($c === $pos && IPS_GetObject($c)['ObjectIdent'] === 'Position') { return (int) $iid; }
                        continue;
                    }
                    $stack[] = $c;
                }
            }
        }
        return 0;
    };
    $calTarget = function () use ($hsshList, $hsshByPos): int {
        $id = (int) ($_GET['id'] ?? 0);
        if ($id > 0 && in_array($id, $hsshList, true)) { return $id; }   // direkte HSSH-Instanz (Session)
        return $hsshByPos((int) ($_GET['pos'] ?? 0));                    // sonst ueber Positions-Variable
    };
    // op=log: HomeSuite-Gesamtlog (alle Raeume) ueber den Hub aggregieren (nicht das Legacy-Skript).
    if (($_GET['op'] ?? '') === 'log') {
        $hub = (int) (@IPS_GetInstanceListByModuleID('{A0C082B4-9E74-430E-BD97-F9CEBB364257}')[0] ?? 0);
        if ($hub <= 0 || !function_exists('HSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'hub']); return; }
        echo HSH_Manage($hub, json_encode(['op' => 'shadeLog', 'args' => ['limit' => (int) ($_GET['limit'] ?? 300)]]));
        return;
    }
    // op=zonecfg: Automatik-Bindung EINER Zone gebuendelt lesen (frei) — fuer die Widgets
    // shadedoors / shadesens / shadearm. Liefert je Eintrag AUFGELOEST (Name + aktueller Wert),
    // damit das Widget nicht drei weitere Abfragen braucht:
    //   doors[] = Tuerkontakte mit Live-Zustand (offen?),
    //   env{}   = Sensor-Bindungen mit Herkunft (own = eigene Wahl, sonst Haus-Vorgabe vom Hub),
    //   armed   = scharf/Schatten der Zone, hubMode = 0 Aus / 1 Auto / 2 Scharf (Hub hat Vorrang).
    if (($_GET['op'] ?? '') === 'zonecfg') {
        $iid = $calTarget();
        if ($iid <= 0 || !function_exists('HSSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'inst']); return; }
        $cfgR = json_decode((string) @HSSH_Manage($iid, json_encode(['op' => 'getConfig'])), true);
        $cfg  = is_array($cfgR) ? ($cfgR['config'] ?? $cfgR) : [];
        $vinfo = function (int $vid) {
            if ($vid <= 0 || !@IPS_VariableExists($vid)) { return null; }
            $v = @GetValue($vid);
            return ['id' => $vid, 'name' => @IPS_GetName(@IPS_GetParent($vid)) . ' · ' . @IPS_GetName($vid),
                    'val' => is_bool($v) ? ($v ? 1 : 0) : $v, 'bool' => is_bool($v)];
        };
        $doors = [];
        foreach ((array) ($cfg['doorIds'] ?? []) as $d) {
            $i = $vinfo((int) $d);
            if ($i !== null) { $i['open'] = (bool) $i['val']; $doors[] = $i; }
        }
        // Herkunft je Sensor: eigene Instanz-Property > 0 => eigene Wahl, sonst Hub-Vorgabe.
        $envMap = ['sunAzId' => 'EnvSunAzId', 'sunElId' => 'EnvSunElId', 'windId' => 'EnvWindId',
                   'rainId' => 'EnvRainId', 'brightId' => 'EnvBrightId'];
        $env = [];
        foreach ($envMap as $k => $prop) {
            $eff = (int) (($cfg['env'][$k] ?? 0));
            $own = (int) @IPS_GetProperty($iid, $prop);
            $env[$k] = ['own' => ($own > 0), 'info' => $vinfo($eff)];
        }
        // Temperatur-Fuehler gehoeren dem ROLLO (jeder Raum hat einen eigenen), die
        // SCHWELLEN kommen aus dem geteilten Profil. Beide getrennt ausliefern, damit
        // das Widget zeigen kann, was woher stammt.
        $tg   = is_array($cfg['tempGate'] ?? null) ? $cfg['tempGate'] : [];
        $temp = ['in' => $vinfo((int) ($tg['sensorId'] ?? 0)), 'out' => $vinfo((int) ($tg['outSensorId'] ?? 0)),
                 'aboveC' => $tg['aboveC'] ?? null, 'outAboveC' => $tg['outAboveC'] ?? null,
                 'requireSun' => (bool) ($tg['requireSun'] ?? true)];
        $hub  = (int) (@IPS_GetInstanceListByModuleID('{A0C082B4-9E74-430E-BD97-F9CEBB364257}')[0] ?? 0);
        $hmv  = $hub > 0 ? (int) @IPS_GetObjectIDByIdent('ArmShadingMode', $hub) : 0;
        echo json_encode(['ok' => true, 'id' => $iid,
            'name'    => @IPS_GetName(@IPS_GetParent($iid)) . ' · ' . @IPS_GetName($iid),
            'doors'   => $doors, 'env' => $env, 'temp' => $temp,
            'armed'   => (bool) @IPS_GetProperty($iid, 'Armed'),
            'hubMode' => $hmv > 0 ? (int) @GetValue($hmv) : null]);
        return;
    }
    // op=tempvars: Temperatur-Variablen des Hauses als Auswahl (frei lesen). Erkannt ueber
    // das Variablenprofil (~Temperature o. Ae.), sonst ueber den Namen - analog zur
    // Kontakt-Erkennung des Hubs, nur fuer Zahlenwerte statt Boolean.
    if (($_GET['op'] ?? '') === 'tempvars') {
        $out = [];
        foreach (@IPS_GetVariableList() ?: [] as $vid) {
            $v = @IPS_GetVariable($vid);
            if (!$v || !in_array((int) $v['VariableType'], [1, 2], true)) { continue; } // int/float
            $prof = ($v['VariableCustomProfile'] !== '') ? $v['VariableCustomProfile'] : $v['VariableProfile'];
            $name = (string) @IPS_GetName($vid);
            $par  = (int) @IPS_GetParent($vid);
            $inst = $par > 0 ? (string) @IPS_GetName($par) : $name;
            $hay = $name . ' ' . $inst;
            // AUSSCHLIESSEN, sonst ertrinkt die Auswahl in Fehltreffern: Lampen-Farbtemperatur,
            // Geraete-Innentemperaturen (Batterie/CPU/Wechselrichter), Boden-/Wasserfuehler.
            // Der Nutzer sucht hier einen RAUMFUEHLER, nichts anderes.
            if (preg_match('/farbtemp|color ?temp|colour ?temp|batterie|battery|cpu|kelvin|soil|boden|wasser|water|vorlauf|ruecklauf|rücklauf|abgas|kessel|puffer|kollektor|speicher|taupunkt|gefuehlt|gefühlt|soll|target/i', $hay)) { continue; }
            $isT  = (bool) preg_match('/^~?Temperature/i', (string) $prof)
                 || (bool) preg_match('/\btemperatur\b|\btemperature\b|\btemp\b/i', $hay);
            if (!$isT) { continue; }
            $out[] = ['id' => (int) $vid, 'instance' => $inst, 'var' => $name, 'val' => @GetValue($vid)];
        }
        usort($out, static function ($a, $b) { return strnatcasecmp($a['instance'] . $a['var'], $b['instance'] . $b['var']); });
        echo json_encode(['ok' => true, 'count' => count($out), 'vars' => $out]);
        return;
    }
    // op=setenv: EINE Sensor-Bindung der Zone setzen bzw. auf die Haus-Vorgabe zuruecksetzen
    // (Token, schreibend – reine Konfiguration, kein Geraetebefehl). vid=0 => Property auf 0,
    // damit wieder der Hub-Wert gilt (Rangfolge: eigene Property > Hub > Standard).
    if (($_GET['op'] ?? '') === 'setenv') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $iid  = $calTarget();
        $map  = ['sunAzId' => 'EnvSunAzId', 'sunElId' => 'EnvSunElId', 'windId' => 'EnvWindId',
                 'rainId' => 'EnvRainId', 'brightId' => 'EnvBrightId'];
        $sk   = (string) ($_GET['sk'] ?? '');
        $vid  = max(0, (int) ($_GET['vid'] ?? 0));
        if ($iid <= 0 || !isset($map[$sk])) { echo json_encode(['ok' => false, 'err' => 'arg']); return; }
        if ($vid > 0 && !@IPS_VariableExists($vid)) { echo json_encode(['ok' => false, 'err' => 'var']); return; }
        @IPS_SetProperty($iid, $map[$sk], $vid);
        @IPS_ApplyChanges($iid);
        echo json_encode(['ok' => true, 'sk' => $sk, 'vid' => $vid]);
        return;
    }
    // op=caltimes: aktuell in HomeSuite (ShadingDevice) gespeicherte Fahrzeiten lesen (frei) — Kalibrier-Widget.
    // Adressiert das Rollo ueber seine Positions-Variable (pos = posVid aus op=list) -> HSSH-Instanz.
    if (($_GET['op'] ?? '') === 'caltimes') {
        $iid = $calTarget();
        echo json_encode(['ok' => ($iid > 0),
            'timeOpening' => (int) @IPS_GetProperty($iid, 'TimeOpening'),
            'timeClosing' => (int) @IPS_GetProperty($iid, 'TimeClosing')]);
        return;
    }
    // op=setclose: per-Rollo Sonnen-Schliessgrad (SunClose %) setzen (Token, schreibend – reiner Config-Wert, kein Geraetebefehl).
    if (($_GET['op'] ?? '') === 'setclose') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $iid = (int) ($_GET['id'] ?? 0);
        $pct = max(0, min(100, (int) ($_GET['pct'] ?? 0)));
        if ($iid <= 0 || !function_exists('HSSH_SetControl')) { echo json_encode(['ok' => false, 'err' => 'inst']); return; }
        $ok = @HSSH_SetControl($iid, 'SunClose', (string) $pct);
        echo json_encode(['ok' => (bool) $ok, 'pct' => $pct]);
        return;
    }
    // op=calmove|calstop|calsettime: Rollo-Kalibrierung (Token, schreibend/Geraetebefehl) -> ShadingDevice-RPC.
    // Adressiert das Rollo ueber die Positions-Variable (pos = posVid aus op=list) -> HSSH-Instanz.
    if (in_array(($_GET['op'] ?? ''), ['calmove', 'calstop', 'calsettime', 'calabort'], true)) {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $iid = $calTarget();
        if ($iid <= 0 || !function_exists('HSSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'inst']); return; }
        // calabort = "Verwerfen": gibt den Kalibrier-Lock im Modul wieder frei (sonst
        // bliebe die Automatik bis zum Timeout gesperrt).
        $map  = ['calmove' => 'calMove', 'calstop' => 'calStop', 'calsettime' => 'calSetTime', 'calabort' => 'calAbort'];
        $op   = (string) $_GET['op'];
        $args = [];
        if ($op === 'calmove')    { $args = ['dir' => (string) ($_GET['dir'] ?? '')]; }
        if ($op === 'calsettime') { $args = ['dir' => (string) ($_GET['dir'] ?? ''), 'seconds' => (int) ($_GET['sec'] ?? 0)]; }
        echo @HSSH_Manage($iid, json_encode(['op' => $map[$op], 'args' => $args]));
        return;
    }
    $sid = (int) (@IPS_GetObjectIDByIdent('LVB_ShadingAPI', 23491) ?: 0);
    if ($sid <= 0 || !IPS_ScriptExists($sid)) { echo json_encode(['ok' => false, 'err' => 'backend']); return; }
    echo IPS_RunScriptWaitEx($sid, ['op' => (string) ($_GET['op'] ?? 'list'), 'device' => (string) ($_GET['device'] ?? ''), 'profile' => (string) ($_GET['profile'] ?? '')]);
    return;
}

// ---- Maeher (MowerDevice HSMW): op=list|getall frei lesen ----
//      Liest ueber die HomeSuite-RPC (HSMW_GetState). Steuern laeuft ueber ?api=setvar
//      auf die Kommando-/Setpoint-Controls (Start/Park/Pause/Resume/ConfirmError/
//      CuttingHeight/Headlight) -> RequestAction -> armed-Gate im Modul.
if ($api === 'mower') {
    $HSMW = '{D1FB2D11-21F3-4B22-8341-E88D512A9B61}';
    $op   = (string) ($_GET['op'] ?? 'getall');
    $list = array_map('intval', @IPS_GetInstanceListByModuleID($HSMW) ?: []);

    // Echte Live-Karte (Leaflet/Esri-Satellit + Bewegungspfad + Geofence) — SELF-CONTAINED
    // (kein automower.class.maps.php mehr). Positionen/Geofence/Aktivitaet ueber HSMW_Manage.
    if ($op === 'map') {
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { http_response_code(404); echo 'unknown mower'; return; }
        header('Content-Type: text/html; charset=utf-8');
        try {
            $md = function_exists('HSMW_Manage')
                ? json_decode((string) @HSMW_Manage($iid, json_encode(['op' => 'mapData'])), true)
                : null;
            $positions = (is_array($md) && !empty($md['positions'])) ? $md['positions'] : [];
            $geofence  = (is_array($md) && !empty($md['geofence']))  ? $md['geofence']  : null;
            $act       =  is_array($md) ? (int) ($md['activity'] ?? 0) : 0;
            // Aktivitaetsfarbe wie das HSMW.Activity-Profil.
            // Farbe nach Taetigkeit - bisher die einzige Quelle, also fuer beide
            // Maeher identisch. Wer zwei Geraete auf getrennten Karten sieht, will
            // sie unterscheiden koennen; deshalb sind Pfad-, Marker- und
            // Geofence-Farbe jetzt ueberschreibbar.
            $colors = [0 => '#9AA5AD', 1 => '#9AA5AD', 2 => '#2ECC71', 3 => '#1ABC9C',
                       4 => '#3498DB', 5 => '#1ABC9C', 6 => '#9AA5AD', 7 => '#E67E22'];
            $color  = $colors[$act] ?? '#2ECC71';
            $hexOk  = fn($c) => preg_match('/^#[0-9a-fA-F]{3,8}$/', (string) $c) ? (string) $c : null;
            // Reihenfolge: Adresse schlaegt Instanz-Eigenschaft schlaegt Taetigkeitsfarbe.
            // So laesst sich eine Karte im Seitenentwurf abweichend faerben, ohne die
            // Einstellung des Geraets zu aendern.
            $prop   = fn(string $n) => (string) @IPS_GetProperty($iid, $n);
            $color  = $hexOk($_GET['color'] ?? '')  ?? $hexOk($prop('KartenFarbe'))  ?? $color;
            $mcol   = $hexOk($_GET['marker'] ?? '') ?? $hexOk($prop('KartenMarker'));
            $fcol   = $hexOk($_GET['fence'] ?? '')  ?? $hexOk($prop('KartenZaun'));
            $pz     = (int) @IPS_GetProperty($iid, 'KartenZoom');
            $zoom   = (int) ($_GET['zoom'] ?? ($pz > 0 ? $pz : 18));
            require_once '/var/lib/symcon/modules/HomeSuite/MowerDevice/mapRenderer.php';
            echo renderPositionMap($positions, $geofence, $color, (int) ($_GET['w'] ?? 900), (int) ($_GET['h'] ?? 600),
                                   $zoom, $mcol, $fcol);
        } catch (\Throwable $e) {
            echo '<!doctype html><body style="margin:0;font:13px system-ui;color:#8a9098;display:flex;align-items:center;justify-content:center;height:100vh">Karte nicht verfuegbar</body>';
        }
        return;
    }

    header('Content-Type: application/json; charset=utf-8');

    // Direkt aus den Statusvariablen lesen (zuverlaessiger als der GetState-Snapshot,
    // der anders schluesselt) — Wert + formatierter Profil-Text.
    $val = function ($iid, $ident) {
        $vid = @IPS_GetObjectIDByIdent($ident, $iid);
        return $vid ? @GetValue($vid) : null;
    };
    $fmt = function ($iid, $ident) {
        $vid = @IPS_GetObjectIDByIdent($ident, $iid);
        return $vid ? (string) @GetValueFormatted($vid) : '';
    };
    $armedOf = function ($iid) {
        if (!function_exists('HSMW_Manage')) return false;
        $d = json_decode((string) @HSMW_Manage($iid, json_encode(['op' => 'getConfig'])), true);
        return (bool) ($d['config']['armed'] ?? false);
    };

    if ($op === 'list') {
        $out = [];
        foreach ($list as $iid) {
            $out[] = ['id' => $iid, 'name' => IPS_GetName($iid), 'activity' => $fmt($iid, 'Activity')];
        }
        echo json_encode(['ok' => true, 'mowers' => $out]);
        return;
    }

    if ($op === 'getall') {
        $out = [];
        foreach ($list as $iid) {
            $out[] = [
                'id' => $iid, 'name' => IPS_GetName($iid),
                'activity' => (int) $val($iid, 'Activity'), 'activityText' => $fmt($iid, 'Activity'),
                'state' => (int) $val($iid, 'State'), 'stateText' => $fmt($iid, 'State'),
                'mode' => (string) $val($iid, 'Mode'),
                'battery' => (int) $val($iid, 'Battery'),
                'online' => (bool) $val($iid, 'Online'),
                'inChargingStation' => (bool) $val($iid, 'InChargingStation'),
                'errorText' => (string) $val($iid, 'ErrorText'),
                'nextStart' => (int) $val($iid, 'NextStart'),
                'nextStartText' => $fmt($iid, 'NextStart'),
                'runningTime' => (int) $val($iid, 'RunningTime'),
                'collisions' => (int) $val($iid, 'Collisions'),
                'lat' => (float) $val($iid, 'Lat'), 'lng' => (float) $val($iid, 'Lng'),
                'cuttingHeight' => (int) $val($iid, 'CuttingHeight'),
                'headlight' => (int) $val($iid, 'Headlight'), 'headlightText' => $fmt($iid, 'Headlight'),
                'autoMode' => (int) $val($iid, 'AutoMode'),
                'recMow' => (bool) @GetValue(57646), 'recText' => (string) @GetValueFormatted(57646), // Regen-Empfehlung (global)
                'mission' => (string) $val($iid, 'Mission'),
                'chargingCycles' => (int) $val($iid, 'ChargingCycles'),
                'bladeHours' => (int) $val($iid, 'BladeHours'),
                'searchHours' => (int) $val($iid, 'SearchHours'),
                'cuttingTime' => (int) $val($iid, 'CuttingTime'),
                'chargingTime' => (int) $val($iid, 'ChargingTime'),
                'searchTime' => (int) $val($iid, 'SearchTime'),
                'efficiency' => (float) $val($iid, 'Efficiency'),
                'bladeUsagePct' => (float) $val($iid, 'BladeUsagePct'),
                'errorCode' => (int) $val($iid, 'ErrorCode'),
                'model' => (string) $val($iid, 'Model'), 'firmware' => (string) $val($iid, 'Firmware'),
                'updateRequired' => (bool) $val($iid, 'UpdateRequired'),
                'armed' => $armedOf($iid),
                // Steuern via ?api=setvar (billige Ident-Aufloesung).
                'vars' => [
                    'Start'         => (int) (@IPS_GetObjectIDByIdent('Start', $iid) ?: 0),
                    'Park'          => (int) (@IPS_GetObjectIDByIdent('Park', $iid) ?: 0),
                    'Pause'         => (int) (@IPS_GetObjectIDByIdent('Pause', $iid) ?: 0),
                    'Resume'        => (int) (@IPS_GetObjectIDByIdent('Resume', $iid) ?: 0),
                    'ConfirmError'  => (int) (@IPS_GetObjectIDByIdent('ConfirmError', $iid) ?: 0),
                    'CuttingHeight' => (int) (@IPS_GetObjectIDByIdent('CuttingHeight', $iid) ?: 0),
                    'Headlight'     => (int) (@IPS_GetObjectIDByIdent('Headlight', $iid) ?: 0),
                    'AutoMode'      => (int) (@IPS_GetObjectIDByIdent('AutoMode', $iid) ?: 0),
                ],
            ];
        }
        echo json_encode(['ok' => true, 'mowers' => $out]);
        return;
    }

    // Mähplan lesen (frei): {ok,timers:[{start,duration,days{},missionId}],workAreas:[]}
    if ($op === 'timers') {
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'unknown mower']); return; }
        if (!function_exists('HSMW_Manage')) { echo json_encode(['ok' => false, 'err' => 'no module']); return; }
        echo (string) @HSMW_Manage($iid, json_encode(['op' => 'getTimers']));
        return;
    }

    // Fehlerhistorie lesen (frei): {ok,messages:[{time,code,text}]}
    if ($op === 'messages') {
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'unknown mower']); return; }
        if (!function_exists('HSMW_Manage')) { echo json_encode(['ok' => false, 'err' => 'no module']); return; }
        echo (string) @HSMW_Manage($iid, json_encode(['op' => 'getMessages']));
        return;
    }

    // Mähplan schreiben (token; nur wirksam wenn Instanz scharf, sonst shadow):
    // POST JSON {timers:[...]} ODER [...] an ?api=mower&op=settimers&id=<id>&key=TOKEN
    if ($op === 'settimers') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'unknown mower']); return; }
        if (!function_exists('HSMW_Manage')) { echo json_encode(['ok' => false, 'err' => 'no module']); return; }
        $body   = json_decode((string) @file_get_contents('php://input'), true);
        $timers = (is_array($body) && isset($body['timers']) && is_array($body['timers']))
            ? $body['timers'] : (is_array($body) ? $body : []);
        echo (string) @HSMW_Manage($iid, json_encode(['op' => 'setTimers', 'args' => ['timers' => $timers]]));
        return;
    }

    echo json_encode(['ok' => false, 'err' => 'op']);
    return;
}

// ---- Audio/Media (AudioZone HSAU): op=list|getall|groups frei lesen; op=manage token ----
//      Liest ueber die HomeSuite-RPC (HSAU_GetState/_Manage) der AudioZone-Instanzen.
//      Steuern (Transport/Volume/...) laeuft ueber ?api=setvar auf die AudioZone-Controls;
//      Gruppen/Quellen/Play-Source ueber op=manage (token). CoverUri wird als BARE URL
//      geliefert (aus dem IPSSonos-HTMLBox-Snippet extrahiert), damit das image-Widget bindet.
if ($api === 'audio') {
    header('Content-Type: application/json; charset=utf-8');
    $HSAU  = '{C4F2639D-2A87-453D-8175-B586BF605A38}'; // AudioZone (parentless, Sonos)
    $HSAUX = '{053E7017-584E-4F62-A246-EBA6CE3DE034}'; // AudioZoneBridged (HEOS u. a.)
    $op   = (string) ($_GET['op'] ?? 'getall');
    $list = array_map('intval', array_merge(
        @IPS_GetInstanceListByModuleID($HSAU) ?: [],
        @IPS_GetInstanceListByModuleID($HSAUX) ?: []
    ));

    $coverUrl = function ($s) {
        $s = (string) $s;
        if ($s === '') return '';
        if (preg_match('/src="([^"]*)"/i', $s, $m)) return $m[1];   // ~HTMLBox <img src="...">
        return (strpos($s, '<') === false) ? $s : '';               // bereits bare URL?
    };
    // Prefix je nach Modul (HSAU parentless vs. HSAUX bridged).
    $pfx = function ($iid) use ($HSAUX) {
        $g = (string) (@IPS_GetInstance($iid)['ModuleInfo']['ModuleID'] ?? '');
        return $g === $HSAUX ? 'HSAUX' : 'HSAU';
    };
    $stateOf = function ($iid) use ($pfx) {
        $fn = $pfx($iid) . '_GetState';
        if (!function_exists($fn)) return [];
        $d = json_decode((string) @$fn($iid), true);
        return is_array($d) ? $d : [];
    };
    $armedOf = function ($iid) use ($pfx) {
        $fn = $pfx($iid) . '_Manage';
        if (!function_exists($fn)) return false;
        $d = json_decode((string) @$fn($iid, json_encode(['op' => 'getConfig'])), true);
        return (bool) ($d['config']['armed'] ?? false);
    };

    // Eigene Player-Kennung (RINCON_...) einer Zone. Sie steht in der Treiber-Konfiguration
    // und ist die einzige Groesse, mit der sich Sonos-Zonen gruppieren lassen - Namen und
    // Instanz-IDs kennt das Geraet nicht. Ohne sie kann das Frontend nur ANZEIGEN, wer mit
    // wem spielt, aber nichts zusammenschalten.
    $uidOf = function ($iid) use ($pfx) {
        static $cache = [];
        if (isset($cache[$iid])) return $cache[$iid];
        $fn = $pfx($iid) . '_Manage';
        if (!function_exists($fn)) return $cache[$iid] = '';
        $d = json_decode((string) @$fn($iid, json_encode(['op' => 'getConfig'])), true);
        return $cache[$iid] = (string) ($d['config']['rincon'] ?? $d['config']['uid'] ?? '');
    };

    if ($op === 'list') {
        $out = [];
        foreach ($list as $iid) {
            $st = $stateOf($iid);
            $out[] = ['id' => $iid, 'name' => IPS_GetName($iid),
                'uid' => $uidOf($iid),
                'role' => (string) ($st['GroupRole'] ?? 'standalone'),
                'coordinator' => (string) ($st['GroupCoordinator'] ?? '')];
        }
        echo json_encode(['ok' => true, 'rooms' => $out]);
        return;
    }

    if ($op === 'getall') {
        $out = [];
        foreach ($list as $iid) {
            $st = $stateOf($iid);
            $out[] = [
                'id' => $iid, 'name' => IPS_GetName($iid),
                'title' => (string) ($st['Title'] ?? ''), 'artist' => (string) ($st['Artist'] ?? ''),
                'album' => (string) ($st['Album'] ?? ''), 'albumArtist' => (string) ($st['AlbumArtist'] ?? ''),
                'coverUrl' => $coverUrl($st['CoverUri'] ?? ''),
                'playing' => (bool) ($st['PlayState'] ?? false),
                'volume' => (int) ($st['Volume'] ?? 0), 'mute' => (bool) ($st['Mute'] ?? false),
                'power' => (bool) ($st['Power'] ?? false),
                'repeat' => (int) ($st['Repeat'] ?? 0), 'shuffle' => (bool) ($st['Shuffle'] ?? false),
                'positionPct' => (int) ($st['Position'] ?? 0),
                'position' => (string) ($st['PositionTime'] ?? ''), 'duration' => (string) ($st['Duration'] ?? ''),
                'online' => (bool) ($st['Online'] ?? true),
                'armed' => $armedOf($iid),
                'fav' => (int) ($st['SourceFavorite'] ?? 0), 'radio' => (int) ($st['SourceRadio'] ?? 0),
                'playlist' => (int) ($st['SourcePlaylist'] ?? 0),
                'role' => (string) ($st['GroupRole'] ?? 'standalone'),
                'coordinator' => (string) ($st['GroupCoordinator'] ?? ''),
                'uid' => $uidOf($iid),
                // Control-Variablen-IDs zum Steuern via ?api=setvar (billige Ident-Aufloesung).
                'vars' => [
                    'Transport'      => (int) (@IPS_GetObjectIDByIdent('Transport', $iid) ?: 0),
                    'Volume'         => (int) (@IPS_GetObjectIDByIdent('Volume', $iid) ?: 0),
                    'Mute'           => (int) (@IPS_GetObjectIDByIdent('Mute', $iid) ?: 0),
                    'Power'          => (int) (@IPS_GetObjectIDByIdent('Power', $iid) ?: 0),
                    'Repeat'         => (int) (@IPS_GetObjectIDByIdent('Repeat', $iid) ?: 0),
                    'Shuffle'        => (int) (@IPS_GetObjectIDByIdent('Shuffle', $iid) ?: 0),
                    'Position'       => (int) (@IPS_GetObjectIDByIdent('Position', $iid) ?: 0),
                    'SourceFavorite' => (int) (@IPS_GetObjectIDByIdent('SourceFavorite', $iid) ?: 0),
                    'SourceRadio'    => (int) (@IPS_GetObjectIDByIdent('SourceRadio', $iid) ?: 0),
                    'SourcePlaylist' => (int) (@IPS_GetObjectIDByIdent('SourcePlaylist', $iid) ?: 0),
                ],
            ];
        }
        echo json_encode(['ok' => true, 'rooms' => $out]);
        return;
    }

    // ---- SCHREIBEND: Zonen zusammenschalten / trennen -------------------------
    //
    //   ?api=audio&op=group&coord=<InstanzID>&members=<InstanzIDs,kommagetrennt>&key=TOKEN
    //   ?api=audio&op=ungroup&id=<InstanzID>&key=TOKEN
    //
    // Bei Sonos tritt JEDES MITGLIED dem Koordinator bei; der Koordinator selbst tut nichts.
    // Deshalb wird je Mitglied ein eigener Aufruf abgesetzt. Zonen, die nicht genannt sind,
    // bleiben unangetastet - ein Gruppenwechsel soll nicht stillschweigend andere Gruppen
    // aufloesen.
    if ($op === 'group' || $op === 'ungroup') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403);
            echo json_encode(['error' => 'forbidden']);
            return;
        }
        $call = function ($iid, array $payload) use ($pfx) {
            $fn = $pfx($iid) . '_Manage';
            if (!function_exists($fn)) return ['ok' => false, 'error' => 'kein Manage'];
            $r = json_decode((string) @$fn($iid, json_encode($payload)), true);
            return is_array($r) ? $r : ['ok' => false, 'error' => 'keine Antwort'];
        };

        if ($op === 'ungroup') {
            $id = (int) ($_GET['id'] ?? 0);
            if (!in_array($id, $list, true)) {
                http_response_code(404);
                echo json_encode(['error' => 'keine Audiozone']);
                return;
            }
            echo json_encode(['ok' => true, 'id' => $id, 'result' => $call($id, ['op' => 'ungroup'])]);
            return;
        }

        $coord = (int) ($_GET['coord'] ?? 0);
        if (!in_array($coord, $list, true)) {
            http_response_code(404);
            echo json_encode(['error' => 'Koordinator ist keine Audiozone']);
            return;
        }
        $coordUid = $uidOf($coord);
        if ($coordUid === '') {
            echo json_encode(['ok' => false, 'error' => 'Koordinator ohne Player-Kennung (rincon fehlt)']);
            return;
        }
        $members = array_values(array_filter(array_map('intval',
            explode(',', (string) ($_GET['members'] ?? ''))), function ($m) use ($list, $coord) {
                return $m > 0 && $m !== $coord && in_array($m, $list, true);
            }));

        $res = [];
        foreach ($members as $m) {
            $mu = $uidOf($m);
            if ($mu === '') { $res[$m] = ['ok' => false, 'error' => 'ohne Player-Kennung']; continue; }
            $res[$m] = $call($m, ['op' => 'group', 'coordinatorUid' => $coordUid, 'memberUids' => [$mu]]);
        }
        echo json_encode(['ok' => true, 'coordinator' => $coord, 'coordinatorUid' => $coordUid,
                          'members' => $members, 'result' => $res]);
        return;
    }

    if ($op === 'groups') {
        $byUid = [];
        foreach ($list as $iid) {
            $st = $stateOf($iid);
            if ((string) ($st['GroupRole'] ?? '') === 'member') {
                $coord = (string) ($st['GroupCoordinator'] ?? '');
                if ($coord !== '') $byUid[$coord][] = $iid;
            }
        }
        echo json_encode(['ok' => true, 'groups' => $byUid]);
        return;
    }

    if ($op === 'radionow') {                            // Radio: laufender Titel + Song-Cover (lesend)
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $fn = $pfx($iid) . '_Manage';
        echo function_exists($fn) ? $fn($iid, json_encode(['op' => 'radioNow'])) : json_encode(['ok' => false, 'err' => 'prefix']);
        return;
    }

    // op=queue: Warteschlange der Zone (lesend). Cover-Adressen werden wie ueberall auf den
    // Bild-Proxy umgeschrieben - die Sonos-Player liefern relative bzw. player-lokale URLs,
    // die der Browser des Wandtablets sonst nicht laden kann.
    if ($op === 'queue') {
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $fn = $pfx($iid) . '_Manage';
        if (!function_exists($fn)) { echo json_encode(['ok' => false, 'err' => 'prefix']); return; }
        $r = json_decode((string) $fn($iid, json_encode(['op' => 'queue',
            'args' => ['limit' => max(1, min(200, (int) ($_GET['limit'] ?? 60)))]])), true);
        if (is_array($r) && !empty($r['items'])) {
            foreach ($r['items'] as &$it) { if (!empty($it['cover'])) { $it['cover'] = $coverUrl($it['cover']); } }
            unset($it);
        }
        echo json_encode($r ?: ['ok' => false, 'err' => 'empty']);
        return;
    }

    // op=queueplay: Spur der Warteschlange anspringen (Token, schaltend).
    if ($op === 'queueplay') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $fn = $pfx($iid) . '_Manage';
        echo function_exists($fn)
            ? $fn($iid, json_encode(['op' => 'playQueueIndex', 'args' => ['index' => (int) ($_GET['index'] ?? 0)]]))
            : json_encode(['ok' => false, 'err' => 'prefix']);
        return;
    }

    // op=queueremove / queueclear: Titel aus der Warteschlange werfen bzw. alles leeren
    // (Token, schaltend). index ist 0-basiert wie in op=queue.
    if ($op === 'queueremove' || $op === 'queueclear') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $fn = $pfx($iid) . '_Manage';
        if (!function_exists($fn)) { echo json_encode(['ok' => false, 'err' => 'prefix']); return; }
        echo ($op === 'queueclear')
            ? $fn($iid, json_encode(['op' => 'queueClear', 'args' => []]))
            : $fn($iid, json_encode(['op' => 'queueRemove', 'args' => ['index' => (int) ($_GET['index'] ?? -1)]]));
        return;
    }

    if ($op === 'radiostations') {                       // Radio: Senderliste (fuer Direkt-Auswahl)
        $iid = (int) ($_GET['id'] ?? ($list[0] ?? 0));
        $fn = $pfx($iid) . '_Manage';
        echo function_exists($fn) ? $fn($iid, json_encode(['op' => 'radioStations'])) : json_encode(['ok' => false, 'err' => 'prefix']);
        return;
    }

    if ($op === 'playdirect') {                          // Radio: HQ-Direktstream spielen (token)
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'err' => 'forbidden']);
            return;
        }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $fn = $pfx($iid) . '_Manage';
        $st = (string) ($_GET['station'] ?? '');
        echo function_exists($fn) ? $fn($iid, json_encode(['op' => 'playDirect', 'args' => ['station' => $st]])) : json_encode(['ok' => false, 'err' => 'prefix']);
        return;
    }

    if ($op === 'medialib') {                            // Bibliothek browsen/suchen (Hub-Provider)
        $hub = (int) (@IPS_GetInstanceListByModuleID('{A0C082B4-9E74-430E-BD97-F9CEBB364257}')[0] ?? 0);
        if ($hub <= 0 || !function_exists('HSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'hub']); return; }
        $sub = (string) ($_GET['sub'] ?? 'providers');
        $map = ['providers' => 'mediaProviders', 'browse' => 'mediaBrowse', 'search' => 'mediaSearch'];
        $hop = $map[$sub] ?? 'mediaProviders';
        // limit MUSS durchgereicht werden: ohne greift stumm der Hub-Standard, und eine
        // grosse Playlist sprengt dann den 1-MB-Ausgabepuffer des Symcon-Hooks - die Antwort
        // kommt gar nicht erst an. Nach oben gedeckelt, damit das auch niemand aushebelt.
        $lim  = (int) ($_GET['limit'] ?? 100);
        $args = ['provider' => (string) ($_GET['provider'] ?? ''), 'container' => (string) ($_GET['container'] ?? ''),
            'query' => (string) ($_GET['query'] ?? ''), 'offset' => (int) ($_GET['offset'] ?? 0),
            'limit' => max(1, min(300, $lim))];
        echo HSH_Manage($hub, json_encode(['op' => $hop, 'args' => $args]));
        return;
    }

    if ($op === 'playcontent') {                         // Inhalt aufloesen (Hub) + auf Zone spielen (token)
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return;
        }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $hub = (int) (@IPS_GetInstanceListByModuleID('{A0C082B4-9E74-430E-BD97-F9CEBB364257}')[0] ?? 0);
        $body = (string) ($_POST['data'] ?? ''); if ($body === '') $body = (string) file_get_contents('php://input');
        $ref = json_decode($body, true); if (!is_array($ref)) { echo json_encode(['ok' => false, 'err' => 'ref']); return; }
        // 1) ueber Hub aufloesen (uri fuellen)
        $res = json_decode((string) @HSH_Manage($hub, json_encode(['op' => 'mediaResolve',
            'args' => ['provider' => (string) ($_GET['provider'] ?? ($ref['provider'] ?? '')), 'ref' => $ref]])), true);
        $resolved = $res['ref'] ?? $ref;
        // 2) auf der Zone abspielen
        $fn = $pfx($iid) . '_Manage';
        echo function_exists($fn) ? $fn($iid, json_encode(['op' => 'playContent', 'args' => ['ref' => $resolved]]))
            : json_encode(['ok' => false, 'err' => 'prefix']);
        return;
    }

    if ($op === 'playlist') {                            // Playlist anlegen/erweitern/loeschen (token)
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return;
        }
        $hub = (int) (@IPS_GetInstanceListByModuleID('{A0C082B4-9E74-430E-BD97-F9CEBB364257}')[0] ?? 0);
        if ($hub <= 0 || !function_exists('HSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'hub']); return; }
        $sub = (string) ($_GET['sub'] ?? 'canwrite');
        $map = ['canwrite' => 'mediaCanWrite', 'list' => 'mediaPlaylistList',
                'create' => 'mediaPlaylistCreate',
                'add' => 'mediaPlaylistAdd', 'delete' => 'mediaPlaylistDelete'];
        $hop = $map[$sub] ?? 'mediaCanWrite';
        $args = [];
        if ($sub === 'list') {
            $args = ['provider' => (string) ($_GET['provider'] ?? '')];
        } elseif ($sub !== 'canwrite') {
            $body = (string) ($_POST['data'] ?? ''); if ($body === '') $body = (string) file_get_contents('php://input');
            $in = json_decode($body, true);
            if (!is_array($in)) { echo json_encode(['ok' => false, 'err' => 'body']); return; }
            $args = ['provider' => (string) ($in['provider'] ?? ''), 'name' => (string) ($in['name'] ?? ''),
                     'id' => (string) ($in['id'] ?? ''), 'refs' => (array) ($in['refs'] ?? [])];
        }
        echo HSH_Manage($hub, json_encode(['op' => $hop, 'args' => $args]));
        return;
    }

    if ($op === 'playcontainer') {                       // ganze Sammlung -> Zone (token)
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return;
        }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $hub = (int) (@IPS_GetInstanceListByModuleID('{A0C082B4-9E74-430E-BD97-F9CEBB364257}')[0] ?? 0);
        if ($hub <= 0 || !function_exists('HSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'hub']); return; }
        $body = (string) ($_POST['data'] ?? ''); if ($body === '') $body = (string) file_get_contents('php://input');
        $in = json_decode($body, true);
        if (!is_array($in) || !isset($in['ref'])) { echo json_encode(['ok' => false, 'err' => 'ref']); return; }
        $prov = (string) ($_GET['provider'] ?? ($in['ref']['provider'] ?? ''));
        $max  = max(1, min(500, (int) ($in['max'] ?? 200)));
        // 1) Hub loest den Container in die geordnete Titelliste auf
        $tr = json_decode((string) @HSH_Manage($hub, json_encode(['op' => 'mediaTracks',
            'args' => ['provider' => $prov, 'ref' => $in['ref'], 'max' => $max]])), true);
        if (!is_array($tr) || empty($tr['ok'])) {
            echo json_encode(['ok' => false, 'err' => 'tracks', 'detail' => $tr['error'] ?? '']); return;
        }
        // 2) die Zone reiht sie ein
        $fn = $pfx($iid) . '_Manage';
        if (!function_exists($fn)) { echo json_encode(['ok' => false, 'err' => 'prefix']); return; }
        $res = json_decode((string) $fn($iid, json_encode(['op' => 'playContainer', 'args' => [
            'tracks' => $tr['tracks'], 'mode' => (string) ($in['mode'] ?? 'replace'),
            'dryRun' => (bool) ($in['dryRun'] ?? false), 'title' => (string) ($in['title'] ?? ''),
        ]])), true);
        if (is_array($res)) { $res['truncated'] = (bool) ($tr['truncated'] ?? false); $res['skipped'] = (int) ($tr['skipped'] ?? 0); }
        echo json_encode($res ?: ['ok' => false, 'err' => 'zone']);
        return;
    }

    if ($op === 'manage') {                              // Gruppen/Quellen/PlaySource (token)
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'err' => 'forbidden']);
            return;
        }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $body = (string) ($_POST['data'] ?? '');
        if ($body === '') $body = (string) file_get_contents('php://input');
        $fn = $pfx($iid) . '_Manage';
        echo function_exists($fn) ? $fn($iid, $body !== '' ? $body : '{}') : json_encode(['ok' => false, 'err' => 'prefix']);
        return;
    }

    echo json_encode(['ok' => false, 'err' => 'op']);
    return;
}

// ---- Licht (HomeSuite LightDevice HSLT): getall raumgruppiert (lesen), manage (token) ----
if ($api === 'light') {
    header('Content-Type: application/json; charset=utf-8');
    $HSLT = '{B7E1C3A4-5D62-4F08-9A1E-2C7D6B4F0E93}';
    $op   = (string) ($_GET['op'] ?? 'getall');
    $list = array_map('intval', @IPS_GetInstanceListByModuleID($HSLT) ?: []);

    // Raum/Geschoss aus der Elternschaft (Zuordnung = Elternschaft).
    $roomOf = function ($iid) {
        $parent = (int) @IPS_GetParent($iid);
        $pName  = $parent > 0 ? (string) @IPS_GetName($parent) : '';
        $pIdent = $parent > 0 ? (string) (@IPS_GetObject($parent)['ObjectIdent'] ?? '') : '';
        // Direkt unter einer HSLT-Geschoss-Haltekategorie => noch kein Raum
        if (strpos($pIdent, 'HSLT_FLOOR_') === 0) {
            return ['room' => '', 'roomId' => 0, 'floor' => $pName];
        }
        $gp = $parent > 0 ? (int) @IPS_GetParent($parent) : 0;
        return ['room' => $pName, 'roomId' => $parent, 'floor' => $gp > 0 ? (string) @IPS_GetName($gp) : ''];
    };
    $stateOf = function ($iid) {
        if (!function_exists('HSLT_Manage')) return ['state' => [], 'caps' => [], 'driverActive' => false];
        $d = json_decode((string) @HSLT_Manage($iid, json_encode(['op' => 'readState'])), true);
        return is_array($d) ? $d : ['state' => [], 'caps' => [], 'driverActive' => false];
    };

    if ($op === 'getall') {
        $out = [];
        foreach ($list as $iid) {
            $rs = $stateOf($iid);
            $st = is_array($rs['state'] ?? null) ? $rs['state'] : [];
            $rm = $roomOf($iid);
            $out[] = [
                'id'    => $iid,
                'name'  => (string) IPS_GetName($iid),
                'room'  => $rm['room'], 'roomId' => $rm['roomId'], 'floor' => $rm['floor'],
                'on'    => (bool) ($st['on'] ?? false),
                'level' => (int) ($st['level'] ?? -1),
                'color' => (int) ($st['color'] ?? -1),
                'cct'   => (int) ($st['cct'] ?? 0),
                'watt'  => (float) ($st['watt'] ?? -1),
                'reachable' => (bool) ($st['reachable'] ?? true),
                'caps'  => is_array($rs['caps'] ?? null) ? $rs['caps'] : [],
                'armed' => (bool) ($rs['armed'] ?? false),
                // Steuer-Variablen (fuer ?api=setvar): schreibt der Client optimistisch/Schatten.
                'vars'  => [
                    'Power'      => (int) (@IPS_GetObjectIDByIdent('Power', $iid) ?: 0),
                    'Brightness' => (int) (@IPS_GetObjectIDByIdent('Brightness', $iid) ?: 0),
                    'ColorTemp'  => (int) (@IPS_GetObjectIDByIdent('ColorTemp', $iid) ?: 0),
                ],
            ];
        }
        echo json_encode(['ok' => true, 'lights' => $out]);
        return;
    }

    if ($op === 'state') {
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        echo json_encode(['ok' => true, 'id' => $iid] + $stateOf($iid));
        return;
    }

    if ($op === 'manage') {                              // configureDriver/setArmed/setPower/... (token)
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'err' => 'forbidden']);
            return;
        }
        $iid = (int) ($_GET['id'] ?? 0);
        if (!in_array($iid, $list, true)) { echo json_encode(['ok' => false, 'err' => 'instance']); return; }
        $body = (string) ($_POST['data'] ?? '');
        if ($body === '') $body = (string) file_get_contents('php://input');
        echo function_exists('HSLT_Manage') ? HSLT_Manage($iid, $body !== '' ? $body : '{}') : json_encode(['ok' => false, 'err' => 'prefix']);
        return;
    }

    // ---- Szenen (Haus-Ebene, Hub/HSH): scenes lesen frei; capture/apply/save/delete token ----
    if ($op === 'scenes' || $op === 'scene' || $op === 'sceneapply' || $op === 'scenecapture'
        || $op === 'scenesave' || $op === 'scenedelete' || $op === 'scenerename'
        || $op === 'autoget' || $op === 'autoset' || $op === 'autotick' || $op === 'sensors'
        || $op === 'bandget' || $op === 'bandset' || $op === 'housegeo') {
        if (!function_exists('HSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'hub_prefix']); return; }
        $hub = (int) (@IPS_GetInstanceListByModuleID('{A0C082B4-9E74-430E-BD97-F9CEBB364257}')[0] ?? 0);
        if ($hub <= 0) { echo json_encode(['ok' => false, 'err' => 'no_hub']); return; }

        if ($op === 'autoget') { echo HSH_Manage($hub, json_encode(['op' => 'lightAutoGet'])); return; }
        if ($op === 'bandget') { echo HSH_Manage($hub, json_encode(['op' => 'lightAutoBandGet'])); return; }
        if ($op === 'housegeo') { echo HSH_Manage($hub, json_encode(['op' => 'houseGeo'])); return; }
        if ($op === 'bandset') { // Baender schreiben: Token
            if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
                http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return;
            }
            $body = (string) ($_POST['data'] ?? ''); if ($body === '') $body = (string) file_get_contents('php://input');
            $args = json_decode($body ?: '{}', true); if (!is_array($args)) $args = [];
            echo HSH_Manage($hub, json_encode(['op' => 'lightAutoBandSet', 'args' => $args]));
            return;
        }
        if ($op === 'sensors') { // Bewegungs-/Anwesenheits-Sensoren erkennen (fuer autox-Auswahl)
            echo HSH_Manage($hub, json_encode(['op' => 'detectSensors', 'args' => ['kind' => (string) ($_GET['kind'] ?? 'motion')]]));
            return;
        }
        if ($op === 'autoset' || $op === 'autotick') {
            if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
                http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return;
            }
            if ($op === 'autotick') { echo HSH_Manage($hub, json_encode(['op' => 'lightAutoTick'])); return; }
            $body = (string) ($_POST['data'] ?? ''); if ($body === '') $body = (string) file_get_contents('php://input');
            $args = json_decode($body ?: '{}', true); if (!is_array($args)) $args = [];
            echo HSH_Manage($hub, json_encode(['op' => 'lightAutoSet', 'args' => $args]));
            return;
        }
        if ($op === 'scenes') { echo HSH_Manage($hub, json_encode(['op' => 'lightSceneList'])); return; }
        if ($op === 'scene')  { echo HSH_Manage($hub, json_encode(['op' => 'lightSceneGet', 'args' => ['id' => (string) ($_GET['id'] ?? '')]])); return; }
        // schreibende Szenen-Ops: Token
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'err' => 'forbidden']);
            return;
        }
        $body = (string) ($_POST['data'] ?? '');
        if ($body === '') $body = (string) file_get_contents('php://input');
        $args = json_decode($body ?: '{}', true); if (!is_array($args)) $args = [];
        $mapOp = ['sceneapply' => 'lightSceneApply', 'scenecapture' => 'lightSceneCapture',
                  'scenesave' => 'lightSceneSave', 'scenedelete' => 'lightSceneDelete', 'scenerename' => 'lightSceneRename'];
        echo HSH_Manage($hub, json_encode(['op' => $mapOp[$op], 'args' => $args]));
        return;
    }

    echo json_encode(['ok' => false, 'err' => 'op']);
    return;
}

// ---- Veröffentlichen: einmaliger Reload-Push an alle Run-Clients (bewusst, NICHT an Autosave gekoppelt) ----
if ($api === 'publish') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden']);
        return;
    }
    $push = IPS_GetInstanceListByModuleID('{7B3E9F21-4C8A-4D6E-B1F5-9A0C2D3E4F60}')[0] ?? 0;
    $ok = ($push && function_exists('LVBP_BroadcastText')) ? (bool) @LVBP_BroadcastText($push, '{"reload":1}') : false;
    echo json_encode(['ok' => $ok, 'push' => (int) $push]);
    return;
}

// ---- Objekt-Metadaten:  ?api=objinfo&id=<objid> ----
if ($api === 'wxvars') {
    // Loest eine Wetter-Instanz in ihre Variablen auf: Ident => ObjektID.
    //
    // Gedacht fuer Widgets, die "die Wetterlage" zeigen wollen, ohne dass jemand fuenf
    // Variablen einzeln zuweist. Aufgeloest wird EINMAL im Editor; die IDs landen danach als
    // gewoehnliche Bindungen im Widget. Zur Laufzeit aufzuloesen waere falsch: die Live-Abfrage
    // sammelt ihre IDs aus den Widget-Eigenschaften, eine erst spaeter ermittelte ID wuerde nie
    // abgefragt und die Kachel bliebe stumm.
    header('Content-Type: application/json; charset=utf-8');
    $inst = (int) ($_GET['inst'] ?? 0);
    if ($inst <= 0 || !@IPS_InstanceExists($inst)) {
        echo json_encode(['error' => 'keine Instanz']);
        return;
    }
    $out = ['inst' => $inst, 'name' => IPS_GetName($inst), 'vars' => []];
    foreach (IPS_GetChildrenIDs($inst) as $c) {
        if (IPS_GetObject($c)['ObjectType'] !== 2) {
            continue;
        }
        $id = IPS_GetObject($c)['ObjectIdent'];
        if ($id !== '') {
            $out['vars'][$id] = ['id' => (int) $c, 'name' => IPS_GetName($c)];
        }
    }
    echo json_encode($out);
    return;
}

// ---- Aufzeichnungsstatus mehrerer Variablen:  ?api=logstat&ids=1,2,3[&from=<unix>]
//      Fuer die Serienzeile im Diagramm-Editor. Eine Serie, die auf eine nicht
//      geloggte Variable zeigt, liefert einen leeren Balken und sonst nichts - der
//      haeufigste Fall ist ein Zahlendreher in der ID, und der faellt erst Wochen
//      spaeter auf. Deshalb sagt der Editor es jetzt sofort.
if ($api === 'logstat') {
    header('Content-Type: application/json; charset=utf-8');
    $ids  = array_slice(array_filter(array_map('intval', explode(',', (string) ($_GET['ids'] ?? '')))), 0, 40);
    $from = (int) ($_GET['from'] ?? (time() - 7 * 86400));
    $ac   = 0;
    foreach ((array) @IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}') as $a) { $ac = (int) $a; break; }
    $out = [];
    foreach ($ids as $id) {
        if (!@IPS_VariableExists($id)) { $out[$id] = ['ok' => false, 'grund' => 'keine Variable']; continue; }
        $o = @IPS_GetObject($id);
        $r = ['ok' => true, 'name' => (string) ($o['ObjectName'] ?? ''), 'pfad' => LVB_ObjPath($id),
              'logged' => false, 'agg' => 0, 'bloecke' => 0];
        if ($ac > 0) {
            $r['logged'] = (bool) @AC_GetLoggingStatus($ac, $id);
            $r['agg']    = (int) @AC_GetAggregationType($ac, $id);
            if ($r['logged']) {
                $rows = @AC_GetAggregatedValues($ac, $id, 1, $from, time(), 0);   // Tagesbloecke
                $r['bloecke'] = is_array($rows) ? count($rows) : 0;
            }
        }
        $out[$id] = $r;
    }
    echo json_encode(['ok' => true, 'vars' => $out]);
    return;
}

if ($api === 'objinfo') {
    header('Content-Type: application/json; charset=utf-8');
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !IPS_ObjectExists($id)) {
        echo json_encode(['error' => 'no object']);
        return;
    }
    $o   = IPS_GetObject($id);
    $res = ['id' => $id, 'name' => $o['ObjectName'], 'type' => $o['ObjectType']];
    if (@IPS_VariableExists($id)) {
        $v = IPS_GetVariable($id);
        $res['updated'] = (int) $v['VariableUpdated'];
        $res['changed'] = (int) $v['VariableChanged'];
    }
    if (IPS_EventExists($id)) {
        $e = IPS_GetEvent($id);
        $res['active'] = (bool) ($e['EventActive'] ?? false);
        $res['next']   = (int) ($e['NextRun'] ?? 0);
        $res['last']   = (int) ($e['LastRun'] ?? 0);
    }
    echo json_encode($res);
    return;
}

// ---- Tabellen-Daten aus Text-Variable (JSON ODER serialisiertes Array) -> 2D-Zeilen ----
if ($api === 'tabledata') {
    header('Content-Type: application/json; charset=utf-8');
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !@IPS_VariableExists($id)) {
        echo json_encode(['rows' => [], 'error' => 'no variable']);
        return;
    }
    $raw = GetValue($id);
    $arr = null;
    if (is_array($raw)) {
        $arr = $raw;
    } else {
        $s = trim((string) $raw);
        if ($s !== '') {
            $j = json_decode($s, true);
            if (is_array($j)) {
                $arr = $j;
            } else {
                $u = @unserialize($s);
                if (is_array($u)) {
                    $arr = $u;
                }
            }
        }
    }
    $rows = [];
    if (is_array($arr)) {
        foreach ($arr as $row) {
            if (is_array($row)) {
                $r = [];
                foreach ($row as $cell) {
                    $r[] = is_bool($cell) ? ($cell ? '1' : '0') : ((is_scalar($cell) || $cell === null) ? (string) $cell : json_encode($cell, JSON_UNESCAPED_UNICODE));
                }
                $rows[] = $r;
            } else {
                $rows[] = [is_bool($row) ? ($row ? '1' : '0') : ((is_scalar($row) || $row === null) ? (string) $row : json_encode($row, JSON_UNESCAPED_UNICODE))];
            }
        }
    }
    echo json_encode(['rows' => $rows]);
    return;
}

// ---- Schreiben per Variablen-ID (token-geschützt) ----
if ($api === 'setvar') {
    header('Content-Type: application/json; charset=utf-8');
    if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden']);
        return;
    }
    $id  = (int) ($_GET['id'] ?? 0);
    $raw = (string) ($_GET['value'] ?? '');
    if ($id <= 0 || !@IPS_VariableExists($id)) {
        http_response_code(404);
        echo json_encode(['error' => 'no variable']);
        return;
    }
    $v = IPS_GetVariable($id);
    switch ($v['VariableType']) {
        case 0:  $val = ($raw === '1' || strtolower($raw) === 'true'); break;
        case 1:  $val = (int) $raw; break;
        case 2:  $val = (float) str_replace(',', '.', $raw); break;
        default: $val = $raw; break;
    }
    if ($v['VariableAction'] > 0 || $v['VariableCustomAction'] > 0) {
        RequestAction($id, $val);
    } else {
        SetValue($id, $val);
    }
    echo json_encode(['ok' => true, 'id' => $id, 'value' => $val]);
    return;
}

// ---- Layouts (Standard + benannte Snapshots) im Instanz-Attribut ----
if ($api === 'layout') {
    header('Content-Type: application/json; charset=utf-8');
    if (!is_dir($DATADIR)) {
        @mkdir($DATADIR, 0775, true);
    }
    if (isset($_GET['list'])) {
        $files = [];
        if (is_file($DATADIR . '/layouts.json')) {
            $files[] = ['file' => '', 'name' => 'Standard (live)'];
        }
        foreach (glob($DATADIR . '/layouts.*.json') ?: [] as $p) {
            $slug = (string) preg_replace('/^layouts\.(.*)\.json$/', '$1', basename($p));
            if ($slug !== '') {
                $files[] = ['file' => $slug, 'name' => $slug];
            }
        }
        echo json_encode(['files' => $files]);
        return;
    }
    $file   = (string) preg_replace('/[^A-Za-z0-9_-]/', '', (string) ($_GET['file'] ?? ''));
    $lf     = $DATADIR . '/layouts' . ($file !== '' ? '.' . $file : '') . '.json';
    $isSave = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' || isset($_GET['save']);

    // ---- Speichermodell: index.json + seiten/<slug>.json (eine Datei je Seite) ----
    // layouts.json bleibt als Kompatibilitaets-Spiegel (Push-Modul) und Fallback erhalten. Snapshots (file != '') bleiben kombiniert.
    // Zerlegen/Zusammensetzen kommen aus store.inc.php - dieselbe Implementierung, die auch
    // das Instanz-Formular und syncViews benutzen. Vorher lagen sie nur hier als Closures,
    // waehrend module.php direkt auf layouts.json arbeitete; genau daran lief der Spiegel
    // auseinander. Die Aufrufstellen unten bleiben unveraendert.
    $slugOf        = 'LVB_Slug';
    $splitStore    = function (array $store) use ($DATADIR): void { LVB_Split($DATADIR, $store); };
    $assembleStore = function () use ($DATADIR): ?array { return LVB_Assemble($DATADIR); };

    if ($isSave) {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) {
            http_response_code(403);
            echo json_encode(['error' => 'forbidden']);
            return;
        }
        $data = file_get_contents('php://input');
        if ($data === '' || $data === false) {
            $data = (string) ($_POST['data'] ?? '');
        }
        $store = json_decode($data, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($store)) {
            http_response_code(400);
            echo json_encode(['error' => 'invalid json']);
            return;
        }
        file_put_contents($lf, $data);                          // layouts(.snapshot).json = Spiegel/Fallback
        if ($file === '' && isset($store['views'])) {
            $splitStore($store);                                // nur das Live-Layout in Einzeldateien zerlegen
        }
        $push = IPS_GetInstanceListByModuleID('{7B3E9F21-4C8A-4D6E-B1F5-9A0C2D3E4F60}')[0] ?? 0; // Registrierungen sofort neu ziehen
        if ($push && function_exists('LVBP_Sync')) { @LVBP_Sync($push); }
        echo json_encode(['ok' => true, 'bytes' => strlen($data)]);
        return;
    }

    // GET: Snapshot -> kombinierte Datei; Live -> aus Einzeldateien zusammensetzen (sonst layouts.json, dabei einmalig migrieren)
    if ($file !== '') {
        $data = @file_get_contents($lf);
        echo ($data !== false && $data !== '') ? $data : json_encode(['pages' => []]);
        return;
    }
    $store = $assembleStore();
    if ($store === null) {
        $legacy = json_decode((string) @file_get_contents($DATADIR . '/layouts.json'), true);
        if (!is_array($legacy) || !isset($legacy['views'])) {
            // Cross-Dir-Fallback: fruehere Auto-Ablage (liveview/<InstanzID>/) uebernehmen, wenn der neue Ordner leer ist
            $oldDir = rtrim(IPS_GetKernelDir(), '/') . '/liveview/' . $this->InstanceID;
            if ($oldDir !== $DATADIR) {
                $legacy = json_decode((string) @file_get_contents($oldDir . '/layouts.json'), true);
            }
        }
        if (is_array($legacy) && isset($legacy['views'])) {
            $splitStore($legacy);                               // Migration -> index.json + seiten/ im neuen Ordner
            @file_put_contents($DATADIR . '/layouts.json', json_encode($legacy, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); // Spiegel fuers Push-Modul
            $store = $legacy;
        }
    }
    echo $store !== null ? json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : json_encode(['pages' => []]);
    return;
}

// ---- Variablen-HTML (für das HTML-Widget) ----
if ($api === 'html') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!@IPS_VariableExists($id)) {
        http_response_code(404);
        echo '';
        return;
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo (string) GetValue($id);
    return;
}

// ---- Verlaufsdaten fürs Charting ----
if ($api === 'history') {
    header('Content-Type: application/json; charset=utf-8');
    $id = (int) ($_GET['id'] ?? 0);
    $h  = max(1, (int) ($_GET['h'] ?? 24));
    if (!@IPS_VariableExists($id)) {
        echo json_encode(['data' => []]);
        return;
    }
    $acs = IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}');
    if (count($acs) === 0) {
        echo json_encode(['data' => []]);
        return;
    }
    $from = (int) ($_GET['from'] ?? 0);
    $to   = (int) ($_GET['to'] ?? 0);
    if ($from > 0 && $to > 0) {
        $start = $from;
        $end   = $to;
    } else {
        $end   = time();
        $start = $end - $h * 3600;
    }
    $rows = @AC_GetLoggedValues($acs[0], $id, $start, $end, 4000);
    if (!is_array($rows)) {
        $rows = [];
    }
    $data = [];
    foreach (array_reverse($rows) as $r) {
        $data[] = [$r['TimeStamp'] * 1000, $r['Value']];
    }
    echo json_encode(['data' => $data]);
    return;
}

// ---- Zeitversatz-Vergleich, automatisch nach Logging-Typ (Standard/Zähler) ----
// Aggregat-Helfer: Min/Max/Avg einer Variable ueber [from,to] via native AC_GetAggregatedValues.
// stage->level so gewaehlt, dass die aktuelle Periode i. d. R. genau EIN Bucket ist.
if (!function_exists('lvbStageLevel')) {
    function lvbStageLevel($stage) {
        $m = ['minute' => 5, 'hour' => 0, 'day' => 1, 'week' => 2, 'month' => 3, 'year' => 4];
        return isset($m[$stage]) ? $m[$stage] : 1;
    }
    function lvbPeriodStat($ac, $id, $level, $from, $to) {
        $rows = @AC_GetAggregatedValues($ac, $id, $level, $from, $to, 0);
        if (!is_array($rows) || !count($rows)) return ['min' => null, 'max' => null, 'avg' => null];
        $min = null; $max = null; $sum = 0.0; $n = 0;
        foreach ($rows as $b) {
            if (isset($b['Min']) && $b['Min'] !== null) $min = ($min === null) ? (float) $b['Min'] : min($min, (float) $b['Min']);
            if (isset($b['Max']) && $b['Max'] !== null) $max = ($max === null) ? (float) $b['Max'] : max($max, (float) $b['Max']);
            if (isset($b['Avg']) && $b['Avg'] !== null) { $sum += (float) $b['Avg']; $n++; }
        }
        return ['min' => $min, 'max' => $max, 'avg' => ($n > 0 ? $sum / $n : null)];
    }
}
if ($api === 'agg') { // Min/Max/Avg einer geloggten Variable ueber die aktuelle Periode (native Aggregation)
    header('Content-Type: application/json; charset=utf-8');
    // Formel-Bindung: je Periodenbucket den Ausdruck auswerten, dann min/max/avg ueber die Buckets.
    $rawIdA = (string) ($_GET['id'] ?? '');
    $stage  = (string) ($_GET['stage'] ?? 'day');
    if (LVB_IsFormula($rawIdA)) {
        $acsA = IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}');
        $acA  = $acsA[0] ?? 0;
        $fids = LVB_FormulaIds($rawIdA);
        if (!$acA || !$fids) { echo json_encode(['min' => null, 'max' => null, 'avg' => null]); return; }
        $now = time();
        $Y = (int) date('Y', $now); $mo = (int) date('n', $now); $dd = (int) date('j', $now); $H = (int) date('G', $now); $mi = (int) date('i', $now);
        switch ($stage) {
            case 'minute': $pStart = mktime($H, $mi, 0, $mo, $dd, $Y); break;
            case 'hour':   $pStart = mktime($H, 0, 0, $mo, $dd, $Y);  break;
            case 'week':   $pStart = strtotime(date('Y-m-d', strtotime('monday this week', $now)) . ' 00:00:00'); break;
            case 'month':  $pStart = mktime(0, 0, 0, $mo, 1, $Y); break;
            case 'year':   $pStart = mktime(0, 0, 0, 1, 1, $Y);   break;
            default:       $pStart = mktime(0, 0, 0, $mo, $dd, $Y); break;
        }
        $lvl = lvbStageLevel($stage);
        $ser = []; $tsset = [];
        foreach ($fids as $vid) {
            $r = @AC_GetAggregatedValues($acA, $vid, $lvl, $pStart, $now, 0);
            $m = []; if (is_array($r)) foreach ($r as $b) { $t = (int) $b['TimeStamp']; $m[$t] = isset($b['Avg']) ? (float) $b['Avg'] : 0.0; $tsset[$t] = 1; }
            $ser[$vid] = $m;
        }
        $mn = null; $mx = null; $sum = 0.0; $k = 0;
        foreach (array_keys($tsset) as $t) {
            $vals = []; foreach ($fids as $vid) $vals[$vid] = $ser[$vid][$t] ?? 0.0;
            $v = LVB_FormulaEval($rawIdA, $vals);
            if ($v === null) continue;
            if ($mn === null || $v < $mn) $mn = $v;
            if ($mx === null || $v > $mx) $mx = $v;
            $sum += $v; $k++;
        }
        echo json_encode(['min' => $mn, 'max' => $mx, 'avg' => $k ? ($sum / $k) : null]);
        return;
    }
    $id    = (int) ($_GET['id'] ?? 0);
    $stage = (string) ($_GET['stage'] ?? 'day'); // minute|hour|day|week|month|year
    if (!@IPS_VariableExists($id)) { echo json_encode(['min' => null, 'max' => null, 'avg' => null]); return; }
    $acs = IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}');
    $ac  = $acs[0] ?? 0;
    if (!$ac) { echo json_encode(['min' => null, 'max' => null, 'avg' => null]); return; }
    $now = time();
    $Y = (int) date('Y', $now); $mo = (int) date('n', $now); $d = (int) date('j', $now); $H = (int) date('G', $now); $mi = (int) date('i', $now);
    switch ($stage) {
        case 'minute': $pStart = mktime($H, $mi, 0, $mo, $d, $Y); break;
        case 'hour':   $pStart = mktime($H, 0, 0, $mo, $d, $Y);  break;
        case 'week':   $pStart = strtotime(date('Y-m-d', strtotime('monday this week', $now)) . ' 00:00:00'); break;
        case 'month':  $pStart = mktime(0, 0, 0, $mo, 1, $Y); break;
        case 'year':   $pStart = mktime(0, 0, 0, 1, 1, $Y);   break;
        default:       $pStart = mktime(0, 0, 0, $mo, $d, $Y); break; // day
    }
    $s = lvbPeriodStat($ac, $id, lvbStageLevel($stage), $pStart, $now);
    echo json_encode(['min' => $s['min'], 'max' => $s['max'], 'avg' => $s['avg']]);
    return;
}
// ---- Generischer Archiv-Aggregat-Passthrough: AC_GetAggregatedValues(id, level, from, to) ----
// level: 0=Stunde 1=Tag 2=Woche 3=Monat 4=Jahr 5=5-Min. Bei Zaehlern steht der Verbrauch im Feld avg.
if ($api === 'aggregated') {
    header('Content-Type: application/json; charset=utf-8');
    $id    = (int) ($_GET['id'] ?? 0);
    $level = (int) ($_GET['level'] ?? 3);
    $to    = (int) ($_GET['to'] ?? time());
    $from  = (int) ($_GET['from'] ?? ($to - 366 * 86400));
    $limit = (int) ($_GET['limit'] ?? 0);
    // Formel-Bindung "=Ausdruck": jede beteiligte Variable nativ aggregieren, dann pro
    // Periode den Ausdruck auf den Perioden-Werten auswerten (bei +/- exakt).
    $rawId = (string) ($_GET['id'] ?? '');
    if (LVB_IsFormula($rawId)) {
        $acs2 = IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}');
        $ac2  = $acs2[0] ?? 0;
        $fids = LVB_FormulaIds($rawId);
        if (!$ac2 || !$fids) { echo json_encode(['id' => $rawId, 'level' => $level, 'counter' => false, 'rows' => []]); return; }
        $ser = []; $tsset = [];
        foreach ($fids as $vid) {
            $r = @AC_GetAggregatedValues($ac2, $vid, $level, $from, $to, $limit);
            $m = [];
            if (is_array($r)) foreach ($r as $b) { $t = (int) $b['TimeStamp']; $m[$t] = isset($b['Avg']) ? (float) $b['Avg'] : 0.0; $tsset[$t] = 1; }
            $ser[$vid] = $m;
        }
        $tss = array_keys($tsset); rsort($tss);
        $out = [];
        foreach ($tss as $t) {
            $vals = []; foreach ($fids as $vid) $vals[$vid] = $ser[$vid][$t] ?? 0.0;
            $v = LVB_FormulaEval($rawId, $vals);
            $out[] = ['t' => $t, 'avg' => $v, 'sum' => $v, 'min' => $v, 'max' => $v];
        }
        echo json_encode(['id' => $rawId, 'level' => $level, 'counter' => false, 'rows' => $out]);
        return;
    }
    if (!@IPS_VariableExists($id)) { echo json_encode(['id' => $id, 'rows' => []]); return; }
    $acs = IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}');
    $ac  = $acs[0] ?? 0;
    if (!$ac) { echo json_encode(['id' => $id, 'rows' => []]); return; }
    $rows = @AC_GetAggregatedValues($ac, $id, $level, $from, $to, $limit);
    $out  = [];
    if (is_array($rows)) {
        foreach ($rows as $b) {
            $out[] = [
                't'   => (int) $b['TimeStamp'],
                'avg' => isset($b['Avg']) ? $b['Avg'] : null,
                'sum' => isset($b['Sum']) ? $b['Sum'] : null,
                'min' => isset($b['Min']) ? $b['Min'] : null,
                'max' => isset($b['Max']) ? $b['Max'] : null,
            ];
        }
    }
    echo json_encode(['id' => $id, 'level' => $level, 'counter' => (@AC_GetAggregationType($ac, $id) == 1), 'rows' => $out]);
    return;
}
if ($api === 'cmp') {
    header('Content-Type: application/json; charset=utf-8');
    // Formel-Bindung "=Ausdruck": je Komponente Ist- und Vorperioden-Wert nativ bestimmen
    // (Zaehler automatisch erkannt), dann den Ausdruck auf beiden Saetzen auswerten.
    $rawIdC = (string) ($_GET['id'] ?? '');
    if (LVB_IsFormula($rawIdC)) {
        $stage = (string) ($_GET['stage'] ?? 'day');
        $acsC  = IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}');
        $acC   = $acsC[0] ?? 0;
        $fids  = LVB_FormulaIds($rawIdC);
        if (!$acC || !$fids) { echo json_encode(['cur' => null, 'past' => null, 'type' => 0]); return; }
        $now = time();
        $Y = (int) date('Y', $now); $mo = (int) date('n', $now); $dd = (int) date('j', $now); $H = (int) date('G', $now); $mi = (int) date('i', $now);
        switch ($stage) {
            case 'minute': $pStart = mktime($H, $mi, 0, $mo, $dd, $Y); break;
            case 'hour':   $pStart = mktime($H, 0, 0, $mo, $dd, $Y);  break;
            case 'week':   $pStart = strtotime(date('Y-m-d', strtotime('monday this week', $now)) . ' 00:00:00'); break;
            case 'month':  $pStart = mktime(0, 0, 0, $mo, 1, $Y); break;
            case 'year':   $pStart = mktime(0, 0, 0, 1, 1, $Y);   break;
            default:       $pStart = mktime(0, 0, 0, $mo, $dd, $Y); break;
        }
        switch ($stage) {
            case 'minute': $prevStart = $pStart - 60; break;
            case 'hour':   $prevStart = $pStart - 3600; break;
            case 'week':   $prevStart = strtotime('-1 week', $pStart); break;
            case 'month':  $prevStart = strtotime('-1 month', $pStart); break;
            case 'year':   $prevStart = strtotime('-1 year', $pStart); break;
            default:       $prevStart = strtotime('-1 day', $pStart); break;
        }
        $prevSame = $prevStart + ($now - $pStart);
        $valAtF = function ($vid, $t) use ($acC, $now) {
            if ($t > $now) $t = $now;
            $r = @AC_GetLoggedValues($acC, $vid, 0, $t, 1);
            if (is_array($r) && count($r)) return (float) $r[0]['Value'];
            $a = @AC_GetAggregatedValues($acC, $vid, 0, $t - 3 * 86400, $t, 1);
            if (is_array($a) && count($a)) return (float) $a[0]['Avg'];
            return null;
        };
        $meanAvgF = function ($vid, $a, $b) use ($acC) {
            $rows = @AC_GetAggregatedValues($acC, $vid, 0, $a, $b, 0);
            if (!is_array($rows) || !count($rows)) return null;
            $s = 0.0; $k = 0; foreach ($rows as $r) { if (isset($r['Avg'])) { $s += (float) $r['Avg']; $k++; } }
            return $k ? ($s / $k) : null;
        };
        $curV = []; $pastV = []; $allC = true;
        foreach ($fids as $vid) {
            if (@AC_GetAggregationType($acC, $vid) == 1) { // Zaehler: Verbrauch/Ertrag der Periode
                $vn = @GetValue($vid); $vn = is_numeric($vn) ? (float) $vn : $valAtF($vid, $now);
                $vps = $valAtF($vid, $pStart); $curV[$vid] = ($vn !== null && $vps !== null) ? ($vn - $vps) : null;
                $vp1 = $valAtF($vid, $prevSame); $vp0 = $valAtF($vid, $prevStart); $pastV[$vid] = ($vp1 !== null && $vp0 !== null) ? ($vp1 - $vp0) : null;
            } else { // Standardvariable: Periodenmittel
                $allC = false;
                $curV[$vid]  = $meanAvgF($vid, $pStart, $now);
                $pastV[$vid] = $meanAvgF($vid, $prevStart, $prevSame);
            }
        }
        $mk = function ($src) use ($fids) { $o = []; foreach ($fids as $vid) { if (!isset($src[$vid]) || $src[$vid] === null) return null; $o[$vid] = $src[$vid]; } return $o; };
        $cv = $mk($curV); $pv = $mk($pastV);
        echo json_encode([
            'type' => $allC ? 1 : 0,
            'cur'  => ($cv !== null) ? LVB_FormulaEval($rawIdC, $cv) : null,
            'past' => ($pv !== null) ? LVB_FormulaEval($rawIdC, $pv) : null,
        ]);
        return;
    }
    $id    = (int) ($_GET['id'] ?? 0);
    $stage = (string) ($_GET['stage'] ?? 'day');     // minute|hour|day|week|month|year
    $kind  = (string) ($_GET['kind'] ?? 'standard'); // standard|counter
    if (!@IPS_VariableExists($id)) {
        echo json_encode(['cur' => null, 'past' => null, 'type' => 0]);
        return;
    }
    $acs = IPS_GetInstanceListByModuleID('{43192F0B-135B-4CE7-A0A7-1475603F3060}');
    $ac  = $acs[0] ?? 0;
    if (!$ac) {
        echo json_encode(['cur' => null, 'past' => null, 'type' => 0]);
        return;
    }
    $now = time();
    $Y = (int) date('Y', $now); $mo = (int) date('n', $now); $d = (int) date('j', $now); $H = (int) date('G', $now); $mi = (int) date('i', $now);
    // Start der aktuellen Periode (kalendergenau, lokale Zeit)
    switch ($stage) {
        case 'minute': $pStart = mktime($H, $mi, 0, $mo, $d, $Y); break;
        case 'hour':   $pStart = mktime($H, 0, 0, $mo, $d, $Y);  break;
        case 'week':   $pStart = strtotime(date('Y-m-d', strtotime('monday this week', $now)) . ' 00:00:00'); break;
        case 'month':  $pStart = mktime(0, 0, 0, $mo, 1, $Y); break;
        case 'year':   $pStart = mktime(0, 0, 0, 1, 1, $Y);   break;
        default:       $pStart = mktime(0, 0, 0, $mo, $d, $Y); break; // day
    }
    // Start der Vorperiode
    switch ($stage) {
        case 'minute': $prevStart = $pStart - 60; break;
        case 'hour':   $prevStart = $pStart - 3600; break;
        case 'week':   $prevStart = strtotime('-1 week', $pStart); break;
        case 'month':  $prevStart = strtotime('-1 month', $pStart); break;
        case 'year':   $prevStart = strtotime('-1 year', $pStart); break;
        default:       $prevStart = strtotime('-1 day', $pStart); break;
    }
    $prevSame = $prevStart + ($now - $pStart); // gleiches Zeitfenster in der Vorperiode

    $lvl = ($stage === 'month') ? 1 : (($stage === 'year') ? 2 : 0); // Aggregationsstufe fuer Rohwert-Fallback

    // Jede dieser Archivsuchen kostet rund 275 ms - gemessen, unabhaengig vom Zeitfenster.
    // Der Zaehlerpfad unten braucht vier davon, macht ueber eine Sekunde, in der die Kachel
    // leer bleibt. Punktwerte der VERGANGENHEIT aendern sich aber nie mehr: Was am
    // 30.07. um 00:00 im Archiv stand, steht dort auch morgen noch. Solche Werte duerfen
    // deshalb dauerhaft gemerkt werden - das ist kein Verfallszwischenspeicher, sondern
    // schlicht die Erkenntnis, dass Geschichte sich nicht aendert. Nur Zeitpunkte juenger
    // als GRACE bleiben ungespeichert, weil dort noch Werte nachtroepfeln koennen.
    $CFILE = rtrim((string) ($DATADIR ?? sys_get_temp_dir()), '/') . '/cache-valat.json';
    $GRACE = 600;
    $cache = @json_decode((string) @file_get_contents($CFILE), true);
    if (!is_array($cache)) $cache = [];
    $cdirty = false;
    $valAt = function ($t) use ($ac, $id, $lvl, $now, &$cache, &$cdirty, $GRACE) {
        if ($t > $now) $t = $now;
        $cacheable = ($t < $now - $GRACE);
        // "Gestern zur selben Uhrzeit" wandert sekuendlich und erzeugt sonst bei JEDEM
        // Aufruf einen neuen Schluessel - der Speicher fuellte sich mit Einmalwerten und
        // traefe nie. Auf die Minute gerundet bleiben es hoechstens 1440 Schluessel je Tag.
        // Fuer einen Tagesvergleich ist die Sekunde ohnehin ohne Bedeutung; Periodengrenzen
        // (00:00:00) runden auf sich selbst.
        if ($cacheable) $t = $t - ($t % 60);
        $ck = $id . ':' . $t;
        if ($cacheable && array_key_exists($ck, $cache)) {
            return ($cache[$ck] === null) ? null : (float) $cache[$ck];
        }
        $r   = @AC_GetLoggedValues($ac, $id, 0, $t, 1); // letzter geloggter Wert <= t
        $out = null;
        if (is_array($r) && count($r)) {
            $out = (float) $r[0]['Value'];
        } else {
            $a = @AC_GetAggregatedValues($ac, $id, $lvl, $t - 3 * 86400, $t, 1); // Fallback (Rohwerte evtl. gepurged)
            if (is_array($a) && count($a)) $out = (float) $a[0]['Avg'];
        }
        if ($cacheable) { $cache[$ck] = $out; $cdirty = true; }
        return $out;
    };
    $cflush = function () use (&$cache, &$cdirty, $CFILE) {
        if (!$cdirty) return;
        if (count($cache) > 800) $cache = array_slice($cache, -400, null, true); // aelteste Eintraege fallen raus
        @file_put_contents($CFILE, json_encode($cache), LOCK_EX);
    };

    if ($kind === 'counter') {
        // Der AKTUELLE Wert steht direkt an der Variable - dafuer braucht es keine
        // Archivsuche. Der Standardpfad unten macht das laengst so; hier fehlte es.
        $cn  = @GetValue($id);
        $vn  = is_numeric($cn) ? (float) $cn : $valAt($now);
        $vps = $valAt($pStart);
        $cur  = ($vn !== null && $vps !== null) ? ($vn - $vps) : null;      // Verbrauch in der aktuellen Periode
        $vp1 = $valAt($prevSame); $vp0 = $valAt($prevStart);
        $past = ($vp1 !== null && $vp0 !== null) ? ($vp1 - $vp0) : null;    // Verbrauch Vorperiode (gleiches Fenster)
        $cflush();
        echo json_encode(['type' => 1, 'cur' => $cur, 'past' => $past]);
        return;
    }
    if (($_GET['mode'] ?? '') === 'avg') { // Periodenmittel (zeitgew. Mittel je Periode) via native Aggregation
        $lvl  = lvbStageLevel($stage);
        $curS = lvbPeriodStat($ac, $id, $lvl, $pStart, $now);
        $prvS = lvbPeriodStat($ac, $id, $lvl, $prevStart, $prevSame);
        echo json_encode(['type' => 0, 'cur' => $curS['avg'], 'past' => $prvS['avg']]);
        return;
    }
    $cn   = @GetValue($id);
    $cur  = is_numeric($cn) ? (float) $cn : $valAt($now); // aktueller Wert
    $past = $valAt($prevSame);                            // Wert zum selben Zeitpunkt der Vorperiode
    $cflush();
    echo json_encode(['type' => 0, 'cur' => $cur, 'past' => $past]);
    return;
}

// ---- Media-Bild (Kamera/Bild-Widget) ----
if ($api === 'media') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!IPS_MediaExists($id)) {
        http_response_code(404);
        echo 'no media';
        return;
    }
    $m = IPS_GetMedia($id);
    if ((int) $m['MediaType'] !== 1) {
        http_response_code(404);
        echo 'not image';
        return;
    }
    $raw = @base64_decode((string) IPS_GetMediaContent($id));
    // Echten Bildtyp aus den Bytes bestimmen — Media-Objekte sind oft PNG,
    // ein hart gesetztes image/jpeg lieferte dann je nach Browser ein leeres <img>.
    $mime = 'image/jpeg';
    $info = @getimagesizefromstring($raw);
    if ($info && !empty($info['mime'])) {
        $mime = $info['mime'];
    } elseif (strncmp($raw, "\x89PNG", 4) === 0) {
        $mime = 'image/png';
    } elseif (strncmp($raw, 'GIF8', 4) === 0) {
        $mime = 'image/gif';
    } elseif (substr($raw, 0, 4) === 'RIFF' && substr($raw, 8, 4) === 'WEBP') {
        $mime = 'image/webp';
    }
    // Der Symcon-WebHook kappt die Antwort bei 1 MB ("Output-Buffer exceeds Limit"). Grosse
    // Kamerabilder (z. B. Pool 2688x1512, 1,28 MB) kamen dadurch gar nicht an. Solche Bilder
    // werden hier serverseitig verkleinert und mit sinkender Qualitaet rekomprimiert, bis sie
    // unter dem Limit liegen — fuer eine Widget-Kachel voellig ausreichend.
    $LIMIT = 1000000;
    if (strlen($raw) > $LIMIT && function_exists('imagecreatefromstring')) {
        $img = @imagecreatefromstring($raw);
        if ($img) {
            $w0 = imagesx($img); $h0 = imagesy($img); $maxDim = 1600;
            $scale = min(1.0, $maxDim / max(1, max($w0, $h0)));
            if ($scale < 1.0) {
                $nw = max(1, (int) round($w0 * $scale)); $nh = max(1, (int) round($h0 * $scale));
                $dst = imagecreatetruecolor($nw, $nh);
                imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w0, $h0);
                imagedestroy($img); $img = $dst;
            }
            $q = 85; $out = '';
            do {
                ob_start(); imagejpeg($img, null, $q); $out = ob_get_clean();
                $q -= 12;
            } while (strlen($out) > $LIMIT && $q >= 35);
            imagedestroy($img);
            if ($out !== '' && strlen($out) <= $LIMIT) { $raw = $out; $mime = 'image/jpeg'; }
        }
    }
    header('Content-Type: ' . $mime);
    header('Cache-Control: no-store');
    echo $raw;
    return;
}

// ---- Wochenplan (WeeklySchedule-Ereignis) ----
if ($api === 'weekplan') {
    header('Content-Type: application/json; charset=utf-8');
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !IPS_EventExists($id)) {
        echo json_encode(['error' => 'no event']);
        return;
    }
    $ev = IPS_GetEvent($id);
    if ((int) ($ev['EventType'] ?? -1) !== 2) {
        echo json_encode(['error' => 'not a schedule']);
        return;
    }
    $groups = [];
    foreach (($ev['ScheduleActions'] ?? []) as $a) {
        $col = (int) ($a['Color'] ?? -1);
        $groups[(int) $a['ID']] = ['name' => (string) ($a['Name'] ?? ''), 'color' => $col >= 0 ? sprintf('#%06X', $col & 0xFFFFFF) : '#3a4a52'];
    }
    $days = [];
    for ($d = 0; $d < 7; $d++) {
        $seg = [];
        foreach (($ev['ScheduleGroups'] ?? []) as $g) {
            if (((int) ($g['Days'] ?? 0) & (1 << $d)) === 0) {
                continue;
            }
            $pts = $g['Points'] ?? [];
            usort($pts, function ($a, $b) {
                return (($a['Start']['Hour'] ?? 0) * 60 + ($a['Start']['Minute'] ?? 0)) <=> (($b['Start']['Hour'] ?? 0) * 60 + ($b['Start']['Minute'] ?? 0));
            });
            $cnt = count($pts);
            foreach ($pts as $i => $p) {
                $from  = (int) ($p['Start']['Hour'] ?? 0) * 60 + (int) ($p['Start']['Minute'] ?? 0);
                $to    = $i + 1 < $cnt ? ((int) ($pts[$i + 1]['Start']['Hour'] ?? 0) * 60 + (int) ($pts[$i + 1]['Start']['Minute'] ?? 0)) : 1440;
                $seg[] = ['from' => $from, 'to' => $to, 'group' => (int) ($p['ActionID'] ?? 0)];
            }
            break;
        }
        $days[] = $seg;
    }
    echo json_encode(['groups' => $groups, 'days' => $days]);
    return;
}

// ---- iCal-Kalender ----
if ($api === 'cal') {
    header('Content-Type: application/json; charset=utf-8');
    $ids  = array_filter(array_map('intval', explode(',', (string) ($_GET['ids'] ?? ''))));
    $days = max(1, min(60, (int) ($_GET['days'] ?? 14)));
    $now  = time();
    $from = strtotime('today');
    $to   = $now + $days * 86400;
    $out  = [];
    foreach ($ids as $iid) {
        if (!IPS_InstanceExists($iid)) {
            continue;
        }
        $inst = IPS_GetInstance($iid);
        if (($inst['ModuleInfo']['ModuleID'] ?? '') !== '{5127CDDC-2859-4223-A870-4D26AC83622C}') {
            continue;
        }
        $cfg = json_decode(IPS_GetConfiguration($iid), true);
        if (!is_array($cfg)) { $cfg = []; }
        $url = $cfg['CalendarServerURL'] ?? '';
        if ($url === '') {
            continue;
        }
        $ics = LVB_Fetch($url, $cfg['Username'] ?? '', $cfg['Password'] ?? '');
        if ($ics === '') {
            continue;
        }
        foreach (LVB_ParseICS($ics, $from, $to) as $ev) {
            $ev['cal'] = $iid;
            $out[]     = $ev;
        }
    }
    usort($out, function ($a, $b) { return $a['start'] - $b['start']; });
    echo json_encode(['events' => array_slice($out, 0, 120)]);
    return;
}

// ---- IPSView-Import (optional; Quelle = Property IPSViewPath) ----
// ---- Alle IPSView-Medienobjekte auflisten.  ?api=ipsviews ----
if ($api === 'ipsviews') {
    header('Content-Type: application/json; charset=utf-8');
    $out = [];
    foreach (IPS_GetMediaList() as $mid) {
        $m    = @IPS_GetMedia($mid);
        $file = is_array($m) ? (string) ($m['MediaFile'] ?? '') : '';
        if (stripos($file, '.ipsview') === false) {
            continue;
        }
        $out[] = ['id' => $mid, 'name' => IPS_GetName($mid), 'file' => basename($file)];
    }
    usort($out, function ($a, $b) {
        return strnatcasecmp($a['name'], $b['name']);
    });
    echo json_encode(['views' => $out]);
    return;
}

if ($api === 'import') {
    header('Content-Type: application/json; charset=utf-8');
    $media = (int) ($_GET['media'] ?? 0);
    if ($media > 0 && IPS_MediaExists($media)) {
        $raw = @base64_decode((string) IPS_GetMediaContent($media));
    } else {
        $srcFile = (string) $this->ReadPropertyString('IPSViewPath');
        $raw     = $srcFile !== '' ? @file_get_contents($srcFile) : false;
    }
    if ($raw === false || $raw === '') {
        echo json_encode(['error' => 'keine IPSView-Quelle (Medienobjekt wählen oder Property IPSViewPath setzen)']);
        return;
    }
    $view   = json_decode($raw, true);
    if (!is_array($view)) { $view = []; }
    $pages  = $view['Pages'] ?? [];
    $byName = [];
    foreach ($pages as $p) {
        if (($p['PageName'] ?? '') !== '') {
            $byName[$p['PageName']] = $p;
        }
    }
    $views = [];
    foreach ($pages as $pg) {
        $name    = ($pg['PageName'] ?? 'Seite') !== '' ? $pg['PageName'] : 'Seite';
        $widgets = [];
        $n       = 0;
        $ext     = ['x' => 600, 'y' => 400];
        LVB_ImportWalk($byName, $pg, 0, 0, $widgets, $n, 0, [], $ext);
        if (count($widgets) === 0) {
            continue;
        }
        $key = $name;
        $i   = 2;
        while (isset($views[$key])) {
            $key = $name . ' (' . $i++ . ')';
        }
        $views[$key] = ['page' => ['w' => (int) ceil($ext['x']) + 16, 'h' => (int) ceil($ext['y']) + 16], 'widgets' => $widgets];
    }
    echo json_encode(['views' => $views, 'current' => array_key_first($views) ?? null]);
    return;
}

// ---- HomeSuite Modul-Transport (generisch):  ?api=mod&op=suite|entities|state|manifest|manage ----
//      Bindet den LVB an die HomeSuite-Modul-Suite. Sicherheit: nur Instanzen aus der HomeSuite-
//      Library (LibraryID-Whitelist) werden angesprochen; op=manage (POST) ist token-gesichert.
//      Voellig inert & fehlerfrei, solange keine HomeSuite-Instanz existiert (Phase-0-additiv).
if ($api === 'mod') {
    header('Content-Type: application/json; charset=utf-8');
    $HS_LIB = '{0F66F23F-ED50-4CD5-AB44-5FC961C7733A}'; // HomeSuite Library-GUID (GUIDS.md, immutabel)
    $HSH    = '{A0C082B4-9E74-430E-BD97-F9CEBB364257}'; // Hub (HSH)
    $op     = (string) ($_GET['op'] ?? 'suite');
    // Prefix eines HomeSuite-Moduls sicher aufloesen (fremde Instanzen -> null).
    $hsPrefix = function (int $iid) use ($HS_LIB): ?string {
        if ($iid <= 0 || !@IPS_InstanceExists($iid)) return null;
        $guid = IPS_GetInstance($iid)['ModuleInfo']['ModuleID'] ?? '';
        $mod  = @IPS_GetModule($guid);
        if (!$mod || (($mod['LibraryID'] ?? '') !== $HS_LIB)) return null;
        return $mod['Prefix'] ?? null;
    };
    if ($op === 'suite' || $op === 'entities' || $op === 'topology') {
        $hub = @IPS_GetInstanceListByModuleID($HSH)[0] ?? 0;
        if (!$hub) { echo json_encode(['ok' => false, 'err' => 'no-hub']); return; }
        $fn = ($op === 'suite') ? 'HSH_GetSuiteManifest' : (($op === 'topology') ? 'HSH_GetTopology' : 'HSH_ListEntities');
        echo function_exists($fn) ? (string) $fn($hub) : json_encode(['ok' => false, 'err' => 'fn']);
        return;
    }
    if ($op === 'hubmanage') { // geteilte Verwaltung ueber den Hub (Profile etc.) — Hub wird aufgeloest
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $hub = @IPS_GetInstanceListByModuleID($HSH)[0] ?? 0;
        if (!$hub || !function_exists('HSH_Manage')) { echo json_encode(['ok' => false, 'err' => 'no-hub']); return; }
        echo (string) HSH_Manage($hub, (string) file_get_contents('php://input'));
        return;
    }
    $iid = (int) ($_GET['id'] ?? 0);
    $pfx = $hsPrefix($iid);
    if ($pfx === null) { http_response_code(404); echo json_encode(['ok' => false, 'err' => 'no-homesuite-instance']); return; }
    if ($op === 'state' || $op === 'manifest') {
        $fn = $pfx . ($op === 'state' ? '_GetState' : '_GetManifest');
        echo function_exists($fn) ? (string) $fn($iid) : json_encode(['ok' => false, 'err' => 'fn']);
        return;
    }
    if ($op === 'manage') {
        if (!hash_equals($TOKEN, (string) ($_GET['key'] ?? ''))) { http_response_code(403); echo json_encode(['ok' => false, 'err' => 'forbidden']); return; }
        $fn = $pfx . '_Manage';
        if (!function_exists($fn)) { echo json_encode(['ok' => false, 'err' => 'fn']); return; }
        echo (string) $fn($iid, (string) file_get_contents('php://input'));
        return;
    }
    echo json_encode(['ok' => false, 'err' => 'op']);
    return;
}

// ---- sonst: Builder-Seite ausliefern ----
$html = @file_get_contents($DIR . '/builder.html');
if ($html === false) {
    http_response_code(500);
    echo 'builder.html fehlt im Modul';
    return;
}
$html = str_replace('__LV_TOKEN__', $TOKEN, $html);
$html = str_replace('__LV_WSPORT__', (string) ($WSPORT ?? ''), $html);     // WebSocket-Push optional (Property)
$html = str_replace('__LV_WSURL__', (string) ($WSURL ?? ''), $html);       // volle wss-Adresse (Reverse Proxy) - schlaegt den Port
$html = str_replace('__LV_RUN__', ($LV_MODE === 'run' ? '1' : ''), $html); // /hook/run/<site> -> Laufzeit
$html = str_replace('__LV_DOKU__', ($LV_MODE === 'doku' ? '1' : ''), $html); // /hook/doku -> Doku/Demo
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate'); // Builder nie cachen -> nach Rebuild immer frisch
// Die Symcon-Hook-Schicht kappt die Ausgabe bei 1 MB. builder.html ist inzwischen groesser;
// daher gzip-komprimiert ausliefern (~250 KB). Bei >1 MB ist gzip Pflicht (best effort fuer
// Clients ohne Accept-Encoding, die praktisch alle gzip verstehen), sonst nur wenn angeboten.
$ae  = (string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '');
$big = strlen($html) > 1000000;
if (function_exists('gzencode') && ($big || stripos($ae, 'gzip') !== false)) {
    $gz = gzencode($html, 6);
    if ($gz !== false && strlen($gz) < strlen($html)) {
        header('Content-Encoding: gzip');
        header('Vary: Accept-Encoding');
        echo $gz;
        return;
    }
}
echo $html;
