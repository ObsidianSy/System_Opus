import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkSchema() {
    try {
        await client.connect();
        console.log('✅ Conectado!\n');

        // Verificar estrutura da tabela raw_export_orders
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'raw_export_orders' 
              AND column_name IN ('import_id', 'order_date', 'order_id')
            ORDER BY ordinal_position;
        `);

        console.log('📋 Estrutura da tabela raw_export_orders:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type}`);
        });

        // Ver sample de dados
        const sample = await client.query(`
            SELECT import_id, order_id, order_date 
            FROM raw_export_orders 
            LIMIT 3;
        `);

        console.log('\n📋 Exemplo de dados:');
        sample.rows.forEach(row => {
            console.log(`  import_id: ${row.import_id} (${typeof row.import_id})`);
            console.log(`  order_id: ${row.order_id}`);
            console.log(`  order_date: ${row.order_date} (${typeof row.order_date})`);
            console.log('  ---');
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

checkSchema();
