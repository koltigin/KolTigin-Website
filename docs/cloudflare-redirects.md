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

## Historical singular guide aliases — live, production verified

The September 9 migration removed four `/guide/{lang}/{id}/` pages. The
Phase 4C list covers the later localized-slug migration, not these older paths.
The repair is a **separate exact-match list**; the existing 17 mappings and their
strict validator remain unchanged.

- Source: `config/historical-guide-redirects.json` (`enabled=true`).
- Offline validator/generator: `scripts/historical_guide_redirects.py`.
- Generated artifacts: `config/cloudflare-historical-guide-redirects.json`
  (`activated=true`) and `config/cloudflare-historical-guide-redirects.csv`.
- Active list/rule name: `koltigin_historical_guides`.
- Eight entries: each source below with AND without its trailing slash.
- Every entry: 301, preserve query string, no subdomains, no subpath matching,
  no path suffix preservation. No wildcard redirects.

| Historical source (also without trailing slash) | Direct final destination |
|---|---|
| `/guide/en/optimai-cli-node-setup-guide-ubuntu-24-04-vps/` | `/guides/optimai-cli-node-setup-guide-ubuntu-24-04-vps/EN/` |
| `/guide/tr/optimai-cli-node-setup-guide-ubuntu-24-04-vps/` | `/guides/optimai-cli-node-kurulum-rehberi-ubuntu-24-04-vps/TR/` |
| `/guide/en/aro-network-depin-ubuntu-vps-installation-guide/` | `/guides/aro-network-depin-ubuntu-vps-installation-guide/EN/` |
| `/guide/tr/aro-network-depin-ubuntu-vps-installation-guide/` | `/guides/aro-network-depin-ubuntu-vps-kurulum-rehberi/TR/` |

Production verification passed: all eight aliases return a direct 301 to their
final 200 canonical destinations, with query strings preserved. All 17 existing
redirects still pass; the sitemap is unchanged and all 36 entries return 200
with correct canonicals.

Local regeneration and validation (no Cloudflare changes):

```bash
python3 -B scripts/historical_guide_redirects.py
python3 -B scripts/test_historical_guide_redirects.py
python3 -B scripts/test_slug_phase4c.py
```

Validation permits only the eight known sources, derives required targets from
`content/url-map.json`, validates the primary manifest with its existing rules,
and rejects duplicate sources, cross-list collisions, chains and loops. Multiple
historical sources may share a final destination; this does not relax validation
of `config/redirects.json`. Regression tests also check generated CSV/JSON parity,
canonical HTML, sitemap membership, and an offline exact-match/query model.
That model is not a Cloudflare runtime test.

Deployment method (completed): import the historical CSV
into the separate list and attach its Bulk Redirect Rule without replacing the
Phase 4C list/rule. Check every source, with/without slash and with query strings,
for one 301 directly to its final 200 canonical destination; rerun the existing
Phase 4C verifier. Only then record activation in the historical manifest and
regenerate its artifacts. Do not add old aliases to the sitemap or recreate HTML,
meta-refresh, JS, or Worker redirect layers.

Rollback: disable only the historical rule. The primary 17 redirects and current
canonical pages must remain in place. Reset historical activation metadata if it
had been recorded. Without the historical rule these source URLs return 404;
local artifact generation and Git pushes cannot activate the repair.
