# Blog Sistemi

Bu klasör Markdown tabanlı blog yazılarınızı içerir. Blog yazıları otomatik olarak web sitesinde görüntülenir.

## Blog Yazısı Ekleme

1. Yeni bir `.md` dosyası oluşturun (örn: `2024-01-20-baslik.md`)
2. Dosya adı formatı: `YYYY-MM-DD-baslik.md`
3. Dosyanın başına front matter ekleyin:

```markdown
---
title: "Blog Yazısı Başlığı"
category: "Kategori (örn: Web Development, Design, Programming)"
date: "2024-01-20"
image: "blog-1.jpg"  # assets/images/ klasöründeki resim dosyası
excerpt: "Kısa açıklama metni"
---

# Blog Yazısı İçeriği

Burada Markdown formatında yazınızı yazabilirsiniz...
```

## Desteklenen Markdown Özellikleri

- **Başlıklar**: `#`, `##`, `###`
- **Kalın metin**: `**kalın**`
- **İtalik metin**: `*italik*`
- **Kod blokları**: \`\`\` kod \`\`\`
- **Satır içi kod**: \`kod\`
- **Linkler**: `[metin](url)`
- **Listeler**: `- item` veya `1. item`

## Görsel Dosyaları

Blog yazılarında kullanmak istediğiniz görselleri `assets/images/` klasörüne ekleyin ve front matter'da `image` alanında belirtin.

## Örnek Blog Yazısı

```markdown
---
title: "JavaScript ES6+ Özellikleri"
category: "Programming"
date: "2024-01-20"
image: "blog-1.jpg"
excerpt: "Modern JavaScript'in en önemli özelliklerini keşfedin"
---

# JavaScript ES6+ Özellikleri

JavaScript'in yeni sürümleriyle birlikte gelen harika özellikler...

## Arrow Functions

```javascript
const add = (a, b) => a + b;
```

## Destructuring

```javascript
const { name, age } = user;
```

Bu özellikler sayesinde daha temiz kod yazabilirsiniz.
```

## Notlar

- Blog yazıları tarihe göre sıralanır (en yeni önce)
- Dosya adındaki tarih formatına dikkat edin
- Front matter alanları zorunludur
- Markdown dosyaları UTF-8 kodlamasında olmalıdır
