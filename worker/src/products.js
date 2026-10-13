// null blokuje objednání varianty do doplnění ceny v haléřích.
const LITHOPHANE_PRICES = { "120x90": 48900, "160x120": 78900 };
const LITHOPHANE_COLORS = { cerna: "Černá", "cerna-trpytky": "Černá se třpytkami", "svetle-modra": "Světle modrá" };
const lithophaneVariants = Object.fromEntries(Object.entries(LITHOPHANE_PRICES).flatMap(([size, priceCents]) =>
  Object.entries(LITHOPHANE_COLORS).map(([color, label]) => [`lithophane-${size}-${color}`, Object.freeze({
    name: `Obrázek Lithophane — ${size.replace("x", " × ")} mm, ${label}`, priceCents, requiresPhoto: true
  })])
));

export const PRODUCTS = Object.freeze({
  ...lithophaneVariants,
  "3dlac-400ml": Object.freeze({
    name: "3DLAC",
    priceCents: 19900
  })
});

export const DELIVERY = Object.freeze({
  kuryr: Object.freeze({ label: "Kurýrem na adresu (129 Kč)", priceCents: 12900 }),
  osobne: Object.freeze({ label: "Osobní odběr (0 Kč)", priceCents: 0 })
});

export const PAYMENT = Object.freeze({
  prevod: "Bankovní převod",
  qr: "QR kód",
  dobirka: "Dobírka kurýrovi",
  hotove: "Hotově při osobním převzetí"
});
