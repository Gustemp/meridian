const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// Read content
const readContent = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'content.json'), 'utf8'));
  } catch (error) {
    console.error('Error reading content:', error);
    return null;
  }
};

// API: Get content
app.get('/api/content', (req, res) => {
  const content = readContent();
  if (content) {
    res.json(content);
  } else {
    res.status(500).json({ error: 'Error loading content' });
  }
});

// API: Get page
app.get('/api/page/:slug', (req, res) => {
  const content = readContent();
  if (!content) return res.status(500).json({ error: 'Error loading content' });
  const page = content.pages?.find(p => p.slug === req.params.slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json({ success: true, page });
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Site running on http://localhost:${PORT}`);
});
