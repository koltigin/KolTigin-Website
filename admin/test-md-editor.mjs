import { createRequire } from "node:module";
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

for (const cmd of ["h2", "bold", "italic", "link", "ul", "ol", "code", "hr", "codeblock"]) {
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

const heading = fakeTextarea("Title\nNext", { start: 1, end: 1 });
applyMd("h2", heading);
assert(heading.value === "## Title\nNext", "heading prefixes current line");
assert(heading.selectionStart === 0 && heading.selectionEnd === "## Title".length, "heading selects line");

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

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all md-editor tests passed");
