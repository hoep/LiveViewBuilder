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
            CURLOPT_TIMEOUT        => 12,
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
    $out = []; $st = $start; $n = 0; $g = 0;
    while ($st <= $limit && $g < 1500) {
        $g++;
        if ($count > 0 && $n >= $count) break;
        if ($st < $to && $st + $dur >= $from) $out[] = $mk($st);
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
    }
    return $events;
}

