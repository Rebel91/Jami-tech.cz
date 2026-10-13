# Jami tech

Statický web pro zakázkový 3D tisk, portfolio, e-shop a poptávky. Aktualizováno 13. 10. 2026 podle stavu zdrojových souborů. Nastavení účtů a stav veřejného nasazení tím nejsou ověřeny.

## Co je potřeba dokončit před spuštěním prodeje

### Podnikatelské a právní údaje

- [ ] Po přidělení doplnit IČO do [obchodních podmínek](legal/obchodni-podminky.html) a [ochrany osobních údajů](legal/ochrana-osobnich-udaju.html).
- [ ] Doplnit skutečný zápis podnikatele v rejstříku a stav plátcovství DPH do obchodních podmínek; ověřit jméno, sídlo a kontakty.
- [ ] Stanovit datum účinnosti obou dokumentů a odstranit označení pracovního návrhu až po doplnění údajů a ověření provozních postupů.
- [ ] Zavést zasílání potvrzení uzavřené smlouvy se zněním platných podmínek, které si zákazník může uložit. Současný automatický e-mail potvrzuje pouze přijetí objednávky; výslovné přijetí objednávky a platební pokyny je potřeba následně poslat zákazníkovi.
- [ ] Připravit postup pro reklamace a vrácení zboží: příjem na uvedené adrese, evidence, písemná potvrzení a sledování lhůt podle podmínek.

Vzor odstoupení je připraven v [legal/odstoupeni-od-smlouvy.html](legal/odstoupeni-od-smlouvy.html) a odkazují na něj obchodní podmínky.

### Produkty a vyřízení objednávek

- [ ] Doplnit u produktů aktuální dostupnost a dobu výroby/dodání. U zakázek potvrdit konkrétní termín před uzavřením smlouvy.
- [ ] Doplnit skutečný materiál, rozsah dodávky a pokyny pro používání; u podsvíceného Lithophane uvést, zda je součástí kabel a napájecí zdroj.
- [ ] Nahradit ilustrační obrázky Lithophane v e-shopu skutečnými fotografiemi výrobku. Na hlavní stránce nahradit zástupný vizuál fotografií podle postupu níže.
- [ ] Připravit platební údaje, QR platbu, splatnost a vystavování dokladů; ověřit praktické zajištění kurýra, dobírky a osobního odběru.

### Osobní údaje a uchování souborů

- [ ] Zavést mazání podle návrhu zásad: neuskutečněné poptávky nejvýše 12 měsíců od poslední komunikace, výrobní podklady a fotografie nejvýše 3 měsíce po dodání, základní dokumentace objednávek zpravidla 3 roky. Výjimky pro spory a zákonné doklady jsou uvedeny v zásadách.
- [ ] Zahrnout do mazání e-mailové přílohy, stažené soubory i zálohy. Zdrojový kód nyní automatické mazání těchto kopií neřeší.
- [ ] Ověřit skutečné poskytovatele hostingu a e-mailové schránky, zpracovatelské podmínky služeb Cloudflare a Resend a použité záruky předání údajů mimo EHP; podle výsledku zpřesnit zásady ochrany osobních údajů.

Fotografie v prohlížeči nemají automatickou expiraci. Odebrání položky z košíku je nemaže; aplikace je odstraňuje po úspěšném přijetí objednávky. Neodeslané fotografie lze odstranit vymazáním dat webu v prohlížeči.

### Nasazení a kontrola provozu

- [ ] Ověřit v účtech nastavení domény a DNS, Turnstile, odesílací domény Resend a tajných klíčů Workeru. Veřejný Site Key a adresa API jsou již vyplněné v [form-config.js](form-config.js); jejich funkčnost je třeba ověřit na nasazeném webu.
- [ ] Nasadit aktuální web a Worker společně: obsahují nové ceny Lithophane a verzi obchodních podmínek `v3.1`.
- [ ] Nastavit nebo ověřit omezení počtu požadavků na `forms.jami-tech.cz`; Worker vlastní rate limiting zatím neobsahuje.
- [ ] Ověřit bezpečnostní hlavičky na skutečném hostingu, zejména Content-Security-Policy a X-Content-Type-Options.
- [ ] Na veřejném webu vyzkoušet poptávku s přílohou a objednávku obou velikostí Lithophane s fotografií. Zkontrolovat ceny, dopravu, platby, interní zprávu i potvrzení zákazníkovi.
- [ ] Ověřit objednávku a nahrávání fotografií na mobilu, chování při neúspěšném odeslání a funkčnost právních odkazů.

## Lokální spuštění a kontrola

Pro prohlížení webu použij Live Server ve VS Code. Přímé otevření `index.html` postačí pro základní náhled; odeslání formulářů ověřuj z povolené domény, protože backend kontroluje původ požadavku.

Kontrola backendu ze složky `worker/`:

```bash
npm run check
```

Spouští kontrolu syntaxe a testy. Při poslední kontrole prošlo všech 15 testů; tím není ověřena funkčnost produkčních účtů a doručování e-mailů.

## Nasazení backendu

Poptávky a objednávky zpracovává Cloudflare Worker ve složce `worker/`. Ověřuje Turnstile, povolený původ požadavku, vstupy a přílohy. Resend odesílá interní zprávu a potvrzení zákazníkovi s referenčním číslem.

Konfigurace domény `forms.jami-tech.cz`, povolených originů a e-mailových adres je v [worker/wrangler.jsonc](worker/wrangler.jsonc). Při prvním nastavení je potřeba v účtech ověřit DNS domény, vytvořit Turnstile widget pro používané hostname a ověřit odesílací doménu v Resend.

Ze složky `worker/` při prvním nastavení:

```bash
npm install
npx wrangler login
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
```

Tajné hodnoty zadej do terminálu, neukládej je do repozitáře. Při dalších nasazeních není potřeba klíče znovu zadávat, pokud se nezměnily.

Nasazení Workeru ze složky `worker/`:

```bash
npm run deploy
```

Statický web se nasazuje samostatně prostřednictvím jeho hostingu. Nasazení Workeru samo nezveřejní změny HTML a JavaScriptu webu.

## Správa produktů a fotografií

Produktové údaje upravuj v [products.js](products.js) a ceny se stejnými ID také v [worker/src/products.js](worker/src/products.js). Ceny se ukládají v haléřích; server počítá částku z vlastního katalogu.

Lithophane má velikosti **120 × 90 mm za 489 Kč** a **160 × 120 mm za 789 Kč**. Obě ceny platí pro černý rámeček, černý se třpytkami a světle modrý. Změna barvy přepíná náhled; každá kombinace velikosti a barvy má vlastní ID.

Zákazník nahrává JPG, PNG nebo WebP. Limit jedné fotografie i součet fotografií v objednávce je 10 MB. Pro různé fotografie ve stejné kombinaci velikosti a barvy je zatím potřeba vytvořit samostatné objednávky.

### Produktové fotografie

Ukládej je do `pictures/produkty/`, ideálně v poměru 1:1, v rozlišení 1200 × 1200 px (minimum 800 × 800 px), ve formátu WebP, JPG nebo PNG a do 1 MB. V katalogu uprav cestu, skutečné rozměry a popis. Obdélníkové snímky se v kartách oříznou, proto ponech kolem produktu volný okraj.

Současné ilustrační náhledy Lithophane vytvořené pomocí ImageGen jsou v `pictures/produkty/lithophane/cerna.jpg`, `cerna-trpytky.jpg` a `svetle-modra.jpg`.

### Lithophane na hlavní stránce

Do `pictures/lithophane/01.webp` vlož skutečnou fotografii, ideálně 1200 × 1200 px. V [index.html](index.html) v sekci `#lithophane` odkomentuj připravený obrázek uvnitř `.lithophane-image` a uprav jeho alternativní text a rozměry.

### Portfolio

Fotografie ukládej do `pictures/portfolio/` a přidej do `index.html`. Doporučený poměr je 1:1, rozlišení 1200 × 1200 px, formát JPG/JPEG a velikost do 1 MB. Používej názvy bez mezer, například `03.jpeg`. U každé realizace uveď konkrétní alternativní popis; do portfolia přidávej zákaznické podklady pouze s odpovídajícím svolením.

## Další rozvoj

- Přidat více skutečných fotografií produktů a popisy realizací včetně materiálu.
- Přidat reference zákazníků s jejich svolením.
- Umožnit více různých fotografií pro stejnou variantu Lithophane v jedné objednávce.
- Doplnit automatické odstranění neodeslaných fotografií z prohlížeče po stanovené době.

## Průběžná údržba

Pravidelně zálohuj projekt, aktualizuj závislosti a ověřuj doručování formulářů. Před nasazením kontroluj změny v Gitu, spusť backendové testy a zkontroluj web na počítači i mobilu. Uchovávané zákaznické údaje a přílohy maž podle zásad ochrany osobních údajů.

## Struktura projektu

- `index.html`, `styles.css`, `script.js` — hlavní stránka, vzhled, navigace a portfolio.
- `eshop.html`, `eshop.js`, `products.js` — katalog, varianty produktů a košík.
- `objednavka.html`, `objednavka.js` — objednávkový formulář.
- `photo-upload.js` — validace a místní uložení fotografií v IndexedDB.
- `form-config.js` — veřejná konfigurace API a Turnstile.
- `worker/` — serverové zpracování formulářů, katalog cen a testy.
- `legal/` — obchodní podmínky, ochrana osobních údajů a vzor odstoupení.
- `pictures/` — logo, portfolio a produktové fotografie.
