class ContactParser {
    constructor() {
        this.contactSection = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        this.contactSection = document.querySelector('.contact');
        if (!this.contactSection) return;
        this.renderContactContent();
        this.isInitialized = true;
        if (typeof bindContactForm === 'function') bindContactForm(this.contactSection);
    }

    renderContactContent() {
        this.contactSection.innerHTML = `
            <header>
                <h2 class="h2 article-title">İletişim</h2>
            </header>

            <section class="about-text">
                <p>İş birliği, validator soruları veya içerik için resmi hesaplardan yazın. Telefon numarası yayınlamıyorum.</p>
            </section>

            <section class="contact-info-block">
                <h3 class="h3">Kanallar</h3>
                <ul class="contact-channels">
                    <li><a href="https://github.com/koltigin" target="_blank" rel="noopener">GitHub — koltigin</a></li>
                    <li><a href="https://x.com/mkoltigin" target="_blank" rel="noopener">X — @mkoltigin</a></li>
                    <li><a href="https://link3.to/koltigin" target="_blank" rel="noopener">Link3 — koltigin</a></li>
                    <li><a href="https://anatolianteam.com" target="_blank" rel="noopener">Anatolian Team</a></li>
                    <li><a href="https://medium.com/@koltigin" target="_blank" rel="noopener">Medium</a></li>
                </ul>
            </section>

            <section class="mapbox" data-mapbox>
                <figure>
                    <iframe
                        src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d12719000!2d35.243322!3d38.963745!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1str!2str"
                        width="400" height="300" loading="lazy" title="Türkiye"></iframe>
                </figure>
            </section>

            <section class="contact-form">
                <h3 class="h3 form-title">Mesaj</h3>
                <p class="form-note">Form GitHub Issues’a yönlenmez; kopyalanabilir bir taslak üretir.</p>
                <form action="#" class="form" data-form>
                    <div class="input-wrapper">
                        <input type="text" name="fullname" class="form-input" placeholder="Adınız" required data-form-input>
                        <input type="email" name="email" class="form-input" placeholder="E-posta" required data-form-input>
                    </div>
                    <textarea name="message" class="form-input" placeholder="Mesajınız" required data-form-input></textarea>
                    <button class="form-btn" type="submit" disabled data-form-btn>
                        <ion-icon name="paper-plane"></ion-icon>
                        <span>Taslağı kopyala</span>
                    </button>
                </form>
            </section>
        `;

        const form = this.contactSection.querySelector('[data-form]');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = form.fullname.value.trim();
            const email = form.email.value.trim();
            const message = form.message.value.trim();
            const draft = `Gönderen: ${name} <${email}>\n\n${message}`;
            navigator.clipboard.writeText(draft).then(() => {
                alert('Mesaj taslağı panoya kopyalandı. GitHub veya X üzerinden iletebilirsiniz.');
            }).catch(() => {
                alert(draft);
            });
        });
    }
}

function initializeContact() {
    if (!window.contactParser) {
        window.contactParser = new ContactParser();
    }
    window.contactParser.initialize();
}
