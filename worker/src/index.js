import { DELIVERY, PAYMENT, PRODUCTS } from "./products.js";
import { TERMS_VERSION, getLegalAttachments } from "./legal-documents.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_ATTACHMENT_SIZE + 128 * 1024;
const ALLOWED_EXTENSIONS = new Set(["stl", "step", "stp", "obj", "3mf", "jpg", "jpeg", "png", "pdf"]);
const FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  quantity: 8,
  material: 80,
  deadline: 20,
  message: 5000,
  delivery: 20,
  payment: 20,
  address: 300,
  note: 2000,
  cart: 10000,
  terms_version: 40,
  privacy: 10,
  terms: 10
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = getCorsHeaders(origin, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      if (!corsHeaders) return json({ success: false, message: "Origin není povolen." }, 403);
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") return json({ success: false, message: "Metoda není povolena." }, 405, corsHeaders);
    if (!corsHeaders) return json({ success: false, message: "Origin není povolen." }, 403);
    if (!env.TURNSTILE_SECRET_KEY || !env.RESEND_API_KEY || !env.MAIL_FROM || !env.MAIL_TO) {
      return json({ success: false, message: "Backend není nakonfigurován." }, 503, corsHeaders);
    }

    const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
    if (pathname !== "/quote" && pathname !== "/order") {
      return json({ success: false, message: "Endpoint neexistuje." }, 404, corsHeaders);
    }

    try {
      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > MAX_REQUEST_SIZE) {
        return json({ success: false, message: "Požadavek je příliš velký." }, 413, corsHeaders);
      }

      const formData = await readFormData(request);
      if (text(formData, "botcheck")) return json({ success: false, message: "Ověření proti spamu selhalo." }, 400, corsHeaders);

      const turnstile = await verifyTurnstile(
        text(formData, "cf-turnstile-response"),
        request.headers.get("CF-Connecting-IP"),
        env.TURNSTILE_SECRET_KEY
      );
      if (!turnstile.success
        || turnstile.action !== pathname.slice(1)
        || !env.EXPECTED_HOSTNAME.split(",").map((host) => host.trim()).includes(turnstile.hostname)) {
        return json({ success: false, message: "Ověření proti spamu selhalo. Obnovte stránku a zkuste to znovu." }, 400, corsHeaders);
      }

      const reference = generateReference(pathname === "/quote" ? "P" : "O");
      const payload = pathname === "/quote"
        ? await buildQuote(formData, reference)
        : buildOrder(formData, reference);
      if (pathname === "/order") {
        const cart = parseCart(text(formData, "cart"));
        let photoBytes = 0;
        for (const { product, id } of cart) {
          if (!product.requiresPhoto) continue;
          const photo = formData.get(`photo-${id}`);
          if (!(photo instanceof File) || !photo.size) throw new FormError(`Nahrajte fotografii pro ${product.name}.`);
          photoBytes += photo.size;
          if (photoBytes > MAX_ATTACHMENT_SIZE) throw new FormError("Fotografie v objednávce mohou mít dohromady nejvýše 10 MB.", 413);
          const attachment = await validateOrderPhoto(photo);
          attachment.filename = `${id}-${attachment.filename}`;
          payload.attachments.push(attachment);
        }
      }
      const emailResponse = await sendEmailWithRetry(payload, env);

      if (!emailResponse.ok) {
        console.error("Resend failed", emailResponse.status);
        return json({ success: false, message: "E-mail se nepodařilo odeslat." }, 502, corsHeaders);
      }

      let confirmationSent = false;
      try {
        const confirmationResponse = await sendEmailWithRetry(payload.confirmation, env);
        confirmationSent = confirmationResponse.ok;
        if (!confirmationSent) console.error("Resend confirmation failed", confirmationResponse.status);
      } catch {
        // Interní zpráva už byla přijata: klient nesmí opakovat objednávku.
        console.error("Resend confirmation unavailable");
      }

      return json({ success: true, reference, confirmationSent }, 200, corsHeaders);
    } catch (error) {
      if (error instanceof FormError) return json({ success: false, message: error.message }, error.status, corsHeaders);
      console.error("Form submission failed", error);
      return json({ success: false, message: "Požadavek se nepodařilo zpracovat." }, 500, corsHeaders);
    }
  }
};

export async function buildQuote(formData, reference = generateReference("P"), now = new Date()) {
  const fields = readFields(formData, ["name", "email", "phone", "quantity", "material", "deadline", "message", "privacy"]);
  requireFields(fields, ["name", "email", "message", "privacy"]);
  validateEmail(fields.email);
  validateConsent(fields.privacy, "Seznámení se zásadami ochrany osobních údajů nebylo potvrzeno.");
  validateDeadline(fields.deadline, now);
  if (fields.quantity && (!/^\d+$/.test(fields.quantity) || Number(fields.quantity) < 1)) {
    throw new FormError("Počet kusů musí být kladné celé číslo.");
  }
  const attachment = formData.get("attachment");
  const attachments = attachment instanceof File && attachment.size > 0
    ? [await validateAttachment(attachment)]
    : [];

  return {
    idempotencyKey: `${reference}-internal`,
    subject: `[${reference}] Nová poptávka 3D tisku - ${fields.name}`,
    replyTo: fields.email,
    text: [
      "Nová poptávka 3D tisku",
      `Číslo poptávky: ${reference}`, "",
      `Jméno: ${fields.name}`,
      `E-mail: ${fields.email}`,
      `Telefon: ${fields.phone || "-"}`,
      `Počet kusů: ${fields.quantity || "-"}`,
      `Materiál: ${fields.material || "-"}`,
      `Požadovaný termín: ${fields.deadline || "-"}`, "",
      "Popis:", fields.message
    ].join("\n"),
    attachments,
    confirmation: {
      idempotencyKey: `${reference}-confirmation`,
      to: fields.email,
      replyTo: null,
      subject: `Přijetí poptávky ${reference} | Jami tech`,
      text: [
        `Dobrý den, ${fields.name},`, "",
        "děkujeme za vaši poptávku. Úspěšně jsme ji přijali a brzy se vám ozveme.",
        `Číslo poptávky: ${reference}`, "",
        `Počet kusů: ${fields.quantity || "-"}`,
        `Materiál: ${fields.material || "-"}`,
        `Požadovaný termín: ${fields.deadline || "-"}`, "",
        "Popis:", fields.message, "",
        "S pozdravem",
        "Jami tech"
      ].join("\n"),
      attachments: []
    }
  };
}

export function buildOrder(formData, reference = generateReference("O")) {
  const fields = readFields(formData, ["name", "email", "phone", "delivery", "payment", "address", "note", "cart", "terms_version", "terms"]);
  requireFields(fields, ["name", "email", "phone", "delivery", "payment", "cart", "terms_version", "terms"]);
  validateEmail(fields.email);
  validateConsent(fields.terms, "Souhlas s obchodními podmínkami nebyl potvrzen.");
  if (fields.terms_version !== TERMS_VERSION) throw new FormError("Verze obchodních podmínek není aktuální. Obnovte stránku.");
  const delivery = Object.hasOwn(DELIVERY, fields.delivery) ? DELIVERY[fields.delivery] : null;
  const payment = Object.hasOwn(PAYMENT, fields.payment) ? PAYMENT[fields.payment] : null;
  if (!delivery || !payment) throw new FormError("Neplatný způsob dopravy nebo platby.");
  if (fields.delivery === "kuryr" && !fields.address) throw new FormError("Vyplňte adresu doručení.");
  if ((fields.payment === "dobirka" && fields.delivery !== "kuryr")
    || (fields.payment === "hotove" && fields.delivery !== "osobne")) {
    throw new FormError("Zvolená platba neodpovídá způsobu dopravy.");
  }

  const cart = parseCart(fields.cart);
  const items = cart.map(({ product, qty }) => `- ${product.name}: ${qty} ks (${formatPrice(product.priceCents)} / ks)`);
  const productTotal = cart.reduce((sum, { product, qty }) => sum + (product.priceCents * qty), 0);
  const total = formatPrice(productTotal + delivery.priceCents);

  return {
    idempotencyKey: `${reference}-internal`,
    subject: `[${reference}] Nová objednávka z e-shopu - ${fields.name} (${total})`,
    replyTo: fields.email,
    text: [
      "Nová objednávka z e-shopu",
      `Číslo objednávky: ${reference}`, "",
      "Objednané položky:", ...items, "",
      `Doprava: ${delivery.label}`,
      `Platba: ${payment}`,
      `Celková cena včetně DPH a dopravy: ${total}`,
      `Adresa: ${fields.address || "Osobní odběr"}`,
      `Poznámka: ${fields.note || "-"}`,
      `Obchodní podmínky: potvrzeno (${fields.terms_version})`, "",
      `Jméno: ${fields.name}`,
      `E-mail: ${fields.email}`,
      `Telefon: ${fields.phone}`
    ].join("\n"),
    attachments: getLegalAttachments(),
    confirmation: {
      idempotencyKey: `${reference}-confirmation`,
      to: fields.email,
      replyTo: null,
      subject: `Přijetí objednávky ${reference} | Jami tech`,
      text: [
        `Dobrý den, ${fields.name},`, "",
        "děkujeme za vaši objednávku. Úspěšně jsme ji přijali.",
        `Číslo objednávky: ${reference}`, "",
        "Objednané položky:", ...items, "",
        `Doprava: ${delivery.label}`,
        `Platba: ${payment}`,
        `Celková cena včetně DPH a dopravy: ${total}`,
        `Adresa: ${fields.address || "Osobní odběr"}`,
        `Poznámka k objednávce: ${fields.note || "-"}`,
        `Obchodní podmínky: ${TERMS_VERSION}`, "",
        "Tento automatický e-mail potvrzuje doručení objednávky, nikoli uzavření smlouvy. Smlouva vznikne až naším výslovným přijetím objednávky e-mailem.",
        "Po kontrole vám potvrdíme objednávku a termín dodání. Při platbě předem pošleme také platební údaje a splatnost.",
        "V přílohách máte úplné znění obchodních podmínek a vzor odstoupení. Uložte si je společně s tímto e-mailem. Přílohy HTML otevřete v běžném prohlížeči a můžete je vytisknout nebo uložit do PDF.",
        "U výrobku podle vlastní fotografie nebo individuálního zadání se neuplatní 14denní odstoupení bez důvodu; právo reklamovat vady zůstává zachováno.", "",
        "S pozdravem",
        "Michal Brodský – JaMi-Tech",
        "Krchlebská 107, 289 37 Loučeň",
        "info@jami-tech.cz | +420 723 164 610"
      ].join("\n"),
      attachments: getLegalAttachments()
    }
  };
}

export function generateReference(prefix, date = new Date(), createId = () => crypto.randomUUID()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const datePart = ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("");
  const randomPart = createId().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}

export function minimumDeadline(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day") + 3)).toISOString().slice(0, 10);
}

function validateDeadline(deadline, now) {
  if (!deadline) return;
  const parsed = new Date(`${deadline}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== deadline) {
    throw new FormError("Zadejte platné datum požadovaného termínu.");
  }
  if (deadline < minimumDeadline(now)) {
    throw new FormError("Požadovaný termín musí být nejdříve za 3 dny.");
  }
}

function parseCart(value) {
  let cart;
  try {
    cart = JSON.parse(value);
  } catch {
    throw new FormError("Košík má neplatný formát.");
  }
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 50) throw new FormError("Košík je prázdný nebo příliš velký.");

  const ids = new Set();
  return cart.map((item) => {
    const product = item && Object.hasOwn(PRODUCTS, item.id) ? PRODUCTS[item.id] : null;
    const qty = Number(item?.qty);
    if (product && !Number.isInteger(product.priceCents)) throw new FormError("Cena této varianty ještě není stanovená. Produkt zatím nelze objednat.");
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99) throw new FormError("Košík obsahuje neplatnou položku.");
    if (ids.has(item.id)) throw new FormError("Košík obsahuje duplicitní položku.");
    ids.add(item.id);
    return { product, qty, id: item.id };
  });
}

function formatPrice(priceCents) {
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(priceCents / 100)} Kč`;
}

export async function validateOrderPhoto(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(extension)) throw new FormError("Fotografie musí být JPG, PNG nebo WebP.");
  return validateAttachment(file, new Set(["jpg", "jpeg", "png", "webp"]));
}

async function validateAttachment(file, allowedExtensions = ALLOWED_EXTENSIONS) {
  if (file.size > MAX_ATTACHMENT_SIZE) throw new FormError("Příloha je větší než 10 MB.", 413);
  const filename = sanitizeFilename(file.name);
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !allowedExtensions.has(extension)) throw new FormError("Tento typ přílohy není povolen.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesFileSignature(extension, bytes)) throw new FormError("Obsah přílohy neodpovídá jejímu typu.");

  return {
    filename,
    content: bytesToBase64(bytes),
    content_type: contentTypeFor(extension)
  };
}

export function matchesFileSignature(extension, bytes) {
  const startsWith = (...values) => values.every((value, index) => bytes[index] === value);
  if (extension === "jpg" || extension === "jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (extension === "png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (extension === "webp") return startsWith(0x52, 0x49, 0x46, 0x46) && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (extension === "pdf") return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (extension === "3mf") {
    if (!startsWith(0x50, 0x4b, 0x03, 0x04)) return false;
    const archiveMetadata = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return archiveMetadata.includes("[Content_Types].xml") && /3D\/[^\0]*\.model/i.test(archiveMetadata);
  }
  if (extension === "stl") {
    const prefix = decodePrefix(bytes).trimStart().toLowerCase();
    if (prefix.startsWith("solid") && prefix.includes("facet")) return true;
    if (bytes.length < 84) return false;
    const triangleCount = new DataView(bytes.buffer, bytes.byteOffset + 80, 4).getUint32(0, true);
    return bytes.length === 84 + (triangleCount * 50);
  }
  if (extension === "step" || extension === "stp") return decodePrefix(bytes).includes("ISO-10303-21");
  if (extension === "obj") return /(^|\n)\s*(v|vt|vn|f|o|g)\s+/m.test(decodePrefix(bytes));
  return false;
}

function decodePrefix(bytes) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096));
}

function contentTypeFor(extension) {
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf", "3mf": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml", stl: "model/stl", obj: "model/obj", step: "model/step", stp: "model/step" })[extension];
}

function readFields(formData, names) {
  return Object.fromEntries(names.map((name) => {
    const value = text(formData, name);
    if (value.length > FIELD_LIMITS[name]) throw new FormError(`Pole ${name} je příliš dlouhé.`);
    return [name, value];
  }));
}

function requireFields(fields, required) {
  if (required.some((name) => !fields[name])) throw new FormError("Vyplňte všechna povinná pole.");
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FormError("Zadejte platnou e-mailovou adresu.");
}

function validateConsent(value, message) {
  if (value !== "on") throw new FormError(message);
}

function text(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function readFormData(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) && !/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType)) {
    throw new FormError("Nepodporovaný formát formuláře.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new FormError("Formulář je prázdný.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_SIZE) {
        await reader.cancel();
        throw new FormError("Požadavek je příliš velký.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return await new Response(new Blob(chunks), { headers: { "Content-Type": contentType } }).formData();
  } catch {
    throw new FormError("Formulář má neplatný formát.");
  }
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "attachment";
}

function bytesToBase64(bytes) {
  let result = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(result);
}

async function verifyTurnstile(token, ip, secret) {
  if (!token || token.length > 2048) return { success: false };
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip || undefined })
  });
  return response.json();
}

async function sendEmail(payload, env) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": payload.idempotencyKey
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [payload.to || env.MAIL_TO],
      reply_to: payload.replyTo || env.MAIL_TO,
      subject: payload.subject,
      text: payload.text,
      attachments: payload.attachments
    })
  });
}

export async function sendEmailWithRetry(payload, env, sender = sendEmail) {
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await sender(payload, env);
      if (response.ok || (response.status !== 429 && response.status < 500)) return response;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  return response;
}

export function getCorsHeaders(origin, configuredOrigins = "") {
  const allowed = configuredOrigins.split(",").map((item) => item.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    ...JSON_HEADERS,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...(extraHeaders || {}) } });
}

class FormError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
