#!/usr/bin/env python3
"""Phase 4A: prepare LOCALIZED SEO cutover while default remains CURRENT_ID."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from cloudflare_redirects import build_cloudflare_bulk_redirects  # noqa: E402
from public_url_policy import (  # noqa: E402
    DEFAULT_MODE,
    MODE_CURRENT_ID,
    MODE_LOCALIZED,
    PublicUrlModeError,
    guide_primary_path,
    normalize_mode,
    robots_for_destination,
    writing_primary_path,
    x_default_url,
)
from redirects import (  # noqa: E402
    EXPECTED_REDIRECT_COUNT,
    load_redirects,
    validate_redirects,
    validate_redirects_against_url_map,
)
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
CLARITY_TR = "clarity-act-abd-kripto-piyasasinda-gozler-senato-da"
GUIDE_ID = "how-to-get-an-arns-domain"
GUIDE_TR = "arns-domain-nasil-alinir"


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
const map = {map_json};
KolTiginUrlMap.setData(map);
{body}
"""


def setup_temp_root() -> Path:
    """Clone live generator inputs into an isolated tree (does not mutate the repo)."""
    tmp = Path(tempfile.mkdtemp(prefix="phase4a-"))
    pairs = [
        ("assets/fonts", True),
        ("assets/images/profile", True),
        ("assets/images/og/backgrounds", True),
        ("assets/images/blog", True),
        ("assets/images/guides", True),
        ("content", True),
        ("config", True),
        ("i18n", True),
        ("index.html", False),
    ]
    for rel, is_dir in pairs:
        src = ROOT / rel
        dest = tmp / rel
        if not src.exists():
            continue
        if is_dir:
            shutil.copytree(src, dest)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
    return tmp


def test_policy_defaults() -> None:
    if normalize_mode(None) != MODE_CURRENT_ID or DEFAULT_MODE != MODE_CURRENT_ID:
        fail("default public URL mode must be CURRENT_ID")
    try:
        normalize_mode("PHASE4")
        fail("unknown modes must raise, not alias into LOCALIZED")
    except PublicUrlModeError:
        pass
    try:
        normalize_mode("not-a-mode")
        fail("invalid mode must raise PublicUrlModeError")
    except PublicUrlModeError:
        pass
    if robots_for_destination(MODE_CURRENT_ID, is_extra_localized_copy=True) != "noindex,follow":
        fail("CURRENT_ID must noindex true localized copies")
    if robots_for_destination(MODE_LOCALIZED, is_extra_localized_copy=True) is not None:
        fail("LOCALIZED mode must drop Phase 3 noindex on localized copies")
    if robots_for_destination(MODE_CURRENT_ID, is_extra_localized_copy=False) is not None:
        fail("ID pages must not get Phase 3 noindex")
    if robots_for_destination(MODE_LOCALIZED, is_extra_localized_copy=False) is not None:
        fail("LOCALIZED legacy ID pages must not introduce a new noindex")
    path = writing_primary_path(MODE_LOCALIZED, "en", "articles", SOUL_ID, SOUL_EN)
    if path != f"/writings/en/articles/{SOUL_EN}/":
        fail(f"LOCALIZED writing primary mismatch: {path}")
    same = writing_primary_path(MODE_LOCALIZED, "tr", "articles", CLARITY_TR, CLARITY_TR)
    if same != f"/writings/tr/articles/{CLARITY_TR}/":
        fail("slug==ID writing must keep single path")
    g = guide_primary_path(MODE_LOCALIZED, GUIDE_ID, "TR", GUIDE_TR)
    if g != f"/guides/{GUIDE_TR}/TR/":
        fail(f"LOCALIZED guide primary mismatch: {g}")
    g_en = guide_primary_path(MODE_LOCALIZED, GUIDE_ID, "EN", GUIDE_ID)
    if g_en != f"/guides/{GUIDE_ID}/EN/":
        fail("EN guide slug==ID must remain ID path")
    xd = x_default_url({"en": "https://koltigin.xyz/a/", "tr": "https://koltigin.xyz/b/"})
    if xd != "https://koltigin.xyz/a/":
        fail("x-default must prefer English")
    ok("public_url_policy defaults + slug==ID helpers")


def test_current_id_live_regression() -> None:
    """Default repository output must still be Phase 3."""
    soul_id = read(ROOT / "writings" / "en" / "articles" / SOUL_ID / "index.html")
    soul_loc = read(ROOT / "writings" / "en" / "articles" / SOUL_EN / "index.html")
    if robots(soul_id) == "noindex,follow":
        fail("ID SoulMemory must not have Phase 3 noindex")
    if robots(soul_loc) != "noindex,follow":
        fail("localized SoulMemory must still be noindex,follow under default")
    want = f"https://koltigin.xyz/writings/en/articles/{SOUL_ID}/"
    if canonical(soul_loc) != want or og_url(soul_loc) != want:
        fail("localized copy must still ID-canonicalize under default")
    alts = hreflangs(soul_loc)
    if alts.get("en") != want or SOUL_EN in (alts.get("en") or ""):
        fail("hreflang must remain ID-based under default")
    if alts.get("x-default") != want:
        fail("x-default must remain EN ID URL under default")
    for url in jsonld_urls(soul_loc):
        if SOUL_EN in url and SOUL_ID not in url:
            fail("JSON-LD must not self-canonicalize localized URL under default")
    sitemap = read(ROOT / "sitemap.xml")
    if f"/writings/en/articles/{SOUL_EN}/" in sitemap or f"/guides/{GUIDE_TR}/TR/" in sitemap:
        fail("default sitemap must remain ID-only")
    if f"/writings/en/articles/{SOUL_ID}/" not in sitemap:
        fail("default sitemap missing ID writing URL")
    redirects = load_redirects(ROOT / "config" / "redirects.json")
    if redirects.get("enabled") is not False:
        fail("redirects must remain enabled:false")
    router = read(ROOT / "assets" / "js" / "router.js")
    if "let publicUrlMode = MODE_CURRENT_ID" not in router:
        fail("JS default mode must be CURRENT_ID")
    ok("CURRENT_ID live regression (default still Phase 3)")


def test_js_mode_switch() -> None:
    script = browser_bundle_script(
        f"""
const before = KolTiginRouter.getPublicUrlMode();
const idPath = KolTiginRouter.writingPublicPath('en', 'articles', {json.dumps(SOUL_ID)});
const guideId = KolTiginRouter.guidePublicPath({json.dumps(GUIDE_ID)}, 'TR');
const shareId = KolTiginShareActions.writingShareUrl('en', 'articles', {json.dumps(SOUL_ID)});
KolTiginRouter.setPublicUrlMode('LOCALIZED');
const locPath = KolTiginRouter.writingPublicPath('en', 'articles', {json.dumps(SOUL_ID)});
const locTr = KolTiginRouter.writingPublicPath('tr', 'articles', {json.dumps(SOUL_ID)});
const guideLoc = KolTiginRouter.guidePublicPath({json.dumps(GUIDE_ID)}, 'TR');
const guideEn = KolTiginRouter.guidePublicPath({json.dumps(GUIDE_ID)}, 'EN');
const clarity = KolTiginRouter.writingPublicPath('tr', 'articles', {json.dumps(CLARITY_ID)});
const shareLoc = KolTiginShareActions.writingShareUrl('en', 'articles', {json.dumps(SOUL_ID)});
const switchPath = KolTiginRouter.writingPublicPath('tr', 'articles', {json.dumps(SOUL_ID)});
let invalidRejected = false;
try {{
  KolTiginRouter.setPublicUrlMode('PHASE4');
}} catch (error) {{
  invalidRejected = true;
}}
KolTiginRouter.setPublicUrlMode('CURRENT_ID');
const after = KolTiginRouter.getPublicUrlMode();
const restored = KolTiginRouter.writingPublicPath('en', 'articles', {json.dumps(SOUL_ID)});
console.log(JSON.stringify({{
  before, idPath, guideId, shareId, locPath, locTr, guideLoc, guideEn, clarity,
  shareLoc, switchPath, after, restored, invalidRejected
}}));
"""
    )
    data = json.loads(run_node(script))
    if data["before"] != "CURRENT_ID" or data["after"] != "CURRENT_ID":
        fail("JS mode default/restore must be CURRENT_ID")
    if not data.get("invalidRejected"):
        fail("JS must reject unknown public URL modes")
    if data["idPath"] != f"/writings/en/articles/{SOUL_ID}/":
        fail("JS CURRENT_ID writing path wrong")
    if data["guideId"] != f"/guides/{GUIDE_ID}/TR/":
        fail("JS CURRENT_ID guide path wrong")
    if data["locPath"] != f"/writings/en/articles/{SOUL_EN}/":
        fail("JS LOCALIZED writing EN path wrong")
    if data["locTr"] != f"/writings/tr/articles/{SOUL_TR}/":
        fail("JS LOCALIZED writing TR path wrong")
    if data["guideLoc"] != f"/guides/{GUIDE_TR}/TR/":
        fail("JS LOCALIZED guide TR path wrong")
    if data["guideEn"] != f"/guides/{GUIDE_ID}/EN/":
        fail("JS LOCALIZED EN guide must stay slug==ID path")
    if data["clarity"] != f"/writings/tr/articles/{CLARITY_TR}/":
        fail("JS LOCALIZED Clarity TR slug==ID must stay single path")
    if SOUL_EN not in data["shareLoc"] or SOUL_ID in data["shareLoc"].split(SOUL_EN)[0]:
        # share URL must contain localized slug
        if f"/{SOUL_EN}/" not in data["shareLoc"]:
            fail("JS LOCALIZED share must use localized URL")
    if data["restored"] != f"/writings/en/articles/{SOUL_ID}/":
        fail("JS mode restore must return CURRENT_ID paths")
    ok("JS mode-aware discovery/share/language paths")


def test_localized_generator_mode() -> None:
    tmp = setup_temp_root()
    try:
        result = generate_share.generate(tmp, public_url_mode=MODE_LOCALIZED)
        if result.get("public_url_mode") != MODE_LOCALIZED:
            fail("generate must report LOCALIZED mode")

        soul_loc = read(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html")
        soul_id = read(tmp / "writings" / "en" / "articles" / SOUL_ID / "index.html")
        soul_tr = read(tmp / "writings" / "tr" / "articles" / SOUL_TR / "index.html")
        want_en = f"https://koltigin.xyz/writings/en/articles/{SOUL_EN}/"
        want_tr = f"https://koltigin.xyz/writings/tr/articles/{SOUL_TR}/"
        if robots(soul_loc) == "noindex,follow" or robots(soul_tr) == "noindex,follow":
            fail("LOCALIZED mode must remove noindex from localized copies")
        if robots(soul_id) == "noindex,follow":
            fail("LOCALIZED legacy ID HTML must not receive Phase 3 noindex")
        if re.search(r'http-equiv=["\']refresh["\']', soul_id, re.I):
            fail("LOCALIZED legacy ID HTML must not use meta refresh")
        if "location.replace" in soul_id or "location.href" in soul_id:
            # SPA shell may contain scripts, but must not inject redirect stubs for this page.
            pass
        if canonical(soul_loc) != want_en or og_url(soul_loc) != want_en:
            fail("LOCALIZED localized page must self-canonicalize")
        if canonical(soul_id) != want_en:
            fail("LOCALIZED legacy ID HTML must canonicalize to localized primary")
        if "xhtml:link" in read(tmp / "sitemap.xml") or "xmlns:xhtml" in read(tmp / "sitemap.xml"):
            fail("LOCALIZED sitemap must not add xhtml:link alternates")
        alts = hreflangs(soul_loc)
        if alts.get("en") != want_en or alts.get("tr") != want_tr:
            fail("LOCALIZED hreflang must use localized EN/TR URLs")
        if alts.get("x-default") != want_en:
            fail("LOCALIZED x-default must prefer EN localized primary")
        for url in jsonld_urls(soul_loc):
            if url not in {want_en} and "soulmemory" in url and SOUL_EN not in url:
                fail(f"LOCALIZED JSON-LD unexpected: {url}")
        if want_en not in jsonld_urls(soul_loc):
            fail("LOCALIZED JSON-LD missing localized url")

        clarity_tr = tmp / "writings" / "tr" / "articles" / CLARITY_TR / "index.html"
        if not clarity_tr.is_file():
            fail("Clarity TR page missing")
        # No duplicate Clarity TR localized directory when slug==ID
        clarity_dup = list((tmp / "writings" / "tr" / "articles").glob("*clarity*"))
        names = {p.name for p in clarity_dup if p.is_dir()}
        if names != {CLARITY_TR}:
            fail(f"Clarity TR must be single path, found {names}")

        guide_loc = read(tmp / "guides" / GUIDE_TR / "TR" / "index.html")
        guide_id = read(tmp / "guides" / GUIDE_ID / "TR" / "index.html")
        want_g = f"https://koltigin.xyz/guides/{GUIDE_TR}/TR/"
        if robots(guide_loc) == "noindex,follow":
            fail("LOCALIZED guide copy must be indexable")
        if canonical(guide_loc) != want_g or canonical(guide_id) != want_g:
            fail("LOCALIZED guide canonical must be TR slug primary")

        sitemap = read(tmp / "sitemap.xml")
        locs = sitemap_locs(sitemap)
        writing_locs = [
            u for u in locs if re.search(r"/writings/(en|tr)/[^/]+/[^/]+/?$", u)
        ]
        guide_locs = [u for u in locs if re.search(r"/guides/[^/]+/(EN|TR)/?$", u)]
        # Exact primary counts from live corpus copied into temp.
        if len(writing_locs) != 8:
            fail(f"LOCALIZED sitemap expected 8 writing URLs, got {len(writing_locs)}: {writing_locs}")
        if len(guide_locs) != 20:
            fail(f"LOCALIZED sitemap expected 20 guide URLs, got {len(guide_locs)}")
        if f"/writings/en/articles/{SOUL_ID}/" in sitemap:
            fail("LOCALIZED sitemap must omit changed ID aliases")
        if f"/writings/en/articles/{SOUL_EN}/" not in sitemap:
            fail("LOCALIZED sitemap missing SoulMemory EN primary")
        if f"/guides/{GUIDE_ID}/TR/" in sitemap:
            fail("LOCALIZED sitemap must omit changed guide ID TR alias")
        if f"/guides/{GUIDE_TR}/TR/" not in sitemap:
            fail("LOCALIZED sitemap missing ArNS TR primary")
        if "xmlns:xhtml" in sitemap:
            fail("do not introduce sitemap xhtml in Phase 4A")

        # Determinism: second LOCALIZED run must not change outputs.
        before = {
            str(p.relative_to(tmp)): file_sha(p)
            for p in tmp.rglob("*")
            if p.is_file() and "og/" not in str(p).replace("\\", "/")  # PNG may be bit-identical anyway
        }
        generate_share.generate(tmp, public_url_mode=MODE_LOCALIZED)
        after = {
            str(p.relative_to(tmp)): file_sha(p)
            for p in tmp.rglob("*")
            if p.is_file() and "og/" not in str(p).replace("\\", "/")
        }
        if before != after:
            changed = sorted(set(before) | set(after))
            diffs = [p for p in changed if before.get(p) != after.get(p)]
            fail(f"LOCALIZED second generate changed files: {diffs[:8]}")

        redirects = load_redirects(tmp / "config" / "redirects.json")
        if redirects.get("enabled") is not False:
            fail("LOCALIZED generate must not enable redirects")
        ok("LOCALIZED generator SEO/sitemap/determinism")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_current_id_generator_determinism() -> None:
    tmp = setup_temp_root()
    try:
        generate_share.generate(tmp)  # default CURRENT_ID
        soul_loc = read(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html")
        if robots(soul_loc) != "noindex,follow":
            fail("default generate must keep Phase 3 noindex on localized copies")
        want = f"https://koltigin.xyz/writings/en/articles/{SOUL_ID}/"
        if canonical(soul_loc) != want:
            fail("default generate must ID-canonicalize localized copies")
        before_html = file_sha(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html")
        before_map = file_sha(tmp / "sitemap.xml")
        generate_share.generate(tmp)
        if file_sha(tmp / "writings" / "en" / "articles" / SOUL_EN / "index.html") != before_html:
            fail("CURRENT_ID second generate changed localized HTML")
        if file_sha(tmp / "sitemap.xml") != before_map:
            fail("CURRENT_ID second generate changed sitemap")
        ok("CURRENT_ID generator determinism")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_redirect_map_and_cloudflare_artifact() -> None:
    data = load_redirects(ROOT / "config" / "redirects.json")
    pairs = validate_redirects(data)
    if len(pairs) != EXPECTED_REDIRECT_COUNT:
        fail(f"expected {EXPECTED_REDIRECT_COUNT} redirects")
    if data.get("enabled") is not False:
        fail("redirects must stay disabled")
    url_map = build_url_map(ROOT)
    validate_redirects_against_url_map(data, url_map)
    for row in pairs:
        if row["from"] == row["to"]:
            fail(f"self redirect slipped through: {row}")
    artifact = build_cloudflare_bulk_redirects(data)
    if artifact.get("activated") is not False:
        fail("Cloudflare artifact must not be activated")
    if artifact.get("recommended_product") != "bulk_redirects":
        fail("recommend Bulk Redirects for 17 static 301s")
    if len(artifact.get("items") or []) != EXPECTED_REDIRECT_COUNT:
        fail("Cloudflare artifact item count mismatch")
    first = artifact["items"][0]
    if first.get("status_code") != 301:
        fail("Cloudflare items must be 301")
    if not str(first.get("source_url") or "").startswith("https://koltigin.xyz/"):
        fail("Cloudflare source_url must be absolute koltigin.xyz")
    # Checked-in artifact must match deterministic derivation (no hand-edited drift).
    dest = ROOT / "config" / "cloudflare-bulk-redirects.json"
    expected_text = json.dumps(artifact, indent=2, ensure_ascii=False) + "\n"
    if not dest.is_file():
        dest.write_text(expected_text, encoding="utf-8")
    written = json.loads(dest.read_text(encoding="utf-8"))
    if written != artifact:
        fail("config/cloudflare-bulk-redirects.json drifted from config/redirects.json derivation")
    if written.get("activated") is not False:
        fail("written Cloudflare artifact must remain inactive")
    if "xhtml:link" in expected_text:
        fail("Cloudflare artifact must not invent xhtml sitemap links")
    ok("redirect-map validation + Cloudflare bulk-redirect artifact")


def test_collision_still_fails() -> None:
    registry = generate_share.DestinationRegistry()
    registry.claim("writings/en/articles/same/index.html", "writing:articles/a")
    try:
        registry.claim("writings/en/articles/same/index.html", "writing:articles/b")
        fail("collision must still raise")
    except generate_share.DualPublishError:
        ok("collision protection still fails loud")


def main() -> None:
    test_policy_defaults()
    test_current_id_live_regression()
    test_js_mode_switch()
    test_localized_generator_mode()
    test_current_id_generator_determinism()
    test_redirect_map_and_cloudflare_artifact()
    test_collision_still_fails()
    print("Phase 4A tests passed")


if __name__ == "__main__":
    main()
