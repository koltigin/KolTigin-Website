# KolTigin admin write API (Cloudflare Worker)

Same-origin publisher for `https://koltigin.xyz/admin/`.

```
Admin frontend (Cloudflare Access + MFA)
  POST /api/admin/...
    Cloudflare Worker (this folder)
      GitHub API (fine-grained PAT in a Worker Secret)
        koltigin/KolTigin-Website @ main
```

The Worker never sends the GitHub token to the browser. The existing `koltigin-contact` Worker is unrelated and must stay unchanged.

## Architecture

- Frontend GET still reads static GitHub Pages files.
- Frontend POST/upload goes to `/api/admin/*` (`admin.js` rewrites `/admin/api/...` → `/api/admin/...` in production).
- Worker verifies `CF-Access-Jwt-Assertion` (RS256 against the team JWKS, expected `aud`).
- Allowed writes are path-allowlisted (config, `content/` including custom `{type}/{en|tr}/*.md`, generated JSON, `guides/`, `i18n/`, image folders only).
- Markdown/JSON changes and generated indexes are committed together via the Git Trees API so a save is one fast-forward on `main`.

## Generator strategy

Python generators cannot run inside the Worker.

**Chosen: option A — Worker updates generated JSON in the same commit as the source files.**

Public schema matches the Python generators:

| Save | Source of truth | Generated in the same commit | Public consumer |
| --- | --- | --- | --- |
| Writing / video / writing-types | `content/**/*.md`, `config/writing-types.json` | `content/index.json` (`types`, per-kind `{en,tr}` filename lists, `videos`) | `blog-parser.js` / `videos-parser-new.js` load Markdown from those names, then sort by date |
| Project / project-categories | `content/projects/**/*.md`, `config/project-categories.json` | `projects/projects.json` (same public fields as `generate-projects.py`) | `projects-parser.js` renders the JSON |
| Guide | `guides/{id}/EN.md`, `TR.md` | `guides/index.json` `{ guides: [id…] }` | admin + optional listing |

### Limitation (not an admin-write blocker)

The Worker **patches** generated JSON for the files in that save; it does **not** re-scan the whole tree like `scripts/generate-writings.py` / `scripts/generate-projects.py`.

- Public writings/videos **re-sort from Markdown dates**, so filename order inside `index.json` is not the public order.
- Markdown edited only on GitHub (never through admin) can be missing from the generated index until the next matching admin save or a local generator run.

Single-writing Save with a changed category sends `{ fromKind, kind }` (existing admin contract). The Worker moves both languages, rewrites front matter (including internal ↔ X Post), updates `content/index.json`, and commits once.

`.github/workflows/generate-projects.yml` exists locally but was **not** pushed earlier (GitHub OAuth token lacked `workflow` scope). Admin writes do **not** depend on it. Optionally add that workflow later (with a `workflow`-scoped push) as a backup if someone edits project Markdown on GitHub by hand.

## Env vars

### Secrets (`wrangler secret put`)

| Name | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained PAT used only by the Worker |

Optional extra lock (can also be a secret):

| Name | Purpose |
| --- | --- |
| `ACCESS_EMAILS` | Comma-separated allowlist of Access emails. Empty = any identity that passed the Access application |

### Public/config (`[vars]` in `wrangler.toml` or dashboard)

These are identifiers, not GitHub credentials. Still do not put them in the admin frontend.

| Name | Purpose |
| --- | --- |
| `GITHUB_OWNER` | `koltigin` |
| `GITHUB_REPO` | `KolTigin-Website` |
| `GITHUB_BRANCH` | `main` |
| `ACCESS_TEAM_DOMAIN` | Team host, e.g. `example.cloudflareaccess.com` (no `https://`) |
| `ACCESS_AUD` | Access **Application Audience** tag |

`ACCESS_AUD` is the application’s audience UUID/tag from Zero Trust. It is not a PAT. The frontend must not embed it; the Worker checks the JWT `aud` claim server-side.

### How to copy the Access audience

Zero Trust → Access → Applications → the app that protects `koltigin.xyz/admin` → **Application Audience** (`aud`). Also note the team domain from the Access login URL.

Protect **`koltigin.xyz/api/admin*`** with the **same** Access application (or an application with the same audience and the same owner policy). Browser calls already send the Access JWT when the user is logged in.

## GitHub token permissions

Fine-grained PAT, repository `koltigin/KolTigin-Website` only:

- **Contents: Read and write**
- No workflow, no admin, no secrets

Classic PAT is possible but broader; prefer fine-grained.

## Worker route

In Cloudflare (website zone `koltigin.xyz`):

1. Create Worker `koltigin-admin-api` from this folder (do not overwrite `koltigin-contact`).
2. Add route: `koltigin.xyz/api/admin*` → this Worker.
3. Do **not** point `/api/admin` at GitHub Pages.

## Deploy (manual, not done in this prep)

```bash
cd workers/admin-api
npx wrangler secret put GITHUB_TOKEN
# set ACCESS_TEAM_DOMAIN and ACCESS_AUD in the dashboard or wrangler.toml vars
npx wrangler deploy
```

Then attach the route and Access policy. Confirm a Save from `https://koltigin.xyz/admin/` creates a commit on `main`.

## Rollback

- Cloudflare → Workers → this Worker → rollback previous deployment, **or**
- Remove/disable the `koltigin.xyz/api/admin*` route so Saves return not-connected again.
- GitHub: revert the content commit if a bad publish landed.

## Local tests (no GitHub token)

```bash
cd workers/admin-api
node test/run.mjs
```

`TEST_MODE=1` skips Access JWT and uses an in-memory GitHub mock (validation, allowlist, generators, uploads).

## Endpoints (POST)

`/api/admin/save` (writings, videos, writing delete via `{action:"delete"}`)
`/api/admin/site`
`/api/admin/page`
`/api/admin/project-save` (project delete via `{action:"delete"}`)
`/api/admin/project-categories`
`/api/admin/guide-save`
`/api/admin/guide-delete`
`/api/admin/contact`
`/api/admin/writing-types`
`/api/admin/cover` `avatar` `project-logo` `guide-image` (multipart)

Success: `{ "ok": true, ... }`. Error: `{ "ok": false, "error": "safe message" }`.

## Category delete / migrate

Same POST bodies as local CMS. Validation runs **before** any GitHub commit. Failure leaves `main` unchanged.

### Projects (`POST /api/admin/project-categories`, `{ action: "delete", id, moveTo? }`)

- Protected categories cannot be deleted (403).
- Empty custom category: delete config + folder files (including `.gitkeep`) and rewrite `projects/projects.json` in one commit.
- Occupied category: `moveTo` is required (409 `This category contains {n} projects.`).
- `moveTo`: every project Markdown moves to the target folder, `category:` is updated, source category is removed. Destination slug/path collision → 409, no commit.
- Non-Markdown leftovers in the source folder → 409 (avoids silent asset loss).

### Writings (`POST /api/admin/writing-types`, `{ action: "delete", id, moveTo?, externalUrl? }`)

- Core types (`articles`, `notes`, `social`) cannot be deleted (403).
- Empty custom type: delete `config/writing-types.json` + `content/index.json` in one commit.
- Occupied type: `moveTo` is required (409). Shared writing IDs are kept (`content/{from}/{lang}/{id}.md` → `content/{to}/{lang}/{id}.md`).
- Destination filename collision → 409, no commit.
- Move to X Post (`mode: external`, including `social`): a valid `https://x.com/…` or `twitter.com` URL is required (`Original X URL is required…`), from `externalUrl` on the request or existing front matter.
- Move to an internal type strips `externalUrl`.

### Transaction / risks

- One Git Trees commit per admin action (source + generated JSON). Fast-forward only; if `main` moved, 409 — retry is safe (no partial migrate on the branch).
- Worker JSON patches follow the public generator schema; they are not a full-tree Python rescan (see Generator strategy).
- Do not retry a successful migrate as a second delete of the same source id (it will 404). Retry only after 409/5xx.
