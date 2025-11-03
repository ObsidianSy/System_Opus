const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function analyzeNormalizerLogic() {
    try {
        console.log('🔍 ANALISANDO LÓGICA DA FUNÇÃO full_envio_normalizar():\n');

        // Pegar o código da função
        const funcCode = await pool.query(`
            SELECT pg_get_functiondef(oid) as definition
            FROM pg_proc
            WHERE proname = 'full_envio_normalizar'
              AND pronamespace = 'logistica'::regnamespace
        `);

        console.log('Código da função:\n');
        console.log(funcCode.rows[0].definition);
        console.log('\n' + '='.repeat(80) + '\n');

        // Analisar um caso específico
        console.log('ANALISANDO CASO ESPECÍFICO:\n');
        console.log('Envio 53293386 - Item com problema:\n');

        const item = await pool.query(`
            SELECT * FROM logistica.full_envio_raw
            WHERE envio_id = 31
              AND codigo_ml = 'BLKX72562'
        `);

        console.log('RAW:', JSON.stringify(item.rows[0], null, 2));
        console.log('');

        // Verificar se existe em full_envio_item
        const itemExists = await pool.query(`
            SELECT * FROM logistica.full_envio_item
            WHERE envio_id = 31
              AND codigo_ml = 'BLKX72562'
        `);

        console.log(`Existe em full_envio_item? ${itemExists.rows.length > 0 ? 'SIM' : 'NÃO'}`);

        if (itemExists.rows.length > 0) {
            console.log('ITEM:', JSON.stringify(itemExists.rows[0], null, 2));
        }
        console.log('');

        // Verificar se o SKU CH204-PTO-40 existe
        const skuExists = await pool.query(`
            SELECT sku, nome FROM obsidian.produtos WHERE sku = 'CH204-PTO-40'
        `);

        console.log(`SKU CH204-PTO-40 existe em produtos? ${skuExists.rows.length > 0 ? 'SIM' : 'NÃO'}`);
        if (skuExists.rows.length > 0) {
            console.log('Produto:', skuExists.rows[0]);
        }
        console.log('');

        // O problema pode ser que a função normalizar NÃO cria registros para SKUs matched
        // mas apenas para SKUs que vieram direto do sku_texto
        console.log('💡 HIPÓTESE:\n');
        console.log('A função full_envio_normalizar() pode estar criando registros em full_envio_item');
        console.log('apenas para linhas onde o sku_texto original já era um SKU válido,');
        console.log('mas NÃO para linhas onde o matched_sku veio de auto-relacionamento.\n');
        console.log('Isso explicaria por que itens matched não aparecem em full_envio_item.\n');

        // Verificar se há itens em full_envio_item para este envio
        const allItems = await pool.query(`
            SELECT 
                i.sku,
                i.codigo_ml,
                i.quantidade,
                r.sku_texto,
                r.matched_sku,
                r.status as raw_status
            FROM logistica.full_envio_item i
            LEFT JOIN logistica.full_envio_raw r ON r.envio_id = i.envio_id AND r.codigo_ml = i.codigo_ml
            WHERE i.envio_id = 31
            ORDER BY i.id
            LIMIT 5
        `);

        console.log('Amostra de itens que ESTÃO em full_envio_item para este envio:\n');
        allItems.rows.forEach(item => {
            console.log(`  - SKU: ${item.sku}, Código ML: ${item.codigo_ml}`);
            console.log(`    sku_texto original: ${item.sku_texto}`);
            console.log(`    matched_sku: ${item.matched_sku}`);
            console.log(`    raw_status: ${item.raw_status}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

analyzeNormalizerLogic();
