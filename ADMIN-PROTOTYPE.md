# Admin prototype (local only)

This is a **local UX prototype**. It is not production CMS, not GitHub publishing, and not real authentication.

## Start

From `KolTigin-Website`:

```bash
python3 scripts/admin-dev-server.py
```

The server binds to `127.0.0.1` only (default port `3000`). It serves the public site and `/admin/`.

If port 3000 is already used by `python3 -m http.server`, stop that process first, or run:

```bash
PORT=3001 python3 scripts/admin-dev-server.py
```

Open:

- Public site: `http://127.0.0.1:3000/`
- Admin: `http://127.0.0.1:3000/admin/`

The terminal prints a one-time **login code**. That code is not stored in the frontend. It is also written to a gitignored file `.admin-dev-code` while the server runs.

## Login

Enter the terminal code. This is a development gate for the prototype UI. It is not production auth, not a GitHub token, and not a password you should reuse.

## What it does

- Lists Articles, Technical Notes, X Posts, and Videos from local Markdown
- New Article / Note / X Post forms with English and Turkish tabs
- Shared content ID locks from the **first title you fill** (Turkish-first or English-first) and does not change
- Date and Original X URL are shared across language tabs
- Optional cover picker as **preview only**
- 16:9 fallback cover using the title in the active language
- Markdown toolbar and Generated Markdown preview
- Save writes a **new** file under `content/…`, then runs `scripts/generate-writings.py` so `content/index.json` updates

## What it does not do

- No GitHub API, tokens, Actions, Pages, CNAME, DNS, Cloudflare, or Worker changes
- No production login
- Does not copy cover images into `assets/images/blog/`
- Does not edit Projects
- Does not delete content
- Existing files cannot be overwritten; add the missing language as a new file if that path is free

Stop the server with Ctrl+C. The login code file is removed on exit.
