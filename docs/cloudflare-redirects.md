# Cloudflare localized-URL redirects (Phase 4C)

**Live date:** 2026-09-15

## Execution layer

Cloudflare **Bulk Redirects** are the sole live redirect mechanism for the 17
legacy stable-ID → localized-primary mappings.

| Item | Value |
|---|---|
| Bulk Redirect List | `koltigin_phase4c_localized_slugs` |
| Bulk Redirect Rule | `koltigin_phase4c_localized_slugs` |
| Entries | 17 |
| Status | 301 Permanent Redirect |
| Preserve query string | true |
| Include subdomains | false |
| Subpath matching | false |
| Preserve path suffix | false |
| Scope | Exact `https://koltigin.xyz` canonical trailing-slash legacy URLs only |

There is **no** second redirect layer in GitHub Pages HTML, meta refresh,
browser JS, Workers, or the static generator.

## Repository source of truth

| File | Role |
|---|---|
| `config/redirects.json` | Canonical path mappings. `enabled=true` is **declarative** (migration live). It does not generate redirects. |
| `config/cloudflare-bulk-redirects.json` | Derived absolute-URL item list. `activated=true` is **declarative** (Cloudflare list/rule live). Regenerating this file does not call the Cloudflare API. |
| `config/cloudflare-bulk-redirects.csv` | Deterministic dashboard import CSV (no header), derived from the same items. |
| `scripts/cloudflare_redirects.py` | Offline generator for the JSON/CSV artifacts. |
| `scripts/verify_phase4c_redirects_readonly.py` | Read-only production HTTP verifier. |

Regenerate artifacts (local only):

```bash
python3 scripts/cloudflare_redirects.py
```

## Verification

After activation (current production state):

```bash
python3 scripts/verify_phase4c_redirects_readonly.py
```

Pre-activation / rollback check (expects OLD still HTTP 200 aliases):

```bash
python3 scripts/verify_phase4c_redirects_readonly.py --expect-before
```

## Architecture notes (unchanged by Phase 4C)

- Phase 4B remains: default public URL mode `LOCALIZED`, sitemap/discovery/share/canonical already use localized primaries.
- Legacy ID HTML pages remain generated on GitHub Pages as rollback/fallback origin content; Cloudflare edge intercepts the public 17 OLD URLs with 301.
- Trailing-slash normalization for no-slash requests is separate existing edge behavior.
- `www` → apex canonicalization is separate existing behavior.
- HTTP → HTTPS is separate existing behavior.

## Rollback

1. Disable or detach the Cloudflare Bulk Redirect **Rule** `koltigin_phase4c_localized_slugs` (do not delete Phase 4B localized HTML).
2. Confirm OLD URLs return HTTP 200 again and NEW URLs remain 200 with localized SEO.
3. Optionally set repository `enabled`/`activated` back to `false` in a follow-up commit to match reality — edge rollback does not require reverting Phase 4B.
