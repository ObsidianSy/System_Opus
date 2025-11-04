require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkAll() {
    try {
        console.log('🔍 === ANÁLISE COMPLETA DA PLANILHA ===\n');

        // TUDO que foi importado
        const totalImported = await pool.query(
            `SELECT COUNT(*) as total 
             FROM raw_export_orders 
             WHERE client_id = 1`
        );
        console.log(`📦 TOTAL IMPORTADO na planilha: ${totalImported.rows[0].total} registros`);

        // Por status
        const byStatus = await pool.query(
            `SELECT status, COUNT(*) as total 
             FROM raw_export_orders 
             WHERE client_id = 1 
             GROUP BY status`
        );
        console.log(`\n📊 POR STATUS:`);
        byStatus.rows.forEach(row => {
            console.log(`   ${row.status}: ${row.total} registros`);
        });

        // Matched vs vendas
        const matched = await pool.query(
            `SELECT COUNT(*) as total 
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched' AND matched_sku IS NOT NULL`
        );

        const vendas = await pool.query(
            `SELECT COUNT(*) as total 
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );

        console.log(`\n🔄 COMPARAÇÃO:`);
        console.log(`   Matched na planilha: ${matched.rows[0].total}`);
        console.log(`   Vendas emitidas: ${vendas.rows[0].total}`);
        console.log(`   Diferença: ${matched.rows[0].total - vendas.rows[0].total}`);

        // Ver quantidade total vendida
        const qtdTotal = await pool.query(
            `SELECT SUM(qty::numeric) as total_qty 
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched'`
        );

        const qtdVendas = await pool.query(
            `SELECT SUM(quantidade_vendida) as total_qty 
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );

        console.log(`\n📈 QUANTIDADE TOTAL:`);
        console.log(`   Qty na planilha (matched): ${qtdTotal.rows[0].total_qty || 0}`);
        console.log(`   Qty em vendas: ${qtdVendas.rows[0].total_qty || 0}`);

        // Ver valor total
        const valorTotal = await pool.query(
            `SELECT SUM((qty::numeric) * (unit_price::numeric)) as total_valor 
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched'`
        );

        const valorVendas = await pool.query(
            `SELECT SUM(valor_total) as total_valor 
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );

        console.log(`\n💰 VALOR TOTAL:`);
        console.log(`   Valor na planilha: R$ ${parseFloat(valorTotal.rows[0].total_valor || 0).toFixed(2)}`);
        console.log(`   Valor em vendas: R$ ${parseFloat(valorVendas.rows[0].total_valor || 0).toFixed(2)}`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkAll();
