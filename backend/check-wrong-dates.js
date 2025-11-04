require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkWrongDates() {
    try {
        console.log('🔍 === ANÁLISE DE DATAS ERRADAS ===\n');

        // Ver distribuição de datas nas vendas
        const dateDistribution = await pool.query(
            `SELECT 
                data_venda::date as data,
                COUNT(*) as total_vendas,
                SUM(valor_total) as valor_total
             FROM obsidian.vendas 
             WHERE client_id = 1
             GROUP BY data_venda::date
             ORDER BY data_venda::date`
        );

        console.log('📅 TODAS AS DATAS gravadas em vendas:');
        dateDistribution.rows.forEach(row => {
            console.log(`   ${row.data}: ${row.total_vendas} vendas - R$ ${parseFloat(row.valor_total).toFixed(2)}`);
        });

        // Contar vendas de OUTUBRO/2025
        const outubro = await pool.query(
            `SELECT 
                COUNT(*) as total_vendas,
                SUM(valor_total) as valor_total
             FROM obsidian.vendas 
             WHERE client_id = 1 
             AND data_venda >= '2025-10-01' 
             AND data_venda < '2025-11-01'`
        );

        console.log(`\n📆 OUTUBRO/2025 (período esperado):`);
        console.log(`   Vendas: ${outubro.rows[0].total_vendas}`);
        console.log(`   Valor: R$ ${parseFloat(outubro.rows[0].valor_total || 0).toFixed(2)}`);

        // Ver datas na planilha ORIGINAL
        const datesInPlanilha = await pool.query(
            `SELECT 
                order_date::date as data,
                COUNT(*) as total,
                SUM((qty::numeric) * (unit_price::numeric)) as valor_total
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched'
             GROUP BY order_date::date
             ORDER BY order_date::date
             LIMIT 20`
        );

        console.log(`\n📋 DATAS NA PLANILHA ORIGINAL (raw_export_orders):`);
        datesInPlanilha.rows.forEach(row => {
            console.log(`   ${row.data}: ${row.total} itens - R$ ${parseFloat(row.valor_total).toFixed(2)}`);
        });

        // Verificar se order_date está sendo parseado corretamente
        const sampleDates = await pool.query(
            `SELECT order_id, order_date, customer
             FROM raw_export_orders 
             WHERE client_id = 1 AND status = 'matched'
             LIMIT 5`
        );

        console.log(`\n🔍 AMOSTRA de datas na planilha:`);
        sampleDates.rows.forEach(row => {
            console.log(`   Order: ${row.order_id}`);
            console.log(`   Date: ${row.order_date}`);
            console.log(`   Customer: ${row.customer}`);
            console.log('');
        });

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkWrongDates();
