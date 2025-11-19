-- =====================================================
-- TESTE SIMPLES: Ver se há vendas e pedidos duplicados
-- =====================================================

-- 1. Quantas vendas existem no total?
SELECT COUNT(*) as total_vendas FROM obsidian.vendas;

-- 2. Quantas vendas têm pedido_uid com espaço (múltiplos números)?
SELECT COUNT(*) as vendas_com_espaco 
FROM obsidian.vendas 
WHERE pedido_uid LIKE '% %';

-- 3. Quantas vendas têm pedido_uid com mais de 20 caracteres?
SELECT COUNT(*) as vendas_longas 
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20;

-- 4. Ver alguns exemplos de pedidos longos
SELECT 
    pedido_uid,
    LENGTH(pedido_uid) as tamanho,
    sku_produto,
    quantidade_vendida
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20
LIMIT 10;

-- 5. Ver se o mesmo número base aparece em formatos diferentes
SELECT 
    SPLIT_PART(REPLACE(pedido_uid, 'ML-', ''), ' ', 1) as numero_base,
    COUNT(DISTINCT pedido_uid) as formatos_diferentes,
    STRING_AGG(DISTINCT pedido_uid, ' | ') as pedidos
FROM obsidian.vendas
WHERE pedido_uid LIKE 'ML-%'
GROUP BY SPLIT_PART(REPLACE(pedido_uid, 'ML-', ''), ' ', 1)
HAVING COUNT(DISTINCT pedido_uid) > 1
ORDER BY COUNT(DISTINCT pedido_uid) DESC;
