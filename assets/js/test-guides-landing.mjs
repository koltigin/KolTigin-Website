import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, "../..");
const orderSrc = readFileSync(join(root, "content-order.js"), "utf8");
const guidesSrc = readFileSync(join(root, "guides-parser.js"), "utf8");
const css = readFileSync(join(root, "../css/style.css"), "utf8");
const indexHtml = readFileSync(join(repo, "index.html"), "utf8");
const adminJs = readFileSync(join(repo, "admin/admin.js"), "utf8");
const en = JSON.parse(readFileSync(join(repo, "i18n/en.json"), "utf8"));
const tr = JSON.parse(readFileSync(join(repo, "i18n/tr.json"), "utf8"));
const projects = JSON.parse(readFileSync(join(repo, "projects/projects.json"), "utf8"));
const aroEn = readFileSync(join(repo, "content/guides/aro-network-depin-ubuntu-vps-installation-guide/EN.md"), "utf8");
const aroTr = readFileSync(join(repo, "content/guides/aro-network-depin-ubuntu-vps-installation-guide/TR.md"), "utf8");
const ARO = "aro-network-depin-ubuntu-vps-installation-guide";

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const documentStub = {
  documentElement: { lang: "en" },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};
const sandbox = {
  window: {
    KolTiginRouter: {
      publicPath(path) {
        return String(path || "").replace(/^\.\//, "/");
      },
      normalizePath(path) {
        const trimmed = String(path || "/").replace(/\/+$/, "");
        return trimmed ? `${trimmed}/` : "/";
      },
      parseGuidePath() { return null; },
      parseGuideHash() { return null; },
      parseGuideHeading() { return ""; },
      guidePublicPath(id, lang) { return `/guides/${id}/${lang}/`; }
    },
    activatePage() {},
    addEventListener() {},
    location: { pathname: "/guides/", hash: "", href: "http://127.0.0.1:3000/guides/" },
    GuidesParser: null,
    KolTiginI18n: {
      t(key, _vars, fallback) {
        const parts = String(key).split(".");
        let cur = en;
        for (const part of parts) cur = cur && cur[part];
        return cur || fallback || key;
      },
      guideLang() { return "EN"; },
      onChange() {}
    }
  },
  document: documentStub,
  fetch: async () => ({ ok: false })
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(orderSrc, sandbox);
vm.runInNewContext(guidesSrc, sandbox);
const Parser = sandbox.window.GuidesParser;
const parser = Object.create(Parser.prototype);

assert(Boolean(Parser), "GuidesParser is exported");
assert(parser.firstHeading(aroEn) === "ARO Network DePIN — Ubuntu / VPS Installation Guide", "EN title uses H1 not slug");
assert(parser.firstHeading(aroTr) === "ARO Network DePIN — Ubuntu / VPS Kurulum Rehberi", "TR title uses localized H1");
assert(!parser.firstHeading(aroEn).includes(ARO), "title is not the raw slug");
assert(parser.excerptFromMarkdown(aroEn).startsWith("ARO Network is a DePIN project"), "EN excerpt is first meaningful paragraph");
assert(parser.excerptFromMarkdown(aroTr).startsWith("ARO Network, kullanılabilir ağ"), "TR excerpt is first meaningful paragraph");
assert(parser.projectNameForGuide(projects, ARO) === "ARO", "related project name comes from projects.json");
assert(parser.coverSrc(ARO, aroEn, "EN") === `/assets/images/og/guides/en/${ARO}.png`, "EN card uses existing guide OG fallback");
assert(parser.coverSrc(ARO, aroTr, "TR") === `/assets/images/og/guides/tr/${ARO}.png`, "TR card uses existing guide OG fallback");
const installId = "redbelly-mainnet-node-installation-guide";
const updateId = "redbelly-mainnet-node-update-guide";
const troubleId = "redbelly-node-troubleshooting";
const installTr = readFileSync(join(repo, "content/guides", installId, "TR.md"), "utf8");
const updateTr = readFileSync(join(repo, "content/guides", updateId, "TR.md"), "utf8");
const troubleTr = readFileSync(join(repo, "content/guides", troubleId, "TR.md"), "utf8");
assert(parser.coverSrc(installId, installTr, "TR") === `/assets/images/og/guides/tr/${installId}.png`, "Redbelly install card uses generated OG");
assert(parser.coverSrc(updateId, updateTr, "TR") === `/assets/images/og/guides/tr/${updateId}.png`, "Redbelly update card uses generated OG");
assert(parser.coverSrc(troubleId, troubleTr, "TR") === `/assets/images/og/guides/tr/${troubleId}.png`, "Redbelly troubleshooting card uses generated OG");
assert(parser.coverFallbackSrc(installId, installTr, "TR") === `/assets/images/og/guides/en/${installId}.png`, "missing TR OG can fall back to EN raster");
assert(parser.coverSrc(installId, "---\nimage: hero.png\n---\n# Title\n", "TR") === `/assets/images/guides/${installId}/hero.png`, "cover aliases include image");
assert(parser.coverFallbackSrc(installId, "---\ncover: missing.png\n---\n# Title\n", "TR") === `/assets/images/og/guides/tr/${installId}.png`, "broken custom cover falls back to generated OG");

const enCard = parser.createIndexCard({
  id: ARO,
  lang: "EN",
  title: parser.firstHeading(aroEn),
  excerpt: parser.excerptFromMarkdown(aroEn),
  cover: parser.coverSrc(ARO, aroEn, "EN"),
  project: "ARO"
});
const trCard = parser.createIndexCard({
  id: ARO,
  lang: "TR",
  title: parser.firstHeading(aroTr),
  excerpt: parser.excerptFromMarkdown(aroTr),
  cover: parser.coverSrc(ARO, aroTr, "TR"),
  project: "ARO"
});

assert(enCard.includes(`href="/guides/${ARO}/EN/"`), "EN card route is /guides/{id}/EN/");
assert(trCard.includes(`href="/guides/${ARO}/TR/"`), "TR card route is /guides/{id}/TR/");
assert(enCard.includes("ARO Network DePIN — Ubuntu / VPS Installation Guide"), "EN card shows real title");
assert(trCard.includes("ARO Network DePIN — Ubuntu / VPS Kurulum Rehberi"), "TR card shows real title");
assert(!enCard.includes(`>${ARO}<`), "EN card does not show slug as title");
assert(enCard.includes("ARO"), "EN card shows related project name");
assert(enCard.includes("Read Guide"), "EN CTA is Read Guide");
assert(trCard.includes("Read Guide") === false || sandbox.window.KolTiginI18n.t("guides.read") === "Read Guide", "createIndexCard uses i18n CTA");
assert(enCard.includes("writings-card") && enCard.includes("guides-card"), "cards reuse writings card structure");

sandbox.window.KolTiginI18n.t = (key, _vars, fallback) => {
  const parts = String(key).split(".");
  let cur = tr;
  for (const part of parts) cur = cur && cur[part];
  return cur || fallback || key;
};
const trCtaCard = parser.createIndexCard({
  id: ARO,
  lang: "TR",
  title: parser.firstHeading(aroTr),
  excerpt: parser.excerptFromMarkdown(aroTr),
  cover: parser.coverSrc(ARO, aroTr, "TR"),
  project: "ARO"
});
assert(trCtaCard.includes("Rehberi Aç"), "TR CTA is Rehberi Aç");

assert(en.nav.guides === "Guides", "EN nav label is Guides");
assert(tr.nav.guides === "Rehberler", "TR nav label is Rehberler");
assert(indexHtml.includes('data-i18n="nav.guides"'), "public nav includes Guides");
assert(
  indexHtml.indexOf('data-nav-page="blog"') < indexHtml.indexOf('data-nav-page="guides"')
    && indexHtml.indexOf('data-nav-page="guides"') < indexHtml.indexOf('data-nav-page="videos"'),
  "Guides sits between Writings and Videos"
);
assert(adminJs.includes("navLink('#/guides', t('nav.guides'), 'guides')"), "admin nav is unchanged");
assert(indexHtml.includes('data-i18n="pages.guides"'), "guides landing still has an H1");
assert(
  /<article class="guides-page"[\s\S]*?<header>[\s\S]*?pages.guides/.test(indexHtml),
  "guides H1 lives in the section header below the shared navbar"
);
assert(css.includes(".blog-posts-list.guides-posts-list"), "guides grid class exists");
assert(css.includes("@media (min-width: 1024px)") && /guides-posts-list\s*\{[^}]*1fr 1fr/.test(css), "desktop uses 2-column guides grid");
assert(/guides-posts-list \{\s*grid-template-columns: 1fr;/.test(css), "tablet/mobile guides grid is 1 column");
assert(indexHtml.includes("/assets/js/content-order.js?v=prod1"), "guides landing loads the shared chronological helper");
assert(guidesSrc.includes("sortByPublicationDate"), "guides landing sorts by publication date");
assert(sandbox.window.KolTiginContentOrder.sortByPublicationDate([
  { id: "old", date: "2026-09-09" },
  { id: "telegram", date: "2026-09-11" }
], { dateKeys: ["date"], idKeys: ["id"] })[0].id === "telegram", "newly published Guide becomes first");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all guides-landing tests passed");
