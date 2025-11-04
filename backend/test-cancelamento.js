const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

(async () => {
    console.log('🔍 Simulando detecção de cancelamento...\n');

    // Buscar pedidos matched das últimas 24h
    const pedidos = await pool.query(`
        SELECT 
            order_id,
            channel,
            "Método de Envio" as metodo_envio,
            "Estado do Pedido" as estado_pedido,
            "Pós-venda/Cancelado/Devolvido" as pos_venda,
            "Razão do Cancelamento" as razao_cancelamento,
            COUNT(*) as itens
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND status = 'matched'
        GROUP BY order_id, channel, "Método de Envio", "Estado do Pedido", "Pós-venda/Cancelado/Devolvido", "Razão do Cancelamento"
        ORDER BY order_id
        LIMIT 20
    `);

    let normalCount = 0;
    let fullCount = 0;
    let canceladoCount = 0;

    console.log('📊 Análise de 20 primeiros pedidos:\n');

    pedidos.rows.forEach(p => {
        const estadoPedido = p.estado_pedido?.toUpperCase() || '';
        const posVenda = p.pos_venda?.toUpperCase() || '';
        const razaoCancelamento = p.razao_cancelamento || '';
        const canal = p.channel?.toUpperCase() || 'ML';
        const metodoEnvio = p.metodo_envio?.toUpperCase() || '';

        // Verificar cancelamento
        const isCancelado = posVenda.includes('CANCELADO') ||
            estadoPedido.includes('CANCEL') ||
            (razaoCancelamento && razaoCancelamento.trim() !== '');

        // Verificar FULL
        const isFull = canal.includes('FULL') ||
            canal.includes('FBM') ||
            metodoEnvio.includes('FULL') ||
            metodoEnvio.includes('FBM') ||
            metodoEnvio.includes('FUFILL');

        let status = '✅ NORMAL';
        if (isCancelado) {
            status = '🗑️ CANCELADO';
            canceladoCount++;
        } else if (isFull) {
            status = '⏭️ FULL';
            fullCount++;
        } else {
            normalCount++;
        }

        console.log(`Pedido: ${p.order_id}`);
        console.log(`  Canal: ${p.channel}`);
        console.log(`  Método: ${p.metodo_envio}`);
        console.log(`  Estado: ${p.estado_pedido}`);
        console.log(`  Pós-venda: ${p.pos_venda || '(vazio)'}`);
        console.log(`  Razão Cancel: ${p.razao_cancelamento || '(vazio)'}`);
        console.log(`  Status: ${status}`);
        console.log('');
    });

    console.log('📈 Resumo da amostra:');
    console.log(`  ✅ Normal (vai emitir): ${normalCount}`);
    console.log(`  ⏭️ Fulfillment (pula): ${fullCount}`);
    console.log(`  🗑️ Cancelado (pula/remove): ${canceladoCount}`);

    // Estatísticas gerais
    console.log('\n📊 Estatísticas gerais das últimas 24h:');
    const stats = await pool.query(`
        SELECT 
            CASE 
                WHEN ("Pós-venda/Cancelado/Devolvido" ILIKE '%cancelado%' 
                      OR "Estado do Pedido" ILIKE '%cancel%'
                      OR "Razão do Cancelamento" IS NOT NULL AND "Razão do Cancelamento" != '')
                THEN 'CANCELADO'
                WHEN ("Método de Envio" ILIKE '%fufill%' OR "Método de Envio" ILIKE '%fulfill%')
                THEN 'FULFILLMENT'
                ELSE 'NORMAL'
            END as tipo_pedido,
            COUNT(DISTINCT order_id) as pedidos,
            COUNT(*) as itens
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND status = 'matched'
        GROUP BY tipo_pedido
    `);

    console.table(stats.rows);

    await pool.end();
})();
