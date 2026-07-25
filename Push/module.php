<?php

declare(strict_types=1);

/**
 * LiveViewBuilder Push
 *
 * Kind-Instanz am WebSocketServer (IPSNetwork). Pusht Änderungen der im Builder
 * gebundenen Variablen per WebSocket an ALLE verbundenen Browser.
 *
 *  - Quelle der überwachten Variablen = <BasePath>/layouts.json (identisch zum LiveViewBuilder).
 *  - Versand per Server-BROADCAST (DataID {79827379-...}) -> kein IP-Tracking, keine
 *    "Unbekannter Client"-Meldungen.
 *  - Payload wie ?api=val:  {ts, values:{ "<id>": {v,f,id} }} -> Builder ordnet per d.id zu.
 *  - Startup-sicher: nur RegisterMessage/RegisterTimer/ConnectParent, KEIN IPS_ApplyChanges
 *    auf fremde Instanzen im Kernel-Start.
 */
class LiveViewBuilderPush extends IPSModule
{
    private const BROADCAST      = '{79827379-F36E-4ADA-8A95-5F8D1DC92FA9}'; // Server: an alle Clients senden (ForwardData-Broadcast)
    private const WEBSOCKSERVER  = '{79827379-F36E-4ADA-8A95-5F8D1DC92FA9}'; // Kind-Verbindungs-Schnittstelle des IPSNetwork WebSocketServer (NICHT die Modul-GUID!)

    public function Create()
    {
        parent::Create();
        $this->RegisterPropertyString('BasePath', ''); // Datenordner = identisch zum LiveViewBuilder
        $this->ConnectParent(self::WEBSOCKSERVER);
        $this->RegisterTimer('Sync', 0, 'LVBP_Sync($_IPS[\'TARGET\']);');
    }

    public function ApplyChanges()
    {
        parent::ApplyChanges();
        $this->syncRegistrations();
        $this->SetTimerInterval('Sync', 300000); // alle 5 min layouts.json neu einlesen (neue Bindungen)
    }

    public function MessageSink($TimeStamp, $SenderID, $Message, $Data)
    {
        if ($Message === VM_UPDATE) {
            $id = (int) $SenderID;
            $this->broadcast(json_encode([
                'ts'     => time(),
                'values' => [(string) $id => ['v' => GetValue($id), 'f' => @GetValueFormatted($id), 'id' => $id]],
            ]));
            return;
        }
        if (defined('MM_UPDATE') && $Message === MM_UPDATE) {   // Kamera-/Medien-Schnappschuss aktualisiert -> Client neu laden lassen
            $this->broadcast(json_encode(['ts' => time(), 'media' => [(int) $SenderID]]));
            return;
        }
    }

    // Registrierungen aus layouts.json neu ziehen (Timer + manuell: LVBP_Sync(<id>)).
    public function Sync(): bool
    {
        $this->syncRegistrations();
        return true;
    }

    // Manuell testbar: LVBP_BroadcastText(<id>, 'text')
    public function BroadcastText(string $Text): bool
    {
        $this->broadcast($Text);
        return true;
    }

    private function broadcast(string $payload): void
    {
        $this->SendDataToParent(json_encode([
            'DataID' => self::BROADCAST,
            'Buffer' => utf8_encode($payload), // WebSocketServer.ForwardData macht utf8_decode() -> hier muss encodiert werden (wie WebSocketClient)
        ]));
    }

    private function syncRegistrations(): void
    {
        $mmu = defined('MM_UPDATE') ? MM_UPDATE : -1;

        $wantVar = [];
        foreach ($this->layoutIDs() as $id) {
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

        // Variablen (Werte)
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

        // Medien (Kamera-Schnappschüsse) -> Push bei MM_UPDATE
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

    // Kamera-Medien-IDs (camera/campro) aus layouts.json
    private function mediaIDs(): array
    {
        $bp = trim($this->ReadPropertyString('BasePath'));
        if ($bp === '') {
            return [];
        }
        $raw = @file_get_contents(rtrim($bp, '/') . '/layouts.json');
        $j   = json_decode((string) $raw, true);
        if (!is_array($j)) {
            return [];
        }
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

    // Alle im Builder gebundenen Variablen-IDs aus layouts.json (über alle Ansichten).
    private function layoutIDs(): array
    {
        $bp = trim($this->ReadPropertyString('BasePath'));
        if ($bp === '') {
            return [];
        }
        $raw = @file_get_contents(rtrim($bp, '/') . '/layouts.json');
        if ($raw === false) {
            return [];
        }
        $j = json_decode($raw, true);
        if (!is_array($j)) {
            return [];
        }
        $ids = [];
        $add = function ($v) use (&$ids) {
            $v = (int) $v;
            if ($v > 0) {
                $ids[$v] = true;
            }
        };
        foreach (($j['views'] ?? []) as $vw) {
            foreach (($vw['widgets'] ?? []) as $w) {
                foreach (['varId', 'varId2', 'varId3', 'visVar'] as $k) {
                    if (!empty($w[$k])) {
                        $add($w[$k]);
                    }
                }
                foreach (['items', 'rows', 'links', 'src', 'snk', 'fc'] as $k) {
                    if (!empty($w[$k]) && is_array($w[$k])) {
                        foreach ($w[$k] as $o) {
                            if (is_array($o)) {
                                foreach (['vid', 'hi', 'lo', 'pq'] as $kk) {
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

    public function GetConfigurationForm()
    {
        $bp = trim($this->ReadPropertyString('BasePath'));
        $n  = count($this->layoutIDs());
        return json_encode([
            'elements' => [
                ['type' => 'Label', 'caption' => 'Sendet Änderungen der im Builder gebundenen Variablen per WebSocket an alle Clients (Broadcast). Nutzt dieselbe layouts.json wie der LiveViewBuilder.'],
                ['type' => 'ValidationTextBox', 'name' => 'BasePath', 'caption' => 'Datenordner (identisch zum LiveViewBuilder, z. B. /var/lib/symcon/scripts/hausleitnerweg)'],
                ['type' => 'Label', 'caption' => ($bp === '' ? '⚠ Bitte BasePath setzen (gleicher Ordner wie der Builder).' : ('Überwachte Variablen: ' . $n))],
            ],
            'actions' => [
                ['type' => 'Button', 'caption' => 'Registrierungen aktualisieren', 'onClick' => 'LVBP_Sync($id);'],
                ['type' => 'Button', 'caption' => 'Test-Broadcast senden', 'onClick' => 'LVBP_BroadcastText($id, \'{"values":{}}\');'],
            ],
            'status' => [
                ['code' => 102, 'icon' => 'active', 'caption' => 'Bereit'],
            ],
        ]);
    }
}
