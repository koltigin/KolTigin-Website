'use strict';

(function (global) {
  const ORIGIN = 'https://koltigin.xyz';

  const SECTIONS = [
    { id: 'home', path: '/', page: 'about', nav: 'about' },
    { id: 'about', path: '/about/', page: 'about', nav: 'about' },
    { id: 'resume', path: '/resume/', page: 'resume', nav: 'resume' },
    { id: 'projects', path: '/projects/', page: 'projects', nav: 'projects' },
    { id: 'writings', path: '/writings/', page: 'blog', nav: 'blog' },
    { id: 'videos', path: '/videos/', page: 'videos', nav: 'videos' },
    { id: 'contact', path: '/contact/', page: 'contact', nav: 'contact' }
  ];

  const PAGE_TO_PATH = {
    about: '/about/',
    resume: '/resume/',
    projects: '/projects/',
    blog: '/writings/',
    videos: '/videos/',
    contact: '/contact/'
  };

  const HASH_SECTION = {
    about: '/about/',
    resume: '/resume/',
    projects: '/projects/',
    blog: '/writings/',
    writings: '/writings/',
    videos: '/videos/',
    contact: '/contact/'
  };

  function normalizePath(pathname) {
    const raw = String(pathname || '/').split('?')[0].split('#')[0];
    if (!raw || raw === '/') return '/';
    const trimmed = raw.replace(/\/+$/, '');
    return `${trimmed}/`;
  }

  function sectionForPath(pathname) {
    const path = normalizePath(pathname);
    return SECTIONS.find((item) => item.path === path) || SECTIONS[0];
  }

  function pathForPage(pageName, currentPath) {
    if (pageName === 'guide') return normalizePath(currentPath || global.location.pathname);
    if (pageName === 'about') return '/about/';
    return PAGE_TO_PATH[pageName] || '/';
  }

  function canonicalForPath(pathname) {
    const section = sectionForPath(pathname);
    return `${ORIGIN}${section.path}`;
  }

  function isWritingDetailHash(hash) {
    return /^#\/yazilar\/[a-z0-9-]+\/[^/]+$/i.test(String(hash || ''));
  }

  function isGuideHash(hash) {
    return /^#\/guides\/[a-z0-9-]+/i.test(String(hash || ''));
  }

  function legacyTarget(hash) {
    const value = String(hash || '');
    if (isWritingDetailHash(value)) return `/writings/${value}`;
    if (value === '#/yazilar' || value === '#yazilar') return '/writings/';
    if (isGuideHash(value)) return `/projects/${value}`;
    const key = value.replace(/^#\/?/, '').split('/')[0].toLowerCase();
    const path = HASH_SECTION[key];
    return path || null;
  }

  function publicPath(path) {
    const raw = String(path || '').trim();
    if (!raw) return raw;
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('mailto:')) return raw;
    const cut = raw.search(/[?#]/);
    const file = cut === -1 ? raw : raw.slice(0, cut);
    const suffix = cut === -1 ? '' : raw.slice(cut);
    if (file.startsWith('/')) return file + suffix;
    return `/${file.replace(/^\.\//, '')}${suffix}`;
  }

  global.KolTiginRouter = {
    SECTIONS,
    ORIGIN,
    normalizePath,
    sectionForPath,
    pathForPage,
    canonicalForPath,
    isWritingDetailHash,
    isGuideHash,
    legacyTarget,
    publicPath
  };
})(window);
