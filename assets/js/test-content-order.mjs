import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, "content-order.js"), "utf8");
const sandbox = { window: {}, globalThis: {} };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox);
const order = sandbox.KolTiginContentOrder;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const guides = order.sortByPublicationDate([
  { id: "redbelly-mainnet-node-installation-guide", date: "2026-09-11" },
  { id: "redbelly-mainnet-telegram-monitoring-bot-installation-guide", date: "2026-09-11" },
  { id: "optimai-cli-node-setup-guide-ubuntu-24-04-vps", date: "2026-09-09" },
  { id: "brand-new-guide", date: "2026-09-12" },
  { id: "broken", date: "not-a-date" }
], { dateKeys: ["date"], idKeys: ["id"], useSourceIndex: true });

assert(guides[0].id === "brand-new-guide", "Guides are newest to oldest");
assert(guides[1].id === "redbelly-mainnet-node-installation-guide", "same-date Guides keep source order");
assert(guides[2].id === "redbelly-mainnet-telegram-monitoring-bot-installation-guide", "same-date secondary order is deterministic");
assert(guides.at(-1).id === "broken", "missing/invalid dates sort last without crashing");

const writings = order.sortByPublicationDate([
  { id: "articles/old", date: "2025-06-01" },
  { id: "notes/new", date: "2026-08-29" },
  { id: "articles/newest", date: "2026-08-31" }
], { dateKeys: ["date"], idKeys: ["id"] });
assert(writings.map((item) => item.id).join(",") === "articles/newest,notes/new,articles/old", "Writings are newest to oldest");

const filtered = writings.filter((item) => item.id.startsWith("articles/"));
assert(filtered.map((item) => item.id).join(",") === "articles/newest,articles/old", "filtering Writings preserves newest to oldest order");

const videos = order.sortByPublicationDate([
  { youtubeId: "old", date: "2023-03-06" },
  { youtubeId: "new", date: "2025-01-07" },
  { youtubeId: "also-new", date: "2025-01-07" }
], { dateKeys: ["date", "publishedAt"], idKeys: ["youtubeId"] });
assert(videos[0].youtubeId === "also-new" && videos[1].youtubeId === "new", "Videos are newest to oldest with stable id ties");

const en = order.sortByPublicationDate([{ id: "same", date: "2026-09-11", title: "Zebra" }, { id: "also", date: "2026-09-11", title: "Apple" }], { dateKeys: ["date"], idKeys: ["id"] });
const tr = order.sortByPublicationDate([{ id: "same", date: "2026-09-11", title: "Zebra TR" }, { id: "also", date: "2026-09-11", title: "Apple TR" }], { dateKeys: ["date"], idKeys: ["id"] });
assert(en.map((item) => item.id).join(",") === tr.map((item) => item.id).join(","), "EN/TR use the same chronological order");

assert(order.publicationStamp("11.09.2026") === order.publicationStamp("2026-09-11"), "European dates parse to the same stamp");
assert(order.publicationStamp("bogus") === 0 && order.publicationStamp("") === 0, "invalid dates are zero");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all content-order tests passed");
