const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

(async () => {
    console.log('🔍 Estrutura da tabela vendas:\n');

    const cols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'obsidian' AND table_name = 'vendas' 
        ORDER BY ordinal_position
    `);

    console.table(cols.rows);
    await pool.end();
})();
