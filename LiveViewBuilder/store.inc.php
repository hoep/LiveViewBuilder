<?php

/**
 * LiveViewBuilder — Ablage des Layouts. EINE Implementierung fuer handler.php und module.php.
 *
 * Speichermodell: index.json haelt alles ausser dem Seiteninhalt, dazu je Seite eine Datei
 * seiten/seite-<slug>.json. layouts.json bleibt Spiegel (das Push-Modul liest ihn) und
 * Rueckfallebene, ist aber NICHT die Wahrheit.
 *
 * Warum geteilt: Vorher lagen Zerlegen und Zusammensetzen als Closures im handler.php,
 * waehrend module.php (Instanz-Formular, syncViews) direkt auf layouts.json arbeitete. Damit
 * erreichte eine im Formular angelegte oder umbenannte Seite den echten Datenstand nicht und
 * der Spiegel lief auseinander. Zwei Implementierungen desselben Formats waeren erneut zum
 * Auseinanderlaufen verurteilt, darum stehen sie hier einmal.
 */

if (!function_exists('LVB_Slug')) {

    /** Dateiname-Anteil je Seitenname: stabil, kollisionsfrei, ohne Sonderzeichen. */
    function LVB_Slug(string $name): string
    {
        $b = trim((string) preg_replace('/[^A-Za-z0-9_-]+/u', '-', $name), '-');
        if ($b === '') {
            $b = 'seite';
        }
        return $b . '-' . substr(md5($name), 0, 6);
    }

    /**
     * Store lesen wie die Laufzeit: index.json + seiten/. Liefert null, wenn kein index.json
     * existiert - der Aufrufer entscheidet dann ueber die Rueckfallebene.
     */
    function LVB_Assemble(string $dir): ?array
    {
        $idx = json_decode((string) @file_get_contents($dir . '/index.json'), true);
        if (!is_array($idx) || !isset($idx['views']) || !is_array($idx['views'])) {
            return null;
        }
        $store          = $idx;
        $store['views'] = [];
        foreach ($idx['views'] as $name => $ref) {
            $slug                           = is_array($ref) ? (string) ($ref['file'] ?? '') : '';
            $v                              = $slug !== '' ? json_decode((string) @file_get_contents($dir . '/seiten/seite-' . $slug . '.json'), true) : null;
            $store['views'][(string) $name] = is_array($v) ? $v : ['page' => ['w' => 1440, 'h' => 900], 'widgets' => []];
        }
        return $store;
    }

    /** Store in index.json + seiten/ zerlegen und verwaiste Seiten-Dateien entfernen. */
    function LVB_Split(string $dir, array $store): void
    {
        $seiteDir = $dir . '/seiten';
        if (!is_dir($seiteDir)) {
            @mkdir($seiteDir, 0775, true);
        }
        $index          = $store;
        $index['views'] = [];
        $keep           = [];
        foreach (($store['views'] ?? []) as $name => $v) {
            $slug                              = LVB_Slug((string) $name);
            $keep['seite-' . $slug . '.json']  = true;
            $index['views'][(string) $name]    = ['file' => $slug];
            file_put_contents($seiteDir . '/seite-' . $slug . '.json', json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }
        file_put_contents($dir . '/index.json', json_encode($index, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        foreach (glob($seiteDir . '/seite-*.json') ?: [] as $p) {
            if (empty($keep[basename($p)])) {
                @unlink($p);
            }
        }
    }

    /**
     * Vollstaendig speichern: Spiegel UND Einzeldateien. Wer nur eines von beiden schreibt,
     * hinterlaesst einen Datenstand, bei dem Laufzeit und Push-Modul Verschiedenes sehen.
     */
    function LVB_SaveStore(string $dir, array $store): void
    {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        file_put_contents($dir . '/layouts.json', json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        LVB_Split($dir, $store);
    }
}
