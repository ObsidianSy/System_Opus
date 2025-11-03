const { pool } = require('./dist/database/db.js');

async function checkConstraints() {
    try {
        const result = await pool.query(`
            SELECT 
                conname as constraint_name,
                pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'raw_export_orders'::regclass
              AND contype IN ('u', 'p')
            ORDER BY conname
        `);

        console.log('🔍 Constraints UNIQUE/PRIMARY KEY em raw_export_orders:\n');

        if (result.rows.length === 0) {
            console.log('❌ Nenhuma constraint UNIQUE encontrada!');
        } else {
            result.rows.forEach(row => {
                console.log(`📌 ${row.constraint_name}`);
                console.log(`   ${row.definition}\n`);
            });
        }

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkConstraints();
