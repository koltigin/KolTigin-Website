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

  function writingLegacyPublicPath(lang, kind, id) {
    const loc = String(lang || 'en').toLowerCase() === 'tr' ? 'tr' : 'en';
    return `/writings/${loc}/${kind}/${id}/`;
  }

  function writingLocalizedPublicPath(lang, kind, publicSlug) {
    const loc = String(lang || 'en').toLowerCase() === 'tr' ? 'tr' : 'en';
    return `/writings/${loc}/${kind}/${publicSlug}/`;
  }

  // Phase 2 default: stable-ID public paths remain live.
  function writingPublicPath(lang, kind, id) {
    return writingLegacyPublicPath(lang, kind, id);
  }

  function guideLegacyPublicPath(id, lang) {
    const code = String(lang || 'EN').toUpperCase() === 'TR' ? 'TR' : 'EN';
    return `/guides/${id}/${code}/`;
  }

  function guideLocalizedPublicPath(publicSlug, lang) {
    const code = String(lang || 'EN').toUpperCase() === 'TR' ? 'TR' : 'EN';
    return `/guides/${publicSlug}/${code}/`;
  }

  // Phase 2 default: stable-ID public paths remain live.
  function guidePublicPath(id, lang) {
    return guideLegacyPublicPath(id, lang);
  }

  function parseWritingPath(pathname) {
    const parts = String(pathname || '').split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (parts.length !== 4 || parts[0] !== 'writings') return null;
    if (!/^(en|tr)$/i.test(parts[1])) return null;
    if (!/^[a-z0-9-]+$/i.test(parts[2]) || !/^[a-z0-9-]+$/i.test(parts[3])) return null;
    const routeKey = parts[3];
    return {
      lang: parts[1].toLowerCase() === 'tr' ? 'tr' : 'en',
      kind: parts[2],
      routeKey,
      // Backward compatible: existing callers still read `.id` as the path segment.
      id: routeKey
    };
  }

  function parseGuidePath(pathname) {
    const parts = String(pathname || '').split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (parts.length !== 3 || parts[0] !== 'guides') return null;
    if (!/^[a-z0-9-]+$/i.test(parts[1]) || !/^(EN|TR)$/i.test(parts[2])) return null;
    const routeKey = parts[1];
    return {
      routeKey,
      // Backward compatible path segment.
      id: routeKey,
      lang: parts[2].toUpperCase() === 'TR' ? 'TR' : 'EN'
    };
  }

  function resolveWritingRoute(parsed) {
    if (!parsed) return null;
    const map = global.KolTiginUrlMap;
    if (!map || typeof map.resolveWriting !== 'function' || !map.isReady()) return null;
    return map.resolveWriting(parsed.kind, parsed.routeKey || parsed.id, parsed.lang);
  }

  function resolveGuideRoute(parsed) {
    if (!parsed) return null;
    const map = global.KolTiginUrlMap;
    if (!map || typeof map.resolveGuide !== 'function' || !map.isReady()) return null;
    return map.resolveGuide(parsed.routeKey || parsed.id);
  }

  function writingStableIdFromRoute(parsed) {
    const resolved = resolveWritingRoute(parsed);
    if (resolved) return resolved.id;
    return parsed && (parsed.routeKey || parsed.id) ? String(parsed.routeKey || parsed.id) : '';
  }

  function guideStableIdFromRoute(parsed) {
    const resolved = resolveGuideRoute(parsed);
    if (resolved) return resolved.id;
    return parsed && (parsed.routeKey || parsed.id) ? String(parsed.routeKey || parsed.id) : '';
  }

  /**
   * Future localized language-switch target. Not used by live navigation in Phase 2.
   */
  function writingLocalizedCounterpartPath(parsed, nextLang) {
    const map = global.KolTiginUrlMap;
    if (!parsed || !map || !map.isReady()) return null;
    const loc = String(nextLang || 'en').toLowerCase() === 'tr' ? 'tr' : 'en';
    const slug = map.writingCounterpartSlug(parsed.kind, parsed.routeKey || parsed.id, parsed.lang, loc);
    if (!slug) return null;
    return writingLocalizedPublicPath(loc, parsed.kind, slug);
  }

  /**
   * Future localized language-switch target for guides. Not used live in Phase 2.
   */
  function guideLocalizedCounterpartPath(parsed, nextLang) {
    const map = global.KolTiginUrlMap;
    if (!parsed || !map || !map.isReady()) return null;
    const code = String(nextLang || 'EN').toUpperCase() === 'TR' ? 'TR' : 'EN';
    const slug = map.guideCounterpartSlug(parsed.routeKey || parsed.id, code === 'TR' ? 'tr' : 'en');
    if (!slug) return null;
    return guideLocalizedPublicPath(slug, code);
  }

  function sectionForPath(pathname) {
    const guide = parseGuidePath(pathname);
    if (guide) {
      const stableId = guideStableIdFromRoute(guide) || guide.id;
      return { id: 'guides', path: guidePublicPath(stableId, guide.lang), page: 'guide', nav: 'guides' };
    }
    const writing = parseWritingPath(pathname);
    if (writing) {
      const stableId = writingStableIdFromRoute(writing) || writing.id;
      return {
        id: 'writings',
        path: writingPublicPath(writing.lang, writing.kind, stableId),
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
      if (parsed) {
        const stableId = guideStableIdFromRoute(parsed) || parsed.id;
        return guidePublicPath(stableId, parsed.lang);
      }
      return normalizePath(currentPath || global.location?.pathname);
    }
    if (pageName === 'about') return '/about/';
    return PAGE_TO_PATH[pageName] || '/';
  }

  function canonicalForPath(pathname) {
    const writing = parseWritingPath(pathname);
    if (writing) {
      const stableId = writingStableIdFromRoute(writing) || writing.id;
      return `${ORIGIN}${writingPublicPath(writing.lang, writing.kind, stableId)}`;
    }
    const guide = parseGuidePath(pathname);
    if (guide) {
      const stableId = guideStableIdFromRoute(guide) || guide.id;
      return `${ORIGIN}${guidePublicPath(stableId, guide.lang)}`;
    }
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
      routeKey: match[1],
      lang: match[2] ? match[2].toUpperCase() : '',
      heading: match[3] || ''
    };
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
      if (match) {
        const kind = match[1];
        const routeKey = match[2];
        const map = global.KolTiginUrlMap;
        let stableId = routeKey;
        if (map && map.isReady()) {
          const resolved = map.resolveWriting(kind, routeKey, 'en')
            || map.resolveWriting(kind, routeKey, 'tr');
          if (resolved) stableId = resolved.id;
        }
        return writingPublicPath('en', kind, stableId);
      }
    }
    if (value === '#/yazilar' || value === '#yazilar') return '/writings/';
    const guide = parseGuideHash(value);
    if (guide) {
      const map = global.KolTiginUrlMap;
      let stableId = guide.id;
      if (map && map.isReady()) {
        const resolved = map.resolveGuide(guide.routeKey || guide.id);
        if (resolved) stableId = resolved.id;
      }
      const path = guidePublicPath(stableId, guide.lang || 'EN');
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
    writingLegacyPublicPath,
    writingLocalizedPublicPath,
    writingLocalizedCounterpartPath,
    resolveWritingRoute,
    writingStableIdFromRoute,
    parseGuidePath,
    parseGuideHeading,
    guidePublicPath,
    guideLegacyPublicPath,
    guideLocalizedPublicPath,
    guideLocalizedCounterpartPath,
    resolveGuideRoute,
    guideStableIdFromRoute,
    legacyTarget,
    publicPath
  };
})(window);
