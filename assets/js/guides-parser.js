'use strict';

class GuidesParser {
  constructor() {
    this.page = document.querySelector('[data-page="guide"]');
    this.titleEl = this.page?.querySelector('[data-guide-title]');
    this.bodyEl = this.page?.querySelector('[data-guide-content]');
    this.langNav = this.page?.querySelector('[data-guide-langs]');
    this.currentId = '';
    this.sourceUrl = '';
    this.cache = new Map();

    this.wrapActivatePage();
    this.bindUi();
    this.bindHash();
  }

  siteGuideLang() {
    if (window.KolTiginI18n && typeof window.KolTiginI18n.guideLang === 'function') {
      return window.KolTiginI18n.guideLang();
    }
    return (document.documentElement.lang || 'en').slice(0, 2).toLowerCase() === 'tr' ? 'TR' : 'EN';
  }

  t(key, fallback) {
    return window.KolTiginI18n ? window.KolTiginI18n.t(key, null, fallback) : fallback || key;
  }

  wrapActivatePage() {
    const original = window.activatePage;
    if (typeof original !== 'function' || original._guidesWrapped) return;

    const wrapped = (pageName) => {
      if (pageName !== 'guide' && window.location.hash.startsWith('#/guides/')) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      original(pageName);
    };
    wrapped._guidesWrapped = true;
    window.activatePage = wrapped;
  }

  bindUi() {
    this.page?.querySelector('[data-guide-back]')?.addEventListener('click', () => {
      window.activatePage('projects');
    });

    this.langNav?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-lang]');
      if (!button || !window.KolTiginI18n) return;
      const next = button.dataset.guideLang === 'TR' ? 'tr' : 'en';
      window.KolTiginI18n.setLanguage(next);
    });

    this.bodyEl?.addEventListener('click', (event) => {
      const langLink = event.target.closest('a[data-guide-lang]');
      if (langLink && window.KolTiginI18n) {
        event.preventDefault();
        const next = langLink.dataset.guideLang === 'TR' ? 'tr' : 'en';
        window.KolTiginI18n.setLanguage(next);
      }
    });

    this.bodyEl?.addEventListener('click', async (event) => {
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
      button.textContent = this.t('guides.copied', 'Copied');
      window.setTimeout(() => {
        button.textContent = this.t('guides.copy', 'Copy');
      }, 1400);
    });
  }

  bindHash() {
    const apply = () => {
      const match = window.location.hash.match(/^#\/guides\/([a-z0-9-]+)(?:\/(TR|EN))?$/i);
      if (!match) return;
      this.open(match[1]);
    };

    window.addEventListener('hashchange', apply);
    apply();
  }

  async open(id, options = {}) {
    if (!this.page || !/^[a-z0-9-]+$/i.test(id)) return;

    this.currentId = id;
    this.currentLang = this.siteGuideLang();
    if (typeof options.sourceUrl === 'string' && options.sourceUrl) {
      this.sourceUrl = options.sourceUrl;
    }

    window.activatePage('guide');
    document.querySelector('[data-nav-page="projects"]')?.classList.add('active');

    const hash = `#/guides/${id}/${this.currentLang}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }

    this.renderChrome();
    this.bodyEl.innerHTML = `<p class="guide-status">${this.t('guides.loading', 'Loading guide…')}</p>`;

    try {
      const markdown = await this.loadMarkdown(id, this.currentLang);
      const html = this.parseMarkdown(markdown, id);
      this.bodyEl.innerHTML = html;
      const heading = this.bodyEl.querySelector('h1');
      if (heading && this.titleEl) this.titleEl.textContent = heading.textContent;
    } catch (error) {
      this.bodyEl.innerHTML = `<p class="guide-status">${this.escapeHtml(error.message)}</p>`;
    }
  }

  renderChrome() {
    this.langNav?.querySelectorAll('[data-guide-lang]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.guideLang === this.currentLang);
    });
  }

  async loadMarkdown(id, lang) {
    const key = `${id}/${lang}`;
    if (this.cache.has(key)) return this.cache.get(key);

    let response = await fetch(`./guides/${id}/${lang}.md`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(this.t('guides.loadError', 'The guide could not be loaded.'));
    }

    const markdown = await response.text();
    this.cache.set(key, markdown);
    return markdown;
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  parseInline(text, guideId) {
    let html = this.escapeHtml(text);

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const trimmed = href.trim();
      if (/^(TR|EN)\.md$/i.test(trimmed)) {
        const lang = trimmed.slice(0, 2).toUpperCase();
        return `<a href="#/guides/${this.escapeHtml(guideId)}/${lang}" data-guide-lang="${lang}">${label}</a>`;
      }
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

  parseMarkdown(markdown, guideId) {
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
        html.push(`<h${level}>${this.parseInline(line.slice(level + 1), guideId)}</h${level}>`);
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
        html.push(`<blockquote><p>${this.parseInline(quote.join(' '), guideId)}</p></blockquote>`);
        continue;
      }

      if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
        const ordered = /^\d+\. /.test(line);
        const items = [];
        while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^[-*] /.test(lines[i]))) {
          items.push(`<li>${this.parseInline(lines[i].replace(/^(?:[-*]|\d+\.)\s/, ''), guideId)}</li>`);
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
      html.push(`<p>${this.parseInline(paragraph.join(' '), guideId)}</p>`);
    }

    return html.join('\n');
  }

  renderCodeBlock(code, lang) {
    const language = this.escapeHtml(lang || 'text');
    return `
      <div class="guide-code-wrap">
        <div class="guide-code-meta">
          <span>${language}</span>
          <button type="button" class="guide-copy-btn" data-copy-code>${this.t('guides.copy', 'Copy')}</button>
        </div>
        <pre><code>${this.escapeHtml(code)}</code></pre>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const start = () => { window.guidesParser = new GuidesParser(); };
  if (window.KolTiginI18n && window.KolTiginI18n.ready) {
    window.KolTiginI18n.ready.then(start).catch(start);
  } else {
    start();
  }
});

if (window.KolTiginI18n) {
  window.KolTiginI18n.onChange(() => {
    const onGuide = document.querySelector('[data-page="guide"].active');
    if (onGuide && window.guidesParser && window.guidesParser.currentId) {
      window.guidesParser.open(window.guidesParser.currentId, {
        sourceUrl: window.guidesParser.sourceUrl
      });
    }
  });
}
