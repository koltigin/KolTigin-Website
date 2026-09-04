(function (root) {
  'use strict';

  function otherLang(lang) {
    return lang === 'tr' ? 'en' : 'tr';
  }

  function isIndexedCharMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
  }

  function scalarTitle(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      if (!value.length) return '';
      if (value.every((part) => typeof part === 'string' && part.length <= 1)) {
        return value.join('').trim();
      }
      return value.map(scalarTitle).filter(Boolean).join(' ').trim();
    }
    if (typeof value === 'object') {
      if (isIndexedCharMap(value)) {
        return Object.keys(value)
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => value[key])
          .join('')
          .trim();
      }
      if (typeof value.title === 'string') return value.title.trim();
      if (typeof value.title_en === 'string' || typeof value.titleEn === 'string') {
        return String(value.title_en || value.titleEn || '').trim();
      }
    }
    return '';
  }

  function titleFromPack(pack) {
    if (!pack) return '';
    if (typeof pack === 'string') return pack.trim();
    return scalarTitle(pack.title) || scalarTitle(pack.title_en) || scalarTitle(pack.title_tr)
      || scalarTitle(pack.titleEn) || scalarTitle(pack.titleTr);
  }

  function writingListTitle(item, lang) {
    const active = lang === 'tr' ? 'tr' : 'en';
    const langs = (item && item.languages) || {};
    return titleFromPack(langs[active])
      || titleFromPack(langs[otherLang(active)])
      || (active === 'tr' ? scalarTitle(item && item.titleTr) : scalarTitle(item && item.titleEn))
      || scalarTitle(item && item.title)
      || String((item && item.id) || '');
  }

  function videoListTitle(item, lang) {
    const active = lang === 'tr' ? 'tr' : 'en';
    const en = scalarTitle(item && item.titleEn);
    const tr = scalarTitle(item && item.titleTr);
    const generic = scalarTitle(item && item.title);
    if (active === 'tr') return tr || en || generic || String((item && item.id) || '');
    return en || tr || generic || String((item && item.id) || '');
  }

  function guideListTitle(item, lang) {
    const active = lang === 'tr' ? 'tr' : 'en';
    const en = scalarTitle(item && item.titleEn);
    const tr = scalarTitle(item && item.titleTr);
    if (active === 'tr') return tr || en || String((item && item.id) || '');
    return en || tr || String((item && item.id) || '');
  }

  function localizedText(value, lang, fallback) {
    const active = lang === 'tr' ? 'tr' : 'en';
    if (value == null || value === '') return fallback || '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value) || isIndexedCharMap(value)) return scalarTitle(value) || fallback || '';
    if (typeof value === 'object') {
      const direct = scalarTitle(value[active]) || scalarTitle(value[otherLang(active)])
        || scalarTitle(value.en) || scalarTitle(value.tr);
      if (direct) return direct;
      const fromTitle = titleFromPack(value);
      if (fromTitle) return fromTitle;
    }
    return fallback || '';
  }

  function upsertById(list, item, getId) {
    const idOf = getId || ((row) => row && row.id);
    const current = Array.isArray(list) ? list.slice() : [];
    const id = idOf(item);
    if (!id) return current;
    const index = current.findIndex((row) => idOf(row) === id);
    if (index === -1) return [item, ...current];
    current[index] = { ...current[index], ...item };
    return current;
  }

  function mergeRemoteList(remote, local, getId) {
    const idOf = getId || ((row) => row && row.id);
    const localList = Array.isArray(local) ? local : [];
    const remoteList = Array.isArray(remote) ? remote : [];
    const seen = new Set();
    const out = [];
    localList.forEach((item) => {
      const id = idOf(item);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(item);
    });
    remoteList.forEach((item) => {
      const id = idOf(item);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(item);
    });
    return out;
  }

  function writingFromEditor(editor, id) {
    const langs = (editor && editor.langs) || {};
    const pair = (editor && editor.pair) || {};
    const languages = {};
    ['en', 'tr'].forEach((lang) => {
      const draft = langs[lang] || {};
      const title = scalarTitle(draft.title);
      const has = Boolean(draft.exists || title || String(draft.body || '').trim());
      if (!has && lang !== editor.lang) return;
      languages[lang] = {
        title,
        date: pair.date || '',
        file: `${id}.md`,
        cover: draft.cover || '',
        externalUrl: pair.externalUrl || '',
        excerpt: '',
        readingTime: 1,
        hasCover: Boolean(draft.cover)
      };
    });
    const enOk = Boolean(languages.en && languages.en.title);
    const trOk = Boolean(languages.tr && languages.tr.title);
    return {
      id,
      kind: editor.kind,
      date: pair.date || '',
      status: enOk && trOk ? 'published' : enOk ? 'missing-tr' : 'missing-en',
      languages
    };
  }

  function videoFromEditor(video, id) {
    const titleEn = scalarTitle(video && video.titleEn);
    const titleTr = scalarTitle(video && video.titleTr);
    return {
      id,
      kind: 'videos',
      file: `${id}.md`,
      title: titleEn || titleTr,
      titleEn,
      titleTr,
      date: (video && video.date) || '',
      youtubeId: (video && video.youtubeId) || '',
      youtubeUrl: (video && video.youtubeUrl) || '',
      status: 'published'
    };
  }

  function parseFrontMatter(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n');
    if (!raw.startsWith('---')) return { meta: {}, body: raw };
    const parts = raw.split('---', 3);
    if (parts.length < 3) return { meta: {}, body: raw };
    const meta = {};
    parts[1].split('\n').forEach((line) => {
      if (!line.includes(':')) return;
      const index = line.indexOf(':');
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      }
      if (key) meta[key] = value;
    });
    ['title', 'title_en', 'title_tr'].forEach((key) => {
      if (key in meta) meta[key] = scalarTitle(meta[key]);
    });
    return { meta, body: parts[2].replace(/^\n/, '') };
  }

  const api = {
    scalarTitle,
    titleFromPack,
    writingListTitle,
    videoListTitle,
    guideListTitle,
    localizedText,
    upsertById,
    mergeRemoteList,
    writingFromEditor,
    videoFromEditor,
    parseFrontMatter
  };
  root.KTContentSync = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
