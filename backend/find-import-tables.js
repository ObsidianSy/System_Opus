const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    connectionTimeoutMillis: 30000,
    ssl: false
});

async function findTables() {
    try {
        // Buscar todas as tabelas relacionadas a envio/full
        const tables = await pool.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = 'obsidian' 
         AND information_schema.columns.table_name = t.table_name) as num_columns
      FROM information_schema.tables t
      WHERE table_schema = 'obsidian'
      AND (table_name LIKE '%envio%' OR table_name LIKE '%full%' OR table_name LIKE '%ml%' OR table_name LIKE '%raw%')
      ORDER BY table_name
    `);

        console.log('📋 Tabelas relacionadas a envio/importação:\n');
        tables.rows.forEach(row => {
            console.log(`  • ${row.table_name} (${row.num_columns} colunas)`);
        });

        // Ver se tem dados em ml_envio_raw
        const mlCount = await pool.query(`
      SELECT COUNT(*) as total FROM obsidian.ml_envio_raw
    `);
        console.log(`\n📦 ml_envio_raw: ${mlCount.rows[0].total} registros`);

        if (mlCount.rows[0].total > 0) {
            const mlSample = await pool.query(`
        SELECT * FROM obsidian.ml_envio_raw LIMIT 1
      `);
            console.log('\n📋 Colunas em ml_envio_raw:');
            Object.keys(mlSample.rows[0]).forEach(col => {
                console.log(`  • ${col}`);
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

findTables();
