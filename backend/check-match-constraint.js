const { pool } = require('./dist/database/db.js');

async function checkConstraint() {
    try {
        // Ver constraint
        const constraint = await pool.query(`
            SELECT 
                conname as constraint_name,
                pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'raw_export_orders_match_source_check'
        `);

        console.log('🔍 Constraint encontrada:\n');
        if (constraint.rows.length > 0) {
            console.log('Nome:', constraint.rows[0].constraint_name);
            console.log('Definição:', constraint.rows[0].definition);
        } else {
            console.log('❌ Constraint não encontrada');
        }

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkConstraint();
