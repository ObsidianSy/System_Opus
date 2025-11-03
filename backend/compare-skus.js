const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function compareSKUs() {
    try {
        console.log('🔍 COMPARANDO SKUs ML vs PRODUTOS:\n');
        console.log('='.repeat(80) + '\n');

        // 1. SKUs ML pending
        console.log('1️⃣ TOP SKUs ML PENDING:\n');
        
        const mlSkus = await pool.query(`
            SELECT DISTINCT sku_text
            FROM raw_export_orders
            WHERE status = 'pending'
            ORDER BY sku_text
            LIMIT 20
        `);

        mlSkus.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.sku_text}`);
        });

        // 2. SKUs em produtos (amostra)
        console.log('\n\n2️⃣ AMOSTRA DE SKUs EM PRODUTOS:\n');
        
        const prodSkus = await pool.query(`
            SELECT sku
            FROM obsidian.produtos
            WHERE sku LIKE 'CMS%' OR sku LIKE 'E-%'
            ORDER BY sku
            LIMIT 20
        `);

        prodSkus.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.sku}`);
        });

        // 3. Verificar se existe match parcial
        console.log('\n\n3️⃣ TENTANDO MATCH PARCIAL:\n');
        
        for (const mlRow of mlSkus.rows.slice(0, 5)) {
            const mlSku = mlRow.sku_text;
            
            // Buscar produtos que começam com as primeiras letras
            const prefix = mlSku.split('-').slice(0, 2).join('-'); // Ex: CMS-044
            
            const similar = await pool.query(`
                SELECT sku
                FROM obsidian.produtos
                WHERE sku LIKE $1 || '%'
                LIMIT 5
            `, [prefix]);

            console.log(`ML: ${mlSku}`);
            if (similar.rows.length > 0) {
                console.log(`  Produtos similares:`);
                similar.rows.forEach(row => {
                    console.log(`    - ${row.sku}`);
                });
            } else {
                console.log(`  ❌ Nenhum produto similar encontrado`);
            }
            console.log('');
        }

        // 4. Verificar aliases existentes
        console.log('4️⃣ VERIFICANDO ALIASES:\n');
        
        const aliasCount = await pool.query(`
            SELECT COUNT(*) as count
            FROM obsidian.sku_aliases
        `);

        console.log(`Total de aliases: ${aliasCount.rows[0].count}\n`);

        // Buscar aliases que podem ajudar
        const relevantAliases = await pool.query(`
            SELECT alias_text, stock_sku, times_used
            FROM obsidian.sku_aliases
            WHERE alias_text LIKE 'CMS%' OR alias_text LIKE 'E-%'
            ORDER BY times_used DESC
            LIMIT 10
        `);

        if (relevantAliases.rows.length > 0) {
            console.log('Aliases relevantes mais usados:');
            relevantAliases.rows.forEach(row => {
                console.log(`  ${row.alias_text} → ${row.stock_sku} (usado ${row.times_used}x)`);
            });
        } else {
            console.log('⚠️  Nenhum alias relevante encontrado');
        }

        console.log('\n' + '='.repeat(80));
        console.log('💡 DIAGNÓSTICO:\n');
        console.log('Os SKUs do ML (ex: CMS-044-PTO-P) não batem exatamente com os');
        console.log('SKUs em produtos. Isso significa que:');
        console.log('');
        console.log('  1. Os SKUs podem ter formato diferente no sistema');
        console.log('  2. Os produtos podem estar cadastrados com outro padrão');
        console.log('  3. É necessário criar aliases para mapear ML → Estoque\n');
        console.log('SOLUÇÃO: Criar aliases manualmente ou fazer relacionamento manual');
        console.log('         na interface para que o sistema aprenda os mapeamentos.');
        console.log('='.repeat(80));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

compareSKUs();
