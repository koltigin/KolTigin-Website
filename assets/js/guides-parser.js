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
    this.bindIndex();
    this.bindLocation();
    this.renderIndex();
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
    const wrapped = (pageName, options) => {
      if (pageName !== 'guide') {
        parser.teardownToc();
      }
      original(pageName, options || {});
      if (pageName === 'guides') parser.renderIndex();
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

  bindIndex() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('[data-guides-index] a[data-guide-open]');
      if (!link) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
      event.preventDefault();
      this.open(link.dataset.guideOpen, { lang: link.dataset.guideLang });
    });
  }

  bindLocation() {
    const apply = () => {
      const parsed = this.parseGuideLocation();
      if (!parsed) {
        if (window.KolTiginRouter?.normalizePath(window.location.pathname) === '/guides/') {
          this.renderIndex();
        }
        return;
      }
      if (
        this.currentId === parsed.id
        && this.currentLang === (parsed.lang || this.currentLang)
        && this.page?.classList.contains('active')
        && this.bodyEl
        && this.bodyEl.querySelector('h1, h2, h3')
      ) {
        this.scrollToHeading(parsed.heading);
        return;
      }
      this.open(parsed.id, { heading: parsed.heading, lang: parsed.lang });
    };

    window.addEventListener('hashchange', apply);
    window.addEventListener('popstate', apply);
    apply();
  }

  parseGuideHash() {
    if (window.KolTiginRouter && typeof window.KolTiginRouter.parseGuideHash === 'function') {
      return window.KolTiginRouter.parseGuideHash(window.location.hash);
    }
    const match = window.location.hash.match(
      /^#\/guides\/([a-z0-9-]+)(?:\/(TR|EN))?(?:\/([a-z0-9-]+))?$/i
    );
    if (!match) return null;
    return { id: match[1], lang: match[2] || '', heading: match[3] || '' };
  }

  parseGuideLocation() {
    const router = window.KolTiginRouter;
    const fromPath = router && typeof router.parseGuidePath === 'function'
      ? router.parseGuidePath(window.location.pathname)
      : null;
    if (fromPath) {
      return {
        id: fromPath.id,
        lang: fromPath.lang,
        heading: router.parseGuideHeading(window.location.hash)
      };
    }
    return this.parseGuideHash();
  }

  guidePublicPath(heading) {
    const router = window.KolTiginRouter;
    const lang = this.currentLang || this.siteGuideLang();
    const path = router && typeof router.guidePublicPath === 'function'
      ? router.guidePublicPath(this.currentId, lang)
      : `/guides/${this.currentId}/${lang}/`;
    const slug = String(heading || '').trim();
    return slug ? `${path}#${slug}` : path;
  }

  guideRouteHash(heading) {
    return this.guidePublicPath(heading);
  }

  isOnThisGuidePath() {
    const parsed = window.KolTiginRouter?.parseGuidePath(window.location.pathname);
    return Boolean(parsed && parsed.id === this.currentId && (!this.currentLang || parsed.lang === this.currentLang));
  }

  syncGuideUrl(heading, replace) {
    const next = this.guidePublicPath(heading);
    const current = `${window.location.pathname}${window.location.hash}`;
    if (current === next) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', next);
    if (typeof window.applyRouteSeo === 'function') window.applyRouteSeo();
  }

  setSectionHash(heading) {
    this.syncGuideUrl(heading, true);
  }

  parseFrontMatter(markdown) {
    const text = String(markdown || '');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\s*/);
    if (!match) return { meta: {}, body: text };
    const meta = {};
    for (const line of match[1].split('\n')) {
      const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!pair) continue;
      meta[pair[1]] = pair[2].trim().replace(/^['"]|['"]$/g, '');
    }
    return { meta, body: text.slice(match[0].length) };
  }

  excerptFromMarkdown(markdown, limit = 160) {
    const { body } = this.parseFrontMatter(markdown);
    const chunks = [];
    for (const line of body.split('\n')) {
      let stripped = line.trim();
      if (
        !stripped
        || stripped.startsWith('#')
        || stripped.startsWith('```')
        || stripped.startsWith('>')
        || stripped.startsWith('|')
        || stripped.startsWith('- ')
        || stripped.startsWith('* ')
        || /^\d+\.\s/.test(stripped)
      ) {
        if (chunks.length) break;
        continue;
      }
      stripped = stripped.replace(/[*_`]+/g, '');
      stripped = stripped.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      chunks.push(stripped);
      const text = chunks.join(' ');
      if (text.length >= limit) return `${text.slice(0, limit - 1).trimEnd()}…`;
    }
    return chunks.join(' ').slice(0, limit).trim();
  }

  hasCover(value) {
    const raw = String(value || '').trim().toLowerCase();
    return Boolean(raw) && !['null', 'none', 'false'].includes(raw);
  }

  coverSrc(id, markdown, lang) {
    const { meta } = this.parseFrontMatter(markdown);
    if (this.hasCover(meta.cover)) {
      const name = String(meta.cover).replace(/^\.\//, '').split('/').pop();
      return publicPath(`./assets/images/guides/${id}/${name}`);
    }
    const loc = String(lang || 'EN').toLowerCase() === 'tr' ? 'tr' : 'en';
    return publicPath(`./assets/images/og/guides/${loc}/${id}.png`);
  }

  projectNameForGuide(projects, guideId) {
    for (const group of Object.values(projects || {})) {
      if (!Array.isArray(group)) continue;
      for (const project of group) {
        const linked = (project.links || []).some((link) => link && link.guide === guideId);
        if (linked) return String(project.name || '').trim();
      }
    }
    return '';
  }

  createIndexCard(item) {
    const href = `/guides/${this.escapeHtml(item.id)}/${item.lang}/`;
    const project = item.project
      ? `<p class="blog-category">${this.escapeHtml(item.project)}</p>`
      : '';
    const excerpt = item.excerpt
      ? `<p class="blog-text">${this.escapeHtml(item.excerpt)}</p>`
      : '';
    return `
      <li class="blog-post-item">
        <a class="writings-card guides-card" href="${href}" data-guide-open="${this.escapeHtml(item.id)}" data-guide-lang="${this.escapeHtml(item.lang)}">
          <figure class="blog-banner-box writings-cover" data-cover-for="${this.escapeHtml(item.id)}">
            <img src="${this.escapeHtml(item.cover)}" alt="${this.escapeHtml(item.title)}" loading="lazy" decoding="async">
          </figure>
          <div class="blog-content">
            <div class="blog-meta">${project}</div>
            <h3 class="h3 blog-item-title">${this.escapeHtml(item.title)}</h3>
            ${excerpt}
            <span class="writings-card-cta">${this.t('guides.read', 'Read Guide')}</span>
          </div>
        </a>
      </li>
    `;
  }

  async renderIndex() {
    const list = document.querySelector('[data-guides-index]');
    if (!list) return;
    const lang = this.siteGuideLang();
    try {
      const [indexRes, projectsRes] = await Promise.all([
        fetch(`${publicPath('./content/guides/index.json')}?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${publicPath('./projects/projects.json')}?t=${Date.now()}`, { cache: 'no-store' })
      ]);
      if (!indexRes.ok) throw new Error('index');
      const data = await indexRes.json();
      const projects = projectsRes.ok ? await projectsRes.json() : {};
      const ids = Array.isArray(data.guides) ? data.guides.filter((id) => /^[a-z0-9-]+$/i.test(id)) : [];
      const cards = (await Promise.all(ids.map(async (id) => {
        try {
          const markdown = await this.loadMarkdown(id, lang);
          const title = this.firstHeading(markdown);
          if (!title) return '';
          return this.createIndexCard({
            id,
            lang,
            title,
            excerpt: this.excerptFromMarkdown(markdown),
            cover: this.coverSrc(id, markdown, lang),
            project: this.projectNameForGuide(projects, id)
          });
        } catch {
          return '';
        }
      }))).filter(Boolean);
      list.innerHTML = cards.join('') || `<li class="writings-empty">${this.t('guides.empty', 'No guides yet.')}</li>`;
    } catch {
      list.innerHTML = `<li class="writings-empty">${this.t('guides.empty', 'No guides yet.')}</li>`;
    }
  }

  async open(id, options = {}) {
    if (!this.page || !/^[a-z0-9-]+$/i.test(id)) return;
    if (this._opening) return;
    this._opening = true;

    try {
      this.currentId = id;
      this.currentTitle = '';
      const located = this.parseGuideLocation();
      this.currentLang = options.lang || located?.lang || this.siteGuideLang();
      if (typeof options.sourceUrl === 'string' && options.sourceUrl) {
        this.sourceUrl = options.sourceUrl;
      }

      this.pendingHeading = typeof options.heading === 'string'
        ? options.heading
        : (located?.id === id ? located.heading : '');

      window.activatePage('guide', { skipHistory: true, instantScroll: true });

      const replace = this.isOnThisGuidePath();
      this.syncGuideUrl(this.pendingHeading, replace);

      const wantLang = this.currentLang === 'TR' ? 'tr' : 'en';
      if (window.KolTiginI18n && window.KolTiginI18n.language !== wantLang) {
        this._ignoreLang = true;
        try {
          await window.KolTiginI18n.setLanguage(wantLang);
        } finally {
          this._ignoreLang = false;
        }
      }

      this.renderChrome();
      this.bodyEl.innerHTML = `<p class="guide-status">${this.t('guides.loading', 'Loading guide…')}</p>`;

      const markdown = await this.loadMarkdown(id, this.currentLang);
      this.currentTitle = this.firstHeading(markdown) || id;
      const html = this.parseMarkdown(markdown, id);
      this.bodyEl.innerHTML = html;
      this.injectShareRows();
      this.renderToc();
      this.scrollToHeading(this.pendingHeading);
      if (typeof window.applyRouteSeo === 'function') window.applyRouteSeo();
    } catch (error) {
      this.teardownToc();
      this.bodyEl.innerHTML = `<p class="guide-status">${this.escapeHtml(error.message)}</p>`;
    } finally {
      this._opening = false;
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
    const response = await fetch(`${publicPath(`./content/guides/${id}/${lang}.md`)}?t=${Date.now()}`, { cache: 'no-store' });
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
    if (window.guidesParser && window.guidesParser._ignoreLang) return;
    const onLanding = document.querySelector('[data-page="guides"].active');
    if (onLanding) window.guidesParser.renderIndex();
    const onGuide = document.querySelector('[data-page="guide"].active');
    if (onGuide && window.guidesParser && window.guidesParser.currentId) {
      window.guidesParser.open(window.guidesParser.currentId, {
        sourceUrl: window.guidesParser.sourceUrl,
        lang: window.guidesParser.siteGuideLang()
      });
    }
  });
}

window.GuidesParser = GuidesParser;
