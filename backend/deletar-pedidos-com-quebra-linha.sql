-- =====================================================
-- DELETAR PEDIDOS COM QUEBRA DE LINHA OU MÚLTIPLOS NÚMEROS
-- Problema: pedidos vêm como "ML-2000009929737467\n2000013746595934"
-- =====================================================

-- PASSO 1: Ver pedidos com quebra de linha ou que não começam com ML-
SELECT 
    venda_id,
    pedido_uid,
    LENGTH(pedido_uid) as tamanho,
    sku_produto,
    quantidade_vendida,
    CASE 
        WHEN pedido_uid LIKE '%' || CHR(10) || '%' THEN 'TEM QUEBRA DE LINHA (LF)'
        WHEN pedido_uid LIKE '%' || CHR(13) || '%' THEN 'TEM QUEBRA DE LINHA (CR)'
        WHEN LENGTH(pedido_uid) > 25 THEN 'MUITO LONGO (>25 chars)'
        ELSE 'OUTRO'
    END as motivo
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20
ORDER BY LENGTH(pedido_uid) DESC
LIMIT 20;

-- PASSO 2: Ver se existe versão "limpa" desses pedidos
WITH pedidos_longos AS (
    SELECT 
        pedido_uid,
        -- Extrair apenas a parte antes da quebra de linha
        SPLIT_PART(SPLIT_PART(pedido_uid, CHR(10), 1), CHR(13), 1) as pedido_limpo,
        venda_id,
        sku_produto
    FROM obsidian.vendas
    WHERE LENGTH(pedido_uid) > 20
)
SELECT 
    pl.pedido_uid as pedido_sujo,
    pl.pedido_limpo,
    pl.venda_id as venda_id_duplicada,
    EXISTS(
        SELECT 1 FROM obsidian.vendas v2 
        WHERE v2.pedido_uid = pl.pedido_limpo
        AND v2.venda_id != pl.venda_id
    ) as existe_versao_limpa
FROM pedidos_longos pl
ORDER BY existe_versao_limpa DESC;

-- PASSO 3: EXECUTAR DELEÇÃO DE TODAS AS 105 VENDAS COM QUEBRA DE LINHA
-- Como causam violação de constraint, são duplicatas
DO $$
DECLARE
    v_deletadas INTEGER;
    v_estoque_devolvido RECORD;
BEGIN
    -- Devolver estoque de TODAS as vendas com quebra de linha
    FOR v_estoque_devolvido IN 
        SELECT 
            sku_produto,
            SUM(quantidade_vendida) as total_devolver
        FROM obsidian.vendas
        WHERE LENGTH(pedido_uid) > 20
        GROUP BY sku_produto
    LOOP
        UPDATE obsidian.produtos 
        SET quantidade_atual = quantidade_atual + v_estoque_devolvido.total_devolver
        WHERE UPPER(sku) = UPPER(v_estoque_devolvido.sku_produto);
        
        RAISE NOTICE '📦 Devolvido: % unidades de SKU %', v_estoque_devolvido.total_devolver, v_estoque_devolvido.sku_produto;
    END LOOP;

    -- Deletar TODAS as vendas com pedido longo (têm quebra de linha = duplicatas)
    DELETE FROM obsidian.vendas 
    WHERE LENGTH(pedido_uid) > 20;
    
    GET DIAGNOSTICS v_deletadas = ROW_COUNT;
    
    RAISE NOTICE '✅ CONCLUÍDO: % vendas duplicadas deletadas', v_deletadas;
END $$;

-- PASSO 4: Verificar resultado
SELECT 
    COUNT(*) as vendas_longas_restantes,
    STRING_AGG(DISTINCT pedido_uid, ' | ') as exemplos
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20;
