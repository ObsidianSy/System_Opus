-- =====================================================
-- DELETAR VENDAS DUPLICADAS - EXECUÇÃO DIRETA
-- 105 vendas com pedido_uid > 20 caracteres
-- =====================================================

-- PASSO 1: Ver o que será deletado
SELECT 
    'SERÁ DELETADO' as acao,
    venda_id,
    pedido_uid,
    LENGTH(pedido_uid) as tamanho,
    sku_produto,
    quantidade_vendida,
    preco_unitario,
    nome_cliente
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20
ORDER BY pedido_uid;

-- PASSO 2: EXECUTAR A DELEÇÃO (COM DEVOLUÇÃO DE ESTOQUE)
DO $$
DECLARE
    v_deletadas INTEGER;
    v_estoque_devolvido RECORD;
BEGIN
    -- Devolver estoque ANTES de deletar
    FOR v_estoque_devolvido IN 
        SELECT 
            v.sku_produto,
            SUM(v.quantidade_vendida) as total_devolver
        FROM obsidian.vendas v
        WHERE LENGTH(v.pedido_uid) > 20
        GROUP BY v.sku_produto
    LOOP
        UPDATE obsidian.produtos 
        SET quantidade_atual = quantidade_atual + v_estoque_devolvido.total_devolver
        WHERE UPPER(sku) = UPPER(v_estoque_devolvido.sku_produto);
        
        RAISE NOTICE '📦 Devolvido: % unidades de SKU %', v_estoque_devolvido.total_devolver, v_estoque_devolvido.sku_produto;
    END LOOP;

    -- Deletar vendas
    DELETE FROM obsidian.vendas 
    WHERE LENGTH(pedido_uid) > 20;
    
    GET DIAGNOSTICS v_deletadas = ROW_COUNT;
    
    RAISE NOTICE '✅ CONCLUÍDO: % vendas deletadas', v_deletadas;
END $$;

-- PASSO 3: Verificar que foram deletadas
SELECT 
    COUNT(*) as vendas_restantes_com_problema
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20;

-- Deve retornar 0 se tudo funcionou!
