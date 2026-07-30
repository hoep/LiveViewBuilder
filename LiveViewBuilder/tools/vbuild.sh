#!/bin/bash
# Build + Validierungs-Gauntlet. Optional: arg1=sync -> ins Modul kopieren
cd /var/lib/symcon/scripts/livebuilder-dev || exit 1
php build.php || { echo "BUILD FAIL"; exit 1; }
python3 - <<'PY'
import re,sys
src=open('builder.html',encoding='utf-8').read()
js=max([m.group(1) for m in re.finditer(r'<script>(.*?)</script>',src,re.S)],key=len)
i=0;n=len(js);depth=0;prev=''
def rgx(p):return p in '=(,:[!&|?{};' or p==''
while i<n:
    c=js[i]
    if c in ' \t\r\n':i+=1;continue
    if c=='/'and i+1<n and js[i+1]=='/':
        while i<n and js[i]!='\n':i+=1
        continue
    if c=='/'and i+1<n and js[i+1]=='*':
        i+=2
        while i+1<n and not(js[i]=='*'and js[i+1]=='/'):i+=1
        i+=2;continue
    if c in '"\'`':
        q=c;i+=1
        while i<n and js[i]!=q:
            if js[i]=='\\':i+=2;continue
            i+=1
        i+=1;prev=q;continue
    if c=='/'and rgx(prev):
        i+=1;cl=False
        while i<n:
            if js[i]=='\\':i+=2;continue
            if js[i]=='[':cl=True
            elif js[i]==']':cl=False
            elif js[i]=='/'and not cl:break
            i+=1
        i+=1;prev='/';continue
    if c=='{':depth+=1
    elif c=='}':depth-=1
    prev=c;i+=1
print("JS Depth:",depth,"(0=OK)")
sys.exit(0 if depth==0 else 2)
PY
[ $? -ne 0 ] && { echo "BRACE FAIL"; exit 1; }

# Echte Syntaxpruefung des GERADE gebauten Artefakts. Die Klammerbilanz oben ist nur eine
# Heuristik - sie hat schon einen echten Syntaxfehler durchgelassen (eine Editor-Zeile hinter
# dem abschliessenden Semikolon). node parst wirklich.
if command -v node >/dev/null 2>&1; then
  python3 - <<'PYX'
import re,sys
src=open('builder.html',encoding='utf-8').read()
blocks=re.findall(r'<script[^>]*>(.*?)</script>',src,re.S)
open('/tmp/lvb_build_check.js','w',encoding='utf-8').write(max(blocks,key=len))
sys.exit(0)
PYX
  node --check /tmp/lvb_build_check.js || { echo "JS SYNTAX FAIL (node --check)"; rm -f /tmp/lvb_build_check.js; exit 1; }
  rm -f /tmp/lvb_build_check.js
  echo "node --check OK"
else
  echo "WARNUNG: node fehlt - nur Klammerbilanz geprueft"
fi

# Kernfunktionen muessen im Artefakt vorhanden sein. Ein Umbau, der sie versehentlich
# entfernt, faellt sonst erst im Browser auf - der Build meldet trotzdem OK.
python3 - <<'PYX'
import sys
s=open('builder.html',encoding='utf-8').read()
# Mit Klammer pruefen: "function stateTint" steckt sonst auch in "function stateTintXX"
# und eine Umbenennung waere unbemerkt durchgegangen (genau so getestet und aufgefallen).
fehlt=[f for f in ('defWidget','stateHit','stateTint','stateLook','_assocEq','_assocMatch','iconSVG','render')
       if ('function '+f+'(') not in s and (f+'=function(') not in s]
if fehlt:
    print('FEHLENDE KERNFUNKTIONEN:', ', '.join(fehlt)); sys.exit(3)
print('Kernfunktionen vollstaendig')
PYX
[ $? -ne 0 ] && { echo "CORE FAIL"; exit 1; }

# Doppelte Schluessel in ICONS/AICONS. In einem Objektliteral ist das gueltiges JS -
# der spaetere Eintrag ueberschreibt den frueheren stillschweigend. Genau so habe ich
# sechs bestehende adaptive Icons versehentlich verdeckt; node --check sieht das nicht.
python3 - <<'PYX'
import re,sys
s=open('builder.html',encoding='utf-8').read()
bad=[]
for reg,pat in (('AICONS',r"(?<![A-Za-z0-9_])([a-z0-9_-]+):\{k:'\w+'"),
                ('ICONS', r"(?<![A-Za-z0-9_])([a-z0-9_-]+):\['[^']*','")):
    i=s.find('var %s='%reg)
    if i<0: continue
    j=s.find('var AICONS=',i+5) if reg=='ICONS' else s.find('function iconSVG',i)
    blk=s[i:j if j>i else len(s)]
    seen={}
    for k in re.findall(pat,blk):
        seen[k]=seen.get(k,0)+1
    d=sorted(k for k,n in seen.items() if n>1)
    if d: bad.append('%s: %s'%(reg,', '.join(d)))
if bad:
    print('DOPPELTE ICON-SCHLUESSEL -> ' + ' | '.join(bad)); sys.exit(4)
print('Icon-Schluessel eindeutig')
PYX
[ $? -ne 0 ] && { echo "ICON DUP FAIL"; exit 1; }
for f in handler.php module.php store.inc.php; do
  t=/var/lib/symcon/modules/LiveViewBuilder/LiveViewBuilder/$f
  [ -f "$t" ] || continue
  php -l "$t" >/dev/null || { echo "$f LINT FAIL"; exit 1; }
done
code=$(curl -s -m 6 -o /dev/null -w "%{http_code}" "http://127.0.0.1:3777/hook/run/hausleitnerweg")
echo "Laufzeit erreichbar: HTTP $code   (prueft den BEREITS ausgelieferten Stand, nicht den neuen Build)"
[ "$code" != "200" ] && { echo "HTTP FAIL"; exit 1; }
if [ "$1" = "sync" ]; then
  M=/var/lib/symcon/modules/LiveViewBuilder/LiveViewBuilder
  cp builder.html "$M/builder.html"; cp build.php "$M/build.php"; rm -rf "$M/src"; cp -r src "$M/src"
  cp builder.html /var/lib/symcon/scripts/backup/builder.html
  # Das Build-Skript selbst mitversionieren. Es ist das Tor, das kaputte Stände
  # aufhält - liegt es nur ausserhalb des Repos, ist es beim naechsten Rechner weg.
  mkdir -p "$M/tools"; cp "$0" "$M/tools/vbuild.sh"
  echo "synced to module + backup"
fi
echo "OK"
