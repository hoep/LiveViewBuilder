<?php

declare(strict_types=1);

// Geteilte Helfer für LiveViewBuilder (Objektbaum, IPSView-Import, iCal).

function LVB_TreeNode(int $id): array
{
    $o    = IPS_GetObject($id);
    $node = [
        'id'       => $id,
        'name'     => $o['ObjectName'],
        'type'     => $o['ObjectType'], // 0 Kat, 1 Instanz, 2 Variable, 3 Skript, 4 Ereignis, 5 Media, 6 Link
        'pos'      => $o['ObjectPosition'], // Reihenfolge wie in der Symcon-Konsole (Position, dann Name)
        'children' => count($o['ChildrenIDs']) > 0,
    ];
    if ($o['ObjectType'] === 2 && IPS_VariableExists($id)) {
        $v    = IPS_GetVariable($id);
        $prof = $v['VariableCustomProfile'] !== '' ? $v['VariableCustomProfile'] : $v['VariableProfile'];
        $node['vtype']  = $v['VariableType']; // 0 bool 1 int 2 float 3 string
        $node['action'] = ($v['VariableAction'] > 0 || $v['VariableCustomAction'] > 0);
        $node['value']  = @GetValueFormatted($id);
        if ($prof !== '' && IPS_VariableProfileExists($prof)) {
            $p = IPS_GetVariableProfile($prof);
            $node['unit']   = $p['Suffix'];
            $node['digits'] = $p['Digits'];
            $node['profile'] = $prof;
        }
    }
    return $node;
}

function LVB_ObjPath(int $id): string
{
    $parts = [];
    $cur   = $id;
    $guard = 0;
    while ($cur > 0 && $guard < 15) {
        $o       = IPS_GetObject($cur);
        $parts[] = $o['ObjectName'];
        $cur     = $o['ParentID'];
        $guard++;
    }
    return implode(' / ', array_reverse($parts));
}

function LVB_ImportWalk(array &$byName, array $pg, int $ox, int $oy, array &$widgets, int &$n, int $depth, array $visited, array &$ext): void
{
    if ($depth > 4) {
        return;
    }
    foreach (($pg['Controls'] ?? []) as $c) {
        if (($c['Type'] ?? '') === 'IPSInlinePage') {
            $ref = (string) ($c['Text1'] ?? '');
            if ($ref !== '' && isset($byName[$ref]) && !in_array($ref, $visited, true)) {
                LVB_ImportWalk(
                    $byName,
                    $byName[$ref],
                    $ox + (int) round((float) ($c['LocationX'] ?? 0)),
                    $oy + (int) round((float) ($c['LocationY'] ?? 0)),
                    $widgets,
                    $n,
                    $depth + 1,
                    array_merge($visited, [$ref]),
                    $ext
                );
            }
            continue;
        }
        $w = LVB_ImportControl($c, ++$n, $ox, $oy);
        if ($w === null) {
            continue;
        }
        $widgets[]  = $w;
        $ext['x']   = max($ext['x'], $w['x'] + $w['w']);
        $ext['y']   = max($ext['y'], $w['y'] + $w['h']);
    }
}

function LVB_ImportControl(array $c, int $n, int $ox = 0, int $oy = 0): ?array
{
    $type = $c['Type'] ?? '';
    $x    = (int) round((float) ($c['LocationX'] ?? 0)) + $ox;
    $y    = (int) round((float) ($c['LocationY'] ?? 0)) + $oy;
    $w    = (int) round((float) ($c['Width'] ?? 0));
    $h    = (int) round((float) ($c['Height'] ?? 0));
    $id   = (int) ($c['ItemID'] ?? 0);   // FIX: Objekt-/Variablen-ID steht in ItemID, nicht in ID
    $text = (string) ($c['Text1'] ?? '');
    $base = ['id' => 'i' . $n, 'x' => $x, 'y' => $y];
    $suf  = (string) ($c['Suffix'] ?? '');
    $fg   = LVB_Color($c['ForeColor1'] ?? null);
    $wg   = is_array($c['Widget'] ?? null) ? $c['Widget'] : [];
    $mnMax = function ($dmn, $dmx) use ($c, $wg) {
        return [
            (float) ($c['Min'] ?? $wg['minvalue'] ?? $dmn),
            (float) ($c['Max'] ?? $wg['maxvalue'] ?? $dmx),
        ];
    };

    switch ($type) {
        case 'IPSTxtLabel':
        case 'IPSTextBox':
            if ($text === '') $text = (string) ($c['Text2'] ?? '');
            if ($text === '') return null;
            $r = ['type' => 'text', 'w' => $w > 0 ? $w : 140, 'h' => $h > 0 ? $h : 26, 'label' => $text];
            if ($fg !== '') $r['fg'] = $fg;
            return $base + $r;
        case 'IPSMarquee':
            return $base + ['type' => 'text', 'w' => $w > 0 ? $w : 220, 'h' => $h > 0 ? $h : 30, 'label' => $text];
        case 'IPSVarLabel':
        case 'IPSFlowText':
            if ($id <= 0) return null;
            $r = ['type' => 'value', 'w' => $w > 0 ? $w : 90, 'h' => $h > 0 ? $h : 40, 'varId' => $id, 'label' => '', 'valfs' => ($type === 'IPSFlowText' ? 11 : 15)];
            if ($suf !== '') $r['unit'] = $suf;
            if ($fg !== '') $r['fg'] = $fg;
            return $base + $r;
        case 'IPSValueImage':
        case 'IPSAssociationImage':
            if ($id <= 0) return null;
            $states = [];
            foreach (($c['Associations'] ?? []) as $a) {
                $mi = (int) ($a['Image'] ?? 0);
                if ($mi > 0) $states[] = ['value' => $a['Value'] ?? 0, 'mediaId' => $mi];
            }
            $r = ['type' => 'statusimage', 'w' => $w > 0 ? $w : 60, 'h' => $h > 0 ? $h : 60, 'varId' => $id, 'label' => $text, 'states' => $states];
            $f1 = (int) ($c['Image1'] ?? 0);
            if ($f1 > 0) $r['mediaId'] = $f1;
            return $base + $r;
        case 'IPSImage':
        case 'IPSDetailImage':
        case 'IPSInlineImage':
        case 'IPSRangeImage':
            $mi = (int) ($c['Image1'] ?? 0);
            if ($mi <= 0) return null;
            return $base + ['type' => 'image', 'w' => $w > 0 ? $w : 80, 'h' => $h > 0 ? $h : 80, 'mediaId' => $mi, 'label' => $text];
        case 'IPSValueButton':
        case 'IPSButton':
        case 'IPSInlineButton':
        case 'IPSDetailButton':
            $lbl = $text !== '' ? $text : (string) ($c['Text2'] ?? '');
            $r = ['type' => 'button', 'w' => $w > 0 ? $w : 110, 'h' => $h > 0 ? $h : 60, 'label' => $lbl];
            if ($id > 0) $r['varId'] = $id;
            return $base + $r;
        case 'IPSAssociationButton':
            if ($id <= 0) return null;
            $opts = [];
            foreach (($c['Associations'] ?? []) as $a) {
                $opts[] = ['value' => $a['Value'] ?? 0, 'text' => (string) ($a['Text'] ?? ''), 'color' => LVB_Color($a['ForeColor'] ?? null)];
            }
            return $base + ['type' => 'select', 'w' => $w > 0 ? $w : 220, 'h' => $h > 0 ? $h : 44, 'varId' => $id, 'label' => $text, 'options' => $opts];
        case 'IPSToggleButton':
        case 'IPSToggleImage':
        case 'IPSSwitch':
        case 'IPSCheckBox':
            if ($id <= 0) return null;
            return $base + ['type' => 'switch', 'w' => $w > 0 ? $w : 120, 'h' => $h > 0 ? $h : 40, 'varId' => $id, 'label' => $text];
        case 'IPSProgressbar':
            if ($id <= 0) return null;
            [$mn, $mx] = $mnMax(0, 100);
            return $base + ['type' => 'bar', 'w' => $w > 0 ? $w : 180, 'h' => $h > 0 ? $h : 40, 'varId' => $id, 'min' => $mn, 'max' => $mx, 'label' => $text];
        case 'IPSRangeButton':
        case 'IPSSlider':
        case 'IPSSliderVertical':
            if ($id <= 0) return null;
            [$mn, $mx] = $mnMax(0, 100);
            $st = (float) ($c['Step'] ?? $wg['step'] ?? 1);
            return $base + ['type' => 'slider', 'w' => $w > 0 ? $w : 200, 'h' => $h > 0 ? $h : 60, 'varId' => $id, 'min' => $mn, 'max' => $mx, 'step' => ($st > 0 ? $st : 1), 'label' => $text];
        case 'IPSWidgetCircleSlider':
        case 'IPSWidgetCircleRangeSlider':
            if ($id <= 0) return null;
            [$mn, $mx] = $mnMax(0, 100);
            $st = (float) ($c['Step'] ?? $wg['step'] ?? 1);
            $r  = ['type' => 'dial', 'w' => $w > 0 ? $w : 150, 'h' => $h > 0 ? $h : 150, 'varId' => $id, 'min' => $mn, 'max' => $mx, 'step' => ($st > 0 ? $st : 1), 'label' => $text];
            if ((int) ($wg['id2'] ?? 0) > 0) $r['varId2'] = (int) $wg['id2'];
            return $base + $r;
        case 'IPSWidgetGauge':
            if ($id <= 0) return null;
            // Zonen-Farben aus Associations -> gaugepro (t1/t2 aus sortierten Schwellen)
            $zones = [];
            foreach (($c['Associations'] ?? []) as $a) {
                if (isset($a['Value'])) $zones[] = (float) $a['Value'];
            }
            [$gmn, $gmx] = $mnMax(0, (float) ($wg['maxvalue'] ?? 100));
            if (count($zones) >= 2) {
                sort($zones);
                return $base + ['type' => 'gaugepro', 'w' => $w > 0 ? $w : 150, 'h' => $h > 0 ? $h : 150, 'varId' => $id, 'label' => $text, 'min' => $gmn, 'max' => ($gmx > $gmn ? $gmx : 100), 't1' => $zones[0], 't2' => $zones[1]];
            }
            return $base + ['type' => 'gauge', 'w' => $w > 0 ? $w : 140, 'h' => $h > 0 ? $h : 130, 'varId' => $id, 'label' => $text];
        case 'IPSWebView':
            $url = (string) ($c['Text1'] ?? '');
            return $base + ['type' => 'webview', 'w' => $w > 0 ? $w : 320, 'h' => $h > 0 ? $h : 240, 'url' => $url, 'label' => $text];
        case 'IPSWidgetWeekplan':
            if ($id <= 0) return null;
            return $base + ['type' => 'weekplan', 'w' => $w > 0 ? $w : 340, 'h' => $h > 0 ? $h : 180, 'varId' => $id, 'label' => $text !== '' ? $text : 'Wochenplan'];
        case 'IPSWidgetTimer':
            if ($id <= 0) return null;
            return $base + ['type' => 'timer', 'w' => $w > 0 ? $w : 180, 'h' => $h > 0 ? $h : 56, 'varId' => $id, 'label' => $text];
        case 'IPSHTMLBox':
            if ($id <= 0) return null;
            return $base + ['type' => 'html', 'w' => $w > 0 ? $w : 300, 'h' => $h > 0 ? $h : 200, 'varId' => $id, 'label' => ''];
        case 'IPSFlowLine':
            $col = '#00cdab';
            if (isset($c['Widget']['flowcolorpositive'])) {
                $rgb = array_map('intval', explode(';', (string) $c['Widget']['flowcolorpositive']));
                if (count($rgb) === 3) {
                    $col = sprintf('#%02X%02X%02X', $rgb[0], $rgb[1], $rgb[2]);
                }
            }
            return $base + ['type' => 'line', 'w' => $w > 0 ? $w : 80, 'h' => $h > 0 ? $h : 40, 'color' => $col];
        case 'IPSShapeRect':
        case 'IPSShapeCircle':
        case 'IPSShapeLineH':
        case 'IPSShapeLineV':
            $col = LVB_Color($c['BackColor1'] ?? null);
            if ($col === '') $col = '#1b2a30';
            $sh = $type === 'IPSShapeCircle' ? 'circle' : (($type === 'IPSShapeLineH' || $type === 'IPSShapeLineV') ? 'line' : 'rect');
            return $base + ['type' => 'shape', 'w' => $w > 0 ? $w : 40, 'h' => $h > 0 ? $h : 40, 'shape' => $sh, 'color' => $col];
        case 'IPSMedia':
            if ($id <= 0) return null;
            return $base + ['type' => 'camera', 'w' => $w > 0 ? $w : 240, 'h' => $h > 0 ? $h : 150, 'mediaId' => $id, 'label' => $text];
        default:
            return null; // sehr seltene (Weekplan/WebView …) vorerst überspringen
    }
}

// ARGB-Objekt {A,R,G,B,ColorID} -> #RRGGBB ('' wenn leer/transparent)
function LVB_Color($col): string
{
    if (!is_array($col)) return '';
    $r = (int) ($col['R'] ?? -1);
    if ($r < 0) return '';
    $a = (int) ($col['A'] ?? 255);
    if ($a === 0) return '';
    return sprintf('#%02X%02X%02X', $r, (int) ($col['G'] ?? 0), (int) ($col['B'] ?? 0));
}

function LVB_Fetch(string $url, string $user, string $pass): string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 45, CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        if ($user !== '') {
            curl_setopt($ch, CURLOPT_USERPWD, $user . ':' . $pass);
        }
        $r = curl_exec($ch);
        curl_close($ch);
        return is_string($r) ? $r : '';
    }
    $ctx = stream_context_create(['http' => ['timeout' => 12,
        'header' => $user !== '' ? ('Authorization: Basic ' . base64_encode($user . ':' . $pass)) : '']]);
    $r = @file_get_contents($url, false, $ctx);
    return is_string($r) ? $r : '';
}

function LVB_Unesc(string $s): string
{
    return str_replace(['\\n', '\\N', '\\,', '\\;', '\\\\'], ["\n", "\n", ',', ';', '\\'], $s);
}

function LVB_ICSTime(string $v): int
{
    $v = trim($v);
    if (preg_match('/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2}))?(Z)?/', $v, $m)) {
        $h = $m[5] ?? '00'; $mi = $m[6] ?? '00'; $s = $m[7] ?? '00';
        if (!empty($m[8])) {
            return gmmktime((int) $h, (int) $mi, (int) $s, (int) $m[2], (int) $m[3], (int) $m[1]);
        }
        return mktime((int) $h, (int) $mi, (int) $s, (int) $m[2], (int) $m[3], (int) $m[1]);
    }
    return 0;
}

function LVB_Occurrences(array $ev, int $from, int $to): array
{
    $start = $ev['start'];
    $dur   = isset($ev['end']) && $ev['end'] > $start ? ($ev['end'] - $start) : (!empty($ev['allday']) ? 86400 : 3600);
    $mk = function ($st) use ($ev, $dur) {
        return ['start' => $st * 1000, 'end' => ($st + $dur) * 1000, 'title' => $ev['title'] ?? '', 'allDay' => !empty($ev['allday'])];
    };
    if (empty($ev['rrule'])) {
        return ($start < $to && $start + $dur >= $from) ? [$mk($start)] : [];
    }
    $r = [];
    foreach (explode(';', $ev['rrule']) as $kv) {
        $x = explode('=', $kv, 2);
        if (count($x) === 2) $r[strtoupper($x[0])] = $x[1];
    }
    $freq = strtoupper($r['FREQ'] ?? '');
    $interval = max(1, (int) ($r['INTERVAL'] ?? 1));
    $count = isset($r['COUNT']) ? (int) $r['COUNT'] : 0;
    $until = isset($r['UNTIL']) ? LVB_ICSTime($r['UNTIL']) : 0;
    $limit = $until > 0 ? min($to, $until) : $to;
    // EXDATE: gestrichene Einzeltermine einer Serie. Ohne sie erscheint ein
    // abgesagter Termin weiter - fuer den Betrachter ein Fehler, nicht ein Detail.
    $aus = [];
    foreach (($ev['exdate'] ?? []) as $x) {
        $t = LVB_ICSTime($x);
        if ($t > 0) { $aus[date('Y-m-d', $t)] = true; }
    }
    $out = []; $st = $start; $n = 0; $g = 0;
    while ($st <= $limit && $g < 1500) {
        $g++;
        if ($count > 0 && $n >= $count) break;
        if ($st < $to && $st + $dur >= $from && empty($aus[date('Y-m-d', $st)])) $out[] = $mk($st);
        $n++;
        $Y = (int) date('Y', $st); $M = (int) date('n', $st); $D = (int) date('j', $st);
        $h = (int) date('G', $st); $mi = (int) date('i', $st); $s = (int) date('s', $st);
        if     ($freq === 'DAILY')   $st = mktime($h, $mi, $s, $M, $D + $interval, $Y);
        elseif ($freq === 'WEEKLY')  $st = mktime($h, $mi, $s, $M, $D + 7 * $interval, $Y);
        elseif ($freq === 'MONTHLY') $st = mktime($h, $mi, $s, $M + $interval, $D, $Y);
        elseif ($freq === 'YEARLY')  $st = mktime($h, $mi, $s, $M, $D, $Y + $interval);
        else break;
    }
    return $out;
}

/**
 * Zugangsdaten zu einer URL, falls hinterlegt.
 *
 * Sie stehen EINMALIG in scripts/data/ical/zugang.json (Rechte 0600), damit im
 * Layout nur Adressen stehen und keine Passwoerter - ein Layout wird gesichert,
 * kopiert und weitergegeben, eine Zugangsdatei nicht. Der Schluessel ist der
 * Praefix bis zum Benutzerordner, also etwa
 * "https://mail.example.org/SOGo/dav/peter@example.org/".
 */
function LVB_ICSZugang(string $url): array
{
    static $tabelle = null;
    if ($tabelle === null) {
        $d = __DIR__ . '/../../../scripts/data/ical/zugang.json';
        $tabelle = is_file($d) ? (json_decode((string) @file_get_contents($d), true) ?: []) : [];
    }
    foreach ($tabelle as $praefix => $z) {
        if (strncmp($url, (string) $praefix, strlen((string) $praefix)) === 0) {
            return [(string) ($z['user'] ?? ''), (string) ($z['pass'] ?? '')];
        }
    }
    return ['', ''];
}

/**
 * CalDAV: nur das gefragte Zeitfenster holen, statt den ganzen Kalender.
 *
 * WARUM: Der berufliche Kalender umfasst 5250 Termine. SOGo serialisiert beim
 * ICS-Export JEDES MAL die komplette Historie - gemessen 23,2 Sekunden bis zum
 * ersten Byte, waehrend die Uebertragung der 5,5 MB nur 0,14 s dauert. Es ist
 * also reine Rechenzeit am Server. Ein REPORT mit time-range laesst ihn nur die
 * angefragten Wochen serialisieren: 226 KB, 111 Termine, 0,25 s.
 *
 * Zusaetzlich loest <C:expand> die Wiederholungen SERVERSEITIG auf - damit sind
 * auch die Eintraege mit fehlerhaftem "COUNT=0" kein Thema mehr.
 *
 * Die Collection-Adresse ergibt sich aus der Export-URL: ".ics" wird zu "/".
 * Antwortet der Server nicht als CalDAV, liefert die Funktion '' und der
 * Aufrufer faellt auf den gewohnten ICS-Abruf zurueck.
 */
function LVB_CalDAV(string $exportUrl, string $user, string $pass, int $von, int $bis): string
{
    if (!preg_match('/\.ics$/i', $exportUrl)) { return ''; }
    $coll = preg_replace('/\.ics$/i', '/', $exportUrl);
    $v = gmdate('Ymd\THis\Z', $von);
    $b = gmdate('Ymd\THis\Z', $bis);
    $xml = '<?xml version="1.0" encoding="utf-8" ?>'
         . '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">'
         . '<D:prop><C:calendar-data><C:expand start="' . $v . '" end="' . $b . '"/></C:calendar-data></D:prop>'
         . '<C:filter><C:comp-filter name="VCALENDAR"><C:comp-filter name="VEVENT">'
         . '<C:time-range start="' . $v . '" end="' . $b . '"/>'
         . '</C:comp-filter></C:comp-filter></C:filter></C:calendar-query>';
    $ch = curl_init($coll);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => 'REPORT',
        CURLOPT_POSTFIELDS => $xml, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER => ['Depth: 1', 'Content-Type: application/xml; charset=utf-8'],
    ]);
    if ($user !== '') {
        curl_setopt($ch, CURLOPT_USERPWD, $user . ':' . $pass);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_ANY);
    }
    $antwort = (string) curl_exec($ch);
    $code    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 207 || $antwort === '') { return ''; }

    // Die Termine stecken als <calendar-data> im Multistatus-XML. Herausloesen,
    // Entities aufloesen und zu EINEM VCALENDAR zusammensetzen.
    if (!preg_match_all('#<[A-Za-z]*:?calendar-data[^>]*>(.*?)</[A-Za-z]*:?calendar-data>#si', $antwort, $m)) {
        return '';
    }
    $teile = [];
    foreach ($m[1] as $stueck) {
        $stueck = html_entity_decode($stueck, ENT_QUOTES | ENT_XML1, 'UTF-8');
        if (preg_match_all('#BEGIN:VEVENT.*?END:VEVENT#s', $stueck, $ev)) {
            foreach ($ev[0] as $e) { $teile[] = $e; }
        }
    }
    if (!$teile) { return ''; }
    return "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//LVB//CalDAV//DE\n"
         . implode("\n", $teile) . "\nEND:VCALENDAR\n";
}

/**
 * ICS einer Quelle besorgen. DREI QUELLENARTEN, damit der Kalender nicht am
 * iCal-Calendar-Reader-Modul haengt:
 *
 *   <Zahl>   Instanz des Readers  -> URL + Zugangsdaten aus dessen Konfiguration
 *   <Zahl>   Symcon-Medienobjekt  -> Inhalt direkt, OHNE Netzzugriff
 *   http…    URL                  -> direkt geladen
 *
 * Instanz und URL werden ZWISCHENGESPEICHERT (data/ical/<hash>.ics). Vorher lud
 * jeder einzelne Seitenaufruf die ICS erneut vom Server - bei mehreren offenen
 * Ansichten ein Vielfaches, mit Zugangsdaten bei jedem Mal.
 */
function LVB_ICSQuelle(string $spec, int $ttlSek = 1800, int $von = 0, int $bis = 0): string
{
    $spec = trim($spec);
    if ($spec === '') { return ''; }

    $url = ''; $user = ''; $pass = '';
    if (preg_match('#^https?://#i', $spec)) {
        $url = $spec;
        [$user, $pass] = LVB_ICSZugang($url);   // aus der Zugangsdatei, nicht aus dem Layout
    } elseif (ctype_digit($spec)) {
        $id = (int) $spec;
        // Medienobjekt: liegt bereits lokal, also kein Netz und kein Cache noetig
        if (function_exists('IPS_MediaExists') && IPS_MediaExists($id)) {
            $roh = @IPS_GetMediaContent($id);
            return $roh === false ? '' : (string) base64_decode($roh);
        }
        if (function_exists('IPS_InstanceExists') && IPS_InstanceExists($id)) {
            $cfg = json_decode(IPS_GetConfiguration($id), true);
            if (!is_array($cfg)) { $cfg = []; }
            $url  = (string) ($cfg['CalendarServerURL'] ?? '');
            $user = (string) ($cfg['Username'] ?? '');
            $pass = (string) ($cfg['Password'] ?? '');
            // Das Modul kennt sein eigenes Abrufintervall - das ist die ehrlichste TTL.
            $uf = (int) ($cfg['UpdateFrequency'] ?? 0);
            if ($uf > 0) { $ttlSek = max(300, $uf * 60); }
        }
    }
    if ($url === '') { return ''; }

    // __DIR__ ist .../modules/LiveViewBuilder/LiveViewBuilder - drei Ebenen hoch
    // liegt /var/lib/symcon, darunter scripts/data.
    $ordner = __DIR__ . '/../../../scripts/data/ical';
    if (!is_dir($ordner)) { @mkdir($ordner, 0775, true); }
    $datei = $ordner . '/' . md5($url) . '.ics';
    $vorhanden = is_file($datei) ? (string) @file_get_contents($datei) : '';
    if ($vorhanden !== '' && (time() - filemtime($datei)) < $ttlSek) {
        return $vorhanden;
    }
    // NIEMAND soll im Seitenaufruf auf einen Kalender warten. Ein grosser Kalender
    // (5,5 MB, 5250 Termine) braucht ueber 20 Sekunden - das darf nicht am Besucher
    // haengen. Gibt es einen - auch veralteten - Stand, wird DER geliefert; das
    // Nachladen erledigt der Vorlader (Skript-Ident LVBIcalVorlader) im Hintergrund.
    // Nur wenn ueberhaupt nichts da ist, wird synchron geladen.
    if ($vorhanden !== '' && empty($GLOBALS['LVB_ICS_ERZWINGEN'])) {
        @touch($datei, time() - $ttlSek + 60);   // in einer Minute nochmal ansehen
        return $vorhanden;
    }
    // Erst CalDAV mit Zeitfenster versuchen - das ist um Groessenordnungen
    // schneller. Nur wenn das nichts liefert, den vollen Export holen.
    $ics = '';
    if ($von > 0 && $bis > $von) {
        $ics = LVB_CalDAV($url, $user, $pass, $von, $bis);
    }
    if ($ics === '') { $ics = LVB_Fetch($url, $user, $pass); }
    if ($ics !== '') {
        @file_put_contents($datei . '.tmp', $ics);
        @rename($datei . '.tmp', $datei);       // erst daneben, dann umbenennen
        return $ics;
    }
    // Abruf gescheitert: lieber ein alter Stand als gar keine Termine.
    return is_file($datei) ? (string) @file_get_contents($datei) : '';
}

function LVB_ParseICS(string $ics, int $from, int $to): array
{
    $ics = str_replace("\r\n", "\n", $ics);
    $ics = preg_replace("/\n[ \t]/", '', $ics); // RFC5545 line unfolding
    $events = [];
    $cur = null;
    foreach (explode("\n", $ics) as $ln) {
        if (strpos($ln, 'BEGIN:VEVENT') === 0) { $cur = []; continue; }
        if (strpos($ln, 'END:VEVENT') === 0) {
            if (is_array($cur) && isset($cur['start'])) {
                foreach (LVB_Occurrences($cur, $from, $to) as $o) $events[] = $o;
            }
            $cur = null; continue;
        }
        if ($cur === null) continue;
        $p = strpos($ln, ':');
        if ($p === false) continue;
        $key = substr($ln, 0, $p);
        $val = substr($ln, $p + 1);
        $name = strtoupper(explode(';', $key)[0]);
        if     ($name === 'SUMMARY') $cur['title'] = LVB_Unesc($val);
        elseif ($name === 'DTSTART') { $cur['start'] = LVB_ICSTime($val); $cur['allday'] = (stripos($key, 'VALUE=DATE') !== false && stripos($key, 'DATE-TIME') === false); }
        elseif ($name === 'DTEND')   $cur['end'] = LVB_ICSTime($val);
        elseif ($name === 'RRULE')   $cur['rrule'] = trim($val);
        elseif ($name === 'EXDATE')  {
            // Mehrfach erlaubt und je Zeile kommasepariert: alles sammeln.
            foreach (explode(',', $val) as $x) { $cur['exdate'][] = trim($x); }
        }
    }
    return $events;
}

// ===== Rechenformeln fuer Variablenbindungen ==========================================
// Ein Variablenfeld darf statt einer ID eine Formel "=Ausdruck" enthalten. Erlaubt sind
// + - * / und Klammern. Ein Zahlentoken ist eine VARIABLE, wenn es mit '#' beginnt ODER
// eine Ganzzahl >= 10000 ist (IPS-Objekt-IDs sind fuenfstellig); alles andere (Dezimalzahl
// oder Ganzzahl < 10000) ist eine KONSTANTE. Beispiele:  =45552+49633   =(#<ID>+#<ID>)/2
// Der Kern ist ein Shunting-Yard-Parser nach RPN; identisch in JS (06-live.js) nachgebaut.

function LVB_IsFormula($s): bool
{
    return is_string($s) && isset($s[0]) && $s[0] === '=';
}

function LVB_FormulaVarId(string $tok) // -> int|null (Variablen-ID) oder null (keine Variable)
{
    if ($tok === '') return null;
    if ($tok[0] === '#' && substr($tok, 1) !== '' && ctype_digit(substr($tok, 1))) return (int) substr($tok, 1);
    if (ctype_digit($tok) && (int) $tok >= 10000) return (int) $tok; // blanke fuenfstellige ID
    return null;
}

function LVB_FormulaParse(string $expr) // -> array RPN-Tokens oder null bei Fehler
{
    $s = ltrim($expr);
    if (isset($s[0]) && $s[0] === '=') $s = substr($s, 1);
    $n = strlen($s); $i = 0; $out = []; $ops = [];
    $prec = ['u-' => 3, '*' => 2, '/' => 2, '+' => 1, '-' => 1];
    $prev = ''; // '', '(', 'op', 'num' -> zur Erkennung des unaeren Minus
    while ($i < $n) {
        $c = $s[$i];
        if (ctype_space($c)) { $i++; continue; }
        if ($c === '#' || ctype_digit($c) || $c === '.') {
            $j = $i; if ($c === '#') $j++;
            while ($j < $n && (ctype_digit($s[$j]) || $s[$j] === '.')) $j++;
            $out[] = substr($s, $i, $j - $i); $i = $j; $prev = 'num'; continue;
        }
        if ($c === '(') { $ops[] = '('; $i++; $prev = '('; continue; }
        if ($c === ')') {
            while ($ops && end($ops) !== '(') $out[] = array_pop($ops);
            if (!$ops) return null; array_pop($ops); $i++; $prev = 'num'; continue;
        }
        if (strpos('+-*/', $c) !== false) {
            $op = $c;
            if ($op === '-' && ($prev === '' || $prev === '(' || $prev === 'op')) $op = 'u-';
            if ($op !== 'u-') {
                while ($ops && end($ops) !== '(' && $prec[end($ops)] >= $prec[$op]) $out[] = array_pop($ops);
            }
            $ops[] = $op; $i++; $prev = 'op'; continue;
        }
        return null; // unbekanntes Zeichen
    }
    while ($ops) { $t = array_pop($ops); if ($t === '(') return null; $out[] = $t; }
    return $out ? $out : null;
}

function LVB_FormulaIds(string $expr): array
{
    $rpn = LVB_FormulaParse($expr); if (!$rpn) return [];
    $ids = [];
    foreach ($rpn as $t) { $v = LVB_FormulaVarId($t); if ($v !== null) $ids[$v] = true; }
    return array_keys($ids);
}

function LVB_FormulaEval(string $expr, array $vals) // vals: id -> float ; -> float|null
{
    $rpn = LVB_FormulaParse($expr); if (!$rpn) return null;
    $st = [];
    foreach ($rpn as $t) {
        if ($t === 'u-') { if (!$st) return null; $st[] = -array_pop($st); continue; }
        if ($t === '+' || $t === '-' || $t === '*' || $t === '/') {
            if (count($st) < 2) return null; $b = array_pop($st); $a = array_pop($st);
            if     ($t === '+') $st[] = $a + $b;
            elseif ($t === '-') $st[] = $a - $b;
            elseif ($t === '*') $st[] = $a * $b;
            else                $st[] = ((float) $b == 0.0) ? 0.0 : $a / $b; // Division durch 0 -> 0
            continue;
        }
        $vid = LVB_FormulaVarId($t);
        if ($vid !== null) $st[] = isset($vals[$vid]) ? (float) $vals[$vid] : 0.0;
        else               $st[] = (float) $t; // Konstante
    }
    return count($st) === 1 ? $st[0] : null;
}

// ===== Homematic-CCU: Servicemeldungen lesen/bestaetigen (nur IP noetig) ==============
// Liste via XML-RPC getServiceMessages (BidCos 2001 + HmIP 2010), Geraetenamen via ReGaHss
// (8181, ID_DEVICES), Bestaetigen via ReGaHss AL-<Adresse>.<Typ> -> AlReceipt(). Kein Passwort
// noetig im LAN. IP wird auf private Netze beschraenkt (SSRF-Schutz).

function LVB_HmPrivateIp($ip): bool
{
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false) return false;
    // Oeffentliche/Sonder-Adressen ablehnen: nur private LAN-Ziele erlaubt.
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
}

function LVB_HmXmlRpc(string $ip, int $port, string $method, int $timeout = 6)
{
    $body = '<?xml version="1.0"?><methodCall><methodName>' . $method . '</methodName><params></params></methodCall>';
    $ch = curl_init("http://$ip:$port/");
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_HTTPHEADER => ['Content-Type: text/xml']]);
    $r = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ($code == 200) ? $r : null;
}

function LVB_HmRega(string $ip, string $script, int $timeout = 8)
{
    $ch = curl_init("http://$ip:8181/tclrega.exe");
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $script, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 4]);
    $r = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code != 200 || $r === false) return null;
    $p = strpos($r, '<xml>');                     // ReGaHss haengt <xml>...</xml> an die Ausgabe an
    if ($p !== false) $r = substr($r, 0, $p);
    return $r;
}

function LVB_HmUtf8($s): string
{
    // ReGaHss liefert je nach Firmware ISO-8859-1 oder UTF-8; sauber nach UTF-8 vereinheitlichen.
    return (mb_detect_encoding($s, 'UTF-8', true) === 'UTF-8') ? $s : mb_convert_encoding($s, 'UTF-8', 'ISO-8859-1');
}

function LVB_HmParseServiceMessages($xml): array
{
    $out = [];
    if (!$xml) return $out;
    $prev = libxml_use_internal_errors(true);
    $sx = simplexml_load_string($xml);
    libxml_use_internal_errors($prev);
    if (!$sx) return $out;
    $items = $sx->xpath('//params/param/value/array/data/value'); // aeussere Array-Eintraege = je eine Meldung
    if (!$items) return $out;
    foreach ($items as $it) {
        $vals = $it->xpath('./array/data/value');                 // Tripel [Adresse, Typ, Wert]
        if (!$vals || count($vals) < 2) continue;
        // Der Wert steht getypt als <value><boolean>1</boolean></value> - der direkte Text ist
        // dann leer, die "1" steckt im Kindknoten. Also erst direkten Text, sonst Kind lesen.
        $v = '1';
        if (isset($vals[2])) {
            $v = trim((string) $vals[2]);
            if ($v === '') { foreach ($vals[2]->children() as $c) { $v = trim((string) $c); break; } }
        }
        $out[] = ['addr' => trim((string) $vals[0]), 'type' => trim((string) $vals[1]), 'val' => $v];
    }
    return $out;
}

function LVB_HmNameMap(string $ip, string $dir): array
{
    // Adresse(Geraet) -> Name; 10 min gecacht je CCU (aendert sich selten, 145 Geraete).
    $cf = rtrim($dir, '/') . '/hm-names-' . md5($ip) . '.json';
    if (is_file($cf) && (time() - filemtime($cf) < 600)) {
        $c = json_decode((string) @file_get_contents($cf), true);
        if (is_array($c) && $c) return $c;
    }
    $r = LVB_HmRega($ip, 'string s;object d;foreach(s,dom.GetObject(ID_DEVICES).EnumUsedIDs()){d=dom.GetObject(s);WriteLine(d.Address()#"\t"#d.Name());}');
    $map = [];
    if ($r !== null) {
        foreach (preg_split('/\r?\n/', $r) as $ln) {
            if (strpos($ln, "\t") === false) continue;
            [$a, $n] = explode("\t", $ln, 2);
            $a = trim($a); $n = trim($n);
            if ($a !== '') $map[$a] = LVB_HmUtf8($n);
        }
    }
    if ($map) @file_put_contents($cf, json_encode($map, JSON_UNESCAPED_UNICODE));
    return $map;
}

