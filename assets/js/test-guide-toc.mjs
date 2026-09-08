import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const mdSrc = readFileSync(join(root, "guide-markdown.js"), "utf8");
const guides = readFileSync(join(root, "guides-parser.js"), "utf8");
const css = readFileSync(join(root, "../css/style.css"), "utf8");
const blog = readFileSync(join(root, "blog-parser.js"), "utf8");
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

const sandbox = { window: {} };
vm.runInNewContext(mdSrc, sandbox);
const md = sandbox.window.KolTiginGuideMarkdown;

assert(md.headingId("System Requirements") === "system-requirements", "ascii heading slug");
assert(md.headingId("If Docker Is Not Installed") === "if-docker-is-not-installed", "phrase slug");
assert(md.headingId("6. Enable the Service") === "6-enable-the-service", "numbered h2 slug");
assert(md.headingId("Kurulum") === "kurulum", "turkish heading keeps letters");
assert(md.headingId("***") === "section", "empty slug falls back");

const used = new Set();
assert(md.uniqueHeadingId("Notes", used) === "notes", "first unique id");
assert(md.uniqueHeadingId("Notes", used) === "notes-2", "duplicate heading gets suffix");

const html = md.render("# Title\n\n## Alpha\n\n### Child\n\n#### Skip me\n\n## Alpha\n\n## Beta\n", { guideId: "demo" });
assert(html.includes('<h1 id="title">'), "h1 still gets an id");
assert(html.includes('<h2 id="alpha">'), "first h2 slug");
assert(html.includes('<h3 id="child">'), "h3 slug");
assert(html.includes('<h4 id="skip-me">'), "h4 still rendered with id");
assert(html.includes('<h2 id="alpha-2">'), "duplicate h2 is uniquified");
assert((html.match(/<h2 /g) || []).length === 3, "three h2s rendered");

assert(guides.includes("renderToc()"), "guides build a TOC");
assert(guides.includes("collectTocEntries()"), "toc is collected from rendered headings");
assert(guides.includes("querySelectorAll('h2[id], h3[id]')"), "toc uses h2 and h3 only");
assert(!guides.includes("querySelectorAll('h1"), "toc collector does not query h1");
assert(guides.includes("data-guide-toc-toggle"), "toc uses an inline toggle");
assert(guides.includes("t('guides.contents'"), "toc label uses contents i18n key");
assert(guides.includes("guide-toc-group"), "h2/h3 groups preserve reading order in columns");
assert(guides.includes("setTocOpen(false)"), "toc collapses after a heading click");
assert(guides.includes("afterLayout: true"), "toc waits for collapse reflow before scrolling");
assert(guides.includes("headingScrollOffset()"), "explicit heading offset avoids sticky chrome");
assert(guides.includes("syncTocStickyOffset()"), "sticky toc top tracks the guide header");
assert(guides.includes("insertAdjacentHTML('afterend'"), "toc sits after the top share/title area");
assert(!guides.includes("guide-toc-active"), "wide-desktop layout class is gone");
assert(guides.includes("parseGuideHash()"), "guide hash parser extracts optional heading");
assert(guides.includes("(?:\\/([a-z0-9-]+))?"), "heading slug is optional on the spa hash");
assert(guides.includes("^#\\/guides\\/"), "existing guide spa hash remains");
assert(guides.includes("injectShareRows()"), "share rows still inject independently of toc");
assert(!blog.includes("renderToc"), "writings parser does not get a toc");

assert(!css.includes("@media (min-width: 1440px)"), "1440px side-rail breakpoint is gone");
assert(!css.includes("max-width: 1480px"), "expanded three-column main width is gone");
assert(!css.includes("article.guide-page.active.has-toc > .guide-toc"), "toc is not a page-level side rail");
assert(css.includes(".guide-toc-toggle"), "compact toc trigger exists");
assert(css.includes(".guide-toc-panel"), "inline toc panel exists");
assert(/\.guide-toc\s*\{[^}]*position:\s*sticky/.test(css), "contents control is sticky");
assert(css.includes("--guide-toc-top"), "sticky top offset is configurable");
assert(css.includes("scroll-margin-top"), "headings keep scroll-margin under sticky ui");
assert(css.includes("column-count: 1"), "mobile toc is 1 column");
assert(css.includes("@media (min-width: 768px)"), "tablet breakpoint matches site 768px");
assert(css.includes("column-count: 2"), "tablet toc is 2 columns");
assert(css.includes("@media (min-width: 1024px)"), "desktop breakpoint matches site 1024px");
assert(css.includes("column-count: 3"), "desktop toc is 3 columns");
assert(css.includes("break-inside: avoid"), "h2/h3 groups stay together across columns");
assert(!css.includes("grid-template-columns: repeat(3"), "toc is not row-major css grid");
assert(css.includes("max-height: min(42vh"), "open toc panel is height-capped");
assert(css.includes(".guide-toc-link.is-child"), "h3 hierarchy class remains");
assert(!/guide-toc-link[^}]*text-overflow:\s*ellipsis/.test(css), "toc labels are not truncated");

assert(en.guides.contents === "Contents", "en toc title");
assert(tr.guides.contents === "İçindekiler", "tr toc title");
assert(!en.guides.onThisPage, "en on-this-page label removed");
assert(!tr.guides.onThisPage, "tr on-this-page label removed");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all guide-toc tests passed");
