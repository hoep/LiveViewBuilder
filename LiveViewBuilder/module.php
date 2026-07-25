<?php

declare(strict_types=1);

require_once __DIR__ . '/functions.php';   // LVB_* Helfer (Import-Walk etc.)

/**
 * LiveView Builder
 *
 * Standalone-Dashboard-Builder über Symcon-WebHook — ohne Ports, ohne Skripte.
 * Registriert (nur bei KR_READY!) automatisch die Hooks /hook/builder und /hook/run
 * und liefert Builder + API über ProcessHookData() -> handler.php.
 *
 * Speicher: DATEI  <BasePath>/layouts.json  (transparent, backup-bar, vom WebSocket-Push lesbar).
 *   - BasePath leer  -> neutraler Ordner je Instanz:  <KernelDir>/liveview/<InstanzID>/
 *   - BasePath gesetzt -> vorhandener Ordner (z. B. eine bestehende Site) wird weiterverwendet.
 *
 * URLs:  Builder <BaseUrl>/hook/builder/<Site>   ·   Live <BaseUrl>/hook/run/<Site>?view=<Ansicht>
 */
class LiveViewBuilder extends IPSModule
{
    private const WEBHOOK_CONTROL = '{015A6EB8-D6E5-4B93-B496-0D3F77AE9FE1}';

    public function Create()
    {
        parent::Create();
        $this->RegisterPropertyString('BasePath', '');      // Datenordner; leer = neutraler Auto-Ordner
        $this->RegisterPropertyString('Site', '');          // Label im Pfad /hook/builder/<Site>
        $this->RegisterPropertyString('BaseUrl', '');       // z. B. http://10.0.0.5:3777 (für klickbare Links)
        $this->RegisterPropertyString('WsPort', '');        // optional: WebSocket-Push-Port
        $this->RegisterPropertyString('IPSViewPath', '');   // optional: Fallback-Quelle für Import
        $this->RegisterAttributeString('Token', '');        // Schreib-Token (auto)
        $this->RegisterAttributeString('ImportStatus', ''); // letzter Import-Status (für Formularanzeige)
        $this->RegisterMessage(0, IPS_KERNELMESSAGE);       // KR_READY abfangen -> Hooks nach dem Boot registrieren
    }

    public function ApplyChanges()
    {
        parent::ApplyChanges();
        if ($this->ReadAttributeString('Token') === '') {
            $this->WriteAttributeString('Token', bin2hex(random_bytes(16)));
        }
        $dir = $this->dataDir();
        if ($dir !== '' && !is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        // WICHTIG: Hook-Registrierung (IPS_ApplyChanges auf die WebHook-Control) NIE im Kernel-Start.
        // Nur wenn der Kernel bereit ist -> verhindert Startup-Schleife/Absturz.
        if (IPS_GetKernelRunlevel() !== KR_READY) {
            return;
        }
        $this->registerHooks(['/hook/builder', '/hook/run']);
    }

    // Hooks auch nach dem Boot registrieren (Kernel meldet KR_READY per Message).
    public function MessageSink($TimeStamp, $SenderID, $Message, $Data)
    {
        if ($Message === IPS_KERNELMESSAGE && $Data[0] === KR_READY) {
            $this->registerHooks(['/hook/builder', '/hook/run']);
        }
    }

    public function ProcessHookData()
    {
        $TOKEN   = $this->ReadAttributeString('Token');
        $DIR     = __DIR__;                 // Modulcode: builder.html, assets/echarts
        $DATADIR = $this->dataDir();        // Daten: layouts.json
        $WSPORT  = $this->ReadPropertyString('WsPort');
        include __DIR__ . '/handler.php';
    }

    // ---------- Formular-Aktionen ----------
    public function ShowUrls(): void
    {
        echo $this->urlBuilder() . "\n" . $this->urlRun('');
    }

    public function OpenBuilder(): void
    {
        echo $this->urlBuilder();
    }

    // Formular-Button: stößt den Import ASYNCHRON an -> Konsole/Formular blockieren NICHT.
    public function StartImport(int $MediaID): void
    {
        if ($MediaID <= 0 || !IPS_MediaExists($MediaID)) {
            echo 'Bitte oben eine IPSView-Quelle auswählen.';
            return;
        }
        $this->WriteAttributeString('ImportStatus', 'Import läuft…');
        @$this->UpdateFormField('ImportStatus', 'caption', 'Import läuft… (Quelle wird gelesen)');
        IPS_RunScriptText('<?php LVB_RunImport(' . $this->InstanceID . ', ' . $MediaID . ');'); // eigener Thread
        echo 'Import gestartet — läuft im Hintergrund. Fortschritt siehe oben.';
    }

    // Läuft asynchron (via IPS_RunScriptText). Die schwere Arbeit hier -> keine Konsolen-Blockade.
    public function RunImport(int $MediaID): void
    {
        @ini_set('memory_limit', '512M');
        $setStatus = function (string $s): void {
            $this->WriteAttributeString('ImportStatus', $s);
            @$this->UpdateFormField('ImportStatus', 'caption', $s);
        };
        if ($MediaID <= 0 || !IPS_MediaExists($MediaID)) {
            $setStatus('✗ Import: Quelle nicht gefunden.');
            return;
        }
        $raw   = @base64_decode((string) IPS_GetMediaContent($MediaID));
        $view  = json_decode((string) $raw, true);
        $raw   = null;                                   // Speicher früh freigeben
        $pages = is_array($view) ? ($view['Pages'] ?? []) : [];
        $view  = null;
        if (!is_array($pages) || count($pages) === 0) {
            $setStatus('✗ Import: keine Seiten in dieser IPSView.');
            return;
        }
        $byName = [];
        foreach ($pages as $p) {
            if (($p['PageName'] ?? '') !== '') {
                $byName[$p['PageName']] = $p;
            }
        }
        $total    = count($pages);
        $done     = 0;
        $newViews = [];
        foreach ($pages as $pg) {
            $done++;
            if ($done % 15 === 0 || $done === $total) {
                $setStatus('Import läuft… ' . $done . '/' . $total . ' Seiten');
            }
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
            while (isset($newViews[$key])) {
                $key = $name . ' (' . $i++ . ')';
            }
            $newViews[$key] = [
                'page'    => ['w' => (int) ceil($ext['x']) + 16, 'h' => (int) ceil($ext['y']) + 16, 'fit' => 'letterbox'],
                'widgets' => $widgets,
            ];
        }
        if (count($newViews) === 0) {
            $setStatus('✗ Import: keine übernehmbaren Seiten.');
            return;
        }
        $dir = $this->dataDir();
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $lf    = $dir . '/layouts.json';
        $store = json_decode((string) @file_get_contents($lf), true);
        if (!is_array($store) || !isset($store['views']) || !is_array($store['views'])) {
            $store = ['views' => [], 'current' => null];
        }
        $cnt = 0;
        foreach ($newViews as $nm => $v) {
            $store['views'][$nm] = $v;
            $cnt++;
        }
        if (empty($store['current'])) {
            $store['current'] = array_key_first($store['views']);
        }
        file_put_contents($lf, json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $setStatus('✓ ' . $cnt . ' Ansicht(en) importiert. Builder öffnen/neu laden.');
    }

    public function GetConfigurationForm()
    {
        $views  = $this->readViews();
        $hasUrl = $this->ReadPropertyString('BaseUrl') !== '';
        $lib    = @json_decode((string) @file_get_contents(__DIR__ . '/../library.json'), true);
        $bld    = is_array($lib) ? ($lib['build'] ?? '?') : '?';

        $elements = [
            ['type' => 'Label', 'caption' => 'LiveView Builder — Modul-Build: ' . $bld . '   ·   Instanz anlegen registriert /hook/builder + /hook/run automatisch.'],
            ['type' => 'ExpansionPanel', 'caption' => 'Einstellungen', 'items' => [
                ['type' => 'ValidationTextBox', 'name' => 'Site', 'caption' => 'Site-Label (Pfad /hook/builder/<Site>)'],
                ['type' => 'ValidationTextBox', 'name' => 'BaseUrl', 'caption' => 'Basis-URL (z. B. http://10.0.0.5:3777) — für klickbare Links'],
                ['type' => 'ValidationTextBox', 'name' => 'BasePath', 'caption' => 'Datenordner (leer = automatisch, je Instanz)'],
                ['type' => 'ValidationTextBox', 'name' => 'WsPort', 'caption' => 'WebSocket-Port (optional)'],
                ['type' => 'ValidationTextBox', 'name' => 'IPSViewPath', 'caption' => 'IPSView-Fallbackpfad (optional)'],
                ['type' => 'Label', 'caption' => 'Datenordner aktiv: ' . $this->dataDir()],
            ]],
        ];

        $actions = [
            ['type' => 'Button', 'caption' => '▶  Builder öffnen (alle Ansichten bearbeiten)', 'onClick' => 'LVB_OpenBuilder($id);'],
        ];
        if (!$hasUrl) {
            $actions[] = ['type' => 'Label', 'caption' => 'Tipp: „Basis-URL" in den Einstellungen setzen, dann sind die Links direkt anklickbar.'];
        }
        if (count($views) === 0) {
            $actions[] = ['type' => 'Label', 'caption' => 'Noch keine Ansichten. Unten eine IPSView importieren oder im Builder anlegen.'];
        } else {
            $actions[] = ['type' => 'Label', 'caption' => 'Ansichten:'];
            foreach ($views as $name => $count) {
                $runUrl  = $this->urlRun((string) $name);
                $editUrl = $this->urlBuilder() . '?view=' . rawurlencode((string) $name);
                $actions[] = ['type' => 'RowLayout', 'items' => [
                    ['type' => 'Label',  'caption' => $name . '  (' . $count . ')', 'width' => '240px'],
                    ['type' => 'Button', 'caption' => '▶ Run',  'onClick' => "echo '" . addslashes($runUrl) . "';"],
                    ['type' => 'Button', 'caption' => '✎ Edit', 'onClick' => "echo '" . addslashes($editUrl) . "';"],
                ]];
            }
        }

        // IPSView-Medienobjekte einsammeln und ALPHABETISCH nach Name sortieren
        $ips = [];
        foreach (IPS_GetMediaList() as $mid) {
            $m    = @IPS_GetMedia($mid);
            $file = is_array($m) ? (string) ($m['MediaFile'] ?? '') : '';
            if (strcasecmp((string) pathinfo($file, PATHINFO_EXTENSION), 'ipsView') !== 0) {
                continue; // nur .ipsView, nicht .ipsviewMeta
            }
            $ips[] = ['name' => (string) IPS_GetName($mid), 'file' => basename($file), 'id' => $mid];
        }
        usort($ips, function ($a, $b) {
            return strnatcasecmp($a['name'], $b['name']);
        });
        $opts = [['caption' => '— IPSView wählen —', 'value' => 0]];
        foreach ($ips as $e) {
            $opts[] = ['caption' => $e['name'] . '  (' . $e['file'] . ' · #' . $e['id'] . ')', 'value' => $e['id']];
        }
        $status = $this->ReadAttributeString('ImportStatus');
        $actions[] = ['type' => 'Label', 'caption' => '───  IPSView-Import  ───'];
        $actions[] = ['type' => 'Select', 'name' => 'ImportMedia', 'caption' => 'Quelle', 'options' => $opts];
        $actions[] = ['type' => 'Button', 'caption' => 'Importieren', 'onClick' => 'LVB_StartImport($id, $ImportMedia);'];
        $actions[] = ['type' => 'Label', 'name' => 'ImportStatus', 'caption' => ($status !== '' ? $status : 'Bereit für Import.')];
        $actions[] = ['type' => 'Button', 'caption' => 'Adressen anzeigen', 'onClick' => 'LVB_ShowUrls($id);'];

        return json_encode([
            'elements' => $elements,
            'actions'  => $actions,
            'status'   => [['code' => 102, 'icon' => 'active', 'caption' => 'Bereit']],
        ]);
    }

    // ---------- intern ----------
    private function dataDir(): string
    {
        $bp = trim($this->ReadPropertyString('BasePath'));
        if ($bp !== '') {
            return rtrim($bp, '/');
        }
        return rtrim(IPS_GetKernelDir(), '/') . '/liveview/' . $this->InstanceID;
    }

    private function siteLabel(): string
    {
        $s = trim($this->ReadPropertyString('Site'));
        if ($s === '') {
            $s = IPS_GetName($this->InstanceID);
        }
        $s = trim((string) preg_replace('/[^A-Za-z0-9_-]+/', '-', $s), '-'); // Slashes/Sonderzeichen raus -> nie %2F in der URL
        return $s !== '' ? $s : ('view' . $this->InstanceID);
    }

    private function baseUrl(): string
    {
        return rtrim(trim($this->ReadPropertyString('BaseUrl')), '/');
    }

    private function urlBuilder(): string
    {
        return $this->baseUrl() . '/hook/builder/' . rawurlencode($this->siteLabel());
    }

    private function urlRun(string $view): string
    {
        $u = $this->baseUrl() . '/hook/run/' . rawurlencode($this->siteLabel());
        return $view !== '' ? ($u . '?view=' . rawurlencode($view)) : $u;
    }

    private function readViews(): array
    {
        $store = json_decode((string) @file_get_contents($this->dataDir() . '/layouts.json'), true);
        $out   = [];
        if (is_array($store) && isset($store['views']) && is_array($store['views'])) {
            foreach ($store['views'] as $name => $v) {
                $out[(string) $name] = is_array($v['widgets'] ?? null) ? count($v['widgets']) : 0;
            }
        }
        return $out;
    }

    private function registerHooks(array $wanted): void
    {
        $ids = IPS_GetInstanceListByModuleID(self::WEBHOOK_CONTROL);
        if (count($ids) === 0) {
            return;
        }
        $wc    = $ids[0];
        $hooks = json_decode(IPS_GetProperty($wc, 'Hooks'), true);
        if (!is_array($hooks)) {
            $hooks = [];
        }
        $changed = false;
        foreach ($wanted as $hook) {
            $found = false;
            foreach ($hooks as $i => $h) {
                if (($h['Hook'] ?? '') === $hook) {
                    $found = true;
                    if ((int) ($h['TargetID'] ?? 0) !== $this->InstanceID) {
                        $hooks[$i]['TargetID'] = $this->InstanceID;
                        $changed = true;
                    }
                    break;
                }
            }
            if (!$found) {
                $hooks[] = ['Hook' => $hook, 'TargetID' => $this->InstanceID];
                $changed = true;
            }
        }
        if ($changed) {
            IPS_SetProperty($wc, 'Hooks', json_encode($hooks));
            IPS_ApplyChanges($wc);   // sicher, weil nur bei KR_READY aufgerufen
        }
    }
}
