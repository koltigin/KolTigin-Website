'use strict';

class AboutParser {
    constructor() {
        this.aboutData = null;
        this.aboutSection = null;
    }

    async init() {
        this.aboutSection = document.querySelector('.about[data-page="about"]');
        if (!this.aboutSection) return;
        if (window.KolTiginI18n && window.KolTiginI18n.ready) {
            await window.KolTiginI18n.ready;
        }
        await this.loadAbout();
    }

    contentPath() {
        const lang = (window.KolTiginI18n && window.KolTiginI18n.language) || 'en';
        return `./content/about/${lang}.md`;
    }

    async loadAbout() {
        try {
            const response = await fetch(`${this.contentPath()}?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.parseMarkdown(await response.text());
            this.renderAbout();
        } catch (error) {
            console.error('Error loading about:', error);
            this.showError();
        }
    }

    parseIconLine(line) {
        const match = line.match(/^icon:\s*(.+)$/i);
        if (!match) return '';
        return match[1].trim().replace(/^["']|["']$/g, '');
    }

    parseMarkdown(markdownText) {
        const cleanText = markdownText.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '');
        const lines = cleanText.split('\n');
        this.aboutData = { intro: [], services: [], servicesTitle: '' };

        let currentSection = 'intro';
        let currentItem = {};

        for (const raw of lines) {
            const line = raw.trim();

            if (line.startsWith('###')) {
                if (currentSection === 'services') {
                    if (currentItem.title) this.aboutData.services.push(currentItem);
                    const title = line.replace(/^###\s*/, '').trim();
                    currentItem = { title, description: '', icon: '' };
                }
            } else if (line.startsWith('##')) {
                if (currentItem.title) {
                    this.aboutData.services.push(currentItem);
                    currentItem = {};
                }
                this.aboutData.servicesTitle = line.replace(/^##\s*/, '').trim();
                currentSection = 'services';
            } else if (currentSection === 'services' && currentItem.title && this.parseIconLine(line)) {
                currentItem.icon = this.parseIconLine(line);
            } else if (line.length > 0 && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-')) {
                if (currentSection === 'services' && currentItem.title) {
                    currentItem.description += (currentItem.description ? ' ' : '') + line;
                } else if (currentSection === 'intro') {
                    this.aboutData.intro.push(line);
                }
            }
        }

        if (currentItem.title) this.aboutData.services.push(currentItem);
    }

    renderAbout() {
        if (!this.aboutData || !this.aboutSection) return;
        this.aboutSection.querySelectorAll('.about-text, .service, .error-message').forEach((el) => el.remove());
        const t = window.KolTiginI18n ? window.KolTiginI18n.t.bind(window.KolTiginI18n) : (key, _v, fb) => fb || key;
        const pageTitle = t('pages.about', null, 'About');
        const headerTitle = this.aboutSection.querySelector('header .article-title');
        if (headerTitle) headerTitle.textContent = pageTitle;

        const contentHTML = `
            <section class="about-text">
                ${this.aboutData.intro.map((paragraph) => `<p>${this.parseMarkdownText(paragraph)}</p>`).join('')}
            </section>
            <section class="service">
                <h3 class="h3 service-title">${this.parseMarkdownText(this.aboutData.servicesTitle)}</h3>
                <ul class="service-list">
                    ${this.aboutData.services.map(service => `
                        <li class="service-item">
                            <div class="service-icon-box">
                                ${this.renderServiceIcon(service.icon)}
                            </div>
                            <div class="service-content-box">
                                <h4 class="h4 service-item-title">${service.title}</h4>
                                <p class="service-item-text">${this.parseMarkdownText(service.description)}</p>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </section>
        `;

        const header = this.aboutSection.querySelector('header');
        if (header) header.insertAdjacentHTML('afterend', contentHTML);
        else this.aboutSection.innerHTML = contentHTML;
    }

    renderServiceIcon(icon) {
        const value = String(icon || '').trim();
        if (!value) return '';
        if (/\.svg(\?|$)/i.test(value) || value.includes('/assets/') || value.startsWith('./')) {
            return `<img src="${value}" alt="" width="40" loading="lazy" decoding="async">`;
        }
        if (/^[a-z0-9-]+$/i.test(value)) {
            return `<ion-icon name="${value}"></ion-icon>`;
        }
        return '';
    }

    parseMarkdownText(text) {
        return (text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    showError() {
        if (!this.aboutSection) return;
        const t = window.KolTiginI18n ? window.KolTiginI18n.t.bind(window.KolTiginI18n) : (key, _v, fb) => fb || key;
        this.aboutSection.innerHTML = `
            <header><h2 class="h2 article-title">${t('pages.about', null, 'About')}</h2></header>
            <p class="error-message">${t('about.loadError', null, 'The about page could not be loaded.')}</p>
        `;
    }
}

window.AboutParser = AboutParser;

function initializeAbout(force) {
    const aboutSection = document.querySelector('.about[data-page="about"]');
    if (!aboutSection) return;
    if (!window.aboutParser) window.aboutParser = new AboutParser();
    if (!force && aboutSection.querySelector('.about-text')) return;
    window.aboutParser.init();
}

document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('.about.active')) {
        setTimeout(() => initializeAbout(true), 50);
    }
});

if (window.KolTiginI18n) {
    window.KolTiginI18n.onChange(() => initializeAbout(true));
}
