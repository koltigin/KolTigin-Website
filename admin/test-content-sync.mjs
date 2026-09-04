import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const {
  scalarTitle,
  writingListTitle,
  videoListTitle,
  upsertById,
  mergeRemoteList,
  writingFromEditor,
  videoFromEditor,
  parseFrontMatter
} = createRequire(join(root, "content-sync.js"))("./content-sync.js");

const adminSrc = readFileSync(join(root, "admin.js"), "utf8");
const cmsSrc = readFileSync(join(root, "cms.js"), "utf8");
const staticSrc = readFileSync(join(root, "static-source.js"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const enTitle = "Test Article Title";
const trTitle = "Deneme Yazisi Basligi";
const editor = {
  kind: "articles",
  lang: "en",
  pair: { date: "2026-09-04", externalUrl: "" },
  langs: {
    en: { title: enTitle, body: "Hello world body", exists: true, cover: "" },
    tr: { title: trTitle, body: "Merhaba dunya", exists: true, cover: "" }
  }
};

const created = writingFromEditor(editor, "test-article-title");
let list = [];
list = upsertById(list, created);
assert(list.length === 1 && list[0].id === "test-article-title", "create writing upserts into empty list without refresh");
assert(writingListTitle(list[0], "en") === enTitle, "EN admin shows complete EN title");
assert(writingListTitle(list[0], "tr") === trTitle, "TR admin shows complete TR title");
assert(writingListTitle(list[0], "en").length > 1, "EN title is not a single character");
assert(writingListTitle(list[0], "tr").length > 1, "TR title is not a single character");

const staleRemote = [];
const afterStaleReload = mergeRemoteList(staleRemote, list);
assert(afterStaleReload.some((item) => item.id === "test-article-title"), "stale Pages reload keeps newly created writing");
assert(writingListTitle(afterStaleReload[0], "en") === enTitle, "title stays complete after stale reload merge");

const markdown = `---
title: ${enTitle}
date: 2026-09-04
---

Body text.
`;
const parsed = parseFrontMatter(markdown);
assert(parsed.meta.title === enTitle, "unquoted multi-word front matter title stays complete");
const quoted = parseFrontMatter(`---\ntitle: "${enTitle}"\ndate: 2026-09-04\n---\n\nBody\n`);
assert(quoted.meta.title === enTitle, "quoted multi-word front matter title stays complete");
const reloaded = {
  id: "test-article-title",
  languages: {
    en: { title: parsed.meta.title },
    tr: { title: trTitle }
  }
};
assert(writingListTitle(reloaded, "en") === enTitle, "reloaded source data still has full EN title");
assert(writingListTitle(reloaded, "tr") === trTitle, "reloaded source data still has full TR title");

const enOnly = writingFromEditor({
  ...editor,
  langs: { en: editor.langs.en, tr: { title: "", body: "", exists: false, cover: "" } }
}, "test-article-title");
assert(writingListTitle(enOnly, "tr") === enTitle, "missing TR title falls back to complete EN title");
assert(writingListTitle(enOnly, "tr") !== "T", "locale fallback does not reduce title to first character");

assert(scalarTitle("Test Article Title") === "Test Article Title", "string title is not indexed");
assert(scalarTitle(["T", "e", "s", "t", " ", "A"]) === "Test A", "character arrays join instead of using [0]");
assert(scalarTitle({ 0: "T", 1: "e", 2: "s", 3: "t" }) === "Test", "character maps reconstruct the full title");

const video = videoFromEditor({
  titleEn: "Live Stream Recap Video",
  titleTr: "Canli Yayin Ozet Videosu",
  date: "2026-09-04",
  youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  youtubeId: "abcdefghijk"
}, "live-stream-recap-video");
let videos = [];
videos = upsertById(videos, video);
assert(videos.some((item) => item.id === "live-stream-recap-video"), "create video upserts into list without refresh");
assert(videoListTitle(videos[0], "en") === "Live Stream Recap Video", "video EN title is complete");
assert(videoListTitle(videos[0], "tr") === "Canli Yayin Ozet Videosu", "video TR title is complete");
assert(mergeRemoteList([], videos)[0].id === "live-stream-recap-video", "stale video index keeps local create");

const saveWritingFn = adminSrc.slice(adminSrc.indexOf("async function saveWriting"), adminSrc.indexOf("async function saveVideo"));
const saveVideoFn = adminSrc.slice(adminSrc.indexOf("async function saveVideo"), adminSrc.indexOf("async function saveProfile"));
assert(saveWritingFn.includes("async function saveWriting"), "saveWriting exists");
assert(saveVideoFn.includes("async function saveVideo"), "saveVideo exists");
assert(saveWritingFn.includes("upsertWritingInState"), "writing save updates canonical list after backend success");
assert(!/await loadContent\(\)/.test(saveWritingFn), "writing save does not refetch stale Pages content");
assert(saveVideoFn.includes("upsertVideoInState"), "video save updates canonical list after backend success");
assert(!/await loadContent\(\)/.test(saveVideoFn), "video save does not refetch stale Pages content");
assert(saveWritingFn.includes("await api('/admin/api/save'") && saveWritingFn.indexOf("await api('/admin/api/save'") < saveWritingFn.indexOf("upsertWritingInState"), "writing list update happens only after backend save");
assert(saveVideoFn.includes("await api('/admin/api/save'") && saveVideoFn.indexOf("await api('/admin/api/save'") < saveVideoFn.indexOf("upsertVideoInState"), "video list update happens only after backend save");

assert(cmsSrc.includes("adoptGuides") && cmsSrc.includes("upsertById"), "guide create/list uses the same overlay lifecycle");
assert(cmsSrc.includes("adoptProjects") && cmsSrc.includes("upsertById"), "project create/list uses the same overlay lifecycle");
assert(staticSrc.includes("invalidate"), "static source cache can be cleared so saves are not pinned to one stale index");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all content-sync admin tests passed");
