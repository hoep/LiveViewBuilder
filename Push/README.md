# LiveViewBuilder Push (LVBP)

Eigenständiger WebSocket-Server für den LiveViewBuilder. Pusht Änderungen der im
Builder gebundenen Variablen sowie der Kamera-Medien aus dem **eigenen Event-Kontext**
an alle verbundenen Browser — ohne Polling.

- **Prefix:** `LVBP`
- **Modul-GUID:** `{7B3E9F21-4C8A-4D6E-B1F5-9A0C2D3E4F60}`
- **Implementierte Datenschnittstelle:** `{7A1272A4-CBDB-46EF-BFC6-DCF4A53D2FC7}`
- **Parent (Pflicht):** IPS *Server-Socket* (I/O), Datenschnittstelle
  `{C8792760-65CF-4C53-B5C7-A30FCC84FEFE}`
- **Aliase:** `LiveView Push`, `LiveViewBuilder WebSocket Push`
- **Typ:** I/O-Modul (type 2), Kind eines Server-Sockets
- **Basisklasse:** `IPSModule` (kein HomeSuite-EntityModule)

## Überblick / Architektur

Das Modul ist Kind eines IPS-**Server-Sockets** und übernimmt den WebSocket-Handshake
und das Framing **selbst**. Änderungen der überwachten Variablen/Medien werden im eigenen
`MessageSink` empfangen und direkt an alle verbundenen Browser broadcastet.

Der springende Punkt gegenüber dem Community-`WebSocketServer`: Dessen
`ForwardData`-Broadcast sieht bei Aufruf durch eine **Fremd-Instanz** die Clientliste
leer (Puffer-Isolation je Instanz). Hier laufen Empfang der Clientliste (`ReceiveData`)
und das Broadcasten (`MessageSink`) in **derselben Instanz** und teilen sich denselben
Buffer — deshalb funktioniert der Broadcast aus dem Variablen-Event heraus.

Datenfluss:

1. **Handshake** — Browser verbindet über den Server-Socket. `ReceiveData` erkennt die
   `Sec-WebSocket-Key`-Anfrage, sendet die `101 Switching Protocols`-Antwort und nimmt
   den Client (`ip:port`) in den Buffer `clients` auf.
2. **Registrierung** — aus `layouts.json` (Merged Store über alle Views) werden alle
   gebundenen Variablen- und Medien-IDs ermittelt und per `RegisterMessage`
   (`VM_UPDATE` / `MM_UPDATE`) abonniert. Zusätzlich werden die HomeSuite-Licht-Steuervariablen
   fest abonniert (siehe unten).
3. **Broadcast** — bei `VM_UPDATE`/`MM_UPDATE` erzeugt `MessageSink` ein WS-Text-Frame und
   sendet es an jeden Client im Buffer.
4. **Trennung** — TCP-Disconnect (`Type 2`) oder Close-Frame (Opcode `0x8`) entfernt den
   Client aus dem Buffer.

**Payload-Format** (identisch zu `?api=val` im LiveViewBuilder):

```json
{ "ts": 1699999999, "values": { "<id>": { "v": <wert>, "f": "<formatiert>", "id": <id> } } }
{ "ts": 1699999999, "media": [ <mediaId> ] }
```

### HomeSuite-Licht als Sonderfall (self-maintaining)

Über `IPS_GetInstanceListByModuleID('{B7E1C3A4-5D62-4F08-9A1E-2C7D6B4F0E93}')`
(HomeSuite **LightDevice**, HSLT) werden die Steuervariablen `Power`, `Brightness` und
`ColorTemp` **immer** abonniert — unabhängig davon, ob sie im Layout gebunden sind. So
bekommen die entity-gebundenen Licht-Widgets (`lightgrid`/`lightroom`) ihre Werte per
WebSocket statt per Poll, auch bei Änderungen durch Handschalter, Automatik oder andere
Clients.

## Konfiguration

### Properties

| Property   | Typ     | Default | Bedeutung |
|------------|---------|---------|-----------|
| `BasePath` | String  | `''`    | Datenordner, **identisch zum LiveViewBuilder**. Entweder ein einzelner View-Ordner (enthält `layouts.json`) oder der Basis-Ordner `livebuilder/` (enthält `*/layouts.json` je View). |
| `Port`     | Integer | `8082`  | WebSocket-Port. Wird beim Anwenden **auf den darunterliegenden Server-Socket erzwungen** (Port setzen + `Open=true`). |

### Konfigurationsformular (`GetConfigurationForm`)

- **Label** — Hinweis: als I/O einen „Server Socket" (offener Port) darunter hängen.
- **BasePath** — `ValidationTextBox`, Datenordner.
- **Port** — `NumberSpinner`, WebSocket-Port.
- **Statuszeile** — zeigt bei leerem `BasePath` eine Warnung, sonst die Anzahl der
  überwachten Variablen und Kamera-Medien.
- **Aktion „Registrierungen aktualisieren"** — Button `LVBP_Sync($id);`.

### Parent-Erzwingung

Beim `ApplyChanges` (nur bei `KR_READY`) wird der `ConnectionID`-Server-Socket auf den
konfigurierten Port und `Open=true` gezwungen und bei Bedarf `IPS_ApplyChanges` auf den
Parent ausgelöst. Der Instanz-Status wird auf `IS_ACTIVE` gesetzt, wenn der Parent aktiv
ist, sonst `IS_INACTIVE`.

## Status-Variablen / Controls

Das Modul legt **keine Status-Variablen** an. Zustand wird ausschließlich im
Instanz-**Buffer** gehalten:

- `clients` — JSON-Map der verbundenen Browser (`"ip:port" => {ip, port}`); wird bei
  jedem (Re)Start geleert, da sich die Clients neu verbinden.

**Timer:**

- `Sync` — nach dem Start zunächst auf 4 s gesetzt (Registrierungen greifen direkt nach
  dem Start nicht immer zuverlässig), danach re-scheduled auf **300 s** (5 min), um
  `layouts.json` periodisch neu einzulesen.

## Öffentliche Skript-/RPC-Funktionen

| Funktion | Rückgabe | Zweck |
|----------|----------|-------|
| `LVBP_Sync(int $id)` | `bool` | Registrierungen aus `layouts.json` neu ziehen (abonnieren/abbestellen), danach Timer auf 5 min. Auch der Button im Formular. |
| `LVBP_BroadcastText(int $id, string $Text)` | `bool` | Sendet einen beliebigen Text als WS-Frame an alle Clients. **Achtung:** nur aus Kernel-/Event-Kontext sinnvoll — nur dort ist die Clientliste sichtbar. |

Interne Methoden (kein RPC): `ReceiveData`, `MessageSink`, `broadcast`, `sendHandshake`,
`sendRaw`, `wsEncode`, `syncRegistrations`, `layoutJson`/`layoutIDs`/`mediaIDs`/`hsLightVars`.

## Registrierungs-Discovery (`layouts.json`)

`syncRegistrations` ermittelt die zu abonnierenden IDs durch Merge **aller** Views:

- **Variablen** aus Widget-Feldern `varId`, `varId2`, `varId3`, `visVar`, `tankVid`
  sowie aus Listen (`items`, `rows`, `links`, `src`, `snk`, `fc`, `stages`, `elements`)
  über die Objekt-Schlüssel `vid`, `subvid`, `hi`, `lo`, `pq`, `speedVid`, `socVid`.
- **HomeSuite-Licht-Steuervariablen** (Power/Brightness/ColorTemp) aller HSLT-Instanzen.
- **Kamera-Medien** aus Widgets vom Typ `camera`/`campro` (Feld `mediaId`).

Nicht mehr benötigte Abos werden abbestellt (Abgleich Ist/Soll über `GetMessageList`).
Der Merged Store macht View-Namen je Ordner eindeutig (`<name>@<dir>`), um Kollisionen
über mehrere View-Ordner zu vermeiden.

## Besondere Hinweise

- **Gleiche-Instanz-Prinzip:** Clientliste-Pflege (`ReceiveData`) und Broadcast
  (`MessageSink`) müssen in derselben Instanz laufen — das ist der ganze Grund für dieses
  eigene Modul statt des Community-WebSocketServers.
- **Byte-erhaltende Kodierung:** Frames werden über eine ISO-8859-1 ↔ UTF-8-Wandlung
  (`mb_convert_encoding`, Fallback `utf8_encode/decode`) an den Server-Socket übergeben,
  wie dieser sie erwartet. Binärgenaues WS-Framing (`wsEncode`) mit korrekten
  Längen-Feldern (7 Bit / 16 Bit / 64 Bit).
- **Kernelstart:** Registrierungen greifen erst bei `KR_READY`. Das Modul registriert
  `IPS_KERNELSTARTED` und ruft im `MessageSink` erneut `ApplyChanges` auf; auf einen im
  Startup nicht erlaubten Parent-`ApplyChanges` wird verzichtet, bis `KR_READY` erreicht ist.
- **Betrieb hinter Proxy:** Der Port (Default 8082) korrespondiert mit dem
  Reverse-Proxy-Setup (NPM, Location `/wss`, langer Read-Timeout) für die
  WebSocket-Verbindung der LiveViewBuilder-Frontends.
