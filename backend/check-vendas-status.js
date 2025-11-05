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

async function checkVendasStatus() {
    try {
        // Ver distribuição de canais atuais
        const canais = await pool.query(`
      SELECT 
        canal,
        COUNT(*) as quantidade,
        MIN(data_venda) as primeira_venda,
        MAX(data_venda) as ultima_venda
      FROM obsidian.vendas
      GROUP BY canal
      ORDER BY quantidade DESC
    `);

        console.log('📊 Distribuição de canais nas vendas:\n');
        canais.rows.forEach(row => {
            console.log(`  ${row.canal || '(NULL)'}: ${row.quantidade} vendas`);
            console.log(`    Período: ${row.primeira_venda} até ${row.ultima_venda}`);
        });

        // Ver exemplos de vendas com canal problemático
        const exemplos = await pool.query(`
      SELECT 
        pedido_uid,
        canal,
        nome_cliente,
        sku_produto,
        data_venda,
        raw_id
      FROM obsidian.vendas
      WHERE canal IN ('ML', 'FULL', 'Plataformas', 'Shopee', 'SHEIN')
      ORDER BY data_venda DESC
      LIMIT 10
    `);

        console.log('\n📋 Exemplos de vendas com canal genérico:\n');
        exemplos.rows.forEach(row => {
            console.log(`  Pedido: ${row.pedido_uid}`);
            console.log(`  Canal atual: "${row.canal}"`);
            console.log(`  Cliente: ${row.nome_cliente}`);
            console.log(`  SKU: ${row.sku_produto}`);
            console.log(`  Data: ${row.data_venda}`);
            console.log(`  Raw ID: ${row.raw_id || 'NULL'}`);
            console.log('  ---');
        });

        // Ver se tem dados no full_envio_raw
        const rawCount = await pool.query(`
      SELECT COUNT(*) as total
      FROM obsidian.full_envio_raw
      WHERE status = 'pending'
    `);

        console.log(`\n📦 Full_envio_raw: ${rawCount.rows[0].total} registros pendentes`);

        // Ver exemplo de raw
        const rawExample = await pool.query(`
      SELECT 
        "Nº de Pedido da Plataforma",
        "Plataformas",
        "Nome da Loja no UpSeller",
        "SKU"
      FROM obsidian.full_envio_raw
      WHERE status = 'pending'
      LIMIT 5
    `);

        console.log('\n📋 Exemplo de dados no full_envio_raw:\n');
        rawExample.rows.forEach(row => {
            console.log(`  Pedido: ${row['Nº de Pedido da Plataforma']}`);
            console.log(`  Plataformas: "${row['Plataformas']}"`);
            console.log(`  Nome da Loja: "${row['Nome da Loja no UpSeller']}"`);
            console.log(`  SKU: ${row['SKU']}`);
            console.log('  ---');
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkVendasStatus();
