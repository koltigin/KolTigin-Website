// Resume Parser - Dinamik CV yönetim sistemi
class ResumeParser {
    constructor() {
        this.resumeData = null;
        this.resumeSection = null;
    }

    async init() {
        console.log('ResumeParser init started');
        this.resumeSection = document.querySelector('.resume[data-page="resume"]');
        console.log('Resume section:', this.resumeSection);
        if (!this.resumeSection) {
            console.log('Resume section not found');
            return;
        }

        await this.loadResume();
    }

    async loadResume() {
        try {
            const response = await fetch('./resume.md');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const markdownText = await response.text();
            this.parseMarkdown(markdownText);
            this.renderResume();
        } catch (error) {
            console.error('Error loading resume:', error);
            this.showError();
        }
    }

    parseMarkdown(markdownText) {
        const lines = markdownText.split('\n');
        this.resumeData = {
            title: '',
            summary: '',
            experience: [],
            education: [],
            skills: [],
            certifications: [],
            projects: [],
            languages: [],
            interests: []
        };

        let currentSection = '';
        let currentItem = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Debug: Tüm satırları logla
            if (line.startsWith('###')) {
                console.log('Found ### line at index', i, ':', line);
            }
            
            // Debug: İlk 20 satırı logla
            if (i < 20) {
                console.log('Line', i, ':', line);
            }

            // Front matter'ı atla
            if (line.startsWith('---')) continue;
            
            // ### kontrolü ## kontrolünden önce olmalı
            if (line.startsWith('###')) {
                // Alt başlıklar (iş pozisyonları, okullar vb.)
                console.log('Found ### line:', line);
                console.log('Current section:', currentSection);
                if (currentSection === 'experience' || currentSection === 'education') {
                    if (Object.keys(currentItem).length > 0) {
                        console.log('Pushing previous item:', currentItem);
                        console.log('Description:', currentItem.description);
                        this.resumeData[currentSection].push(currentItem);
                    }
                    currentItem = {
                        title: line.replace('###', '').trim(),
                        company: '',
                        date: '',
                        description: '',
                        achievements: []
                    };
                    console.log('New item created:', currentItem.title);
                } else {
                    console.log('Not in experience or education section, skipping');
                }
            } else if (line.startsWith('##')) {
                // Önceki section'daki item'ı ekle
                if (Object.keys(currentItem).length > 0 && (currentSection === 'experience' || currentSection === 'education')) {
                    console.log('Adding item to section before switching:', currentSection, currentItem);
                    this.resumeData[currentSection].push(currentItem);
                    currentItem = {};
                }
                
                // Section başlıkları
                if (line.includes('Professional Summary')) {
                    currentSection = 'summary';
                } else if (line.includes('Work Experience')) {
                    currentSection = 'experience';
                } else if (line.includes('Education')) {
                    currentSection = 'education';
                } else if (line.includes('Technical Skills')) {
                    currentSection = 'skills';
                } else if (line.includes('Certifications')) {
                    currentSection = 'certifications';
                } else if (line.includes('Projects')) {
                    currentSection = 'projects';
                } else if (line.includes('Languages')) {
                    currentSection = 'languages';
                } else if (line.includes('Interests')) {
                    currentSection = 'interests';
                }
                console.log('Section found:', currentSection);
            } else if (line.startsWith('**') && line.includes('**')) {
                // Şirket/okul adı ve tarih
                const match = line.match(/\*\*(.*?)\*\*\s*\|\s*\*(.*?)\*/);
                if (match) {
                    currentItem.company = match[1].trim();
                    currentItem.date = match[2].trim();
                    console.log('Company/Date:', currentItem.company, currentItem.date);
                }
            } else if (line.startsWith('-')) {
                // Liste öğeleri
                const content = line.replace('-', '').trim();
                if (content.includes('**Key Achievements:**')) {
                    currentItem.achievements = [];
                } else if (currentItem.achievements !== undefined) {
                    currentItem.achievements.push(content);
                } else {
                    if (currentItem.description === undefined) {
                        currentItem.description = content;
                    } else {
                        currentItem.description += ' ' + content;
                    }
                }
            } else if (line.length > 0 && !line.startsWith('*') && !line.includes('---')) {
                // Normal metin
                if (currentSection === 'summary') {
                    this.resumeData.summary += (this.resumeData.summary ? ' ' : '') + line;
                } else if (currentItem.description !== undefined) {
                    if (currentItem.description === '') {
                        currentItem.description = line;
                    } else {
                        currentItem.description += ' ' + line;
                    }
                }
            }
        }

        // Son öğeyi ekle
        console.log('Final currentItem:', currentItem);
        console.log('Final currentSection:', currentSection);
        if (Object.keys(currentItem).length > 0) {
            console.log('Adding final item to section:', currentSection);
            this.resumeData[currentSection].push(currentItem);
        }

        console.log('Parsed resume data:', this.resumeData);
        console.log('Experience items:', this.resumeData.experience);
        console.log('Education items:', this.resumeData.education);
    }

    renderResume() {
        if (!this.resumeData) return;

        this.resumeSection.innerHTML = `
            <header>
                <h2 class="h2 article-title">Özgeçmiş</h2>
            </header>

            ${this.renderSummary()}
            ${this.renderEducation()}
            ${this.renderExperience()}
            ${this.renderSkills()}
        `;
    }

    renderSummary() {
        if (!this.resumeData.summary) return '';
        
        return `
            <section class="summary">
                <div class="title-wrapper">
                    <div class="icon-box">
                        <ion-icon name="person-outline"></ion-icon>
                    </div>
                    <h3 class="h3">Özet</h3>
                </div>
                <p class="summary-text">${this.resumeData.summary}</p>
            </section>
        `;
    }

    renderEducation() {
        console.log('renderEducation called, education data:', this.resumeData.education);
        if (!this.resumeData.education || this.resumeData.education.length === 0) {
            console.log('No education data found');
            return '';
        }

        const educationItems = this.resumeData.education.map(item => `
            <li class="timeline-item">
                <div class="timeline-icon"></div>
                <h4 class="h4 timeline-item-title">${item.title}</h4>
                <span>${item.date}</span>
                <p class="timeline-text">${item.description || ''}</p>
                ${item.achievements && item.achievements.length > 0 ? `
                    <ul class="timeline-achievements">
                        ${item.achievements.map(achievement => `<li>${this.parseMarkdownText(achievement)}</li>`).join('')}
                    </ul>
                ` : ''}
            </li>
        `).join('');

        console.log('Education HTML generated:', educationItems);
        return `
            <section class="timeline">
                <div class="title-wrapper">
                    <div class="icon-box">
                        <ion-icon name="book-outline"></ion-icon>
                    </div>
                    <h3 class="h3">Eğitim</h3>
                </div>
                <ol class="timeline-list">
                    ${educationItems}
                </ol>
            </section>
        `;
    }

    renderExperience() {
        if (!this.resumeData.experience || this.resumeData.experience.length === 0) return '';

        const experienceItems = this.resumeData.experience.map(item => `
            <li class="timeline-item">
                <div class="timeline-icon"></div>
                <h4 class="h4 timeline-item-title">${item.title}</h4>
                <span class="timeline-company">${item.company} | ${item.date}</span>
                <p class="timeline-text">${item.description || ''}</p>
                ${item.achievements && item.achievements.length > 0 ? `
                    <div class="timeline-achievements">
                        <strong>Öne çıkanlar:</strong>
                        <ul>
                            ${item.achievements.map(achievement => `<li>${this.parseMarkdownText(achievement)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </li>
        `).join('');

        return `
            <section class="timeline">
                <div class="title-wrapper">
                    <div class="icon-box">
                        <ion-icon name="briefcase-outline"></ion-icon>
                    </div>
                    <h3 class="h3">Deneyim</h3>
                </div>
                <ol class="timeline-list">
                    ${experienceItems}
                </ol>
            </section>
        `;
    }

    renderSkills() {
        const skills = [
            { name: 'Validator & node operasyonu', value: 90 },
            { name: 'Türkçe teknik dokümantasyon', value: 88 },
            { name: 'Cosmos / testnet süreçleri', value: 85 },
            { name: 'İçerik ve araştırma', value: 80 }
        ];
        return `
            <section class="skills">
                <div class="title-wrapper">
                    <div class="icon-box">
                        <ion-icon name="code-slash-outline"></ion-icon>
                    </div>
                    <h3 class="h3">Odak alanları</h3>
                </div>
                <ul class="skills-list">
                    ${skills.map(skill => `
                    <li class="skills-item">
                        <div class="title-wrapper">
                            <h5 class="h5">${skill.name}</h5>
                            <data value="${skill.value}">${skill.value}%</data>
                        </div>
                        <div class="skill-progress-bg">
                            <div class="skill-progress-fill" style="width: ${skill.value}%"></div>
                        </div>
                    </li>`).join('')}
                </ul>
            </section>
        `;
    }

    renderCertifications() {
        if (!this.resumeData.certifications || this.resumeData.certifications.length === 0) return '';

        const certItems = this.resumeData.certifications.map(cert => `
            <li class="timeline-item">
                <h4 class="h4 timeline-item-title">${cert.title}</h4>
                <span>${cert.date}</span>
            </li>
        `).join('');

        return `
            <section class="timeline">
                <div class="title-wrapper">
                    <div class="icon-box">
                        <ion-icon name="ribbon-outline"></ion-icon>
                    </div>
                    <h3 class="h3">Certifications</h3>
                </div>
                <ol class="timeline-list">
                    ${certItems}
                </ol>
            </section>
        `;
    }

    renderProjects() {
        if (!this.resumeData.projects || this.resumeData.projects.length === 0) return '';

        const projectItems = this.resumeData.projects.map(project => `
            <li class="timeline-item">
                <h4 class="h4 timeline-item-title">${project.title}</h4>
                <span class="timeline-company">${project.company} | ${project.date}</span>
                <p class="timeline-text">${project.description || ''}</p>
            </li>
        `).join('');

        return `
            <section class="timeline">
                <div class="title-wrapper">
                    <div class="icon-box">
                        <ion-icon name="folder-outline"></ion-icon>
                    </div>
                    <h3 class="h3">Projects</h3>
                </div>
                <ol class="timeline-list">
                    ${projectItems}
                </ol>
            </section>
        `;
    }

    parseMarkdownText(text) {
        // Markdown bold (**text**) to HTML strong
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    showError() {
        if (this.resumeSection) {
            this.resumeSection.innerHTML = `
                <header>
                    <h2 class="h2 article-title">Özgeçmiş</h2>
                </header>
                <div class="error-message">
                    <p>Özgeçmiş yüklenemedi.</p>
                </div>
            `;
        }
    }
}

// Global olarak erişilebilir yap
window.ResumeParser = ResumeParser;

// Resume sayfası aktif olduğunda parser'ı başlat
function initializeResume() {
    const resumeSection = document.querySelector('.resume[data-page="resume"]');
    if (resumeSection && resumeSection.querySelector('.timeline, .summary')) return;
    if (typeof ResumeParser !== 'undefined') {
        new ResumeParser().init();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeResume();
});
