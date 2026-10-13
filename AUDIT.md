# Audit webu Jami tech — 13. 10. 2026

## Výsledek

Web byl prověřen ve zdrojových souborech, v Chromium a WebKit a pomocí omezených kontrol veřejného webu a API. Nalezené chyby kontrastu, validace, množství v košíku a některé nedostatky ochrany byly opraveny. Zbývající provozní, právní a obsahové úkoly jsou uvedeny níže a v README.

Výsledek není certifikací bezpečnosti ani úplné shody s WCAG. Audit nezkoušel zahlcení veřejného serveru, neodesílal skutečné poptávky, objednávky ani e-maily a neprověřoval soukromé účty nebo jejich nastavení.

## Rozsah a ověření

| Oblast | Kontrola | Výsledek |
| --- | --- | --- |
| Responzivní rozložení | 6 stránek × 10 šířek × 2 enginy = 120 kombinací | Bez přesahujících prvků, vodorovného přetékání a chyb JavaScriptu |
| Stránky | Hlavní stránka, e-shop, objednávka s položkami a všechny 3 právní stránky | Každá má jeden hlavní nadpis; místní odkazy a ID zkontrolovány |
| Šířky | 320, 375, 390, 520, 768, 850, 1024, 1280, 1440 a 1920 px | Zkontrolována hlavička, obsah, formuláře, karty a patička |
| Přístupnost | axe-core, Chromium, 6 stránek při 375 a 1440 px, pravidla WCAG A/AA | Po opravách bez automaticky zjištěných porušení v těchto 12 stavech |
| Grafika | Snímky mobilních a desktopových stránek, načtení obrázků | Bez chyb načtení; zbývající zástupné vizuály jsou uvedeny níže |
| Produkty | Chromium a WebKit: ceny, varianty, upload, košík, přechod k objednávce | 120 × 90 mm = 489 Kč, 160 × 120 mm = 789 Kč; cena a tlačítko dole v kartě |
| Formuláře | Mobilní menu, chybějící token, serverová chyba přílohy, simulované přijetí poptávky a objednávky | Odmítnutí bez tokenu, srozumitelná chyba, potvrzení a vyčištění košíku |
| Košík a soukromí | Extrémní množství, odstranění položky a místní fotografie | Množství omezeno na 99, fotografie odstraněna při odebrání varianty |
| Backend | `npm run check` | 19 testů prošlo |
| Závislosti | `npm audit` včetně vývojových balíčků | Po aktualizaci 0 hlášených zranitelností |
| Sestavení | `wrangler deploy --dry-run` | Úspěšné sestavení s Wrangler 4.150.0 |
| Veřejné API | OPTIONS s povoleným/cizím originem; POST bez tokenu | 204 / 403 / 400; žádná objednávka nebyla vytvořena |

Při kontrole obrázků bylo v testu vynuceno jejich načtení. První kontrola obrázků mimo obrazovku zaznamenala dosud nenačtenou lazy fotografii; po skutečném načtení se chyba nepotvrdila. Portfolio a zavřený boční košík mají záměrně prvky mimo viditelný prostor; nejsou považovány za přetékání obsahu.

## Opravy provedené při auditu

### Text a orientace

- Sjednoceno vykání v košíku, objednávce a platebních pokynech; opraveno „E-mail“ a zápis „e-shop“.
- Odstraněn neověřený příslib platby kartou kurýrovi; možnosti závisejí na skutečném dopravci.
- Poptávka i objednávka zobrazují konkrétní validační chybu místo obecného oznámení, takže zákazník ví, co opravit.
- Doplněno automatické vyplnění jména, telefonu, e-mailu a adresy v objednávce.
- Odstraněna duplicitní a rozporná meta informace robots u objednávky; stránka zůstává neindexovaná.
- Doplněn vzor odstoupení do sitemap a aktualizována data změn.
- Doplněna zpráva s kontaktem pro návštěvníky bez JavaScriptu.

### Rozložení, grafika a přístupnost

- Zachováno zvětšení popisu produktů na 14 px a zarovnání ceny a tlačítka na spodní okraj karty.
- Opraven kontrast kategorií produktů, malého nadpisu poptávky a aktivního odkazu v navigaci. Před opravou byly naměřeny poměry 1,87:1, 3,46:1 a 2,36:1; pro běžný text je potřeba alespoň 4,5:1 podle [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Doplněno viditelné klávesnicové zvýraznění produktového náhledu.
- Přidáno tlačítko pro trvalé pozastavení a opětovné spuštění automatického posunu portfolia. Při preferenci omezeného pohybu se automatický posun nepouští. Zastavení pouze při zaměření klávesnicí nestačí podle [WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).
- Duplicitní pás portfolia je neinteraktivní a skrytý před asistivními technologiemi.
- Odstraněno načítání nepoužívané rodiny DM Sans; pro používané Space Grotesk je zahrnuta i běžná váha 400.
- Zvýšeny verze změněných stylů a skriptů, aby se nepoužívala stará cache.

### Bezpečnost a funkčnost

- Doplněn skutečný limit čtení těla požadavku 10 MB + 128 KB; nelze ho obejít vynecháním Content-Length. Nepodporovaný formát dostane 415, nadlimitní požadavek 413.
- Doprava, platba a produkt se přijímají jen jako vlastní klíče povolených katalogů. Podvržené hodnoty typu `constructor` nebo `toString` se odmítají.
- Košík odmítá duplicitní ID a server nadále určuje cenu sám. Podvržená cena klienta nemění výpočet.
- Klient omezuje množství na celé číslo 0–99 a načítání uloženého košíku na 50 položek; neplatné položky typu null ignoruje. Server vyžaduje 1–99 kusů.
- Poptávka odmítá neexistující datum a nekladné či desetinné množství.
- Odstraněno logování celého těla chyby e-mailového poskytovatele.
- Blokované úložiště při mazání košíku nezmění přijatou objednávku na falešnou chybu; změny množství v objednávce při blokovaném ukládání zůstávají funkční v paměti stránky.
- Místní fotografie se maže i při odebrání příslušné varianty z košíku; tomu odpovídá aktualizovaný text zásad ochrany údajů.
- Aktualizován lockfile vývojových závislostí: původní audit hlásil 4 balíčky se závažností high (Wrangler, Miniflare, Sharp, Undici), nový audit hlásí 0. Nešlo o čtyři samostatné zranitelnosti produkčního Workeru; část hlášení byla přenášena přes závislosti.
- Doplněna CSP v HTML omezující skripty, spojení, rámce a další zdroje. Povoleny jsou používané služby a vlastní web. Pravidla pro Turnstile odpovídají [dokumentaci Cloudflare](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).
- V konfiguraci vypnuta veřejná adresa workers.dev; backend používá vlastní doménu forms.jami-tech.cz. To brání používání alternativní adresy mimo případná pravidla vlastní domény.

Při hledání běžných vzorů tajných klíčů nebyl ve zdrojových souborech nalezen odpovídající klíč. Veřejný Turnstile Site Key je záměrně veřejný; tajné hodnoty jsou předávány jako Worker secrets. Toto hledání nezahrnuje úplnou historii Gitu ani všechny možné formáty tajných údajů.

## Zbývající úkoly podle priority

### Vysoká priorita — před běžným prodejem

1. **Podnikatelské údaje:** právní dokumenty stále obsahují pracovní návrh a chybějící IČO, registraci, stav DPH a účinnost. Doplnit po registraci; nepovažovat návrhy za dokončenou právní dokumentaci.
2. **Produktové informace:** doplnit skutečný materiál, dostupnost, termín výroby/dodání, obsah balení, napájecí příslušenství a potřebné pokyny. Audit neověřoval vlastnosti fyzického výrobku ani jeho požadavky na uvedení na trh.
3. **Přijetí smlouvy a platba:** automatický e-mail je pouze potvrzením přijetí objednávky. Následně poslat výslovné přijetí objednávky, platné znění podmínek k uložení a platební údaje. Připravit reklamace, vracení zboží a evidenci dokladů.
4. **Uchování a mazání:** zavést skutečné mazání zákaznických příloh a e-mailů podle zásad. Mazání místní fotografie v prohlížeči neřeší serverové/e-mailové kopie. Potvrdit poskytovatele e-mailové schránky, zpracovatelské vztahy a mezinárodní předávání údajů.
5. **Rate limiting:** vlastní limit počtu odeslání v kódu není. Ověřit nebo nastavit pravidlo na vlastní doméně v Cloudflare. Turnstile a CORS nenahrazují omezení frekvence ani ochranu proti zahlcení.

### Střední priorita — bezpečnost a spolehlivost provozu

- **Hlavičky statického webu:** veřejná odpověď GitHub Pages měla HSTS, ale neměla HTTP CSP, X-Content-Type-Options ani ochranu proti vložení webu do cizího rámce. Nová CSP v HTML část ochrany doplňuje; `frame-ancestors` musí být nastaveno HTTP hlavičkou a meta CSP ho nenahrazuje. Nastavit hlavičky na hostingu nebo proxy podle [dokumentace CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy).
- **Odolnost objednávek:** nyní jsou předávány e-mailem, bez samostatné databáze objednávek. Při ztrátě odpovědi může zákazník opakovat přijatou objednávku. Resend idempotency key pokrývá opakování stejného e-mailu během jedné serverové operace, ne nové odeslání formuláře. Pro větší provoz zavést trvalou evidenci a identifikátor požadavku použitelný při opakování.
- **Doručování a obnova:** skutečné doručení e-mailů, SPF/DKIM/DMARC, přístupy k účtům, MFA, zálohy a jejich obnova nejsou tímto auditem ověřeny. Otestovat kontrolovaně v účtech provozovatele.
- **Přílohy:** kontrola přípony a signatury není antivirová kontrola ani úplné ověření obrazového či 3D formátu. Otevírat v aktualizovaných nástrojích; pro větší objem zakázek zvážit kontrolu příloh.

### Nižší priorita — obsah a vzhled

- Na hlavní stránce zůstává zástupný vizuál Lithophane; e-shop používá ilustrační AI náhledy. Nahradit skutečnými fotografiemi.
- Portfolio má jedinou skutečnou fotografii a několik prázdných zástupných karet. Doplnit realizace a konkrétní popisy nebo zástupné karty odstranit při úpravě obsahu.
- Se dvěma produkty zůstává desktopový katalog navržený pro čtyři sloupce vizuálně nevyužitý. Při rozšíření nabídky se zaplní; případnou změnu počtu sloupců provést jako vědomou úpravu designu.
- Doplnit skutečné reference se svolením zákazníků a případně sjednotit vyprávění „já/my“ v prezentačních textech.
- Fotografie v prohlížeči zatím nemají automatickou expiraci. Doplnit ji pro nedokončené nákupy; zásady tento stav nyní popisují.

## Omezení

Simulované šířky a dva prohlížečové enginy nenahrazují všechny skutečné telefony, čtečky obrazovky a situace uživatelů. Automatický axe výsledek se týká výchozích testovaných stavů, nikoli všech kombinací widgetů, dialogů a interakcí. Nebylo provedeno měření Core Web Vitals skutečných návštěvníků ani zátěžový test. Interní nastavení Cloudflare, Resend, e-mailové schránky a právní či technická shoda fyzických produktů zůstávají mimo ověřený rozsah.

Serverové ověřování Turnstile zůstává povinné; platnost a jednorázovost tokenů popisuje [Cloudflare Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Veřejný požadavek bez tokenu byl odmítnut, nikoli odeslán k vyřízení.
