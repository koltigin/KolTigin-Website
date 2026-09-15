#!/usr/bin/env python3
"""Phase 2 dual-read / routing preparation tests. Live public URLs stay ID-based."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from url_map import build_url_map  # noqa: E402

SOUL_ID = "2026-08-31-soulmemory"
SOUL_EN = "soulmemory-on-chain-mood-diary"
SOUL_TR = "soulmemory-on-chain-duygu-gunlugu"
CLARITY_ID = "clarity-act-abd-kripto-piyasasinda-gozler-senato-da"
CLARITY_EN = "clarity-act-all-eyes-on-the-us-senate"
CLARITY_TR = "clarity-act-abd-kripto-piyasasinda-gozler-senato-da"
NOTE_ID = "2025-06-01-turkce-node-rehberi"
NOTE_EN = "three-rules-i-follow-when-writing-node-guides"
NOTE_TR = "node-rehberi-yazarken-dikkat-ettigim-uc-temel-kural"
GUIDE_ID = "how-to-get-an-arns-domain"
GUIDE_EN = "how-to-get-an-arns-domain"
GUIDE_TR = "arns-domain-nasil-alinir"


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL {msg}")


def ok(msg: str) -> None:
    print("ok", msg)


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
    """Load url-map.js + router.js in Node without a DOM window."""
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


def test_lookup_layer() -> None:
    script = browser_bundle_script(
        f"""
const soulId = KolTiginUrlMap.resolveWriting('articles', {json.dumps(SOUL_ID)}, 'en');
const soulEn = KolTiginUrlMap.resolveWriting('articles', {json.dumps(SOUL_EN)}, 'en');
const soulTr = KolTiginUrlMap.resolveWriting('articles', {json.dumps(SOUL_TR)}, 'tr');
const legacy = KolTiginUrlMap.resolveWriting('articles', {json.dumps(SOUL_EN)}, 'tr');
const unknown = KolTiginUrlMap.resolveWriting('articles', 'does-not-exist', 'en');
const guideId = KolTiginUrlMap.resolveGuide({json.dumps(GUIDE_ID)});
const guideEn = KolTiginUrlMap.resolveGuide({json.dumps(GUIDE_EN)});
const guideTr = KolTiginUrlMap.resolveGuide({json.dumps(GUIDE_TR)});
const guideUnknown = KolTiginUrlMap.resolveGuide('missing-guide');
const pairSoul = KolTiginUrlMap.writingCounterpartSlug('articles', {json.dumps(SOUL_EN)}, 'en', 'tr');
const pairClarity = KolTiginUrlMap.writingCounterpartSlug('articles', {json.dumps(CLARITY_EN)}, 'en', 'tr');
const pairNote = KolTiginUrlMap.writingCounterpartSlug('notes', {json.dumps(NOTE_EN)}, 'en', 'tr');
const pairGuide = KolTiginUrlMap.guideCounterpartSlug({json.dumps(GUIDE_EN)}, 'tr');
const backSoul = KolTiginUrlMap.writingCounterpartSlug('articles', {json.dumps(SOUL_TR)}, 'tr', 'en');
console.log(JSON.stringify({{
  soulId: soulId && soulId.id,
  soulEn: soulEn && soulEn.id,
  soulTr: soulTr && soulTr.id,
  legacy: legacy && legacy.id,
  unknown,
  guideId: guideId && guideId.id,
  guideEn: guideEn && guideEn.id,
  guideTr: guideTr && guideTr.id,
  guideUnknown,
  pairSoul,
  pairClarity,
  pairNote,
  pairGuide,
  backSoul,
  soulSlugs: soulEn && soulEn.slugs,
}}));
"""
    )
    data = json.loads(run_node(script))
    if data["soulId"] != SOUL_ID or data["soulEn"] != SOUL_ID or data["soulTr"] != SOUL_ID:
        fail(f"soulmemory lookup failed: {data}")
    if data["legacy"] != SOUL_ID:
        fail("legacy writing alias must resolve to stable ID")
    if data["unknown"] is not None:
        fail("unknown writing key must be null")
    if data["guideId"] != GUIDE_ID or data["guideEn"] != GUIDE_ID or data["guideTr"] != GUIDE_ID:
        fail(f"guide lookup failed: {data}")
    if data["guideUnknown"] is not None:
        fail("unknown guide key must be null")
    if data["pairSoul"] != SOUL_TR or data["backSoul"] != SOUL_EN:
        fail("soulmemory EN/TR pairing failed")
    if data["pairClarity"] != CLARITY_TR:
        fail("clarity pairing failed")
    if data["pairNote"] != NOTE_TR:
        fail("note pairing failed")
    if data["pairGuide"] != GUIDE_TR:
        fail("guide pairing failed")
    ok("url-map lookup + language pairing")


def test_path_helpers() -> None:
    script = browser_bundle_script(
        f"""
const idPath = KolTiginRouter.writingPublicPath('en', 'articles', {json.dumps(SOUL_ID)});
const legacyPath = KolTiginRouter.writingLegacyPublicPath('tr', 'articles', {json.dumps(SOUL_ID)});
const futurePath = KolTiginRouter.writingLocalizedPublicPath('en', 'articles', {json.dumps(SOUL_EN)});
const futureTr = KolTiginRouter.writingLocalizedPublicPath('tr', 'articles', {json.dumps(SOUL_TR)});
const guideIdPath = KolTiginRouter.guidePublicPath({json.dumps(GUIDE_ID)}, 'EN');
const guideLegacy = KolTiginRouter.guideLegacyPublicPath({json.dumps(GUIDE_ID)}, 'TR');
const guideFuture = KolTiginRouter.guideLocalizedPublicPath({json.dumps(GUIDE_TR)}, 'TR');
const parsed = KolTiginRouter.parseWritingPath('/writings/en/articles/' + {json.dumps(SOUL_EN)} + '/');
const resolved = KolTiginRouter.resolveWritingRoute(parsed);
const parsedGuide = KolTiginRouter.parseGuidePath('/guides/' + {json.dumps(GUIDE_TR)} + '/TR/');
const resolvedGuide = KolTiginRouter.resolveGuideRoute(parsedGuide);
const localizedSwitch = KolTiginRouter.writingLocalizedCounterpartPath(
  {{ lang: 'en', kind: 'articles', routeKey: {json.dumps(SOUL_EN)}, id: {json.dumps(SOUL_EN)} }},
  'tr'
);
const shareLegacy = KolTiginShareActions.writingShareUrl('en', 'articles', {json.dumps(SOUL_ID)});
const shareFuture = KolTiginShareActions.writingLocalizedShareUrl('tr', 'articles', {json.dumps(SOUL_TR)});
console.log(JSON.stringify({{
  idPath, legacyPath, futurePath, futureTr, guideIdPath, guideLegacy, guideFuture,
  routeKey: parsed && parsed.routeKey,
  resolvedId: resolved && resolved.id,
  guideRouteKey: parsedGuide && parsedGuide.routeKey,
  guideResolvedId: resolvedGuide && resolvedGuide.id,
  localizedSwitch, shareLegacy, shareFuture
}}));
"""
    )
    data = json.loads(run_node(script))
    if data["idPath"] != f"/writings/en/articles/{SOUL_ID}/":
        fail("writingPublicPath must remain legacy/ID")
    if data["legacyPath"] != f"/writings/tr/articles/{SOUL_ID}/":
        fail("writingLegacyPublicPath mismatch")
    if data["futurePath"] != f"/writings/en/articles/{SOUL_EN}/":
        fail("writingLocalizedPublicPath EN mismatch")
    if data["futureTr"] != f"/writings/tr/articles/{SOUL_TR}/":
        fail("writingLocalizedPublicPath TR mismatch")
    if data["guideIdPath"] != f"/guides/{GUIDE_ID}/EN/":
        fail("guidePublicPath must remain legacy/ID")
    if data["guideLegacy"] != f"/guides/{GUIDE_ID}/TR/":
        fail("guideLegacyPublicPath mismatch")
    if data["guideFuture"] != f"/guides/{GUIDE_TR}/TR/":
        fail("guideLocalizedPublicPath mismatch")
    if data["routeKey"] != SOUL_EN or data["resolvedId"] != SOUL_ID:
        fail("parse/resolve writing dual-read failed")
    if data["guideRouteKey"] != GUIDE_TR or data["guideResolvedId"] != GUIDE_ID:
        fail("parse/resolve guide dual-read failed")
    if data["localizedSwitch"] != f"/writings/tr/articles/{SOUL_TR}/":
        fail("prepared localized language counterpart mismatch")
    if data["shareLegacy"] != f"https://koltigin.xyz/writings/en/articles/{SOUL_ID}/":
        fail("current share URL must remain ID-based")
    if data["shareFuture"] != f"https://koltigin.xyz/writings/tr/articles/{SOUL_TR}/":
        fail("future share helper mismatch")
    ok("path helpers current vs future")


def test_legacy_hash_dual_read() -> None:
    script = browser_bundle_script(
        f"""
const target = KolTiginRouter.legacyTarget('#/yazilar/articles/' + {json.dumps(SOUL_EN)});
const idTarget = KolTiginRouter.legacyTarget('#/yazilar/articles/' + {json.dumps(SOUL_ID)});
console.log(JSON.stringify({{ target, idTarget }}));
"""
    )
    data = json.loads(run_node(script))
    expected = f"/writings/en/articles/{SOUL_ID}/"
    if data["target"] != expected:
        fail(f"legacy mood-diary hash must map to ID URL, got {data['target']}")
    if data["idTarget"] != expected:
        fail("legacy ID hash must map to ID URL")
    ok("legacy hash dual-read")


def test_current_public_output_unchanged() -> None:
    sample = (ROOT / "writings/en/articles/2026-08-31-soulmemory/index.html").read_text(encoding="utf-8")
    if f'rel="canonical" href="https://koltigin.xyz/writings/en/articles/{SOUL_ID}/"' not in sample:
        fail("live writing canonical drifted")
    if f"/writings/en/articles/{SOUL_EN}/" in sample:
        fail("live writing HTML must not use localized public slug paths yet")
    guide = (ROOT / f"guides/{GUIDE_ID}/TR/index.html").read_text(encoding="utf-8")
    if f'rel="canonical" href="https://koltigin.xyz/guides/{GUIDE_ID}/TR/"' not in guide:
        fail("live guide canonical drifted")
    if f"/guides/{GUIDE_TR}/TR/" in guide:
        fail("live guide HTML must not use localized public slug paths yet")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    if f"/writings/en/articles/{SOUL_ID}/" not in sitemap:
        fail("sitemap lost ID writing URL")
    if f"/writings/en/articles/{SOUL_EN}/" in sitemap or f"/guides/{GUIDE_TR}/TR/" in sitemap:
        fail("sitemap must not cut over to localized slugs")
    if "xmlns:xhtml" in sitemap:
        fail("sitemap xhtml cutover belongs to a later phase")
    site_js = (ROOT / "assets" / "js" / "site.js").read_text(encoding="utf-8")
    if "writingPublicPath(loc, writing.kind, stableId || writing.id)" not in site_js:
        fail("language switch must still emit legacy/ID public paths")
    if "writingLocalizedCounterpartPath" in site_js and "location.assign(window.KolTiginRouter.writingLocalizedCounterpartPath" in site_js:
        fail("language switch must not activate localized navigation yet")
    blog = (ROOT / "assets" / "js" / "blog-parser.js").read_text(encoding="utf-8")
    if "writingPublicPath" not in blog:
        fail("writing cards should use mode-aware writingPublicPath")
    if "publicSlug" not in blog or "stableId" not in blog:
        fail("writing records must expose publicSlug/stableId")
    guides = (ROOT / "assets" / "js" / "guides-parser.js").read_text(encoding="utf-8")
    if "guidePublicPath" not in guides:
        fail("guide cards should use mode-aware guidePublicPath")
    if "data-guide-public-slug" not in guides:
        fail("guide cards should expose public slug metadata")
    router = (ROOT / "assets" / "js" / "router.js").read_text(encoding="utf-8")
    if "CURRENT_ID" not in router or "setPublicUrlMode" not in router:
        fail("router must expose public URL mode with CURRENT_ID default")
    ok("current public directories / SEO / language-switch unchanged")


def test_generator_data_attributes() -> None:
    import importlib.util

    spec = importlib.util.spec_from_file_location("generate_share", ROOT / "scripts" / "generate-share.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    html = mod.inject_content_identity_attrs(
        '<html lang="en">',
        content_id=SOUL_ID,
        content_kind="articles",
        en_slug=SOUL_EN,
        tr_slug=SOUL_TR,
    )
    if f'data-content-id="{SOUL_ID}"' not in html:
        fail("generator identity attrs missing content id")
    if f'data-en-slug="{SOUL_EN}"' not in html or f'data-tr-slug="{SOUL_TR}"' not in html:
        fail("generator identity attrs missing locale slugs")
    # Ensure discover exposes slug metadata for later HTML injection.
    writings = {f"{item['kind']}/{item['id']}": item for item in mod.discover_writings(ROOT)}
    soul = writings[f"articles/{SOUL_ID}"]
    if soul["langs"]["en"].get("slug") != SOUL_EN or soul["langs"]["tr"].get("slug") != SOUL_TR:
        fail("discover_writings must expose locale slug frontmatter")
    guides = {item["id"]: item for item in mod.discover_guides(ROOT)}
    guide = guides[GUIDE_ID]
    if guide["langs"]["en"].get("slug") != GUIDE_EN or guide["langs"]["tr"].get("slug") != GUIDE_TR:
        fail("discover_guides must expose locale slug frontmatter")
    ok("generator data-attribute preparation")


def test_ga4_admin_404() -> None:
    ga = "G-CD89YCN426"
    if ga not in (ROOT / "index.html").read_text(encoding="utf-8"):
        fail("GA4 missing from public index")
    admin = (ROOT / "admin" / "index.html").read_text(encoding="utf-8")
    if ga in admin or "gtag(" in admin:
        fail("admin must not include GA4")
    if "/assets/js/url-map.js" in admin:
        # optional; not required. Just ensure we did not accidentally add GA4 with slugify.
        pass
    not_found = (ROOT / "404.html").read_text(encoding="utf-8")
    if ga in not_found or "gtag(" in not_found:
        fail("404 must not include GA4")
    if "noindex" not in not_found:
        fail("404 must remain noindex")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    if "/assets/js/url-map.js" not in index:
        fail("public index must load url-map.js")
    ok("GA4 / admin / 404 regression")


def test_python_url_map_still_valid() -> None:
    data = build_url_map(ROOT)
    if data["writings"][f"articles/{SOUL_ID}"]["en"] != SOUL_EN:
        fail("python url-map soul EN drifted")
    if data["guides"][GUIDE_ID]["tr"] != GUIDE_TR:
        fail("python url-map guide TR drifted")
    ok("python url-map still valid")


def main() -> int:
    test_lookup_layer()
    test_path_helpers()
    test_legacy_hash_dual_read()
    test_current_public_output_unchanged()
    test_generator_data_attributes()
    test_ga4_admin_404()
    test_python_url_map_still_valid()
    print("ALL PHASE2 SLUG TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
