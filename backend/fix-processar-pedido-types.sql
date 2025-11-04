-- ============================================================================
-- CORREÇÃO: Alterar tipos de parâmetros da função processar_pedido
-- ============================================================================
-- Problema: client_id é BIGINT mas função espera INTEGER
-- ============================================================================

-- Dropar função antiga
DROP FUNCTION IF EXISTS obsidian.processar_pedido(text, date, text, text, jsonb, integer, uuid);

-- Recriar função com tipos corretos (client_id como BIGINT)
CREATE OR REPLACE FUNCTION obsidian.processar_pedido(
    p_pedido_uid text, 
    p_data_venda date, 
    p_nome_cliente text, 
    p_canal text, 
    p_items jsonb, 
    p_client_id bigint DEFAULT NULL,  -- ✅ MUDOU DE INTEGER PARA BIGINT
    p_import_id uuid DEFAULT NULL,
    OUT sku_retorno text, 
    OUT quantidade_baixada numeric, 
    OUT estoque_pos numeric, 
    OUT operacao text
)
RETURNS SETOF record
LANGUAGE plpgsql
AS $function$
DECLARE
    item RECORD;
    v_sku TEXT;
    v_quantidade NUMERIC;
    v_preco_unitario NUMERIC;
    v_nome_produto TEXT;
    v_estoque_atual NUMERIC;
    v_venda_existe BOOLEAN;
BEGIN
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        sku TEXT,
        nome_produto TEXT,
        quantidade NUMERIC,
        preco_unitario NUMERIC
    )
    LOOP
        v_sku := item.sku;
        v_quantidade := item.quantidade;
        v_preco_unitario := item.preco_unitario;
        v_nome_produto := item.nome_produto;

        -- Buscar nome do produto se não informado
        IF v_nome_produto IS NULL OR v_nome_produto = v_sku THEN
            SELECT nome INTO v_nome_produto
            FROM obsidian.produtos
            WHERE sku = v_sku;

            IF v_nome_produto IS NULL THEN
                v_nome_produto := v_sku;
            END IF;
        END IF;

        -- VERIFICAR SE A VENDA JÁ EXISTE
        SELECT EXISTS(
            SELECT 1 FROM obsidian.vendas
            WHERE pedido_uid = p_pedido_uid AND sku_produto = v_sku
        ) INTO v_venda_existe;

        -- INSERIR OU ATUALIZAR VENDA (UPSERT)
        -- O TRIGGER trg_baixa_estoque vai baixar o estoque automaticamente
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
            codigo_ml
        ) VALUES (
            p_pedido_uid,
            p_data_venda,
            p_nome_cliente,
            v_sku,
            v_quantidade,
            v_preco_unitario,
            v_quantidade * v_preco_unitario,
            v_nome_produto,
            p_canal,
            p_client_id,
            p_import_id,
            p_pedido_uid  -- codigo_ml = pedido_uid para vendas ML
        )
        ON CONFLICT ON CONSTRAINT vendas_dedupe
        DO UPDATE SET
            quantidade_vendida = EXCLUDED.quantidade_vendida,
            preco_unitario = EXCLUDED.preco_unitario,
            valor_total = EXCLUDED.valor_total,
            data_venda = EXCLUDED.data_venda,
            nome_produto = EXCLUDED.nome_produto,
            canal = EXCLUDED.canal,
            client_id = EXCLUDED.client_id,
            import_id = EXCLUDED.import_id,
            pedido_uid = EXCLUDED.pedido_uid;

        -- Buscar estoque atual
        SELECT quantidade_atual INTO v_estoque_atual
        FROM obsidian.produtos
        WHERE sku = v_sku;

        -- Retornar informação
        sku_retorno := v_sku;
        quantidade_baixada := v_quantidade;
        estoque_pos := v_estoque_atual;
        operacao := CASE WHEN v_venda_existe THEN 'UPDATE' ELSE 'INSERT' END;
        RETURN NEXT;

    END LOOP;

    RETURN;
END;
$function$;
