export const PRODUCTS = Object.freeze({
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
