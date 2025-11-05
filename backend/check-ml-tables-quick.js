const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    connectionTimeoutMillis: 30000,
});

async function checkMLTables() {
    try {
        const result = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE '%ml%' OR table_name LIKE '%envio%'
            ORDER BY table_schema, table_name
        `);

        console.log('📊 Tabelas encontradas com ML ou ENVIO:');
        result.rows.forEach(row => {
            console.log(`  ${row.table_schema}.${row.table_name}`);
        });

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await pool.end();
    }
}

checkMLTables();
