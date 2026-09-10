#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("generate_projects", ROOT / "scripts" / "generate-projects.py")
mod = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(mod)

failed = 0


def assert_true(cond: bool, msg: str) -> None:
    global failed
    if not cond:
        failed += 1
        print("FAIL", msg)
    else:
        print("ok", msg)


GUIDE = "optimai-cli-node-setup-guide-ubuntu-24-04-vps"
path = Path("content/projects/depin/optimai.md")

links = mod.normalize_links(
    [
        {"label": "Website", "url": "https://optimai.network"},
        {"label": "Setup Guide", "guide": GUIDE},
        {"label": "Ghost", "guide": "deleted-or-missing-guide"},
    ],
    path,
)
assert_true(any(link.get("guide") == GUIDE for link in links), "Guide linked to OptimAI appears on OptimAI project")
assert_true(not any(link.get("guide") == "deleted-or-missing-guide" for link in links), "missing/deleted Guide never renders a ghost button")
assert_true(not any(link.get("guide") and link.get("url") for link in links), "no manual absolute Guide URL required")
guide_link = next(link for link in links if link.get("guide") == GUIDE)
assert_true(guide_link["label"] == "Setup Guide", "single Guide uses Setup Guide label for i18n")

multi = mod.normalize_links(
    [
        {"label": "Website", "url": "https://optimai.network"},
        {"label": {"en": "Update Guide", "tr": "Güncelleme Rehberi"}, "guide": GUIDE},
        {"label": "Setup Guide", "guide": GUIDE},
    ],
    path,
)
assert_true(sum(1 for link in multi if link.get("guide")) == 2, "multiple Guides can be associated with one Project")
custom = next(link for link in multi if link.get("guide") and isinstance(link.get("label"), dict))
assert_true(custom["label"]["en"] == "Update Guide" and custom["label"]["tr"] == "Güncelleme Rehberi", "custom bilingual Guide labels are preserved")

generated = mod.build_projects()
optimai = next(item for item in generated["depin"] if item["id"] == "optimai")
assert_true(any(link.get("guide") == GUIDE for link in optimai["links"]), "existing OptimAI Guide relationship is recognized/backfilled")
assert_true(any(link.get("label") == "Website" for link in optimai["links"]), "normal manual project links remain unchanged")

if failed:
    sys.exit(1)
print("all generate-projects guide tests passed")
