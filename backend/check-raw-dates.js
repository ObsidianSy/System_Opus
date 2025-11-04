require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkRawDates() {
    try {
        // Ver as colunas originais da planilha
        const sample = await pool.query(
            `SELECT 
                "Nº de Pedido da Plataforma" as order_id,
                "Hora do Pedido" as hora_pedido,
                "Hora do Pagamento" as hora_pagamento,
                order_date,
                sku_text,
                customer
             FROM raw_export_orders 
             WHERE client_id = 1
             ORDER BY id
             LIMIT 10`
        );

        console.log('🔍 AMOSTRA DAS DATAS ORIGINAIS NA PLANILHA:\n');
        sample.rows.forEach((row, i) => {
            console.log(`${i + 1}. Order: ${row.order_id}`);
            console.log(`   Hora do Pedido: ${row.hora_pedido}`);
            console.log(`   Hora do Pagamento: ${row.hora_pagamento}`);
            console.log(`   order_date (parseado): ${row.order_date}`);
            console.log(`   SKU: ${row.sku_text}`);
            console.log('');
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkRawDates();
