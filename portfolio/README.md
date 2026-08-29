# Portfolio System

This folder contains your dynamic portfolio projects. Projects are automatically loaded from Markdown files and displayed on the website.

## Portfolio Management

### **Markdown Files**
You can manage your portfolio projects using individual `.md` files in this directory.

## Adding Projects

### **1. Markdown Format**
Create a new `.md` file in this directory with the following structure:

```markdown
---
title: "Project Title"
category: "web development"
image: "project-1.jpg"
description: "Project description"
technologies: ["React", "Node.js", "MongoDB"]
liveUrl: "https://example.com"
githubUrl: "https://github.com/username/repo"
featured: true
---

# Project Title

Your detailed project description in Markdown format...

## Features
- Feature 1
- Feature 2

## Technical Details
Detailed technical information...
```

### **2. Required Fields**
- **title**: Project title
- **category**: Project category (web development, web design, applications)
- **image**: Image filename (must be in assets/images/ folder)
- **description**: Project description
- **technologies**: List of technologies used

### **3. Optional Fields**
- **liveUrl**: Live demo link
- **githubUrl**: GitHub repository link
- **featured**: Featured project? (true/false)

## Kategoriler

### **Mevcut Kategoriler**
```json
{
  "id": "web development",
  "name": "Web Development", 
  "icon": "code-outline"
},
{
  "id": "web design",
  "name": "Web Design",
  "icon": "brush-outline"
},
{
  "id": "applications",
  "name": "Applications",
  "icon": "phone-portrait-outline"
}
```

### **Yeni Kategori Ekleme**
1. `projects.json` dosyasında `categories` bölümüne ekleyin
2. Projelerinizde `category` alanında kullanın

## Görsel Dosyaları

### **Görsel Gereksinimleri**
- **Format**: JPG, PNG, WebP
- **Boyut**: 400x300px önerilen
- **Konum**: `assets/images/` klasörü
- **İsim**: Dosya adını `image` alanında belirtin

### **Görsel Optimizasyonu**
- Dosya boyutunu küçük tutun
- WebP formatı kullanın (destekleniyorsa)
- Lazy loading otomatik olarak aktif

## Proje Detay Modal

### **Özellikler**
- **Büyük görsel** ve proje bilgileri
- **Teknoloji etiketleri** 
- **Canlı demo** ve **GitHub** linkleri
- **Responsive tasarım**
- **Hover efektleri**

### **Modal İçeriği**
- Proje başlığı ve kategorisi
- Detaylı açıklama
- Kullanılan teknolojiler
- Canlı demo linki (varsa)
- GitHub linki (varsa)

## Filtreleme Sistemi

### **Desktop**
- Buton tabanlı filtreleme
- Kategori butonları

### **Mobile**
- Dropdown select box
- Dokunmatik dostu

### **Filtreleme Mantığı**
- **All**: Tüm projeleri göster
- **Kategori**: Sadece o kategorideki projeleri göster
- **Smooth animasyonlar** ile geçişler

## Örnek Proje

```json
{
  "id": "ecommerce-platform",
  "title": "E-Commerce Platform",
  "category": "web development",
  "image": "project-2.png",
  "description": "Tam özellikli e-ticaret platformu. Ödeme sistemi ve yönetim paneli dahil.",
  "technologies": ["Vue.js", "Express.js", "PostgreSQL", "Stripe"],
  "liveUrl": "https://shop.example.com",
  "githubUrl": "https://github.com/username/ecommerce",
  "featured": true
}
```

## Notlar

- JSON dosyası UTF-8 kodlamasında olmalıdır
- Projeler otomatik olarak yüklenir
- Filtreleme sistemi otomatik çalışır
- Responsive tasarım tüm cihazlarda çalışır
- Modal popup ile detaylı görüntüleme
- Hata durumunda kullanıcı dostu mesajlar
