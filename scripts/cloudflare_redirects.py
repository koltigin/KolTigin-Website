"""Derive Cloudflare Bulk Redirect list/CSV artifacts from config/redirects.json.

Declarative only: this module never calls the Cloudflare API and never installs
rules. Live execution is Cloudflare Bulk Redirects configured manually in the
dashboard (see docs/cloudflare-redirects.md).

`config/redirects.json` → `enabled`:
  Declarative repository flag that the localized-URL redirect migration is live.
  It does not trigger Pages/JS/Worker redirect generation.

`config/cloudflare-bulk-redirects.json` → `activated`:
  Declarative flag that the Cloudflare Bulk Redirect List/Rule is installed and
  active. Mirrors `redirects.enabled` when regenerating artifacts.
"""
from __future__ import annotations

import json
from pathlib import Path

from redirects import load_redirects, validate_redirects

ORIGIN = "https://koltigin.xyz"
CSV_REL = "config/cloudflare-bulk-redirects.csv"
JSON_REL = "config/cloudflare-bulk-redirects.json"


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


def build_cloudflare_bulk_redirects(data: dict, *, activated: bool | None = None) -> dict:
    """Build the JSON artifact. Does not contact Cloudflare.

    When ``activated`` is None, it mirrors ``data["enabled"]`` so repository
    metadata stays coherent after Phase 4C finalization.
    """
    items = bulk_redirect_items(data)
    is_activated = bool(data.get("enabled")) if activated is None else bool(activated)
    if is_activated:
        phase = "4c-live"
        comment = (
            "Derived from config/redirects.json. Live execution is Cloudflare Bulk "
            "Redirects (list/rule: koltigin_phase4c_localized_slugs). This file is "
            "declarative repository state only — regenerating it does not call the "
            "Cloudflare API."
        )
    else:
        phase = "4a-prepare"
        comment = (
            "Derived from config/redirects.json. Not installed in Cloudflare. "
            "Phase 4C: create a Bulk Redirect List from `items`, then attach a "
            "Bulk Redirect Rule. Prefer Bulk Redirects over Single Redirect Rules "
            "or a Worker for these 17 static path-to-path 301 mappings."
        )
    return {
        "version": 1,
        "phase": phase,
        "activated": is_activated,
        "comment": comment,
        "source_manifest": "config/redirects.json",
        "recommended_product": "bulk_redirects",
        "live": {
            "list_name": "koltigin_phase4c_localized_slugs",
            "rule_name": "koltigin_phase4c_localized_slugs",
            "activated_on": "2026-09-15",
        }
        if is_activated
        else None,
        "items": items,
    }


def csv_lines_from_items(items: list[dict]) -> list[str]:
    """Cloudflare dashboard CSV format (no header row)."""
    lines: list[str] = []
    for item in items:
        def flag(value: object) -> str:
            return "true" if value else "false"

        lines.append(
            ",".join(
                [
                    str(item["source_url"]),
                    str(item["target_url"]),
                    str(item["status_code"]),
                    flag(item.get("preserve_query_string")),
                    flag(item.get("include_subdomains")),
                    flag(item.get("subpath_matching")),
                    flag(item.get("preserve_path_suffix")),
                ]
            )
        )
    return lines


def write_cloudflare_csv(root: Path, items: list[dict], dest_rel: str = CSV_REL) -> Path:
    dest = root / dest_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(csv_lines_from_items(items)) + "\n", encoding="utf-8")
    return dest


def write_cloudflare_bulk_redirects(
    root: Path,
    dest_rel: str = JSON_REL,
    *,
    activated: bool | None = None,
    write_csv: bool = True,
) -> Path:
    redirects_path = root / "config" / "redirects.json"
    data = load_redirects(redirects_path)
    artifact = build_cloudflare_bulk_redirects(data, activated=activated)
    # Omit null live block for inactive artifacts to keep Phase 4A JSON compact.
    if artifact.get("live") is None:
        artifact = {k: v for k, v in artifact.items() if k != "live"}
    dest = root / dest_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(artifact, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if write_csv:
        write_cloudflare_csv(root, artifact["items"])
    return dest


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    path = write_cloudflare_bulk_redirects(root)
    print(f"wrote {path.relative_to(root)}")
    csv_path = root / CSV_REL
    if csv_path.is_file():
        print(f"wrote {csv_path.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
