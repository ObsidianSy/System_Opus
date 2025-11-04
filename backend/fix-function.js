require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function fixFunction() {
    try {
        // 1. Dropar função antiga
        await pool.query('DROP FUNCTION IF EXISTS obsidian.processar_pedido(text, date, text, text, jsonb, integer, uuid)');
        console.log('✅ Função antiga removida');

        // 2. Criar nova função com BIGINT
        const createFunctionSQL = `
CREATE OR REPLACE FUNCTION obsidian.processar_pedido(
    p_pedido_uid text, 
    p_data_venda date, 
    p_nome_cliente text, 
    p_canal text, 
    p_items jsonb, 
    p_client_id bigint DEFAULT NULL,
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

        IF v_nome_produto IS NULL OR v_nome_produto = v_sku THEN
            SELECT nome INTO v_nome_produto
            FROM obsidian.produtos
            WHERE sku = v_sku;

            IF v_nome_produto IS NULL THEN
                v_nome_produto := v_sku;
            END IF;
        END IF;

        SELECT EXISTS(
            SELECT 1 FROM obsidian.vendas
            WHERE pedido_uid = p_pedido_uid AND sku_produto = v_sku
        ) INTO v_venda_existe;

        INSERT INTO obsidian.vendas (
            data_venda, nome_cliente, sku_produto, quantidade_vendida,
            preco_unitario, valor_total, nome_produto, canal, pedido_uid,
            client_id, import_id, codigo_ml
        ) VALUES (
            p_data_venda, p_nome_cliente, v_sku, v_quantidade,
            v_preco_unitario, v_quantidade * v_preco_unitario,
            v_nome_produto, p_canal, p_pedido_uid,
            p_client_id, p_import_id, p_pedido_uid
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
            import_id = EXCLUDED.import_id;

        SELECT quantidade_atual INTO v_estoque_atual
        FROM obsidian.produtos
        WHERE sku = v_sku;

        sku_retorno := v_sku;
        quantidade_baixada := v_quantidade;
        estoque_pos := v_estoque_atual;
        operacao := CASE WHEN v_venda_existe THEN 'UPDATE' ELSE 'INSERT' END;
        RETURN NEXT;

    END LOOP;

    RETURN;
END;
$function$`;

        await pool.query(createFunctionSQL);
        console.log('✅ Nova função criada com BIGINT!');
        console.log('📊 Nova assinatura: processar_pedido(text, date, text, text, jsonb, BIGINT, uuid)');

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

fixFunction();
