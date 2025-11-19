# Gestao de Ecom - Sistema de Gestão ERP

Sistema completo de gestão empresarial com controle de estoque, vendas, clientes, pagamentos, produção e integração logística (Mercado Livre Full).

## 🏗️ Arquitetura

Este projeto utiliza uma arquitetura moderna com:

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Banco de Dados**: PostgreSQL

```
┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│  Frontend   │ ---> │   Backend   │ ---> │  PostgreSQL  │
│   (React)   │      │  (Express)  │      │              │
└─────────────┘      └─────────────┘      └──────────────┘
```

## 🚀 Início Rápido

### Pré-requisitos

- Node.js v18+ 
- PostgreSQL v14+
- npm ou yarn

### 1. Configurar Backend

```bash
# Navegar para a pasta backend
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais do PostgreSQL

# Criar tabelas no banco
npm run db:migrate

# Iniciar servidor
npm run dev
```

O backend estará rodando em `http://localhost:3001`

### 2. Configurar Frontend

```bash
# Na pasta raiz do projeto
npm install

# Iniciar aplicação
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

## 📚 Documentação Completa

- [**GUIA_MIGRACAO.md**](./GUIA_MIGRACAO.md) - Guia completo de instalação e configuração
- [**backend/README.md**](./backend/README.md) - Documentação da API

## ✨ Funcionalidades

- 📦 **Gestão de Estoque**: Controle de produtos, matéria-prima e kits
- 💰 **Vendas**: Registro de vendas com baixa automática no estoque
- 👥 **Clientes**: Cadastro e controle de clientes com saldo devedor
- 💳 **Pagamentos**: Registro de pagamentos recebidos
- 🏭 **Produção**: Receitas de produtos e controle de matéria-prima
- 📊 **Relatórios**: Dashboards e análises de vendas
- 📥 **Importação**: Importação de dados via planilha

## 🔧 Tecnologias Utilizadas

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- React Query
- Recharts (gráficos)

### Backend
- Node.js
- Express
- TypeScript
- PostgreSQL
- pg (driver PostgreSQL)
- CORS
- Helmet (segurança)

## 📁 Estrutura do Projeto

```
projeto/
├── backend/              # Backend API
│   ├── src/
│   │   ├── database/     # Configuração e migrations do banco
│   │   ├── routes/       # Rotas da API
│   │   └── server.ts     # Servidor Express
│   ├── .env.example      # Exemplo de variáveis de ambiente
│   └── package.json
├── src/                  # Frontend React
│   ├── components/       # Componentes React
│   ├── pages/            # Páginas da aplicação
│   ├── services/         # Serviços de API
│   ├── hooks/            # Custom hooks
│   └── lib/              # Utilitários
├── GUIA_MIGRACAO.md      # Guia completo de instalação
└── package.json
```

## 🔐 Segurança

- Helmet para headers HTTP seguros
- CORS configurável
- Prepared statements (proteção contra SQL injection)
- Variáveis de ambiente para credenciais
- Validação de dados de entrada

## 🚢 Deploy

### Backend

Recomendado:
- Railway
- Render
- Heroku
- DigitalOcean
- AWS

### Frontend

Recomendado:
- Vercel
- Netlify
- Cloudflare Pages

### Banco de Dados

Recomendado:
- Railway (PostgreSQL gerenciado)
- Supabase
- AWS RDS
- DigitalOcean Managed Databases

## 🆘 Suporte e Troubleshooting

Consulte o [GUIA_MIGRACAO.md](./GUIA_MIGRACAO.md) para:
- Instruções detalhadas de instalação
- Solução de problemas comuns
- Guia de migração de dados
- Configurações de produção

## 📝 Project info (Lovable)

**URL**: https://lovable.dev/projects/410aeeb7-bc61-491d-abbb-3f6570a5fee0

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/410aeeb7-bc61-491d-abbb-3f6570a5fee0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/410aeeb7-bc61-491d-abbb-3f6570a5fee0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
