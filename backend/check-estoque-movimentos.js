
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

(async () => {
    // Estrutura da tabela estoque_movimentos
    const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'obsidian' AND table_name = 'estoque_movimentos'
        ORDER BY ordinal_position
    `);
    
    console.log('📊 ESTRUTURA: obsidian.estoque_movimentos\n');
    result.rows.forEach(c => {
        console.log(`   ${c.column_name.padEnd(25)} ${c.data_type.padEnd(20)} NULL: ${c.is_nullable}`);
    });
    
    // Verificar se função full_envio_emitir usa pedido_uid
    const func = await pool.query(`
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc
        WHERE proname = 'full_envio_emitir'
          AND pronamespace = 'logistica'::regnamespace
    `);
    
    if (func.rowCount > 0) {
        const def = func.rows[0].definition;
        if (def.includes('pedido_uid')) {
            console.log('\n⚠️ PROBLEMA: função full_envio_emitir tenta usar pedido_uid em estoque_movimentos');
            console.log('   Mas a coluna NÃO EXISTE na tabela!');
        }
    }
    
    await pool.end();
})();
