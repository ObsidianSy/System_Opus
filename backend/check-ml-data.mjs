import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkData() {
    try {
        await client.connect();
        console.log('✅ Conectado!\n');

        // Verificar dados em raw_export_orders (ML)
        const mlData = await client.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'matched') as relacionados,
                COUNT(*) FILTER (WHERE status = 'pending') as pendentes
            FROM raw_export_orders;
        `);

        console.log('📊 Tabela raw_export_orders (ML):');
        console.log(`  Total: ${mlData.rows[0].total}`);
        console.log(`  Relacionados: ${mlData.rows[0].relacionados}`);
        console.log(`  Pendentes: ${mlData.rows[0].pendentes}\n`);

        // Verificar vendas
        const vendas = await client.query(`
            SELECT COUNT(*) as total FROM obsidian.vendas;
        `);

        console.log('📊 Tabela vendas:');
        console.log(`  Total: ${vendas.rows[0].total}\n`);

        // Ver último import
        const lastImport = await client.query(`
            SELECT 
                import_id,
                client_id,
                COUNT(*) as linhas,
                MAX(created_at) as data_import
            FROM raw_export_orders
            GROUP BY import_id, client_id
            ORDER BY MAX(created_at) DESC
            LIMIT 1;
        `);

        if (lastImport.rows.length > 0) {
            console.log('📋 Último import:');
            console.log(`  ID: ${lastImport.rows[0].import_id}`);
            console.log(`  Cliente: ${lastImport.rows[0].client_id}`);
            console.log(`  Linhas: ${lastImport.rows[0].linhas}`);
            console.log(`  Data: ${lastImport.rows[0].data_import}`);
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.end();
    }
}

checkData();
