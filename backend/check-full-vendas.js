const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

(async () => {
    console.log('🔍 Verificando vendas FULL/FBM no banco...\n');

    // Verificar se existem vendas com canal FULL
    const vendasFull = await pool.query(`
        SELECT canal, COUNT(*) as total 
        FROM obsidian.vendas 
        WHERE canal ILIKE '%FULL%' OR canal ILIKE '%FBM%' 
        GROUP BY canal
    `);

    if (vendasFull.rows.length > 0) {
        console.log('❌ ERRO! Encontradas vendas com canal FULL/FBM:');
        console.table(vendasFull.rows);
    } else {
        console.log('✅ Nenhuma venda FULL/FBM encontrada (correto!)');
    }

    // Verificar últimas importações
    console.log('\n📊 Últimas importações ML:');
    const ultimasImportacoes = await pool.query(`
        SELECT 
            import_id,
            filename,
            total_rows,
            processed_rows,
            status,
            started_at
        FROM obsidian.import_batches
        WHERE source = 'ML'
        ORDER BY started_at DESC
        LIMIT 5
    `);
    console.table(ultimasImportacoes.rows);

    // Verificar quantas linhas ML foram processadas e quantas com FULL
    console.log('\n📊 Análise de canais nas linhas importadas:');
    const canaisML = await pool.query(`
        SELECT 
            channel,
            status,
            COUNT(*) as total
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY channel, status
        ORDER BY total DESC
    `);
    console.table(canaisML.rows);

    await pool.end();
})();
