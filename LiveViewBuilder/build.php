<?php
// Baut builder.html aus src/. NICHT builder.html direkt editieren.
$d=__DIR__."/src";
$core=["00-registry.js", "01-boot-icons.js", "02-zoom-core.js", "03-render-charts.js", "04-props.js", "05-interaction.js", "06-live.js", "06-panel.js", "07-builders.js", "08-assoc.js", "09-io-init.js", "10-chrome.js", "11-migrate.js", "12-doku-demo.js", "12-doku.js", "13-sidepanel.js"];
$js="";
foreach($core as $f){$c=@file_get_contents("$d/js/$f");if($c===false){fwrite(STDERR,"missing $f\n");exit(1);}$js.=$c;}
$wf=glob("$d/widgets/*.js");sort($wf);
foreach($wf as $f){$js.=file_get_contents($f);}
$tail=@file_get_contents("$d/js/99-init.js");if($tail===false){fwrite(STDERR,"missing 99-init\n");exit(1);}$js.=$tail;
// JS komprimieren: NUR Kommentare + Whitespace entfernen (kein compress/mangle -> semantisch identisch).
// Der Code ist stark kommentiert (deutsche Doku), daher grosser, risikoloser Groessengewinn.
$rawlen=strlen($js);
$tmp=tempnam(sys_get_temp_dir(),'lvbjs_');file_put_contents($tmp,$js);
$min=@shell_exec('terser '.escapeshellarg($tmp).' --format comments=false 2>/dev/null');
@unlink($tmp);
if($min!==null&&strlen(trim($min))>$rawlen*0.3){$js=trim($min);echo "js minify: ".$rawlen." -> ".strlen($js)." bytes\n";}
else{fwrite(STDERR,"WARN: terser fehlgeschlagen -> JS unminifiziert\n");}
$css=file_get_contents("$d/styles.css");
// CSS leicht komprimieren: Kommentare raus, Whitespace zusammenfassen (konservativ).
$css=preg_replace('#/\*.*?\*/#s','',$css);
$css=preg_replace('#\s*\n\s*#',"\n",$css);
$css=preg_replace('#\n{2,}#',"\n",$css);
$shell=file_get_contents("$d/shell.html");
$out=str_replace("{{STYLES}}\n",$css,$shell);
$out=str_replace("{{APP}}\n",$js,$out);
// Cache-Buster fuer das separat (7 Tage) gecachte Doku-Daten-Asset: Hash des Inhalts an die URL,
// damit Aenderungen an 12-doku-data.js schon bei normalem Reload (builder.html ist no-store) gezogen werden.
$dokuver=substr(md5((string)@file_get_contents("$d/js/12-doku-data.js")),0,10);
$out=str_replace("{{DOKUVER}}",$dokuver,$out);
file_put_contents(__DIR__."/builder.html",$out);
echo "built ".strlen($out)." bytes; core+".count($wf)." widgets\n";
