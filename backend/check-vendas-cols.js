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

async function checkColumns() {
    try {
        // Ver colunas
        const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema='obsidian' AND table_name='vendas' 
      ORDER BY ordinal_position
    `);

        console.log('\n📋 Colunas da tabela vendas:');
        cols.rows.forEach(row => {
            console.log(`  • ${row.column_name} (${row.data_type})`);
        });

        // Ver dados de exemplo
        const sample = await pool.query(`
      SELECT * FROM obsidian.vendas 
      ORDER BY data_venda DESC 
      LIMIT 1
    `);

        console.log('\n📦 Exemplo de registro:');
        if (sample.rows.length > 0) {
            console.log(JSON.stringify(sample.rows[0], null, 2));
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
