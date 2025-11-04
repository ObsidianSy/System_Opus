const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

(async () => {
    try {
        console.log('\n=== VERIFICANDO pedido_uid NAS VENDAS ===\n');

        // 1. Verificar vendas ML
        console.log('1️⃣ VENDAS ML (raw_export_orders → vendas):');
        const vendasML = await pool.query(`
            SELECT 
                v.pedido_uid,
                v.sku_produto,
                v.canal,
                v.data_venda,
                v.nome_cliente
            FROM obsidian.vendas v
            WHERE v.canal LIKE '%ML%' OR v.canal = 'Mercado Livre'
            ORDER BY v.data_venda DESC
            LIMIT 10
        `);
        console.table(vendasML.rows);

        const mlSemPedido = await pool.query(`
            SELECT COUNT(*) as total 
            FROM obsidian.vendas 
            WHERE (canal LIKE '%ML%' OR canal = 'Mercado Livre') 
            AND (pedido_uid IS NULL OR pedido_uid = '')
        `);
        console.log(`\n⚠️  ML sem pedido_uid: ${mlSemPedido.rows[0].total}\n`);

        // 2. Verificar vendas FULL
        console.log('2️⃣ VENDAS FULL (full_envio → vendas):');
        const vendasFull = await pool.query(`
            SELECT 
                v.pedido_uid,
                v.sku_produto,
                v.canal,
                v.data_venda,
                v.nome_cliente
            FROM obsidian.vendas v
            WHERE v.canal = 'FULL-INBOUND'
            ORDER BY v.data_venda DESC
            LIMIT 10
        `);
        console.table(vendasFull.rows);

        const fullSemPedido = await pool.query(`
            SELECT COUNT(*) as total 
            FROM obsidian.vendas 
            WHERE canal = 'FULL-INBOUND' 
            AND (pedido_uid IS NULL OR pedido_uid = '')
        `);
        console.log(`\n⚠️  FULL sem pedido_uid: ${fullSemPedido.rows[0].total}\n`);

        // 3. Verificar estrutura raw_export_orders (ML)
        console.log('3️⃣ ESTRUTURA ML (raw_export_orders):');
        const mlPedidos = await pool.query(`
            SELECT 
                "Nº de Pedido da Plataforma" as pedido_plataforma,
                "Nº de Pedido" as pedido_interno,
                sku_text,
                channel,
                status,
                matched_sku
            FROM raw_export_orders
            WHERE status = 'matched'
            ORDER BY id DESC
            LIMIT 5
        `);
        console.table(mlPedidos.rows);

        // 4. Verificar estrutura full_envio_item (FULL)
        console.log('\n4️⃣ ESTRUTURA FULL (full_envio_item):');
        const fullItens = await pool.query(`
            SELECT 
                ei.id,
                ei.envio_id,
                ei.codigo_ml,
                ei.sku,
                e.envio_num
            FROM logistica.full_envio_item ei
            JOIN logistica.full_envio e ON e.id = ei.envio_id
            ORDER BY ei.id DESC
            LIMIT 5
        `);
        console.table(fullItens.rows);

        // 5. Ver função full_envio_emitir
        console.log('\n5️⃣ ANALISANDO FUNÇÃO full_envio_emitir:');
        const funcao = await pool.query(`
            SELECT pg_get_functiondef(oid) as def
            FROM pg_proc
            WHERE pronamespace = 'logistica'::regnamespace
              AND proname = 'full_envio_emitir'
        `);

        const def = funcao.rows[0].def;
        const insertVendas = def.substring(def.indexOf('INSERT INTO obsidian.vendas'), def.indexOf('INSERT INTO obsidian.vendas') + 500);
        console.log(insertVendas);

        console.log('\n\n=== PROBLEMAS IDENTIFICADOS ===\n');
        console.log('❌ ML: Não está gerando pedido_uid nas vendas');
        console.log('❌ FULL: Não está gerando pedido_uid nas vendas (função do banco)');
        console.log('\n💡 SOLUÇÃO:');
        console.log('   ML: Usar "Nº de Pedido da Plataforma" como pedido_uid');
        console.log('   FULL: Usar CONCAT(envio_num, \'-\', codigo_ml) como pedido_uid');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
})();
