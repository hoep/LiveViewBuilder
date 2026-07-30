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
        $this->RegisterPropertyString('WsUrl', '');         // optional: vollstaendige WebSocket-Adresse, schlaegt WsPort
                                                            // Noetig hinter einem Reverse Proxy: eine ueber HTTPS geladene
                                                            // Seite darf kein ws:// oeffnen, und ein fester Port ist dort
                                                            // meist nicht veroeffentlicht. Beispiel: wss://host/wss
        $this->RegisterPropertyString('IPSViewPath', '');   // optional: Fallback-Quelle für Import
        $this->RegisterPropertyString('Views', '[]');       // Ansichten-Liste (Modul-verwaltet): [{Name, Home}]
        $this->RegisterAttributeString('Token', '');        // Schreib-Token (auto)
        $this->RegisterAttributeString('ImportStatus', ''); // letzter Import-Status (für Formularanzeige)
        $this->RegisterMessage(0, IPS_KERNELMESSAGE);       // KR_READY abfangen -> Hooks nach dem Boot registrieren
        $this->RegisterMessage(0, 10204);                   // KL_WARNING -> Meldungs-Mitschnitt
        $this->RegisterMessage(0, 10205);                   // KL_ERROR   -> Meldungs-Mitschnitt
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
        $v = $this->siteLabel();
        $this->registerHooks(['/hook/builder/' . $v, '/hook/run/' . $v]);   // view-spezifisch -> mehrere Instanzen kollidieren nicht
        $this->migrateOldDir();     // fruehere Auto-Ablage in den View-Ordner uebernehmen (einmalig)
        $this->syncPushBasePath();  // Push-Modul auf denselben Datenordner zeigen lassen (sonst liest der Push den falschen Ordner)
        $this->syncViews();         // Modul-Liste -> Seiten abgleichen (Anlegen/Loeschen), mit Schutz-Guard
    }

    // Haelt den BasePath des WebSocket-Push-Moduls identisch zum eigenen Datenordner.
    private function syncPushBasePath(): void
    {
        $push = IPS_GetInstanceListByModuleID('{7B3E9F21-4C8A-4D6E-B1F5-9A0C2D3E4F60}')[0] ?? 0;
        if (!$push) {
            return;
        }
        $base = dirname($this->dataDir());   // Basis-Ordner (livebuilder/) -> Push scannt ALLE Views darunter
        if ((string) @IPS_GetProperty($push, 'BasePath') !== $base) {
            IPS_SetProperty($push, 'BasePath', $base);
            IPS_ApplyChanges($push);   // uebernimmt + zieht die Registrierungen neu (sicher, nur bei KR_READY)
        }
    }

    // Gleicht die im Formular verwaltete Views-Liste mit layouts.json ab.
    // SCHUTZ: Bei leerer Property wird NICHT geloescht (verhindert Massen-Loeschung bei frisch aktualisierter Instanz).
    // Umbenennen passiert im Builder (Name = Pfad = Identitaet). Inhalt/Widgets bleiben Sache von layouts.json.
    // Store so zusammensetzen, wie es die Laufzeit tut: index.json + seiten/<slug>.json.
    // layouts.json ist nur noch Spiegel und darf nicht die Wahrheit sein.
    private function storeAssembled(): array
    {
        $dir = $this->dataDir();
        $idx = json_decode((string) @file_get_contents($dir . '/index.json'), true);
        if (is_array($idx) && isset($idx['views']) && is_array($idx['views'])) {
            $store          = $idx;
            $store['views'] = [];
            foreach ($idx['views'] as $name => $ref) {
                $slug                        = is_array($ref) ? (string) ($ref['file'] ?? '') : '';
                $v                           = $slug !== '' ? json_decode((string) @file_get_contents($dir . '/seiten/seite-' . $slug . '.json'), true) : null;
                $store['views'][(string) $name] = is_array($v) ? $v : ['page' => ['w' => 1440, 'h' => 900], 'widgets' => []];
            }
            return $store;
        }
        $m = json_decode((string) @file_get_contents($dir . '/layouts.json'), true);
        return is_array($m) ? $m : ['views' => []];
    }

    // Popups sind keine Seiten der Navigation: Sie werden von Widgets per popupTo/longPopup
    // geoeffnet und im Builder gepflegt. Im Instanz-Formular haben sie nichts zu suchen - und
    // sie duerfen beim Speichern NICHT geloescht werden, nur weil sie nicht in der Liste stehen.
    private function popupPages(): array
    {
        $out   = [];
        $store = $this->storeAssembled();
        foreach (($store['views'] ?? []) as $v) {
            foreach ((($v['widgets'] ?? []) ?: []) as $w) {
                foreach (['popupTo', 'longPopup'] as $k) {
                    $n = trim((string) ($w[$k] ?? ''));
                    if ($n !== '') {
                        $out[$n] = true;
                    }
                }
            }
        }
        return $out;
    }

    private function syncViews(): void
    {
        $rows = json_decode($this->ReadPropertyString('Views'), true);
        if (!is_array($rows) || count($rows) === 0) {
            return; // leere Liste -> nichts anfassen (Guard)
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
        $want = [];
        $home = '';
        foreach ($rows as $r) {
            $nm = trim(str_replace('/', '-', (string) ($r['Name'] ?? '')));  // Slash raus (sonst extra Pfad-Segment)
            if ($nm === '') {
                continue;
            }
            $want[$nm] = true;
            if (!empty($r['Home']) && $home === '') {
                $home = $nm;
            }
        }
        if (count($want) === 0) {
            return;
        }
        // Anlegen: neue Namen -> leere View
        foreach (array_keys($want) as $nm) {
            if (!isset($store['views'][$nm])) {
                $store['views'][$nm] = ['page' => ['w' => 1440, 'h' => 900, 'fit' => 'letterbox'], 'widgets' => []];
            }
        }
        // Loeschen: in layouts vorhanden, aber nicht in der Liste
        $popups = $this->popupPages();
        foreach (array_keys($store['views']) as $nm) {
            if (!isset($want[$nm]) && !isset($popups[$nm])) {   // Popups nie ueber die Liste loeschen
                unset($store['views'][$nm]);
            }
        }
        if ($home !== '') {
            $store['home'] = $home;
        }
        if (empty($store['current']) || !isset($store['views'][$store['current']])) {
            $store['current'] = array_key_first($store['views']);
        }
        file_put_contents($lf, json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        // Push-Registrierungen sofort nachziehen (neu gebundene/entfallene Variablen), wie beim Layout-Speichern
        $push = IPS_GetInstanceListByModuleID('{7B3E9F21-4C8A-4D6E-B1F5-9A0C2D3E4F60}')[0] ?? 0;
        if ($push && function_exists('LVBP_Sync')) {
            @LVBP_Sync($push);
        }
    }

    // Hooks auch nach dem Boot registrieren (Kernel meldet KR_READY per Message).
    public function MessageSink($TimeStamp, $SenderID, $Message, $Data)
    {
        if ($Message === IPS_KERNELMESSAGE && $Data[0] === KR_READY) {
            $this->registerHooks(['/hook/builder', '/hook/run']);
            return;
        }
        if ($Message === 10204 || $Message === 10205) { // KL_WARNING / KL_ERROR mitschneiden
            $buf = json_decode($this->GetBuffer('lvbmsgs'), true);
            if (!is_array($buf)) { $buf = []; }
            $txt = is_array($Data) ? implode(' | ', array_map('strval', $Data)) : (string) $Data;
            $buf[] = ['t' => $TimeStamp, 'k' => ($Message === 10205 ? 'ERROR' : 'WARN'), 'm' => mb_substr(trim($txt), 0, 300)];
            if (count($buf) > 150) { $buf = array_slice($buf, -150); }
            $this->SetBuffer('lvbmsgs', json_encode($buf));
        }
    }

    public function ProcessHookData()
    {
        $TOKEN   = $this->ReadAttributeString('Token');
        $DIR     = __DIR__;                 // Modulcode: builder.html, assets/echarts
        $DATADIR = $this->dataDir();        // Daten: layouts.json
        $WSPORT  = $this->ReadPropertyString('WsPort');
        // NICHT ueber ReadPropertyString: eine neu hinzugefuegte Eigenschaft ist erst nach einem
        // Modul-Neuladen registriert. Vorher warnt Symcon, die Warnung geht VOR den HTTP-Headern
        // raus und zerlegt die ausgelieferte Seite. Aus der Konfiguration lesen warnt nie.
        $_cfg    = json_decode((string) @IPS_GetConfiguration($this->InstanceID), true);
        $WSURL   = is_array($_cfg) ? (string) ($_cfg['WsUrl'] ?? '') : '';
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

        // Aktuelle Ansichten aus layouts.json in die List einspielen (Name = Pfad, Widgets-Anzahl, Startseite-Flag)
        $store = json_decode((string) @file_get_contents($this->dataDir() . '/layouts.json'), true);
        $home  = is_array($store) ? (string) ($store['home'] ?? '') : '';
        $viewValues = [];
        $popups = $this->popupPages();
        foreach ($views as $nm => $cnt) {
            if (isset($popups[(string) $nm])) {
                continue;   // Popup, keine navigierbare Seite -> gehoert nicht in die Seitenliste
            }
            $viewValues[] = ['Name' => (string) $nm, 'Widgets' => (int) $cnt, 'Home' => ((string) $nm === $home)];
        }

        $elements = [
            ['type' => 'Label', 'caption' => 'LiveView Builder — Modul-Build: ' . $bld . '   ·   Instanz anlegen registriert /hook/builder + /hook/run automatisch.'],
            ['type' => 'Label', 'caption' => 'Seiten dieser View (' . $this->siteLabel() . '): Der Seitenname ist Teil des URL-Pfads — /hook/builder/' . $this->siteLabel() . '/<Seite> (bearbeiten) und /hook/run/' . $this->siteLabel() . '/<Seite> (Laufzeit). Hier anlegen und loeschen; Umbenennen im Builder (verschiebt den Inhalt).'],
            ['type' => 'List', 'name' => 'Views', 'caption' => 'Seiten', 'rowCount' => 8, 'add' => true, 'delete' => true,
                'columns' => [
                    ['caption' => 'Name (= Pfad)', 'name' => 'Name', 'width' => 'auto', 'add' => 'Neue Seite', 'edit' => ['type' => 'ValidationTextBox']],
                    ['caption' => 'Widgets', 'name' => 'Widgets', 'width' => '90px', 'add' => 0],
                    ['caption' => 'Startseite', 'name' => 'Home', 'width' => '110px', 'add' => false, 'edit' => ['type' => 'CheckBox']],
                ],
                'values' => $viewValues,
            ],
            ['type' => 'ExpansionPanel', 'caption' => 'Einstellungen', 'items' => [
                ['type' => 'ValidationTextBox', 'name' => 'BaseUrl', 'caption' => 'Basis-URL (z. B. http://10.0.0.5:3777) — für klickbare Links'],
                ['type' => 'ValidationTextBox', 'name' => 'BasePath', 'caption' => 'Datenordner (leer = automatisch, je Instanz)'],
                ['type' => 'ValidationTextBox', 'name' => 'WsPort', 'caption' => 'WebSocket-Port (optional)'],
                ['type' => 'ValidationTextBox', 'name' => 'WsUrl', 'caption' => 'WebSocket-Adresse (optional, z. B. wss://host/wss) - noetig hinter Reverse Proxy / HTTPS'],
                ['type' => 'ValidationTextBox', 'name' => 'IPSViewPath', 'caption' => 'IPSView-Fallbackpfad (optional)'],
                ['type' => 'ValidationTextBox', 'name' => 'Site', 'caption' => 'View-Name (= Ordner livebuilder/<Name> und URL-Pfad /hook/run/<Name>/...) — leer = Instanzname'],
                ['type' => 'Label', 'caption' => 'Datenordner aktiv: ' . $this->dataDir()],
            ]],
        ];

        $actions = [
            ['type' => 'Button', 'caption' => 'Builder oeffnen (alle Ansichten bearbeiten)', 'onClick' => 'LVB_OpenBuilder($id);'],
        ];
        if (!$hasUrl) {
            $actions[] = ['type' => 'Label', 'caption' => 'Tipp: „Basis-URL" in den Einstellungen setzen, dann sind die Links direkt anklickbar.'];
        }
        if (count($views) === 0) {
            $actions[] = ['type' => 'Label', 'caption' => 'Noch keine Ansichten. Oben eine anlegen, unten eine IPSView importieren oder im Builder erstellen.'];
        } else {
            $actions[] = ['type' => 'Label', 'caption' => 'Direkt-Links je Ansicht (Klick zeigt die URL):'];
            foreach ($views as $name => $count) {
                $runUrl  = $this->urlRun((string) $name);
                $editUrl = $this->urlBuilder((string) $name);
                $actions[] = ['type' => 'RowLayout', 'items' => [
                    ['type' => 'Label',  'caption' => $name . '  (' . $count . ')', 'width' => '240px'],
                    ['type' => 'Button', 'caption' => 'Run',  'onClick' => "echo '" . addslashes($runUrl) . "';"],
                    ['type' => 'Button', 'caption' => 'Bearbeiten', 'onClick' => "echo '" . addslashes($editUrl) . "';"],
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
        // Neuer Ordner je View (= Site):  <KernelDir>/livebuilder/<view>/
        return rtrim(IPS_GetKernelDir(), '/') . '/livebuilder/' . $this->siteLabel();
    }

    private function oldDataDir(): string
    {
        return rtrim(IPS_GetKernelDir(), '/') . '/liveview/' . $this->InstanceID;   // fruehere Auto-Ablage
    }

    // Einmalige Migration: fruehere Auto-Ablage (liveview/<id>/) in den neuen View-Ordner uebernehmen, falls dieser noch leer ist.
    private function migrateOldDir(): void
    {
        $new = $this->dataDir();
        if (is_file($new . '/index.json') || is_file($new . '/layouts.json')) {
            return; // neuer Ordner schon befuellt
        }
        $old = $this->oldDataDir();
        if ($old === $new || !is_file($old . '/layouts.json')) {
            return;
        }
        if (!is_dir($new)) { @mkdir($new, 0775, true); }
        @copy($old . '/layouts.json', $new . '/layouts.json');            // Handler zerlegt es beim ersten Laden in seiten/
        foreach (glob($old . '/layouts.*.json') ?: [] as $p) {            // Snapshots mitnehmen
            @copy($p, $new . '/' . basename($p));
        }
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

    private function urlBuilder(string $seite = ''): string
    {
        // Pfad = <View>/<Seite>. Ohne Seite: Builder auf der Start-Seite dieser View.
        return $this->baseUrl() . '/hook/builder/' . rawurlencode($this->siteLabel()) . ($seite !== '' ? '/' . rawurlencode($seite) : '');
    }

    private function urlRun(string $seite = ''): string
    {
        return $this->baseUrl() . '/hook/run/' . rawurlencode($this->siteLabel()) . ($seite !== '' ? '/' . rawurlencode($seite) : '');
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
        // Veraltete Hooks DIESER Instanz entfernen (alte globale /hook/builder|run, oder frueherer View-Name nach Umbenennung)
        $kept = [];
        foreach ($hooks as $h) {
            if ((int) ($h['TargetID'] ?? 0) === $this->InstanceID && !in_array((string) ($h['Hook'] ?? ''), $wanted, true)) {
                $changed = true;
                continue;
            }
            $kept[] = $h;
        }
        $hooks = $kept;
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
