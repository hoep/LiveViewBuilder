<?php
/**
 * Baut builder.html und die beiden JS-Buendel aus src/. NICHT builder.html direkt editieren.
 *
 * Warum zwei Buendel und warum extern:
 *
 * Frueher lagen 1,6 MB JavaScript INLINE in der Seite, und die Seite wird mit
 * "no-cache" ausgeliefert, weil der Schreib-Token darin steckt. Inline-Skripte in
 * einem nicht zwischenspeicherbaren Dokument bekommen im Browser KEINEN Code-Cache:
 * jeder Seitenaufruf laedt und uebersetzt alles von vorn. Auf einem Tablet waren das
 * ein bis zwei Sekunden, bis eine Seite stand.
 *
 * Jetzt geht der Token als kleiner Inline-Block mit (bleibt privat), das grosse
 * Buendel liegt als eigene Datei mit Inhalts-Hash in der Adresse. Damit greift der
 * Zwischenspeicher UND der Code-Cache; nach einem Rebuild aendert sich der Hash und
 * die neue Fassung wird sofort gezogen.
 *
 * Der Laeufer bekommt zusaetzlich ein ausgeduenntes Buendel: ohne die
 * props/wire-Bloecke der Widgets. Beide werden ausschliesslich aus 04-props.js
 * aufgerufen, und zwar an beiden Stellen abgesichert ("falls vorhanden") - im
 * Laeufer fehlen sie also folgenlos.
 *
 * Die reinen Editor-DATEIEN bleiben bewusst drin. Laufzeit-Dateien rufen an 21
 * Stellen Funktionen daraus auf (renderProps, row, skinSel ...), durchweg aus
 * Eigenschaften-Code heraus, der im Laeufer nicht laeuft. "Laeuft nicht" ist
 * aber keine Zusicherung: waere eine dieser Stellen doch erreichbar, gaebe es
 * einen ReferenceError mitten in der Visualisierung. Die 6 Prozent sind das
 * nicht wert.
 */
$d = __DIR__ . "/src";

// Kern in fester Reihenfolge - vollstaendig in BEIDEN Buendeln.
$core = [
    "00-registry.js", "01-boot-icons.js", "02-zoom-core.js", "03-render-charts.js",
    "04-props.js", "05-interaction.js", "06-live.js", "06-panel.js",
    "07-builders.js", "08-assoc.js", "08-roomsel.js", "08-sun.js", "09-io-init.js",
    "10-chrome.js", "11-migrate.js", "12-doku-demo.js", "12-doku.js", "13-sidepanel.js",
];
// (Kein Kern-Ausschluss - siehe Kopfkommentar.)

/**
 * Entfernt die Bloecke props: und wire: aus einer Widget-Datei.
 *
 * Zeilenweise statt mit Klammernzaehlung: ein Block beginnt bei "    props:function"
 * und endet vor dem naechsten Schluessel derselben Ebene oder dem Ende von defWidget.
 * Findet sich kein solches Ende, bleibt die Datei unangetastet - lieber ein paar
 * Kilobyte mehr als eine kaputte Datei.
 */
function lvb_strip(string $quelle): string
{
    $zeilen = explode("\n", $quelle);
    $aus = [];
    $tiefe = -1;                       // Einrueckung des offenen Blocks, -1 = keiner
    foreach ($zeilen as $z) {
        // ZUERST pruefen, ob ein offener Block hier endet - und die Endzeile
        // danach NICHT einfach uebernehmen, sondern erneut als moeglichen
        // Blockanfang testen. Sonst rutscht ein wire:, das direkt hinter einem
        // props: steht, durch.
        if ($tiefe >= 0) {
            $sel = '/^\s{' . $tiefe . '}[A-Za-z_$][\w$]*\s*:/';
            $zu  = '/^\s{0,' . max(0, $tiefe - 1) . '}[}\])]/';
            if (preg_match($sel, $z) || preg_match($zu, $z)) {
                $tiefe = -1;
            } else {
                continue;
            }
        }
        if (preg_match('/^(\s*)(props|wire)\s*:\s*function/', $z, $m)) {
            $tiefe = strlen($m[1]);
            continue;
        }
        $aus[] = $z;
    }
    return ($tiefe >= 0) ? $quelle : implode("\n", $aus);   // offen geblieben -> Original
}

$wf = glob("$d/widgets/*.js");
sort($wf);
$tail = @file_get_contents("$d/js/99-init.js");
if ($tail === false) { fwrite(STDERR, "missing 99-init\n"); exit(1); }

/** Ein Buendel zusammensetzen. $schlank = Laeufer-Fassung. */
$bauen = function (bool $schlank) use ($d, $core, $wf, $tail): string {
    $js = "";
    foreach ($core as $f) {
        $c = @file_get_contents("$d/js/$f");
        if ($c === false) { fwrite(STDERR, "missing $f\n"); exit(1); }
        $js .= $c;
    }
    foreach ($wf as $f) {
        $c = file_get_contents($f);
        $js .= $schlank ? lvb_strip($c) . "\n" : $c;
    }
    return $js . $tail;
};

/** Kommentare und Leerraum entfernen - kein compress/mangle, semantisch identisch. */
$min = function (string $js, string $was): string {
    $roh = strlen($js);
    $tmp = tempnam(sys_get_temp_dir(), 'lvbjs_');
    file_put_contents($tmp, $js);
    $out = @shell_exec('terser ' . escapeshellarg($tmp) . ' --format comments=false 2>/dev/null');
    @unlink($tmp);
    if ($out !== null && strlen(trim($out)) > $roh * 0.3) {
        $out = trim($out);
        echo "  $was: $roh -> " . strlen($out) . " Bytes\n";
        return $out;
    }
    fwrite(STDERR, "WARN: terser fehlgeschlagen ($was) -> unminifiziert\n");
    return $js;
};

/** Syntaxprobe mit node, falls vorhanden. Ohne node wird nicht geprueft. */
$pruefen = function (string $js): bool {
    $tmp = tempnam(sys_get_temp_dir(), 'lvbchk_') . '.js';
    file_put_contents($tmp, $js);
    $rc = 1;
    @exec('node --check ' . escapeshellarg($tmp) . ' 2>&1', $o, $rc);
    @unlink($tmp);
    return $rc === 0;
};

@mkdir(__DIR__ . '/assets', 0775, true);

$voll = $min($bauen(false), 'voll  ');
$lauf = $min($bauen(true),  'laeufer');

// Der Laeufer wird geprueft. Faellt er durch, gilt das volle Buendel - lieber
// langsamer als kaputt.
if (!$pruefen($lauf)) {
    fwrite(STDERR, "WARN: Laeufer-Buendel ist syntaktisch fehlerhaft -> es gilt das volle\n");
    $lauf = $voll;
}

file_put_contents(__DIR__ . "/assets/app.js", $voll);
file_put_contents(__DIR__ . "/assets/run.js", $lauf);
$hv = substr(md5($voll), 0, 12);
$hl = substr(md5($lauf), 0, 12);
file_put_contents(__DIR__ . "/assets/bundles.json", json_encode(['app' => $hv, 'run' => $hl]));

// Grosse Dateien zusaetzlich STATISCH ablegen. Grund: das Symcon-Hook kappt seine
// Ausgabe bei 1 MiB und schickt statt des Programmcodes 62 Byte Fehlertext - mit
// HTTP 200 und Content-Type javascript, also ohne dass der Browser etwas merkt.
// Das Laeufer-Buendel liegt bei 1,37 MB und kam bisher NUR durch, weil es
// komprimiert wurde; jede Stelle in der Kette ohne gzip legte die Visualisierung
// lautlos still. Unter /tile liefert Symcon direkt von der Platte, am Hook und
// damit am Deckel vorbei. Der Hash steckt im Dateinamen, alte Staende werden
// aufgeraeumt.
// ACHTUNG: /usr/share/symcon ist das PROGRAMMverzeichnis - eine Symcon-
// Aktualisierung kann den Ordner leeren. Der Handler prueft deshalb bei jedem
// Ausliefern, ob die Datei da ist, und faellt sonst auf den Hook-Weg zurueck.
$statisch = '/usr/share/symcon/tile/lvb';
if (!is_dir($statisch)) { @mkdir($statisch, 0755, true); }
if (is_dir($statisch) && is_writable($statisch)) {
    $ablegen = ['app-' . $hv . '.js' => $voll, 'run-' . $hl . '.js' => $lauf];
    $ec = __DIR__ . '/assets/echarts.min.js';
    if (is_file($ec)) {
        $ecInhalt = (string) file_get_contents($ec);
        $ablegen['echarts-' . substr(md5($ecInhalt), 0, 12) . '.js'] = $ecInhalt;
    }
    foreach ($ablegen as $name => $inhalt) {
        $ziel = $statisch . '/' . $name;
        if (!is_file($ziel) || filesize($ziel) !== strlen($inhalt)) {
            file_put_contents($ziel . '.tmp', $inhalt);   // erst daneben, dann umbenennen -
            @rename($ziel . '.tmp', $ziel);               // sonst laedt jemand eine halbe Datei
        }
    }
    foreach ((array) glob($statisch . '/*.js') as $alt) {   // aufraeumen
        if (!isset($ablegen[basename($alt)])) { @unlink($alt); }
    }
    echo "statisch: " . implode(', ', array_keys($ablegen)) . "\n";
} else {
    fwrite(STDERR, "WARN: $statisch nicht beschreibbar - Auslieferung laeuft weiter ueber das Hook\n");
}

$css = file_get_contents("$d/styles.css");
$css = preg_replace('#/\*.*?\*/#s', '', $css);
$css = preg_replace('#\s*\n\s*#', "\n", $css);
$css = preg_replace('#\n{2,}#', "\n", $css);

$shell = file_get_contents("$d/shell.html");
$out = str_replace("{{STYLES}}\n", $css, $shell);
$dokuver = substr(md5((string) @file_get_contents("$d/js/12-doku-data.js")), 0, 10);
$out = str_replace("{{DOKUVER}}", $dokuver, $out);
file_put_contents(__DIR__ . "/builder.html", $out);

echo "gebaut: Huelle " . strlen($out) . " Bytes, voll " . strlen($voll)
   . " ($hv), laeufer " . strlen($lauf) . " ($hl); Kern+" . count($wf) . " Widgets\n";
printf("Laeufer spart %.1f %% gegenueber dem vollen Buendel\n", 100 * (1 - strlen($lauf) / max(1, strlen($voll))));
