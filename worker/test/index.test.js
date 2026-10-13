import assert from "node:assert/strict";
import { File } from "node:buffer";
import test from "node:test";
import worker from "../src/index.js";
import { buildOrder, buildQuote, generateReference, getCorsHeaders, matchesFileSignature, minimumDeadline, sendEmailWithRetry, validateOrderPhoto } from "../src/index.js";

test("vygeneruje referenci z českého data a náhodného identifikátoru", () => {
  const reference = generateReference("P", new Date("2026-09-15T12:00:00Z"), () => "a7c3f2b1-0000-4000-8000-000000000000");
  assert.equal(reference, "P-20260915-A7C3F2");
});

test("povolí pouze nakonfigurovaný origin", () => {
  assert.equal(getCorsHeaders("https://attacker.example", "https://jami-tech.cz"), null);
  const headers = getCorsHeaders("https://jami-tech.cz", "https://jami-tech.cz");
  assert.equal(headers["Access-Control-Allow-Origin"], "https://jami-tech.cz");
  assert.equal(headers["Access-Control-Max-Age"], "86400");
  assert.equal(headers["Content-Security-Policy"], "default-src 'none'; frame-ancestors 'none'");
  assert.equal(headers["X-Frame-Options"], "DENY");
});

test("kontroluje signatury podporovaných souborů", () => {
  assert.equal(matchesFileSignature("png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(matchesFileSignature("png", new TextEncoder().encode("not an image")), false);
  assert.equal(matchesFileSignature("step", new TextEncoder().encode("ISO-10303-21; HEADER;")), true);
  assert.equal(matchesFileSignature("obj", new TextEncoder().encode("v 0.0 1.0 2.0\nf 1 2 3")), true);
  assert.equal(matchesFileSignature("stl", new Uint8Array(84)), true);
  assert.equal(matchesFileSignature("stl", new Uint8Array(85)), false);
  assert.equal(matchesFileSignature("3mf", new TextEncoder().encode("PK\u0003\u0004[Content_Types].xml 3D/3dmodel.model")), true);
  assert.equal(matchesFileSignature("3mf", new TextEncoder().encode("PK\u0003\u0004ordinary.zip")), false);
});

test("sestaví bezpečný text poptávky", async () => {
  const data = new FormData();
  data.set("name", "Jan Novak");
  data.set("email", "jan@example.com");
  data.set("phone", "+420 123 456 789");
  data.set("quantity", "2");
  data.set("material", "PETG");
  data.set("deadline", "2026-10-01");
  data.set("message", "Drzak na miru");
  data.set("privacy", "on");
  const result = await buildQuote(data, "P-20260915-A7C3F2", new Date("2026-09-15T12:00:00Z"));
  assert.equal(result.subject, "[P-20260915-A7C3F2] Nová poptávka 3D tisku - Jan Novak");
  assert.match(result.text, /Číslo poptávky: P-20260915-A7C3F2/);
  assert.match(result.text, /Drzak na miru/);
  assert.deepEqual(result.attachments, []);
  assert.equal(result.idempotencyKey, "P-20260915-A7C3F2-internal");
  assert.equal(result.confirmation.to, "jan@example.com");
  assert.equal(result.confirmation.idempotencyKey, "P-20260915-A7C3F2-confirmation");
  assert.match(result.confirmation.subject, /Přijetí poptávky P-20260915-A7C3F2/);
  assert.match(result.confirmation.text, /Požadovaný termín: 2026-10-01/);
  assert.deepEqual(result.confirmation.attachments, []);
});

test("povolí termín nejdříve třetí den", async () => {
  assert.equal(minimumDeadline(new Date("2026-09-15T22:30:00Z")), "2026-09-19");
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "jan@example.com", deadline: "2026-09-17", message: "Test", privacy: "on" })) data.set(name, value);
  await assert.rejects(() => buildQuote(data, "P-TEST", new Date("2026-09-15T12:00:00Z")), /nejdříve za 3 dny/);
});

test("odmítne přílohu s podvrženou příponou", async () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "jan@example.com", message: "Test", privacy: "on" })) data.set(name, value);
  data.set("attachment", new File(["neni obrazek"], "model.png", { type: "image/png" }));
  await assert.rejects(() => buildQuote(data), /neodpovídá jejímu typu/);
});

test("odmítne neplatný e-mail objednávky", () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "spatne", phone: "123", delivery: "kuryr", payment: "prevod", address: "Test 1", cart: '[{"id":"3dlac-400ml","qty":1}]', terms_version: "v3.1", terms: "on" })) data.set(name, value);
  assert.throws(() => buildOrder(data), /platnou e-mailovou adresu/);
});

test("spočítá cenu objednávky na serveru", () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "jan@example.com", phone: "123", delivery: "kuryr", payment: "prevod", address: "Test 1", cart: '[{"id":"3dlac-400ml","qty":2}]', terms_version: "v3.1", terms: "on" })) data.set(name, value);
  const result = buildOrder(data);
  assert.match(result.subject, /527 Kč/);
  assert.match(result.text, /3DLAC: 2 ks/);
  assert.equal(result.confirmation.to, "jan@example.com");
  assert.match(result.confirmation.subject, /Přijetí objednávky O-/);
  assert.match(result.confirmation.text, /Celková cena: 527 Kč/);
  assert.deepEqual(result.confirmation.attachments, []);
});

test("odmítne neznámý produkt", () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "jan@example.com", phone: "123", delivery: "osobne", payment: "hotove", cart: '[{"id":"podvrh","qty":1}]', terms_version: "v3.1", terms: "on" })) data.set(name, value);
  assert.throws(() => buildOrder(data), /neplatnou položku/);
});

test("odmítne prázdný košík a neplatný souhlas", () => {
  const base = { name: "Jan", email: "jan@example.com", phone: "123", delivery: "osobne", payment: "hotove", terms_version: "v3.1", terms: "on" };
  const emptyCart = new FormData();
  for (const [name, value] of Object.entries({ ...base, cart: "[]" })) emptyCart.set(name, value);
  assert.throws(() => buildOrder(emptyCart), /Košík je prázdný/);

  const invalidConsent = new FormData();
  for (const [name, value] of Object.entries({ ...base, cart: '[{"id":"3dlac-400ml","qty":1}]', terms: "no" })) invalidConsent.set(name, value);
  assert.throws(() => buildOrder(invalidConsent), /Souhlas s obchodními podmínkami/);
});

test("zopakuje pouze dočasně odmítnutý e-mail", async () => {
  let attempts = 0;
  const temporaryFailure = async () => new Response(null, { status: ++attempts === 1 ? 503 : 200 });
  const recovered = await sendEmailWithRetry({}, {}, temporaryFailure);
  assert.equal(recovered.ok, true);
  assert.equal(attempts, 2);

  attempts = 0;
  const permanentFailure = async () => {
    attempts += 1;
    return new Response(null, { status: 400 });
  };
  const rejected = await sendEmailWithRetry({}, {}, permanentFailure);
  assert.equal(rejected.status, 400);
  assert.equal(attempts, 1);
});


test("endpoint odmítá chybějící token, cizí hostname a nesprávnou akci", async () => {
  const originalFetch = globalThis.fetch;
  const env = { ALLOWED_ORIGINS: "https://jami-tech.cz", EXPECTED_HOSTNAME: "jami-tech.cz,www.jami-tech.cz", TURNSTILE_SECRET_KEY: "test", RESEND_API_KEY: "test", MAIL_FROM: "test@example.com", MAIL_TO: "owner@example.com" };
  try {
    for (const verification of [null, { success: false }, { success: true, action: "order", hostname: "jami-tech.cz" }, { success: true, action: "quote", hostname: "attacker.example" }]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json(verification); };
      const data = new FormData();
      if (verification) data.set("cf-turnstile-response", "token");
      const response = await worker.fetch(new Request("https://forms.jami-tech.cz/quote", { method: "POST", headers: { Origin: "https://jami-tech.cz" }, body: data }), env);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).success, false);
      assert.equal(calls, verification ? 1 : 0);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("přijatá poptávka zůstává úspěšná při výpadku potvrzovacího e-mailu", async () => {
  const originalFetch = globalThis.fetch;
  const env = { ALLOWED_ORIGINS: "https://www.jami-tech.cz", EXPECTED_HOSTNAME: "jami-tech.cz,www.jami-tech.cz", TURNSTILE_SECRET_KEY: "test", RESEND_API_KEY: "test", MAIL_FROM: "test@example.com", MAIL_TO: "owner@example.com" };
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return Response.json({ success: true, action: "quote", hostname: "www.jami-tech.cz" });
      if (calls === 2) return Response.json({ id: "internal" });
      throw new Error("Network unavailable");
    };
    const data = new FormData();
    for (const [key, value] of Object.entries({ name: "Jan", email: "jan@example.com", message: "Test", privacy: "on", "cf-turnstile-response": "token" })) data.set(key, value);
    const response = await worker.fetch(new Request("https://forms.jami-tech.cz/quote", { method: "POST", headers: { Origin: "https://www.jami-tech.cz" }, body: data }), env);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.success, true);
    assert.equal(result.confirmationSent, false);
    assert.match(result.reference, /^P-/);
  } finally { globalThis.fetch = originalFetch; }
});


test("lithophane používá stanovené ceny a odmítá neznámé varianty", () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "Jan", email: "jan@example.com", phone: "123", delivery: "osobne", payment: "hotove", cart: '[{"id":"lithophane-120x90-cerna","qty":1,"priceCents":1}]', terms_version: "v3.1", terms: "on" })) data.set(key, value);
  assert.match(buildOrder(data).text, /Celková cena: 489 Kč/);
  data.set("cart", '[{"id":"lithophane-160x120-cerna","qty":1,"priceCents":1}]');
  assert.match(buildOrder(data).text, /Celková cena: 789 Kč/);
  data.set("cart", '[{"id":"lithophane-120x90-ruzova","qty":1}]');
  assert.throws(() => buildOrder(data), /neplatnou položku/);
});

test("fotografie objednávky přijímá jen obrazové formáty a kontroluje jejich obsah", async () => {
  const png = new File([new Uint8Array([137,80,78,71,13,10,26,10])], "foto.png");
  assert.equal((await validateOrderPhoto(png)).content_type, "image/png");
  const webp = new File([new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])], "foto.webp");
  assert.equal((await validateOrderPhoto(webp)).content_type, "image/webp");
  await assert.rejects(validateOrderPhoto(new File(["%PDF-1.0"], "foto.pdf")), /JPG, PNG nebo WebP/);
  await assert.rejects(validateOrderPhoto(new File(["není obrázek"], "foto.jpg")), /neodpovídá/);
  await assert.rejects(validateOrderPhoto(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "foto.png")), /větší než 10 MB/);
});

test("odmítne zděděné klíče dopravy a platby a duplicitní produkty", () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "Jan", email: "jan@example.com", phone: "123", delivery: "osobne", payment: "hotove", cart: '[{"id":"3dlac-400ml","qty":1}]', terms_version: "v3.1", terms: "on" })) data.set(key, value);
  for (const key of ["toString", "constructor", "__proto__"]) {
    data.set("payment", key);
    assert.throws(() => buildOrder(data), /Neplatný způsob/);
    data.set("payment", "hotove");
    data.set("delivery", key);
    assert.throws(() => buildOrder(data), /Neplatný způsob/);
    data.set("delivery", "osobne");
  }
  data.set("cart", '[{"id":"3dlac-400ml","qty":99},{"id":"3dlac-400ml","qty":99}]');
  assert.throws(() => buildOrder(data), /duplicitní/);
});

test("odmítne neexistující datum a neplatný počet kusů v poptávce", async () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "Jan", email: "jan@example.com", message: "Test", privacy: "on" })) data.set(key, value);
  for (const date of ["2026-99-99", "2027-02-30"]) {
    data.set("deadline", date);
    await assert.rejects(() => buildQuote(data), /platné datum/);
  }
  data.delete("deadline");
  for (const qty of ["0", "-1", "1.5", "Infinity"]) {
    data.set("quantity", qty);
    await assert.rejects(() => buildQuote(data), /kladné celé číslo/);
  }
});

test("limit velikosti požadavku platí i bez Content-Length a před ověřením tokenu", async () => {
  const env = { ALLOWED_ORIGINS: "https://jami-tech.cz", TURNSTILE_SECRET_KEY: "test", RESEND_API_KEY: "test", MAIL_FROM: "test", MAIL_TO: "test" };
  const tooLarge = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(10 * 1024 * 1024 + 128 * 1024 + 1));
    controller.close();
  } });
  const request = new Request("https://forms.jami-tech.cz/order", { method: "POST", headers: { Origin: "https://jami-tech.cz", "Content-Type": "multipart/form-data; boundary=test" }, body: tooLarge, duplex: "half" });
  assert.equal(request.headers.has("Content-Length"), false);
  assert.equal((await worker.fetch(request, env)).status, 413);
  const wrongType = new Request("https://forms.jami-tech.cz/order", { method: "POST", headers: { Origin: "https://jami-tech.cz", "Content-Type": "application/json" }, body: "{}" });
  assert.equal((await worker.fetch(wrongType, env)).status, 415);
});

test("objednávkový endpoint vyžaduje fotografii a předá ji jen internímu e-mailu", async () => {
  const originalFetch = globalThis.fetch;
  const emails = [];
  const env = { ALLOWED_ORIGINS: "https://jami-tech.cz", EXPECTED_HOSTNAME: "jami-tech.cz", TURNSTILE_SECRET_KEY: "test", RESEND_API_KEY: "test", MAIL_FROM: "test", MAIL_TO: "test" };
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("siteverify")) return Response.json({ success: true, action: "order", hostname: "jami-tech.cz" });
      emails.push(JSON.parse(options.body));
      return Response.json({ id: "test" });
    };
    const data = new FormData();
    for (const [key, value] of Object.entries({ name: "Jan", email: "jan@example.com", phone: "123", delivery: "osobne", payment: "hotove", cart: '[{"id":"lithophane-120x90-cerna","qty":1,"priceCents":1}]', terms_version: "v3.1", terms: "on", "cf-turnstile-response": "test" })) data.set(key, value);
    const request = () => new Request("https://forms.jami-tech.cz/order", { method: "POST", headers: { Origin: "https://jami-tech.cz" }, body: data });
    assert.equal((await worker.fetch(request(), env)).status, 400);
    assert.equal(emails.length, 0);
    data.set("photo-lithophane-120x90-cerna", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "foto.png"));
    const accepted = await worker.fetch(request(), env);
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).confirmationSent, true);
    assert.equal(emails.length, 2);
    assert.match(emails[0].subject, /489 Kč/);
    assert.equal(emails[0].attachments[0].filename, "lithophane-120x90-cerna-foto.png");
    assert.deepEqual(emails[1].attachments, []);
  } finally { globalThis.fetch = originalFetch; }
});
