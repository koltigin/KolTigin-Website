import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, "share-actions.js"), "utf8");
const blog = readFileSync(join(root, "blog-parser.js"), "utf8");
const guides = readFileSync(join(root, "guides-parser.js"), "utf8");
const en = JSON.parse(readFileSync(join(root, "../../i18n/en.json"), "utf8"));
const tr = JSON.parse(readFileSync(join(root, "../../i18n/tr.json"), "utf8"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const strings = { ...en };
const sandbox = {
  window: {
    KolTiginI18n: {
      t(key, _vars, fallback) {
        const parts = String(key).split(".");
        let current = strings;
        for (const part of parts) {
          if (!current || typeof current !== "object" || !(part in current)) return fallback;
          current = current[part];
        }
        return typeof current === "string" ? current : fallback;
      },
      get language() {
        return "en";
      },
      get site() {
        return { canonicalUrl: "https://koltigin.xyz/" };
      }
    }
  },
  globalThis: undefined,
  location: { origin: "https://example.invalid" }
};
sandbox.globalThis = sandbox.window;
vm.runInNewContext(src, sandbox);
const share = sandbox.window.KolTiginShareActions;

const writingEn = share.writingShareUrl("en", "notes", "no-cover");
const writingTr = share.writingShareUrl("tr", "notes", "no-cover");
const guideEn = share.guideShareUrl("EN", "demo-guide");
const guideTr = share.guideShareUrl("tr", "demo-guide");

assert(writingEn === "https://koltigin.xyz/writings/en/notes/no-cover/", "en writing canonical");
assert(writingTr === "https://koltigin.xyz/writings/tr/notes/no-cover/", "tr writing canonical");
assert(writingEn !== writingTr, "en/tr writing urls differ");
assert(guideEn === "https://koltigin.xyz/guides/demo-guide/EN", "en guide canonical");
assert(guideTr === "https://koltigin.xyz/guides/demo-guide/TR", "tr guide canonical");
assert(!writingEn.includes("#") && !guideEn.includes("#"), "share urls are not hashes");
assert(!src.includes("location.href"), "module does not share location.href");

const title = "Hello & Co";
const intents = share.intentUrls({ title, url: writingEn });
assert(intents.x === `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(writingEn)}`, "x intent encoding");
assert(intents.linkedin === `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(writingEn)}`, "linkedin encoding");
assert(intents.farcaster.startsWith("https://farcaster.xyz/~/compose?text="), "farcaster compose host");
assert(intents.farcaster.includes(encodeURIComponent(`${title}\n${writingEn}`)), "farcaster compose encoding");
assert(intents.warpcast.startsWith("https://warpcast.com/~/compose?text="), "warpcast compose fallback exists");

const markup = share.render({ title, url: writingEn });
assert(markup.includes('data-share-actions'), "render emits share bar");
assert(markup.includes('target="_blank"'), "external links open a new tab");
assert(markup.includes('rel="noopener noreferrer"'), "external links are noopener");
assert(!markup.includes("#/yazilar"), "markup does not share spa hashes");

const css = readFileSync(join(root, "../css/style.css"), "utf8");
assert(css.includes(".share-actions a.share-action:visited"), "share links scope visited color");
assert(css.includes(".share-actions a.share-action:hover"), "share links scope hover");
assert(css.includes(".share-actions a.share-action:focus"), "share links scope focus");
assert(
  css.includes(".share-actions a.share-action") && css.includes("text-decoration: none"),
  "share links force no underline"
);

const cardFn = blog.slice(blog.indexOf("createCard("), blog.indexOf("renderList("));
assert(!cardFn.includes("shareMarkup") && !cardFn.includes("data-share-actions"), "writing list cards have no share controls");
assert(blog.includes("shareMarkup(item)"), "writing detail uses shared share helper");
const showItem = blog.slice(blog.indexOf("showItem(id)"), blog.indexOf("contentLang()"));
const writingShareCalls = showItem.match(/this\.shareMarkup\(item\)/g) || [];
assert(writingShareCalls.length === 2, "writing detail has top and bottom share groups");
assert(showItem.indexOf("shareMarkup(item)") < showItem.indexOf("writings-detail-cover") || showItem.includes("writings-detail-title"), "writing top share stays after title");
assert(showItem.lastIndexOf("shareMarkup(item)") > showItem.indexOf("blog-post-content"), "writing bottom share is after article body");

assert(guides.includes("injectShareRows()"), "guides inject share via helper");
assert(guides.includes("querySelector('h1')"), "guide top share targets rendered H1");
assert(guides.includes("insertAdjacentHTML('afterend'"), "guide top share is injected after H1");
assert(guides.includes("insertAdjacentHTML('beforeend'"), "guide bottom share is appended after body");
assert(!guides.includes("back.insertAdjacentHTML"), "guides no longer attach share next to Back");
assert(!guides.includes("renderShareBar()"), "toolbar share helper is gone");
const parseMdMatch = guides.match(/parseMarkdown\(markdown, guideId\) \{[\s\S]*?\n  \}/);
assert(Boolean(parseMdMatch) && !parseMdMatch[0].includes("share-actions") && !parseMdMatch[0].includes("KolTiginShareActions"), "guide markdown renderer does not host share UI");

assert(en.share.x === "X" && en.share.share === "Share" && en.share.copied === "Copied", "en share labels");
assert(tr.share.share === "Paylaş" && tr.share.copied === "Bağlantı kopyalandı", "tr share labels");

const shared = await share.shareNative(
  { title, url: writingEn },
  { share: async (payload) => payload }
);
assert(shared.ok && shared.method === "share", "navigator.share path");

let copied = "";
const clip = await share.shareNative(
  { title, url: writingEn },
  { clipboard: { writeText: async (text) => { copied = text; } } }
);
assert(clip.ok && clip.method === "clipboard" && copied === writingEn, "clipboard fallback copies canonical url");

const cancelled = await share.shareNative(
  { title, url: writingEn },
  {
    share: async () => {
      const err = new Error("cancel");
      err.name = "AbortError";
      throw err;
    },
    clipboard: { writeText: async () => { throw new Error("should not copy after cancel"); } }
  }
);
assert(cancelled.ok && cancelled.method === "share-cancel", "share cancel does not copy");

const failedCopy = await share.shareNative(
  { title, url: writingEn },
  { clipboard: { writeText: async () => { throw new Error("denied"); } } }
);
assert(!failedCopy.ok && failedCopy.method === "clipboard", "clipboard failure is not swallowed");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all share-action tests passed");
