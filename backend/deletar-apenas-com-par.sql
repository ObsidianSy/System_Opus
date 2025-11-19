-- =====================================================
-- DELETAR APENAS OS PEDIDOS LONGOS QUE TÊM PAR LIMPO
-- =====================================================

-- PASSO 1: Ver quais serão deletados (têm par limpo)
WITH pedidos_longos AS (
    SELECT 
        venda_id,
        pedido_uid,
        SPLIT_PART(SPLIT_PART(pedido_uid, CHR(10), 1), CHR(13), 1) as pedido_limpo,
        sku_produto,
        quantidade_vendida
    FROM obsidian.vendas
    WHERE LENGTH(pedido_uid) > 20
)
SELECT 
    pl.venda_id,
    pl.pedido_uid as pedido_sujo,
    pl.pedido_limpo,
    pl.sku_produto,
    'SERÁ DELETADO (tem par limpo)' as acao
FROM pedidos_longos pl
WHERE EXISTS(
    SELECT 1 FROM obsidian.vendas v2 
    WHERE v2.pedido_uid = pl.pedido_limpo
    AND v2.sku_produto = pl.sku_produto
    AND v2.venda_id != pl.venda_id
);

-- PASSO 2: Ver quais serão MANTIDOS (não têm par limpo)
WITH pedidos_longos AS (
    SELECT 
        venda_id,
        pedido_uid,
        SPLIT_PART(SPLIT_PART(pedido_uid, CHR(10), 1), CHR(13), 1) as pedido_limpo,
        sku_produto
    FROM obsidian.vendas
    WHERE LENGTH(pedido_uid) > 20
)
SELECT 
    pl.venda_id,
    pl.pedido_uid as pedido_unico,
    pl.sku_produto,
    'SERÁ MANTIDO (sem par limpo)' as acao
FROM pedidos_longos pl
WHERE NOT EXISTS(
    SELECT 1 FROM obsidian.vendas v2 
    WHERE v2.pedido_uid = pl.pedido_limpo
    AND v2.sku_produto = pl.sku_produto
    AND v2.venda_id != pl.venda_id
);

-- PASSO 3: EXECUTAR DELEÇÃO (só dos que têm par)
WITH pedidos_longos AS (
    SELECT 
        venda_id,
        SPLIT_PART(SPLIT_PART(pedido_uid, CHR(10), 1), CHR(13), 1) as pedido_limpo,
        sku_produto
    FROM obsidian.vendas
    WHERE LENGTH(pedido_uid) > 20
)
DELETE FROM obsidian.vendas 
WHERE venda_id IN (
    SELECT pl.venda_id
    FROM pedidos_longos pl
    WHERE EXISTS(
        SELECT 1 FROM obsidian.vendas v2 
        WHERE v2.pedido_uid = pl.pedido_limpo
        AND v2.sku_produto = pl.sku_produto
        AND v2.venda_id != pl.venda_id
    )
);

-- PASSO 4: Verificar resultado
SELECT 
    COUNT(*) as vendas_longas_restantes,
    'Essas são únicas (sem par limpo)' as observacao
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20;
