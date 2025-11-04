require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkOrders() {
    try {
        // Verificar se há order_id nulos
        const nullResult = await pool.query(
            `SELECT COUNT(*) as count 
             FROM raw_export_orders 
             WHERE status = 'matched' AND matched_sku IS NOT NULL 
               AND client_id = 1 
               AND order_id IS NULL`
        );
        console.log(`📋 Registros com order_id NULL: ${nullResult.rows[0].count}`);

        // Verificar primeiro pedido
        const firstResult = await pool.query(
            `SELECT order_id, order_date, customer, channel, COUNT(*) as items_count
             FROM raw_export_orders 
             WHERE status = 'matched' AND matched_sku IS NOT NULL 
               AND client_id = 1
             GROUP BY order_id, order_date, customer, channel
             ORDER BY order_id
             LIMIT 3`
        );

        console.log(`\n📦 Primeiros 3 pedidos:`);
        firstResult.rows.forEach(row => {
            console.log(`  - Order: ${row.order_id}, Items: ${row.items_count}, Date: ${row.order_date}, Channel: ${row.channel}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkOrders();
