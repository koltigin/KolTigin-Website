(() => {
  'use strict';

  const app = document.getElementById('app');
  const UI_LANG_KEY = 'kt_admin_ui_lang';
  const CORE_TYPE_IDS = ['articles', 'notes', 'social'];
  const TYPE_ICONS = [
    'document-text-outline',
    'code-slash-outline',
    'logo-twitter',
    'book-outline',
    'journal-outline',
    'musical-notes-outline',
    'chatbubble-ellipses-outline',
    'pencil-outline',
    'newspaper-outline'
  ];

  function isLocalAdminHost() {
    const host = String(location.hostname || '').toLowerCase();
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
  }

  function isProductionAdmin() {
    return !isLocalAdminHost();
  }

  function publishPath(path) {
    const raw = String(path || '');
    if (raw.startsWith('/api/admin')) return raw;
    return raw.replace(/^\/admin\/api/, '/api/admin');
  }

  const state = {
    authed: false,
    server: true,
    error: '',
    notice: '',
    uiLang: localStorage.getItem(UI_LANG_KEY) === 'tr' ? 'tr' : 'en',
    navOpen: false,
    writingsFilter: 'all',
    types: [],
    platforms: [],
    content: { articles: [], notes: [], social: [], videos: [] },
    site: null,
    profileLang: 'en',
    avatarFile: null,
    avatarPreview: '',
    typeDraft: { labelEn: '', labelTr: '', icon: 'book-outline' },
    typeDialog: null,
    editor: null,
    dirty: false,
    lastHash: location.hash
  };

  function uiLang() {
    return state.uiLang === 'tr' ? 'tr' : 'en';
  }

  function t(key, vars) {
    const pick = (lang) => {
      let cur = window.ADMIN_I18N && window.ADMIN_I18N[lang];
      for (const part of String(key).split('.')) cur = cur && cur[part];
      return typeof cur === 'string' ? cur : '';
    };
    let text = pick(uiLang()) || pick('en') || key;
    if (vars) {
      Object.entries(vars).forEach(([name, value]) => {
        text = text.replaceAll(`{${name}}`, String(value));
      });
    }
    return text;
  }

  function setUiLang(lang) {
    state.uiLang = lang === 'tr' ? 'tr' : 'en';
    localStorage.setItem(UI_LANG_KEY, state.uiLang);
    document.documentElement.lang = state.uiLang;
  }

  function today() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function normalizeDate(value) {
    const raw = String(value || '').trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const euro = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (euro) return `${euro[3]}-${euro[2].padStart(2, '0')}-${euro[1].padStart(2, '0')}`;
    return raw;
  }

  function slugify(value) {
    const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
    const text = String(value || '').replace(/[çğıöşüÇĞİÖŞÜ]/g, (ch) => map[ch] || ch).toLowerCase();
    return text.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
  }

  function writingTypes() {
    return Array.isArray(state.types) && state.types.length
      ? state.types
      : CORE_TYPE_IDS.map((id) => ({ id, core: true, mode: id === 'social' ? 'external' : 'internal' }));
  }

  function writingKindIds() {
    return writingTypes().map((item) => item.id).filter(Boolean);
  }

  function typeMeta(id) {
    return writingTypes().find((item) => item.id === id) || {
      id,
      mode: id === 'social' ? 'external' : 'internal',
      icon: 'document-text-outline',
      label: {},
      filter: {}
    };
  }

  function isExternalType(id) {
    return typeMeta(id).mode === 'external';
  }

  function pickLoc(value, fallback) {
    if (value && typeof value === 'object') return value[uiLang()] || value.en || value.tr || fallback || '';
    if (typeof value === 'string' && value) return value;
    return fallback || '';
  }

  function typeLabel(id) {
    const meta = typeMeta(id);
    return pickLoc(meta.label, t(`kinds.${id}`) || id);
  }

  function typeFilterLabel(id) {
    const meta = typeMeta(id);
    return pickLoc(meta.filter, typeLabel(id));
  }

  function writingListTitle(item) {
    const lang = uiLang();
    const pack = item.languages && item.languages[lang];
    const title = pack && String(pack.title || '').trim();
    if (title) return title;
    return item.id;
  }

  function publicAssetUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
    if (raw.startsWith('./')) return `/${raw.slice(2)}`;
    if (raw.startsWith('../')) return `/${raw.replace(/^(\.\.\/)+/, '')}`;
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('assets/')) return `/${raw}`;
    return raw;
  }

  function excerpt(body) {
    const chunks = [];
    let inCode = false;
    for (const line of String(body || '').split('\n')) {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) { inCode = !inCode; continue; }
      if (inCode) continue;
      if (!trimmed) { if (chunks.length) break; continue; }
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

  function readingMinutes(body) {
    const words = String(body || '').trim().split(/\s+/).filter(Boolean);
    return words.length ? Math.max(1, Math.round(words.length / 200)) : 1;
  }

  function youtubeIdFromUrl(url) {
    const raw = String(url || '').trim();
    const patterns = [
      /youtu\.be\/([A-Za-z0-9_-]{6,20})/i,
      /[?&]v=([A-Za-z0-9_-]{6,20})/i,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/i
    ];
    for (const pattern of patterns) {
      const match = raw.match(pattern);
      if (match) return match[1];
    }
    return '';
  }

  function isXUrl(url) {
    return /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/\S+$/i.test(String(url || '').trim());
  }

  function yamlValue(value) {
    const text = String(value || '');
    if (!text || /[:#{}[\]&*?|>!%@`'"\\]/.test(text) || text !== text.trim() || /\s/.test(text)) {
      return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return text;
  }

  function writingMarkdown(draft, pair, kind) {
    const lines = ['---', `title: ${yamlValue(draft.title)}`, `date: ${pair.date}`];
    if (draft.cover) lines.push(`cover: ${yamlValue(draft.cover)}`);
    if (isExternalType(kind)) lines.push(`externalUrl: ${yamlValue(pair.externalUrl)}`);
    lines.push('---');
    const body = String(draft.body || '').replace(/^\n+|\n+$/g, '');
    return body ? `${lines.join('\n')}\n\n${body}\n` : `${lines.join('\n')}\n`;
  }

  function videoMarkdown(draft) {
    const id = youtubeIdFromUrl(draft.youtubeUrl);
    const title = draft.titleEn || draft.titleTr;
    return [
      '---',
      `title: ${yamlValue(title)}`,
      `title_tr: ${yamlValue(draft.titleTr)}`,
      `title_en: ${yamlValue(draft.titleEn)}`,
      `date: ${draft.date}`,
      `youtubeId: ${yamlValue(id)}`,
      `youtubeUrl: ${yamlValue(draft.youtubeUrl)}`,
      '---',
      ''
    ].join('\n');
  }

  function maybeLockSharedId(editor, title) {
    if (!editor || editor.sharedId) return editor.sharedId;
    const id = slugify(title);
    if (id) editor.sharedId = id;
    return editor.sharedId;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function route() {
    const fallback = isProductionAdmin() ? '#/dashboard' : '#/login';
    const hash = (location.hash || fallback).replace(/^#/, '');
    const parts = hash.split('/').filter(Boolean);
    return { parts, hash };
  }

  function notConnectedError() {
    const error = new Error(t('errors.publishNotConnected'));
    error.code = 'PUBLISH_NOT_CONNECTED';
    error.status = 501;
    return error;
  }

  async function parseJsonResponse(response) {
    let data = {};
    try { data = await response.json(); }
    catch { data = { ok: false, error: t('errors.api') }; }
    return data;
  }

  async function productionWrite(path, options = {}) {
    const dest = publishPath(path);
    let response;
    try {
      response = await fetch(dest, {
        credentials: 'include',
        ...options,
        headers: options.body instanceof FormData
          ? { ...(options.headers || {}) }
          : { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
    } catch {
      throw notConnectedError();
    }
    if ([404, 405, 501, 502, 503].includes(response.status)) throw notConnectedError();
    const data = await parseJsonResponse(response);
    if (response.status === 401 || response.status === 403) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (!response.ok || data.ok !== true) throw notConnectedError();
    return data;
  }

  async function api(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    if (isProductionAdmin()) {
      if (method === 'GET' || method === 'HEAD') {
        if (!window.KTAdminStatic || typeof window.KTAdminStatic.read !== 'function') {
          throw new Error(t('errors.api'));
        }
        const payload = await window.KTAdminStatic.read(path);
        return { ok: true, ...payload };
      }
      return productionWrite(path, options);
    }
    const response = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await parseJsonResponse(response);
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function uploadImage(url, file, fields = {}) {
    const body = new FormData();
    body.append('file', file, file.name);
    Object.entries(fields || {}).forEach(([key, value]) => {
      if (value != null && value !== '') body.append(key, value);
    });
    if (isProductionAdmin()) return productionWrite(url, { method: 'POST', body });
    const response = await fetch(url, { method: 'POST', credentials: 'include', body });
    const data = await parseJsonResponse(response);
    if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function loginWithCode(code) {
    state.error = '';
    try {
      await api('/admin/api/login', { method: 'POST', body: JSON.stringify({ code }) });
      state.authed = true;
      location.hash = '#/dashboard';
      await loadContent();
      await draw();
    } catch (error) {
      state.error = error.message;
      renderLogin();
    }
  }

  async function refreshSession() {
    if (isProductionAdmin()) {
      state.server = false;
      state.authed = true;
      return;
    }
    try {
      const data = await api('/admin/api/session');
      state.server = true;
      state.authed = Boolean(data.authed);
    } catch (error) {
      state.server = error.status !== 404 && !String(error.message || '').includes('Failed to fetch');
      if (!state.server || error.status === 401) state.authed = false;
    }
  }

  async function loadContent() {
    const data = await api('/admin/api/content');
    state.types = Array.isArray(data.types) ? data.types : [];
    const next = { videos: data.videos || [] };
    writingKindIds().forEach((kind) => {
      next[kind] = data[kind] || [];
    });
    state.content = next;
  }

  async function loadSite() {
    const data = await api('/admin/api/site');
    state.site = data.site || null;
    try {
      const platforms = await api('/admin/api/social-platforms');
      state.platforms = platforms.platforms || [];
    } catch {
      state.platforms = [];
    }
  }

  function banner() {
    if (isProductionAdmin()) return '';
    return `<div class="banner">${escapeHtml(t('banner'))}</div>`;
  }

  function uiLangSwitch() {
    return `<div class="ui-lang" role="group" aria-label="${escapeHtml(t('tabs.uiLabel'))}">
      <button type="button" class="${uiLang() === 'en' ? 'is-active' : ''}" data-ui-lang="en">${escapeHtml(t('tabs.uiEn'))}</button>
      <button type="button" class="${uiLang() === 'tr' ? 'is-active' : ''}" data-ui-lang="tr">${escapeHtml(t('tabs.uiTr'))}</button>
    </div>`;
  }

  function currentNav() {
    const { parts } = route();
    const page = parts[0];
    if (page === 'writings' || page === 'articles' || page === 'notes' || page === 'writing-types') return 'writings';
    if ((page === 'new' || page === 'edit') && parts[1] && parts[1] !== 'videos') return 'writings';
    if (page === 'videos' || ((page === 'new' || page === 'edit') && parts[1] === 'videos')) return 'videos';
    if (page === 'projects' || page === 'project-categories' || ((page === 'new' || page === 'edit') && parts[1] === 'projects')) return 'projects';
    if (page === 'guides' || ((page === 'new' || page === 'edit') && parts[1] === 'guides')) return 'guides';
    if (page === 'social-links') return 'social-links';
    return page;
  }

  function navLink(href, label, id) {
    const on = currentNav() === id;
    return `<a class="nav-link ${on ? 'is-active' : ''}" href="${href}">${escapeHtml(label)}</a>`;
  }

  function layout(title, inner, extras) {
    const lead = extras && extras.lead ? extras.lead : '';
    return `
      <div class="layout ${state.navOpen ? 'is-nav-open' : ''}">
        <button class="nav-backdrop" type="button" data-nav-close aria-label="${escapeHtml(t('nav.close'))}"></button>
        <aside class="sidenav" id="admin-nav">
          <p class="nav-brand">${escapeHtml(t('brand'))}</p>
          ${navLink('#/dashboard', t('nav.dashboard'), 'dashboard')}
          <div class="nav-section">
            <p class="nav-group">${escapeHtml(t('nav.content'))}</p>
            ${navLink('#/writings', t('nav.writings'), 'writings')}
            ${navLink('#/videos', t('nav.videos'), 'videos')}
            ${navLink('#/guides', t('nav.guides'), 'guides')}
          </div>
          <div class="nav-section">
            <p class="nav-group">${escapeHtml(t('nav.portfolio'))}</p>
            ${navLink('#/projects', t('nav.projects'), 'projects')}
            ${navLink('#/about', t('nav.about'), 'about')}
            ${navLink('#/resume', t('nav.resume'), 'resume')}
          </div>
          <div class="nav-section">
            <p class="nav-group">${escapeHtml(t('nav.site'))}</p>
            ${navLink('#/profile', t('nav.profile'), 'profile')}
            ${navLink('#/social-links', t('nav.social'), 'social-links')}
            ${navLink('#/contact', t('nav.contact'), 'contact')}
          </div>
        </aside>
        <div class="main">
          ${banner()}
          <div class="page">
          <header class="topbar">
            <button class="icon-btn menu-btn" type="button" data-nav-toggle aria-label="${escapeHtml(t('nav.menu'))}">☰</button>
            <div class="top-actions">
              ${uiLangSwitch()}
              <button class="btn btn-ghost" type="button" data-logout>${escapeHtml(t('auth.signOut'))}</button>
            </div>
          </header>
          <div class="shell">
            <header class="page-header">
              <h1>${escapeHtml(title)}</h1>
              ${lead ? `<p class="page-lead">${escapeHtml(lead)}</p>` : ''}
            </header>
            ${state.error ? `<div class="error" role="alert">${escapeHtml(state.error)}</div>` : ''}
            ${state.notice ? `<div class="ok">${escapeHtml(state.notice)}</div>` : ''}
            ${inner}
          </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderLogin() {
    app.innerHTML = `
      <div class="login-wrap">
        ${banner()}
        <form class="login-card" data-login>
          <div class="login-lang">${uiLangSwitch()}</div>
          <h1>${escapeHtml(t('auth.title'))}</h1>
          <p>${escapeHtml(t('auth.intro'))}</p>
          ${state.error ? `<div class="error" role="alert">${escapeHtml(state.error)}</div>` : ''}
          ${!state.server ? `<div class="error">${escapeHtml(t('auth.noApi'))}</div>` : ''}
          <div class="field">
            <label for="login-code">${escapeHtml(t('auth.code'))}</label>
            <input id="login-code" name="code" type="password" inputmode="text" autocomplete="off" required>
          </div>
          <button class="btn btn-gold btn-block" type="submit">${escapeHtml(t('auth.enter'))}</button>
        </form>
      </div>
    `;
  }

  function renderDashboard() {
    const counts = { videos: (state.content.videos || []).length };
    writingKindIds().forEach((kind) => { counts[kind] = (state.content[kind] || []).length; });
    app.innerHTML = layout(t('nav.dashboard'), `
      <div class="row-actions">
        <button class="btn btn-gold" data-go="#/new/articles">${escapeHtml(t('dash.newWriting'))}</button>
        <button class="btn btn-ghost" data-go="#/new/videos">${escapeHtml(t('dash.newVideo'))}</button>
        <button class="btn btn-ghost" data-go="#/new/projects">${escapeHtml(t('dash.newProject'))}</button>
        <button class="btn btn-ghost" data-go="#/new/guides">${escapeHtml(t('dash.newGuide'))}</button>
      </div>
      <div class="grid cards">
        <a class="dash-card" href="#/writings">
          <h2>${escapeHtml(t('dash.writings'))}</h2>
          ${writingKindIds().map((kind) => `<p>${escapeHtml(typeFilterLabel(kind))}: ${counts[kind] || 0}</p>`).join('')}
        </a>
        <a class="dash-card" href="#/videos">
          <h2>${escapeHtml(t('dash.videos'))}</h2>
          <span class="count">${escapeHtml(t('dash.onDisk', { n: counts.videos }))}</span>
        </a>
        <a class="dash-card" href="#/projects">
          <h2>${escapeHtml(t('nav.projects'))}</h2>
          <p>${escapeHtml(t('dash.quickEdit'))}</p>
        </a>
        <a class="dash-card" href="#/guides">
          <h2>${escapeHtml(t('nav.guides'))}</h2>
          <p>${escapeHtml(t('dash.quickEdit'))}</p>
        </a>
        <a class="dash-card" href="#/about">
          <h2>${escapeHtml(t('nav.about'))}</h2>
          <p>${escapeHtml(t('dash.quickEdit'))}</p>
        </a>
        <a class="dash-card" href="#/resume">
          <h2>${escapeHtml(t('nav.resume'))}</h2>
          <p>${escapeHtml(t('dash.quickEdit'))}</p>
        </a>
        <a class="dash-card" href="#/profile">
          <h2>${escapeHtml(t('dash.profile'))}</h2>
          <p>${escapeHtml(t('dash.quickEdit'))}</p>
        </a>
        <a class="dash-card" href="#/social-links">
          <h2>${escapeHtml(t('dash.socialLinks'))}</h2>
          <p>${escapeHtml(t('dash.quickEdit'))}</p>
        </a>
        <a class="dash-card" href="#/contact">
          <h2>${escapeHtml(t('nav.contact'))}</h2>
          <p>${escapeHtml(t('dash.quickEdit'))}</p>
        </a>
      </div>
    `);
  }

  function coverSrc(name) {
    const value = String(name || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:') || value.startsWith('../')) {
      return value;
    }
    if (value.startsWith('./')) return `/${value.slice(2)}`;
    if (value.startsWith('assets/')) return `/${value}`;
    return `/assets/images/blog/${value.replace(/^\/+/, '')}`;
  }

  function itemCover(item) {
    const en = item.languages && item.languages.en;
    const tr = item.languages && item.languages.tr;
    return (en && en.cover) || (tr && tr.cover) || '';
  }

  function previewHref(item) {
    if (isExternalType(item.kind)) {
      const url = (item.languages.en && item.languages.en.externalUrl) || (item.languages.tr && item.languages.tr.externalUrl);
      return url || '/';
    }
    return `/#/yazilar/${item.kind}/${encodeURIComponent(item.id)}`;
  }

  function allWritings() {
    return writingKindIds().flatMap((kind) => (state.content[kind] || []).map((item) => ({ ...item, kind })))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.id).localeCompare(String(b.id)));
  }

  function renderWritingsList() {
    const filter = state.writingsFilter;
    const items = allWritings().filter((item) => filter === 'all' || item.kind === filter);
    const filters = [['all', t('writings.filterAll')], ...writingKindIds().map((id) => [id, typeFilterLabel(id)])];
    const rows = items.length ? items.map((item) => {
      const title = writingListTitle(item);
      const cover = itemCover(item);
      const enOk = Boolean(item.languages && item.languages.en);
      const trOk = Boolean(item.languages && item.languages.tr);
      return `
        <article class="item writing-row">
          ${cover
            ? `<img class="list-thumb" src="${escapeHtml(coverSrc(cover))}" alt="">`
            : `<div class="list-thumb list-thumb-fallback" aria-hidden="true"></div>`}
          <div class="item-body">
            <h3>${escapeHtml(title)}</h3>
            <div class="meta">
              <span class="pill gold">${escapeHtml(typeLabel(item.kind))}</span>
              <span class="pill">${escapeHtml(t('writings.en'))} ${enOk ? '✓' : t('writings.missing')}</span>
              <span class="pill">${escapeHtml(t('writings.tr'))} ${trOk ? '✓' : t('writings.missing')}</span>
              <span class="pill">${escapeHtml(item.date || '')}</span>
            </div>
            <div class="item-actions">
              <button class="btn btn-ghost" data-go="#/edit/${item.kind}/${encodeURIComponent(item.id)}">${escapeHtml(t('writings.editBtn'))}</button>
              <a class="btn btn-ghost" href="${escapeHtml(previewHref(item))}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('writings.preview'))}</a>
            </div>
          </div>
        </article>
      `;
    }).join('') : `<p class="empty">${escapeHtml(t('writings.empty'))}</p>`;

    app.innerHTML = layout(t('writings.title'), `
      <div class="row-actions">
        <button class="btn btn-gold" data-go="#/new/articles">${escapeHtml(t('writings.new'))}</button>
        <button class="btn btn-ghost" data-go="#/writing-types">${escapeHtml(t('types.manage'))}</button>
      </div>
      <div class="filters" role="group">
        ${filters.map(([id, label]) => `
          <button type="button" class="tab ${filter === id ? 'is-active' : ''}" data-writings-filter="${id}">${escapeHtml(label)}</button>
        `).join('')}
      </div>
      <div class="list">${rows}</div>
    `);
  }

  function renderVideosList() {
    const items = state.content.videos || [];
    const rows = items.length ? items.map((item) => `
      <article class="item">
        <h3>${escapeHtml(item.titleEn || item.titleTr || item.title)}</h3>
        <div class="meta">
          <span class="pill gold">${escapeHtml(t('nav.videos'))}</span>
          <span class="pill">${escapeHtml(item.date || '')}</span>
          <span class="pill">${escapeHtml(item.youtubeId || '')}</span>
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost" data-go="#/edit/videos/${encodeURIComponent(item.id)}">${escapeHtml(t('writings.editBtn'))}</button>
          <a class="btn btn-ghost" href="/#videos" target="_blank" rel="noopener">${escapeHtml(t('writings.preview'))}</a>
        </div>
      </article>
    `).join('') : `<p class="empty">${escapeHtml(t('video.empty'))}</p>`;
    app.innerHTML = layout(t('video.title'), `
      <div class="row-actions">
        <button class="btn btn-gold" data-go="#/new/videos">${escapeHtml(t('video.new'))}</button>
      </div>
      <div class="list">${rows}</div>
    `);
  }

  function emptyLang() {
    return { title: '', cover: '', coverFile: null, coverPreview: '', body: '', exists: false, file: '' };
  }

  function emptyEditor(kind) {
    return {
      mode: 'new',
      kind: writingKindIds().includes(kind) ? kind : 'articles',
      originalKind: writingKindIds().includes(kind) ? kind : 'articles',
      sharedId: '',
      lang: 'en',
      pair: { date: today(), externalUrl: '' },
      kindPending: null,
      langs: { en: emptyLang(), tr: emptyLang() },
      video: { titleEn: '', titleTr: '', date: today(), youtubeUrl: '', id: '' }
    };
  }

  function mdButton(cmd, label, visible) {
    const text = visible == null ? label : visible;
    return `<button type="button" data-md="${escapeHtml(cmd)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${escapeHtml(text)}</button>`;
  }

  function toolbar() {
    return `<div class="toolbar" role="toolbar">
      ${mdButton('h2', t('md.heading'), t('md.headingShort'))}
      ${mdButton('bold', t('md.bold'), t('md.boldShort'))}
      ${mdButton('italic', t('md.italic'), t('md.italicShort'))}
      ${mdButton('link', t('md.link'))}
      ${mdButton('ul', t('md.bullet'), t('md.bulletShort'))}
      ${mdButton('ol', t('md.numbered'), t('md.numberedShort'))}
      ${mdButton('quote', t('md.quote'))}
      ${mdButton('code', t('md.code'))}
    </div>`;
  }

  function wrapSelection(textarea, before, after = before) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end) || 'text';
    textarea.value = value.slice(0, start) + before + selected + after + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    textarea.dispatchEvent(new Event('input'));
  }

  function lineBounds(value, start, end) {
    const from = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let to = value.indexOf('\n', end);
    if (end > start && value.charAt(end - 1) === '\n') to = end - 1;
    else if (to === -1) to = value.length;
    return [from, to];
  }

  function prefixLines(textarea, prefix) {
    const value = textarea.value;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;
    [start, end] = lineBounds(value, start, end);
    const block = value.slice(start, end);
    const lines = block.split('\n');
    let next;
    if (prefix === '> ') {
      const nonempty = lines.filter((line) => line.trim() !== '');
      const quoted = nonempty.length > 0 && nonempty.every((line) => /^\s*> ?/.test(line));
      next = lines.map((line) => {
        if (quoted) return line.replace(/^\s*> ?/, '');
        if (/^\s*> ?/.test(line)) return line.replace(/^\s*> ?/, '> ');
        if (line.trim() === '') return '>';
        return `> ${line}`;
      }).join('\n');
    } else {
      const fallback = lines.length === 1 && lines[0] === '' ? ['item'] : lines;
      next = fallback.map((line, index) => {
        if (prefix === '1. ') return `${index + 1}. ${line.replace(/^\d+\.\s+/, '')}`;
        return prefix + line.replace(/^([-*]|>)\s+/, '');
      }).join('\n');
    }
    textarea.value = value.slice(0, start) + next + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start, start + next.length);
    textarea.dispatchEvent(new Event('input'));
  }

  function applyMd(cmd, textarea) {
    if (cmd === 'h2') return prefixLines(textarea, '## ');
    if (cmd === 'bold') return wrapSelection(textarea, '**');
    if (cmd === 'italic') return wrapSelection(textarea, '*');
    if (cmd === 'link') return wrapSelection(textarea, '[', '](https://)');
    if (cmd === 'ul') return prefixLines(textarea, '- ');
    if (cmd === 'ol') return prefixLines(textarea, '1. ');
    if (cmd === 'quote') return prefixLines(textarea, '> ');
    if (cmd === 'code') return wrapSelection(textarea, '`');
  }

  function coverBlock(draft, kindLabel) {
    if (draft.coverPreview) return `<div class="cover-preview"><img src="${escapeHtml(draft.coverPreview)}" alt=""></div>`;
    if (draft.cover) return `<div class="cover-preview"><img src="${escapeHtml(coverSrc(draft.cover))}" alt=""></div>`;
    return `<div class="cover-fallback">
      <div class="title">${escapeHtml(draft.title || t('writings.titleField'))}</div>
      <div class="kicker">${escapeHtml(kindLabel)}</div>
    </div>`;
  }

  function coverPicker(draft) {
    const hasImage = Boolean(draft.coverPreview || draft.cover);
    const name = draft.coverFile?.name || draft.cover || '';
    return `
      <div class="field">
        <label for="cover-file">${escapeHtml(t('writings.cover'))}</label>
        <input id="cover-file" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden>
        ${hasImage ? `
          <div class="cover-picker">
            ${coverBlock(draft, '')}
            ${name ? `<span class="hint">${escapeHtml(name)}</span>` : ''}
            <div class="cover-actions">
              <button class="btn btn-ghost" type="button" data-cover-pick>${escapeHtml(t('writings.replace'))}</button>
              <button class="btn btn-ghost" type="button" data-cover-remove>${escapeHtml(t('writings.remove'))}</button>
            </div>
          </div>
        ` : `
          <button class="btn btn-ghost" type="button" data-cover-pick>${escapeHtml(t('writings.chooseImage'))}</button>
          <span class="hint">${escapeHtml(t('writings.coverHint'))}</span>
        `}
      </div>
    `;
  }

  function writingAutomation(editor) {
    const lang = editor.lang;
    const draft = editor.langs[lang];
    const id = editor.sharedId || '';
    const kind = editor.kind;
    const filename = id ? `${id}.md` : 'derived-from-title.md';
    return {
      id: id || t('preview.idHint'),
      filename,
      language: lang === 'en' ? t('tabs.contentEn') : t('tabs.contentTr'),
      kind: typeLabel(kind),
      slug: id ? `#/yazilar/${kind}/${id}` : '#/yazilar/…',
      excerpt: excerpt(draft.body) || t('preview.excerptHint'),
      readingTime: `${readingMinutes(draft.body)} min`,
      cover: draft.coverFile ? t('preview.coverPending', { name: draft.coverFile.name }) : (draft.cover || t('preview.coverFallback')),
      path: id ? `content/${kind}/${lang}/${filename}` : 'content/…',
      markdown: writingMarkdown({ ...draft }, editor.pair, kind)
    };
  }

  function renderWritingEditor() {
    const editor = state.editor;
    const kind = editor.kind;
    const lang = editor.lang;
    const draft = editor.langs[lang];
    const auto = writingAutomation(editor);
    const heading = editor.mode === 'new' ? t('writings.new') : t('writings.edit');
    const originalKind = editor.originalKind || kind;
    const categoryIds = writingKindIds();
    const categoryChanged = editor.mode === 'edit' && originalKind !== kind;
    const pending = editor.kindPending;
    const showX = isExternalType(pending ? pending.to : kind);
    const xField = showX ? `
      <div class="field">
        <label for="x-url">${escapeHtml(t('writings.xUrl'))}</label>
        <input id="x-url" data-pair="externalUrl" type="url" placeholder="https://x.com/…" value="${escapeHtml(editor.pair.externalUrl)}" required>
        <span class="hint">${escapeHtml(t('writings.xHint'))}</span>
      </div>` : '';
    const kindConfirm = pending ? `
      <div class="dialog-card">
        <p>${escapeHtml(isExternalType(pending.to) ? t('writings.becomeX') : t('writings.becomeInternal'))}</p>
        <div class="item-actions">
          <button class="btn btn-ghost" type="button" data-cancel-kind>${escapeHtml(t('types.cancel'))}</button>
          <button class="btn btn-gold" type="button" data-confirm-kind>${escapeHtml(t('writings.moveWriting'))}</button>
        </div>
      </div>` : '';

    app.innerHTML = layout(heading, `
      <p class="hint">${escapeHtml(t('writings.pairHint'))}</p>
      <div class="tabs" role="tablist" aria-label="Content language">
        <button type="button" class="tab ${lang === 'en' ? 'is-active' : ''}" data-lang="en">${escapeHtml(t('tabs.contentEn'))}</button>
        <button type="button" class="tab ${lang === 'tr' ? 'is-active' : ''}" data-lang="tr">${escapeHtml(t('tabs.contentTr'))}</button>
      </div>
      <div class="editor-layout">
        <form data-editor>
          <div class="field">
            <label for="kind">${escapeHtml(t('writings.type'))}</label>
            <select id="kind" data-kind-select>
              ${categoryIds.map((id) => `<option value="${id}" ${id === (pending ? pending.to : kind) ? 'selected' : ''}>${escapeHtml(typeLabel(id))}</option>`).join('')}
            </select>
            ${editor.mode === 'edit' ? `<span class="hint">${escapeHtml(t('writings.moveHint'))}</span>` : ''}
            ${categoryChanged ? `<span class="hint">${escapeHtml(t('writings.moveUrlHint'))}</span>` : ''}
            ${kindConfirm}
          </div>
          <div class="field">
            <label for="title">${escapeHtml(t('writings.titleField'))}</label>
            <input id="title" data-field="title" type="text" required value="${escapeHtml(draft.title)}">
          </div>
          <div class="field">
            <label for="date">${escapeHtml(t('writings.date'))}</label>
            <input id="date" data-pair="date" type="date" required value="${escapeHtml(editor.pair.date)}">
            <span class="hint">${escapeHtml(t('writings.dateHint'))}</span>
          </div>
          ${xField}
          ${coverPicker(draft)}
          <div class="field">
            <label for="body">${escapeHtml(isExternalType(kind) ? t('writings.commentary') : t('writings.content'))}</label>
            ${toolbar()}
            <textarea id="body" data-field="body">${escapeHtml(draft.body)}</textarea>
          </div>
        </form>
        <aside>
          <details class="advanced" open>
            <summary>${escapeHtml(t('preview.advanced'))}</summary>
            <div class="auto-card">
              <h3>${escapeHtml(t('preview.title'))}</h3>
              <dl>
                <dt>${escapeHtml(t('preview.sharedId'))}</dt><dd>${escapeHtml(auto.id)}</dd>
                <dt>${escapeHtml(t('preview.filename'))}</dt><dd>${escapeHtml(auto.filename)}</dd>
                <dt>${escapeHtml(t('preview.language'))}</dt><dd>${escapeHtml(auto.language)}</dd>
                <dt>${escapeHtml(t('preview.kind'))}</dt><dd>${escapeHtml(auto.kind)}</dd>
                <dt>${escapeHtml(t('preview.internal'))}</dt><dd>${escapeHtml(auto.slug)}</dd>
                <dt>${escapeHtml(t('preview.excerpt'))}</dt><dd>${escapeHtml(auto.excerpt)}</dd>
                <dt>${escapeHtml(t('preview.reading'))}</dt><dd>${escapeHtml(auto.readingTime)}</dd>
                <dt>${escapeHtml(t('preview.cover'))}</dt><dd>${escapeHtml(auto.cover)}</dd>
                <dt>${escapeHtml(t('preview.path'))}</dt><dd>${escapeHtml(auto.path)}</dd>
              </dl>
            </div>
            <div class="auto-card" style="margin-top:12px">
              <h3>${escapeHtml(t('preview.fallback'))}</h3>
              ${coverBlock(draft, typeLabel(kind))}
            </div>
            <div class="md-card" style="margin-top:12px">
              <h3>${escapeHtml(t('preview.markdown'))}</h3>
              <pre>${escapeHtml(auto.markdown)}</pre>
            </div>
          </details>
        </aside>
      </div>
      <div class="footer-actions">
        <button class="btn btn-ghost" type="button" data-preview-md>${escapeHtml(t('writings.refresh'))}</button>
        <button class="btn btn-gold" type="button" data-save>${escapeHtml(t('writings.save'))}</button>
      </div>
    `);
  }

  function renderVideoEditor() {
    const draft = state.editor.video;
    const id = youtubeIdFromUrl(draft.youtubeUrl);
    const fileId = slugify(draft.titleEn || draft.titleTr);
    const heading = state.editor.mode === 'new' ? t('video.new') : t('video.edit');
    app.innerHTML = layout(heading, `
      <div class="editor-layout">
        <form data-video>
          <div class="field">
            <label for="yt">${escapeHtml(t('video.url'))}</label>
            <input id="yt" data-vfield="youtubeUrl" type="url" placeholder="https://youtu.be/…" value="${escapeHtml(draft.youtubeUrl)}" required>
            <span class="hint">${escapeHtml(t('video.urlHint'))}</span>
          </div>
          <div class="field">
            <label for="ten">${escapeHtml(t('video.titleEn'))}</label>
            <input id="ten" data-vfield="titleEn" type="text" required value="${escapeHtml(draft.titleEn)}">
          </div>
          <div class="field">
            <label for="ttr">${escapeHtml(t('video.titleTr'))}</label>
            <input id="ttr" data-vfield="titleTr" type="text" required value="${escapeHtml(draft.titleTr)}">
          </div>
          <div class="field">
            <label for="vdate">${escapeHtml(t('video.date'))}</label>
            <input id="vdate" data-vfield="date" type="date" required value="${escapeHtml(draft.date)}">
          </div>
          ${id ? `
            <img class="thumb" src="https://i.ytimg.com/vi/${escapeHtml(id)}/hqdefault.jpg" alt="${escapeHtml(t('video.thumb'))}">
            <p class="hint">${escapeHtml(t('video.parsedId'))}: ${escapeHtml(id)}</p>
            <p class="hint">${escapeHtml(t('video.embed'))}: https://www.youtube.com/embed/${escapeHtml(id)}</p>
          ` : ''}
        </form>
        <aside>
          <details class="advanced" open>
            <summary>${escapeHtml(t('preview.advanced'))}</summary>
            <div class="auto-card">
              <dl>
                <dt>${escapeHtml(t('preview.filename'))}</dt><dd>${escapeHtml(fileId ? `${fileId}.md` : '…')}</dd>
                <dt>${escapeHtml(t('preview.path'))}</dt><dd>content/videos/${escapeHtml(fileId || '…')}.md</dd>
              </dl>
            </div>
            <div class="md-card" style="margin-top:12px">
              <pre>${escapeHtml(videoMarkdown(draft))}</pre>
            </div>
          </details>
        </aside>
      </div>
      <div class="footer-actions">
        <button class="btn btn-ghost" type="button" data-preview-md>${escapeHtml(t('writings.refresh'))}</button>
        <button class="btn btn-gold" type="button" data-save-video>${escapeHtml(t('video.save'))}</button>
      </div>
    `);
  }

  function loc(obj) {
    const lang = state.profileLang === 'tr' ? 'tr' : 'en';
    if (!obj || typeof obj !== 'object') return '';
    return obj[lang] || '';
  }

  function renderProfile() {
    const site = state.site || {};
    const wa = site.whatsapp || {};
    const avatarSrc = state.avatarPreview || publicAssetUrl(site.avatar);
    const lang = state.profileLang;
    app.innerHTML = layout(t('profile.title'), `
      <form data-profile>
        <h3 class="section-label">${escapeHtml(t('profile.common'))}</h3>
        <div class="field">
          <label>${escapeHtml(t('profile.avatar'))}</label>
          <input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden>
          ${avatarSrc ? `<div class="avatar-preview"><img src="${escapeHtml(avatarSrc)}" alt=""></div>` : ''}
          <div class="cover-actions">
            <button class="btn btn-ghost" type="button" data-avatar-pick>${escapeHtml(t('writings.chooseImage'))}</button>
            ${state.avatarPreview ? `<button class="btn btn-ghost" type="button" data-avatar-remove>${escapeHtml(t('writings.remove'))}</button>` : ''}
          </div>
        </div>
        <div class="field">
          <label for="displayName">${escapeHtml(t('profile.displayName'))}</label>
          <input id="displayName" data-profile-field="displayName" type="text" required value="${escapeHtml(site.displayName || '')}">
        </div>
        <div class="field">
          <label for="motto">${escapeHtml(t('profile.motto'))}</label>
          <input id="motto" data-profile-field="motto" type="text" value="${escapeHtml(site.motto || '')}">
        </div>
        <div class="field">
          <label for="email">${escapeHtml(t('profile.email'))}</label>
          <input id="email" data-profile-field="email" type="email" value="${escapeHtml(site.email || '')}">
        </div>
        <div class="field">
          <label for="wa-display">${escapeHtml(t('profile.whatsapp'))}</label>
          <input id="wa-display" data-wa="display" type="text" value="${escapeHtml(wa.display || '')}">
        </div>
        <div class="field">
          <label for="wa-url">${escapeHtml(t('profile.whatsappUrl'))}</label>
          <input id="wa-url" data-wa="url" type="url" value="${escapeHtml(wa.url || '')}">
        </div>
        <h3 class="section-label">${escapeHtml(t('profile.localized'))}</h3>
        <div class="tabs">
          <button type="button" class="tab ${lang === 'en' ? 'is-active' : ''}" data-profile-lang="en">${escapeHtml(t('tabs.contentEn'))}</button>
          <button type="button" class="tab ${lang === 'tr' ? 'is-active' : ''}" data-profile-lang="tr">${escapeHtml(t('tabs.contentTr'))}</button>
        </div>
        <div class="field">
          <label for="tagline">${escapeHtml(t('profile.tagline'))}</label>
          <input id="tagline" data-loc="tagline" type="text" value="${escapeHtml(loc(site.tagline))}">
        </div>
        <div class="field">
          <label for="loc-city">${escapeHtml(t('contact.city'))}</label>
          <input id="loc-city" data-location-field="city" type="text" value="${escapeHtml((site.location && site.location.city) || '')}">
        </div>
        <div class="field">
          <label for="loc-country">${escapeHtml(t('contact.country'))}</label>
          <input id="loc-country" data-location-field="country" type="text" value="${escapeHtml((site.location && site.location.country) || '')}">
        </div>
      </form>
      <div class="footer-actions">
        <button class="btn btn-gold" type="button" data-save-profile>${escapeHtml(t('profile.save'))}</button>
      </div>
    `);
  }

  function kindCount(id) {
    return (state.content[id] || []).length;
  }

  function moveTargets(fromId) {
    return writingKindIds().filter((id) => id !== fromId);
  }

  function renderWritingTypes() {
    const draft = state.typeDraft || { labelEn: '', labelTr: '', icon: 'book-outline' };
    const dialog = state.typeDialog;
    const rows = writingTypes().map((item) => {
      const core = Boolean(item.core || CORE_TYPE_IDS.includes(item.id));
      const count = kindCount(item.id);
      const editing = dialog && dialog.mode === 'edit' && dialog.id === item.id;
      const deleting = dialog && (dialog.mode === 'delete-empty' || dialog.mode === 'delete-move') && dialog.id === item.id;
      return `
        <article class="item category-card">
          <h3>${escapeHtml(pickLoc(item.label, item.id))}</h3>
          <div class="meta">
            <span class="pill gold">${escapeHtml(item.id)}</span>
            <span class="pill">${escapeHtml(item.mode === 'external' ? t('types.external') : t('types.internal'))}</span>
            <span class="pill">${escapeHtml(core ? t('types.core') : t('types.custom'))}</span>
            <span class="pill">${escapeHtml(t('types.count', { n: count }))}</span>
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost" type="button" data-edit-type="${escapeHtml(item.id)}">${escapeHtml(core ? t('types.editLabels') : t('types.edit'))}</button>
            ${core
              ? `<button class="btn btn-ghost" type="button" disabled title="${escapeHtml(t('types.coreNoDelete'))}" aria-disabled="true">${escapeHtml(t('types.delete'))}</button>`
              : `<button class="btn btn-ghost" type="button" data-delete-type="${escapeHtml(item.id)}">${escapeHtml(t('types.delete'))}</button>`}
          </div>
          ${editing ? `
            <div class="dialog-card">
              <div class="field">
                <label for="edit-type-en">${escapeHtml(t('types.nameEn'))}</label>
                <input id="edit-type-en" data-edit-label-en type="text" value="${escapeHtml(dialog.labelEn)}">
              </div>
              <div class="field">
                <label for="edit-type-tr">${escapeHtml(t('types.nameTr'))}</label>
                <input id="edit-type-tr" data-edit-label-tr type="text" value="${escapeHtml(dialog.labelTr)}">
              </div>
              ${core ? '' : `
              <div class="field">
                <label for="edit-type-icon">${escapeHtml(t('types.icon'))}</label>
                <select id="edit-type-icon" data-edit-icon>
                  ${TYPE_ICONS.map((icon) => `<option value="${icon}" ${icon === (dialog.icon || item.icon) ? 'selected' : ''}>${escapeHtml(icon.replace(/-outline$/, '').replace(/^logo-/, '').replace(/-/g, ' '))}</option>`).join('')}
                </select>
              </div>`}
              <div class="item-actions">
                <button class="btn btn-ghost" type="button" data-cancel-type-dialog>${escapeHtml(t('types.cancel'))}</button>
                <button class="btn btn-gold" type="button" data-save-type-edit>${escapeHtml(t('types.saveChanges'))}</button>
              </div>
            </div>` : ''}
          ${deleting && dialog.mode === 'delete-empty' ? `
            <div class="dialog-card">
              <p class="hint">${escapeHtml(t('types.confirmEmpty'))}</p>
              <div class="item-actions">
                <button class="btn btn-ghost" type="button" data-cancel-type-dialog>${escapeHtml(t('types.cancel'))}</button>
                <button class="btn btn-ghost" type="button" data-confirm-delete-empty>${escapeHtml(t('types.delete'))}</button>
              </div>
            </div>` : ''}
          ${deleting && dialog.mode === 'delete-move' ? `
            <div class="dialog-card">
              <p>${escapeHtml(t('types.contains', { n: dialog.count }))}</p>
              <div class="field">
                <label for="move-to">${escapeHtml(t('types.moveTo'))}</label>
                <select id="move-to" data-move-to>
                  ${moveTargets(item.id).map((id) => `<option value="${escapeHtml(id)}" ${id === dialog.moveTo ? 'selected' : ''}>${escapeHtml(typeLabel(id))}</option>`).join('')}
                </select>
              </div>
              <div class="item-actions">
                <button class="btn btn-ghost" type="button" data-cancel-type-dialog>${escapeHtml(t('types.cancel'))}</button>
                <button class="btn btn-gold" type="button" data-confirm-delete-move>${escapeHtml(t('types.moveDelete'))}</button>
              </div>
            </div>` : ''}
        </article>
      `;
    }).join('');
    app.innerHTML = layout(t('types.title'), `
      <form data-new-type class="type-form">
        <h3 class="section-label">${escapeHtml(t('types.new'))}</h3>
        <p class="hint">${escapeHtml(t('types.hint'))}</p>
        <div class="field">
          <label for="type-en">${escapeHtml(t('types.nameEn'))}</label>
          <input id="type-en" data-type-field="labelEn" type="text" required value="${escapeHtml(draft.labelEn)}">
        </div>
        <div class="field">
          <label for="type-tr">${escapeHtml(t('types.nameTr'))}</label>
          <input id="type-tr" data-type-field="labelTr" type="text" required value="${escapeHtml(draft.labelTr)}">
        </div>
        <div class="field">
          <label for="type-icon">${escapeHtml(t('types.icon'))}</label>
          <select id="type-icon" data-type-field="icon">
            ${TYPE_ICONS.map((icon) => `<option value="${icon}" ${icon === draft.icon ? 'selected' : ''}>${escapeHtml(icon.replace(/-outline$/, '').replace(/^logo-/, '').replace(/-/g, ' '))}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-gold" type="button" data-create-type>${escapeHtml(t('types.create'))}</button>
      </form>
      <div class="list">${rows}</div>
    `, { lead: t('types.lead') });
  }

  function platformById(id) {
    return (state.platforms || []).find((item) => item.id === id) || null;
  }

  function socialLabelText(item) {
    return pickLoc(item.label, item.id || '');
  }

  function renderSocial() {
    const links = Array.isArray(state.site && state.site.social) ? state.site.social : [];
    const used = new Set(links.map((item) => item.id));
    const options = (state.platforms || []).filter((platform) => platform.id === 'custom' || !used.has(platform.id));
    const rows = links.map((item, index) => {
      const custom = item.id === 'custom' || String(item.id || '').startsWith('custom') || item.platform === 'custom';
      const labelEn = typeof item.label === 'object' ? (item.label.en || '') : (item.label || '');
      const labelTr = typeof item.label === 'object' ? (item.label.tr || '') : '';
      return `
        <article class="social-row" data-social-row="${index}">
          <div class="social-row-head">
            <strong>${escapeHtml(socialLabelText(item))}</strong>
            <div class="item-actions">
              <button class="btn btn-ghost" type="button" data-social-up="${index}" ${index === 0 ? 'disabled' : ''}>${escapeHtml(t('social.up'))}</button>
              <button class="btn btn-ghost" type="button" data-social-down="${index}" ${index === links.length - 1 ? 'disabled' : ''}>${escapeHtml(t('social.down'))}</button>
              <button class="btn btn-ghost" type="button" data-social-remove="${index}">${escapeHtml(t('social.remove'))}</button>
            </div>
          </div>
          <div class="field">
            <label for="social-url-${index}">${escapeHtml(t('social.url'))}</label>
            <input id="social-url-${index}" data-social-url="${index}" type="url" required value="${escapeHtml(item.url || '')}">
          </div>
          ${custom ? `
            <div class="field">
              <label for="social-label-en-${index}">${escapeHtml(t('social.labelEn'))}</label>
              <input id="social-label-en-${index}" data-social-label-en="${index}" type="text" value="${escapeHtml(labelEn)}">
            </div>
            <div class="field">
              <label for="social-label-tr-${index}">${escapeHtml(t('social.labelTr'))}</label>
              <input id="social-label-tr-${index}" data-social-label-tr="${index}" type="text" value="${escapeHtml(labelTr)}">
            </div>
          ` : ''}
        </article>
      `;
    }).join('') || `<p class="empty">${escapeHtml(t('social.empty'))}</p>`;
    app.innerHTML = layout(t('social.title'), `
      <p class="hint">${escapeHtml(t('social.hint'))}</p>
      <div class="add-social">
        <label for="add-platform">${escapeHtml(t('social.platform'))}</label>
        <select id="add-platform">
          ${options.map((platform) => `<option value="${escapeHtml(platform.id)}">${escapeHtml(pickLoc(platform.label, platform.id))}</option>`).join('')}
        </select>
        <button class="btn btn-ghost" type="button" data-add-social>${escapeHtml(t('social.add'))}</button>
      </div>
      <form data-social>${rows}</form>
      <div class="footer-actions">
        <button class="btn btn-gold" type="button" data-save-social>${escapeHtml(t('social.save'))}</button>
      </div>
    `);
  }

  function syncLangFromForm() {
    if (!state.editor || state.editor.kind === 'videos') return;
    const draft = state.editor.langs[state.editor.lang];
    app.querySelectorAll('[data-field]').forEach((field) => { draft[field.dataset.field] = field.value; });
  }

  function syncPairFromForm() {
    if (!state.editor || state.editor.kind === 'videos') return;
    app.querySelectorAll('[data-pair]').forEach((field) => {
      const value = field.dataset.pair === 'date' ? normalizeDate(field.value) : field.value;
      state.editor.pair[field.dataset.pair] = value;
    });
  }

  function syncDraftFromForm() {
    syncLangFromForm();
    syncPairFromForm();
    if (state.editor && state.editor.kind !== 'videos') {
      maybeLockSharedId(state.editor, state.editor.langs[state.editor.lang].title);
    }
  }

  function syncVideoFromForm() {
    if (!state.editor || state.editor.kind !== 'videos') return;
    app.querySelectorAll('[data-vfield]').forEach((field) => {
      state.editor.video[field.dataset.vfield] = field.value;
    });
  }

  function syncProfileFromForm() {
    if (!state.site) return;
    app.querySelectorAll('[data-profile-field]').forEach((field) => {
      state.site[field.dataset.profileField] = field.value;
    });
    if (!state.site.whatsapp || typeof state.site.whatsapp !== 'object') state.site.whatsapp = {};
    app.querySelectorAll('[data-wa]').forEach((field) => {
      state.site.whatsapp[field.dataset.wa] = field.value;
    });
    const lang = state.profileLang === 'tr' ? 'tr' : 'en';
    app.querySelectorAll('[data-loc]').forEach((field) => {
      const key = field.dataset.loc;
      if (!state.site[key] || typeof state.site[key] !== 'object') state.site[key] = { en: '', tr: '' };
      state.site[key][lang] = field.value;
    });
    if (!state.site.location || typeof state.site.location !== 'object') state.site.location = {};
    app.querySelectorAll('[data-location-field]').forEach((field) => {
      state.site.location[field.dataset.locationField] = field.value.trim();
    });
  }

  async function saveWriting() {
    syncDraftFromForm();
    const editor = state.editor;
    const lang = editor.lang;
    const draft = editor.langs[lang];
    state.error = '';
    state.notice = '';
    if (editor.kindPending) {
      state.error = isExternalType(editor.kindPending.to) ? t('writings.becomeX') : t('writings.becomeInternal');
      renderWritingEditor();
      return;
    }
    if (isExternalType(editor.kind) && !isXUrl(editor.pair.externalUrl)) {
      state.error = t('errors.xUrl');
      renderWritingEditor();
      return;
    }
    const id = maybeLockSharedId(editor, draft.title);
    if (!id) {
      state.error = t('errors.titleFirst');
      renderWritingEditor();
      return;
    }
    try {
      if (draft.coverFile) {
        const uploaded = await uploadImage('/admin/api/cover', draft.coverFile);
        draft.cover = uploaded.filename;
        draft.coverFile = null;
      }
      const result = await api('/admin/api/save', {
        method: 'POST',
        body: JSON.stringify({
          kind: editor.kind,
          ...(editor.mode === 'edit' && editor.originalKind && editor.originalKind !== editor.kind
            ? { fromKind: editor.originalKind }
            : {}),
          lang,
          id,
          title: draft.title,
          date: normalizeDate(editor.pair.date),
          cover: draft.cover,
          body: draft.body,
          externalUrl: isExternalType(editor.kind) ? editor.pair.externalUrl : ''
        })
      });
      draft.exists = true;
      editor.sharedId = result.id || id;
      const previousKind = editor.originalKind;
      editor.mode = 'edit';
      editor.originalKind = editor.kind;
      if (!isExternalType(editor.kind)) editor.pair.externalUrl = '';
      if (previousKind && previousKind !== editor.kind) {
        history.replaceState(null, '', `${location.pathname}${location.search}#/edit/${editor.kind}/${encodeURIComponent(editor.sharedId)}`);
      }
      clearDirty();
      state.notice = [
        t('save.locally'),
        t('save.manifest'),
        t('save.refresh'),
        '',
        `${t('save.language')}: ${lang === 'en' ? t('tabs.contentEn') : t('tabs.contentTr')}`,
        `${t('save.sharedId')}: ${editor.sharedId}`,
        `${t('save.path')}: ${result.path}`,
        draft.cover ? `${t('save.cover')}: ${draft.cover}` : ''
      ].filter(Boolean).join('\n');
      await loadContent();
    } catch (error) {
      state.error = error.message;
    }
    renderWritingEditor();
  }

  async function saveVideo() {
    syncVideoFromForm();
    const draft = state.editor.video;
    state.error = '';
    state.notice = '';
    if (!youtubeIdFromUrl(draft.youtubeUrl)) {
      state.error = t('errors.youtube');
      renderVideoEditor();
      return;
    }
    try {
      const result = await api('/admin/api/save', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'videos',
          titleEn: draft.titleEn,
          titleTr: draft.titleTr,
          date: draft.date,
          youtubeUrl: draft.youtubeUrl,
          id: slugify(draft.titleEn || draft.titleTr)
        })
      });
      state.notice = [t('save.locally'), t('save.manifest'), t('save.refresh'), '', `${t('save.path')}: ${result.path}`].join('\n');
      clearDirty();
      await loadContent();
    } catch (error) {
      state.error = error.message;
    }
    renderVideoEditor();
  }

  async function saveProfile() {
    syncProfileFromForm();
    state.error = '';
    state.notice = '';
    try {
      if (state.avatarFile) {
        const uploaded = await uploadImage('/admin/api/avatar', state.avatarFile);
        state.site.avatar = uploaded.avatar || uploaded.path;
        state.avatarFile = null;
      }
      await api('/admin/api/site', {
        method: 'POST',
        body: JSON.stringify({
          displayName: state.site.displayName,
          motto: state.site.motto,
          email: state.site.email,
          ...(state.site.avatar ? { avatar: state.site.avatar } : {}),
          whatsapp: state.site.whatsapp,
          tagline: state.site.tagline,
          location: state.site.location
        })
      });
      await loadSite();
      if (state.avatarPreview) URL.revokeObjectURL(state.avatarPreview);
      state.avatarPreview = '';
      state.notice = t('profile.saved');
      clearDirty();
    } catch (error) {
      state.error = error.message;
    }
    renderProfile();
  }

  function syncSocialFromForm() {
    if (!state.site || !Array.isArray(state.site.social)) return;
    app.querySelectorAll('[data-social-url]').forEach((field) => {
      const index = Number(field.dataset.socialUrl);
      if (state.site.social[index]) state.site.social[index].url = field.value.trim();
    });
    app.querySelectorAll('[data-social-label-en]').forEach((field) => {
      const index = Number(field.dataset.socialLabelEn);
      const item = state.site.social[index];
      if (!item) return;
      const trField = app.querySelector(`[data-social-label-tr="${index}"]`);
      item.label = { en: field.value.trim(), tr: trField ? trField.value.trim() : '' };
    });
  }

  async function saveSocial() {
    syncSocialFromForm();
    state.error = '';
    state.notice = '';
    const social = (state.site.social || []).map((item) => ({
      id: item.id,
      url: String(item.url || '').trim(),
      icon: item.icon,
      label: item.label,
      platform: item.platform
    }));
    if (social.some((item) => !/^https:\/\/[^\s]+$/i.test(item.url))) {
      state.error = t('errors.socialUrl');
      renderSocial();
      return;
    }
    try {
      await api('/admin/api/site', { method: 'POST', body: JSON.stringify({ social }) });
      await loadSite();
      state.notice = t('social.saved');
      clearDirty();
    } catch (error) {
      state.error = error.message;
    }
    renderSocial();
  }

  async function createWritingType() {
    const labelEn = (app.querySelector('[data-type-field="labelEn"]') || {}).value || '';
    const labelTr = (app.querySelector('[data-type-field="labelTr"]') || {}).value || '';
    const icon = (app.querySelector('[data-type-field="icon"]') || {}).value || 'book-outline';
    state.typeDraft = { labelEn, labelTr, icon };
    state.error = '';
    state.notice = '';
    try {
      await api('/admin/api/writing-types', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', label: { en: labelEn.trim(), tr: labelTr.trim() }, icon })
      });
      state.typeDraft = { labelEn: '', labelTr: '', icon: 'book-outline' };
      await loadContent();
      state.notice = t('types.created');
    } catch (error) {
      state.error = error.message;
    }
    renderWritingTypes();
  }

  async function deleteWritingType(id) {
    const meta = typeMeta(id);
    if (meta.core || CORE_TYPE_IDS.includes(id)) return;
    const count = kindCount(id);
    state.error = '';
    state.notice = '';
    if (count) {
      const targets = moveTargets(id);
      state.typeDialog = { mode: 'delete-move', id, count, moveTo: targets[0] || '' };
    } else {
      state.typeDialog = { mode: 'delete-empty', id };
    }
    renderWritingTypes();
  }

  async function confirmDeleteEmpty() {
    const dialog = state.typeDialog;
    if (!dialog || dialog.mode !== 'delete-empty') return;
    state.error = '';
    state.notice = '';
    try {
      await api('/admin/api/writing-types', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: dialog.id })
      });
      state.typeDialog = null;
      await loadContent();
      state.notice = t('types.deleted');
    } catch (error) {
      state.error = error.message;
    }
    renderWritingTypes();
  }

  async function confirmDeleteMove() {
    const dialog = state.typeDialog;
    if (!dialog || dialog.mode !== 'delete-move') return;
    const moveTo = (app.querySelector('[data-move-to]') || {}).value || dialog.moveTo;
    state.error = '';
    state.notice = '';
    try {
      await api('/admin/api/writing-types', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id: dialog.id, moveTo })
      });
      state.typeDialog = null;
      await loadContent();
      state.notice = t('types.movedDeleted');
    } catch (error) {
      state.error = error.message;
    }
    renderWritingTypes();
  }

  async function saveTypeEdit() {
    const dialog = state.typeDialog;
    if (!dialog || dialog.mode !== 'edit') return;
    const labelEn = (app.querySelector('[data-edit-label-en]') || {}).value || '';
    const labelTr = (app.querySelector('[data-edit-label-tr]') || {}).value || '';
    const icon = (app.querySelector('[data-edit-icon]') || {}).value || dialog.icon;
    state.error = '';
    state.notice = '';
    try {
      await api('/admin/api/writing-types', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          id: dialog.id,
          label: { en: labelEn.trim(), tr: labelTr.trim() },
          filter: { en: labelEn.trim(), tr: labelTr.trim() },
          icon
        })
      });
      state.typeDialog = null;
      await loadContent();
      state.notice = t('types.updated');
    } catch (error) {
      state.error = error.message;
    }
    renderWritingTypes();
  }

  async function openEditor(kind, id) {
    state.editor = emptyEditor(kind);
    state.editor.mode = id ? 'edit' : 'new';
    state.editor.sharedId = id || '';
    state.editor.originalKind = kind;
    state.error = '';
    state.notice = '';
    if (!id) return;
    const data = await api(`/admin/api/item?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
    if (kind === 'videos') {
      state.editor.kind = 'videos';
      state.editor.video = {
        titleEn: data.video.titleEn || '',
        titleTr: data.video.titleTr || '',
        date: data.video.date || today(),
        youtubeUrl: data.video.youtubeUrl || '',
        id
      };
      return;
    }
    const enPack = data.languages.en || {};
    const trPack = data.languages.tr || {};
    state.editor.pair.date = enPack.date || trPack.date || today();
    state.editor.pair.externalUrl = enPack.externalUrl || trPack.externalUrl || '';
    ['en', 'tr'].forEach((lang) => {
      const pack = data.languages[lang] || {};
      state.editor.langs[lang] = {
        ...emptyLang(),
        title: pack.title || '',
        cover: pack.cover || '',
        body: pack.body || '',
        exists: Boolean(pack.exists),
        file: pack.file || ''
      };
    });
    if (!state.editor.langs.en.title && state.editor.langs.tr.title) state.editor.lang = 'tr';
  }

  function markDirty() {
    state.dirty = true;
  }

  function clearDirty() {
    state.dirty = false;
  }

  function confirmLeave() {
    if (!state.dirty) return true;
    return window.confirm(t('unsaved.leave'));
  }

  function isImageFile(file) {
    return /^image\/(png|jpeg|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
  }

  function bind() {
    app.addEventListener('submit', async (event) => {
      const form = event.target.closest('[data-login]');
      if (!form) return;
      event.preventDefault();
      await loginWithCode(form.code.value);
    });

    app.addEventListener('click', async (event) => {
      const ui = event.target.closest('[data-ui-lang]');
      if (ui) {
        event.preventDefault();
        setUiLang(ui.dataset.uiLang);
        await draw();
        return;
      }
      if (event.target.closest('[data-nav-toggle]')) {
        state.navOpen = !state.navOpen;
        app.querySelector('.layout')?.classList.toggle('is-nav-open', state.navOpen);
        return;
      }
      if (event.target.closest('[data-nav-close]')) {
        state.navOpen = false;
        app.querySelector('.layout')?.classList.remove('is-nav-open');
      }
      const filter = event.target.closest('[data-writings-filter]');
      if (filter) {
        state.writingsFilter = filter.dataset.writingsFilter;
        renderWritingsList();
        return;
      }
      const go = event.target.closest('[data-go]');
      if (go) {
        event.preventDefault();
        if (!confirmLeave()) return;
        clearDirty();
        location.hash = go.dataset.go;
        return;
      }
      const navA = event.target.closest('.nav-link');
      if (navA && navA.getAttribute('href') && navA.getAttribute('href').startsWith('#/')) {
        if (!confirmLeave()) {
          event.preventDefault();
          return;
        }
        clearDirty();
      }
      if (event.target.closest('[data-logout]')) {
        event.preventDefault();
        if (isProductionAdmin()) {
          location.href = '/cdn-cgi/access/logout';
          return;
        }
        try { await api('/admin/api/logout', { method: 'POST', body: '{}' }); } catch { /* ignore */ }
        state.authed = false;
        location.hash = '#/login';
        await draw();
        return;
      }
      const tab = event.target.closest('[data-lang]');
      if (tab && state.editor && state.editor.kind !== 'videos') {
        syncDraftFromForm();
        state.editor.lang = tab.dataset.lang;
        renderWritingEditor();
        return;
      }
      const pLang = event.target.closest('[data-profile-lang]');
      if (pLang && state.site) {
        syncProfileFromForm();
        state.profileLang = pLang.dataset.profileLang;
        renderProfile();
        return;
      }
      const md = event.target.closest('[data-md]');
      if (md) {
        const textarea = app.querySelector('#body');
        if (textarea) {
          applyMd(md.dataset.md, textarea);
          return;
        }
      }
      if (event.target.closest('[data-preview-md]')) {
        if (state.editor && state.editor.kind === 'videos') {
          syncVideoFromForm();
          renderVideoEditor();
        } else {
          syncDraftFromForm();
          renderWritingEditor();
        }
        return;
      }
      if (event.target.closest('[data-cover-pick]')) {
        event.preventDefault();
        app.querySelector('#cover-file')?.click();
        return;
      }
      if (event.target.closest('[data-cover-remove]')) {
        event.preventDefault();
        const draft = state.editor.langs[state.editor.lang];
        if (draft.coverPreview) URL.revokeObjectURL(draft.coverPreview);
        draft.cover = '';
        draft.coverFile = null;
        draft.coverPreview = '';
        renderWritingEditor();
        return;
      }
      if (event.target.closest('[data-avatar-pick]')) {
        event.preventDefault();
        app.querySelector('#avatar-file')?.click();
        return;
      }
      if (event.target.closest('[data-avatar-remove]')) {
        event.preventDefault();
        if (state.avatarPreview) URL.revokeObjectURL(state.avatarPreview);
        state.avatarFile = null;
        state.avatarPreview = '';
        renderProfile();
        return;
      }
      const addSocial = event.target.closest('[data-add-social]');
      if (addSocial) {
        event.preventDefault();
        syncSocialFromForm();
        if (!state.site) return;
        if (!Array.isArray(state.site.social)) state.site.social = [];
        const platformId = app.querySelector('#add-platform')?.value;
        const platform = platformById(platformId);
        if (!platform) return;
        const used = new Set(state.site.social.map((item) => item.id));
        let id = platform.id === 'custom' || used.has(platform.id) ? `custom-${slugify(String(Date.now()).slice(-8))}` : platform.id;
        while (used.has(id)) id = `${id}-2`;
        state.site.social.push({
          id,
          platform: platform.id,
          url: '',
          icon: platform.icon || 'link-outline',
          label: platform.id === 'custom' ? { en: '', tr: '' } : pickLoc(platform.label, platform.id)
        });
        renderSocial();
        return;
      }
      const socialUp = event.target.closest('[data-social-up]');
      if (socialUp) {
        event.preventDefault();
        syncSocialFromForm();
        const index = Number(socialUp.dataset.socialUp);
        if (index > 0) {
          const list = state.site.social;
          [list[index - 1], list[index]] = [list[index], list[index - 1]];
          renderSocial();
        }
        return;
      }
      const socialDown = event.target.closest('[data-social-down]');
      if (socialDown) {
        event.preventDefault();
        syncSocialFromForm();
        const index = Number(socialDown.dataset.socialDown);
        const list = state.site.social || [];
        if (index < list.length - 1) {
          [list[index + 1], list[index]] = [list[index], list[index + 1]];
          renderSocial();
        }
        return;
      }
      const socialRemove = event.target.closest('[data-social-remove]');
      if (socialRemove) {
        event.preventDefault();
        syncSocialFromForm();
        const index = Number(socialRemove.dataset.socialRemove);
        state.site.social.splice(index, 1);
        renderSocial();
        return;
      }
      if (event.target.closest('[data-create-type]')) {
        event.preventDefault();
        await createWritingType();
        return;
      }
      const deleteType = event.target.closest('[data-delete-type]');
      if (deleteType) {
        event.preventDefault();
        await deleteWritingType(deleteType.dataset.deleteType);
        return;
      }
      const editType = event.target.closest('[data-edit-type]');
      if (editType) {
        event.preventDefault();
        const meta = typeMeta(editType.dataset.editType);
        state.typeDialog = {
          mode: 'edit',
          id: meta.id,
          labelEn: (meta.label && meta.label.en) || '',
          labelTr: (meta.label && meta.label.tr) || '',
          icon: meta.icon || 'book-outline'
        };
        renderWritingTypes();
        return;
      }
      if (event.target.closest('[data-cancel-type-dialog]')) {
        event.preventDefault();
        state.typeDialog = null;
        renderWritingTypes();
        return;
      }
      if (event.target.closest('[data-confirm-delete-empty]')) {
        event.preventDefault();
        await confirmDeleteEmpty();
        return;
      }
      if (event.target.closest('[data-confirm-delete-move]')) {
        event.preventDefault();
        await confirmDeleteMove();
        return;
      }
      if (event.target.closest('[data-save-type-edit]')) {
        event.preventDefault();
        await saveTypeEdit();
        return;
      }
      if (event.target.closest('[data-confirm-kind]')) {
        event.preventDefault();
        if (state.editor && state.editor.kindPending) {
          syncDraftFromForm();
          state.editor.kind = state.editor.kindPending.to;
          state.editor.kindPending = null;
          renderWritingEditor();
        }
        return;
      }
      if (event.target.closest('[data-cancel-kind]')) {
        event.preventDefault();
        if (state.editor) {
          syncDraftFromForm();
          state.editor.kindPending = null;
          renderWritingEditor();
        }
        return;
      }
      if (event.target.closest('[data-save]')) {
        event.preventDefault();
        await saveWriting();
        return;
      }
      if (event.target.closest('[data-save-video]')) {
        event.preventDefault();
        await saveVideo();
        return;
      }
      if (event.target.closest('[data-save-profile]')) {
        event.preventDefault();
        await saveProfile();
        return;
      }
      if (event.target.closest('[data-save-social]')) {
        event.preventDefault();
        await saveSocial();
      }
    });

    app.addEventListener('change', (event) => {
      if (event.target.matches('[data-kind-select]') && state.editor) {
        syncDraftFromForm();
        const next = event.target.value;
        const editor = state.editor;
        const crossing = editor.mode === 'edit' && isExternalType(editor.kind) !== isExternalType(next);
        if (crossing) {
          editor.kindPending = { to: next };
        } else {
          editor.kindPending = null;
          editor.kind = next;
        }
        renderWritingEditor();
        return;
      }
      if (event.target.id === 'cover-file' && state.editor) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!isImageFile(file)) {
          state.error = t('errors.coverType');
          renderWritingEditor();
          return;
        }
        const draft = state.editor.langs[state.editor.lang];
        draft.coverFile = file;
        if (draft.coverPreview) URL.revokeObjectURL(draft.coverPreview);
        draft.coverPreview = URL.createObjectURL(file);
        renderWritingEditor();
        return;
      }
      if (event.target.id === 'avatar-file') {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!isImageFile(file)) {
          state.error = t('errors.coverType');
          renderProfile();
          return;
        }
        state.avatarFile = file;
        if (state.avatarPreview) URL.revokeObjectURL(state.avatarPreview);
        state.avatarPreview = URL.createObjectURL(file);
        renderProfile();
      }
    });

    app.addEventListener('input', (event) => {
      if (event.target.matches('[data-field], [data-pair], [data-vfield], [data-profile-field], [data-loc], [data-location-field], [data-wa], textarea, input, select')) {
        if (state.authed) markDirty();
      }
      if (event.target.matches('[data-field], [data-pair]')) syncDraftFromForm();
      if (event.target.matches('[data-vfield]')) syncVideoFromForm();
    });
  }

  async function draw() {
    const { parts } = route();
    const page = parts[0] || (isProductionAdmin() ? 'dashboard' : 'login');
    document.documentElement.lang = uiLang();
    state.navOpen = false;

    if (!state.authed && page !== 'login') {
      location.hash = '#/login';
      renderLogin();
      return;
    }
    if (isProductionAdmin() && page === 'login') {
      location.hash = '#/dashboard';
      renderDashboard();
      return;
    }

    try {
      if (page === 'login') { renderLogin(); return; }
      if (page === 'dashboard') { renderDashboard(); return; }
      if (page === 'writings' || page === 'articles' || page === 'notes' || page === 'social') {
        if (page !== 'writings') state.writingsFilter = page;
        renderWritingsList();
        return;
      }
      if (page === 'writing-types') {
        renderWritingTypes();
        return;
      }
      if (page === 'videos' && parts.length === 1) { renderVideosList(); return; }
      if (page === 'profile') {
        await loadSite();
        renderProfile();
        return;
      }
      if (page === 'social-links') {
        await loadSite();
        renderSocial();
        return;
      }
      if (page === 'new' && (writingKindIds().includes(parts[1]) || parts[1] === 'writing')) {
        await openEditor(parts[1] === 'writing' ? 'articles' : parts[1]);
        renderWritingEditor();
        return;
      }
      if (page === 'new' && parts[1] === 'videos') {
        await openEditor('videos');
        renderVideoEditor();
        return;
      }
      if (page === 'edit' && writingKindIds().includes(parts[1]) && parts[2]) {
        await openEditor(parts[1], decodeURIComponent(parts[2]));
        renderWritingEditor();
        return;
      }
      if (page === 'edit' && parts[1] === 'videos' && parts[2]) {
        await openEditor('videos', decodeURIComponent(parts[2]));
        renderVideoEditor();
        return;
      }
      if (window.AdminCMS && typeof window.AdminCMS.handleRoute === 'function') {
        const handled = await window.AdminCMS.handleRoute(page, parts);
        if (handled) return;
      }
      renderDashboard();
    } catch (error) {
      state.error = error.message;
      if (error.status === 401 && !isProductionAdmin()) {
        state.authed = false;
        renderLogin();
        return;
      }
      app.innerHTML = layout(t('auth.title'), `<div class="error">${escapeHtml(error.message)}</div>`);
    }
  }

  bind();
  window.KTAdmin = {
    state,
    t,
    escapeHtml,
    layout,
    api,
    uploadImage,
    isLocalAdminHost,
    isProductionAdmin,
    publicAssetUrl,
    slugify,
    toolbar,
    wrapSelection,
    prefixLines,
    applyMd,
    markDirty,
    clearDirty,
    confirmLeave,
    uiLang
  };
  setUiLang(state.uiLang);
  let ignoreHash = false;
  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.addEventListener('hashchange', () => {
    if (ignoreHash) return;
    if (state.dirty && !window.confirm(t('unsaved.leave'))) {
      ignoreHash = true;
      history.replaceState(null, '', state.lastHash || '#/dashboard');
      ignoreHash = false;
      return;
    }
    clearDirty();
    state.lastHash = location.hash;
    state.error = '';
    state.notice = '';
    draw();
  });

  refreshSession().then(async () => {
    if (state.authed) {
      try { await loadContent(); } catch (error) { state.error = error.message; }
      if (!route().parts[0] || route().parts[0] === 'login') location.hash = '#/dashboard';
    } else if (!location.hash || location.hash === '#/') {
      location.hash = '#/login';
    }
    await draw();
  });
})();
