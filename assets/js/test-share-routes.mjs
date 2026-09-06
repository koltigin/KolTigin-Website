import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const blog = readFileSync(join(root, "blog-parser.js"), "utf8");
const guides = readFileSync(join(root, "guides-parser.js"), "utf8");

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
assert(guides.includes("#/guides/"), "guide hashes still use #/guides");
assert(/#\\\/guides\\\/\(\[a-z0-9-\]+\)/.test(guides) || guides.includes("^#\\/guides\\/"), "guide hash parser remains");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all share-route hash tests passed");
