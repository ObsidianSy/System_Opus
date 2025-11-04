import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkVendasSchema() {
    try {
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'obsidian'
              AND table_name = 'vendas'
            ORDER BY ordinal_position;
        `);

        console.log('\n📋 ESTRUTURA DA TABELA vendas:\n');
        columns.rows.forEach(col => {
            console.log(`   ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        // Verificar se há vendas
        const count = await pool.query(`SELECT COUNT(*) FROM obsidian.vendas`);
        console.log(`\n📊 Total de vendas: ${count.rows[0].count}\n`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkVendasSchema();
