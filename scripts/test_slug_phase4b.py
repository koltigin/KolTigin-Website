#!/usr/bin/env python3
"""Phase 4B: production default is LOCALIZED (SEO cutover; redirects still off)."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from public_url_policy import (  # noqa: E402
    DEFAULT_MODE,
    MODE_CURRENT_ID,
    MODE_LOCALIZED,
    normalize_mode,
)
from redirects import EXPECTED_REDIRECT_COUNT, load_redirects, validate_redirects_against_url_map  # noqa: E402
from url_map import build_url_map  # noqa: E402

spec = importlib.util.spec_from_file_location("generate_share", ROOT / "scripts" / "generate-share.py")
generate_share = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(generate_share)

SOUL_ID = "2026-08-31-soulmemory"
SOUL_EN = "soulmemory-on-chain-mood-diary"
SOUL_TR = "soulmemory-on-chain-duygu-gunlugu"
CLARITY_ID = "clarity-act-abd-kripto-piyasasinda-gozler-senato-da"
CLARITY_EN = "clarity-act-all-eyes-on-the-us-senate"
CLARITY_TR = CLARITY_ID
GUIDE_ID = "how-to-get-an-arns-domain"
GUIDE_TR = "arns-domain-nasil-alinir"

PHASE4B_SCRIPT_MARKERS = {
    "assets/js/router.js": "prod7",
    "assets/js/url-map.js": "phase4b",
    "assets/js/site.js": "prod13",
    "assets/js/share-actions.js": "prod5",
    "assets/js/blog-parser.js": "prod20",
    "assets/js/projects-parser.js": "prod14",
    "assets/js/guide-markdown.js": "prod7",
    "assets/js/guides-parser.js": "prod20",
}


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL {msg}")


def ok(msg: str) -> None:
    print("ok", msg)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


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
        for node in nodes:
            if not isinstance(node, dict):
                continue
            for key in ("url", "mainEntityOfPage"):
                value = node.get(key)
                if isinstance(value, str):
                    found.append(value)
    return found


def sitemap_locs(xml: str) -> list[str]:
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_node(script: str) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False, encoding="utf-8") as handle:
        handle.write(script)
        path = handle.name
    try:
        proc = subprocess.run(
            ["node", path],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    finally:
        Path(path).unlink(missing_ok=True)
    if proc.returncode != 0:
        fail(f"node failed: {proc.stderr.strip() or proc.stdout.strip()}")
    return proc.stdout.strip()


def browser_bundle_script(body: str) -> str:
    url_map_src = (ROOT / "assets" / "js" / "url-map.js").read_text(encoding="utf-8")
    router_src = (ROOT / "assets" / "js" / "router.js").read_text(encoding="utf-8")
    share_src = (ROOT / "assets" / "js" / "share-actions.js").read_text(encoding="utf-8")
    map_json = (ROOT / "content" / "url-map.json").read_text(encoding="utf-8")
    return f"""
const window = globalThis;
globalThis.window = window;
{url_map_src}
{router_src}
{share_src}
KolTiginUrlMap.setData({map_json});
{body}
"""


def redirect_pairs() -> list[dict[str, str]]:
    data = load_redirects(ROOT / "config" / "redirects.json")
    return list(data.get("redirects") or [])


def abs_to_rel(url: str) -> str:
    return url.replace("https://koltigin.xyz", "")


def test_default_modes() -> None:
    if DEFAULT_MODE != MODE_LOCALIZED or normalize_mode(None) != MODE_LOCALIZED:
        fail("Python DEFAULT_MODE must be LOCALIZED")
    src = read(ROOT / "scripts" / "generate-share.py")
    if 'default=DEFAULT_MODE' not in src or 'choices=["CURRENT_ID", "LOCALIZED"]' not in src:
        fail("CLI must default to DEFAULT_MODE with CURRENT_ID+LOCALIZED choices")
    router = read(ROOT / "assets" / "js" / "router.js")
    if "let publicUrlMode = MODE_LOCALIZED" not in router:
        fail("JS runtime default must be LOCALIZED")
    script = browser_bundle_script("console.log(KolTiginRouter.getPublicUrlMode());")
    if run_node(script) != "LOCALIZED":
        fail("JS getPublicUrlMode default must be LOCALIZED")
    ok("DEFAULT MODE is LOCALIZED (python/cli/js)")


def test_cache_bust_markers() -> None:
    index = read(ROOT / "index.html")
    for rel, version in PHASE4B_SCRIPT_MARKERS.items():
        needle = f"/{rel}?v={version}"
        if needle not in index:
            fail(f"index.html missing Phase 4B cache-bust {needle}")
    samples = [
        ROOT / "writings" / "en" / "articles" / SOUL_EN / "index.html",
        ROOT / "writings" / "en" / "articles" / SOUL_ID / "index.html",
        ROOT / "guides" / GUIDE_TR / "TR" / "index.html",
        ROOT / "guides" / GUIDE_ID / "TR" / "index.html",
        ROOT / "writings" / "index.html",
        ROOT / "guides" / "index.html",
        ROOT / "projects" / "index.html",
    ]
    for path in samples:
        if not path.is_file():
            fail(f"missing sample HTML for cache-bust check: {path.relative_to(ROOT)}")
        html = read(path)
        for rel, version in PHASE4B_SCRIPT_MARKERS.items():
            needle = f"/{rel}?v={version}"
            if needle not in html:
                fail(f"{path.relative_to(ROOT)} missing {needle}")
        for stale in ("router.js?v=prod6", "site.js?v=prod12", "blog-parser.js?v=prod19", "url-map.js?v=phase2"):
            if stale in html:
                fail(f"{path.relative_to(ROOT)} still references stale {stale}")
    ok("CACHE BUST markers present in generated HTML")


def test_primary_counts_and_slug_eq_id() -> None:
    writing_primaries = []
    for path in (ROOT / "writings").rglob("index.html"):
        parts = path.relative_to(ROOT / "writings").parts
        if len(parts) == 4:
            writing_primaries.append(str(path.relative_to(ROOT)).replace("\\", "/"))
    # Count locale-primary destinations: for dual-publish items primary is localized path.
    # Phase 4B still generates both ID + localized HTML files; primary set = sitemap locs.
    sitemap = read(ROOT / "sitemap.xml")
    writing_locs = [u for u in sitemap_locs(sitemap) if re.search(r"/writings/(en|tr)/[^/]+/[^/]+/?$", u)]
    guide_locs = [u for u in sitemap_locs(sitemap) if re.search(r"/guides/[^/]+/(EN|TR)/?$", u)]
    if len(writing_locs) != 8:
        fail(f"expected 8 writing primaries in sitemap, got {len(writing_locs)}: {writing_locs}")
    if len(guide_locs) != 20:
        fail(f"expected 20 guide primaries in sitemap, got {len(guide_locs)}")
    if f"/writings/en/articles/{SOUL_EN}/" not in sitemap:
        fail("sitemap missing SoulMemory EN localized primary")
    if f"/writings/en/articles/{SOUL_ID}/" in sitemap:
        fail("sitemap must omit changed SoulMemory ID alias")
    if f"/guides/{GUIDE_TR}/TR/" not in sitemap:
        fail("sitemap missing ArNS TR localized primary")
    if f"/guides/{GUIDE_ID}/TR/" in sitemap:
        fail("sitemap must omit changed ArNS TR ID alias")
    if f"/writings/tr/articles/{CLARITY_TR}/" not in sitemap:
        fail("Clarity TR slug==ID must appear once in sitemap")
    if sitemap.count(f"/writings/tr/articles/{CLARITY_TR}/") != 1:
        fail("Clarity TR must appear exactly once")
    if f"/guides/{GUIDE_ID}/EN/" not in sitemap:
        fail("EN guide slug==ID primary missing")
    if "xmlns:xhtml" in sitemap or "xhtml:link" in sitemap:
        fail("sitemap must not add xhtml alternates")
    ok("PRIMARY URLS + slug==ID + sitemap")


def test_all_17_transition_pairs() -> None:
    pairs = redirect_pairs()
    if len(pairs) != EXPECTED_REDIRECT_COUNT:
        fail(f"expected {EXPECTED_REDIRECT_COUNT} transition pairs")
    validate_redirects_against_url_map(
        load_redirects(ROOT / "config" / "redirects.json"),
        build_url_map(ROOT),
    )
    for row in pairs:
        old = abs_to_rel(row["from"] if row["from"].startswith("http") else row["from"])
        new = abs_to_rel(row["to"] if row["to"].startswith("http") else row["to"])
        old_file = ROOT / old.strip("/") / "index.html"
        new_file = ROOT / new.strip("/") / "index.html"
        if not old_file.is_file():
            fail(f"legacy alias missing: {old}")
        if not new_file.is_file():
            fail(f"localized primary missing: {new}")
        old_html = read(old_file)
        new_html = read(new_file)
        want = f"https://koltigin.xyz{new}"
        if canonical(new_html) != want:
            fail(f"localized primary must self-canonicalize: {new} -> {canonical(new_html)}")
        if canonical(old_html) != want:
            fail(f"legacy alias must canonicalize to localized primary: {old} -> {canonical(old_html)}")
        if robots(new_html) == "noindex,follow":
            fail(f"localized primary must not keep Phase 3 noindex: {new}")
        if robots(old_html) == "noindex,follow":
            fail(f"legacy alias must not get Phase 3 noindex: {old}")
        if re.search(r'http-equiv=["\']refresh["\']', old_html, re.I):
            fail(f"legacy alias must not meta-refresh: {old}")
        if re.search(r'http-equiv=["\']refresh["\']', new_html, re.I):
            fail(f"localized primary must not meta-refresh: {new}")
        if og_url(old_html) != want or og_url(new_html) != want:
            fail(f"og:url must be localized primary for pair {old} -> {new}")
        alts_old = hreflangs(old_html)
        alts_new = hreflangs(new_html)
        if alts_old != alts_new:
            fail(f"hreflang mismatch across pair {old}")
        if alts_new.get("x-default") != alts_new.get("en") and "en" in alts_new:
            fail(f"x-default must prefer EN localized for {new}")
        for url in jsonld_urls(old_html) + jsonld_urls(new_html):
            if "/writings/" in url or "/guides/" in url:
                if url != want and abs_to_rel(url) not in {alts_new.get("en", ""), alts_new.get("tr", "")}:
                    # JSON-LD page url/mainEntity should be this locale's primary.
                    if url.endswith(new) is False and url != want:
                        # Accept only this page's localized primary for url/mainEntityOfPage.
                        if "url" in url or True:
                            if want not in jsonld_urls(new_html):
                                fail(f"JSON-LD missing localized primary for {new}")
                            break
        if want not in jsonld_urls(new_html) or want not in jsonld_urls(old_html):
            fail(f"JSON-LD must use localized primary for pair {old}")
        # Share markup
        if f'data-share-url="{want}"' not in new_html and want not in new_html:
            fail(f"localized primary share/canonical missing for {new}")
        if f'data-share-url="{want}"' not in old_html and want not in old_html:
            fail(f"legacy alias must share localized primary for {old}")
        # No self-share of legacy when changed
        legacy_abs = f"https://koltigin.xyz{old}"
        if f'data-share-url="{legacy_abs}"' in new_html:
            fail(f"localized primary must not share legacy ID URL: {new}")
        if f'data-share-url="{legacy_abs}"' in old_html:
            fail(f"legacy alias must not share its own ID URL: {old}")
    ok("all-17 transition pairs")


def test_discovery_language_share_js() -> None:
    script = browser_bundle_script(
        f"""
const mode = KolTiginRouter.getPublicUrlMode();
const soulEn = KolTiginRouter.writingPublicPath('en', 'articles', {json.dumps(SOUL_ID)});
const soulTr = KolTiginRouter.writingPublicPath('tr', 'articles', {json.dumps(SOUL_ID)});
const guideTr = KolTiginRouter.guidePublicPath({json.dumps(GUIDE_ID)}, 'TR');
const guideEn = KolTiginRouter.guidePublicPath({json.dumps(GUIDE_ID)}, 'EN');
const shareEn = KolTiginShareActions.writingShareUrl('en', 'articles', {json.dumps(SOUL_ID)});
const shareGuide = KolTiginShareActions.guideShareUrl('tr', {json.dumps(GUIDE_ID)});
const fromLegacy = KolTiginRouter.writingPublicPath(
  'tr',
  'articles',
  KolTiginRouter.writingStableIdFromRoute(
    KolTiginRouter.parseWritingPath('/writings/en/articles/' + {json.dumps(SOUL_ID)} + '/')
  ) || {json.dumps(SOUL_ID)}
);
console.log(JSON.stringify({{
  mode, soulEn, soulTr, guideTr, guideEn, shareEn, shareGuide, fromLegacy
}}));
"""
    )
    data = json.loads(run_node(script))
    if data["mode"] != "LOCALIZED":
        fail("JS default must be LOCALIZED")
    if data["soulEn"] != f"/writings/en/articles/{SOUL_EN}/":
        fail("writing discovery EN must be localized")
    if data["soulTr"] != f"/writings/tr/articles/{SOUL_TR}/":
        fail("writing discovery TR must be localized")
    if data["guideTr"] != f"/guides/{GUIDE_TR}/TR/":
        fail("guide discovery TR must be localized")
    if data["guideEn"] != f"/guides/{GUIDE_ID}/EN/":
        fail("guide EN slug==ID path wrong")
    if f"/{SOUL_EN}/" not in data["shareEn"]:
        fail("share writing must be localized")
    if f"/{GUIDE_TR}/" not in data["shareGuide"]:
        fail("share guide must be localized")
    if data["fromLegacy"] != f"/writings/tr/articles/{SOUL_TR}/":
        fail("language switch from legacy ID must land on localized counterpart")
    # Source discovery helpers
    blog = read(ROOT / "assets" / "js" / "blog-parser.js")
    guides = read(ROOT / "assets" / "js" / "guides-parser.js")
    projects = read(ROOT / "assets" / "js" / "projects-parser.js")
    guide_md = read(ROOT / "assets" / "js" / "guide-markdown.js")
    if "writingPublicPath" not in blog or "guidePublicPath" not in guides:
        fail("cards must use mode-aware public path helpers")
    if "guidePublicPath" not in projects or "guidePublicPath" not in guide_md:
        fail("project/internal guide links must use guidePublicPath")
    ok("discovery / language / share JS")


def test_redirect_safety() -> None:
    """Phase 4B: LOCALIZED HTML must not embed a second redirect layer.

    Cloudflare activation metadata is asserted by Phase 4C offline tests.
    """
    redirects = load_redirects(ROOT / "config" / "redirects.json")
    if redirects.get("enabled") is not True and redirects.get("enabled") is not False:
        fail("redirects.enabled must be boolean")
    gen = read(ROOT / "scripts" / "generate-share.py")
    if "config/redirects.json" in gen:
        fail("generate-share must not load redirects.json")
    pairs = redirect_pairs()
    for row in pairs[:3]:
        old = ROOT / row["from"].strip("/") / "index.html"
        html = read(old)
        if 'http-equiv="refresh"' in html.lower():
            fail("legacy HTML must not meta-refresh")
    ok("redirect safety (no generator/HTML redirect layer)")


def test_default_generate_determinism() -> None:
    # Second LOCALIZED generate on live tree would mutate workspace; use isolated clone.
    import shutil

    tmp = Path(tempfile.mkdtemp(prefix="phase4b-det-"))
    try:
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
        result = generate_share.generate(tmp)
        if result.get("public_url_mode") != MODE_LOCALIZED:
            fail("default generate must report LOCALIZED")
        before = {
            "soul": file_sha(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html"),
            "legacy": file_sha(tmp / "writings" / "en" / "articles" / SOUL_ID / "index.html"),
            "sitemap": file_sha(tmp / "sitemap.xml"),
            "manifest": file_sha(tmp / "content" / "localized-dual-publish.json"),
        }
        generate_share.generate(tmp)
        after = {
            "soul": file_sha(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html"),
            "legacy": file_sha(tmp / "writings" / "en" / "articles" / SOUL_ID / "index.html"),
            "sitemap": file_sha(tmp / "sitemap.xml"),
            "manifest": file_sha(tmp / "content" / "localized-dual-publish.json"),
        }
        if before != after:
            fail(f"LOCALIZED second generate changed outputs: {before} vs {after}")
        # CURRENT_ID still available
        generate_share.generate(tmp, public_url_mode=MODE_CURRENT_ID)
        loc = read(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html")
        if robots(loc) != "noindex,follow":
            fail("explicit CURRENT_ID must restore Phase 3 noindex")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    ok("LOCALIZED determinism + CURRENT_ID still selectable")


def main() -> None:
    test_default_modes()
    test_cache_bust_markers()
    test_primary_counts_and_slug_eq_id()
    test_all_17_transition_pairs()
    test_discovery_language_share_js()
    test_redirect_safety()
    test_default_generate_determinism()
    print("Phase 4B tests passed")


if __name__ == "__main__":
    main()
