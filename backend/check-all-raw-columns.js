const { pool } = require('./dist/database/db.js');

async function checkAllColumns() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'raw_export_orders'
            ORDER BY ordinal_position
        `);

        console.log('📋 TODAS as colunas de raw_export_orders:\n');
        result.rows.forEach((col, idx) => {
            console.log(`${idx + 1}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? '- NOT NULL' : ''}`);
        });

        console.log(`\n✅ Total: ${result.rows.length} colunas`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkAllColumns();
