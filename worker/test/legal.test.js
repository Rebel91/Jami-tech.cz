import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { expectedFiles } from "../../scripts/sync-legal.mjs";
import { buildOrder } from "../src/index.js";
import { TERMS_VERSION } from "../src/legal-documents.js";

const order = (version = TERMS_VERSION) => {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    name: "Zkušební zákazník", email: "test@example.com", phone: "123",
    delivery: "osobne", payment: "hotove", note: "Předem zavolat",
    cart: '[{"id":"3dlac-400ml","qty":1}]', terms: "on", terms_version: version
  })) data.set(name, value);
  return data;
};

test("přílohy obsahují celé podmínky a formulář ve stejné podobě jako web", () => {
  for (const [path, expected] of expectedFiles()) {
    assert.equal(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"), expected);
  }
  const result = buildOrder(order(), "O-TEST");
  assert.equal(result.confirmation.attachments.length, 2);
  assert.deepEqual(result.attachments, result.confirmation.attachments);
  const [terms, form] = result.confirmation.attachments.map((item) => Buffer.from(item.content, "base64").toString("utf8"));
  for (const phrase of ["Michal Brodský", "Plátce DPH:</strong> ano", "6. Reklamace a vady", "7. Spory", TERMS_VERSION]) {
    assert.ok(terms.includes(phrase), phrase);
  }
  assert.match(form, /Podpis spotřebitele/);
  assert.match(form, /info@jami-tech.cz/);
  assert.doesNotMatch(terms, /<script|<link[^>]+stylesheet/);
  assert.match(result.confirmation.text, /Předem zavolat/);
  assert.match(result.confirmation.text, /nikoli uzavření smlouvy/);
});

test("stará verze souhlasu neprojde a úprava příloh jedné zprávy neovlivní další", () => {
  assert.throws(() => buildOrder(order("v3.1")), /Verze obchodních podmínek není aktuální/);
  const first = buildOrder(order(), "O-1");
  first.confirmation.attachments[0].content = "changed";
  const second = buildOrder(order(), "O-2");
  assert.notEqual(second.confirmation.attachments[0].content, "changed");
  assert.notEqual(first.attachments[0].content, "changed");
});
