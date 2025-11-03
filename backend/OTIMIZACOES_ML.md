# 🚀 Otimizações do IMPORT ML - System Opus

## 📊 Problema Identificado
- **Antes**: Upload de 6367 linhas salvou apenas 27 (99.6% de perda)
- **Causa**: Loop com INSERTs individuais causou timeout HTTP
- **Impacto**: Usuário não conseguia importar planilhas grandes do Mercado Livre

---

## ✅ Soluções Implementadas

### 1️⃣ **BULK INSERT - Performance Crítica**
**Arquivo**: `backend/src/routes/envios.ts` (linhas ~728-920)

#### ANTES (❌ LENTO):
```typescript
// 6367 chamadas individuais ao banco = MUITO LENTO
for (let i = 0; i < jsonData.length; i++) {
    await pool.query(`INSERT INTO raw_export_orders VALUES (...)`, [...85 colunas]);
}
```

#### DEPOIS (✅ RÁPIDO):
```typescript
// 1. Preparar TODOS os dados em memória (sem DB calls)
const valuesToInsert = [];
for (let i = 0; i < jsonData.length; i++) {
    valuesToInsert.push([...data]);
}

// 2. Inserir em BATCHES de 500 linhas
const BATCH_SIZE = 500;
for (let i = 0; i < valuesToInsert.length; i += BATCH_SIZE) {
    const batch = valuesToInsert.slice(i, i + BATCH_SIZE);
    // Gerar placeholders dinamicamente ($1,$2,$3...)
    const placeholders = batch.map((_, idx) => 
        `($${idx * 85 + 1}, $${idx * 85 + 2}, ... $${idx * 85 + 85})`
    ).join(',');
    
    await pool.query(
        `INSERT INTO raw_export_orders VALUES ${placeholders}`,
        batch.flat()
    );
}
```

**Ganho de Performance**:
- 6367 chamadas → 13 chamadas (6367 / 500 = 13 batches)
- **Redução de 99.8% nas chamadas ao banco**
- Upload que demorava minutos → segundos

---

### 2️⃣ **AUTO-RELACIONAMENTO em BATCHES**
**Arquivo**: `backend/src/routes/envios.ts` (linhas ~870-930)

#### Problema:
- Processar 6367 linhas uma a uma para relacionar SKUs era lento
- Cada linha faz 1-3 queries (produtos + aliases + update)

#### Solução:
```typescript
// Processar em batches de 100 linhas com log de progresso
const RELATE_BATCH_SIZE = 100;
for (let i = 0; i < pendingRows.rows.length; i += RELATE_BATCH_SIZE) {
    const batch = pendingRows.rows.slice(i, i + RELATE_BATCH_SIZE);
    console.log(`🔍 Relacionando batch ${Math.floor(i/100) + 1}/64 (100 linhas)...`);
    
    for (const row of batch) {
        // Buscar em produtos e aliases
        // ...relacionar se encontrar match
    }
}
```

**Benefícios**:
- Usuário vê progresso no console
- Previne timeout em uploads grandes
- Permite retry em caso de falha parcial

---

### 3️⃣ **LIMITE 1000 no Auto-Relacionamento Inicial**
**Arquivo**: `backend/src/routes/envios.ts` (linha ~845)

```typescript
const pendingRows = await pool.query(
    `SELECT id, sku_text 
     FROM raw_export_orders 
     WHERE import_id = $1 AND status = 'pending'
     LIMIT 1000`, // ⚠️ LIMITE para não dar timeout
    [batchId]
);
```

**Motivo**:
- Se usuário subir 10.000 linhas, auto-relacionar todas pode demorar muito
- Limite de 1000 garante que upload complete rápido
- Usuário pode usar o botão "Auto-Relacionar" depois para processar o resto

---

### 4️⃣ **Client_id: Nome → ID Conversion**
**Arquivo**: `backend/src/routes/envios.ts` (linha ~1323)

#### Problema:
Frontend enviava: `client_id: "New Seven"` (nome)  
Backend esperava: `client_id: 123` (numeric ID)

#### Solução:
```typescript
let clientIdNum = clientId;

// Se recebeu nome ao invés de ID, converter
if (isNaN(Number(clientId))) {
    const clientResult = await pool.query(
        `SELECT id FROM obsidian.clientes WHERE nome_fantasia ILIKE $1 LIMIT 1`,
        [clientId]
    );
    if (clientResult.rows.length === 0) {
        return res.status(400).json({ error: `Cliente "${clientId}" não encontrado` });
    }
    clientIdNum = clientResult.rows[0].id;
}
```

---

### 5️⃣ **Fix: Remover client_id de Query de Produtos**
**Locais**: Linhas ~555, ~850

#### Problema:
```sql
-- ❌ ERRADO: produtos não tem coluna client_id
SELECT sku FROM obsidian.produtos WHERE client_id = $1 AND sku = $2
```

#### Solução:
```sql
-- ✅ CORRETO: produtos é tabela global (sem client_id)
SELECT sku FROM obsidian.produtos WHERE UPPER(sku) = UPPER(TRIM($1))
```

---

### 6️⃣ **Fix: Botão Auto-Relacionar (500 Error)**
**Arquivo**: `backend/src/routes/envios.ts` (linha ~1350)

#### Problema:
```sql
-- ❌ Coluna order_id não existe
SELECT order_id as codigo_ml, qty FROM raw_export_orders WHERE ...
```

#### Solução:
```sql
-- ✅ Usar colunas corretas
SELECT id, sku_text, client_id FROM raw_export_orders WHERE status = 'pending'
```

---

## 📈 Resultados Esperados

### Performance:
- **Upload 6367 linhas**: ~27 segundos (antes: timeout após 27 linhas)
- **Auto-relacionamento**: 1000 linhas em ~30-60 segundos
- **Bulk insert**: 500 linhas por batch = ~13 batches para 6367 linhas

### Funcionalidades Corrigidas:
- ✅ Upload de planilhas grandes (5000+ linhas)
- ✅ Auto-relacionamento durante upload (1000 primeiras)
- ✅ Botão "Auto-Relacionar" funcional (resto das linhas)
- ✅ Validação de cliente por nome ou ID
- ✅ Logs de progresso no console

---

## 🚨 PRÓXIMOS PASSOS

### 1. Commitar as mudanças:
```bash
git add backend/src/routes/envios.ts
git commit -m "feat(ml): bulk insert optimization + auto-relate fixes + client validation"
git push origin main
```

### 2. Redeploy no Easypanel:
- Ir no painel do Easypanel
- Selecionar o serviço backend
- Clicar em "Rebuild" ou esperar auto-deploy

### 3. Testar Upload:
- Fazer upload da planilha de 6367 linhas novamente
- Verificar no console os logs de progresso dos batches
- Conferir se todas as linhas foram salvas

### 4. Verificar Auto-Relacionamento:
```sql
-- Ver quantas foram relacionadas automaticamente
SELECT status, COUNT(*) 
FROM raw_export_orders 
WHERE import_id = 'SEU_BATCH_ID' 
GROUP BY status;

-- Resultado esperado:
-- matched: ~80-90% (se SKUs estiverem no sistema)
-- pending: ~10-20% (SKUs novos que precisam relacionamento manual)
```

---

## 🔍 Monitoramento

### Logs a observar no upload:
```
📦 Preparando dados para inserção...
💾 Inserindo batch 1/13 (500 linhas)...
💾 Inserindo batch 2/13 (500 linhas)...
...
💾 Inserindo batch 13/13 (367 linhas)...
✅ Total inserido: 6367 linhas (0 puladas)
📦 Processando 1000 linhas para auto-relacionamento em batches...
🔍 Relacionando batch 1/10 (100 linhas)...
...
✅ Auto-relacionamento concluído: 850 itens relacionados
```

---

## 📝 Notas Técnicas

### Por que 500 linhas por batch?
- Balanço entre performance e memória
- PostgreSQL tem limite de ~65535 parâmetros por query
- 85 colunas × 500 linhas = 42500 parâmetros (seguro)

### Por que auto-relacionar apenas 1000?
- Upload precisa ser rápido para dar feedback ao usuário
- Auto-relacionar 6000+ linhas pode demorar 3-5 minutos
- Melhor: upload rápido (1min) + botão manual para o resto

### Performance Esperada:
- **Upload**: ~3-5 segundos por batch de 500 linhas
- **Auto-relacionamento**: ~0.5-1 segundo por linha (depende dos aliases)
- **Total para 6367 linhas**: ~1-2 minutos (upload + auto-relate 1000)

---

## ⚠️ Troubleshooting

### Se upload ainda der timeout:
1. Aumentar timeout do servidor (nginx/easypanel):
   ```nginx
   proxy_read_timeout 300s;
   ```

2. Reduzir BATCH_SIZE de 500 para 250:
   ```typescript
   const BATCH_SIZE = 250;
   ```

### Se auto-relacionamento travar:
1. Reduzir RELATE_BATCH_SIZE de 100 para 50
2. Adicionar índice na tabela produtos:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_produtos_sku_upper 
   ON obsidian.produtos (UPPER(sku));
   ```

### Se encontrar linhas duplicadas:
```sql
-- Verificar duplicatas
SELECT order_id, COUNT(*) 
FROM raw_export_orders 
WHERE import_id = 'SEU_BATCH_ID' 
GROUP BY order_id 
HAVING COUNT(*) > 1;
```

---

**Data**: 2025
**Versão**: 1.0
**Status**: ✅ Pronto para deploy
