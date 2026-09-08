'use strict';

function publicPath(path) {
  return window.KolTiginRouter ? window.KolTiginRouter.publicPath(path) : String(path || '').replace(/^\.\//, '/');
}

class GuidesParser {
  constructor() {
    this.page = document.querySelector('[data-page="guide"]');
    this.titleEl = this.page?.querySelector('[data-guide-title]');
    this.bodyEl = this.page?.querySelector('[data-guide-content]');
    this.langNav = this.page?.querySelector('[data-guide-langs]');
    this.currentId = '';
    this.currentTitle = '';
    this.sourceUrl = '';
    this.tocObserver = null;
    this.tocNav = null;
    this.tocResize = null;
    this.pendingHeading = '';

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

    const parser = this;
    const wrapped = (pageName) => {
      if (pageName !== 'guide') {
        parser.teardownToc();
        if (window.location.hash.startsWith('#/guides/')) {
          history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        }
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
      const parsed = this.parseGuideHash();
      if (!parsed) return;
      if (
        this.currentId === parsed.id
        && this.page?.classList.contains('active')
        && this.bodyEl
        && this.bodyEl.querySelector('h1, h2, h3')
      ) {
        this.scrollToHeading(parsed.heading);
        return;
      }
      this.open(parsed.id, { heading: parsed.heading });
    };

    window.addEventListener('hashchange', apply);
    apply();
  }

  parseGuideHash() {
    const match = window.location.hash.match(
      /^#\/guides\/([a-z0-9-]+)(?:\/(TR|EN))?(?:\/([a-z0-9-]+))?$/i
    );
    if (!match) return null;
    return {
      id: match[1],
      lang: match[2] || '',
      heading: match[3] || ''
    };
  }

  guideRouteHash(heading) {
    const lang = this.currentLang || this.siteGuideLang();
    const base = `#/guides/${this.currentId}/${lang}`;
    return heading ? `${base}/${heading}` : base;
  }

  setSectionHash(heading) {
    const next = this.guideRouteHash(heading);
    if (window.location.hash === next) return;
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`);
  }

  async open(id, options = {}) {
    if (!this.page || !/^[a-z0-9-]+$/i.test(id)) return;

    this.currentId = id;
    this.currentTitle = '';
    this.currentLang = this.siteGuideLang();
    if (typeof options.sourceUrl === 'string' && options.sourceUrl) {
      this.sourceUrl = options.sourceUrl;
    }

    this.pendingHeading = typeof options.heading === 'string' ? options.heading : (this.parseGuideHash()?.heading || '');

    window.activatePage('guide');
    document.querySelector('[data-nav-page="projects"]')?.classList.add('active');

    const hash = this.guideRouteHash(this.pendingHeading);
    if (window.location.hash !== hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }

    this.renderChrome();
    this.bodyEl.innerHTML = `<p class="guide-status">${this.t('guides.loading', 'Loading guide…')}</p>`;

    try {
      const markdown = await this.loadMarkdown(id, this.currentLang);
      this.currentTitle = this.firstHeading(markdown) || id;
      const html = this.parseMarkdown(markdown, id);
      this.bodyEl.innerHTML = html;
      this.injectShareRows();
      this.renderToc();
      this.scrollToHeading(this.pendingHeading);
    } catch (error) {
      this.teardownToc();
      this.bodyEl.innerHTML = `<p class="guide-status">${this.escapeHtml(error.message)}</p>`;
    }
  }

  firstHeading(markdown) {
    const withoutFm = String(markdown || '').replace(/^---[\s\S]*?---\s*/, '');
    const match = withoutFm.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
  }

  contentLang() {
    return String(this.currentLang || this.siteGuideLang()).toLowerCase() === 'tr' ? 'tr' : 'en';
  }

  renderChrome() {
    this.langNav?.querySelectorAll('[data-guide-lang]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.guideLang === this.currentLang);
    });
    this.page?.querySelector('.guide-toolbar [data-share-actions]')?.remove();
  }

  injectShareRows() {
    if (!this.bodyEl || !this.currentId || !window.KolTiginShareActions) return;
    this.bodyEl.querySelectorAll('[data-share-actions]').forEach((bar) => bar.remove());
    this.page?.querySelector('.guide-toolbar [data-share-actions]')?.remove();
    const html = window.KolTiginShareActions.render({
      title: this.currentTitle || this.currentId,
      url: window.KolTiginShareActions.guideShareUrl(this.contentLang(), this.currentId)
    });
    const heading = this.bodyEl.querySelector('h1');
    if (heading) heading.insertAdjacentHTML('afterend', html);
    else this.bodyEl.insertAdjacentHTML('afterbegin', html);
    this.bodyEl.insertAdjacentHTML('beforeend', html);
    window.KolTiginShareActions.bind(this.bodyEl);
  }

  collectTocEntries() {
    if (!this.bodyEl) return [];
    return [...this.bodyEl.querySelectorAll('h2[id], h3[id]')]
      .map((el) => ({
        level: el.tagName === 'H3' ? 3 : 2,
        id: el.id,
        text: (el.textContent || '').trim()
      }))
      .filter((item) => item.id && item.text);
  }

  renderToc() {
    this.teardownToc();
    const items = this.collectTocEntries();
    if (!items.length || !this.bodyEl) return;

    const title = this.t('guides.contents', 'Contents');
    const groups = [];
    items.forEach((item) => {
      if (item.level === 2 || !groups.length) {
        groups.push({ heading: item.level === 2 ? item : null, children: item.level === 3 ? [item] : [] });
      } else {
        groups[groups.length - 1].children.push(item);
      }
    });
    const linkMarkup = (item, child) => (
      `<a class="guide-toc-link${child ? ' is-child' : ''}" href="${this.escapeHtml(this.guideRouteHash(item.id))}" data-guide-toc="${this.escapeHtml(item.id)}">${this.escapeHtml(item.text)}</a>`
    );
    const links = groups.map((group) => {
      const parts = [];
      if (group.heading) parts.push(linkMarkup(group.heading, false));
      group.children.forEach((child) => parts.push(linkMarkup(child, true)));
      return `<div class="guide-toc-group">${parts.join('')}</div>`;
    }).join('');
    const html = `<nav class="guide-toc" data-guide-toc-nav>
      <button type="button" class="guide-toc-toggle" data-guide-toc-toggle aria-expanded="false">${this.escapeHtml(title)}</button>
      <div class="guide-toc-panel" data-guide-toc-panel hidden>
        <div class="guide-toc-list">${links}</div>
      </div>
    </nav>`;
    const topShare = this.bodyEl.querySelector('[data-share-actions]');
    const heading = this.bodyEl.querySelector('h1');
    if (topShare) topShare.insertAdjacentHTML('afterend', html);
    else if (heading) heading.insertAdjacentHTML('afterend', html);
    else this.bodyEl.insertAdjacentHTML('afterbegin', html);

    this.tocNav = this.bodyEl.querySelector('[data-guide-toc-nav]');
    this.tocNav?.querySelector('[data-guide-toc-toggle]')?.addEventListener('click', () => {
      this.setTocOpen(!this.isTocOpen());
    });
    this.tocNav?.addEventListener('click', (event) => {
      const link = event.target.closest('[data-guide-toc]');
      if (!link) return;
      event.preventDefault();
      const id = link.getAttribute('data-guide-toc');
      this.setTocOpen(false);
      this.scrollToHeading(id, { updateHash: true, afterLayout: true });
    });
    this.bindTocStickyOffset();
    this.syncTocStickyOffset();
  }

  isTocOpen() {
    return this.tocNav?.querySelector('[data-guide-toc-toggle]')?.getAttribute('aria-expanded') === 'true';
  }

  setTocOpen(open) {
    const toggle = this.tocNav?.querySelector('[data-guide-toc-toggle]');
    const panel = this.tocNav?.querySelector('[data-guide-toc-panel]');
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    if (open) this.bindScrollspy();
    else this.unbindScrollspy();
    this.syncTocStickyOffset();
  }

  guideStickyHeader() {
    return this.page?.querySelector('.guide-header') || this.page?.querySelector('header');
  }

  bindTocStickyOffset() {
    if (this.tocResize) return;
    this.tocResize = () => this.syncTocStickyOffset();
    window.addEventListener('resize', this.tocResize);
  }

  syncTocStickyOffset() {
    const header = this.guideStickyHeader();
    const nav = this.tocNav;
    if (!header || !nav) return;
    const top = Math.max(0, Math.ceil(header.getBoundingClientRect().height));
    nav.style.setProperty('--guide-toc-top', `${top}px`);
  }

  teardownToc() {
    this.unbindScrollspy();
    if (this.tocResize) {
      window.removeEventListener('resize', this.tocResize);
      this.tocResize = null;
    }
    this.tocNav?.remove();
    this.tocNav = null;
    this.bodyEl?.querySelector('[data-guide-toc-nav]')?.remove();
  }

  headingScrollOffset() {
    this.syncTocStickyOffset();
    const tocH = this.tocNav ? Math.ceil(this.tocNav.getBoundingClientRect().height) : 44;
    const header = this.guideStickyHeader();
    const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    return headerH + tocH + 12;
  }

  scrollToHeading(id, options = {}) {
    const heading = String(id || '').trim();
    if (!heading || !this.bodyEl) return;
    const run = () => {
      const el = this.bodyEl.querySelector(`[id="${this.escapeHtml(heading)}"]`);
      if (!el) return;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const top = el.getBoundingClientRect().top + window.scrollY - this.headingScrollOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
      this.setTocActive(heading);
      if (options.updateHash !== false) this.setSectionHash(heading);
    };
    if (options.afterLayout) {
      requestAnimationFrame(() => requestAnimationFrame(run));
      return;
    }
    run();
  }

  setTocActive(id) {
    this.tocNav?.querySelectorAll('[data-guide-toc]').forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('data-guide-toc') === id);
    });
  }

  bindScrollspy() {
    this.unbindScrollspy();
    const headings = [...(this.bodyEl?.querySelectorAll('h2[id], h3[id]') || [])];
    if (!headings.length || typeof IntersectionObserver !== 'function') return;
    const visible = new Map();
    this.tocObserver = new IntersectionObserver((entries) => {
      if (!this.isTocOpen()) return;
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
        else visible.delete(entry.target.id);
      });
      let active = '';
      if (visible.size) {
        active = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
      } else {
        const above = headings.filter((node) => node.getBoundingClientRect().top <= 120);
        active = above.length ? above[above.length - 1].id : headings[0].id;
      }
      if (active) this.setTocActive(active);
    }, {
      root: null,
      rootMargin: '-88px 0px -62% 0px',
      threshold: [0, 0.25, 1]
    });
    headings.forEach((node) => this.tocObserver.observe(node));
  }

  unbindScrollspy() {
    if (this.tocObserver) {
      this.tocObserver.disconnect();
      this.tocObserver = null;
    }
  }

  async loadMarkdown(id, lang) {
    const response = await fetch(`${publicPath(`./guides/${id}/${lang}.md`)}?t=${Date.now()}`, { cache: 'no-store' });
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
