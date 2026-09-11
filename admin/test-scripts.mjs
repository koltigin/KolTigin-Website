import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, "index.html"), "utf8");
const i18n = readFileSync(join(root, "i18n.js"), "utf8");
const admin = readFileSync(join(root, "admin.js"), "utf8");
const cms = readFileSync(join(root, "cms.js"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

assert(i18n.includes("scripts: 'Scripts'") && i18n.includes("scripts: 'Scriptler'"), "Admin Scripts page/section renders nav labels");
assert(admin.includes("navLink('#/scripts'") && admin.includes("href=\"#/scripts\""), "Scripts is in admin nav and dashboard");
assert(cms.includes("page === 'scripts'") && cms.includes("renderScripts"), "Scripts route is handled");
assert(cms.includes("/admin/api/script-upload") && cms.includes("overwrite"), "upload form posts to the Worker upload route");
assert(cms.includes("/admin/api/script-delete") && cms.includes("scripts.deleteConfirm"), "delete requires confirmation");
assert(cms.includes("https://koltigin.xyz/downloads/") || cms.includes("item.url"), "list uses generated public URLs");
assert(i18n.includes("Upload / Update") && i18n.includes("Yükle / Güncelle"), "bilingual upload button");
assert(html.includes("cms.js?v=v3.17") && html.includes("admin.js?v=v3.18"), "Scripts UI cache-bust");
assert(cms.includes("data.options") && cms.includes("optgroup") && cms.includes("scriptCatalogOptions"), "Scripts project dropdown is populated from canonical Projects options");
assert(cms.includes("(group.scripts || []).length") && !cms.includes("id: 'redbelly', label:"), "existing Scripts groups skip empty projects and are not hard-coded");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all admin scripts UI tests passed");
