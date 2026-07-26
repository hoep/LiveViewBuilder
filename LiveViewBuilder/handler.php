<?php

/**
 * LiveViewBuilder — WebHook-Dispatch.
 * Wird von ProcessHookData() per include aufgerufen; erwartet im Scope:
 *   $this (Modulinstanz) · $TOKEN (Schreib-Token) · $DIR (Modulordner: builder.html, assets)
 *   · $DATADIR (Datenordner: layouts.json) · $WSPORT (optional WebSocket-Port)
 * Layouts liegen als Datei in $DATADIR/layouts.json (transparent, WS-lesbar, backup-bar).
 */

$api = (string) ($_GET['api'] ?? '');

// Modus aus dem Pfad:  /hook/run/<site> -> Laufzeit ; sonst Builder/Editor
$LV_MODE = 'builder';
$uriPath = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
$seg     = explode('/', trim($uriPath, '/'));
if (($seg[1] ?? '') === 'run') {
    $LV_MODE = 'run';
}

// ---- Statische Assets (ECharts, offline gehostet) ----
if ($api === 'asset') {
    $name  = (string) ($_GET['name'] ?? '');
    $files = ['echarts' => $DIR . '/assets/echarts.min.js'];
    if (!isset($files[$name]) || !is_file($files[$name])) {
        http_response_code(404);
        echo '// not found';
        return;
    }
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=604800');
    readfile($files[$name]);
    return;
}

// ---- Live-Objektbaum (lazy + Suche nach Name/Pfad/ID) ----
if ($api === 'tree') {
    header('Content-Type: application/json; charset=utf-8');
    $search = trim((string) ($_GET['search'] ?? ''));
    if ($search !== '') {
        $idHit = null;
        if (preg_match('/^[0-9]+$/', $search) === 1 && IPS_VariableExists((int) $search)) {
            $vid           = (int) $search;
            $idHit         = LVB_TreeNode($vid);
            $idHit['path'] = LVB_ObjPath($vid);
        }
        $rest = [];
        foreach (IPS_GetVariableList() as $vid) {
            if ($idHit !== null && $vid === (int) $search) {
                continue;
            }
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
    usort($nodes, function ($a, $b) {
        return strnatcasecmp($a['name'], $b['name']);
    });
    echo json_encode(['parent' => $parent, 'path' => LVB_ObjPath($parent), 'nodes' => $nodes]);
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
        if (IPS_VariableExists($id)) {
            if ($since > 0 && IPS_GetVariable($id)['VariableChanged'] < $since) {
                continue;
            }
            $out[$id] = ['v' => GetValue($id), 'f' => @GetValueFormatted($id), 'u' => $sfx($id)];
        }
    }
    echo json_encode(['ts' => time(), 'values' => $out]);
    return;
}

// ---- Assoziationen (Variablenprofil): Wert -> Name/Icon/Farbe  ?api=assoc&id=<id> ----
if ($api === 'assoc') {
    header('Content-Type: application/json; charset=utf-8');
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0 || !IPS_VariableExists($id)) {
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
    if (IPS_VariableExists($id)) {
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
    if ($id <= 0 || !IPS_VariableExists($id)) {
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
    if ($id <= 0 || !IPS_VariableExists($id)) {
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
        json_decode($data);
        if (json_last_error() !== JSON_ERROR_NONE) {
            http_response_code(400);
            echo json_encode(['error' => 'invalid json']);
            return;
        }
        file_put_contents($lf, $data);
        echo json_encode(['ok' => true, 'bytes' => strlen($data)]);
        return;
    }
    $data = @file_get_contents($lf);
    echo ($data !== false && $data !== '') ? $data : json_encode(['pages' => []]);
    return;
}

// ---- Variablen-HTML (für das HTML-Widget) ----
if ($api === 'html') {
    $id = (int) ($_GET['id'] ?? 0);
    if (!IPS_VariableExists($id)) {
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
    if (!IPS_VariableExists($id)) {
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
if ($api === 'agg') { // Min/Max/Avg (zeitgewichtet) einer geloggten Standardvariable ueber die aktuelle Periode
    header('Content-Type: application/json; charset=utf-8');
    $id    = (int) ($_GET['id'] ?? 0);
    $stage = (string) ($_GET['stage'] ?? 'day'); // minute|hour|day|week|month|year
    if (!IPS_VariableExists($id)) { echo json_encode(['min' => null, 'max' => null, 'avg' => null]); return; }
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
    $rows = @AC_GetLoggedValues($ac, $id, $pStart, $now, 0);          // Werte in der Periode (neueste zuerst)
    $bef  = @AC_GetLoggedValues($ac, $id, 0, $pStart, 1);             // letzter Wert vor Periodenstart
    $startVal = (is_array($bef) && count($bef)) ? (float) $bef[0]['Value'] : null;
    $pts = is_array($rows) ? array_reverse($rows) : [];              // aelteste zuerst
    if ($startVal === null && count($pts)) { $startVal = (float) $pts[0]['Value']; }
    $prevT = $pStart; $prevV = $startVal; $sum = 0.0; $min = null; $max = null;
    $acc = function ($v, $t0, $t1) use (&$sum, &$min, &$max) {
        if ($v === null) return;
        $dur = $t1 - $t0; if ($dur < 0) $dur = 0;
        $sum += $v * $dur;
        $min = ($min === null) ? $v : min($min, $v);
        $max = ($max === null) ? $v : max($max, $v);
    };
    foreach ($pts as $r) {
        $t = (int) $r['TimeStamp']; if ($t < $pStart) $t = $pStart; if ($t > $now) $t = $now;
        $acc($prevV, $prevT, $t);
        $prevT = $t; $prevV = (float) $r['Value'];
    }
    $acc($prevV, $prevT, $now);
    $total = $now - $pStart;
    $avg = ($total > 0 && $min !== null) ? $sum / $total : $prevV;
    echo json_encode(['min' => $min, 'max' => $max, 'avg' => $avg]);
    return;
}
if ($api === 'cmp') {
    header('Content-Type: application/json; charset=utf-8');
    $id    = (int) ($_GET['id'] ?? 0);
    $stage = (string) ($_GET['stage'] ?? 'day');     // minute|hour|day|week|month|year
    $kind  = (string) ($_GET['kind'] ?? 'standard'); // standard|counter
    if (!IPS_VariableExists($id)) {
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
    $valAt = function ($t) use ($ac, $id, $lvl, $now) {
        if ($t > $now) $t = $now;
        $r = @AC_GetLoggedValues($ac, $id, 0, $t, 1); // letzter geloggter Wert <= t
        if (is_array($r) && count($r)) return (float) $r[0]['Value'];
        $a = @AC_GetAggregatedValues($ac, $id, $lvl, $t - 3 * 86400, $t, 1); // Fallback (Rohwerte evtl. gepurged)
        return (is_array($a) && count($a)) ? (float) $a[0]['Avg'] : null;
    };

    if ($kind === 'counter') {
        $vn = $valAt($now); $vps = $valAt($pStart);
        $cur  = ($vn !== null && $vps !== null) ? ($vn - $vps) : null;      // Verbrauch in der aktuellen Periode
        $vp1 = $valAt($prevSame); $vp0 = $valAt($prevStart);
        $past = ($vp1 !== null && $vp0 !== null) ? ($vp1 - $vp0) : null;    // Verbrauch Vorperiode (gleiches Fenster)
        echo json_encode(['type' => 1, 'cur' => $cur, 'past' => $past]);
        return;
    }
    $cn   = @GetValue($id);
    $cur  = is_numeric($cn) ? (float) $cn : $valAt($now); // aktueller Wert
    $past = $valAt($prevSame);                            // Wert zum selben Zeitpunkt der Vorperiode
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
$html = str_replace('__LV_RUN__', ($LV_MODE === 'run' ? '1' : ''), $html); // /hook/run/<site> -> Laufzeit
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate'); // Builder nie cachen -> nach Rebuild immer frisch
echo $html;
