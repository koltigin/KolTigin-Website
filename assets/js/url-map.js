'use strict';

(function (global) {
  const MAP_PATH = './content/url-map.json';

  let snapshot = null;
  let loadPromise = null;

  function normalizeToken(value) {
    return String(value || '').trim().toLowerCase();
  }

  function cloneRecord(rec) {
    if (!rec) return null;
    return {
      id: rec.id,
      kind: rec.kind || '',
      slugs: {
        en: rec.slugs.en || '',
        tr: rec.slugs.tr || ''
      }
    };
  }

  function buildIndexes(data) {
    const writingsByKey = Object.create(null);
    const writingsByKindLangSlug = Object.create(null);
    const writingsByHash = Object.create(null);
    const guidesById = Object.create(null);
    const guidesBySlug = Object.create(null);

    const writings = data && data.writings && typeof data.writings === 'object' ? data.writings : {};
    Object.keys(writings).forEach((key) => {
      const slugs = writings[key] || {};
      const slash = key.indexOf('/');
      if (slash <= 0) return;
      const kind = key.slice(0, slash);
      const id = key.slice(slash + 1);
      if (!kind || !id) return;
      const record = {
        id,
        kind,
        slugs: {
          en: String(slugs.en || '').trim(),
          tr: String(slugs.tr || '').trim()
        }
      };
      writingsByKey[key] = record;
      ['en', 'tr'].forEach((lang) => {
        const slug = record.slugs[lang];
        if (!slug) return;
        writingsByKindLangSlug[`${kind}/${lang}/${slug}`] = record;
      });
    });

    const hashes = data && data.legacy && data.legacy.writingHashes && typeof data.legacy.writingHashes === 'object'
      ? data.legacy.writingHashes
      : {};
    Object.keys(hashes).forEach((alias) => {
      const target = String(hashes[alias] || '').trim();
      const record = writingsByKey[target];
      if (!record) return;
      writingsByHash[normalizeToken(alias)] = record;
    });

    const guides = data && data.guides && typeof data.guides === 'object' ? data.guides : {};
    Object.keys(guides).forEach((id) => {
      const slugs = guides[id] || {};
      const record = {
        id,
        kind: '',
        slugs: {
          en: String(slugs.en || '').trim(),
          tr: String(slugs.tr || '').trim()
        }
      };
      guidesById[id] = record;
      ['en', 'tr'].forEach((lang) => {
        const slug = record.slugs[lang];
        if (!slug) return;
        guidesBySlug[slug] = record;
      });
    });

    return {
      raw: data,
      writingsByKey,
      writingsByKindLangSlug,
      writingsByHash,
      guidesById,
      guidesBySlug
    };
  }

  function setData(data) {
    snapshot = buildIndexes(data || {});
    return snapshot;
  }

  function ensureLoaded() {
    if (snapshot) return Promise.resolve(snapshot);
    if (loadPromise) return loadPromise;
    const router = global.KolTiginRouter;
    const href = router && typeof router.publicPath === 'function'
      ? router.publicPath(MAP_PATH)
      : '/content/url-map.json';
    loadPromise = fetch(`${href}?t=${Date.now()}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`url-map HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => setData(data))
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
    return loadPromise;
  }

  function resolveWriting(kind, routeKey, lang) {
    if (!snapshot) return null;
    const type = String(kind || '').trim();
    const key = String(routeKey || '').trim();
    if (!type || !key) return null;

    const byId = snapshot.writingsByKey[`${type}/${key}`];
    if (byId) return cloneRecord(byId);

    const loc = normalizeToken(lang) === 'tr' ? 'tr' : normalizeToken(lang) === 'en' ? 'en' : '';
    if (loc) {
      const byLocaleSlug = snapshot.writingsByKindLangSlug[`${type}/${loc}/${key}`];
      if (byLocaleSlug) return cloneRecord(byLocaleSlug);
    }

    const byHash = snapshot.writingsByHash[normalizeToken(`${type}/${key}`)];
    if (byHash && byHash.kind === type) return cloneRecord(byHash);

    return null;
  }

  function resolveGuide(routeKey) {
    if (!snapshot) return null;
    const key = String(routeKey || '').trim();
    if (!key) return null;
    if (snapshot.guidesById[key]) return cloneRecord(snapshot.guidesById[key]);
    if (snapshot.guidesBySlug[key]) return cloneRecord(snapshot.guidesBySlug[key]);
    return null;
  }

  function writingCounterpartSlug(kind, routeKey, fromLang, toLang) {
    const record = resolveWriting(kind, routeKey, fromLang);
    if (!record) return null;
    const target = normalizeToken(toLang) === 'tr' ? 'tr' : 'en';
    return record.slugs[target] || null;
  }

  function guideCounterpartSlug(routeKey, toLang) {
    const record = resolveGuide(routeKey);
    if (!record) return null;
    const target = normalizeToken(toLang) === 'tr' ? 'tr' : 'en';
    return record.slugs[target] || null;
  }

  function writingStableId(kind, routeKey, lang) {
    const record = resolveWriting(kind, routeKey, lang);
    return record ? record.id : null;
  }

  function guideStableId(routeKey) {
    const record = resolveGuide(routeKey);
    return record ? record.id : null;
  }

  function isReady() {
    return Boolean(snapshot);
  }

  function rawMap() {
    return snapshot ? snapshot.raw : null;
  }

  global.KolTiginUrlMap = {
    load: ensureLoaded,
    setData,
    isReady,
    rawMap,
    resolveWriting,
    resolveGuide,
    writingCounterpartSlug,
    guideCounterpartSlug,
    writingStableId,
    guideStableId
  };
})(typeof window !== 'undefined' ? window : globalThis);
