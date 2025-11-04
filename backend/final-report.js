require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function finalReport() {
    try {
        console.log('🎯 === RELATÓRIO FINAL DE EMISSÃO ===\n');

        // Total na planilha
        const totalPlanilha = await pool.query(
            `SELECT COUNT(*) as itens, COUNT(DISTINCT order_id) as pedidos
             FROM raw_export_orders 
             WHERE client_id = 1`
        );
        console.log(`📦 PLANILHA IMPORTADA (client_id=1):`);
        console.log(`   Total de itens: ${totalPlanilha.rows[0].itens}`);
        console.log(`   Total de pedidos: ${totalPlanilha.rows[0].pedidos}`);

        // Matched
        const totalMatched = await pool.query(
            `SELECT COUNT(*) as itens, COUNT(DISTINCT order_id) as pedidos
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched' AND matched_sku IS NOT NULL`
        );
        console.log(`\n✅ RELACIONADOS (matched):`);
        console.log(`   Itens matched: ${totalMatched.rows[0].itens}`);
        console.log(`   Pedidos matched: ${totalMatched.rows[0].pedidos}`);

        // Pending
        const totalPending = await pool.query(
            `SELECT COUNT(*) as count 
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'pending'`
        );
        console.log(`\n⏳ PENDENTES (não relacionados):`);
        console.log(`   Itens pending: ${totalPending.rows[0].count}`);

        // Vendas inseridas
        const totalVendas = await pool.query(
            `SELECT COUNT(*) as itens, COUNT(DISTINCT pedido_uid) as pedidos
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );
        console.log(`\n🎉 VENDAS EMITIDAS:`);
        console.log(`   Itens em vendas: ${totalVendas.rows[0].itens}`);
        console.log(`   Pedidos em vendas: ${totalVendas.rows[0].pedidos}`);

        // Comparação
        const matched = parseInt(totalMatched.rows[0].itens);
        const vendas = parseInt(totalVendas.rows[0].itens);
        const percentual = ((vendas / matched) * 100).toFixed(2);

        console.log(`\n📊 COMPARAÇÃO:`);
        console.log(`   Matched: ${matched}`);
        console.log(`   Vendas: ${vendas}`);
        console.log(`   Progresso: ${percentual}%`);

        if (vendas >= matched) {
            console.log(`\n✅ ✅ ✅ SUCESSO! Todos os itens matched foram emitidos! ✅ ✅ ✅`);
        } else {
            console.log(`\n⚠️ Faltam ${matched - vendas} itens para emitir`);
        }

        // Top 5 SKUs mais vendidos
        const topSkus = await pool.query(
            `SELECT sku_produto, SUM(quantidade_vendida) as total_qty, COUNT(*) as vezes
             FROM obsidian.vendas 
             WHERE client_id = 1
             GROUP BY sku_produto
             ORDER BY total_qty DESC
             LIMIT 5`
        );

        console.log(`\n🔥 TOP 5 SKUs MAIS VENDIDOS:`);
        topSkus.rows.forEach((row, i) => {
            console.log(`   ${i + 1}. ${row.sku_produto}: ${row.total_qty} unidades (${row.vezes} pedidos)`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

finalReport();
