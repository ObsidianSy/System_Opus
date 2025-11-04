const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

(async () => {
    console.log('INVESTIGANDO CH204-PTO-37/38:\n');

    // Buscar produtos com CH204
    const produtos = await pool.query(`
        SELECT sku, nome 
        FROM obsidian.produtos 
        WHERE sku ILIKE '%CH204%'
        ORDER BY sku
    `);

    console.log('PRODUTOS NO ESTOQUE:', produtos.rowCount);
    produtos.rows.forEach(p => {
        console.log('   ', p.sku, '-', p.nome);
    });

    // Buscar pendências
    console.log('\nPENDENCIAS FULL COM CH204:');
    const pendencias = await pool.query(`
        SELECT id, envio_id, sku_texto, codigo_ml, status
        FROM logistica.full_envio_raw
        WHERE sku_texto ILIKE '%CH204%' AND status = 'pending'
    `);

    console.log('Total:', pendencias.rowCount);
    pendencias.rows.forEach(p => {
        console.log('   ', p.sku_texto, '| codigo_ml:', p.codigo_ml);
    });

    // Testar busca do auto-relacionamento
    const skuTeste = 'CH204-PTO-37/38';
    console.log('\nTESTANDO BUSCA AUTO-RELACIONAMENTO:');
    console.log('SKU para buscar:', skuTeste);

    // Busca exata
    const exato = await pool.query(`
        SELECT sku FROM obsidian.produtos 
        WHERE UPPER(sku) = UPPER($1)
    `, [skuTeste]);
    console.log('Busca exata:', exato.rowCount > 0 ? 'OK - ' + exato.rows[0].sku : 'NAO ENCONTRADO');

    // Busca com TRIM
    const trim = await pool.query(`
        SELECT sku FROM obsidian.produtos 
        WHERE UPPER(TRIM(sku)) = UPPER(TRIM($1))
    `, [skuTeste]);
    console.log('Busca TRIM:', trim.rowCount > 0 ? 'OK - ' + trim.rows[0].sku : 'NAO ENCONTRADO');

    // Busca removendo /
    const semBarra = skuTeste.replace(/\//g, '');
    const semBarraDB = await pool.query(`
        SELECT sku FROM obsidian.produtos 
        WHERE UPPER(REPLACE(sku, '/', '')) = UPPER($1)
    `, [semBarra]);
    console.log('Busca sem / (' + semBarra + '):', semBarraDB.rowCount > 0 ? 'OK - ' + semBarraDB.rows[0].sku : 'NAO ENCONTRADO');

    await pool.end();
})();
