require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function investigateVendas() {
    try {
        console.log('🔍 === INVESTIGAÇÃO DE VENDAS ===\n');

        // Total de registros na tabela vendas
        const totalVendas = await pool.query(
            `SELECT COUNT(*) as total FROM obsidian.vendas`
        );
        console.log(`📊 TOTAL GERAL na tabela vendas: ${totalVendas.rows[0].total} registros`);

        // Por client_id
        const porCliente = await pool.query(
            `SELECT client_id, COUNT(*) as total 
             FROM obsidian.vendas 
             GROUP BY client_id 
             ORDER BY total DESC`
        );
        console.log(`\n👥 VENDAS POR CLIENT_ID:`);
        porCliente.rows.forEach(row => {
            console.log(`   Client ${row.client_id}: ${row.total} vendas`);
        });

        // Por canal
        const porCanal = await pool.query(
            `SELECT canal, COUNT(*) as total 
             FROM obsidian.vendas 
             GROUP BY canal 
             ORDER BY total DESC`
        );
        console.log(`\n📡 VENDAS POR CANAL:`);
        porCanal.rows.forEach(row => {
            console.log(`   ${row.canal}: ${row.total} vendas`);
        });

        // Vendas do cliente 1 (New Seven) no canal ML
        const newSevenML = await pool.query(
            `SELECT COUNT(*) as total, COUNT(DISTINCT pedido_uid) as pedidos_unicos
             FROM obsidian.vendas 
             WHERE client_id = 1 AND canal = 'Mercado Libre'`
        );
        console.log(`\n🎯 NEW SEVEN (client_id=1) - Canal "Mercado Libre":`);
        console.log(`   Total de itens: ${newSevenML.rows[0].total}`);
        console.log(`   Pedidos únicos: ${newSevenML.rows[0].pedidos_unicos}`);

        // Verificar se há vendas sem client_id
        const semClientId = await pool.query(
            `SELECT COUNT(*) as total 
             FROM obsidian.vendas 
             WHERE client_id IS NULL`
        );
        console.log(`\n⚠️ Vendas SEM client_id: ${semClientId.rows[0].total}`);

        // Ver estrutura da última venda
        const lastVenda = await pool.query(
            `SELECT * FROM obsidian.vendas ORDER BY id DESC LIMIT 1`
        );
        console.log(`\n📋 ÚLTIMA VENDA INSERIDA:`);
        console.log(lastVenda.rows[0]);

        // Contar quantos SKUs únicos
        const skusUnicos = await pool.query(
            `SELECT COUNT(DISTINCT sku_produto) as skus_unicos
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );
        console.log(`\n🔢 SKUs ÚNICOS vendidos (client_id=1): ${skusUnicos.rows[0].skus_unicos}`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

investigateVendas();
