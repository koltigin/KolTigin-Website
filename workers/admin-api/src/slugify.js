const SLUG_MAX_LEN = 72;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SUFFIX_RE = /^[a-z0-9]{8}$/;
const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

const TRANSLIT = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
  ß: "ss",
  ẞ: "ss"
};

function randomValues(length) {
  const bytes = new Uint8Array(length);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new Error("crypto.getRandomValues is required");
  }
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

export function slugify(value) {
  let text = String(value || "").replace(/[çÇğĞıİöÖşŞüÜßẞ]/g, (ch) => TRANSLIT[ch] || ch);
  text = text.normalize("NFKD").replace(/\p{M}/gu, "");
  text = text.toLowerCase();
  text = text.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (text.length <= SLUG_MAX_LEN) return text;
  let sliced = text.slice(0, SLUG_MAX_LEN);
  const nextCh = text.charAt(SLUG_MAX_LEN);
  if (/[a-z0-9]/.test(nextCh) && /[a-z0-9]/.test(sliced.charAt(sliced.length - 1)) && sliced.includes("-")) {
    sliced = sliced.slice(0, sliced.lastIndexOf("-"));
  }
  return sliced.replace(/-+$/g, "");
}

export function isValidSlug(value) {
  const text = String(value || "").trim();
  return Boolean(text) && SLUG_RE.test(text) && text.length <= SLUG_MAX_LEN;
}

export function resolvePersistedSlug(explicit, existing, title) {
  const requested = String(explicit || "").trim();
  if (requested) {
    if (!isValidSlug(requested)) throw new Error("Invalid slug");
    return requested;
  }
  const current = String(existing || "").trim();
  if (current) {
    if (!isValidSlug(current)) throw new Error("Invalid slug");
    return current;
  }
  const generated = slugify(title);
  if (!isValidSlug(generated)) throw new Error("Could not derive a slug from the title");
  return generated;
}

export function randomIdSuffix(length = 8) {
  const size = Number(length) || 0;
  if (size < 1) throw new Error("suffix length must be positive");
  const out = [];
  while (out.length < size) {
    const bytes = randomValues(size - out.length);
    for (const byte of bytes) {
      if (byte >= 252) continue;
      out.push(ALPHANUM[byte % 36]);
      if (out.length === size) break;
    }
  }
  return out.join("");
}

function isoDate(date) {
  const text = String(date || "").trim();
  const match = DATE_RE.exec(text);
  if (!match) throw new Error("date must be YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function requireSuffix(suffix) {
  const token = suffix == null ? randomIdSuffix() : String(suffix);
  if (!SUFFIX_RE.test(token)) {
    throw new Error("suffix must be 8 lowercase alphanumeric characters");
  }
  return token;
}

export function newWritingId(date, suffix) {
  return `${isoDate(date)}-${requireSuffix(suffix)}`;
}

export function newGuideId(date, suffix) {
  return `g-${isoDate(date).replaceAll("-", "")}-${requireSuffix(suffix)}`;
}
