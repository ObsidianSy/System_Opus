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
    console.log('🔍 Verificando campos de cancelamento nas últimas 24h...\n');

    // Verificar estados do pedido
    const estados = await pool.query(`
        SELECT 
            "Estado do Pedido",
            COUNT(*) as total
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY "Estado do Pedido"
        ORDER BY total DESC
    `);

    console.log('📊 Estados do Pedido:');
    console.table(estados.rows);

    // Verificar campo de cancelamento específico
    const cancelados = await pool.query(`
        SELECT 
            "Pós-venda/Cancelado/Devolvido",
            COUNT(*) as total
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND "Pós-venda/Cancelado/Devolvido" IS NOT NULL
          AND "Pós-venda/Cancelado/Devolvido" != ''
        GROUP BY "Pós-venda/Cancelado/Devolvido"
        ORDER BY total DESC
    `);

    console.log('\n📊 Pós-venda/Cancelado/Devolvido:');
    if (cancelados.rows.length > 0) {
        console.table(cancelados.rows);
    } else {
        console.log('✅ Nenhum cancelamento encontrado');
    }

    // Verificar razões de cancelamento
    const razoes = await pool.query(`
        SELECT 
            "Razão do Cancelamento",
            COUNT(*) as total
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND "Razão do Cancelamento" IS NOT NULL
          AND "Razão do Cancelamento" != ''
        GROUP BY "Razão do Cancelamento"
        ORDER BY total DESC
    `);

    console.log('\n📊 Razões de Cancelamento:');
    if (razoes.rows.length > 0) {
        console.table(razoes.rows);
    } else {
        console.log('✅ Nenhuma razão de cancelamento encontrada');
    }

    // Verificar se pedidos cancelados foram emitidos como venda
    console.log('\n🔍 Verificando se algum cancelado virou venda...');
    const vendasCanceladas = await pool.query(`
        SELECT 
            v.pedido_uid,
            v.canal,
            v.created_at as emitido_em,
            r."Estado do Pedido",
            r."Pós-venda/Cancelado/Devolvido"
        FROM obsidian.vendas v
        JOIN raw_export_orders r ON v.pedido_uid = CONCAT('ML-', r.order_id)
        WHERE v.created_at > NOW() - INTERVAL '24 hours'
          AND (
              r."Estado do Pedido" ILIKE '%cancel%' 
              OR r."Pós-venda/Cancelado/Devolvido" IS NOT NULL
              OR r."Razão do Cancelamento" IS NOT NULL
          )
        LIMIT 10
    `);

    if (vendasCanceladas.rows.length > 0) {
        console.log('❌ ERRO! Encontradas vendas de pedidos cancelados:');
        console.table(vendasCanceladas.rows);
    } else {
        console.log('✅ Nenhuma venda de pedido cancelado encontrada (correto!)');
    }

    await pool.end();
})();
