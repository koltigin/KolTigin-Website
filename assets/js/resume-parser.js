'use strict';

class ResumeParser {
  constructor() {
    this.resumeData = null;
    this.resumeSection = null;
  }

  async init() {
    this.resumeSection = document.querySelector('.resume[data-page="resume"]');
    if (!this.resumeSection) return;
    if (window.KolTiginI18n && window.KolTiginI18n.ready) {
      await window.KolTiginI18n.ready;
    }
    await this.loadResume();
  }

  contentPath() {
    const lang = (window.KolTiginI18n && window.KolTiginI18n.language) || 'en';
    return `./content/resume/${lang}.md`;
  }

  t(key, fallback) {
    return window.KolTiginI18n ? window.KolTiginI18n.t(key, null, fallback) : fallback || key;
  }

  async loadResume() {
    try {
      const response = await fetch(this.contentPath(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      this.parseMarkdown(await response.text());
      this.renderResume();
    } catch (error) {
      console.error('Error loading resume:', error);
      this.showError();
    }
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  parseMarkdown(markdownText) {
    const lines = markdownText.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '').split('\n');
    this.resumeData = {
      summary: [],
      experience: [],
      education: [],
      focus: [],
      tools: []
    };

    let currentSection = '';
    let currentItem = null;

    const flushItem = () => {
      if (!currentItem) return;
      if (currentSection === 'experience' || currentSection === 'education') {
        this.resumeData[currentSection].push(currentItem);
      }
      currentItem = null;
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('# ') || line.startsWith('---')) continue;

      if (line.startsWith('###')) {
        flushItem();
        const heading = line.replace(/^###\s*/, '').trim();
        if (currentSection === 'experience') {
          currentItem = { company: heading, role: '', date: '', description: '' };
        } else if (currentSection === 'education') {
          currentItem = { title: heading, date: '', researchLabel: '', research: '' };
        }
        continue;
      }

      if (line.startsWith('##')) {
        flushItem();
        const heading = line.replace(/^##\s*/, '').trim().toLowerCase();
        if (heading.includes('özet') || heading.includes('summary')) currentSection = 'summary';
        else if (heading.includes('deneyim') || heading.includes('experience')) currentSection = 'experience';
        else if (heading.includes('eğitim') || heading.includes('education')) currentSection = 'education';
        else if (heading.includes('araç') || heading.includes('yetkinlik')) currentSection = 'tools';
        else if (heading.includes('odak') || heading.includes('focus')) currentSection = 'focus';
        else currentSection = '';
        continue;
      }

      if (currentSection === 'summary') {
        this.resumeData.summary.push(line);
        continue;
      }

      if (currentSection === 'focus' && line.startsWith('-')) {
        this.resumeData.focus.push(line.replace(/^-\s*/, '').trim());
        continue;
      }

      if (currentSection === 'tools' && line.startsWith('-')) {
        this.resumeData.tools.push(line.replace(/^-\s*/, '').trim());
        continue;
      }

      if (!currentItem) continue;

      const roleDate = line.match(/^\*\*(.+?)\*\*\s*\|\s*\*(.+?)\*\s*$/);
      if (roleDate && currentSection === 'experience') {
        currentItem.role = roleDate[1].trim();
        currentItem.date = roleDate[2].trim();
        continue;
      }

      const research = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (research && currentSection === 'education') {
        currentItem.researchLabel = research[1].replace(/:$/, '').trim();
        currentItem.research = research[2].trim();
        continue;
      }

      if (line.startsWith('*') && line.endsWith('*') && (currentSection === 'education' || currentSection === 'experience')) {
        currentItem.date = line.replace(/^\*|\*$/g, '').trim();
        continue;
      }

      if (currentSection === 'experience') {
        currentItem.description += (currentItem.description ? ' ' : '') + line;
      }
    }

    flushItem();
  }

  sectionHeading(icon, title) {
    return `
      <div class="title-wrapper">
        <div class="icon-box" aria-hidden="true">
          <ion-icon name="${icon}"></ion-icon>
        </div>
        <h3 class="h3">${this.escapeHtml(title)}</h3>
      </div>
    `;
  }

  renderResume() {
    if (!this.resumeData || !this.resumeSection) return;

    this.resumeSection.innerHTML = `
      <header>
        <h2 class="h2 article-title">${this.escapeHtml(this.t('pages.resume', 'Resume'))}</h2>
      </header>
      ${this.renderSummary()}
      ${this.renderExperience()}
      ${this.renderEducation()}
      ${this.renderFocus()}
      ${this.renderTools()}
    `;
  }

  renderSummary() {
    if (!this.resumeData.summary.length) return '';
    const paragraphs = this.resumeData.summary
      .map((text) => `<p class="summary-text">${this.escapeHtml(text)}</p>`)
      .join('');
    return `
      <section class="resume-section summary">
        ${this.sectionHeading('person-outline', this.t('resume.summary', 'Summary'))}
        <div class="resume-summary-body">${paragraphs}</div>
      </section>
    `;
  }

  renderExperience() {
    if (!this.resumeData.experience.length) return '';
    const items = this.resumeData.experience.map((item) => `
      <li class="timeline-item">
        <h4 class="h4 timeline-item-title">${this.escapeHtml(item.company)}</h4>
        ${item.role ? `<p class="timeline-item-role">${this.escapeHtml(item.role)}</p>` : ''}
        ${item.date ? `<span class="timeline-item-date">${this.escapeHtml(item.date)}</span>` : ''}
        ${item.description ? `<p class="timeline-text">${this.escapeHtml(item.description)}</p>` : ''}
      </li>
    `).join('');

    return `
      <section class="resume-section timeline">
        ${this.sectionHeading('briefcase-outline', this.t('resume.experience', 'Deneyim'))}
        <ol class="timeline-list">
          ${items}
        </ol>
      </section>
    `;
  }

  renderEducation() {
    if (!this.resumeData.education.length) return '';
    const items = this.resumeData.education.map((item) => `
      <li class="timeline-item">
        <h4 class="h4 timeline-item-title">${this.escapeHtml(item.title)}</h4>
        ${item.date ? `<span class="timeline-item-date">${this.escapeHtml(item.date)}</span>` : ''}
        ${item.research ? `
          <p class="timeline-item-research">
            ${item.researchLabel ? `<span class="timeline-item-research-label">${this.escapeHtml(item.researchLabel)}</span>` : ''}
            <span class="timeline-item-research-value">${this.escapeHtml(item.research)}</span>
          </p>
        ` : ''}
      </li>
    `).join('');

    return `
      <section class="resume-section timeline">
        ${this.sectionHeading('school-outline', this.t('resume.education', 'Education'))}
        <ol class="timeline-list">
          ${items}
        </ol>
      </section>
    `;
  }

  renderFocus() {
    if (!this.resumeData.focus.length) return '';
    const tags = this.resumeData.focus.map((label) => `
      <li class="resume-focus-tag">${this.escapeHtml(label)}</li>
    `).join('');

    return `
      <section class="resume-section resume-focus">
        ${this.sectionHeading('layers-outline', this.t('resume.focus', 'Focus Areas'))}
        <ul class="resume-focus-list">${tags}</ul>
      </section>
    `;
  }

  renderTools() {
    if (!this.resumeData.tools.length) return '';
    const tags = this.resumeData.tools.map((label) => `
      <li class="resume-focus-tag">${this.escapeHtml(label)}</li>
    `).join('');

    return `
      <section class="resume-section resume-tools">
        ${this.sectionHeading('construct-outline', this.t('resume.tools', 'Tools & Skills'))}
        <ul class="resume-focus-list">${tags}</ul>
      </section>
    `;
  }

  showError() {
    if (!this.resumeSection) return;
    this.resumeSection.innerHTML = `
      <header>
        <h2 class="h2 article-title">${this.escapeHtml(this.t('pages.resume', 'Resume'))}</h2>
      </header>
      <div class="error-message">
        <p>${this.escapeHtml(this.t('resume.loadError', 'The resume could not be loaded.'))}</p>
      </div>
    `;
  }
}

window.ResumeParser = ResumeParser;

function initializeResume(force) {
  const resumeSection = document.querySelector('.resume[data-page="resume"]');
  if (!resumeSection) return;
  if (!window.resumeParser) window.resumeParser = new ResumeParser();
  if (!force && resumeSection.querySelector('.resume-section, .timeline, .summary')) return;
  window.resumeParser.init();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeResume();
});

if (window.KolTiginI18n) {
  window.KolTiginI18n.onChange(() => initializeResume(true));
}
