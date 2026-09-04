(() => {
  'use strict';

  function H() {
    return window.KTAdmin;
  }

  function Sync() {
    return window.KTContentSync;
  }

  function t(key, vars) {
    return H().t(key, vars);
  }

  function adoptProjects(pack) {
    const previous = H().state.projectsData || {};
    const remote = pack || {};
    H().state.projectsData = {
      ...remote,
      categories: remote.categories || previous.categories || [],
      projects: Sync().mergeRemoteList(remote.projects || [], previous.projects || [])
    };
    return H().state.projectsData;
  }

  function adoptGuides(guides) {
    H().state.guidesData = Sync().mergeRemoteList(guides || [], H().state.guidesData || []);
    return H().state.guidesData;
  }

  function guideHeading(markdown) {
    const match = String(markdown || '').match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
  }

  function esc(value) {
    return H().escapeHtml(value);
  }

  function catLabel(item) {
    if (!item) return '';
    const lang = H().uiLang();
    const label = item.label || {};
    return label[lang] || label.en || label.tr || item.id;
  }

  function locRole(role) {
    if (!role) return '';
    if (typeof role === 'string') return role;
    const lang = H().uiLang();
    return role[lang] || role.en || role.tr || '';
  }

  const LINK_LABEL_I18N = {
    Website: { en: 'Website', tr: 'Website' },
    Explorer: { en: 'Explorer', tr: 'Explorer' },
    GitHub: { en: 'GitHub', tr: 'GitHub' },
    Gateway: { en: 'Gateway', tr: 'Gateway' },
    'Setup Guide': { en: 'Setup Guide', tr: 'Kurulum Rehberi' },
    'Open App': { en: 'Open App', tr: 'Uygulamayı Aç' },
    'Read Article': { en: 'Read Article', tr: 'Yazıyı Oku' },
    Link: { en: 'Link', tr: 'Bağlantı' },
    Referral: { en: 'Referral', tr: 'Referans' }
  };

  const ABOUT_ICONS = [
    { value: './assets/images/icons/icon-dev.svg', en: 'Development', tr: 'Geliştirme' },
    { value: './assets/images/icons/icon-app.svg', en: 'Apps / Guides', tr: 'Uygulama / Rehber' },
    { value: './assets/images/icons/icon-photo.svg', en: 'Research', tr: 'Araştırma' },
    { value: './assets/images/icons/icon-design.svg', en: 'Design / Content', tr: 'Tasarım / İçerik' },
    { value: 'code-slash-outline', en: 'Code', tr: 'Kod' },
    { value: 'terminal-outline', en: 'Terminal', tr: 'Terminal' },
    { value: 'server-outline', en: 'Server / Node', tr: 'Sunucu / Node' },
    { value: 'search-outline', en: 'Research', tr: 'Araştırma' },
    { value: 'stats-chart-outline', en: 'Analytics', tr: 'Analitik' },
    { value: 'document-text-outline', en: 'Document', tr: 'Belge' },
    { value: 'git-network-outline', en: 'Network', tr: 'Ağ' },
    { value: 'cube-outline', en: 'Blockchain', tr: 'Blockchain' },
    { value: 'file-tray-full-outline', en: 'Database', tr: 'Veritabanı' },
    { value: 'construct-outline', en: 'Tools', tr: 'Araçlar' },
    { value: 'globe-outline', en: 'Globe', tr: 'Küre' },
    { value: 'logo-github', en: 'GitHub', tr: 'GitHub' }
  ];

  function linkLabelParts(label) {
    if (label && typeof label === 'object') {
      return { en: label.en || '', tr: label.tr || label.en || '' };
    }
    const text = String(label || '').trim();
    if (LINK_LABEL_I18N[text]) return { ...LINK_LABEL_I18N[text] };
    const match = Object.values(LINK_LABEL_I18N).find((pair) => pair.en === text || pair.tr === text);
    if (match) return { ...match };
    return { en: text, tr: text };
  }

  function extractServices(markdown) {
    const items = [];
    const chunks = String(markdown || '').split(/^##\s+.+$/m);
    if (chunks.length < 2) return items;
    const body = chunks.slice(1).join('\n');
    body.split(/^###\s+/m).slice(1).forEach((block) => {
      const lines = block.split('\n');
      const title = (lines[0] || '').trim();
      let icon = '';
      lines.slice(1).some((line) => {
        const match = line.match(/^icon:\s*(.+)$/i);
        if (!match) return false;
        icon = match[1].trim().replace(/^["']|["']$/g, '');
        return true;
      });
      if (title) items.push({ title, icon });
    });
    return items;
  }

  function applyServiceIcons(markdown, icons) {
    const idx = String(markdown || '').search(/^##\s+/m);
    if (idx < 0) return markdown;
    const head = markdown.slice(0, idx);
    let i = 0;
    const rest = markdown.slice(idx).replace(/(^###[^\n]+\n)(?:icon:\s*.+\n)?/gm, (full, heading) => {
      const icon = icons[i++];
      if (!icon) return full;
      return `${heading}icon: ${icon}\n`;
    });
    return head + rest;
  }

  function aboutIconMarkup(value) {
    const icon = String(value || '').trim();
    if (!icon) return '';
    if (/\.svg(\?|$)/i.test(icon) || icon.includes('/icons/') || icon.startsWith('./')) {
      return `<img src="${esc(H().publicAssetUrl(icon))}" alt="">`;
    }
    if (/^[a-z0-9-]+$/i.test(icon)) return `<ion-icon name="${esc(icon)}"></ion-icon>`;
    return '';
  }

  function aboutIconOptions(current) {
    const lang = H().uiLang();
    const values = ABOUT_ICONS.map((item) => item.value);
    const extra = current && !values.includes(current)
      ? `<option value="${esc(current)}" selected>${esc(current)}</option>`
      : '';
    return extra + ABOUT_ICONS.map((item) => {
      const label = lang === 'tr' ? item.tr : item.en;
      return `<option value="${esc(item.value)}" ${item.value === current ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
  }

  function renderAboutIconPicker(markdown) {
    const items = extractServices(markdown);
    if (!items.length) return '';
    return `
      <div class="auto-card about-icon-card">
        <h3 class="section-label">${esc(t('cms.whatIDo'))}</h3>
        <p class="hint">${esc(H().uiLang() === 'tr'
          ? 'İkon her iki dilde aynı öğeyi paylaşır. EN/TR metin ayrı kalır.'
          : 'Icon is shared across EN/TR for the same item. Text stays per language.')}</p>
        <div class="about-icon-list">
          ${items.map((item, index) => `
            <div class="about-icon-row">
              <span class="about-icon-preview">${aboutIconMarkup(item.icon)}</span>
              <div>
                <label>${esc(t('cms.icon'))} — ${esc(item.title)}</label>
                <select data-about-icon="${index}">${aboutIconOptions(item.icon)}</select>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  async function saveOk(message) {
    H().showNotice(message);
    H().clearDirty();
  }

  async function saveFail(error) {
    if (error && error.code === 'PUBLISH_NOT_CONNECTED') {
      H().showError(error.message);
      return;
    }
    H().showError(`${t('cms.failed')} ${error.message || ''}`.trim());
  }

  function mdToolbar(extra) {
    return `${H().toolbar()}${extra || ''}`;
  }

  function mdBtn(cmd, label, visible) {
    const text = visible == null ? label : visible;
    return `<button type="button" data-md="${esc(cmd)}" title="${esc(label)}" aria-label="${esc(label)}">${esc(text)}</button>`;
  }

  function guideToolbar() {
    return `<div class="toolbar" role="toolbar">
      ${H().headingButtons(mdBtn)}
      ${mdBtn('bold', t('md.bold'), t('md.boldShort'))}
      ${mdBtn('italic', t('md.italic'), t('md.italicShort'))}
      ${mdBtn('link', t('md.link'))}
      ${mdBtn('ul', t('md.bullet'), t('md.bulletShort'))}
      ${mdBtn('ol', t('md.numbered'), t('md.numberedShort'))}
      ${mdBtn('quote', t('md.quote'))}
      ${mdBtn('hr', t('md.hr'))}
      ${mdBtn('code', t('md.code'))}
      ${mdBtn('codeblock', t('md.codeBlock'))}
      <button type="button" data-guide-image title="${esc(t('md.addImage'))}" aria-label="${esc(t('md.addImage'))}">${esc(t('md.addImage'))}</button>
    </div>`;
  }

  function renderPageEditor(family, titleKey) {
    const draft = H().state.pageDraft;
    const lang = draft.lang;
    const md = draft.langs[lang] || '';
    H().state.appRender = 'page';
    document.getElementById('app').innerHTML = H().layout(t(titleKey), `
      <div class="tabs" role="tablist">
        <button type="button" class="tab ${lang === 'en' ? 'is-active' : ''}" data-page-lang="en">${esc(t('tabs.contentEn'))}</button>
        <button type="button" class="tab ${lang === 'tr' ? 'is-active' : ''}" data-page-lang="tr">${esc(t('tabs.contentTr'))}</button>
      </div>
      <div class="editor-layout">
        <form data-page-editor>
          <div class="field">
            ${mdToolbar()}
            <textarea id="page-md" data-page-md>${esc(md)}</textarea>
          </div>
        </form>
        <aside>
          <div class="auto-card guide-preview-card">
            <h3>${esc(t('cms.preview'))}</h3>
            <div class="guide-body admin-md-preview">${window.KolTiginGuideMarkdown ? window.KolTiginGuideMarkdown.render(md, { copyLabel: t('cms.preview') }) : esc(md)}</div>
          </div>
        </aside>
      </div>
      </div>
      ${family === 'about' ? renderAboutIconPicker(md) : ''}
      <div class="footer-actions">
        <button class="btn btn-gold" type="button" data-save-page>${esc(family === 'about' ? H().saveActionLabel('cms.saveAbout') : H().saveActionLabel('writings.save'))}</button>
      </div>
    `);
  }

  async function openPage(family) {
    const en = await H().api(`/admin/api/page?family=${family}&lang=en`);
    const tr = await H().api(`/admin/api/page?family=${family}&lang=tr`);
    H().state.pageDraft = { family, lang: 'en', langs: { en: en.markdown || '', tr: tr.markdown || '' } };
    H().clearDirty();
    renderPageEditor(family, family === 'about' ? 'nav.about' : 'nav.resume');
  }

  async function savePage() {
    const draft = H().state.pageDraft;
    const textarea = document.querySelector('[data-page-md]');
    if (textarea) draft.langs[draft.lang] = textarea.value;
    if (draft.family === 'about') {
      const icons = [...document.querySelectorAll('[data-about-icon]')].map((el) => el.value);
      if (icons.length) {
        draft.langs.en = applyServiceIcons(draft.langs.en, icons);
        draft.langs.tr = applyServiceIcons(draft.langs.tr, icons);
      }
    }
    H().clearStatus();
    try {
      const langs = draft.family === 'about' ? ['en', 'tr'] : [draft.lang];
      for (const lang of langs) {
        await H().api('/admin/api/page', {
          method: 'POST',
          body: JSON.stringify({ family: draft.family, lang, markdown: draft.langs[lang] })
        });
      }
      await saveOk();
    } catch (error) {
      await saveFail(error);
    }
    renderPageEditor(draft.family, draft.family === 'about' ? 'nav.about' : 'nav.resume');
  }

  function renderProjectsList() {
    const data = H().state.projectsData || { categories: [], projects: [] };
    const filter = H().state.projectFilter || 'all';
    const q = (H().state.projectQuery || '').toLowerCase();
    const cats = data.categories || [];
    let items = data.projects || [];
    if (filter !== 'all') items = items.filter((item) => item.category === filter);
    if (q) items = items.filter((item) => String(item.name || '').toLowerCase().includes(q) || String(item.id || '').includes(q));
    const catMap = Object.fromEntries(cats.map((item) => [item.id, item]));
    const rows = items.map((item) => `
      <article class="item writing-row">
        ${item.logo ? `<img class="list-thumb" src="${esc(H().publicAssetUrl(item.logo))}" alt="">` : `<div class="list-thumb list-thumb-fallback"></div>`}
        <div class="item-body">
          <h3>${esc(item.name)}</h3>
          <div class="meta">
            <span class="pill gold">${esc(catLabel(catMap[item.category]))}</span>
            <span class="pill">${esc(item.status || '')}</span>
            ${locRole(item.role) ? `<span class="pill">${esc(locRole(item.role))}</span>` : ''}
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost" data-go="#/edit/projects/${esc(item.id)}">${esc(t('writings.editBtn'))}</button>
            <a class="btn btn-ghost" href="/#projects" target="_blank" rel="noopener">${esc(t('writings.preview'))}</a>
            ${H().entityDeleteButton({ family: 'project', id: item.id, title: item.name || item.id })}
          </div>
        </div>
      </article>
    `).join('') || `<p class="empty">${esc(t('writings.empty'))}</p>`;
    document.getElementById('app').innerHTML = H().layout(t('nav.projects'), `
      <div class="row-actions">
        <button class="btn btn-gold" data-go="#/new/projects">${esc(t('cms.newProject'))}</button>
        <button class="btn btn-ghost" data-go="#/project-categories">${esc(t('cms.manageProjectCats'))}</button>
      </div>
      <div class="field">
        <label for="project-search">${esc(t('cms.searchProjects'))}</label>
        <input id="project-search" data-project-search type="search" value="${esc(H().state.projectQuery || '')}">
      </div>
      <div class="filters">
        <button type="button" class="tab ${filter === 'all' ? 'is-active' : ''}" data-project-filter="all">${esc(t('writings.filterAll'))}</button>
        ${cats.map((cat) => `<button type="button" class="tab ${filter === cat.id ? 'is-active' : ''}" data-project-filter="${esc(cat.id)}">${esc(catLabel(cat))}</button>`).join('')}
      </div>
      <div class="list">${rows}</div>
    `);
  }

  async function openProjects() {
    adoptProjects(await H().api('/admin/api/projects'));
    renderProjectsList();
  }

  function emptyProject() {
    return {
      id: '',
      slug: '',
      name: '',
      category: '',
      fromCategory: '',
      status: 'active',
      roleEn: '',
      roleTr: '',
      former_name: '',
      logo: '',
      summaryEn: '',
      summaryTr: '',
      referral_url: '',
      referral_code: '',
      links: [],
      guideId: ''
    };
  }

  function collectProjectForm() {
    const p = H().state.projectDraft;
    const app = document.getElementById('app');
    app.querySelectorAll('[data-pfield]').forEach((field) => { p[field.dataset.pfield] = field.value; });
    p.links = [];
    app.querySelectorAll('[data-plink]').forEach((row) => {
      p.links.push({
        label: { en: row.querySelector('[data-plabel-en]').value, tr: row.querySelector('[data-plabel-tr]').value },
        url: row.querySelector('[data-purl]').value,
        guide: row.querySelector('[data-pguide]') ? row.querySelector('[data-pguide]').value : ''
      });
    });
  }

  function renderProjectEditor() {
    const p = H().state.projectDraft;
    const cats = (H().state.projectsData && H().state.projectsData.categories) || [];
    const guides = H().state.guidesData || [];
    const heading = p.id && p.fromCategory ? t('writings.edit') : t('cms.newProject');
    const links = (p.links || []).map((link, index) => {
      const labels = linkLabelParts(link.label);
      return `
        <article class="social-row" data-plink>
          <div class="field"><label>${esc(t('cms.labelEn'))}</label><input data-plabel-en type="text" value="${esc(labels.en)}"></div>
          <div class="field"><label>${esc(t('cms.labelTr'))}</label><input data-plabel-tr type="text" value="${esc(labels.tr)}"></div>
          <div class="field"><label>URL</label><input data-purl type="url" value="${esc(link.url || '')}"></div>
          <input data-pguide type="hidden" value="${esc(link.guide || '')}">
          <div class="item-actions">
            <button class="btn btn-ghost" type="button" data-plink-up="${index}">${esc(t('social.up'))}</button>
            <button class="btn btn-ghost" type="button" data-plink-down="${index}">${esc(t('social.down'))}</button>
            <button class="btn btn-ghost" type="button" data-plink-remove="${index}">${esc(t('social.remove'))}</button>
          </div>
        </article>`;
    }).join('');
    const preview = `
      <div class="auto-card">
        ${p.logo ? `<img class="list-thumb" src="${esc(H().publicAssetUrl(p.logo))}" alt="">` : ''}
        <h3>${esc(p.name || t('cms.name'))}</h3>
        <p>${esc(locRole({ en: p.roleEn, tr: p.roleTr }))}</p>
        <p class="hint">${esc(p.status)}</p>
        <p>${esc(H().uiLang() === 'tr' ? p.summaryTr : p.summaryEn)}</p>
        <p class="hint">${(p.links || []).map((link) => linkLabelParts(link.label).en).join(' · ')}</p>
        ${p.referral_code ? `<p>${esc(p.referral_code)}</p>` : ''}
        ${p.guideId ? `<p class="pill gold">${esc(p.guideId)}</p>` : ''}
      </div>`;
    document.getElementById('app').innerHTML = H().layout(heading, `
      <form data-project-editor>
        <div class="field"><label>${esc(t('cms.name'))}</label><input data-pfield="name" type="text" required value="${esc(p.name)}"></div>
        <div class="field"><label>${esc(t('cms.category'))}</label>
          <select data-pfield="category">${cats.map((cat) => `<option value="${esc(cat.id)}" ${cat.id === p.category ? 'selected' : ''}>${esc(catLabel(cat))}</option>`).join('')}</select>
        </div>
        <div class="field"><label>${esc(t('cms.status'))}</label>
          <select data-pfield="status">
            ${['active', 'completed', 'built'].map((st) => `<option value="${st}" ${p.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>${esc(t('cms.role'))} EN</label><input data-pfield="roleEn" type="text" value="${esc(p.roleEn)}"></div>
        <div class="field"><label>${esc(t('cms.role'))} TR</label><input data-pfield="roleTr" type="text" value="${esc(p.roleTr)}"></div>
        <div class="field"><label>${esc(t('cms.formerName'))}</label><input data-pfield="former_name" type="text" value="${esc(p.former_name)}"></div>
        <div class="field">
          <label>${esc(t('cms.logo'))}</label>
          ${p.logo ? `<div class="logo-preview"><img src="${esc(H().publicAssetUrl(p.logo))}" alt=""></div>` : ''}
          <input id="project-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" hidden>
          <button class="btn btn-ghost" type="button" data-project-logo>${esc(p.logo ? t('cms.changeImage') : t('writings.chooseImage'))}</button>
        </div>
        <div class="field"><label>${esc(t('cms.summaryEn'))}</label><textarea data-pfield="summaryEn">${esc(p.summaryEn)}</textarea></div>
        <div class="field"><label>${esc(t('cms.summaryTr'))}</label><textarea data-pfield="summaryTr">${esc(p.summaryTr)}</textarea></div>
        <h3 class="section-label">${esc(t('nav.guides'))}</h3>
        <div class="field">
          <label>${esc(t('cms.relatedProject'))}</label>
          <select data-pfield="guideId">
            <option value="">${esc(t('cms.none'))}</option>
            ${guides.map((g) => `<option value="${esc(g.id)}" ${p.guideId === g.id ? 'selected' : ''}>${esc(g.titleEn || g.id)}</option>`).join('')}
          </select>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost" type="button" data-go="#/new/guides">${esc(t('cms.newGuide'))}</button>
          ${p.guideId ? `<button class="btn btn-ghost" type="button" data-go="#/edit/guides/${esc(p.guideId)}">${esc(t('writings.editBtn'))}</button>` : ''}
        </div>
        <h3 class="section-label">Links</h3>
        ${links}
        <button class="btn btn-ghost" type="button" data-add-plink>${esc(t('cms.addLink'))}</button>
        <div class="field"><label>${esc(t('cms.referralUrl'))}</label><input data-pfield="referral_url" type="url" value="${esc(p.referral_url)}"></div>
        <div class="field"><label>${esc(t('cms.referralCode'))}</label><input data-pfield="referral_code" type="text" value="${esc(p.referral_code)}"></div>
      </form>
      <aside style="margin-top:16px">${preview}</aside>
      <div class="footer-actions">
        <button class="btn btn-gold" type="button" data-save-project>${esc(H().saveActionLabel('cms.saveProject'))}</button>
      </div>
    `);
  }

  async function openProject(id) {
    const pack = adoptProjects(await H().api('/admin/api/projects'));
    const gpack = await H().api('/admin/api/guides');
    adoptGuides(gpack.guides || []);
    if (!id) {
      H().state.projectDraft = emptyProject();
      H().state.projectDraft.category = (pack.categories[0] || {}).id || '';
      renderProjectEditor();
      return;
    }
    const rec = (pack.projects || []).find((item) => item.id === id);
    if (!rec) throw new Error('Project not found');
    const role = rec.role && typeof rec.role === 'object' ? rec.role : { en: rec.role || '', tr: rec.role || '' };
    const summary = rec.summary || {};
    const guideId = (rec.links || []).map((link) => link.guide).find(Boolean) || '';
    H().state.projectDraft = {
      id: rec.id,
      slug: rec.slug,
      name: rec.name,
      category: rec.category,
      fromCategory: rec.category,
      status: rec.status,
      roleEn: role.en || '',
      roleTr: role.tr || '',
      former_name: rec.former_name || '',
      logo: rec.logo || '',
      summaryEn: summary.en || '',
      summaryTr: summary.tr || '',
      referral_url: rec.referral_url || '',
      referral_code: rec.referral_code || '',
      links: rec.links || [],
      guideId
    };
    H().clearDirty();
    renderProjectEditor();
  }

  async function saveProject() {
    collectProjectForm();
    const p = H().state.projectDraft;
    H().clearStatus();
    try {
      const links = (p.links || []).filter((link) => (link.url || '').trim());
      if (p.guideId) {
        const without = links.filter((link) => !link.guide);
        without.push({ label: { en: 'Setup Guide', tr: 'Kurulum Rehberi' }, url: `#/guides/${p.guideId}`, guide: p.guideId });
        p.links = without;
      } else {
        p.links = links.filter((link) => !link.guide);
      }
      const result = await H().api('/admin/api/project-save', {
        method: 'POST',
        body: JSON.stringify({
          id: p.id,
          slug: p.slug || p.id,
          name: p.name,
          category: p.category,
          fromCategory: p.fromCategory || p.category,
          status: p.status,
          role: { en: p.roleEn, tr: p.roleTr },
          former_name: p.former_name,
          logo: p.logo,
          summary: { en: p.summaryEn, tr: p.summaryTr },
          links: p.links,
          referral_url: p.referral_url,
          referral_code: p.referral_code
        })
      });
      p.id = result.id || p.id;
      p.fromCategory = p.category;
      const data = H().state.projectsData || { projects: [], categories: [] };
      data.projects = Sync().upsertById(data.projects || [], {
        id: p.id,
        slug: p.slug || p.id,
        name: p.name,
        category: p.category,
        status: p.status,
        role: { en: p.roleEn, tr: p.roleTr },
        former_name: p.former_name,
        logo: p.logo,
        summary: { en: p.summaryEn, tr: p.summaryTr },
        links: p.links,
        referral_url: p.referral_url,
        referral_code: p.referral_code
      });
      H().state.projectsData = data;
      await saveOk();
      history.replaceState(null, '', `${location.pathname}${location.search}#/edit/projects/${encodeURIComponent(p.id)}`);
    } catch (error) {
      await saveFail(error);
    }
    renderProjectEditor();
  }

  function renderProjectCategories() {
    const cats = (H().state.projectsData && H().state.projectsData.categories) || [];
    const projects = (H().state.projectsData && H().state.projectsData.projects) || [];
    const dialog = H().state.catDialog;
    const rows = cats.map((item, index) => {
      const count = projects.filter((p) => p.category === item.id).length;
      const protectedCat = Boolean(item.protected);
      return `
        <article class="item category-card">
          <h3>${esc(catLabel(item))}</h3>
          <div class="meta">
            <span class="pill gold">${esc(item.id)}</span>
            <span class="pill">${esc(t('types.count', { n: count }).replace('writings', 'projects'))}</span>
            ${item.accordion ? `<span class="pill">accordion</span>` : ''}
          </div>
          <div class="item-actions">
            <button class="btn btn-ghost" type="button" data-pcat-up="${index}">${esc(t('social.up'))}</button>
            <button class="btn btn-ghost" type="button" data-pcat-down="${index}">${esc(t('social.down'))}</button>
            <button class="btn btn-ghost" type="button" data-pcat-edit="${esc(item.id)}">${esc(t('types.editLabels'))}</button>
            ${protectedCat
              ? `<button class="btn btn-ghost" type="button" disabled title="${esc(t('cms.coreNoDelete'))}">${esc(t('types.delete'))}</button>`
              : `<button class="btn btn-ghost" type="button" data-pcat-delete="${esc(item.id)}">${esc(t('types.delete'))}</button>`}
          </div>
          ${dialog && dialog.id === item.id && dialog.mode === 'edit' ? `
            <div class="dialog-card">
              <div class="field"><label>${esc(t('types.nameEn'))}</label><input data-pcat-en type="text" value="${esc(dialog.labelEn)}"></div>
              <div class="field"><label>${esc(t('types.nameTr'))}</label><input data-pcat-tr type="text" value="${esc(dialog.labelTr)}"></div>
              <div class="item-actions">
                <button class="btn btn-ghost" type="button" data-pcat-cancel>${esc(t('types.cancel'))}</button>
                <button class="btn btn-gold" type="button" data-pcat-save>${esc(t('types.saveChanges'))}</button>
              </div>
            </div>` : ''}
          ${dialog && dialog.id === item.id && dialog.mode === 'delete-move' ? `
            <div class="dialog-card">
              <p>${esc(t('cms.containsProjects', { n: dialog.count }))}</p>
              <select data-pcat-move>
                ${cats.filter((c) => c.id !== item.id).map((c) => `<option value="${esc(c.id)}">${esc(catLabel(c))}</option>`).join('')}
              </select>
              <div class="item-actions">
                <button class="btn btn-ghost" type="button" data-pcat-cancel>${esc(t('types.cancel'))}</button>
                <button class="btn btn-gold" type="button" data-pcat-move-del>${esc(t('types.moveDelete'))}</button>
              </div>
            </div>` : ''}
        </article>`;
    }).join('');
    document.getElementById('app').innerHTML = H().layout(t('cms.manageProjectCats'), `
      <form data-new-pcat class="type-form">
        <h3 class="section-label">${esc(t('types.new'))}</h3>
        <div class="field"><label>${esc(t('types.nameEn'))}</label><input data-npcat-en type="text" required></div>
        <div class="field"><label>${esc(t('types.nameTr'))}</label><input data-npcat-tr type="text" required></div>
        <button class="btn btn-gold" type="button" data-pcat-create>${esc(t('types.create'))}</button>
      </form>
      <div class="list">${rows}</div>
    `);
  }

  function renderGuidesList() {
    const q = (H().state.guideQuery || '').toLowerCase();
    let items = H().state.guidesData || [];
    if (q) items = items.filter((item) => `${item.titleEn} ${item.titleTr} ${item.id}`.toLowerCase().includes(q));
    const rows = items.map((item) => `
      <article class="item">
        <h3>${esc(Sync().guideListTitle(item, H().uiLang()))}</h3>
        <div class="meta">
          <span class="pill gold">${esc(item.id)}</span>
          <span class="pill">EN ${item.existsEn ? '✓' : t('writings.missing')}</span>
          <span class="pill">TR ${item.existsTr ? '✓' : t('writings.missing')}</span>
          ${(item.projects || []).map((p) => `<span class="pill">${esc(p.name)}</span>`).join('')}
        </div>
        <div class="item-actions">
          <button class="btn btn-ghost" data-go="#/edit/guides/${esc(item.id)}">${esc(t('writings.editBtn'))}</button>
          <a class="btn btn-ghost" href="/#/guides/${esc(item.id)}" target="_blank" rel="noopener">${esc(t('writings.preview'))}</a>
          ${H().entityDeleteButton({ family: 'guide', id: item.id, title: Sync().guideListTitle(item, H().uiLang()) })}
        </div>
      </article>
    `).join('') || `<p class="empty">${esc(t('writings.empty'))}</p>`;
    document.getElementById('app').innerHTML = H().layout(t('nav.guides'), `
      <div class="row-actions">
        <button class="btn btn-gold" data-go="#/new/guides">${esc(t('cms.newGuide'))}</button>
      </div>
      <div class="field">
        <label>${esc(t('cms.searchGuides'))}</label>
        <input data-guide-search type="search" value="${esc(H().state.guideQuery || '')}">
      </div>
      <div class="list">${rows}</div>
    `);
  }

  function renderGuideEditor() {
    const g = H().state.guideDraft;
    const lang = g.lang;
    const md = g.langs[lang] || '';
    const projects = (H().state.projectsData && H().state.projectsData.projects) || [];
    const preview = window.KolTiginGuideMarkdown
      ? window.KolTiginGuideMarkdown.render(md, { guideId: g.id, copyLabel: t('guides.copy') === t('guides.copy') ? (H().uiLang() === 'tr' ? 'Kopyala' : 'Copy') : t('cms.preview') })
      : '';
    document.getElementById('app').innerHTML = H().layout(g.id ? t('writings.edit') : t('cms.newGuide'), `
      <div class="tabs">
        <button type="button" class="tab ${lang === 'en' ? 'is-active' : ''}" data-guide-lang="en">${esc(t('tabs.contentEn'))}</button>
        <button type="button" class="tab ${lang === 'tr' ? 'is-active' : ''}" data-guide-lang="tr">${esc(t('tabs.contentTr'))}</button>
      </div>
      <div class="field"><label>${esc(t('cms.relatedProject'))}</label>
        <select data-gfield="projectId">
          <option value="">${esc(t('cms.none'))}</option>
          ${projects.map((p) => `<option value="${esc(p.id)}" ${g.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div class="editor-layout">
        <form>
          <div class="field">
            ${guideToolbar()}
            <textarea data-guide-md>${esc(md)}</textarea>
            <input id="guide-image" type="file" accept="image/png,image/jpeg,image/webp" hidden>
          </div>
        </form>
        <aside>
          <div class="guide-body admin-md-preview">${preview}</div>
        </aside>
      </div>
      <div class="footer-actions">
        <button class="btn btn-gold" type="button" data-save-guide>${esc(H().saveActionLabel('cms.saveGuide'))}</button>
      </div>
    `);
  }

  async function openGuide(id) {
    const pack = await H().api('/admin/api/guides');
    adoptGuides(pack.guides || []);
    const prevProjects = H().state.projectsData || {};
    H().state.projectsData = {
      categories: prevProjects.categories || [],
      projects: Sync().mergeRemoteList(pack.projects || [], prevProjects.projects || [])
    };
    if (!id) {
      H().state.guideDraft = { id: '', lang: 'en', langs: { en: '# \n\n', tr: '# \n\n' }, projectId: '' };
      renderGuideEditor();
      return;
    }
    const data = await H().api(`/admin/api/guide?id=${encodeURIComponent(id)}`);
    if (!data.exists) {
      H().state.guideDraft = null;
      H().showError(t('cms.guideNotFound'));
      H().state.keepNoticeOnHash = true;
      history.replaceState(null, '', `${location.pathname}${location.search}#/guides`);
      H().state.lastHash = location.hash;
      renderGuidesList();
      return;
    }
    const related = ((data.meta && data.meta.projects) || [])[0];
    H().state.guideDraft = {
      id,
      locked: true,
      lang: data.en ? 'en' : 'tr',
      langs: { en: data.en || '', tr: data.tr || '' },
      projectId: related ? related.id : ''
    };
    H().clearDirty();
    renderGuideEditor();
  }

  async function saveGuide() {
    const g = H().state.guideDraft;
    const ta = document.querySelector('[data-guide-md]');
    const sel = document.querySelector('[data-gfield="projectId"]');
    if (ta) g.langs[g.lang] = ta.value;
    if (sel) g.projectId = sel.value;
    if (!g.id) {
      const title = (g.langs.en.match(/^#\s+(.+)$/m) || g.langs.tr.match(/^#\s+(.+)$/m) || [])[1] || '';
      g.id = H().slugify(title);
    }
    H().clearStatus();
    try {
      const result = await H().api('/admin/api/guide-save', {
        method: 'POST',
        body: JSON.stringify({
          id: g.id,
          lang: g.lang,
          markdown: g.langs[g.lang],
          projectId: g.projectId
        })
      });
      g.id = result.id || g.id;
      g.locked = true;
      const prev = (H().state.guidesData || []).find((item) => item.id === g.id) || {};
      H().state.guidesData = Sync().upsertById(H().state.guidesData || [], {
        id: g.id,
        titleEn: guideHeading(g.langs.en) || prev.titleEn || g.id,
        titleTr: guideHeading(g.langs.tr) || prev.titleTr || g.id,
        existsEn: Boolean(String(g.langs.en || '').trim()) || Boolean(prev.existsEn),
        existsTr: Boolean(String(g.langs.tr || '').trim()) || Boolean(prev.existsTr),
        projects: prev.projects || []
      });
      await saveOk();
      history.replaceState(null, '', `${location.pathname}${location.search}#/edit/guides/${encodeURIComponent(g.id)}`);
    } catch (error) {
      await saveFail(error);
    }
    renderGuideEditor();
  }

  function renderContact() {
    const data = H().state.contactData;
    const site = data.site || {};
    const loc = site.location || {};
    const contact = site.contact || {};
    const i18n = data.i18n || { en: {}, tr: {} };
    const lang = H().state.contactLang || 'en';
    const fields = i18n[lang] || {};
    const query = [loc.city, loc.country].filter(Boolean).join(', ');
    const map = contact.mapEmbedUrl || '';
    document.getElementById('app').innerHTML = H().layout(t('nav.contact'), `
      <form data-contact>
        <div class="field"><label>${esc(t('contact.city'))}</label><input data-cloc="city" type="text" value="${esc(loc.city || '')}"></div>
        <div class="field"><label>${esc(t('contact.country'))}</label><input data-cloc="country" type="text" value="${esc(loc.country || '')}"></div>
        ${map ? `<iframe class="admin-map" src="${esc(map)}" title="${esc(query)}"></iframe>` : ''}
        <label class="hint"><input data-cfield="formEnabled" type="checkbox" ${contact.formEnabled === false ? '' : 'checked'}> ${esc(t('cms.formEnabled'))}</label>
        <div class="tabs">
          <button type="button" class="tab ${lang === 'en' ? 'is-active' : ''}" data-contact-lang="en">${esc(t('tabs.contentEn'))}</button>
          <button type="button" class="tab ${lang === 'tr' ? 'is-active' : ''}" data-contact-lang="tr">${esc(t('tabs.contentTr'))}</button>
        </div>
        ${['formTitle', 'labelName', 'labelEmail', 'labelMessage', 'submit', 'success', 'error'].map((key) => `
          <div class="field"><label>${esc(key)}</label><input data-ci18n="${key}" type="text" value="${esc(fields[key] || '')}"></div>
        `).join('')}
        <details class="advanced">
          <summary>${esc(t('cms.advanced'))}</summary>
          <div class="field">
            <label>${esc(t('cms.endpoint'))}</label>
            <input data-cfield="endpoint" type="url" value="${esc(contact.endpoint || '')}">
            <span class="hint">${esc(t('cms.endpointHint'))}</span>
          </div>
        </details>
      </form>
      <div class="footer-actions">
        <a class="btn btn-ghost" href="/#contact" target="_blank" rel="noopener">${esc(t('cms.previewContact'))}</a>
        <button class="btn btn-gold" type="button" data-save-contact>${esc(H().saveActionLabel('writings.save'))}</button>
      </div>
    `);
  }

  async function openContact() {
    H().state.contactData = await H().api('/admin/api/contact');
    H().state.contactLang = 'en';
    H().clearDirty();
    renderContact();
  }

  async function saveContact() {
    const app = document.getElementById('app');
    const loc = {
      city: (app.querySelector('[data-cloc="city"]') || {}).value || '',
      country: (app.querySelector('[data-cloc="country"]') || {}).value || ''
    };
    const formEnabled = Boolean(app.querySelector('[data-cfield="formEnabled"]')?.checked);
    const endpoint = (app.querySelector('[data-cfield="endpoint"]') || {}).value || '';
    const lang = H().state.contactLang || 'en';
    const i18nFields = {};
    app.querySelectorAll(' [data-ci18n]'.trim() ? app.querySelectorAll('[data-ci18n]') : []).forEach((field) => {
      i18nFields[field.dataset.ci18n] = field.value;
    });
    const i18n = H().state.contactData.i18n || { en: {}, tr: {} };
    i18n[lang] = { ...i18n[lang], ...i18nFields };
    H().clearStatus();
    try {
      const result = await H().api('/admin/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          location: loc,
          contact: { formEnabled, endpoint },
          i18n
        })
      });
      H().state.contactData.site = result.site;
      H().state.contactData.i18n = i18n;
      await saveOk();
    } catch (error) {
      await saveFail(error);
    }
    renderContact();
  }

  function bindCms() {
    const app = document.getElementById('app');
    app.addEventListener('click', async (event) => {
      const pageLang = event.target.closest('[data-page-lang]');
      if (pageLang && H().state.pageDraft) {
        H().clearStatus();
        const ta = app.querySelector('[data-page-md]');
        if (ta) H().state.pageDraft.langs[H().state.pageDraft.lang] = ta.value;
        H().state.pageDraft.lang = pageLang.dataset.pageLang;
        renderPageEditor(H().state.pageDraft.family, H().state.pageDraft.family === 'about' ? 'nav.about' : 'nav.resume');
        return;
      }
      if (event.target.closest('[data-save-page]')) { event.preventDefault(); await savePage(); return; }
      const pf = event.target.closest('[data-project-filter]');
      if (pf) { H().state.projectFilter = pf.dataset.projectFilter; renderProjectsList(); return; }
      if (event.target.closest('[data-save-project]')) { event.preventDefault(); await saveProject(); return; }
      if (event.target.closest('[data-add-plink]')) {
        event.preventDefault();
        collectProjectForm();
        H().state.projectDraft.links.push({ label: { en: '', tr: '' }, url: '' });
        renderProjectEditor();
        return;
      }
      const up = event.target.closest('[data-plink-up]');
      if (up) {
        collectProjectForm();
        const i = Number(up.dataset.plinkUp);
        const list = H().state.projectDraft.links;
        if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
        renderProjectEditor();
        return;
      }
      const down = event.target.closest('[data-plink-down]');
      if (down) {
        collectProjectForm();
        const i = Number(down.dataset.plinkDown);
        const list = H().state.projectDraft.links;
        if (i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
        renderProjectEditor();
        return;
      }
      const rm = event.target.closest('[data-plink-remove]');
      if (rm) {
        collectProjectForm();
        H().state.projectDraft.links.splice(Number(rm.dataset.plinkRemove), 1);
        renderProjectEditor();
        return;
      }
      if (event.target.closest('[data-project-logo]')) {
        event.preventDefault();
        document.getElementById('project-logo')?.click();
        return;
      }
      if (event.target.closest('[data-pcat-create]')) {
        event.preventDefault();
        H().clearStatus();
        try {
          await H().api('/admin/api/project-categories', {
            method: 'POST',
            body: JSON.stringify({
              action: 'create',
              label: { en: app.querySelector('[data-npcat-en]').value, tr: app.querySelector('[data-npcat-tr]').value }
            })
          });
          H().state.projectsData = adoptProjects(await H().api('/admin/api/projects'));
          await saveOk();
        } catch (error) { await saveFail(error); }
        renderProjectCategories();
        return;
      }
      const pcatEdit = event.target.closest('[data-pcat-edit]');
      if (pcatEdit) {
        const cat = H().state.projectsData.categories.find((c) => c.id === pcatEdit.dataset.pcatEdit);
        H().state.catDialog = { mode: 'edit', id: cat.id, labelEn: cat.label.en, labelTr: cat.label.tr };
        renderProjectCategories();
        return;
      }
      if (event.target.closest('[data-pcat-save]')) {
        H().clearStatus();
        try {
          await H().api('/admin/api/project-categories', {
            method: 'POST',
            body: JSON.stringify({
              action: 'update',
              id: H().state.catDialog.id,
              label: { en: app.querySelector('[data-pcat-en]').value, tr: app.querySelector('[data-pcat-tr]').value }
            })
          });
          H().state.catDialog = null;
          H().state.projectsData = adoptProjects(await H().api('/admin/api/projects'));
          await saveOk();
        } catch (error) { await saveFail(error); }
        renderProjectCategories();
        return;
      }
      if (event.target.closest('[data-pcat-cancel]')) { H().state.catDialog = null; renderProjectCategories(); return; }
      const pcatDel = event.target.closest('[data-pcat-delete]');
      if (pcatDel) {
        const id = pcatDel.dataset.pcatDelete;
        const count = (H().state.projectsData.projects || []).filter((p) => p.category === id).length;
        if (!count) {
          if (!window.confirm(t('types.confirmEmpty'))) return;
          H().clearStatus();
          try {
            await H().api('/admin/api/project-categories', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
            H().state.projectsData = adoptProjects(await H().api('/admin/api/projects'));
            await saveOk();
          } catch (error) { await saveFail(error); }
          renderProjectCategories();
          return;
        }
        H().state.catDialog = { mode: 'delete-move', id, count };
        renderProjectCategories();
        return;
      }
      if (event.target.closest('[data-pcat-move-del]')) {
        H().clearStatus();
        try {
          await H().api('/admin/api/project-categories', {
            method: 'POST',
            body: JSON.stringify({
              action: 'delete',
              id: H().state.catDialog.id,
              moveTo: app.querySelector('[data-pcat-move]').value
            })
          });
          H().state.catDialog = null;
          H().state.projectsData = adoptProjects(await H().api('/admin/api/projects'));
          await saveOk();
        } catch (error) { await saveFail(error); }
        renderProjectCategories();
        return;
      }
      const upC = event.target.closest('[data-pcat-up]');
      const downC = event.target.closest('[data-pcat-down]');
      if (upC || downC) {
        const cats = [...H().state.projectsData.categories];
        const i = Number((upC || downC).dataset.pcatUp || (upC || downC).dataset.pcatDown);
        const j = upC ? i - 1 : i + 1;
        if (j >= 0 && j < cats.length) {
          [cats[i], cats[j]] = [cats[j], cats[i]];
          try {
            await H().api('/admin/api/project-categories', {
              method: 'POST',
              body: JSON.stringify({ action: 'reorder', ids: cats.map((c) => c.id) })
            });
            H().state.projectsData = adoptProjects(await H().api('/admin/api/projects'));
          } catch (error) { await saveFail(error); }
          renderProjectCategories();
        }
        return;
      }
      const gLang = event.target.closest('[data-guide-lang]');
      if (gLang && H().state.guideDraft && event.target.closest('.tabs')) {
        H().clearStatus();
        const ta = app.querySelector('[data-guide-md]');
        if (ta) H().state.guideDraft.langs[H().state.guideDraft.lang] = ta.value;
        H().state.guideDraft.lang = gLang.dataset.guideLang;
        renderGuideEditor();
        return;
      }
      if (event.target.closest('[data-save-guide]')) { event.preventDefault(); await saveGuide(); return; }
      if (event.target.closest('[data-guide-image]')) {
        event.preventDefault();
        document.getElementById('guide-image')?.click();
        return;
      }
      const mdBtn = event.target.closest('[data-md]');
      if (mdBtn && app.querySelector('[data-guide-md], [data-page-md]')) {
        const textarea = app.querySelector('[data-guide-md], [data-page-md]');
        H().applyMd(mdBtn.dataset.md, textarea);
        H().markDirty();
        return;
      }
      const cLang = event.target.closest('[data-contact-lang]');
      if (cLang) {
        H().clearStatus();
        H().state.contactLang = cLang.dataset.contactLang;
        renderContact();
        return;
      }
      if (event.target.closest('[data-save-contact]')) { event.preventDefault(); await saveContact(); }
    });

    app.addEventListener('input', (event) => {
      if (event.target.matches('[data-project-search]')) {
        H().state.projectQuery = event.target.value;
        renderProjectsList();
      }
      if (event.target.matches('[data-guide-search]')) {
        H().state.guideQuery = event.target.value;
        renderGuidesList();
      }
      if (event.target.matches('[data-page-md]') && H().state.pageDraft) {
        H().state.pageDraft.langs[H().state.pageDraft.lang] = event.target.value;
      }
      if (event.target.matches('[data-guide-md]') && H().state.guideDraft) {
        H().state.guideDraft.langs[H().state.guideDraft.lang] = event.target.value;
      }
    });

    app.addEventListener('change', async (event) => {
      if (event.target.id === 'project-logo' && event.target.files && event.target.files[0]) {
        try {
          const uploaded = await H().uploadImage('/admin/api/project-logo', event.target.files[0]);
          collectProjectForm();
          H().state.projectDraft.logo = uploaded.logo || uploaded.path;
          renderProjectEditor();
        } catch (error) { await saveFail(error); renderProjectEditor(); }
      }
      if (event.target.closest('[data-about-icon]') && H().state.pageDraft) {
        const draft = H().state.pageDraft;
        const ta = document.querySelector('[data-page-md]');
        if (ta) draft.langs[draft.lang] = ta.value;
        const icons = [...document.querySelectorAll('[data-about-icon]')].map((el) => el.value);
        draft.langs.en = applyServiceIcons(draft.langs.en, icons);
        draft.langs.tr = applyServiceIcons(draft.langs.tr, icons);
        renderPageEditor('about', 'nav.about');
        return;
      }
      if (event.target.id === 'guide-image' && event.target.files && event.target.files[0]) {
        const g = H().state.guideDraft;
        if (!g.id) {
          H().showError(t('errors.titleFirst'));
          renderGuideEditor();
          return;
        }
        try {
          const data = await H().uploadImage('/admin/api/guide-image', event.target.files[0], { id: g.id });
          const ta = document.querySelector('[data-guide-md]');
          const alt = window.prompt(t('cms.altText'), '') || '';
          const snippet = `![${alt}](${data.path})\n`;
          if (ta) {
            H().insertSnippet(ta, snippet);
            g.langs[g.lang] = ta.value;
          }
          H().markDirty();
          renderGuideEditor();
        } catch (error) { await saveFail(error); renderGuideEditor(); }
      }
    });
  }

  window.AdminCMS = {
    renderProjectEditor,
    renderGuideEditor,
    renderProjectsList,
    renderGuidesList,
    async handleRoute(page, parts) {
      if (page === 'about') { await openPage('about'); return true; }
      if (page === 'resume') { await openPage('resume'); return true; }
      if (page === 'projects' && parts.length === 1) { await openProjects(); return true; }
      if (page === 'project-categories') {
        H().state.projectsData = adoptProjects(await H().api('/admin/api/projects'));
        renderProjectCategories();
        return true;
      }
      if (page === 'new' && parts[1] === 'projects') { await openProject(); return true; }
      if (page === 'edit' && parts[1] === 'projects' && parts[2]) { await openProject(decodeURIComponent(parts[2])); return true; }
      if (page === 'guides' && parts.length === 1) {
        const pack = await H().api('/admin/api/guides');
        adoptGuides(pack.guides || []);
        renderGuidesList();
        return true;
      }
      if (page === 'new' && parts[1] === 'guides') { await openGuide(); return true; }
      if (page === 'edit' && parts[1] === 'guides' && parts[2]) { await openGuide(decodeURIComponent(parts[2])); return true; }
      if (page === 'contact') { await openContact(); return true; }
      return false;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCms);
  } else {
    bindCms();
  }
})();
