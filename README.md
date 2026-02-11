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
