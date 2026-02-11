// Admin Panel - JavaScript

let content = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadContent();
  setupNavigation();
  setupVideoUpload();
});

// Navigation
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      
      // Update nav
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Update sections
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${section}`).classList.add('active');
    });
  });
}

// Load Content
async function loadContent() {
  try {
    const response = await fetch('/api/content');
    content = await response.json();
    
    // Populate forms
    document.getElementById('brand-name').value = content.brand.name || '';
    document.getElementById('hero-title').value = content.hero.title || '';
    document.getElementById('hero-description').value = content.hero.description || '';
    document.getElementById('video-interval').value = content.videos.interval || 3000;
    document.getElementById('pexels-api-key').value = content.pexels?.apiKey || '';
    
    renderMenuItems();
    renderVideoList();
    
  } catch (error) {
    showToast('Erro ao carregar conteúdo', 'error');
  }
}

// Save Brand
async function saveBrand() {
  try {
    const name = document.getElementById('brand-name').value;
    
    await fetch('/api/content/brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    showToast('Marca atualizada com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao salvar marca', 'error');
  }
}

// Save Hero
async function saveHero() {
  try {
    const title = document.getElementById('hero-title').value;
    const description = document.getElementById('hero-description').value;
    
    await fetch('/api/content/hero', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    
    showToast('Hero atualizado com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao salvar hero', 'error');
  }
}

// Menu Items
function renderMenuItems() {
  const container = document.getElementById('menu-items');
  container.innerHTML = content.menu.map((item, index) => `
    <div class="menu-item" data-id="${item.id}">
      <input type="text" value="${item.text}" placeholder="Texto do link" data-field="text">
      <input type="text" value="${item.url}" placeholder="URL (ex: #contato)" data-field="url">
      <button class="btn-delete" onclick="removeMenuItem(${item.id})">Remover</button>
    </div>
  `).join('');
}

function addMenuItem() {
  const newItem = {
    id: Date.now(),
    text: 'Novo Link',
    url: '#'
  };
  content.menu.push(newItem);
  renderMenuItems();
}

function removeMenuItem(id) {
  content.menu = content.menu.filter(item => item.id !== id);
  renderMenuItems();
}

async function saveMenu() {
  try {
    // Collect menu data from inputs
    const menuItems = [];
    document.querySelectorAll('.menu-item').forEach(item => {
      const id = parseInt(item.dataset.id);
      const text = item.querySelector('[data-field="text"]').value;
      const url = item.querySelector('[data-field="url"]').value;
      menuItems.push({ id, text, url });
    });
    
    await fetch('/api/content/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menuItems)
    });
    
    content.menu = menuItems;
    showToast('Menu atualizado com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao salvar menu', 'error');
  }
}

// Video Upload
function setupVideoUpload() {
  const input = document.getElementById('video-upload');
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('video', file);
    
    try {
      showToast('Enviando vídeo...', 'success');
      
      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadContent();
        showToast('Vídeo enviado com sucesso!', 'success');
      } else {
        showToast(result.error || 'Erro ao enviar vídeo', 'error');
      }
    } catch (error) {
      showToast('Erro ao enviar vídeo', 'error');
    }
    
    input.value = '';
  });
}

function renderVideoList() {
  const container = document.getElementById('video-list');
  
  if (!content.videos.items || content.videos.items.length === 0) {
    container.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 2rem;">Nenhum vídeo adicionado ainda</p>';
    return;
  }
  
  container.innerHTML = content.videos.items.map(video => `
    <div class="video-item">
      <video src="${video.url}" muted></video>
      <div class="video-info">
        <p>${video.filename || (video.type === 'pexels' ? 'Vídeo do Pexels' : 'Vídeo')}</p>
        <small>${video.type === 'local' ? 'Upload local' : 'Pexels'}</small>
      </div>
      <button class="btn-delete" onclick="deleteVideo(${video.id})">Remover</button>
    </div>
  `).join('');
}

async function deleteVideo(id) {
  if (!confirm('Tem certeza que deseja remover este vídeo?')) return;
  
  try {
    await fetch(`/api/videos/${id}`, { method: 'DELETE' });
    await loadContent();
    showToast('Vídeo removido com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao remover vídeo', 'error');
  }
}

async function saveVideoSettings() {
  try {
    const interval = parseInt(document.getElementById('video-interval').value) || 3000;
    
    await fetch('/api/videos/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval })
    });
    
    showToast('Configurações salvas!', 'success');
  } catch (error) {
    showToast('Erro ao salvar configurações', 'error');
  }
}

// Pexels API
async function savePexelsKey() {
  try {
    const apiKey = document.getElementById('pexels-api-key').value;
    
    await fetch('/api/pexels/apikey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey })
    });
    
    showToast('API Key salva com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao salvar API Key', 'error');
  }
}

async function searchPexels() {
  const query = document.getElementById('pexels-query').value || 'lifestyle';
  const container = document.getElementById('pexels-results');
  
  container.innerHTML = '<p style="color: var(--color-text-muted);">Buscando...</p>';
  
  try {
    const response = await fetch(`/api/pexels/search?query=${encodeURIComponent(query)}`);
    const result = await response.json();
    
    if (!result.success) {
      container.innerHTML = `<p style="color: var(--color-danger);">${result.error}</p>`;
      return;
    }
    
    if (result.videos.length === 0) {
      container.innerHTML = '<p style="color: var(--color-text-muted);">Nenhum vídeo encontrado</p>';
      return;
    }
    
    container.innerHTML = result.videos.map(video => `
      <div class="pexels-item" onclick="addPexelsVideo('${video.url}', '${video.thumbnail}')">
        <img src="${video.thumbnail}" alt="Video thumbnail">
        <div class="overlay">
          <span>Adicionar</span>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    container.innerHTML = '<p style="color: var(--color-danger);">Erro ao buscar vídeos</p>';
  }
}

async function addPexelsVideo(url, thumbnail) {
  try {
    await fetch('/api/pexels/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, thumbnail })
    });
    
    await loadContent();
    showToast('Vídeo adicionado com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao adicionar vídeo', 'error');
  }
}

// Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
