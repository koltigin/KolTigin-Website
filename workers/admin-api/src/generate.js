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
  return url === `#/guides/${guideId}` || url.endsWith(`#/guides/${guideId}`);
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
  const urlRe = new RegExp(`^\\s*url:\\s*['"]?#/guides/${escaped}['"]?\\s*$`);
  const lines = raw.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^-\s/.test(line)) {
      const item = [line];
      i += 1;
      while (i < lines.length && /^  /.test(lines[i])) {
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
