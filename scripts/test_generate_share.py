#!/usr/bin/env python3
"""Regression tests for generate-share.py."""
from __future__ import annotations

import importlib.util
import inspect
import json
import re
import shutil
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("generate_share", ROOT / "scripts" / "generate-share.py")
generate_share = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(generate_share)


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL {msg}")


def ok(msg: str) -> None:
    print("ok", msg)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def tiny_png(path: Path, color=(40, 80, 180)) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (400, 240), color).save(path, "PNG")


def setup_root(tmp: Path) -> Path:
    shutil.copytree(ROOT / "assets" / "fonts", tmp / "assets" / "fonts")
    avatar_src = ROOT / "assets" / "images" / "profile" / "koltigin-at.png"
    dest_avatar = tmp / "assets" / "images" / "profile" / "koltigin-at.png"
    dest_avatar.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(avatar_src, dest_avatar)
    bg_dest = tmp / "assets" / "images" / "og" / "backgrounds"
    bg_dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "assets" / "images" / "og" / "backgrounds" / "writing-og-background.png", bg_dest / "writing-og-background.png")
    shutil.copy2(ROOT / "assets" / "images" / "og" / "backgrounds" / "guide-og-background.png", bg_dest / "guide-og-background.png")
    write(
        tmp / "config" / "site.json",
        '{"displayName":"KolTigin","canonicalUrl":"https://koltigin.xyz/","avatar":"./assets/images/profile/koltigin-at.png","ogImage":"./assets/images/social/og-koltigin.png","seo":{"routes":{"resume":{"ogImage":"./assets/images/social/og-resume.png"}}}}\n',
    )
    write(
        tmp / "config" / "writing-types.json",
        """{"types":[
          {"id":"articles","mode":"internal","label":{"en":"Article","tr":"Makale"}},
          {"id":"notes","mode":"internal","label":{"en":"Technical Note","tr":"Teknik Not"}},
          {"id":"social","mode":"external","label":{"en":"X Post","tr":"X Paylaşımı"}}
        ]}\n""",
    )
    write(
        tmp / "content" / "notes" / "en" / "no-cover.md",
        '---\ntitle: "Validator notes"\ndate: "2026-08-29"\nsummary: "Uptime and keys."\n---\n\nBody.\n',
    )
    write(
        tmp / "content" / "notes" / "tr" / "no-cover.md",
        '---\ntitle: "Doğrulayıcı notları"\ndate: "2026-08-29"\nsummary: "Uptime ve anahtarlar."\n---\n\nGövde.\n',
    )
    write(
        tmp / "content" / "articles" / "en" / "with-cover.md",
        '---\ntitle: "SoulMemory"\ndate: "2026-08-31"\nsummary: "On-chain mood diary."\ncover: "soul.png"\n---\n\nHello.\n',
    )
    write(
        tmp / "content" / "social" / "en" / "tweet.md",
        '---\ntitle: "A tweet"\ndate: "2026-01-01"\nexternalUrl: "https://x.com/x/status/1"\n---\n\n',
    )
    tiny_png(tmp / "assets" / "images" / "blog" / "soul.png")
    write(
        tmp / "content" / "notes" / "en" / "undated.md",
        '---\ntitle: "Undated note"\nsummary: "No calendar date."\n---\n\nBody.\n',
    )
    write(tmp / "content" / "guides" / "demo-guide" / "EN.md", "# Demo Guide\n\nInstall the node.\n")
    write(tmp / "content" / "guides" / "demo-guide" / "TR.md", "# Demo Rehber\n\nDüğümü kurun.\n")
    write(
        tmp / "content" / "guides" / "covered-guide" / "EN.md",
        "---\ncover: hero.png\n---\n\n# Covered Guide\n\nWith art.\n",
    )
    tiny_png(tmp / "assets" / "images" / "guides" / "covered-guide" / "hero.png", (180, 60, 40))
    write(tmp / "sitemap.xml", "old")
    write(
        tmp / "index.html",
        """<!DOCTYPE html>
<html lang="en">
<head>
  <title>KolTigin</title>
  <meta name="description" content="home">
  <link rel="canonical" href="https://koltigin.xyz/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="KolTigin">
  <meta property="og:description" content="home">
  <meta property="og:url" content="https://koltigin.xyz/">
  <meta property="og:image" content="https://koltigin.xyz/assets/images/common/og-image.png">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="KolTigin">
  <meta name="twitter:description" content="home">
  <meta name="twitter:image" content="https://koltigin.xyz/assets/images/common/og-image.png">
</head>
<body></body>
</html>
""",
    )
    return tmp


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def json_ld(html: str) -> dict:
    match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, flags=re.S)
    if not match:
        fail("missing json-ld script")
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        fail(f"json-ld is not valid JSON: {exc}")
    raise AssertionError("unreachable")


def main() -> None:
    escaped = generate_share.sitemap_xml(
        "https://koltigin.xyz",
        [{"loc": "https://koltigin.xyz/a&b/"}, {"loc": "https://koltigin.xyz/a&b/"}],
    )
    if not escaped.startswith('<?xml version="1.0" encoding="UTF-8"?>'):
        fail("sitemap declaration")
    if "&amp;" not in escaped or "&b/" in escaped.replace("&amp;", ""):
        fail("sitemap loc xml escaping")
    escaped_root = ET.fromstring(escaped)
    escaped_locs = [
        el.text
        for el in escaped_root.findall(
            "{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
        )
    ]
    if escaped_locs != ["https://koltigin.xyz/a&b/"]:
        fail(f"sitemap loc parse/dedupe: {escaped_locs}")
    ok("sitemap xml escaping and well-formedness")

    with tempfile.TemporaryDirectory() as raw:
        tmp = Path(raw)
        setup_root(tmp)
        leftover = tmp / "guide" / "en" / "demo-guide" / "index.html"
        leftover.parent.mkdir(parents=True, exist_ok=True)
        leftover.write_text("<html>stale</html>", encoding="utf-8")
        generate_share.generate(tmp)

        note_html = tmp / "writings" / "en" / "notes" / "no-cover" / "index.html"
        note_og = tmp / "assets" / "images" / "og" / "writings" / "en" / "notes" / "no-cover.png"
        if not note_html.is_file():
            fail("no-cover writing share html")
        html = read(note_html)
        for needle in (
            "Validator notes",
            "Uptime and keys.",
            'og:type" content="article"',
            'og:image:width" content="1200"',
            'twitter:card" content="summary_large_image"',
            "https://koltigin.xyz/assets/images/og/writings/en/notes/no-cover.png",
            "https://koltigin.xyz/writings/en/notes/no-cover/",
            "#/yazilar/notes/no-cover",
            'hreflang="tr"',
            'hreflang="x-default"',
        ):
            if needle not in html:
                fail(f"writing html missing {needle}")
        ok("writing without cover share html")
        if Image.open(note_og).size != (1200, 630):
            fail("fallback og size")
        if str(note_og.relative_to(tmp)) != "assets/images/og/writings/en/notes/no-cover.png":
            fail("writing og output path")
        ok("writing without cover 1200x630 png")

        tr_html = read(tmp / "writings" / "tr" / "notes" / "no-cover" / "index.html")
        if "Doğrulayıcı notları" not in tr_html or 'lang="tr"' not in tr_html:
            fail("tr metadata")
        ok("bilingual writing metadata")

        note_ld = json_ld(html)
        if note_ld.get("@type") != "BlogPosting":
            fail("writing json-ld type")
        if note_ld.get("headline") != "Validator notes":
            fail("writing json-ld headline")
        if note_ld.get("description") != "Uptime and keys.":
            fail("writing json-ld description")
        if note_ld.get("inLanguage") != "en":
            fail("writing json-ld language")
        if note_ld.get("url") != "https://koltigin.xyz/writings/en/notes/no-cover/":
            fail("writing json-ld url")
        if note_ld.get("mainEntityOfPage") != note_ld.get("url"):
            fail("writing json-ld mainEntityOfPage")
        if note_ld.get("image") != "https://koltigin.xyz/assets/images/og/writings/en/notes/no-cover.png":
            fail("writing json-ld image")
        if (note_ld.get("author") or {}).get("name") != "KolTigin":
            fail("writing json-ld author from displayName")
        if note_ld.get("datePublished") != "2026-08-29":
            fail("writing json-ld datePublished")
        if "#" in str(note_ld.get("url")):
            fail("json-ld url must not be a hash")
        tr_ld = json_ld(tr_html)
        if tr_ld.get("inLanguage") != "tr" or tr_ld.get("url") != "https://koltigin.xyz/writings/tr/notes/no-cover/":
            fail("tr writing json-ld locale url")
        if tr_ld.get("headline") != "Doğrulayıcı notları":
            fail("tr writing json-ld headline")
        if note_ld.get("url") == tr_ld.get("url"):
            fail("en/tr json-ld urls must differ")
        undated_html = read(tmp / "writings" / "en" / "notes" / "undated" / "index.html")
        undated_ld = json_ld(undated_html)
        if "datePublished" in undated_ld:
            fail("undated writing must omit datePublished")
        if undated_ld.get("@type") != "BlogPosting":
            fail("undated writing json-ld type")
        ok("writing json-ld")

        cover_og = tmp / "assets" / "images" / "og" / "writings" / "en" / "articles" / "with-cover.png"
        if Image.open(cover_og).size != (1200, 630):
            fail("custom cover og size")
        pixels = list(Image.open(cover_og).getdata())
        if (40, 80, 180) not in pixels[:50] and not any(p[2] > 150 for p in pixels[::100]):
            fail("custom cover raster should come from uploaded blue png")
        ok("writing with custom cover raster")
        cover_html = read(tmp / "writings" / "en" / "articles" / "with-cover" / "index.html")
        if "SoulMemory" not in cover_html or "with-cover.png" not in cover_html:
            fail("custom cover html")
        ok("writing with custom cover html")

        if (tmp / "writings" / "en" / "social" / "tweet" / "index.html").exists():
            fail("external x posts must not get share pages")
        ok("external writings skipped")

        spa_html = tmp / "guides" / "demo-guide" / "EN" / "index.html"
        guide_og = tmp / "assets" / "images" / "og" / "guides" / "en" / "demo-guide.png"
        ghtml = read(spa_html)
        if "Demo Guide" not in ghtml or "koltigin-share-guide" not in ghtml:
            fail("guide spa html")
        if "/guides/demo-guide/EN" not in ghtml:
            fail("guide spa canonical path")
        if "#/guides/demo-guide/EN" in ghtml:
            fail("guide spa must not bounce to hash")
        if (tmp / "guide" / "en" / "demo-guide" / "index.html").exists():
            fail("generator must not recreate legacy /guide/ stubs")
        if Image.open(guide_og).size != (1200, 630):
            fail("guide fallback size")
        if str(guide_og.relative_to(tmp)) != "assets/images/og/guides/en/demo-guide.png":
            fail("guide og output path")
        if generate_share.og_background_rel("notes") != generate_share.WRITING_OG_BACKGROUND:
            fail("writing kinds must use the writing master background")
        if generate_share.og_background_rel("articles") != generate_share.WRITING_OG_BACKGROUND:
            fail("articles must use the writing master background")
        if generate_share.og_background_rel("guide") != generate_share.GUIDE_OG_BACKGROUND:
            fail("guides must use the guide master background")
        ok("guide without cover")

        guide_ld = json_ld(ghtml)
        if guide_ld.get("@type") != "TechArticle":
            fail("guide json-ld type")
        if guide_ld.get("headline") != "Demo Guide":
            fail("guide json-ld headline")
        if "Install the node." not in str(guide_ld.get("description") or ""):
            fail("guide json-ld description")
        if guide_ld.get("inLanguage") != "en":
            fail("guide json-ld language")
        if guide_ld.get("url") != "https://koltigin.xyz/guides/demo-guide/EN":
            fail("guide json-ld url")
        if guide_ld.get("mainEntityOfPage") != guide_ld.get("url"):
            fail("guide json-ld mainEntityOfPage")
        if guide_ld.get("image") != "https://koltigin.xyz/assets/images/og/guides/en/demo-guide.png":
            fail("guide json-ld image")
        if "datePublished" in guide_ld:
            fail("guide json-ld must omit datePublished")
        guide_tr = json_ld(read(tmp / "guides" / "demo-guide" / "TR" / "index.html"))
        if guide_tr.get("inLanguage") != "tr" or guide_tr.get("url") != "https://koltigin.xyz/guides/demo-guide/TR":
            fail("tr guide json-ld locale url")
        if guide_tr.get("headline") != "Demo Rehber":
            fail("tr guide json-ld headline")
        ok("guide json-ld")

        covered_og = tmp / "assets" / "images" / "og" / "guides" / "en" / "covered-guide.png"
        if Image.open(covered_og).size != (1200, 630):
            fail("guide custom cover size")
        ok("guide with cover")

        sitemap = read(tmp / "sitemap.xml")
        if not sitemap.startswith('<?xml version="1.0" encoding="UTF-8"?>'):
            fail("sitemap xml declaration")
        if 'xmlns:xhtml' in sitemap or "<xhtml:" in sitemap:
            fail("sitemap must not use xhtml namespace")
        try:
            root = ET.fromstring(sitemap)
        except ET.ParseError as exc:
            fail(f"sitemap not well-formed XML: {exc}")
        if root.tag != "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset":
            fail(f"sitemap urlset namespace: {root.tag}")
        locs = [
            el.text
            for el in root.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
        ]
        if any(not loc for loc in locs):
            fail("empty loc")
        if "https://koltigin.xyz/" not in locs:
            fail("homepage sitemap")
        if any("#/" in (loc or "") for loc in locs):
            fail("hash url in sitemap")
        if not any(loc.endswith("/writings/en/notes/no-cover/") for loc in locs):
            fail("writing url sitemap")
        if not any(loc.endswith("/writings/tr/notes/no-cover/") for loc in locs):
            fail("writing tr url sitemap")
        if not any(loc.endswith("/guides/demo-guide/EN") for loc in locs):
            fail("guide url sitemap")
        if not any(loc.endswith("/guides/demo-guide/TR") for loc in locs):
            fail("guide tr url sitemap")
        if any("tweet" in (loc or "") or "/admin" in (loc or "") for loc in locs):
            fail("external or admin url in sitemap")
        expected_sections = [
            "https://koltigin.xyz/",
            "https://koltigin.xyz/about/",
            "https://koltigin.xyz/resume/",
            "https://koltigin.xyz/projects/",
            "https://koltigin.xyz/writings/",
            "https://koltigin.xyz/videos/",
            "https://koltigin.xyz/contact/",
            "https://koltigin.xyz/guides/",
        ]
        for url in expected_sections:
            if url not in locs:
                fail(f"missing section sitemap {url}")
        if len(locs) != len(set(locs)):
            fail("duplicate sitemap urls")
        about_html = read(tmp / "about" / "index.html")
        if "https://koltigin.xyz/about/" not in about_html:
            fail("about section canonical")
        writings_shell = read(tmp / "writings" / "index.html")
        if "koltigin-share-writing" in writings_shell:
            fail("writings list must not be a share redirect")
        if "https://koltigin.xyz/writings/" not in writings_shell:
            fail("writings section canonical")
        if 'og:image" content="https://koltigin.xyz/assets/images/social/og-koltigin.png"' not in about_html:
            fail("about section og image")
        if 'twitter:image" content="https://koltigin.xyz/assets/images/social/og-koltigin.png"' not in about_html:
            fail("about section twitter image")
        resume_html = read(tmp / "resume" / "index.html")
        if 'og:image" content="https://koltigin.xyz/assets/images/social/og-resume.png"' not in resume_html:
            fail("resume section og image")
        if 'twitter:card" content="summary_large_image"' not in resume_html:
            fail("resume twitter card")
        share_html = read(tmp / "writings" / "en" / "notes" / "no-cover" / "index.html")
        if "/assets/images/og/writings/en/notes/no-cover.png" not in share_html:
            fail("writing share og image")
        if "/assets/images/social/" in share_html:
            fail("writing share must not use section social image")
        ok("sitemap")

        write(
            tmp / "content" / "notes" / "en" / "no-cover.md",
            '---\ntitle: "Updated title"\ndate: "2026-08-29"\nsummary: "Changed."\n---\n\nBody.\n',
        )
        generate_share.generate(tmp)
        if "Updated title" not in read(tmp / "writings" / "en" / "notes" / "no-cover" / "index.html"):
            fail("update did not regenerate html")
        ok("update regenerates metadata")

        shutil.rmtree(tmp / "content" / "notes")
        shutil.rmtree(tmp / "content" / "guides" / "demo-guide")
        generate_share.generate(tmp)
        if (tmp / "writings" / "en" / "notes" / "no-cover" / "index.html").exists():
            fail("deleted writing share html remains")
        if (tmp / "assets" / "images" / "og" / "writings" / "en" / "notes" / "no-cover.png").exists():
            fail("deleted writing og remains")
        if (tmp / "guides" / "demo-guide" / "EN" / "index.html").exists():
            fail("deleted guide spa html remains")
        sitemap2 = read(tmp / "sitemap.xml")
        if "/writings/en/notes/no-cover/" in sitemap2 or "/guides/demo-guide/EN" in sitemap2:
            fail("deleted urls remain in sitemap")
        if (tmp / "writings" / "en" / "articles" / "with-cover" / "index.html").exists() is False:
            fail("unrelated writing share should remain")
        ok("delete removes html, og, sitemap entries")

        src = (ROOT / "scripts" / "generate-share.py").read_text(encoding="utf-8")
        if 'or "KolTigin"' in src or "koltigin-at.png" in src:
            fail("generator must not hardcode KolTigin identity fallbacks")
        if "KOLTIGIN" in src:
            fail("OG raster identity must not use uppercase KOLTIGIN")
        fallback_src = inspect.getsource(generate_share.render_fallback_png)
        identity_src = inspect.getsource(generate_share.identity_row_geometry)
        if "display_name" in fallback_src:
            fail("render_fallback_png must get identity text from the shared geometry helper")
        if "display_name(root)" not in identity_src:
            fail("identity block must use config displayName")
        if "identity_row_geometry" not in fallback_src:
            fail("fallback raster must use the shared identity overlay")
        if "paint_card_background" in fallback_src or "paste_ionicon" in fallback_src:
            fail("old procedural fallback drawing must not remain in render_fallback_png")
        if "OG_TITLE_MAX_RATIO" not in src or "title_max_width" not in src:
            fail("title width must stay margin/ratio constrained")
        ok("generator identity and title width stay config-driven")

        if generate_share.display_name(tmp) != "KolTigin":
            fail("current KolTigin displayName should still be used")
        avatar = generate_share.avatar_path(tmp)
        if avatar.name != "koltigin-at.png":
            fail("current KolTigin avatar should still be used")
        ok("KolTigin config still supplies approved identity")

        fallback_png = tmp / "assets" / "images" / "og" / "writings" / "en" / "notes" / "no-cover.png"
        # Recreate the deleted note so identity raster tests have a fallback PNG.
        write(
            tmp / "content" / "notes" / "en" / "no-cover.md",
            '---\ntitle: "Validator notes"\ndate: "2026-08-29"\nsummary: "Uptime and keys."\n---\n\nBody.\n',
        )
        write(
            tmp / "content" / "notes" / "tr" / "no-cover.md",
            '---\ntitle: "Doğrulayıcı notları"\ndate: "2026-08-29"\nsummary: "Uptime ve anahtarlar."\n---\n\nGövde.\n',
        )
        generate_share.generate(tmp)
        if Image.open(fallback_png).size != (1200, 630):
            fail("fallback png must remain 1200x630")
        html = read(tmp / "writings" / "en" / "notes" / "no-cover" / "index.html")
        if "Continue to KolTigin" not in html:
            fail("share html should use configured displayName")
        ok("fallback raster size and configured name")

        tiny_png(tmp / "assets" / "images" / "profile" / "other-author.png", (220, 30, 30))
        write(
            tmp / "config" / "site.json",
            '{"displayName":"Ada Lovelace","canonicalUrl":"https://koltigin.xyz/","avatar":"./assets/images/profile/other-author.png"}\n',
        )
        if generate_share.display_name(tmp) != "Ada Lovelace":
            fail("displayName changes should flow into the generator")
        if generate_share.avatar_path(tmp).name != "other-author.png":
            fail("avatar path changes should flow into the generator")
        generate_share.generate(tmp)
        html = read(tmp / "writings" / "en" / "notes" / "no-cover" / "index.html")
        if "Ada Lovelace" not in html or "KolTigin" in html:
            fail("share html should follow the new displayName")
        ada_ld = json_ld(html)
        if (ada_ld.get("author") or {}).get("name") != "Ada Lovelace":
            fail("json-ld author must follow displayName")
        fallback = Image.open(fallback_png)
        if fallback.size != (1200, 630):
            fail("renamed author fallback size")
        if not any(px[:3] == (220, 30, 30) for px in fallback.getdata()):
            fail("changed avatar should appear in the fallback raster")
        cover = Image.open(tmp / "assets" / "images" / "og" / "writings" / "en" / "articles" / "with-cover.png")
        if (40, 80, 180) not in list(cover.getdata())[:80] and not any(p[2] > 150 for p in list(cover.getdata())[::80]):
            fail("custom cover raster must stay independent of fallback avatar")
        writing_color = (12, 48, 96)
        guide_color = (18, 90, 40)
        Image.new("RGB", (1800, 940), writing_color).save(
            tmp / "assets" / "images" / "og" / "backgrounds" / "writing-og-background.png"
        )
        Image.new("RGB", (1800, 940), guide_color).save(
            tmp / "assets" / "images" / "og" / "backgrounds" / "guide-og-background.png"
        )
        writing_probe = tmp / "assets" / "images" / "og" / "writings" / "en" / "notes" / "probe-writing.png"
        guide_probe = tmp / "assets" / "images" / "og" / "guides" / "en" / "probe-guide.png"
        generate_share.render_fallback_png(
            tmp, writing_probe, title="Validator notes", kicker="Technical Note", kind="notes"
        )
        generate_share.render_fallback_png(
            tmp, guide_probe, title="Demo Guide", kicker="Guide", kind="guide"
        )
        if writing_color not in {px[:3] for px in Image.open(writing_probe).getdata()}:
            fail("writing fallback must composite onto the writing master background")
        if guide_color not in {px[:3] for px in Image.open(guide_probe).getdata()}:
            fail("guide fallback must composite onto the guide master background")
        if writing_color in {px[:3] for px in Image.open(guide_probe).getdata()}:
            fail("guide fallback must not use the writing master background")
        writing_spec = generate_share.identity_row_geometry(ImageDraw.Draw(Image.new("RGB", generate_share.OG_SIZE)), tmp, 1200, 630)
        guide_spec = generate_share.identity_row_geometry(ImageDraw.Draw(Image.new("RGB", generate_share.OG_SIZE)), tmp, 1200, 630)
        for key in ("title_top", "category_pt", "avatar_size", "avatar_xy", "divider", "brand_xy", "brand", "divider_width", "row_width"):
            if writing_spec[key] != guide_spec[key]:
                fail(f"writing/guide overlay geometry diverged at {key}")
        if writing_spec["title_top"] != generate_share.OG_TITLE_TOP:
            fail("title_top must stay at the approved overlay value")
        if writing_spec["category_pt"] != generate_share.OG_CATEGORY_PT:
            fail("category size must stay at the approved overlay value")
        if writing_spec["avatar_size"] != 114:
            fail("identity avatar must be 114px")
        x0, y0, x1, y1 = writing_spec["divider"]
        if x0 != x1:
            fail("identity divider must be vertical")
        if y1 <= y0:
            fail("vertical divider must have height")
        div_h = y1 - y0
        lo = int(round(writing_spec["avatar_size"] * 0.65))
        hi = int(round(writing_spec["avatar_size"] * 0.75))
        if not (lo <= div_h <= hi):
            fail("vertical divider height must be 65–75% of avatar")
        if writing_spec["row_width"] >= 1200 - 80:
            fail("identity block must stay compact, not full-canvas")
        if writing_spec["brand_pt"] != 33:
            fail("KolTigin identity type must be 33pt")
        x0, y0, x1, y1 = writing_spec["divider"]
        if writing_spec["divider_width"] != 3 or (y1 - y0) != 80:
            fail("identity divider must scale to 3×80")
        if writing_spec["brand"] != generate_share.display_name(tmp):
            fail("identity text must follow config displayName")
        fallback_fn = inspect.getsource(generate_share.render_fallback_png)
        if "OG_TITLE_TOP" not in fallback_fn or "identity_row_geometry" not in fallback_fn:
            fail("Writing and Guide must share the same overlay geometry helper")
        if ".upper()" not in fallback_fn:
            fail("category labels should render uppercase")
        long_title = "Ubuntu VPS üzerinde dağıtık altyapı ve doğrulayıcı operasyonu için ayrıntılı kurulum " * 4
        long_dest = tmp / "assets" / "images" / "og" / "writings" / "en" / "notes" / "long-title.png"
        generate_share.render_fallback_png(
            tmp, long_dest, title=long_title, kicker="Teknik Not", kind="notes"
        )
        if Image.open(long_dest).size != (1200, 630):
            fail("long title fallback must stay 1200x630")
        probe = Image.new("RGB", generate_share.OG_SIZE)
        probe_draw = ImageDraw.Draw(probe)
        max_w = generate_share.title_max_width(1200)
        font, lines, _lead = generate_share.fit_og_title(probe_draw, tmp, long_title, max_w)
        if any(probe_draw.textlength(line, font=font) > max_w + 1 for line in lines):
            fail("long titles must wrap inside the safe title width")
        ok("config identity changes the fallback signature only")

        write(
            tmp / "config" / "site.json",
            '{"displayName":"   ","canonicalUrl":"https://koltigin.xyz/","avatar":"./assets/images/profile/other-author.png"}\n',
        )
        try:
            generate_share.display_name(tmp)
            fail("blank displayName must fail")
        except RuntimeError as exc:
            if "displayName" not in str(exc):
                fail("blank displayName error should mention displayName")
        ok("blank displayName fails clearly")

        write(
            tmp / "config" / "site.json",
            '{"displayName":"Ada Lovelace","canonicalUrl":"https://koltigin.xyz/","avatar":"./assets/images/profile/missing-face.png"}\n',
        )
        try:
            generate_share.avatar_path(tmp)
            fail("missing avatar must fail")
        except RuntimeError as exc:
            if "not found" not in str(exc).lower() and "avatar" not in str(exc).lower():
                fail("missing avatar error should mention the file")
        try:
            generate_share.generate(tmp)
            fail("generate must not succeed without an avatar file")
        except RuntimeError:
            pass
        ok("missing avatar fails clearly")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    workflow = (ROOT / ".github" / "workflows" / "generate-share.yml").read_text(encoding="utf-8")
    if "git add writings guides" not in workflow:
        fail("share workflow must commit generated /guides/ html")
    if "git add -u -- guide" not in workflow:
        fail("share workflow must stage leftover /guide/ deletions")
    if "assets/images/og/backgrounds/**" not in workflow:
        fail("share workflow must watch OG master backgrounds")
    ofl = ROOT / "assets" / "fonts" / "OFL.txt"
    if "displayName" not in readme or "SIL Open Font License" not in readme:
        fail("README must document identity config and Poppins OFL")
    if not ofl.is_file() or "SIL OPEN FONT LICENSE" not in ofl.read_text(encoding="utf-8"):
        fail("assets/fonts/OFL.txt is required")
    ok("README and OFL notice")

    hash_src = (ROOT / "assets" / "js" / "blog-parser.js").read_text(encoding="utf-8")
    if r"^#\/yazilar\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([^/]+)$" not in hash_src and "#/yazilar/" not in hash_src:
        fail("writing hashes")
    guide_src = (ROOT / "assets" / "js" / "guides-parser.js").read_text(encoding="utf-8")
    if "#\\/guides/" not in guide_src and "parseGuideHash" not in guide_src:
        fail("guide hashes")
    ok("backward compatible hashes still present")
    print("all generate-share tests passed")


if __name__ == "__main__":
    main()
