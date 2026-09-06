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
    paths.push(`guide/${lang}/${id}/index.html`);
    paths.push(`assets/images/og/guides/${lang}/${id}.png`);
  }
  return paths;
}

export function pretty(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function upsertListed(list, name, date) {
  const next = (list || []).filter((item) => item !== name);
  next.push(name);
  next.sort((a, b) => String(b).localeCompare(String(a)));
  return next;
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
  else if (!data.guides.includes(id)) data.guides.push(id);
  data.guides.sort();
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

export function extractGuideIdsFromMarkdown(text) {
  const ids = [];
  for (const line of String(text || "").split("\n")) {
    const match = line.match(/^\s*guide:\s*['"]?([A-Za-z0-9-]+)['"]?\s*$/);
    if (match && !ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

export function attachGuideToProjectMarkdown(text, guideId) {
  const id = String(guideId || "");
  const raw = stripGuideFromProjectMarkdown(text, id);
  if (!id) return raw;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`^\\s*guide:\\s*['"]?${escaped}['"]?\\s*$`, "m").test(raw)) return raw;
  const blockLines = [`  - label: Setup Guide`, `    guide: ${id}`];
  const parts = String(raw || "").split("\n");
  if (parts[0] !== "---") {
    return `---\nlinks:\n${blockLines.join("\n")}\n---\n${raw}`;
  }
  let end = parts.indexOf("---", 1);
  if (end === -1) end = parts.length;
  const fm = parts.slice(1, end);
  const linksIdx = fm.findIndex((line) => /^links:\s*$/.test(line));
  if (linksIdx >= 0) fm.splice(linksIdx + 1, 0, ...blockLines);
  else fm.push("links:", ...blockLines);
  return ["---", ...fm, "---", ...parts.slice(end + 1)].join("\n");
}

export function attachGuideToProjectsJson(json, projectId, guideId) {
  const stripped = stripGuideFromProjectsJson(json, guideId);
  const data = stripped.data;
  if (!projectId) return { data, changed: stripped.changed };
  let changed = stripped.changed;
  for (const key of Object.keys(data)) {
    if (!Array.isArray(data[key])) continue;
    for (const item of data[key]) {
      if (!item || item.id !== projectId) continue;
      const links = Array.isArray(item.links) ? item.links.slice() : [];
      if (!links.some((link) => isGuideLink(link, guideId))) {
        links.push({ label: "Setup Guide", guide: guideId });
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
