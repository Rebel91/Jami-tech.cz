// Produkty e-shopu: upravuj pouze údaje v tomto souboru.
// Obrázky ukládej do pictures/produkty/ a cestu napiš do vlastnosti image.
const CATEGORIES = {
  vyrobky: "Výrobky z 3D tisku",
  prislusenstvi: "Příslušenství"
};

function formatPrice(priceCents) {
  const crowns = priceCents / 100;
  return `${crowns.toLocaleString("cs-CZ", {
    minimumFractionDigits: Number.isInteger(crowns) ? 0 : 2,
    maximumFractionDigits: 2
  })} Kč`;
}

const products = [
  {
    id: "3dlac-400ml",
    name: "3DLAC",
    description: "3DLAC je adhezní sprej, který zajišťuje pevné přilnutí první vrstvy k tiskové podložce a po vychladnutí snadné odejmutí hotového výtisku. Vhodný pro PLA, PETG, ABS a mnoho dalších materiálů na skleněné i jiné podložce.",
    priceCents: 19900,
    image: "pictures/produkty/01.webp",
    imageWidth: 810,
    imageHeight: 800,
    category: "prislusenstvi"
  },

  // Zkopíruj tento blok pro další produkt a uprav jeho údaje.
  // {
  //   id: "jedinecne-id-produktu",
  //   name: "Název produktu",
  //   description: "Krátký popis produktu.",
  //   priceCents: 29900,
  //   image: "pictures/produkty/02.webp",
  //   imageWidth: 1200,
  //   imageHeight: 1200,
  //   category: "vyrobky"
  // }
];
