const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function cleanup() {
    const importId = 'eed451b2-bdde-43b1-8c1b-dd0012f66ad9';

    console.log(`🧹 Limpando import ${importId}...\n`);

    // Deletar dados
    const deleted = await pool.query(`DELETE FROM raw_export_orders WHERE import_id = $1`, [importId]);
    console.log(`✅ ${deleted.rowCount} registros deletados de raw_export_orders`);

    // Deletar batch
    const batch = await pool.query(`DELETE FROM obsidian.import_batches WHERE import_id = $1`, [importId]);
    console.log(`✅ Batch deletado`);

    console.log('\n✅ Limpeza concluída!');
    process.exit(0);
}

cleanup().catch(e => { console.error(e); process.exit(1) });
