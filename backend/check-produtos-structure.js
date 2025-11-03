const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkProdutosStructure() {
    try {
        console.log('🔍 VERIFICANDO ESTRUTURA DA TABELA produtos:\n');

        const columns = await pool.query(`
            SELECT 
                table_schema,
                table_name,
                column_name, 
                data_type 
            FROM information_schema.columns 
            WHERE table_name = 'produtos'
            ORDER BY table_schema, ordinal_position
        `);

        columns.rows.forEach(row => {
            console.log(`  ${row.table_schema}.${row.table_name}.${row.column_name} (${row.data_type})`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkProdutosStructure();
