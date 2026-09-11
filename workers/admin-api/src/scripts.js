import { HttpError, ID_RE } from "./util.js";
import { assertSafePath } from "./paths.js";
import { compareProjectNames } from "./generate.js";

export const SCRIPT_UPLOAD_LIMIT = 1_000_000;
export const SCRIPT_SITE_ORIGIN = "https://koltigin.xyz";
export const COMMON_SCRIPT_PROJECT = "common";
export const SCRIPT_EXTENSIONS = new Set([".sh", ".py", ".js", ".json", ".yaml", ".yml", ".toml", ".txt"]);
const SCRIPT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const PREFERRED_SCRIPT_CATEGORY_ORDER = [
  "mainnet",
  "activeTestnets",
  "depin",
  "completedTestnets",
  "completedDefi",
  "defi",
  "builtByMe"
];

// Published folder for Redbelly Network. Do not rename existing files.
export const LEGACY_DOWNLOAD_FOLDERS = {
  "redbelly-network": "redbelly"
};

function decodeRepeats(raw) {
  let value = String(raw || "");
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(value.replace(/\+/g, "%20"));
      if (next === value) break;
      value = next;
    } catch {
      throw new HttpError(400, "Invalid filename");
    }
  }
  return value;
}

export function downloadFolder(projectId) {
  const id = String(projectId || "").trim().toLowerCase();
  return LEGACY_DOWNLOAD_FOLDERS[id] || id;
}

export function getAllowedDownloadProjects(projectsJson) {
  const allowed = new Set([COMMON_SCRIPT_PROJECT]);
  for (const items of Object.values(projectsJson || {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const id = String((item && item.id) || "").trim().toLowerCase();
      if (ID_RE.test(id)) allowed.add(id);
    }
  }
  for (const [canonical, folder] of Object.entries(LEGACY_DOWNLOAD_FOLDERS)) {
    if (allowed.has(canonical) && ID_RE.test(folder)) allowed.add(folder);
  }
  return allowed;
}

export function buildScriptOptions(projectsJson, categories) {
  const cats = Array.isArray(categories) ? categories : [];
  const catById = new Map(cats.map((item) => [item.id, item]));
  const ordered = [
    ...PREFERRED_SCRIPT_CATEGORY_ORDER.filter((id) => cats.some((item) => item.id === id)),
    ...cats.map((item) => item.id).filter((id) => !PREFERRED_SCRIPT_CATEGORY_ORDER.includes(id))
  ];
  const seen = new Set();
  const options = [];
  for (const categoryId of ordered) {
    const cat = catById.get(categoryId);
    const items = Array.isArray(projectsJson && projectsJson[categoryId]) ? projectsJson[categoryId] : [];
    const named = items.filter((item) => item && ID_RE.test(String(item.id || "").trim().toLowerCase()));
    named.sort((a, b) => compareProjectNames(a.name, b.name) || String(a.id).localeCompare(String(b.id)));
    for (const item of named) {
      const id = String(item.id).trim().toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      options.push({
        id,
        name: String(item.name || id),
        folder: downloadFolder(id),
        categoryId,
        categoryLabel: (cat && cat.label) || { en: categoryId, tr: categoryId }
      });
    }
  }
  options.push({
    id: COMMON_SCRIPT_PROJECT,
    name: "Common",
    folder: COMMON_SCRIPT_PROJECT,
    categoryId: COMMON_SCRIPT_PROJECT,
    categoryLabel: { en: "Common", tr: "Common" }
  });
  return options;
}

export function resolveScriptProject(raw, allowed) {
  const id = String(raw || "").trim().toLowerCase();
  if (!ID_RE.test(id)) throw new HttpError(400, "Unknown project");
  if (!(allowed instanceof Set) || !allowed.has(id)) throw new HttpError(400, "Unknown project");
  return id;
}

export function scriptExtension(name) {
  const match = String(name || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

export function sanitizeScriptFilename(raw, fallbackExt = "") {
  let name = decodeRepeats(raw).trim();
  if (!name || name.includes("\0") || [...name].some((ch) => ch.charCodeAt(0) < 32)) {
    throw new HttpError(400, "Invalid filename");
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\") || name.includes(":")) {
    throw new HttpError(400, "Invalid filename");
  }
  if (name.startsWith(".")) throw new HttpError(400, "Invalid filename");
  let ext = scriptExtension(name);
  if (!ext && fallbackExt) {
    name = `${name}${fallbackExt.startsWith(".") ? fallbackExt : `.${fallbackExt}`}`;
    ext = scriptExtension(name);
  }
  if (!SCRIPT_EXTENSIONS.has(ext)) throw new HttpError(400, "Unsupported file type");
  if (!SCRIPT_NAME_RE.test(name)) throw new HttpError(400, "Invalid filename");
  if (name.length > 120) throw new HttpError(400, "Invalid filename");
  return name;
}

export function scriptRepoPath(project, filename, allowed) {
  const id = resolveScriptProject(project, allowed);
  const folder = downloadFolder(id);
  if (!ID_RE.test(folder) || !allowed.has(folder)) throw new HttpError(400, "Unknown project");
  const stored = sanitizeScriptFilename(filename);
  return assertSafePath(`downloads/${folder}/${stored}`);
}

export function parseDownloadPath(path) {
  const raw = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = raw.split("/");
  if (parts.length !== 3 || parts[0] !== "downloads") return null;
  const folder = String(parts[1] || "").trim().toLowerCase();
  if (!ID_RE.test(folder)) return null;
  try {
    const filename = sanitizeScriptFilename(parts[2]);
    if (`downloads/${folder}/${filename}` !== raw) return null;
    return { project: folder, filename };
  } catch {
    return null;
  }
}

export function publicScriptUrl(project, filename) {
  const folder = downloadFolder(project);
  const stored = sanitizeScriptFilename(filename);
  if (!ID_RE.test(folder)) throw new HttpError(400, "Unknown project");
  return `${SCRIPT_SITE_ORIGIN}/downloads/${folder}/${stored}`;
}

export function isOverwriteFlag(value) {
  const text = String(value == null ? "" : value).trim().toLowerCase();
  return value === true || text === "1" || text === "true" || text === "yes";
}

export function scriptCommitMessage(action, project, filename) {
  const folder = downloadFolder(project);
  const verb = action === "update" ? "Update" : action === "delete" ? "Delete" : "Add";
  return `${verb} downloadable script: ${folder}/${filename}`;
}
