const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkFunctions() {
    try {
        console.log('🔍 FUNÇÕES DO BANCO FULL_ENVIO:\n');

        const functions = await pool.query(`
            SELECT 
                proname as function_name,
                pg_get_functiondef(oid) as definition
            FROM pg_proc
            WHERE pronamespace = 'logistica'::regnamespace
              AND proname LIKE '%full_envio%'
            ORDER BY proname
        `);

        for (const func of functions.rows) {
            console.log('='.repeat(80));
            console.log(`📦 FUNÇÃO: logistica.${func.function_name}()`);
            console.log('='.repeat(80));
            console.log(func.definition);
            console.log('\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkFunctions();
