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

async function checkUpdateResults() {
    try {
        // Ver quantas vendas ainda têm canal genérico
        const generic = await pool.query(`
      SELECT canal, COUNT(*) as quantidade
      FROM obsidian.vendas
      WHERE canal IN ('SHOPEE', 'SHEIN', 'MERCADO LIBRE', 'ML', 'FULL-INBOUND', 'Shopee')
      GROUP BY canal
      ORDER BY quantidade DESC
    `);

        console.log('📊 Vendas com canal genérico (ainda não atualizadas):\n');
        let totalGeneric = 0;
        generic.rows.forEach(row => {
            console.log(`  ${row.canal}: ${row.quantidade} vendas`);
            totalGeneric += parseInt(row.quantidade);
        });
        console.log(`\n  TOTAL: ${totalGeneric} vendas com canal genérico`);

        // Ver canais específicos (já atualizados)
        const specific = await pool.query(`
      SELECT canal, COUNT(*) as quantidade
      FROM obsidian.vendas
      WHERE canal NOT IN ('SHOPEE', 'SHEIN', 'MERCADO LIBRE', 'ML', 'FULL-INBOUND', 'Shopee')
      GROUP BY canal
      ORDER BY quantidade DESC
      LIMIT 10
    `);

        console.log('\n✅ Vendas com canal específico (atualizadas):\n');
        let totalSpecific = 0;
        specific.rows.forEach(row => {
            console.log(`  ${row.canal}: ${row.quantidade} vendas`);
            totalSpecific += parseInt(row.quantidade);
        });
        console.log(`\n  TOTAL: ${totalSpecific} vendas com canal específico`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkUpdateResults();
