"""Canonical public-slug helper shared by Python generators and admin servers."""
from __future__ import annotations

import re
import secrets
import unicodedata

SLUG_MAX_LEN = 72
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789"
SUFFIX_RE = re.compile(r"^[a-z0-9]{8}$")

# Applied before lowercase / NFKD. Do not rely on NFKD for ß -> ss.
_TRANSLIT = str.maketrans(
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
        "ß": "ss",
        "ẞ": "ss",
    }
)


def slugify(value: object) -> str:
    text = str(value or "").translate(_TRANSLIT)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    if len(text) <= SLUG_MAX_LEN:
        return text
    sliced = text[:SLUG_MAX_LEN]
    next_ch = text[SLUG_MAX_LEN] if len(text) > SLUG_MAX_LEN else ""
    if next_ch.isalnum() and sliced[-1:].isalnum() and "-" in sliced:
        sliced = sliced.rsplit("-", 1)[0]
    return sliced.strip("-")


def is_valid_slug(value: object) -> bool:
    text = str(value or "").strip()
    return bool(text) and bool(SLUG_RE.fullmatch(text)) and len(text) <= SLUG_MAX_LEN


def resolve_persisted_slug(explicit: object, existing: object, title: object) -> str:
    """Keep an existing slug. Generate from this locale's title only when missing."""
    requested = str(explicit or "").strip()
    if requested:
        if not is_valid_slug(requested):
            raise ValueError("Invalid slug")
        return requested
    current = str(existing or "").strip()
    if current:
        if not is_valid_slug(current):
            raise ValueError("Invalid slug")
        return current
    generated = slugify(title)
    if not is_valid_slug(generated):
        raise ValueError("Could not derive a slug from the title")
    return generated


def random_id_suffix(length: int = 8) -> str:
    if length < 1:
        raise ValueError("suffix length must be positive")
    return "".join(secrets.choice(ALPHANUM) for _ in range(length))


def _iso_date(date: object) -> str:
    text = str(date or "").strip()
    match = DATE_RE.fullmatch(text)
    if not match:
        raise ValueError("date must be YYYY-MM-DD")
    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        raise ValueError("date must be YYYY-MM-DD")
    return f"{year:04d}-{month:02d}-{day:02d}"


def new_writing_id(date: object, suffix: str | None = None) -> str:
    """Opaque writing ID. Not wired into production create paths in Phase 1."""
    token = suffix if suffix is not None else random_id_suffix()
    if not SUFFIX_RE.fullmatch(token):
        raise ValueError("suffix must be 8 lowercase alphanumeric characters")
    return f"{_iso_date(date)}-{token}"


def new_guide_id(date: object, suffix: str | None = None) -> str:
    """Opaque guide ID. Not wired into production create paths in Phase 1."""
    token = suffix if suffix is not None else random_id_suffix()
    if not SUFFIX_RE.fullmatch(token):
        raise ValueError("suffix must be 8 lowercase alphanumeric characters")
    compact = _iso_date(date).replace("-", "")
    return f"g-{compact}-{token}"
