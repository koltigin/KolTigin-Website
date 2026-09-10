import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const routerSrc = readFileSync(join(root, "router.js"), "utf8");
const indexHtml = readFileSync(join(root, "../../index.html"), "utf8");
const siteSrc = readFileSync(join(root, "site.js"), "utf8");
const site = JSON.parse(readFileSync(join(root, "../../config/site.json"), "utf8"));

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

assert(router.publicPath("./config/site.json") === "/config/site.json", "publicPath prefixes root");
assert(router.publicPath("/assets/css/style.css") === "/assets/css/style.css", "publicPath keeps absolute");
assert(router.sectionForPath("/").id === "home", "home path");
assert(router.sectionForPath("/about/").id === "about", "about path");
assert(router.sectionForPath("/about").id === "about", "about without slash");
assert(router.sectionForPath("/writings/").page === "blog", "writings maps to blog page");
assert(router.pathForPage("blog") === "/writings/", "blog page path");
assert(router.pathForPage("guide", "/projects/") === "/projects/", "guide keeps path when not on a guide url");
assert(router.pathForPage("guide", "/guides/demo/EN/") === "/guides/demo/EN/", "guide path for page uses public route");
assert(router.pathForPage("guides") === "/guides/", "guides landing path");
assert(router.legacyTarget("#/about") === "/about/", "legacy hash about");
assert(router.parseWritingPath("/writings/en/notes/demo/")?.id === "demo", "parse en writing path");
assert(router.parseWritingPath("/writings/tr/articles/demo").lang === "tr", "parse tr writing path");
assert(router.writingPublicPath("en", "notes", "demo") === "/writings/en/notes/demo/", "writing public path");
assert(router.canonicalForPath("/writings/tr/notes/demo/") === "https://koltigin.xyz/writings/tr/notes/demo/", "writing canonical is self");
assert(router.legacyTarget("#/yazilar/articles/demo") === "/writings/en/articles/demo/", "legacy writing detail");
assert(router.legacyTarget("#/guides/optimai/EN") === "/guides/optimai/EN/", "legacy guide hash");
assert(router.canonicalForPath("/contact/") === "https://koltigin.xyz/contact/", "contact canonical");
assert(router.canonicalForPath("/guides/demo/EN") === "https://koltigin.xyz/guides/demo/EN/", "guide canonical");

assert(indexHtml.includes('href="/about/"'), "nav about href");
assert(indexHtml.includes('href="/resume/"'), "nav resume href");
assert(indexHtml.includes('href="/projects/"'), "nav projects href");
assert(indexHtml.includes('href="/writings/"'), "nav writings href");
assert(indexHtml.includes('href="/guides/"'), "nav guides href");
assert(indexHtml.includes('data-nav-page="guides"'), "nav guides page target");
assert(indexHtml.includes('href="/videos/"'), "nav videos href");
assert(indexHtml.includes('href="/contact/"'), "nav contact href");
assert(indexHtml.includes("/assets/js/router.js"), "router script");
assert(indexHtml.includes("/assets/js/share-actions.js?v=prod3"), "share actions script");
assert(indexHtml.includes("/assets/js/blog-parser.js?v=prod15"), "blog parser cache bust");
assert(siteSrc.includes("parseWritingPath(window.location.pathname)"), "route seo keeps writing detail metadata");
assert(indexHtml.includes("/assets/js/guides-parser.js?v=prod15"), "guides parser cache bust");
assert(indexHtml.includes("/assets/css/style.css?v=prod29"), "css cache bust");
assert(indexHtml.includes("/assets/js/script.js?v=prod7"), "script cache bust");
assert(indexHtml.includes("/assets/js/router.js?v=prod5"), "router cache bust");
assert(indexHtml.includes("guides-posts-list"), "guides landing uses card grid");
assert(!indexHtml.includes("guides-index-list"), "guides landing is not a slug list");
assert(router.sectionForPath("/guides/").nav === "guides", "guides landing highlights Guides nav");
assert(router.sectionForPath("/guides/demo/EN").nav === "guides", "guide detail highlights Guides nav");
assert(site.seo.routes.guides.en.description.includes("installation guides"), "guides section SEO description");
assert(site.seo.routes.guides.en.title === "Guides · KolTigin", "guides section SEO title");
assert(!indexHtml.includes('href="/en/'), "no /en/ locale routes");
assert(!indexHtml.includes('href="/tr/'), "no /tr/ locale routes");

const routeIds = ["home", "about", "resume", "projects", "writings", "videos", "contact", "guides"];
const routeImages = {
  home: "./assets/images/social/og-koltigin.png",
  about: "./assets/images/social/og-koltigin.png",
  resume: "./assets/images/social/og-resume.png",
  projects: "./assets/images/social/og-projects.png",
  writings: "./assets/images/social/og-writings.png",
  videos: "./assets/images/social/og-videos.png",
  contact: "./assets/images/social/og-contact.png",
  guides: "./assets/images/social/og-guides.png"
};
for (const id of routeIds) {
  const block = site.seo.routes[id];
  assert(block && block.en && block.tr && block.en.title && block.en.description, `seo.routes.${id}`);
  assert(block.ogImage === routeImages[id], `seo.routes.${id}.ogImage`);
}
assert(site.ogImage === routeImages.home, "default ogImage is og-koltigin");
assert(indexHtml.includes("https://koltigin.xyz/assets/images/social/og-koltigin.png"), "home html uses og-koltigin");
assert(indexHtml.includes('twitter:card" content="summary_large_image"'), "home twitter card");

const repo = join(root, "../..");
const guidesHtml = readFileSync(join(repo, "guides", "index.html"), "utf8");
const projectsHtml = readFileSync(join(repo, "projects", "index.html"), "utf8");
const guideDetail = readFileSync(
  join(repo, "guides", "aro-network-depin-ubuntu-vps-installation-guide", "EN", "index.html"),
  "utf8"
);
assert(guidesHtml.includes('property="og:image" content="https://koltigin.xyz/assets/images/social/og-guides.png"'), "guides section og:image is og-guides.png");
assert(guidesHtml.includes('name="twitter:image" content="https://koltigin.xyz/assets/images/social/og-guides.png"'), "guides section twitter:image is og-guides.png");
assert(!guidesHtml.includes("og-projects.png"), "guides section does not use projects OG");
assert(projectsHtml.includes('property="og:image" content="https://koltigin.xyz/assets/images/social/og-projects.png"'), "projects section og:image stays og-projects.png");
assert(projectsHtml.includes('name="twitter:image" content="https://koltigin.xyz/assets/images/social/og-projects.png"'), "projects section twitter:image stays og-projects.png");
assert(
  guideDetail.includes("https://koltigin.xyz/assets/images/og/guides/en/aro-network-depin-ubuntu-vps-installation-guide.png"),
  "guide detail still uses generated raster"
);
assert(!guideDetail.includes("og-guides.png"), "guide detail does not use section OG");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all public-route tests passed");
