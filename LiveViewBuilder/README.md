# LiveView Builder

Ein vollwertiger Dashboard-Builder fuer IP-Symcon — im Browser, per Drag and Drop, pixelgenau.
Aus ueber 100 Widget-Typen eigene Visualisierungen bauen, beliebige Symcon-Variablen live
anbinden, automatisch auf jeden Bildschirm skalieren und als Vollbild-Kiosk starten — ohne offene
Ports, ohne Skripte, ohne Konfiguration. Instanz anlegen, URL oeffnen, loslegen.

Live-Updates laufen primaer per WebSocket-Push (eigenes Push-Modul, optionaler Port) mit
automatischem Delta-Polling als Fallback — der Fallback funktioniert portfrei auch ueber
Symcon-Connect.

Reine Visualisierung: der Builder zeigt und schaltet Symcon-Objekte, enthaelt aber keine eigene
Steuerlogik. Fuer Heizung/Beschattung/Licht/Audio bindet er die Variablen und Skript-/RPC-APIs
der jeweiligen Fachmodule (z. B. HomeSuite) ein.

---

## Inhalt

- [Architektur](#architektur)
- [Voraussetzungen](#voraussetzungen)
- [Instanz-Konfiguration (Properties)](#instanz-konfiguration-properties)
- [Konfigurationsformular](#konfigurationsformular)
- [Oeffentliche Skript-/RPC-Funktionen](#oeffentliche-skript-rpc-funktionen)
- [Datenablage und Multi-View-Architektur](#datenablage-und-multi-view-architektur)
- [Push-Modul (WebSocket-Server)](#push-modul-websocket-server)
- [Bedienung des Builders](#bedienung-des-builders)
- [Widget-Katalog](#widget-katalog)
- [Skins und Themes](#skins-und-themes)
- [SmartFit — der Autoscaler](#smartfit--der-autoscaler)
- [Kiosk und Fernzugriff](#kiosk-und-fernzugriff)
- [Live-Werte (WebSocket + Polling)](#live-werte-websocket--polling)
- [IPSView-Import](#ipsview-import)
- [Sicherheit und Token](#sicherheit-und-token)
- [API-Endpunkte (Referenz)](#api-endpunkte-referenz)
- [FAQ und Fehlerbehebung](#faq-und-fehlerbehebung)
- [Changelog](#changelog)
- [Lizenz](#lizenz)

---

## Architektur

Das Repository liefert zwei Module unter einer gemeinsamen Library
(`{5E7A9C10-2B4D-4F86-A1C3-9D0E7F2B1A55}`):

| Modul | Prefix | Typ | GUID | Zweck |
|---|---|---|---|---|
| LiveView Builder | `LVB` | 3 (Geraet) | `{6F8B0D21-3C5E-4A97-B2D4-0E1F8A3C2B66}` | Builder + Laufzeit ueber Symcon-WebHook |
| LiveViewBuilder Push | `LVBP` | 2 (I/O) | `{7B3E9F21-4C8A-4D6E-B1F5-9A0C2D3E4F60}` | Eigenstaendiger WebSocket-Server fuer Live-Push |

Aliase des Builders: „LiveView Builder", „Dashboard Builder".

Kernidee: Der Builder haengt sich als **WebHook** in Symcon ein und liefert ueber
`ProcessHookData()` sowohl die Builder-Oberflaeche als auch eine JSON-API. Es werden **keine
Status-Variablen und keine Timer** im Builder-Modul registriert — der Zustand (Layouts, Skins,
Bausteine, Einstellungen) liegt als **Datei** im Datenordner der Instanz, nicht in einer Variable.

Wesentliche Dateien im Modulordner `LiveViewBuilder/`:

- `module.php` — IPSModule-Klasse, Hook-Registrierung, Formular, Import.
- `handler.php` — der gesamte HTTP-Handler (Builder-Seite ausliefern + JSON-API).
- `functions.php` — `LVB_*`-Helfer (IPSView-Import-Walk, ICS/Kalender-Parser, Formel-Engine,
  Homematic-XML-RPC/ReGa fuer das Meldungs-Widget).
- `store.inc.php` — geteilte Ablage-Logik (`LVB_Assemble()`, `LVB_SaveStore()`).
- `builder.html` — die generierte Builder-App (aus `src/` per `build.php`, **nie direkt editieren**).
- `src/` — Quellen (js/, widgets/, styles.css, shell.html), aus denen `builder.html` gebaut wird.
- `assets/` — lokal gehostete ECharts + Schriften (Inter, Lora, Fraunces, JetBrains Mono).

> Hinweis fuer Entwickler: `builder.html` ist ein Build-Artefakt. Aenderungen an Widgets/Layout
> immer in `src/` machen und neu bauen (`build.php`); Widget-Aenderungen brauchen keinen
> Library-Reload, nur einen Neubau.

---

## Voraussetzungen

| Komponente | Anforderung |
|---|---|
| IP-Symcon | ab 7.1 |
| WebHook Control | Kernbestandteil von Symcon — nichts zu installieren |
| Archive Handler | optional, nur fuer Chart-/Sparkline-/Statistik-Widgets (historische Verlaeufe) |
| iCal Calendar Reader | optional, nur fuers Kalender-Widget |
| Server Socket (I/O) | optional, nur fuer das Push-Modul (WebSocket) |
| Browser | aktueller Chromium/WebKit/Firefox (Tablet/Kiosk-tauglich) |

Ohne WebSocket-Push sind keine zusaetzlichen IO-/Splitter-Instanzen, keine offenen Ports und keine
Firewall-Regeln noetig — alles laeuft ueber den vorhandenen Symcon-WebHook-Port (Standard 3777).

---

## Instanz-Konfiguration (Properties)

Alle Properties sind optional — die Zero-Config-Instanz funktioniert ohne jede Eingabe.

| Property | Typ | Standard | Bedeutung |
|---|---|---|---|
| `BasePath` | String | `''` | Datenordner. Leer = automatischer, je View neutraler Ordner `<KernelDir>/livebuilder/<Site>/`. Gesetzt = vorhandener Ordner wird weiterverwendet. |
| `Site` | String | `''` | View-Name = URL-Pfad-Bestandteil und Ordnername. Leer = Instanzname. Sonderzeichen/Slashes werden zu `-` normalisiert (nie `%2F` in der URL). |
| `BaseUrl` | String | `''` | Basis-URL (z. B. `http://10.0.0.5:3777`) fuer klickbare Links im Formular. |
| `WsPort` | String | `''` | Optionaler WebSocket-Push-Port (fuer die Client-Seite). |
| `WsUrl` | String | `''` | Vollstaendige WebSocket-Adresse; schlaegt `WsPort`. Noetig hinter Reverse Proxy / HTTPS (z. B. `wss://host/wss`), weil eine ueber HTTPS geladene Seite kein `ws://` oeffnen darf. |
| `IPSViewPath` | String | `''` | Optionaler Fallback-Pfad fuer den IPSView-Import. |
| `Views` | String (JSON) | `'[]'` | Modul-verwaltete Seitenliste `[{Name, Home}]`. Wird mit dem Store abgeglichen (Anlegen/Loeschen). |

Attribute (intern, nicht im Formular):

| Attribut | Bedeutung |
|---|---|
| `Token` | Automatisch erzeugter Schreib-Token (`bin2hex(random_bytes(16))`), in die Seite injiziert. |
| `ImportStatus` | Letzter IPSView-Import-Status fuer die Formularanzeige. |

Registrierte Nachrichten (kein Timer, keine Status-Variablen):

- `IPS_KERNELMESSAGE` → Hooks erst bei `KR_READY` registrieren (verhindert Startup-Schleife/Absturz).
- `10204`/`10205` (KL_WARNING/KL_ERROR) → Meldungs-Mitschnitt fuers Live-/Meldungs-Widget
  (Ringpuffer im Instanz-Buffer `lvbmsgs`, max. 150 Eintraege).

---

## Konfigurationsformular

**Elemente**

- Seitenliste („Seiten dieser View") als editierbare `List` (`Views`): Spalten Name (= Pfad),
  Widgets-Anzahl, Startseite (Checkbox). Anlegen und Loeschen hier; Umbenennen im Builder
  (verschiebt den Inhalt). Popup-Seiten werden ausgeblendet und nie ueber die Liste geloescht.
- ExpansionPanel „Einstellungen": `BaseUrl`, `BasePath`, `WsPort`, `WsUrl`, `IPSViewPath`, `Site`
  und die Anzeige des aktiven Datenordners.

**Actions**

- Button „Builder oeffnen" (`LVB_OpenBuilder`).
- Direkt-Links je Ansicht: Buttons „Run" und „Bearbeiten" zeigen die jeweilige URL.
- IPSView-Import: `Select` (alle `.ipsView`-Medienobjekte, alphabetisch), Button „Importieren"
  (`LVB_StartImport`), Status-Label, Button „Adressen anzeigen" (`LVB_ShowUrls`).

Der Formularkopf zeigt den aktuellen Modul-Build (aus `library.json`).

---

## Oeffentliche Skript-/RPC-Funktionen

Ueber den Prefix `LVB` als `LVB_<Methode>(int $InstanceID, ...)` aufrufbar:

| Funktion | Parameter | Wirkung |
|---|---|---|
| `LVB_OpenBuilder($id)` | — | Gibt die Builder-URL aus. |
| `LVB_ShowUrls($id)` | — | Gibt Builder- und Run-URL aus. |
| `LVB_StartImport($id, $MediaID)` | Media-ID | Stoesst den IPSView-Import **asynchron** an (blockiert Konsole/Formular nicht). |
| `LVB_RunImport($id, $MediaID)` | Media-ID | Fuehrt den Import aus (laeuft in eigenem Thread; Fortschritt in `ImportStatus`). |

Push-Modul (Prefix `LVBP`):

| Funktion | Wirkung |
|---|---|
| `LVBP_Sync($id)` | Liest die im Layout gebundenen Variablen/Medien neu aus `layouts.json` und aktualisiert die `RegisterMessage`-Abos. Wird vom Builder nach jedem Layout-Speichern automatisch nachgezogen. |
| `LVBP_BroadcastText($id, $Text)` | Sendet Rohtext an alle verbundenen Clients (nur aus Kernel-/Event-Kontext sinnvoll). |

---

## Datenablage und Multi-View-Architektur

- Jede **View = eine Instanz** (eigenes Site-Label, eigener Ordner). Die **Seiten** einer View sind
  ihre Bestandteile und liegen unter `livebuilder/<Site>/seiten/<slug>.json`.
- Der Laufzeit-Store wird wie folgt zusammengesetzt (`LVB_Assemble`): `index.json` + `seiten/`.
  `layouts.json` ist nur noch **Spiegel/Rueckfallebene** und darf nicht die Wahrheit sein.
- `LVB_SaveStore()` schreibt beide Ablagen konsistent (Spiegel **und** Einzeldateien), damit
  Laufzeit und Push-Modul denselben Stand sehen.
- Datenordner-Aufloesung: `BasePath` gesetzt → dieser Ordner; sonst `<KernelDir>/livebuilder/<Site>/`.
  Eine einmalige Migration uebernimmt fruehere Auto-Ablagen (`liveview/<InstanzID>/`).
- **Guard**: Eine leere `Views`-Property loescht **nichts** (verhindert Massen-Loeschung nach
  Modul-Update). Popup-Seiten (per `popupTo`/`longPopup` referenziert oder als Popup markiert)
  werden nie ueber die Formularliste geloescht.

Alle Layouts, Skins, Bausteine und Einstellungen liegen als Datei im Datenordner — transparent,
per Symcon-Backup gesichert und vom Push-Modul lesbar.

---

## Push-Modul (WebSocket-Server)

`LiveViewBuilder Push` (`LVBP`) ist ein eigenstaendiger WebSocket-Server als **Kind eines
Server-Sockets (I/O)**. Er uebernimmt WS-Handshake und -Framing selbst und broadcastet
Variablen-/Medien-Aenderungen aus dem **eigenen** Event-Kontext (`MessageSink`) an alle
verbundenen Browser. Damit umgeht er die Puffer-Isolation des Community-WebSocketServers.

Properties:

| Property | Standard | Bedeutung |
|---|---|---|
| `BasePath` | `''` | Datenordner, identisch zum Builder — Push scannt **alle** Views darunter (`livebuilder/`). |
| `Port` | `8082` | WebSocket-Port; wird am darunterliegenden Server-Socket erzwungen (Port + Open=true). |

Verhalten:

- Der Builder haelt `BasePath` des Push-Moduls automatisch auf seinen eigenen Datenordner
  (`syncPushBasePath`) und ruft nach jedem Speichern `LVBP_Sync()` auf.
- `LVBP_Sync` abonniert genau die im Layout gebundenen Variablen (`varId…`, `items`, `rows`,
  `links`, `src`/`snk`/`fc`/`stages`/`elements` u. a.) und Kamera-Medien (`camera`/`campro`).
- Zusaetzlich werden HomeSuite-Licht-Steuervariablen (HSLT: Power/Brightness/ColorTemp) **immer**
  abonniert, damit die entity-gebundenen Licht-Widgets auch Handschalter-/Automatik-Aenderungen
  sofort per WebSocket sehen.
- Ein Timer „Sync" liest `layouts.json` initial nach 4 s und danach alle 5 min neu ein.
- Payload wie `?api=val`: `{ts, values:{ "<id>": {v,f,id} }}` bzw. `{ts, media:[<id>]}`.

Der `WsPort`/`WsUrl` am Builder teilt dem Client mit, wohin er sich verbinden soll; hinter einem
Reverse Proxy / HTTPS `WsUrl` (z. B. `wss://host/wss`) verwenden.

---

## Bedienung des Builders

- **Palette**: Widget auf die Canvas ziehen oder anklicken, danach frei positionieren und an der
  Ecke skalieren.
- **Variablen binden**: integrierter Objektbaum mit Live-Suche nach Name, Pfad und ID; Klick
  erzeugt eine Wert-Kachel bzw. bindet an das gewaehlte Widget. Der Widget-Typ ist im
  Eigenschaften-Panel jederzeit umstellbar.
- **Ansichten (Views)**: mehrere Seiten pro Dashboard, umschaltbar; eine als Startseite
  (Kiosk-Default) markierbar. Beim Umbenennen ziehen alle Verweise (Seite oeffnen, Popup,
  Startseite) automatisch mit.
- **Interaktion je Widget**: kurzer Tipp und langer Druck getrennt belegbar — Seite oeffnen, Popup
  oeffnen, Skript ausfuehren, schalten. Getrennte Hover-Sprache: navigierende Aktion hebt an,
  schaltende Aktion zeigt einen Innen-Ring.
- **Pixelgenaues Arbeiten**: absolute Positionierung, Raster-Snap, Ausricht-Hilfen mit
  einstellbarem Standardabstand, Multi-Select, Ausrichten/Verteilen, Gruppen, Container,
  Komponenten (wiederverwendbare Bausteine mit ID-Remapping), Undo/Redo.
- **Wert-/Icon-Feinpositionierung** je Widget (Versatz per Transform, Alt-Ziehen).
- **Rechenformeln** im Variablenfeld (`=Ausdruck` mit `+ - * / ( )`): live im Client, Aggregate
  serverseitig.

---

## Widget-Katalog

Ueber 100 Widget-Typen (Stand: 105 Widget-Quellen, teils zu „Familien" zusammengefasst).
Grundsatz: aus wiederverwendbaren Widgets komponieren, keine ganze Seite als ein Monolith-Widget.

- **Grundelemente**: Wert, Wertkarte (Modi value/target/range/bar/toggle/select), Text, Lauftext,
  Icon, Linie, Form, Bild, Leer.
- **Steuerung**: Kachel, Button, Schalter (Multi-State), Slider, RangeSlider, Stepper, Thermostat,
  Rollo/Cover, Licht, Dial, CircleRange, Auswahl (Segmented/Schieber), Checkbox, Alarm, Vacuum,
  Media, Skin-Wechsler, Eingabe (Textfeld), RGB-Button/-Box/-Slider, Farbkreis, CIE-Picker.
- **Anzeige**: Chip, Gauge und Gauge+ (Farbzonen), Balken (auch liegend), Temp-Saeule (Soll-Marker),
  KPI, Delta (Trend), Statistik (Min/Mittel/Max), Zaehlerwert (Verbrauch je Periode), Berechnung,
  Raum, Zustand (Assoziationen), Status-Liste/-Grid/-Bild, Zustands-Timeline, Geraete-Liste,
  Metrik-Liste, Info-Liste, Tabelle, MultiRing, Doppel-Donut.
- **Diagramme**: Chart (Apache-ECharts-Wrapper — Flaeche/Linie/Balken/Stufen/Punkte, Spline,
  zweite Y-Achse, Zoom/Scroll, Stapeln, Vorperioden-Vergleich als Balken oder duenner Strich),
  Sparkline, Sankey, Windrose, Fluss-Schema, Energiefluss-Linie, Meteogramm (meteoblue-Stil).
- **Wetter/Zeit/Sonne**: Wetter, Wetter+, Sonne, Sonnenbogen (Live-Sonnen-/Mondstand aus Location
  Control + Astronomie mit lokalem Fallback), Sonnenkompass (2,5D Haus + Sonne + Einstrahlung),
  Uhr, Timer, Kalender (iCal), Wochenplan (WeeklySchedule), Wochenplan-Editor, Regenmenge,
  Regenradar, Regenintensitaet.
- **Fachbereich-Familien** (binden Variablen/APIs der Fachmodule ein): Beschattung
  (shading/cover/shadeprofile/shadesun/shadelog/shadingpanel), Heizung (heatplan/weekedit/
  ruletable/statelog), Licht (light/lightx-Familie, Szenen), Media/Audio (audiox-/
  mediasources-Familie, nowplaying/multiroom), Maehen (mowplan/autox-Familie), Pool
  (poolcfg/ruletable), Batterien (battlist/batscan). Diese Widgets sind **reine Frontends**;
  die Logik liegt in den jeweiligen Fachmodulen.
- **Navigation/Layout**: Raum-Selektor (roomsel/roomnav), Regionen-Tabs, Chrome-Bar/-Sidebar,
  Container, Komponente, Seiten-Panel.
- **Medien/Web**: Kamera, Kamera+ (PTZ/Bewegung), Kamera-Array (mehrere Quellen mit Pill-Umschalter),
  HTML (isoliertes iframe), WebView (URL).
- **System/Live**: Meldungen (Symcon-Log, Severity-Filter, konfigurierbares Intervall), Homematic-
  Servicemeldungen (lesen/bestaetigen via XML-RPC/ReGa), Live-Monitor (WebSocket-/Poll-Updates),
  Objekt-Info, Ereignis-Steuerung, ZoneSync.

Die **Doku-Seite** `/hook/doku` zeigt jedes Widget live und ist Bestandteil des Moduls (bewusst
ohne Ansichtsnamen). Sie darf **nie** speichern (DOKU-Guard).

---

## Skins und Themes

Alle Farben/Schriften kommen aus austauschbaren Skins, jeder mit Dark- und Light-Variante:
eingebaute Skins in verschiedenen Akzentfarben, eigene per Duplizieren und Live-Editor
(Farb-Tokens + Schriften). Ein Skin-Wechsler-Widget laesst auch den Betrachter im Kiosk zwischen
Skins/Themes wechseln (per localStorage gemerkt). Widget-Farben als Skin-Stichwort setzbar (accent,
ok, warn, crit, info, text, faint). Kontrast-Schutz: nie dunkle Schrift auf Akzent/dunklem Grund;
gefuellte Aktiv-Flaechen nutzen `--accent-2` mit weisser Schrift. Alle Grafiken (Charts, Gauges,
Kameras, Verlaufsbalken) faerben beim Skin-Wechsel automatisch mit. Schriften werden lokal
gehostet (`?api=font`).

---

## SmartFit — der Autoscaler

Pro Ansicht waehlbar: Letterbox (skaliert mit Rand), Auto (fuellt den Viewport exakt, Inhalt
unverzerrt — Text/Icons uniform, Charts/Kameras re-layouten; bei echtem Portrait/Handy Reflow),
Track-Fill und Reflow erzwungen. Per Widget uebersteuerbar (Skalierpolitik fix/skaliert/stretch,
Anker, Prioritaet, Gruppe). Widgets rechnen ihre Elemente aus der Containergroesse neu (em/cqmin)
statt uniformem Transform-Scale. Mobil skaliert eine Gruppe als eine Huellbox.

---

## Kiosk und Fernzugriff

- Kiosk-URL: `/hook/run/<Site>?view=<Ansicht>` — Vollbild, kein Symcon-Chrome, ideal fuers
  Wandpanel/Tablet (z. B. Fully Kiosk Browser). Ohne `&view=` erscheint die Startseite.
- Fernzugriff: dieselbe URL hinter der Symcon-Connect-Adresse. Der Polling-Fallback laeuft ueber
  den WebHook-Port und funktioniert damit auch ueber Connect; der WebSocket-Push ist nur bei
  erreichbarem Port aktiv.

---

## Live-Werte (WebSocket + Polling)

- **WebSocket-Push (Primaerkanal)**: das Push-Modul verschickt Aenderungen der gebundenen
  Variablen/Medien sofort an alle Clients. Aktiv, sobald `WsPort`/`WsUrl` gesetzt und erreichbar ist.
- **Delta-Polling (Fallback)**: laeuft automatisch, wenn kein Push ankommt (kein Port, nicht
  erreichbar, ueber Connect). Es werden nur geaenderte Werte abgefragt
  (`?api=val&ids=...&since=...`); bei inaktivem Tab pausiert die Abfrage.
- Der Sicherheits-Poll kann abgeschaltet werden (reiner WebSocket-Betrieb); beim Seitenwechsel
  wird dann einmalig gepollt. Ein globales Standard-Intervall fuer periodisch nachladende Widgets
  (z. B. Meldungen) ist einstellbar und je Widget uebersteuerbar.

Performance-Hinweise: kein `readfile()` im Hook (Ausgabe in einem Stueck, sonst tote Threads);
grosse Bilder (`?api=media`) serverseitig verkleinern (WebHook kappt bei 1 MB); Archiv-Punktabfragen
sind teuer, Aggregate/Vergangenheit werden gecacht.

---

## IPSView-Import

Im Formular eine `.ipsView`-Quelle waehlen und importieren (asynchron, blockiert die Konsole
nicht; Fortschritt im Status-Label). Der Importer (`LVB_ImportWalk`/`LVB_ImportControl`) deckt die
IPSView-Control-Typen ab (Buttons, Slider, Status-Bilder, Gauges mit Zonen, Wochenplaene, Shapes,
HTMLBox), uebernimmt Variablen-Bindung (ueber ItemID), Einheiten, Min/Max und Farben und legt je
IPSView-Seite eine neue Ansicht an (mit automatischer Namens-Entdopplung).

---

## Sicherheit und Token

- Schreib-Token wird automatisch erzeugt und in die Seite injiziert; alle schreibenden Endpunkte
  (`setvar`, `layout`-POST, `runscript`, `setevent`, `publish`, `bset`, `week`, `heat`, `light`,
  `shading`, `audio`, `mower`, `hmack`) pruefen ihn.
- Der WebHook liegt hinter der normalen Symcon-Benutzeranmeldung.
- Headless-Tests **nie** am Live-Builder ausfuehren (`state.widgets`/`render` auf `/hook/builder`
  loesen Autosave aus und ueberschreiben das Live-Layout).

---

## API-Endpunkte (Referenz)

Relativ zum Hook (`/hook/builder/<Site>` Editor, `/hook/run/<Site>` Laufzeit, `/hook/doku` Doku).
`key=TOKEN` bei allen schreibenden Aufrufen.

| Endpunkt | Zweck |
|---|---|
| `?ui=builder` bzw. `/hook/run/<Site>` | Builder-Seite bzw. Kiosk-Laufzeit |
| `?api=tree&parent=` / `&search=` | Objektbaum (lazy) und Suche nach Name/Pfad/ID |
| `?api=val&ids=&since=` | Live-Werte (Delta) |
| `?api=setvar&id=&value=&key=` | Variable schreiben |
| `?api=layout` (GET/POST), `&list=1`, `&file=` | Layouts laden/speichern/auflisten |
| `?api=history&id=&h=` | Verlaufsdaten (Archive Handler) |
| `?api=aggregated` / `?api=agg` / `?api=cmp` | Aggregierte Werte / Aggregat / Vorperioden-Vergleich |
| `?api=tabledata` | Datentabelle fuers Tabellen-Widget |
| `?api=assoc&id=` | Variablen-Assoziationen (Profil) |
| `?api=html&id=` | Variablen-HTML fuers HTML-Widget |
| `?api=media&id=` | Media-Bild (Kamera/Bild), serverseitig verkleinert |
| `?api=weekplan&id=` / `?api=week` (POST) | WeeklySchedule lesen / Wochenplan schreiben |
| `?api=heat` | Heizungs-Wochenprofile lesen/schreiben |
| `?api=light` | HomeSuite-Licht lesen/schalten |
| `?api=shading` | Beschattung lesen/steuern |
| `?api=audio` | Audio/Media (Zonen, Gruppen, getall) |
| `?api=mower` | Maeher-Status/Steuerung |
| `?api=cal&ids=&days=` | iCal-Events |
| `?api=astro&id=&moon=` / `?api=daylight` | Sonnen-/Mondstand / Tageslichtdaten |
| `?api=messages&n=&sev=` | Symcon-Log (gefiltert) fuers Meldungen-Widget |
| `?api=hmmsg` / `?api=hmack` | Homematic-Servicemeldungen lesen / bestaetigen |
| `?api=event&id=` / `?api=setevent&id=&active=&key=` | Ereignis lesen / schalten |
| `?api=objinfo&id=` | Objekt-Metadaten |
| `?api=runscript&id=&key=` | Skript ausfuehren |
| `?api=bset` | Batch-Set (mehrere Variablen setzen) |
| `?api=batscan` | Batterie-Scan (BatteryManager) |
| `?api=mod&op=` | Modul-/Hub-Operationen (z. B. Topologie) |
| `?api=publish&key=` | Reload-Broadcast an alle Clients (WebSocket) |
| `?api=import` / `?api=ipsviews` | IPSView importieren / IPSView-Quellen auflisten |
| `?api=asset&name=echarts` | lokal gehostetes ECharts |
| `?api=font` | lokal gehostete Schriften |

---

## FAQ und Fehlerbehebung

**Der Builder laedt nicht / 404.** Kernel nach der Installation neu gestartet? Instanz einmal
Uebernehmen (registriert die Hooks). Pfad ist `/hook/builder/<Site>` bzw. `/hook/run/<Site>`.

**Charts bleiben leer.** Chart-/Sparkline-/Statistik-Widgets brauchen den Archive Handler und eine
geloggte Variable.

**Kamera/Bild zeigt nichts.** Es muss ein Media-Objekt vom Typ Bild sein; Media-ID im Widget
eintragen.

**Werte aktualisieren nur beim Seitenwechsel.** Reiner WebSocket-Betrieb ohne erreichbaren Port —
`WsPort`/`WsUrl` pruefen (hinter HTTPS/Proxy `WsUrl`) oder den Sicherheits-Poll wieder aktivieren.

**Push kommt nicht an.** Push-Modul: `BasePath` identisch zum Builder-Datenordner, darunter ein
offener Server-Socket auf dem Port; „Registrierungen aktualisieren" (`LVBP_Sync`) druecken. Eine
Warnung „inkompatible uebergeordnete Instanz" am Server-Socket ist kosmetisch.

**Aussehen aendern.** Reiter Skins (Farben/Schriften, Dark/Light) und Einstellungen (Raster,
Standardabstand, Standard-Canvas/-Skin, Aktualisierungs-Intervall, Auto-Speichern).

---

## Changelog

**1.2** (aktueller Modul-Build 4; Library-Version 0.19.x im Verbund mit HomeSuite)
- Multi-View-Architektur: View = Instanz, Seiten als Bestandteile unter `seiten/<slug>.json`;
  Store aus `index.json` + `seiten/`, `layouts.json` nur noch Spiegel.
- Datei-Ablage statt Instanz-Attribut (transparent, backup-bar, vom Push-Modul lesbar).
- Eigenstaendiges Push-Modul (`LVBP`) als WebSocket-Server; automatischer BasePath-Sync und
  `LVBP_Sync` nach jedem Speichern; HomeSuite-Licht-Vars immer abonniert.
- Zahlreiche neue Widgets/Familien: Fachbereiche Beschattung, Heizung, Licht, Audio/Media, Maeher,
  Pool, Batterien; Regenradar/-intensitaet, Meteogramm, Sonnenkompass, Kamera-Array, Container/
  Komponenten, Raum-Selektor/Regionen-Tabs, Homematic-Meldungen.
- Neue API-Endpunkte: `heat`, `light`, `shading`, `audio`, `mower`, `week`, `aggregated`/`agg`/`cmp`,
  `tabledata`, `assoc`, `bset`, `batscan`, `mod`, `hmmsg`/`hmack`, `daylight`, `ipsviews`, `font`.
- Doku-Seite `/hook/doku` (live, DOKU-Guard gegen Speichern).
- Vereinheitlichte Widget-Editoren, Kontrast-Schutz, responsive Skalierung aus Containergroesse.

**1.1**
- WebSocket-Push als Primaerkanal, Delta-Polling als portfreier Fallback; reiner WebSocket-Betrieb
  optional. Hook-Schema `/hook/builder/<Site>` und `/hook/run/<Site>`. Generalisiertes Fluss-Widget
  (Pipeline/Energie/Hub). Neue Widgets Wertkarte, Sonnenbogen, Meldungen, Live-Monitor.
  Konfigurierbares Aktualisierungs-Intervall.

**1.0**
- Erstveroeffentlichung als eigenstaendiges Modul: selbst-registrierender WebHook, Auto-Token,
  Widget-Sammlung, Skins (Dark/Light), SmartFit-Autoscaler, ECharts-Wrapper, Bausteine,
  Auto-Speichern und benannte Snapshots, IPSView-Import, Live-Werte per Delta-Polling.

---

## Lizenz

MIT-Lizenz (c) 2026 Peter Hoellwarth — siehe `LICENSE`. Gebuendelte Fremdkomponenten behalten ihre
eigenen Lizenzen (siehe `THIRD-PARTY-NOTICES.md`): Apache ECharts unter Apache-2.0 sowie die
Schriften Inter, Lora, Fraunces und JetBrains Mono unter der SIL Open Font License 1.1.

LiveView Builder ist ein Community-Modul fuer IP-Symcon. Reine Visualisierung, keine Steuerlogik.
