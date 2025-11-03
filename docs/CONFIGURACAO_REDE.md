# 🌐 Configuração para Acesso em Rede Local

## Problema
O sistema não funciona em outros computadores porque está configurado para `localhost`.

## Solução

### 1️⃣ No PC que roda o BACKEND (servidor):

1. **Descubra o IP da máquina:**
   ```powershell
   ipconfig
   ```
   Procure por "Endereço IPv4" (ex: `192.168.1.10`)

2. **Configure o backend para aceitar conexões externas**
   
   Edite `backend\.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=fabrica_db
   DB_USER=postgres
   DB_PASSWORD=sua_senha
   PORT=3001
   ```

3. **Inicie o backend:**
   ```powershell
   cd backend
   npm run dev
   ```

4. **Libere o Firewall** (se necessário):
   - Windows Firewall → Regras de Entrada
   - Nova Regra → Porta → TCP → 3001
   - Permitir conexão

### 2️⃣ Nos outros PCs (clientes):

1. **Configure o arquivo `.env` na raiz do projeto:**
   ```
   VITE_API_URL=http://192.168.1.10:3001
   ```
   ⚠️ Substitua `192.168.1.10` pelo IP do servidor!

2. **Inicie o frontend:**
   ```powershell
   npm run dev
   ```

3. **Acesse no navegador:**
   ```
   http://localhost:8080
   ```

## ✅ Testando a Conexão

No navegador do cliente, abra o Console (F12) e execute:
```javascript
fetch('/api/activity/stats')
  .then(r => r.json())
  .then(console.log)
```

Se retornar dados, está funcionando! 🎉

## 🔧 Troubleshooting

### Erro: "ERR_CONNECTION_REFUSED"
- Verifique se o backend está rodando no servidor
- Confirme o IP do servidor está correto no `.env`
- Verifique o firewall

### Erro: "Network Error"
- Verifique se ambos PCs estão na mesma rede
- Teste ping: `ping 192.168.1.10`

### Página de logs vazia
- Execute no servidor: `node backend/check-logs-table.js`
- Isso criará a tabela se não existir

## 📋 Configuração Rápida

**Servidor:**
```powershell
cd backend
npm install
node check-logs-table.js
npm run dev
```

**Cliente:**
```powershell
# Criar/editar .env
echo VITE_API_URL=http://IP_DO_SERVIDOR:3001 > .env
npm install
npm run dev
```
