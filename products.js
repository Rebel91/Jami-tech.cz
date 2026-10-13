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

  {
    id: "lithophane",
    name: "Obrázek Lithophane",
    description: "Vaše fotografie v klasickém rámečku s moderním podsvícením. Osobní dárek, který rozzáří vzpomínky. O podsvícení se stará LED pásek s napájením 5 V přes USB-C.",
    image: "pictures/produkty/lithophane/cerna.jpg",
    imageWidth: 1200,
    imageHeight: 900,
    category: "vyrobky",
    sizes: ["120x90", "160x120"],
    // Ceny v haléřích doplňte také v worker/src/products.js. null = zatím nelze objednat.
    prices: { "120x90": 48900, "160x120": 78900 },
    colors: [
      { id: "cerna", label: "Černá", image: "pictures/produkty/lithophane/cerna.jpg" },
      { id: "cerna-trpytky", label: "Černá se třpytkami", image: "pictures/produkty/lithophane/cerna-trpytky.jpg" },
      { id: "svetle-modra", label: "Světle modrá", image: "pictures/produkty/lithophane/svetle-modra.jpg" }
    ]
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


function resolveProduct(id) {
  const direct = products.find((product) => product.id === id);
  if (direct) return direct;
  const base = products.find((product) => product.id === "lithophane");
  for (const size of base.sizes) {
    for (const color of base.colors) {
      if (id === `${base.id}-${size}-${color.id}`) {
        return { ...base, id, name: `${base.name} — ${size.replace("x", " × ")} mm, ${color.label}`, priceCents: base.prices[size], image: color.image, requiresPhoto: true };
      }
    }
  }
  return null;
}
