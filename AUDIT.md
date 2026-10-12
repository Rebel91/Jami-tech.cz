# Audit zobrazení a formulářů — 12. 10. 2026

## Rozsah a výsledky

Lokální verze webu: hlavní stránka, e-shop, objednávka s neprázdným košíkem a obě právní stránky. Automatická kontrola v Chromium a WebKit při šířkách 320, 375, 390, 520, 768, 850, 1024, 1280, 1440 a 1920 px: 100 kombinací bez přesahujících prvků hlavního obsahu, hlavičky a patičky a bez deformovaných čtvercových náhledů. Horizontální portfolio a zavřený boční košík jsou záměrně mimo běžný tok.

Mobilní menu a oba formuláře byly ověřeny v prohlížeči: bez tokenu se požadavek neodesílá; při simulovaném úspěchu se zobrazí potvrzení a košík se vyprázdní. Skutečné poptávky, objednávky ani e-maily nebyly odesílány. Backend: `cd worker && npm run check`, všech 13 testů prošlo. Syntaxe upravených skriptů a `git diff --check` bez chyb.

## Opravy

- Čtvercové obrázky mají samostatně určené rozměry; přirozené rozměry fotografie již neovlivňují velikost karty.
- Mobilní karty, nadpisy, dlouhé kontakty, právní odkazy a objednávkové položky se přizpůsobují šířce. Košík se vejde i do hlavičky při 320 px.
- Gridové sloupce a pole formuláře mohou zmenšit šířku. Text vstupů na mobilu má 16 px; malé ovládací prvky mají větší dotykovou plochu.
- Atribut `hidden` nyní spolehlivě skryje prvky i s vlastním CSS `display`, včetně dokončeného objednávkového formuláře.
- Zvýšen kontrast tlumeného textu na tmavém pozadí.
- Turnstile používá kompaktní widget při nedostatku místa a češtinu. Selhání načítání zobrazí zprávu; nevyvolává neošetřené odmítnutí Promise.
- Bez tokenu se formulář neodesílá. Úspěch vyžaduje také referenční číslo; honeypot již nevrací falešný úspěch.
- Server kontroluje token přes Siteverify, akci a povolený hostname. Konfigurace zahrnuje hlavní doménu i `www`.
- Výpadek zákaznického potvrzení již nezmění přijatou poptávku/objednávku na chybu, která by vedla k opakovanému odeslání.
- Zvýšeny verze změněných souborů v HTML pro obnovení prohlížečové cache.

## Automatické potvrzení „nejsem robot“

U Cloudflare Turnstile je automatické ověření očekávané: interakce se vyžaduje podle vyhodnoceného rizika. Samotné zatržení není důkazem přijetí formuláře. Zásadní je serverová validace, která je v tomto projektu přítomna a testována.

Dokumentace: https://developers.cloudflare.com/turnstile/concepts/widget/
Serverová validace: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## Omezení a nasazení

Kontrola používá simulované rozměry a prohlížečové enginy, nikoli všechny skutečné modely telefonů a tabletů. Lokální test widget nahrazuje nebo blokuje; skutečný Turnstile, nastavení povolených hostname v Cloudflare, tajné klíče, doručení e-mailů, rate limiting a produkční HTTP hlavičky nebyly ověřeny v účtech provozovatele. Veřejné adresy nebyly přístupné použitému webovému nástroji.

Změny nejsou nasazené. Pro produkční účinek je nutné publikovat statické soubory a nasadit upravený Worker. V Cloudflare Turnstile ověřit, že widget dovoluje `jami-tech.cz` i `www.jami-tech.cz`; serverové rozšíření samo o sobě nastavení widgetu nemění. Rate limiting je nadále externí nastavení Cloudflare, nikoli součást kódu Workeru.
