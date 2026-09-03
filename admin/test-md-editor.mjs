import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const { applyMd, wrapSelection, prefixLines, insertSnippet } = createRequire(join(root, "md-editor.js"))("./md-editor.js");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

function fakeTextarea(value, { start = 0, end = start, scrollTop = 0, scrollLeft = 0 } = {}) {
  return {
    value,
    selectionStart: start,
    selectionEnd: end,
    scrollTop,
    scrollLeft,
    focused: false,
    events: [],
    focus() {
      this.focused = true;
    },
    setSelectionRange(nextStart, nextEnd) {
      this.selectionStart = nextStart;
      this.selectionEnd = nextEnd;
      this.scrollTop = 99999;
      this.scrollLeft = 99999;
    },
    dispatchEvent(event) {
      this.events.push(event && event.type ? event.type : event);
    }
  };
}

const longBody = [
  "# Top",
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
  "# Bottom"
].join("\n");
const mid = longBody.indexOf("echo");

const scrolled = fakeTextarea(longBody, { start: mid, end: mid + 4, scrollTop: 140, scrollLeft: 6 });
applyMd("quote", scrolled);
assert(scrolled.scrollTop === 140, "quote keeps scrollTop");
assert(scrolled.scrollLeft === 6, "quote keeps scrollLeft");
assert(scrolled.focused === true, "quote restores focus");
assert(scrolled.value.includes("> echo"), "quote prefixes current line");
assert(scrolled.value.startsWith("# Top") && scrolled.value.endsWith("# Bottom"), "quote does not rewrite distant lines");
assert(scrolled.selectionStart === mid && scrolled.selectionEnd === mid + "> echo".length, "quote selection covers transformed line");

for (const cmd of ["h1", "h2", "h3", "bold", "italic", "link", "ul", "ol", "code", "hr", "codeblock"]) {
  const ta = fakeTextarea(longBody, { start: mid, end: mid + 4, scrollTop: 88, scrollLeft: 3 });
  applyMd(cmd, ta);
  assert(ta.scrollTop === 88, `${cmd} keeps scrollTop`);
  assert(ta.scrollLeft === 3, `${cmd} keeps scrollLeft`);
  assert(ta.focused === true, `${cmd} restores focus`);
}

const bold = fakeTextarea("hello world", { start: 6, end: 11 });
applyMd("bold", bold);
assert(bold.value === "hello **world**", "bold wraps selection");
assert(bold.selectionStart === 8 && bold.selectionEnd === 13, "bold caret selects wrapped text");

const italic = fakeTextarea("hello", { start: 0, end: 0 });
applyMd("italic", italic);
assert(italic.value === "*text*hello", "italic inserts placeholder at caret");
assert(italic.selectionStart === 1 && italic.selectionEnd === 5, "italic selects placeholder");

const link = fakeTextarea("docs", { start: 0, end: 4 });
applyMd("link", link);
assert(link.value === "[docs](https://)", "link wraps selection");
assert(link.selectionStart === 1 && link.selectionEnd === 5, "link selects label");

const h1 = fakeTextarea("Title\nNext", { start: 1, end: 1, scrollTop: 22 });
applyMd("h1", h1);
assert(h1.value === "# Title\nNext", "paragraph → H1");
assert(h1.selectionStart === 3 && h1.selectionEnd === 3, "H1 caret stays on same character");
assert(h1.scrollTop === 22, "H1 keeps scrollTop");

const h2 = fakeTextarea("Title\nNext", { start: 1, end: 1, scrollTop: 22 });
applyMd("h2", h2);
assert(h2.value === "## Title\nNext", "paragraph → H2");
assert(h2.selectionStart === 4 && h2.selectionEnd === 4, "H2 caret stays on same character");
assert(h2.scrollTop === 22, "H2 keeps scrollTop");

const h3 = fakeTextarea("Title\nNext", { start: 1, end: 1, scrollTop: 22 });
applyMd("h3", h3);
assert(h3.value === "### Title\nNext", "paragraph → H3");
assert(h3.selectionStart === 5 && h3.selectionEnd === 5, "H3 caret stays on same character");
assert(h3.scrollTop === 22, "H3 keeps scrollTop");

const h1toH2 = fakeTextarea("# Title\nNext", { start: 4, end: 4, scrollTop: 31 });
applyMd("h2", h1toH2);
assert(h1toH2.value === "## Title\nNext", "H1 → H2 replacement");
assert(h1toH2.selectionStart === 5 && h1toH2.selectionEnd === 5, "H1→H2 caret tracks text");
assert(h1toH2.scrollTop === 31, "H1→H2 keeps scrollTop");

const h3toH1 = fakeTextarea("### Title\nNext", { start: 8, end: 8, scrollTop: 31 });
applyMd("h1", h3toH1);
assert(h3toH1.value === "# Title\nNext", "H3 → H1 replacement");
assert(h3toH1.selectionStart === 6 && h3toH1.selectionEnd === 6, "H3→H1 caret tracks text");
assert(h3toH1.scrollTop === 31, "H3→H1 keeps scrollTop");

const toggleH2 = fakeTextarea("## Title\nNext", { start: 5, end: 5, scrollTop: 18 });
applyMd("h2", toggleH2);
assert(toggleH2.value === "Title\nNext", "same heading level toggles off");
assert(toggleH2.selectionStart === 2 && toggleH2.selectionEnd === 2, "toggle-off caret tracks text");
assert(toggleH2.scrollTop === 18, "toggle-off keeps scrollTop");

const ul = fakeTextarea("one\ntwo", { start: 0, end: 7 });
applyMd("ul", ul);
assert(ul.value === "- one\n- two", "ul prefixes each selected line");

const ol = fakeTextarea("one\ntwo", { start: 0, end: 7 });
applyMd("ol", ol);
assert(ol.value === "1. one\n2. two", "ol numbers selected lines");

const quoted = fakeTextarea("> one\n> two", { start: 0, end: 11 });
applyMd("quote", quoted);
assert(quoted.value === "one\ntwo", "quote toggles off existing quotes");

const code = fakeTextarea("fn", { start: 0, end: 2 });
applyMd("code", code);
assert(code.value === "`fn`", "inline code wraps selection");

const hr = fakeTextarea("ab", { start: 1, end: 1, scrollTop: 12 });
applyMd("hr", hr);
assert(hr.value === "a\n---\nb", "hr inserts rule at caret");
assert(hr.selectionStart === 6 && hr.selectionEnd === 6, "hr caret after rule");
assert(hr.scrollTop === 12, "hr keeps scrollTop");

const block = fakeTextarea("pre|post", { start: 3, end: 4, scrollTop: 50 });
applyMd("codeblock", block);
assert(block.value === "pre``` bash\n|\n```\npost", "codeblock wraps selection");
assert(block.selectionStart === 11 && block.selectionEnd === 12, "codeblock caret on inner text");
assert(block.scrollTop === 50, "codeblock keeps scrollTop");

const emptyBlock = fakeTextarea("ab", { start: 1, end: 1 });
applyMd("codeblock", emptyBlock);
assert(emptyBlock.value === "a``` bash\n\n```\nb", "codeblock inserts empty fence");
assert(emptyBlock.selectionStart === 9 && emptyBlock.selectionEnd === 9, "empty codeblock caret inside fence");

const imageTa = fakeTextarea(longBody, { start: mid, end: mid, scrollTop: 64, scrollLeft: 2 });
insertSnippet(imageTa, "![alt](/img.png)\n");
assert(imageTa.scrollTop === 64 && imageTa.scrollLeft === 2, "image snippet keeps scroll");
assert(imageTa.value.includes("![alt](/img.png)\n"), "image snippet inserts markdown");
assert(imageTa.selectionStart === mid + "![alt](/img.png)\n".length, "image caret after snippet");

const wrapKeep = fakeTextarea("x", { start: 0, end: 1, scrollTop: 7 });
wrapSelection(wrapKeep, "**");
assert(wrapKeep.scrollTop === 7, "wrapSelection keeps scrollTop");

const prefixKeep = fakeTextarea("line", { start: 0, end: 4, scrollTop: 9 });
prefixLines(prefixKeep, "- ");
assert(prefixKeep.scrollTop === 9 && prefixKeep.value === "- line", "prefixLines keeps scrollTop and prefixes");

const css = readFileSync(join(root, "admin.css"), "utf8");
const toolbarBlock = css.match(/\.toolbar\s*\{[^}]*\}/);
assert(toolbarBlock, "toolbar CSS block exists");
assert(/flex-wrap:\s*wrap/.test(toolbarBlock[0]), "toolbar uses flex-wrap");
assert(/overflow-x:\s*hidden/.test(toolbarBlock[0]), "toolbar overflow-x is hidden");
assert(!/overflow-x:\s*(auto|scroll)/.test(toolbarBlock[0]), "toolbar is not horizontally scrollable");
assert(!/overflow:\s*(auto|scroll)/.test(toolbarBlock[0]), "toolbar does not use overflow scroll");

const adminSrc = readFileSync(join(root, "admin.js"), "utf8");
const cmsSrc = readFileSync(join(root, "cms.js"), "utf8");
const iH1 = adminSrc.indexOf("'h1'");
const iH2 = adminSrc.indexOf("'h2'");
const iH3 = adminSrc.indexOf("'h3'");
const iBold = adminSrc.indexOf("'bold'");
assert(iH1 !== -1 && iH1 < iH2 && iH2 < iH3 && iH3 < iBold, "writings toolbar order is H1 H2 H3 then existing controls");
const guideToolbar = cmsSrc.slice(cmsSrc.indexOf("function guideToolbar"), cmsSrc.indexOf("function renderPageEditor"));
assert(guideToolbar.includes("headingButtons") && guideToolbar.indexOf("headingButtons") < guideToolbar.indexOf("'bold'"), "guides toolbar starts with shared H1 H2 H3 buttons");
assert(adminSrc.includes("headingButtons") && cmsSrc.includes("headingButtons"), "shared heading buttons helper is used");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all md-editor tests passed");
