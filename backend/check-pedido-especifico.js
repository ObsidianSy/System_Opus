require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkPedido() {
    try {
        const pedidoId = '2000009418672449';

        console.log(`🔍 Buscando pedido ${pedidoId}...\n`);

        const result = await pool.query(`
            SELECT 
                id,
                "Nº de Pedido da Plataforma",
                sku_text,
                status,
                matched_sku,
                match_source,
                created_at
            FROM raw_export_orders
            WHERE "Nº de Pedido da Plataforma" = $1
            LIMIT 5
        `, [pedidoId]);

        if (result.rows.length === 0) {
            console.log('❌ Pedido não encontrado no banco');
        } else {
            console.log(`✅ Encontrado ${result.rows.length} registro(s):\n`);
            result.rows.forEach((row, i) => {
                console.log(`Registro ${i + 1}:`);
                console.log(`  ID: ${row.id}`);
                console.log(`  SKU: ${row.sku_text}`);
                console.log(`  Status: "${row.status}" (${row.status?.length || 0} chars)`);
                console.log(`  Matched SKU: ${row.matched_sku || 'NULL'}`);
                console.log(`  Match Source: ${row.match_source || 'NULL'}`);
                console.log(`  Created: ${row.created_at}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkPedido();
