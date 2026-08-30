'use strict';

const SOCIAL_BRAND_SVG = {
  farcaster: `<svg class="social-brand-icon" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
                <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
                <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.445H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z"/>
                <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.445H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z"/>
              </svg>`,
  base: `<svg class="social-brand-icon" viewBox="0 0 111 111" aria-hidden="true" focusable="false">
                <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H73.8457V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z"/>
              </svg>`
};

let socialApplied = false;

function applyText(selector, value) {
  const el = document.querySelector(selector);
  if (el && value != null && value !== '') el.textContent = value;
}

function applyI18n() {
  const { t } = window.KolTiginI18n;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) el.setAttribute('aria-label', t(key));
  });
}

const PRODUCTION_ORIGIN = 'https://koltigin.xyz/';

function canonicalUrl(site) {
  const value = site && site.canonicalUrl;
  if (typeof value === 'string' && value.trim()) {
    return value.trim().endsWith('/') ? value.trim() : value.trim() + '/';
  }
  return PRODUCTION_ORIGIN;
}

function absoluteAssetUrl(site, path) {
  const origin = canonicalUrl(site);
  const raw = path || (site && site.ogImage) || './assets/images/common/og-image.png';
  if (/^https?:\/\//i.test(raw)) return raw;
  return origin + String(raw).replace(/^\.\//, '').replace(/^\/+/, '');
}

function setAttr(selector, attr, value) {
  const el = document.querySelector(selector);
  if (el && value != null && value !== '') el.setAttribute(attr, value);
}

function applySeo() {
  const site = window.KolTiginI18n.site;
  const lang = window.KolTiginI18n.language;
  const seo = site && site.seo && (site.seo[lang] || site.seo.en || site.seo);
  if (!seo) return;

  const title = seo.title || 'KolTigin';
  const description = seo.description || '';
  const url = canonicalUrl(site);
  const image = absoluteAssetUrl(site, site && site.ogImage);

  document.title = title;
  setAttr('meta[name="description"]', 'content', description);
  setAttr('link[rel="canonical"]', 'href', url);
  setAttr('meta[property="og:type"]', 'content', 'website');
  setAttr('meta[property="og:title"]', 'content', title);
  setAttr('meta[property="og:description"]', 'content', description);
  setAttr('meta[property="og:url"]', 'content', url);
  setAttr('meta[property="og:image"]', 'content', image);
  setAttr('meta[property="og:locale"]', 'content', lang === 'tr' ? 'tr_TR' : 'en_US');
  setAttr('meta[name="twitter:card"]', 'content', 'summary_large_image');
  setAttr('meta[name="twitter:title"]', 'content', title);
  setAttr('meta[name="twitter:description"]', 'content', description);
  setAttr('meta[name="twitter:image"]', 'content', image);
}

function applyLangSwitch() {
  const lang = window.KolTiginI18n.language;
  const label = window.KolTiginI18n.t('lang.label', null, 'Language');
  document.querySelectorAll('[data-lang-switch]').forEach((group) => {
    group.setAttribute('aria-label', label);
    group.querySelectorAll('[data-set-lang]').forEach((button) => {
      const code = button.getAttribute('data-set-lang');
      const active = code === lang;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      const nameKey = code === 'tr' ? 'lang.trName' : 'lang.enName';
      button.setAttribute('aria-label', window.KolTiginI18n.t(nameKey, null, code === 'tr' ? 'Turkish' : 'English'));
    });
  });
}

function applySiteConfig() {
  const site = window.KolTiginI18n.site;
  if (!site) return;
  const { localized } = window.KolTiginI18n;

  applySeo();

  const avatar = document.querySelector('.avatar-box img');
  if (avatar && site.avatar) {
    avatar.src = site.avatar;
    avatar.alt = site.displayName || avatar.alt;
  }

  const nameEl = document.querySelector('.sidebar .name');
  if (nameEl && site.displayName) {
    nameEl.textContent = site.displayName;
    nameEl.setAttribute('title', site.displayName);
  }

  applyText('.title-motto', site.motto);
  applyText('.title-focus', localized(site.tagline));

  const mailLink = document.querySelector('.contact-item a[href^="mailto:"]');
  if (mailLink && site.email) {
    mailLink.href = `mailto:${site.email}`;
    mailLink.textContent = site.email;
  }

  const wa = site.whatsapp || {};
  const waLink = document.querySelector('.contact-item a[href*="wa.me"]');
  if (waLink) {
    if (wa.url) waLink.href = wa.url;
    if (wa.display) waLink.textContent = wa.display;
  }

  const address = document.querySelector('.contacts-list address');
  if (address) address.textContent = localized(site.location) || address.textContent;

  const socialList = document.querySelector('.social-list');
  if (!socialApplied && socialList && Array.isArray(site.social) && site.social.length) {
    socialApplied = true;
    socialList.innerHTML = site.social.map((item) => {
      const label = item.label || item.id || '';
      const url = item.url || '#';
      const brand = SOCIAL_BRAND_SVG[item.icon] || SOCIAL_BRAND_SVG[item.id];
      const icon = brand
        ? brand
        : `<ion-icon name="${item.icon || 'link-outline'}"></ion-icon>`;
      return `<li class="social-item">
            <a href="${url}" class="social-link" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">
              ${icon}
            </a>
          </li>`;
    }).join('');
  }

  applyLangSwitch();
}

function bindLangSwitch() {
  if (document.body.dataset.langSwitchBound) return;
  document.body.dataset.langSwitchBound = 'true';
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-set-lang]');
    if (!button || !window.KolTiginI18n) return;
    event.preventDefault();
    event.stopPropagation();
    window.KolTiginI18n.setLanguage(button.getAttribute('data-set-lang'));
  });
}

function syncDesktopTitleClearance() {
  const nav = document.querySelector('.navbar');
  const titles = document.querySelectorAll('article > header .article-title');
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  const pad = desktop && nav
    ? Math.ceil(nav.getBoundingClientRect().width + 18) + 'px'
    : '';
  titles.forEach((title) => {
    title.style.paddingRight = pad;
  });
}

function refreshChrome() {
  applyI18n();
  applySiteConfig();
  if (window.KolTiginLastUpdate && typeof window.KolTiginLastUpdate.setLocale === 'function') {
    window.KolTiginLastUpdate.setLocale(window.KolTiginI18n.language);
  }
  requestAnimationFrame(syncDesktopTitleClearance);
}

if (window.KolTiginI18n && window.KolTiginI18n.ready) {
  bindLangSwitch();
  window.KolTiginI18n.ready.then(refreshChrome).catch((error) => {
    console.error('site.js:', error);
  });
  window.KolTiginI18n.onChange(refreshChrome);
}

window.addEventListener('resize', () => {
  requestAnimationFrame(syncDesktopTitleClearance);
});
