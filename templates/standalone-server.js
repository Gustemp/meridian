const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin credentials (change these!)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Session storage
const sessions = new Map();

// Middleware
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Read/Write content
const readContent = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'content.json'), 'utf8'));
  } catch (error) {
    console.error('Error reading content:', error);
    return null;
  }
};

const writeContent = (content) => {
  try {
    fs.writeFileSync(path.join(__dirname, 'data', 'content.json'), JSON.stringify(content, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing content:', error);
    return false;
  }
};

// API: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { username, loginAt: new Date() });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// API: Get content (public)
app.get('/api/content', (req, res) => {
  const content = readContent();
  if (content) {
    const publicContent = { ...content };
    if (publicContent.pexels) publicContent.pexels = { apiKey: '***' };
    res.json(publicContent);
  } else {
    res.status(500).json({ error: 'Error loading content' });
  }
});

// API: Get page (public)
app.get('/api/page/:slug', (req, res) => {
  const content = readContent();
  if (!content) return res.status(500).json({ error: 'Error loading content' });
  const page = content.pages?.find(p => p.slug === req.params.slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json({ success: true, page });
});

// API: Update content (admin only)
app.put('/api/content', authMiddleware, (req, res) => {
  const content = readContent();
  if (!content) return res.status(500).json({ error: 'Error loading content' });
  
  const { siteName, tagline, heroTitle, heroSubtitle, ctaText, ctaLink, backgroundType, backgroundColor, backgroundImage, backgroundVideo, pexels } = req.body;
  
  content.siteName = siteName || content.siteName;
  content.tagline = tagline || content.tagline;
  content.heroTitle = heroTitle || content.heroTitle;
  content.heroSubtitle = heroSubtitle || content.heroSubtitle;
  content.ctaText = ctaText || content.ctaText;
  content.ctaLink = ctaLink || content.ctaLink;
  content.backgroundType = backgroundType || content.backgroundType;
  content.backgroundColor = backgroundColor || content.backgroundColor;
  content.backgroundImage = backgroundImage || content.backgroundImage;
  content.backgroundVideo = backgroundVideo || content.backgroundVideo;
  if (pexels) content.pexels = pexels;
  
  if (writeContent(content)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error saving content' });
  }
});

// API: Add/Update page (admin only)
app.post('/api/pages', authMiddleware, (req, res) => {
  const content = readContent();
  if (!content) return res.status(500).json({ error: 'Error loading content' });
  
  const { slug, title, content: pageContent } = req.body;
  if (!slug || !title) return res.status(400).json({ error: 'Slug and title required' });
  
  if (!content.pages) content.pages = [];
  const existingIndex = content.pages.findIndex(p => p.slug === slug);
  
  if (existingIndex >= 0) {
    content.pages[existingIndex] = { slug, title, content: pageContent || '' };
  } else {
    content.pages.push({ slug, title, content: pageContent || '' });
  }
  
  if (writeContent(content)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error saving page' });
  }
});

// API: Delete page (admin only)
app.delete('/api/pages/:slug', authMiddleware, (req, res) => {
  const content = readContent();
  if (!content) return res.status(500).json({ error: 'Error loading content' });
  
  content.pages = (content.pages || []).filter(p => p.slug !== req.params.slug);
  
  if (writeContent(content)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Error deleting page' });
  }
});

// API: Upload file (admin only)
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

// Video proxy for external URLs
app.get('/api/video-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL required');
  try {
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(res);
  } catch (error) {
    res.status(500).send('Error proxying video');
  }
});

// Serve public pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/page/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'page.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Site running on http://localhost:${PORT}`);
  console.log(`📝 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`👤 Default credentials: admin / admin123`);
  console.log(`⚠️  Change credentials via ADMIN_USERNAME and ADMIN_PASSWORD env vars`);
});
