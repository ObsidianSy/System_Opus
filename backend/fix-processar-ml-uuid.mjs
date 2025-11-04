import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function fixFunction() {
    try {
        await client.connect();
        console.log('✅ Conectado ao banco!\n');

        // Verificar tipo da coluna import_id
        console.log('📋 Verificando tipo da coluna import_id...');
        const columnType = await client.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'raw_export_orders' 
              AND column_name = 'import_id';
        `);

        console.log(`Tipo atual: ${columnType.rows[0]?.data_type || 'não encontrado'}\n`);

        // DROP e recriar com UUID
        console.log('📋 Atualizando função processar_pedidos_ml...');

        await client.query(`DROP FUNCTION IF EXISTS obsidian.processar_pedidos_ml(integer) CASCADE;`);
        await client.query(`DROP FUNCTION IF EXISTS obsidian.processar_pedidos_ml(uuid) CASCADE;`);
        console.log('✅ Funções antigas removidas!\n');

        await client.query(`
            CREATE FUNCTION obsidian.processar_pedidos_ml(p_import_id UUID)
            RETURNS TABLE(
                vendas_inseridas INTEGER,
                pedidos_processados INTEGER,
                pedidos_cancelados_ignorados INTEGER,
                vendas_revertidas INTEGER
            )
            LANGUAGE PLPGSQL
            AS $$
            DECLARE
                v_vendas_inseridas INTEGER := 0;
                v_pedidos_processados INTEGER := 0;
                v_pedidos_cancelados INTEGER := 0;
                v_vendas_revertidas INTEGER := 0;
                v_order RECORD;
                v_pedido_ja_emitido BOOLEAN;
                v_client_id INTEGER;
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

                    IF v_order.status_cancelamento IS NOT NULL 
                       AND TRIM(v_order.status_cancelamento) != '' THEN
                        
                        IF v_pedido_ja_emitido THEN
                            PERFORM obsidian.reverter_venda_cancelada(
                                v_order.order_id,
                                v_order.motivo
                            );
                            v_vendas_revertidas := v_vendas_revertidas + 1;
                        END IF;
                        
                        v_pedidos_cancelados := v_pedidos_cancelados + 1;
                        CONTINUE;
                    END IF;

                    -- Só processar se for pedido NOVO
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
                                    v_client_id,      -- ✅ NOVO: passa client_id
                                    p_import_id       -- ✅ NOVO: passa import_id
                                );
                                
                                v_vendas_inseridas := v_vendas_inseridas + jsonb_array_length(v_items);
                                v_pedidos_processados := v_pedidos_processados + 1;
                            END IF;
                        END;
                    END IF;
                END LOOP;

                RETURN QUERY SELECT 
                    v_vendas_inseridas,
                    v_pedidos_processados,
                    v_pedidos_cancelados,
                    v_vendas_revertidas;
            END;
            $$;
        `);

        console.log('✅ Função processar_pedidos_ml recriada com UUID!\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ FUNÇÃO CORRIGIDA PARA ACEITAR UUID!');
        console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    } finally {
        await client.end();
    }
}

fixFunction();
