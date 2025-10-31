# 🎯 Guia Visual - 5 Minutos para Começar

## 📌 Você está aqui

Seu projeto tem agora:
- ✅ Backend completo em Node.js + Express + PostgreSQL
- ✅ Frontend React já configurado para usar o backend
- ✅ Documentação completa

## 🚀 3 Passos Simples

### 1️⃣ PostgreSQL (5 min)
```
1. Baixe: https://www.postgresql.org/download/
2. Instale (lembre a senha!)
3. Abra pgAdmin ou psql
4. Execute: CREATE DATABASE fabrica_db;
```

### 2️⃣ Backend (3 min)
```bash
1. Clique duas vezes em: instalar.bat
2. Edite backend\.env (coloque sua senha do PostgreSQL)
3. Abra terminal na pasta backend
4. Execute: npm run db:migrate
5. Execute: npm run dev
```

### 3️⃣ Frontend (1 min)
```bash
1. Abra OUTRO terminal na pasta raiz
2. Execute: npm run dev
3. Abra: http://localhost:5173
```

## 🎉 Pronto!

Agora você tem:
```
┌─────────────────┐
│   localhost:    │
│      5173       │  ← Sua aplicação
│   (Frontend)    │
└────────┬────────┘
         │
         ↓ Faz requisições para
         │
┌────────┴────────┐
│   localhost:    │
│      3001       │  ← Sua API
│   (Backend)     │
└────────┬────────┘
         │
         ↓ Consulta/grava em
         │
┌────────┴────────┐
│   PostgreSQL    │
│  fabrica_db     │  ← Seu banco
└─────────────────┘
```

## 📂 Arquivos Importantes

| Arquivo | O que é |
|---------|---------|
| `GUIA_MIGRACAO.md` | 📖 Guia completo e detalhado |
| `QUICK_START.md` | ⚡ Comandos rápidos |
| `COMANDOS_WINDOWS.md` | 🪟 Comandos para Windows |
| `backend/README.md` | 📚 Documentação da API |
| `RESUMO_BACKEND.md` | 📋 Resumo do que foi feito |
| `instalar.bat` | 🔧 Script de instalação Windows |
| `iniciar-backend.bat` | 🚀 Inicia backend |
| `iniciar-frontend.bat` | 🎨 Inicia frontend |

## 🆘 Problemas?

### Backend não inicia
```
1. PostgreSQL está rodando?
   → Serviços do Windows → PostgreSQL
2. Criou o banco fabrica_db?
   → psql -U postgres
   → CREATE DATABASE fabrica_db;
3. Editou o .env com senha correta?
   → backend\.env → DB_PASSWORD
```

### Frontend não conecta
```
1. Backend está rodando?
   → http://localhost:3001/health
2. Veja erros no console do navegador
   → Pressione F12
```

### Porta já em uso
```
# Mudar porta do backend:
backend\.env → PORT=3002

# Atualizar frontend:
src/services/n8nIntegration.ts
→ Linha 109: 'http://localhost:3002/api'
```

## 💡 Dicas

### Atalhos Windows
- Clique 2x em `instalar.bat` → Instala tudo
- Clique 2x em `iniciar-backend.bat` → Inicia backend
- Clique 2x em `iniciar-frontend.bat` → Inicia frontend

### Sempre rodando
Mantenha 2 terminais abertos:
1. Backend (porta 3001)
2. Frontend (porta 5173)

### Dados de teste
Quer popular o banco com exemplos?
```bash
cd backend
psql -U postgres -d fabrica_db -f seed.sql
```

## 📞 Precisa de Ajuda?

1. **Primeiro**: Leia `GUIA_MIGRACAO.md` seção "Troubleshooting"
2. **Depois**: Veja logs dos terminais (backend e frontend)
3. **Console**: Abra F12 no navegador e veja erros

## ✅ Checklist Rápido

Antes de testar, confirme:
- [ ] PostgreSQL instalado e rodando
- [ ] Banco `fabrica_db` criado
- [ ] `backend/.env` configurado (senha!)
- [ ] `npm install` executado (backend e frontend)
- [ ] `npm run db:migrate` executado
- [ ] Backend rodando (localhost:3001)
- [ ] Frontend rodando (localhost:5173)

## 🎓 Próximos Passos

Depois que tudo funcionar:
1. ✅ Teste criar cliente
2. ✅ Teste criar produto
3. ✅ Teste fazer venda
4. ✅ Veja o dashboard
5. ✅ Explore a aplicação!

---

## 🔥 TL;DR (Resumão)

```bash
# 1. Instale PostgreSQL e crie banco fabrica_db

# 2. Terminal 1:
cd backend
npm install
copy .env.example .env
# Edite .env com sua senha!
npm run db:migrate
npm run dev

# 3. Terminal 2:
npm install
npm run dev

# 4. Abra: http://localhost:5173
```

---

**🎉 É isso! Simples e rápido. Boa sorte!**

**Dúvida?** → Leia `GUIA_MIGRACAO.md`
