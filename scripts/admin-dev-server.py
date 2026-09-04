#!/usr/bin/env python3
"""Local-only KolTigin admin prototype server.

Binds to 127.0.0.1. Serves the static site and /admin/.
Prints a one-time login code to the terminal. Not production auth.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
import admin_cms

ROOT = Path(__file__).resolve().parents[1]
CODE_FILE = ROOT / ".admin-dev-code"
HOST = "127.0.0.1"
SESSION_TTL_SEC = 12 * 60 * 60
MAX_BODY = 512 * 1024
MAX_UPLOAD = 8 * 1024 * 1024
BLOG_DIR = ROOT / "assets" / "images" / "blog"
PROFILE_DIR = ROOT / "assets" / "images" / "profile"
SITE_PATH = ROOT / "config" / "site.json"
ALLOWED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
WRITING_KINDS = ("articles", "notes", "social")
CORE_TYPE_IDS = {"articles", "notes", "social"}
RESERVED_TYPE_IDS = CORE_TYPE_IDS | {
    "videos",
    "about",
    "resume",
    "projects",
    "writings",
    "admin",
    "assets",
    "config",
    "i18n",
    "content",
    "index",
}
TYPE_ICONS = {
    "document-text-outline",
    "code-slash-outline",
    "logo-twitter",
    "book-outline",
    "journal-outline",
    "musical-notes-outline",
    "chatbubble-ellipses-outline",
    "pencil-outline",
    "newspaper-outline",
}
TYPES_PATH = ROOT / "config" / "writing-types.json"
PLATFORMS_PATH = ROOT / "config" / "social-platforms.json"
VIDEO_KIND = "videos"
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
HTTPS_RE = re.compile(r"^https://[^\s]+$", re.IGNORECASE)
SOCIAL_URL_RE = {
    "github": re.compile(r"^https://(?:www\.)?github\.com/\S+$", re.I),
    "x": re.compile(r"^https://(?:www\.)?(?:x\.com|twitter\.com)/\S+$", re.I),
    "farcaster": re.compile(r"^https://(?:www\.)?(?:farcaster\.xyz|warpcast\.com)/\S+$", re.I),
    "base": HTTPS_RE,
    "youtube": re.compile(r"^https://(?:www\.)?(?:youtube\.com|youtu\.be)/\S+$", re.I),
    "linkedin": re.compile(r"^https://(?:[\w.-]+\.)?linkedin\.com/\S+$", re.I),
    "instagram": re.compile(r"^https://(?:www\.)?instagram\.com/\S+$", re.I),
    "medium": re.compile(r"^https://(?:[\w.-]+\.)?medium\.com/\S+$", re.I),
    "discord": HTTPS_RE,
    "telegram": re.compile(r"^https://(?:t\.me|telegram\.me)/\S+$", re.I),
    "website": HTTPS_RE,
    "custom": HTTPS_RE,
}
X_URL_RE = SOCIAL_URL_RE["x"]
YOUTUBE_PATTERNS = (
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{6,20})", re.I),
    re.compile(r"[?&]v=([A-Za-z0-9_-]{6,20})", re.I),
    re.compile(r"youtube\.com/embed/([A-Za-z0-9_-]{6,20})", re.I),
)
TR_MAP = str.maketrans(
    {
        "ç": "c",
        "Ç": "c",
        "ğ": "g",
        "Ğ": "g",
        "ı": "i",
        "İ": "i",
        "ö": "o",
        "Ö": "o",
        "ş": "s",
        "Ş": "s",
        "ü": "u",
        "Ü": "u",
    }
)

LOGIN_CODE = secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].lower()
SESSION_SECRET = secrets.token_hex(32)
SESSIONS: dict[str, float] = {}


def slugify(value: str) -> str:
    text = (value or "").translate(TR_MAP).strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:72]


def writing_kind_ids() -> list[str]:
    ids: list[str] = []
    path = ROOT / "config" / "writing-types.json"
    types: list = []
    if path.is_file():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("types"), list):
                types = payload["types"]
        except json.JSONDecodeError:
            types = []
    for item in types:
        if isinstance(item, dict):
            kind = str(item.get("id") or "").strip()
            if kind and kind not in ids:
                ids.append(kind)
    for kind in WRITING_KINDS:
        if kind not in ids:
            ids.append(kind)
    return ids


def load_writing_types() -> list[dict]:
    path = ROOT / "config" / "writing-types.json"
    if path.is_file():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("types"), list):
                return [item for item in payload["types"] if isinstance(item, dict) and item.get("id")]
        except json.JSONDecodeError:
            pass
    return [{"id": kind, "core": True, "mode": "external" if kind == "social" else "internal"} for kind in WRITING_KINDS]


def save_writing_types(types: list[dict]) -> None:
    TYPES_PATH.parent.mkdir(parents=True, exist_ok=True)
    TYPES_PATH.write_text(json.dumps({"types": types}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for item in types:
        kind = str(item.get("id") or "")
        if not kind:
            continue
        for lang in ("en", "tr"):
            (ROOT / "content" / kind / lang).mkdir(parents=True, exist_ok=True)


def load_social_platforms() -> list[dict]:
    if not PLATFORMS_PATH.is_file():
        return []
    try:
        payload = json.loads(PLATFORMS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    items = payload.get("platforms") if isinstance(payload, dict) else None
    return [item for item in items] if isinstance(items, list) else []


def writing_type_by_id(kind: str) -> dict:
    for item in load_writing_types():
        if str(item.get("id") or "") == kind:
            return item
    return {"id": kind, "mode": "external" if kind == "social" else "internal"}


def is_external_writing(kind: str) -> bool:
    return str(writing_type_by_id(kind).get("mode") or "") == "external"


def kind_has_markdown(kind: str) -> bool:
    for lang in ("en", "tr"):
        folder = ROOT / "content" / kind / lang
        if folder.is_dir() and any(path.suffix == ".md" and not path.name.startswith("_") for path in folder.glob("*.md")):
            return True
    return False


def valid_calendar_date(year: int, month: int, day: int) -> bool:
    if month < 1 or month > 12 or day < 1 or year < 1990 or year > 2100:
        return False
    lengths = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return day <= lengths[month - 1]


def normalize_date(value: str) -> str:
    raw = str(value or "").strip()
    iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", raw)
    if iso:
        year, month, day = int(iso.group(1)), int(iso.group(2)), int(iso.group(3))
        if valid_calendar_date(year, month, day):
            return f"{year:04d}-{month:02d}-{day:02d}"
        return ""
    euro = re.match(r"^(\d{1,2})[./](\d{1,2})[./](\d{4})$", raw)
    if euro:
        day, month, year = int(euro.group(1)), int(euro.group(2)), int(euro.group(3))
        if valid_calendar_date(year, month, day):
            return f"{year:04d}-{month:02d}-{day:02d}"
    return ""


def sniff_image_ext(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return ""


def unique_image_filename(folder: Path, stem: str, ext: str, data: bytes) -> str:
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{stem}{ext}"
    dest = folder / name
    n = 2
    while dest.exists():
        if dest.read_bytes() == data:
            return dest.name
        name = f"{stem}-{n}{ext}"
        dest = folder / name
        n += 1
        if n > 99:
            raise RuntimeError("Too many files with this image name")
    return name


def unique_blog_filename(stem: str, ext: str, data: bytes) -> str:
    return unique_image_filename(BLOG_DIR, stem, ext, data)


def parse_multipart(handler: SimpleHTTPRequestHandler) -> dict[str, tuple[str, bytes]]:
    content_type = handler.headers.get("Content-Type", "")
    match = re.search(r"boundary=(?P<b>.+)", content_type, re.I)
    if not match:
        raise ValueError("Missing multipart boundary")
    boundary = match.group("b").strip().strip('"').encode("utf-8")
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0 or length > MAX_UPLOAD:
        raise ValueError("Cover file is too large")
    raw = handler.rfile.read(length)
    parts: dict[str, tuple[str, bytes]] = {}
    for chunk in raw.split(b"--" + boundary):
        if not chunk or chunk in (b"--\r\n", b"--"):
            continue
        header, _, body = chunk.partition(b"\r\n\r\n")
        if not body:
            continue
        if body.endswith(b"\r\n"):
            body = body[:-2]
        disp = header.decode("latin-1", errors="replace")
        name_match = re.search(r'name="([^"]+)"', disp)
        if not name_match:
            continue
        filename_match = re.search(r'filename="([^"]*)"', disp)
        filename = filename_match.group(1) if filename_match else ""
        parts[name_match.group(1)] = (filename, body)
    return parts


def youtube_id_from_url(url: str) -> str:
    raw = (url or "").strip()
    for pattern in YOUTUBE_PATTERNS:
        match = pattern.search(raw)
        if match:
            return match.group(1)
    return ""


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
            value = value[1:-1].replace('\\"', '"')
        if key:
            metadata[key] = value
    return metadata, parts[2].lstrip("\n")


def excerpt_from_body(body: str) -> str:
    lines = []
    for line in (body or "").replace("\r\n", "\n").split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("```"):
            if lines:
                break
            continue
        stripped = re.sub(r"^[-*]\s+", "", stripped)
        stripped = re.sub(r"^\d+\.\s+", "", stripped)
        stripped = re.sub(r"[*_`>#]+", "", stripped)
        lines.append(stripped)
        if sum(len(item) for item in lines) >= 160:
            break
    text = " ".join(lines).strip()
    if len(text) > 160:
        text = text[:157].rstrip() + "…"
    return text


def reading_minutes(body: str) -> int:
    words = re.findall(r"\S+", body or "")
    return max(1, round(len(words) / 200)) if words else 1


def shared_id_from_name(name: str, metadata: dict | None = None) -> str:
    return Path(name).stem


def writing_path(kind: str, lang: str, filename: str) -> Path:
    return ROOT / "content" / kind / lang / filename


def existing_writing_path(kind: str, lang: str, item_id: str) -> Path | None:
    folder = ROOT / "content" / kind / lang
    if folder.is_dir():
        for path in folder.glob("*.md"):
            metadata, _body = parse_front_matter(path.read_text(encoding="utf-8"))
            if shared_id_from_name(path.name, metadata) == item_id:
                return path
    target = writing_path(kind, lang, f"{item_id}.md")
    return target if target.exists() else None


def writing_ids_in_kind(kind: str) -> list[str]:
    seen: set[str] = set()
    ids: list[str] = []
    for lang in ("en", "tr"):
        folder = ROOT / "content" / kind / lang
        if not folder.is_dir():
            continue
        for path in folder.glob("*.md"):
            if path.name.startswith("_"):
                continue
            item_id = shared_id_from_name(path.name)
            if item_id not in seen:
                seen.add(item_id)
                ids.append(item_id)
    return ids


def move_error(from_kind: str, to_kind: str) -> str:
    if from_kind == to_kind:
        return "Source and target category are the same"
    if from_kind not in writing_kind_ids() or to_kind not in writing_kind_ids():
        return "Unknown category"
    return ""


def pair_external_url(kind: str, item_id: str) -> str:
    for lang in ("en", "tr"):
        path = existing_writing_path(kind, lang, item_id)
        if not path:
            continue
        metadata, _body = parse_front_matter(path.read_text(encoding="utf-8"))
        url = str(metadata.get("externalUrl") or "").strip()
        if url:
            return url
    return ""


def rewrite_writing_path(path: Path, dest_kind: str, external: str = "") -> None:
    metadata, body = parse_front_matter(path.read_text(encoding="utf-8"))
    path.write_text(
        build_writing_markdown(
            {
                "kind": dest_kind,
                "title": metadata.get("title") or "",
                "date": metadata.get("date") or "",
                "cover": metadata.get("cover") or "",
                "externalUrl": external if is_external_writing(dest_kind) else "",
                "body": body,
            }
        ),
        encoding="utf-8",
    )


def sync_pair_after_move(to_kind: str, item_id: str, external: str = "") -> None:
    url = external.strip() if is_external_writing(to_kind) else ""
    if is_external_writing(to_kind) and not X_URL_RE.match(url):
        raise ValueError("A valid https://x.com/… URL is required")
    for lang in ("en", "tr"):
        path = existing_writing_path(to_kind, lang, item_id)
        if path:
            rewrite_writing_path(path, to_kind, url)


def move_writings(from_kind: str, to_kind: str, item_ids: list[str], external: str = "") -> list[str]:
    preflight_move_urls(from_kind, to_kind, item_ids, external)
    plan = collect_move_plan(from_kind, to_kind, item_ids)
    moved = apply_move_plan(plan)
    try:
        for item_id in item_ids:
            url = (external or "").strip() or pair_external_url(to_kind, item_id)
            sync_pair_after_move(to_kind, item_id, url)
    except Exception:
        apply_move_plan([(dest, src) for src, dest in plan])
        raise
    return moved


def preflight_move_urls(from_kind: str, to_kind: str, item_ids: list[str], external: str = "") -> None:
    if not is_external_writing(to_kind):
        return
    for item_id in item_ids:
        url = (external or "").strip() or pair_external_url(from_kind, item_id)
        if not X_URL_RE.match(url):
            raise ValueError("Original X URL is required to move a writing to X Post")


def collect_move_plan(from_kind: str, to_kind: str, item_ids: list[str]) -> list[tuple[Path, Path]]:
    plan: list[tuple[Path, Path]] = []
    for item_id in item_ids:
        found = False
        for lang in ("en", "tr"):
            src = existing_writing_path(from_kind, lang, item_id)
            if not src:
                continue
            found = True
            dest = writing_path(to_kind, lang, src.name)
            if dest.exists():
                raise ValueError(f"{dest.relative_to(ROOT)} already exists")
            plan.append((src, dest))
        if not found:
            raise ValueError(f"Writing {item_id} was not found in {from_kind}")
    return plan


def apply_move_plan(plan: list[tuple[Path, Path]]) -> list[str]:
    moved: list[tuple[Path, Path]] = []
    try:
        for src, dest in plan:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dest))
            moved.append((src, dest))
    except Exception:
        for src, dest in reversed(moved):
            if dest.exists() and not src.exists():
                src.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(dest), str(src))
        raise
    return [str(dest.relative_to(ROOT)) for _src, dest in moved]


def remove_empty_kind_dirs(kind: str) -> None:
    kind_root = ROOT / "content" / kind
    for lang in ("en", "tr"):
        folder = kind_root / lang
        if folder.is_dir() and not any(folder.iterdir()):
            folder.rmdir()
    if kind_root.is_dir() and not any(kind_root.iterdir()):
        kind_root.rmdir()


def video_path(filename: str) -> Path:
    return ROOT / "content" / "videos" / filename


def scan_writings() -> list[dict]:
    grouped: dict[str, dict] = {}
    for kind in writing_kind_ids():
        for lang in ("en", "tr"):
            folder = ROOT / "content" / kind / lang
            if not folder.is_dir():
                continue
            for path in sorted(folder.glob("*.md")):
                if path.name.startswith("_"):
                    continue
                metadata, body = parse_front_matter(path.read_text(encoding="utf-8"))
                item_id = shared_id_from_name(path.name, metadata)
                key = f"{kind}:{item_id}"
                entry = grouped.setdefault(
                    key,
                    {
                        "id": item_id,
                        "kind": kind,
                        "languages": {},
                        "date": "",
                        "status": "published",
                    },
                )
                title = metadata.get("title") or path.stem
                date = metadata.get("date") or ""
                entry["languages"][lang] = {
                    "title": title,
                    "date": date,
                    "file": path.name,
                    "cover": metadata.get("cover") or metadata.get("image") or "",
                    "externalUrl": metadata.get("externalUrl") or "",
                    "excerpt": metadata.get("summary") or excerpt_from_body(body),
                    "readingTime": reading_minutes(body),
                    "hasCover": bool(
                        str(metadata.get("cover") or metadata.get("image") or "").strip()
                    ),
                }
                if date and (not entry["date"] or date > entry["date"]):
                    entry["date"] = date
                if "en" in entry["languages"] and "tr" in entry["languages"]:
                    entry["status"] = "published"
                elif "en" in entry["languages"]:
                    entry["status"] = "missing-tr"
                else:
                    entry["status"] = "missing-en"
    items = list(grouped.values())
    items.sort(key=lambda item: (item.get("date") or "", item["id"]), reverse=True)
    return items


def scan_videos() -> list[dict]:
    folder = ROOT / "content" / "videos"
    items = []
    if not folder.is_dir():
        return items
    for path in sorted(folder.glob("*.md")):
        if path.name.startswith("_"):
            continue
        metadata, _body = parse_front_matter(path.read_text(encoding="utf-8"))
        youtube_url = metadata.get("youtubeUrl") or ""
        youtube_id = metadata.get("youtubeId") or youtube_id_from_url(youtube_url)
        items.append(
            {
                "id": path.stem,
                "kind": "videos",
                "file": path.name,
                "title": metadata.get("title") or path.stem,
                "titleEn": metadata.get("title_en") or "",
                "titleTr": metadata.get("title_tr") or "",
                "date": metadata.get("date") or "",
                "youtubeId": youtube_id,
                "youtubeUrl": youtube_url,
                "status": "published",
            }
        )
    items.sort(key=lambda item: (item.get("date") or "", item["id"]), reverse=True)
    return items


def regenerate_writings_index() -> str:
    script = ROOT / "scripts" / "generate-writings.py"
    completed = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        err = (completed.stderr or completed.stdout or "unknown generator error").strip()
        raise RuntimeError(err)
    return (completed.stdout or "").strip()


def dump_yaml_value(value: str) -> str:
    text = str(value or "")
    if any(char in text for char in ":#{}[]&*?|>!%@`'\"\\") or text != text.strip() or " " in text:
        escaped = text.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return text or '""'


def build_writing_markdown(payload: dict) -> str:
    lines = ["---", f"title: {dump_yaml_value(payload['title'])}", f"date: {payload['date']}"]
    cover = (payload.get("cover") or "").strip()
    if cover:
        lines.append(f"cover: {dump_yaml_value(cover)}")
    if is_external_writing(payload.get("kind") or ""):
        lines.append(f"externalUrl: {dump_yaml_value(payload.get('externalUrl') or '')}")
    lines.append("---")
    body = (payload.get("body") or "").strip("\n")
    if body:
        lines.append("")
        lines.append(body)
        lines.append("")
    else:
        lines.append("")
    return "\n".join(lines)


def build_video_markdown(payload: dict) -> str:
    youtube_url = payload["youtubeUrl"].strip()
    youtube_id = youtube_id_from_url(youtube_url)
    title_en = payload["titleEn"].strip()
    title_tr = payload["titleTr"].strip()
    title = title_en or title_tr
    lines = [
        "---",
        f"title: {dump_yaml_value(title)}",
        f"title_tr: {dump_yaml_value(title_tr)}",
        f"title_en: {dump_yaml_value(title_en)}",
        f"date: {payload['date']}",
        f"youtubeId: {dump_yaml_value(youtube_id)}",
        f"youtubeUrl: {dump_yaml_value(youtube_url)}",
        "---",
        "",
    ]
    return "\n".join(lines)


def sign_session(token: str) -> str:
    digest = hmac.new(SESSION_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()
    return f"{token}.{digest}"


def verify_session(value: str) -> bool:
    if not value or "." not in value:
        return False
    token, digest = value.rsplit(".", 1)
    expected = hmac.new(SESSION_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(digest, expected):
        return False
    expires = SESSIONS.get(token)
    if not expires or expires < time.time():
        SESSIONS.pop(token, None)
        return False
    return True


def json_error(handler: SimpleHTTPRequestHandler, status: int, message: str) -> None:
    payload = json.dumps({"ok": False, "error": message}).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(payload)


def json_ok(handler: SimpleHTTPRequestHandler, data: dict, headers: dict | None = None) -> None:
    payload = json.dumps({"ok": True, **data}, ensure_ascii=False).encode("utf-8")
    handler.send_response(HTTPStatus.OK)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.send_header("Cache-Control", "no-store")
    if headers:
        for key, value in headers.items():
            handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(payload)


def read_json_body(handler: SimpleHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0 or length > MAX_BODY:
        raise ValueError("Invalid request body")
    raw = handler.rfile.read(length)
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("JSON object required")
    return data


class AdminHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

    def client_is_local(self) -> bool:
        host = self.client_address[0]
        return host in {"127.0.0.1", "::1", "localhost"}

    def session_cookie(self) -> str:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("kt_admin")
        return morsel.value if morsel else ""

    def is_authed(self) -> bool:
        return self.client_is_local() and verify_session(self.session_cookie())

    def end_headers(self) -> None:
        path = urlparse(self.path).path
        if path.endswith(".md"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
        super().end_headers()

    def cookie_header(self, token: str | None) -> str:
        if token:
            signed = sign_session(token)
            return (
                f"kt_admin={signed}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL_SEC}"
            )
        return "kt_admin=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/admin/api/"):
            return self.handle_api_get(parsed)
        if parsed.path in {"/admin", "/admin/"}:
            self.path = "/admin/index.html"
        return super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/admin/api/"):
            return self.handle_api_post(parsed)
        json_error(self, HTTPStatus.NOT_FOUND, "Not found")

    def handle_api_get(self, parsed) -> None:
        if not self.client_is_local():
            return json_error(self, HTTPStatus.FORBIDDEN, "Localhost only")
        if parsed.path == "/admin/api/session":
            return json_ok(self, {"authed": self.is_authed(), "prototype": True})
        if not self.is_authed():
            return json_error(self, HTTPStatus.UNAUTHORIZED, "Sign in with the local login code")
        if parsed.path == "/admin/api/site":
            return self.handle_site_get()
        if parsed.path == "/admin/api/writing-types":
            return json_ok(self, {"types": load_writing_types(), "icons": sorted(TYPE_ICONS)})
        if parsed.path == "/admin/api/social-platforms":
            return json_ok(self, {"platforms": load_social_platforms()})
        if parsed.path == "/admin/api/content":
            writings = scan_writings()
            videos = scan_videos()
            payload = {"types": load_writing_types(), "videos": videos}
            for kind in writing_kind_ids():
                payload[kind] = [item for item in writings if item["kind"] == kind]
            return json_ok(self, payload)
        if admin_cms.handle_cms_get(self, parsed, json_ok, json_error):
            return None
        if parsed.path == "/admin/api/item":
            query = parse_qs(parsed.query)
            kind = (query.get("kind") or [""])[0]
            item_id = (query.get("id") or [""])[0]
            if kind == VIDEO_KIND:
                path = video_path(f"{item_id}.md")
                if not path.is_file():
                    return json_error(self, HTTPStatus.NOT_FOUND, "Video not found")
                metadata, body = parse_front_matter(path.read_text(encoding="utf-8"))
                return json_ok(
                    self,
                    {
                        "kind": "videos",
                        "id": item_id,
                        "file": path.name,
                        "exists": True,
                        "video": {
                            "titleEn": metadata.get("title_en") or "",
                            "titleTr": metadata.get("title_tr") or "",
                            "date": metadata.get("date") or "",
                            "youtubeUrl": metadata.get("youtubeUrl") or "",
                            "youtubeId": metadata.get("youtubeId")
                            or youtube_id_from_url(metadata.get("youtubeUrl") or ""),
                            "body": body,
                        },
                    },
                )
            if kind not in writing_kind_ids() or not ID_RE.match(item_id):
                return json_error(self, HTTPStatus.BAD_REQUEST, "Invalid item")
            languages = {}
            for lang in ("en", "tr"):
                folder = ROOT / "content" / kind / lang
                match = None
                if folder.is_dir():
                    for path in folder.glob("*.md"):
                        metadata, body = parse_front_matter(path.read_text(encoding="utf-8"))
                        if shared_id_from_name(path.name, metadata) == item_id:
                            match = (path, metadata, body)
                            break
                if match:
                    path, metadata, body = match
                    languages[lang] = {
                        "exists": True,
                        "file": path.name,
                        "title": metadata.get("title") or "",
                        "date": metadata.get("date") or "",
                        "cover": metadata.get("cover") or metadata.get("image") or "",
                        "externalUrl": metadata.get("externalUrl") or "",
                        "body": body,
                    }
                else:
                    languages[lang] = {"exists": False, "file": f"{item_id}.md"}
            return json_ok(self, {"kind": kind, "id": item_id, "languages": languages})
        return json_error(self, HTTPStatus.NOT_FOUND, "Not found")

    def handle_cover_upload(self) -> None:
        try:
            parts = parse_multipart(self)
        except ValueError as exc:
            return json_error(self, HTTPStatus.BAD_REQUEST, str(exc))
        filename, data = parts.get("file") or ("", b"")
        if not data:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Choose an image file")
        sniffed = sniff_image_ext(data)
        original_ext = Path(filename).suffix.lower()
        if original_ext == ".jpeg":
            original_ext = ".jpg"
        if sniffed:
            ext = ".jpeg" if Path(filename).suffix.lower() == ".jpeg" and sniffed == ".jpg" else sniffed
        elif original_ext in ALLOWED_IMAGE_EXT:
            return json_error(self, HTTPStatus.BAD_REQUEST, "File is not a PNG, JPEG, or WebP image")
        else:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Only PNG, JPEG, and WebP images are accepted")
        if ext == ".jpeg":
            ext = ".jpg"
        stem = slugify(Path(filename).stem) or "cover"
        try:
            stored = unique_blog_filename(stem, ext, data)
        except RuntimeError as exc:
            return json_error(self, HTTPStatus.CONFLICT, str(exc))
        dest = BLOG_DIR / stored
        if not dest.exists():
            dest.write_bytes(data)
        return json_ok(
            self,
            {
                "filename": stored,
                "path": str(dest.relative_to(ROOT)),
            },
        )

    def sniff_logo_ext(self, data: bytes, filename: str) -> str:
        sniffed = sniff_image_ext(data)
        if sniffed:
            return sniffed
        suffix = Path(filename).suffix.lower()
        head = data[:4000].lower()
        if suffix == ".svg" and b"<svg" in head:
            if b"<script" in head or b"onload=" in head:
                return ""
            return ".svg"
        return ""

    def handle_project_logo_upload(self) -> None:
        try:
            parts = parse_multipart(self)
        except ValueError as exc:
            return json_error(self, HTTPStatus.BAD_REQUEST, str(exc))
        filename, data = parts.get("file") or ("", b"")
        if not data:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Choose an image file")
        ext = self.sniff_logo_ext(data, filename)
        if not ext:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Only PNG, JPEG, WebP, or SVG logos are accepted")
        stem = slugify(Path(filename).stem) or "logo"
        PROJECT_ASSETS = ROOT / "assets" / "images" / "projects"
        try:
            stored = unique_image_filename(PROJECT_ASSETS, stem, ext, data)
        except RuntimeError as exc:
            return json_error(self, HTTPStatus.CONFLICT, str(exc))
        dest = PROJECT_ASSETS / stored
        if not dest.exists():
            dest.write_bytes(data)
        rel = f"./assets/images/projects/{stored}"
        return json_ok(self, {"filename": stored, "path": rel, "logo": rel})

    def handle_guide_image_upload(self) -> None:
        try:
            parts = parse_multipart(self)
        except ValueError as exc:
            return json_error(self, HTTPStatus.BAD_REQUEST, str(exc))
        filename, data = parts.get("file") or ("", b"")
        guide_raw = parts.get("id") or ("", b"")
        guide_id = slugify(guide_raw[1].decode("utf-8", errors="replace") if isinstance(guide_raw[1], bytes) else str(guide_raw[1]))
        if not data:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Choose an image file")
        if not ID_RE.match(guide_id):
            return json_error(self, HTTPStatus.BAD_REQUEST, "Guide id is required before adding images")
        sniffed = sniff_image_ext(data)
        if not sniffed:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Only PNG, JPEG, or WebP images are accepted")
        folder = ROOT / "assets" / "images" / "guides" / guide_id
        stem = slugify(Path(filename).stem) or "image"
        try:
            stored = unique_image_filename(folder, stem, sniffed, data)
        except RuntimeError as exc:
            return json_error(self, HTTPStatus.CONFLICT, str(exc))
        dest = folder / stored
        if not dest.exists():
            dest.write_bytes(data)
        rel = f"./assets/images/guides/{guide_id}/{stored}"
        return json_ok(self, {"filename": stored, "path": rel, "markdown": f"![]({rel})"})

    def handle_avatar_upload(self) -> None:
        try:
            parts = parse_multipart(self)
        except ValueError as exc:
            return json_error(self, HTTPStatus.BAD_REQUEST, str(exc))
        filename, data = parts.get("file") or ("", b"")
        if not data:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Choose an image file")
        sniffed = sniff_image_ext(data)
        if not sniffed:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Only PNG, JPEG, and WebP images are accepted")
        ext = ".jpg" if sniffed == ".jpg" else sniffed
        if Path(filename).suffix.lower() == ".jpeg":
            ext = ".jpg"
        stem = slugify(Path(filename).stem) or "avatar"
        try:
            stored = unique_image_filename(PROFILE_DIR, stem, ext, data)
        except RuntimeError as exc:
            return json_error(self, HTTPStatus.CONFLICT, str(exc))
        dest = PROFILE_DIR / stored
        if not dest.exists():
            dest.write_bytes(data)
        rel = f"./assets/images/profile/{stored}"
        return json_ok(self, {"filename": stored, "path": rel, "avatar": rel})

    def handle_site_get(self) -> None:
        if not SITE_PATH.is_file():
            return json_error(self, HTTPStatus.NOT_FOUND, "config/site.json was not found")
        try:
            data = json.loads(SITE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, "config/site.json is not valid JSON")
        return json_ok(self, {"site": data})

    def handle_site_save(self, body: dict) -> None:
        if not SITE_PATH.is_file():
            return json_error(self, HTTPStatus.NOT_FOUND, "config/site.json was not found")
        try:
            data = json.loads(SITE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, "config/site.json is not valid JSON")
        if not isinstance(data, dict):
            return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, "config/site.json must be an object")

        if "displayName" in body:
            name = str(body.get("displayName") or "").strip()
            if not name:
                return json_error(self, HTTPStatus.BAD_REQUEST, "Display name is required")
            data["displayName"] = name
        if "motto" in body:
            data["motto"] = str(body.get("motto") or "").strip()
        if "email" in body:
            email = str(body.get("email") or "").strip()
            if email and not EMAIL_RE.match(email):
                return json_error(self, HTTPStatus.BAD_REQUEST, "Email looks invalid")
            data["email"] = email
        if "avatar" in body:
            avatar = str(body.get("avatar") or "").strip()
            if avatar:
                if avatar.startswith("./"):
                    rel = avatar[2:]
                elif avatar.startswith("/"):
                    rel = avatar.lstrip("/")
                else:
                    rel = avatar
                path = ROOT / rel
                if ".." in Path(rel).parts or not path.is_file():
                    return json_error(self, HTTPStatus.BAD_REQUEST, "Avatar file was not found")
                data["avatar"] = avatar if avatar.startswith("./") else f"./{rel}"
        if isinstance(body.get("whatsapp"), dict):
            current = data.get("whatsapp") if isinstance(data.get("whatsapp"), dict) else {}
            display = str(body["whatsapp"].get("display", current.get("display") or "")).strip()
            url = str(body["whatsapp"].get("url", current.get("url") or "")).strip()
            if url and not HTTPS_RE.match(url):
                return json_error(self, HTTPStatus.BAD_REQUEST, "WhatsApp URL must be https://")
            data["whatsapp"] = {**current, "display": display, "url": url}
        if isinstance(body.get("tagline"), dict):
            current = data.get("tagline") if isinstance(data.get("tagline"), dict) else {}
            data["tagline"] = {
                **current,
                **{
                    lang: str(body["tagline"].get(lang, current.get(lang) or "")).strip()
                    for lang in ("en", "tr")
                    if lang in body["tagline"]
                },
            }
        if isinstance(body.get("location"), dict):
            admin_cms.apply_location(data, body["location"])
        if isinstance(body.get("social"), list):
            existing_items = data.get("social") if isinstance(data.get("social"), list) else []
            by_id = {
                str(item.get("id")): item
                for item in existing_items
                if isinstance(item, dict) and item.get("id")
            }
            rebuilt: list[dict] = []
            seen: set[str] = set()
            for raw in body["social"]:
                if not isinstance(raw, dict):
                    continue
                sid = str(raw.get("id") or "").strip()
                url = str(raw.get("url") or "").strip()
                if not sid:
                    return json_error(self, HTTPStatus.BAD_REQUEST, "Each social link needs an id")
                if sid in seen:
                    return json_error(self, HTTPStatus.BAD_REQUEST, "Duplicate social link")
                seen.add(sid)
                if not url:
                    return json_error(self, HTTPStatus.BAD_REQUEST, f"{sid} URL is required")
                platform = str(raw.get("platform") or sid).strip()
                rule = SOCIAL_URL_RE.get(platform) or SOCIAL_URL_RE.get(sid) or HTTPS_RE
                if not rule.match(url):
                    return json_error(self, HTTPStatus.BAD_REQUEST, f"{sid} URL is not valid")
                prev = by_id.get(sid) if isinstance(by_id.get(sid), dict) else {}
                merged = dict(prev)
                merged["id"] = sid
                merged["url"] = url
                if raw.get("icon"):
                    merged["icon"] = str(raw.get("icon"))
                elif not merged.get("icon"):
                    merged["icon"] = "link-outline"
                if "label" in raw:
                    merged["label"] = raw["label"]
                if raw.get("platform"):
                    merged["platform"] = platform
                rebuilt.append(merged)
            data["social"] = rebuilt

        SITE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return json_ok(self, {"site": data, "path": "config/site.json"})

    def handle_api_post(self, parsed) -> None:
        if not self.client_is_local():
            return json_error(self, HTTPStatus.FORBIDDEN, "Localhost only")

        if parsed.path == "/admin/api/cover":
            if not self.is_authed():
                return json_error(self, HTTPStatus.UNAUTHORIZED, "Sign in with the local login code")
            return self.handle_cover_upload()
        if parsed.path == "/admin/api/avatar":
            if not self.is_authed():
                return json_error(self, HTTPStatus.UNAUTHORIZED, "Sign in with the local login code")
            return self.handle_avatar_upload()
        if parsed.path == "/admin/api/project-logo":
            if not self.is_authed():
                return json_error(self, HTTPStatus.UNAUTHORIZED, "Sign in with the local login code")
            return self.handle_project_logo_upload()
        if parsed.path == "/admin/api/guide-image":
            if not self.is_authed():
                return json_error(self, HTTPStatus.UNAUTHORIZED, "Sign in with the local login code")
            return self.handle_guide_image_upload()

        try:
            body = read_json_body(self)
        except Exception:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Invalid JSON")

        if parsed.path == "/admin/api/login":
            code = str(body.get("code") or "").strip().lower()
            if not code or not hmac.compare_digest(code, LOGIN_CODE):
                time.sleep(0.4)
                return json_error(self, HTTPStatus.UNAUTHORIZED, "Wrong local login code")
            token = secrets.token_hex(16)
            SESSIONS[token] = time.time() + SESSION_TTL_SEC
            return json_ok(
                self,
                {"authed": True},
                {"Set-Cookie": self.cookie_header(token)},
            )

        if parsed.path == "/admin/api/logout":
            cookie = self.session_cookie()
            if cookie and "." in cookie:
                SESSIONS.pop(cookie.split(".", 1)[0], None)
            return json_ok(self, {"authed": False}, {"Set-Cookie": self.cookie_header(None)})

        if not self.is_authed():
            return json_error(self, HTTPStatus.UNAUTHORIZED, "Sign in with the local login code")

        if parsed.path == "/admin/api/save":
            return self.handle_save(body)
        if parsed.path == "/admin/api/site":
            return self.handle_site_save(body)
        if parsed.path == "/admin/api/writing-types":
            return self.handle_writing_types_save(body)
        if parsed.path == "/admin/api/move-writing":
            return self.handle_move_writing(body)
        if admin_cms.handle_cms_post(self, parsed, body, json_ok, json_error):
            return None
        return json_error(self, HTTPStatus.NOT_FOUND, "Not found")

    def handle_move_writing(self, body: dict) -> None:
        from_kind = str(body.get("fromKind") or "").strip()
        to_kind = str(body.get("toKind") or "").strip()
        item_id = str(body.get("id") or "").strip()
        if not item_id or not ID_RE.match(item_id):
            return json_error(self, HTTPStatus.BAD_REQUEST, "Invalid shared content ID")
        err = move_error(from_kind, to_kind)
        if err:
            return json_error(self, HTTPStatus.BAD_REQUEST, err)
        try:
            moved = move_writings(from_kind, to_kind, [item_id])
        except ValueError as exc:
            return json_error(self, HTTPStatus.CONFLICT, str(exc))
        except OSError as exc:
            return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, f"Could not move writing: {exc}")
        try:
            generator_log = regenerate_writings_index()
        except RuntimeError as exc:
            return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, f"Writing was moved, but regenerating content/index.json failed: {exc}")
        return json_ok(self, {"id": item_id, "fromKind": from_kind, "toKind": to_kind, "moved": moved, "generator": generator_log})

    def handle_writing_types_save(self, body: dict) -> None:
        action = str(body.get("action") or "").strip()
        types = load_writing_types()
        by_id = {str(item.get("id") or ""): item for item in types}

        if action == "create":
            label = body.get("label") if isinstance(body.get("label"), dict) else {}
            en = str(label.get("en") or body.get("labelEn") or "").strip()
            tr = str(label.get("tr") or body.get("labelTr") or "").strip()
            if not en or not tr:
                return json_error(self, HTTPStatus.BAD_REQUEST, "English name and Turkish name are required")
            type_id = slugify(en)
            if not type_id or not ID_RE.match(type_id):
                return json_error(self, HTTPStatus.BAD_REQUEST, "Could not derive a type id from the English name")
            if type_id in RESERVED_TYPE_IDS or type_id in by_id:
                return json_error(self, HTTPStatus.CONFLICT, "That type already exists or is reserved")
            icon = str(body.get("icon") or "document-text-outline").strip()
            if icon not in TYPE_ICONS:
                icon = "document-text-outline"
            types.append(
                {
                    "id": type_id,
                    "core": False,
                    "mode": "internal",
                    "icon": icon,
                    "label": {"en": en, "tr": tr},
                    "filter": {"en": en, "tr": tr},
                }
            )
            save_writing_types(types)
            try:
                generator_log = regenerate_writings_index()
            except RuntimeError as exc:
                return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, f"Type was saved, but regenerating content/index.json failed: {exc}")
            return json_ok(self, {"types": load_writing_types(), "id": type_id, "generator": generator_log})

        type_id = str(body.get("id") or "").strip()
        current = by_id.get(type_id)
        if not current:
            return json_error(self, HTTPStatus.NOT_FOUND, "Unknown writing type")

        if action == "update":
            label = body.get("label") if isinstance(body.get("label"), dict) else {}
            en = str(label.get("en") or current.get("label", {}).get("en") or "").strip()
            tr = str(label.get("tr") or current.get("label", {}).get("tr") or "").strip()
            if not en or not tr:
                return json_error(self, HTTPStatus.BAD_REQUEST, "English name and Turkish name are required")
            current["label"] = {"en": en, "tr": tr}
            core = bool(current.get("core") or type_id in CORE_TYPE_IDS)
            if not core:
                icon = str(body.get("icon") or current.get("icon") or "document-text-outline").strip()
                if icon not in TYPE_ICONS:
                    icon = current.get("icon") or "document-text-outline"
                current["icon"] = icon
                current["filter"] = {
                    "en": str((body.get("filter") or {}).get("en") or current.get("filter", {}).get("en") or en),
                    "tr": str((body.get("filter") or {}).get("tr") or current.get("filter", {}).get("tr") or tr),
                }
            save_writing_types(types)
            try:
                generator_log = regenerate_writings_index()
            except RuntimeError as exc:
                return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, f"Type was saved, but regenerating content/index.json failed: {exc}")
            return json_ok(self, {"types": load_writing_types(), "id": type_id, "generator": generator_log})

        if action == "delete":
            if current.get("core") or type_id in CORE_TYPE_IDS:
                return json_error(self, HTTPStatus.FORBIDDEN, "Core writing types cannot be deleted")
            ids = writing_ids_in_kind(type_id)
            if ids:
                move_to = str(body.get("moveTo") or "").strip()
                if not move_to:
                    return json_error(
                        self,
                        HTTPStatus.CONFLICT,
                        f"This category contains {len(ids)} writings.",
                    )
                err = move_error(type_id, move_to)
                if err:
                    return json_error(self, HTTPStatus.BAD_REQUEST, err)
                try:
                    move_writings(type_id, move_to, ids)
                except ValueError as exc:
                    return json_error(self, HTTPStatus.CONFLICT, str(exc))
                except OSError as exc:
                    return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, f"Could not move writings: {exc}")
            save_writing_types([item for item in types if str(item.get("id") or "") != type_id])
            remove_empty_kind_dirs(type_id)
            try:
                generator_log = regenerate_writings_index()
            except RuntimeError as exc:
                return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, f"Type was removed, but regenerating content/index.json failed: {exc}")
            return json_ok(
                self,
                {
                    "types": load_writing_types(),
                    "id": type_id,
                    "moved": len(ids),
                    "generator": generator_log,
                },
            )

        return json_error(self, HTTPStatus.BAD_REQUEST, "Unknown writing type action")

    def delete_writing(self, body: dict) -> None:
        kind = str(body.get("kind") or "")
        item_id = str(body.get("id") or "").strip()
        if kind not in writing_kind_ids():
            return json_error(self, HTTPStatus.BAD_REQUEST, "Unknown type")
        if not item_id or not ID_RE.match(item_id):
            return json_error(self, HTTPStatus.BAD_REQUEST, "Invalid shared content ID")
        deleted = []
        for lang in ("en", "tr"):
            path = writing_path(kind, lang, f"{item_id}.md")
            resolved = path.resolve()
            root = (ROOT / "content" / kind / lang).resolve()
            if root not in resolved.parents and resolved.parent != root:
                return json_error(self, HTTPStatus.BAD_REQUEST, "Invalid path")
            if path.is_file():
                path.unlink()
                deleted.append(str(path.relative_to(ROOT)))
        if not deleted:
            return json_error(self, HTTPStatus.NOT_FOUND, "Writing not found")
        try:
            generator_log = regenerate_writings_index()
        except RuntimeError as exc:
            return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        return json_ok(self, {"id": item_id, "deleted": deleted, "generator": generator_log})

    def delete_video(self, body: dict) -> None:
        item_id = str(body.get("id") or "").strip()
        if not item_id or not ID_RE.match(item_id):
            return json_error(self, HTTPStatus.BAD_REQUEST, "Invalid id")
        path = video_path(f"{item_id}.md")
        if not path.is_file():
            return json_error(self, HTTPStatus.NOT_FOUND, "Video not found")
        path.unlink()
        try:
            generator_log = regenerate_writings_index()
        except RuntimeError as exc:
            return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        return json_ok(self, {"id": item_id, "generator": generator_log})

    def handle_save(self, body: dict) -> None:
        if str(body.get("action") or "") == "delete":
            kind = str(body.get("kind") or "")
            if kind == VIDEO_KIND:
                return self.delete_video(body)
            return self.delete_writing(body)
        kind = str(body.get("kind") or "")
        if kind == VIDEO_KIND:
            return self.save_video(body)
        if kind not in writing_kind_ids():
            return json_error(self, HTTPStatus.BAD_REQUEST, "Unknown type")

        lang = str(body.get("lang") or "")
        if lang not in {"en", "tr"}:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Language must be en or tr")
        title = str(body.get("title") or "").strip()
        date = normalize_date(str(body.get("date") or ""))
        cover = str(body.get("cover") or "").strip()
        content = str(body.get("body") or "")
        external = str(body.get("externalUrl") or "").strip()
        item_id = str(body.get("id") or "").strip()
        if item_id:
            if not ID_RE.match(item_id):
                return json_error(self, HTTPStatus.BAD_REQUEST, "Invalid shared content ID")
        else:
            item_id = slugify(title)
        if not title:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Title is required")
        if not date:
            return json_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "Date must be YYYY-MM-DD or DD.MM.YYYY (day.month.year)",
            )
        if not item_id or not ID_RE.match(item_id):
            return json_error(self, HTTPStatus.BAD_REQUEST, "Could not derive a content ID from the title")
        if is_external_writing(kind) and not X_URL_RE.match(external):
            return json_error(self, HTTPStatus.BAD_REQUEST, "A valid https://x.com/… URL is required")
        if cover and ("/" in cover or "\\" in cover or ".." in cover):
            return json_error(self, HTTPStatus.BAD_REQUEST, "Cover must be a file name, not a path")
        if cover:
            cover_path = BLOG_DIR / cover
            if not cover_path.is_file():
                return json_error(
                    self,
                    HTTPStatus.BAD_REQUEST,
                    "Cover image is not in assets/images/blog/. Choose the image again so it can be copied locally.",
                )

        filename = f"{item_id}.md"
        from_kind = str(body.get("fromKind") or kind).strip()
        if from_kind and from_kind != kind:
            err = move_error(from_kind, kind)
            if err:
                return json_error(self, HTTPStatus.BAD_REQUEST, err)
            try:
                move_writings(from_kind, kind, [item_id], external)
            except ValueError as exc:
                return json_error(self, HTTPStatus.CONFLICT, str(exc))
            except OSError as exc:
                return json_error(self, HTTPStatus.INTERNAL_SERVER_ERROR, f"Could not move writing: {exc}")
        existing = existing_writing_path(kind, lang, item_id)
        if existing and existing.name != filename:
            return json_error(
                self,
                HTTPStatus.CONFLICT,
                f"{existing.relative_to(ROOT)} already exists for this language.",
            )
        path = writing_path(kind, lang, filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        markdown = build_writing_markdown(
            {
                "kind": kind,
                "title": title,
                "date": date,
                "cover": cover,
                "externalUrl": external,
                "body": content,
            }
        )
        path.write_text(markdown, encoding="utf-8")
        other = "tr" if lang == "en" else "en"
        sibling = existing_writing_path(kind, other, item_id)
        if sibling:
            rewrite_writing_path(sibling, kind, external if is_external_writing(kind) else "")
        try:
            generator_log = regenerate_writings_index()
        except RuntimeError as exc:
            return json_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                f"Markdown was written to {path.relative_to(ROOT)}, but regenerating content/index.json failed: {exc}",
            )
        return json_ok(
            self,
            {
                "path": str(path.relative_to(ROOT)),
                "id": item_id,
                "lang": lang,
                "markdown": markdown,
                "manifest": True,
                "generator": generator_log,
            },
        )

    def save_video(self, body: dict) -> None:
        title_en = str(body.get("titleEn") or "").strip()
        title_tr = str(body.get("titleTr") or "").strip()
        date = normalize_date(str(body.get("date") or ""))
        youtube_url = str(body.get("youtubeUrl") or "").strip()
        youtube_id = youtube_id_from_url(youtube_url)
        item_id = slugify(str(body.get("id") or title_en or title_tr))
        if not youtube_id:
            return json_error(self, HTTPStatus.BAD_REQUEST, "A valid YouTube URL is required")
        if not title_en or not title_tr:
            return json_error(self, HTTPStatus.BAD_REQUEST, "Title EN and Title TR are required")
        if not date:
            return json_error(
                self,
                HTTPStatus.BAD_REQUEST,
                "Date must be YYYY-MM-DD or DD.MM.YYYY (day.month.year)",
            )
        if not item_id or not ID_RE.match(item_id):
            return json_error(self, HTTPStatus.BAD_REQUEST, "Could not derive a filename from the title")
        filename = f"{item_id}.md"
        path = video_path(filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            return json_error(
                self,
                HTTPStatus.CONFLICT,
                f"{path.relative_to(ROOT)} already exists. This prototype will not overwrite files.",
            )
        markdown = build_video_markdown(
            {
                "titleEn": title_en,
                "titleTr": title_tr,
                "date": date,
                "youtubeUrl": youtube_url,
            }
        )
        path.write_text(markdown, encoding="utf-8")
        try:
            generator_log = regenerate_writings_index()
        except RuntimeError as exc:
            return json_error(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                f"Markdown was written to {path.relative_to(ROOT)}, but regenerating content/index.json failed: {exc}",
            )
        return json_ok(
            self,
            {
                "path": str(path.relative_to(ROOT)),
                "id": item_id,
                "youtubeId": youtube_id,
                "markdown": markdown,
                "manifest": True,
                "generator": generator_log,
            },
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Local KolTigin admin prototype")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")))
    args = parser.parse_args()
    CODE_FILE.write_text(LOGIN_CODE + "\n", encoding="utf-8")

    banner = [
        "",
        "KolTigin admin prototype — LOCAL ONLY",
        f"Open  http://127.0.0.1:{args.port}/admin/",
        f"Login code:  {LOGIN_CODE}",
        "This is not production authentication. Bound to 127.0.0.1 only.",
        "Public site remains at /  — admin CSS/JS is isolated under /admin/.",
        "",
    ]
    sys.stderr.write("\n".join(banner) + "\n")

    server = ThreadingHTTPServer((HOST, args.port), AdminHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.stderr.write("\nStopped.\n")
    finally:
        if CODE_FILE.exists():
            CODE_FILE.unlink()


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
