# 🔧 Correção: Pedidos Duplicados na Importação ML

## 📋 Problema Identificado

Quando a planilha do Mercado Livre continha pedidos com múltiplos números:
```
Linha 1: 2000010058319625
Linha 2: 2000010058319625 2000138627127236
```

O sistema estava:
- ❌ Criando 2 vendas diferentes
- ❌ Duplicando preços
- ❌ Duplicando baixa de estoque
- ❌ Duplicando registros no banco

## ✅ Solução Implementada

### 1. Normalização de Pedidos
```typescript
const normalizePedidoId = (pedidoRaw: string): string => {
    if (!pedidoRaw) return '';
    const pedidoStr = String(pedidoRaw).trim();
    // Se tem espaço, pega só o primeiro número
    const firstNumber = pedidoStr.split(/\s+/)[0];
    return firstNumber;
};
```

### 2. Controle de Duplicatas
```typescript
const pedidosProcessados = new Set<string>();
let duplicatasIgnoradas = 0;

// Para cada linha da planilha:
const pedidoKey = `${clientIdNum}_${finalOrderId}`;
if (pedidosProcessados.has(pedidoKey)) {
    console.log(`⏭️  DUPLICATA IGNORADA: Linha ${i + 1} - Pedido ${orderIdPlatformRaw} → ${finalOrderId}`);
    duplicatasIgnoradas++;
    skippedRows.push(i + 1);
    continue; // ← IGNORA a linha, não processa
}
pedidosProcessados.add(pedidoKey);
```

### 3. Relatório de Duplicatas
- Contador `duplicatasIgnoradas` na resposta da API
- Log detalhado de cada duplicata ignorada
- Mensagem no resumo final da importação

## 🎯 Comportamento Novo

### Exemplo 1: Planilha com duplicatas
```
Linhas na planilha:
1. 2000010058319625          (SKU: ABC, Qtd: 1, R$ 100)
2. 2000010058319625 2000138  (SKU: XYZ, Qtd: 1, R$ 50)

Resultado:
✅ Linha 1 processada → 1 venda criada
⏭️  Linha 2 IGNORADA → duplicata detectada

Total vendas: 1 (não 2)
Total faturamento: R$ 100 (não R$ 150)
```

### Exemplo 2: Pedidos diferentes
```
Linhas na planilha:
1. 2000010058319625          (SKU: ABC, Qtd: 1, R$ 100)
2. 9000010058319999          (SKU: XYZ, Qtd: 1, R$ 50)

Resultado:
✅ Linha 1 processada → 1 venda criada
✅ Linha 2 processada → 1 venda criada

Total vendas: 2
Total faturamento: R$ 150
```

## 📁 Arquivos Modificados

- `backend/src/routes/envios.ts` (linhas ~981-1015, 1533, 1567-1582)

## 🧹 Limpeza de Dados Antigos

**Scripts disponíveis para remover vendas duplicadas existentes:**

1. `backend/cleanup-pedidos-duplicados.js` (Node.js com confirmação)
2. `backend/cleanup-pedidos-duplicados.sql` (SQL direto)

**Critério:** Deleta vendas onde `pedido_uid LIKE '% %'` (contém espaço)

## 📊 Relatórios

Na resposta da importação agora aparece:
```json
{
  "linhas": 100,
  "linhas_inseridas": 95,
  "linhas_ignoradas": 5,
  "duplicatas_ignoradas": 3,
  "message": "✅ 95 linhas importadas (3 duplicatas ignoradas). 90 itens relacionados..."
}
```

## ✅ Teste de Validação

1. Criar planilha ML com pedidos duplicados
2. Fazer upload
3. Verificar console do backend: deve mostrar logs `⏭️ DUPLICATA IGNORADA`
4. Verificar resposta da API: `duplicatas_ignoradas > 0`
5. Conferir no banco: apenas 1 venda por pedido base

---

**Data:** 19/11/2025  
**Desenvolvedor:** Claude (GitHub Copilot)
