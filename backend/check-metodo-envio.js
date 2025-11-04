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
    console.log('🔍 Verificando métodos de envio nas últimas 24h...\n');

    // Verificar métodos de envio
    const metodos = await pool.query(`
        SELECT 
            "Método de Envio",
            channel,
            COUNT(*) as total
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY "Método de Envio", channel
        ORDER BY total DESC
        LIMIT 20
    `);

    console.log('📦 Métodos de Envio encontrados:');
    console.table(metodos.rows);

    // Verificar se tem algum com palavra FULL
    console.log('\n🔍 Procurando por FULL/FBM no método de envio...\n');
    const fullMetodos = await pool.query(`
        SELECT 
            "Método de Envio",
            channel,
            COUNT(*) as total
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND ("Método de Envio" ILIKE '%FULL%' OR "Método de Envio" ILIKE '%FBM%')
        GROUP BY "Método de Envio", channel
        ORDER BY total DESC
    `);

    if (fullMetodos.rows.length > 0) {
        console.log('⚠️ Encontrados métodos com FULL/FBM:');
        console.table(fullMetodos.rows);
    } else {
        console.log('✅ Nenhum método de envio com FULL/FBM encontrado');
    }

    // Verificar se canal tem FULL
    console.log('\n🔍 Verificando canais com FULL/FBM...\n');
    const canaisfull = await pool.query(`
        SELECT 
            channel,
            "Método de Envio",
            COUNT(*) as total
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND (channel ILIKE '%FULL%' OR channel ILIKE '%FBM%')
        GROUP BY channel, "Método de Envio"
        ORDER BY total DESC
    `);

    if (canaisfull.rows.length > 0) {
        console.log('⚠️ Encontrados canais com FULL/FBM:');
        console.table(canaisfull.rows);
        
        console.log('\n📊 Analisando se foram emitidos como vendas...');
        const vendasFull = await pool.query(`
            SELECT v.canal, COUNT(*) as total_vendas
            FROM obsidian.vendas v
            WHERE v.created_at > NOW() - INTERVAL '24 hours'
              AND (v.canal ILIKE '%FULL%' OR v.canal ILIKE '%FBM%')
            GROUP BY v.canal
        `);
        
        if (vendasFull.rows.length > 0) {
            console.log('❌ ERRO! Estas vendas FULL foram emitidas incorretamente:');
            console.table(vendasFull.rows);
        } else {
            console.log('✅ Nenhuma venda FULL foi emitida (correto!)');
        }
    } else {
        console.log('✅ Nenhum canal com FULL/FBM encontrado');
    }

    await pool.end();
})();
