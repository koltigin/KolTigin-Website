"""Derive Cloudflare Bulk Redirect list items from config/redirects.json.

Phase 4A: prepare an auditable artifact only. Do not install or activate.
Recommendation for Phase 4C: Cloudflare Bulk Redirects (static path→path 301s).
"""
from __future__ import annotations

import json
from pathlib import Path

from redirects import RedirectManifestError, load_redirects, validate_redirects

ORIGIN = "https://koltigin.xyz"


def to_absolute(path: str) -> str:
    text = str(path or "").strip()
    if text.startswith("http://") or text.startswith("https://"):
        return text
    return f"{ORIGIN.rstrip('/')}{text}"


def bulk_redirect_items(data: dict) -> list[dict]:
    pairs = validate_redirects(data)
    items: list[dict] = []
    for row in pairs:
        items.append(
            {
                "source_url": to_absolute(row["from"]),
                "target_url": to_absolute(row["to"]),
                "status_code": 301,
                "preserve_query_string": True,
                "include_subdomains": False,
                "subpath_matching": False,
                "preserve_path_suffix": False,
            }
        )
    return items


def build_cloudflare_bulk_redirects(data: dict) -> dict:
    if data.get("enabled") is True:
        raise RedirectManifestError(
            "refusing to emit Cloudflare artifact while redirects.enabled is true "
            "without an explicit Phase 4C activation step"
        )
    items = bulk_redirect_items(data)
    return {
        "version": 1,
        "phase": "4a-prepare",
        "activated": False,
        "comment": (
            "Derived from config/redirects.json. Not installed in Cloudflare. "
            "Phase 4C: create a Bulk Redirect List from `items`, then attach a "
            "Bulk Redirect Rule. Prefer Bulk Redirects over Single Redirect Rules "
            "or a Worker for these 17 static path-to-path 301 mappings."
        ),
        "source_manifest": "config/redirects.json",
        "recommended_product": "bulk_redirects",
        "items": items,
    }


def write_cloudflare_bulk_redirects(root: Path, dest_rel: str = "config/cloudflare-bulk-redirects.json") -> Path:
    redirects_path = root / "config" / "redirects.json"
    data = load_redirects(redirects_path)
    artifact = build_cloudflare_bulk_redirects(data)
    dest = root / dest_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(artifact, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return dest


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    path = write_cloudflare_bulk_redirects(root)
    print(f"wrote {path.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
