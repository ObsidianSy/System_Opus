const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    connectionTimeoutMillis: 30000,
});

async function checkColumns() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'logistica' 
              AND table_name = 'full_envio_raw'
            ORDER BY ordinal_position
        `);

        console.log('📊 Colunas da tabela logistica.full_envio_raw:\n');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name.padEnd(30)} | ${row.data_type.padEnd(20)} | Nullable: ${row.is_nullable}`);
        });

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
