<?php
/**
 * Geo-Beschaffung fuer das Widget "sunscene" — universell fuer BELIEBIGE Koordinaten.
 *
 *  Holt Gebaeudegrundrisse (und spaeter Untergrund) aus OpenStreetMap ueber Overpass,
 *  rechnet sie in LOKALE METER relativ zum Standort um, vereinfacht die Polygone und
 *  legt das Ergebnis als kompakte JSON-Datei im Cache ab.
 *
 *  WICHTIG: Diese Datei laeuft NICHT im Hook-Thread (der wuerde bei langsamer Antwort
 *  parallele Anfragen blockieren). Sie wird per Symcon-Skript/Timer oder CLI aufgerufen;
 *  handler.php liest ausschliesslich den fertigen Cache.
 *
 *  Kartendaten: (c) OpenStreetMap-Mitwirkende, ODbL. Der Cache ist eine abgeleitete
 *  Datenbank — er gehoert NICHT ins Repository (.gitignore).
 */

const GEO_UA      = 'LiveViewBuilder/1.0 (IP-Symcon Widget sunscene)';
const GEO_TTL     = 60 * 60 * 24 * 60;   // 60 Tage: Gebaeude aendern sich selten
const GEO_MAXPTS  = 40;                  // Punkte je Grundriss nach Vereinfachung
const GEO_MINAREA = 8.0;                 // m2 - kleinere Flecken (Muell-Geometrie) weglassen

/** Cache-Dateiname je Standort+Umkreis. 4 Nachkommastellen ~ 11 m Raster. */
function geo_cache_file(string $dir, float $lat, float $lon, int $radius): string
{
    return rtrim($dir, '/') . '/cache-geo-' . number_format($lat, 4, '_', '')
         . '_' . number_format($lon, 4, '_', '') . '_' . $radius . '.json';
}

/** Cache lesen; null wenn nicht vorhanden oder abgelaufen. */
function geo_read(string $dir, float $lat, float $lon, int $radius): ?array
{
    $f = geo_cache_file($dir, $lat, $lon, $radius);
    if (!is_file($f)) { return null; }
    $j = json_decode((string) @file_get_contents($f), true);
    if (!is_array($j) || empty($j['built'])) { return null; }
    if (time() - (int) $j['built'] > GEO_TTL) { $j['stale'] = true; }
    return $j;
}

/**
 * Holt und verarbeitet die Gebaeude. Gibt das Ergebnis-Array zurueck (und schreibt den Cache).
 * $force = true holt auch bei gueltigem Cache neu.
 */
function geo_build(string $dir, float $lat, float $lon, int $radius = 250, bool $force = false, int $timeout = 55): array
{
    if (!$force) {
        $c = geo_read($dir, $lat, $lon, $radius);
        if ($c && empty($c['stale'])) { return $c; }
    }
    $q = '[out:json][timeout:25];('
       . 'way["building"](around:' . $radius . ',' . $lat . ',' . $lon . ');'
       . 'relation["building"](around:' . $radius . ',' . $lat . ',' . $lon . ');'
       . ');out geom;';

    $raw = geo_http('https://overpass-api.de/api/interpreter', ['data' => $q], $timeout);
    if ($raw === null) { return ['ok' => false, 'err' => 'overpass']; }
    $j = json_decode($raw, true);
    if (!is_array($j) || !isset($j['elements'])) { return ['ok' => false, 'err' => 'parse']; }

    // Meter je Grad am Standort
    $mLat = 111320.0;
    $mLon = 111320.0 * cos(deg2rad($lat));

    $out = [];
    foreach ($j['elements'] as $e) {
        $geom = $e['geometry'] ?? null;
        if (!is_array($geom) || count($geom) < 4) { continue; }
        $ring = [];
        foreach ($geom as $p) {
            if (!isset($p['lat'], $p['lon'])) { continue 2; }
            $ring[] = [($p['lon'] - $lon) * $mLon, ($p['lat'] - $lat) * $mLat];
        }
        // geschlossenen Ring oeffnen
        $n = count($ring);
        if ($n > 1 && abs($ring[0][0] - $ring[$n - 1][0]) < 0.01 && abs($ring[0][1] - $ring[$n - 1][1]) < 0.01) {
            array_pop($ring);
        }
        if (count($ring) < 3) { continue; }
        $ring = geo_simplify($ring, 0.45);
        if (count($ring) > GEO_MAXPTS) { $ring = geo_simplify($ring, 1.2); }
        $a = abs(geo_area($ring));
        if ($a < GEO_MINAREA) { continue; }

        $t = $e['tags'] ?? [];
        $out[] = [
            'r' => array_map(function ($p) { return [round($p[0], 1), round($p[1], 1)]; }, $ring),
            'h' => geo_height($t),
            'k' => geo_kind($t),
            'a' => round($a),
        ];
    }
    // nach Entfernung sortieren -> das Frontend kann einfach abschneiden
    usort($out, function ($x, $y) {
        return geo_dist2($x['r']) <=> geo_dist2($y['r']);
    });

    $res = ['ok' => true, 'built' => time(), 'lat' => $lat, 'lon' => $lon, 'radius' => $radius,
            'attrib' => '(c) OpenStreetMap-Mitwirkende (ODbL)', 'count' => count($out), 'b' => $out];
    @file_put_contents(geo_cache_file($dir, $lat, $lon, $radius), json_encode($res));
    return $res;
}

/** Hoehe aus den Tags; sonst plausible Ersatzhoehe nach Gebaeudeart. */
function geo_height(array $t): float
{
    if (isset($t['height']) && preg_match('/([\d.]+)/', (string) $t['height'], $m)) {
        $h = (float) $m[1]; if ($h > 1 && $h < 200) { return round($h, 1); }
    }
    if (isset($t['building:levels']) && is_numeric($t['building:levels'])) {
        $l = (float) $t['building:levels']; if ($l >= 1 && $l < 60) { return round($l * 3.0 + 0.6, 1); }
    }
    $b = strtolower((string) ($t['building'] ?? 'yes'));
    $map = ['garage' => 2.8, 'garages' => 2.8, 'carport' => 2.6, 'shed' => 2.6, 'hut' => 2.6,
            'roof' => 2.6, 'greenhouse' => 2.8, 'barn' => 6.5, 'farm_auxiliary' => 5.0,
            'house' => 7.5, 'detached' => 7.5, 'residential' => 8.0, 'terrace' => 8.0,
            'apartments' => 12.0, 'commercial' => 8.0, 'industrial' => 8.0, 'church' => 14.0,
            'school' => 10.0, 'public' => 10.0];
    return $map[$b] ?? 7.0;
}
/** Grobe Klasse fuer die Einfaerbung im Frontend. */
function geo_kind(array $t): string
{
    $b = strtolower((string) ($t['building'] ?? 'yes'));
    if (in_array($b, ['garage', 'garages', 'carport', 'shed', 'hut', 'roof', 'greenhouse'], true)) { return 'aux'; }
    if (in_array($b, ['church', 'school', 'public', 'commercial', 'industrial', 'apartments'], true)) { return 'big'; }
    return 'home';
}

/** Douglas-Peucker auf einem Ring (in Metern). */
function geo_simplify(array $pts, float $eps): array
{
    $n = count($pts);
    if ($n < 5) { return $pts; }
    $keep = array_fill(0, $n, false);
    $keep[0] = true; $keep[$n - 1] = true;
    $stack = [[0, $n - 1]];
    while ($stack) {
        [$s, $e] = array_pop($stack);
        $dmax = 0; $idx = -1;
        for ($i = $s + 1; $i < $e; $i++) {
            $d = geo_perp($pts[$i], $pts[$s], $pts[$e]);
            if ($d > $dmax) { $dmax = $d; $idx = $i; }
        }
        if ($dmax > $eps && $idx > 0) {
            $keep[$idx] = true;
            $stack[] = [$s, $idx]; $stack[] = [$idx, $e];
        }
    }
    $o = [];
    for ($i = 0; $i < $n; $i++) { if ($keep[$i]) { $o[] = $pts[$i]; } }
    return count($o) >= 3 ? $o : $pts;
}
function geo_perp(array $p, array $a, array $b): float
{
    $dx = $b[0] - $a[0];
    $dy = $b[1] - $a[1];
    $L = $dx * $dx + $dy * $dy;
    if ($L <= 0) { return hypot($p[0] - $a[0], $p[1] - $a[1]); }
    $t = max(0, min(1, (($p[0] - $a[0]) * $dx + ($p[1] - $a[1]) * $dy) / $L));
    return hypot($p[0] - ($a[0] + $t * $dx), $p[1] - ($a[1] + $t * $dy));
}
function geo_area(array $r): float
{
    $s = 0; $n = count($r);
    for ($i = 0; $i < $n; $i++) { $j = ($i + 1) % $n; $s += $r[$i][0] * $r[$j][1] - $r[$j][0] * $r[$i][1]; }
    return $s / 2;
}
/** Quadrat der Entfernung des Schwerpunkts zum Standort (0,0). */
function geo_dist2(array $r): float
{
    $e = 0; $n = 0; $c = count($r);
    foreach ($r as $p) { $e += $p[0]; $n += $p[1]; }
    $e /= $c; $n /= $c;
    return $e * $e + $n * $n;
}

/** HTTP mit harten Zeitgrenzen; null bei Fehler. */
function geo_http(string $url, array $post = null, int $timeout = 55): ?string
{
    if (!function_exists('curl_init')) {          // Rueckfall ohne cURL (z. B. schlanke CLI)
        $opt = ['http' => ['timeout' => $timeout, 'header' => "User-Agent: " . GEO_UA . "\r\n", 'ignore_errors' => true]];
        if ($post !== null) {
            $opt['http']['method']  = 'POST';
            $opt['http']['header'] .= "Content-Type: application/x-www-form-urlencoded\r\n";
            $opt['http']['content'] = http_build_query($post);
        }
        $r = @file_get_contents($url, false, stream_context_create($opt));
        return ($r === false || $r === '') ? null : (string) $r;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => min(8, $timeout),
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_USERAGENT      => GEO_UA,
        CURLOPT_ENCODING       => '',
    ]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $r = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($r !== false && $code === 200) ? (string) $r : null;
}

// --- CLI: php geo.php <lat> <lon> [radius] [cacheDir] ---
if (PHP_SAPI === 'cli' && isset($argv[1], $argv[2])) {
    $dir = $argv[4] ?? sys_get_temp_dir();
    $res = geo_build($dir, (float) $argv[1], (float) $argv[2], (int) ($argv[3] ?? 250), true);
    if (empty($res['ok'])) { fwrite(STDERR, 'Fehler: ' . ($res['err'] ?? '?') . "\n"); exit(1); }
    $f = geo_cache_file($dir, (float) $argv[1], (float) $argv[2], (int) ($argv[3] ?? 250));
    printf("%d Gebaeude · Cache %s (%.1f KB)\n", $res['count'], basename($f), filesize($f) / 1024);
}
