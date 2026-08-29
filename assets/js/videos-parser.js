// Videos Parser - Basit ve etkili video yönetim sistemi
class VideosParser {
    constructor() {
        this.videos = [];
        this.currentVideo = null;
        
        // Elementleri bul ve başlat
        this.findElements();
    }

    findElements() {
        this.videosSection = document.querySelector('.videos');
        this.videosList = document.querySelector('.videos-posts-list');
        
        if (this.videosSection && this.videosList) {
            console.log('VideosParser: Elements found, starting...');
            this.init();
        } else {
            console.log('VideosParser: Elements not found, will retry...');
        }
    }

    async init() {
        await this.loadVideos();
    }

    async discoverVideoFiles() {
        // Basit yaklaşım: Bilinen video dosyalarını kontrol et
        // Yeni video eklerken buraya eklemen yeterli
        const possibleFiles = [
            'bifrost-nedir.md',
            'bifrost-and-its-ecosystem.md',
            'sei-bilesenleri-yeni.md',
            'components-of-the-sei.md',
            'rebusa-giris-turkce.md',
            'rebusa-giris-turkce-altyazi.md',
            'sei-network-neden-yeni-bir-defi-tasarim-alanidir.md',
            'bifrost-nedir-2.md',
            'bifrost-and-its-ecosystem-2.md',
            'sei-bilesenleri-yeni-2.md',
            'components-of-the-sei-2.md'
        ];

        // Dosyaların varlığını kontrol et ve mevcut olanları döndür
        const existingFiles = [];
        for (const file of possibleFiles) {
            try {
                const response = await fetch(`./videos/${file}`);
                if (response.ok) {
                    existingFiles.push(file);
                }
            } catch (error) {
                // Dosya bulunamadı, sessizce geç
            }
        }

        // Dosyaları tarih sırasına göre sırala (en yeni en üstte)
        // Bu sıralama loadVideos() içinde yapılacak
        return existingFiles;
    }

    async loadVideos() {
        try {
            console.log('Loading videos...');
            
            // Loading state
            if (this.videosList) {
                this.videosList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--light-gray);">Loading videos...</div>';
            }

            // Otomatik olarak videos klasöründeki tüm .md dosyalarını bul
            const videoFiles = await this.discoverVideoFiles();

            this.videos = [];

            for (const file of videoFiles) {
                try {
                    const response = await fetch(`./videos/${file}`);
                    
                    if (response.ok) {
                        const content = await response.text();
                        const { metadata } = this.parseVideoContent(content);
                        
                        const video = {
                            id: file.replace('.md', ''),
                            slug: file.replace('.md', ''),
                            ...metadata,
                            content: content
                        };
                        
                        this.videos.push(video);
                    }
                } catch (error) {
                    console.error(`Error loading ${file}:`, error);
                }
            }

            // Videoları tarihe göre sırala (en yeni en üstte)
            this.videos.sort((a, b) => {
                const dateA = new Date(a.date || '1900-01-01');
                const dateB = new Date(b.date || '1900-01-01');
                return dateB - dateA; // En yeni tarih önce gelsin
            });

            this.renderVideos();
            
            if (this.videos.length === 0) {
                this.showError('No videos found.');
            }

        } catch (error) {
            console.error('Error loading videos:', error);
            this.showError('Error loading videos.');
        }
    }

    parseVideoContent(content) {
        const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = content.match(frontMatterRegex);
        
        if (!match) {
            return { metadata: {} };
        }

        const metadataText = match[1];
        const metadata = {};

        metadataText.split('\n').forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
                const key = line.substring(0, colonIndex).trim();
                let value = line.substring(colonIndex + 1).trim();
                
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1).split(',').map(item => item.trim().replace(/['"]/g, ''));
                }
                
                if (value === 'true') value = true;
                if (value === 'false') value = false;
                
                metadata[key] = value;
            }
        });

        return { metadata };
    }

    renderVideos() {
        console.log(`Rendering ${this.videos.length} videos`);
        
        if (!this.videosList) {
            console.warn('videosList not found');
            return;
        }

        if (this.videos.length === 0) {
            this.videosList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--light-gray);">No videos available.</div>';
            return;
        }

        const html = this.videos.map(video => this.createVideoHTML(video)).join('');
        this.videosList.innerHTML = html;
        
        console.log('Videos rendered successfully');
    }

    createVideoHTML(video) {
        const thumbnail = video.youtubeId ? 
            `<div class="video-thumbnail" onclick="openVideoModal('${video.youtubeId}', '${video.title || 'Video'}')">
                <img src="https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg" 
                     alt="${video.title || 'Video thumbnail'}"
                     style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px;"
                     onerror="this.src='https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg'">
                <div class="play-button">
                    <ion-icon name="play-circle"></ion-icon>
                </div>
            </div>` : 
            `<div style="background: var(--eerie-black-1); height: 200px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--light-gray-70);">
                <span>No video preview available</span>
             </div>`;

        return `
            <li class="video-item">
                <div style="margin-bottom: 15px; border-radius: 12px; overflow: hidden; position: relative;">
                    ${thumbnail}
                </div>
                
                <div class="video-meta-box">
                    <div class="video-meta">
                        <ion-icon name="calendar-outline"></ion-icon>
                        <span>${video.date || 'N/A'}</span>
                    </div>
                    <div class="video-meta">
                        <ion-icon name="time-outline"></ion-icon>
                        <span>${video.duration || 'N/A'}</span>
                    </div>
                </div>
                
                <h3 class="h3" style="color: var(--white-2); margin-bottom: 10px;">${video.title || 'Untitled'}</h3>
                <p class="video-detail-description">${video.description || 'No description available.'}</p>
                
                ${video.technologies && video.technologies.length > 0 ? `
                    <div class="video-detail-technologies" style="margin-top: 15px;">
                        <div class="tech-tags">
                            ${video.technologies.map(tech => `
                                <span class="tech-tag">${tech}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </li>
        `;
    }


    parseMarkdown(content) {
        return content
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/gim, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
            .replace(/\n\n/gim, '</p><p>')
            .replace(/^(?!<[h|p|u|o|s])/gim, '<p>')
            .replace(/(?<!>)$/gim, '</p>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }


    showError(message) {
        if (!this.videosList) return;
        
        this.videosList.innerHTML = `
            <li class="error-message" style="text-align: center; padding: 40px; color: var(--light-gray);">
                <p>${message}</p>
            </li>
        `;
    }
}

// Global functions
function openVideoModal(youtubeId, title) {
    // Modal HTML oluştur
    const modalHTML = `
        <div class="video-modal-overlay" onclick="closeVideoModal()">
            <div class="video-modal-content" onclick="event.stopPropagation()">
                <div class="video-modal-header">
                    <h3>${title}</h3>
                    <button class="video-modal-close" onclick="closeVideoModal()">
                        <ion-icon name="close"></ion-icon>
                    </button>
                </div>
                <div class="video-modal-body">
                    <iframe src="https://www.youtube.com/embed/${youtubeId}" 
                            width="100%" height="400" 
                            frameborder="0" allowfullscreen
                            style="border-radius: 12px;"></iframe>
                </div>
            </div>
        </div>
    `;
    
    // Modal'ı body'ye ekle
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.style.overflow = 'hidden'; // Scroll'u engelle
}

function closeVideoModal() {
    const modal = document.querySelector('.video-modal-overlay');
    if (modal) {
        modal.remove();
        document.body.style.overflow = ''; // Scroll'u geri aç
    }
}

// Videos parser'ı başlat
function initializeVideos() {
    console.log('Initializing videos...');
    
    // Elementleri kontrol et
    const videosSection = document.querySelector('.videos');
    const videosList = document.querySelector('.videos-posts-list');
    
    if (videosSection && videosList) {
        console.log('Videos elements found, creating parser...');
        window.videosParser = new VideosParser();
    } else {
        console.log('Videos elements not found, retrying...');
        setTimeout(initializeVideos, 100);
    }
}

// DOM yüklendikten sonra başlat
document.addEventListener('DOMContentLoaded', () => {
    initializeVideos();
});

// Navigation handler - sadece bir kez başlat
document.addEventListener('click', (e) => {
    if (e.target.textContent && e.target.textContent.toLowerCase() === 'videos') {
        if (!window.videosParser || window.videosParser.videos.length === 0) {
            setTimeout(() => {
                console.log('Videos tab clicked, initializing...');
                initializeVideos();
            }, 100);
        } else {
            console.log('Videos parser already initialized');
        }
    }
});

// Global access
window.VideosParser = VideosParser;