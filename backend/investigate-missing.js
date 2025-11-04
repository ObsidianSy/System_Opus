require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function investigateMissing() {
    try {
        console.log('🔍 === INVESTIGAÇÃO DE DADOS FALTANTES ===\n');

        // Valor total importado na planilha
        const valorImportado = await pool.query(
            `SELECT 
                SUM((qty::numeric) * (unit_price::numeric)) as total_valor,
                COUNT(*) as total_registros
             FROM raw_export_orders 
             WHERE client_id = 1`
        );

        console.log(`📦 PLANILHA IMPORTADA (raw_export_orders):`);
        console.log(`   Registros: ${valorImportado.rows[0].total_registros}`);
        console.log(`   Valor Total: R$ ${parseFloat(valorImportado.rows[0].total_valor || 0).toFixed(2)}`);

        // Valor total emitido em vendas
        const valorVendas = await pool.query(
            `SELECT 
                SUM(valor_total) as total_valor,
                COUNT(*) as total_registros
             FROM obsidian.vendas 
             WHERE client_id = 1`
        );

        console.log(`\n💰 VENDAS EMITIDAS (obsidian.vendas):`);
        console.log(`   Registros: ${valorVendas.rows[0].total_registros}`);
        console.log(`   Valor Total: R$ ${parseFloat(valorVendas.rows[0].total_valor || 0).toFixed(2)}`);

        // Diferença
        const diff = parseFloat(valorImportado.rows[0].total_valor || 0) - parseFloat(valorVendas.rows[0].total_valor || 0);
        console.log(`\n⚠️ DIFERENÇA:`);
        console.log(`   Faltam: R$ ${diff.toFixed(2)}`);
        console.log(`   Percentual emitido: ${((parseFloat(valorVendas.rows[0].total_valor || 0) / parseFloat(valorImportado.rows[0].total_valor || 0)) * 100).toFixed(2)}%`);

        // Verificar valor esperado vs importado
        const valorEsperado = 262437.13;
        const valorNaPlanilha = parseFloat(valorImportado.rows[0].total_valor || 0);

        console.log(`\n🎯 COMPARAÇÃO COM PLANILHA ORIGINAL:`);
        console.log(`   Valor esperado (da planilha Excel): R$ ${valorEsperado.toFixed(2)}`);
        console.log(`   Valor importado no banco: R$ ${valorNaPlanilha.toFixed(2)}`);
        console.log(`   Diferença: R$ ${(valorEsperado - valorNaPlanilha).toFixed(2)}`);
        console.log(`   Percentual importado: ${((valorNaPlanilha / valorEsperado) * 100).toFixed(2)}%`);

        // Verificar quantidade de linhas
        const qtdEsperada = await pool.query(
            `SELECT MAX(id) as max_id FROM raw_export_orders WHERE client_id = 1`
        );

        console.log(`\n📊 ANÁLISE DE LINHAS:`);
        console.log(`   Total de registros: ${valorImportado.rows[0].total_registros}`);
        console.log(`   ID máximo: ${qtdEsperada.rows[0].max_id}`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

investigateMissing();
