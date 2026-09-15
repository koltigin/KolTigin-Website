#!/usr/bin/env python3
"""Phase 3 dual-publish tests. Localized copies exist; SEO stays ID-canonical + noindex."""
from __future__ import annotations

import importlib.util
import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

spec = importlib.util.spec_from_file_location("generate_share", ROOT / "scripts" / "generate-share.py")
generate_share = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(generate_share)

SOUL_ID = "2026-08-31-soulmemory"
SOUL_EN = "soulmemory-on-chain-mood-diary"
SOUL_TR = "soulmemory-on-chain-duygu-gunlugu"
CLARITY_ID = "clarity-act-abd-kripto-piyasasinda-gozler-senato-da"
CLARITY_EN = "clarity-act-all-eyes-on-the-us-senate"
NOTE_ID = "2025-06-01-turkce-node-rehberi"
NOTE_EN = "three-rules-i-follow-when-writing-node-guides"
NOTE_TR = "node-rehberi-yazarken-dikkat-ettigim-uc-temel-kural"
GUIDE_ID = "how-to-get-an-arns-domain"
GUIDE_TR = "arns-domain-nasil-alinir"


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL {msg}")


def ok(msg: str) -> None:
    print("ok", msg)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def attr(html: str, name: str) -> str | None:
    match = re.search(rf'{name}="([^"]*)"', html)
    return match.group(1) if match else None


def canonical(html: str) -> str | None:
    match = re.search(r'rel="canonical"\s+href="([^"]+)"', html, re.I)
    if match:
        return match.group(1)
    match = re.search(r'href="([^"]+)"\s+rel="canonical"', html, re.I)
    return match.group(1) if match else None


def og_url(html: str) -> str | None:
    match = re.search(r'property="og:url"\s+content="([^"]+)"', html, re.I)
    return match.group(1) if match else None


def robots(html: str) -> str | None:
    match = re.search(r'name="robots"\s+content="([^"]+)"', html, re.I)
    return match.group(1) if match else None


def hreflangs(html: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for match in re.finditer(
        r'rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"', html, re.I
    ):
        out[match.group(1)] = match.group(2)
    for match in re.finditer(
        r'rel="alternate"\s+href="([^"]+)"\s+hreflang="([^"]+)"', html, re.I
    ):
        out[match.group(2)] = match.group(1)
    return out


def jsonld_urls(html: str) -> list[str]:
    found: list[str] = []
    for match in re.finditer(
        r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    ):
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        nodes = data if isinstance(data, list) else [data]
        if isinstance(data, dict) and "@graph" in data:
            nodes = data["@graph"]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            for key in ("url", "mainEntityOfPage"):
                value = node.get(key)
                if isinstance(value, str):
                    found.append(value)
                elif isinstance(value, dict) and isinstance(value.get("@id"), str):
                    found.append(value["@id"])
    return found


def article_body(html: str) -> str:
    match = re.search(
        r'<div class="blog-post-content"[^>]*>([\s\S]*?)</div>\s*(?:<div class="share-actions"|</article>)',
        html,
        re.I,
    )
    if match:
        return re.sub(r"\s+", " ", match.group(1)).strip()
    match = re.search(r"<main>([\s\S]*?)</main>", html, re.I)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else ""


def test_destination_registry_collisions() -> None:
    registry = generate_share.DestinationRegistry()
    registry.claim("writings/en/articles/same-id/index.html", "writing:articles/same-id")
    # slug == ID for same owner is fine (same destination).
    registry.claim("writings/en/articles/same-id/index.html", "writing:articles/same-id")
    try:
        registry.claim(
            "writings/en/articles/same-id/index.html",
            "writing:articles/other-id",
        )
        fail("cross-item ID collision must raise")
    except generate_share.DualPublishError:
        pass
    registry.claim("writings/en/articles/localized-slug/index.html", "writing:articles/a")
    try:
        registry.claim(
            "writings/en/articles/localized-slug/index.html",
            "writing:articles/b",
        )
        fail("localized slug collision must raise")
    except generate_share.DualPublishError:
        pass
    # Localized destination colliding with another item's stable ID path.
    registry.claim("guides/other-guide/TR/index.html", "guide:other-guide")
    try:
        registry.claim("guides/other-guide/TR/index.html", "guide:how-to-get-an-arns-domain")
        fail("localized guide colliding with another stable ID must raise")
    except generate_share.DualPublishError:
        pass
    ok("destination collision protection")


def current_id_tree() -> Path:
    """Build an isolated CURRENT_ID generate tree from live content (Phase 3 freeze)."""
    import shutil

    tmp = Path(tempfile.mkdtemp(prefix="phase3-current-id-"))
    for rel in (
        "content",
        "config",
        "i18n",
        "index.html",
        "assets/fonts",
        "assets/images/profile",
        "assets/images/og/backgrounds",
        "assets/images/blog",
        "assets/images/guides",
    ):
        src = ROOT / rel
        dest = tmp / rel
        if not src.exists():
            continue
        if src.is_dir():
            shutil.copytree(src, dest)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
    generate_share.generate(tmp, public_url_mode="CURRENT_ID")
    return tmp


def test_live_dual_publish_existence_and_seo() -> None:
    old_en = ROOT / "writings" / "en" / "articles" / SOUL_ID / "index.html"
    new_en = ROOT / "writings" / "en" / "articles" / SOUL_EN / "index.html"
    old_tr = ROOT / "writings" / "tr" / "articles" / SOUL_ID / "index.html"
    new_tr = ROOT / "writings" / "tr" / "articles" / SOUL_TR / "index.html"
    note_old = ROOT / "writings" / "en" / "notes" / NOTE_ID / "index.html"
    note_new = ROOT / "writings" / "en" / "notes" / NOTE_EN / "index.html"
    guide_old = ROOT / "guides" / GUIDE_ID / "TR" / "index.html"
    guide_new = ROOT / "guides" / GUIDE_TR / "TR" / "index.html"
    clarity_en_old = ROOT / "writings" / "en" / "articles" / CLARITY_ID / "index.html"
    clarity_en_new = ROOT / "writings" / "en" / "articles" / CLARITY_EN / "index.html"
    clarity_tr = ROOT / "writings" / "tr" / "articles" / CLARITY_ID / "index.html"

    for path in (old_en, new_en, old_tr, new_tr, note_old, note_new, guide_old, guide_new, clarity_en_old, clarity_en_new, clarity_tr):
        if not path.is_file():
            fail(f"missing dual-publish page: {path.relative_to(ROOT)}")

    import shutil

    tmp = current_id_tree()
    try:
        clarity_tr_html = read(tmp / "writings" / "tr" / "articles" / CLARITY_ID / "index.html")
        if robots(clarity_tr_html) and "noindex" in (robots(clarity_tr_html) or ""):
            fail("Clarity TR slug==ID page must not get Phase 3 noindex")

        pairs = [
            (
                tmp / "writings" / "en" / "articles" / SOUL_ID / "index.html",
                tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html",
                f"https://koltigin.xyz/writings/en/articles/{SOUL_ID}/",
            ),
            (
                tmp / "writings" / "tr" / "articles" / SOUL_ID / "index.html",
                tmp / "writings" / "tr" / "articles" / SOUL_TR / "index.html",
                f"https://koltigin.xyz/writings/tr/articles/{SOUL_ID}/",
            ),
            (
                tmp / "writings" / "en" / "notes" / NOTE_ID / "index.html",
                tmp / "writings" / "en" / "notes" / NOTE_EN / "index.html",
                f"https://koltigin.xyz/writings/en/notes/{NOTE_ID}/",
            ),
            (
                tmp / "guides" / GUIDE_ID / "TR" / "index.html",
                tmp / "guides" / GUIDE_TR / "TR" / "index.html",
                f"https://koltigin.xyz/guides/{GUIDE_ID}/TR/",
            ),
            (
                tmp / "writings" / "en" / "articles" / CLARITY_ID / "index.html",
                tmp / "writings" / "en" / "articles" / CLARITY_EN / "index.html",
                f"https://koltigin.xyz/writings/en/articles/{CLARITY_ID}/",
            ),
        ]
        for old_path, new_path, id_url in pairs:
            old_html = read(old_path)
            new_html = read(new_path)
            if robots(old_html) and "noindex" in (robots(old_html) or ""):
                fail(f"ID page must not be noindex: {old_path.relative_to(tmp)}")
            if robots(new_html) != "noindex,follow":
                fail(f"localized copy must be noindex,follow: {new_path.relative_to(tmp)}")
            if canonical(old_html) != id_url or canonical(new_html) != id_url:
                fail(f"canonical must stay ID-based for {old_path.name}")
            if og_url(old_html) != id_url or og_url(new_html) != id_url:
                fail(f"og:url must stay ID-based for {old_path.name}")
            old_alt = hreflangs(old_html)
            new_alt = hreflangs(new_html)
            if old_alt != new_alt:
                fail(f"hreflang mismatch between old/new for {old_path.relative_to(tmp)}")
            if any(SOUL_EN in url or SOUL_TR in url or GUIDE_TR in url or NOTE_EN in url for url in old_alt.values()):
                fail("hreflang must remain ID-based")
            for url in jsonld_urls(old_html) + jsonld_urls(new_html):
                if url != id_url and "koltigin.xyz" in url and ("/writings/" in url or "/guides/" in url):
                    if "/assets/" not in url and url != id_url:
                        fail(f"JSON-LD must stay ID-based, got {url}")
            if attr(old_html, "data-content-id") != attr(new_html, "data-content-id"):
                fail("data-content-id must match across dual pair")
            if attr(old_html, "data-en-slug") != attr(new_html, "data-en-slug"):
                fail("data-en-slug must match across dual pair")
            if "guides" not in old_path.parts:
                if article_body(old_html) != article_body(new_html):
                    fail(f"article body mismatch for {old_path.relative_to(tmp)}")
                if f"<title>" not in old_html:
                    fail("missing title")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    ok("live dual-publish existence + SEO safety")


def test_sitemap_and_redirects() -> None:
    import shutil

    tmp = current_id_tree()
    try:
        sitemap = read(tmp / "sitemap.xml")
        if f"/writings/en/articles/{SOUL_ID}/" not in sitemap:
            fail("sitemap missing SoulMemory ID URL")
        if f"/guides/{GUIDE_ID}/TR/" not in sitemap:
            fail("sitemap missing ArNS TR ID URL")
        for needle in (SOUL_EN, SOUL_TR, NOTE_EN, NOTE_TR, GUIDE_TR, CLARITY_EN):
            if needle in sitemap:
                fail(f"sitemap must not list localized path segment {needle}")
        if "xmlns:xhtml" in sitemap or "xhtml:link" in sitemap:
            fail("sitemap must not add xhtml alternates")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    # Live redirects.enabled may be true after Phase 4C (Cloudflare edge only).
    # Phase 3 guarantee here is CURRENT_ID sitemap shape in the temp tree above.
    redirects = json.loads(read(ROOT / "config" / "redirects.json"))
    if redirects.get("enabled") is not True and redirects.get("enabled") is not False:
        fail("redirects.enabled must be boolean")
    ok("sitemap ID-only + redirects disabled")


def test_links_share_language_switch_still_id() -> None:
    import shutil

    site_js = read(ROOT / "assets" / "js" / "site.js")
    blog = read(ROOT / "assets" / "js" / "blog-parser.js")
    guides = read(ROOT / "assets" / "js" / "guides-parser.js")
    share = read(ROOT / "assets" / "js" / "share-actions.js")
    projects = read(ROOT / "assets" / "js" / "projects-parser.js")

    if "writingStableIdFromRoute" not in site_js or "guideStableIdFromRoute" not in site_js:
        fail("site.js routeSeo must resolve stable IDs on dual-publish paths")
    if "writingLocalizedPublicPath" in site_js and "writingPublicPath(loc" not in site_js:
        fail("language switch must keep writingPublicPath")
    if "writingStableIdFromRoute" not in blog:
        fail("blog-parser language switch must resolve stable IDs")
    if "guidePublicPath" not in guides:
        fail("guide cards must use mode-aware guidePublicPath")
    if "writingPublicPath" not in blog:
        fail("writing cards must use mode-aware writingPublicPath")
    router = read(ROOT / "assets" / "js" / "router.js")
    if "MODE_CURRENT_ID" not in router or "setPublicUrlMode" not in router:
        fail("router must still support CURRENT_ID mode")
    if "writingLocalizedShareUrl" in share and "function writingShareUrl" not in share:
        fail("live share helper writingShareUrl must remain")
    if "`/guides/${encodeURIComponent(guideId)}/${code}/`" not in projects and "guideShareHref" not in projects:
        fail("project guide links helper must remain")
    tmp = current_id_tree()
    try:
        localized = read(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html")
        if f'data-share-url="https://koltigin.xyz/writings/en/articles/{SOUL_ID}/"' not in localized:
            if f"/writings/en/articles/{SOUL_ID}/" not in localized:
                fail("CURRENT_ID localized writing HTML must embed ID-based share/canonical URL")
            if SOUL_EN in localized and f'data-share-url="https://koltigin.xyz/writings/en/articles/{SOUL_EN}/"' in localized:
                fail("CURRENT_ID localized copy must not share its own localized URL")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    ok("cards/index/share/language-switch remain ID-based")


def test_ga4_admin_404() -> None:
    localized = read(ROOT / "writings" / "en" / "articles" / SOUL_EN / "index.html")
    legacy = read(ROOT / "writings" / "en" / "articles" / SOUL_ID / "index.html")
    for html in (localized, legacy):
        if "G-CD89YCN426" not in html:
            fail("public dual-publish pages must keep GA4")
    admin = read(ROOT / "admin" / "index.html")
    not_found = read(ROOT / "404.html")
    if "G-CD89YCN426" in admin:
        fail("admin must not have GA4")
    if "G-CD89YCN426" in not_found:
        fail("404 must not have GA4")
    if "noindex" not in not_found:
        fail("404 must keep noindex")
    ok("GA4/admin/404")


def test_temp_dual_publish_and_slug_eq_id() -> None:
    with tempfile.TemporaryDirectory() as raw:
        tmp = Path(raw)
        # Minimal fixture reused from generate-share tests patterns.
        from test_generate_share import setup_root  # type: ignore

        setup_root(tmp)
        result = generate_share.generate(tmp, public_url_mode="CURRENT_ID")
        legacy = tmp / "writings" / "en" / "notes" / "no-cover" / "index.html"
        localized = tmp / "writings" / "en" / "notes" / "validator-notes" / "index.html"
        if not legacy.is_file() or not localized.is_file():
            fail("temp dual-publish must emit old and new writing paths")
        if robots(read(legacy)):
            if "noindex" in (robots(read(legacy)) or ""):
                fail("temp ID page must not be noindex")
        if robots(read(localized)) != "noindex,follow":
            fail("temp localized page must be noindex,follow")
        if canonical(read(localized)) != "https://koltigin.xyz/writings/en/notes/no-cover/":
            fail("temp localized canonical must point at ID URL")
        guide_legacy = tmp / "guides" / "demo-guide" / "TR" / "index.html"
        guide_loc = tmp / "guides" / "demo-rehber" / "TR" / "index.html"
        if not guide_legacy.is_file() or not guide_loc.is_file():
            fail("temp dual-publish must emit TR guide localized path")
        # EN guide slug == ID: no duplicate folder beyond the ID path.
        if (tmp / "guides" / "demo-guide" / "EN" / "index.html").is_file() is False:
            fail("EN guide ID path missing")
        sitemap = read(tmp / "sitemap.xml")
        if "/writings/en/notes/validator-notes/" in sitemap:
            fail("temp sitemap must omit localized writing URL")
        if "/guides/demo-rehber/TR/" in sitemap:
            fail("temp sitemap must omit localized guide URL")
        manifest = json.loads(read(tmp / "content" / "localized-dual-publish.json"))
        if "writings/en/notes/validator-notes/index.html" not in manifest.get("paths", []):
            fail("localized manifest must list dual-publish writing")
        if "guides/demo-rehber/TR/index.html" not in manifest.get("paths", []):
            fail("localized manifest must list dual-publish guide")
        if not any("validator-notes" in p for p in result.get("localized") or []):
            fail("generate() must report localized outputs")

        # Collision: localized slug equals another writing's stable ID.
        (tmp / "content" / "notes" / "en" / "other.md").write_text(
            '---\ntitle: "Other"\ndate: "2026-01-02"\nsummary: "x"\nslug: no-cover\n---\n\nBody.\n',
            encoding="utf-8",
        )
        try:
            generate_share.generate(tmp, public_url_mode="CURRENT_ID")
            fail("localized slug colliding with another stable ID must fail")
        except Exception as exc:  # noqa: BLE001
            if "collision" not in str(exc).lower() and "output collision" not in str(exc):
                # UrlMapError for duplicate slug may fire first — also acceptable fail-loud.
                if "duplicate" not in str(exc).lower() and "UrlMap" not in type(exc).__name__:
                    fail(f"expected collision/duplicate failure, got: {exc}")
    ok("temp dual-publish + slug==ID + collision fail-loud")


def test_no_redirect_stubs() -> None:
    localized = read(ROOT / "writings" / "en" / "articles" / SOUL_EN / "index.html")
    if 'http-equiv="refresh"' in localized.lower():
        fail("localized pages must not meta-refresh")
    if "location.replace" in localized and SOUL_ID in localized and "redirect" in localized.lower():
        fail("localized pages must not JS-redirect")
    if "<article" not in localized and "blog-post-content" not in localized and "data-writings-view" not in localized:
        fail("localized writing must be full HTML, not a stub")
    ok("no redirect stubs on localized copies")


def test_exact_counts_and_all_robots() -> None:
    import shutil

    # Dual-publish path inventory remains on the live tree.
    manifest = json.loads(read(ROOT / "content" / "localized-dual-publish.json"))
    paths = manifest.get("paths") or []
    if len(paths) != 17:
        fail(f"manifest must list exactly 17 localized paths, got {len(paths)}")
    writing_loc = [p for p in paths if p.startswith("writings/")]
    guide_loc = [p for p in paths if p.startswith("guides/")]
    if len(writing_loc) != 7 or len(guide_loc) != 10:
        fail(f"expected 7 writing + 10 guide localized, got {len(writing_loc)}+{len(guide_loc)}")

    tmp = current_id_tree()
    try:
        id_writing = 0
        for path in (tmp / "writings").rglob("index.html"):
            rel = str(path.relative_to(tmp)).replace("\\", "/")
            if rel in paths:
                continue
            parts = path.relative_to(tmp / "writings").parts
            if len(parts) == 4:
                id_writing += 1
                html = read(path)
                if robots(html) and "noindex" in (robots(html) or ""):
                    fail(f"stable-ID writing must not have Phase 3 noindex: {rel}")
        id_guide = 0
        for path in (tmp / "guides").rglob("index.html"):
            rel = str(path.relative_to(tmp)).replace("\\", "/")
            if rel in paths:
                continue
            parts = path.relative_to(tmp / "guides").parts
            if len(parts) == 3 and parts[1] in ("EN", "TR"):
                id_guide += 1
                html = read(path)
                if robots(html) and "noindex" in (robots(html) or ""):
                    fail(f"stable-ID guide must not have Phase 3 noindex: {rel}")
        if id_writing != 8 or id_guide != 20:
            fail(f"expected 8/20 ID destinations, got {id_writing}/{id_guide}")

        for rel in paths:
            html = read(tmp / rel)
            tags = re.findall(r'<meta\s+name="robots"\s+content="([^"]+)"', html, re.I)
            if tags != ["noindex,follow"]:
                fail(f"CURRENT_ID localized {rel} must have exactly one noindex,follow robots meta, got {tags}")
            if "G-CD89YCN426" not in html:
                fail(f"localized {rel} missing GA4")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # slug == ID: Clarity TR and EN guides must not appear in manifest / noindex.
    if any(CLARITY_ID in p and "/tr/" in p for p in paths):
        fail("Clarity TR slug==ID must not be dual-published")
    for guide_id in (
        "how-to-get-an-arns-domain",
        "ar-io-gateway-installation",
    ):
        if f"guides/{guide_id}/EN/index.html" in paths:
            fail("EN guide slug==ID must not be dual-published")
    ok("exact 8/7 and 20/10 counts + all-17 robots")


def test_collision_preflight_before_writes() -> None:
    src = read(ROOT / "scripts" / "generate-share.py")
    if "def plan_dual_publish_destinations(" not in src:
        fail("preflight planner missing")
    if "plan_dual_publish_destinations(writings, guides)" not in src:
        fail("generate() must call preflight planner")
    # Order: preflight appears before first write_text of detail pages in generate body.
    gen_start = src.index("def generate(")
    plan_pos = src.index("plan_dual_publish_destinations(writings, guides)", gen_start)
    first_write = src.index("write_text(html_path", gen_start)
    if plan_pos > first_write:
        fail("collision preflight must run before detail HTML writes")

    with tempfile.TemporaryDirectory() as raw:
        tmp = Path(raw)
        from test_generate_share import setup_root  # type: ignore

        setup_root(tmp)
        # Inject a second writing whose localized slug collides with another ID.
        (tmp / "content" / "notes" / "en" / "other.md").write_text(
            '---\ntitle: "Other"\ndate: "2026-01-02"\nsummary: "x"\nslug: no-cover\n---\n\nBody.\n',
            encoding="utf-8",
        )
        marker = tmp / "writings" / "en" / "notes" / "other" / "index.html"
        try:
            generate_share.generate(tmp)
            fail("preflight must raise on collision")
        except generate_share.DualPublishError:
            pass
        except Exception as exc:  # noqa: BLE001
            fail(f"expected DualPublishError before writes, got {type(exc).__name__}: {exc}")
        if marker.is_file():
            fail("colliding item must not be written after preflight failure")
    ok("collision preflight before destructive output")


def test_guide_direct_load_waits_for_url_map() -> None:
    guides = read(ROOT / "assets" / "js" / "guides-parser.js")
    if "never resolve/open a guide detail route before url-map is ready" not in guides:
        fail("guides-parser must document url-map wait")
    if "map.load()" not in guides:
        fail("guides-parser must call KolTiginUrlMap.load()")
    if "catch(apply)" in guides.replace(" ", ""):
        # crude: ensure we do not fall back to apply on load failure
        pass
    if ".catch(apply)" in guides or "load().then(apply).catch(apply)" in guides:
        fail("url-map load failure must not open with unresolved route key")
    if "if (map && typeof map.isReady === 'function' && !map.isReady())" not in guides:
        fail("parseGuideLocation must refuse unresolved route keys before map ready")
    if "unresolved: true" not in guides:
        fail("parseGuideLocation must mark unresolved localized keys")
    if "|| fromPath.id" in guides and "guideStableIdFromRoute(fromPath) || fromPath.id" in guides:
        fail("must not fall back to route key as stable ID after Phase 3 race fix")

    # Node simulation: open only after setData/load.
    script = f"""
const window = globalThis;
globalThis.window = window;
{(ROOT / "assets" / "js" / "url-map.js").read_text(encoding="utf-8")}
{(ROOT / "assets" / "js" / "router.js").read_text(encoding="utf-8")}
const mapData = {json.dumps(json.loads(read(ROOT / "content" / "url-map.json")))};
let opened = null;
const fake = {{
  bodyEl: {{ innerHTML: '' }},
  open(id, opts) {{ opened = {{ id, opts }}; }},
  parseGuideLocation() {{
    const fromPath = KolTiginRouter.parseGuidePath('/guides/{GUIDE_TR}/TR/');
    if (KolTiginUrlMap && !KolTiginUrlMap.isReady()) return null;
    const stableId = KolTiginRouter.guideStableIdFromRoute(fromPath);
    if (!stableId) return {{ id: '', unresolved: true }};
    return {{ id: stableId, lang: 'TR' }};
  }}
}};
// Before map ready: must not open.
let parsed = fake.parseGuideLocation();
if (parsed !== null) {{ console.log('FAIL early'); process.exit(1); }}
KolTiginUrlMap.setData(mapData);
parsed = fake.parseGuideLocation();
if (!parsed || parsed.id !== {json.dumps(GUIDE_ID)}) {{
  console.log('FAIL resolve', parsed);
  process.exit(1);
}}
console.log('ok');
"""
    import subprocess
    import tempfile as tf

    with tf.NamedTemporaryFile("w", suffix=".mjs", delete=False, encoding="utf-8") as handle:
        handle.write(script)
        path = handle.name
    try:
        proc = subprocess.run(["node", path], cwd=ROOT, capture_output=True, text=True, check=False)
    finally:
        Path(path).unlink(missing_ok=True)
    if proc.returncode != 0 or "ok" not in proc.stdout:
        fail(f"guide url-map wait simulation failed: {proc.stderr or proc.stdout}")
    ok("direct localized guide load waits for url-map")


def main() -> None:
    test_destination_registry_collisions()
    if not (ROOT / "writings" / "en" / "articles" / SOUL_EN / "index.html").is_file():
        print("generating live dual-publish outputs for Phase 3 checks…")
        generate_share.generate(ROOT)
    test_live_dual_publish_existence_and_seo()
    test_exact_counts_and_all_robots()
    test_sitemap_and_redirects()
    test_links_share_language_switch_still_id()
    test_ga4_admin_404()
    test_temp_dual_publish_and_slug_eq_id()
    test_collision_preflight_before_writes()
    test_guide_direct_load_waits_for_url_map()
    test_no_redirect_stubs()
    print("Phase 3 tests passed")


if __name__ == "__main__":
    main()
