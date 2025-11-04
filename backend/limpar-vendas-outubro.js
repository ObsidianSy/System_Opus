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
    SELECT 
        COUNT(*) as total,
        SUM(valor_total) as valor_total,
        MIN(data_venda) as primeira_data,
        MAX(data_venda) as ultima_data
    FROM obsidian.vendas
    WHERE import_id = 'b5abfdaf-7a82-4741-9bf1-8c810112440e'
`);

console.log('Vendas do import b5abfdaf-7a82-4741-9bf1-8c810112440e:');
console.log(result.rows[0]);

// Deletar
const deleteResult = await pool.query(`
    DELETE FROM obsidian.vendas
    WHERE import_id = 'b5abfdaf-7a82-4741-9bf1-8c810112440e'
`);

console.log(`\n✅ ${deleteResult.rowCount} vendas deletadas!`);

await pool.end();
