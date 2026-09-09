#!/usr/bin/env python3
"""Generate crawler-readable Writing/Guide share pages, OG rasters, and sitemap.

Markdown remains the source of truth. Generated HTML/PNG/sitemap are derived.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_ORIGIN = "https://koltigin.xyz"
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RESERVED_GUIDE_DIRS = {"en", "tr", "index.json"}
RASTER_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
OG_SIZE = (1200, 630)
GOLD = (255, 216, 111, 255)
WHITE = (250, 250, 250, 255)
WHITE2 = (214, 214, 214, 255)
DIVIDER = (255, 216, 111, 220)
WRITING_OG_BACKGROUND = "assets/images/og/backgrounds/writing-og-background.png"
GUIDE_OG_BACKGROUND = "assets/images/og/backgrounds/guide-og-background.png"
OG_MARGIN_X = 72
OG_TITLE_MAX_RATIO = 0.74
OG_TITLE_TOP = 168
OG_CATEGORY_PT = 34
OG_TITLE_CATEGORY_GAP = 18
OG_AVATAR_SIZE = 114
OG_IDENTITY_BOTTOM = 81
OG_IDENTITY_GAP = 21
OG_DIVIDER_WIDTH = 3
OG_DIVIDER_HEIGHT_RATIO = 0.70
OG_BRAND_PT = 33
OG_BG_CENTERING = (0.5, 0.34)

WRITINGS_MARKER = "koltigin-share-writing"
GUIDES_MARKER = "koltigin-share-guide"

PUBLIC_SECTION_ROUTES = [
    {"id": "home", "path": "/", "dir": None},
    {"id": "about", "path": "/about/", "dir": "about"},
    {"id": "resume", "path": "/resume/", "dir": "resume"},
    {"id": "projects", "path": "/projects/", "dir": "projects"},
    {"id": "writings", "path": "/writings/", "dir": "writings"},
    {"id": "videos", "path": "/videos/", "dir": "videos"},
    {"id": "contact", "path": "/contact/", "dir": "contact"},
    {"id": "guides", "path": "/guides/", "dir": "guides"},
]


def parse_front_matter(text: str) -> tuple[dict, str]:
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


def load_json(path: Path, fallback):
    if not path.is_file():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def origin(root: Path) -> str:
    site = load_json(root / "config" / "site.json", {})
    raw = str((site or {}).get("canonicalUrl") or CANONICAL_ORIGIN).strip()
    if not raw:
        raw = CANONICAL_ORIGIN
    return raw.rstrip("/")


def site_config(root: Path) -> dict:
    path = root / "config" / "site.json"
    if not path.is_file():
        raise RuntimeError(
            "config/site.json is missing. Set displayName and avatar there before generating share images."
        )
    data = load_json(path, None)
    if not isinstance(data, dict):
        raise RuntimeError("config/site.json is not valid JSON.")
    return data


def display_name(root: Path) -> str:
    name = str(site_config(root).get("displayName") or "").strip()
    if not name:
        raise RuntimeError(
            "config/site.json is missing a usable displayName. "
            "Set displayName to the author/site name shown on fallback covers. "
            "Do not leave it blank."
        )
    return name


def avatar_path(root: Path) -> Path:
    raw = str(site_config(root).get("avatar") or "").strip()
    if not raw:
        raise RuntimeError(
            "config/site.json is missing avatar. "
            "Set avatar to a local file such as ./assets/images/profile/your-photo.png"
        )
    if raw.startswith("http://") or raw.startswith("https://"):
        raise RuntimeError("config/site.json avatar must be a local file path, not a URL.")
    rel = raw[2:] if raw.startswith("./") else raw.lstrip("/")
    path = root / rel
    if not path.is_file():
        raise RuntimeError(
            f"Fallback avatar file not found: {rel} "
            "(from config/site.json avatar). Place a square PNG, JPEG, or WebP at that path."
        )
    if path.suffix.lower() not in RASTER_EXTS:
        raise RuntimeError(
            f"Fallback avatar must be PNG, JPEG, or WebP: {rel}"
        )
    return path


def writing_types(root: Path) -> list[dict]:
    pack = load_json(root / "config" / "writing-types.json", {"types": []})
    types = pack.get("types") if isinstance(pack, dict) else []
    return [item for item in types if isinstance(item, dict) and item.get("id")]


def type_by_id(root: Path, kind: str) -> dict:
    for item in writing_types(root):
        if item.get("id") == kind:
            return item
    return {"id": kind, "mode": "internal", "label": {"en": kind, "tr": kind}}


def is_external(root: Path, kind: str) -> bool:
    return str(type_by_id(root, kind).get("mode") or "") == "external"


def kind_label(root: Path, kind: str, lang: str) -> str:
    labels = type_by_id(root, kind).get("label") or {}
    if isinstance(labels, dict):
        return str(labels.get(lang) or labels.get("en") or kind)
    return str(labels or kind)


def excerpt(body: str, limit: int = 160) -> str:
    chunks: list[str] = []
    for line in (body or "").split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith("```"):
            if chunks:
                break
            continue
        stripped = re.sub(r"[*_`>#]+", "", stripped)
        stripped = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", stripped)
        chunks.append(stripped)
        text = " ".join(chunks)
        if len(text) >= limit:
            return text[: limit - 1].rstrip() + "…"
    return " ".join(chunks)[:limit].strip()


def first_heading(markdown: str) -> str:
    _meta, body = parse_front_matter(markdown)
    for line in body.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def first_paragraph(markdown: str) -> str:
    _meta, body = parse_front_matter(markdown)
    return excerpt(body)


def has_cover(value: str) -> bool:
    raw = str(value or "").strip().lower()
    return bool(raw) and raw not in {"null", "none", "false"}


def resolve_cover(root: Path, cover: str, *, guide_id: str = "") -> Path | None:
    value = str(cover or "").strip()
    if not has_cover(value):
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return None
    rel = value.replace("./", "").lstrip("/")
    candidates = []
    if guide_id:
        candidates.append(root / "assets/images/guides" / guide_id / Path(rel).name)
        candidates.append(root / rel)
    candidates.extend(
        [
            root / "assets/images/blog" / Path(rel).name,
            root / rel,
        ]
    )
    for path in candidates:
        if path.is_file():
            return path
    return None


def load_font(root: Path, weight: str, size: int) -> ImageFont.FreeTypeFont:
    name = "Poppins-SemiBold.ttf" if weight == "semibold" else "Poppins-Regular.ttf"
    path = root / "assets/fonts" / name
    if not path.is_file():
        raise RuntimeError("Poppins fonts are missing under assets/fonts/")
    return ImageFont.truetype(str(path), max(8, int(round(size))))


def wrap_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int, max_lines: int) -> list[str]:
    words = str(text or "").split()
    if not words:
        return [""]

    def split_token(token: str) -> list[str]:
        if draw.textlength(token, font=font) <= max_width:
            return [token]
        parts: list[str] = []
        buf = ""
        for ch in token:
            trial = buf + ch
            if buf and draw.textlength(trial, font=font) > max_width:
                parts.append(buf)
                buf = ch
            else:
                buf = trial
        if buf:
            parts.append(buf)
        return parts or [token]

    tokens: list[str] = []
    for word in words:
        tokens.extend(split_token(word))
    lines: list[str] = []
    current = ""
    for word in tokens:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) == max_lines - 1:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines:
        while lines[-1] and draw.textlength(lines[-1] + "…", font=font) > max_width:
            lines[-1] = lines[-1][:-1]
        if not lines[-1].endswith("…"):
            lines[-1] = (lines[-1].rstrip() + "…") if lines[-1] else "…"
    return lines[:max_lines]


def _scale_pt(x: float, y: float, size: float, left: float, top: float) -> tuple[int, int]:
    s = size / 512.0
    return int(round(left + x * s)), int(round(top + y * s))


def _stroke_poly(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], color, width: int) -> None:
    if len(points) < 2:
        return
    draw.line(points, fill=color, width=width, joint="curve")
    rad = max(1, width // 2)
    for x, y in points:
        draw.ellipse((x - rad, y - rad, x + rad, y + rad), fill=color)


def paste_ionicon(img: Image.Image, kind: str, cx: int, top: int, size: int) -> None:
    """Rasterize the same Ionicon 5 outline paths vendored in assets/icons/."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    left = cx - size / 2
    width = max(2, int(round(32 / 512 * size)))
    color = (*GOLD[:3], 255)
    # assets/icons/code-slash-outline.svg  (notes + guides)
    # M160 368L32 256l128-112 M352 368l128-112-128-112 M304 96l-96 320
    if kind in {"notes", "guide"}:
        paths = [
            [(160, 368), (32, 256), (160, 144)],
            [(352, 368), (480, 256), (352, 144)],
            [(304, 96), (208, 416)],
        ]
    else:
        # assets/icons/document-text-outline.svg — outline + two text strokes
        paths = [
            [(144, 48), (242, 48), (400, 206), (400, 416), (144, 416), (112, 96), (144, 48)],
            [(256, 56), (256, 176), (376, 176)],
            [(176, 288), (336, 288)],
            [(176, 368), (336, 368)],
        ]
    for path in paths:
        _stroke_poly(draw, [_scale_pt(x, y, size, left, top) for x, y in path], color, width)
    img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"))


def circular_avatar(path: Path, size: int) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    fitted = ImageOps.fit(src, (size, size), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(fitted, (0, 0), mask)
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((1, 1, size - 2, size - 2), outline=(255, 216, 111, 115), width=max(1, round(size / 42)))
    out.alpha_composite(ring)
    return out


def paint_card_background(img: Image.Image) -> None:
    pixels = img.load()
    width, height = img.size
    start = (42, 38, 24)
    end = (18, 18, 18)
    denom = max(width + height - 2, 1)
    for y in range(height):
        for x in range(width):
            t = (x + y) / denom
            pixels[x, y] = (
                int(start[0] + (end[0] - start[0]) * t),
                int(start[1] + (end[1] - start[1]) * t),
                int(start[2] + (end[2] - start[2]) * t),
            )


def og_background_rel(kind: str) -> str:
    if str(kind or "") == "guide":
        return GUIDE_OG_BACKGROUND
    return WRITING_OG_BACKGROUND


def load_og_background(root: Path, kind: str) -> Image.Image:
    rel = og_background_rel(kind)
    path = root / rel
    if not path.is_file():
        raise RuntimeError(
            f"OG master background not found: {rel}. "
            "Place the Writing/Guide master PNG under assets/images/og/backgrounds/."
        )
    try:
        source = Image.open(path)
        source.load()
    except OSError as exc:
        raise RuntimeError(f"OG master background could not be read: {rel}") from exc
    return ImageOps.fit(source.convert("RGB"), OG_SIZE, method=Image.Resampling.LANCZOS, centering=OG_BG_CENTERING)


def title_max_width(og_w: int) -> int:
    ratio_w = int(round(OG_TITLE_MAX_RATIO * og_w))
    margin_w = og_w - 2 * OG_MARGIN_X
    return max(320, min(ratio_w, margin_w))


def fit_og_title(
    draw: ImageDraw.ImageDraw, root: Path, title: str, max_width: int
) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    max_lines = 3
    max_block = 188
    for size in range(48, 27, -2):
        font = load_font(root, "semibold", size)
        lead = int(round(size * 1.22))
        lines = wrap_lines(draw, title, font, max_width, max_lines)
        if lead * len(lines) > max_block:
            continue
        if all(draw.textlength(line, font=font) <= max_width for line in lines):
            return font, lines, lead
    font = load_font(root, "semibold", 28)
    lead = int(round(28 * 1.22))
    return font, wrap_lines(draw, title, font, max_width, max_lines), lead


def draw_text_with_shadow(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill,
    anchor: str,
) -> None:
    x, y = xy
    shadow = (18, 16, 14)
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1)):
        draw.text((x + dx, y + dy), text, font=font, fill=shadow, anchor=anchor)
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)


def identity_row_geometry(draw: ImageDraw.ImageDraw, root: Path, og_w: int, og_h: int) -> dict:
    brand = display_name(root)
    brand_font = load_font(root, "regular", OG_BRAND_PT)
    brand_w = int(draw.textlength(brand, font=brand_font))
    identity_y = og_h - OG_IDENTITY_BOTTOM - OG_AVATAR_SIZE
    divider_h = int(round(OG_AVATAR_SIZE * OG_DIVIDER_HEIGHT_RATIO))
    row_w = OG_AVATAR_SIZE + OG_IDENTITY_GAP + OG_DIVIDER_WIDTH + OG_IDENTITY_GAP + brand_w
    row_x = (og_w - row_w) // 2
    x_avatar = row_x
    div_x = x_avatar + OG_AVATAR_SIZE + OG_IDENTITY_GAP
    div_y0 = identity_y + (OG_AVATAR_SIZE - divider_h) // 2
    div_y1 = div_y0 + divider_h
    brand_x = div_x + OG_DIVIDER_WIDTH + OG_IDENTITY_GAP
    brand_y = identity_y + OG_AVATAR_SIZE // 2
    return {
        "title_top": OG_TITLE_TOP,
        "category_pt": OG_CATEGORY_PT,
        "avatar_size": OG_AVATAR_SIZE,
        "avatar_xy": (x_avatar, identity_y),
        "divider": (div_x, div_y0, div_x, div_y1),
        "brand_xy": (brand_x, brand_y),
        "brand": brand,
        "brand_pt": OG_BRAND_PT,
        "divider_width": OG_DIVIDER_WIDTH,
        "row_width": row_w,
        "brand_font": brand_font,
    }


def render_fallback_png(root: Path, dest: Path, *, title: str, kicker: str, kind: str) -> None:
    og_w, og_h = OG_SIZE
    img = load_og_background(root, kind)
    draw = ImageDraw.Draw(img)
    max_text = title_max_width(og_w)
    title_font, lines, title_lead = fit_og_title(draw, root, title, max_text)
    kicker_font = load_font(root, "regular", OG_CATEGORY_PT)
    spec = identity_row_geometry(draw, root, og_w, og_h)
    cx = og_w // 2
    kicker_h = int(round(OG_CATEGORY_PT * 1.2))
    title_top = OG_TITLE_TOP
    category = str(kicker or "").strip().upper()

    y = title_top
    for line in lines:
        draw_text_with_shadow(
            draw,
            (cx, int(round(y + title_lead / 2))),
            line,
            title_font,
            WHITE,
            "mm",
        )
        y += title_lead
    if category:
        y += OG_TITLE_CATEGORY_GAP
        draw_text_with_shadow(
            draw,
            (cx, int(round(y + kicker_h / 2))),
            category,
            kicker_font,
            GOLD[:3],
            "mm",
        )

    avatar = circular_avatar(avatar_path(root), spec["avatar_size"])
    x_avatar, ay = spec["avatar_xy"]
    img.paste(avatar, (x_avatar, ay), avatar)
    x0, y0, x1, y1 = spec["divider"]
    if y1 > y0:
        draw.line((x0, y0, x1, y1), fill=GOLD[:3], width=spec["divider_width"])
    draw_text_with_shadow(
        draw,
        spec["brand_xy"],
        spec["brand"],
        spec["brand_font"],
        WHITE,
        "lm",
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="PNG", optimize=True)


def render_cover_png(src: Path, dest: Path) -> bool:
    suffix = src.suffix.lower()
    if suffix not in RASTER_EXTS:
        return False
    try:
        image = Image.open(src)
        image.load()
    except OSError:
        return False
    fitted = ImageOps.fit(image.convert("RGB"), OG_SIZE, method=Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    fitted.save(dest, format="PNG", optimize=True)
    return True


def png_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def writing_share_path(lang: str, kind: str, item_id: str) -> str:
    return f"writings/{lang}/{kind}/{item_id}/index.html"


def writing_og_path(lang: str, kind: str, item_id: str) -> str:
    return f"assets/images/og/writings/{lang}/{kind}/{item_id}.png"


def guide_share_path(lang: str, item_id: str) -> str:
    code = "TR" if lang == "tr" else "EN"
    return f"guides/{item_id}/{code}/index.html"


def guide_public_url(base: str, item_id: str, lang: str) -> str:
    code = "TR" if lang == "tr" else "EN"
    return abs_url(base, f"guides/{item_id}/{code}")


def guide_og_path(lang: str, item_id: str) -> str:
    return f"assets/images/og/guides/{lang}/{item_id}.png"


def abs_url(base: str, rel: str) -> str:
    return f"{base}/{rel.lstrip('/')}"


DATE_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
DATE_EU = re.compile(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$")


def published_date(value: object) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    match = DATE_ISO.match(raw)
    if match:
        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"
        return None
    match = DATE_EU.match(raw)
    if match:
        day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"
    return None


def json_ld_payload(
    *,
    schema_type: str,
    headline: str,
    description: str,
    author: str,
    image: str,
    url: str,
    in_language: str,
    date_published: str | None = None,
) -> dict:
    data = {
        "@context": "https://schema.org",
        "@type": schema_type,
        "headline": headline,
        "description": description,
        "author": {"@type": "Person", "name": author},
        "image": image,
        "url": url,
        "mainEntityOfPage": url,
        "inLanguage": in_language,
    }
    if date_published:
        data["datePublished"] = date_published
    return data


def json_ld_script(data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    return f'  <script type="application/ld+json">{payload}</script>'


def share_html(
    *,
    lang: str,
    title: str,
    description: str,
    canonical: str,
    image: str,
    spa_hash: str,
    alternates: dict[str, str],
    marker: str,
    brand: str,
    schema_type: str,
    author: str,
    date_published: str | None = None,
) -> str:
    hreflang = []
    for code, url in alternates.items():
        hreflang.append(f'  <link rel="alternate" hreflang="{html.escape(code)}" href="{html.escape(url)}">')
    if "en" in alternates:
        hreflang.append(f'  <link rel="alternate" hreflang="x-default" href="{html.escape(alternates["en"])}">')
    elif alternates:
        first = next(iter(alternates.values()))
        hreflang.append(f'  <link rel="alternate" hreflang="x-default" href="{html.escape(first)}">')
    continue_href = f"/{spa_hash}" if spa_hash.startswith("#") else spa_hash
    return f"""<!DOCTYPE html>
<html lang="{html.escape(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="{html.escape(marker)}" content="1">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(description)}">
  <link rel="canonical" href="{html.escape(canonical)}">
{chr(10).join(hreflang)}
  <meta property="og:type" content="article">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(description)}">
  <meta property="og:url" content="{html.escape(canonical)}">
  <meta property="og:image" content="{html.escape(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="{'tr_TR' if lang == 'tr' else 'en_US'}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{html.escape(title)}">
  <meta name="twitter:description" content="{html.escape(description)}">
  <meta name="twitter:image" content="{html.escape(image)}">
{json_ld_script(json_ld_payload(
        schema_type=schema_type,
        headline=title,
        description=description,
        author=author,
        image=image,
        url=canonical,
        in_language="tr" if lang == "tr" else "en",
        date_published=date_published,
    ))}
  <meta http-equiv="refresh" content="0;url={html.escape(continue_href)}">
  <style>
    body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111113; color: #d6d6d6; font-family: Poppins, system-ui, sans-serif; }}
    a {{ color: #ffd86f; }}
  </style>
</head>
<body>
  <p><a href="{html.escape(continue_href)}">Continue to {html.escape(brand)}</a></p>
  <script>
    try {{ localStorage.setItem("siteLang", "{html.escape(lang)}"); }} catch (e) {{}}
    location.replace({json.dumps(continue_href)});
  </script>
</body>
</html>
"""


def discover_writings(root: Path) -> list[dict]:
    items: dict[tuple[str, str], dict] = {}
    for kind_meta in writing_types(root):
        kind = str(kind_meta.get("id") or "")
        if not kind or is_external(root, kind):
            continue
        for lang in ("en", "tr"):
            folder = root / "content" / kind / lang
            if not folder.is_dir():
                continue
            for path in sorted(folder.glob("*.md")):
                item_id = path.stem
                if not ID_RE.match(item_id):
                    continue
                meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
                key = (kind, item_id)
                rec = items.setdefault(
                    key,
                    {"kind": kind, "id": item_id, "langs": {}},
                )
                rec["langs"][lang] = {
                    "title": str(meta.get("title") or item_id).strip(),
                    "description": str(meta.get("summary") or meta.get("excerpt") or excerpt(body)).strip(),
                    "cover": str(meta.get("cover") or meta.get("image") or "").strip(),
                    "date": published_date(meta.get("date")),
                }
    return [items[key] for key in sorted(items)]


def discover_guides(root: Path) -> list[dict]:
    guides_root = root / "content" / "guides"
    items = []
    if not guides_root.is_dir():
        return items
    for folder in sorted(guides_root.iterdir()):
        if not folder.is_dir() or folder.name in RESERVED_GUIDE_DIRS or not ID_RE.match(folder.name):
            continue
        rec = {"id": folder.name, "langs": {}}
        for lang, filename in (("en", "EN.md"), ("tr", "TR.md")):
            path = folder / filename
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            meta, _body = parse_front_matter(text)
            title = first_heading(text) or folder.name
            if not title.strip() or title.strip() == "#":
                continue
            rec["langs"][lang] = {
                "title": title,
                "description": first_paragraph(text),
                "cover": str(meta.get("cover") or meta.get("image") or "").strip(),
            }
        if rec["langs"]:
            items.append(rec)
    return items


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def prune_generated(root: Path, keep: set[Path], bases: list[Path]) -> list[str]:
    removed = []
    for base in bases:
        if not base.exists():
            continue
        if base.is_file():
            if base.resolve() not in keep:
                base.unlink()
                removed.append(str(base.relative_to(root)))
            continue
        for path in sorted(base.rglob("*"), reverse=True):
            resolved = path.resolve()
            if "backgrounds" in path.parts and path.parent.name == "backgrounds":
                continue
            if path.is_file() and resolved not in keep:
                if path.name == "index.html" or path.suffix.lower() in {".png", ".md"} or path.name == "index.json":
                    path.unlink()
                    removed.append(str(path.relative_to(root)))
            elif path.is_dir():
                try:
                    next(path.iterdir())
                except StopIteration:
                    path.rmdir()
    return removed


SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def sitemap_xml(_base: str, urls: list[dict]) -> str:
    """Google-compatible urlset sitemap. No xhtml:link — that namespace makes
    Chrome (and some crawlers) treat the file as HTML and show concatenated URLs.
    """
    ET.register_namespace("", SITEMAP_NS)
    urlset = ET.Element(f"{{{SITEMAP_NS}}}urlset")
    seen: set[str] = set()
    for entry in urls:
        loc = str((entry or {}).get("loc") or "").strip()
        if not loc or loc in seen:
            continue
        seen.add(loc)
        url_el = ET.SubElement(urlset, f"{{{SITEMAP_NS}}}url")
        loc_el = ET.SubElement(url_el, f"{{{SITEMAP_NS}}}loc")
        loc_el.text = loc
    ET.indent(urlset, space="  ")
    body = ET.tostring(urlset, encoding="unicode")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n"


def section_copy(root: Path, route_id: str, lang: str = "en") -> tuple[str, str, str]:
    site = load_json(root / "config" / "site.json", {}) or {}
    seo = site.get("seo") if isinstance(site.get("seo"), dict) else {}
    routes = seo.get("routes") if isinstance(seo.get("routes"), dict) else {}
    page = routes.get(route_id) if isinstance(routes.get(route_id), dict) else {}
    localized = page.get(lang) if isinstance(page.get(lang), dict) else page.get("en")
    if not isinstance(localized, dict):
        localized = seo.get(lang) if isinstance(seo.get(lang), dict) else seo.get("en")
    if not isinstance(localized, dict):
        localized = {}
    title = str(localized.get("title") or site.get("displayName") or "Home").strip() or "Home"
    description = str(localized.get("description") or "").strip()
    image = str(page.get("ogImage") or site.get("ogImage") or "").strip()
    return title, description, image


def section_image_url(base: str, image: str) -> str:
    raw = str(image or "").strip()
    if not raw:
        return ""
    if re.match(r"^https?://", raw, flags=re.IGNORECASE):
        return raw
    return abs_url(base, raw.replace("./", "", 1).lstrip("/"))


def patch_section_head(
    source: str, *, title: str, description: str, canonical: str, image: str = ""
) -> str:
    html_out = source
    html_out = re.sub(
        r"<title>.*?</title>",
        f"<title>{html.escape(title)}</title>",
        html_out,
        count=1,
        flags=re.IGNORECASE | re.DOTALL,
    )
    attr_desc = html.escape(description, quote=True)
    attr_canon = html.escape(canonical, quote=True)
    attr_title = html.escape(title, quote=True)
    replacements = [
        (r'(<meta name="description" content=")[^"]*(")', rf"\1{attr_desc}\2"),
        (r'(<link rel="canonical" href=")[^"]*(")', rf"\1{attr_canon}\2"),
        (r'(<meta property="og:title" content=")[^"]*(")', rf"\1{attr_title}\2"),
        (r'(<meta property="og:description" content=")[^"]*(")', rf"\1{attr_desc}\2"),
        (r'(<meta property="og:url" content=")[^"]*(")', rf"\1{attr_canon}\2"),
        (r'(<meta name="twitter:title" content=")[^"]*(")', rf"\1{attr_title}\2"),
        (r'(<meta name="twitter:description" content=")[^"]*(")', rf"\1{attr_desc}\2"),
    ]
    if image:
        attr_image = html.escape(image, quote=True)
        replacements.extend(
            [
                (r'(<meta property="og:image" content=")[^"]*(")', rf"\1{attr_image}\2"),
                (r'(<meta name="twitter:image" content=")[^"]*(")', rf"\1{attr_image}\2"),
            ]
        )
    for pattern, repl in replacements:
        html_out, n = re.subn(pattern, repl, html_out, count=1, flags=re.IGNORECASE)
        if n != 1:
            raise RuntimeError(f"Could not patch sitemap section head field: {pattern}")
    return html_out


def patch_guide_spa_page(
    source: str,
    *,
    lang: str,
    title: str,
    description: str,
    canonical: str,
    image: str,
    alternates: dict[str, str],
    json_ld: dict,
) -> str:
    html_out = patch_section_head(
        source,
        title=title,
        description=description,
        canonical=canonical,
        image=image,
    )
    html_out = re.sub(
        r'(<html[^>]*\blang=")[^"]*(")',
        rf"\1{html.escape(lang)}\2",
        html_out,
        count=1,
        flags=re.IGNORECASE,
    )
    html_out = re.sub(
        r'(<meta property="og:type" content=")[^"]*(")',
        r"\1article\2",
        html_out,
        count=1,
        flags=re.IGNORECASE,
    )
    html_out = re.sub(
        r'(<meta property="og:locale" content=")[^"]*(")',
        rf'\1{"tr_TR" if lang == "tr" else "en_US"}\2',
        html_out,
        count=1,
        flags=re.IGNORECASE,
    )
    extras = ['  <meta name="koltigin-share-guide" content="1">']
    for code, url in alternates.items():
        extras.append(
            f'  <link rel="alternate" hreflang="{html.escape(code)}" href="{html.escape(url)}">'
        )
    if "en" in alternates:
        extras.append(
            f'  <link rel="alternate" hreflang="x-default" href="{html.escape(alternates["en"])}">'
        )
    extras.append('  <meta property="og:image:width" content="1200">')
    extras.append('  <meta property="og:image:height" content="630">')
    extras.append(json_ld_script(json_ld))
    extras.append(
        f'  <script>try{{localStorage.setItem("siteLang","{html.escape(lang)}");}}catch(e){{}}</script>'
    )
    html_out = html_out.replace("</head>", "\n".join(extras) + "\n</head>", 1)
    return html_out


def write_section_pages(root: Path) -> list[str]:
    index_path = root / "index.html"
    if not index_path.is_file():
        return []
    source = index_path.read_text(encoding="utf-8")
    base = origin(root)
    written = []
    for spec in PUBLIC_SECTION_ROUTES:
        if not spec["dir"]:
            continue
        title, description, image = section_copy(root, spec["id"])
        canonical = f"{base}{spec['path']}"
        html_out = patch_section_head(
            source,
            title=title,
            description=description,
            canonical=canonical,
            image=section_image_url(base, image),
        )
        dest = root / spec["dir"] / "index.html"
        write_text(dest, html_out)
        written.append(str(dest.relative_to(root)))
    return written


def generate(root: Path) -> dict:
    base = origin(root)
    brand = display_name(root)
    avatar_path(root)
    keep: set[Path] = set()
    sitemap_entries = [{"loc": f"{base}{spec['path']}"} for spec in PUBLIC_SECTION_ROUTES]
    created = []

    for item in discover_writings(root):
        kind = item["kind"]
        item_id = item["id"]
        langs = item["langs"]
        alternates = {
            lang: abs_url(base, f"writings/{lang}/{kind}/{item_id}/")
            for lang in langs
        }
        for lang, data in langs.items():
            html_rel = writing_share_path(lang, kind, item_id)
            og_rel = writing_og_path(lang, kind, item_id)
            html_path = root / html_rel
            og_path = root / og_rel
            cover = resolve_cover(root, data["cover"])
            used_cover = bool(cover and render_cover_png(cover, og_path))
            if not used_cover:
                render_fallback_png(
                    root,
                    og_path,
                    title=data["title"],
                    kicker=kind_label(root, kind, lang),
                    kind=kind,
                )
            canonical = alternates[lang]
            image = abs_url(base, og_rel)
            spa = f"#/yazilar/{kind}/{item_id}"
            write_text(
                html_path,
                share_html(
                    lang=lang,
                    title=data["title"],
                    description=data["description"] or data["title"],
                    canonical=canonical,
                    image=image,
                    spa_hash=spa,
                    alternates=alternates,
                    marker=WRITINGS_MARKER,
                    brand=brand,
                    schema_type="BlogPosting",
                    author=brand,
                    date_published=data.get("date"),
                ),
            )
            keep.add(html_path.resolve())
            keep.add(og_path.resolve())
            created.append(html_rel)
            sitemap_entries.append({"loc": canonical, "alternates": alternates})

    index_source = (root / "index.html").read_text(encoding="utf-8") if (root / "index.html").is_file() else ""

    for item in discover_guides(root):
        item_id = item["id"]
        langs = item["langs"]
        alternates = {lang: guide_public_url(base, item_id, lang) for lang in langs}
        for lang, data in langs.items():
            html_rel = guide_share_path(lang, item_id)
            og_rel = guide_og_path(lang, item_id)
            html_path = root / html_rel
            og_path = root / og_rel
            cover = resolve_cover(root, data["cover"], guide_id=item_id)
            used_cover = bool(cover and render_cover_png(cover, og_path))
            if not used_cover:
                kicker = "Guide" if lang == "en" else "Rehber"
                render_fallback_png(
                    root,
                    og_path,
                    title=data["title"],
                    kicker=kicker,
                    kind="guide",
                )
            canonical = alternates[lang]
            image = abs_url(base, og_rel)
            payload = json_ld_payload(
                schema_type="TechArticle",
                headline=data["title"],
                description=data["description"] or data["title"],
                author=brand,
                image=image,
                url=canonical,
                in_language="tr" if lang == "tr" else "en",
                date_published=None,
            )
            if index_source:
                write_text(
                    html_path,
                    patch_guide_spa_page(
                        index_source,
                        lang=lang,
                        title=data["title"],
                        description=data["description"] or data["title"],
                        canonical=canonical,
                        image=image,
                        alternates=alternates,
                        json_ld=payload,
                    ),
                )
            keep.add(html_path.resolve())
            keep.add(og_path.resolve())
            created.append(html_rel)
            sitemap_entries.append({"loc": canonical, "alternates": alternates})

    sitemap_path = root / "sitemap.xml"
    write_text(sitemap_path, sitemap_xml(base, sitemap_entries))
    keep.add(sitemap_path.resolve())
    for spec in PUBLIC_SECTION_ROUTES:
        if spec["dir"]:
            keep.add((root / spec["dir"] / "index.html").resolve())
    section_pages = write_section_pages(root)
    removed = prune_generated(
        root,
        keep,
        [
            root / "writings",
            root / "guide",
            root / "guides",
            root / "assets/images/og",
        ],
    )
    return {
        "created": created + section_pages,
        "removed": removed,
        "sitemap": str(sitemap_path.relative_to(root)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(ROOT))
    args = parser.parse_args()
    root = Path(args.root).resolve()
    try:
        result = generate(root)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"generate-share failed: {exc}\n")
        return 1
    sys.stdout.write(
        f"generate-share wrote {len(result['created'])} pages, removed {len(result['removed'])} stale files\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
