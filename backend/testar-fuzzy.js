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
    console.log('TESTANDO BUSCA FUZZY:\n');

    const testCases = [
        'CH204-PTO-37/38',
        'CH204-PTO-3738',
        'CH204PTO3738',
        'CH204-PTO-38',
        'CH204PTO38'
    ];

    for (const sku of testCases) {
        console.log('Buscando:', sku);

        const searchNormalized = sku.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Busca inteligente - extrai apenas os ÚLTIMOS dígitos (tamanho) e compara
        const result = await pool.query(`
            WITH normalized AS (
                SELECT 
                    sku,
                    REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') as sku_norm,
                    SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '^[A-Z0-9]*[A-Z]') as sku_base,
                    SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '[0-9]+$') as sku_size
                FROM obsidian.produtos
            ),
            search_parts AS (
                SELECT 
                    $1 as full,
                    SUBSTRING($1 FROM '^[A-Z0-9]*[A-Z]') as base,
                    SUBSTRING($1 FROM '[0-9]+$') as size
            )
            SELECT 
                n.sku, 
                n.sku_norm,
                n.sku_base,
                n.sku_size,
                s.base as search_base,
                s.size as search_size
            FROM normalized n, search_parts s
            WHERE n.sku_base = s.base  -- Mesma base (até última letra)
              AND s.size LIKE '%' || n.sku_size || '%'  -- Tamanho da busca contém tamanho do DB
            ORDER BY LENGTH(n.sku_size) DESC  -- Prefere match de tamanho mais longo
            LIMIT 1
        `, [searchNormalized]);

        if (result.rowCount > 0) {
            const r = result.rows[0];
            console.log('   OK - Encontrou:', r.sku);
            console.log('       Base DB:', r.sku_base, '| Tamanho DB:', r.sku_size);
            console.log('       Base busca:', r.search_base, '| Tamanho busca:', r.search_size);
        } else {
            console.log('   NAO ENCONTRADO');
        }
        console.log('');
    }

    await pool.end();
})();
