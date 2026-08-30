'use strict';

const VIDEOS_DIR = './content/videos/';
const VIDEOS_PAGE_SIZE = 8;
const VIDEOS_TIMEZONE = 'Europe/Istanbul';

function videosT(key, vars, fallback) {
  return window.KolTiginI18n ? window.KolTiginI18n.t(key, vars, fallback) : (fallback || key);
}

function videosDateLocale() {
  const lang = window.KolTiginI18n && window.KolTiginI18n.language;
  return lang === 'en' ? 'en-GB' : 'tr-TR';
}

function parseFrontMatter(text) {
  const match = String(text || '').match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { metadata: {}, body: String(text || '') };

  const metadata = {};
  match[1].split('\n').forEach((line) => {
    const colonIndex = line.indexOf(':');
    if (colonIndex < 0) return;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    if (value === 'true') metadata[key] = true;
    else if (value === 'false') metadata[key] = false;
    else metadata[key] = value;
  });

  return { metadata, body: match[2] };
}

function isDateOnlyPublishedAt(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function parseVideoTimestamp(value) {
  if (!value || typeof value !== 'string') return 0;
  const raw = value.trim();
  if (isDateOnlyPublishedAt(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const time = Date.UTC(year, month - 1, day);
    return Number.isNaN(time) ? 0 : time;
  }
  const time = Date.parse(raw);
  return Number.isNaN(time) ? 0 : time;
}

function padTimeUnit(value) {
  return String(value).padStart(2, '0');
}

function formatIstanbulClock24(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: VIDEOS_TIMEZONE
  }).formatToParts(date);
  const hour = (parts.find((part) => part.type === 'hour') || {}).value;
  const minute = (parts.find((part) => part.type === 'minute') || {}).value;
  if (hour == null || minute == null) return '';
  return padTimeUnit(hour) + ':' + padTimeUnit(minute);
}

function formatVideoDuration(value) {
  if (!value || typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  const units = raw.split(':');
  if (!units.length || units.some((unit) => !/^\d+$/.test(unit))) return raw;
  return units.map(padTimeUnit).join(':');
}

function formatTurkishDate(date, timeZone) {
  return new Intl.DateTimeFormat(videosDateLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone
  }).format(date);
}

function formatVideoDate(value) {
  if (!value || typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';

  if (isDateOnlyPublishedAt(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const calendarDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (Number.isNaN(calendarDay.getTime())) return '';
    return formatTurkishDate(calendarDay, 'UTC');
  }

  const time = parseVideoTimestamp(raw);
  if (!time) return '';
  const date = new Date(time);
  const dateLabel = formatTurkishDate(date, VIDEOS_TIMEZONE);
  const timeLabel = formatIstanbulClock24(date);
  return timeLabel ? dateLabel + ' · ' + timeLabel + ' (UTC+3)' : dateLabel;
}

function isValidYoutubeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(id);
}

function youtubeIdFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,20})/i,
    /[?&]v=([A-Za-z0-9_-]{6,20})/i,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/i
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return '';
}

function youtubeThumbnailUrl(id) {
  return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
}

function youtubeWatchUrl(id) {
  return 'https://www.youtube.com/watch?v=' + id;
}

function youtubeEmbedUrl(id) {
  return 'https://www.youtube.com/embed/' + id;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uniqueMarkdownFiles(files) {
  return [...new Set(files.filter((name) => /\.md$/i.test(name)))];
}

async function readVideoManifest() {
  try {
    const response = await fetch('./content/index.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return uniqueMarkdownFiles(Array.isArray(data.videos) ? data.videos : []);
  } catch {
    return [];
  }
}

function normalizeVideoRecord(entry, body) {
  if (!entry || typeof entry !== 'object') return null;
  const youtubeId = (typeof entry.youtubeId === 'string' && entry.youtubeId.trim())
    || youtubeIdFromUrl(entry.youtubeUrl);
  if (!isValidYoutubeId(youtubeId)) return null;

  const tagsSource = Array.isArray(entry.tags) ? entry.tags : [];
  const tags = tagsSource.map((tag) => String(tag).trim()).filter(Boolean);
  const duration = typeof entry.duration === 'string' ? entry.duration.trim() : '';
  const description = typeof entry.description === 'string' ? entry.description.trim() : '';
  const youtubeUrl = typeof entry.youtubeUrl === 'string' && entry.youtubeUrl.trim()
    ? entry.youtubeUrl.trim()
    : youtubeWatchUrl(youtubeId);
  const date = typeof entry.date === 'string' ? entry.date.trim() : '';
  const publishedAt = typeof entry.publishedAt === 'string' ? entry.publishedAt.trim() : '';

  return {
    youtubeId,
    youtubeUrl,
    title: typeof entry.title === 'string' ? entry.title.trim() : '',
    titleEn: typeof entry.title_en === 'string' ? entry.title_en.trim() : '',
    titleTr: typeof entry.title_tr === 'string' ? entry.title_tr.trim() : '',
    date,
    publishedAt,
    duration,
    description,
    tags,
    language: typeof entry.language === 'string' ? entry.language.trim() : '',
    category: typeof entry.category === 'string' ? entry.category.trim() : '',
    body: body || ''
  };
}

function videoDisplayTitle(video) {
  const lang = window.KolTiginI18n && window.KolTiginI18n.language;
  if (lang === 'tr') return (video && (video.titleTr || video.title)) || '';
  return (video && (video.titleEn || video.title)) || '';
}

function sortVideosNewestFirst(videos) {
  const locale = window.KolTiginI18n && window.KolTiginI18n.language === 'en' ? 'en' : 'tr';
  return videos.slice().sort((a, b) => {
    const right = parseVideoTimestamp(b.publishedAt || b.date);
    const left = parseVideoTimestamp(a.publishedAt || a.date);
    if (right !== left) return right - left;
    return String(videoDisplayTitle(a)).localeCompare(String(videoDisplayTitle(b)), locale, { sensitivity: 'base' });
  });
}

class VideosParser {
  constructor() {
    this.sourceVideos = [];
    this.sortedVideos = [];
    this.visibleCount = 0;
    this.videosSection = document.querySelector('.videos');
    this.videosList = document.querySelector('.videos-posts-list');
    this.loadMoreWrap = document.querySelector('[data-videos-more]');
    this.loadMoreBtn = document.querySelector('[data-videos-more-btn]');

    if (this.videosSection && this.videosList) {
      this.bindEvents();
      if (window.KolTiginI18n && window.KolTiginI18n.ready) {
        window.KolTiginI18n.ready.then(() => this.init()).catch(() => this.init());
      } else {
        this.init();
      }
    }
  }

  bindEvents() {
    if (this.loadMoreBtn) {
      this.loadMoreBtn.addEventListener('click', () => this.showMore());
    }

    this.videosList.addEventListener('click', (event) => {
      const item = event.target.closest('.video-item');
      if (!item || !this.videosList.contains(item)) return;
      event.preventDefault();
      openVideoModal(
        item.getAttribute('data-youtube-id'),
        item.getAttribute('data-video-title'),
        item.getAttribute('data-youtube-url')
      );
    });

    this.videosList.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const item = event.target.closest('.video-item');
      if (!item || !this.videosList.contains(item)) return;
      event.preventDefault();
      openVideoModal(
        item.getAttribute('data-youtube-id'),
        item.getAttribute('data-video-title'),
        item.getAttribute('data-youtube-url')
      );
    });
  }

  async init() {
    await this.loadVideos();
  }

  async loadVideos() {
    try {
      this.videosList.innerHTML = `<li class="videos-status">${videosT('videos.loading', null, 'Loading videos...')}</li>`;
      this.setLoadMoreVisible(false);

      const files = await readVideoManifest();
      const records = [];

      for (const file of files) {
        try {
          const response = await fetch(VIDEOS_DIR + encodeURIComponent(file), { cache: 'no-store' });
          if (!response.ok) continue;
          const raw = await response.text();
          const { metadata, body } = parseFrontMatter(raw);
          const video = normalizeVideoRecord(metadata, body);
          if (video) records.push(video);
        } catch {
          // Skip unreadable files; remaining videos still render.
        }
      }

      this.sourceVideos = records;
      this.sortedVideos = sortVideosNewestFirst(this.sourceVideos);
      this.visibleCount = 0;
      this.videosList.innerHTML = '';

      if (this.sortedVideos.length === 0) {
        this.showError(videosT('videos.empty', null, 'No videos found.'));
        return;
      }

      this.showMore();
    } catch (error) {
      this.showError(videosT('videos.loadError', null, 'An error occurred while loading videos.'));
    }
  }

  applyLanguage() {
    if (!this.sourceVideos.length) {
      this.loadVideos();
      return;
    }
    const keep = this.visibleCount || VIDEOS_PAGE_SIZE;
    this.sortedVideos = sortVideosNewestFirst(this.sourceVideos);
    this.visibleCount = 0;
    this.videosList.innerHTML = '';
    while (this.visibleCount < keep && this.visibleCount < this.sortedVideos.length) {
      this.showMore();
    }
    if (this.loadMoreBtn) {
      this.loadMoreBtn.textContent = videosT('videos.loadMore', null, 'Show More');
    }
  }

  showMore() {
    const nextCount = Math.min(this.visibleCount + VIDEOS_PAGE_SIZE, this.sortedVideos.length);
    const fragment = document.createDocumentFragment();
    const batch = this.sortedVideos.slice(this.visibleCount, nextCount);

    batch.forEach((video) => {
      fragment.appendChild(this.createVideoItem(video));
    });

    this.videosList.appendChild(fragment);
    this.visibleCount = nextCount;
    this.setLoadMoreVisible(this.visibleCount < this.sortedVideos.length);
  }

  setLoadMoreVisible(visible) {
    if (!this.loadMoreWrap) return;
    this.loadMoreWrap.hidden = !visible;
  }

  createVideoItem(video) {
    const item = document.createElement('li');
    item.className = 'video-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('data-youtube-id', video.youtubeId);
    item.setAttribute('data-youtube-url', video.youtubeUrl || youtubeWatchUrl(video.youtubeId));
    item.setAttribute('data-video-title', videoDisplayTitle(video) || videosT('videos.untitled', null, 'Video'));

    const thumbSrc = youtubeThumbnailUrl(video.youtubeId);
    const dateSource = video.publishedAt || video.date;
    const dateLabel = formatVideoDate(dateSource);
    const durationLabel = formatVideoDuration(video.duration);
    const title = videoDisplayTitle(video) || videosT('videos.untitled', null, 'Video');
    item.setAttribute('aria-label', title);

    let metaHtml = '';
    if (dateLabel) {
      metaHtml += `
        <div class="video-meta">
          <ion-icon name="calendar-outline"></ion-icon>
          <time datetime="${escapeHtml(video.date || dateSource)}">${escapeHtml(dateLabel)}</time>
        </div>`;
    }
    if (durationLabel) {
      metaHtml += `
        <div class="video-meta video-meta--duration">
          <ion-icon name="time-outline"></ion-icon>
          <span>${escapeHtml(videosT('videos.duration', { duration: durationLabel }, 'Duration: {duration}'))}</span>
        </div>`;
    }

    const tagsHtml = video.tags.length
      ? `<div class="video-detail-technologies">
          <div class="tech-tags">
            ${video.tags.map((tag) => `<span class="tech-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>`
      : '';

    const descriptionHtml = video.description
      ? `<p class="video-detail-description">${escapeHtml(video.description)}</p>`
      : '';

    item.innerHTML = `
      <div class="video-thumb-wrap">
        <div class="video-thumbnail">
          <img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
          <div class="play-button">
            <ion-icon name="play-circle"></ion-icon>
          </div>
        </div>
      </div>
      ${metaHtml ? `<div class="video-meta-box">${metaHtml}</div>` : ''}
      <h3 class="h3 video-item-title">${escapeHtml(title)}</h3>
      ${descriptionHtml}
      ${tagsHtml}
    `;

    const img = item.querySelector('img');
    if (img) {
      img.addEventListener('error', () => {
        img.remove();
      });
    }

    return item;
  }

  showError(message) {
    this.videosList.innerHTML = `
      <li class="videos-status">
        <p>${escapeHtml(message)}</p>
      </li>
    `;
    this.setLoadMoreVisible(false);
  }
}

function closeVideoModal() {
  const modal = document.querySelector('.video-modal-overlay');
  if (!modal) return;
  const iframe = modal.querySelector('iframe');
  if (iframe) iframe.src = '';
  modal.remove();
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onVideoModalKeydown);
  if (window._videoModalLastFocus && typeof window._videoModalLastFocus.focus === 'function') {
    window._videoModalLastFocus.focus();
  }
  window._videoModalLastFocus = null;
}

function videoModalFocusable(modal) {
  return [...modal.querySelectorAll('button, a[href], iframe')].filter((el) => !el.hasAttribute('disabled'));
}

function onVideoModalKeydown(event) {
  if (event.key === 'Escape') {
    closeVideoModal();
    return;
  }
  if (event.key !== 'Tab') return;
  const modal = document.querySelector('.video-modal-overlay');
  if (!modal) return;
  const focusable = videoModalFocusable(modal);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openVideoModal(youtubeId, title, youtubeUrl) {
  if (!isValidYoutubeId(youtubeId)) return;
  closeVideoModal();
  window._videoModalLastFocus = document.activeElement;

  const watchUrl = youtubeUrl || youtubeWatchUrl(youtubeId);
  const heading = title || videosT('videos.untitled', null, 'Video');
  const modal = document.createElement('div');
  modal.className = 'video-modal-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'video-modal-title');
  modal.innerHTML = `
    <div class="video-modal-content">
      <div class="video-modal-header">
        <h3 id="video-modal-title">${escapeHtml(heading)}</h3>
        <button type="button" class="video-modal-close" data-video-modal-close aria-label="${escapeHtml(videosT('videos.close', null, 'Close video'))}">
          <ion-icon name="close" aria-hidden="true"></ion-icon>
        </button>
      </div>
      <div class="video-modal-body">
        <div class="video-modal-frame">
          <iframe src="${escapeHtml(youtubeEmbedUrl(youtubeId))}"
                  title="${escapeHtml(heading)}"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen></iframe>
        </div>
        <a class="video-modal-youtube" href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">${videosT('videos.openYoutube', null, 'Open on YouTube')}</a>
      </div>
    </div>
  `;

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-video-modal-close]')) {
      closeVideoModal();
    }
  });

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onVideoModalKeydown);
  modal.querySelector('[data-video-modal-close]')?.focus();
}

function initializeVideos() {
  if (window.videosParser) return;
  const videosSection = document.querySelector('.videos');
  const videosList = document.querySelector('.videos-posts-list');
  if (!videosSection || !videosList) return;
  window.videosParser = new VideosParser();
}

document.addEventListener('DOMContentLoaded', initializeVideos);

if (window.KolTiginI18n) {
  window.KolTiginI18n.onChange(() => {
    if (window.videosParser && typeof window.videosParser.applyLanguage === 'function') {
      window.videosParser.applyLanguage();
    }
  });
}

window.VideosParser = VideosParser;
window.initializeVideos = initializeVideos;
window.sortVideosNewestFirst = sortVideosNewestFirst;
window.parseFrontMatter = parseFrontMatter;
