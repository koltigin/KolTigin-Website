'use strict';

class ProjectsParser {
  constructor() {
    this.container = document.querySelector('.project-groups');
    this.nav = document.querySelector('.project-section-nav');
    this.groups = [];
    this.statusLabels = {};
    this.linkLabels = {};
    this.bindReferralCopy();
    this.bindGuideLinks();
    this.bindAccordion();
  }

  t(key, vars, fallback) {
    return window.KolTiginI18n ? window.KolTiginI18n.t(key, vars, fallback) : (fallback || key);
  }

  localized(value) {
    return window.KolTiginI18n ? window.KolTiginI18n.localized(value) : (typeof value === 'string' ? value : '');
  }

  applyLabels() {
    this.groups = [
      { key: 'mainnet', title: this.t('projects.groups.mainnet', null, 'Mainnet') },
      { key: 'activeTestnets', title: this.t('projects.groups.activeTestnets', null, 'Active Testnets') },
      { key: 'depin', title: this.t('projects.groups.depin', null, 'DePIN') },
      { key: 'defi', title: this.t('projects.groups.defi', null, 'DeFi & Ecosystem') },
      { key: 'completedTestnets', title: this.t('projects.groups.completedTestnets', null, 'Completed Testnets') }
    ];
    this.statusLabels = {
      active: this.t('projects.status.active', null, 'Active'),
      completed: this.t('projects.status.completed', null, 'Completed')
    };
    this.linkLabels = {
      website: this.t('projects.links.website', null, 'Website'),
      explorer: this.t('projects.links.explorer', null, 'Explorer'),
      github: this.t('projects.links.github', null, 'GitHub'),
      gateway: this.t('projects.links.gateway', null, 'Gateway'),
      setupGuide: this.t('projects.links.setupGuide', null, 'Setup Guide')
    };
  }

  displayLinkLabel(label) {
    const map = {
      Website: 'projects.links.website',
      Explorer: 'projects.links.explorer',
      GitHub: 'projects.links.github',
      Gateway: 'projects.links.gateway',
      'Setup Guide': 'projects.links.setupGuide'
    };
    const key = map[label];
    return key ? this.t(key, null, label) : label;
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  initials(name) {
    const parts = String(name || '')
      .replace(/[.]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  normalizeItems(groupData) {
    if (Array.isArray(groupData)) return groupData.filter(Boolean);
    if (groupData && Array.isArray(groupData.items)) {
      return groupData.items.filter(Boolean);
    }
    return [];
  }

  safeIonIcon(name) {
    const value = typeof name === 'string' ? name.trim() : '';
    return /^[a-z0-9-]+$/i.test(value) ? value : '';
  }

  normalizeLinks(links) {
    if (!links) return [];

    const fromObject = (link) => {
      if (!link || typeof link !== 'object') return null;
      const url = typeof link.url === 'string' ? link.url.trim() : '';
      if (!url) return null;
      const label = typeof link.label === 'string' && link.label.trim()
        ? link.label.trim()
        : this.t('projects.links.link', null, 'Link');
      const icon = this.safeIonIcon(link.icon);
      const guide = typeof link.guide === 'string' && /^[a-z0-9-]+$/i.test(link.guide.trim())
        ? link.guide.trim()
        : '';
      return { label, url, icon, guide };
    };

    if (Array.isArray(links)) {
      return links.map(fromObject).filter(Boolean);
    }

    return Object.entries(links)
      .filter(([, url]) => typeof url === 'string' && url.trim())
      .map(([key, url]) => ({
        label: this.linkLabels[key] || key,
        url: url.trim(),
        icon: '',
        guide: ''
      }));
  }

  renderLogo(project) {
    const name = this.escapeHtml(project.name);
    const fallback = `<span class="project-card-fallback" aria-hidden="true">${this.escapeHtml(this.initials(project.name))}</span>`;
    const src = typeof project.logo === 'string' ? project.logo.trim() : '';

    if (!src) return fallback;

    return `<img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(this.t('projects.logoAlt', { name: project.name }, '{name} logo'))}" class="project-card-logo-img" loading="lazy" decoding="async" onerror="this.classList.add('is-hidden'); this.nextElementSibling.classList.remove('is-hidden')">
      <span class="project-card-fallback is-hidden" aria-hidden="true">${this.escapeHtml(this.initials(project.name))}</span>`;
  }

  linkIcon(link) {
    const custom = this.safeIonIcon(link && link.icon);
    const fallbacks = {
      Website: 'globe-outline',
      [this.t('projects.links.referral', null, 'Referral')]: 'person-add-outline',
      Referral: 'person-add-outline',
      Explorer: 'link-outline',
      GitHub: 'logo-github',
      Gateway: 'grid-outline',
      Stake: 'layers-outline',
      'Setup Guide': 'document-text-outline'
    };
    const name = custom || fallbacks[link && link.label] || '';
    return name ? `<ion-icon name="${this.escapeHtml(name)}"></ion-icon>` : '';
  }

  renderCard(project, groupKey) {
    const name = this.escapeHtml(project.name);
    const formerName = this.escapeHtml(project.formerName || '');
    const formerHtml = formerName
      ? `<p class="project-card-former">${this.escapeHtml(this.t('projects.formerly', { name: project.formerName }, 'formerly {name}'))}</p>`
      : '';
    const role = this.escapeHtml(project.role || '');
    const statusKey = String(project.status || '').toLowerCase();
    const status = this.statusLabels[statusKey] || this.escapeHtml(project.status || '');
    const summary = this.escapeHtml(this.localized(project.summary));
    const links = this.normalizeLinks(project.links);
    const referralUrl = typeof project.referralUrl === 'string' ? project.referralUrl.trim() : '';
    const referralCode = typeof project.referralCode === 'string' ? project.referralCode.trim() : '';

    if (referralUrl) {
      links.push({ label: this.t('projects.links.referral', null, 'Referral'), url: referralUrl });
    }

    const linksHtml = links.length
      ? `<ul class="project-card-links">${links.map((link) => {
          const isGuide = Boolean(link.guide);
          const href = isGuide
            ? `#/guides/${encodeURIComponent(link.guide)}`
            : this.escapeHtml(link.url);
          const attrs = isGuide
            ? `data-guide="${this.escapeHtml(link.guide)}" data-guide-source="${this.escapeHtml(link.url)}"`
            : 'target="_blank" rel="noopener noreferrer"';
          return `
          <li>
            <a class="project-card-link-btn" href="${href}" ${attrs}>
              ${this.linkIcon(link)}<span class="project-card-link-label">${this.escapeHtml(this.displayLinkLabel(link.label))}</span>
            </a>
          </li>`;
        }).join('')}
        </ul>`
      : '';

    const referralCodeHtml = referralCode
      ? `<p class="project-referral-code">
          <span class="project-referral-label">${this.escapeHtml(this.t('projects.referralCode', null, 'Referral Code:'))}</span>
          <button type="button" class="project-referral-copy" data-referral-code="${this.escapeHtml(referralCode)}" title="${this.escapeHtml(referralCode)}" aria-label="${this.escapeHtml(this.t('projects.copyReferral', { code: referralCode }, 'Copy referral code {code}'))}">
            <span class="project-referral-value">${this.escapeHtml(referralCode)}</span>
            <ion-icon name="copy-outline" aria-hidden="true"></ion-icon>
            <span class="project-referral-copied" hidden aria-live="polite">${this.escapeHtml(this.t('projects.copied', null, 'Copied'))}</span>
          </button>
        </p>`
      : '';

    const actionsInner = `${linksHtml}${referralCodeHtml}`;
    const actionsHtml = actionsInner.trim()
      ? `<div class="project-card-actions">${actionsInner}</div>`
      : '';

    return `
      <article class="project-card">
        <div class="project-card-logo">${this.renderLogo(project)}</div>
        <div class="project-card-body">
          <div class="project-card-heading">
            <div class="project-card-heading-text">
              <h4 class="project-card-name">${name}</h4>
              ${formerHtml}
            </div>
            ${status ? `<span class="project-card-status project-card-status-${this.escapeHtml(statusKey)}">${status}</span>` : ''}
          </div>
          ${role ? `<p class="project-card-role">${role}</p>` : ''}
          ${summary ? `<p class="project-card-summary">${summary}</p>` : ''}
          ${actionsHtml}
        </div>
      </article>
    `;
  }

  bindGuideLinks() {
    if (!this.container || this.container.dataset.guideLinksBound) return;
    this.container.dataset.guideLinksBound = 'true';

    this.container.addEventListener('click', (event) => {
      const link = event.target.closest('[data-guide]');
      if (!link) return;
      event.preventDefault();
      if (window.guidesParser && typeof window.guidesParser.open === 'function') {
        window.guidesParser.open(link.dataset.guide, { sourceUrl: link.dataset.guideSource || '' });
      }
    });
  }

  bindReferralCopy() {
    if (!this.container || this.container.dataset.referralCopyBound) return;
    this.container.dataset.referralCopyBound = 'true';

    this.container.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-referral-code]');
      if (!button) return;

      const code = button.getAttribute('data-referral-code');
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code);
      } catch {
        const field = document.createElement('textarea');
        field.value = code;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.left = '-9999px';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }

      const feedback = button.querySelector('.project-referral-copied');
      const value = button.querySelector('.project-referral-value');
      const icon = button.querySelector('ion-icon');
      if (!feedback) return;

      feedback.hidden = false;
      if (value) value.hidden = true;
      if (icon) icon.setAttribute('hidden', '');

      window.clearTimeout(button._copiedTimer);
      button._copiedTimer = window.setTimeout(() => {
        feedback.hidden = true;
        if (value) value.hidden = false;
        if (icon) icon.removeAttribute('hidden');
      }, 1600);
    });
  }

  isAccordionGroup(key) {
    return key === 'completedTestnets';
  }

  withDefinedGroups(data) {
    const next = data && typeof data === 'object' ? { ...data } : {};
    this.groups.forEach((group) => {
      if (next[group.key] == null) next[group.key] = [];
    });
    return next;
  }

  shouldRenderGroup(data, group) {
    if (this.isAccordionGroup(group.key)) return true;
    return this.jsonGroupLength(data, group.key) > 0;
  }

  sortProjectsByName(items) {
    return items.slice().sort((left, right) => {
      const a = String(left && left.name ? left.name : '').trim();
      const b = String(right && right.name ? right.name : '').trim();
      return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
    });
  }

  visibleGroups(data) {
    return this.groups.filter((group) => this.shouldRenderGroup(data, group));
  }

  sectionId(key) {
    return `project-group-${key}`;
  }

  renderNav(visible) {
    if (!this.nav) return;

    if (!visible.length) {
      this.nav.hidden = true;
      this.nav.innerHTML = '';
      return;
    }

    this.nav.hidden = false;
    this.nav.innerHTML = visible.map((group, index) => {
      const href = `#${this.sectionId(group.key)}`;
      const activeClass = index === 0 ? ' is-active' : '';
      const current = index === 0 ? ' aria-current="true"' : '';
      return `<a class="project-section-nav-link${activeClass}" href="${href}" data-group="${group.key}"${current}>${this.escapeHtml(group.title)}</a>`;
    }).join('');

    this.nav.querySelectorAll('.project-section-nav-link').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.getElementById(this.sectionId(link.dataset.group));
        if (!target) return;
        this.setActiveNav(link.dataset.group);
        const trigger = target.querySelector('.project-accordion-trigger');
        if (trigger) this.setAccordionOpen(trigger, true);

        const scrollToSection = () => {
          const headerEl = document.querySelector('.projects-page > header');
          const offset = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height) + 8 : 0;
          const top = window.scrollY + target.getBoundingClientRect().top - offset;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        };

        if (trigger) window.setTimeout(scrollToSection, 280);
        else scrollToSection();
      });
    });
  }

  setActiveNav(key) {
    if (!this.nav || !key) return;
    this.nav.querySelectorAll('.project-section-nav-link').forEach((link) => {
      const active = link.dataset.group === key;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  bindSectionSpy() {
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }

    const sections = this.container
      ? [...this.container.querySelectorAll('.project-group[data-group]')]
      : [];
    if (!sections.length) return;

    const headerEl = document.querySelector('.projects-page > header');
    const sync = () => {
      const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const line = headerH + 20;
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) current = section;
      }
      this.setActiveNav(current.dataset.group);
    };

    this.sectionObserver = new IntersectionObserver(sync, {
      root: null,
      threshold: [0, 0.15, 0.35, 0.6, 1]
    });
    sections.forEach((section) => this.sectionObserver.observe(section));

    if (!this.sectionSpyScrollBound) {
      this.sectionSpyScrollBound = true;
      window.addEventListener('scroll', () => {
        if (typeof this.syncActiveSection === 'function') this.syncActiveSection();
      }, { passive: true });
    }
    this.syncActiveSection = sync;
    sync();
  }

  panelId(key) {
    return `${this.sectionId(key)}-panel`;
  }

  bindAccordion() {
    if (!this.container || this.container.dataset.accordionBound) return;
    this.container.dataset.accordionBound = 'true';

    this.container.addEventListener('click', (event) => {
      const trigger = event.target.closest('.project-accordion-trigger');
      if (!trigger || !this.container.contains(trigger)) return;
      this.setAccordionOpen(trigger, trigger.getAttribute('aria-expanded') !== 'true');
    });
  }

  setAccordionOpen(trigger, open) {
    const section = trigger.closest('.project-group-accordion');
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (section) section.classList.toggle('is-open', open);
    if (panel) {
      panel.classList.toggle('is-open', open);
      if (open) panel.removeAttribute('inert');
      else panel.setAttribute('inert', '');
    }
  }

  jsonGroupLength(data, key) {
    const groupData = data ? data[key] : undefined;
    if (Array.isArray(groupData)) return groupData.length;
    if (groupData && Array.isArray(groupData.items)) return groupData.items.length;
    return 0;
  }

  renderGroup(group, items, titleCount) {
    const cards = items.map((item) => this.renderCard(item, group.key)).join('');
    const list = `<div class="project-card-list">${cards}</div>`;

    if (!this.isAccordionGroup(group.key)) {
      return `
        <section class="project-group" id="${this.sectionId(group.key)}" data-group="${group.key}">
          <h3 class="h3 project-group-title">${this.escapeHtml(group.title)}</h3>
          ${list}
        </section>
      `;
    }

    const count = Number.isFinite(titleCount) ? titleCount : items.length;
    const triggerId = `${this.sectionId(group.key)}-trigger`;
    const panel = this.panelId(group.key);

    return `
      <section class="project-group project-group-accordion" id="${this.sectionId(group.key)}" data-group="${group.key}">
        <h3 class="h3 project-group-title">
          <button
            type="button"
            class="project-accordion-trigger"
            id="${triggerId}"
            aria-expanded="false"
            aria-controls="${panel}"
          >
            <span class="project-accordion-label">${this.escapeHtml(group.title)} (${count})</span>
            <span class="project-accordion-icon" aria-hidden="true"></span>
          </button>
        </h3>
        <div
          class="project-accordion-panel"
          id="${panel}"
          role="region"
          aria-labelledby="${triggerId}"
          inert
        >
          <div class="project-accordion-panel-inner">
            ${list}
          </div>
        </div>
      </section>
    `;
  }

  render(data) {
    if (!this.container) return;

    data = this.withDefinedGroups(data);
    const visible = this.visibleGroups(data);
    this.renderNav(visible);

    const sections = visible.map((group) => {
      const items = this.sortProjectsByName(this.normalizeItems(data[group.key]));
      const titleCount = this.isAccordionGroup(group.key)
        ? this.jsonGroupLength(data, group.key)
        : items.length;
      return this.renderGroup(group, items, titleCount);
    });

    this.container.innerHTML = sections.join('') || `
      <p class="project-groups-empty">${this.escapeHtml(this.t('projects.empty', null, 'No projects to list yet.'))}</p>
    `;
    this.bindSectionSpy();
  }

  async loadProjects() {
    if (!this.container) return;
    try {
      if (window.KolTiginI18n && window.KolTiginI18n.ready) {
        await window.KolTiginI18n.ready;
      }
      this.applyLabels();

      const response = await fetch('./projects/projects.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(this.t('projects.loadError', null, 'Could not load projects.json'));
      }
      const data = await response.json();
      this.render(data);
    } catch (error) {
      this.renderNav([]);
      this.container.innerHTML = `<p class="error-message">${this.escapeHtml(error.message)}</p>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.projectsParser = new ProjectsParser();
  window.projectsParser.loadProjects();
});

if (window.KolTiginI18n) {
  window.KolTiginI18n.onChange(() => {
    if (window.projectsParser) window.projectsParser.loadProjects();
  });
}
