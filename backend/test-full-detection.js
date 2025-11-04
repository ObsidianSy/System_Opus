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
    console.log('🔍 Simulando detecção de Fulfillment...\n');

    // Buscar pedidos com método "Mercado Fufillment"
    const pedidosFull = await pool.query(`
        SELECT 
            order_id,
            channel,
            "Método de Envio" as metodo_envio,
            COUNT(*) as itens
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND ("Método de Envio" ILIKE '%fufill%' OR "Método de Envio" ILIKE '%fulfill%')
        GROUP BY order_id, channel, "Método de Envio"
        ORDER BY order_id
        LIMIT 10
    `);

    console.log(`📦 Encontrados ${pedidosFull.rows.length} pedidos com Fulfillment:\n`);
    
    pedidosFull.rows.forEach(p => {
        const canal = p.channel?.toUpperCase() || 'ML';
        const metodoEnvio = p.metodo_envio?.toUpperCase() || '';
        
        const isFull = canal.includes('FULL') || 
                       canal.includes('FBM') || 
                       metodoEnvio.includes('FULL') || 
                       metodoEnvio.includes('FBM') ||
                       metodoEnvio.includes('FUFILL');
        
        console.log(`Pedido: ${p.order_id}`);
        console.log(`  Canal: ${p.channel}`);
        console.log(`  Método: ${p.metodo_envio}`);
        console.log(`  Itens: ${p.itens}`);
        console.log(`  ✅ Seria pulado? ${isFull ? 'SIM' : 'NÃO'}\n`);
    });

    // Estatísticas
    console.log('📊 Resumo por método de envio:');
    const stats = await pool.query(`
        SELECT 
            "Método de Envio",
            COUNT(DISTINCT order_id) as pedidos,
            COUNT(*) as itens,
            CASE 
                WHEN "Método de Envio" ILIKE '%fufill%' OR "Método de Envio" ILIKE '%fulfill%' THEN 'FULL ⏭️'
                ELSE 'NORMAL ✅'
            END as tipo
        FROM raw_export_orders
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY "Método de Envio"
        ORDER BY pedidos DESC
    `);
    
    console.table(stats.rows);

    await pool.end();
})();
