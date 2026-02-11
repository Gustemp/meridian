// Landing Page - Main JavaScript

class LandingPage {
  constructor() {
    this.videos = [];
    this.currentVideoIndex = 0;
    this.videoInterval = 3000;
    this.video1 = document.getElementById('video-bg-1');
    this.video2 = document.getElementById('video-bg-2');
    this.activeVideo = this.video1;
    this.progressContainer = document.getElementById('video-progress');
    this.intervalId = null;
    
    this.init();
  }

  async init() {
    await this.loadContent();
    this.setupVideoRotation();
  }

  async loadContent() {
    try {
      const response = await fetch('/api/content');
      const content = await response.json();
      
      console.log('Content loaded:', content);
      
      // Update brand
      document.getElementById('brand-name').textContent = content.brand.name;
      document.title = `${content.brand.name} - Agência Criativa`;
      
      // Update hero
      document.getElementById('hero-title').textContent = content.hero.title;
      document.getElementById('hero-description').textContent = content.hero.description;
      
      // Update menu
      this.renderMenu(content.menu);
      
      // Setup videos
      this.videoInterval = content.videos.interval || 3000;
      
      if (content.videos.items && content.videos.items.length > 0) {
        // Use proxy for ALL external videos
        this.videos = content.videos.items.map(v => {
          if (v.url.startsWith('http')) {
            return `/api/video-proxy?url=${encodeURIComponent(v.url)}`;
          }
          return v.url;
        });
      } else {
        // Default - use proxy for demo videos too
        this.videos = [
          `/api/video-proxy?url=${encodeURIComponent('https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_30fps.mp4')}`
        ];
      }
      
      console.log('Videos to load:', this.videos);
      this.renderProgressDots();
      
    } catch (error) {
      console.error('Erro ao carregar conteúdo:', error);
    }
  }

  renderMenu(menuItems) {
    const menuNav = document.getElementById('menu-nav');
    menuNav.innerHTML = menuItems.map(item => `
      <a href="${item.url}" class="menu-link">
        <span class="menu-text">${item.text}</span>
        <span class="menu-arrow">→</span>
      </a>
    `).join('');
  }

  renderProgressDots() {
    this.progressContainer.innerHTML = this.videos.map((_, index) => `
      <div class="progress-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>
    `).join('');

    // Add click handlers to dots
    this.progressContainer.querySelectorAll('.progress-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.goToVideo(index);
      });
    });
  }

  setupVideoRotation() {
    if (this.videos.length === 0) {
      console.log('No videos to display');
      return;
    }

    console.log('Setting up video rotation with', this.videos.length, 'videos');
    
    // Load first video
    this.loadVideo(this.video1, this.videos[0], true);
    
    // Preload second video if exists
    if (this.videos.length > 1) {
      this.loadVideo(this.video2, this.videos[1], false);
    }
  }

  loadVideo(videoElement, src, shouldPlay = false) {
    console.log('Loading video:', src, 'shouldPlay:', shouldPlay);
    
    // Clear previous handlers
    videoElement.oncanplay = null;
    videoElement.onerror = null;
    videoElement.onloadeddata = null;
    
    videoElement.src = src;
    
    videoElement.onloadeddata = () => {
      console.log('Video loaded data:', src);
      if (shouldPlay) {
        videoElement.classList.add('active');
        videoElement.play().then(() => {
          console.log('Video playing:', src);
          // Start rotation after first video plays
          if (this.videos.length > 1 && !this.intervalId) {
            this.startRotation();
          }
        }).catch(e => {
          console.log('Autoplay prevented:', e);
          // Try muted autoplay
          videoElement.muted = true;
          videoElement.play().catch(e2 => console.log('Still cannot play:', e2));
        });
      }
    };
    
    videoElement.onerror = (e) => {
      console.error('Error loading video:', src);
      console.error('Error details:', videoElement.error);
    };
    
    videoElement.load();
  }

  startRotation() {
    console.log('Starting rotation, interval:', this.videoInterval);
    this.intervalId = setInterval(() => {
      this.nextVideo();
    }, this.videoInterval);
  }

  stopRotation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  nextVideo() {
    const nextIndex = (this.currentVideoIndex + 1) % this.videos.length;
    this.goToVideo(nextIndex);
  }

  goToVideo(index) {
    if (index === this.currentVideoIndex) return;

    console.log('Going to video:', index);
    this.stopRotation();

    const inactiveVideo = this.activeVideo === this.video1 ? this.video2 : this.video1;
    
    // Load and play new video
    this.loadVideo(inactiveVideo, this.videos[index], false);
    
    // Wait a bit for video to load then crossfade
    setTimeout(() => {
      this.activeVideo.classList.remove('active');
      inactiveVideo.classList.add('active');
      inactiveVideo.play().catch(e => console.log('Play error:', e));
      
      // Update references
      this.activeVideo = inactiveVideo;
      this.currentVideoIndex = index;
      
      // Update dots
      this.updateProgressDots();
      
      // Restart rotation
      if (this.videos.length > 1) {
        this.startRotation();
      }
    }, 500);
  }

  updateProgressDots() {
    this.progressContainer.querySelectorAll('.progress-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === this.currentVideoIndex);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing LandingPage');
  new LandingPage();
});
