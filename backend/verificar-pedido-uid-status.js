const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function verificar() {
    try {
        console.log('📊 STATUS PEDIDO_UID NAS VENDAS:\n');

        // FULL
        const full = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(pedido_uid) as com_pedido_uid,
                COUNT(*) - COUNT(pedido_uid) as sem_pedido_uid
            FROM obsidian.vendas
            WHERE canal = 'FULL-INBOUND'
        `);

        console.log('1️⃣ VENDAS FULL:');
        console.log(`   Total: ${full.rows[0].total}`);
        console.log(`   ✅ Com pedido_uid: ${full.rows[0].com_pedido_uid}`);
        console.log(`   ⚠️ Sem pedido_uid: ${full.rows[0].sem_pedido_uid}`);

        if (full.rows[0].com_pedido_uid > 0) {
            const exemplos = await pool.query(`
                SELECT pedido_uid, sku_produto, nome_cliente
                FROM obsidian.vendas
                WHERE canal = 'FULL-INBOUND' AND pedido_uid IS NOT NULL
                LIMIT 5
            `);
            console.log('\n   📋 Exemplos:');
            exemplos.rows.forEach(r => {
                console.log(`      ${r.pedido_uid} - ${r.sku_produto} (${r.nome_cliente})`);
            });
        }

        // ML
        const ml = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(pedido_uid) as com_pedido_uid,
                COUNT(*) - COUNT(pedido_uid) as sem_pedido_uid
            FROM obsidian.vendas
            WHERE canal IN ('Shopee', 'Mercado Livre', 'Shopify')
        `);

        console.log('\n\n2️⃣ VENDAS ML:');
        console.log(`   Total: ${ml.rows[0].total}`);
        console.log(`   ✅ Com pedido_uid: ${ml.rows[0].com_pedido_uid}`);
        console.log(`   ⚠️ Sem pedido_uid: ${ml.rows[0].sem_pedido_uid}`);

        await pool.end();
    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    }
}

verificar();
