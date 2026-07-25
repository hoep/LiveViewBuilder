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
    private const BROADCAST      = '{79827379-F36E-4ADA-8A95-5F8D1DC92FA9}'; // Server: an alle Clients senden
    private const WEBSOCKSERVER  = '{7869923C-6E1D-4E66-A0BD-627FAD1679C2}'; // IPSNetwork WebSocketServer

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
        if ($Message !== VM_UPDATE) {
            return;
        }
        $id      = (int) $SenderID;
        $payload = json_encode([
            'ts'     => time(),
            'values' => [(string) $id => ['v' => GetValue($id), 'f' => @GetValueFormatted($id), 'id' => $id]],
        ]);
        $this->broadcast($payload);
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
            'Buffer' => $payload,
        ]));
    }

    private function syncRegistrations(): void
    {
        $want = [];
        foreach ($this->layoutIDs() as $id) {
            $want[$id] = true;
        }
        $have = [];
        foreach ($this->GetMessageList() as $senderID => $messageIDs) {
            foreach ($messageIDs as $messageID) {
                if ($messageID === VM_UPDATE) {
                    $have[(int) $senderID] = true;
                }
            }
        }
        foreach ($want as $id => $_) {
            if (!isset($have[$id]) && IPS_VariableExists($id)) {
                $this->RegisterMessage($id, VM_UPDATE);
            }
        }
        foreach ($have as $id => $_) {
            if (!isset($want[$id])) {
                $this->UnregisterMessage($id, VM_UPDATE);
            }
        }
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
