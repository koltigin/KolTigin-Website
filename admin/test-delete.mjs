import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const {
  allowsEntityDelete,
  isProtectedCorePage,
  deletedItemMessage,
  specFromDataset,
  deleteRequest,
  createDeleteConfirm
} = createRequire(join(root, "delete-logic.js"))("./delete-logic.js");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(root, "i18n.js"), "utf8"), ctx);
const i18n = ctx.window.ADMIN_I18N;
function tr(lang, key, vars) {
  let text = key.split(".").reduce((obj, part) => obj && obj[part], i18n[lang]) || "";
  if (vars) {
    Object.entries(vars).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, String(value));
    });
  }
  return text;
}

assert(tr("en", "cms.delete") === "Delete", "EN delete label");
assert(tr("tr", "cms.delete") === "Sil", "TR delete label");
assert(tr("en", "writings.editBtn") === "Edit" && tr("en", "writings.preview") === "Preview", "EN list actions");
assert(tr("tr", "writings.editBtn") === "Düzenle" && tr("tr", "writings.preview") === "Ön izle", "TR list actions");
assert(deletedItemMessage("AIOZ DePIN CLI v1.2.6 Installation Guide", (key, vars) => tr("en", key, vars)) === "AIOZ DePIN CLI v1.2.6 Installation Guide deleted.", "EN red notice includes title");
assert(deletedItemMessage("AIOZ DePIN CLI v1.2.6 Installation Guide", (key, vars) => tr("tr", key, vars)) === "AIOZ DePIN CLI v1.2.6 Installation Guide silindi.", "TR red notice includes title");

assert(allowsEntityDelete("writing") && allowsEntityDelete("video") && allowsEntityDelete("guide") && allowsEntityDelete("project"), "content families allow delete");
assert(!allowsEntityDelete("about") && !allowsEntityDelete("resume") && !allowsEntityDelete("contact"), "core pages are not delete families");
assert(isProtectedCorePage("about") && isProtectedCorePage("profile") && isProtectedCorePage("social") && isProtectedCorePage("contact"), "core pages protected");

const guideClick = specFromDataset({
  entityDelete: "guide",
  deleteId: "aioz-depin",
  deleteTitle: "AIOZ DePIN CLI v1.2.6 Installation Guide"
});
const leftoverVideo = specFromDataset({
  entityDelete: "video",
  deleteId: "ar-io-comprehensive-guide",
  deleteTitle: "AR.IO | Comprehensive guide"
});
assert(guideClick && guideClick.type === "guide" && guideClick.id === "aioz-depin", "guide click carries guide id");
assert(guideClick.title.includes("AIOZ"), "guide confirmation title comes from the card");
assert(leftoverVideo.id !== guideClick.id, "AIOZ guide delete does not target AR.IO video");
assert(deleteRequest(guideClick).path === "/admin/api/guide-delete", "guide uses production guide-delete");
assert(deleteRequest(guideClick).body.id === "aioz-depin", "guide delete body uses card id");

const writingClick = specFromDataset({
  entityDelete: "writing",
  deleteId: "smoke-note",
  deleteKind: "articles",
  deleteTitle: "Smoke"
});
assert(deleteRequest(writingClick).path === "/admin/api/save" && deleteRequest(writingClick).body.kind === "articles", "writing delete uses existing save endpoint");
assert(deleteRequest(specFromDataset({ entityDelete: "video", deleteId: "demo" })).body.kind === "videos", "video delete uses existing save endpoint");
assert(deleteRequest(specFromDataset({ entityDelete: "project", deleteId: "ario" })).path === "/admin/api/project-save", "project delete uses existing project-save endpoint");
assert(specFromDataset({ entityDelete: "guide" }) === null, "Delete without id is rejected");

const session = createDeleteConfirm();
session.request({ family: "guide", id: "aioz-depin", title: "AIOZ DePIN CLI v1.2.6 Installation Guide" });
assert(session.current() && session.current().confirmed === false && session.current().id === "aioz-depin", "confirmation is required before delete");
session.cancel();
assert(session.current() === null, "Cancel makes no changes");
session.request({ family: "video", id: "ar-io-comprehensive-guide", title: "AR.IO | Comprehensive guide" });
assert(session.current().id === "ar-io-comprehensive-guide", "video card delete targets that video");
session.request({ family: "guide", id: "aioz-depin", title: "AIOZ DePIN CLI v1.2.6 Installation Guide" });
assert(session.current().id === "aioz-depin" && session.current().type === "guide", "later guide click replaces pending video");

const adminSrc = readFileSync(join(root, "admin.js"), "utf8");
const cmsSrc = readFileSync(join(root, "cms.js"), "utf8");
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}`);
  assert(start !== -1, `${name} exists`);
  const next = src.indexOf("\n  function ", start + 1);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

const writingList = extractFn(adminSrc, "renderWritingsList");
const videoList = extractFn(adminSrc, "renderVideosList");
const writingEditor = extractFn(adminSrc, "renderWritingEditor");
const videoEditor = extractFn(adminSrc, "renderVideoEditor");
const profileFn = extractFn(adminSrc, "renderProfile");
const socialFn = extractFn(adminSrc, "renderSocial");
const pageFn = extractFn(cmsSrc, "renderPageEditor");
const contactFn = extractFn(cmsSrc, "renderContact");
const projectList = extractFn(cmsSrc, "renderProjectsList");
const guideList = extractFn(cmsSrc, "renderGuidesList");
const projectEditor = extractFn(cmsSrc, "renderProjectEditor");
const guideEditor = extractFn(cmsSrc, "renderGuideEditor");

assert(writingList.includes("entityDeleteButton({ family: 'writing'") && writingList.includes("item.id"), "writings list cards have Delete");
assert(videoList.includes("entityDeleteButton({ family: 'video'"), "videos list cards have Delete");
assert(projectList.includes("family: 'project'") && guideList.includes("family: 'guide'"), "project and guide lists have Delete");
assert(!writingEditor.includes("entityDeleteButton") && !videoEditor.includes("entityDeleteButton"), "no Delete on writing/video edit forms");
assert(!projectEditor.includes("entityDeleteButton") && !guideEditor.includes("entityDeleteButton"), "no Delete on project/guide edit forms");
assert(!pageFn.includes("data-entity-delete") && !contactFn.includes("data-entity-delete"), "no Delete for About/Resume/Contact");
assert(!profileFn.includes("data-entity-delete") && !socialFn.includes("data-entity-delete"), "no Delete for Profile/Social Links");
assert(adminSrc.includes("specFromDataset(entityDelete.dataset)"), "delete uses the clicked card dataset, not editor state");
assert(adminSrc.includes("ok-destructive") && adminSrc.includes("tone: 'destructive'"), "success notice uses destructive red tone");
assert(adminSrc.includes("reloadCanonicalList"), "successful delete reloads canonical list");
assert(adminSrc.includes("parseJsonResponse(response)") && adminSrc.includes("data.error === t('errors.api')"), "production API JSON errors are not swallowed as disconnected");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all delete UX tests passed");
