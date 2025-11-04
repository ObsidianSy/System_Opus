require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkImportStatus() {
    try {
        // Verificar o único registro do import mais recente
        const latestImport = '8d97b60c-57c1-4973-b1e4-f14053ab75ea';

        const result = await pool.query(
            `SELECT id, order_id, sku_text, matched_sku, status, match_source 
             FROM raw_export_orders 
             WHERE import_id = $1`,
            [latestImport]
        );

        console.log('📋 Registro do import mais recente:');
        console.log(result.rows[0]);

        // Verificar o import com mais registros
        const bigImport = '1401e59b-2234-4388-8530-748ca26ad2ed';

        const bigResult = await pool.query(
            `SELECT status, COUNT(*) as count 
             FROM raw_export_orders 
             WHERE import_id = $1 
             GROUP BY status`,
            [bigImport]
        );

        console.log(`\n📦 Status dos registros do import ${bigImport}:`);
        bigResult.rows.forEach(row => {
            console.log(`  - ${row.status}: ${row.count} registros`);
        });

        // Testar query com o import correto
        const testResult = await pool.query(
            `SELECT COUNT(*) as count 
             FROM raw_export_orders 
             WHERE status = 'matched' AND matched_sku IS NOT NULL 
               AND client_id = 1 
               AND import_id = $1`,
            [bigImport]
        );

        console.log(`\n✅ Registros matched no import correto: ${testResult.rows[0].count}`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkImportStatus();
