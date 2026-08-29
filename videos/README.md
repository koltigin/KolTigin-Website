# Videos System

This folder contains your dynamic video content. Videos are automatically loaded from individual Markdown files and displayed on the website.

## Video Management

### **Individual Markdown Files**
You can manage your videos using individual `.md` files in this directory.

## Adding Videos

### **1. Markdown Format**
Create a new `.md` file in this directory with the following structure:

```markdown
---
title: "Video Title"
category: "tutorial"
duration: "30 minutes"
date: "January 10, 2024"
description: "Video description"
youtubeId: "VIDEO_ID_HERE"
technologies: ["React", "Node.js", "MongoDB"]
featured: true
---

# Video Title

Your detailed video description in Markdown format...

## Topics Covered
- Topic 1
- Topic 2

## What You'll Learn
Detailed learning objectives...
```

### **2. Required Fields**
- **title**: Video title
- **category**: Video category (tutorial, demo, walkthrough, etc.)
- **duration**: Video duration
- **date**: Publication date
- **description**: Short video description
- **youtubeId**: YouTube video ID (from URL)

### **3. Optional Fields**
- **technologies**: List of technologies covered
- **featured**: Featured video? (true/false)

### **4. Getting YouTube Video ID**
From a YouTube URL like: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
The video ID is: `dQw4w9WgXcQ`

## Features

- ✅ **YouTube Embed** - Automatic video embedding
- ✅ **Video Metadata** - Duration, date, category, technologies
- ✅ **Markdown Content** - Detailed descriptions and content
- ✅ **Responsive Design** - Mobile-friendly video cards
- ✅ **Easy Management** - Individual file management

## File Structure

```
videos/
├── README.md                           # This file
├── ecommerce-platform-tutorial.md      # E-commerce tutorial
├── javascript-es6-features.md          # JavaScript tutorial
└── css-grid-tutorial.md               # CSS Grid tutorial
```

## Adding New Videos

1. Create a new `.md` file in this directory
2. Add the required front matter metadata
3. Write your video description in Markdown
4. Add the filename to the `videoFiles` array in `assets/js/videos-parser.js`
5. The video will automatically appear on the website

## Video Categories

- **tutorial** - Educational content
- **demo** - Project demonstrations
- **walkthrough** - Step-by-step guides
- **tips** - Quick tips and tricks
- **series** - Multi-part series
