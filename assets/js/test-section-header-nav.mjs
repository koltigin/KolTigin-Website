import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, "../..");
const indexHtml = readFileSync(join(repo, "index.html"), "utf8");
const css = readFileSync(join(root, "../css/style.css"), "utf8");
const siteJs = readFileSync(join(root, "site.js"), "utf8");
const contactSrc = readFileSync(join(root, "contact-parser.js"), "utf8");
const en = JSON.parse(readFileSync(join(repo, "i18n/en.json"), "utf8"));
const tr = JSON.parse(readFileSync(join(repo, "i18n/tr.json"), "utf8"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const navMatch = indexHtml.match(/<nav class="navbar">[\s\S]*?<\/nav>/);
const nav = navMatch ? navMatch[0] : "";
const afterNav = indexHtml.slice(indexHtml.indexOf("</nav>"));

assert(Boolean(nav), "public navbar exists once");
assert(nav.includes('data-set-lang="en"') && nav.includes('data-set-lang="tr"'), "EN/TR switch remains in navbar");
assert(nav.includes('data-nav-page="projects"') && nav.includes('data-nav-page="blog"') && nav.includes('data-nav-page="guides"'), "navbar keeps Projects, Writings, and Guides");
assert(!nav.includes("article-title"), "section H1 is outside the nav row");

const sectionKeys = [
  ["about", "pages.about"],
  ["resume", "pages.resume"],
  ["projects", "pages.projects"],
  ["blog", "pages.blog"],
  ["videos", "pages.videos"],
  ["guides", "pages.guides"]
];
for (const [page, key] of sectionKeys) {
  const block = afterNav.match(new RegExp(`<article class="[^"]*" data-page="${page}">[\\s\\S]*?</article>`));
  assert(block && block[0].includes(`data-i18n="${key}"`) && block[0].includes("article-title"), `${page} H1 lives in the section header`);
  assert(block && /<header>[\s\S]*article-title/.test(block[0]), `${page} H1 is in the article header, not the navbar`);
}

assert(contactSrc.includes('<h2 class="h2 article-title">'), "contact injects the same section H1 pattern");
assert(en.pages.projects === "Projects" && tr.pages.projects === "Projeler", "Projects H1 copy exists in EN and TR");
assert(en.pages.blog === "Writings" && tr.pages.blog === "Yazılar", "Writings H1 copy exists in EN and TR");
assert(en.pages.guides === "Guides" && tr.pages.guides === "Rehberler", "Guides H1 copy exists in EN and TR");
assert(en.nav.projects && tr.nav.projects && en.nav.blog && tr.nav.blog && en.nav.guides && tr.nav.guides, "navbar labels remain usable in EN and TR");

assert(!css.includes("margin-bottom: -65px"), "navbar no longer overlays the section header");
assert(!css.includes("padding-right: 420px") && !css.includes("padding-right: 560px"), "section H1 is not reserved against the nav row");
assert(css.includes("justify-content: flex-end") && css.includes("flex-wrap: wrap"), "navbar can wrap instead of overflowing horizontally");
assert(!siteJs.includes("paddingRight") && !siteJs.includes("syncDesktopTitleClearance"), "site.js does not pad titles around the navbar");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all section header/nav tests passed");
