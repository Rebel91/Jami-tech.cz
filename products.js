// Produkty e-shopu: upravuj pouze údaje v tomto souboru.
// Obrázky ukládej do pictures/produkty/ a cestu napiš do vlastnosti image.
const CATEGORIES = {
  vyrobky: "Výrobky z 3D tisku",
  prislusenstvi: "Příslušenství"
};

const products = [
  {
    id: "3dlac-400ml",
    name: "3DLAC",
    description: "3DLAC je adhezní sprej, který zajišťuje pevné přilnutí první vrstvy k tiskové podložce a po vychladnutí snadné odejmutí hotového výtisku. Vhodný pro PLA, PETG, ABS a mnoho dalších materiálů na skleněné i jiné podložce.",
    price: "199 Kč",
    image: "pictures/produkty/01.webp",
    category: "prislusenstvi"
  },

  // Zkopíruj tento blok pro další produkt a uprav jeho údaje.
  // {
  //   id: "jedinecne-id-produktu",
  //   name: "Název produktu",
  //   description: "Krátký popis produktu.",
  //   price: "299 Kč",
  //   image: "pictures/produkty/02.webp",
  //   category: "vyrobky"
  // }
];
