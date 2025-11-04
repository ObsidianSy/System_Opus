require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkDates() {
    try {
        // Ver distribuição de datas nas vendas
        const dateDistribution = await pool.query(
            `SELECT 
                data_venda::date as data,
                COUNT(*) as total_vendas
             FROM obsidian.vendas 
             WHERE client_id = 1
             GROUP BY data_venda::date
             ORDER BY data_venda::date DESC
             LIMIT 10`
        );

        console.log('📅 DATAS DAS VENDAS (client_id=1):');
        dateDistribution.rows.forEach(row => {
            console.log(`   ${row.data}: ${row.total_vendas} vendas`);
        });

        // Min e Max
        const minMax = await pool.query(
            `SELECT 
                MIN(data_venda::date) as primeira_venda,
                MAX(data_venda::date) as ultima_venda,
                COUNT(*) as total
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );

        console.log(`\n📊 RESUMO:`);
        console.log(`   Primeira venda: ${minMax.rows[0].primeira_venda}`);
        console.log(`   Última venda: ${minMax.rows[0].ultima_venda}`);
        console.log(`   Total: ${minMax.rows[0].total}`);

        // Vendas de hoje
        const hoje = await pool.query(
            `SELECT COUNT(*) as total
             FROM obsidian.vendas 
             WHERE client_id = 1 
             AND data_venda::date = CURRENT_DATE`
        );

        console.log(`\n📆 Vendas de HOJE (${new Date().toISOString().split('T')[0]}): ${hoje.rows[0].total}`);

        // Vendas de novembro/2025
        const novembro = await pool.query(
            `SELECT COUNT(*) as total
             FROM obsidian.vendas 
             WHERE client_id = 1 
             AND data_venda >= '2025-11-01' 
             AND data_venda < '2025-12-01'`
        );

        console.log(`📆 Vendas de NOVEMBRO/2025: ${novembro.rows[0].total}`);

        // Vendas de janeiro/2025
        const janeiro = await pool.query(
            `SELECT COUNT(*) as total
             FROM obsidian.vendas 
             WHERE client_id = 1 
             AND data_venda >= '2025-01-01' 
             AND data_venda < '2025-02-01'`
        );

        console.log(`📆 Vendas de JANEIRO/2025: ${janeiro.rows[0].total}`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

checkDates();
