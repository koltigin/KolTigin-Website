'use strict';

function readContactFormValues(form) {
    if (!form) return { name: '', email: '', message: '' };
    return {
        name: form.fullname ? form.fullname.value : '',
        email: form.email ? form.email.value : '',
        message: form.message ? form.message.value : ''
    };
}

function contactT(key, fallback) {
    return window.KolTiginI18n ? window.KolTiginI18n.t(key, null, fallback) : fallback;
}

function contactEndpoint() {
    const site = window.KolTiginI18n && window.KolTiginI18n.site;
    return (site && site.contact && site.contact.endpoint) || '';
}

function localizedMapUrl() {
    const site = window.KolTiginI18n && window.KolTiginI18n.site;
    const raw = (site && site.contact && site.contact.mapEmbedUrl) || '';
    const lang = (window.KolTiginI18n && window.KolTiginI18n.language) === 'tr' ? 'tr' : 'en';
    if (!raw) return '';
    try {
        const url = new URL(raw);
        url.searchParams.set('hl', lang);
        return url.toString();
    } catch {
        if (/[?&]hl=/.test(raw)) return raw.replace(/([?&]hl=)[^&]*/, '$1' + lang);
        return raw + (raw.includes('?') ? '&' : '?') + 'hl=' + lang;
    }
}

function setContactStatus(form, type, message) {
    const status = form && form.querySelector('[data-form-status]');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', type === 'error');
    status.hidden = !message;
}

async function handleContactSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) return;

    const btn = form.querySelector('[data-form-btn]');
    const btnLabel = btn ? btn.querySelector('span') : null;
    const idleLabel = contactT('contact.submit', 'Send');
    const values = readContactFormValues(form);
    const endpoint = contactEndpoint();

    if (btn) btn.setAttribute('disabled', '');
    if (btnLabel) btnLabel.textContent = contactT('contact.submitting', 'Sending...');
    setContactStatus(form, '', '');

    try {
        if (!endpoint) throw new Error('missing endpoint');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: values.name.trim(),
                email: values.email.trim(),
                message: values.message.trim()
            })
        });

        if (!response.ok) throw new Error('request failed');

        form.reset();
        setContactStatus(form, 'success', contactT('contact.success', 'Your message has been sent successfully.'));
    } catch (error) {
        setContactStatus(form, 'error', contactT('contact.error', 'The message could not be sent. Please try again later.'));
    } finally {
        if (btnLabel) btnLabel.textContent = idleLabel;
        if (btn) {
            if (form.checkValidity()) btn.removeAttribute('disabled');
            else btn.setAttribute('disabled', '');
        }
    }
}

class ContactParser {
    constructor() {
        this.contactSection = null;
        this.isInitialized = false;
    }

    async initialize() {
        this.contactSection = document.querySelector('.contact');
        if (!this.contactSection) return;
        if (window.KolTiginI18n && window.KolTiginI18n.ready) {
            await window.KolTiginI18n.ready;
        }
        this.renderContactContent();
        this.isInitialized = true;
        if (typeof bindContactForm === 'function') bindContactForm(this.contactSection);
    }

    renderContactContent() {
        const existing = this.contactSection.querySelector('[data-form]');
        const saved = readContactFormValues(existing);
        const mapUrl = localizedMapUrl();
        const site = window.KolTiginI18n && window.KolTiginI18n.site;
        const loc = site && site.location;
        const lang = (window.KolTiginI18n && window.KolTiginI18n.language) || 'en';
        const mapTitle = (loc && (loc[lang] || loc.en || loc.tr))
          || [loc && loc.city, loc && loc.country].filter(Boolean).join(', ')
          || contactT('contact.mapTitle', 'Eskişehir, Türkiye');
        const formEnabled = !(site && site.contact && site.contact.formEnabled === false);

        this.contactSection.innerHTML = `
            <header>
                <h2 class="h2 article-title">${contactT('contact.title', 'Contact')}</h2>
            </header>

            <section class="mapbox" data-mapbox>
                <figure>
                    <iframe
                        src="${mapUrl}"
                        width="400" height="300" loading="lazy"
                        title="${mapTitle}"
                        referrerpolicy="no-referrer-when-downgrade"></iframe>
                </figure>
            </section>

            ${formEnabled ? `
            <section class="contact-form">
                <h3 class="h3 form-title">${contactT('contact.formTitle', 'Message')}</h3>
                <form action="#" class="form" data-form>
                    <div class="input-wrapper">
                        <div class="form-field">
                            <label class="visually-hidden" for="contact-name">${contactT('contact.labelName', 'Name')}</label>
                            <input id="contact-name" type="text" name="fullname" class="form-input" placeholder="${contactT('contact.placeholderName', 'Name')}" autocomplete="name" required data-form-input>
                        </div>
                        <div class="form-field">
                            <label class="visually-hidden" for="contact-email">${contactT('contact.labelEmail', 'Email')}</label>
                            <input id="contact-email" type="email" name="email" class="form-input" placeholder="${contactT('contact.placeholderEmail', 'Email')}" autocomplete="email" required data-form-input>
                        </div>
                    </div>
                    <div class="form-field">
                        <label class="visually-hidden" for="contact-message">${contactT('contact.labelMessage', 'Message')}</label>
                        <textarea id="contact-message" name="message" class="form-input" placeholder="${contactT('contact.placeholderMessage', 'Message')}" required data-form-input></textarea>
                    </div>
                    <button class="form-btn" type="submit" disabled data-form-btn>
                        <ion-icon name="paper-plane" aria-hidden="true"></ion-icon>
                        <span>${contactT('contact.submit', 'Send')}</span>
                    </button>
                    <p class="form-status" data-form-status role="status" aria-live="polite" hidden></p>
                </form>
            </section>` : ''}
        `;

        const form = this.contactSection.querySelector('[data-form]');
        if (saved.name) form.fullname.value = saved.name;
        if (saved.email) form.email.value = saved.email;
        if (saved.message) form.message.value = saved.message;
        if (form.checkValidity()) {
            form.querySelector('[data-form-btn]').removeAttribute('disabled');
        }
        form.addEventListener('submit', handleContactSubmit);
    }
}

function initializeContact() {
    if (!window.contactParser) {
        window.contactParser = new ContactParser();
    }
    window.contactParser.initialize();
}

if (window.KolTiginI18n) {
    window.KolTiginI18n.onChange(() => {
        if (window.contactParser && window.contactParser.isInitialized) {
            window.contactParser.initialize();
        }
    });
}
