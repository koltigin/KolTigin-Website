#!/usr/bin/env python3
"""Discover content/projects/**/*.md and write projects/projects.json.

Markdown files are the source of truth. Do not edit the generated JSON by hand.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write(
        "PyYAML is required. Install with: python3 -m pip install pyyaml\n"
    )
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES_PATH = ROOT / "config" / "project-categories.json"
CONTENT_ROOT = ROOT / "content" / "projects"
OUTPUT_PATH = ROOT / "projects" / "projects.json"
SOURCE_JSON = ROOT / "projects" / "projects.json"

STATUS_VALUES = {"active", "completed", "built"}
SKIP_NAME_PREFIX = "_"


class ProjectError(Exception):
    def __init__(self, path: Path, message: str) -> None:
        super().__init__(f"{path.relative_to(ROOT)}: {message}")
        self.path = path
        self.message = message


def load_categories() -> list[dict]:
    if not CATEGORIES_PATH.is_file():
        raise SystemExit(f"Missing category config: {CATEGORIES_PATH}")
    data = json.loads(CATEGORIES_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise SystemExit("config/project-categories.json must be a non-empty array")
    seen = set()
    for item in data:
        cid = item.get("id")
        folder = item.get("folder")
        if not cid or not folder:
            raise SystemExit("Each category needs id and folder")
        if cid in seen:
            raise SystemExit(f"Duplicate category id: {cid}")
        seen.add(cid)
    return sorted(data, key=lambda item: int(item.get("order", 0)))


def slugify(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def quote_preview(value: object, limit: int = 80) -> str:
    text = json.dumps(value, ensure_ascii=False)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def parse_markdown(path: Path) -> dict:
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("---"):
        raise ProjectError(path, "missing YAML front matter (must start with ---)")
    parts = raw.split("---", 2)
    if len(parts) < 3:
        raise ProjectError(path, "front matter is not closed with ---")
    try:
        data = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError as exc:
        raise ProjectError(path, f"invalid YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise ProjectError(path, "front matter must be a mapping")
    return data


def is_allowed_url(url: str) -> bool:
    value = url.strip()
    return value.startswith(
        ("http://", "https://", "./", "../", "#", "mailto:", "/")
    )


def optional_string(data: dict, key: str, aliases: tuple[str, ...] = ()) -> str | None:
    for name in (key, *aliases):
        if name in data and data[name] is not None:
            value = data[name]
            if not isinstance(value, str) or not value.strip():
                return ""
            return value.strip()
    return None


def normalize_role(value: object, path: Path) -> object | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, dict):
        role = {}
        for lang in ("en", "tr"):
            if lang in value and value[lang] is not None:
                if not isinstance(value[lang], str) or not value[lang].strip():
                    raise ProjectError(path, f"role.{lang} must be a non-empty string")
                role[lang] = value[lang].strip()
        if not role:
            raise ProjectError(path, "role must include en and/or tr")
        return role
    raise ProjectError(path, "role must be a string or {en, tr} object")


def normalize_summary(value: object, path: Path) -> dict | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ProjectError(path, "summary must be an object with en and/or tr")
    summary = {}
    for lang in ("en", "tr"):
        if lang in value and value[lang] is not None:
            if not isinstance(value[lang], str) or not value[lang].strip():
                raise ProjectError(path, f"summary.{lang} must be a non-empty string")
            summary[lang] = value[lang].strip()
    if "en" in value or "tr" in value:
        if "en" not in summary or "tr" not in summary:
            raise ProjectError(path, "summary must include both en and tr when used")
    if not summary:
        raise ProjectError(path, "summary must include en and tr")
    return summary


def normalize_links(value: object, path: Path) -> list[dict] | None:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ProjectError(path, "links must be a list of {label, url} items")
    links = []
    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ProjectError(path, f"links[{index}] must be an object")
        label = item.get("label")
        if isinstance(label, dict):
            en = str(label.get("en") or "").strip()
            tr = str(label.get("tr") or "").strip()
            if not en:
                raise ProjectError(path, f"links[{index}].label.en is required")
            stored_label = {"en": en, "tr": tr or en}
        else:
            if not isinstance(label, str) or not label.strip():
                raise ProjectError(path, f"links[{index}].label is required")
            stored_label = label.strip()
        url = item.get("url")
        if not isinstance(url, str) or not url.strip():
            raise ProjectError(path, f"links[{index}].url is required")
        if not is_allowed_url(url):
            raise ProjectError(
                path,
                f"links[{index}].url is not a supported URL: {quote_preview(url)}",
            )
        link = {"label": stored_label, "url": url.strip()}
        guide = item.get("guide")
        if guide is not None and str(guide).strip():
            guide_text = str(guide).strip()
            if not re.fullmatch(r"[A-Za-z0-9-]+", guide_text):
                raise ProjectError(path, f"links[{index}].guide must be a slug")
            link["guide"] = guide_text
        icon = item.get("icon")
        if icon is not None and str(icon).strip():
            link["icon"] = str(icon).strip()
        links.append(link)
    return links


def normalize_logo(value: object, path: Path) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ProjectError(path, "logo must be a non-empty string")
    logo = value.strip()
    if logo.startswith(("./", "../", "http://", "https://", "/")):
        return logo
    return f"./assets/images/projects/{logo}"


def project_from_front_matter(data: dict, path: Path, categories_by_id: dict) -> dict:
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ProjectError(path, "required field missing or empty: name")

    category = data.get("category")
    if not isinstance(category, str) or not category.strip():
        raise ProjectError(path, "required field missing or empty: category")
    category = category.strip()
    if category not in categories_by_id:
        known = ", ".join(sorted(categories_by_id))
        raise ProjectError(path, f"unknown category {category!r} (expected one of: {known})")

    status = data.get("status")
    if not isinstance(status, str) or not status.strip():
        raise ProjectError(path, "required field missing or empty: status")
    status = status.strip()
    if status not in STATUS_VALUES:
        allowed = ", ".join(sorted(STATUS_VALUES))
        raise ProjectError(path, f"status must be one of: {allowed}")

    project_id = optional_string(data, "id") or path.stem
    if path.stem.startswith(SKIP_NAME_PREFIX) or project_id.startswith(SKIP_NAME_PREFIX):
        raise ProjectError(path, "id/filename starting with _ is reserved for templates")

    project: dict = {
        "id": project_id,
        "name": name.strip(),
        "status": status,
    }

    role = normalize_role(data.get("role"), path)
    if role is not None:
        project["role"] = role

    former = optional_string(data, "former_name", ("formerName",))
    if former:
        project["formerName"] = former

    logo = normalize_logo(data.get("logo"), path)
    if logo:
        project["logo"] = logo

    summary = normalize_summary(data.get("summary"), path)
    if summary:
        project["summary"] = summary

    links = normalize_links(data.get("links"), path)
    if links:
        project["links"] = links

    referral_url = optional_string(data, "referral_url", ("referralUrl",))
    if referral_url is not None:
        if referral_url == "":
            raise ProjectError(path, "referral_url must be a non-empty string when set")
        if not is_allowed_url(referral_url):
            raise ProjectError(path, "referral_url is not a supported URL")
        project["referralUrl"] = referral_url

    referral_code = optional_string(data, "referral_code", ("referralCode",))
    if referral_code is not None:
        if referral_code == "":
            raise ProjectError(path, "referral_code must be a non-empty string when set")
        project["referralCode"] = referral_code

    project["_category"] = category
    project["_source"] = str(path.relative_to(ROOT))
    return project


def iter_project_files() -> list[Path]:
    if not CONTENT_ROOT.is_dir():
        raise SystemExit(f"Missing content directory: {CONTENT_ROOT}")
    files = []
    for path in sorted(CONTENT_ROOT.rglob("*.md")):
        if path.name.startswith(SKIP_NAME_PREFIX):
            continue
        files.append(path)
    return files


def sort_key(name: str) -> tuple:
    text = str(name or "").strip()
    folded = text.casefold()
    parts = re.split(r"(\d+)", folded)
    key = []
    for part in parts:
        if part.isdigit():
            key.append((1, int(part)))
        else:
            key.append((0, part))
    return tuple(key)


def build_projects() -> dict:
    categories = load_categories()
    categories_by_id = {item["id"]: item for item in categories}
    grouped = {item["id"]: [] for item in categories}
    seen_ids: dict[str, Path] = {}
    errors: list[str] = []

    for path in iter_project_files():
        try:
            data = parse_markdown(path)
            project = project_from_front_matter(data, path, categories_by_id)
        except ProjectError as exc:
            errors.append(str(exc))
            continue
        project_id = project["id"]
        if project_id in seen_ids:
            errors.append(
                f"{path.relative_to(ROOT)}: duplicate id {project_id!r} "
                f"(already used in {seen_ids[project_id].relative_to(ROOT)})"
            )
            continue
        seen_ids[project_id] = path
        grouped[project["_category"]].append(project)

    if errors:
        sys.stderr.write("Project generation failed:\n")
        for line in errors:
            sys.stderr.write(f"  - {line}\n")
        raise SystemExit(1)

    output = {}
    for item in categories:
        cid = item["id"]
        projects = grouped[cid]
        projects.sort(key=lambda project: sort_key(project["name"]))
        cleaned = []
        for project in projects:
            cleaned.append({key: value for key, value in project.items() if not key.startswith("_")})
        output[cid] = cleaned
    return output


def dump_yaml(data: dict) -> str:
    return yaml.safe_dump(
        data,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
        width=1000,
    ).strip() + "\n"


def project_to_front_matter(project: dict, category: str) -> dict:
    data: dict = {
        "name": project["name"],
        "category": category,
        "status": project["status"],
    }
    if project.get("id"):
        data["id"] = project["id"]
    if "role" in project:
        data["role"] = project["role"]
    if project.get("formerName"):
        data["former_name"] = project["formerName"]
    if project.get("logo"):
        data["logo"] = project["logo"]
    if project.get("summary"):
        data["summary"] = project["summary"]
    if project.get("links"):
        data["links"] = project["links"]
    if project.get("referralUrl"):
        data["referral_url"] = project["referralUrl"]
    if project.get("referralCode"):
        data["referral_code"] = project["referralCode"]
    return data


def migrate_from_json() -> None:
    categories = load_categories()
    source = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    written = 0
    for category in categories:
        folder = CONTENT_ROOT / category["folder"]
        folder.mkdir(parents=True, exist_ok=True)
        items = source.get(category["id"]) or []
        if not items:
            gitkeep = folder / ".gitkeep"
            if not gitkeep.exists() and not any(folder.glob("*.md")):
                gitkeep.write_text("", encoding="utf-8")
            continue
        for project in items:
            name = project["name"]
            slug = slugify(project.get("id") or name) or slugify(name)
            if project.get("id") == "ario":
                slug = "ar-io"
            path = folder / f"{slug}.md"
            if path.exists():
                raise SystemExit(f"Refusing to overwrite existing file: {path}")
            body = "---\n" + dump_yaml(project_to_front_matter(project, category["id"])) + "---\n"
            path.write_text(body, encoding="utf-8")
            written += 1
    print(f"Migrated {written} project Markdown files into {CONTENT_ROOT.relative_to(ROOT)}")


def write_json(data: dict) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    OUTPUT_PATH.write_text(text, encoding="utf-8")


def canonical(data: dict) -> dict:
    result = {}
    for key, items in data.items():
        normalized = []
        for item in items:
            clone = json.loads(json.dumps(item))
            clone.pop("_category", None)
            clone.pop("_source", None)
            normalized.append(clone)
        normalized.sort(key=lambda item: sort_key(item.get("name", "")))
        result[key] = normalized
    return result


def compare_with_previous(generated: dict) -> None:
    if not SOURCE_JSON.is_file():
        return
    previous = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    left = canonical(previous)
    right = canonical(generated)
    if left != right:
        sys.stderr.write("Generated JSON does not match the previous projects.json semantically.\n")
        for key in sorted(set(left) | set(right)):
            if left.get(key) != right.get(key):
                sys.stderr.write(f"  category {key}: {len(left.get(key, []))} -> {len(right.get(key, []))}\n")
                if len(left.get(key, [])) == len(right.get(key, [])):
                    for old, new in zip(left.get(key, []), right.get(key, [])):
                        if old != new:
                            sys.stderr.write(f"    changed: {old.get('id')} / {old.get('name')}\n")
                            for field in sorted(set(old) | set(new)):
                                if old.get(field) != new.get(field):
                                    sys.stderr.write(
                                        f"      {field}: {quote_preview(old.get(field))} -> {quote_preview(new.get(field))}\n"
                                    )
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate projects/projects.json from Markdown")
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="One-time: create Markdown files from the current projects.json",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if generated output would differ from the current JSON (used during migration)",
    )
    args = parser.parse_args()

    if args.migrate:
        migrate_from_json()

    generated = build_projects()
    counts = {key: len(items) for key, items in generated.items()}
    if args.check:
        compare_with_previous(generated)
    write_json(generated)
    summary = ", ".join(f"{key}={count}" for key, count in counts.items())
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} ({summary})")


if __name__ == "__main__":
    main()
