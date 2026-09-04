export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const JSON_LIMIT = 1_000_000;
export const UPLOAD_LIMIT = 2_000_000;
export const CORE_TYPE_IDS = ["articles", "notes", "social"];
export const CONTACT_I18N_KEYS = [
  "title", "formTitle", "labelName", "labelEmail", "labelMessage",
  "placeholderName", "placeholderEmail", "placeholderMessage",
  "submit", "submitting", "success", "error", "mapTitle"
];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.ok = false;
  }
}

export function jsonOk(payload, status = 200) {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export function jsonErr(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function yamlQuote(value) {
  const text = String(value ?? "");
  if (text === "" || /[:#{}[\],&*?|<>=!%@`'"\\\n\s]/.test(text) || /^(true|false|null|yes|no)$/i.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}

export function normalizeDate(raw) {
  const value = String(raw || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (!eu) return "";
  const dd = eu[1].padStart(2, "0");
  const mm = eu[2].padStart(2, "0");
  return `${eu[3]}-${mm}-${dd}`;
}

export function isHttps(url) {
  return /^https:\/\/[^\s]+$/i.test(String(url || "").trim());
}

export function allowedLinkUrl(url) {
  const value = String(url || "").trim();
  return /^(https?:\/\/|\.\/|\.\.\/|#|mailto:|\/)/i.test(value);
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function textToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

export function sniffImageExt(bytes, filename = "", { allowSvg = false } = {}) {
  if (!bytes || bytes.length < 12) return "";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return ".png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ".jpg";
  const riff = String.fromCharCode(...bytes.subarray(0, 4));
  const webp = String.fromCharCode(...bytes.subarray(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return ".webp";
  if (allowSvg) {
    const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4000))).toLowerCase();
    const suffix = String(filename || "").toLowerCase();
    if ((suffix.endsWith(".svg") || head.includes("<svg")) && !head.includes("<script") && !head.includes("onload=")) {
      return ".svg";
    }
  }
  return "";
}

export function uniqueName(existing, stem, ext) {
  const base = slugify(stem) || "file";
  let name = `${base}${ext}`;
  let n = 2;
  const set = new Set(existing);
  while (set.has(name)) {
    name = `${base}-${n}${ext}`;
    n += 1;
    if (n > 200) throw new HttpError(409, "Could not allocate a unique filename");
  }
  return name;
}
