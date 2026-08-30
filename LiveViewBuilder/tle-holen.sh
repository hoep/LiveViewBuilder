#!/bin/sh
# Bahnelemente einer Gruppe holen - erst Celestrak, bei Ausfall Space-Track.
#
#   Aufruf: tle-holen.sh <gruppe> <zieldatei>
#
# Celestrak ist unzuverlaessig. Am 30.08.2026 gemessen: von zehn Abrufen
# glueckten drei, sechsmal kam 503, einmal gar keine Verbindung - und ein
# Erfolg brauchte 6,6 bis 11,7 Sekunden. Space-Track ist die Quelle, aus der
# Celestrak selbst schoepft: es antwortet in unter einer Sekunde und ist rund
# zwoelf Stunden frischer, verlangt aber eine Anmeldung (sat.login, Zeile 1
# Kennung, Zeile 2 Passwort).
#
# Space-Track kennt Celestraks Gruppen NICHT. Deshalb liest der Rueckfallweg
# die Kennnummern aus dem vorhandenen Stand: was die Gruppe enthaelt, hat
# einmal Celestrak bestimmt, erneuert werden nur die Bahnelemente. Ohne
# vorhandenen Stand kann Space-Track also nicht einspringen - eine neue Gruppe
# muss einmal ueber Celestrak kommen.
#
# Laeuft immer abgekoppelt vom Anfrage-Thread: Symcon puffert die Hook-Ausgabe
# bis zum Skriptende, ein Abruf in der Anfrage laesst den Browser mitwarten.

set -u
G=${1:-stations}
ZIEL=${2:?Zieldatei fehlt}
TMP=$ZIEL.neu
ROH=$ZIEL.roh
JAR=
LOGIN=/var/lib/symcon/scripts/sat.login
UA='IP-Symcon LiveViewBuilder'

aufraeumen() { rm -f "$TMP" "$ROH"; [ -n "$JAR" ] && rm -f "$JAR"; }
brauchbar()  { [ -s "$TMP" ] && [ "$(wc -c < "$TMP")" -gt 100 ]; }
uebernehmen() { mv -f "$TMP" "$ZIEL"; rm -f "$ROH"; [ -n "$JAR" ] && rm -f "$JAR"; exit 0; }

# --- 1) Celestrak, der gewohnte Weg -----------------------------------------
if curl -fsS --max-time 25 -A "$UA" -o "$TMP" \
     "https://celestrak.org/NORAD/elements/gp.php?GROUP=$G&FORMAT=tle" 2>/dev/null
then brauchbar && uebernehmen
fi

# --- 2) Space-Track als Rueckfall -------------------------------------------
[ -r "$LOGIN" ] || { aufraeumen; exit 1; }
[ -s "$ZIEL"  ] || { aufraeumen; exit 1; }

IDS=$(awk 'NR%3==2 {print substr($0,3,5)}' "$ZIEL" | tr -d ' ' | grep -E '^[0-9]+$' | paste -sd,)
[ -n "$IDS" ] || { aufraeumen; exit 1; }

KENN=$(sed -n 1p "$LOGIN" | tr -d '\r\n')
PASS=$(sed -n 2p "$LOGIN" | tr -d '\r\n')
JAR=$(mktemp) || { aufraeumen; exit 1; }

curl -fsS --max-time 20 -c "$JAR" -o /dev/null \
     --data-urlencode "identity=$KENN" --data-urlencode "password=$PASS" \
     https://www.space-track.org/ajaxauth/login 2>/dev/null \
  || { aufraeumen; exit 1; }

curl -fsS --max-time 30 -b "$JAR" -o "$ROH" \
     "https://www.space-track.org/basicspacedata/query/class/gp/NORAD_CAT_ID/$IDS/orderby/NORAD_CAT_ID/format/3le" \
     2>/dev/null || { aufraeumen; exit 1; }

# 3le stellt dem Namen "0 " voran; der Auswerter im Browser erwartet ihn blank
# und prueft den Anfang gegen ISS/CSS/HST - mit der Null schlaegt das fehl.
sed 's/^0 //' "$ROH" > "$TMP"
brauchbar && uebernehmen
aufraeumen; exit 1
