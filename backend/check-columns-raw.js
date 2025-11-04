import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
});

const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='raw_export_orders' 
    ORDER BY ordinal_position
`);

console.log('Colunas da tabela raw_export_orders:');
console.log(result.rows.map(r => r.column_name).join(', '));

await pool.end();
