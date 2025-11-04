import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
});

// Ver todos os imports
const importsResult = await pool.query(`
    SELECT 
        import_id,
        COUNT(*) as total_vendas,
        SUM(valor_total) as valor_total,
        MIN(data_venda) as primeira_data,
        MAX(data_venda) as ultima_data
    FROM obsidian.vendas
    WHERE import_id IS NOT NULL
    GROUP BY import_id
    ORDER BY MIN(data_venda) DESC
`);

console.log('📊 Todos os imports com vendas:');
importsResult.rows.forEach(row => {
    console.log(`\nImport: ${row.import_id}`);
    console.log(`  Total: ${row.total_vendas} vendas`);
    console.log(`  Valor: R$ ${parseFloat(row.valor_total || 0).toFixed(2)}`);
    console.log(`  Período: ${row.primeira_data} a ${row.ultima_data}`);
});

// Ver vendas sem import_id
const semImportResult = await pool.query(`
    SELECT 
        COUNT(*) as total_vendas,
        SUM(valor_total) as valor_total,
        MIN(data_venda) as primeira_data,
        MAX(data_venda) as ultima_data
    FROM obsidian.vendas
    WHERE import_id IS NULL
`);

console.log('\n📋 Vendas SEM import_id:');
console.log(semImportResult.rows[0]);

await pool.end();
