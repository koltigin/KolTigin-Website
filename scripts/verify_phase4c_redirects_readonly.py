#!/usr/bin/env python3
"""READ-ONLY production verifier for Phase 4C Cloudflare Bulk Redirect activation.

Does not modify Cloudflare, DNS, Access, Workers, or the git worktree.
Loads the canonical 17 mappings from config/redirects.json.

Usage (after activation):
  python3 scripts/verify_phase4c_redirects_readonly.py

Optional pre-activation check (expect OLD still 200):
  python3 scripts/verify_phase4c_redirects_readonly.py --expect-before
"""
from __future__ import annotations

import argparse
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from redirects import EXPECTED_REDIRECT_COUNT, load_redirects, validate_redirects  # noqa: E402

ORIGIN = "https://koltigin.xyz"
UA = {"User-Agent": "KolTigin-Phase4C-Verify/1.0"}
CTX = ssl.create_default_context()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def load_pairs() -> list[dict[str, str]]:
    data = load_redirects(ROOT / "config" / "redirects.json")
    pairs = validate_redirects(data)
    if len(pairs) != EXPECTED_REDIRECT_COUNT:
        raise SystemExit(f"expected {EXPECTED_REDIRECT_COUNT} redirects, got {len(pairs)}")
    return pairs


def abs_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return ORIGIN.rstrip("/") + path


def fetch(url: str, retries: int = 4) -> tuple[int, dict[str, str], bytes]:
    last: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers=UA)
        opener = urllib.request.build_opener(
            NoRedirect(),
            urllib.request.HTTPSHandler(context=CTX),
            urllib.request.HTTPHandler(),
        )
        try:
            try:
                resp = opener.open(req, timeout=30)
                return resp.status, dict(resp.headers), resp.read()
            except urllib.error.HTTPError as exc:
                body = exc.read() if exc.fp else b""
                return exc.code, dict(exc.headers), body
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(0.7 * (attempt + 1))
    raise SystemExit(f"fetch failed for {url}: {last}")


def location(headers: dict[str, str]) -> str | None:
    return headers.get("Location") or headers.get("location")


def normalize_loc(loc: str | None, base: str) -> str | None:
    if not loc:
        return None
    return urljoin(base, loc)


def check_new(path: str) -> list[str]:
    url = abs_url(path)
    status, headers, body = fetch(url)
    errs: list[str] = []
    if status != 200:
        errs.append(f"status={status}")
    if location(headers):
        errs.append(f"unexpected Location={location(headers)}")
    html = body.decode("utf-8", errors="replace")
    if 'name="robots" content="noindex' in html.lower():
        errs.append("noindex")
    can = None
    import re

    m = re.search(r'rel="canonical"\s+href="([^"]+)"', html)
    if m:
        can = m.group(1)
    if can != url:
        errs.append(f"canonical={can}")
    return errs


def check_old_after(path: str, dest: str) -> list[str]:
    url = abs_url(path)
    dest_url = abs_url(dest)
    status, headers, _body = fetch(url)
    errs: list[str] = []
    if status != 301:
        errs.append(f"status={status} (want 301)")
    loc = normalize_loc(location(headers), url)
    if loc != dest_url:
        errs.append(f"Location={loc} (want {dest_url})")
    return errs


def check_old_before(path: str, dest: str) -> list[str]:
    url = abs_url(path)
    dest_url = abs_url(dest)
    status, headers, body = fetch(url)
    errs: list[str] = []
    if status != 200:
        errs.append(f"status={status} (want 200 before activation)")
    if location(headers):
        errs.append(f"unexpected redirect Location={location(headers)}")
    import re

    html = body.decode("utf-8", errors="replace")
    m = re.search(r'rel="canonical"\s+href="([^"]+)"', html)
    can = m.group(1) if m else None
    if can != dest_url:
        errs.append(f"canonical={can} (want {dest_url})")
    return errs


def check_query(path: str, dest: str) -> list[str]:
    url = abs_url(path) + "?utm_source=phase4c"
    dest_url = abs_url(dest) + "?utm_source=phase4c"
    status, headers, _body = fetch(url)
    errs: list[str] = []
    if status != 301:
        errs.append(f"query status={status}")
    loc = normalize_loc(location(headers), url)
    if loc != dest_url:
        # Some stacks may reorder query; compare parsed
        if not loc or urlparse(loc).path != urlparse(dest_url).path:
            errs.append(f"query Location={loc}")
        elif "utm_source=phase4c" not in (loc or ""):
            errs.append(f"query not preserved: {loc}")
    return errs


def check_slug_eq_id_untouched() -> list[str]:
    samples = [
        "/writings/tr/articles/clarity-act-abd-kripto-piyasasinda-gozler-senato-da/",
        "/guides/how-to-get-an-arns-domain/EN/",
        "/guides/redbelly-node-troubleshooting/EN/",
    ]
    errs: list[str] = []
    for path in samples:
        status, headers, _body = fetch(abs_url(path))
        if status != 200 or location(headers):
            errs.append(f"slug==ID affected: {path} status={status} loc={location(headers)}")
    return errs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--expect-before",
        action="store_true",
        help="Assert Phase 4B before-state (OLD still 200 aliases).",
    )
    parser.add_argument(
        "--skip-query",
        action="store_true",
        help="Skip OLD?utm_source=phase4c checks.",
    )
    args = parser.parse_args()
    pairs = load_pairs()
    failed = 0

    print(f"mode={'BEFORE' if args.expect_before else 'AFTER'} pairs={len(pairs)}")
    for row in pairs:
        src, dest = row["from"], row["to"]
        new_errs = check_new(dest)
        old_errs = (
            check_old_before(src, dest) if args.expect_before else check_old_after(src, dest)
        )
        q_errs: list[str] = []
        if not args.expect_before and not args.skip_query:
            q_errs = check_query(src, dest)
        ok = not new_errs and not old_errs and not q_errs
        mark = "PASS" if ok else "FAIL"
        print(f"{mark}\t{src} -> {dest}")
        if not ok:
            failed += 1
            if new_errs:
                print(f"  NEW: {'; '.join(new_errs)}")
            if old_errs:
                print(f"  OLD: {'; '.join(old_errs)}")
            if q_errs:
                print(f"  QUERY: {'; '.join(q_errs)}")

    slug_errs = check_slug_eq_id_untouched()
    if slug_errs:
        failed += 1
        for err in slug_errs:
            print("FAIL", err)
    else:
        print("PASS\tslug==ID samples untouched")

    # Admin must not be redirected by content map (Access challenge is OK).
    admin_status, admin_headers, _ = fetch(abs_url("/admin/"))
    admin_loc = location(admin_headers) or ""
    if admin_status in (301, 302) and "/writings/" in admin_loc:
        failed += 1
        print(f"FAIL\tadmin redirected to content: {admin_status} {admin_loc}")
    else:
        print(f"PASS\tadmin Access/other status={admin_status} (not content redirect)")

    if failed:
        print(f"FAILED checks involving {failed} rows/groups")
        return 1
    print("ALL PHASE 4C CHECKS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
