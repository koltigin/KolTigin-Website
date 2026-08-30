# Content maintenance

GitHub is the source of truth. Edit the files below, commit, and GitHub Pages will serve the update. Ordinary content updates should not require editing renderer JavaScript.

English is the site default. Turkish is selected with the EN | TR control. The choice is stored in `localStorage` (`siteLang`). Do not add `/en/` or `/tr/` URLs; both languages share `https://koltigin.xyz/`.

## Profile, social URLs, avatar, Worker, SEO

File: `config/site.json`

- Display name, motto, avatar, email, WhatsApp, social URLs
- Worker endpoint (`contact.endpoint`) and map embed URL
- GitHub owner / repo / branch for the Last Update label
- Localized tagline and location: `{ "en": "...", "tr": "..." }`
- Localized SEO: `seo.en` and `seo.tr` (`title`, `description`)
- Canonical URL and social image path: `canonicalUrl`, `ogImage`

Replace the avatar at `assets/images/profile/profile.jpg`, or change `avatar`.

Replace the Open Graph / Twitter image at `assets/images/common/og-image.png` if the sharing card should change.

## UI labels

- English: `i18n/en.json`
- Turkish: `i18n/tr.json`

Interface strings only. Do not put article or resume paragraphs here.

## About

- English: `content/about/en.md`
- Turkish: `content/about/tr.md`

Keep the `icon:` line under each `###` service heading.

## Resume

- English: `content/resume/en.md`
- Turkish: `content/resume/tr.md`

Keep the heading structure (Summary / Experience / Education / Focus / Tools, or the Turkish equivalents).

## Projects

Single file: `projects/projects.json`

Language-independent: logos, links, referrals, guides, grouping, `formerName`.

Localized summaries:

```json
"summary": { "en": "...", "tr": "..." }
```

Replace logos under `assets/images/projects/`.

## Articles and technical notes

Separate files per language, same basename:

- `content/articles/en/` and `content/articles/tr/`
- `content/notes/en/` and `content/notes/tr/`

Then list both in `content/index.json`:

```json
"articles": {
  "en": ["2025-01-13-sei-defi-tasarim.md"],
  "tr": ["2025-01-13-sei-defi-tasarim.md"]
}
```

A file that is not listed will not appear. Covers go in `assets/images/blog/`.

## X posts

There are no live posts yet. Add Markdown under `content/social/en/` and `content/social/tr/`, then list filenames in `content/index.json` → `social.en` / `social.tr`. Use `externalUrl` in front matter to open X.

## Videos

Keep one Markdown file per video in `content/videos/`. List it once in `content/index.json` → `videos`.

Add bilingual titles in front matter:

```yaml
title: "Original title"
title_tr: "Turkish title"
title_en: "English title"
youtubeId: "..."
youtubeUrl: "https://youtu.be/..."
date: "YYYY-MM-DD"
```

Do not duplicate the 36 files.

## Guides

`guides/{id}/EN.md` and `guides/{id}/TR.md`. The global EN | TR control chooses the file. Point a project link at `"guide": "{id}"`.

## Production files that are not everyday content

- `CNAME` — GitHub Pages custom domain (`koltigin.xyz`)
- `robots.txt` and `sitemap.xml`
- `404.html`

## What you should not need to edit

`assets/js/*` parsers, layout CSS, and the Cloudflare Worker — unless you are changing behavior, not content. Never commit API keys, SMTP passwords, or Worker secrets.
