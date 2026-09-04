import { HttpError, ID_RE, CORE_TYPE_IDS, CONTACT_I18N_KEYS, slugify, normalizeDate, isHttps, allowedLinkUrl, sniffImageExt, uniqueName } from "./util.js";
import { writingPath, videoPath, pagePath, projectMdPath, guidePath, assertSafePath } from "./paths.js";
import { buildWritingMarkdown, buildVideoMarkdown, buildProjectMarkdown, projectJsonItem, youtubeIdFromUrl, parseFrontMatter, setYamlScalar, isExternalKind, isXUrl } from "./markdown.js";
import { pretty, applyWritingIndex, applyVideoIndex, applyGuideIndex, applyProjectJson } from "./generate.js";

function commitMsg(action, target) {
  return `admin: ${action} ${target}`;
}

async function readJson(github, path, fallback) {
  try {
    return JSON.parse(await github.getText(path));
  } catch (error) {
    if (fallback !== undefined && error.status === 404) return fallback;
    throw error;
  }
}

function applyLocation(site, incoming) {
  const current = site.location && typeof site.location === "object" ? site.location : {};
  let city = String(incoming.city ?? current.city ?? "").trim();
  let country = String(incoming.country ?? current.country ?? "").trim();
  if (!city && !country) {
    const sample = String(incoming.en || current.en || incoming.tr || current.tr || "");
    if (sample.includes(",")) [city, country] = sample.split(",", 2).map((part) => part.trim());
    else if (sample) city = sample;
  }
  const label = [city, country].filter(Boolean).join(", ");
  const loc = { ...current, city, country };
  loc.en = String(incoming.en || loc.en || label).trim() || label;
  loc.tr = String(incoming.tr || loc.tr || label).trim() || label;
  loc.mapQuery = label;
  site.location = loc;
  const contact = site.contact && typeof site.contact === "object" ? site.contact : {};
  if (label) {
    contact.mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(label)}&z=12&hl=en&output=embed`;
  }
  site.contact = contact;
}

function writingIdsFromIndex(index, kind) {
  const block = index[kind] || {};
  const names = [...(block.en || []), ...(block.tr || [])];
  return [...new Set(names.map((name) => String(name).replace(/\.md$/i, "")).filter(Boolean))];
}

function rewriteWritingText(text, destKind, types, externalUrl) {
  const { meta, body } = parseFrontMatter(text);
  return buildWritingMarkdown({
    title: meta.title || "",
    date: meta.date || "",
    cover: meta.cover || meta.image || "",
    externalUrl: isExternalKind(types, destKind) ? externalUrl : "",
    kind: destKind,
    external: isExternalKind(types, destKind),
    body
  });
}

function mdText(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

export async function handleSave(body, github) {
  if (body.kind === "videos") return handleVideoSave(body, github);
  if (body.action === "delete") return handleWritingDelete(body, github);
  const kind = String(body.kind || "");
  const types = await readJson(github, "config/writing-types.json", { types: [] });
  const typeList = types.types || [];
  const kindIds = typeList.map((item) => item.id);
  if (!kindIds.includes(kind) && !CORE_TYPE_IDS.includes(kind)) throw new HttpError(400, "Unknown type");
  const lang = String(body.lang || "");
  if (lang !== "en" && lang !== "tr") throw new HttpError(400, "Language must be en or tr");
  const title = String(body.title || "").trim();
  const date = normalizeDate(body.date);
  const cover = String(body.cover || "").trim();
  const id = String(body.id || slugify(title));
  if (!title) throw new HttpError(400, "Title is required");
  if (!date) throw new HttpError(400, "Date must be YYYY-MM-DD or DD.MM.YYYY");
  if (!ID_RE.test(id)) throw new HttpError(400, "Invalid shared content ID");
  if (cover && (cover.includes("/") || cover.includes("\\") || cover.includes(".."))) {
    throw new HttpError(400, "Cover must be a file name, not a path");
  }
  const destExternal = isExternalKind(typeList, kind);
  const external = String(body.externalUrl || "").trim();
  if (destExternal && !isXUrl(external)) {
    throw new HttpError(400, "A valid https://x.com/… URL is required");
  }
  const fromKind = String(body.fromKind || kind);
  const file = `${id}.md`;
  const markdown = buildWritingMarkdown({
    title, date, cover, externalUrl: destExternal ? external : "", kind, body: body.body || "", external: destExternal
  });
  const upserts = [];
  const deletes = [];
  let index = await readJson(github, "content/index.json", {});
  const destCurrent = writingPath(kind, lang, id);

  if (fromKind && fromKind !== kind) {
    if (!kindIds.includes(fromKind) && !CORE_TYPE_IDS.includes(fromKind)) {
      throw new HttpError(400, "Unknown category");
    }
    const sources = [];
    for (const other of ["en", "tr"]) {
      const src = writingPath(fromKind, other, id);
      if (await github.exists(src)) sources.push({ lang: other, src });
    }
    if (!sources.length) throw new HttpError(404, `Writing ${id} was not found in ${fromKind}`);
    for (const item of sources) {
      const dest = writingPath(kind, item.lang, id);
      if (await github.exists(dest)) throw new HttpError(409, `${dest} already exists`);
    }
    if (!sources.some((item) => item.lang === lang) && (await github.exists(destCurrent))) {
      throw new HttpError(409, `${destCurrent} already exists`);
    }
    for (const item of sources) {
      const dest = writingPath(kind, item.lang, id);
      deletes.push(item.src);
      if (item.lang === lang) {
        upserts.push({ path: dest, text: mdText(markdown) });
      } else {
        upserts.push({
          path: dest,
          text: mdText(rewriteWritingText(await github.getText(item.src), kind, typeList, destExternal ? external : ""))
        });
      }
      index = applyWritingIndex(index, { kind, lang: item.lang, file, fromKind });
    }
    if (!sources.some((item) => item.lang === lang)) {
      upserts.push({ path: destCurrent, text: mdText(markdown) });
      index = applyWritingIndex(index, { kind, lang, file, fromKind });
    }
  } else {
    upserts.push({ path: destCurrent, text: mdText(markdown) });
    index = applyWritingIndex(index, { kind, lang, file });
  }

  upserts.push({ path: "content/index.json", text: pretty(index) });
  const result = await github.commit({ message: commitMsg("save writing", `${kind}/${lang}/${file}`), upserts, deletes });
  return { id, path: destCurrent, sha: result.sha };
}

async function handleWritingDelete(body, github) {
  const kind = String(body.kind || "");
  const id = String(body.id || "");
  if (!ID_RE.test(id)) throw new HttpError(400, "Invalid shared content ID");
  if (kind === "videos" || kind === "about" || kind === "resume") {
    throw new HttpError(400, "Unknown type");
  }
  const types = await readJson(github, "config/writing-types.json", { types: [] });
  const kindIds = (types.types || []).map((item) => item.id);
  if (!kindIds.includes(kind) && !CORE_TYPE_IDS.includes(kind)) throw new HttpError(400, "Unknown type");
  const file = `${id}.md`;
  const deletes = [];
  let index = await readJson(github, "content/index.json", {});
  for (const lang of ["en", "tr"]) {
    const path = writingPath(kind, lang, id);
    if (await github.exists(path)) deletes.push(path);
    index = applyWritingIndex(index, { kind, lang, file, remove: true });
  }
  if (!deletes.length) throw new HttpError(404, "Writing not found");
  const upserts = [{ path: "content/index.json", text: pretty(index) }];
  const result = await github.commit({ message: commitMsg("delete writing", id), upserts, deletes });
  return { id, deleted: deletes, sha: result.sha };
}

async function handleVideoSave(body, github) {
  if (body.action === "delete") {
    const id = String(body.id || "");
    if (!ID_RE.test(id)) throw new HttpError(400, "Invalid id");
    const file = `${id}.md`;
    const path = videoPath(id);
    if (!(await github.exists(path))) throw new HttpError(404, "Video not found");
    const index = applyVideoIndex(await readJson(github, "content/index.json", {}), { file, remove: true });
    const result = await github.commit({
      message: commitMsg("delete video", id),
      upserts: [{ path: "content/index.json", text: pretty(index) }],
      deletes: [path]
    });
    return { id, sha: result.sha };
  }
  const titleEn = String(body.titleEn || "").trim();
  const titleTr = String(body.titleTr || "").trim();
  const date = normalizeDate(body.date);
  const youtubeUrl = String(body.youtubeUrl || "").trim();
  const youtubeId = youtubeIdFromUrl(youtubeUrl);
  const id = slugify(body.id || titleEn || titleTr);
  if (!youtubeId) throw new HttpError(400, "A valid YouTube URL is required");
  if (!titleEn || !titleTr) throw new HttpError(400, "Title EN and Title TR are required");
  if (!date) throw new HttpError(400, "Date must be YYYY-MM-DD or DD.MM.YYYY");
  if (!ID_RE.test(id)) throw new HttpError(400, "Could not derive a filename from the title");
  const markdown = buildVideoMarkdown({ titleEn, titleTr, date, youtubeUrl });
  const file = `${id}.md`;
  const index = applyVideoIndex(await readJson(github, "content/index.json", {}), { file });
  const result = await github.commit({
    message: commitMsg("save video", file),
    upserts: [
      { path: videoPath(id), text: markdown },
      { path: "content/index.json", text: pretty(index) }
    ]
  });
  return { id, path: videoPath(id), youtubeId, sha: result.sha };
}

export async function handleSite(body, github) {
  const data = await readJson(github, "config/site.json");
  if (body.displayName != null) {
    const name = String(body.displayName || "").trim();
    if (!name) throw new HttpError(400, "Display name is required");
    data.displayName = name;
  }
  if (body.motto != null) data.motto = String(body.motto || "").trim();
  if (body.email != null) {
    const email = String(body.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Email looks invalid");
    data.email = email;
  }
  if (body.avatar) {
    const avatar = String(body.avatar).trim();
    const rel = avatar.replace(/^\.\//, "").replace(/^\//, "");
    if (rel.includes("..") || !rel.startsWith("assets/images/profile/")) throw new HttpError(400, "Avatar path is not allowed");
    data.avatar = avatar.startsWith("./") ? avatar : `./${rel}`;
  }
  if (body.whatsapp && typeof body.whatsapp === "object") {
    const current = data.whatsapp && typeof data.whatsapp === "object" ? data.whatsapp : {};
    const url = String(body.whatsapp.url ?? current.url ?? "").trim();
    if (url && !isHttps(url)) throw new HttpError(400, "WhatsApp URL must be https://");
    data.whatsapp = { ...current, display: String(body.whatsapp.display ?? current.display ?? "").trim(), url };
  }
  if (body.tagline && typeof body.tagline === "object") {
    const current = data.tagline && typeof data.tagline === "object" ? data.tagline : {};
    data.tagline = { ...current };
    for (const lang of ["en", "tr"]) {
      if (lang in body.tagline) data.tagline[lang] = String(body.tagline[lang] || "").trim();
    }
  }
  if (body.location && typeof body.location === "object") applyLocation(data, body.location);
  if (Array.isArray(body.social)) {
    const existing = Array.isArray(data.social) ? data.social : [];
    const byId = Object.fromEntries(existing.filter((item) => item && item.id).map((item) => [String(item.id), item]));
    const rebuilt = [];
    const seen = new Set();
    for (const raw of body.social) {
      if (!raw || typeof raw !== "object") continue;
      const sid = String(raw.id || "").trim();
      const url = String(raw.url || "").trim();
      if (!sid) throw new HttpError(400, "Each social link needs an id");
      if (seen.has(sid)) throw new HttpError(400, "Duplicate social link");
      seen.add(sid);
      if (!url) throw new HttpError(400, `${sid} URL is required`);
      if (!isHttps(url)) throw new HttpError(400, `${sid} URL is not valid`);
      const prev = byId[sid] && typeof byId[sid] === "object" ? { ...byId[sid] } : {};
      prev.id = sid;
      prev.url = url;
      if (raw.icon) prev.icon = String(raw.icon);
      else if (!prev.icon) prev.icon = "link-outline";
      if ("label" in raw) prev.label = raw.label;
      rebuilt.push(prev);
    }
    data.social = rebuilt;
  }
  const result = await github.commit({
    message: commitMsg("save", "config/site.json"),
    upserts: [{ path: "config/site.json", text: pretty(data) }]
  });
  return { site: data, path: "config/site.json", sha: result.sha };
}

export async function handlePage(body, github) {
  const family = String(body.family || "");
  const lang = String(body.lang || "");
  if (body.markdown == null || typeof body.markdown !== "string") {
    throw new HttpError(400, "Markdown is required");
  }
  const markdown = body.markdown;
  const path = pagePath(family, lang);
  const text = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  const result = await github.commit({
    message: commitMsg("save page", `${family}/${lang}`),
    upserts: [{ path, text }]
  });
  return { path, family, lang, sha: result.sha, unchanged: Boolean(result.unchanged) };
}

export async function handleProjectSave(body, github) {
  if (body.action === "delete") {
    const id = slugify(body.id);
    if (!ID_RE.test(id)) throw new HttpError(400, "Invalid project id");
    const cats = await readJson(github, "config/project-categories.json", []);
    const json = await readJson(github, "projects/projects.json", {});
    let found = null;
    for (const cat of cats) {
      const hit = (json[cat.id] || []).find((item) => item && item.id === id);
      if (hit) found = { cat, item: hit };
    }
    if (!found) throw new HttpError(404, "Project not found");
    const path = projectMdPath(found.cat.folder, id);
    if (!(await github.exists(path))) throw new HttpError(404, "Project not found");
    const next = applyProjectJson(json, cats, { id, category: found.cat.id, item: found.item }, { remove: true });
    const deletes = [path];
    const result = await github.commit({
      message: commitMsg("delete project", id),
      upserts: [{ path: "projects/projects.json", text: pretty(next) }],
      deletes
    });
    return { id, sha: result.sha };
  }
  const name = String(body.name || "").trim();
  const category = String(body.category || "").trim();
  const status = String(body.status || "").trim();
  const itemId = slugify(body.id || name);
  const fromCategory = String(body.fromCategory || category).trim();
  const slug = slugify(body.slug || itemId);
  if (!name) throw new HttpError(400, "Project name is required");
  if (!["active", "completed", "built"].includes(status)) throw new HttpError(400, "Status must be active, completed, or built");
  if (!ID_RE.test(itemId) || !ID_RE.test(slug)) throw new HttpError(400, "Could not derive a project id");
  const cats = await readJson(github, "config/project-categories.json", []);
  const cat = cats.find((item) => item.id === category);
  if (!cat) throw new HttpError(400, "Unknown project category");
  const data = { name, category, status, id: itemId };
  const role = body.role;
  if (role && typeof role === "object") {
    const cleaned = {};
    for (const lang of ["en", "tr"]) {
      const value = String(role[lang] || "").trim();
      if (value) cleaned[lang] = value;
    }
    if (Object.keys(cleaned).length) data.role = Object.keys(cleaned).length > 1 ? cleaned : Object.values(cleaned)[0];
  } else if (typeof role === "string" && role.trim()) data.role = role.trim();
  const former = String(body.former_name || body.formerName || "").trim();
  if (former) data.former_name = former;
  const logo = String(body.logo || "").trim();
  if (logo) {
    const rel = logo.replace(/^\.\//, "");
    if (rel.includes("..") || !rel.startsWith("assets/images/projects/")) throw new HttpError(400, "Logo path is not allowed");
    data.logo = logo.startsWith("./") ? logo : `./${rel}`;
  }
  const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
  const enSum = String(summary.en || "").trim();
  const trSum = String(summary.tr || "").trim();
  if (enSum || trSum) {
    if (!enSum || !trSum) throw new HttpError(400, "Summary needs both English and Turkish");
    data.summary = { en: enSum, tr: trSum };
  }
  const links = [];
  for (const [index, raw] of (Array.isArray(body.links) ? body.links : []).entries()) {
    if (!raw || typeof raw !== "object") continue;
    const url = String(raw.url || "").trim();
    if (!url) throw new HttpError(400, `Link ${index + 1} needs a URL`);
    if (!allowedLinkUrl(url)) throw new HttpError(400, `Link ${index + 1} URL is not allowed`);
    let storedLabel;
    if (raw.label && typeof raw.label === "object") {
      const labelEn = String(raw.label.en || "").trim();
      const labelTr = String(raw.label.tr || "").trim();
      if (!labelEn) throw new HttpError(400, `Link ${index + 1} needs an English label`);
      storedLabel = { en: labelEn, tr: labelTr || labelEn };
    } else {
      storedLabel = String(raw.label || "").trim();
      if (!storedLabel) throw new HttpError(400, `Link ${index + 1} needs a label`);
    }
    const link = { label: storedLabel, url };
    const guide = String(raw.guide || "").trim();
    if (guide) {
      if (!ID_RE.test(guide)) throw new HttpError(400, "Guide id is invalid");
      link.guide = guide;
    }
    links.push(link);
  }
  if (links.length) data.links = links;
  const referralUrl = String(body.referral_url || body.referralUrl || "").trim();
  const referralCode = String(body.referral_code || body.referralCode || "").trim();
  if (referralUrl) data.referral_url = referralUrl;
  if (referralCode) data.referral_code = referralCode;
  const dest = projectMdPath(cat.folder, slug);
  const fromCat = cats.find((item) => item.id === fromCategory) || cat;
  const src = projectMdPath(fromCat.folder, slug);
  const deletes = src !== dest && (await github.exists(src)) ? [src] : [];
  const json = applyProjectJson(
    await readJson(github, "projects/projects.json", {}),
    cats,
    { id: itemId, category, item: projectJsonItem(data) },
    { fromCategory }
  );
  const result = await github.commit({
    message: commitMsg("save project", itemId),
    upserts: [
      { path: dest, text: buildProjectMarkdown(data) },
      { path: "projects/projects.json", text: pretty(json) }
    ],
    deletes
  });
  return { id: itemId, path: dest, sha: result.sha };
}

export async function handleGuideSave(body, github) {
  const id = slugify(body.id);
  const lang = String(body.lang || "");
  const markdown = String(body.markdown || "");
  if (!ID_RE.test(id)) throw new HttpError(400, "Could not derive a guide id");
  if (lang !== "en" && lang !== "tr") throw new HttpError(400, "Language must be en or tr");
  const path = guidePath(id, lang);
  const text = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  const index = applyGuideIndex(await readJson(github, "guides/index.json", { guides: [] }), { id });
  const result = await github.commit({
    message: commitMsg("save guide", `${id}/${lang}`),
    upserts: [
      { path, text },
      { path: "guides/index.json", text: pretty(index) }
    ]
  });
  return { id, path, sha: result.sha };
}

export async function handleGuideDelete(body, github) {
  const id = slugify(body.id);
  if (!ID_RE.test(id)) throw new HttpError(400, "Invalid guide id");
  const deletes = [];
  for (const lang of ["en", "tr"]) {
    const path = guidePath(id, lang);
    if (await github.exists(path)) deletes.push(path);
  }
  if (!deletes.some((path) => path.endsWith("/EN.md") || path.endsWith("/TR.md"))) {
    throw new HttpError(404, "Guide not found");
  }
  const extra = await github.listPrefix(`guides/${id}/`);
  for (const path of extra) {
    if (!deletes.includes(path)) deletes.push(path);
  }
  const assets = await github.listPrefix(`assets/images/guides/${id}/`);
  deletes.push(...assets);
  const index = applyGuideIndex(await readJson(github, "guides/index.json", { guides: [] }), { id, remove: true });
  const result = await github.commit({
    message: commitMsg("delete guide", id),
    upserts: [{ path: "guides/index.json", text: pretty(index) }],
    deletes
  });
  return { id, sha: result.sha };
}

export async function handleContact(body, github) {
  const site = await readJson(github, "config/site.json");
  if (body.location && typeof body.location === "object") applyLocation(site, body.location);
  if (body.contact && typeof body.contact === "object") {
    const current = site.contact && typeof site.contact === "object" ? site.contact : {};
    if ("formEnabled" in body.contact) current.formEnabled = Boolean(body.contact.formEnabled);
    if ("endpoint" in body.contact) {
      const endpoint = String(body.contact.endpoint || "").trim();
      if (endpoint && !isHttps(endpoint)) throw new HttpError(400, "Form endpoint must be an https:// URL");
      current.endpoint = endpoint;
    }
    site.contact = current;
  }
  const upserts = [{ path: "config/site.json", text: pretty(site) }];
  const i18nIn = body.i18n && typeof body.i18n === "object" ? body.i18n : {};
  for (const lang of ["en", "tr"]) {
    if (!i18nIn[lang] || typeof i18nIn[lang] !== "object") continue;
    const pack = await readJson(github, `i18n/${lang}.json`);
    const contact = pack.contact && typeof pack.contact === "object" ? pack.contact : {};
    for (const key of CONTACT_I18N_KEYS) {
      if (key in i18nIn[lang]) contact[key] = String(i18nIn[lang][key] || "").trim();
    }
    pack.contact = contact;
    upserts.push({ path: `i18n/${lang}.json`, text: pretty(pack) });
  }
  const result = await github.commit({ message: commitMsg("save", "contact"), upserts });
  return { site, sha: result.sha };
}

export async function handleWritingTypes(body, github) {
  const pack = await readJson(github, "config/writing-types.json", { types: [] });
  const types = Array.isArray(pack.types) ? pack.types : [];
  const action = String(body.action || "");
  if (action === "create") {
    const label = body.label && typeof body.label === "object" ? body.label : {};
    const en = String(label.en || body.labelEn || "").trim();
    const tr = String(label.tr || body.labelTr || "").trim();
    if (!en || !tr) throw new HttpError(400, "English name and Turkish name are required");
    const typeId = slugify(en);
    if (!ID_RE.test(typeId)) throw new HttpError(400, "Could not derive a type id from the English name");
    if (types.some((item) => item.id === typeId) || CORE_TYPE_IDS.includes(typeId)) {
      throw new HttpError(409, "That type already exists or is reserved");
    }
    types.push({
      id: typeId, core: false, mode: "internal",
      icon: String(body.icon || "document-text-outline"),
      label: { en, tr }, filter: { en, tr }
    });
    pack.types = types;
    const index = await readJson(github, "content/index.json", {});
    index.types = types;
    index[typeId] = { en: [], tr: [] };
    const result = await github.commit({
      message: commitMsg("create writing type", typeId),
      upserts: [
        { path: "config/writing-types.json", text: pretty(pack) },
        { path: "content/index.json", text: pretty(index) }
      ]
    });
    return { types, id: typeId, sha: result.sha };
  }
  const typeId = String(body.id || "");
  const current = types.find((item) => item.id === typeId);
  if (!current) throw new HttpError(404, "Unknown writing type");
  if (action === "update") {
    const label = body.label && typeof body.label === "object" ? body.label : {};
    const en = String(label.en || current.label?.en || "").trim();
    const tr = String(label.tr || current.label?.tr || "").trim();
    if (!en || !tr) throw new HttpError(400, "English name and Turkish name are required");
    current.label = { en, tr };
    if (!current.core && !CORE_TYPE_IDS.includes(typeId) && body.icon) current.icon = String(body.icon);
    pack.types = types;
    const index = await readJson(github, "content/index.json", {});
    index.types = types;
    const result = await github.commit({
      message: commitMsg("update writing type", typeId),
      upserts: [
        { path: "config/writing-types.json", text: pretty(pack) },
        { path: "content/index.json", text: pretty(index) }
      ]
    });
    return { types, id: typeId, sha: result.sha };
  }
  if (action === "delete") {
    if (current.core || CORE_TYPE_IDS.includes(typeId)) throw new HttpError(403, "Core writing types cannot be deleted");
    const index = await readJson(github, "content/index.json", {});
    const listed = writingIdsFromIndex(index, typeId);
    const discovered = new Set(listed);
    for (const lang of ["en", "tr"]) {
      const paths = await github.listPrefix(`content/${typeId}/${lang}/`);
      for (const path of paths) {
        const name = path.split("/").pop() || "";
        if (name.endsWith(".md") && !name.startsWith("_")) discovered.add(name.replace(/\.md$/i, ""));
      }
    }
    const ids = [...discovered];
    const moveTo = String(body.moveTo || "").trim();
    const upserts = [];
    const deletes = [];
    if (ids.length && !moveTo) {
      throw new HttpError(409, `This category contains ${ids.length} writings.`);
    }
    if (ids.length) {
      if (moveTo === typeId) throw new HttpError(400, "Source and target category are the same");
      const destType = types.find((item) => item.id === moveTo);
      if (!destType) throw new HttpError(400, "Unknown category");
      const destExternal = isExternalKind(types, moveTo);
      for (const itemId of ids) {
        if (!ID_RE.test(itemId)) throw new HttpError(400, "Invalid shared content ID");
        let found = false;
        let pairUrl = String(body.externalUrl || "").trim();
        for (const lang of ["en", "tr"]) {
          const src = writingPath(typeId, lang, itemId);
          if (!(await github.exists(src))) continue;
          found = true;
          const text = await github.getText(src);
          const { meta } = parseFrontMatter(text);
          if (!pairUrl) pairUrl = String(meta.externalUrl || "").trim();
        }
        if (destExternal && !isXUrl(pairUrl)) {
          throw new HttpError(400, "Original X URL is required to move a writing to X Post");
        }
        for (const lang of ["en", "tr"]) {
          const src = writingPath(typeId, lang, itemId);
          if (!(await github.exists(src))) continue;
          const dest = writingPath(moveTo, lang, itemId);
          if (await github.exists(dest)) throw new HttpError(409, `${dest} already exists`);
          const text = await github.getText(src);
          const rewritten = rewriteWritingText(text, moveTo, types, pairUrl);
          upserts.push({ path: dest, text: rewritten.endsWith("\n") ? rewritten : `${rewritten}\n` });
          deletes.push(src);
        }
        if (!found) throw new HttpError(404, `Writing ${itemId} was not found in ${typeId}`);
      }
      const leftover = (await github.listPrefix(`content/${typeId}/`)).filter((path) => !deletes.includes(path));
      if (leftover.length) throw new HttpError(409, "Category folder is not empty");
      let nextIndex = index;
      for (const itemId of ids) {
        const file = `${itemId}.md`;
        for (const lang of ["en", "tr"]) {
          const src = writingPath(typeId, lang, itemId);
          if (deletes.includes(src) || upserts.some((item) => item.path === writingPath(moveTo, lang, itemId))) {
            nextIndex = applyWritingIndex(nextIndex, { kind: moveTo, lang, file, fromKind: typeId });
          }
        }
      }
      delete nextIndex[typeId];
      pack.types = types.filter((item) => item.id !== typeId);
      nextIndex.types = pack.types;
      const result = await github.commit({
        message: commitMsg("migrate writing type", `${typeId} -> ${moveTo}`),
        upserts: [
          ...upserts,
          { path: "config/writing-types.json", text: pretty(pack) },
          { path: "content/index.json", text: pretty(nextIndex) }
        ],
        deletes
      });
      return { types: pack.types, id: typeId, moved: ids.length, sha: result.sha };
    }
    const leftover = await github.listPrefix(`content/${typeId}/`);
    if (leftover.length) throw new HttpError(409, "Category folder is not empty");
    pack.types = types.filter((item) => item.id !== typeId);
    delete index[typeId];
    index.types = pack.types;
    const result = await github.commit({
      message: commitMsg("delete writing type", typeId),
      upserts: [
        { path: "config/writing-types.json", text: pretty(pack) },
        { path: "content/index.json", text: pretty(index) }
      ]
    });
    return { types: pack.types, id: typeId, moved: 0, sha: result.sha };
  }
  throw new HttpError(400, "Unknown writing type action");
}

export async function handleProjectCategories(body, github) {
  const cats = await readJson(github, "config/project-categories.json", []);
  const action = String(body.action || "");
  const json = await readJson(github, "projects/projects.json", {});
  if (action === "reorder") {
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (ids.length !== cats.length || ids.some((id) => !cats.find((item) => item.id === id))) {
      throw new HttpError(400, "Reorder must include every category");
    }
    const byId = Object.fromEntries(cats.map((item) => [item.id, item]));
    const ordered = ids.map((id, index) => ({ ...byId[id], order: index + 1 }));
    const result = await github.commit({
      message: commitMsg("reorder project categories", "config"),
      upserts: [{ path: "config/project-categories.json", text: pretty(ordered) }]
    });
    return { categories: ordered, sha: result.sha };
  }
  if (action === "update") {
    const current = cats.find((item) => item.id === body.id);
    if (!current) throw new HttpError(404, "Unknown category");
    const label = body.label && typeof body.label === "object" ? body.label : {};
    const en = String(label.en || current.label?.en || "").trim();
    const tr = String(label.tr || current.label?.tr || "").trim();
    if (!en || !tr) throw new HttpError(400, "English and Turkish labels are required");
    current.label = { en, tr };
    const result = await github.commit({
      message: commitMsg("update project category", current.id),
      upserts: [{ path: "config/project-categories.json", text: pretty(cats) }]
    });
    return { categories: cats, sha: result.sha };
  }
  if (action === "create") {
    const label = body.label && typeof body.label === "object" ? body.label : {};
    const en = String(label.en || "").trim();
    const tr = String(label.tr || "").trim();
    if (!en || !tr) throw new HttpError(400, "English and Turkish labels are required");
    const cid = slugify(en);
    if (!cid || cats.some((item) => item.id === cid)) throw new HttpError(409, "That category already exists");
    const order = Math.max(0, ...cats.map((item) => Number(item.order) || 0)) + 1;
    cats.push({ id: cid, folder: cid, order, accordion: false, protected: false, label: { en, tr } });
    json[cid] = json[cid] || [];
    const result = await github.commit({
      message: commitMsg("create project category", cid),
      upserts: [
        { path: "config/project-categories.json", text: pretty(cats) },
        { path: `content/projects/${cid}/.gitkeep`, text: "" },
        { path: "projects/projects.json", text: pretty(json) }
      ]
    });
    return { categories: cats, id: cid, sha: result.sha };
  }
  if (action === "delete") {
    const cid = String(body.id || "").trim();
    const current = cats.find((item) => item.id === cid);
    if (!current) throw new HttpError(404, "Unknown category");
    if (current.protected) throw new HttpError(403, "This project category cannot be deleted");
    const folder = String(current.folder || cid);
    const jsonItems = Array.isArray(json[cid]) ? json[cid] : [];
    const folderFiles = await github.listPrefix(`content/projects/${folder}/`);
    const mdFiles = folderFiles.filter((path) => path.endsWith(".md") && !path.split("/").pop().startsWith("_"));
    const leftovers = folderFiles.filter((path) => {
      const name = path.split("/").pop();
      return name !== ".gitkeep" && !path.endsWith(".md");
    });
    const items = [];
    const seen = new Set();
    for (const item of jsonItems) {
      if (!item || !item.id) continue;
      seen.add(item.id);
      items.push({ id: item.id, slug: item.id, item });
    }
    for (const path of mdFiles) {
      const slug = path.split("/").pop().replace(/\.md$/i, "");
      if (seen.has(slug)) continue;
      seen.add(slug);
      items.push({ id: slug, slug, item: { id: slug, name: slug, status: "active" } });
    }
    const moveTo = String(body.moveTo || "").trim();
    if (items.length && !moveTo) {
      throw new HttpError(409, `This category contains ${items.length} projects.`);
    }
    if (leftovers.length) {
      throw new HttpError(409, "Category folder is not empty");
    }
    const upserts = [];
    const deletes = [];
    let nextJson = JSON.parse(JSON.stringify(json));
    if (items.length) {
      const destCat = cats.find((item) => item.id === moveTo);
      if (!destCat || moveTo === cid) throw new HttpError(400, "Choose a different target category");
      for (const item of items) {
        const src = projectMdPath(folder, item.slug);
        const dest = projectMdPath(destCat.folder, item.slug);
        if (src !== dest && (await github.exists(dest))) {
          throw new HttpError(409, `${dest} already exists`);
        }
      }
      for (const item of items) {
        const src = projectMdPath(folder, item.slug);
        const dest = projectMdPath(destCat.folder, item.slug);
        if (await github.exists(src)) {
          const text = setYamlScalar(await github.getText(src), "category", moveTo);
          upserts.push({ path: dest, text: text.endsWith("\n") ? text : `${text}\n` });
          if (src !== dest) deletes.push(src);
        }
        nextJson = applyProjectJson(nextJson, cats, { id: item.id, category: moveTo, item: { ...item.item, id: item.id } }, { fromCategory: cid });
      }
    }
    for (const path of folderFiles) {
      if (!deletes.includes(path) && !upserts.some((item) => item.path === path)) deletes.push(path);
    }
    const nextCats = cats.filter((item) => item.id !== cid);
    delete nextJson[cid];
    const result = await github.commit({
      message: commitMsg(items.length ? "migrate project category" : "delete project category", cid),
      upserts: [
        ...upserts,
        { path: "config/project-categories.json", text: pretty(nextCats) },
        { path: "projects/projects.json", text: pretty(nextJson) }
      ],
      deletes
    });
    return { categories: nextCats, moved: items.length, sha: result.sha };
  }
  throw new HttpError(400, "Unknown project category action");
}

export async function handleUpload(kind, file, fields, github) {
  if (!file || !file.bytes || !file.bytes.length) throw new HttpError(400, "Choose an image file");
  if (file.bytes.length > 2_000_000) throw new HttpError(413, "Image is too large");
  const allowSvg = kind === "project-logo";
  const ext = sniffImageExt(file.bytes, file.name, { allowSvg });
  if (!ext) throw new HttpError(400, allowSvg ? "Only PNG, JPEG, WebP, or SVG logos are accepted" : "Only PNG, JPEG, and WebP images are accepted");
  let dir = "assets/images/blog";
  let field = "filename";
  if (kind === "avatar") dir = "assets/images/profile";
  if (kind === "project-logo") dir = "assets/images/projects";
  if (kind === "guide-image") {
    const guideId = slugify(fields.id || "");
    if (!ID_RE.test(guideId)) throw new HttpError(400, "Guide id is required before adding images");
    dir = `assets/images/guides/${guideId}`;
  }
  assertSafePath(`${dir}/x${ext}`);
  const existing = (await github.listPrefix(`${dir}/`)).map((path) => path.slice(dir.length + 1));
  const stored = uniqueName(existing, file.name.replace(/\.[^.]+$/, "") || kind, ext);
  const path = `${dir}/${stored}`;
  const rel = `./${path}`;
  const result = await github.commit({
    message: commitMsg("upload", path),
    upserts: [{ path, bytes: file.bytes }]
  });
  const payload = { filename: stored, path: rel, sha: result.sha };
  if (kind === "avatar") payload.avatar = rel;
  if (kind === "project-logo") payload.logo = rel;
  if (kind === "guide-image") payload.markdown = `![](${rel})`;
  return payload;
}

export const POST_HANDLERS = {
  "/api/admin/save": handleSave,
  "/api/admin/site": handleSite,
  "/api/admin/page": handlePage,
  "/api/admin/project-save": handleProjectSave,
  "/api/admin/guide-save": handleGuideSave,
  "/api/admin/guide-delete": handleGuideDelete,
  "/api/admin/contact": handleContact,
  "/api/admin/writing-types": handleWritingTypes,
  "/api/admin/project-categories": handleProjectCategories
};
