"""Validate the version-controlled public redirect manifest. Data only until Phase 4C."""
from __future__ import annotations

import json
import re
from pathlib import Path

WRITING_PATH_RE = re.compile(r"^/writings/(en|tr)/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:-[a-z0-9]+)*/$")
GUIDE_PATH_RE = re.compile(r"^/guides/[a-z0-9]+(?:-[a-z0-9]+)*/(EN|TR)/$")
EXPECTED_REDIRECT_COUNT = 17


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
    targets: dict[str, str] = {}
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
        if dest in targets:
            raise RedirectManifestError(f"duplicate target: {dest}")
        sources[src] = dest
        targets[dest] = src
        pairs.append({"from": src, "to": dest})

    for src, dest in sources.items():
        seen = {src}
        current = dest
        while current in sources:
            if current in seen:
                raise RedirectManifestError(f"cyclic redirect involving {src}")
            seen.add(current)
            current = sources[current]
        # Destination must not also be a source of another hop (chain).
        if dest in sources:
            raise RedirectManifestError(f"redirect chain from {src} via {dest}")
    return pairs


def _parse_writing_path(path: str) -> tuple[str, str, str] | None:
    match = WRITING_PATH_RE.fullmatch(path)
    if not match:
        return None
    parts = path.strip("/").split("/")
    # writings / lang / kind / segment
    return parts[1], parts[2], parts[3]


def _parse_guide_path(path: str) -> tuple[str, str] | None:
    match = GUIDE_PATH_RE.fullmatch(path)
    if not match:
        return None
    parts = path.strip("/").split("/")
    # guides / segment / LANG
    return parts[1], parts[2]


def validate_redirects_against_url_map(data: dict, url_map: dict) -> list[dict[str, str]]:
    """Ensure each redirect maps a stable-ID alias to the locale slug from url-map."""
    pairs = validate_redirects(data)
    if len(pairs) != EXPECTED_REDIRECT_COUNT:
        raise RedirectManifestError(
            f"expected exactly {EXPECTED_REDIRECT_COUNT} redirects, got {len(pairs)}"
        )
    writings = url_map.get("writings") if isinstance(url_map, dict) else None
    guides = url_map.get("guides") if isinstance(url_map, dict) else None
    if not isinstance(writings, dict) or not isinstance(guides, dict):
        raise RedirectManifestError("url-map must include writings and guides objects")

    for row in pairs:
        src = row["from"]
        dest = row["to"]
        writing_src = _parse_writing_path(src)
        writing_dest = _parse_writing_path(dest)
        if writing_src and writing_dest:
            lang, kind, old_seg = writing_src
            dest_lang, dest_kind, new_seg = writing_dest
            if lang != dest_lang or kind != dest_kind:
                raise RedirectManifestError(f"writing redirect locale/kind mismatch: {src} -> {dest}")
            key = f"{kind}/{old_seg}"
            record = writings.get(key)
            if not isinstance(record, dict):
                raise RedirectManifestError(f"redirect source is not a writing stable ID: {src}")
            expected = str(record.get(lang) or "").strip()
            if not expected:
                raise RedirectManifestError(f"url-map missing {lang} slug for {key}")
            if expected == old_seg:
                raise RedirectManifestError(f"self redirect for slug==ID writing: {src}")
            if new_seg != expected:
                raise RedirectManifestError(
                    f"writing redirect target mismatch for {key}/{lang}: "
                    f"got {new_seg}, expected {expected}"
                )
            continue

        guide_src = _parse_guide_path(src)
        guide_dest = _parse_guide_path(dest)
        if guide_src and guide_dest:
            old_seg, code = guide_src
            new_seg, dest_code = guide_dest
            if code != dest_code:
                raise RedirectManifestError(f"guide redirect language mismatch: {src} -> {dest}")
            record = guides.get(old_seg)
            if not isinstance(record, dict):
                raise RedirectManifestError(f"redirect source is not a guide stable ID: {src}")
            lang = "tr" if code == "TR" else "en"
            expected = str(record.get(lang) or "").strip()
            if not expected:
                raise RedirectManifestError(f"url-map missing {lang} slug for guide {old_seg}")
            if expected == old_seg:
                raise RedirectManifestError(f"self redirect for slug==ID guide: {src}")
            if new_seg != expected:
                raise RedirectManifestError(
                    f"guide redirect target mismatch for {old_seg}/{code}: "
                    f"got {new_seg}, expected {expected}"
                )
            continue

        raise RedirectManifestError(f"unsupported redirect path pair: {src} -> {dest}")
    return pairs
