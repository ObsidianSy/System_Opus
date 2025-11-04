require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkAllImports() {
    try {
        console.log('🔍 === TODAS AS IMPORTAÇÕES ===\n');

        // Todos os imports
        const allImports = await pool.query(
            `SELECT 
                import_id,
                client_id,
                COUNT(*) as registros,
                MIN(created_at) as imported_at
             FROM raw_export_orders
             GROUP BY import_id, client_id
             ORDER BY imported_at DESC`
        );

        console.log(`📦 TODOS OS IMPORTS (${allImports.rows.length} imports):`)
            ;
        allImports.rows.forEach((row, i) => {
            console.log(`\n${i + 1}. Import: ${row.import_id}`);
            console.log(`   Client ID: ${row.client_id}`);
            console.log(`   Registros: ${row.registros}`);
            console.log(`   Data: ${row.imported_at}`);
        });

        // Total geral
        const totalGeral = await pool.query(
            `SELECT COUNT(*) as total FROM raw_export_orders`
        );

        console.log(`\n📊 TOTAL GERAL na raw_export_orders: ${totalGeral.rows[0].total} registros`);

        // Total de vendas
        const totalVendas = await pool.query(
            `SELECT COUNT(*) as total FROM obsidian.vendas`
        );

        console.log(`📊 TOTAL GERAL em vendas: ${totalVendas.rows[0].total} registros`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkAllImports();
