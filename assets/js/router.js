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
    { id: 'contact', path: '/contact/', page: 'contact', nav: 'contact' },
    { id: 'guides', path: '/guides/', page: 'guides', nav: 'guides' }
  ];

  const PAGE_TO_PATH = {
    about: '/about/',
    resume: '/resume/',
    projects: '/projects/',
    blog: '/writings/',
    videos: '/videos/',
    contact: '/contact/',
    guides: '/guides/'
  };

  const HASH_SECTION = {
    about: '/about/',
    resume: '/resume/',
    projects: '/projects/',
    blog: '/writings/',
    writings: '/writings/',
    videos: '/videos/',
    contact: '/contact/',
    guides: '/guides/'
  };

  function normalizePath(pathname) {
    const raw = String(pathname || '/').split('?')[0].split('#')[0];
    if (!raw || raw === '/') return '/';
    const trimmed = raw.replace(/\/+$/, '');
    return `${trimmed}/`;
  }

  function parseWritingPath(pathname) {
    const parts = String(pathname || '').split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (parts.length !== 4 || parts[0] !== 'writings') return null;
    if (!/^(en|tr)$/i.test(parts[1])) return null;
    if (!/^[a-z0-9-]+$/i.test(parts[2]) || !/^[a-z0-9-]+$/i.test(parts[3])) return null;
    return {
      lang: parts[1].toLowerCase() === 'tr' ? 'tr' : 'en',
      kind: parts[2],
      id: parts[3]
    };
  }

  function writingPublicPath(lang, kind, id) {
    const loc = String(lang || 'en').toLowerCase() === 'tr' ? 'tr' : 'en';
    return `/writings/${loc}/${kind}/${id}/`;
  }

  function sectionForPath(pathname) {
    const guide = parseGuidePath(pathname);
    if (guide) {
      return { id: 'guides', path: guidePublicPath(guide.id, guide.lang), page: 'guide', nav: 'guides' };
    }
    const writing = parseWritingPath(pathname);
    if (writing) {
      return {
        id: 'writings',
        path: writingPublicPath(writing.lang, writing.kind, writing.id),
        page: 'blog',
        nav: 'blog'
      };
    }
    const path = normalizePath(pathname);
    return SECTIONS.find((item) => item.path === path) || SECTIONS[0];
  }

  function pathForPage(pageName, currentPath) {
    if (pageName === 'guide') {
      const parsed = parseGuidePath(currentPath || global.location?.pathname);
      if (parsed) return guidePublicPath(parsed.id, parsed.lang);
      return normalizePath(currentPath || global.location?.pathname);
    }
    if (pageName === 'about') return '/about/';
    return PAGE_TO_PATH[pageName] || '/';
  }

  function canonicalForPath(pathname) {
    const writing = parseWritingPath(pathname);
    if (writing) return `${ORIGIN}${writingPublicPath(writing.lang, writing.kind, writing.id)}`;
    const guide = parseGuidePath(pathname);
    if (guide) return `${ORIGIN}${guidePublicPath(guide.id, guide.lang)}`;
    const section = sectionForPath(pathname);
    return `${ORIGIN}${section.path}`;
  }

  function isWritingDetailHash(hash) {
    return /^#\/yazilar\/[a-z0-9-]+\/[^/]+$/i.test(String(hash || ''));
  }

  function isGuideHash(hash) {
    return /^#\/guides\/[a-z0-9-]+/i.test(String(hash || ''));
  }

  function parseGuideHash(hash) {
    const match = String(hash || '').match(
      /^#\/guides\/([a-z0-9-]+)(?:\/(TR|EN))?(?:\/([a-z0-9-]+))?$/i
    );
    if (!match) return null;
    return {
      id: match[1],
      lang: match[2] ? match[2].toUpperCase() : '',
      heading: match[3] || ''
    };
  }

  function parseGuidePath(pathname) {
    const parts = String(pathname || '').split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (parts.length !== 3 || parts[0] !== 'guides') return null;
    if (!/^[a-z0-9-]+$/i.test(parts[1]) || !/^(EN|TR)$/i.test(parts[2])) return null;
    return {
      id: parts[1],
      lang: parts[2].toUpperCase() === 'TR' ? 'TR' : 'EN'
    };
  }

  function guidePublicPath(id, lang) {
    const code = String(lang || 'EN').toUpperCase() === 'TR' ? 'TR' : 'EN';
    return `/guides/${id}/${code}/`;
  }

  function parseGuideHeading(hash) {
    const value = String(hash || '');
    if (!value || value === '#') return '';
    const legacy = parseGuideHash(value);
    if (legacy) return legacy.heading || '';
    const slug = value.replace(/^#/, '');
    return /^[a-z0-9-]+$/i.test(slug) ? slug : '';
  }

  function legacyTarget(hash) {
    const value = String(hash || '');
    if (isWritingDetailHash(value)) {
      const match = value.match(/^#\/yazilar\/([a-z0-9-]+)\/([^/]+)$/i);
      if (match) return writingPublicPath('en', match[1], match[2]);
    }
    if (value === '#/yazilar' || value === '#yazilar') return '/writings/';
    const guide = parseGuideHash(value);
    if (guide) {
      const path = guidePublicPath(guide.id, guide.lang || 'EN');
      return guide.heading ? `${path}#${guide.heading}` : path;
    }
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
    parseGuideHash,
    parseWritingPath,
    writingPublicPath,
    parseGuidePath,
    parseGuideHeading,
    guidePublicPath,
    legacyTarget,
    publicPath
  };
})(window);
