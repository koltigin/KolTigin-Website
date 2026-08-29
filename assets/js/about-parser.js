class AboutParser {
    constructor() {
        this.aboutData = null;
        this.aboutSection = null;
    }

    async init() {
        this.aboutSection = document.querySelector('.about[data-page="about"]');
        if (!this.aboutSection) return;
        await this.loadAbout();
    }

    async loadAbout() {
        try {
            const response = await fetch('./about.md');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.parseMarkdown(await response.text());
            this.renderAbout();
        } catch (error) {
            console.error('Error loading about:', error);
            this.showError();
        }
    }

    parseMarkdown(markdownText) {
        const cleanText = markdownText.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '');
        const lines = cleanText.split('\n');
        this.aboutData = { summary: '', background: [], services: [] };

        let currentSection = '';
        let currentItem = {};
        let summaryFound = false;

        for (const raw of lines) {
            const line = raw.trim();

            if (line.startsWith('###')) {
                if (currentSection === 'services') {
                    if (currentItem.title) this.aboutData.services.push(currentItem);
                    const title = line.replace(/^###\s*/, '').trim();
                    currentItem = { title, description: '', icon: this.getServiceIcon(title) };
                }
            } else if (line.startsWith('##')) {
                if (currentItem.title) {
                    this.aboutData.services.push(currentItem);
                    currentItem = {};
                }
                const heading = line.toLowerCase();
                if (heading.includes('background') || heading.includes('geçmiş')) {
                    currentSection = 'background';
                } else if (heading.includes("what i'm doing") || heading.includes('ne yapıyorum')) {
                    currentSection = 'services';
                } else {
                    currentSection = 'other';
                }
            } else if (line.length > 0 && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-')) {
                if (!summaryFound && currentSection === '') {
                    this.aboutData.summary = line;
                    summaryFound = true;
                } else if (currentSection === 'background') {
                    this.aboutData.background.push(line);
                } else if (currentSection === 'services' && currentItem.title) {
                    currentItem.description += (currentItem.description ? ' ' : '') + line;
                }
            }
        }

        if (currentItem.title) this.aboutData.services.push(currentItem);
    }

    getServiceIcon(serviceTitle) {
        const customIcons = {
            'Validator Operasyonu': './assets/images/icon-dev.svg',
            'Teknik Rehberler': './assets/images/icon-app.svg',
            'DeFi & Ekosistem': './assets/images/icon-photo.svg',
            'Araştırma & İçerik': './assets/images/icon-design.svg'
        };
        if (customIcons[serviceTitle]) return customIcons[serviceTitle];

        const title = serviceTitle.toLowerCase();
        if (title.includes('validator') || title.includes('operasyon')) return './assets/images/icon-dev.svg';
        if (title.includes('rehber') || title.includes('node')) return './assets/images/icon-app.svg';
        if (title.includes('içerik') || title.includes('video')) return './assets/images/icon-photo.svg';
        if (title.includes('araştırma') || title.includes('research')) return './assets/images/icon-design.svg';
        return './assets/images/icon-design.svg';
    }

    renderAbout() {
        if (!this.aboutData || this.aboutSection.querySelector('.about-text')) return;

        const contentHTML = `
            <section class="about-text">
                <p>${this.parseMarkdownText(this.aboutData.summary)}</p>
                ${this.aboutData.background.map(paragraph => `<p>${this.parseMarkdownText(paragraph)}</p>`).join('')}
            </section>
            <section class="service">
                <h3 class="h3 service-title">Ne yapıyorum</h3>
                <ul class="service-list">
                    ${this.aboutData.services.map(service => `
                        <li class="service-item">
                            <div class="service-icon-box">
                                <img src="${service.icon}" alt="${service.title}" width="40">
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

    parseMarkdownText(text) {
        return (text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    showError() {
        if (!this.aboutSection) return;
        this.aboutSection.innerHTML = `
            <header><h2 class="h2 article-title">Hakkında</h2></header>
            <p class="error-message">Hakkında sayfası yüklenemedi.</p>
        `;
    }
}

window.AboutParser = AboutParser;

function initializeAbout() {
    const aboutSection = document.querySelector('.about[data-page="about"]');
    if (aboutSection && aboutSection.querySelector('.about-text')) return;
    new AboutParser().init();
}

document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('.about.active')) {
        setTimeout(initializeAbout, 50);
    }
});
