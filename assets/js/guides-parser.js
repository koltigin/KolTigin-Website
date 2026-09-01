'use strict';

class GuidesParser {
  constructor() {
    this.page = document.querySelector('[data-page="guide"]');
    this.titleEl = this.page?.querySelector('[data-guide-title]');
    this.bodyEl = this.page?.querySelector('[data-guide-content]');
    this.langNav = this.page?.querySelector('[data-guide-langs]');
    this.currentId = '';
    this.sourceUrl = '';

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
    const response = await fetch(`./guides/${id}/${lang}.md?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(this.t('guides.loadError', 'The guide could not be loaded.'));
    }
    return response.text();
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  parseInline(text, guideId) {
    return window.KolTiginGuideMarkdown.parseInline(text, guideId);
  }

  parseMarkdown(markdown, guideId) {
    const copyLabel = this.t('guides.copy', 'Copy');
    return window.KolTiginGuideMarkdown.render(markdown, { guideId, copyLabel });
  }

  renderCodeBlock(code, lang) {
    return window.KolTiginGuideMarkdown.renderCodeBlock(code, lang, this.t('guides.copy', 'Copy'));
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
