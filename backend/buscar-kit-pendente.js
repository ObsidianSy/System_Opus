const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    connectionTimeoutMillis: 30000,
});

async function buscarKitPendente() {
    try {
        // Buscar o registro pendente com esse SKU
        const result = await pool.query(`
            SELECT id, envio_id, sku_texto, matched_sku, status, qtd
            FROM logistica.full_envio_raw
            WHERE sku_texto ILIKE '%KIT202-301%' OR sku_texto ILIKE '%H202%H301%'
            ORDER BY id DESC
            LIMIT 10
        `);

        console.log('🔍 Buscando registros com KIT202-301 ou H202+H301:\n');

        if (result.rows.length === 0) {
            console.log('❌ Nenhum registro encontrado!');
        } else {
            console.log(`✅ Encontrados ${result.rows.length} registros:\n`);
            result.rows.forEach(row => {
                console.log(`ID: ${row.id}`);
                console.log(`  SKU: ${row.sku_texto}`);
                console.log(`  Matched: ${row.matched_sku || 'NULL'}`);
                console.log(`  Status: ${row.status}`);
                console.log(`  Qty: ${row.qtd}`);
                console.log('---');
            });
        }

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await pool.end();
    }
}

buscarKitPendente();
