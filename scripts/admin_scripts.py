"""Path-safe downloadable script helpers for the local admin prototype."""
from __future__ import annotations

import json
import re
from http import HTTPStatus
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS_ROOT = ROOT / "downloads"
PROJECTS_JSON = ROOT / "projects" / "projects.json"
CATEGORIES_JSON = ROOT / "config" / "project-categories.json"
SCRIPT_SITE_ORIGIN = "https://koltigin.xyz"
SCRIPT_UPLOAD_LIMIT = 1_000_000
COMMON_SCRIPT_PROJECT = "common"
LEGACY_DOWNLOAD_FOLDERS = {"redbelly-network": "redbelly"}
PREFERRED_SCRIPT_CATEGORY_ORDER = (
    "mainnet",
    "activeTestnets",
    "depin",
    "completedTestnets",
    "completedDefi",
    "defi",
    "builtByMe",
)
SCRIPT_EXTENSIONS = {".sh", ".py", ".js", ".json", ".yaml", ".yml", ".toml", ".txt"}
SCRIPT_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def decode_repeats(raw: str) -> str:
    value = str(raw or "")
    for _ in range(3):
        try:
            next_value = unquote(value.replace("+", "%20"))
        except Exception as exc:
            raise ValueError("Invalid filename") from exc
        if next_value == value:
            break
        value = next_value
    return value


def download_folder(project_id: str) -> str:
    ident = str(project_id or "").strip().lower()
    return LEGACY_DOWNLOAD_FOLDERS.get(ident, ident)


def _load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def get_allowed_download_projects(projects_json=None) -> set[str]:
    data = projects_json if projects_json is not None else _load_json(PROJECTS_JSON, {})
    allowed = {COMMON_SCRIPT_PROJECT}
    for items in (data or {}).values():
        if not isinstance(items, list):
            continue
        for item in items:
            ident = str((item or {}).get("id") or "").strip().lower()
            if ID_RE.match(ident):
                allowed.add(ident)
    for canonical, folder in LEGACY_DOWNLOAD_FOLDERS.items():
        if canonical in allowed and ID_RE.match(folder):
            allowed.add(folder)
    return allowed


def _name_sort_key(name: str):
    parts = re.split(r"(\d+)", str(name or ""))
    key = []
    for part in parts:
        if part.isdigit():
            key.append((1, int(part)))
        else:
            key.append((0, part.lower()))
    return key


def build_script_options(projects_json=None, categories=None) -> list[dict]:
    data = projects_json if projects_json is not None else _load_json(PROJECTS_JSON, {})
    cats = categories if categories is not None else _load_json(CATEGORIES_JSON, [])
    if not isinstance(cats, list):
        cats = []
    cat_by_id = {item.get("id"): item for item in cats if isinstance(item, dict)}
    ordered = [cid for cid in PREFERRED_SCRIPT_CATEGORY_ORDER if any(item.get("id") == cid for item in cats)]
    ordered.extend(item.get("id") for item in cats if item.get("id") not in PREFERRED_SCRIPT_CATEGORY_ORDER)
    seen = set()
    options = []
    for category_id in ordered:
        cat = cat_by_id.get(category_id) or {}
        items = data.get(category_id) if isinstance(data.get(category_id), list) else []
        named = [item for item in items if item and ID_RE.match(str(item.get("id") or "").strip().lower())]
        named.sort(key=lambda item: (_name_sort_key(item.get("name") or ""), str(item.get("id") or "")))
        for item in named:
            ident = str(item.get("id")).strip().lower()
            if ident in seen:
                continue
            seen.add(ident)
            label = cat.get("label") or {"en": category_id, "tr": category_id}
            options.append({
                "id": ident,
                "name": str(item.get("name") or ident),
                "folder": download_folder(ident),
                "categoryId": category_id,
                "categoryLabel": label,
            })
    options.append({
        "id": COMMON_SCRIPT_PROJECT,
        "name": "Common",
        "folder": COMMON_SCRIPT_PROJECT,
        "categoryId": COMMON_SCRIPT_PROJECT,
        "categoryLabel": {"en": "Common", "tr": "Common"},
    })
    return options


def resolve_script_project(raw: str, allowed=None) -> str:
    ident = str(raw or "").strip().lower()
    if not ID_RE.match(ident):
        raise ValueError("Unknown project")
    allowed_set = allowed if isinstance(allowed, set) else get_allowed_download_projects()
    if ident not in allowed_set:
        raise ValueError("Unknown project")
    return ident


def script_extension(name: str) -> str:
    text = str(name or "").lower()
    idx = text.rfind(".")
    if idx < 0:
        return ""
    return text[idx:]


def sanitize_script_filename(raw: str, fallback_ext: str = "") -> str:
    name = decode_repeats(raw).strip()
    if not name or "\0" in name or any(ord(ch) < 32 for ch in name):
        raise ValueError("Invalid filename")
    if ".." in name or "/" in name or "\\" in name or ":" in name:
        raise ValueError("Invalid filename")
    if name.startswith("."):
        raise ValueError("Invalid filename")
    ext = script_extension(name)
    if not ext and fallback_ext:
        name = f"{name}{fallback_ext if fallback_ext.startswith('.') else '.' + fallback_ext}"
        ext = script_extension(name)
    if ext not in SCRIPT_EXTENSIONS:
        raise ValueError("Unsupported file type")
    if not SCRIPT_NAME_RE.match(name) or len(name) > 120:
        raise ValueError("Invalid filename")
    return name


def script_repo_path(project: str, filename: str, allowed=None) -> Path:
    allowed_set = allowed if isinstance(allowed, set) else get_allowed_download_projects()
    project_id = resolve_script_project(project, allowed_set)
    folder = download_folder(project_id)
    if not ID_RE.match(folder) or folder not in allowed_set:
        raise ValueError("Unknown project")
    stored = sanitize_script_filename(filename)
    dest = (DOWNLOADS_ROOT / folder / stored).resolve()
    root = DOWNLOADS_ROOT.resolve()
    if dest != root / folder / stored:
        raise ValueError("Invalid filename")
    return dest


def public_script_url(project: str, filename: str) -> str:
    folder = download_folder(project)
    stored = sanitize_script_filename(filename)
    if not ID_RE.match(folder):
        raise ValueError("Unknown project")
    return f"{SCRIPT_SITE_ORIGIN}/downloads/{folder}/{stored}"


def is_overwrite_flag(value) -> bool:
    text = str(value or "").strip().lower()
    return value is True or text in {"1", "true", "yes"}


def list_scripts() -> dict:
    allowed = get_allowed_download_projects()
    options = build_script_options()
    items = []
    if DOWNLOADS_ROOT.is_dir():
        for folder in sorted(path for path in DOWNLOADS_ROOT.iterdir() if path.is_dir()):
            ident = folder.name.lower()
            if ident not in allowed or not ID_RE.match(ident):
                continue
            for path in sorted(folder.iterdir()):
                if not path.is_file():
                    continue
                try:
                    filename = sanitize_script_filename(path.name)
                except ValueError:
                    continue
                items.append({
                    "project": ident,
                    "filename": filename,
                    "url": public_script_url(ident, filename),
                    "size": path.stat().st_size,
                })
    groups = []
    for option in options:
        folder = option.get("folder") or download_folder(option["id"])
        scripts = sorted(
            [item for item in items if item["project"] in {folder, option["id"]}],
            key=lambda item: item["filename"],
        )
        if not scripts:
            continue
        groups.append({**option, "scripts": scripts})
    return {
        "options": options,
        "groups": groups,
        "projects": groups,
        "scripts": items,
    }


def handle_script_upload(handler, json_ok, json_error, parse_multipart) -> None:
    try:
        parts = parse_multipart(handler)
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))

    def field(name: str) -> str:
        item = parts.get(name)
        if not item:
            return ""
        raw = item[1]
        if isinstance(raw, bytes):
            return raw.decode("utf-8", "ignore").strip()
        return str(raw or "").strip()

    filename, data = parts.get("file") or ("", b"")
    if not data:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Choose a script file")
    if len(data) > SCRIPT_UPLOAD_LIMIT:
        return json_error(handler, HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "File is too large")
    if b"\0" in data:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Unsupported file type")
    try:
        allowed = get_allowed_download_projects()
        project = resolve_script_project(field("project"), allowed)
        stored = sanitize_script_filename(field("filename") or field("name") or filename, script_extension(filename))
        dest = script_repo_path(project, stored, allowed)
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))
    exists = dest.is_file()
    if exists and not is_overwrite_flag(field("overwrite") or field("replace")):
        return json_error(handler, HTTPStatus.CONFLICT, "This file already exists. Do you want to overwrite it?")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    folder = download_folder(project)
    return json_ok(handler, {
        "filename": stored,
        "project": project,
        "folder": folder,
        "path": f"/downloads/{folder}/{stored}",
        "url": public_script_url(folder, stored),
        "updated": exists,
    })


def handle_script_delete(body: dict, json_ok, json_error, handler) -> None:
    try:
        allowed = get_allowed_download_projects()
        project = resolve_script_project(str((body or {}).get("project") or ""), allowed)
        filename = sanitize_script_filename(str((body or {}).get("filename") or ""))
        dest = script_repo_path(project, filename, allowed)
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))
    if not dest.is_file():
        return json_error(handler, HTTPStatus.NOT_FOUND, "File not found")
    dest.unlink()
    folder = download_folder(project)
    return json_ok(handler, {"deleted": True, "path": f"/downloads/{folder}/{filename}"})
