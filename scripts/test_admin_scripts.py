#!/usr/bin/env python3
from pathlib import Path
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

path = admin_scripts.script_repo_path("redbelly", "redbelly-monitor.sh")
if path == admin_scripts.DOWNLOADS_ROOT / "redbelly" / "redbelly-monitor.sh":
    ok("server-side path is downloads/redbelly/filename")
else:
    fail("server-side path is downloads/redbelly/filename")

url = admin_scripts.public_script_url("redbelly", "redbelly-monitor.sh")
if url == "https://koltigin.xyz/downloads/redbelly/redbelly-monitor.sh":
    ok("public URL")
else:
    fail("public URL")

listed = admin_scripts.list_scripts()
if set(item["id"] for item in listed["projects"]) == {"redbelly", "ario", "common"}:
    ok("list groups built-in projects")
else:
    fail("list groups built-in projects")

if failed:
    sys.exit(1)
print("all local admin script tests passed")
