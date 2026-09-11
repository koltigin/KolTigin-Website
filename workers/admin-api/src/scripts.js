import { HttpError } from "./util.js";
import { assertSafePath } from "./paths.js";

export const SCRIPT_UPLOAD_LIMIT = 1_000_000;
export const SCRIPT_SITE_ORIGIN = "https://koltigin.xyz";
export const SCRIPT_PROJECT_ORDER = ["redbelly", "ario", "common"];
export const SCRIPT_PROJECTS = {
  redbelly: { en: "Redbelly", tr: "Redbelly" },
  ario: { en: "AR.IO", tr: "AR.IO" },
  common: { en: "Common", tr: "Common" }
};
export const SCRIPT_EXTENSIONS = new Set([".sh", ".py", ".js", ".json", ".yaml", ".yml", ".toml", ".txt"]);
const SCRIPT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

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

export function resolveScriptProject(raw) {
  const id = String(raw || "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SCRIPT_PROJECTS, id)) {
    throw new HttpError(400, "Unknown project");
  }
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

export function scriptRepoPath(project, filename) {
  const id = resolveScriptProject(project);
  const stored = sanitizeScriptFilename(filename);
  return assertSafePath(`downloads/${id}/${stored}`);
}

export function parseDownloadPath(path) {
  const raw = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = raw.split("/");
  if (parts.length !== 3 || parts[0] !== "downloads") return null;
  try {
    const project = resolveScriptProject(parts[1]);
    const filename = sanitizeScriptFilename(parts[2]);
    if (`downloads/${project}/${filename}` !== raw) return null;
    return { project, filename };
  } catch {
    return null;
  }
}

export function publicScriptUrl(project, filename) {
  const id = resolveScriptProject(project);
  const stored = sanitizeScriptFilename(filename);
  return `${SCRIPT_SITE_ORIGIN}/downloads/${id}/${stored}`;
}

export function isOverwriteFlag(value) {
  const text = String(value == null ? "" : value).trim().toLowerCase();
  return value === true || text === "1" || text === "true" || text === "yes";
}

export function scriptCommitMessage(action, project, filename) {
  const verb = action === "update" ? "Update" : action === "delete" ? "Delete" : "Add";
  return `${verb} downloadable script: ${project}/${filename}`;
}
