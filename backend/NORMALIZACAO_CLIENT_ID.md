# 🔧 Normalização de client_id - System Opus

## 📊 Problema Identificado
O sistema estava falhando quando recebia o **nome do cliente** ao invés do **ID numérico**:

```
❌ ERRO ANTERIOR:
{
  "client_id": "New Seven"
}
→ invalid input syntax for type bigint: "New Seven"
```

Isso acontecia porque o frontend enviava o nome do cliente em algumas situações, mas o backend esperava apenas IDs numéricos.

---

## ✅ Solução Implementada

### 1️⃣ **Função Helper Centralizada**
**Arquivo**: `backend/src/routes/envios.ts` (linhas ~17-41)

```typescript
async function normalizeClientId(clientIdInput: any): Promise<number | null> {
    if (!clientIdInput) return null;

    // Se já é número, retornar
    if (!isNaN(Number(clientIdInput))) {
        return Number(clientIdInput);
    }

    // Se é string (nome do cliente), buscar ID
    try {
        const result = await pool.query(
            `SELECT id FROM obsidian.clientes WHERE UPPER(nome) ILIKE UPPER($1) LIMIT 1`,
            [clientIdInput]
        );
        
        if (result.rows.length === 0) {
            console.warn(`⚠️ Cliente "${clientIdInput}" não encontrado no banco`);
            return null;
        }
        
        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Erro ao normalizar client_id:', error);
        return null;
    }
}
```

### 2️⃣ **Endpoints Atualizados**
Aplicamos a função `normalizeClientId()` em **TODOS** os endpoints críticos:

| Endpoint | Linha | Descrição |
|----------|-------|-----------|
| `POST /upload` | ~438 | Upload de arquivos ML/FULL |
| `POST /relacionar` (ML) | ~1376 | Auto-relacionamento ML |
| `POST /relacionar-manual` | ~1508 | Relacionamento manual individual |
| `POST /relacionar` (FULL) | ~1869 | Auto-relacionamento FULL |
| `POST /emitir-notas` | ~2092 | Emissão de notas fiscais |
| `GET /` | ~120 | Listagem de envios |

---

## 🧪 Testes de Validação

```bash
# Executar teste:
node backend/test-normalize-client.js

# Resultado:
✅ Teste 1 (ID=2): 2
✅ Teste 2 (ID='2'): 2
✅ Teste 3 (nome='Realistt'): 2
✅ Teste 4 (nome='realistt' lowercase): 2
✅ Teste 5 (nome='New Seven'): 1
✅ Teste 6 (cliente fake): null
```

### Casos Suportados:
- ✅ ID numérico: `2` → `2`
- ✅ ID como string: `"2"` → `2`
- ✅ Nome exato: `"Realistt"` → `2`
- ✅ Nome case-insensitive: `"realistt"` → `2`
- ✅ Nome com espaços: `"New Seven"` → `1`
- ✅ Cliente inexistente: `"Fake"` → `null` (com warning)

---

## 📝 Estrutura da Tabela Clientes

```sql
-- Tabela: obsidian.clientes
┌─────────────┬──────────┐
│ Column      │ Type     │
├─────────────┼──────────┤
│ id          │ bigint   │ (PK)
│ nome        │ text     │ (Nome do cliente)
│ documento   │ text     │
│ telefone    │ text     │
│ observacoes │ text     │
│ criado_em   │ timestamp│
└─────────────┴──────────┘

-- Exemplo:
┌────┬───────────┐
│ id │ nome      │
├────┼───────────┤
│ 1  │ New Seven │
│ 2  │ Realistt  │
└────┴───────────┘
```

**Campo usado**: `nome` (não `nome_fantasia`)  
**Comparação**: Case-insensitive com `ILIKE`

---

## 🔄 Fluxo de Normalização

```
Frontend envia → normalizeClientId() → Backend usa
─────────────────────────────────────────────────
2                → 2                   → ✅
"2"              → 2                   → ✅
"New Seven"      → 1                   → ✅
"new seven"      → 1                   → ✅
"Realistt"       → 2                   → ✅
"Cliente Fake"   → null                → ❌ (retorna erro 400)
undefined        → null                → ❌ (retorna erro 400)
```

---

## 🚀 Benefícios

### Antes (❌):
```typescript
// Código duplicado em cada endpoint
let clientIdNum: number;
if (isNaN(parseInt(client_id))) {
    const clientResult = await pool.query(
        `SELECT id FROM obsidian.clientes WHERE nome = $1`,
        [client_id]
    );
    if (clientResult.rows.length === 0) {
        return res.status(400).json({ error: 'Cliente não encontrado' });
    }
    clientIdNum = parseInt(clientResult.rows[0].id);
} else {
    clientIdNum = parseInt(client_id);
}
```

### Depois (✅):
```typescript
// Função centralizada
const clientIdNum = await normalizeClientId(client_id);
if (!clientIdNum) {
    return res.status(400).json({ error: `Cliente "${client_id}" não encontrado` });
}
```

**Vantagens**:
- 🔹 Código mais limpo e legível
- 🔹 Lógica centralizada (um lugar para manter)
- 🔹 Case-insensitive por padrão
- 🔹 Validação consistente em todos os endpoints
- 🔹 Logs de erro informativos
- 🔹 Aceita qualquer formato de entrada

---

## 🛠️ Manutenção

### Se precisar adicionar novo endpoint:
```typescript
// 1. Receber client_id
const { client_id } = req.body; // ou req.query

// 2. Normalizar
const clientIdNum = await normalizeClientId(client_id);

// 3. Validar
if (!clientIdNum) {
    return res.status(400).json({ 
        error: `Cliente "${client_id}" não encontrado` 
    });
}

// 4. Usar normalmente
await pool.query('... WHERE client_id = $1', [clientIdNum]);
```

---

## 📋 Checklist de Implementação

- ✅ Função helper criada
- ✅ Aplicada no endpoint de upload
- ✅ Aplicada no relacionamento ML
- ✅ Aplicada no relacionamento manual
- ✅ Aplicada no relacionamento FULL
- ✅ Aplicada na emissão de notas
- ✅ Aplicada na listagem de envios
- ✅ Testes unitários executados
- ✅ Validação case-insensitive
- ✅ Tratamento de erros
- ✅ Logs informativos
- ⚠️ Pendente: Deploy no Easypanel

---

## 🚨 Próximos Passos

### 1. Commit:
```bash
git add backend/src/routes/envios.ts
git commit -m "feat(client): normalize client_id to support name or ID input"
```

### 2. Deploy:
- Fazer push para GitHub
- Redeploy no Easypanel

### 3. Testar em Produção:
```json
// Teste 1: Upload com ID
POST /api/envios/upload
{
  "client_id": 1,
  "source": "ML"
}

// Teste 2: Upload com nome
POST /api/envios/upload
{
  "client_id": "New Seven",
  "source": "ML"
}

// Teste 3: Auto-relacionar com nome
POST /api/envios/relacionar
{
  "client_id": "Realistt",
  "source": "ML"
}
```

---

## 🔍 Debugging

### Se cliente não for encontrado:
1. Verificar se existe na tabela:
```sql
SELECT id, nome FROM obsidian.clientes;
```

2. Checar logs do backend:
```
⚠️ Cliente "Nome Inexistente" não encontrado no banco
```

3. Validar formato de entrada no frontend:
```typescript
console.log('Enviando client_id:', client_id);
```

---

**Data**: 3 de novembro de 2025  
**Versão**: 2.0  
**Status**: ✅ Completo - Aguardando Deploy
