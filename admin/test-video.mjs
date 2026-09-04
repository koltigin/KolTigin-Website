import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { youtubeIdFromUrl } from "../workers/admin-api/src/markdown.js";

const root = dirname(fileURLToPath(import.meta.url));
const adminSrc = readFileSync(join(root, "admin.js"), "utf8");
const cmsSrc = readFileSync(join(root, "cms.js"), "utf8");
const i18nCtx = { window: {} };
vm.runInNewContext(readFileSync(join(root, "i18n.js"), "utf8"), i18nCtx);
const i18n = i18nCtx.window.ADMIN_I18N;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}`);
  assert(start !== -1, `${name} exists`);
  const next = src.indexOf("\n  function ", start + 1);
  return next === -1 ? src.slice(start) : src.slice(start, next);
}

const emptyEditorFn = extractFn(adminSrc, "emptyEditor");
assert(emptyEditorFn.includes("kind === 'videos'") && emptyEditorFn.includes("kind: isVideo ? 'videos'"), "new video editor stores kind videos");

const previewBlock = adminSrc.slice(adminSrc.indexOf("[data-preview-md]"), adminSrc.indexOf("[data-cover-pick]"));
assert(previewBlock.includes("form[data-video]") && previewBlock.includes("renderVideoEditor()"), "video refresh preview re-renders the video editor");
assert(previewBlock.includes("syncVideoFromForm()"), "video refresh preview keeps entered video fields");
assert(previewBlock.indexOf("renderVideoEditor()") < previewBlock.indexOf("renderWritingEditor()"), "video preview does not fall through to writings first");

const openEditorFn = adminSrc.slice(adminSrc.indexOf("async function openEditor"), adminSrc.indexOf("function markDirty"));
assert(openEditorFn.includes("if (kind === 'videos') state.editor.kind = 'videos'"), "openEditor keeps videos kind for new videos");

assert(i18n.en.save.action === "Save" && i18n.tr.save.action === "Kaydet", "production save labels");
assert(i18n.en.writings.save.includes("locally") && i18n.tr.writings.save.toLowerCase().includes("lokal"), "localhost writing save wording kept");
assert(i18n.en.video.save.includes("locally") && i18n.tr.video.save.toLowerCase().includes("lokal"), "localhost video save wording kept");
assert(adminSrc.includes("saveActionLabel('writings.save')") && adminSrc.includes("saveActionLabel('video.save')"), "writings and videos use environment save labels");
assert(cmsSrc.includes("saveActionLabel('cms.saveGuide')") && cmsSrc.includes("saveActionLabel('cms.saveProject')") && cmsSrc.includes("saveActionLabel('cms.saveAbout')"), "other editors use environment save labels");

const adminYoutube = extractFn(adminSrc, "youtubeIdFromUrl");
const cases = [
  ["https://www.youtube.com/watch?v=abcdefghijk", "abcdefghijk", "watch"],
  ["https://youtu.be/abcdefghijk", "abcdefghijk", "youtu.be"],
  ["https://www.youtube.com/shorts/abcdefghijk", "abcdefghijk", "shorts"],
  ["https://www.youtube.com/embed/abcdefghijk", "abcdefghijk", "embed"],
  ["https://www.youtube.com/live/abcdefghijk", "abcdefghijk", "live"],
  ["https://www.youtube.com/live/abcdefghijk?si=xyz", "abcdefghijk", "live query"],
  ["https://youtube.com/live/abcdefghijk", "abcdefghijk", "live no www"],
  ["https://www.youtube.com/playlist?list=PLabcdefghijk", "", "playlist rejected"],
  ["https://www.youtube.com/channel/UCabcdefghijk", "", "channel rejected"],
  ["https://example.com/live/abcdefghijk", "", "non-youtube rejected"]
];
for (const [url, expected, label] of cases) {
  assert(youtubeIdFromUrl(url) === expected, `worker youtube ${label}`);
}
assert(adminYoutube.includes("live") && adminYoutube.includes("shorts") && adminYoutube.includes("{11}"), "admin parser accepts live/shorts 11-char ids");
assert(!adminYoutube.includes("youtube.com/"), "admin parser uses host+path checks rather than arbitrary youtube paths");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all video admin tests passed");
