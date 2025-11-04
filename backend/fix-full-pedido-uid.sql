-- Corrigir função full_envio_emitir para incluir pedido_uid

CREATE OR REPLACE FUNCTION logistica.full_envio_emitir(p_envio_id bigint, p_data date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    r RECORD;
    comp RECORD;
    v_valor NUMERIC(18,2);
    v_client BIGINT;
    v_cliente_nome TEXT;
    v_envio_num TEXT;
    v_pedido_uid TEXT;
BEGIN
    -- Buscar informações do envio
    SELECT fe.client_id, c.nome, fe.envio_num
    INTO v_client, v_cliente_nome, v_envio_num
    FROM logistica.full_envio fe
    JOIN obsidian.clientes c ON c.id = fe.client_id
    WHERE fe.id = p_envio_id
    FOR UPDATE;

    IF v_client IS NULL THEN
        RAISE EXCEPTION 'Envio % não encontrado ou sem cliente vinculado', p_envio_id;
    END IF;

    -- Verificar pendências
    IF EXISTS (
        SELECT 1 FROM logistica.full_envio_raw
        WHERE envio_id = p_envio_id AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'Existem pendências de SKU neste envio. Resolva antes de registrar.';
    END IF;

    -- Processar cada item do envio
    FOR r IN SELECT * FROM logistica.full_envio_item WHERE envio_id = p_envio_id LOOP
        
        -- Gerar pedido_uid único: ENVIO_NUM-CODIGO_ML
        v_pedido_uid := CONCAT(v_envio_num, '-', COALESCE(r.codigo_ml, r.id::text));
        
        -- Criar movimento de estoque
        INSERT INTO obsidian.estoque_movimentos (
            sku, tipo, quantidade, origem_tabela, origem_id, observacao
        )
        VALUES (
            r.sku,
            'saida_full',
            0 - r.qtd,
            'full_envio_item',
            r.id::text,
            CONCAT('Envio FULL ', p_envio_id, ' - ', v_pedido_uid)
        )
        ON CONFLICT DO NOTHING;

        -- Atualizar quantidade em produtos (se movimento foi criado)
        IF NOT EXISTS (
            SELECT 1 FROM obsidian.estoque_movimentos
            WHERE origem_tabela='full_envio_item' AND origem_id=r.id::text
        ) THEN
            UPDATE obsidian.produtos
            SET quantidade_atual = COALESCE(quantidade_atual, 0) - r.qtd,
                atualizado_em = NOW()
            WHERE sku = r.sku;
        END IF;

        -- Se for kit, processar componentes
        IF r.is_kit THEN
            FOR comp IN
                SELECT component_sku, qty FROM obsidian.kit_components WHERE kit_sku = r.sku
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM obsidian.estoque_movimentos
                    WHERE origem_tabela='full_envio_item'
                      AND origem_id=r.id::text
                      AND sku=comp.component_sku
                ) THEN
                    INSERT INTO obsidian.estoque_movimentos (
                        sku, tipo, quantidade, origem_tabela, origem_id, observacao
                    )
                    VALUES (
                        comp.component_sku,
                        'saida_full',
                        0 - (r.qtd * comp.qty),
                        'full_envio_item',
                        r.id::text,
                        CONCAT('Kit ', r.sku, ' - ', v_pedido_uid)
                    );

                    UPDATE obsidian.produtos
                    SET quantidade_atual = COALESCE(quantidade_atual, 0) - (r.qtd * comp.qty),
                        atualizado_em = NOW()
                    WHERE sku = comp.component_sku;
                END IF;
            END LOOP;
        END IF;

        -- Criar venda (COM pedido_uid agora!)
        IF NOT EXISTS (
            SELECT 1 FROM obsidian.vendas
            WHERE canal = 'FULL-INBOUND'
              AND nome_cliente = v_cliente_nome
              AND sku_produto = r.sku
              AND data_venda = p_data
              AND pedido_uid = v_pedido_uid
        ) THEN
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
                fulfillment_ext
            )
            SELECT
                v_pedido_uid,
                p_data,
                v_cliente_nome,
                r.sku,
                r.qtd,
                COALESCE(r.preco_unit_interno, 0),
                COALESCE(r.preco_unit_interno, 0) * r.qtd,
                p.nome,
                'FULL-INBOUND',
                FALSE
            FROM obsidian.produtos p
            WHERE p.sku = r.sku;
        END IF;

    END LOOP;

    -- Atualizar status do envio
    UPDATE logistica.full_envio
    SET status = 'registrado',
        emitted_at = NOW()
    WHERE id = p_envio_id;

END;
$function$;
