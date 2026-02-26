# {{SITE_NAME}}

This is a standalone website exported from MIRIDIAN platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode with auto-reload
npm run dev
```

The site will be available at `http://localhost:3000`

## � Admin Panel

Access the admin panel at `http://localhost:3000/admin`

**Default credentials:**
- Username: `admin`
- Password: `admin123`

⚠️ **IMPORTANT:** Change these credentials before deploying to production!

Set environment variables:
```bash
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_secure_password
```

In the admin panel you can:
- ✅ Edit site settings (name, hero, CTA)
- ✅ Create and manage pages
- ✅ Upload images and files
- ✅ Update content in real-time

## �📁 Project Structure

```
.
├── server.js           # Express server
├── package.json        # Dependencies
├── data/
│   └── content.json    # Site content and configuration
├── uploads/            # Uploaded videos
└── public/
    ├── index.html      # Homepage
    ├── page.html       # Subpage template
    ├── main.js         # Frontend logic
    └── styles.css      # Styles
```

## 🌐 Deployment

### Vercel
```bash
npm i -g vercel
vercel
```

### Railway
```bash
# Connect your GitHub repo to Railway
# Railway will auto-detect and deploy
```

### Heroku
```bash
heroku create
git push heroku main
```

### Custom Domain
After deployment, configure your custom domain in your hosting provider's dashboard.

## 📝 Content Management

Edit `data/content.json` to update:
- Brand name and logo
- Hero section
- Menu items
- Videos
- Pages

## 🔄 Syncing with MIRIDIAN

This site is independent but you can re-export from MIRIDIAN anytime to get updates.

---

Exported from **MIRIDIAN** - Multi-tenant Website Builder
