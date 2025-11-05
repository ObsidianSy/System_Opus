const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    connectionTimeoutMillis: 30000,
    ssl: false
});

async function checkLogisticaTables() {
    try {
        // Ver tabelas no schema logistica
        const tables = await pool.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = 'logistica' 
         AND information_schema.columns.table_name = t.table_name) as num_columns
      FROM information_schema.tables t
      WHERE table_schema = 'logistica'
      ORDER BY table_name
    `);

        console.log('📋 Tabelas no schema LOGISTICA:\n');
        tables.rows.forEach(row => {
            console.log(`  • ${row.table_name} (${row.num_columns} colunas)`);
        });

        // Ver quantos registros tem em full_envio_raw
        const count = await pool.query(`
      SELECT COUNT(*) as total FROM logistica.full_envio_raw
    `);
        console.log(`\n📦 logistica.full_envio_raw: ${count.rows[0].total} registros`);

        // Ver exemplo de dados
        const sample = await pool.query(`
      SELECT 
        "Nº de Pedido da Plataforma",
        "Plataformas",
        "Nome da Loja no UpSeller",
        "SKU",
        status
      FROM logistica.full_envio_raw
      LIMIT 5
    `);

        console.log('\n📋 Exemplo de dados em logistica.full_envio_raw:\n');
        sample.rows.forEach(row => {
            console.log(`  Pedido: ${row['Nº de Pedido da Plataforma']}`);
            console.log(`  Plataformas: "${row['Plataformas']}"`);
            console.log(`  Nome da Loja no UpSeller: "${row['Nome da Loja no UpSeller']}"`);
            console.log(`  SKU: ${row['SKU']}`);
            console.log(`  Status: ${row.status}`);
            console.log('  ---');
        });

        // Ver status dos registros
        const statusCount = await pool.query(`
      SELECT 
        status,
        COUNT(*) as quantidade
      FROM logistica.full_envio_raw
      GROUP BY status
      ORDER BY quantidade DESC
    `);

        console.log('\n📊 Distribuição por status:\n');
        statusCount.rows.forEach(row => {
            console.log(`  ${row.status || '(NULL)'}: ${row.quantidade} registros`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkLogisticaTables();
