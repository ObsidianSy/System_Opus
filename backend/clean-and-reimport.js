require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function cleanAndReimport() {
    try {
        console.log('🧹 === LIMPANDO DADOS COM DATAS ERRADAS ===\n');

        // 1. Deletar vendas do client_id = 1
        const deleteVendas = await pool.query(
            `DELETE FROM obsidian.vendas WHERE client_id = 1 RETURNING id`
        );
        console.log(`✅ ${deleteVendas.rowCount} vendas deletadas`);

        // 2. Deletar registros da planilha
        const deleteRaw = await pool.query(
            `DELETE FROM raw_export_orders WHERE client_id = 1 RETURNING id`
        );
        console.log(`✅ ${deleteRaw.rowCount} registros deletados de raw_export_orders`);

        console.log(`\n✅ LIMPEZA CONCLUÍDA!`);
        console.log(`\n📋 PRÓXIMOS PASSOS:`);
        console.log(`   1. Reinicie o backend para carregar o parser corrigido`);
        console.log(`   2. Faça upload da planilha novamente`);
        console.log(`   3. Execute o auto-relacionamento`);
        console.log(`   4. Emita as vendas`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

cleanAndReimport();
