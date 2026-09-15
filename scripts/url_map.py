"""Derived ID <-> locale slug lookup. Markdown frontmatter is the source of truth."""
from __future__ import annotations

import json
import re
from pathlib import Path

from koltigin_slug import SLUG_RE, is_valid_slug

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RESERVED_GUIDE_DIRS = {"en", "tr", "index.json"}
CORE_EXTERNAL_KINDS = {"social"}


class UrlMapError(ValueError):
    """Raised when slug metadata is missing, invalid, or colliding."""


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    raw = (text or "").replace("\r\n", "\n")
    if not raw.startswith("---"):
        return {}, raw
    close = raw.find("\n---", 3)
    if close == -1:
        return {}, raw
    meta: dict[str, str] = {}
    for line in raw[4:close].split("\n"):
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1].replace('\\"', '"')
        if key:
            meta[key] = value
    return meta, raw[close + 4 :].lstrip("\n")


def parse_alias_list(raw: object) -> list[str]:
    text = str(raw or "").strip()
    if not text:
        return []
    parts = [item.strip() for item in text.split(",")]
    out: list[str] = []
    seen: set[str] = set()
    for item in parts:
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def _load_writing_types(root: Path) -> list[dict]:
    path = root / "config" / "writing-types.json"
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    types = data.get("types") if isinstance(data, dict) else None
    return types if isinstance(types, list) else []


def _is_external_kind(kind: str, types: list[dict]) -> bool:
    if kind in CORE_EXTERNAL_KINDS:
        return True
    for item in types:
        if not isinstance(item, dict):
            continue
        if str(item.get("id") or "") != kind:
            continue
        return str(item.get("mode") or "") == "external"
    return False


def _require_slug(label: str, value: object) -> str:
    slug = str(value or "").strip()
    if not slug:
        raise UrlMapError(f"missing slug for {label}")
    if not is_valid_slug(slug) or not SLUG_RE.fullmatch(slug):
        raise UrlMapError(f"invalid slug for {label}: {slug!r}")
    return slug


def collect_writings(root: Path) -> dict[str, dict[str, dict]]:
    types = _load_writing_types(root)
    items: dict[str, dict[str, dict]] = {}
    content = root / "content"
    if not content.is_dir():
        return items
    kinds = {str(item.get("id") or "").strip() for item in types if isinstance(item, dict)}
    kinds.update({"articles", "notes", "social"})
    for kind in sorted(kinds):
        if not kind or _is_external_kind(kind, types):
            continue
        for lang in ("en", "tr"):
            folder = content / kind / lang
            if not folder.is_dir():
                continue
            for path in sorted(folder.glob("*.md")):
                item_id = path.stem
                if not ID_RE.fullmatch(item_id):
                    continue
                meta, _body = parse_front_matter(path.read_text(encoding="utf-8"))
                key = f"{kind}/{item_id}"
                rec = items.setdefault(key, {"id": item_id, "kind": kind, "slugs": {}, "aliases": {}})
                rec["slugs"][lang] = _require_slug(f"writing {key} {lang}", meta.get("slug"))
                aliases = parse_alias_list(meta.get("aliases"))
                if aliases:
                    rec["aliases"][lang] = []
                    for alias in aliases:
                        rec["aliases"][lang].append(_require_slug(f"writing {key} {lang} alias", alias))
    return items


def collect_guides(root: Path) -> dict[str, dict]:
    guides_root = root / "content" / "guides"
    items: dict[str, dict] = {}
    if not guides_root.is_dir():
        return items
    for folder in sorted(guides_root.iterdir()):
        if not folder.is_dir() or folder.name in RESERVED_GUIDE_DIRS or not ID_RE.fullmatch(folder.name):
            continue
        rec = {"id": folder.name, "slugs": {}, "aliases": {}}
        for lang, filename in (("en", "EN.md"), ("tr", "TR.md")):
            path = folder / filename
            if not path.is_file():
                continue
            meta, _body = parse_front_matter(path.read_text(encoding="utf-8"))
            rec["slugs"][lang] = _require_slug(f"guide {folder.name} {lang}", meta.get("slug"))
            aliases = parse_alias_list(meta.get("aliases"))
            if aliases:
                rec["aliases"][lang] = []
                for alias in aliases:
                    rec["aliases"][lang].append(_require_slug(f"guide {folder.name} {lang} alias", alias))
        if rec["slugs"]:
            items[folder.name] = rec
    return items


def validate_uniqueness(writings: dict[str, dict], guides: dict[str, dict]) -> None:
    writing_scope: dict[tuple[str, str], str] = {}
    writing_hash: dict[tuple[str, str], str] = {}
    for key, rec in writings.items():
        kind = rec["kind"]
        item_id = rec["id"]
        for lang, slug in rec["slugs"].items():
            scope_key = (kind, lang, slug)
            prior = writing_scope.get(scope_key)
            if prior and prior != key:
                raise UrlMapError(
                    f"duplicate writing slug {slug!r} for ({kind}, {lang}): {prior} and {key}"
                )
            writing_scope[scope_key] = key
            hash_key = (kind, slug)
            hashed = writing_hash.get(hash_key)
            if hashed and hashed != key:
                raise UrlMapError(
                    f"writing hash slug {slug!r} in {kind} maps to both {hashed} and {key}"
                )
            writing_hash[hash_key] = key
        for lang, aliases in rec.get("aliases", {}).items():
            for alias in aliases:
                if alias == item_id:
                    continue
                hash_key = (kind, alias)
                hashed = writing_hash.get(hash_key)
                if hashed and hashed != key:
                    raise UrlMapError(
                        f"writing alias {alias!r} in {kind} maps to both {hashed} and {key}"
                    )
                writing_hash[hash_key] = key
                scope_key = (kind, lang, alias)
                prior = writing_scope.get(scope_key)
                if prior and prior != key:
                    raise UrlMapError(
                        f"duplicate writing alias {alias!r} for ({kind}, {lang}): {prior} and {key}"
                    )

    guide_scope: dict[str, str] = {}
    for item_id, rec in guides.items():
        values = list(rec["slugs"].values())
        for lang, aliases in rec.get("aliases", {}).items():
            values.extend(aliases)
        seen_local: set[str] = set()
        for slug in values:
            if slug in seen_local:
                continue
            seen_local.add(slug)
            prior = guide_scope.get(slug)
            if prior and prior != item_id:
                raise UrlMapError(f"duplicate guide slug {slug!r}: {prior} and {item_id}")
            guide_scope[slug] = item_id


def build_url_map(root: Path) -> dict:
    writings = collect_writings(root)
    guides = collect_guides(root)
    validate_uniqueness(writings, guides)
    writing_out: dict[str, dict[str, str]] = {}
    hash_aliases: dict[str, str] = {}
    for key in sorted(writings):
        rec = writings[key]
        writing_out[key] = {lang: rec["slugs"][lang] for lang in sorted(rec["slugs"])}
        item_id = rec["id"]
        kind = rec["kind"]
        segments = set(rec["slugs"].values())
        for aliases in rec.get("aliases", {}).values():
            segments.update(aliases)
        for segment in sorted(segments):
            if segment == item_id:
                continue
            hash_aliases[f"{kind}/{segment}"] = key
    guide_out: dict[str, dict[str, str]] = {}
    for item_id in sorted(guides):
        rec = guides[item_id]
        guide_out[item_id] = {lang: rec["slugs"][lang] for lang in sorted(rec["slugs"])}
    return {
        "writings": writing_out,
        "guides": guide_out,
        "legacy": {"writingHashes": hash_aliases},
    }


def dump_url_map(data: dict) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_url_map(root: Path) -> Path:
    dest = root / "content" / "url-map.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(dump_url_map(build_url_map(root)), encoding="utf-8")
    return dest
