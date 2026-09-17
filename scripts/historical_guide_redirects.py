"""Validate and prepare historical guide Bulk Redirects offline; never deploy."""
from __future__ import annotations

import json
from pathlib import Path

from cloudflare_redirects import ORIGIN, csv_lines_from_items
from redirects import RedirectManifestError, load_redirects, validate_redirects_against_url_map

MANIFEST = "config/historical-guide-redirects.json"
JSON_ARTIFACT = "config/cloudflare-historical-guide-redirects.json"
CSV_ARTIFACT = "config/cloudflare-historical-guide-redirects.csv"
GUIDE_IDS = (
    "optimai-cli-node-setup-guide-ubuntu-24-04-vps",
    "aro-network-depin-ubuntu-vps-installation-guide",
)


def validate_historical_redirects(data: dict, primary: dict, url_map: dict) -> list[dict]:
    """Allow only eight known aliases; retain all primary-manifest constraints."""
    primary_pairs = validate_redirects_against_url_map(primary, url_map)
    if data.get("version") != 1 or type(data.get("enabled")) is not bool:
        raise RedirectManifestError("historical manifest requires version 1 and boolean enabled")
    expected = {}
    for guide_id in GUIDE_IDS:
        for lang in ("en", "tr"):
            slug = url_map.get("guides", {}).get(guide_id, {}).get(lang)
            if not isinstance(slug, str) or not slug:
                raise RedirectManifestError(f"missing canonical slug: {guide_id}/{lang}")
            target = f"/guides/{slug}/{lang.upper()}/"
            for suffix in ("/", ""):
                expected[f"/guide/{lang}/{guide_id}{suffix}"] = target
    rows = data.get("redirects")
    if not isinstance(rows, list) or len(rows) != len(expected):
        raise RedirectManifestError("expected exactly eight historical aliases")
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"from", "to"}:
            raise RedirectManifestError("historical rows require only from/to")
        src, dest = row["from"], row["to"]
        if not isinstance(src, str) or not isinstance(dest, str):
            raise RedirectManifestError("historical paths must be strings")
        if src in seen or src not in expected or dest != expected[src]:
            raise RedirectManifestError(f"duplicate, unknown, or noncanonical historical mapping: {row}")
        seen.add(src)
    primary_sources = {row["from"] for row in primary_pairs}
    if seen & primary_sources:
        raise RedirectManifestError("historical and primary sources overlap")
    sources = seen | primary_sources
    if any(row["to"] in sources for row in rows + primary_pairs):
        raise RedirectManifestError("combined redirects must not form chains or loops")
    return rows


def build_artifact(data: dict, primary: dict, url_map: dict) -> dict:
    rows = validate_historical_redirects(data, primary, url_map)
    return {
        "version": 1,
        "activated": data["enabled"],
        "source_manifest": MANIFEST,
        "recommended_product": "bulk_redirects",
        "list_name": "koltigin_historical_guides",
        "rule_name": "koltigin_historical_guides",
        "comment": "Declarative only. Generation does not install or activate Cloudflare configuration.",
        "items": [{
            "source_url": ORIGIN + row["from"],
            "target_url": ORIGIN + row["to"],
            "status_code": 301,
            "preserve_query_string": True,
            "include_subdomains": False,
            "subpath_matching": False,
            "preserve_path_suffix": False,
        } for row in rows],
    }


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    artifact = build_artifact(
        load_redirects(root / MANIFEST),
        load_redirects(root / "config/redirects.json"),
        json.loads((root / "content/url-map.json").read_text()),
    )
    (root / JSON_ARTIFACT).write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    (root / CSV_ARTIFACT).write_text("\n".join(csv_lines_from_items(artifact["items"])) + "\n", encoding="utf-8")
    print(f"Prepared {len(artifact['items'])} aliases; activated={artifact['activated']}. No deployment performed.")


if __name__ == "__main__":
    main()
