# ⚡ Quick Start - Próximos Passos

## 📋 Checklist de Instalação

Execute estes passos em ordem:

### 1. ✅ Instalar PostgreSQL
- Baixe: https://www.postgresql.org/download/
- Configure senha do usuário `postgres`
- Crie banco: `CREATE DATABASE fabrica_db;`

### 2. ✅ Configurar Backend
```bash
cd backend
npm install
cp .env.example .env
# Edite .env com sua senha do PostgreSQL!
npm run db:migrate
npm run dev
```

### 3. ✅ Configurar Frontend
```bash
# Em outro terminal, na pasta raiz
npm install
npm run dev
```

### 4. ✅ Testar
- Abra: http://localhost:5173
- Teste criar cliente, produto, venda

## 🔥 Comandos Rápidos

```bash
# Backend (terminal 1)
cd backend && npm run dev

# Frontend (terminal 2)
npm run dev

# Migration (quando necessário)
cd backend && npm run db:migrate
```

## 🎯 URLs Importantes

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Documentação API**: backend/README.md

## 🐛 Problemas Comuns

### Backend não inicia
```bash
# Verifique se PostgreSQL está rodando
# Windows: Serviços -> PostgreSQL
# Linux: sudo systemctl status postgresql
```

### Erro de conexão
```bash
# Verifique .env no backend
# DB_PASSWORD deve ter a senha correta do PostgreSQL
```

### Porta em uso
```bash
# Altere PORT no .env do backend
# Atualize URL no frontend: src/services/n8nIntegration.ts
```

## 📚 Documentação Completa

- [GUIA_MIGRACAO.md](./GUIA_MIGRACAO.md) - Guia completo passo a passo
- [backend/README.md](./backend/README.md) - Documentação da API
- [README.md](./README.md) - Visão geral do projeto

## 🚀 Próximo Passo

**Leia o GUIA_MIGRACAO.md para instruções detalhadas!**

Ele contém:
- ✅ Passo a passo completo
- ✅ Solução de problemas
- ✅ Como migrar dados existentes
- ✅ Como fazer deploy

---

**Dúvidas?** Consulte a seção de Troubleshooting no GUIA_MIGRACAO.md
