# KolTigin

Public site for [koltigin.xyz](https://koltigin.xyz/). Static HTML, CSS, and JavaScript, hosted on GitHub Pages.

English is the default language. Turkish is a manual choice stored in the browser.

## Local preview

```bash
python3 -m http.server 3000
```

Open `http://127.0.0.1:3000`.

## Content updates

Edit Markdown and JSON in this repository. See [CONTENT-MAINTENANCE.md](./CONTENT-MAINTENANCE.md). Ordinary content work does not require changing renderer JavaScript.

## Contact form

The public form posts to a Cloudflare Worker. The Worker endpoint is listed in `config/site.json`. Do not put API keys or secrets in this repository.
