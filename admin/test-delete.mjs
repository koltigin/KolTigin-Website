import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const {
  showEntityDelete,
  allowsEntityDelete,
  isProtectedCorePage,
  deletedMessage,
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
function tr(lang, key) {
  return key.split(".").reduce((obj, part) => obj && obj[part], i18n[lang]);
}

assert(tr("en", "cms.delete") === "Delete", "EN delete label");
assert(tr("tr", "cms.delete") === "Sil", "TR delete label");
assert(tr("en", "cms.deleteTitle") === "Delete this item?", "EN confirm title");
assert(tr("tr", "cms.deleteTitle") === "Bu içerik silinsin mi?", "TR confirm title");
assert(tr("en", "cms.deleteCancel") === "Cancel", "EN cancel");
assert(tr("tr", "cms.deleteCancel") === "İptal", "TR cancel");
assert(tr("en", "save.deleted") === "Deleted successfully.", "production EN delete notice");
assert(tr("tr", "save.deleted") === "Başarıyla silindi.", "production TR delete notice");
assert(deletedMessage(true, (key) => tr("en", key)) === "Deleted successfully.", "deletedMessage production");
assert(deletedMessage(false, (key) => tr("en", key)) === "Deleted locally.", "deletedMessage local");

assert(showEntityDelete(true) === true, "existing item can show Delete");
assert(showEntityDelete(false) === false, "unsaved/new item has no Delete");
assert(showEntityDelete("") === false, "empty id has no Delete");

assert(allowsEntityDelete("writing") && allowsEntityDelete("video") && allowsEntityDelete("guide") && allowsEntityDelete("project"), "content families allow delete");
assert(!allowsEntityDelete("about") && !allowsEntityDelete("resume") && !allowsEntityDelete("contact"), "core pages are not delete families");
assert(isProtectedCorePage("about") && isProtectedCorePage("resume") && isProtectedCorePage("profile") && isProtectedCorePage("social") && isProtectedCorePage("contact"), "core pages protected");

const writingReq = deleteRequest("writing", { id: "smoke-note", kind: "articles" });
assert(writingReq.path === "/admin/api/save" && writingReq.body.action === "delete", "writing uses existing save endpoint");
assert(deleteRequest("video", { id: "demo" }).body.kind === "videos", "video uses existing save endpoint");
assert(deleteRequest("guide", { id: "aioz-depin" }).path === "/admin/api/guide-delete", "guide uses existing guide-delete endpoint");
assert(deleteRequest("project", { id: "ario" }).path === "/admin/api/project-save", "project uses existing project-save endpoint");

const session = createDeleteConfirm();
assert(session.current() === null, "no pending confirm initially");
session.request({ family: "project", id: "ario", title: "AR.IO" });
assert(session.current() && session.current().confirmed === false, "confirmation is required before delete");
session.cancel();
assert(session.current() === null, "Cancel clears pending delete");
session.request({ family: "writing", id: "smoke-note", kind: "articles", title: "Smoke" });
const confirmed = session.confirm();
assert(confirmed && confirmed.confirmed === true && confirmed.id === "smoke-note", "confirm returns the pending entity");

const adminSrc = readFileSync(join(root, "admin.js"), "utf8");
const cmsSrc = readFileSync(join(root, "cms.js"), "utf8");
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}`);
  assert(start !== -1, `${name} exists`);
  const next = src.indexOf("\n  function ", start + 1);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

const writingFn = extractFn(adminSrc, "renderWritingEditor");
const videoFn = extractFn(adminSrc, "renderVideoEditor");
const profileFn = extractFn(adminSrc, "renderProfile");
const socialFn = extractFn(adminSrc, "renderSocial");
const pageFn = extractFn(cmsSrc, "renderPageEditor");
const contactFn = extractFn(cmsSrc, "renderContact");
const projectFn = extractFn(cmsSrc, "renderProjectEditor");
const guideFn = extractFn(cmsSrc, "renderGuideEditor");

assert(writingFn.includes("entityDeleteButton(editor.mode === 'edit'"), "writings show Delete only when editing");
assert(videoFn.includes("entityDeleteButton(state.editor.mode === 'edit'"), "videos show Delete only when editing");
assert(projectFn.includes("entityDeleteButton(p.id && p.fromCategory)"), "projects show Delete only for saved items");
assert(guideFn.includes("entityDeleteButton(g.locked && g.id)"), "guides show Delete only for saved guides");
assert(!pageFn.includes("entityDeleteButton") && !pageFn.includes("data-entity-delete"), "no Delete button for About/Resume");
assert(!contactFn.includes("entityDeleteButton") && !contactFn.includes("data-entity-delete"), "no Delete button for Contact");
assert(!profileFn.includes("entityDeleteButton") && !profileFn.includes("data-entity-delete"), "no Delete button for Profile");
assert(!socialFn.includes("entityDeleteButton") && !socialFn.includes("data-entity-delete"), "no Delete button for Social Links");
assert(adminSrc.includes("data-delete-cancel") && adminSrc.includes("data-delete-confirm"), "confirmation dialog has Cancel and Delete");
assert(!cmsSrc.includes("data-delete-guide"), "guide no longer uses immediate confirm()/delete");
assert(adminSrc.includes("keepNoticeOnHash"), "delete success notice survives list navigation");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all delete UX tests passed");
