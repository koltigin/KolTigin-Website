/**
 * Portfolio Parser
 * Bu dosya portfolio klasöründeki JSON dosyasını okur ve projeleri gösterir
 */

class PortfolioParser {
    constructor() {
        this.projects = [];
        this.categories = [];
        this.projectContainer = document.querySelector('.project-list');
        this.filterContainer = document.querySelector('.filter-list');
        this.selectContainer = document.querySelector('.select-list');
        this.portfolioSection = document.querySelector('.portfolio');
        this.currentFilter = 'all';
        this.currentProject = null;
    }

    async discoverPortfolioFiles() {
        // Portfolio klasöründeki bilinen dosyalar
        const possibleFiles = [
            'anatolian-team.md',
            'node-rehberleri.md',
            'cosmos-snapshots.md',
            'ekosistem-videolari.md'
        ];

        // Dosyaların varlığını kontrol et ve mevcut olanları döndür
        const existingFiles = [];
        for (const file of possibleFiles) {
            try {
                const response = await fetch(`./portfolio/${file}`);
                if (response.ok) {
                    existingFiles.push(file);
                }
            } catch (error) {
                // Dosya bulunamadı, sessizce geç
            }
        }

        return existingFiles;
    }

    // Portfolio projelerini yükle
    async loadProjects() {
        try {
            // Mevcut scroll pozisyonunu kaydet
            const currentScrollY = window.scrollY;
            
            // Loading state göster
            if (this.projectList) {
                this.projectList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--light-gray);">Loading projects...</div>';
            }
            
            // Markdown dosyalarını otomatik olarak bul
            const portfolioFiles = await this.discoverPortfolioFiles();

            this.projects = [];
            this.categories = [
                { id: 'validator', name: 'Validator', icon: 'shield-outline' },
                { id: 'rehber', name: 'Rehber', icon: 'book-outline' },
                { id: 'altyapi', name: 'Altyapı', icon: 'server-outline' },
                { id: 'icerik', name: 'İçerik', icon: 'videocam-outline' }
            ];

            for (const file of portfolioFiles) {
                try {
                    const response = await fetch(`./portfolio/${file}`);
                    if (response.ok) {
                        const content = await response.text();
                        const { metadata } = this.parseFrontMatter(content);
                        
                        const project = {
                            id: file.replace('.md', ''),
                            slug: file.replace('.md', ''),
                            ...metadata,
                            content: content,
                            parsedContent: this.parseMarkdown(content.split('---')[2] || '')
                        };
                        
                        this.projects.push(project);
                    }
                } catch (error) {
                    console.warn(`Portfolio project could not be loaded: ${file}`, error);
                }
            }

            // Projeleri tarihe göre sırala (en yeni en üstte)
            this.projects.sort((a, b) => {
                const dateA = new Date(a.date || '1900-01-01');
                const dateB = new Date(b.date || '1900-01-01');
                return dateB - dateA; // En yeni tarih önce gelsin
            });

            // Filtreleme butonlarını oluştur
            this.createFilterButtons();
            
            // Projeleri render et
            this.renderProjects();
            
            // Scroll pozisyonunu koru ve sonra sıfırla
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 100);

        } catch (error) {
            console.error('Error loading portfolio:', error);
            this.showError('An error occurred while loading the portfolio.');
        }
    }

    // Front matter'ı parse et (blog parser'dan alınan)
    parseFrontMatter(content) {
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontMatterRegex);
        
        if (!match) {
            return { metadata: {}, content: content };
        }

        const metadataText = match[1];
        const contentText = match[2];
        const metadata = {};

        // Metadata'yı parse et
        metadataText.split('\n').forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                
                // Tırnak işaretlerini temizle
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                // Array değerlerini parse et
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map(item => item.trim().replace(/['"]/g, ''));
                }
                
                // Boolean değerlerini parse et
                if (value === 'true') value = true;
                if (value === 'false') value = false;
                
                metadata[key] = value;
            }
        });

        return { metadata, content: contentText };
    }

    // Basit Markdown parser (blog parser'dan alınan)
    parseMarkdown(content) {
        return content
            // Başlıkları
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            
            // Kalın ve italik
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            
            // Kod blokları
            .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/gim, '<code>$1</code>')
            
            // Linkler
            .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
            
            // Paragraflar
            .replace(/\n\n/gim, '</p><p>')
            .replace(/^(?!<[h|p|u|o|s])/gim, '<p>')
            .replace(/(?<!>)$/gim, '</p>')
            
            // Listeler (basit)
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }

    // Filtreleme butonlarını oluştur
    createFilterButtons() {
        if (!this.filterContainer || !this.selectContainer) return;

        // Desktop filtreleme butonları
        const filterButtons = [
            { id: 'all', name: 'Tümü', active: true },
            ...this.categories.map(cat => ({
                id: cat.id,
                name: cat.name,
                active: false
            }))
        ];

        this.filterContainer.innerHTML = filterButtons.map(btn => `
            <li class="filter-item">
                <button class="${btn.active ? 'active' : ''}" data-filter-btn data-category="${btn.id}">
                    ${btn.name}
                </button>
            </li>
        `).join('');

        // Mobile select dropdown
        this.selectContainer.innerHTML = filterButtons.map(btn => `
            <li class="select-item">
                <button data-select-item data-category="${btn.id}">
                    ${btn.name}
                </button>
            </li>
        `).join('');

        // Event listener'ları ekle
        this.attachFilterEvents();
    }

    // Filtreleme event'lerini ekle
    attachFilterEvents() {
        // Desktop filter buttons
        const filterButtons = document.querySelectorAll('[data-filter-btn]');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.filterProjects(category);
                
                // Active state güncelle
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Mobile select'i de güncelle
                const selectValue = document.querySelector('[data-selecct-value]');
                if (selectValue) {
                    selectValue.textContent = e.target.textContent;
                }
            });
        });

        // Mobile select items
        const selectItems = document.querySelectorAll('[data-select-item]');
        selectItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.filterProjects(category);
                
                // Mobile select'i güncelle
                const selectValue = document.querySelector('[data-selecct-value]');
                if (selectValue) {
                    selectValue.textContent = e.target.textContent;
                }
                
                // Desktop filter'ı da güncelle
                filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.category === category) {
                        btn.classList.add('active');
                    }
                });
            });
        });
    }

    // Projeleri filtrele
    filterProjects(category) {
        this.currentFilter = category;
        this.renderProjects();
    }

    // Proje HTML'i oluştur
    createProjectHTML(project) {
        const isActive = this.currentFilter === 'all' || this.currentFilter === project.category;
        
        return `
            <li class="project-item ${isActive ? 'active' : ''}" 
                data-filter-item 
                data-category="${project.category}">
                <a href="#" onclick="showProjectDetail('${project.id}')">
                    
                    <figure class="project-img">
                        <div class="project-item-icon-box">
                            <ion-icon name="eye-outline"></ion-icon>
                        </div>
                        ${project.image
                            ? `<img src="./assets/images/${project.image}" alt="${project.title}" loading="lazy">`
                            : `<div class="cover-fallback">${project.cover || project.title}</div>`}
                    </figure>
                    
                    <h3 class="project-title">${project.title}</h3>
                    <p class="project-category">${this.getCategoryName(project.category)}</p>
                </a>
            </li>
        `;
    }

    // Kategori adını al
    getCategoryName(categoryId) {
        const category = this.categories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    }

    // Proje detayını ana içerik alanında göster (blog gibi)
    showProjectDetail(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        this.currentProject = project;

        // Ana içerik alanını proje detayı ile değiştir
        this.portfolioSection.innerHTML = `
            <header>
                <button class="back-btn" onclick="showProjectList()">
                    <ion-icon name="arrow-back-outline"></ion-icon>
                    <span>Projelere dön</span>
                </button>
                <h2 class="h2 article-title">${project.title}</h2>
            </header>

            <section class="project-detail">
                <div class="project-detail-header">
                    <div class="project-detail-meta">
                        <p class="project-category">${this.getCategoryName(project.category)}</p>
                        <span class="dot"></span>
                        <span class="project-featured">${project.featured ? 'Featured' : 'Project'}</span>
                    </div>
                    
                    <figure class="project-detail-image">
                        ${project.image
                            ? `<img src="./assets/images/${project.image}" alt="${project.title}" loading="lazy">`
                            : `<div class="cover-fallback">${project.cover || project.title}</div>`}
                    </figure>
                </div>

                <div class="project-detail-content">
                    <div class="project-detail-summary">
                        <p class="project-detail-description">${project.description}</p>
                        
                        <div class="project-detail-technologies">
                            <h3 class="h3">Araçlar</h3>
                            <div class="tech-tags">
                                ${(project.technologies || []).map(tech => `
                                    <span class="tech-tag">${tech}</span>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="project-detail-links">
                            ${project.liveUrl ? `
                                <a href="${project.liveUrl}" target="_blank" class="project-link live-link">
                                    <ion-icon name="globe-outline"></ion-icon>
                                    <span>Bağlantı</span>
                                </a>
                            ` : ''}
                            
                            ${project.githubUrl ? `
                                <a href="${project.githubUrl}" target="_blank" class="project-link github-link">
                                    <ion-icon name="logo-github"></ion-icon>
                                    <span>GitHub</span>
                                </a>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="project-detail-article">
                        <div class="project-article-content">
                            ${project.parsedContent}
                        </div>
                    </div>
                </div>
            </section>
        `;

        // Sayfa başına scroll
        window.scrollTo(0, 0);
    }

    // Portfolio listesini göster
    showProjectList() {
        this.currentProject = null;
        
        // Ana içerik alanını portfolio listesi ile değiştir
        this.portfolioSection.innerHTML = `
            <header>
                <h2 class="h2 article-title">Projeler</h2>
            </header>

            <section class="projects">
                <ul class="filter-list">
                    <li class="filter-item">
                        <button class="${this.currentFilter === 'all' ? 'active' : ''}" data-filter-btn data-category="all">Tümü</button>
                    </li>
                    ${this.categories.map(cat => `
                        <li class="filter-item">
                            <button class="${this.currentFilter === cat.id ? 'active' : ''}" data-filter-btn data-category="${cat.id}">${cat.name}</button>
                        </li>
                    `).join('')}
                </ul>

                <div class="filter-select-box">
                    <button class="filter-select" data-select>
                        <div class="select-value" data-selecct-value>Select category</div>
                        <div class="select-icon">
                            <ion-icon name="chevron-down"></ion-icon>
                        </div>
                    </button>
                    <ul class="select-list">
                        <li class="select-item">
                            <button data-select-item data-category="all">Tümü</button>
                        </li>
                        ${this.categories.map(cat => `
                            <li class="select-item">
                                <button data-select-item data-category="${cat.id}">${cat.name}</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <ul class="project-list">
                    ${this.projects.map(project => this.createProjectHTML(project)).join('')}
                </ul>
            </section>
        `;

        // Event listener'ları tekrar ekle
        this.attachFilterEvents();
    }

    // Projeleri render et
    renderProjects() {
        if (!this.projectContainer) return;

        const filteredProjects = this.currentFilter === 'all' 
            ? this.projects 
            : this.projects.filter(p => p.category === this.currentFilter);

        const html = filteredProjects.map(project => this.createProjectHTML(project)).join('');
        this.projectContainer.innerHTML = html;
        
        // Render sonrası scroll pozisyonunu koru
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, 50);
    }

    // Hata mesajı göster
    showError(message) {
        if (!this.projectContainer) return;
        
        this.projectContainer.innerHTML = `
            <li class="error-message">
                <p>${message}</p>
            </li>
        `;
    }
}

// Global fonksiyonlar
function showProjectDetail(projectId) {
    if (window.portfolioParser) {
        window.portfolioParser.showProjectDetail(projectId);
    }
}

function showProjectList() {
    if (window.portfolioParser) {
        window.portfolioParser.showProjectList();
    }
}

// Portfolio parser'ı başlat
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioParser = new PortfolioParser();
    window.portfolioParser.loadProjects();
});
