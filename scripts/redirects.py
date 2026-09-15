"""Validate the version-controlled public redirect manifest. Data only in Phase 1."""
from __future__ import annotations

import json
import re
from pathlib import Path

WRITING_PATH_RE = re.compile(r"^/writings/(en|tr)/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*/$")
GUIDE_PATH_RE = re.compile(r"^/guides/[a-z0-9]+(?:-[a-z0-9]+)*/(EN|TR)/$")


class RedirectManifestError(ValueError):
    """Raised when redirect data is malformed or unsafe."""


def is_public_path(path: object) -> bool:
    text = str(path or "")
    return bool(WRITING_PATH_RE.fullmatch(text) or GUIDE_PATH_RE.fullmatch(text))


def load_redirects(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RedirectManifestError("redirects root must be an object")
    return data


def validate_redirects(data: dict) -> list[dict[str, str]]:
    enabled = data.get("enabled")
    if enabled is not True and enabled is not False:
        raise RedirectManifestError("enabled must be a boolean")
    rows = data.get("redirects")
    if not isinstance(rows, list):
        raise RedirectManifestError("redirects must be an array")
    sources: dict[str, str] = {}
    pairs: list[dict[str, str]] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise RedirectManifestError(f"redirects[{index}] must be an object")
        src = str(row.get("from") or "").strip()
        dest = str(row.get("to") or "").strip()
        if not src or not dest:
            raise RedirectManifestError(f"redirects[{index}] needs from and to")
        if not is_public_path(src):
            raise RedirectManifestError(f"malformed source path: {src}")
        if not is_public_path(dest):
            raise RedirectManifestError(f"malformed target path: {dest}")
        if src == dest:
            raise RedirectManifestError(f"self redirect: {src}")
        if src in sources:
            raise RedirectManifestError(f"duplicate source: {src}")
        sources[src] = dest
        pairs.append({"from": src, "to": dest})

    for src, dest in sources.items():
        seen = {src}
        current = dest
        while current in sources:
            if current in seen:
                raise RedirectManifestError(f"cyclic redirect involving {src}")
            seen.add(current)
            current = sources[current]
    return pairs
