require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function testQuery() {
    try {
        const client_id = '1'; // New Seven

        // Buscar import_id mais recente
        const latestImport = await pool.query(
            `SELECT import_id 
             FROM raw_export_orders 
             WHERE client_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [client_id]
        );

        console.log('📦 Import ID mais recente:', latestImport.rows[0]?.import_id);

        const finalImportId = latestImport.rows[0]?.import_id;

        // Simular query do backend
        let whereClause = `WHERE status = 'matched' AND matched_sku IS NOT NULL`;
        const params = [];

        if (client_id) {
            params.push(client_id);
            whereClause += ` AND client_id = $${params.length}`;
        }

        if (finalImportId) {
            params.push(finalImportId);
            whereClause += ` AND import_id = $${params.length}`;
        }

        console.log('\n🔍 Query:', `SELECT COUNT(*) FROM raw_export_orders ${whereClause}`);
        console.log('📝 Params:', params);

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM raw_export_orders ${whereClause}`,
            params
        );

        console.log('\n✅ Total de registros encontrados:', countResult.rows[0].count);

        // Ver os primeiros 3 registros
        const sampleResult = await pool.query(
            `SELECT id, order_id, customer, matched_sku, qty, unit_price, status 
             FROM raw_export_orders 
             ${whereClause}
             LIMIT 3`,
            params
        );

        console.log('\n📋 Amostra dos registros:');
        sampleResult.rows.forEach(row => {
            console.log(`  - Order: ${row.order_id}, SKU: ${row.matched_sku}, Qty: ${row.qty}, Status: ${row.status}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

testQuery();
