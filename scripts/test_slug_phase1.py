#!/usr/bin/env python3
"""Phase 1 foundation tests: slugify parity, url-map, redirects, public URL freeze."""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from koltigin_slug import (  # noqa: E402
    is_valid_slug,
    new_guide_id,
    new_writing_id,
    resolve_persisted_slug,
    slugify,
)
from redirects import load_redirects, validate_redirects  # noqa: E402
from url_map import UrlMapError, build_url_map, dump_url_map, write_url_map  # noqa: E402

EXPECTED_WRITING_SLUGS = {
    "articles/2026-08-31-soulmemory": {
        "en": "soulmemory-on-chain-mood-diary",
        "tr": "soulmemory-on-chain-duygu-gunlugu",
    },
    "articles/clarity-act-abd-kripto-piyasasinda-gozler-senato-da": {
        "en": "clarity-act-all-eyes-on-the-us-senate",
        "tr": "clarity-act-abd-kripto-piyasasinda-gozler-senato-da",
    },
    "notes/2025-06-01-turkce-node-rehberi": {
        "en": "three-rules-i-follow-when-writing-node-guides",
        "tr": "node-rehberi-yazarken-dikkat-ettigim-uc-temel-kural",
    },
    "notes/2026-08-29-validator-notlari": {
        "en": "being-a-validator-is-more-than-running-a-binary",
        "tr": "validator-olmak-neden-sadece-bir-binary-calistirmak-degildir",
    },
}

EXPECTED_GUIDE_SLUGS = {
    "how-to-get-an-arns-domain": {
        "en": "how-to-get-an-arns-domain",
        "tr": "arns-domain-nasil-alinir",
    },
    "ar-io-gateway-installation": {
        "en": "ar-io-gateway-installation",
        "tr": "ar-io-gateway-kurulumu",
    },
    "ar-io-gateway-update": {"en": "ar-io-gateway-update", "tr": "ar-io-gateway-guncelleme"},
    "ar-io-gateway-troubleshooting": {
        "en": "ar-io-gateway-troubleshooting",
        "tr": "ar-io-gateway-sorun-giderme",
    },
    "aro-network-depin-ubuntu-vps-installation-guide": {
        "en": "aro-network-depin-ubuntu-vps-installation-guide",
        "tr": "aro-network-depin-ubuntu-vps-kurulum-rehberi",
    },
    "optimai-cli-node-setup-guide-ubuntu-24-04-vps": {
        "en": "optimai-cli-node-setup-guide-ubuntu-24-04-vps",
        "tr": "optimai-cli-node-kurulum-rehberi-ubuntu-24-04-vps",
    },
    "redbelly-mainnet-node-installation-guide": {
        "en": "redbelly-mainnet-node-installation-guide",
        "tr": "redbelly-mainnet-node-kurulum-rehberi",
    },
    "redbelly-mainnet-node-update-guide": {
        "en": "redbelly-mainnet-node-update-guide",
        "tr": "redbelly-mainnet-node-guncelleme-rehberi",
    },
    "redbelly-mainnet-telegram-monitoring-bot-installation-guide": {
        "en": "redbelly-mainnet-telegram-monitoring-bot-installation-guide",
        "tr": "redbelly-mainnet-telegram-monitoring-bot-kurulum-rehberi",
    },
    "redbelly-node-troubleshooting": {
        "en": "redbelly-node-troubleshooting",
        "tr": "redbelly-node-sorunlar-ve-cozumler",
    },
}

CURRENT_PUBLIC_PATHS = [
    "writings/en/articles/2026-08-31-soulmemory/index.html",
    "writings/tr/articles/2026-08-31-soulmemory/index.html",
    "writings/en/articles/clarity-act-abd-kripto-piyasasinda-gozler-senato-da/index.html",
    "writings/tr/articles/clarity-act-abd-kripto-piyasasinda-gozler-senato-da/index.html",
    "writings/en/notes/2025-06-01-turkce-node-rehberi/index.html",
    "writings/tr/notes/2025-06-01-turkce-node-rehberi/index.html",
    "writings/en/notes/2026-08-29-validator-notlari/index.html",
    "writings/tr/notes/2026-08-29-validator-notlari/index.html",
    "guides/how-to-get-an-arns-domain/EN/index.html",
    "guides/how-to-get-an-arns-domain/TR/index.html",
    "guides/ar-io-gateway-installation/EN/index.html",
    "guides/ar-io-gateway-installation/TR/index.html",
    "guides/ar-io-gateway-update/EN/index.html",
    "guides/ar-io-gateway-update/TR/index.html",
    "guides/ar-io-gateway-troubleshooting/EN/index.html",
    "guides/ar-io-gateway-troubleshooting/TR/index.html",
    "guides/aro-network-depin-ubuntu-vps-installation-guide/EN/index.html",
    "guides/aro-network-depin-ubuntu-vps-installation-guide/TR/index.html",
    "guides/optimai-cli-node-setup-guide-ubuntu-24-04-vps/EN/index.html",
    "guides/optimai-cli-node-setup-guide-ubuntu-24-04-vps/TR/index.html",
    "guides/redbelly-mainnet-node-installation-guide/EN/index.html",
    "guides/redbelly-mainnet-node-installation-guide/TR/index.html",
    "guides/redbelly-mainnet-node-update-guide/EN/index.html",
    "guides/redbelly-mainnet-node-update-guide/TR/index.html",
    "guides/redbelly-mainnet-telegram-monitoring-bot-installation-guide/EN/index.html",
    "guides/redbelly-mainnet-telegram-monitoring-bot-installation-guide/TR/index.html",
    "guides/redbelly-node-troubleshooting/EN/index.html",
    "guides/redbelly-node-troubleshooting/TR/index.html",
]


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL {msg}")


def ok(msg: str) -> None:
    print("ok", msg)


def load_generate_share():
    spec = importlib.util.spec_from_file_location("generate_share", ROOT / "scripts" / "generate-share.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def node_slugify(input_text: str) -> str:
    script = f"""
import {{ slugify }} from {json.dumps(str(ROOT / "workers/admin-api/src/slugify.js"))};
console.log(JSON.stringify(slugify({json.dumps(input_text)})));
"""
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        fail(f"node slugify failed: {proc.stderr.strip()}")
    return json.loads(proc.stdout.strip())


def browser_slugify(input_text: str) -> str:
    src = (ROOT / "assets" / "js" / "slugify.js").read_text(encoding="utf-8")
    script = (
        src
        + "\n"
        + f"console.log(JSON.stringify(globalThis.KolTiginSlugify.slugify({json.dumps(input_text)})));\n"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as handle:
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
        fail(f"browser slugify failed: {proc.stderr.strip()}")
    return json.loads(proc.stdout.strip())


def test_slugify_vectors() -> None:
    vectors = json.loads((ROOT / "scripts" / "fixtures" / "slugify-vectors.json").read_text(encoding="utf-8"))
    for row in vectors["vectors"]:
        name = row["name"]
        expected = row["output"]
        py = slugify(row["input"])
        if py != expected:
            fail(f"python slugify {name}: {py!r} != {expected!r}")
        js = node_slugify(row["input"])
        if js != expected:
            fail(f"worker slugify {name}: {js!r} != {expected!r}")
        browser = browser_slugify(row["input"])
        if browser != expected:
            fail(f"browser slugify {name}: {browser!r} != {expected!r}")
        if expected and not is_valid_slug(expected):
            fail(f"expected vector {name} is not a valid slug")
        if not expected and is_valid_slug(expected):
            fail(f"empty vector {name} must be invalid")
    ok("slugify golden vectors (python/worker/browser)")


def test_persisted_slug_and_opaque_helpers() -> None:
    if resolve_persisted_slug("", "kept-slug", "New Title") != "kept-slug":
        fail("existing slug must win over title changes")
    if resolve_persisted_slug("explicit-slug", "kept-slug", "New Title") != "explicit-slug":
        fail("explicit slug must win")
    if resolve_persisted_slug("", "", "Hello World") != "hello-world":
        fail("missing slug must derive from locale title")
    writing = new_writing_id("2026-09-14", "abcd1234")
    guide = new_guide_id("2026-09-14", "abcd1234")
    if writing != "2026-09-14-abcd1234":
        fail(f"unexpected writing id helper output: {writing}")
    if guide != "g-20260914-abcd1234":
        fail(f"unexpected guide id helper output: {guide}")
    handlers = (ROOT / "workers" / "admin-api" / "src" / "handlers.js").read_text(encoding="utf-8")
    if "newWritingId(" in handlers or "newGuideId(" in handlers:
        fail("opaque ID helpers must not be activated in handlers yet")
    ok("persisted slug + opaque ID helpers prepared but inactive")


def test_url_map_and_uniqueness() -> None:
    data = build_url_map(ROOT)
    if set(data["writings"]) != set(EXPECTED_WRITING_SLUGS):
        fail(f"unexpected writing keys: {sorted(data['writings'])}")
    if set(data["guides"]) != set(EXPECTED_GUIDE_SLUGS):
        fail(f"unexpected guide keys: {sorted(data['guides'])}")
    for key, slugs in EXPECTED_WRITING_SLUGS.items():
        if data["writings"][key] != slugs:
            fail(f"writing slug mismatch for {key}: {data['writings'][key]} != {slugs}")
    for key, slugs in EXPECTED_GUIDE_SLUGS.items():
        if data["guides"][key] != slugs:
            fail(f"guide slug mismatch for {key}: {data['guides'][key]} != {slugs}")
    if "social/" in json.dumps(data["writings"]):
        fail("external/social content must be excluded from url-map writings")
    legacy = data.get("legacy", {}).get("writingHashes", {})
    if legacy.get("articles/soulmemory-on-chain-mood-diary") != "articles/2026-08-31-soulmemory":
        fail("soulmemory mood-diary hash alias missing")
    if legacy.get("notes/validator-olmak-neden-sadece-bir-binary-calistirmak-degildir") != (
        "notes/2026-08-29-validator-notlari"
    ):
        fail("validator legacy alias missing")
    first = dump_url_map(data)
    second = dump_url_map(build_url_map(ROOT))
    if first != second:
        fail("url-map dump must be deterministic")
    written = write_url_map(ROOT)
    if written.read_text(encoding="utf-8") != first:
        fail("write_url_map output drifted")
    ok("url-map exact mapping + uniqueness + legacy aliases")


def test_url_map_rejects_missing_and_duplicates() -> None:
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)
        (tmp / "config").mkdir()
        (tmp / "config" / "writing-types.json").write_text(
            '{"types":[{"id":"articles","mode":"internal"}]}\n', encoding="utf-8"
        )
        article = tmp / "content" / "articles" / "en"
        article.mkdir(parents=True)
        (article / "demo.md").write_text('---\ntitle: "Demo"\n---\n\nBody\n', encoding="utf-8")
        try:
            build_url_map(tmp)
            fail("missing slug must raise")
        except UrlMapError as exc:
            if "missing slug" not in str(exc):
                fail(f"unexpected missing-slug error: {exc}")

        (article / "demo.md").write_text(
            '---\ntitle: "Demo"\nslug: shared\n---\n\nBody\n', encoding="utf-8"
        )
        (article / "other.md").write_text(
            '---\ntitle: "Other"\nslug: shared\n---\n\nBody\n', encoding="utf-8"
        )
        try:
            build_url_map(tmp)
            fail("duplicate writing slug must raise")
        except UrlMapError as exc:
            if "duplicate writing slug" not in str(exc):
                fail(f"unexpected duplicate writing error: {exc}")

        guide_a = tmp / "content" / "guides" / "guide-a"
        guide_b = tmp / "content" / "guides" / "guide-b"
        guide_a.mkdir(parents=True)
        guide_b.mkdir(parents=True)
        (tmp / "content" / "articles" / "en" / "other.md").unlink()
        (guide_a / "EN.md").write_text("---\nslug: same-slug\n---\n\n# A\n", encoding="utf-8")
        (guide_b / "TR.md").write_text("---\nslug: same-slug\n---\n\n# B\n", encoding="utf-8")
        try:
            build_url_map(tmp)
            fail("duplicate guide slug must raise")
        except UrlMapError as exc:
            if "duplicate guide slug" not in str(exc):
                fail(f"unexpected duplicate guide error: {exc}")
    ok("url-map validation rejects missing/duplicate slugs")


def test_redirect_manifest() -> None:
    data = load_redirects(ROOT / "config" / "redirects.json")
    if data.get("enabled") is not False:
        fail("Phase 1 redirects must remain disabled")
    rows = validate_redirects(data)
    if len(rows) != 17:
        fail(f"expected 17 planned redirects, got {len(rows)}")
    generate_src = (ROOT / "scripts" / "generate-share.py").read_text(encoding="utf-8")
    if "validate_redirects" in generate_src or "config/redirects.json" in generate_src:
        fail("generate-share must not activate redirects in Phase 1")
    bad = {
        "enabled": False,
        "redirects": [
            {"from": "/writings/en/articles/a/", "to": "/writings/en/articles/a/"},
        ],
    }
    try:
        validate_redirects(bad)
        fail("self redirect must fail")
    except Exception as exc:  # noqa: BLE001
        if "self redirect" not in str(exc):
            fail(f"unexpected self-redirect error: {exc}")
    ok("redirect manifest validated and disabled")


def test_public_urls_unchanged() -> None:
    generate_share = load_generate_share()
    for rel in CURRENT_PUBLIC_PATHS:
        if not (ROOT / rel).is_file():
            fail(f"missing current public path {rel}")
        if "soulmemory-on-chain-mood-diary" in rel or "arns-domain-nasil-alinir" in rel:
            fail(f"Phase 1 must not publish migrated public path yet: {rel}")
    for item in generate_share.discover_writings(ROOT):
        for lang in item["langs"]:
            path = generate_share.writing_share_path(lang, item["kind"], item["id"])
            if f"/{item['id']}/" not in f"/{path}":
                fail(f"discover/write path must still use stable ID: {path}")
    for item in generate_share.discover_guides(ROOT):
        for lang in item["langs"]:
            path = generate_share.guide_share_path(lang, item["id"])
            if f"/{item['id']}/" not in f"/{path}":
                fail(f"guide path must still use stable ID: {path}")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    for needle in (
        "/writings/en/articles/2026-08-31-soulmemory/",
        "/writings/en/articles/clarity-act-abd-kripto-piyasasinda-gozler-senato-da/",
        "/guides/how-to-get-an-arns-domain/EN/",
        "/guides/how-to-get-an-arns-domain/TR/",
    ):
        if needle not in sitemap:
            fail(f"sitemap lost current URL {needle}")
    for needle in (
        "/writings/en/articles/soulmemory-on-chain-mood-diary/",
        "/guides/arns-domain-nasil-alinir/TR/",
        "xmlns:xhtml",
    ):
        if needle in sitemap:
            fail(f"sitemap must not cut over yet: {needle}")
    sample = (ROOT / "writings/en/articles/2026-08-31-soulmemory/index.html").read_text(encoding="utf-8")
    if 'rel="canonical" href="https://koltigin.xyz/writings/en/articles/2026-08-31-soulmemory/"' not in sample:
        fail("canonical still must use stable ID path")
    if "/writings/en/articles/soulmemory-on-chain-mood-diary/" in sample:
        fail("generated HTML must not use migrated public slug paths yet")
    site_js = (ROOT / "assets" / "js" / "site.js").read_text(encoding="utf-8")
    if "writingPublicPath(loc, writing.kind," not in site_js:
        fail("language-switch must still reuse path id in Phase 1")
    if re.search(r"location\.assign\(\s*window\.KolTiginRouter\.writingLocalizedCounterpartPath", site_js):
        fail("language-switch must not navigate to localized slug paths yet")
    ok("current public/canonical/sitemap/language-switch unchanged")


def test_ga4_and_404() -> None:
    ga = "G-CD89YCN426"
    public = (ROOT / "index.html").read_text(encoding="utf-8")
    if ga not in public:
        fail("GA4 missing from public index.html")
    admin = (ROOT / "admin" / "index.html").read_text(encoding="utf-8")
    if ga in admin or "gtag(" in admin:
        fail("admin must not include GA4")
    not_found = (ROOT / "404.html").read_text(encoding="utf-8")
    if ga in not_found or "gtag(" in not_found:
        fail("404 must not include GA4")
    if 'name="robots" content="noindex' not in not_found and "noindex" not in not_found:
        fail("404 must remain noindex")
    blog = (ROOT / "assets" / "js" / "blog-parser.js").read_text(encoding="utf-8")
    if "legacyAliases" not in blog:
        fail("blog-parser must read aliases for legacy hash compatibility")
    if "soulmemory-on-chain-mood-diary" not in (
        ROOT / "content" / "articles" / "tr" / "2026-08-31-soulmemory.md"
    ).read_text(encoding="utf-8"):
        fail("TR soulmemory must keep mood-diary alias")
    ok("GA4 / 404 / legacy hash compatibility")


def main() -> int:
    test_slugify_vectors()
    test_persisted_slug_and_opaque_helpers()
    test_url_map_and_uniqueness()
    test_url_map_rejects_missing_and_duplicates()
    test_redirect_manifest()
    test_public_urls_unchanged()
    test_ga4_and_404()
    print("ALL PHASE1 SLUG TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
