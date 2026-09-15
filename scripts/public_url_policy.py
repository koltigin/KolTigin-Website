"""Central public-URL / SEO migration policy for Phase 4A.

Modes:
  CURRENT_ID  — Phase 3 production behavior (default).
  LOCALIZED   — future primary URLs use locale slugs; prepared but not default.

Stable IDs remain the pairing / storage / fetch identity in both modes.
"""
from __future__ import annotations

MODE_CURRENT_ID = "CURRENT_ID"
MODE_LOCALIZED = "LOCALIZED"
DEFAULT_MODE = MODE_CURRENT_ID

ROBOTS_NOINDEX_FOLLOW = "noindex,follow"

# Existing site policy: x-default prefers the English alternate when present.
X_DEFAULT_PREFERS_EN = True


class PublicUrlModeError(ValueError):
    """Invalid public URL mode."""


def normalize_mode(mode: object | None) -> str:
    """Accept only CURRENT_ID / LOCALIZED (plus empty → default). Reject all else."""
    if mode is None or mode == "":
        return DEFAULT_MODE
    text = str(mode).strip().upper()
    if text == MODE_CURRENT_ID:
        return MODE_CURRENT_ID
    if text == MODE_LOCALIZED:
        return MODE_LOCALIZED
    raise PublicUrlModeError(f"unknown public URL mode: {mode!r}")


def is_localized_mode(mode: object | None) -> bool:
    return normalize_mode(mode) == MODE_LOCALIZED


def locale_slug_or_id(item_id: str, locale_slug: object) -> str:
    slug = str(locale_slug or "").strip()
    return slug if slug else str(item_id or "").strip()


def writing_id_path(lang: str, kind: str, item_id: str) -> str:
    loc = "tr" if str(lang).lower() == "tr" else "en"
    return f"/writings/{loc}/{kind}/{item_id}/"


def writing_localized_path(lang: str, kind: str, public_slug: str) -> str:
    loc = "tr" if str(lang).lower() == "tr" else "en"
    return f"/writings/{loc}/{kind}/{public_slug}/"


def writing_primary_path(
    mode: object | None,
    lang: str,
    kind: str,
    item_id: str,
    locale_slug: object,
) -> str:
    """Primary public path for one writing locale under the active mode."""
    if is_localized_mode(mode):
        return writing_localized_path(lang, kind, locale_slug_or_id(item_id, locale_slug))
    return writing_id_path(lang, kind, item_id)


def guide_id_path(item_id: str, lang: str) -> str:
    code = "TR" if str(lang).upper() == "TR" or str(lang).lower() == "tr" else "EN"
    return f"/guides/{item_id}/{code}/"


def guide_localized_path(public_slug: str, lang: str) -> str:
    code = "TR" if str(lang).upper() == "TR" or str(lang).lower() == "tr" else "EN"
    return f"/guides/{public_slug}/{code}/"


def guide_primary_path(
    mode: object | None,
    item_id: str,
    lang: str,
    locale_slug: object,
) -> str:
    if is_localized_mode(mode):
        return guide_localized_path(locale_slug_or_id(item_id, locale_slug), lang)
    return guide_id_path(item_id, lang)


def writing_share_rel(lang: str, kind: str, segment: str) -> str:
    loc = "tr" if str(lang).lower() == "tr" else "en"
    return f"writings/{loc}/{kind}/{segment}/index.html"


def guide_share_rel(lang: str, segment: str) -> str:
    code = "TR" if str(lang).lower() == "tr" else "EN"
    return f"guides/{segment}/{code}/index.html"


def path_to_abs(origin: str, path: str) -> str:
    base = str(origin or "").rstrip("/")
    return f"{base}{path}"


def writing_alternates(
    mode: object | None,
    origin: str,
    kind: str,
    item_id: str,
    langs: dict[str, object],
) -> dict[str, str]:
    """hreflang target map for a writing item under the active mode."""
    out: dict[str, str] = {}
    for lang, data in langs.items():
        slug = ""
        if isinstance(data, dict):
            slug = str(data.get("slug") or "").strip()
        elif data is not None:
            slug = str(data).strip()
        path = writing_primary_path(mode, lang, kind, item_id, slug)
        out[lang] = path_to_abs(origin, path)
    return out


def guide_alternates(
    mode: object | None,
    origin: str,
    item_id: str,
    langs: dict[str, object],
) -> dict[str, str]:
    out: dict[str, str] = {}
    for lang, data in langs.items():
        slug = ""
        if isinstance(data, dict):
            slug = str(data.get("slug") or "").strip()
        elif data is not None:
            slug = str(data).strip()
        path = guide_primary_path(mode, item_id, lang, slug)
        out[lang] = path_to_abs(origin, path)
    return out


def x_default_url(alternates: dict[str, str]) -> str | None:
    """Existing policy: prefer English when present, else first alternate."""
    if not alternates:
        return None
    if X_DEFAULT_PREFERS_EN and "en" in alternates:
        return alternates["en"]
    return next(iter(alternates.values()))


def robots_for_destination(
    mode: object | None,
    *,
    is_extra_localized_copy: bool,
) -> str | None:
    """Robots meta for a generated HTML destination.

    CURRENT_ID: Phase 3 noindex on true dual-publish localized copies only.
    LOCALIZED: temporary Phase 3 noindex is removed; no conflicting index tag.
    """
    if not is_extra_localized_copy:
        return None
    if is_localized_mode(mode):
        return None
    return ROBOTS_NOINDEX_FOLLOW


def sitemap_loc_for_locale(
    mode: object | None,
    *,
    kind: str | None,
    item_id: str,
    lang: str,
    locale_slug: object,
    content_type: str,
) -> str:
    """Relative public path that belongs in the sitemap for one content+locale."""
    if content_type == "guide":
        return guide_primary_path(mode, item_id, lang, locale_slug)
    return writing_primary_path(mode, lang, str(kind or ""), item_id, locale_slug)
