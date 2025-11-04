require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkImportId() {
    try {
        const import_id = '8d97b60c-57c1-4973-b1e4-f14053ab75ea';

        // Testar apenas import_id
        const importOnlyResult = await pool.query(
            `SELECT COUNT(*) as count FROM raw_export_orders WHERE import_id = $1`,
            [import_id]
        );
        console.log(`✅ Registros com import_id = ${import_id}: ${importOnlyResult.rows[0].count}`);

        // Testar apenas client_id
        const clientOnlyResult = await pool.query(
            `SELECT COUNT(*) as count FROM raw_export_orders WHERE client_id = $1`,
            [1]
        );
        console.log(`✅ Registros com client_id = 1: ${clientOnlyResult.rows[0].count}`);

        // Testar AMBOS
        const bothResult = await pool.query(
            `SELECT COUNT(*) as count FROM raw_export_orders WHERE client_id = $1 AND import_id = $2`,
            [1, import_id]
        );
        console.log(`✅ Registros com AMBOS: ${bothResult.rows[0].count}`);

        // Ver todos os import_id distintos para client_id = 1
        const importsResult = await pool.query(
            `SELECT import_id, COUNT(*) as count 
             FROM raw_export_orders 
             WHERE client_id = 1 
             GROUP BY import_id 
             ORDER BY COUNT(*) DESC`
        );

        console.log(`\n📦 Todos os import_id para client_id=1:`);
        importsResult.rows.forEach(row => {
            console.log(`  - ${row.import_id}: ${row.count} registros`);
        });

        // Ver o import_id mais recente por created_at
        const latestResult = await pool.query(
            `SELECT import_id, MAX(created_at) as latest 
             FROM raw_export_orders 
             WHERE client_id = 1 
             GROUP BY import_id 
             ORDER BY latest DESC 
             LIMIT 3`
        );

        console.log(`\n⏰ Import_id mais recentes por data:`);
        latestResult.rows.forEach(row => {
            console.log(`  - ${row.import_id}: ${row.latest}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkImportId();
