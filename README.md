# MIRIDIAN - Multi-Tenant Website Builder Platform

Plataforma SaaS para criar websites minimalistas com template de vídeo de fundo, gestão completa por site e sistema de subpáginas.

## 🚀 Características

- **Multi-Tenant**: Crie múltiplos websites isolados com um único sistema
- **Master Admin**: Painel para gerir todos os sites da plataforma
- **Admin por Site**: Cada site tem o seu próprio painel de administração
- **Template MIRIDIAN**: Design minimalista com vídeos de fundo em rotação
- **Subpáginas**: Crie páginas próprias com editor HTML simples
- **Upload de Vídeos**: Suporte para vídeos locais e integração com Pexels API
- **Autenticação**: Sistema de login separado (Master + Site Admin)
- **Responsivo**: Funciona perfeitamente em desktop e mobile

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Ou em modo desenvolvimento (com auto-reload)
npm run dev
```

## 🌐 Estrutura de URLs

| URL | Descrição |
|-----|-----------|
| `/` | Homepage da plataforma |
| `/master/login` | Login do Master Admin |
| `/master` | Painel Master Admin |
| `/s/{slug}` | Site público (template MIRIDIAN) |
| `/s/{slug}/login` | Login do admin do site |
| `/s/{slug}/admin` | Painel admin do site |
| `/s/{slug}/page/{pageSlug}` | Subpágina pública |

## 🔑 Credenciais Padrão

- **Master Admin**: `admin` / `admin123`
- **Site MIRIDIAN** (exemplo): `miridian` / `miridian123`

## 👑 Master Admin

No painel Master Admin você pode:

- Criar novos sites com template MIRIDIAN
- Ativar/desativar sites
- Gerir credenciais de admin de cada site
- Ver estatísticas da plataforma
- Eliminar sites

## ⚙️ Admin por Site

Cada site tem o seu próprio painel onde pode:

1. **Marca**: Editar nome e identidade
2. **Hero**: Editar título e descrição principal
3. **Menu**: Adicionar/remover links de navegação
4. **Vídeos**: Upload de vídeos locais e configurar intervalo de rotação
5. **Pexels API**: Buscar e adicionar vídeos gratuitos do Pexels
6. **Páginas**: Criar e editar subpáginas com editor HTML

## 📄 Sistema de Subpáginas

Cada site pode ter múltiplas subpáginas:

- Editor HTML simples com toolbar
- URLs amigáveis: `/s/{slug}/page/{page-slug}`
- Navegação automática entre páginas
- Conteúdo totalmente personalizável

## 👥 Sistema de Colaboradores

Cada site pode ter colaboradores com acesso ao painel admin:

- **Site Admin** pode adicionar/remover colaboradores
- **Colaboradores** têm acesso total ao conteúdo mas não podem gerir a equipa
- Login independente com credenciais próprias
- Isolamento completo entre sites

## 📦 Export & Deploy Independente

O MIRIDIAN suporta **deploy independente** de cada site:

### Como Exportar um Site

1. No **Master Admin** ou **Site Admin**, clique em "📦 Export"
2. Será baixado um arquivo ZIP com o site standalone
3. O site exportado é **totalmente independente** do MIRIDIAN

### O que vem no Export

```
site-standalone.zip
├── server.js           # Servidor Express standalone
├── package.json        # Dependências mínimas
├── README.md          # Instruções de deploy
├── .gitignore         # Configuração Git
├── data/
│   └── content.json   # Todo o conteúdo do site
├── uploads/           # Todos os vídeos
└── public/            # Frontend completo
```

### Deploy do Site Standalone

**Vercel:**
```bash
npm i -g vercel
cd site-standalone
npm install
vercel
```

**Railway:**
```bash
# Conecte o repositório ao Railway
# Deploy automático
```

**Heroku:**
```bash
heroku create
git push heroku main
```

**VPS/Servidor Próprio:**
```bash
npm install
npm start
# Site disponível em http://localhost:3000
```

### Domínio Customizado

Após o deploy, configure o domínio customizado no painel do seu provider:
- **Vercel**: Settings → Domains
- **Railway**: Settings → Domains
- **Heroku**: Settings → Domains

### Vantagens do Deploy Independente

✅ **Total independência** do MIRIDIAN  
✅ **Domínio próprio** (ex: `www.seusite.com`)  
✅ **Escalabilidade** individual  
✅ **Atualizações** não afetam outros sites  
✅ **Backup** completo do site  
✅ **Portabilidade** entre providers  

### Sistema Híbrido

- Sites podem ficar no MIRIDIAN ou serem exportados
- Re-export a qualquer momento para atualizar
- Dados podem ser editados no MIRIDIAN e re-exportados
- Cada site evolui de forma independente após export

## 🎨 Pexels API

Para usar vídeos do Pexels:

1. Crie uma conta em [pexels.com](https://www.pexels.com)
2. Obtenha sua API Key gratuita em [pexels.com/api](https://www.pexels.com/api)
3. Cole a API Key no painel admin do site

## 📁 Estrutura do Projeto

```
├── server.js                    # Servidor Express multi-tenant
├── package.json                 # Dependências
├── data/
│   ├── master.json             # Dados da plataforma e lista de sites
│   └── sites/
│       └── {slug}/
│           └── content.json    # Dados de cada site
├── public/
│   ├── home.html               # Homepage da plataforma
│   ├── master-login.html       # Login master
│   ├── master.html             # Painel master admin
│   ├── site-login.html         # Login por site
│   ├── site-admin.html         # Painel admin por site
│   ├── site.html               # Template público (MIRIDIAN)
│   └── page.html               # Template de subpáginas
└── uploads/
    └── {slug}/                 # Vídeos por site
```

## 🛠️ Tecnologias

- **Frontend**: HTML/CSS/JS vanilla
- **Backend**: Node.js + Express
- **Upload**: Multer
- **HTTP Client**: Axios
- **API Externa**: Pexels API
- **Autenticação**: Token-based (in-memory sessions)

## 🔒 Segurança

- Autenticação por token
- Sessões separadas por tipo (master vs site)
- Isolamento de dados por site
- API Keys do Pexels não expostas publicamente

## 📝 Licença

MIT
