const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    connectionTimeoutMillis: 30000,
});

async function checkRawId() {
    try {
        const result = await pool.query(`
            SELECT id, envio_id, sku_texto, matched_sku, status
            FROM logistica.full_envio_raw
            WHERE id = 158478
        `);

        console.log('🔍 Buscando ID 158478 em full_envio_raw:\n');

        if (result.rows.length === 0) {
            console.log('❌ ID 158478 NÃO EXISTE na tabela!');

            // Buscar IDs próximos
            const nearby = await pool.query(`
                SELECT id, envio_id, sku_texto, matched_sku, status
                FROM logistica.full_envio_raw
                WHERE id BETWEEN 158470 AND 158485
                ORDER BY id
            `);

            console.log('\n📋 IDs próximos (158470-158485):');
            nearby.rows.forEach(row => {
                console.log(`  ID: ${row.id} | SKU: ${row.sku_texto} | matched: ${row.matched_sku} | status: ${row.status}`);
            });
        } else {
            console.log('✅ ID encontrado:', result.rows[0]);
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await pool.end();
    }
}

checkRawId();
