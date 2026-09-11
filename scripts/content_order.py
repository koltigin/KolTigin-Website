"""Canonical publication-date sorting for listings."""
from __future__ import annotations

import re

DATE_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$")
DATE_EU = re.compile(r"^(\d{1,2})[./](\d{1,2})[./](\d{4})$")


def publication_stamp(value: object) -> int:
    raw = str(value or "").strip()
    if not raw:
        return 0
    match = DATE_ISO.match(raw)
    if match:
        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
    else:
        match = DATE_EU.match(raw)
        if not match:
            return 0
        day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
    if month < 1 or month > 12 or day < 1 or day > 31:
        return 0
    return (year * 10000) + (month * 100) + day


def sort_by_publication_date(items: list, *, date_key: str = "date", id_key: str = "id") -> list:
    return sorted(
        list(items or []),
        key=lambda item: (
            -publication_stamp(item.get(date_key) if isinstance(item, dict) else ""),
            str((item.get(id_key) if isinstance(item, dict) else item) or ""),
        ),
    )
