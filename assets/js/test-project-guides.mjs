import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const parser = readFileSync(join(root, "projects-parser.js"), "utf8");
const en = JSON.parse(readFileSync(join(root, "../../i18n/en.json"), "utf8"));
const tr = JSON.parse(readFileSync(join(root, "../../i18n/tr.json"), "utf8"));
const cms = readFileSync(join(root, "../../admin/cms.js"), "utf8");
const i18n = readFileSync(join(root, "../../admin/i18n.js"), "utf8");
const projectsJson = JSON.parse(readFileSync(join(root, "../../projects/projects.json"), "utf8"));
const optimaiMd = readFileSync(join(root, "../../content/projects/depin/optimai.md"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const GUIDE = "optimai-cli-node-setup-guide-ubuntu-24-04-vps";
const optimai = (projectsJson.depin || []).find((item) => item.id === "optimai");
const guideLink = (optimai.links || []).find((link) => link.guide === GUIDE);

assert(Boolean(guideLink), "existing OptimAI Guide relationship is recognized");
assert(!guideLink.url, "generated OptimAI guide link does not store a share URL");
assert(optimaiMd.includes(`guide: ${GUIDE}`), "OptimAI markdown backfill stores the Guide id");
assert(!/url:\s*.*\/guide\//.test(optimaiMd), "OptimAI markdown does not store a Guide share URL");
assert((optimai.links || []).some((link) => link.label === "Website" && link.url === "https://optimai.network"), "manual Website link remains");

assert(en.projects.links.setupGuide === "Setup Guide", "EN project renders Setup Guide");
assert(tr.projects.links.setupGuide === "Kurulum Rehberi", "TR project renders Kurulum Rehberi");
assert(parser.includes("guideShareHref"), "parser derives locale share URLs");
assert(parser.includes("`/guide/${this.currentLang()}/${encodeURIComponent(guideId)}/`"), "correct locale share URL shape");
assert(parser.includes("if (href.startsWith('/guide/')) return;"), "share URLs are not intercepted as SPA hashes");
assert(parser.includes("if (!url && !guide) return null;"), "guide links do not require a manual URL");
assert(cms.includes("cms.guidesManagedHint"), "project editor has a managed Guides area");
assert(!cms.includes('data-pfield="guideId"'), "project editor no longer asks for a single guide URL/id field");
assert(i18n.includes("guidesManagedHint") && i18n.includes("Rehberler"), "admin Guides/Rehberler copy exists");

const css = readFileSync(join(root, "../css/style.css"), "utf8");
assert(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"), "project action buttons use a two-column grid");
assert(css.includes(".project-card-links li:last-child:nth-child(odd)"), "odd final action button spans the full row");
assert(css.includes("@media (max-width: 449px)"), "very narrow mobile uses a single action column");
assert(!css.includes("flex: 1 1 calc((100% - 20px) / 3)"), "project actions no longer force three buttons onto one row");
const labelRule = css.match(/\.project-card-link-label\s*\{[^}]+\}/);
assert(Boolean(labelRule), "project action label rule exists");
assert(!/text-overflow:\s*ellipsis/.test(labelRule[0]), "project action labels are not truncated with ellipsis");
assert(!/white-space:\s*nowrap/.test(labelRule[0]), "project action labels may wrap instead of truncating");
const order = (optimai.links || []).map((link) => link.guide ? "guide" : String(link.label || "").toLowerCase());
assert(order[0] === "website" && order[1] === "guide", "OptimAI semantic link order stays Website then Guide");
assert(parser.includes("if (referralUrl) {\n      links.push({ label: this.t('projects.links.referral'"), "Referral is still appended after project links");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all project-guide tests passed");
