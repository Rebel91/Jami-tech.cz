import { DELIVERY, PAYMENT, PRODUCTS } from "./products.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
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
      if (contentLength > MAX_ATTACHMENT_SIZE + 128 * 1024) {
        return json({ success: false, message: "Požadavek je příliš velký." }, 413, corsHeaders);
      }

      const formData = await request.formData();
      if (text(formData, "botcheck")) return json({ success: true }, 200, corsHeaders);

      const turnstile = await verifyTurnstile(
        text(formData, "cf-turnstile-response"),
        request.headers.get("CF-Connecting-IP"),
        env.TURNSTILE_SECRET_KEY
      );
      if (!turnstile.success
        || turnstile.action !== pathname.slice(1)
        || turnstile.hostname !== env.EXPECTED_HOSTNAME) {
        return json({ success: false, message: "Ověření proti spamu selhalo. Obnovte stránku a zkuste to znovu." }, 400, corsHeaders);
      }

      const payload = pathname === "/quote"
        ? await buildQuote(formData)
        : buildOrder(formData);
      const emailResponse = await sendEmail(payload, env);

      if (!emailResponse.ok) {
        console.error("Resend failed", emailResponse.status, await emailResponse.text());
        return json({ success: false, message: "E-mail se nepodařilo odeslat." }, 502, corsHeaders);
      }

      return json({ success: true }, 200, corsHeaders);
    } catch (error) {
      if (error instanceof FormError) return json({ success: false, message: error.message }, error.status, corsHeaders);
      console.error("Form submission failed", error);
      return json({ success: false, message: "Poptávku se nepodařilo zpracovat." }, 500, corsHeaders);
    }
  }
};

export async function buildQuote(formData) {
  const fields = readFields(formData, ["name", "email", "phone", "quantity", "material", "deadline", "message", "privacy"]);
  requireFields(fields, ["name", "email", "message", "privacy"]);
  validateEmail(fields.email);
  const attachment = formData.get("attachment");
  const attachments = attachment instanceof File && attachment.size > 0
    ? [await validateAttachment(attachment)]
    : [];

  return {
    subject: `Nová poptávka 3D tisku - ${fields.name}`,
    replyTo: fields.email,
    text: [
      "Nová poptávka 3D tisku", "",
      `Jméno: ${fields.name}`,
      `E-mail: ${fields.email}`,
      `Telefon: ${fields.phone || "-"}`,
      `Počet kusů: ${fields.quantity || "-"}`,
      `Materiál: ${fields.material || "-"}`,
      `Požadovaný termín: ${fields.deadline || "-"}`, "",
      "Popis:", fields.message
    ].join("\n"),
    attachments
  };
}

export function buildOrder(formData) {
  const fields = readFields(formData, ["name", "email", "phone", "delivery", "payment", "address", "note", "cart", "terms_version", "terms"]);
  requireFields(fields, ["name", "email", "phone", "delivery", "payment", "cart", "terms_version", "terms"]);
  validateEmail(fields.email);
  const delivery = DELIVERY[fields.delivery];
  const payment = PAYMENT[fields.payment];
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
    subject: `Nová objednávka z e-shopu - ${fields.name} (${total})`,
    replyTo: fields.email,
    text: [
      "Nová objednávka z e-shopu", "",
      "Objednané položky:", ...items, "",
      `Doprava: ${delivery.label}`,
      `Platba: ${payment}`,
      `Celková cena: ${total}`,
      `Adresa: ${fields.address || "Osobní odběr"}`,
      `Poznámka: ${fields.note || "-"}`,
      `Obchodní podmínky: potvrzeno (${fields.terms_version})`, "",
      `Jméno: ${fields.name}`,
      `E-mail: ${fields.email}`,
      `Telefon: ${fields.phone}`
    ].join("\n"),
    attachments: []
  };
}

function parseCart(value) {
  let cart;
  try {
    cart = JSON.parse(value);
  } catch {
    throw new FormError("Košík má neplatný formát.");
  }
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 50) throw new FormError("Košík je prázdný nebo příliš velký.");

  return cart.map((item) => {
    const product = item && PRODUCTS[item.id];
    const qty = Number(item?.qty);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99) throw new FormError("Košík obsahuje neplatnou položku.");
    return { product, qty };
  });
}

function formatPrice(priceCents) {
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(priceCents / 100)} Kč`;
}

async function validateAttachment(file) {
  if (file.size > MAX_ATTACHMENT_SIZE) throw new FormError("Příloha je větší než 10 MB.", 413);
  const filename = sanitizeFilename(file.name);
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) throw new FormError("Tento typ přílohy není povolen.");

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
  if (extension === "pdf") return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (extension === "3mf") return startsWith(0x50, 0x4b, 0x03, 0x04);
  if (extension === "stl") return bytes.length >= 84 || decodePrefix(bytes).trimStart().toLowerCase().startsWith("solid");
  if (extension === "step" || extension === "stp") return decodePrefix(bytes).includes("ISO-10303-21");
  if (extension === "obj") return /(^|\n)\s*(v|vt|vn|f|o|g)\s+/m.test(decodePrefix(bytes));
  return false;
}

function decodePrefix(bytes) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096));
}

function contentTypeFor(extension) {
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf", "3mf": "application/vnd.ms-package.3dmanufacturing-3dmodel+xml", stl: "model/stl", obj: "model/obj", step: "model/step", stp: "model/step" })[extension];
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

function text(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
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
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.MAIL_TO],
      reply_to: payload.replyTo,
      subject: payload.subject,
      text: payload.text,
      attachments: payload.attachments
    })
  });
}

export function getCorsHeaders(origin, configuredOrigins = "") {
  const allowed = configuredOrigins.split(",").map((item) => item.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    ...JSON_HEADERS,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
