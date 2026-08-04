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
    $seen = []; $out = [];
    foreach ([2001 => 'BidCos-RF', 2010 => 'HmIP-RF'] as $port => $iface) {
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
    header('Content-Type: image/jpeg');
    header('Cache-Control: no-store');
    echo @base64_decode(IPS_GetMediaContent($id));
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
echo $html;
