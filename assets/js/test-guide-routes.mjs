import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const routerSrc = readFileSync(join(root, "router.js"), "utf8");
const guides = readFileSync(join(root, "guides-parser.js"), "utf8");
const projects = readFileSync(join(root, "projects-parser.js"), "utf8");
const share = readFileSync(join(root, "share-actions.js"), "utf8");
const md = readFileSync(join(root, "guide-markdown.js"), "utf8");
const script = readFileSync(join(root, "script.js"), "utf8");
const generate = readFileSync(join(root, "../../scripts/generate-share.py"), "utf8");
const adminCms = readFileSync(join(root, "../../admin/cms.js"), "utf8");
const worker = readFileSync(join(root, "../../workers/admin-api/src/handlers.js"), "utf8");
const workerPaths = readFileSync(join(root, "../../workers/admin-api/src/paths.js"), "utf8");
const shareWorkflow = readFileSync(join(root, "../../.github/workflows/generate-share.yml"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const sandbox = { window: {} };
vm.runInNewContext(routerSrc, sandbox);
const router = sandbox.window.KolTiginRouter;

assert(router.parseGuidePath("/guides/aro-network-depin-ubuntu-vps-installation-guide/EN").id === "aro-network-depin-ubuntu-vps-installation-guide", "parse en guide path");
assert(router.parseGuidePath("/guides/aro-network-depin-ubuntu-vps-installation-guide/TR").lang === "TR", "parse tr guide path");
assert(router.parseGuidePath("/guides/aro-network-depin-ubuntu-vps-installation-guide/EN/").lang === "EN", "trailing slash still parses");
assert(router.parseGuidePath("/guides/") == null, "guides landing is not a detail path");
assert(router.parseGuidePath("/projects/") == null, "projects is not a guide path");
assert(router.guidePublicPath("demo", "tr") === "/guides/demo/TR/", "public path uses uppercase locale");
assert(router.legacyTarget("#/guides/demo/EN") === "/guides/demo/EN/", "legacy hash migrates to real path");
assert(router.legacyTarget("#/guides/demo/TR/system-requirements") === "/guides/demo/TR/#system-requirements", "legacy heading becomes fragment");
assert(router.legacyTarget("#/guides/demo/EN") !== "/projects/#/guides/demo/EN", "legacy no longer stays under projects");
assert(router.canonicalForPath("/guides/demo/EN") === "https://koltigin.xyz/guides/demo/EN/", "canonical uses real guide path");
assert(router.sectionForPath("/guides/").page === "guides", "guides landing section");
assert(router.sectionForPath("/guides/").nav === "guides", "guides landing nav is guides");
assert(router.sectionForPath("/guides/demo/EN").page === "guide", "detail section is guide");
assert(router.sectionForPath("/guides/demo/EN").nav === "guides", "guide detail nav is guides");
assert(script.includes('(pageName === "guide" || pageName === "guides") ? "guides"'), "active nav uses Guides for landing and detail");
assert(!script.includes('[data-nav-page="projects"]?.classList.add("active")'), "guide paths do not force Projects active");
assert(router.parseGuideHeading("#system-requirements") === "system-requirements", "plain heading fragment");
assert(router.parseGuideHeading("#/guides/demo/EN/notes") === "notes", "legacy heading still parsed");

assert(script.includes("parseGuidePath(window.location.pathname)"), "script activates real guide paths");
assert(guides.includes("original(pageName, options || {})"), "guide activate wrapper keeps page options");
assert(guides.includes("this.open(link.dataset.guideOpen"), "landing card clicks use data-guide-open");
assert(guides.includes("parseGuideLocation()"), "guides parser reads path plus heading");
assert(guides.includes("./content/guides/index.json"), "guides landing reads content/guides/index.json");
assert(guides.includes("./content/guides/${id}/${lang}.md"), "guides parser loads markdown from content/guides");
assert(guides.includes("^#\\/guides\\/"), "legacy hash parser remains for redirects");
assert(projects.includes("`/guides/${encodeURIComponent(guideId)}/${code}/`"), "project guide href is the new public route");
assert(projects.includes("event.preventDefault()"), "project guide clicks stay in the spa");
assert(share.includes("/guides/${encodeURIComponent(slug)}/${code}/"), "share canonical is the new public route");
assert(md.includes('href="/guides/${this.escapeHtml(guideId)}/${lang}/"'), "in-guide locale links use public paths");
assert(generate.includes("guides/{item_id}/{code}/index.html"), "share generator writes guides/id/EN");
assert(generate.includes('root / "content" / "guides"'), "share generator reads guide markdown from content/guides");
assert(!generate.includes("guide_legacy_share_path"), "share generator no longer writes /guide/ stubs");
assert(!generate.includes('f"guide/{lang}/{item_id}/index.html"'), "share generator has no singular /guide/ path helper");
assert(adminCms.includes('href="/guides/${esc(item.id)}/${H().uiLang() === \'tr\' && item.existsTr ? \'TR\' : \'EN\'}"'), "admin share page uses public /guides/{id}/EN|TR");
assert(adminCms.includes('href="/#/guides/${esc(item.id)}"'), "admin preview still uses legacy hash");
assert(worker.includes("content/guides/${id}/") && workerPaths.includes("content/guides/${id}/${file}"), "worker writes guide markdown under content/guides");
assert(shareWorkflow.includes("git add writings guides"), "share workflow commits generated /guides/ html");
assert(shareWorkflow.includes("git add -u -- guide"), "share workflow stages leftover /guide/ deletions");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all guide-route tests passed");
