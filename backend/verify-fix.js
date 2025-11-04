require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function verify() {
    try {
        const result = await pool.query(`
            SELECT 
                p.proname as function_name,
                pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'obsidian'
            AND p.proname = 'processar_pedido'
        `);

        console.log('✅ Função encontrada:');
        console.log('Nome:', result.rows[0].function_name);
        console.log('Argumentos:', result.rows[0].arguments);

        if (result.rows[0].arguments.includes('bigint')) {
            console.log('\n✅ SUCESSO! A função agora aceita BIGINT para client_id');
        } else {
            console.log('\n❌ ERRO! A função ainda não foi atualizada corretamente');
        }

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

verify();
