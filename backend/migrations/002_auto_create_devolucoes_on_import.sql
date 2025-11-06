-- Migration: Auto-create devolucoes records when importing cancelled/returned orders
-- Created: 2025-11-06
-- Purpose: Automatically register cancelled/returned orders in devolucoes table for physical checking

-- Drop existing function to recreate with new logic
DROP FUNCTION IF EXISTS obsidian.processar_pedidos_ml(UUID);

-- Recreate function with auto-devolucao logic
CREATE OR REPLACE FUNCTION obsidian.processar_pedidos_ml(
    IN p_import_id UUID, 
    OUT vendas_inseridas INTEGER, 
    OUT pedidos_processados INTEGER, 
    OUT pedidos_cancelados_ignorados INTEGER, 
    OUT vendas_revertidas INTEGER,
    OUT devolucoes_criadas INTEGER
) RETURNS RECORD 
LANGUAGE PLPGSQL
AS $$
DECLARE
    v_vendas_inseridas INTEGER := 0;
    v_pedidos_processados INTEGER := 0;
    v_pedidos_cancelados INTEGER := 0;
    v_vendas_revertidas INTEGER := 0;
    v_devolucoes_criadas INTEGER := 0;
    v_order RECORD;
    v_pedido_ja_emitido BOOLEAN;
    v_client_id INTEGER;
    v_venda_id BIGINT;
    v_item RECORD;
BEGIN
    -- Buscar client_id do import_batch
    SELECT client_id INTO v_client_id
    FROM obsidian.import_batches
    WHERE import_id = p_import_id;

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Import ID % não encontrado', p_import_id;
    END IF;

    FOR v_order IN
        SELECT DISTINCT
            order_id,
            order_date,
            customer,
            "Pós-venda/Cancelado/Devolvido" as status_cancelamento,
            "Razão do Cancelamento" as motivo
        FROM raw_export_orders
        WHERE import_id = p_import_id
          AND status = 'matched'
          AND matched_sku IS NOT NULL
    LOOP
        -- Verificar se pedido já foi emitido
        SELECT EXISTS(
            SELECT 1 FROM obsidian.vendas 
            WHERE pedido_uid = v_order.order_id
              AND (status_venda IS NULL OR status_venda != 'CANCELADA')
        ) INTO v_pedido_ja_emitido;

        -- ✅ NOVO: Se é pedido cancelado/devolvido
        IF v_order.status_cancelamento IS NOT NULL 
           AND TRIM(v_order.status_cancelamento) != '' THEN
            
            -- Se já tinha sido emitido antes, reverter
            IF v_pedido_ja_emitido THEN
                PERFORM obsidian.reverter_venda_cancelada(
                    v_order.order_id,
                    v_order.motivo
                );
                v_vendas_revertidas := v_vendas_revertidas + 1;
            END IF;
            
            -- ✅ CRIAR REGISTROS DE DEVOLUÇÃO para cada item do pedido cancelado
            FOR v_item IN
                SELECT 
                    matched_sku as sku,
                    qty as quantidade,
                    "Nome do Produto" as nome_produto
                FROM raw_export_orders
                WHERE import_id = p_import_id
                  AND order_id = v_order.order_id
                  AND status = 'matched'
                  AND matched_sku IS NOT NULL
            LOOP
                -- Buscar ou criar venda cancelada
                SELECT venda_id INTO v_venda_id
                FROM obsidian.vendas
                WHERE pedido_uid = v_order.order_id
                  AND sku_produto = v_item.sku
                LIMIT 1;

                -- Se não existe venda, criar uma venda cancelada
                IF v_venda_id IS NULL THEN
                    INSERT INTO obsidian.vendas (
                        pedido_uid,
                        data_venda,
                        nome_cliente,
                        sku_produto,
                        quantidade_vendida,
                        preco_unitario,
                        valor_total,
                        nome_produto,
                        canal,
                        client_id,
                        import_id,
                        status_venda,
                        fulfillment_ext
                    ) VALUES (
                        v_order.order_id,
                        COALESCE(v_order.order_date::DATE, CURRENT_DATE),
                        v_order.customer,
                        v_item.sku,
                        v_item.quantidade,
                        0, -- Preço zerado pois é cancelado
                        0,
                        v_item.nome_produto,
                        'ML',
                        v_client_id,
                        p_import_id,
                        'CANCELADA',
                        true -- Não afeta estoque
                    )
                    RETURNING venda_id INTO v_venda_id;
                ELSE
                    -- Atualizar venda existente para status CANCELADA
                    UPDATE obsidian.vendas
                    SET status_venda = 'CANCELADA'
                    WHERE venda_id = v_venda_id;
                END IF;

                -- Criar registro de devolução física
                INSERT INTO obsidian.devolucoes (
                    venda_id,
                    sku_produto,
                    quantidade_esperada,
                    observacoes
                )
                VALUES (
                    v_venda_id,
                    v_item.sku,
                    v_item.quantidade,
                    CONCAT('Pedido cancelado: ', COALESCE(v_order.motivo, 'Sem motivo informado'))
                )
                ON CONFLICT DO NOTHING; -- Evitar duplicatas

                v_devolucoes_criadas := v_devolucoes_criadas + 1;
            END LOOP;
            
            v_pedidos_cancelados := v_pedidos_cancelados + 1;
            CONTINUE;
        END IF;

        -- Só processar vendas normais se for pedido NOVO (não cancelado)
        IF NOT v_pedido_ja_emitido THEN
            DECLARE
                v_items JSONB;
            BEGIN
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'sku', matched_sku,
                        'quantidade', qty,
                        'preco_unitario', unit_price,
                        'nome_produto', "Nome do Produto"
                    )
                )
                INTO v_items
                FROM raw_export_orders
                WHERE import_id = p_import_id
                  AND order_id = v_order.order_id
                  AND status = 'matched'
                  AND matched_sku IS NOT NULL;

                IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
                    PERFORM obsidian.processar_pedido(
                        v_order.order_id,
                        COALESCE(v_order.order_date::DATE, CURRENT_DATE),
                        v_order.customer,
                        'ML',
                        v_items,
                        v_client_id,
                        p_import_id
                    );
                    
                    v_vendas_inseridas := v_vendas_inseridas + jsonb_array_length(v_items);
                    v_pedidos_processados := v_pedidos_processados + 1;
                END IF;
            END;
        END IF;
    END LOOP;

    vendas_inseridas := v_vendas_inseridas;
    pedidos_processados := v_pedidos_processados;
    pedidos_cancelados_ignorados := v_pedidos_cancelados;
    vendas_revertidas := v_vendas_revertidas;
    devolucoes_criadas := v_devolucoes_criadas;
    RETURN;
END;
$$;

COMMENT ON FUNCTION obsidian.processar_pedidos_ml IS 'Processa pedidos ML: cria vendas normais E registros de devolução para pedidos cancelados/devolvidos automaticamente';
