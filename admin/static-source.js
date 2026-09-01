(() => {
  'use strict';

  const cache = new Map();

  function siteUrl(path) {
    const raw = String(path || '');
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `${raw.startsWith('/') ? '' : '/'}${raw.replace(/^\.\//, '')}`;
  }

  async function fetchText(path) {
    const url = siteUrl(path);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
    return response.text();
  }

  async function fetchJson(path) {
    const key = siteUrl(path);
    if (cache.has(key)) return cache.get(key);
    const response = await fetch(key, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${key}`);
    const data = await response.json();
    cache.set(key, data);
    return data;
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
    return { meta, body: parts[2].replace(/^\n/, '') };
  }

  function firstHeading(markdown) {
    const line = String(markdown || '').split('\n').find((item) => item.startsWith('# '));
    return line ? line.slice(2).trim() : '';
  }

  function fileId(name) {
    return String(name || '').replace(/\.md$/i, '');
  }

  function excerptFromBody(body) {
    const chunks = [];
    for (const line of String(body || '').split('\n')) {
      const stripped = line.trim();
      if (!stripped || stripped.startsWith('#') || stripped.startsWith('```')) {
        if (chunks.length) break;
        continue;
      }
      chunks.push(stripped.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/[*_`>#]+/g, ''));
      if (chunks.join(' ').length >= 160) break;
    }
    let text = chunks.join(' ').trim();
    if (text.length > 160) text = `${text.slice(0, 157).trim()}…`;
    return text;
  }

  async function loadWritings(index, types) {
    const grouped = {};
    for (const type of types) {
      const kind = type.id;
      const files = index[kind] || {};
      const byId = {};
      for (const lang of ['en', 'tr']) {
        for (const file of files[lang] || []) {
          const id = fileId(file);
          const entry = byId[id] || {
            id,
            kind,
            languages: {},
            date: '',
            status: 'published'
          };
          try {
            const text = await fetchText(`/content/${kind}/${lang}/${file}`);
            const { meta, body } = parseFrontMatter(text);
            const date = meta.date || '';
            entry.languages[lang] = {
              title: meta.title || id,
              date,
              file,
              cover: meta.cover || meta.image || '',
              externalUrl: meta.externalUrl || '',
              excerpt: meta.summary || excerptFromBody(body),
              readingTime: Math.max(1, Math.round((body.trim().split(/\s+/).filter(Boolean).length || 1) / 200)),
              hasCover: Boolean((meta.cover || meta.image || '').trim())
            };
            if (date && (!entry.date || date > entry.date)) entry.date = date;
          } catch {
            entry.languages[lang] = { title: id, date: '', file, cover: '', externalUrl: '', excerpt: '', readingTime: 1, hasCover: false };
          }
          byId[id] = entry;
        }
      }
      Object.values(byId).forEach((entry) => {
        if (entry.languages.en && entry.languages.tr) entry.status = 'published';
        else if (entry.languages.en) entry.status = 'missing-tr';
        else entry.status = 'missing-en';
      });
      grouped[kind] = Object.values(byId).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.id.localeCompare(b.id));
    }
    return grouped;
  }

  async function loadVideos(index) {
    const files = index.videos || [];
    const items = await Promise.all(files.map(async (file) => {
      const id = fileId(file);
      try {
        const text = await fetchText(`/content/videos/${file}`);
        const { meta } = parseFrontMatter(text);
        return {
          id,
          kind: 'videos',
          file,
          title: meta.title || id,
          titleEn: meta.title_en || '',
          titleTr: meta.title_tr || '',
          date: meta.date || '',
          youtubeId: meta.youtubeId || '',
          youtubeUrl: meta.youtubeUrl || '',
          status: 'published'
        };
      } catch {
        return { id, kind: 'videos', file, title: id, titleEn: '', titleTr: '', date: '', youtubeId: '', youtubeUrl: '', status: 'published' };
      }
    }));
    items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.id.localeCompare(b.id));
    return items;
  }

  async function loadItem(kind, id) {
    if (kind === 'videos') {
      const text = await fetchText(`/content/videos/${id}.md`);
      const { meta } = parseFrontMatter(text);
      return {
        kind,
        id,
        video: {
          titleEn: meta.title_en || '',
          titleTr: meta.title_tr || '',
          date: meta.date || '',
          youtubeUrl: meta.youtubeUrl || '',
          youtubeId: meta.youtubeId || ''
        }
      };
    }
    const languages = {};
    for (const lang of ['en', 'tr']) {
      try {
        const text = await fetchText(`/content/${kind}/${lang}/${id}.md`);
        const { meta, body } = parseFrontMatter(text);
        languages[lang] = {
          exists: true,
          file: `${id}.md`,
          title: meta.title || '',
          date: meta.date || '',
          cover: meta.cover || meta.image || '',
          externalUrl: meta.externalUrl || '',
          body
        };
      } catch {
        languages[lang] = { exists: false, file: `${id}.md` };
      }
    }
    return { kind, id, languages };
  }

  function flattenProjects(json, categories) {
    const byId = Object.fromEntries((categories || []).map((item) => [item.id, item]));
    const records = [];
    Object.entries(json || {}).forEach(([groupKey, items]) => {
      if (!Array.isArray(items)) return;
      const cat = byId[groupKey] || {};
      items.forEach((project) => {
        records.push({
          id: project.id,
          slug: project.id,
          name: project.name,
          category: groupKey,
          categoryFolder: cat.folder || '',
          status: project.status || '',
          role: project.role,
          logo: project.logo || '',
          summary: project.summary || {},
          links: project.links || [],
          referral_url: project.referralUrl || project.referral_url || '',
          referral_code: project.referralCode || project.referral_code || '',
          former_name: project.former_name || project.formerName || '',
          path: cat.folder ? `content/projects/${cat.folder}/${project.id}.md` : ''
        });
      });
    });
    return records;
  }

  async function loadGuides(projects) {
    let ids = [];
    try {
      const index = await fetchJson('/guides/index.json');
      ids = Array.isArray(index.guides) ? index.guides : [];
    } catch {
      ids = [];
    }
    if (!ids.length) {
      const found = new Set();
      (projects || []).forEach((project) => {
        (project.links || []).forEach((link) => {
          if (link && link.guide) found.add(link.guide);
        });
      });
      ids = [...found];
    }
    const guides = [];
    for (const id of ids) {
      let en = '';
      let tr = '';
      try { en = await fetchText(`/guides/${id}/EN.md`); } catch { /* missing */ }
      try { tr = await fetchText(`/guides/${id}/TR.md`); } catch { /* missing */ }
      const related = (projects || [])
        .filter((project) => (project.links || []).some((link) => link && link.guide === id))
        .map((project) => ({ id: project.id, name: project.name }));
      guides.push({
        id,
        titleEn: firstHeading(en) || id,
        titleTr: firstHeading(tr) || id,
        existsEn: Boolean(en),
        existsTr: Boolean(tr),
        projects: related
      });
    }
    return guides;
  }

  async function read(path) {
    const url = new URL(path, location.origin);
    const pathname = url.pathname.replace(/\/+$/, '') || url.pathname;
    const query = url.searchParams;

    if (pathname === '/admin/api/session') {
      return { authed: true, production: true, prototype: false };
    }
    if (pathname === '/admin/api/site') {
      const site = await fetchJson('/config/site.json');
      return { site };
    }
    if (pathname === '/admin/api/social-platforms') {
      return fetchJson('/config/social-platforms.json');
    }
    if (pathname === '/admin/api/writing-types') {
      const pack = await fetchJson('/config/writing-types.json');
      return { types: pack.types || [], icons: [] };
    }
    if (pathname === '/admin/api/content') {
      const [typesPack, index] = await Promise.all([
        fetchJson('/config/writing-types.json'),
        fetchJson('/content/index.json')
      ]);
      const types = typesPack.types || [];
      const writings = await loadWritings(index, types);
      const videos = await loadVideos(index);
      return { types, videos, ...writings };
    }
    if (pathname === '/admin/api/item') {
      return loadItem(query.get('kind') || '', query.get('id') || '');
    }
    if (pathname === '/admin/api/page') {
      const family = query.get('family') || '';
      const lang = query.get('lang') || '';
      const markdown = await fetchText(`/content/${family}/${lang}.md`);
      return { family, lang, markdown };
    }
    if (pathname === '/admin/api/projects') {
      const [categories, json] = await Promise.all([
        fetchJson('/config/project-categories.json'),
        fetchJson('/projects/projects.json')
      ]);
      return { categories, projects: flattenProjects(json, categories) };
    }
    if (pathname === '/admin/api/guides') {
      const pack = await read('/admin/api/projects');
      return { guides: await loadGuides(pack.projects), projects: pack.projects };
    }
    if (pathname === '/admin/api/guide') {
      const id = query.get('id') || '';
      let en = '';
      let tr = '';
      try { en = await fetchText(`/guides/${id}/EN.md`); } catch { /* missing */ }
      try { tr = await fetchText(`/guides/${id}/TR.md`); } catch { /* missing */ }
      const pack = await read('/admin/api/guides');
      const meta = (pack.guides || []).find((item) => item.id === id) || {};
      return { id, exists: Boolean(en || tr), en, tr, meta };
    }
    if (pathname === '/admin/api/contact') {
      const [site, en, tr] = await Promise.all([
        fetchJson('/config/site.json'),
        fetchJson('/i18n/en.json'),
        fetchJson('/i18n/tr.json')
      ]);
      const keys = Object.keys((en && en.contact) || {});
      const pick = (data) => {
        const contact = (data && data.contact) || {};
        const out = {};
        keys.forEach((key) => { out[key] = contact[key] || ''; });
        return out;
      };
      return { site, i18n: { en: pick(en), tr: pick(tr) }, keys };
    }
    throw new Error(`Unknown admin read: ${pathname}`);
  }

  window.KTAdminStatic = { read, siteUrl };
})();
