import { yamlQuote } from "./util.js";

function dumpYamlValue(value, indent) {
  const pad = "  ".repeat(indent);
  if (value == null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return yamlQuote(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value.map((item) => `\n${pad}- ${dumpYamlValue(item, indent + 1).replace(/^\n/, "")}`).join("");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return keys.map((key) => {
      const dumped = dumpYamlValue(value[key], indent + 1);
      const nested = typeof value[key] === "object" && value[key] !== null;
      if (nested) return `\n${pad}${key}:${dumped.startsWith("\n") ? dumped : ` ${dumped}`}`;
      return `\n${pad}${key}: ${dumped}`;
    }).join("");
  }
  return yamlQuote(String(value));
}

export function dumpYaml(data) {
  return Object.keys(data).map((key) => {
    const value = data[key];
    const dumped = dumpYamlValue(value, 1);
    if (typeof value === "object" && value !== null && dumped.startsWith("\n")) {
      return `${key}:${dumped}`;
    }
    return `${key}: ${dumped}`;
  }).join("\n") + "\n";
}

export function buildWritingMarkdown({ title, date, cover, externalUrl, kind, body, external }) {
  const lines = ["---", `title: ${yamlQuote(title)}`, `date: ${date}`];
  if (cover) lines.push(`cover: ${yamlQuote(cover)}`);
  if (external || kind === "social") lines.push(`externalUrl: ${yamlQuote(externalUrl || "")}`);
  lines.push("---");
  const text = String(body || "").replace(/\s+$/, "");
  return `${lines.join("\n")}\n${text ? `\n${text}\n` : ""}`;
}

export function isXUrl(url) {
  return /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/\S+$/i.test(String(url || "").trim());
}

export function parseFrontMatter(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n");
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const close = raw.indexOf("\n---", 3);
  if (close === -1) return { meta: {}, body: raw };
  const meta = {};
  raw.slice(4, close).split("\n").forEach((line) => {
    if (!line.includes(":")) return;
    const index = line.indexOf(":");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) meta[key] = value;
  });
  return { meta, body: raw.slice(close + 4).replace(/^\n/, "") };
}

export function setYamlScalar(text, key, value) {
  const raw = String(text || "");
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:\\s*.*$`, "m");
  if (re.test(raw)) return raw.replace(re, line);
  if (raw.startsWith("---\n")) return raw.replace("---\n", `---\n${line}\n`);
  return raw;
}

export function isExternalKind(types, kind) {
  const match = (types || []).find((item) => item && item.id === kind);
  if (match && match.mode) return match.mode === "external";
  return kind === "social";
}

export function youtubeIdFromUrl(url) {
  const value = String(url || "").trim();
  const match = /(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/.exec(value);
  return match ? match[1] : "";
}

export function buildVideoMarkdown({ titleEn, titleTr, date, youtubeUrl }) {
  const youtubeId = youtubeIdFromUrl(youtubeUrl);
  const title = titleEn || titleTr;
  return [
    "---",
    `title: ${yamlQuote(title)}`,
    `title_tr: ${yamlQuote(titleTr)}`,
    `title_en: ${yamlQuote(titleEn)}`,
    `date: ${date}`,
    `youtubeId: ${yamlQuote(youtubeId)}`,
    `youtubeUrl: ${yamlQuote(youtubeUrl)}`,
    "---",
    ""
  ].join("\n");
}

export function buildProjectMarkdown(data) {
  return `---\n${dumpYaml(data)}---\n`;
}

export function projectJsonItem(data) {
  const item = {
    id: data.id,
    name: data.name,
    status: data.status
  };
  if (data.role) item.role = data.role;
  if (data.former_name) item.formerName = data.former_name;
  if (data.logo) item.logo = data.logo;
  if (data.summary) item.summary = data.summary;
  if (data.links) item.links = data.links;
  if (data.referral_url) item.referralUrl = data.referral_url;
  if (data.referral_code) item.referralCode = data.referral_code;
  return item;
}
