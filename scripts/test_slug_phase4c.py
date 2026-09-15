#!/usr/bin/env python3
"""Offline Phase 4C repository tests (no Cloudflare/network required)."""
from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from cloudflare_redirects import (  # noqa: E402
    build_cloudflare_bulk_redirects,
    csv_lines_from_items,
)
from public_url_policy import DEFAULT_MODE, MODE_LOCALIZED  # noqa: E402
from redirects import (  # noqa: E402
    EXPECTED_REDIRECT_COUNT,
    load_redirects,
    validate_redirects,
    validate_redirects_against_url_map,
)
from url_map import build_url_map  # noqa: E402


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL {msg}")


def ok(msg: str) -> None:
    print("ok", msg)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_activation_metadata() -> None:
    data = load_redirects(ROOT / "config" / "redirects.json")
    if data.get("enabled") is not True:
        fail("Phase 4C redirects.enabled must be true (declarative live state)")
    pairs = validate_redirects(data)
    if len(pairs) != EXPECTED_REDIRECT_COUNT:
        fail(f"expected {EXPECTED_REDIRECT_COUNT} mappings")
    url_map = build_url_map(ROOT)
    validate_redirects_against_url_map(data, url_map)
    for row in pairs:
        if row["from"] == row["to"]:
            fail(f"self mapping: {row}")
    ok("enabled=true + 17 validated mappings")


def test_cloudflare_artifact_and_csv() -> None:
    data = load_redirects(ROOT / "config" / "redirects.json")
    expected = build_cloudflare_bulk_redirects(data)
    if expected.get("activated") is not True:
        fail("derived Cloudflare artifact must be activated=true when enabled=true")
    if expected.get("phase") != "4c-live":
        fail("phase must be 4c-live")
    live = expected.get("live") or {}
    if live.get("list_name") != "koltigin_phase4c_localized_slugs":
        fail("live list_name mismatch")
    if live.get("rule_name") != "koltigin_phase4c_localized_slugs":
        fail("live rule_name mismatch")
    written = json.loads(read(ROOT / "config" / "cloudflare-bulk-redirects.json"))
    if written != expected:
        fail("cloudflare-bulk-redirects.json drifted from deterministic derivation")
    items = written.get("items") or []
    if len(items) != EXPECTED_REDIRECT_COUNT:
        fail("Cloudflare items count")
    for item in items:
        if item.get("status_code") != 301:
            fail("status must be 301")
        if item.get("preserve_query_string") is not True:
            fail("preserve_query_string must be true")
        if item.get("include_subdomains") is not False:
            fail("include_subdomains must be false")
        if item.get("subpath_matching") is not False:
            fail("subpath_matching must be false")
        if item.get("preserve_path_suffix") is not False:
            fail("preserve_path_suffix must be false")
        if not str(item.get("source_url") or "").startswith("https://koltigin.xyz/"):
            fail("source_url must be https apex")
        if not str(item.get("target_url") or "").startswith("https://koltigin.xyz/"):
            fail("target_url must be https apex")

    csv_path = ROOT / "config" / "cloudflare-bulk-redirects.csv"
    if not csv_path.is_file():
        fail("missing cloudflare-bulk-redirects.csv")
    csv_text = read(csv_path)
    if csv_text.lstrip().lower().startswith("source"):
        fail("CSV must not include a header row")
    expected_csv = "\n".join(csv_lines_from_items(items)) + "\n"
    if csv_text != expected_csv:
        fail("CSV drifted from redirects/items derivation")
    if csv_text.count("\n") != EXPECTED_REDIRECT_COUNT:
        fail("CSV must have exactly 17 lines")
    ok("Cloudflare JSON + CSV parity and parameters")


def test_single_redirect_mechanism() -> None:
    gen = read(ROOT / "scripts" / "generate-share.py")
    if "config/redirects.json" in gen:
        fail("generate-share must not load redirects.json")
    router = read(ROOT / "assets" / "js" / "router.js")
    if "config/redirects.json" in router:
        fail("router must not load redirects.json")
    cf_src = read(ROOT / "scripts" / "cloudflare_redirects.py")
    if "api.cloudflare.com" in cf_src or "CLOUDFLARE_API" in cf_src:
        fail("cloudflare_redirects.py must not call Cloudflare APIs")
    if "requests." in cf_src or "urllib.request" in cf_src:
        fail("cloudflare_redirects.py must stay offline")
    ok("single live redirect mechanism (Cloudflare edge only)")


def test_phase4b_architecture_intact() -> None:
    if DEFAULT_MODE != MODE_LOCALIZED:
        fail("DEFAULT_MODE must remain LOCALIZED")
    pairs = validate_redirects(load_redirects(ROOT / "config" / "redirects.json"))
    sitemap = read(ROOT / "sitemap.xml")
    if "xmlns:xhtml" in sitemap or "xhtml:link" in sitemap:
        fail("sitemap must not add xhtml alternates")
    locs = re.findall(r"<loc>(.*?)</loc>", sitemap)
    for row in pairs:
        old = row["from"] if row["from"].endswith("/") else row["from"] + "/"
        new = row["to"] if row["to"].endswith("/") else row["to"] + "/"
        if f"https://koltigin.xyz{old}" in locs:
            fail(f"sitemap still lists OLD alias {old}")
        if f"https://koltigin.xyz{new}" not in locs:
            fail(f"sitemap missing NEW primary {new}")
        old_html = ROOT / old.strip("/") / "index.html"
        new_html = ROOT / new.strip("/") / "index.html"
        if not old_html.is_file():
            fail(f"legacy HTML missing: {old_html}")
        if not new_html.is_file():
            fail(f"localized HTML missing: {new_html}")
        old_text = read(old_html)
        new_text = read(new_html)
        if 'http-equiv="refresh"' in old_text.lower() or 'http-equiv="refresh"' in new_text.lower():
            fail("HTML must not use meta refresh")
        if "location.replace(" in old_text or "location.assign(" in old_text:
            fail("legacy HTML must not JS-redirect")
    ok("Phase 4B localized architecture + legacy HTML retained")


def test_verifier_readonly_design() -> None:
    path = ROOT / "scripts" / "verify_phase4c_redirects_readonly.py"
    if not path.is_file():
        fail("missing verify_phase4c_redirects_readonly.py")
    src = read(path)
    tree = ast.parse(src)
    writes = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in {"write_text", "write_bytes", "unlink", "mkdir", "rmtree", "replace"}:
                writes.append(node.func.attr)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in {"open"}:
                # allow only if not writing — coarse check via keywords
                for kw in node.keywords:
                    if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
                        if "w" in str(kw.value.value) or "a" in str(kw.value.value):
                            writes.append("open-write")
    if writes:
        fail(f"verifier appears to write filesystem: {writes}")
    if "api.cloudflare.com" in src or "CLOUDFLARE" in src and "API" in src:
        fail("verifier must not call Cloudflare API")
    if "config/redirects.json" not in src:
        fail("verifier must load canonical redirects.json")
    if "--expect-before" not in src:
        fail("verifier must support --expect-before")
    docs = ROOT / "docs" / "cloudflare-redirects.md"
    if not docs.is_file():
        fail("missing docs/cloudflare-redirects.md")
    doc = read(docs)
    for needle in (
        "koltigin_phase4c_localized_slugs",
        "preserve query string",
        "config/redirects.json",
        "verify_phase4c_redirects_readonly.py",
        "Rollback",
    ):
        if needle.lower() not in doc.lower() and needle not in doc:
            fail(f"docs missing {needle}")
    ok("verifier read-only design + docs present")


def main() -> None:
    test_activation_metadata()
    test_cloudflare_artifact_and_csv()
    test_single_redirect_mechanism()
    test_phase4b_architecture_intact()
    test_verifier_readonly_design()
    print("Phase 4C offline tests passed")


if __name__ == "__main__":
    main()
