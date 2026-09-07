(function (root) {
  'use strict';

  function markdownHasContent(markdown) {
    let text = String(markdown || '').replace(/\r\n/g, '\n');
    if (text.startsWith('---')) {
      const close = text.indexOf('\n---', 3);
      if (close !== -1) text = text.slice(close + 4);
    }
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return false;
    if (lines.every((line) => /^#\s*$/.test(line))) return false;
    return true;
  }

  function localesFromLangs(langs) {
    return ['en', 'tr'].filter((lang) => markdownHasContent(langs && langs[lang])).map((lang) => ({
      lang,
      markdown: langs[lang]
    }));
  }

  function saveShouldShowSuccess(wanted, saved) {
    const need = Array.isArray(wanted) ? wanted : [];
    const got = Array.isArray(saved) ? saved : [];
    return need.length > 0 && need.every((lang) => got.includes(lang));
  }

  function guideSaveRequest(draft) {
    const locales = localesFromLangs((draft && draft.langs) || {});
    if (!locales.length) return null;
    return {
      id: String((draft && draft.id) || ''),
      projectId: String((draft && draft.projectId) || ''),
      cover: (draft && draft.cover) || '',
      locales
    };
  }

  function pageSaveRequest(draft) {
    const family = draft && draft.family;
    if (family !== 'about' && family !== 'resume') return null;
    const locales = localesFromLangs((draft && draft.langs) || {});
    if (!locales.length) return null;
    return { family, locales };
  }

  const api = {
    markdownHasContent,
    localesFromLangs,
    saveShouldShowSuccess,
    guideSaveRequest,
    pageSaveRequest
  };
  root.KTCmsSave = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
