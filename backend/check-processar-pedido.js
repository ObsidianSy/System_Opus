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

async function checkFunction() {
    try {
        const result = await pool.query(`
      SELECT 
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'obsidian' 
      AND p.proname = 'processar_pedido'
    `);

        if (result.rows.length > 0) {
            console.log('📄 Definição da função processar_pedido:\n');
            console.log(result.rows[0].definition);
        } else {
            console.log('❌ Função processar_pedido não encontrada!');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkFunction();
