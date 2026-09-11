"""Path-safe downloadable script helpers for the local admin prototype."""
from __future__ import annotations

from http import HTTPStatus
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS_ROOT = ROOT / "downloads"
SCRIPT_SITE_ORIGIN = "https://koltigin.xyz"
SCRIPT_UPLOAD_LIMIT = 1_000_000
SCRIPT_PROJECTS = {
    "redbelly": {"en": "Redbelly", "tr": "Redbelly"},
    "ario": {"en": "AR.IO", "tr": "AR.IO"},
    "common": {"en": "Common", "tr": "Common"},
}
SCRIPT_PROJECT_ORDER = ("redbelly", "ario", "common")
SCRIPT_EXTENSIONS = {".sh", ".py", ".js", ".json", ".yaml", ".yml", ".toml", ".txt"}
SCRIPT_NAME_RE = __import__("re").compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


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


def resolve_script_project(raw: str) -> str:
    project = str(raw or "").strip().lower()
    if project not in SCRIPT_PROJECTS:
        raise ValueError("Unknown project")
    return project


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


def script_repo_path(project: str, filename: str) -> Path:
    project_id = resolve_script_project(project)
    stored = sanitize_script_filename(filename)
    dest = (DOWNLOADS_ROOT / project_id / stored).resolve()
    root = DOWNLOADS_ROOT.resolve()
    if dest != root / project_id / stored:
        raise ValueError("Invalid filename")
    return dest


def public_script_url(project: str, filename: str) -> str:
    project_id = resolve_script_project(project)
    stored = sanitize_script_filename(filename)
    return f"{SCRIPT_SITE_ORIGIN}/downloads/{project_id}/{stored}"


def is_overwrite_flag(value) -> bool:
    text = str(value or "").strip().lower()
    return value is True or text in {"1", "true", "yes"}


def list_scripts() -> dict:
    items = []
    for project in SCRIPT_PROJECT_ORDER:
        folder = DOWNLOADS_ROOT / project
        if not folder.is_dir():
            continue
        for path in sorted(folder.iterdir()):
            if not path.is_file():
                continue
            try:
                filename = sanitize_script_filename(path.name)
            except ValueError:
                continue
            items.append({
                "project": project,
                "filename": filename,
                "url": public_script_url(project, filename),
                "size": path.stat().st_size,
            })
    return {
        "projects": [
            {
                "id": project,
                "label": SCRIPT_PROJECTS[project],
                "scripts": [item for item in items if item["project"] == project],
            }
            for project in SCRIPT_PROJECT_ORDER
        ],
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
        project = resolve_script_project(field("project"))
        stored = sanitize_script_filename(field("filename") or field("name") or filename, script_extension(filename))
        dest = script_repo_path(project, stored)
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))
    exists = dest.is_file()
    if exists and not is_overwrite_flag(field("overwrite") or field("replace")):
        return json_error(handler, HTTPStatus.CONFLICT, "This file already exists. Do you want to overwrite it?")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return json_ok(handler, {
        "filename": stored,
        "project": project,
        "path": f"/downloads/{project}/{stored}",
        "url": public_script_url(project, stored),
        "updated": exists,
    })


def handle_script_delete(body: dict, json_ok, json_error, handler) -> None:
    try:
        project = resolve_script_project(str((body or {}).get("project") or ""))
        filename = sanitize_script_filename(str((body or {}).get("filename") or ""))
        dest = script_repo_path(project, filename)
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))
    if not dest.is_file():
        return json_error(handler, HTTPStatus.NOT_FOUND, "File not found")
    dest.unlink()
    return json_ok(handler, {"deleted": True, "path": f"/downloads/{project}/{filename}"})
