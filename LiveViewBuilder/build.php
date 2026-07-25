<?php
// Baut builder.html aus src/. NICHT builder.html direkt editieren.
$d=__DIR__."/src";
$core=["00-registry.js", "01-boot-icons.js", "02-zoom-core.js", "03-render-charts.js", "04-props.js", "05-interaction.js", "06-live.js", "07-builders.js", "08-assoc.js", "09-io-init.js"];
$js="";
foreach($core as $f){$c=@file_get_contents("$d/js/$f");if($c===false){fwrite(STDERR,"missing $f\n");exit(1);}$js.=$c;}
$wf=glob("$d/widgets/*.js");sort($wf);
foreach($wf as $f){$js.=file_get_contents($f);}
$tail=@file_get_contents("$d/js/99-init.js");if($tail===false){fwrite(STDERR,"missing 99-init\n");exit(1);}$js.=$tail;
$css=file_get_contents("$d/styles.css");
$shell=file_get_contents("$d/shell.html");
$out=str_replace("{{STYLES}}\n",$css,$shell);
$out=str_replace("{{APP}}\n",$js,$out);
file_put_contents(__DIR__."/builder.html",$out);
echo "built ".strlen($out)." bytes; core+".count($wf)." widgets\n";
