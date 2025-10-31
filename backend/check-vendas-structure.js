import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkVendas() {
    try {
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'obsidian' 
            AND table_name = 'vendas'
            ORDER BY ordinal_position
        `);

        console.log('Colunas da tabela obsidian.vendas:');
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}) ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
        });

        // Ver uma venda de exemplo
        const sample = await pool.query('SELECT * FROM obsidian.vendas LIMIT 1');
        console.log('\nExemplo de venda:');
        console.log(JSON.stringify(sample.rows[0], null, 2));
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkVendas();
