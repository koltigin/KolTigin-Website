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

  function syncGuideEditorFields(draft, fields) {
    if (!draft) return;
    const src = fields || {};
    if ('markdown' in src && draft.langs && draft.lang) {
      draft.langs[draft.lang] = src.markdown == null ? '' : String(src.markdown);
    }
    if ('projectId' in src) {
      draft.projectId = String(src.projectId || '');
    }
    if ('buttonLabelEn' in src) {
      draft.buttonLabelEn = String(src.buttonLabelEn || '');
    }
    if ('buttonLabelTr' in src) {
      draft.buttonLabelTr = String(src.buttonLabelTr || '');
    }
  }

  function switchGuideLang(draft, nextLang) {
    if (!draft) return;
    draft.lang = nextLang === 'tr' ? 'tr' : 'en';
  }

  function visibleGuideLabelFields(lang) {
    const turkish = lang === 'tr';
    return { labelEn: !turkish, labelTr: turkish };
  }

  function isGuideProjectLink(link, guideId) {
    if (!link || typeof link !== 'object') return false;
    return String(link.guide || '') === String(guideId || '');
  }

  function relatedProjectForGuide(guideId, projects, metaProjects) {
    const id = String(guideId || '');
    const list = Array.isArray(projects) ? projects : [];
    for (let i = 0; i < list.length; i += 1) {
      const project = list[i];
      if (!project) continue;
      const links = Array.isArray(project.links) ? project.links : [];
      const link = links.find((entry) => isGuideProjectLink(entry, id));
      if (link) return { id: project.id, name: project.name, label: link.label };
    }
    const meta = Array.isArray(metaProjects) ? metaProjects : [];
    return meta.find((item) => item && item.id) || null;
  }

  function guideButtonLabelParts(label) {
    if (label && typeof label === 'object' && !Array.isArray(label)) {
      return {
        en: String(label.en || label.labelEN || '').trim(),
        tr: String(label.tr || label.labelTR || '').trim()
      };
    }
    const text = String(label || '').trim();
    if (!text) return { en: '', tr: '' };
    if (text === 'Setup Guide' || text === 'Kurulum Rehberi') {
      return { en: 'Setup Guide', tr: 'Kurulum Rehberi' };
    }
    return { en: text, tr: text };
  }

  function hydrateGuideRelation(guideId, projects, meta) {
    const related = relatedProjectForGuide(guideId, projects, (meta && meta.projects) || []);
    const labels = guideButtonLabelParts(related && related.label);
    return {
      projectId: related && related.id ? String(related.id) : '',
      buttonLabelEn: labels.en,
      buttonLabelTr: labels.tr
    };
  }

  function guideSaveRequest(draft) {
    const locales = localesFromLangs((draft && draft.langs) || {});
    if (!locales.length) return null;
    const en = String((draft && draft.buttonLabelEn) || '').trim();
    const tr = String((draft && draft.buttonLabelTr) || '').trim();
    const payload = {
      id: String((draft && draft.id) || ''),
      projectId: String((draft && draft.projectId) || ''),
      cover: (draft && draft.cover) || '',
      labelEn: en,
      labelTr: tr,
      locales
    };
    if (en || tr) payload.linkLabel = { en: en || tr, tr: tr || en };
    return payload;
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
    syncGuideEditorFields,
    switchGuideLang,
    visibleGuideLabelFields,
    relatedProjectForGuide,
    guideButtonLabelParts,
    hydrateGuideRelation,
    guideSaveRequest,
    pageSaveRequest
  };
  root.KTCmsSave = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
