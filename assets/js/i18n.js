'use strict';

(function (global) {
  const STORAGE_KEY = 'siteLang';
  const listeners = [];

  let site = null;
  let strings = {};
  let language = 'en';

  function supportedLanguages() {
    return Array.isArray(site && site.supportedLanguages) ? site.supportedLanguages : ['en', 'tr'];
  }

  function lookup(key) {
    const parts = String(key || '').split('.');
    let current = strings;
    for (const part of parts) {
      if (!current || typeof current !== 'object' || !(part in current)) return null;
      current = current[part];
    }
    return current;
  }

  function interpolate(value, vars) {
    if (!vars || typeof value !== 'string') return value;
    return value.replace(/\{(\w+)\}/g, (_, name) => (
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`
    ));
  }

  function t(key, vars, fallback) {
    const found = lookup(key);
    if (typeof found === 'string') return interpolate(found, vars);
    if (typeof fallback === 'string') return interpolate(fallback, vars);
    return key;
  }

  function localized(value, lang) {
    const locale = lang || language;
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      if (typeof value[locale] === 'string') return value[locale];
      if (locale !== 'en' && typeof value.en === 'string') return value.en;
      if (locale !== 'tr' && typeof value.tr === 'string') return value.tr;
    }
    return '';
  }

  function resolveLanguage(config) {
    const supported = Array.isArray(config && config.supportedLanguages)
      ? config.supportedLanguages
      : ['en', 'tr'];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && supported.includes(stored)) return stored;
    } catch {
      // ignore private mode
    }

    const fallback = (config && config.defaultLanguage) || 'en';
    return supported.includes(fallback) ? fallback : 'en';
  }

  function guideLang() {
    return language === 'tr' ? 'TR' : 'EN';
  }

  async function loadStrings(lang) {
    const i18nResponse = await fetch(`./i18n/${lang}.json`, { cache: 'no-store' });
    if (!i18nResponse.ok) throw new Error('i18n file could not be loaded');
    strings = await i18nResponse.json();
    language = lang;
    document.documentElement.lang = lang;
  }

  async function load() {
    const siteResponse = await fetch('./config/site.json', { cache: 'no-store' });
    if (!siteResponse.ok) throw new Error('site.json could not be loaded');
    site = await siteResponse.json();
    await loadStrings(resolveLanguage(site));
    return { site, language, strings };
  }

  async function setLanguage(next) {
    const lang = String(next || '').toLowerCase();
    if (!supportedLanguages().includes(lang) || lang === language) return language;

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore private mode
    }

    await loadStrings(lang);
    listeners.forEach((fn) => {
      try { fn(lang); } catch (error) { console.error(error); }
    });
    return language;
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  const ready = load().catch((error) => {
    console.error('KolTiginI18n:', error);
    throw error;
  });

  global.KolTiginI18n = {
    t,
    localized,
    ready,
    setLanguage,
    onChange,
    guideLang,
    get language() { return language; },
    get site() { return site; },
    STORAGE_KEY
  };
})(window);
