(function () {
    const CONFIG = {
        owner: 'koltigin',
        repo: 'KolTigin-Website',
        branch: 'main',
        locale: 'tr',
        cacheKey: 'koltigin-website-last-commit',
        cacheTtlMs: 6 * 60 * 60 * 1000
    };

    const LOCALE_MAP = {
        tr: 'tr-TR',
        en: 'en-GB'
    };

    function formatVisibleDate(iso, localeKey) {
        const locale = LOCALE_MAP[localeKey] || LOCALE_MAP.tr;
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(new Date(iso));
    }

    function toDatetimeValue(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString();
    }

    function applyDate(iso) {
        const timeEl = document.querySelector('[data-last-update]');
        if (!timeEl) return;
        const datetimeValue = toDatetimeValue(iso);
        if (!datetimeValue) return;
        timeEl.setAttribute('datetime', datetimeValue);
        timeEl.textContent = formatVisibleDate(iso, CONFIG.locale);
    }

    function readCache() {
        try {
            const raw = localStorage.getItem(CONFIG.cacheKey);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data.iso !== 'string' || typeof data.cachedAt !== 'number') return null;
            if (Date.now() - data.cachedAt > CONFIG.cacheTtlMs) return null;
            if (Number.isNaN(new Date(data.iso).getTime())) return null;
            return data.iso;
        } catch (error) {
            return null;
        }
    }

    function writeCache(iso) {
        try {
            localStorage.setItem(CONFIG.cacheKey, JSON.stringify({
                iso: iso,
                cachedAt: Date.now()
            }));
        } catch (error) {
            // ignore quota / private mode
        }
    }

    async function fetchLatestCommitIso() {
        const url = 'https://api.github.com/repos/'
            + encodeURIComponent(CONFIG.owner) + '/'
            + encodeURIComponent(CONFIG.repo)
            + '/commits?sha=' + encodeURIComponent(CONFIG.branch)
            + '&per_page=1';

        const response = await fetch(url, {
            headers: { Accept: 'application/vnd.github+json' }
        });

        if (!response.ok) {
            throw new Error('github-commits-unavailable');
        }

        const commits = await response.json();
        const iso = commits && commits[0] && commits[0].commit && commits[0].commit.committer
            ? commits[0].commit.committer.date
            : null;

        if (!iso) {
            throw new Error('github-commits-empty');
        }

        return iso;
    }

    async function initLastUpdate() {
        const cachedIso = readCache();
        if (cachedIso) {
            applyDate(cachedIso);
            return;
        }

        try {
            const iso = await fetchLatestCommitIso();
            writeCache(iso);
            applyDate(iso);
        } catch (error) {
            // Keep HTML fallback. Repo may not exist yet.
        }
    }

    window.KolTiginLastUpdate = {
        setLocale: function (localeKey) {
            if (!LOCALE_MAP[localeKey]) return;
            CONFIG.locale = localeKey;
            const cachedIso = readCache();
            if (cachedIso) applyDate(cachedIso);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLastUpdate);
    } else {
        initLastUpdate();
    }
})();
