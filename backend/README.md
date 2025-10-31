# Backend API - Sistema de Gestão de Fábrica

Backend Node.js com Express, TypeScript e PostgreSQL para substituir a integração com n8n.

## 🚀 Tecnologias

- **Node.js** com **TypeScript**
- **Express** - Framework web
- **PostgreSQL** - Banco de dados relacional
- **pg** - Driver PostgreSQL
- **CORS** - Comunicação cross-origin
- **Helmet** - Segurança HTTP
- **Compression** - Compressão de respostas

## 📦 Estrutura do Projeto

```
backend/
├── src/
│   ├── database/
│   │   ├── db.ts           # Configuração do pool de conexões
│   │   └── migrate.ts      # Script de criação das tabelas
│   ├── routes/
│   │   ├── clientes.ts     # Rotas de clientes
│   │   ├── vendas.ts       # Rotas de vendas
│   │   ├── pagamentos.ts   # Rotas de pagamentos
│   │   ├── estoque.ts      # Rotas de produtos
│   │   ├── materiaPrima.ts # Rotas de matéria-prima
│   │   └── receitaProduto.ts # Rotas de receitas
│   └── server.ts           # Servidor Express
├── .env                    # Variáveis de ambiente (criar)
├── .env.example            # Exemplo de variáveis
├── package.json
└── tsconfig.json
```

## 🔧 Instalação

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e configure suas credenciais do PostgreSQL:

```bash
cp .env.example .env
```

Edite o arquivo `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fabrica_db
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui

PORT=3001
NODE_ENV=development

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 3. Criar banco de dados PostgreSQL

Certifique-se de que o PostgreSQL está instalado e rodando. Crie o banco de dados:

```sql
CREATE DATABASE fabrica_db;
```

### 4. Executar migrations (criar tabelas)

```bash
npm run db:migrate
```

Isso criará todas as tabelas necessárias:
- `clientes`
- `estoque` (produtos)
- `componentes_kit` (produtos compostos)
- `materia_prima`
- `receita_produto` (composição dos produtos)
- `vendas` e `vendas_itens`
- `pagamentos`

## ▶️ Executar o servidor

### Modo desenvolvimento (com hot reload)

```bash
npm run dev
```

### Modo produção

```bash
npm run build
npm start
```

O servidor estará rodando em `http://localhost:3001`

## 📚 API Endpoints

### Clientes

- `GET /api/clientes` - Listar todos os clientes (com saldo)
- `GET /api/clientes/:id` - Buscar cliente por ID
- `POST /api/clientes` - Criar novo cliente
- `PUT /api/clientes/:id` - Atualizar cliente (upsert)
- `DELETE /api/clientes/:id` - Excluir cliente

### Estoque (Produtos)

- `GET /api/estoque` - Listar todos os produtos (com componentes)
- `GET /api/estoque/:sku` - Buscar produto por SKU
- `POST /api/estoque` - Criar novo produto
- `PUT /api/estoque/:sku` - Atualizar produto (upsert)
- `PATCH /api/estoque/:sku/quantidade` - Atualizar quantidade
- `DELETE /api/estoque/:sku` - Excluir produto

### Vendas

- `GET /api/vendas` - Listar todas as vendas (com itens)
- `GET /api/vendas/:id` - Buscar venda por ID
- `POST /api/vendas` - Criar nova venda (atualiza estoque automaticamente)
- `DELETE /api/vendas/:id` - Excluir venda (restaura estoque)

### Pagamentos

- `GET /api/pagamentos` - Listar todos os pagamentos
- `GET /api/pagamentos/:id` - Buscar pagamento por ID
- `POST /api/pagamentos` - Criar novo pagamento
- `DELETE /api/pagamentos/:id` - Excluir pagamento

### Matéria-Prima

- `GET /api/materia-prima` - Listar todas as matérias-primas
- `GET /api/materia-prima/:sku` - Buscar matéria-prima por SKU
- `POST /api/materia-prima` - Criar nova matéria-prima
- `PUT /api/materia-prima/:sku` - Atualizar matéria-prima (upsert)
- `DELETE /api/materia-prima/:sku` - Excluir matéria-prima

### Receita de Produto

- `GET /api/receita-produto` - Listar todas as receitas
- `GET /api/receita-produto/:sku` - Buscar receita por SKU do produto
- `POST /api/receita-produto` - Criar/atualizar receita
- `DELETE /api/receita-produto/:sku` - Excluir receita

### Health Check

- `GET /health` - Verificar status do servidor

## 🔒 Segurança

- **Helmet**: Headers HTTP de segurança
- **CORS**: Controle de origens permitidas
- **Validação**: Validação de dados de entrada
- **SQL Injection Protection**: Uso de prepared statements

## 📊 Banco de Dados

### Schema Principal

**clientes**: Cadastro de clientes  
**estoque**: Produtos disponíveis  
**componentes_kit**: Produtos compostos (kits)  
**materia_prima**: Matérias-primas para fabricação  
**receita_produto**: Receitas de fabricação  
**vendas**: Cabeçalho das vendas  
**vendas_itens**: Itens vendidos  
**pagamentos**: Pagamentos recebidos  

### Relacionamentos

- Vendas → Clientes (FK)
- Vendas Itens → Vendas (FK, ON DELETE CASCADE)
- Vendas Itens → Estoque (FK)
- Pagamentos → Clientes (FK)
- Componentes Kit → Estoque (FK, ON DELETE CASCADE)
- Receita Produto → Estoque e Matéria-Prima (FK, ON DELETE CASCADE)

## 🎯 Próximos Passos

1. ✅ Configurar PostgreSQL
2. ✅ Executar migrations
3. ✅ Iniciar servidor backend
4. 🔄 Atualizar frontend para usar nova API
5. ⚡ Testar endpoints
6. 🚀 Deploy em produção

## 🐛 Troubleshooting

### Erro de conexão com PostgreSQL

Verifique se:
- PostgreSQL está rodando
- Credenciais no `.env` estão corretas
- Banco de dados foi criado
- Firewall não está bloqueando a porta 5432

### Erro de CORS

Adicione a URL do seu frontend em `ALLOWED_ORIGINS` no arquivo `.env`

### Tabelas não existem

Execute: `npm run db:migrate`

## 📝 Logs

O servidor registra todas as requisições e queries no console para debug.

## 🤝 Contribuindo

1. Faça suas alterações
2. Teste localmente
3. Commit e push
4. Crie um Pull Request
