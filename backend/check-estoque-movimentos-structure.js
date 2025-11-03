const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fabrica_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkEstoqueMovimentos() {
    try {
        console.log('🔍 Estrutura de obsidian.estoque_movimentos:\n');

        const columns = await pool.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_schema = 'obsidian' 
              AND table_name = 'estoque_movimentos'
            ORDER BY ordinal_position
        `);

        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? 'DEFAULT ' + col.column_default : ''}`);
        });

        // Sample de dados
        console.log('\n\n📝 Sample de 5 registros:\n');
        const sample = await pool.query(`SELECT * FROM obsidian.estoque_movimentos ORDER BY id DESC LIMIT 5`);

        sample.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ${JSON.stringify(row, null, 2)}\n`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkEstoqueMovimentos();
