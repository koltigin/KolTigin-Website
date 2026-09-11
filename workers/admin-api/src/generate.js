import { yamlQuote } from "./util.js";

export const SHARE_LANGS = ["en", "tr"];

export function writingShareArtifacts(kind, id) {
  const paths = [];
  for (const lang of SHARE_LANGS) {
    paths.push(`writings/${lang}/${kind}/${id}/index.html`);
    paths.push(`assets/images/og/writings/${lang}/${kind}/${id}.png`);
  }
  return paths;
}

export function guideShareArtifacts(id) {
  const paths = [];
  for (const lang of SHARE_LANGS) {
    const code = lang === "tr" ? "TR" : "EN";
    paths.push(`guides/${id}/${code}/index.html`);
    paths.push(`guide/${lang}/${id}/index.html`);
    paths.push(`assets/images/og/guides/${lang}/${id}.png`);
  }
  return paths;
}

export function pretty(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function upsertListed(list, name) {
  const current = list || [];
  if (current.includes(name)) return [...current];
  return [name, ...current];
}

export function removeListed(list, name) {
  return (list || []).filter((item) => item !== name);
}

export function applyWritingIndex(index, { kind, lang, file, remove, fromKind }) {
  const data = JSON.parse(JSON.stringify(index || {}));
  const ensure = (k) => {
    if (!data[k] || typeof data[k] !== "object" || Array.isArray(data[k])) {
      data[k] = { en: [], tr: [] };
    }
    data[k].en = data[k].en || [];
    data[k].tr = data[k].tr || [];
  };
  if (fromKind && fromKind !== kind) {
    ensure(fromKind);
    data[fromKind].en = removeListed(data[fromKind].en, file);
    data[fromKind].tr = removeListed(data[fromKind].tr, file);
  }
  ensure(kind);
  if (remove) {
    data[kind][lang] = removeListed(data[kind][lang], file);
  } else {
    data[kind][lang] = upsertListed(data[kind][lang], file);
  }
  return data;
}

export function applyVideoIndex(index, { file, remove }) {
  const data = JSON.parse(JSON.stringify(index || {}));
  data.videos = data.videos || [];
  data.videos = remove ? removeListed(data.videos, file) : upsertListed(data.videos, file);
  return data;
}

export function applyGuideIndex(index, { id, remove }) {
  const data = { guides: [...((index && index.guides) || [])] };
  if (remove) data.guides = data.guides.filter((item) => item !== id);
  else if (!data.guides.includes(id)) data.guides.unshift(id);
  return data;
}

export function isPersistedGuide(en, tr) {
  return Boolean(en || tr);
}

export function discoverGuides({ indexIds = [], markdownById = {} }) {
  return [...new Set(indexIds)].filter((id) => {
    const files = markdownById[id] || {};
    return isPersistedGuide(files.en, files.tr);
  });
}

function isGuideLink(link, guideId) {
  if (!link || typeof link !== "object") return false;
  if (String(link.guide || "") === guideId) return true;
  const url = String(link.url || "");
  if (url === `#/guides/${guideId}` || url.endsWith(`#/guides/${guideId}`)) return true;
  const escaped = String(guideId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|/)guide/(?:en|tr)/${escaped}/?(?:[?#].*)?$`).test(url);
}

export function stripGuideFromProjectsJson(json, guideId) {
  const data = JSON.parse(JSON.stringify(json || {}));
  let changed = false;
  for (const key of Object.keys(data)) {
    if (!Array.isArray(data[key])) continue;
    for (const item of data[key]) {
      if (!item || !Array.isArray(item.links)) continue;
      const next = item.links.filter((link) => !isGuideLink(link, guideId));
      if (next.length === item.links.length) continue;
      changed = true;
      if (next.length) item.links = next;
      else delete item.links;
    }
  }
  return { data, changed };
}

export function stripGuideFromProjectMarkdown(text, guideId) {
  const id = String(guideId || "");
  const raw = String(text || "");
  if (!id) return raw;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const guideRe = new RegExp(`^\\s*guide:\\s*['"]?${escaped}['"]?\\s*$`);
  const urlRe = new RegExp(`^\\s*url:\\s*['"]?(?:#/guides/${escaped}|/guide/(?:en|tr)/${escaped}/?)['"]?\\s*$`);
  const lines = raw.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*-\s/.test(line)) {
      const item = [line];
      i += 1;
      while (i < lines.length && /^ +/.test(lines[i]) && !/^\s*-\s/.test(lines[i])) {
        item.push(lines[i]);
        i += 1;
      }
      if (item.some((entry) => guideRe.test(entry) || urlRe.test(entry))) continue;
      out.push(...item);
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n");
}

export function projectMarkdownId(text, path = "") {
  const match = String(text || "").match(/^id:\s*['"]?([A-Za-z0-9-]+)['"]?\s*$/m);
  if (match) return match[1];
  const base = String(path).split("/").pop() || "";
  return base.replace(/\.md$/i, "");
}

function unquoteYaml(value) {
  const raw = String(value || "").trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

export function normalizeGuideLinkLabel(label) {
  if (label && typeof label === "object" && !Array.isArray(label)) {
    const en = String(label.en || label.labelEN || "").trim();
    const tr = String(label.tr || label.labelTR || "").trim();
    if (en || tr) return { en: en || tr, tr: tr || en };
  }
  const text = String(label || "").trim();
  return text || "Setup Guide";
}

function guideLabelsEqual(a, b) {
  const left = normalizeGuideLinkLabel(a);
  const right = normalizeGuideLinkLabel(b);
  if (typeof left === "object" || typeof right === "object") {
    const leftObj = typeof left === "object" ? left : { en: left, tr: left };
    const rightObj = typeof right === "object" ? right : { en: right, tr: right };
    return leftObj.en === rightObj.en && leftObj.tr === rightObj.tr;
  }
  return left === right;
}

function yamlGuideLinkLines(id, label, dashIndent = "") {
  const resolved = normalizeGuideLinkLabel(label);
  const dash = `${dashIndent}- `;
  const key = `${dashIndent}  `;
  const nested = `${dashIndent}    `;
  if (resolved && typeof resolved === "object") {
    return [
      `${dash}label:`,
      `${nested}en: ${yamlQuote(resolved.en)}`,
      `${nested}tr: ${yamlQuote(resolved.tr)}`,
      `${key}guide: ${id}`
    ];
  }
  const text = String(resolved);
  const rendered = text === "Setup Guide" ? "Setup Guide" : yamlQuote(text);
  return [`${dash}label: ${rendered}`, `${key}guide: ${id}`];
}

function linkListDashIndent(fm, linksIdx) {
  for (let i = linksIdx + 1; i < (fm || []).length; i += 1) {
    const match = fm[i].match(/^([ \t]*)-\s/);
    if (match) return match[1];
    if (fm[i].trim() && !/^[ \t]/.test(fm[i])) break;
  }
  return "";
}

function endOfYamlList(fm, start) {
  let i = start;
  while (i < (fm || []).length) {
    if (/^[ \t]*-\s/.test(fm[i])) {
      i += 1;
      continue;
    }
    if (/^[ \t]+/.test(fm[i]) && fm[i].trim()) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

function yamlListItemEnd(fm, start) {
  let i = start + 1;
  while (i < (fm || []).length && /^ +/.test(fm[i]) && !/^\s*-\s/.test(fm[i])) i += 1;
  return i;
}

function parseGuideListItemLabel(lines) {
  const text = lines.join("\n");
  const en = text.match(/^\s+en:\s*(.+)$/m);
  const tr = text.match(/^\s+tr:\s*(.+)$/m);
  if (en || tr) {
    return normalizeGuideLinkLabel({
      en: unquoteYaml(en && en[1]),
      tr: unquoteYaml(tr && tr[1])
    });
  }
  const labelLine = text.match(/^\s*-?\s*label:\s*(.*)$/m);
  const rest = labelLine ? String(labelLine[1] || "").trim() : "";
  return rest ? unquoteYaml(rest) : "Setup Guide";
}

export function extractGuideLinksFromMarkdown(text) {
  const links = [];
  const raw = String(text || "").replace(/\r\n/g, "\n");
  if (!raw.startsWith("---")) return links;
  const close = raw.indexOf("\n---", 3);
  if (close === -1) return links;
  const fm = raw.slice(4, close).split("\n");
  let i = 0;
  while (i < fm.length) {
    if (!/^\s*-\s/.test(fm[i])) {
      i += 1;
      continue;
    }
    const item = [fm[i]];
    i += 1;
    while (i < fm.length && /^ +/.test(fm[i]) && !/^\s*-\s/.test(fm[i])) {
      item.push(fm[i]);
      i += 1;
    }
    const joined = item.join("\n");
    const guideMatch = joined.match(/^\s*guide:\s*['"]?([A-Za-z0-9-]+)['"]?\s*$/m);
    if (!guideMatch) continue;
    links.push({ guide: guideMatch[1], label: parseGuideListItemLabel(item) });
  }
  return links;
}

export function extractGuideIdsFromMarkdown(text) {
  return extractGuideLinksFromMarkdown(text).map((link) => link.guide);
}

export function attachGuideToProjectMarkdown(text, guideId, label) {
  const id = String(guideId || "");
  if (!id) return String(text || "");
  const current = extractGuideLinksFromMarkdown(text).find((link) => link.guide === id);
  const nextLabel = label != null ? normalizeGuideLinkLabel(label) : (current ? current.label : "Setup Guide");
  if (current && guideLabelsEqual(current.label, nextLabel)) return String(text || "");
  const parts = String(text || "").split("\n");
  const blockFor = (indent) => yamlGuideLinkLines(id, nextLabel, indent);
  if (parts[0] !== "---") {
    return `---\nlinks:\n${blockFor("").join("\n")}\n---\n${text}`;
  }
  let end = parts.indexOf("---", 1);
  if (end === -1) end = parts.length;
  const fm = parts.slice(1, end);
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const guideRe = new RegExp(`^\\s*guide:\\s*['"]?${escaped}['"]?\\s*$`);
  let i = 0;
  while (i < fm.length) {
    if (/^\s*-\s/.test(fm[i])) {
      const start = i;
      const stop = yamlListItemEnd(fm, start);
      if (fm.slice(start, stop).some((line) => guideRe.test(line))) {
        const indent = (fm[start].match(/^([ \t]*)-/) || ["", ""])[1];
        fm.splice(start, stop - start, ...blockFor(indent));
        return ["---", ...fm, "---", ...parts.slice(end + 1)].join("\n");
      }
      i = stop;
      continue;
    }
    i += 1;
  }
  const linksIdx = fm.findIndex((line) => /^links:\s*$/.test(line));
  const indent = linksIdx >= 0 ? linkListDashIndent(fm, linksIdx) : "";
  const blockLines = blockFor(indent);
  if (linksIdx >= 0) fm.splice(endOfYamlList(fm, linksIdx + 1), 0, ...blockLines);
  else fm.push("links:", ...blockLines);
  return ["---", ...fm, "---", ...parts.slice(end + 1)].join("\n");
}

export function attachGuideToProjectsJson(json, projectId, guideId, label) {
  const data = JSON.parse(JSON.stringify(json || {}));
  let changed = false;
  const hasLabel = label != null && label !== "";
  const nextLabel = hasLabel ? normalizeGuideLinkLabel(label) : null;
  for (const key of Object.keys(data)) {
    if (!Array.isArray(data[key])) continue;
    for (const item of data[key]) {
      if (!item || item.id === projectId || !Array.isArray(item.links)) continue;
      const next = item.links.filter((link) => !isGuideLink(link, guideId));
      if (next.length === item.links.length) continue;
      changed = true;
      if (next.length) item.links = next;
      else delete item.links;
    }
  }
  if (!projectId) return { data, changed };
  for (const key of Object.keys(data)) {
    if (!Array.isArray(data[key])) continue;
    for (const item of data[key]) {
      if (!item || item.id !== projectId) continue;
      const links = Array.isArray(item.links) ? item.links.slice() : [];
      const existing = links.find((link) => isGuideLink(link, guideId));
      if (existing) {
        if (nextLabel != null && !guideLabelsEqual(existing.label, nextLabel)) {
          existing.label = nextLabel;
          existing.guide = guideId;
          delete existing.url;
          item.links = links;
          changed = true;
        }
      } else {
        links.push({ label: nextLabel != null ? nextLabel : "Setup Guide", guide: guideId });
        item.links = links;
        changed = true;
      }
    }
  }
  return { data, changed };
}

export function findProjectsWithGuide(json, guideId) {
  const hits = [];
  for (const [categoryId, items] of Object.entries(json || {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || !item.id || !Array.isArray(item.links)) continue;
      if (item.links.some((link) => isGuideLink(link, guideId))) {
        hits.push({ id: item.id, categoryId });
      }
    }
  }
  return hits;
}

export function findProjectInJson(json, projectId) {
  if (!projectId) return null;
  for (const [categoryId, items] of Object.entries(json || {})) {
    if (!Array.isArray(items)) continue;
    const item = (items || []).find((entry) => entry && entry.id === projectId);
    if (item) return { id: item.id, categoryId, item };
  }
  return null;
}

export function projectNameSortKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .split(/(\d+)/)
    .map((part) => (/^\d+$/.test(part) ? [1, Number(part)] : [0, part]));
}

export function compareProjectNames(a, b) {
  const left = projectNameSortKey(a);
  const right = projectNameSortKey(b);
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i += 1) {
    const L = left[i] || [0, ""];
    const R = right[i] || [0, ""];
    if (L[0] !== R[0]) return L[0] - R[0];
    if (L[1] !== R[1]) return L[0] === 1 ? L[1] - R[1] : String(L[1]).localeCompare(String(R[1]));
  }
  return 0;
}

export function applyProjectJson(json, categories, record, { remove, fromCategory } = {}) {
  const data = JSON.parse(JSON.stringify(json || {}));
  const cats = categories || [];
  for (const cat of cats) {
    if (!Array.isArray(data[cat.id])) data[cat.id] = [];
  }
  const takeOut = (cid, id) => {
    if (!Array.isArray(data[cid])) return;
    data[cid] = data[cid].filter((item) => item && item.id !== id);
  };
  takeOut(fromCategory || record.category, record.id);
  takeOut(record.category, record.id);
  if (!remove) {
    if (!Array.isArray(data[record.category])) data[record.category] = [];
    data[record.category].push(record.item);
    data[record.category].sort((a, b) => compareProjectNames(a.name, b.name));
  }
  return data;
}
