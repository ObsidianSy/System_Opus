-- =====================================================
-- DELETAR APENAS DUPLICATAS (mantém a primeira venda)
-- =====================================================

-- PASSO 1: Ver quais são as duplicatas que serão deletadas
WITH pedidos_normalizados AS (
    SELECT 
        venda_id,
        pedido_uid,
        -- Normalizar: extrair apenas primeiros caracteres até espaço ou usar completo
        CASE 
            WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
            ELSE pedido_uid
        END as pedido_normalizado,
        sku_produto,
        quantidade_vendida,
        data_venda,
        nome_cliente,
        ROW_NUMBER() OVER (
            PARTITION BY 
                CASE 
                    WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
                    ELSE pedido_uid
                END,
                sku_produto
            ORDER BY data_venda ASC, venda_id ASC
        ) as row_num
    FROM obsidian.vendas
)
SELECT 
    'SERÁ DELETADO (DUPLICATA)' as acao,
    venda_id,
    pedido_uid,
    pedido_normalizado,
    sku_produto,
    quantidade_vendida,
    data_venda,
    nome_cliente,
    row_num
FROM pedidos_normalizados
WHERE row_num > 1  -- Mantém apenas row_num = 1 (primeira venda)
ORDER BY pedido_normalizado, row_num;

-- PASSO 2: EXECUTAR DELEÇÃO DE DUPLICATAS
DO $$
DECLARE
    v_deletadas INTEGER;
    v_estoque_devolvido RECORD;
BEGIN
    -- Devolver estoque das DUPLICATAS (row_num > 1)
    FOR v_estoque_devolvido IN 
        WITH pedidos_normalizados AS (
            SELECT 
                venda_id,
                sku_produto,
                quantidade_vendida,
                CASE 
                    WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
                    ELSE pedido_uid
                END as pedido_normalizado,
                ROW_NUMBER() OVER (
                    PARTITION BY 
                        CASE 
                            WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
                            ELSE pedido_uid
                        END,
                        sku_produto
                    ORDER BY data_venda ASC, venda_id ASC
                ) as row_num
            FROM obsidian.vendas
        )
        SELECT 
            sku_produto,
            SUM(quantidade_vendida) as total_devolver
        FROM pedidos_normalizados
        WHERE row_num > 1
        GROUP BY sku_produto
    LOOP
        UPDATE obsidian.produtos 
        SET quantidade_atual = quantidade_atual + v_estoque_devolvido.total_devolver
        WHERE UPPER(sku) = UPPER(v_estoque_devolvido.sku_produto);
        
        RAISE NOTICE '📦 Devolvido: % unidades de SKU %', v_estoque_devolvido.total_devolver, v_estoque_devolvido.sku_produto;
    END LOOP;

    -- Deletar apenas as duplicatas (row_num > 1)
    WITH pedidos_normalizados AS (
        SELECT 
            venda_id,
            CASE 
                WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
                ELSE pedido_uid
            END as pedido_normalizado,
            sku_produto,
            ROW_NUMBER() OVER (
                PARTITION BY 
                    CASE 
                        WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
                        ELSE pedido_uid
                    END,
                    sku_produto
                ORDER BY data_venda ASC, venda_id ASC
            ) as row_num
        FROM obsidian.vendas
    )
    DELETE FROM obsidian.vendas 
    WHERE venda_id IN (
        SELECT venda_id 
        FROM pedidos_normalizados 
        WHERE row_num > 1
    );
    
    GET DIAGNOSTICS v_deletadas = ROW_COUNT;
    
    RAISE NOTICE '✅ CONCLUÍDO: % duplicatas deletadas', v_deletadas;
END $$;

-- PASSO 3: Verificar quantas vendas únicas restaram por pedido
WITH pedidos_normalizados AS (
    SELECT 
        CASE 
            WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
            ELSE pedido_uid
        END as pedido_normalizado,
        COUNT(*) as qtd_vendas
    FROM obsidian.vendas
    GROUP BY 
        CASE 
            WHEN pedido_uid LIKE '% %' THEN SPLIT_PART(pedido_uid, ' ', 1)
            ELSE pedido_uid
        END
    HAVING COUNT(*) > 1
)
SELECT 
    COUNT(*) as pedidos_ainda_duplicados
FROM pedidos_normalizados;

-- Deve retornar 0 se tudo funcionou!
