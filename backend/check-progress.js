require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkProgress() {
    try {
        // Contar registros matched na planilha
        const matchedResult = await pool.query(
            `SELECT COUNT(*) as count 
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched' AND matched_sku IS NOT NULL`
        );
        console.log(`📦 Registros MATCHED na planilha (client_id=1): ${matchedResult.rows[0].count}`);

        // Contar vendas inseridas
        const vendasResult = await pool.query(
            `SELECT COUNT(*) as count 
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );
        console.log(`✅ Vendas INSERIDAS no sistema (client_id=1): ${vendasResult.rows[0].count}`);

        // Calcular percentual
        const matched = parseInt(matchedResult.rows[0].count);
        const vendas = parseInt(vendasResult.rows[0].count);
        const percentual = matched > 0 ? ((vendas / matched) * 100).toFixed(2) : 0;
        console.log(`📊 Percentual processado: ${percentual}%`);

        // Ver últimas 5 vendas inseridas
        const lastVendas = await pool.query(
            `SELECT id, data_venda, nome_cliente, sku_produto, quantidade_vendida, pedido_uid, created_at
             FROM obsidian.vendas 
             WHERE client_id = 1 
             ORDER BY created_at DESC 
             LIMIT 5`
        );

        console.log(`\n🔍 Últimas 5 vendas inseridas:`);
        lastVendas.rows.forEach(row => {
            console.log(`  - ${row.pedido_uid}: ${row.sku_produto} (${row.quantidade_vendida}) - ${row.created_at}`);
        });

        // Verificar se há pedidos travando
        const firstPending = await pool.query(
            `SELECT order_id, order_date, customer, COUNT(*) as items
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched' AND matched_sku IS NOT NULL
             GROUP BY order_id, order_date, customer
             ORDER BY order_id
             LIMIT 5`
        );

        console.log(`\n📋 Primeiros 5 pedidos para processar:`);
        firstPending.rows.forEach(row => {
            console.log(`  - Order: ${row.order_id}, Items: ${row.items}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkProgress();
