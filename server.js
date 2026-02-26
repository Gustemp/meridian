const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// Virtual Host Middleware - Map custom domains to site slugs
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const hostname = host.split(':')[0]; // Remove port
  
  // Skip for localhost and internal routes
  if (hostname === 'localhost' || hostname === '127.0.0.1' || req.path.startsWith('/api/') || req.path.startsWith('/master')) {
    return next();
  }
  
  // Check if hostname matches a custom domain
  const master = readMaster();
  const site = master.sites.find(s => s.customDomain && s.customDomain.toLowerCase() === hostname.toLowerCase());
  
  if (site && site.active) {
    // Store the matched site slug for later use
    req.customDomainSlug = site.slug;
  }
  
  next();
});

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
  // Accept token from header or query parameter (for file downloads)
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Sessão inválida' });
  if (type === 'master' && session.type !== 'master') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  if (type === 'site' && session.type !== 'site' && session.type !== 'master') {
    return res.status(403).json({ error: 'Acesso negado' });
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

// Site admin login (also supports collaborators)
app.post('/api/auth/site/:slug/login', (req, res) => {
  const { username, password } = req.body;
  const { slug } = req.params;
  const master = readMaster();
  const site = master.sites.find(s => s.slug === slug);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });
  
  // Check if site admin
  if (username === site.admin.username && password === site.admin.password) {
    const token = generateToken();
    sessions.set(token, { type: 'site', slug, username, role: 'admin' });
    return res.json({ success: true, token, type: 'site', slug, role: 'admin' });
  }
  
  // Check if collaborator
  const content = readSiteContent(slug);
  if (content && content.collaborators) {
    const collaborator = content.collaborators.find(c => c.username === username && c.password === password);
    if (collaborator) {
      const token = generateToken();
      sessions.set(token, { type: 'site', slug, username, role: 'collaborator' });
      return res.json({ success: true, token, type: 'site', slug, role: 'collaborator' });
    }
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
  const { name, slug, customDomain, adminUsername, adminPassword } = req.body;
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
    customDomain: customDomain || '',
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

// Update custom domain
app.put('/api/site/:slug/domain', authMiddleware('site'), (req, res) => {
  const { slug } = req.params;
  const { customDomain } = req.body;
  
  // Only site admin or master can update domain
  if (req.session.type !== 'master' && req.session.role === 'collaborator') {
    return res.status(403).json({ error: 'Apenas o admin do site pode atualizar o domínio' });
  }
  
  const master = readMaster();
  const site = master.sites.find(s => s.slug === slug);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });
  
  site.customDomain = customDomain || '';
  writeMaster(master);
  res.json({ success: true, customDomain: site.customDomain });
});

// Update Railway project URL
app.put('/api/site/:slug/railway', authMiddleware('site'), (req, res) => {
  const { slug } = req.params;
  const { railwayUrl } = req.body;
  
  // Only site admin or master can update Railway URL
  if (req.session.type !== 'master' && req.session.role === 'collaborator') {
    return res.status(403).json({ error: 'Apenas o admin do site pode atualizar o Railway URL' });
  }
  
  const master = readMaster();
  const site = master.sites.find(s => s.slug === slug);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });
  
  site.railwayUrl = railwayUrl || '';
  writeMaster(master);
  res.json({ success: true, railwayUrl: site.railwayUrl });
});

// ============================================================
// SITE API ROUTES (per-site)
// ============================================================

// Get site content via custom domain (no slug in URL)
app.get('/api/site/content', (req, res) => {
  const slug = req.customDomainSlug;
  if (!slug) {
    return res.status(400).json({ error: 'Acesso via custom domain não configurado' });
  }
  const content = readSiteContent(slug);
  if (content) {
    const publicContent = { ...content };
    if (publicContent.pexels) publicContent.pexels = { apiKey: publicContent.pexels.apiKey ? '***' : '' };
    res.json({ ...publicContent, _slug: slug }); // Include slug for frontend
  } else {
    res.status(404).json({ error: 'Site não encontrado' });
  }
});

// Get site content (public) via /s/:slug
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
// COLLABORATORS (only site admin can manage)
// ============================================================

// Get collaborators (site admin only)
app.get('/api/site/:slug/collaborators', authMiddleware('site'), (req, res) => {
  // Only site admin (not collaborators) can view collaborators
  if (req.session.type !== 'master' && req.session.role === 'collaborator') {
    return res.status(403).json({ error: 'Apenas o admin do site pode gerir colaboradores' });
  }
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const collaborators = (content.collaborators || []).map(c => ({
    id: c.id,
    username: c.username,
    email: c.email,
    role: c.role,
    addedAt: c.addedAt
  }));
  res.json({ success: true, collaborators });
});

// Add collaborator (site admin only)
app.post('/api/site/:slug/collaborators', authMiddleware('site'), (req, res) => {
  if (req.session.type !== 'master' && req.session.role === 'collaborator') {
    return res.status(403).json({ error: 'Apenas o admin do site pode adicionar colaboradores' });
  }
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  const { username, password, email, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password são obrigatórios' });
  }
  if (!content.collaborators) content.collaborators = [];
  // Check if username already exists
  if (content.collaborators.find(c => c.username === username)) {
    return res.status(400).json({ error: 'Username já existe' });
  }
  const newCollaborator = {
    id: Date.now(),
    username,
    password,
    email: email || '',
    role: role || 'collaborator',
    addedAt: new Date().toISOString()
  };
  content.collaborators.push(newCollaborator);
  writeSiteContent(req.params.slug, content);
  res.json({ success: true, collaborator: {
    id: newCollaborator.id,
    username: newCollaborator.username,
    email: newCollaborator.email,
    role: newCollaborator.role,
    addedAt: newCollaborator.addedAt
  }});
});

// Delete collaborator (site admin only)
app.delete('/api/site/:slug/collaborators/:id', authMiddleware('site'), (req, res) => {
  if (req.session.type !== 'master' && req.session.role === 'collaborator') {
    return res.status(403).json({ error: 'Apenas o admin do site pode remover colaboradores' });
  }
  const content = readSiteContent(req.params.slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  content.collaborators = (content.collaborators || []).filter(c => c.id !== parseInt(req.params.id));
  writeSiteContent(req.params.slug, content);
  res.json({ success: true });
});

// ============================================================
// EXPORT SITE (standalone deployment)
// ============================================================

// Export site as standalone project
app.get('/api/site/:slug/export', authMiddleware('site'), (req, res) => {
  const { slug } = req.params;
  
  // Only site admin or master can export
  if (req.session.type !== 'master' && req.session.role === 'collaborator') {
    return res.status(403).json({ error: 'Apenas o admin do site pode exportar' });
  }
  
  const content = readSiteContent(slug);
  if (!content) return res.status(404).json({ error: 'Site não encontrado' });
  
  const master = readMaster();
  const site = master.sites.find(s => s.slug === slug);
  if (!site) return res.status(404).json({ error: 'Site não encontrado' });

  // Create ZIP archive
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  res.attachment(`${slug}-standalone.zip`);
  archive.pipe(res);

  // Add server.js
  const serverTemplate = fs.readFileSync(path.join(__dirname, 'templates', 'standalone-server.js'), 'utf8');
  archive.append(serverTemplate, { name: 'server.js' });

  // Add package.json
  const packageTemplate = fs.readFileSync(path.join(__dirname, 'templates', 'standalone-package.json'), 'utf8');
  const packageJson = packageTemplate.replace('{{SITE_NAME}}', slug);
  archive.append(packageJson, { name: 'package.json' });

  // Add README
  const readmeTemplate = fs.readFileSync(path.join(__dirname, 'templates', 'standalone-README.md'), 'utf8');
  const readme = readmeTemplate.replace(/{{SITE_NAME}}/g, site.name);
  archive.append(readme, { name: 'README.md' });

  // Add .gitignore
  archive.append('node_modules/\n.env\nuploads/\n*.log\n.DS_Store', { name: '.gitignore' });

  // Add railway.json for Railway deployment
  const railwayConfig = fs.readFileSync(path.join(__dirname, 'templates', 'railway.json'), 'utf8');
  archive.append(railwayConfig, { name: 'railway.json' });

  // Add content.json (without collaborators for security)
  const exportContent = { ...content };
  delete exportContent.collaborators;
  archive.append(JSON.stringify(exportContent, null, 2), { name: 'data/content.json' });

  // Add public files
  const publicFiles = ['site.html', 'page.html', 'main.js', 'styles.css'];
  publicFiles.forEach(file => {
    const filePath = path.join(__dirname, 'public', file);
    if (fs.existsSync(filePath)) {
      const fileName = file === 'site.html' ? 'index.html' : file;
      archive.file(filePath, { name: `public/${fileName}` });
    }
  });

  // Add uploads directory
  const uploadsDir = path.join(__dirname, 'uploads', slug);
  if (fs.existsSync(uploadsDir)) {
    archive.directory(uploadsDir, 'uploads');
  }

  archive.finalize();
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

// Site public page (via custom domain or /s/:slug)
app.get('/s/:slug', (req, res) => {
  const master = readMaster();
  const site = master.sites.find(s => s.slug === req.params.slug);
  if (!site || !site.active) return res.status(404).send('Site não encontrado');
  res.sendFile(path.join(__dirname, 'public', 'site.html'));
});

// Site subpage (via custom domain or /s/:slug/page/:pageSlug)
app.get('/s/:slug/page/:pageSlug', (req, res) => {
  const master = readMaster();
  const site = master.sites.find(s => s.slug === req.params.slug);
  if (!site || !site.active) return res.status(404).send('Site não encontrado');
  res.sendFile(path.join(__dirname, 'public', 'page.html'));
});

// Custom domain: Root page
app.get('/', (req, res) => {
  // If accessed via custom domain, serve the site
  if (req.customDomainSlug) {
    return res.sendFile(path.join(__dirname, 'public', 'site.html'));
  }
  // Otherwise, show platform landing or redirect to master
  res.redirect('/master');
});

// Custom domain: Subpages
app.get('/page/:pageSlug', (req, res) => {
  // Only serve if accessed via custom domain
  if (req.customDomainSlug) {
    return res.sendFile(path.join(__dirname, 'public', 'page.html'));
  }
  res.status(404).send('Page not found');
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
