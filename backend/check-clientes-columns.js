require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 30000, // 30 segundos
    query_timeout: 30000,
    ssl: false // Desabilita SSL
});

async function checkColumns() {
    try {
        console.log('🔍 Consultando colunas da tabela obsidian.clientes...\n');

        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_schema = 'obsidian' AND table_name = 'clientes'
            ORDER BY ordinal_position
        `);

        if (result.rows.length === 0) {
            console.log('❌ Tabela obsidian.clientes não encontrada!');
        } else {
            console.log('✅ Colunas encontradas:');
            result.rows.forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
            });
        }

        // Também verificar pagamentos e estoque
        console.log('\n🔍 Consultando colunas da tabela obsidian.pagamentos...\n');
        const pagamentos = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'obsidian' AND table_name = 'pagamentos'
            ORDER BY ordinal_position
        `);

        if (pagamentos.rows.length > 0) {
            console.log('✅ Colunas de pagamentos:');
            pagamentos.rows.forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
            });
        }

        console.log('\n🔍 Consultando colunas da tabela obsidian.produtos (estoque)...\n');
        const produtos = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_schema = 'obsidian' AND table_name = 'produtos'
            ORDER BY ordinal_position
        `);

        if (produtos.rows.length > 0) {
            console.log('✅ Colunas de produtos:');
            produtos.rows.forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
            });
        }

    } catch (error) {
        console.error('❌ Erro ao consultar:', error.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
