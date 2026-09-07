import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const {
  applyLocaleFields,
  writingSaveRequest
} = createRequire(join(root, "content-sync.js"))("./content-sync.js");

const adminSrc = readFileSync(join(root, "admin.js"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

function emptyEditor() {
  return {
    kind: "articles",
    lang: "en",
    sharedId: "",
    pair: { date: "2026-09-07", externalUrl: "" },
    langs: {
      en: { title: "", body: "", exists: false, cover: "" },
      tr: { title: "", body: "", exists: false, cover: "" }
    }
  };
}

const editor = emptyEditor();
applyLocaleFields(editor, [
  { locale: "en", field: "title", value: "Bilingual Writing Production Test", hidden: false },
  { locale: "en", field: "body", value: "English body for the production test.", hidden: false },
  { locale: "tr", field: "title", value: "", hidden: true },
  { locale: "tr", field: "body", value: "", hidden: true }
]);
editor.lang = "tr";
applyLocaleFields(editor, [
  { locale: "en", field: "title", value: "", hidden: true },
  { locale: "en", field: "body", value: "", hidden: true },
  { locale: "tr", field: "title", value: "İki Dilli Yazı Production Testi", hidden: false },
  { locale: "tr", field: "body", value: "Türkçe gövde.", hidden: false }
]);
editor.lang = "en";
applyLocaleFields(editor, [
  { locale: "en", field: "title", value: "Bilingual Writing Production Test", hidden: false },
  { locale: "en", field: "body", value: "English body for the production test.", hidden: false },
  { locale: "tr", field: "title", value: "", hidden: true },
  { locale: "tr", field: "body", value: "", hidden: true }
]);

const request = writingSaveRequest(editor, "bilingual-writing-production-test", {
  date: "2026-09-07",
  isExternal: false
});
assert(request && request.locales.length === 2, "one Save payload includes both locales after EN→TR→EN tab switches");
assert(request.locales.some((row) => row.lang === "en" && row.title === "Bilingual Writing Production Test"), "EN title survives hidden-tab empty DOM");
assert(request.locales.some((row) => row.lang === "tr" && row.title === "İki Dilli Yazı Production Testi"), "TR title is kept after switching back to EN");
assert(request.locales.every((row) => row.id == null), "locale entries do not carry a separate id");

const tabBlock = adminSrc.slice(
  adminSrc.indexOf("const tab = event.target.closest('[data-lang]')"),
  adminSrc.indexOf("const pLang = event.target.closest('[data-profile-lang]')")
);
assert(tabBlock.includes("showWritingLocalePanels"), "language tabs toggle visible panels instead of replacing the form");
assert(!tabBlock.includes("renderWritingEditor()"), "language tabs do not innerHTML-replace the editor");
assert(adminSrc.includes("mergeLocaleField"), "typing updates only the active locale field through mergeLocaleField");
assert(adminSrc.includes("applyLocaleFields"), "Save reads both locale panels through applyLocaleFields");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all bilingual writing DOM admin tests passed");
