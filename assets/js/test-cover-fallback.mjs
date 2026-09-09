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

const markupFn = blogSrc.slice(blogSrc.indexOf("coverMarkup(item)"), blogSrc.indexOf("cardAction(item)"));
const generatedFn = blogSrc.slice(blogSrc.indexOf("generatedCoverSrc(item)"), blogSrc.indexOf("coverMarkup(item)"));
const brokenFn = blogSrc.slice(blogSrc.indexOf("replaceBrokenCover(img)"), blogSrc.indexOf("escapeHtml(value)"));

assert(generatedFn.includes("./assets/images/og/writings/${loc}/${kind}/${slug}.png"), "coverless writings use generated OG rasters");
assert(markupFn.includes("generatedCoverSrc(item)"), "coverMarkup uses generated OG when there is no custom cover");
assert(markupFn.includes("this.hasCover(item)"), "custom covers still win over generated OG");
assert(markupFn.includes("<figure") && markupFn.includes("<img src="), "custom covers still render as images");
assert(!markupFn.includes("coverFallbackSignature"), "uploaded covers do not inject the signature");
assert(blogSrc.includes("this.coverFallback(item, extra).trim()"), "broken custom covers can still swap to the CSS fallback");
assert(brokenFn.includes("if (!this.hasCover(item)) return;"), "generated OG cards do not fall back to the procedural CSS cover");
assert(blogSrc.includes("generatedCoverSrc(item)") && blogSrc.includes("writings-detail-cover"), "writing detail without cover uses the generated raster");
assert(guidesSrc.includes("./assets/images/og/guides/${loc}/${id}.png"), "/guides/ cards use generated Guide rasters");
assert(!guidesSrc.includes("coverFallback") && !guidesSrc.includes("cover-fallback"), "Guides do not share the writings CSS fallback-cover renderer");
assert(cssSrc.includes(".blog-banner-box > img"), "banner cover photos are direct-child images only");
assert(!cssSrc.includes(".blog-banner-box img {"), "banner img rule no longer swallows nested avatars");
assert(siteSrc.includes("site.avatar"), "sidebar already uses the site avatar asset");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all cover-fallback tests passed");
