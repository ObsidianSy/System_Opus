-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO DE INTEGRIDADE DOS DADOS
-- ============================================================================
-- Objetivo: Identificar inconsistências entre tabelas relacionadas
-- Data: 04/11/2025
-- ============================================================================

\echo '🔍 INICIANDO VERIFICAÇÃO DE INTEGRIDADE...\n'

-- 1. PRODUTOS ÓRFÃOS EM VENDAS
\echo '1️⃣ Verificando produtos órfãos em vendas...'
SELECT 
    'Produtos órfãos em vendas' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT v.sku_produto) as skus_problematicos
FROM obsidian.vendas v
LEFT JOIN obsidian.produtos p ON v.sku_produto = p.sku
WHERE p.sku IS NULL;

-- 2. SKUS MATCHED INVÁLIDOS (ML)
\echo '\n2️⃣ Verificando SKUs matched inválidos (ML)...'
SELECT 
    'SKUs matched inválidos (ML)' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT r.matched_sku) as skus_problematicos
FROM raw_export_orders r
LEFT JOIN obsidian.produtos p ON r.matched_sku = p.sku
WHERE r.matched_sku IS NOT NULL AND p.sku IS NULL;

-- 3. SKUS MATCHED INVÁLIDOS (FULL)
\echo '\n3️⃣ Verificando SKUs matched inválidos (FULL)...'
SELECT 
    'SKUs matched inválidos (FULL)' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT r.matched_sku) as skus_problematicos
FROM logistica.full_envio_raw r
LEFT JOIN obsidian.produtos p ON r.matched_sku = p.sku
WHERE r.matched_sku IS NOT NULL AND p.sku IS NULL;

-- 4. ALIASES ÓRFÃOS
\echo '\n4️⃣ Verificando aliases órfãos...'
SELECT 
    'Aliases órfãos' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT a.stock_sku) as skus_problematicos
FROM obsidian.sku_aliases a
LEFT JOIN obsidian.produtos p ON a.stock_sku = p.sku
WHERE p.sku IS NULL;

-- 5. ENVIOS SEM CLIENTE
\echo '\n5️⃣ Verificando envios sem cliente...'
SELECT 
    'Envios sem cliente' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(e.id) as envios_problematicos
FROM logistica.full_envio e
LEFT JOIN obsidian.clientes c ON e.client_id = c.id
WHERE c.id IS NULL;

-- 6. FULL_ENVIO_ITEM COM SKU INVÁLIDO
\echo '\n6️⃣ Verificando full_envio_item com SKU inválido...'
SELECT 
    'Full envio items com SKU inválido' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT i.sku) as skus_problematicos
FROM logistica.full_envio_item i
LEFT JOIN obsidian.produtos p ON i.sku = p.sku
WHERE p.sku IS NULL;

-- 7. KIT_COMPONENTS COM SKU INVÁLIDO
\echo '\n7️⃣ Verificando kit_components com SKU inválido...'
SELECT 
    'Kit components inválidos' as check_name, 
    COUNT(*) as count
FROM obsidian.kit_components k
LEFT JOIN obsidian.produtos p1 ON k.kit_sku = p1.sku
LEFT JOIN obsidian.produtos p2 ON k.component_sku = p2.sku
WHERE p1.sku IS NULL OR p2.sku IS NULL;

-- 8. ESTOQUE_MOVIMENTOS COM SKU INVÁLIDO
\echo '\n8️⃣ Verificando estoque_movimentos com SKU inválido...'
SELECT 
    'Movimentos de estoque com SKU inválido' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT m.sku) as skus_problematicos
FROM obsidian.estoque_movimentos m
LEFT JOIN obsidian.produtos p ON m.sku = p.sku
WHERE p.sku IS NULL;

-- 9. PRODUTOS COM QUANTIDADE NEGATIVA
\echo '\n9️⃣ Verificando produtos com quantidade negativa...'
SELECT 
    'Produtos com quantidade negativa' as check_name, 
    COUNT(*) as count,
    ARRAY_AGG(sku) as skus_problematicos,
    SUM(quantidade_atual) as total_negativo
FROM obsidian.produtos
WHERE quantidade_atual < 0;

-- 10. VENDAS SEM CLIENTE CORRESPONDENTE
\echo '\n🔟 Verificando vendas sem cliente correspondente...'
SELECT 
    'Vendas sem cliente' as check_name, 
    COUNT(*) as count,
    COUNT(DISTINCT v.nome_cliente) as clientes_unicos
FROM obsidian.vendas v
LEFT JOIN obsidian.clientes c ON UPPER(v.nome_cliente) = UPPER(c.nome)
WHERE c.nome IS NULL AND v.nome_cliente IS NOT NULL;

-- 11. IMPORT_BATCHES ÓRFÃOS
\echo '\n1️⃣1️⃣ Verificando import_batches órfãos (sem cliente)...'
SELECT 
    'Import batches sem cliente' as check_name, 
    COUNT(*) as count
FROM obsidian.import_batches b
LEFT JOIN obsidian.clientes c ON b.client_id = c.id
WHERE c.id IS NULL AND b.client_id IS NOT NULL;

-- 12. STATUS INVÁLIDOS (fora do CHECK constraint)
\echo '\n1️⃣2️⃣ Verificando status inválidos...'
SELECT 
    'Status inválidos em raw_export_orders' as check_name,
    status,
    COUNT(*) as count
FROM raw_export_orders
WHERE status NOT IN ('pending', 'matched')
GROUP BY status;

SELECT 
    'Status inválidos em full_envio_raw' as check_name,
    status,
    COUNT(*) as count
FROM logistica.full_envio_raw
WHERE status NOT IN ('pending', 'matched', 'error')
GROUP BY status;

-- 13. DUPLICATAS EM RAW_EXPORT_ORDERS
\echo '\n1️⃣3️⃣ Verificando duplicatas em raw_export_orders...'
SELECT 
    'Duplicatas potenciais (ML)' as check_name,
    COUNT(*) as count
FROM (
    SELECT 
        client_id, 
        "Nº de Pedido da Plataforma", 
        sku_text, 
        qty, 
        unit_price,
        COUNT(*) as qtd
    FROM raw_export_orders
    GROUP BY client_id, "Nº de Pedido da Plataforma", sku_text, qty, unit_price
    HAVING COUNT(*) > 1
) duplicatas;

-- RESUMO FINAL
\echo '\n📊 RESUMO DA VERIFICAÇÃO:\n'
\echo '✅ Verificação concluída!'
\echo '⚠️  Revise os itens com count > 0'
\echo '💡 Execute fix-orphans.sql para corrigir problemas encontrados\n'
