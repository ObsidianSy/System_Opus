require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkStatus() {
    try {
        // Total de itens matched
        const totalMatched = await pool.query(
            `SELECT COUNT(*) as count 
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched' AND matched_sku IS NOT NULL`
        );
        console.log(`📦 Total de ITENS matched na planilha: ${totalMatched.rows[0].count}`);

        // Total de pedidos únicos matched
        const totalOrders = await pool.query(
            `SELECT COUNT(DISTINCT order_id) as count 
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched' AND matched_sku IS NOT NULL`
        );
        console.log(`📋 Total de PEDIDOS únicos: ${totalOrders.rows[0].count}`);

        // Vendas inseridas
        const vendasInsert = await pool.query(
            `SELECT COUNT(*) as total_vendas, COUNT(DISTINCT pedido_uid) as pedidos_unicos
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );
        console.log(`\n✅ Vendas inseridas: ${vendasInsert.rows[0].total_vendas} itens`);
        console.log(`📋 Pedidos únicos em vendas: ${vendasInsert.rows[0].pedidos_unicos}`);

        // Percentual
        const matched = parseInt(totalMatched.rows[0].count);
        const vendas = parseInt(vendasInsert.rows[0].total_vendas);
        const percentual = ((vendas / matched) * 100).toFixed(2);
        console.log(`\n📊 Progresso: ${percentual}% (${vendas}/${matched})`);
        console.log(`⏳ Faltam: ${matched - vendas} itens`);

        // Verificar última venda
        const lastVenda = await pool.query(
            `SELECT pedido_uid, sku_produto, quantidade_vendida, created_at
             FROM obsidian.vendas 
             WHERE client_id = 1 
             ORDER BY created_at DESC 
             LIMIT 1`
        );

        if (lastVenda.rows.length > 0) {
            console.log(`\n🕐 Última venda inserida:`);
            console.log(`  Pedido: ${lastVenda.rows[0].pedido_uid}`);
            console.log(`  SKU: ${lastVenda.rows[0].sku_produto}`);
            console.log(`  Data: ${lastVenda.rows[0].created_at}`);
        }

        // Verificar se o backend está processando agora
        const now = new Date();
        const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const recentVendas = await pool.query(
            `SELECT COUNT(*) as count 
             FROM obsidian.vendas 
             WHERE client_id = 1 AND created_at > $1`,
            [fiveMinAgo]
        );

        console.log(`\n🔥 Vendas nos últimos 5 minutos: ${recentVendas.rows[0].count}`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkStatus();
