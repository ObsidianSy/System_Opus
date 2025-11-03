# 📊 Sistema de Auditoria e Logs de Atividade

Sistema completo para rastrear todas as ações dos usuários no sistema.

## 🗄️ 1. CONFIGURAÇÃO DO BANCO

Execute o SQL abaixo para criar a estrutura:

```sql
-- Criar tabela de logs de atividade
CREATE TABLE IF NOT EXISTS obsidian.activity_logs (
    id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON obsidian.activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON obsidian.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON obsidian.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON obsidian.activity_logs(entity_type, entity_id);

-- View para resumo de atividades
CREATE OR REPLACE VIEW obsidian.activity_summary AS
SELECT 
    user_email,
    user_name,
    action,
    entity_type,
    COUNT(*) as total_actions,
    MAX(created_at) as last_action
FROM obsidian.activity_logs
GROUP BY user_email, user_name, action, entity_type
ORDER BY last_action DESC;
```

---

## 📡 2. ENDPOINTS DISPONÍVEIS

### **GET /api/activity/logs**
Buscar logs com filtros

**Query Parameters:**
- `user_email` - Filtrar por email do usuário
- `action` - Filtrar por tipo de ação
- `entity_type` - Filtrar por tipo de entidade
- `start_date` - Data inicial (YYYY-MM-DD)
- `end_date` - Data final (YYYY-MM-DD)
- `limit` - Limite de resultados (padrão: 100)
- `offset` - Offset para paginação

**Exemplo:**
```bash
GET /api/activity/logs?user_email=joao@empresa.com&limit=50
```

---

### **GET /api/activity/summary**
Resumo de atividades por usuário e ação

**Resposta:**
```json
[
  {
    "user_email": "joao@empresa.com",
    "user_name": "João Silva",
    "action": "upload_full",
    "entity_type": "envio",
    "total_actions": 15,
    "last_action": "2025-11-03T14:30:00Z"
  }
]
```

---

### **GET /api/activity/stats**
Estatísticas gerais dos últimos N dias

**Query Parameters:**
- `days` - Número de dias (padrão: 7)

**Resposta:**
```json
{
  "total_users": 5,
  "total_actions": 234,
  "total_uploads": 45,
  "total_emissions": 38,
  "total_relations": 151
}
```

---

### **GET /api/activity/user/:email**
Buscar atividades de um usuário específico

**Exemplo:**
```bash
GET /api/activity/user/joao@empresa.com?limit=100
```

---

## 🔧 3. COMO ADICIONAR LOGS NO CÓDIGO

### **Importar a função:**
```typescript
import { logActivity } from '../services/activityLogger';
```

### **Registrar uma ação:**
```typescript
await logActivity({
    user_email: 'joao@empresa.com',      // Obrigatório
    user_name: 'João Silva',             // Opcional
    action: 'upload_full',               // Obrigatório
    entity_type: 'envio',                // Opcional
    entity_id: '123',                    // Opcional
    details: {                           // Opcional (JSON)
        filename: 'planilha.xlsx',
        total_linhas: 50,
        pendentes: 5
    },
    ip_address: req.ip,                  // Opcional
    user_agent: req.get('user-agent')    // Opcional
});
```

---

## 📋 4. TIPOS DE AÇÕES RECOMENDADAS

| Ação | Descrição |
|------|-----------|
| `upload_full` | Upload de planilha FULL |
| `upload_ml` | Upload de planilha ML |
| `emit_sales` | Emissão de vendas |
| `relate_item` | Relacionamento de item |
| `auto_relate` | Auto-relacionamento |
| `match_line` | Match manual de linha |
| `create_kit` | Criação de kit |
| `learn_alias` | Aprendizado de alias |
| `delete_envio` | Exclusão de envio |
| `update_product` | Atualização de produto |

---

## 🎯 5. ONDE ADICIONAR LOGS

Adicione logs em todas as operações importantes:

✅ **Uploads** - Quando usuário importa planilha
✅ **Emissões** - Quando emite vendas
✅ **Relacionamentos** - Quando relaciona SKUs
✅ **Criações** - Quando cria produtos/kits/clientes
✅ **Atualizações** - Quando edita dados
✅ **Exclusões** - Quando deleta registros

---

## 📊 6. FRONTEND - PEGAR EMAIL DO USUÁRIO

No front-end, você precisa enviar o `user_email` nas requisições:

```typescript
// No service, adicionar user_email
formData.append('user_email', userEmail);
formData.append('user_name', userName);
```

Ou criar um hook para pegar do contexto de autenticação:

```typescript
// hooks/useAuth.ts
export function useAuth() {
  return {
    user_email: 'joao@empresa.com',
    user_name: 'João Silva'
  };
}
```

---

## 🔍 7. CONSULTAS SQL ÚTEIS

### **Atividades de hoje:**
```sql
SELECT * FROM obsidian.activity_logs
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

### **Top usuários mais ativos:**
```sql
SELECT user_email, user_name, COUNT(*) as total
FROM obsidian.activity_logs
GROUP BY user_email, user_name
ORDER BY total DESC
LIMIT 10;
```

### **Uploads por dia (últimos 7 dias):**
```sql
SELECT DATE(created_at) as data, COUNT(*) as uploads
FROM obsidian.activity_logs
WHERE action = 'upload_full'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY data DESC;
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Criar tabela `activity_logs` no banco
- [x] Criar service `activityLogger.ts`
- [x] Criar rotas `/api/activity/*`
- [x] Adicionar import no `server.ts`
- [x] Adicionar log em upload FULL
- [ ] Adicionar log em emissão de vendas
- [ ] Adicionar log em relacionamento de itens
- [ ] Criar componente no front para visualizar logs
- [ ] Adicionar autenticação para pegar email do usuário
- [ ] Criar dashboard de atividades

---

**Pronto!** Agora você tem um sistema completo de auditoria! 🚀
