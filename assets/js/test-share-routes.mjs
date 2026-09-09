import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const blog = readFileSync(join(root, "blog-parser.js"), "utf8");
const guides = readFileSync(join(root, "guides-parser.js"), "utf8");

const share = readFileSync(join(root, "share-actions.js"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

assert(blog.includes("#/yazilar/"), "writing detail hashes still use #/yazilar");
assert(blog.includes("openFromHash"), "writing hash opener remains");
assert(guides.includes("parseGuideHash"), "legacy guide hashes remain for migration");
assert(guides.includes("guidePublicPath"), "guides write real public paths");
assert(/#\\\/guides\\\/\(\[a-z0-9-\]+\)/.test(guides) || guides.includes("^#\\/guides\\/"), "guide hash parser remains");
assert(share.includes("writingShareUrl") && share.includes("guideShareUrl"), "canonical share helpers exist");
assert(!share.includes("location.href"), "share helpers do not use location.href");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all share-route hash tests passed");
