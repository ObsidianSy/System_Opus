-- =====================================================
-- DELETAR PEDIDOS COM MÚLTIPLOS NÚMEROS QUE TÊM PAR
-- Lógica:
-- 1. Extrai número após ML- (ex: ML-2000010058319625 → 2000010058319625)
-- 2. Se esse número aparecer em OUTRO pedido mais curto, deleta o longo
-- 3. Se o número só existe no pedido longo, MANTÉM
-- =====================================================

-- PASSO 1: Ver quais pedidos serão deletados
WITH pedidos_analisados AS (
    SELECT 
        venda_id,
        pedido_uid,
        -- Extrair número após ML-
        CASE 
            WHEN pedido_uid LIKE 'ML-%' THEN SUBSTRING(pedido_uid FROM 4)
            ELSE pedido_uid
        END as pedido_sem_prefixo,
        -- Extrair apenas o PRIMEIRO número
        CASE 
            WHEN pedido_uid LIKE 'ML-%' THEN 
                SPLIT_PART(SUBSTRING(pedido_uid FROM 4), ' ', 1)
            ELSE pedido_uid
        END as pedido_normalizado,
        LENGTH(pedido_uid) as tamanho_pedido,
        sku_produto,
        quantidade_vendida,
        data_venda,
        nome_cliente
    FROM obsidian.vendas
),
pedidos_com_par AS (
    -- Encontrar pedidos normalizados que aparecem em mais de um formato
    SELECT 
        pedido_normalizado,
        COUNT(DISTINCT pedido_uid) as qtd_formatos
    FROM pedidos_analisados
    GROUP BY pedido_normalizado
    HAVING COUNT(DISTINCT pedido_uid) > 1
)
SELECT 
    'SERÁ DELETADO' as acao,
    pa.venda_id,
    pa.pedido_uid,
    pa.pedido_normalizado,
    pa.tamanho_pedido,
    pa.sku_produto,
    pa.quantidade_vendida,
    pa.data_venda,
    pa.nome_cliente
FROM pedidos_analisados pa
INNER JOIN pedidos_com_par pcp ON pa.pedido_normalizado = pcp.pedido_normalizado
WHERE pa.pedido_sem_prefixo LIKE '% %'  -- Só deleta os que têm espaço (múltiplos números)
ORDER BY pa.pedido_normalizado, pa.pedido_uid;

-- PASSO 2: EXECUTAR DELEÇÃO
DO $$
DECLARE
    v_deletadas INTEGER;
    v_estoque_devolvido RECORD;
BEGIN
    -- Devolver estoque dos pedidos que serão deletados
    FOR v_estoque_devolvido IN 
        WITH pedidos_analisados AS (
            SELECT 
                venda_id,
                pedido_uid,
                CASE 
                    WHEN pedido_uid LIKE 'ML-%' THEN SUBSTRING(pedido_uid FROM 4)
                    ELSE pedido_uid
                END as pedido_sem_prefixo,
                CASE 
                    WHEN pedido_uid LIKE 'ML-%' THEN 
                        SPLIT_PART(SUBSTRING(pedido_uid FROM 4), ' ', 1)
                    ELSE pedido_uid
                END as pedido_normalizado,
                sku_produto,
                quantidade_vendida
            FROM obsidian.vendas
        ),
        pedidos_com_par AS (
            SELECT 
                pedido_normalizado,
                COUNT(DISTINCT pedido_uid) as qtd_formatos
            FROM pedidos_analisados
            GROUP BY pedido_normalizado
            HAVING COUNT(DISTINCT pedido_uid) > 1
        )
        SELECT 
            pa.sku_produto,
            SUM(pa.quantidade_vendida) as total_devolver
        FROM pedidos_analisados pa
        INNER JOIN pedidos_com_par pcp ON pa.pedido_normalizado = pcp.pedido_normalizado
        WHERE pa.pedido_sem_prefixo LIKE '% %'
        GROUP BY pa.sku_produto
    LOOP
        UPDATE obsidian.produtos 
        SET quantidade_atual = quantidade_atual + v_estoque_devolvido.total_devolver
        WHERE UPPER(sku) = UPPER(v_estoque_devolvido.sku_produto);
        
        RAISE NOTICE '📦 Devolvido: % unidades de SKU %', v_estoque_devolvido.total_devolver, v_estoque_devolvido.sku_produto;
    END LOOP;

    -- Deletar os pedidos com múltiplos números que têm par
    WITH pedidos_analisados AS (
        SELECT 
            venda_id,
            pedido_uid,
            CASE 
                WHEN pedido_uid LIKE 'ML-%' THEN SUBSTRING(pedido_uid FROM 4)
                ELSE pedido_uid
            END as pedido_sem_prefixo,
            CASE 
                WHEN pedido_uid LIKE 'ML-%' THEN 
                    SPLIT_PART(SUBSTRING(pedido_uid FROM 4), ' ', 1)
                ELSE pedido_uid
            END as pedido_normalizado
        FROM obsidian.vendas
    ),
    pedidos_com_par AS (
        SELECT 
            pedido_normalizado
        FROM pedidos_analisados
        GROUP BY pedido_normalizado
        HAVING COUNT(DISTINCT pedido_uid) > 1
    )
    DELETE FROM obsidian.vendas 
    WHERE venda_id IN (
        SELECT pa.venda_id
        FROM pedidos_analisados pa
        INNER JOIN pedidos_com_par pcp ON pa.pedido_normalizado = pcp.pedido_normalizado
        WHERE pa.pedido_sem_prefixo LIKE '% %'
    );
    
    GET DIAGNOSTICS v_deletadas = ROW_COUNT;
    
    RAISE NOTICE '✅ CONCLUÍDO: % vendas deletadas', v_deletadas;
END $$;

-- PASSO 3: Verificar resultado
SELECT 
    CASE 
        WHEN pedido_uid LIKE 'ML-%' THEN 
            SPLIT_PART(SUBSTRING(pedido_uid FROM 4), ' ', 1)
        ELSE pedido_uid
    END as pedido_normalizado,
    COUNT(*) as qtd_vendas,
    STRING_AGG(DISTINCT pedido_uid, ' | ') as pedidos_diferentes
FROM obsidian.vendas
GROUP BY 
    CASE 
        WHEN pedido_uid LIKE 'ML-%' THEN 
            SPLIT_PART(SUBSTRING(pedido_uid FROM 4), ' ', 1)
        ELSE pedido_uid
    END
HAVING COUNT(*) > 1;

-- Se retornar vazio, não há mais duplicatas!
