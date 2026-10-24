import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// HTML stránek je jediný zdroj. Přílohy e-mailu jsou samostatné, bez externích stylů.
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const terms = read("legal/obchodni-podminky.html");
const version = terms.match(/<strong>Verze:<\/strong>\s*(v[\d.]+)/)?.[1];
if (!version) throw new Error("V obchodních podmínkách chybí verze.");

export function standalone(html, sourcePath) {
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  const body = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
  if (!title || !body) throw new Error(`Neúplný právní dokument: ${sourcePath}`);
  const content = body.replace(/<p class="legal-download">[\s\S]*?<\/p>/g, "")
    .replace(/href="([^"]+)"/g, (_, href) => `href="${new URL(href, `https://jami-tech.cz/${sourcePath}`).href}"`)
    .replace(/[ \t]+$/gm, "");
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font:16px/1.6 Arial,sans-serif;color:#26343a;max-width:850px;margin:40px auto;padding:0 24px}h1,h2{line-height:1.25;color:#173e4b}h1{font-size:30px}h2{font-size:21px;margin-top:30px}a{color:#086576}.eyebrow{font-size:13px;color:#61747b}@media print{body{margin:0;font-size:11pt}h2{break-after:avoid}a{color:inherit}}</style></head>
<body><main>${content}</main></body></html>\n`;
}

export function expectedFiles() {
  const specs = [
    ["obchodni-podminky", "Obchodni_podminky", terms],
    ["odstoupeni-od-smlouvy", "Formular_odstoupeni", read("legal/odstoupeni-od-smlouvy.html")]
  ];
  const files = new Map();
  const attachments = specs.map(([slug, filename, html]) => {
    const content = standalone(html, `legal/${slug}.html`);
    files.set(`legal/ke-stazeni/${slug}-${version}.html`, content);
    return { filename: `${filename}_${version}.html`, content: Buffer.from(content).toString("base64") };
  });
  files.set("worker/src/legal-documents.js", `// Generováno scripts/sync-legal.mjs; upravujte zdrojové HTML v legal/.\nexport const TERMS_VERSION = ${JSON.stringify(version)};\nconst attachments = ${JSON.stringify(attachments, null, 2)};\nexport const getLegalAttachments = () => attachments.map((attachment) => ({ ...attachment }));\n`);
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  for (const [path, content] of expectedFiles()) {
    if (check) {
      if (read(path) !== content) throw new Error(`Neaktuální příloha: ${path}. Spusťte npm run legal:sync ve worker/.`);
    } else {
      const url = new URL(path, root);
      mkdirSync(new URL(".", url), { recursive: true });
      writeFileSync(url, content);
    }
  }
  if (!read("objednavka.js").includes(`const TERMS_VERSION = "${version}";`)) {
    throw new Error("Verze podmínek v objednavka.js se neshoduje s právními dokumenty.");
  }
  console.log(check ? "Právní přílohy odpovídají webu." : "Právní přílohy byly obnoveny.");
}
