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

async function checkFullVendas() {
    try {
        const result = await pool.query(`
      SELECT pedido_uid, canal, nome_cliente
      FROM obsidian.vendas 
      WHERE pedido_uid LIKE '53%' OR pedido_uid LIKE '52%'
      LIMIT 10
    `);

        console.log('📦 Exemplos de pedidos FULL na tabela vendas:\n');
        result.rows.forEach(row => {
            console.log(`  Pedido: ${row.pedido_uid}`);
            console.log(`  Canal: "${row.canal}"`);
            console.log(`  Cliente: ${row.nome_cliente}`);
            console.log('  ---');
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkFullVendas();
