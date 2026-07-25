# LiveView Builder

Ein vollwertiger **Dashboard-Builder für IP-Symcon** – im Browser, per Drag & Drop, pixelgenau.
Baue eigene Visualisierungen aus 49 Widget-Typen, binde beliebige Symcon-Variablen live an,
skaliere automatisch auf jeden Bildschirm und starte alles als Vollbild-Kiosk – **ohne Ports,
ohne Skripte, ohne Konfiguration**. Instanz anlegen, URL öffnen, loslegen.

---

## Inhalt

- [Highlights](#highlights)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Einrichtung](#einrichtung-zero-config)
- [Bedienung](#bedienung)
- [Widget-Katalog](#widget-katalog)
- [Skins & Themes](#skins--themes)
- [SmartFit – der Autoscaler](#smartfit--der-autoscaler)
- [Speichern, Snapshots & Bausteine](#speichern-snapshots--bausteine)
- [Kiosk & Fernzugriff](#kiosk--fernzugriff)
- [Live-Werte (Delta-Polling)](#live-werte-delta-polling)
- [IPSView-Import](#ipsview-import)
- [Datenspeicherung & Sicherheit](#datenspeicherung--sicherheit)
- [API-Endpunkte](#api-endpunkte-referenz)
- [FAQ / Fehlerbehebung](#faq--fehlerbehebung)
- [Changelog](#changelog)

---

## Highlights

- 🧩 **49 Widget-Typen** – von Wert/Schalter über Gauges, Charts (Apache ECharts), Power-Flow,
  Kameras, Wetter- und Sonnen-Cards bis HTML-Embeds und Wochenplänen.
- 🎯 **Pixelgenaues Drag & Drop** – absolute Positionierung, Raster-Snap, Ausricht-Hilfen mit
  einstellbarem Standardabstand, Multi-Select, Ausrichten/Verteilen, Undo/Redo.
- 🔗 **Beliebige Variablen live binden** – integrierter Objektbaum mit Live-Suche nach
  Name · Pfad · ID; Werte aktualisieren sich automatisch, Schalten schreibt zurück.
- 📐 **SmartFit-Autoscaler** – füllt jedes Seitenverhältnis (16:9, Ultrawide, Portrait, Handy)
  ohne Verzerrung, mit optionalem Reflow. Kein Letterbox, kaum Scrollen.
- 🎨 **Skins mit Dark & Light** – 11 eingebaute Skins, eigene per Klick, Live-Farb-/Schrift-Editor,
  Skin-Wechsler-Widget für den Betrachter.
- 💾 **Auto-Speichern + „Speichern unter"** – benannte Snapshots/Varianten, alles in der Instanz.
- 🖥️ **Vollbild-Kiosk** – eine URL fürs Wandpanel/Tablet, ohne Symcon-Chrome.
- 🔌 **Zero-Config** – der WebHook registriert sich selbst, ein Token wird automatisch erzeugt.
  Live-Updates laufen portfrei über Port 3777 und funktionieren auch über Symcon-Connect.
- ⬇️ **IPSView-Import** – bestehende `.ipsView`-Seiten (100 % Typ-Abdeckung) übernehmen.

---

## Voraussetzungen

| | |
|---|---|
| **IP-Symcon** | ab 7.1 |
| **WebHook Control** | ist Kernbestandteil von Symcon – nichts zu installieren |
| **Archive Handler** | optional, nur für **Chart-/Sparkline**-Widgets (historische Verläufe) |
| **iCal Calendar Reader** | optional, nur fürs **Kalender**-Widget |
| **Browser** | aktueller Chromium/WebKit/Firefox (Tablet/Kiosk-tauglich) |

Es sind **keine** zusätzlichen IO-/Splitter-Instanzen, **keine** offenen Ports und **keine**
Firewall-Regeln nötig.

---

## Installation

**Über den Module Store** (empfohlen): in Symcon unter *Module → Store* nach „LiveView Builder"
suchen und installieren.

**Über Git** (manuell): in der Symcon-Verwaltungskonsole *Module → Hinzufügen* und die
Repository-URL eintragen.

Danach **Symcon-Kernel neu starten** (bzw. *Module → Aktualisieren*), damit die Library geladen wird.

---

## Einrichtung (Zero-Config)

1. *Instanz hinzufügen* → **„LiveView Builder"**.
2. Der Konfigurationsdialog zeigt sofort die **fertigen URLs**:
   - **Builder-Editor:** `http://<Symcon-IP>:3777/hook/lvb<InstanzID>?ui=builder`
   - **Kiosk/Vollbild:** `…?ui=builder&run=1&view=NAME`
   Der Button **„Adressen anzeigen"** listet die Links (inkl. Connect) auf.
3. URL im Browser öffnen – der Builder lädt, der Objektbaum zeigt deine Variablen.

Beim ersten *Übernehmen* passiert automatisch:
- der WebHook `/hook/lvb<InstanzID>` wird registriert und auf diese Instanz gelenkt,
- ein zufälliger **Schreib-Token** wird erzeugt und in die Seite injiziert.

> **Mehrere Dashboards?** Einfach mehrere Instanzen anlegen – jede hat ihre eigene URL und
> ihre eigenen Ansichten.

---

## Bedienung

**Palette** (rechte Seitenleiste, Reiter *Palette*): Widget auf die Canvas **ziehen** oder
anklicken. Danach frei positionieren, an der Ecke skalieren.

**Variablen binden** (Reiter *Variablen*): im Baum navigieren oder oben **suchen**
(Name · Pfad · ID, live beim Tippen). Klick auf eine Variable erzeugt eine Wert-Kachel bzw.
bindet sie ans ausgewählte Widget. Der Widget-Typ ist jederzeit im Eigenschaften-Panel umstellbar.

**Ansichten (Views):** mehrere Seiten pro Dashboard, umschaltbar über das Ansichts-Dropdown;
eine Ansicht als **Startseite** (Kiosk-Default) markierbar.

**Toolbar** (alles mit Hover-Tooltip):
Raster · Vorschau · Struktur einblenden · Baustein speichern · Dunkel/Hell · Undo/Redo ·
Ansicht neu/umbenennen/löschen/Start · Canvas-Größe · Anpassung (Fit-Modus) · Live · IPSView-Import ·
Layout-Auswahl · Speichern · Speichern unter.

**Reiter** der Seitenleiste: *Variablen · Palette · Farben · Icons · Skins · Einstellungen ·
Eigenschaften*. Die Seitenleiste ist am linken Rand **breiter ziehbar**.

---

## Widget-Katalog

**Grundelemente:** Wert · Text · Icon · Linie · Form (Rechteck/Kreis/Linie)

**Steuerung:** Kachel · Button · Schalter · Slider · Thermostat · Rollo · Licht ·
**Dial** (Kreis-Regler) · **Auswahl** (Segmented) · Alarm · Vacuum · Media · **Skin-Wechsler**

**Anzeige:** Chip · **Gauge** / **Gauge+** (Farbzonen) · Balken · **Raum** ·
**Status-Liste** · **Geräte-Liste** · **Laufzeile** (Alarm-Ticker) · **Temp-Säule** (mit Soll-Marker) ·
**Status-Grid** · **Metrik-Liste** · **Info-Liste** · **KPI** · **Delta** (▲/▼-Trend) · **Status-Bild**

**Diagramme:** **Chart** – vollwertiger **Apache-ECharts-Wrapper** (Fläche/Linie/Balken/Stufen/Punkte,
Spline, Punkte, Balken-Rundung, Flächen-Verlauf, Legende, Y-Raster, Datenlabels, Y-Min/Max,
**mehrere Serien**, eigene Farbe/Name pro Serie, **zweite Y-Achse**, **Zoom/Scroll**, **Stapeln**) ·
Sparkline · Sankey · Power-Flow (mit Fluss-Editor)

**Wetter & Zeit:** Wetter · **Wetter+** (variablen-gebundene Forecast-Tage mit
**Temperatur→Farbe-Verlaufsbalken**, mehrere Stufen einstellbar) · Sonne ·
**Sonnenbogen** (Live-Sonnenstand) · Uhr · Timer · Kalender (iCal) · Wochenplan (WeeklySchedule)

**Medien:** Kamera · Kamera+ (PTZ/Bewegung) · **HTML** (rendert Variablen-HTML in isoliertem iframe,
skalierbar, transparent) · **Bild** · **WebView** (URL)

Dazu **eigene Bausteine**: eine Auswahl gruppieren, als wiederverwendbaren Block speichern und
per Klick/Drag beliebig oft einfügen.

---

## Skins & Themes

Alle Farben/Schriften kommen aus austauschbaren **Skins** – jeder mit **Dark- und Light-Variante**:

- **11 eingebaute Skins:** Standard (Teal), Indigo, Bernstein, Smaragd, Ozean, Violett, Koralle,
  Rose, Limette, Gold, Stahl (unterscheiden sich v. a. in der Akzentfarbe).
- **Eigene Skins:** im Reiter *Skins* „Duplizieren", dann 16 Farb-Tokens + 2 Schriften live editieren.
- **Toolbar-Toggle** ◐ für Dunkel/Hell; **Skin-Wechsler-Widget** lässt auch den Betrachter im
  Kiosk zwischen Skins/Themes wechseln (Wahl bleibt per `localStorage` erhalten).

Alle Grafiken (Charts, Gauges, Kameras, Verlaufsbalken …) sind token-basiert und färben beim
Skin-Wechsel automatisch mit.

---

## SmartFit – der Autoscaler

Pro Ansicht wählbar (Toolbar *Anpassung*):

- **Letterbox** – klassisch, gleichmäßig skaliert mit Rand.
- **Auto** *(Standard neuer Ansichten)* – füllt den Viewport exakt (Track-Fill), Inhalt bleibt
  unverzerrt (Text/Icons uniform, Charts/Kameras re-layouten). Bei echtem Portrait/Handy
  automatisch **Reflow** (höhen-optimierter Umbruch → so wenig Scrollen wie möglich).
- **Track-Fill** / **Reflow** – erzwungen.

Per Widget übersteuerbar (Skalierpolitik fix/skaliert/stretch, Anker, Priorität, Gruppe). Ein
„Struktur"-Overlay zeigt das erkannte Raster.

---

## Speichern, Snapshots & Bausteine

- **Auto-Speichern** (Standard an): jede Änderung wird ~1,5 s später gesichert; ein gelber Ring
  am Speichern-Button signalisiert „ungespeichert". Abschaltbar unter *Einstellungen*.
- **Speichern** schreibt ins aktuell geöffnete Layout, **Speichern unter …** legt ein benanntes
  Layout an. Über das **Layout-Dropdown** wechselst du zwischen „Standard (live)" und Varianten.
- **Bausteine**: Auswahl → Toolbar „Baustein" → wiederverwendbarer Block (view-übergreifend).

Alles wird im **Instanz-Attribut** gespeichert (kein externes File) und mit dem Symcon-Backup gesichert.

---

## Kiosk & Fernzugriff

- **Kiosk-URL:** `…/hook/lvb<InstanzID>?ui=builder&run=1&view=<Ansicht>` – Vollbild, kein
  Symcon-Chrome, ideal für Wandpanel/Tablet (z. B. Fully Kiosk Browser).
- Ohne `&view=` wird die als **Startseite** markierte Ansicht angezeigt.
- **Fernzugriff:** dieselbe URL hinter deiner **Symcon-Connect**-Adresse – funktioniert, weil
  alles über den regulären Port 3777 läuft (kein Extra-Port).

---

## Live-Werte (Delta-Polling)

Der Builder pollt nur **geänderte** Werte (`?api=val&ids=…&since=…`) im Sekundentakt und pausiert
bei inaktivem Tab. Das ist bewusst so gewählt:

- **portfrei** – nutzt den vorhandenen Symcon-Webserver (3777),
- **Connect-tauglich** – funktioniert über den Fernzugriff,
- **zero-config** – nichts einzurichten.

WebSocket-Push wäre schneller, braucht aber einen eigenen Port + Server-Socket-Instanz + Firewall
und funktioniert **nicht** über Connect – deshalb ist Polling der Standard.

---

## IPSView-Import

Im Builder **„⬇ IPSView"**. Als Quelle im Instanz-Formular unter **„IPSView-Import: Pfad zu einer
.ipsView-Datei"** den Dateipfad (z. B. `/var/lib/symcon/media/XXXXX.ipsView`) eintragen.
Der Importer deckt **alle 38 IPSView-Control-Typen** ab (Buttons, Slider, Status-Bilder, Gauges
mit Zonen, Wochenpläne, Shapes, HTMLBox …) und übernimmt Variablen-Bindung (über `ItemID`),
Einheiten, Min/Max und Farben.

---

## Datenspeicherung & Sicherheit

- **Layouts/Skins/Bausteine/Einstellungen** liegen im Instanz-Attribut `Layouts`.
- **Schreib-Token**: wird automatisch erzeugt und in die Seite injiziert; alle schreibenden
  Endpunkte (`setvar`, `layout`-POST) prüfen ihn. Der Nutzer verwaltet ihn nicht.
- Der WebHook liegt hinter der normalen Symcon-Benutzeranmeldung.

---

## API-Endpunkte (Referenz)

Alle relativ zum Hook `/hook/lvb<InstanzID>`:

| Endpunkt | Zweck |
|---|---|
| *(ohne)* / `?ui=builder` | Builder-Seite · `&run=1` = Kiosk |
| `?api=tree&parent=` / `&search=` | Objektbaum (lazy) / Suche Name·Pfad·ID |
| `?api=val&ids=…&since=…` | Live-Werte (Delta) |
| `?api=setvar&id=&value=&key=TOKEN` | Variable schreiben |
| `?api=layout` (GET/POST) · `&list=1` · `&file=` | Layouts laden/speichern/auflisten (Snapshots) |
| `?api=history&id=&h=` | Verlaufsdaten (Archive Handler) |
| `?api=html&id=` | Variablen-HTML fürs HTML-Widget |
| `?api=media&id=` | Media-Bild (Kamera/Bild) |
| `?api=weekplan&id=` | WeeklySchedule fürs Wochenplan-Widget |
| `?api=cal&ids=&days=` | iCal-Events |
| `?api=import` | IPSView-Seiten importieren |
| `?api=asset&name=echarts` | lokal gehostetes ECharts |

---

## FAQ / Fehlerbehebung

**Der Builder lädt nicht / 404.**
Kernel nach der Installation neu gestartet? Instanz einmal *Übernehmen* (registriert den Hook).
URL-Pfad ist `/hook/lvb<InstanzID>` (die ID steht im Objektbaum/Formular).

**Charts bleiben leer.**
Chart-/Sparkline-Widgets brauchen den **Archive Handler** und eine geloggte Variable.

**Kamera/Bild zeigt nichts.**
Es muss ein **Media-Objekt vom Typ Bild** sein; die Media-ID im Widget eintragen.

**Werte aktualisieren langsam (~1 s).**
Das ist das Delta-Polling (portfrei, Connect-tauglich). So gewollt.

**Kann ich das Aussehen ändern?**
Ja – Reiter *Skins* (Farben/Schriften, Dark/Light) und *Einstellungen* (Raster, Standardabstand,
Standard-Canvas, Standard-Skin, Auto-Speichern).

---

## Changelog

**1.0**
- Erstveröffentlichung als eigenständiges Modul.
- Selbst-registrierender WebHook, Auto-Token, Layouts im Instanz-Attribut.
- 49 Widget-Typen, 11 Skins (Dark/Light), SmartFit-Autoscaler, ECharts-Chart-Wrapper,
  Bausteine, Auto-Speichern + benannte Snapshots, IPSView-Import (100 % Typ-Abdeckung),
  Live-Werte per Delta-Polling.

---

*LiveView Builder ist ein Community-Modul für IP-Symcon. „keine Batterie" – reine Visualisierung,
keine Steuerlogik.*
