import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const blogSrc = readFileSync(join(root, "blog-parser.js"), "utf8");
const cssSrc = readFileSync(join(root, "../css/style.css"), "utf8");
const guidesSrc = readFileSync(join(root, "guides-parser.js"), "utf8");
const siteSrc = readFileSync(join(root, "site.js"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const fallbackStart = blogSrc.indexOf("coverFallback(item, extraClass");
const fallbackEnd = blogSrc.indexOf("coverMarkup(item)");
const fallbackFn = blogSrc.slice(fallbackStart, fallbackEnd);
const markupFn = blogSrc.slice(fallbackEnd, blogSrc.indexOf("cardAction(item)"));
const signatureFn = blogSrc.slice(blogSrc.indexOf("coverFallbackSignature()"), fallbackStart);

assert(fallbackStart !== -1 && fallbackEnd !== -1, "shared coverFallback and coverMarkup exist");
assert(fallbackFn.includes("coverFallbackSignature()"), "list/detail fallback uses the shared signature helper");
assert(signatureFn.includes("cover-fallback-signature"), "signature markup class exists");
assert(signatureFn.includes("cover-fallback-avatar"), "signature includes circular avatar image");
assert(signatureFn.includes("cover-fallback-divider"), "signature includes a divider between avatar and name");
assert(fallbackFn.includes("coverFallbackSignature()") && !fallbackFn.slice(fallbackFn.indexOf("<div class=\"cover-fallback\">"), fallbackFn.indexOf("</div>")).includes("coverFallbackSignature"), "signature is a sibling of the title block, not nested inside it");
assert(cssSrc.includes(".blog-banner-box > img"), "banner cover photos are direct-child images only");
assert(!cssSrc.includes(".blog-banner-box img {"), "banner img rule no longer swallows nested avatars");
assert(cssSrc.includes(".writings-detail-cover > img"), "detail cover photos are direct-child images only");
assert(!cssSrc.includes(".writings-cover img {") && !cssSrc.includes(".writings-cover img{\n"), "broad writings-cover img rule is gone");
assert(cssSrc.includes("border-radius: 50%"), "avatar is circular");
assert(cssSrc.includes(".cover-fallback-divider"), "divider is styled");
assert(cssSrc.includes("width: 42px"), "card avatar is large enough to read as a portrait");
assert(blogSrc.includes("koltigin-at.png"), "reuses existing profile avatar asset");
assert(blogSrc.includes("coverAuthorAvatarSrc"), "avatar comes from site config with existing asset fallback");
assert(markupFn.includes("if (!this.hasCover(item)) return this.coverFallback(item)"), "items without a cover use the fallback");
assert(markupFn.includes("<figure") && markupFn.includes("<img src="), "custom covers still render as images");
assert(!markupFn.includes("coverFallbackSignature"), "uploaded covers do not inject the signature");
assert(cssSrc.includes(".cover-fallback-signature"), "signature is styled");
assert(cssSrc.includes(".cover-fallback-avatar") && cssSrc.includes("border-radius: 50%"), "avatar is circular");
assert(cssSrc.includes("bottom: 12px"), "signature sits near the bottom");
assert(cssSrc.includes("inset: 0 0 58px"), "title block leaves a reserved band for the signature");
assert(!guidesSrc.includes("coverFallback") && !guidesSrc.includes("cover-fallback"), "Guides do not share the writings fallback-cover renderer");
assert(siteSrc.includes("site.avatar"), "sidebar already uses the site avatar asset");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all cover-fallback tests passed");
