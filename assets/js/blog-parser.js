'use strict';

class BlogParser {
  constructor() {
    this.items = [];
    this.filter = 'all';
    this.currentItem = null;
    this.section = document.querySelector('.blog[data-page="blog"]');
    this.view = this.section?.querySelector('[data-writings-view]');
    this.filterNav = this.section?.querySelector('[data-writings-filter]');
    this.kinds = {
      articles: { id: 'articles', icon: 'document-text-outline' },
      notes: { id: 'notes', icon: 'code-slash-outline' },
      social: { id: 'social', icon: 'logo-twitter' }
    };
  }

  t(key, fallback) {
    return window.KolTiginI18n ? window.KolTiginI18n.t(key, null, fallback) : fallback || key;
  }

  applyKindLabels() {
    this.kinds.articles.label = this.t('writings.filters.articles', 'Articles');
    this.kinds.articles.card = this.t('writings.card.articles', 'Article');
    this.kinds.notes.label = this.t('writings.filters.notes', 'Technical Notes');
    this.kinds.notes.card = this.t('writings.card.notes', 'Technical Note');
    this.kinds.social.label = this.t('writings.filters.social', 'X Posts');
    this.kinds.social.card = this.t('writings.card.social', 'X Post');
  }

  async init() {
    if (!this.section || !this.view) return;
    if (window.KolTiginI18n && window.KolTiginI18n.ready) {
      await window.KolTiginI18n.ready;
    }
    this.applyKindLabels();
    this.bindUi();
    this.wrapActivatePage();
    this.bindHash();
    await this.loadItems();
    if (window.location.hash.startsWith('#/yazilar/')) this.openFromHash();
    else this.renderList();
  }

  wrapActivatePage() {
    const original = window.activatePage;
    if (typeof original !== 'function' || original._writingsWrapped) return;
    this.activateOriginal = original;

    const wrapped = (pageName) => {
      if (pageName === 'blog') {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      } else if (window.location.hash.startsWith('#/yazilar')) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      original(pageName);
      if (pageName === 'blog') this.renderList();
    };
    wrapped._writingsWrapped = true;
    window.activatePage = wrapped;
  }

  bindHash() {
    window.addEventListener('hashchange', () => {
      if (window.location.hash.startsWith('#/yazilar/')) this.openFromHash();
    });
  }

  openFromHash() {
    const match = window.location.hash.match(/^#\/yazilar\/(articles|notes|social)\/([^/]+)$/i);
    if (!match) return;
    if (typeof this.activateOriginal === 'function') this.activateOriginal('blog');
    this.showItem(`${match[1]}/${decodeURIComponent(match[2])}`);
  }

  bindUi() {
    this.filterNav?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-writings-kind]');
      if (!button) return;
      this.filter = button.dataset.writingsKind || 'all';
      this.updateFilterButtons();
      this.renderList();
    });

    this.view.addEventListener('click', (event) => {
      const back = event.target.closest('[data-writings-back]');
      if (back) {
        event.preventDefault();
        this.showList();
        return;
      }

      const open = event.target.closest('[data-writings-open]');
      if (open) {
        event.preventDefault();
        this.showItem(open.dataset.writingsOpen);
      }
    });

    this.view.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-copy-code]');
      if (!button) return;
      const code = button.closest('.guide-code-wrap')?.querySelector('code')?.textContent || '';
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        const field = document.createElement('textarea');
        field.value = code;
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      button.textContent = this.t('writings.copied', 'Copied');
      window.setTimeout(() => {
        button.textContent = this.t('writings.copy', 'Copy');
      }, 1400);
    });
  }

  bindCoverFallbacks() {
    this.view.querySelectorAll('.writings-cover img, .writings-detail-cover img').forEach((img) => {
      const fail = () => this.replaceBrokenCover(img);
      img.addEventListener('error', fail);
      if (img.complete && !img.naturalWidth) fail();
    });
  }

  replaceBrokenCover(img) {
    const detailCover = img.closest('.writings-detail-cover');
    if (detailCover) {
      detailCover.remove();
      return;
    }

    const wrap = img.closest('.writings-cover');
    const itemId = wrap?.dataset.coverFor;
    const item = this.items.find((entry) => entry.id === itemId);
    if (!wrap || !item) return;
    const holder = document.createElement('div');
    holder.innerHTML = this.coverFallback(item).trim();
    const fallback = holder.firstElementChild;
    if (fallback) wrap.replaceWith(fallback);
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  parseFrontMatter(text) {
    const match = String(text || '').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!match) return { metadata: {}, body: String(text || '') };

    const metadata = {};
    match[1].split('\n').forEach((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex < 0) return;
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value === 'true') metadata[key] = true;
      else if (value === 'false') metadata[key] = false;
      else metadata[key] = value;
    });

    return { metadata, body: match[2] };
  }

  parseInline(text) {
    let html = this.escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const trimmed = href.trim();
      const safeHref = this.escapeHtml(trimmed);
      const external = /^https?:\/\//i.test(trimmed)
        ? ' target="_blank" rel="noopener noreferrer"'
        : '';
      return `<a href="${safeHref}"${external}>${label}</a>`;
    });
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (_, prefix, url) => {
      const clean = url.replace(/[).,;]+$/, '');
      return `${prefix}<a href="${this.escapeHtml(clean)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(clean)}</a>`;
    });
    return html;
  }

  parseMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (/^```/.test(line)) {
        const lang = line.replace(/^```/, '').trim();
        const code = [];
        i += 1;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(lines[i]);
          i += 1;
        }
        i += 1;
        html.push(this.renderCodeBlock(code.join('\n'), lang));
        continue;
      }

      if (/^#{1,6} /.test(line)) {
        const level = line.match(/^#+/)[0].length;
        html.push(`<h${level}>${this.parseInline(line.slice(level + 1))}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^(-{3,}|_{3,})$/.test(line.trim())) {
        html.push('<hr>');
        i += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i += 1;
        }
        html.push(`<blockquote><p>${this.parseInline(quote.join(' '))}</p></blockquote>`);
        continue;
      }

      if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
        const ordered = /^\d+\. /.test(line);
        const items = [];
        while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^[-*] /.test(lines[i]))) {
          items.push(`<li>${this.parseInline(lines[i].replace(/^(?:[-*]|\d+\.)\s/, ''))}</li>`);
          i += 1;
        }
        html.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
        continue;
      }

      if (!line.trim()) {
        i += 1;
        continue;
      }

      const paragraph = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^#{1,6} /.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) &&
        !/^[-*] /.test(lines[i]) &&
        !/^\d+\. /.test(lines[i]) &&
        !/^(-{3,}|_{3,})$/.test(lines[i].trim())
      ) {
        paragraph.push(lines[i]);
        i += 1;
      }
      html.push(`<p>${this.parseInline(paragraph.join(' '))}</p>`);
    }

    return html.join('\n');
  }

  renderCodeBlock(code, lang) {
    const language = this.escapeHtml(lang || 'text');
    return `
      <div class="guide-code-wrap">
        <div class="guide-code-meta">
          <span>${language}</span>
          <button type="button" class="guide-copy-btn" data-copy-code>${this.t('writings.copy', 'Copy')}</button>
        </div>
        <pre><code>${this.escapeHtml(code)}</code></pre>
      </div>
    `;
  }

  formatDate(dateString) {
    const date = this.parseDate(dateString);
    if (!date) return '';
    const locale = window.KolTiginI18n && window.KolTiginI18n.language === 'en' ? 'en-GB' : 'tr-TR';
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  coverSrc(cover) {
    const value = String(cover || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('./') || value.startsWith('../') || value.startsWith('assets/')) {
      return value;
    }
    return `./assets/images/blog/${value.replace(/^\/+/, '')}`;
  }

  hasCover(item) {
    const value = String(item?.cover || '').trim().toLowerCase();
    if (!value || value === 'null' || value === 'none' || value === 'false') return false;
    return Boolean(this.coverSrc(item.cover));
  }

  kindMeta(kind) {
    return this.kinds[kind] || this.kinds.articles;
  }

  categoryLabel(item) {
    if (item.kind === 'social' && item.thread) return this.t('writings.card.thread', 'X Thread');
    return this.kindMeta(item.kind).card;
  }

  filesFromManifest(entry, lang) {
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') {
      if (Array.isArray(entry[lang])) return entry[lang];
      if (Array.isArray(entry.en)) return entry.en;
      if (Array.isArray(entry.tr)) return entry.tr;
    }
    return [];
  }

  async readIndex() {
    const lang = (window.KolTiginI18n && window.KolTiginI18n.language) || 'en';
    try {
      const response = await fetch('./content/index.json', { cache: 'no-store' });
      if (!response.ok) return { articles: [], notes: [], social: [] };
      const data = await response.json();
      return {
        articles: this.filesFromManifest(data.articles, lang),
        notes: this.filesFromManifest(data.notes, lang),
        social: this.filesFromManifest(data.social, lang),
        lang
      };
    } catch {
      return { articles: [], notes: [], social: [], lang };
    }
  }

  uniqueFiles(files) {
    return [...new Set((files || []).filter((name) => /\.md$/i.test(String(name))))];
  }

  async loadItems() {
    const index = await this.readIndex();
    const loaded = [];
    const lang = index.lang || 'en';

    for (const kind of Object.keys(this.kinds)) {
      const files = this.uniqueFiles(index[kind]);
      for (const file of files) {
        try {
          const response = await fetch(`./content/${kind}/${lang}/${file}`, { cache: 'no-store' });
          if (!response.ok) continue;
          const raw = await response.text();
          const { metadata, body } = this.parseFrontMatter(raw);
          const slug = String(metadata.slug || file.replace(/\.md$/i, '')).trim();
          const cover = String(metadata.cover || metadata.image || '').trim();
          loaded.push({
            id: `${kind}/${slug}`,
            kind,
            file,
            slug,
            title: metadata.title || slug,
            date: metadata.date || '',
            summary: metadata.summary || metadata.excerpt || '',
            cover,
            externalUrl: metadata.externalUrl || '',
            platform: String(metadata.platform || (kind === 'social' ? 'x' : '')).toLowerCase(),
            thread: metadata.thread === true || metadata.thread === 'true',
            body
          });
        } catch (error) {
          console.warn(`Could not load writing: ${kind}/${file}`, error);
        }
      }
    }

    loaded.sort((a, b) => {
      const left = this.parseDate(a.date)?.getTime() || 0;
      const right = this.parseDate(b.date)?.getTime() || 0;
      if (right !== left) return right - left;
      return String(a.title).localeCompare(String(b.title), lang === 'en' ? 'en' : 'tr', { sensitivity: 'base' });
    });

    this.items = loaded;
  }

  filteredItems() {
    if (this.filter === 'all') return this.items;
    return this.items.filter((item) => item.kind === this.filter);
  }

  updateFilterButtons() {
    this.filterNav?.querySelectorAll('[data-writings-kind]').forEach((button) => {
      const active = button.dataset.writingsKind === this.filter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  coverFallback(item) {
    const kind = this.kindMeta(item.kind);
    return `
      <div class="blog-banner-box writings-cover writings-cover-fallback" aria-hidden="true">
        <div class="cover-fallback">
          <ion-icon name="${kind.icon}" aria-hidden="true"></ion-icon>
          <span>${this.escapeHtml(this.categoryLabel(item))}</span>
        </div>
      </div>
    `;
  }

  coverMarkup(item) {
    if (!this.hasCover(item)) return this.coverFallback(item);
    return `
      <figure class="blog-banner-box writings-cover" data-cover-for="${this.escapeHtml(item.id)}">
        <img src="${this.escapeHtml(this.coverSrc(item.cover))}" alt="${this.escapeHtml(item.title)}" loading="lazy" decoding="async">
      </figure>
    `;
  }

  cardAction(item) {
    if (item.kind === 'social' && item.externalUrl) {
      return `<span class="writings-card-cta">${this.t('writings.viewOnX', 'View on X →')}</span>`;
    }
    if (item.kind !== 'social') {
      return `<span class="writings-card-cta">${this.t('writings.read', 'Read →')}</span>`;
    }
    return '';
  }

  createCard(item) {
    const dateLabel = this.formatDate(item.date);
    const meta = [
      this.categoryLabel(item),
      dateLabel
    ].filter(Boolean).join(' · ');

    const isExternal = item.kind === 'social' && item.externalUrl;
    const href = isExternal ? this.escapeHtml(item.externalUrl) : `#/yazilar/${item.kind}/${encodeURIComponent(item.slug)}`;
    const extra = isExternal
      ? ' target="_blank" rel="noopener noreferrer"'
      : ` data-writings-open="${this.escapeHtml(item.id)}"`;

    return `
      <li class="blog-post-item">
        <a class="writings-card" href="${href}"${extra}>
          ${this.coverMarkup(item)}
          <div class="blog-content">
            <div class="blog-meta">
              <p class="blog-category">${this.escapeHtml(meta)}</p>
            </div>
            <h3 class="h3 blog-item-title">${this.escapeHtml(item.title)}</h3>
            ${item.summary ? `<p class="blog-text">${this.escapeHtml(item.summary)}</p>` : ''}
            ${this.cardAction(item)}
          </div>
        </a>
      </li>
    `;
  }

  renderList() {
    this.currentItem = null;
    this.filterNav?.removeAttribute('hidden');
    this.updateFilterButtons();

    const items = this.filteredItems();
    const empty = items.length
      ? ''
      : `<p class="writings-empty">${this.t('writings.empty', 'No content in this category yet.')}</p>`;

    this.view.innerHTML = `
      <section class="blog-posts">
        <ul class="blog-posts-list">${items.map((item) => this.createCard(item)).join('')}</ul>
        ${empty}
      </section>
    `;
    this.bindCoverFallbacks();
  }

  showList() {
    this.filterNav?.removeAttribute('hidden');
    const hash = '#/yazilar';
    if (window.location.hash !== hash && window.location.hash.startsWith('#/yazilar')) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
    this.renderList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showItem(id) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) {
      this.showList();
      return;
    }
    if (item.kind === 'social') {
      if (item.externalUrl) window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    this.currentItem = item;
    this.filterNav?.setAttribute('hidden', '');
    const hash = `#/yazilar/${item.kind}/${encodeURIComponent(item.slug)}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }

    const dateLabel = this.formatDate(item.date);
    const meta = [this.categoryLabel(item), dateLabel].filter(Boolean).join(' · ');
    const cover = this.hasCover(item)
      ? `<figure class="writings-detail-cover" data-cover-for="${this.escapeHtml(item.id)}">
           <img src="${this.escapeHtml(this.coverSrc(item.cover))}" alt="${this.escapeHtml(item.title)}" loading="lazy" decoding="async">
         </figure>`
      : '';

    this.view.innerHTML = `
      <section class="blog-post-detail">
        <button type="button" class="back-btn" data-writings-back>
          <ion-icon name="arrow-back-outline" aria-hidden="true"></ion-icon>
          <span>${this.t('writings.back', 'Back to writings')}</span>
        </button>
        <header class="blog-post-header">
          <div class="blog-post-meta">
            <p class="blog-category">${this.escapeHtml(meta)}</p>
          </div>
          <h2 class="h2 writings-detail-title">${this.escapeHtml(item.title)}</h2>
        </header>
        ${cover}
        <div class="blog-post-content">
          ${this.parseMarkdown(item.body)}
        </div>
      </section>
    `;
    this.bindCoverFallbacks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

}

window.BlogParser = BlogParser;

document.addEventListener('DOMContentLoaded', () => {
  window.blogParser = new BlogParser();
  window.blogParser.init();
});

if (window.KolTiginI18n) {
  window.KolTiginI18n.onChange(async () => {
    if (!window.blogParser) return;
    window.blogParser.applyKindLabels();
    const openId = window.blogParser.currentItem && window.blogParser.currentItem.id;
    await window.blogParser.loadItems();
    if (openId) window.blogParser.showItem(openId);
    else window.blogParser.renderList();
  });
}
