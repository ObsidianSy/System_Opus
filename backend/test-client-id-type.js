require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function testClientIdType() {
    try {
        // Testar com STRING '1'
        const stringResult = await pool.query(
            `SELECT COUNT(*) as count FROM raw_export_orders WHERE client_id = $1`,
            ['1']
        );
        console.log(`✅ Com STRING '1': ${stringResult.rows[0].count} registros`);

        // Testar com NUMBER 1
        const numberResult = await pool.query(
            `SELECT COUNT(*) as count FROM raw_export_orders WHERE client_id = $1`,
            [1]
        );
        console.log(`✅ Com NUMBER 1: ${numberResult.rows[0].count} registros`);

        // Testar com BIGINT 1n (não suportado diretamente no node-postgres)
        const castResult = await pool.query(
            `SELECT COUNT(*) as count FROM raw_export_orders WHERE client_id = $1::bigint`,
            ['1']
        );
        console.log(`✅ Com CAST '1'::bigint: ${castResult.rows[0].count} registros`);

        // Ver o tipo real da coluna
        const typeResult = await pool.query(
            `SELECT data_type FROM information_schema.columns 
             WHERE table_name = 'raw_export_orders' AND column_name = 'client_id'`
        );
        console.log(`\n📊 Tipo da coluna client_id: ${typeResult.rows[0].data_type}`);

        // Ver valor real no banco
        const valueResult = await pool.query(
            `SELECT DISTINCT client_id, pg_typeof(client_id) as tipo 
             FROM raw_export_orders 
             LIMIT 3`
        );
        console.log(`\n🔍 Valores reais no banco:`);
        valueResult.rows.forEach(row => {
            console.log(`  - client_id: ${row.client_id} (tipo: ${row.tipo})`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

testClientIdType();
