import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkConstraints() {
    try {
        const result = await pool.query(`
            SELECT 
                con.conname as constraint_name,
                pg_get_constraintdef(con.oid) as definition
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = connamespace
            WHERE nsp.nspname = 'obsidian' 
            AND rel.relname = 'import_batches'
            AND con.contype = 'c'
        `);

        console.log('Constraints de import_batches:');
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await pool.end();
    }
}

checkConstraints();
