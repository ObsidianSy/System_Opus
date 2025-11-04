import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '72.60.147.138',
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    port: 5432,
});

async function testarSmartSearch() {
    console.log('TESTANDO BUSCA INTELIGENTE - VÁRIOS CENÁRIOS:\n');

    const testCases = [
        // CH204 (já sabemos que funciona)
        { busca: 'CH204-PTO-37/38', esperado: 'CH204-PTO-38' },

        // CH202 OFF white 34/35 → 35
        { busca: 'CH202-OFF-34/35', esperado: 'CH202-OFF-35' },

        // CH202 OFF white 35/36 → 36
        { busca: 'CH202-OFF-35/36', esperado: 'CH202-OFF-36' },

        // Outros padrões
        { busca: 'CH204-OFF-39/40', esperado: 'CH204-OFF-40' },
        { busca: 'CH204-PTO-39/40', esperado: 'CH204-PTO-40' },

        // Padrão sem barra também
        { busca: 'CH2043940', esperado: 'CH204-PTO-40' },
    ];

    for (const test of testCases) {
        console.log(`Buscando: ${test.busca}`);
        console.log(`  Esperado encontrar: ${test.esperado}`);

        const searchNormalized = test.busca.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Busca inteligente - mesma query do código de produção
        const result = await pool.query(
            `WITH normalized AS (
                SELECT 
                    sku,
                    REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') as sku_norm,
                    SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '^[A-Z0-9]*[A-Z]') as sku_base,
                    SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '[0-9]+$') as sku_size
                FROM obsidian.produtos
            ),
            search_parts AS (
                SELECT 
                    $1 as search_norm,
                    SUBSTRING($1 FROM '^[A-Z0-9]*[A-Z]') as search_base,
                    SUBSTRING($1 FROM '[0-9]+$') as search_size
            )
            SELECT 
                n.sku, 
                n.sku_base,
                n.sku_size,
                s.search_base,
                s.search_size
            FROM normalized n, search_parts s
            WHERE n.sku_base = s.search_base
              AND s.search_size LIKE '%' || n.sku_size || '%'
            ORDER BY LENGTH(n.sku_size) DESC
            LIMIT 1`,
            [searchNormalized]
        );

        if (result.rowCount > 0) {
            const r = result.rows[0];
            const match = r.sku === test.esperado ? '✅ CORRETO' : '❌ INCORRETO';
            console.log(`  ${match} - Encontrou: ${r.sku}`);
            console.log(`     Base: ${r.sku_base} | Tamanho DB: ${r.sku_size} | Tamanho busca: ${r.search_size}`);
        } else {
            console.log('  ❌ NAO ENCONTRADO');
        }
        console.log('');
    }

    console.log('\nVerificando quais CH202 e CH204 existem no banco:');
    const produtosResult = await pool.query(
        `SELECT sku FROM obsidian.produtos 
         WHERE sku LIKE 'CH202%' OR sku LIKE 'CH204%'
         ORDER BY sku`
    );

    console.log(`\nTotal: ${produtosResult.rowCount} produtos`);
    for (const row of produtosResult.rows) {
        console.log(`  - ${row.sku}`);
    }

    await pool.end();
}

testarSmartSearch().catch(console.error);
