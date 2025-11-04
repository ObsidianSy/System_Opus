require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function finalCheck() {
    try {
        console.log('🎯 === ANÁLISE FINAL ===\n');

        // Total de vendas vs pedidos únicos
        const summary = await pool.query(
            `SELECT 
                COUNT(*) as total_itens,
                COUNT(DISTINCT pedido_uid) as pedidos_unicos,
                COUNT(DISTINCT sku_produto) as skus_unicos,
                COUNT(DISTINCT nome_cliente) as clientes_unicos
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );

        console.log('📊 RESUMO GERAL (client_id=1):');
        console.log(`   Total de ITENS vendidos: ${summary.rows[0].total_itens}`);
        console.log(`   Pedidos ÚNICOS: ${summary.rows[0].pedidos_unicos}`);
        console.log(`   SKUs ÚNICOS: ${summary.rows[0].skus_unicos}`);
        console.log(`   Clientes ÚNICOS: ${summary.rows[0].clientes_unicos}`);

        // Análise por data de hoje
        const hoje = await pool.query(
            `SELECT 
                COUNT(*) as total_itens,
                COUNT(DISTINCT pedido_uid) as pedidos_unicos
             FROM obsidian.vendas 
             WHERE client_id = 1 
             AND data_venda::date = '2025-11-04'`
        );

        console.log(`\n📆 VENDAS DE HOJE (04/11/2025):`);
        console.log(`   Total de ITENS: ${hoje.rows[0].total_itens}`);
        console.log(`   Pedidos ÚNICOS: ${hoje.rows[0].pedidos_unicos}`);

        // Ver clientes
        const clientes = await pool.query(
            `SELECT DISTINCT nome_cliente
             FROM obsidian.vendas 
             WHERE client_id = 1
             LIMIT 5`
        );

        console.log(`\n👥 CLIENTES encontrados:`);
        clientes.rows.forEach(row => {
            console.log(`   - ${row.nome_cliente}`);
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

finalCheck();
