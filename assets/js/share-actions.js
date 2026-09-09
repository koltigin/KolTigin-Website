'use strict';

(function (global) {
  const FARCASTER_COMPOSE = 'https://farcaster.xyz/~/compose';
  const WARPCAST_COMPOSE = 'https://warpcast.com/~/compose';

  function t(key, fallback) {
    return global.KolTiginI18n ? global.KolTiginI18n.t(key, null, fallback) : fallback;
  }

  function labels() {
    return {
      x: t('share.x', 'X'),
      linkedin: t('share.linkedin', 'LinkedIn'),
      farcaster: t('share.farcaster', 'Farcaster'),
      share: t('share.share', 'Share'),
      copied: t('share.copied', 'Copied'),
      copyFailed: t('share.copyFailed', 'Could not copy link')
    };
  }

  function locale(value) {
    return String(value || '').toLowerCase() === 'tr' ? 'tr' : 'en';
  }

  function siteOrigin() {
    const site = global.KolTiginI18n && global.KolTiginI18n.site;
    const raw = site && site.canonicalUrl;
    if (raw) return String(raw).replace(/\/+$/, '');
    if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
      return String(location.origin).replace(/\/+$/, '');
    }
    return 'https://koltigin.xyz';
  }

  function writingShareUrl(lang, kind, id) {
    const loc = locale(lang);
    const type = String(kind || '').trim();
    const slug = String(id || '').trim();
    return `${siteOrigin()}/writings/${loc}/${encodeURIComponent(type)}/${encodeURIComponent(slug)}/`;
  }

  function guideShareUrl(lang, id) {
    const code = locale(lang) === 'tr' ? 'TR' : 'EN';
    const slug = String(id || '').trim();
    return `${siteOrigin()}/guides/${encodeURIComponent(slug)}/${code}`;
  }

  function composeText(title, url) {
    const headline = String(title || '').trim();
    return headline ? `${headline}\n${url}` : url;
  }

  function intentUrls({ title, url }) {
    const pageUrl = String(url || '');
    const encodedUrl = encodeURIComponent(pageUrl);
    const encodedTitle = encodeURIComponent(String(title || ''));
    const encodedCompose = encodeURIComponent(composeText(title, pageUrl));
    return {
      x: `https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      farcaster: `${FARCASTER_COMPOSE}?text=${encodedCompose}`,
      warpcast: `${WARPCAST_COMPOSE}?text=${encodedCompose}`
    };
  }

  function escapeAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render({ title, url }) {
    const pageUrl = String(url || '');
    const headline = String(title || '');
    const urls = intentUrls({ title: headline, url: pageUrl });
    const L = labels();
    return `
      <div class="share-actions" data-share-actions data-share-url="${escapeAttr(pageUrl)}" data-share-title="${escapeAttr(headline)}">
        <a class="share-action" data-share-network="x" href="${escapeAttr(urls.x)}" target="_blank" rel="noopener noreferrer">${escapeAttr(L.x)}</a>
        <a class="share-action" data-share-network="linkedin" href="${escapeAttr(urls.linkedin)}" target="_blank" rel="noopener noreferrer">${escapeAttr(L.linkedin)}</a>
        <a class="share-action" data-share-network="farcaster" href="${escapeAttr(urls.farcaster)}" target="_blank" rel="noopener noreferrer">${escapeAttr(L.farcaster)}</a>
        <button type="button" class="share-action" data-share-native>${escapeAttr(L.share)}</button>
      </div>
    `;
  }

  function copyWithExecCommand(text) {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    if (!ok) throw new Error('copy failed');
  }

  async function copyText(text, deps) {
    const clipboard = deps && deps.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(text);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return;
    }
    if (deps && typeof deps.execCommandCopy === 'function') {
      deps.execCommandCopy(text);
      return;
    }
    copyWithExecCommand(text);
  }

  async function shareNative({ title, url }, deps) {
    const payload = { title: String(title || ''), url: String(url || '') };
    const shareFn = deps && typeof deps.share === 'function'
      ? deps.share
      : (typeof navigator !== 'undefined' && typeof navigator.share === 'function'
        ? navigator.share.bind(navigator)
        : null);

    if (shareFn) {
      try {
        await shareFn(payload);
        return { ok: true, method: 'share' };
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return { ok: true, method: 'share-cancel' };
        }
      }
    }

    try {
      await copyText(payload.url, deps);
      return { ok: true, method: 'clipboard' };
    } catch (err) {
      return { ok: false, method: 'clipboard', error: err };
    }
  }

  function setNativeLabel(button, text) {
    if (button) button.textContent = text;
  }

  function bind(root) {
    const scope = root || document;
    const L = labels();
    scope.querySelectorAll('[data-share-actions]').forEach((bar) => {
      if (bar.dataset.shareBound === '1') return;
      bar.dataset.shareBound = '1';
      const button = bar.querySelector('[data-share-native]');
      if (!button) return;
      button.addEventListener('click', async () => {
        const url = bar.getAttribute('data-share-url') || '';
        const title = bar.getAttribute('data-share-title') || '';
        const result = await shareNative({ title, url });
        if (result.ok && result.method === 'clipboard') {
          setNativeLabel(button, L.copied);
          window.setTimeout(() => setNativeLabel(button, L.share), 1600);
          return;
        }
        if (!result.ok) {
          setNativeLabel(button, L.copyFailed);
          window.setTimeout(() => setNativeLabel(button, L.share), 2200);
        }
      });
    });
  }

  global.KolTiginShareActions = {
    siteOrigin,
    writingShareUrl,
    guideShareUrl,
    intentUrls,
    render,
    shareNative,
    bind,
    labels
  };
})(typeof window !== 'undefined' ? window : globalThis);
