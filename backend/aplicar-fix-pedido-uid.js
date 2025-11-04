const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'sistema_opus',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function aplicarFix() {
    try {
        console.log('🔧 Aplicando correção nas funções (ML + FULL)...');
        const sql = fs.readFileSync('fix-processar-pedido-types.sql', 'utf8');
        await pool.query(sql);
        console.log('✅ Funções processar_pedido e full_envio_emitir atualizadas!');
        console.log('   - ML: usa pedido_uid no INSERT');
        console.log('   - FULL: usa CONCAT(envio_num, \'-\', codigo_ml)');

        await pool.end();
    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    }
}

aplicarFix();
