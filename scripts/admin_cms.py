"""Local CMS helpers for the KolTigin admin prototype. Path-safe writes only."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
ABOUT_ROOT = ROOT / "content" / "about"
RESUME_ROOT = ROOT / "content" / "resume"
PROJECTS_ROOT = ROOT / "content" / "projects"
GUIDES_ROOT = ROOT / "guides"
PROJECT_CATS_PATH = ROOT / "config" / "project-categories.json"
SITE_PATH = ROOT / "config" / "site.json"
I18N_DIR = ROOT / "i18n"
PROJECT_ASSETS = ROOT / "assets" / "images" / "projects"
GUIDE_ASSETS = ROOT / "assets" / "images" / "guides"
PAGE_FAMILIES = {"about": ABOUT_ROOT, "resume": RESUME_ROOT}
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HTTPS_RE = re.compile(r"^https://[^\s]+$", re.IGNORECASE)
CONTACT_I18N_KEYS = {
    "title",
    "formTitle",
    "labelName",
    "labelEmail",
    "labelMessage",
    "placeholderName",
    "placeholderEmail",
    "placeholderMessage",
    "submit",
    "submitting",
    "success",
    "error",
    "mapTitle",
}

try:
    import yaml
except ImportError:
    yaml = None


def safe_under(root: Path, *parts: str) -> Path:
    base = root.resolve()
    candidate = root.joinpath(*parts).resolve()
    candidate.relative_to(base)
    return candidate


def slugify(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:72]


def load_project_categories() -> list[dict]:
    data = json.loads(PROJECT_CATS_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("project-categories.json must be an array")
    return data


def category_by_id(cid: str) -> dict | None:
    for item in load_project_categories():
        if str(item.get("id") or "") == cid:
            return item
    return None


def regenerate_projects() -> str:
    script = ROOT / "scripts" / "generate-projects.py"
    completed = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        err = (completed.stderr or completed.stdout or "generator error").strip()
        raise RuntimeError(err)
    return (completed.stdout or "").strip()


def dump_project_yaml(data: dict) -> str:
    if yaml is None:
        raise RuntimeError("PyYAML is required")
    return yaml.safe_dump(
        data,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
        width=1000,
    ).strip() + "\n"


def parse_project_file(path: Path) -> dict:
    if yaml is None:
        raise RuntimeError("PyYAML is required")
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("---"):
        raise ValueError("missing YAML front matter")
    parts = raw.split("---", 2)
    data = yaml.safe_load(parts[1]) or {}
    if not isinstance(data, dict):
        raise ValueError("front matter must be a mapping")
    return data


def project_path(category: dict, slug: str) -> Path:
    return safe_under(PROJECTS_ROOT, str(category["folder"]), f"{slug}.md")


def list_project_records() -> list[dict]:
    cats = load_project_categories()
    by_id = {str(item.get("id")): item for item in cats}
    records = []
    if not PROJECTS_ROOT.is_dir():
        return records
    for path in sorted(PROJECTS_ROOT.rglob("*.md")):
        if path.name.startswith("_"):
            continue
        try:
            data = parse_project_file(path)
        except Exception:
            continue
        cid = str(data.get("category") or "")
        cat = by_id.get(cid) or {}
        records.append(
            {
                "id": str(data.get("id") or path.stem),
                "slug": path.stem,
                "name": data.get("name") or path.stem,
                "category": cid,
                "categoryFolder": cat.get("folder") or path.parent.name,
                "status": data.get("status") or "",
                "role": data.get("role"),
                "logo": data.get("logo") or "",
                "summary": data.get("summary") or {},
                "links": data.get("links") or [],
                "referral_url": data.get("referral_url") or data.get("referralUrl") or "",
                "referral_code": data.get("referral_code") or data.get("referralCode") or "",
                "former_name": data.get("former_name") or data.get("formerName") or "",
                "path": str(path.relative_to(ROOT)),
            }
        )
    return records


def write_guides_index() -> None:
    ids = []
    if GUIDES_ROOT.is_dir():
        for folder in sorted(GUIDES_ROOT.iterdir()):
            if not folder.is_dir() or folder.name in {"en", "tr"} or not ID_RE.match(folder.name):
                continue
            if not (folder / "EN.md").is_file() and not (folder / "TR.md").is_file():
                continue
            ids.append(folder.name)
    (GUIDES_ROOT / "index.json").write_text(
        json.dumps({"guides": ids}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def first_heading(markdown: str) -> str:
    text = markdown or ""
    if text.startswith("---"):
        close = text.find("\n---", 3)
        if close != -1:
            text = text[close + 4 :]
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def markdown_has_content(markdown: str) -> bool:
    text = (markdown or "").replace("\r\n", "\n")
    if text.startswith("---"):
        close = text.find("\n---", 3)
        if close != -1:
            text = text[close + 4 :]
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if not lines:
        return False
    if all(re.fullmatch(r"#\s*", line) for line in lines):
        return False
    return True


def cms_locale_saves(body: dict) -> list[dict]:
    raw = body.get("locales")
    items = raw if isinstance(raw, list) and raw else [{"lang": body.get("lang"), "markdown": body.get("markdown")}]
    seen: set[str] = set()
    out: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        lang = str(item.get("lang") or "").strip()
        if lang not in {"en", "tr"}:
            raise ValueError("Language must be en or tr")
        if lang in seen:
            continue
        markdown = "" if item.get("markdown") is None else str(item.get("markdown"))
        if not markdown_has_content(markdown):
            continue
        seen.add(lang)
        out.append({"lang": lang, "markdown": markdown})
    return out


def parse_simple_front_matter(text: str) -> tuple[dict, str]:
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
        value = value.strip().strip('"').strip("'")
        if key:
            meta[key] = value
    return meta, raw[close + 4 :].lstrip("\n")


def apply_guide_cover(text: str, cover) -> str:
    if cover is None:
        return text or ""
    raw = (text or "").replace("\r\n", "\n")
    value = str(cover).strip()
    if not raw.startswith("---"):
        if not value:
            return raw
        body = raw.lstrip("\n")
        return f"---\ncover: {value}\n---\n\n{body}"
    if not value:
        return re.sub(r"^\s*cover:\s*.*$", "", raw, count=1, flags=re.M).replace("\n\n\n", "\n\n")
    if re.search(r"^cover:\s*.*$", raw, flags=re.M):
        return re.sub(r"^cover:\s*.*$", f"cover: {value}", raw, count=1, flags=re.M)
    return raw.replace("---\n", f"---\ncover: {value}\n", 1)


def guide_cover_from_markdown(*texts: str) -> str:
    for text in texts:
        meta, _body = parse_simple_front_matter(text)
        cover = str(meta.get("cover") or meta.get("image") or "").strip()
        if cover:
            return cover
    return ""


def regenerate_share() -> str:
    script = ROOT / "scripts" / "generate-share.py"
    completed = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        err = (completed.stderr or completed.stdout or "share generator error").strip()
        raise RuntimeError(err)
    return (completed.stdout or "").strip()


def list_guides() -> list[dict]:
    projects = list_project_records()
    guides = []
    if not GUIDES_ROOT.is_dir():
        return guides
    for folder in sorted(GUIDES_ROOT.iterdir()):
        if not folder.is_dir() or folder.name in {"en", "tr"} or not ID_RE.match(folder.name):
            continue
        en = folder / "EN.md"
        tr = folder / "TR.md"
        en_text = en.read_text(encoding="utf-8") if en.is_file() else ""
        tr_text = tr.read_text(encoding="utf-8") if tr.is_file() else ""
        if not en.is_file() and not tr.is_file():
            continue
        related = [
            {"id": item["id"], "name": item["name"]}
            for item in projects
            if any(
                isinstance(link, dict) and str(link.get("guide") or "") == folder.name
                for link in (item.get("links") or [])
            )
        ]
        guides.append(
            {
                "id": folder.name,
                "titleEn": first_heading(en_text) or folder.name,
                "titleTr": first_heading(tr_text) or folder.name,
                "existsEn": en.is_file(),
                "existsTr": tr.is_file(),
                "cover": guide_cover_from_markdown(en_text, tr_text),
                "projects": related,
            }
        )
    return guides


def _is_project_guide_link(link: dict, guide_id: str) -> bool:
    if str(link.get("guide") or "") == guide_id:
        return True
    url = str(link.get("url") or "")
    if url == f"#/guides/{guide_id}" or url.endswith(f"#/guides/{guide_id}"):
        return True
    return f"/guide/en/{guide_id}" in url or f"/guide/tr/{guide_id}" in url


def strip_guide_from_projects(guide_id: str) -> list[str]:
    changed = []
    for path in PROJECTS_ROOT.rglob("*.md"):
        if path.name.startswith("_"):
            continue
        try:
            data = parse_project_file(path)
        except Exception:
            continue
        links = data.get("links")
        if not isinstance(links, list):
            continue
        next_links = []
        dirty = False
        for link in links:
            if isinstance(link, dict) and _is_project_guide_link(link, guide_id):
                dirty = True
                continue
            next_links.append(link)
        if not dirty:
            continue
        if next_links:
            data["links"] = next_links
        else:
            data.pop("links", None)
        path.write_text("---\n" + dump_project_yaml(data) + "---\n", encoding="utf-8")
        changed.append(str(path.relative_to(ROOT)))
    return changed


def attach_guide_to_project(project_id: str, guide_id: str) -> None:
    records = [item for item in list_project_records() if item["id"] == project_id]
    if not records:
        raise ValueError("Unknown project")
    rec = records[0]
    path = ROOT / rec["path"]
    data = parse_project_file(path)
    links = list(data.get("links") or [])
    if any(isinstance(link, dict) and str(link.get("guide") or "") == guide_id for link in links):
        return
    links.append({"label": "Setup Guide", "guide": guide_id})
    data["links"] = links
    path.write_text("---\n" + dump_project_yaml(data) + "---\n", encoding="utf-8")


def set_project_guide(project_id: str, guide_id: str | None) -> None:
    if guide_id:
        strip_guide_from_projects(guide_id)
        attach_guide_to_project(project_id, guide_id)
        return
    strip_guide_from_projects(guide_id or "")


def map_embed_url(query: str, lang: str = "en") -> str:
    q = quote(query)
    hl = "tr" if lang == "tr" else "en"
    return f"https://maps.google.com/maps?q={q}&z=12&hl={hl}&output=embed"


def apply_location(site: dict, incoming: dict) -> None:
    current = site.get("location") if isinstance(site.get("location"), dict) else {}
    city = str(incoming.get("city", current.get("city") or "")).strip()
    country = str(incoming.get("country", current.get("country") or "")).strip()
    if not city and not country:
        sample = str(incoming.get("en") or current.get("en") or incoming.get("tr") or current.get("tr") or "")
        if "," in sample:
            city, country = [part.strip() for part in sample.split(",", 1)]
        elif sample:
            city = sample
    label = ", ".join(part for part in (city, country) if part)
    loc = {**current, "city": city, "country": country}
    loc["en"] = str(incoming.get("en") or loc.get("en") or label).strip() or label
    loc["tr"] = str(incoming.get("tr") or loc.get("tr") or label).strip() or label
    loc["mapQuery"] = label
    site["location"] = loc
    contact = site.get("contact") if isinstance(site.get("contact"), dict) else {}
    if label:
        contact["mapEmbedUrl"] = map_embed_url(label, "en")
    site["contact"] = contact


def write_contact_i18n(lang: str, fields: dict) -> None:
    if lang not in {"en", "tr"}:
        raise ValueError("Language must be en or tr")
    path = I18N_DIR / f"{lang}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    contact = data.get("contact") if isinstance(data.get("contact"), dict) else {}
    for key, value in fields.items():
        if key not in CONTACT_I18N_KEYS:
            continue
        contact[key] = str(value or "").strip()
    data["contact"] = contact
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def handle_cms_get(handler, parsed, json_ok, json_error) -> bool:
    path = parsed.path
    if path == "/admin/api/page":
        from urllib.parse import parse_qs

        query = parse_qs(parsed.query)
        family = (query.get("family") or [""])[0]
        lang = (query.get("lang") or [""])[0]
        if family not in PAGE_FAMILIES or lang not in {"en", "tr"}:
            json_error(handler, HTTPStatus.BAD_REQUEST, "Unknown page")
            return True
        file_path = safe_under(PAGE_FAMILIES[family], f"{lang}.md")
        if not file_path.is_file():
            json_error(handler, HTTPStatus.NOT_FOUND, "Page not found")
            return True
        json_ok(handler, {"family": family, "lang": lang, "markdown": file_path.read_text(encoding="utf-8")})
        return True
    if path == "/admin/api/projects":
        json_ok(
            handler,
            {
                "categories": load_project_categories(),
                "projects": list_project_records(),
            },
        )
        return True
    if path == "/admin/api/project":
        from urllib.parse import parse_qs

        query = parse_qs(parsed.query)
        item_id = (query.get("id") or [""])[0]
        rec = next((item for item in list_project_records() if item["id"] == item_id), None)
        if not rec:
            json_error(handler, HTTPStatus.NOT_FOUND, "Project not found")
            return True
        json_ok(handler, {"project": rec})
        return True
    if path == "/admin/api/guides":
        json_ok(handler, {"guides": list_guides(), "projects": list_project_records()})
        return True
    if path == "/admin/api/guide":
        from urllib.parse import parse_qs

        query = parse_qs(parsed.query)
        item_id = (query.get("id") or [""])[0]
        if not ID_RE.match(item_id):
            json_error(handler, HTTPStatus.BAD_REQUEST, "Invalid guide id")
            return True
        folder = safe_under(GUIDES_ROOT, item_id)
        en = folder / "EN.md"
        tr = folder / "TR.md"
        rec = next((item for item in list_guides() if item["id"] == item_id), None)
        json_ok(
            handler,
            {
                "id": item_id,
                "exists": bool(en.is_file() or tr.is_file()),
                "en": en.read_text(encoding="utf-8") if en.is_file() else "",
                "tr": tr.read_text(encoding="utf-8") if tr.is_file() else "",
                "meta": rec or {},
            },
        )
        return True
    if path == "/admin/api/contact":
        site = json.loads(SITE_PATH.read_text(encoding="utf-8"))
        i18n = {}
        for lang in ("en", "tr"):
            data = json.loads((I18N_DIR / f"{lang}.json").read_text(encoding="utf-8"))
            contact = data.get("contact") if isinstance(data.get("contact"), dict) else {}
            i18n[lang] = {key: contact.get(key, "") for key in CONTACT_I18N_KEYS}
        json_ok(handler, {"site": site, "i18n": i18n, "keys": sorted(CONTACT_I18N_KEYS)})
        return True
    return False


def handle_page_save(handler, body, json_ok, json_error) -> None:
    family = str(body.get("family") or "")
    if family not in PAGE_FAMILIES:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Unknown page")
    try:
        locales = cms_locale_saves(body)
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))
    if not locales:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Markdown is required")
    langs = []
    first_path = None
    for item in locales:
        path = safe_under(PAGE_FAMILIES[family], f"{item['lang']}.md")
        markdown = item["markdown"]
        path.write_text(markdown if markdown.endswith("\n") else markdown + "\n", encoding="utf-8")
        langs.append(item["lang"])
        if first_path is None:
            first_path = path
    return json_ok(
        handler,
        {
            "path": str(first_path.relative_to(ROOT)),
            "family": family,
            "lang": langs[0],
            "langs": langs,
        },
    )


def handle_project_save(handler, body, json_ok, json_error) -> None:
    if str(body.get("action") or "") == "delete":
        item_id = slugify(str(body.get("id") or ""))
        if not ID_RE.match(item_id):
            return json_error(handler, HTTPStatus.BAD_REQUEST, "Invalid project id")
        rec = next((item for item in list_project_records() if item.get("id") == item_id), None)
        if not rec:
            return json_error(handler, HTTPStatus.NOT_FOUND, "Project not found")
        cat = category_by_id(rec["category"])
        if not cat:
            return json_error(handler, HTTPStatus.NOT_FOUND, "Project not found")
        path = project_path(cat, rec.get("slug") or item_id)
        if not path.is_file():
            return json_error(handler, HTTPStatus.NOT_FOUND, "Project not found")
        path.unlink()
        try:
            log = regenerate_projects()
        except RuntimeError as exc:
            return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        return json_ok(handler, {"id": item_id, "generator": log})
    name = str(body.get("name") or "").strip()
    category = str(body.get("category") or "").strip()
    status = str(body.get("status") or "").strip()
    item_id = slugify(str(body.get("id") or name))
    from_category = str(body.get("fromCategory") or category).strip()
    slug = slugify(str(body.get("slug") or item_id))
    if not name:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Project name is required")
    if status not in {"active", "completed", "built"}:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Status must be active, completed, or built")
    cat = category_by_id(category)
    if not cat:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Unknown project category")
    if not item_id or not ID_RE.match(item_id) or not slug or not ID_RE.match(slug):
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Could not derive a project id")
    dest = project_path(cat, slug)
    from_cat = category_by_id(from_category) if from_category else cat
    src = project_path(from_cat, slug) if from_cat else dest
    if src != dest:
        if dest.exists():
            return json_error(handler, HTTPStatus.CONFLICT, f"{dest.relative_to(ROOT)} already exists")
        if src.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dest))
        elif dest.exists():
            pass
    data = {
        "name": name,
        "category": category,
        "status": status,
        "id": item_id,
    }
    role = body.get("role")
    if isinstance(role, dict):
        cleaned = {lang: str(role.get(lang) or "").strip() for lang in ("en", "tr") if str(role.get(lang) or "").strip()}
        if cleaned:
            data["role"] = cleaned if len(cleaned) > 1 else next(iter(cleaned.values()))
    elif isinstance(role, str) and role.strip():
        data["role"] = role.strip()
    former = str(body.get("former_name") or body.get("formerName") or "").strip()
    if former:
        data["former_name"] = former
    logo = str(body.get("logo") or "").strip()
    if logo:
        data["logo"] = logo
    summary = body.get("summary") if isinstance(body.get("summary"), dict) else {}
    en_sum = str(summary.get("en") or "").strip()
    tr_sum = str(summary.get("tr") or "").strip()
    if en_sum or tr_sum:
        if not en_sum or not tr_sum:
            return json_error(handler, HTTPStatus.BAD_REQUEST, "Summary needs both English and Turkish")
        data["summary"] = {"en": en_sum, "tr": tr_sum}
    links_in = body.get("links") if isinstance(body.get("links"), list) else []
    links = []
    for index, raw in enumerate(links_in):
        if not isinstance(raw, dict):
            continue
        url = str(raw.get("url") or "").strip()
        if not url:
            return json_error(handler, HTTPStatus.BAD_REQUEST, f"Link {index + 1} needs a URL")
        if not (
            url.startswith(("http://", "https://", "./", "../", "#", "mailto:", "/"))
        ):
            return json_error(handler, HTTPStatus.BAD_REQUEST, f"Link {index + 1} URL is not allowed")
        label = raw.get("label")
        if isinstance(label, dict):
            label_en = str(label.get("en") or "").strip()
            label_tr = str(label.get("tr") or "").strip()
            if not label_en:
                return json_error(handler, HTTPStatus.BAD_REQUEST, f"Link {index + 1} needs an English label")
            stored_label = {"en": label_en, "tr": label_tr or label_en}
        else:
            stored_label = str(label or "").strip()
            if not stored_label:
                return json_error(handler, HTTPStatus.BAD_REQUEST, f"Link {index + 1} needs a label")
        link = {"label": stored_label, "url": url}
        guide = str(raw.get("guide") or "").strip()
        if guide:
            if not ID_RE.match(guide):
                return json_error(handler, HTTPStatus.BAD_REQUEST, "Guide id is invalid")
            link["guide"] = guide
        links.append(link)
    if links:
        data["links"] = links
    referral_url = str(body.get("referral_url") or body.get("referralUrl") or "").strip()
    referral_code = str(body.get("referral_code") or body.get("referralCode") or "").strip()
    if referral_url:
        data["referral_url"] = referral_url
    if referral_code:
        data["referral_code"] = referral_code
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("---\n" + dump_project_yaml(data) + "---\n", encoding="utf-8")
    try:
        log = regenerate_projects()
    except RuntimeError as exc:
        return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
    return json_ok(handler, {"id": item_id, "path": str(dest.relative_to(ROOT)), "generator": log})


def handle_project_categories_save(handler, body, json_ok, json_error) -> None:
    action = str(body.get("action") or "").strip()
    cats = load_project_categories()
    by_id = {str(item.get("id")): item for item in cats}

    if action == "reorder":
        ids = body.get("ids") if isinstance(body.get("ids"), list) else []
        if set(ids) != set(by_id):
            return json_error(handler, HTTPStatus.BAD_REQUEST, "Reorder must include every category")
        for index, cid in enumerate(ids, start=1):
            by_id[cid]["order"] = index
        ordered = [by_id[cid] for cid in ids]
        PROJECT_CATS_PATH.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        try:
            log = regenerate_projects()
        except RuntimeError as exc:
            return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        return json_ok(handler, {"categories": ordered, "generator": log})

    if action == "update":
        cid = str(body.get("id") or "").strip()
        current = by_id.get(cid)
        if not current:
            return json_error(handler, HTTPStatus.NOT_FOUND, "Unknown category")
        label = body.get("label") if isinstance(body.get("label"), dict) else {}
        en = str(label.get("en") or current.get("label", {}).get("en") or "").strip()
        tr = str(label.get("tr") or current.get("label", {}).get("tr") or "").strip()
        if not en or not tr:
            return json_error(handler, HTTPStatus.BAD_REQUEST, "English and Turkish labels are required")
        current["label"] = {"en": en, "tr": tr}
        PROJECT_CATS_PATH.write_text(json.dumps(cats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        try:
            log = regenerate_projects()
        except RuntimeError as exc:
            return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        return json_ok(handler, {"categories": load_project_categories(), "generator": log})

    if action == "create":
        label = body.get("label") if isinstance(body.get("label"), dict) else {}
        en = str(label.get("en") or "").strip()
        tr = str(label.get("tr") or "").strip()
        if not en or not tr:
            return json_error(handler, HTTPStatus.BAD_REQUEST, "English and Turkish labels are required")
        cid = slugify(en)
        folder = cid
        if not cid or cid in by_id:
            return json_error(handler, HTTPStatus.CONFLICT, "That category already exists")
        order = max((int(item.get("order") or 0) for item in cats), default=0) + 1
        cats.append(
            {
                "id": cid,
                "folder": folder,
                "order": order,
                "accordion": False,
                "protected": False,
                "label": {"en": en, "tr": tr},
            }
        )
        (PROJECTS_ROOT / folder).mkdir(parents=True, exist_ok=True)
        keep = PROJECTS_ROOT / folder / ".gitkeep"
        if not keep.exists():
            keep.write_text("", encoding="utf-8")
        PROJECT_CATS_PATH.write_text(json.dumps(cats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        try:
            log = regenerate_projects()
        except RuntimeError as exc:
            return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        return json_ok(handler, {"categories": load_project_categories(), "id": cid, "generator": log})

    if action == "delete":
        cid = str(body.get("id") or "").strip()
        current = by_id.get(cid)
        if not current:
            return json_error(handler, HTTPStatus.NOT_FOUND, "Unknown category")
        if current.get("protected"):
            return json_error(handler, HTTPStatus.FORBIDDEN, "This project category cannot be deleted")
        items = [item for item in list_project_records() if item["category"] == cid]
        move_to = str(body.get("moveTo") or "").strip()
        if items and not move_to:
            return json_error(handler, HTTPStatus.CONFLICT, f"This category contains {len(items)} projects.")
        if items:
            dest_cat = category_by_id(move_to)
            if not dest_cat or move_to == cid:
                return json_error(handler, HTTPStatus.BAD_REQUEST, "Choose a different target category")
            for item in items:
                src = ROOT / item["path"]
                dest = project_path(dest_cat, item["slug"])
                if dest.exists():
                    return json_error(handler, HTTPStatus.CONFLICT, f"{dest.relative_to(ROOT)} already exists")
                data = parse_project_file(src)
                data["category"] = move_to
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text("---\n" + dump_project_yaml(data) + "---\n", encoding="utf-8")
                if src != dest and src.exists():
                    src.unlink()
        folder = PROJECTS_ROOT / str(current.get("folder") or cid)
        if folder.is_dir():
            leftover = [p for p in folder.iterdir() if p.name != ".gitkeep"]
            if leftover:
                return json_error(handler, HTTPStatus.CONFLICT, "Category folder is not empty")
            shutil.rmtree(folder)
        PROJECT_CATS_PATH.write_text(
            json.dumps([item for item in cats if str(item.get("id")) != cid], ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        try:
            log = regenerate_projects()
        except RuntimeError as exc:
            return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
        return json_ok(handler, {"categories": load_project_categories(), "moved": len(items), "generator": log})

    return json_error(handler, HTTPStatus.BAD_REQUEST, "Unknown project category action")


def handle_guide_save(handler, body, json_ok, json_error) -> None:
    try:
        locales = cms_locale_saves(body)
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))
    if not locales:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Markdown is required")
    heading = first_heading(locales[0]["markdown"])
    item_id = slugify(str(body.get("id") or heading or ""))
    project_id = str(body.get("projectId") or "").strip()
    if not item_id or not ID_RE.match(item_id):
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Could not derive a guide id")
    if item_id in {"en", "tr", "guide", "writings", "assets", "content"}:
        return json_error(handler, HTTPStatus.BAD_REQUEST, "That guide id is reserved")
    folder = safe_under(GUIDES_ROOT, item_id)
    folder.mkdir(parents=True, exist_ok=True)
    cover_in_body = "cover" in body
    langs = []
    first_path = None
    for item in locales:
        markdown = item["markdown"]
        if cover_in_body:
            markdown = apply_guide_cover(markdown, body.get("cover"))
        filename = "EN.md" if item["lang"] == "en" else "TR.md"
        path = safe_under(folder, filename)
        path.write_text(markdown if markdown.endswith("\n") else markdown + "\n", encoding="utf-8")
        langs.append(item["lang"])
        if first_path is None:
            first_path = path
    try:
        strip_guide_from_projects(item_id)
        if project_id:
            attach_guide_to_project(project_id, item_id)
        log = regenerate_projects()
    except ValueError as exc:
        return json_error(handler, HTTPStatus.BAD_REQUEST, str(exc))
    except RuntimeError as exc:
        return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
    write_guides_index()
    try:
        share_log = regenerate_share()
    except RuntimeError as exc:
        return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
    return json_ok(
        handler,
        {
            "id": item_id,
            "path": str(first_path.relative_to(ROOT)),
            "langs": langs,
            "generator": log,
            "share": share_log,
        },
    )


def handle_guide_delete(handler, body, json_ok, json_error) -> None:
    item_id = str(body.get("id") or "").strip()
    if not ID_RE.match(item_id):
        return json_error(handler, HTTPStatus.BAD_REQUEST, "Invalid guide id")
    folder = safe_under(GUIDES_ROOT, item_id)
    if not folder.is_dir():
        return json_error(handler, HTTPStatus.NOT_FOUND, "Guide not found")
    changed = strip_guide_from_projects(item_id)
    shutil.rmtree(folder)
    assets = GUIDE_ASSETS / item_id
    if assets.is_dir():
        shutil.rmtree(assets)
    try:
        log = regenerate_projects() if changed else ""
    except RuntimeError as exc:
        return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
    write_guides_index()
    try:
        share_log = regenerate_share()
    except RuntimeError as exc:
        return json_error(handler, HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))
    return json_ok(handler, {"id": item_id, "cleared": changed, "generator": log, "share": share_log})


def handle_contact_save(handler, body, json_ok, json_error) -> None:
    site = json.loads(SITE_PATH.read_text(encoding="utf-8"))
    if isinstance(body.get("location"), dict):
        apply_location(site, body["location"])
    if isinstance(body.get("contact"), dict):
        current = site.get("contact") if isinstance(site.get("contact"), dict) else {}
        incoming = body["contact"]
        if "formEnabled" in incoming:
            current["formEnabled"] = bool(incoming.get("formEnabled"))
        if "endpoint" in incoming:
            endpoint = str(incoming.get("endpoint") or "").strip()
            if endpoint and not HTTPS_RE.match(endpoint):
                return json_error(handler, HTTPStatus.BAD_REQUEST, "Form endpoint must be an https:// URL")
            current["endpoint"] = endpoint
        site["contact"] = current
    SITE_PATH.write_text(json.dumps(site, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    i18n = body.get("i18n") if isinstance(body.get("i18n"), dict) else {}
    for lang in ("en", "tr"):
        if isinstance(i18n.get(lang), dict):
            write_contact_i18n(lang, i18n[lang])
    return json_ok(handler, {"site": site})


def handle_cms_post(handler, parsed, body, json_ok, json_error) -> bool:
    path = parsed.path
    if path == "/admin/api/page":
        handle_page_save(handler, body, json_ok, json_error)
        return True
    if path == "/admin/api/project-save":
        handle_project_save(handler, body, json_ok, json_error)
        return True
    if path == "/admin/api/project-categories":
        handle_project_categories_save(handler, body, json_ok, json_error)
        return True
    if path == "/admin/api/guide-save":
        handle_guide_save(handler, body, json_ok, json_error)
        return True
    if path == "/admin/api/guide-delete":
        handle_guide_delete(handler, body, json_ok, json_error)
        return True
    if path == "/admin/api/contact":
        handle_contact_save(handler, body, json_ok, json_error)
        return True
    return False
