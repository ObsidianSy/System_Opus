require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkChannels() {
    try {
        // Ver todos os canais distintos na planilha
        const channelsPlanilha = await pool.query(
            `SELECT DISTINCT channel, COUNT(*) as total
             FROM raw_export_orders 
             WHERE client_id = 1
             GROUP BY channel
             ORDER BY total DESC`
        );

        console.log('📋 CANAIS na PLANILHA (raw_export_orders):');
        channelsPlanilha.rows.forEach(row => {
            console.log(`   "${row.channel}": ${row.total} registros`);
        });

        // Ver todos os canais distintos em vendas
        const channelsVendas = await pool.query(
            `SELECT DISTINCT canal, COUNT(*) as total
             FROM obsidian.vendas 
             WHERE client_id = 1
             GROUP BY canal
             ORDER BY total DESC`
        );

        console.log('\n💰 CANAIS em VENDAS (obsidian.vendas):');
        channelsVendas.rows.forEach(row => {
            console.log(`   "${row.canal}": ${row.total} registros`);
        });

        // Ver amostra de pedidos
        const sample = await pool.query(
            `SELECT order_id, channel, customer
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched'
             LIMIT 5`
        );

        console.log('\n🔍 AMOSTRA de 5 pedidos:');
        sample.rows.forEach(row => {
            console.log(`   Order: ${row.order_id}, Channel: "${row.channel}", Customer: ${row.customer}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkChannels();
