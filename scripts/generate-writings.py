#!/usr/bin/env python3
"""Discover Writings Markdown and write content/index.json.

Markdown files are the source of truth. Do not edit the generated JSON by hand.
Pair identity is the filename basename (same name in en/ and tr/).
Writing kinds come from config/writing-types.json.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "content" / "index.json"
TYPES_PATH = ROOT / "config" / "writing-types.json"
FALLBACK_KINDS = ("articles", "notes", "social")
DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def parse_front_matter(text: str) -> tuple[dict, str]:
    raw = text.replace("\r\n", "\n")
    if not raw.startswith("---"):
        return {}, raw
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return {}, raw
    metadata: dict[str, str] = {}
    for line in parts[1].split("\n"):
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        if key:
            metadata[key] = value
    return metadata, parts[2].lstrip("\n")


def load_writing_types() -> list[dict]:
    if not TYPES_PATH.is_file():
        return [{"id": kind, "core": True, "mode": "external" if kind == "social" else "internal"} for kind in FALLBACK_KINDS]
    try:
        data = json.loads(TYPES_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return [{"id": kind, "core": True} for kind in FALLBACK_KINDS]
    types = data.get("types") if isinstance(data, dict) else None
    if not isinstance(types, list):
        return [{"id": kind, "core": True} for kind in FALLBACK_KINDS]
    cleaned = []
    for item in types:
        if isinstance(item, dict) and str(item.get("id") or "").strip():
            cleaned.append(item)
    return cleaned or [{"id": kind, "core": True} for kind in FALLBACK_KINDS]


def writing_kind_ids() -> list[str]:
    ids = []
    for item in load_writing_types():
        kind = str(item.get("id") or "").strip()
        if kind and kind not in ids:
            ids.append(kind)
    for kind in FALLBACK_KINDS:
        if kind not in ids:
            ids.append(kind)
    return ids


def date_parts(path: Path) -> tuple[int, int, int]:
    try:
        metadata, _body = parse_front_matter(path.read_text(encoding="utf-8"))
    except OSError:
        metadata = {}
    raw = str(metadata.get("date") or "").strip()
    match = DATE_RE.match(raw)
    if not match:
        return (0, 0, 0)
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def list_markdown(folder: Path) -> list[str]:
    if not folder.is_dir():
        return []
    files = [path for path in folder.glob("*.md") if not path.name.startswith("_")]
    files.sort(key=lambda path: ((-date_parts(path)[0], -date_parts(path)[1], -date_parts(path)[2]), path.name.lower()))
    return [path.name for path in files]


def build_index() -> dict:
    kinds = writing_kind_ids()
    data: dict = {"types": load_writing_types()}
    for kind in kinds:
        data[kind] = {
            "en": list_markdown(ROOT / "content" / kind / "en"),
            "tr": list_markdown(ROOT / "content" / kind / "tr"),
        }
    data["videos"] = list_markdown(ROOT / "content" / "videos")
    return data


def write_index() -> dict:
    data = build_index()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return data


def main() -> None:
    data = write_index()
    parts = []
    for kind in writing_kind_ids():
        entry = data.get(kind) or {}
        parts.append(f"{kind}.en={len(entry.get('en') or [])}")
        parts.append(f"{kind}.tr={len(entry.get('tr') or [])}")
    parts.append(f"videos={len(data['videos'])}")
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} ({', '.join(parts)})")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        sys.stderr.write(f"generate-writings failed: {exc}\n")
        raise SystemExit(1)
