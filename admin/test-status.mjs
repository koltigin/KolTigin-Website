import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const { savedMessage, createStatusController, NOTICE_MS } = createRequire(join(root, "status-logic.js"))("./status-logic.js");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(root, "i18n.js"), "utf8"), ctx);
const i18n = ctx.window.ADMIN_I18N;
function tr(lang, key) {
  return key.split(".").reduce((obj, part) => obj && obj[part], i18n[lang]);
}

assert(tr("en", "save.success") === "Saved successfully.", "production EN success copy");
assert(tr("en", "save.action") === "Save", "production EN save button");
assert(tr("tr", "save.action") === "Kaydet", "production TR save button");
assert(tr("en", "save.deleted") === "Deleted successfully.", "production EN delete copy");
assert(tr("tr", "save.deleted") === "Başarıyla silindi.", "production TR delete copy");
assert(tr("tr", "save.success") === "Başarıyla kaydedildi.", "production TR success copy");
assert(tr("en", "save.locally") === "Saved locally.", "local EN success copy");
assert(tr("tr", "save.locally") === "Lokalde kaydedildi.", "local TR success copy");
assert(savedMessage(true, (key) => tr("en", key)) === "Saved successfully.", "savedMessage production");
assert(savedMessage(false, (key) => tr("en", key)) === "Saved locally.", "savedMessage local");
assert(NOTICE_MS === 3000, "notice delay is 3s");

function fakeClock() {
  let seq = 0;
  const timers = new Map();
  let now = 0;
  return {
    setTimeout(fn, ms) {
      seq += 1;
      timers.set(seq, { fn, at: now + ms });
      return seq;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers.entries()]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    }
  };
}

const clock = fakeClock();
const status = createStatusController(clock);
const state = { notice: "old", error: "old-error" };
let expired = 0;
status.showNotice(state, "Saved successfully.", () => { expired += 1; });
assert(state.notice === "Saved successfully." && state.error === "", "showNotice sets success and clears error");
clock.advance(2999);
assert(state.notice === "Saved successfully." && expired === 0, "success still visible before 3s");
clock.advance(1);
assert(state.notice === "" && expired === 1, "success clears at 3s");

status.showError(state, "Save failed. boom");
clock.advance(5000);
assert(state.error === "Save failed. boom" && state.notice === "", "error does not auto-clear");

status.showNotice(state, "Saved locally.");
status.clearStatus(state);
clock.advance(3000);
assert(state.notice === "" && state.error === "" && expired === 1, "tab/section clearStatus stops timer");

status.showNotice(state, "one");
status.showNotice(state, "two");
clock.advance(3000);
assert(state.notice === "", "new save replaces previous notice");

status.showNotice(state, "AIOZ deleted.", undefined, { tone: "destructive" });
assert(state.notice === "AIOZ deleted." && state.noticeTone === "destructive", "destructive delete notice tone");
status.clearStatus(state);
assert(state.noticeTone === "", "clearStatus clears notice tone");

const adminSrc = readFileSync(join(root, "admin.js"), "utf8");
const cssSrc = readFileSync(join(root, "admin.css"), "utf8");
assert(adminSrc.includes("productionWrite"), "production write path kept");
assert(adminSrc.includes("/api/admin"), "production API rewrite kept");
assert(adminSrc.includes("showNotice") && adminSrc.includes("clearStatus"), "central status helpers wired");
assert(adminSrc.includes("statusToastHtml") && adminSrc.includes("paintStatusToast"), "status uses a shared toast renderer");
assert(adminSrc.includes("class=\"status-toast\"") && !adminSrc.includes(".shell > .ok"), "toast is not the old in-flow banner");
assert(cssSrc.includes("position: fixed") && cssSrc.includes(".status-toast") && cssSrc.includes("bottom: 24px") && cssSrc.includes("right: 24px"), "desktop toast is fixed bottom-right");
assert(cssSrc.includes("z-index: 70") && cssSrc.includes(".delete-modal") && cssSrc.includes("z-index: 80"), "toast sits above content and below the delete modal");
assert(cssSrc.includes("@media (max-width: 640px)") && cssSrc.includes("left: 16px"), "mobile toast stays inside the viewport");

if (failed) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll admin status UX tests passed.");
