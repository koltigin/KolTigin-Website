/**
 * Markdown Blog Parser
 * Bu dosya blog klasöründeki .md dosyalarını okur ve HTML'e çevirir
 */

class BlogParser {
    constructor() {
        this.blogPosts = [];
        this.blogContainer = document.querySelector('.blog-posts-list');
        this.blogSection = document.querySelector('.blog');
        this.currentPost = null;
    }

    // Front matter'ı parse et (--- ile ayrılmış metadata)
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
                
                metadata[key] = value;
            }
        });

        return { metadata, content: contentText };
    }

    // Basit Markdown parser
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

    // Tarihi formatla
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('tr-TR', options);
    }

    // Blog post HTML'i oluştur
    createBlogPostHTML(post) {
        return `
            <li class="blog-post-item">
                <a href="#" onclick="showBlogPost('${post.slug}')">
                    <figure class="blog-banner-box">
                        ${post.metadata.image
                            ? `<img src="./assets/images/${post.metadata.image}" alt="${post.metadata.title}" loading="lazy">`
                            : `<div class="cover-fallback">${post.metadata.category || 'Yazı'}</div>`}
                    </figure>
                    <div class="blog-content">
                        <div class="blog-meta">
                            <p class="blog-category">${post.metadata.category}</p>
                            <span class="dot"></span>
                            <time datetime="${post.metadata.date}">${this.formatDate(post.metadata.date)}</time>
                        </div>
                        <h3 class="h3 blog-item-title">${post.metadata.title}</h3>
                        <p class="blog-text">${post.metadata.excerpt}</p>
                    </div>
                </a>
            </li>
        `;
    }

    // Blog post detayını ana içerik alanında göster
    showBlogPost(slug) {
        const post = this.blogPosts.find(p => p.slug === slug);
        if (!post) return;

        this.currentPost = post;

        // Ana içerik alanını blog post detayı ile değiştir
        this.blogSection.innerHTML = `
            <header>
                <button class="back-btn" onclick="showBlogList()">
                    <ion-icon name="arrow-back-outline"></ion-icon>
                    <span>Yazılara dön</span>
                </button>
                <h2 class="h2 article-title">${post.metadata.title}</h2>
            </header>

            <section class="blog-post-detail">
                <div class="blog-post-header">
                    <div class="blog-post-meta">
                        <p class="blog-category">${post.metadata.category}</p>
                        <span class="dot"></span>
                        <time datetime="${post.metadata.date}">${this.formatDate(post.metadata.date)}</time>
                    </div>
                    
                    <figure class="blog-post-image">
                        ${post.metadata.image
                            ? `<img src="./assets/images/${post.metadata.image}" alt="${post.metadata.title}" loading="lazy">`
                            : `<div class="cover-fallback">${post.metadata.category || 'Yazı'}</div>`}
                    </figure>
                </div>

                <div class="blog-post-content">
                    ${post.parsedContent}
                </div>
            </section>
        `;

        // Sayfa başına scroll
        window.scrollTo(0, 0);
    }

    // Blog listesini göster
    showBlogList() {
        this.currentPost = null;
        
        // Ana içerik alanını blog listesi ile değiştir
        this.blogSection.innerHTML = `
            <header>
                <h2 class="h2 article-title">Yazılar</h2>
            </header>

            <section class="blog-posts">
                <ul class="blog-posts-list">
                    ${this.blogPosts.map(post => this.createBlogPostHTML(post)).join('')}
                </ul>
            </section>
        `;
    }

    async discoverBlogFiles() {
        // Blog klasöründeki bilinen dosyalar
        const possibleFiles = [
            '2026-08-29-validator-notlari.md',
            '2025-06-01-turkce-node-rehberi.md',
            '2025-01-13-sei-defi-tasarim.md'
        ];

        // Dosyaların varlığını kontrol et ve mevcut olanları döndür
        const existingFiles = [];
        for (const file of possibleFiles) {
            try {
                const response = await fetch(`./blog/${file}`);
                if (response.ok) {
                    existingFiles.push(file);
                }
            } catch (error) {
                // Dosya bulunamadı, sessizce geç
            }
        }

        // Dosyaları tarih sırasına göre sırala (en yeni en üstte)
        // Bu sıralama loadBlogPosts() içinde yapılacak
        return existingFiles;
    }

    // Blog postları yükle
    async loadBlogPosts() {
        try {
            // Blog dosyalarını otomatik olarak bul
            const blogFiles = await this.discoverBlogFiles();

            for (const file of blogFiles) {
                try {
                    const response = await fetch(`./blog/${file}`);
                    if (response.ok) {
                        const content = await response.text();
                        const { metadata, content: markdownContent } = this.parseFrontMatter(content);
                        const parsedContent = this.parseMarkdown(markdownContent);
                        
                        const post = {
                            slug: file.replace('.md', ''),
                            metadata,
                            content: markdownContent,
                            parsedContent
                        };
                        
                        this.blogPosts.push(post);
                    }
                } catch (error) {
                    console.warn(`Blog post yüklenemedi: ${file}`, error);
                }
            }

            // Tarihe göre sırala (en yeni önce)
            this.blogPosts.sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date));

            // HTML'i render et
            this.renderBlogPosts();

        } catch (error) {
            console.error('Blog postları yüklenirken hata:', error);
        }
    }

    // Blog postları render et
    renderBlogPosts() {
        if (!this.blogContainer) return;

        const html = this.blogPosts.map(post => this.createBlogPostHTML(post)).join('');
        this.blogContainer.innerHTML = html;
    }
}

// Global fonksiyonlar
function showBlogPost(slug) {
    if (window.blogParser) {
        window.blogParser.showBlogPost(slug);
    }
}

function showBlogList() {
    if (window.blogParser) {
        window.blogParser.showBlogList();
    }
}

// Blog parser'ı başlat
document.addEventListener('DOMContentLoaded', () => {
    window.blogParser = new BlogParser();
    window.blogParser.loadBlogPosts();
});