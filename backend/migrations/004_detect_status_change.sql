-- Migration: Detect status changes instead of just cancelled status
-- Created: 2025-11-06
-- Purpose: Only create devolucoes when status CHANGES to cancelled (not first import)

-- Drop and recreate function with change detection logic
DROP FUNCTION IF EXISTS obsidian.processar_pedidos_ml(UUID);

CREATE OR REPLACE FUNCTION obsidian.processar_pedidos_ml(
    IN p_import_id UUID, 
    OUT vendas_inseridas INTEGER, 
    OUT pedidos_processados INTEGER, 
    OUT pedidos_cancelados_ignorados INTEGER, 
    OUT vendas_revertidas INTEGER,
    OUT devolucoes_criadas INTEGER
) 
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
    v_status_anterior TEXT;
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
        -- Verificar se pedido já existe e qual era o status anterior
        SELECT 
            EXISTS(SELECT 1 FROM obsidian.vendas WHERE pedido_uid = v_order.order_id),
            (SELECT status_venda FROM obsidian.vendas WHERE pedido_uid = v_order.order_id LIMIT 1)
        INTO v_pedido_ja_emitido, v_status_anterior;

        -- ✅ NOVA LÓGICA: Detectar MUDANÇA de status para cancelado
        IF v_order.status_cancelamento IS NOT NULL 
           AND TRIM(v_order.status_cancelamento) != '' THEN
            
            -- ✅ SÓ CRIA DEVOLUÇÃO se o pedido JÁ EXISTIA e NÃO estava cancelado antes
            IF v_pedido_ja_emitido AND (v_status_anterior IS NULL OR UPPER(v_status_anterior) NOT IN ('CANCELADA', 'CANCELADO', 'DEVOLVIDO')) THEN
                
                -- Reverter estoque da venda anterior
                PERFORM obsidian.reverter_venda_cancelada(
                    v_order.order_id,
                    v_order.motivo
                );
                v_vendas_revertidas := v_vendas_revertidas + 1;
                
                -- ✅ CRIAR REGISTROS DE DEVOLUÇÃO para conferência física
                FOR v_item IN
                    SELECT 
                        v.venda_id,
                        v.sku_produto as sku,
                        v.quantidade_vendida as quantidade,
                        v.nome_produto
                    FROM obsidian.vendas v
                    WHERE v.pedido_uid = v_order.order_id
                LOOP
                    -- Atualizar status da venda para CANCELADA
                    UPDATE obsidian.vendas
                    SET status_venda = 'CANCELADA'
                    WHERE venda_id = v_item.venda_id;

                    -- Criar registro de devolução física (apenas se ainda não existe)
                    INSERT INTO obsidian.devolucoes (
                        venda_id,
                        sku_produto,
                        quantidade_esperada,
                        tipo_problema,
                        observacoes
                    )
                    VALUES (
                        v_item.venda_id,
                        v_item.sku,
                        v_item.quantidade,
                        'pendente',
                        CONCAT('Pedido cancelado após envio. Motivo: ', COALESCE(v_order.motivo, 'Não informado'))
                    )
                    ON CONFLICT DO NOTHING; -- Evitar duplicatas

                    v_devolucoes_criadas := v_devolucoes_criadas + 1;
                END LOOP;
                
            ELSIF NOT v_pedido_ja_emitido THEN
                -- ✅ PRIMEIRA VEZ que vemos este pedido e já está cancelado
                -- NÃO criar devolução, apenas registrar venda cancelada sem baixar estoque
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
                )
                SELECT
                    v_order.order_id,
                    COALESCE(v_order.order_date::DATE, CURRENT_DATE),
                    v_order.customer,
                    matched_sku,
                    qty,
                    COALESCE(unit_price, 0),
                    COALESCE(unit_price, 0) * qty,
                    "Nome do Produto",
                    'ML',
                    v_client_id,
                    p_import_id,
                    'CANCELADA',
                    true -- Não baixa estoque
                FROM raw_export_orders
                WHERE import_id = p_import_id
                  AND order_id = v_order.order_id
                  AND status = 'matched'
                  AND matched_sku IS NOT NULL
                ON CONFLICT (pedido_uid, sku_produto) DO NOTHING;
            END IF;
            
            v_pedidos_cancelados := v_pedidos_cancelados + 1;
            CONTINUE;
        END IF;

        -- Processar vendas normais (não canceladas)
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
END;
$$;

COMMENT ON FUNCTION obsidian.processar_pedidos_ml IS 'Processa pedidos ML: cria vendas normais E registros de devolução APENAS quando status MUDA para cancelado (não na primeira importação já cancelada)';
