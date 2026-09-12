# Jami tech

Statický web pro prezentaci firmy Jami tech, portfolio zakázkového 3D tisku, e-shop a poptávkový formulář.

## Spuštění

Na macOS lze web otevřít příkazem:

```bash
open index.html
```

Pro pohodlnější kontrolu změn použij ve VS Code **Live Server**.

## Portfolio

Fotografie realizací patří do `pictures/portfolio/`.

Doporučené parametry:

- poměr stran `1:1`
- ideální velikost `1200 × 1200 px`
- minimum `800 × 800 px`
- formát `.jpg` nebo `.jpeg`
- velikost souboru do `1 MB`

Používej jednoduché názvy bez mezer, například `03.jpeg`, a přidej obrázek také do `index.html`:

```html
<img src="pictures/portfolio/03.jpeg" alt="Ukázka realizace">
```

Portfolio zobrazuje fotografie ve čtvercových kartách. Obdélníkové fotografie se automaticky oříznou, proto nechávej hlavní motiv uprostřed a důležité detaily dál od okrajů.

## Fotografie do e-shopu

Produktové fotografie patří do složky `pictures/produkty/`.

Doporučené parametry:

- poměr stran `1:1`
- ideální velikost `1200 × 1200 px`
- minimum `800 × 800 px`
- formát `.webp`, `.jpg`, `.jpeg` nebo `.png`
- velikost souboru do `1 MB`

Fotografii připoj k produktu v `products.js`:

```js
{
	id: "jedinecne-id-produktu",
	name: "Název produktu",
	description: "Krátký popis produktu.",
	priceCents: 29900,
	image: "pictures/produkty/02.webp",
	imageWidth: 1200,
	imageHeight: 1200,
	category: "vyrobky"
}
```

E-shop zobrazuje produktové fotografie ve čtvercových kartách a obdélníkové obrázky automaticky ořízne. Produkt proto fotografuj uprostřed a nech kolem něj volný okraj.

## Budoucí zkvalitnění služeb a bezpečnosti

### Zkvalitnění služeb

1. Přidat ke každému produktu více fotografií, přesné rozměry, materiál, barvu, dobu výroby a aktuální dostupnost.
2. Doplnit k produktům jasné informace o dopravě, platbě, reklamaci a vrácení zboží.
3. Rozšířit poptávkový formulář o možnost nahrát model nebo fotografii a přidat automatické potvrzení přijetí poptávky.
4. Přidat reference zákazníků a u realizací uvést krátký popis zadání a použitého materiálu.
5. Zkontrolovat web na mobilu, zlepšit kontrast a doplnit popisné `alt` texty ke všem důležitým obrázkům.
6. Zmenšovat fotografie do moderního formátu WebP nebo AVIF a pravidelně kontrolovat rychlost načítání.

### Bezpečnost

1. Pravidelně zálohovat celý repozitář, fotografie a konfiguraci formuláře.
2. Omezit formulář proti spamu pomocí honeypotu nebo CAPTCHA, validace vstupů a limitu počtu odeslání.
3. Nikdy nevkládat hesla, tajné API klíče ani osobní údaje přímo do veřejného HTML nebo JavaScriptu.
4. Nastavit na hostingu bezpečnostní hlavičky, zejména Content-Security-Policy, X-Content-Type-Options a Referrer-Policy.
5. Pravidelně aktualizovat externí skripty a kontrolovat odkazy, formuláře a doménu přes HTTPS.
6. Ověřit, že se osobní údaje z formulářů ukládají a mažou podle zásad ochrany osobních údajů.
7. Před každým nasazením zkontrolovat změny v Gitu, otestovat formuláře a ověřit web v běžném i mobilním prohlížeči.

## Struktura

- `index.html` - hlavní stránka a portfolio
- `styles.css` - vzhled a responzivní rozložení
- `script.js` - navigace, pohyb portfolia a náhled fotografií
- `eshop.html` a `eshop.js` - e-shop, filtrování a košík
- `products.js` - data produktů
- `objednavka.html` a `objednavka.js` - objednávkový formulář
- `pictures/` - logo, produktové fotografie a portfolio
- `legal/` - právní informace
