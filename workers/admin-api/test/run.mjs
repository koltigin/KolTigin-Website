import { handleRequest } from "../src/index.js";
import { MockGitHub } from "../src/github.js";
import { assertSafePath } from "../src/paths.js";
import { applyWritingIndex, applyGuideIndex, applyProjectJson, compareProjectNames, discoverGuides, stripGuideFromProjectsJson, stripGuideFromProjectMarkdown } from "../src/generate.js";
import { buildWritingMarkdown, youtubeIdFromUrl, projectJsonItem } from "../src/markdown.js";
import { HttpError } from "../src/util.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function seed() {
  return {
    "config/site.json": JSON.stringify({
      displayName: "KolTigin",
      motto: "Think out of the box.",
      email: "hello@koltigin.xyz",
      social: [{ id: "x", url: "https://x.com/mkoltigin", icon: "logo-twitter" }],
      contact: { endpoint: "https://koltigin-contact.mehmetkoltigin.workers.dev/", formEnabled: true }
    }, null, 2) + "\n",
    "config/writing-types.json": JSON.stringify({
      types: [
        { id: "articles", core: true, mode: "internal" },
        { id: "notes", core: true, mode: "internal" },
        { id: "social", core: true, mode: "external" }
      ]
    }, null, 2) + "\n",
    "config/project-categories.json": JSON.stringify([
      { id: "mainnet", folder: "mainnet", order: 1, protected: true, label: { en: "Mainnet", tr: "Mainnet" } }
    ], null, 2) + "\n",
    "content/index.json": JSON.stringify({
      types: [],
      articles: { en: ["old.md"], tr: [] },
      notes: { en: [], tr: [] },
      social: { en: [], tr: [] },
      videos: []
    }, null, 2) + "\n",
    "projects/projects.json": JSON.stringify({ mainnet: [] }, null, 2) + "\n",
    "guides/index.json": JSON.stringify({ guides: [] }, null, 2) + "\n",
    "i18n/en.json": JSON.stringify({ contact: { title: "Contact", submit: "Send" } }, null, 2) + "\n",
    "i18n/tr.json": JSON.stringify({ contact: { title: "İletişim", submit: "Gönder" } }, null, 2) + "\n",
    "content/about/en.md": "# About\n"
  };
}

function envWith(github) {
  return { TEST_MODE: "1", github, GITHUB_OWNER: "koltigin", GITHUB_REPO: "KolTigin-Website", GITHUB_BRANCH: "main" };
}

async function post(path, body, env, headers = {}) {
  return handleRequest(new Request(`https://koltigin.xyz${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  }), env);
}

async function postForm(path, file, fields, env) {
  const form = new FormData();
  form.set("file", new File([file.bytes], file.name, { type: "image/png" }));
  Object.entries(fields || {}).forEach(([k, v]) => form.set(k, v));
  return handleRequest(new Request(`https://koltigin.xyz${path}`, { method: "POST", body: form }), env);
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok", msg);
  }
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

async function main() {
  try {
    assertSafePath("content/about/en.md");
    try { assertSafePath("../etc/passwd"); assert(false, "traversal"); } catch (error) { assert(error instanceof HttpError, "path traversal blocked"); }
    try { assertSafePath("scripts/admin_cms.py"); assert(false, "scripts"); } catch (error) { assert(error instanceof HttpError, "scripts blocked"); }

    const idx = applyWritingIndex({ articles: { en: [], tr: [] } }, { kind: "articles", lang: "en", file: "hello.md" });
    assert(idx.articles.en.includes("hello.md"), "writing index upsert");
    const gidx = applyGuideIndex({ guides: [] }, { id: "aioz-depin" });
    assert(gidx.guides[0] === "aioz-depin", "guide index");
    assert(discoverGuides({
      indexIds: ["aioz-depin"],
      markdownById: { "aioz-depin": { en: "# Guide\n", tr: "# Rehber\n" } }
    }).includes("aioz-depin"), "bilingual guide is discoverable");
    assert(!discoverGuides({
      indexIds: ["aioz-depin"],
      markdownById: { "aioz-depin": { en: "", tr: "" } }
    }).includes("aioz-depin"), "orphan slug without sources is not listed");
    const strippedMd = stripGuideFromProjectMarkdown(`---
links:
- label: Website
  url: https://aioz.network
- label: Setup Guide
  url: '#/guides/aioz-depin'
  guide: aioz-depin
---
`, "aioz-depin");
    assert(strippedMd.includes("https://aioz.network") && !strippedMd.includes("guide: aioz-depin"), "project markdown strip keeps other links");
    const strippedJson = stripGuideFromProjectsJson({
      depin: [{ id: "aioz-depin", links: [{ label: "Website", url: "https://aioz.network" }, { guide: "aioz-depin", url: "#/guides/aioz-depin" }] }]
    }, "aioz-depin");
    assert(strippedJson.changed && strippedJson.data.depin[0].links.length === 1, "projects.json strip removes only the guide link");
    const pjson = applyProjectJson({ mainnet: [] }, [{ id: "mainnet" }], { id: "ario", category: "mainnet", item: { id: "ario", name: "AR.IO" } });
    assert(pjson.mainnet[0].id === "ario", "project json upsert");
    assert(youtubeIdFromUrl("https://www.youtube.com/watch?v=abcdefghijk") === "abcdefghijk", "youtube id");
    assert(buildWritingMarkdown({ title: "Hi", date: "2026-01-01", kind: "articles", body: "x" }).includes("title: Hi"), "writing markdown");

    const github = new MockGitHub(seed());
    const env = envWith(github);

    let res = await json(await handleRequest(new Request("https://koltigin.xyz/api/admin/save"), env));
    assert(res.status === 405, "GET rejected via missing method on handleRequest GET");
    res = await json(await handleRequest(new Request("https://koltigin.xyz/api/admin/save", { method: "GET" }), env));
    assert(res.status === 405, "GET not allowed");

    res = await json(await post("/api/admin/unknown", {}, env));
    assert(res.status === 404, "unknown route 404");

    res = await json(await post("/api/admin/save", {
      kind: "articles", lang: "en", id: "smoke-note", title: "Smoke", date: "2026-09-01", body: "Hello"
    }, env));
    assert(res.status === 200 && res.body.ok === true, "save writing ok");
    assert(github.files.has("content/articles/en/smoke-note.md"), "writing file written");
    const index = JSON.parse(github.files.get("content/index.json"));
    assert(index.articles.en.includes("smoke-note.md"), "index lists writing");

    res = await json(await post("/api/admin/save", {
      kind: "articles", lang: "tr", id: "smoke-note", title: "Duman", date: "2026-09-01", body: "Merhaba"
    }, env));
    assert(res.status === 200, "save writing tr pair");
    assert(github.files.has("content/articles/tr/smoke-note.md"), "writing tr file written");

    res = await json(await post("/api/admin/page", { family: "about", lang: "en", markdown: "# About\n\nUpdated\n" }, env));
    assert(res.status === 200 && res.body.ok, "save about");
    assert(String(github.files.get("content/about/en.md")).includes("Updated"), "about body");
    const aboutCommits = github.commits.length;
    const aboutText = String(github.files.get("content/about/en.md"));
    res = await json(await post("/api/admin/page", { family: "about", lang: "en", markdown: aboutText }, env));
    assert(res.status === 200 && res.body.ok === true && res.body.unchanged === true, "identical about save is no-change success");
    assert(github.commits.length === aboutCommits, "identical about save does not create a commit");
    res = await json(await post("/api/admin/page", { family: "about", lang: "tr", markdown: "# Hakkında\n\nTR body\n" }, env));
    assert(res.status === 200 && res.body.ok && String(github.files.get("content/about/tr.md")).includes("TR body"), "about tr writes source file");

    res = await json(await post("/api/admin/site", { motto: "Think out of the box.", displayName: "KolTigin" }, env));
    assert(res.status === 200 && res.body.site.motto === "Think out of the box.", "save site");

    res = await json(await post("/api/admin/project-save", {
      id: "ario", name: "AR.IO", category: "mainnet", status: "active",
      summary: { en: "Gateway ops.", tr: "Gateway operasyonu." },
      links: [{ label: "Website", url: "https://ar.io" }]
    }, env));
    assert(res.status === 200 && res.body.id === "ario", "save project");
    const projects = JSON.parse(github.files.get("projects/projects.json"));
    assert(projects.mainnet.some((item) => item.id === "ario"), "projects.json updated in same commit");

    res = await json(await post("/api/admin/guide-save", { id: "aioz-depin", lang: "en", markdown: "# Guide\n" }, env));
    assert(res.status === 200, "save guide");
    res = await json(await post("/api/admin/guide-save", { id: "aioz-depin", lang: "tr", markdown: "# Rehber\n" }, env));
    assert(res.status === 200, "save guide tr");
    github.files.set("guides/aioz-depin/extra.txt", "orphan");
    github.files.set("assets/images/guides/aioz-depin/shot.png", png);
    github.files.set("content/projects/depin/aioz-depin.md", `---
name: AIOZ DePIN
category: depin
id: aioz-depin
links:
- label: Website
  url: https://aioz.network
- label: Setup Guide
  url: '#/guides/aioz-depin'
  guide: aioz-depin
---
`);
    const currentProjects = JSON.parse(github.files.get("projects/projects.json") || "{}");
    currentProjects.depin = [{
      id: "aioz-depin",
      name: "AIOZ DePIN",
      links: [
        { label: "Website", url: "https://aioz.network" },
        { label: "Setup Guide", url: "#/guides/aioz-depin", guide: "aioz-depin" }
      ]
    }];
    github.files.set("projects/projects.json", JSON.stringify(currentProjects, null, 2) + "\n");
    assert(JSON.parse(github.files.get("guides/index.json")).guides.includes("aioz-depin"), "guides index sync");

    const guideCommits = github.commits.length;
    res = await json(await post("/api/admin/guide-delete", { id: "aioz-depin" }, env));
    assert(res.status === 200, "delete existing guide");
    assert(!github.files.has("guides/aioz-depin/EN.md") && !github.files.has("guides/aioz-depin/TR.md"), "guide EN/TR sources removed");
    assert(!github.files.has("guides/aioz-depin/extra.txt"), "guide folder extras removed");
    assert(!github.files.has("assets/images/guides/aioz-depin/shot.png"), "guide assets removed");
    assert(!JSON.parse(github.files.get("guides/index.json")).guides.includes("aioz-depin"), "guide removed from index");
    assert(!String(github.files.get("content/projects/depin/aioz-depin.md")).includes("guide: aioz-depin"), "project markdown guide link removed");
    assert(!String(github.files.get("content/projects/depin/aioz-depin.md")).includes("#/guides/aioz-depin"), "project markdown guide url removed");
    const afterProjects = JSON.parse(github.files.get("projects/projects.json"));
    assert(!(afterProjects.depin[0].links || []).some((link) => link.guide === "aioz-depin"), "projects.json guide link removed");
    const rediscovered = discoverGuides({
      indexIds: JSON.parse(github.files.get("guides/index.json")).guides,
      markdownById: {
        "aioz-depin": {
          en: github.files.get("guides/aioz-depin/EN.md"),
          tr: github.files.get("guides/aioz-depin/TR.md")
        }
      }
    });
    assert(!rediscovered.includes("aioz-depin"), "deleted slug does not reappear on rediscover");
    assert(github.commits.length === guideCommits + 1, "guide delete is one commit");
    assert(github.commits.at(-1).message === "admin: delete guide aioz-depin", "guide delete commit message");

    res = await json(await post("/api/admin/contact", {
      location: { city: "Eskişehir", country: "Türkiye" },
      i18n: { en: { title: "Contact" }, tr: { title: "İletişim" } }
    }, env));
    assert(res.status === 200, "save contact");

    res = await json(await post("/api/admin/save", {
      kind: "videos", titleEn: "Demo", titleTr: "Demo TR", date: "01.09.2026",
      youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk"
    }, env));
    assert(res.status === 200 && res.body.youtubeId === "abcdefghijk", "save video");

    res = await json(await post("/api/admin/save", { kind: "articles", lang: "zz", title: "x", date: "2026-01-01", id: "x" }, env));
    assert(res.status === 400 && res.body.ok === false, "validation error");

    res = await json(await post("/api/admin/page", { family: "hack", lang: "en", markdown: "x" }, env));
    assert(res.status === 400, "unknown page family");

    const locked = envWith(github);
    delete locked.TEST_MODE;
    res = await json(await post("/api/admin/save", { kind: "articles", lang: "en", id: "nope", title: "x", date: "2026-01-01" }, locked));
    assert(res.status === 401, "missing Access JWT rejected");
    const beforeAccessBlock = github.commits.length;
    const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const fakeJwt = `${b64url({ alg: "RS256", kid: "k" })}.${b64url({
      iss: "https://team.cloudflareaccess.com", aud: "aud-1", exp: 4102444800
    })}.sig`;
    locked.ACCESS_TEAM_DOMAIN = "team.cloudflareaccess.com";
    res = await json(await post("/api/admin/page", { family: "about", lang: "en", markdown: "# blocked\n" }, locked, {
      "CF-Access-Jwt-Assertion": fakeJwt
    }));
    assert(res.status === 500 && String(res.body.error).includes("Access is not configured"), "missing ACCESS_AUD is rejected");
    assert(github.commits.length === beforeAccessBlock, "Access failure does not mutate GitHub");

    res = await json(await postForm("/api/admin/cover", { name: "shot.png", bytes: png }, {}, env));
    assert(res.status === 200 && res.body.filename.endsWith(".png"), "cover upload");
    assert([...github.files.keys()].some((path) => path.startsWith("assets/images/blog/")), "cover stored under blog");

    res = await json(await post("/api/admin/save", { action: "delete", kind: "articles", id: "smoke-note" }, env));
    assert(res.status === 200, "delete existing writing");
    assert(!github.files.has("content/articles/en/smoke-note.md") && !github.files.has("content/articles/tr/smoke-note.md"), "writing files removed");
    assert(!JSON.parse(github.files.get("content/index.json")).articles.en.includes("smoke-note.md"), "writing index updated");
    assert(!JSON.parse(github.files.get("content/index.json")).articles.tr.includes("smoke-note.md"), "writing tr index updated");
    assert(github.commits.at(-1).message === "admin: delete writing smoke-note", "writing delete commit message");

    const writingCommits = github.commits.length;
    res = await json(await post("/api/admin/save", { action: "delete", kind: "articles", id: "smoke-note" }, env));
    assert(res.status === 404 && String(res.body.error).includes("not found"), "nonexistent writing returns a clear error");
    assert(github.commits.length === writingCommits, "failed writing delete does not commit");

    res = await json(await post("/api/admin/save", { action: "delete", kind: "articles", id: "../etc" }, env));
    assert(res.status === 400, "invalid writing identifier rejected");

    res = await json(await post("/api/admin/save", { action: "delete", kind: "about", id: "en" }, env));
    assert(res.status === 400, "core page cannot be deleted as a writing");

    res = await json(await post("/api/admin/save", { action: "delete", kind: "videos", id: "demo" }, env));
    assert(res.status === 200, "delete existing video");
    assert(!github.files.has("content/videos/demo.md"), "video file removed");
    assert(!JSON.parse(github.files.get("content/index.json")).videos.includes("demo.md"), "video index updated");
    assert(github.commits.at(-1).message === "admin: delete video demo", "video delete commit message");

    res = await json(await post("/api/admin/save", { action: "delete", kind: "videos", id: "demo" }, env));
    assert(res.status === 404 && String(res.body.error).includes("not found"), "nonexistent video returns a clear error");

    const projectCommits = github.commits.length;
    res = await json(await post("/api/admin/project-save", { action: "delete", id: "ario" }, env));
    assert(res.status === 200, "delete existing project");
    assert(!github.files.has("content/projects/mainnet/ario.md"), "project markdown removed");
    assert(!JSON.parse(github.files.get("projects/projects.json")).mainnet.some((item) => item.id === "ario"), "projects.json updated");
    assert(github.commits.length === projectCommits + 1, "project delete is one commit");
    assert(github.commits.at(-1).message === "admin: delete project ario", "project delete commit message");

    res = await json(await post("/api/admin/project-save", { action: "delete", id: "ario" }, env));
    assert(res.status === 404 && String(res.body.error).includes("not found"), "nonexistent project returns a clear error");

    res = await json(await post("/api/admin/guide-delete", { id: "missing-guide" }, env));
    assert(res.status === 404 && String(res.body.error).includes("not found"), "nonexistent guide returns a clear error");

    res = await json(await post("/api/admin/guide-delete", { id: "---" }, env));
    assert(res.status === 400, "invalid guide identifier rejected");

    const lockedDelete = envWith(github);
    delete lockedDelete.TEST_MODE;
    const beforeUnauthorized = github.commits.length;
    res = await json(await post("/api/admin/save", { action: "delete", kind: "articles", id: "old" }, lockedDelete));
    assert(res.status === 401, "unauthorized delete request rejected");
    assert(github.commits.length === beforeUnauthorized, "unauthorized delete does not mutate GitHub");

    const gh = new MockGitHub(seed());
    const env2 = envWith(gh);
    function cloneFiles(map) {
      return new Map([...map.entries()].map(([key, value]) => [key, value instanceof Uint8Array ? Uint8Array.from(value) : value]));
    }
    function filesUnchanged(before) {
      if (before.size !== gh.files.size) return false;
      for (const [key, value] of before) {
        const now = gh.files.get(key);
        if (now === undefined) return false;
        if (String(value) !== String(now)) return false;
      }
      return true;
    }

    res = await json(await post("/api/admin/project-categories", { action: "create", label: { en: "Labs", tr: "Lablar" } }, env2));
    assert(res.status === 200 && res.body.id === "labs", "create empty project category");
    res = await json(await post("/api/admin/project-categories", { action: "delete", id: "labs" }, env2));
    assert(res.status === 200, "empty project category delete");
    assert(!JSON.parse(gh.files.get("config/project-categories.json")).some((item) => item.id === "labs"), "empty labs removed from config");
    assert(!("labs" in JSON.parse(gh.files.get("projects/projects.json"))), "empty labs removed from projects.json");

    res = await json(await post("/api/admin/project-categories", { action: "create", label: { en: "Labs", tr: "Lablar" } }, env2));
    res = await json(await post("/api/admin/project-save", {
      id: "labs-one", name: "Labs One", category: "labs", status: "active",
      summary: { en: "A lab.", tr: "Laboratuvar." },
      links: [{ label: "Website", url: "https://example.com" }]
    }, env2));
    assert(res.status === 200, "project in custom category");
    const beforeMissingMove = cloneFiles(gh.files);
    const commitsMissingMove = gh.commits.length;
    res = await json(await post("/api/admin/project-categories", { action: "delete", id: "labs" }, env2));
    assert(res.status === 409 && String(res.body.error).includes("contains"), "occupied project category requires moveTo");
    assert(gh.commits.length === commitsMissingMove && filesUnchanged(beforeMissingMove), "no commit when moveTo missing");

    res = await json(await post("/api/admin/project-save", {
      id: "ario", name: "AR.IO", category: "mainnet", status: "active",
      summary: { en: "Gateway ops.", tr: "Gateway operasyonu." },
      links: [{ label: "Website", url: "https://ar.io" }]
    }, env2));
    res = await json(await post("/api/admin/project-save", {
      id: "ario", name: "AR.IO Labs", category: "labs", status: "active",
      summary: { en: "Clash.", tr: "Çakışma." },
      links: [{ label: "Website", url: "https://example.com" }]
    }, env2));
    const beforeCollision = cloneFiles(gh.files);
    const commitsCollision = gh.commits.length;
    res = await json(await post("/api/admin/project-categories", { action: "delete", id: "labs", moveTo: "mainnet" }, env2));
    assert(res.status === 409 && String(res.body.error).includes("already exists"), "project path collision");
    assert(gh.commits.length === commitsCollision && filesUnchanged(beforeCollision), "no commit on project collision");

    res = await json(await post("/api/admin/project-categories", { action: "delete", id: "mainnet" }, env2));
    assert(res.status === 403, "protected project category cannot be deleted");

    const ghMove = new MockGitHub(seed());
    const envMove = envWith(ghMove);
    await json(await post("/api/admin/project-categories", { action: "create", label: { en: "Labs", tr: "Lablar" } }, envMove));
    await json(await post("/api/admin/project-save", {
      id: "labs-one", name: "Labs One", category: "labs", status: "active",
      summary: { en: "A lab.", tr: "Laboratuvar." },
      links: [{ label: "Website", url: "https://example.com" }]
    }, envMove));
    const nBeforeMigrate = ghMove.commits.length;
    res = await json(await post("/api/admin/project-categories", { action: "delete", id: "labs", moveTo: "mainnet" }, envMove));
    assert(res.status === 200 && res.body.moved === 1, "project category migration");
    assert(ghMove.commits.length === nBeforeMigrate + 1, "project migrate is one commit");
    const lastProject = ghMove.commits[ghMove.commits.length - 1];
    assert(lastProject.upserts.includes("config/project-categories.json") && lastProject.upserts.includes("projects/projects.json"), "project migrate updates config + generated json");
    assert(ghMove.files.has("content/projects/mainnet/labs-one.md"), "project markdown moved");
    assert(!ghMove.files.has("content/projects/labs/labs-one.md"), "source project markdown removed");
    assert(String(ghMove.files.get("content/projects/mainnet/labs-one.md")).includes("category: mainnet"), "project category yaml updated");
    const movedProjects = JSON.parse(ghMove.files.get("projects/projects.json"));
    assert(movedProjects.mainnet.some((item) => item.id === "labs-one") && !("labs" in movedProjects), "projects.json synced after migrate");
    assert(!JSON.parse(ghMove.files.get("config/project-categories.json")).some((item) => item.id === "labs"), "source category removed from config");

    res = await json(await post("/api/admin/writing-types", { action: "create", label: { en: "Essays", tr: "Denemeler" } }, env2));
    assert(res.status === 200 && res.body.id === "essays", "create empty writing type");
    res = await json(await post("/api/admin/writing-types", { action: "delete", id: "essays" }, env2));
    assert(res.status === 200, "empty writing type delete");
    assert(!JSON.parse(gh.files.get("config/writing-types.json")).types.some((item) => item.id === "essays"), "empty essays removed");

    res = await json(await post("/api/admin/writing-types", { action: "create", label: { en: "Essays", tr: "Denemeler" } }, env2));
    res = await json(await post("/api/admin/save", {
      kind: "essays", lang: "en", id: "keep-id", title: "Keep", date: "2026-09-01", body: "Body"
    }, env2));
    const beforeWriteMoveTo = cloneFiles(gh.files);
    const commitsWriteMoveTo = gh.commits.length;
    res = await json(await post("/api/admin/writing-types", { action: "delete", id: "essays" }, env2));
    assert(res.status === 409 && String(res.body.error).includes("contains"), "occupied writing type requires moveTo");
    assert(gh.commits.length === commitsWriteMoveTo && filesUnchanged(beforeWriteMoveTo), "no commit when writing moveTo missing");

    res = await json(await post("/api/admin/writing-types", { action: "delete", id: "articles" }, env2));
    assert(res.status === 403, "core writing type cannot be deleted");

    const beforeX = cloneFiles(gh.files);
    const commitsX = gh.commits.length;
    res = await json(await post("/api/admin/writing-types", { action: "delete", id: "essays", moveTo: "social" }, env2));
    assert(res.status === 400 && String(res.body.error).includes("Original X URL"), "X Post migrate requires URL");
    assert(gh.commits.length === commitsX && filesUnchanged(beforeX), "no commit when X URL missing");

    res = await json(await post("/api/admin/save", {
      kind: "articles", lang: "en", id: "keep-id", title: "Existing", date: "2026-01-01", body: "x"
    }, env2));
    const beforeWriteCollision = cloneFiles(gh.files);
    const commitsWriteCollision = gh.commits.length;
    res = await json(await post("/api/admin/writing-types", { action: "delete", id: "essays", moveTo: "articles" }, env2));
    assert(res.status === 409 && String(res.body.error).includes("already exists"), "writing path collision");
    assert(gh.commits.length === commitsWriteCollision && filesUnchanged(beforeWriteCollision), "no commit on writing collision");

    const ghW = new MockGitHub(seed());
    const envW = envWith(ghW);
    await json(await post("/api/admin/writing-types", { action: "create", label: { en: "Essays", tr: "Denemeler" } }, envW));
    await json(await post("/api/admin/save", {
      kind: "essays", lang: "en", id: "keep-id", title: "Keep", date: "2026-09-01", body: "Body"
    }, envW));
    await json(await post("/api/admin/save", {
      kind: "essays", lang: "tr", id: "keep-id", title: "Koru", date: "2026-09-01", body: "Govde"
    }, envW));
    const nBeforeW = ghW.commits.length;
    res = await json(await post("/api/admin/writing-types", { action: "delete", id: "essays", moveTo: "articles" }, envW));
    assert(res.status === 200 && res.body.moved === 1, "writing type migration");
    assert(ghW.commits.length === nBeforeW + 1, "writing migrate is one commit");
    const lastW = ghW.commits[ghW.commits.length - 1];
    assert(lastW.upserts.includes("config/writing-types.json") && lastW.upserts.includes("content/index.json"), "writing migrate updates types + index");
    assert(ghW.files.has("content/articles/en/keep-id.md") && ghW.files.has("content/articles/tr/keep-id.md"), "writing id preserved on move");
    assert(!ghW.files.has("content/essays/en/keep-id.md"), "source writing removed");
    const wIndex = JSON.parse(ghW.files.get("content/index.json"));
    assert(wIndex.articles.en.includes("keep-id.md") && wIndex.articles.tr.includes("keep-id.md"), "content/index.json synced");
    assert(!wIndex.essays && !wIndex.types.some((item) => item.id === "essays"), "source writing type gone from index");

    await json(await post("/api/admin/writing-types", { action: "create", label: { en: "Threads", tr: "Konular" } }, envW));
    await json(await post("/api/admin/save", {
      kind: "threads", lang: "en", id: "x-note", title: "X Note", date: "2026-09-01",
      body: "Hello"
    }, envW));
    const threadMd = String(ghW.files.get("content/threads/en/x-note.md")).replace(
      "date: 2026-09-01",
      "date: 2026-09-01\nexternalUrl: https://x.com/mkoltigin/status/1"
    );
    ghW.files.set("content/threads/en/x-note.md", threadMd);
    res = await json(await post("/api/admin/writing-types", { action: "delete", id: "threads", moveTo: "social" }, envW));
    assert(res.status === 200, "writing migrate to X Post with front-matter URL");
    assert(String(ghW.files.get("content/social/en/x-note.md")).includes("externalUrl:"), "externalUrl kept for X Post");

    ghW.failCommit = true;
    const beforeFail = new Map(ghW.files);
    const commitsFail = ghW.commits.length;
    res = await json(await post("/api/admin/writing-types", { action: "create", label: { en: "Drafts", tr: "Taslaklar" } }, envW));
    assert(res.status === 409, "commit conflict returns 409");
    assert(ghW.commits.length === commitsFail, "failed commit is not recorded");
    assert(beforeFail.size === ghW.files.size, "mock files unchanged on commit 409");
    ghW.failCommit = false;

    const ghMoveOne = new MockGitHub(seed());
    const envM = envWith(ghMoveOne);
    await json(await post("/api/admin/save", {
      kind: "articles", lang: "en", id: "pair-move", title: "Pair EN", date: "2026-09-01", body: "Hello EN"
    }, envM));
    await json(await post("/api/admin/save", {
      kind: "articles", lang: "tr", id: "pair-move", title: "Pair TR", date: "2026-09-01", body: "Merhaba TR"
    }, envM));
    let n = ghMoveOne.commits.length;
    res = await json(await post("/api/admin/save", {
      kind: "notes", lang: "en", id: "pair-move", fromKind: "articles",
      title: "Pair EN", date: "2026-09-01", body: "Hello EN"
    }, envM));
    assert(res.status === 200 && res.body.id === "pair-move", "internal writing category move");
    assert(ghMoveOne.commits.length === n + 1, "single-writing move is one commit");
    assert(ghMoveOne.files.has("content/notes/en/pair-move.md") && ghMoveOne.files.has("content/notes/tr/pair-move.md"), "shared id moved both langs");
    assert(!ghMoveOne.files.has("content/articles/en/pair-move.md") && !ghMoveOne.files.has("content/articles/tr/pair-move.md"), "source markdown removed");
    assert(!String(ghMoveOne.files.get("content/notes/en/pair-move.md")).includes("externalUrl"), "internal dest has no externalUrl");
    const movedIdx = JSON.parse(ghMoveOne.files.get("content/index.json"));
    assert(movedIdx.notes.en.includes("pair-move.md") && movedIdx.notes.tr.includes("pair-move.md"), "index lists dest both langs");
    assert(!movedIdx.articles.en.includes("pair-move.md") && !movedIdx.articles.tr.includes("pair-move.md"), "index dropped source both langs");
    assert(Array.isArray(movedIdx.types) && Array.isArray(movedIdx.videos), "index schema preserved after move");

    n = ghMoveOne.commits.length;
    const beforeXMissing = new Map(ghMoveOne.files);
    res = await json(await post("/api/admin/save", {
      kind: "social", lang: "en", id: "pair-move", fromKind: "notes",
      title: "Pair EN", date: "2026-09-01", body: "Hello EN"
    }, envM));
    assert(res.status === 400 && String(res.body.error).includes("x.com"), "internal to X Post without URL");
    assert(ghMoveOne.commits.length === n && beforeXMissing.size === ghMoveOne.files.size, "no commit when X URL missing on save-move");

    res = await json(await post("/api/admin/save", {
      kind: "social", lang: "en", id: "pair-move", fromKind: "notes",
      title: "Pair EN", date: "2026-09-01", body: "Hello EN",
      externalUrl: "https://x.com/mkoltigin/status/42"
    }, envM));
    assert(res.status === 200, "internal to X Post with valid URL");
    assert(String(ghMoveOne.files.get("content/social/en/pair-move.md")).includes("externalUrl:"), "X Post front matter has URL");
    assert(String(ghMoveOne.files.get("content/social/tr/pair-move.md")).includes("x.com/mkoltigin/status/42"), "sibling rewritten with X URL");
    assert(!ghMoveOne.files.has("content/notes/en/pair-move.md"), "notes source gone after X move");

    res = await json(await post("/api/admin/save", {
      kind: "articles", lang: "en", id: "pair-move", fromKind: "social",
      title: "Back", date: "2026-09-01", body: "Hello EN"
    }, envM));
    assert(res.status === 200, "X Post to internal");
    assert(!String(ghMoveOne.files.get("content/articles/en/pair-move.md")).includes("externalUrl"), "X to internal strips externalUrl");
    assert(!String(ghMoveOne.files.get("content/articles/tr/pair-move.md")).includes("externalUrl"), "sibling stripped on X to internal");

    await json(await post("/api/admin/save", {
      kind: "notes", lang: "en", id: "pair-move", title: "Clash", date: "2026-09-01", body: "x"
    }, envM));
    n = ghMoveOne.commits.length;
    const beforeCol = new Map(ghMoveOne.files);
    res = await json(await post("/api/admin/save", {
      kind: "notes", lang: "en", id: "pair-move", fromKind: "articles",
      title: "Back", date: "2026-09-01", body: "Hello EN"
    }, envM));
    assert(res.status === 409 && String(res.body.error).includes("already exists"), "single-writing path collision");
    assert(ghMoveOne.commits.length === n && beforeCol.size === ghMoveOne.files.size, "no commit on save-move collision");

    n = ghMoveOne.commits.length;
    const beforeMissing = new Map(ghMoveOne.files);
    res = await json(await post("/api/admin/save", {
      kind: "notes", lang: "en", id: "no-such-writing", fromKind: "articles",
      title: "Ghost", date: "2026-09-01", body: "x"
    }, envM));
    assert(res.status === 404 && String(res.body.error).includes("was not found"), "source missing on save-move");
    assert(ghMoveOne.commits.length === n && beforeMissing.size === ghMoveOne.files.size, "no commit when source missing");

    const repoIndex = JSON.parse(readFileSync(join(ROOT, "content/index.json"), "utf8"));
    const repoTypes = JSON.parse(readFileSync(join(ROOT, "config/writing-types.json"), "utf8"));
    const repoProjects = JSON.parse(readFileSync(join(ROOT, "projects/projects.json"), "utf8"));
    const repoCats = JSON.parse(readFileSync(join(ROOT, "config/project-categories.json"), "utf8"));
    const repoGuides = JSON.parse(readFileSync(join(ROOT, "guides/index.json"), "utf8"));
    const typeIds = (repoTypes.types || []).map((item) => item.id);
    assert(Array.isArray(repoIndex.types) && repoIndex.types.every((item) => item && item.id), "repo index.types schema");
    assert(typeIds.every((id) => repoIndex.types.some((item) => item.id === id)), "index.types covers writing-types.json");
    assert(typeIds.every((id) => Array.isArray(repoIndex[id]?.en) && Array.isArray(repoIndex[id]?.tr)), "index has en/tr lists per type");
    assert(Array.isArray(repoIndex.videos), "index.videos is a list");
    const patched = applyWritingIndex(repoIndex, { kind: "articles", lang: "en", file: "zzz-parity.md" });
    assert(patched.articles.en.includes("zzz-parity.md"), "parity patch adds file");
    assert(JSON.stringify(patched.types) === JSON.stringify(repoIndex.types), "parity patch keeps types");
    assert(JSON.stringify(patched.videos) === JSON.stringify(repoIndex.videos), "parity patch keeps videos");
    assert((repoIndex.articles.en || []).every((name) => name === "zzz-parity.md" || patched.articles.en.includes(name)), "parity patch keeps existing listings");
    assert(repoCats.every((cat) => Array.isArray(repoProjects[cat.id])), "projects.json keys match categories");
    const sample = Object.values(repoProjects).flat().find((item) => item && item.id);
    if (sample) {
      assert(sample.name && sample.status, "projects.json public fields present");
      const mapped = projectJsonItem({
        id: sample.id, name: sample.name, status: sample.status,
        role: sample.role, former_name: sample.formerName, logo: sample.logo,
        summary: sample.summary, links: sample.links,
        referral_url: sample.referralUrl, referral_code: sample.referralCode
      });
      assert(mapped.id === sample.id && mapped.name === sample.name && mapped.status === sample.status, "projectJsonItem public contract");
    }
    assert(Array.isArray(repoGuides.guides), "guides/index.json schema");
    assert(compareProjectNames("AR.IO", "ZIO") < 0 && compareProjectNames("Item 2", "Item 10") < 0, "project name sort matches generator intent");

    assert(!String(JSON.stringify([...github.files.values()])).includes("ghp_"), "no pat in mock files");
    assert(github.commits.length > 0, "commits recorded");
  } catch (error) {
    failed += 1;
    console.error("FAIL uncaught", error);
  }

  if (failed) {
    console.error(`\n${failed} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll admin-api local tests passed.");
}

main();
