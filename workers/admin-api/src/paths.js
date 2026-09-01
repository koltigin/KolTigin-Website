import { HttpError } from "./util.js";

const ALLOWED_PREFIXES = [
  "config/site.json",
  "config/writing-types.json",
  "config/project-categories.json",
  "content/about/",
  "content/resume/",
  "content/articles/",
  "content/notes/",
  "content/social/",
  "content/videos/",
  "content/projects/",
  "content/index.json",
  "projects/projects.json",
  "guides/",
  "i18n/en.json",
  "i18n/tr.json",
  "assets/images/blog/",
  "assets/images/profile/",
  "assets/images/projects/",
  "assets/images/guides/"
];

const BLOCKED = new Set([
  ".github/workflows",
  "workers/",
  "scripts/",
  "admin/"
]);

export function assertSafePath(path) {
  const raw = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!raw || raw.includes("..") || raw.startsWith("/") || raw.includes("//")) {
    throw new HttpError(400, "Invalid path");
  }
  if ([...raw].some((ch) => ch.charCodeAt(0) < 32)) {
    throw new HttpError(400, "Invalid path");
  }
  for (const blocked of BLOCKED) {
    if (raw === blocked.replace(/\/$/, "") || raw.startsWith(blocked)) {
      throw new HttpError(400, "That path cannot be written");
    }
  }
  const ok = ALLOWED_PREFIXES.some((prefix) => raw === prefix || raw.startsWith(prefix))
    || /^content\/[a-z0-9][a-z0-9-]{0,70}\/(en|tr)\/[a-z0-9][a-z0-9-]*\.md$/.test(raw);
  if (!ok) throw new HttpError(400, "That path is not allowlisted");
  return raw;
}

export function writingPath(kind, lang, id) {
  return assertSafePath(`content/${kind}/${lang}/${id}.md`);
}

export function videoPath(id) {
  return assertSafePath(`content/videos/${id}.md`);
}

export function pagePath(family, lang) {
  if (family !== "about" && family !== "resume") throw new HttpError(400, "Unknown page");
  if (lang !== "en" && lang !== "tr") throw new HttpError(400, "Language must be en or tr");
  return assertSafePath(`content/${family}/${lang}.md`);
}

export function projectMdPath(folder, slug) {
  return assertSafePath(`content/projects/${folder}/${slug}.md`);
}

export function guidePath(id, lang) {
  const file = lang === "en" ? "EN.md" : "TR.md";
  return assertSafePath(`guides/${id}/${file}`);
}
