-- =====================================================
-- VER EXATAMENTE QUAIS PEDIDOS ESTÃO DUPLICADOS
-- =====================================================

-- PASSO 1: Ver pedidos que aparecem mais de uma vez (SEM normalizar)
SELECT 
    pedido_uid,
    COUNT(*) as quantidade_vendas,
    STRING_AGG(DISTINCT sku_produto, ', ') as skus,
    SUM(quantidade_vendida) as total_quantidade,
    SUM(preco_unitario * quantidade_vendida) as total_valor
FROM obsidian.vendas
GROUP BY pedido_uid
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- PASSO 2: Ver TODAS as vendas desses pedidos duplicados (detalhe completo)
WITH pedidos_duplicados AS (
    SELECT pedido_uid
    FROM obsidian.vendas
    GROUP BY pedido_uid
    HAVING COUNT(*) > 1
)
SELECT 
    v.venda_id,
    v.pedido_uid,
    LENGTH(v.pedido_uid) as tamanho_pedido,
    v.sku_produto,
    v.quantidade_vendida,
    v.preco_unitario,
    v.preco_unitario * v.quantidade_vendida as total_item,
    v.data_venda,
    v.nome_cliente
FROM obsidian.vendas v
WHERE v.pedido_uid IN (SELECT pedido_uid FROM pedidos_duplicados)
ORDER BY v.pedido_uid, v.data_venda;

-- PASSO 3: Comparar pedidos NORMALIZADOS vs ORIGINAIS
-- (para ver se o problema é no formato do pedido_uid)
SELECT 
    pedido_uid as pedido_original,
    CASE 
        WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
        WHEN pedido_uid LIKE '%-%' THEN SPLIT_PART(pedido_uid, '-', 2)
        ELSE pedido_uid
    END as pedido_normalizado,
    LENGTH(pedido_uid) as tamanho_original,
    COUNT(*) as qtd_vendas
FROM obsidian.vendas
GROUP BY pedido_uid
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
