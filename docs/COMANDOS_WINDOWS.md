# Comandos PowerShell para Desenvolvimento

## 🚀 Iniciar Projeto (2 terminais)

### Terminal 1 - Backend
```powershell
cd backend
npm run dev
```

### Terminal 2 - Frontend
```powershell
npm run dev
```

## 📦 Instalação Inicial

### Instalar todas as dependências
```powershell
# Backend
cd backend
npm install
cd ..

# Frontend
npm install
```

## 🗃️ Banco de Dados

### Conectar ao PostgreSQL
```powershell
# Via psql
psql -U postgres

# Via pgAdmin
# Abra pgAdmin4 no menu iniciar
```

### Criar banco de dados
```sql
CREATE DATABASE fabrica_db;
```

### Executar migrations
```powershell
cd backend
npm run db:migrate
```

### Popular banco com dados de teste
```powershell
cd backend
psql -U postgres -d fabrica_db -f seed.sql
```

## 🔧 Comandos Úteis

### Verificar se portas estão em uso
```powershell
# Verificar porta 3001 (backend)
netstat -ano | findstr :3001

# Verificar porta 5173 (frontend)
netstat -ano | findstr :5173
```

### Matar processo em porta específica
```powershell
# Encontrar PID da porta 3001
netstat -ano | findstr :3001

# Matar processo (substitua <PID> pelo número encontrado)
taskkill /PID <PID> /F
```

### Verificar se PostgreSQL está rodando
```powershell
Get-Service -Name postgresql*
```

### Iniciar PostgreSQL (se estiver parado)
```powershell
Start-Service -Name "postgresql-x64-14"  # Ajuste a versão
```

## 🧹 Limpeza

### Limpar node_modules e reinstalar
```powershell
# Backend
cd backend
Remove-Item -Recurse -Force node_modules
npm install
cd ..

# Frontend
Remove-Item -Recurse -Force node_modules
npm install
```

### Limpar cache do npm
```powershell
npm cache clean --force
```

## 📝 Criar arquivo .env

### Backend
```powershell
cd backend
Copy-Item .env.example .env
notepad .env  # Abre no Notepad para editar
```

## 🧪 Testes de API

### Health Check
```powershell
Invoke-WebRequest -Uri http://localhost:3001/health
```

### Listar clientes
```powershell
Invoke-WebRequest -Uri http://localhost:3001/api/clientes | Select-Object -ExpandProperty Content
```

### Testar com formato JSON legível
```powershell
(Invoke-WebRequest -Uri http://localhost:3001/api/clientes).Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## 📊 Ver logs em tempo real

### Backend (em terminal separado)
```powershell
cd backend
npm run dev
# Logs aparecem automaticamente
```

### Frontend (em terminal separado)
```powershell
npm run dev
# Logs aparecem automaticamente
```

## 🔄 Reiniciar serviços

### Parar e reiniciar backend
```powershell
# Pressione Ctrl+C no terminal do backend
# Depois execute novamente:
npm run dev
```

### Parar e reiniciar frontend
```powershell
# Pressione Ctrl+C no terminal do frontend
# Depois execute novamente:
npm run dev
```

## 📦 Build para Produção

### Backend
```powershell
cd backend
npm run build
npm start
```

### Frontend
```powershell
npm run build
# Arquivos estarão em dist/
```

## 🔍 Debug

### Ver todas as variáveis de ambiente do backend
```powershell
cd backend
Get-Content .env
```

### Verificar versão do Node
```powershell
node --version
npm --version
```

### Verificar versão do PostgreSQL
```powershell
psql --version
```

## 📂 Navegação Rápida

### Abrir pasta do projeto no Explorer
```powershell
explorer .
```

### Abrir VS Code na pasta atual
```powershell
code .
```

## 🆘 Troubleshooting

### Erro "cannot be loaded because running scripts is disabled"
```powershell
# Execute como Administrador:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Backend não conecta ao PostgreSQL
```powershell
# 1. Verificar se está rodando
Get-Service postgresql*

# 2. Testar conexão
psql -U postgres -d fabrica_db

# 3. Verificar .env
cd backend
Get-Content .env
```

### Porta já em uso
```powershell
# Ver processos na porta
netstat -ano | findstr :3001

# Matar processo
taskkill /PID <numero_do_pid> /F
```

## 📊 Monitoramento

### Ver uso de memória do Node
```powershell
Get-Process node
```

### Ver logs do PostgreSQL
```powershell
# Localização padrão no Windows:
# C:\Program Files\PostgreSQL\14\data\log
```

## 🎯 Atalhos Úteis

```powershell
# Limpar terminal
Clear-Host  # ou cls

# Ver histórico de comandos
Get-History

# Executar último comando
Invoke-History -Id (Get-History)[-1].Id
```

---

**💡 Dica**: Salve este arquivo como `comandos-windows.md` para referência rápida!
