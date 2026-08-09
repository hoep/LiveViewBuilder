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
            $this->broadcast(json_encode([
                'ts'     => time(),
                'values' => [(string) $id => ['v' => GetValue($id), 'f' => @GetValueFormatted($id), 'id' => $id]],
            ]));
            return;
        }
        if (defined('MM_UPDATE') && $Message === MM_UPDATE) {
            $this->broadcast(json_encode(['ts' => time(), 'media' => [(int) $SenderID]]));
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
        // WS-Frame vom Client -> nur Close-Frame beachten (Rest ignorieren, z. B. 'hello')
        if ((ord($buf[0]) & 0x0F) === 0x8) {
            if (isset($clients[$key])) {
                unset($clients[$key]);
                $this->SetBuffer('clients', json_encode($clients));
            }
        }
        return '';
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
    private function broadcast(string $payload): void
    {
        $clients = json_decode($this->GetBuffer('clients'), true);
        if (!is_array($clients) || !$clients) {
            return;
        }
        $frame = $this->wsEncode($payload);
        foreach ($clients as $c) {
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
        // HomeSuite-Licht (HSLT): Steuervariablen IMMER abonnieren, damit die entity-gebundenen
        // Licht-Widgets (lightgrid/lightroom) ihre Werte per WebSocket statt Poll bekommen —
        // auch fuer Aenderungen von Handschaltern/Automatik/anderen Clients (self-maintaining).
        foreach ($this->hsLightVars() as $id) {
            $wantVar[$id] = true;
        }
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
    private function hsLightVars(): array
    {
        $out = [];
        $ins = @IPS_GetInstanceListByModuleID('{B7E1C3A4-5D62-4F08-9A1E-2C7D6B4F0E93}') ?: [];
        foreach ($ins as $iid) {
            foreach (['Power', 'Brightness', 'ColorTemp'] as $ident) {
                $v = (int) (@IPS_GetObjectIDByIdent($ident, $iid) ?: 0);
                if ($v > 0 && @IPS_VariableExists($v)) {
                    $out[] = $v;
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

    private function layoutIDs(): array
    {
        $j = $this->layoutJson();
        $ids = [];
        $add = function ($v) use (&$ids) {
            $v = (int) $v;
            if ($v > 0) {
                $ids[$v] = true;
            }
        };
        foreach (($j['views'] ?? []) as $vw) {
            foreach (($vw['widgets'] ?? []) as $w) {
                foreach (['varId', 'varId2', 'varId3', 'visVar', 'tankVid'] as $k) {
                    if (!empty($w[$k])) {
                        $add($w[$k]);
                    }
                }
                foreach (['items', 'rows', 'links', 'src', 'snk', 'fc', 'stages', 'elements'] as $k) {
                    if (!empty($w[$k]) && is_array($w[$k])) {
                        foreach ($w[$k] as $o) {
                            if (is_array($o)) {
                                foreach (['vid', 'subvid', 'hi', 'lo', 'pq', 'speedVid', 'socVid'] as $kk) {
                                    if (!empty($o[$kk])) {
                                        $add($o[$kk]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
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
