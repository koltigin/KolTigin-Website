import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const {
  markdownHasContent,
  localesFromLangs,
  guideSaveRequest,
  pageSaveRequest,
  saveShouldShowSuccess,
  syncGuideEditorFields,
  switchGuideLang
} = createRequire(join(root, "cms-save.js"))("./cms-save.js");

const cmsSrc = readFileSync(join(root, "cms.js"), "utf8");
const htmlSrc = readFileSync(join(root, "index.html"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

assert(markdownHasContent("# Guide Title\n\nBody"), "real heading plus body counts as filled");
assert(markdownHasContent("# Guide Title"), "real heading counts as filled");
assert(!markdownHasContent("# \n\n"), "empty heading placeholder is not filled");
assert(!markdownHasContent("#"), "bare hash is not filled");
assert(!markdownHasContent("   "), "whitespace is not filled");

const guideDraft = {
  id: "bilingual-guide",
  lang: "tr",
  projectId: "optimai",
  cover: "hero.png",
  langs: {
    en: "# Bilingual Guide\n\nEnglish body.",
    tr: "# Iki Dilli Rehber\n\nTurkce govde."
  }
};
const guideRequest = guideSaveRequest(guideDraft);
assert(guideRequest && guideRequest.locales.length === 2, "guide payload includes both locales when both are filled");
assert(guideDraft.lang === "tr" && guideRequest.locales[0].lang === "en", "active TR tab does not drop the EN guide locale");
assert(!("lang" in guideRequest) && !("markdown" in guideRequest), "guide bilingual payload does not send a single-locale lang/markdown pair");

guideDraft.lang = "en";
assert(guideSaveRequest(guideDraft).locales.length === 2, "active EN tab still sends both filled guide locales");

const trOnly = guideSaveRequest({
  id: "tr-only",
  lang: "en",
  langs: { en: "# \n\n", tr: "# Rehber\n\nGovde" }
});
assert(trOnly && trOnly.locales.length === 1 && trOnly.locales[0].lang === "tr", "placeholder EN guide locale is omitted");

assert(guideSaveRequest({ id: "empty", lang: "en", langs: { en: "# \n\n", tr: "# \n\n" } }) == null, "placeholder-only guide draft does not build a save request");

const aboutDraft = {
  family: "about",
  lang: "tr",
  langs: {
    en: "# About\n\n## What I Do\n\n### Ops\nicon: rocket-outline\n",
    tr: "# Hakkında\n\n## Ne Yapıyorum\n\n### Ops\nicon: rocket-outline\n"
  }
};
const aboutRequest = pageSaveRequest(aboutDraft);
assert(aboutRequest && aboutRequest.family === "about" && aboutRequest.locales.length === 2, "about payload includes both locales when both are filled");
assert(aboutDraft.lang === "tr" && aboutRequest.locales.some((row) => row.lang === "en"), "active About tab does not choose the saved locale");

const aboutEnOnly = pageSaveRequest({
  family: "about",
  lang: "tr",
  langs: { en: "# About\n\nUpdated", tr: "# \n\n" }
});
assert(aboutEnOnly.locales.length === 1 && aboutEnOnly.locales[0].lang === "en", "empty About locale is omitted");

const resumeDraft = {
  family: "resume",
  lang: "en",
  langs: {
    en: "# Resume\n\n## Experience\n",
    tr: "# Özgeçmiş\n\n## Deneyim\n"
  }
};
const resumeRequest = pageSaveRequest(resumeDraft);
assert(resumeRequest && resumeRequest.family === "resume" && resumeRequest.locales.length === 2, "resume payload includes both locales when both are filled");
assert(resumeDraft.lang === "en" && resumeRequest.locales.some((row) => row.lang === "tr"), "active Resume tab does not drop the other locale");

assert(saveShouldShowSuccess(["en", "tr"], ["en", "tr"]), "success when every requested locale was saved");
assert(!saveShouldShowSuccess(["en", "tr"], ["tr"]), "no success when a requested locale is missing from langs");
assert(!saveShouldShowSuccess(["en", "tr"], []), "no success when langs is empty");

const saveGuideFn = cmsSrc.slice(cmsSrc.indexOf("async function saveGuide"), cmsSrc.indexOf("function renderContact"));
assert(saveGuideFn.includes("guideSaveRequest") && saveGuideFn.includes("locales"), "saveGuide posts locales from cms-save");
assert((saveGuideFn.match(/await H\(\)\.api\('\/admin\/api\/guide-save'/g) || []).length === 1, "saveGuide makes one Worker request");
assert(!saveGuideFn.includes("lang: g.lang"), "saveGuide does not send the active tab as lang");
assert(saveGuideFn.includes("saveShouldShowSuccess"), "saveGuide requires response langs before success");
assert(saveGuideFn.includes("savedLangs.includes('en') || Boolean(prev.existsEn)"), "guide EN existence comes from saved langs, not placeholder markdown");

const savePageFn = cmsSrc.slice(cmsSrc.indexOf("async function savePage"), cmsSrc.indexOf("function renderProjectsList"));
assert(savePageFn.includes("pageSaveRequest"), "savePage uses the shared bilingual page contract");
assert((savePageFn.match(/await H\(\)\.api\('\/admin\/api\/page'/g) || []).length === 1, "savePage makes one Worker request");
assert(!savePageFn.includes("for (const lang of") && !savePageFn.includes("draft.family === 'about' ? ['en', 'tr']"), "About/Resume no longer loop per-locale page POSTs");
assert(savePageFn.includes("applyServiceIcons") && savePageFn.indexOf("applyServiceIcons") < savePageFn.indexOf("pageSaveRequest"), "About icons are applied to both markdowns before the bilingual request");
assert(savePageFn.includes("saveShouldShowSuccess"), "savePage requires response langs before success");
assert(localesFromLangs(aboutDraft.langs).length === 2, "localesFromLangs keeps filled About markdown");

assert(htmlSrc.includes("cms-save.js?v=v3.2") && htmlSrc.includes("cms.js?v=v3.15"), "admin HTML cache-busts cms-save and cms.js");

const sharedGuide = {
  id: "ario-guide",
  lang: "en",
  cover: "hero.png",
  projectId: "",
  langs: {
    en: "# AR.IO Guide\n\nEnglish body.",
    tr: "# AR.IO Rehberi\n\nTurkce govde."
  }
};
syncGuideEditorFields(sharedGuide, { markdown: "# AR.IO Guide\n\nEnglish body.", projectId: "ario" });
assert(sharedGuide.projectId === "ario" && sharedGuide.lang === "en", "EN tab writes AR.IO into shared projectId");
switchGuideLang(sharedGuide, "tr");
assert(sharedGuide.projectId === "ario" && sharedGuide.lang === "tr" && sharedGuide.cover === "hero.png", "TR tab keeps AR.IO and shared cover");
syncGuideEditorFields(sharedGuide, { markdown: "# AR.IO Rehberi\n\nTurkce govde.", projectId: sharedGuide.projectId });
switchGuideLang(sharedGuide, "en");
assert(sharedGuide.projectId === "ario" && sharedGuide.lang === "en", "returning to EN still shows AR.IO");
const sharedSave = guideSaveRequest(sharedGuide);
assert(sharedSave.projectId === "ario" && sharedSave.locales.length === 2, "one Save payload keeps shared AR.IO projectId with both locales");
syncGuideEditorFields(sharedGuide, { projectId: "" });
switchGuideLang(sharedGuide, "tr");
switchGuideLang(sharedGuide, "en");
assert(sharedGuide.projectId === "", "None selection is also kept across language tabs");
assert(guideSaveRequest(sharedGuide).projectId === "", "Save payload sends empty projectId after None");

const tabStart = cmsSrc.indexOf("const gLang = event.target.closest('[data-guide-lang]')");
const tabBlock = cmsSrc.slice(tabStart, cmsSrc.indexOf("if (event.target.closest('[data-save-guide]')", tabStart));
assert(tabBlock.includes("syncGuideDraftFromForm") && tabBlock.includes("switchGuideLang"), "language tabs sync shared projectId before re-rendering");
assert(cmsSrc.includes("data-gfield=\"projectId\"") && cmsSrc.includes("g.projectId === p.id"), "renderGuideEditor reselects the shared projectId");
assert(cmsSrc.includes("matches('[data-gfield=\"projectId\"]')"), "project select change writes shared guideDraft.projectId");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all cms bilingual save tests passed");
