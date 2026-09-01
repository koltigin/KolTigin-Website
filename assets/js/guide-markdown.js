'use strict';

window.KolTiginGuideMarkdown = {
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  headingId(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  },

  parseInline(text, guideId) {
    let html = this.escapeHtml(text);
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const href = this.escapeHtml(src.trim());
      if (!/^(https?:|\/|\.\/|assets\/)/i.test(src.trim())) return _;
      return `<img src="${href}" alt="${this.escapeHtml(alt)}" loading="lazy">`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const trimmed = href.trim();
      if (/^(TR|EN)\.md$/i.test(trimmed)) {
        const lang = trimmed.slice(0, 2).toUpperCase();
        return `<a href="#/guides/${this.escapeHtml(guideId)}/${lang}" data-guide-lang="${lang}">${label}</a>`;
      }
      const safeHref = this.escapeHtml(trimmed);
      const external = /^https?:\/\//i.test(trimmed) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${safeHref}"${external}>${label}</a>`;
    });
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (_, prefix, url) => {
      const clean = url.replace(/[).,;]+$/, '');
      return `${prefix}<a href="${this.escapeHtml(clean)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(clean)}</a>`;
    });
    return html;
  },

  renderCodeBlock(code, lang, copyLabel) {
    const language = this.escapeHtml(lang || 'text');
    return `
      <div class="guide-code-wrap">
        <div class="guide-code-meta">
          <span>${language}</span>
          <button type="button" class="guide-copy-btn" data-copy-code>${this.escapeHtml(copyLabel || 'Copy')}</button>
        </div>
        <pre><code>${this.escapeHtml(code)}</code></pre>
      </div>
    `;
  },

  render(markdown, options) {
    const guideId = (options && options.guideId) || '';
    const copyLabel = (options && options.copyLabel) || 'Copy';
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) {
        const lang = line.replace(/^```/, '').trim();
        const code = [];
        i += 1;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(lines[i]);
          i += 1;
        }
        i += 1;
        html.push(this.renderCodeBlock(code.join('\n'), lang, copyLabel));
        continue;
      }
      if (/^#{1,6} /.test(line)) {
        const level = line.match(/^#+/)[0].length;
        const title = line.slice(level + 1);
        const id = this.headingId(title);
        html.push(`<h${level} id="${this.escapeHtml(id)}">${this.parseInline(title, guideId)}</h${level}>`);
        i += 1;
        continue;
      }
      if (/^(-{3,}|_{3,})$/.test(line.trim())) {
        html.push('<hr>');
        i += 1;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ''));
          i += 1;
        }
        html.push(`<blockquote><p>${this.parseInline(quote.join(' '), guideId)}</p></blockquote>`);
        continue;
      }
      if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
        const ordered = /^\d+\. /.test(line);
        const items = [];
        while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^[-*] /.test(lines[i]))) {
          items.push(`<li>${this.parseInline(lines[i].replace(/^(?:[-*]|\d+\.)\s/, ''), guideId)}</li>`);
          i += 1;
        }
        html.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
        continue;
      }
      if (!line.trim()) {
        i += 1;
        continue;
      }
      const paragraph = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^#{1,6} /.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) &&
        !/^[-*] /.test(lines[i]) &&
        !/^\d+\. /.test(lines[i]) &&
        !/^(-{3,}|_{3,})$/.test(lines[i].trim())
      ) {
        paragraph.push(lines[i]);
        i += 1;
      }
      html.push(`<p>${this.parseInline(paragraph.join(' '), guideId)}</p>`);
    }
    return html.join('\n');
  }
};
