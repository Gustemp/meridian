const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getMasterPath = () => path.join(__dirname, 'data', 'master.json');

const readMaster = () => {
  try {
    return JSON.parse(fs.readFileSync(getMasterPath(), 'utf8'));
  } catch (error) {
    return { masterAdmin: { username: 'admin', password: 'admin123' }, sites: [] };
  }
};

const writeMaster = (data) => {
  fs.writeFileSync(getMasterPath(), JSON.stringify(data, null, 2));
};

const getSiteContentPath = (slug) => path.join(__dirname, 'data', 'sites', slug, 'content.json');

const readSiteContent = (slug) => {
  try {
    return JSON.parse(fs.readFileSync(getSiteContentPath(slug), 'utf8'));
  } catch (error) {
    return null;
  }
};

const writeSiteContent = (slug, data) => {
  const dir = path.join(__dirname, 'data', 'sites', slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getSiteContentPath(slug), JSON.stringify(data, null, 2));
};

const ensureSiteUploadDir = (slug) => {
  const dir = path.join(__dirname, 'uploads', slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// Ensure base directories exist
['uploads', 'data', 'data/sites'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Simple session tokens (in-memory)
const sessions = new Map();

const generateToken = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 12);
};

const authMiddleware = (type) => (req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Sessão inválida' });
  if (type === 'master' && session.type !== 'master') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  if (type === 'site') {
    const slug = req.params.slug;
    if (session.type !== 'master' && session.slug !== slug) {
      return res.status(403).json({ error: 'Acesso negado a este site' });
    }
  }
  req.session = session;
  next();
};

// Multer config per site
const createUpload = (slug) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, ensureSiteUploadDir(slug));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      const allowedTypes = /mp4|webm|ogg|mov/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('video/');
      if (extname && mimetype) return cb(null, true);
      cb(new Error('Apenas arquivos de vídeo são permitidos'));
    },
    limits: { fileSize: 100 * 1024 * 1024 }
  });
};

// Dynamic multer middleware
const dynamicUpload = (req, res, next) => {
  const slug = req.params.slug;
  const upload = createUpload(slug);
  upload.single('video')(req, res, next);
};

// ============================================================
// AUTH ROUTES
// ============================================================

// Master login
app.post('/api/auth/master/login', (req, res) => {
  const { username, password } = req.body;
  const master = readMaster();
  if (username === master.masterAdmin.username && password === master.masterAdmin.password) {
    const token = generateToken();
    sessions.set(token, { type: 'master', username });
    return res.json({ success: true, token, type: 'master' });
  }
  res.status(401).json({ error: 'Credenciais inválidas' });
});

// Site admin login
app.post('/api/auth/site/:slug/login', (req, res) => {
  const { username, password } = req.body;
  const { slug } = req.params;
  const master = readMaster();
  const site = master.sites.find(s => s.slug === slug);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });
  if (username === site.admin.username && password === site.admin.password) {
    const token = generateToken();
    sessions.set(token, { type: 'site', slug, username });
    return res.json({ success: true, token, type: 'site', slug });
  }
  // Also allow master admin to login to any site
  if (username === master.masterAdmin.username && password === master.masterAdmin.password) {
    const token = generateToken();
    sessions.set(token, { type: 'master', username });
    return res.json({ success: true, token, type: 'master', slug });
  }
  res.status(401).json({ error: 'Credenciais inválidas' });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// Check session
app.get('/api/auth/check', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.json({ authenticated: false });
  const session = sessions.get(token);
  if (!session) return res.json({ authenticated: false });
  res.json({ authenticated: true, ...session });
});

// ============================================================
// MASTER ADMIN ROUTES
// ============================================================

// List all sites
app.get('/api/master/sites', authMiddleware('master'), (req, res) => {
  const master = readMaster();
  res.json({ success: true, sites: master.sites.map(s => ({ ...s, admin: { username: s.admin.username } })) });
});

// Create new site
app.post('/api/master/sites', authMiddleware('master'), (req, res) => {
  const { name, slug, adminUsername, adminPassword } = req.body;
  if (!name || !slug || !adminUsername || !adminPassword) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  const master = readMaster();
  if (master.sites.find(s => s.slug === slug)) {
    return res.status(400).json({ error: 'Slug já existe' });
  }
  const newSite = {
    id: slug,
    slug,
    name,
    createdAt: new Date().toISOString(),
    active: true,
    admin: { username: adminUsername, password: adminPassword }
  };
  master.sites.push(newSite);
  writeMaster(master);

  // Create default content for the site
  const defaultContent = {
    brand: { name: name, logo: '' },
    hero: { title: 'Welcome to ' + name, description: 'Your new website is ready to be customized.' },
    menu: [
      { id: 1, text: 'About', url: `/s/${slug}/page/about` },
      { id: 2, text: 'Contact', url: `/s/${slug}/page/contact` }
    ],
    videos: { source: 'pexels', theme: 'lifestyle', interval: 3000, items: [] },
    pexels: { apiKey: '' },
    pages: [
      { id: 1, slug: 'about', title: 'About', content: '<h2>About Us</h2><p>Tell your story here.</p>' },
      { id: 2, slug: 'contact', title: 'Contact', content: '<h2>Contact</h2><p>Get in touch.</p>' }
    ]
  };
  writeSiteContent(slug, defaultContent);
  ensureSiteUploadDir(slug);

  res.json({ success: true, site: { ...newSite, admin: { username: adminUsername } } });
});

// Delete site
app.delete('/api/master/sites/:slug', authMiddleware('master'), (req, res) => {
  const { slug } = req.params;
  const master = readMaster();
  master.sites = master.sites.filter(s => s.slug !== slug);
  writeMaster(master);
  res.json({ success: true });
});

// Update site admin credentials
app.put('/api/master/sites/:slug/admin', authMiddleware('master'), (req, res) => {
  const { slug } = req.params;
  const { username, password } = req.body;
  const master = readMaster();
  const site = master.sites.find(s => s.slug === slug);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });
  if (username) site.admin.username = username;
  if (password) site.admin.password = password;
  writeMaster(master);
  res.json({ success: true });
});

// Toggle site active
app.put('/api/master/sites/:slug/toggle', authMiddleware('master'), (req, res) => {
  const master = readMaster();
  const site = master.sites.find(s => s.slug === req.params.slug);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });
  site.active = !site.active;
  writeMaster(master);
  res.json({ success: true, active: site.active });
});

// ============================================================
// SITE API ROUTES (per-site)
// ============================================================

// Get site content (public)
app.get('/api/site/:slug/content', (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (content) {
    // Don't expose pexels key publicly
    const publicContent = { ...content };
    if (publicContent.pexels) publicContent.pexels = { apiKey: publicContent.pexels.apiKey ? '***' : '' };
    res.json(publicContent);
  } else {
    res.status(404).json({ error: 'Site não encontrado' });
  }
});

// Get site content (admin - full)
app.get('/api/site/:slug/content/full', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (content) {
    res.json(content);
  } else {
    res.status(404).json({ error: 'Site não encontrado' });
  }
});

// Update brand
app.put('/api/site/:slug/brand', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  content.brand = { ...content.brand, ...req.body };
  writeSiteContent(req.params.slug, content);
  res.json({ success: true, data: content.brand });
});

// Update hero
app.put('/api/site/:slug/hero', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  content.hero = { ...content.hero, ...req.body };
  writeSiteContent(req.params.slug, content);
  res.json({ success: true, data: content.hero });
});

// Update menu
app.put('/api/site/:slug/menu', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  content.menu = req.body;
  writeSiteContent(req.params.slug, content);
  res.json({ success: true, data: content.menu });
});

// Upload video
app.post('/api/site/:slug/videos/upload', authMiddleware('site'), dynamicUpload, (req, res) => {
  const slug = req.params.slug;
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const content = readSiteContent(slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const videoUrl = `/uploads/${slug}/${req.file.filename}`;
  content.videos.items.push({ id: Date.now(), url: videoUrl, type: 'local', filename: req.file.originalname });
  writeSiteContent(slug, content);
  res.json({ success: true, video: { url: videoUrl, filename: req.file.originalname } });
});

// Delete video
app.delete('/api/site/:slug/videos/:id', authMiddleware('site'), (req, res) => {
  const slug = req.params.slug;
  const content = readSiteContent(slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const videoId = parseInt(req.params.id);
  const video = content.videos.items.find(v => v.id === videoId);
  if (video && video.type === 'local') {
    const filePath = path.join(__dirname, video.url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  content.videos.items = content.videos.items.filter(v => v.id !== videoId);
  writeSiteContent(slug, content);
  res.json({ success: true });
});

// Update video settings
app.put('/api/site/:slug/videos/settings', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  content.videos = { ...content.videos, ...req.body, items: content.videos.items };
  writeSiteContent(req.params.slug, content);
  res.json({ success: true, data: content.videos });
});

// Pexels search
app.get('/api/site/:slug/pexels/search', authMiddleware('site'), async (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const apiKey = content.pexels?.apiKey;
  if (!apiKey) return res.status(400).json({ error: 'API Key do Pexels não configurada' });
  const { query = 'lifestyle', per_page = 10 } = req.query;
  try {
    const response = await axios.get('https://api.pexels.com/videos/search', {
      headers: { Authorization: apiKey },
      params: { query, per_page, orientation: 'landscape' }
    });
    const videos = response.data.videos.map(video => {
      const hdFile = video.video_files.find(f => f.quality === 'hd' && f.width >= 1280);
      const sdFile = video.video_files.find(f => f.quality === 'sd' && f.width >= 960);
      const bestFile = hdFile || sdFile || video.video_files[0];
      return { id: video.id, url: bestFile?.link || '', thumbnail: video.image, duration: video.duration };
    });
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar vídeos do Pexels' });
  }
});

// Add Pexels video
app.post('/api/site/:slug/pexels/add', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const { url, thumbnail } = req.body;
  content.videos.items.push({ id: Date.now(), url, thumbnail, type: 'pexels' });
  writeSiteContent(req.params.slug, content);
  res.json({ success: true });
});

// Update Pexels API Key
app.put('/api/site/:slug/pexels/apikey', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  content.pexels = { ...content.pexels, apiKey: req.body.apiKey };
  writeSiteContent(req.params.slug, content);
  res.json({ success: true });
});

// ============================================================
// PAGES API (subpages per site)
// ============================================================

// List pages
app.get('/api/site/:slug/pages', (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  res.json({ success: true, pages: content.pages || [] });
});

// Get single page
app.get('/api/site/:slug/pages/:pageSlug', (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const page = (content.pages || []).find(p => p.slug === req.params.pageSlug);
  if (!page) return res.status(404).json({ error: 'Página não encontrada' });
  res.json({ success: true, page });
});

// Create page
app.post('/api/site/:slug/pages', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const { title, slug: pageSlug, content: pageContent } = req.body;
  if (!title || !pageSlug) return res.status(400).json({ error: 'Título e slug são obrigatórios' });
  if (!content.pages) content.pages = [];
  if (content.pages.find(p => p.slug === pageSlug)) {
    return res.status(400).json({ error: 'Slug de página já existe' });
  }
  const newPage = { id: Date.now(), slug: pageSlug, title, content: pageContent || '' };
  content.pages.push(newPage);
  writeSiteContent(req.params.slug, content);
  res.json({ success: true, page: newPage });
});

// Update page
app.put('/api/site/:slug/pages/:pageSlug', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const pageIndex = (content.pages || []).findIndex(p => p.slug === req.params.pageSlug);
  if (pageIndex === -1) return res.status(404).json({ error: 'Página não encontrada' });
  const { title, content: pageContent } = req.body;
  if (title) content.pages[pageIndex].title = title;
  if (pageContent !== undefined) content.pages[pageIndex].content = pageContent;
  writeSiteContent(req.params.slug, content);
  res.json({ success: true, page: content.pages[pageIndex] });
});

// Delete page
app.delete('/api/site/:slug/pages/:pageSlug', authMiddleware('site'), (req, res) => {
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  content.pages = (content.pages || []).filter(p => p.slug !== req.params.pageSlug);
  writeSiteContent(req.params.slug, content);
  res.json({ success: true });
});

// ============================================================
// VIDEO PROXY
// ============================================================

app.get('/api/video-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL não fornecida' });
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
    if (req.headers.range) headers['Range'] = req.headers.range;
    const response = await axios({ method: 'get', url, responseType: 'stream', headers, timeout: 30000 });
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
    if (response.headers['content-range']) { res.setHeader('Content-Range', response.headers['content-range']); res.status(206); }
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar vídeo: ' + error.message });
  }
});

// ============================================================
// HTML PAGE ROUTES
// ============================================================

// Master admin panel
app.get('/master', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'master.html'));
});

// Master admin login
app.get('/master/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'master-login.html'));
});

// Site public page
app.get('/s/:slug', (req, res) => {
  const master = readMaster();
  const site = master.sites.find(s => s.slug === req.params.slug);
  if (!site || !site.active) return res.status(404).send('Site não encontrado');
  res.sendFile(path.join(__dirname, 'public', 'site.html'));
});

// Site subpage
app.get('/s/:slug/page/:pageSlug', (req, res) => {
  const master = readMaster();
  const site = master.sites.find(s => s.slug === req.params.slug);
  if (!site || !site.active) return res.status(404).send('Site não encontrado');
  res.sendFile(path.join(__dirname, 'public', 'page.html'));
});

// Site admin login
app.get('/s/:slug/login', (req, res) => {
  const master = readMaster();
  const site = master.sites.find(s => s.slug === req.params.slug);
  if (!site) return res.status(404).send('Site não encontrado');
  res.sendFile(path.join(__dirname, 'public', 'site-login.html'));
});

// Site admin panel
app.get('/s/:slug/admin', (req, res) => {
  const master = readMaster();
  const site = master.sites.find(s => s.slug === req.params.slug);
  if (!site) return res.status(404).send('Site não encontrado');
  res.sendFile(path.join(__dirname, 'public', 'site-admin.html'));
});

// Homepage - redirect to master or show site list
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Plataforma rodando em http://localhost:${PORT}`);
  console.log(`� Master Admin: http://localhost:${PORT}/master`);
  console.log(`🌐 Sites: http://localhost:${PORT}/s/{slug}`);
});
