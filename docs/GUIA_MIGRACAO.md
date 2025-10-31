# 🚀 Guia Completo de Migração: n8n → Backend API

Este guia detalha como migrar seu sistema de n8n para uma arquitetura com backend próprio usando Node.js, Express e PostgreSQL.

## 📋 O que mudou?

**ANTES (com n8n):**
```
Frontend (React) → n8n Webhooks → Google Sheets/Banco
```

**AGORA (sem n8n):**
```
Frontend (React) → Backend API (Express) → PostgreSQL
```

## ✅ Benefícios da Migração

- ✨ **Maior controle**: Você tem total controle sobre a lógica de negócio
- 🚀 **Melhor performance**: Sem intermediário, acesso direto ao banco
- 🔒 **Mais seguro**: Credenciais do banco não ficam expostas
- 💰 **Economia**: Não precisa manter servidor n8n
- 🛠️ **Mais flexível**: Fácil adicionar novas funcionalidades

## 📦 Pré-requisitos

Antes de começar, instale:

1. **Node.js** (v18 ou superior) - [Download](https://nodejs.org/)
2. **PostgreSQL** (v14 ou superior) - [Download](https://www.postgresql.org/download/)
3. **Git** (opcional) - [Download](https://git-scm.com/)

## 🔧 Passo 1: Configurar PostgreSQL

### Windows

1. Baixe e instale PostgreSQL
2. Durante a instalação, defina uma senha para o usuário `postgres`
3. Abra o **pgAdmin** ou **SQL Shell (psql)**
4. Crie o banco de dados:

```sql
CREATE DATABASE fabrica_db;
```

### Linux/Mac

```bash
# Instalar PostgreSQL
sudo apt-get install postgresql postgresql-contrib  # Ubuntu/Debian
brew install postgresql  # Mac

# Acessar PostgreSQL
sudo -u postgres psql

# Criar banco
CREATE DATABASE fabrica_db;

# Criar usuário (opcional)
CREATE USER seu_usuario WITH PASSWORD 'sua_senha';
GRANT ALL PRIVILEGES ON DATABASE fabrica_db TO seu_usuario;
```

## 🚀 Passo 2: Configurar Backend

### 2.1 Instalar dependências

Abra um terminal na pasta `backend`:

```bash
cd backend
npm install
```

Isso instalará todas as dependências necessárias:
- express
- pg (driver PostgreSQL)
- cors
- dotenv
- helmet
- compression
- typescript
- tsx (para desenvolvimento)

### 2.2 Configurar variáveis de ambiente

Copie o arquivo de exemplo:

```bash
# Windows PowerShell
copy .env.example .env

# Linux/Mac/Git Bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:

```env
# Configurações do PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fabrica_db
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_AQUI  # ⚠️ Coloque a senha do PostgreSQL

# Porta do servidor backend
PORT=3001

# Ambiente
NODE_ENV=development

# URLs permitidas pelo CORS (separadas por vírgula)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

**⚠️ IMPORTANTE:** Altere `DB_PASSWORD` para a senha do seu PostgreSQL!

### 2.3 Criar tabelas no banco de dados

Execute o script de migration:

```bash
npm run db:migrate
```

Você deverá ver algo como:

```
🔧 Criando tabelas no banco de dados...
✅ Tabela clientes criada
✅ Tabela estoque criada
✅ Tabela componentes_kit criada
✅ Tabela materia_prima criada
✅ Tabela receita_produto criada
✅ Tabela vendas criada
✅ Tabela vendas_itens criada
✅ Tabela pagamentos criada
✅ Índices criados
🎉 Todas as tabelas foram criadas com sucesso!
```

### 2.4 Iniciar o servidor backend

```bash
npm run dev
```

Você deverá ver:

```
🚀 Servidor rodando em http://localhost:3001
📊 Ambiente: development
🔒 CORS configurado para: http://localhost:5173
✅ Conectado ao PostgreSQL
```

**✅ Backend está rodando!** Mantenha este terminal aberto.

## 🎨 Passo 3: Configurar Frontend

O frontend já foi atualizado para usar a nova API! O arquivo `src/services/n8nIntegration.ts` foi modificado para fazer requisições para o backend ao invés do n8n.

### 3.1 Verificar/instalar dependências do frontend

Abra um **NOVO terminal** na pasta raiz do projeto:

```bash
npm install
```

### 3.2 Iniciar o frontend

```bash
npm run dev
```

O frontend iniciará em `http://localhost:5173`

## 🧪 Passo 4: Testar a Aplicação

1. Abra o navegador em `http://localhost:5173`
2. Teste criar um cliente
3. Teste criar um produto
4. Teste fazer uma venda
5. Verifique se os dados aparecem corretamente

### Testar API diretamente

Você pode testar a API usando:

**Health Check:**
```bash
# Windows PowerShell
Invoke-WebRequest -Uri http://localhost:3001/health

# Linux/Mac/Git Bash
curl http://localhost:3001/health
```

**Listar clientes:**
```bash
curl http://localhost:3001/api/clientes
```

## 📊 Passo 5: Migrar Dados Existentes (Opcional)

Se você tem dados no n8n/Google Sheets, pode migrá-los:

### Opção 1: Usar a própria aplicação

1. Exporte os dados do n8n/Sheets para CSV
2. Use a função de importação da aplicação (se disponível)

### Opção 2: Script SQL

Crie um arquivo `seed.sql` com seus dados:

```sql
-- Exemplo de inserção de clientes
INSERT INTO clientes (id_cliente, nome, documento, telefone, email, observacoes)
VALUES 
  ('CLI-001', 'João Silva', '123.456.789-00', '11999999999', 'joao@email.com', ''),
  ('CLI-002', 'Maria Santos', '987.654.321-00', '11888888888', 'maria@email.com', '');

-- Exemplo de inserção de produtos
INSERT INTO estoque (sku, nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario)
VALUES 
  ('PROD-001', 'Produto A', 'Categoria 1', 'Simples', 100, 'UN', 50.00),
  ('PROD-002', 'Produto B', 'Categoria 2', 'Simples', 50, 'UN', 75.00);
```

Execute:

```bash
psql -U postgres -d fabrica_db -f seed.sql
```

## 🐛 Troubleshooting

### Erro: "Não foi possível conectar ao PostgreSQL"

**Solução:**
1. Verifique se o PostgreSQL está rodando
2. Confirme as credenciais no `.env`
3. Teste a conexão:
   ```bash
   psql -U postgres -d fabrica_db
   ```

### Erro: "CORS policy"

**Solução:**
1. Verifique se o backend está rodando
2. Confirme que `ALLOWED_ORIGINS` no `.env` inclui a URL do frontend
3. Reinicie o backend após alterar `.env`

### Erro: "Tabelas não existem"

**Solução:**
```bash
cd backend
npm run db:migrate
```

### Frontend não conecta ao backend

**Solução:**
1. Verifique se o backend está rodando em `http://localhost:3001`
2. Abra o console do navegador (F12) e veja os erros
3. Teste o health check: `http://localhost:3001/health`

### Porta 3001 já está em uso

**Solução:**
Altere a porta no `.env`:
```env
PORT=3002
```

E atualize a URL no frontend (`src/services/n8nIntegration.ts`):
```typescript
const API_URLS = {
  dev: 'http://localhost:3002/api',
  prod: 'http://localhost:3002/api'
};
```

## 📈 Próximos Passos

### Para Desenvolvimento

1. ✅ Backend e frontend rodando localmente
2. 🔄 Testar todas as funcionalidades
3. 🐛 Corrigir bugs encontrados
4. ✨ Adicionar novas funcionalidades

### Para Produção

1. **Deploy do Backend:**
   - Railway, Render, Heroku, DigitalOcean, AWS, etc.
   - Configure variáveis de ambiente no serviço escolhido
   - Use PostgreSQL gerenciado (Railway, Supabase, AWS RDS)

2. **Deploy do Frontend:**
   - Vercel, Netlify, Cloudflare Pages
   - Configure a URL de produção do backend

3. **Configurações de Produção:**
   - Use HTTPS
   - Configure domínio personalizado
   - Ative backups do banco de dados
   - Configure monitoramento

## 🔒 Segurança

### ⚠️ NUNCA faça:
- ❌ Commite o arquivo `.env` no Git
- ❌ Exponha credenciais do banco
- ❌ Desabilite CORS em produção

### ✅ SEMPRE faça:
- ✅ Use variáveis de ambiente
- ✅ Mantenha dependências atualizadas
- ✅ Use HTTPS em produção
- ✅ Faça backups regulares do banco

## 📚 Recursos Adicionais

- [Documentação Express](https://expressjs.com/)
- [Documentação PostgreSQL](https://www.postgresql.org/docs/)
- [Documentação node-postgres (pg)](https://node-postgres.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs do backend (terminal onde o backend está rodando)
2. Verifique o console do navegador (F12)
3. Revise as configurações do `.env`
4. Certifique-se de que o PostgreSQL está rodando

## ✅ Checklist Final

- [ ] PostgreSQL instalado e rodando
- [ ] Banco de dados `fabrica_db` criado
- [ ] Dependências do backend instaladas (`npm install`)
- [ ] Arquivo `.env` configurado com credenciais corretas
- [ ] Migrations executadas (`npm run db:migrate`)
- [ ] Backend rodando (`npm run dev`) na porta 3001
- [ ] Dependências do frontend instaladas
- [ ] Frontend rodando (`npm run dev`) na porta 5173
- [ ] Health check funcionando: http://localhost:3001/health
- [ ] Aplicação testada e funcionando

---

**🎉 Parabéns! Você migrou com sucesso do n8n para uma arquitetura backend própria!**
