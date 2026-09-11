import { JSON_LIMIT, UPLOAD_LIMIT, HttpError, jsonOk, jsonErr, safeExceptionDetail } from "./util.js";
import { assertAccess } from "./access.js";
import { createGitHub } from "./github.js";
import { POST_HANDLERS, handleUpload, handleScriptUpload } from "./handlers.js";
import { SCRIPT_UPLOAD_LIMIT } from "./scripts.js";

const UPLOADS = {
  "/api/admin/cover": "cover",
  "/api/admin/avatar": "avatar",
  "/api/admin/project-logo": "project-logo",
  "/api/admin/guide-image": "guide-image"
};

function pathnameOf(url) {
  return new URL(url).pathname.replace(/\/+$/, "") || "/";
}

async function parseJson(request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > JSON_LIMIT) throw new HttpError(413, "Request is too large");
  const text = await request.text();
  if (text.length > JSON_LIMIT) throw new HttpError(413, "Request is too large");
  try {
    const data = JSON.parse(text || "{}");
    if (!data || typeof data !== "object") throw new Error("not object");
    return data;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

async function parseUpload(request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > UPLOAD_LIMIT + 32_000) throw new HttpError(413, "Image is too large");
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Choose an image file");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > UPLOAD_LIMIT) throw new HttpError(413, "Image is too large");
  const fields = {};
  for (const [key, value] of form.entries()) {
    if (key === "file") continue;
    if (typeof value === "string") fields[key] = value;
  }
  return { file: { name: file.name || "upload", bytes }, fields };
}

async function parseScriptUpload(request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > SCRIPT_UPLOAD_LIMIT + 32_000) throw new HttpError(413, "File is too large");
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Choose a script file");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > SCRIPT_UPLOAD_LIMIT) throw new HttpError(413, "File is too large");
  const fields = {};
  for (const [key, value] of form.entries()) {
    if (key === "file") continue;
    if (typeof value === "string") fields[key] = value;
  }
  return { file: { name: file.name || "upload", bytes }, fields };
}

export async function handleRequest(request, env) {
  const path = pathnameOf(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") {
    return jsonErr(405, "Method not allowed");
  }
  if (!path.startsWith("/api/admin/")) return jsonErr(404, "Not found");
  try {
    await assertAccess(request, env);
    const github = createGitHub(env);
    if (path === "/api/admin/script-upload") {
      const { file, fields } = await parseScriptUpload(request);
      const payload = await handleScriptUpload(file, fields, github);
      return jsonOk(payload);
    }
    if (UPLOADS[path]) {
      const { file, fields } = await parseUpload(request);
      const payload = await handleUpload(UPLOADS[path], file, fields, github);
      return jsonOk(payload);
    }
    const handler = POST_HANDLERS[path];
    if (!handler) return jsonErr(404, "Not found");
    const body = await parseJson(request);
    const payload = await handler(body, github);
    return jsonOk(payload);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const publicMessage = error instanceof HttpError ? error.message : "Publish failed";
    if (error instanceof HttpError) {
      console.error("admin-api", pathnameOf(request.url), status, publicMessage);
    } else {
      console.error(
        "admin-api",
        pathnameOf(request.url),
        status,
        publicMessage,
        safeExceptionDetail(error)
      );
    }
    return jsonErr(status, publicMessage);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
