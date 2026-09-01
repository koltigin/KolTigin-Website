'use strict';

class BlogParser {
  constructor() {
    this.items = [];
    this.filter = 'all';
    this.currentItem = null;
    this.section = document.querySelector('.blog[data-page="blog"]');
    this.view = this.section?.querySelector('[data-writings-view]');
    this.filterNav = this.section?.querySelector('[data-writings-filter]');
    this.typeList = [];
    this.kinds = {};
  }

  t(key, fallback) {
    return window.KolTiginI18n ? window.KolTiginI18n.t(key, null, fallback) : fallback || key;
  }

  loc(value, fallback) {
    if (window.KolTiginI18n && typeof window.KolTiginI18n.localized === 'function') {
      const text = window.KolTiginI18n.localized(value);
      if (text) return text;
    }
    return fallback || '';
  }

  applyKindLabels() {
    const lang = (window.KolTiginI18n && window.KolTiginI18n.language) || 'en';
    this.typeList.forEach((type) => {
      const id = type.id;
      const fallbackCard = id === 'articles' ? 'Article' : id === 'notes' ? 'Technical Note' : id === 'social' ? 'X Post' : this.loc(type.label, id);
      const fallbackFilter = id === 'articles' ? 'Articles' : id === 'notes' ? 'Technical Notes' : id === 'social' ? 'X Posts' : this.loc(type.filter || type.label, id);
      this.kinds[id] = {
        ...type,
        id,
        icon: type.icon || 'document-text-outline',
        mode: type.mode || (id === 'social' ? 'external' : 'internal'),
        label: this.loc(type.filter, this.t(`writings.filters.${id}`, fallbackFilter)),
        card: this.loc(type.label, this.t(`writings.card.${id}`, fallbackCard)),
        cta: this.loc(type.cta, id === 'social' ? this.t('writings.viewOnX', 'View on X →') : this.t('writings.read', 'Read →'))
      };
    });
    void lang;
  }

  isExternal(item) {
    const meta = this.kindMeta(item && item.kind);
    return meta.mode === 'external' && Boolean(item && item.externalUrl);
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
    const match = window.location.hash.match(/^#\/yazilar\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([^/]+)$/i);
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
    const wrap = img.closest('.writings-cover') || detailCover;
    const itemId = wrap?.dataset.coverFor;
    const item = this.items.find((entry) => entry.id === itemId) || this.currentItem;
    if (!wrap || !item) {
      img.remove();
      return;
    }
    const extra = detailCover ? 'writings-detail-cover' : '';
    const holder = document.createElement('div');
    holder.innerHTML = this.coverFallback(item, extra).trim();
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
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  parseDate(value) {
    const raw = String(value || '').trim();
    let year;
    let month;
    let day;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const euro = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]);
      day = Number(iso[3]);
    } else if (euro) {
      day = Number(euro[1]);
      month = Number(euro[2]);
      year = Number(euro[3]);
    } else {
      return null;
    }
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  excerptFromBody(markdown) {
    const chunks = [];
    let inCode = false;
    for (const line of String(markdown || '').split('\n')) {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inCode = !inCode;
        continue;
      }
      if (inCode) continue;
      if (!trimmed) {
        if (chunks.length) break;
        continue;
      }
      if (/^#{1,6}\s/.test(trimmed) || /^!\[/.test(trimmed) || /^<img\b/i.test(trimmed)) {
        if (chunks.length) break;
        continue;
      }
      const stripped = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/[*_`>#]+/g, '');
      if (!stripped) continue;
      chunks.push(stripped);
      if (chunks.join(' ').length >= 160) break;
    }
    let text = chunks.join(' ').trim();
    if (text.length > 160) text = `${text.slice(0, 157).trim()}…`;
    return text;
  }

  coverSrc(cover) {
    const value = String(cover || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('./') || value.startsWith('../') || value.startsWith('assets/')) {
      return encodeURI(value);
    }
    return encodeURI(`./assets/images/blog/${value.replace(/^\/+/, '')}`);
  }

  hasCover(item) {
    const value = String(item?.cover || '').trim().toLowerCase();
    if (!value || value === 'null' || value === 'none' || value === 'false') return false;
    return Boolean(this.coverSrc(item.cover));
  }

  kindMeta(kind) {
    return this.kinds[kind] || { id: kind, icon: 'document-text-outline', mode: 'internal', label: kind, card: kind, cta: this.t('writings.read', 'Read →') };
  }

  categoryLabel(item) {
    if (this.isExternal(item) && item.thread) return this.t('writings.card.thread', 'X Thread');
    return this.kindMeta(item.kind).card;
  }

  filesFromManifest(entry, lang) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Array.isArray(entry[lang]) ? entry[lang] : [];
    }
    if (Array.isArray(entry)) return entry;
    return [];
  }

  async readIndex() {
    const lang = (window.KolTiginI18n && window.KolTiginI18n.language) || 'en';
    const fallbackTypes = [
      { id: 'articles', mode: 'internal', icon: 'document-text-outline' },
      { id: 'notes', mode: 'internal', icon: 'code-slash-outline' },
      { id: 'social', mode: 'external', icon: 'logo-twitter' }
    ];
    try {
      const response = await fetch('./content/index.json', { cache: 'no-store' });
      if (!response.ok) return { types: fallbackTypes, files: {}, lang };
      const data = await response.json();
      const types = Array.isArray(data.types) && data.types.length
        ? data.types.filter((item) => item && item.id)
        : fallbackTypes;
      const files = {};
      types.forEach((type) => {
        files[type.id] = this.filesFromManifest(data[type.id], lang);
      });
      ['articles', 'notes', 'social'].forEach((kind) => {
        if (!files[kind]) files[kind] = this.filesFromManifest(data[kind], lang);
      });
      return { types, files, lang };
    } catch {
      return { types: fallbackTypes, files: {}, lang };
    }
  }

  uniqueFiles(files) {
    return [...new Set((files || []).filter((name) => /\.md$/i.test(String(name))))];
  }

  async loadItems() {
    const index = await this.readIndex();
    const loaded = [];
    const lang = index.lang || 'en';
    this.typeList = index.types || [];
    this.applyKindLabels();

    for (const kind of Object.keys(index.files || {})) {
      const files = this.uniqueFiles(index.files[kind]);
      for (const file of files) {
        try {
          const response = await fetch(`./content/${kind}/${lang}/${file}`, { cache: 'no-store' });
          if (!response.ok) continue;
          const raw = await response.text();
          const { metadata, body } = this.parseFrontMatter(raw);
          const slug = String(file.replace(/\.md$/i, '')).trim();
          const legacySlug = String(metadata.slug || '').trim();
          const cover = String(metadata.cover || metadata.image || '').trim();
          loaded.push({
            id: `${kind}/${slug}`,
            kind,
            file,
            slug,
            legacySlug,
            title: metadata.title || slug,
            date: metadata.date || '',
            summary: metadata.summary || metadata.excerpt || this.excerptFromBody(body),
            cover,
            externalUrl: metadata.externalUrl || '',
            platform: String(metadata.platform || (this.kindMeta(kind).mode === 'external' ? 'x' : '')).toLowerCase(),
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

  renderFilters() {
    if (!this.filterNav) return;
    const visible = this.typeList.filter((type) => this.items.some((item) => item.kind === type.id));
    if (this.filter !== 'all' && !visible.some((type) => type.id === this.filter)) this.filter = 'all';
    const buttons = [
      { id: 'all', label: this.t('writings.filters.all', 'All') },
      ...visible.map((type) => ({ id: type.id, label: this.kindMeta(type.id).label }))
    ];
    this.filterNav.innerHTML = buttons.map((button) => {
      const active = button.id === this.filter;
      return `<button type="button" class="writings-filter-btn${active ? ' is-active' : ''}" data-writings-kind="${this.escapeHtml(button.id)}" aria-pressed="${active ? 'true' : 'false'}">${this.escapeHtml(button.label)}</button>`;
    }).join('');
  }

  updateFilterButtons() {
    this.renderFilters();
  }

  coverFallback(item, extraClass = '') {
    const kind = this.kindMeta(item.kind);
    const title = item.title || this.categoryLabel(item);
    return `
      <div class="blog-banner-box writings-cover writings-cover-fallback ${extraClass}" aria-hidden="true">
        <div class="cover-fallback">
          <ion-icon name="${kind.icon}" aria-hidden="true"></ion-icon>
          <span class="cover-fallback-title">${this.escapeHtml(title)}</span>
          <span class="cover-fallback-kind">${this.escapeHtml(this.categoryLabel(item))}</span>
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
    const meta = this.kindMeta(item.kind);
    if (this.isExternal(item)) {
      return `<span class="writings-card-cta">${this.escapeHtml(meta.cta || this.t('writings.viewOnX', 'View on X →'))}</span>`;
    }
    return `<span class="writings-card-cta">${this.t('writings.read', 'Read →')}</span>`;
  }

  createCard(item) {
    const dateLabel = this.formatDate(item.date);
    const meta = [
      this.categoryLabel(item),
      dateLabel
    ].filter(Boolean).join(' · ');

    const isExternal = this.isExternal(item);
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
    const item = this.items.find((entry) => (
      entry.id === id
      || `${entry.kind}/${entry.slug}` === id
      || (entry.legacySlug && `${entry.kind}/${entry.legacySlug}` === id)
      || (entry.legacySlug && entry.legacySlug === id)
      || entry.slug === id
    )) || this.items.find((entry) => {
      const parts = String(id || '').split('/');
      const slug = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
      return entry.slug === slug || (entry.legacySlug && entry.legacySlug === slug);
    });
    if (!item) {
      this.showList();
      return;
    }
    if (this.isExternal(item)) {
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
      : this.coverFallback(item, 'writings-detail-cover');

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
