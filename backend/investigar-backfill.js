const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function investigar() {
    try {
        console.log('🔍 1. Vendas FULL sem pedido_uid:');
        const vendas = await pool.query(`
            SELECT data_venda, nome_cliente, sku_produto, quantidade_vendida, canal
            FROM obsidian.vendas
            WHERE canal = 'FULL-INBOUND' AND pedido_uid IS NULL
            LIMIT 5
        `);
        console.log(vendas.rows);

        console.log('\n🔍 2. Full envio items:');
        const items = await pool.query(`
            SELECT fei.sku, fei.codigo_ml, fe.envio_num, fe.client_id,
                   c.nome as cliente_nome
            FROM logistica.full_envio_item fei
            JOIN logistica.full_envio fe ON fe.id = fei.envio_id
            JOIN obsidian.clientes c ON c.id = fe.client_id
            LIMIT 5
        `);
        console.log(items.rows);

        console.log('\n🔍 3. Tentando match manual:');
        const match = await pool.query(`
            SELECT v.sku_produto, v.nome_cliente, v.data_venda,
                   fei.sku, fei.codigo_ml, fe.envio_num, c.nome as cliente_nome
            FROM obsidian.vendas v
            CROSS JOIN logistica.full_envio_item fei
            JOIN logistica.full_envio fe ON fe.id = fei.envio_id
            JOIN obsidian.clientes c ON c.id = fe.client_id
            WHERE v.canal = 'FULL-INBOUND'
              AND v.pedido_uid IS NULL
              AND v.sku_produto = fei.sku
              AND v.nome_cliente = c.nome
            LIMIT 5
        `);
        console.log(`\n✅ Encontrou ${match.rowCount} matches:`);
        console.log(match.rows);

        await pool.end();
    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    }
}

investigar();
