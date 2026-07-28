# LiveView Builder

Ein vollwertiger Dashboard-Builder fuer IP-Symcon - im Browser, per Drag and Drop, pixelgenau.
Aus 77 Widget-Typen eigene Visualisierungen bauen, beliebige Symcon-Variablen live anbinden,
automatisch auf jeden Bildschirm skalieren und als Vollbild-Kiosk starten - ohne offene Ports,
ohne Skripte, ohne Konfiguration. Instanz anlegen, URL oeffnen, loslegen.

Live-Updates laufen primaer per WebSocket-Push (optionaler Port) mit automatischem Polling als
Fallback - der Fallback funktioniert portfrei auch ueber Symcon-Connect.

---

## Inhalt

- [Highlights](#highlights)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Einrichtung](#einrichtung-zero-config)
- [Bedienung](#bedienung)
- [Widget-Katalog](#widget-katalog)
- [Skins und Themes](#skins-und-themes)
- [SmartFit - der Autoscaler](#smartfit---der-autoscaler)
- [Speichern, Snapshots und Bausteine](#speichern-snapshots-und-bausteine)
- [Kiosk und Fernzugriff](#kiosk-und-fernzugriff)
- [Live-Werte (WebSocket + Polling)](#live-werte-websocket--polling)
- [IPSView-Import](#ipsview-import)
- [Datenspeicherung und Sicherheit](#datenspeicherung-und-sicherheit)
- [API-Endpunkte](#api-endpunkte-referenz)
- [FAQ und Fehlerbehebung](#faq-und-fehlerbehebung)
- [Changelog](#changelog)

---

## Highlights

- 77 Widget-Typen - von Wert/Schalter ueber Gauges, Charts (Apache ECharts), Fluss-Schema,
  Kameras, Wetter- und Sonnen-Cards bis HTML-Embeds, Wochenplaenen und einem Live-Monitor.
- Pixelgenaues Drag and Drop - absolute Positionierung, Raster-Snap, Ausricht-Hilfen mit
  einstellbarem Standardabstand, Multi-Select, Ausrichten/Verteilen, Gruppen, Undo/Redo.
- Beliebige Variablen live binden - integrierter Objektbaum mit Live-Suche nach
  Name, Pfad und ID; Werte aktualisieren sich automatisch, Schalten schreibt zurueck.
- WebSocket-Push als Primaerkanal - sofortige Aktualisierung ueber einen optionalen Port,
  mit Delta-Polling als portfreiem Fallback (auch ueber Connect).
- SmartFit-Autoscaler - fuellt jedes Seitenverhaeltnis (16:9, Ultrawide, Portrait, Handy)
  ohne Verzerrung, mit optionalem Reflow.
- Skins mit Dark und Light - eingebaute Skins, eigene per Klick, Live-Farb- und Schrift-Editor,
  Skin-Wechsler-Widget fuer den Betrachter. Alle Grafiken sind token-basiert.
- Einheitliche Widget-Editoren - zentrale Variablen-Bindung, Icon-Farbe (Skin), Interaktion
  (Seite/Popup, kurz und lang), Sichtbarkeit, Typografie und Responsive-Optionen fuer alle Widgets.
- Auto-Speichern und "Speichern unter" - benannte Snapshots/Varianten, alles in der Instanz.
- Vollbild-Kiosk - eine URL fuers Wandpanel/Tablet, ohne Symcon-Chrome.
- Zero-Config - der WebHook registriert sich selbst, ein Token wird automatisch erzeugt.
- IPSView-Import - bestehende .ipsView-Seiten uebernehmen.

---

## Voraussetzungen

| Komponente | Anforderung |
|---|---|
| IP-Symcon | ab 7.1 |
| WebHook Control | Kernbestandteil von Symcon - nichts zu installieren |
| Archive Handler | optional, nur fuer Chart-/Sparkline-Widgets (historische Verlaeufe) |
| iCal Calendar Reader | optional, nur fuers Kalender-Widget |
| WebSocket-Port | optional, nur fuer den Push-Kanal (sonst laeuft alles per Polling) |
| Browser | aktueller Chromium/WebKit/Firefox (Tablet/Kiosk-tauglich) |

Ohne WebSocket-Port sind keine zusaetzlichen IO-/Splitter-Instanzen, keine offenen Ports und
keine Firewall-Regeln noetig.

---

## Installation

Ueber den Module Store (empfohlen): in Symcon unter Module, Store nach "LiveView Builder"
suchen und installieren.

Ueber Git (manuell): in der Symcon-Verwaltungskonsole Module, Hinzufuegen und die
Repository-URL eintragen.

Danach den Symcon-Kernel neu starten (bzw. Module, Aktualisieren), damit die Library geladen wird.

---

## Einrichtung (Zero-Config)

1. Instanz hinzufuegen, "LiveView Builder".
2. Im Konfigurationsdialog optional ein Site-Label setzen (Pfad-Bestandteil) und - falls
   gewuenscht - einen WebSocket-Port fuer den Push-Kanal.
3. Der Dialog zeigt die fertigen URLs:
   - Builder-Editor: `http://<Symcon-IP>:3777/hook/builder/<Site>`
   - Kiosk/Vollbild: `http://<Symcon-IP>:3777/hook/run/<Site>?view=<Ansicht>`
4. URL im Browser oeffnen - der Builder laedt, der Objektbaum zeigt die Variablen.

Beim ersten Uebernehmen passiert automatisch:
- die WebHooks `/hook/builder` und `/hook/run` werden registriert,
- ein zufaelliger Schreib-Token wird erzeugt und in die Seite injiziert.

Mehrere Dashboards: einfach mehrere Instanzen anlegen - jede hat ihr eigenes Site-Label und
ihre eigenen Ansichten.

---

## Bedienung

Palette (Seitenleiste, Reiter Palette): Widget auf die Canvas ziehen oder anklicken, danach
frei positionieren und an der Ecke skalieren.

Variablen binden (Reiter Variablen): im Baum navigieren oder oben suchen (Name, Pfad, ID, live
beim Tippen). Klick auf eine Variable erzeugt eine Wert-Kachel bzw. bindet sie an das
ausgewaehlte Widget. Der Widget-Typ ist im Eigenschaften-Panel jederzeit umstellbar.

Ansichten (Views): mehrere Seiten pro Dashboard, umschaltbar ueber das Ansichts-Dropdown; eine
Ansicht als Startseite (Kiosk-Default) markierbar. Beim Umbenennen einer Ansicht werden alle
Verweise (Seite oeffnen, Popup, Startseite) automatisch mitgezogen.

Interaktion je Widget: kurzer Tipp und langer Druck sind getrennt belegbar - Seite oeffnen,
Popup oeffnen, Skript ausfuehren. Ein dezenter Hover-Hinweis zeigt an, dass ein Widget reagiert.

Reiter der Seitenleiste: Variablen, Palette, Farben, Icons, Skins, Einstellungen, Eigenschaften.
Die Seitenleiste ist am linken Rand breiter ziehbar.

---

## Widget-Katalog

Grundelemente: Wert, Wertkarte, Text, Lauftext, Icon, Linie, Form, Bild, Leer.

Steuerung: Kachel, Button, Schalter, Slider, RangeSlider, Stepper, Thermostat, Rollo, Licht,
Dial (Kreis-Regler), CircleRange, Auswahl (Segmented), Checkbox, Alarm, Vacuum, Media,
Skin-Wechsler, Eingabe (Textfeld), RGB-Button, RGB-Box, RGB-Slider, Farbkreis, CIE-Picker.

Anzeige: Chip, Gauge und Gauge+ (Farbzonen), Balken, Temp-Saeule (mit Soll-Marker), KPI,
Delta (Auf/Ab-Trend), Statistik (Min/Mittel/Max), Zaehlerwert (Verbrauch je Periode),
Berechnung, Raum, Zustand (Assoziationen), Status-Liste, Status-Grid, Status-Bild,
Zustands-Timeline, Geraete-Liste, Metrik-Liste, Info-Liste.

Diagramme: Chart (Apache-ECharts-Wrapper - Flaeche/Linie/Balken/Stufen/Punkte, Spline,
Balken-Rundung, Flaechen-Verlauf, Legende, Y-Raster, Datenlabels, Y-Min/Max, mehrere Serien,
zweite Y-Achse, Zoom/Scroll, Stapeln), Sparkline, Sankey, Windrose, Fluss-Schema, Energiefluss-Linie.

Fluss-Schema (Widget "Fluss"): drei Modi in einem Widget - Pipeline (Stationen in Reihe mit
Wert je Block und animierten Konnektoren, optionales End-Becken), Energie (zentraler Knoten mit
frei anlegbaren Elementen Netz/PV/Batterie/Verbraucher, gerichteter, eingefaerbter Flusslinie,
Geschwindigkeit und Ladezustand) und Hub (Quellen zu Zentrum zu Senken).

Wetter und Zeit: Wetter, Wetter+ (variablen-gebundene Forecast-Tage mit
Temperatur-zu-Farbe-Verlaufsbalken), Sonne, Sonnenbogen (Live-Sonnen- und Mondstand aus
Location Control und Astronomie, mit lokalem Fallback), Uhr, Timer, Kalender (iCal),
Wochenplan (WeeklySchedule, konfigurierbare Zustandsfarben), Regenmenge.

Medien und Web: Kamera, Kamera+ (PTZ/Bewegung), HTML (rendert Variablen-HTML in isoliertem
iframe, skalierbar, transparent), WebView (URL).

System und Live: Meldungen (Symcon-Log mit Severity-Filter, konfigurierbarem Intervall),
Live-Monitor (zeigt eingehende WebSocket-/Poll-Updates, Standard- oder Kompaktdarstellung),
Objekt-Info, Ereignis-Steuerung, Komponente (wiederverwendbarer Baustein mit ID-Remapping).

Dazu eigene Bausteine: eine Auswahl gruppieren, als wiederverwendbaren Block speichern und per
Klick oder Drag beliebig oft einfuegen.

---

## Skins und Themes

Alle Farben und Schriften kommen aus austauschbaren Skins - jeder mit Dark- und Light-Variante:

- Eingebaute Skins in verschiedenen Akzentfarben.
- Eigene Skins: im Reiter Skins duplizieren, dann Farb-Tokens und Schriften live editieren.
- Toolbar-Umschalter fuer Dunkel/Hell; das Skin-Wechsler-Widget laesst auch den Betrachter im
  Kiosk zwischen Skins und Themes wechseln (Wahl bleibt per localStorage erhalten).

Widget-Farben lassen sich als Skin-Stichwort setzen (accent, ok, warn, crit, info, text, faint)
und passen sich damit automatisch dem aktiven Theme an. Ein Kontrast-Schutz verhindert dunkle
Schrift auf dunklem Grund. Alle Grafiken (Charts, Gauges, Kameras, Verlaufsbalken) faerben beim
Skin-Wechsel automatisch mit.

---

## SmartFit - der Autoscaler

Pro Ansicht waehlbar (Toolbar Anpassung):

- Letterbox - gleichmaessig skaliert mit Rand.
- Auto (Standard neuer Ansichten) - fuellt den Viewport exakt, Inhalt bleibt unverzerrt
  (Text/Icons uniform, Charts/Kameras re-layouten). Bei echtem Portrait/Handy automatisch Reflow.
- Track-Fill und Reflow - erzwungen.

Per Widget uebersteuerbar (Skalierpolitik fix/skaliert/stretch, Anker, Prioritaet, Gruppe). Ein
Struktur-Overlay zeigt das erkannte Raster.

---

## Speichern, Snapshots und Bausteine

- Auto-Speichern (Standard an): jede Aenderung wird kurz danach gesichert; ein Ring am
  Speichern-Button signalisiert "ungespeichert". Abschaltbar unter Einstellungen.
- Speichern schreibt ins aktuell geoeffnete Layout, Speichern unter legt ein benanntes Layout an.
  Ueber das Layout-Dropdown wechselt man zwischen Standard (live) und Varianten.
- Bausteine: Auswahl, Toolbar Baustein, wiederverwendbarer Block (view-uebergreifend).

Alles wird im Instanz-Attribut gespeichert (kein externes File) und mit dem Symcon-Backup gesichert.

---

## Kiosk und Fernzugriff

- Kiosk-URL: `/hook/run/<Site>?view=<Ansicht>` - Vollbild, kein Symcon-Chrome, ideal fuer
  Wandpanel/Tablet (z. B. Fully Kiosk Browser).
- Ohne `&view=` wird die als Startseite markierte Ansicht angezeigt.
- Fernzugriff: dieselbe URL hinter der Symcon-Connect-Adresse. Der Polling-Fallback laeuft ueber
  Port 3777 und funktioniert damit auch ueber Connect; der WebSocket-Push ist nur im lokalen Netz
  bzw. bei erreichbarem Port aktiv.

---

## Live-Werte (WebSocket + Polling)

Der Builder haelt die Werte auf zwei Wegen aktuell:

- WebSocket-Push (Primaerkanal): ein eigenes Push-Modul verschickt Aenderungen der im Layout
  gebundenen Variablen sofort an alle Clients. Aktiv, sobald im Instanzdialog ein WebSocket-Port
  gesetzt ist und dieser erreichbar ist.
- Delta-Polling (Fallback): laeuft automatisch, wenn kein Push ankommt (kein Port, nicht
  erreichbar, oder ueber Connect). Es werden nur geaenderte Werte abgefragt
  (`?api=val&ids=...&since=...`), und bei inaktivem Tab pausiert die Abfrage.

Der Sicherheits-Poll kann in den Einstellungen abgeschaltet werden (reiner WebSocket-Betrieb);
beim Seitenwechsel wird dann einmalig gepollt, danach kommen Updates ausschliesslich per Push.
Ein globales Standard-Intervall fuer periodisch nachladende Widgets (z. B. Meldungen) ist in den
Einstellungen konfigurierbar und je Widget uebersteuerbar.

---

## IPSView-Import

Im Instanz-Formular unter IPSView-Import den Pfad zu einer .ipsView-Datei eintragen
(z. B. `/var/lib/symcon/media/XXXXX.ipsView`) und im Builder importieren. Der Importer deckt die
IPSView-Control-Typen ab (Buttons, Slider, Status-Bilder, Gauges mit Zonen, Wochenplaene, Shapes,
HTMLBox) und uebernimmt Variablen-Bindung (ueber ItemID), Einheiten, Min/Max und Farben.

---

## Datenspeicherung und Sicherheit

- Layouts, Skins, Bausteine und Einstellungen liegen im Instanz-Attribut.
- Schreib-Token: wird automatisch erzeugt und in die Seite injiziert; alle schreibenden
  Endpunkte (setvar, layout-POST, runscript, setevent, publish) pruefen ihn.
- Der WebHook liegt hinter der normalen Symcon-Benutzeranmeldung.

---

## API-Endpunkte (Referenz)

Alle relativ zum Hook (`/hook/builder/<Site>` fuer den Editor, `/hook/run/<Site>` fuer die Laufzeit):

| Endpunkt | Zweck |
|---|---|
| `?ui=builder` bzw. `/hook/run/<Site>` | Builder-Seite bzw. Kiosk-Laufzeit |
| `?api=tree&parent=` / `&search=` | Objektbaum (lazy) und Suche nach Name/Pfad/ID |
| `?api=val&ids=...&since=...` | Live-Werte (Delta) |
| `?api=setvar&id=&value=&key=TOKEN` | Variable schreiben |
| `?api=layout` (GET/POST), `&list=1`, `&file=` | Layouts laden/speichern/auflisten |
| `?api=history&id=&h=` | Verlaufsdaten (Archive Handler) |
| `?api=html&id=` | Variablen-HTML fuers HTML-Widget |
| `?api=media&id=` | Media-Bild (Kamera/Bild) |
| `?api=weekplan&id=` | WeeklySchedule fuers Wochenplan-Widget |
| `?api=cal&ids=&days=` | iCal-Events |
| `?api=astro&id=&moon=` | Sonnen-/Mondstand fuer die Sonnenbogen-Card |
| `?api=messages&n=&sev=` | Symcon-Log (gefiltert) fuers Meldungen-Widget |
| `?api=event&id=` / `?api=setevent&id=&active=&key=TOKEN` | Ereignis lesen/schalten |
| `?api=objinfo&id=` | Objekt-Metadaten |
| `?api=runscript&id=&key=TOKEN` | Skript ausfuehren |
| `?api=publish&key=TOKEN` | Reload-Broadcast an alle Clients (WebSocket) |
| `?api=import` | IPSView-Seiten importieren |
| `?api=asset&name=echarts` | lokal gehostetes ECharts |

---

## FAQ und Fehlerbehebung

Der Builder laedt nicht / 404.
Kernel nach der Installation neu gestartet? Instanz einmal Uebernehmen (registriert die Hooks).
Der URL-Pfad ist `/hook/builder/<Site>` bzw. `/hook/run/<Site>`.

Charts bleiben leer.
Chart-/Sparkline-Widgets brauchen den Archive Handler und eine geloggte Variable.

Kamera/Bild zeigt nichts.
Es muss ein Media-Objekt vom Typ Bild sein; die Media-ID im Widget eintragen.

Werte aktualisieren nur beim Seitenwechsel.
Reiner WebSocket-Betrieb ohne erreichbaren Port. Entweder den WebSocket-Port pruefen oder den
Sicherheits-Poll in den Einstellungen wieder aktivieren.

Kann ich das Aussehen aendern?
Ja - Reiter Skins (Farben/Schriften, Dark/Light) und Einstellungen (Raster, Standardabstand,
Standard-Canvas, Standard-Skin, Aktualisierungs-Intervall, Auto-Speichern).

---

## Changelog

1.1
- WebSocket-Push als Primaerkanal ueber ein eigenes Push-Modul (optionaler Port), mit
  Delta-Polling als portfreiem Fallback; reiner WebSocket-Betrieb optional.
- Neues Hook-Schema `/hook/builder/<Site>` und `/hook/run/<Site>` mit Site-Label.
- Generalisiertes Fluss-Widget mit drei Modi (Pipeline, Energie, Hub).
- Neue Widgets: Wertkarte, Sonnenbogen, Meldungen, Live-Monitor.
- Vereinheitlichte Widget-Editoren: zentrale Variablen-Bindung, Icon-Farbe (Skin), Farbe nach
  Zustand, Praefix/Suffix, Schwellenfarbe, Nachkommastellen; Interaktion (Seite/Popup, kurz und
  lang) fuer alle Widgets; Kontrast-Schutz fuer Textfarben.
- Konfigurierbares Aktualisierungs-Intervall (global und je Widget).
- 77 Widget-Typen.

1.0
- Erstveroeffentlichung als eigenstaendiges Modul.
- Selbst-registrierender WebHook, Auto-Token, Layouts im Instanz-Attribut.
- Widget-Sammlung, Skins (Dark/Light), SmartFit-Autoscaler, ECharts-Chart-Wrapper, Bausteine,
  Auto-Speichern und benannte Snapshots, IPSView-Import, Live-Werte per Delta-Polling.

---

LiveView Builder ist ein Community-Modul fuer IP-Symcon. Reine Visualisierung, keine Steuerlogik.
