import assert from "node:assert/strict";
import { File } from "node:buffer";
import test from "node:test";
import { buildOrder, buildQuote, generateReference, getCorsHeaders, matchesFileSignature } from "../src/index.js";

test("vygeneruje referenci z českého data a náhodného identifikátoru", () => {
  const reference = generateReference("P", new Date("2026-09-15T12:00:00Z"), () => "a7c3f2b1-0000-4000-8000-000000000000");
  assert.equal(reference, "P-20260915-A7C3F2");
});

test("povolí pouze nakonfigurovaný origin", () => {
  assert.equal(getCorsHeaders("https://attacker.example", "https://jami-tech.cz"), null);
  assert.equal(getCorsHeaders("https://jami-tech.cz", "https://jami-tech.cz")["Access-Control-Allow-Origin"], "https://jami-tech.cz");
});

test("kontroluje signatury podporovaných souborů", () => {
  assert.equal(matchesFileSignature("png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(matchesFileSignature("png", new TextEncoder().encode("not an image")), false);
  assert.equal(matchesFileSignature("step", new TextEncoder().encode("ISO-10303-21; HEADER;")), true);
  assert.equal(matchesFileSignature("obj", new TextEncoder().encode("v 0.0 1.0 2.0\nf 1 2 3")), true);
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
  const result = await buildQuote(data, "P-20260915-A7C3F2");
  assert.equal(result.subject, "[P-20260915-A7C3F2] Nová poptávka 3D tisku - Jan Novak");
  assert.match(result.text, /Číslo poptávky: P-20260915-A7C3F2/);
  assert.match(result.text, /Drzak na miru/);
  assert.deepEqual(result.attachments, []);
});

test("odmítne přílohu s podvrženou příponou", async () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "jan@example.com", message: "Test", privacy: "on" })) data.set(name, value);
  data.set("attachment", new File(["neni obrazek"], "model.png", { type: "image/png" }));
  await assert.rejects(() => buildQuote(data), /neodpovídá jejímu typu/);
});

test("odmítne neplatný e-mail objednávky", () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "spatne", phone: "123", delivery: "kuryr", payment: "prevod", address: "Test 1", cart: '[{"id":"3dlac-400ml","qty":1}]', terms_version: "v3", terms: "on" })) data.set(name, value);
  assert.throws(() => buildOrder(data), /platnou e-mailovou adresu/);
});

test("spočítá cenu objednávky na serveru", () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "jan@example.com", phone: "123", delivery: "kuryr", payment: "prevod", address: "Test 1", cart: '[{"id":"3dlac-400ml","qty":2}]', terms_version: "v3", terms: "on" })) data.set(name, value);
  const result = buildOrder(data);
  assert.match(result.subject, /527 Kč/);
  assert.match(result.text, /3DLAC: 2 ks/);
});

test("odmítne neznámý produkt", () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ name: "Jan", email: "jan@example.com", phone: "123", delivery: "osobne", payment: "hotove", cart: '[{"id":"podvrh","qty":1}]', terms_version: "v3", terms: "on" })) data.set(name, value);
  assert.throws(() => buildOrder(data), /neplatnou položku/);
});
