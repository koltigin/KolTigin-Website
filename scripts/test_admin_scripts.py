#!/usr/bin/env python3
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import admin_scripts

failed = 0

def ok(msg):
    print("ok", msg)

def fail(msg):
    global failed
    failed += 1
    print("FAIL", msg)

try:
    admin_scripts.sanitize_script_filename("redbelly-monitor.sh")
    ok("valid .sh filename")
except Exception:
    fail("valid .sh filename")

try:
    admin_scripts.sanitize_script_filename("../evil.sh")
    fail("../evil.sh should reject")
except ValueError:
    ok("../evil.sh rejected")

try:
    admin_scripts.sanitize_script_filename("foo/bar.sh")
    fail("/ should reject")
except ValueError:
    ok("slash rejected")

try:
    admin_scripts.sanitize_script_filename("foo\\bar.sh")
    fail("backslash should reject")
except ValueError:
    ok("backslash rejected")

try:
    admin_scripts.sanitize_script_filename(".env")
    fail(".env should reject")
except ValueError:
    ok(".env rejected")

try:
    admin_scripts.sanitize_script_filename("tool.exe")
    fail("exe should reject")
except ValueError:
    ok("unsupported extension rejected")

try:
    admin_scripts.resolve_script_project("evil")
    fail("invalid project should reject")
except ValueError:
    ok("invalid project rejected")

projects = json.loads((ROOT / "projects" / "projects.json").read_text(encoding="utf-8"))
allowed = admin_scripts.get_allowed_download_projects(projects)
option_ids = [item["id"] for item in admin_scripts.build_script_options(projects)]
if "redbelly-network" in option_ids and "ario" in option_ids and "optimai" in option_ids:
    ok("dropdown options come from canonical Projects data")
else:
    fail("dropdown options come from canonical Projects data")
if option_ids[-1] == "common" and "common" in allowed:
    ok("Common is included")
else:
    fail("Common is included")
if "optimai" in allowed and "evil" not in allowed:
    ok("Projects slugs are allowed and fake slugs are not")
else:
    fail("Projects slugs are allowed and fake slugs are not")

path = admin_scripts.script_repo_path("redbelly", "redbelly-monitor.sh", allowed)
if path == admin_scripts.DOWNLOADS_ROOT / "redbelly" / "redbelly-monitor.sh":
    ok("server-side path is downloads/redbelly/filename")
else:
    fail("server-side path is downloads/redbelly/filename")

path = admin_scripts.script_repo_path("redbelly-network", "redbelly-monitor.sh", allowed)
if path == admin_scripts.DOWNLOADS_ROOT / "redbelly" / "redbelly-monitor.sh":
    ok("canonical Redbelly id maps to existing folder")
else:
    fail("canonical Redbelly id maps to existing folder")
if "downloads/redbelly-network/" in str(path):
    fail("canonical Redbelly id must not use downloads/redbelly-network/")
else:
    ok("canonical Redbelly id never uses downloads/redbelly-network/")

path = admin_scripts.script_repo_path("ario", "ario-gateway.sh", allowed)
if path == admin_scripts.DOWNLOADS_ROOT / "ario" / "ario-gateway.sh":
    ok("AR.IO path remains downloads/ario/")
else:
    fail("AR.IO path remains downloads/ario/")

path = admin_scripts.script_repo_path("common", "shared.sh", allowed)
if path == admin_scripts.DOWNLOADS_ROOT / "common" / "shared.sh":
    ok("Common path remains downloads/common/")
else:
    fail("Common path remains downloads/common/")

path = admin_scripts.script_repo_path("optimai", "optimai-setup.sh", allowed)
if path == admin_scripts.DOWNLOADS_ROOT / "optimai" / "optimai-setup.sh":
    ok("optimai uses downloads/optimai/")
else:
    fail("optimai uses downloads/optimai/")

path = admin_scripts.script_repo_path("nodepay", "nodepay-setup.sh", allowed)
if path == admin_scripts.DOWNLOADS_ROOT / "nodepay" / "nodepay-setup.sh":
    ok("nodepay uses downloads/nodepay/")
else:
    fail("nodepay uses downloads/nodepay/")

future_allowed = admin_scripts.get_allowed_download_projects({
    **projects,
    "depin": list(projects.get("depin") or []) + [{"id": "future-project", "name": "Future Project"}],
})
path = admin_scripts.script_repo_path("future-project", "new-tool.sh", future_allowed)
if path == admin_scripts.DOWNLOADS_ROOT / "future-project" / "new-tool.sh":
    ok("new canonical ids use downloads/{canonical-id}/")
else:
    fail("new canonical ids use downloads/{canonical-id}/")

try:
    admin_scripts.script_repo_path("../etc", "x.sh", allowed)
    fail("arbitrary path should reject")
except ValueError:
    ok("arbitrary repository path rejected")

url = admin_scripts.public_script_url("redbelly", "redbelly-monitor.sh")
if url == "https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh":
    ok("public URL")
else:
    fail("public URL")

listed = admin_scripts.list_scripts()
listed_ids = [item["id"] for item in listed.get("options") or []]
if "common" in listed_ids and "redbelly-network" in listed_ids:
    ok("list options include Projects data plus Common")
else:
    fail("list options include Projects data plus Common")
if all((group.get("scripts") or []) for group in listed.get("groups") or []):
    ok("existing Scripts omit empty project sections")
else:
    fail("existing Scripts omit empty project sections")

if failed:
    sys.exit(1)
print("all local admin script tests passed")
