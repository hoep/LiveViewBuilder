<?php

declare(strict_types=1);

/**
 * LiveViewBuilder Push  —  eigenständiger WebSocket-Server.
 *
 * Kind eines IPS *Server-Sockets* (I/O). Übernimmt WS-Handshake + Framing selbst und
 * broadcastet Variablen-/Medien-Änderungen aus dem EIGENEN Event-Kontext (MessageSink) an
 * alle verbundenen Browser. Damit entfällt die Puffer-Isolation des Community-WebSocketServers
 * (dessen ForwardData-Broadcast bei Aufruf durch eine Fremd-Instanz die Clientliste leer sieht).
 *
 *  - Überwachte IDs = <BasePath>/layouts.json (identisch zum LiveViewBuilder).
 *  - Clientliste in eigenem Buffer; in ReceiveData gepflegt, in MessageSink gelesen (gleiche Instanz).
 *  - Payload wie ?api=val:  {ts, values:{ "<id>": {v,f,id} }}  bzw. {ts, media:[<id>]}.
 */
class LiveViewBuilderPush extends IPSModule
{
    private const IO = '{C8792760-65CF-4C53-B5C7-A30FCC84FEFE}'; // Server-Socket-Datenschnittstelle (Parent)

    /** Ab dieser Rahmengroesse wird ein Wert nur noch ANGEKUENDIGT statt mitgeschickt. */
    private const MAX_NUTZLAST = 8192;

    public function Create()
    {
        parent::Create();
        $this->RegisterPropertyString('BasePath', '');
        $this->RegisterPropertyInteger('Port', 8082);
        $this->ConnectParent(self::IO);
        $this->RegisterTimer('Sync', 0, 'LVBP_Sync($_IPS[\'TARGET\']);');
        $this->SetBuffer('clients', json_encode([]));
    }

    public function ApplyChanges()
    {
        parent::ApplyChanges();
        $this->RegisterMessage(0, IPS_KERNELSTARTED); // nach Kernelstart erneut anwenden (Registrierungen erst bei KR_READY)
        $this->SetBuffer('clients', json_encode([]));  // Clients verbinden sich nach (Re)Start neu

        if (IPS_GetKernelRunlevel() !== KR_READY) {
            return; // erst bei KR_READY konfigurieren (kein IPS_ApplyChanges auf Parent im Startup)
        }

        // Parent-Server-Socket auf Port + offen zwingen (wie beim WebSocketServer)
        $pid = IPS_GetInstance($this->InstanceID)['ConnectionID'];
        if ($pid > 0) {
            $port = $this->ReadPropertyInteger('Port');
            $chg  = false;
            if ((int) @IPS_GetProperty($pid, 'Port') !== $port) { IPS_SetProperty($pid, 'Port', $port); $chg = true; }
            if (@IPS_GetProperty($pid, 'Open') !== true)       { IPS_SetProperty($pid, 'Open', true);   $chg = true; }
            if ($chg) { @IPS_ApplyChanges($pid); }
        }
        $this->SetStatus(($pid > 0 && IPS_GetInstance($pid)['InstanceStatus'] === IS_ACTIVE) ? IS_ACTIVE : IS_INACTIVE);
        $this->syncRegistrations();
        // Registrierungen greifen direkt nach dem Start nicht immer -> Sync gleich nochmal per Timer im normalen Laufzeitkontext
        $this->SetTimerInterval('Sync', 4000);
    }

    // ===== Broadcast-Quelle: Variablen-/Medien-Events (EIGENER Kontext -> Clientliste sichtbar) =====
    public function MessageSink($TimeStamp, $SenderID, $Message, $Data)
    {
        if ($Message === IPS_KERNELSTARTED) {
            $this->ApplyChanges(); // jetzt ist KR_READY -> Registrierungen + Parent-Konfig
            return;
        }
        if ($Message === VM_UPDATE) {
            $id = (int) $SenderID;
            // NUR ECHTE AENDERUNGEN. Viele Module schreiben ihre Variablen bei jedem Abruf neu,
            // auch wenn sich nichts geaendert hat (VariableUpdated wandert, VariableChanged
            // nicht). Der Filter galt zuerst nur fuer Geraetevariablen; gemessen am 19.09.2026
            // lag der Grund dafuer aber woanders: EINE Tabellenvariable von 97 kB wurde
            // mehrmals je Minute unveraendert neu geschrieben und machte damit ueber die
            // Haelfte des gesamten Push-Verkehrs aus - an jeden Browser, auf jeder Seite.
            // Der Client verliert dabei nichts: er haelt ohnehin nur den letzten Wert und
            // vermerkt den Aenderungszeitpunkt erst, wenn der Wert sich unterscheidet.
            $v = @IPS_GetVariable($id);
            if (is_array($v) && (int) $v['VariableUpdated'] !== (int) $v['VariableChanged']) {
                return;
            }
            $wert = GetValue($id);
            $satz = ['v' => $wert, 'f' => @GetValueFormatted($id), 'id' => $id];
            $nutz = json_encode(['ts' => time(), 'values' => [(string) $id => $satz]]);
            // GROSSE WERTE NICHT VERTEILEN. Eine Protokolltabelle als JSON-String gehoert auf
            // genau eine Seite, wird aber an jeden Client geschickt, der gerade irgendetwas
            // anschaut - samt Empfang und JSON.parse auf einem Tablet. Ab der Grenze geht
            // deshalb nur die NACHRICHT hinaus, dass sich die Variable geaendert hat; wer sie
            // anzeigt, holt sie sich ueber den gewoehnlichen Wertabruf.
            if (strlen($nutz) > self::MAX_NUTZLAST) {
                $this->broadcast(json_encode(['ts' => time(), 'changed' => [$id]]), [$id]);
                return;
            }
            $this->broadcast($nutz, [$id]);
            return;
        }
        if (defined('MM_UPDATE') && $Message === MM_UPDATE) {
            $this->broadcast(json_encode(['ts' => time(), 'media' => [(int) $SenderID]]));  // Medien ohne ID-Filter
            return;
        }
    }

    // ===== WS-Server: Daten vom Server-Socket (Browser-Clients) =====
    public function ReceiveData($JSONString)
    {
        $d = json_decode($JSONString);
        if (!is_object($d)) {
            return '';
        }
        $ip   = (string) ($d->ClientIP ?? '');
        $port = (int) ($d->ClientPort ?? 0);
        $type = (int) ($d->Type ?? 0);
        $key  = $ip . ':' . $port;

        $clients = json_decode($this->GetBuffer('clients'), true);
        if (!is_array($clients)) {
            $clients = [];
        }

        if ($type === 1) { // TCP verbunden -> auf WS-Handshake warten
            return '';
        }
        if ($type === 2) { // getrennt
            if (isset($clients[$key])) {
                unset($clients[$key]);
                $this->SetBuffer('clients', json_encode($clients));
            }
            return '';
        }

        // type 0 = Daten
        $buf = isset($d->Buffer) ? $this->u8d((string) $d->Buffer) : '';
        if ($buf === '') {
            return '';
        }
        if (stripos($buf, 'sec-websocket-key') !== false) { // Handshake-Anfrage
            $this->sendHandshake($ip, $port, $buf);
            $clients[$key] = ['ip' => $ip, 'port' => $port];
            $this->SetBuffer('clients', json_encode($clients));
            return '';
        }
        // WS-Rahmen vom Client. Bisher wurde alles ausser dem Close-Frame verworfen; seit
        // der Client seine Seiten-IDs meldet, muessen Textrahmen wirklich gelesen werden.
        // Der Server-Socket liefert keine Rahmengrenzen, sondern Bytes: angefallenes wird
        // je Client zwischengelagert, bis ein vollstaendiger Rahmen darin steht.
        if (!isset($clients[$key])) {
            return '';                      // Daten ohne Handschlag - nicht unser Client
        }
        $rest = base64_decode((string) ($clients[$key]['rx'] ?? '')) . $buf;
        $zu   = false;
        while (($r = $this->wsDecode($rest)) !== null) {
            if ($r['op'] === 0x8) { $zu = true; break; }
            if ($r['op'] === 0x1 || $r['op'] === 0x2) {
                $j = json_decode($r['nutz'], true);
                if (is_array($j) && isset($j['ids']) && is_array($j['ids'])) {
                    // Als Schluessel ablegen: der Vergleich im Broadcast ist dann ein
                    // isset() statt einer Suche ueber mehrere hundert Eintraege.
                    $m = [];
                    foreach ($j['ids'] as $i) {
                        $i = (int) $i;
                        if ($i > 0) { $m[(string) $i] = 1; }
                    }
                    $clients[$key]['ids'] = $m;
                }
            }
        }
        if ($zu) {
            unset($clients[$key]);
        } else {
            // Angebrochenen Rest aufheben, aber nicht unbegrenzt: ein Client, der Unsinn
            // schickt, darf den Puffer nicht volllaufen lassen.
            $clients[$key]['rx'] = (strlen($rest) > 65536) ? '' : base64_encode($rest);
        }
        $this->SetBuffer('clients', json_encode($clients));
        return '';
    }

    /**
     * Einen vollstaendigen WS-Rahmen vom Anfang des Puffers nehmen.
     *
     * Client-Rahmen sind IMMER maskiert (RFC 6455). Steht noch kein vollstaendiger
     * Rahmen im Puffer, bleibt der Puffer unangetastet und es kommt null zurueck.
     *
     * @return array{op:int,nutz:string}|null
     */
    private function wsDecode(string &$puffer): ?array
    {
        $n = strlen($puffer);
        if ($n < 2) {
            return null;
        }
        $op   = ord($puffer[0]) & 0x0F;
        $mask = (ord($puffer[1]) & 0x80) !== 0;
        $len  = ord($puffer[1]) & 0x7F;
        $k    = 2;
        if ($len === 126) {
            if ($n < 4) { return null; }
            $len = unpack('n', substr($puffer, 2, 2))[1];
            $k   = 4;
        } elseif ($len === 127) {
            if ($n < 10) { return null; }
            $len = unpack('J', substr($puffer, 2, 8))[1];
            $k   = 10;
        }
        $mk = '';
        if ($mask) {
            if ($n < $k + 4) { return null; }
            $mk = substr($puffer, $k, 4);
            $k += 4;
        }
        if ($n < $k + $len) {
            return null;
        }
        $nutz = substr($puffer, $k, $len);
        if ($mask) {
            for ($i = 0; $i < $len; $i++) {
                $nutz[$i] = chr(ord($nutz[$i]) ^ ord($mk[$i % 4]));
            }
        }
        $puffer = substr($puffer, $k + $len);
        return ['op' => $op, 'nutz' => $nutz];
    }

    // Registrierungen aus layouts.json neu ziehen (Timer + manuell: LVBP_Sync(<id>)).
    public function Sync(): bool
    {
        $this->syncRegistrations();
        $this->SetTimerInterval('Sync', 300000); // danach nur noch alle 5 min layouts.json neu einlesen
        return true;
    }

    // Manuell/Skript testbar — ACHTUNG: nur aus Kernel-/Event-Kontext sinnvoll (Clientliste sichtbar).
    public function BroadcastText(string $Text): bool
    {
        $this->broadcast($Text);
        return true;
    }

    // ===== intern =====
    /**
     * An alle Clients senden - oder nur an die, die diese IDs ueberhaupt anzeigen.
     *
     * Ein Client meldet nach dem Verbinden, welche Variablen seine SEITE bindet
     * (siehe ReceiveData). Gemessen am 19.09.2026 brauchte die Lichtseite 0,3 % der
     * Nachrichten und praktisch 0 % der Bytes, die sie bekam - alles uebrige hat sie
     * empfangen, entpackt und weggeworfen.
     *
     * Wer nichts gemeldet hat, bekommt weiterhin alles: aeltere Clients und die
     * Medien-Meldung sollen sich unveraendert verhalten.
     *
     * @param list<int>|null $ids Variablen, um die es geht; null = nicht filterbar
     */
    private function broadcast(string $payload, ?array $ids = null): void
    {
        $clients = json_decode($this->GetBuffer('clients'), true);
        if (!is_array($clients) || !$clients) {
            return;
        }
        $frame = $this->wsEncode($payload);
        foreach ($clients as $c) {
            if ($ids !== null && !empty($c['ids']) && is_array($c['ids'])) {
                $treffer = false;
                foreach ($ids as $i) {
                    if (isset($c['ids'][(string) $i])) { $treffer = true; break; }
                }
                if (!$treffer) {
                    continue;
                }
            }
            $this->sendRaw((string) $c['ip'], (int) $c['port'], $frame);
        }
    }

    private function sendHandshake(string $ip, int $port, string $req): void
    {
        if (!preg_match('/Sec-WebSocket-Key:\s*(.+)\r\n/i', $req, $m)) {
            return;
        }
        $accept = base64_encode(sha1(trim($m[1]) . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));
        $resp = "HTTP/1.1 101 Switching Protocols\r\n"
              . "Upgrade: websocket\r\n"
              . "Connection: Upgrade\r\n"
              . "Sec-WebSocket-Accept: " . $accept . "\r\n\r\n";
        $this->sendRaw($ip, $port, $resp);
    }

    private function sendRaw(string $ip, int $port, string $data): void
    {
        $this->SendDataToParent(json_encode([
            'DataID'     => self::IO,
            'Buffer'     => $this->u8e($data),
            'ClientIP'   => $ip,
            'ClientPort' => $port,
            'Type'       => 0,
        ]));
    }

    private function wsEncode(string $payload): string
    {
        $len = strlen($payload);
        $b   = chr(0x81); // FIN + Text
        if ($len < 126) {
            $b .= chr($len);
        } elseif ($len < 65536) {
            $b .= chr(126) . pack('n', $len);
        } else {
            $b .= chr(127) . pack('J', $len);
        }
        return $b . $payload;
    }

    // Byte-erhaltende ISO-8859-1 <-> UTF-8 Wandlung (wie der Server-Socket sie erwartet)
    private function u8e(string $s): string
    {
        return function_exists('mb_convert_encoding') ? mb_convert_encoding($s, 'UTF-8', 'ISO-8859-1') : utf8_encode($s);
    }
    private function u8d(string $s): string
    {
        return function_exists('mb_convert_encoding') ? mb_convert_encoding($s, 'ISO-8859-1', 'UTF-8') : utf8_decode($s);
    }

    private function syncRegistrations(): void
    {
        $mmu = defined('MM_UPDATE') ? MM_UPDATE : -1;

        $wantVar = [];
        foreach ($this->layoutIDs() as $id) {
            $wantVar[$id] = true;
        }
        // HomeSuite-Geraetemodule: Zustandsvariablen IMMER abonnieren. Die zugehoerigen Widgets
        // binden ueber eine Sitzung statt ueber eine Variablen-ID, tauchen also im Layout nicht
        // mit einer ID auf — ohne diese Liste bekaemen sie nie einen Push.
        $entity = [];
        foreach ($this->hsEntityVars() as $id) {
            $wantVar[$id] = true;
            $entity[$id]  = 1;
        }
        // Merkzettel fuer MessageSink: fuer diese IDs wird nur bei echter Aenderung gesendet.
        $this->SetBuffer('entityIds', json_encode($entity));
        $wantMedia = [];
        foreach ($this->mediaIDs() as $id) {
            $wantMedia[$id] = true;
        }

        $haveVar = [];
        $haveMedia = [];
        foreach ($this->GetMessageList() as $senderID => $messageIDs) {
            foreach ($messageIDs as $messageID) {
                if ($messageID === VM_UPDATE) {
                    $haveVar[(int) $senderID] = true;
                }
                if ($mmu !== -1 && $messageID === $mmu) {
                    $haveMedia[(int) $senderID] = true;
                }
            }
        }

        foreach ($wantVar as $id => $_) {
            if (!isset($haveVar[$id]) && IPS_VariableExists($id)) {
                $this->RegisterMessage($id, VM_UPDATE);
            }
        }
        foreach ($haveVar as $id => $_) {
            if (!isset($wantVar[$id])) {
                $this->UnregisterMessage($id, VM_UPDATE);
            }
        }
        if ($mmu !== -1) {
            foreach ($wantMedia as $id => $_) {
                if (!isset($haveMedia[$id]) && IPS_MediaExists($id)) {
                    $this->RegisterMessage($id, $mmu);
                }
            }
            foreach ($haveMedia as $id => $_) {
                if (!isset($wantMedia[$id])) {
                    $this->UnregisterMessage($id, $mmu);
                }
            }
        }
    }

    /** Steuervariablen aller HomeSuite-LightDevice-Instanzen (Power/Brightness/ColorTemp). */
    /**
     * Zustandsvariablen ALLER Instanzen der eigenen Bibliotheken.
     *
     * Warum bibliotheksweit statt einer Liste je Modul: die zugehoerigen Widgets binden ueber
     * eine Sitzung (session=audio/shade/heatEG …) statt ueber eine Variablen-ID - im Layout
     * steht also nichts, was layoutIDs() finden koennte. Eine handgepflegte Liste je Modul war
     * der erste Versuch und schon nach einer Stunde unvollstaendig: Maeher, Gardena, Pool und
     * die Audio-Bruecke fehlten, und jedes kuenftige Modul haette sie erneut gebraucht.
     *
     * Genommen werden die DIREKTEN Variablen jeder Instanz. Was tiefer im Baum haengt (die
     * mehreren hundert Konfigurationswerte des Poolcontrollers etwa), ist Konfiguration und
     * wird ohnehin ueber die Layout-Bindungen erfasst, wenn eine Kachel es anzeigt.
     *
     * Die Menge ist unkritisch, weil MessageSink fuer genau diese IDs nur bei ECHTER Aenderung
     * sendet - die Module schreiben ihre Werte bei jedem Abruf neu.
     */
    private const EIGENE_LIBS = [
        '{0F66F23F-ED50-4CD5-AB44-5FC961C7733A}',   // HomeSuite
        '{3E7A64C1-58D2-4B09-9F13-6C2A85E4D770}',   // WeatherStation
    ];

    /** Gehoert die Variable zu den eigenen Modulen (dann: nur bei echter Aenderung senden)? */
    private function istEntityVar(int $id): bool
    {
        static $set = null;
        if ($set === null) {
            $j   = json_decode((string) $this->GetBuffer('entityIds'), true);
            $set = is_array($j) ? $j : [];
        }
        return isset($set[$id]) || isset($set[(string) $id]);
    }

    private function hsEntityVars(): array
    {
        $out = [];
        foreach (IPS_GetInstanceList() as $iid) {
            $mid = (string) (@IPS_GetInstance($iid)['ModuleInfo']['ModuleID'] ?? '');
            if ($mid === '') {
                continue;
            }
            $m = @IPS_GetModule($mid);
            if (!is_array($m) || !in_array((string) ($m['LibraryID'] ?? ''), self::EIGENE_LIBS, true)) {
                continue;
            }
            foreach (@IPS_GetChildrenIDs($iid) ?: [] as $ch) {
                if (@IPS_GetObject($ch)['ObjectType'] === 2) {
                    $out[] = (int) $ch;
                }
            }
        }
        return $out;
    }

    private function mediaIDs(): array
    {
        $j = $this->layoutJson();
        $ids = [];
        foreach (($j['views'] ?? []) as $vw) {
            foreach (($vw['widgets'] ?? []) as $w) {
                $t = $w['type'] ?? '';
                if (($t === 'camera' || $t === 'campro') && !empty($w['mediaId'])) {
                    $ids[(int) $w['mediaId']] = true;
                }
            }
        }
        return array_keys($ids);
    }

    /**
     * Alle Variablen-IDs, die IRGENDEIN Widget bindet.
     *
     * Frueher stand hier eine feste Liste von Schluesseln (varId, varId2, varId3, visVar,
     * tankVid). Damit bekamen genau die Widgets keinen Push, die viele Einzelwerte binden -
     * Wetter, Sonnenszene, Rollo-Kacheln nutzen eigene Schluessel (vTemp, ssRad, wxFog …).
     * Sie hingen am Sicherheits-Poll und aktualisierten erst nach bis zu fuenf Sekunden,
     * waehrend danebenliegende Kacheln sofort umsprangen.
     *
     * Statt die Liste bei jedem neuen Widget nachzuziehen - was zuverlaessig vergessen wird -
     * werden jetzt ALLE Felder eingesammelt, deren NAME nach einer Variablenbindung aussieht.
     * Die Struktur wird dabei rekursiv durchlaufen, damit auch Zeilen, Kinder und Elemente
     * mitkommen. Ein Fehltreffer ist unschaedlich: registriert wird nur, was eine Variable ist
     * (IPS_VariableExists), alles andere faellt hinten heraus.
     */
    private function layoutIDs(): array
    {
        $j = $this->layoutJson();
        $ids = [];

        // Namensmuster einer Bindung: varId/varId2/…, visVar, condVar, cmpVid, ackVid,
        // die Praefixe v/ss/wx/cv mit folgendem Grossbuchstaben (vTemp, ssRad, wxFog, cvAzB)
        // sowie alles, was auf Id/Vid/VarId endet.
        //
        // Die ENDUNGEN werden ohne Ruecksicht auf Gross-/Kleinschreibung geprueft (/i):
        // klein geschriebenes "vid" faellt sonst durch alle drei Muster, und genau dieses
        // Feld benutzen die Listen-Widgets.
        // Genau dieses Feld benutzen aber die Listen-Widgets: die Energieebene der
        // Sonnenszene, die Zellen der Regeltabellen. Am 19.08.2026 waren dadurch 541 von
        // 577 solcher Bindungen NICHT abonniert - sie aktualisierten sich nur im Abfragetakt,
        // nicht ueber die Verbindung. Sichtbar wurde es an den PV-Werten, die minutenlang
        // standen, obwohl sie sich im Sekundentakt aendern.
        //
        // Bewusst NICHT aufgenommen: mediaId, mowerId, eventId, rootId, houseId, locId,
        // astroId - das sind Medien-, Instanz-, Ereignis- und Kategoriekennungen, keine
        // Variablen. Sie zu abonnieren brächte nichts und verschleierte den Zweck der Liste.
        $istBindung = static function (string $k): bool {
            // Feste Namen und Endungen: Schreibweise egal.
            // Die PRAEFIX-Regel bleibt bewusst schreibungsempfindlich - der Grossbuchstabe
            // IST dort das Signal. Ohne ihn wuerden "value", "visible" oder "version"
            // ploetzlich als Variablenbindung gelten und irgendeine Zahl abonniert.
            return (bool) preg_match('/^(varId\d*|visVar|condVar|cmpVid|ackVid|tankVid)$/i', $k)
                || (bool) preg_match('/^(v|ss|wx|cv)[A-Z]/', $k)
                || (bool) preg_match('/(Vid|VarId|VariableID)$/i', $k);
        };

        $sammle = function ($node) use (&$sammle, &$ids, $istBindung): void {
            if (!is_array($node)) {
                return;
            }
            foreach ($node as $k => $v) {
                if (is_array($v)) {
                    $sammle($v);
                    continue;
                }
                if (!is_string($k) || !$istBindung($k)) {
                    continue;
                }
                $id = (int) $v;                 // Formel-Token wie "=0" werden zu 0 und fallen weg
                if ($id > 0) {
                    $ids[$id] = true;
                }
            }
        };
        $sammle($j['views'] ?? []);

        return array_keys($ids);
    }

    // Merged Store ueber ALLE Views: BasePath kann der Basis-Ordner (livebuilder/) ODER ein einzelner View-Ordner sein.
    private function layoutJson(): array
    {
        $bp = trim($this->ReadPropertyString('BasePath'));
        if ($bp === '') {
            return [];
        }
        $bp    = rtrim($bp, '/');
        $files = [];
        if (is_file($bp . '/layouts.json')) {
            $files[] = $bp . '/layouts.json';               // Einzel-View (BasePath = View-Ordner)
        }
        foreach (glob($bp . '/*/layouts.json') ?: [] as $p) {
            $files[] = $p;                                  // Multi-View (BasePath = Basis livebuilder/)
        }
        $merged = ['views' => []];
        foreach ($files as $f) {
            $j = json_decode((string) @file_get_contents($f), true);
            if (is_array($j) && isset($j['views']) && is_array($j['views'])) {
                foreach ($j['views'] as $name => $v) {
                    $merged['views'][$name . '@' . dirname($f)] = $v;   // je Ordner eindeutig (Namenskollision ueber Views vermeiden)
                }
            }
        }
        return $merged;
    }

    public function GetConfigurationForm()
    {
        $bp = trim($this->ReadPropertyString('BasePath'));
        $n  = count($this->layoutIDs());
        $m  = count($this->mediaIDs());
        return json_encode([
            'elements' => [
                ['type' => 'Label', 'caption' => 'Eigenständiger WebSocket-Server: pusht Änderungen der im Builder gebundenen Variablen + Kamera-Medien an alle Browser. Als I/O einen „Server Socket" (offener Port) darunter hängen.'],
                ['type' => 'ValidationTextBox', 'name' => 'BasePath', 'caption' => 'Datenordner (identisch zum LiveViewBuilder)'],
                ['type' => 'NumberSpinner', 'name' => 'Port', 'caption' => 'WebSocket-Port (erzwingt den Port am Server-Socket)'],
                ['type' => 'Label', 'caption' => ($bp === '' ? '⚠ Bitte BasePath setzen.' : ('Überwacht: ' . $n . ' Variablen, ' . $m . ' Kamera-Medien.'))],
            ],
            'actions' => [
                ['type' => 'Button', 'caption' => 'Registrierungen aktualisieren', 'onClick' => 'LVBP_Sync($id);'],
            ],
            'status' => [
                ['code' => 102, 'icon' => 'active', 'caption' => 'Bereit'],
            ],
        ]);
    }
}
